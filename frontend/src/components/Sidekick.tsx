import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { motion } from 'framer-motion';
import {
    Sparkles,
    ChevronRight,
    ChevronLeft,
    Lightbulb,
    Zap,
    ArrowRight,
    Target,
    MousePointer2,
    Loader2,
    RefreshCcw
} from 'lucide-react';
import { cn } from '../services/utils';

interface Insight {
    id: string;
    type: 'suggestion' | 'insight' | 'action';
    title: string;
    description: string;
    icon: string;
}

const iconMap: Record<string, any> = {
    sparkles: Sparkles,
    lightbulb: Lightbulb,
    zap: Zap,
    target: Target
};

import { useAISettings } from '../contexts/SettingsContext';

const Sidekick: React.FC = () => {
    const { aiSettings } = useAISettings();
    const [isOpen, setIsOpen] = useState(true);
    const location = useLocation();
    const [insights, setInsights] = useState<Insight[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<WebSocket | null>(null);
    const sessionIdRef = useRef<string>(
        localStorage.getItem('sidekick_session_id') || (() => {
            const newId = Math.random().toString(36).substring(7);
            localStorage.setItem('sidekick_session_id', newId);
            return newId;
        })()
    );

    useEffect(() => {
        if (isOpen && !socketRef.current) {
            initializeSidekick();
        }
    }, [isOpen]);

    // Automatically refresh insights when the location changes, if enabled
    useEffect(() => {
        if (aiSettings.sidekick.autoRefresh && isConnected && socketRef.current) {
            fetchInsights(socketRef.current);
        }
    }, [location.pathname, isConnected, aiSettings.sidekick.autoRefresh]);

    const getPageContext = () => {
        const headers = Array.from(document.querySelectorAll('h1, h2, h3'))
            .map(h => h.textContent?.trim())
            .filter(Boolean)
            .slice(0, 5);

        return {
            path: location.pathname,
            title: document.title,
            visible_headers: headers,
            timestamp: new Date().toISOString()
        };
    };

    const initializeSidekick = () => {
        const apiUrl = (import.meta.env.VITE_API_URL || "http://localhost:8002");
        const wsProtocol = apiUrl.startsWith("https") ? "wss" : "ws";
        const token = localStorage.getItem('access_token');

        // Using session_type=sidekick for structured JSON insights
        const wsUrl = `${wsProtocol}://${apiUrl.split("://")[1]}/api/v1/chat/ws/${sessionIdRef.current}?session_type=sidekick${token ? `&token=${token}` : ''}`;

        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            setIsConnected(true);
            setIsLoading(false); // Reset loading on open in case it was stuck
            console.log('Sidekick connected');
            // Trigger initial insights pull
            fetchInsights(socket);
        };

        socket.onclose = () => {
            setIsConnected(false);
            setIsLoading(false); // Clear loading if closed
            socketRef.current = null;
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'ai_response' || data.type === 'error') {
                    setIsLoading(false); // ALWAYS clear loading on response or error

                    if (data.type === 'error') {
                        console.error('Sidekick error:', data.data);
                        return;
                    }

                    try {
                        // Attempt to parse the message as JSON list of insights
                        const rawMessage = data.data.message;
                        // Handle cases where the LLM might wrap the JSON in markdown blocks
                        const jsonStr = rawMessage.includes('```json')
                            ? rawMessage.split('```json')[1].split('```')[0].trim()
                            : rawMessage.includes('```')
                                ? rawMessage.split('```')[1].split('```')[0].trim()
                                : rawMessage;

                        const parsed = JSON.parse(jsonStr);
                        if (parsed.insights) {
                            setInsights(parsed.insights);
                        }
                    } catch (e) {
                        console.warn('Failed to parse Sidekick JSON, falling back to raw message', e);
                        // Fallback for non-JSON responses
                        setInsights([{
                            id: Math.random().toString(36).substring(7),
                            type: 'insight',
                            title: 'AI Insight',
                            description: data.data.message,
                            icon: 'sparkles'
                        }]);
                    }
                }
            } catch (e) {
                console.error('Failed to parse Sidekick message:', e);
                setIsLoading(false);
            }
        };

        socket.onerror = () => {
            setIsConnected(false);
            setIsLoading(false);
        };

        socketRef.current = socket;
    };

    const fetchInsights = (socket: WebSocket) => {
        if (socket.readyState !== WebSocket.OPEN) return;

        const context = getPageContext();
        setIsLoading(true);
        socket.send(JSON.stringify({
            type: 'user_message',
            data: {
                message: `Analyze my current environment and provide contextual insights. I am currently on path: ${context.path}. Page title: ${context.title}. Visible headers: ${context.visible_headers.join(', ')}.`,
                verbosity: aiSettings.sidekick.verbosity,
                // Default to 60 minutes if undefined, convert to seconds
                cache_ttl: (aiSettings.sidekick.cacheDuration ?? 60) * 60,
                context: context
            }
        }));
    };

    const handleRefresh = () => {
        if (socketRef.current && isConnected) {
            fetchInsights(socketRef.current);
        } else {
            initializeSidekick();
        }
    };

    const [inputValue, setInputValue] = useState('');

    const handleQuickAsk = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || !isConnected || !socketRef.current) return;

        const context = getPageContext();
        setIsLoading(true);
        socketRef.current.send(JSON.stringify({
            type: 'user_message',
            data: {
                message: `${inputValue} (Context: Path=${context.path}, Title=${context.title})`,
                verbosity: aiSettings.sidekick.verbosity,
                context: context
            }
        }));
        setInputValue('');
    };

    const handleInsightClick = (insight: Insight) => {
        if (!socketRef.current || !isConnected) return;

        const context = getPageContext();
        setIsLoading(true);

        // Determine the message based on insight type
        let message = `I want to take action on: ${insight.title}`;
        if (insight.type === 'action') {
            message = `Perform or guide me through this action: ${insight.title}. ${insight.description}`;
        } else if (insight.type === 'suggestion') {
            message = `I want to follow this suggestion: ${insight.title}. ${insight.description}`;
        } else {
            message = `Tell me more about: ${insight.title}. ${insight.description}`;
        }

        socketRef.current.send(JSON.stringify({
            type: 'user_message',
            data: {
                message: `${message} (Context: Path=${context.path})`,
                verbosity: aiSettings.sidekick.verbosity,
                context: context
            }
        }));
    };

    return (
        <div className={cn(
            "fixed right-0 top-0 h-screen z-40 flex items-center transition-all duration-500",
            isOpen ? "w-80" : "w-0"
        )}>
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "absolute left-0 transurface-x-[-100%] py-4 px-1 bg-surface-100 dark:bg-surface-900 border border-r-0 border-surface-200 dark:border-brand-500/10 rounded-l-xl shadow-xl transition-all hover:bg-surface-200 dark:hover:bg-surface-800 group",
                    !isOpen && "left-[-24px] rounded-l-md"
                )}
            >
                {isOpen ? (
                    <ChevronRight className="w-4 h-4 text-surface-400 group-hover:text-brand-500" />
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <Sparkles className="w-5 h-5 text-brand-500 animate-pulse" />
                        <div className="h-12 w-px bg-surface-300 dark:bg-surface-700" />
                        <ChevronLeft className="w-4 h-4 text-surface-400 group-hover:text-brand-500" />
                    </div>
                )}
            </button>

            {/* Sidekick Panel */}
            <div className={cn(
                "h-[calc(100vh-2rem)] w-full glass m-4 mr-6 rounded-3xl border border-surface-200 dark:border-brand-500/10 overflow-hidden flex flex-col shadow-2xl transition-all duration-500",
                !isOpen && "opacity-0 scale-95 transurface-x-10 pointer-events-none"
            )}>
                {/* Header */}
                <div className="p-6 border-b border-surface-100 dark:border-white/5 bg-gradient-to-br from-brand-500/5 to-transparent">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-surface-950 dark:text-white">Vitesse Assistant</h2>
                                <div className="flex items-center gap-1.5">
                                    <div className={cn("w-1 h-1 rounded-full", isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400")} />
                                    <span className="text-[8px] text-brand-500 font-medium tracking-wider uppercase">{isConnected ? "Online" : "Offline"}</span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={handleRefresh}
                            disabled={isLoading}
                            className="p-2 text-surface-400 hover:text-brand-500 transition-colors rounded-lg hover:bg-brand-500/5"
                        >
                            <RefreshCcw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                    {isLoading && insights.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
                            <Loader2 className="w-8 h-8 text-brand-500 animate-spin opacity-50" />
                            <p className="text-xs text-surface-500 font-medium">Gathering insights...</p>
                        </div>
                    ) : insights.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-center px-6">
                            <div className="w-12 h-12 rounded-2xl bg-surface-100 dark:bg-white/5 flex items-center justify-center">
                                <Target className="w-6 h-6 text-surface-300" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-surface-900 dark:text-white">Ready for Input</p>
                                <p className="text-[10px] text-surface-500 mt-1">Start working or ask me a question.</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="p-4 rounded-2xl bg-brand-500/10 border border-brand-500/20 space-y-2">
                                <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400">
                                    <Target className="w-4 h-4" />
                                    <span className="text-xs font-bold uppercase tracking-tight">Current Focus</span>
                                </div>
                                <p className="text-xs text-surface-600 dark:text-surface-400 leading-relaxed">
                                    Collaborating on your Vitesse workspace. Use the input below to ask me anything.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <h3 className="px-2 text-[10px] font-bold text-surface-400 uppercase tracking-widest flex items-center justify-between">
                                    <span>Contextual Insights</span>
                                    {isLoading && <Loader2 className="w-3 h-3 animate-spin text-brand-500" />}
                                </h3>
                                {insights.map((insight) => {
                                    const Icon = iconMap[insight.icon] || Sparkles;
                                    return (
                                        <motion.div
                                            key={insight.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            onClick={() => handleInsightClick(insight)}
                                            className="group p-4 rounded-2xl bg-white/50 dark:bg-white/5 border border-surface-200 dark:border-white/5 hover:border-brand-500/30 hover:shadow-lg hover:shadow-brand-500/5 transition-all cursor-pointer"
                                        >
                                            <div className="flex gap-3">
                                                <div className={cn(
                                                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                                                    insight.type === 'suggestion' ? "bg-amber-500/10 text-amber-500" :
                                                        insight.type === 'action' ? "bg-emerald-500/10 text-emerald-500" :
                                                            "bg-brand-500/10 text-brand-500"
                                                )}>
                                                    <Icon className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-xs font-bold text-surface-950 dark:text-surface-100 group-hover:text-brand-500 transition-colors">
                                                        {insight.title}
                                                    </h4>
                                                    <p className="text-xs text-surface-500 mt-1 leading-relaxed">
                                                        {insight.description}
                                                    </p>
                                                    <div className="mt-3 flex items-center text-[10px] font-bold text-brand-500 gap-1 opacity-0 group-hover:opacity-100 transition-all transurface-x-[-10px] group-hover:transurface-x-0">
                                                        TAKE ACTION <ArrowRight className="w-3 h-3" />
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer Input Area */}
                <div className="p-4 border-t border-surface-100 dark:border-white/5 bg-surface-50/50 dark:bg-surface-900/50">
                    <form
                        onSubmit={handleQuickAsk}
                        className="relative group"
                    >
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Ask Vitesse Assistant..."
                            disabled={isLoading || !isConnected}
                            className="w-full bg-surface-100 dark:bg-white/5 border border-surface-200 dark:border-white/10 rounded-xl py-3 pl-4 pr-12 text-xs text-surface-900 dark:text-white placeholder:text-surface-400 focus:outline-none focus:border-brand-500/50 transition-all disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !isConnected || !inputValue.trim()}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-surface-950 dark:bg-white text-white dark:text-surface-950 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-30 flex items-center justify-center"
                        >
                            <MousePointer2 className="w-3 h-3" />
                        </button>
                    </form>
                    <p className="text-[8px] text-surface-400 mt-2 px-1 text-center">
                        Proactive insights are based on your current page view.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Sidekick;
