import type { NextApiRequest, NextApiResponse } from "next";
import { fetchArticleContent } from "@/lib/referenceArticles";

/**
 * POST /api/fetch-article-text
 * Fetches a URL and returns its extracted article text content.
 * Used by the Voice Profile modal to import writing samples from a link.
 *
 * Body: { url: string }
 * Returns: { title: string; text: string }
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { url } = req.body ?? {};

    if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "url is required" });
    }

    // Basic URL validation
    try {
        new URL(url);
    } catch {
        return res.status(400).json({ error: "Invalid URL format" });
    }

    try {
        const result = await fetchArticleContent(url);

        if (!result) {
            return res.status(422).json({
                error:
                    "Could not extract article content from this URL. The page may be unreachable, require authentication, or contain insufficient text.",
            });
        }

        return res.status(200).json({
            title: result.title,
            text: result.text,
        });
    } catch (err: any) {
        console.error("API /api/fetch-article-text error:", err);
        return res.status(500).json({
            error: err.message || "Failed to fetch article content",
        });
    }
}
