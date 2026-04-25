/**
 * Client-side auth hook for React components.
 * Provides user state, account context, and auth actions.
 */
import {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useMemo,
    type ReactNode,
} from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────────────────────
export interface UserAccount {
    account_id: string;
    account_name: string;
    account_slug: string;
    plan: string;
    role: string;
    stripe_status: string | null;
    company_id: string | null;
}

interface AuthState {
    user: User | null;
    accounts: UserAccount[];
    activeAccount: UserAccount | null;
    isAdmin: boolean;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error?: string }>;
    signUp: (
        email: string,
        password: string,
        fullName?: string
    ) => Promise<{ error?: string }>;
    signOut: () => Promise<void>;
    switchAccount: (accountId: string) => void;
}

const ACTIVE_ACCOUNT_KEY = "organic_active_account_id";

const AuthContext = createContext<AuthState>({
    user: null,
    accounts: [],
    activeAccount: null,
    isAdmin: false,
    loading: true,
    signIn: async () => ({}),
    signUp: async () => ({}),
    signOut: async () => {},
    switchAccount: () => {},
});

// ── Provider ───────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [accounts, setAccounts] = useState<UserAccount[]>([]);
    const [activeAccount, setActiveAccount] = useState<UserAccount | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    // Stable reference — createBrowserSupabase() returns a singleton, but
    // useMemo ensures React's dependency checks see the same object identity.
    const supabase = useMemo(() => createBrowserSupabase(), []);

    // Fetch account memberships + admin status via server-side API.
    // This uses the service-role Supabase client on the server, avoiding
    // client-side RLS timing issues with the platform_admins table.
    const fetchAccounts = useCallback(
        async (_userId: string) => {
            try {
                const res = await fetch("/api/auth/me", { credentials: "include" });
                if (!res.ok) {
                    console.warn("Failed to fetch /api/auth/me:", res.status);
                    return;
                }

                const data = await res.json();
                const mapped: UserAccount[] = data.accounts || [];

                setAccounts(mapped);

                // Restore active account from localStorage
                const savedId = localStorage.getItem(ACTIVE_ACCOUNT_KEY);
                const saved = mapped.find((a) => a.account_id === savedId);
                setActiveAccount(saved || mapped[0] || null);

                setIsAdmin(!!data.isAdmin);
            } catch (err) {
                console.error("Failed to fetch accounts:", err);
            }
        },
        []
    );

    // Initialize auth state — run exactly once on mount
    useEffect(() => {
        let mounted = true;

        async function init() {
            try {
                // Race getSession() against a 5 s timeout — BroadcastChannel
                // interference (e.g. browser extensions) can cause it to hang
                // indefinitely, leaving the AuthGuard stuck on "Loading…".
                const sessionResult = await Promise.race([
                    supabase.auth.getSession(),
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error("auth_timeout")), 5000)
                    ),
                ]);

                const { data: { session } } = sessionResult as Awaited<ReturnType<typeof supabase.auth.getSession>>;

                if (session?.user && mounted) {
                    setUser(session.user);
                    await fetchAccounts(session.user.id);
                }
            } catch (err) {
                // Swallow BroadcastChannel / cross-tab errors and timeouts gracefully
                const msg = err instanceof Error ? err.message : String(err);
                if (msg !== "auth_timeout") {
                    console.warn("Auth init warning:", err);
                }
            }

            if (mounted) setLoading(false);
        }

        init();

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;

            if (session?.user) {
                setUser(session.user);
                await fetchAccounts(session.user.id);
            } else {
                setUser(null);
                setAccounts([]);
                setActiveAccount(null);
                setIsAdmin(false);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auth actions
    const signIn = useCallback(
        async (email: string, password: string) => {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) return { error: error.message };
            return {};
        },
        [supabase]
    );

    const signUp = useCallback(
        async (email: string, password: string, fullName?: string) => {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: fullName },
                },
            });
            if (error) return { error: error.message };
            return {};
        },
        [supabase]
    );

    const signOut = useCallback(async () => {
        await supabase.auth.signOut();
        localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
        setUser(null);
        setAccounts([]);
        setActiveAccount(null);
        setIsAdmin(false);
        window.location.href = "/login";
    }, [supabase]);

    const switchAccount = useCallback(
        (accountId: string) => {
            const account = accounts.find((a) => a.account_id === accountId);
            if (account) {
                setActiveAccount(account);
                localStorage.setItem(ACTIVE_ACCOUNT_KEY, accountId);
            }
        },
        [accounts]
    );

    return (
        <AuthContext.Provider
            value={{
                user,
                accounts,
                activeAccount,
                isAdmin,
                loading,
                signIn,
                signUp,
                signOut,
                switchAccount,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

// ── Hook ───────────────────────────────────────────────────────────
export function useAuth() {
    return useContext(AuthContext);
}
