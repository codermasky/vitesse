import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { Sparkles, Wand2 } from 'lucide-react';
import { cn } from '../services/utils';

interface SparkleTooltipProps {
    content: string;
    className?: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

import { useAISettings } from '../contexts/SettingsContext';

const SparkleTooltip: React.FC<SparkleTooltipProps> = ({
    content,
    className,
    position = 'top'
}) => {
    const { aiSettings } = useAISettings();
    const [isOpen, setIsOpen] = useState(false);

    if (!aiSettings.sparkles.enabled) return null;

    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2'
    };

    return (
        <div className={cn("relative inline-block", className)}>
            <button
                onMouseEnter={() => setIsOpen(true)}
                onMouseLeave={() => setIsOpen(false)}
                onClick={() => setIsOpen(!isOpen)}
                className="p-1 rounded-full bg-brand-500/10 hover:bg-brand-500/20 text-brand-500 transition-all hover:scale-110 active:scale-95 group"
            >
                <Sparkles className="w-3 h-3 group-hover:animate-pulse" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className={cn(
                            "absolute z-50 w-64 p-4 glass-dark rounded-2xl border border-brand-500/30 shadow-2xl shadow-brand-500/20",
                            positionClasses[position]
                        )}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-md bg-brand-500 flex items-center justify-center">
                                <Wand2 className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">AI Insight</span>
                        </div>
                        <p className="text-xs text-white leading-relaxed">
                            {content}
                        </p>
                        <div className="mt-3 flex gap-2">
                            <button className="text-[10px] font-bold px-2 py-1 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors">
                                Apply Suggestion
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-[10px] font-bold px-2 py-1 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                            >
                                Dismiss
                            </button>
                        </div>

                        {/* Arrow */}
                        <div className={cn(
                            "absolute w-2 h-2 bg-surface-900 border-r border-b border-brand-500/30 rotate-45",
                            position === 'top' ? "top-full -mt-1 left-1/2 -ml-1 border-t-0 border-l-0" :
                                position === 'bottom' ? "bottom-full -mb-1 left-1/2 -ml-1 border-r-0 border-b-0" :
                                    position === 'left' ? "left-full -ml-1 top-1/2 -mt-1 border-l-0 border-b-0" :
                                        "right-full -mr-1 top-1/2 -mt-1 border-r-0 border-t-0"
                        )} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SparkleTooltip;
