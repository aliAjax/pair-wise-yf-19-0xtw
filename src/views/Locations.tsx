import { useMemo, useState } from "react";
import { locationCards, photosComplete } from "../domain";
import { useStore } from "../store";
import { useNavigate } from "../router";
import { EmptyState, PhotoCheckDots, PressBadge, StageBadge } from "../components";
import { Stage } from "../types";

const STAGE_ORDER: Stage[] = ["unpressed", "queue", "rework", "identifying", "stored"];

export default function Locations() {
  const navigate = useNavigate();
  const cards = useStore((s) => locationCards(s));
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const kw = q.trim();
    return kw ? cards.filter((c) => c.location.includes(kw)) : cards;
  }, [cards, q]);

  return (
    <div>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>采集地点信息卡（{cards.length}）</h2>
            <p>按采集地点自动归并全部标本，与队列、鉴定、柜位读同一份数据。</p>
          </div>
        </div>
        <div className="filter-row">
          <input placeholder="搜索地点" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="ghost" onClick={() => setQ("")}>重置</button>
        </div>
      </section>

      {cards.length === 0 ? (
        <section className="panel"><EmptyState icon="🗺️" title="还没有地点信息" hint="登记标本后会按采集地点自动生成信息卡。" /></section>
      ) : (
        <div className="loc-grid">
          {filtered.map((card) => {
            const altitudes = [...new Set(card.specimens.map((s) => s.altitude))];
            const habitats = [...new Set(card.specimens.map((s) => s.habitat))];
            const collectors = [...new Set(card.specimens.map((s) => s.collector))];
            const stored = card.specimens.filter((s) => s.stage === "stored").length;
            const waiting = card.specimens.filter(
              (s) => s.stage === "queue" || s.stage === "rework" || s.stage === "identifying",
            ).length;
            return (
              <article key={card.location} className="panel loc-card">
                <header>
                  <h3>📍 {card.location}</h3>
                  <span className="loc-count">{card.count} 份</span>
                </header>
                <dl className="loc-dl">
                  <div><dt>海拔</dt><dd>{altitudes.join(" / ")}</dd></div>
                  <div><dt>生境</dt><dd>{habitats.join("；")}</dd></div>
                  <div><dt>采集人</dt><dd>{collectors.join("、")}</dd></div>
                  <div>
                    <dt>涉及物种</dt>
                    <dd>{card.species.join("、")}</dd>
                  </div>
                  <div className="loc-progress">
                    <span className="ok">已上柜 {stored}</span>
                    <span className="pending">流程中 {waiting}</span>
                  </div>
                </dl>
                <div className="loc-list">
                  {[...card.specimens]
                    .sort(
                      (a, b) =>
                        STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage),
                    )
                    .map((s) => (
                      <button key={s.id} className="loc-item" onClick={() => navigate(`/specimen/${s.id}`)}>
                        <span className="loc-item-no">
                          {s.collectionNo}
                          {s.stage === "unpressed" ? (
                            <PressBadge status={s.pressStatus} />
                          ) : (
                            <StageBadge stage={s.stage} />
                          )}
                        </span>
                        <span className="loc-item-right">
                          <i>{s.species}</i>
                          {s.stage !== "unpressed" && (
                            <PhotoCheckDots specimen={s} />
                          )}
                        </span>
                      </button>
                    ))}
                </div>
                <p className="loc-foot">
                  {card.specimens.every((s) => photosComplete(s) || s.stage === "unpressed")
                    ? "流程中标本照片均已齐全"
                    : "存在照片不齐标本，仍在补照队列"}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
