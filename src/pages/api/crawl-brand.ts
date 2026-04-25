import type { NextApiRequest, NextApiResponse } from "next";
import { crawlWebsite } from "@/lib/crawlWebsite";
import { getStructuredResponse } from "@/lib/ai-client";

// ── Response schema for AI brand extraction ──────────────────────────────

const CrawledBrandSchema = {
    type: "object",
    additionalProperties: false,
    required: [
        "name",
        "tagline",
        "mission",
        "archetype",
        "tone",
        "target_audiences",
        "photography_style",
        "color_primary",
        "color_secondary",
        "avoid_phrases",
        "editorial_guidelines",
        "image_style_categories",
        "confidence_notes",
    ],
    properties: {
        name: {
            type: "string",
            description: "The company or brand name.",
        },
        tagline: {
            type: "string",
            description: "A short tagline or slogan for the brand. Extract from meta description, hero text, or OG description. If none found, synthesize a concise one from the brand's positioning.",
        },
        mission: {
            type: "string",
            description: "The company's mission statement. Extract from About page content or synthesize from observed brand messaging. 1-3 sentences.",
        },
        archetype: {
            type: "string",
            enum: ["pathfinder", "innovator", "caregiver", "sage", "creator", "hero", "explorer", "rebel"],
            description: "The closest brand archetype based on the brand's tone, messaging, and positioning.",
        },
        tone: {
            type: "string",
            description: "Comma-separated tone descriptors derived from the writing style observed on the website. e.g. 'confident, clear, modern' or 'warm, professional, approachable'.",
        },
        target_audiences: {
            type: "string",
            description: "Comma-separated target audience segments inferred from the website content. e.g. 'homeowners, first-time buyers, real estate investors'.",
        },
        photography_style: {
            type: "string",
            description: "A description of the brand's visual/photography style based on image alt texts, page descriptions, and overall aesthetic. e.g. 'Clean, minimal product photography with natural lighting and neutral backgrounds'.",
        },
        color_primary: {
            type: "string",
            description: "The primary brand color as a hex code (e.g. '#1a1a1a'). Derived from theme-color meta, prominent CSS colors, or logo colors.",
        },
        color_secondary: {
            type: "string",
            description: "The secondary/accent brand color as a hex code (e.g. '#e5a00d'). Derived from CSS accent colors, CTA button colors, or link colors.",
        },
        avoid_phrases: {
            type: "string",
            description: "Comma-separated phrases the brand should avoid based on observed tone and positioning. Include common AI clichés and any language that doesn't fit the brand voice.",
        },
        editorial_guidelines: {
            type: "string",
            description: "Synthesized editorial guidelines based on the brand's observed writing style, tone, and content patterns. Include voice notes, formatting preferences, and content approach. 3-6 sentences.",
        },
        image_style_categories: {
            type: "array",
            description: "2-5 custom image style categories reverse-engineered from the website's visual language. Analyze the image alt texts, OG images, page imagery descriptions, and overall aesthetic to derive distinct visual content categories the brand uses.",
            minItems: 2,
            maxItems: 5,
            items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "label", "narrative", "storytelling_cues", "image_prompt_style"],
                properties: {
                    id: {
                        type: "string",
                        description: "A lowercase, underscore-separated identifier for this style. e.g. 'lifestyle_hero', 'product_detail', 'team_culture'.",
                    },
                    label: {
                        type: "string",
                        description: "A human-readable label for this style. e.g. 'Lifestyle Hero', 'Product Detail', 'Team & Culture'.",
                    },
                    narrative: {
                        type: "string",
                        description: "A 1-2 sentence description of what this image style communicates and when it's used. Based on observed image patterns on the site.",
                    },
                    storytelling_cues: {
                        type: "array",
                        items: { type: "string" },
                        minItems: 2,
                        maxItems: 6,
                        description: "Visual storytelling keywords that define this style. e.g. ['natural light', 'human warmth', 'candid moments', 'shallow depth of field'].",
                    },
                    image_prompt_style: {
                        type: "string",
                        description: "A detailed image generation prompt style directive. This should be a specific, technical description of how images in this category should look — lighting, composition, color palette, mood, subject framing, texture, and atmosphere. 2-4 sentences, highly specific. This will be used directly as part of an AI image generation prompt.",
                    },
                },
            },
        },
        confidence_notes: {
            type: "string",
            description: "A brief note about which fields were extracted with high confidence vs. inferred. Helps the user know what to double-check.",
        },
    },
} as const;

type CrawledBrand = {
    name: string;
    tagline: string;
    mission: string;
    archetype: string;
    tone: string;
    target_audiences: string;
    photography_style: string;
    color_primary: string;
    color_secondary: string;
    avoid_phrases: string;
    editorial_guidelines: string;
    image_style_categories: Array<{
        id: string;
        label: string;
        narrative: string;
        storytelling_cues: string[];
        image_prompt_style: string;
    }>;
    confidence_notes: string;
};

// ── Handler ──────────────────────────────────────────────────────────────

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    const { url } = req.body ?? {};

    if (!url || typeof url !== "string" || url.trim().length < 4) {
        return res.status(400).json({ error: "A valid URL is required." });
    }

    try {
        // 1. Attempt to crawl the website
        let crawlContext: string;
        let crawlSucceeded = true;
        let pagesCrawled = 0;

        try {
            const crawlResult = await crawlWebsite(url);
            const { homepage, additionalPages, discoveredColors, allBodyText } = crawlResult;
            pagesCrawled = 1 + additionalPages.length;

            crawlContext = [
                `## Homepage Meta`,
                `Title: ${homepage.title}`,
                `Meta Description: ${homepage.metaDescription}`,
                `OG Site Name: ${homepage.ogSiteName}`,
                `OG Title: ${homepage.ogTitle}`,
                `OG Description: ${homepage.ogDescription}`,
                `Theme Color: ${homepage.themeColor}`,
                homepage.ogImage ? `OG Image: ${homepage.ogImage}` : "",
                ``,
                `## Headings Found on Homepage`,
                homepage.headings.slice(0, 15).map((h) => `- ${h}`).join("\n"),
                ``,
                `## Hero/Banner Text`,
                homepage.heroText || "(none detected)",
                ``,
                `## Colors Found in CSS/Meta`,
                discoveredColors.length > 0 ? discoveredColors.join(", ") : "(none detected from meta/CSS — infer from page content or use neutral defaults)",
                ``,
                `## Image Signals (alt texts and context from page images)`,
                crawlResult.allImageSignals.length > 0
                    ? crawlResult.allImageSignals.slice(0, 40).map((img) =>
                        `- Alt: "${img.alt}"${img.context ? ` | Context: "${img.context.slice(0, 150)}"` : ""}`
                    ).join("\n")
                    : "(no image alt texts found)",
                ``,
                `## Pages Crawled`,
                `Homepage: ${homepage.url}`,
                ...additionalPages.map((p) => `Additional: ${p.url} — "${p.title}"`),
                ``,
                `## Full Page Content`,
                allBodyText.slice(0, 15000),
            ].filter(Boolean).join("\n");
        } catch (crawlErr) {
            // Crawl failed — fall back to LLM inference from URL/domain
            console.warn("Crawl failed, falling back to LLM inference:", crawlErr);
            crawlSucceeded = false;

            // Extract domain and likely company name from URL
            let domain = url;
            try {
                const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
                domain = parsed.hostname.replace(/^www\./, "");
            } catch {}
            const likelyName = domain.split(".")[0].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

            crawlContext = [
                `## IMPORTANT: Website crawl failed`,
                `The website at ${url} could not be crawled (it may be unreachable, blocking bots, or require authentication).`,
                ``,
                `## Available Information`,
                `URL: ${url}`,
                `Domain: ${domain}`,
                `Likely company name: ${likelyName}`,
                ``,
                `## Instructions`,
                `Since the website could not be crawled, use your knowledge of this company/brand to fill in the profile fields as accurately as possible.`,
                `If you recognize the brand, provide real information. If not, infer reasonable defaults based on the domain name, industry signals, and common patterns for this type of business.`,
                `In the confidence_notes field, clearly state that the website could not be crawled and that ALL fields were inferred by the LLM rather than extracted from the site. Flag which fields are likely accurate (if you recognize the brand) vs. which are pure guesses.`,
            ].join("\n");
        }

        // 2. Send to AI for structured extraction
        const systemPrompt = `You are an expert brand strategist and web analyst. Given crawled website data (meta tags, headings, body text, CSS colors, and image signals), you extract and synthesize structured brand information.

Your job is to fill out a company brand profile from the website data. Be specific and grounded in what you observe — do not invent or hallucinate information.

Rules:
- For "name": Extract the actual company/brand name, not the page title or tagline.
- For "archetype": Choose the single closest match from the allowed options based on the brand's tone and positioning.
- For "tone": Derive 2-4 tone descriptors from the actual writing style you observe (e.g. "authoritative, warm, technical" — not generic descriptors).
- For "color_primary" and "color_secondary": Use the discovered CSS/meta colors when available. If multiple colors are found, pick the most prominent (likely the brand's primary) and the next most important (likely accent/CTA). If no colors were detected, infer reasonable defaults from the brand industry or use neutral colors.
- For "editorial_guidelines": Synthesize actionable writing guidelines from the observed tone, structure, vocabulary, and content patterns.
- For "image_style_categories": This is critical. Analyze the image alt texts, OG images, and page visual descriptions to reverse-engineer 2-5 distinct image style categories that the brand uses. Common patterns include:
  * Hero/lifestyle imagery (aspirational scenes)
  * Product/service detail shots
  * Team/culture/behind-the-scenes
  * Data visualization/infographic style
  * Editorial/documentary style
  * Location/environment imagery
  Each category needs a detailed "image_prompt_style" that could be used as a direct AI image generation prompt — include specific technical details about lighting, composition, color temperature, depth of field, subject framing, texture, and mood. The prompt style should reflect what you actually observe in the brand's visual language, not generic stock photo descriptions.
- For "confidence_notes": Be honest about which fields you extracted directly vs. inferred. This helps the user know what to review.

Do not include generic filler. Every field should contain specific, brand-relevant information derived from the crawled data.`;

        const userPrompt = `Analyze this website crawl data and extract a structured brand profile:\n\n${crawlContext}`;

        const brand = await getStructuredResponse<CrawledBrand>(
            "gpt-5.4",
            systemPrompt,
            userPrompt,
            CrawledBrandSchema as any,
            { schemaName: "crawled_brand", temperature: 0.3 }
        );

        return res.status(200).json({
            brand,
            pages_crawled: pagesCrawled,
            url,
            fallback: !crawlSucceeded,
        });
    } catch (err) {
        console.error("API /api/crawl-brand error:", err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
