import type {
  PhotoCategory,
  QueueState,
  Specimen,
  Stage,
} from "./types";

let counter = 0;
export function uid(prefix = "id"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export const PHOTO_CATEGORIES: {
  key: PhotoCategory;
  label: string;
  hint: string;
}[] = [
  { key: "whole", label: "整株", hint: "标本整体形态" },
  { key: "label", label: "标签", hint: "鉴定标签与采集签" },
  { key: "habitat", label: "生境", hint: "野外生境记录" },
];

export function categoryLabel(key: PhotoCategory): string {
  return PHOTO_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export function fmtTime(ts?: number): string {
  if (!ts) return "—";
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

export function fmtDate(ts?: number): string {
  if (!ts) return "—";
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 某类照片是否至少一张 */
export function hasCategory(sp: Specimen, key: PhotoCategory): boolean {
  return sp.photos.some((p) => p.category === key);
}

export function missingCategories(sp: Specimen): PhotoCategory[] {
  return PHOTO_CATEGORIES.filter((c) => !hasCategory(sp, c.key)).map(
    (c) => c.key
  );
}

export function photoComplete(sp: Specimen): boolean {
  return missingCategories(sp).length === 0;
}

export function openReturn(sp: Specimen) {
  return sp.returns.find((r) => !r.resolved);
}

/** 大阶段（压制中 / 补照队列 / 鉴定通过 / 已上柜） */
export function stageOf(sp: Specimen): Stage {
  if (sp.shelf) return "shelved";
  if (sp.identified) return "approved";
  if (!sp.pressed) return "pressing";
  return "queue";
}

export const STAGE_META: Record<
  Stage,
  { label: string; tone: "amber" | "blue" | "green" | "ink" }
> = {
  pressing: { label: "压制中", tone: "amber" },
  queue: { label: "补照队列", tone: "blue" },
  approved: { label: "鉴定通过", tone: "green" },
  shelved: { label: "已上柜", tone: "ink" },
};

/** 队列内细分状态 */
export function queueStateOf(sp: Specimen): QueueState {
  if (openReturn(sp)) return "returned";
  if (!photoComplete(sp)) return "incomplete";
  return "ready";
}

export const QUEUE_STATE_META: Record<
  QueueState,
  { label: string; tone: "red" | "amber" | "blue" }
> = {
  returned: { label: "退回待改", tone: "red" },
  incomplete: { label: "缺照", tone: "amber" },
  ready: { label: "待鉴定", tone: "blue" },
};

/**
 * 将上传的照片压缩到长边 1600px、JPEG 0.82，
 * 保证 IndexedDB 配额内可长期保存。
 */
export async function fileToPhoto(
  file: File
): Promise<{ blob: Blob; name: string }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("只能上传图片文件");
  }
  const bitmap = await loadBitmap(file);
  const canvas = document.createElement("canvas");
  const MAX = 1600;
  let { width, height } = bitmap;
  if (Math.max(width, height) > MAX) {
    const ratio = MAX / Math.max(width, height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { blob: file, name: file.name };
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.82)
  );
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();
  if (!blob) return { blob: file, name: file.name };
  const base = file.name.replace(/\.[^.]+$/, "");
  return { blob, name: `${base}.jpg` };
}

function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file).catch(() => loadViaImage(file));
  }
  return loadViaImage(file);
}

function loadViaImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片读取失败"));
    };
    img.src = url;
  });
}

/** 简单转义，避免 innerHTML 风险（本应用以 JSX 为主，仅个别地方需要） */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
