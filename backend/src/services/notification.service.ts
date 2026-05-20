import { prisma } from '../config/prisma';
import { Role, NotificationType } from '../constants';
import { emitToRole } from '../websocket';

interface CreateNotificationParams {
  userRole: Role;
  title: string;
  message: string;
  type: NotificationType;
  relatedOrderId?: number;
  relatedStockId?: number;
}

// Persiste une notification (§13.4) et la diffuse en temps reel au role concerne.
export async function createNotification(params: CreateNotificationParams) {
  const notif = await prisma.notification.create({
    data: {
      userRole: params.userRole,
      title: params.title,
      message: params.message,
      type: params.type,
      relatedOrderId: params.relatedOrderId,
      relatedStockId: params.relatedStockId,
    },
  });
  emitToRole(params.userRole, 'notification', notif);
  return notif;
}

export async function listNotifications(role: Role) {
  return prisma.notification.findMany({
    where: { userRole: role },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function markAsRead(notificationId: number, userId: number) {
  await prisma.notificationRead.upsert({
    where: { notificationId_userId: { notificationId, userId } },
    create: { notificationId, userId },
    update: {},
  });
  return prisma.notification.update({ where: { id: notificationId }, data: { isRead: true } });
}
