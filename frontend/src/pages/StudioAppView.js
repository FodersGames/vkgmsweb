import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, WarningCircle, LockKey } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import AppRuntime from '../components/AppRuntime';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function StudioAppView() {
  const { slug } = useParams();
  const { token, loading: authLoading } = useAuth();
  const [app, setApp] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (authLoading) return;
    setStatus('loading');
    document.title = 'Vakar Games';
    fetch(`${API_URL}/api/apps/${slug}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
      .then(r => { if (!r.ok) throw new Error('not found'); return r.json(); })
      .then(data => {
        setApp(data);
        setStatus('ok');
        document.title = `${data.name} — Vakar Games`;
      })
      .catch(() => setStatus('not_found'));
  }, [slug, token, authLoading]);

  if (authLoading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7]">
        <div className="w-8 h-8 border-2 border-[#D2D2D7] border-t-[#4ECDC4] rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'not_found') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F7] text-center px-6">
        <WarningCircle size={28} className="text-[#A1A1A6] mb-4" />
        <p className="font-display text-xl font-medium text-[#1D1D1F] mb-2">App not found</p>
        <p className="text-sm text-[#6E6E73] mb-6 max-w-xs">
          This app doesn't exist, isn't published, or you don't have access to it.
        </p>
        <Link to="/" className="text-sm font-semibold text-[#4ECDC4] hover:underline">Back to Vakar Games</Link>
      </div>
    );
  }

  // No device-frame chrome here — this is the real, shipped app (same
  // principle as the APK export), so it just fills the screen with its
  // own content. The phone simulation is a design-time aid only, kept in
  // the builder's canvas and its Preview modal.
  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F7]">
      <Link to="/" className="flex items-center gap-1.5 text-xs font-semibold text-[#6E6E73] hover:text-[#1D1D1F] transition-colors px-6 py-4">
        <ArrowLeft size={12} />Vakar Games
      </Link>
      <div className="relative flex-1">
        <AppRuntime app={app} token={token} className="w-full h-full" showWatermark={!app.owner_is_vakar_plus} />
      </div>
      {app.visibility === 'private' && (
        <p className="text-[11px] text-[#A1A1A6] flex items-center justify-center gap-1 py-3 border-t border-[#D2D2D7]"><LockKey size={11} />Internal tool — staff only</p>
      )}
    </div>
  );
}
