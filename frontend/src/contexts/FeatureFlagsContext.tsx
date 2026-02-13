import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import apiService from '../services/api';
import { useAuth } from './AuthContext';

interface FeatureFlagsContextType {
    featureFlags: Record<string, boolean>;
    isFeatureEnabled: (feature: string) => boolean;
    refreshFeatureFlags: () => Promise<void>;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | undefined>(undefined);

export const FeatureFlagsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
    const { isAuthenticated } = useAuth();

    const fetchFeatureFlags = async () => {
        if (!isAuthenticated) return;
        try {
            const response = await apiService.getFeatureFlags();
            setFeatureFlags(response.data.feature_flags);
        } catch (error) {
            console.error('Failed to fetch feature flags:', error);
            // Set default enabled state for all features if API fails
            setFeatureFlags({
                enable_vision: true,
                enable_rag: true,
                enable_multi_agent: true,
                enable_sidekick: true,
                knowledge_base: true,
                document_intelligence: true,
            });
        }
    };

    const isFeatureEnabled = (feature: string): boolean => {
        return featureFlags[feature] ?? true; // Default to enabled if not loaded
    };

    const refreshFeatureFlags = useCallback(async () => {
        await fetchFeatureFlags();
    }, []);

    const value = useMemo(() => ({
        featureFlags,
        isFeatureEnabled,
        refreshFeatureFlags
    }), [featureFlags, refreshFeatureFlags]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchFeatureFlags();
        }
    }, [isAuthenticated]);

    return (
        <FeatureFlagsContext.Provider value={value}>
            {children}
        </FeatureFlagsContext.Provider>
    );
};

export const useFeatureFlags = () => {
    const context = useContext(FeatureFlagsContext);
    if (!context) {
        throw new Error('useFeatureFlags must be used within a FeatureFlagsProvider');
    }
    return context;
};