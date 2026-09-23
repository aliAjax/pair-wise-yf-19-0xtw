import { useMemo, useState } from "react";
import { useStore } from "../store";
import type { Specimen, SpecimenDraft } from "../types";

const EMPTY: SpecimenDraft = {
  code: "",
  species: "",
  locality: "",
  altitude: "",
  habitat: "",
  collectors: "",
  pressed: false,
};

export function SpecimenForm({
  initial,
  specimen,
  operator,
  onDone,
  onCancel,
  submitLabel = "登记标本",
  cancelLabel = "取消",
}: {
  initial?: Partial<SpecimenDraft>;
  specimen?: Specimen;
  operator: string;
  onDone: (draft: SpecimenDraft, by: string) => void;
  onCancel: () => void;
  submitLabel?: string;
  cancelLabel?: string;
}) {
  const { findByCode } = useStore();
  const [form, setForm] = useState<SpecimenDraft>({
    ...EMPTY,
    ...initial,
  });
  const [by, setBy] = useState(operator);
  const [error, setError] = useState("");

  const duplicate = useMemo(
    () => findByCode(form.code, specimen?.id),
    [findByCode, form.code, specimen?.id]
  );

  const set = <K extends keyof SpecimenDraft>(k: K, v: SpecimenDraft[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) return setError("请填写采集号");
    if (!form.species.trim()) return setError("请填写物种名称");
    if (!form.locality.trim()) return setError("请填写采集地点");
    if (!form.collectors.trim()) return setError("请填写采集人");
    if (duplicate) return setError(`采集号 ${form.code.trim()} 已存在，请核对`);
    if (!by.trim()) return setError("请填写操作人");
    onDone(form, by.trim());
  };

  return (
    <form className="spec-form" onSubmit={submit}>
      <div className="form-grid">
        <label className="field">
          <span>
            采集号 <i>*</i>
          </span>
          <input
            value={form.code}
            onChange={(e) => set("code", e.target.value)}
            placeholder="如 HX-20250615-01"
          />
          {duplicate && (
            <small className="field-error">该采集号已登记过</small>
          )}
        </label>
        <label className="field">
          <span>
            物种名称 <i>*</i>
          </span>
          <input
            value={form.species}
            onChange={(e) => set("species", e.target.value)}
            placeholder="学名或暂定名"
          />
        </label>
        <label className="field field-wide">
          <span>
            采集地点 <i>*</i>
          </span>
          <input
            value={form.locality}
            onChange={(e) => set("locality", e.target.value)}
            placeholder="省 / 县 / 小地名"
          />
        </label>
        <label className="field">
          <span>海拔</span>
          <input
            value={form.altitude}
            onChange={(e) => set("altitude", e.target.value)}
            placeholder="如 1420 m"
          />
        </label>
        <label className="field">
          <span>
            采集人 <i>*</i>
          </span>
          <input
            value={form.collectors}
            onChange={(e) => set("collectors", e.target.value)}
            placeholder="多人以、分隔"
          />
        </label>
        <label className="field field-wide">
          <span>生境描述</span>
          <textarea
            rows={2}
            value={form.habitat}
            onChange={(e) => set("habitat", e.target.value)}
            placeholder="林下、坡向、土壤、伴生种等"
          />
        </label>
      </div>

      <label className="check-row">
        <input
          type="checkbox"
          checked={form.pressed}
          onChange={(e) => set("pressed", e.target.checked)}
        />
        <span>压制已完成，登记后直接进入补照队列</span>
      </label>

      <label className="field operator-line">
        <span>操作人</span>
        <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="登记人姓名" />
      </label>

      {error && <p className="form-error">{error}</p>}

      <div className="modal-actions">
        <button type="button" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button className="primary" type="submit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export function draftFromSpecimen(sp: Specimen): SpecimenDraft {
  return {
    code: sp.code,
    species: sp.species,
    locality: sp.locality,
    altitude: sp.altitude,
    habitat: sp.habitat,
    collectors: sp.collectors,
    pressed: sp.pressed,
  };
}
