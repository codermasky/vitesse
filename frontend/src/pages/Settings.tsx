import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Cpu,
    Database,
    Zap,
    Plus,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    Edit2,
    Globe,
    Key,
    Eye,
    EyeOff,
    BrainCircuit,
    Trash2,
    Sparkles,
    Bot,

    Terminal,
    Mail,
    Activity,
    Palette,
    Users
} from 'lucide-react';
import apiService from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../services/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAISettings } from '../contexts/SettingsContext';
import { useNotifications } from '../contexts/NotificationContext';
import SectionHeader from '../components/SectionHeader';
import AgentGrid from '../components/AgentGrid';
import UserManagement from '../components/UserManagement';
import AdminPerformanceDashboard from './AdminPerformanceDashboard';
import LangFuseConfig from './LangFuseConfig';
import LangfuseDashboard from './LangfuseDashboard';
import PromptManagement from './PromptManagement';
import CostDashboard from './CostDashboard';
import LangfuseTraces from './LangfuseTraces';

// Helper for modal animations
const modalBackdrop = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
};

const modalContent = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0 }
};

interface LLMProvider {
    provider_id: string;
    name: string;
    provider_type: string;
    api_endpoint?: string;
    api_key?: string;
    models: string[];
    default_model?: string;
    parameters: Record<string, any>;
}

interface AgentMapping {
    agent_id: string;
    provider_id: string;
    model_name: string;
    parameters?: Record<string, any>;
    prompt_template_id?: string | null;  // NEW: Link to unified prompt template
    system_prompt?: string;  // DEPRECATED
    refinement_prompt?: string;  // DEPRECATED
    role?: string;
}

interface PromptHistoryEntry {
    id: number;
    agent_id: string;
    system_prompt: string;
    refinement_prompt: string;
    version: number;
    created_at: string;
    comment: string;
}

interface LLMSettings {
    providers: LLMProvider[];
    mappings: AgentMapping[];
    global_default_provider: string;
    global_default_model: string;
}

const Settings: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [settings, setSettings] = useState<LLMSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [testingConnection, setTestingConnection] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
    const [testingMapping, setTestingMapping] = useState<string | null>(null);
    const [mappingTestResult, setMappingTestResult] = useState<{ id: string; success: boolean; message: string; response?: string } | null>(null);
    const { theme, setTheme, availableThemes } = useTheme();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as 'appearance' | 'whitelabel' | 'providers' | 'agents' | 'sidekick' | 'wayfinder' | 'integrations' | 'products' | 'features' | 'performance' | 'monitoring' | 'users') || 'appearance';
    const [activeAgentTab, setActiveAgentTab] = useState<'workforce' | 'configuration' | 'prompts'>('workforce');
    const [activeMonitoringTab, setActiveMonitoringTab] = useState<'dashboard' | 'traces' | 'analytics' | 'configuration'>('dashboard');


    const setActiveTab = (tab: 'appearance' | 'whitelabel' | 'providers' | 'agents' | 'sidekick' | 'wayfinder' | 'integrations' | 'products' | 'features' | 'performance' | 'monitoring' | 'users') => {
        setSearchParams({ tab });
    };

    const { aiSettings, updateAISettings, whitelabel, updateWhitelabel } = useAISettings();
    const { addNotification } = useNotifications();
    const [visionEnabled, setVisionEnabled] = useState(true);
    const [daEnabled, setDaEnabled] = useState(true);

    // Feature Flags State
    const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
    const [featureDescriptions, setFeatureDescriptions] = useState<Record<string, string>>({});
    const [loadingFeatures, setLoadingFeatures] = useState(false);

    useEffect(() => {
        if (user && !user.is_superuser) {
            navigate('/');
        }
    }, [user, navigate]);

    // Modal States
    const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
    const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
    const [editingProvider, setEditingProvider] = useState<Partial<LLMProvider>>({});
    const [editingMapping, setEditingMapping] = useState<Partial<AgentMapping>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [providerToDelete, setProviderToDelete] = useState<string | null>(null);
    const [mappingToDelete, setMappingToDelete] = useState<string | null>(null);
    const [promptHistory, setPromptHistory] = useState<PromptHistoryEntry[]>([]);
    const [isFetchingHistory, setIsFetchingHistory] = useState(false);

    // Email Settings State
    const [emailConfig, setEmailConfig] = useState({
        enabled: false,
        server: 'imap.gmail.com',
        port: 993,
        username: '',
        password: '',
        poll_interval: 60
    });
    const [emailTestResult, setEmailTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [testingEmail, setTestingEmail] = useState(false);

    // Azure AD SSO Settings State
    const [azureADConfig, setAzureADConfig] = useState({
        AZURE_AD_ENABLED: false,
        AZURE_AD_CLIENT_ID: '',
        AZURE_AD_CLIENT_SECRET: '',
        AZURE_AD_TENANT_ID: '',
        AZURE_AD_REDIRECT_URI: '',
        AZURE_AD_SCOPES: 'User.Read'
    });
    const [azureADTestResult, setAzureADTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [testingAzureAD, setTestingAzureAD] = useState(false);
    const [isAutomateSetupModalOpen, setIsAutomateSetupModalOpen] = useState(false);
    const [automateSetupConfig, setAutomateSetupConfig] = useState({
        tenant_id: '',
        access_token: '',
        app_name: 'Vitesse AI',
        redirect_uri: 'http://localhost:8002/api/v1/auth/azuread/callback'
    });
    const [automateSetupResult, setAutomateSetupResult] = useState<any>(null);
    const [automatingSetup, setAutomatingSetup] = useState(false);



    const [troubleshootingResult, setTroubleshootingResult] = useState<any>(null);
    const [, setTroubleshooting] = useState(false);

    // SharePoint Settings State
    const [sharePointConfig, setSharePointConfig] = useState({
        site_url: '',
        sync_interval: 60,
        client_id: '',
        client_secret: '',
        tenant_id: '',
        enabled: false
    });
    const [sharePointTestResult, setSharePointTestResult] = useState<{ success: boolean; message: string } | null>(null);

    const [testingSharePoint, setTestingSharePoint] = useState(false);
    const [, setAnalyzingSharePoint] = useState(false);
    const [, setFullSetupSharePoint] = useState(false);

    // Product Management State
    const [managedProducts, setManagedProducts] = useState<string[]>([]);
    const [newProduct, setNewProduct] = useState('');

    const handleSaveEmailConfig = async () => {
        setIsSaving(true);
        try {
            await apiService.updateEmailConfig(emailConfig);
            // Optionally show success toast
        } catch (error) {
            console.error('Failed to save email config:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestEmail = async () => {
        setTestingEmail(true);
        setEmailTestResult(null);
        try {
            const response = await apiService.testEmailConnection(emailConfig);
            setEmailTestResult({
                success: response.data.status === 'success',
                message: response.data.message
            });
        } catch (error) {
            setEmailTestResult({
                success: false,
                message: 'Connection failed'
            });
        } finally {
            setTestingEmail(false);
        }
    };

    const handleSaveAzureADConfig = async () => {
        setIsSaving(true);
        try {
            await apiService.updateAzureADConfig(azureADConfig);
            // Optionally show success toast
        } catch (error) {
            console.error('Failed to save Azure AD config:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestAzureAD = async () => {
        setTestingAzureAD(true);
        setAzureADTestResult(null);
        try {
            const response = await apiService.testAzureADConfig();
            setAzureADTestResult({
                success: response.data.setup_completed || response.data.status === 'success',
                message: response.data.test_summary || response.data.message
            });
        } catch (error) {
            setAzureADTestResult({
                success: false,
                message: 'Configuration test failed'
            });
        } finally {
            setTestingAzureAD(false);
        }
    };

    const handleTroubleshootAzureAD = async () => {
        setTroubleshooting(true);
        setTroubleshootingResult(null);
        try {
            const response = await apiService.troubleshootAzureAD();
            setTroubleshootingResult(response.data);
        } catch (error) {
            setTroubleshootingResult({
                issues: ['Troubleshooting failed'],
                recommendations: ['Check application logs for details'],
                troubleshooting_summary: { total_issues: 1, total_recommendations: 1 }
            });
        } finally {
            setTroubleshooting(false);
        }
    };

    const handleAutomateAzureADSetup = async () => {
        setAutomatingSetup(true);
        setAutomateSetupResult(null);
        try {
            const response = await apiService.automateAzureADSetup(automateSetupConfig);
            setAutomateSetupResult(response.data);
            if (response.data.success && response.data.application_info) {
                // Update Azure AD config with the new values
                setAzureADConfig({
                    AZURE_AD_ENABLED: true,
                    AZURE_AD_CLIENT_ID: response.data.application_info.client_id,
                    AZURE_AD_CLIENT_SECRET: response.data.application_info.client_secret,
                    AZURE_AD_TENANT_ID: response.data.application_info.tenant_id,
                    AZURE_AD_REDIRECT_URI: response.data.application_info.redirect_uri,
                    AZURE_AD_SCOPES: 'User.Read email profile'
                });
                // Save the new configuration
                await handleSaveAzureADConfig();
            }
        } catch (error) {
            setAutomateSetupResult({
                success: false,
                message: 'Automated setup failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        } finally {
            setAutomatingSetup(false);
        }
    };

    const handleSaveSharePointConfig = async () => {
        setIsSaving(true);
        try {
            await apiService.updateSharePointConfig(sharePointConfig);
            // Optionally show success toast
        } catch (error) {
            console.error('Failed to save SharePoint config:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestSharePoint = async () => {
        setTestingSharePoint(true);
        setSharePointTestResult(null);
        try {
            const response = await apiService.testSharePointAuth();
            setSharePointTestResult({
                success: response.data.status === 'success',
                message: response.data.message
            });
        } catch (error) {
            setSharePointTestResult({
                success: false,
                message: 'Configuration test failed'
            });
        } finally {
            setTestingSharePoint(false);
        }
    };

    const handleAnalyzeSharePointSetup = async () => {
        setAnalyzingSharePoint(true);
        try {
            const response = await apiService.analyzeSharePointSetup();
            setSharePointTestResult({
                success: response.data.setup_completed || response.data.status === 'success',
                message: response.data.test_summary || response.data.message
            });
        } catch (error) {
            setSharePointTestResult({
                success: false,
                message: 'Analysis failed'
            });
        } finally {
            setAnalyzingSharePoint(false);
        }
    };

    const handleFullSharePointSetup = async () => {
        setFullSetupSharePoint(true);
        try {
            const response = await apiService.fullSharePointSetup();
            setSharePointTestResult({
                success: response.data.setup_completed || response.data.status === 'success',
                message: response.data.test_summary || response.data.message
            });
        } catch (error) {
            setSharePointTestResult({
                success: false,
                message: 'Setup failed'
            });
        } finally {
            setFullSetupSharePoint(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    useEffect(() => {
        if (activeTab === 'features' && user?.role === 'ADMIN') {
            fetchFeatureFlags();
        }
    }, [activeTab, user]);

    const fetchFeatureFlags = async () => {
        setLoadingFeatures(true);
        try {
            const response = await apiService.getFeatureFlags();
            setFeatureFlags(response.data.feature_flags);
            setFeatureDescriptions(response.data.descriptions);
        } catch (error) {
            console.error('Failed to fetch feature flags:', error);
        } finally {
            setLoadingFeatures(false);
        }
    };

    const updateFeatureFlag = async (feature: string, enabled: boolean) => {
        // Optimistic update - update UI immediately
        setFeatureFlags(prev => ({ ...prev, [feature]: enabled }));

        try {
            const response = await apiService.updateFeatureFlags({ [feature]: enabled });
            // Update with server response to ensure consistency
            setFeatureFlags(response.data.feature_flags);

            // Show success notification
            const featureName = feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            addNotification({
                message: `${featureName} has been ${enabled ? 'enabled' : 'disabled'} successfully.`,
                type: 'success'
            });
        } catch (error) {
            console.error('Failed to update feature flag:', error);
            // Revert optimistic update on failure
            setFeatureFlags(prev => ({ ...prev, [feature]: !enabled }));

            // Show error notification
            const featureName = feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            addNotification({
                message: `Failed to ${enabled ? 'enable' : 'disable'} ${featureName}. Please try again.`,
                type: 'error'
            });
        }
    };

    const fetchSettings = async () => {
        try {
            const [settingsResponse, visionResponse, daResponse, emailResponse, azureADResponse, sharePointResponse, productsResponse] = await Promise.all([
                apiService.getLLMSettings(),
                apiService.getVisionStatus(),
                apiService.getDevilAdvocateStatus(),
                apiService.getEmailConfig().catch(() => ({ data: null })),
                apiService.getAzureADConfig().catch(() => ({ data: null })),
                apiService.getSharePointConfig().catch(() => ({ data: null })),
                apiService.getProducts().catch(() => ({ data: [] }))
            ]);
            setSettings(settingsResponse.data);
            setVisionEnabled(visionResponse.data.enabled);
            setDaEnabled(daResponse.data.enabled);
            if (emailResponse.data) {
                setEmailConfig(emailResponse.data);
            }
            if (azureADResponse.data) {
                setAzureADConfig({
                    AZURE_AD_ENABLED: azureADResponse.data.AZURE_AD_ENABLED || false,
                    AZURE_AD_CLIENT_ID: azureADResponse.data.AZURE_AD_CLIENT_ID || '',
                    AZURE_AD_CLIENT_SECRET: azureADResponse.data.AZURE_AD_CLIENT_SECRET || '',
                    AZURE_AD_TENANT_ID: azureADResponse.data.AZURE_AD_TENANT_ID || '',
                    AZURE_AD_REDIRECT_URI: azureADResponse.data.AZURE_AD_REDIRECT_URI || '',
                    AZURE_AD_SCOPES: azureADResponse.data.AZURE_AD_SCOPES || 'User.Read'
                });
            }
            if (sharePointResponse.data) {
                setSharePointConfig({
                    enabled: sharePointResponse.data.SHAREPOINT_ENABLED || false,
                    site_url: sharePointResponse.data.SHAREPOINT_SITE_URL || '',
                    sync_interval: sharePointResponse.data.SHAREPOINT_SYNC_INTERVAL || 60,
                    client_id: sharePointResponse.data.SHAREPOINT_CLIENT_ID || '',
                    client_secret: sharePointResponse.data.SHAREPOINT_CLIENT_SECRET || '',
                    tenant_id: sharePointResponse.data.SHAREPOINT_TENANT_ID || ''
                });
            }
            if (productsResponse.data) {
                setManagedProducts(productsResponse.data);
            }
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleVision = async () => {
        try {
            const newValue = !visionEnabled;
            setVisionEnabled(newValue); // Optimistic update
            await apiService.setVisionStatus(newValue);
        } catch (error) {
            console.error('Failed to update vision status:', error);
            setVisionEnabled(!visionEnabled); // Revert
        }
    };

    const toggleDA = async () => {
        try {
            const newValue = !daEnabled;
            setDaEnabled(newValue); // Optimistic update
            await apiService.setDevilAdvocateStatus(newValue);
        } catch (error) {
            console.error('Failed to update DA status:', error);
            setDaEnabled(!daEnabled); // Revert
        }
    };

    const handleTestConnection = async (providerId: string) => {
        setTestingConnection(providerId);
        setTestResult(null);
        try {
            const response = await apiService.testLLMConnection(providerId);
            setTestResult({
                id: providerId,
                success: response.data.status === 'success',
                message: response.data.message
            });
        } catch (error) {
            setTestResult({
                id: providerId,
                success: false,
                message: 'Connection failed'
            });
        } finally {
            setTestingConnection(null);
        }
    };

    const handleTestMapping = async (agentId: string) => {
        setTestingMapping(agentId);
        setMappingTestResult(null);
        try {
            const response = await apiService.testAgentMapping(agentId);
            setMappingTestResult({
                id: agentId,
                success: response.data.status === 'success',
                message: response.data.message,
                response: response.data.response
            });
        } catch (error) {
            setMappingTestResult({
                id: agentId,
                success: false,
                message: 'Integration test failed'
            });
        } finally {
            setTestingMapping(null);
        }
    };

    const handleOpenProviderModal = (provider?: LLMProvider) => {
        if (provider) {
            setEditingProvider({ ...provider, api_key: '' }); // Don't show existing key
        } else {
            setEditingProvider({
                provider_id: '',
                name: '',
                provider_type: 'openai',
                models: [],
                default_model: '',
                parameters: { temperature: 0.7 }
            });
        }
        setIsProviderModalOpen(true);
    };

    const handleSaveProvider = async () => {
        setIsSaving(true);
        try {
            const config = {
                ...editingProvider,
                models: Array.isArray(editingProvider.models)
                    ? editingProvider.models
                    : ((editingProvider.models as unknown as string) || '').split(',').map(m => m.trim()).filter(Boolean)
            };

            // Re-fetch to check if update or create (simple check based on existing list might be better but API handles upsert)
            // Ideally we differentiate PUT vs POST based on if it was editing
            if (config.provider_id && settings?.providers.some(p => p.provider_id === config.provider_id)) {
                await apiService.updateLLMProvider(config.provider_id, config);
            } else {
                await apiService.addLLMProvider(config);
            }

            await fetchSettings();
            setIsProviderModalOpen(false);
        } catch (error) {
            console.error('Failed to save provider:', error);
            // Could add error toast here
        } finally {
            setIsSaving(false);
        }
    };

    const handleOpenMappingModal = async (mapping?: AgentMapping) => {
        if (mapping) {
            setEditingMapping(mapping);
            fetchPromptHistory(mapping.agent_id);
        } else {
            setEditingMapping({
                agent_id: '',
                provider_id: settings?.providers[0]?.provider_id || '',
                model_name: settings?.providers[0]?.default_model || '',
                parameters: { temperature: 0.7 },
                system_prompt: '',
                refinement_prompt: '',
                role: 'Core Orchestrator'
            });
            setPromptHistory([]);
        }
        setIsMappingModalOpen(true);
    };

    const fetchPromptHistory = async (agentId: string) => {
        setIsFetchingHistory(true);
        try {
            const response = await apiService.getPromptHistory(agentId);
            setPromptHistory(response.data);
        } catch (error) {
            console.error('Failed to fetch prompt history:', error);
        } finally {
            setIsFetchingHistory(false);
        }
    };

    const handleRevertPrompt = async (historyId: number) => {
        if (!editingMapping.agent_id) return;
        setIsSaving(true);
        try {
            const response = await apiService.revertPromptVersion(editingMapping.agent_id, historyId);
            setEditingMapping(response.data);
            await fetchPromptHistory(editingMapping.agent_id);
            // Optionally show success message
        } catch (error) {
            console.error('Failed to revert prompt:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveMapping = async () => {
        setIsSaving(true);
        try {
            await apiService.updateAgentMapping(editingMapping);
            await fetchSettings();
            setIsMappingModalOpen(false);
        } catch (error) {
            console.error('Failed to save mapping:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteMapping = (agentId: string) => {
        setMappingToDelete(agentId);
    };

    const confirmDeleteMapping = async () => {
        if (!mappingToDelete) return;
        setIsSaving(true);
        try {
            console.log('Confirming deletion for mapping:', mappingToDelete);
            await apiService.deleteAgentMapping(mappingToDelete);
            await fetchSettings();
            setMappingToDelete(null);
        } catch (error) {
            console.error('Failed to delete mapping:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteProvider = (providerId: string) => {
        setProviderToDelete(providerId);
    };

    const confirmDeleteProvider = async () => {
        if (!providerToDelete) return;
        setIsSaving(true);
        try {
            console.log('Confirming deletion for provider:', providerToDelete);
            await apiService.deleteLLMProvider(providerToDelete);
            await fetchSettings();
            setProviderToDelete(null);
        } catch (error) {
            console.error('Failed to delete provider:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddProduct = async () => {
        if (!newProduct.trim() || managedProducts.includes(newProduct.trim())) return;
        const updated = [...managedProducts, newProduct.trim()];
        setManagedProducts(updated);
        setNewProduct('');
        try {
            await apiService.updateProducts(updated);
        } catch (error) {
            console.error('Failed to update products:', error);
        }
    };

    const handleRemoveProduct = async (product: string) => {
        const updated = managedProducts.filter(p => p !== product);
        setManagedProducts(updated);
        try {
            await apiService.updateProducts(updated);
        } catch (error) {
            console.error('Failed to update products:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-brand-500 text-sm font-bold tracking-widest uppercase">Initializing Settings...</p>
            </div>
        );
    }

    return (
        <div className="space-y-10 pb-20 relative">
            {/* Header */}
            <SectionHeader
                title={
                    activeTab === 'appearance' ? 'Appearance' :
                        activeTab === 'whitelabel' ? 'Branding & Whitelabel' :
                            activeTab === 'sidekick' ? 'Vitesse Assistant' :
                                activeTab === 'wayfinder' ? 'Vitesse Navigator' :
                                    activeTab === 'features' ? 'Feature Matrix' :
                                        activeTab === 'users' ? 'User Management' :
                                            activeTab === 'monitoring' ? 'LLM Monitoring' :
                                                'LLM Services'
                }
                subtitle={
                    activeTab === 'appearance' ? "Personalize your experience with curated color themes and modern design aesthetics." :
                        activeTab === 'sidekick' ? "Configure your proactive AI companion's behavior and intelligence level." :
                            activeTab === 'wayfinder' ? "Manage your always-on navigation assistant and help system." :
                                activeTab === 'integrations' ? "Connect external services like Email for automated ingestion pipelines." :
                                    activeTab === 'features' ? "Enable or disable Vitesse features and use cases for your organization." :
                                        activeTab === 'whitelabel' ? "Customize the platform's brand name, logo, and core identity." :
                                            activeTab === 'users' ? "Manage users, roles, and access permissions." :
                                                activeTab === 'monitoring' ? "Monitor LLM performance, traces, costs, and analytics via Langfuse integration." :
                                                    "Configure your enterprise AI providers, manage API gateways, and assign specialized models."
                }
                icon={
                    activeTab === 'appearance' ? BrainCircuit :
                        activeTab === 'sidekick' ? Sparkles :
                            activeTab === 'wayfinder' ? Bot :
                                activeTab === 'integrations' ? Mail :
                                    activeTab === 'features' ? Zap :
                                        activeTab === 'whitelabel' ? Palette :
                                            activeTab === 'users' ? Users :
                                                activeTab === 'monitoring' ? Activity :
                                                    Cpu
                }
                variant="premium"
                className="!p-0 !bg-transparent !border-none"
                actions={(activeTab === 'providers' || (activeTab === 'agents' && activeAgentTab === 'configuration')) && (
                    <div className="flex flex-col md:flex-row gap-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center gap-4 bg-surface-100 dark:bg-brand-500/[0.03] border border-brand-primary/10 p-4 rounded-2xl shadow-sm"
                        >
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border transition-all", visionEnabled ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-surface-100 dark:bg-brand-500/5 border-brand-100 dark:border-brand-500/10 text-brand-400 dark:text-surface-500")}>
                                {visionEnabled ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-surface-950 dark:text-white">Multi-Modal Vision</h3>
                                <p className="text-[10px] uppercase font-black tracking-wider text-brand-400 dark:text-surface-500">
                                    {visionEnabled ? "Analysis Enabled" : "Text-Only Mode"}
                                </p>
                            </div>
                            <button
                                onClick={toggleVision}
                                className={cn(
                                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-brand-50 dark:focus:ring-offset-[#0A0F1E] ml-4",
                                    visionEnabled ? "bg-brand-primary" : "bg-brand-200 dark:bg-surface-700"
                                )}
                            >
                                <span
                                    className={cn(
                                        "inline-block h-4 w-4 transform rounded-full bg-surface-100 dark:bg-surface-900 transition-transform",
                                        visionEnabled ? "translate-x-6" : "translate-x-1"
                                    )}
                                />
                            </button>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 }}
                            className="flex items-center gap-4 bg-surface-100 dark:bg-brand-500/[0.03] border border-brand-primary/10 p-4 rounded-2xl shadow-sm"
                        >
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border transition-all", daEnabled ? "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400" : "bg-surface-100 dark:bg-brand-500/5 border-brand-100 dark:border-brand-500/10 text-brand-400 dark:text-surface-500")}>
                                <BrainCircuit className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-surface-950 dark:text-white">Devil's Advocate</h3>
                                <p className="text-[10px] uppercase font-black tracking-wider text-brand-400 dark:text-surface-500">
                                    {daEnabled ? "Critique Active" : "Fast Mode"}
                                </p>
                            </div>
                            <button
                                onClick={toggleDA}
                                className={cn(
                                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-brand-50 dark:focus:ring-offset-[#0A0F1E] ml-4",
                                    daEnabled ? "bg-purple-600" : "bg-brand-200 dark:bg-surface-700"
                                )}
                            >
                                <span
                                    className={cn(
                                        "inline-block h-4 w-4 transform rounded-full bg-surface-100 dark:bg-surface-900 transition-transform",
                                        daEnabled ? "translate-x-6" : "translate-x-1"
                                    )}
                                />
                            </button>
                        </motion.div>
                    </div>
                )}
            />

            {/* Tabs */}
            <div className="flex items-center border-b border-brand-100 dark:border-brand-500/10 mb-8 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab('appearance')}
                    className={cn(
                        "px-6 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap",
                        activeTab === 'appearance' ? "border-brand-primary text-brand-primary bg-brand-primary/5" : "border-transparent text-surface-500 hover:text-surface-950 dark:hover:text-white"
                    )}
                >
                    Appearance
                </button>
                {user?.is_superuser && (
                    <>
                        <button
                            onClick={() => setActiveTab('whitelabel')}
                            className={cn(
                                "px-6 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap",
                                activeTab === 'whitelabel' ? "border-brand-primary text-brand-primary bg-brand-primary/5" : "border-transparent text-surface-500 hover:text-surface-950 dark:hover:text-white"
                            )}
                        >
                            Whitelabel
                        </button>
                        <button
                            onClick={() => setActiveTab('providers')}
                            className={cn(
                                "px-6 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap",
                                activeTab === 'providers' ? "border-brand-primary text-brand-primary bg-brand-primary/5" : "border-transparent text-surface-500 hover:text-surface-950 dark:hover:text-white"
                            )}
                        >
                            Providers
                        </button>
                        <button
                            onClick={() => setActiveTab('agents')}
                            className={cn(
                                "px-6 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap",
                                activeTab === 'agents' ? "border-brand-primary text-brand-primary bg-brand-primary/5" : "border-transparent text-surface-500 hover:text-surface-950 dark:hover:text-white"
                            )}
                        >
                            Agents
                        </button>
                        <button
                            onClick={() => setActiveTab('sidekick')}
                            className={cn(
                                "px-6 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap",
                                activeTab === 'sidekick' ? "border-brand-primary text-brand-primary bg-brand-primary/5" : "border-transparent text-surface-500 hover:text-surface-950 dark:hover:text-white"
                            )}
                        >
                            Sidekick
                        </button>
                        <button
                            onClick={() => setActiveTab('wayfinder')}
                            className={cn(
                                "px-6 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap",
                                activeTab === 'wayfinder' ? "border-brand-primary text-brand-primary bg-brand-primary/5" : "border-transparent text-surface-500 hover:text-surface-950 dark:hover:text-white"
                            )}
                        >
                            Wayfinder
                        </button>
                        <button
                            onClick={() => setActiveTab('integrations')}
                            className={cn(
                                "px-6 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap",
                                activeTab === 'integrations' ? "border-brand-primary text-brand-primary bg-brand-primary/5" : "border-transparent text-surface-500 hover:text-surface-950 dark:hover:text-white"
                            )}
                        >
                            Integrations
                        </button>
                        <button
                            onClick={() => setActiveTab('products')}
                            className={cn(
                                "px-6 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap",
                                activeTab === 'products' ? "border-brand-primary text-brand-primary bg-brand-primary/5" : "border-transparent text-surface-500 hover:text-surface-950 dark:hover:text-white"
                            )}
                        >
                            Products
                        </button>
                        <button
                            onClick={() => setActiveTab('features')}
                            className={cn(
                                "px-6 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap",
                                activeTab === 'features' ? "border-brand-primary text-brand-primary bg-brand-primary/5" : "border-transparent text-surface-500 hover:text-surface-950 dark:hover:text-white"
                            )}
                        >
                            Features
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={cn(
                                "px-6 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap",
                                activeTab === 'users' ? "border-brand-primary text-brand-primary bg-brand-primary/5" : "border-transparent text-surface-500 hover:text-surface-950 dark:hover:text-white"
                            )}
                        >
                            Users
                        </button>
                        <button
                            onClick={() => setActiveTab('performance')}
                            className={cn(
                                "px-6 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap",
                                activeTab === 'performance' ? "border-brand-primary text-brand-primary bg-brand-primary/5" : "border-transparent text-surface-500 hover:text-surface-950 dark:hover:text-white"
                            )}
                        >
                            Performance
                        </button>
                        <button
                            onClick={() => setActiveTab('monitoring')}
                            className={cn(
                                "px-6 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap",
                                activeTab === 'monitoring' ? "border-brand-primary text-brand-primary bg-brand-primary/5" : "border-transparent text-surface-500 hover:text-surface-950 dark:hover:text-white"
                            )}
                        >
                            LLM Monitoring
                        </button>
                    </>
                )}
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'appearance' ? (
                    <motion.div
                        key="appearance"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        {/* Theme Selection */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {availableThemes.map((t) => (
                                <motion.button
                                    key={t.id}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setTheme(t.id)}
                                    className={cn(
                                        "premium-card flex flex-col gap-4 text-left transition-all relative overflow-hidden group",
                                        theme === t.id
                                            ? "border-brand-primary ring-2 ring-brand-primary/20 bg-brand-primary/[0.03]"
                                            : "border-glass-border hover:border-brand-primary/50"
                                    )}
                                >
                                    {/* Color Swatches */}
                                    <div className="flex gap-1.5">
                                        <div className="w-8 h-8 rounded-lg shadow-sm" style={{ backgroundColor: t.colors.primary }} />
                                        <div className="w-8 h-8 rounded-lg shadow-sm" style={{ backgroundColor: t.colors.secondary }} />
                                        <div className="w-8 h-8 rounded-lg shadow-sm" style={{ backgroundColor: t.colors.accent }} />
                                    </div>

                                    <div>
                                        <h3 className={cn(
                                            "text-sm font-bold transition-colors",
                                            theme === t.id ? "text-brand-primary" : "text-text-primary"
                                        )}>
                                            {t.name}
                                        </h3>
                                        <p className="text-[10px] text-text-primary/50 line-clamp-2 mt-1 uppercase font-bold tracking-wider leading-tight">
                                            {t.description}
                                        </p>
                                    </div>

                                    {theme === t.id && (
                                        <motion.div
                                            layoutId="active-theme-check"
                                            className="absolute top-4 right-4 text-brand-primary"
                                        >
                                            <CheckCircle2 className="w-5 h-5" />
                                        </motion.div>
                                    )}
                                </motion.button>
                            ))}
                        </div>

                        {/* UI Preferences Section */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="mt-8"
                        >
                            <SectionHeader
                                title="UI Preferences"
                                subtitle="Customize your interface experience"
                                icon={BrainCircuit}
                            />

                            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Sidebar Collapse Setting */}
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="premium-card group relative bg-surface-100 dark:bg-brand-500/[0.02] border-brand-100 dark:border-brand-500/5"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
                                                <BrainCircuit className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-surface-950 dark:text-white">
                                                    Sidebar Collapse
                                                </h3>
                                                <p className="text-sm text-surface-500 dark:text-surface-400">
                                                    Start with sidebar collapsed by default
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-bold text-surface-500 uppercase tracking-widest">
                                                {aiSettings.ui.sidebarCollapsed ? "Collapsed" : "Expanded"}
                                            </span>
                                            <button
                                                onClick={() => updateAISettings('ui', { sidebarCollapsed: !aiSettings.ui.sidebarCollapsed })}
                                                className={cn(
                                                    "relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none",
                                                    aiSettings.ui.sidebarCollapsed ? "bg-brand-primary" : "bg-brand-200 dark:bg-surface-700"
                                                )}
                                            >
                                                <span className={cn(
                                                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                                    aiSettings.ui.sidebarCollapsed ? "translate-x-6" : "translate-x-1"
                                                )} />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        </motion.div>
                    </motion.div>
                ) : activeTab === 'whitelabel' ? (
                    <motion.div
                        key="whitelabel"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="grid grid-cols-1 lg:grid-cols-2 gap-8"
                    >
                        <div className="glass p-8 rounded-[2rem] border border-brand-500/10 space-y-8">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-black text-surface-950 dark:text-white tracking-tight">Whitelabel Configuration</h3>
                                    <p className="text-sm text-surface-500">Enable custom branding across the entire platform.</p>
                                </div>
                                <button
                                    onClick={() => updateWhitelabel({ enabled: !whitelabel.enabled })}
                                    className={cn(
                                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                                        whitelabel.enabled ? "bg-brand-primary" : "bg-surface-300 dark:bg-surface-700"
                                    )}
                                >
                                    <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", whitelabel.enabled ? "translate-x-6" : "translate-x-1")} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-surface-500 px-1">Brand Name</label>
                                    <input
                                        type="text"
                                        value={whitelabel.brand_name}
                                        onChange={(e) => updateWhitelabel({ brand_name: e.target.value })}
                                        className="w-full bg-surface-50 dark:bg-black/20 border border-brand-500/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-bold"
                                        placeholder="AgentStack"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-surface-500 px-1">Creator Attribution</label>
                                    <input
                                        type="text"
                                        value={whitelabel.creator}
                                        readOnly
                                        className="w-full bg-surface-50/50 dark:bg-black/20 border border-brand-500/10 rounded-xl px-4 py-3 text-sm focus:outline-none cursor-not-allowed opacity-70 font-bold"
                                        placeholder="Creator Name"
                                    />
                                    <p className="mt-1 text-[10px] text-surface-400 italic px-1">Customize the creator attribution for your platform.</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-surface-500 px-1">Logo URL</label>
                                    <input
                                        type="text"
                                        value={whitelabel.logo_url || ''}
                                        onChange={(e) => updateWhitelabel({ logo_url: e.target.value || null })}
                                        className="w-full bg-surface-50 dark:bg-black/20 border border-brand-500/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
                                        placeholder="https://example.com/logo.png"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-surface-500 px-1">Primary Brand Color</label>
                                    <div className="flex gap-4">
                                        <input
                                            type="color"
                                            value={whitelabel.primary_color}
                                            onChange={(e) => updateWhitelabel({ primary_color: e.target.value })}
                                            className="w-12 h-12 rounded-xl bg-transparent border-none cursor-pointer p-0 overflow-hidden"
                                        />
                                        <input
                                            type="text"
                                            value={whitelabel.primary_color}
                                            onChange={(e) => updateWhitelabel({ primary_color: e.target.value })}
                                            className="flex-1 bg-surface-50 dark:bg-black/20 border border-brand-500/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-mono"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="glass p-8 rounded-[2rem] border border-emerald-500/10 bg-emerald-500/[0.02]">
                                <h4 className="text-sm font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-4">Preview</h4>
                                <div className="aspect-video bg-surface-950 rounded-2xl border border-white/5 overflow-hidden flex flex-col">
                                    <div className="h-12 border-b border-white/5 px-4 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded bg-brand-primary" style={{ backgroundColor: whitelabel.primary_color }} />
                                            <span className="text-xs font-bold text-white">{whitelabel.brand_name}</span>
                                        </div>
                                        <div className="w-4 h-4 rounded-full bg-white/10" />
                                    </div>
                                    <div className="flex-1 p-6 space-y-4">
                                        <div className="h-8 w-2/3 bg-white/5 rounded-lg" />
                                        <div className="h-4 w-full bg-white/5 rounded-lg" />
                                        <div className="h-4 w-5/6 bg-white/5 rounded-lg" />
                                        <div className="h-10 w-24 rounded-xl mt-8" style={{ backgroundColor: whitelabel.primary_color }} />
                                    </div>
                                    <div className="p-3 border-t border-white/5 bg-black/40">
                                        <p className="text-[8px] text-white/40 uppercase font-black tracking-widest text-center">Built by {whitelabel.creator}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="glass p-8 rounded-[2rem] border border-blue-500/10">
                                <h4 className="text-sm font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2">Creator Mastery</h4>
                                <p className="text-xs text-surface-500 font-medium">Whitelabeling is integrated deep into the design tokens to ensure visual consistency regardless of the primary color chosen.</p>
                            </div>
                        </div>
                    </motion.div>
                ) : activeTab === 'providers' ? (
                    <motion.div
                        key="providers"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="grid grid-cols-1 xl:grid-cols-2 gap-8"
                    >
                        {settings?.providers?.map((provider, idx) => (
                            <motion.div
                                key={provider.provider_id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: idx * 0.1 }}
                                className="premium-card group relative bg-surface-100 dark:bg-brand-500/[0.02] border-brand-100 dark:border-brand-500/5"
                            >
                                <div className="flex items-start justify-between mb-8">
                                    <div className="flex gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20 group-hover:border-brand-500/40 transition-all duration-500">
                                            {provider.provider_type === 'openai' ? <Globe className="w-7 h-7 text-brand-600 dark:text-brand-400" /> : <Database className="w-7 h-7 text-purple-600 dark:text-purple-400" />}
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-surface-950 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                                                {provider.name}
                                            </h3>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500 mt-1">
                                                {provider.provider_type} Mode
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleTestConnection(provider.provider_id)}
                                            disabled={testingConnection === provider.provider_id}
                                            className="p-2.5 rounded-xl bg-surface-100 dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/10 text-brand-400 dark:text-surface-400 hover:text-brand-600 dark:hover:text-brand-400 hover:border-brand-500/30 transition-all"
                                            title="Test Connection"
                                        >
                                            {testingConnection === provider.provider_id ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                                        </button>
                                        <button
                                            onClick={() => handleOpenProviderModal(provider)}
                                            className="p-2.5 rounded-xl bg-surface-100 dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/10 text-brand-400 dark:text-surface-400 hover:text-brand-600 dark:hover:text-brand-400 hover:border-brand-500/30 transition-all"
                                            title="Edit Provider"
                                        >
                                            <Edit2 className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteProvider(provider.provider_id)}
                                            className="p-2.5 rounded-xl bg-surface-100 dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/10 text-brand-400 dark:text-surface-400 hover:text-red-600 dark:hover:text-red-400 hover:border-red-500/30 transition-all"
                                            title="Delete Provider"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="bg-brand-50/50 dark:bg-brand-950/20 rounded-2xl p-4 border border-brand-100 dark:border-brand-500/5">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500 mb-2 block">Endpoint Gateway</label>
                                            <div className="flex items-center gap-3">
                                                <Globe className="w-4 h-4 text-brand-500 dark:text-surface-600" />
                                                <p className="text-sm text-surface-950 dark:text-white font-mono truncate">
                                                    {provider.api_endpoint || 'Standard Provider Endpoint'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="bg-brand-50/50 dark:bg-brand-950/20 rounded-2xl p-4 border border-brand-100 dark:border-brand-500/5">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500 mb-2 block">API Security</label>
                                            <div className="flex items-center gap-3">
                                                <Key className="w-4 h-4 text-brand-500 dark:text-surface-600" />
                                                <p className="text-sm text-brand-400 dark:text-surface-500 tracking-tighter">
                                                    ••••••••••••••••••••••••••••••••
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500 mb-3 flex items-center gap-2">
                                            <Cpu className="w-3 h-3" />
                                            Deployment Models
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {provider.models.map(model => (
                                                <span
                                                    key={model}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all",
                                                        model === provider.default_model ? "bg-brand-500/10 border-brand-500/30 text-brand-600 dark:text-brand-400" : "bg-surface-100 dark:bg-brand-500/[0.03] border-brand-100 dark:border-brand-500/5 text-brand-400 dark:text-surface-500"
                                                    )}
                                                >
                                                    {model}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Test Result Feedback */}
                                {testResult?.id === provider.provider_id && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className={cn(
                                            "mt-6 p-4 rounded-2xl border flex items-center gap-3",
                                            testResult.success ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-red-500/5 border-red-500/20 text-red-600 dark:text-red-400"
                                        )}
                                    >
                                        {testResult.success ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                        <p className="text-sm font-bold tracking-tight">{testResult.message}</p>
                                    </motion.div>
                                )}
                            </motion.div>
                        ))}

                        <motion.button
                            onClick={() => handleOpenProviderModal()}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="premium-card flex flex-col items-center justify-center gap-4 py-16 border-dashed border-brand-200 dark:border-brand-500/10 bg-transparent hover:bg-brand-50/50 dark:hover:bg-surface-50/[0.02] transition-colors group"
                        >
                            <div className="w-16 h-16 rounded-full bg-brand-100 dark:bg-surface-800 flex items-center justify-center text-brand-400 dark:text-surface-500 group-hover:text-brand-600 dark:group-hover:text-brand-400 group-hover:bg-brand-500/10 transition-all">
                                <Plus className="w-8 h-8" />
                            </div>
                            <div className="text-center">
                                <p className="text-lg font-bold text-surface-950 dark:text-white">Add New Provider</p>
                                <p className="text-sm text-brand-400 dark:text-surface-500">AWS Bedrock, Azure, or Custom API</p>
                            </div>
                        </motion.button>
                    </motion.div>
                ) : activeTab === 'agents' ? (
                    <motion.div
                        key="agents"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-6 w-full"
                    >
                        {/* Sub-tabs for Agents */}
                        <div className="flex justify-center mb-6">
                            <div className="p-1.5 rounded-xl bg-surface-100 dark:bg-brand-500/[0.03] border border-brand-primary/10 flex items-center gap-2">
                                <button
                                    onClick={() => setActiveAgentTab('workforce')}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                                        activeAgentTab === 'workforce' ? "bg-white dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 shadow-sm" : "text-brand-400 dark:text-surface-500 hover:text-brand-600 dark:hover:text-brand-400"
                                    )}
                                >
                                    Workforce
                                </button>
                                <button
                                    onClick={() => setActiveAgentTab('configuration')}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                                        activeAgentTab === 'configuration' ? "bg-white dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 shadow-sm" : "text-brand-400 dark:text-surface-500 hover:text-brand-600 dark:hover:text-brand-400"
                                    )}
                                >
                                    Configuration
                                </button>
                                <button
                                    onClick={() => setActiveAgentTab('prompts')}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                                        activeAgentTab === 'prompts' ? "bg-white dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 shadow-sm" : "text-brand-400 dark:text-surface-500 hover:text-brand-600 dark:hover:text-brand-400"
                                    )}
                                >
                                    Prompts
                                </button>
                            </div>
                        </div>

                        {activeAgentTab === 'workforce' ? (
                            <AgentGrid />
                        ) : activeAgentTab === 'prompts' ? (
                            <PromptManagement />
                        ) : (
                            <div className="space-y-6 w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="premium-card !p-0 overflow-hidden border-brand-100 dark:border-brand-500/5">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-brand-100 dark:border-brand-500/5 bg-brand-50/50 dark:bg-brand-500/[0.02]">
                                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500">System Agent</th>
                                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500">Assigned Provider</th>
                                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500">Operation Model</th>
                                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-brand-50 dark:divide-white/5">
                                            {settings?.mappings?.map((mapping, idx) => (
                                                <React.Fragment key={idx}>
                                                    <tr className="group hover:bg-brand-50/30 dark:hover:bg-surface-50/[0.01] transition-all">
                                                        <td className="px-8 py-6">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
                                                                    <Cpu className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-bold text-surface-950 dark:text-white capitalize">{mapping.agent_id.replace(/-/g, ' ')}</p>
                                                                    <p className="text-[10px] text-brand-400 dark:text-surface-500 font-bold uppercase tracking-tighter">{mapping.role || 'Core Orchestrator'}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-6">
                                                            <div className="flex items-center gap-2">
                                                                <Database className="w-3 h-3 text-brand-400 dark:text-surface-500" />
                                                                <span className="text-sm text-surface-600 dark:text-surface-300">
                                                                    {settings.providers?.find(p => p.provider_id === mapping.provider_id)?.name || mapping.provider_id}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-6">
                                                            <span className="px-2.5 py-1 rounded-lg bg-brand-500/5 border border-brand-500/20 text-[10px] font-black text-brand-600 dark:text-brand-400 uppercase tracking-widest">
                                                                {mapping.model_name}
                                                            </span>
                                                        </td>
                                                        <td className="px-8 py-6 text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleTestMapping(mapping.agent_id)}
                                                                    className="p-2 hover:bg-brand-100 dark:hover:bg-surface-50/5 rounded-lg transition-colors text-brand-400 hover:text-brand-600 dark:text-surface-500 dark:hover:text-brand-400"
                                                                    title="Run Agent Test"
                                                                    disabled={testingMapping === mapping.agent_id}
                                                                >
                                                                    {testingMapping === mapping.agent_id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleOpenMappingModal(mapping)}
                                                                    className="p-2 hover:bg-brand-100 dark:hover:bg-surface-50/5 rounded-lg transition-colors text-brand-600 dark:text-brand-400"
                                                                    title="Edit Mapping"
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteMapping(mapping.agent_id)}
                                                                    className="p-2 hover:bg-brand-100 dark:hover:bg-surface-50/5 rounded-lg transition-colors text-brand-400 hover:text-red-600 dark:text-surface-500 dark:hover:text-red-400"
                                                                    title="Delete Mapping"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {mappingTestResult?.id === mapping.agent_id && (
                                                        <tr>
                                                            <td colSpan={4} className="px-8 py-3 bg-brand-50/20 dark:bg-brand-500/[0.01]">
                                                                <motion.div
                                                                    initial={{ opacity: 0, height: 0 }}
                                                                    animate={{ opacity: 1, height: 'auto' }}
                                                                    className={cn(
                                                                        "p-3 rounded-xl border text-xs font-bold flex items-center gap-2",
                                                                        mappingTestResult.success ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600" : "bg-red-500/5 border-red-500/20 text-red-600"
                                                                    )}
                                                                >
                                                                    {mappingTestResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                                                    {mappingTestResult.message}
                                                                    {mappingTestResult.response && <span className="ml-2 font-mono text-[10px] bg-brand-500/10 px-2 py-0.5 rounded italic opacity-70">LLM: {mappingTestResult.response}</span>}
                                                                    <button
                                                                        className="ml-auto text-[10px] uppercase tracking-widest opacity-50 hover:opacity-100"
                                                                        onClick={() => setMappingTestResult(null)}
                                                                    >
                                                                        Dismiss
                                                                    </button>
                                                                </motion.div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex justify-center pt-4">
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleOpenMappingModal()}
                                        className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-brand-500/5 border border-brand-500/20 text-brand-600 dark:text-brand-400 text-xs font-black uppercase tracking-widest hover:bg-brand-500/10 transition-all group"
                                    >
                                        <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
                                        Define New Agent Mapping
                                    </motion.button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                ) : activeTab === 'sidekick' ? (
                    <motion.div
                        key="sidekick"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-8"
                    >
                        <div className="premium-card bg-surface-100 dark:bg-brand-500/[0.02] border-brand-100 dark:border-brand-500/5 p-8">
                            <div className="flex items-start justify-between mb-8">
                                <div className="flex gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
                                        <Sparkles className="w-7 h-7 text-brand-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-surface-950 dark:text-white">AgentStack Sidekick</h3>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500 mt-1">Contextual AI Sidebar</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-surface-500 uppercase tracking-widest">{aiSettings.sidekick.enabled ? "Enabled" : "Disabled"}</span>
                                    <button
                                        onClick={() => updateAISettings('sidekick', { enabled: !aiSettings.sidekick.enabled })}
                                        className={cn(
                                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                                            aiSettings.sidekick.enabled ? "bg-brand-primary" : "bg-brand-200 dark:bg-surface-700"
                                        )}
                                    >
                                        <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", aiSettings.sidekick.enabled ? "translate-x-6" : "translate-x-1")} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-6 rounded-2xl bg-brand-50/50 dark:bg-brand-950/20 border border-brand-100 dark:border-brand-500/5">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <RefreshCw className="w-4 h-4 text-brand-500" />
                                            <label className="text-sm font-bold text-surface-950 dark:text-white">Navigation Sync</label>
                                        </div>
                                        <button
                                            onClick={() => updateAISettings('sidekick', { autoRefresh: !aiSettings.sidekick.autoRefresh })}
                                            className={cn(
                                                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                                                aiSettings.sidekick.autoRefresh ? "bg-brand-primary" : "bg-brand-200 dark:bg-surface-700"
                                            )}
                                        >
                                            <span className={cn("inline-block h-3 w-3 transform rounded-full bg-white transition-transform", aiSettings.sidekick.autoRefresh ? "translate-x-5" : "translate-x-1")} />
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-brand-400 dark:text-surface-500 uppercase font-black tracking-widest leading-relaxed">
                                        Automatically refresh insights when navigating between pages to maintain deep context.
                                    </p>
                                </div>

                                <div className="p-6 rounded-2xl bg-brand-50/50 dark:bg-brand-950/20 border border-brand-100 dark:border-brand-500/5">
                                    <label className="text-sm font-bold text-surface-950 dark:text-white mb-4 flex items-center gap-2">
                                        <Terminal className="w-4 h-4 text-brand-500" />
                                        Insight Complexity
                                    </label>
                                    <div className="flex gap-2">
                                        {(['concise', 'detailed'] as const).map((v) => (
                                            <button
                                                key={v}
                                                onClick={() => updateAISettings('sidekick', { verbosity: v })}
                                                className={cn(
                                                    "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                                                    aiSettings.sidekick.verbosity === v ? "bg-brand-500/10 border-brand-500/30 text-brand-600 dark:text-brand-400" : "bg-surface-100 dark:bg-brand-500/[0.03] border-brand-100 dark:border-brand-500/5 text-brand-400 dark:text-surface-500"
                                                )}
                                            >
                                                {v}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="col-span-1 md:col-span-2 p-6 rounded-2xl bg-brand-50/50 dark:bg-brand-950/20 border border-brand-100 dark:border-brand-500/5">
                                    <div className="flex items-center justify-between mb-4">
                                        <label className="text-sm font-bold text-surface-950 dark:text-white flex items-center gap-2">
                                            <Database className="w-4 h-4 text-brand-500" />
                                            Response Caching
                                        </label>
                                        <span className="text-xs font-bold text-brand-500 bg-brand-500/10 px-2 py-1 rounded-lg">
                                            {aiSettings.sidekick.cacheDuration ?? 60} min
                                        </span>
                                    </div>

                                    <input
                                        type="range"
                                        min="0"
                                        max="120"
                                        step="5"
                                        value={aiSettings.sidekick.cacheDuration ?? 60}
                                        onChange={(e) => updateAISettings('sidekick', { cacheDuration: parseInt(e.target.value) })}
                                        className="w-full h-2 bg-brand-200 dark:bg-surface-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
                                    />
                                    <div className="flex justify-between mt-2 text-[10px] text-surface-400 font-medium uppercase tracking-wider">
                                        <span>Disable (0m)</span>
                                        <span>1 Hour</span>
                                        <span>2 Hours</span>
                                    </div>
                                    <p className="text-[10px] text-brand-400 dark:text-surface-500 uppercase font-black tracking-widest leading-relaxed mt-4">
                                        Cache analyzed insights to speed up load times on revisited pages. Set to 0 to always regenerate.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ) : activeTab === 'integrations' ? (
                    <motion.div
                        key="integrations"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-8"
                    >
                        <div className="premium-card bg-surface-100 dark:bg-brand-500/[0.02] border-brand-100 dark:border-brand-500/5 p-8 max-w-4xl mx-auto">
                            <div className="flex items-start justify-between mb-8">
                                <div className="flex gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
                                        <Mail className="w-7 h-7 text-brand-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-surface-950 dark:text-white">Email Ingestion Channel</h3>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500 mt-1">Automated Pipeline Triggers</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-surface-500 uppercase tracking-widest">{emailConfig.enabled ? "Active" : "Inactive"}</span>
                                    <button
                                        onClick={() => setEmailConfig({ ...emailConfig, enabled: !emailConfig.enabled })}
                                        className={cn(
                                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                                            emailConfig.enabled ? "bg-brand-primary" : "bg-brand-200 dark:bg-surface-700"
                                        )}
                                    >
                                        <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", emailConfig.enabled ? "translate-x-6" : "translate-x-1")} />
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={(e) => { e.preventDefault(); handleSaveEmailConfig(); }} className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500 mb-2 block">IMAP Server</label>
                                        <input
                                            type="text"
                                            value={emailConfig.server}
                                            onChange={(e) => setEmailConfig({ ...emailConfig, server: e.target.value })}
                                            className="w-full bg-surface-50 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-500/10 rounded-xl p-3 text-sm focus:outline-none focus:border-brand-500/50"
                                            placeholder="imap.gmail.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500 mb-2 block">Port</label>
                                        <input
                                            type="number"
                                            value={emailConfig.port}
                                            onChange={(e) => setEmailConfig({ ...emailConfig, port: parseInt(e.target.value) })}
                                            className="w-full bg-surface-50 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-500/10 rounded-xl p-3 text-sm focus:outline-none focus:border-brand-500/50"
                                            placeholder="993"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500 mb-2 block">Username</label>
                                        <input
                                            type="text"
                                            autoComplete="username"
                                            value={emailConfig.username}
                                            onChange={(e) => setEmailConfig({ ...emailConfig, username: e.target.value })}
                                            className="w-full bg-surface-50 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-500/10 rounded-xl p-3 text-sm focus:outline-none focus:border-brand-500/50"
                                            placeholder="user@example.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500 mb-2 block">App Password</label>
                                        <div className="relative">
                                            <input
                                                type="password"
                                                autoComplete="current-password"
                                                value={emailConfig.password}
                                                onChange={(e) => setEmailConfig({ ...emailConfig, password: e.target.value })}
                                                className="w-full bg-surface-100 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-500/10 rounded-xl p-3 text-sm focus:outline-none focus:border-brand-500/50"
                                                placeholder="••••••••"
                                            />
                                            <p className="mt-2 text-[10px] text-surface-500 dark:text-surface-400 leading-relaxed">
                                                For Gmail, you must use an <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:text-brand-600 underline">App Password</a> if 2-Step Verification is enabled.
                                            </p>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500 mb-2 block">Poll Frequency (Seconds)</label>
                                        <input
                                            type="number"
                                            min="10"
                                            value={emailConfig.poll_interval}
                                            onChange={(e) => setEmailConfig({ ...emailConfig, poll_interval: parseInt(e.target.value) || 60 })}
                                            className="w-full bg-surface-100 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-500/10 rounded-xl p-3 text-sm focus:outline-none focus:border-brand-500/50"
                                            placeholder="60"
                                        />
                                    </div>
                                </div>
                            </form>

                            <div className="border-t border-brand-100 dark:border-brand-500/5 pt-6 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <div className={cn("w-2 h-2 rounded-full animate-pulse", emailConfig.enabled ? "bg-emerald-500" : "bg-surface-400")} />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500">
                                                {emailConfig.enabled ? "Scheduler Running" : "Scheduler Stopped"}
                                            </span>
                                        </div>
                                        {/* @ts-ignore */}
                                        {emailConfig.last_poll_time && (
                                            <span className="text-[10px] text-surface-400 ml-4">
                                                {/* @ts-ignore */}
                                                Last active: {new Date(emailConfig.last_poll_time + 'Z').toLocaleTimeString()}
                                            </span>
                                        )}
                                    </div>

                                    <button
                                        onClick={handleTestEmail}
                                        disabled={testingEmail}
                                        className="btn-secondary !bg-surface-100 dark:!bg-brand-500/5 !text-brand-600 dark:!text-brand-400 flex items-center gap-2"
                                    >
                                        {testingEmail ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                        Test Connection
                                    </button>
                                    {emailTestResult && (
                                        <div className={cn("text-xs font-bold flex items-center gap-2", emailTestResult.success ? "text-emerald-500" : "text-red-500")}>
                                            {emailTestResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                            {emailTestResult.message}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={handleSaveEmailConfig}
                                    disabled={isSaving}
                                    className="btn-primary px-8 py-3"
                                >
                                    {isSaving ? "Saving..." : "Save Configuration"}
                                </button>
                            </div>
                        </div>

                        {/* SharePoint Configuration */}
                        <div className="premium-card bg-surface-100 dark:bg-brand-500/[0.02] border-brand-100 dark:border-brand-500/5 p-8 max-w-4xl mx-auto">
                            <div className="flex items-start justify-between mb-8">
                                <div className="flex gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                        <Globe className="w-7 h-7 text-blue-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-surface-950 dark:text-white">SharePoint Integration</h3>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500 mt-1">Enterprise Document Management</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-surface-500 uppercase tracking-widest">{sharePointConfig.enabled ? "Active" : "Inactive"}</span>
                                    <button
                                        onClick={() => setSharePointConfig({ ...sharePointConfig, enabled: !sharePointConfig.enabled })}
                                        className={cn(
                                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                                            sharePointConfig.enabled ? "bg-brand-primary" : "bg-brand-200 dark:bg-surface-700"
                                        )}
                                    >
                                        <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", sharePointConfig.enabled ? "translate-x-6" : "translate-x-1")} />
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={(e) => { e.preventDefault(); handleSaveSharePointConfig(); }} className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500 mb-2 block">SharePoint URL</label>
                                        <input
                                            type="text"
                                            value={sharePointConfig.site_url}
                                            onChange={(e) => setSharePointConfig({ ...sharePointConfig, site_url: e.target.value })}
                                            className="w-full bg-surface-50 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-500/10 rounded-xl p-3 text-sm focus:outline-none focus:border-brand-500/50"
                                            placeholder="https://your-domain.sharepoint.com/sites/your-site"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500 mb-2 block">Sync Interval (Minutes)</label>
                                        <input
                                            type="number"
                                            value={sharePointConfig.sync_interval}
                                            onChange={(e) => setSharePointConfig({ ...sharePointConfig, sync_interval: parseInt(e.target.value) })}
                                            className="w-full bg-surface-50 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-500/10 rounded-xl p-3 text-sm focus:outline-none focus:border-brand-500/50"
                                            placeholder="60"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500 mb-2 block">Client ID</label>
                                        <input
                                            type="text"
                                            autoComplete="username"
                                            value={sharePointConfig.client_id}
                                            onChange={(e) => setSharePointConfig({ ...sharePointConfig, client_id: e.target.value })}
                                            className="w-full bg-surface-50 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-500/10 rounded-xl p-3 text-sm focus:outline-none focus:border-brand-500/50"
                                            placeholder="Client ID"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500 mb-2 block">Client Secret</label>
                                        <input
                                            type="password"
                                            autoComplete="current-password"
                                            value={sharePointConfig.client_secret}
                                            onChange={(e) => setSharePointConfig({ ...sharePointConfig, client_secret: e.target.value })}
                                            className="w-full bg-surface-50 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-500/10 rounded-xl p-3 text-sm focus:outline-none focus:border-brand-500/50"
                                            placeholder="Client Secret"
                                        />
                                    </div>
                                </div>
                            </form>

                            <div className="border-t border-brand-100 dark:border-brand-500/5 pt-6 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={handleTestSharePoint}
                                            disabled={testingSharePoint}
                                            className="btn-secondary !bg-surface-100 dark:!bg-brand-500/5 !text-brand-600 dark:!text-brand-400 flex items-center gap-2"
                                        >
                                            {testingSharePoint ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                            Test Configuration
                                        </button>
                                        <button
                                            onClick={handleAnalyzeSharePointSetup}
                                            disabled={testingSharePoint}
                                            className="btn-secondary !bg-surface-100 dark:!bg-brand-500/5 !text-brand-600 dark:!text-brand-400 flex items-center gap-2"
                                        >
                                            <Terminal className="w-4 h-4" />
                                            Analyze Setup
                                        </button>
                                        <button
                                            onClick={handleFullSharePointSetup}
                                            disabled={testingSharePoint}
                                            className="btn-secondary !bg-surface-100 dark:!bg-brand-500/5 !text-brand-600 dark:!text-brand-400 flex items-center gap-2"
                                        >
                                            <Bot className="w-4 h-4" />
                                            Full Setup
                                        </button>
                                        {sharePointTestResult && (
                                            <div className={cn("text-xs font-bold flex items-center gap-2", sharePointTestResult.success ? "text-emerald-500" : "text-red-500")}>
                                                {sharePointTestResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                                {sharePointTestResult.message}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={handleSaveSharePointConfig}
                                    disabled={isSaving}
                                    className="btn-primary px-8 py-3"
                                >
                                    {isSaving ? "Saving..." : "Save Configuration"}
                                </button>
                            </div>
                        </div>

                        {/* Azure AD SSO Configuration */}
                        <div className="premium-card bg-surface-100 dark:bg-brand-500/[0.02] border-brand-100 dark:border-brand-500/5 p-8 max-w-4xl mx-auto">
                            <div className="flex items-start justify-between mb-8">
                                <div className="flex gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                        <Globe className="w-7 h-7 text-blue-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-surface-950 dark:text-white">Azure AD SSO</h3>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500 mt-1">Single Sign-On Integration</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-surface-500 uppercase tracking-widest">{azureADConfig.AZURE_AD_ENABLED ? "Active" : "Inactive"}</span>
                                    <button
                                        onClick={() => setAzureADConfig({ ...azureADConfig, AZURE_AD_ENABLED: !azureADConfig.AZURE_AD_ENABLED })}
                                        className={cn(
                                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                                            azureADConfig.AZURE_AD_ENABLED ? "bg-brand-primary" : "bg-brand-200 dark:bg-surface-700"
                                        )}
                                    >
                                        <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", azureADConfig.AZURE_AD_ENABLED ? "translate-x-6" : "translate-x-1")} />
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={(e) => { e.preventDefault(); handleSaveAzureADConfig(); }} className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500 mb-2 block">Client ID</label>
                                        <input
                                            type="text"
                                            autoComplete="username"
                                            value={azureADConfig.AZURE_AD_CLIENT_ID}
                                            onChange={(e) => setAzureADConfig({ ...azureADConfig, AZURE_AD_CLIENT_ID: e.target.value })}
                                            className="w-full bg-surface-50 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-500/10 rounded-xl p-3 text-sm focus:outline-none focus:border-brand-500/50"
                                            placeholder="Application (client) ID"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500 mb-2 block">Client Secret</label>
                                        <input
                                            type="password"
                                            autoComplete="current-password"
                                            value={azureADConfig.AZURE_AD_CLIENT_SECRET}
                                            onChange={(e) => setAzureADConfig({ ...azureADConfig, AZURE_AD_CLIENT_SECRET: e.target.value })}
                                            className="w-full bg-surface-50 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-500/10 rounded-xl p-3 text-sm focus:outline-none focus:border-brand-500/50"
                                            placeholder="Client secret"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500 mb-2 block">Tenant ID</label>
                                        <input
                                            type="text"
                                            value={azureADConfig.AZURE_AD_TENANT_ID}
                                            onChange={(e) => setAzureADConfig({ ...azureADConfig, AZURE_AD_TENANT_ID: e.target.value })}
                                            className="w-full bg-surface-50 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-500/10 rounded-xl p-3 text-sm focus:outline-none focus:border-brand-500/50"
                                            placeholder="Directory (tenant) ID"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500 mb-2 block">Redirect URI</label>
                                        <input
                                            type="text"
                                            value={azureADConfig.AZURE_AD_REDIRECT_URI}
                                            onChange={(e) => setAzureADConfig({ ...azureADConfig, AZURE_AD_REDIRECT_URI: e.target.value })}
                                            className="w-full bg-surface-50 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-500/10 rounded-xl p-3 text-sm focus:outline-none focus:border-brand-500/50"
                                            placeholder="http://localhost:3000/login"
                                        />
                                    </div>
                                </div>
                                <div className="col-span-1 md:col-span-2">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500 mb-2 block">Scopes</label>
                                        <input
                                            type="text"
                                            value={azureADConfig.AZURE_AD_SCOPES}
                                            onChange={(e) => setAzureADConfig({ ...azureADConfig, AZURE_AD_SCOPES: e.target.value })}
                                            className="w-full bg-surface-50 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-500/10 rounded-xl p-3 text-sm focus:outline-none focus:border-brand-500/50"
                                            placeholder="User.Read"
                                        />
                                    </div>
                                </div>
                            </form>

                            <div className="border-t border-brand-100 dark:border-brand-500/5 pt-6 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={handleTestAzureAD}
                                            disabled={testingAzureAD}
                                            className="btn-secondary !bg-surface-100 dark:!bg-brand-500/5 !text-brand-600 dark:!text-brand-400 flex items-center gap-2"
                                        >
                                            {testingAzureAD ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                            Test Configuration
                                        </button>
                                        <button
                                            onClick={handleTroubleshootAzureAD}
                                            disabled={testingAzureAD}
                                            className="btn-secondary !bg-surface-100 dark:!bg-brand-500/5 !text-brand-600 dark:!text-brand-400 flex items-center gap-2"
                                        >
                                            <Terminal className="w-4 h-4" />
                                            Troubleshoot
                                        </button>
                                        <button
                                            onClick={() => setIsAutomateSetupModalOpen(true)}
                                            disabled={testingAzureAD}
                                            className="btn-secondary !bg-surface-100 dark:!bg-brand-500/5 !text-brand-600 dark:!text-brand-400 flex items-center gap-2"
                                        >
                                            <Bot className="w-4 h-4" />
                                            Automate Setup
                                        </button>
                                        {azureADTestResult && (
                                            <div className={cn("text-xs font-bold flex items-center gap-2", azureADTestResult.success ? "text-emerald-500" : "text-red-500")}>
                                                {azureADTestResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                                {azureADTestResult.message}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={handleSaveAzureADConfig}
                                    disabled={isSaving}
                                    className="btn-primary px-8 py-3"
                                >
                                    {isSaving ? "Saving..." : "Save Configuration"}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ) : activeTab === 'wayfinder' ? (
                    <motion.div
                        key="wayfinder"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-8"
                    >
                        <div className="premium-card bg-surface-100 dark:bg-brand-500/[0.02] border-brand-100 dark:border-brand-500/5 p-8">
                            <div className="flex items-start justify-between mb-8">
                                <div className="flex gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
                                        <Bot className="w-7 h-7 text-brand-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-surface-950 dark:text-white">AgentStack Wayfinder</h3>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500 mt-1">AI Support & Navigation Agent</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-surface-500 uppercase tracking-widest">{aiSettings.wayfinder.enabled ? "Enabled" : "Disabled"}</span>
                                    <button
                                        onClick={() => updateAISettings('wayfinder', { enabled: !aiSettings.wayfinder.enabled })}
                                        className={cn(
                                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                                            aiSettings.wayfinder.enabled ? "bg-brand-primary" : "bg-brand-200 dark:bg-surface-700"
                                        )}
                                    >
                                        <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", aiSettings.wayfinder.enabled ? "translate-x-6" : "translate-x-1")} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-6 rounded-2xl bg-brand-50/50 dark:bg-brand-950/20 border border-brand-100 dark:border-brand-500/5">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <BrainCircuit className="w-4 h-4 text-brand-500" />
                                            <label className="text-sm font-bold text-surface-950 dark:text-white">Welcome Message</label>
                                        </div>
                                        <button
                                            onClick={() => updateAISettings('wayfinder', { showWelcome: !aiSettings.wayfinder.showWelcome })}
                                            className={cn(
                                                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                                                aiSettings.wayfinder.showWelcome ? "bg-brand-primary" : "bg-brand-200 dark:bg-surface-700"
                                            )}
                                        >
                                            <span className={cn("inline-block h-3 w-3 transform rounded-full bg-white transition-transform", aiSettings.wayfinder.showWelcome ? "translate-x-5" : "translate-x-1")} />
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-brand-400 dark:text-surface-500 uppercase font-black tracking-widest leading-relaxed">
                                        Show an automated greeting when the Wayfinder is opened for the first time in a session.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ) : activeTab === 'products' ? (
                    <motion.div
                        key="products"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-8"
                    >
                        <div className="premium-card bg-surface-100 dark:bg-brand-500/[0.02] border-brand-100 dark:border-brand-500/5 p-8 max-w-4xl mx-auto">
                            <div className="flex items-start justify-between mb-8">
                                <div className="flex gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
                                        <Sparkles className="w-7 h-7 text-brand-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-surface-950 dark:text-white">Product Intelligence Segregation</h3>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500 mt-1">Manage product perspectives for specialized indexing</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex gap-4">
                                    <input
                                        type="text"
                                        value={newProduct}
                                        onChange={(e) => setNewProduct(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddProduct()}
                                        placeholder="Add new product (e.g. compliance-ai)"
                                        className="flex-1 bg-surface-50 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-500/10 rounded-xl p-3 text-sm focus:outline-none focus:border-brand-500/50"
                                    />
                                    <button
                                        onClick={handleAddProduct}
                                        className="btn-primary px-8 py-3 rounded-xl text-sm font-bold"
                                    >
                                        Add Product
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {managedProducts.map((product) => (
                                        <div
                                            key={product}
                                            className="p-4 rounded-xl bg-brand-50/50 dark:bg-brand-950/20 border border-brand-100 dark:border-brand-500/5 flex items-center justify-between group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                                <span className="text-sm font-bold text-surface-950 dark:text-white uppercase tracking-wider">{product}</span>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveProduct(product)}
                                                className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-surface-400 hover:text-red-500 rounded-lg transition-all"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    {managedProducts.length === 0 && (
                                        <div className="col-span-full py-12 text-center text-surface-400 font-medium italic">
                                            No products configured. System will use general perspective.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ) : activeTab === 'features' && user?.is_superuser ? (
                    <motion.div
                        key="features"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-8"
                    >
                        <div className="premium-card bg-surface-100 dark:bg-brand-500/[0.02] border-brand-100 dark:border-brand-500/5 p-8 max-w-4xl mx-auto">
                            <div className="flex items-start justify-between mb-8">
                                <div className="flex gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
                                        <Zap className="w-7 h-7 text-brand-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-surface-950 dark:text-white">Feature Matrix</h3>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-400 dark:text-surface-500 mt-1">Enable or disable AgentStack features</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {loadingFeatures ? (
                                    <div className="flex items-center justify-center py-8">
                                        <RefreshCw className="w-6 h-6 animate-spin text-brand-500" />
                                        <span className="ml-2 text-surface-600 dark:text-surface-400">Loading features...</span>
                                    </div>
                                ) : (
                                    Object.entries(featureFlags).map(([feature, enabled]) => (
                                        <div key={feature} className="flex items-center justify-between p-4 bg-surface-50 dark:bg-brand-500/5 rounded-xl border border-brand-100 dark:border-brand-500/10">
                                            <div className="flex-1">
                                                <h4 className="text-sm font-bold text-surface-950 dark:text-white capitalize">
                                                    {feature.replace(/_/g, ' ')}
                                                </h4>
                                                <p className="text-xs text-surface-600 dark:text-surface-400 mt-1">
                                                    {featureDescriptions[feature] || 'No description available'}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => updateFeatureFlag(feature, !enabled)}
                                                className={cn(
                                                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
                                                    enabled ? "bg-brand-500" : "bg-surface-300 dark:bg-surface-600"
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                                        enabled ? "translate-x-6" : "translate-x-1"
                                                    )}
                                                />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </motion.div>
                ) : activeTab === 'users' ? (
                    <motion.div
                        key="users"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-8"
                    >
                        <UserManagement />
                    </motion.div>
                ) : activeTab === 'performance' && user?.is_superuser ? (
                    <motion.div
                        key="performance"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-8"
                    >
                        <AdminPerformanceDashboard />
                    </motion.div>
                ) : activeTab === 'monitoring' ? (
                    <motion.div
                        key="monitoring"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-8"
                    >
                        {/* Sub-navigation for LLM Monitoring */}
                        <div className="flex flex-wrap gap-1 p-1 bg-surface-100 dark:bg-brand-500/[0.03] border border-brand-primary/10 rounded-2xl w-fit shadow-sm">
                            {(['dashboard', 'traces', 'analytics', 'configuration'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveMonitoringTab(tab)}
                                    className={cn(
                                        "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                                        activeMonitoringTab === tab
                                            ? "bg-brand-primary text-surface-950 dark:text-white shadow-xl shadow-brand-primary/20"
                                            : "text-brand-900/60 hover:text-surface-950 dark:text-white dark:hover:text-white"
                                    )}
                                >
                                    {tab === 'configuration' ? 'Config' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </button>
                            ))}
                        </div>

                        {/* Sub-tab Content */}
                        <AnimatePresence mode="wait">
                            {activeMonitoringTab === 'dashboard' && (
                                <motion.div
                                    key="dashboard"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <LangfuseDashboard />
                                </motion.div>
                            )}

                            {activeMonitoringTab === 'traces' && (
                                <motion.div
                                    key="traces"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <LangfuseTraces />
                                </motion.div>
                            )}

                            {activeMonitoringTab === 'analytics' && (
                                <motion.div
                                    key="analytics"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <CostDashboard />
                                </motion.div>
                            )}

                            {activeMonitoringTab === 'configuration' && (
                                <motion.div
                                    key="configuration"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="border border-brand-primary/10 dark:border-brand-500/20 rounded-3xl p-8 bg-surface-50 dark:bg-brand-500/[0.03]"
                                >
                                    <div className="flex items-center gap-3 mb-6">
                                        <Activity className="w-6 h-6 text-brand-primary" />
                                        <div>
                                            <h2 className="text-2xl font-black text-surface-950 dark:text-white">LLM Monitoring Configuration</h2>
                                            <p className="text-sm text-brand-600 dark:text-brand-400 mt-1">Configure LangFuse credentials to enable LLM call tracking and monitoring</p>
                                        </div>
                                    </div>
                                    <LangFuseConfig />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                ) : null}

            </AnimatePresence>

            {/* Provider Modal */}
            <AnimatePresence>
                {isProviderModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            variants={modalBackdrop}
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                            className="absolute inset-0 bg-surface-900/60 backdrop-blur-sm"
                            onClick={() => setIsProviderModalOpen(false)}
                        />
                        <motion.div
                            variants={modalContent}
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                            className="relative w-full max-w-lg bg-surface-100 dark:bg-surface-900 border border-brand-100 dark:border-brand-500/10 rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
                        >
                            <h2 className="text-2xl font-black text-surface-950 dark:text-white mb-6">
                                {editingProvider.provider_id ? 'Edit Provider' : 'Add Provider'}
                            </h2>

                            <div className="space-y-5">
                                <div>
                                    <label className="text-xs font-bold text-brand-400 dark:text-surface-400 uppercase tracking-wider mb-2 block">Provider ID</label>
                                    <input
                                        type="text"
                                        value={editingProvider.provider_id || ''}
                                        onChange={e => setEditingProvider({ ...editingProvider, provider_id: e.target.value })}
                                        disabled={!!editingProvider.provider_id && settings?.providers.some(p => p.provider_id === editingProvider.provider_id)}
                                        className="w-full bg-surface-100 dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/10 rounded-xl px-4 py-3 text-surface-950 dark:text-white focus:outline-none focus:border-brand-500/50 transition-colors disabled:opacity-50"
                                        placeholder="unique-id"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-brand-400 dark:text-surface-400 uppercase tracking-wider mb-2 block">Provider Name</label>
                                    <input
                                        type="text"
                                        value={editingProvider.name || ''}
                                        onChange={e => setEditingProvider({ ...editingProvider, name: e.target.value })}
                                        className="w-full bg-surface-100 dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/10 rounded-xl px-4 py-3 text-surface-950 dark:text-white focus:outline-none focus:border-brand-500/50 transition-colors"
                                        placeholder="Display Name"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-brand-400 dark:text-surface-400 uppercase tracking-wider mb-2 block">Provider Type</label>
                                    <select
                                        value={editingProvider.provider_type || 'openai'}
                                        onChange={e => setEditingProvider({ ...editingProvider, provider_type: e.target.value })}
                                        className="w-full bg-surface-100 dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/10 rounded-xl px-4 py-3 text-surface-950 dark:text-white focus:outline-none focus:border-brand-500/50 transition-colors"
                                    >
                                        <option value="openai">OpenAI Compatible</option>
                                        <option value="anthropic">Anthropic</option>
                                        <option value="bedrock">AWS Bedrock</option>
                                        <option value="ollama">Ollama (Custom)</option>
                                        <option value="azure">Azure OpenAI</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-brand-400 dark:text-surface-400 uppercase tracking-wider mb-2 block">API Endpoint</label>
                                    <input
                                        type="text"
                                        value={editingProvider.api_endpoint || ''}
                                        onChange={e => setEditingProvider({ ...editingProvider, api_endpoint: e.target.value })}
                                        className="w-full bg-surface-100 dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/10 rounded-xl px-4 py-3 text-surface-950 dark:text-white focus:outline-none focus:border-brand-500/50 transition-colors font-mono text-sm"
                                        placeholder={editingProvider.provider_type === 'ollama' ? "http://remote-ip:11434/v1" : "https://api.openai.com/v1"}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-brand-400 dark:text-surface-400 uppercase tracking-wider mb-2 block">API Key</label>
                                    <input
                                        type="password"
                                        value={editingProvider.api_key || ''}
                                        onChange={e => setEditingProvider({ ...editingProvider, api_key: e.target.value })}
                                        className="w-full bg-surface-100 dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/10 rounded-xl px-4 py-3 text-surface-950 dark:text-white focus:outline-none focus:border-brand-500/50 transition-colors font-mono text-sm"
                                        placeholder={editingProvider.provider_id ? "(Leave blank to keep existing)" : "sk-..."}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-brand-400 dark:text-surface-400 uppercase tracking-wider mb-2 block">Models (Comma Separated)</label>
                                    <input
                                        type="text"
                                        value={Array.isArray(editingProvider.models) ? editingProvider.models.join(', ') : editingProvider.models || ''}
                                        onChange={e => setEditingProvider({ ...editingProvider, models: e.target.value.split(',').map(s => s.trim()) })}
                                        className="w-full bg-surface-100 dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/10 rounded-xl px-4 py-3 text-surface-950 dark:text-white focus:outline-none focus:border-brand-500/50 transition-colors"
                                        placeholder="gpt-4, gpt-3.5-turbo"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-brand-400 dark:text-surface-400 uppercase tracking-wider mb-2 block">Default Model</label>
                                    <input
                                        type="text"
                                        value={editingProvider.default_model || ''}
                                        onChange={e => setEditingProvider({ ...editingProvider, default_model: e.target.value })}
                                        className="w-full bg-surface-100 dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/10 rounded-xl px-4 py-3 text-surface-950 dark:text-white focus:outline-none focus:border-brand-500/50 transition-colors"
                                        placeholder="gpt-4"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-8">
                                <button
                                    onClick={() => setIsProviderModalOpen(false)}
                                    className="px-6 py-3 rounded-xl text-sm font-bold text-surface-500 dark:text-white hover:text-surface-950 dark:hover:text-surface-950 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveProvider}
                                    disabled={isSaving}
                                    className="btn-primary px-8 py-3 rounded-xl text-sm font-black uppercase tracking-widest"
                                >
                                    {isSaving ? 'Saving...' : 'Save Configuration'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Mapping Modal */}
            <AnimatePresence>
                {isMappingModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            variants={modalBackdrop}
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                            className="absolute inset-0 bg-surface-900/60 backdrop-blur-sm"
                            onClick={() => setIsMappingModalOpen(false)}
                        />
                        <motion.div
                            variants={modalContent}
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                            className="relative w-full max-w-5xl bg-surface-100 dark:bg-surface-900 border border-brand-100 dark:border-brand-500/10 rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
                        >
                            <h2 className="text-2xl font-black text-surface-950 dark:text-white mb-6">
                                Edit Agent Mapping
                            </h2>

                            <div className="flex flex-col lg:flex-row gap-8">
                                <div className="flex-1 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="text-xs font-bold text-brand-400 dark:text-surface-400 uppercase tracking-wider mb-2 block">Agent Name/ID</label>
                                            <input
                                                type="text"
                                                value={editingMapping.agent_id || ''}
                                                onChange={e => setEditingMapping({ ...editingMapping, agent_id: e.target.value })}
                                                className="w-full bg-surface-100 dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/10 rounded-xl px-4 py-3 text-surface-950 dark:text-white focus:outline-none focus:border-brand-500/50 transition-colors"
                                                placeholder="e.g. analyst-agent"
                                                disabled={!!editingMapping.agent_id && settings?.mappings.some(m => m.agent_id === editingMapping.agent_id)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-brand-400 dark:text-surface-400 uppercase tracking-wider mb-2 block">System Role / Label</label>
                                            <input
                                                type="text"
                                                value={editingMapping.role || ''}
                                                onChange={e => setEditingMapping({ ...editingMapping, role: e.target.value })}
                                                className="w-full bg-surface-100 dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/10 rounded-xl px-4 py-3 text-surface-950 dark:text-white focus:outline-none focus:border-brand-500/50 transition-colors"
                                                placeholder="e.g. Core Orchestrator"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-brand-400 dark:text-surface-400 uppercase tracking-wider mb-2 block">Provider</label>
                                            <select
                                                value={editingMapping.provider_id || ''}
                                                onChange={e => setEditingMapping({ ...editingMapping, provider_id: e.target.value, model_name: '' })}
                                                className="w-full bg-surface-100 dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/10 rounded-xl px-4 py-3 text-surface-950 dark:text-white focus:outline-none focus:border-brand-500/50 transition-colors"
                                            >
                                                <option value="" disabled>Select Provider</option>
                                                {settings?.providers.map(p => (
                                                    <option key={p.provider_id} value={p.provider_id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="text-xs font-bold text-brand-400 dark:text-surface-400 uppercase tracking-wider mb-2 block">Model</label>
                                            <select
                                                value={editingMapping.model_name || ''}
                                                onChange={e => setEditingMapping({ ...editingMapping, model_name: e.target.value })}
                                                className="w-full bg-surface-100 dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/10 rounded-xl px-4 py-3 text-surface-950 dark:text-white focus:outline-none focus:border-brand-500/50 transition-colors"
                                                disabled={!editingMapping.provider_id}
                                            >
                                                <option value="" disabled>Select Model</option>
                                                {settings?.providers.find(p => p.provider_id === editingMapping.provider_id)?.models.map(m => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-brand-400 dark:text-surface-400 uppercase tracking-wider mb-2 block">API Endpoint Override</label>
                                            <input
                                                type="text"
                                                value={editingMapping.parameters?.api_endpoint || ''}
                                                onChange={e => setEditingMapping({
                                                    ...editingMapping,
                                                    parameters: { ...editingMapping.parameters, api_endpoint: e.target.value }
                                                })}
                                                className="w-full bg-surface-100 dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/10 rounded-xl px-4 py-3 text-surface-950 dark:text-white focus:outline-none focus:border-brand-500/50 transition-colors font-mono text-sm"
                                                placeholder="http://remote-ip:11434/v1"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        {/* Prompt Template Selection */}
                                        <div className="premium-card p-6 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-black text-surface-950 dark:text-white">
                                                    Prompt Template
                                                </h4>
                                                <span className="text-xs px-2 py-1 rounded-full bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold">
                                                    {editingMapping.prompt_template_id ? 'Linked' : 'Legacy'}
                                                </span>
                                            </div>

                                            {/* Template Selector */}
                                            <div>
                                                <label className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase mb-2 block">
                                                    Select Template
                                                </label>
                                                <select
                                                    value={editingMapping.prompt_template_id || 'legacy'}
                                                    onChange={e => {
                                                        const value = e.target.value;
                                                        if (value === 'legacy') {
                                                            setEditingMapping({
                                                                ...editingMapping,
                                                                prompt_template_id: null
                                                            });
                                                        } else {
                                                            setEditingMapping({
                                                                ...editingMapping,
                                                                prompt_template_id: value
                                                            });
                                                        }
                                                    }}
                                                    className="w-full bg-white dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/20 rounded-xl px-4 py-3 text-surface-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                                                >
                                                    <option value="legacy">Use Legacy System Prompt (Below)</option>
                                                    <optgroup label="Available Templates">
                                                        {/* Templates will be loaded dynamically */}
                                                        <option value="template-1">Analyst Extraction v3 (Latest)</option>
                                                        <option value="template-2">Covenant Analysis v2</option>
                                                        <option value="template-3">Risk Assessment v1</option>
                                                    </optgroup>
                                                </select>
                                            </div>

                                            {/* Template Preview */}
                                            {editingMapping.prompt_template_id && (
                                                <div className="bg-surface-50 dark:bg-brand-500/5 rounded-lg p-4 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase">
                                                            Template Preview
                                                        </span>
                                                        <button className="text-xs text-brand-500 hover:text-brand-600 font-bold">
                                                            View Full Template →
                                                        </button>
                                                    </div>
                                                    <div className="text-xs text-surface-700 dark:text-surface-300 font-mono bg-white dark:bg-brand-500/10 rounded p-3 max-h-32 overflow-y-auto">
                                                        You are an expert Credit Analyst with access to document coordinate mappings...
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 pt-2">
                                                        <div className="text-center">
                                                            <div className="text-xs text-surface-500 dark:text-surface-400">Version</div>
                                                            <div className="text-sm font-bold text-surface-950 dark:text-white">v3</div>
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="text-xs text-surface-500 dark:text-surface-400">Avg Latency</div>
                                                            <div className="text-sm font-bold text-surface-950 dark:text-white">2.3s</div>
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="text-xs text-surface-500 dark:text-surface-400">Success Rate</div>
                                                            <div className="text-sm font-bold text-green-600 dark:text-green-400">98%</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Legacy Prompts (Deprecated) */}
                                        {!editingMapping.prompt_template_id && (
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg">
                                                    <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                                                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                                        <strong>Deprecated:</strong> Inline prompts will be removed in a future version. Please migrate to prompt templates.
                                                    </p>
                                                </div>

                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label className="text-xs font-bold text-brand-400 dark:text-surface-400 uppercase tracking-wider">System Prompt (Legacy)</label>
                                                        <button
                                                            onClick={() => setEditingMapping({ ...editingMapping, system_prompt: '' })}
                                                            className="text-[10px] text-brand-500 hover:text-brand-600 font-bold uppercase tracking-widest"
                                                        >
                                                            Reset to Default
                                                        </button>
                                                    </div>
                                                    <textarea
                                                        value={editingMapping.system_prompt || ''}
                                                        onChange={e => setEditingMapping({ ...editingMapping, system_prompt: e.target.value })}
                                                        className="w-full h-48 bg-surface-50 dark:bg-[#050810] border border-brand-100 dark:border-brand-500/10 rounded-2xl p-4 text-sm font-mono text-surface-950 dark:text-surface-300 focus:outline-none focus:border-brand-500/50 resize-y"
                                                        placeholder="Enter system prompt instructions..."
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label className="text-xs font-bold text-brand-400 dark:text-surface-400 uppercase tracking-wider">Refinement Prompt (Legacy)</label>
                                                        <button
                                                            onClick={() => setEditingMapping({ ...editingMapping, refinement_prompt: '' })}
                                                            className="text-[10px] text-brand-500 hover:text-brand-600 font-bold uppercase tracking-widest"
                                                        >
                                                            Reset to Default
                                                        </button>
                                                    </div>
                                                    <textarea
                                                        value={editingMapping.refinement_prompt || ''}
                                                        onChange={e => setEditingMapping({ ...editingMapping, refinement_prompt: e.target.value })}
                                                        className="w-full h-32 bg-surface-50 dark:bg-[#050810] border border-brand-100 dark:border-brand-500/10 rounded-2xl p-4 text-sm font-mono text-surface-950 dark:text-surface-300 focus:outline-none focus:border-brand-500/50 resize-y"
                                                        placeholder="Enter refinement prompt instructions..."
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {editingMapping.agent_id && (
                                    <div className="w-full lg:w-80 space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-bold text-surface-950 dark:text-white flex items-center gap-2">
                                                <RefreshCw className={cn("w-4 h-4 text-brand-500", isFetchingHistory && "animate-spin")} />
                                                Version History
                                            </h3>
                                            <span className="px-2 py-0.5 rounded bg-brand-500/10 text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase">
                                                {promptHistory.length} Versions
                                            </span>
                                        </div>

                                        <div className="bg-surface-50 dark:bg-[#050810] border border-brand-100 dark:border-brand-500/10 rounded-2xl overflow-hidden max-h-[600px] overflow-y-auto">
                                            {promptHistory.length > 0 ? (
                                                <div className="divide-y divide-brand-100 dark:divide-brand-500/10">
                                                    {promptHistory.map((h) => (
                                                        <div key={h.id} className="p-4 hover:bg-brand-500/[0.02] transition-colors group">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-brand-500">
                                                                    v{h.version}
                                                                </span>
                                                                <span className="text-[10px] text-surface-400 font-medium">
                                                                    {new Date(h.created_at).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                            <p className="text-[10px] text-surface-500 dark:text-surface-400 line-clamp-2 italic mb-3">
                                                                {h.comment || "No comment"}
                                                            </p>
                                                            <button
                                                                onClick={() => handleRevertPrompt(h.id)}
                                                                disabled={isSaving}
                                                                className="w-full py-1.5 rounded-lg border border-brand-500/20 text-[10px] font-black uppercase tracking-widest text-brand-600 dark:text-brand-400 hover:bg-brand-500/10 transition-all opacity-0 group-hover:opacity-100"
                                                            >
                                                                Revert to This
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="p-8 text-center">
                                                    <p className="text-xs text-surface-400 italic">No historical versions available.</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                                            <h4 className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                <AlertCircle className="w-3 h-3" />
                                                Schema Info
                                            </h4>
                                            <p className="text-[10px] text-blue-900/60 dark:text-blue-200/40 leading-relaxed font-medium">
                                                Available variables: <code className="text-blue-600 dark:text-blue-400">{'{context}'}</code>, <code className="text-blue-600 dark:text-blue-400">{'{question}'}</code>, <code className="text-blue-600 dark:text-blue-400">{'{feedback}'}</code>. Changes require re-indexing if model type changes significantly.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 mt-10 border-t border-brand-100 dark:border-brand-500/10 pt-8">
                                <button
                                    onClick={() => setIsMappingModalOpen(false)}
                                    className="px-6 py-3 rounded-xl text-sm font-bold text-surface-500 dark:text-white hover:text-surface-950 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveMapping}
                                    disabled={isSaving}
                                    className="btn-primary px-8 py-3 rounded-xl text-sm font-black uppercase tracking-widest shadow-xl shadow-brand-primary/20"
                                >
                                    {isSaving ? 'Saving Changes...' : 'Commit Configuration'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Azure AD Automate Setup Modal */}
            <AnimatePresence>
                {isAutomateSetupModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            variants={modalBackdrop}
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                            className="absolute inset-0 bg-surface-900/60 backdrop-blur-sm"
                            onClick={() => setIsAutomateSetupModalOpen(false)}
                        />
                        <motion.div
                            variants={modalContent}
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                            className="relative w-full max-w-lg bg-surface-100 dark:bg-surface-900 border border-brand-100 dark:border-brand-500/10 rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
                        >
                            <h2 className="text-2xl font-black text-surface-950 dark:text-white mb-6">
                                Automate Azure AD Setup
                            </h2>

                            <div className="space-y-5">
                                <div>
                                    <label className="text-xs font-bold text-brand-400 dark:text-surface-400 uppercase tracking-wider mb-2 block">Azure AD Tenant ID</label>
                                    <input
                                        type="text"
                                        value={automateSetupConfig.tenant_id}
                                        onChange={e => setAutomateSetupConfig({ ...automateSetupConfig, tenant_id: e.target.value })}
                                        className="w-full bg-surface-100 dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/10 rounded-xl px-4 py-3 text-surface-950 dark:text-white focus:outline-none focus:border-brand-500/50 transition-colors"
                                        placeholder="Directory (tenant) ID"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-brand-400 dark:text-surface-400 uppercase tracking-wider mb-2 block">Azure AD Access Token</label>
                                    <input
                                        type="text"
                                        value={automateSetupConfig.access_token}
                                        onChange={e => setAutomateSetupConfig({ ...automateSetupConfig, access_token: e.target.value })}
                                        className="w-full bg-surface-100 dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/10 rounded-xl px-4 py-3 text-surface-950 dark:text-white focus:outline-none focus:border-brand-500/50 transition-colors"
                                        placeholder="Bearer token"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-brand-400 dark:text-surface-400 uppercase tracking-wider mb-2 block">Application Name</label>
                                    <input
                                        type="text"
                                        value={automateSetupConfig.app_name}
                                        onChange={e => setAutomateSetupConfig({ ...automateSetupConfig, app_name: e.target.value })}
                                        className="w-full bg-surface-100 dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/10 rounded-xl px-4 py-3 text-surface-950 dark:text-white focus:outline-none focus:border-brand-500/50 transition-colors"
                                        placeholder="AgentStack"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-brand-400 dark:text-surface-400 uppercase tracking-wider mb-2 block">Redirect URI</label>
                                    <input
                                        type="text"
                                        value={automateSetupConfig.redirect_uri}
                                        onChange={e => setAutomateSetupConfig({ ...automateSetupConfig, redirect_uri: e.target.value })}
                                        className="w-full bg-surface-100 dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/10 rounded-xl px-4 py-3 text-surface-950 dark:text-white focus:outline-none focus:border-brand-500/50 transition-colors"
                                        placeholder="http://localhost:8002/api/v1/auth/azuread/callback"
                                    />
                                </div>
                            </div>

                            {automateSetupResult && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className={cn(
                                        "mt-6 p-4 rounded-2xl border flex items-start gap-3",
                                        automateSetupResult.success ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-red-500/5 border-red-500/20 text-red-600 dark:text-red-400"
                                    )}
                                >
                                    {automateSetupResult.success ? <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                                    <div className="flex-1">
                                        <p className="text-sm font-bold tracking-tight">{automateSetupResult.message}</p>
                                        {automateSetupResult.application_info && (
                                            <div className="mt-2 text-xs font-mono">
                                                <p>Client ID: {automateSetupResult.application_info.client_id}</p>
                                                <p>Tenant ID: {automateSetupResult.application_info.tenant_id}</p>
                                            </div>
                                        )}
                                        {automateSetupResult.error && (
                                            <p className="mt-2 text-xs">{automateSetupResult.error}</p>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            <div className="flex justify-end gap-3 mt-8">
                                <button
                                    onClick={() => setIsAutomateSetupModalOpen(false)}
                                    className="px-6 py-3 rounded-xl text-sm font-bold text-surface-500 dark:text-white hover:text-surface-950 dark:hover:text-surface-950 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAutomateAzureADSetup}
                                    disabled={automatingSetup}
                                    className="btn-primary px-8 py-3 rounded-xl text-sm font-black uppercase tracking-widest"
                                >
                                    {automatingSetup ? 'Automating...' : 'Automate Setup'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Azure AD Troubleshooting Results */}
            <AnimatePresence>
                {troubleshootingResult && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            variants={modalBackdrop}
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                            className="absolute inset-0 bg-surface-900/60 backdrop-blur-sm"
                            onClick={() => setTroubleshootingResult(null)}
                        />
                        <motion.div
                            variants={modalContent}
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                            className="relative w-full max-w-2xl bg-surface-100 dark:bg-surface-900 border border-brand-100 dark:border-brand-500/10 rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
                        >
                            <h2 className="text-2xl font-black text-surface-950 dark:text-white mb-6">
                                Azure AD Troubleshooting Results
                            </h2>

                            {troubleshootingResult.issues.length > 0 ? (
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-sm font-bold text-surface-950 dark:text-white mb-3">Identified Issues ({troubleshootingResult.issues.length})</h3>
                                        <div className="space-y-2">
                                            {troubleshootingResult.issues.map((issue: string, index: number) => (
                                                <div key={index} className="flex items-start gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/20">
                                                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                                    <p className="text-sm text-surface-950 dark:text-white">{issue}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-bold text-surface-950 dark:text-white mb-3">Recommendations ({troubleshootingResult.recommendations.length})</h3>
                                        <div className="space-y-2">
                                            {troubleshootingResult.recommendations.map((recommendation: string, index: number) => (
                                                <div key={index} className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                                    <p className="text-sm text-surface-950 dark:text-white">{recommendation}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                                    <h3 className="text-xl font-bold text-surface-950 dark:text-white mb-2">No Issues Found</h3>
                                    <p className="text-surface-600 dark:text-surface-400">Your Azure AD configuration is working correctly.</p>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 mt-8">
                                <button
                                    onClick={() => setTroubleshootingResult(null)}
                                    className="btn-primary px-8 py-3 rounded-xl text-sm font-black uppercase tracking-widest"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Confirmation Modals */}
            <AnimatePresence>
                {(providerToDelete || mappingToDelete) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-surface-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-surface-100 dark:bg-surface-900 border border-surface-200 dark:border-brand-500/10 rounded-3xl p-8 max-w-md w-full shadow-2xl"
                        >
                            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6">
                                <Trash2 className="w-8 h-8 text-red-500" />
                            </div>
                            <h2 className="text-2xl font-black text-surface-950 dark:text-white mb-2">Are you absolutely sure?</h2>
                            <p className="text-surface-600 dark:text-surface-400 mb-8 leading-relaxed">
                                {providerToDelete
                                    ? `The provider "${providerToDelete}" and all its configuration will be permanently removed. This may affect existing agent mappings.`
                                    : `The mapping for agent "${mappingToDelete?.replace(/-/g, ' ')}" will be permanently removed. This action cannot be undone.`
                                }
                            </p>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setProviderToDelete(null);
                                        setMappingToDelete(null);
                                    }}
                                    disabled={isSaving}
                                    className="flex-1 py-4 bg-surface-100 dark:bg-brand-500/5 hover:bg-surface-200 dark:hover:bg-surface-50/10 text-surface-950 dark:text-white rounded-2xl font-bold transition-all border border-surface-200 dark:border-brand-500/10 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => providerToDelete ? confirmDeleteProvider() : confirmDeleteMapping()}
                                    disabled={isSaving}
                                    className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-surface-950 dark:text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-red-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSaving ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Deleting...
                                        </>
                                    ) : (
                                        'Delete Now'
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
};

export default Settings;
