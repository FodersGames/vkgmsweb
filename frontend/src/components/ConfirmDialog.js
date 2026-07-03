import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X, Loader2 } from 'lucide-react';

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
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
        className="relative z-10 bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in"
        style={{ animation: 'cdlgIn 140ms cubic-bezier(0.16,1,0.3,1)' }}
      >
        <div className="flex items-start gap-4">
          {variant === 'destructive' && (
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle size={18} className="text-error-400" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3 id="cdlg-title" className="text-base font-semibold text-gray-900 leading-snug">
              {title}
            </h3>
            {description && (
              <p id="cdlg-desc" className="mt-1.5 text-sm text-gray-500 leading-relaxed">
                {description}
              </p>
            )}
          </div>

          {!loading && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all shrink-0"
              aria-label="Close"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="flex gap-3 mt-6 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all disabled:opacity-40"
          >
            {cancelLabel}
          </button>

          <button
            ref={confirmBtnRef}
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center gap-2 min-w-[90px] justify-center ${
              variant === 'destructive'
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-brand-400 hover:bg-brand-500 text-[#0a0a0f]'
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

      <style>{`
        @keyframes cdlgIn {
          from { opacity: 0; transform: scale(0.96) translateY(4px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
};
