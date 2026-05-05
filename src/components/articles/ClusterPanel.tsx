// ClusterPanel.tsx — Cluster detail pane for managing strategy, pages, and articles
// Renders in the panel slot when a cluster is selected (instead of PanelView for articles)

import { useState, useEffect, useCallback } from "react";
import AIMemeModal from "@/components/ui/ai-meme-modal";
import { useTaskRunner } from "@/hooks/useTaskRunner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
    AlertCircle, CheckCircle2, Link2,
    FileText, Sparkles,
    Download, LinkIcon, Plus, ImageIcon,
    UserPlus, Mail, Copy,
    MoreHorizontal,
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

    // Meme modal — entertains users during generation
    const [memeDismissed, setMemeDismissed] = useState(false);
    const clusterAiWorking = !!generatingPage || batchGenerating;
    useEffect(() => { if (clusterAiWorking) setMemeDismissed(false); }, [clusterAiWorking]);

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

    const { runTask, runBatchTask } = useTaskRunner();

    async function generatePage(pageType: string, pageIndex: number, pageKey: string) {
        setGeneratingPage(pageKey); setPageGenErr(null);
        await runTask({
            type: "cluster-page",
            label: `Page: ${pageKey}`,
            endpoint: `/api/clusters/${clusterId}/generate`,
            body: { page_type: pageType, page_index: pageIndex, image_mode: imageMode },
            meta: { clusterId, pageType, pageIndex },
            onSuccess: async () => {
                await loadCluster();
                onUpdate();
                window.dispatchEvent(new Event("article-created"));
                setGeneratingPage(null);
            },
            onError: (errMsg) => { setPageGenErr(errMsg); setGeneratingPage(null); },
        });
    }

    async function batchGenerate() {
        if (!cluster) return;
        const strategy = cluster.strategy;
        const existingSlugs = new Set((cluster.articles ?? []).map((a) => a.slug));
        const pages: { type: string; index: number; slug: string }[] = [];
        if (!existingSlugs.has(strategy.pillar.slug)) pages.push({ type: "pillar", index: 0, slug: strategy.pillar.slug });
        strategy.supporting.forEach((p, i) => { if (!existingSlugs.has(p.slug)) pages.push({ type: "supporting", index: i, slug: p.slug }); });
        strategy.long_tail.forEach((p, i) => { if (!existingSlugs.has(p.slug)) pages.push({ type: "long_tail", index: i, slug: p.slug }); });
        if (pages.length === 0) return;

        setBatchGenerating(true); setBatchProgress({ current: 0, total: pages.length }); setPageGenErr(null);

        await runBatchTask({
            type: "cluster-batch",
            label: `Batch: ${cluster.name} (${pages.length} pages)`,
            items: pages.map((p) => ({
                endpoint: `/api/clusters/${clusterId}/generate`,
                body: { page_type: p.type, page_index: p.index, image_mode: imageMode },
                label: `${p.type}: ${p.slug}`,
            })),
            concurrency: 2,
            meta: { clusterId },
            onItemComplete: async (index) => {
                setBatchProgress((prev) => prev ? { ...prev, current: (prev.current || 0) + 1 } : null);
                await loadCluster();
            },
            onItemError: (index, errMsg) => {
                setPageGenErr(`Failed on page ${index + 1}: ${errMsg}`);
            },
            onSuccess: () => {
                setBatchGenerating(false); setBatchProgress(null);
                onUpdate();
                window.dispatchEvent(new Event("article-created"));
            },
            onError: (errMsg) => {
                setPageGenErr(errMsg);
                setBatchGenerating(false); setBatchProgress(null);
            },
        });
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
        await runTask({
            type: "guide",
            label: `Guide: ${cluster.name}`,
            endpoint: `/api/clusters/${clusterId}/generate-guide`,
            body: {},
            meta: { clusterId },
            onSuccess: async (data: any) => {
                setGuideSuccess(true);
                await loadCluster();
                onUpdate();
                if (data.id) {
                    setTimeout(() => onSelectArticle(data.id), 500);
                }
                window.dispatchEvent(new Event("article-created"));
                setGeneratingGuide(false);
            },
            onError: (errMsg) => { setGuideErr(errMsg); setGeneratingGuide(false); },
        });
    }

    function handleDownloadAll() {
        // Use direct navigation for reliable browser-native download
        // The Content-Disposition: attachment header tells the browser to download
        window.open(`/api/clusters/${clusterId}/download`, "_blank");
    }

    async function handleInterlink() {
        setInterlinking(true); setInterlinkErr(null); setInterlinkResult(null);
        await runTask({
            type: "interlink",
            label: `Interlink: ${cluster?.name || "cluster"}`,
            endpoint: `/api/clusters/${clusterId}/interlink`,
            body: {},
            meta: { clusterId },
            onSuccess: async (data: any) => {
                setInterlinkResult({
                    succeeded: data.articles_succeeded ?? 0,
                    links: data.total_links_added ?? 0,
                });
                await loadCluster();
                onUpdate();
                setInterlinking(false);
            },
            onError: (errMsg) => { setInterlinkErr(errMsg); setInterlinking(false); },
        });
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
        <>
        <div className="p-5 overflow-y-auto h-full space-y-4">
            {/* Header */}
            <div>
                <div className="flex items-center gap-2 mb-1">
                    {editingName ? (
                        <Input
                            autoFocus
                            value={editNameValue}
                            onChange={(e) => setEditNameValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") saveClusterName(); if (e.key === "Escape") setEditingName(false); }}
                            onBlur={saveClusterName}
                            disabled={savingName}
                            className="text-lg font-semibold tracking-tight h-auto py-0 px-1 border-primary/50"
                        />
                    ) : (
                        <>
                            <h2 className="text-lg font-semibold tracking-tight">{cluster.name}</h2>
                            <button onClick={() => { setEditNameValue(cluster.name); setEditingName(true); }}
                                className="text-muted-foreground hover:text-foreground transition-colors" title="Edit cluster name">
                                <Pencil className="h-3 w-3" />
                            </button>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{companies[cluster.company_id] || "Unknown"}</span>
                    <span>·</span>
                    <span className="uppercase">{cluster.status}</span>
                    <span>·</span>
                    <span>{generatedCount}/{totalPages} pages</span>
                </div>
            </div>

            {/* Actions — Generate All + single overflow menu */}
            <div className="flex gap-2 items-center pb-3 border-b border-border">
                <Button size="sm" onClick={batchGenerate} disabled={batchGenerating || generatedCount >= totalPages || !strategy} className="gap-1.5">
                    {batchGenerating ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> {batchProgress?.current}/{batchProgress?.total}…</>
                        : generatedCount >= totalPages ? <><CheckCircle2 className="h-3.5 w-3.5" /> All Generated</>
                            : <><Play className="h-3.5 w-3.5" /> Generate All ({totalPages - generatedCount})</>}
                </Button>

                <div className="ml-auto">
                <DropdownMenu onOpenChange={(open) => { if (!open) setConfirmDelete(false); }}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5 px-2.5 text-xs font-medium data-[state=open]:rounded-b-none data-[state=open]:border-b-0 data-[state=open]:bg-popover">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                            Actions
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={0} className="w-52 rounded-tr-none">
                        {/* Image mode */}
                        <DropdownMenuItem
                            onClick={() => setImageMode(imageMode === "ai" ? "search" : "ai")}
                            className="gap-2 cursor-pointer"
                        >
                            <ImageIcon className="h-4 w-4" />
                            {imageMode === "ai" ? "🎨 AI Images" : "🔍 Search Images"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {/* Tools */}
                        <DropdownMenuItem
                            onClick={handleGenerateGuide}
                            disabled={generatingGuide || generatedCount === 0}
                            className="gap-2 cursor-pointer"
                        >
                            <Sparkles className="h-4 w-4" />
                            {generatingGuide ? "Generating Guide…" : guideSuccess ? "Guide Created!" : "Generate Guide"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={handleInterlink}
                            disabled={interlinking || generatedCount < 2}
                            className="gap-2 cursor-pointer"
                        >
                            <LinkIcon className="h-4 w-4" />
                            {interlinking ? "Interlinking…" : interlinkResult ? `+${interlinkResult.links} Links` : "Interlink Articles"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={handleDownloadAll}
                            disabled={generatedCount === 0}
                            className="gap-2 cursor-pointer"
                        >
                            <Download className="h-4 w-4" />
                            Download All
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {/* Manage */}
                        <DropdownMenuItem
                            onClick={() => {
                                const next = !showSharePanel;
                                setShowSharePanel(next);
                                if (next && cluster) loadClusterInvites();
                            }}
                            className="gap-2 cursor-pointer"
                        >
                            <UserPlus className="h-4 w-4" />
                            Share Cluster
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => {
                                if (editingStrategy) { setEditingStrategy(false); }
                                else { setEditingStrategy(true); setEditStrategyJson(JSON.stringify(strategy, null, 2)); }
                            }}
                            className="gap-2 cursor-pointer"
                        >
                            <Pencil className="h-4 w-4" />
                            {editingStrategy ? "Close Editor" : "Edit Strategy"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => { if (showArticleMgr) setShowArticleMgr(false); else loadArticleManager(); }}
                            className="gap-2 cursor-pointer"
                        >
                            <Link2 className="h-4 w-4" />
                            {showArticleMgr ? "Close Articles" : "Manage Articles"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={loadCluster} className="gap-2 cursor-pointer">
                            <RefreshCw className="h-4 w-4" />
                            Refresh
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {confirmDelete ? (
                            <DropdownMenuItem onClick={handleDelete} disabled={deleting} variant="destructive" className="gap-2 cursor-pointer">
                                <Trash2 className="h-4 w-4" />
                                {deleting ? "Deleting…" : "Confirm Delete"}
                            </DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem
                                onSelect={(e) => { e.preventDefault(); setConfirmDelete(true); }}
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
            </div>

            {/* In-progress generation banner */}
            {(generatingPage || batchGenerating) && (
                <Alert className="border-primary/40 bg-primary/5 animate-pulse">
                    <RefreshCw className="h-4 w-4 text-primary animate-spin" />
                    <AlertDescription className="text-sm">
                        {batchGenerating ? (
                            <>
                                <span className="font-semibold text-primary">Batch generating…</span>{" "}
                                Article {batchProgress?.current} of {batchProgress?.total} is being created. Please wait — each article will be generated automatically.
                            </>
                        ) : (
                            <>
                                <span className="font-semibold text-primary">Generating article…</span>{" "}
                                This may take a minute. Once complete, click <strong>Generate</strong> on the next article or use <strong>Generate All</strong> to create remaining pages.
                            </>
                        )}
                    </AlertDescription>
                </Alert>
            )}

            {/* Reminder banner: shows after a single page finishes if more remain */}
            {!generatingPage && !batchGenerating && generatedCount > 0 && generatedCount < totalPages && !pageGenErr && (
                <Alert className="border-amber-500/30 bg-amber-500/5">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <AlertDescription className="text-sm">
                        <span className="font-semibold text-amber-600 dark:text-amber-400">{totalPages - generatedCount} article{totalPages - generatedCount !== 1 ? "s" : ""} remaining.</span>{" "}
                        Click <strong>Generate All ({totalPages - generatedCount})</strong> above or generate individual articles below.
                    </AlertDescription>
                </Alert>
            )}

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
                                                    const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
                                                    const url = `${base}/invite/${inv.token}`;
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

            {/* Strategy Pages — flat list */}
            {strategy && (
                <div className="space-y-1">
                    {[...(strategy.pillar?.title ? [{ page: strategy.pillar, type: "pillar", idx: 0 }] : []),
                      ...(strategy.supporting || []).map((p: any, i: number) => ({ page: p, type: "supporting", idx: i })),
                      ...(strategy.long_tail || []).map((p: any, i: number) => ({ page: p, type: "long_tail", idx: i })),
                    ].map(({ page, type, idx }) => {
                        const generated = isPageGenerated(page.slug);
                        const pageKey = `${type}-${idx}`;
                        const isGeneratingThis = generatingPage === pageKey;
                        const articleMatch = (cluster?.articles ?? []).find((a) => a.slug === page.slug);
                        const roleColor = type === "pillar" ? "bg-primary" : type === "supporting" ? "bg-green-500" : "bg-amber-500";
                        const roleLabel = type === "pillar" ? "P" : type === "supporting" ? "S" : "L";
                        const roleTooltip = type === "pillar" ? "Pillar — The comprehensive cornerstone article that anchors this cluster" : type === "supporting" ? "Supporting — A mid-depth article that expands on a subtopic of the pillar" : "Long-tail — A focused, niche article targeting a specific long-tail keyword";

                        return (
                            <div key={pageKey} className={cn(
                                "flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors",
                                generated ? "bg-green-500/5" : "hover:bg-muted/40"
                            )}>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className={cn("w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold shrink-0 text-white cursor-help", roleColor)}>
                                                {roleLabel}
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            {roleTooltip}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <div className="flex-1 min-w-0">
                                    {generated && articleMatch ? (
                                        <button onClick={() => onSelectArticle(articleMatch.id)}
                                            className="text-[13px] font-medium text-left hover:text-primary transition-colors truncate block w-full">
                                            {page.title}
                                        </button>
                                    ) : (
                                        <div className="text-[13px] font-medium truncate">{page.title}</div>
                                    )}
                                    <div className="text-[11px] text-muted-foreground truncate">{page.keyword}</div>
                                </div>
                                <div className="shrink-0">
                                    {generated ? (
                                        <span className="text-[11px] text-green-600 dark:text-green-400 font-medium">✓</span>
                                    ) : (
                                        <Button variant="ghost" size="sm" onClick={() => generatePage(type, idx, pageKey)}
                                            disabled={!!generatingPage || batchGenerating} className="h-6 px-2 text-xs">
                                            {isGeneratingThis ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>

        {/* AI Meme Entertainment Modal — shows during generation */}
        <AIMemeModal open={clusterAiWorking && !memeDismissed} onClose={() => setMemeDismissed(true)} companyName={cluster ? companies[cluster.company_id] : undefined} />
        </>
    );
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
