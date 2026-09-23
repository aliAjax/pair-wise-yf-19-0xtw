import type { Specimen } from "./types";

const DB_NAME = "herbarium-workbench";
const DB_VERSION = 1;
export const STORE = "specimens";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // 其他页面/脚本要删库或升级时，主动关闭，避免阻塞
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export function getAll(): Promise<Specimen[]> {
  return tx("readonly", (s) => s.getAll() as IDBRequest<Specimen[]>);
}

export function put(specimen: Specimen): Promise<IDBValidKey> {
  return tx("readwrite", (s) => s.put(specimen));
}

export function bulkPut(specimens: Specimen[]): Promise<IDBValidKey[]> {
  return openDB().then(
    (db) =>
      new Promise<IDBValidKey[]>((resolve, reject) => {
        const t = db.transaction(STORE, "readwrite");
        const store = t.objectStore(STORE);
        const keys: IDBValidKey[] = [];
        specimens.forEach((sp) => {
          const r = store.put(sp);
          r.onsuccess = () => keys.push(r.result);
        });
        t.oncomplete = () => resolve(keys);
        t.onerror = () => reject(t.error);
      })
  );
}

export async function isEmpty(): Promise<boolean> {
  const list = await getAll();
  return list.length === 0;
}

/** 供外部（测试 / 重置）关闭连接 */
export async function closeDB(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  db.close();
  dbPromise = null;
}
