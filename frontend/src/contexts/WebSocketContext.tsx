import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { connectSocket, disconnectSocket } from '../services/socket';

interface WebSocketContextType {
  socket: Socket | null;
  connected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({ socket: null, connected: false });

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { currentUser, activeRestaurantId } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Pas connecté ou pas de restaurant sélectionné → pas de socket (le backend exige un token scopé).
    if (!currentUser || activeRestaurantId == null) {
      disconnectSocket();
      setSocket(null);
      setConnected(false);
      return;
    }
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const s = connectSocket(token);
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', (err) => {
      setConnected(false);
      console.warn('WebSocket indisponible, nouvelle tentative…', err.message);
    });
    setSocket(s);

    return () => {
      s.removeAllListeners();
      disconnectSocket();
    };
    // Reconnexion quand l'identité de l'utilisateur OU le restaurant actif change (nouveau token scopé).
  }, [currentUser?.id, activeRestaurantId]);

  return (
    <WebSocketContext.Provider value={{ socket, connected }}>{children}</WebSocketContext.Provider>
  );
}

export function useWebSocket(): WebSocketContextType {
  return useContext(WebSocketContext);
}
