import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { AppNotification } from '../types';
import { useWebSocket } from './WebSocketContext';
import { NotificationDisplay } from '../components/NotificationDisplay';

interface NotificationContextType {
  notifications: AppNotification[];
  addNotification: (n: Omit<AppNotification, 'id' | 'timestamp'>) => void;
  clearNotification: (id: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const { socket } = useWebSocket();

  const clearNotification = useCallback((id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback(
    (n: Omit<AppNotification, 'id' | 'timestamp'>) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const notif: AppNotification = { ...n, id, timestamp: new Date().toISOString() };
      setNotifications((prev) => [notif, ...prev]);
      setTimeout(() => clearNotification(id), 5000);
    },
    [clearNotification]
  );

  useEffect(() => {
    if (!socket) return;

    const onNewOrder = (d: { orderNumber: string }) =>
      addNotification({ title: 'Nouvelle commande', message: `Commande ${d.orderNumber} reçue`, type: 'nouvelle_commande' });
    const onReady = (d: { orderNumber: string }) =>
      addNotification({ title: 'Commande prête', message: `Commande ${d.orderNumber} prête à servir`, type: 'commande_prête' });
    const onStock = (d: { itemName: string; quantity: number; unit: string }) =>
      addNotification({ title: 'Alerte stock', message: `${d.itemName} : stock faible (${d.quantity} ${d.unit})`, type: 'stock_faible' });

    socket.on('new_order', onNewOrder);
    socket.on('order_ready', onReady);
    socket.on('stock_alert', onStock);

    return () => {
      socket.off('new_order', onNewOrder);
      socket.off('order_ready', onReady);
      socket.off('stock_alert', onStock);
    };
  }, [socket, addNotification]);

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, clearNotification }}>
      {children}
      <NotificationDisplay />
    </NotificationContext.Provider>
  );
}

export function useNotification(): NotificationContextType {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification doit être utilisé dans NotificationProvider');
  return ctx;
}
