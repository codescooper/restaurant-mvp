/**
 * Message standardisé affiché quand un écran hors périmètre offline (stats,
 * historique, admin) est consulté sans réseau. À rendre quand `!online`.
 */
export function OfflineNotice({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-neutral-400">
      <p className="text-lg font-medium text-neutral-200">Hors-ligne</p>
      <p className="text-sm">
        {message ?? 'Cette page nécessite une connexion. Reconnectez-vous pour la consulter.'}
      </p>
    </div>
  );
}
