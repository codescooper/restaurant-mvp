import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import { env } from '../config/env';
import { Role } from '../constants';
import { getTenantId } from '../config/tenant-context';

let io: Server | null = null;

function room(restaurantId: number, role: Role): string {
  return `r:${restaurantId}:${role}`;
}

export function initWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, { cors: { origin: env.corsOrigin, credentials: true } });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Token manquant'));
    try {
      const payload = verifyAccessToken(token);
      // Un restaurant doit être sélectionné pour recevoir des événements scopés.
      if (payload.restaurantId == null || !payload.role) return next(new Error('Restaurant non sélectionné'));
      socket.data.restaurantId = payload.restaurantId;
      socket.data.role = payload.role;
      return next();
    } catch {
      return next(new Error('Token invalide'));
    }
  });

  io.on('connection', (socket) => {
    const restaurantId = socket.data.restaurantId as number;
    const role = socket.data.role as Role;
    socket.join(room(restaurantId, role));
  });

  return io;
}

export function getIO(): Server | null {
  return io;
}

// Émission vers un rôle DU RESTAURANT COURANT (restaurantId lu dans le contexte tenant).
export function emitToRole(role: Role, event: string, payload: unknown): void {
  const restaurantId = getTenantId();
  if (restaurantId == null) return; // hors contexte : on n'émet pas (sécurité)
  io?.to(room(restaurantId, role)).emit(event, payload);
}

// Émission vers TOUS les rôles du restaurant courant.
export function emitToRestaurant(event: string, payload: unknown): void {
  const restaurantId = getTenantId();
  if (restaurantId == null) return;
  for (const role of ['propriétaire', 'administrateur', 'caissier', 'cuisinier', 'serveur'] as Role[]) {
    io?.to(room(restaurantId, role)).emit(event, payload);
  }
}

// Helpers métier (signatures inchangées : les call sites ne bougent pas).
export function emitNewOrder(payload: unknown): void { emitToRole('cuisinier', 'new_order', payload); }
export function emitOrderReady(payload: unknown): void { emitToRole('caissier', 'order_ready', payload); }
export function emitOrderStatusChanged(payload: unknown): void { emitToRestaurant('order_status_changed', payload); }
export function emitStockAlert(payload: unknown): void { emitToRole('administrateur', 'stock_alert', payload); }
export function emitStatsUpdated(payload: unknown): void { emitToRestaurant('stats_updated', payload); }
