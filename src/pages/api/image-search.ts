import type { NextApiRequest, NextApiResponse } from "next";

type SerperImage = {
    title: string;
    imageUrl: string;
    thumbnailUrl?: string;
    source: string;
    domain: string;
    width?: number;
    height?: number;
};

type SuccessResponse = {
    images: SerperImage[];
};

type ErrorResponse = {
    error: string;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
    try {
        if (!process.env.SERPER_API_KEY) {
            throw new Error("Missing SERPER_API_KEY environment variable");
        }

        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed. Use POST." });
        }

        const { query, num } = req.body ?? {};

        if (!query || typeof query !== "string") {
            return res.status(400).json({ error: "query is required" });
        }

        const count = typeof num === "number" ? Math.min(Math.max(num, 1), 20) : 10;

        const serperResp = await fetch("https://google.serper.dev/images", {
            method: "POST",
            headers: {
                "X-API-KEY": process.env.SERPER_API_KEY,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ q: query, num: count }),
        });

        if (!serperResp.ok) {
            const text = await serperResp.text();
            console.error("Serper API error:", serperResp.status, text);
            throw new Error(`Image search failed (status ${serperResp.status})`);
        }

        const data = await serperResp.json();

        const images: SerperImage[] = (data.images ?? []).map(
            (img: Record<string, unknown>) => ({
                title: img.title ?? "",
                imageUrl: img.imageUrl ?? "",
                thumbnailUrl: img.thumbnailUrl ?? img.imageUrl ?? "",
                source: img.source ?? "",
                domain: img.domain ?? "",
                width: img.imageWidth ?? undefined,
                height: img.imageHeight ?? undefined,
            })
        );

        return res.status(200).json({ images });
    } catch (err) {
        console.error("API /api/image-search error:", err);
        const message =
            err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
