import { useEffect, useState } from 'react';
import { Globe, CheckCircle2, Clock, XCircle, Loader2, AlertCircle, Send } from 'lucide-react';
import { catalogApi, CATALOG_PLATFORMS } from '../../services/endpoints';
import { getApiError } from '../../services/api';
import { CatalogRequest, CatalogStatus } from '../../types';
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

const PANEL = 'bg-neutral-950 border border-neutral-800 ring-1 ring-white/5 rounded-2xl p-5';

export default function CatalogTab() {
  const [requests, setRequests] = useState<CatalogRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  // Form state
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const load = async () => {
    try {
      const data = await catalogApi.listMine();
      setRequests(data);
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const hasPending = requests.some(
    (r) => r.status === 'pending' || r.status === 'in_progress'
  );

  const togglePlatform = (p: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const submit = async () => {
    setFormError('');
    if (selectedPlatforms.length === 0) {
      setFormError('Sélectionnez au moins une plateforme.');
      return;
    }
    setSubmitting(true);
    try {
      await catalogApi.create(selectedPlatforms, message.trim() || undefined);
      setSelectedPlatforms([]);
      setMessage('');
      await load();
    } catch (e) {
      const msg = getApiError(e);
      // 409 CATALOG_002 — demande déjà en cours
      if (msg.toLowerCase().includes('catalog_002') || msg.toLowerCase().includes('déjà') || msg.toLowerCase().includes('already')) {
        setFormError('Une demande est déjà en cours de traitement. Attendez qu\'elle soit traitée avant d\'en soumettre une nouvelle.');
      } else {
        setFormError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-neutral-400 text-sm">
        Chargement…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={PANEL}>
        <div className="flex items-center gap-3 mb-1">
          <Globe className="w-5 h-5 text-gold-400" />
          <h2 className="text-lg font-bold text-neutral-100">Référencement en ligne</h2>
        </div>
        <p className="text-sm text-neutral-400">
          Demandez à être référencé sur les plateformes de livraison et annuaires.
          L'équipe Restoflow traite votre demande et vous confirme la mise en ligne.
        </p>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* New request form */}
      <div className={PANEL}>
        <h3 className="font-semibold text-neutral-100 mb-4">Nouvelle demande</h3>

        {hasPending && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg p-3 text-sm flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Une demande est déjà en cours de traitement. Vous pourrez en soumettre une nouvelle une fois celle-ci traitée.
          </div>
        )}

        <div className={hasPending ? 'opacity-50 pointer-events-none select-none' : ''}>
          <p className="text-sm font-medium text-neutral-200 mb-3">Plateformes souhaitées</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {CATALOG_PLATFORMS.map((p) => {
              const checked = selectedPlatforms.includes(p);
              return (
                <label
                  key={p}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition text-sm select-none ${
                    checked
                      ? 'border-gold-400 bg-gold-400/10 text-gold-300'
                      : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={checked}
                    onChange={() => togglePlatform(p)}
                  />
                  <span
                    className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${
                      checked ? 'bg-gold-400 border-gold-400' : 'border-neutral-600'
                    }`}
                  >
                    {checked && (
                      <svg viewBox="0 0 10 8" className="w-2.5 h-2 fill-black">
                        <path d="M1 4l2.5 2.5L9 1" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    )}
                  </span>
                  {p}
                </label>
              );
            })}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-200 mb-1">
              Message (optionnel)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Informations utiles : lien Google Maps existant, horaires, zone de livraison…"
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400 text-sm resize-none"
            />
          </div>

          {formError && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 text-sm mb-3">
              {formError}
            </div>
          )}

          <button
            onClick={submit}
            disabled={submitting || selectedPlatforms.length === 0}
            className="flex items-center gap-2 bg-gold-400 hover:bg-gold-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold px-5 py-2.5 rounded-xl transition"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? 'Envoi…' : 'Envoyer la demande'}
          </button>
        </div>
      </div>

      {/* My requests list */}
      <div className={PANEL}>
        <h3 className="font-semibold text-neutral-100 mb-4">
          Mes demandes ({requests.length})
        </h3>

        {requests.length === 0 ? (
          <p className="text-neutral-500 text-sm">Aucune demande pour l'instant.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div
                key={req.id}
                className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-2"
              >
                {/* Status + date */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_BADGE[req.status]}`}
                  >
                    {STATUS_ICON[req.status]}
                    {STATUS_LABEL[req.status]}
                  </span>
                  <span className="text-xs text-neutral-500">{formatDateTime(req.createdAt)}</span>
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
                    <span className="font-medium">Réponse de l'équipe : </span>
                    {req.adminNote}
                  </div>
                )}

                {/* processedAt */}
                {req.processedAt && (
                  <p className="text-xs text-neutral-600">
                    Traité le {formatDateTime(req.processedAt)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
