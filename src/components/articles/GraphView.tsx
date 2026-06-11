// GraphView.tsx — Multi-cluster hub-and-spoke SVG visualization
// Each cluster rendered as a radial group: pillar at center, supporting in ring, long-tail radiating outward

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Article = {
    id: string;
    title: string;
    slug: string;
    cluster_id: string | null;
    cluster_role: string | null;
    company_id: string | null;
};

type Cluster = {
    id: string;
    name: string;
    strategy: any;
    company_id: string;
};

type Props = {
    articles: Article[];
    clusters: Cluster[];
    companies: Record<string, string>;
    onSelectArticle: (id: string) => void;
};

// Layout constants per cluster cell
const CLUSTER_CELL_W = 350;
const CLUSTER_CELL_H = 340;
const PILLAR_R = 30;
const SUPPORTING_R = 16;
const LONGTAIL_R = 10;
const SUPPORTING_RING = 100;
const LONGTAIL_OFFSET = 55;

const ROLE_COLORS = {
    pillar: { fill: "hsl(264, 65%, 55%)", fillDark: "hsl(264, 55%, 45%)", stroke: "hsl(264, 50%, 40%)" },
    supporting: { fill: "hsl(150, 55%, 45%)", fillDark: "hsl(150, 45%, 35%)", stroke: "hsl(150, 40%, 32%)" },
    long_tail: { fill: "hsl(30, 65%, 55%)", fillDark: "hsl(30, 55%, 42%)", stroke: "hsl(30, 50%, 38%)" },
};

type StrategyPage = { title: string; slug: string; keyword?: string; links_to?: string[] };

type DiagramNode = {
    slug: string;
    label: string;
    keyword: string;
    role: "pillar" | "supporting" | "long_tail";
    x: number;
    y: number;
    radius: number;
    generated: boolean;
    articleId: string | null;
    clusterId: string;
    clusterIdx: number;
};

type DiagramEdge = {
    x1: number; y1: number;
    x2: number; y2: number;
    clusterIdx: number;
};

function truncate(text: string, max: number): string {
    return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

function findParentSlug(page: StrategyPage, supportingSlugs: Set<string>): string | null {
    for (const slug of page.links_to || []) {
        if (supportingSlugs.has(slug)) return slug;
    }
    return null;
}

export default function GraphView({ articles, clusters, companies, onSelectArticle }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(900);
    const [mounted, setMounted] = useState(false);
    const [isDark, setIsDark] = useState(false);
    const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
    const [hoveredClusterId, setHoveredClusterId] = useState<string | null>(null);
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>("__all__");

    // Detect mount for entrance animation
    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 50);
        return () => clearTimeout(timer);
    }, []);

    // Detect dark mode
    useEffect(() => {
        const check = () => setIsDark(document.documentElement.classList.contains("dark"));
        check();
        const observer = new MutationObserver(check);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return () => observer.disconnect();
    }, []);

    // ResizeObserver for container width
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) setContainerWidth(entry.contentRect.width);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Company filter options
    const companyOptions = useMemo(() => {
        const ids = Array.from(new Set(clusters.map((c) => c.company_id).filter(Boolean)));
        return ids.map((id) => ({ id, name: companies[id] || id })).sort((a, b) => a.name.localeCompare(b.name));
    }, [clusters, companies]);

    // Filtered data
    const filteredClusters = useMemo(() => {
        if (selectedCompanyId === "__all__") return clusters;
        return clusters.filter((c) => c.company_id === selectedCompanyId);
    }, [clusters, selectedCompanyId]);

    // Grid layout: how many columns fit
    const cols = Math.max(1, Math.floor(containerWidth / CLUSTER_CELL_W));
    const rows = Math.ceil(filteredClusters.length / cols);
    const svgW = cols * CLUSTER_CELL_W;
    const svgH = rows * CLUSTER_CELL_H + 20; // a little bottom padding

    // Build all nodes + edges for every cluster
    const { nodes, edges } = useMemo(() => {
        const allNodes: DiagramNode[] = [];
        const allEdges: DiagramEdge[] = [];

        filteredClusters.forEach((cluster, clusterIdx) => {
            const strategy = cluster.strategy;
            if (!strategy?.pillar) return;

            // Grid position for this cluster
            const col = clusterIdx % cols;
            const row = Math.floor(clusterIdx / cols);
            const cx = col * CLUSTER_CELL_W + CLUSTER_CELL_W / 2;
            const cy = row * CLUSTER_CELL_H + CLUSTER_CELL_H / 2 + 20; // offset for label

            const supporting: StrategyPage[] = strategy.supporting || [];
            const longTail: StrategyPage[] = strategy.long_tail || [];
            const supportingSlugs = new Set(supporting.map((p: StrategyPage) => p.slug));

            // Helper: find article for a strategy page
            const findArticle = (slug: string) =>
                articles.find((a) => a.cluster_id === cluster.id && a.slug === slug);

            // Pillar
            const pillarArticle = findArticle(strategy.pillar.slug);
            allNodes.push({
                slug: strategy.pillar.slug,
                label: strategy.pillar.title,
                keyword: (strategy.pillar as any).keyword || "",
                role: "pillar",
                x: cx, y: cy,
                radius: PILLAR_R,
                generated: !!pillarArticle,
                articleId: pillarArticle?.id || null,
                clusterId: cluster.id,
                clusterIdx,
            });

            // Supporting nodes in a ring
            const supportingNodePositions: Record<string, { x: number; y: number }> = {};
            supporting.forEach((page: StrategyPage, i: number) => {
                const angle = (i / supporting.length) * Math.PI * 2 - Math.PI / 2;
                const sx = cx + Math.cos(angle) * SUPPORTING_RING;
                const sy = cy + Math.sin(angle) * SUPPORTING_RING;
                supportingNodePositions[page.slug] = { x: sx, y: sy };

                const article = findArticle(page.slug);
                allNodes.push({
                    slug: page.slug,
                    label: page.title,
                    keyword: (page as any).keyword || "",
                    role: "supporting",
                    x: sx, y: sy,
                    radius: SUPPORTING_R,
                    generated: !!article,
                    articleId: article?.id || null,
                    clusterId: cluster.id,
                    clusterIdx,
                });

                // Edge: pillar → supporting
                allEdges.push({ x1: cx, y1: cy, x2: sx, y2: sy, clusterIdx });
            });

            // Long-tail: group by parent supporting page
            const ltByParent: Record<string, { page: StrategyPage; idx: number }[]> = {};
            longTail.forEach((page: StrategyPage, idx: number) => {
                const parent = findParentSlug(page, supportingSlugs);
                const key = parent || "__orphan__";
                if (!ltByParent[key]) ltByParent[key] = [];
                ltByParent[key].push({ page, idx });
            });

            for (const [parentSlug, ltPages] of Object.entries(ltByParent)) {
                const parentPos = parentSlug !== "__orphan__" ? supportingNodePositions[parentSlug] : null;

                ltPages.forEach((lt, ltIdx) => {
                    const article = findArticle(lt.page.slug);
                    let lx: number, ly: number;

                    if (parentPos) {
                        const parentAngle = Math.atan2(parentPos.y - cy, parentPos.x - cx);
                        const fanSpread = Math.PI * 0.5;
                        const fanAngle = ltPages.length === 1
                            ? parentAngle
                            : parentAngle - fanSpread / 2 + (ltIdx / (ltPages.length - 1)) * fanSpread;
                        lx = parentPos.x + Math.cos(fanAngle) * LONGTAIL_OFFSET;
                        ly = parentPos.y + Math.sin(fanAngle) * LONGTAIL_OFFSET;

                        // Edge: supporting → long-tail
                        allEdges.push({ x1: parentPos.x, y1: parentPos.y, x2: lx, y2: ly, clusterIdx });
                    } else {
                        // Orphan: outer ring
                        const angle = (lt.idx / longTail.length) * Math.PI * 2 - Math.PI / 2;
                        const outerR = SUPPORTING_RING + LONGTAIL_OFFSET;
                        lx = cx + Math.cos(angle) * outerR;
                        ly = cy + Math.sin(angle) * outerR;
                        allEdges.push({ x1: cx, y1: cy, x2: lx, y2: ly, clusterIdx });
                    }

                    allNodes.push({
                        slug: lt.page.slug,
                        label: lt.page.title,
                        keyword: (lt.page as any).keyword || "",
                        role: "long_tail",
                        x: lx, y: ly,
                        radius: LONGTAIL_R,
                        generated: !!article,
                        articleId: article?.id || null,
                        clusterId: cluster.id,
                        clusterIdx,
                    });
                });
            }
        });

        return { nodes: allNodes, edges: allEdges };
    }, [filteredClusters, articles, cols]);

    // Slug → node lookup for tooltip
    const nodeByKey = useMemo(() => {
        const map: Record<string, DiagramNode> = {};
        nodes.forEach((n) => { map[`${n.clusterId}:${n.slug}`] = n; });
        return map;
    }, [nodes]);

    const hoveredNode = hoveredSlug && hoveredClusterId
        ? nodeByKey[`${hoveredClusterId}:${hoveredSlug}`] ?? null
        : null;

    const handleNodeClick = useCallback((node: DiagramNode) => {
        if (node.articleId) onSelectArticle(node.articleId);
    }, [onSelectArticle]);

    return (
        <div ref={containerRef} className="relative w-full h-[calc(100vh-14rem)] overflow-auto">
            {/* Company filter */}
            {companyOptions.length > 1 && (
                <div className="sticky top-0 z-10 px-4 py-2 bg-background/80 backdrop-blur-sm border-b border-border">
                    <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                        <SelectTrigger className="h-8 w-48 text-xs">
                            <SelectValue placeholder="All companies" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all__">All companies</SelectItem>
                            {companyOptions.map((co) => (
                                <SelectItem key={co.id} value={co.id}>{co.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {filteredClusters.length === 0 && (
                <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                    No clusters to display.
                </div>
            )}

            {filteredClusters.length > 0 && (
                <svg
                    width={svgW}
                    height={svgH}
                    viewBox={`0 0 ${svgW} ${svgH}`}
                    className="mx-auto"
                    style={{ minWidth: CLUSTER_CELL_W }}
                >
                    {/* Cluster labels */}
                    {filteredClusters.map((cluster, idx) => {
                        if (!cluster.strategy?.pillar) return null;
                        const col = idx % cols;
                        const row = Math.floor(idx / cols);
                        const cx = col * CLUSTER_CELL_W + CLUSTER_CELL_W / 2;
                        const ty = row * CLUSTER_CELL_H + 18;

                        return (
                            <text
                                key={`label-${cluster.id}`}
                                x={cx}
                                y={ty}
                                textAnchor="middle"
                                fontSize={13}
                                fontWeight={600}
                                fill={isDark ? "#cbd5e1" : "#374151"}
                                style={{
                                    opacity: mounted ? 1 : 0,
                                    transition: `opacity 400ms ease-out ${idx * 80}ms`,
                                }}
                            >
                                {truncate(cluster.name, 40)}
                            </text>
                        );
                    })}

                    {/* Edges */}
                    {edges.map((edge, i) => {
                        const dx = edge.x2 - edge.x1;
                        const dy = edge.y2 - edge.y1;
                        const len = Math.sqrt(dx * dx + dy * dy) || 1;
                        const curvature = 12;
                        const mx = (edge.x1 + edge.x2) / 2 + (-dy / len) * curvature;
                        const my = (edge.y1 + edge.y2) / 2 + (dx / len) * curvature;

                        return (
                            <path
                                key={`edge-${i}`}
                                d={`M ${edge.x1} ${edge.y1} Q ${mx} ${my} ${edge.x2} ${edge.y2}`}
                                fill="none"
                                stroke={isDark ? "rgba(148,163,184,0.2)" : "rgba(100,116,139,0.2)"}
                                strokeWidth={1.2}
                                style={{
                                    opacity: mounted ? 1 : 0,
                                    transition: `opacity 400ms ease-out ${edge.clusterIdx * 80 + 100}ms`,
                                }}
                            />
                        );
                    })}

                    {/* Nodes */}
                    {nodes.map((node, i) => {
                        const colors = ROLE_COLORS[node.role];
                        const isHovered = hoveredSlug === node.slug && hoveredClusterId === node.clusterId;
                        const fillColor = node.generated
                            ? (isDark ? colors.fillDark : colors.fill)
                            : "transparent";
                        const strokeColor = node.generated
                            ? (isDark ? colors.fillDark : colors.stroke)
                            : (isDark ? colors.fillDark : colors.fill);

                        return (
                            <g
                                key={`node-${node.clusterId}-${node.slug}`}
                                style={{
                                    cursor: node.articleId ? "pointer" : "default",
                                    opacity: mounted ? 1 : 0,
                                    transform: mounted ? "scale(1)" : "scale(0)",
                                    transformOrigin: `${node.x}px ${node.y}px`,
                                    transition: `opacity 300ms ease-out ${node.clusterIdx * 80 + 50}ms, transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1) ${node.clusterIdx * 80 + 50}ms`,
                                }}
                                onMouseEnter={() => {
                                    setHoveredSlug(node.slug);
                                    setHoveredClusterId(node.clusterId);
                                }}
                                onMouseLeave={() => {
                                    setHoveredSlug(null);
                                    setHoveredClusterId(null);
                                }}
                                onClick={() => handleNodeClick(node)}
                            >
                                {/* Hover glow */}
                                {isHovered && (
                                    <circle
                                        cx={node.x}
                                        cy={node.y}
                                        r={node.radius + 5}
                                        fill="none"
                                        stroke={isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)"}
                                        strokeWidth={2}
                                    />
                                )}

                                {/* Node circle */}
                                <circle
                                    cx={node.x}
                                    cy={node.y}
                                    r={isHovered ? node.radius + 2 : node.radius}
                                    fill={fillColor}
                                    stroke={strokeColor}
                                    strokeWidth={2}
                                    strokeDasharray={node.generated ? "none" : "4 3"}
                                    style={{ transition: "r 150ms ease" }}
                                />

                                {/* Pillar icon */}
                                {node.role === "pillar" && (
                                    <text
                                        x={node.x}
                                        y={node.y + 1}
                                        textAnchor="middle"
                                        dominantBaseline="central"
                                        fontSize={16}
                                        fontWeight={700}
                                        fill={node.generated ? "white" : colors.fill}
                                        style={{ pointerEvents: "none" }}
                                    >
                                        ⬡
                                    </text>
                                )}

                                {/* Labels for pillar + supporting (long-tail on hover only) */}
                                {(node.role !== "long_tail" || isHovered) && (
                                    <text
                                        x={node.x}
                                        y={node.y + node.radius + 13}
                                        textAnchor="middle"
                                        fontSize={node.role === "pillar" ? 11 : 9}
                                        fontWeight={node.role === "pillar" ? 600 : 500}
                                        fill={isDark ? "#cbd5e1" : "#374151"}
                                        style={{ pointerEvents: "none" }}
                                    >
                                        {truncate(node.label, node.role === "pillar" ? 26 : 18)}
                                    </text>
                                )}
                            </g>
                        );
                    })}

                    {/* Tooltip */}
                    {hoveredNode && (() => {
                        const tooltipW = 220;
                        const tooltipH = 56;
                        let tx = hoveredNode.x - tooltipW / 2;
                        let ty = hoveredNode.y - hoveredNode.radius - tooltipH - 10;
                        tx = Math.max(4, Math.min(svgW - tooltipW - 4, tx));
                        ty = Math.max(4, ty);

                        const roleLabel = hoveredNode.role === "pillar" ? "Pillar"
                            : hoveredNode.role === "supporting" ? "Supporting" : "Long-tail";

                        return (
                            <g style={{ pointerEvents: "none" }}>
                                <rect
                                    x={tx} y={ty}
                                    width={tooltipW} height={tooltipH}
                                    rx={6}
                                    fill={isDark ? "hsl(260, 15%, 14%)" : "white"}
                                    stroke={isDark ? "hsl(260, 10%, 25%)" : "hsl(220, 13%, 86%)"}
                                    strokeWidth={1}
                                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.12))"
                                />
                                <text x={tx + 10} y={ty + 17} fontSize={11} fontWeight={600}
                                    fill={isDark ? "#e2e8f0" : "#1e293b"}>
                                    {truncate(hoveredNode.label, 32)}
                                </text>
                                <text x={tx + 10} y={ty + 31} fontSize={9}
                                    fill={isDark ? "#94a3b8" : "#64748b"}>
                                    {roleLabel} {hoveredNode.generated ? " · ✓ Generated" : " · Planned"}
                                </text>
                                {hoveredNode.keyword && (
                                    <text x={tx + 10} y={ty + 45} fontSize={9}
                                        fill={isDark ? "#94a3b8" : "#64748b"}>
                                        🔑 {truncate(hoveredNode.keyword, 30)}
                                    </text>
                                )}
                            </g>
                        );
                    })()}
                </svg>
            )}

            {/* Legend */}
            <div className="sticky bottom-0 flex items-center gap-4 justify-center py-2 text-[10px] text-muted-foreground bg-background/80 backdrop-blur-sm border-t border-border">
                <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ background: ROLE_COLORS.pillar.fill }} />
                    Pillar
                </span>
                <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: ROLE_COLORS.supporting.fill }} />
                    Supporting
                </span>
                <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: ROLE_COLORS.long_tail.fill }} />
                    Long-tail
                </span>
                <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full border border-muted-foreground" />
                    Planned
                </span>
                <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground" />
                    Generated
                </span>
            </div>
        </div>
    );
}
