import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  TestTube,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  Code,
  Database,
  Zap,
  Trash2
} from 'lucide-react';
import SectionHeader from '../components/SectionHeader';
import apiService from '../services/api';

interface Integration {
  id: string;
  name: string;
  description: string;
  source_api: string;
  target_api: string;
  status: string;
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
  end_time?: string;
  success?: boolean;
  error_message?: string;
  request_data: any;
  response_data?: any;
  execution_time?: number;
}

const IntegrationBuilder: React.FC = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFieldMappingModal, setShowFieldMappingModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
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
      setIntegrations(response.data.items || []);
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

  const deleteIntegration = async (integrationId: string) => {
    if (!confirm('Are you sure you want to delete this integration?')) return;

    try {
      await apiService.deleteIntegration(integrationId);
      await loadIntegrations();
      if (selectedIntegration?.id === integrationId) {
        setSelectedIntegration(null);
      }
    } catch (error) {
      console.error('Failed to delete integration:', error);
    }
  };

  const addFieldMapping = async () => {
    if (!selectedIntegration) return;

    try {
      await apiService.addFieldMapping(selectedIntegration.id, newMapping);
      await loadIntegrations();
      setShowFieldMappingModal(false);
      setNewMapping({ source_field: '', target_field: '', data_type: 'string', required: true });
    } catch (error) {
      console.error('Failed to add field mapping:', error);
    }
  };

  const runTest = async () => {
    if (!selectedIntegration) return;

    try {
      const parsedData = JSON.parse(testData);
      await apiService.testIntegration(selectedIntegration.id, parsedData);

      // Load test results after a short delay
      setTimeout(async () => {
        const response = await apiService.getIntegrationTestResults(selectedIntegration.id, 5);
        setTestResults(response.data || []);
      }, 2000);

    } catch (error) {
      console.error('Failed to run test:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'testing':
        return <TestTube className="w-4 h-4 text-blue-500" />;
      case 'draft':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'inactive':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'testing':
        return 'bg-blue-100 text-blue-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <SectionHeader
        title="Integration Builder"
        subtitle="Create and manage API integrations with visual mapping"
        variant="premium"
        actions={
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCreateModal(true)}
            className="flex items-center px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Integration
          </motion.button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Integrations List */}
        <div className="lg:col-span-1">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="glass rounded-3xl border border-white/20 shadow-xl"
          >
            <div className="p-6 border-b border-white/10">
              <h2 className="text-xl font-semibold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                Integrations
              </h2>
            </div>
            <div className="divide-y divide-white/10 max-h-96 overflow-y-auto">
              {integrations.map((integration, index) => (
                <motion.div
                  key={integration.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1, duration: 0.3 }}
                  className={`p-6 cursor-pointer hover:bg-white/5 transition-colors duration-200 ${
                    selectedIntegration?.id === integration.id ? 'bg-white/10 border-r-2 border-purple-400' : ''
                  }`}
                  onClick={() => setSelectedIntegration(integration)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl border border-white/10">
                        <Database className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{integration.name}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(integration.status)}`}>
                            {getStatusIcon(integration.status)}
                            <span className="ml-1 capitalize">{integration.status}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white/60">{integration.field_mappings.length} mappings</p>
                      <p className="text-xs text-white/60">{integration.success_rate.toFixed(1)}% success</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Integration Details */}
        <div className="lg:col-span-2">
          {selectedIntegration ? (
            <div className="space-y-8">
              {/* Integration Header */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="glass rounded-3xl border border-white/20 shadow-xl p-8"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                      {selectedIntegration.name}
                    </h2>
                    <p className="text-white/80">{selectedIntegration.description}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowFieldMappingModal(true)}
                      className="flex items-center px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-medium hover:from-green-600 hover:to-emerald-600 transition-all duration-200 shadow-lg"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Mapping
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowTestModal(true)}
                      className="flex items-center px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-lg"
                    >
                      <TestTube className="w-4 h-4 mr-2" />
                      Test
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => deleteIntegration(selectedIntegration.id)}
                      className="flex items-center px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-medium hover:from-red-600 hover:to-pink-600 transition-all duration-200 shadow-lg"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </motion.button>
                  </div>
                </div>

                {/* API Flow Visualization */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                  className="flex items-center justify-center py-8"
                >
                  <div className="flex items-center space-x-8">
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className="text-center"
                    >
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mb-3 border border-white/10 shadow-lg">
                        <Database className="w-10 h-10 text-blue-400" />
                      </div>
                      <p className="text-sm font-semibold text-white mb-1">Source</p>
                      <p className="text-xs text-white/60">{selectedIntegration.source_api}</p>
                    </motion.div>
                    <motion.div
                      animate={{ x: [0, 10, 0] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    >
                      <ArrowRight className="w-8 h-8 text-white/60" />
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className="text-center"
                    >
                      <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center mb-3 border border-white/10 shadow-lg">
                        <Zap className="w-10 h-10 text-purple-400" />
                      </div>
                      <p className="text-sm font-semibold text-white mb-1">Integration</p>
                      <p className="text-xs text-white/60">{selectedIntegration.field_mappings.length} mappings</p>
                    </motion.div>
                    <motion.div
                      animate={{ x: [0, 10, 0] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut", delay: 0.5 }}
                    >
                      <ArrowRight className="w-8 h-8 text-white/60" />
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className="text-center"
                    >
                      <div className="w-20 h-20 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-2xl flex items-center justify-center mb-3 border border-white/10 shadow-lg">
                        <Database className="w-10 h-10 text-green-400" />
                      </div>
                      <p className="text-sm font-semibold text-white mb-1">Target</p>
                      <p className="text-xs text-white/60">{selectedIntegration.target_api}</p>
                    </motion.div>
                  </div>
                </motion.div>
              </motion.div>

              {/* Field Mappings */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="glass rounded-3xl border border-white/20 shadow-xl"
              >
                <div className="p-6 border-b border-white/10">
                  <h3 className="text-xl font-semibold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                    Field Mappings
                  </h3>
                </div>
                <div className="divide-y divide-white/10">
                  {selectedIntegration.field_mappings.length > 0 ? (
                    selectedIntegration.field_mappings.map((mapping: FieldMapping, index) => (
                      <motion.div
                        key={mapping.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.9 + index * 0.1, duration: 0.3 }}
                        className="p-6"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl border border-white/10">
                              <Code className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-white">
                                {mapping.source_field} → {mapping.target_field}
                              </p>
                              <p className="text-xs text-white/60">
                                {mapping.data_type} {mapping.required ? '(required)' : '(optional)'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {mapping.transformation && (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-300 border border-yellow-500/20">
                                Transform
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.9, duration: 0.5 }}
                      className="p-12 text-center"
                    >
                      <div className="p-4 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl border border-white/10 w-fit mx-auto mb-6">
                        <Database className="w-12 h-12 text-blue-400 mx-auto" />
                      </div>
                      <p className="text-white/80 font-medium mb-2">No field mappings configured</p>
                      <p className="text-sm text-white/60">Add mappings to define how data flows between APIs</p>
                    </motion.div>
                  )}
                </div>
              </motion.div>

              {/* Test Results */}
              {testResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.0, duration: 0.5 }}
                  className="glass rounded-3xl border border-white/20 shadow-xl"
                >
                  <div className="p-6 border-b border-white/10">
                    <h3 className="text-xl font-semibold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                      Recent Test Results
                    </h3>
                  </div>
                  <div className="divide-y divide-white/10">
                    {testResults.slice(0, 3).map((result, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.1 + index * 0.1, duration: 0.3 }}
                        className="p-6"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            {result.success ? (
                              <div className="p-2 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl border border-green-500/20">
                                <CheckCircle className="w-5 h-5 text-green-400" />
                              </div>
                            ) : (
                              <div className="p-2 bg-gradient-to-br from-red-500/20 to-pink-500/20 rounded-xl border border-red-500/20">
                                <XCircle className="w-5 h-5 text-red-400" />
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-semibold text-white">
                                Test {result.success ? 'Passed' : 'Failed'}
                              </p>
                              <p className="text-xs text-white/60">
                                {result.execution_time}ms • {new Date(result.start_time).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                          {result.error_message && (
                            <p className="text-xs text-red-300 max-w-xs truncate">
                              {result.error_message}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="glass rounded-3xl border border-white/20 shadow-xl p-16 text-center"
            >
              <div className="p-6 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl border border-white/10 w-fit mx-auto mb-6">
                <Database className="w-16 h-16 text-blue-400 mx-auto" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Select an Integration</h3>
              <p className="text-white/70">Choose an integration from the list to view details and manage mappings</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Create Integration Modal */}
      {showCreateModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center"
          onClick={() => setShowCreateModal(false)}
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
                Create New Integration
              </h3>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowCreateModal(false)}
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
                <label className="block text-sm font-medium text-white/80 mb-2">Name</label>
                <input
                  type="text"
                  value={newIntegration.name}
                  onChange={(e) => setNewIntegration({ ...newIntegration, name: e.target.value })}
                  className="block w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-transparent"
                  placeholder="My Integration"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <label className="block text-sm font-medium text-white/80 mb-2">Description</label>
                <textarea
                  value={newIntegration.description}
                  onChange={(e) => setNewIntegration({ ...newIntegration, description: e.target.value })}
                  rows={3}
                  className="block w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-transparent resize-none"
                  placeholder="Describe your integration..."
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <label className="block text-sm font-medium text-white/80 mb-2">Source API</label>
                <input
                  type="text"
                  value={newIntegration.source_api}
                  onChange={(e) => setNewIntegration({ ...newIntegration, source_api: e.target.value })}
                  className="block w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-transparent"
                  placeholder="https://api.source.com"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <label className="block text-sm font-medium text-white/80 mb-2">Target API</label>
                <input
                  type="text"
                  value={newIntegration.target_api}
                  onChange={(e) => setNewIntegration({ ...newIntegration, target_api: e.target.value })}
                  className="block w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-transparent"
                  placeholder="https://api.target.com"
                />
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
                onClick={() => setShowCreateModal(false)}
                className="px-6 py-2 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-all duration-200 border border-white/20"
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={createIntegration}
                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-lg"
              >
                Create
              </motion.button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}

      {/* Field Mapping Modal */}
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
                  className="block w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-transparent"
                >
                  <option value="string" className="bg-gray-800">String</option>
                  <option value="number" className="bg-gray-800">Number</option>
                  <option value="boolean" className="bg-gray-800">Boolean</option>
                  <option value="object" className="bg-gray-800">Object</option>
                  <option value="array" className="bg-gray-800">Array</option>
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

      {/* Test Modal */}
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
    </div>
  );
};

export default IntegrationBuilder;