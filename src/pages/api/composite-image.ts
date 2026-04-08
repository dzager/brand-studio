import type { NextApiRequest, NextApiResponse } from "next";
import sharp from "sharp";
import { getSupabase } from "@/lib/supabase";
import { buildBrandEngine, type CompanyRecord } from "@/lib/buildBrandEngine";
import { getImageStyleCategories } from "@/brand/engine";
import { generateImageBase64 } from "@/lib/ai-client";

type SuccessResponse = {
    image_base64: string;
    background_prompt: string;
};

type ErrorResponse = {
    error: string;
};

/**
 * POST /api/composite-image
 *
 * Accepts a real product image URL and article context,
 * generates a contextual AI background, removes the product's
 * background, and composites the product centered on top.
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
    try {
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed. Use POST." });
        }

        const {
            product_image_url,
            article_title,
            article_excerpt,
            custom_bg_prompt,
            image_style,
            company_id,
        } = req.body ?? {};

        if (!product_image_url || typeof product_image_url !== "string") {
            return res.status(400).json({ error: "product_image_url is required" });
        }
        if (!article_title || typeof article_title !== "string") {
            return res.status(400).json({ error: "article_title is required" });
        }

        // ── 1. Build brand engine (optional, for style + photography guidance) ──
        let brandStyleDirective = "";
        if (company_id && typeof company_id === "string") {
            try {
                const { data: companyData } = await getSupabase()
                    .from("companies")
                    .select("*")
                    .eq("id", company_id)
                    .single();

                if (companyData) {
                    const brand = buildBrandEngine(companyData as CompanyRecord);
                    const categories = getImageStyleCategories(brand);
                    const styleId =
                        typeof image_style === "string" &&
                        categories.some((c) => c.id === image_style)
                            ? image_style
                            : "default";

                    if (styleId !== "default") {
                        const category = categories.find((c) => c.id === styleId);
                        if (category?.image_prompt_style) {
                            brandStyleDirective = `Visual style: ${category.image_prompt_style}\n`;
                        }
                    }

                    // Add photography guidance
                    const photo = brand.photography_style;
                    brandStyleDirective += [
                        `Lighting: ${photo.lighting}`,
                        `Mood: ${photo.mood}`,
                        `Feel: ${photo.global_feel.join(", ")}`,
                    ].join(". ") + ".";
                }
            } catch {
                // Non-critical — proceed without brand context
            }
        }

        // ── 2. Build the background-only prompt ─────────────────────────────
        const excerptContext = article_excerpt
            ? `\nArticle context: ${article_excerpt}`
            : "";

        const userTweak =
            typeof custom_bg_prompt === "string" && custom_bg_prompt.trim()
                ? `\nAdditional direction: ${custom_bg_prompt.trim()}`
                : "";

        const backgroundPrompt = [
            `Create a beautiful, atmospheric BACKGROUND SCENE for a product photo.`,
            `The background must relate to this article topic: "${article_title}".`,
            excerptContext,
            ``,
            `CRITICAL RULES:`,
            `- This image is ONLY the background/environment — DO NOT include any products, objects, people, or text in the center of the image.`,
            `- Leave the center of the image relatively clean and uncluttered so a product can be placed there.`,
            `- Create an ambient, editorial-quality environment that evokes the article's theme.`,
            `- Use soft, diffused lighting with a natural depth of field.`,
            `- The scene should feel premium, modern, and aspirational.`,
            ``,
            brandStyleDirective ? `Brand guidance:\n${brandStyleDirective}` : "",
            userTweak,
        ]
            .filter(Boolean)
            .join("\n");

        // ── 3. Generate AI background ───────────────────────────────────────
        const bgBase64 = await generateImageBase64(backgroundPrompt);
        if (!bgBase64) {
            throw new Error("Background image generation returned no data.");
        }

        // ── 4. Fetch the product image ──────────────────────────────────────
        const fetchHeaders: Record<string, string> = {
            "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": new URL(product_image_url).origin + "/",
            "Sec-Fetch-Dest": "image",
            "Sec-Fetch-Mode": "no-cors",
            "Sec-Fetch-Site": "cross-site",
        };

        let productResp = await fetch(product_image_url, { headers: fetchHeaders });

        // Retry without Referer if blocked (some hosts reject cross-origin referers)
        if (!productResp.ok) {
            const { Referer: _, ...headersNoReferer } = fetchHeaders;
            productResp = await fetch(product_image_url, { headers: headersNoReferer });
        }

        if (!productResp.ok) {
            throw new Error(
                `Failed to fetch product image (status ${productResp.status})`
            );
        }

        const productBuffer = Buffer.from(await productResp.arrayBuffer());

        // ── 5. Process product image: remove background + resize ────────────
        const bgBuffer = Buffer.from(bgBase64, "base64");
        const bgMeta = await sharp(bgBuffer).metadata();
        const bgWidth = bgMeta.width ?? 1792;
        const bgHeight = bgMeta.height ?? 1024;

        // Target product size: ~75-80% of background dimensions, maintaining aspect
        const maxProductWidth = Math.round(bgWidth * 0.75);
        const maxProductHeight = Math.round(bgHeight * 0.80);

        // Remove background: flatten to ensure alpha, then use simple approach
        // Convert product to PNG with alpha, trim surrounding whitespace/light bg
        let productProcessed = sharp(productBuffer)
            .ensureAlpha()
            .png();

        // Get product metadata to check if it already has alpha
        const productMeta = await sharp(productBuffer).metadata();

        // Attempt background removal: remove white/near-white pixels
        // by converting to RGBA and making light border colors transparent
        if (!productMeta.hasAlpha) {
            // For images without alpha, try to remove white background
            // Extract raw pixels, process, and rebuild
            const { data: rawData, info } = await sharp(productBuffer)
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });

            const pixels = new Uint8Array(rawData);

            // Edge-flood fill approach: mark border-touching white-ish pixels as transparent
            const w = info.width;
            const h = info.height;
            const threshold = 235; // Pixels with R,G,B all above this are "background"
            const visited = new Uint8Array(w * h);
            const queue: number[] = [];

            // Seed: all border pixels that are near-white
            for (let x = 0; x < w; x++) {
                for (const y of [0, h - 1]) {
                    const idx = (y * w + x) * 4;
                    if (
                        pixels[idx] >= threshold &&
                        pixels[idx + 1] >= threshold &&
                        pixels[idx + 2] >= threshold
                    ) {
                        queue.push(y * w + x);
                        visited[y * w + x] = 1;
                    }
                }
            }
            for (let y = 0; y < h; y++) {
                for (const x of [0, w - 1]) {
                    const idx = (y * w + x) * 4;
                    if (
                        pixels[idx] >= threshold &&
                        pixels[idx + 1] >= threshold &&
                        pixels[idx + 2] >= threshold &&
                        !visited[y * w + x]
                    ) {
                        queue.push(y * w + x);
                        visited[y * w + x] = 1;
                    }
                }
            }

            // BFS flood fill from border white pixels
            while (queue.length > 0) {
                const pos = queue.shift()!;
                const px = pos % w;
                const py = Math.floor(pos / w);
                const pidx = pos * 4;

                // Make this pixel transparent
                pixels[pidx + 3] = 0;

                // Check 4-connected neighbors
                for (const [dx, dy] of [
                    [-1, 0],
                    [1, 0],
                    [0, -1],
                    [0, 1],
                ] as const) {
                    const nx = px + dx;
                    const ny = py + dy;
                    if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                    const nPos = ny * w + nx;
                    if (visited[nPos]) continue;
                    const nIdx = nPos * 4;
                    if (
                        pixels[nIdx] >= threshold &&
                        pixels[nIdx + 1] >= threshold &&
                        pixels[nIdx + 2] >= threshold
                    ) {
                        visited[nPos] = 1;
                        queue.push(nPos);
                    }
                }
            }

            // Soften edges: for pixels adjacent to transparent ones, reduce alpha
            const edgePixels = new Uint8Array(rawData.length);
            edgePixels.set(pixels);
            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const idx = (y * w + x) * 4;
                    if (pixels[idx + 3] === 0) continue;
                    // Check if any neighbor is transparent
                    let transparentNeighbors = 0;
                    for (const [dx, dy] of [
                        [-1, 0], [1, 0], [0, -1], [0, 1],
                    ] as const) {
                        const nIdx = ((y + dy) * w + (x + dx)) * 4;
                        if (pixels[nIdx + 3] === 0) transparentNeighbors++;
                    }
                    if (transparentNeighbors > 0) {
                        // Feather the edge
                        edgePixels[idx + 3] = Math.round(
                            pixels[idx + 3] * (1 - transparentNeighbors * 0.2)
                        );
                    }
                }
            }

            productProcessed = sharp(Buffer.from(edgePixels.buffer), {
                raw: { width: w, height: h, channels: 4 },
            }).png();
        }

        // Resize product to fit
        const productResized = await productProcessed
            .resize(maxProductWidth, maxProductHeight, {
                fit: "inside",
                withoutEnlargement: true,
            })
            .toBuffer();

        // Get resized product dimensions
        const resizedMeta = await sharp(productResized).metadata();
        const prodW = resizedMeta.width ?? maxProductWidth;
        const prodH = resizedMeta.height ?? maxProductHeight;

        // ── 6. Composite: center product on background ──────────────────────
        const offsetX = Math.round((bgWidth - prodW) / 2);
        const offsetY = Math.round((bgHeight - prodH) / 2);

        const composited = await sharp(bgBuffer)
            .composite([
                {
                    input: productResized,
                    top: offsetY,
                    left: offsetX,
                    blend: "over",
                },
            ])
            .png()
            .toBuffer();

        const finalBase64 = composited.toString("base64");

        return res.status(200).json({
            image_base64: finalBase64,
            background_prompt: backgroundPrompt,
        });
    } catch (err) {
        console.error("API /api/composite-image error:", err);
        const message =
            err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}

export const config = {
    api: {
        responseLimit: "20mb",
        bodyParser: {
            sizeLimit: "4mb",
        },
    },
};
