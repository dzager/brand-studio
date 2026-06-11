// ClusterDiagram.tsx — Hub-and-spoke SVG visualization for a single content cluster
// Pillar at center, supporting pages in a ring, long-tail pages radiating outward

import { useMemo, useState, useEffect, useRef } from "react";
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

type DiagramNode = {
    id: string;
    slug: string;
    label: string;
    role: "pillar" | "supporting" | "long_tail";
    x: number;
    y: number;
    radius: number;
    generated: boolean;
    articleId: string | null;
    animDelay: number;
    parentSlug: string | null; // for long-tail → supporting linking
};

type DiagramEdge = {
    sourceSlug: string;
    targetSlug: string;
};

type Props = {
    strategy: ClusterStrategy;
    articles: ClusterArticle[];
    onSelectArticle: (id: string) => void;
    onHighlightSlug?: (slug: string | null) => void;
    className?: string;
};

// Layout constants
const CX = 300;
const CY = 220;
const SUPPORTING_RING_RADIUS = 130;
const LONGTAIL_OFFSET = 75;
const PILLAR_R = 36;
const SUPPORTING_R = 20;
const LONGTAIL_R = 12;
const SVG_W = 600;
const SVG_H = 440;

const ROLE_COLORS = {
    pillar: { fill: "hsl(264, 65%, 55%)", fillDark: "hsl(264, 55%, 45%)", stroke: "hsl(264, 50%, 40%)" },
    supporting: { fill: "hsl(150, 55%, 45%)", fillDark: "hsl(150, 45%, 35%)", stroke: "hsl(150, 40%, 32%)" },
    long_tail: { fill: "hsl(30, 65%, 55%)", fillDark: "hsl(30, 55%, 42%)", stroke: "hsl(30, 50%, 38%)" },
};

function truncateLabel(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 1) + "…";
}

/** Find the supporting slug that a long-tail links to (first match) */
function findParentSlug(page: ClusterPage, supportingSlugs: Set<string>, pillarSlug: string): string | null {
    for (const slug of page.links_to || []) {
        if (supportingSlugs.has(slug)) return slug;
    }
    // Fallback: link to pillar if no supporting parent found
    if (page.links_to?.includes(pillarSlug)) return pillarSlug;
    return null;
}

export default function ClusterDiagram({ strategy, articles, onSelectArticle, onHighlightSlug, className }: Props) {
    const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [isDark, setIsDark] = useState(false);
    const svgRef = useRef<SVGSVGElement>(null);

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

    // Build article lookup
    const articleMap = useMemo(() => {
        const map: Record<string, ClusterArticle> = {};
        articles.forEach((a) => { map[a.slug] = a; });
        return map;
    }, [articles]);

    // Build layout
    const { nodes, edges } = useMemo(() => {
        if (!strategy?.pillar) return { nodes: [], edges: [] };

        const nodes: DiagramNode[] = [];
        const edges: DiagramEdge[] = [];
        const supportingSlugs = new Set((strategy.supporting || []).map((p) => p.slug));
        let animIdx = 0;

        // Pillar — center
        const pillarArticle = articleMap[strategy.pillar.slug];
        nodes.push({
            id: `pillar-0`,
            slug: strategy.pillar.slug,
            label: strategy.pillar.title,
            role: "pillar",
            x: CX,
            y: CY,
            radius: PILLAR_R,
            generated: !!pillarArticle,
            articleId: pillarArticle?.id || null,
            animDelay: animIdx++ * 60,
            parentSlug: null,
        });

        // Supporting — ring around pillar
        const supporting = strategy.supporting || [];
        const supportingNodes: DiagramNode[] = [];
        supporting.forEach((page, i) => {
            const angle = (i / supporting.length) * Math.PI * 2 - Math.PI / 2;
            const x = CX + Math.cos(angle) * SUPPORTING_RING_RADIUS;
            const y = CY + Math.sin(angle) * SUPPORTING_RING_RADIUS;
            const article = articleMap[page.slug];
            const node: DiagramNode = {
                id: `supporting-${i}`,
                slug: page.slug,
                label: page.title,
                role: "supporting",
                x,
                y,
                radius: SUPPORTING_R,
                generated: !!article,
                articleId: article?.id || null,
                animDelay: animIdx++ * 60,
                parentSlug: null,
            };
            nodes.push(node);
            supportingNodes.push(node);

            // Edge: pillar → supporting
            edges.push({ sourceSlug: strategy.pillar.slug, targetSlug: page.slug });
        });

        // Long-tail — radiating from their parent supporting page
        const longTail = strategy.long_tail || [];
        // Group long-tail by parent supporting slug
        const ltByParent: Record<string, { page: ClusterPage; idx: number }[]> = {};
        longTail.forEach((page, idx) => {
            const parent = findParentSlug(page, supportingSlugs, strategy.pillar.slug);
            const key = parent || "__orphan__";
            if (!ltByParent[key]) ltByParent[key] = [];
            ltByParent[key].push({ page, idx });
        });

        // Position long-tail nodes around their parent
        for (const [parentSlug, ltPages] of Object.entries(ltByParent)) {
            const parentNode = parentSlug === "__orphan__"
                ? null
                : nodes.find((n) => n.slug === parentSlug);

            ltPages.forEach((lt, ltIdx) => {
                const article = articleMap[lt.page.slug];
                let x: number, y: number;

                if (parentNode) {
                    // Fan long-tail pages around the parent's radial direction
                    const parentAngle = Math.atan2(parentNode.y - CY, parentNode.x - CX);
                    const fanSpread = Math.PI * 0.4; // ±36° spread
                    const fanAngle = ltPages.length === 1
                        ? parentAngle
                        : parentAngle - fanSpread / 2 + (ltIdx / (ltPages.length - 1)) * fanSpread;
                    x = parentNode.x + Math.cos(fanAngle) * LONGTAIL_OFFSET;
                    y = parentNode.y + Math.sin(fanAngle) * LONGTAIL_OFFSET;
                } else {
                    // Orphan long-tail — place in outer ring
                    const angle = (lt.idx / longTail.length) * Math.PI * 2 - Math.PI / 2;
                    const outerR = SUPPORTING_RING_RADIUS + LONGTAIL_OFFSET;
                    x = CX + Math.cos(angle) * outerR;
                    y = CY + Math.sin(angle) * outerR;
                }

                nodes.push({
                    id: `long_tail-${lt.idx}`,
                    slug: lt.page.slug,
                    label: lt.page.title,
                    role: "long_tail",
                    x,
                    y,
                    radius: LONGTAIL_R,
                    generated: !!article,
                    articleId: article?.id || null,
                    animDelay: animIdx++ * 60,
                    parentSlug: parentNode?.slug || null,
                });

                // Edge: parent → long-tail
                if (parentNode) {
                    edges.push({ sourceSlug: parentNode.slug, targetSlug: lt.page.slug });
                }
            });
        }

        return { nodes, edges };
    }, [strategy, articleMap]);

    // Build slug → node lookup for edges
    const slugToNode = useMemo(() => {
        const map: Record<string, DiagramNode> = {};
        nodes.forEach((n) => { map[n.slug] = n; });
        return map;
    }, [nodes]);

    function handleNodeEnter(slug: string) {
        setHoveredSlug(slug);
        onHighlightSlug?.(slug);
    }

    function handleNodeLeave() {
        setHoveredSlug(null);
        onHighlightSlug?.(null);
    }

    function handleNodeClick(node: DiagramNode) {
        if (node.articleId) {
            onSelectArticle(node.articleId);
        }
    }

    if (!strategy?.pillar) return null;

    return (
        <div className={cn("relative w-full", className)}>
            <svg
                ref={svgRef}
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                className="w-full h-auto"
                style={{ maxHeight: 360 }}
            >
                {/* Arrowhead marker */}
                <defs>
                    <marker
                        id="cluster-arrow"
                        viewBox="0 0 10 8"
                        refX="9"
                        refY="4"
                        markerWidth="8"
                        markerHeight="6"
                        orient="auto-start-reverse"
                    >
                        <path
                            d="M 0 0 L 10 4 L 0 8 z"
                            fill={isDark ? "rgba(148,163,184,0.35)" : "rgba(100,116,139,0.35)"}
                        />
                    </marker>
                </defs>

                {/* Edges */}
                {edges.map((edge, i) => {
                    const source = slugToNode[edge.sourceSlug];
                    const target = slugToNode[edge.targetSlug];
                    if (!source || !target) return null;

                    // Calculate control point for a subtle curve
                    const mx = (source.x + target.x) / 2;
                    const my = (source.y + target.y) / 2;
                    // Offset control point perpendicular to the line
                    const dx = target.x - source.x;
                    const dy = target.y - source.y;
                    const len = Math.sqrt(dx * dx + dy * dy) || 1;
                    const curvature = 15;
                    const cx = mx + (-dy / len) * curvature;
                    const cy = my + (dx / len) * curvature;

                    // Shorten the path to stop at the edge of the target node
                    const toTargetDx = target.x - cx;
                    const toTargetDy = target.y - cy;
                    const toTargetLen = Math.sqrt(toTargetDx * toTargetDx + toTargetDy * toTargetDy) || 1;
                    const endX = target.x - (toTargetDx / toTargetLen) * (target.radius + 4);
                    const endY = target.y - (toTargetDy / toTargetLen) * (target.radius + 4);

                    const isHighlighted = hoveredSlug === edge.sourceSlug || hoveredSlug === edge.targetSlug;

                    return (
                        <path
                            key={`edge-${i}`}
                            d={`M ${source.x} ${source.y} Q ${cx} ${cy} ${endX} ${endY}`}
                            fill="none"
                            stroke={isDark
                                ? (isHighlighted ? "rgba(148,163,184,0.5)" : "rgba(148,163,184,0.18)")
                                : (isHighlighted ? "rgba(100,116,139,0.5)" : "rgba(100,116,139,0.18)")
                            }
                            strokeWidth={isHighlighted ? 2 : 1.2}
                            markerEnd="url(#cluster-arrow)"
                            style={{
                                opacity: mounted ? 1 : 0,
                                transition: `opacity 400ms ease-out ${200}ms, stroke 200ms ease, stroke-width 200ms ease`,
                            }}
                        />
                    );
                })}

                {/* Nodes */}
                {nodes.map((node) => {
                    const colors = ROLE_COLORS[node.role];
                    const isHovered = hoveredSlug === node.slug;
                    const fillColor = node.generated
                        ? (isDark ? colors.fillDark : colors.fill)
                        : "transparent";
                    const strokeColor = node.generated
                        ? (isDark ? colors.fillDark : colors.stroke)
                        : (isDark ? colors.fillDark : colors.fill);

                    const labelMaxLen = node.role === "pillar" ? 28 : node.role === "supporting" ? 18 : 14;

                    return (
                        <g
                            key={node.id}
                            style={{
                                cursor: node.articleId ? "pointer" : "default",
                                opacity: mounted ? 1 : 0,
                                transform: mounted ? "scale(1)" : "scale(0)",
                                transformOrigin: `${node.x}px ${node.y}px`,
                                transition: `opacity 300ms ease-out ${node.animDelay}ms, transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1) ${node.animDelay}ms`,
                            }}
                            onMouseEnter={() => handleNodeEnter(node.slug)}
                            onMouseLeave={handleNodeLeave}
                            onClick={() => handleNodeClick(node)}
                        >
                            {/* Hover glow */}
                            {isHovered && (
                                <circle
                                    cx={node.x}
                                    cy={node.y}
                                    r={node.radius + 6}
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
                                strokeWidth={node.generated ? 2 : 2}
                                strokeDasharray={node.generated ? "none" : "4 3"}
                                style={{ transition: "r 150ms ease" }}
                            />

                            {/* Role icon inside pillar */}
                            {node.role === "pillar" && (
                                <text
                                    x={node.x}
                                    y={node.y + 1}
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    fontSize={16}
                                    fontWeight={700}
                                    fill={node.generated ? "white" : (isDark ? colors.fill : colors.fill)}
                                    style={{ pointerEvents: "none" }}
                                >
                                    ⬡
                                </text>
                            )}

                            {/* Label — always visible for pillar/supporting, hover-only for long-tail */}
                            {(node.role !== "long_tail" || isHovered) && (
                                <text
                                    x={node.x}
                                    y={node.y + node.radius + 14}
                                    textAnchor="middle"
                                    fontSize={node.role === "pillar" ? 12 : 10}
                                    fontWeight={node.role === "pillar" ? 600 : 500}
                                    fill={isDark ? "#cbd5e1" : "#374151"}
                                    style={{ pointerEvents: "none" }}
                                >
                                    {truncateLabel(node.label, labelMaxLen)}
                                </text>
                            )}
                        </g>
                    );
                })}

                {/* Hover tooltip card */}
                {hoveredSlug && (() => {
                    const node = slugToNode[hoveredSlug];
                    if (!node) return null;
                    const tooltipW = 200;
                    const tooltipH = 48;
                    let tx = node.x - tooltipW / 2;
                    let ty = node.y - node.radius - tooltipH - 12;
                    // Clamp to viewBox
                    tx = Math.max(4, Math.min(SVG_W - tooltipW - 4, tx));
                    ty = Math.max(4, ty);

                    return (
                        <g style={{ pointerEvents: "none" }}>
                            <rect
                                x={tx}
                                y={ty}
                                width={tooltipW}
                                height={tooltipH}
                                rx={6}
                                fill={isDark ? "hsl(260, 15%, 14%)" : "white"}
                                stroke={isDark ? "hsl(260, 10%, 25%)" : "hsl(220, 13%, 86%)"}
                                strokeWidth={1}
                                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.12))"
                            />
                            <text
                                x={tx + 10}
                                y={ty + 18}
                                fontSize={11}
                                fontWeight={600}
                                fill={isDark ? "#e2e8f0" : "#1e293b"}
                            >
                                {truncateLabel(node.label, 32)}
                            </text>
                            <text
                                x={tx + 10}
                                y={ty + 34}
                                fontSize={9}
                                fill={isDark ? "#94a3b8" : "#64748b"}
                            >
                                {node.role === "pillar" ? "Pillar" : node.role === "supporting" ? "Supporting" : "Long-tail"}
                                {node.generated ? " · ✓ Generated" : " · Planned"}
                                {node.articleId ? " · Click to view" : ""}
                            </text>
                        </g>
                    );
                })()}
            </svg>

            {/* Legend */}
            <div className="flex items-center gap-4 justify-center mt-1 text-[10px] text-muted-foreground">
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
