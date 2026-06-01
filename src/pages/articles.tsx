import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";

import type { GetServerSideProps } from "next";

import AppLayout from "@/components/layout/AppLayout";
import OutlineView from "@/components/articles/OutlineView";
import PanelView from "@/components/articles/PanelView";
import ClusterPanel from "@/components/articles/ClusterPanel";
import { AiClusterModal, ManualClusterModal, AutoClusterModal } from "@/components/articles/ClusterModals";
import CreateArticleModal from "@/components/articles/CreateArticleModal";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { List, FileText, AlertCircle, Plus } from "lucide-react";



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
    featured_video_url: string | null;
    featured_video_platform: string | null;
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



export default function ArticlesPage() {
    const [articles, setArticles] = useState<Article[]>([]);
    const [clusters, setClusters] = useState<Cluster[]>([]);
    const [companies, setCompanies] = useState<Record<string, string>>({});
    const [companyList, setCompanyList] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    // Draggable sidebar width
    const [sidebarWidth, setSidebarWidth] = useState(320);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const startWidth = useRef(320);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDragging.current = true;
        startX.current = e.clientX;
        startWidth.current = sidebarWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const handleMouseMove = (ev: MouseEvent) => {
            if (!isDragging.current) return;
            const delta = ev.clientX - startX.current;
            const newWidth = Math.min(600, Math.max(200, startWidth.current + delta));
            setSidebarWidth(newWidth);
        };

        const handleMouseUp = () => {
            isDragging.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [sidebarWidth]);

    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
    const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);

    // Cluster modal state
    const [showAiCluster, setShowAiCluster] = useState(false);
    const [showManualCluster, setShowManualCluster] = useState(false);
    const [showAutoCluster, setShowAutoCluster] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // New Article modal state
    const [showNewArticle, setShowNewArticle] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newClusterId, setNewClusterId] = useState<string>("__none__");
    const [newArticleCompanyId, setNewArticleCompanyId] = useState<string>("__none__");
    const [newArticleLoading, setNewArticleLoading] = useState(false);
    const [newArticleErr, setNewArticleErr] = useState<string | null>(null);

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

    // Deep-link: auto-select cluster from ?cluster= query param (e.g. from invitation)
    const router = useRouter();
    useEffect(() => {
        if (!loading && router.query.cluster && typeof router.query.cluster === "string") {
            const targetCluster = router.query.cluster;
            // Only auto-select if the cluster exists in the loaded data
            if (clusters.some((c) => c.id === targetCluster)) {
                setSelectedClusterId(targetCluster);
                setSelectedArticleId(null);
            }
        }
    }, [loading, router.query.cluster, clusters]);

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

    // Clusters filtered by selected company in the new-article modal
    const filteredClusters = newArticleCompanyId === "__none__"
        ? clusters
        : clusters.filter((c) => c.company_id === newArticleCompanyId);

    async function handleCreateNewArticle() {
        if (!newTitle.trim()) return;
        setNewArticleLoading(true);
        setNewArticleErr(null);
        try {
            const slug = newTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            // Auto-assign the only company when the picker is hidden (single-company users)
            let companyId = newArticleCompanyId === "__none__" ? undefined : newArticleCompanyId;
            if (!companyId && companyList.length === 1) {
                companyId = companyList[0].id;
            }
            const clusterId = newClusterId === "__none__" ? undefined : newClusterId;
            // If a cluster is selected, look up its company_id for auto-association
            const clusterCompany = clusterId ? clusters.find((c) => c.id === clusterId)?.company_id : undefined;
            const finalCompanyId = companyId || clusterCompany || undefined;
            const r = await fetch("/api/articles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: newTitle.trim(),
                    slug,
                    company_id: finalCompanyId,
                    cluster_id: clusterId || undefined,
                }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Failed to create article");
            setShowNewArticle(false);
            setNewTitle("");
            setNewClusterId("__none__");
            setNewArticleCompanyId("__none__");
            fetchData();
            // Auto-select the new article
            setSelectedArticleId(data.id);
            setSelectedClusterId(null);
        } catch (e: any) {
            setNewArticleErr(e.message);
        } finally {
            setNewArticleLoading(false);
        }
    }

    const selectedArticle = articles.find((a) => a.id === selectedArticleId) || null;

    return (
        <AppLayout fullWidth>
            <div className="flex flex-col h-[calc(100vh-7rem)]">




                <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-4">
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                        Organize your content into topic clusters — a pillar page anchors each cluster while supporting and long-tail articles build depth and internal linking, helping search engines recognize your topical authority.
                    </p>
                    <Button onClick={() => setShowCreateModal(true)} className="gap-1.5 shrink-0">
                        <Plus className="h-4 w-4" /> Create
                    </Button>
                </div>

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
                        <Button variant="link" onClick={() => setShowCreateModal(true)}>
                            Create your first one →
                        </Button>
                    </div>
                )}

                {!loading && (articles.length > 0 || clusters.length > 0) && (
                    <div className="flex-1 min-h-0 overflow-hidden">


                        {/* Outline View — sidebar tree + detail pane */}
                        {(
                            <div className="flex h-full gap-0">
                                {/* Sidebar tree */}
                                <div className="shrink-0 overflow-y-auto pr-1" style={{ width: sidebarWidth }}>
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
                                        onNewArticle={() => setShowNewArticle(true)}
                                    />
                                </div>

                                {/* Draggable resize handle */}
                                <div
                                    onMouseDown={handleMouseDown}
                                    className="shrink-0 cursor-col-resize group relative"
                                    style={{ width: 4 }}
                                    title="Drag to resize"
                                >
                                    <div className="absolute inset-y-0 -left-1 -right-1 z-10" />
                                    <div className="h-full w-full bg-border transition-colors group-hover:bg-primary/40 group-active:bg-primary/60" />
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
            <CreateArticleModal
                open={showCreateModal}
                onOpenChange={setShowCreateModal}
                onCreated={fetchData}
            />

            {/* New Article Dialog — lightweight title + cluster picker */}
            <Dialog open={showNewArticle} onOpenChange={(open) => {
                if (!open) {
                    setShowNewArticle(false);
                    setNewTitle("");
                    setNewClusterId("__none__");
                    setNewArticleCompanyId("__none__");
                    setNewArticleErr(null);
                }
            }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>New Article</DialogTitle>
                        <DialogDescription>
                            Create a blank article. You can optionally assign it to a cluster.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Title */}
                        <div className="space-y-1.5">
                            <label htmlFor="new-article-title" className="text-sm font-medium">Title</label>
                            <Input
                                id="new-article-title"
                                placeholder="e.g., The Ultimate Guide to…"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter" && newTitle.trim()) handleCreateNewArticle(); }}
                                autoFocus
                            />
                        </div>

                        {/* Company picker (only when multiple companies) */}
                        {companyList.length > 1 && (
                            <div className="space-y-1.5">
                                <label htmlFor="new-article-company" className="text-sm font-medium">Company</label>
                                <Select value={newArticleCompanyId} onValueChange={(v) => { setNewArticleCompanyId(v); setNewClusterId("__none__"); }}>
                                    <SelectTrigger id="new-article-company" className="w-full">
                                        <SelectValue placeholder="None" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">None</SelectItem>
                                        {companyList.map((c) => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Cluster picker */}
                        {filteredClusters.length > 0 && (
                            <div className="space-y-1.5">
                                <label htmlFor="new-article-cluster" className="text-sm font-medium">Cluster</label>
                                <Select value={newClusterId} onValueChange={setNewClusterId}>
                                    <SelectTrigger id="new-article-cluster" className="w-full">
                                        <SelectValue placeholder="None" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">None (unclustered)</SelectItem>
                                        {filteredClusters.map((c) => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {newArticleErr && (
                            <p className="text-sm text-destructive">{newArticleErr}</p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowNewArticle(false)}>Cancel</Button>
                        <Button onClick={handleCreateNewArticle} disabled={!newTitle.trim() || newArticleLoading}>
                            {newArticleLoading ? "Creating…" : "Create Article"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
