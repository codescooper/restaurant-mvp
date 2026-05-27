import { useEffect, useState } from 'react';
import { Shield, CheckCircle2, Pause, Play, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { adminApi } from '../services/endpoints';
import { AdminRestaurantRow, RestaurantStatus } from '../types';
import { getApiError } from '../services/api';

const STATUS_LABEL: Record<RestaurantStatus, string> = {
  pending: 'En attente', active: 'Actif', suspended: 'Suspendu', rejected: 'Refusé',
};
const STATUS_BADGE: Record<RestaurantStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-300', active: 'bg-emerald-500/15 text-emerald-300',
  suspended: 'bg-rose-500/15 text-rose-300', rejected: 'bg-orange-500/15 text-orange-300',
};

export default function SuperAdminPage() {
  const [rows, setRows] = useState<AdminRestaurantRow[]>([]);
  const [filter, setFilter] = useState<RestaurantStatus | 'all'>('all');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: number; type: 'activate' | 'suspend' | 'reactivate' | 'reject'; restoName: string; counts?: AdminRestaurantRow['_count']; reason?: string } | null>(null);

  const load = () => adminApi.listRestaurants(filter === 'all' ? undefined : filter)
    .then(setRows).catch((e) => setError(getApiError(e)));
  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const runAction = async () => {
    if (!confirmAction) return;
    const { id, type, reason } = confirmAction;
    setBusyId(id);
    try {
      if (type === 'activate') {
        const res = await adminApi.activate(id);
        alert(`✅ Restaurant activé. Données simulation supprimées :\n` +
          Object.entries(res.deletedCounts).map(([k, v]) => `  • ${k} : ${v}`).join('\n') +
          `\nStocks restaurés aux valeurs préparées.`);
      } else if (type === 'suspend') await adminApi.suspend(id, reason);
      else if (type === 'reactivate') await adminApi.reactivate(id);
      else if (type === 'reject') await adminApi.reject(id, reason);
      setConfirmAction(null);
      load();
    } catch (e) { setError(getApiError(e)); } finally { setBusyId(null); }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-black text-neutral-200 max-w-7xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <Shield className="w-8 h-8 text-gold-400" />
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Console super-admin</h1>
          <p className="text-xs text-neutral-400">Restaurants de la plateforme</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all','pending','active','suspended','rejected'] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === s ? 'bg-gold-400 text-black' : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800'}`}>
            {s === 'all' ? 'Tous' : STATUS_LABEL[s as RestaurantStatus]}
          </button>
        ))}
      </div>

      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 mb-3 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-neutral-400 border-b border-neutral-800">
            <tr>
              <th className="text-left p-3">Restaurant</th>
              <th className="text-left p-3">Propriétaire</th>
              <th className="text-left p-3">Statut</th>
              <th className="text-left p-3">Contenu</th>
              <th className="text-left p-3">Créé</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const owner = r.memberships[0]?.user;
              return (
                <tr key={r.id} className="border-b border-neutral-900">
                  <td className="p-3"><div className="font-medium text-neutral-100">{r.name}</div><div className="text-xs text-neutral-500">{r.slug}</div></td>
                  <td className="p-3 text-neutral-300">{owner?.displayName ?? owner?.email ?? '—'}<div className="text-xs text-neutral-500">{owner?.email}</div></td>
                  <td className="p-3"><span className={`text-xs px-2 py-1 rounded ${STATUS_BADGE[r.status]}`}>{STATUS_LABEL[r.status]}</span>{r.rejectedReason && <div className="text-xs text-neutral-500 mt-1">{r.rejectedReason}</div>}{r.suspendedReason && <div className="text-xs text-neutral-500 mt-1">{r.suspendedReason}</div>}</td>
                  <td className="p-3 text-xs text-neutral-400">{r._count.dishes} plats · {r._count.tables} tables · {r._count.memberships} membres</td>
                  <td className="p-3 text-xs text-neutral-400">{new Date(r.createdAt).toLocaleDateString('fr-FR')}</td>
                  <td className="p-3 text-right">
                    {r.status === 'pending' && (
                      <div className="flex gap-1 justify-end">
                        <button disabled={busyId === r.id} onClick={() => setConfirmAction({ id: r.id, type: 'activate', restoName: r.name, counts: r._count })} className="text-xs px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25">{busyId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><CheckCircle2 className="w-3 h-3 inline" /> Activer</>}</button>
                        <button disabled={busyId === r.id} onClick={() => setConfirmAction({ id: r.id, type: 'reject', restoName: r.name })} className="text-xs px-2 py-1 rounded bg-orange-500/15 text-orange-300 border border-orange-500/30 hover:bg-orange-500/25"><XCircle className="w-3 h-3 inline" /> Refuser</button>
                      </div>
                    )}
                    {r.status === 'active' && (
                      <button disabled={busyId === r.id} onClick={() => setConfirmAction({ id: r.id, type: 'suspend', restoName: r.name })} className="text-xs px-2 py-1 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25"><Pause className="w-3 h-3 inline" /> Suspendre</button>
                    )}
                    {(r.status === 'suspended' || r.status === 'rejected') && (
                      <button disabled={busyId === r.id} onClick={() => setConfirmAction({ id: r.id, type: 'reactivate', restoName: r.name })} className="text-xs px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"><Play className="w-3 h-3 inline" /> Réactiver</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="text-center text-neutral-500 p-6">Aucun restaurant dans ce filtre</td></tr>}
          </tbody>
        </table>
      </div>

      {confirmAction && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setConfirmAction(null)}>
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-neutral-100 mb-2">
              {confirmAction.type === 'activate' && `Activer ${confirmAction.restoName} ?`}
              {confirmAction.type === 'suspend' && `Suspendre ${confirmAction.restoName} ?`}
              {confirmAction.type === 'reactivate' && `Réactiver ${confirmAction.restoName} ?`}
              {confirmAction.type === 'reject' && `Refuser ${confirmAction.restoName} ?`}
            </h3>
            {confirmAction.type === 'activate' && (
              <p className="text-sm text-neutral-400 mb-3">
                <b className="text-amber-300">Attention :</b> toutes les données de simulation seront supprimées (commandes test, sessions de caisse, mouvements de stock, notifications, audit). Les stocks seront restaurés aux valeurs préparées par le propriétaire. <b>Cette action est irréversible.</b>
              </p>
            )}
            {(confirmAction.type === 'suspend' || confirmAction.type === 'reject') && (
              <>
                <label className="block text-sm text-neutral-300 mb-1">Raison (optionnelle, visible par le propriétaire)</label>
                <textarea value={confirmAction.reason ?? ''} onChange={(e) => setConfirmAction({ ...confirmAction, reason: e.target.value })} rows={3}
                  maxLength={500}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 mb-3 text-sm" />
              </>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmAction(null)} className="px-3 py-2 rounded-lg text-neutral-300">Annuler</button>
              <button onClick={runAction} disabled={busyId !== null} className="px-4 py-2 rounded-lg bg-gold-400 text-black font-bold">Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
