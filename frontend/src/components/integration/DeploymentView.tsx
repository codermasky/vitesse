import React, { useState } from 'react';
import {
    Server,
    Settings,
    Loader2,
    CheckCircle,
    AlertTriangle,
    Globe,
    Box,
    RefreshCw
} from 'lucide-react';
import { apiService } from '../../services/api';

interface DeploymentViewProps {
    integration: any;
    onRedeploy: () => void;
}

export const DeploymentView: React.FC<DeploymentViewProps> = ({ integration, onRedeploy }) => {
    const [isDeploying, setIsDeploying] = useState(false);

    // Check if status is deploying or active to determine UI state
    // but allow overriding via local state for immediate feedback
    const status = isDeploying ? 'deploying' : integration.status;

    const handleDeploy = async () => {
        try {
            setIsDeploying(true);
            await apiService.deployIntegration(integration.id);
            // In a real app, we'd poll or wait for websocket update
            onRedeploy();
        } catch (err) {
            console.error('Failed to deploy:', err);
            setIsDeploying(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
                        <Server className="w-6 h-6 text-brand-500" />
                        Deployment Status
                    </h2>
                    <p className="text-sm text-surface-500 mt-1">
                        Manage the runtime environment for this integration.
                    </p>
                </div>
                <button
                    onClick={handleDeploy}
                    disabled={status === 'deploying'}
                    className="px-4 py-2 border border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                    {status === 'deploying' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <RefreshCw className="w-4 h-4" />
                    )}
                    {status === 'deploying' ? 'Deploying...' : 'Redeploy'}
                </button>
            </div>

            {status === 'deploying' ? (
                <div className="p-12 text-center bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-blue-700 dark:text-blue-400">Deployment in Progress</h3>
                    <p className="text-blue-600 dark:text-blue-500 mb-6">Provisioning containers and setting up routes...</p>

                    <div className="max-w-md mx-auto space-y-3">
                        <div className="flex items-center gap-3 text-sm text-surface-600 dark:text-surface-400">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span>Building container image...</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-surface-600 dark:text-surface-400">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span>Pushing to registry...</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-surface-900 dark:text-white font-medium">
                            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                            <span>Starting service...</span>
                        </div>
                    </div>
                </div>
            ) : status === 'active' ? (
                <div className="space-y-6">
                    <div className="p-6 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-200 dark:border-green-900/30 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center flex-shrink-0">
                            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-green-700 dark:text-green-400">System Active</h3>
                            <p className="text-green-600 dark:text-green-500">
                                Integration is running healthy on <span className="font-semibold capitalize">{integration.deployment_target || 'Local'}</span> environment.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-surface-50 dark:bg-surface-800/50 rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                            <h4 className="text-sm font-semibold text-surface-900 dark:text-white mb-3 flex items-center gap-2">
                                <Globe className="w-4 h-4 text-surface-500" />
                                Public Endpoint
                            </h4>
                            <div className="flex items-center gap-2 bg-white dark:bg-surface-900 p-2 rounded border border-surface-200 dark:border-surface-800">
                                <code className="flex-1 text-xs font-mono text-surface-600 dark:text-surface-400 break-all">
                                    {integration.service_url || 'https://api.vitesse.ai/v1/integrations/' + integration.id}
                                </code>
                                <button className="p-1 hover:bg-surface-100 dark:hover:bg-surface-800 rounded">
                                    <Settings className="w-4 h-4 text-surface-400" />
                                </button>
                            </div>
                        </div>

                        <div className="bg-surface-50 dark:bg-surface-800/50 rounded-xl border border-surface-200 dark:border-surface-700 p-4">
                            <h4 className="text-sm font-semibold text-surface-900 dark:text-white mb-3 flex items-center gap-2">
                                <Box className="w-4 h-4 text-surface-500" />
                                Container Info
                            </h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-surface-500">ID:</span>
                                    <span className="font-mono text-surface-900 dark:text-white">{integration.container_id || 'vitesse-runner-' + integration.id.slice(0, 8)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-surface-500">Uptime:</span>
                                    <span className="text-surface-900 dark:text-white">2d 4h 12m</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-surface-500">Memory:</span>
                                    <span className="text-surface-900 dark:text-white">128MB / 512MB</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="p-6 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-900/30 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-800 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-red-700 dark:text-red-400">Deployment Failed</h3>
                        <p className="text-red-600 dark:text-red-500">
                            The integration failed to deploy. Check logs for details.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
