/**
 * Knowledge Harvester Control Panel Component
 * 
 * React component for controlling the Knowledge Harvester from the UI.
 * Displays scheduler status, allows starting/stopping, manual triggering, and configuration.
 */

import { useState, useEffect } from 'react';

interface HarvestJob {
  id: string;
  harvest_type: string;
  status: string;
  progress: number;
  apis_harvested: number;
  created_at: string;
  completed_at?: string;
}

interface HarvestType {
  id: string;
  name: string;
  description: string;
  interval_hours: number;
}

interface DashboardData {
  status: string;
  scheduler: {
    is_running: boolean;
    last_harvest_times: Record<string, string>;
    harvest_schedule: Record<string, number>;
  };
  statistics: {
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
  };
  recent_jobs: HarvestJob[];
}

const KnowledgeHarvesterPanel = ({ token }: { token: string }) => {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [harvestTypes, setHarvestTypes] = useState<HarvestType[]>([]);
  const [selectedHarvestType, setSelectedHarvestType] = useState('incremental');
  const [triggering, setTriggering] = useState(false);

  const API_BASE = 'http://localhost:8000/api/v1/harvest-jobs';

  // Fetch scheduler status and dashboard data on mount and at intervals
  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setDashboard(data);

      // Also fetch config to get harvest types
      const configResponse = await fetch(`${API_BASE}/scheduler/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const configData = await configResponse.json();
      setHarvestTypes(configData.harvest_types);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const startScheduler = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/scheduler/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        await fetchDashboard();
      }
    } catch (error) {
      console.error('Failed to start scheduler:', error);
    } finally {
      setLoading(false);
    }
  };

  const stopScheduler = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/scheduler/stop`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        await fetchDashboard();
      }
    } catch (error) {
      console.error('Failed to stop scheduler:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerHarvest = async () => {
    try {
      setTriggering(true);
      const response = await fetch(`${API_BASE}/trigger`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          harvest_type: selectedHarvestType,
          source_ids: null,
        }),
      });

      if (response.ok) {
        const job = await response.json();
        console.log('Harvest job started:', job.job_id);
        // Show success toast
        setTimeout(() => fetchDashboard(), 1000);
      }
    } catch (error) {
      console.error('Failed to trigger harvest:', error);
    } finally {
      setTriggering(false);
    }
  };

  if (loading && !dashboard) {
    return <div className="p-4">Loading Knowledge Harvester dashboard...</div>;
  }

  if (!dashboard) {
    return <div className="p-4">Failed to load Knowledge Harvester dashboard</div>;
  }

  const stats = dashboard.statistics;
  const schedulerIsRunning = dashboard.scheduler.is_running;
  const successRate = stats?.success_rate || 0;

  return (
    <div className="p-6 bg-gray-50 rounded-lg">
      <h2 className="text-2xl font-bold mb-6">Knowledge Harvester</h2>

      {/* Scheduler Status Card */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Scheduler Status</h3>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                schedulerIsRunning ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="font-medium">
              {schedulerIsRunning ? 'Running' : 'Stopped'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-gray-600 text-sm">Next Full Harvest</p>
            <p className="font-mono text-sm">
              {dashboard.scheduler.last_harvest_times?.full
                ? new Date(
                    new Date(dashboard.scheduler.last_harvest_times.full).getTime() +
                      7 * 24 * 60 * 60 * 1000
                  ).toLocaleString()
                : 'Never'}
            </p>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Next Incremental</p>
            <p className="font-mono text-sm">
              {dashboard.scheduler.last_harvest_times?.incremental
                ? new Date(
                    new Date(
                      dashboard.scheduler.last_harvest_times.incremental
                    ).getTime() +
                      24 * 60 * 60 * 1000
                  ).toLocaleString()
                : 'Never'}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={startScheduler}
            disabled={schedulerIsRunning || loading}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
          >
            Start Scheduler
          </button>
          <button
            onClick={stopScheduler}
            disabled={!schedulerIsRunning || loading}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
          >
            Stop Scheduler
          </button>
          <button
            onClick={fetchDashboard}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Manual Harvest Trigger */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Manual Harvest</h3>

        <div className="flex gap-3">
          <select
            value={selectedHarvestType}
            onChange={(e) => setSelectedHarvestType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded flex-1"
          >
            <option value="">Select harvest type...</option>
            {harvestTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name} - {type.description}
              </option>
            ))}
          </select>

          <button
            onClick={triggerHarvest}
            disabled={triggering || !selectedHarvestType}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 font-medium"
          >
            {triggering ? 'Starting...' : 'Start Harvest'}
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Statistics</h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded">
            <p className="text-gray-600 text-sm">Total Jobs</p>
            <p className="text-2xl font-bold">{stats?.total_jobs || 0}</p>
          </div>

          <div className="bg-green-50 p-4 rounded">
            <p className="text-gray-600 text-sm">Success Rate</p>
            <p className="text-2xl font-bold">{successRate.toFixed(1)}%</p>
          </div>

          <div className="bg-yellow-50 p-4 rounded">
            <p className="text-gray-600 text-sm">Running Jobs</p>
            <p className="text-2xl font-bold">{stats?.running_jobs || 0}</p>
          </div>

          <div className="bg-purple-50 p-4 rounded">
            <p className="text-gray-600 text-sm">APIs Harvested</p>
            <p className="text-2xl font-bold">{stats?.total_apis_harvested || 0}</p>
          </div>

          <div className="bg-indigo-50 p-4 rounded">
            <p className="text-gray-600 text-sm">Last 24h Jobs</p>
            <p className="text-2xl font-bold">{stats?.jobs_last_24h || 0}</p>
          </div>

          <div className="bg-pink-50 p-4 rounded">
            <p className="text-gray-600 text-sm">Last 7d Jobs</p>
            <p className="text-2xl font-bold">{stats?.jobs_last_7d || 0}</p>
          </div>

          <div className="bg-orange-50 p-4 rounded">
            <p className="text-gray-600 text-sm">Last 30d Jobs</p>
            <p className="text-2xl font-bold">{stats?.jobs_last_30d || 0}</p>
          </div>

          <div className="bg-teal-50 p-4 rounded">
            <p className="text-gray-600 text-sm">Avg Duration</p>
            <p className="text-2xl font-bold">
              {Math.round((stats?.average_job_duration || 0) / 60)}m
            </p>
          </div>
        </div>
      </div>

      {/* Recent Jobs */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-4">Recent Harvest Jobs</h3>

        {dashboard.recent_jobs && dashboard.recent_jobs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2">Job ID</th>
                  <th className="text-left py-2">Type</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Progress</th>
                  <th className="text-left py-2">APIs</th>
                  <th className="text-left py-2">Started</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recent_jobs.map((job) => (
                  <tr key={job.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 font-mono text-xs">
                      {job.id.substring(0, 20)}...
                    </td>
                    <td className="py-3">{job.harvest_type}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          job.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : job.status === 'running'
                            ? 'bg-blue-100 text-blue-800'
                            : job.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                        <span className="text-xs">{job.progress}%</span>
                      </div>
                    </td>
                    <td className="py-3">{job.apis_harvested}</td>
                    <td className="py-3 text-xs">
                      {new Date(job.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No harvest jobs yet</p>
        )}
      </div>
    </div>
  );
};

export default KnowledgeHarvesterPanel;

/**
 * Usage in your React app:
 * 
 * import KnowledgeHarvesterPanel from './components/KnowledgeHarvesterPanel';
 * 
 * function App() {
 *   const token = localStorage.getItem('auth_token');
 *   return <KnowledgeHarvesterPanel token={token} />;
 * }
 */
