import React from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../services/utils';

const Notifications: React.FC = () => {
  const { notifications, removeNotification } = useNotifications();

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            layout
            initial={{ opacity: 0, y: 50, scale: 0.9, x: 20 }}
            animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: 20, transition: { duration: 0.2 } }}
            className={cn(
              "max-w-md w-full pointer-events-auto overflow-hidden",
              "bg-surface-950/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)]",
              "group relative"
            )}
          >
            {/* Type Indicator Bar */}
            <div className={cn(
              "absolute left-0 top-0 bottom-0 w-1.5",
              notification.type === 'success' && "bg-emerald-500",
              notification.type === 'error' && "bg-red-500",
              notification.type === 'warning' && "bg-amber-500",
              notification.type === 'info' && "bg-brand-500",
            )} />

            <div className="p-5 flex items-start gap-4">
              <div className={cn(
                "p-2 rounded-xl bg-white/5 border border-white/10 shrink-0",
                notification.type === 'success' && "text-emerald-400",
                notification.type === 'error' && "text-red-400",
                notification.type === 'warning' && "text-amber-400",
                notification.type === 'info' && "text-brand-400",
              )}>
                {notification.type === 'success' && <CheckCircle className="h-5 w-5" />}
                {notification.type === 'error' && <XCircle className="h-5 w-5" />}
                {notification.type === 'warning' && <AlertTriangle className="h-5 w-5" />}
                {notification.type === 'info' && <Info className="h-5 w-5" />}
              </div>

              <div className="flex-1 min-w-0 py-0.5">
                <p className="text-sm font-bold text-white tracking-tight leading-relaxed">
                  {notification.message}
                </p>
              </div>

              <button
                className="shrink-0 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
                onClick={() => removeNotification(notification.id)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Progress bar effect (simulated) */}
            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: (notification.duration || 5000) / 1000, ease: "linear" }}
              style={{ transformOrigin: "left" }}
              className={cn(
                "h-0.5 w-full absolute bottom-0",
                notification.type === 'success' && "bg-emerald-500/30",
                notification.type === 'error' && "bg-red-500/30",
                notification.type === 'warning' && "bg-amber-500/30",
                notification.type === 'info' && "bg-brand-500/30",
              )}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default Notifications;