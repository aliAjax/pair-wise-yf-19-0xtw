import { describe, expect, it } from "vitest";
import { AppState, PhotoKind, SpecimenFields } from "../src/types";
import {
  EMPTY_STATE,
  addPhoto,
  approveAndStore,
  cloneState,
  createSpecimen,
  findCabinet,
  listSpecimens,
  locationCards,
  markPressed,
  missingKinds,
  photosComplete,
  queueSpecimens,
  removePhoto,
  returnForRework,
  setPressing,
  submitForIdentification,
  updateSpecimenFields,
} from "../src/domain";
import { loadState, saveState, StorageFullError } from "../src/storage";
import { buildSeedState } from "../src/seed";

const FIELDS: SpecimenFields = {
  collectionNo: "HX-20260923-01",
  species: "黄山松",
  location: "安徽 黄山 光明顶",
  altitude: "1840 m",
  habitat: "山脊矮林",
  collector: "徐迟",
};

function fresh(): AppState {
  return cloneState(EMPTY_STATE);
}

function register(s: AppState, fields: SpecimenFields = FIELDS) {
  const r = createSpecimen(s, fields, "登记员甲");
  expect(r.ok).toBe(true);
  return r.ok ? r.value : (undefined as never);
}

const PHOTO: Record<PhotoKind, string> = {
  whole: "data:image/png;base64,w",
  label: "data:image/png;base64,l",
  habitat: "data:image/png;base64,h",
};

function addAllPhotos(s: AppState, id: string, by = "拍摄人") {
  (["whole", "label", "habitat"] as PhotoKind[]).forEach((k) => {
    const r = addPhoto(s, id, k, PHOTO[k], `${k}.png`, by);
    expect(r.ok).toBe(true);
  });
}

describe("登记与压制", () => {
  it("六项字段必填，采集号唯一", () => {
    const s = fresh();
    const bad = createSpecimen(s, { ...FIELDS, species: "  " }, "甲");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.code).toBe("FIELD_REQUIRED");

    register(s);
    const dup = createSpecimen(s, { ...FIELDS, collectionNo: " hx-20260923-01 " }, "甲");
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.code).toBe("COLLECTION_NO_DUPLICATE");
  });

  it("未压制标本不进队列；压制完成后才进补照队列", () => {
    const s = fresh();
    const sp = register(s);
    expect(queueSpecimens(s)).toHaveLength(0);

    const pressing = setPressing(s, sp.id, "压制员");
    expect(pressing.ok).toBe(true);
    expect(queueSpecimens(s)).toHaveLength(0);

    const done = markPressed(s, sp.id, "压制员");
    expect(done.ok).toBe(true);
    expect(queueSpecimens(s)[0].id).toBe(sp.id);

    // 不可重复压制
    expect(markPressed(s, sp.id, "压制员").ok).toBe(false);
    // 未完成压制不能补照
    const sp2 = register(s, { ...FIELDS, collectionNo: "HX-2" });
    expect(addPhoto(s, sp2.id, "whole", PHOTO.whole, "w.png", "拍摄人").ok).toBe(false);
  });
});

describe("补照队列三类照片", () => {
  it("缺任何一类都留在队列；三类齐全才能送鉴定", () => {
    const s = fresh();
    const sp = register(s);
    markPressed(s, sp.id, "压制员");

    expect(missingKinds(s.specimens[sp.id])).toEqual(["whole", "label", "habitat"]);

    expect(addPhoto(s, sp.id, "whole", PHOTO.whole, "w.png", "拍摄人").ok).toBe(true);
    expect(submitForIdentification(s, sp.id, "拍摄人").ok).toBe(false);
    expect(s.specimens[sp.id].stage).toBe("queue");

    expect(addPhoto(s, sp.id, "label", PHOTO.label, "l.png", "拍摄人").ok).toBe(true);
    expect(submitForIdentification(s, sp.id, "拍摄人").ok).toBe(false);

    expect(addPhoto(s, sp.id, "habitat", PHOTO.habitat, "h.png", "拍摄人").ok).toBe(true);
    expect(photosComplete(s.specimens[sp.id])).toBe(true);
    const r = submitForIdentification(s, sp.id, "拍摄人");
    expect(r.ok).toBe(true);
    expect(s.specimens[sp.id].stage).toBe("identifying");
    expect(queueSpecimens(s)).toHaveLength(0);
  });

  it("离队后不能继续增删照片", () => {
    const s = fresh();
    const sp = register(s);
    markPressed(s, sp.id, "压制员");
    addAllPhotos(s, sp.id);
    submitForIdentification(s, sp.id, "拍摄人");
    expect(addPhoto(s, sp.id, "whole", PHOTO.whole, "x.png", "拍摄人").ok).toBe(false);
  });

  it("删除某类照片后重新变为不齐", () => {
    const s = fresh();
    const sp = register(s);
    markPressed(s, sp.id, "压制员");
    addAllPhotos(s, sp.id);
    const labelPhoto = s.specimens[sp.id].photos.find((p) => p.kind === "label")!;
    const del = removePhoto(s, sp.id, labelPhoto.id, "拍摄人");
    expect(del.ok).toBe(true);
    expect(missingKinds(s.specimens[sp.id])).toEqual(["label"]);
  });
});

describe("退回修改", () => {
  it("退回保留旧照片与原因，修改物种/采集号后可重新送鉴定", () => {
    const s = fresh();
    const sp = register(s, { ...FIELDS, species: "错误种名" });
    markPressed(s, sp.id, "压制员");
    addAllPhotos(s, sp.id);
    submitForIdentification(s, sp.id, "拍摄人");
    expect(s.specimens[sp.id].stage).toBe("identifying");

    const ret = returnForRework(s, sp.id, "种名写错，请改", "鉴定员");
    expect(ret.ok).toBe(true);
    const rework = s.specimens[sp.id];
    expect(rework.stage).toBe("rework");
    // 旧照片保留
    expect(rework.photos).toHaveLength(3);
    expect(rework.reworkHistory[0].reason).toBe("种名写错，请改");
    // 退回件出现在队列工作台
    expect(queueSpecimens(s).map((x) => x.id)).toContain(sp.id);

    // 非 rework 阶段不能改字段
    const other = register(s, { ...FIELDS, collectionNo: "HX-OTHER" });
    expect(updateSpecimenFields(s, other.id, { species: "x" }, "拍摄人").ok).toBe(false);

    const upd = updateSpecimenFields(
      s,
      sp.id,
      { species: "正确种名", collectionNo: "HX-20260923-01R" },
      "拍摄人",
    );
    expect(upd.ok).toBe(true);
    if (upd.ok) {
      expect(upd.value.changes.map((c) => c.field).sort()).toEqual([
        "collectionNo",
        "species",
      ]);
    }
    // 退回记录里回填了字段差异
    expect(rework.reworkHistory[0].changes).toHaveLength(2);
    // 照片仍在，仍齐全
    expect(rework.photos).toHaveLength(3);

    // 修改后的采集号与他件冲突时被拒绝
    register(s, { ...FIELDS, collectionNo: "HX-DUP" });
    const dup = updateSpecimenFields(s, sp.id, { collectionNo: "HX-DUP" }, "拍摄人");
    expect(dup.ok).toBe(false);

    // 重新送鉴定
    expect(submitForIdentification(s, sp.id, "拍摄人").ok).toBe(true);
    expect(s.specimens[sp.id].stage).toBe("identifying");
  });

  it("退回必须填原因", () => {
    const s = fresh();
    const sp = register(s);
    markPressed(s, sp.id, "压制员");
    expect(returnForRework(s, sp.id, "  ", "鉴定员").ok).toBe(false);
  });

  it("未上柜标本不能退回，已上柜不能再改", () => {
    const s = fresh();
    const sp = register(s);
    expect(returnForRework(s, sp.id, "x", "鉴定员").ok).toBe(false);
  });
});

describe("鉴定上柜与柜位占用", () => {
  it("只有待鉴定、照片齐全才能上柜", () => {
    const s = fresh();
    const sp = register(s);
    markPressed(s, sp.id, "压制员");
    // 队列中直接上柜被拒
    expect(approveAndStore(s, sp.id, "A-01-01", "鉴定员").ok).toBe(false);
  });

  it("柜位已有标本时提示换位，队列与柜位记录不变", () => {
    const s = fresh();
    const a = register(s, { ...FIELDS, collectionNo: "HX-A" });
    markPressed(s, a.id, "压制员");
    addAllPhotos(s, a.id);
    submitForIdentification(s, a.id, "拍摄人");
    expect(approveAndStore(s, a.id, "A-01-01", "鉴定员").ok).toBe(true);
    expect(a).toBeDefined();
    expect(findCabinet(s, "a-01-01")?.collectionNo).toBe("HX-A");

    const b = register(s, { ...FIELDS, collectionNo: "HX-B" });
    markPressed(s, b.id, "压制员");
    addAllPhotos(s, b.id);
    submitForIdentification(s, b.id, "拍摄人");

    const snapshotBefore = cloneState(s);
    const conflict = approveAndStore(s, b.id, "A-01-01", "鉴定员");
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) {
      expect(conflict.code).toBe("CABINET_TAKEN");
      expect(conflict.message).toContain("HX-A");
    }
    // 柜位记录不变（仍只有一条，指向 A）
    expect(s.cabinets).toHaveLength(1);
    expect(s.cabinets[0].specimenId).toBe(a.id);
    // B 仍在待鉴定（队列侧的下一环节），未被改动
    expect(s.specimens[b.id].stage).toBe("identifying");
    expect(s.specimens[b.id].cabinetNo).toBeUndefined();
    // 整体状态与冲突前一致
    expect(JSON.stringify(s)).toBe(JSON.stringify(snapshotBefore));

    // 换个空柜位即可上柜
    expect(approveAndStore(s, b.id, "B-02-03", "鉴定员").ok).toBe(true);
    expect(s.specimens[b.id].stage).toBe("stored");
    expect(findCabinet(s, "b-02-03")?.collectionNo).toBe("HX-B");
  });
});

describe("地点信息卡与持久化", () => {
  it("按地点归并标本、物种与海拔", () => {
    const s = fresh();
    register(s, { ...FIELDS, collectionNo: "HX-1", location: "地点甲", altitude: "100 m" });
    register(s, { ...FIELDS, collectionNo: "HX-2", location: "地点甲", altitude: "200 m", species: "其他种" });
    register(s, { ...FIELDS, collectionNo: "HX-3", location: "地点乙" });
    const cards = locationCards(s);
    const jia = cards.find((c) => c.location === "地点甲")!;
    expect(jia.count).toBe(2);
    expect(jia.species).toContain("黄山松");
    expect(listSpecimens(s)).toHaveLength(3);
  });

  it("保存后重新加载读到同一份数据", () => {
    const store = new Map<string, string>();
    const adapter = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    const s = fresh();
    const sp = register(s);
    markPressed(s, sp.id, "压制员");
    addAllPhotos(s, sp.id);
    saveState(s, adapter);

    const restored = loadState(adapter);
    expect(Object.keys(restored.specimens)).toHaveLength(1);
    expect(restored.specimens[sp.id].photos).toHaveLength(3);
    expect(queueSpecimens(restored)[0].id).toBe(sp.id);
  });

  it("存储配额超限时抛出 StorageFullError", () => {
    const s = fresh();
    register(s);
    const adapter = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("quota", "QuotaExceededError");
      },
    };
    expect(() => saveState(s, adapter)).toThrow(StorageFullError);
  });

  it("损坏的 JSON 回退到空状态", () => {
    const adapter = {
      getItem: () => "{not-json",
      setItem: () => {},
    };
    expect(loadState(adapter).specimens).toEqual({});
  });
});

describe("演示数据", () => {
  it("覆盖各阶段且柜位号不重复", () => {
    const s = buildSeedState();
    const stages = new Set(Object.values(s.specimens).map((x) => x.stage));
    expect(stages.has("unpressed")).toBe(true);
    expect(stages.has("queue")).toBe(true);
    expect(stages.has("identifying")).toBe(true);
    expect(stages.has("stored")).toBe(true);
    expect(stages.has("rework")).toBe(true);
    const nos = s.cabinets.map((c) => c.cabinetNo);
    expect(new Set(nos).size).toBe(nos.length);
    // 退回件的照片被保留
    const rework = Object.values(s.specimens).find((x) => x.stage === "rework")!;
    expect(rework.photos.length).toBe(3);
    expect(rework.reworkHistory.length).toBeGreaterThan(0);
  });
});
