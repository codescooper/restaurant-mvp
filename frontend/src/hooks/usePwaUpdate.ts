import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Encapsule l'enregistrement du service worker (vite-plugin-pwa).
 * - needRefresh : un nouveau SW est en attente (nouvelle version déployée).
 * - offlineReady : le SW a précaché le shell → l'app marche hors-ligne.
 * - updateApp : active le nouveau SW et recharge la page.
 * - close : masque les notifications (bandeau / toast).
 */
export function usePwaUpdate() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  const updateApp = () => {
    void updateServiceWorker(true);
  };

  const close = () => {
    setNeedRefresh(false);
    setOfflineReady(false);
  };

  return { needRefresh, offlineReady, updateApp, close };
}
