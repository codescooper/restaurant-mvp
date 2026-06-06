import { useEffect, useState } from 'react';
import { Plus, Trash2, Wand2, Save, X, FileDown, BarChart3, Sparkles, ArrowLeft, Pencil } from 'lucide-react';
import {
  budgetApi,
  BudgetSummary,
  BudgetProposalDTO,
  BudgetSuggestion,
  BudgetTrackingDTO,
  BudgetSaveInput,
} from '../services/endpoints';
import { getApiError } from '../services/api';
import { formatFCFA } from '../utils/format';

const PANEL = 'bg-neutral-950 border border-neutral-800 ring-1 ring-white/5 rounded-2xl';
const INPUT =
  'w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:border-amber-500';
const BTN_GOLD = 'inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 disabled:opacity-50';
const BTN_GHOST = 'inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-700 text-neutral-200 hover:bg-neutral-900';

// ── Modèle d'édition (clés stables pour React) ────────────────────────────────
let KEY = 1;
const nextKey = () => KEY++;
interface DraftLine {
  _k: number;
  label: string;
  stockItemId: number | null;
  unit: string | null;
  unitPrice: number | null;
  amount: number;
  source?: string;
}
interface DraftPoste {
  _k: number;
  name: string;
  plannedAmount: number;
  lines: DraftLine[];
}
interface DraftSection {
  _k: number;
  name: string;
  postes: DraftPoste[];
}
interface Editor {
  id: number | null;
  title: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  targetTotal: number;
  reservePercent: number;
  status: string;
  conclusion: string;
  sections: DraftSection[];
  suggestions: BudgetSuggestion[];
}

const posteTotal = (p: DraftPoste) => (p.lines.length ? p.lines.reduce((s, l) => s + (l.amount || 0), 0) : p.plannedAmount || 0);
const sectionTotal = (s: DraftSection) => s.postes.reduce((sum, p) => sum + posteTotal(p), 0);
const grandTotal = (sections: DraftSection[]) => sections.reduce((sum, s) => sum + sectionTotal(s), 0);

function toDraftSections(sections: { name: string; postes: { name: string; plannedAmount: number; lines: { label: string; amount: number; stockItemId?: number | null; unit?: string | null; unitPrice?: number | null; source?: string }[] }[] }[]): DraftSection[] {
  return sections.map((s) => ({
    _k: nextKey(),
    name: s.name,
    postes: s.postes.map((p) => ({
      _k: nextKey(),
      name: p.name,
      plannedAmount: p.plannedAmount,
      lines: p.lines.map((l) => ({
        _k: nextKey(),
        label: l.label,
        stockItemId: l.stockItemId ?? null,
        unit: l.unit ?? null,
        unitPrice: l.unitPrice ?? null,
        amount: l.amount,
        source: l.source,
      })),
    })),
  }));
}

function toSavePayload(e: Editor): BudgetSaveInput {
  return {
    title: e.title.trim() || 'Budget',
    periodLabel: e.periodLabel.trim() || '—',
    periodStart: e.periodStart || null,
    periodEnd: e.periodEnd || null,
    targetTotal: e.targetTotal,
    reservePercent: e.reservePercent,
    status: e.status,
    conclusion: e.conclusion.trim() || null,
    sections: e.sections.map((s) => ({
      name: s.name,
      postes: s.postes.map((p) => ({
        name: p.name,
        plannedAmount: posteTotal(p),
        lines: p.lines.map((l) => ({
          label: l.label,
          amount: l.amount,
          stockItemId: l.stockItemId,
          unit: l.unit,
          unitPrice: l.unitPrice,
          source: l.source,
        })),
      })),
    })),
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type View = 'list' | 'generate' | 'editor' | 'tracking';

export default function BudgetPage() {
  const [view, setView] = useState<View>('list');
  const [budgets, setBudgets] = useState<BudgetSummary[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Formulaire de génération
  const [gen, setGen] = useState({
    title: 'Proposition de budget',
    periodLabel: '',
    periodStart: '',
    periodEnd: '',
    targetTotal: 1_000_000,
    reservePercent: 20,
    useHistory: true,
    useRotation: true,
    useThreshold: true,
    withAi: true,
  });
  const [aiAvailable, setAiAvailable] = useState(true);

  const [editor, setEditor] = useState<Editor | null>(null);
  const [tracking, setTracking] = useState<BudgetTrackingDTO | null>(null);

  const loadList = () =>
    budgetApi
      .list()
      .then(setBudgets)
      .catch((e) => setError(getApiError(e)));

  useEffect(() => {
    loadList();
  }, []);

  // ── Génération ──────────────────────────────────────────────────────────────
  const onGenerate = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await budgetApi.generate({
        periodLabel: gen.periodLabel || 'Période',
        targetTotal: gen.targetTotal,
        reservePercent: gen.reservePercent,
        periodStart: gen.periodStart || undefined,
        periodEnd: gen.periodEnd || undefined,
        useHistory: gen.useHistory,
        useRotation: gen.useRotation,
        useThreshold: gen.useThreshold,
        withAi: gen.withAi,
      });
      setAiAvailable(res.aiAvailable);
      buildEditorFromProposal(res.proposal, res.ai?.conclusion ?? '', [
        ...res.proposal.suggestions,
        ...(res.ai?.suggestions ?? []),
      ]);
      setView('editor');
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const buildEditorFromProposal = (proposal: BudgetProposalDTO, conclusion: string, suggestions: BudgetSuggestion[]) => {
    setEditor({
      id: null,
      title: gen.title,
      periodLabel: gen.periodLabel || 'Période',
      periodStart: gen.periodStart,
      periodEnd: gen.periodEnd,
      targetTotal: proposal.targetTotal,
      reservePercent: gen.reservePercent,
      status: 'brouillon',
      conclusion,
      sections: toDraftSections(proposal.sections),
      suggestions,
    });
  };

  // ── Ouverture / édition d'un budget existant ──────────────────────────────────
  const openBudget = async (id: number) => {
    setError('');
    setBusy(true);
    try {
      const b = await budgetApi.get(id);
      setEditor({
        id: b.id,
        title: b.title,
        periodLabel: b.periodLabel,
        periodStart: b.periodStart ? b.periodStart.slice(0, 10) : '',
        periodEnd: b.periodEnd ? b.periodEnd.slice(0, 10) : '',
        targetTotal: b.targetTotal,
        reservePercent: b.reservePercent,
        status: b.status,
        conclusion: b.conclusion ?? '',
        sections: toDraftSections(b.sections),
        suggestions: [],
      });
      setView('editor');
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const openTracking = async (id: number) => {
    setError('');
    setBusy(true);
    try {
      setTracking(await budgetApi.tracking(id));
      setView('tracking');
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!editor) return;
    setError('');
    setBusy(true);
    try {
      const payload = toSavePayload(editor);
      if (editor.id == null) await budgetApi.create(payload);
      else await budgetApi.update(editor.id, payload);
      await loadList();
      setView('list');
      setEditor(null);
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm('Supprimer définitivement ce budget ?')) return;
    setBusy(true);
    try {
      await budgetApi.remove(id);
      await loadList();
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const exportBudget = async (id: number, format: 'pdf' | 'csv') => {
    setBusy(true);
    try {
      const blob = await budgetApi.export(id, format);
      downloadBlob(blob, `budget-${id}.${format}`);
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  // ── Mutations de l'éditeur ────────────────────────────────────────────────────
  const patchEditor = (patch: Partial<Editor>) => setEditor((e) => (e ? { ...e, ...patch } : e));
  const mutate = (fn: (sections: DraftSection[]) => DraftSection[]) =>
    setEditor((e) => (e ? { ...e, sections: fn(e.sections) } : e));

  const addSection = () =>
    mutate((s) => [...s, { _k: nextKey(), name: 'Nouvelle section', postes: [] }]);
  const removeSection = (sk: number) => mutate((s) => s.filter((x) => x._k !== sk));
  const renameSection = (sk: number, name: string) =>
    mutate((s) => s.map((x) => (x._k === sk ? { ...x, name } : x)));
  const addPoste = (sk: number) =>
    mutate((s) =>
      s.map((x) => (x._k === sk ? { ...x, postes: [...x.postes, { _k: nextKey(), name: 'Nouveau poste', plannedAmount: 0, lines: [] }] } : x))
    );
  const removePoste = (sk: number, pk: number) =>
    mutate((s) => s.map((x) => (x._k === sk ? { ...x, postes: x.postes.filter((p) => p._k !== pk) } : x)));
  const patchPoste = (sk: number, pk: number, patch: Partial<DraftPoste>) =>
    mutate((s) => s.map((x) => (x._k === sk ? { ...x, postes: x.postes.map((p) => (p._k === pk ? { ...p, ...patch } : p)) } : x)));
  const addLine = (sk: number, pk: number) =>
    patchPosteLines(sk, pk, (lines) => [...lines, { _k: nextKey(), label: 'Nouvelle ligne', stockItemId: null, unit: null, unitPrice: null, amount: 0, source: 'manuel' }]);
  const removeLine = (sk: number, pk: number, lk: number) =>
    patchPosteLines(sk, pk, (lines) => lines.filter((l) => l._k !== lk));
  const patchLine = (sk: number, pk: number, lk: number, patch: Partial<DraftLine>) =>
    patchPosteLines(sk, pk, (lines) => lines.map((l) => (l._k === lk ? { ...l, ...patch } : l)));
  const patchPosteLines = (sk: number, pk: number, fn: (lines: DraftLine[]) => DraftLine[]) =>
    mutate((s) => s.map((x) => (x._k === sk ? { ...x, postes: x.postes.map((p) => (p._k === pk ? { ...p, lines: fn(p.lines) } : p)) } : x)));

  const addSuggestionAsPoste = (poste: string) => {
    mutate((s) => {
      if (!s.length) return s;
      // Ajoute le poste suggéré à la dernière section d'exploitation (avant la réserve).
      const idx = Math.max(0, s.findIndex((x) => x.name === 'Réserve stratégique') - 1);
      const target = s[idx] ? idx : 0;
      return s.map((x, i) =>
        i === target ? { ...x, postes: [...x.postes, { _k: nextKey(), name: poste, plannedAmount: 0, lines: [] }] } : x
      );
    });
    patchEditor({ suggestions: (editor?.suggestions ?? []).filter((sg) => sg.poste !== poste) });
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-amber-400">Budget d'approvisionnement</h1>
          <p className="text-sm text-neutral-400">Préparez et suivez vos budgets d'achats — répartition assistée et export PDF.</p>
        </div>
        {view === 'list' && (
          <button className={BTN_GOLD} onClick={() => { setError(''); setView('generate'); }}>
            <Plus className="w-4 h-4" /> Nouvelle proposition
          </button>
        )}
        {view !== 'list' && (
          <button className={BTN_GHOST} onClick={() => { setView('list'); setEditor(null); setTracking(null); }}>
            <ArrowLeft className="w-4 h-4" /> Retour à la liste
          </button>
        )}
      </header>

      {error && <div className="bg-rose-500/10 border border-rose-500/40 text-rose-300 rounded-lg px-4 py-2 text-sm">{error}</div>}

      {view === 'list' && <ListView budgets={budgets} onOpen={openBudget} onTracking={openTracking} onExport={exportBudget} onRemove={remove} busy={busy} />}

      {view === 'generate' && (
        <GenerateForm gen={gen} setGen={setGen} aiAvailable={aiAvailable} onGenerate={onGenerate} onCancel={() => setView('list')} busy={busy} />
      )}

      {view === 'editor' && editor && (
        <EditorView
          editor={editor}
          patchEditor={patchEditor}
          actions={{ addSection, removeSection, renameSection, addPoste, removePoste, patchPoste, addLine, removeLine, patchLine, addSuggestionAsPoste }}
          onSave={save}
          onExport={editor.id != null ? (f) => exportBudget(editor.id as number, f) : undefined}
          busy={busy}
        />
      )}

      {view === 'tracking' && tracking && <TrackingView t={tracking} />}
    </div>
  );
}

// ── Liste ───────────────────────────────────────────────────────────────────────
function ListView({
  budgets,
  onOpen,
  onTracking,
  onExport,
  onRemove,
  busy,
}: {
  budgets: BudgetSummary[];
  onOpen: (id: number) => void;
  onTracking: (id: number) => void;
  onExport: (id: number, f: 'pdf' | 'csv') => void;
  onRemove: (id: number) => void;
  busy: boolean;
}) {
  if (!budgets.length) {
    return <div className={`${PANEL} p-8 text-center text-neutral-400`}>Aucun budget pour le moment. Créez votre première proposition.</div>;
  }
  return (
    <div className={`${PANEL} overflow-hidden`}>
      <table className="w-full text-sm">
        <thead className="text-left text-neutral-400 border-b border-neutral-800">
          <tr>
            <th className="px-4 py-3">Titre</th>
            <th className="px-4 py-3">Période</th>
            <th className="px-4 py-3 text-right">Budget cible</th>
            <th className="px-4 py-3">Statut</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {budgets.map((b) => (
            <tr key={b.id} className="border-b border-neutral-900 hover:bg-neutral-900/40">
              <td className="px-4 py-3 text-neutral-100 font-medium">{b.title}</td>
              <td className="px-4 py-3 text-neutral-300">{b.periodLabel}</td>
              <td className="px-4 py-3 text-right text-neutral-100">{formatFCFA(b.targetTotal)}</td>
              <td className="px-4 py-3">
                <span className="px-2 py-0.5 rounded-full text-xs bg-neutral-800 text-neutral-300 capitalize">{b.status}</span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <button className={BTN_GHOST} onClick={() => onOpen(b.id)} disabled={busy} title="Ouvrir / modifier">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button className={BTN_GHOST} onClick={() => onTracking(b.id)} disabled={busy} title="Suivi budget vs réel">
                    <BarChart3 className="w-4 h-4" />
                  </button>
                  <button className={BTN_GHOST} onClick={() => onExport(b.id, 'pdf')} disabled={busy} title="Export PDF">
                    <FileDown className="w-4 h-4" />
                  </button>
                  <button className={BTN_GHOST} onClick={() => onRemove(b.id)} disabled={busy} title="Supprimer">
                    <Trash2 className="w-4 h-4 text-rose-400" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Formulaire de génération ──────────────────────────────────────────────────
function GenerateForm({
  gen,
  setGen,
  aiAvailable,
  onGenerate,
  onCancel,
  busy,
}: {
  gen: {
    title: string; periodLabel: string; periodStart: string; periodEnd: string; targetTotal: number; reservePercent: number;
    useHistory: boolean; useRotation: boolean; useThreshold: boolean; withAi: boolean;
  };
  setGen: (g: typeof gen) => void;
  aiAvailable: boolean;
  onGenerate: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const set = (patch: Partial<typeof gen>) => setGen({ ...gen, ...patch });
  return (
    <div className={`${PANEL} p-5 space-y-4`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm text-neutral-400">Titre</span>
          <input className={INPUT} value={gen.title} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-sm text-neutral-400">Période (libellé)</span>
          <input className={INPUT} placeholder="ex. Juin 2026" value={gen.periodLabel} onChange={(e) => set({ periodLabel: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-sm text-neutral-400">Budget cible (FCFA)</span>
          <input type="number" className={INPUT} value={gen.targetTotal} onChange={(e) => set({ targetTotal: Number(e.target.value) })} />
        </label>
        <label className="block">
          <span className="text-sm text-neutral-400">Réserve stratégique (%)</span>
          <input type="number" className={INPUT} value={gen.reservePercent} onChange={(e) => set({ reservePercent: Number(e.target.value) })} />
        </label>
        <label className="block">
          <span className="text-sm text-neutral-400">Période — début (suivi, optionnel)</span>
          <input type="date" className={INPUT} value={gen.periodStart} onChange={(e) => set({ periodStart: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-sm text-neutral-400">Période — fin (suivi, optionnel)</span>
          <input type="date" className={INPUT} value={gen.periodEnd} onChange={(e) => set({ periodEnd: e.target.value })} />
        </label>
      </div>

      <div className="space-y-2">
        <span className="text-sm text-neutral-400">Bases de calcul</span>
        <div className="flex flex-wrap gap-4 text-sm text-neutral-200">
          <Check label="Historique d'achats" checked={gen.useHistory} onChange={(v) => set({ useHistory: v })} />
          <Check label="Rotation des ventes" checked={gen.useRotation} onChange={(v) => set({ useRotation: v })} />
          <Check label="Stock sous seuil" checked={gen.useThreshold} onChange={(v) => set({ useThreshold: v })} />
          <Check
            label={`Enrichir avec l'IA${aiAvailable ? '' : ' (non configurée)'}`}
            checked={gen.withAi}
            onChange={(v) => set({ withAi: v })}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button className={BTN_GOLD} onClick={onGenerate} disabled={busy}>
          <Wand2 className="w-4 h-4" /> {busy ? 'Génération…' : 'Générer la proposition'}
        </button>
        <button className={BTN_GHOST} onClick={onCancel} disabled={busy}>
          <X className="w-4 h-4" /> Annuler
        </button>
      </div>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-amber-500" />
      {label}
    </label>
  );
}

// ── Éditeur ───────────────────────────────────────────────────────────────────
interface EditorActions {
  addSection: () => void;
  removeSection: (sk: number) => void;
  renameSection: (sk: number, name: string) => void;
  addPoste: (sk: number) => void;
  removePoste: (sk: number, pk: number) => void;
  patchPoste: (sk: number, pk: number, patch: Partial<DraftPoste>) => void;
  addLine: (sk: number, pk: number) => void;
  removeLine: (sk: number, pk: number, lk: number) => void;
  patchLine: (sk: number, pk: number, lk: number, patch: Partial<DraftLine>) => void;
  addSuggestionAsPoste: (poste: string) => void;
}

function EditorView({
  editor,
  patchEditor,
  actions,
  onSave,
  onExport,
  busy,
}: {
  editor: Editor;
  patchEditor: (patch: Partial<Editor>) => void;
  actions: EditorActions;
  onSave: () => void;
  onExport?: (f: 'pdf' | 'csv') => void;
  busy: boolean;
}) {
  const total = grandTotal(editor.sections);
  const diff = total - editor.targetTotal;

  return (
    <div className="space-y-4">
      {/* En-tête éditable */}
      <div className={`${PANEL} p-5 grid grid-cols-1 md:grid-cols-4 gap-4`}>
        <label className="block md:col-span-2">
          <span className="text-sm text-neutral-400">Titre</span>
          <input className={INPUT} value={editor.title} onChange={(e) => patchEditor({ title: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-sm text-neutral-400">Période</span>
          <input className={INPUT} value={editor.periodLabel} onChange={(e) => patchEditor({ periodLabel: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-sm text-neutral-400">Statut</span>
          <select className={INPUT} value={editor.status} onChange={(e) => patchEditor({ status: e.target.value })}>
            <option value="brouillon">brouillon</option>
            <option value="validé">validé</option>
            <option value="clôturé">clôturé</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-neutral-400">Budget cible (FCFA)</span>
          <input type="number" className={INPUT} value={editor.targetTotal} onChange={(e) => patchEditor({ targetTotal: Number(e.target.value) })} />
        </label>
        <div className="md:col-span-3 flex items-end">
          <div className={`text-sm ${diff === 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
            Total réparti : <strong>{formatFCFA(total)}</strong>
            {diff !== 0 && <> — écart avec la cible : {formatFCFA(diff)}</>}
          </div>
        </div>
      </div>

      {/* Suggestions */}
      {editor.suggestions.length > 0 && (
        <div className={`${PANEL} p-4`}>
          <div className="flex items-center gap-2 text-amber-300 font-semibold mb-2">
            <Sparkles className="w-4 h-4" /> Postes suggérés (non anticipés)
          </div>
          <div className="flex flex-wrap gap-2">
            {editor.suggestions.map((sg) => (
              <button
                key={sg.poste}
                onClick={() => actions.addSuggestionAsPoste(sg.poste)}
                title={sg.reason}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-amber-500/40 text-amber-200 text-sm hover:bg-amber-500/10"
              >
                <Plus className="w-3 h-3" /> {sg.poste}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sections / postes / lignes */}
      {editor.sections.map((s) => (
        <div key={s._k} className={`${PANEL} p-4 space-y-3`}>
          <div className="flex items-center justify-between gap-3">
            <input
              className="bg-transparent border-b border-neutral-700 text-lg font-semibold text-neutral-100 focus:outline-none focus:border-amber-500 flex-1"
              value={s.name}
              onChange={(e) => actions.renameSection(s._k, e.target.value)}
            />
            <span className="text-amber-300 font-semibold whitespace-nowrap">{formatFCFA(sectionTotal(s))}</span>
            <button className={BTN_GHOST} onClick={() => actions.removeSection(s._k)} title="Supprimer la section">
              <Trash2 className="w-4 h-4 text-rose-400" />
            </button>
          </div>

          {s.postes.map((p) => (
            <div key={p._k} className="border border-neutral-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-3">
                <input
                  className="bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-neutral-100 font-medium flex-1"
                  value={p.name}
                  onChange={(e) => actions.patchPoste(s._k, p._k, { name: e.target.value })}
                />
                {p.lines.length === 0 ? (
                  <input
                    type="number"
                    className="w-36 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-right text-neutral-100"
                    value={p.plannedAmount}
                    onChange={(e) => actions.patchPoste(s._k, p._k, { plannedAmount: Number(e.target.value) })}
                  />
                ) : (
                  <span className="w-36 text-right text-neutral-200">{formatFCFA(posteTotal(p))}</span>
                )}
                <button className={BTN_GHOST} onClick={() => actions.removePoste(s._k, p._k)} title="Supprimer le poste">
                  <Trash2 className="w-4 h-4 text-rose-400" />
                </button>
              </div>

              {p.lines.map((l) => (
                <div key={l._k} className="flex items-center gap-2 pl-3">
                  <input
                    className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-sm text-neutral-200"
                    value={l.label}
                    onChange={(e) => actions.patchLine(s._k, p._k, l._k, { label: e.target.value })}
                  />
                  {l.source && <span className="text-[10px] uppercase tracking-wide text-neutral-500">{l.source}</span>}
                  <input
                    type="number"
                    className="w-32 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-right text-sm text-neutral-100"
                    value={l.amount}
                    onChange={(e) => actions.patchLine(s._k, p._k, l._k, { amount: Number(e.target.value) })}
                  />
                  <button onClick={() => actions.removeLine(s._k, p._k, l._k)} title="Supprimer la ligne">
                    <X className="w-4 h-4 text-neutral-500 hover:text-rose-400" />
                  </button>
                </div>
              ))}
              <button className="text-xs text-amber-300 hover:text-amber-200 inline-flex items-center gap-1 pl-3" onClick={() => actions.addLine(s._k, p._k)}>
                <Plus className="w-3 h-3" /> Ajouter une ligne
              </button>
            </div>
          ))}

          <button className={BTN_GHOST} onClick={() => actions.addPoste(s._k)}>
            <Plus className="w-4 h-4" /> Ajouter un poste
          </button>
        </div>
      ))}

      <button className={BTN_GHOST} onClick={actions.addSection}>
        <Plus className="w-4 h-4" /> Ajouter une section
      </button>

      {/* Conclusion */}
      <div className={`${PANEL} p-4`}>
        <span className="text-sm text-neutral-400">Conclusion</span>
        <textarea
          className={`${INPUT} mt-1 min-h-[100px]`}
          value={editor.conclusion}
          placeholder="Justification de la répartition et de la réserve stratégique…"
          onChange={(e) => patchEditor({ conclusion: e.target.value })}
        />
      </div>

      {/* Barre d'actions */}
      <div className="flex items-center gap-3">
        <button className={BTN_GOLD} onClick={onSave} disabled={busy}>
          <Save className="w-4 h-4" /> {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {onExport && (
          <>
            <button className={BTN_GHOST} onClick={() => onExport('pdf')} disabled={busy}>
              <FileDown className="w-4 h-4" /> PDF
            </button>
            <button className={BTN_GHOST} onClick={() => onExport('csv')} disabled={busy}>
              <FileDown className="w-4 h-4" /> CSV
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Suivi budget vs réel ──────────────────────────────────────────────────────
function TrackingView({ t }: { t: BudgetTrackingDTO }) {
  return (
    <div className={`${PANEL} overflow-hidden`}>
      <div className="px-4 py-3 border-b border-neutral-800">
        <h2 className="text-lg font-semibold text-neutral-100">Suivi — {t.title}</h2>
        <p className="text-sm text-neutral-400">
          {t.periodLabel} · du {t.periodStart.slice(0, 10)} au {t.periodEnd.slice(0, 10)}
        </p>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-neutral-400 border-b border-neutral-800">
          <tr>
            <th className="px-4 py-3">Poste</th>
            <th className="px-4 py-3 text-right">Prévu</th>
            <th className="px-4 py-3 text-right">Réel (achats)</th>
            <th className="px-4 py-3 text-right">Écart</th>
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r) => (
            <tr key={r.poste} className="border-b border-neutral-900">
              <td className="px-4 py-2 text-neutral-200">{r.poste}</td>
              <td className="px-4 py-2 text-right text-neutral-300">{formatFCFA(r.planned)}</td>
              <td className="px-4 py-2 text-right text-neutral-300">{formatFCFA(r.actual)}</td>
              <td className={`px-4 py-2 text-right font-medium ${r.diff < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{formatFCFA(r.diff)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-neutral-800 font-semibold text-neutral-100">
            <td className="px-4 py-3">Total</td>
            <td className="px-4 py-3 text-right">{formatFCFA(t.totalPlanned)}</td>
            <td className="px-4 py-3 text-right">{formatFCFA(t.totalActual)}</td>
            <td className={`px-4 py-3 text-right ${t.totalPlanned - t.totalActual < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {formatFCFA(t.totalPlanned - t.totalActual)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
