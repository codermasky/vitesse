import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Activity,
  TrendingUp,
  Clock,
  Zap,
  Bot,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Info,
  BarChart3,
  Radio,
} from 'lucide-react';
import apiService from '../services/api';

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
    // Set up polling for real-time updates
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
    try {
      const response = await apiService.getAgentActivity(24);
      setAgents(response.data || []);
    } catch (error) {
      console.error('Failed to load agent activity:', error);
    }
  };

  const loadCommunicationLog = async () => {
    try {
      const response = await apiService.getCommunicationLog(2, 20);
      setCommunications(response.data || []);
    } catch (error) {
      console.error('Failed to load communication log:', error);
    }
  };

  const loadCollaborationStats = async () => {
    try {
      const response = await apiService.getCollaborationStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load collaboration stats:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Activity className="w-4 h-4 text-green-500" />;
      case 'idle':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'idle':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'task_assignment':
        return <Zap className="w-4 h-4 text-blue-500" />;
      case 'task_update':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'content_review':
        return <BarChart3 className="w-4 h-4 text-purple-500" />;
      case 'review_feedback':
        return <MessageSquare className="w-4 h-4 text-orange-500" />;
      default:
        return <MessageSquare className="w-4 h-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-50';
      case 'normal':
        return 'text-yellow-600 bg-yellow-50';
      case 'low':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatAgentName = (agentId: string) => {
    const agent = agents.find(a => a.agent_id === agentId);
    return agent ? agent.agent_name : agentId;
  };

  const filteredCommunications = communications.filter(comm => {
    if (communicationFilter === 'all') return true;
    return comm.message_type === communicationFilter;
  });

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
              <MessageSquare className="w-7 h-7 text-brand-500" />
            </div>
            <div>
              <h1 className="text-5xl lg:text-6xl font-black tracking-tight text-surface-950 dark:text-white leading-[1.1]">Agent Collaboration</h1>
              <p className="text-lg text-surface-600 dark:text-surface-400 font-medium">Monitor real-time agent collaboration and communication.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-green-400 border border-green-400/20 hover:bg-green-400/10 px-3 py-1.5 rounded-full transition-colors duration-200">
            <Radio className="w-4 h-4" />
            <span>Live</span>
          </div>
        </div>
      </motion.div>

      {/* Statistics Cards */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            className="glass rounded-3xl p-6 border border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300"
          >
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl border border-white/10">
                <Bot className="w-8 h-8 text-blue-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-white/70">Active Agents</p>
                <p className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  {stats.active_agents}/{stats.total_agents}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            className="glass rounded-3xl p-6 border border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300"
          >
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-2xl border border-white/10">
                <MessageSquare className="w-8 h-8 text-green-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-white/70">Communications</p>
                <p className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                  {stats.total_communications_today}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
            className="glass rounded-3xl p-6 border border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300"
          >
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl border border-white/10">
                <TrendingUp className="w-8 h-8 text-purple-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-white/70">Collaboration Score</p>
                <p className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  {stats.average_collaboration_score.toFixed(1)}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.3 }}
            className="glass rounded-3xl p-6 border border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300"
          >
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-2xl border border-white/10">
                <Activity className="w-8 h-8 text-orange-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-white/70">Tasks Today</p>
                <p className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                  {stats.tasks_completed_today}
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Agent Activity */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="glass rounded-3xl border border-white/20 shadow-xl"
        >
          <div className="p-6 border-b border-white/10">
            <h2 className="text-3xl font-black tracking-tight bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
              Agent Activity
            </h2>
          </div>
          <div className="divide-y divide-white/10 max-h-96 overflow-y-auto">
            {agents.map((agent, index) => (
              <motion.div
                key={agent.agent_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + index * 0.1, duration: 0.3 }}
                className="p-6 hover:bg-white/5 transition-colors duration-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl border border-white/10">
                      <Bot className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{agent.agent_name}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(agent.status)}`}>
                          {getStatusIcon(agent.status)}
                          <span className="ml-1 capitalize">{agent.status}</span>
                        </span>
                        <span className="text-xs text-white/60">
                          {agent.tasks_completed} tasks
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">{agent.success_rate.toFixed(1)}% success</p>
                    <p className="text-xs text-white/50">{agent.average_response_time}s avg</p>
                  </div>
                </div>
                {agent.current_task && (
                  <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-sm text-white/80 truncate">{agent.current_task}</p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Communication Log */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="glass rounded-3xl border border-white/20 shadow-xl"
        >
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black tracking-tight bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                Communication Log
              </h2>
              <motion.select
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                value={communicationFilter}
                onChange={(e) => setCommunicationFilter(e.target.value)}
                className="text-sm bg-white/10 text-white border border-white/20 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-transparent"
              >
                <option value="all" className="bg-gray-800">All Types</option>
                <option value="task_assignment" className="bg-gray-800">Task Assignment</option>
                <option value="task_update" className="bg-gray-800">Task Update</option>
                <option value="content_review" className="bg-gray-800">Content Review</option>
                <option value="review_feedback" className="bg-gray-800">Review Feedback</option>
              </motion.select>
            </div>
          </div>
          <div className="divide-y divide-white/10 max-h-96 overflow-y-auto">
            {filteredCommunications.map((comm, index) => (
              <motion.div
                key={comm.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + index * 0.05, duration: 0.3 }}
                className="p-6 hover:bg-white/5 transition-colors duration-200"
              >
                <div className="flex items-start space-x-4">
                  <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl border border-white/10">
                    {getMessageTypeIcon(comm.message_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-sm font-semibold text-white">
                        {formatAgentName(comm.from_agent)}
                      </span>
                      <ArrowRight className="w-3 h-3 text-white/60" />
                      <span className="text-sm font-semibold text-white">
                        {formatAgentName(comm.to_agent)}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(comm.priority)}`}>
                        {comm.priority}
                      </span>
                    </div>
                    <p className="text-sm text-white/80 mt-2">{comm.content}</p>
                    <p className="text-xs text-white/50 mt-2">
                      {new Date(comm.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Workflow Visualization */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.5 }}
        className="glass rounded-3xl border border-white/20 shadow-xl p-8"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-black tracking-tight bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
            Active Workflows
          </h2>
          <div className="px-3 py-1 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full border border-white/10">
            <span className="text-sm font-medium text-white">{stats?.active_workflows || 0} active</span>
          </div>
        </div>
        <div className="text-center py-12">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.0, duration: 0.5 }}
            className="p-4 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl border border-white/10 w-fit mx-auto mb-6"
          >
            <Bot className="w-12 h-12 text-blue-400 mx-auto" />
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.5 }}
            className="text-white/80 font-medium mb-2"
          >
            Workflow visualization coming soon
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.5 }}
            className="text-sm text-white/60"
          >
            Real-time workflow diagrams and agent coordination tracking
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
};

export default AgentCollaborationHub;