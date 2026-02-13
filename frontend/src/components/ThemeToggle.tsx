import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle: React.FC = () => {
    const { isDark, setIsDark } = useTheme();

    const toggleTheme = () => {
        setIsDark(!isDark);
    };

    return (
        <button
            onClick={toggleTheme}
            className={`relative p-2 rounded-xl transition-all duration-300 group border
        ${isDark
                    ? 'bg-surface-800/50 border-surface-700 hover:bg-surface-800 text-brand-primary'
                    : 'bg-white/50 border-surface-200 hover:bg-white text-orange-500 shadow-sm'
                }`}
            aria-label="Toggle Theme"
        >
            <div className="relative z-10 w-6 h-6 flex items-center justify-center">
                <motion.div
                    animate={{ scale: isDark ? 1 : 0, rotate: isDark ? 0 : 90 }}
                    transition={{ duration: 0.2 }}
                    className="absolute"
                >
                    <Moon className="w-5 h-5 fill-current" />
                </motion.div>

                <motion.div
                    animate={{ scale: isDark ? 0 : 1, rotate: isDark ? -90 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute"
                >
                    <Sun className="w-5 h-5 fill-current" />
                </motion.div>
            </div>

            {/* Hover glow effect */}
            <div className={`absolute inset-0 rounded-xl blur-md transition-opacity duration-300 opacity-0 group-hover:opacity-40
        ${isDark ? 'bg-indigo-500' : 'bg-orange-400'}`}
            />
        </button>
    );
};

export default ThemeToggle;
