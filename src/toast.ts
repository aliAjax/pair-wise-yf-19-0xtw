import { useSyncExternalStore } from "react";
import { useCallback } from "react";

export interface ToastItem {
  id: number;
  kind: "ok" | "err";
  text: string;
}

let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function toast(text: string, kind: "ok" | "err" = "ok"): void {
  const id = ++seq;
  items = [...items, { id, kind, text }];
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, 3600);
}

export function toastResult(
  res: { ok: boolean; message?: string },
  success: string,
): void {
  toast(res.ok ? success : (res.message ?? "操作失败"), res.ok ? "ok" : "err");
}

export function useToasts(): ToastItem[] {
  const subscribeFn = useCallback(
    (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    [],
  );
  return useSyncExternalStore(subscribeFn, () => items, () => items);
}
