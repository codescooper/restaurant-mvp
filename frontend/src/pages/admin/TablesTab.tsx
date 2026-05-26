import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { tableApi } from '../../services/endpoints';
import { getApiError } from '../../services/api';
import { RestaurantTable } from '../../types';

const PANEL = 'bg-neutral-950 border border-neutral-800 ring-1 ring-white/5 rounded-2xl';
const INPUT = 'w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400';
const OVERLAY = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50';
const MODAL = 'bg-neutral-950 border border-neutral-800 ring-1 ring-white/10 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-md p-6';
const BTN_GOLD = 'bg-gold-400 hover:bg-gold-300 text-black font-bold transition disabled:opacity-40';

const STATUS_LABEL: Record<string, string> = {
  libre: 'Libre',
  occupée: 'Occupée',
  addition_demandée: 'Addition demandée',
  réservée: 'Réservée',
};
const STATUS_BADGE: Record<string, string> = {
  libre: 'bg-emerald-500/15 text-emerald-300',
  occupée: 'bg-sky-500/15 text-sky-300',
  addition_demandée: 'bg-gold-400/15 text-gold-300',
  réservée: 'bg-purple-500/15 text-purple-300',
};

interface Form { name: string; capacity: string }
const EMPTY: Form = { name: '', capacity: '4' };

export default function TablesTab() {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<RestaurantTable | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = () => tableApi.list().then(setTables).catch((e) => setError(getApiError(e)));
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setError(''); setModal(true); };
  const openEdit = (t: RestaurantTable) => {
    setEditing(t);
    setForm({ name: t.name, capacity: String(t.capacity) });
    setError('');
    setModal(true);
  };

  const closeModal = () => { setError(''); setModal(false); };

  const submit = async () => {
    const name = form.name.trim();
    const capacity = Number(form.capacity);
    if (!name) { setError('Nom requis'); return; }
    if (!Number.isInteger(capacity) || capacity <= 0) { setError('Capacité invalide'); return; }
    setBusy(true);
    try {
      if (editing) await tableApi.update(editing.id, { name, capacity });
      else await tableApi.create({ name, capacity });
      setModal(false);
      await load();
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t: RestaurantTable) => {
    if (!window.confirm(`Supprimer ${t.name} ?`)) return;
    setError('');
    try {
      await tableApi.remove(t.id);
      await load();
    } catch (e) {
      setError(getApiError(e));
    }
  };

  return (
    <div className={`${PANEL} p-5`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-neutral-100">Tables</h2>
        <button onClick={openCreate} className={`${BTN_GOLD} flex items-center gap-2 px-3 py-2 rounded-lg`}>
          <Plus className="w-4 h-4" /> Nouvelle table
        </button>
      </div>
      {error && <div className="mb-3 text-sm text-rose-400">{error}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-neutral-400">
            <tr className="border-b border-neutral-800">
              <th className="text-left py-2">Nom</th>
              <th className="text-left py-2">Capacité</th>
              <th className="text-left py-2">Statut</th>
              <th className="text-right py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tables.map((t) => (
              <tr key={t.id} className="border-b border-neutral-900">
                <td className="py-2 text-neutral-100">{t.name}</td>
                <td className="py-2 text-neutral-300">{t.capacity}</td>
                <td className="py-2">
                  <span className={`text-xs px-2 py-1 rounded ${STATUS_BADGE[t.status] ?? 'bg-neutral-800'}`}>
                    {STATUS_LABEL[t.status] ?? t.status}
                  </span>
                </td>
                <td className="py-2 text-right">
                  <button onClick={() => openEdit(t)} className="p-1.5 text-neutral-400 hover:text-gold-400" title="Éditer">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(t)} className="p-1.5 text-neutral-400 hover:text-rose-400" title="Supprimer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {tables.length === 0 && (
              <tr><td colSpan={4} className="py-4 text-center text-neutral-500">Aucune table. Cliquez « Nouvelle table ».</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className={OVERLAY} onClick={() => !busy && closeModal()}>
          <div className={MODAL} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-neutral-100">{editing ? 'Éditer table' : 'Nouvelle table'}</h3>
              <button onClick={closeModal} disabled={busy} className="text-neutral-400 hover:text-neutral-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            {error && <div className="mb-3 text-sm text-rose-400">{error}</div>}
            <label className="block text-sm text-neutral-300 mb-1">Nom</label>
            <input className={INPUT} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            <label className="block text-sm text-neutral-300 mt-3 mb-1">Capacité</label>
            <input className={INPUT} type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={closeModal} disabled={busy} className="px-3 py-2 rounded-lg text-neutral-300 hover:bg-neutral-900">Annuler</button>
              <button onClick={submit} disabled={busy} className={`${BTN_GOLD} px-4 py-2 rounded-lg`}>{busy ? '…' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
