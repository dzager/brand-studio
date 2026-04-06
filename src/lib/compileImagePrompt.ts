// src/lib/compileImagePrompt.ts
// Separate image-prompt generation — decoupled from article content.
// Designed for maximum style adherence: mandatory style first, minimal noise.

import type { BrandEngine } from "@/brand/engine";
import { getImageStyleCategories } from "@/brand/engine";

export type ImagePromptOptions = {
    /** Article title for context */
    title: string;
    /** Article excerpt for context */
    excerpt: string;
    /** Fully-merged brand engine */
    brand: BrandEngine;
    /** Resolved image style category id */
    styleId?: string;
};

/**
 * Build the system prompt for the image-prompt generation step.
 */
export function compileImageSystemPrompt(brand: BrandEngine): string {
    return [
        `You are an art director for ${brand.engine_meta.brand_name}.`,
        "Your job is to write a single image generation prompt for a blog post hero image.",
        "The image must precisely follow any MANDATORY VISUAL STYLE provided.",
        "Output ONLY the image prompt text — no explanation, no JSON, no commentary.",
    ].join(" ");
}

/**
 * Build the user prompt for the image-prompt generation step.
 *
 * Architecture: mandatory style FIRST (primacy), then article context,
 * then general photography defaults. No duplication.
 */
export function compileImageUserPrompt({
    title,
    excerpt,
    brand,
    styleId = "default",
}: ImagePromptOptions): string {
    const parts: string[] = [];

    // ── Category-specific style (FIRST — primacy effect) ────────────────
    const categories = getImageStyleCategories(brand);
    const category = categories.find((c) => c.id === styleId);

    if (category && styleId !== "default") {
        if (category.image_prompt_style) {
            parts.push(`MANDATORY VISUAL STYLE — follow this exactly:`);
            parts.push(category.image_prompt_style);
            parts.push("");
        }
        if (category.storytelling_cues?.length) {
            parts.push(`Visual cues the image MUST convey: ${category.storytelling_cues.join("; ")}.`);
            parts.push("");
        }
    }

    // ── Article context ─────────────────────────────────────────────────
    parts.push(`Article title: ${title}`);
    parts.push(`Article excerpt: ${excerpt}`);
    parts.push("");
    parts.push("Write one image generation prompt for the hero image of this article.");
    parts.push("");

    // ── General photography defaults (only the useful bits) ─────────────
    const photo = brand.photography_style;
    parts.push("General photography guidance:");
    parts.push(`- Feel: ${photo.global_feel.join(", ")}`);
    parts.push(`- Lighting: ${photo.lighting}`);
    parts.push(`- Mood: ${photo.mood}`);
    parts.push(`- Composition: ${photo.composition}`);
    parts.push(`- Subjects: ${photo.subjects.join(", ")}`);
    parts.push(`- Avoid: ${photo.avoid.join(", ")}`);
    parts.push(`- Realism: ${photo.realism_base}`);

    // Color palette (brief)
    const colors = brand.design_tokens.colors.primary;
    parts.push(`- Brand colors: ${colors.obsidian}, ${colors.marigold}, ${colors.sky}`);

    return parts.join("\n");
}
