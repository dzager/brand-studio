import type { NextApiRequest, NextApiResponse } from "next";
import { getOpenAIClient } from "@/lib/ai-client";

/**
 * POST /api/analyze-image-style
 *
 * Accepts a base64-encoded image (or data URI) and uses GPT vision to extract
 * world-class art-director-level visual characteristics. Returns a structured
 * image style profile that can be used as an image prompt to replicate the
 * look and feel of the uploaded image.
 */

export const config = {
    api: {
        bodyParser: {
            sizeLimit: "12mb", // allow large images
        },
    },
};

type ImageStyleAnalysis = {
    style_name: string;
    image_prompt_style: string;
    narrative: string;
    storytelling_cues: string[];
    analysis: {
        color_palette: string;
        dominant_colors: string[];
        tone_mood: string;
        subject_matter: string;
        photo_style_type: string;
        lens_characteristics: string;
        film_quality: string;
        contrast: string;
        hue_temperature: string;
        lighting: string;
        composition: string;
        depth_of_field: string;
        texture_grain: string;
        saturation: string;
        post_processing: string;
        era_aesthetic: string;
    };
};

type SuccessResponse = {
    style: ImageStyleAnalysis;
};

type ErrorResponse = {
    error: string;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    try {
        const { image_base64 } = req.body ?? {};

        if (!image_base64 || typeof image_base64 !== "string") {
            return res.status(400).json({ error: "image_base64 is required." });
        }

        // Normalize: strip data URI prefix if present
        let base64Data = image_base64;
        let mimeType = "image/png";
        const dataUriMatch = image_base64.match(/^data:(image\/\w+);base64,(.+)$/);
        if (dataUriMatch) {
            mimeType = dataUriMatch[1];
            base64Data = dataUriMatch[2];
        }

        const client = getOpenAIClient();

        const systemPrompt = `You are a world-class art director, creative director, and prompt engineer with 30 years of experience in photography, film, and visual design. Your expertise spans studio and editorial photography, cinematography, color science, lens optics, print and digital post-production, and AI image generation.

When shown an image, you perform an exhaustive visual analysis — dissecting every aesthetic dimension with the precision of a master colorist, the eye of a DP, and the vocabulary of a prompt engineer. Your goal is to produce a set of attributes so precise and richly described that an AI image generator could faithfully replicate the exact look, feel, and quality of the original image.

You must return a JSON object with the following structure:

{
  "style_name": "A concise 2-4 word name for this visual style (e.g. 'Warm Editorial Glow', 'Crisp Clinical White', 'Moody Film Noir')",
  "image_prompt_style": "A comprehensive, richly detailed prompt paragraph (150-300 words) that captures ALL visual characteristics in a format optimized for AI image generation. This should read like a master prompt — including color, lighting, lens, film stock, mood, composition, and post-processing in flowing, precise language. This is the most important field.",
  "narrative": "A 1-2 sentence description of the overall visual story and emotional intent of this style.",
  "storytelling_cues": ["array of 4-8 short phrases describing the visual storytelling elements, e.g. 'warm golden hour backlighting', 'intimate shallow focus', 'desaturated earth tones'"],
  "analysis": {
    "color_palette": "Detailed description of the overall color scheme — warm/cool bias, palette family, color relationships, dominant vs accent colors",
    "dominant_colors": ["array of 4-6 specific color names with hex approximations, e.g. 'warm ivory (#F5F0E8)', 'deep forest green (#1B3A2D)'"],
    "tone_mood": "The emotional tone — clinical, warm, moody, aspirational, gritty, ethereal, etc. with specific descriptors",
    "subject_matter": "What the image depicts — type of subjects, setting, activity, context",
    "photo_style_type": "The photographic genre — editorial, lifestyle, product, portrait, landscape, street, documentary, fashion, etc.",
    "lens_characteristics": "Focal length estimate, aperture behavior, lens character — e.g. '85mm f/1.4, creamy bokeh, minimal distortion, slight vignette'",
    "film_quality": "Film stock emulation or digital processing — e.g. 'Kodak Portra 400 emulation with lifted blacks', 'clean digital medium format', 'Fuji Pro 400H with pastel shift'",
    "contrast": "Contrast profile — flat, punchy, high-key, low-key, crushed blacks, lifted shadows, etc.",
    "hue_temperature": "Color temperature in Kelvin estimate and overall hue shift — warm, cool, neutral, split-toned, cross-processed",
    "lighting": "Lighting setup — natural/artificial, direction, quality (hard/soft), fill ratio, catchlights, rim light, etc.",
    "composition": "Framing, rule of thirds, leading lines, negative space, symmetry, cropping approach",
    "depth_of_field": "Shallow, deep, selective focus, tilt-shift effect, bokeh quality",
    "texture_grain": "Film grain presence, noise characteristics, skin texture rendering, surface detail level",
    "saturation": "Saturation level — vibrant, muted, selective desaturation, pastel, hyper-saturated",
    "post_processing": "Post-production techniques — color grading style, split toning, vignette, clarity/dehaze, frequency separation, retouching level",
    "era_aesthetic": "Visual era or movement reference — e.g. '2020s clean editorial', '1970s film renaissance', 'Y2K digital', 'mid-century modern'"
  }
}

Be extremely specific and technical. Use precise color names, lens specifications, film stock references, and lighting terminology. The image_prompt_style field should synthesize ALL analysis dimensions into a single, powerful prompt that could reproduce this exact aesthetic.`;

        const userPrompt = `Analyze this image with the precision of a world-class art director. Extract every visual characteristic — color, tone, subject, lighting, lens, film quality, contrast, hue, composition, texture, saturation, depth of field, and post-processing — and produce a comprehensive style profile that could be used to replicate this exact aesthetic in AI-generated images.

Return ONLY the JSON object, no additional text.`;

        const response = await client.chat.completions.create({
            model: "gpt-5.4",
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: [
                        { type: "text", text: userPrompt },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${mimeType};base64,${base64Data}`,
                                detail: "high",
                            },
                        },
                    ],
                },
            ],
            temperature: 0.4,
            response_format: { type: "json_object" },
        });

        const raw = response.choices?.[0]?.message?.content ?? "";
        let parsed: ImageStyleAnalysis;

        try {
            parsed = JSON.parse(raw) as ImageStyleAnalysis;
        } catch {
            console.error("Failed to parse GPT response as JSON:", raw.substring(0, 500));
            return res.status(500).json({ error: "AI returned invalid JSON. Please try again." });
        }

        // Validate essential fields
        if (!parsed.image_prompt_style || !parsed.style_name) {
            return res.status(500).json({ error: "AI analysis was incomplete. Please try again with a different image." });
        }

        return res.status(200).json({ style: parsed });
    } catch (err) {
        console.error("API /api/analyze-image-style error:", err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
