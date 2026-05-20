import Dexie, { Table } from 'dexie';
import { MenuDish } from '../types';
import { CreateOrderPayload } from './endpoints';

export interface QueuedOrder extends CreateOrderPayload {
  clientId: string;
  createdAt: string;
}

interface CachedMenu {
  id: number; // singleton (toujours 1)
  dishes: MenuDish[];
  updatedAt: string;
}

class OfflineDB extends Dexie {
  menu!: Table<CachedMenu, number>;
  queue!: Table<QueuedOrder, string>;

  constructor() {
    super('restaurant_offline');
    this.version(1).stores({
      menu: 'id',
      queue: 'clientId',
    });
  }
}

export const offlineDb = new OfflineDB();

export async function cacheMenu(dishes: MenuDish[]): Promise<void> {
  await offlineDb.menu.put({ id: 1, dishes, updatedAt: new Date().toISOString() });
}

export async function getCachedMenu(): Promise<MenuDish[]> {
  const cached = await offlineDb.menu.get(1);
  return cached?.dishes ?? [];
}

export async function queueOrder(order: CreateOrderPayload): Promise<QueuedOrder> {
  const queued: QueuedOrder = {
    ...order,
    clientId:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
  };
  await offlineDb.queue.add(queued);
  return queued;
}

export async function getQueuedOrders(): Promise<QueuedOrder[]> {
  return offlineDb.queue.toArray();
}

export async function clearQueuedOrder(clientId: string): Promise<void> {
  await offlineDb.queue.delete(clientId);
}

export async function countQueuedOrders(): Promise<number> {
  return offlineDb.queue.count();
}
