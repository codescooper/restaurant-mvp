import { prisma } from '../config/prisma';
import { createOrder, CreateOrderInput, isUniqueViolationOn } from './order.service';

interface OfflineOrder extends CreateOrderInput {
  clientId?: string;
  createdAt?: string;
}

// Recherche une commande déjà synchronisée pour ce clientId (idempotence). Retourne le résultat
// « duplicate » correspondant, ou null si aucune commande n'existe encore pour ce clientId.
async function findSyncedByClientId(clientId: string): Promise<Record<string, unknown> | null> {
  const existing = await prisma.order.findFirst({
    where: { clientId },
    select: { id: true, orderNumber: true },
  });
  if (!existing) return null;
  return { clientId, orderId: existing.id, orderNumber: existing.orderNumber, status: 'duplicate' };
}

// Rejoue les commandes creees hors-ligne. Le numero et le decrement sont generes/appliques
// cote serveur au moment du sync (§13 mode hors-ligne).
//
// IDEMPOTENCE : chaque commande porte un `clientId` (UUID généré à la mise en file côté caisse).
// Si la réponse HTTP se perd, la caisse ré-envoie la commande ; on ne doit PAS la recréer.
// La déduplication s'appuie sur la contrainte unique `orders.client_id` :
//   1. court-circuit si une commande existe déjà pour ce clientId → status 'duplicate' ;
//   2. garde anti-course : si deux rejeux simultanés passent l'étape 1, l'insertion en double
//      lève une violation d'unicité (P2002 sur client_id) → on renvoie la commande existante.
export async function syncOrders(orders: OfflineOrder[], userId?: number) {
  const results: Array<Record<string, unknown>> = [];
  for (const o of orders) {
    try {
      // 1. Déjà synchronisée ? (rejeu après réponse perdue) → ne pas recréer.
      if (o.clientId) {
        const duplicate = await findSyncedByClientId(o.clientId);
        if (duplicate) {
          results.push(duplicate);
          continue;
        }
      }

      const created = await createOrder(
        {
          items: o.items,
          couponCode: o.couponCode,
          discountAmount: o.discountAmount,
          discountPercent: o.discountPercent,
          paymentMethod: o.paymentMethod,
          paymentDetails: o.paymentDetails,
          payments: o.payments,
          tipAmount: o.tipAmount,
          tipMethod: o.tipMethod,
          channel: o.channel,
          deliveryPlatform: o.deliveryPlatform,
          customerName: o.customerName,
          customerPhone: o.customerPhone,
          clientId: o.clientId,
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
      // 2. Course : un rejeu concurrent a déjà créé la commande → renvoyer l'existante.
      if (o.clientId && isUniqueViolationOn(err, 'client_id')) {
        const duplicate = await findSyncedByClientId(o.clientId);
        if (duplicate) {
          results.push(duplicate);
          continue;
        }
      }
      results.push({ clientId: o.clientId, status: 'error', error: (err as Error).message });
    }
  }
  return results;
}
