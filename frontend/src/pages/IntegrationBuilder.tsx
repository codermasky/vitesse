import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  TestTube,
  CheckCircle,
  XCircle,
  ArrowRight,
  Code,
  Database,
  Zap,
  Trash2,
  RotateCw,
  Layers,
  Search,
  ChevronRight
} from 'lucide-react';
import apiService from '../services/api';

// --- Types ---
interface Integration {
  id: string;
  name: string;
  description: string;
  source_api: string;
  target_api: string;
  status: 'active' | 'inactive' | 'error' | 'syncing';
  field_mappings: any[];
  transformation_rules: any[];
  last_sync?: string;
  success_rate: number;
  created_at: string;
}

interface FieldMapping {
  id: string;
  source_field: string;
  target_field: string;
  data_type: string;
  required: boolean;
  transformation?: string;
}

interface TestResult {
  integration_id: string;
  status: string;
  start_time: string;
  success?: boolean;
  error_message?: string;
  execution_time?: number;
}

// --- Components ---

const StatusBadge = ({ status }: { status: string }) => {
  const styles = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    inactive: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
    syncing: 'bg-brand-primary/20 text-brand-primary border-brand-primary/30',
  };

  const labels = {
    active: 'Active',
    inactive: 'Inactive',
    error: 'Error',
    syncing: 'Syncing...',
  };

  const key = status.toLowerCase() as keyof typeof styles;
  const style = styles[key] || styles.inactive;
  const label = labels[key] || status;

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${style} backdrop-blur-sm`}>
      {label}
    </span>
  );
};

const MetricCard = ({ label, value, icon: Icon, trend }: any) => (
  <div className="premium-card p-4 flex items-start justify-between">
    <div>
      <p className="text-surface-400 text-sm font-medium mb-1">{label}</p>
      <h3 className="text-2xl font-bold text-white">{value}</h3>
      {trend && (
        <p className={`text-xs mt-1 ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
          {trend > 0 ? '+' : ''}{trend}% from last week
        </p>
      )}
    </div>
    <div className="p-2 rounded-lg bg-surface-800/50 border border-surface-700/50">
      <Icon className="w-5 h-5 text-brand-primary" />
    </div>
  </div>
);

const IntegrationBuilder: React.FC = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFieldMappingModal, setShowFieldMappingModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  // Form State
  const [newIntegration, setNewIntegration] = useState({
    name: '',
    description: '',
    source_api: '',
    target_api: '',
  });

  const [newMapping, setNewMapping] = useState({
    source_field: '',
    target_field: '',
    data_type: 'string',
    required: true,
  });

  const [testData, setTestData] = useState('{}');

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      const response = await apiService.getIntegrations({ limit: 20 });
      let items = response.data.items;
      if (!items && Array.isArray(response.data)) items = response.data;
      if (!items && response.data?.data && Array.isArray(response.data.data)) items = response.data.data;

      setIntegrations(Array.isArray(items) ? items : []);
    } catch (error) {
      console.error('Failed to load integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const createIntegration = async () => {
    try {
      await apiService.createIntegration(newIntegration);
      await loadIntegrations();
      setShowCreateModal(false);
      setNewIntegration({ name: '', description: '', source_api: '', target_api: '' });
    } catch (error) {
      console.error('Failed to create integration:', error);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (confirm('Are you sure you want to delete this integration?')) {
      try {
        await apiService.deleteIntegration(id);
        await loadIntegrations();
        if (selectedIntegration?.id === id) {
          setSelectedIntegration(null);
        }
      } catch (error) {
        console.error('Failed to delete integration:', error);
      }
    }
  };

  const addFieldMapping = async () => {
    if (!selectedIntegration) return;
    try {
      await apiService.addFieldMapping(selectedIntegration.id, newMapping);
      await loadIntegrations();
      // Refresh selected integration
      const updated = await apiService.getIntegration(selectedIntegration.id);
      setSelectedIntegration(updated.data);
      setShowFieldMappingModal(false);
      setNewMapping({ source_field: '', target_field: '', data_type: 'string', required: true });
    } catch (error) {
      console.error('Failed to add mapping:', error);
    }
  };

  const runTest = async () => {
    if (!selectedIntegration) return;
    try {
      const parsed = JSON.parse(testData);
      await apiService.testIntegration(selectedIntegration.id, parsed);
      // Mock results for now or fetch
      // setTimeout for effect
      setTimeout(async () => {
        const results = await apiService.getIntegrationTestResults(selectedIntegration.id, 3);
        setTestResults(results.data || []);
      }, 1000);
    } catch (error) {
      console.error('Test failed:', error);
    }
  };

  const filteredIntegrations = integrations.filter(i =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.source_api.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 p-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Integration Builder</h1>
          <p className="text-surface-400 mt-1">Design, test, and deploy API integrations visually.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Integration
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard label="Active Integrations" value={integrations.filter(i => i.status === 'active').length} icon={Zap} trend={12} />
        <MetricCard label="Total Requests" value="1.2M" icon={Database} trend={5} />
        <MetricCard label="Avg. Latency" value="45ms" icon={RotateCw} trend={-2} />
        <MetricCard label="Success Rate" value="99.9%" icon={CheckCircle} trend={0.1} />
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-[600px]">

        {/* Left Column: Integration List */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="premium-card p-4 flex gap-2 items-center">
            <Search className="w-4 h-4 text-surface-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-white w-full text-sm"
            />
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[800px] custom-scrollbar pr-2">
            {loading ? (
              [...Array(3)].map((_, i) => <div key={i} className="h-32 rounded-xl bg-surface-800/50 animate-pulse" />)
            ) : filteredIntegrations.map(integration => (
              <motion.div
                key={integration.id}
                onClick={() => setSelectedIntegration(integration)}
                className={`p-4 rounded-xl border transition-all cursor-pointer group ${selectedIntegration?.id === integration.id
                  ? 'bg-brand-500/10 border-brand-500/50 shadow-[0_0_15px_rgba(var(--brand-primary),0.2)]'
                  : 'bg-surface-900/40 border-surface-800 hover:bg-surface-800/60 hover:border-surface-700'
                  }`}
                whileHover={{ scale: 1.01 }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="p-1.5 rounded bg-surface-800 border border-surface-700">
                    <Layers className="w-4 h-4 text-brand-primary" />
                  </div>
                  <StatusBadge status={integration.status} />
                </div>
                <h3 className="text-white font-medium truncate">{integration.name}</h3>
                <p className="text-xs text-surface-400 mt-1 line-clamp-1">{integration.source_api} → {integration.target_api}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-surface-500">
                  <span>{integration.field_mappings.length} mappings</span>
                  <ChevronRight className={`w-4 h-4 transition-transform ${selectedIntegration?.id === integration.id ? 'rotate-90 text-brand-primary' : ''}`} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right Column: Details & Configuration */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {selectedIntegration ? (
              <motion.div
                key={selectedIntegration.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                {/* Details Header */}
                <div className="premium-card p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-32 bg-brand-500/10 blur-3xl rounded-full pointer-events-none" />
                  <div className="flex justify-between items-start relative">
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-2">{selectedIntegration.name}</h2>
                      <p className="text-surface-400 max-w-lg">{selectedIntegration.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowTestModal(true)}
                        className="btn-secondary flex items-center gap-2"
                      >
                        <TestTube className="w-4 h-4" /> Test
                      </button>
                      <button
                        onClick={() => handleDelete(selectedIntegration.id)}
                        className="p-2.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Flow Viz */}
                  <div className="flex items-center justify-center gap-8 mt-8 py-4">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-2xl bg-surface-800 border border-surface-700 flex items-center justify-center mx-auto mb-2 relative group">
                        <div className="absolute inset-0 bg-blue-500/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Database className="w-8 h-8 text-blue-400 relative" />
                      </div>
                      <p className="text-xs font-mono text-surface-300">{selectedIntegration.source_api}</p>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-brand-primary to-transparent" />
                      <p className="text-[10px] text-brand-primary mt-1 uppercase tracking-wider">Mapping</p>
                    </div>

                    <div className="text-center">
                      <div className="w-16 h-16 rounded-2xl bg-surface-800 border border-surface-700 flex items-center justify-center mx-auto mb-2 relative group">
                        <div className="absolute inset-0 bg-green-500/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Database className="w-8 h-8 text-green-400 relative" />
                      </div>
                      <p className="text-xs font-mono text-surface-300">{selectedIntegration.target_api}</p>
                    </div>
                  </div>
                </div>

                {/* Mappings & Rules */}
                <div className="premium-card min-h-[400px]">
                  <div className="p-4 border-b border-surface-700/50 flex justify-between items-center">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                      <Code className="w-4 h-4 text-brand-primary" />
                      Field Mappings
                    </h3>
                    <button
                      onClick={() => setShowFieldMappingModal(true)}
                      className="text-xs btn-primary py-1.5 px-3"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Mapping
                    </button>
                  </div>

                  <div className="divide-y divide-surface-800">
                    {selectedIntegration.field_mappings.length === 0 ? (
                      <div className="py-12 text-center text-surface-500">
                        <Code className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No mappings configured yet.</p>
                      </div>
                    ) : selectedIntegration.field_mappings.map((m: FieldMapping, i: number) => (
                      <div key={i} className="p-4 flex items-center justify-between hover:bg-surface-900/30 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="font-mono text-sm text-blue-300 bg-blue-500/10 px-2 py-1 rounded">{m.source_field}</div>
                          <ArrowRight className="w-4 h-4 text-surface-600" />
                          <div className="font-mono text-sm text-green-300 bg-green-500/10 px-2 py-1 rounded">{m.target_field}</div>
                        </div>
                        <div className="flex gap-2">
                          {m.required && <span className="text-[10px] border border-red-500/30 text-red-300 px-1.5 py-0.5 rounded">Required</span>}
                          {m.data_type && <span className="text-[10px] border border-surface-700 text-surface-400 px-1.5 py-0.5 rounded uppercase">{m.data_type}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Test Results */}
                {testResults.length > 0 && (
                  <div className="premium-card overflow-hidden">
                    <div className="p-4 border-b border-surface-700/50 bg-surface-900/30">
                      <h3 className="text-sm font-semibold text-white">Top 3 Recent Tests</h3>
                    </div>
                    {testResults.map((res, i) => (
                      <div key={i} className={`p-3 border-b border-surface-800/50 flex items-center gap-3 ${res.success ? 'bg-green-500/5' : 'bg-red-500/5'}`}>
                        {res.success ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                        <div className="flex-1">
                          <p className="text-sm text-white font-medium">{res.success ? 'Passed' : 'Failed'}</p>
                          {res.error_message && <p className="text-xs text-red-300">{res.error_message}</p>}
                        </div>
                        <span className="text-xs text-surface-500 font-mono">{res.execution_time}ms</span>
                      </div>
                    ))}
                  </div>
                )}

              </motion.div>
            ) : (
              <div className="h-full bg-surface-900/20 border-2 border-dashed border-surface-800 rounded-3xl flex flex-col items-center justify-center text-surface-500 p-8">
                <Layers className="w-16 h-16 mb-4 opacity-20" />
                <h3 className="text-xl font-medium text-white mb-2">No Integration Selected</h3>
                <p className="max-w-xs text-center">Select an integration from the list to view details, configure mappings, and run tests.</p>
              </div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="premium-card w-full max-w-lg p-6 relative"
            >
              <button
                onClick={() => setShowCreateModal(false)}
                className="absolute top-4 right-4 text-surface-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>

              <h2 className="text-2xl font-bold text-white mb-6">New Integration</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1">Name</label>
                  <input
                    type="text"
                    value={newIntegration.name}
                    onChange={(e) => setNewIntegration({ ...newIntegration, name: e.target.value })}
                    className="w-full bg-surface-900 border border-surface-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-primary"
                    placeholder="e.g. Stripe to Salesforce"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1">Description</label>
                  <textarea
                    value={newIntegration.description}
                    onChange={(e) => setNewIntegration({ ...newIntegration, description: e.target.value })}
                    className="w-full bg-surface-900 border border-surface-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-primary h-24 resize-none"
                    placeholder="What does this integration do?"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1">Source API</label>
                    <input
                      type="text"
                      value={newIntegration.source_api}
                      onChange={(e) => setNewIntegration({ ...newIntegration, source_api: e.target.value })}
                      className="w-full bg-surface-900 border border-surface-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-primary"
                      placeholder="e.g. Stripe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1">Target API</label>
                    <input
                      type="text"
                      value={newIntegration.target_api}
                      onChange={(e) => setNewIntegration({ ...newIntegration, target_api: e.target.value })}
                      className="w-full bg-surface-900 border border-surface-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-primary"
                      placeholder="e.g. Salesforce"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={createIntegration}
                  disabled={!newIntegration.name || !newIntegration.source_api || !newIntegration.target_api}
                  className="btn-primary"
                >
                  Create Integration
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Field Mapping Modal */}
      <AnimatePresence>
        {showFieldMappingModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center"
            onClick={() => setShowFieldMappingModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative mx-auto p-8 border border-white/20 shadow-2xl rounded-3xl glass max-w-md w-full m-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                  Add Field Mapping
                </h3>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowFieldMappingModal(false)}
                  className="text-white/60 hover:text-white transition-colors duration-200"
                >
                  <XCircle className="w-6 h-6" />
                </motion.button>
              </div>

              <div className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <label className="block text-sm font-medium text-white/80 mb-2">Source Field</label>
                  <input
                    type="text"
                    value={newMapping.source_field}
                    onChange={(e) => setNewMapping({ ...newMapping, source_field: e.target.value })}
                    className="block w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-transparent"
                    placeholder="user_id"
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <label className="block text-sm font-medium text-white/80 mb-2">Target Field</label>
                  <input
                    type="text"
                    value={newMapping.target_field}
                    onChange={(e) => setNewMapping({ ...newMapping, target_field: e.target.value })}
                    className="block w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-transparent"
                    placeholder="customer_id"
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <label className="block text-sm font-medium text-white/80 mb-2">Data Type</label>
                  <select
                    value={newMapping.data_type}
                    onChange={(e) => setNewMapping({ ...newMapping, data_type: e.target.value })}
                    className="block w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-transparent appearance-none"
                  >
                    <option value="string" className="bg-brand-900">String</option>
                    <option value="number" className="bg-brand-900">Number</option>
                    <option value="boolean" className="bg-brand-900">Boolean</option>
                    <option value="object" className="bg-brand-900">Object</option>
                    <option value="array" className="bg-brand-900">Array</option>
                  </select>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="flex items-center"
                >
                  <input
                    type="checkbox"
                    checked={newMapping.required}
                    onChange={(e) => setNewMapping({ ...newMapping, required: e.target.checked })}
                    className="h-4 w-4 text-purple-400 focus:ring-purple-400/50 border-white/20 rounded bg-white/10"
                  />
                  <label className="ml-3 block text-sm text-white/80">Required field</label>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex justify-end space-x-4 mt-8"
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowFieldMappingModal(false)}
                  className="px-6 py-2 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-all duration-200 border border-white/20"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={addFieldMapping}
                  className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-medium hover:from-green-600 hover:to-emerald-600 transition-all duration-200 shadow-lg"
                >
                  Add Mapping
                </motion.button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Test Modal */}
      <AnimatePresence>
        {showTestModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center"
            onClick={() => setShowTestModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative mx-auto p-8 border border-white/20 shadow-2xl rounded-3xl glass max-w-2xl w-full m-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                  Test Integration
                </h3>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowTestModal(false)}
                  className="text-white/60 hover:text-white transition-colors duration-200"
                >
                  <XCircle className="w-6 h-6" />
                </motion.button>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-3">Test Data (JSON)</label>
                  <textarea
                    value={testData}
                    onChange={(e) => setTestData(e.target.value)}
                    rows={10}
                    className="block w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-transparent font-mono text-sm resize-none"
                    placeholder='{"user_id": "123", "amount": 100}'
                  />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex justify-end space-x-4 mt-8"
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowTestModal(false)}
                  className="px-6 py-2 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-all duration-200 border border-white/20"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={runTest}
                  className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-lg"
                >
                  Run Test
                </motion.button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default IntegrationBuilder;