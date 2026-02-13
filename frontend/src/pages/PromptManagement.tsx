import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, RotateCcw, MessageSquare, Terminal, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import SectionHeader from '../components/SectionHeader';
import { cn } from '../services/utils';

interface PromptTemplate {
  id: string;
  agent_id: string;
  template_name: string;
  template_type: string;
  content: string;
  version: number;
  is_active: boolean;
  usage_count: number;
  success_rate?: number;
  avg_latency_ms?: number;
  avg_cost_usd?: number;
  created_at: string;
  updated_at: string;
}

interface PromptHistory {
  id: string;
  change_type: string;
  change_reason?: string;
  changed_by?: string;
  old_version?: number;
  new_version?: number;
  created_at: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8002/api';

export default function PromptManagement() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('covenant_compliance');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [history, setHistory] = useState<PromptHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    template_name: '',
    template_type: 'extraction',
    content: '',
    tags: '',
  });

  const agents = [
    'covenant_compliance',
    'analyst',
    'committee',
    'collateral',
    'writer',
  ];

  useEffect(() => {
    loadTemplates();
  }, [selectedAgent]);

  const loadTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `${API_BASE}/v1/prompts/${selectedAgent}`
      );
      setTemplates(response.data.templates || []);
    } catch (err) {
      setError(`Failed to load templates: ${err}`);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (templateId: string) => {
    try {
      const response = await axios.get(
        `${API_BASE}/v1/prompts/${templateId}/history?limit=20`
      );
      setHistory(response.data || []);
      setShowHistoryModal(true);
    } catch (err) {
      setError(`Failed to load history: ${err}`);
    }
  };

  const createTemplate = async () => {
    setError(null);
    try {
      await axios.post(`${API_BASE}/v1/prompts/`, {
        agent_id: selectedAgent,
        template_name: formData.template_name,
        template_type: formData.template_type,
        content: formData.content,
        tags: formData.tags.split(',').map((t: string) => t.trim()),
        created_by: 'user@credo.com',
      });
      setShowCreateModal(false);
      setFormData({
        template_name: '',
        template_type: 'extraction',
        content: '',
        tags: '',
      });
      await loadTemplates();
    } catch (err) {
      setError(`Failed to create template: ${err}`);
    }
  };

  const updateTemplate = async () => {
    if (!selectedTemplate) return;
    setError(null);
    try {
      await axios.put(`${API_BASE}/v1/prompts/${selectedTemplate.id}`, {
        content: formData.content,
        updated_by: 'user@credo.com',
        change_reason: 'Manual update',
      });
      setShowEditModal(false);
      setFormData({
        template_name: '',
        template_type: 'extraction',
        content: '',
        tags: '',
      });
      await loadTemplates();
    } catch (err) {
      setError(`Failed to update template: ${err}`);
    }
  };

  const rollbackTemplate = async (templateId: string) => {
    setError(null);
    try {
      await axios.post(
        `${API_BASE}/v1/prompts/${templateId}/rollback?reason=User+initiated+rollback&changed_by=user@credo.com`
      );
      await loadTemplates();
    } catch (err) {
      setError(`Failed to rollback: ${err}`);
    }
  };

  const openEditModal = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      template_name: template.template_name,
      template_type: template.template_type,
      content: template.content,
      tags: '',
    });
    setShowEditModal(true);
  };

  return (
    <div className="space-y-8 pb-20 relative">
      <div>
        <SectionHeader
          title="Prompt Management"
          subtitle="Manage, version, and test LLM prompts across all agents"
          icon={Terminal}
          variant="premium"
          className="!p-0 !bg-transparent !border-none"
        />
      </div>

      {/* Agent Selector */}
      <div className="flex flex-wrap gap-2">
        {agents.map((agent) => (
          <button
            key={agent}
            onClick={() => setSelectedAgent(agent)}
            className={cn(
              "px-4 py-2 rounded-xl font-bold text-sm transition-all",
              selectedAgent === agent
                ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/25"
                : "bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700 border border-surface-200 dark:border-brand-primary/10"
            )}
          >
            {agent.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 rounded-xl flex items-center gap-2">
          <span className="font-bold">Error:</span> {error}
        </div>
      )}

      {/* Actions */}
      {/* Performance Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        {/* Aggregate Metrics */}
        <div className="premium-card p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase">Total Templates</span>
            <MessageSquare className="w-4 h-4 text-brand-500" />
          </div>
          <p className="text-3xl font-black text-surface-950 dark:text-white">{templates.length}</p>
          <p className="text-xs text-surface-600 dark:text-surface-400 mt-1">
            {templates.filter(t => t.is_active).length} active
          </p>
        </div>

        <div className="premium-card p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase">Total Usage</span>
            <Terminal className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-3xl font-black text-surface-950 dark:text-white">
            {templates.reduce((sum, t) => sum + (t.usage_count || 0), 0).toLocaleString()}
          </p>
          <p className="text-xs text-surface-600 dark:text-surface-400 mt-1">
            Across all templates
          </p>
        </div>

        <div className="premium-card p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase">Avg Success Rate</span>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-3xl font-black text-green-600 dark:text-green-400">
            {templates.length > 0
              ? Math.round(templates.reduce((sum, t) => sum + (t.success_rate || 0), 0) / templates.length)
              : 0}%
          </p>
          <p className="text-xs text-surface-600 dark:text-surface-400 mt-1">
            Overall performance
          </p>
        </div>

        <div className="premium-card p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase">Avg Latency</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-3xl font-black text-surface-950 dark:text-white">
            {templates.length > 0
              ? Math.round(templates.reduce((sum, t) => sum + (t.avg_latency_ms || 0), 0) / templates.length)
              : 0}ms
          </p>
          <p className="text-xs text-surface-600 dark:text-surface-400 mt-1">
            Response time
          </p>
        </div>
      </div>

      {/* Top Performers */}
      {templates.length > 0 && (
        <div className="premium-card p-6 mb-6">
          <h3 className="text-sm font-black text-surface-950 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-500" />
            Top Performing Templates
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates
              .filter(t => t.is_active)
              .sort((a, b) => (b.success_rate || 0) - (a.success_rate || 0))
              .slice(0, 3)
              .map((template, index) => (
                <div key={template.id} className="bg-surface-50 dark:bg-brand-500/5 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-brand-500">#{index + 1}</span>
                        <h4 className="text-sm font-bold text-surface-950 dark:text-white truncate">
                          {template.template_name}
                        </h4>
                      </div>
                      <span className="text-xs text-surface-500 dark:text-surface-400">v{template.version}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-surface-500 dark:text-surface-400">Success</div>
                      <div className="font-bold text-green-600 dark:text-green-400">
                        {template.success_rate || 0}%
                      </div>
                    </div>
                    <div>
                      <div className="text-surface-500 dark:text-surface-400">Usage</div>
                      <div className="font-bold text-surface-950 dark:text-white">
                        {template.usage_count || 0}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-surface-950 dark:text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-brand-primary" />
          Templates
        </h2>
        <div className="flex gap-2">
          <button
            onClick={loadTemplates}
            className="px-4 py-2 bg-white dark:bg-surface-800 border border-surface-200 dark:border-brand-primary/10 text-surface-700 dark:text-surface-300 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors font-semibold text-sm"
          >
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl hover:bg-brand-600 transition-all font-bold text-sm shadow-lg shadow-brand-primary/20 hover:-translate-y-0.5"
          >
            <Plus size={16} />
            New Template
          </button>
        </div>
      </div>

      {/* Templates List */}
      <div className="grid gap-4">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-surface-500">Loading templates...</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="border-2 border-dashed border-surface-200 dark:border-border-700 rounded-2xl p-12 text-center">
            <Terminal className="w-12 h-12 text-surface-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-surface-950 dark:text-white mb-2">No Templates Found</h3>
            <p className="text-surface-500 mb-6">Create your first prompt template for this agent to get started.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2 bg-surface-100 dark:bg-surface-800 text-surface-950 dark:text-white rounded-lg font-semibold hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
            >
              Create Template
            </button>
          </div>
        ) : (
          templates.map((template) => (
            <div
              key={template.id}
              className="glass rounded-2xl p-6 hover:border-brand-primary/30 transition-colors group"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-surface-950 dark:text-white flex items-center gap-3">
                    {template.template_name}
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full uppercase tracking-wider font-black",
                      template.is_active
                        ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-surface-100 dark:bg-surface-800 text-surface-500"
                    )}>
                      {template.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </h3>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 px-2 py-1 rounded-lg border border-brand-100 dark:border-brand-500/20 font-medium">
                      v{template.version}
                    </span>
                    <span className="text-xs bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-1 rounded-lg border border-purple-100 dark:border-purple-500/20 font-medium uppercase tracking-wider">
                      {template.template_type}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEditModal(template)}
                    className="p-2 text-surface-500 hover:text-brand-primary hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => loadHistory(template.id)}
                    className="p-2 text-surface-500 hover:text-brand-primary hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg transition-colors"
                    title="View History"
                  >
                    <TagsIcon size={18} />
                  </button>
                  <button
                    onClick={() => rollbackTemplate(template.id)}
                    className="p-2 text-surface-500 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-colors"
                    title="Rollback"
                  >
                    <RotateCcw size={18} />
                  </button>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-4 gap-4 mb-4 text-sm bg-surface-50 dark:bg-surface-900/50 p-4 rounded-xl border border-surface-100 dark:border-white/5">
                <div>
                  <span className="text-xs text-surface-500 uppercase font-bold">Usage</span>
                  <p className="font-mono font-bold text-surface-950 dark:text-white text-lg">{template.usage_count}</p>
                </div>
                <div>
                  <span className="text-xs text-surface-500 uppercase font-bold">Success Rate</span>
                  <p className="font-mono font-bold text-surface-950 dark:text-white text-lg">
                    {(template.success_rate ? (template.success_rate * 100).toFixed(1) : 'N/A')}%
                  </p>
                </div>
                <div>
                  <span className="text-xs text-surface-500 uppercase font-bold">Latency</span>
                  <p className="font-mono font-bold text-surface-950 dark:text-white text-lg">
                    {template.avg_latency_ms ? `${template.avg_latency_ms.toFixed(0)}ms` : 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-surface-500 uppercase font-bold">Cost</span>
                  <p className="font-mono font-bold text-surface-950 dark:text-white text-lg">
                    ${template.avg_cost_usd?.toFixed(4) || '0.0000'}
                  </p>
                </div>
              </div>

              {/* Preview */}
              <div className="bg-surface-900 text-surface-200 p-4 rounded-xl text-xs font-mono max-h-32 overflow-hidden relative">
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] bg-surface-800 text-surface-400 uppercase font-black tracking-widest">Preview</div>
                <pre className="whitespace-pre-wrap font-mono">{template.content.substring(0, 300)}{template.content.length > 300 ? '...' : ''}</pre>
                {template.content.length > 300 && (
                  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-surface-900 to-transparent" />
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-surface-900 rounded-2xl max-w-2xl w-full p-8 shadow-2xl border border-surface-200 dark:border-white/10">
            <h2 className="text-2xl font-bold text-surface-950 dark:text-white mb-6">
              Create New Prompt Template
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-1 block">Template Name</label>
                <input
                  type="text"
                  placeholder="e.g., Extraction V2"
                  value={formData.template_name}
                  onChange={(e) =>
                    setFormData({ ...formData, template_name: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-brand-primary/10 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-1 block">Type</label>
                <select
                  value={formData.template_type}
                  onChange={(e) =>
                    setFormData({ ...formData, template_type: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-brand-primary/10 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                >
                  <option value="extraction">Extraction</option>
                  <option value="analysis">Analysis</option>
                  <option value="routing">Routing</option>
                  <option value="generation">Generation</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-1 block">Prompt Content</label>
                <textarea
                  placeholder="Enter your system prompt here..."
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  rows={8}
                  className="w-full px-4 py-3 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-brand-primary/10 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none transition-all font-mono text-sm leading-relaxed"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-1 block">Tags</label>
                <input
                  type="text"
                  placeholder="experimenal, production, extraction..."
                  value={formData.tags}
                  onChange={(e) =>
                    setFormData({ ...formData, tags: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-brand-primary/10 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                />
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-3 bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 rounded-xl font-bold hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createTemplate}
                className="flex-1 px-4 py-3 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-600 transition-colors shadow-lg shadow-brand-primary/20"
              >
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-surface-900 rounded-2xl max-w-2xl w-full p-8 shadow-2xl border border-surface-200 dark:border-white/10">
            <h2 className="text-2xl font-bold text-surface-950 dark:text-white mb-2">
              Edit Template
            </h2>
            <p className="text-surface-500 mb-6 font-mono text-sm">
              {selectedTemplate.template_name} <span className="text-brand-primary">v{selectedTemplate.version}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-1 block">Prompt Content</label>
                <textarea
                  placeholder="Prompt content"
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  rows={12}
                  className="w-full px-4 py-3 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-brand-primary/10 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none transition-all font-mono text-sm leading-relaxed"
                />
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-3 bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 rounded-xl font-bold hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={updateTemplate}
                className="flex-1 px-4 py-3 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-600 transition-colors shadow-lg shadow-brand-primary/20"
              >
                Save New Version
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-surface-900 rounded-2xl max-w-2xl w-full p-8 shadow-2xl border border-surface-200 dark:border-white/10 max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-surface-950 dark:text-white mb-6">Change History</h2>
            {history.length === 0 ? (
              <p className="text-surface-500 italic text-center py-8">No changes recorded.</p>
            ) : (
              <div className="space-y-4">
                {history.map((change) => (
                  <div
                    key={change.id}
                    className="p-4 border border-surface-200 dark:border-white/10 rounded-xl bg-surface-50 dark:bg-surface-800/50"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-bold text-brand-primary px-2 py-0.5 rounded bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20">
                        {change.change_type}
                      </span>
                      <span className="text-xs text-surface-400 font-mono">
                        {new Date(change.created_at).toLocaleDateString()} {new Date(change.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    {change.change_reason && (
                      <p className="text-sm text-surface-700 dark:text-surface-300 mt-2">
                        {change.change_reason}
                      </p>
                    )}

                    {change.changed_by && (
                      <p className="text-xs text-surface-500 mt-3 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-surface-400"></span>
                        {change.changed_by}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowHistoryModal(false)}
              className="mt-8 w-full px-4 py-3 bg-surface-100 dark:bg-surface-800 text-surface-950 dark:text-white rounded-xl font-bold hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TagsIcon({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-history"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12" /><path d="M3 3v9h9" /><polyline points="3 3 3 12 12 12" /><polyline points="12 8 12 12 14 14" /></svg>
  )
}
