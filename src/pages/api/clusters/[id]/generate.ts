// src/pages/api/clusters/[id]/generate.ts
// POST: Generate a single article from a cluster strategy page.
// Injects cluster context (internal links, keyword coordination) into the prompt.
import type { NextApiRequest, NextApiResponse } from "next";
import { waitUntil } from "@vercel/functions";

export const config = {
    api: { responseLimit: false },
    maxDuration: 300,
};

import slugify from "slugify";
import { getSupabase } from "@/lib/supabase";
import { incrementArticleCount } from "@/lib/usage";
import { buildBrandEngine, type CompanyRecord } from "@/lib/buildBrandEngine";
import { buildAllJsonLd } from "@/lib/jsonld";
import { compileReferenceArticles } from "@/lib/referenceArticles";
import { compileUserPrompt } from "@/lib/compileUserPrompt";
import { compileImageSystemPrompt, compileImageUserPrompt } from "@/lib/compileImagePrompt";
import { compileBlogSystemPrompt, getImageStyleCategories } from "@/brand/engine";
import {
    buildBlogHumanizePrompt,
    buildShortContentHumanizePrompt,
} from "@/brand/humanizer";
import {
    compileClusterContext,
    type ClusterStrategy,
    type ClusterPage,
    type SiblingArticle,
} from "@/lib/compileClusterPrompt";
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
            maxItems: 5,
        },
        key_takeaways: {
            type: "array",
            items: { type: "string" },
            minItems: 3,
            maxItems: 5,
        },
        how_to_steps: {
            type: "array",
            items: { type: "string" },
        },
        content_type: {
            type: "string",
            enum: ["article", "how_to", "comparison", "listicle"],
        },
    },
} as const;

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    const supabase = getSupabase();
    const { id: clusterId } = req.query;

    if (typeof clusterId !== "string") {
        return res.status(400).json({ error: "Invalid cluster id" });
    }

    try {
        const {
            page_type,
            page_index,
            model: requestedModel,
            image_style: rawStyle,
            image_mode,
        } = req.body ?? {};

        if (!page_type || typeof page_index !== "number") {
            return res.status(400).json({ error: "page_type and page_index required" });
        }

        // Load cluster
        const { data: cluster, error: clusterErr } = await supabase
            .from("clusters")
            .select("*")
            .eq("id", clusterId)
            .single();

        if (clusterErr || !cluster) {
            return res.status(404).json({ error: "Cluster not found" });
        }

        const strategy = cluster.strategy as ClusterStrategy;

        // Resolve the page from the strategy
        let page: ClusterPage | null = null;
        let role: "pillar" | "supporting" | "long_tail" = "supporting";

        if (page_type === "pillar") {
            page = strategy.pillar;
            role = "pillar";
        } else if (page_type === "supporting" && strategy.supporting[page_index]) {
            page = strategy.supporting[page_index];
            role = "supporting";
        } else if (page_type === "long_tail" && strategy.long_tail[page_index]) {
            page = strategy.long_tail[page_index];
            role = "long_tail";
        }

        if (!page) {
            return res.status(400).json({ error: "Invalid page_type or page_index" });
        }

        // Load company & build brand engine
        const { data: companyData, error: companyErr } = await supabase
            .from("companies")
            .select("*")
            .eq("id", cluster.company_id)
            .single();

        if (companyErr || !companyData) {
            return res.status(400).json({ error: "Company not found" });
        }

        const brand = buildBrandEngine(companyData as CompanyRecord);

        // Load existing sibling articles in this cluster
        const { data: siblings } = await supabase
            .from("articles")
            .select("title, slug, cluster_role, seo")
            .eq("cluster_id", clusterId);

        const existingSiblings: SiblingArticle[] = (siblings ?? []).map((s: any) => ({
            title: s.title,
            slug: s.slug,
            keyword: s.seo?.primary_keyword ?? s.title,
            role: s.cluster_role ?? "supporting",
        }));

        // Collect all pages for keyword coordination
        const allPages: ClusterPage[] = [
            strategy.pillar,
            ...strategy.supporting,
            ...strategy.long_tail,
        ];

        // Build cluster context
        const clusterCtx = compileClusterContext({
            cluster_name: cluster.name,
            role,
            page,
            pillar: strategy.pillar,
            all_pages: allPages,
            existing_siblings: existingSiblings,
        });

        const selectedModel = resolveModelId(requestedModel);

        // Resolve image style — auto-recommend if not explicitly provided
        let styleId = "default";
        const brandCategories = getImageStyleCategories(brand);
        if (typeof rawStyle === "string" && brandCategories.some((c) => c.id === rawStyle)) {
            styleId = rawStyle;
        } else if (brandCategories.length > 1) {
            // Auto-recommend style based on page content
            try {
                const styleDescriptions = brandCategories
                    .map(
                        (s, i) =>
                            `${i + 1}. **${s.label}** (id: ${s.id})\n   Narrative: ${s.narrative || "N/A"}\n   Cues: ${(s.storytelling_cues || []).join(", ") || "N/A"}\n   Prompt style: ${s.image_prompt_style || "N/A"}`
                    )
                    .join("\n\n");

                const recSystem = `You are an expert creative director. Given an article topic and a list of available image styles, recommend the single best-fit style. Be concise and practical.

Respond with ONLY valid JSON in this exact format:
{"id": "<style id>", "reason": "<1 sentence explanation>"}`;

                const recUser = `Article: "${page.title}" — ${page.description}\nKeyword: ${page.keyword}\nPage type: ${role}

Available image styles:

${styleDescriptions}

Which style best fits this article? Respond with JSON only.`;

                const recRaw = await getTextResponse("gpt-4.1-mini", recSystem, recUser, { temperature: 0.2 });
                const recJson = recRaw.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "");
                const recResult = JSON.parse(recJson);

                if (recResult?.id && brandCategories.some((c) => c.id === recResult.id)) {
                    styleId = recResult.id;
                    console.log(`Auto-recommended image style "${styleId}" for page "${page.slug}": ${recResult.reason || ""}`);
                }
            } catch (recErr) {
                console.warn("Image style auto-recommendation failed (non-blocking), using default:", recErr);
            }
        }

        // Build system prompt
        let system = compileBlogSystemPrompt(brand);

        // Inject reference articles
        if (brand.reference_articles && brand.reference_articles.length > 0) {
            const refSection = await compileReferenceArticles(brand.reference_articles);
            if (refSection) system += refSection;
        }

        // Build user prompt with cluster context
        const userBase = compileUserPrompt({
            creation_prompt: page.description,
            brand,
            word_count: page.word_count,
            cluster_context: clusterCtx,
        });

        // ── Create placeholder article & respond immediately ────────────
        const placeholderSlug = page.slug
            ? slugify(page.slug, { lower: true, strict: true, trim: true })
            : slugify(page.title, { lower: true, strict: true, trim: true });

        let savedArticleId: string | null = null;
        try {
            const { data: savedArticle } = await supabase.from("articles").insert({
                title: page.title || "Generating…",
                slug: placeholderSlug,
                excerpt: "Generating article…",
                html: "<p>Article is being generated. This page will update automatically when ready.</p>",
                image_base64: null,
                image_prompt: null,
                seo: {},
                outline: [],
                model_used: selectedModel,
                image_style: styleId,
                company_id: cluster.company_id,
                account_id: (companyData as any).account_id || null,
                cluster_id: clusterId,
                cluster_role: role,
                status: "generating",
            }).select("id").single();
            savedArticleId = savedArticle?.id ?? null;
        } catch (saveErr) {
            console.error("Failed to create placeholder cluster article:", saveErr);
            return res.status(500).json({ error: "Failed to create article record" });
        }

        // Increment usage counter immediately
        const accountId = (companyData as any).account_id;
        if (accountId) {
            try { await incrementArticleCount(accountId); }
            catch (usageErr) { console.warn("Failed to increment usage counter:", usageErr); }
        }

        // Respond immediately
        res.status(200).json({
            id: savedArticleId,
            title: page.title,
            slug: placeholderSlug,
            status: "generating",
            cluster_id: clusterId,
            cluster_role: role,
        });

        // ── Register pipeline with Vercel runtime ────────────────────────
        // waitUntil() tells Vercel to keep the serverless function alive
        // until the pipeline promise resolves, even after the response is sent.
        waitUntil(
            runClusterPipeline({
                articleId: savedArticleId!,
                clusterId,
                page,
                role,
                brand,
                brandCategories,
                styleId,
                selectedModel,
                system,
                userBase,
                image_mode,
                strategy,
                existingSiblings,
                companyData,
            })
                .then(async () => {
                    console.log(`[cluster-gen] Pipeline completed for ${savedArticleId}`);
                    try {
                        await supabase.from("articles").update({
                            status: "ready",
                        }).eq("id", savedArticleId);
                    } catch { /* best-effort */ }
                })
                .catch(async (pipelineErr) => {
                    console.error(`[cluster-gen] Pipeline failed for ${savedArticleId}:`, pipelineErr);
                    if (savedArticleId) {
                        try {
                            await supabase.from("articles").update({
                                status: "failed",
                                html: `<p>Article generation failed: ${pipelineErr instanceof Error ? pipelineErr.message : "Unknown error"}. Please try again.</p>`,
                                excerpt: "Generation failed — please regenerate.",
                            }).eq("id", savedArticleId);
                        } catch { /* best-effort */ }
                    }
                })
        );
    } catch (err) {
        console.error(`API /api/clusters/${req.query.id}/generate error:`, err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}

/**
 * Full cluster article pipeline — runs in background after HTTP response.
 */
async function runClusterPipeline({
    articleId, clusterId, page, role, brand, brandCategories, styleId,
    selectedModel, system, userBase, image_mode, strategy, existingSiblings, companyData,
}: {
    articleId: string;
    clusterId: string;
    page: ClusterPage;
    role: string;
    brand: ReturnType<typeof buildBrandEngine>;
    brandCategories: ReturnType<typeof getImageStyleCategories>;
    styleId: string;
    selectedModel: string;
    system: string;
    userBase: string;
    image_mode?: string;
    strategy: ClusterStrategy;
    existingSiblings: SiblingArticle[];
    companyData: any;
}) {
    const sb = getSupabase();

    // ── Step 1: Generate blog ───────────────────────────────────────
    console.log(`[cluster-pipeline] Generating blog for ${articleId} (${page.slug})...`);
    const blog = await getStructuredResponse<any>(
        selectedModel, system, userBase, BlogSchema as any, { schemaName: "blog_post" }
    );

    const slug = page.slug
        ? slugify(page.slug, { lower: true, strict: true, trim: true })
        : slugify(blog.title, { lower: true, strict: true, trim: true });

    const seoWithAeo = {
        ...blog.seo,
        faq: blog.faq,
        key_takeaways: blog.key_takeaways,
        content_type: blog.content_type,
    };

    // Save raw blog content
    await sb.from("articles").update({
        title: blog.title, slug, excerpt: blog.excerpt, html: blog.html,
        seo: seoWithAeo, outline: blog.outline, model_used: selectedModel, image_style: styleId,
    }).eq("id", articleId);
    console.log(`[cluster-pipeline] Blog saved for ${articleId}`);

    // ── Step 2: Humanize ────────────────────────────────────────────
    let currentTitle = blog.title;
    let currentExcerpt = blog.excerpt;
    let currentHtml = blog.html;
    const shouldHumanize = (brand as any).auto_humanize !== false;

    if (shouldHumanize) {
        try {
            console.log(`[cluster-pipeline] Humanizing ${articleId}...`);
            const bodyPrompt = buildBlogHumanizePrompt(currentHtml, currentTitle, brand);
            const humanizedHtml = await getTextResponse("gpt-5.4", "", bodyPrompt, { temperature: 0.5 });
            if (humanizedHtml && humanizedHtml.length > 100) currentHtml = humanizedHtml;

            const [humanizedTitle, humanizedExcerpt] = await Promise.all([
                getTextResponse("gpt-5.4", "", buildShortContentHumanizePrompt(
                    currentTitle, "This is a blog post title. Keep it concise, specific, and punchy.", brand
                ), { temperature: 0.5 }),
                getTextResponse("gpt-5.4", "", buildShortContentHumanizePrompt(
                    currentExcerpt, "This is a blog post excerpt. Keep it to 1-2 sentences, factual and direct.", brand
                ), { temperature: 0.5 }),
            ]);
            if (humanizedTitle && humanizedTitle.length > 5) currentTitle = humanizedTitle;
            if (humanizedExcerpt && humanizedExcerpt.length > 10) currentExcerpt = humanizedExcerpt;

            await sb.from("articles").update({
                title: currentTitle, excerpt: currentExcerpt, html: currentHtml, humanized: true,
            }).eq("id", articleId);
            console.log(`[cluster-pipeline] Humanization saved for ${articleId}`);
        } catch (humErr) {
            console.error(`[cluster-pipeline] Humanization failed for ${articleId}:`, humErr);
        }
    }

    // ── Step 3: Image ───────────────────────────────────────────────
    // Skip if the article already has an uploaded/existing image
    const { data: existingRow } = await sb.from("articles").select("image_base64").eq("id", articleId).single();
    if (existingRow?.image_base64) {
        console.log(`[cluster-pipeline] Article ${articleId} already has an image — skipping image generation`);
    } else try {
        let finalImagePrompt = "";
        let image_base64: string | null = null;

        if (image_mode === "search") {
            try {
                const searchQuery = `${page.keyword} ${page.title}`.slice(0, 120);
                const serperKey = process.env.SERPER_API_KEY;
                if (!serperKey) throw new Error("Missing SERPER_API_KEY");
                const serperResp = await fetch("https://google.serper.dev/images", {
                    method: "POST",
                    headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
                    body: JSON.stringify({ q: searchQuery, num: 5 }),
                });
                if (!serperResp.ok) throw new Error(`Serper status ${serperResp.status}`);
                const serperData = await serperResp.json();
                const images = serperData.images ?? [];
                let selectedUrl: string | null = null;
                for (const img of images) {
                    if ((img.imageWidth ?? 0) >= 400 && (img.imageHeight ?? 0) >= 300 && img.imageUrl) {
                        selectedUrl = img.imageUrl; break;
                    }
                }
                if (!selectedUrl && images.length > 0) selectedUrl = images[0].imageUrl;
                if (selectedUrl) {
                    const imgResp = await fetch(selectedUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
                    if (imgResp.ok) {
                        image_base64 = Buffer.from(await imgResp.arrayBuffer()).toString("base64");
                        finalImagePrompt = `Image search: ${searchQuery} (source: ${selectedUrl})`;
                    }
                }
            } catch (searchErr) {
                console.warn(`[cluster-pipeline] Image search failed for "${page.slug}", falling back to AI:`, searchErr);
            }
        }

        if (!image_base64) {
            console.log(`[cluster-pipeline] Generating AI image for ${articleId}...`);
            const imgSystem = compileImageSystemPrompt(brand);
            const imgUser = compileImageUserPrompt({ title: currentTitle, excerpt: currentExcerpt, brand, styleId });
            finalImagePrompt = await getTextResponse("gpt-4.1-mini", imgSystem, imgUser);
            image_base64 = await generateImageBase64(finalImagePrompt || `Editorial photo for: ${currentTitle}`);
        }

        await sb.from("articles").update({ image_base64, image_prompt: finalImagePrompt }).eq("id", articleId);
        console.log(`[cluster-pipeline] Image saved for ${articleId}`);
    } catch (imgErr) {
        console.error(`[cluster-pipeline] Image failed for ${articleId}:`, imgErr);
    }

    // ── Step 4: Embedding ───────────────────────────────────────────
    try {
        const embText = buildArticleEmbeddingText(currentTitle, currentHtml);
        const embedding = await generateEmbedding(embText);
        const vectorStr = formatVectorForSupabase(embedding);
        await sb.from("articles").update({ embedding: vectorStr }).eq("id", articleId);
        console.log(`[cluster-pipeline] Embedding saved for ${articleId}`);
    } catch (embErr) {
        console.warn(`[cluster-pipeline] Embedding failed for ${articleId}:`, embErr);
    }

    // ── Step 5: Update cluster status ───────────────────────────────
    try {
        const totalPlanned = 1 + strategy.supporting.length + strategy.long_tail.length;
        const totalGenerated = existingSiblings.length + 1;
        if (totalGenerated >= totalPlanned) {
            await sb.from("clusters").update({ status: "complete", updated_at: new Date().toISOString() }).eq("id", clusterId);
        } else {
            const { data: clusterNow } = await sb.from("clusters").select("status").eq("id", clusterId).single();
            if (clusterNow?.status === "draft") {
                await sb.from("clusters").update({ status: "in_progress", updated_at: new Date().toISOString() }).eq("id", clusterId);
            }
        }
    } catch (statusErr) {
        console.warn(`[cluster-pipeline] Cluster status update failed:`, statusErr);
    }
}
