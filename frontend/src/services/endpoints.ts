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
} from '../types';

export interface DishInput {
  name: string;
  description?: string;
  price: number;
  category?: string;
  preparationTime?: number;
  isActive?: boolean;
  ingredients?: { stockItemId: number; quantityNeeded: number }[];
}

export interface PaymentInput {
  mobileMoneyProvider?: string;
  cashGiven?: number;
  changeReturned?: number;
}

export interface CreateOrderPayload {
  items: { dishId: number; quantity: number; notes?: string }[];
  discountAmount: number;
  discountPercent: number;
  paymentMethod?: string; // absent = commande différée (réglée à la caisse)
  paymentDetails?: PaymentInput;
  tableId?: number;
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
};

export const orderApi = {
  list: (statuses?: string[]) =>
    api
      .get('/orders', { params: statuses?.length ? { status: statuses.join(',') } : {} })
      .then((r) => r.data.data as Order[]),
  create: (payload: CreateOrderPayload) => api.post('/orders', payload).then((r) => r.data.data),
  updateStatus: (id: number, status: string) =>
    api.patch(`/orders/${id}/status`, { status }).then((r) => r.data.data.order as Order),
  cancel: (id: number, reason: string) => api.post(`/orders/${id}/cancel`, { reason }).then((r) => r.data.data as Order),
  pay: (id: number, paymentMethod: string, paymentDetails?: PaymentInput) =>
    api.post(`/orders/${id}/pay`, { paymentMethod, paymentDetails }).then((r) => r.data.data as Order),
};

export const tableApi = {
  list: () => api.get('/tables').then((r) => r.data.data as RestaurantTable[]),
  create: (data: { name: string; capacity?: number }) => api.post('/tables', data).then((r) => r.data.data),
  update: (id: number, data: { name?: string; capacity?: number }) => api.put(`/tables/${id}`, data).then((r) => r.data.data),
  remove: (id: number) => api.delete(`/tables/${id}`).then((r) => r.data.data),
  settle: (id: number, paymentMethod: string, paymentDetails?: PaymentInput) =>
    api
      .post(`/tables/${id}/settle`, { paymentMethod, paymentDetails })
      .then((r) => r.data.data as { tableId: number; paidCount: number; total: number; change: number; paymentMethod: string }),
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
