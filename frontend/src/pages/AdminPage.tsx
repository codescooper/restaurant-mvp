import { useEffect, useMemo, useState } from 'react';
import {
  Package,
  UtensilsCrossed,
  Users,
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  Banknote,
  ClipboardList,
  RotateCcw,
  Truck,
  ClipboardCheck,
  TriangleAlert,
  Tag,
} from 'lucide-react';
import { stockApi, dishApi, userApi, cashApi, auditApi, orderApi } from '../services/endpoints';
import { getApiError } from '../services/api';
import { StockItem, Dish, User, Role, CashSessionSummary, AuditLogEntry } from '../types';
import { formatFCFA, formatDateTime } from '../utils/format';
import SuppliersTab from './admin/SuppliersTab';
import InventoryTab from './admin/InventoryTab';
import PromotionsTab from './admin/PromotionsTab';

type Tab = 'stock' | 'menu' | 'users' | 'caisse' | 'journal' | 'fournisseurs' | 'inventaire' | 'promotions';
type CrudTab = 'stock' | 'menu' | 'users';

const LOSS_CAUSES: { value: string; label: string }[] = [
  { value: 'casse', label: 'Casse' },
  { value: 'péremption', label: 'Péremption' },
  { value: 'erreur_cuisine', label: 'Erreur cuisine' },
  { value: 'vol', label: 'Vol' },
  { value: 'offert_personnel', label: 'Offert / personnel' },
];

const AUDIT_LABEL: Record<string, string> = {
  ouverture_caisse: 'Ouverture caisse',
  fermeture_caisse: 'Fermeture caisse',
  ouverture_tiroir: 'Ouverture tiroir',
  paiement: 'Paiement',
  remise: 'Remise',
  annulation: 'Annulation',
  remboursement: 'Remboursement',
  correction_commande: 'Correction',
};
const AUDIT_BADGE: Record<string, string> = {
  remboursement: 'bg-rose-500/15 text-rose-300',
  annulation: 'bg-orange-500/15 text-orange-300',
  remise: 'bg-gold-400/15 text-gold-300',
  ouverture_caisse: 'bg-emerald-500/15 text-emerald-300',
  fermeture_caisse: 'bg-purple-500/15 text-purple-300',
  paiement: 'bg-sky-500/15 text-sky-300',
  ouverture_tiroir: 'bg-neutral-800 text-neutral-200',
};
const UNITS = ['kg', 'litre', 'unité', 'gramme', 'ml'];
const CATEGORIES = ['Entrée', 'Plat', 'Dessert', 'Boisson'];
const ROLE_BADGE: Record<string, string> = {
  administrateur: 'bg-purple-500/15 text-purple-300',
  caissier: 'bg-sky-500/15 text-sky-300',
  cuisinier: 'bg-orange-500/15 text-orange-300',
};

interface Ingredient { stockItemId: number; quantityNeeded: number }
interface VariantForm { name: string; price: number; ingredients: Ingredient[] }

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('stock');
  const [search, setSearch] = useState('');
  const [stock, setStock] = useState<StockItem[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [expandedDish, setExpandedDish] = useState<number | null>(null);
  const [error, setError] = useState('');

  const [modal, setModal] = useState<CrudTab | null>(null);
  const [editing, setEditing] = useState<StockItem | Dish | User | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [variants, setVariants] = useState<VariantForm[]>([]);

  const [sessions, setSessions] = useState<CashSessionSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [sessionDetail, setSessionDetail] = useState<CashSessionSummary | null>(null);

  // Perte / gaspillage
  const [lossItem, setLossItem] = useState<StockItem | null>(null);
  const [lossQty, setLossQty] = useState('');
  const [lossCause, setLossCause] = useState('casse');
  const [lossNote, setLossNote] = useState('');

  const loadStock = () => stockApi.list().then(setStock).catch((e) => setError(getApiError(e)));
  const loadDishes = () => dishApi.list().then(setDishes).catch((e) => setError(getApiError(e)));
  const loadUsers = () => userApi.list().then(setUsers).catch((e) => setError(getApiError(e)));
  const loadSessions = () => cashApi.sessions().then(setSessions).catch((e) => setError(getApiError(e)));
  const loadAudit = () => auditApi.list({ limit: 200 }).then(setAuditLogs).catch((e) => setError(getApiError(e)));

  useEffect(() => {
    loadStock();
    loadDishes();
    loadUsers();
  }, []);

  useEffect(() => {
    if (tab === 'caisse') loadSessions();
    if (tab === 'journal') loadAudit();
    // Rafraîchit le stock en revenant sur l'onglet (un achat fait dans Fournisseurs l'a modifié).
    if (tab === 'stock') loadStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const openSessionDetail = async (id: number) => {
    try {
      setSessionDetail(await cashApi.sessionReport(id));
    } catch (e) {
      setError(getApiError(e));
    }
  };

  const submitLoss = async () => {
    if (!lossItem) return;
    const qty = Number(lossQty);
    if (!qty || qty <= 0) return;
    try {
      await stockApi.recordLoss(lossItem.id, qty, lossCause, lossNote || undefined);
      setLossItem(null);
      setLossQty('');
      setLossNote('');
      setLossCause('casse');
      await loadStock();
    } catch (e) {
      setError(getApiError(e));
    }
  };

  const refundOrder = async (orderId: number) => {
    const reason = window.prompt('Raison du remboursement :');
    if (!reason) return;
    try {
      await orderApi.refund(orderId, reason);
      if (sessionDetail) setSessionDetail(await cashApi.sessionReport(sessionDetail.id));
      loadSessions();
    } catch (e) {
      setError(getApiError(e));
    }
  };

  const lowStock = stock.filter((s) => s.quantity <= s.alertThreshold);

  const openCreate = (t: CrudTab) => {
    setModal(t);
    setEditing(null);
    setIngredients([]);
    setVariants([]);
    if (t === 'stock') setForm({ name: '', quantity: 0, unit: 'kg', alertThreshold: 10 });
    if (t === 'menu') setForm({ name: '', description: '', price: 0, category: 'Plat', isActive: true });
    if (t === 'users') setForm({ username: '', password: '', role: 'caissier' });
  };

  const openEdit = (t: CrudTab, item: StockItem | Dish | User) => {
    setModal(t);
    setEditing(item);
    if (t === 'stock') {
      const s = item as StockItem;
      setForm({ name: s.name, quantity: s.quantity, unit: s.unit, alertThreshold: s.alertThreshold });
    }
    if (t === 'menu') {
      const d = item as Dish;
      setForm({ name: d.name, description: d.description ?? '', price: d.price, category: d.category ?? 'Plat', isActive: d.isActive });
      setIngredients(d.ingredients.map((i) => ({ stockItemId: i.stockItemId, quantityNeeded: i.quantityNeeded })));
      setVariants(
        (d.variants ?? []).map((v) => ({
          name: v.name,
          price: v.price,
          ingredients: v.ingredients.map((i) => ({ stockItemId: i.stockItemId, quantityNeeded: i.quantityNeeded })),
        }))
      );
    }
    if (t === 'users') {
      const u = item as User;
      setForm({ username: u.username, password: '', role: u.role });
    }
  };

  const closeModal = () => {
    setModal(null);
    setEditing(null);
    setForm({});
    setIngredients([]);
    setVariants([]);
  };

  const submitModal = async () => {
    setError('');
    try {
      if (modal === 'stock') {
        const payload = {
          name: String(form.name),
          quantity: Number(form.quantity),
          unit: String(form.unit),
          alertThreshold: Number(form.alertThreshold),
        };
        if (editing) await stockApi.update((editing as StockItem).id, payload);
        else await stockApi.create(payload);
        await loadStock();
      } else if (modal === 'menu') {
        const payload = {
          name: String(form.name),
          description: String(form.description),
          price: Number(form.price),
          category: String(form.category),
          isActive: Boolean(form.isActive),
          ingredients: ingredients.filter((i) => i.stockItemId && i.quantityNeeded > 0),
          variants: variants
            .filter((v) => v.name.trim())
            .map((v) => ({
              name: v.name.trim(),
              price: Number(v.price) || 0,
              ingredients: v.ingredients.filter((i) => i.stockItemId && i.quantityNeeded > 0),
            })),
        };
        if (editing) await dishApi.update((editing as Dish).id, payload);
        else await dishApi.create(payload);
        await loadDishes();
      } else if (modal === 'users') {
        if (editing) {
          const payload: { username: string; role: Role; password?: string } = {
            username: String(form.username),
            role: form.role as Role,
          };
          if (form.password) payload.password = String(form.password);
          await userApi.update((editing as User).id, payload);
        } else {
          await userApi.create({ username: String(form.username), password: String(form.password), role: form.role as Role });
        }
        await loadUsers();
      }
      closeModal();
    } catch (e) {
      setError(getApiError(e));
    }
  };

  const addStockQuantity = async (item: StockItem) => {
    const input = window.prompt(`Quantité à ajouter à "${item.name}" (${item.unit}) :`);
    if (!input) return;
    const qty = Number(input);
    if (!qty || qty <= 0) return;
    try {
      await stockApi.addQuantity(item.id, qty);
      await loadStock();
    } catch (e) {
      setError(getApiError(e));
    }
  };

  const remove = async (t: CrudTab, id: number) => {
    if (!window.confirm('Confirmer la suppression ?')) return;
    try {
      if (t === 'stock') { await stockApi.remove(id); await loadStock(); }
      if (t === 'menu') { await dishApi.remove(id); await loadDishes(); }
      if (t === 'users') { await userApi.remove(id); await loadUsers(); }
    } catch (e) {
      setError(getApiError(e));
    }
  };

  const toggleDish = async (id: number) => {
    try { await dishApi.toggle(id); await loadDishes(); } catch (e) { setError(getApiError(e)); }
  };
  const toggleUser = async (id: number) => {
    try { await userApi.toggle(id); await loadUsers(); } catch (e) { setError(getApiError(e)); }
  };

  const s = search.toLowerCase();
  const filteredStock = useMemo(() => stock.filter((i) => i.name.toLowerCase().includes(s)), [stock, s]);
  const filteredDishes = useMemo(
    () => dishes.filter((d) => d.name.toLowerCase().includes(s) || (d.category ?? '').toLowerCase().includes(s)),
    [dishes, s]
  );
  const filteredUsers = useMemo(
    () => users.filter((u) => u.username.toLowerCase().includes(s) || u.role.toLowerCase().includes(s)),
    [users, s]
  );

  const TABS: { id: Tab; label: string; icon: typeof Package }[] = [
    { id: 'stock', label: 'Stock', icon: Package },
    { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
    { id: 'users', label: 'Utilisateurs', icon: Users },
    { id: 'fournisseurs', label: 'Fournisseurs', icon: Truck },
    { id: 'inventaire', label: 'Inventaire', icon: ClipboardCheck },
    { id: 'promotions', label: 'Promotions', icon: Tag },
    { id: 'caisse', label: 'Caisse', icon: Banknote },
    { id: 'journal', label: "Journal d'actions", icon: ClipboardList },
  ];

  const isCrudTab = tab === 'stock' || tab === 'menu' || tab === 'users';

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-black text-neutral-200 max-w-7xl mx-auto p-4">
      <div className="bg-gradient-to-r from-neutral-950 to-neutral-900/40 border border-neutral-800 ring-1 ring-white/5 rounded-2xl p-4 mb-4">
        <h1 className="text-xl font-bold text-neutral-100">Administration</h1>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-rose-500/10 border-l-4 border-rose-500 rounded-r-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-rose-300 font-semibold">
            <AlertTriangle className="w-5 h-5" />
            {lowStock.length} article(s) en dessous du seuil d'alerte
          </div>
          <div className="text-sm text-rose-400 mt-1">
            {lowStock.map((i) => `${i.name} (${i.quantity} ${i.unit})`).join(', ')}
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4 sticky top-16 bg-neutral-900 py-2 z-10">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
              tab === t.id ? 'bg-gold-400 text-black' : 'bg-neutral-950 text-neutral-200'
            }`}
          >
            <t.icon className="w-5 h-5" />
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 mb-4 text-sm">{error}</div>}

      {isCrudTab && (
        <div className="flex justify-between items-center mb-4 gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400"
            />
          </div>
          <button
            onClick={() => openCreate(tab as CrudTab)}
            className="flex items-center gap-2 bg-gold-400 hover:bg-gold-300 text-black px-4 py-2 rounded-lg font-medium"
          >
            <Plus className="w-5 h-5" /> Ajouter
          </button>
        </div>
      )}

      {/* STOCK */}
      {tab === 'stock' && (
        <div className="bg-neutral-950 rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900 text-neutral-300">
              <tr>
                <th className="text-left p-3">Article</th>
                <th className="text-left p-3">Quantité</th>
                <th className="text-left p-3">Unité</th>
                <th className="text-left p-3">Seuil</th>
                <th className="text-left p-3">Statut</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStock.map((item) => {
                const low = item.quantity <= item.alertThreshold;
                return (
                  <tr key={item.id} className="border-t hover:bg-neutral-900">
                    <td className="p-3 font-medium">{item.name}</td>
                    <td className={`p-3 font-bold ${low ? 'text-rose-400' : 'text-emerald-400'}`}>{item.quantity}</td>
                    <td className="p-3">{item.unit}</td>
                    <td className="p-3">{item.alertThreshold}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${low ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                        {low ? 'Stock faible' : 'OK'}
                      </span>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button onClick={() => addStockQuantity(item)} className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded" title="Ajouter du stock">
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setLossItem(item); setLossQty(''); setLossCause('casse'); setLossNote(''); setError(''); }}
                        className="p-1.5 text-orange-400 hover:bg-orange-500/10 rounded"
                        title="Déclarer une perte"
                      >
                        <TriangleAlert className="w-4 h-4" />
                      </button>
                      <button onClick={() => openEdit('stock', item)} className="p-1.5 text-gold-400 hover:bg-neutral-800 rounded">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => remove('stock', item.id)} className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MENU */}
      {tab === 'menu' && (
        <div className="space-y-3">
          {filteredDishes.map((dish) => (
            <div key={dish.id} className="bg-neutral-950 rounded-xl shadow p-4">
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-bold">{dish.name}</h3>
                    <span className="text-xs bg-neutral-800 px-2 py-0.5 rounded-full">{dish.category}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${dish.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-neutral-800 text-neutral-300'}`}>
                      {dish.isActive ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                  <p className="text-neutral-400 text-sm mt-1">{dish.description}</p>
                  <p className="text-2xl font-bold text-gold-400 mt-1">{formatFCFA(dish.price)}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => toggleDish(dish.id)} className="p-1.5 text-neutral-300 hover:bg-neutral-800 rounded">
                    {dish.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button onClick={() => openEdit('menu', dish)} className="p-1.5 text-gold-400 hover:bg-neutral-800 rounded">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove('menu', dish.id)} className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <button
                onClick={() => setExpandedDish(expandedDish === dish.id ? null : dish.id)}
                className="flex items-center gap-1 text-sm text-neutral-400 mt-2"
              >
                {expandedDish === dish.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Ingrédients ({dish.ingredients.length})
              </button>
              {expandedDish === dish.id && (
                <div className="bg-neutral-900 rounded-lg p-3 mt-2 text-sm space-y-1">
                  {dish.ingredients.length === 0 && <p className="text-neutral-500">Aucun ingrédient</p>}
                  {dish.ingredients.map((ing) => (
                    <div key={ing.id} className="flex justify-between">
                      <span>{ing.stockItem.name}</span>
                      <span className="text-neutral-400">
                        {ing.quantityNeeded} {ing.stockItem.unit}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* USERS */}
      {tab === 'users' && (
        <div className="bg-neutral-950 rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900 text-neutral-300">
              <tr>
                <th className="text-left p-3">Utilisateur</th>
                <th className="text-left p-3">Rôle</th>
                <th className="text-left p-3">Statut</th>
                <th className="text-left p-3">Dernière connexion</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} className="border-t hover:bg-neutral-900">
                  <td className="p-3 font-medium">{u.username}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${ROLE_BADGE[u.role] ?? 'bg-neutral-800'}`}>{u.role}</span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${u.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-neutral-800 text-neutral-300'}`}>
                      {u.isActive ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="p-3 text-neutral-400">{u.lastLogin ? formatDateTime(u.lastLogin) : '—'}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <button onClick={() => toggleUser(u.id)} className="p-1.5 text-neutral-300 hover:bg-neutral-800 rounded">
                      {u.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openEdit('users', u)} className="p-1.5 text-gold-400 hover:bg-neutral-800 rounded">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove('users', u.id)} className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CAISSE : historique des sessions + écarts */}
      {tab === 'caisse' && (
        <div className="bg-neutral-950 rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900 text-neutral-300">
              <tr>
                <th className="text-left p-3">Caissier</th>
                <th className="text-left p-3">Ouverture</th>
                <th className="text-left p-3">Fermeture</th>
                <th className="text-right p-3">Fond</th>
                <th className="text-right p-3">Théorique</th>
                <th className="text-right p-3">Compté</th>
                <th className="text-right p-3">Écart</th>
                <th className="text-left p-3">Statut</th>
                <th className="text-right p-3"></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-t hover:bg-neutral-900">
                  <td className="p-3 font-medium">{s.cashier?.username ?? `#${s.cashierId}`}</td>
                  <td className="p-3 text-neutral-400">{formatDateTime(s.openedAt)}</td>
                  <td className="p-3 text-neutral-400">{s.closedAt ? formatDateTime(s.closedAt) : '—'}</td>
                  <td className="p-3 text-right">{formatFCFA(s.openingFloat)}</td>
                  <td className="p-3 text-right">{s.expectedCash != null ? formatFCFA(s.expectedCash) : '—'}</td>
                  <td className="p-3 text-right">{s.countedCash != null ? formatFCFA(s.countedCash) : '—'}</td>
                  <td
                    className={`p-3 text-right font-semibold ${
                      s.discrepancy == null ? 'text-neutral-500' : s.discrepancy === 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {s.discrepancy != null ? `${s.discrepancy > 0 ? '+' : ''}${formatFCFA(s.discrepancy)}` : '—'}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        s.status === 'ouverte' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-neutral-800 text-neutral-300'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => openSessionDetail(s.id)} className="text-gold-400 hover:underline text-xs">
                      Détails
                    </button>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-neutral-500">
                    Aucune session de caisse enregistrée
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* JOURNAL D'ACTIONS */}
      {tab === 'journal' && (
        <div className="bg-neutral-950 rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900 text-neutral-300">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Action</th>
                <th className="text-left p-3">Utilisateur</th>
                <th className="text-left p-3">Cible</th>
                <th className="text-left p-3">Détails</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id} className="border-t hover:bg-neutral-900 align-top">
                  <td className="p-3 text-neutral-400 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${AUDIT_BADGE[log.action] ?? 'bg-neutral-800 text-neutral-200'}`}>
                      {AUDIT_LABEL[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="p-3">{log.user?.username ?? '—'}</td>
                  <td className="p-3 text-neutral-400">
                    {log.entityType}
                    {log.entityId ? ` #${log.entityId}` : ''}
                  </td>
                  <td className="p-3 text-neutral-400 text-xs">{formatAuditDetails(log.details)}</td>
                </tr>
              ))}
              {auditLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-neutral-500">
                    Aucune action enregistrée
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* FOURNISSEURS */}
      {tab === 'fournisseurs' && <SuppliersTab />}

      {/* INVENTAIRE */}
      {tab === 'inventaire' && <InventoryTab />}

      {/* PROMOTIONS */}
      {tab === 'promotions' && <PromotionsTab />}

      {/* MODAL PERTE */}
      {lossItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-950 border border-neutral-800 ring-1 ring-white/10 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2 text-neutral-100">
                <TriangleAlert className="w-5 h-5 text-orange-400" /> Déclarer une perte
              </h3>
              <button onClick={() => setLossItem(null)} className="text-neutral-500 hover:text-neutral-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-neutral-400 mb-3">
              {lossItem.name} — stock actuel : <strong className="text-neutral-200">{lossItem.quantity} {lossItem.unit}</strong>
            </p>
            <label className="block text-sm text-neutral-400 mb-1">Quantité perdue ({lossItem.unit})</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={lossQty}
              onChange={(e) => setLossQty(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400 mb-3"
              placeholder="0"
              autoFocus
            />
            <label className="block text-sm text-neutral-400 mb-1">Cause</label>
            <select
              value={lossCause}
              onChange={(e) => setLossCause(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400 mb-3"
            >
              {LOSS_CAUSES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <input
              value={lossNote}
              onChange={(e) => setLossNote(e.target.value)}
              placeholder="Note (optionnel)"
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400 mb-4"
            />
            <button
              onClick={submitLoss}
              className="w-full bg-orange-500 hover:bg-orange-400 text-black font-bold py-2.5 rounded-xl transition"
            >
              Enregistrer la perte
            </button>
          </div>
        </div>
      )}

      {/* DETAIL SESSION DE CAISSE */}
      {sessionDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-950 rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-400" /> Session #{sessionDetail.id}
              </h3>
              <button onClick={() => setSessionDetail(null)} className="text-neutral-500 hover:text-neutral-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm mb-4">
              <Info label="Caissier" value={sessionDetail.cashier?.username ?? '—'} />
              <Info label="Statut" value={sessionDetail.status} />
              <Info label="Ouverte" value={formatDateTime(sessionDetail.openedAt)} />
              <Info label="Fermée" value={sessionDetail.closedAt ? formatDateTime(sessionDetail.closedAt) : '—'} />
              <Info label="Fond de caisse" value={formatFCFA(sessionDetail.openingFloat)} />
              <Info label="Total théorique" value={formatFCFA(sessionDetail.expectedCash ?? 0)} />
              <Info label="Réel compté" value={sessionDetail.countedCash != null ? formatFCFA(sessionDetail.countedCash) : '—'} />
              <Info
                label="Écart"
                value={sessionDetail.discrepancy != null ? `${sessionDetail.discrepancy > 0 ? '+' : ''}${formatFCFA(sessionDetail.discrepancy)}` : '—'}
              />
            </div>
            {sessionDetail.discrepancyReason && (
              <div className="bg-gold-400/10 border border-gold-400/30 rounded-lg p-2 text-sm mb-4">
                <span className="font-medium text-gold-300">Justification écart : </span>
                {sessionDetail.discrepancyReason}
              </div>
            )}

            {sessionDetail.salesByMethod && sessionDetail.salesByMethod.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-neutral-200 mb-1">Ventes par moyen de paiement</h4>
                <div className="space-y-1 text-sm">
                  {sessionDetail.salesByMethod.map((m) => (
                    <div key={m.method} className="flex justify-between">
                      <span className="capitalize text-neutral-300">
                        {m.method} ({m.count})
                      </span>
                      <span>{formatFCFA(m.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <h4 className="text-sm font-semibold text-neutral-200 mb-1">Encaissements ({sessionDetail.orders?.length ?? 0})</h4>
            <div className="space-y-1">
              {(sessionDetail.orders ?? []).map((o) => (
                <div
                  key={o.id}
                  className="flex items-center gap-2 bg-neutral-900 rounded-lg p-2 text-sm"
                >
                  <span className="font-medium">{o.orderNumber}</span>
                  <span className="text-neutral-400 capitalize">{o.paymentMethod ?? ''}</span>
                  <span className="ml-auto">{formatFCFA(o.finalTotal)}</span>
                  {o.isRefunded ? (
                    <span className="text-xs bg-rose-500/15 text-rose-300 px-2 py-0.5 rounded-full">Remboursé</span>
                  ) : (
                    <button
                      onClick={() => refundOrder(o.id)}
                      className="flex items-center gap-1 text-xs text-rose-400 hover:bg-rose-500/10 px-2 py-1 rounded"
                      title="Rembourser"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Rembourser
                    </button>
                  )}
                </div>
              ))}
              {(sessionDetail.orders ?? []).length === 0 && (
                <p className="text-neutral-500 text-sm">Aucun encaissement</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-950 rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">
                {editing ? 'Modifier' : 'Ajouter'} {modal === 'stock' ? 'un article' : modal === 'menu' ? 'un plat' : 'un utilisateur'}
              </h3>
              <button onClick={closeModal} className="text-neutral-500 hover:text-neutral-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modal === 'stock' && (
              <div className="space-y-3">
                <Field label="Nom de l'article">
                  <input className="input" value={String(form.name ?? '')} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field>
                <Field label="Quantité">
                  <input type="number" className="input" value={Number(form.quantity ?? 0)} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                </Field>
                <Field label="Unité">
                  <select className="input" value={String(form.unit ?? 'kg')} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </Field>
                <Field label="Seuil d'alerte">
                  <input type="number" className="input" value={Number(form.alertThreshold ?? 0)} onChange={(e) => setForm({ ...form, alertThreshold: e.target.value })} />
                </Field>
              </div>
            )}

            {modal === 'menu' && (
              <div className="space-y-3">
                <Field label="Nom du plat">
                  <input className="input" value={String(form.name ?? '')} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field>
                <Field label="Description">
                  <textarea className="input" value={String(form.description ?? '')} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </Field>
                <Field label="Prix (FCFA)">
                  <input type="number" className="input" value={Number(form.price ?? 0)} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </Field>
                <Field label="Catégorie">
                  <select className="input" value={String(form.category ?? 'Plat')} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(form.isActive)} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                  Actif
                </label>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-neutral-200">Recette (ingrédients)</span>
                    <button
                      type="button"
                      onClick={() => setIngredients([...ingredients, { stockItemId: stock[0]?.id ?? 0, quantityNeeded: 0 }])}
                      className="text-xs text-gold-400"
                    >
                      + Ajouter
                    </button>
                  </div>
                  <div className="space-y-2">
                    {ingredients.map((ing, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <select
                          className="input flex-1"
                          value={ing.stockItemId}
                          onChange={(e) => {
                            const next = [...ingredients];
                            next[idx] = { ...ing, stockItemId: Number(e.target.value) };
                            setIngredients(next);
                          }}
                        >
                          {stock.map((st) => <option key={st.id} value={st.id}>{st.name} ({st.unit})</option>)}
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          className="input w-24"
                          value={ing.quantityNeeded}
                          onChange={(e) => {
                            const next = [...ingredients];
                            next[idx] = { ...ing, quantityNeeded: Number(e.target.value) };
                            setIngredients(next);
                          }}
                        />
                        <button type="button" onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))} className="text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Déclinaisons / variantes (optionnel) */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-neutral-200">Déclinaisons (optionnel)</span>
                    <button
                      type="button"
                      onClick={() => setVariants([...variants, { name: '', price: Number(form.price) || 0, ingredients: [] }])}
                      className="text-xs text-gold-400"
                    >
                      + Variante
                    </button>
                  </div>
                  <p className="text-xs text-neutral-500 mb-2">
                    Ex. Petit / Grand. Si tu ajoutes des déclinaisons, le client choisit la variante à la caisse ;
                    chacune a son prix et sa recette.
                  </p>
                  <div className="space-y-3">
                    {variants.map((v, vi) => (
                      <div key={vi} className="border border-neutral-800 rounded-lg p-2 bg-neutral-900/50">
                        <div className="flex gap-2 items-center mb-2">
                          <input
                            className="input flex-1"
                            placeholder="Nom (ex. Grand)"
                            value={v.name}
                            onChange={(e) => {
                              const n = [...variants];
                              n[vi] = { ...v, name: e.target.value };
                              setVariants(n);
                            }}
                          />
                          <input
                            type="number"
                            className="input w-28"
                            placeholder="Prix"
                            value={v.price}
                            onChange={(e) => {
                              const n = [...variants];
                              n[vi] = { ...v, price: Number(e.target.value) };
                              setVariants(n);
                            }}
                          />
                          <button type="button" onClick={() => setVariants(variants.filter((_, i) => i !== vi))} className="text-rose-400">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-neutral-400">Recette de cette variante</span>
                          <button
                            type="button"
                            onClick={() => {
                              const n = [...variants];
                              n[vi] = { ...v, ingredients: [...v.ingredients, { stockItemId: stock[0]?.id ?? 0, quantityNeeded: 0 }] };
                              setVariants(n);
                            }}
                            className="text-xs text-gold-400"
                          >
                            + Ingrédient
                          </button>
                        </div>
                        <div className="space-y-2">
                          {v.ingredients.map((ing, ii) => (
                            <div key={ii} className="flex gap-2 items-center">
                              <select
                                className="input flex-1"
                                value={ing.stockItemId}
                                onChange={(e) => {
                                  const n = [...variants];
                                  const ings = [...v.ingredients];
                                  ings[ii] = { ...ing, stockItemId: Number(e.target.value) };
                                  n[vi] = { ...v, ingredients: ings };
                                  setVariants(n);
                                }}
                              >
                                {stock.map((st) => (
                                  <option key={st.id} value={st.id}>{st.name} ({st.unit})</option>
                                ))}
                              </select>
                              <input
                                type="number"
                                step="0.01"
                                className="input w-24"
                                value={ing.quantityNeeded}
                                onChange={(e) => {
                                  const n = [...variants];
                                  const ings = [...v.ingredients];
                                  ings[ii] = { ...ing, quantityNeeded: Number(e.target.value) };
                                  n[vi] = { ...v, ingredients: ings };
                                  setVariants(n);
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const n = [...variants];
                                  n[vi] = { ...v, ingredients: v.ingredients.filter((_, i) => i !== ii) };
                                  setVariants(n);
                                }}
                                className="text-rose-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          {v.ingredients.length === 0 && (
                            <p className="text-xs text-neutral-600">Aucun ingrédient pour cette variante</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {variants.length === 0 && (
                      <p className="text-xs text-neutral-600">Aucune déclinaison — le plat utilise son prix unique.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {modal === 'users' && (
              <div className="space-y-3">
                <Field label="Nom d'utilisateur">
                  <input className="input" value={String(form.username ?? '')} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                </Field>
                {!editing && (
                  <Field label="Mot de passe">
                    <input type="password" className="input" value={String(form.password ?? '')} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  </Field>
                )}
                {editing && (
                  <Field label="Nouveau mot de passe (optionnel)">
                    <input type="password" className="input" value={String(form.password ?? '')} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  </Field>
                )}
                <Field label="Rôle">
                  <select className="input" value={String(form.role ?? 'caissier')} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    <option value="administrateur">Administrateur</option>
                    <option value="caissier">Caissier</option>
                    <option value="cuisinier">Cuisinier</option>
                  </select>
                </Field>
                {!editing && <p className="text-xs text-neutral-400">Le mot de passe sera hashé.</p>}
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={closeModal} className="flex-1 py-2.5 border rounded-lg font-medium">
                Annuler
              </button>
              <button onClick={submitModal} className="flex-1 py-2.5 bg-gold-400 text-black rounded-lg font-medium">
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-200 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-neutral-400">{label}</div>
      <div className="font-medium text-neutral-100 capitalize">{value}</div>
    </div>
  );
}

// Résumé lisible du champ JSON details d'une entrée d'audit.
function formatAuditDetails(details?: Record<string, unknown> | null): string {
  if (!details) return '—';
  const parts: string[] = [];
  if (details.orderNumber) parts.push(String(details.orderNumber));
  if (details.tableName) parts.push(`Table ${details.tableName}`);
  if (details.amount != null) parts.push(`${details.amount} FCFA`);
  if (details.method) parts.push(String(details.method));
  if (details.openingFloat != null) parts.push(`fond ${details.openingFloat} FCFA`);
  if (details.expectedCash != null) parts.push(`théorique ${details.expectedCash}`);
  if (details.countedCash != null) parts.push(`compté ${details.countedCash}`);
  if (details.discrepancy != null) parts.push(`écart ${details.discrepancy}`);
  if (details.discountAmount) parts.push(`-${details.discountAmount} FCFA`);
  if (details.discountPercent) parts.push(`-${details.discountPercent}%`);
  if (details.reason) parts.push(`« ${details.reason} »`);
  return parts.length ? parts.join(' · ') : '—';
}
