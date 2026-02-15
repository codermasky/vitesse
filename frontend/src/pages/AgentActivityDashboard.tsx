import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Eye,
  LayoutDashboard,
  RotateCcw,
  Settings,
  Shield,
  Sparkles,
  Zap,
  ChevronUp,
  ChevronDown,
  AlertCircle
} from 'lucide-react';
import apiService from '../services/api';
import { cn } from '../services/utils';
import { useNotifications } from '../contexts/NotificationContext';

// Types for agent activity
interface Agent {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  current_task?: string;
  progress?: number;
  last_active: string;
  success_rate: number;
  avg_response_time: number;
}

interface SharedState {
  session_id: string;
  agents: Agent[];
  current_workflow?: {
    id: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    current_step: string;
    started_at: string;
  };
  knowledge_context: any[];
  user_intent: string;
  last_updated: string;
}

interface WorkflowStep {
  id: string;
  name: string;
  agent: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  output?: any;
}

const AgentActivityDashboard: React.FC = () => {
  const { addNotification } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [activeAgents, setActiveAgents] = useState<Agent[]>([]);
  const [sharedState, setSharedState] = useState<SharedState | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [showSharedState, setShowSharedState] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      // Parallel data fetching from REAL endpoints
      // Use try-catch for individual requests to prevent one failure from blocking everything
      let agentsRes, sharedRes, activityRes;

      try {
        agentsRes = await apiService.listAgents();
      } catch (e) {
        console.warn('Failed to list agents', e);
        agentsRes = { data: [] };
      }

      try {
        sharedRes = await apiService.getAgentActivitySharedState();
      } catch (e) {
        console.warn('Failed to get shared state', e);
        sharedRes = { data: null };
      }

      setActiveAgents(Array.isArray(agentsRes?.data) ? agentsRes.data : []);

      // Update shared state
      setSharedState(sharedRes?.data || null);

      // Construct workflow steps from workflow status if available
      try {
        activityRes = await apiService.getAgentActivity(24);
      } catch (e) {
        console.warn('Failed to get agent activity', e);
        activityRes = { data: { activities: [] } };
      }

      const activities = activityRes?.data?.activities || [];
      if (Array.isArray(activities) && activities.length > 0) {
        const steps: WorkflowStep[] = activities.map((act: any, idx: number) => ({
          id: act.id || `act_${idx}`,
          name: act.activity_type || 'Agent Action',
          agent: act.agent_id,
          status: act.status || 'completed',
          started_at: act.timestamp,
          output: act.metadata,
          duration_ms: act.duration_ms
        }));
        setWorkflowSteps(steps);
      } else {
        setWorkflowSteps([]);
      }

    } catch (error) {
      console.error('Failed to fetch activity data:', error);
      if (loading) addNotification({ type: 'error', message: 'Failed to load agent activity' });
    } finally {
      setLoading(false);
    }
  };

  const getAgentIcon = (agentId: string) => {
    const icons: Record<string, React.ReactNode> = {
      ingestor: <Database className="w-5 h-5" />,
      mapper: <Zap className="w-5 h-5" />,
      deployer: <Settings className="w-5 h-5" />,
      sentinel: <Shield className="w-5 h-5" />,
      orchestrator: <Bot className="w-5 h-5" />,
      knowledge_harvester: <BrainCircuit className="w-5 h-5" />
    };
    return icons[agentId] || <Bot className="w-5 h-5" />;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      idle: 'bg-surface-800 text-surface-300 border-surface-700',
      running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      error: 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    return colors[status] || colors.idle;
  };

  const getWorkflowStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-surface-800 text-surface-400 border-surface-700',
      running: 'bg-blue-500 text-white shadow-lg shadow-blue-500/25',
      completed: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25',
      failed: 'bg-red-500 text-white shadow-lg shadow-red-500/25'
    };
    return colors[status] || colors.pending;
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-surface-950/80 backdrop-blur-xl border-b border-surface-800 mb-8">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary border border-brand-primary/20">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Agent Activity</h1>
              <p className="text-surface-400 font-medium">Real-time orchestration and shared state monitoring</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Current Workflow Status */}
        {sharedState?.current_workflow && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="premium-card p-8 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-brand-primary text-white flex items-center justify-center shadow-lg shadow-brand-primary/30">
                  <Activity className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-1">
                    {sharedState.current_workflow.name}
                  </h3>
                  <p className="text-surface-400 font-mono text-sm">
                    ID: {sharedState.current_workflow.id}
                  </p>
                </div>
              </div>
              <div className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider flex items-center gap-2 self-start md:self-auto",
                getStatusColor(sharedState.current_workflow.status)
              )}>
                {sharedState.current_workflow.status === 'running' && (
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                  </span>
                )}
                {sharedState.current_workflow.status}
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm font-bold text-surface-300 mb-2 uppercase tracking-wider">
                  <span>Workflow Progress</span>
                  <span>{sharedState.current_workflow.progress}%</span>
                </div>
                <div className="w-full bg-surface-800 rounded-full h-4 overflow-hidden">
                  <motion.div
                    className="bg-gradient-to-r from-brand-primary to-blue-500 h-full rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${sharedState.current_workflow.progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-surface-900/30 rounded-2xl p-4 border border-surface-800">
                  <p className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-1">Current Step</p>
                  <p className="text-lg font-bold text-white flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-brand-primary" />
                    {sharedState.current_workflow.current_step}
                  </p>
                </div>
                <div className="bg-surface-900/30 rounded-2xl p-4 border border-surface-800">
                  <p className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-1">Started At</p>
                  <p className="text-lg font-bold text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-400" />
                    {new Date(sharedState.current_workflow.started_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Agent Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(activeAgents || []).map((agent, index) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -5 }}
              className={cn(
                "group premium-card p-6 cursor-pointer",
                selectedAgent === agent.id ? "ring-2 ring-brand-primary border-brand-primary" : ""
              )}
              onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-surface-800 flex items-center justify-center text-surface-300 group-hover:bg-brand-primary group-hover:text-white transition-colors duration-300">
                    {getAgentIcon(agent.id)}
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-white group-hover:text-brand-primary transition-colors">
                      {agent.name}
                    </h4>
                    <p className="text-xs font-medium uppercase tracking-wider text-surface-400">
                      {agent.role}
                    </p>
                  </div>
                </div>
                <div className={cn("px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border", getStatusColor(agent.status))}>
                  {agent.status}
                </div>
              </div>

              {agent.current_task ? (
                <div className="mb-6 bg-surface-900/30 rounded-2xl p-4 border border-surface-800">
                  <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-1">Current Task</p>
                  <p className="text-sm font-medium text-white line-clamp-2">
                    {agent.current_task}
                  </p>
                </div>
              ) : (
                <div className="mb-6 h-[74px] flex items-center justify-center bg-surface-900/20 rounded-2xl border border-surface-800 border-dashed">
                  <p className="text-xs font-medium text-surface-500 italic">No active task</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-surface-800">
                <div>
                  <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Success Rate</p>
                  <p className="text-lg font-black text-emerald-400">{(agent.success_rate * 100).toFixed(0)}%</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Avg Response</p>
                  <p className="text-lg font-black text-white">{agent.avg_response_time}ms</p>
                </div>
              </div>

              {agent.progress !== undefined && (
                <div className="mt-4 pt-4 border-t border-surface-800">
                  <div className="flex justify-between text-xs font-bold text-surface-500 mb-2">
                    <span>Task Progress</span>
                    <span>{agent.progress}%</span>
                  </div>
                  <div className="w-full bg-surface-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-brand-primary h-full rounded-full transition-all duration-300"
                      style={{ width: `${agent.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Workflow Steps Timeline */}
        {(workflowSteps?.length || 0) > 0 && (
          <div className="premium-card overflow-hidden shadow-lg">
            <div className="px-8 py-6 border-b border-surface-800 bg-surface-900/20">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <LayoutDashboard className="w-5 h-5 text-brand-primary" />
                Workflow Execution Timeline
              </h3>
            </div>

            <div className="p-8">
              <div className="relative">
                {/* Vertical Line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-surface-700" />

                <div className="space-y-8">
                  {(workflowSteps || []).map((step, index) => (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="relative flex gap-6"
                    >
                      <div className="relative z-10 flex-shrink-0">
                        <div className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center border-4 border-surface-900 shadow-sm",
                          getWorkflowStatusColor(step.status)
                        )}>
                          {step.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> :
                            step.status === 'running' ? <RotateCcw className="w-5 h-5 animate-spin" /> :
                              step.status === 'failed' ? <AlertCircle className="w-5 h-5" /> :
                                <span className="font-bold text-sm">{index + 1}</span>}
                        </div>
                      </div>

                      <div className="flex-1 bg-surface-900/30 rounded-2xl p-6 border border-surface-800">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                          <div>
                            <h4 className="text-lg font-bold text-white mb-1">
                              {step.name}
                            </h4>
                            <div className="flex items-center gap-2 text-sm text-surface-400">
                              <span className="font-medium bg-surface-800 px-2 py-0.5 rounded text-white text-xs">
                                {step.agent}
                              </span>
                              {step.duration_ms && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDuration(step.duration_ms)}
                                </span>
                              )}
                            </div>
                          </div>
                          {step.started_at && (
                            <div className="text-xs font-mono text-surface-500 bg-surface-800 px-3 py-1.5 rounded-lg border border-surface-700">
                              {new Date(step.started_at).toLocaleTimeString()}
                            </div>
                          )}
                        </div>

                        {step.output && (
                          <div className="bg-surface-950 rounded-xl p-4 overflow-x-auto border border-surface-800/50">
                            <pre className="text-xs font-mono text-surface-300">
                              {JSON.stringify(step.output, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Shared State Viewer */}
        <div className="premium-card overflow-hidden shadow-lg">
          <button
            onClick={() => setShowSharedState(!showSharedState)}
            className="w-full px-8 py-6 border-b border-surface-800 bg-surface-900/20 flex items-center justify-between hover:bg-surface-800/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Eye className="w-5 h-5 text-brand-primary" />
              <h3 className="text-xl font-bold text-white uppercase tracking-wider">
                Shared Whiteboard State
              </h3>
            </div>
            {showSharedState ? <ChevronUp className="w-6 h-6 text-surface-400" /> : <ChevronDown className="w-6 h-6 text-surface-400" />}
          </button>

          <AnimatePresence>
            {showSharedState && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <div className="p-8">
                  {sharedState ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div className="bg-surface-900/30 rounded-2xl p-6 border border-surface-800">
                          <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-brand-primary" />
                            Session Context
                          </h4>
                          <div className="space-y-4">
                            <div>
                              <p className="text-xs font-bold text-surface-400 mb-1">Session ID</p>
                              <p className="font-mono text-sm text-surface-300">{sharedState.session_id}</p>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-surface-400 mb-1">Last Updated</p>
                              <p className="font-mono text-sm text-surface-300">{new Date(sharedState.last_updated).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-surface-400 mb-1">User Intent</p>
                              <p className="text-sm text-white font-medium bg-surface-800 p-3 rounded-xl border border-surface-700">
                                {sharedState.user_intent}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-surface-900/30 rounded-2xl p-6 border border-surface-800">
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                          <Database className="w-4 h-4 text-brand-primary" />
                          Knowledge Context ({sharedState.knowledge_context?.length || 0})
                        </h4>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                          {(sharedState.knowledge_context || []).map((item, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-surface-800 rounded-xl border border-surface-700 shadow-sm hover:shadow-md transition-shadow">
                              <div>
                                <p className="text-sm font-bold text-white">
                                  {item.name}
                                </p>
                                <p className="text-xs text-surface-400 mt-1">
                                  {item.type}
                                </p>
                              </div>
                              <span className="text-xs font-bold bg-brand-primary/10 text-brand-primary px-2.5 py-1 rounded-lg">
                                {(item.relevance * 100).toFixed(0)}% Match
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-surface-500">
                      <div className="w-16 h-16 rounded-full bg-surface-800 flex items-center justify-center mb-4">
                        <Eye className="w-8 h-8 opacity-50" />
                      </div>
                      <p className="font-medium text-white">No shared state available</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Loading Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-surface-950/50 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <div className="bg-surface-900 p-6 rounded-2xl shadow-2xl flex items-center gap-4 border border-surface-800">
              <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
              <span className="font-medium text-white">Syncing Agent State...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AgentActivityDashboard;