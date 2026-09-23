import { useMemo, useState } from "react";
import { SpecimenFields } from "../types";
import {
  FIELD_LABELS,
  createSpecimen,
  listSpecimens,
  markPressed,
  setPressing,
} from "../domain";
import { mutate, useStore, useUser } from "../store";
import { toast, toastResult } from "../toast";
import { useNavigate } from "../router";
import {
  EMPTY_FIELDS,
  FieldInput,
  PressBadge,
} from "../components";

export default function Register() {
  const user = useUser();
  const navigate = useNavigate();
  const [form, setForm] = useState<SpecimenFields>({ ...EMPTY_FIELDS });
  const specimens = useStore((s) => listSpecimens(s));
  const unpressed = useMemo(
    () => specimens.filter((s) => s.stage === "unpressed"),
    [specimens],
  );

  const set = (k: keyof SpecimenFields) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  function submit() {
    const res = mutate((d) => createSpecimen(d, form, user));
    if (res.ok) {
      toast(`已登记采集号 ${res.value.collectionNo}，完成压制后进入补照队列`);
      setForm({ ...EMPTY_FIELDS });
    } else {
      toast(res.message, "err");
    }
  }

  return (
    <div className="view-grid">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>标本登记</h2>
            <p>登记六项采集信息；压制完成前标本留在登记端，完成后自动进入补照队列。</p>
          </div>
        </div>
        <div className="form-grid">
          <FieldInput label={FIELD_LABELS.collectionNo} required value={form.collectionNo} onChange={set("collectionNo")} placeholder="如 HX-20260619-01" />
          <FieldInput label={FIELD_LABELS.species} required value={form.species} onChange={set("species")} placeholder="物种名 / 科属待查" />
          <FieldInput label={FIELD_LABELS.location} required value={form.location} onChange={set("location")} placeholder="省 / 州 / 具体地点" />
          <FieldInput label={FIELD_LABELS.altitude} required value={form.altitude} onChange={set("altitude")} placeholder="如 2350 m" />
          <FieldInput label={FIELD_LABELS.habitat} required textarea value={form.habitat} onChange={set("habitat")} placeholder="林缘、溪边、草甸等生境描述" />
          <FieldInput label={FIELD_LABELS.collector} required value={form.collector} onChange={set("collector")} placeholder="采集人姓名" />
        </div>
        <div className="form-actions">
          <button className="primary" onClick={submit}>登记标本</button>
          <button className="ghost" onClick={() => setForm({ ...EMPTY_FIELDS })}>清空</button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>压制中（{unpressed.length}）</h2>
            <p>压制完成后进入补照队列；压制状态不可回退。</p>
          </div>
        </div>
        {unpressed.length === 0 ? (
          <p className="muted">暂无未完成压制的标本。</p>
        ) : (
          <div className="stack">
            {unpressed.map((s) => (
              <article key={s.id} className="list-card">
                <button className="card-main" onClick={() => navigate(`/specimen/${s.id}`)}>
                  <span className="card-top">
                    <b>{s.collectionNo}</b>
                    <PressBadge status={s.pressStatus} />
                  </span>
                  <span className="card-sub">{s.species} · {s.location} · {s.altitude}</span>
                </button>
                <span className="card-actions">
                  {s.pressStatus === "unpressed" && (
                    <button
                      className="ghost"
                      onClick={() =>
                        toastResult(
                          mutate((d) => setPressing(d, s.id, user)),
                          "已标记为压制中",
                        )
                      }
                    >
                      开始压制
                    </button>
                  )}
                  <button
                    className="primary"
                    onClick={() =>
                      toastResult(
                        mutate((d) => markPressed(d, s.id, user)),
                        "压制完成，已进入补照队列",
                      )
                    }
                  >
                    压制完成
                  </button>
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
