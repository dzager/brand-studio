import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => {
    return { props: {} };
};

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
    name: string;
    pillar_topic: string;
    strategy: ClusterStrategy;
    status: string;
    created_at: string;
    updated_at: string;
    articles?: ClusterArticle[];
};

type OverlapPair = {
    slug_a: string;
    keyword_a: string;
    slug_b: string;
    keyword_b: string;
    similarity: number;
    severity: "low" | "warning" | "danger";
};

type ExistingOverlap = {
    planned_slug: string;
    planned_keyword: string;
    existing_article_id: string;
    existing_title: string;
    existing_slug: string;
    similarity: number;
    severity: "low" | "warning" | "danger";
};

type OverlapWarnings = {
    intra_cluster: OverlapPair[];
    existing_content: ExistingOverlap[];
};

const STATUS_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
    draft: { bg: "#f5f5f5", fg: "#666", border: "#ddd" },
    in_progress: { bg: "#fffbeb", fg: "#b45309", border: "#fcd34d" },
    complete: { bg: "#f0fdf4", fg: "#16a34a", border: "#86efac" },
};

const ROLE_COLORS: Record<string, { bg: string; fg: string }> = {
    pillar: { bg: "#eef2ff", fg: "#4338ca" },
    supporting: { bg: "#f0fdf4", fg: "#16a34a" },
    long_tail: { bg: "#fefce8", fg: "#a16207" },
};

const SEVERITY_STYLES: Record<string, { bg: string; fg: string; border: string; icon: string }> = {
    low: { bg: "#fefce8", fg: "#a16207", border: "#fcd34d", icon: "🟡" },
    warning: { bg: "#fff7ed", fg: "#c2410c", border: "#fdba74", icon: "🟠" },
    danger: { bg: "#fef2f2", fg: "#dc2626", border: "#fca5a5", icon: "🔴" },
};

export default function ClustersPage() {
    const [clusters, setClusters] = useState<Cluster[]>([]);
    const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
    const [companyNames, setCompanyNames] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [formCompanyId, setFormCompanyId] = useState("");
    const [formTopic, setFormTopic] = useState("");
    const [formModel, setFormModel] = useState("gpt-4.1-nano");
    const [availableModels, setAvailableModels] = useState<{ id: string; label: string; provider: string }[]>([]);
    const [generating, setGenerating] = useState(false);
    const [genErr, setGenErr] = useState<string | null>(null);

    // Article search dropdown
    const [existingArticles, setExistingArticles] = useState<{ id: string; title: string; slug: string; company_id?: string }[]>([]);
    const [articleSearch, setArticleSearch] = useState("");
    const [showArticleDropdown, setShowArticleDropdown] = useState(false);
    const [loadingArticles, setLoadingArticles] = useState(false);
    const articleDropdownRef = useRef<HTMLDivElement>(null);

    // Detail view
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [detailData, setDetailData] = useState<Record<string, Cluster>>({});
    const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

    // Article generation
    const [generatingPage, setGeneratingPage] = useState<string | null>(null);
    const [batchGenerating, setBatchGenerating] = useState<string | null>(null);
    const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
    const [pageGenErr, setPageGenErr] = useState<string | null>(null);

    // Delete
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Strategy editing
    const [editingStrategy, setEditingStrategy] = useState<string | null>(null);
    const [editStrategyJson, setEditStrategyJson] = useState("");

    // Overlap warnings (from embedding analysis)
    const [overlapWarnings, setOverlapWarnings] = useState<Record<string, OverlapWarnings>>({});

    // Auto-cluster
    const [showAutoCluster, setShowAutoCluster] = useState(false);
    const [autoClusterCompanyId, setAutoClusterCompanyId] = useState("");
    const [autoClusterRunning, setAutoClusterRunning] = useState(false);
    const [autoClusterResult, setAutoClusterResult] = useState<{ message: string; clusters_created: number; articles_assigned: number; clusters?: any[] } | null>(null);
    const [autoClusterErr, setAutoClusterErr] = useState<string | null>(null);

    // Manual cluster creation
    const [showManualForm, setShowManualForm] = useState(false);
    const [manualName, setManualName] = useState("");
    const [manualCompanyId, setManualCompanyId] = useState("");
    const [manualCreating, setManualCreating] = useState(false);
    const [manualErr, setManualErr] = useState<string | null>(null);

    // Article assignment
    const [articleMgr, setArticleMgr] = useState<string | null>(null); // cluster id being managed
    const [assignedArticles, setAssignedArticles] = useState<any[]>([]);
    const [unassignedArticles, setUnassignedArticles] = useState<any[]>([]);
    const [loadingArticleMgr, setLoadingArticleMgr] = useState(false);
    const [assignRole, setAssignRole] = useState<string>("supporting");
    const [selectedUnassigned, setSelectedUnassigned] = useState<Set<string>>(new Set());
    const [assigningArticles, setAssigningArticles] = useState(false);

    const fetchClusters = useCallback(async () => {
        setLoading(true);
        setErr(null);
        try {
            const r = await fetch("/api/clusters");
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Failed to fetch clusters");
            setClusters(data);
        } catch (e: any) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchClusters();
        fetch("/api/companies")
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    setCompanies(data);
                    const map: Record<string, string> = {};
                    data.forEach((c: any) => { map[c.id] = c.name; });
                    setCompanyNames(map);
                }
            })
            .catch(() => { });

        // Fetch available AI models
        fetch("/api/models")
            .then((r) => r.json())
            .then((data) => {
                if (data?.models && Array.isArray(data.models)) {
                    setAvailableModels(data.models);
                }
            })
            .catch(() => { });
    }, [fetchClusters]);

    // Fetch articles when the form is shown
    useEffect(() => {
        if (!showForm) return;
        setLoadingArticles(true);
        fetch("/api/articles")
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    setExistingArticles(data.map((a: any) => ({ id: a.id, title: a.title, slug: a.slug, company_id: a.company_id })));
                }
            })
            .catch(() => {})
            .finally(() => setLoadingArticles(false));
    }, [showForm]);

    // Close article dropdown on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (articleDropdownRef.current && !articleDropdownRef.current.contains(e.target as Node)) {
                setShowArticleDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    async function createCluster() {
        if (!formCompanyId || !formTopic.trim()) return;
        setGenerating(true);
        setGenErr(null);
        try {
            const r = await fetch("/api/clusters", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    company_id: formCompanyId,
                    topic: formTopic.trim(),
                    model: formModel,
                }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Strategy generation failed");
            setClusters((prev) => [data, ...prev]);
            setShowForm(false);
            setFormTopic("");
            setExpandedId(data.id);
            loadDetail(data.id);

            // Capture overlap warnings from embedding analysis
            if (data.overlap_warnings) {
                setOverlapWarnings((prev) => ({ ...prev, [data.id]: data.overlap_warnings }));
            }
        } catch (e: any) {
            setGenErr(e.message);
        } finally {
            setGenerating(false);
        }
    }

    async function loadDetail(id: string) {
        setLoadingDetail(id);
        try {
            const r = await fetch(`/api/clusters/${id}`);
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Failed to load cluster");
            setDetailData((prev) => ({ ...prev, [id]: data }));
        } catch (e: any) {
            setErr(e.message);
        } finally {
            setLoadingDetail(null);
        }
    }

    async function toggleExpand(id: string) {
        if (expandedId === id) {
            setExpandedId(null);
            return;
        }
        setExpandedId(id);
        if (!detailData[id]) {
            await loadDetail(id);
        }
    }

    async function generatePage(
        clusterId: string,
        pageType: string,
        pageIndex: number,
        pageKey: string
    ) {
        setGeneratingPage(pageKey);
        setPageGenErr(null);
        try {
            const r = await fetch(`/api/clusters/${clusterId}/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    page_type: pageType,
                    page_index: pageIndex,
                    model: formModel,
                }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Generation failed");
            // Reload detail to show new article
            await loadDetail(clusterId);
        } catch (e: any) {
            setPageGenErr(e.message);
        } finally {
            setGeneratingPage(null);
        }
    }

    async function batchGenerate(clusterId: string) {
        const detail = detailData[clusterId];
        if (!detail) return;

        const strategy = detail.strategy;
        const existingSlugs = new Set(
            (detail.articles ?? []).map((a) => a.slug)
        );

        // Collect all pages that haven't been generated yet
        const pages: { type: string; index: number; slug: string }[] = [];
        if (!existingSlugs.has(strategy.pillar.slug)) {
            pages.push({ type: "pillar", index: 0, slug: strategy.pillar.slug });
        }
        strategy.supporting.forEach((p, i) => {
            if (!existingSlugs.has(p.slug)) pages.push({ type: "supporting", index: i, slug: p.slug });
        });
        strategy.long_tail.forEach((p, i) => {
            if (!existingSlugs.has(p.slug)) pages.push({ type: "long_tail", index: i, slug: p.slug });
        });

        if (pages.length === 0) return;

        setBatchGenerating(clusterId);
        setBatchProgress({ current: 0, total: pages.length });
        setPageGenErr(null);

        for (let i = 0; i < pages.length; i++) {
            setBatchProgress({ current: i + 1, total: pages.length });
            try {
                const r = await fetch(`/api/clusters/${clusterId}/generate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        page_type: pages[i].type,
                        page_index: pages[i].index,
                        model: formModel,
                    }),
                });
                const data = await r.json();
                if (!r.ok) throw new Error(data.error || `Failed on page ${i + 1}`);
                // Reload to update article list
                await loadDetail(clusterId);
            } catch (e: any) {
                setPageGenErr(`Failed on page ${i + 1}: ${e.message}`);
                break;
            }
        }

        setBatchGenerating(null);
        setBatchProgress(null);
    }

    async function deleteCluster(id: string) {
        setDeletingId(id);
        try {
            const r = await fetch(`/api/clusters/${id}`, { method: "DELETE" });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Delete failed");
            setClusters((prev) => prev.filter((c) => c.id !== id));
            if (expandedId === id) setExpandedId(null);
            setConfirmDeleteId(null);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setDeletingId(null);
        }
    }

    async function saveStrategy(id: string) {
        try {
            const parsed = JSON.parse(editStrategyJson);
            const r = await fetch(`/api/clusters/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ strategy: parsed }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Save failed");
            setClusters((prev) => prev.map((c) => (c.id === id ? { ...c, strategy: parsed } : c)));
            setDetailData((prev) => ({
                ...prev,
                [id]: { ...prev[id], strategy: parsed },
            }));
            setEditingStrategy(null);
        } catch (e: any) {
            alert(`Save failed: ${e.message}`);
        }
    }

    async function runAutoCluster() {
        if (!autoClusterCompanyId) return;
        setAutoClusterRunning(true);
        setAutoClusterErr(null);
        setAutoClusterResult(null);
        try {
            const r = await fetch("/api/clusters/auto-cluster", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ company_id: autoClusterCompanyId }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Auto-cluster failed");
            setAutoClusterResult(data);
            if (data.clusters_created > 0) {
                await fetchClusters();
            }
        } catch (e: any) {
            setAutoClusterErr(e.message);
        } finally {
            setAutoClusterRunning(false);
        }
    }

    async function createManualCluster() {
        if (!manualCompanyId || !manualName.trim()) return;
        setManualCreating(true);
        setManualErr(null);
        try {
            const r = await fetch("/api/clusters/manual", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ company_id: manualCompanyId, name: manualName.trim() }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Creation failed");
            setClusters((prev) => [data, ...prev]);
            setShowManualForm(false);
            setManualName("");
            setExpandedId(data.id);
            loadDetail(data.id);
        } catch (e: any) {
            setManualErr(e.message);
        } finally {
            setManualCreating(false);
        }
    }

    async function loadArticleManager(clusterId: string) {
        if (articleMgr === clusterId) { setArticleMgr(null); return; }
        setArticleMgr(clusterId);
        setLoadingArticleMgr(true);
        setSelectedUnassigned(new Set());
        try {
            const r = await fetch(`/api/clusters/${clusterId}/articles`);
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Failed to load articles");
            setAssignedArticles(data.assigned ?? []);
            setUnassignedArticles(data.unassigned ?? []);
        } catch (e: any) {
            setErr(e.message);
        } finally {
            setLoadingArticleMgr(false);
        }
    }

    async function assignArticles(clusterId: string) {
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
            await loadArticleManager(clusterId);
            await loadDetail(clusterId);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setAssigningArticles(false);
        }
    }

    async function removeArticleFromCluster(clusterId: string, articleId: string) {
        try {
            const r = await fetch(`/api/clusters/${clusterId}/articles`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ article_id: articleId }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Remove failed");
            await loadArticleManager(clusterId);
            await loadDetail(clusterId);
        } catch (e: any) {
            alert(e.message);
        }
    }

    async function changeArticleRole(clusterId: string, articleId: string, newRole: string) {
        try {
            const r = await fetch(`/api/clusters/${clusterId}/articles`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ article_id: articleId, role: newRole }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Role change failed");
            await loadArticleManager(clusterId);
            await loadDetail(clusterId);
        } catch (e: any) {
            alert(e.message);
        }
    }

    function isPageGenerated(cluster: Cluster, slug: string): boolean {
        return (cluster.articles ?? []).some((a) => a.slug === slug);
    }

    function getPageArticle(cluster: Cluster, slug: string): ClusterArticle | undefined {
        return (cluster.articles ?? []).find((a) => a.slug === slug);
    }

    const btnStyle = {
        padding: "6px 14px",
        fontSize: 13,
        fontWeight: 500 as const,
        borderRadius: 6,
        border: "1px solid #ddd",
        background: "#fff",
        cursor: "pointer",
    };

    return (
        <main style={{ margin: "40px auto", padding: "16px 40px", fontFamily: "system-ui" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <h1 style={{ margin: 0 }}>Topical Clusters</h1>
                <div style={{ display: "flex", gap: 8 }}>
                    <Link
                        href="/"
                        style={{
                            padding: "8px 16px",
                            fontSize: 14,
                            fontWeight: 500,
                            borderRadius: 6,
                            border: "1px solid #ccc",
                            background: "#fff",
                            textDecoration: "none",
                            color: "#333",
                        }}
                    >
                        ← Studio
                    </Link>
                    <Link
                        href="/articles"
                        style={{
                            padding: "8px 16px",
                            fontSize: 14,
                            fontWeight: 500,
                            borderRadius: 6,
                            border: "1px solid #ccc",
                            background: "#fff",
                            textDecoration: "none",
                            color: "#333",
                        }}
                    >
                        📄 Articles
                    </Link>
                    <button
                        onClick={() => { setShowAutoCluster(!showAutoCluster); setAutoClusterResult(null); setAutoClusterErr(null); }}
                        style={{
                            padding: "8px 16px",
                            fontSize: 14,
                            fontWeight: 500,
                            borderRadius: 6,
                            border: "1px solid #6366f1",
                            background: showAutoCluster ? "#e0e7ff" : "#fff",
                            color: "#6366f1",
                            cursor: "pointer",
                        }}
                    >
                        🔮 Auto-Cluster
                    </button>
                    <button
                        onClick={() => { setShowManualForm(true); setShowForm(false); }}
                        style={{
                            padding: "8px 16px",
                            fontSize: 14,
                            fontWeight: 600,
                            borderRadius: 6,
                            border: "1px solid #22c55e",
                            background: "#f0fdf4",
                            color: "#16a34a",
                            cursor: "pointer",
                        }}
                    >
                        + Manual Cluster
                    </button>
                    <button
                        onClick={() => { setShowForm(true); setShowManualForm(false); }}
                        style={{
                            padding: "8px 16px",
                            fontSize: 14,
                            fontWeight: 600,
                            borderRadius: 6,
                            border: "1px solid #FDB72A",
                            background: "#FDB72A",
                            color: "#191F1D",
                            cursor: "pointer",
                        }}
                    >
                        🧠 AI Cluster
                    </button>
                </div>
            </div>

            {/* Auto-Cluster Panel */}
            {showAutoCluster && (
                <div
                    style={{
                        border: "1px solid #c7d2fe",
                        borderRadius: 10,
                        padding: 24,
                        marginBottom: 24,
                        background: "#eef2ff",
                    }}
                >
                    <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "#4338ca" }}>🔮 Auto-Cluster Existing Articles</h2>
                    <p style={{ fontSize: 13, color: "#6366f1", margin: "0 0 16px" }}>
                        Analyzes unclustered articles using embeddings and AI to automatically group them into topical clusters.
                    </p>

                    <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 12 }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Company *</label>
                            <select
                                value={autoClusterCompanyId}
                                onChange={(e) => setAutoClusterCompanyId(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "8px 12px",
                                    fontSize: 14,
                                    borderRadius: 6,
                                    border: autoClusterCompanyId ? "1px solid #ccc" : "2px solid #6366f1",
                                }}
                            >
                                <option value="">— Select company —</option>
                                {companies.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={runAutoCluster}
                            disabled={autoClusterRunning || !autoClusterCompanyId}
                            style={{
                                padding: "8px 20px",
                                fontSize: 14,
                                fontWeight: 600,
                                borderRadius: 6,
                                border: "1px solid #6366f1",
                                background: autoClusterRunning ? "#e0e7ff" : "#6366f1",
                                color: autoClusterRunning ? "#6366f1" : "#fff",
                                cursor: autoClusterRunning || !autoClusterCompanyId ? "not-allowed" : "pointer",
                                opacity: !autoClusterCompanyId ? 0.5 : 1,
                                whiteSpace: "nowrap" as const,
                            }}
                        >
                            {autoClusterRunning ? "Analyzing articles…" : "Run Auto-Cluster"}
                        </button>
                        <button
                            onClick={() => { setShowAutoCluster(false); setAutoClusterResult(null); setAutoClusterErr(null); }}
                            style={{ ...btnStyle, color: "#666" }}
                        >
                            Close
                        </button>
                    </div>

                    {autoClusterErr && (
                        <p style={{ color: "crimson", fontSize: 13, margin: "8px 0 0" }}>{autoClusterErr}</p>
                    )}

                    {autoClusterResult && (
                        <div
                            style={{
                                marginTop: 12,
                                padding: 16,
                                borderRadius: 8,
                                background: autoClusterResult.clusters_created > 0 ? "#f0fdf4" : "#fff",
                                border: `1px solid ${autoClusterResult.clusters_created > 0 ? "#86efac" : "#e5e5e5"}`,
                            }}
                        >
                            <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 14, color: autoClusterResult.clusters_created > 0 ? "#16a34a" : "#666" }}>
                                {autoClusterResult.clusters_created > 0 ? "✅" : "ℹ️"} {autoClusterResult.message}
                            </p>
                            {autoClusterResult.clusters && autoClusterResult.clusters.length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                                    {autoClusterResult.clusters.map((c: any, i: number) => (
                                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                            <span style={{ fontWeight: 600 }}>{c.name}</span>
                                            <span style={{ color: "#888" }}>—</span>
                                            <span style={{ color: "#666" }}>
                                                {c.article_count} articles (1 pillar, {c.supporting_count} supporting, {c.long_tail_count} long-tail)
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Manual Cluster Form */}
            {showManualForm && (
                <div
                    style={{
                        border: "1px solid #86efac",
                        borderRadius: 10,
                        padding: 24,
                        marginBottom: 24,
                        background: "#f0fdf4",
                    }}
                >
                    <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "#16a34a" }}>📁 Create Manual Cluster</h2>
                    <p style={{ fontSize: 13, color: "#15803d", margin: "0 0 16px" }}>
                        Create a named cluster, then assign existing articles to it. No AI strategy generation — you curate the grouping.
                    </p>

                    <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Company *</label>
                            <select
                                value={manualCompanyId}
                                onChange={(e) => setManualCompanyId(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "8px 12px",
                                    fontSize: 14,
                                    borderRadius: 6,
                                    border: manualCompanyId ? "1px solid #ccc" : "2px solid #22c55e",
                                }}
                            >
                                <option value="">— Select company —</option>
                                {companies.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ flex: 2 }}>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Cluster Name *</label>
                            <input
                                type="text"
                                value={manualName}
                                onChange={(e) => setManualName(e.target.value)}
                                placeholder="e.g., Dental Implant Guide, Audio Gear Reviews, Costa Rica Travel"
                                style={{
                                    width: "100%",
                                    padding: "8px 12px",
                                    fontSize: 14,
                                    borderRadius: 6,
                                    border: "1px solid #ccc",
                                    boxSizing: "border-box",
                                    fontFamily: "inherit",
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            onClick={createManualCluster}
                            disabled={manualCreating || !manualCompanyId || !manualName.trim()}
                            style={{
                                padding: "10px 20px",
                                fontSize: 14,
                                fontWeight: 600,
                                borderRadius: 6,
                                border: "1px solid #22c55e",
                                background: manualCreating ? "#dcfce7" : "#22c55e",
                                color: manualCreating ? "#16a34a" : "#fff",
                                cursor: manualCreating || !manualCompanyId || !manualName.trim() ? "not-allowed" : "pointer",
                                opacity: !manualCompanyId || !manualName.trim() ? 0.5 : 1,
                            }}
                        >
                            {manualCreating ? "Creating…" : "📁 Create Cluster"}
                        </button>
                        <button
                            onClick={() => { setShowManualForm(false); setManualErr(null); }}
                            style={{ ...btnStyle, color: "#666" }}
                        >
                            Cancel
                        </button>
                    </div>

                    {manualErr && (
                        <p style={{ color: "crimson", fontSize: 13, marginTop: 8 }}>{manualErr}</p>
                    )}
                </div>
            )}

            {/* AI Cluster Form */}
            {showForm && (
                <div
                    style={{
                        border: "1px solid #e5e5e5",
                        borderRadius: 10,
                        padding: 24,
                        marginBottom: 24,
                        background: "#fafafa",
                    }}
                >
                    <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>Generate Cluster Strategy</h2>
                    <p style={{ fontSize: 13, color: "#666", margin: "0 0 16px" }}>
                        Enter a broad topic and the AI will generate a complete content cluster — pillar page, supporting pages, and long-tail pages with keyword targets and interlinking strategy.
                    </p>

                    <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Company *</label>
                            <select
                                value={formCompanyId}
                                onChange={(e) => setFormCompanyId(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "8px 12px",
                                    fontSize: 14,
                                    borderRadius: 6,
                                    border: formCompanyId ? "1px solid #ccc" : "2px solid #f59e0b",
                                }}
                            >
                                <option value="">— Select company —</option>
                                {companies.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ width: 160 }}>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Model</label>
                            <select
                                value={formModel}
                                onChange={(e) => setFormModel(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "8px 12px",
                                    fontSize: 14,
                                    borderRadius: 6,
                                    border: "1px solid #ccc",
                                }}
                            >
                                {availableModels.length > 0 ? (
                                    availableModels.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.label}{m.provider !== "openai" ? ` (${m.provider})` : ""}
                                        </option>
                                    ))
                                ) : (
                                    <>
                                        <option value="gpt-4.1-nano">GPT-4.1 Nano</option>
                                        <option value="gpt-5.1">GPT-5.1</option>
                                    </>
                                )}
                            </select>
                        </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Topic *</label>

                        {/* Article search dropdown */}
                        <div ref={articleDropdownRef} style={{ position: "relative", marginBottom: 8 }}>
                            <div style={{ position: "relative" }}>
                                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#999", pointerEvents: "none" }}>🔍</span>
                                <input
                                    type="text"
                                    value={articleSearch}
                                    onChange={(e) => {
                                        setArticleSearch(e.target.value);
                                        setShowArticleDropdown(true);
                                    }}
                                    onFocus={() => setShowArticleDropdown(true)}
                                    placeholder={loadingArticles ? "Loading articles…" : "Search existing articles to use as topic…"}
                                    style={{
                                        width: "100%",
                                        padding: "8px 12px 8px 32px",
                                        fontSize: 13,
                                        borderRadius: 6,
                                        border: "1px solid #ddd",
                                        background: "#f9fafb",
                                        boxSizing: "border-box",
                                        fontFamily: "inherit",
                                    }}
                                />
                            </div>
                            {showArticleDropdown && (() => {
                                const filtered = existingArticles
                                    .filter((a) => {
                                        const matchesSearch = !articleSearch.trim() || a.title.toLowerCase().includes(articleSearch.toLowerCase());
                                        const matchesCompany = !formCompanyId || a.company_id === formCompanyId;
                                        return matchesSearch && matchesCompany;
                                    })
                                    .slice(0, 15);
                                if (filtered.length === 0 && !loadingArticles) return null;
                                return (
                                    <div
                                        style={{
                                            position: "absolute",
                                            top: "100%",
                                            left: 0,
                                            right: 0,
                                            maxHeight: 220,
                                            overflowY: "auto",
                                            background: "#fff",
                                            border: "1px solid #e5e5e5",
                                            borderRadius: 8,
                                            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                                            zIndex: 50,
                                            marginTop: 4,
                                        }}
                                    >
                                        {loadingArticles ? (
                                            <div style={{ padding: "10px 14px", fontSize: 13, color: "#999" }}>Loading…</div>
                                        ) : (
                                            filtered.map((article) => (
                                                <div
                                                    key={article.id}
                                                    onClick={() => {
                                                        setFormTopic(article.title);
                                                        setArticleSearch("");
                                                        setShowArticleDropdown(false);
                                                    }}
                                                    style={{
                                                        padding: "9px 14px",
                                                        fontSize: 13,
                                                        cursor: "pointer",
                                                        borderBottom: "1px solid #f3f4f6",
                                                        transition: "background 0.1s",
                                                    }}
                                                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f4ff")}
                                                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                                >
                                                    <div style={{ fontWeight: 500, color: "#1a1a1a" }}>{article.title}</div>
                                                    <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>/{article.slug}</div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        <textarea
                            value={formTopic}
                            onChange={(e) => setFormTopic(e.target.value)}
                            placeholder="e.g., dental implant options and costs, React performance optimization, organic gardening for beginners..."
                            rows={3}
                            style={{
                                width: "100%",
                                padding: "10px 12px",
                                fontSize: 14,
                                borderRadius: 6,
                                border: "1px solid #ccc",
                                resize: "vertical",
                                fontFamily: "inherit",
                                boxSizing: "border-box",
                            }}
                        />
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            onClick={createCluster}
                            disabled={generating || !formCompanyId || !formTopic.trim()}
                            style={{
                                padding: "10px 20px",
                                fontSize: 14,
                                fontWeight: 600,
                                borderRadius: 6,
                                border: "1px solid #6366f1",
                                background: generating ? "#e0e7ff" : "#6366f1",
                                color: generating ? "#6366f1" : "#fff",
                                cursor: generating || !formCompanyId || !formTopic.trim() ? "not-allowed" : "pointer",
                                opacity: !formCompanyId || !formTopic.trim() ? 0.5 : 1,
                            }}
                        >
                            {generating ? "Generating Strategy…" : "🧠 Generate Cluster Strategy"}
                        </button>
                        <button
                            onClick={() => { setShowForm(false); setGenErr(null); }}
                            style={{ ...btnStyle, color: "#666" }}
                        >
                            Cancel
                        </button>
                    </div>

                    {genErr && (
                        <p style={{ color: "crimson", fontSize: 13, marginTop: 8 }}>{genErr}</p>
                    )}
                </div>
            )}

            {loading && <p style={{ color: "#888" }}>Loading clusters…</p>}
            {err && <p style={{ color: "crimson" }}>{err}</p>}

            {!loading && clusters.length === 0 && !showForm && !showManualForm && (
                <div style={{
                    textAlign: "center",
                    padding: "60px 20px",
                    color: "#888",
                }}>
                    <p style={{ fontSize: 18, marginBottom: 8 }}>No clusters yet</p>
                    <p style={{ fontSize: 14, marginBottom: 20 }}>
                        Create a manual cluster to organize existing articles, or generate an AI-powered content strategy.
                    </p>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                        <button
                            onClick={() => setShowManualForm(true)}
                            style={{
                                padding: "10px 20px",
                                fontSize: 14,
                                fontWeight: 600,
                                borderRadius: 6,
                                border: "1px solid #22c55e",
                                background: "#f0fdf4",
                                color: "#16a34a",
                                cursor: "pointer",
                            }}
                        >
                            + Manual Cluster
                        </button>
                        <button
                            onClick={() => setShowForm(true)}
                            style={{
                                padding: "10px 20px",
                                fontSize: 14,
                                fontWeight: 600,
                                borderRadius: 6,
                                border: "1px solid #FDB72A",
                                background: "#FDB72A",
                                color: "#191F1D",
                                cursor: "pointer",
                            }}
                        >
                            🧠 AI Cluster
                        </button>
                    </div>
                </div>
            )}

            {/* Cluster List */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {clusters.map((cluster) => {
                    const detail = detailData[cluster.id];
                    const isExpanded = expandedId === cluster.id;
                    const strategy = (detail ?? cluster).strategy;
                    const totalPages = 1 + (strategy?.supporting?.length ?? 0) + (strategy?.long_tail?.length ?? 0);
                    const generatedCount = detail?.articles?.length ?? 0;
                    const statusStyle = STATUS_COLORS[cluster.status] ?? STATUS_COLORS.draft;

                    return (
                        <div
                            key={cluster.id}
                            style={{
                                border: "1px solid #e5e5e5",
                                borderRadius: 10,
                                overflow: "hidden",
                                background: "#fff",
                            }}
                        >
                            {/* Header */}
                            <div
                                style={{
                                    display: "flex",
                                    gap: 16,
                                    padding: 16,
                                    alignItems: "center",
                                    cursor: "pointer",
                                }}
                                onClick={() => toggleExpand(cluster.id)}
                            >
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                        <h3 style={{ margin: 0, fontSize: 16 }}>{cluster.name}</h3>
                                        <span
                                            style={{
                                                padding: "2px 8px",
                                                borderRadius: 4,
                                                fontSize: 11,
                                                fontWeight: 600,
                                                background: statusStyle.bg,
                                                color: statusStyle.fg,
                                                border: `1px solid ${statusStyle.border}`,
                                                textTransform: "uppercase",
                                            }}
                                        >
                                            {cluster.status}
                                        </span>
                                    </div>
                                    <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#999" }}>
                                        <span>{companyNames[cluster.company_id] ?? "Unknown"}</span>
                                        <span>
                                            {generatedCount}/{totalPages} pages generated
                                        </span>
                                        <span>
                                            {new Date(cluster.created_at).toLocaleDateString("en-US", {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric",
                                            })}
                                        </span>
                                    </div>
                                </div>

                                <div
                                    style={{ display: "flex", gap: 6 }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {confirmDeleteId === cluster.id ? (
                                        <div style={{ display: "flex", gap: 4 }}>
                                            <button
                                                onClick={() => deleteCluster(cluster.id)}
                                                disabled={deletingId === cluster.id}
                                                style={{
                                                    ...btnStyle,
                                                    border: "1px solid #ef4444",
                                                    color: "#ef4444",
                                                    background: "#fef2f2",
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {deletingId === cluster.id ? "…" : "Confirm"}
                                            </button>
                                            <button
                                                onClick={() => setConfirmDeleteId(null)}
                                                style={btnStyle}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setConfirmDeleteId(cluster.id)}
                                            style={{ ...btnStyle, color: "#ef4444" }}
                                        >
                                            🗑 Delete
                                        </button>
                                    )}
                                </div>

                                <span style={{ fontSize: 14, color: "#999", transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }}>
                                    ▼
                                </span>
                            </div>

                            {/* Expanded Detail */}
                            {isExpanded && (
                                <div style={{ borderTop: "1px solid #e5e5e5", padding: 20 }}>
                                    {loadingDetail === cluster.id && (
                                        <p style={{ color: "#888", fontSize: 13 }}>Loading cluster details…</p>
                                    )}

                                    {detail && strategy && (
                                        <>
                                            {/* Batch controls */}
                                            <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center" }}>
                                                <button
                                                    onClick={() => batchGenerate(cluster.id)}
                                                    disabled={!!batchGenerating || generatedCount >= totalPages}
                                                    style={{
                                                        padding: "8px 18px",
                                                        fontSize: 14,
                                                        fontWeight: 600,
                                                        borderRadius: 6,
                                                        border: "1px solid #6366f1",
                                                        background: batchGenerating === cluster.id ? "#e0e7ff" : "#6366f1",
                                                        color: batchGenerating === cluster.id ? "#6366f1" : "#fff",
                                                        cursor: batchGenerating || generatedCount >= totalPages ? "not-allowed" : "pointer",
                                                        opacity: generatedCount >= totalPages ? 0.5 : 1,
                                                    }}
                                                >
                                                    {batchGenerating === cluster.id
                                                        ? `Generating ${batchProgress?.current}/${batchProgress?.total}…`
                                                        : generatedCount >= totalPages
                                                        ? "✓ All Pages Generated"
                                                        : `⚡ Generate All (${totalPages - generatedCount} remaining)`}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (editingStrategy === cluster.id) {
                                                            setEditingStrategy(null);
                                                        } else {
                                                            setEditingStrategy(cluster.id);
                                                            setEditStrategyJson(JSON.stringify(strategy, null, 2));
                                                        }
                                                    }}
                                                    style={btnStyle}
                                                >
                                                    {editingStrategy === cluster.id ? "✕ Close Editor" : "✏️ Edit Strategy"}
                                                </button>
                                                <button
                                                    onClick={() => loadDetail(cluster.id)}
                                                    style={btnStyle}
                                                >
                                                    🔄 Refresh
                                                </button>
                                                <button
                                                    onClick={() => loadArticleManager(cluster.id)}
                                                    style={{
                                                        ...btnStyle,
                                                        background: articleMgr === cluster.id ? "#dbeafe" : "#fff",
                                                        color: "#2563eb",
                                                        border: "1px solid #93c5fd",
                                                    }}
                                                >
                                                    {articleMgr === cluster.id ? "✕ Close" : "📎 Manage Articles"}
                                                </button>
                                            </div>

                                            {pageGenErr && (
                                                <p style={{ color: "crimson", fontSize: 13, marginBottom: 12 }}>{pageGenErr}</p>
                                            )}

                                            {/* Strategy editor */}
                                            {editingStrategy === cluster.id && (
                                                <div style={{ marginBottom: 20 }}>
                                                    <textarea
                                                        value={editStrategyJson}
                                                        onChange={(e) => setEditStrategyJson(e.target.value)}
                                                        rows={20}
                                                        style={{
                                                            width: "100%",
                                                            padding: 12,
                                                            fontSize: 12,
                                                            fontFamily: "monospace",
                                                            borderRadius: 6,
                                                            border: "1px solid #ccc",
                                                            resize: "vertical",
                                                            boxSizing: "border-box",
                                                        }}
                                                    />
                                                    <button
                                                        onClick={() => saveStrategy(cluster.id)}
                                                        style={{
                                                            ...btnStyle,
                                                            marginTop: 8,
                                                            background: "#f0fdf4",
                                                            color: "#16a34a",
                                                            border: "1px solid #86efac",
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        💾 Save Strategy
                                                    </button>
                                                </div>
                                            )}

                                            {/* Overlap Warnings */}
                                            {overlapWarnings[cluster.id] && (
                                                <>{renderOverlapWarnings(overlapWarnings[cluster.id])}</>
                                            )}

                                            {/* Article Manager */}
                                            {articleMgr === cluster.id && (
                                                <div style={{
                                                    border: "1px solid #93c5fd",
                                                    borderRadius: 10,
                                                    padding: 20,
                                                    marginBottom: 20,
                                                    background: "#eff6ff",
                                                }}>
                                                    <h4 style={{ margin: "0 0 12px", fontSize: 15, color: "#1d4ed8" }}>📎 Manage Articles</h4>

                                                    {loadingArticleMgr && <p style={{ fontSize: 13, color: "#888" }}>Loading articles…</p>}

                                                    {!loadingArticleMgr && (
                                                        <>
                                                            {/* Assigned articles */}
                                                            <div style={{ marginBottom: 16 }}>
                                                                <h5 style={{ margin: "0 0 8px", fontSize: 13, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                                                    Assigned ({assignedArticles.length})
                                                                </h5>
                                                                {assignedArticles.length === 0 ? (
                                                                    <p style={{ fontSize: 13, color: "#999", margin: 0 }}>No articles assigned yet. Select from unassigned below.</p>
                                                                ) : (
                                                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                                        {assignedArticles.map((a: any) => {
                                                                            const roleStyle = ROLE_COLORS[a.cluster_role] ?? ROLE_COLORS.supporting;
                                                                            return (
                                                                                <div key={a.id} style={{
                                                                                    display: "flex", alignItems: "center", gap: 8,
                                                                                    padding: "8px 12px", borderRadius: 6,
                                                                                    background: "#fff", border: "1px solid #e5e7eb",
                                                                                }}>
                                                                                    <span style={{
                                                                                        padding: "2px 6px", borderRadius: 3, fontSize: 10, fontWeight: 700,
                                                                                        background: roleStyle.bg, color: roleStyle.fg,
                                                                                        textTransform: "uppercase",
                                                                                    }}>{a.cluster_role}</span>
                                                                                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{a.title}</span>
                                                                                    <select
                                                                                        value={a.cluster_role}
                                                                                        onChange={(e) => changeArticleRole(cluster.id, a.id, e.target.value)}
                                                                                        style={{ fontSize: 11, padding: "2px 4px", borderRadius: 4, border: "1px solid #d1d5db" }}
                                                                                    >
                                                                                        <option value="pillar">Pillar</option>
                                                                                        <option value="supporting">Supporting</option>
                                                                                        <option value="long_tail">Long-tail</option>
                                                                                    </select>
                                                                                    <button
                                                                                        onClick={() => removeArticleFromCluster(cluster.id, a.id)}
                                                                                        style={{ ...btnStyle, fontSize: 11, padding: "3px 8px", color: "#ef4444", border: "1px solid #fca5a5" }}
                                                                                    >✕</button>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Unassigned articles */}
                                                            <div>
                                                                <h5 style={{ margin: "0 0 8px", fontSize: 13, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                                                    Unassigned ({unassignedArticles.length})
                                                                </h5>
                                                                {unassignedArticles.length === 0 ? (
                                                                    <p style={{ fontSize: 13, color: "#999", margin: 0 }}>All articles are assigned to clusters.</p>
                                                                ) : (
                                                                    <>
                                                                        <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                                                                            <label style={{ fontSize: 12, fontWeight: 500 }}>Assign as:</label>
                                                                            <select
                                                                                value={assignRole}
                                                                                onChange={(e) => setAssignRole(e.target.value)}
                                                                                style={{ fontSize: 12, padding: "4px 8px", borderRadius: 4, border: "1px solid #d1d5db" }}
                                                                            >
                                                                                <option value="pillar">Pillar</option>
                                                                                <option value="supporting">Supporting</option>
                                                                                <option value="long_tail">Long-tail</option>
                                                                            </select>
                                                                            <button
                                                                                onClick={() => assignArticles(cluster.id)}
                                                                                disabled={selectedUnassigned.size === 0 || assigningArticles}
                                                                                style={{
                                                                                    ...btnStyle, fontSize: 12, padding: "4px 12px",
                                                                                    background: selectedUnassigned.size > 0 ? "#2563eb" : "#e5e7eb",
                                                                                    color: selectedUnassigned.size > 0 ? "#fff" : "#999",
                                                                                    border: `1px solid ${selectedUnassigned.size > 0 ? "#2563eb" : "#d1d5db"}`,
                                                                                    cursor: selectedUnassigned.size === 0 ? "not-allowed" : "pointer",
                                                                                }}
                                                                            >
                                                                                {assigningArticles ? "Assigning…" : `Assign ${selectedUnassigned.size} selected`}
                                                                            </button>
                                                                        </div>
                                                                        <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 260, overflowY: "auto" }}>
                                                                            {unassignedArticles.map((a: any) => (
                                                                                <label key={a.id} style={{
                                                                                    display: "flex", alignItems: "center", gap: 8,
                                                                                    padding: "6px 10px", borderRadius: 6, cursor: "pointer",
                                                                                    background: selectedUnassigned.has(a.id) ? "#dbeafe" : "#fff",
                                                                                    border: `1px solid ${selectedUnassigned.has(a.id) ? "#93c5fd" : "#f3f4f6"}`,
                                                                                    transition: "background 0.1s",
                                                                                }}>
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={selectedUnassigned.has(a.id)}
                                                                                        onChange={() => {
                                                                                            setSelectedUnassigned((prev) => {
                                                                                                const next = new Set(prev);
                                                                                                if (next.has(a.id)) next.delete(a.id); else next.add(a.id);
                                                                                                return next;
                                                                                            });
                                                                                        }}
                                                                                    />
                                                                                    <span style={{ fontSize: 13, fontWeight: 500 }}>{a.title}</span>
                                                                                    <span style={{ fontSize: 11, color: "#999", marginLeft: "auto" }}>/{a.slug}</span>
                                                                                </label>
                                                                            ))}
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            {/* Page list (only show if strategy has content) */}
                                            {strategy.pillar?.title && renderPageSection("Pillar Page", "pillar", [strategy.pillar], cluster, detail, 0)}
                                            {strategy.supporting?.length > 0 && renderPageSection("Supporting Pages", "supporting", strategy.supporting, cluster, detail, 0)}
                                            {strategy.long_tail?.length > 0 && renderPageSection("Long-Tail Pages", "long_tail", strategy.long_tail, cluster, detail, 0)}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </main>
    );

    function renderPageSection(
        label: string,
        type: string,
        pages: ClusterPage[],
        cluster: Cluster,
        detail: Cluster,
        _offset: number
    ) {
        const roleStyle = ROLE_COLORS[type] ?? ROLE_COLORS.supporting;

        return (
            <div style={{ marginBottom: 20 }}>
                <h4 style={{
                    margin: "0 0 10px",
                    fontSize: 13,
                    color: "#666",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                }}>
                    <span
                        style={{
                            display: "inline-block",
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: roleStyle.fg,
                        }}
                    />
                    {label} ({pages.length})
                </h4>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {pages.map((page, idx) => {
                        const generated = isPageGenerated(detail, page.slug);
                        const article = getPageArticle(detail, page.slug);
                        const pageKey = `${type}-${idx}`;
                        const isGeneratingThis = generatingPage === pageKey;

                        return (
                            <div
                                key={idx}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    padding: "10px 14px",
                                    borderRadius: 8,
                                    border: `1px solid ${generated ? "#86efac" : "#e5e5e5"}`,
                                    background: generated ? "#f0fdf4" : "#fafafa",
                                }}
                            >
                                <span style={{
                                    width: 22,
                                    height: 22,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    borderRadius: "50%",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    background: generated ? "#22c55e" : "#e5e5e5",
                                    color: generated ? "#fff" : "#999",
                                    flexShrink: 0,
                                }}>
                                    {generated ? "✓" : idx + 1}
                                </span>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>
                                        /{page.slug}
                                    </div>
                                    <div style={{ display: "flex", gap: 8, fontSize: 11, color: "#888", flexWrap: "wrap" }}>
                                        <span style={{
                                            padding: "1px 6px",
                                            borderRadius: 3,
                                            background: roleStyle.bg,
                                            color: roleStyle.fg,
                                            fontWeight: 600,
                                        }}>
                                            {page.keyword}
                                        </span>
                                        <span>{page.title}</span>
                                        <span>{page.word_count} words</span>
                                        {page.links_to.length > 0 && (
                                            <span>→ {page.links_to.length} links</span>
                                        )}
                                    </div>
                                    {page.description && (
                                        <div style={{ fontSize: 12, color: "#777", marginTop: 4 }}>
                                            {page.description}
                                        </div>
                                    )}
                                </div>

                                <div style={{ flexShrink: 0 }}>
                                    {generated ? (
                                        <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>
                                            ✓ Generated
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => generatePage(cluster.id, type, idx, pageKey)}
                                            disabled={!!generatingPage || !!batchGenerating}
                                            style={{
                                                ...btnStyle,
                                                background: isGeneratingThis ? "#e0e7ff" : "#6366f1",
                                                color: isGeneratingThis ? "#6366f1" : "#fff",
                                                border: "1px solid #6366f1",
                                                cursor: generatingPage || batchGenerating ? "not-allowed" : "pointer",
                                            }}
                                        >
                                            {isGeneratingThis ? "Generating…" : "▶ Generate"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    function renderOverlapWarnings(warnings: OverlapWarnings) {
        const hasIntra = warnings.intra_cluster.length > 0;
        const hasExisting = warnings.existing_content.length > 0;
        if (!hasIntra && !hasExisting) return null;

        return (
            <div style={{ marginBottom: 20 }}>
                {hasIntra && (
                    <div
                        style={{
                            border: "1px solid #fdba74",
                            borderRadius: 8,
                            padding: 14,
                            marginBottom: 12,
                            background: "#fff7ed",
                        }}
                    >
                        <h4 style={{ margin: "0 0 8px", fontSize: 14, color: "#c2410c" }}>
                            ⚠️ Intra-Cluster Overlap Detected
                        </h4>
                        <p style={{ fontSize: 12, color: "#9a3412", margin: "0 0 10px" }}>
                            These planned pages target semantically similar content and may cannibalize each other's rankings.
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {warnings.intra_cluster.map((ov, i) => {
                                const sev = SEVERITY_STYLES[ov.severity] || SEVERITY_STYLES.low;
                                return (
                                    <div
                                        key={i}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 10,
                                            padding: "8px 12px",
                                            borderRadius: 6,
                                            background: "#fff",
                                            border: `1px solid ${sev.border}`,
                                            fontSize: 13,
                                        }}
                                    >
                                        <span>{sev.icon}</span>
                                        <div style={{ flex: 1 }}>
                                            <strong style={{ color: sev.fg }}>"{ov.keyword_a}"</strong>
                                            {" ↔ "}
                                            <strong style={{ color: sev.fg }}>"{ov.keyword_b}"</strong>
                                        </div>
                                        <span style={{
                                            padding: "2px 8px",
                                            borderRadius: 4,
                                            fontSize: 11,
                                            fontWeight: 700,
                                            background: sev.bg,
                                            color: sev.fg,
                                            border: `1px solid ${sev.border}`,
                                        }}>
                                            {Math.round(ov.similarity * 100)}% similar
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {hasExisting && (
                    <div
                        style={{
                            border: "1px solid #fca5a5",
                            borderRadius: 8,
                            padding: 14,
                            marginBottom: 12,
                            background: "#fef2f2",
                        }}
                    >
                        <h4 style={{ margin: "0 0 8px", fontSize: 14, color: "#dc2626" }}>
                            📄 Existing Content Overlap
                        </h4>
                        <p style={{ fontSize: 12, color: "#991b1b", margin: "0 0 10px" }}>
                            These planned pages are similar to articles that already exist for this company.
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {warnings.existing_content.map((ov, i) => {
                                const sev = SEVERITY_STYLES[ov.severity] || SEVERITY_STYLES.low;
                                return (
                                    <div
                                        key={i}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 10,
                                            padding: "8px 12px",
                                            borderRadius: 6,
                                            background: "#fff",
                                            border: `1px solid ${sev.border}`,
                                            fontSize: 13,
                                        }}
                                    >
                                        <span>{sev.icon}</span>
                                        <div style={{ flex: 1 }}>
                                            <span>Planned: <strong style={{ color: sev.fg }}>"{ov.planned_keyword}"</strong></span>
                                            <span style={{ margin: "0 6px", color: "#999" }}>↔</span>
                                            <span>Existing: <strong>"{ov.existing_title}"</strong></span>
                                            <span style={{ color: "#999", marginLeft: 6, fontSize: 11 }}>/{ov.existing_slug}</span>
                                        </div>
                                        <span style={{
                                            padding: "2px 8px",
                                            borderRadius: 4,
                                            fontSize: 11,
                                            fontWeight: 700,
                                            background: sev.bg,
                                            color: sev.fg,
                                            border: `1px solid ${sev.border}`,
                                        }}>
                                            {Math.round(ov.similarity * 100)}% similar
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    }
}
