import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Terminal, ShieldAlert, Maximize2, Minimize2, Trash2, Copy, Check, Sparkles, ChevronRight } from 'lucide-react';
import api from '../utils/api';
import { CliCommandPopup } from './CliCommandPopup';

const WELCOME = [
  '╔════════════════════════════════════════════════════════════════════════════╗',
  '║                  VAKAR GAMES  —  SUPER ADMIN CLI CONSOLE                  ║',
  '║                    Secure System Engine • Production API                   ║',
  '╚════════════════════════════════════════════════════════════════════════════╝',
  '',
  "Type 'help' to display the interactive command manual.",
  "Prefix any command with $ (e.g. $user find) to open a visual parameter form.",
  "Type 'clear' or click the trash icon to reset the screen.",
  '',
];

const QUICK_COMMANDS = [
  { label: 'help', cmd: 'help', desc: 'Display command guide' },
  { label: 'vps', cmd: 'vps', desc: 'Server health, CPU, RAM & Disk' },
  { label: 'stats', cmd: 'stats', desc: 'Global platform metrics' },
  { label: 'survey list', cmd: 'survey list', desc: 'List active public surveys' },
  { label: 'dino status', cmd: 'dino maintenance show', desc: 'Dino Tycoon maintenance state' },
  { label: 'dino maint on', cmd: 'dino maintenance on', desc: 'Cut game servers immediately' },
  { label: 'dino maint off', cmd: 'dino maintenance off', desc: 'Reopen game servers' },
  { label: 'user list', cmd: 'user list', desc: 'List recent users & roles' },
  { label: 'clear', cmd: 'clear', desc: 'Clear console output' },
];

export const CliConsole = () => {
  const [lines, setLines]           = useState(() => WELCOME.map(text => ({ type: 'system', text })));
  const [input, setInput]           = useState('');
  const [busy, setBusy]             = useState(false);
  const [pending, setPending]       = useState(null); // command string awaiting y/n confirmation
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied]         = useState(false);

  const [commands, setCommands]     = useState([]);
  const [dropdownIdx, setDropdownIdx] = useState(0);
  const [popup, setPopup]           = useState(null); // { command, prefill } | null

  const historyRef = useRef([]);
  const historyIdxRef = useRef(-1);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    api.get('/api/admin/cli/commands')
      .then(r => setCommands(r.data.commands || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, busy, pending]);

  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const clearConsole = () => {
    setLines(WELCOME.map(text => ({ type: 'system', text })));
    setPending(null);
  };

  const copyConsoleOutput = () => {
    const text = lines.map(l => l.text).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const appendLines = (type, texts) => {
    if (texts.length === 1 && texts[0] === '__CLEAR__') {
      clearConsole();
      return;
    }
    setLines(prev => [...prev, ...texts.map(text => ({ type, text }))]);
  };

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
    if (command.trim().toLowerCase() === 'clear') {
      clearConsole();
      return;
    }
    setBusy(true);
    try {
      const r = await api.post('/api/admin/cli/execute', { command, confirm });
      const { output, needs_confirm, error } = r.data;
      if (output && output.length === 1 && output[0] === '__CLEAR__') {
        clearConsole();
      } else {
        appendLines(error ? 'error' : 'output', output || []);
      }
      if (needs_confirm) setPending(command);
      else setPending(null);
    } catch (e) {
      appendLines('error', [e.response?.data?.detail || 'Command failed: check server telemetry.']);
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

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
      appendLines('error', [`Unknown command '${raw.trim()}'. Type 'help' for available commands.`]);
      return;
    }
    const prefill = tokens.slice(match.path.length);
    setPopup({ command: match, prefill });
  };

  const submit = async (e) => {
    e?.preventDefault();
    const raw = input;
    const cmd = raw.trim();
    if (!cmd || busy) return;

    if (dropdownMatches.length > 0) {
      applyCompletion(dropdownMatches[dropdownIdx]);
      return;
    }

    appendLines('input', [`admin@vkgms:~$ ${raw}`]);
    setInput('');
    historyRef.current.push(raw);
    historyIdxRef.current = -1;

    if (pending) {
      const isYes = /^(y|yes)$/i.test(cmd);
      const cmdToRun = pending;
      setPending(null);
      if (!isYes) {
        appendLines('system', ['Action cancelled by administrator.']);
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

  const renderLine = (l, i) => {
    const text = l.text;
    if (l.type === 'input') {
      return (
        <div key={i} className="flex items-start gap-2 py-0.5 text-[#FF6600] font-semibold">
          <ChevronRight size={14} className="shrink-0 mt-0.5" />
          <span className="whitespace-pre-wrap break-words">{text}</span>
        </div>
      );
    }
    if (l.type === 'error') {
      return (
        <div key={i} className="my-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border-l-2 border-rose-500 text-rose-400 text-xs font-mono">
          {text}
        </div>
      );
    }
    if (text.startsWith('OK :') || text.startsWith('OK:')) {
      return (
        <div key={i} className="py-0.5 text-emerald-400 font-medium whitespace-pre-wrap break-words">
          {text}
        </div>
      );
    }
    if (text.startsWith('Platform stats:') || text.startsWith('VPS Server Telemetry:') || text.startsWith('Dino Game Maintenance Status:') || text.startsWith('Player Profile')) {
      return (
        <div key={i} className="pt-2 pb-0.5 text-amber-300 font-bold uppercase tracking-wider text-[11px] whitespace-pre-wrap break-words">
          {text}
        </div>
      );
    }
    if (l.type === 'system') {
      return (
        <div key={i} className="text-zinc-500 whitespace-pre-wrap break-words py-0.5">
          {text}
        </div>
      );
    }
    return (
      <div key={i} className="text-zinc-300 whitespace-pre-wrap break-words py-0.5">
        {text}
      </div>
    );
  };

  return (
    <div className={fullscreen ? 'fixed inset-0 z-[100] bg-[#0A0B10] p-4 lg:p-8 overflow-y-auto' : 'w-full max-w-6xl mx-auto space-y-6'}>
      {/* Header Banner */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#FF6600]/10 border border-[#FF6600]/20 flex items-center justify-center shadow-inner">
            <Terminal size={22} className="text-[#FF6600]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-[#1D1D1F] dark:text-white tracking-tight">CLI Terminal Engine</h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ONLINE
              </span>
            </div>
            <p className="text-xs text-[#6E6E73] dark:text-[#A1A1A6] mt-0.5">
              Super Admin direct command console — secure system execution & production management.
            </p>
          </div>
        </div>

        {/* Console Action Bar */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearConsole}
            title="Effacer le terminal (clear)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <Trash2 size={13} />
            <span className="hidden sm:inline">Effacer</span>
          </button>
          <button
            type="button"
            onClick={copyConsoleOutput}
            title="Copier la sortie"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            <span className="hidden sm:inline">{copied ? 'Copié !' : 'Copier'}</span>
          </button>
          <button
            type="button"
            onClick={() => setFullscreen(v => !v)}
            title={fullscreen ? 'Quitter plein écran (Esc)' : 'Plein écran'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span className="hidden sm:inline">{fullscreen ? 'Réduire' : 'Plein écran'}</span>
          </button>
        </div>
      </div>

      {/* Terminal Main Window */}
      <div
        className="rounded-3xl overflow-hidden border border-[#2A2B3C] bg-[#0A0B10] shadow-2xl transition-all"
        onClick={() => inputRef.current?.focus()}
      >
        {/* macOS Title Bar */}
        <div className="relative flex items-center justify-between h-11 px-4 bg-gradient-to-r from-[#141522] via-[#10111A] to-[#141522] border-b border-[#232434] select-none">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#FF5F57] ring-1 ring-black/20" />
            <span className="w-3 h-3 rounded-full bg-[#FEBC2E] ring-1 ring-black/20" />
            <span className="w-3 h-3 rounded-full bg-[#28C840] ring-1 ring-black/20" />
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs font-mono font-medium text-zinc-400">
            <span className="text-[#FF6600]">admin@vakargames</span>
            <span className="text-zinc-600">:</span>
            <span className="text-zinc-300">~ (production vps)</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500">
            <span className="hidden md:inline">UTF-8</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
        </div>

        {/* Output Console Screen */}
        <div
          ref={scrollRef}
          className={`overflow-y-auto p-5 font-mono text-[13px] leading-relaxed scroll-smooth ${fullscreen ? 'h-[calc(100vh-280px)]' : 'h-[520px] lg:h-[580px]'}`}
        >
          {lines.map((l, i) => renderLine(l, i))}

          {pending && (
            <div className="my-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold flex items-center gap-2">
              <span className="animate-pulse">⚠</span>
              Confirmation required: please type <span className="underline">y</span> to execute or <span className="underline">n</span> to cancel.
            </div>
          )}

          {/* Autocomplete Menu */}
          <div className="relative mt-2">
            {dropdownMatches.length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 w-full max-w-lg rounded-2xl overflow-hidden border border-[#2F3046] bg-[#141522] shadow-2xl z-20 backdrop-blur-md">
                <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500 border-b border-[#232434] bg-white/5">
                  Suggestions (Tab ou Entrée pour sélectionner)
                </div>
                {dropdownMatches.map((c, i) => (
                  <button
                    type="button"
                    key={c.path.join(' ')}
                    onMouseEnter={() => setDropdownIdx(i)}
                    onClick={() => applyCompletion(c)}
                    className={`w-full flex items-center justify-between gap-4 px-3.5 py-2 text-left transition-colors ${i === dropdownIdx ? 'bg-[#FF6600]/20 text-white' : 'text-zinc-300 hover:bg-white/5'}`}
                  >
                    <span className="font-mono text-xs font-semibold text-[#FF6600]">{c.path.join(' ')}</span>
                    <span className="text-[11px] text-zinc-400 truncate text-right">{c.description}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Terminal Prompt Line */}
            <form onSubmit={submit} className="flex items-center gap-2.5 pt-1">
              <span className="font-mono text-sm font-bold text-[#FF6600] shrink-0 select-none">
                {pending ? 'confirm>' : 'admin@vkgms:~$'}
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
                placeholder={pending ? 'Type y / n...' : "Tapez une commande (ex: vps, dino maintenance show, help...)"}
                className="flex-1 bg-transparent font-mono text-[13px] text-white placeholder-zinc-600 focus:outline-none disabled:opacity-50"
              />
              {busy && (
                <div className="flex items-center gap-1.5 text-xs text-[#FF6600] shrink-0 font-mono animate-pulse">
                  <span>Executing...</span>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Quick Action Chips Bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-[#0F101A] border-t border-[#1F2030] overflow-x-auto no-scrollbar">
          <span className="text-[10px] font-mono uppercase text-zinc-500 shrink-0 flex items-center gap-1">
            <Sparkles size={11} className="text-[#FF6600]" />
            Accès rapide:
          </span>
          {QUICK_COMMANDS.map(q => (
            <button
              key={q.cmd}
              type="button"
              onClick={() => {
                setInput(q.cmd);
                inputRef.current?.focus();
              }}
              title={q.desc}
              className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-mono text-zinc-300 bg-[#1A1B28] hover:bg-[#FF6600]/20 hover:text-[#FF6600] border border-[#28293D] hover:border-[#FF6600]/40 transition-all cursor-pointer"
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Safety Notice */}
      <div className="rounded-2xl p-4 bg-[#FF6600]/5 border border-[#FF6600]/15 flex items-start gap-3">
        <ShieldAlert size={17} className="text-[#FF6600] shrink-0 mt-0.5" />
        <p className="text-xs text-[#6E6E73] dark:text-[#A1A1A6] leading-relaxed">
          Console sécurisée en production. Les actions d'écriture (maintenance, ban, don PlayFab, rôles) demandent toujours une confirmation explicite (<code className="text-[#FF6600] font-mono font-semibold">y</code>) et sont automatiquement inscrites au journal d'audit de sécurité.
        </p>
      </div>

      {/* Graphical Popup Modal for $command */}
      {popup && (
        <CliCommandPopup
          command={popup.command}
          prefill={popup.prefill}
          onClose={() => setPopup(null)}
          onSubmit={(commandString) => {
            setPopup(null);
            setInput('');
            appendLines('input', [`admin@vkgms:~$ ${commandString}`]);
            historyRef.current.push(commandString);
            historyIdxRef.current = -1;
            runCommand(commandString, false);
          }}
        />
      )}
    </div>
  );
};
