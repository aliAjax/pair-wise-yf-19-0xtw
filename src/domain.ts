import {
  AppState,
  FieldChange,
  Photo,
  PhotoKind,
  PressStatus,
  Result,
  Specimen,
  SpecimenFields,
  Stage,
} from "./types";

export const FIELD_LABELS: Record<keyof SpecimenFields, string> = {
  collectionNo: "采集号",
  species: "物种",
  location: "采集地点",
  altitude: "海拔",
  habitat: "生境",
  collector: "采集人",
};

export const PHOTO_KINDS: { key: PhotoKind; label: string; hint: string }[] = [
  { key: "whole", label: "整株", hint: "整株压制标本全貌" },
  { key: "label", label: "标签", hint: "采集标签 / 鉴定标签字迹" },
  { key: "habitat", label: "生境", hint: "野外生境 / 植株生态照" },
];

export const STAGE_LABELS: Record<Stage, string> = {
  unpressed: "待压制",
  queue: "补照队列",
  identifying: "待鉴定",
  rework: "退回修改",
  stored: "已上柜",
};

export const PRESS_LABELS: Record<PressStatus, string> = {
  unpressed: "未压制",
  pressing: "压制中",
  pressed: "压制完成",
};

export const REQUIRED_PHOTO_KINDS: PhotoKind[] = ["whole", "label", "habitat"];

export const EMPTY_STATE: AppState = {
  version: 1,
  seq: 0,
  currentUser: "林砚",
  specimens: {},
  cabinets: [],
};

export const PHOTO_CHECK: { kind: PhotoKind; label: string; ok: boolean }[] =
  PHOTO_KINDS.map(({ key, label }) => ({ kind: key, label, ok: false }));

function fail(
  code: string,
  message: string,
): { ok: false; code: string; message: string } {
  return { ok: false, code, message };
}

function now(): string {
  return new Date().toISOString();
}

export function makeId(prefix: string, seq: number): string {
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}`;
}

function nextId(state: AppState, prefix: string): string {
  state.seq += 1;
  return makeId(prefix, state.seq);
}

// ---- 纯函数查询 ----

export function listSpecimens(state: AppState): Specimen[] {
  return Object.values(state.specimens).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
}

export function getSpecimen(
  state: AppState,
  id: string,
): Specimen | undefined {
  return state.specimens[id];
}

/** 已登记（含未压制）标本：补照队列只收压制完成件，退回件也留在队列工作台 */
export function queueSpecimens(state: AppState): Specimen[] {
  return listSpecimens(state).filter(
    (s) => s.stage === "queue" || s.stage === "rework",
  );
}

export function identifyingSpecimens(state: AppState): Specimen[] {
  return listSpecimens(state).filter((s) => s.stage === "identifying");
}

export function storedSpecimens(state: AppState): Specimen[] {
  return listSpecimens(state).filter((s) => s.stage === "stored");
}

export function photoStatus(
  s: Pick<Specimen, "photos">,
): { kind: PhotoKind; label: string; ok: boolean }[] {
  return PHOTO_KINDS.map(({ key, label }) => ({
    kind: key,
    label,
    ok: s.photos.some((p) => p.kind === key),
  }));
}

export function missingKinds(s: Specimen): PhotoKind[] {
  return photoStatus(s)
    .filter((p) => !p.ok)
    .map((p) => p.kind);
}

export function photosComplete(s: Pick<Specimen, "photos">): boolean {
  return REQUIRED_PHOTO_KINDS.every((k) =>
    s.photos.some((p) => p.kind === k),
  );
}

export function findCabinet(
  state: AppState,
  cabinetNo: string,
): ReturnType<typeof state.cabinets.find> {
  const no = cabinetNo.trim().toUpperCase();
  return state.cabinets.find((c) => c.cabinetNo.toUpperCase() === no);
}

export interface LocationCard {
  location: string;
  count: number;
  species: string[];
  specimens: Specimen[];
}

export function locationCards(state: AppState): LocationCard[] {
  const map = new Map<string, Specimen[]>();
  for (const s of listSpecimens(state)) {
    const loc = s.location.trim();
    if (!loc) continue;
    const arr = map.get(loc) ?? [];
    arr.push(s);
    map.set(loc, arr);
  }
  return [...map.entries()]
    .map(([location, specimens]) => ({
      location,
      count: specimens.length,
      species: [...new Set(specimens.map((s) => s.species.trim()).filter(Boolean))],
      specimens,
    }))
    .sort((a, b) => b.count - a.count || a.location.localeCompare(b.location, "zh"));
}

// ---- 登记 ----

export function validateFields(f: Partial<SpecimenFields>): Result {
  for (const key of Object.keys(FIELD_LABELS) as (keyof SpecimenFields)[]) {
    if (!(f[key] ?? "").toString().trim()) {
      return fail("FIELD_REQUIRED", `请填写${FIELD_LABELS[key]}`);
    }
  }
  return { ok: true, value: undefined };
}

/** 采集号在全工作流（含退回、已上柜）中必须唯一；排除自身 */
export function collectionNoTaken(
  state: AppState,
  no: string,
  excludeId?: string,
): Specimen | undefined {
  const v = no.trim().toUpperCase();
  return listSpecimens(state).find(
    (s) =>
      s.id !== excludeId && s.collectionNo.trim().toUpperCase() === v,
  );
}

export function createSpecimen(
  state: AppState,
  fields: SpecimenFields,
  by: string,
): Result<Specimen> {
  const v = validateFields(fields);
  if (!v.ok) return v;
  if (collectionNoTaken(state, fields.collectionNo)) {
    return fail(
      "COLLECTION_NO_DUPLICATE",
      `采集号「${fields.collectionNo.trim()}」已登记过`,
    );
  }
  const id = nextId(state, "sp");
  const at = now();
  const specimen: Specimen = {
    id,
    ...normalize(fields),
    pressStatus: "unpressed",
    stage: "unpressed",
    photos: [],
    reworkHistory: [],
    events: [
      { id: nextId(state, "ev"), at, by, type: "登记", detail: "标本登记入册" },
    ],
    createdAt: at,
    updatedAt: at,
  };
  state.specimens[id] = specimen;
  return { ok: true, value: specimen };
}

function normalize(f: SpecimenFields): SpecimenFields {
  return {
    collectionNo: f.collectionNo.trim(),
    species: f.species.trim(),
    location: f.location.trim(),
    altitude: f.altitude.trim(),
    habitat: f.habitat.trim(),
    collector: f.collector.trim(),
  };
}

// ---- 压制 ----

/** 未压制 → 压制中 */
export function setPressing(
  state: AppState,
  id: string,
  by: string,
): Result<Specimen> {
  const s = state.specimens[id];
  if (!s) return fail("NOT_FOUND", "标本不存在");
  if (s.pressStatus !== "unpressed") {
    return fail("WRONG_PRESS", "只有未压制的标本可以开始压制");
  }
  const at = now();
  s.pressStatus = "pressing";
  s.updatedAt = at;
  s.events.push({
    id: nextId(state, "ev"),
    at,
    by,
    type: "开始压制",
    detail: "标本进入压制流程",
  });
  return { ok: true, value: s };
}

/** 压制完成才能进入补照队列；状态不可回退 */
export function markPressed(
  state: AppState,
  id: string,
  by: string,
): Result<Specimen> {
  const s = state.specimens[id];
  if (!s) return fail("NOT_FOUND", "标本不存在");
  if (s.pressStatus === "pressed") {
    return fail("ALREADY_PRESSED", "该标本压制已完成");
  }
  const at = now();
  s.pressStatus = "pressed";
  s.stage = "queue";
  s.updatedAt = at;
  s.events.push({
    id: nextId(state, "ev"),
    at,
    by,
    type: "压制完成",
    detail: "压制完成，进入补照队列",
  });
  return { ok: true, value: s };
}

// ---- 补照 ----

export function addPhoto(
  state: AppState,
  id: string,
  kind: PhotoKind,
  dataUrl: string,
  name: string,
  by: string,
): Result<Photo> {
  const s = state.specimens[id];
  if (!s) return fail("NOT_FOUND", "标本不存在");
  if (s.stage !== "queue" && s.stage !== "rework") {
    return fail("NOT_IN_QUEUE", "该标本当前不在补照队列，不能补拍照片");
  }
  const at = now();
  const photo: Photo = {
    id: nextId(state, "ph"),
    kind,
    dataUrl,
    name,
    addedAt: at,
    by,
  };
  s.photos.push(photo);
  s.updatedAt = at;
  s.events.push({
    id: nextId(state, "ev"),
    at,
    by,
    type: "补照",
    detail: `上传${PHOTO_KINDS.find((k) => k.key === kind)!.label}照（${name}）`,
  });
  return { ok: true, value: photo };
}

export function removePhoto(
  state: AppState,
  specimenId: string,
  photoId: string,
  by: string,
): Result {
  const s = state.specimens[specimenId];
  if (!s) return fail("NOT_FOUND", "标本不存在");
  if (s.stage !== "queue" && s.stage !== "rework") {
    return fail("NOT_IN_QUEUE", "离开补照队列后不能删除照片");
  }
  const idx = s.photos.findIndex((p) => p.id === photoId);
  if (idx < 0) return fail("PHOTO_NOT_FOUND", "照片不存在");
  const [photo] = s.photos.splice(idx, 1);
  const at = now();
  s.updatedAt = at;
  s.events.push({
    id: nextId(state, "ev"),
    at,
    by,
    type: "删照",
    detail: `删除${PHOTO_KINDS.find((k) => k.key === photo.kind)!.label}照（${photo.name}）`,
  });
  return { ok: true, value: undefined };
}

/** 三类照片缺一不可，缺类留在队列 */
export function submitForIdentification(
  state: AppState,
  id: string,
  by: string,
): Result<Specimen> {
  const s = state.specimens[id];
  if (!s) return fail("NOT_FOUND", "标本不存在");
  if (s.stage !== "queue" && s.stage !== "rework") {
    return fail("NOT_IN_QUEUE", "该标本不在补照队列");
  }
  const missing = missingKinds(s);
  if (missing.length) {
    const names = missing
      .map((k) => PHOTO_KINDS.find((p) => p.key === k)!.label)
      .join("、");
    return fail("PHOTO_INCOMPLETE", `缺少${names}类照片，暂留补照队列`);
  }
  const wasRework = s.stage === "rework";
  const at = now();
  s.stage = "identifying";
  s.updatedAt = at;
  s.events.push({
    id: nextId(state, "ev"),
    at,
    by,
    type: "送鉴定",
    detail: wasRework
      ? "修改完成，照片齐全，重新提交鉴定"
      : "三类照片齐全，提交鉴定",
  });
  return { ok: true, value: s };
}

// ---- 退回修改（保留旧照片与退回原因） ----

export function returnForRework(
  state: AppState,
  id: string,
  reason: string,
  by: string,
): Result {
  const s = state.specimens[id];
  if (!s) return fail("NOT_FOUND", "标本不存在");
  if (s.stage !== "queue" && s.stage !== "identifying" && s.stage !== "rework") {
    return fail("WRONG_STAGE", "当前阶段不能退回");
  }
  const r = reason.trim();
  if (!r) return fail("REASON_REQUIRED", "请填写退回原因");
  const at = now();
  const fromStage = s.stage;
  s.stage = "rework";
  s.updatedAt = at;
  s.reworkHistory.push({
    id: nextId(state, "rw"),
    at,
    by,
    reason: r,
    fromStage,
    changes: [], // 待修改提交时回填
  });
  s.events.push({
    id: nextId(state, "ev"),
    at,
    by,
    type: "退回",
    detail: `退回补照工作台：${r}（原有 ${s.photos.length} 张照片保留）`,
  });
  return { ok: true, value: undefined };
}

/** 退回件修改登记字段；采集号仍受唯一约束，记录字段差异 */
export function updateSpecimenFields(
  state: AppState,
  id: string,
  patch: Partial<SpecimenFields>,
  by: string,
): Result<{ changes: FieldChange[] }> {
  const s = state.specimens[id];
  if (!s) return fail("NOT_FOUND", "标本不存在");
  if (s.stage !== "rework") {
    return fail("NOT_REWORK", "只有退回修改的标本可以在此改写字段");
  }
  if (
    patch.collectionNo !== undefined &&
    collectionNoTaken(state, patch.collectionNo, id)
  ) {
    return fail(
      "COLLECTION_NO_DUPLICATE",
      `采集号「${patch.collectionNo.trim()}」已登记过`,
    );
  }
  const changes: FieldChange[] = [];
  for (const key of Object.keys(FIELD_LABELS) as (keyof SpecimenFields)[]) {
    if (patch[key] === undefined) continue;
    const to = patch[key].trim();
    if (!to) return fail("FIELD_REQUIRED", `请填写${FIELD_LABELS[key]}`);
    if (to !== s[key]) {
      changes.push({ field: key, from: s[key], to });
      s[key] = to;
    }
  }
  if (changes.length) {
    const at = now();
    s.updatedAt = at;
    const latest = s.reworkHistory[s.reworkHistory.length - 1];
    if (latest && latest.changes.length === 0) latest.changes = changes;
    s.events.push({
      id: nextId(state, "ev"),
      at,
      by,
      type: "改字段",
      detail: changes
        .map((c) => `${FIELD_LABELS[c.field]}：${c.from} → ${c.to}`)
        .join("；"),
    });
  }
  return { ok: true, value: { changes } };
}

// ---- 鉴定上柜 ----

/** 鉴定通过才能上柜；柜位已有标本则提示换位，队列与柜位记录均不变 */
export function approveAndStore(
  state: AppState,
  id: string,
  cabinetNo: string,
  by: string,
): Result {
  const s = state.specimens[id];
  if (!s) return fail("NOT_FOUND", "标本不存在");
  if (s.stage !== "identifying") {
    return fail("WRONG_STAGE", "只有待鉴定的标本可以鉴定通过");
  }
  if (!photosComplete(s)) {
    return fail("PHOTO_INCOMPLETE", "三类照片不齐全，不能鉴定通过");
  }
  const no = cabinetNo.trim().toUpperCase();
  if (!no) return fail("CABINET_REQUIRED", "请填写柜位号");
  const taken = findCabinet(state, no);
  if (taken) {
    return fail(
      "CABINET_TAKEN",
      `柜位 ${no} 已有标本 ${taken.collectionNo}（${taken.species}），请换柜位`,
    );
  }
  const at = now();
  s.stage = "stored";
  s.cabinetNo = no;
  s.storedAt = at;
  s.updatedAt = at;
  state.cabinets.push({
    cabinetNo: no,
    specimenId: s.id,
    collectionNo: s.collectionNo,
    species: s.species,
    storedAt: at,
    by,
  });
  s.events.push({
    id: nextId(state, "ev"),
    at,
    by,
    type: "鉴定通过",
    detail: `鉴定通过，上柜 ${no}`,
  });
  return { ok: true, value: undefined };
}

export function setCurrentUser(state: AppState, name: string): Result {
  const v = name.trim();
  if (!v) return fail("USER_REQUIRED", "请填写当前工作人员姓名");
  state.currentUser = v;
  return { ok: true, value: undefined };
}

/** 深拷贝，供持久化加载与撤销边界使用 */
export function cloneState(state: AppState): AppState {
  return structuredClone(state);
}
