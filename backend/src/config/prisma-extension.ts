import { Prisma } from '@prisma/client';
import { getTenantIdOrThrow, isUnscoped } from './tenant-context';

// Modèles portant une colonne restaurantId : seuls ceux-ci sont filtrés.
export const TENANT_MODELS = new Set<string>([
  'Dish', 'StockItem', 'Order', 'Table', 'CashSession', 'Reservation',
  'Promotion', 'Expense', 'Employee', 'Supplier', 'Purchase', 'Inventory',
  'Notification', 'AuditLog', 'AppSetting', 'StockMovement',
]);

// Opérations de lecture/agrégation qui acceptent un `where` : on y injecte restaurantId.
const WHERE_OPS = new Set([
  'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy',
  'updateMany', 'deleteMany',
]);

export const tenantExtension = Prisma.defineExtension({
  name: 'tenant-isolation',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!model || !TENANT_MODELS.has(model)) return query(args);
        // Contexte explicitement non-scopé (super-admin/auth) : ne rien injecter.
        if (isUnscoped()) return query(args);

        const restaurantId = getTenantIdOrThrow(); // refus par défaut si hors contexte
        const a = (args ?? {}) as Record<string, unknown>;

        // findUnique/findUniqueOrThrow : un `where` unique n'accepte pas de filtre non-unique.
        // L'API d'extension ne permet pas de changer l'opération → on POST-FILTRE le résultat
        // par restaurantId. On force la présence de restaurantId si un `select` restreint est fourni.
        if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
          if (a.select && typeof a.select === 'object') {
            (a.select as Record<string, unknown>).restaurantId = true;
          }
          const res = (await query(a)) as { restaurantId?: number } | null;
          if (res && res.restaurantId !== restaurantId) {
            if (operation === 'findUniqueOrThrow') {
              throw new Error('No record found (cross-tenant isolation)');
            }
            return null;
          }
          return res;
        }

        if (WHERE_OPS.has(operation)) {
          a.where = { ...((a.where as object) ?? {}), restaurantId };
          return query(a);
        }

        if (operation === 'create') {
          a.data = { ...((a.data as object) ?? {}), restaurantId };
          return query(a);
        }
        if (operation === 'createMany') {
          const data = (a.data as Record<string, unknown>[] | Record<string, unknown>);
          a.data = Array.isArray(data)
            ? data.map((d) => ({ ...d, restaurantId }))
            : { ...data, restaurantId };
          return query(a);
        }

        // update/delete/upsert par id unique : NON filtrables sur un where unique.
        // Sûrs UNIQUEMENT si précédés d'une lecture scopée (convention du code, vérifiée par les tests).
        // On laisse passer tel quel.
        return query(args);
      },
    },
  },
});
