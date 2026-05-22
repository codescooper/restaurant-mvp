import { useEffect, useState } from 'react';
import { Plus, X, ClipboardCheck, ArrowLeft } from 'lucide-react';
import { inventoryApi } from '../../services/endpoints';
import { getApiError } from '../../services/api';
import { Inventory } from '../../types';
import { formatDateTime } from '../../utils/format';

const PANEL = 'bg-neutral-950 border border-neutral-800 ring-1 ring-white/5 rounded-2xl';
const INPUT =
  'w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400';
const BTN_GOLD = 'bg-gold-400 hover:bg-gold-300 text-black font-bold transition disabled:opacity-40';

const TYPE_LABELS: Record<string, string> = {
  quotidien: 'Quotidien',
  hebdomadaire: 'Hebdomadaire',
  mensuel: 'Mensuel',
  ponctuel: 'Ponctuel',
};

export default function InventoryTab() {
  const [list, setList] = useState<Inventory[]>([]);
  const [current, setCurrent] = useState<Inventory | null>(null);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [newType, setNewType] = useState('ponctuel');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadList = () => inventoryApi.list().then(setList).catch((e) => setError(getApiError(e)));

  useEffect(() => {
    loadList();
  }, []);

  const open = async (id: number) => {
    setError('');
    try {
      const inv = await inventoryApi.get(id);
      setCurrent(inv);
      const init: Record<number, string> = {};
      (inv.lines ?? []).forEach((l) => {
        init[l.stockItemId] = l.countedQty != null ? String(l.countedQty) : '';
      });
      setCounts(init);
    } catch (e) {
      setError(getApiError(e));
    }
  };

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const inv = await inventoryApi.create(newType);
      setCreating(false);
      loadList();
      open(inv.id);
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const collectLines = () =>
    Object.entries(counts)
      .filter(([, v]) => v !== '')
      .map(([id, v]) => ({ stockItemId: Number(id), countedQty: Number(v) }));

  const save = async () => {
    if (!current) return;
    const lines = collectLines();
    if (!lines.length) {
      setError('Saisissez au moins une quantité comptée');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const inv = await inventoryApi.saveCounts(current.id, lines);
      setCurrent(inv);
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const validate = async () => {
    if (!current) return;
    if (!window.confirm('Valider l\'inventaire ? Le stock sera ajusté aux quantités comptées.')) return;
    setBusy(true);
    setError('');
    try {
      const lines = collectLines();
      if (lines.length) await inventoryApi.saveCounts(current.id, lines);
      const inv = await inventoryApi.validate(current.id);
      setCurrent(inv);
      loadList();
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  // Vue détail d'un inventaire
  if (current) {
    const editable = current.status === 'en_cours';
    return (
      <div>
        {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 mb-4 text-sm">{error}</div>}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrent(null)} className="flex items-center gap-1 text-sm text-neutral-300 hover:text-neutral-100">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <div className="text-sm text-neutral-400">
            Inventaire #{current.id} · {TYPE_LABELS[current.type] ?? current.type} ·{' '}
            <span className={current.status === 'validé' ? 'text-emerald-300' : 'text-gold-300'}>{current.status}</span>
          </div>
        </div>

        <div className={`${PANEL} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead className="bg-neutral-900 text-neutral-300">
              <tr>
                <th className="text-left p-3">Article</th>
                <th className="text-right p-3">Théorique</th>
                <th className="text-right p-3">Compté</th>
                <th className="text-right p-3">Écart</th>
              </tr>
            </thead>
            <tbody>
              {(current.lines ?? []).map((l) => {
                const countedStr = editable ? counts[l.stockItemId] ?? '' : l.countedQty != null ? String(l.countedQty) : '';
                const counted = countedStr === '' ? null : Number(countedStr);
                const diff = counted == null ? null : Math.round((counted - l.theoreticalQty) * 100) / 100;
                return (
                  <tr key={l.id} className="border-t">
                    <td className="p-3 text-neutral-100">
                      {l.stockItem?.name} <span className="text-neutral-500 text-xs">({l.stockItem?.unit})</span>
                    </td>
                    <td className="p-3 text-right text-neutral-300">{l.theoreticalQty}</td>
                    <td className="p-3 text-right">
                      {editable ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={counts[l.stockItemId] ?? ''}
                          onChange={(e) => setCounts({ ...counts, [l.stockItemId]: e.target.value })}
                          className="w-24 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-right text-neutral-100 outline-none focus:ring-2 focus:ring-gold-400/60"
                          placeholder="—"
                        />
                      ) : (
                        <span className="text-neutral-200">{counted ?? '—'}</span>
                      )}
                    </td>
                    <td className={`p-3 text-right font-semibold ${diff == null ? 'text-neutral-500' : diff === 0 ? 'text-emerald-400' : diff > 0 ? 'text-sky-400' : 'text-rose-400'}`}>
                      {diff == null ? '—' : `${diff > 0 ? '+' : ''}${diff}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {editable && (
          <div className="flex gap-2 mt-4">
            <button onClick={save} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700 font-semibold transition disabled:opacity-40">
              Enregistrer
            </button>
            <button onClick={validate} disabled={busy} className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 ${BTN_GOLD}`}>
              <ClipboardCheck className="w-5 h-5" /> Valider (ajuste le stock)
            </button>
          </div>
        )}
      </div>
    );
  }

  // Liste des inventaires
  return (
    <div>
      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 mb-4 text-sm">{error}</div>}

      <div className="flex justify-end mb-4">
        {creating ? (
          <div className="flex items-center gap-2">
            <select className={`${INPUT} w-auto`} value={newType} onChange={(e) => setNewType(e.target.value)}>
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <button onClick={create} disabled={busy} className={`px-4 py-2 rounded-lg ${BTN_GOLD}`}>Démarrer</button>
            <button onClick={() => setCreating(false)} className="p-2 text-neutral-400 hover:text-neutral-200">
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <button onClick={() => setCreating(true)} className={`flex items-center gap-2 px-4 py-2 rounded-lg ${BTN_GOLD}`}>
            <Plus className="w-5 h-5" /> Nouvel inventaire
          </button>
        )}
      </div>

      <div className={`${PANEL} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-neutral-300">
            <tr>
              <th className="text-left p-3">#</th>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Créé</th>
              <th className="text-left p-3">Articles</th>
              <th className="text-left p-3">Statut</th>
              <th className="text-right p-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((inv) => (
              <tr key={inv.id} className="border-t hover:bg-neutral-900">
                <td className="p-3 text-neutral-100">{inv.id}</td>
                <td className="p-3 text-neutral-200">{TYPE_LABELS[inv.type] ?? inv.type}</td>
                <td className="p-3 text-neutral-400">{formatDateTime(inv.createdAt)}</td>
                <td className="p-3 text-neutral-400">{inv._count?.lines ?? '—'}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${inv.status === 'validé' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-gold-400/15 text-gold-300'}`}>
                    {inv.status}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <button onClick={() => open(inv.id)} className="text-gold-400 hover:underline text-xs">
                    {inv.status === 'en_cours' ? 'Compter' : 'Voir'}
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-neutral-500">
                  Aucun inventaire
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
