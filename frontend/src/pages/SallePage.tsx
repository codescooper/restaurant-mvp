import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, Users, X, CreditCard, CheckCircle, Plus, Minus, Bell, Merge, CalendarDays, Clock, Printer, Pencil, Trash2, Wallet, Utensils } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { tableApi, orderApi, dishApi, ReservationPayload, SplitPaymentLine } from '../services/endpoints';
import { getApiError } from '../services/api';
import { RestaurantTable, Reservation, MenuDish } from '../types';
import { formatFCFA, formatDateTime, formatTime } from '../utils/format';
import PaymentSplit, { PaymentLine } from '../components/PaymentSplit';

type PaymentMethod = '' | 'espèces' | 'mobile_money' | 'carte' | 'virement' | 'qr_code' | 'mixte';
type Provider = '' | 'orange_money' | 'wave' | 'mtn';

// Marges après la fin du repas avant que la table soit de nouveau libre (miroir de constants.ts backend).
const GRACE_MINUTES = 30; // tolérance laissée au client
const CLEANING_MINUTES = 30; // nettoyage + remise en place
// Durées proposées pour le repas (minutes).
const DURATION_OPTIONS = [60, 90, 120, 150, 180];

// ISO → valeur pour <input type="datetime-local"> (heure locale, sans secondes).
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Calcule fin du repas + heure de libération de la table à partir du début et de la durée.
function reservationTimes(reservedAt: string | Date, durationMinutes: number) {
  const start = typeof reservedAt === 'string' ? new Date(reservedAt) : reservedAt;
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const free = new Date(end.getTime() + (GRACE_MINUTES + CLEANING_MINUTES) * 60000);
  return { start, end, free };
}

const SETTLE_LABELS: Record<string, string> = {
  espèces: 'Espèces',
  mobile_money: 'Mobile',
  carte: 'Carte',
  virement: 'Virement',
  qr_code: 'QR Code',
  mixte: 'Mixte',
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
// Modes de paiement de l'acompte (valeurs alignées sur PAYMENT_METHODS backend).
const DEPOSIT_METHODS: { value: string; label: string }[] = [
  { value: 'espèces', label: 'Espèces' },
  { value: 'mobile_money', label: 'Mobile' },
  { value: 'carte', label: 'Carte' },
  { value: 'virement', label: 'Virement' },
  { value: 'qr_code', label: 'QR Code' },
];
const PAY_STATUS_LABEL: Record<string, string> = { aucun: 'Non réglé', avance: 'Acompte versé', réglé: 'Réglé' };
const PAY_STATUS_BADGE: Record<string, string> = {
  aucun: 'bg-neutral-700/40 text-neutral-300',
  avance: 'bg-amber-500/20 text-amber-300',
  réglé: 'bg-emerald-500/20 text-emerald-300',
};

const EMPTY_RES = {
  customerName: '',
  customerPhone: '',
  partySize: '',
  reservedAt: '',
  durationMinutes: '90',
  hasPreOrder: false,
  totalAmount: '',
  depositAmount: '',
  depositMethod: 'espèces',
};

const INPUT_CLS =
  'w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400';

// Ligne de pré-commande côté formulaire (prix figé à l'ajout).
interface ResItem {
  dishId: number;
  dishName: string;
  variantId?: number;
  variantName?: string;
  unitPrice: number;
  quantity: number;
}

export default function SallePage() {
  const { currentRole } = useAuth();
  const { socket } = useWebSocket();
  const navigate = useNavigate();

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [settleOpen, setSettleOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('');
  const [provider, setProvider] = useState<Provider>('');
  const [cashGiven, setCashGiven] = useState('');
  const [tip, setTip] = useState('');
  const [mixteState, setMixteState] = useState<{ payments: PaymentLine[]; valid: boolean }>({ payments: [], valid: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Reçu imprimable après encaissement d'une table : indique le serveur assigné (handoff caisse → serveur).
  const [settleReceipt, setSettleReceipt] = useState<{
    tableName: string;
    serverName?: string;
    paidCount: number;
    total: number;
    deposit: number;
    tip: number;
    change: number;
    paymentMethod: string;
    cashGiven?: number;
    time: string;
    paymentLines?: { label: string; amount: number }[];
  } | null>(null);

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [showReservations, setShowReservations] = useState(false);
  const [resForm, setResForm] = useState({ ...EMPTY_RES });
  const [resItems, setResItems] = useState<ResItem[]>([]);
  const [resOpen, setResOpen] = useState(false);
  const [editingResId, setEditingResId] = useState<number | null>(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [menu, setMenu] = useState<MenuDish[]>([]);
  // Sélecteur de plat pour la pré-commande.
  const [pickDishId, setPickDishId] = useState('');
  const [pickVariantId, setPickVariantId] = useState('');

  const canSettle = currentRole === 'caissier' || currentRole === 'administrateur' || currentRole === 'propriétaire';
  const canOrder = currentRole === 'serveur' || currentRole === 'caissier' || currentRole === 'administrateur' || currentRole === 'propriétaire';

  const load = useCallback(() => {
    tableApi.list().then(setTables).catch((e) => setError(getApiError(e)));
    tableApi.reservations().then(setReservations).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Menu chargé une fois (sélecteur de pré-commande).
  useEffect(() => {
    dishApi.menu().then(setMenu).catch(() => {});
  }, []);

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
  // Acompte de réservation à déduire au règlement (plafonné au total de l'addition).
  const resDeposit = Math.min(selected?.reservation?.depositAmount ?? 0, total);
  // Pourboire (hors total) : pour les espèces, le montant remis couvre (net + pourboire).
  const tipNum = Math.max(0, Number(tip) || 0);
  // Net à encaisser = addition − acompte déjà versé + pourboire.
  const due = total - resDeposit + tipNum;
  const change = (Number(cashGiven) || 0) - due;

  const closePanel = () => {
    setSelectedId(null);
    setSettleOpen(false);
    setPaymentMethod('');
    setProvider('');
    setCashGiven('');
    setTip('');
    setMixteState({ payments: [], valid: false });
    setResOpen(false);
    setEditingResId(null);
    setMergeMode(false);
    setResForm({ ...EMPTY_RES });
    setResItems([]);
    setPickDishId('');
    setPickVariantId('');
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

  // --- Pré-commande : sélecteur d'items ---
  const itemsTotal = resItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  const addPickItem = () => {
    const dish = menu.find((d) => d.id === Number(pickDishId));
    if (!dish) return;
    const hasVariants = !!dish.variants && dish.variants.length > 0;
    const variant = hasVariants ? dish.variants!.find((v) => v.id === Number(pickVariantId)) : undefined;
    if (hasVariants && !variant) {
      setError('Choisissez une variante');
      return;
    }
    // variant.price est null pour les variantes sur plat libre → on utilise dish.price (prix suggéré).
    const unitPrice = (variant?.price != null ? variant.price : null) ?? dish.price;
    const next = [...resItems];
    // Regroupe si même plat+variante déjà présent.
    const existing = next.find((i) => i.dishId === dish.id && i.variantId === (variant?.id ?? undefined));
    if (existing) existing.quantity += 1;
    else next.push({ dishId: dish.id, dishName: dish.name, variantId: variant?.id, variantName: variant?.name, unitPrice, quantity: 1 });
    setResItems(next);
    const newTotal = next.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    setResForm((f) => ({ ...f, totalAmount: String(newTotal) }));
    setPickDishId('');
    setPickVariantId('');
    setError('');
  };

  const changeItemQty = (idx: number, delta: number) => {
    const next = resItems.map((it, i) => (i === idx ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it));
    setResItems(next);
    setResForm((f) => ({ ...f, totalAmount: String(next.reduce((s, i) => s + i.unitPrice * i.quantity, 0)) }));
  };

  const removeResItem = (idx: number) => {
    const next = resItems.filter((_, i) => i !== idx);
    setResItems(next);
    setResForm((f) => ({ ...f, totalAmount: String(next.reduce((s, i) => s + i.unitPrice * i.quantity, 0)) }));
  };

  const openReserveForm = () => {
    setEditingResId(null);
    setResForm({ ...EMPTY_RES });
    setResItems([]);
    setResOpen(true);
    setError('');
  };

  // Édition : ouvre le formulaire pré-rempli depuis une réservation complète (liste).
  const openEditReservation = (r: Reservation) => {
    setShowReservations(false);
    setSelectedId(r.tableId);
    setEditingResId(r.id);
    setMergeMode(false);
    setSettleOpen(false);
    setResForm({
      customerName: r.customerName,
      customerPhone: r.customerPhone ?? '',
      partySize: r.partySize ? String(r.partySize) : '',
      reservedAt: toLocalInput(r.reservedAt),
      durationMinutes: String(r.durationMinutes),
      hasPreOrder: r.hasPreOrder,
      totalAmount: String(r.totalAmount ?? 0),
      depositAmount: r.depositAmount ? String(r.depositAmount) : '',
      depositMethod: r.depositMethod || 'espèces',
    });
    setResItems(
      (r.items ?? []).map((it) => ({
        dishId: it.dishId ?? 0,
        dishName: it.dishName,
        variantId: it.variantId ?? undefined,
        variantName: it.variantName ?? undefined,
        unitPrice: it.dishPrice,
        quantity: it.quantity,
      }))
    );
    setResOpen(true);
    setError('');
  };

  // Depuis le plan de salle (info compacte) → retrouve la réservation complète pour l'éditer.
  const editFromSummary = (id: number) => {
    const full = reservations.find((r) => r.id === id);
    if (full) openEditReservation(full);
    else setError('Réservation introuvable, rechargez la page');
  };

  const submitReservation = async () => {
    const tableId = selected?.id;
    if (!tableId) return;
    if (!resForm.customerName.trim() || !resForm.reservedAt) {
      setError('Nom du client et heure requis');
      return;
    }
    const depositAmount = Number(resForm.depositAmount) || 0;
    const totalAmount = Number(resForm.totalAmount) || 0;
    if (depositAmount > 0 && totalAmount > 0 && depositAmount > totalAmount) {
      setError("L'acompte ne peut pas dépasser le total");
      return;
    }
    const payload: ReservationPayload = {
      tableId,
      customerName: resForm.customerName.trim(),
      customerPhone: resForm.customerPhone || undefined,
      partySize: resForm.partySize ? Number(resForm.partySize) : undefined,
      reservedAt: new Date(resForm.reservedAt).toISOString(),
      durationMinutes: Number(resForm.durationMinutes) || 90,
      hasPreOrder: resForm.hasPreOrder,
      items: resForm.hasPreOrder ? resItems.map((i) => ({ dishId: i.dishId, variantId: i.variantId, quantity: i.quantity })) : [],
      totalAmount,
      depositAmount,
      depositMethod: depositAmount > 0 ? resForm.depositMethod : undefined,
    };
    setBusy(true);
    setError('');
    try {
      if (editingResId) await tableApi.updateReservation(editingResId, payload);
      else await tableApi.createReservation(payload);
      closePanel();
      load();
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const arriveRes = async (id: number) => {
    setBusy(true);
    setError('');
    try {
      await tableApi.arriveReservation(id);
      load();
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const cancelRes = async (id: number, depositAmount = 0) => {
    let refund = false;
    if (depositAmount > 0) {
      // Acompte non consommé : rembourser (argent rendu) ou conserver (pénalité no-show).
      refund = window.confirm(
        `Acompte de ${formatFCFA(depositAmount)} versé.\n\nOK = REMBOURSER au client (l'argent ressort de la caisse)\nAnnuler = CONSERVER comme pénalité (reste en caisse)`
      );
    } else if (!window.confirm('Annuler cette réservation ?')) {
      return;
    }
    try {
      await tableApi.cancelReservation(id, refund);
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

  // due hors pourboire = ce que PaymentSplit doit couvrir.
  const dueHorsPourboire = total - resDeposit;

  const canConfirmSettle =
    paymentMethod === 'mixte'
      ? mixteState.valid
      : !!paymentMethod &&
        (paymentMethod !== 'espèces' || change >= 0) &&
        (paymentMethod !== 'mobile_money' || !!provider);

  const confirmSettle = async () => {
    if (!selected || !canConfirmSettle) return;
    setBusy(true);
    setError('');
    // Capturé avant closePanel (qui réinitialise la table sélectionnée).
    const tName = selected.name;
    const sName = selected.server?.displayName ?? undefined;
    const given = paymentMethod === 'espèces' ? Number(cashGiven) || 0 : undefined;
    try {
      const splitPayments: SplitPaymentLine[] | undefined =
        paymentMethod === 'mixte'
          ? mixteState.payments.map((p) => ({
              method: p.method,
              amount: p.amount,
              mobileMoneyProvider: p.mobileMoneyProvider,
              cashGiven: p.cashGiven,
              changeReturned: p.changeReturned,
            } as SplitPaymentLine))
          : undefined;
      const res = await tableApi.settle(
        selected.id,
        paymentMethod === 'mixte' ? 'espèces' : paymentMethod || 'espèces', // backend remplace par 'mixte' si payments présent
        paymentMethod === 'mixte'
          ? undefined
          : {
              mobileMoneyProvider: paymentMethod === 'mobile_money' ? provider || undefined : undefined,
              cashGiven: paymentMethod === 'espèces' ? Number(cashGiven) || 0 : undefined,
              changeReturned: paymentMethod === 'espèces' ? Math.max(0, change) : undefined,
            },
        tipNum > 0 ? { tipAmount: tipNum, tipMethod: paymentMethod === 'mixte' ? 'espèces' : paymentMethod || 'espèces' } : undefined,
        splitPayments
      );
      setSettleReceipt({
        tableName: tName,
        serverName: sName,
        paidCount: res.paidCount,
        total: res.total,
        deposit: res.depositApplied ?? 0,
        tip: res.tip,
        change: res.change,
        paymentMethod: res.paymentMethod,
        cashGiven: given,
        time: new Date().toISOString(),
        paymentLines:
          paymentMethod === 'mixte'
            ? mixteState.payments.map((p) => ({
                label: `${SETTLE_LABELS[p.method] ?? p.method}${p.method === 'mobile_money' && p.mobileMoneyProvider ? ` (${p.mobileMoneyProvider})` : ''}`,
                amount: p.amount,
              }))
            : undefined,
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
                  {t.server && <div className="text-xs text-neutral-400">Serveur : {t.server.displayName ?? '—'}</div>}
                  {t.hasUnpaid && <div className="text-xs text-gold-300">À régler : {formatFCFA(t.unpaidTotal)}</div>}
                </div>
              )}
              {t.status === 'réservée' && t.reservation && (
                <div className="mt-2 text-xs text-sky-300">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatTime(t.reservation.reservedAt)}
                    {t.reservation.endAt ? `–${formatTime(t.reservation.endAt)}` : ''} · {t.reservation.customerName}
                  </div>
                  {t.reservation.availableAgainAt && (
                    <div className="text-[11px] text-neutral-500 mt-0.5">Libre à {formatTime(t.reservation.availableAgainAt)} (nettoyage inclus)</div>
                  )}
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
              {selected.server && <span className="text-neutral-400">Serveur : {selected.server.displayName ?? '—'}</span>}
            </div>

            {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-2 mb-3 text-sm">{error}</div>}

            {/* Réservation en cours sur cette table */}
            {selected.reservation && !(resOpen && editingResId === selected.reservation.id) && (
              <div className="bg-sky-500/10 border border-sky-500/30 rounded-lg p-3 mb-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-sky-300 font-medium">
                    <CalendarDays className="w-4 h-4" /> Réservée
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${PAY_STATUS_BADGE[selected.reservation.paymentStatus ?? 'aucun']}`}>
                    {PAY_STATUS_LABEL[selected.reservation.paymentStatus ?? 'aucun']}
                  </span>
                </div>
                <div className="text-neutral-300 mt-1">
                  {selected.reservation.customerName}
                  {selected.reservation.partySize ? ` · ${selected.reservation.partySize} pers.` : ''}
                </div>
                <div className="text-neutral-400 text-xs mt-1">
                  {formatDateTime(selected.reservation.reservedAt)}
                  {selected.reservation.endAt ? ` → fin ${formatTime(selected.reservation.endAt)}` : ''}
                </div>
                {selected.reservation.availableAgainAt && (
                  <div className="text-neutral-500 text-xs mt-0.5">
                    Table de nouveau libre à {formatTime(selected.reservation.availableAgainAt)} (+30 min marge, +30 min nettoyage)
                  </div>
                )}
                {selected.reservation.hasPreOrder && selected.reservation.items && selected.reservation.items.length > 0 && (
                  <div className="mt-2 border-t border-sky-500/20 pt-2">
                    <div className="flex items-center gap-1 text-xs text-neutral-400 mb-1"><Utensils className="w-3 h-3" /> Pré-commande</div>
                    {selected.reservation.items.map((it) => (
                      <div key={it.id} className="flex justify-between text-xs text-neutral-300">
                        <span>{it.quantity}× {it.dishName}{it.variantName ? ` (${it.variantName})` : ''}</span>
                        <span className="text-neutral-400">{formatFCFA(it.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {((selected.reservation.totalAmount ?? 0) > 0 || (selected.reservation.depositAmount ?? 0) > 0) && (
                  <div className="mt-2 border-t border-sky-500/20 pt-2 text-xs space-y-0.5">
                    <div className="flex justify-between text-neutral-300"><span>Coût total</span><span>{formatFCFA(selected.reservation.totalAmount ?? 0)}</span></div>
                    {(selected.reservation.depositAmount ?? 0) > 0 && (
                      <div className="flex justify-between text-neutral-300"><span>Acompte versé</span><span className="text-emerald-300">{formatFCFA(selected.reservation.depositAmount ?? 0)}</span></div>
                    )}
                    <div className="flex justify-between font-semibold text-neutral-100">
                      <span>Reste à payer</span>
                      <span className="text-gold-400">
                        {formatFCFA(selected.reservation.remaining ?? Math.max(0, (selected.reservation.totalAmount ?? 0) - (selected.reservation.depositAmount ?? 0)))}
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  {canOrder && selected.reservation.hasPreOrder && selected.orders.length === 0 && (
                    <button onClick={() => arriveRes(selected.reservation!.id)} disabled={busy} className="text-xs bg-gold-400 hover:bg-gold-300 text-black font-semibold px-3 py-1 rounded-lg flex items-center gap-1 disabled:opacity-40">
                      <CheckCircle className="w-3 h-3" /> Client arrivé (envoyer en cuisine)
                    </button>
                  )}
                  {canOrder && (
                    <button onClick={() => editFromSummary(selected.reservation!.id)} className="text-xs bg-sky-500 hover:bg-sky-400 text-black font-semibold px-3 py-1 rounded-lg flex items-center gap-1">
                      <Pencil className="w-3 h-3" /> Modifier
                    </button>
                  )}
                  <button onClick={() => honorRes(selected.reservation!.id)} className="text-xs bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-3 py-1 rounded-lg">
                    Marquer honorée
                  </button>
                  <button onClick={() => cancelRes(selected.reservation!.id, selected.reservation!.depositAmount ?? 0)} className="text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 px-3 py-1 rounded-lg">
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
              {canOrder && selected.status === 'libre' && !resOpen && (
                <button
                  onClick={openReserveForm}
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
                <div className="flex items-center gap-2 text-sm font-semibold text-sky-300">
                  <CalendarDays className="w-4 h-4" /> {editingResId ? 'Modifier la réservation' : 'Nouvelle réservation'}
                </div>
                <input
                  value={resForm.customerName}
                  onChange={(e) => setResForm({ ...resForm, customerName: e.target.value })}
                  placeholder="Nom du client"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400"
                />
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Heure de réservation</label>
                  <input
                    type="datetime-local"
                    value={resForm.reservedAt}
                    onChange={(e) => setResForm({ ...resForm, reservedAt: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Durée</label>
                    <select
                      value={resForm.durationMinutes}
                      onChange={(e) => setResForm({ ...resForm, durationMinutes: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400"
                    >
                      {DURATION_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          {m % 60 === 0 ? `${m / 60} h` : `${Math.floor(m / 60)} h ${m % 60}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Nb pers.</label>
                    <input
                      type="number"
                      min="1"
                      value={resForm.partySize}
                      onChange={(e) => setResForm({ ...resForm, partySize: e.target.value })}
                      placeholder="Nb pers."
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400"
                    />
                  </div>
                </div>
                {resForm.reservedAt && (
                  <div className="bg-sky-500/5 border border-sky-500/20 rounded-lg p-2.5 text-xs space-y-0.5">
                    <div className="flex justify-between text-neutral-200">
                      <span>Fin du repas</span>
                      <span className="font-semibold text-sky-300">
                        {formatTime(reservationTimes(resForm.reservedAt, Number(resForm.durationMinutes) || 90).end)}
                      </span>
                    </div>
                    <div className="text-neutral-500">+{GRACE_MINUTES} min de marge client · +{CLEANING_MINUTES} min nettoyage</div>
                    <div className="flex justify-between text-neutral-200 pt-0.5 border-t border-neutral-800 mt-1">
                      <span>Table de nouveau libre</span>
                      <span className="font-semibold text-emerald-300">
                        {formatTime(reservationTimes(resForm.reservedAt, Number(resForm.durationMinutes) || 90).free)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Pré-commande nourriture / boisson */}
                <div className="border-t border-neutral-800 pt-2">
                  <label className="flex items-center gap-2 text-sm text-neutral-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={resForm.hasPreOrder}
                      onChange={(e) => setResForm({ ...resForm, hasPreOrder: e.target.checked })}
                      className="accent-sky-500 w-4 h-4"
                    />
                    <Utensils className="w-4 h-4 text-sky-300" /> Nourriture / boisson commandées ici
                  </label>
                  {resForm.hasPreOrder && (
                    <div className="mt-2 space-y-2">
                      <div className="flex gap-2">
                        <select
                          value={pickDishId}
                          onChange={(e) => { setPickDishId(e.target.value); setPickVariantId(''); }}
                          className="flex-1 min-w-0 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-2 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-gold-400/60"
                        >
                          <option value="">Choisir un plat / boisson…</option>
                          {menu.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                        {(() => {
                          const d = menu.find((x) => x.id === Number(pickDishId));
                          return d && d.variants && d.variants.length ? (
                            <select
                              value={pickVariantId}
                              onChange={(e) => setPickVariantId(e.target.value)}
                              className="w-28 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-2 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-gold-400/60"
                            >
                              <option value="">Variante…</option>
                              {d.variants.map((v) => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                              ))}
                            </select>
                          ) : null;
                        })()}
                        <button
                          onClick={addPickItem}
                          disabled={!pickDishId}
                          className="bg-sky-500 hover:bg-sky-400 text-black px-3 rounded-lg disabled:opacity-40"
                          title="Ajouter"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      {resItems.length > 0 && (
                        <div className="space-y-1">
                          {resItems.map((it, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1.5 text-sm">
                              <span className="flex-1 min-w-0 truncate text-neutral-200">
                                {it.dishName}{it.variantName ? ` (${it.variantName})` : ''}
                              </span>
                              <button onClick={() => changeItemQty(idx, -1)} className="text-neutral-400 hover:text-neutral-200"><Minus className="w-4 h-4" /></button>
                              <span className="w-5 text-center text-neutral-100">{it.quantity}</span>
                              <button onClick={() => changeItemQty(idx, 1)} className="text-neutral-400 hover:text-neutral-200"><Plus className="w-4 h-4" /></button>
                              <span className="w-20 text-right text-neutral-300">{formatFCFA(it.unitPrice * it.quantity)}</span>
                              <button onClick={() => removeResItem(idx)} className="text-rose-400 hover:text-rose-300"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          ))}
                          <div className="flex justify-between text-xs text-neutral-400 px-1">
                            <span>Total plats</span>
                            <span className="text-neutral-200 font-semibold">{formatFCFA(itemsTotal)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Paiement : coût total, acompte, reste */}
                <div className="border-t border-neutral-800 pt-2 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-neutral-200"><Wallet className="w-4 h-4 text-gold-400" /> Paiement</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Coût total (FCFA)</label>
                      <input type="number" min="0" value={resForm.totalAmount} onChange={(e) => setResForm({ ...resForm, totalAmount: e.target.value })} placeholder="0" className={INPUT_CLS} />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Acompte versé (FCFA)</label>
                      <input type="number" min="0" value={resForm.depositAmount} onChange={(e) => setResForm({ ...resForm, depositAmount: e.target.value })} placeholder="0" className={INPUT_CLS} />
                    </div>
                  </div>
                  {Number(resForm.depositAmount) > 0 && (
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Mode de l'acompte</label>
                      <select value={resForm.depositMethod} onChange={(e) => setResForm({ ...resForm, depositMethod: e.target.value })} className={INPUT_CLS}>
                        {DEPOSIT_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                      {resForm.depositMethod === 'espèces' && (
                        <p className="text-[11px] text-neutral-500 mt-1">Acompte espèces : nécessite une caisse ouverte, ajouté au théorique de caisse.</p>
                      )}
                    </div>
                  )}
                  {(Number(resForm.totalAmount) > 0 || Number(resForm.depositAmount) > 0) && (
                    <div className="flex justify-between items-center text-sm bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2">
                      <span className="text-neutral-400">Reste à payer</span>
                      <span className="font-bold text-gold-400">
                        {formatFCFA(Math.max(0, (Number(resForm.totalAmount) || 0) - (Number(resForm.depositAmount) || 0)))}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {editingResId && (
                    <button onClick={closePanel} className="px-4 py-2.5 rounded-xl border border-neutral-700 text-neutral-200 hover:bg-neutral-800 transition">
                      Annuler
                    </button>
                  )}
                  <button
                    onClick={submitReservation}
                    disabled={busy}
                    className="flex-1 bg-sky-500 hover:bg-sky-400 text-black font-bold py-2.5 rounded-xl transition disabled:opacity-40"
                  >
                    {editingResId ? 'Enregistrer les modifications' : 'Confirmer la réservation'}
                  </button>
                </div>
              </div>
            )}

            {/* Sous-bloc règlement */}
            {settleOpen && canSettle && (
              <div className="mt-4 border-t border-neutral-800 pt-4">
                <div className="text-center bg-neutral-900 border border-neutral-800 rounded-xl py-2 mb-3">
                  <div className="text-xs text-neutral-400">Addition</div>
                  <div className="text-2xl font-bold text-gold-400">{formatFCFA(total)}</div>
                  {resDeposit > 0 && (
                    <div className="mt-1 text-xs space-y-0.5 border-t border-neutral-800 pt-1">
                      <div className="flex justify-between px-4 text-emerald-300"><span>Acompte déjà versé</span><span>− {formatFCFA(resDeposit)}</span></div>
                      <div className="flex justify-between px-4 font-semibold text-neutral-100"><span>Net à encaisser</span><span>{formatFCFA(total - resDeposit)}</span></div>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {(['espèces', 'mobile_money', 'carte', 'virement', 'qr_code', 'mixte'] as PaymentMethod[]).map((m) => (
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
                <div className="mb-3">
                  <label className="block text-xs text-neutral-400 mb-1">Pourboire (optionnel)</label>
                  <input
                    type="number"
                    min="0"
                    value={tip}
                    onChange={(e) => setTip(e.target.value)}
                    placeholder="0"
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400"
                  />
                  {tipNum > 0 && <p className="text-emerald-400 text-xs mt-1">Total encaissé : {formatFCFA(due)}</p>}
                </div>
                {paymentMethod === 'mixte' ? (
                  <div className="mb-3">
                    <PaymentSplit due={dueHorsPourboire} onChange={setMixteState} />
                  </div>
                ) : (
                  <>
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
                  </>
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
                {settleReceipt.deposit > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Acompte déjà versé</span>
                    <span>− {formatFCFA(settleReceipt.deposit)}</span>
                  </div>
                )}
              </div>
              <div className="pt-2 text-gray-600">
                {settleReceipt.paymentLines && settleReceipt.paymentLines.length > 1 ? (
                  <>
                    <div className="flex justify-between font-medium mb-0.5">
                      <span>Paiement mixte</span>
                    </div>
                    {settleReceipt.paymentLines.map((pl, i) => (
                      <div key={i} className="flex justify-between pl-2 text-sm">
                        <span className="capitalize">{pl.label}</span>
                        <span>{formatFCFA(pl.amount)}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span>Paiement</span>
                    <span>{SETTLE_LABELS[settleReceipt.paymentMethod] ?? settleReceipt.paymentMethod}</span>
                  </div>
                )}
                {settleReceipt.tip > 0 && (
                  <div className="flex justify-between">
                    <span>Pourboire</span>
                    <span>{formatFCFA(settleReceipt.tip)}</span>
                  </div>
                )}
                {(settleReceipt.tip > 0 || settleReceipt.deposit > 0) && (
                  <div className="flex justify-between font-semibold">
                    <span>Net encaissé</span>
                    <span>{formatFCFA(settleReceipt.total - settleReceipt.deposit + settleReceipt.tip)}</span>
                  </div>
                )}
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
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-medium text-neutral-100">{r.customerName}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${PAY_STATUS_BADGE[r.paymentStatus ?? 'aucun']}`}>
                        {PAY_STATUS_LABEL[r.paymentStatus ?? 'aucun']}
                      </span>
                      <span className="text-sky-300 text-xs">{r.table?.name}</span>
                    </div>
                  </div>
                  <div className="text-xs text-neutral-400 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatDateTime(r.reservedAt)}
                    {r.endAt ? ` → ${formatTime(r.endAt)}` : ''}
                    {r.partySize ? ` · ${r.partySize} pers.` : ''}
                  </div>
                  {r.availableAgainAt && (
                    <div className="text-[11px] text-neutral-500 mt-0.5">Table libre à {formatTime(r.availableAgainAt)} (nettoyage inclus)</div>
                  )}
                  {r.hasPreOrder && r.items && r.items.length > 0 && (
                    <div className="text-[11px] text-neutral-400 mt-1 flex items-start gap-1">
                      <Utensils className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{r.items.map((it) => `${it.quantity}× ${it.dishName}`).join(', ')}</span>
                    </div>
                  )}
                  {((r.totalAmount ?? 0) > 0 || (r.depositAmount ?? 0) > 0) && (
                    <div className="text-[11px] text-neutral-400 mt-1">
                      Total {formatFCFA(r.totalAmount ?? 0)} · Acompte {formatFCFA(r.depositAmount ?? 0)} ·{' '}
                      <span className="text-gold-400 font-semibold">Reste {formatFCFA(r.remaining ?? Math.max(0, (r.totalAmount ?? 0) - (r.depositAmount ?? 0)))}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {canOrder && (
                      <button onClick={() => openEditReservation(r)} className="text-xs bg-sky-500 hover:bg-sky-400 text-black font-semibold px-3 py-1 rounded-lg flex items-center gap-1">
                        <Pencil className="w-3 h-3" /> Modifier
                      </button>
                    )}
                    <button onClick={() => honorRes(r.id)} className="text-xs bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-3 py-1 rounded-lg">
                      Honorée
                    </button>
                    <button onClick={() => cancelRes(r.id, r.depositAmount ?? 0)} className="text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 px-3 py-1 rounded-lg">
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
