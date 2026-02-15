import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Activity,
    AlertTriangle,
    RefreshCw,
    Shield,
    Zap,
    Server
} from 'lucide-react';
import apiService from '../services/api';

interface DashboardMetrics {
    total_integrations: number;
    active_count: number;
    failed_count: number;
    avg_health_score: number;
    system_status: string;
}

interface IntegrationHealth {
    id: string;
    name: string;
    status: string;
    health_score: number;
    last_check: string;
    source: string;
    destination: string;
}

interface MonitorEvent {
    id: string;
    integration_id: string;
    action: string;
    status: string;
    details: any;
    timestamp: string;
    actor: string;
}

const MonitoringDashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState<DashboardMetrics>({
        total_integrations: 0,
        active_count: 0,
        failed_count: 0,
        avg_health_score: 100,
        system_status: 'healthy'
    });
    const [integrations, setIntegrations] = useState<IntegrationHealth[]>([]);
    const [events, setEvents] = useState<MonitorEvent[]>([]);

    const fetchData = async () => {
        try {
            const response = await apiService.getMonitoringDashboard(20);
            if (response.data.status === 'success') {
                setMetrics(response.data.metrics);
                setIntegrations(response.data.integrations);
                setEvents(response.data.recent_events);
            }
        } catch (error) {
            console.error('Failed to fetch monitoring dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Poll every 30 seconds
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'active':
            case 'healthy':
                return 'text-green-400 bg-green-500/10 border-green-500/20';
            case 'degraded':
            case 'warning':
                return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
            case 'critical':
            case 'failed':
            case 'error':
                return 'text-red-400 bg-red-500/10 border-red-500/20';
            default:
                return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
        }
    };

    const formatTime = (isoString: string) => {
        if (!isoString) return 'Never';
        return new Date(isoString).toLocaleString();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">System Monitor</h1>
                    <p className="text-surface-400 mt-1">Real-time health status and observability</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${metrics.system_status === 'healthy' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                        System Status: {metrics.system_status.toUpperCase()}
                    </span>
                    <button
                        onClick={fetchData}
                        className="p-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-400 hover:text-white transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="premium-card p-5">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-surface-400 text-sm font-medium">Active Integrations</p>
                            <h3 className="text-3xl font-bold text-white mt-2">{metrics.active_count}</h3>
                            <p className="text-xs text-surface-500 mt-1">/ {metrics.total_integrations} Total</p>
                        </div>
                        <div className="p-3 rounded-xl bg-brand-500/10">
                            <Activity className="w-6 h-6 text-brand-500" />
                        </div>
                    </div>
                </div>

                <div className="premium-card p-5">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-surface-400 text-sm font-medium">Avg. Health Score</p>
                            <h3 className="text-3xl font-bold text-white mt-2">{metrics.avg_health_score.toFixed(1)}%</h3>
                            <div className="w-full bg-surface-700 h-1.5 rounded-full mt-2 overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${metrics.avg_health_score > 80 ? 'bg-green-500' : 'bg-yellow-500'}`}
                                    style={{ width: `${metrics.avg_health_score}%` }}
                                />
                            </div>
                        </div>
                        <div className="p-3 rounded-xl bg-green-500/10">
                            <Shield className="w-6 h-6 text-green-500" />
                        </div>
                    </div>
                </div>

                <div className="premium-card p-5">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-surface-400 text-sm font-medium">Failed Integrations</p>
                            <h3 className="text-3xl font-bold text-white mt-2">{metrics.failed_count}</h3>
                            <p className="text-xs text-red-400 mt-1">Requires Attention</p>
                        </div>
                        <div className="p-3 rounded-xl bg-red-500/10">
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                        </div>
                    </div>
                </div>

                <div className="premium-card p-5">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-surface-400 text-sm font-medium">Self-Healing Events</p>
                            <h3 className="text-3xl font-bold text-white mt-2">{events.filter(e => e.action === 'self_healing_triggered').length}</h3>
                            <p className="text-xs text-surface-500 mt-1">Last 24 hours</p>
                        </div>
                        <div className="p-3 rounded-xl bg-purple-500/10">
                            <Zap className="w-6 h-6 text-purple-500" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Integration Health List */}
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-xl font-semibold text-white">Integration Health</h2>
                    <div className="grid gap-4">
                        {integrations.length === 0 ? (
                            <div className="premium-card p-8 text-center text-surface-400">
                                No active integrations found.
                            </div>
                        ) : (
                            integrations.map((integration) => (
                                <motion.div
                                    key={integration.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="premium-card p-5 flex items-center justify-between group hover:border-brand-500/30 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-xl border ${getStatusColor(integration.status)}`}>
                                            <Server className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white">{integration.name}</h3>
                                            <p className="text-sm text-surface-400">
                                                {integration.source} → {integration.destination}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <p className="text-xs text-surface-500 mb-1">Health Score</p>
                                            <span className={`text-lg font-bold ${integration.health_score > 90 ? 'text-green-400' :
                                                integration.health_score > 70 ? 'text-yellow-400' : 'text-red-400'
                                                }`}>
                                                {integration.health_score}%
                                            </span>
                                        </div>
                                        <div className="text-right hidden sm:block">
                                            <p className="text-xs text-surface-500 mb-1">Last Check</p>
                                            <span className="text-sm text-surface-300 font-mono">
                                                {formatTime(integration.last_check)}
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>

                {/* Event Log */}
                <div className="space-y-6">
                    <h2 className="text-xl font-semibold text-white">Activity Log</h2>
                    <div className="premium-card p-4 h-[600px] overflow-y-auto custom-scrollbar space-y-4">
                        {events.length === 0 ? (
                            <p className="text-surface-500 text-center py-4">No recent activity.</p>
                        ) : (
                            events.map((event) => (
                                <div key={event.id} className="relative pl-6 pb-2 border-l border-surface-700 last:border-0">
                                    <div className={`absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full ${event.status === 'failed' ? 'bg-red-500' : 'bg-brand-500'
                                        }`} />
                                    <div className="mb-1 flex justify-between items-start">
                                        <span className="text-sm font-semibold text-white capitalize">
                                            {event.action.replace(/_/g, ' ')}
                                        </span>
                                        <span className="text-xs text-surface-500">
                                            {new Date(event.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <p className="text-xs text-surface-400 mb-1">
                                        ID: {event.integration_id.substring(0, 8)}...
                                    </p>
                                    {event.details && (
                                        <div className="text-xs bg-surface-900/50 p-2 rounded border border-surface-700/50 text-surface-300 font-mono overflow-x-auto">
                                            {JSON.stringify(event.details, null, 2)}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MonitoringDashboard;
