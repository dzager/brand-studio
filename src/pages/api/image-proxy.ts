import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Proxy endpoint to download a remote image server-side, bypassing CORS.
 * GET /api/image-proxy?url=<encoded image URL>
 *
 * Returns the image with Content-Disposition: attachment so the browser
 * triggers a file download.
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed. Use GET." });
    }

    const { url } = req.query;

    if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "url query parameter is required" });
    }

    try {
        const upstream = await fetch(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
        });

        if (!upstream.ok) {
            return res
                .status(upstream.status)
                .json({ error: `Upstream fetch failed: ${upstream.status}` });
        }

        const contentType =
            upstream.headers.get("content-type") ?? "application/octet-stream";
        const buffer = Buffer.from(await upstream.arrayBuffer());

        // Derive a filename from the URL
        const urlPath = new URL(url).pathname;
        const basename = urlPath.split("/").pop() ?? "image";
        // Ensure the filename has an extension
        const filename = /\.\w{2,5}$/.test(basename)
            ? basename
            : `${basename}.jpg`;

        res.setHeader("Content-Type", contentType);
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
        );
        res.setHeader("Content-Length", buffer.length);
        res.setHeader("Cache-Control", "public, max-age=3600");

        return res.send(buffer);
    } catch (err) {
        console.error("API /api/image-proxy error:", err);
        const message =
            err instanceof Error ? err.message : "Failed to fetch image";
        return res.status(500).json({ error: message });
    }
}

export const config = {
    api: {
        responseLimit: "10mb",
    },
};
