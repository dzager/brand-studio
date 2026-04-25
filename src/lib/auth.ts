/**
 * Server-side auth utilities for API routes.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { createServerSupabase, getAdminSupabase } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────
export interface AuthUser {
    id: string;
    email: string;
}

export interface UserAccount {
    account_id: string;
    account_name: string;
    account_slug: string;
    plan: string;
    role: string;
    stripe_status: string | null;
    company_id: string | null;
}

// ── Get current authenticated user ─────────────────────────────────
export async function getCurrentUser(
    req: NextApiRequest,
    res: NextApiResponse
): Promise<AuthUser | null> {
    const supabase = createServerSupabase(req, res);
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;
    return { id: user.id, email: user.email || "" };
}

// ── Get the user's accounts and roles ──────────────────────────────
export async function getUserAccounts(userId: string): Promise<UserAccount[]> {
    const admin = getAdminSupabase();
    const { data, error } = await admin
        .from("account_members")
        .select(
            `
            account_id,
            role,
            company_id,
            accounts:account_id (
                name,
                slug,
                plan,
                stripe_status
            )
        `
        )
        .eq("user_id", userId);

    if (error || !data) return [];

    return data.map((row: any) => ({
        account_id: row.account_id,
        role: row.role,
        company_id: row.company_id || null,
        account_name: row.accounts?.name || "",
        account_slug: row.accounts?.slug || "",
        plan: row.accounts?.plan || "starter",
        stripe_status: row.accounts?.stripe_status || null,
    }));
}

// ── Check if user is a platform admin ──────────────────────────────
export async function isPlatformAdmin(userId: string): Promise<boolean> {
    const admin = getAdminSupabase();
    const { data } = await admin
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", userId)
        .single();

    return !!data;
}

// ── Middleware: require authentication ──────────────────────────────
export async function requireAuth(
    req: NextApiRequest,
    res: NextApiResponse
): Promise<AuthUser | null> {
    const user = await getCurrentUser(req, res);
    if (!user) {
        res.status(401).json({ error: "Authentication required" });
        return null;
    }
    return user;
}

// ── Middleware: require specific role ───────────────────────────────
// Checks if user has any of the given roles in any of their accounts,
// OR is a platform admin.
export async function requireRole(
    req: NextApiRequest,
    res: NextApiResponse,
    roles: string[]
): Promise<{ user: AuthUser; accounts: UserAccount[] } | null> {
    const user = await requireAuth(req, res);
    if (!user) return null;

    // Platform admins always pass
    if (await isPlatformAdmin(user.id)) {
        const accounts = await getUserAccounts(user.id);
        return { user, accounts };
    }

    const accounts = await getUserAccounts(user.id);
    const hasRole = accounts.some((a) => roles.includes(a.role));

    if (!hasRole) {
        res.status(403).json({ error: "Insufficient permissions" });
        return null;
    }

    return { user, accounts };
}

// ── Get a specific account for the user ────────────────────────────
// Used when the request includes an account_id to verify access.
export async function getUserAccountById(
    userId: string,
    accountId: string
): Promise<UserAccount | null> {
    // Platform admins can access any account
    if (await isPlatformAdmin(userId)) {
        const admin = getAdminSupabase();
        const { data } = await admin
            .from("accounts")
            .select("id, name, slug, plan, stripe_status")
            .eq("id", accountId)
            .single();

        if (!data) return null;
        return {
            account_id: data.id,
            account_name: data.name,
            account_slug: data.slug,
            plan: data.plan,
            role: "admin",
            stripe_status: data.stripe_status,
            company_id: null,
        };
    }

    const accounts = await getUserAccounts(userId);
    return accounts.find((a) => a.account_id === accountId) || null;
}
