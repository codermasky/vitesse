import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, BarChart3, Activity, Zap, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import SectionHeader from '../components/SectionHeader';
import { Link } from 'react-router-dom';
import { cn } from '../services/utils';
import { apiService } from '../services/api';

interface DashboardInfo {
  status: string;
  langfuse_enabled: boolean;
  dashboard_url: string;
  stats: {
    total_calls: number;
    total_tokens: number;
    avg_tokens_per_call: number;
    models?: Record<string, number>;
    agents?: Record<string, number>;
  };
}

const LangfuseDashboard: React.FC = () => {
  const [dashboardInfo, setDashboardInfo] = useState<DashboardInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'models' | 'agents'>('overview');

  useEffect(() => {
    fetchDashboardInfo();
  }, []);

  const fetchDashboardInfo = async () => {
    try {
      setLoading(true);
      const response = await apiService.getLangfuseDashboardInfo();
      setDashboardInfo(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <Activity className="w-12 h-12 text-brand-primary" />
        </motion.div>
      </div>
    );
  }

  if (!dashboardInfo?.langfuse_enabled) {
    return (
      <div className="space-y-10 pb-20">
        <SectionHeader
          title="LLM Monitoring"
          subtitle="Track all language model calls, costs, and performance metrics in real-time"
          icon={Activity}
          variant="premium"
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {/* Main Config Card */}
          <div className="lg:col-span-2 border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 rounded-3xl p-8 shadow-sm">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100 mb-2">
                  LangFuse Not Configured
                </h3>
                <p className="text-sm text-amber-800 dark:text-amber-200 mb-4">
                  Enable LLM monitoring to track all model calls, tokens consumed, latency, and costs. Configure your LangFuse credentials in settings.
                </p>
                <Link
                  to="/settings?tab=langfuse"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-sm uppercase tracking-widest transition-all"
                >
                  <Zap className="w-4 h-4" />
                  Configure Now
                </Link>
              </div>
            </div>
          </div>

          {/* Info Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="border border-brand-primary/10 dark:border-brand-500/20 rounded-3xl p-6 bg-surface-50 dark:bg-brand-500/[0.03] shadow-sm"
          >
            <div className="flex items-start gap-3 mb-4">
              <Activity className="w-5 h-5 text-brand-primary flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-surface-950 dark:text-white">Status</h4>
                <p className="text-xs uppercase tracking-widest font-black text-brand-500 mt-1">
                  Not Enabled
                </p>
              </div>
            </div>
            <div className="space-y-2 text-xs text-brand-600 dark:text-brand-400">
              <p>• Zero LLM calls tracked</p>
              <p>• No metrics available</p>
              <p>• Setup takes &lt; 2 minutes</p>
            </div>
          </motion.div>
        </motion.div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: BarChart3,
              title: 'Real-Time Analytics',
              description: 'Monitor all LLM calls with detailed metrics on latency, tokens, and costs'
            },
            {
              icon: Zap,
              title: 'Cost Tracking',
              description: 'Understand spending across different models and agents'
            },
            {
              icon: Activity,
              title: 'Performance Insights',
              description: 'Identify bottlenecks and optimize agent efficiency'
            }
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * (i + 2) }}
              className="border border-brand-primary/10 dark:border-brand-500/20 rounded-2xl p-6 bg-surface-50 dark:bg-brand-500/[0.03] shadow-sm"
            >
              <item.icon className="w-8 h-8 text-brand-primary mb-3" />
              <h3 className="font-bold text-surface-950 dark:text-white mb-2">{item.title}</h3>
              <p className="text-sm text-brand-600 dark:text-brand-400">{item.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto min-h-screen space-y-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-[2.5rem] p-12 border border-brand-500/10 space-y-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
              <BarChart3 className="w-7 h-7 text-brand-500" />
            </div>
            <div>
              <h1 className="text-5xl lg:text-6xl font-black tracking-tight text-surface-950 dark:text-white">LLM Monitoring</h1>
              <p className="text-lg text-surface-600 dark:text-surface-400 font-medium">Track all language model calls, costs, and performance metrics in real-time.</p>
            </div>
          </div>
          <a
            href={dashboardInfo.dashboard_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-primary text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:shadow-lg hover:shadow-brand-primary/25 transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            Open Full Dashboard
          </a>
        </div>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 rounded-2xl p-6 flex gap-4"
        >
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </motion.div>
      )}

      {/* Key Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {[
          {
            label: 'Total LLM Calls (24h)',
            value: (dashboardInfo.stats?.total_calls ?? 0).toLocaleString(),
            subtext: 'All LLM invocations',
            icon: Activity,
            color: 'brand'
          },
          {
            label: 'Total Tokens (24h)',
            value: (dashboardInfo.stats?.total_tokens ?? 0).toLocaleString(),
            subtext: `${(dashboardInfo.stats?.avg_tokens_per_call ?? 0).toLocaleString()} avg per call`,
            icon: Zap,
            color: 'purple'
          },
          {
            label: 'Unique Models',
            value: Object.keys(dashboardInfo.stats?.models || {}).length.toString(),
            subtext: 'Models in use',
            icon: BarChart3,
            color: 'emerald'
          }
        ].map((metric, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 * (i + 1) }}
            className="border border-brand-primary/10 dark:border-brand-500/20 rounded-2xl p-6 bg-surface-50 dark:bg-brand-500/[0.03] shadow-sm"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                metric.color === 'brand' ? "bg-brand-100 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400" :
                  metric.color === 'purple' ? "bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400" :
                    "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              )}>
                <metric.icon className="w-5 h-5" />
              </div>
              <RefreshCw className="w-4 h-4 text-brand-400 dark:text-brand-500 opacity-50" />
            </div>
            <p className="text-xs uppercase font-black tracking-widest text-brand-500 dark:text-brand-400 mb-1">
              {metric.label}
            </p>
            <p className="text-3xl font-black text-surface-950 dark:text-white mb-2">
              {metric.value}
            </p>
            <p className="text-xs text-brand-600 dark:text-brand-400">
              {metric.subtext}
            </p>
          </motion.div>
        ))}
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-6"
      >
        <div className="flex gap-1 p-1 bg-surface-100 dark:bg-brand-500/[0.03] border border-brand-primary/10 rounded-2xl w-fit shadow-sm">
          {['overview', 'models', 'agents'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={cn(
                "px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all",
                activeTab === tab
                  ? "bg-brand-primary text-surface-950 dark:text-white shadow-xl shadow-brand-primary/20"
                  : "text-brand-900/60 hover:text-surface-950 dark:text-white dark:hover:text-white"
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="border border-brand-primary/10 dark:border-brand-500/20 rounded-2xl p-8 bg-surface-50 dark:bg-brand-500/[0.03] shadow-sm"
            >
              <h3 className="font-bold text-surface-950 dark:text-white mb-4">LangFuse Embedded Dashboard</h3>
              <p className="text-sm text-brand-600 dark:text-brand-400 mb-6">
                Real-time view of all LLM calls and metrics from your LangFuse instance
              </p>
              <div className="rounded-xl overflow-hidden border border-brand-primary/10 dark:border-brand-500/20 bg-surface-900" style={{ height: '700px' }}>
                <iframe
                  src={dashboardInfo.dashboard_url}
                  title="LangFuse Dashboard"
                  className="w-full h-full border-0"
                  allow="clipboard-read; clipboard-write"
                />
              </div>
              <p className="text-xs text-brand-500 dark:text-brand-400 mt-4">
                For full features, <a href={dashboardInfo.dashboard_url} target="_blank" rel="noopener noreferrer" className="hover:underline">open the complete dashboard</a>
              </p>
            </motion.div>
          )}

          {/* Models Tab */}
          {activeTab === 'models' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <div className="border border-brand-primary/10 dark:border-brand-500/20 rounded-2xl p-6 bg-surface-50 dark:bg-brand-500/[0.03] shadow-sm">
                <h3 className="font-bold text-surface-950 dark:text-white mb-1">Models Used</h3>
                <p className="text-xs uppercase font-black tracking-widest text-brand-500 dark:text-brand-400 mb-4">Last 24 hours</p>
                {Object.keys(dashboardInfo.stats.models || {}).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(dashboardInfo.stats.models || {})
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .map(([model, count]) => (
                        <div key={model} className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-surface-900 border border-brand-primary/5 dark:border-brand-500/10">
                          <span className="text-sm font-medium text-surface-950 dark:text-white">{model || 'Unknown'}</span>
                          <span className="text-xs font-black text-brand-600 dark:text-brand-400 bg-brand-100 dark:bg-brand-500/10 px-3 py-1 rounded-lg">
                            {count} calls
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-brand-500 dark:text-brand-400">No model data available</p>
                )}
              </div>

              <div className="border border-brand-primary/10 dark:border-brand-500/20 rounded-2xl p-6 bg-surface-50 dark:bg-brand-500/[0.03] shadow-sm">
                <h3 className="font-bold text-surface-950 dark:text-white mb-1">What's Tracked</h3>
                <p className="text-xs uppercase font-black tracking-widest text-brand-500 dark:text-brand-400 mb-4">Per Model</p>
                <ul className="space-y-2 text-sm text-brand-600 dark:text-brand-400">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    Total calls and tokens
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    Average latency
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    Cost estimation
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    Error rates
                  </li>
                </ul>
              </div>
            </motion.div>
          )}

          {/* Agents Tab */}
          {activeTab === 'agents' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <div className="border border-brand-primary/10 dark:border-brand-500/20 rounded-2xl p-6 bg-surface-50 dark:bg-brand-500/[0.03] shadow-sm">
                <h3 className="font-bold text-surface-950 dark:text-white mb-1">Agent Activity</h3>
                <p className="text-xs uppercase font-black tracking-widest text-brand-500 dark:text-brand-400 mb-4">Last 24 hours</p>
                {Object.keys(dashboardInfo.stats.agents || {}).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(dashboardInfo.stats.agents || {})
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .map(([agent, count]) => (
                        <div key={agent} className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-surface-900 border border-brand-primary/5 dark:border-brand-500/10">
                          <span className="text-sm font-medium text-surface-950 dark:text-white">{agent || 'Unknown'}</span>
                          <span className="text-xs font-black text-brand-600 dark:text-brand-400 bg-brand-100 dark:bg-brand-500/10 px-3 py-1 rounded-lg">
                            {count} calls
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-brand-500 dark:text-brand-400">No agent data available</p>
                )}
              </div>

              <div className="border border-brand-primary/10 dark:border-brand-500/20 rounded-2xl p-6 bg-surface-50 dark:bg-brand-500/[0.03] shadow-sm">
                <h3 className="font-bold text-surface-950 dark:text-white mb-1">Metrics by Agent</h3>
                <p className="text-xs uppercase font-black tracking-widest text-brand-500 dark:text-brand-400 mb-4">Insights</p>
                <ul className="space-y-2 text-sm text-brand-600 dark:text-brand-400">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    Calls per agent
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    Average execution time
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    Success / failure rates
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    Cost per agent
                  </li>
                </ul>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default LangfuseDashboard;
