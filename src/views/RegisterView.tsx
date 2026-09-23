import { useState } from "react";
import { useStore } from "../store";
import { fmtTime } from "../utils";
import { SpecimenForm } from "../components/SpecimenForm";
import { SpecimenCard } from "../components/SpecimenCard";
import { EmptyState } from "../components/ui";

export function RegisterView({
  operator,
  goDetail,
}: {
  operator: string;
  goDetail: (id: string) => void;
}) {
  const { specimens, createSpecimen, markPressed } = useStore();
  const [flash, setFlash] = useState("");

  const pressing = specimens.filter((s) => !s.pressed && !s.shelf);
  const [resetKey, setResetKey] = useState(0);

  return (
    <div className="view-grid">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="kicker">标本登记</p>
            <h2>新压制标本登记</h2>
          </div>
          <p className="panel-note">
            勾选「压制已完成」后直接进入补照队列；未压制标本留在本页跟踪。
          </p>
        </div>
        <SpecimenForm
          operator={operator}
          submitLabel="登记并保存"
          cancelLabel="清空表单"
          key={resetKey}
          onDone={async (draft, by) => {
            const sp = await createSpecimen(draft, by);
            setFlash(
              draft.pressed
                ? `${sp.code} 已进入补照队列`
                : `${sp.code} 已登记，等待压制完成`
            );
            setResetKey((k) => k + 1);
            setTimeout(() => setFlash(""), 4000);
          }}
          onCancel={() => setResetKey((k) => k + 1)}
        />
        {flash && <div className="inline-flash">✓ {flash}</div>}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="kicker">压制跟踪</p>
            <h2>压制中（{pressing.length}）</h2>
          </div>
        </div>
        {pressing.length === 0 ? (
          <EmptyState
            title="暂无压制中标本"
            desc="登记时不勾选「压制已完成」的标本会出现在这里"
          />
        ) : (
          <div className="stack">
            {pressing.map((sp) => (
              <SpecimenCard
                key={sp.id}
                sp={sp}
                actions={
                  <>
                    <button onClick={() => goDetail(sp.id)}>详情</button>
                    <button
                      className="primary"
                      disabled={!operator.trim()}
                      title={
                        operator.trim() ? "" : "请先在右上角填写操作人"
                      }
                      onClick={() => markPressed(sp.id, operator)}
                    >
                      标记压制完成 → 入补照队列
                    </button>
                  </>
                }
              >
                <p className="sub-line">登记时间：{fmtTime(sp.createdAt)}</p>
              </SpecimenCard>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
