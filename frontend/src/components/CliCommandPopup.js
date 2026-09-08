import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Terminal } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { Select } from '../ui';

// Shell-quote a value the same way the backend's shlex.split() expects it
// back — wraps in double quotes (escaping any embedded quote) whenever the
// value contains whitespace, leaves single-word values bare.
const quoteArg = (v) => (/\s/.test(v) ? `"${v.replace(/"/g, '\\"')}"` : v);

// Builds the raw command string from a catalog entry's path + the popup's
// filled-in values, preserving positional order: a skipped OPTIONAL arg that
// sits before a later filled arg becomes an empty quoted placeholder (`""`,
// which shlex.split parses as an empty-string token) rather than being
// dropped — dropping it would shift every argument after it out of position.
export const buildCliCommand = (path, args, values) => {
  const parts = [...path];
  let lastFilled = -1;
  args.forEach((a, i) => { if ((values[a.name] ?? '').toString().trim() !== '') lastFilled = i; });
  for (let i = 0; i <= lastFilled; i++) {
    const raw = (values[args[i].name] ?? '').toString();
    parts.push(raw.trim() === '' ? '""' : quoteArg(raw));
  }
  return parts.join(' ');
};

// Graphical form for one CLI command — opened by typing `$command` in the
// console. `command` is a catalog entry ({ path, category, description,
// args, confirm }) from GET /admin/cli/commands; `prefill` holds any extra
// tokens already typed after the command path, mapped positionally onto the
// first N args so `$player mute alpha` arrives with "Project" pre-filled.
export const CliCommandPopup = ({ command, prefill = [], onClose, onSubmit }) => {
  const { isDark } = useTheme();
  const [values, setValues] = useState(() => {
    const init = {};
    command.args.forEach((a, i) => { init[a.name] = prefill[i] ?? ''; });
    return init;
  });
  const [error, setError] = useState('');

  const setField = (name, v) => setValues(prev => ({ ...prev, [name]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const missing = command.args.find(a => a.required && !(values[a.name] ?? '').toString().trim());
    if (missing) {
      setError(`"${missing.label}" is required.`);
      return;
    }
    onSubmit(buildCliCommand(command.path, command.args, values));
  };

  return createPortal(
    // Same portal + isDark-reapplication pattern as ConfirmDialog.js — the
    // portal escapes the Dashboard's `.dark`-scoped root, so the theme class
    // has to be reapplied here or this would always render light.
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 ${isDark ? 'dark' : ''}`}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        className="animate-appear rounded-2xl relative z-10 bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-6 w-full max-w-md shadow-2xl"
      >
        <div className="flex items-start gap-3 mb-5">
          <div className="rounded-lg w-9 h-9 bg-[#4ECDC4]/10 flex items-center justify-center shrink-0">
            <Terminal size={16} className="text-[#4ECDC4]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">{command.path.join(' ')}</p>
            <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa] mt-0.5">{command.description}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#1D1D1F] dark:hover:text-[#e4e4e7] hover:bg-[#EDEDEF] dark:hover:bg-[#2a2a3c] transition-all shrink-0">
            <X size={15} />
          </button>
        </div>

        {command.args.length === 0 ? (
          <p className="text-sm text-[#6E6E73] dark:text-[#a1a1aa] mb-2">This command takes no arguments.</p>
        ) : (
          <div className="space-y-3">
            {command.args.map(a => (
              <div key={a.name}>
                <label className="block text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] uppercase tracking-wider mb-1">
                  {a.label} {!a.required && <span className="normal-case font-normal">(optional)</span>}
                </label>
                {a.type === 'select' ? (
                  <Select size="sm" value={values[a.name] || ''} onChange={e => setField(a.name, e.target.value)}>
                    <option value="">{a.required ? 'Select…' : '(none)'}</option>
                    {(a.choices || []).map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                ) : a.type === 'textarea' ? (
                  <textarea
                    rows={3}
                    value={values[a.name] || ''}
                    onChange={e => setField(a.name, e.target.value)}
                    className="rounded-lg w-full px-3 py-2 text-sm border border-[#D2D2D7] dark:border-[#2a2a3c] focus:outline-none focus:border-[#4ECDC4] bg-white dark:bg-[#111118] text-[#1D1D1F] dark:text-[#e4e4e7] resize-none"
                  />
                ) : (
                  <input
                    type={a.type === 'number' ? 'number' : 'text'}
                    value={values[a.name] || ''}
                    onChange={e => setField(a.name, e.target.value)}
                    className="rounded-lg w-full px-3 py-2 text-sm border border-[#D2D2D7] dark:border-[#2a2a3c] focus:outline-none focus:border-[#4ECDC4] bg-white dark:bg-[#111118] text-[#1D1D1F] dark:text-[#e4e4e7]"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-xs text-red-500 mt-3">{error}</p>}

        <div className="flex items-center gap-3 mt-6 justify-end">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-medium text-[#3A3A3C] dark:text-[#a1a1aa] bg-[#EDEDEF] dark:bg-[#2a2a3c] hover:bg-[#D2D2D7] dark:hover:bg-[#3a3a50] transition-all">
            Cancel
          </button>
          <button type="submit" className="rounded-full px-4 py-2 text-sm font-semibold bg-[#4ECDC4] hover:bg-[#45b8b0] text-[#0a0a0f] transition-all">
            {command.confirm ? 'Preview' : 'Run'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
};
