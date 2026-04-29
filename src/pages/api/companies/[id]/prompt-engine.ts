import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";
import { buildBrandEngine, type CompanyRecord } from "@/lib/buildBrandEngine";
import { compileBlogSystemPrompt } from "@/brand/engine";
import { compileUserPrompt } from "@/lib/compileUserPrompt";

type PromptEngineResponse = {
    system_prompt: string;
    user_prompt_template: string;
    has_account_override: boolean;
};

type ErrorResponse = {
    error: string;
};

/**
 * GET /api/companies/[id]/prompt-engine
 * Returns the compiled blog system prompt and user prompt template for a company.
 * Includes account-level base prompt overrides if set, with company-level
 * editorial guidelines, SEO guidelines, and voice profile layered on top.
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<PromptEngineResponse | ErrorResponse>
) {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { id } = req.query;
    if (typeof id !== "string") {
        return res.status(400).json({ error: "Invalid company id" });
    }

    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed. Use GET." });
    }

    try {
        const { data: companyData, error: companyErr } = await getSupabase()
            .from("companies")
            .select("*")
            .eq("id", id)
            .single();

        if (companyErr || !companyData) {
            return res.status(404).json({ error: "Company not found" });
        }

        const brand = buildBrandEngine(companyData as CompanyRecord);

        // Fetch account-level base prompt overrides
        let baseSystemPromptOverride: string | undefined;
        let hasAccountOverride = false;
        if (companyData.account_id) {
            try {
                const { data: acctData } = await getSupabase()
                    .from("accounts")
                    .select("base_system_prompt")
                    .eq("id", companyData.account_id)
                    .single();
                if (acctData?.base_system_prompt) {
                    baseSystemPromptOverride = acctData.base_system_prompt;
                    hasAccountOverride = true;
                }
            } catch {
                // Non-blocking
            }
        }

        const system_prompt = compileBlogSystemPrompt(brand, { baseOverride: baseSystemPromptOverride });

        // Build the user prompt template with a placeholder topic
        const user_prompt_template = compileUserPrompt({
            creation_prompt: "{{ARTICLE_TOPIC}}",
            brand,
            word_count: "{{WORD_COUNT}}",
        });

        return res.status(200).json({
            system_prompt,
            user_prompt_template,
            has_account_override: hasAccountOverride,
        });
    } catch (err) {
        console.error(`API /api/companies/${id}/prompt-engine error:`, err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
