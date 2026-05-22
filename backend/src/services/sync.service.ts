import { prisma } from '../config/prisma';
import { createOrder, CreateOrderInput } from './order.service';

interface OfflineOrder extends CreateOrderInput {
  clientId?: string;
  createdAt?: string;
}

// Rejoue les commandes creees hors-ligne. Le numero et le decrement sont
// generes/appliques cote serveur au moment du sync (§13 mode hors-ligne).
export async function syncOrders(orders: OfflineOrder[], userId?: number) {
  const results: Array<Record<string, unknown>> = [];
  for (const o of orders) {
    try {
      const created = await createOrder(
        {
          items: o.items,
          couponCode: o.couponCode,
          discountAmount: o.discountAmount,
          discountPercent: o.discountPercent,
          paymentMethod: o.paymentMethod,
          paymentDetails: o.paymentDetails,
          channel: o.channel,
          deliveryPlatform: o.deliveryPlatform,
          customerName: o.customerName,
          customerPhone: o.customerPhone,
        },
        userId
      );
      await prisma.syncQueue.create({
        data: {
          actionType: 'create_order',
          tableName: 'orders',
          recordId: created.id,
          data: o as unknown as object,
          isSynced: true,
          syncedAt: new Date(),
        },
      });
      results.push({ clientId: o.clientId, orderId: created.id, orderNumber: created.orderNumber, status: 'synced' });
    } catch (err) {
      results.push({ clientId: o.clientId, status: 'error', error: (err as Error).message });
    }
  }
  return results;
}
