import { AsyncLocalStorage } from 'node:async_hooks';

interface TenantStore {
  // restaurantId actif, ou null pour un appel volontairement non-scopé (super-admin/auth).
  restaurantId: number | null;
  unscoped: boolean;
}

const als = new AsyncLocalStorage<TenantStore>();

// Ouvre un contexte scopé sur un restaurant pour toute la durée de `fn`.
// Supporte aussi bien les callbacks sync que les callbacks async/renvoyant une Promise.
export function runWithTenant<T>(restaurantId: number, fn: () => T): T extends Promise<infer U> ? Promise<U> : T {
  return als.run({ restaurantId, unscoped: false }, () => {
    const result = fn();
    // Si le résultat est une Promise (PrismaPromise inclus), on la force à s'exécuter
    // DANS le contexte ALS en l'attendant synchroniquement via un wrapper de promise natif.
    if (result !== null && typeof result === 'object' && typeof (result as unknown as PromiseLike<unknown>).then === 'function') {
      return Promise.resolve(result as unknown as PromiseLike<unknown>);
    }
    return result;
  }) as T extends Promise<infer U> ? Promise<U> : T;
}

// Ouvre un contexte explicitement NON scopé (auth, super-admin, seed, migration).
export function runUnscoped<T>(fn: () => T): T extends Promise<infer U> ? Promise<U> : T {
  return als.run({ restaurantId: null, unscoped: true }, () => {
    const result = fn();
    if (result !== null && typeof result === 'object' && typeof (result as unknown as PromiseLike<unknown>).then === 'function') {
      return Promise.resolve(result as unknown as PromiseLike<unknown>);
    }
    return result;
  }) as T extends Promise<infer U> ? Promise<U> : T;
}

// restaurantId courant ou null si hors contexte / non-scopé.
export function getTenantId(): number | null {
  return als.getStore()?.restaurantId ?? null;
}

// true si le contexte courant est explicitement non-scopé.
export function isUnscoped(): boolean {
  return als.getStore()?.unscoped === true;
}

// restaurantId courant, ou lève si aucun contexte n'est ouvert (refus par défaut).
export function getTenantIdOrThrow(): number {
  const store = als.getStore();
  if (!store || store.restaurantId == null) {
    throw new Error('TENANT_CONTEXT_MISSING: opération tenant hors contexte restaurant');
  }
  return store.restaurantId;
}
