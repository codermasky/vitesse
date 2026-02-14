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
  TestTube,
  Database,
  Globe,
  Github,
  ShoppingCart,
  FileText,
  Settings,
  BarChart3,
  Pause
} from 'lucide-react';
import apiService from '../services/api';
import { cn } from '../services/utils';
import SectionHeader from '../components/SectionHeader';

// Types for harvest sources
interface HarvestSource {
  id: number;
  name: string;
  type: string; // Made more permissive to match backend
  url: string;
  description?: string;
  enabled: boolean;
  priority: number;
  auth_type?: string; // Made more permissive to match backend
  auth_config?: any;
  category?: string;
  tags?: string[];
  last_harvested_at?: string;
  harvest_count: number;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

interface HarvestTestResult {
  success: boolean;
  response_time_ms?: number;
  status_code?: number;
  error_message?: string;
  last_tested_at: string;
}

interface HarvestStats {
  total_sources: number;
  enabled_sources: number;
  total_harvests: number;
  successful_harvests: number;
  failed_harvests: number;
  last_harvest_at?: string;
  sources_by_type: Record<string, number>;
  sources_by_category: Record<string, number>;
}

const HarvestSources: React.FC = () => {
  const [sources, setSources] = useState<HarvestSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stats, setStats] = useState<HarvestStats | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSource, setEditingSource] = useState<HarvestSource | null>(null);
  const [testingSource, setTestingSource] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, HarvestTestResult>>({});

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'api_directory' as string,
    url: '',
    description: '',
    enabled: true,
    priority: 0,
    auth_type: 'none' as string,
    category: '',
    tags: [] as string[]
  });

  useEffect(() => {
    loadSources();
    loadStats();
  }, [activeFilter, typeFilter, categoryFilter]);

  const loadSources = async () => {
    try {
      setLoading(true);
      const params: any = {
        limit: 100
      };

      if (activeFilter === 'enabled') params.enabled_only = true;
      if (typeFilter !== 'all') params.source_type = typeFilter;
      if (categoryFilter !== 'all') params.category = categoryFilter;

      const response = await apiService.getHarvestSources(params);
      setSources(response.data.items || []);
    } catch (error) {
      console.error('Failed to load harvest sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await apiService.getHarvestStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load harvest stats:', error);
    }
  };

  const handleCreate = async () => {
    try {
      await apiService.createHarvestSource(formData);
      setShowCreateModal(false);
      resetForm();
      loadSources();
      loadStats();
    } catch (error) {
      console.error('Failed to create harvest source:', error);
    }
  };

  const handleUpdate = async () => {
    if (!editingSource) return;

    try {
      await apiService.updateHarvestSource(editingSource.id, formData);
      setEditingSource(null);
      resetForm();
      loadSources();
    } catch (error) {
      console.error('Failed to update harvest source:', error);
    }
  };

  const handleDelete = async (sourceId: number) => {
    if (!confirm('Are you sure you want to delete this harvest source?')) return;

    try {
      await apiService.deleteHarvestSource(sourceId);
      loadSources();
      loadStats();
    } catch (error) {
      console.error('Failed to delete harvest source:', error);
    }
  };

  const handleTest = async (sourceId: number) => {
    setTestingSource(sourceId);
    try {
      const response = await apiService.testHarvestSource(sourceId);
      setTestResults(prev => ({
        ...prev,
        [sourceId]: response.data
      }));
    } catch (error) {
      console.error('Failed to test harvest source:', error);
      setTestResults(prev => ({
        ...prev,
        [sourceId]: {
          success: false,
          error_message: 'Test failed',
          last_tested_at: new Date().toISOString()
        }
      }));
    } finally {
      setTestingSource(null);
    }
  };

  const handleInitializeDefaults = async () => {
    try {
      await apiService.initializeDefaultHarvestSources();
      loadSources();
      loadStats();
    } catch (error) {
      console.error('Failed to initialize default sources:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'api_directory',
      url: '',
      description: '',
      enabled: true,
      priority: 0,
      auth_type: 'none',
      category: '',
      tags: []
    });
  };

  const openEditModal = (source: HarvestSource) => {
    setEditingSource(source);
    setFormData({
      name: source.name,
      type: source.type as 'api_directory' | 'marketplace' | 'github' | 'documentation',
      url: source.url,
      description: source.description || '',
      enabled: source.enabled,
      priority: source.priority,
      auth_type: (source.auth_type as 'none' | 'api_key' | 'oauth2' | 'basic') || 'none',
      category: source.category || '',
      tags: source.tags || []
    });
  };

  const filteredSources = sources.filter(source =>
    source.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    source.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
    source.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'api_directory': return <Database className="w-4 h-4" />;
      case 'marketplace': return <ShoppingCart className="w-4 h-4" />;
      case 'github': return <Github className="w-4 h-4" />;
      case 'documentation': return <FileText className="w-4 h-4" />;
      default: return <Globe className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'api_directory': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'marketplace': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'github': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'documentation': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Harvest Sources"
        subtitle="Manage API sources for knowledge harvesting"
        icon={Database}
      />

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-surface-800 rounded-lg p-4 border border-surface-200 dark:border-surface-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-surface-600 dark:text-surface-400">Total Sources</p>
                <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">{stats.total_sources}</p>
              </div>
              <Database className="w-8 h-8 text-blue-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-surface-800 rounded-lg p-4 border border-surface-200 dark:border-surface-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-surface-600 dark:text-surface-400">Enabled Sources</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.enabled_sources}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-surface-800 rounded-lg p-4 border border-surface-200 dark:border-surface-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-surface-600 dark:text-surface-400">Total Harvests</p>
                <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">{stats.total_harvests}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-surface-800 rounded-lg p-4 border border-surface-200 dark:border-surface-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-surface-600 dark:text-surface-400">Success Rate</p>
                <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                  {stats.total_harvests > 0 ? Math.round((stats.successful_harvests / stats.total_harvests) * 100) : 0}%
                </p>
              </div>
              <RefreshCw className="w-8 h-8 text-orange-500" />
            </div>
          </motion.div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-surface-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search sources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-surface-300 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as any)}
              className="px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
            >
              <option value="all">All Sources</option>
              <option value="enabled">Enabled Only</option>
              <option value="disabled">Disabled Only</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
            >
              <option value="all">All Types</option>
              <option value="api_directory">API Directory</option>
              <option value="marketplace">Marketplace</option>
              <option value="github">GitHub</option>
              <option value="documentation">Documentation</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100"
            >
              <option value="all">All Categories</option>
              <option value="payments">Payments</option>
              <option value="ecommerce">E-commerce</option>
              <option value="crm">CRM</option>
              <option value="communication">Communication</option>
              <option value="analytics">Analytics</option>
              <option value="developer_tools">Developer Tools</option>
              <option value="cloud">Cloud</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleInitializeDefaults}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Initialize Defaults
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Source
          </button>
        </div>
      </div>

      {/* Sources List */}
      <div className="bg-white dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-surface-400" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-50 dark:bg-surface-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                    Last Harvest
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
                {filteredSources.map((source) => (
                  <tr key={source.id} className="hover:bg-surface-50 dark:hover:bg-surface-700">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-surface-900 dark:text-surface-100">
                          {source.name}
                        </div>
                        <div className="text-sm text-surface-500 dark:text-surface-400 truncate max-w-xs">
                          {source.url}
                        </div>
                        {source.description && (
                          <div className="text-xs text-surface-400 dark:text-surface-500 mt-1 truncate max-w-xs">
                            {source.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium", getTypeColor(source.type))}>
                        {getTypeIcon(source.type)}
                        {source.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-surface-900 dark:text-surface-100">
                        {source.category || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {source.enabled ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <Pause className="w-4 h-4 text-gray-400" />
                        )}
                        <span className={cn("text-sm", source.enabled ? "text-green-600 dark:text-green-400" : "text-gray-500")}>
                          {source.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-surface-900 dark:text-surface-100">
                        {source.last_harvested_at ? (
                          <div>
                            <div>{new Date(source.last_harvested_at).toLocaleDateString()}</div>
                            <div className="text-xs text-surface-500 dark:text-surface-400">
                              {source.harvest_count} harvests
                            </div>
                          </div>
                        ) : (
                          <span className="text-surface-500 dark:text-surface-400">Never</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTest(source.id)}
                          disabled={testingSource === source.id}
                          className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                          title="Test connection"
                        >
                          {testingSource === source.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <TestTube className="w-4 h-4" />
                          )}
                        </button>

                        <button
                          onClick={() => openEditModal(source)}
                          className="p-1 text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300"
                          title="Edit source"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDelete(source.id)}
                          className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          title="Delete source"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        {testResults[source.id] && (
                          <div className="ml-2">
                            {testResults[source.id].success ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredSources.length === 0 && (
              <div className="text-center py-12">
                <Database className="w-12 h-12 text-surface-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-surface-900 dark:text-surface-100 mb-2">
                  No harvest sources found
                </h3>
                <p className="text-surface-500 dark:text-surface-400 mb-4">
                  {searchQuery || activeFilter !== 'all' || typeFilter !== 'all' || categoryFilter !== 'all'
                    ? 'Try adjusting your filters or search query.'
                    : 'Get started by adding your first harvest source or initializing defaults.'}
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                >
                  Add Source
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {(showCreateModal || editingSource) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-surface-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-100">
                  {editingSource ? 'Edit Harvest Source' : 'Add Harvest Source'}
                </h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingSource(null);
                    resetForm();
                  }}
                  className="p-1 hover:bg-surface-100 dark:hover:bg-surface-700 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100"
                      placeholder="e.g., APIs.guru Directory"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                      Type *
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100"
                    >
                      <option value="api_directory">API Directory</option>
                      <option value="marketplace">Marketplace</option>
                      <option value="github">GitHub</option>
                      <option value="documentation">Documentation</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                    URL *
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                    className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100"
                    placeholder="https://api.example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100"
                    placeholder="Optional description of this harvest source"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100"
                    >
                      <option value="">Uncategorized</option>
                      <option value="payments">Payments</option>
                      <option value="ecommerce">E-commerce</option>
                      <option value="crm">CRM</option>
                      <option value="communication">Communication</option>
                      <option value="analytics">Analytics</option>
                      <option value="developer_tools">Developer Tools</option>
                      <option value="cloud">Cloud</option>
                      <option value="general">General</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                      Priority
                    </label>
                    <input
                      type="number"
                      value={formData.priority}
                      onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100"
                      min="0"
                      max="100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                      Status
                    </label>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        checked={formData.enabled}
                        onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                        className="rounded"
                      />
                      <span className="text-sm text-surface-700 dark:text-surface-300">Enabled</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                    Authentication Type
                  </label>
                  <select
                    value={formData.auth_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, auth_type: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100"
                  >
                    <option value="none">None</option>
                    <option value="api_key">API Key</option>
                    <option value="oauth2">OAuth 2.0</option>
                    <option value="basic">Basic Auth</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingSource(null);
                    resetForm();
                  }}
                  className="px-4 py-2 text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={editingSource ? handleUpdate : handleCreate}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {editingSource ? 'Update' : 'Create'} Source
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HarvestSources;