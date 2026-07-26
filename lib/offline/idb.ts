/**
 * Minimal promisified IndexedDB access (ARCHITECTURE.md § Offline strategy).
 * Two stores: the sources snapshot (single record) and the write outbox.
 * No library — the surface we need is four operations.
 */

const DB_NAME = "sdv-offline";
const DB_VERSION = 1;

export const SNAPSHOT_STORE = "snapshot";
export const OUTBOX_STORE = "outbox";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        db.createObjectStore(SNAPSHOT_STORE);
      }
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => {
      // If another tab upgrades the schema, drop the handle so the next
      // call reopens cleanly.
      req.result.onversionchange = () => {
        req.result.close();
        dbPromise = null;
      };
      resolve(req.result);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet<T>(
  store: string,
  key: IDBValidKey,
): Promise<T | undefined> {
  const db = await openDb();
  return requestToPromise<T | undefined>(
    db.transaction(store, "readonly").objectStore(store).get(key),
  );
}

export async function idbGetAll<T>(store: string): Promise<T[]> {
  const db = await openDb();
  return requestToPromise<T[]>(
    db.transaction(store, "readonly").objectStore(store).getAll(),
  );
}

/** Put a value; pass `key` only for stores without a keyPath. */
export async function idbPut(
  store: string,
  value: unknown,
  key?: IDBValidKey,
): Promise<void> {
  const db = await openDb();
  await requestToPromise(
    db.transaction(store, "readwrite").objectStore(store).put(value, key),
  );
}

export async function idbDelete(
  store: string,
  key: IDBValidKey,
): Promise<void> {
  const db = await openDb();
  await requestToPromise(
    db.transaction(store, "readwrite").objectStore(store).delete(key),
  );
}
