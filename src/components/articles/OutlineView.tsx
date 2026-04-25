// OutlineView.tsx — Collapsible tree hierarchy for content management
// Company → Cluster → Role Group → Article
// Now includes cluster toolbar and cluster selection for ClusterPanel

import { useState, useMemo, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
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
    Network,
    ChevronDown,
    FileText,
    Crown,
    BookOpen,
    Scroll,
    FolderOpen,
    Wand2,
    FolderPlus,
    Sparkles,
    Trash2,
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
const ROLE_META: Record<string, { label: string; icon: typeof Crown }> = {
    pillar: { label: "Pillar", icon: Crown },
    supporting: { label: "Supporting", icon: BookOpen },
    long_tail: { label: "Long-tail", icon: Scroll },
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
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
        <div className="px-1 py-2 space-y-3">
            {/* Cluster toolbar — single dropdown replacing 3 buttons */}
            {hasClusterActions && (
                <div className="flex px-2 pb-2 border-b border-border">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7 w-full">
                                <Plus className="h-3 w-3" /> New Cluster
                                <ChevronDown className="h-3 w-3 ml-auto opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64">
                            {onCreateAiCluster && (
                                <DropdownMenuItem onClick={onCreateAiCluster} className="gap-2 py-2 cursor-pointer">
                                    <Wand2 className="h-4 w-4 text-primary" />
                                    <div>
                                        <div className="font-medium text-sm">AI Cluster</div>
                                        <div className="text-xs text-muted-foreground">Generate a full topical strategy with AI</div>
                                    </div>
                                </DropdownMenuItem>
                            )}
                            {onCreateManualCluster && (
                                <DropdownMenuItem onClick={onCreateManualCluster} className="gap-2 py-2 cursor-pointer">
                                    <FolderPlus className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                        <div className="font-medium text-sm">Manual Cluster</div>
                                        <div className="text-xs text-muted-foreground">Create empty and assign articles manually</div>
                                    </div>
                                </DropdownMenuItem>
                            )}
                            {onAutoCluster && (
                                <DropdownMenuItem onClick={onAutoCluster} className="gap-2 py-2 cursor-pointer">
                                    <Sparkles className="h-4 w-4 text-amber-500" />
                                    <div>
                                        <div className="font-medium text-sm">Auto-Cluster</div>
                                        <div className="text-xs text-muted-foreground">Group existing articles by topic similarity</div>
                                    </div>
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
                            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left group"
                        >
                            <ChevronDown className={cn(
                                "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                                isCompanyCollapsed && "-rotate-90"
                            )} />
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold text-sm">{company.companyName}</span>
                            <span className="ml-auto text-xs text-muted-foreground">
                                {totalArticles}
                            </span>
                        </button>

                        {!isCompanyCollapsed && (
                            <div className="pl-4 mt-1 space-y-1.5">
                                {/* Clusters */}
                                {company.clusters.map(({ cluster, roles }) => {
                                    const clusterKey = `cluster-${cluster.id}`;
                                    const isClusterCollapsed = collapsed[clusterKey];
                                    const clusterArticleCount = roles.reduce((sum, r) => sum + r.articles.length, 0);
                                    const isSelected = selectedClusterId === cluster.id;

                                    return (
                                        <div key={cluster.id}>
                                            <div className={cn(
                                                "flex items-center gap-2 w-full px-3 py-2 rounded-md border transition-colors text-left text-sm group",
                                                isSelected
                                                    ? "border-primary bg-primary/10"
                                                    : "border-border bg-card hover:bg-accent/50"
                                            )}>
                                                <button onClick={() => toggle(clusterKey)} className="shrink-0">
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
                                                        className="h-6 text-sm font-medium max-w-[180px]"
                                                    />
                                                ) : (
                                                    <button
                                                        onClick={() => onSelectCluster?.(cluster.id)}
                                                        onDoubleClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingClusterId(cluster.id);
                                                            setEditingName(cluster.name);
                                                        }}
                                                        className="font-medium cursor-pointer flex items-center gap-1.5 flex-1 min-w-0 text-left"
                                                        title="Click to view · Double-click to rename"
                                                    >
                                                        <Network className="h-3.5 w-3.5 text-primary shrink-0" />
                                                        <span className="truncate">{cluster.name}</span>
                                                    </button>
                                                )}
                                                <Badge variant={
                                                    cluster.status === "complete" ? "default" :
                                                    cluster.status === "in_progress" ? "secondary" : "outline"
                                                } className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                                                    {cluster.status}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground shrink-0">
                                                    {clusterArticleCount}
                                                </span>
                                                {/* Delete cluster action */}
                                                {onDeleteCluster && (
                                                    confirmDeleteId === cluster.id ? (
                                                        <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                                                            <button onClick={() => { onDeleteCluster(cluster.id); setConfirmDeleteId(null); }}
                                                                className="text-[10px] text-destructive font-semibold hover:underline">Yes</button>
                                                            <span className="text-[10px] text-muted-foreground">/</span>
                                                            <button onClick={() => setConfirmDeleteId(null)}
                                                                className="text-[10px] text-muted-foreground hover:underline">No</button>
                                                        </div>
                                                    ) : (
                                                        <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(cluster.id); }}
                                                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive">
                                                            <Trash2 className="h-3 w-3" />
                                                        </button>
                                                    )
                                                )}
                                            </div>

                                            {!isClusterCollapsed && (
                                                <div className="pl-5 mt-1 space-y-0.5">
                                                    {roles.map(({ role, articles: roleArticles }) => {
                                                        const roleKey = `role-${cluster.id}-${role}`;
                                                        const isRoleCollapsed = collapsed[roleKey];
                                                        const meta = ROLE_META[role] || { label: role, icon: FileText };
                                                        const Icon = meta.icon;

                                                        return (
                                                            <div key={roleKey}>
                                                                <button
                                                                    onClick={() => toggle(roleKey)}
                                                                    className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                                                                >
                                                                    <ChevronDown className={cn(
                                                                        "h-2.5 w-2.5 transition-transform duration-200",
                                                                        isRoleCollapsed && "-rotate-90"
                                                                    )} />
                                                                    <Icon className="h-3 w-3" />
                                                                    {meta.label}
                                                                    <span className="text-muted-foreground/60">({roleArticles.length})</span>
                                                                </button>

                                                                {!isRoleCollapsed && (
                                                                    <div className="pl-4 space-y-px">
                                                                        {roleArticles.map((article) => (
                                                                            <button
                                                                                key={article.id}
                                                                                onClick={() => onSelectArticle(article.id)}
                                                                                className={cn(
                                                                                    "block w-full px-2.5 py-1.5 text-left rounded-md transition-colors text-sm",
                                                                                    selectedArticleId === article.id
                                                                                        ? "bg-primary/10 text-primary border-l-2 border-primary font-medium"
                                                                                        : "text-foreground/80 hover:bg-accent border-l-2 border-transparent"
                                                                                )}
                                                                            >
                                                                                <div className="truncate">/{article.slug}</div>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
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
                                            className="flex items-center gap-2 w-full px-3 py-2 rounded-md border border-dashed border-border bg-muted/30 hover:bg-muted/60 transition-colors text-left text-sm text-muted-foreground"
                                        >
                                            <ChevronDown className={cn(
                                                "h-3 w-3 transition-transform duration-200",
                                                collapsed[`unclustered-${company.companyId}`] && "-rotate-90"
                                            )} />
                                            <FolderOpen className="h-3.5 w-3.5" />
                                            Unclustered
                                            <span className="text-xs ml-auto">{company.unclustered.length}</span>
                                        </button>

                                        {!collapsed[`unclustered-${company.companyId}`] && (
                                            <div className="pl-7 mt-1 space-y-px">
                                                {company.unclustered.map((article) => (
                                                    <button
                                                        key={article.id}
                                                        onClick={() => onSelectArticle(article.id)}
                                                        className={cn(
                                                            "block w-full px-2.5 py-1.5 text-left rounded-md transition-colors text-sm",
                                                            selectedArticleId === article.id
                                                                ? "bg-primary/10 text-primary border-l-2 border-primary font-medium"
                                                                : "text-foreground/80 hover:bg-accent border-l-2 border-transparent"
                                                        )}
                                                    >
                                                        <div className="truncate">/{article.slug}</div>
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
