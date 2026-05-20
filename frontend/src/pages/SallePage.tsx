import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, Users, X, CreditCard, CheckCircle, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { tableApi, orderApi } from '../services/endpoints';
import { getApiError } from '../services/api';
import { RestaurantTable } from '../types';
import { formatFCFA } from '../utils/format';

type PaymentMethod = '' | 'espèces' | 'mobile_money' | 'carte';
type Provider = '' | 'orange_money' | 'wave';

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

  const role = currentUser?.role;
  const canSettle = role === 'caissier' || role === 'administrateur';
  const canOrder = role === 'serveur' || role === 'caissier' || role === 'administrateur';

  const load = useCallback(() => {
    tableApi.list().then(setTables).catch((e) => setError(getApiError(e)));
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
    return () => {
      socket.off('new_order', refresh);
      socket.off('order_status_changed', refresh);
      socket.off('table_settled', refresh);
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

  const canConfirmSettle =
    !!paymentMethod &&
    (paymentMethod !== 'espèces' || change >= 0) &&
    (paymentMethod !== 'mobile_money' || !!provider);

  const confirmSettle = async () => {
    if (!selected || !canConfirmSettle) return;
    setBusy(true);
    setError('');
    try {
      await tableApi.settle(selected.id, paymentMethod || 'espèces', {
        mobileMoneyProvider: paymentMethod === 'mobile_money' ? provider || undefined : undefined,
        cashGiven: paymentMethod === 'espèces' ? Number(cashGiven) || 0 : undefined,
        changeReturned: paymentMethod === 'espèces' ? Math.max(0, change) : undefined,
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
    <div className="max-w-7xl mx-auto p-4">
      <div className="bg-blue-600 text-white rounded-xl p-4 mb-4 flex items-center gap-3 shadow">
        <LayoutGrid className="w-7 h-7" />
        <div>
          <h1 className="text-xl font-bold">Salle</h1>
          <p className="text-sm opacity-90">Plan des tables</p>
        </div>
        <div className="ml-auto flex gap-3 text-sm">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-400 inline-block" /> Libre
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> Occupée
          </span>
        </div>
      </div>

      {error && !selected && <div className="bg-red-50 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {tables.map((t) => {
          const occupied = t.status === 'occupée';
          return (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className={`rounded-xl p-4 text-left shadow-sm transition hover:shadow-lg border-2 ${
                occupied ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-gray-800">{t.name}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    occupied ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'
                  }`}
                >
                  {occupied ? 'Occupée' : 'Libre'}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                <Users className="w-3 h-3" /> {t.capacity} places
              </div>
              {occupied && (
                <div className="mt-2 text-sm">
                  <div className="font-bold text-gray-800">{formatFCFA(t.total)}</div>
                  {t.server && <div className="text-xs text-gray-500">Serveur : {t.server.username}</div>}
                  {t.hasUnpaid && <div className="text-xs text-orange-600">À régler : {formatFCFA(t.unpaidTotal)}</div>}
                </div>
              )}
            </button>
          );
        })}
        {tables.length === 0 && <p className="col-span-full text-center text-gray-400 py-8">Aucune table configurée</p>}
      </div>

      {/* Panneau détail table */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold">{selected.name}</h3>
              <button onClick={closePanel} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between mb-3 text-sm">
              <span className={`px-2 py-0.5 rounded-full ${selected.status === 'occupée' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {selected.status}
              </span>
              {selected.server && <span className="text-gray-500">Serveur : {selected.server.username}</span>}
            </div>

            {error && <div className="bg-red-50 text-red-700 rounded-lg p-2 mb-3 text-sm">{error}</div>}

            {selected.orders.length === 0 ? (
              <p className="text-gray-400 text-sm py-4 text-center">Table libre — aucune commande en cours</p>
            ) : (
              <div className="space-y-2 mb-3">
                {selected.orders.map((o) => (
                  <div key={o.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-sm">{o.orderNumber}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 capitalize">{o.status}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${o.isPaid ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                          {o.isPaid ? 'Payée' : 'À régler'}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600">
                      {o.items.map((it) => `${it.quantity}x ${it.dishName}`).join(', ')}
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="font-semibold text-sm">{formatFCFA(o.finalTotal)}</span>
                      {o.status === 'prête' && canOrder && (
                        <button
                          onClick={() => serve(o.id)}
                          disabled={busy}
                          className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg"
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
              <div className="flex justify-between font-bold border-t pt-2 mb-3">
                <span>Total à régler</span>
                <span>{formatFCFA(selected.unpaidTotal)}</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {canOrder && (
                <button
                  onClick={() => navigate(`/caisse?table=${selected.id}&name=${encodeURIComponent(selected.name)}`)}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-semibold"
                >
                  <Plus className="w-5 h-5" /> Nouvelle commande
                </button>
              )}
              {canSettle && selected.hasUnpaid && !settleOpen && (
                <button
                  onClick={() => setSettleOpen(true)}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-semibold"
                >
                  <CreditCard className="w-5 h-5" /> Encaisser l'addition
                </button>
              )}
            </div>

            {/* Sous-bloc règlement */}
            {settleOpen && canSettle && (
              <div className="mt-4 border-t pt-4">
                <div className="text-center bg-gray-50 rounded-lg py-2 mb-3">
                  <div className="text-xs text-gray-500">Addition</div>
                  <div className="text-2xl font-bold">{formatFCFA(total)}</div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {(['espèces', 'mobile_money', 'carte'] as PaymentMethod[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setPaymentMethod(m)}
                      className={`py-2 rounded-lg text-xs font-medium border-2 ${
                        paymentMethod === m ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200'
                      }`}
                    >
                      {m === 'espèces' ? 'Espèces' : m === 'mobile_money' ? 'Mobile' : 'Carte'}
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
                      className="w-full border rounded-lg px-3 py-2"
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
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                      onClick={() => setProvider('orange_money')}
                      className={`py-2 rounded-lg text-xs font-medium border-2 ${
                        provider === 'orange_money' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200'
                      }`}
                    >
                      Orange Money
                    </button>
                    <button
                      onClick={() => setProvider('wave')}
                      className={`py-2 rounded-lg text-xs font-medium border-2 ${
                        provider === 'wave' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200'
                      }`}
                    >
                      Wave
                    </button>
                  </div>
                )}
                <button
                  onClick={confirmSettle}
                  disabled={!canConfirmSettle || busy}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-semibold"
                >
                  <CheckCircle className="w-5 h-5" /> {busy ? 'Règlement...' : 'Valider le règlement'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
