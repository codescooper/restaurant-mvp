import { AsyncLocalStorage } from 'node:async_hooks';

interface TenantStore {
  // restaurantId actif, ou null pour un appel volontairement non-scopé (super-admin/auth).
  restaurantId: number | null;
  unscoped: boolean;
}

const als = new AsyncLocalStorage<TenantStore>();

// Ouvre un contexte scopé sur un restaurant pour toute la durée de `fn`.
export function runWithTenant<T>(restaurantId: number, fn: () => T): T {
  return als.run({ restaurantId, unscoped: false }, fn);
}

// Ouvre un contexte explicitement NON scopé (auth, super-admin, seed, migration).
export function runUnscoped<T>(fn: () => T): T {
  return als.run({ restaurantId: null, unscoped: true }, fn);
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
