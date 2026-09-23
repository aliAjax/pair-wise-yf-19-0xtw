export type PhotoCategory = "whole" | "label" | "habitat";

export interface Photo {
  id: string;
  category: PhotoCategory;
  blob: Blob;
  name: string;
  at: number;
  by: string;
}

export interface ReturnNote {
  id: string;
  at: number;
  by: string;
  reason: string;
  resolved: boolean;
  resolvedAt?: number;
  resolvedBy?: string;
}

export interface HistoryEvent {
  id: string;
  at: number;
  by: string;
  text: string;
}

export interface Shelf {
  /** 完整柜位编号，如 A-12-03 */
  code: string;
  /** 柜号，如 A */
  cabinet: string;
  /** 层位，如 12-03 */
  position: string;
  at: number;
  by: string;
}

export interface Specimen {
  id: string;
  /** 采集号 */
  code: string;
  /** 物种名称 */
  species: string;
  /** 采集地点 */
  locality: string;
  /** 海拔 */
  altitude: string;
  /** 生境描述 */
  habitat: string;
  /** 采集人 */
  collectors: string;
  /** 压制状态 */
  pressed: boolean;
  pressedAt?: number;
  pressedBy?: string;
  /** 鉴定状态 */
  identified: boolean;
  identifiedAt?: number;
  identifiedBy?: string;
  photos: Photo[];
  returns: ReturnNote[];
  history: HistoryEvent[];
  shelf?: Shelf;
  createdAt: number;
  updatedAt: number;
}

export type Stage = "pressing" | "queue" | "approved" | "shelved";

/** 队列内的细分状态 */
export type QueueState = "returned" | "incomplete" | "ready";

export interface SpecimenDraft {
  code: string;
  species: string;
  locality: string;
  altitude: string;
  habitat: string;
  collectors: string;
  pressed: boolean;
}
