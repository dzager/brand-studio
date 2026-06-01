// Diagnostic endpoint: test image generation in isolation
// DELETE THIS FILE after debugging
import type { NextApiRequest, NextApiResponse } from "next";
import { generateImageBase64 } from "@/lib/ai-client";

export const config = {
    maxDuration: 120,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const start = Date.now();
    const steps: { step: string; elapsed: number; detail?: string }[] = [];

    function log(step: string, detail?: string) {
        steps.push({ step, elapsed: Date.now() - start, detail });
        console.log(`[test-image] ${step}${detail ? ": " + detail : ""} (${Date.now() - start}ms)`);
    }

    try {
        log("start", `OPENAI_API_KEY=${process.env.OPENAI_API_KEY ? "set (" + process.env.OPENAI_API_KEY.slice(0, 8) + "...)" : "MISSING"}`);
        log("start", `GOOGLE_GENERATIVE_AI_API_KEY=${process.env.GOOGLE_GENERATIVE_AI_API_KEY ? "set" : "MISSING"}`);

        const prompt = req.body?.prompt || "A professional editorial photo of a modern office desk with a laptop, soft natural lighting, shallow depth of field";
        log("generating", `prompt: ${prompt.slice(0, 100)}`);

        const b64 = await generateImageBase64(prompt);

        if (b64) {
            log("success", `image size: ${(b64.length / 1024).toFixed(0)}KB base64`);
            return res.status(200).json({ success: true, steps, imageSizeKB: (b64.length / 1024).toFixed(0) });
        } else {
            log("fail", "generateImageBase64 returned null");
            return res.status(200).json({ success: false, steps, error: "returned null" });
        }
    } catch (err: any) {
        log("error", err.message);
        return res.status(500).json({ success: false, steps, error: err.message });
    }
}
