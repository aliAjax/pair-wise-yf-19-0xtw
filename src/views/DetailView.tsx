import { useState } from "react";
import { useStore } from "../store";
import type { Specimen } from "../types";
import {
  STAGE_META,
  categoryLabel,
  fmtTime,
  missingCategories,
  openReturn,
  photoComplete,
  stageOf,
} from "../utils";
import { Badge, BlobImg, EmptyState } from "../components/ui";
import { PhotoSlots } from "../components/PhotoSlots";
import { ReturnDialog } from "../components/ReturnDialog";
import { SpecimenForm, draftFromSpecimen } from "../components/SpecimenForm";
import { Modal } from "../components/ui";

export function DetailView({
  id,
  operator,
  back,
}: {
  id: string;
  operator: string;
  back: () => void;
}) {
  const {
    specimens,
    editSpecimen,
    markPressed,
    returnSpecimen,
    approveSpecimen,
  } = useStore();
  const sp = specimens.find((s) => s.id === id);
  const [editing, setEditing] = useState(false);
  const [returning, setReturning] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (!sp) {
    return (
      <section className="panel">
        <EmptyState
          icon="🚫"
          title="找不到这份标本"
          action={
            <button className="primary" onClick={back}>
              返回工作台
            </button>
          }
        />
      </section>
    );
  }

  const stage = stageOf(sp);
  const ret = openReturn(sp);
  const missing = missingCategories(sp);
  const editablePhotos = !sp.shelf;

  return (
    <section className="panel detail">
      <button className="back-link" onClick={back}>
        ← 返回工作台
      </button>

      <header className="detail-head">
        <div>
          <div className="detail-badges">
            <Badge tone={STAGE_META[stage].tone}>{STAGE_META[stage].label}</Badge>
            {ret && <Badge tone="red">退回待改</Badge>}
            {stage === "queue" && photoComplete(sp) && !ret && (
              <Badge tone="blue">三类照片齐全</Badge>
            )}
            {sp.shelf && <Badge tone="ink">柜位 {sp.shelf.code}</Badge>}
          </div>
          <h2>{sp.species}</h2>
          <p className="detail-code">{sp.code}</p>
        </div>
        <div className="detail-actions">
          {stage === "pressing" && (
            <button
              className="primary"
              disabled={!operator.trim()}
              onClick={() => markPressed(sp.id, operator)}
            >
              标记压制完成
            </button>
          )}
          {editablePhotos && (
            <button onClick={() => setEditing(true)}>修改登记信息</button>
          )}
          {stage === "queue" && (
            <button className="btn-danger" onClick={() => setReturning(true)}>
              退回修改
            </button>
          )}
          {stage === "queue" && photoComplete(sp) && !ret && (
            <button
              className="primary"
              disabled={!operator.trim()}
              onClick={() => approveSpecimen(sp.id, operator)}
            >
              鉴定通过
            </button>
          )}
        </div>
      </header>

      <div className="detail-layout">
        <div className="detail-main">
          <div className="detail-block">
            <h3>三类补照照片</h3>
            {!photoComplete(sp) && stage !== "pressing" && (
              <p className="sp-missing">
                尚缺：
                {missing
                  .map((m) => categoryLabel(m))
                  .join("、")}
                ，未齐前留在补照队列、不能鉴定上柜。
              </p>
            )}
            <PhotoSlots specimen={sp} editable={editablePhotos} />
          </div>

          {ret && (
            <div className="detail-block return-block">
              <h3>当前退回意见</h3>
              <div className="return-record">
                <p>
                  <b>{ret.by}</b> · {fmtTime(ret.at)}
                </p>
                <p className="return-reason">{ret.reason}</p>
                <p className="muted">
                  请核对物种名 / 采集号后在上方「修改登记信息」中更正；
                  旧照片保留，保存后意见自动标记已处理。
                </p>
              </div>
            </div>
          )}

          <div className="detail-block">
            <h3>处理流水</h3>
          <ol className="history">
            {sp.history
              .slice()
              .reverse()
              .map((h) => (
                <li key={h.id}>
                  <time>{fmtTime(h.at)}</time>
                  <div>
                    <p>{h.text}</p>
                    <small>{h.by}</small>
                  </div>
                </li>
              ))}
          </ol>
          </div>
        </div>

        <aside className="detail-side">
          <h3>登记信息</h3>
          <dl className="info-list">
            <div>
              <dt>采集号</dt>
              <dd>{sp.code}</dd>
            </div>
            <div>
              <dt>物种</dt>
              <dd>{sp.species}</dd>
            </div>
            <div>
              <dt>采集地点</dt>
              <dd>{sp.locality}</dd>
            </div>
            <div>
              <dt>海拔</dt>
              <dd>{sp.altitude || "—"}</dd>
            </div>
            <div>
              <dt>生境</dt>
              <dd>{sp.habitat || "—"}</dd>
            </div>
            <div>
              <dt>采集人</dt>
              <dd>{sp.collectors}</dd>
            </div>
            <div>
              <dt>压制</dt>
              <dd>
                {sp.pressed
                  ? `完成 · ${sp.pressedBy} · ${fmtTime(sp.pressedAt)}`
                  : "压制中"}
              </dd>
            </div>
            <div>
              <dt>鉴定</dt>
              <dd>
                {sp.identified
                  ? `通过 · ${sp.identifiedBy} · ${fmtTime(sp.identifiedAt)}`
                  : "未通过 / 待鉴定"}
              </dd>
            </div>
            <div>
              <dt>柜位</dt>
              <dd>
                {sp.shelf
                  ? `${sp.shelf.code}（${sp.shelf.by} · ${fmtTime(
                      sp.shelf.at
                    )}）`
                  : "—"}
              </dd>
            </div>
          </dl>

          <h3 className="mt">照片清单（{sp.photos.length}）</h3>
          {sp.photos.length === 0 ? (
            <p className="muted">尚无照片</p>
          ) : (
            <ul className="photo-manifest">
              {sp.photos.map((p) => (
                <li key={p.id}>
                  <button
                    className="manifest-item"
                    onClick={() => setLightbox(p.id)}
                  >
                    <BlobImg blob={p.blob} alt={p.name} />
                    <span>
                      <b>{categoryLabel(p.category)}</b>
                      <small>{p.name}</small>
                      <small>
                        {p.by} · {fmtTime(p.at)}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {editing && (
        <Modal title={`修改信息 · ${sp.code}`} onClose={() => setEditing(false)} wide>
          <SpecimenForm
            specimen={sp}
            initial={draftFromSpecimen(sp)}
            operator={operator}
            submitLabel="保存修改（旧照片保留）"
            onDone={(draft, by) => {
              editSpecimen(sp.id, draft, by);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        </Modal>
      )}
      {returning && (
        <ReturnDialog
          specimen={sp}
          operator={operator}
          title="退回修改"
          fromIdentified={sp.identified}
          onConfirm={(reason, by) => {
            returnSpecimen(sp.id, reason, by);
            setReturning(false);
          }}
          onClose={() => setReturning(false)}
        />
      )}
      {lightbox && (
        <Lightbox
          sp={sp}
          photoId={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </section>
  );
}

function Lightbox({
  sp,
  photoId,
  onClose,
}: {
  sp: Specimen;
  photoId: string;
  onClose: () => void;
}) {
  const photo = sp.photos.find((p) => p.id === photoId);
  if (!photo) return null;
  return (
    <Modal title={`${categoryLabel(photo.category)} · ${photo.name}`} onClose={onClose} wide>
      <div className="lightbox">
        <BlobImg blob={photo.blob} alt={photo.name} />
        <p className="muted">
          拍摄/上传：{photo.by} · {fmtTime(photo.at)}
        </p>
      </div>
    </Modal>
  );
}
