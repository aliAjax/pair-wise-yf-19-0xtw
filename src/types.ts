// 标本在工作流中的阶段
export type Stage =
  | "unpressed" // 已登记、未完成压制
  | "queue" // 压制完成，补照队列
  | "identifying" // 补照齐全，待鉴定
  | "rework" // 退回修改（仍在补照工作台处理，保留照片）
  | "stored"; // 鉴定通过并已上柜

export type PressStatus = "unpressed" | "pressing" | "pressed";

export type PhotoKind = "whole" | "label" | "habitat";

// 登记时可编辑的六个字段
export interface SpecimenFields {
  collectionNo: string; // 采集号
  species: string; // 物种
  location: string; // 采集地点
  altitude: string; // 海拔
  habitat: string; // 生境
  collector: string; // 采集人
}

export interface Photo {
  id: string;
  kind: PhotoKind;
  dataUrl: string;
  name: string;
  addedAt: string;
  by: string;
}

export interface FieldChange {
  field: keyof SpecimenFields;
  from: string;
  to: string;
}

export interface ReworkRecord {
  id: string;
  at: string;
  by: string;
  reason: string;
  fromStage: Stage;
  changes: FieldChange[];
}

export interface SpecEvent {
  id: string;
  at: string;
  by: string;
  type: string;
  detail: string;
}

export interface Specimen extends SpecimenFields {
  id: string;
  pressStatus: PressStatus;
  stage: Stage;
  photos: Photo[];
  reworkHistory: ReworkRecord[];
  events: SpecEvent[];
  cabinetNo?: string;
  storedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CabinetAssignment {
  cabinetNo: string;
  specimenId: string;
  collectionNo: string;
  species: string;
  storedAt: string;
  by: string;
}

export interface AppState {
  version: 1;
  seq: number;
  currentUser: string;
  specimens: Record<string, Specimen>;
  cabinets: CabinetAssignment[];
}

export type Result<T = undefined> =
  | { ok: true; value: T }
  | { ok: false; code: string; message: string };
