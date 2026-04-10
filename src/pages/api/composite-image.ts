import type { NextApiRequest, NextApiResponse } from "next";
import sharp from "sharp";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
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

// Standard output dimensions (16:9)
const OUTPUT_WIDTH = 1792;
const OUTPUT_HEIGHT = 1024;

/**
 * POST /api/composite-image
 *
 * Two-image composite workflow:
 *  1. Product image — fetched from URL or provided as base64, background removed via Gemini
 *  2. Background image — AI-generated, fetched from URL, or provided as base64
 *  3. Product composited centered on top of the background
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
            product_image_base64,
            article_title,
            article_excerpt,
            // Background source — exactly one of these three:
            background_image_url,
            background_image_base64,
            custom_bg_prompt,
            // Styling
            image_style,
            company_id,
        } = req.body ?? {};

        // Require either product URL or base64
        const hasProductUrl = product_image_url && typeof product_image_url === "string";
        const hasProductBase64 = product_image_base64 && typeof product_image_base64 === "string";
        if (!hasProductUrl && !hasProductBase64) {
            return res.status(400).json({ error: "product_image_url or product_image_base64 is required" });
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

        // ── 2. Acquire background image ─────────────────────────────────────
        let bgBuffer: Buffer;
        let backgroundPrompt = "";

        const hasBgUrl = background_image_url && typeof background_image_url === "string";
        const hasBgBase64 = background_image_base64 && typeof background_image_base64 === "string";

        if (hasBgUrl) {
            // Fetch external background image
            console.log("[composite] Using searched background image");
            const bgResp = await fetchImageWithRetry(background_image_url);
            bgBuffer = Buffer.from(await bgResp.arrayBuffer());
            backgroundPrompt = "(user-provided background image)";
        } else if (hasBgBase64) {
            // Use uploaded background image
            console.log("[composite] Using uploaded background image");
            bgBuffer = Buffer.from(background_image_base64, "base64");
            backgroundPrompt = "(user-uploaded background image)";
        } else {
            // AI-generate background from article context (original behavior)
            console.log("[composite] Generating AI background");
            const excerptContext = article_excerpt
                ? `\nArticle context: ${article_excerpt}`
                : "";

            const userTweak =
                typeof custom_bg_prompt === "string" && custom_bg_prompt.trim()
                    ? `\nAdditional direction: ${custom_bg_prompt.trim()}`
                    : "";

            backgroundPrompt = [
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

            const bgBase64 = await generateImageBase64(backgroundPrompt);
            if (!bgBase64) {
                throw new Error("Background image generation returned no data.");
            }
            bgBuffer = Buffer.from(bgBase64, "base64");
        }

        // Resize background to standard output dimensions
        bgBuffer = await sharp(bgBuffer)
            .resize(OUTPUT_WIDTH, OUTPUT_HEIGHT, { fit: "cover" })
            .png()
            .toBuffer();

        const bgMeta = await sharp(bgBuffer).metadata();
        const bgWidth = bgMeta.width ?? OUTPUT_WIDTH;
        const bgHeight = bgMeta.height ?? OUTPUT_HEIGHT;

        // ── 3. Fetch the product image ──────────────────────────────────────
        let productBuffer: Buffer;
        if (hasProductBase64) {
            productBuffer = Buffer.from(product_image_base64, "base64");
        } else {
            const productResp = await fetchImageWithRetry(product_image_url);
            productBuffer = Buffer.from(await productResp.arrayBuffer());
        }

        // ── 4. Remove product background via Gemini ─────────────────────────
        console.log("[composite] Removing product background via Gemini...");
        const cutoutBuffer = await removeBackgroundViaGemini(productBuffer);

        // ── 5. Resize product cutout to fit on background ───────────────────
        const maxProductWidth = Math.round(bgWidth * 0.75);
        const maxProductHeight = Math.round(bgHeight * 0.80);

        const productResized = await sharp(cutoutBuffer)
            .resize(maxProductWidth, maxProductHeight, {
                fit: "inside",
                withoutEnlargement: true,
            })
            .png()
            .toBuffer();

        // Get resized product dimensions
        const resizedMeta = await sharp(productResized).metadata();
        const prodW = resizedMeta.width ?? maxProductWidth;
        const prodH = resizedMeta.height ?? maxProductHeight;

        // ── 6. Build natural composite with shadow + ambient blending ────────

        // Position product lower (rule-of-thirds) — products look natural
        // when they sit in the lower 2/3 of the frame, not dead center
        const offsetX = Math.round((bgWidth - prodW) / 2);
        const offsetY = Math.round((bgHeight - prodH) * 0.55); // bias downward

        // --- 6a. Create a soft drop shadow ---
        // Extract the product's alpha channel as the shadow shape
        const { data: prodRaw, info: prodInfo } = await sharp(productResized)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        // Build shadow mask from product alpha (black silhouette)
        const shadowPixels = new Uint8Array(prodInfo.width * prodInfo.height * 4);
        for (let i = 0; i < prodRaw.length; i += 4) {
            const alpha = prodRaw[i + 3];
            // Shadow is black with reduced opacity from product alpha
            shadowPixels[i] = 0;       // R
            shadowPixels[i + 1] = 0;   // G
            shadowPixels[i + 2] = 0;   // B
            shadowPixels[i + 3] = Math.round(alpha * 0.35); // shadow opacity
        }

        const shadowBase = await sharp(Buffer.from(shadowPixels.buffer), {
            raw: { width: prodInfo.width, height: prodInfo.height, channels: 4 },
        })
            .png()
            .toBuffer();

        // Blur the shadow for softness, then scale it to be slightly wider/shorter
        // to simulate a light source from above
        const shadowBlurred = await sharp(shadowBase)
            .resize(
                Math.round(prodW * 1.05),  // slightly wider
                Math.round(prodH * 0.15),  // compress vertically for ground shadow
                { fit: "fill" }
            )
            .blur(12)
            .png()
            .toBuffer();

        const shadowMeta = await sharp(shadowBlurred).metadata();
        const shadowW = shadowMeta.width ?? prodW;
        const shadowH = shadowMeta.height ?? Math.round(prodH * 0.15);

        // Shadow position: centered under the product, at the bottom edge
        const shadowX = Math.round(offsetX + (prodW - shadowW) / 2);
        const shadowY = Math.round(offsetY + prodH - shadowH * 0.3);

        // --- 6b. Sample ambient color from background edges for color matching ---
        // Take a thin strip from the background edges to get the ambient color
        const bgRawData = await sharp(bgBuffer).ensureAlpha().raw().toBuffer();
        let totalR = 0, totalG = 0, totalB = 0, sampleCount = 0;

        // Sample from bottom third of the background (where product sits)
        const sampleStartY = Math.round(bgHeight * 0.6);
        for (let y = sampleStartY; y < bgHeight; y += 4) {
            for (let x = 0; x < bgWidth; x += 8) {
                const idx = (y * bgWidth + x) * 4;
                totalR += bgRawData[idx];
                totalG += bgRawData[idx + 1];
                totalB += bgRawData[idx + 2];
                sampleCount++;
            }
        }

        const ambientR = Math.round(totalR / sampleCount);
        const ambientG = Math.round(totalG / sampleCount);
        const ambientB = Math.round(totalB / sampleCount);

        // --- 6c. Create ambient color overlay for the product ---
        // Very subtle tint to match scene lighting (10% opacity)
        const ambientOverlay = await sharp({
            create: {
                width: prodW,
                height: prodH,
                channels: 4,
                background: { r: ambientR, g: ambientG, b: ambientB, alpha: 0.08 },
            },
        })
            .png()
            .toBuffer();

        // --- 6d. Apply ambient tint to the product ---
        const productTinted = await sharp(productResized)
            .composite([
                {
                    input: ambientOverlay,
                    blend: "over",
                },
            ])
            .png()
            .toBuffer();

        // --- 6e. Final composite: background → shadow → product ---
        const composited = await sharp(bgBuffer)
            .composite([
                // Layer 1: Drop shadow (behind product)
                {
                    input: shadowBlurred,
                    top: Math.max(0, shadowY),
                    left: Math.max(0, shadowX),
                    blend: "over",
                },
                // Layer 2: Product with ambient tint
                {
                    input: productTinted,
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

// ── Helper: fetch an image URL with browser-like headers + retry ─────────

async function fetchImageWithRetry(url: string): Promise<Response> {
    const fetchHeaders: Record<string, string> = {
        "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": new URL(url).origin + "/",
        "Sec-Fetch-Dest": "image",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Site": "cross-site",
    };

    let resp = await fetch(url, { headers: fetchHeaders });

    // Retry without Referer if blocked
    if (!resp.ok) {
        const { Referer: _, ...headersNoReferer } = fetchHeaders;
        resp = await fetch(url, { headers: headersNoReferer });
    }

    if (!resp.ok) {
        throw new Error(`Failed to fetch image (status ${resp.status}) from ${url}`);
    }

    return resp;
}

// ── Helper: remove background via Gemini green-screen approach ───────────

async function removeBackgroundViaGemini(productBuffer: Buffer): Promise<Buffer> {
    // Convert product image to base64 for Gemini
    const productPng = await sharp(productBuffer).png().toBuffer();
    const productBase64 = productPng.toString("base64");

    try {
        const result = await generateText({
            model: google("gemini-2.5-flash-preview-04-17"),
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: [
                                "Replace the background of this product image with a solid bright green (#00FF00) color.",
                                "Keep ONLY the product/subject itself completely unchanged.",
                                "The green must be a perfectly uniform, flat #00FF00 green with no gradients or variations.",
                                "Do not modify, crop, resize, or alter the product in any way.",
                                "The product edges should be clean and precise against the green background.",
                            ].join(" "),
                        },
                        {
                            type: "image",
                            image: productBase64,
                        },
                    ],
                },
            ],
        });

        // Extract the edited image from Gemini's response
        if (result.files && result.files.length > 0) {
            const editedFile = result.files[0];
            let greenScreenBuffer: Buffer;

            if (editedFile.base64) {
                greenScreenBuffer = Buffer.from(editedFile.base64, "base64");
            } else if (editedFile.uint8Array) {
                greenScreenBuffer = Buffer.from(editedFile.uint8Array);
            } else {
                console.warn("[composite] Gemini returned file without usable data, falling back to flood-fill");
                return fallbackBackgroundRemoval(productBuffer);
            }

            // Chroma-key the green background to transparent
            return chromaKeyGreen(greenScreenBuffer);
        }

        console.warn("[composite] Gemini returned no files, falling back to flood-fill");
        return fallbackBackgroundRemoval(productBuffer);
    } catch (err) {
        console.warn("[composite] Gemini background removal failed, falling back to flood-fill:", err);
        return fallbackBackgroundRemoval(productBuffer);
    }
}

// ── Helper: chroma-key #00FF00 green to transparent ──────────────────────

async function chromaKeyGreen(imageBuffer: Buffer): Promise<Buffer> {
    const { data: rawData, info } = await sharp(imageBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const pixels = new Uint8Array(rawData);
    const w = info.width;
    const h = info.height;

    // Green detection thresholds
    const greenMinG = 200;  // Green channel must be high
    const greenMaxR = 80;   // Red channel must be low
    const greenMaxB = 80;   // Blue channel must be low

    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        if (g >= greenMinG && r <= greenMaxR && b <= greenMaxB) {
            // Pure green → fully transparent
            pixels[i + 3] = 0;
        } else if (g >= 150 && r <= 120 && b <= 120) {
            // Near-green → partially transparent (edge anti-aliasing)
            const greenness = (g - Math.max(r, b)) / g;
            if (greenness > 0.4) {
                pixels[i + 3] = Math.round(255 * (1 - greenness));
                // Remove green spill from remaining color
                pixels[i + 1] = Math.round(g * (1 - greenness * 0.5));
            }
        }
    }

    // Edge feathering pass: smooth alpha transitions
    const smoothed = new Uint8Array(pixels.length);
    smoothed.set(pixels);

    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const idx = (y * w + x) * 4;
            if (pixels[idx + 3] === 0) continue;

            let transparentNeighbors = 0;
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
                const nIdx = ((y + dy) * w + (x + dx)) * 4;
                if (pixels[nIdx + 3] === 0) transparentNeighbors++;
            }
            if (transparentNeighbors > 0 && transparentNeighbors < 4) {
                smoothed[idx + 3] = Math.round(
                    pixels[idx + 3] * (1 - transparentNeighbors * 0.15)
                );
            }
        }
    }

    return sharp(Buffer.from(smoothed.buffer), {
        raw: { width: w, height: h, channels: 4 },
    })
        .png()
        .toBuffer();
}

// ── Fallback: original flood-fill background removal ─────────────────────

async function fallbackBackgroundRemoval(productBuffer: Buffer): Promise<Buffer> {
    const productMeta = await sharp(productBuffer).metadata();

    if (productMeta.hasAlpha) {
        // Already has alpha, just return as PNG
        return sharp(productBuffer).ensureAlpha().png().toBuffer();
    }

    const { data: rawData, info } = await sharp(productBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const pixels = new Uint8Array(rawData);
    const w = info.width;
    const h = info.height;
    const threshold = 235;
    const visited = new Uint8Array(w * h);
    const queue: number[] = [];

    // Seed: all border pixels that are near-white
    for (let x = 0; x < w; x++) {
        for (const y of [0, h - 1]) {
            const idx = (y * w + x) * 4;
            if (pixels[idx] >= threshold && pixels[idx + 1] >= threshold && pixels[idx + 2] >= threshold) {
                queue.push(y * w + x);
                visited[y * w + x] = 1;
            }
        }
    }
    for (let y = 0; y < h; y++) {
        for (const x of [0, w - 1]) {
            const idx = (y * w + x) * 4;
            if (pixels[idx] >= threshold && pixels[idx + 1] >= threshold && pixels[idx + 2] >= threshold && !visited[y * w + x]) {
                queue.push(y * w + x);
                visited[y * w + x] = 1;
            }
        }
    }

    // BFS flood fill
    while (queue.length > 0) {
        const pos = queue.shift()!;
        const px = pos % w;
        const py = Math.floor(pos / w);
        const pidx = pos * 4;
        pixels[pidx + 3] = 0;

        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
            const nx = px + dx;
            const ny = py + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            const nPos = ny * w + nx;
            if (visited[nPos]) continue;
            const nIdx = nPos * 4;
            if (pixels[nIdx] >= threshold && pixels[nIdx + 1] >= threshold && pixels[nIdx + 2] >= threshold) {
                visited[nPos] = 1;
                queue.push(nPos);
            }
        }
    }

    // Edge feathering
    const edgePixels = new Uint8Array(rawData.length);
    edgePixels.set(pixels);
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const idx = (y * w + x) * 4;
            if (pixels[idx + 3] === 0) continue;
            let transparentNeighbors = 0;
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
                const nIdx = ((y + dy) * w + (x + dx)) * 4;
                if (pixels[nIdx + 3] === 0) transparentNeighbors++;
            }
            if (transparentNeighbors > 0) {
                edgePixels[idx + 3] = Math.round(pixels[idx + 3] * (1 - transparentNeighbors * 0.2));
            }
        }
    }

    return sharp(Buffer.from(edgePixels.buffer), {
        raw: { width: w, height: h, channels: 4 },
    })
        .png()
        .toBuffer();
}

export const config = {
    api: {
        responseLimit: "20mb",
        bodyParser: {
            sizeLimit: "10mb",
        },
    },
};
