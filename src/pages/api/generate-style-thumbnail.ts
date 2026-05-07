/**
 * POST /api/generate-style-thumbnail
 *
 * Generates a small preview thumbnail image that reflects an extracted image style.
 * Uses the style's image_prompt_style to create a representative visual sample.
 * Output is downscaled to 128x128 JPEG to keep base64 size tiny (~5-10KB).
 *
 * Body: { image_prompt_style: string, style_name?: string }
 * Returns: { thumbnail_base64: string }
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { generateImageBase64 } from "@/lib/ai-client";
import sharp from "sharp";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { image_prompt_style, style_name } = req.body;

    if (!image_prompt_style || typeof image_prompt_style !== "string") {
        return res.status(400).json({ error: "image_prompt_style is required" });
    }

    try {
        // Build a thumbnail prompt that uses the extracted style to create a representative sample
        const thumbnailPrompt = [
            `Create a small, visually striking sample image that showcases this photography style.`,
            `The image should be a simple, beautiful scene — perhaps a still life, landscape detail, or abstract composition — that clearly demonstrates the visual characteristics described below.`,
            `Do NOT include any text, watermarks, or UI elements.`,
            `\nSTYLE TO DEMONSTRATE:\n${image_prompt_style}`,
            style_name ? `\nThis style is called "${style_name}".` : "",
        ].filter(Boolean).join("\n");

        const b64 = await generateImageBase64(thumbnailPrompt, {
            size: "1024x1024",
            aspectRatio: "1:1",
        });

        if (!b64) {
            return res.status(500).json({ error: "Failed to generate thumbnail" });
        }

        // Downscale to 128x128 JPEG to minimize storage size (~5-10KB vs ~1MB)
        const inputBuf = Buffer.from(b64, "base64");
        const smallBuf = await sharp(inputBuf)
            .resize(128, 128, { fit: "cover" })
            .jpeg({ quality: 80 })
            .toBuffer();
        const smallB64 = smallBuf.toString("base64");

        return res.status(200).json({ thumbnail_base64: smallB64 });
    } catch (err: any) {
        console.error("API /api/generate-style-thumbnail error:", err);
        return res.status(500).json({ error: err.message || "Failed to generate thumbnail" });
    }
}
