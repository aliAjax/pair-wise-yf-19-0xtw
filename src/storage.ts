import { AppState } from "./types";
import { EMPTY_STATE, cloneState } from "./domain";

export const STORAGE_KEY = "herbarium-workbench:v1";

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function memoryAdapter(): StorageAdapter {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => void map.set(k, v),
  };
}

/** SSR / 测试环境下回退到内存存储 */
export function defaultAdapter(): StorageAdapter {
  if (typeof localStorage !== "undefined") return localStorage;
  return memoryAdapter();
}

export function loadState(adapter: StorageAdapter = defaultAdapter()): AppState {
  const raw = adapter.getItem(STORAGE_KEY);
  if (!raw) return cloneState(EMPTY_STATE);
  try {
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.version !== 1 || !parsed.specimens) {
      return cloneState(EMPTY_STATE);
    }
    return { ...cloneState(EMPTY_STATE), ...parsed };
  } catch {
    return cloneState(EMPTY_STATE);
  }
}

export class StorageFullError extends Error {
  constructor() {
    super("浏览器存储空间已满，请先删除部分旧照片后再试");
    this.name = "StorageFullError";
  }
}

/** 所有视图（队列、鉴定、地点卡、柜位、详情页）共读这一份数据 */
export function saveState(
  state: AppState,
  adapter: StorageAdapter = defaultAdapter(),
): void {
  try {
    adapter.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === "QuotaExceededError" ||
        err.name === "NS_ERROR_DOM_QUOTA_REACHED")
    ) {
      throw new StorageFullError();
    }
    throw err;
  }
}

export function clearState(adapter: StorageAdapter = defaultAdapter()): void {
  adapter.setItem(STORAGE_KEY, "");
}
