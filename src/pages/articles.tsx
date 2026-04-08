import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import dynamic from "next/dynamic";
import AppLayout from "@/components/layout/AppLayout";
import OutlineView from "@/components/articles/OutlineView";
import PanelView from "@/components/articles/PanelView";
import ClusterPanel from "@/components/articles/ClusterPanel";
import { AiClusterModal, ManualClusterModal, AutoClusterModal } from "@/components/articles/ClusterModals";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BarChart3, List, FileText, AlertCircle, Network } from "lucide-react";

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

type ViewMode = "graph" | "outline";

export default function ArticlesPage() {
    const [articles, setArticles] = useState<Article[]>([]);
    const [clusters, setClusters] = useState<Cluster[]>([]);
    const [companies, setCompanies] = useState<Record<string, string>>({});
    const [companyList, setCompanyList] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("outline");
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
    const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);

    // Cluster modal state
    const [showAiCluster, setShowAiCluster] = useState(false);
    const [showManualCluster, setShowManualCluster] = useState(false);
    const [showAutoCluster, setShowAutoCluster] = useState(false);

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
                setCompanyList(companiesData.map((c: any) => ({ id: c.id, name: c.name })));
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
        setSelectedClusterId(null);
    }

    function handleSelectCluster(id: string) {
        setSelectedClusterId(id);
        setSelectedArticleId(null);
    }

    function handleUpdateArticle(updated: Article) {
        setArticles((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
    }

    function handleDeleteArticle(id: string) {
        setArticles((prev) => prev.filter((a) => a.id !== id));
        setSelectedArticleId(null);
    }

    function handleRenameCluster(id: string, newName: string) {
        setClusters((prev) => prev.map((c) => (c.id === id ? { ...c, name: newName } : c)));
    }

    async function handleDeleteCluster(id: string) {
        try {
            const r = await fetch(`/api/clusters/${id}`, { method: "DELETE" });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Delete failed");
            setClusters((prev) => prev.filter((c) => c.id !== id));
            if (selectedClusterId === id) {
                setSelectedClusterId(null);
            }
            // Refresh articles to clear cluster assignments
            fetchData();
        } catch (e: any) { alert(e.message); }
    }

    function handleClusterCreated() {
        fetchData();
    }

    function handleClusterUpdate() {
        fetchData();
    }

    function handleClusterPanelDelete(id: string) {
        setClusters((prev) => prev.filter((c) => c.id !== id));
        setSelectedClusterId(null);
        fetchData();
    }

    const selectedArticle = articles.find((a) => a.id === selectedArticleId) || null;

    return (
        <AppLayout>
            <div className="flex flex-col h-[calc(100vh-7rem)]">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 shrink-0">
                    <div>
                        <h2 className="text-xl font-semibold tracking-tight">Content Architecture</h2>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {articles.length} article{articles.length !== 1 ? "s" : ""} · {clusters.length} cluster{clusters.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                </div>

                {/* View Tabs */}
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="shrink-0 mb-4">
                    <TabsList className="grid w-full max-w-xs grid-cols-2">
                        <TabsTrigger value="graph" className="gap-1.5">
                            <BarChart3 className="h-3.5 w-3.5" />
                            Graph
                        </TabsTrigger>
                        <TabsTrigger value="outline" className="gap-1.5">
                            <List className="h-3.5 w-3.5" />
                            Outline
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                {loading && (
                    <div className="space-y-3 p-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-3/4" />
                        <Skeleton className="h-10 w-1/2" />
                    </div>
                )}

                {err && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{err}</AlertDescription>
                    </Alert>
                )}

                {!loading && articles.length === 0 && clusters.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                            <FileText className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground mb-2">No articles yet.</p>
                        <Button asChild variant="link">
                            <Link href="/">Create your first one →</Link>
                        </Button>
                    </div>
                )}

                {!loading && (articles.length > 0 || clusters.length > 0) && (
                    <div className="flex-1 min-h-0 overflow-hidden">
                        {/* Graph View */}
                        {viewMode === "graph" && (
                            <GraphView
                                articles={articles}
                                clusters={clusters}
                                onSelectArticle={handleSelectArticle}
                            />
                        )}

                        {/* Outline View — sidebar tree + detail pane */}
                        {viewMode === "outline" && (
                            <div className="flex h-full gap-0">
                                {/* Sidebar tree */}
                                <div className="w-72 shrink-0 border-r border-border overflow-y-auto pr-2 bg-muted/30">
                                    <OutlineView
                                        articles={articles}
                                        clusters={clusters}
                                        companies={companies}
                                        selectedArticleId={selectedArticleId}
                                        selectedClusterId={selectedClusterId}
                                        onSelectArticle={handleSelectArticle}
                                        onSelectCluster={handleSelectCluster}
                                        onRenameCluster={handleRenameCluster}
                                        onDeleteCluster={handleDeleteCluster}
                                        onCreateAiCluster={() => setShowAiCluster(true)}
                                        onCreateManualCluster={() => setShowManualCluster(true)}
                                        onAutoCluster={() => setShowAutoCluster(true)}
                                    />
                                </div>

                                {/* Detail pane */}
                                <div className="flex-1 overflow-y-auto">
                                    {selectedClusterId ? (
                                        <ClusterPanel
                                            clusterId={selectedClusterId}
                                            companies={companies}
                                            onUpdate={handleClusterUpdate}
                                            onDelete={handleClusterPanelDelete}
                                            onSelectArticle={handleSelectArticle}
                                        />
                                    ) : selectedArticle ? (
                                        <PanelView
                                            article={selectedArticle}
                                            companies={companies}
                                            onUpdate={handleUpdateArticle}
                                            onDelete={handleDeleteArticle}
                                            onSelectArticle={handleSelectArticle}
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">
                                            <div className="text-center">
                                                <List className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                                <p className="text-sm">Select an article or cluster from the tree</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Cluster Modals */}
            <AiClusterModal
                open={showAiCluster}
                onOpenChange={setShowAiCluster}
                companies={companyList}
                onCreated={handleClusterCreated}
            />
            <ManualClusterModal
                open={showManualCluster}
                onOpenChange={setShowManualCluster}
                companies={companyList}
                onCreated={handleClusterCreated}
            />
            <AutoClusterModal
                open={showAutoCluster}
                onOpenChange={setShowAutoCluster}
                companies={companyList}
                onCreated={handleClusterCreated}
            />
        </AppLayout>
    );
}
