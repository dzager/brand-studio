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
    Search,
    Shield,
    ShieldCheck,
    Mail,
    Calendar,
    UserX,
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

interface UserRow {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string | null;
    created_at: string;
    last_sign_in_at: string | null;
    email_confirmed_at: string | null;
    is_platform_admin: boolean;
    accounts: {
        role: string;
        account_id: string;
        account_name: string;
        plan: string;
    }[];
}

type AdminTab = "accounts" | "users";

export default function AdminDashboard() {
    const { isAdmin, loading: authLoading } = useAuth();
    const router = useRouter();

    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [accounts, setAccounts] = useState<AccountRow[]>([]);
    const [users, setUsers] = useState<UserRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
    const [detail, setDetail] = useState<AccountDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<AdminTab>("accounts");
    const [userSearch, setUserSearch] = useState("");
    const [deletingUser, setDeletingUser] = useState<string | null>(null);

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
                const [statsRes, accountsRes, usersRes] = await Promise.all([
                    fetch("/api/admin/dashboard"),
                    fetch("/api/admin/accounts"),
                    fetch("/api/admin/users"),
                ]);

                const [statsData, accountsData, usersData] = await Promise.all([
                    statsRes.json(),
                    accountsRes.json(),
                    usersRes.json(),
                ]);

                setStats(statsData);
                setAccounts(accountsData);
                if (Array.isArray(usersData)) setUsers(usersData);
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

    async function handleDeleteUser(userId: string, email: string) {
        if (!confirm(`Permanently delete user "${email}"? This removes all memberships and cannot be undone.`)) return;
        setDeletingUser(userId);
        try {
            const r = await fetch(`/api/admin/users?id=${userId}`, { method: "DELETE" });
            const data = await r.json();
            if (!r.ok) { alert(data.error || "Delete failed"); return; }
            setUsers((prev) => prev.filter((u) => u.id !== userId));
        } catch (err) {
            console.error("Delete user failed:", err);
        } finally {
            setDeletingUser(null);
        }
    }

    async function handleToggleAdmin(userId: string, currentlyAdmin: boolean) {
        // Toggle platform_admin status via a simple fetch
        // We'll need a small API for this — for now just update local state
        // This is handled server-side through supabase directly
        alert(currentlyAdmin ? "Remove admin via Supabase dashboard" : "Add admin via Supabase dashboard");
    }

    const filteredUsers = users.filter((u) => {
        if (!userSearch) return true;
        const q = userSearch.toLowerCase();
        return (
            u.email.toLowerCase().includes(q) ||
            u.full_name.toLowerCase().includes(q) ||
            u.accounts.some((a) => a.account_name.toLowerCase().includes(q))
        );
    });

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

                {/* ── Tab Navigation ────────────────────────────────── */}
                <div className="flex items-center gap-1 border-b border-border">
                    <button
                        onClick={() => setActiveTab("accounts")}
                        className={cn(
                            "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                            activeTab === "accounts"
                                ? "border-foreground text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Building2 className="h-3.5 w-3.5 inline-block mr-1.5 -mt-0.5" />
                        Accounts
                    </button>
                    <button
                        onClick={() => setActiveTab("users")}
                        className={cn(
                            "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                            activeTab === "users"
                                ? "border-foreground text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Users className="h-3.5 w-3.5 inline-block mr-1.5 -mt-0.5" />
                        Users
                        <span className="ml-1.5 text-xs text-muted-foreground">({users.length})</span>
                    </button>
                </div>

                {/* ── Accounts Table ────────────────────────────────── */}
                {activeTab === "accounts" && (
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
                )}

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

                {/* ── Users Table ──────────────────────────────────── */}
                {activeTab === "users" && (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                        <h2 className="font-semibold text-sm">All Users</h2>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search by name, email, or account…"
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                                className="pl-9 pr-3 py-1.5 text-sm rounded-lg border border-border bg-background w-72 focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">User</th>
                                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">Account(s)</th>
                                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">Role</th>
                                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">Status</th>
                                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">Last Login</th>
                                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">Joined</th>
                                    <th className="text-right px-5 py-3 font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map((u) => (
                                    <tr key={u.id} className="border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors">
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                                                    {(u.full_name || u.email).charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-medium truncate">
                                                        {u.full_name || "—"}
                                                        {u.is_platform_admin && (
                                                            <span title="Platform Admin"><ShieldCheck className="h-3.5 w-3.5 inline-block ml-1.5 text-amber-500" /></span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3">
                                            {u.accounts.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {u.accounts.map((a, i) => (
                                                        <Badge key={i} variant="outline" className="text-xs">
                                                            {a.account_name || "Unnamed"}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">No account</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3">
                                            {u.accounts.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {u.accounts.map((a, i) => (
                                                        <span key={i} className="text-xs capitalize text-muted-foreground">{a.role}</span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">—</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3">
                                            {u.email_confirmed_at ? (
                                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-700 dark:text-green-400">Confirmed</span>
                                            ) : (
                                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400">Pending</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                            {u.last_sign_in_at
                                                ? (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span>
                                                            {new Date(u.last_sign_in_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                                            {" "}
                                                            {new Date(u.last_sign_in_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground/70">{formatRelativeTime(u.last_sign_in_at)}</span>
                                                    </div>
                                                )
                                                : <span className="text-muted-foreground/50 italic">Never</span>}
                                        </td>
                                        <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                            {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <button
                                                onClick={() => handleDeleteUser(u.id, u.email)}
                                                disabled={deletingUser === u.id}
                                                className="rounded-md p-1.5 hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-40"
                                                title="Delete user"
                                            >
                                                {deletingUser === u.id ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredUsers.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground text-sm">
                                            {userSearch ? "No users match your search." : "No users found."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                )}

            </div>
        </AppLayout>
    );
}

// ── Relative Time Formatter ─────────────────────────────────────────
function formatRelativeTime(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
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
