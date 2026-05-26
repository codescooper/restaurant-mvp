export type Shortcut = 'today' | 'last7' | 'thisMonth' | 'lastMonth';

function fmt(d: Date): string {
  // ISO YYYY-MM-DD en UTC pour cohérence avec les <input type="date">.
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function shortcutToRange(s: Shortcut, anchor: Date = new Date()): { from: string; to: string } {
  const today = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()));
  if (s === 'today') return { from: fmt(today), to: fmt(today) };
  if (s === 'last7') {
    const from = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
    return { from: fmt(from), to: fmt(today) };
  }
  if (s === 'thisMonth') {
    const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    return { from: fmt(from), to: fmt(today) };
  }
  // lastMonth
  const firstOfThisMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 24 * 60 * 60 * 1000);
  const firstOfPrevMonth = new Date(Date.UTC(lastOfPrevMonth.getUTCFullYear(), lastOfPrevMonth.getUTCMonth(), 1));
  return { from: fmt(firstOfPrevMonth), to: fmt(lastOfPrevMonth) };
}
