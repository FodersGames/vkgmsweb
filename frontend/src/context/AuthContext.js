import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../utils/api';

const AuthContext = createContext(null);

export const extractErrorMessage = (err, fallback = 'An error occurred') => {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map(d => (typeof d === 'string' ? d : d.msg || JSON.stringify(d)))
      .filter(Boolean)
      .join(', ') || fallback;
  }
  if (detail && typeof detail === 'object') {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  return err?.response?.data?.message || err?.message || fallback;
};

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
      return { success: false, error: extractErrorMessage(err, 'Login failed') };
    }
  };

  const register = async ({ email, password, name, firstName, lastName, username }) => {
    try {
      const payloadName = (name || firstName || '').trim();
      await axios.post(`${API_URL}/api/auth/register`, {
        email,
        password,
        name: payloadName,
        firstName: payloadName,
        lastName: lastName || '',
        username,
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: extractErrorMessage(err, 'Registration failed') };
    }
  };

  const updateProfile = async ({ name, firstName, lastName, username }) => {
    try {
      const payloadName = (name || firstName || '').trim();
      await axios.patch(
        `${API_URL}/api/auth/profile`,
        {
          name: payloadName,
          firstName: payloadName,
          lastName: lastName || '',
          username,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchMe(token);
      return { success: true };
    } catch (err) {
      return { success: false, error: extractErrorMessage(err, 'Failed to update profile') };
    }
  };

  const setPseudo = async (username) => {
    try {
      await axios.post(
        `${API_URL}/api/auth/set-pseudo`,
        { username },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchMe(token);
      return { success: true };
    } catch (err) {
      return { success: false, error: extractErrorMessage(err, 'Failed to set pseudo') };
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
      return { success: false, error: extractErrorMessage(err, 'Failed to change password') };
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
    return (
      !!user.is_super_admin ||
      user.role === 'admin' ||
      user.role === 'super_admin' ||
      (Array.isArray(user.permissions) && user.permissions.length > 0) ||
      (Array.isArray(user.custom_roles) && user.custom_roles.length > 0) ||
      (Array.isArray(user.roles) && user.roles.length > 0)
    );
  };

  return (
    <AuthContext.Provider value={{ user, loading, token, login, register, logout, updateProfile, setPseudo, changePassword, hasPermission, isAdmin, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
