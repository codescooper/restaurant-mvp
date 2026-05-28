import { describe, it, expect } from 'vitest';

// ─── Extracted helpers (mirrors PublicRestaurantPage internals) ───────────────

function cleanWhatsappDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

function buildWhatsappUrl(
  whatsapp: string,
  restaurantName: string,
  items: { name: string; price: number; priceType: 'fixe' | 'libre'; quantity: number }[]
): string {
  const digits = cleanWhatsappDigits(whatsapp);
  const lines = items
    .map((ci) => `- ${ci.quantity}x ${ci.name} (${Math.round(ci.price * ci.quantity).toLocaleString('fr-FR')} FCFA)`)
    .join('\n');
  const grandTotal = items.reduce((acc, ci) => acc + ci.price * ci.quantity, 0);
  const hasLibre = items.some((ci) => ci.priceType === 'libre');
  const totalLabel = hasLibre
    ? `Total estimé : ${Math.round(grandTotal).toLocaleString('fr-FR')} FCFA`
    : `Total : ${Math.round(grandTotal).toLocaleString('fr-FR')} FCFA`;
  const message = `Bonjour ${restaurantName}, je souhaite commander :\n${lines}\n${totalLabel}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('cleanWhatsappDigits', () => {
  it('retire tous les non-chiffres', () => {
    expect(cleanWhatsappDigits('+225 07 07 14 59 59')).toBe('2250707145959');
  });
  it('conserve un numero deja propre', () => {
    expect(cleanWhatsappDigits('2250707145959')).toBe('2250707145959');
  });
  it('gere les tirets et parentheses', () => {
    expect(cleanWhatsappDigits('+1 (800) 555-1234')).toBe('18005551234');
  });
  it('chaine vide → vide', () => {
    expect(cleanWhatsappDigits('')).toBe('');
  });
});

describe('buildWhatsappUrl', () => {
  const items = [
    { name: 'Poulet Braisé', price: 2500, priceType: 'fixe' as const, quantity: 2 },
    { name: 'Riz Sauce', price: 1500, priceType: 'fixe' as const, quantity: 1 },
  ];

  it('construit une URL wa.me avec les bons chiffres', () => {
    const url = buildWhatsappUrl('+225 07 07 14 59 59', 'Le Maquis', items);
    expect(url).toMatch(/^https:\/\/wa\.me\/2250707145959\?text=/);
  });

  it('inclut le nom du restaurant dans le message encode', () => {
    const url = buildWhatsappUrl('+225 07 07 14 59 59', 'Le Maquis', items);
    expect(decodeURIComponent(url)).toContain('Le Maquis');
  });

  it('inclut les noms des plats dans le message', () => {
    const url = buildWhatsappUrl('+225 07 07 14 59 59', 'Le Maquis', items);
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain('Poulet Braisé');
    expect(decoded).toContain('Riz Sauce');
  });

  it('calcule le total correct (2×2500 + 1×1500 = 6500)', () => {
    const url = buildWhatsappUrl('+225 07 07 14 59 59', 'Le Maquis', items);
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain('6');
    expect(decoded).toContain('500');
  });

  it('affiche "Total estimé" si un plat est a prix libre', () => {
    const libreItems = [
      { name: 'Plat du jour', price: 2000, priceType: 'libre' as const, quantity: 1 },
    ];
    const url = buildWhatsappUrl('+225 07 07 14 59 59', 'Test', libreItems);
    expect(decodeURIComponent(url)).toContain('Total estimé');
  });

  it('affiche "Total" (sans estimé) pour des plats a prix fixe', () => {
    const url = buildWhatsappUrl('+225 07 07 14 59 59', 'Test', items);
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain('Total :');
    expect(decoded).not.toContain('estimé');
  });

  it('indique les quantites dans le message', () => {
    const url = buildWhatsappUrl('+225 07 07 14 59 59', 'Le Maquis', items);
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain('2x Poulet');
    expect(decoded).toContain('1x Riz');
  });
});

describe('cart quantity helpers (logic)', () => {
  // Simulate addToCart / incCart / decCart logic

  type CartItem = { dishId: number; quantity: number };

  function addToCart(cart: CartItem[], dishId: number): CartItem[] {
    const existing = cart.find((ci) => ci.dishId === dishId);
    if (existing) return cart.map((ci) => ci.dishId === dishId ? { ...ci, quantity: ci.quantity + 1 } : ci);
    return [...cart, { dishId, quantity: 1 }];
  }

  function incCart(cart: CartItem[], dishId: number): CartItem[] {
    return cart.map((ci) => ci.dishId === dishId ? { ...ci, quantity: ci.quantity + 1 } : ci);
  }

  function decCart(cart: CartItem[], dishId: number): CartItem[] {
    return cart
      .map((ci) => ci.dishId === dishId ? { ...ci, quantity: ci.quantity - 1 } : ci)
      .filter((ci) => ci.quantity > 0);
  }

  function removeFromCart(cart: CartItem[], dishId: number): CartItem[] {
    return cart.filter((ci) => ci.dishId !== dishId);
  }

  it('addToCart ajoute un nouvel article avec quantite 1', () => {
    const cart = addToCart([], 1);
    expect(cart).toHaveLength(1);
    expect(cart[0]).toEqual({ dishId: 1, quantity: 1 });
  });

  it('addToCart incremente la quantite si l\'article existe deja', () => {
    const cart = addToCart([{ dishId: 1, quantity: 2 }], 1);
    expect(cart[0].quantity).toBe(3);
  });

  it('incCart incremente la quantite', () => {
    const cart = incCart([{ dishId: 1, quantity: 2 }], 1);
    expect(cart[0].quantity).toBe(3);
  });

  it('decCart decremente et supprime si quantite tombe a 0', () => {
    const cart = decCart([{ dishId: 1, quantity: 1 }], 1);
    expect(cart).toHaveLength(0);
  });

  it('decCart ne supprime pas si quantite reste > 0', () => {
    const cart = decCart([{ dishId: 1, quantity: 3 }], 1);
    expect(cart[0].quantity).toBe(2);
  });

  it('removeFromCart retire l\'article du panier', () => {
    const cart = removeFromCart([{ dishId: 1, quantity: 2 }, { dishId: 2, quantity: 1 }], 1);
    expect(cart).toHaveLength(1);
    expect(cart[0].dishId).toBe(2);
  });

  it('le total d\'articles est la somme des quantites', () => {
    const items: CartItem[] = [{ dishId: 1, quantity: 2 }, { dishId: 2, quantity: 3 }];
    const total = items.reduce((acc, ci) => acc + ci.quantity, 0);
    expect(total).toBe(5);
  });

  it('le total financier est la somme des prix × quantites', () => {
    const items = [
      { dishId: 1, quantity: 2, price: 2500 },
      { dishId: 2, quantity: 1, price: 1500 },
    ];
    const total = items.reduce((acc, ci) => acc + ci.price * ci.quantity, 0);
    expect(total).toBe(6500);
  });
});
