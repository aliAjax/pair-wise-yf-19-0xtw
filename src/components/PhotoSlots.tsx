import { useRef, useState } from "react";
import { useStore } from "../store";
import type { Photo, PhotoCategory, Specimen } from "../types";
import {
  PHOTO_CATEGORIES,
  categoryLabel,
  hasCategory,
} from "../utils";
import { BlobImg } from "./ui";

/**
 * 三类照片槽：整株 / 标签 / 生境。
 * 缺一类即视觉高亮，拍摄人可直接补传；
 * 退回/上柜后按规则限制增删。
 */
export function PhotoSlots({
  specimen,
  editable,
  onChanged,
}: {
  specimen: Specimen;
  editable: boolean;
  onChanged?: () => void;
}) {
  const { addPhoto, removePhoto, operator } = useStore();
  const [busy, setBusy] = useState<PhotoCategory | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const onPick = async (cat: PhotoCategory, file: File | undefined) => {
    if (!file) return;
    if (!operator.trim()) {
      alert("请先在右上角填写拍摄人姓名");
      return;
    }
    setBusy(cat);
    try {
      await addPhoto(specimen.id, cat, file, operator);
      onChanged?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : "上传失败");
    } finally {
      setBusy(null);
    }
  };

  const onRemove = async (p: Photo) => {
    if (!window.confirm(`删除这张${categoryLabel(p.category)}照片？`)) return;
    removePhoto(specimen.id, p.id, operator || "工作人员");
    onChanged?.();
  };

  return (
    <div className="photo-slots">
      {PHOTO_CATEGORIES.map((cat) => {
        const photos = specimen.photos.filter((p) => p.category === cat.key);
        const filled = hasCategory(specimen, cat.key);
        return (
          <div
            key={cat.key}
            className={`slot${filled ? "" : " slot-missing"}${
              busy === cat.key ? " slot-busy" : ""
            }`}
          >
            <div className="slot-head">
              <span className="slot-title">
                <i className={`dot ${filled ? "dot-ok" : "dot-no"}`} />
                {cat.label}
              </span>
              <span className="slot-hint">{cat.hint}</span>
            </div>
            <div className="slot-body">
              {photos.length === 0 && (
                <div className="slot-empty">
                  <span>缺此类照片，留在补照队列</span>
                </div>
              )}
              {photos.map((p) => (
                <figure key={p.id} className="slot-photo">
                  <BlobImg blob={p.blob} alt={`${cat.label}-${p.name}`} />
                  <figcaption>
                    <span title={p.name}>{p.name}</span>
                    <small>{p.by}</small>
                  </figcaption>
                  {editable && (
                    <button
                      className="photo-del"
                      title="删除照片"
                      onClick={() => onRemove(p)}
                    >
                      ×
                    </button>
                  )}
                </figure>
              ))}
            </div>
            {editable && (
              <button
                className="slot-add"
                disabled={busy !== null}
                onClick={() => fileRefs.current[cat.key]?.click()}
              >
                {busy === cat.key ? "处理中…" : `补拍/上传${cat.label}`}
              </button>
            )}
            <input
              ref={(el) => {
                fileRefs.current[cat.key] = el;
              }}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                void onPick(cat.key, f);
                e.target.value = "";
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
