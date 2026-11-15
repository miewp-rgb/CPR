import { useCallback, useEffect, useRef, useState } from 'react';
import type { CprRecord, SyncQueueItem } from '../types/cpr';
import {
  loadCachedCases,
  loadSyncQueue,
  saveCachedCases,
  saveSyncQueue,
  syncChannel,
} from '../lib/offlineStore';

function mergeCaseLists(
  serverCases: CprRecord[],
  localCases: CprRecord[],
  pendingIds: Set<string>
): CprRecord[] {
  const byKey = new Map<string, CprRecord>();
  for (const sc of serverCases) {
    byKey.set(sc.clientId || sc.id, { ...sc, syncState: 'synced' });
  }
  for (const lc of localCases) {
    const key = lc.clientId || lc.id;
    const existing = byKey.get(key);
    if (!existing) {
      if (pendingIds.has(lc.id) || pendingIds.has(lc.clientId)) {
        byKey.set(key, lc);
      }
      continue;
    }
    const localTime = new Date(lc.updatedAt).getTime();
    const serverTime = new Date(existing.updatedAt).getTime();
    if (pendingIds.has(lc.id) || pendingIds.has(lc.clientId) || localTime > serverTime) {
      byKey.set(key, lc);
    }
  }
  return Array.from(byKey.values()).sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );
}

export function useCprRealtime() {
  const [cases, setCases] = useState<CprRecord[]>([]);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBrowserOnline, setIsBrowserOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [simulatedOffline, setSimulatedOffline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const isFlushingRef = useRef(false);
  const effectiveOnline = isBrowserOnline && !simulatedOffline;

  // Live 1-second clock for active CPR durations
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Initial load from IndexedDB + server fetch
  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const [cachedCases, cachedQueue] = await Promise.all([
        loadCachedCases(),
        loadSyncQueue(),
      ]);

      if (!active) return;
      if (cachedCases.length > 0) {
        setCases(cachedCases);
        setIsLoading(false);
      }
      if (cachedQueue.length > 0) setSyncQueue(cachedQueue);

      if (navigator.onLine) {
        try {
          const res = await fetch('/api/cases');
          if (res.ok) {
            const data = (await res.json()) as { cases: CprRecord[]; serverTime: string };
            if (!active) return;
            const pendingIds = new Set(cachedQueue.map((q) => q.id));
            const merged = mergeCaseLists(data.cases, cachedCases, pendingIds);
            setCases(merged);
            setLastSyncedAt(data.serverTime);
            await saveCachedCases(merged);
          }
        } catch {
          // Offline fallback already loaded
        }
      }
      if (active) setIsLoading(false);
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

  // Browser online/offline listeners
  useEffect(() => {
    const onOnline = () => setIsBrowserOnline(true);
    const onOffline = () => setIsBrowserOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Flush offline queue automatically when back online
  const flushSyncQueue = useCallback(async () => {
    if (!effectiveOnline || isFlushingRef.current) return;
    const currentQueue = await loadSyncQueue();
    if (currentQueue.length === 0) return;

    isFlushingRef.current = true;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/cases/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations: currentQueue }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          cases: CprRecord[];
          serverTime: string;
        };
        await saveSyncQueue([]);
        setSyncQueue([]);
        const synced = data.cases.map((c) => ({ ...c, syncState: 'synced' as const }));
        setCases(synced);
        await saveCachedCases(synced);
        setLastSyncedAt(data.serverTime);
      }
    } catch {
      // Keep queue intact for next retry
    } finally {
      isFlushingRef.current = false;
      setIsSyncing(false);
    }
  }, [effectiveOnline]);

  useEffect(() => {
    if (effectiveOnline && syncQueue.length > 0) {
      void flushSyncQueue();
    }
  }, [effectiveOnline, syncQueue.length, flushSyncQueue]);

  // Real-time Server-Sent Events subscription
  useEffect(() => {
    if (!effectiveOnline) return;

    const es = new EventSource('/api/stream');

    es.addEventListener('init', (evt) => {
      try {
        const payload = JSON.parse((evt as MessageEvent).data) as {
          cases: CprRecord[];
          serverTime: string;
        };
        setLastSyncedAt(payload.serverTime);
        setCases((prev) => {
          const pendingIds = new Set(
            prev.filter((c) => c.syncState === 'pending').map((c) => c.clientId || c.id)
          );
          const merged = mergeCaseLists(payload.cases, prev, pendingIds);
          void saveCachedCases(merged);
          return merged;
        });
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener('case:upserted', (evt) => {
      try {
        const incoming = JSON.parse((evt as MessageEvent).data) as CprRecord;
        setCases((prev) => {
          const existsIdx = prev.findIndex(
            (c) => c.id === incoming.id || (incoming.clientId && c.clientId === incoming.clientId)
          );
          let next: CprRecord[];
          if (existsIdx === -1) {
            next = [{ ...incoming, syncState: 'synced' }, ...prev];
          } else {
            const existing = prev[existsIdx];
            if (
              existing.syncState === 'pending' &&
              new Date(existing.updatedAt).getTime() > new Date(incoming.updatedAt).getTime()
            ) {
              return prev;
            }
            next = [...prev];
            next[existsIdx] = { ...incoming, syncState: 'synced' };
          }
          next.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
          void saveCachedCases(next);
          return next;
        });
      } catch {
        // ignore
      }
    });

    es.addEventListener('case:deleted', (evt) => {
      try {
        const { id } = JSON.parse((evt as MessageEvent).data) as { id: string };
        setCases((prev) => {
          const next = prev.filter((c) => c.id !== id && c.clientId !== id);
          void saveCachedCases(next);
          return next;
        });
      } catch {
        // ignore
      }
    });

    return () => {
      es.close();
    };
  }, [effectiveOnline]);

  // Cross-tab BroadcastChannel sync (works even offline!)
  useEffect(() => {
    const channel = syncChannel;
    if (!channel) return;
    const handler = (evt: MessageEvent) => {
      const msg = evt.data as { type: string; record?: CprRecord; id?: string };
      if (msg.type === 'upsert' && msg.record) {
        const incoming = msg.record;
        setCases((prev) => {
          const idx = prev.findIndex((c) => c.clientId === incoming.clientId || c.id === incoming.id);
          const next = [...prev];
          if (idx === -1) next.unshift(incoming);
          else next[idx] = incoming;
          return next;
        });
      } else if (msg.type === 'delete' && msg.id) {
        setCases((prev) => prev.filter((c) => c.id !== msg.id && c.clientId !== msg.id));
      }
    };
    channel.addEventListener('message', handler);
    return () => channel.removeEventListener('message', handler);
  }, []);

  const upsertCase = useCallback(
    async (record: CprRecord): Promise<CprRecord> => {
      const nowIso = new Date().toISOString();
      const localVersion: CprRecord = {
        ...record,
        updatedAt: nowIso,
        syncState: effectiveOnline ? 'synced' : 'pending',
      };

      setCases((prev) => {
        const idx = prev.findIndex(
          (c) => c.id === localVersion.id || c.clientId === localVersion.clientId
        );
        const next = [...prev];
        if (idx === -1) next.unshift(localVersion);
        else next[idx] = localVersion;
        next.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        void saveCachedCases(next);
        return next;
      });
      syncChannel?.postMessage({ type: 'upsert', record: localVersion });

      if (!effectiveOnline) {
        const queueItem: SyncQueueItem = {
          id: localVersion.clientId || localVersion.id,
          operation: 'upsert',
          record: localVersion,
          queuedAt: nowIso,
        };
        setSyncQueue((prev) => {
          const filtered = prev.filter((q) => q.id !== queueItem.id);
          const next = [...filtered, queueItem];
          void saveSyncQueue(next);
          return next;
        });
        return localVersion;
      }

      try {
        const res = await fetch('/api/cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(localVersion),
        });
        if (!res.ok) throw new Error('Sync failed');
        const data = (await res.json()) as { case: CprRecord };
        const serverRecord: CprRecord = { ...data.case, syncState: 'synced' };

        setCases((prev) => {
          const idx = prev.findIndex(
            (c) => c.clientId === serverRecord.clientId || c.id === serverRecord.id
          );
          const next = [...prev];
          if (idx === -1) next.unshift(serverRecord);
          else next[idx] = serverRecord;
          void saveCachedCases(next);
          return next;
        });
        setLastSyncedAt(new Date().toISOString());
        return serverRecord;
      } catch {
        const pendingRecord: CprRecord = { ...localVersion, syncState: 'pending' };
        setCases((prev) => {
          const next = prev.map((c) =>
            c.clientId === pendingRecord.clientId ? pendingRecord : c
          );
          void saveCachedCases(next);
          return next;
        });
        const queueItem: SyncQueueItem = {
          id: pendingRecord.clientId || pendingRecord.id,
          operation: 'upsert',
          record: pendingRecord,
          queuedAt: nowIso,
        };
        setSyncQueue((prev) => {
          const next = [...prev.filter((q) => q.id !== queueItem.id), queueItem];
          void saveSyncQueue(next);
          return next;
        });
        return pendingRecord;
      }
    },
    [effectiveOnline]
  );

  const deleteCase = useCallback(
    async (id: string) => {
      const target = cases.find((c) => c.id === id || c.clientId === id);
      setCases((prev) => {
        const next = prev.filter((c) => c.id !== id && c.clientId !== id);
        void saveCachedCases(next);
        return next;
      });
      syncChannel?.postMessage({ type: 'delete', id });

      if (!effectiveOnline) {
        const queueItem: SyncQueueItem = {
          id: target?.id || id,
          operation: 'delete',
          queuedAt: new Date().toISOString(),
        };
        setSyncQueue((prev) => {
          const next = [...prev.filter((q) => q.id !== queueItem.id), queueItem];
          void saveSyncQueue(next);
          return next;
        });
        return;
      }

      try {
        await fetch(`/api/cases/${encodeURIComponent(id)}`, { method: 'DELETE' });
      } catch {
        const queueItem: SyncQueueItem = {
          id: target?.id || id,
          operation: 'delete',
          queuedAt: new Date().toISOString(),
        };
        setSyncQueue((prev) => {
          const next = [...prev.filter((q) => q.id !== queueItem.id), queueItem];
          void saveSyncQueue(next);
          return next;
        });
      }
    },
    [cases, effectiveOnline]
  );

  return {
    cases,
    isLoading,
    isOnline: effectiveOnline,
    isBrowserOnline,
    simulatedOffline,
    setSimulatedOffline,
    isSyncing,
    pendingSyncCount: syncQueue.length,
    lastSyncedAt,
    nowMs,
    upsertCase,
    deleteCase,
    syncNow: flushSyncQueue,
  };
}
