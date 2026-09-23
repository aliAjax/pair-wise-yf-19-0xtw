import { useState } from "react";
import { approveAndStore, findCabinet } from "../domain";
import { getState, mutate, useUser } from "../store";
import { toastResult } from "../toast";
import { useNavigate } from "../router";
import { Modal } from "../components";

/**
 * 鉴定通过并上柜：
 * - 柜位已被占用时即时提示换位，确认按钮禁用；
 * - 提交若仍冲突（领域层最终校验），柜位与队列记录都不变。
 */
export default function StoreDialog({
  specimenId,
  onClose,
}: {
  specimenId: string;
  onClose: () => void;
}) {
  const user = useUser();
  const navigate = useNavigate();
  const [cabinet, setCabinet] = useState("");
  const [conflict, setConflict] = useState<
    null | { cabinetNo: string; collectionNo: string; species: string }
  >(null);

  function check(v: string) {
    setCabinet(v);
    if (v.trim()) {
      const taken = findCabinet(getState(), v);
      setConflict(
        taken
          ? {
              cabinetNo: taken.cabinetNo,
              collectionNo: taken.collectionNo,
              species: taken.species,
            }
          : null,
      );
    } else {
      setConflict(null);
    }
  }

  function confirm() {
    const res = mutate((d) => approveAndStore(d, specimenId, cabinet, user));
    if (res.ok) {
      toastResult(res, `鉴定通过，已上柜 ${cabinet.trim().toUpperCase()}`);
      onClose();
      navigate("/cabinets");
    } else {
      toastResult(res, "");
      if (res.code === "CABINET_TAKEN") {
        const taken = findCabinet(getState(), cabinet);
        if (taken)
          setConflict({
            cabinetNo: taken.cabinetNo,
            collectionNo: taken.collectionNo,
            species: taken.species,
          });
      }
    }
  }

  return (
    <Modal title="鉴定通过 · 指定柜位" onClose={onClose}>
      <p className="muted">
        三类照片齐全才能鉴定上柜。若柜位已有标本，会提示换位：原补照队列与柜位记录都不会改动。
      </p>
      <label className="field">
        <span className="field-label">
          柜位号<em>*</em>
        </span>
        <input
          autoFocus
          value={cabinet}
          placeholder="如 A-03-02"
          onChange={(e) => check(e.target.value)}
        />
      </label>
      {conflict && (
        <div className="conflict-box">
          ⚠ 柜位 <b>{conflict.cabinetNo}</b> 已有标本{" "}
          <b>{conflict.collectionNo}</b>（{conflict.species}），请换一个柜位。
        </div>
      )}
      <div className="modal-actions">
        <button
          className="primary"
          disabled={!cabinet.trim() || !!conflict}
          onClick={confirm}
        >
          鉴定通过并上柜
        </button>
        <button className="ghost" onClick={onClose}>
          取消
        </button>
      </div>
    </Modal>
  );
}
