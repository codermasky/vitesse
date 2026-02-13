import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Zap,
  Plus,
  Search,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { cn } from '../services/utils';
import axios from 'axios';

interface Integration {
  id: string;
  name: string;
  status: 'initializing' | 'discovering' | 'mapping' | 'testing' | 'deploying' | 'active' | 'failed' | 'paused';
  source_api_spec: Record<string, any>;
  dest_api_spec: Record<string, any>;
  deployment_target: 'local' | 'eks' | 'ecs';
  created_at: string;
  health_score?: Record<string, any>;
}

interface DiscoveryResult {
  api_name: string;
  description: string;
  documentation_url: string;
  spec_url?: string;
  base_url?: string;
  confidence_score: number;
  source: string;
  tags: string[];
}

const statusConfig = {
  initializing: { icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  discovering: { icon: RefreshCw, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  mapping: { icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  testing: { icon: Clock, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  deploying: { icon: RefreshCw, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  active: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
  failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
  paused: { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-500/10' },
};

export const Integrations: React.FC = () => {
  const navigate = useNavigate();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:9001/api/v1';
      const response = await axios.get(`${apiUrl}/vitesse/integrations`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      setIntegrations(response.data.data || response.data || []);
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchAPIs = async (query: string) => {
    try {
      setIsSearching(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:9001/api/v1';

      const response = await axios.get(`${apiUrl}/vitesse/discover`, {
        params: { query, limit: 5 },
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      setDiscoveryResults(response.data.results || []);
    } catch (error) {
      console.error('API discovery failed:', error);
      setCreateError('Failed to discover APIs. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const createIntegration = async () => {
    try {
      setIsCreating(true);
      setCreateError('');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:9001/api/v1';

      await axios.post(`${apiUrl}/vitesse/integrations`, formData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        }
      });

      // Reset form and close modal
      resetModal();

      // Refresh integrations list
      fetchIntegrations();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to create integration';
      setCreateError(errorMsg);
      console.error('Integration creation error:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const resetModal = () => {
    setShowCreateModal(false);
    setModalStep('search');
    setSearchQuery('');
    setDiscoveryResults([]);
    setSelectedSource(null);
    setSelectedDest(null);
    setFormData({
      source_api_url: '',
      source_api_name: '',
      dest_api_url: '',
      dest_api_name: '',
      user_intent: '',
      deployment_target: 'local',
      source_spec_url: '',
      dest_spec_url: '',
    });
    setCreateError('');
  };

  const handleSelectAPI = (result: DiscoveryResult, type: 'source' | 'dest') => {
    if (type === 'source') {
      setSelectedSource(result);
      setFormData(prev => ({
        ...prev,
        source_api_name: result.api_name,
        source_api_url: result.base_url || result.documentation_url,
        source_spec_url: result.spec_url || '',
      }));
    } else {
      setSelectedDest(result);
      setFormData(prev => ({
        ...prev,
        dest_api_name: result.api_name,
        dest_api_url: result.base_url || result.documentation_url,
        dest_spec_url: result.spec_url || '',
      }));
    }
  };

  const filteredIntegrations = integrations.filter(int =>
    int.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-surface-950 to-brand-600 dark:from-white dark:to-brand-400">
                API Integrations
              </h1>
              <p className="text-surface-500 dark:text-surface-400 mt-2">
                Discover, map, and deploy API integrations
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/integrations/new')}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-brand-500/20 transition-all duration-300"
            >
              <Plus className="w-5 h-5" />
              New Integration
            </motion.button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
            <input
              type="text"
              placeholder="Search integrations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface-100 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
        </motion.div>

        {/* Integrations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredIntegrations.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="w-16 h-16 bg-brand-500/10 rounded-full flex items-center justify-center mb-4">
                <Zap className="w-8 h-8 text-brand-500" />
              </div>
              <h3 className="text-lg font-semibold text-surface-950 dark:text-white">No integrations yet</h3>
              <p className="text-surface-500 dark:text-surface-400 mt-2">Create your first API integration to get started</p>
            </motion.div>
          ) : (
            filteredIntegrations.map((integration, idx) => {
              const statusConfig_ = statusConfig[integration.status];
              const StatusIcon = statusConfig_.icon;

              return (
                <motion.div
                  key={integration.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group glass rounded-2xl p-6 hover:shadow-xl hover:shadow-brand-500/10 transition-all duration-300 cursor-pointer border border-surface-200/50 dark:border-surface-800/50"
                  onClick={() => setSelectedIntegration(integration)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-surface-950 dark:text-white group-hover:text-brand-500 transition-colors">
                        {integration.name}
                      </h3>
                      <p className="text-xs text-surface-400 mt-1">
                        {new Date(integration.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className={cn(
                      'p-2 rounded-lg transition-colors',
                      statusConfig_.bg
                    )}>
                      <StatusIcon className={cn('w-5 h-5', statusConfig_.color)} />
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="inline-block px-3 py-1 bg-brand-500/10 rounded-lg">
                      <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 capitalize">
                        {integration.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-surface-600 dark:text-surface-400 mb-4">
                    <p><span className="font-medium">Target:</span> {integration.deployment_target}</p>
                    <p><span className="font-medium">Source:</span> {integration.source_api_spec?.title || 'Unknown'}</p>
                    <p><span className="font-medium">Destination:</span> {integration.dest_api_spec?.title || 'Unknown'}</p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-surface-200 dark:border-surface-800">
                    <span className="text-xs font-medium text-surface-500">View details</span>
                    <ChevronRight className="w-4 h-4 text-brand-500 group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      <AnimatePresence>
        {/* Create Integration Modal */}
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCreateModal(false)}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-surface-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto p-8"
            >
              <div className="flex items-start justify-between mb-6">
                <h2 className="text-2xl font-bold text-surface-950 dark:text-white">
                  Create New Integration
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-surface-400 hover:text-surface-600"
                >
                  ✕
                </button>
              </div>

              {createError && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-red-600 dark:text-red-400 text-sm">{createError}</p>
                </div>
              )}

              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-surface-950 dark:text-white mb-2">
                      Source API Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Shopify, GitHub"
                      value={formData.source_api_name}
                      onChange={(e) => setFormData({ ...formData, source_api_name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-surface-950 dark:text-white mb-2">
                      Source API URL
                    </label>
                    <input
                      type="text"
                      placeholder="https://api.example.com/swagger.json"
                      value={formData.source_api_url}
                      onChange={(e) => setFormData({ ...formData, source_api_url: e.target.value })}
                      className="w-full px-4 py-2.5 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-surface-950 dark:text-white mb-2">
                      Source Spec URL <span className="text-xs text-surface-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Direct OpenAPI/Swagger spec URL"
                      value={formData.source_spec_url}
                      onChange={(e) => setFormData({ ...formData, source_spec_url: e.target.value })}
                      className="w-full px-4 py-2.5 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-sm"
                    />
                    <p className="text-xs text-surface-400 mt-1">Use if API doesn't expose spec at standard paths</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-surface-950 dark:text-white mb-2">
                      Destination API Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Stripe, Salesforce"
                      value={formData.dest_api_name}
                      onChange={(e) => setFormData({ ...formData, dest_api_name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-surface-950 dark:text-white mb-2">
                      Destination API URL
                    </label>
                    <input
                      type="text"
                      placeholder="https://api.example.com/openapi.json"
                      value={formData.dest_api_url}
                      onChange={(e) => setFormData({ ...formData, dest_api_url: e.target.value })}
                      className="w-full px-4 py-2.5 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-surface-950 dark:text-white mb-2">
                      Destination Spec URL <span className="text-xs text-surface-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Direct OpenAPI/Swagger spec URL"
                      value={formData.dest_spec_url}
                      onChange={(e) => setFormData({ ...formData, dest_spec_url: e.target.value })}
                      className="w-full px-4 py-2.5 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-sm"
                    />
                    <p className="text-xs text-surface-400 mt-1">Use if API doesn't expose spec at standard paths</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-surface-950 dark:text-white mb-2">
                    User Intent
                  </label>
                  <textarea
                    placeholder="Describe what you want to sync (e.g., 'Sync customers and orders from Shopify to Salesforce')"
                    value={formData.user_intent}
                    onChange={(e) => setFormData({ ...formData, user_intent: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-surface-950 dark:text-white mb-2">
                    Deployment Target
                  </label>
                  <select
                    value={formData.deployment_target}
                    onChange={(e) => setFormData({ ...formData, deployment_target: e.target.value as any })}
                    className="w-full px-4 py-2.5 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  >
                    <option value="local">Local (Docker)</option>
                    <option value="eks">AWS EKS (Kubernetes)</option>
                    <option value="ecs">AWS ECS (Fargate)</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4 border-t border-surface-200 dark:border-surface-800">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2.5 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-950 dark:text-white rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createIntegration}
                    disabled={isCreating || !formData.source_api_url || !formData.dest_api_url || !formData.user_intent}
                    className="flex-1 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {isCreating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Integration'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Integration Detail Modal */}
        {selectedIntegration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedIntegration(null)}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-surface-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto p-8"
            >
              <div className="flex items-start justify-between mb-6">
                <h2 className="text-2xl font-bold text-surface-950 dark:text-white">
                  {selectedIntegration.name}
                </h2>
                <button
                  onClick={() => setSelectedIntegration(null)}
                  className="text-surface-400 hover:text-surface-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-surface-950 dark:text-white mb-3">Status</h3>
                  <div className="inline-flex items-center gap-2">
                    <div className={cn(
                      'p-2 rounded-lg',
                      statusConfig[selectedIntegration.status].bg
                    )}>
                      {React.createElement(statusConfig[selectedIntegration.status].icon, {
                        className: cn('w-5 h-5', statusConfig[selectedIntegration.status].color)
                      })}
                    </div>
                    <span className="font-medium text-surface-950 dark:text-white capitalize">
                      {selectedIntegration.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-semibold text-surface-500 uppercase mb-2">Source API</h4>
                    <p className="font-medium text-surface-950 dark:text-white">
                      {selectedIntegration.source_api_spec?.title || 'Unknown'}
                    </p>
                    {selectedIntegration.source_api_spec?.servers?.[0]?.url && (
                      <p className="text-xs text-surface-500 mt-1">
                        {selectedIntegration.source_api_spec.servers[0].url}
                      </p>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-surface-500 uppercase mb-2">Destination API</h4>
                    <p className="font-medium text-surface-950 dark:text-white">
                      {selectedIntegration.dest_api_spec?.title || 'Unknown'}
                    </p>
                    {selectedIntegration.dest_api_spec?.servers?.[0]?.url && (
                      <p className="text-xs text-surface-500 mt-1">
                        {selectedIntegration.dest_api_spec.servers[0].url}
                      </p>
                    )}
                  </div>
                </div>

                {selectedIntegration.health_score && (
                  <div>
                    <h4 className="text-xs font-semibold text-surface-500 uppercase mb-3">Health Metrics</h4>
                    <div className="space-y-2">
                      {Object.entries(selectedIntegration.health_score).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center text-sm">
                          <span className="text-surface-600 dark:text-surface-400 capitalize">
                            {key.replace(/_/g, ' ')}
                          </span>
                          <span className="font-medium text-surface-950 dark:text-white">
                            {typeof value === 'number' ? value.toFixed(2) : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-surface-200 dark:border-surface-800">
                  <button className="flex-1 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors">
                    Deploy
                  </button>
                  <button className="flex-1 px-4 py-2.5 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-950 dark:text-white rounded-lg font-medium transition-colors">
                    Edit
                  </button>
                  <button className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 rounded-lg font-medium transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Integrations;
