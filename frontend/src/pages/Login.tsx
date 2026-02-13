import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, LayoutDashboard, Sparkles, LogIn } from 'lucide-react';
import apiService from '../services/api';


const Login: React.FC = () => {
  const [email, setEmail] = useState('admin@agentstack.ai');
  const [password, setPassword] = useState('agentstack123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, loginWithAzureAD, handleAzureADCallback } = useAuth();
  const navigate = useNavigate();
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const rootUrl = apiService.getBaseUrl().replace('/api/v1', '');
        const response = await fetch(`${rootUrl}/health`);
        if (response.ok) {
          setBackendStatus('connected');
        } else {
          setBackendStatus('error');
        }
      } catch (err) {
        setBackendStatus('error');
      }
    };

    // Handle Azure AD callback
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    if (code && state) {
      handleAzureADCallback(code, state)
        .then(() => navigate('/'))
        .catch((err) => setError('Azure AD login failed: ' + (err.response?.data?.detail || err.message)));
    }

    checkBackend();
    const interval = setInterval(checkBackend, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [searchParams, handleAzureADCallback, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      // Login successful, redirect to dashboard or intended destination
      navigate('/');
    } catch (err: any) {
      console.error("Login error:", err);
      // Fallback for demo/testing if real backend is down but we want to show UI? 
      // No, let's stay strict for "Real" mode.
      const msg = err.response?.data?.detail || 'Login failed. Please check your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 overflow-hidden font-sans transition-colors duration-500">
      {/* Dynamic Background with Nebula Effect */}
      <div className="fixed inset-0 -z-10 bg-surface-100 dark:bg-surface-900 overflow-hidden transition-colors duration-500">
        <div className="absolute inset-0 bg-nebula-gradient opacity-10 dark:opacity-80" />
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand-500/10 dark:bg-brand-600/20 blur-[150px] rounded-full animate-float" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 dark:bg-accent-emerald/15 blur-[150px] rounded-full animate-float" style={{ animationDelay: '3s' }} />
        <div className="absolute top-[40%] left-[40%] w-[20%] h-[20%] bg-brand-500/10 dark:bg-accent-brand/10 blur-[100px] rounded-full animate-pulse-slow" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-md w-full space-y-8 relative z-10"
      >
        <div className="text-center relative">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="w-24 h-24 bg-gradient-to-br from-brand-500 to-accent-blue rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-glow relative group"
          >
            <div className="absolute inset-0 bg-surface-50/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <LayoutDashboard className="w-12 h-12 text-surface-950 dark:text-white relative z-10 drop-shadow-md" />
            <div className="absolute -top-2 -right-2">
              <Sparkles className="w-6 h-6 text-accent-amber animate-pulse-soft" />
            </div>
          </motion.div>

          <h2 className="text-5xl font-extrabold text-surface-950 dark:text-white tracking-tight drop-shadow-lg leading-tight">
            Welcome <span className="bg-gradient-to-r from-brand-600 to-emerald-500 dark:from-brand-300 dark:to-emerald-400 bg-clip-text text-transparent">Back</span>
          </h2>

          <div className="mt-6 flex items-center justify-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${backendStatus === 'connected' ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)] animate-pulse' :
              backendStatus === 'error' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-amber-500'
              }`} />
            <span className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-widest">
              {backendStatus === 'connected' ? 'System Online' :
                backendStatus === 'error' ? 'System Offline' : 'Checking connection...'}
            </span>
          </div>
        </div>

        <div className="premium-card !p-10 border-brand-100 dark:border-brand-500/10 backdrop-blur-2xl bg-surface-50/60 dark:bg-surface-900/40">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-200 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2"
              >
                <div className="w-2 h-2 rounded-full bg-red-400" />
                {error}
              </motion.div>
            )}

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-surface-600 dark:text-surface-300 ml-1">Email Address</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-surface-400 dark:text-surface-500 group-focus-within:text-brand-500 transition-colors duration-300" />
                  </div>
                  <input
                    type="email"
                    required
                    className="input-field !pl-12 !py-4 bg-surface-50/50 dark:bg-surface-900/50 focus:bg-surface-100 dark:bg-surface-900 dark:focus:bg-surface-900/80"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-sm font-semibold text-surface-600 dark:text-surface-300">Password</label>
                  <a href="#" className="text-xs font-medium text-brand-500 dark:text-brand-400 hover:text-accent-cyan transition-colors">Forgot Password?</a>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-surface-400 dark:text-surface-500 group-focus-within:text-brand-500 transition-colors duration-300" />
                  </div>
                  <input
                    type="password"
                    required
                    className="input-field !pl-12 !py-4 bg-surface-50/50 dark:bg-surface-900/50 focus:bg-surface-100 dark:bg-surface-900 dark:focus:bg-surface-900/80"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-3 !py-4 text-lg mt-6 shadow-neon group"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span className="group-hover:transurface-x-1 transition-transform">Sign In</span>
                  <ArrowRight className="w-5 h-5 group-hover:transurface-x-1 transition-transform" />
                </>
              )}
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-surface-200 dark:border-surface-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-surface-50 dark:bg-surface-900 text-surface-500 dark:text-surface-400">
                  Or continue with
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => loginWithAzureAD()}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 !py-4 text-lg mt-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all duration-300 group"
            >
              <LogIn className="w-5 h-5" />
              <span>Sign in with Azure AD</span>
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-surface-200 dark:border-surface-700/50 text-center">
            <p className="text-surface-500 dark:text-surface-400 font-medium">
              New to AgentStack?{' '}
              <Link
                to="/register"
                className="font-bold text-surface-950 dark:text-white hover:text-accent-cyan transition-colors relative inline-block group"
              >
                Create an account
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-accent-cyan transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;