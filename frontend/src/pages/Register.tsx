import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { UserPlus, Mail, Lock, User, ArrowRight } from 'lucide-react';

const Register: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await register(email, password, fullName);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 overflow-hidden font-sans bg-surface-100 dark:bg-surface-950 transition-colors duration-500">
      {/* Dynamic Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand-500/10 dark:bg-brand-600/10 blur-[120px] rounded-full animate-pulse-slow" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-teal-500/10 dark:bg-teal-600/10 blur-[120px] rounded-full animate-pulse-slow" style={{ animationDelay: '2s' }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full space-y-8 relative z-10"
      >
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="w-20 h-20 bg-gradient-to-br from-brand-500 to-accent-cyan rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-brand-500/20"
          >
            <UserPlus className="w-10 h-10 text-white" />
          </motion.div>
          <h2 className="text-4xl font-extrabold text-surface-950 dark:text-white tracking-tight">
            Create account
          </h2>
          <p className="mt-3 text-surface-600 dark:text-surface-400">
            Join the autonomous AI workflow revolution
          </p>
        </div>

        <div className="premium-card !p-8 border-brand-100 dark:border-surface-700/50 bg-surface-100 dark:bg-surface-900/60 backdrop-blur-xl shadow-xl shadow-brand-500/5">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm font-medium"
              >
                {error}
              </motion.div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-brand-900 dark:text-surface-300 ml-1">Full Name</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -transurface-y-1/2 w-5 h-5 text-brand-400 dark:text-surface-500 group-focus-within:text-brand-500 transition-colors" />
                  <input
                    type="text"
                    required
                    className="input-field !pl-12 !py-3.5 bg-brand-50/30 dark:bg-surface-950/50 border-brand-100 dark:border-surface-700 focus:ring-brand-500/50 focus:border-brand-500/50 text-surface-950 dark:text-white placeholder:text-brand-300 dark:placeholder:text-surface-600"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-brand-900 dark:text-surface-300 ml-1">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -transurface-y-1/2 w-5 h-5 text-brand-400 dark:text-surface-500 group-focus-within:text-brand-500 transition-colors" />
                  <input
                    type="email"
                    required
                    className="input-field !pl-12 !py-3.5 bg-brand-50/30 dark:bg-surface-950/50 border-brand-100 dark:border-surface-700 focus:ring-brand-500/50 focus:border-brand-500/50 text-surface-950 dark:text-white placeholder:text-brand-300 dark:placeholder:text-surface-600"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-brand-900 dark:text-surface-300 ml-1">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -transurface-y-1/2 w-5 h-5 text-brand-400 dark:text-surface-500 group-focus-within:text-brand-500 transition-colors" />
                  <input
                    type="password"
                    required
                    className="input-field !pl-12 !py-3.5 bg-brand-50/30 dark:bg-surface-950/50 border-brand-100 dark:border-surface-700 focus:ring-brand-500/50 focus:border-brand-500/50 text-surface-950 dark:text-white placeholder:text-brand-300 dark:placeholder:text-surface-600"
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
              className="btn-primary w-full flex items-center justify-center gap-2 !py-4 shadow-lg hover:shadow-xl transition-all"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Get Started Free
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-brand-100 dark:border-surface-700/30 text-center">
            <p className="text-brand-600 dark:text-surface-400">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-bold text-brand-600 text-surface-950 dark:text-white hover:text-brand-700 dark:hover:text-brand-400 transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;