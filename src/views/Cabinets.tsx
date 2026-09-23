import { useMemo, useState } from "react";
import { listSpecimens, storedSpecimens } from "../domain";
import { useStore } from "../store";
import { useNavigate } from "../router";
import { EmptyState } from "../components";
import { formatDateTime } from "../utils";

export default function Cabinets() {
  const navigate = useNavigate();
  const cabinets = useStore((s) => s.cabinets);
  const stored = useStore((s) => storedSpecimens(s));
  const allCount = useStore((s) => listSpecimens(s).length);
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const kw = q.trim().toUpperCase();
    return [...cabinets]
      .sort((a, b) => a.cabinetNo.localeCompare(b.cabinetNo))
      .filter(
        (c) =>
          !kw ||
          c.cabinetNo.toUpperCase().includes(kw) ||
          c.collectionNo.toUpperCase().includes(kw) ||
          c.species.includes(q.trim()),
      );
  }, [cabinets, q]);

  return (
    <div>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>馆藏柜位记录（{cabinets.length}）</h2>
            <p>
              鉴定通过时写入柜位；柜位被占用会拒绝上柜并提示换位，原有队列与柜位记录均不变。
              全部 {allCount} 份 · 已上柜 {stored.length} 份。
            </p>
          </div>
        </div>
        <div className="filter-row">
          <input placeholder="按柜位号 / 采集号 / 物种搜索" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="ghost" onClick={() => setQ("")}>重置</button>
        </div>
      </section>

      {cabinets.length === 0 ? (
        <section className="panel">
          <EmptyState icon="🗄️" title="还没有柜位记录" hint="鉴定通过并指定柜位后，这里会生成柜位记录。" />
        </section>
      ) : (
        <section className="panel table-panel">
          <table className="cab-table">
            <thead>
              <tr>
                <th>柜位号</th>
                <th>采集号</th>
                <th>物种</th>
                <th>上柜时间</th>
                <th>经手人</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.cabinetNo}>
                  <td><span className="cab-no">{c.cabinetNo}</span></td>
                  <td>{c.collectionNo}</td>
                  <td>{c.species}</td>
                  <td>{formatDateTime(c.storedAt)}</td>
                  <td>{c.by}</td>
                  <td>
                    <button className="link-title" onClick={() => navigate(`/specimen/${c.specimenId}`)}>
                      详情 →
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 24 }}>没有匹配的柜位记录</td></tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
