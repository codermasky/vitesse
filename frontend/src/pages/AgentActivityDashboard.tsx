import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Activity,
  Zap,
  BrainCircuit,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Database,
  Settings,
  Eye,
  ChevronUp,
  ChevronDown,
  Shield
} from 'lucide-react';
import apiService from '../services/api';
import { cn } from '../services/utils';

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
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sharedState, setSharedState] = useState<SharedState | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [showSharedState, setShowSharedState] = useState(false);

  useEffect(() => {
    loadAgentData();
    // Set up polling for real-time updates
    const interval = setInterval(loadAgentData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadAgentData = async () => {
    try {
      setLoading(true);

      // Load agents list
      const agentsResponse = await apiService.listAgents();
      setAgents(agentsResponse.data.agents || []);

      // Load real shared state
      try {
        const sharedStateResponse = await apiService.getSharedState();
        setSharedState(sharedStateResponse.data);
      } catch (e) {
        console.error('Failed to load shared state:', e);
      }

      // Load agent activity to populate workflow steps
      try {
        const activityResponse = await apiService.getAgentActivity(24); // Last 24 hours
        // Process activities into workflow steps if possible, or use them as is
        // For now, let's keep the mock structure if the backend doesn't provide exactly what's needed
        // but try to use real data points if available.
        // Assuming activityResponse.data.activities exists
        const activities = activityResponse.data.activities || [];
        if (activities.length > 0) {
          const steps: WorkflowStep[] = activities.map((act: any, idx: number) => ({
            id: act.id || `act_${idx}`,
            name: act.activity_type || 'Agent Action',
            agent: act.agent_id,
            status: act.status || 'completed',
            started_at: act.timestamp,
            output: act.metadata
          }));
          setWorkflowSteps(steps);
        } else {
          // Fallback to a cleaner "No recent activity" state or minimal mock for demo if empty
          setWorkflowSteps([]);
        }
      } catch (e) {
        console.error('Failed to load agent activity:', e);
      }

    } catch (error) {
      console.error('Failed to load agent data:', error);
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
      idle: 'bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-300',
      running: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    };
    return colors[status] || colors.idle;
  };

  const getWorkflowStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-300',
      running: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    };
    return colors[status] || colors.pending;
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="space-y-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-[2.5rem] p-12 border border-brand-500/10 space-y-6"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
            <Bot className="w-7 h-7 text-brand-500" />
          </div>
          <div>
            <h1 className="text-5xl lg:text-6xl font-black tracking-tight text-surface-950 dark:text-white leading-[1.1]">Agent Activity</h1>
            <p className="text-lg text-surface-600 dark:text-surface-400 font-medium">Monitor agent orchestration and shared whiteboard state.</p>
          </div>
        </div>
      </motion.div>

      {/* Current Workflow Status */}
      {sharedState?.current_workflow && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="premium-card !p-8 border-brand-500/10"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-100 dark:bg-brand-900 rounded-lg">
                <Activity className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                  {sharedState.current_workflow.name}
                </h3>
                <p className="text-sm text-surface-500 dark:text-surface-400">
                  Workflow ID: {sharedState.current_workflow.id}
                </p>
              </div>
            </div>
            <span className={cn("inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium", getWorkflowStatusColor(sharedState.current_workflow.status))}>
              {sharedState.current_workflow.status === 'running' && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
              {sharedState.current_workflow.status}
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm text-surface-600 dark:text-surface-400 mb-1">
                <span>Progress</span>
                <span>{sharedState.current_workflow.progress}%</span>
              </div>
              <div className="w-full bg-surface-200 dark:bg-brand-500/10 rounded-full h-3">
                <div
                  className="bg-brand-600 h-3 rounded-full transition-all duration-500 shadow-[0_0_15px_rgba(221,0,49,0.3)]"
                  style={{ width: `${sharedState.current_workflow.progress}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-surface-600 dark:text-surface-400">
                Current Step: <span className="font-medium text-surface-900 dark:text-surface-100">
                  {sharedState.current_workflow.current_step}
                </span>
              </span>
              <span className="text-surface-500 dark:text-surface-400">
                Started {new Date(sharedState.current_workflow.started_at).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent, index) => (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              "premium-card cursor-pointer transition-all border-brand-500/10",
              selectedAgent === agent.id ? "ring-2 ring-brand-500 border-brand-500 shadow-lg" : "hover:border-brand-500/30"
            )}
            onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-100 dark:bg-brand-900 rounded-lg">
                  {getAgentIcon(agent.id)}
                </div>
                <div>
                  <h4 className="font-semibold text-surface-900 dark:text-surface-100">
                    {agent.name}
                  </h4>
                  <p className="text-sm text-surface-500 dark:text-surface-400">
                    {agent.role}
                  </p>
                </div>
              </div>
              <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium", getStatusColor(agent.status))}>
                {agent.status === 'running' && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />}
                {agent.status}
              </span>
            </div>

            {agent.current_task && (
              <div className="mb-3">
                <p className="text-sm text-surface-600 dark:text-surface-400">
                  <strong>Current:</strong> {agent.current_task}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-surface-500 dark:text-surface-400">
              <span>Success: {(agent.success_rate * 100).toFixed(1)}%</span>
              <span>Avg: {agent.avg_response_time}ms</span>
            </div>

            {agent.progress !== undefined && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-surface-500 dark:text-surface-400 mb-1">
                  <span>Progress</span>
                  <span>{agent.progress}%</span>
                </div>
                <div className="w-full bg-surface-200 dark:bg-surface-700 rounded-full h-1.5">
                  <div
                    className="bg-brand-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${agent.progress}%` }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Workflow Steps */}
      {workflowSteps.length > 0 && (
        <div className="glass rounded-[2rem] overflow-hidden border-brand-500/10">
          <div className="px-8 py-6 border-b border-brand-500/10 bg-brand-500/[0.02]">
            <h3 className="text-xl font-black text-surface-950 dark:text-white tracking-widest uppercase">
              Workflow Execution
            </h3>
          </div>

          <div className="p-8">
            <div className="space-y-4">
              {workflowSteps.map((step, index) => (
                <div key={step.id} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-lg",
                      step.status === 'completed' ? 'bg-green-500' :
                        step.status === 'running' ? 'bg-blue-500' :
                          step.status === 'failed' ? 'bg-red-500' : 'bg-brand-500'
                    )}>
                      {step.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> :
                        step.status === 'running' ? <RotateCcw className="w-4 h-4 animate-spin" /> :
                          step.status === 'failed' ? <AlertCircle className="w-4 h-4" /> :
                            index + 1}
                    </div>
                    {index < workflowSteps.length - 1 && (
                      <div className="w-0.5 h-12 bg-brand-500/10 mt-2" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pb-12">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-surface-900 dark:text-surface-100">
                        {step.name}
                      </h4>
                      <span className="text-sm text-surface-500 dark:text-surface-400">
                        {step.agent}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-1 text-sm text-surface-500 dark:text-surface-400">
                      {step.started_at && (
                        <span>Started: {new Date(step.started_at).toLocaleTimeString()}</span>
                      )}
                      {step.duration_ms && (
                        <span>Duration: {formatDuration(step.duration_ms)}</span>
                      )}
                    </div>

                    {step.output && (
                      <div className="mt-2 p-2 bg-surface-50 dark:bg-surface-700 rounded text-sm">
                        <pre className="text-surface-600 dark:text-surface-400">
                          {JSON.stringify(step.output, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Shared State Viewer */}
      <div className="glass rounded-[2rem] overflow-hidden border-brand-500/10">
        <div className="px-8 py-6 border-b border-brand-500/10 bg-brand-500/[0.02]">
          <button
            onClick={() => setShowSharedState(!showSharedState)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-3">
              <Eye className="w-6 h-6 text-brand-500" />
              <h3 className="text-xl font-black text-surface-950 dark:text-white tracking-widest uppercase">
                Shared Whiteboard State
              </h3>
            </div>
            {showSharedState ? <ChevronUp className="w-6 h-6 text-brand-500" /> : <ChevronDown className="w-6 h-6 text-brand-500" />}
          </button>
        </div>

        <AnimatePresence>
          {showSharedState && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-surface-200 dark:border-surface-700"
            >
              <div className="p-8">
                {sharedState ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-surface-900 dark:text-surface-100 mb-2">
                          Session Info
                        </h4>
                        <div className="space-y-1 text-sm text-surface-600 dark:text-surface-400">
                          <div><strong>Session ID:</strong> {sharedState.session_id}</div>
                          <div><strong>Last Updated:</strong> {new Date(sharedState.last_updated).toLocaleString()}</div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium text-surface-900 dark:text-surface-100 mb-2">
                          User Intent
                        </h4>
                        <p className="text-sm text-surface-600 dark:text-surface-400">
                          {sharedState.user_intent}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-surface-900 dark:text-surface-100 mb-2">
                        Knowledge Context ({sharedState.knowledge_context.length} items)
                      </h4>
                      <div className="space-y-2">
                        {sharedState.knowledge_context.map((item, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-700 rounded">
                            <span className="text-sm font-medium text-surface-900 dark:text-surface-100">
                              {item.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-surface-500 dark:text-surface-400">
                                {item.type}
                              </span>
                              <span className="text-xs bg-brand-100 dark:bg-brand-900 text-brand-800 dark:text-brand-200 px-2 py-1 rounded">
                                {(item.relevance * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-surface-500 dark:text-surface-400">
                    No shared state available
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-surface-600 dark:text-surface-400">Loading agent activity...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentActivityDashboard;