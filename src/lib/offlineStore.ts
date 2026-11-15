import type { CprRecord, SyncQueueItem, WorkAlert } from '../types/cpr';

const DB_NAME = 'cpr_command_offline_db';
const DB_VERSION = 1;
const STORE_CASES = 'cases';
const STORE_QUEUE = 'sync_queue';
const STORE_ALERTS = 'alerts';

const LS_CASES_KEY = 'cpr_command_cases_v1';
const LS_QUEUE_KEY = 'cpr_command_queue_v1';
const LS_ALERTS_KEY = 'cpr_command_alerts_v1';

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_CASES)) {
          db.createObjectStore(STORE_CASES, { keyPath: 'clientId' });
        }
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_ALERTS)) {
          db.createObjectStore(STORE_ALERTS, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGetAll<T>(storeName: string, lsKey: string): Promise<T[]> {
  const db = await openDb();
  if (!db) {
    try {
      const raw = localStorage.getItem(lsKey);
      return raw ? (JSON.parse(raw) as T[]) : [];
    } catch {
      return [];
    }
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as T[]) || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function idbReplaceAll<T>(storeName: string, lsKey: string, items: T[]): Promise<void> {
  try {
    localStorage.setItem(lsKey, JSON.stringify(items));
  } catch {
    // ignore storage quota
  }
  const db = await openDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadCachedCases(): Promise<CprRecord[]> {
  return idbGetAll<CprRecord>(STORE_CASES, LS_CASES_KEY);
}

export async function saveCachedCases(cases: CprRecord[]): Promise<void> {
  await idbReplaceAll(STORE_CASES, LS_CASES_KEY, cases);
}

export async function loadSyncQueue(): Promise<SyncQueueItem[]> {
  return idbGetAll<SyncQueueItem>(STORE_QUEUE, LS_QUEUE_KEY);
}

export async function saveSyncQueue(queue: SyncQueueItem[]): Promise<void> {
  await idbReplaceAll(STORE_QUEUE, LS_QUEUE_KEY, queue);
}

export async function loadCachedAlerts(): Promise<WorkAlert[]> {
  return idbGetAll<WorkAlert>(STORE_ALERTS, LS_ALERTS_KEY);
}

export async function saveCachedAlerts(alerts: WorkAlert[]): Promise<void> {
  await idbReplaceAll(STORE_ALERTS, LS_ALERTS_KEY, alerts.slice(0, 60));
}

export const syncChannel =
  typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('cpr-command-realtime')
    : null;
