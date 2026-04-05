import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage: 'url(https://static.prod-images.emergentagent.com/jobs/f4da9165-836d-4ccd-bb4d-66097fd9ce9d/images/71cceb5faf1d82eb04ae5805de8b0e42da44516216391ca58a86c0a93b9f36a6.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      <div className="absolute inset-0 bg-white/80"></div>
      
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white border-2 border-neutral-950 p-12 shadow-[8px_8px_0_0_rgba(0,0,0,0.1)]">
          <div className="flex justify-center mb-8">
            <img 
              src="https://static.prod-images.emergentagent.com/jobs/f4da9165-836d-4ccd-bb4d-66097fd9ce9d/images/7959d5bfda4904e20ed02658ab39cf2916576428116ff2ceb76690c434011089.png" 
              alt="Logo" 
              className="h-16 w-16"
            />
          </div>
          
          <h1 className="text-4xl font-black tracking-tighter text-neutral-950 mb-2 text-center"
              style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>
            ADMIN ACCESS
          </h1>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 text-center mb-8"
             style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
            SECURE AUTHENTICATION
          </p>

          <form onSubmit={handleSubmit} data-testid="login-form">
            <div className="mb-6">
              <label 
                htmlFor="access-key" 
                className="block text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 mb-2"
                style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
              >
                ACCESS KEY
              </label>
              <input
                id="access-key"
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="w-full px-4 py-3 border-2 border-neutral-300 bg-white text-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:border-neutral-950 transition-all duration-200"
                placeholder="Enter your access key"
                required
                data-testid="access-key-input"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              />
            </div>

            {error && (
              <div className="mb-6 p-3 border border-red-600 bg-red-50 text-red-900 text-sm" data-testid="login-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-neutral-950 text-white py-3 font-bold uppercase tracking-wider hover:bg-neutral-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="login-submit-button"
              style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
            >
              {loading ? 'AUTHENTICATING...' : 'LOGIN'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};