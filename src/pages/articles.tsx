import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import dynamic from "next/dynamic";
import OutlineView from "@/components/articles/OutlineView";
import PanelView from "@/components/articles/PanelView";

// Dynamic import for GraphView (uses canvas/ResizeObserver — SSR-incompatible)
const GraphView = dynamic(() => import("@/components/articles/GraphView"), { ssr: false });

export const getServerSideProps: GetServerSideProps = async () => {
    return { props: {} };
};

type Article = {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    html: string | null;
    image_base64: string | null;
    image_prompt: string | null;
    seo: Record<string, unknown> | null;
    outline: string[] | null;
    model_used: string | null;
    image_style: string | null;
    company_id: string | null;
    cluster_id: string | null;
    cluster_role: string | null;
    humanized: boolean;
    created_at: string;
    updated_at: string;
};

type Cluster = {
    id: string;
    name: string;
    status: string;
    strategy: any;
    company_id: string;
};

type ViewMode = "graph" | "outline" | "panel";

const VIEW_TABS: { id: ViewMode; icon: string; label: string; subtitle: string }[] = [
    { id: "graph", icon: "📊", label: "Graph", subtitle: "How Google/AI sees your content" },
    { id: "outline", icon: "🗂", label: "Outline", subtitle: "How humans manage it" },
    { id: "panel", icon: "🛠", label: "Panel", subtitle: "How you improve it" },
];

export default function ArticlesPage() {
    const [articles, setArticles] = useState<Article[]>([]);
    const [clusters, setClusters] = useState<Cluster[]>([]);
    const [companies, setCompanies] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("outline");
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setErr(null);
        try {
            const [articlesResp, clustersResp, companiesResp] = await Promise.all([
                fetch("/api/articles"),
                fetch("/api/clusters"),
                fetch("/api/companies"),
            ]);
            const articlesData = await articlesResp.json();
            const clustersData = await clustersResp.json();
            const companiesData = await companiesResp.json();

            if (!articlesResp.ok) throw new Error(articlesData.error || "Failed to fetch articles");
            setArticles(articlesData);

            if (Array.isArray(clustersData)) setClusters(clustersData);
            if (Array.isArray(companiesData)) {
                const map: Record<string, string> = {};
                companiesData.forEach((c: any) => { map[c.id] = c.name; });
                setCompanies(map);
            }
        } catch (e: any) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    function handleSelectArticle(id: string) {
        setSelectedArticleId(id);
        setViewMode("panel");
    }

    function handleUpdateArticle(updated: Article) {
        setArticles((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
    }

    function handleDeleteArticle(id: string) {
        setArticles((prev) => prev.filter((a) => a.id !== id));
        setSelectedArticleId(null);
        setViewMode("outline");
    }

    function handleRenameCluster(id: string, newName: string) {
        setClusters((prev) => prev.map((c) => (c.id === id ? { ...c, name: newName } : c)));
    }

    const selectedArticle = articles.find((a) => a.id === selectedArticleId) || null;

    return (
        <main style={{ margin: "0 auto", padding: "24px 40px", fontFamily: "system-ui", height: "100vh", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexShrink: 0 }}>
                <div>
                    <h1 style={{ margin: "0 0 2px", fontSize: 22 }}>Content Architecture</h1>
                    <p style={{ margin: 0, fontSize: 13, color: "#888" }}>
                        {articles.length} article{articles.length !== 1 ? "s" : ""} · {clusters.length} cluster{clusters.length !== 1 ? "s" : ""}
                    </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <Link href="/" style={{ padding: "8px 16px", fontSize: 14, fontWeight: 500, borderRadius: 6, border: "1px solid #ccc", background: "#fff", textDecoration: "none", color: "#333" }}>
                        ← Create New
                    </Link>
                    <Link href="/clusters" style={{ padding: "8px 16px", fontSize: 14, fontWeight: 500, borderRadius: 6, border: "1px solid #ccc", background: "#fff", textDecoration: "none", color: "#333" }}>
                        🔗 Clusters
                    </Link>
                </div>
            </div>

            {/* Tab bar */}
            <div style={{ display: "flex", gap: 4, marginBottom: 16, flexShrink: 0, borderBottom: "2px solid #e5e5e5", paddingBottom: 0 }}>
                {VIEW_TABS.map((tab) => {
                    const isActive = viewMode === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setViewMode(tab.id)}
                            style={{
                                display: "flex", alignItems: "center", gap: 8, padding: "10px 20px",
                                border: "none", borderBottom: isActive ? "2px solid #6366f1" : "2px solid transparent",
                                background: "none", cursor: "pointer", marginBottom: -2,
                                transition: "all 0.15s",
                            }}
                        >
                            <span style={{ fontSize: 16 }}>{tab.icon}</span>
                            <div style={{ textAlign: "left" }}>
                                <div style={{ fontSize: 14, fontWeight: isActive ? 600 : 400, color: isActive ? "#191F1D" : "#888" }}>
                                    {tab.label}
                                </div>
                                <div style={{ fontSize: 11, color: isActive ? "#6366f1" : "#bbb" }}>
                                    {tab.subtitle}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {loading && <p style={{ color: "#888", padding: 20 }}>Loading articles…</p>}
            {err && <p style={{ color: "crimson", padding: 20 }}>{err}</p>}

            {!loading && articles.length === 0 && (
                <div style={{ textAlign: "center", padding: 60, color: "#888" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
                    <p style={{ fontSize: 16, marginBottom: 8 }}>No articles yet.</p>
                    <Link href="/" style={{ color: "#6366f1", fontWeight: 500 }}>Create your first one →</Link>
                </div>
            )}

            {!loading && articles.length > 0 && (
                <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
                    {/* Graph View */}
                    {viewMode === "graph" && (
                        <GraphView
                            articles={articles}
                            clusters={clusters}
                            onSelectArticle={handleSelectArticle}
                        />
                    )}

                    {/* Outline View */}
                    {viewMode === "outline" && (
                        <div style={{ height: "100%", overflowY: "auto", paddingRight: 8 }}>
                            <OutlineView
                                articles={articles}
                                clusters={clusters}
                                companies={companies}
                                selectedArticleId={selectedArticleId}
                                onSelectArticle={handleSelectArticle}
                                onRenameCluster={handleRenameCluster}
                            />
                        </div>
                    )}

                    {/* Panel View */}
                    {viewMode === "panel" && (
                        <div style={{ display: "flex", height: "100%", gap: 0 }}>
                            {/* Sidebar tree */}
                            <div style={{
                                width: 280, flexShrink: 0, borderRight: "1px solid #e5e5e5",
                                overflowY: "auto", paddingRight: 8, background: "#fafafa",
                            }}>
                                <OutlineView
                                    articles={articles}
                                    clusters={clusters}
                                    companies={companies}
                                    selectedArticleId={selectedArticleId}
                                    onSelectArticle={(id) => setSelectedArticleId(id)}
                                    onRenameCluster={handleRenameCluster}
                                />
                            </div>

                            {/* Detail pane */}
                            <div style={{ flex: 1, overflowY: "auto" }}>
                                {selectedArticle ? (
                                    <PanelView
                                        article={selectedArticle}
                                        companies={companies}
                                        onUpdate={handleUpdateArticle}
                                        onDelete={handleDeleteArticle}
                                        onSelectArticle={(id) => setSelectedArticleId(id)}
                                    />
                                ) : (
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#888" }}>
                                        <div style={{ textAlign: "center" }}>
                                            <div style={{ fontSize: 48, marginBottom: 12 }}>👈</div>
                                            <p style={{ fontSize: 15 }}>Select an article from the tree to view details</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </main>
    );
}
