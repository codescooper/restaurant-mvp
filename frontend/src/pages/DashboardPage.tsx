import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Clock,
  Download,
  Calendar,
} from 'lucide-react';
import { useClock } from '../hooks/useClock';
import { useWebSocket } from '../contexts/WebSocketContext';
import { statsApi } from '../services/endpoints';
import { DashboardData } from '../types';
import { formatFCFA, formatTime } from '../utils/format';

type Period = 'today' | 'week' | 'month';
const PERIOD_LABELS: Record<Period, string> = { today: "Aujourd'hui", week: 'Cette semaine', month: 'Ce mois' };

function GrowthBadge({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${positive ? 'text-green-600' : 'text-red-600'}`}>
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

  const handleExport = async (format: 'pdf' | 'csv') => {
    try {
      const blob = await statsApi.exportReport(period, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport-${period}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  const maxSale = data ? Math.max(1, ...data.salesByHour.map((s) => s.amount)) : 1;
  const maxDishRevenue = data ? Math.max(1, ...data.topDishes.map((d) => d.revenue)) : 1;

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white rounded-xl p-5 mb-4 flex flex-wrap justify-between items-center gap-3">
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
            className={`px-4 py-2 rounded-lg font-medium ${period === p ? 'bg-white text-blue-600 shadow' : 'bg-blue-700 text-white'}`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {loading || !data ? (
        <div className="text-center text-gray-400 py-12">Chargement des statistiques...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <KpiCard
              icon={<DollarSign className="w-5 h-5 text-green-600" />}
              iconBg="bg-green-100"
              border="border-green-500"
              label="Ventes totales"
              value={formatFCFA(data.totalSales)}
              growth={data.salesGrowth}
              sub={`précédent : ${formatFCFA(data.previousPeriodSales)}`}
            />
            <KpiCard
              icon={<ShoppingCart className="w-5 h-5 text-blue-600" />}
              iconBg="bg-blue-100"
              border="border-blue-500"
              label="Commandes"
              value={String(data.totalOrders)}
              growth={data.ordersGrowth}
              sub={`précédent : ${data.previousPeriodOrders}`}
            />
            <KpiCard
              icon={<TrendingUp className="w-5 h-5 text-purple-600" />}
              iconBg="bg-purple-100"
              border="border-purple-500"
              label="Ticket moyen"
              value={formatFCFA(data.averageTicket)}
              growth={data.ticketGrowth}
              sub={`précédent : ${formatFCFA(data.previousPeriodTicket)}`}
            />
            <KpiCard
              icon={<Clock className="w-5 h-5 text-orange-600" />}
              iconBg="bg-orange-100"
              border="border-orange-500"
              label="Heure de pointe"
              value={data.peakHour}
              sub={formatFCFA(data.peakHourSales)}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            {/* Graphique ventes par heure */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-gray-800">Ventes par heure</h2>
                <button onClick={() => handleExport('csv')} className="text-sm text-blue-600 flex items-center gap-1">
                  <Download className="w-4 h-4" /> Exporter
                </button>
              </div>
              <div className="flex items-end gap-1 h-64">
                {data.salesByHour.map((s) => (
                  <div key={s.hour} className="flex-1 flex flex-col items-center justify-end group relative">
                    <div className="absolute -top-8 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                      {s.hour} : {formatFCFA(s.amount)} ({s.orders})
                    </div>
                    <div
                      className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t transition-all"
                      style={{ height: `${(s.amount / maxSale) * 100}%` }}
                    />
                    <span className="text-[10px] text-gray-400 mt-1">{s.hour}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 5 plats */}
            <div className="bg-white rounded-xl shadow p-4">
              <h2 className="font-bold text-gray-800 mb-4">Top 5 Plats</h2>
              <div className="space-y-3">
                {data.topDishes.map((d, i) => (
                  <div key={d.name}>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 flex items-center justify-center bg-blue-600 text-white rounded-full text-xs font-bold">
                        {i + 1}
                      </span>
                      <span className="font-semibold text-sm flex-1 truncate">{d.name}</span>
                      <span className="text-xs text-gray-400">{d.quantity}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                        style={{ width: `${(d.revenue / maxDishRevenue) * 100}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {formatFCFA(d.revenue)} · {d.percentage}%
                    </div>
                  </div>
                ))}
                {data.topDishes.length === 0 && <p className="text-gray-400 text-sm">Aucune donnée</p>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Modes de paiement */}
            <div className="bg-white rounded-xl shadow p-4">
              <h2 className="font-bold text-gray-800 mb-4">Modes de Paiement</h2>
              <div className="space-y-3">
                {data.paymentMethods.map((p) => (
                  <div key={p.method} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize">{p.method}</span>
                      <span className="text-blue-600 font-bold">{p.percentage}%</span>
                    </div>
                    <div className="text-xs text-gray-500 mb-1">
                      {p.count} transactions · {formatFCFA(p.amount)}
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${p.percentage}%` }} />
                    </div>
                  </div>
                ))}
                {data.paymentMethods.length === 0 && <p className="text-gray-400 text-sm">Aucune donnée</p>}
              </div>
            </div>

            {/* Commandes recentes */}
            <div className="bg-white rounded-xl shadow p-4">
              <h2 className="font-bold text-gray-800 mb-4">Commandes Récentes</h2>
              <div className="space-y-2">
                {data.recentOrders.map((o) => (
                  <div key={o.orderNumber} className="flex justify-between items-center bg-gray-50 hover:bg-gray-100 rounded-lg p-2">
                    <div>
                      <div className="font-bold text-sm">{o.orderNumber}</div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {formatTime(o.time)} · {o.items} article(s)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm">{formatFCFA(o.amount)}</div>
                      <span className="text-xs text-gray-400 capitalize">{o.status}</span>
                    </div>
                  </div>
                ))}
                {data.recentOrders.length === 0 && <p className="text-gray-400 text-sm">Aucune commande</p>}
              </div>
            </div>
          </div>

          {/* Actions rapides */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white rounded-xl p-5">
            <h2 className="font-bold mb-3">Actions Rapides</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => handleExport('pdf')}
                className="flex items-center gap-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg p-4 text-left"
              >
                <Download className="w-6 h-6" />
                <div>
                  <div className="font-semibold">Rapport ({PERIOD_LABELS[period]})</div>
                  <div className="text-sm opacity-90">Télécharger PDF</div>
                </div>
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="flex items-center gap-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg p-4 text-left"
              >
                <Calendar className="w-6 h-6" />
                <div>
                  <div className="font-semibold">Export données</div>
                  <div className="text-sm opacity-90">Télécharger CSV</div>
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
    <div className={`bg-white rounded-xl shadow p-4 border-l-4 ${border}`}>
      <div className="flex justify-between items-start">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>{icon}</div>
        {growth !== undefined && <GrowthBadge value={growth} />}
      </div>
      <div className="text-2xl font-bold text-gray-800 mt-3">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}
