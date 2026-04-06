import type { NextApiRequest, NextApiResponse } from "next";
import { getAvailableModels } from "@/lib/ai-client";

/**
 * GET /api/models — Returns the list of available AI models
 * based on which API keys are configured.
 */
export default function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed. Use GET." });
    }

    const models = getAvailableModels().map((m) => ({
        id: m.id,
        label: m.label,
        provider: m.provider,
    }));

    return res.status(200).json({ models });
}
