import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Activity,
    BarChart3,
    Database,
    Zap,
    RefreshCw,
    AlertTriangle,
    Clock,
    Server,
    Trash2,
    Download,
    TrendingUp,
    TrendingDown,
} from 'lucide-react';
import apiService from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../services/utils';

interface CacheStats {
    hits: number;
    misses: number;
    hit_rate_percent: string;
    expirations: number;
    deduplications: number;
    total_entries: number;
}

interface PerformanceMetrics {
    total_metrics: number;
    overall_stats: {
        count: number;
        total_ms: number;
        avg_ms: number;
        min_ms: number;
        max_ms: number;
    };
    by_agent?: Record<string, any>;
    by_phase?: Record<string, any>;
}

interface Recommendation {
    priority: string;
    category: string;
    recommendation: string;
    effort: string;
    impact: string;
    roi: string;
    implementation?: string;
}

const AdminPerformanceDashboard: React.FC = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'performance' | 'cache' | 'database'>('performance');

    // Performance state
    const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
    const [cacheStats, setCacheStats] = useState<{
        caches: {
            llm_cache: CacheStats;
            api_cache: CacheStats;
            collateral_cache: CacheStats;
        };
        overall: {
            total_hits: number;
            total_misses: number;
            total_requests: number;
            overall_hit_rate_percent: string;
        };
        impact: {
            llm_api_calls_saved: number;
            external_api_calls_saved: number;
            estimated_cost_reduction_percent: string;
            estimated_response_time_improvement_percent: string;
        };
    } | null>(null);

    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [clearingCache, setClearingCache] = useState(false);

    // Fetch data on component mount
    useEffect(() => {
        if (user?.role === 'ADMIN') {
            loadDashboardData();
            // Auto-refresh every 30 seconds
            const interval = setInterval(loadDashboardData, 30000);
            return () => clearInterval(interval);
        }
    }, [user]);

    const loadDashboardData = async () => {
        try {
            setLoading(true);

            // Fetch performance metrics
            const perfResponse = await apiService.get('/admin/performance/summary');
            setPerformanceMetrics(perfResponse.data);

            // Fetch cache statistics
            const cacheResponse = await apiService.get('/admin/cache/statistics');
            setCacheStats(cacheResponse.data);

            // Fetch optimization recommendations
            const recsResponse = await apiService.get('/admin/database/optimization');
            setRecommendations(recsResponse.data.performance_recommendations || []);
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleClearCache = async () => {
        if (window.confirm('Are you sure you want to clear all caches? This will impact performance.')) {
            try {
                setClearingCache(true);
                await apiService.post('/admin/cache/clear', {});
                await loadDashboardData();
            } catch (error) {
                console.error('Failed to clear cache:', error);
            } finally {
                setClearingCache(false);
            }
        }
    };

    const handleExportReport = async () => {
        try {
            const response = await apiService.get('/admin/performance/export');
            const element = document.createElement('a');
            element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify(response.data, null, 2)));
            element.setAttribute('download', `performance-report-${new Date().toISOString().split('T')[0]}.json`);
            element.style.display = 'none';
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
        } catch (error) {
            console.error('Failed to export report:', error);
        }
    };

    if (user?.role !== 'ADMIN') {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center p-8 glass rounded-2xl">
                    <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold mb-2 text-surface-950 dark:text-white">Access Denied</h1>
                    <p className="text-surface-500 dark:text-surface-400">You must be an admin to access this dashboard.</p>
                </div>
            </div>
        );
    }

    if (loading && !performanceMetrics) {
        return (
            <div className="flex flex-col items-center justify-center h-96">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                    <RefreshCw className="w-8 h-8 text-brand-primary" />
                </motion.div>
                <p className="text-center mt-4 text-surface-500 font-medium">Loading metrics...</p>
            </div>
        );
    }

    const criticalCount = recommendations.filter(r => r.priority === 'CRITICAL').length;
    const highCount = recommendations.filter(r => r.priority === 'HIGH').length;

    return (
        <div className="space-y-12">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-[2.5rem] p-12 border border-brand-500/10 space-y-6"
            >
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
                        <Activity className="w-7 h-7 text-brand-500" />
                    </div>
                    <div>
                        <h1 className="text-5xl lg:text-6xl font-black tracking-tight text-surface-950 dark:text-white leading-[1.1]">Admin Performance Dashboard</h1>
                        <p className="text-lg text-surface-600 dark:text-surface-400 font-medium">System performance metrics, caching statistics, and optimization recommendations</p>
                    </div>
                </div>
            </motion.div>

            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-1 p-1 bg-surface-100 dark:bg-brand-500/[0.03] border border-brand-primary/10 rounded-2xl w-fit shadow-sm">
                {['performance', 'cache', 'database'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={cn(
                            "px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all",
                            activeTab === tab
                                ? "bg-brand-primary text-surface-950 dark:text-white shadow-xl shadow-brand-primary/20"
                                : "text-brand-900/60 hover:text-surface-950 dark:text-surface-400 dark:hover:text-white"
                        )}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Performance Tab */}
            {activeTab === 'performance' && (
                <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Total Metrics */}
                        <div className="glass rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                    <BarChart3 className="w-5 h-5 text-blue-500" />
                                </div>
                                <RefreshCw
                                    className="w-4 h-4 text-surface-400 cursor-pointer hover:text-brand-primary transition-colors"
                                    onClick={loadDashboardData}
                                />
                            </div>
                            <p className="text-xs uppercase font-black tracking-widest text-surface-500 mb-1">Total Metrics</p>
                            <p className="text-3xl font-bold text-surface-950 dark:text-white">{performanceMetrics?.total_metrics || 0}</p>
                        </div>

                        {/* Average Response Time */}
                        <div className="glass rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                    <Clock className="w-5 h-5 text-emerald-500" />
                                </div>
                            </div>
                            <p className="text-xs uppercase font-black tracking-widest text-surface-500 mb-1">Avg Response Type</p>
                            <p className="text-3xl font-bold text-surface-950 dark:text-white">
                                {performanceMetrics?.overall_stats?.avg_ms?.toFixed(0) || 0}
                                <span className="text-sm font-normal text-surface-500 ml-1">ms</span>
                            </p>
                        </div>

                        {/* Total Duration */}
                        <div className="glass rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                    <TrendingUp className="w-5 h-5 text-purple-500" />
                                </div>
                            </div>
                            <p className="text-xs uppercase font-black tracking-widest text-surface-500 mb-1">Total Duration</p>
                            <p className="text-3xl font-bold text-surface-950 dark:text-white">
                                {((performanceMetrics?.overall_stats?.total_ms || 0) / 1000).toFixed(1)}
                                <span className="text-sm font-normal text-surface-500 ml-1">s</span>
                            </p>
                        </div>

                        {/* Min/Max Response Time */}
                        <div className="glass rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                    <TrendingDown className="w-5 h-5 text-amber-500" />
                                </div>
                            </div>
                            <p className="text-xs uppercase font-black tracking-widest text-surface-500 mb-1">Response Range</p>
                            <div className="flex items-baseline gap-2">
                                <p className="text-2xl font-bold text-surface-950 dark:text-white">
                                    {performanceMetrics?.overall_stats?.min_ms?.toFixed(0) || 0}
                                    <span className="text-sm text-surface-500 mx-1">-</span>
                                    {performanceMetrics?.overall_stats?.max_ms?.toFixed(0) || 0}
                                </p>
                                <span className="text-sm font-normal text-surface-500">ms</span>
                            </div>
                        </div>
                    </div>

                    {/* By Agent Metrics */}
                    {performanceMetrics?.by_agent && (
                        <div className="glass rounded-2xl p-8">
                            <h3 className="font-bold text-surface-950 dark:text-white text-lg mb-6">Performance by Agent</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {Object.entries(performanceMetrics.by_agent).map(([agent, stats]: [string, any]) => (
                                    <div key={agent} className="bg-surface-50 dark:bg-surface-900/50 rounded-xl p-4 border border-surface-200 dark:border-brand-primary/5">
                                        <p className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">{agent}</p>
                                        <p className="text-2xl font-bold text-surface-950 dark:text-white mb-1">
                                            {stats.avg_ms?.toFixed(0) || 0}ms
                                        </p>
                                        <p className="text-xs text-surface-500">
                                            Count: {stats.count} | Total: {(stats.total_ms / 1000).toFixed(1)}s
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </motion.div>
            )}

            {/* Cache Tab */}
            {activeTab === 'cache' && (
                <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* LLM Cache */}
                        <div className="glass rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                    <Zap className="w-5 h-5 text-amber-500" />
                                </div>
                                <h3 className="font-bold text-surface-950 dark:text-white">LLM Cache</h3>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-xs uppercase font-black tracking-widest text-surface-500 mb-1">Hit Rate</p>
                                    <p className="text-3xl font-bold text-surface-950 dark:text-white">
                                        {cacheStats?.caches?.llm_cache?.hit_rate_percent || '0.0'}%
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-surface-200 dark:border-surface-800">
                                    <div>
                                        <p className="text-xs text-surface-500 mb-1">Hits</p>
                                        <p className="font-mono text-surface-900 dark:text-surface-200">{cacheStats?.caches?.llm_cache?.hits || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-surface-500 mb-1">Misses</p>
                                        <p className="font-mono text-surface-900 dark:text-surface-200">{cacheStats?.caches?.llm_cache?.misses || 0}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* API Cache */}
                        <div className="glass rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                    <Server className="w-5 h-5 text-blue-500" />
                                </div>
                                <h3 className="font-bold text-surface-950 dark:text-white">API Cache</h3>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-xs uppercase font-black tracking-widest text-surface-500 mb-1">Hit Rate</p>
                                    <p className="text-3xl font-bold text-surface-950 dark:text-white">
                                        {cacheStats?.caches?.api_cache?.hit_rate_percent || '0.0'}%
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-surface-200 dark:border-surface-800">
                                    <div>
                                        <p className="text-xs text-surface-500 mb-1">Hits</p>
                                        <p className="font-mono text-surface-900 dark:text-surface-200">{cacheStats?.caches?.api_cache?.hits || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-surface-500 mb-1">Misses</p>
                                        <p className="font-mono text-surface-900 dark:text-surface-200">{cacheStats?.caches?.api_cache?.misses || 0}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Collateral Cache */}
                        <div className="glass rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                    <Database className="w-5 h-5 text-emerald-500" />
                                </div>
                                <h3 className="font-bold text-surface-950 dark:text-white">Collateral Cache</h3>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-xs uppercase font-black tracking-widest text-surface-500 mb-1">Hit Rate</p>
                                    <p className="text-3xl font-bold text-surface-950 dark:text-white">
                                        {cacheStats?.caches?.collateral_cache?.hit_rate_percent || '0.0'}%
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-surface-200 dark:border-surface-800">
                                    <div>
                                        <p className="text-xs text-surface-500 mb-1">Hits</p>
                                        <p className="font-mono text-surface-900 dark:text-surface-200">{cacheStats?.caches?.collateral_cache?.hits || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-surface-500 mb-1">Misses</p>
                                        <p className="font-mono text-surface-900 dark:text-surface-200">{cacheStats?.caches?.collateral_cache?.misses || 0}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Overall Impact */}
                    <div className="glass rounded-2xl p-8">
                        <h3 className="font-bold text-surface-950 dark:text-white text-lg mb-6">Overall Impact</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                            <div className="bg-surface-50 dark:bg-surface-900/50 p-4 rounded-xl">
                                <p className="text-xs font-bold text-surface-500 uppercase mb-2">Total Hits</p>
                                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                    {cacheStats?.overall?.total_hits || 0}
                                </p>
                            </div>
                            <div className="bg-surface-50 dark:bg-surface-900/50 p-4 rounded-xl">
                                <p className="text-xs font-bold text-surface-500 uppercase mb-2">Total Requests</p>
                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                    {cacheStats?.overall?.total_requests || 0}
                                </p>
                            </div>
                            <div className="bg-surface-50 dark:bg-surface-900/50 p-4 rounded-xl">
                                <p className="text-xs font-bold text-surface-500 uppercase mb-2">Hit Rate</p>
                                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                    {cacheStats?.overall?.overall_hit_rate_percent || '0.0'}%
                                </p>
                            </div>
                            <div className="bg-surface-50 dark:bg-surface-900/50 p-4 rounded-xl">
                                <p className="text-xs font-bold text-surface-500 uppercase mb-2">Calls Saved</p>
                                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                                    {(cacheStats?.impact?.llm_api_calls_saved || 0) +
                                        (cacheStats?.impact?.external_api_calls_saved || 0)}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-6 border-t border-surface-200 dark:border-brand-primary/10">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-surface-950 dark:text-white">Estimated Benefits</p>
                                <div className="flex gap-4 text-xs text-surface-500">
                                    <span>💰 Cost Reduction: <span className="text-emerald-500 font-bold">{cacheStats?.impact?.estimated_cost_reduction_percent || '0'}%</span></span>
                                    <span>⚡ Speedup: <span className="text-blue-500 font-bold">{cacheStats?.impact?.estimated_response_time_improvement_percent || '0'}%</span></span>
                                </div>

                            </div>
                            <button
                                onClick={handleClearCache}
                                disabled={clearingCache}
                                className="flex items-center gap-2 px-6 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
                            >
                                <Trash2 className="w-4 h-4" />
                                {clearingCache ? 'Clearing...' : 'Clear All Caches'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Database Tab */}
            {activeTab === 'database' && (
                <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="glass rounded-2xl p-6 border-l-4 border-l-red-500">
                            <div className="flex items-center gap-2 mb-4">
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                                <h3 className="font-bold text-surface-950 dark:text-white">Critical Optimizations</h3>
                            </div>
                            <p className="text-4xl font-bold text-red-500">{criticalCount}</p>
                            <p className="text-surface-500 text-sm mt-2">Recommended indexes and caching strategies</p>
                        </div>

                        <div className="glass rounded-2xl p-6 border-l-4 border-l-amber-500">
                            <div className="flex items-center gap-2 mb-4">
                                <TrendingUp className="w-5 h-5 text-amber-500" />
                                <h3 className="font-bold text-surface-950 dark:text-white">High Priority Items</h3>
                            </div>
                            <p className="text-4xl font-bold text-amber-500">{highCount}</p>
                            <p className="text-surface-500 text-sm mt-2">Query optimization and async processing</p>
                        </div>
                    </div>

                    {/* Export Button */}
                    <div className="flex justify-end">
                        <button
                            onClick={handleExportReport}
                            className="flex items-center gap-2 px-6 py-2.5 bg-brand-primary text-white rounded-xl font-bold text-sm uppercase tracking-widest shadow-lg hover:shadow-brand-primary/25 hover:-translate-y-0.5 transition-all"
                        >
                            <Download className="w-4 h-4" />
                            Export Report
                        </button>
                    </div>

                    {/* Recommendations List */}
                    <div className="space-y-4">
                        {recommendations.map((rec, idx) => (
                            <div
                                key={idx}
                                className="glass rounded-2xl p-6"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <h4 className="font-bold text-surface-950 dark:text-white text-lg">{rec.category}</h4>
                                    <span
                                        className={cn(
                                            "px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider",
                                            rec.priority === 'CRITICAL' ? "bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400" :
                                                rec.priority === 'HIGH' ? "bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                                                    rec.priority === 'MEDIUM' ? "bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                                                        "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400"
                                        )}
                                    >
                                        {rec.priority}
                                    </span>
                                </div>
                                <p className="text-surface-600 dark:text-surface-300 mb-6 bg-surface-50 dark:bg-surface-900/50 p-4 rounded-xl">
                                    {rec.recommendation}
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
                                    <div>
                                        <p className="text-xs text-surface-500 uppercase font-bold mb-1">Effort</p>
                                        <p className="text-surface-950 dark:text-white font-medium">{rec.effort}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-surface-500 uppercase font-bold mb-1">Impact</p>
                                        <p className="text-surface-950 dark:text-white font-medium">{rec.impact}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-surface-500 uppercase font-bold mb-1">ROI</p>
                                        <p className="text-surface-950 dark:text-white font-medium">{rec.roi}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-surface-500 uppercase font-bold mb-1">Status</p>
                                        <p className="text-surface-950 dark:text-white font-medium">{rec.implementation || 'Pending'}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default AdminPerformanceDashboard;
