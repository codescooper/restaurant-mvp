import { useState } from 'react';
import { X, Download, FileSpreadsheet } from 'lucide-react';
import { payrollApi } from '../../services/endpoints';
import { getApiError } from '../../services/api';

const INPUT =
  'w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400';
const OVERLAY = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50';
const MODAL =
  'bg-neutral-950 border border-neutral-800 ring-1 ring-white/10 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-md p-6';
const BTN_GOLD = 'bg-gold-400 hover:bg-gold-300 text-black font-bold transition disabled:opacity-40';

export default function DisaModal({ onClose }: { onClose: () => void }) {
  const currentYear = new Date().getFullYear();
  // Années proposées : l'année en cours et les 4 précédentes.
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const [year, setYear] = useState(currentYear);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const download = async () => {
    setBusy(true);
    setError('');
    try {
      const blob = await payrollApi.disa(year);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `disa-${year}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={OVERLAY}>
      <div className={MODAL}>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-gold-400" /> Déclaration DISA
          </h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-neutral-500 mb-4">
          Déclaration Individuelle des Salaires Annuels (CNPS), un employé par ligne (ceux ayant travaillé dans l’année).
          Export CSV à vérifier / charger dans le modèle e-DISA officiel de la CNPS. Pense à renseigner le n° employeur CNPS
          dans « Paramètres de paie ».
        </p>

        {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-2 mb-3 text-sm">{error}</div>}

        <label className="block text-xs text-neutral-400 mb-1">Année de déclaration</label>
        <select className={`${INPUT} mb-4`} value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>

        <button onClick={download} disabled={busy} className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-2 ${BTN_GOLD}`}>
          <Download className="w-5 h-5" /> {busy ? 'Génération…' : `Télécharger la DISA ${year} (CSV)`}
        </button>
      </div>
    </div>
  );
}
