import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import Head from "next/head";

export default function LoginPage() {
    const router = useRouter();
    const { signIn, resetPassword, user } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Forgot-password state
    const [showForgot, setShowForgot] = useState(false);
    const [forgotEmail, setForgotEmail] = useState("");
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotError, setForgotError] = useState<string | null>(null);
    const [forgotSent, setForgotSent] = useState(false);

    // Redirect if already authenticated
    if (user) {
        router.replace("/articles");
        return null;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!email.trim() || !password) return;

        setLoading(true);
        setError(null);

        const result = await signIn(email.trim(), password);
        if (result.error) {
            setError(result.error);
            setLoading(false);
        } else {
            router.push("/articles");
        }
    }

    async function handleForgotSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!forgotEmail.trim()) return;

        setForgotLoading(true);
        setForgotError(null);

        const result = await resetPassword(forgotEmail.trim());
        if (result.error) {
            setForgotError(result.error);
        } else {
            setForgotSent(true);
        }
        setForgotLoading(false);
    }

    return (
        <>
            <Head>
                <title>{showForgot ? "Reset Password" : "Sign In"} — Organic</title>
                <meta
                    name="description"
                    content={showForgot ? "Reset your Organic Brand Studio password." : "Sign in to your Organic Brand Studio account."}
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
                        {showForgot ? (
                            /* ── Forgot Password View ── */
                            forgotSent ? (
                                <div className="text-center">
                                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-6 w-6 text-primary"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                            />
                                        </svg>
                                    </div>
                                    <h1 className="text-xl font-semibold mb-1 tracking-tight">
                                        Check your email
                                    </h1>
                                    <p className="text-sm text-muted-foreground mb-6">
                                        We sent a password reset link to{" "}
                                        <strong className="text-foreground">{forgotEmail}</strong>.
                                        Click the link in the email to set a new password.
                                    </p>
                                    <button
                                        type="button"
                                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                        onClick={() => {
                                            setShowForgot(false);
                                            setForgotSent(false);
                                            setForgotEmail("");
                                            setForgotError(null);
                                        }}
                                    >
                                        ← Back to sign in
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <h1 className="text-xl font-semibold text-center mb-1 tracking-tight">
                                        Reset your password
                                    </h1>
                                    <p className="text-sm text-muted-foreground text-center mb-6">
                                        Enter your email and we&apos;ll send you a reset link.
                                    </p>

                                    <form onSubmit={handleForgotSubmit} className="space-y-4">
                                        <div>
                                            <label
                                                htmlFor="forgot-email"
                                                className="block text-sm font-medium mb-1.5"
                                            >
                                                Email
                                            </label>
                                            <input
                                                id="forgot-email"
                                                type="email"
                                                value={forgotEmail}
                                                onChange={(e) => setForgotEmail(e.target.value)}
                                                placeholder="you@company.com"
                                                required
                                                autoFocus
                                                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-shadow"
                                            />
                                        </div>

                                        {forgotError && (
                                            <p className="text-sm text-destructive">
                                                {forgotError}
                                            </p>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={forgotLoading || !forgotEmail.trim()}
                                            className="w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {forgotLoading ? "Sending…" : "Send reset link"}
                                        </button>
                                    </form>

                                    <div className="mt-4 text-center">
                                        <button
                                            type="button"
                                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                            onClick={() => {
                                                setShowForgot(false);
                                                setForgotError(null);
                                            }}
                                        >
                                            ← Back to sign in
                                        </button>
                                    </div>
                                </>
                            )
                        ) : (
                            /* ── Sign In View ── */
                            <>
                                <h1 className="text-xl font-semibold text-center mb-1 tracking-tight">
                                    Welcome back
                                </h1>
                                <p className="text-sm text-muted-foreground text-center mb-6">
                                    Sign in to your account
                                </p>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label
                                            htmlFor="login-email"
                                            className="block text-sm font-medium mb-1.5"
                                        >
                                            Email
                                        </label>
                                        <input
                                            id="login-email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@company.com"
                                            required
                                            autoFocus
                                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-shadow"
                                        />
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label
                                                htmlFor="login-password"
                                                className="block text-sm font-medium"
                                            >
                                                Password
                                            </label>
                                            <button
                                                type="button"
                                                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                                onClick={() => {
                                                    setShowForgot(true);
                                                    setForgotEmail(email);
                                                }}
                                            >
                                                Forgot password?
                                            </button>
                                        </div>
                                        <input
                                            id="login-password"
                                            type="password"
                                            value={password}
                                            onChange={(e) =>
                                                setPassword(e.target.value)
                                            }
                                            placeholder="••••••••"
                                            required
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
                                        disabled={loading || !email.trim() || !password}
                                        className="w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? "Signing in…" : "Sign in"}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>

                    {/* Register link */}
                    {!showForgot && (
                        <p className="text-center text-sm text-muted-foreground mt-6">
                            Don&apos;t have an account?{" "}
                            <Link
                                href="/register"
                                className="text-foreground font-medium hover:underline"
                            >
                                Get started →
                            </Link>
                        </p>
                    )}
                </div>
            </div>
        </>
    );
}

