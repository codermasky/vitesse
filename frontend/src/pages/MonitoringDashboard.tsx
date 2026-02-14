import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Activity,
    CheckCircle,
    AlertTriangle,
    RefreshCw,
    Shield,
    Zap
} from 'lucide-react';

interface HealthMetric {
    integration_id: string;
    name: string;
    status: 'healthy' | 'degraded' | 'critical';
    health_score: number;
    success_rate: number;
    last_check: string;
    active_incidents: number;
}

interface SelfHealingEvent {
    id: string;
    integration_id: string;
    integration_name: string;
    timestamp: string;
    reason: string;
    action_taken: string;
    outcome: 'success' | 'failed' | 'pending';
}

const MonitoringDashboard: React.FC = () => {
    const [metrics, setMetrics] = useState<HealthMetric[]>([]);
    const [events, setEvents] = useState<SelfHealingEvent[]>([]);

    useEffect(() => {
        // Mock data for now until backend endpoints are fully connected to a real DB
        const mockMetrics: HealthMetric[] = [
            {
                integration_id: '1',
                name: 'CoinGecko API',
                status: 'healthy',
                health_score: 98,
                success_rate: 99.5,
                last_check: new Date().toISOString(),
                active_incidents: 0
            },
            {
                integration_id: '2',
                name: 'OpenWeatherMap',
                status: 'degraded',
                health_score: 75,
                success_rate: 82.3,
                last_check: new Date().toISOString(),
                active_incidents: 1
            },
            {
                integration_id: '3',
                name: 'Stripe Payments',
                status: 'healthy',
                health_score: 100,
                success_rate: 100,
                last_check: new Date().toISOString(),
                active_incidents: 0
            }
        ];

        const mockEvents: SelfHealingEvent[] = [
            {
                id: 'evt-1',
                integration_id: '2',
                integration_name: 'OpenWeatherMap',
                timestamp: new Date(Date.now() - 3600000).toISOString(),
                reason: 'Schema Validation Failed',
                action_taken: 'Remap Fields',
                outcome: 'success'
            }
        ];

        setMetrics(mockMetrics);
        setEvents(mockEvents);
    }, []);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy': return 'text-green-500 bg-green-500/10 border-green-500/20';
            case 'degraded': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
            case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/20';
            default: return 'text-brand-400 bg-brand-500/10 border-brand-500/20';
        }
    };

    return (
        <div className="space-y-12">
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
                        <h1 className="text-5xl lg:text-6xl font-black tracking-tight text-surface-950 dark:text-white leading-[1.1]">Integration Monitor</h1>
                        <p className="text-lg text-surface-600 dark:text-surface-400 font-medium">Real-time health tracking and autonomous self-healing status.</p>
                    </div>
                </div>
            </motion.div>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass p-6 rounded-3xl border border-white/5"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-green-500/10 text-green-500">
                            <CheckCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-surface-950 dark:text-white">
                                {metrics.filter(m => m.status === 'healthy').length}
                            </h3>
                            <p className="text-sm text-surface-500 dark:text-surface-400">Healthy Integrations</p>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass p-6 rounded-3xl border border-white/5"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-yellow-500/10 text-yellow-500">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-surface-950 dark:text-white">
                                {metrics.filter(m => m.status === 'degraded').length}
                            </h3>
                            <p className="text-sm text-surface-500 dark:text-surface-400">Degraded / Warnings</p>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass p-6 rounded-3xl border border-white/5"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-brand-500/10 text-brand-500">
                            <Shield className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-surface-950 dark:text-white">
                                {events.length}
                            </h3>
                            <p className="text-sm text-surface-500 dark:text-surface-400">Self-Healing Actions</p>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Integration List */}
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-3xl font-black tracking-tight text-surface-950 dark:text-white flex items-center gap-2">
                        <Zap className="w-5 h-5 text-brand-500" />
                        Active Integrations
                    </h2>
                    <div className="space-y-4">
                        {metrics.map((metric, idx) => (
                            <motion.div
                                key={metric.integration_id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="glass p-6 rounded-2xl border border-white/5 hover:border-brand-500/30 transition-all group"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-lg text-surface-950 dark:text-white">{metric.name}</h3>
                                        <p className="text-sm text-surface-500 dark:text-surface-400">ID: {metric.integration_id}</p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold border capitalize ${getStatusColor(metric.status)}`}>
                                        {metric.status}
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <p className="text-xs text-surface-500 mb-1">Health Score</p>
                                        <div className="h-2 bg-surface-200 dark:bg-surface-800 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${metric.health_score > 90 ? 'bg-green-500' : metric.health_score > 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                style={{ width: `${metric.health_score}%` }}
                                            />
                                        </div>
                                        <p className="text-right text-xs mt-1 font-mono">{metric.health_score}%</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-surface-500 mb-1">Success Rate</p>
                                        <p className="font-mono text-sm">{metric.success_rate}%</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-surface-500 mb-1">Incidents</p>
                                        <p className="font-mono text-sm">{metric.active_incidents}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Right Column: Recent Activity / Self Healing */}
                <div className="space-y-6">
                    <h2 className="text-3xl font-black tracking-tight text-surface-950 dark:text-white flex items-center gap-2">
                        <RefreshCw className="w-5 h-5 text-brand-500" />
                        Healing Events
                    </h2>
                    <div className="glass rounded-2xl p-4 border border-white/5 h-full max-h-[600px] overflow-y-auto custom-scrollbar">
                        {events.length === 0 ? (
                            <p className="text-center text-surface-500 py-10">No recent healing events.</p>
                        ) : (
                            <div className="space-y-4">
                                {events.map((event) => (
                                    <motion.div
                                        key={event.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="p-4 rounded-xl bg-surface-50 dark:bg-surface-900/50 border border-surface-200 dark:border-white/5"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-bold text-brand-500">{event.integration_name}</span>
                                            <span className="text-[10px] text-surface-400">{new Date(event.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                        <p className="text-sm font-medium text-surface-900 dark:text-white mb-1">{event.action_taken}</p>
                                        <p className="text-xs text-surface-500 mb-3">Reason: {event.reason}</p>
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${event.outcome === 'success' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                                            {event.outcome}
                                        </span>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MonitoringDashboard;
