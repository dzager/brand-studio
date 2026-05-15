/**
 * POST /api/auth/register
 *
 * Creates a new user, account, company, and initial usage period.
 * Optionally sends invitations to team members.
 * Optionally processes brand images to extract image style categories.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminSupabase } from "@/lib/supabase";
import { getPlanLimits, isValidPlan, type PlanId } from "@/lib/plans";
import { getOpenAIClient } from "@/lib/ai-client";
import slugify from "slugify";

export const config = {
    api: {
        bodyParser: {
            sizeLimit: "50mb", // allow base64 brand images
        },
    },
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { email, password, full_name, company, plan, invite_emails, brand_images } =
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

        // ── 7. Process brand images (async, fire-and-forget) ────────
        if (Array.isArray(brand_images) && brand_images.length > 0) {
            const companyId = newCompany.id;
            extractBrandImageStyles(brand_images, companyId, admin)
                .then((count) => {
                    console.log(`[register] ✅ Extracted ${count} image style(s) for company ${companyId}`);
                })
                .catch((err) => {
                    console.error(`[register] Image style extraction failed for ${companyId}:`, err);
                });
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

// ── Image Style Extraction ─────────────────────────────────────────────

type ImageStyleAnalysis = {
    style_name: string;
    image_prompt_style: string;
    narrative: string;
    storytelling_cues: string[];
};

/**
 * Analyzes uploaded brand images via GPT vision and saves the extracted
 * image style categories to the company record. Processes images sequentially
 * to avoid rate-limiting, with individual error isolation.
 */
async function extractBrandImageStyles(
    images: string[],
    companyId: string,
    admin: ReturnType<typeof getAdminSupabase>
): Promise<number> {
    const client = getOpenAIClient();
    const extracted: Array<{
        id: string;
        label: string;
        narrative: string;
        storytelling_cues: string[];
        image_prompt_style: string;
    }> = [];

    const systemPrompt = `You are a world-class art director analyzing brand reference images. Extract the visual style characteristics and produce a JSON object with:
{
  "style_name": "A concise 2-4 word name for this visual style",
  "image_prompt_style": "A comprehensive prompt paragraph (150-300 words) capturing ALL visual characteristics optimized for AI image generation — color, lighting, lens, film stock, mood, composition, post-processing.",
  "narrative": "A 1-2 sentence description of the overall visual story.",
  "storytelling_cues": ["array of 4-8 short phrases describing visual storytelling elements"]
}
Be extremely specific and technical. Return ONLY the JSON object.`;

    for (const imageData of images.slice(0, 6)) {
        try {
            // Normalize data URI
            let base64Data = imageData;
            let mimeType = "image/png";
            const match = imageData.match(/^data:(image\/\w+);base64,(.+)$/);
            if (match) {
                mimeType = match[1];
                base64Data = match[2];
            }

            const response = await client.chat.completions.create({
                model: "gpt-5.4",
                messages: [
                    { role: "system", content: systemPrompt },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Analyze this brand reference image and extract its visual style." },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${mimeType};base64,${base64Data}`,
                                    detail: "high",
                                },
                            },
                        ],
                    },
                ],
                temperature: 0.4,
                response_format: { type: "json_object" },
            });

            const raw = response.choices?.[0]?.message?.content ?? "";
            const parsed = JSON.parse(raw) as ImageStyleAnalysis;

            if (parsed.image_prompt_style && parsed.style_name) {
                const id = parsed.style_name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "_")
                    .replace(/^_|_$/g, "");

                extracted.push({
                    id,
                    label: parsed.style_name,
                    narrative: parsed.narrative || "",
                    storytelling_cues: parsed.storytelling_cues || [],
                    image_prompt_style: parsed.image_prompt_style,
                });
            }
        } catch (err) {
            console.warn(`[register] Skipping image style extraction (parse/API error):`, err instanceof Error ? err.message : err);
        }
    }

    if (extracted.length > 0) {
        const { error } = await admin
            .from("companies")
            .update({ image_style_categories: extracted })
            .eq("id", companyId);

        if (error) {
            console.error(`[register] Failed to save image styles for ${companyId}:`, error);
        }
    }

    return extracted.length;
}
