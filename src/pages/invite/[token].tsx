import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function InviteAcceptPage() {
    const router = useRouter();
    const { token } = router.query;

    const [loading, setLoading] = useState(true);
    const [invitation, setInvitation] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [accepting, setAccepting] = useState(false);
    const [accepted, setAccepted] = useState(false);

    // Validate token on mount
    useEffect(() => {
        if (!token || typeof token !== "string") return;

        fetch(`/api/invitations/${token}`)
            .then((r) => r.json())
            .then((data) => {
                if (data.error) {
                    setError(data.error);
                } else {
                    setInvitation(data);
                }
            })
            .catch(() => setError("Failed to validate invitation"))
            .finally(() => setLoading(false));
    }, [token]);

    async function handleAccept(e: React.FormEvent) {
        e.preventDefault();
        if (!token || accepting) return;

        setAccepting(true);
        setError(null);

        try {
            const r = await fetch(`/api/invitations/${token}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    password,
                    full_name: fullName.trim(),
                }),
            });

            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || "Failed to accept");

            setAccepted(true);

            // Sign in
            const { createBrowserSupabase } = await import("@/lib/supabase");
            const supabase = createBrowserSupabase();
            await supabase.auth.signInWithPassword({
                email: invitation.email,
                password,
            });

            setTimeout(() => {
                const target = data.cluster_id
                    ? `/articles?cluster=${data.cluster_id}`
                    : "/articles";
                router.push(target);
            }, 1500);
        } catch (err: any) {
            setError(err.message);
            setAccepting(false);
        }
    }

    return (
        <>
            <Head>
                <title>Accept Invitation — Organic</title>
            </Head>

            <div className="min-h-screen flex items-center justify-center bg-background px-4">
                <div className="w-full max-w-sm">
                    <div className="flex justify-center mb-8">
                        <img
                            src="/organic-logo.png"
                            alt="Organic"
                            className="dark:invert"
                            style={{ height: "32px", width: "auto" }}
                        />
                    </div>

                    <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
                        {loading && (
                            <div className="flex flex-col items-center gap-3 py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                    Validating invitation…
                                </p>
                            </div>
                        )}

                        {!loading && error && !invitation && (
                            <div className="flex flex-col items-center gap-3 py-8 text-center">
                                <XCircle className="h-8 w-8 text-destructive" />
                                <p className="text-sm font-medium">
                                    {error}
                                </p>
                                <Link
                                    href="/login"
                                    className="text-sm text-muted-foreground hover:text-foreground mt-2"
                                >
                                    Go to login →
                                </Link>
                            </div>
                        )}

                        {accepted && (
                            <div className="flex flex-col items-center gap-3 py-8 text-center">
                                <CheckCircle2 className="h-8 w-8 text-green-500" />
                                <h2 className="text-lg font-semibold">
                                    You&apos;re in!
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    {invitation?.cluster_name
                                        ? `Redirecting to the "${invitation.cluster_name}" cluster…`
                                        : "Redirecting to your articles…"}
                                </p>
                            </div>
                        )}

                        {invitation && !accepted && (
                            <>
                                <h1 className="text-xl font-semibold text-center mb-1 tracking-tight">
                                    Join {invitation.account_name}
                                </h1>
                                {invitation.cluster_name ? (
                                    <p className="text-sm text-muted-foreground text-center mb-6">
                                        You&apos;ve been invited to collaborate on the{" "}
                                        <strong>&ldquo;{invitation.cluster_name}&rdquo;</strong>{" "}
                                        content cluster.
                                    </p>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center mb-6">
                                        You&apos;ve been invited as a{" "}
                                        <strong>{invitation.role}</strong> on the{" "}
                                        {invitation.plan} plan.
                                    </p>
                                )}

                                <form
                                    onSubmit={handleAccept}
                                    className="space-y-4"
                                >
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5">
                                            Your name
                                        </label>
                                        <input
                                            type="text"
                                            value={fullName}
                                            onChange={(e) =>
                                                setFullName(e.target.value)
                                            }
                                            placeholder="Jane Smith"
                                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-shadow"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1.5">
                                            Email
                                        </label>
                                        <input
                                            type="email"
                                            value={invitation.email}
                                            disabled
                                            className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1.5">
                                            Create a password
                                        </label>
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) =>
                                                setPassword(e.target.value)
                                            }
                                            placeholder="At least 6 characters"
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
                                        disabled={
                                            accepting || password.length < 6
                                        }
                                        className="w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {accepting
                                            ? "Joining…"
                                            : "Accept invitation"}
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
