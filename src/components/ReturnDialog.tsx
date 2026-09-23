import { useState } from "react";
import type { Specimen } from "../types";
import { Modal } from "./ui";

export function ReturnDialog({
  specimen,
  operator,
  onConfirm,
  onClose,
  title,
  fromIdentified,
}: {
  specimen: Specimen;
  operator: string;
  onConfirm: (reason: string, by: string) => void;
  onClose: () => void;
  title: string;
  fromIdentified?: boolean;
}) {
  const [reason, setReason] = useState("");
  const [by, setBy] = useState(operator);
  const [error, setError] = useState("");

  return (
    <Modal title={title} onClose={onClose}>
      <div className="return-target">
        <b>{specimen.species}</b>
        <span>{specimen.code}</span>
      </div>
      <p className="return-tip">
        退回后标本回到补照队列，已拍照片全部保留，拍摄人按意见修改物种名或采集号。
        {fromIdentified && "原鉴定通过状态将撤销。"}
      </p>
      <label className="field">
        <span>退回原因 / 要修改的内容</span>
        <textarea
          rows={4}
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="如：采集号与野外记录本不符，应为 …；物种名拼写有误…"
        />
      </label>
      <label className="field">
        <span>操作人</span>
        <input value={by} onChange={(e) => setBy(e.target.value)} />
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="modal-actions">
        <button onClick={onClose}>取消</button>
        <button
          className="btn-danger"
          onClick={() => {
            if (!reason.trim()) return setError("请填写退回原因");
            if (!by.trim()) return setError("请填写操作人");
            onConfirm(reason.trim(), by.trim());
          }}
        >
          确认退回
        </button>
      </div>
    </Modal>
  );
}
