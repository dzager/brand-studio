import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const user = await requireAuth(req, res);
    if (!user) return;

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const supabase = getSupabase();

    try {
        const { id, persona_id } = req.body;

        if (!id || !persona_id) {
            return res.status(400).json({ error: "id and persona_id are required" });
        }

        const { data: feedback, error: fbErr } = await supabase
            .from("company_feedback")
            .select("body")
            .eq("id", id)
            .single();

        if (fbErr) throw fbErr;

        const { data: persona, error: pErr } = await supabase
            .from("company_prompts")
            .select("body")
            .eq("id", persona_id)
            .single();

        if (pErr) throw pErr;

        const updatedBody = persona.body + `\n\n---\n## User Feedback\n${feedback.body}`;

        const { error: updateErr } = await supabase
            .from("company_prompts")
            .update({ body: updatedBody })
            .eq("id", persona_id);

        if (updateErr) throw updateErr;

        const { error: linkErr } = await supabase
            .from("company_feedback")
            .update({ applied_to_persona_id: persona_id })
            .eq("id", id);

        if (linkErr) throw linkErr;

        return res.status(200).json({ ok: true, persona_id });
    } catch (err) {
        console.error("API /api/feedback/apply-to-persona error:", err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
