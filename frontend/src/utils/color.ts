/**
 * Utilitaires de manipulation de couleurs pour le théming dynamique.
 * Les fonctions renvoient des chaînes de canaux RGB (« R G B » sans virgules)
 * compatibles avec la syntaxe `rgb(var(--gold-xxx) / alpha)` de Tailwind.
 */

const HEX_RE = /^#([0-9a-fA-F]{6})$/;
/** Canaux fallback (gold #D4AF37 = 212 175 55) utilisés si l'entrée est invalide. */
const FALLBACK_CHANNELS = '212 175 55';

/**
 * Convertit un hex #RRGGBB en canaux RGB séparés par des espaces.
 * Exemple : "#D4AF37" → "212 175 55"
 * Retourne le fallback gold si l'entrée est invalide.
 */
export function hexToRgbChannels(hex: string): string {
  if (!HEX_RE.test(hex)) return FALLBACK_CHANNELS;
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/**
 * Éclaircit ou assombrit un hex d'un facteur donné puis renvoie les canaux RGB.
 * factor > 0 → plus clair (ex : +0.18 = +18 % vers blanc).
 * factor < 0 → plus sombre (ex : -0.12 = -12 % vers noir).
 * Renvoie une chaîne "R G B" (canaux pour variable CSS, pas un hex).
 * Retourne le fallback gold si l'entrée est invalide.
 */
export function shade(hex: string, factor: number): string {
  if (!HEX_RE.test(hex)) return FALLBACK_CHANNELS;
  const h = hex.replace('#', '');
  const adj = (c: number): number => {
    const v = factor >= 0 ? c + (255 - c) * factor : c * (1 + factor);
    return Math.max(0, Math.min(255, Math.round(v)));
  };
  const r = adj(parseInt(h.slice(0, 2), 16));
  const g = adj(parseInt(h.slice(2, 4), 16));
  const b = adj(parseInt(h.slice(4, 6), 16));
  return `${r} ${g} ${b}`;
}

/**
 * Calcule la luminance relative (0–1) d'un hex pour détecter les couleurs sombres.
 * Utile pour avertir d'un contraste insuffisant.
 */
export function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const toLinear = (c: number): number => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = toLinear(parseInt(h.slice(0, 2), 16));
  const g = toLinear(parseInt(h.slice(2, 4), 16));
  const b = toLinear(parseInt(h.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
