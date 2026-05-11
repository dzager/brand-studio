// taskStore.tsx — Global task state management
// React Context + useReducer for tracking concurrent AI operations

import React, { createContext, useContext, useReducer, useCallback, useMemo, useRef, useEffect } from "react";

/* ── Types ─────────────────────────────────────────────── */

export type TaskStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type TaskType =
  | "article"
  | "humanize"
  | "fact-check"
  | "consul-check"
  | "image-regen"
  | "cluster-strategy"
  | "cluster-page"
  | "cluster-batch"
  | "guide"
  | "interlink"
  | "recommend-style"
  | "composite"
  | "shorten"
  | "thumbnail"
  | "style-extract"
  | "research"
  | "research-brief"
  | "research-article";

export interface Task {
  id: string;
  type: TaskType;
  label: string;
  status: TaskStatus;
  progress?: number;         // 0–100
  progressLabel?: string;    // e.g. "3 of 7 pages"
  startedAt: number;         // Date.now()
  completedAt?: number;
  error?: string;
  result?: any;
  meta?: Record<string, any>;
}

/* ── Reducer ───────────────────────────────────────────── */

type Action =
  | { type: "ADD_TASK"; task: Task }
  | { type: "UPDATE_TASK"; id: string; patch: Partial<Task> }
  | { type: "COMPLETE_TASK"; id: string; result?: any }
  | { type: "FAIL_TASK"; id: string; error: string }
  | { type: "CANCEL_TASK"; id: string }
  | { type: "REMOVE_TASK"; id: string }
  | { type: "CLEAR_COMPLETED" };

function taskReducer(state: Task[], action: Action): Task[] {
  switch (action.type) {
    case "ADD_TASK":
      return [...state, action.task];

    case "UPDATE_TASK":
      return state.map((t) =>
        t.id === action.id ? { ...t, ...action.patch } : t
      );

    case "COMPLETE_TASK":
      return state.map((t) =>
        t.id === action.id
          ? { ...t, status: "completed" as const, completedAt: Date.now(), result: action.result, progress: 100 }
          : t
      );

    case "FAIL_TASK":
      return state.map((t) =>
        t.id === action.id
          ? { ...t, status: "failed" as const, completedAt: Date.now(), error: action.error }
          : t
      );

    case "CANCEL_TASK":
      return state.map((t) =>
        t.id === action.id && (t.status === "running" || t.status === "queued")
          ? { ...t, status: "cancelled" as const, completedAt: Date.now(), error: "Cancelled by user" }
          : t
      );

    case "REMOVE_TASK":
      return state.filter((t) => t.id !== action.id);

    case "CLEAR_COMPLETED":
      return state.filter((t) => t.status === "running" || t.status === "queued");

    default:
      return state;
  }
}

/* ── Context ───────────────────────────────────────────── */

interface TaskStoreAPI {
  tasks: Task[];
  activeTasks: Task[];
  hasActiveTasks: boolean;
  addTask: (task: Omit<Task, "startedAt">) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  completeTask: (id: string, result?: any) => void;
  failTask: (id: string, error: string) => void;
  cancelTask: (id: string) => void;
  registerAbort: (taskId: string, controller: AbortController) => void;
  removeTask: (id: string) => void;
  clearCompleted: () => void;
}

const TaskContext = createContext<TaskStoreAPI | null>(null);

/* ── Provider ──────────────────────────────────────────── */

const AUTO_DISMISS_MS = 5 * 60 * 1000; // 5 minutes

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, dispatch] = useReducer(taskReducer, []);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const abortRef = useRef<Map<string, AbortController>>(new Map());

  // Auto-dismiss completed tasks after 5 minutes
  useEffect(() => {
    const timers = timersRef.current;
    for (const task of tasks) {
      if (task.status === "completed" && !timers.has(task.id)) {
        const timer = setTimeout(() => {
          dispatch({ type: "REMOVE_TASK", id: task.id });
          timers.delete(task.id);
        }, AUTO_DISMISS_MS);
        timers.set(task.id, timer);
      }
    }
    // Cleanup timers for removed tasks
    for (const [id, timer] of timers) {
      if (!tasks.find((t) => t.id === id)) {
        clearTimeout(timer);
        timers.delete(id);
      }
    }
  }, [tasks]);

  // Cleanup all timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const addTask = useCallback(
    (task: Omit<Task, "startedAt">) =>
      dispatch({ type: "ADD_TASK", task: { ...task, startedAt: Date.now() } }),
    []
  );

  const updateTask = useCallback(
    (id: string, patch: Partial<Task>) =>
      dispatch({ type: "UPDATE_TASK", id, patch }),
    []
  );

  const completeTask = useCallback(
    (id: string, result?: any) =>
      dispatch({ type: "COMPLETE_TASK", id, result }),
    []
  );

  const failTask = useCallback(
    (id: string, error: string) =>
      dispatch({ type: "FAIL_TASK", id, error }),
    []
  );

  const cancelTask = useCallback(
    (id: string) => {
      // Abort the in-flight fetch if one exists
      const ctrl = abortRef.current.get(id);
      if (ctrl) {
        ctrl.abort();
        abortRef.current.delete(id);
      }
      dispatch({ type: "CANCEL_TASK", id });
    },
    []
  );

  const registerAbort = useCallback(
    (taskId: string, controller: AbortController) => {
      abortRef.current.set(taskId, controller);
    },
    []
  );

  const removeTask = useCallback(
    (id: string) => dispatch({ type: "REMOVE_TASK", id }),
    []
  );

  const clearCompleted = useCallback(
    () => dispatch({ type: "CLEAR_COMPLETED" }),
    []
  );

  const activeTasks = useMemo(
    () => tasks.filter((t) => t.status === "running" || t.status === "queued"),
    [tasks]
  );

  const hasActiveTasks = activeTasks.length > 0;

  const value = useMemo<TaskStoreAPI>(
    () => ({
      tasks,
      activeTasks,
      hasActiveTasks,
      addTask,
      updateTask,
      completeTask,
      failTask,
      cancelTask,
      registerAbort,
      removeTask,
      clearCompleted,
    }),
    [tasks, activeTasks, hasActiveTasks, addTask, updateTask, completeTask, failTask, cancelTask, registerAbort, removeTask, clearCompleted]
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

/* ── Hook ──────────────────────────────────────────────── */

export function useTaskStore(): TaskStoreAPI {
  const ctx = useContext(TaskContext);
  if (!ctx) {
    throw new Error("useTaskStore must be used within a TaskProvider");
  }
  return ctx;
}
