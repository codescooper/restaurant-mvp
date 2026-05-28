import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShoppingCart,
  Plus,
  Minus,
  X,
  MessageCircle,
  ChefHat,
  Utensils,
} from 'lucide-react';
import { publicRestaurantApi, PublicRestaurant, PublicDish } from '../services/endpoints';
import { getApiError } from '../services/api';
import { formatFCFA } from '../utils/format';
import { hexToRgbChannels, shade } from '../utils/color';

// ─── Cart types ──────────────────────────────────────────────────────────────

interface CartItem {
  dish: PublicDish;
  quantity: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cleanWhatsappDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

function buildWhatsappUrl(whatsapp: string, restaurantName: string, items: CartItem[]): string {
  const digits = cleanWhatsappDigits(whatsapp);
  const lines = items
    .map((ci) => {
      const total = ci.dish.price * ci.quantity;
      return `- ${ci.quantity}x ${ci.dish.name} (${formatFCFA(total)})`;
    })
    .join('\n');
  const grandTotal = items.reduce((acc, ci) => acc + ci.dish.price * ci.quantity, 0);
  const hasLibre = items.some((ci) => ci.dish.priceType === 'libre');
  const totalLabel = hasLibre ? `Total estimé : ${formatFCFA(grandTotal)}` : `Total : ${formatFCFA(grandTotal)}`;
  const message = `Bonjour ${restaurantName}, je souhaite commander :\n${lines}\n${totalLabel}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

// ─── Dish price display ───────────────────────────────────────────────────────

function DishPrice({ dish }: { dish: PublicDish }) {
  if (dish.priceType === 'libre') {
    if (dish.priceMin != null) {
      return (
        <span className="text-sm font-semibold text-gold-400">
          à partir de {formatFCFA(dish.priceMin)}
        </span>
      );
    }
    return <span className="text-sm font-semibold text-gold-400">Prix libre</span>;
  }
  return <span className="text-sm font-semibold text-gold-400">{formatFCFA(dish.price)}</span>;
}

// ─── Dish card ───────────────────────────────────────────────────────────────

function DishCard({
  dish,
  quantity,
  onAdd,
  onInc,
  onDec,
}: {
  dish: PublicDish;
  quantity: number;
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
}) {
  const unavailable = !dish.available;

  return (
    <div
      className={`relative flex flex-col rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950 transition-opacity ${
        unavailable ? 'opacity-50' : ''
      }`}
    >
      {/* Image */}
      <div className="relative h-40 bg-neutral-900 flex-shrink-0">
        {dish.imageUrl ? (
          <img
            src={dish.imageUrl}
            alt={dish.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900">
            <Utensils className="w-10 h-10 text-neutral-700" />
          </div>
        )}
        {/* Availability badge */}
        <span
          className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
            dish.available
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}
        >
          {dish.available ? 'Disponible' : 'Épuisé'}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        <h3 className="text-sm font-semibold text-neutral-100 leading-snug line-clamp-2">
          {dish.name}
        </h3>
        {dish.description && (
          <p className="text-xs text-neutral-400 line-clamp-2 flex-1">{dish.description}</p>
        )}
        <div className="flex items-center justify-between mt-auto pt-1">
          <DishPrice dish={dish} />

          {/* Cart controls */}
          {unavailable ? (
            <button
              disabled
              className="text-xs px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-500 cursor-not-allowed"
            >
              Ajouter
            </button>
          ) : quantity === 0 ? (
            <button
              onClick={onAdd}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-gold-400 hover:bg-gold-300 text-black font-semibold transition"
            >
              <Plus className="w-3 h-3" />
              Ajouter
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={onDec}
                className="w-6 h-6 flex items-center justify-center rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-100 transition"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-5 text-center text-sm font-bold text-gold-400">{quantity}</span>
              <button
                onClick={onInc}
                className="w-6 h-6 flex items-center justify-center rounded-md bg-gold-400 hover:bg-gold-300 text-black transition"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Cart panel ───────────────────────────────────────────────────────────────

function CartPanel({
  items,
  restaurantName,
  whatsapp,
  onClose,
  onInc,
  onDec,
  onRemove,
}: {
  items: CartItem[];
  restaurantName: string;
  whatsapp: string | null;
  onClose: () => void;
  onInc: (id: number) => void;
  onDec: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  const total = items.reduce((acc, ci) => acc + ci.dish.price * ci.quantity, 0);
  const hasLibre = items.some((ci) => ci.dish.priceType === 'libre');
  const hasWhatsapp = !!whatsapp && cleanWhatsappDigits(whatsapp).length > 0;

  function handleOrder() {
    if (!hasWhatsapp || !whatsapp) return;
    const url = buildWhatsappUrl(whatsapp, restaurantName, items);
    window.open(url, '_blank');
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed bottom-0 right-0 top-0 w-full max-w-sm bg-neutral-950 border-l border-neutral-800 z-50 flex flex-col shadow-2xl animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-neutral-800">
          <h2 className="text-base font-bold text-neutral-100 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-gold-400" />
            Mon panier
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center mt-8">Votre panier est vide.</p>
          ) : (
            items.map((ci) => (
              <div
                key={ci.dish.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-neutral-900 border border-neutral-800"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-100 truncate">{ci.dish.name}</p>
                  <p className="text-xs text-neutral-400">
                    {ci.dish.priceType === 'libre' ? 'Prix libre' : formatFCFA(ci.dish.price)} × {ci.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => onDec(ci.dish.id)}
                    className="w-6 h-6 flex items-center justify-center rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-100 transition"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-5 text-center text-sm font-bold text-gold-400">{ci.quantity}</span>
                  <button
                    onClick={() => onInc(ci.dish.id)}
                    className="w-6 h-6 flex items-center justify-center rounded-md bg-gold-400 hover:bg-gold-300 text-black transition"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onRemove(ci.dish.id)}
                    className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-neutral-800 text-neutral-500 hover:text-red-400 transition ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-4 py-4 border-t border-neutral-800 space-y-3">
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-neutral-300">{hasLibre ? 'Total estimé' : 'Total'}</span>
              <span className="text-gold-400">{formatFCFA(total)}</span>
            </div>
            {hasLibre && (
              <p className="text-xs text-neutral-500">
                * Les plats à prix libre sont comptés avec leur prix indicatif.
              </p>
            )}

            {hasWhatsapp ? (
              <button
                onClick={handleOrder}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-sm transition"
              >
                <MessageCircle className="w-4 h-4" />
                Commander sur WhatsApp
              </button>
            ) : (
              <div className="w-full py-3 rounded-xl bg-neutral-800 text-neutral-500 text-sm text-center">
                Commande WhatsApp bientôt disponible
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PublicRestaurantPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PublicRestaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  // Fetch restaurant
  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setNotFound(false);
    publicRestaurantApi
      .get(slug)
      .then((res) => {
        setData(res);
        document.title = res.name;
      })
      .catch((err) => {
        const msg = getApiError(err, '');
        // Any error (404 or else) → show not-found screen
        void msg;
        setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  // Cart helpers
  const addToCart = useCallback((dish: PublicDish) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.dish.id === dish.id);
      if (existing) return prev.map((ci) => ci.dish.id === dish.id ? { ...ci, quantity: ci.quantity + 1 } : ci);
      return [...prev, { dish, quantity: 1 }];
    });
  }, []);

  const incCart = useCallback((id: number) => {
    setCart((prev) => prev.map((ci) => ci.dish.id === id ? { ...ci, quantity: ci.quantity + 1 } : ci));
  }, []);

  const decCart = useCallback((id: number) => {
    setCart((prev) => {
      const next = prev.map((ci) => ci.dish.id === id ? { ...ci, quantity: ci.quantity - 1 } : ci);
      return next.filter((ci) => ci.quantity > 0);
    });
  }, []);

  const removeFromCart = useCallback((id: number) => {
    setCart((prev) => prev.filter((ci) => ci.dish.id !== id));
  }, []);

  const totalItems = cart.reduce((acc, ci) => acc + ci.quantity, 0);

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <ChefHat className="w-10 h-10 text-gold-400 animate-pulse" />
          <p className="text-neutral-400 text-sm">Chargement du menu…</p>
        </div>
      </div>
    );
  }

  // ── Not found ──
  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center">
          <ChefHat className="w-8 h-8 text-neutral-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-neutral-100 mb-2">
            Ce restaurant n'est pas disponible
          </h1>
          <p className="text-sm text-neutral-500">
            Ce lien est peut-être invalide ou le restaurant a été suspendu.
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-medium transition"
        >
          Retour à l'accueil
        </Link>
      </div>
    );
  }

  const { branding, menu, name } = data;

  // ── Theme variables ──
  const themeVars = {
    '--gold-400': hexToRgbChannels(branding.primaryColor),
    '--gold-300': shade(branding.primaryColor, 0.18),
    '--gold-500': shade(branding.primaryColor, -0.12),
    '--brand-accent': hexToRgbChannels(branding.accentColor),
  } as React.CSSProperties;

  // ── Background style for root ──
  const rootBg: React.CSSProperties = branding.backgroundUrl
    ? {
        backgroundImage: `url(${branding.backgroundUrl})`,
        backgroundSize: 'cover',
        backgroundAttachment: 'fixed',
        backgroundPosition: 'center',
      }
    : { backgroundColor: branding.backgroundColor };

  return (
    <div style={{ ...themeVars, ...rootBg }} className="min-h-screen relative">
      {/* Dark overlay when background image is set */}
      {branding.backgroundUrl && (
        <div className="fixed inset-0 bg-black/70 pointer-events-none z-0" />
      )}

      <div className="relative z-10">
        {/* ── Hero ── */}
        <header className="relative w-full overflow-hidden">
          {branding.coverUrl ? (
            <div className="relative h-64 sm:h-80 md:h-96">
              <img
                src={branding.coverUrl}
                alt={`${name} cover`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
            </div>
          ) : (
            <div
              className="h-48 sm:h-64 relative"
              style={{
                background: `linear-gradient(135deg, rgb(var(--gold-500) / 0.3), rgb(var(--gold-400) / 0.1)), #0a0a0a`,
              }}
            />
          )}

          {/* Restaurant identity */}
          <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-8 pb-6 flex items-end gap-4">
            {branding.logoUrl && (
              <img
                src={branding.logoUrl}
                alt={`${name} logo`}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-gold-400/50 flex-shrink-0 shadow-lg"
              />
            )}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-lg leading-tight">
                {name}
              </h1>
            </div>
          </div>
        </header>

        {/* ── Menu sections ── */}
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
          {menu.length === 0 && (
            <p className="text-center text-neutral-500 text-sm py-12">
              Le menu n'est pas encore disponible.
            </p>
          )}

          {menu.map(({ category, items }) => (
            <section key={category}>
              {/* Category title */}
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-bold text-neutral-100">{category}</h2>
                <div className="flex-1 h-px bg-gradient-to-r from-gold-400/40 to-transparent" />
                <span className="text-xs text-neutral-500">{items.length} plat{items.length > 1 ? 's' : ''}</span>
              </div>

              {/* Dishes grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((dish) => {
                  const qty = cart.find((ci) => ci.dish.id === dish.id)?.quantity ?? 0;
                  return (
                    <DishCard
                      key={dish.id}
                      dish={dish}
                      quantity={qty}
                      onAdd={() => addToCart(dish)}
                      onInc={() => incCart(dish.id)}
                      onDec={() => decCart(dish.id)}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </main>

        {/* ── Footer ── */}
        <footer className="border-t border-neutral-800/60 mt-12 py-6 text-center">
          <p className="text-xs text-neutral-600">
            Propulsé par{' '}
            <Link to="/" className="text-gold-400/70 hover:text-gold-400 transition">
              Restoflow
            </Link>
          </p>
        </footer>
      </div>

      {/* ── Floating cart button ── */}
      {totalItems > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-3 rounded-2xl bg-gold-400 hover:bg-gold-300 text-black font-bold shadow-2xl transition"
          aria-label="Ouvrir le panier"
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="text-sm">{totalItems}</span>
        </button>
      )}

      {/* ── Cart panel ── */}
      {cartOpen && (
        <CartPanel
          items={cart}
          restaurantName={name}
          whatsapp={branding.whatsapp}
          onClose={() => setCartOpen(false)}
          onInc={incCart}
          onDec={decCart}
          onRemove={removeFromCart}
        />
      )}
    </div>
  );
}
