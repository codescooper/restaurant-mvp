import { api } from './api';
import {
  AuthResponse,
  MenuDish,
  Dish,
  StockItem,
  Order,
  User,
  DashboardData,
  AppNotification,
  Role,
  RestaurantTable,
  Reservation,
  CashSessionSummary,
  AuditLogEntry,
  Supplier,
  Purchase,
  Inventory,
  Promotion,
} from '../types';

export interface VariantInput {
  name: string;
  price: number;
  isActive?: boolean;
  ingredients?: { stockItemId: number; quantityNeeded: number }[];
}

export interface DishInput {
  name: string;
  description?: string;
  price: number;
  category?: string;
  preparationTime?: number;
  isActive?: boolean;
  ingredients?: { stockItemId: number; quantityNeeded: number }[];
  variants?: VariantInput[];
}

export interface PaymentInput {
  mobileMoneyProvider?: string;
  cashGiven?: number;
  changeReturned?: number;
}

export interface CreateOrderPayload {
  items: { dishId: number; variantId?: number; offered?: boolean; quantity: number; notes?: string }[];
  couponCode?: string;
  discountAmount: number;
  discountPercent: number;
  paymentMethod?: string; // absent = commande différée (réglée à la caisse)
  paymentDetails?: PaymentInput;
  tipAmount?: number;
  tipMethod?: string;
  tableId?: number;
  channel?: string;
  deliveryPlatform?: string;
  customerName?: string;
  customerPhone?: string;
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }).then((r) => r.data.data as AuthResponse),
  me: () => api.get('/auth/me').then((r) => r.data.data.user as User),
};

export const dishApi = {
  menu: () => api.get('/dishes/menu').then((r) => r.data.data as MenuDish[]),
  list: () => api.get('/dishes').then((r) => r.data.data as Dish[]),
  availability: (id: number, quantity: number) =>
    api.get(`/dishes/${id}/availability`, { params: { quantity } }).then((r) => r.data.data.available as boolean),
  create: (data: DishInput) => api.post('/dishes', data).then((r) => r.data.data as Dish),
  update: (id: number, data: DishInput) => api.put(`/dishes/${id}`, data).then((r) => r.data.data as Dish),
  toggle: (id: number) => api.patch(`/dishes/${id}/toggle-active`).then((r) => r.data.data as Dish),
  remove: (id: number) => api.delete(`/dishes/${id}`).then((r) => r.data.data),
};

export const stockApi = {
  list: () => api.get('/stock').then((r) => r.data.data as StockItem[]),
  create: (data: Partial<StockItem>) => api.post('/stock', data).then((r) => r.data.data as StockItem),
  update: (id: number, data: Partial<StockItem>) => api.put(`/stock/${id}`, data).then((r) => r.data.data as StockItem),
  remove: (id: number) => api.delete(`/stock/${id}`).then((r) => r.data.data),
  addQuantity: (id: number, quantity: number) =>
    api.post(`/stock/${id}/add-quantity`, { quantity }).then((r) => r.data.data as StockItem),
  recordLoss: (id: number, quantity: number, cause: string, note?: string) =>
    api.post(`/stock/${id}/loss`, { quantity, cause, note }).then((r) => r.data.data as StockItem),
};

export const supplierApi = {
  list: () => api.get('/suppliers').then((r) => r.data.data as Supplier[]),
  get: (id: number) => api.get(`/suppliers/${id}`).then((r) => r.data.data as Supplier),
  create: (data: Partial<Supplier>) => api.post('/suppliers', data).then((r) => r.data.data as Supplier),
  update: (id: number, data: Partial<Supplier>) => api.put(`/suppliers/${id}`, data).then((r) => r.data.data as Supplier),
  remove: (id: number) => api.delete(`/suppliers/${id}`).then((r) => r.data.data),
  purchases: (supplierId?: number) =>
    api.get('/suppliers/purchases', { params: supplierId ? { supplierId } : {} }).then((r) => r.data.data as Purchase[]),
  createPurchase: (data: {
    supplierId: number;
    stockItemId: number;
    quantity: number;
    unitPrice: number;
    dueDate?: string;
    isPaid?: boolean;
    note?: string;
  }) => api.post('/suppliers/purchases', data).then((r) => r.data.data as Purchase),
  payPurchase: (id: number) => api.patch(`/suppliers/purchases/${id}/pay`).then((r) => r.data.data as Purchase),
};

export const inventoryApi = {
  list: () => api.get('/inventory').then((r) => r.data.data as Inventory[]),
  get: (id: number) => api.get(`/inventory/${id}`).then((r) => r.data.data as Inventory),
  create: (type: string, note?: string) => api.post('/inventory', { type, note }).then((r) => r.data.data as Inventory),
  saveCounts: (id: number, lines: { stockItemId: number; countedQty: number }[]) =>
    api.put(`/inventory/${id}/counts`, { lines }).then((r) => r.data.data as Inventory),
  validate: (id: number) => api.post(`/inventory/${id}/validate`).then((r) => r.data.data as Inventory),
};

export const orderApi = {
  list: (statuses?: string[]) =>
    api
      .get('/orders', { params: statuses?.length ? { status: statuses.join(',') } : {} })
      .then((r) => r.data.data as Order[]),
  create: (payload: CreateOrderPayload) => api.post('/orders', payload).then((r) => r.data.data),
  updateStatus: (id: number, status: string) =>
    api.patch(`/orders/${id}/status`, { status }).then((r) => r.data.data.order as Order),
  cancel: (id: number, reason: string, pin?: string) =>
    api.post(`/orders/${id}/cancel`, { reason, pin }).then((r) => r.data.data as Order),
  pay: (id: number, paymentMethod: string, paymentDetails?: PaymentInput, tip?: { tipAmount?: number; tipMethod?: string }) =>
    api.post(`/orders/${id}/pay`, { paymentMethod, paymentDetails, ...tip }).then((r) => r.data.data as Order),
  refund: (id: number, reason: string, pin?: string) =>
    api.post(`/orders/${id}/refund`, { reason, pin }).then((r) => r.data.data as Order),
};

export const tableApi = {
  list: () => api.get('/tables').then((r) => r.data.data as RestaurantTable[]),
  create: (data: { name: string; capacity?: number }) => api.post('/tables', data).then((r) => r.data.data),
  update: (id: number, data: { name?: string; capacity?: number }) => api.put(`/tables/${id}`, data).then((r) => r.data.data),
  remove: (id: number) => api.delete(`/tables/${id}`).then((r) => r.data.data),
  settle: (id: number, paymentMethod: string, paymentDetails?: PaymentInput, tip?: { tipAmount?: number; tipMethod?: string }) =>
    api
      .post(`/tables/${id}/settle`, { paymentMethod, paymentDetails, ...tip })
      .then((r) => r.data.data as { tableId: number; paidCount: number; total: number; tip: number; change: number; paymentMethod: string }),
  billRequest: (id: number, requested: boolean) =>
    api.patch(`/tables/${id}/bill-request`, { requested }).then((r) => r.data.data),
  merge: (id: number, targetTableId: number) =>
    api.post(`/tables/${id}/merge`, { targetTableId }).then((r) => r.data.data),
  reservations: () => api.get('/tables/reservations').then((r) => r.data.data as Reservation[]),
  createReservation: (data: {
    tableId: number;
    customerName: string;
    customerPhone?: string;
    partySize?: number;
    reservedAt: string;
    note?: string;
  }) => api.post('/tables/reservations', data).then((r) => r.data.data as Reservation),
  cancelReservation: (id: number) => api.patch(`/tables/reservations/${id}/cancel`).then((r) => r.data.data),
  honorReservation: (id: number) => api.patch(`/tables/reservations/${id}/honor`).then((r) => r.data.data),
};

export const userApi = {
  list: () => api.get('/users').then((r) => r.data.data as User[]),
  create: (data: { username: string; password: string; role: Role }) =>
    api.post('/users', data).then((r) => r.data.data as User),
  update: (id: number, data: { username?: string; password?: string; role?: Role }) =>
    api.put(`/users/${id}`, data).then((r) => r.data.data as User),
  toggle: (id: number) => api.patch(`/users/${id}/toggle-active`).then((r) => r.data.data as User),
  remove: (id: number) => api.delete(`/users/${id}`).then((r) => r.data.data),
};

export const statsApi = {
  dashboard: (period: 'today' | 'week' | 'month') =>
    api.get('/stats/dashboard', { params: { period } }).then((r) => r.data.data as DashboardData),
  exportReport: (period: string, format: 'pdf' | 'csv') =>
    api.post('/stats/export', { period, format }, { responseType: 'blob' }).then((r) => r.data as Blob),
};

export const cashApi = {
  current: () => api.get('/cash/current').then((r) => r.data.data as CashSessionSummary | null),
  open: (openingFloat: number, notes?: string) =>
    api.post('/cash/open', { openingFloat, notes }).then((r) => r.data.data as CashSessionSummary),
  close: (countedCash: number, discrepancyReason?: string, notes?: string) =>
    api.post('/cash/close', { countedCash, discrepancyReason, notes }).then((r) => r.data.data as CashSessionSummary),
  openDrawer: (reason?: string) => api.post('/cash/drawer', { reason }).then((r) => r.data.data),
  sessions: () => api.get('/cash/sessions').then((r) => r.data.data as CashSessionSummary[]),
  sessionReport: (id: number) => api.get(`/cash/sessions/${id}`).then((r) => r.data.data as CashSessionSummary),
};

export const auditApi = {
  list: (params?: { action?: string; entityType?: string; userId?: number; limit?: number }) =>
    api.get('/audit', { params }).then((r) => r.data.data as AuditLogEntry[]),
};

export const promotionApi = {
  list: () => api.get('/promotions').then((r) => r.data.data as Promotion[]),
  create: (data: Partial<Promotion>) => api.post('/promotions', data).then((r) => r.data.data as Promotion),
  update: (id: number, data: Partial<Promotion>) => api.put(`/promotions/${id}`, data).then((r) => r.data.data as Promotion),
  remove: (id: number) => api.delete(`/promotions/${id}`).then((r) => r.data.data),
  activeHappyHour: () => api.get('/promotions/happy-hour/active').then((r) => r.data.data as Promotion | null),
  checkCoupon: (code: string) =>
    api.get(`/promotions/coupon/${encodeURIComponent(code)}`).then(
      (r) => r.data.data as { id: number; name: string; discountType: 'percent' | 'amount'; discountValue: number }
    ),
};

export const settingsApi = {
  getMaxDiscount: () => api.get('/settings/max-discount').then((r) => r.data.data.maxDiscountPercent as number),
  setMaxDiscount: (maxDiscountPercent: number) =>
    api.put('/settings/max-discount', { maxDiscountPercent }).then((r) => r.data.data),
  getManagerPinStatus: () =>
    api.get('/settings/manager-pin/status').then((r) => r.data.data.configured as boolean),
  setManagerPin: (pin: string) =>
    api.put('/settings/manager-pin', { pin }).then((r) => r.data.data.configured as boolean),
};

export const notificationApi = {
  list: () => api.get('/notifications').then((r) => r.data.data as AppNotification[]),
  markRead: (id: number) => api.patch(`/notifications/${id}/read`).then((r) => r.data.data),
};

export interface SyncResult {
  clientId?: string;
  orderNumber?: string;
  orderId?: number;
  status: string;
  error?: string;
}

export const syncApi = {
  push: (orders: CreateOrderPayload[]) =>
    api.post('/sync', { orders }).then((r) => r.data.data as { results: SyncResult[] }),
};
