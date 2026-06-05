// TaskPanel.tsx — Terminal-style activity monitor for concurrent AI tasks
// Renders as a fixed top bar spanning the top of the page

import { useState, useEffect, useRef } from "react";
import { useTaskStore, type Task, type TaskStatus } from "@/lib/taskStore";
import { cn } from "@/lib/utils";
import { useRouter } from "next/router";

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
  "freshness-audit": "Freshness Audit",
};

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
  const router = useRouter();
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

  // Check if this is a completed task with a deep link
  const hasDeepLink = task.status === "completed" && task.meta?.link && !isCompletedImage;

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
        className="group flex items-start gap-0 leading-[1.4] whitespace-nowrap"
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

      {/* Deep link row for completed tasks with a link target */}
      {hasDeepLink && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 3,
            marginBottom: 3,
            marginLeft: 52,
            padding: "4px 8px",
            borderRadius: 6,
            background: "rgba(122,173,90,0.06)",
            border: "1px solid rgba(122,173,90,0.12)",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>Done</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(task.meta!.link);
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
            {task.meta?.linkLabel || "view"} ↗
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Fixed Footer Task Panel ─────────────────────────────── */

export default function TaskPanel() {
  const { tasks, activeTasks, hasActiveTasks, removeTask, clearCompleted, clearAll, cancelTask } = useTaskStore();
  const [expanded, setExpanded] = useState(false);
  const prevActiveCountRef = useRef(0);

  // Entrance / exit animation state
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  const hasTasks = tasks.length > 0;

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

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50",
        visible ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
      style={{
        fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace",
        transition: "opacity 0.3s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
        transform: visible ? "translateY(0)" : "translateY(-100%)",
      }}
    >
      {/* Terminal shell */}
      <div
        style={{
          background: "#2c2c2c",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          overflow: "hidden",
          boxShadow:
            "0 2px 8px rgba(0,0,0,0.2), " +
            "0 8px 24px rgba(0,0,0,0.15), " +
            "0 20px 60px rgba(0,0,0,0.1)",
        }}
      >
        {/* Chrome bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 12px",
            background: "#222",
            borderBottom: expanded ? "1px solid rgba(255,255,255,0.06)" : "none",
            cursor: "pointer",
          }}
          onClick={() => setExpanded(!expanded)}
        >
          {/* Pulse for active tasks */}
          {hasActiveTasks && (
            <span className="relative flex" style={{ width: 6, height: 6 }}>
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
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.25)",
              transform: expanded ? "rotate(0deg)" : "rotate(180deg)",
              transition: "transform 0.2s ease",
              display: "inline-block",
              cursor: "pointer",
              padding: "2px 4px",
            }}
          >
            ▲
          </span>

          {/* Close / dismiss all */}
          <span
            onClick={(e) => {
              e.stopPropagation();
              clearAll();
            }}
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.2)",
              cursor: "pointer",
              padding: "2px 4px",
              transition: "color 0.15s",
              lineHeight: 1,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.2)")}
            title="Dismiss activity panel"
          >
            ✕
          </span>
        </div>

        {/* Terminal body */}
        <div
          style={{
            overflow: "hidden",
            transition: "max-height 0.3s ease-in-out",
            maxHeight: expanded ? 300 : 0,
          }}
        >
          <div
            style={{
              padding: "6px 12px 8px",
              fontSize: 12.5,
              lineHeight: 1.5,
              color: "rgba(255,255,255,0.7)",
              overflowY: "auto",
              maxHeight: 280,
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
          </div>
        </div>
      </div>
    </div>
  );
}
