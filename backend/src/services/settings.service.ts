import { prisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import { SETTING_MAX_DISCOUNT, SETTING_MANAGER_PIN, Role } from '../constants';

export async function getSetting(key: string): Promise<string | null> {
  const s = await prisma.appSetting.findUnique({ where: { settingKey: key } });
  return s?.settingValue ?? null;
}

export async function setSetting(key: string, value: string, description?: string) {
  return prisma.appSetting.upsert({
    where: { settingKey: key },
    update: { settingValue: value },
    create: { settingKey: key, settingValue: value, description },
  });
}

// Plafond de remise manuelle (en %) ; 100 = pas de plafond.
export async function getMaxDiscountPercent(): Promise<number> {
  const v = await getSetting(SETTING_MAX_DISCOUNT);
  const n = v != null ? Number(v) : 100;
  return Number.isFinite(n) ? n : 100;
}

// PIN manager : renvoie le code configuré (non vide) ou null si aucun.
export async function getManagerPin(): Promise<string | null> {
  const v = await getSetting(SETTING_MANAGER_PIN);
  return v && v.trim() ? v.trim() : null;
}

// Un PIN est-il configuré (protection active) ?
export async function isManagerPinSet(): Promise<boolean> {
  return (await getManagerPin()) !== null;
}

// Définit (ou efface si vide) le PIN manager.
export async function setManagerPin(pin: string): Promise<void> {
  await setSetting(SETTING_MANAGER_PIN, pin.trim(), 'Code manager (annulation / remboursement)');
}

// Autorisation manager pour une action sensible (annulation / remboursement).
// - Administrateur : exempt (il EST le manager).
// - Caissier : doit fournir le PIN si un PIN est configuré (sinon libre, opt-in).
// Renvoie true si un PIN a effectivement été validé (pour tracer l'audit).
export async function verifyManagerApproval(role?: Role, pin?: string): Promise<boolean> {
  if (role === 'administrateur') return false;
  const configured = await getManagerPin();
  if (!configured) return false;
  if (!pin || pin.trim() !== configured) {
    throw new AppError(403, 'PIN_001');
  }
  return true;
}
