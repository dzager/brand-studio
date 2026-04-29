import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useModelDefaults } from "@/hooks/useModelDefaults";
import type { ModelDefaults } from "@/hooks/useModelDefaults";
import { useAuth } from "@/hooks/useAuth";
import { PLAN_LIMITS, type PlanId } from "@/lib/plans";
import {
    RotateCcw,
    Pen,
    ImageIcon,
    Zap,
    CreditCard,
    ExternalLink,
    Loader2,
    TrendingUp,
    AlertTriangle,
    ArrowUpRight,
    Building2,
    Users,
    UserPlus,
    Trash2,
    Check,
    X,
    Cpu,
    Copy,
    CheckCircle2,
    AlertCircle,
    Info,
} from "lucide-react";

type ModelInfo = {
    id: string;
    label: string;
    provider: string;
    capabilities: string[];
};

const CATEGORIES: {
    key: keyof ModelDefaults;
    label: string;
    description: string;
    icon: React.ReactNode;
    capability: string;
}[] = [
    {
        key: "writing",
        label: "Writing",
        description: "Article generation, humanization, shortening",
        icon: <Pen className="h-4 w-4" />,
        capability: "writing",
    },
    {
        key: "imageGeneration",
        label: "Image Generation",
        description: "AI image creation and compositing",
        icon: <ImageIcon className="h-4 w-4" />,
        capability: "imageGeneration",
    },
    {
        key: "utility",
        label: "Utility",
        description: "Prompt generation, style recommendation, interlinking",
        icon: <Zap className="h-4 w-4" />,
        capability: "utility",
    },
];

// ── Types ──────────────────────────────────────────────────────────
interface UsageSummary {
    plan: PlanId;
    planLabel: string;
    articlesUsed: number;
    articlesLimit: number;
    overage: number;
    overagePrice: number;
    overageCost: number;
    periodStart: string;
    percentUsed: number;
}

interface MemberInfo {
    id: string;
    user_id: string;
    role: string;
    company_id: string | null;
    email: string;
    full_name: string;
}

interface InvitationInfo {
    id: string;
    email: string;
    role: string;
    created_at: string;
}

export default function SettingsDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { defaults, setDefault, resetDefaults, FACTORY_DEFAULTS } = useModelDefaults();
    const { activeAccount } = useAuth();
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [usage, setUsage] = useState<UsageSummary | null>(null);
    const [usageLoading, setUsageLoading] = useState(false);
    const [billingLoading, setBillingLoading] = useState<string | null>(null);
    const [billingError, setBillingError] = useState<string | null>(null);

    // Account tab state
    const [acctName, setAcctName] = useState("");
    const [acctSlug, setAcctSlug] = useState("");
    const [acctSaving, setAcctSaving] = useState(false);
    const [acctError, setAcctError] = useState<string | null>(null);
    const [acctSuccess, setAcctSuccess] = useState(false);
    const [members, setMembers] = useState<MemberInfo[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [invitations, setInvitations] = useState<InvitationInfo[]>([]);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviting, setInviting] = useState(false);
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [removingMember, setRemovingMember] = useState<string | null>(null);
    const [companyList, setCompanyList] = useState<{ id: string; name: string }[]>([]);
    const [assigningCompany, setAssigningCompany] = useState<string | null>(null);

    // Prompt Engine tab state
    const [peLoading, setPeLoading] = useState(false);
    const [peSaving, setPeSaving] = useState(false);
    const [peError, setPeError] = useState<string | null>(null);
    const [peSaved, setPeSaved] = useState(false);
    const [peActiveTab, setPeActiveTab] = useState<"system" | "user">("system");
    const [peSystemPrompt, setPeSystemPrompt] = useState("");
    const [peUserPrompt, setPeUserPrompt] = useState("");
    const [peDefaultSystem, setPeDefaultSystem] = useState("");
    const [peDefaultUser, setPeDefaultUser] = useState("");
    const [peCopiedId, setPeCopiedId] = useState<string | null>(null);
    const [peLoaded, setPeLoaded] = useState(false);

    // Fetch models
    useEffect(() => {
        if (!open) return;
        fetch("/api/models")
            .then((r) => r.json())
            .then((data) => {
                if (data?.models && Array.isArray(data.models)) {
                    setModels(data.models);
                }
            })
            .catch(() => {});
    }, [open]);

    // Populate account fields when dialog opens
    useEffect(() => {
        if (open && activeAccount) {
            setAcctName(activeAccount.account_name);
            setAcctSlug(activeAccount.account_slug);
            setAcctError(null);
            setAcctSuccess(false);
        }
    }, [open, activeAccount]);

    // Fetch members + invitations
    const fetchMembers = useCallback(async () => {
        if (!activeAccount?.account_id) return;
        setMembersLoading(true);
        try {
            const [mRes, iRes] = await Promise.all([
                fetch(`/api/account/members?account_id=${activeAccount.account_id}`),
                fetch(`/api/invitations?account_id=${activeAccount.account_id}`),
            ]);
            if (mRes.ok) setMembers(await mRes.json());
            if (iRes.ok) setInvitations(await iRes.json());

            // Fetch companies for assignment dropdown
            const cRes = await fetch("/api/companies");
            if (cRes.ok) {
                const cData = await cRes.json();
                if (Array.isArray(cData)) setCompanyList(cData.map((c: any) => ({ id: c.id, name: c.name })));
            }
        } catch {}
        finally { setMembersLoading(false); }
    }, [activeAccount?.account_id]);

    useEffect(() => { if (open) fetchMembers(); }, [open, fetchMembers]);

    async function handleSaveAccount() {
        if (!activeAccount?.account_id) return;
        setAcctSaving(true); setAcctError(null); setAcctSuccess(false);
        try {
            const r = await fetch("/api/account/update", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ account_id: activeAccount.account_id, name: acctName, slug: acctSlug }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || "Update failed");
            setAcctSuccess(true);
            setTimeout(() => setAcctSuccess(false), 3000);
        } catch (err: any) { setAcctError(err.message); }
        finally { setAcctSaving(false); }
    }

    async function handleInvite() {
        if (!activeAccount?.account_id || !inviteEmail.trim()) return;
        setInviting(true); setInviteError(null);
        try {
            const r = await fetch("/api/invitations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ account_id: activeAccount.account_id, email: inviteEmail.trim(), role: "member" }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || "Invite failed");
            setInviteEmail("");
            fetchMembers();
        } catch (err: any) { setInviteError(err.message); }
        finally { setInviting(false); }
    }

    async function handleRemoveMember(memberId: string) {
        if (!activeAccount?.account_id) return;
        setRemovingMember(memberId);
        try {
            const r = await fetch("/api/account/members", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ account_id: activeAccount.account_id, member_id: memberId }),
            });
            if (!r.ok) { const d = await r.json(); throw new Error(d?.error || "Remove failed"); }
            fetchMembers();
        } catch (err: any) { alert(err.message); }
        finally { setRemovingMember(null); }
    }

    // Fetch usage
    const fetchUsage = useCallback(async () => {
        if (!activeAccount?.account_id) return;
        setUsageLoading(true);
        try {
            const r = await fetch(
                `/api/account/usage?account_id=${activeAccount.account_id}`
            );
            if (r.ok) {
                const data = await r.json();
                setUsage(data);
            }
        } catch {
            // ignore
        } finally {
            setUsageLoading(false);
        }
    }, [activeAccount?.account_id]);

    useEffect(() => {
        if (open) fetchUsage();
    }, [open, fetchUsage]);

    // Billing actions
    async function handleBillingAction(action: string, plan?: string) {
        if (!activeAccount?.account_id) return;
        setBillingLoading(action);
        setBillingError(null);

        try {
            const r = await fetch("/api/account/billing", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action,
                    account_id: activeAccount.account_id,
                    plan,
                }),
            });

            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || "Action failed");

            if (data.url) {
                window.location.href = data.url;
            } else {
                // Refresh usage after plan change
                await fetchUsage();
            }
        } catch (err: any) {
            setBillingError(err.message);
        } finally {
            setBillingLoading(null);
        }
    }

    function modelsForCategory(capability: string) {
        return models.filter((m) => m.capabilities?.includes(capability));
    }

    function isDefault(key: keyof ModelDefaults) {
        return defaults[key] === FACTORY_DEFAULTS[key];
    }

    const currentPlan = (usage?.plan || activeAccount?.plan || "starter") as PlanId;
    const currentLimits = PLAN_LIMITS[currentPlan];
    const percentUsed = usage?.percentUsed ?? 0;
    const usageColor =
        percentUsed >= 100
            ? "text-destructive"
            : percentUsed >= 80
              ? "text-amber-500"
              : "text-primary";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Settings
                    </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="account" className="w-full flex-1 flex flex-col min-h-0" onValueChange={(val) => {
                    if (val === "prompts" && !peLoaded && activeAccount?.account_id) {
                        setPeLoading(true);
                        setPeError(null);
                        fetch(`/api/account/prompt-engine?account_id=${activeAccount.account_id}`)
                            .then((r) => r.json())
                            .then((data) => {
                                if (data.error) throw new Error(data.error);
                                setPeSystemPrompt(data.base_system_prompt || "");
                                setPeUserPrompt(data.base_user_prompt || "");
                                setPeDefaultSystem(data.default_system_prompt);
                                setPeDefaultUser(data.default_user_prompt);
                                setPeLoaded(true);
                            })
                            .catch((e) => setPeError(e.message))
                            .finally(() => setPeLoading(false));
                    }
                }}>
                    <TabsList className="w-full shrink-0">
                        <TabsTrigger value="account" className="flex-1 gap-1.5">
                            <Building2 className="h-3.5 w-3.5" />
                            Account
                        </TabsTrigger>
                        <TabsTrigger value="models" className="flex-1 gap-1.5">
                            <Zap className="h-3.5 w-3.5" />
                            Models
                        </TabsTrigger>
                        <TabsTrigger value="billing" className="flex-1 gap-1.5">
                            <CreditCard className="h-3.5 w-3.5" />
                            Billing
                        </TabsTrigger>
                        <TabsTrigger value="prompts" className="flex-1 gap-1.5">
                            <Cpu className="h-3.5 w-3.5" />
                            Prompts
                        </TabsTrigger>
                    </TabsList>

                    {/* ═══════ Account Tab ═══════ */}
                    <TabsContent value="account" className="flex-1 flex flex-col min-h-0">
                        <div className="flex-1 overflow-y-auto space-y-5 py-2 pr-1">
                            {/* Account Details */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Account Details
                                </h3>
                                <div className="space-y-2">
                                    <div className="space-y-1">
                                        <Label htmlFor="acct-name" className="text-xs">Account Name</Label>
                                        <Input id="acct-name" value={acctName} onChange={(e) => setAcctName(e.target.value)} placeholder="My Company" className="text-sm" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="acct-slug" className="text-xs">Slug</Label>
                                        <Input id="acct-slug" value={acctSlug} onChange={(e) => setAcctSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="my-company" className="text-sm font-mono" />
                                        <p className="text-[11px] text-muted-foreground">Lowercase letters, numbers, and hyphens only.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button size="sm" onClick={handleSaveAccount} disabled={acctSaving || !acctName.trim()}>
                                        {acctSaving ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Saving…</> : acctSuccess ? <><Check className="h-3 w-3 mr-1" /> Saved</> : "Save Changes"}
                                    </Button>
                                    {acctError && <span className="text-xs text-destructive">{acctError}</span>}
                                    {acctSuccess && <span className="text-xs text-green-600">Updated successfully</span>}
                                </div>
                            </div>

                            <Separator />

                            {/* Team Members */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <Users className="h-3.5 w-3.5" /> Team Members
                                </h3>
                                {membersLoading ? (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                                        <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {members.map((m) => (
                                            <div key={m.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <span className="font-medium">{m.full_name || m.email}</span>
                                                    {m.full_name && <span className="text-muted-foreground ml-1.5 text-xs">{m.email}</span>}
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {m.role === "member" && companyList.length > 0 && (
                                                        <select
                                                            value={m.company_id || ""}
                                                            onChange={async (e) => {
                                                                const newCompanyId = e.target.value || null;
                                                                setAssigningCompany(m.id);
                                                                try {
                                                                    const r = await fetch("/api/account/members", {
                                                                        method: "PUT",
                                                                        headers: { "Content-Type": "application/json" },
                                                                        body: JSON.stringify({ account_id: activeAccount?.account_id, member_id: m.id, company_id: newCompanyId }),
                                                                    });
                                                                    if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
                                                                    setMembers((prev) => prev.map((x) => x.id === m.id ? { ...x, company_id: newCompanyId } : x));
                                                                } catch (err: any) { alert(err.message); }
                                                                finally { setAssigningCompany(null); }
                                                            }}
                                                            disabled={assigningCompany === m.id}
                                                            className="text-[11px] rounded border border-border bg-background px-1.5 py-0.5 max-w-[140px]"
                                                            title="Assign to company"
                                                        >
                                                            <option value="">All companies</option>
                                                            {companyList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                        </select>
                                                    )}
                                                    <Badge variant="outline" className="text-[10px] capitalize">{m.role}</Badge>
                                                    {m.role !== "owner" && (
                                                        <button onClick={() => handleRemoveMember(m.id)} disabled={removingMember === m.id} className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50" title="Remove member">
                                                            {removingMember === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {members.length === 0 && <p className="text-xs text-muted-foreground">No members found.</p>}
                                    </div>
                                )}

                                {/* Pending invitations */}
                                {invitations.length > 0 && (
                                    <div className="space-y-1.5">
                                        <p className="text-[11px] text-muted-foreground font-medium">Pending Invitations</p>
                                        {invitations.map((inv) => (
                                            <div key={inv.id} className="flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-2 text-sm">
                                                <span className="text-muted-foreground">{inv.email}</span>
                                                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">Pending</Badge>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Invite form */}
                                <div className="flex gap-2">
                                    <Input placeholder="Email address" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }} className="text-sm flex-1" />
                                    <Button variant="outline" size="sm" onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} className="gap-1 whitespace-nowrap">
                                        <UserPlus className="h-3.5 w-3.5" />
                                        {inviting ? "Inviting…" : "Invite"}
                                    </Button>
                                </div>
                                {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}
                            </div>
                        </div>

                        <DialogFooter className="shrink-0">
                            <Button onClick={() => onOpenChange(false)}>Done</Button>
                        </DialogFooter>
                    </TabsContent>

                    {/* ═══════ Models Tab ═══════ */}
                    <TabsContent value="models" className="flex-1 flex flex-col min-h-0">
                        <div className="flex-1 overflow-y-auto space-y-5 py-2 pr-1">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Default Models
                            </h3>

                            {CATEGORIES.map((cat, i) => {
                                const available = modelsForCategory(cat.capability);
                                const currentValue = defaults[cat.key];

                                return (
                                    <div key={cat.key}>
                                        {i > 0 && <Separator className="mb-4" />}
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-muted-foreground">{cat.icon}</span>
                                                <Label className="text-sm font-medium">{cat.label}</Label>
                                                {!isDefault(cat.key) && (
                                                    <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                                                        Custom
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground">{cat.description}</p>
                                            <select
                                                value={currentValue}
                                                onChange={(e) => setDefault(cat.key, e.target.value)}
                                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                            >
                                                {available.length > 0
                                                    ? available.map((m) => (
                                                          <option key={m.id} value={m.id}>
                                                              {m.label}
                                                              {m.provider !== "openai"
                                                                  ? ` (${m.provider})`
                                                                  : ""}
                                                          </option>
                                                      ))
                                                    : <option value={currentValue}>{currentValue}</option>
                                                }
                                            </select>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <DialogFooter className="flex-row justify-between sm:justify-between shrink-0">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={resetDefaults}
                                className="gap-1.5 text-muted-foreground"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Reset to Defaults
                            </Button>
                            <Button onClick={() => onOpenChange(false)}>Done</Button>
                        </DialogFooter>
                    </TabsContent>

                    {/* ═══════ Billing Tab ═══════ */}
                    <TabsContent value="billing" className="flex-1 flex flex-col min-h-0">
                        <div className="flex-1 overflow-y-auto space-y-5 py-2 pr-1">
                            {/* Current plan */}
                            <div className="rounded-xl border border-border p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-semibold flex items-center gap-2">
                                            {currentLimits.label} Plan
                                            <Badge
                                                variant="outline"
                                                className="text-[10px] capitalize"
                                            >
                                                {activeAccount?.stripe_status || "trialing"}
                                            </Badge>
                                        </h3>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            ${currentLimits.price_monthly}/mo · {currentLimits.articles_per_month} articles · {currentLimits.max_seats === 1 ? "1 seat" : `${currentLimits.max_seats} seats`}
                                        </p>
                                    </div>
                                </div>

                                {/* Usage bar */}
                                {usageLoading ? (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Loading usage…
                                    </div>
                                ) : usage ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className={usageColor + " font-medium"}>
                                                {usage.articlesUsed} / {usage.articlesLimit} articles used
                                            </span>
                                            <span className="text-muted-foreground">
                                                {percentUsed}%
                                            </span>
                                        </div>
                                        <Progress
                                            value={Math.min(percentUsed, 100)}
                                            className={`h-2 ${percentUsed >= 100 ? "[&>[data-slot=progress-indicator]]:bg-destructive" : percentUsed >= 80 ? "[&>[data-slot=progress-indicator]]:bg-amber-500" : ""}`}
                                        />
                                        {usage.overage > 0 && (
                                            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-md px-2.5 py-1.5 mt-1">
                                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                                {usage.overage} overage article{usage.overage !== 1 ? "s" : ""} · ${usage.overageCost.toFixed(2)} extra this period
                                            </div>
                                        )}
                                        <p className="text-[11px] text-muted-foreground">
                                            Billing period started {new Date(usage.periodStart).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                        </p>
                                    </div>
                                ) : null}
                            </div>

                            {/* Actions */}
                            <div className="space-y-2">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Manage Subscription
                                </h3>

                                {/* Manage in Stripe portal */}
                                <Button
                                    variant="outline"
                                    className="w-full justify-between"
                                    disabled={!!billingLoading || !activeAccount?.stripe_status || activeAccount?.stripe_status === "trialing"}
                                    onClick={() => handleBillingAction("create-portal")}
                                >
                                    <span className="flex items-center gap-2">
                                        <CreditCard className="h-4 w-4" />
                                        Manage Billing
                                    </span>
                                    {billingLoading === "create-portal" ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                </Button>

                                {/* Subscribe (if trialing/no subscription) */}
                                {(!activeAccount?.stripe_status || activeAccount?.stripe_status === "trialing") && (
                                    <Button
                                        className="w-full justify-between"
                                        disabled={!!billingLoading}
                                        onClick={() => handleBillingAction("create-checkout", currentPlan)}
                                    >
                                        <span className="flex items-center gap-2">
                                            <ArrowUpRight className="h-4 w-4" />
                                            Activate Subscription
                                        </span>
                                        {billingLoading === "create-checkout" ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <span className="text-xs opacity-75">
                                                ${currentLimits.price_monthly}/mo
                                            </span>
                                        )}
                                    </Button>
                                )}
                            </div>

                            {/* Upgrade options */}
                            {currentPlan !== "scale" && (
                                <div className="space-y-2">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Upgrade Plan
                                    </h3>
                                    <div className="grid gap-2">
                                        {(["starter", "standard", "scale"] as PlanId[])
                                            .filter((p) => {
                                                const level = { starter: 0, standard: 1, scale: 2 };
                                                return level[p] > level[currentPlan];
                                            })
                                            .map((planId) => {
                                                const plan = PLAN_LIMITS[planId];
                                                return (
                                                    <button
                                                        key={planId}
                                                        disabled={!!billingLoading}
                                                        onClick={() => {
                                                            if (activeAccount?.stripe_status === "active") {
                                                                handleBillingAction("change-plan", planId);
                                                            } else {
                                                                handleBillingAction("create-checkout", planId);
                                                            }
                                                        }}
                                                        className="flex items-center justify-between rounded-lg border border-border p-3 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50"
                                                    >
                                                        <div>
                                                            <span className="text-sm font-medium flex items-center gap-1.5">
                                                                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                                                                {plan.label}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground block mt-0.5">
                                                                {plan.articles_per_month} articles/mo · {plan.max_seats} seats
                                                            </span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-sm font-semibold">
                                                                ${plan.price_monthly}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">/mo</span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}

                            {/* Error display */}
                            {billingError && (
                                <div className="rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-xs">
                                    {billingError}
                                </div>
                            )}
                        </div>

                        <DialogFooter className="shrink-0">
                            <Button onClick={() => onOpenChange(false)}>Done</Button>
                        </DialogFooter>
                    </TabsContent>

                    {/* ═══════ Prompt Engine Tab ═══════ */}
                    <TabsContent value="prompts" className="flex-1 flex flex-col min-h-0">
                        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
                            {/* Info callout */}
                            <div className="flex items-start gap-2.5 rounded-md bg-muted/40 border border-border p-3">
                                <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    The <strong>base prompt engine</strong> defines the default instructions sent to the LLM for all companies under this account. Company-level <strong>Editorial Guidelines</strong>, <strong>SEO Guidelines</strong>, and <strong>Voice Profiles</strong> are layered on top and take priority.
                                </p>
                            </div>

                            {peLoading && (
                                <div className="flex items-center gap-2 justify-center py-8">
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">Loading prompts…</span>
                                </div>
                            )}

                            {peError && (
                                <div className="rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-xs flex items-center gap-1.5">
                                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                    {peError}
                                </div>
                            )}

                            {!peLoading && peLoaded && (
                                <>
                                    {/* Tab toggle */}
                                    <div className="flex gap-1 rounded-lg bg-muted p-0.5">
                                        <button
                                            onClick={() => setPeActiveTab("system")}
                                            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                                peActiveTab === "system"
                                                    ? "bg-background shadow-sm text-foreground"
                                                    : "text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                            System Prompt
                                        </button>
                                        <button
                                            onClick={() => setPeActiveTab("user")}
                                            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                                peActiveTab === "user"
                                                    ? "bg-background shadow-sm text-foreground"
                                                    : "text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                            User Prompt Template
                                        </button>
                                    </div>

                                    {/* Editor */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs text-muted-foreground">
                                                {peActiveTab === "system" ? "Base System Prompt" : "Base User Prompt Template"}
                                                {(peActiveTab === "system" ? peSystemPrompt : peUserPrompt) && (
                                                    <Badge variant="outline" className="text-[10px] ml-1.5 text-primary border-primary/40">Custom</Badge>
                                                )}
                                                {!(peActiveTab === "system" ? peSystemPrompt : peUserPrompt) && (
                                                    <Badge variant="outline" className="text-[10px] ml-1.5 text-muted-foreground">Default</Badge>
                                                )}
                                            </Label>
                                            <div className="flex gap-1.5">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 text-[11px] gap-1"
                                                    onClick={() => {
                                                        const text = (peActiveTab === "system" ? peSystemPrompt : peUserPrompt)
                                                            || (peActiveTab === "system" ? peDefaultSystem : peDefaultUser);
                                                        navigator.clipboard.writeText(text).then(() => {
                                                            setPeCopiedId(peActiveTab);
                                                            setTimeout(() => setPeCopiedId(null), 2000);
                                                        });
                                                    }}
                                                >
                                                    {peCopiedId === peActiveTab
                                                        ? <><CheckCircle2 className="h-3 w-3" /> Copied</>
                                                        : <><Copy className="h-3 w-3" /> Copy</>}
                                                </Button>
                                                {(peActiveTab === "system" ? peSystemPrompt : peUserPrompt) && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 text-[11px] gap-1 text-muted-foreground"
                                                        onClick={() => {
                                                            if (peActiveTab === "system") setPeSystemPrompt("");
                                                            else setPeUserPrompt("");
                                                        }}
                                                    >
                                                        <RotateCcw className="h-3 w-3" /> Reset to Default
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        <Textarea
                                            value={
                                                (peActiveTab === "system" ? peSystemPrompt : peUserPrompt)
                                                || (peActiveTab === "system" ? peDefaultSystem : peDefaultUser)
                                            }
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const defaultVal = peActiveTab === "system" ? peDefaultSystem : peDefaultUser;
                                                const isDefault = val.trim() === defaultVal.trim();
                                                if (peActiveTab === "system") setPeSystemPrompt(isDefault ? "" : val);
                                                else setPeUserPrompt(isDefault ? "" : val);
                                            }}
                                            rows={16}
                                            className="text-xs font-mono leading-relaxed resize-none"
                                            placeholder={peActiveTab === "system" ? "Base system prompt..." : "Base user prompt template..."}
                                        />
                                        <p className="text-[11px] text-muted-foreground">
                                            {(peActiveTab === "system" ? peSystemPrompt : peUserPrompt)
                                                ? "✏️ Custom override active — company-level guidelines will be appended on top."
                                                : "Using built-in default. Edit to customize the base prompt for all companies."}
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>

                        <DialogFooter className="flex-row justify-between sm:justify-between shrink-0">
                            <div>
                                {peSaved && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Saved</span>}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    disabled={peSaving || !peLoaded}
                                    onClick={async () => {
                                        if (!activeAccount?.account_id) return;
                                        setPeSaving(true); setPeError(null); setPeSaved(false);
                                        try {
                                            const r = await fetch("/api/account/prompt-engine", {
                                                method: "PUT",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({
                                                    account_id: activeAccount.account_id,
                                                    base_system_prompt: peSystemPrompt || null,
                                                    base_user_prompt: peUserPrompt || null,
                                                }),
                                            });
                                            const data = await r.json();
                                            if (!r.ok) throw new Error(data?.error || "Save failed");
                                            setPeSaved(true);
                                            setTimeout(() => setPeSaved(false), 3000);
                                        } catch (err: any) { setPeError(err.message); }
                                        finally { setPeSaving(false); }
                                    }}
                                >
                                    {peSaving ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Saving…</> : "Save Prompts"}
                                </Button>
                                <Button onClick={() => onOpenChange(false)}>Done</Button>
                            </div>
                        </DialogFooter>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
