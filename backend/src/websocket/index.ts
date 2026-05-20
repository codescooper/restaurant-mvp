import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import { env } from '../config/env';
import { Role } from '../constants';

let io: Server | null = null;

export function initWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: env.corsOrigin, credentials: true },
  });

  // Auth JWT au handshake (§11.4).
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Token manquant'));
    try {
      socket.data.user = verifyAccessToken(token);
      return next();
    } catch {
      return next(new Error('Token invalide'));
    }
  });

  io.on('connection', (socket) => {
    const role = socket.data.user?.role as Role | undefined;
    if (role) socket.join(`room:${role}`);

    // Permet au client de (re)rejoindre une room selon son role.
    socket.on('join_room', (data: { role?: Role }) => {
      if (data?.role) socket.join(`room:${data.role}`);
    });
  });

  return io;
}

export function getIO(): Server | null {
  return io;
}

export function emitToRole(role: Role, event: string, payload: unknown): void {
  io?.to(`room:${role}`).emit(event, payload);
}

export function emitToAll(event: string, payload: unknown): void {
  io?.emit(event, payload);
}

// Helpers metier (§7.7, §8.7, §11.4)
export function emitNewOrder(payload: unknown): void {
  emitToRole('cuisinier', 'new_order', payload);
}

export function emitOrderReady(payload: unknown): void {
  emitToRole('caissier', 'order_ready', payload);
}

export function emitOrderStatusChanged(payload: unknown): void {
  emitToAll('order_status_changed', payload);
}

export function emitStockAlert(payload: unknown): void {
  emitToRole('administrateur', 'stock_alert', payload);
}

export function emitStatsUpdated(payload: unknown): void {
  emitToAll('stats_updated', payload);
}
