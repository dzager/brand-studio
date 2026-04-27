/**
 * POST /api/auth/register
 *
 * Creates a new user, account, company, and initial usage period.
 * Optionally sends invitations to team members.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminSupabase } from "@/lib/supabase";
import { getPlanLimits, isValidPlan, type PlanId } from "@/lib/plans";
import slugify from "slugify";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { email, password, full_name, company, plan, invite_emails } =
        req.body;

    // ── Validate inputs ────────────────────────────────────────────
    if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ error: "Valid email is required" });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
        return res
            .status(400)
            .json({ error: "Password must be at least 6 characters" });
    }
    if (
        !company?.name ||
        typeof company.name !== "string" ||
        company.name.trim().length < 1
    ) {
        return res.status(400).json({ error: "Company name is required" });
    }

    const selectedPlan: PlanId = isValidPlan(plan) ? plan : "starter";
    const planLimits = getPlanLimits(selectedPlan);

    const admin = getAdminSupabase();

    try {
        // ── 1. Create Supabase auth user ───────────────────────────
        const { data: authData, error: authError } =
            await admin.auth.admin.createUser({
                email: email.trim().toLowerCase(),
                password,
                email_confirm: true, // auto-confirm for now
                user_metadata: {
                    full_name: full_name?.trim() || "",
                },
            });

        if (authError) {
            // Handle duplicate email
            if (
                authError.message
                    .toLowerCase()
                    .includes("already been registered")
            ) {
                return res
                    .status(409)
                    .json({ error: "An account with this email already exists. Please sign in." });
            }
            throw authError;
        }

        const userId = authData.user.id;

        // ── 2. Create account ──────────────────────────────────────
        const accountSlug = slugify(company.name.trim(), {
            lower: true,
            strict: true,
            trim: true,
        });

        // Ensure slug uniqueness by appending a suffix if needed
        let finalSlug = accountSlug;
        const { data: existingSlug } = await admin
            .from("accounts")
            .select("id")
            .eq("slug", accountSlug)
            .single();

        if (existingSlug) {
            finalSlug = `${accountSlug}-${Date.now().toString(36)}`;
        }

        const { data: account, error: accountError } = await admin
            .from("accounts")
            .insert({
                name: company.name.trim(),
                slug: finalSlug,
                plan: selectedPlan,
                plan_started_at: new Date().toISOString(),
                stripe_status: "trialing",
            })
            .select()
            .single();

        if (accountError) throw accountError;

        // ── 3. Create account_members row (owner) ──────────────────
        const { error: memberError } = await admin
            .from("account_members")
            .insert({
                account_id: account.id,
                user_id: userId,
                role: "owner",
                accepted_at: new Date().toISOString(),
            });

        if (memberError) throw memberError;

        // ── 4. Create company ──────────────────────────────────────
        const { data: newCompany, error: companyError } = await admin
            .from("companies")
            .insert({
                name: company.name.trim(),
                tagline: company.tagline?.trim() || null,
                mission: company.mission?.trim() || null,
                tone: company.tone?.trim() || "confident, clear, modern",
                archetype: "guide",
                account_id: account.id,
            })
            .select()
            .single();

        if (companyError) throw companyError;

        // ── 4b. Scope owner to their company ───────────────────────
        // Set company_id on the account_members row so the owner is
        // restricted to only the company they just created.
        const { error: scopeError } = await admin
            .from("account_members")
            .update({ company_id: newCompany.id })
            .eq("account_id", account.id)
            .eq("user_id", userId);

        if (scopeError) {
            console.warn("Failed to scope owner to company:", scopeError);
        }

        // ── 5. Create initial usage period ─────────────────────────
        const today = new Date();
        const periodStart = today.toISOString().split("T")[0];

        await admin.from("account_usage").insert({
            account_id: account.id,
            period_start: periodStart,
            articles_limit: planLimits.articles_per_month,
            articles_used: 0,
            overage_count: 0,
        });

        // ── 6. Send invitations (if any) ───────────────────────────
        if (Array.isArray(invite_emails) && invite_emails.length > 0) {
            const invitations = invite_emails
                .filter(
                    (e: string) =>
                        e &&
                        typeof e === "string" &&
                        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())
                )
                .slice(0, planLimits.max_seats - 1) // Don't exceed plan seats
                .map((e: string) => ({
                    account_id: account.id,
                    email: e.trim().toLowerCase(),
                    role: "member" as const,
                    invited_by: userId,
                }));

            if (invitations.length > 0) {
                await admin.from("invitations").insert(invitations);
            }
        }

        return res.status(201).json({
            user_id: userId,
            account_id: account.id,
            company_id: newCompany.id,
            plan: selectedPlan,
        });
    } catch (err) {
        console.error("Registration error:", err);
        const message =
            err instanceof Error ? err.message : "Registration failed";
        return res.status(500).json({ error: message });
    }
}
