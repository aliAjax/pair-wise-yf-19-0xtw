import { useMemo, useState } from "react";
import { useStore } from "../store";
import type { QueueState, Specimen } from "../types";
import {
  fmtTime,
  missingCategories,
  photoComplete,
  queueStateOf,
} from "../utils";
import { SpecimenCard } from "../components/SpecimenCard";
import { PhotoSlots } from "../components/PhotoSlots";
import { ReturnDialog } from "../components/ReturnDialog";
import { SpecimenForm, draftFromSpecimen } from "../components/SpecimenForm";
import { EmptyState, Modal } from "../components/ui";

type Filter = "all" | QueueState;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "incomplete", label: "缺照" },
  { key: "returned", label: "退回待改" },
  { key: "ready", label: "待鉴定" },
];

export function QueueView({
  operator,
  goDetail,
}: {
  operator: string;
  goDetail: (id: string) => void;
}) {
  const { specimens, editSpecimen, returnSpecimen } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [kw, setKw] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Specimen | null>(null);
  const [returning, setReturning] = useState<Specimen | null>(null);

  const queue = useMemo(
    () => specimens.filter((s) => s.pressed && !s.identified && !s.shelf),
    [specimens]
  );

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: queue.length,
      incomplete: 0,
      returned: 0,
      ready: 0,
    };
    queue.forEach((s) => {
      c[queueStateOf(s)] += 1;
    });
    return c;
  }, [queue]);

  const shown = useMemo(() => {
    const q = kw.trim().toLowerCase();
    return queue.filter((s) => {
      if (filter !== "all" && queueStateOf(s) !== filter) return false;
      if (
        q &&
        ![s.code, s.species, s.locality, s.collectors]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [queue, filter, kw]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="panel queue-panel">
      <div className="panel-head">
        <div>
          <p className="kicker">补照队列</p>
          <h2>压制完成 · 等待补照与鉴定</h2>
        </div>
        <p className="panel-note">
          每份标本需留齐 <b>整株 · 标签 · 生境</b> 三类照片；缺一类即留在队列，
          鉴定通过后才能上柜。
        </p>
      </div>

      <div className="toolbar">
        <div className="seg">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={filter === f.key ? "seg-on" : ""}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="seg-count">{counts[f.key]}</span>
            </button>
          ))}
        </div>
        <input
          className="search"
          placeholder="搜索采集号 / 物种 / 地点 / 采集人"
          value={kw}
          onChange={(e) => setKw(e.target.value)}
        />
      </div>

      {queue.length === 0 ? (
        <EmptyState
          icon="📭"
          title="补照队列已清空"
          desc="所有压制好的标本都已鉴定通过，去鉴定页分配柜位吧"
        />
      ) : shown.length === 0 ? (
        <EmptyState icon="🔍" title="没有符合筛选条件的标本" />
      ) : (
        <div className="stack">
          {shown.map((sp) => {
            const complete = photoComplete(sp);
            const isOpen = expanded.has(sp.id);
            return (
              <SpecimenCard
                key={sp.id}
                sp={sp}
                actions={
                  <>
                    <button onClick={() => goDetail(sp.id)}>详情页</button>
                    <button onClick={() => setEditing(sp)}>
                      修改物种/采集号
                    </button>
                    <button
                      className="btn-danger ghost-danger"
                      onClick={() => setReturning(sp)}
                    >
                      退回修改
                    </button>
                    <button
                      className="primary"
                      onClick={() => toggle(sp.id)}
                    >
                      {isOpen ? "收起照片区" : complete ? "查看照片（已齐）" : "补拍照片"}
                    </button>
                  </>
                }
              >
                <PhotoStrip sp={sp} />
                {isOpen && (
                  <div className="inline-photos">
                    <PhotoSlots specimen={sp} editable />
                  </div>
                )}
              </SpecimenCard>
            );
          })}
        </div>
      )}

      {editing && (
        <Modal
          title={`修改信息 · ${editing.code}`}
          onClose={() => setEditing(null)}
          wide
        >
          <ReturnedHint sp={editing} />
          <SpecimenForm
            specimen={editing}
            initial={draftFromSpecimen(editing)}
            operator={operator}
            submitLabel="保存修改"
            cancelLabel="放弃"
            onDone={(draft, by) => {
              editSpecimen(editing.id, draft, by);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}

      {returning && (
        <ReturnDialog
          specimen={returning}
          operator={operator}
          title="退回拍摄人修改"
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

function PhotoStrip({ sp }: { sp: Specimen }) {
  const missing = missingCategories(sp);
  return (
    <div className="photo-strip">
      {(["whole", "label", "habitat"] as const).map((cat) => {
        const label = cat === "whole" ? "整株" : cat === "label" ? "标签" : "生境";
        const has = sp.photos.some((p) => p.category === cat);
        return (
          <span key={cat} className={`strip-chip ${has ? "have" : "lack"}`}>
            {has ? "✓" : "✗"} {label}
            {!has && <i>缺</i>}
          </span>
        );
      })}
      <span className="strip-time">
        {sp.photos.length > 0
          ? `最近更新 ${fmtTime(
              Math.max(...sp.photos.map((p) => p.at))
            )}`
          : "尚无照片"}
      </span>
    </div>
  );
}

function ReturnedHint({ sp }: { sp: Specimen }) {
  const open = sp.returns.find((r) => !r.resolved);
  if (!open) return null;
  return (
    <div className="edit-return-hint">
      <p>
        <b>待处理的退回意见（{open.by} · {fmtTime(open.at)}）：</b>
      </p>
      <p>{open.reason}</p>
      <p className="muted">保存修改后此意见标记为已处理，旧照片与退回记录均保留。</p>
    </div>
  );
}
