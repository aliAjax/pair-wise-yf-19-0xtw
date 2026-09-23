import { useSyncExternalStore } from "react";
import { useCallback, useMemo } from "react";
import { AppState, Result } from "./types";
import { cloneState } from "./domain";
import { loadState, saveState } from "./storage";

let state: AppState = loadState();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): AppState {
  return state;
}

/**
 * 在状态草稿上执行一次领域操作：
 * 先深拷贝，操作失败直接丢弃草稿（队列 / 柜位记录不变）；
 * 持久化失败同样回滚。
 */
export function mutate<T>(fn: (draft: AppState) => Result<T>): Result<T> {
  const draft = cloneState(state);
  const res = fn(draft);
  if (!res.ok) return res;
  try {
    saveState(draft);
  } catch (err) {
    return {
      ok: false,
      code: "SAVE_FAILED",
      message: err instanceof Error ? err.message : "保存失败",
    };
  }
  state = draft;
  emit();
  return res;
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

export function useStore<T>(selector: (s: AppState) => T): T {
  const s = useAppState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => selector(s), [s, selector]);
}

export function useUser(): string {
  return useStore(useCallback((s: AppState) => s.currentUser, []));
}

/** 整体替换当前数据（载入演示数据 / 清空），同样先持久化再生效 */
export function replaceState(next: AppState): Result {
  try {
    saveState(next);
  } catch (err) {
    return {
      ok: false,
      code: "SAVE_FAILED",
      message: err instanceof Error ? err.message : "保存失败",
    };
  }
  state = next;
  emit();
  return { ok: true, value: undefined };
}
