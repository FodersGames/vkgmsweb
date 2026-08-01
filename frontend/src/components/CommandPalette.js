import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

// Apple/Spotlight-style global "jump to" palette. Purely presentational — the
// caller supplies `destinations` ({ label, group, icon, onSelect }) already
// filtered to what the current user is allowed to see.
export const CommandPalette = ({ open, onClose, destinations }) => {
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlighted(0);
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  const filtered = destinations.filter(d => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return d.label.toLowerCase().includes(q) || d.group.toLowerCase().includes(q);
  });

  useEffect(() => { setHighlighted(0); }, [query]);

  const runSelected = (d) => {
    if (!d) return;
    d.onSelect();
    onClose();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); runSelected(filtered[highlighted]); }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-[#D2D2D7] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 h-12 border-b border-[#D2D2D7] shrink-0">
          <Search size={15} className="text-[#A1A1A6] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to…"
            spellCheck={false}
            autoComplete="off"
            className="flex-1 bg-transparent text-sm text-[#1D1D1F] placeholder-[#A1A1A6] focus:outline-none"
          />
          <kbd className="text-[10px] font-semibold text-[#A1A1A6] border border-[#D2D2D7] rounded-md px-1.5 py-0.5">esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[#A1A1A6]">No matches.</p>
          ) : (
            filtered.map((d, i) => {
              const Icon = d.icon;
              const active = i === highlighted;
              return (
                <button
                  key={`${d.group}-${d.label}`}
                  onMouseEnter={() => setHighlighted(i)}
                  onClick={() => runSelected(d)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${active ? 'bg-[#4ECDC4]/10' : ''}`}
                >
                  <Icon size={15} className={active ? 'text-[#4ECDC4]' : 'text-[#A1A1A6]'} />
                  <span className={`flex-1 text-sm truncate ${active ? 'text-[#1D1D1F] font-medium' : 'text-[#1D1D1F]'}`}>{d.label}</span>
                  <span className="text-[11px] text-[#A1A1A6] shrink-0">{d.group}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
