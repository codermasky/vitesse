import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
    Book,
    Settings,
    Zap,
    ShieldCheck,
    Search,
    ExternalLink
} from 'lucide-react';
import { motion } from 'framer-motion';

const HelpPage: React.FC = () => {
    const [selectedDoc, setSelectedDoc] = useState('guides/ui_help_guide.md');
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);

    const docs = [
        { id: 'guides/ui_help_guide.md', title: 'User Guide', icon: Book, description: 'Learn how to use the Vitesse interface.' },
        { id: 'getting-started.md', title: 'Getting Started', icon: Zap, description: 'Installation and initial setup instructions.' },
        { id: 'features.md', title: 'Feature Overview', icon: Settings, description: 'Detailed breakdown of integration capabilities.' },
        { id: 'aether.md', title: 'Aether Integration', icon: ShieldCheck, description: 'Technical details of the Aether intelligence layer.' },
        { id: 'api.md', title: 'API Reference', icon: Search, description: 'Overview of available REST endpoints.' },
        { id: 'security.md', title: 'Security Guide', icon: ShieldCheck, description: 'Authentication, secrets, and best practices.' },
    ];

    useEffect(() => {
        setLoading(true);
        fetch(`/docs/${selectedDoc}`)
            .then((res) => res.text())
            .then((text) => {
                setContent(text);
                setLoading(false);
            })
            .catch(() => {
                setContent('# Error\nHelp content could not be loaded.');
                setLoading(false);
            });
    }, [selectedDoc]);

    return (
        <div className="flex flex-col gap-8 min-h-[calc(100vh-8rem)]">
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl font-bold text-surface-950 dark:text-white tracking-tight">
                    Help Center
                </h1>
                <p className="text-surface-500 dark:text-surface-400 text-lg">
                    Find everything you need to know about Vitesse AI.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Sidebar Navigation */}
                <div className="lg:col-span-1 flex flex-col gap-4">
                    {docs.map((doc) => {
                        const Icon = doc.icon;
                        const isSelected = selectedDoc === doc.id;
                        return (
                            <button
                                key={doc.id}
                                onClick={() => setSelectedDoc(doc.id)}
                                className={`flex flex-col gap-1 p-4 rounded-2xl transition-all text-left border ${isSelected
                                    ? 'bg-brand-600 border-brand-500 text-white shadow-lg shadow-brand-500/20'
                                    : 'bg-white dark:bg-surface-900 border-surface-200 dark:border-brand-500/5 hover:border-brand-500/30 text-surface-700 dark:text-surface-300'
                                    }`}
                            >
                                <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px]">
                                    <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-brand-500'}`} />
                                    {doc.title}
                                </div>
                                {!isSelected && <p className="text-xs text-surface-500 dark:text-surface-400">{doc.description}</p>}
                            </button>
                        );
                    })}
                </div>

                {/* Content Area */}
                <div className="lg:col-span-3">
                    <div className="glass p-8 rounded-3xl min-h-[600px] border border-surface-200 dark:border-brand-500/10">
                        {loading ? (
                            <div className="flex items-center justify-center h-[500px]">
                                <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="prose prose-slate dark:prose-invert max-w-none 
                                    prose-headings:text-surface-950 dark:prose-headings:text-white 
                                    prose-h1:text-4xl prose-h1:font-bold prose-h1:tracking-tight
                                    prose-h2:text-2xl prose-h2:font-semibold prose-h2:tracking-tight
                                    prose-p:text-surface-600 dark:prose-p:text-surface-300
                                    prose-li:text-surface-600 dark:prose-li:text-surface-300
                                    prose-strong:text-brand-600 dark:prose-strong:text-brand-400
                                    prose-code:bg-black/5 dark:prose-code:bg-white/5 prose-code:p-1 prose-code:rounded prose-code:before:content-none prose-code:after:content-none"
                            >
                                <ReactMarkdown>{content}</ReactMarkdown>
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>

            {/* Support Footer */}
            <div className="glass p-6 rounded-3xl border border-surface-200 dark:border-brand-500/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-brand-600/10 rounded-2xl flex items-center justify-center">
                        <Zap className="w-6 h-6 text-brand-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-surface-950 dark:text-white">Still need help?</h3>
                        <p className="text-sm text-surface-500 dark:text-surface-400">Contact our support team for specialized assistance.</p>
                    </div>
                </div>
                <button className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl transition-all flex items-center gap-2">
                    Open Ticket <ExternalLink className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default HelpPage;
