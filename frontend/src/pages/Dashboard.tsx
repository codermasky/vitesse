import React from 'react';
import { motion } from 'framer-motion';
import {
    Zap,
    Activity,
    BrainCircuit,
    Settings as SettingsIcon,
    Bot,
    ArrowRight,
    Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAISettings } from '../contexts/SettingsContext';
import { cn } from '../services/utils';

const Dashboard: React.FC = () => {
    const { whitelabel } = useAISettings();

    const stats = [
        { label: 'Neural Throughput', value: '42.8 ops/s', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10' },
        { label: 'Agent IQ', value: '98.4%', icon: BrainCircuit, color: 'text-brand-500', bg: 'bg-brand-500/10' },
        { label: 'Latency', value: '124ms', icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    ];

    const actions = [
        { name: 'Mapper', desc: 'Configure API integrations', href: '/integrations', icon: Zap, color: 'brand' },
        { name: 'Settings', desc: 'System configuration', href: '/settings', icon: SettingsIcon, color: 'purple' },
    ];

    return (
        <div className="space-y-12">
            {/* Hero Section */}
            <section className="relative overflow-hidden rounded-[2.5rem] glass p-12 border border-brand-500/10">
                <div className="absolute top-0 right-0 p-8">
                    <Bot className="w-32 h-32 text-brand-500/5 animate-pulse-slow" />
                </div>

                <div className="relative z-10 space-y-6 max-w-2xl">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 text-xs font-bold uppercase tracking-widest"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        Next-Gen Agentic Intelligence
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-5xl lg:text-6xl font-black tracking-tight text-surface-950 dark:text-white leading-[1.1]"
                    >
                        Welcome to <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-500 to-brand-600">{whitelabel?.brand_name || 'Vitesse AI'}</span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-lg text-surface-600 dark:text-surface-400 font-medium"
                    >
                        Discover APIs, map data flows, and orchestrate seamless integrations with AI-powered automation.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center gap-4 pt-4"
                    >
                        <Link
                            to="/integrations"
                            className="px-8 py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl shadow-xl shadow-brand-500/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                        >
                            Launch Integrations <ArrowRight className="w-4 h-4" />
                        </Link>
                        <p className="text-sm font-bold text-surface-400 dark:text-surface-500 px-4 italic border-l border-surface-200 dark:border-surface-800">
                            Enterprise Integration Platform
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + (i * 0.1) }}
                        className="glass p-8 rounded-3xl border border-white/5 flex items-center justify-between group"
                    >
                        <div>
                            <p className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest mb-1">{stat.label}</p>
                            <h3 className="text-3xl font-black text-surface-950 dark:text-white tracking-tighter">{stat.value}</h3>
                        </div>
                        <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110", stat.bg, stat.color)}>
                            <stat.icon className="w-7 h-7" />
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Matrix View / Neural Viz Surprise */}
            <section className="glass rounded-[2.5rem] p-12 overflow-hidden relative">
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-500 via-transparent to-transparent blur-3xl rounded-full" />
                </div>

                <div className="flex flex-col md:flex-row items-center gap-12 relative z-10">
                    <div className="flex-1 space-y-6 text-center md:text-left">
                        <h2 className="text-4xl font-black text-surface-950 dark:text-white tracking-tight">API Integration Engine</h2>
                        <p className="text-surface-600 dark:text-surface-400 font-medium">
                            {whitelabel?.brand_name || 'Vitesse AI'} provides intelligent API discovery, field mapping, and automated integration deployment with enterprise-grade reliability.
                        </p>
                        <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                            {['API Discovery', 'Field Mapping', 'Auto Deploy', 'Health Monitoring'].map(tag => (
                                <span key={tag} className="px-3 py-1 bg-surface-100 dark:bg-white/5 border border-surface-200 dark:border-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest text-surface-500">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 grid grid-cols-1 gap-4 w-full">
                        {actions.map((action) => (
                            <Link key={action.name} to={action.href} className="flex items-center gap-4 p-4 glass hover:bg-white/10 transition-all rounded-2xl border border-white/5 group">
                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center",
                                    action.color === 'brand' ? 'bg-brand-500/10 text-brand-500' :
                                        action.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-500' :
                                            'bg-purple-500/10 text-purple-500')}>
                                    <action.icon className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-surface-950 dark:text-white text-sm">{action.name}</h4>
                                    <p className="text-[10px] text-surface-500">{action.desc}</p>
                                </div>
                                <ArrowRight className="w-4 h-4 text-surface-300 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                            </Link>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Dashboard;
