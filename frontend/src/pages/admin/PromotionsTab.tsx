import { useEffect, useState } from 'react';
import { Trash2, X, Clock, Ticket, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { promotionApi, settingsApi } from '../../services/endpoints';
import { getApiError } from '../../services/api';
import { Promotion } from '../../types';
import { formatFCFA } from '../../utils/format';

const PANEL = 'bg-neutral-950 border border-neutral-800 ring-1 ring-white/5 rounded-2xl';
const INPUT =
  'w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400';
const OVERLAY = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50';
const MODAL = 'bg-neutral-950 border border-neutral-800 ring-1 ring-white/10 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-md p-6';
const BTN_GOLD = 'bg-gold-400 hover:bg-gold-300 text-black font-bold transition disabled:opacity-40';
const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']; // 1..7

export default function PromotionsTab() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [maxDiscount, setMaxDiscount] = useState<number>(100);
  const [maxInput, setMaxInput] = useState('');
  const [pinConfigured, setPinConfigured] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [modal, setModal] = useState<'happy_hour' | 'coupon' | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    name: '',
    discountType: 'percent' as 'percent' | 'amount',
    discountValue: '',
    startHour: '17',
    endHour: '19',
    days: [] as number[],
    code: '',
    maxUses: '',
  });

  const load = () => {
    promotionApi.list().then(setPromos).catch((e) => setError(getApiError(e)));
    settingsApi.getMaxDiscount().then((v) => { setMaxDiscount(v); setMaxInput(String(v)); }).catch(() => {});
    settingsApi.getManagerPinStatus().then(setPinConfigured).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const open = (kind: 'happy_hour' | 'coupon') => {
    setForm({ name: '', discountType: 'percent', discountValue: '', startHour: '17', endHour: '19', days: [], code: '', maxUses: '' });
    setError('');
    setModal(kind);
  };

  const toggleDay = (d: number) =>
    setForm((f) => ({ ...f, days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d] }));

  const submit = async () => {
    const value = Number(form.discountValue);
    if (!form.name.trim() || !value) { setError('Nom et valeur de remise requis'); return; }
    if (modal === 'coupon' && !form.code.trim()) { setError('Code coupon requis'); return; }
    setBusy(true);
    setError('');
    try {
      const payload: Partial<Promotion> = {
        name: form.name.trim(),
        kind: modal!,
        discountType: form.discountType,
        discountValue: value,
      };
      if (modal === 'happy_hour') {
        payload.startHour = Number(form.startHour);
        payload.endHour = Number(form.endHour);
        payload.days = form.days.length ? form.days.sort().join(',') : undefined;
      } else {
        payload.code = form.code.trim().toUpperCase();
        if (form.maxUses) payload.maxUses = Number(form.maxUses);
      }
      await promotionApi.create(payload);
      setModal(null);
      load();
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (p: Promotion) => {
    try { await promotionApi.update(p.id, { isActive: !p.isActive }); load(); } catch (e) { setError(getApiError(e)); }
  };
  const remove = async (id: number) => {
    if (!window.confirm('Supprimer cette promotion ?')) return;
    try { await promotionApi.remove(id); load(); } catch (e) { setError(getApiError(e)); }
  };

  const saveMax = async () => {
    const v = Number(maxInput);
    if (v < 0 || v > 100) { setError('Plafond entre 0 et 100'); return; }
    try { await settingsApi.setMaxDiscount(v); setMaxDiscount(v); } catch (e) { setError(getApiError(e)); }
  };

  const savePin = async () => {
    const v = pinInput.trim();
    if (!v) { setError('Saisir un code (ou utiliser « Désactiver »)'); return; }
    try { const configured = await settingsApi.setManagerPin(v); setPinConfigured(configured); setPinInput(''); } catch (e) { setError(getApiError(e)); }
  };
  const clearPin = async () => {
    if (!window.confirm('Désactiver le code manager ? Annulations et remboursements ne seront plus protégés.')) return;
    try { const configured = await settingsApi.setManagerPin(''); setPinConfigured(configured); setPinInput(''); } catch (e) { setError(getApiError(e)); }
  };

  const discountLabel = (p: Promotion) => (p.discountType === 'percent' ? `-${p.discountValue}%` : `-${formatFCFA(p.discountValue)}`);
  const daysLabel = (csv?: string | null) => {
    if (!csv) return 'tous les jours';
    return csv.split(',').map((d) => DAY_LABELS[Number(d) - 1] ?? d).join(' ');
  };

  return (
    <div>
      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 mb-4 text-sm">{error}</div>}

      {/* Plafond de remise */}
      <div className={`${PANEL} p-4 mb-4 flex flex-wrap items-center gap-3`}>
        <span className="text-sm text-neutral-300">Plafond de remise manuelle</span>
        <input
          type="number"
          min="0"
          max="100"
          value={maxInput}
          onChange={(e) => setMaxInput(e.target.value)}
          className="w-24 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-neutral-100 outline-none focus:ring-2 focus:ring-gold-400/60"
        />
        <span className="text-neutral-400 text-sm">%</span>
        <button onClick={saveMax} className={`px-3 py-1.5 rounded-lg text-sm ${BTN_GOLD}`}>Enregistrer</button>
        <span className="text-xs text-neutral-500">Actuel : {maxDiscount}% (au-delà, remise refusée)</span>
      </div>

      {/* Code manager : exigé du caissier pour annuler / rembourser une commande */}
      <div className={`${PANEL} p-4 mb-4 flex flex-wrap items-center gap-3`}>
        <span className="flex items-center gap-1.5 text-sm text-neutral-300">
          <ShieldCheck className="w-4 h-4 text-gold-400" /> Code manager
        </span>
        <input
          type="password"
          inputMode="numeric"
          value={pinInput}
          onChange={(e) => setPinInput(e.target.value)}
          placeholder={pinConfigured ? 'Nouveau code' : 'Définir un code'}
          className="w-40 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-gold-400/60"
        />
        <button onClick={savePin} className={`px-3 py-1.5 rounded-lg text-sm ${BTN_GOLD}`}>Enregistrer</button>
        {pinConfigured && (
          <button onClick={clearPin} className="px-3 py-1.5 rounded-lg text-sm bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-rose-300">
            Désactiver
          </button>
        )}
        <span className={`text-xs ${pinConfigured ? 'text-emerald-400' : 'text-neutral-500'}`}>
          {pinConfigured
            ? 'Actif : le caissier doit saisir ce code pour annuler/rembourser (l\'admin en est dispensé).'
            : 'Inactif : annulations et remboursements libres tant qu\'aucun code n\'est défini.'}
        </span>
      </div>

      <div className="flex justify-end gap-2 mb-4">
        <button onClick={() => open('happy_hour')} className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-100 border border-neutral-700 px-4 py-2 rounded-lg font-medium">
          <Clock className="w-5 h-5 text-gold-400" /> Happy hour
        </button>
        <button onClick={() => open('coupon')} className={`flex items-center gap-2 px-4 py-2 rounded-lg ${BTN_GOLD}`}>
          <Ticket className="w-5 h-5" /> Coupon
        </button>
      </div>

      <div className={`${PANEL} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-neutral-300">
            <tr>
              <th className="text-left p-3">Nom</th>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Remise</th>
              <th className="text-left p-3">Détails</th>
              <th className="text-left p-3">Statut</th>
              <th className="text-right p-3"></th>
            </tr>
          </thead>
          <tbody>
            {promos.map((p) => (
              <tr key={p.id} className="border-t hover:bg-neutral-900">
                <td className="p-3 font-medium text-neutral-100">{p.name}</td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.kind === 'happy_hour' ? 'bg-gold-400/15 text-gold-300' : 'bg-sky-500/15 text-sky-300'}`}>
                    {p.kind === 'happy_hour' ? 'Happy hour' : 'Coupon'}
                  </span>
                </td>
                <td className="p-3 text-gold-400 font-semibold">{discountLabel(p)}</td>
                <td className="p-3 text-neutral-400 text-xs">
                  {p.kind === 'happy_hour'
                    ? `${p.startHour}h–${p.endHour}h · ${daysLabel(p.days)}`
                    : `Code ${p.code}${p.maxUses ? ` · ${p.usedCount}/${p.maxUses}` : ` · ${p.usedCount} util.`}`}
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${p.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-neutral-800 text-neutral-400'}`}>
                    {p.isActive ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button onClick={() => toggleActive(p)} className="p-1.5 text-neutral-300 hover:bg-neutral-800 rounded" title={p.isActive ? 'Désactiver' : 'Activer'}>
                    {p.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button onClick={() => remove(p.id)} className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {promos.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-neutral-500">Aucune promotion</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className={OVERLAY}>
          <div className={MODAL}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
                {modal === 'happy_hour' ? <Clock className="w-5 h-5 text-gold-400" /> : <Ticket className="w-5 h-5 text-sky-300" />}
                {modal === 'happy_hour' ? 'Nouvelle happy hour' : 'Nouveau coupon'}
              </h3>
              <button onClick={() => setModal(null)} className="text-neutral-500 hover:text-neutral-300"><X className="w-5 h-5" /></button>
            </div>
            {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-2 mb-3 text-sm">{error}</div>}
            <div className="space-y-3">
              <input className={INPUT} placeholder="Nom (ex. Happy hour soir)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
              {modal === 'coupon' && (
                <input className={INPUT} placeholder="Code (ex. BIENVENUE)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              )}
              <div className="grid grid-cols-2 gap-2">
                <select className={INPUT} value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as 'percent' | 'amount' })}>
                  <option value="percent">Pourcentage (%)</option>
                  <option value="amount">Montant (FCFA)</option>
                </select>
                <input type="number" min="1" className={INPUT} placeholder="Valeur" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} />
              </div>
              {modal === 'happy_hour' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Heure début</label>
                      <input type="number" min="0" max="23" className={INPUT} value={form.startHour} onChange={(e) => setForm({ ...form, startHour: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Heure fin</label>
                      <input type="number" min="0" max="24" className={INPUT} value={form.endHour} onChange={(e) => setForm({ ...form, endHour: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Jours (vide = tous)</label>
                    <div className="flex gap-1">
                      {DAY_LABELS.map((lbl, i) => {
                        const d = i + 1;
                        const on = form.days.includes(d);
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => toggleDay(d)}
                            className={`w-9 h-9 rounded-lg text-sm font-medium border transition ${on ? 'bg-gold-400 text-black border-gold-400' : 'bg-neutral-900 text-neutral-300 border-neutral-700'}`}
                          >
                            {lbl}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
              {modal === 'coupon' && (
                <input type="number" min="1" className={INPUT} placeholder="Limite d'utilisations (optionnel)" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} />
              )}
            </div>
            <button onClick={submit} disabled={busy} className={`w-full mt-4 py-2.5 rounded-xl ${BTN_GOLD}`}>Enregistrer</button>
          </div>
        </div>
      )}
    </div>
  );
}
