import type { NextApiRequest, NextApiResponse } from "next";
import { createServerSupabase, getAdminSupabase } from "@/lib/supabase";
import { requireAuth, getUserAccounts, isPlatformAdmin, getUserAccountById } from "@/lib/auth";
import { getPlanLimits } from "@/lib/plans";
import { generateBrandDefaults } from "@/lib/generateBrandDefaults";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const user = await requireAuth(req, res);
    if (!user) return;

    // Use auth-aware client for RLS-scoped queries
    const supabase = createServerSupabase(req, res);
    const admin = getAdminSupabase();

    try {
        if (req.method === "GET") {
            // Check if this user is scoped to specific companies via any membership
            const isAdmin = await isPlatformAdmin(user.id);
            const accounts = await getUserAccounts(user.id);

            // Collect all explicit company_id scopes across memberships
            const scopedCompanyIds = accounts
                .filter((a) => a.company_id)
                .map((a) => a.company_id!);

            // DEBUG: trace company scoping
            console.log("[companies/GET] user:", user.email, "| isAdmin:", isAdmin, "| accounts:", accounts.map(a => ({ role: a.role, company_id: a.company_id, account_name: a.account_name })), "| scopedCompanyIds:", scopedCompanyIds);

            // If any membership has a company_id set, restrict to those companies
            if (!isAdmin && scopedCompanyIds.length > 0) {
                console.log("[companies/GET] SCOPED — returning only:", scopedCompanyIds);
                const { data, error } = await admin
                    .from("companies")
                    .select("*")
                    .in("id", scopedCompanyIds)
                    .order("created_at", { ascending: false });

                if (error) throw error;
                return res.status(200).json(data || []);
            }

            // If user is not an admin, scope to companies belonging to their accounts
            if (!isAdmin) {
                const accountIds = accounts.map((a) => a.account_id);
                console.log("[companies/GET] ACCOUNT-SCOPED — returning companies for accounts:", accountIds);
                const { data, error } = await admin
                    .from("companies")
                    .select("*")
                    .in("account_id", accountIds)
                    .order("created_at", { ascending: false });

                if (error) throw error;
                return res.status(200).json(data || []);
            }

            console.log("[companies/GET] ADMIN — returning all companies");
            // Platform admins see all companies
            const { data, error } = await supabase
                .from("companies")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            return res.status(200).json(data);
        }

        if (req.method === "POST") {
            // Determine which account to create the company under
            const accountId = req.body.account_id;
            let targetAccountId = accountId;

            if (!targetAccountId) {
                // Use the user's first account
                const accounts = await getUserAccounts(user.id);
                if (accounts.length === 0) {
                    return res.status(400).json({ error: "No account found. Please complete registration." });
                }
                targetAccountId = accounts[0].account_id;
            }

            // Verify access to this account
            const account = await getUserAccountById(user.id, targetAccountId);
            if (!account) {
                return res.status(403).json({ error: "Access denied to this account" });
            }

            // Only owners and admins can create companies
            if (account.role !== "owner" && account.role !== "admin") {
                return res.status(403).json({ error: "Only account owners can add companies" });
            }

            // Check domain (company) limit
            const { count: companyCount } = await admin
                .from("companies")
                .select("*", { count: "exact", head: true })
                .eq("account_id", targetAccountId);

            const limits = getPlanLimits(account.plan);
            if (limits.max_domains !== Infinity && (companyCount || 0) >= limits.max_domains) {
                return res.status(403).json({
                    error: `Your ${limits.label} plan allows up to ${limits.max_domains} companies. Upgrade to add more.`,
                });
            }

            const {
                name,
                tagline,
                mission,
                archetype,
                tone,
                target_audiences,
                photography_style,
                color_primary,
                color_secondary,
                avoid_phrases,
                image_style_categories,
                voice_profile,
                editorial_guidelines,
                seo_content_guidelines,
                reference_articles,
                evals,
                auto_humanize,
                include_toc,
            } = req.body;

            if (!name || typeof name !== "string" || name.trim().length < 1) {
                return res.status(400).json({ error: "Company name is required" });
            }

            const insertPayload: Record<string, unknown> = {
                name: name.trim(),
                tagline: tagline?.trim() || null,
                mission: mission?.trim() || null,
                archetype: archetype?.trim() || "guide",
                tone: tone?.trim() || "confident, clear, modern",
                target_audiences: target_audiences ?? [],
                photography_style: photography_style?.trim() || null,
                color_primary: color_primary?.trim() || "#000000",
                color_secondary: color_secondary?.trim() || "#FFFFFF",
                avoid_phrases: avoid_phrases?.trim() || null,
                account_id: targetAccountId,
            };
            if (image_style_categories !== undefined) {
                insertPayload.image_style_categories = image_style_categories ?? null;
            }
            if (voice_profile !== undefined) {
                insertPayload.voice_profile = voice_profile ?? null;
            }
            if (editorial_guidelines !== undefined) {
                insertPayload.editorial_guidelines = editorial_guidelines?.trim() || null;
            }
            if (seo_content_guidelines !== undefined) {
                insertPayload.seo_content_guidelines = seo_content_guidelines?.trim() || null;
            }
            if (reference_articles !== undefined) {
                insertPayload.reference_articles = reference_articles ?? null;
            }
            if (evals !== undefined) {
                insertPayload.evals = evals ?? null;
            }
            if (auto_humanize !== undefined) {
                insertPayload.auto_humanize = auto_humanize ?? true;
            }
            if (include_toc !== undefined) {
                insertPayload.include_toc = include_toc ?? false;
            }

            // Use admin client for insert since the user may not have INSERT policy
            const { data, error } = await admin
                .from("companies")
                .insert(insertPayload)
                .select()
                .single();

            if (error) throw error;

            // ── Async Brand Defaults Generation ─────────────────────────
            // If any of editorial guidelines, SEO guidelines, or voice profile
            // is empty, generate best-in-class defaults in the background.
            // Only writes the fields that were originally missing.
            const missingEditorial = !insertPayload.editorial_guidelines;
            const missingSeo = !insertPayload.seo_content_guidelines;
            const missingVoice = !insertPayload.voice_profile;
            const needsDefaults = missingEditorial || missingSeo || missingVoice;

            if (needsDefaults && data?.id) {
                const companyId = data.id;
                // Fire-and-forget — don't block the response
                generateBrandDefaults({
                    name: name.trim(),
                    tagline: tagline?.trim() || null,
                    mission: mission?.trim() || null,
                    archetype: archetype?.trim() || "guide",
                    tone: tone?.trim() || "confident, clear, modern",
                    target_audiences: target_audiences ?? [],
                    photography_style: photography_style?.trim() || null,
                    avoid_phrases: avoid_phrases?.trim() || null,
                })
                    .then(async (defaults) => {
                        // Only write fields that were originally missing
                        const updatePayload: Record<string, unknown> = {};
                        if (missingEditorial) updatePayload.editorial_guidelines = defaults.editorial_guidelines;
                        if (missingSeo) updatePayload.seo_content_guidelines = defaults.seo_content_guidelines;
                        if (missingVoice) updatePayload.voice_profile = defaults.voice_profile;

                        const { error: updateErr } = await admin
                            .from("companies")
                            .update(updatePayload)
                            .eq("id", companyId);

                        if (updateErr) {
                            console.error(`[companies/POST] Failed to save brand defaults for ${companyId}:`, updateErr);
                        } else {
                            console.log(`[companies/POST] ✅ Brand defaults generated and saved for ${companyId} (editorial: ${missingEditorial}, seo: ${missingSeo}, voice: ${missingVoice})`);
                        }
                    })
                    .catch((err) => {
                        console.error(`[companies/POST] Brand defaults generation failed for ${companyId}:`, err);
                    });
            }

            return res.status(201).json({
                ...data,
                _generating_defaults: needsDefaults,
            });
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (err) {
        console.error("API /api/companies error:", err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
