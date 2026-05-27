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
  const { addTask, updateTask, completeTask, failTask, registerAbort } = useTaskStore();
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
      const abortController = new AbortController();

      addTask({
        id: taskId,
        type: config.type,
        label: config.label,
        status: "running",
        meta: config.meta,
      });

      // Register the AbortController so cancelTask() can abort this fetch
      registerAbort(taskId, abortController);

      try {
        const fetchOpts: RequestInit = {
          method: config.method || "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortController.signal,
        };
        if (config.body !== undefined) {
          fetchOpts.body = JSON.stringify(config.body);
        }

        const res = await fetch(config.endpoint, fetchOpts);
        const text = await res.text();
        let data: any = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          // Response wasn't valid JSON (e.g. Vercel timeout plain-text error)
          if (!res.ok) {
            throw new Error(text || `Request failed with status ${res.status}`);
          }
        }

        if (!res.ok) {
          throw new Error(data?.error || `Request failed with status ${res.status}`);
        }

        completeTask(taskId, data);
        config.onSuccess?.(data as T, taskId);
        return data as T;
      } catch (e: any) {
        // Don't overwrite cancelled status with a generic failure
        if (e.name === "AbortError") {
          config.onError?.("Cancelled by user", taskId);
          return null;
        }
        const errMsg = e.message || "Unknown error";
        failTask(taskId, errMsg);
        config.onError?.(errMsg, taskId);
        return null;
      }
    },
    [addTask, completeTask, failTask, genId, registerAbort]
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
      const parentAbort = new AbortController();
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

      // Register the parent AbortController so cancelTask(parentId) aborts everything
      registerAbort(parentId, parentAbort);

      // Execute items with concurrency limit
      const queue = items.map((item, index) => ({ item, index }));
      const running = new Set<Promise<void>>();

      const processNext = async (): Promise<void> => {
        // Stop pulling from queue if parent was cancelled
        if (parentAbort.signal.aborted || queue.length === 0) return;
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
            signal: parentAbort.signal,
          };
          if (item.body !== undefined) {
            fetchOpts.body = JSON.stringify(item.body);
          }

          const res = await fetch(item.endpoint, fetchOpts);
          const text = await res.text();
          let data: any = null;
          try {
            data = text ? JSON.parse(text) : null;
          } catch {
            if (!res.ok) {
              throw new Error(text || `Failed with status ${res.status}`);
            }
          }

          if (!res.ok) {
            throw new Error(data?.error || `Failed with status ${res.status}`);
          }

          results[index] = data as T;
          completed++;
          completeTask(childId, data);
          config.onItemComplete?.(index, data as T);
        } catch (e: any) {
          if (e.name === "AbortError") {
            // Parent was cancelled — mark child as cancelled too (via store dispatch)
            failTask(childId, "Cancelled");
            return;
          }
          const errMsg = e.message || "Unknown error";
          failed++;
          failTask(childId, errMsg);
          config.onItemError?.(index, errMsg);
        }

        // Update parent progress (only if not aborted)
        if (!parentAbort.signal.aborted) {
          const total = completed + failed;
          const pct = Math.round((total / items.length) * 100);
          updateTask(parentId, {
            progress: pct,
            progressLabel: `${total} of ${items.length}${failed > 0 ? ` (${failed} failed)` : ""}`,
          });
        }
      };

      // Process with concurrency limit
      while ((queue.length > 0 || running.size > 0) && !parentAbort.signal.aborted) {
        while (running.size < concurrency && queue.length > 0 && !parentAbort.signal.aborted) {
          const promise = processNext().finally(() => running.delete(promise));
          running.add(promise);
        }
        if (running.size > 0) {
          await Promise.race(running);
        }
      }

      // If cancelled, drain remaining queue children and fire onError
      if (parentAbort.signal.aborted) {
        // Clear queued items that never started
        queue.length = 0;
        config.onError?.("Cancelled by user");
        return results;
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
    [addTask, updateTask, completeTask, failTask, genId, registerAbort]
  );

  return { runTask, runBatchTask };
}
