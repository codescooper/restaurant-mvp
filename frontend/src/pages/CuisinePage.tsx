import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChefHat,
  Clock,
  AlertCircle,
  Play,
  CheckCircle,
  Bell,
  BellOff,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useClock } from '../hooks/useClock';
import { orderApi } from '../services/endpoints';
import { KitchenOrder, Order, OrderStatus } from '../types';
import { formatTime, getElapsedTime } from '../utils/format';

type Filter = 'all' | 'commandée' | 'en_cours' | 'prête';

const PRIORITY: Record<string, number> = { commandée: 0, en_cours: 1, prête: 2 };

const STATUS_STYLE: Record<string, { header: string; label: string; icon: typeof AlertCircle }> = {
  commandée: { header: 'bg-red-600', label: 'Nouvelle', icon: AlertCircle },
  en_cours: { header: 'bg-orange-600', label: 'En cours', icon: Play },
  prête: { header: 'bg-green-600', label: 'Prête', icon: CheckCircle },
};

function fromApi(o: Order): KitchenOrder {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    createdAt: o.createdAt,
    items: o.items.map((i) => ({ id: i.id, name: i.dishName, quantity: i.quantity, notes: i.notes })),
  };
}

export default function CuisinePage() {
  const { currentUser } = useAuth();
  const { socket } = useWebSocket();
  const clock = useClock();

  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [, setTick] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Rafraichit le temps ecoule chaque 30s.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    orderApi
      .list(['commandée', 'en_cours', 'prête'])
      .then((list) => setOrders(list.map(fromApi)))
      .catch(() => setOrders([]));
  }, []);

  const playBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      // audio non disponible
    }
  }, [soundEnabled]);

  useEffect(() => {
    if (!socket) return;

    const onNewOrder = (d: {
      orderId: number;
      orderNumber: string;
      items: { id: number; name: string; quantity: number; notes?: string | null }[];
      status?: OrderStatus;
      createdAt: string;
    }) => {
      setOrders((prev) => {
        if (prev.some((o) => o.id === d.orderId)) return prev;
        return [
          ...prev,
          {
            id: d.orderId,
            orderNumber: d.orderNumber,
            status: d.status ?? 'commandée',
            createdAt: d.createdAt,
            items: d.items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, notes: i.notes })),
          },
        ];
      });
      playBeep();
    };

    const onStatusChanged = (d: { orderId: number; newStatus: OrderStatus }) => {
      setOrders((prev) => {
        if (d.newStatus === 'servie' || d.newStatus === 'annulée') {
          return prev.filter((o) => o.id !== d.orderId);
        }
        return prev.map((o) => (o.id === d.orderId ? { ...o, status: d.newStatus } : o));
      });
    };

    socket.on('new_order', onNewOrder);
    socket.on('order_status_changed', onStatusChanged);
    return () => {
      socket.off('new_order', onNewOrder);
      socket.off('order_status_changed', onStatusChanged);
    };
  }, [socket, playBeep]);

  const advance = async (order: KitchenOrder) => {
    const next = order.status === 'commandée' ? 'en_cours' : 'prête';
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
    try {
      await orderApi.updateStatus(order.id, next);
    } catch {
      // rollback en cas d'echec
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: order.status } : o)));
    }
  };

  const counts = {
    commandée: orders.filter((o) => o.status === 'commandée').length,
    en_cours: orders.filter((o) => o.status === 'en_cours').length,
    prête: orders.filter((o) => o.status === 'prête').length,
  };

  const visible = orders
    .filter((o) => filter === 'all' || o.status === filter)
    .sort((a, b) => {
      const p = (PRIORITY[a.status] ?? 9) - (PRIORITY[b.status] ?? 9);
      return p !== 0 ? p : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  return (
    <div className="min-h-screen bg-black text-white -mt-px">
      <div className="max-w-7xl mx-auto p-4">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
          <div className="flex items-center gap-3">
            <ChefHat className="w-8 h-8 text-gold-400" />
            <div>
              <h1 className="text-2xl font-bold">Cuisine</h1>
              <p className="text-sm text-neutral-400">{currentUser?.username}</p>
            </div>
          </div>
          <div className="text-gold-400 font-mono">{formatTime(clock)}</div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-red-600 rounded-xl p-4 text-center">
            <div className="text-4xl font-bold">{counts.commandée}</div>
            <div className="text-sm">Nouvelles</div>
          </div>
          <div className="bg-orange-600 rounded-xl p-4 text-center">
            <div className="text-4xl font-bold">{counts.en_cours}</div>
            <div className="text-sm">En cours</div>
          </div>
          <div className="bg-green-600 rounded-xl p-4 text-center">
            <div className="text-4xl font-bold">{counts.prête}</div>
            <div className="text-sm">Prêtes</div>
          </div>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {([
            ['all', 'Toutes', orders.length],
            ['commandée', 'Nouvelles', counts.commandée],
            ['en_cours', 'En cours', counts.en_cours],
            ['prête', 'Prêtes', counts.prête],
          ] as [Filter, string, number][]).map(([f, label, n]) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium ${
                filter === f ? 'bg-gold-400 text-black' : 'bg-neutral-800 hover:bg-neutral-700'
              }`}
            >
              {label} ({n})
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((order) => {
            const style = STATUS_STYLE[order.status] ?? STATUS_STYLE['commandée'];
            const Icon = style.icon;
            return (
              <div
                key={order.id}
                className="bg-neutral-800 rounded-xl overflow-hidden shadow-lg transition hover:scale-[1.02] hover:shadow-2xl"
              >
                <div className={`${style.header} p-3 flex justify-between items-center`}>
                  <span className="text-xl font-bold">{order.orderNumber}</span>
                  <span className="flex items-center gap-1 text-sm">
                    <Icon className="w-4 h-4" />
                    {style.label}
                  </span>
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-1 text-sm text-neutral-400 mb-2">
                    <Clock className="w-4 h-4" />
                    {getElapsedTime(order.createdAt)}
                  </div>
                  <div className="space-y-2 mb-3">
                    {order.items.map((item) => (
                      <div key={item.id} className="bg-neutral-700 rounded-lg p-2">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold">{item.name}</span>
                          <span className="bg-neutral-600 px-3 rounded-full text-sm">x{item.quantity}</span>
                        </div>
                        {item.notes && (
                          <div className="flex items-center gap-1 text-yellow-400 text-xs mt-1">
                            <AlertCircle className="w-3 h-3" />
                            {item.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {order.status === 'commandée' && (
                    <button onClick={() => advance(order)} className="w-full bg-red-600 hover:bg-red-700 py-2 rounded-lg font-semibold">
                      Commencer
                    </button>
                  )}
                  {order.status === 'en_cours' && (
                    <button onClick={() => advance(order)} className="w-full bg-orange-600 hover:bg-orange-700 py-2 rounded-lg font-semibold">
                      Terminer
                    </button>
                  )}
                  {order.status === 'prête' && (
                    <button disabled className="w-full bg-green-600 py-2 rounded-lg font-semibold opacity-70 cursor-default">
                      ✓ En attente de service
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {visible.length === 0 && (
            <p className="col-span-full text-center text-neutral-500 py-12">Aucune commande</p>
          )}
        </div>
      </div>

      <button
        onClick={() => setSoundEnabled((v) => !v)}
        title={soundEnabled ? 'Désactiver le son' : 'Activer le son'}
        className="fixed bottom-6 right-6 p-4 bg-neutral-700 hover:bg-neutral-600 rounded-full shadow-lg"
      >
        {soundEnabled ? <Bell className="w-6 h-6" /> : <BellOff className="w-6 h-6 text-neutral-400" />}
      </button>
    </div>
  );
}
