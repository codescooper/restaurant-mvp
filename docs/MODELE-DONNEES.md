# Modèle de données — Restoflow

Source de vérité : `backend/prisma/schema.prisma`. **Les tableaux ci-dessous sont générés
automatiquement** par `node scripts/sync-docs.mjs` — ne les éditez pas à la main.

## 1. Principes

- ORM **Prisma** sur **PostgreSQL**. Chaque entité opérationnelle porte `restaurantId` (isolation
  multi-tenant). Les contraintes d'unicité sont scopées par tenant (ex. `[restaurantId, orderNumber]`).
- Montants en **entiers FCFA** ; quantités de stock en flottants.
- Énumérations métier en **français accentué** (stockées en `VARCHAR`, validées par Zod) —
  définies dans `backend/src/constants.ts` (rôles, statuts de table, statuts de réservation,
  types de promotion/réduction, statuts matrimoniaux, configuration de paie).

## 2. Modèles

<!-- AUTO:MODELS:START -->
> 31 modèles définis dans `backend/prisma/schema.prisma`.

#### `Restaurant`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `name` | `String` |
| `slug` | `String` |
| `status` | `String` |
| `createdAt` | `DateTime` |
| `activatedAt` | `DateTime?` |
| `rejectedAt` | `DateTime?` |
| `rejectedReason` | `String?` |
| `suspendedAt` | `DateTime?` |
| `suspendedReason` | `String?` |
| `memberships` | `Membership[]` |
| `users` | `User[]` |
| `dishes` | `Dish[]` |
| `stockItems` | `StockItem[]` |
| `orders` | `Order[]` |
| `tables` | `Table[]` |
| `cashSessions` | `CashSession[]` |
| `reservations` | `Reservation[]` |
| `promotions` | `Promotion[]` |
| `expenses` | `Expense[]` |
| `employees` | `Employee[]` |
| `suppliers` | `Supplier[]` |
| `purchases` | `Purchase[]` |
| `inventories` | `Inventory[]` |
| `notifications` | `Notification[]` |
| `auditLogs` | `AuditLog[]` |
| `appSettings` | `AppSetting[]` |
| `stockMovements` | `StockMovement[]` |
| `invitations` | `Invitation[]` |
| `catalogRequests` | `CatalogRequest[]` |
| `orderPayments` | `OrderPayment[]` |

#### `Membership`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `userId` | `Int` |
| `restaurantId` | `Int` |
| `role` | `String` |
| `isActive` | `Boolean` |
| `createdAt` | `DateTime` |
| `user` | `User` |
| `restaurant` | `Restaurant` |

#### `Invitation`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `restaurantId` | `Int` |
| `email` | `String` |
| `role` | `String` |
| `token` | `String` |
| `status` | `String` |
| `expiresAt` | `DateTime` |
| `createdBy` | `Int?` |
| `acceptedAt` | `DateTime?` |
| `revokedAt` | `DateTime?` |
| `createdAt` | `DateTime` |
| `restaurant` | `Restaurant` |
| `creator` | `User?` |

#### `User`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `email` | `String` |
| `passwordHash` | `String` |
| `displayName` | `String?` |
| `isSuperAdmin` | `Boolean` |
| `isActive` | `Boolean` |
| `createdAt` | `DateTime` |
| `lastLogin` | `DateTime?` |
| `restaurantId` | `Int?` |
| `restaurant` | `Restaurant?` |
| `memberships` | `Membership[]` |
| `createdOrders` | `Order[]` |
| `servedOrders` | `Order[]` |
| `cancelledOrders` | `Order[]` |
| `refundedOrders` | `Order[]` |
| `stockMovements` | `StockMovement[]` |
| `notificationReads` | `NotificationRead[]` |
| `cashSessions` | `CashSession[]` |
| `closedSessions` | `CashSession[]` |
| `auditLogs` | `AuditLog[]` |
| `purchases` | `Purchase[]` |
| `inventories` | `Inventory[]` |
| `reservations` | `Reservation[]` |
| `employee` | `Employee?` |
| `expenses` | `Expense[]` |
| `invitationsCreated` | `Invitation[]` |
| `articlesCreated` | `Article[]` |
| `catalogRequestsCreated` | `CatalogRequest[]` |

#### `Expense`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `label` | `String` |
| `category` | `String` |
| `amount` | `Int` |
| `expenseDate` | `DateTime` |
| `paymentMethod` | `String?` |
| `note` | `String?` |
| `createdBy` | `Int?` |
| `createdAt` | `DateTime` |
| `restaurantId` | `Int?` |
| `creator` | `User?` |
| `restaurant` | `Restaurant?` |

#### `Employee`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `firstName` | `String` |
| `lastName` | `String` |
| `phone` | `String?` |
| `email` | `String?` |
| `address` | `String?` |
| `photoUrl` | `String?` |
| `position` | `String?` |
| `contractType` | `String?` |
| `hireDate` | `DateTime?` |
| `endDate` | `DateTime?` |
| `salary` | `Int?` |
| `salaryPeriod` | `String?` |
| `paymentMethod` | `String?` |
| `emergencyContact` | `String?` |
| `emergencyPhone` | `String?` |
| `idNumber` | `String?` |
| `notes` | `String?` |
| `cnpsNumber` | `String?` |
| `maritalStatus` | `String?` |
| `dependentChildren` | `Int?` |
| `birthDate` | `DateTime?` |
| `isActive` | `Boolean` |
| `userId` | `Int?` |
| `createdAt` | `DateTime` |
| `updatedAt` | `DateTime` |
| `restaurantId` | `Int?` |
| `user` | `User?` |
| `restaurant` | `Restaurant?` |

#### `StockItem`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `name` | `String` |
| `quantity` | `Float` |
| `baselineQuantity` | `Float?` |
| `unit` | `String` |
| `unitCost` | `Float` |
| `alertThreshold` | `Float` |
| `lastUpdated` | `DateTime` |
| `createdAt` | `DateTime` |
| `restaurantId` | `Int?` |
| `dishIngredients` | `DishIngredient[]` |
| `variantIngredients` | `VariantIngredient[]` |
| `movements` | `StockMovement[]` |
| `notifications` | `Notification[]` |
| `purchases` | `Purchase[]` |
| `inventoryLines` | `InventoryLine[]` |
| `restaurant` | `Restaurant?` |

#### `Dish`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `name` | `String` |
| `description` | `String?` |
| `price` | `Int` |
| `priceType` | `String` |
| `priceMin` | `Int?` |
| `priceMax` | `Int?` |
| `imageUrl` | `String?` |
| `isActive` | `Boolean` |
| `category` | `String?` |
| `preparationTime` | `Int?` |
| `createdAt` | `DateTime` |
| `updatedAt` | `DateTime` |
| `restaurantId` | `Int?` |
| `ingredients` | `DishIngredient[]` |
| `variants` | `DishVariant[]` |
| `orderItems` | `OrderItem[]` |
| `reservationItems` | `ReservationItem[]` |
| `restaurant` | `Restaurant?` |

#### `DishIngredient`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `dishId` | `Int` |
| `stockItemId` | `Int` |
| `quantityNeeded` | `Float` |
| `dish` | `Dish` |
| `stockItem` | `StockItem` |

#### `DishVariant`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `dishId` | `Int` |
| `name` | `String` |
| `price` | `Int?` |
| `isActive` | `Boolean` |
| `sortOrder` | `Int` |
| `dish` | `Dish` |
| `ingredients` | `VariantIngredient[]` |
| `orderItems` | `OrderItem[]` |
| `reservationItems` | `ReservationItem[]` |

#### `VariantIngredient`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `variantId` | `Int` |
| `stockItemId` | `Int` |
| `quantityNeeded` | `Float` |
| `variant` | `DishVariant` |
| `stockItem` | `StockItem` |

#### `Order`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `orderNumber` | `String` |
| `total` | `Int` |
| `discountAmount` | `Int` |
| `discountPercent` | `Float` |
| `finalTotal` | `Int` |
| `depositApplied` | `Int` |
| `paymentMethod` | `String?` |
| `paymentDetails` | `Json?` |
| `mobileMoneyProvider` | `String?` |
| `cashGiven` | `Int?` |
| `changeReturned` | `Int?` |
| `channel` | `String` |
| `deliveryPlatform` | `String?` |
| `customerName` | `String?` |
| `customerPhone` | `String?` |
| `taxRate` | `Float` |
| `taxAmount` | `Int` |
| `tipAmount` | `Int` |
| `tipMethod` | `String?` |
| `promotionId` | `Int?` |
| `promoLabel` | `String?` |
| `isPaid` | `Boolean` |
| `paidAt` | `DateTime?` |
| `status` | `String` |
| `tableId` | `Int?` |
| `serverId` | `Int?` |
| `createdBy` | `Int?` |
| `cashSessionId` | `Int?` |
| `createdAt` | `DateTime` |
| `preparedAt` | `DateTime?` |
| `readyAt` | `DateTime?` |
| `servedAt` | `DateTime?` |
| `cancelledAt` | `DateTime?` |
| `cancelledBy` | `Int?` |
| `cancellationReason` | `String?` |
| `isRefunded` | `Boolean` |
| `refundedAt` | `DateTime?` |
| `refundedBy` | `Int?` |
| `refundReason` | `String?` |
| `isSynced` | `Boolean` |
| `clientId` | `String?` |
| `restaurantId` | `Int?` |
| `creator` | `User?` |
| `server` | `User?` |
| `canceller` | `User?` |
| `refunder` | `User?` |
| `table` | `Table?` |
| `cashSession` | `CashSession?` |
| `promotion` | `Promotion?` |
| `items` | `OrderItem[]` |
| `stockMovements` | `StockMovement[]` |
| `notifications` | `Notification[]` |
| `payments` | `OrderPayment[]` |
| `restaurant` | `Restaurant?` |

#### `OrderItem`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `orderId` | `Int` |
| `dishId` | `Int` |
| `dishName` | `String` |
| `dishPrice` | `Int` |
| `variantId` | `Int?` |
| `variantName` | `String?` |
| `isOffered` | `Boolean` |
| `quantity` | `Int` |
| `subtotal` | `Int` |
| `notes` | `String?` |
| `order` | `Order` |
| `dish` | `Dish` |
| `variant` | `DishVariant?` |

#### `StockMovement`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `stockItemId` | `Int` |
| `movementType` | `String` |
| `quantity` | `Float` |
| `previousQuantity` | `Float` |
| `newQuantity` | `Float` |
| `orderId` | `Int?` |
| `cause` | `String?` |
| `note` | `String?` |
| `createdBy` | `Int?` |
| `createdAt` | `DateTime` |
| `restaurantId` | `Int?` |
| `stockItem` | `StockItem` |
| `order` | `Order?` |
| `creator` | `User?` |
| `restaurant` | `Restaurant?` |

#### `Notification`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `userRole` | `String` |
| `title` | `String` |
| `message` | `String` |
| `type` | `String` |
| `relatedOrderId` | `Int?` |
| `relatedStockId` | `Int?` |
| `isRead` | `Boolean` |
| `createdAt` | `DateTime` |
| `restaurantId` | `Int?` |
| `relatedOrder` | `Order?` |
| `relatedStock` | `StockItem?` |
| `reads` | `NotificationRead[]` |
| `restaurant` | `Restaurant?` |

#### `NotificationRead`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `notificationId` | `Int` |
| `userId` | `Int` |
| `readAt` | `DateTime` |
| `notification` | `Notification` |
| `user` | `User` |

#### `AppSetting`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `settingKey` | `String` |
| `settingValue` | `String` |
| `description` | `String?` |
| `updatedAt` | `DateTime` |
| `restaurantId` | `Int?` |
| `restaurant` | `Restaurant?` |

#### `Table`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `name` | `String` |
| `capacity` | `Int` |
| `billRequested` | `Boolean` |
| `createdAt` | `DateTime` |
| `restaurantId` | `Int?` |
| `orders` | `Order[]` |
| `reservations` | `Reservation[]` |
| `restaurant` | `Restaurant?` |

#### `Reservation`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `tableId` | `Int` |
| `customerName` | `String` |
| `customerPhone` | `String?` |
| `partySize` | `Int?` |
| `reservedAt` | `DateTime` |
| `durationMinutes` | `Int` |
| `hasPreOrder` | `Boolean` |
| `totalAmount` | `Int` |
| `depositAmount` | `Int` |
| `depositMethod` | `String?` |
| `depositAt` | `DateTime?` |
| `depositCashSessionId` | `Int?` |
| `paymentStatus` | `String` |
| `depositConsumed` | `Boolean` |
| `depositRefunded` | `Boolean` |
| `depositRefundedAt` | `DateTime?` |
| `note` | `String?` |
| `status` | `String` |
| `createdBy` | `Int?` |
| `createdAt` | `DateTime` |
| `restaurantId` | `Int?` |
| `table` | `Table` |
| `creator` | `User?` |
| `depositCashSession` | `CashSession?` |
| `items` | `ReservationItem[]` |
| `restaurant` | `Restaurant?` |

#### `ReservationItem`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `reservationId` | `Int` |
| `dishId` | `Int?` |
| `dishName` | `String` |
| `dishPrice` | `Int` |
| `variantId` | `Int?` |
| `variantName` | `String?` |
| `quantity` | `Int` |
| `subtotal` | `Int` |
| `notes` | `String?` |
| `reservation` | `Reservation` |
| `dish` | `Dish?` |
| `variant` | `DishVariant?` |

#### `CashSession`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `cashierId` | `Int` |
| `openingFloat` | `Int` |
| `status` | `String` |
| `openedAt` | `DateTime` |
| `closedAt` | `DateTime?` |
| `closedBy` | `Int?` |
| `expectedCash` | `Int?` |
| `countedCash` | `Int?` |
| `discrepancy` | `Int?` |
| `discrepancyReason` | `String?` |
| `notes` | `String?` |
| `restaurantId` | `Int?` |
| `cashier` | `User` |
| `closer` | `User?` |
| `orders` | `Order[]` |
| `reservationDeposits` | `Reservation[]` |
| `restaurant` | `Restaurant?` |

#### `Promotion`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `name` | `String` |
| `kind` | `String` |
| `discountType` | `String` |
| `discountValue` | `Int` |
| `isActive` | `Boolean` |
| `startHour` | `Int?` |
| `endHour` | `Int?` |
| `days` | `String?` |
| `code` | `String?` |
| `maxUses` | `Int?` |
| `usedCount` | `Int` |
| `createdAt` | `DateTime` |
| `restaurantId` | `Int?` |
| `orders` | `Order[]` |
| `restaurant` | `Restaurant?` |

#### `AuditLog`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `userId` | `Int?` |
| `action` | `String` |
| `entityType` | `String` |
| `entityId` | `Int?` |
| `details` | `Json?` |
| `createdAt` | `DateTime` |
| `restaurantId` | `Int?` |
| `user` | `User?` |
| `restaurant` | `Restaurant?` |

#### `SyncQueue`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `actionType` | `String` |
| `tableName` | `String` |
| `recordId` | `Int?` |
| `data` | `Json` |
| `createdAt` | `DateTime` |
| `syncedAt` | `DateTime?` |
| `isSynced` | `Boolean` |

#### `Supplier`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `name` | `String` |
| `phone` | `String?` |
| `contact` | `String?` |
| `note` | `String?` |
| `createdAt` | `DateTime` |
| `restaurantId` | `Int?` |
| `purchases` | `Purchase[]` |
| `restaurant` | `Restaurant?` |

#### `Purchase`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `supplierId` | `Int` |
| `stockItemId` | `Int` |
| `quantity` | `Float` |
| `unitPrice` | `Int` |
| `totalPrice` | `Int` |
| `dueDate` | `DateTime?` |
| `isPaid` | `Boolean` |
| `paidAt` | `DateTime?` |
| `note` | `String?` |
| `createdBy` | `Int?` |
| `createdAt` | `DateTime` |
| `restaurantId` | `Int?` |
| `supplier` | `Supplier` |
| `stockItem` | `StockItem` |
| `creator` | `User?` |
| `restaurant` | `Restaurant?` |

#### `Inventory`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `type` | `String` |
| `status` | `String` |
| `note` | `String?` |
| `createdBy` | `Int?` |
| `createdAt` | `DateTime` |
| `validatedAt` | `DateTime?` |
| `restaurantId` | `Int?` |
| `creator` | `User?` |
| `lines` | `InventoryLine[]` |
| `restaurant` | `Restaurant?` |

#### `InventoryLine`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `inventoryId` | `Int` |
| `stockItemId` | `Int` |
| `theoreticalQty` | `Float` |
| `countedQty` | `Float?` |
| `inventory` | `Inventory` |
| `stockItem` | `StockItem` |

#### `Article`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `type` | `String` |
| `title` | `String` |
| `slug` | `String` |
| `excerpt` | `String?` |
| `content` | `String` |
| `coverUrl` | `String?` |
| `category` | `String?` |
| `authorName` | `String?` |
| `featuredName` | `String?` |
| `status` | `String` |
| `publishedAt` | `DateTime?` |
| `createdBy` | `Int?` |
| `createdAt` | `DateTime` |
| `updatedAt` | `DateTime` |
| `creator` | `User?` |

#### `CatalogRequest`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `restaurantId` | `Int?` |
| `platforms` | `String[]` |
| `message` | `String?` |
| `status` | `String` |
| `adminNote` | `String?` |
| `createdBy` | `Int?` |
| `createdAt` | `DateTime` |
| `processedAt` | `DateTime?` |
| `restaurant` | `Restaurant?` |
| `creator` | `User?` |

#### `OrderPayment`

| Champ | Type |
| --- | --- |
| `id` | `Int` |
| `orderId` | `Int` |
| `method` | `String` |
| `amount` | `Int` |
| `mobileMoneyProvider` | `String?` |
| `cashGiven` | `Int?` |
| `changeReturned` | `Int?` |
| `restaurantId` | `Int?` |
| `createdAt` | `DateTime` |
| `order` | `Order` |
| `restaurant` | `Restaurant?` |

<!-- AUTO:MODELS:END -->

## 3. Historique des migrations

<!-- AUTO:MIGRATIONS:START -->
> 27 migrations appliquées (ordre chronologique).

| Date | Migration |
| --- | --- |
| 2026-05-19 | init |
| 2026-05-20 | phase2 tables serveur |
| 2026-05-20 | caisse audit remboursement |
| 2026-05-21 | paiements canal client |
| 2026-05-21 | stocks avances |
| 2026-05-21 | dish variants |
| 2026-05-21 | tables avancees |
| 2026-05-21 | promotions |
| 2026-05-22 | pourboires |
| 2026-05-22 | dish image text |
| 2026-05-23 | prix libre min max |
| 2026-05-23 | employees |
| 2026-05-23 | expenses |
| 2026-05-23 | stock unit cost |
| 2026-05-24 | reservation duration |
| 2026-05-24 | reservation preorder payment |
| 2026-05-24 | reservation deposit settlement |
| 2026-05-24 | reservation deposit refund |
| 2026-05-26 | multitenant |
| 2026-05-26 | dish variant price optional |
| 2026-05-27 | p2a onboarding |
| 2026-05-28 | articles |
| 2026-05-28 | catalog requests |
| 2026-05-28 | order payments |
| 2026-05-29 | employee cnps |
| 2026-05-29 | employee birthdate |
| 2026-06-01 | order client id |
<!-- AUTO:MIGRATIONS:END -->
