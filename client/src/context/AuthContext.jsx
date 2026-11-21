import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const DEMO_PERSONAS = import.meta.env.DEV ? [
  { label: 'Admin', email: 'admin@frontdesk.com', role: 'ADMIN', name: 'System Administrator' },
  { label: 'Agent Sarah', email: 'agent.sarah@frontdesk.com', role: 'AGENT', name: 'Sarah Connor' },
  { label: 'Agent Alex', email: 'agent.alex@frontdesk.com', role: 'AGENT', name: 'Alex Murphy' },
  { label: 'Customer John', email: 'john.doe@example.com', role: 'CUSTOMER', name: 'John Doe' },
  { label: 'Customer Jane', email: 'jane.smith@example.com', role: 'CUSTOMER', name: 'Jane Smith' },
] : [];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('frontdesk_token'));
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Load user profile on startup if token is present
  useEffect(() => {
    async function loadUser() {
      const storedToken = localStorage.getItem('frontdesk_token');
      if (!storedToken) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get('/auth/me');
        setUser(res.data.user);
        setToken(storedToken);
      } catch (err) {
        console.warn('Invalid or expired session token:', err);
        localStorage.removeItem('frontdesk_token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  // Standard Login
  const login = async (email, password) => {
    setAuthError(null);
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token: newToken, user: newUser } = res.data;
      localStorage.setItem('frontdesk_token', newToken);
      setToken(newToken);
      setUser(newUser);
      return { success: true, user: newUser };
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Login failed. Please check credentials.';
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  // Quick switch persona for evaluation & demo testing
  const switchPersona = async (persona) => {
    if (!import.meta.env.DEV) {
      return { success: false, error: 'Demo persona switching is disabled in production.' };
    }
    setAuthError(null);
    try {
      const demoPassword = import.meta.env.DEV ? 'password123' : '';
      const res = await api.post('/auth/login', {
        email: persona.email,
        password: demoPassword,
      });
      const { token: newToken, user: newUser } = res.data;
      localStorage.setItem('frontdesk_token', newToken);
      setToken(newToken);
      setUser(newUser);
      return { success: true, user: newUser };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to switch demo persona.';
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  // Logout
  const logout = () => {
    localStorage.removeItem('frontdesk_token');
    setToken(null);
    setUser(null);
    setAuthError(null);
  };

  const isStaff = user?.role === 'ADMIN' || user?.role === 'AGENT';
  const isAdmin = user?.role === 'ADMIN';
  const isCustomer = user?.role === 'CUSTOMER';

  const value = {
    user,
    token,
    loading,
    authError,
    setAuthError,
    login,
    logout,
    switchPersona,
    isStaff,
    isAdmin,
    isCustomer,
    DEMO_PERSONAS,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
