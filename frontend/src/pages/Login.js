import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock } from 'lucide-react';

export const Login = () => {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(key);
    setLoading(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#FAFAFA]">
      <div className="w-full max-w-md">
        <div className="bg-white border border-[#EDEBE9] rounded-sm shadow-sm">
          {/* Header */}
          <div className="px-8 py-6 border-b border-[#EDEBE9] bg-[#FAFAFA]">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-[#0078D4] rounded-sm flex items-center justify-center">
                <Lock size={24} className="text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-semibold text-[#201F1E] text-center" style={{ fontFamily: 'Chivo, sans-serif' }}>
              Admin Dashboard
            </h1>
            <p className="text-sm text-[#605E5C] text-center mt-2">
              Secure authentication
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8" data-testid="login-form">
            <div className="mb-6">
              <label htmlFor="access-key" className="block text-xs font-semibold text-[#605E5C] mb-2">
                ACCESS KEY
              </label>
              <input
                id="access-key"
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="w-full px-3 py-2 border border-[#EDEBE9] bg-white text-[#201F1E] rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#0078D4] focus:border-[#0078D4]"
                placeholder="Enter your access key"
                required
                data-testid="access-key-input"
                style={{ fontFamily: 'IBM Plex Mono, monospace' }}
              />
            </div>

            {error && (
              <div className="mb-6 p-3 border border-[#A4262C] bg-[#FDE7E9] text-[#A4262C] text-sm rounded-sm" data-testid="login-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0078D4] text-white hover:bg-[#005A9E] rounded-sm px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="login-submit-button"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <div className="mt-4 text-center text-xs text-[#605E5C]">
          Protected by enterprise-grade security
        </div>
      </div>
    </div>
  );
};