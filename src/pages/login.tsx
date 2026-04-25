import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import Head from "next/head";

export default function LoginPage() {
    const router = useRouter();
    const { signIn, user } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Redirect if already authenticated
    if (user) {
        router.replace("/studio");
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
            router.push("/studio");
        }
    }

    return (
        <>
            <Head>
                <title>Sign In — Organic</title>
                <meta
                    name="description"
                    content="Sign in to your Organic Brand Studio account."
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
                                            // TODO: Implement forgot password flow
                                            alert(
                                                "Password reset will be available soon."
                                            );
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
                    </div>

                    {/* Register link */}
                    <p className="text-center text-sm text-muted-foreground mt-6">
                        Don&apos;t have an account?{" "}
                        <Link
                            href="/register"
                            className="text-foreground font-medium hover:underline"
                        >
                            Get started →
                        </Link>
                    </p>
                </div>
            </div>
        </>
    );
}
