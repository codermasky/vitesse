import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Activity,
  Database,
  Trash2,
  Search,
  RefreshCw,
  Globe,
  BookOpen,
  Code2
} from 'lucide-react';
import apiService from '../services/api';

// --- Types ---
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
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
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

  const cancelJob = async (jobId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await apiService.cancelHarvestJob(jobId);
      await loadJobs();
    } catch (error) {
      console.error('Failed to cancel job:', error);
    }
  };

  const deleteJob = async (jobId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this job? This action cannot be undone.')) return;
    try {
      await apiService.deleteHarvestJob(jobId);
      setJobs(jobs.filter(j => j.id !== jobId));
      loadStats();
      if (selectedJob?.id === jobId) setSelectedJob(null);
    } catch (error) {
      console.error('Failed to delete job:', error);
    }
  };

  const bulkDeleteJobs = async () => {
    if (selectedJobIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedJobIds.size} jobs?`)) return;
    try {
      await apiService.bulkDeleteHarvestJobs(Array.from(selectedJobIds));
      setJobs(jobs.filter(j => !selectedJobIds.has(j.id)));
      setSelectedJobIds(new Set());
      loadStats();
    } catch (error) {
      console.error('Failed to bulk delete jobs:', error);
    }
  };

  const toggleJobSelection = (jobId: string) => {
    const newSelected = new Set(selectedJobIds);
    if (newSelected.has(jobId)) newSelected.delete(jobId);
    else newSelected.add(jobId);
    setSelectedJobIds(newSelected);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'running': return 'text-blue-400 bg-blue-500/10 border-blue-500/20 animate-pulse';
      case 'failed': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'queued': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      default: return 'text-surface-400 bg-surface-500/10 border-surface-500/20';
    }
  };

  const getJobTypeIcon = (type: string) => {
    switch (type) {
      case 'financial': return <TrendingUp className="w-4 h-4" />;
      case 'api_directory': return <Globe className="w-4 h-4" />;
      case 'documentation': return <BookOpen className="w-4 h-4" />;
      case 'code_repositories': return <Code2 className="w-4 h-4" />;
      default: return <Database className="w-4 h-4" />;
    }
  };

  const filteredJobs = jobs.filter(job =>
    job.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.harvest_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-surface-950 transition-colors duration-300 p-6">
      <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Knowledge Harvester</h1>
          <p className="text-surface-400 mt-1">Monitor and manage knowledge ingestion pipelines.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-surface-800/50 rounded-lg p-1 border border-surface-700/50 flex">
            <select
              value={newJobType}
              onChange={(e) => setNewJobType(e.target.value)}
              className="bg-transparent text-sm text-surface-300 border-none focus:ring-0 cursor-pointer pr-8"
            >
              <option value="full">Full Harvest</option>
              <option value="financial">Financial APIs</option>
              <option value="api_directory">API Directory</option>
              <option value="documentation">Documentation</option>
              <option value="code_repositories">Code Repositories</option>
            </select>
          </div>
          <button
            onClick={createJob}
            disabled={isCreatingJob}
            className="btn-primary flex items-center gap-2"
          >
            {isCreatingJob ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            <span>Start Harvest</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="premium-card p-5 group hover:border-brand-500/30 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-surface-400 text-sm font-medium">Running Jobs</p>
                <h3 className="text-3xl font-bold text-white mt-2">{stats.running_jobs}</h3>
                <p className="text-xs text-brand-400 mt-1 animate-pulse">Active Now</p>
              </div>
              <div className="p-3 rounded-xl bg-brand-500/10 group-hover:bg-brand-500/20 transition-colors">
                <Activity className="w-6 h-6 text-brand-500" />
              </div>
            </div>
          </div>

          <div className="premium-card p-5 group hover:border-green-500/30 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-surface-400 text-sm font-medium">Success Rate</p>
                <h3 className="text-3xl font-bold text-white mt-2">{Math.round(stats.success_rate * 100)}%</h3>
                <div className="w-full bg-surface-700 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${stats.success_rate * 100}%` }}
                  />
                </div>
              </div>
              <div className="p-3 rounded-xl bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </div>

          <div className="premium-card p-5 group hover:border-purple-500/30 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-surface-400 text-sm font-medium">APIs Harvested</p>
                <h3 className="text-3xl font-bold text-white mt-2">{stats.total_apis_harvested}</h3>
                <p className="text-xs text-surface-500 mt-1">Total count</p>
              </div>
              <div className="p-3 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                <Database className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </div>

          <div className="premium-card p-5 group hover:border-blue-500/30 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-surface-400 text-sm font-medium">Avg Duration</p>
                <h3 className="text-3xl font-bold text-white mt-2">{Math.round(stats.average_job_duration)}s</h3>
                <p className="text-xs text-surface-500 mt-1">Per job</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                <Clock className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Job List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center bg-surface-900/40 p-2 rounded-xl backdrop-blur-sm border border-surface-800/50">
            <div className="flex items-center gap-2 px-3 flex-1">
              <Search className="w-4 h-4 text-surface-400" />
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-transparent border-none focus:outline-none text-white w-full text-sm placeholder-surface-500"
              />
            </div>
            {selectedJobIds.size > 0 && (
              <button
                onClick={bulkDeleteJobs}
                className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors flex items-center gap-2 mx-1"
              >
                <Trash2 className="w-3 h-3" />
                Delete ({selectedJobIds.size})
              </button>
            )}
          </div>

          <div className="space-y-3">
            {loading ? (
              [...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-surface-800/50 animate-pulse" />)
            ) : filteredJobs.length === 0 ? (
              <div className="text-center py-12 text-surface-500">
                <Database className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No jobs found.</p>
              </div>
            ) : filteredJobs.map((job) => (
              <motion.div
                key={job.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setSelectedJob(job)}
                className={`premium-card p-4 cursor-pointer group transition-all hover:translate-x-1 ${selectedJob?.id === job.id
                  ? 'border-brand-500/50 bg-brand-500/5'
                  : 'hover:border-surface-600'
                  }`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center h-full">
                    <input
                      type="checkbox"
                      checked={selectedJobIds.has(job.id)}
                      onChange={(e) => { e.stopPropagation(); toggleJobSelection(job.id); }}
                      className="rounded border-surface-600 bg-surface-800 text-brand-500 focus:ring-brand-500/20"
                    />
                  </div>
                  <div className={`p-3 rounded-xl border ${getStatusColor(job.status)} bg-opacity-10`}>
                    {getJobTypeIcon(job.harvest_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className="text-white font-medium truncate pr-2">
                        {job.harvest_type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} Harvest
                      </h4>
                      <span className="text-xs text-surface-500 font-mono">{new Date(job.created_at).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex-1 h-1.5 bg-surface-700/50 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${job.status === 'failed' ? 'bg-red-500' :
                            job.status === 'completed' ? 'bg-green-500' : 'bg-brand-500'
                            }`}
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-surface-400 w-8 text-right">{job.progress}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {job.status === 'running' && (
                      <button
                        onClick={(e) => cancelJob(job.id, e)}
                        className="p-2 hover:bg-surface-700 rounded-lg text-surface-400 hover:text-white"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => deleteJob(job.id, e)}
                      className="p-2 hover:bg-red-500/10 rounded-lg text-surface-400 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Details Panel */}
        <div className="lg:col-span-1">
          <AnimatePresence mode="wait">
            {selectedJob ? (
              <motion.div
                key={selectedJob.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="premium-card p-6 sticky top-6"
              >
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-white">Job Details</h3>
                    <p className="text-xs text-surface-400 font-mono mt-1">{selectedJob.id}</p>
                  </div>
                  <button
                    onClick={() => setSelectedJob(null)}
                    className="text-surface-500 hover:text-white"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700/50">
                      <p className="text-xs text-surface-500 uppercase">Status</p>
                      <p className={`text-sm font-medium mt-1 inline-block px-2 py-0.5 rounded ${getStatusColor(selectedJob.status)}`}>
                        {selectedJob.status}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700/50">
                      <p className="text-xs text-surface-500 uppercase">Type</p>
                      <p className="text-sm font-medium text-white mt-1 capitalize">
                        {selectedJob.harvest_type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs text-surface-400 mb-1">
                        <span>Progress</span>
                        <span>{selectedJob.progress}%</span>
                      </div>
                      <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 rounded-full transition-all"
                          style={{ width: `${selectedJob.progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center py-2 border-b border-surface-700/50">
                      <span className="text-sm text-surface-400">APIs Harvested</span>
                      <span className="text-sm font-medium text-white">{selectedJob.apis_harvested}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-surface-700/50">
                      <span className="text-sm text-surface-400">Total Sources</span>
                      <span className="text-sm font-medium text-white">{selectedJob.total_sources}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-surface-700/50">
                      <span className="text-sm text-surface-400">Success / Fail</span>
                      <span className="text-sm font-medium">
                        <span className="text-green-400">{selectedJob.successful_harvests}</span>
                        <span className="text-surface-600 mx-1">/</span>
                        <span className="text-red-400">{selectedJob.failed_harvests}</span>
                      </span>
                    </div>
                  </div>

                  {selectedJob.error_message && (
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                      <div className="flex gap-2 items-start text-red-400 mb-1">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p className="text-xs font-medium">Error Details</p>
                      </div>
                      <p className="text-xs text-red-300/80 leading-relaxed">
                        {selectedJob.error_message}
                      </p>
                    </div>
                  )}

                  <div className="pt-4 flex gap-2">
                    {selectedJob.status === 'running' && (
                      <button
                        onClick={(e) => cancelJob(selectedJob.id, e)}
                        className="btn-secondary w-full"
                      >
                        Cancel Job
                      </button>
                    )}
                    <button
                      onClick={(e) => deleteJob(selectedJob.id, e)}
                      className="px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors w-full"
                    >
                      Delete Job
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-64 rounded-xl border-2 border-dashed border-surface-800 flex flex-col items-center justify-center text-surface-500">
                <Activity className="w-8 h-8 opacity-20 mb-2" />
                <p className="text-sm">Select a job to view details</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
      </div>
    </div>
  );
};

export default KnowledgeHarvesterDashboard;