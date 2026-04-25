import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { PLAN_LIMITS, type PlanId } from "@/lib/plans";
import {
    DollarSign,
    Users,
    Building2,
    FileText,
    TrendingUp,
    AlertTriangle,
    ExternalLink,
    ChevronRight,
    X,
    Loader2,
    Receipt,
    Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface DashboardStats {
    mrr: number;
    totalAccounts: number;
    activeSubscriptions: number;
    totalArticlesThisMonth: number;
    totalOverageThisMonth: number;
    overageRevenueThisMonth: number;
    totalMembers: number;
    totalCompanies: number;
}

interface AccountRow {
    id: string;
    name: string;
    slug: string;
    plan: string;
    stripe_status: string;
    stripe_customer_id: string | null;
    member_count: number;
    company_count: number;
    articles_used: number;
    articles_limit: number;
    overage_count: number;
    overage_cost: number;
    mrr: number;
    created_at: string;
}

interface AccountDetail {
    account: any;
    members: any[];
    companies: any[];
    usage_history: any[];
    invitations: any[];
}

export default function AdminDashboard() {
    const { isAdmin, loading: authLoading } = useAuth();
    const router = useRouter();

    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [accounts, setAccounts] = useState<AccountRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
    const [detail, setDetail] = useState<AccountDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Redirect non-admins
    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.replace("/studio");
        }
    }, [authLoading, isAdmin, router]);

    // Fetch dashboard data
    useEffect(() => {
        if (!isAdmin) return;

        async function fetchData() {
            try {
                const [statsRes, accountsRes] = await Promise.all([
                    fetch("/api/admin/dashboard"),
                    fetch("/api/admin/accounts"),
                ]);

                const [statsData, accountsData] = await Promise.all([
                    statsRes.json(),
                    accountsRes.json(),
                ]);

                setStats(statsData);
                setAccounts(accountsData);
            } catch (err) {
                console.error("Failed to load admin data:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [isAdmin]);

    // Fetch account detail
    async function openDetail(accountId: string) {
        setSelectedAccount(accountId);
        setDetailLoading(true);
        try {
            const r = await fetch(`/api/admin/accounts/${accountId}`);
            const data = await r.json();
            setDetail(data);
        } catch {
            setDetail(null);
        } finally {
            setDetailLoading(false);
        }
    }

    // Admin actions
    async function handleAdminAction(
        accountId: string,
        action: string,
        extra?: Record<string, any>
    ) {
        try {
            const r = await fetch(`/api/admin/accounts/${accountId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, ...extra }),
            });
            const data = await r.json();
            if (!r.ok) {
                alert(data.error || "Action failed");
                return;
            }
            // Refresh
            if (selectedAccount === accountId) {
                openDetail(accountId);
            }
            // Re-fetch accounts list
            const accountsRes = await fetch("/api/admin/accounts");
            setAccounts(await accountsRes.json());
        } catch (err) {
            console.error("Admin action failed:", err);
        }
    }

    if (authLoading || (!isAdmin && !authLoading)) {
        return null;
    }

    const statusColor = (status: string) => {
        switch (status) {
            case "active":
                return "bg-green-500/10 text-green-700 dark:text-green-400";
            case "trialing":
                return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
            case "past_due":
                return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
            case "cancelled":
                return "bg-red-500/10 text-red-700 dark:text-red-400";
            default:
                return "bg-muted text-muted-foreground";
        }
    };

    return (
        <AppLayout fullWidth>
            <Head>
                <title>Admin Dashboard — Organic</title>
            </Head>

            <div className="space-y-8">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Platform Dashboard
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Revenue, accounts, and usage across all customers.
                    </p>
                </div>

                {/* ── Stats Cards ───────────────────────────────────── */}
                {loading ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => (
                            <div
                                key={i}
                                className="rounded-xl border border-border bg-card p-5 animate-pulse"
                            >
                                <div className="h-3 w-20 bg-muted rounded mb-3" />
                                <div className="h-7 w-24 bg-muted rounded" />
                            </div>
                        ))}
                    </div>
                ) : stats ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard
                            icon={DollarSign}
                            label="MRR"
                            value={`$${stats.mrr.toLocaleString()}`}
                            accent="text-green-600"
                        />
                        <StatCard
                            icon={Building2}
                            label="Total Accounts"
                            value={stats.totalAccounts.toString()}
                        />
                        <StatCard
                            icon={FileText}
                            label="Articles This Month"
                            value={stats.totalArticlesThisMonth.toString()}
                        />
                        <StatCard
                            icon={TrendingUp}
                            label="Overage Revenue"
                            value={`$${stats.overageRevenueThisMonth.toFixed(2)}`}
                            accent="text-amber-600"
                        />
                    </div>
                ) : null}

                {/* ── Accounts Table ────────────────────────────────── */}
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="px-5 py-4 border-b border-border">
                        <h2 className="font-semibold text-sm">All Accounts</h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">
                                        Account
                                    </th>
                                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">
                                        Plan
                                    </th>
                                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">
                                        Status
                                    </th>
                                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">
                                        Usage
                                    </th>
                                    <th className="text-right px-3 py-3 font-medium text-muted-foreground">
                                        Overage
                                    </th>
                                    <th className="text-right px-3 py-3 font-medium text-muted-foreground">
                                        Members
                                    </th>
                                    <th className="text-right px-3 py-3 font-medium text-muted-foreground">
                                        MRR
                                    </th>
                                    <th className="text-right px-5 py-3 font-medium text-muted-foreground">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {accounts.map((account) => {
                                    const pct = Math.min(
                                        100,
                                        Math.round(
                                            (account.articles_used /
                                                account.articles_limit) *
                                                100
                                        )
                                    );
                                    return (
                                        <tr
                                            key={account.id}
                                            className="border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors cursor-pointer"
                                            onClick={() =>
                                                openDetail(account.id)
                                            }
                                        >
                                            <td className="px-5 py-3 font-medium">
                                                {account.name}
                                            </td>
                                            <td className="px-3 py-3">
                                                <Badge
                                                    variant="outline"
                                                    className="text-xs capitalize"
                                                >
                                                    {account.plan}
                                                </Badge>
                                            </td>
                                            <td className="px-3 py-3">
                                                <span
                                                    className={cn(
                                                        "text-xs font-medium px-2 py-0.5 rounded-full capitalize",
                                                        statusColor(
                                                            account.stripe_status
                                                        )
                                                    )}
                                                >
                                                    {account.stripe_status}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                                                        <div
                                                            className={cn(
                                                                "h-full rounded-full transition-all",
                                                                pct >= 90
                                                                    ? "bg-red-500"
                                                                    : pct >= 70
                                                                      ? "bg-amber-500"
                                                                      : "bg-green-500"
                                                            )}
                                                            style={{
                                                                width: `${pct}%`,
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {account.articles_used}/
                                                        {account.articles_limit}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                {account.overage_count > 0 ? (
                                                    <span className="text-amber-600 font-medium">
                                                        {
                                                            account.overage_count
                                                        }{" "}
                                                        ($
                                                        {account.overage_cost.toFixed(
                                                            2
                                                        )}
                                                        )
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">
                                                        —
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                {account.member_count}
                                            </td>
                                            <td className="px-3 py-3 text-right font-medium">
                                                $
                                                {account.mrr.toLocaleString()}
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <ChevronRight className="h-4 w-4 text-muted-foreground inline-block" />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ── Account Detail Slide-out ──────────────────────── */}
                {selectedAccount && (
                    <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-background border-l border-border shadow-2xl z-50 overflow-y-auto">
                        <div className="flex items-center justify-between px-6 h-14 border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm">
                            <h3 className="font-semibold text-sm">
                                Account Details
                            </h3>
                            <button
                                onClick={() => {
                                    setSelectedAccount(null);
                                    setDetail(null);
                                }}
                                className="rounded-md p-1.5 hover:bg-muted transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {detailLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : detail ? (
                            <div className="px-6 py-6 space-y-6">
                                {/* Account info */}
                                <div>
                                    <h4 className="text-lg font-semibold">
                                        {detail.account.name}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge
                                            variant="outline"
                                            className="capitalize"
                                        >
                                            {detail.account.plan}
                                        </Badge>
                                        <span
                                            className={cn(
                                                "text-xs font-medium px-2 py-0.5 rounded-full capitalize",
                                                statusColor(
                                                    detail.account
                                                        .stripe_status
                                                )
                                            )}
                                        >
                                            {detail.account.stripe_status}
                                        </span>
                                    </div>
                                </div>

                                {/* Stripe link */}
                                {detail.account.stripe_customer_id && (
                                    <a
                                        href={`https://dashboard.stripe.com/customers/${detail.account.stripe_customer_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <ExternalLink className="h-3 w-3" />
                                        View in Stripe Dashboard
                                    </a>
                                )}

                                <Separator />

                                {/* Usage history */}
                                <div>
                                    <h5 className="text-sm font-medium mb-3">
                                        Usage History
                                    </h5>
                                    <div className="space-y-2">
                                        {detail.usage_history.map(
                                            (u: any) => (
                                                <div
                                                    key={u.id}
                                                    className="flex items-center justify-between text-sm"
                                                >
                                                    <span className="text-muted-foreground">
                                                        {u.period_start}
                                                    </span>
                                                    <span>
                                                        {u.articles_used}/
                                                        {u.articles_limit}
                                                        {u.overage_count >
                                                            0 && (
                                                            <span className="text-amber-600 ml-2">
                                                                +
                                                                {
                                                                    u.overage_count
                                                                }{" "}
                                                                overage
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            )
                                        )}
                                        {detail.usage_history.length ===
                                            0 && (
                                            <p className="text-sm text-muted-foreground">
                                                No usage data yet.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <Separator />

                                {/* Members */}
                                <div>
                                    <h5 className="text-sm font-medium mb-3">
                                        Members ({detail.members.length})
                                    </h5>
                                    <div className="space-y-2">
                                        {detail.members.map((m: any) => (
                                            <div
                                                key={m.id}
                                                className="flex items-center justify-between text-sm"
                                            >
                                                <div>
                                                    <span className="font-medium">
                                                        {m.full_name ||
                                                            m.email}
                                                    </span>
                                                    {m.full_name && (
                                                        <span className="text-muted-foreground ml-2">
                                                            {m.email}
                                                        </span>
                                                    )}
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className="text-xs capitalize"
                                                >
                                                    {m.role}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <Separator />

                                {/* Companies */}
                                <div>
                                    <h5 className="text-sm font-medium mb-3">
                                        Companies (
                                        {detail.companies.length})
                                    </h5>
                                    <div className="space-y-1">
                                        {detail.companies.map((c: any) => (
                                            <div
                                                key={c.id}
                                                className="text-sm"
                                            >
                                                {c.name}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <Separator />

                                {/* Admin Actions */}
                                <div>
                                    <h5 className="text-sm font-medium mb-3">
                                        Admin Actions
                                    </h5>
                                    <div className="flex flex-wrap gap-2">
                                        {detail.account.stripe_status !==
                                            "cancelled" && (
                                            <button
                                                onClick={() =>
                                                    handleAdminAction(
                                                        detail.account.id,
                                                        "suspend"
                                                    )
                                                }
                                                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                                            >
                                                Suspend Account
                                            </button>
                                        )}
                                        {detail.account.stripe_status ===
                                            "cancelled" && (
                                            <button
                                                onClick={() =>
                                                    handleAdminAction(
                                                        detail.account.id,
                                                        "reactivate"
                                                    )
                                                }
                                                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-green-500/10 hover:text-green-700 hover:border-green-500/30 transition-colors"
                                            >
                                                Reactivate
                                            </button>
                                        )}
                                        <button
                                            onClick={() =>
                                                handleAdminAction(
                                                    detail.account.id,
                                                    "trigger-overage-invoice"
                                                )
                                            }
                                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-amber-500/10 hover:text-amber-700 hover:border-amber-500/30 transition-colors flex items-center gap-1"
                                        >
                                            <Receipt className="h-3 w-3" />
                                            Invoice Overage
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (!confirm(`Permanently delete "${detail.account.name}"? This will remove all members, usage history, and invitations. This cannot be undone.`)) return;
                                                await handleAdminAction(detail.account.id, "delete");
                                                setSelectedAccount(null);
                                                setDetail(null);
                                            }}
                                            className="rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 hover:border-destructive/50 transition-colors flex items-center gap-1"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                            Delete Account
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

// ── Stat Card Component ────────────────────────────────────────────
function StatCard({
    icon: Icon,
    label,
    value,
    accent,
}: {
    icon: any;
    label: string;
    value: string;
    accent?: string;
}) {
    return (
        <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-2">
                <Icon
                    className={cn(
                        "h-4 w-4",
                        accent || "text-muted-foreground"
                    )}
                />
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    {label}
                </span>
            </div>
            <div className={cn("text-2xl font-bold tracking-tight", accent)}>
                {value}
            </div>
        </div>
    );
}
