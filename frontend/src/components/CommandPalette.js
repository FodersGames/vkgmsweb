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
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-appear w-full max-w-lg rounded-2xl bg-white dark:bg-[#151520] shadow-2xl border border-[#D2D2D7] dark:border-[#2a2a3c] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 h-12 border-b border-[#D2D2D7] dark:border-[#2a2a3c] shrink-0">
          <Search size={15} className="text-[#A1A1A6] dark:text-[#71717a] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to…"
            spellCheck={false}
            autoComplete="off"
            className="flex-1 bg-transparent text-sm text-[#1D1D1F] dark:text-[#e4e4e7] placeholder-[#A1A1A6] dark:placeholder-[#71717a] focus:outline-none"
          />
          <kbd className="text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] border border-[#D2D2D7] dark:border-[#2a2a3c] rounded-md px-1.5 py-0.5">esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[#A1A1A6] dark:text-[#71717a]">No matches.</p>
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
                  <Icon size={15} className={active ? 'text-[#4ECDC4]' : 'text-[#A1A1A6] dark:text-[#71717a]'} />
                  <span className={`flex-1 text-sm truncate ${active ? 'text-[#1D1D1F] dark:text-white font-medium' : 'text-[#1D1D1F] dark:text-[#e4e4e7]'}`}>{d.label}</span>
                  <span className="text-[11px] text-[#A1A1A6] dark:text-[#71717a] shrink-0">{d.group}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
