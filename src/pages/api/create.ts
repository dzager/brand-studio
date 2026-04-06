import type { NextApiRequest, NextApiResponse } from "next";
import slugify from "slugify";
import { getSupabase } from "@/lib/supabase";
import { buildBrandEngine, type CompanyRecord } from "@/lib/buildBrandEngine";
import { buildAllJsonLd } from "@/lib/jsonld";
import { compileReferenceArticles } from "@/lib/referenceArticles";
import { compileUserPrompt } from "@/lib/compileUserPrompt";
import { compileImageSystemPrompt, compileImageUserPrompt } from "@/lib/compileImagePrompt";
import {
    compileBlogSystemPrompt,
    getImageStyleCategories,
} from "@/brand/engine";
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
    res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
    try {
        assertEnv();

        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed. Use POST." });
        }

        const { creation_prompt, image_style, model: requestedModel, word_count, company_id } = req.body ?? {};

        if (
            typeof creation_prompt !== "string" ||
            creation_prompt.trim().length < 5
        ) {
            return res.status(400).json({ error: "creation_prompt required" });
        }

        if (typeof company_id !== "string" || !company_id) {
            return res.status(400).json({ error: "company_id is required" });
        }

        // Validate and resolve style AFTER we know the brand
        // (will be re-validated below after brand engine is built)
        let styleId = "default";
        const rawStyle = image_style;

        const selectedModel = resolveModelId(requestedModel);

        // Build brand engine from the selected company
        const { data: companyData, error: companyErr } = await getSupabase()
            .from("companies")
            .select("*")
            .eq("id", company_id)
            .single();

        if (companyErr || !companyData) {
            return res.status(400).json({ error: "Company not found" });
        }

        const brand = buildBrandEngine(companyData as CompanyRecord);

        // Resolve the style against the brand's available categories
        const brandCategories = getImageStyleCategories(brand);
        if (
            typeof rawStyle === "string" &&
            brandCategories.some((c) => c.id === rawStyle)
        ) {
            styleId = rawStyle;
        }

        let system = compileBlogSystemPrompt(brand);

        // Fetch and inject reference articles if the company has any
        if (brand.reference_articles && brand.reference_articles.length > 0) {
            const refSection = await compileReferenceArticles(brand.reference_articles);
            if (refSection) {
                system += refSection;
            }
        }

        const user = compileUserPrompt({
            creation_prompt: creation_prompt.trim(),
            brand,
            word_count: typeof word_count === "string" && word_count ? word_count : undefined,
        });

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

        // ── Step 1b: Auto-humanize if enabled ─────────────────────────
        const shouldHumanize = (brand as any).auto_humanize !== false;

        if (shouldHumanize) {
            console.log("Auto-humanizing article content...");

            // Humanize body HTML
            const bodyPrompt = buildBlogHumanizePrompt(blog.html, blog.title, brand);
            const humanizedHtml = await getTextResponse("gpt-4.1", "", bodyPrompt, { temperature: 0.5 });
            if (humanizedHtml && humanizedHtml.length > 100) {
                blog.html = humanizedHtml;
            }

            // Humanize title
            const titlePrompt = buildShortContentHumanizePrompt(
                blog.title,
                "This is a blog post title. Keep it concise, specific, and punchy. Do not use generic framing.",
                brand
            );
            const humanizedTitle = await getTextResponse("gpt-4.1", "", titlePrompt, { temperature: 0.5 });
            if (humanizedTitle && humanizedTitle.length > 5) {
                blog.title = humanizedTitle;
            }

            // Humanize excerpt
            const excerptPrompt = buildShortContentHumanizePrompt(
                blog.excerpt,
                "This is a blog post excerpt/summary. Keep it to 1-2 sentences, factual and direct. No generic framing.",
                brand
            );
            const humanizedExcerpt = await getTextResponse("gpt-4.1", "", excerptPrompt, { temperature: 0.5 });
            if (humanizedExcerpt && humanizedExcerpt.length > 10) {
                blog.excerpt = humanizedExcerpt;
            }
        }

        // ── Step 2: Generate image prompt (separate LLM call) ──────────
        const imgSystem = compileImageSystemPrompt(brand);
        const imgUser = compileImageUserPrompt({
            title: blog.title,
            excerpt: blog.excerpt,
            brand,
            styleId,
        });

        const finalImagePrompt = await getTextResponse("gpt-4.1-nano", imgSystem, imgUser);

        const image_base64 = await generateImageBase64(
            finalImagePrompt || `Editorial photo for: ${blog.title}`
        );

        // Auto-save to Supabase — include AEO data in the seo column
        const seoWithAeo = {
            ...blog.seo,
            faq: blog.faq,
            key_takeaways: blog.key_takeaways,
            content_type: blog.content_type,
        };

        try {
            const { data: savedArticle } = await getSupabase().from("articles").insert({
                title: blog.title,
                slug,
                excerpt: blog.excerpt,
                html: blog.html,
                image_base64,
                image_prompt: finalImagePrompt,
                seo: seoWithAeo,
                outline: blog.outline,
                model_used: selectedModel,
                image_style: styleId,
                company_id: company_id || null,
            }).select("id").single();

            // Generate and persist embedding (non-blocking on failure)
            if (savedArticle?.id) {
                try {
                    const embText = buildArticleEmbeddingText(blog.title, blog.html);
                    const embedding = await generateEmbedding(embText);
                    const vectorStr = formatVectorForSupabase(embedding);
                    await getSupabase()
                        .from("articles")
                        .update({ embedding: vectorStr })
                        .eq("id", savedArticle.id);
                } catch (embErr) {
                    console.warn("Failed to generate/save article embedding:", embErr);
                }
            }
        } catch (saveErr) {
            console.error("Failed to save article to Supabase:", saveErr);
            // Don't block the response if save fails
        }

        // Generate JSON-LD structured data
        const jsonld = buildAllJsonLd({
            article: {
                title: blog.title,
                slug,
                excerpt: blog.excerpt,
                html: blog.html,
                keywords: blog.seo.keywords,
            },
            faq: blog.faq,
            content_type: blog.content_type,
            how_to_steps: blog.how_to_steps,
        });

        return res.status(200).json({
            title: blog.title,
            slug,
            excerpt: blog.excerpt,
            outline: blog.outline,
            html: blog.html,
            seo: blog.seo,
            image_prompt: finalImagePrompt,
            image_base64,
            faq: blog.faq,
            key_takeaways: blog.key_takeaways,
            how_to_steps: blog.how_to_steps,
            content_type: blog.content_type,
            jsonld,
        });
    } catch (err) {
        console.error("API /api/create error:", err);

        const message =
            err instanceof Error ? err.message : "Unknown server error";

        return res.status(500).json({ error: message });
    }
}