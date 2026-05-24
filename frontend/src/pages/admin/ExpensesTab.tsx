import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, X, Wallet } from 'lucide-react';
import { expenseApi, ExpenseInput } from '../../services/endpoints';
import { getApiError } from '../../services/api';
import { Expense } from '../../types';
import { formatFCFA } from '../../utils/format';

const PANEL = 'bg-neutral-950 border border-neutral-800 ring-1 ring-white/5 rounded-2xl';
const INPUT =
  'w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400';
const OVERLAY = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50';
const MODAL = 'bg-neutral-950 border border-neutral-800 ring-1 ring-white/10 rounded-2xl shadow-2xl shadow-black/60 w-full p-6 max-h-[90vh] overflow-y-auto';
const BTN_GOLD = 'bg-gold-400 hover:bg-gold-300 text-black font-bold transition disabled:opacity-40';

// Catégories regroupées (les valeurs correspondent à EXPENSE_CATEGORIES côté backend).
const CATEGORY_GROUPS: { group: string; items: { value: string; label: string }[] }[] = [
  {
    group: 'Charges fixes',
    items: [
      { value: 'loyer', label: 'Loyer' },
      { value: 'électricité', label: 'Électricité' },
      { value: 'eau', label: 'Eau' },
      { value: 'internet', label: 'Internet / téléphone' },
      { value: 'abonnement', label: 'Abonnement' },
    ],
  },
  {
    group: 'Personnel',
    items: [
      { value: 'salaire', label: 'Salaire' },
      { value: 'prime', label: 'Prime' },
      { value: 'charges_sociales', label: 'Charges sociales' },
    ],
  },
  {
    group: 'Exploitation',
    items: [
      { value: 'équipement', label: 'Équipement' },
      { value: 'entretien', label: 'Entretien / réparations' },
      { value: 'transport', label: 'Transport' },
      { value: 'nettoyage', label: 'Nettoyage' },
    ],
  },
  {
    group: 'Divers',
    items: [
      { value: 'marketing', label: 'Marketing' },
      { value: 'taxes', label: 'Taxes / impôts' },
      { value: 'frais_bancaires', label: 'Frais bancaires' },
      { value: 'autre', label: 'Autre' },
    ],
  },
];
const CATEGORY_LABEL: Record<string, string> = {
  ...Object.fromEntries(CATEGORY_GROUPS.flatMap((g) => g.items.map((i) => [i.value, i.label]))),
  // Auto-générée depuis le module stock (non proposée à la création manuelle).
  approvisionnement: 'Approvisionnement (stock)',
};
const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'espèces', label: 'Espèces' },
  { value: 'virement', label: 'Virement' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'carte', label: 'Carte' },
  { value: 'autre', label: 'Autre' },
];

const today = () => new Date().toISOString().slice(0, 10);

interface ExpForm {
  label: string;
  category: string;
  amount: string;
  expenseDate: string;
  paymentMethod: string;
  note: string;
}
const EMPTY: ExpForm = { label: '', category: 'loyer', amount: '', expenseDate: today(), paymentMethod: '', note: '' };

export default function ExpensesTab() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpForm>(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = (category?: string) =>
    expenseApi.list(category || undefined).then(setExpenses).catch((e) => setError(getApiError(e)));

  useEffect(() => {
    load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const total = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, expenseDate: today() });
    setError('');
    setModal(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    setForm({
      label: e.label,
      category: e.category,
      amount: String(e.amount),
      expenseDate: e.expenseDate.slice(0, 10),
      paymentMethod: e.paymentMethod ?? '',
      note: e.note ?? '',
    });
    setError('');
    setModal(true);
  };

  const submit = async () => {
    if (!form.label.trim()) {
      setError('Libellé requis');
      return;
    }
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      setError('Montant invalide');
      return;
    }
    const payload: ExpenseInput = {
      label: form.label.trim(),
      category: form.category,
      amount,
      expenseDate: form.expenseDate,
      paymentMethod: form.paymentMethod || undefined,
      note: form.note || undefined,
    };
    setBusy(true);
    setError('');
    try {
      if (editing) await expenseApi.update(editing.id, payload);
      else await expenseApi.create(payload);
      setModal(false);
      load(filter);
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (e: Expense) => {
    if (!window.confirm(`Supprimer la dépense "${e.label}" ?`)) return;
    try {
      await expenseApi.remove(e.id);
      load(filter);
    } catch (err) {
      setError(getApiError(err));
    }
  };

  const setF = (patch: Partial<ExpForm>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div>
      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 mb-4 text-sm">{error}</div>}

      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className={`${PANEL} px-4 py-2 flex items-center gap-2`}>
            <Wallet className="w-5 h-5 text-gold-400" />
            <div>
              <div className="text-xs text-neutral-400">Total {filter ? `(${CATEGORY_LABEL[filter] ?? filter})` : 'affiché'}</div>
              <div className="text-lg font-bold text-gold-400">{formatFCFA(total)}</div>
            </div>
          </div>
          <select className={`${INPUT} w-auto`} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Toutes les catégories</option>
            <option value="approvisionnement">Approvisionnement (stock)</option>
            {CATEGORY_GROUPS.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.items.map((i) => (
                  <option key={i.value} value={i.value}>{i.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <button onClick={openCreate} className={`flex items-center gap-2 px-4 py-2 rounded-lg ${BTN_GOLD}`}>
          <Plus className="w-5 h-5" /> Nouvelle dépense
        </button>
      </div>

      <div className={`${PANEL} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-neutral-300">
            <tr>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Libellé</th>
              <th className="text-left p-3">Catégorie</th>
              <th className="text-left p-3">Paiement</th>
              <th className="text-right p-3">Montant</th>
              <th className="text-right p-3"></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-t border-neutral-800 hover:bg-neutral-900">
                <td className="p-3 text-neutral-400 whitespace-nowrap">{new Date(e.expenseDate).toLocaleDateString('fr-FR')}</td>
                <td className="p-3">
                  <div className="font-medium text-neutral-100">{e.label}</div>
                  {e.note && <div className="text-xs text-neutral-500 truncate max-w-xs">{e.note}</div>}
                </td>
                <td className="p-3 text-neutral-400">
                  <span className="text-xs bg-neutral-800 px-2 py-0.5 rounded-full">{CATEGORY_LABEL[e.category] ?? e.category}</span>
                </td>
                <td className="p-3 text-neutral-400 capitalize">{e.paymentMethod ? e.paymentMethod.replace('_', ' ') : '—'}</td>
                <td className="p-3 text-right font-semibold text-gold-400 whitespace-nowrap">{formatFCFA(e.amount)}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(e)} className="p-1.5 text-gold-400 hover:bg-neutral-800 rounded">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(e)} className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-neutral-500">Aucune dépense</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className={OVERLAY}>
          <div className={`${MODAL} max-w-md`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-neutral-100">{editing ? 'Modifier la dépense' : 'Nouvelle dépense'}</h3>
              <button onClick={() => setModal(false)} className="text-neutral-500 hover:text-neutral-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-2 mb-3 text-sm">{error}</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Libellé *</label>
                <input className={INPUT} placeholder="ex. Loyer mai, Facture CIE…" value={form.label} onChange={(e) => setF({ label: e.target.value })} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Catégorie</label>
                  <select className={INPUT} value={form.category} onChange={(e) => setF({ category: e.target.value })}>
                    {CATEGORY_GROUPS.map((g) => (
                      <optgroup key={g.group} label={g.group}>
                        {g.items.map((i) => (
                          <option key={i.value} value={i.value}>{i.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Montant (FCFA) *</label>
                  <input type="number" min="0" className={INPUT} value={form.amount} onChange={(e) => setF({ amount: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Date</label>
                  <input type="date" className={INPUT} value={form.expenseDate} onChange={(e) => setF({ expenseDate: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Mode de paiement</label>
                  <select className={INPUT} value={form.paymentMethod} onChange={(e) => setF({ paymentMethod: e.target.value })}>
                    <option value="">—</option>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Note (optionnel)</label>
                <textarea className={INPUT} rows={2} value={form.note} onChange={(e) => setF({ note: e.target.value })} />
              </div>
            </div>
            <button onClick={submit} disabled={busy} className={`w-full mt-4 py-2.5 rounded-xl ${BTN_GOLD}`}>
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
