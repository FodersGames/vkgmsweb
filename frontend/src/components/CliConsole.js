import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Terminal, ShieldAlert, Maximize2, Minimize2, AlertTriangle, ChevronDown } from 'lucide-react';
import api from '../utils/api';
import { CliCommandPopup } from './CliCommandPopup';
import CriticalActionModal from './CriticalActionModal';

const WELCOME = [
  'Vakar Games — Super Admin CLI',
  "Type 'help' to list available commands.",
  "Prefix any command with $ (e.g. $player mute) to fill it in graphically.",
  '',
];

export const CliConsole = () => {
  const [lines, setLines]     = useState(() => WELCOME.map(text => ({ type: 'system', text })));
  const [input, setInput]     = useState('');
  const [busy, setBusy]       = useState(false);
  const [pending, setPending] = useState(null); // command string awaiting y/n confirmation
  const [fullscreen, setFullscreen] = useState(false);

  const [commands, setCommands] = useState([]);
  const [dropdownIdx, setDropdownIdx] = useState(0);
  const [popup, setPopup] = useState(null); // { command, prefill } | null

  // Critical actions (admin_system.py's CRITICAL_ACTIONS) never run through
  // the normal y/n confirm above — they open CriticalActionModal instead,
  // which schedules a 30s cancellable countdown any super admin can abort
  // (see CriticalActionBanner.js, rendered site-wide in Dashboard.js).
  const [criticalActions, setCriticalActions] = useState([]);
  const [criticalMenuOpen, setCriticalMenuOpen] = useState(false);
  const [criticalTarget, setCriticalTarget] = useState(null); // { action_type, label } | null

  const historyRef = useRef([]);
  const historyIdxRef = useRef(-1);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    api.get('/api/admin/cli/commands').then(r => setCommands(r.data.commands || [])).catch(() => {});
    api.get('/api/admin/critical-actions/catalog').then(r => setCriticalActions(r.data.actions || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines]);

  // Restore focus once the input re-enables (it's briefly disabled while a command runs),
  // so the user can keep typing without having to click back into the terminal.
  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy]);

  // Escape exits fullscreen, same convention as ConfirmDialog's Escape-to-close.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e) => { if (e.key === 'Escape') setFullscreen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const appendLines = (type, texts) => {
    setLines(prev => [...prev, ...texts.map(text => ({ type, text }))]);
  };

  // Autocomplete — matches the catalog's command path against whatever's
  // typed so far (stripping a leading $ so `$player mu` still suggests
  // `player mute`), shown only while there's a partial match and no pending
  // confirmation prompt in the way.
  const effectiveInput = input.startsWith('$') ? input.slice(1) : input;
  const dropdownMatches = useMemo(() => {
    const q = effectiveInput.trim().toLowerCase();
    if (!q || pending) return [];
    return commands
      .filter(c => c.path.join(' ').toLowerCase().startsWith(q) && c.path.join(' ').toLowerCase() !== q)
      .slice(0, 8);
  }, [effectiveInput, commands, pending]);

  useEffect(() => { setDropdownIdx(0); }, [dropdownMatches.length]);

  const applyCompletion = (cmd) => {
    setInput((input.startsWith('$') ? '$' : '') + cmd.path.join(' ') + ' ');
    inputRef.current?.focus();
  };

  const runCommand = async (command, confirm) => {
    setBusy(true);
    try {
      const r = await api.post('/api/admin/cli/execute', { command, confirm });
      const { output, needs_confirm, error } = r.data;
      appendLines(error ? 'error' : 'output', output || []);
      if (needs_confirm) setPending(command);
      else setPending(null);
    } catch (e) {
      appendLines('error', [e.response?.data?.detail || 'Command failed — see server logs.']);
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  // Finds the longest catalog path that's a prefix of the given tokens —
  // same matching a `$player mute alpha` needs to resolve to `player mute`
  // (2-token path) rather than stopping at just `player`.
  const matchCommand = (tokens) => {
    let best = null;
    for (const c of commands) {
      const n = c.path.length;
      if (tokens.length >= n && c.path.every((p, i) => p === tokens[i].toLowerCase())) {
        if (!best || n > best.path.length) best = c;
      }
    }
    return best;
  };

  const openPopupFor = (raw) => {
    const tokens = raw.trim().split(/\s+/);
    const match = matchCommand(tokens);
    if (!match) {
      appendLines('error', [`Unknown command '${raw.trim()}'. Type 'help' for the command list.`]);
      return;
    }
    const prefill = tokens.slice(match.path.length);
    setPopup({ command: match, prefill });
  };

  const submit = async (e) => {
    e.preventDefault();
    const raw = input;
    const cmd = raw.trim();
    if (!cmd || busy) return;

    if (dropdownMatches.length > 0) {
      // A visible suggestion takes over Enter instead of submitting — matches
      // CommandPalette's existing Enter-selects-highlighted convention.
      applyCompletion(dropdownMatches[dropdownIdx]);
      return;
    }

    appendLines('input', [`vakargames-cli> ${raw}`]);
    setInput('');
    historyRef.current.push(raw);
    historyIdxRef.current = -1;

    if (pending) {
      const isYes = /^(y|yes)$/i.test(cmd);
      const cmdToRun = pending;
      setPending(null);
      if (!isYes) {
        appendLines('system', ['Cancelled.']);
        return;
      }
      await runCommand(cmdToRun, true);
      return;
    }

    if (cmd.startsWith('$')) {
      openPopupFor(cmd.slice(1));
      return;
    }

    await runCommand(cmd, false);
  };

  const onKeyDown = (e) => {
    if (dropdownMatches.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setDropdownIdx(i => Math.min(i + 1, dropdownMatches.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setDropdownIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Tab') { e.preventDefault(); applyCompletion(dropdownMatches[dropdownIdx]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setInput(''); return; }
    }
    if (e.key === 'ArrowUp' && dropdownMatches.length === 0) {
      e.preventDefault();
      const h = historyRef.current;
      if (!h.length) return;
      const next = historyIdxRef.current < 0 ? h.length - 1 : Math.max(0, historyIdxRef.current - 1);
      historyIdxRef.current = next;
      setInput(h[next]);
    } else if (e.key === 'ArrowDown' && dropdownMatches.length === 0) {
      e.preventDefault();
      const h = historyRef.current;
      if (historyIdxRef.current < 0) return;
      const next = historyIdxRef.current + 1;
      if (next >= h.length) {
        historyIdxRef.current = -1;
        setInput('');
      } else {
        historyIdxRef.current = next;
        setInput(h[next]);
      }
    }
  };

  const colorFor = (type) => {
    switch (type) {
      case 'input':  return 'text-[#4ECDC4]';
      case 'error':  return 'text-red-400';
      case 'system': return 'text-[#6E6E73]';
      default:       return 'text-[#D6D3D1]';
    }
  };

  return (
    <div className={fullscreen ? 'fixed inset-0 z-[100] bg-[#0e0e12] p-6 overflow-y-auto' : 'p-6 max-w-4xl mx-auto space-y-6'}>
      <div className={fullscreen ? 'max-w-5xl mx-auto space-y-6' : 'space-y-6'}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg w-10 h-10 bg-[#4ECDC4]/10 flex items-center justify-center">
          <Terminal size={20} className="text-[#4ECDC4]" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className={`text-lg font-bold ${fullscreen ? 'text-white' : 'text-[#1D1D1F]'}`}>CLI</h1>
          <p className={`text-xs ${fullscreen ? 'text-[#8a8a92]' : 'text-[#A1A1A6]'}`}>Super admin only — whitelisted commands, every action is confirmed and logged.</p>
        </div>
        {criticalActions.length > 0 && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setCriticalMenuOpen(v => !v)}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold text-red-500 bg-red-500/10 border border-red-500/30 hover:bg-red-500/15 transition-all"
            >
              <AlertTriangle size={13} />
              Critical Actions
              <ChevronDown size={13} className={`transition-transform ${criticalMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {criticalMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-72 rounded-lg overflow-hidden border border-red-500/30 bg-white dark:bg-[#1a1a24] shadow-xl z-20">
                {criticalActions.map(a => (
                  <button
                    key={a.action_type}
                    type="button"
                    onClick={() => { setCriticalMenuOpen(false); setCriticalTarget(a); }}
                    className="w-full text-left px-3.5 py-2.5 text-xs text-[#1D1D1F] dark:text-[#e4e4e7] hover:bg-red-500/10 transition-colors"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Warning banner */}
      <div className="rounded-lg flex items-start gap-2.5 bg-[#F2994A]/10 border border-[#F2994A]/30 px-4 py-3">
        <ShieldAlert size={15} className="text-[#F2994A] shrink-0 mt-0.5" />
        <p className={`text-xs leading-relaxed ${fullscreen ? 'text-[#c4c4c8]' : 'text-[#6E6E73]'}`}>
          This console only runs a fixed set of predefined commands — there is no raw database access or code
          execution. Destructive commands (suspend, ban, revoke, loyalty adjust…) always show a preview first
          and require you to type <span className={`font-semibold ${fullscreen ? 'text-white' : 'text-[#1D1D1F]'}`}>y</span> to confirm.
        </p>
      </div>

      {/* Terminal window */}
      <div
        className="rounded-xl overflow-hidden shadow-2xl ring-1 ring-black/10"
        onClick={() => inputRef.current?.focus()}
      >
        {/* Title bar */}
        <div className="relative flex items-center h-9 px-3.5 bg-gradient-to-b from-[#4a4a4a] to-[#383838] border-b border-black/40">
          <div className="flex items-center gap-[7px]">
            <span className="w-3 h-3 rounded-full bg-[#FF5F57] ring-1 ring-black/10" />
            <span className="w-3 h-3 rounded-full bg-[#FEBC2E] ring-1 ring-black/10" />
            <span className="w-3 h-3 rounded-full bg-[#28C840] ring-1 ring-black/10" />
          </div>
          <span className="absolute left-1/2 -translate-x-1/2 text-[12.5px] font-medium text-white/70">
            super-admin — vakargames-cli
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setFullscreen(v => !v); }}
            className="ml-auto text-white/50 hover:text-white/90 transition-colors"
            title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
          >
            {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>

        <div
          ref={scrollRef}
          className={`overflow-y-auto px-4 py-3 bg-[#1a1a1a] font-mono text-[13px] leading-relaxed ${fullscreen ? 'h-[calc(100vh-260px)]' : 'h-[440px]'}`}
        >
          {lines.map((l, i) => (
            <div key={i} className={`whitespace-pre-wrap break-words ${colorFor(l.type)}`}>
              {l.text}
            </div>
          ))}
          {pending && (
            <div className="text-[#F2994A]">Confirm? (y/n)</div>
          )}

          <div className="relative">
            {dropdownMatches.length > 0 && (
              <div className="absolute bottom-full left-0 mb-1 w-full max-w-md rounded-lg overflow-hidden border border-white/10 bg-[#242424] shadow-xl z-10">
                {dropdownMatches.map((c, i) => (
                  <button
                    type="button"
                    key={c.path.join(' ')}
                    onMouseEnter={() => setDropdownIdx(i)}
                    onClick={() => applyCompletion(c)}
                    className={`w-full flex items-center gap-3 px-3 py-1.5 text-left transition-colors ${i === dropdownIdx ? 'bg-[#4ECDC4]/15' : ''}`}
                  >
                    <span className={`font-mono text-[12px] ${i === dropdownIdx ? 'text-[#4ECDC4]' : 'text-[#D6D3D1]'}`}>{c.path.join(' ')}</span>
                    <span className="text-[11px] text-[#7a7a7a] truncate">{c.description}</span>
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={submit} className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-[13px] text-[#4ECDC4] shrink-0">
                {pending ? 'confirm>' : 'vakargames-cli>'}
              </span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={busy}
                autoFocus
                spellCheck={false}
                autoComplete="off"
                placeholder={pending ? 'y / n' : "type a command… ('help' for the list, $command for a form)"}
                className="flex-1 bg-transparent font-mono text-[13px] text-white placeholder-[#6E6E73]/60 focus:outline-none disabled:opacity-50"
              />
            </form>
          </div>
        </div>
      </div>
      </div>

      {popup && (
        <CliCommandPopup
          command={popup.command}
          prefill={popup.prefill}
          onClose={() => setPopup(null)}
          onSubmit={(commandString) => {
            setPopup(null);
            setInput('');
            appendLines('input', [`vakargames-cli> ${commandString}`]);
            historyRef.current.push(commandString);
            historyIdxRef.current = -1;
            runCommand(commandString, false);
          }}
        />
      )}

      {criticalTarget && (
        <CriticalActionModal
          actionType={criticalTarget.action_type}
          label={criticalTarget.label}
          onClose={() => setCriticalTarget(null)}
          onScheduled={() => {
            appendLines('system', [
              `⚠ CRITICAL: '${criticalTarget.label}' scheduled — see the countdown banner to cancel.`,
            ]);
            setCriticalTarget(null);
          }}
        />
      )}
    </div>
  );
};
