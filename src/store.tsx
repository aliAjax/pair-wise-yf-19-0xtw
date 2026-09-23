import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as db from "./db";
import { buildSeed } from "./seed";
import type {
  HistoryEvent,
  Photo,
  PhotoCategory,
  ReturnNote,
  Shelf,
  Specimen,
  SpecimenDraft,
} from "./types";
import { fileToPhoto, stageOf, uid } from "./utils";

const OPERATOR_KEY = "herbarium-operator";

interface AssignResult {
  ok: boolean;
  conflict?: Specimen;
}

interface StoreValue {
  ready: boolean;
  specimens: Specimen[];
  operator: string;
  setOperator: (name: string) => void;
  loadSeed: () => Promise<void>;
  createSpecimen: (draft: SpecimenDraft, by: string) => Promise<Specimen>;
  editSpecimen: (
    id: string,
    patch: Partial<SpecimenDraft>,
    by: string
  ) => void;
  markPressed: (id: string, by: string) => void;
  returnSpecimen: (id: string, reason: string, by: string) => void;
  approveSpecimen: (id: string, by: string) => void;
  addPhoto: (id: string, category: PhotoCategory, file: File, by: string) => Promise<void>;
  removePhoto: (id: string, photoId: string, by: string) => void;
  assignShelf: (id: string, code: string, by: string) => Promise<AssignResult>;
  findByCode: (code: string, exceptId?: string) => Specimen | undefined;
}

const StoreContext = createContext<StoreValue | null>(null);

function persist(specimen: Specimen) {
  specimen.updatedAt = Date.now();
  return db.put(specimen);
}

function hist(sp: Specimen, by: string, text: string) {
  const e: HistoryEvent = { id: uid("h"), at: Date.now(), by, text };
  sp.history.push(e);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [specimens, setSpecimens] = useState<Specimen[]>([]);
  const [operator, setOperatorState] = useState(
    () => localStorage.getItem(OPERATOR_KEY) ?? ""
  );

  const refresh = useCallback(async () => {
    const list = await db.getAll();
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    setSpecimens(list);
  }, []);

  useEffect(() => {
    (async () => {
      if (await db.isEmpty()) {
        await db.bulkPut(await buildSeed());
      }
      await refresh();
      setReady(true);
      // 测试钩子：关闭连接并清空数据库后重载（种子 ID 固定，重复播种也不会追加副本）
      (window as unknown as { __herbariumReset?: () => Promise<void> }).__herbariumReset =
        async () => {
          await db.closeDB();
          await new Promise<void>((resolve, reject) => {
            const dr = indexedDB.deleteDatabase("herbarium-workbench");
            dr.onsuccess = () => resolve();
            dr.onerror = () => reject(dr.error);
            dr.onblocked = () => reject(new Error("delete blocked"));
          });
          window.location.hash = "#/queue";
          window.location.reload();
        };
    })();
  }, [refresh]);

  const setOperator = useCallback((name: string) => {
    const v = name.trim();
    setOperatorState(v);
    localStorage.setItem(OPERATOR_KEY, v);
  }, []);

  const loadSeed = useCallback(async () => {
    await db.bulkPut(await buildSeed());
    await refresh();
  }, [refresh]);

  const findByCode = useCallback(
    (code: string, exceptId?: string) =>
      specimens.find(
        (s) => s.id !== exceptId && s.code.trim() === code.trim()
      ),
    [specimens]
  );

  const createSpecimen = useCallback(
    async (draft: SpecimenDraft, by: string) => {
      const ts = Date.now();
      const sp: Specimen = {
        id: uid("sp"),
        code: draft.code.trim(),
        species: draft.species.trim(),
        locality: draft.locality.trim(),
        altitude: draft.altitude.trim(),
        habitat: draft.habitat.trim(),
        collectors: draft.collectors.trim(),
        pressed: draft.pressed,
        pressedAt: draft.pressed ? ts : undefined,
        pressedBy: draft.pressed ? by : undefined,
        identified: false,
        photos: [],
        returns: [],
        history: [
          { id: uid("h"), at: ts, by, text: "登记标本记录" },
        ],
        createdAt: ts,
        updatedAt: ts,
      };
      if (draft.pressed) {
        hist(sp, by, "压制完成，进入补照队列");
      }
      await db.put(sp);
      await refresh();
      return sp;
    },
    [refresh]
  );

  const editSpecimen = useCallback(
    (id: string, patch: Partial<SpecimenDraft>, by: string) => {
      const sp = specimens.find((s) => s.id === id);
      if (!sp) return;
      const changes: string[] = [];
      const fields: [keyof SpecimenDraft, string][] = [
        ["code", "采集号"],
        ["species", "物种"],
        ["locality", "采集地点"],
        ["altitude", "海拔"],
        ["habitat", "生境"],
        ["collectors", "采集人"],
      ];
      for (const [key, label] of fields) {
        if (key in patch) {
          const v = (patch[key] ?? "").toString().trim();
          if (v !== sp[key]) {
            changes.push(`${label}：${sp[key] || "（空）"} → ${v || "（空）"}`);
            (sp as unknown as Record<string, string>)[key] = v;
          }
        }
      }
      const open = sp.returns.find((r) => !r.resolved);
      if (open) {
        open.resolved = true;
        open.resolvedAt = Date.now();
        open.resolvedBy = by;
        hist(
          sp,
          by,
          `按退回意见完成修改${
            changes.length ? `（${changes.join("；")}）` : ""
          }，旧照片保留`
        );
      } else if (changes.length) {
        hist(sp, by, `修改信息：${changes.join("；")}`);
      }
      void persist(sp).then(refresh);
    },
    [specimens, refresh]
  );

  const markPressed = useCallback(
    (id: string, by: string) => {
      const sp = specimens.find((s) => s.id === id);
      if (!sp || sp.pressed) return;
      sp.pressed = true;
      sp.pressedAt = Date.now();
      sp.pressedBy = by;
      hist(sp, by, "压制完成，进入补照队列");
      void persist(sp).then(refresh);
    },
    [specimens, refresh]
  );

  const returnSpecimen = useCallback(
    (id: string, reason: string, by: string) => {
      const sp = specimens.find((s) => s.id === id);
      if (!sp || sp.shelf) return;
      const note: ReturnNote = {
        id: uid("r"),
        at: Date.now(),
        by,
        reason: reason.trim(),
        resolved: false,
      };
      sp.returns.push(note);
      // 无论此前是否鉴定通过，退回后都回到补照队列
      if (sp.identified) {
        sp.identified = false;
        sp.identifiedAt = undefined;
        sp.identifiedBy = undefined;
        hist(sp, by, `鉴定后退回修改：${note.reason}（原照片保留）`);
      } else {
        hist(sp, by, `退回修改：${note.reason}（原照片保留）`);
      }
      void persist(sp).then(refresh);
    },
    [specimens, refresh]
  );

  const approveSpecimen = useCallback(
    (id: string, by: string) => {
      const sp = specimens.find((s) => s.id === id);
      if (!sp || sp.identified) return;
      sp.identified = true;
      sp.identifiedAt = Date.now();
      sp.identifiedBy = by;
      hist(sp, by, "鉴定通过，等待分配柜位");
      void persist(sp).then(refresh);
    },
    [specimens, refresh]
  );

  const addPhoto = useCallback(
    async (id: string, category: PhotoCategory, file: File, by: string) => {
      const sp = specimens.find((s) => s.id === id);
      if (!sp || sp.shelf) return;
      const { blob, name } = await fileToPhoto(file);
      const photo: Photo = {
        id: uid("p"),
        category,
        blob,
        name,
        at: Date.now(),
        by,
      };
      sp.photos.push(photo);
      const label =
        category === "whole" ? "整株" : category === "label" ? "标签" : "生境";
      hist(sp, by, `上传${label}照片：${name}`);
      await persist(sp);
      await refresh();
    },
    [specimens, refresh]
  );

  const removePhoto = useCallback(
    (id: string, photoId: string, by: string) => {
      const sp = specimens.find((s) => s.id === id);
      if (!sp || sp.shelf) return;
      const photo = sp.photos.find((p) => p.id === photoId);
      if (!photo) return;
      sp.photos = sp.photos.filter((p) => p.id !== photoId);
      const label =
        photo.category === "whole"
          ? "整株"
          : photo.category === "label"
          ? "标签"
          : "生境";
      hist(sp, by, `删除${label}照片：${photo.name}`);
      void persist(sp).then(refresh);
    },
    [specimens, refresh]
  );

  const assignShelf = useCallback(
    async (id: string, rawCode: string, by: string): Promise<AssignResult> => {
      const sp = specimens.find((s) => s.id === id);
      if (!sp || !sp.identified || sp.shelf) return { ok: false };
      const code = rawCode.trim().toUpperCase();
      const conflict = specimens.find(
        (s) => s.id !== id && s.shelf?.code === code
      );
      if (conflict) {
        // 柜位已有标本：只提示换位，不写入任何记录
        return { ok: false, conflict };
      }
      const [cabinet, ...rest] = code.split("-");
      const shelf: Shelf = {
        code,
        cabinet,
        position: rest.join("-"),
        at: Date.now(),
        by,
      };
      sp.shelf = shelf;
      hist(sp, by, `分配柜位 ${code}，上柜`);
      await persist(sp);
      await refresh();
      return { ok: true };
    },
    [specimens, refresh]
  );

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      specimens,
      operator,
      setOperator,
      loadSeed,
      createSpecimen,
      editSpecimen,
      markPressed,
      returnSpecimen,
      approveSpecimen,
      addPhoto,
      removePhoto,
      assignShelf,
      findByCode,
    }),
    [
      ready,
      specimens,
      operator,
      setOperator,
      loadSeed,
      createSpecimen,
      editSpecimen,
      markPressed,
      returnSpecimen,
      approveSpecimen,
      addPhoto,
      removePhoto,
      assignShelf,
      findByCode,
    ]
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export function useSpecimen(id: string | undefined): Specimen | undefined {
  const { specimens } = useStore();
  return specimens.find((s) => s.id === id);
}

export { stageOf };
