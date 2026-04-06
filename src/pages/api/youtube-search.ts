import type { NextApiRequest, NextApiResponse } from "next";

type SerperVideo = {
    title: string;
    link: string;
    snippet: string;
    channel?: string;
    date?: string;
    duration?: string;
    imageUrl?: string;
};

type SuccessResponse = {
    videos: SerperVideo[];
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

        const serperResp = await fetch("https://google.serper.dev/videos", {
            method: "POST",
            headers: {
                "X-API-KEY": process.env.SERPER_API_KEY,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ q: query, num: count }),
        });

        if (!serperResp.ok) {
            const text = await serperResp.text();
            console.error("Serper Videos API error:", serperResp.status, text);
            throw new Error(`Video search failed (status ${serperResp.status})`);
        }

        const data = await serperResp.json();

        const videos: SerperVideo[] = (data.videos ?? []).map(
            (vid: Record<string, unknown>) => ({
                title: vid.title ?? "",
                link: vid.link ?? "",
                snippet: vid.snippet ?? "",
                channel: vid.channel ?? undefined,
                date: vid.date ?? undefined,
                duration: vid.duration ?? undefined,
                imageUrl: vid.imageUrl ?? undefined,
            })
        );

        return res.status(200).json({ videos });
    } catch (err) {
        console.error("API /api/youtube-search error:", err);
        const message =
            err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
