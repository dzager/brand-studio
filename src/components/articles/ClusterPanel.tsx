// ClusterPanel.tsx — Cluster detail pane for managing strategy, pages, and articles
// Renders in the panel slot when a cluster is selected (instead of PanelView for articles)

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Play, RefreshCw, Pencil, X, Trash2,
    AlertCircle, CheckCircle2, Link2, Network,
    Crown, BookOpen, Scroll, FileText, Sparkles,
    Download, LinkIcon, Plus, ImageIcon, ChevronRight,
    UserPlus, Mail, Copy, ExternalLink,
    Zap, MoreHorizontal, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ClusterPage = {
    title: string;
    keyword: string;
    slug: string;
    description: string;
    word_count: string;
    links_to: string[];
};

type ClusterStrategy = {
    cluster_name: string;
    pillar: ClusterPage;
    supporting: ClusterPage[];
    long_tail: ClusterPage[];
};

type ClusterArticle = {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    cluster_role: string | null;
    created_at: string;
};

type Cluster = {
    id: string;
    company_id: string;
    account_id: string | null;
    name: string;
    pillar_topic: string;
    strategy: ClusterStrategy;
    status: string;
    created_at: string;
    updated_at: string;
    articles?: ClusterArticle[];
};

type OverlapPair = {
    slug_a: string; keyword_a: string;
    slug_b: string; keyword_b: string;
    similarity: number; severity: "low" | "warning" | "danger";
};

type ExistingOverlap = {
    planned_slug: string; planned_keyword: string;
    existing_article_id: string; existing_title: string; existing_slug: string;
    similarity: number; severity: "low" | "warning" | "danger";
};

type OverlapWarnings = {
    intra_cluster: OverlapPair[];
    existing_content: ExistingOverlap[];
};

type Props = {
    clusterId: string;
    companies: Record<string, string>;
    onUpdate: () => void;
    onDelete: (id: string) => void;
    onSelectArticle: (id: string) => void;
};

const ROLE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
    pillar: "default",
    supporting: "secondary",
    long_tail: "outline",
};

export default function ClusterPanel({ clusterId, companies, onUpdate, onDelete, onSelectArticle }: Props) {
    const [cluster, setCluster] = useState<Cluster | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const [generatingPage, setGeneratingPage] = useState<string | null>(null);
    const [batchGenerating, setBatchGenerating] = useState(false);
    const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
    const [pageGenErr, setPageGenErr] = useState<string | null>(null);

    const [editingStrategy, setEditingStrategy] = useState(false);
    const [editStrategyJson, setEditStrategyJson] = useState("");

    const [editingName, setEditingName] = useState(false);
    const [editNameValue, setEditNameValue] = useState("");
    const [savingName, setSavingName] = useState(false);

    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [generatingGuide, setGeneratingGuide] = useState(false);
    const [guideErr, setGuideErr] = useState<string | null>(null);

    const [guideSuccess, setGuideSuccess] = useState(false);

    const [interlinking, setInterlinking] = useState(false);
    const [interlinkErr, setInterlinkErr] = useState<string | null>(null);
    const [interlinkResult, setInterlinkResult] = useState<{ succeeded: number; links: number } | null>(null);

    const [showArticleMgr, setShowArticleMgr] = useState(false);
    const [assignedArticles, setAssignedArticles] = useState<any[]>([]);
    const [unassignedArticles, setUnassignedArticles] = useState<any[]>([]);
    const [loadingArticleMgr, setLoadingArticleMgr] = useState(false);
    const [assignRole, setAssignRole] = useState("supporting");
    const [selectedUnassigned, setSelectedUnassigned] = useState<Set<string>>(new Set());
    const [assigningArticles, setAssigningArticles] = useState(false);

    const [overlapWarnings, setOverlapWarnings] = useState<OverlapWarnings | null>(null);

    const [addingPageType, setAddingPageType] = useState<string | null>(null);
    const [newPage, setNewPage] = useState<ClusterPage>({
        title: "", keyword: "", slug: "", description: "", word_count: "1,500", links_to: [],
    });
    const [savingNewPage, setSavingNewPage] = useState(false);

    const [imageMode, setImageMode] = useState<"ai" | "search">("ai");

    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({ pillar: true, supporting: true, long_tail: true });

    // ── Share cluster state ────────────────────────────────────────
    const [showSharePanel, setShowSharePanel] = useState(false);
    const [shareEmail, setShareEmail] = useState("");
    const [shareLoading, setShareLoading] = useState(false);
    const [shareSuccess, setShareSuccess] = useState<string | null>(null);
    const [shareErr, setShareErr] = useState<string | null>(null);
    const [clusterInvites, setClusterInvites] = useState<any[]>([]);
    const [loadingInvites, setLoadingInvites] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

    const loadCluster = useCallback(async () => {
        setLoading(true); setErr(null);
        try {
            const r = await fetch(`/api/clusters/${clusterId}`);
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Failed to load cluster");
            setCluster(data);
        } catch (e: any) { setErr(e.message); }
        finally { setLoading(false); }
    }, [clusterId]);

    useEffect(() => { loadCluster(); }, [loadCluster]);

    // ── Share handlers ─────────────────────────────────────────────
    async function loadClusterInvites() {
        if (!cluster) return;
        setLoadingInvites(true);
        try {
            const acctId = cluster.account_id || "";
            const params = new URLSearchParams({
                account_id: acctId,
                cluster_id: cluster.id,
            });
            const r = await fetch(`/api/invitations?${params}`);
            const data = await r.json();
            if (r.ok && Array.isArray(data)) {
                setClusterInvites(data);
            }
        } catch {} 
        finally { setLoadingInvites(false); }
    }

    async function handleShareCluster() {
        if (!cluster || !shareEmail.trim()) return;
        setShareLoading(true); setShareErr(null); setShareSuccess(null);
        try {
            const r = await fetch("/api/invitations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    account_id: cluster.account_id || undefined,
                    email: shareEmail.trim(),
                    role: "member",
                    cluster_id: cluster.id,
                }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Failed to send invitation");
            setShareSuccess(`Invitation sent to ${shareEmail.trim()}`);
            setShareEmail("");
            loadClusterInvites();
        } catch (e: any) { setShareErr(e.message); }
        finally { setShareLoading(false); }
    }

    function handleCopyInviteLink(inviteUrl: string) {
        navigator.clipboard.writeText(inviteUrl).then(() => {
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2000);
        });
    }

    async function generatePage(pageType: string, pageIndex: number, pageKey: string) {
        setGeneratingPage(pageKey); setPageGenErr(null);
        try {
            const r = await fetch(`/api/clusters/${clusterId}/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ page_type: pageType, page_index: pageIndex, image_mode: imageMode }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Generation failed");
            await loadCluster();
            onUpdate();
        } catch (e: any) { setPageGenErr(e.message); }
        finally { setGeneratingPage(null); }
    }

    async function batchGenerate() {
        if (!cluster) return;
        const strategy = cluster.strategy;
        const existingSlugs = new Set((cluster.articles ?? []).map((a) => a.slug));
        const pages: { type: string; index: number }[] = [];
        if (!existingSlugs.has(strategy.pillar.slug)) pages.push({ type: "pillar", index: 0 });
        strategy.supporting.forEach((p, i) => { if (!existingSlugs.has(p.slug)) pages.push({ type: "supporting", index: i }); });
        strategy.long_tail.forEach((p, i) => { if (!existingSlugs.has(p.slug)) pages.push({ type: "long_tail", index: i }); });
        if (pages.length === 0) return;

        setBatchGenerating(true); setBatchProgress({ current: 0, total: pages.length }); setPageGenErr(null);
        for (let i = 0; i < pages.length; i++) {
            setBatchProgress({ current: i + 1, total: pages.length });
            try {
                const r = await fetch(`/api/clusters/${clusterId}/generate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ page_type: pages[i].type, page_index: pages[i].index, image_mode: imageMode }),
                });
                const data = await r.json();
                if (!r.ok) throw new Error(data.error || `Failed on page ${i + 1}`);
                await loadCluster();
            } catch (e: any) { setPageGenErr(`Failed on page ${i + 1}: ${e.message}`); break; }
        }
        setBatchGenerating(false); setBatchProgress(null);
        onUpdate();
    }

    async function saveStrategy() {
        try {
            const parsed = JSON.parse(editStrategyJson);
            const r = await fetch(`/api/clusters/${clusterId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ strategy: parsed }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Save failed");
            setCluster((prev) => prev ? { ...prev, strategy: parsed } : prev);
            setEditingStrategy(false);
            onUpdate();
        } catch (e: any) { alert(`Save failed: ${e.message}`); }
    }

    async function saveClusterName() {
        const trimmed = editNameValue.trim();
        if (!trimmed || trimmed === cluster?.name) { setEditingName(false); return; }
        setSavingName(true);
        try {
            const r = await fetch(`/api/clusters/${clusterId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: trimmed }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Save failed");
            setCluster((prev) => prev ? { ...prev, name: trimmed } : prev);
            setEditingName(false);
            onUpdate();
        } catch (e: any) { alert(`Rename failed: ${e.message}`); }
        finally { setSavingName(false); }
    }

    async function handleDelete() {
        setDeleting(true);
        try {
            const r = await fetch(`/api/clusters/${clusterId}`, { method: "DELETE" });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Delete failed");
            onDelete(clusterId);
        } catch (e: any) { alert(e.message); }
        finally { setDeleting(false); setConfirmDelete(false); }
    }

    async function handleGenerateGuide() {
        if (!cluster) return;
        setGeneratingGuide(true); setGuideErr(null); setGuideSuccess(false);
        try {
            const r = await fetch(`/api/clusters/${clusterId}/generate-guide`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Guide generation failed");
            setGuideSuccess(true);
            await loadCluster();
            onUpdate();
            // Navigate to the generated guide article
            if (data.id) {
                setTimeout(() => onSelectArticle(data.id), 500);
            }
        } catch (e: any) { setGuideErr(e.message); }
        finally { setGeneratingGuide(false); }
    }

    function handleDownloadAll() {
        // Use direct navigation for reliable browser-native download
        // The Content-Disposition: attachment header tells the browser to download
        window.open(`/api/clusters/${clusterId}/download`, "_blank");
    }

    async function handleInterlink() {
        setInterlinking(true); setInterlinkErr(null); setInterlinkResult(null);
        try {
            const r = await fetch(`/api/clusters/${clusterId}/interlink`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Interlinking failed");
            setInterlinkResult({
                succeeded: data.articles_succeeded ?? 0,
                links: data.total_links_added ?? 0,
            });
            await loadCluster();
            onUpdate();
        } catch (e: any) { setInterlinkErr(e.message); }
        finally { setInterlinking(false); }
    }

    async function loadArticleManager() {
        setShowArticleMgr(true); setLoadingArticleMgr(true); setSelectedUnassigned(new Set());
        try {
            const r = await fetch(`/api/clusters/${clusterId}/articles`);
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Failed");
            setAssignedArticles(data.assigned ?? []);
            setUnassignedArticles(data.unassigned ?? []);
        } catch (e: any) { setErr(e.message); }
        finally { setLoadingArticleMgr(false); }
    }

    async function assignArticles() {
        if (selectedUnassigned.size === 0) return;
        setAssigningArticles(true);
        try {
            const r = await fetch(`/api/clusters/${clusterId}/articles`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ article_ids: Array.from(selectedUnassigned), role: assignRole }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Assignment failed");
            setSelectedUnassigned(new Set());
            await loadArticleManager();
            await loadCluster();
            onUpdate();
        } catch (e: any) { alert(e.message); }
        finally { setAssigningArticles(false); }
    }

    async function removeArticleFromCluster(articleId: string) {
        try {
            const r = await fetch(`/api/clusters/${clusterId}/articles`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ article_id: articleId }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Remove failed");
            await loadArticleManager();
            await loadCluster();
            onUpdate();
        } catch (e: any) { alert(e.message); }
    }

    async function changeArticleRole(articleId: string, newRole: string) {
        try {
            const r = await fetch(`/api/clusters/${clusterId}/articles`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ article_id: articleId, role: newRole }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Role change failed");
            await loadArticleManager();
            await loadCluster();
            onUpdate();
        } catch (e: any) { alert(e.message); }
    }

    function isPageGenerated(slug: string) {
        return (cluster?.articles ?? []).some((a) => a.slug === slug);
    }

    function openAddPageForm(type: string) {
        setAddingPageType(type);
        setNewPage({ title: "", keyword: "", slug: "", description: "", word_count: type === "pillar" ? "3,000" : type === "supporting" ? "1,500" : "800", links_to: [] });
    }

    function handleNewPageFieldChange(field: keyof ClusterPage, value: string) {
        setNewPage((prev) => ({ ...prev, [field]: value }));
    }

    // Auto-generate slug from title
    function autoSlug(title: string) {
        return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }

    async function saveNewPage() {
        if (!cluster || !addingPageType || !newPage.title.trim()) return;
        setSavingNewPage(true);
        try {
            const updatedStrategy = JSON.parse(JSON.stringify(cluster.strategy)) as ClusterStrategy;
            const pageToAdd = { ...newPage, slug: newPage.slug || autoSlug(newPage.title) };

            if (addingPageType === "pillar") {
                // For pillar, replace if no pillar exists, or add as supporting if pillar already set
                if (!updatedStrategy.pillar?.title) {
                    updatedStrategy.pillar = pageToAdd;
                } else {
                    // Can't have multiple pillars — add as supporting instead
                    updatedStrategy.supporting = [...(updatedStrategy.supporting ?? []), pageToAdd];
                }
            } else if (addingPageType === "supporting") {
                updatedStrategy.supporting = [...(updatedStrategy.supporting ?? []), pageToAdd];
            } else if (addingPageType === "long_tail") {
                updatedStrategy.long_tail = [...(updatedStrategy.long_tail ?? []), pageToAdd];
            }

            const r = await fetch(`/api/clusters/${clusterId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ strategy: updatedStrategy }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Save failed");
            setCluster((prev) => prev ? { ...prev, strategy: updatedStrategy } : prev);
            setAddingPageType(null);
            onUpdate();
        } catch (e: any) { alert(`Failed to add page: ${e.message}`); }
        finally { setSavingNewPage(false); }
    }

    if (loading) {
        return (
            <div className="p-5 space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }

    if (err || !cluster) {
        return (
            <div className="p-5">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{err || "Cluster not found"}</AlertDescription>
                </Alert>
            </div>
        );
    }

    const strategy = cluster.strategy;
    const totalPages = strategy ? 1 + (strategy.supporting?.length ?? 0) + (strategy.long_tail?.length ?? 0) : 0;
    const generatedCount = cluster.articles?.length ?? 0;

    return (
        <div className="p-5 overflow-y-auto h-full space-y-4">
            {/* Header */}
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <Network className="h-5 w-5 text-primary" />
                    {editingName ? (
                        <Input
                            autoFocus
                            value={editNameValue}
                            onChange={(e) => setEditNameValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") saveClusterName(); if (e.key === "Escape") setEditingName(false); }}
                            onBlur={saveClusterName}
                            disabled={savingName}
                            className="text-xl font-semibold tracking-tight h-auto py-0 px-1 border-primary/50"
                        />
                    ) : (
                        <>
                            <h2 className="text-xl font-semibold tracking-tight">{cluster.name}</h2>
                            <button onClick={() => { setEditNameValue(cluster.name); setEditingName(true); }}
                                className="text-muted-foreground hover:text-foreground transition-colors" title="Edit cluster name">
                                <Pencil className="h-3.5 w-3.5" />
                            </button>
                        </>
                    )}
                </div>
                <div className="flex gap-2 flex-wrap mt-2">
                    <Badge variant="secondary">
                        {companies[cluster.company_id] || "Unknown"}
                    </Badge>
                    <Badge variant={cluster.status === "complete" ? "default" : cluster.status === "in_progress" ? "secondary" : "outline"} className="uppercase text-[10px]">
                        {cluster.status}
                    </Badge>
                    <Badge variant="outline">{generatedCount}/{totalPages} pages</Badge>
                    <span className="text-xs text-muted-foreground self-center">
                        {new Date(cluster.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                </div>
            </div>

            {/* Actions — consolidated into primary buttons + dropdown menus */}
            <div className="flex gap-2 flex-wrap items-center pb-4 border-b border-border">
                {/* Primary: Generate All */}
                <Button size="sm" onClick={batchGenerate} disabled={batchGenerating || generatedCount >= totalPages || !strategy} className="gap-1.5">
                    {batchGenerating ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> {batchProgress?.current}/{batchProgress?.total}…</>
                        : generatedCount >= totalPages ? <><CheckCircle2 className="h-3.5 w-3.5" /> All Generated</>
                            : <><Play className="h-3.5 w-3.5" /> Generate All ({totalPages - generatedCount})</>}
                </Button>

                {/* Image mode selector */}
                <div className="flex items-center gap-1 border rounded-md px-1.5 bg-muted/30">
                    <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <select value={imageMode} onChange={(e) => setImageMode(e.target.value as "ai" | "search")}
                        className="text-xs bg-transparent border-0 py-1 pr-1 focus:outline-none cursor-pointer">
                        <option value="ai">🎨 AI Generated</option>
                        <option value="search">🔍 Image Search</option>
                    </select>
                </div>

                {/* Actions dropdown — Generate Guide, Interlink, Download, Share */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5">
                            <Zap className="h-3.5 w-3.5" /> Actions
                            <ChevronDown className="h-3 w-3 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-52">
                        <DropdownMenuItem
                            onClick={handleGenerateGuide}
                            disabled={generatingGuide || generatedCount === 0}
                            className="gap-2 cursor-pointer"
                        >
                            {generatingGuide ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : guideSuccess ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                                <Sparkles className="h-4 w-4" />
                            )}
                            {generatingGuide ? "Generating Guide…" : guideSuccess ? "Guide Created!" : "Generate Guide"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={handleInterlink}
                            disabled={interlinking || generatedCount < 2}
                            className="gap-2 cursor-pointer"
                        >
                            {interlinking ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : interlinkResult ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                                <LinkIcon className="h-4 w-4" />
                            )}
                            {interlinking ? "Interlinking…" : interlinkResult ? `+${interlinkResult.links} Links` : "Interlink Articles"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={handleDownloadAll}
                            disabled={generatedCount === 0}
                            className="gap-2 cursor-pointer"
                        >
                            <Download className="h-4 w-4" />
                            Download All
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => {
                                const next = !showSharePanel;
                                setShowSharePanel(next);
                                if (next && cluster) loadClusterInvites();
                            }}
                            className={cn("gap-2 cursor-pointer", showSharePanel && "text-blue-600")}
                        >
                            <UserPlus className="h-4 w-4" />
                            {showSharePanel ? "Close Share Panel" : "Share Cluster"}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Refresh */}
                <Button variant="outline" size="sm" onClick={loadCluster} className="gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>

                {/* More overflow dropdown — Edit Strategy, Manage Articles, Delete */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="px-2">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                            onClick={() => {
                                if (editingStrategy) { setEditingStrategy(false); }
                                else { setEditingStrategy(true); setEditStrategyJson(JSON.stringify(strategy, null, 2)); }
                            }}
                            className={cn("gap-2 cursor-pointer", editingStrategy && "text-primary")}
                        >
                            {editingStrategy ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                            {editingStrategy ? "Close Editor" : "Edit Strategy"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => { if (showArticleMgr) setShowArticleMgr(false); else loadArticleManager(); }}
                            className={cn("gap-2 cursor-pointer", showArticleMgr && "text-primary")}
                        >
                            <Link2 className="h-4 w-4" />
                            {showArticleMgr ? "Close Articles" : "Manage Articles"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {confirmDelete ? (
                            <DropdownMenuItem
                                onClick={handleDelete}
                                disabled={deleting}
                                variant="destructive"
                                className="gap-2 cursor-pointer"
                            >
                                <Trash2 className="h-4 w-4" />
                                {deleting ? "Deleting…" : "Confirm Delete"}
                            </DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem
                                onClick={() => setConfirmDelete(true)}
                                variant="destructive"
                                className="gap-2 cursor-pointer"
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete Cluster
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {pageGenErr && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{pageGenErr}</AlertDescription>
                </Alert>
            )}

            {guideErr && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Guide generation failed: {guideErr}</AlertDescription>
                </Alert>
            )}

            {interlinkErr && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Interlinking failed: {interlinkErr}</AlertDescription>
                </Alert>
            )}

            {interlinkResult && (
                <Alert className="border-green-500/50 bg-green-500/5">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription>
                        Interlinked {interlinkResult.succeeded} articles — {interlinkResult.links} internal links added across the cluster.
                    </AlertDescription>
                </Alert>
            )}



            {/* Share Cluster Panel */}
            {showSharePanel && cluster && (
                <Card className="border-blue-500/30 bg-blue-500/5">
                    <CardContent className="p-4 space-y-3">
                        <h4 className="font-semibold text-sm flex items-center gap-1.5 text-blue-600">
                            <UserPlus className="h-4 w-4" /> Share Cluster
                        </h4>
                        <p className="text-xs text-muted-foreground">
                            Invite someone to collaborate on this cluster.
                            They&apos;ll receive an email with a registration link and will land directly in this cluster.
                        </p>

                        <div className="flex gap-2">
                            <Input
                                placeholder="colleague@company.com"
                                type="email"
                                value={shareEmail}
                                onChange={(e) => { setShareEmail(e.target.value); setShareErr(null); setShareSuccess(null); }}
                                onKeyDown={(e) => { if (e.key === "Enter") handleShareCluster(); }}
                                className="text-sm"
                            />
                            <Button size="sm" onClick={handleShareCluster}
                                disabled={shareLoading || !shareEmail.includes("@")}
                                className="gap-1.5 whitespace-nowrap"
                            >
                                {shareLoading ? (
                                    <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Sending&hellip;</>
                                ) : (
                                    <><Mail className="h-3.5 w-3.5" /> Send Invite</>
                                )}
                            </Button>
                        </div>

                        {shareSuccess && (
                            <Alert className="border-green-500/50 bg-green-500/5 py-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                <AlertDescription className="text-xs text-green-700">
                                    {shareSuccess}
                                </AlertDescription>
                            </Alert>
                        )}
                        {shareErr && (
                            <p className="text-xs text-destructive">{shareErr}</p>
                        )}

                        {/* Pending cluster invitations */}
                        {loadingInvites ? (
                            <Skeleton className="h-10 w-full" />
                        ) : clusterInvites.length > 0 ? (
                            <div className="space-y-1.5">
                                <h5 className="text-xs uppercase tracking-wider text-muted-foreground">Pending Invitations</h5>
                                {clusterInvites.map((inv) => (
                                    <div key={inv.id} className="flex items-center gap-2 p-2 rounded-md bg-card border border-border text-sm">
                                        <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <span className="flex-1 truncate">{inv.email}</span>
                                        <Badge variant="outline" className="text-[10px] shrink-0">Pending</Badge>
                                        {inv.token && (
                                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                                                title="Copy invite link"
                                                onClick={() => {
                                                    const url = `${window.location.origin}/invite/${inv.token}`;
                                                    handleCopyInviteLink(url);
                                                }}
                                            >
                                                {copiedLink ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground italic">No pending invitations for this cluster.</p>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Strategy Editor */}
            {editingStrategy && (
                <Card>
                    <CardContent className="p-4 space-y-3">
                        <h4 className="text-sm font-medium">Edit Strategy JSON</h4>
                        <Textarea value={editStrategyJson} onChange={(e) => setEditStrategyJson(e.target.value)} rows={18} className="font-mono text-xs" />
                        <Button variant="outline" size="sm" onClick={saveStrategy} className="gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Save Strategy
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Overlap Warnings */}
            {overlapWarnings && renderOverlapWarnings(overlapWarnings)}

            {/* Article Manager */}
            {showArticleMgr && (
                <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="p-4 space-y-4">
                        <h4 className="font-semibold text-sm text-primary flex items-center gap-1.5">
                            <Link2 className="h-4 w-4" /> Manage Articles
                        </h4>
                        {loadingArticleMgr && <Skeleton className="h-20 w-full" />}
                        {!loadingArticleMgr && (
                            <>
                                {/* Assigned */}
                                <div>
                                    <h5 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                                        Assigned ({assignedArticles.length})
                                    </h5>
                                    {assignedArticles.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No articles assigned yet.</p>
                                    ) : (
                                        <div className="space-y-1">
                                            {assignedArticles.map((a: any) => (
                                                <div key={a.id} className="flex items-center gap-2 p-2 rounded-md bg-card border">
                                                    <Badge variant={ROLE_VARIANTS[a.cluster_role] ?? "secondary"} className="text-[10px] uppercase shrink-0">
                                                        {a.cluster_role}
                                                    </Badge>
                                                    <button onClick={() => onSelectArticle(a.id)} className="flex-1 text-sm font-medium truncate text-left hover:text-primary transition-colors">
                                                        {a.title}
                                                    </button>
                                                    <select value={a.cluster_role} onChange={(e) => changeArticleRole(a.id, e.target.value)}
                                                        className="text-xs rounded border border-input bg-background px-1.5 py-0.5">
                                                        <option value="pillar">Pillar</option>
                                                        <option value="supporting">Supporting</option>
                                                        <option value="long_tail">Long-tail</option>
                                                    </select>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeArticleFromCluster(a.id)}>
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {/* Unassigned */}
                                <div>
                                    <h5 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                                        Unassigned ({unassignedArticles.length})
                                    </h5>
                                    {unassignedArticles.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">All articles are assigned.</p>
                                    ) : (
                                        <>
                                            <div className="flex gap-2 items-center mb-2">
                                                <Label className="text-xs">Assign as:</Label>
                                                <select value={assignRole} onChange={(e) => setAssignRole(e.target.value)}
                                                    className="text-xs rounded border border-input bg-background px-1.5 py-0.5">
                                                    <option value="pillar">Pillar</option>
                                                    <option value="supporting">Supporting</option>
                                                    <option value="long_tail">Long-tail</option>
                                                </select>
                                                <Button size="sm" onClick={assignArticles}
                                                    disabled={selectedUnassigned.size === 0 || assigningArticles} className="text-xs h-7">
                                                    {assigningArticles ? "Assigning…" : `Assign ${selectedUnassigned.size} selected`}
                                                </Button>
                                            </div>
                                            <div className="space-y-1 max-h-64 overflow-y-auto">
                                                {unassignedArticles.map((a: any) => (
                                                    <label key={a.id} className={cn(
                                                        "flex items-center gap-2 p-1.5 rounded-md cursor-pointer border text-sm transition-colors",
                                                        selectedUnassigned.has(a.id) ? "bg-primary/10 border-primary/30" : "bg-card border-border hover:bg-muted/50"
                                                    )}>
                                                        <input type="checkbox" checked={selectedUnassigned.has(a.id)}
                                                            onChange={() => setSelectedUnassigned((prev) => {
                                                                const next = new Set(prev);
                                                                if (next.has(a.id)) next.delete(a.id); else next.add(a.id);
                                                                return next;
                                                            })} className="h-3.5 w-3.5 rounded" />
                                                        <span className="font-medium truncate">{a.title}</span>
                                                        <span className="text-xs text-muted-foreground ml-auto shrink-0">/{a.slug}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Strategy Pages */}
            {strategy && (
                <div className="space-y-5">
                    {strategy.pillar?.title && renderPageSection("Pillar Page", "pillar", [strategy.pillar])}
                    {strategy.supporting?.length > 0 && renderPageSection("Supporting Pages", "supporting", strategy.supporting)}
                    {strategy.long_tail?.length > 0 && renderPageSection("Long-Tail Pages", "long_tail", strategy.long_tail)}
                </div>
            )}

            {!strategy && (
                <div className="text-center py-10 text-muted-foreground">
                    <Network className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">This cluster has no strategy yet. Use "Edit Strategy" to add one.</p>
                </div>
            )}
        </div>
    );

    function renderPageSection(label: string, type: string, pages: ClusterPage[]) {
        const isAddingThisType = addingPageType === type;
        const isCollapsed = collapsedSections[type] ?? true;
        const toggleCollapse = () => setCollapsedSections((prev) => ({ ...prev, [type]: !prev[type] }));
        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <button onClick={toggleCollapse} className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2 hover:text-foreground transition-colors">
                        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", !isCollapsed && "rotate-90")} />
                        <span className={cn("w-2.5 h-2.5 rounded-full",
                            type === "pillar" ? "bg-primary" : type === "supporting" ? "bg-green-500" : "bg-amber-500"
                        )} />
                        {label} ({pages.length})
                    </button>
                    {/* Hide add button for pillar if one already exists */}
                    {!(type === "pillar" && pages.length > 0) && (
                        <Button variant="ghost" size="sm"
                            onClick={() => isAddingThisType ? setAddingPageType(null) : openAddPageForm(type)}
                            className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground">
                            {isAddingThisType ? <><X className="h-3 w-3" /> Cancel</> : <><Plus className="h-3 w-3" /> Add Page</>}
                        </Button>
                    )}
                </div>

                {!isCollapsed && (
                <>
                {/* Inline add-page form */}
                {isAddingThisType && (
                    <Card className="border-dashed border-primary/40 bg-primary/5">
                        <CardContent className="p-3 space-y-2.5">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <Label className="text-xs">Title</Label>
                                    <Input placeholder="Page title" value={newPage.title}
                                        onChange={(e) => {
                                            handleNewPageFieldChange("title", e.target.value);
                                            if (!newPage.slug || newPage.slug === autoSlug(newPage.title.slice(0, -1))) {
                                                handleNewPageFieldChange("slug", autoSlug(e.target.value));
                                            }
                                        }}
                                        className="h-8 text-sm" />
                                </div>
                                <div>
                                    <Label className="text-xs">Keyword</Label>
                                    <Input placeholder="Target keyword" value={newPage.keyword}
                                        onChange={(e) => handleNewPageFieldChange("keyword", e.target.value)}
                                        className="h-8 text-sm" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <Label className="text-xs">Slug</Label>
                                    <Input placeholder="url-slug" value={newPage.slug}
                                        onChange={(e) => handleNewPageFieldChange("slug", e.target.value)}
                                        className="h-8 text-sm font-mono" />
                                </div>
                                <div>
                                    <Label className="text-xs">Word Count</Label>
                                    <Input placeholder="1,500" value={newPage.word_count}
                                        onChange={(e) => handleNewPageFieldChange("word_count", e.target.value)}
                                        className="h-8 text-sm" />
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs">Description</Label>
                                <Textarea placeholder="Brief description of this page…" value={newPage.description}
                                    onChange={(e) => handleNewPageFieldChange("description", e.target.value)}
                                    rows={2} className="text-sm resize-none" />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button variant="ghost" size="sm" onClick={() => setAddingPageType(null)} className="h-7 text-xs">
                                    Cancel
                                </Button>
                                <Button size="sm" onClick={saveNewPage} disabled={savingNewPage || !newPage.title.trim()}
                                    className="h-7 text-xs gap-1">
                                    {savingNewPage ? <><RefreshCw className="h-3 w-3 animate-spin" /> Saving…</>
                                        : <><Plus className="h-3 w-3" /> Add {type === "pillar" ? "Pillar" : type === "supporting" ? "Supporting" : "Long-Tail"} Page</>}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="space-y-1.5">
                    {pages.map((page, idx) => {
                        const generated = isPageGenerated(page.slug);
                        const pageKey = `${type}-${idx}`;
                        const isGeneratingThis = generatingPage === pageKey;
                        const articleMatch = (cluster?.articles ?? []).find((a) => a.slug === page.slug);

                        return (
                            <div key={idx} className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border",
                                generated ? "border-green-500/50 bg-green-500/5" : "border-border bg-card"
                            )}>
                                <span className={cn(
                                    "w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold shrink-0",
                                    generated ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                                )}>
                                    {generated ? "✓" : idx + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    {generated && articleMatch ? (
                                        <button onClick={() => onSelectArticle(articleMatch.id)}
                                            className="text-sm font-medium text-left hover:text-primary transition-colors truncate block w-full">
                                            {page.title}
                                        </button>
                                    ) : (
                                        <div className="text-sm font-medium">{page.title}</div>
                                    )}
                                    <div className="flex gap-2 text-[11px] text-muted-foreground flex-wrap mt-0.5">
                                        <Badge variant={ROLE_VARIANTS[type] ?? "secondary"} className="text-[10px] px-1.5 py-0">
                                            {page.keyword}
                                        </Badge>
                                        <span>/{page.slug}</span>
                                        <span>{page.word_count} words</span>
                                        {page.links_to.length > 0 && <span>→ {page.links_to.length} links</span>}
                                    </div>
                                    {page.description && <div className="text-xs text-muted-foreground mt-1">{page.description}</div>}
                                </div>
                                <div className="shrink-0">
                                    {generated ? (
                                        <span className="text-xs text-green-600 dark:text-green-400 font-semibold">✓ Generated</span>
                                    ) : (
                                        <Button variant="outline" size="sm" onClick={() => generatePage(type, idx, pageKey)}
                                            disabled={!!generatingPage || batchGenerating} className="gap-1">
                                            {isGeneratingThis ? <><RefreshCw className="h-3 w-3 animate-spin" /> Generating…</> : <><Play className="h-3 w-3" /> Generate</>}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                </>
                )}
            </div>
        );
    }
}

function renderOverlapWarnings(warnings: OverlapWarnings) {
    const hasIntra = warnings.intra_cluster.length > 0;
    const hasExisting = warnings.existing_content.length > 0;
    if (!hasIntra && !hasExisting) return null;
    return (
        <div className="space-y-3">
            {hasIntra && (
                <Alert className="border-amber-500 bg-amber-500/5">
                    <AlertDescription>
                        <h4 className="font-semibold text-amber-600 dark:text-amber-400 mb-2">⚠️ Intra-Cluster Overlap</h4>
                        <div className="space-y-1.5">
                            {warnings.intra_cluster.map((ov, i) => (
                                <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-card border text-sm">
                                    <Badge variant={ov.severity === "danger" ? "destructive" : "secondary"} className="text-xs font-bold">
                                        {Math.round(ov.similarity * 100)}%
                                    </Badge>
                                    <span className="flex-1">
                                        <strong>&quot;{ov.keyword_a}&quot;</strong> ↔ <strong>&quot;{ov.keyword_b}&quot;</strong>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </AlertDescription>
                </Alert>
            )}
            {hasExisting && (
                <Alert variant="destructive">
                    <AlertDescription>
                        <h4 className="font-semibold mb-2">📄 Existing Content Overlap</h4>
                        <div className="space-y-1.5">
                            {warnings.existing_content.map((ov, i) => (
                                <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-card border text-sm">
                                    <Badge variant="destructive" className="text-xs font-bold">
                                        {Math.round(ov.similarity * 100)}%
                                    </Badge>
                                    <span className="flex-1">
                                        Planned: <strong>&quot;{ov.planned_keyword}&quot;</strong> ↔ Existing: <strong>&quot;{ov.existing_title}&quot;</strong>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}
