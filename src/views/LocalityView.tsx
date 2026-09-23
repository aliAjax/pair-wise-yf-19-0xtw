import { useMemo, useState } from "react";
import { useStore } from "../store";
import type { Specimen } from "../types";
import { stageOf } from "../utils";
import { EmptyState } from "../components/ui";

const ORDER = ["pressing", "queue", "approved", "shelved"] as const;

export function LocalityView({
  goDetail,
}: {
  goDetail: (id: string) => void;
}) {
  const { specimens } = useStore();
  const [open, setOpen] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<
      string,
      { specimens: Specimen[]; altitudes: Set<string>; collectors: Set<string> }
    >();
    for (const sp of specimens) {
      const key = sp.locality || "（未填地点）";
      if (!map.has(key))
        map.set(key, {
          specimens: [],
          altitudes: new Set(),
          collectors: new Set(),
        });
      const g = map.get(key)!;
      g.specimens.push(sp);
      if (sp.altitude) g.altitudes.add(sp.altitude);
      sp.collectors
        .split(/[、,，]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((c) => g.collectors.add(c));
    }
    return Array.from(map.entries())
      .map(([locality, g]) => ({ locality, ...g }))
      .sort((a, b) => a.locality.localeCompare(b.locality, "zh"));
  }, [specimens]);

  if (groups.length === 0) {
    return (
      <section className="panel">
        <EmptyState icon="🗺️" title="还没有地点信息" />
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="kicker">采集地点信息卡</p>
          <h2>按采集地点汇总（{groups.length} 个地点）</h2>
        </div>
        <p className="panel-note">数据与队列、鉴定、柜位记录同源，实时联动。</p>
      </div>

      <div className="loc-grid">
        {groups.map((g) => {
          const stageCount: Record<string, number> = {
            pressing: 0,
            queue: 0,
            approved: 0,
            shelved: 0,
          };
          g.specimens.forEach((s) => (stageCount[stageOf(s)] += 1));
          const isOpen = open === g.locality;
          return (
            <article key={g.locality} className="loc-card">
              <button
                className="loc-card-head"
                onClick={() => setOpen(isOpen ? null : g.locality)}
              >
                <h3>📍 {g.locality}</h3>
                <span className="loc-chevron">{isOpen ? "▾" : "▸"}</span>
              </button>
              <div className="loc-stats">
                {ORDER.map((st) => (
                  <span key={st} className={`loc-stat stat-${st}`}>
                    {st === "pressing"
                      ? "压制中"
                      : st === "queue"
                      ? "补照队列"
                      : st === "approved"
                      ? "待上柜"
                      : "已上柜"}
                    <b>{stageCount[st]}</b>
                  </span>
                ))}
              </div>
              <dl className="loc-dl">
                <div>
                  <dt>海拔范围</dt>
                  <dd>
                    {g.altitudes.size
                      ? Array.from(g.altitudes).join("、")
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>采集人</dt>
                  <dd>{Array.from(g.collectors).join("、") || "—"}</dd>
                </div>
                <div>
                  <dt>标本数</dt>
                  <dd>{g.specimens.length} 份</dd>
                </div>
              </dl>
              {isOpen && (
                <ul className="loc-list">
                  {g.specimens
                    .slice()
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .map((sp) => (
                      <li key={sp.id}>
                        <button
                          className="loc-item"
                          onClick={() => goDetail(sp.id)}
                        >
                          <span className="loc-item-code">{sp.code}</span>
                          <span className="loc-item-species">{sp.species}</span>
                          <span className="loc-item-habitat" title={sp.habitat}>
                            {sp.habitat || "—"}
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
