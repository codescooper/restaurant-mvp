import { useEffect, useState } from 'react';
import {
  Globe,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { adminCatalogApi } from '../../services/endpoints';
import { getApiError } from '../../services/api';
import { AdminCatalogRequest, CatalogStatus } from '../../types';
import { formatDateTime } from '../../utils/format';

const STATUS_LABEL: Record<CatalogStatus, string> = {
  pending:     'En attente',
  in_progress: 'En cours',
  done:        'Référencé',
  rejected:    'Refusé',
};

const STATUS_BADGE: Record<CatalogStatus, string> = {
  pending:     'bg-amber-500/15 text-amber-300',
  in_progress: 'bg-sky-500/15 text-sky-300',
  done:        'bg-emerald-500/15 text-emerald-300',
  rejected:    'bg-rose-500/15 text-rose-300',
};

const STATUS_ICON: Record<CatalogStatus, React.ReactNode> = {
  pending:     <Clock className="w-3.5 h-3.5" />,
  in_progress: <Loader2 className="w-3.5 h-3.5" />,
  done:        <CheckCircle2 className="w-3.5 h-3.5" />,
  rejected:    <XCircle className="w-3.5 h-3.5" />,
};

// Transitions possibles depuis un statut donné
const NEXT_STATUSES: Record<CatalogStatus, CatalogStatus[]> = {
  pending:     ['in_progress', 'rejected'],
  in_progress: ['done', 'rejected'],
  done:        [],
  rejected:    ['pending'],
};

const NEXT_LABEL: Partial<Record<CatalogStatus, string>> = {
  in_progress: 'Mettre en cours',
  done:        'Marquer référencé',
  rejected:    'Refuser',
  pending:     'Réouvrir',
};

const NEXT_BTN: Partial<Record<CatalogStatus, string>> = {
  in_progress: 'bg-sky-500/15 text-sky-300 border-sky-500/30 hover:bg-sky-500/25',
  done:        'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25',
  rejected:    'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25',
  pending:     'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25',
};

type FilterOption = 'all' | CatalogStatus;

const FILTER_OPTIONS: { value: FilterOption; label: string }[] = [
  { value: 'all',         label: 'Toutes' },
  { value: 'pending',     label: 'En attente' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'done',        label: 'Référencé' },
  { value: 'rejected',    label: 'Refusé' },
];

interface ConfirmModal {
  requestId: number;
  targetStatus: CatalogStatus;
  restaurantName: string;
}

export default function AdminCatalogRequests() {
  const [requests, setRequests]   = useState<AdminCatalogRequest[]>([]);
  const [filter, setFilter]       = useState<FilterOption>('all');
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [busyId, setBusyId]       = useState<number | null>(null);

  // Modal de confirmation
  const [confirm, setConfirm]     = useState<ConfirmModal | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [menuOpen, setMenuOpen]   = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminCatalogApi.list(
        filter === 'all' ? undefined : filter
      );
      setRequests(data);
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const openConfirm = (req: AdminCatalogRequest, targetStatus: CatalogStatus) => {
    setConfirm({
      requestId: req.id,
      targetStatus,
      restaurantName: req.restaurant?.name ?? `#${req.id}`,
    });
    setAdminNote('');
    setMenuOpen(null);
  };

  const runAction = async () => {
    if (!confirm) return;
    setBusyId(confirm.requestId);
    try {
      await adminCatalogApi.setStatus(
        confirm.requestId,
        confirm.targetStatus,
        adminNote.trim() || undefined
      );
      setConfirm(null);
      await load();
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-neutral-950 border border-neutral-800 ring-1 ring-white/5 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-1">
          <Globe className="w-5 h-5 text-gold-400" />
          <h2 className="text-lg font-bold text-neutral-100">
            Demandes annuaire
            {filter === 'all' && pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-amber-500 text-black rounded-full">
                {pendingCount}
              </span>
            )}
          </h2>
        </div>
        <p className="text-sm text-neutral-400">
          Gérez les demandes de référencement sur les plateformes de livraison et annuaires.
        </p>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === opt.value
                ? 'bg-gold-400 text-black'
                : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            {opt.label}
            {opt.value === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-xs font-bold bg-amber-500 text-black rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-neutral-400 text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-8 text-center text-neutral-500">
          Aucune demande dans ce filtre.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const nexts = NEXT_STATUSES[req.status];
            return (
              <div
                key={req.id}
                className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 space-y-3"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-semibold text-neutral-100">
                      {req.restaurant?.name ?? '—'}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {req.restaurant?.slug ?? ''}
                      {req.creator?.email ? ` · ${req.creator.displayName ?? req.creator.email}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_BADGE[req.status]}`}
                    >
                      {STATUS_ICON[req.status]}
                      {STATUS_LABEL[req.status]}
                    </span>
                    <span className="text-xs text-neutral-500">{formatDateTime(req.createdAt)}</span>
                  </div>
                </div>

                {/* Platforms */}
                <div className="flex flex-wrap gap-1.5">
                  {req.platforms.map((p) => (
                    <span
                      key={p}
                      className="text-xs bg-neutral-800 text-neutral-300 border border-neutral-700 px-2 py-0.5 rounded-full"
                    >
                      {p}
                    </span>
                  ))}
                </div>

                {/* Message du proprio */}
                {req.message && (
                  <p className="text-sm text-neutral-400 italic">
                    &laquo; {req.message} &raquo;
                  </p>
                )}

                {/* Admin note */}
                {req.adminNote && (
                  <div className="bg-sky-500/10 border border-sky-500/20 rounded-lg px-3 py-2 text-sm text-sky-300">
                    <span className="font-medium">Note admin : </span>
                    {req.adminNote}
                  </div>
                )}

                {/* Actions */}
                {nexts.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {nexts.length === 1 ? (
                      <button
                        disabled={busyId === req.id}
                        onClick={() => openConfirm(req, nexts[0])}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition flex items-center gap-1 ${NEXT_BTN[nexts[0]] ?? ''}`}
                      >
                        {busyId === req.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : STATUS_ICON[nexts[0]]
                        }
                        {NEXT_LABEL[nexts[0]]}
                      </button>
                    ) : (
                      <div className="relative">
                        <button
                          onClick={() => setMenuOpen(menuOpen === req.id ? null : req.id)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-neutral-600 bg-neutral-800 text-neutral-200 hover:bg-neutral-700 font-medium flex items-center gap-1 transition"
                        >
                          Changer le statut <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        {menuOpen === req.id && (
                          <div className="absolute left-0 top-full mt-1 bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl z-20 min-w-[160px] py-1">
                            {nexts.map((ns) => (
                              <button
                                key={ns}
                                onClick={() => openConfirm(req, ns)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-800 flex items-center gap-2"
                              >
                                {STATUS_ICON[ns]}
                                <span className={STATUS_BADGE[ns].split(' ')[1]}>{NEXT_LABEL[ns]}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {menuOpen !== null && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
      )}

      {/* Confirm modal */}
      {confirm && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setConfirm(null)}
        >
          <div
            className="bg-neutral-950 border border-neutral-800 ring-1 ring-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-neutral-100 mb-2">
              {STATUS_LABEL[confirm.targetStatus]} — {confirm.restaurantName}
            </h3>
            <p className="text-sm text-neutral-400 mb-4">
              Le statut passera à{' '}
              <span className={`font-medium ${STATUS_BADGE[confirm.targetStatus].split(' ')[1]}`}>
                {STATUS_LABEL[confirm.targetStatus]}
              </span>
              .
            </p>

            <label className="block text-sm font-medium text-neutral-200 mb-1">
              Note admin (optionnelle, visible par le propriétaire)
            </label>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Ex. Votre fiche est en cours de vérification…"
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 text-sm outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400 resize-none mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirm(null)}
                className="px-3 py-2 rounded-lg text-neutral-300 hover:text-neutral-100"
              >
                Annuler
              </button>
              <button
                onClick={runAction}
                disabled={busyId !== null}
                className="px-4 py-2 rounded-lg bg-gold-400 hover:bg-gold-300 text-black font-bold disabled:opacity-50"
              >
                {busyId !== null ? 'Traitement…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
