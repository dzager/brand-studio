// useTaskRunner.ts — Hook that wraps fetch calls with task lifecycle management
// Provides runTask() for single operations and runBatchTask() for multi-item batches

import { useCallback, useRef } from "react";
import { useTaskStore, type TaskType } from "@/lib/taskStore";

/* ── Types ─────────────────────────────────────────────── */

export interface RunTaskConfig<T = any> {
  type: TaskType;
  label: string;
  /** Full URL path, e.g. "/api/create" */
  endpoint: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  /** Extra metadata (companyId, clusterId, etc.) stored on the task */
  meta?: Record<string, any>;
  /** Called with the parsed response on success */
  onSuccess?: (result: T, taskId: string) => void;
  /** Called with the error message on failure */
  onError?: (error: string, taskId: string) => void;
}

export interface BatchItem {
  endpoint: string;
  method?: string;
  body?: any;
  label: string;
}

export interface RunBatchConfig<T = any> {
  type: TaskType;
  label: string;
  items: BatchItem[];
  /** Max concurrent requests (default 2) */
  concurrency?: number;
  meta?: Record<string, any>;
  onItemComplete?: (index: number, result: T) => void;
  onItemError?: (index: number, error: string) => void;
  onSuccess?: (results: (T | null)[]) => void;
  onError?: (error: string) => void;
}

/* ── Hook ──────────────────────────────────────────────── */

export function useTaskRunner() {
  const { addTask, updateTask, completeTask, failTask } = useTaskStore();
  const idCounter = useRef(0);

  /** Generate a unique task ID */
  const genId = useCallback(() => {
    idCounter.current += 1;
    return `task_${Date.now()}_${idCounter.current}`;
  }, []);

  /**
   * Run a single async task with full lifecycle tracking.
   * Returns the parsed result on success, or null on failure.
   */
  const runTask = useCallback(
    async <T = any>(config: RunTaskConfig<T>): Promise<T | null> => {
      const taskId = genId();

      addTask({
        id: taskId,
        type: config.type,
        label: config.label,
        status: "running",
        meta: config.meta,
      });

      try {
        const fetchOpts: RequestInit = {
          method: config.method || "POST",
          headers: { "Content-Type": "application/json" },
        };
        if (config.body !== undefined) {
          fetchOpts.body = JSON.stringify(config.body);
        }

        const res = await fetch(config.endpoint, fetchOpts);
        const text = await res.text();
        const data = text ? JSON.parse(text) : null;

        if (!res.ok) {
          throw new Error(data?.error || `Request failed with status ${res.status}`);
        }

        completeTask(taskId, data);
        config.onSuccess?.(data as T, taskId);
        return data as T;
      } catch (e: any) {
        const errMsg = e.message || "Unknown error";
        failTask(taskId, errMsg);
        config.onError?.(errMsg, taskId);
        return null;
      }
    },
    [addTask, completeTask, failTask, genId]
  );

  /**
   * Run a batch of tasks with controlled concurrency.
   * Creates a parent task for overall progress + individual child tasks.
   * Returns an array of results (null for failed items).
   */
  const runBatchTask = useCallback(
    async <T = any>(config: RunBatchConfig<T>): Promise<(T | null)[]> => {
      const { items, concurrency = 2, type, label, meta } = config;
      const parentId = genId();
      const results: (T | null)[] = new Array(items.length).fill(null);
      let completed = 0;
      let failed = 0;

      addTask({
        id: parentId,
        type,
        label,
        status: "running",
        progress: 0,
        progressLabel: `0 of ${items.length}`,
        meta: { ...meta, isParent: true, childCount: items.length },
      });

      // Execute items with concurrency limit
      const queue = items.map((item, index) => ({ item, index }));
      const running = new Set<Promise<void>>();

      const processNext = async (): Promise<void> => {
        if (queue.length === 0) return;
        const { item, index } = queue.shift()!;
        const childId = genId();

        addTask({
          id: childId,
          type,
          label: item.label,
          status: "running",
          meta: { ...meta, parentId, itemIndex: index },
        });

        try {
          const fetchOpts: RequestInit = {
            method: item.method || "POST",
            headers: { "Content-Type": "application/json" },
          };
          if (item.body !== undefined) {
            fetchOpts.body = JSON.stringify(item.body);
          }

          const res = await fetch(item.endpoint, fetchOpts);
          const text = await res.text();
          const data = text ? JSON.parse(text) : null;

          if (!res.ok) {
            throw new Error(data?.error || `Failed with status ${res.status}`);
          }

          results[index] = data as T;
          completed++;
          completeTask(childId, data);
          config.onItemComplete?.(index, data as T);
        } catch (e: any) {
          const errMsg = e.message || "Unknown error";
          failed++;
          failTask(childId, errMsg);
          config.onItemError?.(index, errMsg);
        }

        // Update parent progress
        const total = completed + failed;
        const pct = Math.round((total / items.length) * 100);
        updateTask(parentId, {
          progress: pct,
          progressLabel: `${total} of ${items.length}${failed > 0 ? ` (${failed} failed)` : ""}`,
        });
      };

      // Process with concurrency limit
      while (queue.length > 0 || running.size > 0) {
        while (running.size < concurrency && queue.length > 0) {
          const promise = processNext().finally(() => running.delete(promise));
          running.add(promise);
        }
        if (running.size > 0) {
          await Promise.race(running);
        }
      }

      // Mark parent as complete or failed
      if (failed === items.length) {
        failTask(parentId, `All ${items.length} items failed`);
        config.onError?.(`All ${items.length} items failed`);
      } else {
        completeTask(parentId, { completed, failed, total: items.length });
        config.onSuccess?.(results);
      }

      return results;
    },
    [addTask, updateTask, completeTask, failTask, genId]
  );

  return { runTask, runBatchTask };
}
