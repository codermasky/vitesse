import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { TrendingUp, DollarSign, Zap, Clock, Calendar } from 'lucide-react';
import SectionHeader from '../components/SectionHeader';
import { cn } from '../services/utils';

interface CostData {
  total_cost: number;
  total_calls: number;
  agents: Array<{
    name: string;
    total_cost: number;
    calls: number;
  }>;
  models: Array<{
    name: string;
    total_cost: number;
    calls: number;
    avg_latency_ms: number;
  }>;
  trends: Array<{
    date: string;
    cost: number;
    calls: number;
  }>;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8002/api';
// Using Credo semantic colors for charts
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6'];

export default function CostDashboard() {
  const [costData, setCostData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(30);

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const summaryRes = await axios.get(`${API_BASE}/v1/analytics/cost-summary`);
      const summary = summaryRes.data;

      // Transform the data into the expected format
      const agents = Object.entries(summary.calls_by_agent || {}).map(([name, data]: [string, any]) => ({
        name,
        total_cost: data.cost || 0,
        calls: data.calls || 0,
      }));

      const models = Object.entries(summary.calls_by_model || {}).map(([name, data]: [string, any]) => ({
        name,
        total_cost: data.cost || 0,
        calls: data.calls || 0,
        avg_latency_ms: data.avg_latency_ms || 0,
      }));

      // Create mock trends data based on the summary
      const trends = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        trends.push({
          date: date.toISOString().split('T')[0],
          cost: (summary.total_cost_usd || 0) / 7,
          calls: Math.floor((summary.total_calls || 0) / 7),
        });
      }

      setCostData({
        total_cost: summary.total_cost_usd || 0,
        total_calls: summary.total_calls || 0,
        agents,
        models,
        trends,
      });
    } catch (err) {
      setError(`Failed to load analytics: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full mb-4" />
        <p className="text-surface-500 font-medium">Loading cost analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 rounded-xl">
          <p className="font-bold mb-1">Error Loading Data</p>
          <p className="text-sm opacity-90">{error}</p>
        </div>
      </div>
    );
  }

  // Safe Math Helpers
  const safeDiv = (num: number, den: number) => (den === 0 ? 0 : num / den);
  const avgCostPerCall = costData ? safeDiv(costData.total_cost, costData.total_calls) : 0;

  // Calculate average latency safely
  const totalLatency = costData?.models.reduce((sum, m) => sum + m.avg_latency_ms, 0) || 0;
  const avgLatency = costData?.models.length ? safeDiv(totalLatency, costData.models.length) : 0;

  return (
    <div className="space-y-8 pb-20 relative">
      <SectionHeader
        title="LLM Cost Analytics"
        subtitle="Monitor and optimize LLM usage and costs across your organization"
        icon={DollarSign}
        variant="premium"
        className="!p-0 !bg-transparent !border-none"
      />

      {/* Date Range Selector */}
      <div className="flex gap-2 p-1 bg-surface-100 dark:bg-brand-500/[0.03] border border-brand-primary/10 rounded-2xl w-fit shadow-sm">
        {[7, 30, 90, 365].map((days) => (
          <button
            key={days}
            onClick={() => setDateRange(days)}
            className={cn(
              "px-4 py-2 rounded-xl font-black uppercase text-xs tracking-widest transition-all",
              dateRange === days
                ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20"
                : "text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white"
            )}
          >
            Last {days}d
          </button>
        ))}
      </div>

      {costData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-bold text-surface-500 uppercase tracking-widest mb-1">Total Cost</p>
                  <p className="text-3xl font-bold text-surface-950 dark:text-white">
                    ${costData.total_cost.toFixed(2)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-primary">
                  <DollarSign size={24} />
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-bold text-surface-500 uppercase tracking-widest mb-1">Total Calls</p>
                  <p className="text-3xl font-bold text-surface-950 dark:text-white">
                    {costData.total_calls.toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Zap size={24} />
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-bold text-surface-500 uppercase tracking-widest mb-1">Avg Cost/Call</p>
                  <p className="text-3xl font-bold text-surface-950 dark:text-white">
                    ${avgCostPerCall.toFixed(4)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <TrendingUp size={24} />
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-bold text-surface-500 uppercase tracking-widest mb-1">Avg Latency</p>
                  <p className="text-3xl font-bold text-surface-950 dark:text-white">
                    {avgLatency.toFixed(0)} <span className="text-sm text-surface-400 font-normal">ms</span>
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-500">
                  <Clock size={24} />
                </div>
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost Trend */}
            <div className="glass rounded-2xl p-8">
              <h2 className="text-lg font-bold text-surface-950 dark:text-white mb-6 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-brand-primary" />
                Cost Trends
              </h2>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={costData.trends}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.1} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: '#6B7280' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(date: any) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      dy={10}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#6B7280' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val: any) => `$${val}`}
                      dx={-10}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value: any) => {
                        if (typeof value === 'number') {
                          return [`$${value.toFixed(2)}`, 'Cost'];
                        }
                        return [value, 'Cost'];
                      }}
                      labelFormatter={(date: any) => new Date(date).toLocaleDateString()}
                    />
                    <Line
                      type="monotone"
                      dataKey="cost"
                      stroke="#6366f1"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                      isAnimationActive={true}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Cost by Agent */}
            <div className="glass rounded-2xl p-8">
              <h2 className="text-lg font-bold text-surface-950 dark:text-white mb-6">Cost by Agent</h2>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={costData.agents}
                      dataKey="total_cost"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      label={({ name, percent }: any) => `${name ?? 'Unknown'} ${(percent * 100).toFixed(0)}%`}
                    >
                      {costData.agents.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value: any) => {
                        if (typeof value === 'number') {
                          return `$${value.toFixed(2)}`;
                        }
                        return value;
                      }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Calls by Model */}
            <div className="glass rounded-2xl p-8">
              <h2 className="text-lg font-bold text-surface-950 dark:text-white mb-6">
                Calls by Model
              </h2>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costData.models} layout="vertical" barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E5E7EB" opacity={0.1} />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{ fontSize: 12, fill: '#6B7280' }}
                      tickLine={false}
                      axisLine={false}
                      width={150}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                      contentStyle={{ borderRadius: '8px', border: 'none' }}
                    />
                    <Bar dataKey="calls" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Cost by Model */}
            <div className="glass rounded-2xl p-8">
              <h2 className="text-lg font-bold text-surface-950 dark:text-white mb-6">Cost by Model</h2>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costData.models} barSize={40}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.1} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: '#6B7280' }}
                      tickLine={false}
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#6B7280' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val: any) => `$${val}`}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                      contentStyle={{ borderRadius: '8px', border: 'none' }}
                      formatter={(value: any) => {
                        if (typeof value === 'number') {
                          return `$${value.toFixed(2)}`;
                        }
                        return value;
                      }} />
                    <Bar dataKey="total_cost" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Detailed Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Agents Table */}
            <div className="glass rounded-2xl overflow-hidden p-0">
              <div className="p-6 border-b border-surface-200 dark:border-white/5 bg-surface-50/50 dark:bg-surface-800/30">
                <h2 className="text-lg font-bold text-surface-950 dark:text-white">Agent Cost Details</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-200 dark:border-white/5">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-black uppercase text-surface-500 tracking-wider">
                        Agent
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-black uppercase text-surface-500 tracking-wider">
                        Cost
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-black uppercase text-surface-500 tracking-wider">
                        Calls
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-black uppercase text-surface-500 tracking-wider">
                        Avg/Call
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-200 dark:divide-white/5">
                    {costData.agents.map((agent) => (
                      <tr key={agent.name} className="hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-bold text-surface-950 dark:text-white">
                          {agent.name}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-surface-600 dark:text-surface-300">
                          ${agent.total_cost.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-surface-600 dark:text-surface-300">
                          {agent.calls}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-surface-600 dark:text-surface-300">
                          ${safeDiv(agent.total_cost, agent.calls).toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Models Table */}
            <div className="glass rounded-2xl overflow-hidden p-0">
              <div className="p-6 border-b border-surface-200 dark:border-white/5 bg-surface-50/50 dark:bg-surface-800/30">
                <h2 className="text-lg font-bold text-surface-950 dark:text-white">Model Cost Details</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-200 dark:border-white/5">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-black uppercase text-surface-500 tracking-wider">
                        Model
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-black uppercase text-surface-500 tracking-wider">
                        Cost
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-black uppercase text-surface-500 tracking-wider">
                        Calls
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-black uppercase text-surface-500 tracking-wider">
                        Latency
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-200 dark:divide-white/5">
                    {costData.models.map((model) => (
                      <tr key={model.name} className="hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-bold text-surface-950 dark:text-white">
                          {model.name}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-surface-600 dark:text-surface-300">
                          ${model.total_cost.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-surface-600 dark:text-surface-300">
                          {model.calls}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-surface-600 dark:text-surface-300">
                          {model.avg_latency_ms.toFixed(0)}ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
