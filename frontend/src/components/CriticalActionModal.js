import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, X, Loader2 } from 'lucide-react';
import api from '../utils/api';
import { useTheme } from '../context/ThemeContext';

// Generates the "type this back" confirmation code — deliberately NOT a
// security code (require_super_admin on the backend is the real boundary),
// just enough friction that scheduling a critical action is never a single
// misclick: read the warning, retype a code you can't have muscle-memorized,
// THEN press a distinct Confirm button. Excludes visually ambiguous
// characters (0/O, 1/I/L) since this is meant to be quick to read and type,
// not hard to guess.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateCode(length = 6) {
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
}

// Three-step flow for any CRITICAL_ACTIONS entry (backend:
// admin_system.py) — warn, retype a random code, confirm. Scheduling (not
// executing) the action starts a 30s countdown any super admin can cancel
// — see CriticalActionBanner.js, which is what actually runs after this
// modal closes.
export default function CriticalActionModal({ actionType, label, onClose, onScheduled }) {
  const { isDark } = useTheme();
  const [step, setStep] = useState(1);
  const [code] = useState(() => generateCode());
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const codeMatches = useMemo(() => typed.trim().toUpperCase() === code, [typed, code]);

  const confirm = async () => {
    if (!codeMatches || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await api.post(`/api/admin/critical-actions/${actionType}/schedule`);
      onScheduled(r.data);
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not schedule this action.');
      setBusy(false);
    }
  };

  return createPortal(
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 ${isDark ? 'dark' : ''}`}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !busy && onClose()} aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        className="animate-appear relative z-10 w-full max-w-md rounded-2xl border-2 border-red-500/40 bg-white dark:bg-[#151520] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-6 py-4 bg-red-500/10 border-b border-red-500/20">
          <div className="rounded-lg w-9 h-9 bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
            <ShieldAlert size={17} className="text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-500">Critical action</p>
            <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] leading-snug truncate">{label}</h3>
          </div>
          {!busy && (
            <button onClick={onClose} className="rounded-lg p-1.5 text-[#6E6E73] dark:text-[#a1a1aa] hover:bg-black/5 dark:hover:bg-white/5 shrink-0" aria-label="Close">
              <X size={15} />
            </button>
          )}
        </div>

        <div className="px-6 py-5">
          {step === 1 && (
            <>
              <p className="text-sm text-[#1D1D1F] dark:text-[#e4e4e7] leading-relaxed">
                This is irreversible and affects every user on the platform. Once confirmed, it doesn't run
                immediately — it enters a <span className="font-semibold">30-second countdown</span> that any
                super admin can cancel, but if nobody does, it WILL execute.
              </p>
              <div className="flex items-center gap-3 mt-6 justify-end">
                <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-medium text-[#3A3A3C] dark:text-[#a1a1aa] bg-[#EDEDEF] dark:bg-[#2a2a3c] hover:bg-[#D2D2D7] dark:hover:bg-[#3a3a50] transition-all">
                  Cancel
                </button>
                <button onClick={() => setStep(2)} className="rounded-full px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-all">
                  I understand, continue
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-[#1D1D1F] dark:text-[#e4e4e7]">Type this code exactly to confirm you mean to do this:</p>
              <div className="mt-3 flex items-center justify-center">
                <span className="font-mono text-2xl font-bold tracking-[0.3em] text-red-500 select-none">{code}</span>
              </div>
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && codeMatches) confirm(); }}
                spellCheck={false}
                autoComplete="off"
                placeholder="Type the code above"
                className="mt-3 w-full rounded-lg border border-[#D2D2D7] dark:border-[#2a2a3c] bg-transparent px-3 py-2.5 text-center font-mono text-lg tracking-[0.2em] text-[#1D1D1F] dark:text-[#e4e4e7] focus:outline-none focus:ring-2 focus:ring-red-500/40"
              />
              {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
              <div className="flex items-center gap-3 mt-6 justify-end">
                <button onClick={onClose} disabled={busy} className="rounded-full px-4 py-2 text-sm font-medium text-[#3A3A3C] dark:text-[#a1a1aa] bg-[#EDEDEF] dark:bg-[#2a2a3c] hover:bg-[#D2D2D7] dark:hover:bg-[#3a3a50] transition-all disabled:opacity-40">
                  Cancel
                </button>
                <button
                  onClick={confirm}
                  disabled={!codeMatches || busy}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 min-w-[160px] justify-center"
                >
                  {busy ? <Loader2 size={13} className="animate-spin" /> : null}
                  {busy ? 'Scheduling…' : 'Confirm & start 30s countdown'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
