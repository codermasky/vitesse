import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Save,
  Globe,
  Database,
  FileText,
  Github,
  LayoutGrid,
  List,
  Play,
  Clock,
  ArrowUpRight,
  Sparkles
} from 'lucide-react';
import apiService from '../services/api';
import { cn } from '../services/utils';
import { useNotifications } from '../contexts/NotificationContext';

// Types
interface HarvestSource {
  id: number;
  name: string;
  type: string;
  url: string;
  description?: string;
  enabled: boolean;
  priority: number;
  auth_type?: string;
  auth_config?: any;
  category?: string;
  tags?: string[];
  last_harvested_at?: string;
  harvest_count: number;
  last_error?: string;
  created_at: string;
  updated_at: string;
  status?: 'idle' | 'running' | 'failed' | 'completed'; // Added for UI state
}

interface HarvestStats {
  total_sources: number;
  enabled_sources: number;
  total_harvests: number;
  successful_harvests: number;
  failed_harvests: number;
  last_harvest_at?: string;
}

const HarvestSources: React.FC = () => {
  const { addNotification } = useNotifications();

  // State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sources, setSources] = useState<HarvestSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<HarvestStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState<HarvestSource | null>(null);
  const [editingSource, setEditingSource] = useState<HarvestSource | null>(null);
  const [showDiscoverModal, setShowDiscoverModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<HarvestSource>>({
    name: '',
    type: 'website',
    url: '',
    description: '',
    enabled: true,
    priority: 1,
    auth_type: 'none',
    category: 'general'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initial Data Fetch
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sourcesRes, statsRes] = await Promise.all([
        apiService.getHarvestSources(),
        apiService.getHarvestStats()
      ]);
      const sourceData = sourcesRes.data;
      setSources(Array.isArray(sourceData) ? sourceData : (sourceData?.items || sourceData?.data || []));
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch harvest data:', error);
      addNotification({ type: 'error', message: 'Failed to load harvest sources' });
    } finally {
      setLoading(false);
    }
  };

  // Actions
  const handleCreate = () => {
    setEditingSource(null);
    setFormData({
      name: '',
      type: 'website',
      url: '',
      description: '',
      enabled: true,
      priority: 1,
      auth_type: 'none',
      category: 'general'
    });
    setShowCreateModal(true);
  };

  const handleEdit = (source: HarvestSource) => {
    setEditingSource(source);
    setFormData({
      name: source.name,
      type: source.type,
      url: source.url,
      description: source.description || '',
      enabled: source.enabled,
      priority: source.priority,
      auth_type: source.auth_type || 'none',
      category: source.category || 'general'
    });
    setShowCreateModal(true);
  };

  const handleDeleteClick = (source: HarvestSource) => {
    setSourceToDelete(source);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!sourceToDelete) return;

    try {
      await apiService.deleteHarvestSource(sourceToDelete.id);
      addNotification({ type: 'success', message: 'Harvest source deleted' });
      fetchData();
      setShowDeleteModal(false);
      setSourceToDelete(null);
    } catch (error) {
      console.error('Failed to delete source:', error);
      addNotification({ type: 'error', message: 'Failed to delete source' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingSource) {
        await apiService.updateHarvestSource(editingSource.id, formData);
        addNotification({ type: 'success', message: 'Harvest source updated' });
      } else {
        await apiService.createHarvestSource(formData);
        addNotification({ type: 'success', message: 'Harvest source created' });
      }
      setShowCreateModal(false);
      fetchData();
    } catch (error) {
      console.error('Failed to save source:', error);
      addNotification({ type: 'error', message: 'Failed to save harvest source' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRunHarvest = async (id: number) => {
    try {
      addNotification({ type: 'info', message: 'Starting harvest job...' });
      await apiService.createHarvestJob({
        harvest_type: 'specific',
        source_ids: [id]
      });
      addNotification({ type: 'success', message: 'Harvest job started' });
      fetchData(); // Refresh to show updated status/stats if applicable
    } catch (error) {
      console.error('Failed to start harvest:', error);
      addNotification({ type: 'error', message: 'Failed to start harvest job' });
    }
  };

  const handleDiscover = () => {
    setShowDiscoverModal(true);
    // Implement discovery logic in a separate component or here
  };

  // Filtering
  const filteredSources = sources.filter(source => {
    const matchesSearch = source.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      source.url.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || source.type === filterType;
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'enabled' ? source.enabled : !source.enabled);

    return matchesSearch && matchesType && matchesStatus;
  });

  // Helper functions
  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'website': return <Globe className="w-5 h-5" />;
      case 'github': return <Github className="w-5 h-5" />;
      case 'database': return <Database className="w-5 h-5" />;
      case 'document': return <FileText className="w-5 h-5" />;
      default: return <Globe className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 transition-colors duration-300">
      {/* Header Section */}
      <div className="sticky top-0 z-30 bg-surface-50/80 dark:bg-surface-950/80 backdrop-blur-xl border-b border-surface-200 dark:border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-black text-surface-950 dark:text-white mb-2 tracking-tight">
                  Harvest Sources
                </h1>
                <p className="text-surface-500 dark:text-surface-400 font-medium">
                  Manage and monitor your intelligence gathering pipelines
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDiscover}
                  className="px-5 py-2.5 bg-surface-900/5 dark:bg-white/10 text-surface-900 dark:text-white rounded-xl font-bold hover:bg-surface-900/10 dark:hover:bg-white/20 transition-all flex items-center gap-2 border border-surface-200 dark:border-white/10"
                >
                  <Search className="w-4 h-4" />
                  <span>Discover</span>
                </button>
                <button
                  onClick={handleCreate}
                  className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-brand-500/25 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Source</span>
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Sources', value: stats?.total_sources || 0, icon: Globe, color: 'text-blue-500' },
                { label: 'Active Pipelines', value: stats?.enabled_sources || 0, icon: CheckCircle2, color: 'text-emerald-500' },
                { label: 'Successful Harvests', value: stats?.successful_harvests || 0, icon: ArrowUpRight, color: 'text-purple-500' },
                { label: 'Failed Jobs', value: stats?.failed_harvests || 0, icon: AlertCircle, color: 'text-red-500' },
              ].map((stat, i) => (
                <div key={i} className="bg-white/50 dark:bg-surface-900/50 backdrop-blur-md rounded-2xl p-4 border border-surface-200 dark:border-white/5 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-surface-100 dark:bg-white/5 flex items-center justify-center ${stat.color}`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-surface-500 dark:text-surface-400 text-xs font-bold uppercase tracking-wider">{stat.label}</p>
                    <p className="text-2xl font-black text-surface-950 dark:text-white">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Controls Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-2 bg-surface-100 dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-white/5">
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                  <input
                    type="text"
                    placeholder="Search sources..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-surface-950 border border-surface-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all font-medium"
                  />
                </div>
                <div className="h-8 w-[1px] bg-surface-200 dark:bg-white/10 mx-2 hidden md:block" />
                <div className="flex items-center gap-2">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="bg-white dark:bg-surface-950 border border-surface-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  >
                    <option value="all">All Types</option>
                    <option value="website">Websites</option>
                    <option value="github">GitHub</option>
                    <option value="database">Database</option>
                    <option value="document">Documents</option>
                  </select>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="bg-white dark:bg-surface-950 border border-surface-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  >
                    <option value="all">All Status</option>
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1 bg-white dark:bg-surface-950 rounded-xl p-1 border border-surface-200 dark:border-white/10">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    viewMode === 'grid'
                      ? "bg-surface-100 dark:bg-surface-800 text-brand-500"
                      : "text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    viewMode === 'list'
                      ? "bg-surface-100 dark:bg-surface-800 text-brand-500"
                      : "text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                  )}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-surface-200 dark:border-surface-800 rounded-full"></div>
              <div className="absolute top-0 left-0 w-16 h-16 border-4 border-brand-500 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <p className="mt-4 text-surface-500 font-medium">Loading sources...</p>
          </div>
        ) : sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-24 h-24 bg-surface-100 dark:bg-surface-900 rounded-3xl flex items-center justify-center mb-6">
              <Globe className="w-10 h-10 text-surface-400" />
            </div>
            <h3 className="text-xl font-bold text-surface-950 dark:text-white mb-2">No Harvest Sources Found</h3>
            <p className="text-surface-500 dark:text-surface-400 max-w-md mx-auto mb-8">
              Get started by adding websites, repositories, or databases to your intelligence pipeline.
            </p>
            <button
              onClick={handleCreate}
              className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-brand-500/25 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>Add Your First Source</span>
            </button>
          </div>
        ) : (
          <div className={cn(
            "grid gap-6",
            viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
          )}>
            <AnimatePresence>
              {filteredSources.map(source => (
                <motion.div
                  key={source.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/5 rounded-3xl p-6 hover:shadow-2xl hover:shadow-brand-500/10 transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-surface-50 dark:bg-white/5 flex items-center justify-center text-brand-500 border border-surface-100 dark:border-white/5 group-hover:scale-110 transition-transform duration-300">
                        {getSourceIcon(source.type)}
                      </div>
                      <div>
                        <h3 className="font-bold text-surface-950 dark:text-white group-hover:text-brand-500 transition-colors line-clamp-1">
                          {source.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn(
                            "w-2 h-2 rounded-full",
                            source.enabled ? "bg-emerald-500" : "bg-surface-400"
                          )} />
                          <span className="text-xs font-bold uppercase tracking-wider text-surface-500">
                            {source.enabled ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                      <button
                        onClick={() => handleRunHarvest(source.id)}
                        className="p-2 bg-surface-100 dark:bg-white/10 hover:bg-blue-500 hover:text-white rounded-xl transition-all"
                        title="Run Harvest Now"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(source)}
                        className="p-2 bg-surface-100 dark:bg-white/10 hover:bg-brand-500 hover:text-white rounded-xl transition-all"
                        title="Edit Source"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(source)}
                        className="p-2 bg-surface-100 dark:bg-white/10 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                        title="Delete Source"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-surface-500 dark:text-surface-400 mb-6 line-clamp-2 h-10">
                    {source.description || 'No description provided.'}
                  </p>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-surface-50 dark:bg-white/5 rounded-xl p-3 border border-surface-100 dark:border-white/5">
                      <p className="text-[10px] font-bold uppercase text-surface-400 mb-1">Last Harvest</p>
                      <p className="text-xs font-bold text-surface-950 dark:text-white flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {source.last_harvested_at ? new Date(source.last_harvested_at).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                    <div className="bg-surface-50 dark:bg-white/5 rounded-xl p-3 border border-surface-100 dark:border-white/5">
                      <p className="text-[10px] font-bold uppercase text-surface-400 mb-1">Success Rate</p>
                      <p className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        98.5%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-surface-100 dark:border-white/5">
                    <span className="px-2 py-1 rounded bg-surface-100 dark:bg-white/10 text-[10px] font-bold uppercase text-surface-600 dark:text-surface-300">
                      {source.category || 'General'}
                    </span>
                    <div className="text-xs font-medium text-surface-400">
                      ID: {source.id}
                    </div>
                  </div>

                  {/* Glass gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-3xl pointer-events-none" />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-surface-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-surface-100 dark:bg-surface-900 border border-surface-200 dark:border-white/10 rounded-3xl p-8 max-w-xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-surface-950 dark:text-white">
                  {editingSource ? 'Edit Source' : 'Add Harvest Source'}
                </h2>
                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-surface-200 dark:hover:bg-white/10 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-surface-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-surface-500 mb-2">Source Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-white dark:bg-surface-950 border border-surface-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all"
                      placeholder="e.g., TechCrunch News"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-surface-500 mb-2">Type</label>
                      <select
                        value={formData.type}
                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-surface-950 border border-surface-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all appearance-none"
                      >
                        <option value="website">Website</option>
                        <option value="api">API Endpoint</option>
                        <option value="rss">RSS Feed</option>
                        <option value="github">GitHub Repo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-surface-500 mb-2">Category</label>
                      <input
                        type="text"
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-surface-950 border border-surface-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all"
                        placeholder="e.g., News"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-surface-500 mb-2">URL</label>
                    <input
                      type="url"
                      required
                      value={formData.url}
                      onChange={e => setFormData({ ...formData, url: e.target.value })}
                      className="w-full px-4 py-3 bg-white dark:bg-surface-950 border border-surface-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all font-mono text-sm"
                      placeholder="https://..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-surface-500 mb-2">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-3 bg-white dark:bg-surface-950 border border-surface-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all h-24 resize-none"
                      placeholder="Describe this source..."
                    />
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-surface-50 dark:bg-white/5 rounded-xl border border-surface-200 dark:border-white/10">
                    <input
                      type="checkbox"
                      id="enabled"
                      checked={formData.enabled}
                      onChange={e => setFormData({ ...formData, enabled: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <label htmlFor="enabled" className="text-sm font-medium text-surface-900 dark:text-white cursor-pointer select-none">
                      Enable automatic harvesting for this source
                    </label>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-3 bg-surface-200 dark:bg-white/5 hover:bg-surface-300 dark:hover:bg-white/10 text-surface-900 dark:text-white rounded-xl font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        <span>{editingSource ? 'Update Source' : 'Create Source'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
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
            className="fixed inset-0 bg-surface-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-surface-100 dark:bg-surface-900 border border-surface-200 dark:border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
            >
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-black text-surface-950 dark:text-white mb-2">Delete Source?</h2>
              <p className="text-surface-500 dark:text-surface-400 mb-8">
                This will permanently remove "{sourceToDelete?.name}" and all associated history.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-3 bg-surface-200 dark:bg-white/5 hover:bg-surface-300 dark:hover:bg-white/10 text-surface-900 dark:text-white rounded-xl font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/25 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Discover Modal Placeholder - To be implemented further */}
      <AnimatePresence>
        {showDiscoverModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-surface-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-surface-100 dark:bg-surface-900 border border-surface-200 dark:border-white/10 rounded-3xl p-8 max-w-2xl w-full shadow-2xl h-[600px] flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-black text-surface-950 dark:text-white">Discover Sources</h2>
                  <p className="text-surface-500">Find and add new intelligence sources instantly</p>
                </div>
                <button onClick={() => setShowDiscoverModal(false)} className="p-2 hover:bg-surface-200 dark:hover:bg-white/10 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-surface-500" />
                </button>
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-500" />
                  <input
                    type="text"
                    placeholder="Search for topics, companies, or datasets..."
                    className="w-full pl-12 pr-4 py-4 bg-surface-50 dark:bg-surface-950 border border-surface-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500/50 outline-none transition-all font-medium text-lg"
                  />
                </div>
                <button className="px-6 py-4 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-bold shadow-lg shadow-brand-500/25 transition-all">
                  Search
                </button>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 border-2 border-dashed border-surface-200 dark:border-white/10 rounded-3xl m-4">
                <Sparkles className="w-12 h-12 text-surface-400 mb-4" />
                <p className="text-lg font-bold text-surface-500">Enter a topic to discover sources</p>
                <p className="text-sm text-surface-400">We'll search the web for high-quality data sources</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HarvestSources;