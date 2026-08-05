import React from 'react';
import { createPortal } from 'react-dom';
import { X, History } from 'lucide-react';

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';

// Shared "What's New" panel — used by StudioAppView.js (the public running
// app, for any visitor) and AppBuilderEditor.js's Submit Version modal (so
// the owner can see their own past updates while writing a new changelog).
// `history` is the app's `version_history` array as returned by _serialize()
// in studio_apps.py: [{version, changelog, approved_at}], oldest first —
// rendered newest first here.
export function VersionHistoryModal({ open, onClose, history = [] }) {
  if (!open) return null;
  const rows = [...history].sort((a, b) => (b.version || 0) - (a.version || 0));

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
      <div
        onClick={e => e.stopPropagation()}
        className="relative z-10 w-full max-w-md max-h-[80vh] flex flex-col rounded-2xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D2D2D7] dark:border-[#2a2a3c] shrink-0">
          <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] flex items-center gap-2">
            <History size={15} />Version history
          </h3>
          <button onClick={onClose} className="p-1.5 text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white rounded-lg"><X size={15} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {rows.length === 0 ? (
            <p className="text-xs text-[#A1A1A6] dark:text-[#71717a] py-4 text-center">No update history yet.</p>
          ) : (
            rows.map(v => (
              <div key={v.version} className="pb-4 border-b border-[#EDEDEF] dark:border-[#1c1c2e] last:border-0 last:pb-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Version {v.version}</span>
                  <span className="text-[10px] text-[#A1A1A6] dark:text-[#71717a]">{fmtDate(v.approved_at)}</span>
                </div>
                <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] leading-relaxed whitespace-pre-wrap">{v.changelog || 'No details provided.'}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
