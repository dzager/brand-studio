// src/lib/compileUserPrompt.ts
// Shared user-prompt builder for article generation.
// Image prompt generation is handled separately by compileImagePrompt.ts.

import type { BrandEngine } from "@/brand/engine";
import {
    selectFewShots,
    buildFewShotText,
} from "@/brand/engine";

export type UserPromptOptions = {
    /** The user's article topic / creation prompt */
    creation_prompt: string;
    /** Fully-merged brand engine */
    brand: BrandEngine;
    /** Optional target word count */
    word_count?: string;
    /** Optional cluster context (internal links, keyword coordination) */
    cluster_context?: string;
};

/**
 * Build the user prompt for article generation.
 *
 * Contains:
 *  - the creation prompt
 *  - brand identity context
 *  - article output requirements
 *  - JSON field mapping
 *  - few-shot style examples
 *
 * NOTE: Image guidance is intentionally excluded —
 * it is handled by a separate generation step (compileImagePrompt.ts).
 */
export function compileUserPrompt({
    creation_prompt,
    brand,
    word_count,
    cluster_context,
}: UserPromptOptions): string {
    const fewShots = selectFewShots(brand, { count: 2 });
    const fewShotText = buildFewShotText(fewShots);

    return [
        `Creation prompt: ${creation_prompt.trim()}`,
        "",
        `Brand: ${brand.engine_meta.brand_name}`,
        `Tagline: ${brand.engine_meta.tagline}`,
        "",
        "Output requirements:",
        `- Write a comprehensive, in-depth blog post${word_count ? ` (target: ${word_count} words)` : ""} that matches the voice and editorial guidelines in the system prompt.`,
        '- Include multiple H2/H3 sections with detailed explanations, specific data points, real-world examples, and actionable guidance.',
        '- Each major section should contain substantive detail — facts, statistics, policy specifics, or concrete examples. Do not write thin sections.',
        '- Include a short, factual excerpt.',
        '- Produce clean HTML in "html" using h2/h3, lists, and tables when useful. The HTML content should be thorough and publication-ready.',
        '- Do not mention internal brand rules.',
        "",
        "JSON output field mapping (return valid JSON only — no commentary, no markdown fencing):",
        '- "faq": array of {question, answer} matching the FAQ section in the HTML.',
        '- "key_takeaways": array of 3-5 concise strings matching the Key Takeaways section.',
        '- "content_type": one of "article", "how_to", "comparison", or "listicle" based on the content structure.',
        '- "how_to_steps": array of step strings extracted from the main procedural/step-by-step section. Each string is a single actionable instruction starting with a verb. Return an empty array if the article has no procedural steps.',
        '- "seo.primary_keyword": the exact search query this article targets.',
        '- "seo.secondary_keywords": 5-15 long-tail variations and related queries.',
        '- "seo.slug": short, keyword-rich URL slug (3-6 words, lowercase, hyphenated).',
        "",
        fewShotText ? `Style examples:\n${fewShotText}` : "",
        cluster_context ? cluster_context : "",
    ]
        .filter(Boolean)
        .join("\n");
}
