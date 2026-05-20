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
    <div className="max-w-7xl mx-auto p-4">
      <div className="bg-green-600 text-white rounded-xl p-4 mb-4 flex items-center gap-3 shadow">
        <BellRing className="w-7 h-7" />
        <div>
          <h1 className="text-xl font-bold">Service</h1>
          <p className="text-sm opacity-90">Commandes prêtes à servir</p>
        </div>
        <span className="ml-auto bg-white/20 px-3 py-1 rounded-full font-bold">{orders.length}</span>
      </div>

      {orders.length === 0 ? (
        <div className="text-center text-gray-400 py-16">
          <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 opacity-50" />
          Aucune commande prête pour le moment
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-xl shadow overflow-hidden">
              <div className="bg-green-600 text-white p-3 flex justify-between items-center">
                <span className="text-lg font-bold">{order.orderNumber}</span>
                <span className="flex items-center gap-1 text-sm">
                  <CheckCircle className="w-4 h-4" /> Prête
                </span>
              </div>
              <div className="p-3">
                <div className="flex items-center gap-1 text-sm text-gray-400 mb-2">
                  <Clock className="w-4 h-4" />
                  {getElapsedTime(order.readyAt ?? order.createdAt)}
                </div>
                <div className="space-y-1 mb-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm bg-gray-50 rounded p-2">
                      <span className="font-medium">{item.dishName}</span>
                      <span className="text-gray-500">x{item.quantity}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-bold mb-3">
                  <span>Total</span>
                  <span>{formatFCFA(order.finalTotal)}</span>
                </div>
                <button
                  onClick={() => markServed(order)}
                  className="w-full bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-lg font-semibold"
                >
                  Marquer comme servie
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
