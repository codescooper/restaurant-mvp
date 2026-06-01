import { usePwaUpdate } from '../hooks/usePwaUpdate';

/**
 * Notifications PWA, montées une seule fois à la racine de l'app :
 * - needRefresh : bandeau « Nouvelle version · Recharger » (l'utilisateur
 *   choisit le moment, aucune commande interrompue).
 * - offlineReady : toast discret « prête à fonctionner hors-ligne ».
 * Les deux sont fermables.
 */
export function UpdateBanner() {
  const { needRefresh, offlineReady, updateApp, close } = usePwaUpdate();

  if (needRefresh) {
    return (
      <div
        role="status"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg bg-neutral-900 border border-gold-400/60 px-4 py-3 text-sm text-neutral-100 shadow-lg"
      >
        <span>Nouvelle version disponible</span>
        <button
          onClick={updateApp}
          className="rounded-md bg-gold-400 px-3 py-1 font-medium text-neutral-900 hover:bg-gold-300"
        >
          Recharger
        </button>
        <button onClick={close} aria-label="Fermer" className="text-neutral-400 hover:text-neutral-200">
          ×
        </button>
      </div>
    );
  }

  if (offlineReady) {
    return (
      <div
        role="status"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg bg-neutral-900 border border-neutral-700 px-4 py-3 text-sm text-neutral-300 shadow-lg"
      >
        <span>Prête à fonctionner hors-ligne</span>
        <button onClick={close} aria-label="Fermer" className="text-neutral-400 hover:text-neutral-200">
          ×
        </button>
      </div>
    );
  }

  return null;
}
