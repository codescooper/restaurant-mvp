import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useClock } from '../hooks/useClock';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { dishApi, orderApi, CreateOrderPayload } from '../services/endpoints';
import { cacheMenu, getCachedMenu, queueOrder } from '../services/offline';
import { getApiError } from '../services/api';
import { CartItem, MenuDish } from '../types';
import { formatFCFA, formatDateTime } from '../utils/format';

const CATEGORIES = ['Tout', 'Entrée', 'Plat', 'Dessert', 'Boisson'];
const EMOJI: Record<string, string> = {
  Entrée: '🥗',
  Plat: '🍛',
  Dessert: '🍰',
  Boisson: '🥤',
};

type DiscountType = 'none' | 'amount' | 'percent';
type PaymentMethod = '' | 'espèces' | 'mobile_money' | 'carte';
type Provider = '' | 'orange_money' | 'wave';

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
  tableName?: string | null;
}

export default function CaissePage() {
  const { currentUser } = useAuth();
  const clock = useClock();
  const navigate = useNavigate();
  const { online, queuedCount } = useOfflineSync();

  const [searchParams] = useSearchParams();
  const tableId = searchParams.get('table') ? Number(searchParams.get('table')) : null;
  const tableName = searchParams.get('name') || (tableId ? `Table ${tableId}` : null);

  const [dishes, setDishes] = useState<MenuDish[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [category, setCategory] = useState('Tout');
  const [discountType, setDiscountType] = useState<DiscountType>('none');
  const [discountValue, setDiscountValue] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [payNow, setPayNow] = useState(!tableId);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('');
  const [provider, setProvider] = useState<Provider>('');
  const [cashGiven, setCashGiven] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPayNow(!tableId);
  }, [tableId]);

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
  }, []);

  const filtered = dishes.filter((d) => category === 'Tout' || d.category === category);

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.quantity, 0), [cart]);
  const discount = useMemo(() => {
    const v = Number(discountValue) || 0;
    if (discountType === 'amount') return Math.min(v, subtotal);
    if (discountType === 'percent') return Math.round((subtotal * Math.min(v, 100)) / 100);
    return 0;
  }, [discountType, discountValue, subtotal]);
  const finalTotal = Math.max(0, subtotal - discount);
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
  const change = (Number(cashGiven) || 0) - finalTotal;

  const addToCart = (dish: MenuDish) => {
    if (!dish.available) return;
    setCart((prev) => {
      const existing = prev.find((c) => c.id === dish.id);
      if (existing) return prev.map((c) => (c.id === dish.id ? { ...c, quantity: c.quantity + 1 } : c));
      return [...prev, { id: dish.id, name: dish.name, price: dish.price, quantity: 1 }];
    });
  };

  const updateQty = (id: number, delta: number) => {
    setCart((prev) =>
      prev.map((c) => (c.id === id ? { ...c, quantity: c.quantity + delta } : c)).filter((c) => c.quantity > 0)
    );
  };

  const removeItem = (id: number) => setCart((prev) => prev.filter((c) => c.id !== id));

  const resetAll = () => {
    setCart([]);
    setDiscountType('none');
    setDiscountValue('');
    setShowPayment(false);
    setPayNow(!tableId);
    setPaymentMethod('');
    setProvider('');
    setCashGiven('');
    setReceipt(null);
    setError('');
  };

  const buildPayload = (): CreateOrderPayload => {
    const payload: CreateOrderPayload = {
      items: cart.map((c) => ({ dishId: c.id, quantity: c.quantity, notes: c.notes })),
      discountAmount: discountType === 'amount' ? Number(discountValue) || 0 : 0,
      discountPercent: discountType === 'percent' ? Number(discountValue) || 0 : 0,
      tableId: tableId ?? undefined,
    };
    if (payNow) {
      payload.paymentMethod = paymentMethod || 'espèces';
      payload.paymentDetails = {
        mobileMoneyProvider: paymentMethod === 'mobile_money' ? provider || undefined : undefined,
        cashGiven: paymentMethod === 'espèces' ? Number(cashGiven) || 0 : undefined,
        changeReturned: paymentMethod === 'espèces' ? Math.max(0, change) : undefined,
      };
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
      deferred: !payNow,
      tableName,
      paymentLabel: !payNow
        ? 'À régler à la caisse'
        : `${paymentMethod || 'espèces'}${paymentMethod === 'mobile_money' && provider ? ` (${provider})` : ''}`,
      cashGiven: payNow && paymentMethod === 'espèces' ? Number(cashGiven) || 0 : undefined,
      change: payNow && paymentMethod === 'espèces' ? Math.max(0, change) : undefined,
    };
    try {
      if (online) {
        const res = await orderApi.create(payload);
        setReceipt({ ...snapshot, orderNumber: res.orderNumber, offline: false });
      } else {
        await queueOrder(payload);
        setReceipt({ ...snapshot, orderNumber: 'En attente (hors-ligne)', offline: true });
      }
    } catch (err) {
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
      <div className="max-w-md mx-auto p-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 text-center mb-4 no-print">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-gray-800">Commande validée !</h2>
          {receipt.tableName && <p className="text-blue-600 font-semibold mt-1">{receipt.tableName}</p>}
          <p className="text-gray-500 mt-1">Commande {receipt.orderNumber}</p>
          <p className="text-sm text-gray-500 mt-2">
            {receipt.offline
              ? 'Sera envoyée à la cuisine dès la reconnexion.'
              : receipt.deferred
                ? 'Envoyée en cuisine. À régler à la caisse.'
                : 'La commande a été envoyée à la cuisine.'}
          </p>
        </div>

        <div className="print-area bg-white rounded-2xl shadow-lg p-6 text-sm">
          <div className="text-center mb-3">
            <h3 className="text-lg font-bold">Restaurant Pilote</h3>
            <p className="text-gray-500">Reçu de commande</p>
          </div>
          <div className="text-center font-bold text-xl mb-1">{receipt.orderNumber}</div>
          {receipt.tableName && <p className="text-center text-gray-600 mb-1">{receipt.tableName}</p>}
          <p className="text-center text-gray-500 mb-3">{formatDateTime(receipt.time)}</p>
          <div className="border-t border-b py-2 space-y-1">
            {receipt.items.map((i) => (
              <div key={i.id} className="flex justify-between">
                <span>
                  {i.quantity} x {i.name}
                </span>
                <span>{formatFCFA(i.price * i.quantity)}</span>
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
                <span>Réduction</span>
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
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-semibold"
          >
            <Printer className="w-5 h-5" /> Imprimer
          </button>
          {tableId ? (
            <button
              onClick={() => navigate('/salle')}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-semibold"
            >
              Retour à la salle
            </button>
          ) : (
            <button
              onClick={resetAll}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-semibold"
            >
              Nouvelle commande
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="bg-blue-600 text-white rounded-xl p-4 mb-4 flex justify-between items-center shadow">
        <div className="flex items-center gap-3">
          <ShoppingCart className="w-7 h-7" />
          <h1 className="text-xl font-bold">Caisse</h1>
          {tableName && (
            <span className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full text-sm font-semibold">
              <LayoutGrid className="w-4 h-4" />
              {tableName}
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm">{currentUser?.username}</div>
          <div className="text-xs opacity-90">{formatDateTime(clock)}</div>
        </div>
      </div>

      {!online && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-800 rounded-lg p-3 mb-4 text-sm">
          <WifiOff className="w-5 h-5" />
          Mode hors-ligne — les commandes seront synchronisées à la reconnexion
          {queuedCount > 0 && ` (${queuedCount} en attente)`}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition ${
                  category === cat ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filtered.map((dish) => (
              <button
                key={dish.id}
                onClick={() => addToCart(dish)}
                disabled={!dish.available}
                className={`bg-white rounded-xl p-4 text-left shadow-sm transition ${
                  dish.available ? 'hover:shadow-lg hover:scale-[1.03]' : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="text-4xl mb-2">{EMOJI[dish.category ?? ''] ?? '🍽️'}</div>
                <div className="font-semibold text-gray-800 leading-tight">{dish.name}</div>
                <div className="text-blue-600 font-bold mt-1">{formatFCFA(dish.price)}</div>
                {!dish.available && (
                  <span className="inline-block mt-1 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                    Indisponible
                  </span>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-full text-center text-gray-400 py-8">Aucun plat disponible</p>
            )}
          </div>
        </div>

        <div className="lg:sticky lg:top-20 h-fit bg-white rounded-xl shadow p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-gray-800">Panier</h2>
            <span className="ml-auto bg-blue-100 text-blue-700 text-sm px-2 py-0.5 rounded-full">{totalItems}</span>
          </div>

          {cart.length === 0 ? (
            <p className="text-gray-400 text-center py-6 text-sm">Panier vide</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto mb-3">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-800 truncate">{item.name}</div>
                    <div className="text-xs text-gray-500">{formatFCFA(item.price)}</div>
                  </div>
                  <button onClick={() => updateQty(item.id, -1)} className="p-1 bg-gray-200 rounded">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-6 text-center text-sm">{item.quantity}</span>
                  <button onClick={() => updateQty(item.id, 1)} className="p-1 bg-gray-200 rounded">
                    <Plus className="w-4 h-4" />
                  </button>
                  <button onClick={() => removeItem(item.id)} className="p-1 text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mb-3">
            <div className="flex gap-1 mb-2">
              {(['none', 'amount', 'percent'] as DiscountType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setDiscountType(t);
                    setDiscountValue('');
                  }}
                  className={`flex-1 text-xs py-1.5 rounded ${
                    discountType === t ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
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
                className="w-full border rounded-lg px-3 py-1.5 text-sm"
              />
            )}
          </div>

          <div className="border-t pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Sous-total</span>
              <span>{formatFCFA(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Réduction</span>
                <span>-{formatFCFA(discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-xl text-gray-800">
              <span>Total</span>
              <span>{formatFCFA(finalTotal)}</span>
            </div>
          </div>

          <button
            onClick={() => setShowPayment(true)}
            disabled={cart.length === 0}
            className="w-full mt-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg"
          >
            {tableId ? 'Valider la commande' : 'Valider la commande'}
          </button>
        </div>
      </div>

      {/* Modal paiement / validation */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 no-print">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{tableName ? `Commande ${tableName}` : 'Paiement'}</h3>
              <button onClick={() => setShowPayment(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center bg-gray-50 rounded-lg py-3 mb-4">
              <div className="text-sm text-gray-500">Total</div>
              <div className="text-3xl font-bold text-gray-800">{formatFCFA(finalTotal)}</div>
            </div>

            {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

            {/* Choix : régler maintenant ou différer (uniquement pour une table) */}
            {tableId && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  onClick={() => setPayNow(false)}
                  className={`py-2 rounded-lg text-sm font-medium border-2 ${
                    !payNow ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200'
                  }`}
                >
                  Régler à la caisse
                </button>
                <button
                  onClick={() => setPayNow(true)}
                  className={`py-2 rounded-lg text-sm font-medium border-2 ${
                    payNow ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200'
                  }`}
                >
                  Encaisser maintenant
                </button>
              </div>
            )}

            {!payNow ? (
              <p className="text-sm text-gray-500 mb-4">
                La commande part en cuisine. L'addition sera réglée à la caisse plus tard.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {(['espèces', 'mobile_money', 'carte'] as PaymentMethod[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setPaymentMethod(m)}
                      className={`py-2 rounded-lg text-sm font-medium border-2 ${
                        paymentMethod === m ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200'
                      }`}
                    >
                      {m === 'espèces' ? 'Espèces' : m === 'mobile_money' ? 'Mobile Money' : 'Carte'}
                    </button>
                  ))}
                </div>

                {paymentMethod === 'espèces' && (
                  <div className="mb-4">
                    <label className="block text-sm text-gray-600 mb-1">Montant remis</label>
                    <input
                      type="number"
                      min="0"
                      value={cashGiven}
                      onChange={(e) => setCashGiven(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="0"
                    />
                    {cashGiven !== '' &&
                      (change >= 0 ? (
                        <p className="text-green-600 text-sm mt-1">Monnaie : {formatFCFA(change)}</p>
                      ) : (
                        <p className="text-red-600 text-sm mt-1">Montant insuffisant</p>
                      ))}
                  </div>
                )}

                {paymentMethod === 'mobile_money' && (
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <button
                      onClick={() => setProvider('orange_money')}
                      className={`py-2 rounded-lg text-sm font-medium border-2 ${
                        provider === 'orange_money' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200'
                      }`}
                    >
                      Orange Money
                    </button>
                    <button
                      onClick={() => setProvider('wave')}
                      className={`py-2 rounded-lg text-sm font-medium border-2 ${
                        provider === 'wave' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200'
                      }`}
                    >
                      Wave
                    </button>
                  </div>
                )}
              </>
            )}

            <button
              onClick={confirmPayment}
              disabled={!canConfirm || submitting}
              className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg"
            >
              {submitting ? 'Validation...' : !payNow ? 'Envoyer en cuisine' : 'Confirmer le paiement'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
