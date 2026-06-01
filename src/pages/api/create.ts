import type { NextApiRequest, NextApiResponse } from "next";
import { waitUntil } from "@vercel/functions";

export const config = {
    api: { bodyParser: { sizeLimit: "10mb" }, responseLimit: false },
    maxDuration: 300,
};
import slugify from "slugify";
import { getSupabase } from "@/lib/supabase";
import { requireAuth, getUserAccounts } from "@/lib/auth";
import { checkArticleLimit, incrementArticleCount } from "@/lib/usage";
import { buildBrandEngine, type CompanyRecord } from "@/lib/buildBrandEngine";
import { buildAllJsonLd } from "@/lib/jsonld";
import { compileReferenceArticles } from "@/lib/referenceArticles";
import { compileUserPrompt } from "@/lib/compileUserPrompt";
import { compileImageSystemPrompt, compileImageUserPrompt } from "@/lib/compileImagePrompt";
import {
    compileBlogSystemPrompt,
    getImageStyleCategories,
} from "@/brand/engine";
import { generateCompositeImage } from "@/lib/compositeEngine";
import {
    buildBlogHumanizePrompt,
    buildShortContentHumanizePrompt,
} from "@/brand/humanizer";
import {
    generateEmbedding,
    buildArticleEmbeddingText,
    formatVectorForSupabase,
} from "@/lib/embeddings";
import {
    resolveModelId,
    getStructuredResponse,
    getTextResponse,
    generateImageBase64,
} from "@/lib/ai-client";

const BlogSchema = {
    type: "object",
    additionalProperties: false,
    required: ["title", "excerpt", "outline", "html", "seo", "faq", "key_takeaways", "how_to_steps", "content_type"],
    properties: {
        title: { type: "string" },
        excerpt: { type: "string" },
        outline: {
            type: "array",
            items: { type: "string" },
            minItems: 3,
            maxItems: 12,
        },
        html: { type: "string" },
        seo: {
            type: "object",
            additionalProperties: false,
            required: ["meta_title", "meta_description", "keywords", "primary_keyword", "secondary_keywords", "slug"],
            properties: {
                meta_title: { type: "string" },
                meta_description: { type: "string" },
                keywords: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 3,
                    maxItems: 12,
                },
                primary_keyword: { type: "string" },
                secondary_keywords: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 5,
                    maxItems: 15,
                },
                slug: { type: "string" },
            },
        },
        faq: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["question", "answer"],
                properties: {
                    question: { type: "string" },
                    answer: { type: "string" },
                },
            },
            minItems: 3,
            maxItems: 8,
        },
        key_takeaways: {
            type: "array",
            items: { type: "string" },
            minItems: 4,
            maxItems: 8,
        },
        how_to_steps: {
            type: "array",
            items: { type: "string" },
            description: "Ordered steps extracted from the main procedural/step-by-step section, if any. Each string is a single actionable step. Empty array if no procedural content.",
        },
        content_type: {
            type: "string",
            enum: ["article", "how_to", "comparison", "listicle"],
        },
    },
} as const;

type BlogOutput = {
    title: string;
    excerpt: string;
    outline: string[];
    html: string;
    seo: {
        meta_title: string;
        meta_description: string;
        keywords: string[];
        primary_keyword: string;
        secondary_keywords: string[];
        slug: string;
    };
    faq: { question: string; answer: string }[];
    key_takeaways: string[];
    how_to_steps: string[];
    content_type: "article" | "how_to" | "comparison" | "listicle";
};

type SuccessResponse = BlogOutput & {
    slug: string;
    image_prompt: string;
    image_base64: string | null;
    jsonld: Record<string, unknown>[];
};

type ErrorResponse = {
    error: string;
};

function assertEnv() {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("Missing OPENAI_API_KEY");
    }
}



export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        assertEnv();

        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed. Use POST." });
        }

        const {
            creation_prompt: rawCreationPrompt, image_style, model: requestedModel, word_count, company_id,
            // Snippet collection for research context injection
            snippet_collection_id,
            // Optional cluster assignment for single articles
            cluster_id,
            // Composite-specific fields (when style type is "composite")
            composite_product_image_url,
            composite_bg_image_url,
            composite_bg_prompt: compositeOverrideBgPrompt,
        } = req.body ?? {};

        if (
            typeof rawCreationPrompt !== "string" ||
            rawCreationPrompt.trim().length < 5
        ) {
            return res.status(400).json({ error: "creation_prompt required" });
        }

        if (typeof company_id !== "string" || !company_id) {
            return res.status(400).json({ error: "company_id is required" });
        }

        // Auth check
        const authUser = await requireAuth(req, res);
        if (!authUser) return;

        // Fetch company data (reused by pipeline to avoid duplicate fetch)
        const { data: companyData } = await getSupabase()
            .from("companies")
            .select("*")
            .eq("id", company_id)
            .single();

        let accountId = companyData?.account_id;
        if (!accountId) {
            // Fall back to user's first account
            const accounts = await getUserAccounts(authUser.id);
            accountId = accounts[0]?.account_id;
        }

        // Check article usage limits (if we have an account)
        if (accountId) {
            const usage = await checkArticleLimit(accountId);
            if (usage.overage > 0) {
                console.log(`[create] Account ${accountId} is in overage: ${usage.used}/${usage.limit} (${usage.overage} over)`);
            }
        }

        // ── Create placeholder article & respond immediately ────────────
        // This ensures the client gets a response in <2 seconds regardless
        // of how long the LLM pipeline takes.
        // Strip any prepended voice profile (separated by "---") to get the user's actual topic
        const topicText = rawCreationPrompt.includes("\n---\n")
            ? rawCreationPrompt.split("\n---\n").pop()!.trim()
            : rawCreationPrompt.trim();
        const placeholderTitle = topicText.slice(0, 120) || "New Article";
        const placeholderSlug = slugify(placeholderTitle, { lower: true, strict: true, trim: true });

        let savedArticleId: string | null = null;
        try {
            const { data: savedArticle } = await getSupabase().from("articles").insert({
                title: placeholderTitle,
                slug: placeholderSlug,
                excerpt: "Generating article…",
                html: "<p>Article is being generated. This page will update automatically when ready.</p>",
                image_base64: null,
                image_prompt: null,
                seo: {},
                outline: [],
                model_used: resolveModelId(requestedModel),
                image_style: image_style || "default",
                company_id: company_id || null,
                account_id: accountId || null,
                status: "generating",
                cluster_id: cluster_id || null,
                cluster_role: cluster_id ? "supporting" : null,
            }).select("id").single();
            savedArticleId = savedArticle?.id ?? null;
        } catch (saveErr) {
            console.error("Failed to create placeholder article:", saveErr);
            return res.status(500).json({ error: "Failed to create article record" });
        }

        // Increment usage counter immediately
        if (accountId) {
            try { await incrementArticleCount(accountId); }
            catch (usageErr) { console.warn("Failed to increment usage counter:", usageErr); }
        }

        // Respond immediately — client will see the article in the list
        res.status(200).json({
            id: savedArticleId,
            title: placeholderTitle,
            slug: placeholderSlug,
            status: "generating",
        });

        // ── Run pipeline in background ────────────────────────────────────
        // Build the pipeline promise with status tracking.
        const pipelinePromise = runArticlePipeline({
                articleId: savedArticleId!,
                rawCreationPrompt,
                requestedModel,
                word_count,
                company_id,
                snippet_collection_id,
                image_style,
                composite_product_image_url,
                composite_bg_image_url,
                compositeOverrideBgPrompt,
                accountId,
                companyData,
            })
                .then(async () => {
                    console.log(`[create] Pipeline completed for ${savedArticleId}`);
                    try {
                        await getSupabase().from("articles").update({
                            status: "ready",
                        }).eq("id", savedArticleId);
                    } catch { /* best-effort */ }
                })
                .catch(async (pipelineErr) => {
                    console.error(`[create] Background pipeline failed for ${savedArticleId}:`, pipelineErr);
                    if (savedArticleId) {
                        try {
                            await getSupabase().from("articles").update({
                                status: "failed",
                                html: `<p>Article generation failed: ${pipelineErr instanceof Error ? pipelineErr.message : "Unknown error"}. Please try again.</p>`,
                                excerpt: "Generation failed — please regenerate.",
                            }).eq("id", savedArticleId);
                        } catch { /* best-effort */ }
                    }
                });

        // On Vercel: waitUntil() keeps the serverless function alive after the
        // response is sent. Locally: waitUntil isn't available, so fall back
        // to await (works fine since the Node.js dev server is long-lived).
        try {
            waitUntil(pipelinePromise);
        } catch {
            await pipelinePromise;
        }
    } catch (err) {
        console.error("API /api/create error:", err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}

/**
 * Full article generation pipeline — runs in the background after HTTP response.
 * Updates the DB row progressively so the article improves over time:
 *   1. Generate blog content → save
 *   2. Humanize content → save
 *   3. Generate image → save
 *   4. Generate embedding → save
 */
async function runArticlePipeline({
    articleId,
    rawCreationPrompt,
    requestedModel,
    word_count,
    company_id,
    snippet_collection_id,
    image_style,
    composite_product_image_url,
    composite_bg_image_url,
    compositeOverrideBgPrompt,
    accountId,
    companyData: passedCompanyData,
}: {
    articleId: string;
    rawCreationPrompt: string;
    requestedModel?: string;
    word_count?: string;
    company_id: string;
    snippet_collection_id?: string;
    image_style?: string;
    composite_product_image_url?: string;
    composite_bg_image_url?: string;
    compositeOverrideBgPrompt?: string;
    accountId?: string;
    companyData?: any;
}) {
    const sb = getSupabase();
    const selectedModel = resolveModelId(requestedModel);
    let styleId = "default";
    const rawStyle = image_style;

    // ── Build brand engine ──────────────────────────────────────────
    let company = passedCompanyData;
    if (!company) {
        const { data, error } = await sb
            .from("companies")
            .select("*")
            .eq("id", company_id)
            .single();
        if (error || !data) throw new Error("Company not found");
        company = data;
    }

    const brand = buildBrandEngine(company as CompanyRecord);
    const brandCategories = getImageStyleCategories(brand);

    // Resolve image style
    if (typeof rawStyle === "string" && brandCategories.some((c) => c.id === rawStyle)) {
        styleId = rawStyle;
    } else if (brandCategories.length > 1) {
        try {
            const styleDescriptions = brandCategories
                .map((s, i) =>
                    `${i + 1}. **${s.label}** (id: ${s.id})\n   Narrative: ${s.narrative || "N/A"}\n   Cues: ${(s.storytelling_cues || []).join(", ") || "N/A"}\n   Prompt style: ${s.image_prompt_style || "N/A"}`
                )
                .join("\n\n");

            const recSystem = `You are an expert creative director. Given an article topic and a list of available image styles, recommend the single best-fit style. Be concise and practical.\n\nRespond with ONLY valid JSON in this exact format:\n{"id": "<style id>", "reason": "<1 sentence explanation>"}`;
            const recUser = `Article topic: "${rawCreationPrompt.trim()}"\n\nAvailable image styles:\n\n${styleDescriptions}\n\nWhich style best fits this article? Respond with JSON only.`;
            const recRaw = await getTextResponse("gpt-4.1-mini", recSystem, recUser, { temperature: 0.2 });
            const recJson = recRaw.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "");
            const recResult = JSON.parse(recJson);
            if (recResult?.id && brandCategories.some((c) => c.id === recResult.id)) {
                styleId = recResult.id;
                console.log(`[pipeline] Auto-recommended image style "${styleId}": ${recResult.reason || ""}`);
            }
        } catch (recErr) {
            console.warn("[pipeline] Image style auto-recommendation failed, using default:", recErr);
        }
    }

    // Fetch reference articles, snippet collection, and account prompt in parallel
    const [accountPromptResult, refArticlesResult, snippetResult] = await Promise.allSettled([
        // Account-level base prompt override
        accountId
            ? sb.from("accounts").select("base_system_prompt").eq("id", accountId).single()
                .then(({ data }) => data?.base_system_prompt as string | undefined)
            : Promise.resolve(undefined),
        // Reference articles
        (brand.reference_articles && brand.reference_articles.length > 0)
            ? compileReferenceArticles(brand.reference_articles)
            : Promise.resolve(null),
        // Snippet collection
        (typeof snippet_collection_id === "string" && snippet_collection_id)
            ? sb.from("snippet_collections").select("name, snippets").eq("id", snippet_collection_id).single()
                .then(({ data }) => data)
            : Promise.resolve(null),
    ]);

    let baseSystemPromptOverride: string | undefined;
    if (accountPromptResult.status === "fulfilled" && accountPromptResult.value) {
        baseSystemPromptOverride = accountPromptResult.value;
    }

    let system = compileBlogSystemPrompt(brand, { baseOverride: baseSystemPromptOverride });

    // Inject reference articles
    if (refArticlesResult.status === "fulfilled" && refArticlesResult.value) {
        system += refArticlesResult.value;
    }

    // Inject snippet collection context
    let creation_prompt = rawCreationPrompt.trim();
    const snippetData = snippetResult.status === "fulfilled" ? snippetResult.value : null;
    if (snippetData && Array.isArray(snippetData.snippets) && snippetData.snippets.length > 0) {
        let researchContext = `\n\n## Research Context\n`;
        researchContext += `This article should incorporate findings from the research collection "${snippetData.name}".\n\n`;
        researchContext += `### Research Snippets\n`;
        for (const snippet of snippetData.snippets) {
            researchContext += `- ${snippet.text}`;
            if (snippet.note) researchContext += ` (Note: ${snippet.note})`;
            if (snippet.source_title) researchContext += ` [Source: ${snippet.source_title}]`;
            researchContext += `\n`;
        }
        researchContext += `\nUse these research snippets as factual grounding. Cite specific data points and weave them naturally into the article.\n`;
        creation_prompt = `${creation_prompt}\n${researchContext}`;
        console.log(`[pipeline] Injected ${snippetData.snippets.length} snippets from collection "${snippetData.name}"`);
    }

    const user = compileUserPrompt({
        creation_prompt,
        brand,
        word_count: typeof word_count === "string" && word_count ? word_count : undefined,
    });

    // ── Step 1: Generate blog content ───────────────────────────────
    console.log(`[pipeline] Generating blog for article ${articleId}...`);
    const blog = await getStructuredResponse<BlogOutput>(
        selectedModel,
        system,
        user,
        BlogSchema,
        { schemaName: "blog_post" }
    );

    const slug = blog.seo.slug
        ? slugify(blog.seo.slug, { lower: true, strict: true, trim: true })
        : slugify(blog.title, { lower: true, strict: true, trim: true });

    const seoWithAeo = {
        ...blog.seo,
        faq: blog.faq,
        key_takeaways: blog.key_takeaways,
        content_type: blog.content_type,
    };

    const jsonld = buildAllJsonLd({
        article: { title: blog.title, slug, excerpt: blog.excerpt, html: blog.html, keywords: blog.seo.keywords },
        faq: blog.faq,
        content_type: blog.content_type,
        how_to_steps: blog.how_to_steps,
    });

    // Save raw blog content immediately — also set status to "ready" now that we have real content
    await sb.from("articles").update({
        title: blog.title,
        slug,
        excerpt: blog.excerpt,
        html: blog.html,
        seo: seoWithAeo,
        outline: blog.outline,
        model_used: selectedModel,
        image_style: styleId,
        status: "ready",
    }).eq("id", articleId);
    console.log(`[pipeline] Blog content saved for ${articleId}`);

    // ── Steps 2 & 3: Humanize + Image (in parallel) ────────────────
    // Image generation only needs the raw blog title/excerpt, so we can
    // run it concurrently with humanization to stay within Vercel's
    // maxDuration limit.
    let currentTitle = blog.title;
    let currentExcerpt = blog.excerpt;
    let currentHtml = blog.html;
    const shouldHumanize = (brand as any).auto_humanize !== false;

    // Build image generation promise
    const imagePromise = (async () => {
        // Pre-check for existing image
        const { data: existingArticle } = await sb.from("articles").select("image_base64").eq("id", articleId).single();
        if (existingArticle?.image_base64) {
            console.log(`[pipeline] Article ${articleId} already has an image — skipping image generation`);
            return;
        }

        const resolvedStyle = brandCategories.find((c) => c.id === styleId);
        const isCompositeStyle = resolvedStyle?.type === "composite";
        const hasCompositeProduct = composite_product_image_url && typeof composite_product_image_url === "string";
        let finalImagePrompt = "";
        let image_base64: string | null = null;

        if (isCompositeStyle && hasCompositeProduct) {
            console.log(`[pipeline] Composite image for ${articleId}...`);
            const photo = brand.photography_style;
            let brandDirective = resolvedStyle?.image_prompt_style
                ? `Visual style: ${resolvedStyle.image_prompt_style}\n` : "";
            brandDirective += [`Lighting: ${photo.lighting}`, `Mood: ${photo.mood}`, `Feel: ${photo.global_feel.join(", ")}`].join(". ") + ".";
            const bgPrompt = (typeof compositeOverrideBgPrompt === "string" && compositeOverrideBgPrompt.trim())
                ? compositeOverrideBgPrompt.trim() : resolvedStyle?.composite_bg_prompt || undefined;
            const bgImageUrl = (typeof composite_bg_image_url === "string" && composite_bg_image_url.trim())
                ? composite_bg_image_url.trim() : resolvedStyle?.composite_bg_image_url || undefined;
            const compositeResult = await generateCompositeImage({
                productImageUrl: composite_product_image_url,
                backgroundImageUrl: bgImageUrl, backgroundPrompt: bgPrompt,
                articleTitle: blog.title, articleExcerpt: blog.excerpt, brandStyleDirective: brandDirective,
            });
            image_base64 = compositeResult.image_base64;
            finalImagePrompt = `Composite: ${compositeResult.background_prompt}`;
        } else {
            console.log(`[pipeline] Generating image for ${articleId}...`);
            const imgSystem = compileImageSystemPrompt(brand);
            const imgUser = compileImageUserPrompt({ title: blog.title, excerpt: blog.excerpt, brand, styleId });
            finalImagePrompt = await getTextResponse("gpt-4.1-mini", imgSystem, imgUser);
            image_base64 = await generateImageBase64(finalImagePrompt || `Editorial photo for: ${blog.title}`);
        }

        await sb.from("articles").update({ image_base64, image_prompt: finalImagePrompt }).eq("id", articleId);
        console.log(`[pipeline] Image saved for ${articleId}`);
    })().catch((imgErr) => {
        console.error(`[pipeline] Image generation failed for ${articleId}:`, imgErr);
    });

    // Build humanization promise
    const humanizePromise = (async () => {
        if (!shouldHumanize) return;
        try {
            console.log(`[pipeline] Humanizing article ${articleId}...`);
            const bodyPrompt = buildBlogHumanizePrompt(currentHtml, currentTitle, brand);
            const humanizedHtml = await getTextResponse("gpt-5.4", "", bodyPrompt, { temperature: 0.5 });
            if (humanizedHtml && humanizedHtml.length > 100) {
                currentHtml = humanizedHtml;
            }

            const [humanizedTitle, humanizedExcerpt] = await Promise.all([
                getTextResponse("gpt-5.4", "", buildShortContentHumanizePrompt(
                    currentTitle, "This is a blog post title. Keep it concise, specific, and punchy. Do not use generic framing.", brand
                ), { temperature: 0.5 }),
                getTextResponse("gpt-5.4", "", buildShortContentHumanizePrompt(
                    currentExcerpt, "This is a blog post excerpt/summary. Keep it to 1-2 sentences, factual and direct. No generic framing.", brand
                ), { temperature: 0.5 }),
            ]);
            if (humanizedTitle && humanizedTitle.length > 5) currentTitle = humanizedTitle;
            if (humanizedExcerpt && humanizedExcerpt.length > 10) currentExcerpt = humanizedExcerpt;

            await sb.from("articles").update({
                title: currentTitle, excerpt: currentExcerpt, html: currentHtml, humanized: true,
            }).eq("id", articleId);
            console.log(`[pipeline] Humanization saved for ${articleId}`);
        } catch (humErr) {
            console.error(`[pipeline] Humanization failed for ${articleId}:`, humErr);
        }
    })();

    // Wait for both to complete
    await Promise.allSettled([humanizePromise, imagePromise]);

    // ── Step 4: Embedding ───────────────────────────────────────────
    try {
        const embText = buildArticleEmbeddingText(currentTitle, currentHtml);
        const embedding = await generateEmbedding(embText);
        const vectorStr = formatVectorForSupabase(embedding);
        await sb.from("articles").update({ embedding: vectorStr }).eq("id", articleId);
        console.log(`[pipeline] Embedding saved for ${articleId}`);
    } catch (embErr) {
        console.warn(`[pipeline] Embedding failed for ${articleId}:`, embErr);
    }
}