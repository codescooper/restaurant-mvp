import { useCallback, useEffect, useState } from 'react';
import { getQueuedOrders, clearQueuedOrder, countQueuedOrders } from '../services/offline';
import { syncApi } from '../services/endpoints';

// Detecte l'etat reseau et rejoue les commandes hors-ligne a la reconnexion (§13 offline).
export function useOfflineSync() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [queuedCount, setQueuedCount] = useState(0);

  const refreshCount = useCallback(async () => {
    setQueuedCount(await countQueuedOrders());
  }, []);

  const flush = useCallback(async () => {
    const queued = await getQueuedOrders();
    if (!queued.length) return;
    try {
      const res = await syncApi.push(queued);
      for (const r of res.results ?? []) {
        if (r.status === 'synced' && r.clientId) await clearQueuedOrder(r.clientId);
      }
    } catch {
      // on reste hors-ligne, on retentera plus tard
    }
    await refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void flush();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    void refreshCount();
    if (navigator.onLine) void flush();
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [flush, refreshCount]);

  return { online, queuedCount, flush, refreshCount };
}
