import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);
const API_URL = process.env.REACT_APP_BACKEND_URL;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      fetchMe(token);
    } else {
      setLoading(false);
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMe = async (t) => {
    try {
      const res = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      setUser(res.data);
    } catch {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const res = await axios.post(`${API_URL}/api/auth/login`, { email, password });
      const { token: newToken, user: userData, first_login } = res.data;
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(userData);
      return { success: true, first_login, user: userData };
    } catch (err) {
      return { success: false, error: err.response?.data?.detail || 'Login failed' };
    }
  };

  const register = async ({ email, password, firstName, lastName, username }) => {
    try {
      await axios.post(`${API_URL}/api/auth/register`, { email, password, firstName, lastName, username });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.detail || 'Registration failed' };
    }
  };

  const updateProfile = async ({ firstName, lastName, username }) => {
    try {
      await axios.patch(
        `${API_URL}/api/auth/profile`,
        { firstName, lastName, username },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchMe(token);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.detail || 'Failed to update profile' };
    }
  };

  const changePassword = async ({ currentPassword, newPassword }) => {
    try {
      await axios.post(
        `${API_URL}/api/auth/change-password`,
        { current_password: currentPassword, new_password: newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Refresh user data so mustChangePassword is cleared
      await fetchMe(token);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.detail || 'Failed to change password' };
    }
  };

  const refreshUser = () => token && fetchMe(token);

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.is_super_admin) return true;
    if (permission === 'view_projects') {
      return user.permissions?.some(p => p === 'view_all_projects' || p.startsWith('project:')) ?? false;
    }
    return user.permissions?.includes(permission) ?? false;
  };

  const isAdmin = () => {
    if (!user) return false;
    return user.is_super_admin || user.role === 'admin' || (user.permissions?.length > 0);
  };

  return (
    <AuthContext.Provider value={{ user, loading, token, login, register, logout, updateProfile, changePassword, hasPermission, isAdmin, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
