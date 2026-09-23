import { useState } from "react";
import {
  FIELD_LABELS,
  PHOTO_KINDS,
  STAGE_LABELS,
  getSpecimen,
  missingKinds,
  returnForRework,
  submitForIdentification,
} from "../domain";
import { mutate, useStore, useUser } from "../store";
import { toastResult } from "../toast";
import { useNavigate } from "../router";
import {
  EmptyState,
  Modal,
  PhotoCheckDots,
  PressBadge,
  StageBadge,
} from "../components";
import { SpecimenFields } from "../types";
import { formatDateTime } from "../utils";
import StoreDialog from "./StoreDialog";

const FIELD_KEYS = Object.keys(FIELD_LABELS) as (keyof SpecimenFields)[];

function ReturnModal({ specimenId, onClose }: { specimenId: string; onClose: () => void }) {
  const user = useUser();
  const [reason, setReason] = useState("");
  return (
    <Modal title="退回修改" onClose={onClose}>
      <p className="muted">
        拍摄人发现物种名或采集号写错时退回。旧照片与退回原因都会保留，退回后回到补照队列修改。
      </p>
      <label className="field">
        <span className="field-label">退回原因<em>*</em></span>
        <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="如：采集号与采集记录本不符" />
      </label>
      <div className="modal-actions">
        <button
          className="primary"
          onClick={() => {
            const res = mutate((d) => returnForRework(d, specimenId, reason, user));
            if (res.ok) {
              toastResult(res, "已退回，旧照片与原因已保留");
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

export default function SpecimenDetail({ id }: { id: string }) {
  const user = useUser();
  const navigate = useNavigate();
  const specimen = useStore((s) => getSpecimen(s, id));
  const [returning, setReturning] = useState(false);
  const [storing, setStoring] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  if (!specimen) {
    return (
      <section className="panel">
        <EmptyState icon="🫙" title="找不到这份标本" hint="可能已被清空数据，返回工作台看看其他标本。" />
        <div className="modal-actions">
          <button className="primary" onClick={() => navigate("/queue")}>返回补照队列</button>
        </div>
      </section>
    );
  }

  const missing = missingKinds(specimen);
  const inPhotoStage = specimen.stage === "queue" || specimen.stage === "rework";

  return (
    <div className="detail">
      <button className="back-link" onClick={() => navigate(-1)}>← 返回</button>

      <section className="panel">
        <div className="detail-head">
          <div>
            <div className="queue-title detail-title">
              <h2>{specimen.collectionNo}</h2>
              <StageBadge stage={specimen.stage} />
              {specimen.stage === "unpressed" && <PressBadge status={specimen.pressStatus} />}
              <PhotoCheckDots specimen={specimen} />
            </div>
            <p className="queue-species">{specimen.species}</p>
          </div>
          <div className="detail-ops">
            {inPhotoStage && (
              <>
                <button className="ghost warn" onClick={() => setReturning(true)}>退回修改</button>
                <button
                  className="primary"
                  disabled={missing.length > 0}
                  title={missing.length ? `缺少${missing.map((k) => PHOTO_KINDS.find((p) => p.key === k)!.label).join("、")}` : ""}
                  onClick={() =>
                    toastResult(
                      mutate((d) => submitForIdentification(d, specimen.id, user)),
                      specimen.stage === "rework" ? "已重新提交鉴定" : "已提交鉴定",
                    )
                  }
                >
                  {missing.length ? "照片不齐，留队列" : "提交鉴定"}
                </button>
              </>
            )}
            {specimen.stage === "identifying" && (
              <button className="ghost warn" onClick={() => setReturning(true)}>退回修改</button>
            )}
            {specimen.stage === "identifying" && (
              <button className="primary" onClick={() => setStoring(true)}>鉴定通过 · 上柜</button>
            )}
            {specimen.stage === "stored" && (
              <span className="cab-tag">🗄️ 柜位 <b>{specimen.cabinetNo}</b> · {formatDateTime(specimen.storedAt!)}</span>
            )}
          </div>
        </div>

        <dl className="detail-fields">
          {FIELD_KEYS.map((k) => (
            <div key={k} className={k === "habitat" ? "wide" : ""}>
              <dt>{FIELD_LABELS[k]}</dt>
              <dd>{specimen[k]}</dd>
            </div>
          ))}
          <div>
            <dt>当前阶段</dt>
            <dd>{STAGE_LABELS[specimen.stage]}</dd>
          </div>
          <div>
            <dt>登记时间</dt>
            <dd>{formatDateTime(specimen.createdAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <div className="panel-head compact">
          <h3>三类照片（{specimen.photos.length} 张）</h3>
          <p className="muted">
            整株 / 标签 / 生境，少一类留在队列。
            {inPhotoStage && "补拍 / 删改请到「补照队列」。"}
          </p>
        </div>
        <div className="detail-photos">
          {PHOTO_KINDS.map(({ key, label, hint }) => {
            const photos = specimen.photos.filter((p) => p.kind === key);
            return (
              <div key={key} className={photos.length ? "detail-photo filled" : "detail-photo"}>
                <h4>
                  {label}照
                  <span className={`check-mark ${photos.length ? "yes" : "no"}`}>
                    {photos.length ? `✓ ${photos.length} 张` : "缺"}
                  </span>
                </h4>
                <small className="muted">{hint}</small>
                <div className="photo-thumbs readonly">
                  {photos.map((p) => (
                    <figure key={p.id} className="thumb">
                      <img src={p.dataUrl} alt={label} onClick={() => setPreview(p.dataUrl)} />
                      <figcaption><span>{formatDateTime(p.addedAt)} · {p.by} · {p.name}</span></figcaption>
                    </figure>
                  ))}
                  {photos.length === 0 && <span className="photo-missing">暂无{label}照</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {specimen.reworkHistory.length > 0 && (
        <section className="panel">
          <div className="panel-head compact"><h3>退回与修改记录</h3></div>
          <div className="timeline rework-timeline">
            {[...specimen.reworkHistory].reverse().map((r) => (
              <div key={r.id} className="tl-item rework">
                <div className="tl-dot" />
                <div className="tl-body">
                  <p className="tl-title">
                    退回修改 · {r.by} · {formatDateTime(r.at)}
                  </p>
                  <p className="tl-detail"><b>退回原因：</b>{r.reason}</p>
                  {r.changes.length > 0 && (
                    <ul className="change-list">
                      {r.changes.map((c, i) => (
                        <li key={i}>
                          {FIELD_LABELS[c.field]}：<del>{c.from}</del> → <b>{c.to}</b>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="muted">退回时原有 {specimen.photos.length} 张照片全部保留。</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-head compact"><h3>处理时间线</h3></div>
        <div className="timeline">
          {[...specimen.events].reverse().map((e) => (
            <div key={e.id} className="tl-item">
              <div className="tl-dot" />
              <div className="tl-body">
                <p className="tl-title">{e.type} · {e.by} · {formatDateTime(e.at)}</p>
                <p className="tl-detail">{e.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {returning && <ReturnModal specimenId={specimen.id} onClose={() => setReturning(false)} />}
      {storing && <StoreDialog specimenId={specimen.id} onClose={() => setStoring(false)} />}
      {preview && (
        <div className="lightbox" onClick={() => setPreview(null)}>
          <img src={preview} alt="照片预览" />
        </div>
      )}
    </div>
  );
}
