import bcrypt from 'bcrypt';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import {
  SETTING_MAX_DISCOUNT,
  SETTING_MANAGER_PIN,
  SETTING_RESTAURANT_NAME,
  DEFAULT_RESTAURANT_NAME,
  Role,
} from '../constants';
import { getTenantIdOrThrow } from '../config/tenant-context';

export async function getSetting(key: string): Promise<string | null> {
  const s = await prisma.appSetting.findFirst({ where: { settingKey: key } });
  return s?.settingValue ?? null;
}

export async function setSetting(key: string, value: string, description?: string) {
  const restaurantId = getTenantIdOrThrow();
  return prisma.appSetting.upsert({
    where: { restaurantId_settingKey: { restaurantId, settingKey: key } },
    update: { settingValue: value },
    create: { settingKey: key, settingValue: value, description },
  });
}

// Nom du restaurant affiché en en-tête des rapports (valeur par défaut si non configuré).
export async function getRestaurantName(): Promise<string> {
  const v = await getSetting(SETTING_RESTAURANT_NAME);
  const name = v?.trim();
  return name ? name : DEFAULT_RESTAURANT_NAME;
}

export async function setRestaurantName(name: string): Promise<string> {
  const value = name.trim();
  await setSetting(SETTING_RESTAURANT_NAME, value, 'Nom du restaurant (en-tête des rapports)');
  return value || DEFAULT_RESTAURANT_NAME;
}

// Plafond de remise manuelle (en %) ; 100 = pas de plafond.
export async function getMaxDiscountPercent(): Promise<number> {
  const v = await getSetting(SETTING_MAX_DISCOUNT);
  const n = v != null ? Number(v) : 100;
  return Number.isFinite(n) ? n : 100;
}

// PIN manager : renvoie le HASH bcrypt configuré (non vide) ou null si aucun. Jamais le code en clair.
export async function getManagerPinHash(): Promise<string | null> {
  const v = await getSetting(SETTING_MANAGER_PIN);
  return v && v.trim() ? v : null;
}

// Un PIN est-il configuré (protection active) ?
export async function isManagerPinSet(): Promise<boolean> {
  return (await getManagerPinHash()) !== null;
}

// Définit (haché bcrypt) ou efface (chaîne vide) le PIN manager. Le code n'est jamais stocké en clair.
export async function setManagerPin(pin: string): Promise<void> {
  const trimmed = pin.trim();
  const value = trimmed ? bcrypt.hashSync(trimmed, 10) : '';
  await setSetting(SETTING_MANAGER_PIN, value, 'Code manager haché (annulation / remboursement)');
}

// Décision pure (testable sans DB) de l'autorisation manager pour une action sensible.
// - Administrateur : exempt (il EST le manager).
// - Caissier : doit fournir le PIN si un PIN est configuré (sinon libre, opt-in).
// `verify` compare le PIN saisi au hash stocké (bcrypt en production).
// Renvoie true si un PIN a effectivement été validé ; lève PIN_001 si requis et incorrect/absent.
export function evaluateManagerApproval(
  role: Role | undefined,
  configuredHash: string | null,
  providedPin: string | undefined,
  verify: (pin: string, hash: string) => boolean
): boolean {
  if (role === 'administrateur' || role === 'propriétaire') return false;
  if (!configuredHash) return false;
  if (!providedPin || !verify(providedPin.trim(), configuredHash)) {
    throw new AppError(403, 'PIN_001');
  }
  return true;
}

// Autorisation manager (annulation / remboursement) : lit le hash configuré puis applique la décision.
export async function verifyManagerApproval(role?: Role, pin?: string): Promise<boolean> {
  return evaluateManagerApproval(role, await getManagerPinHash(), pin, (p, h) => bcrypt.compareSync(p, h));
}
