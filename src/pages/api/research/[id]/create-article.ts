/**
 * POST /api/research/[id]/create-article — Create an article from research
 *
 * Injects research brief + highlights into the existing article creation pipeline.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const authUser = await requireAuth(req, res);
    if (!authUser) return;

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { id } = req.query;
    const { angle, model, word_count, image_style } = req.body ?? {};

    if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "Project ID is required" });
    }

    const sb = getSupabase();

    // Fetch project with brief and analysis
    const { data: project, error: projErr } = await sb
        .from("research_projects")
        .select("id, query, company_id, analysis, brief")
        .eq("id", id)
        .single();

    if (projErr || !project) {
        return res.status(404).json({ error: "Project not found" });
    }

    // Collect research context
    const analysis = project.analysis as any;
    const brief = project.brief as any;

    let researchContext = `\n\n## Research Context\n`;
    researchContext += `This article is based on in-depth research on "${project.query}".\n\n`;

    if (brief) {
        researchContext += `### Research Brief\n${brief.summary}\n\n`;
        if (brief.supporting_data?.length) {
            researchContext += `### Key Data Points\n`;
            for (const d of brief.supporting_data) {
                researchContext += `- ${d}\n`;
            }
            researchContext += "\n";
        }
    }

    if (analysis) {
        if (analysis.key_findings?.length) {
            researchContext += `### Key Findings\n`;
            for (const f of analysis.key_findings.slice(0, 8)) {
                researchContext += `- ${f}\n`;
            }
            researchContext += "\n";
        }
        if (analysis.statistics?.length) {
            researchContext += `### Statistics & Data\n`;
            for (const s of analysis.statistics.slice(0, 6)) {
                researchContext += `- ${s.stat} (Source: ${s.source})\n`;
            }
            researchContext += "\n";
        }
        if (analysis.expert_quotes?.length) {
            researchContext += `### Expert Quotes\n`;
            for (const q of analysis.expert_quotes.slice(0, 4)) {
                researchContext += `- "${q.quote}" — ${q.attribution}\n`;
            }
            researchContext += "\n";
        }
    }

    // Build creation prompt
    const selectedAngle = angle || (brief?.content_angles?.[0]?.angle) || project.query;
    const creation_prompt = `${selectedAngle}\n\n${researchContext}`;

    // Forward to the existing create API (internal call)
    const createPayload = {
        creation_prompt,
        company_id: project.company_id,
        model: model || undefined,
        word_count: word_count || "1200-2500",
        image_style: image_style || "default",
    };

    // Use internal fetch to the create endpoint
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    try {
        const createResp = await fetch(`${baseUrl}/api/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Cookie: req.headers.cookie || "",
            },
            body: JSON.stringify(createPayload),
        });

        const data = await createResp.json();
        if (!createResp.ok) {
            throw new Error(data.error || "Article creation failed");
        }

        return res.status(200).json(data);
    } catch (err: any) {
        console.error("[research/create-article] Failed:", err);
        return res.status(500).json({ error: err.message || "Article creation failed" });
    }
}

export const config = {
    maxDuration: 120,
};
