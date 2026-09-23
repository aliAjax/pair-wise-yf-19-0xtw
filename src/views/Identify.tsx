import { useMemo, useState } from "react";
import { identifyingSpecimens, listSpecimens } from "../domain";
import { useStore } from "../store";
import { useNavigate } from "../router";
import {
  EmptyState,
  PhotoCheckDots,
  SpecimenMeta,
} from "../components";
import { Photo } from "../types";
import { formatDateTime } from "../utils";
import StoreDialog from "./StoreDialog";

export default function Identify() {
  const navigate = useNavigate();
  const list = useStore((s) => identifyingSpecimens(s));
  const allCount = useStore((s) => listSpecimens(s).length);
  const [q, setQ] = useState("");
  const [speciesQ, setSpeciesQ] = useState("");
  const [locationQ, setLocationQ] = useState("");
  const [storeId, setStoreId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const kw = q.trim().toUpperCase();
    const sp = speciesQ.trim();
    const loc = locationQ.trim();
    return list.filter((s) => {
      if (kw && !s.collectionNo.toUpperCase().includes(kw)) return false;
      if (sp && !s.species.includes(sp)) return false;
      if (loc && !s.location.includes(loc)) return false;
      return true;
    });
  }, [list, q, speciesQ, locationQ]);

  return (
    <div>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>鉴定筛选</h2>
            <p>只有补照齐全、提交鉴定的标本出现在这里。全部记录 {allCount} 份，待鉴定 {list.length} 份。</p>
          </div>
        </div>
        <div className="filter-row">
          <input placeholder="按采集号搜索" value={q} onChange={(e) => setQ(e.target.value)} />
          <input placeholder="按物种名筛选" value={speciesQ} onChange={(e) => setSpeciesQ(e.target.value)} />
          <input placeholder="按采集地点筛选" value={locationQ} onChange={(e) => setLocationQ(e.target.value)} />
          <button className="ghost" onClick={() => { setQ(""); setSpeciesQ(""); setLocationQ(""); }}>重置</button>
        </div>
      </section>

      {list.length === 0 ? (
        <section className="panel">
          <EmptyState icon="🔬" title="没有待鉴定标本" hint="补照工作台里三类照片齐全并提交鉴定的标本会出现在这里。" />
        </section>
      ) : filtered.length === 0 ? (
        <section className="panel"><EmptyState icon="🔍" title="筛选无结果" /></section>
      ) : (
        <div className="stack">
          {filtered.map((s) => (
            <article key={s.id} className="panel identify-card">
              <div className="queue-head">
                <div>
                  <div className="queue-title">
                    <button className="link-title" onClick={() => navigate(`/specimen/${s.id}`)}>{s.collectionNo}</button>
                    <PhotoCheckDots specimen={s} />
                    <span className="badge stage-identifying">待鉴定</span>
                  </div>
                  <p className="queue-species">{s.species} · 送鉴 {formatDateTime(s.updatedAt)}</p>
                </div>
                <div className="queue-ops">
                  <button className="primary" onClick={() => setStoreId(s.id)}>鉴定通过 · 上柜</button>
                </div>
              </div>
              <SpecimenMeta s={s} />
              <div className="photo-thumbs readonly">
                {(["whole", "label", "habitat"] as const).flatMap((kind) =>
                  s.photos
                    .filter((p: Photo) => p.kind === kind)
                    .map((p: Photo) => (
                      <figure key={p.id} className="thumb">
                        <img src={p.dataUrl} alt={p.kind} onClick={() => setPreview(p.dataUrl)} />
                        <figcaption><span>{kind === "whole" ? "整株" : kind === "label" ? "标签" : "生境"} · {p.by}</span></figcaption>
                      </figure>
                    )),
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {storeId && <StoreDialog specimenId={storeId} onClose={() => setStoreId(null)} />}
      {preview && (
        <div className="lightbox" onClick={() => setPreview(null)}>
          <img src={preview} alt="照片预览" />
        </div>
      )}
    </div>
  );
}
