import { useMemo, useState } from "react";
import { useStore } from "../store";
import type { Specimen } from "../types";
import { fmtTime } from "../utils";
import { SpecimenCard } from "../components/SpecimenCard";
import { EmptyState } from "../components/ui";

export function ShelfView({
  operator,
  goDetail,
  notify,
}: {
  operator: string;
  goDetail: (id: string) => void;
  notify: (text: string, kind?: "info" | "error" | "success") => void;
}) {
  const { specimens, assignShelf } = useStore();
  const [code, setCode] = useState("");
  const [target, setTarget] = useState<Specimen | null>(null);
  const [conflict, setConflict] = useState<Specimen | null>(null);

  const approved = useMemo(
    () => specimens.filter((s) => s.identified && !s.shelf),
    [specimens]
  );
  const shelved = useMemo(
    () =>
      specimens
        .filter((s) => s.shelf)
        .sort((a, b) => (a.shelf!.code < b.shelf!.code ? -1 : 1)),
    [specimens]
  );
  const occupied = useMemo(
    () => new Set(shelved.map((s) => s.shelf!.code)),
    [shelved]
  );
  const cabinets = useMemo(
    () => Array.from(new Set(shelved.map((s) => s.shelf!.cabinet))).sort(),
    [shelved]
  );

  const tryAssign = async (sp: Specimen, raw: string) => {
    if (!operator.trim()) {
      notify("请先在右上角填写操作人", "error");
      return;
    }
    if (!/^[A-Za-z0-9]+-\S+-\S+$/.test(raw.trim())) {
      notify("柜位编号格式应为「柜号-层-位」，如 A-12-03", "error");
      return;
    }
    const result = await assignShelf(sp.id, raw, operator);
    if (result.ok) {
      notify(`${sp.code} 已上柜至 ${raw.trim().toUpperCase()}`, "success");
      setCode("");
      setTarget(null);
    } else if (result.conflict) {
      // 柜位已有标本：提示换位，原队列与柜位记录均不变
      setConflict(result.conflict);
      notify(`柜位 ${raw.trim().toUpperCase()} 已被占用`, "error");
    }
  };

  return (
    <div className="view-grid">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="kicker">柜位分配</p>
            <h2>鉴定通过 · 等待上柜（{approved.length}）</h2>
          </div>
        </div>
        {approved.length === 0 ? (
          <EmptyState
            icon="🗄️"
            title="没有待上柜标本"
            desc="鉴定通过的标本会出现在这里，按「柜号-层-位」分配"
          />
        ) : (
          <div className="stack">
            {approved.map((sp) => (
              <SpecimenCard
                key={sp.id}
                sp={sp}
                actions={
                  <>
                    <button onClick={() => goDetail(sp.id)}>详情页</button>
                    <button
                      className="primary"
                      onClick={() => {
                        setTarget(sp);
                        setConflict(null);
                      }}
                    >
                      分配柜位
                    </button>
                  </>
                }
              >
                <p className="sub-line">
                  鉴定人：{sp.identifiedBy} · 鉴定时间：
                  {fmtTime(sp.identifiedAt)}
                </p>
                {target?.id === sp.id && (
                  <div className="shelf-assign">
                    <input
                      autoFocus
                      placeholder="柜位编号，如 A-12-03"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void tryAssign(sp, code);
                      }}
                    />
                    <button
                      className="primary"
                      onClick={() => void tryAssign(sp, code)}
                    >
                      确认上柜
                    </button>
                    <button
                      onClick={() => {
                        setTarget(null);
                        setCode("");
                        setConflict(null);
                      }}
                    >
                      取消
                    </button>
                    {conflict && (
                      <div className="shelf-conflict">
                        ⚠️ 柜位 <b>{code.trim().toUpperCase()}</b> 已有标本：
                        <b>{conflict.species}</b>（{conflict.code}
                        ，由 {conflict.shelf?.by} 于{" "}
                        {fmtTime(conflict.shelf?.at)} 上柜）。
                        请另选空位——原队列与柜位记录均保持不变。
                        <button
                          onClick={() => goDetail(conflict.id)}
                        >
                          查看占用标本
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </SpecimenCard>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="kicker">柜位记录</p>
            <h2>
              已上柜 {shelved.length} 份 · {cabinets.length} 个柜
            </h2>
          </div>
        </div>
        {shelved.length === 0 ? (
          <EmptyState icon="🏷️" title="尚无柜位记录" />
        ) : (
          <>
            <div className="occupied-chips">
              {Array.from(occupied)
                .sort()
                .map((c) => (
                  <span key={c} className="occ-chip">
                    {c}
                  </span>
                ))}
            </div>
            <div className="shelf-table-wrap">
              <table className="shelf-table">
                <thead>
                  <tr>
                    <th>柜位</th>
                    <th>采集号</th>
                    <th>物种</th>
                    <th>采集地点</th>
                    <th>上柜人 / 时间</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {shelved.map((sp) => (
                    <tr key={sp.id}>
                      <td>
                        <b className="shelf-code">{sp.shelf!.code}</b>
                      </td>
                      <td>{sp.code}</td>
                      <td>{sp.species}</td>
                      <td>{sp.locality}</td>
                      <td>
                        {sp.shelf!.by}
                        <br />
                        <small>{fmtTime(sp.shelf!.at)}</small>
                      </td>
                      <td>
                        <button onClick={() => goDetail(sp.id)}>详情</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
