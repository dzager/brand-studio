// OutlineView.tsx — Collapsible tree hierarchy for content management
// Company → Cluster → Role Group → Article

import { useState, useMemo } from "react";

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
};

type Props = {
    articles: Article[];
    clusters: Cluster[];
    companies: Record<string, string>;
    selectedArticleId: string | null;
    onSelectArticle: (id: string) => void;
    onRenameCluster?: (id: string, newName: string) => void;
};

const ROLE_ORDER = ["pillar", "supporting", "long_tail"];
const ROLE_LABELS: Record<string, string> = {
    pillar: "🏛 Pillar",
    supporting: "📘 Supporting",
    long_tail: "📑 Long-tail",
};
const ROLE_COLORS: Record<string, { bg: string; fg: string }> = {
    pillar: { bg: "#eef2ff", fg: "#4338ca" },
    supporting: { bg: "#f0fdf4", fg: "#16a34a" },
    long_tail: { bg: "#fefce8", fg: "#a16207" },
};
const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
    draft: { bg: "#f5f5f5", fg: "#666" },
    in_progress: { bg: "#fffbeb", fg: "#b45309" },
    complete: { bg: "#f0fdf4", fg: "#16a34a" },
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

export default function OutlineView({ articles, clusters, companies, selectedArticleId, onSelectArticle, onRenameCluster }: Props) {
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
        const companyGroups: Record<string, Article[]> = {};
        articles.forEach((a) => {
            const cid = a.company_id || "__none__";
            if (!companyGroups[cid]) companyGroups[cid] = [];
            companyGroups[cid].push(a);
        });

        const clusterMap: Record<string, Cluster> = {};
        clusters.forEach((c) => { clusterMap[c.id] = c; });

        return Object.entries(companyGroups).map(([companyId, companyArticles]) => {
            const clusterGroups: Record<string, Article[]> = {};
            const unclustered: Article[] = [];

            companyArticles.forEach((a) => {
                if (a.cluster_id) {
                    if (!clusterGroups[a.cluster_id]) clusterGroups[a.cluster_id] = [];
                    clusterGroups[a.cluster_id].push(a);
                } else {
                    unclustered.push(a);
                }
            });

            const clusterEntries = Object.entries(clusterGroups).map(([clusterId, clusterArticles]) => {
                const roleGroups: Record<string, Article[]> = {};
                clusterArticles.forEach((a) => {
                    const role = a.cluster_role || "other";
                    if (!roleGroups[role]) roleGroups[role] = [];
                    roleGroups[role].push(a);
                });

                const roles = ROLE_ORDER
                    .filter((r) => roleGroups[r])
                    .map((r) => ({ role: r, articles: roleGroups[r] }));

                // Add any roles not in ROLE_ORDER
                Object.keys(roleGroups).forEach((r) => {
                    if (!ROLE_ORDER.includes(r)) {
                        roles.push({ role: r, articles: roleGroups[r] });
                    }
                });

                return {
                    cluster: clusterMap[clusterId] || { id: clusterId, name: "Unknown Cluster", status: "draft", strategy: null },
                    roles,
                };
            });

            return {
                companyId,
                companyName: companyId === "__none__" ? "No Company" : (companies[companyId] || "Unknown"),
                clusters: clusterEntries,
                unclustered,
            };
        });
    }, [articles, clusters, companies]);

    return (
        <div style={{ padding: "0 4px" }}>
            {tree.map((company) => {
                const companyKey = `company-${company.companyId}`;
                const isCompanyCollapsed = collapsed[companyKey];
                const totalArticles = articles.filter((a) => (a.company_id || "__none__") === company.companyId).length;

                return (
                    <div key={company.companyId} style={{ marginBottom: 16 }}>
                        {/* Company header */}
                        <button
                            onClick={() => toggle(companyKey)}
                            style={{
                                display: "flex", alignItems: "center", gap: 8, width: "100%",
                                padding: "10px 14px", border: "none", background: "#f8f9fa",
                                borderRadius: 8, cursor: "pointer", fontSize: 15, fontWeight: 600,
                                color: "#191F1D", textAlign: "left",
                            }}
                        >
                            <span style={{ fontSize: 11, color: "#888", transition: "transform 0.15s", transform: isCompanyCollapsed ? "rotate(-90deg)" : "rotate(0)" }}>▼</span>
                            <span>🏢 {company.companyName}</span>
                            <span style={{ fontSize: 12, color: "#888", fontWeight: 400, marginLeft: "auto" }}>
                                {totalArticles} article{totalArticles !== 1 ? "s" : ""}
                            </span>
                        </button>

                        {!isCompanyCollapsed && (
                            <div style={{ paddingLeft: 16, marginTop: 4 }}>
                                {/* Clusters */}
                                {company.clusters.map(({ cluster, roles }) => {
                                    const clusterKey = `cluster-${cluster.id}`;
                                    const isClusterCollapsed = collapsed[clusterKey];
                                    const clusterArticleCount = roles.reduce((sum, r) => sum + r.articles.length, 0);
                                    const statusStyle = STATUS_COLORS[cluster.status] || STATUS_COLORS.draft;

                                    return (
                                        <div key={cluster.id} style={{ marginBottom: 8 }}>
                                            <button
                                                onClick={() => toggle(clusterKey)}
                                                style={{
                                                    display: "flex", alignItems: "center", gap: 8, width: "100%",
                                                    padding: "8px 12px", border: "1px solid #e5e5e5", background: "#fff",
                                                    borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 500,
                                                    color: "#333", textAlign: "left",
                                                }}
                                            >
                                                <span style={{ fontSize: 10, color: "#888", transition: "transform 0.15s", transform: isClusterCollapsed ? "rotate(-90deg)" : "rotate(0)" }}>▼</span>
                                                {editingClusterId === cluster.id ? (
                                                    <input
                                                        autoFocus
                                                        value={editingName}
                                                        onChange={(e) => setEditingName(e.target.value)}
                                                        onBlur={() => saveClusterName(cluster.id)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") { e.preventDefault(); saveClusterName(cluster.id); }
                                                            if (e.key === "Escape") setEditingClusterId(null);
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        style={{
                                                            fontSize: 14, fontWeight: 500, padding: "2px 6px",
                                                            border: "1px solid #6366f1", borderRadius: 4,
                                                            outline: "none", background: "#fff", color: "#333",
                                                            width: "100%", maxWidth: 200, fontFamily: "inherit",
                                                        }}
                                                    />
                                                ) : (
                                                    <span
                                                        onDoubleClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingClusterId(cluster.id);
                                                            setEditingName(cluster.name);
                                                        }}
                                                        title="Double-click to rename"
                                                        style={{ cursor: "text" }}
                                                    >
                                                        🔗 {cluster.name}
                                                    </span>
                                                )}
                                                <span style={{
                                                    padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 500,
                                                    background: statusStyle.bg, color: statusStyle.fg,
                                                }}>
                                                    {cluster.status}
                                                </span>
                                                <span style={{ fontSize: 11, color: "#888", fontWeight: 400, marginLeft: "auto" }}>
                                                    {clusterArticleCount} article{clusterArticleCount !== 1 ? "s" : ""}
                                                </span>
                                            </button>

                                            {!isClusterCollapsed && (
                                                <div style={{ paddingLeft: 20, marginTop: 4 }}>
                                                    {roles.map(({ role, articles: roleArticles }) => {
                                                        const roleKey = `role-${cluster.id}-${role}`;
                                                        const isRoleCollapsed = collapsed[roleKey];
                                                        const roleColor = ROLE_COLORS[role] || { bg: "#f5f5f5", fg: "#666" };

                                                        return (
                                                            <div key={roleKey} style={{ marginBottom: 4 }}>
                                                                <button
                                                                    onClick={() => toggle(roleKey)}
                                                                    style={{
                                                                        display: "flex", alignItems: "center", gap: 6, width: "100%",
                                                                        padding: "5px 10px", border: "none", background: "transparent",
                                                                        cursor: "pointer", fontSize: 13, fontWeight: 500,
                                                                        color: roleColor.fg, textAlign: "left",
                                                                    }}
                                                                >
                                                                    <span style={{ fontSize: 9, color: "#aaa", transition: "transform 0.15s", transform: isRoleCollapsed ? "rotate(-90deg)" : "rotate(0)" }}>▼</span>
                                                                    {ROLE_LABELS[role] || role}
                                                                    <span style={{ fontSize: 11, color: "#bbb", fontWeight: 400 }}>({roleArticles.length})</span>
                                                                </button>

                                                                {!isRoleCollapsed && (
                                                                    <div style={{ paddingLeft: 18 }}>
                                                                        {roleArticles.map((article) => (
                                                                            <button
                                                                                key={article.id}
                                                                                onClick={() => onSelectArticle(article.id)}
                                                                                style={{
                                                                                    display: "block", width: "100%", padding: "6px 10px",
                                                                                    border: "none", borderLeft: selectedArticleId === article.id ? "3px solid #6366f1" : "3px solid transparent",
                                                                                    background: selectedArticleId === article.id ? "#eef2ff" : "transparent",
                                                                                    cursor: "pointer", fontSize: 13, color: "#333",
                                                                                    textAlign: "left", borderRadius: 4, marginBottom: 1,
                                                                                    transition: "all 0.1s",
                                                                                }}
                                                                            >
                                                                                <div style={{ fontWeight: selectedArticleId === article.id ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                                    {article.title}
                                                                                </div>
                                                                                <div style={{ fontSize: 11, color: "#999" }}>/{article.slug}</div>
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
                                    <div style={{ marginBottom: 8 }}>
                                        <button
                                            onClick={() => toggle(`unclustered-${company.companyId}`)}
                                            style={{
                                                display: "flex", alignItems: "center", gap: 8, width: "100%",
                                                padding: "8px 12px", border: "1px dashed #ddd", background: "#fafafa",
                                                borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 500,
                                                color: "#888", textAlign: "left",
                                            }}
                                        >
                                            <span style={{ fontSize: 10, color: "#aaa", transition: "transform 0.15s", transform: collapsed[`unclustered-${company.companyId}`] ? "rotate(-90deg)" : "rotate(0)" }}>▼</span>
                                            📄 Unclustered Articles
                                            <span style={{ fontSize: 11, color: "#bbb", fontWeight: 400, marginLeft: "auto" }}>
                                                {company.unclustered.length}
                                            </span>
                                        </button>

                                        {!collapsed[`unclustered-${company.companyId}`] && (
                                            <div style={{ paddingLeft: 28, marginTop: 4 }}>
                                                {company.unclustered.map((article) => (
                                                    <button
                                                        key={article.id}
                                                        onClick={() => onSelectArticle(article.id)}
                                                        style={{
                                                            display: "block", width: "100%", padding: "6px 10px",
                                                            border: "none", borderLeft: selectedArticleId === article.id ? "3px solid #6366f1" : "3px solid transparent",
                                                            background: selectedArticleId === article.id ? "#eef2ff" : "transparent",
                                                            cursor: "pointer", fontSize: 13, color: "#333",
                                                            textAlign: "left", borderRadius: 4, marginBottom: 1,
                                                        }}
                                                    >
                                                        <div style={{ fontWeight: selectedArticleId === article.id ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                            {article.title}
                                                        </div>
                                                        <div style={{ fontSize: 11, color: "#999" }}>/{article.slug}</div>
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

            {articles.length === 0 && (
                <div style={{ textAlign: "center", padding: 40, color: "#888" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
                    <p>No articles yet. Create content to see your knowledge tree.</p>
                </div>
            )}
        </div>
    );
}
