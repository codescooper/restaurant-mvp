import { useEffect, useState } from 'react';
import { Plus, Trash2, X, Receipt, CheckCircle } from 'lucide-react';
import { supplierApi, stockApi } from '../../services/endpoints';
import { getApiError } from '../../services/api';
import { Supplier, StockItem } from '../../types';
import { formatFCFA, formatDateTime } from '../../utils/format';

const PANEL = 'bg-neutral-950 border border-neutral-800 ring-1 ring-white/5 rounded-2xl';
const INPUT =
  'w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400';
const OVERLAY = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50';
const MODAL = 'bg-neutral-950 border border-neutral-800 ring-1 ring-white/10 rounded-2xl shadow-2xl shadow-black/60 w-full p-6 max-h-[90vh] overflow-y-auto';
const BTN_GOLD = 'bg-gold-400 hover:bg-gold-300 text-black font-bold transition disabled:opacity-40';

export default function SuppliersTab() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'supplier' | 'purchase' | null>(null);
  const [detail, setDetail] = useState<Supplier | null>(null);

  const [sForm, setSForm] = useState({ name: '', phone: '', contact: '', note: '' });
  const [pForm, setPForm] = useState({ supplierId: 0, stockItemId: 0, quantity: '', unitPrice: '', dueDate: '', isPaid: false });
  const [busy, setBusy] = useState(false);

  const load = () => supplierApi.list().then(setSuppliers).catch((e) => setError(getApiError(e)));

  useEffect(() => {
    load();
    stockApi.list().then(setStock).catch(() => {});
  }, []);

  const openSupplier = () => {
    setSForm({ name: '', phone: '', contact: '', note: '' });
    setModal('supplier');
    setError('');
  };
  const openPurchase = () => {
    setPForm({ supplierId: suppliers[0]?.id ?? 0, stockItemId: stock[0]?.id ?? 0, quantity: '', unitPrice: '', dueDate: '', isPaid: false });
    setModal('purchase');
    setError('');
  };

  const submitSupplier = async () => {
    if (!sForm.name.trim()) {
      setError('Le nom du fournisseur est requis');
      return;
    }
    setBusy(true);
    try {
      await supplierApi.create({ name: sForm.name, phone: sForm.phone || undefined, contact: sForm.contact || undefined, note: sForm.note || undefined });
      setModal(null);
      load();
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const submitPurchase = async () => {
    const qty = Number(pForm.quantity);
    const price = Number(pForm.unitPrice);
    if (!pForm.supplierId || !pForm.stockItemId || qty <= 0) {
      setError('Fournisseur, article et quantité requis');
      return;
    }
    setBusy(true);
    try {
      await supplierApi.createPurchase({
        supplierId: pForm.supplierId,
        stockItemId: pForm.stockItemId,
        quantity: qty,
        unitPrice: price || 0,
        dueDate: pForm.dueDate || undefined,
        isPaid: pForm.isPaid,
      });
      setModal(null);
      load();
      stockApi.list().then(setStock).catch(() => {});
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (id: number) => {
    try {
      setDetail(await supplierApi.get(id));
    } catch (e) {
      setError(getApiError(e));
    }
  };

  const payPurchase = async (id: number) => {
    try {
      await supplierApi.payPurchase(id);
      if (detail) setDetail(await supplierApi.get(detail.id));
      load();
    } catch (e) {
      setError(getApiError(e));
    }
  };

  const removeSupplier = async (id: number) => {
    if (!window.confirm('Supprimer ce fournisseur et ses achats ?')) return;
    try {
      await supplierApi.remove(id);
      load();
    } catch (e) {
      setError(getApiError(e));
    }
  };

  const totalPrice = (Number(pForm.quantity) || 0) * (Number(pForm.unitPrice) || 0);

  return (
    <div>
      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 mb-4 text-sm">{error}</div>}

      <div className="flex justify-end gap-2 mb-4">
        <button onClick={openPurchase} className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-100 border border-neutral-700 px-4 py-2 rounded-lg font-medium">
          <Receipt className="w-5 h-5" /> Nouvel achat
        </button>
        <button onClick={openSupplier} className={`flex items-center gap-2 px-4 py-2 rounded-lg ${BTN_GOLD}`}>
          <Plus className="w-5 h-5" /> Fournisseur
        </button>
      </div>

      <div className={`${PANEL} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-neutral-300">
            <tr>
              <th className="text-left p-3">Fournisseur</th>
              <th className="text-left p-3">Téléphone</th>
              <th className="text-left p-3">Contact</th>
              <th className="text-right p-3">Dette</th>
              <th className="text-right p-3"></th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="border-t hover:bg-neutral-900">
                <td className="p-3 font-medium text-neutral-100">{s.name}</td>
                <td className="p-3 text-neutral-400">{s.phone || '—'}</td>
                <td className="p-3 text-neutral-400">{s.contact || '—'}</td>
                <td className={`p-3 text-right font-semibold ${s.debt ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {formatFCFA(s.debt ?? 0)}
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button onClick={() => openDetail(s.id)} className="text-gold-400 hover:underline text-xs mr-3">
                    Achats
                  </button>
                  <button onClick={() => removeSupplier(s.id)} className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-neutral-500">
                  Aucun fournisseur
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal nouveau fournisseur */}
      {modal === 'supplier' && (
        <div className={OVERLAY}>
          <div className={`${MODAL} max-w-md`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-neutral-100">Nouveau fournisseur</h3>
              <button onClick={() => setModal(null)} className="text-neutral-500 hover:text-neutral-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-2 mb-3 text-sm">{error}</div>}
            <div className="space-y-3">
              <input className={INPUT} placeholder="Nom" value={sForm.name} onChange={(e) => setSForm({ ...sForm, name: e.target.value })} autoFocus />
              <input className={INPUT} placeholder="Téléphone (optionnel)" value={sForm.phone} onChange={(e) => setSForm({ ...sForm, phone: e.target.value })} />
              <input className={INPUT} placeholder="Contact / personne (optionnel)" value={sForm.contact} onChange={(e) => setSForm({ ...sForm, contact: e.target.value })} />
              <textarea className={INPUT} placeholder="Note (optionnel)" rows={2} value={sForm.note} onChange={(e) => setSForm({ ...sForm, note: e.target.value })} />
            </div>
            <button onClick={submitSupplier} disabled={busy} className={`w-full mt-4 py-2.5 rounded-xl ${BTN_GOLD}`}>
              Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* Modal nouvel achat */}
      {modal === 'purchase' && (
        <div className={OVERLAY}>
          <div className={`${MODAL} max-w-md`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-neutral-100">Nouvel achat</h3>
              <button onClick={() => setModal(null)} className="text-neutral-500 hover:text-neutral-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-2 mb-3 text-sm">{error}</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Fournisseur</label>
                <select className={INPUT} value={pForm.supplierId} onChange={(e) => setPForm({ ...pForm, supplierId: Number(e.target.value) })}>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Article</label>
                <select className={INPUT} value={pForm.stockItemId} onChange={(e) => setPForm({ ...pForm, stockItemId: Number(e.target.value) })}>
                  {stock.map((it) => (
                    <option key={it.id} value={it.id}>{it.name} ({it.unit})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Quantité</label>
                  <input type="number" min="0" step="0.01" className={INPUT} value={pForm.quantity} onChange={(e) => setPForm({ ...pForm, quantity: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Prix unitaire (FCFA)</label>
                  <input type="number" min="0" className={INPUT} value={pForm.unitPrice} onChange={(e) => setPForm({ ...pForm, unitPrice: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-between text-sm bg-neutral-900 border border-neutral-800 rounded-lg p-2">
                <span className="text-neutral-400">Total</span>
                <span className="text-gold-400 font-bold">{formatFCFA(totalPrice)}</span>
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Échéance (optionnel)</label>
                <input type="date" className={INPUT} value={pForm.dueDate} onChange={(e) => setPForm({ ...pForm, dueDate: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm text-neutral-200">
                <input type="checkbox" checked={pForm.isPaid} onChange={(e) => setPForm({ ...pForm, isPaid: e.target.checked })} />
                Déjà payé
              </label>
            </div>
            <button onClick={submitPurchase} disabled={busy} className={`w-full mt-4 py-2.5 rounded-xl ${BTN_GOLD}`}>
              Enregistrer l'achat (réappro. stock)
            </button>
          </div>
        </div>
      )}

      {/* Détail fournisseur : achats + dette */}
      {detail && (
        <div className={OVERLAY}>
          <div className={`${MODAL} max-w-lg`}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold text-neutral-100">{detail.name}</h3>
              <button onClick={() => setDetail(null)} className="text-neutral-500 hover:text-neutral-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex justify-between bg-neutral-900 border border-neutral-800 rounded-lg p-2 mb-3 text-sm">
              <span className="text-neutral-400">Dette en cours</span>
              <span className={`font-bold ${detail.debt ? 'text-rose-400' : 'text-emerald-400'}`}>{formatFCFA(detail.debt ?? 0)}</span>
            </div>
            <h4 className="text-sm font-semibold text-neutral-300 mb-1">Achats ({detail.purchases?.length ?? 0})</h4>
            <div className="space-y-2">
              {(detail.purchases ?? []).map((p) => (
                <div key={p.id} className="bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-100">
                      {p.quantity} {p.stockItem?.unit} {p.stockItem?.name}
                    </span>
                    <span className="text-gold-400 font-semibold">{formatFCFA(p.totalPrice)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1 text-xs text-neutral-400">
                    <span>
                      {formatDateTime(p.createdAt)}
                      {p.dueDate ? ` · échéance ${new Date(p.dueDate).toLocaleDateString('fr-FR')}` : ''}
                    </span>
                    {p.isPaid ? (
                      <span className="text-emerald-300 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Payé
                      </span>
                    ) : (
                      <button onClick={() => payPurchase(p.id)} className="text-gold-400 hover:underline">
                        Marquer payé
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {(detail.purchases ?? []).length === 0 && <p className="text-neutral-500 text-sm">Aucun achat</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
