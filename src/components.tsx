import { ReactNode, useRef, useState } from "react";
import { PhotoKind, Specimen, Stage } from "./types";
import {
  FIELD_LABELS,
  PHOTO_KINDS,
  PRESS_LABELS,
  STAGE_LABELS,
  photoStatus,
} from "./domain";
import { cls, formatTime } from "./utils";
import { readImageFile } from "./image";

export function StageBadge({ stage }: { stage: Stage }) {
  return <span className={cls("badge", `stage-${stage}`)}>{STAGE_LABELS[stage]}</span>;
}

export function PressBadge({ status }: { status: Specimen["pressStatus"] }) {
  return (
    <span className={cls("badge", `press-${status}`)}>
      {PRESS_LABELS[status]}
    </span>
  );
}

export function PhotoCheckDots({ specimen }: { specimen: Specimen }) {
  return (
    <div className="photo-dots" title="整株 / 标签 / 生境三类照片">
      {photoStatus(specimen).map((p) => (
        <span
          key={p.kind}
          className={cls("dot", p.ok && "on")}
          data-label={p.label}
        />
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <p className="empty-title">{title}</p>
      {hint && <p className="empty-hint">{hint}</p>}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-mask" onMouseDown={onClose}>
      <div
        className={cls("modal", wide && "wide")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export interface FieldInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  textarea?: boolean;
  half?: boolean;
}

export function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  required,
  textarea,
  half,
}: FieldInputProps) {
  return (
    <label className={cls("field", half && "half")}>
      <span className="field-label">
        {label}
        {required && <em>*</em>}
      </span>
      {textarea ? (
        <textarea
          value={value}
          rows={2}
          placeholder={placeholder ?? `填写${label}`}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          value={value}
          placeholder={placeholder ?? `填写${label}`}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

export const EMPTY_FIELDS = {
  collectionNo: "",
  species: "",
  location: "",
  altitude: "",
  habitat: "",
  collector: "",
};

export function SpecimenMeta({ s }: { s: Specimen }) {
  return (
    <dl className="meta-grid">
      <div>
        <dt>{FIELD_LABELS.location}</dt>
        <dd>{s.location}</dd>
      </div>
      <div>
        <dt>{FIELD_LABELS.altitude}</dt>
        <dd>{s.altitude}</dd>
      </div>
      <div>
        <dt>{FIELD_LABELS.habitat}</dt>
        <dd>{s.habitat}</dd>
      </div>
      <div>
        <dt>{FIELD_LABELS.collector}</dt>
        <dd>{s.collector}</dd>
      </div>
    </dl>
  );
}

interface PhotoUploaderProps {
  specimen: Specimen;
  kind: PhotoKind;
  onAdd: (kind: PhotoKind, dataUrl: string, name: string) => Promise<void> | void;
  onRemove: (photoId: string) => void;
  onPreview: (url: string) => void;
  disabled?: boolean;
}

export function PhotoUploader({
  specimen,
  kind,
  onAdd,
  onRemove,
  onPreview,
  disabled,
}: PhotoUploaderProps) {
  const meta = PHOTO_KINDS.find((k) => k.key === kind)!;
  const photos = specimen.photos.filter((p) => p.kind === kind);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || disabled) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const dataUrl = await readImageFile(file);
        await onAdd(kind, dataUrl, file.name);
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={cls("photo-slot", photos.length > 0 && "filled", disabled && "locked")}>
      <div className="photo-slot-head">
        <b>
          {meta.label}照
          <span className={`check-mark ${photos.length ? "yes" : "no"}`}>
            {photos.length ? "✓" : "缺"}
          </span>
        </b>
        <small>{meta.hint}</small>
      </div>
      <div className="photo-thumbs">
        {photos.map((p) => (
          <figure key={p.id} className="thumb">
            <img src={p.dataUrl} alt={meta.label} onClick={() => onPreview(p.dataUrl)} />
            <figcaption>
              <span>{formatTime(p.addedAt)} · {p.by}</span>
              {!disabled && (
                <button
                  className="thumb-del"
                  title="删除该照片"
                  onClick={() => onRemove(p.id)}
                >
                  删除
                </button>
              )}
            </figcaption>
          </figure>
        ))}
        {!disabled && (
          <button
            className="thumb-add"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? "处理中…" : `＋ 上传${meta.label}照`}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
