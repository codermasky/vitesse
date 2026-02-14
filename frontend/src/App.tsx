import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import Integrations from './pages/Integrations';
import { NewIntegration } from './pages/NewIntegration';
import KnowledgeBase from './pages/KnowledgeBase';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';
import Help from './pages/Help';
import Layout from './components/Layout';
import Notifications from './components/Notifications';
import { SettingsProvider } from './contexts/SettingsContext';
import { FeatureFlagsProvider } from './contexts/FeatureFlagsContext';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-50 dark:bg-surface-950">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <>{children}</>;
};



const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="chat" element={<Chat />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="integrations/new" element={<NewIntegration />} />
        <Route path="integrations/:id/edit" element={<NewIntegration isEditMode={true} />} />
        <Route path="knowledge" element={<KnowledgeBase />} />
        <Route path="settings" element={<Settings />} />
        <Route path="profile" element={<Profile />} />
        <Route path="help" element={<Help />} />
      </Route>
    </Routes>
  );
};

function App() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <NotificationProvider>
          <AuthProvider>
            <FeatureFlagsProvider>
              <Router>
                <AppRoutes />
                <Notifications />
              </Router>
            </FeatureFlagsProvider>
          </AuthProvider>
        </NotificationProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}

export default App;
