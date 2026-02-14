import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Pause,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Activity,
  Database,
  Plus
} from 'lucide-react';
import apiService from '../services/api';

interface HarvestJob {
  id: string;
  harvest_type: string;
  status: string;
  progress: number;
  total_sources: number;
  processed_sources: number;
  successful_harvests: number;
  failed_harvests: number;
  apis_harvested: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

interface HarvestStats {
  total_jobs: number;
  running_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  success_rate: number;
  average_job_duration: number;
  total_apis_harvested: number;
  jobs_last_24h: number;
  jobs_last_7d: number;
  jobs_last_30d: number;
  most_common_harvest_type: string;
  peak_harvest_time: string;
}

const KnowledgeHarvesterDashboard: React.FC = () => {
  const [jobs, setJobs] = useState<HarvestJob[]>([]);
  const [stats, setStats] = useState<HarvestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<HarvestJob | null>(null);
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [newJobType, setNewJobType] = useState('full');

  useEffect(() => {
    loadData();
    // Set up polling for real-time updates
    const interval = setInterval(loadJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([loadJobs(), loadStats()]);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadJobs = async () => {
    try {
      const response = await apiService.getHarvestJobs({ limit: 20 });
      setJobs(response.data.items || []);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await apiService.getHarvestJobStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const createJob = async () => {
    setIsCreatingJob(true);
    try {
      await apiService.createHarvestJob({ harvest_type: newJobType });
      await loadJobs();
      setNewJobType('full');
    } catch (error) {
      console.error('Failed to create job:', error);
    } finally {
      setIsCreatingJob(false);
    }
  };

  const cancelJob = async (jobId: string) => {
    try {
      await apiService.cancelHarvestJob(jobId);
      await loadJobs();
    } catch (error) {
      console.error('Failed to cancel job:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'running':
        return <Activity className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'queued':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-brand-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'queued':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-brand-100 text-brand-800';
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
    <div className="space-y-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-[2.5rem] p-12 border border-brand-500/10 space-y-6"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
              <Database className="w-7 h-7 text-brand-500" />
            </div>
            <div>
              <h1 className="text-5xl lg:text-6xl font-black tracking-tight text-surface-950 dark:text-white leading-[1.1]">Knowledge Harvester Dashboard</h1>
              <p className="text-lg text-surface-600 dark:text-surface-400 font-medium">Monitor and manage knowledge harvesting operations with real-time insights and automated workflows.</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={newJobType}
              onChange={(e) => setNewJobType(e.target.value)}
              className="px-4 py-2.5 bg-surface-100 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              <option value="full">Full Harvest</option>
              <option value="financial">Financial APIs</option>
              <option value="api_directory">API Directory</option>
              <option value="documentation">Documentation</option>
              <option value="code_repositories">Code Repositories</option>
            </select>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={createJob}
              disabled={isCreatingJob}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-brand-500/20 transition-all duration-300 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {isCreatingJob ? 'Starting...' : 'Start Harvest'}
            </motion.button>
          </div>
        </div>
      </motion.div>

      <div className="flex justify-end -mt-6 mb-6">
        <a href="/knowledge-base" className="text-sm text-brand-500 hover:text-brand-400 font-medium flex items-center gap-1">
          Browse Knowledge Base <Database className="w-3 h-3" />
        </a>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass p-8 rounded-3xl border border-white/5 flex items-center justify-between group"
          >
            <div>
              <p className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest mb-1">Total Jobs</p>
              <h3 className="text-3xl font-black text-surface-950 dark:text-white tracking-tighter">{stats.total_jobs}</h3>
            </div>
            <div className="w-14 h-14 bg-brand-500/10 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110">
              <BarChart3 className="w-7 h-7 text-brand-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass p-8 rounded-3xl border border-white/5 flex items-center justify-between group"
          >
            <div>
              <p className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest mb-1">Running Jobs</p>
              <h3 className="text-3xl font-black text-surface-950 dark:text-white tracking-tighter">{stats.running_jobs}</h3>
            </div>
            <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110">
              <Activity className="w-7 h-7 text-emerald-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass p-8 rounded-3xl border border-white/5 flex items-center justify-between group"
          >
            <div>
              <p className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest mb-1">Success Rate</p>
              <h3 className="text-3xl font-black text-surface-950 dark:text-white tracking-tighter">{Math.round(stats.success_rate * 100)}%</h3>
            </div>
            <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110">
              <TrendingUp className="w-7 h-7 text-blue-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass p-8 rounded-3xl border border-white/5 flex items-center justify-between group"
          >
            <div>
              <p className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase tracking-widest mb-1">APIs Harvested</p>
              <h3 className="text-3xl font-black text-surface-950 dark:text-white tracking-tighter">{stats.total_apis_harvested}</h3>
            </div>
            <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110">
              <Database className="w-7 h-7 text-purple-500" />
            </div>
          </motion.div>
        </div>
      )}

      {/* Jobs Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="glass rounded-3xl p-6 border border-white/20 shadow-xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
            Recent Harvest Jobs
          </h2>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-lg"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            New Harvest
          </motion.button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-white/5">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                  Job ID
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                  APIs Found
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                  Success/Fail
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {jobs.map((job, index) => (
                <motion.tr
                  key={job.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + index * 0.1, duration: 0.3 }}
                  className="hover:bg-white/5 transition-colors duration-200"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                    {job.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70 capitalize">
                    {job.harvest_type.replace('_', ' ')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                      {getStatusIcon(job.status)}
                      <span className="ml-1 capitalize">{job.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70">
                    <div className="flex items-center">
                      <div className="w-16 bg-white/20 rounded-full h-2 mr-2">
                        <motion.div
                          className="bg-gradient-to-r from-purple-400 to-pink-400 h-2 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${job.progress}%` }}
                          transition={{ delay: 0.8 + index * 0.1, duration: 0.8 }}
                        ></motion.div>
                      </div>
                      {job.progress}%
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70">
                    {job.apis_harvested}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70">
                    <span className="text-green-400">{job.successful_harvests}</span>
                    {' / '}
                    <span className="text-red-400">{job.failed_harvests}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      {job.status === 'running' && (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => cancelJob(job.id)}
                          className="text-red-400 hover:text-red-300 transition-colors duration-200"
                        >
                          <Pause className="w-4 h-4" />
                        </motion.button>
                      )}
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setSelectedJob(job)}
                        className="text-blue-400 hover:text-blue-300 transition-colors duration-200"
                      >
                        <BarChart3 className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Job Details Modal */}
      {selectedJob && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center"
          onClick={() => setSelectedJob(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative mx-auto p-6 border border-white/20 shadow-2xl rounded-3xl glass max-w-2xl w-full m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                Job Details: {selectedJob.id}
              </h3>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setSelectedJob(null)}
                className="text-white/60 hover:text-white transition-colors duration-200"
              >
                <XCircle className="w-6 h-6" />
              </motion.button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white/5 rounded-xl p-4 border border-white/10"
              >
                <p className="text-sm font-medium text-white/80 mb-1">Harvest Type</p>
                <p className="text-sm text-white capitalize">{selectedJob.harvest_type.replace('_', ' ')}</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-white/5 rounded-xl p-4 border border-white/10"
              >
                <p className="text-sm font-medium text-white/80 mb-1">Status</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedJob.status)}`}>
                  {getStatusIcon(selectedJob.status)}
                  <span className="ml-1 capitalize">{selectedJob.status}</span>
                </span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white/5 rounded-xl p-4 border border-white/10"
              >
                <p className="text-sm font-medium text-white/80 mb-1">Progress</p>
                <p className="text-sm text-white">{selectedJob.progress}%</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-white/5 rounded-xl p-4 border border-white/10"
              >
                <p className="text-sm font-medium text-white/80 mb-1">APIs Harvested</p>
                <p className="text-sm text-white">{selectedJob.apis_harvested}</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white/5 rounded-xl p-4 border border-white/10"
              >
                <p className="text-sm font-medium text-white/80 mb-1">Sources Processed</p>
                <p className="text-sm text-white">{selectedJob.processed_sources} / {selectedJob.total_sources}</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="bg-white/5 rounded-xl p-4 border border-white/10"
              >
                <p className="text-sm font-medium text-white/80 mb-1">Success Rate</p>
                <p className="text-sm text-white">
                  {selectedJob.total_sources > 0
                    ? ((selectedJob.successful_harvests / selectedJob.total_sources) * 100).toFixed(1)
                    : 0
                  }%
                </p>
              </motion.div>
            </div>

            {selectedJob.error_message && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4"
              >
                <p className="text-sm font-medium text-red-400 mb-2">Error Message</p>
                <p className="text-sm text-red-300">{selectedJob.error_message}</p>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="mt-6 flex justify-end"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedJob(null)}
                className="px-6 py-2 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-all duration-200 border border-white/20"
              >
                Close
              </motion.button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default KnowledgeHarvesterDashboard;