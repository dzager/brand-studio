// GraphView.tsx — Force-directed canvas graph showing content topology
// Nodes = articles, edges = cluster links + semantic similarity

import { useRef, useEffect, useState, useCallback } from "react";

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

const CLUSTER_HUES = [220, 150, 30, 280, 0, 60, 190, 320, 100, 350];

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

    // Build graph data
    useEffect(() => {
        const clusterIds = clusters.map((c) => c.id);
        const clusterIndexMap: Record<string, number> = {};
        clusters.forEach((c, i) => { clusterIndexMap[c.id] = i; });

        const cx = dimensions.w / 2;
        const cy = dimensions.h / 2;

        // Create nodes
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
                color: cIdx >= 0 ? getClusterColor(cIdx) : "#aaa",
            };
        });

        // Create edges from cluster strategy links_to
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

            // Forces
            for (let i = 0; i < nodes.length; i++) {
                const a = nodes[i];
                // Centering force
                a.vx += (cx - a.x) * 0.0005;
                a.vy += (cy - a.y) * 0.0005;

                // Repulsion between all nodes
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

                    // Same cluster attraction
                    if (a.cluster_id && a.cluster_id === b.cluster_id) {
                        const attractForce = 0.002;
                        a.vx += dx * attractForce;
                        a.vy += dy * attractForce;
                        b.vx -= dx * attractForce;
                        b.vy -= dy * attractForce;
                    }
                }
            }

            // Edge spring forces
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

            // Apply velocities
            for (const n of nodes) {
                if (dragRef.current?.node.id === n.id) continue;
                n.vx *= damping;
                n.vy *= damping;
                n.x += n.vx;
                n.y += n.vy;
                // Keep in bounds
                n.x = Math.max(n.radius, Math.min(dimensions.w - n.radius, n.x));
                n.y = Math.max(n.radius, Math.min(dimensions.h - n.radius, n.y));
            }

            // Render
            ctx!.clearRect(0, 0, dimensions.w, dimensions.h);

            // Draw edges
            for (const edge of edges) {
                const a = nodes.find((n) => n.id === edge.source);
                const b = nodes.find((n) => n.id === edge.target);
                if (!a || !b) continue;
                ctx!.beginPath();
                ctx!.moveTo(a.x, b.y > a.y ? a.y : a.y);
                ctx!.moveTo(a.x, a.y);
                ctx!.lineTo(b.x, b.y);
                ctx!.strokeStyle = edge.type === "link" ? "rgba(99,102,241,0.3)" : "rgba(245,158,11,0.25)";
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
                ctx!.strokeStyle = isHovered ? "#191F1D" : "rgba(255,255,255,0.8)";
                ctx!.lineWidth = isHovered ? 2.5 : 1.5;
                ctx!.stroke();

                // Label for pillar nodes or hovered
                if (n.role === "pillar" || isHovered) {
                    ctx!.fillStyle = "#333";
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

    // Build legend
    const clusterLegend = clusters.map((c, i) => ({
        name: c.name,
        color: getClusterColor(i),
    }));

    return (
        <div ref={containerRef} style={{ width: "100%", height: "calc(100vh - 160px)", position: "relative" }}>
            <canvas
                ref={canvasRef}
                width={dimensions.w}
                height={dimensions.h}
                onMouseMove={handleMouseMove}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={handleClick}
                style={{ width: "100%", height: "100%", borderRadius: 12, background: "#fafafa", border: "1px solid #e5e5e5" }}
            />

            {/* Legend */}
            <div style={{
                position: "absolute", top: 12, left: 12, background: "rgba(255,255,255,0.92)",
                borderRadius: 8, padding: "10px 14px", fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                border: "1px solid #e5e5e5", maxWidth: 200,
            }}>
                <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Clusters
                </div>
                {clusterLegend.map((c) => (
                    <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                    </div>
                ))}
                {articles.some((a) => !a.cluster_id) && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#aaa", flexShrink: 0 }} />
                        <span style={{ color: "#888" }}>Unclustered</span>
                    </div>
                )}

                <div style={{ borderTop: "1px solid #e5e5e5", marginTop: 8, paddingTop: 8, fontSize: 11, color: "#999" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#6366f1", display: "inline-block" }} />
                        Pillar
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#6366f1", display: "inline-block" }} />
                        Supporting
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1", display: "inline-block" }} />
                        Long-tail
                    </div>
                </div>
            </div>

            {/* Hover tooltip */}
            {hoveredNode && (
                <div style={{
                    position: "absolute", top: 12, right: 12, background: "#fff",
                    borderRadius: 8, padding: "10px 14px", fontSize: 13, boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
                    border: "1px solid #e5e5e5", maxWidth: 260,
                }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{hoveredNode.label}</div>
                    {hoveredNode.role && (
                        <span style={{
                            padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                            background: hoveredNode.role === "pillar" ? "#eef2ff" : hoveredNode.role === "supporting" ? "#f0fdf4" : "#fefce8",
                            color: hoveredNode.role === "pillar" ? "#4338ca" : hoveredNode.role === "supporting" ? "#16a34a" : "#a16207",
                        }}>
                            {hoveredNode.role.replace("_", "-")}
                        </span>
                    )}
                    <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Click to view details →</div>
                </div>
            )}
        </div>
    );
}
