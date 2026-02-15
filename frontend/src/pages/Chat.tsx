import React, { useState, useEffect, useRef } from 'react';
import apiService from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';

import {
  Send,
  Bot,
  User,
  Sparkles,
  Loader2,
  Copy,
  Save,
  Clock,
  Trash2,
  ChevronRight,
  CheckCircle,
  Link as LinkIcon,
  Download,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare
} from 'lucide-react';

import ReactMarkdown from 'react-markdown';
// import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { cn } from '../services/utils';
import SectionHeader from '../components/SectionHeader';

interface Message {
  id: string;
  type: string;
  content: string;
  timestamp: Date;
  isUser: boolean;
  sources?: Array<{
    title: string;
    url?: string;
    content_preview: string;
  }>;
  confidence_score?: number;
  metadata?: any;
  role?: 'user' | 'assistant';
  status?: 'loading' | 'error';
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}


const Chat: React.FC = () => {
  // const { user } = useAuth(); // unused
  const { addNotification } = useNotifications();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [verbosity, setVerbosity] = useState<'concise' | 'detailed'>('concise');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // suggestedActions removed

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addMessage = (type: string, content: string, isUser: boolean, sources?: Message['sources']) => {
    const message: Message = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content,
      timestamp: new Date(),
      isUser,
      sources,
    };
    setMessages(prev => [...prev, message]);
  };

  const fetchSessions = async () => {
    try {
      const response = await apiService.getChatSessions();
      setSessions(response.data);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  };

  const initializeChat = async (existingSessionId?: string) => {
    try {
      let sessionId = existingSessionId;

      if (!sessionId) {
        const response = await apiService.createChatSession();
        sessionId = response.data.session_id;
        // Refresh sessions
        fetchSessions();
      }

      if (sessionId) {
        setCurrentSessionId(sessionId);
      } else {
        console.error("No session ID available");
        return;
      }

      // Use native WebSocket
      // Derive WS URL from API URL to ensure consistency
      const apiBaseUrl = (import.meta.env.VITE_API_URL || "http://localhost:8002/api/v1");
      // Remove /api/v1 suffix if present to get the host
      const apiUrl = apiBaseUrl.replace(/\/api\/v1$/, '');
      const wsProtocol = apiUrl.startsWith("https") ? "wss" : "ws";
      const token = localStorage.getItem('access_token');
      const wsUrl = `${wsProtocol}://${apiUrl.split("://")[1]}/api/v1/chat/ws/${sessionId}${token ? `?token=${token}` : ''}`;

      if (socketRef.current) { // Added check for existing socket
        socketRef.current.close();
      }

      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setIsConnected(true);
        console.log('Connected to chat server');
      };

      socket.onclose = () => {
        setIsConnected(false);
        console.log('Disconnected from chat server');
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Backend sends { type: '...', data: { ... } }

          if (data.type === 'ai_response') {
            const messageData = data.data;
            addMessage('response', messageData.message || '', false, messageData.sources);
            setIsLoading(false);
            // Refresh sessions to get new titles or new sessions
            fetchSessions();
          } else if (data.type === 'error') {
            const messageData = data.data;
            addMessage('error', `Error: ${messageData.message || 'Unknown error'}`, false);
            setIsLoading(false);
          } else if (data.type === 'connected') {
            console.log('Session established:', data.data);
          }
        } catch (e) {
          console.error('Failed to parse message:', e);
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        // Native WS error events don't usually contain descriptive messages for security
        // But we can notify UI
        setIsConnected(false);
        setIsLoading(false);
      };

      socketRef.current = socket;
    } catch (error) {
      console.error('Failed to initialize chat:', error);
      // Allow input even if connection fails (demo mode or retry)
      // Or show error message
      addMessage('error', 'Failed to connect to chat server. Please refresh or check connection.', false);
    }
  };

  const handleSelectSession = async (sessionId: string) => {
    try {
      setIsLoading(true);
      // Close current socket
      if (socketRef.current) {
        socketRef.current.close();
      }

      // Load history
      const response = await apiService.getChatHistory(sessionId);
      const history = response.data.history;

      // Convert history format to Message format
      const formattedMessages: Message[] = history.map((msg: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        type: msg.role === 'user' ? 'user' : 'response',
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        isUser: msg.role === 'user',
        sources: msg.role === 'assistant' && msg.sources ? msg.sources : undefined,
        metadata: msg.metadata,
        confidence_score: msg.metadata?.confidence_score
      }));

      setMessages(formattedMessages);

      // Connect WS
      setCurrentSessionId(sessionId);
      await initializeChat(sessionId);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load session:', error);
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    initializeChat();
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this chat?')) return;

    try {
      await apiService.deleteChatSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));

      if (currentSessionId === sessionId) {
        handleNewChat();
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  useEffect(() => {
    fetchSessions();
    initializeChat();
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !socketRef.current || !isConnected) return;

    const messageToSend = inputValue.trim();
    addMessage('user', messageToSend, true);
    setInputValue('');
    setIsLoading(true);

    try {
      socketRef.current.send(JSON.stringify({
        type: 'user_message',
        data: {
          message: messageToSend,
          session_id: currentSessionId,
          verbosity
        }
      }));
    } catch (error) {
      console.error('Failed to send message:', error);
      addMessage('error', 'Failed to send message', false);
      setIsLoading(false);
    }
  };

  const handleSaveSession = async () => {
    if (!currentSessionId) return;
    try {
      await apiService.saveChatSession(currentSessionId);

      await fetchSessions(); // Refresh list to show saved chat
      addNotification({ message: 'Conversation successfully saved as a new quest.', type: 'success' });

    } catch (error) {
      console.error('Failed to save session:', error);
      addNotification({ message: 'Failed to save conversation. Please try again.', type: 'error' });
    }
  };

  const handleDownloadSource = async (e: React.MouseEvent, url: string, filename: string) => {
    e.preventDefault();
    try {
      const response = await apiService.downloadDocument(url);
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Failed to download source:', error);
      alert('Failed to download the source document. Please try again.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e as any);
    }
  };



  return (
    <div className="h-[calc(100vh-10rem)]">
      {/* Main Chat Interface */}
      <div className="flex flex-col h-full glass rounded-[2.5rem] border border-brand-500/10 overflow-hidden relative">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-brand-primary/10 blur-[100px] rounded-full -z-10" />
        <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-brand-secondary/10 blur-[100px] rounded-full -z-10" />

        {/* Global Header */}
        <div className="border-b border-brand-100 dark:border-brand-500/5 bg-surface-50/80 dark:bg-brand-950/40 backdrop-blur-md z-30 relative">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 rounded-xl text-surface-400 hover:text-brand-primary hover:bg-brand-primary/10 transition-all border border-transparent hover:border-brand-primary/10"
                title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
              >
                {isSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
              </button>
              <SectionHeader
                title="Vitesse AI Scout"
                subtitle="Integration Discovery Agent"
                variant="premium"
                className="border-none p-0 bg-transparent"
                icon={Bot}
              />
            </div>

            <div className="flex items-center gap-3">
              {/* Verbosity Toggle */}
              <div className="flex items-center bg-surface-100 dark:bg-brand-950/50 p-1 rounded-lg border border-brand-100 dark:border-brand-500/10">
                <button
                  onClick={() => setVerbosity('concise')}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                    verbosity === 'concise'
                      ? "bg-white dark:bg-brand-500/20 text-brand-primary shadow-sm"
                      : "text-surface-400 hover:text-surface-600"
                  )}
                >
                  Concise
                </button>
                <button
                  onClick={() => setVerbosity('detailed')}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                    verbosity === 'detailed'
                      ? "bg-white dark:bg-brand-500/20 text-brand-primary shadow-sm"
                      : "text-surface-400 hover:text-surface-600"
                  )}
                >
                  Detailed
                </button>
              </div>

              {/* Save Button */}
              {currentSessionId && (
                <button
                  onClick={handleSaveSession}
                  disabled={sessions.some(s => s.id === currentSessionId)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl transition-all border",
                    sessions.some(s => s.id === currentSessionId)
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 cursor-default"
                      : "bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary border-brand-primary/20 hover:border-brand-primary/30"
                  )}
                  title={sessions.some(s => s.id === currentSessionId) ? "Conversation saved" : "Save this conversation to history"}
                >
                  {sessions.some(s => s.id === currentSessionId) ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Saved</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Save Chat</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden relative z-10">
          {/* Sidebar */}
          <AnimatePresence>
            {isSidebarOpen && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 320, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="border-r border-brand-100 dark:border-brand-500/5 bg-surface-50/50 dark:bg-brand-950/20 backdrop-blur-sm flex flex-col h-full relative z-20"
              >


                {/* Recent Chats List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                  <div className="text-[10px] font-black text-surface-400 uppercase tracking-widest px-2 mb-2">History</div>
                  {sessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => handleSelectSession(session.id)}
                      className={cn(
                        "w-full text-left p-3 rounded-xl transition-all group relative border",
                        currentSessionId === session.id
                          ? "bg-brand-primary/10 border-brand-primary/20 shadow-lg shadow-brand-primary/5"
                          : "hover:bg-surface-100 dark:hover:bg-brand-500/5 border-transparent hover:border-brand-primary/10 text-surface-500 dark:text-surface-400"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <MessageSquare className={cn(
                          "w-4 h-4 mt-0.5 transition-colors",
                          currentSessionId === session.id ? "text-brand-primary" : "text-surface-400 group-hover:text-brand-primary/70"
                        )} />
                        <div className="flex-1 min-w-0 pr-6">
                          <p className={cn(
                            "text-xs font-bold truncate transition-colors",
                            currentSessionId === session.id ? "text-brand-primary" : "text-surface-600 dark:text-surface-300 group-hover:text-surface-900 dark:group-hover:text-white"
                          )}>
                            {session.title || "New Conversation"}
                          </p>
                          <p className="text-[10px] text-surface-400 mt-1 truncate">
                            {new Date(session.updated_at).toLocaleDateString()}
                          </p>
                        </div>

                        <div
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-500/10 rounded-lg text-surface-400 hover:text-red-500 cursor-pointer"
                          onClick={(e) => handleDeleteSession(e, session.id)}
                          title="Delete Chat"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </button>
                  ))}

                  {sessions.length === 0 && (
                    <div className="text-center py-10 px-4">
                      <div className="w-12 h-12 rounded-xl bg-surface-100 dark:bg-brand-500/5 flex items-center justify-center mx-auto mb-3">
                        <MessageSquare className="w-5 h-5 text-surface-400" />
                      </div>
                      <p className="text-xs text-surface-500 font-medium">No history yet</p>
                    </div>
                  )}
                </div>

                {/* New Chat Button */}
                <div className="p-4 border-t border-brand-100 dark:border-brand-500/5 bg-surface-50/80 dark:bg-brand-950/40">
                  <button
                    onClick={handleNewChat}
                    className="w-full py-3 px-4 bg-brand-primary hover:bg-brand-600 text-white rounded-xl shadow-lg shadow-brand-primary/20 transition-all font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    New Chat
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>



          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col relative z-10 bg-surface-50/30 dark:bg-transparent">
            <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
              <div className="max-w-3xl mx-auto space-y-6">
                {messages.length === 0 ? (
                  <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mb-8 relative"
                    >
                      <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-brand-primary to-brand-secondary p-0.5 shadow-2xl shadow-brand-primary/20">
                        <div className="w-full h-full bg-surface-50 dark:bg-brand-950 rounded-[1.9rem] flex items-center justify-center">
                          <Sparkles className="w-10 h-10 text-brand-primary" />
                        </div>
                      </div>
                      <div className="absolute -bottom-2 -right-2 bg-surface-100 dark:bg-brand-900 rounded-xl border border-brand-100 dark:border-brand-500/10 p-2 shadow-lg">
                        <Bot className="w-5 h-5 text-brand-primary" />
                      </div>
                    </motion.div>
                    <h1 className="text-3xl md:text-4xl font-black text-surface-950 dark:text-white mb-4 tracking-tight">
                      Ready to scout?
                    </h1>
                    <p className="text-surface-500 max-w-md leading-relaxed">
                      I am your <span className="text-brand-primary font-bold">Scout</span>. I can explore integrations across LineData products and third-party services to discover data, APIs, and connectivity options.
                    </p>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex gap-4 group",
                        message.isUser ? "flex-row-reverse" : "flex-row"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg mt-1",
                        message.isUser
                          ? "bg-brand-primary text-white shadow-brand-primary/20"
                          : "bg-surface-100 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/10 text-brand-secondary"
                      )}>
                        {message.isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </div>

                      <div className={cn(
                        "max-w-[85%] rounded-2xl p-6 shadow-xl relative group/message",
                        message.isUser
                          ? "bg-gradient-to-br from-brand-primary to-brand-secondary text-white rounded-tr-sm"
                          : "bg-white dark:bg-brand-950 border border-surface-200 dark:border-brand-500/10 text-surface-800 dark:text-surface-100 rounded-tl-sm"
                      )}>
                        {/* Bot Badge */}
                        {!message.isUser && (
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-md">
                              Vitesse AI Scout
                            </span>
                            <div className="h-px flex-1 bg-gradient-to-r from-brand-primary/20 to-transparent" />
                          </div>
                        )}

                        {/* Status / Loading indicator */}
                        {message.status === 'loading' && (
                          <div className="flex items-center gap-2 text-brand-primary mb-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Discovering Integrations</span>
                          </div>
                        )}

                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-surface-900 prose-pre:border prose-pre:border-brand-500/20">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>

                        {/* Metadata Footer */}
                        {!message.isUser && !message.status && (
                          <div className="mt-4 pt-4 border-t border-brand-primary/5 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              {(message.metadata?.confidence_score || message.confidence_score) && (
                                <div className="flex items-center gap-1.5" title="Confidence Score">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">
                                    {Math.round((message.metadata?.confidence_score || message.confidence_score || 0) * 100)}% Confidence
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5" title="Processing Time">
                                <Clock className="w-3 h-3 text-surface-400" />
                                <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">
                                  0.4s
                                </span>
                              </div>
                            </div>

                            <button className="text-surface-400 hover:text-brand-primary transition-colors">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* Sources Section */}
                        {message.sources && message.sources.length > 0 && (
                          <div className="mt-6 pt-4 border-t border-brand-primary/10">
                            <details className="group/sources" open={false}>
                              <summary className="list-none cursor-pointer flex items-center justify-between text-surface-500 hover:text-brand-primary transition-colors">
                                <div className="flex items-center gap-2">
                                  <LinkIcon className="w-3.5 h-3.5" />
                                  <span className="text-[10px] font-black uppercase tracking-widest">
                                    Sources Found ({message.sources.length})
                                  </span>
                                </div>
                                <motion.div
                                  animate={{ rotate: 0 }}
                                  className="group-open/sources:rotate-180 transition-transform"
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </motion.div>
                              </summary>
                              <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {message.sources.map((source, idx) => (
                                  <button
                                    key={idx}
                                    onClick={(e) => source.url && handleDownloadSource(e, source.url, source.title)}
                                    className="w-full text-left block p-3 rounded-xl bg-surface-50/50 dark:bg-brand-900/10 border border-brand-primary/5 hover:border-brand-primary/20 hover:bg-surface-50 dark:hover:bg-brand-900/20 transition-all group/source"
                                  >
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="text-xs font-bold text-brand-primary group-hover/source:underline truncate max-w-[200px]">
                                        {source.title}
                                      </span>
                                      <Download className="w-3 h-3 opacity-0 group-hover/source:opacity-100 transition-opacity" />
                                    </div>
                                    <p className="text-[10px] text-surface-500 dark:text-surface-400 line-clamp-2 leading-relaxed font-medium">
                                      {source.content_preview}
                                    </p>
                                  </button>
                                ))}
                              </div>
                            </details>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}

                {/* Typing Indicator */}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-4 flex-row"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-surface-100 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/10 text-brand-secondary shadow-lg">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="bg-white dark:bg-brand-500/5 border border-surface-200 dark:border-brand-500/5 text-surface-800 dark:text-surface-100 rounded-2xl rounded-tl-sm p-4 shadow-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          <motion.span
                            animate={{ scale: [1, 1.2, 1], opacity: [0.4, 1, 0.4] }}
                            transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                            className="w-1.5 h-1.5 rounded-full bg-brand-primary"
                          />
                          <motion.span
                            animate={{ scale: [1, 1.2, 1], opacity: [0.4, 1, 0.4] }}
                            transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                            className="w-1.5 h-1.5 rounded-full bg-brand-primary"
                          />
                          <motion.span
                            animate={{ scale: [1, 1.2, 1], opacity: [0.4, 1, 0.4] }}
                            transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                            className="w-1.5 h-1.5 rounded-full bg-brand-primary"
                          />
                        </div>
                        <span className="text-[10px] font-black text-brand-primary/60 uppercase tracking-[0.1em]">Vitesse AI Scout is typing</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </main>

            {/* Input Area */}
            <div className="p-4 md:p-6 bg-surface-50/80 dark:bg-brand-950/40 backdrop-blur-md border-t border-brand-100 dark:border-brand-500/5">
              <form
                onSubmit={handleSendMessage}
                className="max-w-3xl mx-auto relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-brand-primary/20 to-brand-secondary/20 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                <div className="relative flex items-end gap-2 bg-surface-100 dark:bg-brand-950 border border-brand-100 dark:border-brand-500/10 rounded-2xl p-2 shadow-lg transition-all focus-within:border-brand-primary/50 dark:focus-within:border-brand-500/30">
                  <button
                    type="button"
                    className="p-3 text-surface-400 hover:text-brand-primary hover:bg-brand-primary/10 rounded-xl transition-all"
                  >
                    <Plus className="w-5 h-5" />
                  </button>

                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about your documents or pipeline..."
                    className="flex-1 bg-transparent border-none focus:ring-0 max-h-32 min-h-[50px] py-3.5 px-2 text-sm text-surface-950 dark:text-white placeholder:text-surface-400 resize-none font-medium leading-relaxed custom-scrollbar"
                    rows={1}
                  />

                  <button
                    type="submit"
                    disabled={!inputValue.trim() || isLoading}
                    className="p-3 bg-brand-primary hover:bg-brand-600 disabled:opacity-50 disabled:hover:bg-brand-primary text-white rounded-xl shadow-lg shadow-brand-primary/20 transition-all transform hover:scale-105 active:scale-95"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <div className="text-center mt-2">
                  <p className="text-[10px] text-surface-400 font-medium">
                    AI Agent can make mistakes. Verify critical information in your systems.
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;