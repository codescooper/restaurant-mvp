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
  const { currentUser } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      disconnectSocket();
      setSocket(null);
      setConnected(false);
      return;
    }
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const s = connectSocket(token);
    s.on('connect', () => {
      setConnected(true);
      s.emit('join_room', { role: currentUser.role });
    });
    s.on('disconnect', () => setConnected(false));
    // Échec de connexion : socket.io retente automatiquement ; on évite juste une erreur non gérée.
    s.on('connect_error', (err) => {
      setConnected(false);
      console.warn('WebSocket indisponible, nouvelle tentative…', err.message);
    });
    setSocket(s);

    return () => {
      s.removeAllListeners();
      disconnectSocket();
    };
  }, [currentUser]);

  return (
    <WebSocketContext.Provider value={{ socket, connected }}>{children}</WebSocketContext.Provider>
  );
}

export function useWebSocket(): WebSocketContextType {
  return useContext(WebSocketContext);
}
