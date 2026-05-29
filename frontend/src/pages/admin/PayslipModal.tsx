import { useEffect, useState } from 'react';
import { X, Download, FileText } from 'lucide-react';
import { payrollApi, PayslipResult } from '../../services/endpoints';
import { getApiError } from '../../services/api';
import { Employee } from '../../types';
import { formatFCFA } from '../../utils/format';

const INPUT =
  'w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400';
const OVERLAY = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50';
const MODAL =
  'bg-neutral-950 border border-neutral-800 ring-1 ring-white/10 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto';
const BTN_GOLD = 'bg-gold-400 hover:bg-gold-300 text-black font-bold transition disabled:opacity-40';

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export default function PayslipModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [gross, setGross] = useState(employee.salary != null ? String(employee.salary) : '');
  const [preview, setPreview] = useState<PayslipResult | null>(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  const grossNum = gross !== '' ? Number(gross) : 0;

  // Aperçu live (débounce) : recalcul côté serveur avec la config enregistrée.
  useEffect(() => {
    if (!grossNum || grossNum <= 0) {
      setPreview(null);
      return;
    }
    const t = setTimeout(() => {
      payrollApi.preview(grossNum).then(setPreview).catch((e) => setError(getApiError(e)));
    }, 350);
    return () => clearTimeout(t);
  }, [grossNum]);

  const download = async () => {
    if (!grossNum || grossNum <= 0) {
      setError('Renseignez un salaire brut.');
      return;
    }
    setDownloading(true);
    setError('');
    try {
      const blob = await payrollApi.payslip({ employeeId: employee.id, year, month, grossSalary: grossNum });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bulletin-${employee.firstName}-${employee.lastName}-${MONTHS[month - 1]}-${year}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={OVERLAY}>
      <div className={MODAL}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gold-400" /> Bulletin de paie — {employee.firstName} {employee.lastName}
          </h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-2 mb-3 text-sm">{error}</div>}

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Mois</label>
            <select className={INPUT} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Année</label>
            <input type="number" min="2000" max="2100" className={INPUT} value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Salaire brut (FCFA)</label>
            <input type="number" min="0" className={INPUT} value={gross} onChange={(e) => setGross(e.target.value)} placeholder="ex. 200000" />
          </div>
        </div>

        {preview ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-sm">
            <Row label="Salaire brut" value={formatFCFA(preview.grossSalary)} strong />
            <div className="mt-3 mb-1 text-xs font-semibold text-gold-400 uppercase tracking-wide">Retenues salariales</div>
            {preview.employeeLines.map((l) => (
              <Row key={l.key} label={`${l.label}${l.rate > 0 ? ` (${l.rate} %)` : ''}`} value={`- ${formatFCFA(l.amount)}`} muted />
            ))}
            {preview.its > 0 && <Row label="Impôt sur salaire (ITS)" value={`- ${formatFCFA(preview.its)}`} muted />}
            <Row label="Total retenues" value={`- ${formatFCFA(preview.totalEmployee)}`} />
            <div className="border-t border-neutral-800 my-2" />
            <Row label="NET À PAYER" value={formatFCFA(preview.netSalary)} strong accent />
            <div className="mt-3 mb-1 text-xs font-semibold text-neutral-400 uppercase tracking-wide">Charges patronales</div>
            {preview.employerLines.map((l) => (
              <Row key={l.key} label={`${l.label}${l.rate > 0 ? ` (${l.rate} %)` : ''}`} value={formatFCFA(l.amount)} muted />
            ))}
            <Row label="Total charges patronales" value={formatFCFA(preview.totalEmployer)} />
            <Row label="Coût total employeur" value={formatFCFA(preview.employerCost)} strong />
          </div>
        ) : (
          <div className="bg-neutral-900 border border-dashed border-neutral-800 rounded-xl p-6 text-center text-neutral-500 text-sm">
            Saisissez un salaire brut pour afficher l’aperçu.
          </div>
        )}

        <button onClick={download} disabled={downloading || !preview} className={`w-full mt-4 py-2.5 rounded-xl flex items-center justify-center gap-2 ${BTN_GOLD}`}>
          <Download className="w-5 h-5" /> {downloading ? 'Génération…' : 'Télécharger le bulletin PDF'}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, strong, muted, accent }: { label: string; value: string; strong?: boolean; muted?: boolean; accent?: boolean }) {
  return (
    <div className="flex justify-between items-baseline py-0.5">
      <span className={`${muted ? 'text-neutral-400' : 'text-neutral-200'} ${strong ? 'font-bold' : ''}`}>{label}</span>
      <span className={`tabular-nums ${accent ? 'text-emerald-400 font-bold text-base' : strong ? 'text-neutral-100 font-bold' : 'text-neutral-300'}`}>{value}</span>
    </div>
  );
}
