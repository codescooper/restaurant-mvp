import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  Printer,
  X,
  WifiOff,
  LayoutGrid,
  Lock,
  Unlock,
  Banknote,
  Inbox,
  Ticket,
  Gift,
  ClipboardList,
  RotateCcw,
  Ban,
  ShieldCheck,
  Coins,
  Search,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useClock } from '../hooks/useClock';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { dishApi, orderApi, cashApi, promotionApi, settingsApi, CreateOrderPayload } from '../services/endpoints';
import { cacheMenu, getCachedMenu, queueOrder } from '../services/offline';
import { getApiError } from '../services/api';
import { CartItem, MenuDish, MenuVariant, CashSessionSummary, Order } from '../types';
import { formatFCFA, formatDateTime } from '../utils/format';

const CATEGORIES = ['Tout', 'Entrée', 'Plat', 'Dessert', 'Boisson'];
const EMOJI: Record<string, string> = {
  Entrée: '🥗',
  Plat: '🍛',
  Dessert: '🍰',
  Boisson: '🥤',
};

type DiscountType = 'none' | 'amount' | 'percent';
type PaymentMethod = '' | 'espèces' | 'mobile_money' | 'carte' | 'virement' | 'qr_code';
type Provider = '' | 'orange_money' | 'wave' | 'mtn';
type Channel = 'sur_place' | 'emporter' | 'livraison';
type DeliveryPlatform = '' | 'glovo' | 'yango' | 'uber_eats' | 'autre';

const PAYMENT_LABELS: Record<string, string> = {
  espèces: 'Espèces',
  mobile_money: 'Mobile Money',
  carte: 'Carte',
  virement: 'Virement',
  qr_code: 'QR Code',
};
const CHANNEL_LABELS: Record<Channel, string> = {
  sur_place: 'Sur place',
  emporter: 'À emporter',
  livraison: 'Livraison',
};
const PLATFORM_LABELS: Record<string, string> = {
  glovo: 'Glovo',
  yango: 'Yango',
  uber_eats: 'Uber Eats',
  autre: 'Autre',
};

interface Receipt {
  orderNumber: string;
  time: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  finalTotal: number;
  paymentLabel: string;
  cashGiven?: number;
  change?: number;
  offline: boolean;
  deferred: boolean;
  tip?: number;
  tableName?: string | null;
  serverName?: string;
  channelLabel?: string;
  customerName?: string;
  discountLabel?: string;
}

// Classes réutilisables du thème noir & or (prototype Caisse).
const SHELL =
  'min-h-[calc(100vh-4rem)] bg-black text-neutral-100 bg-[radial-gradient(60rem_40rem_at_120%_-10%,rgba(212,175,55,0.08),transparent)]';
const PANEL = 'bg-neutral-950 border border-neutral-800 ring-1 ring-white/5 rounded-2xl';
const INPUT =
  'w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400';
const OVERLAY = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print';
const MODAL = 'bg-neutral-950 border border-neutral-800 ring-1 ring-white/10 rounded-2xl shadow-2xl shadow-black/60 w-full';
const BTN_GOLD = 'bg-gold-400 hover:bg-gold-300 text-black font-bold transition disabled:opacity-40 disabled:cursor-not-allowed';

export default function CaissePage() {
  const { currentUser, currentRole } = useAuth();
  const clock = useClock();
  const navigate = useNavigate();
  const { online, queuedCount } = useOfflineSync();

  const [searchParams] = useSearchParams();
  const tableId = searchParams.get('table') ? Number(searchParams.get('table')) : null;
  const tableName = searchParams.get('name') || (tableId ? `Table ${tableId}` : null);

  const [dishes, setDishes] = useState<MenuDish[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [variantPick, setVariantPick] = useState<MenuDish | null>(null);
  // Saisie de prix pour un plat à prix libre.
  const [pricePick, setPricePick] = useState<MenuDish | null>(null);
  const [priceInput, setPriceInput] = useState('');
  // Variante sélectionnée lors d'un choix sur un plat libre avec variantes.
  const [pickedLibreVariant, setPickedLibreVariant] = useState<MenuVariant | null>(null);
  const [category, setCategory] = useState('Tout');
  const [search, setSearch] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('none');
  const [discountValue, setDiscountValue] = useState('');
  const [happyHour, setHappyHour] = useState<{ name: string; discountType: 'percent' | 'amount'; discountValue: number } | null>(null);
  const [coupon, setCoupon] = useState<{ code: string; name: string; discountType: 'percent' | 'amount'; discountValue: number } | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');
  // Le serveur prend la commande mais n'encaisse jamais : règlement à la caisse uniquement.
  const isServer = currentRole === 'serveur';
  const [showPayment, setShowPayment] = useState(false);
  const [payNow, setPayNow] = useState(!tableId && !isServer);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('');
  const [provider, setProvider] = useState<Provider>('');
  const [cashGiven, setCashGiven] = useState('');
  const [tip, setTip] = useState('');
  const [channel, setChannel] = useState<Channel>('sur_place');
  const [deliveryPlatform, setDeliveryPlatform] = useState<DeliveryPlatform>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Caisse (ouverture / fermeture / tiroir)
  const canManageCash = currentRole === 'caissier' || currentRole === 'administrateur' || currentRole === 'propriétaire';
  const [session, setSession] = useState<CashSessionSummary | null>(null);
  const [cashModal, setCashModal] = useState<'open' | 'close' | null>(null);
  const [openingFloat, setOpeningFloat] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const [discrepancyReason, setDiscrepancyReason] = useState('');
  const [cashError, setCashError] = useState('');
  const [cashBusy, setCashBusy] = useState(false);

  // Panneau « Commandes du jour » (annulation / remboursement par le caissier, validation manager par PIN).
  const [showOrders, setShowOrders] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersBusy, setOrdersBusy] = useState(false);
  const [pinConfigured, setPinConfigured] = useState(false);
  const [actionOrder, setActionOrder] = useState<Order | null>(null);
  const [actionType, setActionType] = useState<'cancel' | 'refund'>('cancel');
  const [actionReason, setActionReason] = useState('');
  const [actionPin, setActionPin] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  // Le PIN n'est exigé que pour le caissier (l'admin/propriétaire est le manager) et seulement s'il est configuré.
  const pinRequired = currentRole === 'caissier' && pinConfigured;

  const loadOrders = () => {
    setOrdersBusy(true);
    orderApi
      .list()
      .then((list) => setOrders(list.slice(0, 40)))
      .catch((e) => setError(getApiError(e)))
      .finally(() => setOrdersBusy(false));
  };

  const openOrders = () => {
    setShowOrders(true);
    loadOrders();
  };

  const startAction = (order: Order, type: 'cancel' | 'refund') => {
    setActionOrder(order);
    setActionType(type);
    setActionReason('');
    setActionPin('');
    setActionError('');
  };

  const submitAction = async () => {
    if (!actionOrder) return;
    if (!actionReason.trim()) {
      setActionError('Raison requise');
      return;
    }
    if (pinRequired && !actionPin.trim()) {
      setActionError('Code manager requis');
      return;
    }
    setActionBusy(true);
    setActionError('');
    try {
      if (actionType === 'cancel') {
        await orderApi.cancel(actionOrder.id, actionReason.trim(), actionPin.trim() || undefined);
      } else {
        await orderApi.refund(actionOrder.id, actionReason.trim(), actionPin.trim() || undefined);
      }
      setActionOrder(null);
      loadOrders();
      if (canManageCash) loadSession();
    } catch (e) {
      setActionError(getApiError(e));
    } finally {
      setActionBusy(false);
    }
  };

  const loadSession = () => {
    if (!canManageCash) return;
    cashApi.current().then(setSession).catch(() => setSession(null));
  };

  useEffect(() => {
    setPayNow(!tableId && !isServer);
  }, [tableId, isServer]);

  useEffect(() => {
    loadSession();
    if (canManageCash) {
      settingsApi.getManagerPinStatus().then(setPinConfigured).catch(() => setPinConfigured(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const expectedCash = session?.expectedCash ?? 0;
  const countedNum = Number(countedCash) || 0;
  const closeDiff = countedNum - expectedCash;

  const openCash = async () => {
    setCashError('');
    setCashBusy(true);
    try {
      await cashApi.open(Number(openingFloat) || 0);
      setOpeningFloat('');
      setCashModal(null);
      loadSession();
    } catch (e) {
      setCashError(getApiError(e));
    } finally {
      setCashBusy(false);
    }
  };

  const closeCash = async () => {
    if (closeDiff !== 0 && !discrepancyReason.trim()) {
      setCashError('Justification requise pour un écart de caisse');
      return;
    }
    setCashError('');
    setCashBusy(true);
    try {
      await cashApi.close(countedNum, discrepancyReason.trim() || undefined);
      setCountedCash('');
      setDiscrepancyReason('');
      setCashModal(null);
      loadSession();
    } catch (e) {
      setCashError(getApiError(e));
    } finally {
      setCashBusy(false);
    }
  };

  const openDrawer = async () => {
    try {
      await cashApi.openDrawer();
    } catch {
      /* le tiroir reste optionnel */
    }
  };

  useEffect(() => {
    dishApi
      .menu()
      .then((d) => {
        setDishes(d);
        void cacheMenu(d);
      })
      .catch(async () => {
        setDishes(await getCachedMenu());
      });
    promotionApi.activeHappyHour().then(setHappyHour).catch(() => setHappyHour(null));
  }, []);

  const filtered = dishes.filter(
    (d) =>
      (category === 'Tout' || d.category === category) &&
      (!search.trim() || d.name.toLowerCase().includes(search.trim().toLowerCase()))
  );

  // Sous-total = lignes NON offertes. Les articles offerts sont gratuits.
  const subtotal = useMemo(() => cart.reduce((s, i) => s + (i.offered ? 0 : i.price * i.quantity), 0), [cart]);

  const promoAmount = (p: { discountType: 'percent' | 'amount'; discountValue: number } | null, base: number) => {
    if (!p) return 0;
    return p.discountType === 'percent'
      ? Math.round((base * Math.min(p.discountValue, 100)) / 100)
      : Math.min(p.discountValue, base);
  };

  // Priorité : coupon > happy hour > remise manuelle (pas de cumul) — cohérent avec le backend.
  const discount = useMemo(() => {
    if (coupon) return promoAmount(coupon, subtotal);
    if (happyHour) return promoAmount(happyHour, subtotal);
    const v = Number(discountValue) || 0;
    if (discountType === 'amount') return Math.min(v, subtotal);
    if (discountType === 'percent') return Math.round((subtotal * Math.min(v, 100)) / 100);
    return 0;
  }, [coupon, happyHour, discountType, discountValue, subtotal]);

  const discountLabel = coupon ? `Coupon ${coupon.code}` : happyHour ? `Happy hour` : 'Réduction';
  const finalTotal = Math.max(0, subtotal - discount);
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
  // Pourboire (hors total) : pour les espèces, le montant remis doit couvrir total + pourboire.
  const tipNum = Math.max(0, Number(tip) || 0);
  const change = (Number(cashGiven) || 0) - finalTotal - tipNum;

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setCouponError('');
    try {
      const c = await promotionApi.checkCoupon(code);
      setCoupon({ code: code.toUpperCase(), name: c.name, discountType: c.discountType, discountValue: c.discountValue });
      setCouponInput('');
    } catch (e) {
      setCoupon(null);
      setCouponError(getApiError(e, 'Coupon invalide'));
    }
  };

  const toggleOffered = (key: string) =>
    setCart((prev) => prev.map((c) => (lineKey(c.id, c.variantId, c.customPrice) === key ? { ...c, offered: !c.offered } : c)));

  // Clé unique d'une ligne de panier = plat + variante + prix libre (un même plat libre peut être ajouté à plusieurs prix).
  const lineKey = (dishId: number, variantId?: number, customPrice?: number) =>
    `${dishId}:${variantId ?? 0}:${customPrice ?? 0}`;

  // Clic sur un plat : prix libre => saisie du prix ; variantes => sélecteur ; sinon ajout direct.
  const pickDish = (dish: MenuDish) => {
    if (!dish.available) return;
    if (dish.priceType === 'libre') {
      const activeVariants = dish.variants?.filter((v) => v.available) ?? [];
      if (activeVariants.length > 0) {
        // Libre + variantes : sélecteur de variante d'abord, puis prix.
        setVariantPick(dish);
        return;
      }
      const def = Math.min(Math.max(dish.price, dish.priceMin ?? 0), dish.priceMax ?? dish.price);
      setPriceInput(String(def || dish.priceMin || ''));
      setPricePick(dish);
      return;
    }
    if (dish.variants && dish.variants.length > 0) {
      setVariantPick(dish);
      return;
    }
    addToCart(dish);
  };

  const addToCart = (dish: MenuDish, variant?: MenuVariant, customPrice?: number) => {
    const key = lineKey(dish.id, variant?.id, customPrice);
    setCart((prev) => {
      const existing = prev.find((c) => lineKey(c.id, c.variantId, c.customPrice) === key);
      if (existing) {
        return prev.map((c) => (lineKey(c.id, c.variantId, c.customPrice) === key ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [
        ...prev,
        {
          id: dish.id,
          variantId: variant?.id,
          variantName: variant?.name,
          name: dish.name,
          price: customPrice ?? (variant?.price != null ? variant.price : dish.price),
          customPrice,
          quantity: 1,
        },
      ];
    });
  };

  // Validation de la saisie de prix libre puis ajout au panier.
  const confirmPricePick = () => {
    if (!pricePick) return;
    const value = Math.round(Number(priceInput));
    const min = pricePick.priceMin ?? 0;
    const max = pricePick.priceMax ?? Number.MAX_SAFE_INTEGER;
    if (!Number.isFinite(value) || value < min || value > max) return;
    addToCart(pricePick, pickedLibreVariant ?? undefined, value);
    setPricePick(null);
    setPriceInput('');
    setPickedLibreVariant(null);
  };

  const updateQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (lineKey(c.id, c.variantId, c.customPrice) === key ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const removeItem = (key: string) => setCart((prev) => prev.filter((c) => lineKey(c.id, c.variantId, c.customPrice) !== key));

  const resetAll = () => {
    setCart([]);
    setDiscountType('none');
    setDiscountValue('');
    setCoupon(null);
    setCouponInput('');
    setCouponError('');
    setShowPayment(false);
    setPayNow(!tableId && !isServer);
    setPaymentMethod('');
    setProvider('');
    setCashGiven('');
    setTip('');
    setChannel('sur_place');
    setDeliveryPlatform('');
    setCustomerName('');
    setCustomerPhone('');
    setReceipt(null);
    setError('');
  };

  const buildPayload = (): CreateOrderPayload => {
    // Coupon prioritaire ; happy hour appliqué automatiquement côté serveur ;
    // la remise manuelle n'est envoyée que sans coupon ni happy hour.
    const manual = !coupon && !happyHour;
    const payload: CreateOrderPayload = {
      items: cart.map((c) => ({ dishId: c.id, variantId: c.variantId, customPrice: c.customPrice, offered: c.offered || undefined, quantity: c.quantity, notes: c.notes })),
      couponCode: coupon?.code,
      discountAmount: manual && discountType === 'amount' ? Number(discountValue) || 0 : 0,
      discountPercent: manual && discountType === 'percent' ? Number(discountValue) || 0 : 0,
      tableId: tableId ?? undefined,
      // Table = sur place ; sinon canal choisi à la caisse.
      channel: tableId ? 'sur_place' : channel,
      deliveryPlatform: !tableId && channel === 'livraison' && deliveryPlatform ? deliveryPlatform : undefined,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
    };
    if (payNow) {
      payload.paymentMethod = paymentMethod || 'espèces';
      payload.paymentDetails = {
        mobileMoneyProvider: paymentMethod === 'mobile_money' ? provider || undefined : undefined,
        cashGiven: paymentMethod === 'espèces' ? Number(cashGiven) || 0 : undefined,
        changeReturned: paymentMethod === 'espèces' ? Math.max(0, change) : undefined,
      };
      if (tipNum > 0) {
        payload.tipAmount = tipNum;
        payload.tipMethod = paymentMethod || 'espèces';
      }
    }
    return payload;
  };

  const canConfirm = !payNow
    ? true
    : !!paymentMethod &&
      (paymentMethod !== 'espèces' || change >= 0) &&
      (paymentMethod !== 'mobile_money' || !!provider);

  const confirmPayment = async () => {
    if (!canConfirm) return;
    setError('');
    setSubmitting(true);
    const payload = buildPayload();
    const snapshot: Omit<Receipt, 'orderNumber' | 'offline'> = {
      time: new Date().toISOString(),
      items: [...cart],
      subtotal,
      discount,
      finalTotal,
      tip: payNow && tipNum > 0 ? tipNum : undefined,
      deferred: !payNow,
      tableName,
      serverName: isServer ? (currentUser?.displayName ?? currentUser?.email) : undefined,
      discountLabel,
      channelLabel: tableId
        ? undefined
        : `${CHANNEL_LABELS[channel]}${channel === 'livraison' && deliveryPlatform ? ` · ${PLATFORM_LABELS[deliveryPlatform]}` : ''}`,
      customerName: customerName.trim() || undefined,
      paymentLabel: !payNow
        ? 'À régler à la caisse'
        : `${PAYMENT_LABELS[paymentMethod || 'espèces'] ?? paymentMethod}${paymentMethod === 'mobile_money' && provider ? ` (${provider})` : ''}`,
      cashGiven: payNow && paymentMethod === 'espèces' ? Number(cashGiven) || 0 : undefined,
      change: payNow && paymentMethod === 'espèces' ? Math.max(0, change) : undefined,
    };
    try {
      if (online) {
        const res = await orderApi.create(payload);
        setReceipt({ ...snapshot, orderNumber: res.orderNumber, offline: false });
        if (payNow) loadSession(); // rafraîchit le total théorique en caisse
      } else {
        await queueOrder(payload);
        setReceipt({ ...snapshot, orderNumber: 'En attente (hors-ligne)', offline: true });
      }
    } catch (err) {
      // Erreur renvoyée par le serveur (ex. caisse fermée) : on l'affiche, on ne met PAS en file hors-ligne.
      if (axios.isAxiosError(err) && err.response) {
        setError(getApiError(err));
        setSubmitting(false);
        return;
      }
      // Sinon (panne réseau) : repli hors-ligne.
      try {
        await queueOrder(payload);
        setReceipt({ ...snapshot, orderNumber: 'En attente (hors-ligne)', offline: true });
      } catch {
        setError(getApiError(err));
        setSubmitting(false);
        return;
      }
    }
    setSubmitting(false);
  };

  // Ecran de confirmation + recu
  if (receipt) {
    return (
      <div className={SHELL}>
        <div className="max-w-md mx-auto p-4">
          <div className={`${PANEL} p-6 text-center mb-4 no-print`}>
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-emerald-500/15 flex items-center justify-center ring-1 ring-emerald-500/30">
              <CheckCircle className="w-9 h-9 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-neutral-100">Commande validée !</h2>
            {receipt.tableName && <p className="text-gold-400 font-semibold mt-1">{receipt.tableName}</p>}
            <p className="text-neutral-400 mt-1">Commande {receipt.orderNumber}</p>
            <p className="text-sm text-neutral-500 mt-2">
              {receipt.offline
                ? 'Sera envoyée à la cuisine dès la reconnexion.'
                : receipt.deferred
                  ? 'Envoyée en cuisine. À régler à la caisse.'
                  : 'La commande a été envoyée à la cuisine.'}
            </p>
          </div>

          {/* Reçu imprimable : reste blanc pour l'impression. */}
          <div className="print-area bg-white text-gray-800 rounded-2xl shadow-lg p-6 text-sm">
            <div className="text-center mb-3">
              <h3 className="text-lg font-bold">Restaurant Pilote</h3>
              <p className="text-gray-500">Reçu de commande</p>
            </div>
            <div className="text-center font-bold text-xl mb-1">{receipt.orderNumber}</div>
            {receipt.tableName && <p className="text-center text-gray-600 mb-1">{receipt.tableName}</p>}
            {receipt.serverName && <p className="text-center text-gray-600 mb-1">Serveur : {receipt.serverName}</p>}
            {receipt.channelLabel && <p className="text-center text-gray-600 mb-1">{receipt.channelLabel}</p>}
            {receipt.customerName && <p className="text-center text-gray-600 mb-1">Client : {receipt.customerName}</p>}
            <p className="text-center text-gray-500 mb-3">{formatDateTime(receipt.time)}</p>
            <div className="border-t border-b py-2 space-y-1">
              {receipt.items.map((i) => (
                <div key={`${i.id}:${i.variantId ?? 0}:${i.customPrice ?? 0}`} className="flex justify-between">
                  <span>
                    {i.quantity} x {i.name}
                    {i.variantName ? ` (${i.variantName})` : ''}
                    {i.offered ? ' — offert' : ''}
                  </span>
                  <span>{i.offered ? '0' : formatFCFA(i.price * i.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="py-2 space-y-1">
              <div className="flex justify-between">
                <span>Sous-total</span>
                <span>{formatFCFA(receipt.subtotal)}</span>
              </div>
              {receipt.discount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>{receipt.discountLabel ?? 'Réduction'}</span>
                  <span>-{formatFCFA(receipt.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span>{formatFCFA(receipt.finalTotal)}</span>
              </div>
            </div>
            <div className="border-t pt-2 text-gray-600">
              <div className="flex justify-between">
                <span>Paiement</span>
                <span className="capitalize">{receipt.paymentLabel}</span>
              </div>
              {receipt.tip ? (
                <>
                  <div className="flex justify-between">
                    <span>Pourboire</span>
                    <span>{formatFCFA(receipt.tip)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Total encaissé</span>
                    <span>{formatFCFA(receipt.finalTotal + receipt.tip)}</span>
                  </div>
                </>
              ) : null}
              {receipt.cashGiven !== undefined && (
                <>
                  <div className="flex justify-between">
                    <span>Reçu</span>
                    <span>{formatFCFA(receipt.cashGiven)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Monnaie</span>
                    <span>{formatFCFA(receipt.change ?? 0)}</span>
                  </div>
                </>
              )}
            </div>
            <p className="text-center text-gray-500 mt-3">Merci de votre visite !</p>
          </div>

          <div className="flex flex-wrap gap-3 mt-4 no-print">
            <button
              onClick={() => window.print()}
              className="flex-1 flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-100 border border-neutral-700 py-2.5 rounded-xl font-semibold transition"
            >
              <Printer className="w-5 h-5" /> Imprimer
            </button>
            {tableId ? (
              <button onClick={() => navigate('/salle')} className={`flex-1 py-2.5 rounded-xl ${BTN_GOLD}`}>
                Retour à la salle
              </button>
            ) : (
              <button onClick={resetAll} className={`flex-1 py-2.5 rounded-xl ${BTN_GOLD}`}>
                Nouvelle commande
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={SHELL}>
      <div className="max-w-7xl mx-auto p-4">
        <div className="bg-gradient-to-r from-neutral-950 to-neutral-900/40 border border-neutral-800 ring-1 ring-white/5 rounded-2xl p-4 mb-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gold-400/10 ring-1 ring-gold-400/25 flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-gold-400" />
            </span>
            <h1 className="text-xl font-bold tracking-tight">Caisse</h1>
            {tableName && (
              <span className="flex items-center gap-1 bg-white/5 ring-1 ring-white/10 px-3 py-1 rounded-full text-sm font-semibold text-neutral-200">
                <LayoutGrid className="w-4 h-4" />
                {tableName}
              </span>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm text-neutral-200">{currentUser?.displayName ?? currentUser?.email}</div>
            <div className="text-xs text-neutral-500">{formatDateTime(clock)}</div>
          </div>
        </div>

        {canManageCash && (
          <div
            className={`rounded-2xl p-3 mb-4 flex flex-wrap items-center gap-3 border ${
              session ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-gold-400/10 border-gold-400/30'
            }`}
          >
            <Banknote className={`w-5 h-5 ${session ? 'text-emerald-400' : 'text-gold-400'}`} />
            {session ? (
              <>
                <span className="font-semibold text-emerald-300">Caisse ouverte</span>
                <span className="text-sm text-neutral-400">
                  Fond : {formatFCFA(session.openingFloat)} · Théorique en caisse :{' '}
                  <strong className="text-emerald-300">{formatFCFA(expectedCash)}</strong>
                </span>
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={openDrawer}
                    className="flex items-center gap-1 text-sm bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-neutral-200 px-3 py-1.5 rounded-lg transition"
                  >
                    <Inbox className="w-4 h-4" /> Ouvrir tiroir
                  </button>
                  <button
                    onClick={() => {
                      setCashError('');
                      setCountedCash('');
                      setDiscrepancyReason('');
                      setCashModal('close');
                    }}
                    className="flex items-center gap-1 text-sm bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg transition"
                  >
                    <Lock className="w-4 h-4" /> Fermer la caisse
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="font-semibold text-gold-300">Caisse fermée</span>
                <span className="text-sm text-neutral-400">Ouvrez la caisse pour encaisser en espèces.</span>
                <button
                  onClick={() => {
                    setCashError('');
                    setOpeningFloat('');
                    setCashModal('open');
                  }}
                  className={`ml-auto flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg ${BTN_GOLD}`}
                >
                  <Unlock className="w-4 h-4" /> Ouvrir la caisse
                </button>
              </>
            )}
          </div>
        )}

        {canManageCash && (
          <div className="flex justify-end mb-4">
            <button
              onClick={openOrders}
              className="flex items-center gap-2 text-sm bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-neutral-200 px-3 py-2 rounded-lg transition"
            >
              <ClipboardList className="w-4 h-4 text-gold-400" /> Commandes du jour
            </button>
          </div>
        )}

        {!online && (
          <div className="flex items-center gap-2 bg-gold-400/10 border border-gold-400/30 text-gold-300 rounded-xl p-3 mb-4 text-sm">
            <WifiOff className="w-5 h-5" />
            Mode hors-ligne — les commandes seront synchronisées à la reconnexion
            {queuedCount > 0 && ` (${queuedCount} en attente)`}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un plat…"
                className={`${INPUT} pl-9`}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition ${
                    category === cat
                      ? 'bg-gold-400 text-black'
                      : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {filtered.map((dish) => {
                const hasVariants = !!dish.variants && dish.variants.length > 0;
                const isLibre = dish.priceType === 'libre';
                return (
                  <button
                    key={dish.id}
                    onClick={() => pickDish(dish)}
                    disabled={!dish.available}
                    className={`${PANEL} p-4 text-left transition ${
                      dish.available
                        ? 'hover:border-gold-400/50 hover:bg-neutral-900 hover:-translate-y-0.5'
                        : 'opacity-40 cursor-not-allowed'
                    }`}
                  >
                    {dish.imageUrl ? (
                      <img
                        src={dish.imageUrl}
                        alt={dish.name}
                        className="w-full h-24 object-cover rounded-lg mb-2 border border-neutral-800"
                      />
                    ) : (
                      <div className="text-4xl mb-2">{EMOJI[dish.category ?? ''] ?? '🍽️'}</div>
                    )}
                    <div className="font-semibold text-neutral-100 leading-tight">{dish.name}</div>
                    {isLibre ? (
                      <div className="text-gold-400 font-bold mt-1 text-sm">
                        Prix libre
                        <span className="ml-1 text-xs text-neutral-400">
                          · {formatFCFA(dish.priceMin ?? 0)}–{formatFCFA(dish.priceMax ?? 0)}
                        </span>
                      </div>
                    ) : hasVariants ? (
                      <div className="text-gold-400 font-bold mt-1 text-sm">
                        dès {formatFCFA(Math.min(...dish.variants!.map((v) => v.price ?? dish.price)))}
                        <span className="ml-1 text-xs text-neutral-400">· {dish.variants!.length} variantes</span>
                      </div>
                    ) : (
                      <div className="text-gold-400 font-bold mt-1">{formatFCFA(dish.price)}</div>
                    )}
                    {!dish.available && (
                      <span className="inline-block mt-1 text-xs bg-rose-500/15 text-rose-300 px-2 py-0.5 rounded-full">
                        Indisponible
                      </span>
                    )}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="col-span-full text-center text-neutral-500 py-8">Aucun plat disponible</p>
              )}
            </div>
          </div>

          <div className={`lg:sticky lg:top-20 h-fit ${PANEL} p-4`}>
            <div className="flex items-center gap-2 mb-3">
              <ShoppingCart className="w-5 h-5 text-gold-400" />
              <h2 className="font-bold text-neutral-100">Panier</h2>
              <span className="ml-auto bg-gold-400/15 text-gold-300 text-sm px-2 py-0.5 rounded-full">{totalItems}</span>
            </div>

            {cart.length === 0 ? (
              <p className="text-neutral-500 text-center py-6 text-sm">Panier vide</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto mb-3">
                {cart.map((item) => {
                  const key = lineKey(item.id, item.variantId, item.customPrice);
                  return (
                    <div key={key} className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg p-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-neutral-100 truncate">
                          {item.name}
                          {item.variantName && <span className="text-gold-300"> · {item.variantName}</span>}
                          {item.offered && <span className="ml-1 text-xs text-emerald-300">offert</span>}
                        </div>
                        <div className="text-xs text-neutral-400">{item.offered ? '0 FCFA' : formatFCFA(item.price)}</div>
                      </div>
                      <button
                        onClick={() => toggleOffered(key)}
                        title="Offrir cet article"
                        className={`p-1 rounded transition ${item.offered ? 'bg-emerald-500/20 text-emerald-300' : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'}`}
                      >
                        <Gift className="w-4 h-4" />
                      </button>
                      <button onClick={() => updateQty(key, -1)} className="p-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded transition">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                      <button onClick={() => updateQty(key, 1)} className="p-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded transition">
                        <Plus className="w-4 h-4" />
                      </button>
                      <button onClick={() => removeItem(key)} className="p-1 text-rose-400 hover:text-rose-300">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mb-3 space-y-2">
              {/* Happy hour actif (appliqué automatiquement) */}
              {happyHour && !coupon && (
                <div className="flex items-center justify-between bg-gold-400/10 border border-gold-400/30 text-gold-300 rounded-lg px-3 py-2 text-sm">
                  <span>🕑 Happy hour : {happyHour.name}</span>
                  <span className="font-semibold">
                    {happyHour.discountType === 'percent' ? `-${happyHour.discountValue}%` : `-${formatFCFA(happyHour.discountValue)}`}
                  </span>
                </div>
              )}

              {/* Coupon */}
              {coupon ? (
                <div className="flex items-center justify-between bg-sky-500/10 border border-sky-500/30 text-sky-300 rounded-lg px-3 py-2 text-sm">
                  <span className="flex items-center gap-1">
                    <Ticket className="w-4 h-4" /> {coupon.code}
                  </span>
                  <button onClick={() => setCoupon(null)} className="text-rose-300 hover:text-rose-200">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value);
                      setCouponError('');
                    }}
                    placeholder="Code coupon"
                    className={`${INPUT} flex-1`}
                  />
                  <button onClick={applyCoupon} className="px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700 text-sm">
                    Appliquer
                  </button>
                </div>
              )}
              {couponError && <p className="text-rose-400 text-xs">{couponError}</p>}

              {/* Remise manuelle : uniquement sans coupon ni happy hour */}
              {!coupon && !happyHour && (
                <>
                  <div className="flex gap-1">
                    {(['none', 'amount', 'percent'] as DiscountType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          setDiscountType(t);
                          setDiscountValue('');
                        }}
                        className={`flex-1 text-xs py-1.5 rounded transition ${
                          discountType === t ? 'bg-gold-400 text-black font-semibold' : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                        }`}
                      >
                        {t === 'none' ? 'Aucune' : t === 'amount' ? 'Montant' : 'Pourcent'}
                      </button>
                    ))}
                  </div>
                  {discountType !== 'none' && (
                    <input
                      type="number"
                      min="0"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder={discountType === 'amount' ? 'Montant en FCFA' : 'Pourcentage'}
                      className={INPUT}
                    />
                  )}
                </>
              )}
            </div>

            <div className="border-t border-neutral-800 pt-3 space-y-1 text-sm">
              <div className="flex justify-between text-neutral-400">
                <span>Sous-total</span>
                <span>{formatFCFA(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-rose-400">
                  <span>{discountLabel}</span>
                  <span>-{formatFCFA(discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-2xl text-gold-400 pt-1">
                <span className="text-neutral-200 text-base self-end pb-1">Total</span>
                <span>{formatFCFA(finalTotal)}</span>
              </div>
            </div>

            <button
              onClick={() => setShowPayment(true)}
              disabled={cart.length === 0}
              className={`w-full mt-3 py-3 rounded-xl ${BTN_GOLD}`}
            >
              Valider la commande
            </button>
          </div>
        </div>

        {/* Modal paiement / validation */}
        {showPayment && (
          <div className={OVERLAY}>
            <div className={`${MODAL} max-w-md p-6 max-h-[90vh] overflow-y-auto`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-neutral-100">{tableName ? `Commande ${tableName}` : 'Paiement'}</h3>
                <button onClick={() => setShowPayment(false)} className="text-neutral-500 hover:text-neutral-300">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-center bg-neutral-900 border border-neutral-800 rounded-xl py-3 mb-4">
                <div className="text-sm text-neutral-400">Total</div>
                <div className="text-3xl font-bold text-gold-400">{formatFCFA(finalTotal)}</div>
              </div>

              {error && <div className="text-rose-400 text-sm mb-3">{error}</div>}

              {/* Canal de vente (ventes directes, hors table) */}
              {!tableId && (
                <div className="mb-4">
                  <label className="block text-sm text-neutral-400 mb-1">Canal de vente</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['sur_place', 'emporter', 'livraison'] as Channel[]).map((c) => (
                      <button
                        key={c}
                        onClick={() => setChannel(c)}
                        className={`py-2 rounded-lg text-xs font-medium border-2 transition ${
                          channel === c ? 'border-gold-400 bg-gold-400/10 text-gold-300' : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
                        }`}
                      >
                        {CHANNEL_LABELS[c]}
                      </button>
                    ))}
                  </div>
                  {channel === 'livraison' && (
                    <select
                      value={deliveryPlatform}
                      onChange={(e) => setDeliveryPlatform(e.target.value as DeliveryPlatform)}
                      className={`${INPUT} mt-2`}
                    >
                      <option value="">Plateforme (optionnel)</option>
                      {(['glovo', 'yango', 'uber_eats', 'autre'] as DeliveryPlatform[]).map((p) => (
                        <option key={p} value={p}>
                          {PLATFORM_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Client (optionnel) */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Client (optionnel)"
                  className={INPUT}
                />
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Téléphone"
                  className={INPUT}
                />
              </div>

              {/* Choix : régler maintenant ou différer (table, hors serveur qui n'encaisse jamais) */}
              {tableId && !isServer && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button
                    onClick={() => setPayNow(false)}
                    className={`py-2 rounded-lg text-sm font-medium border-2 transition ${
                      !payNow ? 'border-gold-400 bg-gold-400/10 text-gold-300' : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
                    }`}
                  >
                    Régler à la caisse
                  </button>
                  <button
                    onClick={() => setPayNow(true)}
                    className={`py-2 rounded-lg text-sm font-medium border-2 transition ${
                      payNow ? 'border-gold-400 bg-gold-400/10 text-gold-300' : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
                    }`}
                  >
                    Encaisser maintenant
                  </button>
                </div>
              )}

              {!payNow ? (
                <p className="text-sm text-neutral-400 mb-4">
                  La commande part en cuisine. L'addition sera réglée à la caisse plus tard.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {(['espèces', 'mobile_money', 'carte', 'virement', 'qr_code'] as PaymentMethod[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setPaymentMethod(m)}
                        className={`py-2 rounded-lg text-xs font-medium border-2 transition ${
                          paymentMethod === m ? 'border-gold-400 bg-gold-400/10 text-gold-300' : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
                        }`}
                      >
                        {PAYMENT_LABELS[m]}
                      </button>
                    ))}
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm text-neutral-400 mb-1">Pourboire (optionnel)</label>
                    <input
                      type="number"
                      min="0"
                      value={tip}
                      onChange={(e) => setTip(e.target.value)}
                      className={INPUT}
                      placeholder="0"
                    />
                    {tipNum > 0 && (
                      <p className="text-emerald-400 text-xs mt-1">Total encaissé : {formatFCFA(finalTotal + tipNum)}</p>
                    )}
                  </div>

                  {paymentMethod === 'espèces' && (
                    <div className="mb-4">
                      <label className="block text-sm text-neutral-400 mb-1">Montant remis</label>
                      <input
                        type="number"
                        min="0"
                        value={cashGiven}
                        onChange={(e) => setCashGiven(e.target.value)}
                        className={INPUT}
                        placeholder="0"
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
                    <div className="grid grid-cols-3 gap-2 mb-4">
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
                onClick={confirmPayment}
                disabled={!canConfirm || submitting}
                className={`w-full py-2.5 rounded-xl ${BTN_GOLD}`}
              >
                {submitting ? 'Validation...' : !payNow ? 'Envoyer en cuisine' : 'Confirmer le paiement'}
              </button>
            </div>
          </div>
        )}

        {/* Sélecteur de variante (déclinaison) */}
        {variantPick && (
          <div className={OVERLAY}>
            <div className={`${MODAL} max-w-sm p-6`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-neutral-100">{variantPick.name}</h3>
                <button onClick={() => { setVariantPick(null); setPickedLibreVariant(null); }} className="text-neutral-500 hover:text-neutral-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-neutral-400 mb-3">Choisir une déclinaison :</p>
              <div className="space-y-2">
                {variantPick.variants!.map((v) => (
                  <button
                    key={v.id}
                    disabled={!v.available}
                    onClick={() => {
                      if (variantPick.priceType === 'libre') {
                        // Libre + variante : mémoriser la variante, passer à la saisie du prix.
                        const def = Math.min(Math.max(variantPick.price, variantPick.priceMin ?? 0), variantPick.priceMax ?? variantPick.price);
                        setPickedLibreVariant(v);
                        setPriceInput(String(def || variantPick.priceMin || ''));
                        setPricePick(variantPick);
                        setVariantPick(null);
                      } else {
                        addToCart(variantPick, v);
                        setVariantPick(null);
                      }
                    }}
                    className={`w-full flex justify-between items-center px-4 py-3 rounded-xl border-2 transition ${
                      v.available
                        ? 'border-neutral-700 hover:border-gold-400/60 hover:bg-neutral-900 text-neutral-100'
                        : 'border-neutral-800 opacity-40 cursor-not-allowed text-neutral-500'
                    }`}
                  >
                    <span className="font-medium">
                      {v.name}
                      {!v.available && <span className="ml-2 text-xs text-rose-300">indispo</span>}
                    </span>
                    {v.price != null && <span className="font-bold text-gold-400">{formatFCFA(v.price)}</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Saisie du prix (plat à prix libre) */}
        {pricePick && (() => {
          const min = pricePick.priceMin ?? 0;
          const max = pricePick.priceMax ?? Number.MAX_SAFE_INTEGER;
          const value = Math.round(Number(priceInput));
          const valid = priceInput !== '' && Number.isFinite(value) && value >= min && value <= max;
          return (
            <div className={OVERLAY}>
              <div className={`${MODAL} max-w-sm p-6`}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-neutral-100">
                    {pricePick.name}{pickedLibreVariant ? ` — ${pickedLibreVariant.name}` : ''}
                  </h3>
                  <button onClick={() => { setPricePick(null); setPickedLibreVariant(null); }} className="text-neutral-500 hover:text-neutral-300">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <label className="block text-sm text-neutral-400 mb-1">Prix de vente (FCFA)</label>
                <p className="text-xs text-neutral-500 mb-3">
                  Entre {formatFCFA(min)} et {formatFCFA(pricePick.priceMax ?? 0)}
                </p>
                <input
                  type="number"
                  min={min}
                  max={pricePick.priceMax ?? undefined}
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && valid) confirmPricePick();
                  }}
                  className={INPUT}
                  placeholder={`${min}`}
                  autoFocus
                />
                {priceInput !== '' && !valid && (
                  <p className="text-rose-400 text-xs mt-1">
                    Prix hors limites ({formatFCFA(min)} – {formatFCFA(pricePick.priceMax ?? 0)})
                  </p>
                )}
                <button onClick={confirmPricePick} disabled={!valid} className={`w-full mt-4 py-2.5 rounded-xl ${BTN_GOLD}`}>
                  Ajouter au panier
                </button>
              </div>
            </div>
          );
        })()}

        {/* Modal ouverture de caisse */}
        {cashModal === 'open' && (
          <div className={OVERLAY}>
            <div className={`${MODAL} max-w-sm p-6`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2 text-neutral-100">
                  <Unlock className="w-5 h-5 text-gold-400" /> Ouvrir la caisse
                </h3>
                <button onClick={() => setCashModal(null)} className="text-neutral-500 hover:text-neutral-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {cashError && <div className="text-rose-400 text-sm mb-3">{cashError}</div>}
              <label className="block text-sm text-neutral-400 mb-1">Fond de caisse (FCFA)</label>
              <input
                type="number"
                min="0"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                className={`${INPUT} mb-4`}
                placeholder="0"
                autoFocus
              />
              <button onClick={openCash} disabled={cashBusy} className={`w-full py-2.5 rounded-xl ${BTN_GOLD}`}>
                {cashBusy ? 'Ouverture...' : 'Ouvrir la caisse'}
              </button>
            </div>
          </div>
        )}

        {/* Modal fermeture de caisse */}
        {cashModal === 'close' && (
          <div className={OVERLAY}>
            <div className={`${MODAL} max-w-sm p-6 max-h-[90vh] overflow-y-auto`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2 text-neutral-100">
                  <Lock className="w-5 h-5 text-rose-400" /> Fermer la caisse
                </h3>
                <button onClick={() => setCashModal(null)} className="text-neutral-500 hover:text-neutral-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {cashError && <div className="text-rose-400 text-sm mb-3">{cashError}</div>}
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 mb-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Fond de caisse</span>
                  <span>{formatFCFA(session?.openingFloat ?? 0)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-neutral-400">Total théorique</span>
                  <span className="text-gold-400">{formatFCFA(expectedCash)}</span>
                </div>
              </div>
              {(session?.cashTips ?? 0) > 0 && (
                <div className="flex items-start gap-2 bg-gold-400/10 border border-gold-400/25 text-gold-300 rounded-lg px-3 py-2 mb-3 text-xs">
                  <Coins className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Pourboires espèces à sortir du tiroir : <strong>{formatFCFA(session!.cashTips!)}</strong>
                    {' '}— non comptés dans le théorique. À remettre au personnel avant de compter la caisse.
                  </span>
                </div>
              )}
              <label className="block text-sm text-neutral-400 mb-1">Montant réel compté (FCFA)</label>
              <input
                type="number"
                min="0"
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value)}
                className={`${INPUT} mb-2`}
                placeholder="0"
                autoFocus
              />
              {countedCash !== '' && (
                <div
                  className={`text-sm mb-2 font-medium ${
                    closeDiff === 0 ? 'text-emerald-400' : closeDiff > 0 ? 'text-sky-400' : 'text-rose-400'
                  }`}
                >
                  Écart : {closeDiff > 0 ? '+' : ''}
                  {formatFCFA(closeDiff)}
                  {closeDiff > 0 ? ' (excédent)' : closeDiff < 0 ? ' (manquant)' : ' (caisse juste)'}
                </div>
              )}
              {closeDiff !== 0 && countedCash !== '' && (
                <div className="mb-3">
                  <label className="block text-sm text-neutral-400 mb-1">Justification de l'écart</label>
                  <textarea
                    value={discrepancyReason}
                    onChange={(e) => setDiscrepancyReason(e.target.value)}
                    className={`${INPUT} text-sm`}
                    rows={2}
                    placeholder="Expliquer l'écart..."
                  />
                </div>
              )}
              <button
                onClick={closeCash}
                disabled={cashBusy || countedCash === ''}
                className="w-full bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl transition"
              >
                {cashBusy ? 'Fermeture...' : 'Confirmer la fermeture'}
              </button>
            </div>
          </div>
        )}

        {/* Panneau « Commandes du jour » : annulation / remboursement (validation manager par PIN) */}
        {showOrders && (
          <div className={OVERLAY}>
            <div className={`${MODAL} max-w-lg p-6 max-h-[90vh] flex flex-col`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2 text-neutral-100">
                  <ClipboardList className="w-5 h-5 text-gold-400" /> Commandes du jour
                </h3>
                <button onClick={() => setShowOrders(false)} className="text-neutral-500 hover:text-neutral-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {pinRequired && (
                <p className="flex items-center gap-1.5 text-xs text-gold-300 bg-gold-400/10 border border-gold-400/25 rounded-lg px-3 py-2 mb-3">
                  <ShieldCheck className="w-4 h-4" /> Annulation et remboursement nécessitent le code manager.
                </p>
              )}
              <div className="overflow-y-auto space-y-2 flex-1">
                {ordersBusy && orders.length === 0 && (
                  <p className="text-neutral-500 text-sm text-center py-6">Chargement…</p>
                )}
                {!ordersBusy && orders.length === 0 && (
                  <p className="text-neutral-500 text-sm text-center py-6">Aucune commande</p>
                )}
                {orders.map((o) => {
                  const canCancel = o.status !== 'servie' && o.status !== 'annulée';
                  const canRefund = o.isPaid && !o.isRefunded;
                  return (
                    <div key={o.id} className="bg-neutral-900 border border-neutral-800 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-sm text-neutral-100">{o.orderNumber}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 capitalize">{o.status}</span>
                          {o.isRefunded ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300">Remboursée</span>
                          ) : (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${o.isPaid ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gold-400/15 text-gold-300'}`}>
                              {o.isPaid ? 'Payée' : 'À régler'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-neutral-400 truncate">
                        {o.items.map((it) => `${it.quantity}x ${it.dishName}`).join(', ')}
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="font-semibold text-sm text-gold-400">{formatFCFA(o.finalTotal)}</span>
                        <div className="flex gap-2">
                          {canCancel && (
                            <button
                              onClick={() => startAction(o, 'cancel')}
                              className="flex items-center gap-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-rose-300 border border-neutral-700 px-2.5 py-1 rounded-lg transition"
                            >
                              <Ban className="w-3.5 h-3.5" /> Annuler
                            </button>
                          )}
                          {canRefund && (
                            <button
                              onClick={() => startAction(o, 'refund')}
                              className="flex items-center gap-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-gold-300 border border-neutral-700 px-2.5 py-1 rounded-lg transition"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Rembourser
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Modale d'action : raison + code manager */}
        {actionOrder && (
          <div className={OVERLAY}>
            <div className={`${MODAL} max-w-sm p-6`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2 text-neutral-100">
                  {actionType === 'cancel' ? <Ban className="w-5 h-5 text-rose-400" /> : <RotateCcw className="w-5 h-5 text-gold-400" />}
                  {actionType === 'cancel' ? 'Annuler la commande' : 'Rembourser la commande'}
                </h3>
                <button onClick={() => setActionOrder(null)} className="text-neutral-500 hover:text-neutral-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-neutral-400 mb-3">
                {actionOrder.orderNumber} · <span className="text-gold-400 font-semibold">{formatFCFA(actionOrder.finalTotal)}</span>
              </p>
              {actionError && <div className="text-rose-400 text-sm mb-3">{actionError}</div>}
              <label className="block text-sm text-neutral-400 mb-1">Raison</label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                rows={2}
                className={`${INPUT} mb-3`}
                placeholder={actionType === 'cancel' ? "Motif d'annulation…" : 'Motif du remboursement…'}
                autoFocus
              />
              {pinRequired && (
                <div className="mb-4">
                  <label className="text-sm text-neutral-400 mb-1 flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-gold-400" /> Code manager
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    value={actionPin}
                    onChange={(e) => setActionPin(e.target.value)}
                    className={INPUT}
                    placeholder="••••"
                  />
                </div>
              )}
              <button
                onClick={submitAction}
                disabled={actionBusy}
                className={`w-full py-2.5 rounded-xl ${
                  actionType === 'cancel'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white font-bold transition disabled:opacity-40'
                    : BTN_GOLD
                }`}
              >
                {actionBusy ? 'Traitement…' : actionType === 'cancel' ? "Confirmer l'annulation" : 'Confirmer le remboursement'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
