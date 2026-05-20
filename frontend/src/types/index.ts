export type Role = 'administrateur' | 'caissier' | 'cuisinier' | 'serveur';

export interface User {
  id: number;
  username: string;
  role: Role;
  isActive?: boolean;
  lastLogin?: string | null;
  createdAt?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface MenuDish {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  category?: string | null;
  imageUrl?: string | null;
  available: boolean;
}

export interface DishIngredient {
  id: number;
  stockItemId: number;
  quantityNeeded: number;
  stockItem: { id: number; name: string; unit: string; quantity: number };
}

export interface Dish {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  category?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
  preparationTime?: number | null;
  ingredients: DishIngredient[];
}

export interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

export interface StockItem {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  alertThreshold: number;
  lastUpdated: string;
}

export interface OrderLineItem {
  id: number;
  dishId: number;
  dishName: string;
  dishPrice: number;
  quantity: number;
  subtotal: number;
  notes?: string | null;
}

export type OrderStatus = 'commandée' | 'en_cours' | 'prête' | 'servie' | 'annulée';

export interface Order {
  id: number;
  orderNumber: string;
  total: number;
  discountAmount: number;
  discountPercent: number;
  finalTotal: number;
  paymentMethod: string | null;
  mobileMoneyProvider?: string | null;
  cashGiven?: number | null;
  changeReturned?: number | null;
  isPaid: boolean;
  tableId?: number | null;
  serverId?: number | null;
  paidAt?: string | null;
  status: OrderStatus;
  createdAt: string;
  preparedAt?: string | null;
  readyAt?: string | null;
  servedAt?: string | null;
  items: OrderLineItem[];
}

export interface TableOrderSummary {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  finalTotal: number;
  isPaid: boolean;
  items: { id: number; dishName: string; quantity: number }[];
}

export interface RestaurantTable {
  id: number;
  name: string;
  capacity: number;
  status: 'libre' | 'occupée';
  server: { id: number; username: string } | null;
  total: number;
  unpaidTotal: number;
  hasUnpaid: boolean;
  orders: TableOrderSummary[];
}

export interface KitchenOrderItem {
  id: number;
  name: string;
  quantity: number;
  notes?: string | null;
}

export interface KitchenOrder {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  items: KitchenOrderItem[];
}

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  timestamp: string;
}

export interface DashboardData {
  totalSales: number;
  totalOrders: number;
  averageTicket: number;
  peakHour: string;
  peakHourSales: number;
  previousPeriodSales: number;
  previousPeriodOrders: number;
  previousPeriodTicket: number;
  salesGrowth: number;
  ordersGrowth: number;
  ticketGrowth: number;
  salesByHour: { hour: string; amount: number; orders: number }[];
  topDishes: { name: string; quantity: number; revenue: number; percentage: number }[];
  paymentMethods: { method: string; count: number; amount: number; percentage: number }[];
  recentOrders: { orderNumber: string; time: string; amount: number; items: number; status: string }[];
}
