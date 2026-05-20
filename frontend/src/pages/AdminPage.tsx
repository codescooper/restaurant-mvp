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
} from 'lucide-react';
import { stockApi, dishApi, userApi } from '../services/endpoints';
import { getApiError } from '../services/api';
import { StockItem, Dish, User, Role } from '../types';
import { formatFCFA, formatDateTime } from '../utils/format';

type Tab = 'stock' | 'menu' | 'users';
const UNITS = ['kg', 'litre', 'unité', 'gramme', 'ml'];
const CATEGORIES = ['Entrée', 'Plat', 'Dessert', 'Boisson'];
const ROLE_BADGE: Record<string, string> = {
  administrateur: 'bg-purple-100 text-purple-700',
  caissier: 'bg-blue-100 text-blue-700',
  cuisinier: 'bg-orange-100 text-orange-700',
};

interface Ingredient { stockItemId: number; quantityNeeded: number }

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('stock');
  const [search, setSearch] = useState('');
  const [stock, setStock] = useState<StockItem[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [expandedDish, setExpandedDish] = useState<number | null>(null);
  const [error, setError] = useState('');

  const [modal, setModal] = useState<Tab | null>(null);
  const [editing, setEditing] = useState<StockItem | Dish | User | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);

  const loadStock = () => stockApi.list().then(setStock).catch((e) => setError(getApiError(e)));
  const loadDishes = () => dishApi.list().then(setDishes).catch((e) => setError(getApiError(e)));
  const loadUsers = () => userApi.list().then(setUsers).catch((e) => setError(getApiError(e)));

  useEffect(() => {
    loadStock();
    loadDishes();
    loadUsers();
  }, []);

  const lowStock = stock.filter((s) => s.quantity <= s.alertThreshold);

  const openCreate = (t: Tab) => {
    setModal(t);
    setEditing(null);
    setIngredients([]);
    if (t === 'stock') setForm({ name: '', quantity: 0, unit: 'kg', alertThreshold: 10 });
    if (t === 'menu') setForm({ name: '', description: '', price: 0, category: 'Plat', isActive: true });
    if (t === 'users') setForm({ username: '', password: '', role: 'caissier' });
  };

  const openEdit = (t: Tab, item: StockItem | Dish | User) => {
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

  const remove = async (t: Tab, id: number) => {
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
  ];

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="bg-blue-600 text-white rounded-xl p-4 mb-4 shadow">
        <h1 className="text-xl font-bold">Administration</h1>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-r-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-red-700 font-semibold">
            <AlertTriangle className="w-5 h-5" />
            {lowStock.length} article(s) en dessous du seuil d'alerte
          </div>
          <div className="text-sm text-red-600 mt-1">
            {lowStock.map((i) => `${i.name} (${i.quantity} ${i.unit})`).join(', ')}
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4 sticky top-16 bg-gray-50 py-2 z-10">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
              tab === t.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'
            }`}
          >
            <t.icon className="w-5 h-5" />
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}

      <div className="flex justify-between items-center mb-4 gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg"
          />
        </div>
        <button
          onClick={() => openCreate(tab)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
        >
          <Plus className="w-5 h-5" /> Ajouter
        </button>
      </div>

      {/* STOCK */}
      {tab === 'stock' && (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
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
                  <tr key={item.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-medium">{item.name}</td>
                    <td className={`p-3 font-bold ${low ? 'text-red-600' : 'text-green-600'}`}>{item.quantity}</td>
                    <td className="p-3">{item.unit}</td>
                    <td className="p-3">{item.alertThreshold}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${low ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {low ? 'Stock faible' : 'OK'}
                      </span>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button onClick={() => addStockQuantity(item)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Ajouter du stock">
                        <Plus className="w-4 h-4" />
                      </button>
                      <button onClick={() => openEdit('stock', item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => remove('stock', item.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded">
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
            <div key={dish.id} className="bg-white rounded-xl shadow p-4">
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-bold">{dish.name}</h3>
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{dish.category}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${dish.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                      {dish.isActive ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm mt-1">{dish.description}</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{formatFCFA(dish.price)}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => toggleDish(dish.id)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded">
                    {dish.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button onClick={() => openEdit('menu', dish)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove('menu', dish.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <button
                onClick={() => setExpandedDish(expandedDish === dish.id ? null : dish.id)}
                className="flex items-center gap-1 text-sm text-gray-500 mt-2"
              >
                {expandedDish === dish.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Ingrédients ({dish.ingredients.length})
              </button>
              {expandedDish === dish.id && (
                <div className="bg-gray-50 rounded-lg p-3 mt-2 text-sm space-y-1">
                  {dish.ingredients.length === 0 && <p className="text-gray-400">Aucun ingrédient</p>}
                  {dish.ingredients.map((ing) => (
                    <div key={ing.id} className="flex justify-between">
                      <span>{ing.stockItem.name}</span>
                      <span className="text-gray-500">
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
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
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
                <tr key={u.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium">{u.username}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${ROLE_BADGE[u.role] ?? 'bg-gray-100'}`}>{u.role}</span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                      {u.isActive ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="p-3 text-gray-500">{u.lastLogin ? formatDateTime(u.lastLogin) : '—'}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <button onClick={() => toggleUser(u.id)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded">
                      {u.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openEdit('users', u)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove('users', u.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">
                {editing ? 'Modifier' : 'Ajouter'} {modal === 'stock' ? 'un article' : modal === 'menu' ? 'un plat' : 'un utilisateur'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
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
                    <span className="text-sm font-medium text-gray-700">Recette (ingrédients)</span>
                    <button
                      type="button"
                      onClick={() => setIngredients([...ingredients, { stockItemId: stock[0]?.id ?? 0, quantityNeeded: 0 }])}
                      className="text-xs text-blue-600"
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
                {!editing && <p className="text-xs text-gray-500">Le mot de passe sera hashé.</p>}
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={closeModal} className="flex-1 py-2.5 border rounded-lg font-medium">
                Annuler
              </button>
              <button onClick={submitModal} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium">
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
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
