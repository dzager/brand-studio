import { getSupabase } from "@/lib/supabase";

export async function compileGlobalFeedback(companyId: string): Promise<string> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from("company_feedback")
        .select("body")
        .eq("company_id", companyId)
        .eq("applied_to_model", true)
        .order("created_at", { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) return "";

    const bullets = data.map((row) => `- ${row.body}`).join("\n");

    return `\n\n## USER FEEDBACK DIRECTIVES\nThe following feedback from content reviewers MUST be incorporated into all content generated for this brand:\n${bullets}`;
}
