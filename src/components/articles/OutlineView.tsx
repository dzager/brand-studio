// OutlineView.tsx — Clean tree hierarchy for content management
// Company → Cluster → Article (flat, with role indicators)

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
    Building2,
    ChevronDown,
    FileText,
    FolderOpen,
    Wand2,
    FolderPlus,
    Sparkles,
    Plus,
} from "lucide-react";

type Article = {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    cluster_id: string | null;
    cluster_role: string | null;
    company_id: string | null;
    created_at: string;
};

type Cluster = {
    id: string;
    name: string;
    status: string;
    strategy: any;
    company_id?: string;
};

type Props = {
    articles: Article[];
    clusters: Cluster[];
    companies: Record<string, string>;
    selectedArticleId: string | null;
    selectedClusterId?: string | null;
    onSelectArticle: (id: string) => void;
    onSelectCluster?: (id: string) => void;
    onRenameCluster?: (id: string, newName: string) => void;
    onDeleteCluster?: (id: string) => void;
    onCreateAiCluster?: () => void;
    onCreateManualCluster?: () => void;
    onAutoCluster?: () => void;
};

const ROLE_ORDER = ["pillar", "supporting", "long_tail"];
const ROLE_COLORS: Record<string, string> = {
    pillar: "bg-primary",
    supporting: "bg-green-500",
    long_tail: "bg-amber-500",
};

type StrategyPage = {
    title: string;
    slug: string;
    role: string;
    articleId?: string;  // set if this page has a generated article
    generated: boolean;
};

type TreeData = {
    companyId: string;
    companyName: string;
    clusters: {
        cluster: Cluster;
        pages: StrategyPage[];
    }[];
    unclustered: Article[];
};

export default function OutlineView({
    articles, clusters, companies,
    selectedArticleId, selectedClusterId,
    onSelectArticle, onSelectCluster,
    onRenameCluster, onDeleteCluster,
    onCreateAiCluster, onCreateManualCluster, onAutoCluster,
}: Props) {
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const [editingClusterId, setEditingClusterId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState("");

    const toggle = (key: string) => {
        setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    async function saveClusterName(clusterId: string) {
        const trimmed = editingName.trim();
        if (!trimmed) { setEditingClusterId(null); return; }
        try {
            const r = await fetch(`/api/clusters/${clusterId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: trimmed }),
            });
            if (!r.ok) throw new Error("Rename failed");
            onRenameCluster?.(clusterId, trimmed);
        } catch (e) {
            console.error(e);
        }
        setEditingClusterId(null);
    }

    // Build tree structure
    const tree = useMemo<TreeData[]>(() => {
        const clusterMap: Record<string, Cluster> = {};
        clusters.forEach((c) => { clusterMap[c.id] = c; });

        // Collect all company IDs from both articles and clusters
        const allCompanyIds = new Set<string>();
        articles.forEach((a) => allCompanyIds.add(a.company_id || "__none__"));
        clusters.forEach((c) => allCompanyIds.add(c.company_id || "__none__"));

        // Group articles by company
        const companyArticles: Record<string, Article[]> = {};
        articles.forEach((a) => {
            const cid = a.company_id || "__none__";
            if (!companyArticles[cid]) companyArticles[cid] = [];
            companyArticles[cid].push(a);
        });

        // Group clusters by company
        const companyClusters: Record<string, Cluster[]> = {};
        clusters.forEach((c) => {
            const cid = c.company_id || "__none__";
            if (!companyClusters[cid]) companyClusters[cid] = [];
            companyClusters[cid].push(c);
        });

        return Array.from(allCompanyIds).map((companyId) => {
            const arts = companyArticles[companyId] || [];
            const companyCls = companyClusters[companyId] || [];

            // Group articles by cluster
            const clusterArticleGroups: Record<string, Article[]> = {};
            const unclustered: Article[] = [];

            arts.forEach((a) => {
                if (a.cluster_id) {
                    if (!clusterArticleGroups[a.cluster_id]) clusterArticleGroups[a.cluster_id] = [];
                    clusterArticleGroups[a.cluster_id].push(a);
                } else {
                    unclustered.push(a);
                }
            });

            // Build cluster entries — merge strategy pages with generated articles
            const allClusterIds = new Set<string>([
                ...Object.keys(clusterArticleGroups),
                ...companyCls.map((c) => c.id),
            ]);

            const clusterEntries: TreeData["clusters"] = [];

            for (const clusterId of allClusterIds) {
                const cl = clusterMap[clusterId] || { id: clusterId, name: "Unknown Cluster", status: "draft", strategy: null, company_id: companyId };
                const generatedArticles = clusterArticleGroups[clusterId] || [];

                const pages: StrategyPage[] = [];

                // Simply list all generated articles in this cluster — cluster_id is the
                // reliable join key. Previous approach tried slug-matching against the
                // strategy JSON but failed when slugify altered the slug at save time.
                for (const a of generatedArticles) {
                    pages.push({
                        title: a.title,
                        slug: a.slug,
                        role: a.cluster_role || "supporting",
                        articleId: a.id,
                        generated: true,
                    });
                }

                // Sort by role order: pillar → supporting → long_tail → other
                pages.sort((a, b) => {
                    const ai = ROLE_ORDER.indexOf(a.role);
                    const bi = ROLE_ORDER.indexOf(b.role);
                    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                });

                clusterEntries.push({ cluster: cl, pages });
            }

            return {
                companyId,
                companyName: companyId === "__none__" ? "No Company" : (companies[companyId] || "Unknown"),
                clusters: clusterEntries,
                unclustered,
            };
        });
    }, [articles, clusters, companies]);

    // DEBUG: log tree structure to identify missing cluster articles
    useEffect(() => {
        console.log("[OutlineView] tree data:", tree.map(c => ({
            company: c.companyName,
            clusters: c.clusters.map(({ cluster, pages }) => ({
                name: cluster.name,
                id: cluster.id,
                pages: pages.length,
                pageDetails: pages.map(p => ({ title: p.title.slice(0, 40), role: p.role, generated: p.generated, articleId: p.articleId })),
            })),
            unclustered: c.unclustered.length,
        })));
        console.log("[OutlineView] raw articles with cluster_id:", articles.filter(a => a.cluster_id).map(a => ({
            title: a.title.slice(0, 40),
            cluster_id: a.cluster_id,
            company_id: a.company_id,
            slug: a.slug,
            cluster_role: a.cluster_role,
        })));
    }, [tree, articles]);

    // Seed default collapsed state: clusters closed, article role groups open
    useEffect(() => {
        setCollapsed((prev) => {
            const next = { ...prev };
            let changed = false;
            for (const company of tree) {
                for (const { cluster } of company.clusters) {
                    const clusterKey = `cluster-${cluster.id}`;
                    if (!(clusterKey in next)) {
                        next[clusterKey] = true;
                        changed = true;
                    }
                }
            }
            return changed ? next : prev;
        });
    }, [tree]);

    const hasClusterActions = onCreateAiCluster || onCreateManualCluster || onAutoCluster;

    return (
        <div className="py-2 space-y-1">
            {/* Compact cluster creation */}
            {hasClusterActions && (
                <div className="flex pb-1">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 text-muted-foreground hover:text-foreground">
                                <Plus className="h-3.5 w-3.5" /> New Cluster
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                            {onCreateAiCluster && (
                                <DropdownMenuItem onClick={onCreateAiCluster} className="gap-2 cursor-pointer">
                                    <Wand2 className="h-4 w-4 text-primary" />
                                    AI Cluster
                                </DropdownMenuItem>
                            )}
                            {onCreateManualCluster && (
                                <DropdownMenuItem onClick={onCreateManualCluster} className="gap-2 cursor-pointer">
                                    <FolderPlus className="h-4 w-4 text-muted-foreground" />
                                    Manual Cluster
                                </DropdownMenuItem>
                            )}
                            {onAutoCluster && (
                                <DropdownMenuItem onClick={onAutoCluster} className="gap-2 cursor-pointer">
                                    <Sparkles className="h-4 w-4 text-amber-500" />
                                    Auto-Cluster
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}

            {tree.map((company) => {
                const companyKey = `company-${company.companyId}`;
                const isCompanyCollapsed = collapsed[companyKey];
                const totalArticles = articles.filter((a) => (a.company_id || "__none__") === company.companyId).length;

                return (
                    <div key={company.companyId}>
                        {/* Company header */}
                        <button
                            onClick={() => toggle(companyKey)}
                            className="flex items-center gap-2 w-full py-2 rounded-md hover:bg-muted/60 transition-colors text-left"
                        >
                            <ChevronDown className={cn(
                                "h-3 w-3 text-muted-foreground transition-transform duration-200",
                                isCompanyCollapsed && "-rotate-90"
                            )} />
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium text-[13px]">{company.companyName}</span>
                            <span className="ml-auto text-xs text-muted-foreground/60">
                                {totalArticles}
                            </span>
                        </button>

                        {!isCompanyCollapsed && (
                            <div className="pl-3 mt-0.5 space-y-px">
                                {/* Clusters */}
                                {company.clusters.map(({ cluster, pages }) => {
                                    const clusterKey = `cluster-${cluster.id}`;
                                    const isClusterCollapsed = collapsed[clusterKey];
                                    const isSelected = selectedClusterId === cluster.id;
                                    const generatedCount = pages.filter((p) => p.generated).length;
                                    const totalCount = pages.length;

                                    return (
                                        <div key={cluster.id}>
                                            <div className={cn(
                                                "flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md transition-colors text-left text-[13px] group",
                                                isSelected
                                                    ? "bg-primary/8 border-l-2 border-primary"
                                                    : "hover:bg-muted/40 border-l-2 border-transparent"
                                            )}>
                                                <button onClick={() => toggle(clusterKey)} className="shrink-0 p-0.5">
                                                    <ChevronDown className={cn(
                                                        "h-3 w-3 text-muted-foreground transition-transform duration-200",
                                                        isClusterCollapsed && "-rotate-90"
                                                    )} />
                                                </button>
                                                {editingClusterId === cluster.id ? (
                                                    <Input
                                                        autoFocus
                                                        value={editingName}
                                                        onChange={(e) => setEditingName(e.target.value)}
                                                        onBlur={() => saveClusterName(cluster.id)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") { e.preventDefault(); saveClusterName(cluster.id); }
                                                            if (e.key === "Escape") setEditingClusterId(null);
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="h-6 text-[13px] font-medium max-w-[200px]"
                                                    />
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            onSelectCluster?.(cluster.id);
                                                            // Auto-expand the cluster so articles are visible
                                                            setCollapsed((prev) => ({ ...prev, [clusterKey]: false }));
                                                        }}
                                                        onDoubleClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingClusterId(cluster.id);
                                                            setEditingName(cluster.name);
                                                        }}
                                                        className="font-medium cursor-pointer flex-1 min-w-0 text-left truncate"
                                                        title="Click to view · Double-click to rename"
                                                    >
                                                        {cluster.name}
                                                    </button>
                                                )}
                                                <span className="text-xs text-muted-foreground/50 shrink-0 ml-auto">
                                                    {generatedCount}
                                                </span>
                                            </div>

                                            {!isClusterCollapsed && generatedCount > 0 && (
                                                <div className="pl-5 mt-0.5 space-y-px">
                                                    {pages.filter((p) => p.generated && p.articleId).map((page) => {
                                                        const roleColor = ROLE_COLORS[page.role] || "bg-muted-foreground";
                                                        return (
                                                            <button
                                                                key={page.articleId}
                                                                onClick={() => onSelectArticle(page.articleId!)}
                                                                className={cn(
                                                                    "flex items-center gap-2 w-full px-2 py-1 text-left rounded-md transition-colors text-[13px]",
                                                                    selectedArticleId === page.articleId
                                                                        ? "bg-primary/10 text-primary font-medium"
                                                                        : "text-foreground/70 hover:bg-muted/40"
                                                                )}
                                                            >
                                                                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", roleColor)} />
                                                                <span className="truncate">{page.title}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Unclustered articles */}
                                {company.unclustered.length > 0 && (
                                    <div>
                                        <button
                                            onClick={() => toggle(`unclustered-${company.companyId}`)}
                                            className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md hover:bg-muted/40 transition-colors text-left text-[13px] text-muted-foreground"
                                        >
                                            <ChevronDown className={cn(
                                                "h-3 w-3 transition-transform duration-200",
                                                collapsed[`unclustered-${company.companyId}`] && "-rotate-90"
                                            )} />
                                            <FolderOpen className="h-3 w-3" />
                                            Unclustered
                                            <span className="text-xs ml-auto text-muted-foreground/50">{company.unclustered.length}</span>
                                        </button>

                                        {!collapsed[`unclustered-${company.companyId}`] && (
                                            <div className="pl-5 mt-0.5 space-y-px">
                                                {company.unclustered.map((article) => (
                                                    <button
                                                        key={article.id}
                                                        onClick={() => onSelectArticle(article.id)}
                                                        className={cn(
                                                            "flex items-center gap-2 w-full px-2 py-1 text-left rounded-md transition-colors text-[13px]",
                                                            selectedArticleId === article.id
                                                                ? "bg-primary/10 text-primary font-medium"
                                                                : "text-foreground/70 hover:bg-muted/40"
                                                        )}
                                                    >
                                                        <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-muted-foreground/40" />
                                                        <span className="truncate">{article.title}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}

            {articles.length === 0 && clusters.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No articles yet. Create content to see your knowledge tree.</p>
                </div>
            )}
        </div>
    );
}
