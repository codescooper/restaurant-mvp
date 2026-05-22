import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, Users, X, CreditCard, CheckCircle, Plus, Bell, Merge, CalendarDays, Clock, Printer } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { tableApi, orderApi } from '../services/endpoints';
import { getApiError } from '../services/api';
import { RestaurantTable, Reservation } from '../types';
import { formatFCFA, formatDateTime } from '../utils/format';

type PaymentMethod = '' | 'espèces' | 'mobile_money' | 'carte' | 'virement' | 'qr_code';
type Provider = '' | 'orange_money' | 'wave' | 'mtn';

const SETTLE_LABELS: Record<string, string> = {
  espèces: 'Espèces',
  mobile_money: 'Mobile',
  carte: 'Carte',
  virement: 'Virement',
  qr_code: 'QR Code',
};

const STATUS_LABELS: Record<string, string> = {
  libre: 'Libre',
  occupée: 'Occupée',
  addition_demandée: 'Addition demandée',
  réservée: 'Réservée',
};
const STATUS_CARD: Record<string, string> = {
  libre: 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50',
  occupée: 'bg-rose-500/10 border-rose-500/30 hover:border-rose-500/50',
  addition_demandée: 'bg-gold-400/10 border-gold-400/40 hover:border-gold-400/60',
  réservée: 'bg-sky-500/10 border-sky-500/30 hover:border-sky-500/50',
};
const STATUS_BADGE: Record<string, string> = {
  libre: 'bg-emerald-500/20 text-emerald-300',
  occupée: 'bg-rose-500/20 text-rose-300',
  addition_demandée: 'bg-gold-400/20 text-gold-300',
  réservée: 'bg-sky-500/20 text-sky-300',
};

export default function SallePage() {
  const { currentUser } = useAuth();
  const { socket } = useWebSocket();
  const navigate = useNavigate();

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [settleOpen, setSettleOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('');
  const [provider, setProvider] = useState<Provider>('');
  const [cashGiven, setCashGiven] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Reçu imprimable après encaissement d'une table : indique le serveur assigné (handoff caisse → serveur).
  const [settleReceipt, setSettleReceipt] = useState<{
    tableName: string;
    serverName?: string;
    paidCount: number;
    total: number;
    change: number;
    paymentMethod: string;
    cashGiven?: number;
    time: string;
  } | null>(null);

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [showReservations, setShowReservations] = useState(false);
  const [resForm, setResForm] = useState({ customerName: '', customerPhone: '', partySize: '', reservedAt: '' });
  const [resOpen, setResOpen] = useState(false);
  const [mergeMode, setMergeMode] = useState(false);

  const role = currentUser?.role;
  const canSettle = role === 'caissier' || role === 'administrateur';
  const canOrder = role === 'serveur' || role === 'caissier' || role === 'administrateur';

  const load = useCallback(() => {
    tableApi.list().then(setTables).catch((e) => setError(getApiError(e)));
    tableApi.reservations().then(setReservations).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => load();
    socket.on('new_order', refresh);
    socket.on('order_status_changed', refresh);
    socket.on('table_settled', refresh);
    socket.on('table_status_changed', refresh);
    socket.on('bill_requested', refresh);
    return () => {
      socket.off('new_order', refresh);
      socket.off('order_status_changed', refresh);
      socket.off('table_settled', refresh);
      socket.off('table_status_changed', refresh);
      socket.off('bill_requested', refresh);
    };
  }, [socket, load]);

  const selected = tables.find((t) => t.id === selectedId) ?? null;
  const total = selected?.unpaidTotal ?? 0;
  const change = (Number(cashGiven) || 0) - total;

  const closePanel = () => {
    setSelectedId(null);
    setSettleOpen(false);
    setPaymentMethod('');
    setProvider('');
    setCashGiven('');
    setResOpen(false);
    setMergeMode(false);
    setResForm({ customerName: '', customerPhone: '', partySize: '', reservedAt: '' });
    setError('');
  };

  const serve = async (orderId: number) => {
    setBusy(true);
    try {
      await orderApi.updateStatus(orderId, 'servie');
      load();
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleBill = async (table: RestaurantTable) => {
    setBusy(true);
    try {
      await tableApi.billRequest(table.id, !table.billRequested);
      load();
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const doMerge = async (targetId: number) => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await tableApi.merge(selected.id, targetId);
      closePanel();
      load();
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const submitReservation = async () => {
    if (!selected) return;
    if (!resForm.customerName.trim() || !resForm.reservedAt) {
      setError('Nom du client et heure requis');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await tableApi.createReservation({
        tableId: selected.id,
        customerName: resForm.customerName.trim(),
        customerPhone: resForm.customerPhone || undefined,
        partySize: resForm.partySize ? Number(resForm.partySize) : undefined,
        reservedAt: new Date(resForm.reservedAt).toISOString(),
      });
      closePanel();
      load();
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const cancelRes = async (id: number) => {
    try {
      await tableApi.cancelReservation(id);
      load();
    } catch (e) {
      setError(getApiError(e));
    }
  };
  const honorRes = async (id: number) => {
    try {
      await tableApi.honorReservation(id);
      load();
    } catch (e) {
      setError(getApiError(e));
    }
  };

  const canConfirmSettle =
    !!paymentMethod &&
    (paymentMethod !== 'espèces' || change >= 0) &&
    (paymentMethod !== 'mobile_money' || !!provider);

  const confirmSettle = async () => {
    if (!selected || !canConfirmSettle) return;
    setBusy(true);
    setError('');
    // Capturé avant closePanel (qui réinitialise la table sélectionnée).
    const tName = selected.name;
    const sName = selected.server?.username;
    const given = paymentMethod === 'espèces' ? Number(cashGiven) || 0 : undefined;
    try {
      const res = await tableApi.settle(selected.id, paymentMethod || 'espèces', {
        mobileMoneyProvider: paymentMethod === 'mobile_money' ? provider || undefined : undefined,
        cashGiven: paymentMethod === 'espèces' ? Number(cashGiven) || 0 : undefined,
        changeReturned: paymentMethod === 'espèces' ? Math.max(0, change) : undefined,
      });
      setSettleReceipt({
        tableName: tName,
        serverName: sName,
        paidCount: res.paidCount,
        total: res.total,
        change: res.change,
        paymentMethod: res.paymentMethod,
        cashGiven: given,
        time: new Date().toISOString(),
      });
      closePanel();
      load();
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-black text-neutral-100">
      <div className="max-w-7xl mx-auto p-4">
      <div className="bg-gradient-to-r from-neutral-950 to-neutral-900/40 border border-neutral-800 ring-1 ring-white/5 rounded-2xl p-4 mb-4 flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-gold-400/10 ring-1 ring-gold-400/25 flex items-center justify-center">
          <LayoutGrid className="w-6 h-6 text-gold-400" />
        </span>
        <div>
          <h1 className="text-xl font-bold">Salle</h1>
          <p className="text-sm text-neutral-400">Plan des tables</p>
        </div>
        <button
          onClick={() => setShowReservations(true)}
          className="ml-auto flex items-center gap-1 text-sm bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-3 py-1.5 rounded-lg text-neutral-200 transition"
        >
          <CalendarDays className="w-4 h-4 text-sky-300" /> Réservations
          {reservations.length > 0 && (
            <span className="ml-1 bg-sky-500/20 text-sky-300 text-xs px-1.5 rounded-full">{reservations.length}</span>
          )}
        </button>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-neutral-400 mb-4">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> Libre</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" /> Occupée</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gold-400 inline-block" /> Addition demandée</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" /> Réservée</span>
      </div>

      {error && !selected && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 mb-4 text-sm">{error}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {tables.map((t) => {
          const occupied = t.status === 'occupée' || t.status === 'addition_demandée';
          return (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className={`rounded-2xl p-4 text-left transition hover:-translate-y-0.5 border ${STATUS_CARD[t.status] ?? STATUS_CARD.libre}`}
            >
              <div className="flex justify-between items-start gap-1">
                <span className="font-bold text-neutral-100">{t.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_BADGE[t.status] ?? STATUS_BADGE.libre}`}>
                  {STATUS_LABELS[t.status] ?? t.status}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-neutral-400 mt-1">
                <Users className="w-3 h-3" /> {t.capacity} places
              </div>
              {occupied && (
                <div className="mt-2 text-sm">
                  <div className="font-bold text-neutral-100">{formatFCFA(t.total)}</div>
                  {t.server && <div className="text-xs text-neutral-400">Serveur : {t.server.username}</div>}
                  {t.hasUnpaid && <div className="text-xs text-gold-300">À régler : {formatFCFA(t.unpaidTotal)}</div>}
                </div>
              )}
              {t.status === 'réservée' && t.reservation && (
                <div className="mt-2 text-xs text-sky-300 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {formatDateTime(t.reservation.reservedAt)} · {t.reservation.customerName}
                </div>
              )}
            </button>
          );
        })}
        {tables.length === 0 && <p className="col-span-full text-center text-neutral-500 py-8">Aucune table configurée</p>}
      </div>

      {/* Panneau détail table */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-950 border border-neutral-800 ring-1 ring-white/10 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold text-neutral-100">{selected.name}</h3>
              <button onClick={closePanel} className="text-neutral-500 hover:text-neutral-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between mb-3 text-sm">
              <span className={`px-2 py-0.5 rounded-full ${STATUS_BADGE[selected.status] ?? STATUS_BADGE.libre}`}>
                {STATUS_LABELS[selected.status] ?? selected.status}
              </span>
              {selected.server && <span className="text-neutral-400">Serveur : {selected.server.username}</span>}
            </div>

            {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-2 mb-3 text-sm">{error}</div>}

            {/* Réservation en cours sur cette table */}
            {selected.reservation && (
              <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-3 mb-3 text-sm">
                <div className="flex items-center gap-1 text-sky-300 font-medium">
                  <CalendarDays className="w-4 h-4" /> Réservée
                </div>
                <div className="text-neutral-300 mt-1">
                  {selected.reservation.customerName}
                  {selected.reservation.partySize ? ` · ${selected.reservation.partySize} pers.` : ''} ·{' '}
                  {formatDateTime(selected.reservation.reservedAt)}
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => honorRes(selected.reservation!.id)} className="text-xs bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-3 py-1 rounded-lg">
                    Marquer honorée
                  </button>
                  <button onClick={() => cancelRes(selected.reservation!.id)} className="text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 px-3 py-1 rounded-lg">
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {selected.orders.length === 0 ? (
              <p className="text-neutral-500 text-sm py-4 text-center">Table libre — aucune commande en cours</p>
            ) : (
              <div className="space-y-2 mb-3">
                {selected.orders.map((o) => (
                  <div key={o.id} className="border border-neutral-800 bg-neutral-900 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-sm text-neutral-100">{o.orderNumber}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 capitalize">{o.status}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${o.isPaid ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gold-400/15 text-gold-300'}`}>
                          {o.isPaid ? 'Payée' : 'À régler'}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-neutral-400">
                      {o.items.map((it) => `${it.quantity}x ${it.dishName}`).join(', ')}
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="font-semibold text-sm text-neutral-100">{formatFCFA(o.finalTotal)}</span>
                      {o.status === 'prête' && canOrder && (
                        <button
                          onClick={() => serve(o.id)}
                          disabled={busy}
                          className="text-xs bg-gold-400 hover:bg-gold-300 text-black font-semibold px-3 py-1 rounded-lg transition"
                        >
                          Marquer servie
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selected.hasUnpaid && (
              <div className="flex justify-between font-bold border-t border-neutral-800 pt-2 mb-3">
                <span className="text-neutral-200">Total à régler</span>
                <span className="text-gold-400">{formatFCFA(selected.unpaidTotal)}</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {canOrder && (
                <button
                  onClick={() => navigate(`/caisse?table=${selected.id}&name=${encodeURIComponent(selected.name)}`)}
                  className="w-full flex items-center justify-center gap-2 bg-gold-400 hover:bg-gold-300 text-black font-bold py-2.5 rounded-xl transition"
                >
                  <Plus className="w-5 h-5" /> Nouvelle commande
                </button>
              )}
              {canOrder && (selected.status === 'occupée' || selected.status === 'addition_demandée') && (
                <button
                  onClick={() => toggleBill(selected)}
                  disabled={busy}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold transition border ${
                    selected.billRequested
                      ? 'bg-gold-400/10 border-gold-400/40 text-gold-300'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border-neutral-700'
                  }`}
                >
                  <Bell className="w-5 h-5" /> {selected.billRequested ? "Annuler la demande d'addition" : "Demander l'addition"}
                </button>
              )}
              {canSettle && selected.hasUnpaid && !settleOpen && (
                <button
                  onClick={() => setSettleOpen(true)}
                  className="w-full flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700 py-2.5 rounded-xl font-semibold transition"
                >
                  <CreditCard className="w-5 h-5" /> Encaisser l'addition
                </button>
              )}
              {canSettle && (selected.status === 'occupée' || selected.status === 'addition_demandée') && (
                <button
                  onClick={() => setMergeMode((m) => !m)}
                  className="w-full flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700 py-2.5 rounded-xl font-semibold transition"
                >
                  <Merge className="w-5 h-5" /> Fusionner avec une autre table
                </button>
              )}
              {canOrder && selected.status === 'libre' && (
                <button
                  onClick={() => setResOpen((o) => !o)}
                  className="w-full flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700 py-2.5 rounded-xl font-semibold transition"
                >
                  <CalendarDays className="w-5 h-5" /> Réserver cette table
                </button>
              )}
            </div>

            {/* Fusion : choisir la table cible */}
            {mergeMode && (
              <div className="mt-3 border-t border-neutral-800 pt-3">
                <p className="text-sm text-neutral-400 mb-2">Déplacer les commandes de {selected.name} vers :</p>
                <div className="grid grid-cols-2 gap-2">
                  {tables
                    .filter((t) => t.id !== selected.id && (t.status === 'occupée' || t.status === 'addition_demandée' || t.status === 'libre'))
                    .map((t) => (
                      <button
                        key={t.id}
                        onClick={() => doMerge(t.id)}
                        disabled={busy}
                        className="py-2 rounded-lg text-sm border border-neutral-700 hover:border-gold-400/60 hover:bg-neutral-900 text-neutral-100 transition"
                      >
                        {t.name}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Réservation : formulaire */}
            {resOpen && (
              <div className="mt-3 border-t border-neutral-800 pt-3 space-y-2">
                <input
                  value={resForm.customerName}
                  onChange={(e) => setResForm({ ...resForm, customerName: e.target.value })}
                  placeholder="Nom du client"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="datetime-local"
                    value={resForm.reservedAt}
                    onChange={(e) => setResForm({ ...resForm, reservedAt: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400"
                  />
                  <input
                    type="number"
                    min="1"
                    value={resForm.partySize}
                    onChange={(e) => setResForm({ ...resForm, partySize: e.target.value })}
                    placeholder="Nb pers."
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400"
                  />
                </div>
                <button
                  onClick={submitReservation}
                  disabled={busy}
                  className="w-full bg-sky-500 hover:bg-sky-400 text-black font-bold py-2.5 rounded-xl transition disabled:opacity-40"
                >
                  Confirmer la réservation
                </button>
              </div>
            )}

            {/* Sous-bloc règlement */}
            {settleOpen && canSettle && (
              <div className="mt-4 border-t border-neutral-800 pt-4">
                <div className="text-center bg-neutral-900 border border-neutral-800 rounded-xl py-2 mb-3">
                  <div className="text-xs text-neutral-400">Addition</div>
                  <div className="text-2xl font-bold text-gold-400">{formatFCFA(total)}</div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {(['espèces', 'mobile_money', 'carte', 'virement', 'qr_code'] as PaymentMethod[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setPaymentMethod(m)}
                      className={`py-2 rounded-lg text-xs font-medium border-2 transition ${
                        paymentMethod === m ? 'border-gold-400 bg-gold-400/10 text-gold-300' : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
                      }`}
                    >
                      {SETTLE_LABELS[m]}
                    </button>
                  ))}
                </div>
                {paymentMethod === 'espèces' && (
                  <div className="mb-3">
                    <input
                      type="number"
                      min="0"
                      value={cashGiven}
                      onChange={(e) => setCashGiven(e.target.value)}
                      placeholder="Montant remis"
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400"
                    />
                    {cashGiven !== '' &&
                      (change >= 0 ? (
                        <p className="text-emerald-400 text-sm mt-1">Monnaie : {formatFCFA(change)}</p>
                      ) : (
                        <p className="text-rose-400 text-sm mt-1">Montant insuffisant</p>
                      ))}
                  </div>
                )}
                {paymentMethod === 'mobile_money' && (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <button
                      onClick={() => setProvider('orange_money')}
                      className={`py-2 rounded-lg text-xs font-medium border-2 transition ${
                        provider === 'orange_money' ? 'border-orange-500 bg-orange-500/10 text-orange-300' : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
                      }`}
                    >
                      Orange Money
                    </button>
                    <button
                      onClick={() => setProvider('wave')}
                      className={`py-2 rounded-lg text-xs font-medium border-2 transition ${
                        provider === 'wave' ? 'border-sky-500 bg-sky-500/10 text-sky-300' : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
                      }`}
                    >
                      Wave
                    </button>
                    <button
                      onClick={() => setProvider('mtn')}
                      className={`py-2 rounded-lg text-xs font-medium border-2 transition ${
                        provider === 'mtn' ? 'border-yellow-500 bg-yellow-500/10 text-yellow-300' : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
                      }`}
                    >
                      MTN
                    </button>
                  </div>
                )}
                <button
                  onClick={confirmSettle}
                  disabled={!canConfirmSettle || busy}
                  className="w-full flex items-center justify-center gap-2 bg-gold-400 hover:bg-gold-300 disabled:opacity-40 text-black font-bold py-2.5 rounded-xl transition"
                >
                  <CheckCircle className="w-5 h-5" /> {busy ? 'Règlement...' : 'Valider le règlement'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reçu d'encaissement (handoff caisse → serveur assigné) */}
      {settleReceipt && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print">
          <div className="bg-neutral-950 border border-neutral-800 ring-1 ring-white/10 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-sm p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-3 text-emerald-400">
              <CheckCircle className="w-6 h-6" />
              <span className="font-bold text-neutral-100">Addition encaissée</span>
            </div>

            {/* Reçu imprimable : reste blanc pour l'impression. */}
            <div className="print-area bg-white text-gray-800 rounded-xl p-5 text-sm">
              <div className="text-center mb-2">
                <h3 className="text-lg font-bold">Restaurant Pilote</h3>
                <p className="text-gray-500">Reçu d'encaissement</p>
              </div>
              <p className="text-center text-gray-600 mb-0.5">{settleReceipt.tableName}</p>
              {settleReceipt.serverName && (
                <p className="text-center text-gray-600 mb-0.5">Serveur : {settleReceipt.serverName}</p>
              )}
              <p className="text-center text-gray-500 mb-3">{formatDateTime(settleReceipt.time)}</p>
              <div className="border-t border-b py-2 space-y-1">
                <div className="flex justify-between">
                  <span>Commandes réglées</span>
                  <span>{settleReceipt.paidCount}</span>
                </div>
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span>{formatFCFA(settleReceipt.total)}</span>
                </div>
              </div>
              <div className="pt-2 text-gray-600">
                <div className="flex justify-between">
                  <span>Paiement</span>
                  <span>{SETTLE_LABELS[settleReceipt.paymentMethod] ?? settleReceipt.paymentMethod}</span>
                </div>
                {settleReceipt.cashGiven !== undefined && (
                  <>
                    <div className="flex justify-between">
                      <span>Reçu</span>
                      <span>{formatFCFA(settleReceipt.cashGiven)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Monnaie</span>
                      <span>{formatFCFA(settleReceipt.change)}</span>
                    </div>
                  </>
                )}
              </div>
              {settleReceipt.serverName && (
                <p className="text-center text-gray-500 mt-3">À remettre au serveur : {settleReceipt.serverName}</p>
              )}
              <p className="text-center text-gray-500 mt-1">Merci de votre visite !</p>
            </div>

            <div className="flex gap-2 mt-4 no-print">
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-100 border border-neutral-700 py-2.5 rounded-xl font-semibold transition"
              >
                <Printer className="w-5 h-5" /> Imprimer
              </button>
              <button
                onClick={() => setSettleReceipt(null)}
                className="flex-1 bg-gold-400 hover:bg-gold-300 text-black font-bold py-2.5 rounded-xl transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Réservations */}
      {showReservations && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-950 border border-neutral-800 ring-1 ring-white/10 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2 text-neutral-100">
                <CalendarDays className="w-5 h-5 text-sky-300" /> Réservations
              </h3>
              <button onClick={() => setShowReservations(false)} className="text-neutral-500 hover:text-neutral-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-2 mb-3 text-sm">{error}</div>}
            <div className="space-y-2">
              {reservations.map((r) => (
                <div key={r.id} className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-neutral-100">{r.customerName}</span>
                    <span className="text-sky-300 text-xs">{r.table?.name}</span>
                  </div>
                  <div className="text-xs text-neutral-400 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatDateTime(r.reservedAt)}
                    {r.partySize ? ` · ${r.partySize} pers.` : ''}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => honorRes(r.id)} className="text-xs bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-3 py-1 rounded-lg">
                      Honorée
                    </button>
                    <button onClick={() => cancelRes(r.id)} className="text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 px-3 py-1 rounded-lg">
                      Annuler
                    </button>
                  </div>
                </div>
              ))}
              {reservations.length === 0 && <p className="text-neutral-500 text-sm text-center py-4">Aucune réservation à venir</p>}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
