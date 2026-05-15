// TaskPanel.tsx — Terminal-style activity monitor for concurrent AI tasks
// Renders as a minimal dark terminal log, matching the homepage hero graphic
// Draggable + resizable via chrome bar and edge handles

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTaskStore, type Task, type TaskStatus } from "@/lib/taskStore";
import { cn } from "@/lib/utils";
import { matchFactsForCompany, shuffleArray, type FunFact } from "@/lib/funFacts";

/* ── Helpers ───────────────────────────────────────────── */

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

const TYPE_LABELS: Record<string, string> = {
  article: "Article",
  humanize: "Humanize",
  "fact-check": "Fact Check",
  "consul-check": "Deep Check",
  "image-regen": "Image",
  "cluster-strategy": "Strategy",
  "cluster-page": "Cluster Page",
  "cluster-batch": "Batch Generate",
  guide: "Guide",
  interlink: "Interlink",
  "recommend-style": "Style",
  composite: "Composite",
  shorten: "Shorten",
  thumbnail: "Thumbnail",
  "style-extract": "Style Extract",
  research: "Research",
  "research-brief": "Brief",
  "research-article": "Research → Article",
};

/* ── localStorage persistence ─────────────────────────── */

const STORAGE_KEY = "organic-task-panel-geometry";

interface PanelGeometry {
  x: number;        // px from left
  y: number;        // px from top
  width: number;    // px
}

function loadGeometry(): PanelGeometry | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveGeometry(geo: PanelGeometry) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(geo));
  } catch {}
}

/* ── Elapsed Timer Hook ────────────────────────────────── */

function useElapsedTime(startedAt: number, isActive: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!isActive) {
      setElapsed(Date.now() - startedAt);
      return;
    }

    const tick = () => {
      setElapsed(Date.now() - startedAt);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [startedAt, isActive]);

  return elapsed;
}

/* ── Fun Fact Ticker ───────────────────────────────────── */

const FUN_FACT_INTERVAL = 8000;

function FunFactTicker({ companyName }: { companyName?: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const facts = useMemo(() => {
    const matched = matchFactsForCompany(companyName || "");
    return shuffleArray(matched).slice(0, 10);
  }, [companyName]);

  useEffect(() => {
    if (facts.length === 0) return;
    const timer = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % facts.length);
        setIsAnimating(false);
      }, 250);
    }, FUN_FACT_INTERVAL);
    return () => clearInterval(timer);
  }, [facts.length]);

  const fact = facts[currentIndex];
  if (!fact) return null;

  return (
    <div
      key={currentIndex}
      className={cn(
        "transition-all duration-250",
        isAnimating ? "opacity-0 translate-y-0.5" : "opacity-100 translate-y-0",
      )}
      style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}
    >
      <span style={{ color: "rgba(255,255,255,0.2)", marginRight: 6 }}>💡</span>
      {fact.headline}
    </div>
  );
}

/* ── Terminal Task Line ────────────────────────────────── */

function TaskLine({
  task,
  onRemove,
  onCancel,
}: {
  task: Task;
  onRemove: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const isActive = task.status === "running" || task.status === "queued";
  const elapsed = useElapsedTime(task.startedAt, isActive);
  const time = formatElapsed(task.completedAt ? task.completedAt - task.startedAt : elapsed);

  // Color mapping — matches homepage terminal
  const lineColor =
    task.status === "completed"
      ? "#7aad5a"
      : task.status === "failed"
        ? "#c47a5a"
        : task.status === "cancelled"
          ? "#c9a84c"
          : task.status === "running"
            ? "#c9a84c"
            : "rgba(255,255,255,0.3)"; // queued = dim

  const typeLabel = TYPE_LABELS[task.type] || task.type;

  // Build the log line
  const prefix =
    task.status === "completed"
      ? "✓"
      : task.status === "failed"
        ? "✗"
        : task.status === "cancelled"
          ? "—"
          : task.status === "running"
            ? "…"
            : "·";

  // Check if this is a completed image task with a result
  const isCompletedImage = task.status === "completed" && task.meta?.imageTask && task.result?.image_base64;

  function scrollToFeaturedImage() {
    const el = document.getElementById("featured-image");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Brief highlight animation
      el.style.transition = "box-shadow 0.3s ease";
      el.style.boxShadow = "0 0 0 3px rgba(122,173,90,0.5), 0 0 20px rgba(122,173,90,0.2)";
      el.style.borderRadius = "12px";
      setTimeout(() => {
        el.style.boxShadow = "none";
      }, 2000);
    }
  }

  return (
    <div>
      <div
        className="group flex items-start gap-0 leading-[1.65] whitespace-nowrap"
        style={{ color: lineColor, fontSize: 12.5 }}
      >
        {/* Timestamp */}
        <span style={{ color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>
          [{time}]
        </span>

        {/* Status prefix + content */}
        <span className="ml-1.5 truncate flex-1 min-w-0">
          {prefix} {typeLabel}: {task.label}
          {task.progressLabel && (
            <span style={{ color: "rgba(255,255,255,0.3)" }}> ({task.progressLabel})</span>
          )}
          {task.progress !== undefined && isActive && (
            <span style={{ color: "rgba(255,255,255,0.3)" }}> {Math.round(task.progress)}%</span>
          )}
        </span>

        {/* Error suffix */}
        {task.status === "failed" && task.error && (
          <span className="ml-2 truncate max-w-[200px]" style={{ color: "#c47a5a", opacity: 0.7, fontSize: 11 }}>
            {task.error}
          </span>
        )}

        {/* Cancel — inline, subtle */}
        {isActive && (
          <button
            onClick={(e) => { e.stopPropagation(); onCancel(task.id); }}
            className="ml-2 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity shrink-0"
            style={{ color: "#c47a5a", fontSize: 11, background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}
            title="Cancel task"
          >
            kill
          </button>
        )}

        {/* Dismiss — inline, subtle */}
        {!isActive && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(task.id); }}
            className="ml-2 opacity-0 group-hover:opacity-40 hover:!opacity-80 transition-opacity shrink-0"
            style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}
            title="Dismiss"
          >
            ×
          </button>
        )}
      </div>

      {/* Image preview row for completed image tasks */}
      {isCompletedImage && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 4,
            marginBottom: 4,
            marginLeft: 52,
            padding: "6px 8px",
            borderRadius: 6,
            background: "rgba(122,173,90,0.08)",
            border: "1px solid rgba(122,173,90,0.15)",
          }}
        >
          <img
            src={`data:image/png;base64,${task.result.image_base64}`}
            alt="Generated"
            style={{
              width: 48,
              height: 32,
              objectFit: "cover",
              borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.1)",
              flexShrink: 0,
            }}
          />
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>Image ready</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              scrollToFeaturedImage();
            }}
            style={{
              color: "#7aad5a",
              fontSize: 11,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0 4px",
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            view ↗
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Terminal Task Panel ──────────────────────────────── */

const MIN_WIDTH = 360;
const MAX_WIDTH = 1400;
const DEFAULT_WIDTH = 900;

export default function TaskPanel() {
  const { tasks, activeTasks, hasActiveTasks, removeTask, clearCompleted, cancelTask } = useTaskStore();
  const [expanded, setExpanded] = useState(false);
  const prevActiveCountRef = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Entrance / exit animation state
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  // Geometry state (position + width)
  const [geo, setGeo] = useState<PanelGeometry | null>(null);
  const [hasCustomPos, setHasCustomPos] = useState(false);

  // Drag state
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Resize state
  const resizing = useRef<"left" | "right" | null>(null);
  const resizeStart = useRef({ mouseX: 0, startWidth: 0, startX: 0 });

  const hasTasks = tasks.length > 0;

  // Initialize geometry from localStorage or defaults
  useEffect(() => {
    const saved = loadGeometry();
    if (saved) {
      // Clamp to current viewport
      const clamped = clampToViewport(saved);
      setGeo(clamped);
      setHasCustomPos(true);
    }
  }, []);

  useEffect(() => {
    if (hasTasks && !mounted) {
      setMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else if (!hasTasks && mounted) {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 350);
      return () => clearTimeout(timer);
    }
  }, [hasTasks, mounted]);

  // Auto-expand when a new task starts
  useEffect(() => {
    if (activeTasks.length > prevActiveCountRef.current && activeTasks.length > 0) {
      setExpanded(true);
    }
    prevActiveCountRef.current = activeTasks.length;
  }, [activeTasks.length]);

  // Derive company name from the first active task
  const [activeCompanyName, setActiveCompanyName] = useState<string>("");

  useEffect(() => {
    if (!hasActiveTasks) {
      setActiveCompanyName("");
      return;
    }
    const activeWithCompany = activeTasks.find((t) => t.meta?.companyId);
    const companyId = activeWithCompany?.meta?.companyId;
    if (!companyId) {
      setActiveCompanyName("");
      return;
    }
    fetch(`/api/companies/${companyId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.name) setActiveCompanyName(data.name);
        else setActiveCompanyName("");
      })
      .catch(() => setActiveCompanyName(""));
  }, [hasActiveTasks, activeTasks]);

  /* ── Drag handlers ─────────────────────────────────── */

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    // Don't drag on buttons or interactive elements
    if ((e.target as HTMLElement).closest("button, span[role], [data-no-drag]")) return;

    e.preventDefault();
    dragging.current = true;
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragging.current) {
      const x = e.clientX - dragOffset.current.x;
      const y = e.clientY - dragOffset.current.y;
      const currentWidth = geo?.width ?? DEFAULT_WIDTH;
      const clamped = clampToViewport({ x, y, width: currentWidth });
      setGeo(clamped);
      setHasCustomPos(true);
    }

    if (resizing.current) {
      const dx = e.clientX - resizeStart.current.mouseX;
      if (resizing.current === "right") {
        const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeStart.current.startWidth + dx));
        setGeo((prev) => {
          const g = prev ?? getDefaultGeo();
          const clamped = clampToViewport({ ...g, width: newWidth });
          return clamped;
        });
      } else {
        // Left resize: adjust both x and width
        const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeStart.current.startWidth - dx));
        const newX = resizeStart.current.startX + (resizeStart.current.startWidth - newWidth);
        setGeo((prev) => {
          const g = prev ?? getDefaultGeo();
          const clamped = clampToViewport({ x: newX, y: g.y, width: newWidth });
          return clamped;
        });
      }
      setHasCustomPos(true);
    }
  }, [geo?.width]);

  const handleMouseUp = useCallback(() => {
    if (dragging.current || resizing.current) {
      dragging.current = false;
      resizing.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      // Persist final position
      setGeo((g) => {
        if (g) saveGeometry(g);
        return g;
      });
    }
  }, []);

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  /* ── Resize handlers ───────────────────────────────── */

  const handleResizeStart = useCallback((side: "left" | "right", e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = side;
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    resizeStart.current = {
      mouseX: e.clientX,
      startWidth: rect.width,
      startX: rect.left,
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ew-resize";
  }, []);

  /* ── Double-click to reset position ────────────────── */

  const handleDoubleClick = useCallback(() => {
    setGeo(null);
    setHasCustomPos(false);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  if (!mounted) return null;

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const failedCount = tasks.filter((t) => t.status === "failed").length;
  const runningCount = activeTasks.length;

  const visibleTasks = tasks
    .filter((t) => !t.meta?.parentId)
    .sort((a, b) => {
      const statusOrder: Record<TaskStatus, number> = { running: 0, queued: 1, failed: 2, cancelled: 3, completed: 4 };
      const diff = statusOrder[a.status] - statusOrder[b.status];
      if (diff !== 0) return diff;
      return b.startedAt - a.startedAt;
    });

  // Chrome title — summary
  const titleParts: string[] = [];
  if (runningCount > 0) titleParts.push(`${runningCount} running`);
  if (completedCount > 0) titleParts.push(`${completedCount} done`);
  if (failedCount > 0) titleParts.push(`${failedCount} failed`);
  const chromeTitle = titleParts.length > 0 ? `activity.log — ${titleParts.join(", ")}` : "activity.log";

  // Position styles: custom (absolute) or default (centered at bottom)
  const positionStyle: React.CSSProperties = hasCustomPos && geo
    ? {
        left: geo.x,
        top: geo.y,
        width: geo.width,
        bottom: "auto",
        transform: "none",
        transition: dragging.current || resizing.current
          ? "opacity 0.3s ease"
          : "opacity 0.3s ease",
      }
    : {
        bottom: visible ? 32 : -100,
        left: "50%",
        transform: "translateX(calc(-50% + 2rem))",
        width: DEFAULT_WIDTH,
        maxWidth: "calc(100% - 5rem)",
        transition: "bottom 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease",
      };

  return (
    <div
      ref={panelRef}
      className={cn(
        "fixed z-50",
        visible ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
      style={{
        ...positionStyle,
        fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace",
      }}
    >
      {/* Left resize handle */}
      <div
        onMouseDown={(e) => handleResizeStart("left", e)}
        style={{
          position: "absolute",
          left: -3,
          top: 0,
          bottom: 0,
          width: 6,
          cursor: "ew-resize",
          zIndex: 10,
        }}
      />

      {/* Right resize handle */}
      <div
        onMouseDown={(e) => handleResizeStart("right", e)}
        style={{
          position: "absolute",
          right: -3,
          top: 0,
          bottom: 0,
          width: 6,
          cursor: "ew-resize",
          zIndex: 10,
        }}
      />

      {/* Terminal shell */}
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8,
          overflow: "hidden",
          boxShadow:
            "0 -2px 8px rgba(0,0,0,0.2), " +
            "0 -8px 24px rgba(0,0,0,0.15), " +
            "0 -20px 60px rgba(0,0,0,0.1)",
        }}
      >
        {/* Chrome bar — draggable */}
        <div
          onMouseDown={handleDragStart}
          onDoubleClick={handleDoubleClick}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            background: "#222",
            borderBottom: expanded ? "1px solid rgba(255,255,255,0.06)" : "none",
            cursor: "grab",
          }}
        >
          {/* Traffic-light dots */}
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#c47a5a", flexShrink: 0 }} />
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#c9a84c", flexShrink: 0 }} />
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#5a7a4a", flexShrink: 0 }} />

          {/* Pulse for active tasks */}
          {hasActiveTasks && (
            <span className="relative flex" style={{ width: 6, height: 6, marginLeft: 4 }}>
              <span
                className="animate-ping absolute inline-flex rounded-full"
                style={{ width: "100%", height: "100%", background: "#7aad5a", opacity: 0.6 }}
              />
              <span
                className="relative inline-flex rounded-full"
                style={{ width: 6, height: 6, background: "#7aad5a" }}
              />
            </span>
          )}

          {/* Title */}
          <span
            style={{
              fontFamily: "inherit",
              fontSize: 11,
              color: "rgba(255,255,255,0.35)",
              marginLeft: 4,
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {chromeTitle}
          </span>

          {/* Clear action */}
          {(completedCount > 0 || failedCount > 0) && (
            <span
              data-no-drag
              onClick={(e) => {
                e.stopPropagation();
                clearCompleted();
              }}
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.2)",
                cursor: "pointer",
                padding: "2px 6px",
                borderRadius: 3,
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.2)")}
            >
              clear
            </span>
          )}

          {/* Expand/collapse toggle */}
          <span
            data-no-drag
            onClick={() => setExpanded(!expanded)}
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.25)",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
              display: "inline-block",
              cursor: "pointer",
              padding: "2px 4px",
            }}
          >
            ▲
          </span>
        </div>

        {/* Terminal body */}
        <div
          style={{
            overflow: "hidden",
            transition: "max-height 0.3s ease-in-out",
            maxHeight: expanded ? 400 : 0,
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              fontSize: 12.5,
              lineHeight: 1.65,
              color: "rgba(255,255,255,0.7)",
              overflowY: "auto",
              maxHeight: 360,
            }}
          >
            {visibleTasks.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>
                # no tasks
              </div>
            ) : (
              visibleTasks.map((task) => (
                <TaskLine key={task.id} task={task} onRemove={removeTask} onCancel={cancelTask} />
              ))
            )}

            {/* Fun Fact Ticker */}
            {hasActiveTasks && (
              <div style={{ marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8 }}>
                <FunFactTicker companyName={activeCompanyName || undefined} />
              </div>
            )}

            {/* Cursor */}
            <span
              style={{
                display: "inline-block",
                color: "rgba(255,255,255,0.5)",
                animation: "blink 1s step-end infinite",
                marginTop: 2,
              }}
            >
              ▌
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Viewport clamping ────────────────────────────────── */

function getDefaultGeo(): PanelGeometry {
  const w = typeof window !== "undefined" ? window.innerWidth : 1200;
  const h = typeof window !== "undefined" ? window.innerHeight : 800;
  return {
    x: Math.max(16, (w - DEFAULT_WIDTH) / 2),
    y: h - 200,
    width: DEFAULT_WIDTH,
  };
}

function clampToViewport(geo: PanelGeometry): PanelGeometry {
  if (typeof window === "undefined") return geo;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, geo.width, vw - 16));
  const x = Math.max(8, Math.min(vw - width - 8, geo.x));
  const y = Math.max(8, Math.min(vh - 48, geo.y));
  return { x, y, width };
}
