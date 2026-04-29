/**
 * GET/PUT /api/account/prompt-engine
 * 
 * GET: Returns the account's base prompt overrides + compiled defaults.
 * PUT: Saves account-level prompt overrides.
 * 
 * The "base" prompts are the default system prompt and user prompt template
 * that apply to all companies under this account. Company-level editorial
 * guidelines, SEO guidelines, and voice profiles are layered on top.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminSupabase } from "@/lib/supabase";
import { requireAuth, getUserAccounts, isPlatformAdmin } from "@/lib/auth";
import { BRAND_ENGINE, compileBlogSystemPrompt } from "@/brand/engine";
import { compileUserPrompt } from "@/lib/compileUserPrompt";

type PromptEngineResponse = {
    base_system_prompt: string | null;
    base_user_prompt: string | null;
    default_system_prompt: string;
    default_user_prompt: string;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const user = await requireAuth(req, res);
    if (!user) return;

    const account_id = req.method === "GET"
        ? (req.query.account_id as string)
        : req.body?.account_id;

    if (!account_id) {
        return res.status(400).json({ error: "account_id is required" });
    }

    // Verify access
    const accounts = await getUserAccounts(user.id);
    const isAdmin = await isPlatformAdmin(user.id);
    const membership = accounts.find((a) => a.account_id === account_id);

    if (!membership && !isAdmin) {
        return res.status(403).json({ error: "Access denied" });
    }

    const admin = getAdminSupabase();

    try {
        if (req.method === "GET") {
            // Fetch current overrides
            const { data, error } = await admin
                .from("accounts")
                .select("base_system_prompt, base_user_prompt")
                .eq("id", account_id)
                .single();

            if (error) throw error;

            // Compile the hardcoded defaults (no company overlays)
            const default_system_prompt = compileBlogSystemPrompt(BRAND_ENGINE);
            const default_user_prompt = compileUserPrompt({
                creation_prompt: "{{ARTICLE_TOPIC}}",
                brand: BRAND_ENGINE,
                word_count: "{{WORD_COUNT}}",
            });

            return res.status(200).json({
                base_system_prompt: data?.base_system_prompt || null,
                base_user_prompt: data?.base_user_prompt || null,
                default_system_prompt,
                default_user_prompt,
            } as PromptEngineResponse);
        }

        if (req.method === "PUT") {
            // Only owners can update
            if (!isAdmin && membership?.role !== "owner" && membership?.role !== "admin") {
                return res.status(403).json({ error: "Only account owners can update prompt settings" });
            }

            const { base_system_prompt, base_user_prompt } = req.body;

            const updates: Record<string, string | null> = {};

            if (base_system_prompt !== undefined) {
                updates.base_system_prompt = typeof base_system_prompt === "string" && base_system_prompt.trim()
                    ? base_system_prompt.trim()
                    : null;
            }

            if (base_user_prompt !== undefined) {
                updates.base_user_prompt = typeof base_user_prompt === "string" && base_user_prompt.trim()
                    ? base_user_prompt.trim()
                    : null;
            }

            if (Object.keys(updates).length === 0) {
                return res.status(400).json({ error: "No fields to update" });
            }

            const { error } = await admin
                .from("accounts")
                .update(updates)
                .eq("id", account_id);

            if (error) throw error;

            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (err) {
        console.error("Account prompt-engine error:", err);
        const message = err instanceof Error ? err.message : "Server error";
        return res.status(500).json({ error: message });
    }
}
