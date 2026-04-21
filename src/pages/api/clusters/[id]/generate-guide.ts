// src/pages/api/clusters/[id]/generate-guide.ts
// POST: Generate a comprehensive pillar "Guide" article from all supporting articles in the cluster.
// The guide summarizes each supporting article and includes hyperlinks to them.

import type { NextApiRequest, NextApiResponse } from "next";
import slugify from "slugify";
import { getSupabase } from "@/lib/supabase";
import { buildBrandEngine, type CompanyRecord } from "@/lib/buildBrandEngine";
import { compileBlogSystemPrompt, getImageStyleCategories } from "@/brand/engine";
import { compileImageSystemPrompt, compileImageUserPrompt } from "@/lib/compileImagePrompt";
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

type SupportingArticle = {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    html: string | null;
    cluster_role: string | null;
    seo: Record<string, unknown> | null;
};

const GuideSchema = {
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
            maxItems: 15,
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
            minItems: 3,
            maxItems: 7,
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

function stripHtmlToText(html: string): string {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function buildGuidePrompt(
    clusterName: string,
    pillarTopic: string,
    articles: SupportingArticle[],
    baseUrl: string
): string {
    const articleSummaries = articles.map((a, i) => {
        const text = a.html ? stripHtmlToText(a.html).slice(0, 800) : a.excerpt || "";
        const keyword = (a.seo as any)?.primary_keyword || a.title;
        const link = `${baseUrl}/${a.slug}`;
        return `${i + 1}. "${a.title}" (${a.cluster_role || "supporting"})
   URL: ${link}
   Keyword: "${keyword}"
   Summary: ${text}${text.length >= 800 ? "…" : ""}`;
    }).join("\n\n");

    return `Create a comprehensive pillar "Guide" article for the topical cluster: "${clusterName}"
Topic: ${pillarTopic}

This is a PILLAR GUIDE — a definitive, authoritative overview that ties together all the supporting articles in this cluster. It should be THE go-to resource on this topic.

## Supporting Articles in This Cluster

${articleSummaries}

## CRITICAL REQUIREMENTS

1. **Structure**: Create a well-organized guide with a clear introduction, multiple H2/H3 sections covering the key aspects of the topic, and a conclusion.

2. **Hyperlinks to Supporting Articles (MANDATORY)**: 
   - For EACH supporting article listed above, include at least ONE contextual hyperlink using an <a> tag.
   - Use descriptive anchor text that matches the article\'s keyword or topic — NOT generic text like "click here" or "read more".
   - Integrate the links NATURALLY within the guide\'s content where they provide value to the reader.
   - Format: <a href="/SLUG">descriptive anchor text</a>
   - Example: For an article about "best running shoes", write something like: "Choosing the right footwear is critical — our guide to <a href="/best-running-shoes-2025">the best running shoes for every terrain</a> breaks down the top options."

3. **Content**: 
   - Synthesize the key insights from all supporting articles into a cohesive narrative.
   - Cover each sub-topic at a high level, explaining enough to be useful while directing readers to the detailed articles for deeper dives.
   - Add strategic value — draw connections between topics, provide an overarching framework, and offer guidance on how to use the information.
   - Target 2,000–3,500 words.
   
4. **SEO**: 
   - Optimize for the cluster\'s primary topic with a broad, high-value keyword.
   - Use secondary keywords naturally throughout the content.
   - The slug should be a concise, authoritative slug like "complete-guide-to-{topic}".

5. **Tone**: Authoritative but accessible. This is the definitive guide — it should feel comprehensive and trustworthy.

6. **HTML Output**: Use semantic HTML with h2, h3, p, ul/ol, strong, em, and a tags. Do NOT include the title in the HTML body.`;
}

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
        const { model: requestedModel, image_style: rawStyle, base_url } = req.body ?? {};

        // Load cluster
        const { data: cluster, error: clusterErr } = await supabase
            .from("clusters")
            .select("*")
            .eq("id", clusterId)
            .single();

        if (clusterErr || !cluster) {
            return res.status(404).json({ error: "Cluster not found" });
        }

        // Load all supporting articles in this cluster (exclude existing pillar)
        const { data: articles, error: articlesErr } = await supabase
            .from("articles")
            .select("id, title, slug, excerpt, html, cluster_role, seo")
            .eq("cluster_id", clusterId)
            .order("cluster_role", { ascending: true });

        if (articlesErr) throw articlesErr;

        const supportingArticles = (articles ?? []).filter(
            (a: any) => a.cluster_role === "supporting" || a.cluster_role === "long_tail"
        ) as SupportingArticle[];

        if (supportingArticles.length === 0) {
            return res.status(400).json({
                error: "No supporting articles found in this cluster. Generate supporting articles first.",
            });
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
        const selectedModel = resolveModelId(requestedModel);

        // Build system prompt
        const system = compileBlogSystemPrompt(brand);

        // Build user prompt with all article context
        const guideBaseUrl = typeof base_url === "string" ? base_url : "";
        const userPrompt = buildGuidePrompt(
            cluster.name,
            cluster.pillar_topic || cluster.name,
            supportingArticles,
            guideBaseUrl
        );

        // Generate guide article
        const guide = await getStructuredResponse<any>(
            selectedModel,
            system,
            userPrompt,
            GuideSchema as any,
            { schemaName: "pillar_guide" }
        );

        const slug = guide.seo.slug
            ? slugify(guide.seo.slug, { lower: true, strict: true, trim: true })
            : slugify(`complete-guide-${cluster.name}`, { lower: true, strict: true, trim: true });

        // Auto-humanize if enabled
        const shouldHumanize = (brand as any).auto_humanize !== false;

        if (shouldHumanize) {
            console.log("Auto-humanizing pillar guide...");

            const bodyPrompt = buildBlogHumanizePrompt(guide.html, guide.title, brand);
            const humanizedHtml = await getTextResponse("gpt-5.4", "", bodyPrompt, { temperature: 0.5 });
            if (humanizedHtml && humanizedHtml.length > 100) {
                guide.html = humanizedHtml;
            }

            const titlePrompt = buildShortContentHumanizePrompt(
                guide.title,
                "This is a comprehensive guide title. Keep it authoritative, specific, and compelling.",
                brand
            );
            const humanizedTitle = await getTextResponse("gpt-5.4", "", titlePrompt, { temperature: 0.5 });
            if (humanizedTitle && humanizedTitle.length > 5) {
                guide.title = humanizedTitle;
            }

            const excerptPrompt = buildShortContentHumanizePrompt(
                guide.excerpt,
                "This is a pillar guide excerpt. Keep it to 1-2 sentences, authoritative and comprehensive.",
                brand
            );
            const humanizedExcerpt = await getTextResponse("gpt-5.4", "", excerptPrompt, { temperature: 0.5 });
            if (humanizedExcerpt && humanizedExcerpt.length > 10) {
                guide.excerpt = humanizedExcerpt;
            }
        }

        // Resolve image style
        let styleId = "default";
        const brandCategories = getImageStyleCategories(brand);
        if (typeof rawStyle === "string" && brandCategories.some((c) => c.id === rawStyle)) {
            styleId = rawStyle;
        } else if (brandCategories.length > 1) {
            try {
                const styleDescriptions = brandCategories
                    .map(
                        (s, i) =>
                            `${i + 1}. **${s.label}** (id: ${s.id})\n   Narrative: ${s.narrative || "N/A"}\n   Prompt style: ${s.image_prompt_style || "N/A"}`
                    )
                    .join("\n\n");

                const recSystem = `You are an expert creative director. Given an article topic and a list of available image styles, recommend the single best-fit style.\nRespond with ONLY valid JSON: {"id": "<style id>", "reason": "<1 sentence>"}`;
                const recUser = `Article: "${guide.title}" — Comprehensive pillar guide for "${cluster.name}"\n\nAvailable styles:\n${styleDescriptions}`;

                const recRaw = await getTextResponse("gpt-4.1-mini", recSystem, recUser, { temperature: 0.2 });
                const recJson = recRaw.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "");
                const recResult = JSON.parse(recJson);
                if (recResult?.id && brandCategories.some((c) => c.id === recResult.id)) {
                    styleId = recResult.id;
                }
            } catch {
                // Non-blocking
            }
        }

        // Generate image
        const imgSystem = compileImageSystemPrompt(brand);
        const imgUser = compileImageUserPrompt({
            title: guide.title,
            excerpt: guide.excerpt,
            brand,
            styleId,
        });

        const finalImagePrompt = await getTextResponse("gpt-4.1-mini", imgSystem, imgUser);
        const image_base64 = await generateImageBase64(
            finalImagePrompt || `Comprehensive guide editorial photo: ${guide.title}`
        );

        // Save the guide article with pillar role
        const seoWithAeo = {
            ...guide.seo,
            faq: guide.faq,
            key_takeaways: guide.key_takeaways,
            content_type: guide.content_type,
        };

        let savedArticleId: string | null = null;

        try {
            // Demote any existing pillar in this cluster
            await supabase
                .from("articles")
                .update({ cluster_role: "supporting" })
                .eq("cluster_id", clusterId)
                .eq("cluster_role", "pillar");

            const { data: savedArticle } = await supabase.from("articles").insert({
                title: guide.title,
                slug,
                excerpt: guide.excerpt,
                html: guide.html,
                image_base64,
                image_prompt: finalImagePrompt,
                seo: seoWithAeo,
                outline: guide.outline,
                model_used: selectedModel,
                image_style: styleId,
                company_id: cluster.company_id,
                cluster_id: clusterId,
                cluster_role: "pillar",
            }).select("id").single();

            savedArticleId = savedArticle?.id ?? null;

            // Generate embedding
            if (savedArticleId) {
                try {
                    const embText = buildArticleEmbeddingText(guide.title, guide.html);
                    const embedding = await generateEmbedding(embText);
                    const vectorStr = formatVectorForSupabase(embedding);
                    await supabase
                        .from("articles")
                        .update({ embedding: vectorStr })
                        .eq("id", savedArticleId);
                } catch (embErr) {
                    console.warn("Failed to generate guide embedding:", embErr);
                }
            }
        } catch (saveErr) {
            console.error("Failed to save guide article:", saveErr);
        }

        return res.status(200).json({
            id: savedArticleId,
            title: guide.title,
            slug,
            excerpt: guide.excerpt,
            outline: guide.outline,
            html: guide.html,
            seo: guide.seo,
            image_prompt: finalImagePrompt,
            image_base64,
            faq: guide.faq,
            key_takeaways: guide.key_takeaways,
            content_type: guide.content_type,
            cluster_id: clusterId,
            cluster_role: "pillar",
            supporting_articles_count: supportingArticles.length,
        });
    } catch (err) {
        console.error(`API /api/clusters/${clusterId}/generate-guide error:`, err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
