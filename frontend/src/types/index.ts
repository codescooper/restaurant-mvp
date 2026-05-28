export type Role = 'propriétaire' | 'administrateur' | 'caissier' | 'cuisinier' | 'serveur';

// ─── Blog & Success Stories ───────────────────────────────────────────────────
export type ArticleType = 'blog' | 'success_story';

export interface ArticleListItem {
  id: number;
  type: ArticleType;
  title: string;
  slug: string;
  excerpt: string | null;
  coverUrl: string | null;
  category: string | null;
  authorName: string | null;
  featuredName: string | null;
  publishedAt: string | null;
}

export interface Article extends ArticleListItem {
  content: string;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

export interface Branding {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  logoUrl: string | null;
  coverUrl: string | null;
  backgroundUrl: string | null;
  whatsapp: string | null;
}

export type RestaurantStatus = 'pending' | 'active' | 'suspended' | 'rejected';

export interface CurrentRestaurant {
  id: number;
  name: string;
  slug: string;
  status: RestaurantStatus;
  rejectedReason?: string | null;
  suspendedReason?: string | null;
}

export interface Invitation {
  id: number;
  restaurantId: number;
  email: string;
  role: Role;
  token: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  url?: string;          // present a la creation
}

export interface AdminRestaurantRow {
  id: number;
  name: string;
  slug: string;
  status: RestaurantStatus;
  createdAt: string;
  activatedAt?: string | null;
  rejectedAt?: string | null;
  rejectedReason?: string | null;
  suspendedAt?: string | null;
  suspendedReason?: string | null;
  _count: { dishes: number; tables: number; memberships: number; invitations: number };
  memberships: { user: { email: string; displayName: string | null } }[];
}

export interface User {
  id: number;
  email: string;
  displayName?: string | null;
  isSuperAdmin?: boolean;
}

export interface MembershipView {
  restaurantId: number;
  restaurantName: string;
  restaurantSlug: string;
  role: Role;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  memberships: MembershipView[];
  currentRestaurant?: CurrentRestaurant | null;
}

export interface MenuVariant {
  id: number;
  name: string;
  price: number | null;
  available: boolean;
}

export type PriceType = 'fixe' | 'libre';

export interface MenuDish {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  priceType?: PriceType;
  priceMin?: number | null;
  priceMax?: number | null;
  category?: string | null;
  imageUrl?: string | null;
  available: boolean;
  variants?: MenuVariant[];
}

export interface DishIngredient {
  id: number;
  stockItemId: number;
  quantityNeeded: number;
  stockItem: { id: number; name: string; unit: string; quantity: number; unitCost?: number };
}

export interface DishVariant {
  id: number;
  name: string;
  price: number | null;
  isActive: boolean;
  sortOrder?: number;
  costPrice?: number;
  ingredients: DishIngredient[];
}

export interface Dish {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  priceType?: PriceType;
  priceMin?: number | null;
  priceMax?: number | null;
  category?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
  preparationTime?: number | null;
  costPrice?: number;
  ingredients: DishIngredient[];
  variants?: DishVariant[];
}

export interface CartItem {
  id: number; // dishId
  variantId?: number;
  variantName?: string;
  name: string;
  price: number;
  // Renseigné pour les plats à prix libre (montant saisi en caisse) ; envoyé au backend.
  customPrice?: number;
  quantity: number;
  notes?: string;
  offered?: boolean;
}

export interface Promotion {
  id: number;
  name: string;
  kind: 'happy_hour' | 'coupon';
  discountType: 'percent' | 'amount';
  discountValue: number;
  isActive: boolean;
  startHour?: number | null;
  endHour?: number | null;
  days?: string | null;
  code?: string | null;
  maxUses?: number | null;
  usedCount: number;
}

export interface StockItem {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
  alertThreshold: number;
  lastUpdated: string;
}

export interface OrderLineItem {
  id: number;
  dishId: number;
  dishName: string;
  dishPrice: number;
  variantId?: number | null;
  variantName?: string | null;
  isOffered?: boolean;
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
  isRefunded?: boolean;
  refundedAt?: string | null;
  refundReason?: string | null;
  tipAmount?: number;
  tipMethod?: string | null;
  promoLabel?: string | null;
  channel?: string;
  deliveryPlatform?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
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

export type TableStatus = 'libre' | 'occupée' | 'addition_demandée' | 'réservée';

export interface ReservationItem {
  id: number;
  dishId?: number | null;
  dishName: string;
  dishPrice: number;
  variantId?: number | null;
  variantName?: string | null;
  quantity: number;
  subtotal: number;
  notes?: string | null;
}

// Version compacte des items renvoyée dans le plan de salle.
export interface ReservationItemSummary {
  id: number;
  dishName: string;
  variantName?: string | null;
  quantity: number;
  subtotal: number;
}

export type ReservationPaymentStatus = 'aucun' | 'avance' | 'réglé';

export interface TableReservationInfo {
  id: number;
  customerName: string;
  reservedAt: string;
  partySize?: number | null;
  durationMinutes?: number;
  endAt?: string;
  availableAgainAt?: string;
  hasPreOrder?: boolean;
  totalAmount?: number;
  depositAmount?: number;
  remaining?: number;
  paymentStatus?: ReservationPaymentStatus;
  items?: ReservationItemSummary[];
}

export interface RestaurantTable {
  id: number;
  name: string;
  capacity: number;
  status: TableStatus;
  billRequested: boolean;
  server: { id: number; displayName: string | null } | null;
  total: number;
  unpaidTotal: number;
  hasUnpaid: boolean;
  reservation?: TableReservationInfo | null;
  orders: TableOrderSummary[];
}

export interface Reservation {
  id: number;
  tableId: number;
  customerName: string;
  customerPhone?: string | null;
  partySize?: number | null;
  reservedAt: string;
  durationMinutes: number;
  endAt?: string;
  availableAgainAt?: string;
  graceMinutes?: number;
  cleaningMinutes?: number;
  hasPreOrder: boolean;
  totalAmount: number;
  depositAmount: number;
  depositMethod?: string | null;
  remaining?: number;
  paymentStatus: ReservationPaymentStatus;
  items: ReservationItem[];
  note?: string | null;
  status: 'active' | 'annulée' | 'honorée';
  table?: { id: number; name: string };
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

export type ContractType = 'CDI' | 'CDD' | 'extra' | 'stagiaire' | 'autre';
export type SalaryPeriod = 'mensuel' | 'horaire' | 'journalier';
export type SalaryPaymentMethod = 'espèces' | 'virement' | 'mobile_money';

export interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  photoUrl?: string | null;
  position?: string | null;
  contractType?: ContractType | null;
  hireDate?: string | null;
  endDate?: string | null;
  salary?: number | null;
  salaryPeriod?: SalaryPeriod | null;
  paymentMethod?: SalaryPaymentMethod | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  idNumber?: string | null;
  notes?: string | null;
  isActive: boolean;
  userId?: number | null;
  createdAt?: string;
  updatedAt?: string;
  user?: { id: number; displayName: string | null } | null;
}

export interface Expense {
  id: number;
  label: string;
  category: string;
  amount: number;
  expenseDate: string;
  paymentMethod?: string | null;
  note?: string | null;
  createdBy?: number | null;
  createdAt: string;
  creator?: { id: number; displayName: string | null } | null;
}

export interface Supplier {
  id: number;
  name: string;
  phone?: string | null;
  contact?: string | null;
  note?: string | null;
  createdAt?: string;
  debt?: number;
  purchases?: Purchase[];
}

export interface Purchase {
  id: number;
  supplierId: number;
  stockItemId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  dueDate?: string | null;
  isPaid: boolean;
  paidAt?: string | null;
  note?: string | null;
  createdAt: string;
  supplier?: { id: number; name: string };
  stockItem?: { id?: number; name: string; unit: string };
}

export interface InventoryLine {
  id: number;
  inventoryId: number;
  stockItemId: number;
  theoreticalQty: number;
  countedQty?: number | null;
  stockItem?: { name: string; unit: string };
}

export interface Inventory {
  id: number;
  type: string;
  status: 'en_cours' | 'validé';
  note?: string | null;
  createdAt: string;
  validatedAt?: string | null;
  creator?: { displayName: string | null } | null;
  lines?: InventoryLine[];
  _count?: { lines: number };
}

export interface CashSessionSummary {
  id: number;
  cashierId: number;
  openingFloat: number;
  status: 'ouverte' | 'fermée';
  openedAt: string;
  closedAt?: string | null;
  expectedCash?: number | null;
  cashTips?: number | null;
  countedCash?: number | null;
  discrepancy?: number | null;
  discrepancyReason?: string | null;
  notes?: string | null;
  salesByMethod?: { method: string; count: number; amount: number }[];
  orders?: {
    id: number;
    orderNumber: string;
    finalTotal: number;
    paymentMethod: string | null;
    isRefunded: boolean;
    refundReason?: string | null;
    paidAt: string | null;
  }[];
  cashier?: { id: number; displayName: string | null };
  closer?: { id: number; displayName: string | null } | null;
}

export interface AuditLogEntry {
  id: number;
  userId: number | null;
  action: string;
  entityType: string;
  entityId: number | null;
  details?: Record<string, unknown> | null;
  createdAt: string;
  user?: { id: number; displayName: string | null } | null;
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
  totalExpenses: number;
  previousPeriodExpenses: number;
  expensesGrowth: number;
  stockPurchases: number;
  previousStockPurchases: number;
  stockPurchasesGrowth: number;
  foodCost: number;
  foodCostPct: number;
  grossMargin: number;
  grossMarginPct: number;
  lossValue: number;
  netProfit: number;
  previousNetProfit: number;
  profitGrowth: number;
  expensesByCategory: { category: string; amount: number }[];
  dishMargins: { name: string; cost: number; price: number; marginPct: number }[];
  salesByHour: { hour: string; amount: number; orders: number }[];
  topDishes: { name: string; quantity: number; revenue: number; percentage: number }[];
  paymentMethods: { method: string; count: number; amount: number; percentage: number }[];
  salesByChannel: { channel: string; count: number; amount: number; percentage: number }[];
  tips: {
    total: number;
    byServer: { server: string; amount: number }[];
    byMethod: { method: string; amount: number }[];
  };
  recentOrders: { orderNumber: string; time: string; amount: number; items: number; status: string }[];
}
