import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient, createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextApiRequest, NextApiResponse } from "next";

// ── Environment variables ──────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Browser client (for React components) ──────────────────────────
// Uses @supabase/ssr createBrowserClient so the session is stored in
// cookies (not only localStorage) — making it readable by server API
// routes that use createServerSupabase(req, res).
let _browserClient: SupabaseClient | null = null;

export function createBrowserSupabase(): SupabaseClient {
    if (_browserClient) return _browserClient;

    if (!SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }

    _browserClient = createBrowserClient(SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY);
    return _browserClient;
}

// ── Server client (for API routes — passes cookies for auth) ───────
export function createServerSupabase(
    req: NextApiRequest,
    res: NextApiResponse
): SupabaseClient {
    if (!SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }

    return createServerClient(SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
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

    if (!SUPABASE_URL) {
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
    }

    // Use service role key if available, otherwise fall back to anon key
    const key = SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!key) {
        throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }

    _adminClient = createClient(SUPABASE_URL, key, {
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
