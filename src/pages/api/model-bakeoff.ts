import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "@/lib/auth";
import { getAdminSupabase } from "@/lib/supabase";
import { getTextResponse } from "@/lib/ai-client";
import { buildBrandEngine, type CompanyRecord } from "@/lib/buildBrandEngine";
import { compileVoiceProfileClause } from "@/brand/engine";

/**
 * POST /api/model-bakeoff
 *
 * Body: { topic: string, company_id: string }
 * Returns: { samples: Array<{ model_id, label, provider, content, latency_ms }> }
 *
 * Runs three models in parallel on the same short-content prompt — using the
 * company's full brand context (voice, tone, editorial guidelines) — and returns
 * the outputs for side-by-side comparison.
 */

const BAKEOFF_MODELS = [
    { id: "gpt-5.5",       label: "GPT-5.5",       provider: "openai" },
    { id: "gpt-4.1",       label: "GPT-4.1",       provider: "openai" },
    { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", provider: "google" },
] as const;

/**
 * Build a company-aware system prompt for the bake-off.
 * Injects brand identity, voice profile, tone, and editorial guidelines
 * so each model writes in the company's actual voice.
 */
function buildBakeoffSystemPrompt(company: CompanyRecord): string {
    const brand = buildBrandEngine(company);

    const sections: string[] = [
        `You are a professional content writer for ${company.name}.`,
    ];

    // Brand identity
    if (company.tagline) sections.push(`Brand tagline: "${company.tagline}".`);
    if (company.mission) sections.push(`Mission: ${company.mission}.`);
    if (company.archetype) sections.push(`Brand archetype: ${company.archetype}.`);
    if (company.tone) sections.push(`Tone: ${company.tone}.`);

    // Target audiences
    if (company.target_audiences && company.target_audiences.length > 0) {
        sections.push(`Target audiences: ${company.target_audiences.join(", ")}.`);
    }

    // Voice profile (the most important brand context)
    const voiceClause = compileVoiceProfileClause(brand);
    if (voiceClause) {
        sections.push(voiceClause);
    }

    // Editorial guidelines (condensed for short content)
    if (company.editorial_guidelines) {
        sections.push(`\nEditorial guidelines to follow:\n${company.editorial_guidelines}`);
    }

    // Avoid phrases
    if (company.avoid_phrases) {
        sections.push(`\nNever use these phrases: ${company.avoid_phrases}.`);
    }

    // Core instructions for the bake-off sample
    sections.push(
        `\nWrite a short, high-quality content sample (150–250 words) on the given topic.`,
        `The writing should be engaging, specific, and demonstrate editorial quality in ${company.name}'s brand voice.`,
        `Do NOT include a title or heading — just the body content.`,
        `Write with concrete details, specific facts, and an authoritative voice.`,
        `Avoid generic filler, AI-sounding phrases, and vague generalizations.`,
    );

    return sections.join(" ");
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const user = await requireAuth(req, res);
    if (!user) return;

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    const { topic, company_id } = req.body ?? {};

    if (typeof topic !== "string" || topic.trim().length < 3) {
        return res.status(400).json({ error: "topic is required (min 3 characters)" });
    }

    if (typeof company_id !== "string" || !company_id) {
        return res.status(400).json({ error: "company_id is required" });
    }

    // Fetch full company record for brand context
    const { data: companyData, error: companyErr } = await getAdminSupabase()
        .from("companies")
        .select("*")
        .eq("id", company_id)
        .single();

    if (companyErr || !companyData) {
        return res.status(400).json({ error: "Company not found" });
    }

    const systemPrompt = buildBakeoffSystemPrompt(companyData as CompanyRecord);
    const userPrompt = `Topic: "${topic.trim()}"\n\nWrite a short content sample on this topic in ${companyData.name}'s brand voice.`;

    // Run all three models in parallel
    const results = await Promise.allSettled(
        BAKEOFF_MODELS.map(async (m) => {
            const start = Date.now();
            const content = await getTextResponse(m.id, systemPrompt, userPrompt, { temperature: 0.7 });
            const latency_ms = Date.now() - start;
            return {
                model_id: m.id,
                label: m.label,
                provider: m.provider,
                content: content.trim(),
                latency_ms,
            };
        })
    );

    const samples = results.map((r, i) => {
        if (r.status === "fulfilled") {
            return r.value;
        }
        return {
            model_id: BAKEOFF_MODELS[i].id,
            label: BAKEOFF_MODELS[i].label,
            provider: BAKEOFF_MODELS[i].provider,
            content: `Error: ${r.reason?.message || "Model failed to respond"}`,
            latency_ms: 0,
            error: true,
        };
    });

    return res.status(200).json({ samples });
}

