import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient, createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextApiRequest, NextApiResponse } from "next";

// ── Environment variables (read lazily to avoid build-time crashes) ─
function getEnv() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    return { url, anonKey, serviceRoleKey };
}

// ── Browser client (for React components) ──────────────────────────
// Uses @supabase/ssr createBrowserClient so the session is stored in
// cookies (not only localStorage) — making it readable by server API
// routes that use createServerSupabase(req, res).
let _browserClient: SupabaseClient | null = null;

export function createBrowserSupabase(): SupabaseClient {
    if (_browserClient) return _browserClient;

    const { url, anonKey } = getEnv();
    if (!url || !anonKey) {
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }

    _browserClient = createBrowserClient(url, anonKey);
    return _browserClient;
}

// ── Server client (for API routes — passes cookies for auth) ───────
export function createServerSupabase(
    req: NextApiRequest,
    res: NextApiResponse
): SupabaseClient {
    const { url, anonKey } = getEnv();
    if (!url || !anonKey) {
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }

    return createServerClient(url, anonKey, {
        cookies: {
            getAll() {
                const cookies: { name: string; value: string }[] = [];
                for (const [name, value] of Object.entries(req.cookies || {})) {
                    if (typeof value === "string") {
                        cookies.push({ name, value });
                    }
                }
                return cookies;
            },
            setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
                for (const { name, value, options } of cookiesToSet) {
                    const parts = [`${name}=${value}`];
                    if (options.path) parts.push(`Path=${options.path}`);
                    if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
                    if (options.domain) parts.push(`Domain=${options.domain}`);
                    if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
                    if (options.secure) parts.push("Secure");
                    if (options.httpOnly) parts.push("HttpOnly");
                    res.setHeader("Set-Cookie", [
                        ...(Array.isArray(res.getHeader("Set-Cookie"))
                            ? (res.getHeader("Set-Cookie") as string[])
                            : res.getHeader("Set-Cookie")
                                ? [res.getHeader("Set-Cookie") as string]
                                : []),
                        parts.join("; "),
                    ]);
                }
            },
        },
    });
}

// ── Admin client (service_role key — bypasses RLS) ─────────────────
let _adminClient: SupabaseClient | null = null;

export function getAdminSupabase(): SupabaseClient {
    if (_adminClient) return _adminClient;

    const { url, anonKey, serviceRoleKey } = getEnv();
    if (!url) {
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
    }

    // Use service role key if available, otherwise fall back to anon key
    const key = serviceRoleKey || anonKey;
    if (!key) {
        throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }

    _adminClient = createClient(url, key, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
    return _adminClient;
}

// ── Backwards-compatible export ────────────────────────────────────
// Existing API routes use getSupabase(). During migration this maps to
// the admin client so they keep working until each route is converted
// to use createServerSupabase(req, res) for auth-aware access.
export function getSupabase(): SupabaseClient {
    return getAdminSupabase();
}
