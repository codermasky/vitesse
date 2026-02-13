import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Search, Filter, Clock, DollarSign, Zap, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import apiService from '../services/api';
import { cn } from '../services/utils';

interface LangfuseTrace {
    id: string;
    name: string;
    timestamp: string;
    metadata: {
        agent_id?: string;
        operation?: string;
        credo_prompt_template_id?: string;
        credo_prompt_template_name?: string;
        credo_prompt_version?: number;
        deal_id?: string;
        [key: string]: any;
    };
    input?: any;
    output?: any;
    latency?: number;
    cost?: number;
    status?: 'success' | 'error' | 'pending';
    model?: string;
    tokens?: {
        input?: number;
        output?: number;
        total?: number;
    };
}

const LangfuseTraces: React.FC = () => {
    const [traces, setTraces] = useState<LangfuseTrace[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTrace, setSelectedTrace] = useState<LangfuseTrace | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterAgent, setFilterAgent] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    useEffect(() => {
        fetchTraces();
    }, []);

    const fetchTraces = async () => {
        try {
            setLoading(true);
            const response = await apiService.get('/api/langfuse/traces');
            setTraces(response.data.traces || []);
        } catch (error) {
            console.error('Failed to fetch traces:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredTraces = traces.filter(trace => {
        const matchesSearch =
            trace.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            trace.metadata?.agent_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            trace.metadata?.credo_prompt_template_name?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesAgent = filterAgent === 'all' || trace.metadata?.agent_id === filterAgent;
        const matchesStatus = filterStatus === 'all' || trace.status === filterStatus;

        return matchesSearch && matchesAgent && matchesStatus;
    });

    const uniqueAgents = Array.from(new Set(traces.map(t => t.metadata?.agent_id).filter(Boolean)));

    const getStatusIcon = (status?: string) => {
        switch (status) {
            case 'success':
                return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case 'error':
                return <XCircle className="w-4 h-4 text-red-500" />;
            default:
                return <AlertCircle className="w-4 h-4 text-yellow-500" />;
        }
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleString();
    };

    const formatCost = (cost?: number) => {
        if (!cost) return '$0.00';
        return `$${cost.toFixed(4)}`;
    };

    const formatLatency = (latency?: number) => {
        if (!latency) return '0ms';
        return `${latency.toFixed(0)}ms`;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Activity className="w-6 h-6 text-brand-primary" />
                    <div>
                        <h2 className="text-xl font-black text-surface-950 dark:text-white">
                            LLM Traces
                        </h2>
                        <p className="text-sm text-surface-600 dark:text-surface-400">
                            View and debug LLM execution traces from Langfuse
                        </p>
                    </div>
                </div>
                <button
                    onClick={fetchTraces}
                    className="px-4 py-2 rounded-xl bg-brand-primary text-white text-sm font-bold hover:bg-brand-600 transition-colors"
                >
                    Refresh
                </button>
            </div>

            {/* Filters */}
            <div className="premium-card p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                        <input
                            type="text"
                            placeholder="Search traces..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-brand-100 dark:border-brand-500/20 bg-white dark:bg-brand-500/5 text-surface-950 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                        />
                    </div>

                    {/* Agent Filter */}
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                        <select
                            value={filterAgent}
                            onChange={(e) => setFilterAgent(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-brand-100 dark:border-brand-500/20 bg-white dark:bg-brand-500/5 text-surface-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                        >
                            <option value="all">All Agents</option>
                            {uniqueAgents.map(agent => (
                                <option key={agent} value={agent}>{agent}</option>
                            ))}
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-brand-100 dark:border-brand-500/20 bg-white dark:bg-brand-500/5 text-surface-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                        >
                            <option value="all">All Status</option>
                            <option value="success">Success</option>
                            <option value="error">Error</option>
                            <option value="pending">Pending</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Traces List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Trace Cards */}
                <div className="space-y-3">
                    {loading ? (
                        <div className="premium-card p-8 text-center">
                            <div className="animate-spin w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                            <p className="text-surface-600 dark:text-surface-400">Loading traces...</p>
                        </div>
                    ) : filteredTraces.length === 0 ? (
                        <div className="premium-card p-8 text-center">
                            <Activity className="w-12 h-12 text-surface-300 dark:text-surface-600 mx-auto mb-4" />
                            <p className="text-surface-600 dark:text-surface-400">No traces found</p>
                        </div>
                    ) : (
                        filteredTraces.map((trace) => (
                            <motion.div
                                key={trace.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={cn(
                                    "premium-card p-4 cursor-pointer transition-all hover:shadow-lg",
                                    selectedTrace?.id === trace.id && "ring-2 ring-brand-primary"
                                )}
                                onClick={() => setSelectedTrace(trace)}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        {getStatusIcon(trace.status)}
                                        <h3 className="font-bold text-surface-950 dark:text-white">
                                            {trace.name}
                                        </h3>
                                    </div>
                                    <span className="text-xs text-surface-500 dark:text-surface-400">
                                        {formatTimestamp(trace.timestamp)}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    {trace.metadata?.agent_id && (
                                        <div className="flex items-center gap-1 text-surface-600 dark:text-surface-400">
                                            <Zap className="w-3 h-3" />
                                            <span>{trace.metadata.agent_id}</span>
                                        </div>
                                    )}
                                    {trace.latency && (
                                        <div className="flex items-center gap-1 text-surface-600 dark:text-surface-400">
                                            <Clock className="w-3 h-3" />
                                            <span>{formatLatency(trace.latency)}</span>
                                        </div>
                                    )}
                                    {trace.cost && (
                                        <div className="flex items-center gap-1 text-surface-600 dark:text-surface-400">
                                            <DollarSign className="w-3 h-3" />
                                            <span>{formatCost(trace.cost)}</span>
                                        </div>
                                    )}
                                    {trace.metadata?.credo_prompt_template_name && (
                                        <div className="col-span-2 px-2 py-1 rounded bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 truncate">
                                            📝 {trace.metadata.credo_prompt_template_name} v{trace.metadata.credo_prompt_version}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>

                {/* Trace Details */}
                <div className="premium-card p-6 sticky top-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                    {selectedTrace ? (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-black text-surface-950 dark:text-white mb-4">
                                    Trace Details
                                </h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase">
                                            Trace ID
                                        </label>
                                        <p className="text-sm text-surface-950 dark:text-white font-mono">
                                            {selectedTrace.id}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase">
                                            Model
                                        </label>
                                        <p className="text-sm text-surface-950 dark:text-white">
                                            {selectedTrace.model || 'N/A'}
                                        </p>
                                    </div>
                                    {selectedTrace.tokens && (
                                        <div>
                                            <label className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase">
                                                Tokens
                                            </label>
                                            <p className="text-sm text-surface-950 dark:text-white">
                                                Input: {selectedTrace.tokens.input || 0} |
                                                Output: {selectedTrace.tokens.output || 0} |
                                                Total: {selectedTrace.tokens.total || 0}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-sm font-black text-surface-950 dark:text-white mb-2">
                                    Metadata
                                </h4>
                                <div className="bg-surface-50 dark:bg-brand-500/5 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                                    <pre className="text-surface-700 dark:text-surface-300">
                                        {JSON.stringify(selectedTrace.metadata, null, 2)}
                                    </pre>
                                </div>
                            </div>

                            {selectedTrace.input && (
                                <div>
                                    <h4 className="text-sm font-black text-surface-950 dark:text-white mb-2">
                                        Input
                                    </h4>
                                    <div className="bg-surface-50 dark:bg-brand-500/5 rounded-lg p-3 text-xs max-h-48 overflow-y-auto">
                                        <pre className="text-surface-700 dark:text-surface-300 whitespace-pre-wrap">
                                            {typeof selectedTrace.input === 'string'
                                                ? selectedTrace.input
                                                : JSON.stringify(selectedTrace.input, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            )}

                            {selectedTrace.output && (
                                <div>
                                    <h4 className="text-sm font-black text-surface-950 dark:text-white mb-2">
                                        Output
                                    </h4>
                                    <div className="bg-surface-50 dark:bg-brand-500/5 rounded-lg p-3 text-xs max-h-48 overflow-y-auto">
                                        <pre className="text-surface-700 dark:text-surface-300 whitespace-pre-wrap">
                                            {typeof selectedTrace.output === 'string'
                                                ? selectedTrace.output
                                                : JSON.stringify(selectedTrace.output, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <Activity className="w-12 h-12 text-surface-300 dark:text-surface-600 mx-auto mb-4" />
                            <p className="text-surface-600 dark:text-surface-400">
                                Select a trace to view details
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LangfuseTraces;
