import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** Blob → objectURL，自动回收 */
export function BlobImg({
  blob,
  alt,
  className,
}: {
  blob: Blob;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  if (!url) return <div className={`img-placeholder ${className ?? ""}`} />;
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}

type Tone = "amber" | "blue" | "green" | "ink" | "red" | "gray";

export function Badge({
  tone = "gray",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className={`modal${wide ? " modal-wide" : ""}`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  icon = "🌿",
  title,
  desc,
  action,
}: {
  icon?: string;
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <p className="empty-title">{title}</p>
      {desc && <p className="empty-desc">{desc}</p>}
      {action}
    </div>
  );
}

/** 简单的确认/提示框 */
export function useConfirm() {
  const [state, setState] = useState<{
    message: ReactNode;
    resolve?: (v: boolean) => void;
    danger?: boolean;
  } | null>(null);
  const confirmRef = useRef(state);
  confirmRef.current = state;

  const confirm = (message: ReactNode, danger = false) =>
    new Promise<boolean>((resolve) => {
      setState({ message, resolve, danger });
    });

  const node = state ? (
    <Modal
      title="请确认"
      onClose={() => {
        state.resolve?.(false);
        setState(null);
      }}
    >
      <div className="confirm-msg">{state.message}</div>
      <div className="modal-actions">
        <button
          onClick={() => {
            state.resolve?.(false);
            setState(null);
          }}
        >
          取消
        </button>
        <button
          className={state.danger ? "btn-danger" : "primary"}
          onClick={() => {
            state.resolve?.(true);
            setState(null);
          }}
        >
          确定
        </button>
      </div>
    </Modal>
  ) : null;

  return { confirm, node };
}

/** 全局轻提示 */
let toastSeq = 0;
interface ToastItem {
  id: number;
  text: string;
  kind: "info" | "error" | "success";
}

export function ToastHost({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="toast-host">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.kind}`}
          onClick={() => onDismiss(t.id)}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function makeToastApi() {
  let set:
    | ((updater: (prev: ToastItem[]) => ToastItem[]) => void)
    | null = null;
  return {
    bind(fn: typeof set) {
      set = fn;
    },
    push(text: string, kind: ToastItem["kind"] = "info") {
      const id = ++toastSeq;
      set?.((prev) => [...prev, { id, text, kind }]);
      setTimeout(() => {
        set?.((prev) => prev.filter((t) => t.id !== id));
      }, 3600);
    },
  };
}

export type { ToastItem };
