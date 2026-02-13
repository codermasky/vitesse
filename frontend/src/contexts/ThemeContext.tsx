import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeId = 'cyber-indigo' | 'deep-ocean' | 'midnight-gold' | 'emerald-frost';

interface Theme {
    id: ThemeId;
    name: string;
    description: string;
    colors: {
        primary: string;
        secondary: string;
        accent: string;
    };
}

export const themes: Theme[] = [
    {
        id: 'cyber-indigo',
        name: 'Cyber Indigo',
        description: 'Vibrant indigo and violet accents for a premium AI aesthetic.',
        colors: {
            primary: '#6366f1',
            secondary: '#8b5cf6',
            accent: '#f43f5e'
        }
    },
    {
        id: 'deep-ocean',
        name: 'Deep Ocean',
        description: 'Classic deep sea blues and cyan highights.',
        colors: {
            primary: '#0ea5e9',
            secondary: '#06b6d4',
            accent: '#10b981'
        }
    },
    {
        id: 'midnight-gold',
        name: 'Midnight Gold',
        description: 'Luxurious amber and gold tones on charcoal backgrounds.',
        colors: {
            primary: '#f59e0b',
            secondary: '#fbbf24',
            accent: '#f97316'
        }
    },
    {
        id: 'emerald-frost',
        name: 'Emerald Frost',
        description: 'Crisp emerald and teal accents for a fresh modern look.',
        colors: {
            primary: '#10b981',
            secondary: '#14b8a6',
            accent: '#3b82f6'
        }
    }
];

interface ThemeContextType {
    theme: ThemeId;
    setTheme: (theme: ThemeId) => void;
    availableThemes: Theme[];
    isDark: boolean;
    setIsDark: (isDark: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<ThemeId>(() => {
        return (localStorage.getItem('app-theme') as ThemeId) || 'cyber-indigo';
    });

    const [isDark, setIsDarkState] = useState<boolean>(() => {
        const savedMode = localStorage.getItem('theme-mode');
        if (savedMode) return savedMode === 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        const root = document.documentElement;

        // Apply theme attribute
        root.setAttribute('data-theme', theme);
        localStorage.setItem('app-theme', theme);

        // Apply dark mode class
        if (isDark) {
            root.classList.add('dark');
            localStorage.setItem('theme-mode', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('theme-mode', 'light');
        }
    }, [theme, isDark]);

    const setTheme = (newTheme: ThemeId) => {
        setThemeState(newTheme);
    };

    const setIsDark = (dark: boolean) => {
        setIsDarkState(dark);
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, availableThemes: themes, isDark, setIsDark }}>
            {children}
        </ThemeContext.Provider>
    );
};
