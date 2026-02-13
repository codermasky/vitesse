import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import apiService from '../services/api';

interface User {
  id: number;
  email: string;
  full_name?: string;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
  updated_at: string;
  role: 'ADMIN' | 'ANALYST' | 'REVIEWER' | 'REQUESTOR';
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithAzureAD: () => Promise<void>;
  handleAzureADCallback: (code: string, state: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token && token !== 'dummy-token-for-testing') {
        try {
          const response = await apiService.getCurrentUser();
          setUser(response.data);
        } catch (error) {
          console.error("Auth check failed:", error);
          localStorage.removeItem('access_token');
          setUser(null);
        }
      } else {
        // Clear dummy token if it exists
        if (token === 'dummy-token-for-testing') {
          localStorage.removeItem('access_token');
        }
        setUser(null);
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await apiService.login(email, password);
      const { access_token } = response.data;
      localStorage.setItem('access_token', access_token);

      // Get user info
      const userResponse = await apiService.getCurrentUser();
      setUser(userResponse.data);
    } catch (error) {
      throw error;
    }
  }, []);

  const loginWithAzureAD = useCallback(async () => {
    try {
      const response = await apiService.getAzureADLoginUrl();
      const { login_url } = response.data;
      window.location.href = login_url;
    } catch (error) {
      throw error;
    }
  }, []);

  const handleAzureADCallback = useCallback(async (code: string, state: string) => {
    try {
      const response = await apiService.azureADCallback(code, state);
      const { access_token } = response.data;
      localStorage.setItem('access_token', access_token);

      // Get user info
      const userResponse = await apiService.getCurrentUser();
      setUser(userResponse.data);
    } catch (error) {
      throw error;
    }
  }, []);

  const register = useCallback(async (email: string, password: string, fullName?: string) => {
    try {
      await apiService.register({ email, password, full_name: fullName });
      // After registration, login automatically
      await login(email, password);
    } catch (error) {
      throw error;
    }
  }, [login]);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    setUser(null);
  }, []);

  const value: AuthContextType = useMemo(() => ({
    user,
    login,
    loginWithAzureAD,
    handleAzureADCallback,
    register,
    logout,
    isAuthenticated: !!user,
    loading,
  }), [user, login, loginWithAzureAD, handleAzureADCallback, register, logout, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};