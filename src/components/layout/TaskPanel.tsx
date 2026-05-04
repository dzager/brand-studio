// TaskPanel.tsx — Bottom-docked activity monitor for concurrent AI tasks
// Shows running, completed, and failed tasks with progress bars and live timers

import { useState, useEffect, useRef, useCallback } from "react";
import { useTaskStore, type Task, type TaskStatus } from "@/lib/taskStore";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  Clock,
  Trash2,
  Eye,
  RotateCcw,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Helpers ───────────────────────────────────────────── */

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return `${minutes}m ${secs}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

const STATUS_CONFIG: Record<TaskStatus, {
  icon: typeof CheckCircle2;
  color: string;
  borderColor: string;
  label: string;
}> = {
  queued: {
    icon: Clock,
    color: "text-muted-foreground",
    borderColor: "border-l-muted-foreground",
    label: "Queued",
  },
  running: {
    icon: Loader2,
    color: "text-blue-500",
    borderColor: "border-l-blue-500",
    label: "Running",
  },
  completed: {
    icon: CheckCircle2,
    color: "text-green-500",
    borderColor: "border-l-green-500",
    label: "Complete",
  },
  failed: {
    icon: XCircle,
    color: "text-destructive",
    borderColor: "border-l-destructive",
    label: "Failed",
  },
};

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

/* ── Task Row ──────────────────────────────────────────── */

function TaskRow({ task, onRemove }: { task: Task; onRemove: (id: string) => void }) {
  const isActive = task.status === "running" || task.status === "queued";
  const elapsed = useElapsedTime(task.startedAt, isActive);
  const config = STATUS_CONFIG[task.status];
  const Icon = config.icon;
  const isParent = task.meta?.isParent;

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-1.5 rounded-lg border-l-[3px] bg-card/80 px-3 py-2.5 transition-all",
        config.borderColor,
        isActive && "bg-card",
      )}
    >
      {/* Top row: icon + label + badges + time + actions */}
      <div className="flex items-center gap-2 min-w-0">
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            config.color,
            task.status === "running" && "animate-spin",
          )}
        />

        {/* Type badge */}
        <Badge
          variant="outline"
          className="shrink-0 text-[10px] px-1.5 py-0 h-4 font-medium"
        >
          {TYPE_LABELS[task.type] || task.type}
        </Badge>

        {/* Task label */}
        <span className="truncate text-sm font-medium flex-1 min-w-0">
          {task.label}
        </span>

        {/* Progress label */}
        {task.progressLabel && (
          <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
            {task.progressLabel}
          </span>
        )}

        {/* Elapsed time */}
        <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatElapsed(task.completedAt ? task.completedAt - task.startedAt : elapsed)}
        </span>

        {/* Dismiss button — visible on hover for completed/failed */}
        {!isActive && (
          <button
            onClick={() => onRemove(task.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-accent"
            title="Dismiss"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Progress bar for running tasks */}
      {isActive && task.progress !== undefined && (
        <div className="flex items-center gap-2">
          <Progress value={task.progress} className="h-1 flex-1" />
          <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
            {Math.round(task.progress)}%
          </span>
        </div>
      )}

      {/* Error message for failed tasks */}
      {task.status === "failed" && task.error && (
        <p className="text-[11px] text-destructive/80 pl-5.5 truncate">
          {task.error}
        </p>
      )}
    </div>
  );
}

/* ── Task Panel ────────────────────────────────────────── */

export default function TaskPanel() {
  const { tasks, activeTasks, hasActiveTasks, removeTask, clearCompleted } = useTaskStore();
  const [expanded, setExpanded] = useState(false);
  const prevActiveCountRef = useRef(0);

  // Auto-expand when a new task starts
  useEffect(() => {
    if (activeTasks.length > prevActiveCountRef.current && activeTasks.length > 0) {
      setExpanded(true);
    }
    prevActiveCountRef.current = activeTasks.length;
  }, [activeTasks.length]);

  // Don't render if no tasks at all
  if (tasks.length === 0) return null;

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const failedCount = tasks.filter((t) => t.status === "failed").length;
  const runningCount = activeTasks.length;

  // Filter out child tasks that are part of a batch (show only parents and standalone)
  const visibleTasks = tasks
    .filter((t) => !t.meta?.parentId)
    .sort((a, b) => {
      // Active first, then by most recent
      const statusOrder: Record<TaskStatus, number> = { running: 0, queued: 1, failed: 2, completed: 3 };
      const diff = statusOrder[a.status] - statusOrder[b.status];
      if (diff !== 0) return diff;
      return b.startedAt - a.startedAt;
    });

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out",
        "md:left-16", // Account for sidebar (collapsed width)
      )}
    >
      {/* Backdrop blur layer */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-t border-border/50 rounded-t-xl" />

      <div className="relative">
        {/* ── Collapsed bar ──────────────────────────────────── */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm cursor-pointer hover:bg-accent/30 transition-colors"
        >
          {/* Pulse indicator */}
          {hasActiveTasks && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
          )}

          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium text-sm">Activity</span>

          {/* Status counts */}
          <div className="flex items-center gap-1.5">
            {runningCount > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-1 border-blue-500/30 text-blue-500">
                <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                {runningCount}
              </Badge>
            )}
            {completedCount > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-1 border-green-500/30 text-green-500">
                <CheckCircle2 className="h-2.5 w-2.5" />
                {completedCount}
              </Badge>
            )}
            {failedCount > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-1 border-destructive/30 text-destructive">
                <XCircle className="h-2.5 w-2.5" />
                {failedCount}
              </Badge>
            )}
          </div>

          <div className="flex-1" />

          {/* Actions */}
          {(completedCount > 0 || failedCount > 0) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
              onClick={(e) => {
                e.stopPropagation();
                clearCompleted();
              }}
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </Button>
          )}

          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        {/* ── Expanded task list ─────────────────────────────── */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            expanded ? "max-h-[340px]" : "max-h-0",
          )}
        >
          <div className="px-3 pb-3 space-y-1.5 overflow-y-auto max-h-[300px] scroll-smooth">
            {visibleTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No tasks to show
              </p>
            ) : (
              visibleTasks.map((task) => (
                <TaskRow key={task.id} task={task} onRemove={removeTask} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
