import axios from 'axios';
import { toast } from 'sonner';

export const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://vakargames.vercel.app';

/**
 * Centralized Axios instance.
 * - Auto-attaches JWT from localStorage
 * - 10 s timeout
 * - Global error handling: 401 redirect, 403/429/5xx toasts
 * - Components can still catch errors for their own handling
 */
const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

let isHandling401 = false;
let hasRecentNetworkToast = false;
let hasRecent5xxToast = false;

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Network / timeout (no response at all)
    if (!error.response) {
      if (!hasRecentNetworkToast) {
        hasRecentNetworkToast = true;
        if (error.code === 'ECONNABORTED') {
          toast.error('Request timed out: check your connection');
        } else {
          toast.error('Network error: check your internet connection');
        }
        setTimeout(() => { hasRecentNetworkToast = false; }, 4000);
      }
      return Promise.reject(error);
    }

    const { status } = error.response;
    const url = error.config?.url ?? '';
    const isAuthRoute = url.includes('/auth/');

    // 401: session expired (skip on auth routes to avoid login-redirect loops)
    if (status === 401 && !isAuthRoute) {
      localStorage.removeItem('token');
      if (!isHandling401) {
        isHandling401 = true;
        toast.error('Session expired: please log in again');
        window.location.hash = '/login';
        setTimeout(() => { isHandling401 = false; }, 3000);
      }
      return Promise.reject(error);
    }

    // 403: permission denied
    if (status === 403) {
      toast.error('You don\'t have permission to perform this action');
      return Promise.reject(error);
    }

    // 429: rate limited
    if (status === 429) {
      toast.error('Too many requests: please wait a moment');
      return Promise.reject(error);
    }

    // 5xx: server error
    if (status >= 500) {
      if (!hasRecent5xxToast) {
        hasRecent5xxToast = true;
        toast.error('Server error: please try again or contact support');
        setTimeout(() => { hasRecent5xxToast = false; }, 4000);
      }
      return Promise.reject(error);
    }

    // 400, 404, 422 etc. : let the component handle with error.response.data.detail
    return Promise.reject(error);
  }
);

export default api;
