import React, { useState, useEffect } from 'react';
import apiService from '../services/api';
import { motion } from 'framer-motion';
import {
    Bot,
    Cpu,
    Search,
    Zap,
    Trophy,
    Timer,
    Database,
    History,
    Mail,
    ShieldCheck,
    FileText,

    Activity
} from 'lucide-react';
import SparkleTooltip from './SparkleTooltip';

interface Agent {
    name: string;
    description: string;
    capabilities: string[];
    status: string;
    success_rate: number;
    avg_time_ms: number;
    category: string;
}

const AgentGrid: React.FC = () => {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAgents = async () => {
            try {
                const response = await apiService.listAgents();
                setAgents(response.data.agents);
            } catch (error) {
                console.error('Failed to fetch agents:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAgents();
    }, []);

    const getAgentIcon = (name: string) => {
        if (name.includes('Analyst')) return Search;
        if (name.includes('Reviewer')) return ShieldCheck;
        if (name.includes('Writer')) return FileText;
        if (name.includes('Sentinel')) return Activity;
        if (name.includes('Monitor')) return Activity;
        if (name.includes('Healing') || name.includes('Healer')) return ShieldCheck;
        if (name.includes('Processing')) return Cpu;
        if (name.includes('Confidence')) return Trophy;
        if (name.includes('Email') || name.includes('Ingestion')) return Mail;
        return Bot;
    };

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="premium-card animate-pulse">
                        <div className="flex gap-6">
                            <div className="w-16 h-16 bg-brand-500/20 dark:bg-brand-500/5 rounded-2xl" />
                            <div className="flex-1 space-y-4">
                                <div className="h-5 bg-brand-500/20 dark:bg-brand-500/5 rounded w-1/3" />
                                <div className="h-4 bg-brand-500/20 dark:bg-brand-500/5 rounded w-3/4" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {agents.map((agent, idx) => {
                const Icon = getAgentIcon(agent.name);
                return (
                    <motion.div
                        key={agent.name}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.1 }}
                        className="group premium-card relative overflow-hidden"
                    >

                        <div className="relative z-10">
                            <div className="flex items-start justify-between gap-4 mb-6">
                                <div className="flex gap-5">
                                    <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20 group-hover:border-brand-500/40 transition-all duration-500 flex-shrink-0">
                                        <Icon className="w-8 h-8 text-brand-600 dark:text-brand-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-surface-950 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors duration-300">
                                            {agent.name}
                                        </h4>
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-surface-500 dark:text-brand-500/60 mt-0.5">
                                            {agent.category || "Generalist"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md">
                                    <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-tight">Active</span>
                                </div>
                            </div>

                            <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed mb-8 line-clamp-2">
                                {agent.description}
                            </p>

                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <div className="glass rounded-2xl p-4 border border-brand-500/30 dark:border-brand-500/5">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Trophy className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                                            <p className="text-[10px] text-surface-500 uppercase font-black">Success Rate</p>
                                            <SparkleTooltip content="This success rate is calculated across the last 500 tasks. AI recommends focusing on 'Processing' tasks to improve this." />
                                        </div>
                                    </div>
                                    <p className="text-xl font-bold text-surface-950 dark:text-white tracking-tight">
                                        {((agent.success_rate || 0.95) * 100).toFixed(0)}%
                                    </p>
                                </div>
                                <div className="glass rounded-2xl p-4 border border-brand-500/30 dark:border-brand-500/5">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Timer className="w-3 h-3 text-brand-500 dark:text-brand-400" />
                                            <p className="text-[10px] text-surface-500 uppercase font-black">Avg Response</p>
                                        </div>
                                    </div>
                                    <p className="text-xl font-bold text-surface-950 dark:text-white tracking-tight">
                                        {agent.avg_time_ms || 1200}ms
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-6">
                                <div>
                                    <p className="text-[10px] text-surface-500 dark:text-surface-600 uppercase font-black mb-3 tracking-widest flex items-center gap-2">
                                        <Zap className="w-3 h-3" />
                                        Core Capabilities
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {agent.capabilities.map((cap) => (
                                            <span
                                                key={cap}
                                                className="text-[10px] font-bold px-3 py-1.5 rounded-xl bg-brand-500/10 dark:bg-brand-500/[0.03] text-surface-600 dark:text-surface-300 border border-brand-500/30 dark:border-brand-500/5 hover:border-brand-500/30 hover:text-brand-600 dark:hover:text-brand-400 transition-all cursor-default"
                                            >
                                                {cap.replace(/_/g, ' ')}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 pt-6 border-t border-brand-500/30 dark:border-brand-500/5">
                                    <div className="flex items-center gap-2">
                                        <Database className="w-4 h-4 text-surface-400 dark:text-surface-500" />
                                        <span className="text-[10px] text-surface-500 font-bold uppercase">Enterprise KB Linked</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <History className="w-4 h-4 text-surface-400 dark:text-surface-500" />
                                        <span className="text-[10px] text-surface-500 font-bold uppercase">Learning Enabled</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Background Aura */}
                        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-brand-500/5 blur-[100px] rounded-full pointer-events-none group-hover:bg-brand-500/10 transition-all duration-700" />
                    </motion.div>
                );
            })}
        </div >
    );
};

export default AgentGrid;
