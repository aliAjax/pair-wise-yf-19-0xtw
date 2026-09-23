import { useMemo, useState } from "react";
import { PhotoKind, Specimen, SpecimenFields } from "../types";
import {
  FIELD_LABELS,
  PHOTO_KINDS,
  addPhoto,
  missingKinds,
  queueSpecimens,
  removePhoto,
  returnForRework,
  submitForIdentification,
  updateSpecimenFields,
} from "../domain";
import { mutate, useStore, useUser } from "../store";
import { toast, toastResult } from "../toast";
import { useNavigate } from "../router";
import {
  EmptyState,
  FieldInput,
  Modal,
  PhotoCheckDots,
  PhotoUploader,
  SpecimenMeta,
  StageBadge,
} from "../components";
import { formatDateTime } from "../utils";

const FIELD_KEYS = Object.keys(FIELD_LABELS) as (keyof SpecimenFields)[];

function ReworkModal({ specimen, onClose }: { specimen: Specimen; onClose: () => void }) {
  const user = useUser();
  const [edit, setEdit] = useState<SpecimenFields>({
    collectionNo: specimen.collectionNo,
    species: specimen.species,
    location: specimen.location,
    altitude: specimen.altitude,
    habitat: specimen.habitat,
    collector: specimen.collector,
  });
  const latest = specimen.reworkHistory[specimen.reworkHistory.length - 1];

  function saveEdit() {
    const res = mutate((d) => updateSpecimenFields(d, specimen.id, edit, user));
    if (!res.ok) return toastResult(res, "");
    if (res.value.changes.length === 0) {
      toast("字段没有变化", "err");
      return;
    }
    toastResult(res, `已修改 ${res.value.changes.length} 项，旧照片与退回原因均保留`);
    onClose();
  }

  return (
    <Modal title={`退回修改 · ${specimen.collectionNo}`} onClose={onClose} wide>
      <div className="rework-banner">
        <div>
          <b>退回原因（{latest?.by} · {latest ? formatDateTime(latest.at) : ""}）</b>
          <p>{latest?.reason}</p>
        </div>
        <span className="badge stage-rework">修改后照片齐全再送鉴定</span>
      </div>
      <div className="form-grid">
        {FIELD_KEYS.map((k) => (
          <FieldInput
            key={k}
            label={FIELD_LABELS[k]}
            required
            textarea={k === "habitat"}
            value={edit[k]}
            onChange={(v) => setEdit((f) => ({ ...f, [k]: v }))}
          />
        ))}
      </div>
      <div className="modal-actions">
        <button className="primary" onClick={saveEdit}>保存修改（照片保留）</button>
        <button className="ghost" onClick={onClose}>取消</button>
      </div>
    </Modal>
  );
}

function ReturnModal({ specimen, onClose }: { specimen: Specimen; onClose: () => void }) {
  const user = useUser();
  const [reason, setReason] = useState("");
  return (
    <Modal title={`退回修改 · ${specimen.collectionNo}`} onClose={onClose}>
      <p className="muted">
        发现物种名或采集号写错时填写退回原因。退回后进入「退回修改」，已有整株 / 标签 / 生境照片全部保留。
      </p>
      <label className="field">
        <span className="field-label">退回原因<em>*</em></span>
        <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="如：种名与标签不一致，请核对" />
      </label>
      <div className="modal-actions">
        <button
          className="primary"
          onClick={() => {
            const res = mutate((d) => returnForRework(d, specimen.id, reason, user));
            if (res.ok) {
              toastResult(res, "已退回修改，旧照片与原因已保留");
              onClose();
            } else {
              toastResult(res, "");
            }
          }}
        >
          确认退回
        </button>
        <button className="ghost" onClick={onClose}>取消</button>
      </div>
    </Modal>
  );
}

function QueueCard({
  specimen,
  onPreview,
}: {
  specimen: Specimen;
  onPreview: (url: string) => void;
}) {
  const user = useUser();
  const navigate = useNavigate();
  const [showReturn, setShowReturn] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const missing = missingKinds(specimen);
  const missingLabels = missing
    .map((k) => PHOTO_KINDS.find((p) => p.key === k)!.label)
    .join("、");
  const isRework = specimen.stage === "rework";
  const latestRework = isRework
    ? specimen.reworkHistory[specimen.reworkHistory.length - 1]
    : undefined;

  function add(kind: PhotoKind, dataUrl: string, name: string) {
    const res = mutate((d) => addPhoto(d, specimen.id, kind, dataUrl, name, user));
    if (!res.ok) toastResult(res, "");
  }
  function del(photoId: string) {
    const res = mutate((d) => removePhoto(d, specimen.id, photoId, user));
    if (!res.ok) toastResult(res, "");
  }

  return (
    <article className={isRework ? "queue-card rework" : "queue-card"}>
      <header className="queue-head">
        <div>
          <div className="queue-title">
            <button className="link-title" onClick={() => navigate(`/specimen/${specimen.id}`)}>
              {specimen.collectionNo}
            </button>
            <StageBadge stage={specimen.stage} />
            <PhotoCheckDots specimen={specimen} />
          </div>
          <p className="queue-species">{specimen.species} · {specimen.collector} 采集 · {specimen.altitude}</p>
        </div>
        <div className="queue-ops">
          {isRework && <button className="ghost warn" onClick={() => setShowEdit(true)}>修改登记信息</button>}
          <button className="ghost" onClick={() => setShowReturn(true)}>退回</button>
          <button
            className="primary"
            disabled={missing.length > 0}
            title={missing.length ? `缺少${missingLabels}类照片` : "三类照片齐全"}
            onClick={() =>
              toastResult(
                mutate((d) => submitForIdentification(d, specimen.id, user)),
                isRework ? "修改完成，已重新提交鉴定" : "三类照片齐全，已提交鉴定",
              )
            }
          >
            {missing.length ? `缺${missingLabels}，留队列` : "提交鉴定"}
          </button>
        </div>
      </header>

      {isRework && latestRework && (
        <div className="rework-strip">
          <b>退回原因（{latestRework.by}）：</b>
          {latestRework.reason}
          {latestRework.changes.length > 0 && (
            <span className="rework-changes">
              已改：{latestRework.changes.map((c) => FIELD_LABELS[c.field]).join("、")}
            </span>
          )}
        </div>
      )}

      <SpecimenMeta s={specimen} />

      <div className="photo-grid3">
        {PHOTO_KINDS.map((k) => (
          <PhotoUploader
            key={k.key}
            specimen={specimen}
            kind={k.key}
            onAdd={add}
            onRemove={del}
            onPreview={onPreview}
          />
        ))}
      </div>

      {showReturn && <ReturnModal specimen={specimen} onClose={() => setShowReturn(false)} />}
      {showEdit && <ReworkModal specimen={specimen} onClose={() => setShowEdit(false)} />}
    </article>
  );
}

export default function Queue() {
  const list = useStore((s) => queueSpecimens(s));
  const [preview, setPreview] = useState<string | null>(null);
  const stats = useMemo(() => {
    const rework = list.filter((s) => s.stage === "rework").length;
    const incomplete = list.filter((s) => missingKinds(s).length > 0).length;
    return { total: list.length, rework, incomplete };
  }, [list]);

  return (
    <div>
      <div className="stat-row">
        <div className="stat"><small>队列总数</small><strong>{stats.total}</strong></div>
        <div className="stat"><small>照片不齐</small><strong>{stats.incomplete}</strong></div>
        <div className="stat"><small>退回修改</small><strong>{stats.rework}</strong></div>
        <div className="stat tip"><span>三类照片（整株 / 标签 / 生境）少一类就留在队列；鉴定通过前不上柜。</span></div>
      </div>

      {list.length === 0 ? (
        <section className="panel">
          <EmptyState
            icon="📭"
            title="补照队列是空的"
            hint="先到「标本登记」录入并完成压制，标本会自动进入这里。"
          />
        </section>
      ) : (
        <div className="stack">
          {list.map((s) => (
            <QueueCard key={s.id} specimen={s} onPreview={setPreview} />
          ))}
        </div>
      )}

      {preview && (
        <div className="lightbox" onClick={() => setPreview(null)}>
          <img src={preview} alt="照片预览" />
        </div>
      )}
    </div>
  );
}
