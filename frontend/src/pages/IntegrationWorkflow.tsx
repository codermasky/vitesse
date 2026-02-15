import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    CheckCircle,
    AlertCircle,
    Loader2,
    Database,
    Zap,
    Layout,
    Server,
    Play,
    Settings,
    ChevronRight,
    Search,
    TestTube,
    Box
} from 'lucide-react';
import { apiService } from '../services/api';

// Types
interface Integration {
    id: string;
    name: string;
    description: string;
    status: 'discovering' | 'mapping' | 'testing' | 'deploying' | 'active' | 'failed';
    source_discovery: any;
    dest_discovery: any;
    mapping_logic?: any;
    health_score?: any;
    deployment_config?: any;
    deployment_target?: string;
    container_id?: string;
    service_url?: string;
    created_at: string;
    updated_at: string;
}

const STEPS = [
    { id: 'discovering', label: 'Discovery', icon: Search },
    { id: 'mapping', label: 'Mapping', icon: Zap },
    { id: 'testing', label: 'Testing', icon: TestTube },
    { id: 'deploying', label: 'Deployment', icon: Server },
    { id: 'active', label: 'Active', icon: CheckCircle },
];

export const IntegrationWorkflow: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [integration, setIntegration] = useState<Integration | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Polling for status updates
    useEffect(() => {
        if (!id) return;

        const fetchIntegration = async () => {
            try {
                const response = await apiService.getIntegration(id);
                setIntegration(response.data);
                setLoading(false);
            } catch (err: any) {
                console.error('Failed to fetch integration:', err);
                setError(err.message || 'Failed to load integration');
                setLoading(false);
            }
        };

        fetchIntegration();
        const interval = setInterval(fetchIntegration, 5000); // Poll every 5s

        return () => clearInterval(interval);
    }, [id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-surface-50 dark:bg-surface-950">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            </div>
        );
    }

    if (error || !integration) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-surface-50 dark:bg-surface-950 p-4">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-2">Error Loading Integration</h2>
                <p className="text-surface-600 dark:text-surface-400 mb-6">{error || 'Integration not found'}</p>
                <button
                    onClick={() => navigate('/integrations')}
                    className="px-6 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
                >
                    Back to Integrations
                </button>
            </div>
        );
    }

    const currentStepIndex = STEPS.findIndex(s => s.id === integration.status) !== -1
        ? STEPS.findIndex(s => s.id === integration.status)
        : (integration.status === 'failed' ? -1 : 0);

    return (
        <div className="min-h-screen bg-surface-50 dark:bg-surface-950 p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/integrations')}
                            className="p-2 hover:bg-surface-200 dark:hover:bg-surface-800 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-surface-600 dark:text-surface-400" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">
                                {integration.name}
                            </h1>
                            <div className="flex items-center gap-2 text-sm text-surface-500">
                                <span>{integration.source_discovery?.api_name}</span>
                                <ChevronRight className="w-3 h-3" />
                                <span>{integration.dest_discovery?.api_name}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${integration.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                integration.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            }`}>
                            {integration.status}
                        </span>
                    </div>
                </div>

                {/* Progress Stepper */}
                <div className="bg-white dark:bg-surface-900 rounded-2xl p-6 shadow-sm border border-surface-200 dark:border-surface-800">
                    <div className="flex justify-between relative">
                        {/* Progress Bar Background */}
                        <div className="absolute top-1/2 left-0 w-full h-1 bg-surface-100 dark:bg-surface-800 -translate-y-1/2 z-0" />

                        {/* Active Progress Bar */}
                        <div
                            className="absolute top-1/2 left-0 h-1 bg-brand-500 -translate-y-1/2 z-0 transition-all duration-500"
                            style={{ width: `${Math.max(0, (currentStepIndex / (STEPS.length - 1)) * 100)}%` }}
                        />

                        {STEPS.map((step, idx) => {
                            const isCompleted = idx < currentStepIndex || integration.status === 'active';
                            const isCurrent = idx === currentStepIndex;
                            const Icon = step.icon;

                            return (
                                <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                                    <div className={`
                                        w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                                        ${isCompleted || isCurrent
                                            ? 'bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-500/20'
                                            : 'bg-surface-50 dark:bg-surface-800 border-surface-200 dark:border-surface-700 text-surface-400'
                                        }
                                    `}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <span className={`text-xs font-medium transition-colors ${isCompleted || isCurrent ? 'text-brand-600 dark:text-brand-400' : 'text-surface-500'
                                        }`}>
                                        {step.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Panel - Context & configuration */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Deployment Config */}
                        <div className="bg-white dark:bg-surface-900 rounded-2xl p-6 shadow-sm border border-surface-200 dark:border-surface-800">
                            <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
                                <Server className="w-5 h-5 text-brand-500" />
                                Deployment Target
                            </h3>
                            <div className="space-y-4">
                                <div className="p-3 bg-surface-50 dark:bg-surface-800/50 rounded-xl border border-surface-200 dark:border-surface-700">
                                    <div className="text-sm font-medium text-surface-500 uppercase mb-1">Type</div>
                                    <div className="flex items-center gap-2">
                                        {integration.deployment_target === 'eks' ? <Box className="w-4 h-4 text-orange-500" /> :
                                            integration.deployment_target === 'ecs' ? <Layout className="w-4 h-4 text-green-500" /> :
                                                <Server className="w-4 h-4 text-blue-500" />}
                                        <span className="font-semibold text-surface-900 dark:text-white capitalize">
                                            {integration.deployment_target || 'Local'}
                                        </span>
                                    </div>
                                </div>
                                {integration.service_url && (
                                    <div className="p-3 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-200 dark:border-green-900/30">
                                        <div className="text-sm font-medium text-green-700 dark:text-green-400 uppercase mb-1">Endpoints</div>
                                        <a href={integration.service_url} target="_blank" rel="noopener" className="text-green-600 hover:underline break-all">
                                            {integration.service_url}
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Source / Dest Info */}
                        <div className="bg-white dark:bg-surface-900 rounded-2xl p-6 shadow-sm border border-surface-200 dark:border-surface-800">
                            <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2">
                                <Database className="w-5 h-5 text-brand-500" />
                                Connected APIs
                            </h3>
                            <div className="relative pl-4 border-l-2 border-surface-200 dark:border-surface-800 space-y-6">
                                <div>
                                    <span className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-brand-500 border-4 border-white dark:border-surface-900" />
                                    <div className="text-sm font-medium text-surface-500 uppercase mb-1">Source</div>
                                    <div className="font-semibold text-surface-900 dark:text-white">{integration.source_discovery?.api_name}</div>
                                    <p className="text-sm text-surface-500 line-clamp-2 mt-1">{integration.source_discovery?.description}</p>
                                </div>
                                <div className="pt-2">
                                    <span className="absolute -left-[9px] top-auto w-4 h-4 rounded-full bg-surface-300 dark:bg-surface-700 border-4 border-white dark:border-surface-900" />
                                    <div className="text-sm font-medium text-surface-500 uppercase mb-1">Destination</div>
                                    <div className="font-semibold text-surface-900 dark:text-white">{integration.dest_discovery?.api_name}</div>
                                    <p className="text-sm text-surface-500 line-clamp-2 mt-1">{integration.dest_discovery?.description}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel - Action Area */}
                    <div className="lg:col-span-2">
                        {/* Step-specific Actions */}
                        <div className="bg-white dark:bg-surface-900 rounded-2xl p-6 shadow-sm border border-surface-200 dark:border-surface-800 min-h-[500px]">
                            {/* Mapping Step */}
                            {integration.status === 'mapping' && (
                                <MappingView
                                    integration={integration}
                                    onComplete={() => console.log('Mapping done')}
                                />
                            )}

                            {/* Testing Step */}
                            {integration.status === 'testing' && (
                                <TestingView
                                    integration={integration}
                                    onComplete={() => console.log('Testing done')}
                                />
                            )}

                            {/* Deploying/Active Step */}
                            {(integration.status === 'deploying' || integration.status === 'active') && (
                                <DeploymentView
                                    integration={integration}
                                    onRedeploy={() => console.log('Redeploy')}
                                />
                            )}

                            {/* Fallback/Loading */}
                            {integration.status === 'discovering' && (
                                <div className="flex flex-col items-center justify-center h-full text-center p-12">
                                    <Loader2 className="w-12 h-12 text-brand-500 animate-spin mb-4" />
                                    <h3 className="text-xl font-semibold text-surface-900 dark:text-white mb-2">Ingesting API Specifications</h3>
                                    <p className="text-surface-500 max-w-md">Agents are analyzing the OpenAPI specs for both services to prepare the mapping interface. This should only take a moment.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Sub-components (Placeholder for now, will implement full logic next)
const MappingView = (_props: { integration?: any; onComplete: () => void }) => (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
                <Layout className="w-6 h-6 text-brand-500" />
                Configure Field Mapping
            </h2>
            <button className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 font-medium">
                Auto-Generate with AI
            </button>
        </div>
        <div className="p-8 border-2 border-dashed border-surface-200 dark:border-surface-700 rounded-xl text-center">
            <p className="text-surface-500">Mapping interface will go here...</p>
        </div>
    </div>
);

const TestingView = (_props: { integration?: any; onComplete: () => void }) => (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
                <TestTube className="w-6 h-6 text-brand-500" />
                Validate Integration
            </h2>
            <button className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 font-medium flex items-center gap-2">
                <Play className="w-4 h-4" />
                Run Test Suite
            </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 rounded-xl">
                <div className="text-lg font-bold text-green-700 dark:text-green-400">98.5%</div>
                <div className="text-sm text-green-600 dark:text-green-500">Success Rate</div>
            </div>
            <div className="p-4 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl">
                <div className="text-lg font-bold text-surface-900 dark:text-white">142ms</div>
                <div className="text-sm text-surface-500">Avg Latency</div>
            </div>
        </div>
    </div>
);

const DeploymentView = ({ integration, onRedeploy }: any) => (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
                <Server className="w-6 h-6 text-brand-500" />
                Deployment Status
            </h2>
            <button onClick={onRedeploy} className="px-4 py-2 border border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg font-medium flex items-center gap-2 transition-colors">
                <Settings className="w-4 h-4" />
                Configure
            </button>
        </div>

        {integration.status === 'deploying' ? (
            <div className="p-12 text-center bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-bold text-blue-700 dark:text-blue-400">Deployment in Progress</h3>
                <p className="text-blue-600 dark:text-blue-500">Provisioning containers and setting up routes...</p>
            </div>
        ) : (
            <div className="p-6 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-200 dark:border-green-900/30 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-green-700 dark:text-green-400">System Active</h3>
                    <p className="text-green-600 dark:text-green-500">Integration is running healthy on {integration.deployment_target || 'Local'} environment.</p>
                </div>
            </div>
        )}
    </div>
);
