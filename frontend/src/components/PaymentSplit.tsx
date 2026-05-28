import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';

export interface PaymentLine {
  method: string;
  amount: number;
  mobileMoneyProvider?: string;
  cashGiven?: number;
  changeReturned?: number;
}

interface PaymentSplitState {
  payments: PaymentLine[];
  valid: boolean;
}

interface Props {
  due: number;
  onChange: (state: PaymentSplitState) => void;
}

type Method = 'espèces' | 'mobile_money' | 'carte' | 'virement' | 'qr_code';
type Provider = 'orange_money' | 'wave' | 'mtn';

const METHOD_LABELS: Record<Method, string> = {
  espèces: 'Espèces',
  mobile_money: 'Mobile Money',
  carte: 'Carte',
  virement: 'Virement',
  qr_code: 'QR Code',
};

const PROVIDER_LABELS: Record<Provider, string> = {
  orange_money: 'Orange Money',
  wave: 'Wave',
  mtn: 'MTN',
};

const METHODS: Method[] = ['espèces', 'mobile_money', 'carte', 'virement', 'qr_code'];
const PROVIDERS: Provider[] = ['orange_money', 'wave', 'mtn'];

interface InternalLine {
  method: Method;
  amountStr: string;
  provider: Provider | '';
  cashGivenStr: string;
}

function lineToPayment(line: InternalLine): PaymentLine {
  const amount = Math.round(Number(line.amountStr) || 0);
  const cashGiven = line.method === 'espèces' && line.cashGivenStr !== '' ? Math.round(Number(line.cashGivenStr) || 0) : undefined;
  const changeReturned = cashGiven !== undefined ? Math.max(0, cashGiven - amount) : undefined;
  return {
    method: line.method,
    amount,
    mobileMoneyProvider: line.method === 'mobile_money' && line.provider ? line.provider : undefined,
    cashGiven,
    changeReturned,
  };
}

function computeValid(lines: InternalLine[], due: number): boolean {
  if (lines.length === 0) return false;
  const total = lines.reduce((s, l) => s + Math.round(Number(l.amountStr) || 0), 0);
  if (total !== due) return false;
  for (const l of lines) {
    const amount = Math.round(Number(l.amountStr) || 0);
    if (amount <= 0) return false;
    if (l.method === 'mobile_money' && !l.provider) return false;
    if (l.method === 'espèces' && l.cashGivenStr !== '') {
      const given = Math.round(Number(l.cashGivenStr) || 0);
      if (given < amount) return false;
    }
  }
  return true;
}

const INPUT = 'w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400 text-sm';

export default function PaymentSplit({ due, onChange }: Props) {
  const [lines, setLines] = useState<InternalLine[]>([
    { method: 'espèces', amountStr: String(due), provider: '', cashGivenStr: '' },
  ]);

  // When due changes, if there's only one line and it hasn't been manually edited, reset to due.
  useEffect(() => {
    setLines([{ method: 'espèces', amountStr: String(due), provider: '', cashGivenStr: '' }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [due]);

  const notify = (next: InternalLine[]) => {
    const payments = next.map(lineToPayment);
    const valid = computeValid(next, due);
    onChange({ payments, valid });
  };

  const update = (idx: number, patch: Partial<InternalLine>) => {
    setLines((prev) => {
      const next = prev.map((l, i) => (i === idx ? { ...l, ...patch } : l));
      notify(next);
      return next;
    });
  };

  const addLine = () => {
    if (lines.length >= 5) return;
    const allocated = lines.reduce((s, l) => s + Math.round(Number(l.amountStr) || 0), 0);
    const remaining = Math.max(0, due - allocated);
    const next: InternalLine[] = [...lines, { method: 'espèces', amountStr: String(remaining), provider: '', cashGivenStr: '' }];
    setLines(next);
    notify(next);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 1) return;
    const next = lines.filter((_, i) => i !== idx);
    setLines(next);
    notify(next);
  };

  const totalAllocated = lines.reduce((s, l) => s + Math.round(Number(l.amountStr) || 0), 0);
  const remaining = due - totalAllocated;

  return (
    <div className="space-y-3">
      {lines.map((line, idx) => {
        const amount = Math.round(Number(line.amountStr) || 0);
        const cashGiven = line.cashGivenStr !== '' ? Math.round(Number(line.cashGivenStr) || 0) : undefined;
        const changeVal = cashGiven !== undefined ? cashGiven - amount : undefined;

        return (
          <div key={idx} className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gold-400 uppercase tracking-wide">Moyen {idx + 1}</span>
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(idx)}
                  className="text-neutral-500 hover:text-rose-400 transition"
                  title="Retirer ce moyen"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Method selector */}
            <div className="grid grid-cols-3 gap-1.5">
              {METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => update(idx, { method: m, provider: '' })}
                  className={`py-1.5 rounded-lg text-xs font-medium border-2 transition ${
                    line.method === m
                      ? 'border-gold-400 bg-gold-400/10 text-gold-300'
                      : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
                  }`}
                >
                  {METHOD_LABELS[m]}
                </button>
              ))}
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Montant (FCFA)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={line.amountStr}
                onChange={(e) => update(idx, { amountStr: e.target.value })}
                className={INPUT}
                placeholder="0"
              />
            </div>

            {/* Mobile money provider */}
            {line.method === 'mobile_money' && (
              <div className="grid grid-cols-3 gap-1.5">
                {PROVIDERS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => update(idx, { provider: p })}
                    className={`py-1.5 rounded-lg text-xs font-medium border-2 transition ${
                      line.provider === p
                        ? p === 'orange_money'
                          ? 'border-orange-500 bg-orange-500/10 text-orange-300'
                          : p === 'wave'
                            ? 'border-sky-500 bg-sky-500/10 text-sky-300'
                            : 'border-yellow-500 bg-yellow-500/10 text-yellow-300'
                        : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
                    }`}
                  >
                    {PROVIDER_LABELS[p]}
                  </button>
                ))}
              </div>
            )}

            {/* Cash given */}
            {line.method === 'espèces' && (
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Montant remis (optionnel)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={line.cashGivenStr}
                  onChange={(e) => update(idx, { cashGivenStr: e.target.value })}
                  className={INPUT}
                  placeholder="0"
                />
                {line.cashGivenStr !== '' && changeVal !== undefined && (
                  changeVal >= 0 ? (
                    <p className="text-emerald-400 text-xs mt-1">Monnaie : {changeVal.toLocaleString('fr-FR')} FCFA</p>
                  ) : (
                    <p className="text-rose-400 text-xs mt-1">Montant insuffisant</p>
                  )
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add line button */}
      {lines.length < 5 && (
        <button
          type="button"
          onClick={addLine}
          className="w-full flex items-center justify-center gap-2 border border-dashed border-neutral-700 hover:border-gold-400/50 text-neutral-400 hover:text-gold-400 rounded-xl py-2 text-sm transition"
        >
          <Plus className="w-4 h-4" /> Ajouter un moyen
        </button>
      )}

      {/* Summary */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 flex justify-between items-center text-sm">
        <span className="text-neutral-400">Total réparti</span>
        <span className="font-semibold text-neutral-100">{totalAllocated.toLocaleString('fr-FR')} FCFA</span>
      </div>
      <div className={`bg-neutral-900 border rounded-xl px-3 py-2 flex justify-between items-center text-sm ${remaining === 0 ? 'border-emerald-500/40' : 'border-rose-500/40'}`}>
        <span className="text-neutral-400">Reste à répartir</span>
        <span className={`font-bold ${remaining === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {remaining === 0 ? '0 FCFA' : `${remaining > 0 ? '+' : ''}${remaining.toLocaleString('fr-FR')} FCFA`}
        </span>
      </div>
    </div>
  );
}
