import { useEffect, useState } from 'react';
import { BellRing, Clock, CheckCircle, UtensilsCrossed } from 'lucide-react';
import { useWebSocket } from '../contexts/WebSocketContext';
import { orderApi } from '../services/endpoints';
import { Order, OrderStatus } from '../types';
import { formatFCFA, getElapsedTime } from '../utils/format';

export default function ServicePage() {
  const { socket } = useWebSocket();
  const [orders, setOrders] = useState<Order[]>([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    orderApi
      .list(['prête'])
      .then(setOrders)
      .catch(() => setOrders([]));
  }, []);

  // Rafraîchit le temps écoulé.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onReady = (d: { orderId: number }) => {
      // Récupère la commande complète et l'ajoute si pas déjà présente.
      orderApi
        .list(['prête'])
        .then(setOrders)
        .catch(() => {});
      void d;
    };
    const onStatusChanged = (d: { orderId: number; newStatus: OrderStatus }) => {
      if (d.newStatus !== 'prête') {
        setOrders((prev) => prev.filter((o) => o.id !== d.orderId));
      }
    };

    socket.on('order_ready', onReady);
    socket.on('order_status_changed', onStatusChanged);
    return () => {
      socket.off('order_ready', onReady);
      socket.off('order_status_changed', onStatusChanged);
    };
  }, [socket]);

  const markServed = async (order: Order) => {
    setOrders((prev) => prev.filter((o) => o.id !== order.id));
    try {
      await orderApi.updateStatus(order.id, 'servie');
    } catch {
      // remettre dans la liste en cas d'échec
      orderApi.list(['prête']).then(setOrders).catch(() => {});
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-black text-neutral-100 max-w-full">
      <div className="max-w-7xl mx-auto p-4">
        <div className="bg-gradient-to-r from-neutral-950 to-neutral-900/40 border border-neutral-800 ring-1 ring-white/5 rounded-2xl p-4 mb-4 flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/25 flex items-center justify-center">
            <BellRing className="w-6 h-6 text-emerald-400" />
          </span>
          <div>
            <h1 className="text-xl font-bold">Service</h1>
            <p className="text-sm text-neutral-400">Commandes prêtes à servir</p>
          </div>
          <span className="ml-auto bg-white/5 ring-1 ring-white/10 px-3 py-1 rounded-full font-bold">{orders.length}</span>
        </div>

        {orders.length === 0 ? (
          <div className="text-center text-neutral-500 py-16">
            <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 opacity-40" />
            Aucune commande prête pour le moment
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-neutral-950 border border-neutral-800 ring-1 ring-white/5 rounded-2xl overflow-hidden">
                <div className="bg-emerald-600 text-white p-3 flex justify-between items-center">
                  <span className="text-lg font-bold">{order.orderNumber}</span>
                  <span className="flex items-center gap-1 text-sm">
                    <CheckCircle className="w-4 h-4" /> Prête
                  </span>
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-1 text-sm text-neutral-500 mb-2">
                    <Clock className="w-4 h-4" />
                    {getElapsedTime(order.readyAt ?? order.createdAt)}
                  </div>
                  <div className="space-y-1 mb-3">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm bg-neutral-900 border border-neutral-800 rounded p-2">
                        <span className="font-medium text-neutral-100">{item.dishName}</span>
                        <span className="text-neutral-400">x{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between font-bold mb-3">
                    <span className="text-neutral-200">Total</span>
                    <span className="text-gold-400">{formatFCFA(order.finalTotal)}</span>
                  </div>
                  <button
                    onClick={() => markServed(order)}
                    className="w-full bg-gold-400 hover:bg-gold-300 text-black py-2.5 rounded-xl font-bold transition"
                  >
                    Marquer comme servie
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
