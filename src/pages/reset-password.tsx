import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/hooks/useAuth";
import Head from "next/head";

export default function ResetPasswordPage() {
    const router = useRouter();
    const { updatePassword, user } = useAuth();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [ready, setReady] = useState(false);

    // Wait for Supabase to process the recovery token from the URL hash.
    // The auth listener in useAuth will fire a PASSWORD_RECOVERY event and
    // set the user session automatically. We just need to wait for `user`
    // to become available (or time out).
    useEffect(() => {
        // Give Supabase up to 3 seconds to exchange the token
        const timer = setTimeout(() => setReady(true), 1500);
        if (user) {
            setReady(true);
            clearTimeout(timer);
        }
        return () => clearTimeout(timer);
    }, [user]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);

        const result = await updatePassword(password);
        if (result.error) {
            setError(result.error);
            setLoading(false);
        } else {
            setSuccess(true);
            setLoading(false);
            // Redirect to the app after a brief pause
            setTimeout(() => router.push("/articles"), 2000);
        }
    }

    return (
        <>
            <Head>
                <title>Set New Password — Organic</title>
                <meta
                    name="description"
                    content="Set a new password for your Organic Brand Studio account."
                />
            </Head>

            <div className="min-h-screen flex items-center justify-center bg-background px-4">
                <div className="w-full max-w-sm">
                    {/* Logo */}
                    <div className="flex justify-center mb-8">
                        <a href="/index.html">
                            <img
                                src="/organic-logo.png"
                                alt="Organic"
                                className="dark:invert"
                                style={{ height: "32px", width: "auto" }}
                            />
                        </a>
                    </div>

                    {/* Card */}
                    <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
                        {success ? (
                            /* ── Success View ── */
                            <div className="text-center">
                                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-6 w-6 text-green-600"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                </div>
                                <h1 className="text-xl font-semibold mb-1 tracking-tight">
                                    Password updated
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    Your password has been changed successfully.
                                    Redirecting…
                                </p>
                            </div>
                        ) : !ready ? (
                            /* ── Loading View ── */
                            <div className="text-center py-4">
                                <p className="text-sm text-muted-foreground">
                                    Verifying reset link…
                                </p>
                            </div>
                        ) : !user ? (
                            /* ── Invalid / Expired Link View ── */
                            <div className="text-center">
                                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-6 w-6 text-destructive"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                                        />
                                    </svg>
                                </div>
                                <h1 className="text-xl font-semibold mb-1 tracking-tight">
                                    Invalid or expired link
                                </h1>
                                <p className="text-sm text-muted-foreground mb-6">
                                    This password reset link is no longer valid.
                                    Please request a new one.
                                </p>
                                <a
                                    href="/login"
                                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    ← Back to sign in
                                </a>
                            </div>
                        ) : (
                            /* ── New Password Form ── */
                            <>
                                <h1 className="text-xl font-semibold text-center mb-1 tracking-tight">
                                    Set a new password
                                </h1>
                                <p className="text-sm text-muted-foreground text-center mb-6">
                                    Enter your new password below.
                                </p>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label
                                            htmlFor="new-password"
                                            className="block text-sm font-medium mb-1.5"
                                        >
                                            New password
                                        </label>
                                        <input
                                            id="new-password"
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            required
                                            minLength={8}
                                            autoFocus
                                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-shadow"
                                        />
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Must be at least 8 characters
                                        </p>
                                    </div>

                                    <div>
                                        <label
                                            htmlFor="confirm-password"
                                            className="block text-sm font-medium mb-1.5"
                                        >
                                            Confirm password
                                        </label>
                                        <input
                                            id="confirm-password"
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="••••••••"
                                            required
                                            minLength={8}
                                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-shadow"
                                        />
                                    </div>

                                    {error && (
                                        <p className="text-sm text-destructive">
                                            {error}
                                        </p>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={loading || !password || !confirmPassword}
                                        className="w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? "Updating…" : "Update password"}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
