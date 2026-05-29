import { useEffect, useState } from 'react';
import { X, Plus, Trash2, Save, Sliders } from 'lucide-react';
import { payrollApi, PayrollConfig, ContributionRate } from '../../services/endpoints';
import { getApiError } from '../../services/api';

const INPUT =
  'w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5 text-neutral-100 text-sm placeholder-neutral-500 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400';
const OVERLAY = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50';
const MODAL =
  'bg-neutral-950 border border-neutral-800 ring-1 ring-white/10 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto';
const BTN_GOLD = 'bg-gold-400 hover:bg-gold-300 text-black font-bold transition disabled:opacity-40';

type Branch = 'retraite' | 'prestationsFamiliales' | 'maternite' | 'accidentTravail';
const BRANCH_LABELS: Record<Branch, string> = {
  retraite: 'Retraite / Pension',
  prestationsFamiliales: 'Prestations familiales',
  maternite: 'Assurance maternité',
  accidentTravail: 'Accident du travail',
};

// number|null -> string pour input ; '' = null (pas de plafond)
const numStr = (v: number | null) => (v == null ? '' : String(v));

export default function PayrollSettingsModal({ onClose }: { onClose: () => void }) {
  const [cfg, setCfg] = useState<PayrollConfig | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    payrollApi.getConfig().then(setCfg).catch((e) => setError(getApiError(e)));
  }, []);

  if (!cfg) {
    return (
      <div className={OVERLAY}>
        <div className={MODAL}>
          {error ? <div className="text-rose-300 text-sm">{error}</div> : <div className="text-neutral-400 text-sm">Chargement…</div>}
        </div>
      </div>
    );
  }

  const setRate = (branch: Branch, field: keyof ContributionRate, raw: string) => {
    const value = field === 'ceiling' ? (raw === '' ? null : Number(raw)) : Number(raw);
    setCfg((c) => (c ? { ...c, [branch]: { ...c[branch], [field]: value } } : c));
    setSaved(false);
  };

  const setNum = (key: 'cmuEmployee' | 'cmuEmployer', raw: string) => {
    setCfg((c) => (c ? { ...c, [key]: raw === '' ? 0 : Number(raw) } : c));
    setSaved(false);
  };

  const setItsEnabled = (enabled: boolean) => {
    setCfg((c) => (c ? { ...c, its: { ...c.its, enabled } } : c));
    setSaved(false);
  };

  const setBracket = (i: number, field: 'upTo' | 'rate', raw: string) => {
    setCfg((c) => {
      if (!c) return c;
      const brackets = c.its.brackets.map((b, idx) =>
        idx === i ? { ...b, [field]: field === 'upTo' ? (raw === '' ? null : Number(raw)) : Number(raw) } : b
      );
      return { ...c, its: { ...c.its, brackets } };
    });
    setSaved(false);
  };

  const addBracket = () =>
    setCfg((c) => (c ? { ...c, its: { ...c.its, brackets: [...c.its.brackets, { upTo: 0, rate: 0 }] } } : c));

  const removeBracket = (i: number) =>
    setCfg((c) => (c ? { ...c, its: { ...c.its, brackets: c.its.brackets.filter((_, idx) => idx !== i) } } : c));

  const save = async () => {
    if (!cfg) return;
    setBusy(true);
    setError('');
    try {
      const next = await payrollApi.setConfig(cfg);
      setCfg(next);
      setSaved(true);
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={OVERLAY}>
      <div className={MODAL}>
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-gold-400" /> Paramètres de paie (CNPS)
          </h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-neutral-500 mb-4">
          Taux et plafonds ajustables (l’accident du travail varie 2–5 % selon le secteur). Valeurs par défaut : CNPS Côte d’Ivoire.
        </p>

        {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-2 mb-3 text-sm">{error}</div>}

        {/* Cotisations */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-neutral-400 text-xs">
              <tr>
                <th className="text-left pb-2">Cotisation</th>
                <th className="text-right pb-2 px-2">Salarié %</th>
                <th className="text-right pb-2 px-2">Patronal %</th>
                <th className="text-right pb-2 px-2">Plafond/mois</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(BRANCH_LABELS) as Branch[]).map((b) => (
                <tr key={b} className="border-t border-neutral-800">
                  <td className="py-2 text-neutral-200">{BRANCH_LABELS[b]}</td>
                  <td className="py-2 px-2 w-20">
                    <input type="number" step="0.01" min="0" className={`${INPUT} text-right`} value={cfg[b].employee} onChange={(e) => setRate(b, 'employee', e.target.value)} />
                  </td>
                  <td className="py-2 px-2 w-20">
                    <input type="number" step="0.01" min="0" className={`${INPUT} text-right`} value={cfg[b].employer} onChange={(e) => setRate(b, 'employer', e.target.value)} />
                  </td>
                  <td className="py-2 px-2 w-28">
                    <input type="number" min="0" placeholder="aucun" className={`${INPUT} text-right`} value={numStr(cfg[b].ceiling)} onChange={(e) => setRate(b, 'ceiling', e.target.value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* CMU */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">CMU salarié (FCFA/mois)</label>
            <input type="number" min="0" className={INPUT} value={cfg.cmuEmployee} onChange={(e) => setNum('cmuEmployee', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">CMU patronal (FCFA/mois)</label>
            <input type="number" min="0" className={INPUT} value={cfg.cmuEmployer} onChange={(e) => setNum('cmuEmployer', e.target.value)} />
          </div>
        </div>

        {/* ITS */}
        <div className="mt-5 border-t border-neutral-800 pt-4">
          <label className="flex items-center gap-2 text-sm text-neutral-200 mb-1">
            <input type="checkbox" checked={cfg.its.enabled} onChange={(e) => setItsEnabled(e.target.checked)} />
            Activer la retenue ITS (impôt sur salaire)
          </label>
          <p className="text-xs text-neutral-500 mb-3">
            Barème mensuel par tranche. Laissez « Jusqu’à » vide pour la tranche supérieure. À vérifier selon le barème DGI en vigueur.
          </p>
          {cfg.its.brackets.map((br, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <span className="text-xs text-neutral-500 w-16">Jusqu’à</span>
              <input type="number" min="0" placeholder="∞ (sup.)" className={`${INPUT} flex-1`} value={br.upTo == null ? '' : br.upTo} onChange={(e) => setBracket(i, 'upTo', e.target.value)} />
              <span className="text-xs text-neutral-500">Taux %</span>
              <input type="number" step="0.01" min="0" max="100" className={`${INPUT} w-24`} value={br.rate} onChange={(e) => setBracket(i, 'rate', e.target.value)} />
              <button onClick={() => removeBracket(i)} className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded" title="Retirer">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button onClick={addBracket} className="text-xs text-gold-400 flex items-center gap-1 mt-1">
            <Plus className="w-4 h-4" /> Ajouter une tranche
          </button>
        </div>

        <div className="flex items-center gap-3 mt-5">
          <button onClick={save} disabled={busy} className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 ${BTN_GOLD}`}>
            <Save className="w-5 h-5" /> {busy ? 'Enregistrement…' : 'Enregistrer les paramètres'}
          </button>
          {saved && <span className="text-emerald-400 text-sm">Enregistré ✓</span>}
        </div>
      </div>
    </div>
  );
}
