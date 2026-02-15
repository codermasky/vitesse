import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Activity,
  TrendingUp,
  Zap,
  Bot,
  ArrowRight,
  CheckCircle,
  Radio,
  RefreshCw
} from 'lucide-react';
import apiService from '../services/api';

// --- Types ---
interface AgentActivity {
  agent_id: string;
  agent_name: string;
  status: string;
  current_task?: string;
  last_activity: string;
  tasks_completed: number;
  success_rate: number;
  average_response_time: number;
}

interface CommunicationLog {
  id: string;
  timestamp: string;
  from_agent: string;
  to_agent: string;
  message_type: string;
  content: string;
  priority: string;
  status: string;
}

interface CollaborationStats {
  total_agents: number;
  active_agents: number;
  total_workflows: number;
  active_workflows: number;
  total_communications_today: number;
  average_collaboration_score: number;
  system_uptime: number;
  average_response_time: number;
  tasks_completed_today: number;
  error_rate: number;
  peak_collaboration_hour: string;
  most_active_agent: string;
}

const AgentCollaborationHub: React.FC = () => {
  const [agents, setAgents] = useState<AgentActivity[]>([]);
  const [communications, setCommunications] = useState<CommunicationLog[]>([]);
  const [stats, setStats] = useState<CollaborationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [communicationFilter, setCommunicationFilter] = useState('all');

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([
        loadAgentActivity(),
        loadCommunicationLog(),
        loadCollaborationStats(),
      ]);
    } catch (error) {
      console.error('Failed to load collaboration data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAgentActivity = async () => {
    // Mocking response structure if needed, assuming API works
    try {
      const response = await apiService.getAgentActivity(24);
      setAgents(response.data || []);
    } catch (error) {
      console.error('Failed to load activity:', error);
    }
  };

  const loadCommunicationLog = async () => {
    try {
      const response = await apiService.getCommunicationLog(2, 20);
      setCommunications(response.data || []);
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  };

  const loadCollaborationStats = async () => {
    try {
      const response = await apiService.getCollaborationStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };



  const getPriorityBadge = (priority: string) => {
    let colorClass = 'bg-surface-800 text-surface-400';
    switch (priority) {
      case 'high': colorClass = 'bg-red-500/20 text-red-400 border-red-500/30'; break;
      case 'normal': colorClass = 'bg-blue-500/20 text-blue-400 border-blue-500/30'; break;
      case 'low': colorClass = 'bg-green-500/20 text-green-400 border-green-500/30'; break;
    }
    return <span className={`text-[10px] px-2 py-0.5 rounded border ${colorClass} uppercase font-medium`}>{priority}</span>;
  };

  const filteredCommunications = communications.filter(comm =>
    communicationFilter === 'all' || comm.message_type === communicationFilter
  );

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Agent Collaboration</h1>
          <p className="text-surface-400 mt-1">Real-time oversight of multi-agent workflows.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium animate-pulse">
            <Radio className="w-3 h-3" /> Live
          </div>
          <button onClick={loadData} className="p-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-400 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="premium-card p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-surface-400 text-sm font-medium">Active Agents</p>
                <h3 className="text-3xl font-bold text-white mt-2">{stats.active_agents}<span className="text-surface-500 text-base font-normal">/{stats.total_agents}</span></h3>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/10">
                <Bot className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </div>
          <div className="premium-card p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-surface-400 text-sm font-medium">Collaboration Score</p>
                <h3 className="text-3xl font-bold text-white mt-2">{stats.average_collaboration_score.toFixed(1)}</h3>
                <div className="w-full bg-surface-700 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{ width: `${stats.average_collaboration_score * 10}%` }}
                  />
                </div>
              </div>
              <div className="p-3 rounded-xl bg-purple-500/10">
                <TrendingUp className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </div>
          <div className="premium-card p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-surface-400 text-sm font-medium">Tasks Today</p>
                <h3 className="text-3xl font-bold text-white mt-2">{stats.tasks_completed_today}</h3>
              </div>
              <div className="p-3 rounded-xl bg-orange-500/10">
                <Activity className="w-6 h-6 text-orange-500" />
              </div>
            </div>
          </div>
          <div className="premium-card p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-surface-400 text-sm font-medium">Communications</p>
                <h3 className="text-3xl font-bold text-white mt-2">{stats.total_communications_today}</h3>
              </div>
              <div className="p-3 rounded-xl bg-green-500/10">
                <MessageSquare className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Agent List */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-brand-500" /> Agent Status
          </h2>
          <div className="grid gap-3">
            {loading ? (
              [...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-surface-800/50 animate-pulse" />)
            ) : agents.map(agent => (
              <motion.div
                key={agent.agent_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="premium-card p-4 flex items-center justify-between group hover:border-brand-500/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-800 border border-surface-700 flex items-center justify-center text-lg font-bold text-brand-500">
                    {agent.agent_name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-white font-medium">{agent.agent_name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`w-2 h-2 rounded-full ${agent.status === 'active' ? 'bg-green-500' : 'bg-surface-500'}`} />
                      <span className="text-xs text-surface-400 capitalize">{agent.status}</span>
                      {agent.current_task && (
                        <span className="text-xs text-surface-500 border-l border-surface-700 pl-2 ml-1 truncate max-w-[150px]">
                          {agent.current_task}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-surface-500 mb-1">Success Rate</div>
                  <div className={`font-mono font-medium ${agent.success_rate > 90 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {agent.success_rate.toFixed(1)}%
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Communication Log */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-brand-500" /> Live Feed
            </h2>
            <select
              value={communicationFilter}
              onChange={(e) => setCommunicationFilter(e.target.value)}
              className="bg-surface-800 text-xs text-surface-300 border-none rounded-lg focus:ring-1 focus:ring-brand-500/50"
            >
              <option value="all">All Events</option>
              <option value="task_assignment">Assignments</option>
              <option value="task_update">Updates</option>
              <option value="content_review">Reviews</option>
            </select>
          </div>

          <div className="premium-card p-0 overflow-hidden h-[500px] flex flex-col">
            <div className="overflow-y-auto custom-scrollbar p-4 space-y-4 flex-1">
              {filteredCommunications.map((comm) => (
                <div key={comm.id} className="flex gap-3 relative">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-surface-800 border border-surface-700 flex items-center justify-center z-10">
                      {comm.message_type === 'task_assignment' ? <Zap className="w-4 h-4 text-yellow-400" /> :
                        comm.message_type === 'task_update' ? <CheckCircle className="w-4 h-4 text-green-400" /> :
                          <MessageSquare className="w-4 h-4 text-blue-400" />}
                    </div>
                    <div className="w-0.5 h-full bg-surface-800 -mt-2 opacity-50 absolute top-8 bottom-0 left-4" />
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-surface-500 font-mono">
                        {new Date(comm.timestamp).toLocaleTimeString()}
                      </p>
                      {getPriorityBadge(comm.priority)}
                    </div>
                    <div className="p-3 rounded-lg bg-surface-800/40 border border-surface-700/40">
                      <div className="flex items-center gap-2 text-xs font-semibold text-surface-300 mb-2">
                        <span>{comm.from_agent}</span>
                        <ArrowRight className="w-3 h-3 text-surface-600" />
                        <span>{comm.to_agent}</span>
                      </div>
                      <p className="text-sm text-surface-200">{comm.content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AgentCollaborationHub;