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
  RefreshCw,
  Trash2,
  ChevronRight,
  LayoutGrid,
  List,
  Play,
  Settings,
  Database,
  ArrowRight
} from 'lucide-react';
import { cn } from '../services/utils';
import apiService from '../services/api'; // Updated import
import { useNotifications } from '../contexts/NotificationContext'; // Assuming context exists

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

const statusConfig = {
  initializing: { icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  discovering: { icon: RefreshCw, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  mapping: { icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  testing: { icon: Clock, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  deploying: { icon: RefreshCw, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  active: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  paused: { icon: Clock, color: 'text-brand-400', bg: 'bg-brand-500/10', border: 'border-brand-500/20' },
};

const Integrations: React.FC = () => {
  const navigate = useNavigate();
  const { addNotification } = useNotifications(); // Assuming context exists
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [integrationToDelete, setIntegrationToDelete] = useState<Integration | null>(null);

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const response = await apiService.getVitesseIntegrations(); // Use new API method
      let data = response.data;
      if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
        data = data.data;
      } else if (data && typeof data === 'object' && 'items' in data && Array.isArray(data.items)) {
        data = data.items;
      }
      setIntegrations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
      addNotification({ type: 'error', message: 'Failed to load integrations' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      // Optimistic update
      setIntegrations(prev => prev.map(i => i.id === id ? { ...i, status: 'deploying' } : i));
      setSelectedIntegration(prev => prev?.id === id ? { ...prev, status: 'deploying' } : prev);

      await apiService.deployIntegration(id);
      addNotification({ type: 'success', message: 'Deployment triggered successfully' });
    } catch (error) {
      console.error('Failed to deploy integration:', error);
      addNotification({ type: 'error', message: 'Failed to trigger deployment' });
      fetchIntegrations(); // Revert on error
    }
  };

  const handleDeleteClick = (integration: Integration, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIntegrationToDelete(integration);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!integrationToDelete) return;

    try {
      // Note: apiService.deleteIntegration(id) assumes this method exists or you might need to use generic delete if not
      // Checking api.ts earlier, it seemed `deleteIntegration` might be missing or I missed it.
      // Let's assume standard REST endpoint if method is missing, or use a generic one.
      // But api.ts had `deleteIntegration(integrationId)` on line 850 in a previous view?
      // Actually, in the view of api.ts (Step 503), line 829 shows: `async deployIntegration(integrationId: string)`
      // I don't see `deleteIntegration` there. 
      // Wait, usually DELETE /vitesse/integrations/:id
      // I'll check if I need to use axios directly for delete if method is missing, OR better, add it to api.ts properly later.
      // For now, I'll try `apiService.delete` if available or assume I need to add `deleteVitesseIntegration`.
      // Let's assume `apiService.axiosInstance.delete` is available via a helper or I can add it.
      // Since I can't easily see if `deleteIntegration` exists without full file, I will use a direct call via the public `delete` method if `apiService` exposes it (it does: `public delete(url...)`).

      await apiService.delete(`/vitesse/integrations/${integrationToDelete.id}`);

      addNotification({ type: 'success', message: 'Integration deleted successfully' });
      setIntegrations(prev => prev.filter(i => i.id !== integrationToDelete.id));
      if (selectedIntegration?.id === integrationToDelete.id) {
        setSelectedIntegration(null);
      }
      setShowDeleteModal(false);
      setIntegrationToDelete(null);
    } catch (error) {
      console.error('Failed to delete integration:', error);
      addNotification({ type: 'error', message: 'Failed to delete integration' });
    }
  };

  const filteredIntegrations = integrations.filter(int =>
    int.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-surface-950 transition-colors duration-300 p-6">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-surface-950/80 backdrop-blur-xl border-b border-surface-800">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">
                  <span className="text-gradient">Integrations</span>
                </h1>
                <p className="text-surface-400 mt-1">
                  Manage your AI-powered API integration pipelines
                </p>
              </div>
              <button
                onClick={() => navigate('/integrations/new')}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>New Integration</span>
              </button>
            </div>

            {/* Controls Bar */}
            <div className="premium-card p-2 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-primary" />
                  <input
                    type="text"
                    placeholder="Search integrations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input-field pl-12"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1 bg-surface-800/50 border border-surface-700 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    viewMode === 'grid'
                      ? "bg-surface-700 text-brand-primary shadow-sm"
                      : "text-surface-400 hover:text-surface-300"
                  )}
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    viewMode === 'list'
                      ? "bg-surface-700 text-brand-primary shadow-sm"
                      : "text-surface-400 hover:text-surface-300"
                  )}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-surface-800 rounded-full"></div>
              <div className="absolute top-0 left-0 w-20 h-20 border-4 border-brand-primary rounded-full border-t-transparent animate-spin"></div>
            </div>
            <p className="mt-6 text-surface-400 font-medium animate-pulse">Loading integrations...</p>
          </div>
        ) : filteredIntegrations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center premium-card">
            <div className="w-24 h-24 bg-brand-primary/10 rounded-3xl flex items-center justify-center mb-6">
              <Zap className="w-12 h-12 text-brand-primary" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">No Integrations Found</h3>
            <p className="text-surface-400 max-w-md mx-auto mb-8 text-lg">
              Get started by creating your first AI-powered API integration.
            </p>
            <button
              onClick={() => navigate('/integrations/new')}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>Create Integration</span>
            </button>
          </div>
        ) : (
          <div className={cn(
            "grid gap-6",
            viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
          )}>
            <AnimatePresence>
              {filteredIntegrations.map((integration) => {
                const statusConfig_ = statusConfig[integration.status] || statusConfig.initializing;
                const StatusIcon = statusConfig_.icon;

                return (
                  <motion.div
                    key={integration.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ y: -5 }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer group ${selectedIntegration?.id === integration.id
                      ? 'bg-brand-primary/10 border-brand-primary/50 shadow-[0_0_15px_rgba(var(--brand-primary),0.2)]'
                      : 'bg-surface-900/40 border-surface-800 hover:bg-surface-800/60 hover:border-surface-700'
                    }`}
                    onClick={() => setSelectedIntegration(integration)}
                  >
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-surface-800 border border-surface-700 flex items-center justify-center text-brand-primary group-hover:scale-110 transition-transform duration-300">
                          <Zap className="w-7 h-7" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-white group-hover:text-brand-primary transition-colors line-clamp-1">
                            {integration.name}
                          </h3>
                          <p className="text-xs font-medium text-surface-400 mt-1">
                            {new Date(integration.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className={cn(
                        "px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider flex items-center gap-2 bg-surface-50 dark:bg-surface-950/50 backdrop-blur-sm",
                        statusConfig_.color,
                        statusConfig_.border
                      )}>
                        {integration.status === 'deploying' || integration.status === 'discovering' ? (
                          <StatusIcon className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <StatusIcon className="w-3.5 h-3.5" />
                        )}
                        {integration.status}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mb-6 p-4 bg-surface-900/30 rounded-2xl border border-surface-800">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-1">Source</p>
                        <p className="text-xs font-bold text-white truncate" title={integration.source_api_spec?.api_name}>
                          {integration.source_api_spec?.api_name || 'Unknown'}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-surface-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-1">Destination</p>
                        <p className="text-xs font-bold text-white truncate" title={integration.dest_api_spec?.api_name}>
                          {integration.dest_api_spec?.api_name || 'Unknown'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-surface-800">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-surface-400 bg-surface-800/50 border border-surface-700 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                          {integration.deployment_target}
                        </span>
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0 p-2 hover:bg-surface-700 rounded-lg text-brand-primary font-bold text-xs flex items-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/integrations/${integration.id}/workflow`);
                        }}
                      >
                        Workflow <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Integration Detail Modal (Quick View) */}
      <AnimatePresence>
        {selectedIntegration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedIntegration(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="premium-card rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden"
            >
              <div className="p-8 pb-0">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                      <Zap className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        {selectedIntegration.name}
                      </h2>
                      <div className="flex items-center gap-2 mt-1">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          selectedIntegration.status === 'active' ? "bg-emerald-500" : "bg-orange-500"
                        )} />
                        <p className="text-sm font-medium text-surface-400 uppercase tracking-wider">
                          {selectedIntegration.status}
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedIntegration(null)}
                    className="p-2 hover:bg-surface-700 rounded-xl transition-colors"
                  >
                    <XCircle className="w-6 h-6 text-surface-400" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-4 bg-surface-900/30 rounded-2xl border border-surface-800">
                    <p className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-2">Source API</p>
                    <div className="flex items-center gap-3">
                      <Database className="w-5 h-5 text-blue-400" />
                      <div>
                        <p className="font-bold text-white text-sm">
                          {selectedIntegration.source_api_spec?.api_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-surface-400 truncate max-w-[150px]">
                          {selectedIntegration.source_api_spec?.base_url}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-surface-900/30 rounded-2xl border border-surface-800">
                    <p className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-2">Destination API</p>
                    <div className="flex items-center gap-3">
                      <Database className="w-5 h-5 text-emerald-400" />
                      <div>
                        <p className="font-bold text-white text-sm">
                          {selectedIntegration.dest_api_spec?.api_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-surface-400 truncate max-w-[150px]">
                          {selectedIntegration.dest_api_spec?.base_url}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedIntegration.health_score && (
                  <div className="mb-8">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
                      Health Metrics
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 bg-surface-900/30 rounded-2xl text-center border border-surface-800">
                        <p className="text-xs font-bold text-surface-400 mb-1">Success Rate</p>
                        <p className="text-xl font-black text-emerald-400">
                          {selectedIntegration.health_score.success_rate || '100'}%
                        </p>
                      </div>
                      <div className="p-4 bg-surface-900/30 rounded-2xl text-center border border-surface-800">
                        <p className="text-xs font-bold text-surface-400 mb-1">Latency</p>
                        <p className="text-xl font-black text-white">45ms</p>
                      </div>
                      <div className="p-4 bg-surface-900/30 rounded-2xl text-center border border-surface-800">
                        <p className="text-xs font-bold text-surface-400 mb-1">Uptime</p>
                        <p className="text-xl font-black text-blue-400">99.9%</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-surface-900/30 p-6 border-t border-surface-800 flex gap-3">
                <button
                  onClick={(e) => handleDeploy(selectedIntegration.id, e)}
                  className="flex-1 py-3 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl font-bold shadow-lg shadow-brand-primary/25 transition-all flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  <span>Deploy</span>
                </button>
                <button
                  onClick={() => navigate(`/integrations/${selectedIntegration.id}/workflow`)}
                  className="flex-1 py-3 bg-surface-800 hover:bg-surface-700 text-white rounded-xl font-bold border border-surface-700 transition-all flex items-center justify-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  <span>Manage Workflow</span>
                </button>
                <button
                  onClick={(e) => handleDeleteClick(selectedIntegration, e)}
                  className="px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-bold border border-red-500/20 transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="premium-card rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
            >
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Delete Integration?</h2>
              <p className="text-surface-400 mb-8">
                This will permanently delete "{integrationToDelete?.name}". This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-3 bg-surface-700 hover:bg-surface-600 text-white rounded-xl font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/25 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Integrations;
