// GraphView.tsx — Force-directed canvas graph showing content topology
// Nodes = articles, edges = cluster links + semantic similarity

import { useRef, useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
};

type GraphNode = {
    id: string;
    label: string;
    cluster_id: string | null;
    role: string | null;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    color: string;
};

type GraphEdge = {
    source: string;
    target: string;
    type: "link" | "similarity";
    weight: number;
};

type Props = {
    articles: Article[];
    clusters: Cluster[];
    onSelectArticle: (id: string) => void;
};

const CLUSTER_HUES = [264, 150, 30, 330, 0, 60, 190, 320, 100, 350];

function getClusterColor(idx: number, light = false): string {
    const hue = CLUSTER_HUES[idx % CLUSTER_HUES.length];
    return light ? `hsl(${hue}, 70%, 92%)` : `hsl(${hue}, 65%, 55%)`;
}

function getRoleRadius(role: string | null): number {
    if (role === "pillar") return 22;
    if (role === "supporting") return 14;
    if (role === "long_tail") return 10;
    return 10;
}

export default function GraphView({ articles, clusters, onSelectArticle }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const nodesRef = useRef<GraphNode[]>([]);
    const edgesRef = useRef<GraphEdge[]>([]);
    const animRef = useRef<number>(0);
    const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
    const [dimensions, setDimensions] = useState({ w: 900, h: 500 });
    const dragRef = useRef<{ node: GraphNode; offsetX: number; offsetY: number } | null>(null);
    const isDarkRef = useRef(false);

    // Detect dark mode
    useEffect(() => {
        const check = () => {
            isDarkRef.current = document.documentElement.classList.contains("dark");
        };
        check();
        const observer = new MutationObserver(check);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return () => observer.disconnect();
    }, []);

    // Build graph data
    useEffect(() => {
        const clusterIndexMap: Record<string, number> = {};
        clusters.forEach((c, i) => { clusterIndexMap[c.id] = i; });

        const cx = dimensions.w / 2;
        const cy = dimensions.h / 2;

        const nodes: GraphNode[] = articles.map((a, i) => {
            const cIdx = a.cluster_id ? (clusterIndexMap[a.cluster_id] ?? -1) : -1;
            const angle = (i / articles.length) * Math.PI * 2;
            const spread = 150 + Math.random() * 100;
            return {
                id: a.id,
                label: a.title.length > 35 ? a.title.slice(0, 35) + "…" : a.title,
                cluster_id: a.cluster_id,
                role: a.cluster_role,
                x: cx + Math.cos(angle) * spread + (Math.random() - 0.5) * 40,
                y: cy + Math.sin(angle) * spread + (Math.random() - 0.5) * 40,
                vx: 0,
                vy: 0,
                radius: getRoleRadius(a.cluster_role),
                color: cIdx >= 0 ? getClusterColor(cIdx) : "#888",
            };
        });

        const edges: GraphEdge[] = [];
        const slugToId: Record<string, string> = {};
        articles.forEach((a) => { slugToId[a.slug] = a.id; });

        clusters.forEach((cluster) => {
            if (!cluster.strategy) return;
            const allPages = [
                cluster.strategy.pillar,
                ...(cluster.strategy.supporting || []),
                ...(cluster.strategy.long_tail || []),
            ].filter(Boolean);

            allPages.forEach((page: any) => {
                if (!page.links_to) return;
                const sourceArticle = articles.find(
                    (a) => a.cluster_id === cluster.id && a.slug === page.slug
                );
                if (!sourceArticle) return;

                page.links_to.forEach((targetSlug: string) => {
                    const targetArticle = articles.find(
                        (a) => a.cluster_id === cluster.id && a.slug === targetSlug
                    );
                    if (targetArticle) {
                        edges.push({
                            source: sourceArticle.id,
                            target: targetArticle.id,
                            type: "link",
                            weight: 1,
                        });
                    }
                });
            });
        });

        nodesRef.current = nodes;
        edgesRef.current = edges;
    }, [articles, clusters, dimensions]);

    // Physics simulation + render loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let running = true;

        function tick() {
            if (!running) return;
            const nodes = nodesRef.current;
            const edges = edgesRef.current;
            const damping = 0.92;
            const cx = dimensions.w / 2;
            const cy = dimensions.h / 2;
            const dark = isDarkRef.current;

            for (let i = 0; i < nodes.length; i++) {
                const a = nodes[i];
                a.vx += (cx - a.x) * 0.0005;
                a.vy += (cy - a.y) * 0.0005;

                for (let j = i + 1; j < nodes.length; j++) {
                    const b = nodes[j];
                    let dx = b.x - a.x;
                    let dy = b.y - a.y;
                    let dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const minDist = a.radius + b.radius + 30;
                    if (dist < minDist) {
                        const force = (minDist - dist) / dist * 0.5;
                        a.vx -= dx * force;
                        a.vy -= dy * force;
                        b.vx += dx * force;
                        b.vy += dy * force;
                    }

                    if (a.cluster_id && a.cluster_id === b.cluster_id) {
                        const attractForce = 0.002;
                        a.vx += dx * attractForce;
                        a.vy += dy * attractForce;
                        b.vx -= dx * attractForce;
                        b.vy -= dy * attractForce;
                    }
                }
            }

            for (const edge of edges) {
                const a = nodes.find((n) => n.id === edge.source);
                const b = nodes.find((n) => n.id === edge.target);
                if (!a || !b) continue;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const idealDist = 80;
                const force = (dist - idealDist) / dist * 0.01;
                a.vx += dx * force;
                a.vy += dy * force;
                b.vx -= dx * force;
                b.vy -= dy * force;
            }

            for (const n of nodes) {
                if (dragRef.current?.node.id === n.id) continue;
                n.vx *= damping;
                n.vy *= damping;
                n.x += n.vx;
                n.y += n.vy;
                n.x = Math.max(n.radius, Math.min(dimensions.w - n.radius, n.x));
                n.y = Math.max(n.radius, Math.min(dimensions.h - n.radius, n.y));
            }

            // Render
            ctx!.clearRect(0, 0, dimensions.w, dimensions.h);

            // Background
            ctx!.fillStyle = dark ? "hsl(260, 15%, 8%)" : "hsl(260, 20%, 98%)";
            ctx!.fillRect(0, 0, dimensions.w, dimensions.h);

            // Draw edges
            for (const edge of edges) {
                const a = nodes.find((n) => n.id === edge.source);
                const b = nodes.find((n) => n.id === edge.target);
                if (!a || !b) continue;
                ctx!.beginPath();
                ctx!.moveTo(a.x, a.y);
                ctx!.lineTo(b.x, b.y);
                ctx!.strokeStyle = dark
                    ? (edge.type === "link" ? "rgba(139,92,246,0.3)" : "rgba(245,158,11,0.2)")
                    : (edge.type === "link" ? "rgba(99,102,241,0.3)" : "rgba(245,158,11,0.25)");
                ctx!.lineWidth = edge.type === "link" ? 1.5 : 1;
                if (edge.type === "similarity") ctx!.setLineDash([4, 4]);
                else ctx!.setLineDash([]);
                ctx!.stroke();
                ctx!.setLineDash([]);
            }

            // Draw nodes
            for (const n of nodes) {
                const isHovered = hoveredNode?.id === n.id;
                ctx!.beginPath();
                ctx!.arc(n.x, n.y, n.radius + (isHovered ? 3 : 0), 0, Math.PI * 2);
                ctx!.fillStyle = n.color;
                ctx!.fill();
                ctx!.strokeStyle = isHovered
                    ? (dark ? "#e2e8f0" : "#1e1b4b")
                    : (dark ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.8)");
                ctx!.lineWidth = isHovered ? 2.5 : 1.5;
                ctx!.stroke();

                if (n.role === "pillar" || isHovered) {
                    ctx!.fillStyle = dark ? "#e2e8f0" : "#333";
                    ctx!.font = isHovered ? "bold 12px system-ui" : "11px system-ui";
                    ctx!.textAlign = "center";
                    ctx!.fillText(n.label, n.x, n.y + n.radius + 14);
                }
            }

            animRef.current = requestAnimationFrame(tick);
        }

        tick();

        return () => {
            running = false;
            cancelAnimationFrame(animRef.current);
        };
    }, [dimensions, hoveredNode]);

    // Mouse interactions
    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        if (dragRef.current) {
            dragRef.current.node.x = mx - dragRef.current.offsetX;
            dragRef.current.node.y = my - dragRef.current.offsetY;
            dragRef.current.node.vx = 0;
            dragRef.current.node.vy = 0;
            return;
        }

        const found = nodesRef.current.find((n) => {
            const dx = mx - n.x;
            const dy = my - n.y;
            return dx * dx + dy * dy < (n.radius + 4) * (n.radius + 4);
        });
        setHoveredNode(found || null);
        canvas.style.cursor = found ? "pointer" : "default";
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const found = nodesRef.current.find((n) => {
            const dx = mx - n.x;
            const dy = my - n.y;
            return dx * dx + dy * dy < (n.radius + 4) * (n.radius + 4);
        });
        if (found) {
            dragRef.current = { node: found, offsetX: mx - found.x, offsetY: my - found.y };
        }
    }, []);

    const handleMouseUp = useCallback(() => {
        dragRef.current = null;
    }, []);

    const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (hoveredNode) {
            onSelectArticle(hoveredNode.id);
        }
    }, [hoveredNode, onSelectArticle]);

    // Resize observer
    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                setDimensions({ w: entry.contentRect.width, h: Math.max(400, entry.contentRect.height) });
            }
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const clusterLegend = clusters.map((c, i) => ({
        name: c.name,
        color: getClusterColor(i),
    }));

    return (
        <div ref={containerRef} className="relative w-full h-[calc(100vh-14rem)]">
            <canvas
                ref={canvasRef}
                width={dimensions.w}
                height={dimensions.h}
                onMouseMove={handleMouseMove}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={handleClick}
                className="w-full h-full rounded-xl border border-border"
            />

            {/* Legend */}
            <Card className="absolute top-3 left-3 max-w-[200px] shadow-md">
                <CardContent className="p-3">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Clusters
                    </div>
                    {clusterLegend.map((c) => (
                        <div key={c.name} className="flex items-center gap-1.5 mb-1 text-xs">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                            <span className="truncate">{c.name}</span>
                        </div>
                    ))}
                    {articles.some((a) => !a.cluster_id) && (
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-muted-foreground/50" />
                            <span>Unclustered</span>
                        </div>
                    )}

                    <div className="border-t border-border mt-2 pt-2 text-[11px] text-muted-foreground space-y-1">
                        <div className="flex items-center gap-1.5">
                            <span className="w-[18px] h-[18px] rounded-full bg-primary inline-block" />
                            Pillar
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-primary inline-block" />
                            Supporting
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                            Long-tail
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Hover tooltip */}
            {hoveredNode && (
                <Card className="absolute top-3 right-3 max-w-[260px] shadow-lg">
                    <CardContent className="p-3">
                        <div className="font-semibold text-sm mb-1.5">{hoveredNode.label}</div>
                        {hoveredNode.role && (
                            <Badge variant={
                                hoveredNode.role === "pillar" ? "default" :
                                hoveredNode.role === "supporting" ? "secondary" : "outline"
                            }>
                                {hoveredNode.role.replace("_", "-")}
                            </Badge>
                        )}
                        <div className="text-[11px] text-muted-foreground mt-2">Click to view details →</div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
