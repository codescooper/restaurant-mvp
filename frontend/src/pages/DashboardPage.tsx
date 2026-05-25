import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Clock,
  Download,
  FileText,
  Check,
  Coins,
  Wallet,
  PiggyBank,
  Boxes,
  TriangleAlert,
  Utensils,
} from 'lucide-react';
import { useClock } from '../hooks/useClock';
import { useWebSocket } from '../contexts/WebSocketContext';
import { statsApi, settingsApi } from '../services/endpoints';
import { DashboardData } from '../types';
import { formatFCFA, formatTime } from '../utils/format';

type Period = 'today' | 'week' | 'month';
const PERIOD_LABELS: Record<Period, string> = { today: "Aujourd'hui", week: 'Cette semaine', month: 'Ce mois' };
const CHANNEL_LABELS: Record<string, string> = { sur_place: 'Sur place', emporter: 'À emporter', livraison: 'Livraison' };

// Date -> 'yyyy-MM-dd' en heure locale (pour les <input type="date">).
const toInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function GrowthBadge({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {positive ? '+' : ''}
      {value}%
    </span>
  );
}

export default function DashboardPage() {
  const clock = useClock();
  const { socket } = useWebSocket();
  const [period, setPeriod] = useState<Period>('today');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportError, setExportError] = useState('');

  // Rapport financier : plage de dates au choix + nom du restaurant (paramétrable).
  const [reportStart, setReportStart] = useState(() => toInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [reportEnd, setReportEnd] = useState(() => toInput(new Date()));
  const [restaurantName, setRestaurantName] = useState('');
  const [nameSaved, setNameSaved] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    statsApi
      .dashboard(period)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const onUpdate = () => load();
    socket.on('stats_updated', onUpdate);
    return () => {
      socket.off('stats_updated', onUpdate);
    };
  }, [socket, load]);

  useEffect(() => {
    settingsApi
      .getRestaurantName()
      .then(setRestaurantName)
      .catch(() => {});
  }, []);

  // Raccourcis de période pour le rapport.
  const applyPreset = (kind: '7d' | '30d' | 'month' | 'lastMonth') => {
    const now = new Date();
    if (kind === '7d') {
      const s = new Date(now);
      s.setDate(now.getDate() - 6);
      setReportStart(toInput(s));
      setReportEnd(toInput(now));
    } else if (kind === '30d') {
      const s = new Date(now);
      s.setDate(now.getDate() - 29);
      setReportStart(toInput(s));
      setReportEnd(toInput(now));
    } else if (kind === 'month') {
      setReportStart(toInput(new Date(now.getFullYear(), now.getMonth(), 1)));
      setReportEnd(toInput(now));
    } else {
      setReportStart(toInput(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
      setReportEnd(toInput(new Date(now.getFullYear(), now.getMonth(), 0)));
    }
  };

  const saveName = async () => {
    setExportError('');
    try {
      const saved = await settingsApi.setRestaurantName(restaurantName);
      setRestaurantName(saved);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } catch {
      setExportError("Impossible d'enregistrer le nom (réservé à l'administrateur).");
    }
  };

  // Téléchargement natif du navigateur : lien direct vers le backend (Content-Disposition:
  // attachment). Synchrone, donc le « geste utilisateur » est préservé — Chrome ne bloque plus
  // le téléchargement (problème des téléchargements déclenchés après un await).
  const handleDownloadReport = (kind: 'report' | 'product-report', format: 'pdf' | 'csv') => {
    setExportError('');
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setExportError('Session expirée. Reconnectez-vous puis réessayez.');
      return;
    }
    if (!reportStart || !reportEnd) {
      setExportError('Choisis une date de début et une date de fin.');
      return;
    }
    if (reportStart > reportEnd) {
      setExportError('La date de début doit précéder la date de fin.');
      return;
    }
    const base = import.meta.env.VITE_API_URL as string;
    const url = `${base}/stats/${kind}?start=${reportStart}&end=${reportEnd}&format=${format}&token=${encodeURIComponent(token)}`;
    const filename = kind === 'product-report' ? 'rapport-produits' : 'rapport-financier';
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const maxSale = data ? Math.max(1, ...data.salesByHour.map((s) => s.amount)) : 1;
  const maxDishRevenue = data ? Math.max(1, ...data.topDishes.map((d) => d.revenue)) : 1;
  const maxTipServer = data && data.tips.byServer.length ? Math.max(1, ...data.tips.byServer.map((s) => s.amount)) : 1;
  const maxExpenseCat = data && data.expensesByCategory.length ? Math.max(1, ...data.expensesByCategory.map((c) => c.amount)) : 1;
  const catLabel = (c: string) => c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' ');

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-black text-neutral-200 max-w-7xl mx-auto p-4">
      <div className="bg-gradient-to-r from-neutral-950 to-neutral-900/40 border border-neutral-800 ring-1 ring-white/5 text-neutral-100 rounded-2xl p-5 mb-4 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8" />
          <div>
            <h1 className="text-xl font-bold">Dashboard Statistiques</h1>
            <p className="text-sm opacity-90">Vue d'ensemble des performances</p>
          </div>
        </div>
        <div className="text-sm font-mono">{formatTime(clock)}</div>
      </div>

      <div className="flex gap-2 mb-4">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg font-medium ${period === p ? 'bg-gold-400 text-black' : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800'}`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {exportError && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 mb-4 text-sm">
          {exportError}
        </div>
      )}

      {loading || !data ? (
        <div className="text-center text-neutral-500 py-12">Chargement des statistiques...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <KpiCard
              icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
              iconBg="bg-emerald-500/15"
              border="border-green-500"
              label="Ventes totales"
              value={formatFCFA(data.totalSales)}
              growth={data.salesGrowth}
              sub={`précédent : ${formatFCFA(data.previousPeriodSales)}`}
            />
            <KpiCard
              icon={<ShoppingCart className="w-5 h-5 text-gold-400" />}
              iconBg="bg-gold-400/15"
              border="border-gold-400"
              label="Commandes"
              value={String(data.totalOrders)}
              growth={data.ordersGrowth}
              sub={`précédent : ${data.previousPeriodOrders}`}
            />
            <KpiCard
              icon={<TrendingUp className="w-5 h-5 text-purple-400" />}
              iconBg="bg-purple-500/15"
              border="border-purple-500"
              label="Ticket moyen"
              value={formatFCFA(data.averageTicket)}
              growth={data.ticketGrowth}
              sub={`précédent : ${formatFCFA(data.previousPeriodTicket)}`}
            />
            <KpiCard
              icon={<Clock className="w-5 h-5 text-orange-400" />}
              iconBg="bg-orange-500/15"
              border="border-orange-500"
              label="Heure de pointe"
              value={data.peakHour}
              sub={formatFCFA(data.peakHourSales)}
            />
            <KpiCard
              icon={<Wallet className="w-5 h-5 text-rose-400" />}
              iconBg="bg-rose-500/15"
              border="border-rose-500"
              label="Dépenses"
              value={formatFCFA(data.totalExpenses)}
              growth={data.expensesGrowth}
              sub={`précédent : ${formatFCFA(data.previousPeriodExpenses)}`}
            />
            <KpiCard
              icon={<PiggyBank className={`w-5 h-5 ${data.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} />}
              iconBg={data.netProfit >= 0 ? 'bg-emerald-500/15' : 'bg-rose-500/15'}
              border={data.netProfit >= 0 ? 'border-green-500' : 'border-rose-500'}
              label="Bénéfice net"
              value={formatFCFA(data.netProfit)}
              growth={data.profitGrowth}
              sub="ventes − coût matière − pertes − charges"
            />
          </div>

          {/* Rentabilité : coût matière, marge brute, pertes valorisées, achats stock */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <KpiCard
              icon={<Boxes className="w-5 h-5 text-sky-400" />}
              iconBg="bg-sky-500/15"
              border="border-sky-500"
              label="Coût matière (ingrédients vendus)"
              value={formatFCFA(data.foodCost)}
              sub={`${data.foodCostPct}% des ventes`}
            />
            <KpiCard
              icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
              iconBg="bg-emerald-500/15"
              border="border-green-500"
              label="Marge brute (ventes − coût matière)"
              value={formatFCFA(data.grossMargin)}
              sub={`${data.grossMarginPct}% des ventes`}
            />
            <KpiCard
              icon={<TriangleAlert className="w-5 h-5 text-orange-400" />}
              iconBg="bg-orange-500/15"
              border="border-orange-500"
              label="Pertes (valorisées)"
              value={formatFCFA(data.lossValue)}
              sub="gaspillage / casse sur la période"
            />
            <KpiCard
              icon={<ShoppingCart className="w-5 h-5 text-amber-400" />}
              iconBg="bg-amber-500/15"
              border="border-amber-500"
              label="Achats stock (trésorerie)"
              value={formatFCFA(data.stockPurchases)}
              growth={data.stockPurchasesGrowth}
              sub="hors bénéfice net (compté en coût matière)"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            {/* Graphique ventes par heure */}
            <div className="lg:col-span-2 bg-neutral-950 rounded-xl shadow p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-neutral-100">Ventes par heure</h2>
              </div>
              <div className="flex items-end gap-1 h-64">
                {data.salesByHour.map((s) => (
                  <div key={s.hour} className="flex-1 flex flex-col items-center justify-end group relative">
                    <div className="absolute -top-8 hidden group-hover:block bg-neutral-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                      {s.hour} : {formatFCFA(s.amount)} ({s.orders})
                    </div>
                    <div
                      className="w-full bg-gradient-to-t from-gold-500 to-gold-300 rounded-t transition-all"
                      style={{ height: `${(s.amount / maxSale) * 100}%` }}
                    />
                    <span className="text-[10px] text-neutral-500 mt-1">{s.hour}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 5 plats */}
            <div className="bg-neutral-950 rounded-xl shadow p-4">
              <h2 className="font-bold text-neutral-100 mb-4">Top 5 Plats</h2>
              <div className="space-y-3">
                {data.topDishes.map((d, i) => (
                  <div key={d.name}>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 flex items-center justify-center bg-gold-400 text-black rounded-full text-xs font-bold">
                        {i + 1}
                      </span>
                      <span className="font-semibold text-sm flex-1 truncate">{d.name}</span>
                      <span className="text-xs text-neutral-500">{d.quantity}</span>
                    </div>
                    <div className="h-2 bg-neutral-800 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-gold-500 to-gold-300 rounded-full"
                        style={{ width: `${(d.revenue / maxDishRevenue) * 100}%` }}
                      />
                    </div>
                    <div className="text-xs text-neutral-400 mt-0.5">
                      {formatFCFA(d.revenue)} · {d.percentage}%
                    </div>
                  </div>
                ))}
                {data.topDishes.length === 0 && <p className="text-neutral-500 text-sm">Aucune donnée</p>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Modes de paiement */}
            <div className="bg-neutral-950 rounded-xl shadow p-4">
              <h2 className="font-bold text-neutral-100 mb-4">Modes de Paiement</h2>
              <div className="space-y-3">
                {data.paymentMethods.map((p) => (
                  <div key={p.method} className="bg-neutral-900 rounded-lg p-3">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize">{p.method}</span>
                      <span className="text-gold-400 font-bold">{p.percentage}%</span>
                    </div>
                    <div className="text-xs text-neutral-400 mb-1">
                      {p.count} transactions · {formatFCFA(p.amount)}
                    </div>
                    <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gold-400 rounded-full" style={{ width: `${p.percentage}%` }} />
                    </div>
                  </div>
                ))}
                {data.paymentMethods.length === 0 && <p className="text-neutral-500 text-sm">Aucune donnée</p>}
              </div>
            </div>

            {/* Commandes recentes */}
            <div className="bg-neutral-950 rounded-xl shadow p-4">
              <h2 className="font-bold text-neutral-100 mb-4">Commandes Récentes</h2>
              <div className="space-y-2">
                {data.recentOrders.map((o) => (
                  <div key={o.orderNumber} className="flex justify-between items-center bg-neutral-900 hover:bg-neutral-800 rounded-lg p-2">
                    <div>
                      <div className="font-bold text-sm">{o.orderNumber}</div>
                      <div className="flex items-center gap-1 text-xs text-neutral-400">
                        <Clock className="w-3 h-3" />
                        {formatTime(o.time)} · {o.items} article(s)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm">{formatFCFA(o.amount)}</div>
                      <span className="text-xs text-neutral-500 capitalize">{o.status}</span>
                    </div>
                  </div>
                ))}
                {data.recentOrders.length === 0 && <p className="text-neutral-500 text-sm">Aucune commande</p>}
              </div>
            </div>
          </div>

          {/* Ventes par canal */}
          <div className="bg-neutral-950 rounded-xl shadow p-4 mb-4">
            <h2 className="font-bold text-neutral-100 mb-4">Ventes par canal</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {data.salesByChannel.map((c) => (
                <div key={c.channel} className="bg-neutral-900 rounded-lg p-3">
                  <div className="flex justify-between text-sm">
                    <span>{CHANNEL_LABELS[c.channel] ?? c.channel}</span>
                    <span className="text-gold-400 font-bold">{c.percentage}%</span>
                  </div>
                  <div className="text-xs text-neutral-400 mb-1">
                    {c.count} vente(s) · {formatFCFA(c.amount)}
                  </div>
                  <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gold-400 rounded-full" style={{ width: `${c.percentage}%` }} />
                  </div>
                </div>
              ))}
              {data.salesByChannel.length === 0 && <p className="text-neutral-500 text-sm">Aucune donnée</p>}
            </div>
          </div>

          {/* Dépenses par catégorie */}
          <div className="bg-neutral-950 rounded-xl shadow p-4 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="w-5 h-5 text-rose-400" />
              <h2 className="font-bold text-neutral-100">Dépenses par catégorie</h2>
              <span className="ml-auto text-rose-400 font-bold">{formatFCFA(data.totalExpenses)}</span>
            </div>
            {data.expensesByCategory.length === 0 ? (
              <p className="text-neutral-500 text-sm">Aucune dépense sur la période</p>
            ) : (
              <div className="space-y-3">
                {data.expensesByCategory.map((c) => (
                  <div key={c.category}>
                    <div className="flex justify-between text-sm">
                      <span>{catLabel(c.category)}</span>
                      <span className="text-neutral-300 font-semibold">{formatFCFA(c.amount)}</span>
                    </div>
                    <div className="h-2 bg-neutral-800 rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-rose-500/80 rounded-full" style={{ width: `${(c.amount / maxExpenseCat) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Marge par plat (rentabilité) */}
          <div className="bg-neutral-950 rounded-xl shadow p-4 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Utensils className="w-5 h-5 text-gold-400" />
              <h2 className="font-bold text-neutral-100">Marge par plat</h2>
              <span className="ml-auto text-xs text-neutral-500">triés du moins au plus rentable</span>
            </div>
            {data.dishMargins.length === 0 ? (
              <p className="text-neutral-500 text-sm">Renseigne le prix d'achat des ingrédients pour voir les marges.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-neutral-400">
                    <tr>
                      <th className="text-left py-1">Plat</th>
                      <th className="text-right py-1">Coût</th>
                      <th className="text-right py-1">Vente</th>
                      <th className="text-right py-1">Marge</th>
                      <th className="text-right py-1">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.dishMargins.map((d) => {
                      const margin = d.price - d.cost;
                      const color = d.marginPct >= 60 ? 'text-emerald-400' : d.marginPct >= 40 ? 'text-gold-400' : 'text-rose-400';
                      return (
                        <tr key={d.name} className="border-t border-neutral-900">
                          <td className="py-1.5 text-neutral-200">{d.name}</td>
                          <td className="py-1.5 text-right text-neutral-400">{formatFCFA(d.cost)}</td>
                          <td className="py-1.5 text-right text-neutral-400">{formatFCFA(d.price)}</td>
                          <td className={`py-1.5 text-right font-medium ${color}`}>{formatFCFA(margin)}</td>
                          <td className={`py-1.5 text-right font-bold ${color}`}>{d.marginPct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pourboires (hors chiffre d'affaires) */}
          <div className="bg-neutral-950 rounded-xl shadow p-4 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Coins className="w-5 h-5 text-gold-400" />
              <h2 className="font-bold text-neutral-100">Pourboires</h2>
              <span className="ml-auto text-gold-400 font-bold">{formatFCFA(data.tips.total)}</span>
            </div>
            {data.tips.total === 0 ? (
              <p className="text-neutral-500 text-sm">Aucun pourboire sur la période</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm text-neutral-400 mb-2">Par serveur</h3>
                  <div className="space-y-2">
                    {data.tips.byServer.map((s) => (
                      <div key={s.server}>
                        <div className="flex justify-between text-sm">
                          <span>{s.server}</span>
                          <span className="text-gold-400 font-semibold">{formatFCFA(s.amount)}</span>
                        </div>
                        <div className="h-2 bg-neutral-800 rounded-full overflow-hidden mt-1">
                          <div className="h-full bg-gold-400 rounded-full" style={{ width: `${(s.amount / maxTipServer) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm text-neutral-400 mb-2">Par méthode</h3>
                  <div className="space-y-2">
                    {data.tips.byMethod.map((m) => (
                      <div key={m.method} className="flex justify-between text-sm bg-neutral-900 rounded-lg px-3 py-2">
                        <span className="capitalize">{m.method}</span>
                        <span className="text-gold-400 font-semibold">{formatFCFA(m.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Rapport financier (PDF / CSV) sur une plage de dates au choix */}
          <div className="bg-gradient-to-r from-neutral-950 to-neutral-900/40 border border-neutral-800 ring-1 ring-white/5 text-neutral-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-5 h-5 text-gold-400" />
              <h2 className="font-bold">Rapport financier</h2>
            </div>
            <p className="text-sm text-neutral-400 mb-4">
              Dépenses, recettes et bénéfice sur la période choisie, prêt à imprimer ou partager.
            </p>

            {/* Nom du restaurant (en-tête du rapport) */}
            <div className="mb-4">
              <label className="block text-sm text-neutral-400 mb-1">Nom du restaurant (en-tête du rapport)</label>
              <div className="flex gap-2 max-w-md">
                <input
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="Ex. La Table d'Or"
                  className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400"
                />
                <button
                  onClick={saveName}
                  className="flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-100 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
                >
                  {nameSaved ? <Check className="w-4 h-4 text-emerald-400" /> : null}
                  {nameSaved ? 'Enregistré' : 'Enregistrer'}
                </button>
              </div>
            </div>

            {/* Plage de dates + raccourcis */}
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Du</label>
                <input
                  type="date"
                  value={reportStart}
                  max={reportEnd}
                  onChange={(e) => setReportStart(e.target.value)}
                  className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Au</label>
                <input
                  type="date"
                  value={reportEnd}
                  min={reportStart}
                  onChange={(e) => setReportEnd(e.target.value)}
                  className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 outline-none focus:ring-2 focus:ring-gold-400/60 focus:border-gold-400"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {([
                  ['7d', '7 jours'],
                  ['30d', '30 jours'],
                  ['month', 'Ce mois'],
                  ['lastMonth', 'Mois dernier'],
                ] as const).map(([kind, label]) => (
                  <button
                    key={kind}
                    onClick={() => applyPreset(kind)}
                    className="bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-sm px-3 py-2 rounded-lg"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Rapport financier (trésorerie)</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <button
                onClick={() => handleDownloadReport('report', 'pdf')}
                className="flex items-center gap-3 bg-gold-400 hover:bg-gold-300 text-black rounded-lg p-4 text-left font-medium"
              >
                <Download className="w-6 h-6" />
                <div>
                  <div className="font-semibold">Rapport financier</div>
                  <div className="text-sm opacity-80">Télécharger PDF</div>
                </div>
              </button>
              <button
                onClick={() => handleDownloadReport('report', 'csv')}
                className="flex items-center gap-3 bg-neutral-950/40 hover:bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-left"
              >
                <Download className="w-6 h-6" />
                <div>
                  <div className="font-semibold">Données financières</div>
                  <div className="text-sm opacity-90">Télécharger CSV (tableur)</div>
                </div>
              </button>
            </div>

            <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Ventes par produit</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => handleDownloadReport('product-report', 'pdf')}
                className="flex items-center gap-3 bg-gold-400 hover:bg-gold-300 text-black rounded-lg p-4 text-left font-medium"
              >
                <Download className="w-6 h-6" />
                <div>
                  <div className="font-semibold">Rapport ventes par produit</div>
                  <div className="text-sm opacity-80">Télécharger PDF</div>
                </div>
              </button>
              <button
                onClick={() => handleDownloadReport('product-report', 'csv')}
                className="flex items-center gap-3 bg-neutral-950/40 hover:bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-left"
              >
                <Download className="w-6 h-6" />
                <div>
                  <div className="font-semibold">Données produits</div>
                  <div className="text-sm opacity-90">Télécharger CSV (tableur)</div>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  iconBg,
  border,
  label,
  value,
  growth,
  sub,
}: {
  icon: React.ReactNode;
  iconBg: string;
  border: string;
  label: string;
  value: string;
  growth?: number;
  sub?: string;
}) {
  return (
    <div className={`bg-neutral-950 rounded-xl shadow p-4 border-l-4 ${border}`}>
      <div className="flex justify-between items-start">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>{icon}</div>
        {growth !== undefined && <GrowthBadge value={growth} />}
      </div>
      <div className="text-2xl font-bold text-neutral-100 mt-3">{value}</div>
      <div className="text-sm text-neutral-400">{label}</div>
      {sub && <div className="text-xs text-neutral-500 mt-1">{sub}</div>}
    </div>
  );
}
