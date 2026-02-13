import React, { createContext, useContext, useState, useEffect } from 'react';

interface AISettings {
    sidekick: {
        enabled: boolean;
        autoRefresh: boolean;
        verbosity: 'concise' | 'detailed';
        cacheDuration: number;
    };
    wayfinder: {
        enabled: boolean;
        showWelcome: boolean;
    };
    sparkles: {
        enabled: boolean;
    };
    magicBar: {
        enabled: boolean;
        shortcut: string;
    };
    ui: {
        sidebarCollapsed: boolean;
    };
}

export interface WhitelabelConfig {
    brand_name: string;
    creator: string;
    logo_url: string | null;
    primary_color: string;
    enabled: boolean;
}

const defaultSettings: AISettings = {
    sidekick: {
        enabled: true,
        autoRefresh: true,
        verbosity: 'concise',
        cacheDuration: 60
    },
    wayfinder: {
        enabled: true,
        showWelcome: true
    },
    sparkles: {
        enabled: true
    },
    magicBar: {
        enabled: true,
        shortcut: 'meta+k'
    },
    ui: {
        sidebarCollapsed: false
    }
};

interface SettingsContextType {
    aiSettings: AISettings;
    whitelabel: WhitelabelConfig;
    updateAISettings: <T extends keyof AISettings>(category: T, settings: Partial<AISettings[T]>) => void;
    updateWhitelabel: (config: Partial<WhitelabelConfig>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [aiSettings, setAiSettings] = useState<AISettings>(() => {
        const saved = localStorage.getItem('vitesse_settings');
        return saved ? JSON.parse(saved) : defaultSettings;
    });

    const [whitelabel, setWhitelabel] = useState<WhitelabelConfig>({
        brand_name: 'Vitesse AI',
        creator: 'Your Company',
        logo_url: null,
        primary_color: '#EF4444',
        enabled: true
    });

    useEffect(() => {
        localStorage.setItem('vitesse_settings', JSON.stringify(aiSettings));
    }, [aiSettings]);

    useEffect(() => {
        const fetchWhitelabel = async () => {
            try {
                const apiUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:9001/api/v1`;
                const response = await fetch(`${apiUrl}/system/whitelabel`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    setWhitelabel(data);
                }
            } catch (error) {
                console.error('Failed to fetch whitelabel config:', error);
            }
        };
        fetchWhitelabel();
    }, []);

    const updateAISettings = <T extends keyof AISettings>(category: T, settings: Partial<AISettings[T]>) => {
        setAiSettings(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                ...settings
            }
        }));
    };

    const updateWhitelabel = async (config: Partial<WhitelabelConfig>) => {
        const newConfig = { ...whitelabel, ...config };
        setWhitelabel(newConfig);
        try {
            await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8002/api/v1'}/system/whitelabel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                },
                body: JSON.stringify(config)
            });
        } catch (error) {
            console.error('Failed to save whitelabel config:', error);
        }
    };

    return (
        <SettingsContext.Provider value={{ aiSettings, whitelabel, updateAISettings, updateWhitelabel }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useAISettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useAISettings must be used within a SettingsProvider');
    }
    return context;
};
