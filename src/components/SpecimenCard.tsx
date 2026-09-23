import type { ReactNode } from "react";
import type { Specimen } from "../types";
import {
  QUEUE_STATE_META,
  STAGE_META,
  missingCategories,
  openReturn,
  queueStateOf,
  stageOf,
} from "../utils";
import { Badge } from "./ui";

export function SpecimenCard({
  sp,
  actions,
  children,
}: {
  sp: Specimen;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const stage = stageOf(sp);
  const stageMeta = STAGE_META[stage];
  const missing = missingCategories(sp);
  const ret = openReturn(sp);

  return (
    <article className={`sp-card sp-stage-${stage}`}>
      <header className="sp-card-head">
        <div className="sp-card-titles">
          <h3>{sp.species}</h3>
          <a className="sp-code" href={`#/specimen/${sp.id}`}>
            {sp.code}
          </a>
        </div>
        <div className="sp-badges">
          {stage === "queue" && (
            <Badge tone={QUEUE_STATE_META[queueStateOf(sp)].tone}>
              {QUEUE_STATE_META[queueStateOf(sp)].label}
            </Badge>
          )}
          <Badge tone={stageMeta.tone}>{stageMeta.label}</Badge>
          {sp.shelf && <Badge tone="ink">柜位 {sp.shelf.code}</Badge>}
        </div>
      </header>

      <dl className="sp-meta">
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
          <dd className="clamp">{sp.habitat || "—"}</dd>
        </div>
        <div>
          <dt>采集人</dt>
          <dd>{sp.collectors}</dd>
        </div>
      </dl>

      {missing.length > 0 && stage !== "pressing" && (
        <p className="sp-missing">
          缺照：
          {missing
            .map((m) => (m === "whole" ? "整株" : m === "label" ? "标签" : "生境"))
            .join("、")}
        </p>
      )}
      {ret && (
        <div className="sp-return-banner">
          <b>退回原因（{ret.by}）：</b>
          {ret.reason}
        </div>
      )}

      {children}

      {actions && <footer className="sp-actions">{actions}</footer>}
    </article>
  );
}
