import { useState, useEffect, useCallback } from "react";

const GATE_KEY = "organic_gate_unlocked";

export default function GateModal({ children }: { children: React.ReactNode }) {
    const [unlocked, setUnlocked] = useState(true); // default true to avoid flash
    const [mounted, setMounted] = useState(false);
    const [email, setEmail] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [inputBuffer, setInputBuffer] = useState("");

    useEffect(() => {
        setMounted(true);
        const stored = localStorage.getItem(GATE_KEY);
        setUnlocked(stored === "true");
    }, []);

    // Listen for secret code "PSL" (case-insensitive)
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (unlocked) return;
            const key = e.key.toUpperCase();
            if (key.length === 1 && /[A-Z]/.test(key)) {
                setInputBuffer((prev) => {
                    const next = (prev + key).slice(-3);
                    if (next === "PSL") {
                        localStorage.setItem(GATE_KEY, "true");
                        setUnlocked(true);
                    }
                    return next;
                });
            }
        },
        [unlocked]
    );

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!email.trim() || submitting) return;
        setSubmitting(true);
        setError(null);

        try {
            const r = await fetch("/api/waitlist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim() }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || "Submission failed");
            setSubmitted(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    // Don't render anything until mounted (avoids flash)
    if (!mounted) return null;

    // If unlocked, render children directly
    if (unlocked) return <>{children}</>;

    return (
        <>
            {/* Blurred background */}
            <div
                style={{
                    filter: "blur(8px)",
                    pointerEvents: "none",
                    userSelect: "none",
                    opacity: 0.3,
                }}
            >
                {children}
            </div>

            {/* Modal overlay */}
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 9999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(26, 31, 29, 0.65)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                }}
            >
                <div
                    style={{
                        width: "100%",
                        maxWidth: 420,
                        margin: "0 24px",
                        borderRadius: 16,
                        padding: "40px 32px",
                        background: "#ffffff",
                        border: "1px solid #E5E5E5",
                        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
                        textAlign: "center",
                    }}
                >
                    {/* Logo */}
                    <div style={{ marginBottom: 24 }}>
                        <img
                            src="/organic-logo.png"
                            alt="Organic"
                            style={{
                                height: 28,
                                margin: "0 auto",
                                display: "block",
                                filter: "var(--gate-logo-filter, none)",
                            }}
                        />
                    </div>

                    {!submitted ? (
                        <>
                            <h2
                                style={{
                                    fontSize: 22,
                                    fontWeight: 700,
                                    letterSpacing: "-0.02em",
                                    margin: "0 0 8px",
                                    color: "#1A1F1D",
                                }}
                            >
                                Join the Waitlist
                            </h2>
                            <p
                                style={{
                                    fontSize: 14,
                                    color: "#6b7280",
                                    margin: "0 0 24px",
                                    lineHeight: 1.5,
                                }}
                            >
                                Organic is currently in private beta. Enter your email to
                                get early access.
                            </p>

                            <form onSubmit={onSubmit}>
                                <input
                                    type="email"
                                    placeholder="you@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoFocus
                                    style={{
                                        width: "100%",
                                        boxSizing: "border-box",
                                        padding: "12px 16px",
                                        borderRadius: 10,
                                        border: "1px solid #E5E5E5",
                                        background: "#f9f8f6",
                                        color: "#1A1F1D",
                                        fontSize: 14,
                                        outline: "none",
                                        marginBottom: 12,
                                        transition: "border-color 0.15s",
                                    }}
                                    onFocus={(e) =>
                                        (e.target.style.borderColor =
                                            "#C8DEF0")
                                    }
                                    onBlur={(e) =>
                                        (e.target.style.borderColor =
                                            "#E5E5E5")
                                    }
                                />
                                <button
                                    type="submit"
                                    disabled={submitting || !email.trim()}
                                    style={{
                                        width: "100%",
                                        padding: "12px 16px",
                                        borderRadius: 10,
                                        border: "none",
                                        background: "#1A1F1D",
                                        color: "#ffffff",
                                        fontSize: 14,
                                        fontWeight: 600,
                                        cursor:
                                            submitting || !email.trim()
                                                ? "not-allowed"
                                                : "pointer",
                                        opacity:
                                            submitting || !email.trim() ? 0.5 : 1,
                                        transition: "opacity 0.15s, transform 0.1s",
                                    }}
                                >
                                    {submitting ? "Submitting…" : "Get Early Access"}
                                </button>
                            </form>

                            {error && (
                                <p
                                    style={{
                                        marginTop: 12,
                                        fontSize: 13,
                                        color: "var(--destructive, #e53e3e)",
                                    }}
                                >
                                    {error}
                                </p>
                            )}
                        </>
                    ) : (
                        <>
                            <div
                                style={{
                                    fontSize: 48,
                                    marginBottom: 16,
                                    lineHeight: 1,
                                }}
                            >
                                🎉
                            </div>
                            <h2
                                style={{
                                    fontSize: 22,
                                    fontWeight: 700,
                                    letterSpacing: "-0.02em",
                                    margin: "0 0 8px",
                                    color: "#1A1F1D",
                                }}
                            >
                                Thank You!
                            </h2>
                            <p
                                style={{
                                    fontSize: 14,
                                    color: "#6b7280",
                                    margin: 0,
                                    lineHeight: 1.5,
                                }}
                            >
                                You&apos;re on the list. We&apos;ll reach out when
                                it&apos;s your turn.
                            </p>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
