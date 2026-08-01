import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { playConfirmTick } from '../utils/sound';
import { useTheme } from '../context/ThemeContext';

/**
 * Reusable confirmation dialog.
 *
 * Usage:
 *   const [dialog, setDialog] = useState({ open: false, title: '', description: '', onConfirm: null, variant: 'destructive' });
 *   const [confirmLoading, setConfirmLoading] = useState(false);
 *
 *   const showConfirm = (config) => setDialog({ ...config, open: true });
 *   const closeConfirm = () => !confirmLoading && setDialog(d => ({ ...d, open: false }));
 *   const handleConfirm = async () => {
 *     if (!dialog.onConfirm) return;
 *     setConfirmLoading(true);
 *     try { await dialog.onConfirm(); setDialog(d => ({ ...d, open: false })); }
 *     finally { setConfirmLoading(false); }
 *   };
 *
 *   <ConfirmDialog
 *     isOpen={dialog.open}
 *     onClose={closeConfirm}
 *     onConfirm={handleConfirm}
 *     title={dialog.title}
 *     description={dialog.description}
 *     variant={dialog.variant || 'destructive'}
 *     loading={confirmLoading}
 *   />
 */
export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  variant = 'destructive',
}) => {
  const confirmBtnRef = useRef(null);
  const { isDark } = useTheme();

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    document.addEventListener('keydown', handleKey);
    const t = setTimeout(() => confirmBtnRef.current?.focus(), 50);
    return () => {
      document.removeEventListener('keydown', handleKey);
      clearTimeout(t);
    };
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  return createPortal(
    // Portaled straight to <body>, outside the Dashboard's own `dark`-scoped
    // root div — reapply it here from ThemeContext (which crosses portals
    // fine, since React context follows the component tree, not the DOM tree)
    // or every dialog would render light no matter the admin theme.
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 ${isDark ? 'dark' : ''}`}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !loading && onClose()}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cdlg-title"
        aria-describedby={description ? 'cdlg-desc' : undefined}
        className="animate-appear rounded-2xl relative z-10 bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-6 w-full max-w-md shadow-2xl"
      >
        <div className="flex items-start gap-4">
          {variant === 'destructive' && (
            <div className="rounded-lg w-10 h-10 bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle size={18} className="text-red-400" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3 id="cdlg-title" className="text-base font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] leading-snug">
              {title}
            </h3>
            {description && (
              <p id="cdlg-desc" className="mt-1.5 text-sm text-[#6E6E73] dark:text-[#a1a1aa] leading-relaxed">
                {description}
              </p>
            )}
          </div>

          {!loading && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-[#e4e4e7] hover:bg-[#EDEDEF] dark:hover:bg-[#2a2a3c] transition-all shrink-0"
              aria-label="Close"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 mt-6 justify-end">
          <span className="hidden sm:inline text-[11px] text-[#A1A1A6] dark:text-[#52525b] mr-auto">
            <kbd className="border border-[#D2D2D7] dark:border-[#2a2a3c] rounded px-1.5 py-0.5">esc</kbd> to cancel
          </span>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-full px-4 py-2 text-sm font-medium text-[#3A3A3C] dark:text-[#a1a1aa] bg-[#EDEDEF] dark:bg-[#2a2a3c] hover:bg-[#D2D2D7] dark:hover:bg-[#3a3a50] transition-all disabled:opacity-40"
          >
            {cancelLabel}
          </button>

          <button
            ref={confirmBtnRef}
            onClick={() => { if (variant === 'destructive') playConfirmTick(); onConfirm(); }}
            disabled={loading}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all disabled:opacity-50 flex items-center gap-2 min-w-[90px] justify-center ${
              variant === 'destructive'
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-[#4ECDC4] hover:bg-[#45b8b0] text-[#0a0a0f]'
            }`}
          >
            {loading ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Processing…
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
