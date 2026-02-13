import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bot,

    X,
    Send,
    Sparkles,
    Loader2
} from 'lucide-react';
import { cn } from '../services/utils';
import ReactMarkdown from 'react-markdown';
import './Wayfinder.css';


interface Message {

    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

import { useAISettings } from '../contexts/SettingsContext';

const Wayfinder: React.FC = () => {
    const { aiSettings } = useAISettings();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>(() => {
        if (aiSettings.wayfinder.showWelcome) {
            return [
                {
                    id: 'welcome',
                    role: 'assistant',
                    content: "Hi! I'm your **Vitesse Navigator**. I can help you discover APIs, map data flows, and automate integrations. Ask me anything about how to use Vitesse!",
                    timestamp: new Date()
                }
            ];
        }
        return [];
    });
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<WebSocket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const sessionIdRef = useRef<string>(
        localStorage.getItem('wayfinder_session_id') || (() => {
            const newId = Math.random().toString(36).substring(7);
            localStorage.setItem('wayfinder_session_id', newId);
            return newId;
        })()
    );


    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
            if (!socketRef.current) {
                initializeChat();
            }
        }
    }, [isOpen, messages]);

    const initializeChat = () => {
        const apiUrl = (import.meta.env.VITE_API_URL || "http://localhost:8002");
        const wsProtocol = apiUrl.startsWith("https") ? "wss" : "ws";
        const token = localStorage.getItem('access_token');
        // Using session_type=guide to trigger the specialized system prompt
        const wsUrl = `${wsProtocol}://${apiUrl.split("://")[1]}/api/v1/chat/ws/${sessionIdRef.current}?session_type=guide${token ? `&token=${token}` : ''}`;

        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            setIsConnected(true);
            console.log('Wayfinder connected');
        };

        socket.onclose = () => {
            setIsConnected(false);
            socketRef.current = null;
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'ai_response') {
                    const aiMsg: Message = {
                        id: Math.random().toString(36).substring(7),
                        role: 'assistant',
                        content: data.data.message,
                        timestamp: new Date()
                    };
                    setMessages(prev => {
                        // Avoid duplicates if history is reloaded
                        if (prev.some(m => m.content === aiMsg.content && (new Date().getTime() - m.timestamp.getTime() < 1000))) {
                            return prev;
                        }
                        return [...prev, aiMsg];
                    });
                    setIsLoading(false);

                } else if (data.type === 'history') {
                    const historyMessages: Message[] = data.data.messages.map((msg: any) => ({
                        id: Math.random().toString(36).substring(7),
                        role: msg.role,
                        content: msg.content,
                        timestamp: new Date() // Ideally would use msg.timestamp if available
                    }));
                    setMessages(prev => {
                        // Combine history with welcome message, avoid duplicates
                        const welcome = prev[0];
                        return [welcome, ...historyMessages];
                    });
                }
            } catch (e) {
                console.error('Failed to parse message:', e);
            }
        };

        socket.onerror = () => {
            setIsConnected(false);
            setIsLoading(false);
        };

        socketRef.current = socket;
    };

    const handleSendMessage = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim() || !socketRef.current || !isConnected) return;

        const userMsg: Message = {
            id: Math.random().toString(36).substring(7),
            role: 'user',
            content: inputValue.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        socketRef.current.send(JSON.stringify({
            type: 'user_message',
            data: {
                message: inputValue.trim(),
                verbosity: 'concise'
            }
        }));

        setInputValue('');
    };

    const quickActions = [
        "How do I upload?",
        "Where is settings?",
        "Compare agents",
    ];

    return (
        <div className="agentstack-agent-container">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 100, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 100, scale: 0.8 }}
                        className="agentstack-agent-window shadow-2xl"
                    >
                        {/* Header */}
                        <div className="agent-header">
                            <div className="flex items-center gap-3">
                                <div className="agent-icon-small">
                                    <Sparkles className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">Vitesse Navigator</h3>
                                    <div className="flex items-center gap-1.5">
                                        <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isConnected ? "bg-emerald-400" : "bg-red-400")} />
                                        <span className="text-[10px] text-brand-100 font-medium">{isConnected ? "Online" : "Connecting..."}</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 text-brand-100 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="agent-messages custom-scrollbar">
                            {messages.map((msg) => (
                                <div key={msg.id} className={cn("message-wrapper", msg.role === 'user' ? "user" : "assistant")}>
                                    <div className="message-bubble">
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    </div>
                                </div>
                            ))}

                            {isLoading && (
                                <div className="message-wrapper assistant">
                                    <div className="message-bubble loading">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Quick Actions */}
                        {messages.length === 1 && !isLoading && (
                            <div className="px-4 pb-2 flex flex-wrap gap-2">
                                {quickActions.map(action => (
                                    <button
                                        key={action}
                                        onClick={() => {
                                            setInputValue(action);
                                            // Using a timeout to ensure state update before sending
                                            setTimeout(() => handleSendMessage(), 100);
                                        }}
                                        className="text-[10px] font-bold py-1.5 px-3 bg-brand-50/10 hover:bg-brand-50/20 text-surface-900 dark:text-white border border-white/10 dark:border-white/10 rounded-full transition-all"
                                    >
                                        {action}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Footer / Input */}
                        <form onSubmit={handleSendMessage} className="agent-footer">
                            <input
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder="Ask me anything..."
                                className="agent-input"
                            />
                            <button
                                type="submit"
                                disabled={!inputValue.trim() || isLoading || !isConnected}
                                className="agent-send-btn"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "agentstack-agent-trigger shadow-lg",
                    isOpen ? "active" : ""
                )}
            >
                <AnimatePresence mode="wait">
                    {isOpen ? (
                        <motion.div
                            key="close"
                            initial={{ rotate: -90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: 90, opacity: 0 }}
                        >
                            <X className="w-6 h-6 text-white" />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="chat"
                            initial={{ rotate: 90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: -90, opacity: 0 }}
                            className="relative"
                        >
                            <Bot className="w-7 h-7 text-white" />
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-brand-primary rounded-full" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </button>
        </div>
    );
};

export default Wayfinder;

