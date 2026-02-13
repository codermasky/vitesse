
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Save, AlertCircle, CheckCircle2, Copy, RefreshCw, Activity, ExternalLink } from 'lucide-react';
import SectionHeader from '../components/SectionHeader';
import { cn } from '../services/utils';
import { apiService } from '../services/api';

interface LangFuseConfigData {
  id?: string;
  public_key: string;
  secret_key: string;
  host: string;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

const LangFuseConfig: React.FC = () => {
  const [config, setConfig] = useState<LangFuseConfigData>({
    public_key: '',
    secret_key: '',
    host: 'http://localhost:3000',
    enabled: false
  });

  const [originalConfig, setOriginalConfig] = useState<LangFuseConfigData>({
    public_key: '',
    secret_key: '',
    host: 'http://localhost:3000',
    enabled: false
  });

  const [showPublicKey, setShowPublicKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const hasChanges = JSON.stringify(config) !== JSON.stringify(originalConfig);

  useEffect(() => {
    fetchConfig();
  }, []);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const response = await apiService.getLangfuseConfig();
      if (response.data) {
        setConfig(response.data);
        setOriginalConfig(response.data); // Keep originalConfig in sync
      } else {
        // No config yet, set default empty state but loaded
        const defaultHost = 'https://cloud.langfuse.com'; // Default host for new config
        const defaultState = { enabled: false, public_key: '', secret_key: '', host: defaultHost };
        setConfig(defaultState);
        setOriginalConfig(defaultState);
      }
    } catch (err) {
      console.error('Failed to fetch LangFuse config', err);
      // Don't show error to user immediately on load, just default form
      const defaultHost = 'https://cloud.langfuse.com'; // Default host in case of error
      const defaultState = { enabled: false, public_key: '', secret_key: '', host: defaultHost };
      setConfig(defaultState);
      setOriginalConfig(defaultState);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await apiService.updateLangfuseConfig({
        public_key: config.public_key,
        secret_key: config.secret_key,
        host: config.host,
        enabled: config.enabled
      });
      if (response.data) {
        setConfig(response.data);
        setOriginalConfig(response.data);
      } else {
        setOriginalConfig(config);
      }
      showStatus('success', 'Configuration saved successfully');
    } catch (err) {
      console.error(err);
      showStatus('error', 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const response = await apiService.testLangfuseConfigConnection();
      if (response.data.status === 'success') {
        showStatus('success', response.data.message);
      } else {
        showStatus('error', response.data.message);
      }
    } catch (err) {
      console.error(err);
      showStatus('error', 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleAutoSetup = async () => {
    setTesting(true);
    try {
      const response = await apiService.runLangfuseAutoSetup();
      if (response.data.status === 'success') {
        showStatus('success', 'Auto-setup completed successfully');
        await fetchConfig(); // Refresh config
      } else {
        showStatus('error', response.data.message || 'Auto-setup failed');
      }
    } catch (err: any) {
      console.error(err);
      showStatus('error', err.response?.data?.detail || 'Failed to run auto-setup');
    } finally {
      setTesting(false);
    }
  };

  const handleInputChange = (field: keyof LangFuseConfigData, value: any) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value);
    showStatus('success', 'Copied to clipboard');
  };

  const handleReset = () => {
    setConfig(originalConfig);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <RefreshCw className="w-8 h-8 text-brand-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 relative">
      <SectionHeader
        title="LangFuse Configuration"
        subtitle="Manage observability and LLM trace collection via LangFuse."
        icon={Activity}
        variant="premium"
        className="!p-0 !bg-transparent !border-none"
      />

      {statusMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={cn(
            "p-4 rounded-xl flex items-center gap-3 border",
            statusMsg.type === 'success'
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
              : "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
          )}
        >
          {statusMsg.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-medium text-sm">{statusMsg.text}</span>
        </motion.div>
      )}

      {/* Status Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "glass rounded-2xl p-6 flex items-start gap-4",
          config.enabled
            ? "border-emerald-500/20 bg-emerald-500/5"
            : "border-brand-primary/20 bg-brand-primary/5"
        )}
      >
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border bg-surface-100 dark:bg-surface-900",
          config.enabled
            ? "border-emerald-500/30 text-emerald-500"
            : "border-brand-primary/30 text-brand-primary"
        )}>
          {config.enabled ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
        </div>
        <div>
          <h3 className="font-bold text-surface-950 dark:text-white">
            {config.enabled ? 'Monitoring Active' : 'Monitoring Inactive'}
          </h3>
          <p className="text-sm mt-1 text-surface-600 dark:text-surface-400">
            {config.enabled
              ? 'LLM traces are being collected and sent to your LangFuse instance.'
              : 'Enable monitoring to start capturing LLM traces and metrics.'
            }
          </p>
        </div>

        {config.enabled && (
          <div className="ml-auto">
            <a
              href={config.host}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              Open Dashboard
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </motion.div>

      {/* Main Configuration Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-2xl p-8 space-y-8"
      >
        {/* Enable Switch */}
        <div className="flex items-center justify-between pb-8 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h3 className="font-bold text-surface-950 dark:text-white text-lg">Enable Integration</h3>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
              Toggle LangFuse monitoring on or off globally.
            </p>
          </div>
          <button
            onClick={() => handleInputChange('enabled', !config.enabled)}
            className={cn(
              "relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-surface-50 dark:focus:ring-offset-[#0A0F1E]",
              config.enabled ? "bg-brand-primary" : "bg-gray-200 dark:bg-surface-700"
            )}
          >
            <span
              className={cn(
                "inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm",
                config.enabled ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>

        {/* Configuration Fields */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Host URL
              </label>
              <input
                type="text"
                value={config.host}
                onChange={(e) => handleInputChange('host', e.target.value)}
                placeholder="http://localhost:3000"
                className="input-field w-full"
              />
              <p className="text-xs text-surface-500 mt-2">
                Base URL of your LangFuse instance.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Public Key
              </label>
              <div className="relative">
                <input
                  type={showPublicKey ? 'text' : 'password'}
                  value={config.public_key}
                  onChange={(e) => handleInputChange('public_key', e.target.value)}
                  placeholder="pk-lf-..."
                  className="input-field w-full pr-24"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    onClick={() => setShowPublicKey(!showPublicKey)}
                    className="p-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 transition-colors"
                  >
                    {showPublicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(config.public_key)}
                    className="p-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Secret Key
              </label>
              <div className="relative">
                <input
                  type={showSecretKey ? 'text' : 'password'}
                  value={config.secret_key}
                  onChange={(e) => handleInputChange('secret_key', e.target.value)}
                  placeholder="sk-lf-..."
                  className="input-field w-full pr-24"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    onClick={() => setShowSecretKey(!showSecretKey)}
                    className="p-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 transition-colors"
                  >
                    {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(config.secret_key)}
                    className="p-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={handleTestConnection}
            disabled={testing || !config.enabled}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all",
              "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700",
              (testing || !config.enabled) && "opacity-50 cursor-not-allowed"
            )}
          >
            {testing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Activity className="w-4 h-4" />
                Test Connection
              </>
            )}
          </button>

          <button
            onClick={handleAutoSetup}
            disabled={testing || saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-500/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", testing && "animate-spin")} />
            Run Auto-Setup
          </button>

          <div className="flex gap-4">
            {hasChanges && (
              <button
                onClick={handleReset}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl font-bold text-sm text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200 transition-colors"
              >
                Cancel
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className={cn(
                "flex items-center gap-2 px-8 py-2.5 rounded-xl font-bold text-sm uppercase tracking-widest transition-all shadow-lg",
                hasChanges && !saving
                  ? "bg-gradient-to-r from-brand-primary to-brand-secondary text-white hover:shadow-brand-primary/25 hover:-translate-y-0.5"
                  : "bg-surface-200 dark:bg-surface-800 text-surface-400 dark:text-surface-500 cursor-not-allowed shadow-none"
              )}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LangFuseConfig;
