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
  Employee,
  Expense,
  MembershipView,
  CurrentRestaurant,
  Invitation,
  AdminRestaurantRow,
  RestaurantStatus,
} from '../types';

export interface VariantInput {
  name: string;
  price?: number;
  isActive?: boolean;
  ingredients?: { stockItemId: number; quantityNeeded: number }[];
}

export interface DishInput {
  name: string;
  description?: string;
  price: number;
  priceType?: 'fixe' | 'libre';
  priceMin?: number;
  priceMax?: number;
  category?: string;
  preparationTime?: number;
  isActive?: boolean;
  imageUrl?: string;
  ingredients?: { stockItemId: number; quantityNeeded: number }[];
  variants?: VariantInput[];
}

export interface PaymentInput {
  mobileMoneyProvider?: string;
  cashGiven?: number;
  changeReturned?: number;
}

export interface CreateOrderPayload {
  items: { dishId: number; variantId?: number; customPrice?: number; offered?: boolean; quantity: number; notes?: string }[];
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
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then((r) => r.data.data as AuthResponse),
  me: () =>
    api.get('/auth/me').then((r) => r.data.data as {
      user: User;
      memberships: MembershipView[];
      currentRestaurant: CurrentRestaurant | null;
    }),
  switchRestaurant: (restaurantId: number) =>
    api.post('/auth/switch-restaurant', { restaurantId }).then((r) => r.data.data as AuthResponse),
};

export const signupApi = {
  signup: (data: { email: string; password: string; displayName: string; restaurantName: string }) =>
    api.post('/auth/signup', data).then((r) => r.data.data as AuthResponse),
};

export const invitationApi = {
  list: () => api.get('/invitations').then((r) => r.data.data as Invitation[]),
  create: (email: string, role: Role) =>
    api.post('/invitations', { email, role }).then((r) => r.data.data as Invitation),
  revoke: (id: number) => api.delete(`/invitations/${id}`).then((r) => r.data.data),
};

export const publicInviteApi = {
  peek: (token: string) =>
    api.get(`/public/invitations/${token}`).then((r) => r.data.data as {
      restaurantName: string;
      role: Role;
      email: string;
      status: 'pending' | 'accepted' | 'revoked' | 'expired';
      expiresAt: string;
      emailExists: boolean;
    }),
  accept: (token: string, body: { password: string; displayName?: string }) =>
    api.post(`/public/invitations/${token}/accept`, body).then((r) => r.data.data as AuthResponse),
};

export const adminApi = {
  listRestaurants: (status?: RestaurantStatus) =>
    api.get('/admin/restaurants', { params: status ? { status } : {} })
       .then((r) => r.data.data as AdminRestaurantRow[]),
  activate: (id: number) =>
    api.post(`/admin/restaurants/${id}/activate`).then((r) => r.data.data as {
      status: 'active';
      deletedCounts: Record<string, number>;
    }),
  suspend: (id: number, reason?: string) =>
    api.post(`/admin/restaurants/${id}/suspend`, { reason }).then((r) => r.data.data),
  reactivate: (id: number) =>
    api.post(`/admin/restaurants/${id}/reactivate`).then((r) => r.data.data),
  reject: (id: number, reason?: string) =>
    api.post(`/admin/restaurants/${id}/reject`, { reason }).then((r) => r.data.data),
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
      .then(
        (r) =>
          r.data.data as {
            tableId: number;
            paidCount: number;
            total: number;
            depositApplied: number;
            due: number;
            tip: number;
            change: number;
            paymentMethod: string;
          }
      ),
  billRequest: (id: number, requested: boolean) =>
    api.patch(`/tables/${id}/bill-request`, { requested }).then((r) => r.data.data),
  merge: (id: number, targetTableId: number) =>
    api.post(`/tables/${id}/merge`, { targetTableId }).then((r) => r.data.data),
  reservations: () => api.get('/tables/reservations').then((r) => r.data.data as Reservation[]),
  createReservation: (data: ReservationPayload) =>
    api.post('/tables/reservations', data).then((r) => r.data.data as Reservation),
  updateReservation: (id: number, data: ReservationPayload) =>
    api.put(`/tables/reservations/${id}`, data).then((r) => r.data.data as Reservation),
  arriveReservation: (id: number) => api.post(`/tables/reservations/${id}/arrive`).then((r) => r.data.data),
  cancelReservation: (id: number, refundDeposit = false) =>
    api.patch(`/tables/reservations/${id}/cancel`, { refundDeposit }).then((r) => r.data.data),
  honorReservation: (id: number) => api.patch(`/tables/reservations/${id}/honor`).then((r) => r.data.data),
};

export interface ReservationItemPayload {
  dishId: number;
  variantId?: number;
  quantity: number;
  notes?: string;
}
export interface ReservationPayload {
  tableId?: number;
  customerName?: string;
  customerPhone?: string;
  partySize?: number;
  reservedAt?: string;
  durationMinutes?: number;
  note?: string;
  hasPreOrder?: boolean;
  items?: ReservationItemPayload[];
  totalAmount?: number;
  depositAmount?: number;
  depositMethod?: string;
}

export interface MemberRow {
  membershipId: number;
  userId: number;
  email: string;
  displayName: string | null;
  role: Role;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
}

export const userApi = {
  list: () => api.get('/users').then((r) => r.data.data as MemberRow[]),
  create: (data: { email: string; password: string; role: Role; displayName?: string }) =>
    api.post('/users', data).then((r) => r.data.data as MemberRow),
  update: (membershipId: number, data: { role?: Role; password?: string; displayName?: string }) =>
    api.put(`/users/${membershipId}`, data).then((r) => r.data.data as MemberRow),
  toggle: (membershipId: number) => api.patch(`/users/${membershipId}/toggle-active`).then((r) => r.data.data as MemberRow),
  remove: (membershipId: number) => api.delete(`/users/${membershipId}`).then((r) => r.data.data),
};

export interface EmployeeInput {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  address?: string;
  photoUrl?: string;
  position?: string;
  contractType?: string;
  hireDate?: string;
  endDate?: string;
  salary?: number;
  salaryPeriod?: string;
  paymentMethod?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  idNumber?: string;
  notes?: string;
  isActive?: boolean;
  userId?: number | null;
}

export const employeeApi = {
  list: () => api.get('/employees').then((r) => r.data.data as Employee[]),
  get: (id: number) => api.get(`/employees/${id}`).then((r) => r.data.data as Employee),
  create: (data: EmployeeInput) => api.post('/employees', data).then((r) => r.data.data as Employee),
  update: (id: number, data: EmployeeInput) => api.put(`/employees/${id}`, data).then((r) => r.data.data as Employee),
  remove: (id: number) => api.delete(`/employees/${id}`).then((r) => r.data.data),
};

export interface ExpenseInput {
  label: string;
  category: string;
  amount: number;
  expenseDate: string;
  paymentMethod?: string;
  note?: string;
}

export const expenseApi = {
  list: (category?: string) =>
    api.get('/expenses', { params: category ? { category } : {} }).then((r) => r.data.data as Expense[]),
  create: (data: ExpenseInput) => api.post('/expenses', data).then((r) => r.data.data as Expense),
  update: (id: number, data: ExpenseInput) => api.put(`/expenses/${id}`, data).then((r) => r.data.data as Expense),
  remove: (id: number) => api.delete(`/expenses/${id}`).then((r) => r.data.data),
};

export const statsApi = {
  dashboard: (from: string, to: string) =>
    api.get('/stats/dashboard', { params: { from, to } }).then((r) => r.data.data as DashboardData),
  exportReport: (from: string, to: string, format: 'pdf' | 'csv') =>
    api.post('/stats/export', { from, to, format }, { responseType: 'blob' }).then((r) => r.data as Blob),
  // Télécharge un rapport (PDF/CSV) via requête authentifiée (le token passe par l'en-tête
  // Authorization, pas l'URL) ; renvoie un Blob prêt à enregistrer côté navigateur.
  downloadReport: (kind: 'report' | 'product-report', start: string, end: string, format: 'pdf' | 'csv') =>
    api
      .get(`/stats/${kind}`, { params: { start, end, format }, responseType: 'blob' })
      .then((r) => r.data as Blob),
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
  getRestaurantName: () =>
    api.get('/settings/restaurant-name').then((r) => r.data.data.restaurantName as string),
  setRestaurantName: (restaurantName: string) =>
    api.put('/settings/restaurant-name', { restaurantName }).then((r) => r.data.data.restaurantName as string),
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
