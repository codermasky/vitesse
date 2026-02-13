import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  User,
  LogOut,
  Menu,
  Database,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  Bot,
  LayoutDashboard,
  LifeBuoy,
  Zap
} from 'lucide-react';
import HelpOverlay from './HelpOverlay';
import { cn } from '../services/utils';
import ThemeToggle from './ThemeToggle';
import Wayfinder from './Wayfinder';
import Sidekick from './Sidekick';
import { useAISettings } from '../contexts/SettingsContext';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';

const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const { aiSettings, updateAISettings, whitelabel } = useAISettings();
  const { isFeatureEnabled } = useFeatureFlags();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Safety check for aiSettings initialization
  if (!aiSettings || !aiSettings.ui) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-50 dark:bg-surface-950">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigation = [
    {
      title: 'PLATFORM',
      items: [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard },
        ...(isFeatureEnabled('chat') ? [{ name: 'Chat', href: '/chat', icon: MessageSquare }] : []),
        { name: 'Integrations', href: '/integrations', icon: Zap },
      ]
    },
    ...(isFeatureEnabled('knowledge_base') ? [{
      title: 'KNOWLEDGE',
      items: [
        { name: 'Knowledge Base', href: '/knowledge-base', icon: Database },
      ]
    }] : []),
    {
      title: 'SYSTEM',
      items: [
        { name: 'Settings', href: '/settings', icon: SettingsIcon },
        { name: 'Help', href: '/help', icon: LifeBuoy },
      ]
    },
  ];

  const isActive = (href: string) => location.pathname === href;

  return (
    <div className="min-h-screen relative font-sans transition-colors duration-500">
      {/* Background blobs for depth */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-600/10 blur-[120px] rounded-full animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent-emerald/10 blur-[120px] rounded-full animate-pulse-slow" style={{ animationDelay: '2s' }} />
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-surface-950/60 backdrop-blur-md lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 transform transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            aiSettings.ui.sidebarCollapsed ? "lg:w-24" : "lg:w-80"
          )}
        >
          <div className="flex flex-col h-[calc(100vh-2rem)] glass m-4 rounded-3xl relative overflow-visible transition-all duration-500">
            {/* Collapse Toggle Buttons (Desktop only) */}
            <button
              onClick={() => updateAISettings('ui', { sidebarCollapsed: !aiSettings.ui.sidebarCollapsed })}
              className="hidden lg:flex absolute -right-0 top-6 translate-x-1/2 w-6 h-12 bg-surface-100 dark:bg-surface-900 border border-surface-200 dark:border-brand-500/10 rounded-full items-center justify-center z-50 text-surface-400 hover:text-surface-950 dark:text-white dark:hover:text-surface-950 transition-all shadow-xl group/toggle hover:bg-surface-100 dark:hover:bg-surface-800"
            >
              {aiSettings.ui.sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4 transition-transform group-hover/toggle:scale-125" />
              ) : (
                <ChevronLeft className="w-4 h-4 transition-transform group-hover/toggle:scale-125" />
              )}
            </button>

            <button
              onClick={() => updateAISettings('ui', { sidebarCollapsed: !aiSettings.ui.sidebarCollapsed })}
              className="hidden lg:flex absolute -right-0 bottom-24 translate-x-1/2 w-6 h-12 bg-surface-100 dark:bg-surface-900 border border-surface-200 dark:border-brand-500/10 rounded-full items-center justify-center z-50 text-surface-400 hover:text-surface-950 dark:text-white dark:hover:text-surface-950 transition-all shadow-xl group/toggle hover:bg-surface-100 dark:hover:bg-surface-800"
            >
              {aiSettings.ui.sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4 transition-transform group-hover/toggle:scale-125" />
              ) : (
                <ChevronLeft className="w-4 h-4 transition-transform group-hover/toggle:scale-125" />
              )}
            </button>

            <div className="flex flex-col h-full overflow-hidden rounded-3xl">

              {/* Logo */}
              <div className={cn(
                "flex items-center gap-3 px-6 py-8 transition-all duration-500",
                aiSettings.ui.sidebarCollapsed ? "justify-center px-2 py-6" : "px-8"
              )}>
                <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl flex-shrink-0 flex items-center justify-center shadow-lg shadow-brand-500/20">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                {!aiSettings.ui.sidebarCollapsed && (

                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex flex-col"
                  >
                    <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-surface-950 to-brand-600 dark:from-white dark:to-brand-400 whitespace-nowrap">
                      {whitelabel?.brand_name || 'Vitesse AI'}
                    </span>
                    <span className="text-[9px] font-bold text-surface-400 dark:text-brand-500/60 uppercase tracking-wider whitespace-nowrap">
                      {whitelabel?.creator ? `Built by ${whitelabel.creator}` : 'AI Agent Platform'}
                    </span>
                  </motion.span>
                )}
              </div>

              {/* Navigation */}
              <nav className="flex-1 px-3 space-y-6 overflow-y-auto custom-scrollbar my-4">
                {navigation.map((group, groupIndex) => (
                  <div key={groupIndex}>
                    {!aiSettings.ui.sidebarCollapsed && (
                      <div className="px-4 mb-2 text-[10px] font-bold text-surface-400 dark:text-surface-500 uppercase tracking-widest">
                        {group.title}
                      </div>
                    )}
                    {aiSettings.ui.sidebarCollapsed && groupIndex > 0 && (
                      <div className="h-px bg-surface-200 dark:bg-brand-500/5 my-2 mx-2" />
                    )}
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href);
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            onClick={() => setSidebarOpen(false)}
                            className={cn(
                              "flex items-center py-2.5 rounded-2xl transition-all duration-300 group relative whitespace-nowrap overflow-hidden",
                              active
                                ? "bg-brand-600 font-semibold text-white shadow-lg shadow-brand-500/20"
                                : "text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5",
                              aiSettings.ui.sidebarCollapsed ? "px-0 justify-center" : "px-4"
                            )}
                            title={aiSettings.ui.sidebarCollapsed ? item.name : ""}
                          >
                            <Icon className={cn(
                              "w-5 h-5 transition-all duration-300 group-hover:scale-110 flex-shrink-0",
                              active ? "text-white" : "text-surface-400 dark:text-surface-500 group-hover:text-brand-500 dark:group-hover:text-brand-400",
                              aiSettings.ui.sidebarCollapsed ? "m-0" : "mr-3"
                            )} />
                            {!aiSettings.ui.sidebarCollapsed && (
                              <motion.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-sm"
                              >
                                {item.name}
                              </motion.span>
                            )}
                            {active && !aiSettings.ui.sidebarCollapsed && (
                              <motion.div
                                layoutId="active-nav"
                                className="absolute left-1.5 w-1 h-5 bg-surface-100 dark:bg-surface-900 rounded-full"
                              />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>

              {/* User section */}
              <div className="p-3 mt-auto space-y-3">
                {/* Theme Toggle in sidebar footer when expanded, or nice icon when collapsed */}
                <div className={cn("flex justify-center", !aiSettings.ui.sidebarCollapsed && "justify-end px-2")}>
                  <ThemeToggle />
                </div>

                <div className={cn(
                  "glass rounded-2xl border border-surface-200 dark:border-brand-500/5 transition-all duration-500",
                  aiSettings.ui.sidebarCollapsed ? "p-2 items-center justify-center" : "p-4",
                  isActive('/profile') ? "bg-brand-600/10 border-brand-500/50" : "hover:bg-brand-950/5 dark:hover:bg-surface-50/5"
                )}>
                  <Link
                    to="/profile"
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 transition-all duration-500 group/user",
                      aiSettings.ui.sidebarCollapsed ? "flex-col mb-2" : "mb-4"
                    )}
                    title={aiSettings.ui.sidebarCollapsed ? "View Profile" : ""}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center border transition-all duration-300",
                      isActive('/profile')
                        ? "bg-brand-600 border-white/20 shadow-lg shadow-brand-500/40"
                        : "bg-gradient-to-tr from-surface-200 to-surface-300 dark:from-surface-800 dark:to-surface-700 border-surface-200 dark:border-brand-500/10 group-hover/user:border-brand-400/50 group-hover/user:scale-105"
                    )}>
                      <User className={cn(
                        "w-5 h-5 transition-colors",
                        isActive('/profile') ? "text-white" : "text-surface-600 dark:text-surface-300 group-hover/user:text-white"
                      )} />
                    </div>
                    {!aiSettings.ui.sidebarCollapsed && (
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-semibold truncate lowercase transition-colors",
                          isActive('/profile') ? "text-surface-950 dark:text-white" : "text-surface-700 dark:text-white group-hover/user:text-surface-950 dark:group-hover/user:text-white"
                        )}>
                          {user?.email?.split('@')[0]}
                        </p>

                      </div>
                    )}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className={cn(
                      "flex items-center justify-center w-full gap-2 text-sm font-medium text-surface-500 dark:text-surface-300 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 rounded-xl transition-all duration-300 border border-transparent hover:border-red-200 dark:hover:border-red-400/20",
                      aiSettings.ui.sidebarCollapsed ? "p-2" : "px-4 py-2.5"
                    )}
                    title={aiSettings.ui.sidebarCollapsed ? "Logout" : ""}
                  >
                    <LogOut className="w-4 h-4 flex-shrink-0" />
                    {!aiSettings.ui.sidebarCollapsed && <span>Logout</span>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 lg:pl-4">
          {/* Header */}
          <header className="sticky top-0 z-30 lg:hidden px-4 pt-4">
            <div className=" glass rounded-2xl py-3 px-4 flex items-center justify-between border border-surface-200 dark:border-brand-500/10">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 -ml-2 text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white"
              >
                <Menu className="w-6 h-6" />
              </button>

              <span className="text-xl font-bold text-surface-950 dark:text-white tracking-tight">{whitelabel?.brand_name || 'AgentStack'}</span>
              <div className="flex items-center gap-2">
                <ThemeToggle />
              </div>
            </div>
          </header>

          <HelpOverlay isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
          <main className="p-4 lg:p-8 min-h-screen">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="max-w-7xl mx-auto"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
          {aiSettings.wayfinder.enabled && <Wayfinder />}
          {aiSettings.sidekick.enabled && <Sidekick />}
        </div>
      </div>
    </div>
  );
};

export default Layout;