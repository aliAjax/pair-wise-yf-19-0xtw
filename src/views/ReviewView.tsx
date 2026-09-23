import { useMemo, useState } from "react";
import { useStore } from "../store";
import type { Specimen } from "../types";
import {
  fmtTime,
  missingCategories,
  photoComplete,
} from "../utils";
import { SpecimenCard } from "../components/SpecimenCard";
import { PhotoSlots } from "../components/PhotoSlots";
import { ReturnDialog } from "../components/ReturnDialog";
import { EmptyState } from "../components/ui";

type Tab = "pending" | "approved";

export function ReviewView({
  operator,
  goDetail,
  goShelf,
}: {
  operator: string;
  goDetail: (id: string) => void;
  goShelf: () => void;
}) {
  const { specimens, approveSpecimen, returnSpecimen } = useStore();
  const [tab, setTab] = useState<Tab>("pending");
  const [kw, setKw] = useState("");
  const [locality, setLocality] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [returning, setReturning] = useState<Specimen | null>(null);

  const pending = useMemo(
    () => specimens.filter((s) => s.pressed && !s.identified && !s.shelf && photoComplete(s) && !s.returns.some((r) => !r.resolved)),
    [specimens]
  );
  const approved = useMemo(
    () => specimens.filter((s) => s.identified && !s.shelf),
    [specimens]
  );

  const localities = useMemo(
    () =>
      Array.from(
        new Set(
          [...pending, ...approved]
            .map((s) => s.locality)
            .filter(Boolean)
        )
      ).sort(),
    [pending, approved]
  );

  const list = tab === "pending" ? pending : approved;
  const shown = list.filter((s) => {
    const q = kw.trim().toLowerCase();
    if (
      q &&
      ![s.code, s.species, s.collectors].join(" ").toLowerCase().includes(q)
    )
      return false;
    if (locality && s.locality !== locality) return false;
    return true;
  });

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="kicker">鉴定筛选</p>
          <h2>三类照片齐全后由鉴定人复核</h2>
        </div>
      </div>

      <div className="toolbar">
        <div className="seg">
          <button
            className={tab === "pending" ? "seg-on" : ""}
            onClick={() => setTab("pending")}
          >
            待鉴定 <span className="seg-count">{pending.length}</span>
          </button>
          <button
            className={tab === "approved" ? "seg-on" : ""}
            onClick={() => setTab("approved")}
          >
            鉴定通过 · 待上柜 <span className="seg-count">{approved.length}</span>
          </button>
        </div>
        <div className="filter-tools">
          <select
            value={locality}
            onChange={(e) => setLocality(e.target.value)}
          >
            <option value="">全部采集地点</option>
            {localities.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <input
            className="search"
            placeholder="搜索采集号 / 物种 / 采集人"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
          />
        </div>
      </div>

      {shown.length === 0 ? (
        tab === "pending" ? (
          <EmptyState
            icon="🔬"
            title="暂无可鉴定标本"
            desc="只有三类照片齐全且没有未处理退回意见的标本才会进入这里"
          />
        ) : (
          <EmptyState
            icon="✅"
            title="通过鉴定的标本都已上柜"
            action={
              <button className="primary" onClick={goShelf}>
                查看柜位记录
              </button>
            }
          />
        )
      ) : (
        <div className="stack">
          {shown.map((sp) => {
            const isOpen = expanded.has(sp.id);
            return (
              <SpecimenCard
                key={sp.id}
                sp={sp}
                actions={
                  <>
                    <button onClick={() => goDetail(sp.id)}>详情页</button>
                    <button onClick={() => toggle(sp.id)}>
                      {isOpen ? "收起照片" : "核对三类照片"}
                    </button>
                    {tab === "pending" ? (
                      <>
                        <button
                          className="btn-danger ghost-danger"
                          onClick={() => setReturning(sp)}
                        >
                          物种/采集号有误，退回
                        </button>
                        <button
                          className="primary"
                          disabled={!operator.trim()}
                          title={operator.trim() ? "" : "请先在右上角填写鉴定人"}
                          onClick={() => approveSpecimen(sp.id, operator)}
                        >
                          鉴定通过 → 待上柜
                        </button>
                      </>
                    ) : (
                      <button className="primary" onClick={goShelf}>
                        去分配柜位（{fmtTime(sp.identifiedAt).slice(5)} 通过）
                      </button>
                    )}
                  </>
                }
              >
                {tab === "pending" && <ReviewChecklist sp={sp} />}
                {isOpen && (
                  <div className="inline-photos">
                    <PhotoSlots specimen={sp} editable={false} />
                  </div>
                )}
              </SpecimenCard>
            );
          })}
        </div>
      )}

      {returning && (
        <ReturnDialog
          specimen={returning}
          operator={operator}
          title="鉴定未通过 · 退回修改"
          onConfirm={(reason, by) => {
            returnSpecimen(returning.id, reason, by);
            setReturning(null);
          }}
          onClose={() => setReturning(null)}
        />
      )}
    </section>
  );
}

function ReviewChecklist({ sp }: { sp: Specimen }) {
  const missing = missingCategories(sp);
  return (
    <ul className="checklist">
      <li className={missing.length === 0 ? "ok" : ""}>
        {missing.length === 0
          ? "✓ 整株、标签、生境三类照片齐全"
          : `✗ 仍缺：${missing
              .map((m) =>
                m === "whole" ? "整株" : m === "label" ? "标签" : "生境"
              )
              .join("、")}`}
      </li>
      <li className="ok">✓ 无未处理的退回意见</li>
      <li>照片与采集签信息核对一致后，点「鉴定通过」</li>
    </ul>
  );
}
