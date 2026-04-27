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

type TreeData = {
    companyId: string;
    companyName: string;
    clusters: {
        cluster: Cluster;
        roles: {
            role: string;
            articles: Article[];
        }[];
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

            // Build cluster entries — include ALL clusters for this company
            const seenClusterIds = new Set<string>();
            const clusterEntries: TreeData["clusters"] = [];

            // First, add clusters that have articles
            for (const [clusterId, clusterArticles] of Object.entries(clusterArticleGroups)) {
                seenClusterIds.add(clusterId);
                const roleGroups: Record<string, Article[]> = {};
                clusterArticles.forEach((a) => {
                    const role = a.cluster_role || "other";
                    if (!roleGroups[role]) roleGroups[role] = [];
                    roleGroups[role].push(a);
                });

                const roles = ROLE_ORDER
                    .filter((r) => roleGroups[r])
                    .map((r) => ({ role: r, articles: roleGroups[r] }));

                Object.keys(roleGroups).forEach((r) => {
                    if (!ROLE_ORDER.includes(r)) {
                        roles.push({ role: r, articles: roleGroups[r] });
                    }
                });

                clusterEntries.push({
                    cluster: clusterMap[clusterId] || { id: clusterId, name: "Unknown Cluster", status: "draft", strategy: null },
                    roles,
                });
            }

            // Then, add empty clusters (no articles assigned yet)
            for (const cl of companyCls) {
                if (!seenClusterIds.has(cl.id)) {
                    clusterEntries.push({
                        cluster: cl,
                        roles: [],
                    });
                }
            }

            return {
                companyId,
                companyName: companyId === "__none__" ? "No Company" : (companies[companyId] || "Unknown"),
                clusters: clusterEntries,
                unclustered,
            };
        });
    }, [articles, clusters, companies]);

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
        <div className="px-1 py-2 space-y-1">
            {/* Compact cluster creation */}
            {hasClusterActions && (
                <div className="flex px-2 pb-1">
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
                            className="flex items-center gap-2 w-full px-2 py-2 rounded-md hover:bg-muted/60 transition-colors text-left"
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
                                {company.clusters.map(({ cluster, roles }) => {
                                    const clusterKey = `cluster-${cluster.id}`;
                                    const isClusterCollapsed = collapsed[clusterKey];
                                    const clusterArticles = roles.flatMap((r) => r.articles.map((a) => ({ ...a, _role: r.role })));
                                    const isSelected = selectedClusterId === cluster.id;

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
                                                        onClick={() => onSelectCluster?.(cluster.id)}
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
                                                    {clusterArticles.length}
                                                </span>
                                            </div>

                                            {!isClusterCollapsed && clusterArticles.length > 0 && (
                                                <div className="pl-5 mt-0.5 space-y-px">
                                                    {clusterArticles.map((article) => {
                                                        const roleColor = ROLE_COLORS[(article as any)._role] || "bg-muted-foreground";
                                                        return (
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
                                                                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", roleColor)} />
                                                                <span className="truncate">{article.title}</span>
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
