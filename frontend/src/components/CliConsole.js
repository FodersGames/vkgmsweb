import React, { useState, useRef, useEffect } from 'react';
import { Terminal, ShieldAlert } from 'lucide-react';
import api from '../utils/api';

const WELCOME = [
  'Vakar Games — Super Admin CLI',
  "Type 'help' to list available commands.",
  '',
];

export const CliConsole = () => {
  const [lines, setLines]     = useState(() => WELCOME.map(text => ({ type: 'system', text })));
  const [input, setInput]     = useState('');
  const [busy, setBusy]       = useState(false);
  const [pending, setPending] = useState(null); // command string awaiting y/n confirmation

  const historyRef = useRef([]);
  const historyIdxRef = useRef(-1);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines]);

  const appendLines = (type, texts) => {
    setLines(prev => [...prev, ...texts.map(text => ({ type, text }))]);
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

  const submit = async (e) => {
    e.preventDefault();
    const raw = input;
    const cmd = raw.trim();
    if (!cmd || busy) return;

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

    await runCommand(cmd, false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const h = historyRef.current;
      if (!h.length) return;
      const next = historyIdxRef.current < 0 ? h.length - 1 : Math.max(0, historyIdxRef.current - 1);
      historyIdxRef.current = next;
      setInput(h[next]);
    } else if (e.key === 'ArrowDown') {
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
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg w-10 h-10 bg-[#4ECDC4]/10 flex items-center justify-center">
          <Terminal size={20} className="text-[#4ECDC4]" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#1D1D1F]">CLI</h1>
          <p className="text-xs text-[#A1A1A6]">Super admin only — whitelisted commands, every action is confirmed and logged.</p>
        </div>
      </div>

      {/* Warning banner */}
      <div className="flex items-start gap-2.5 bg-[#F2994A]/10 border border-[#F2994A]/30 px-4 py-3">
        <ShieldAlert size={15} className="text-[#F2994A] shrink-0 mt-0.5" />
        <p className="text-xs text-[#6E6E73] leading-relaxed">
          This console only runs a fixed set of predefined commands — there is no raw database access or code
          execution. Destructive commands (suspend, ban, revoke, loyalty adjust…) always show a preview first
          and require you to type <span className="font-semibold text-[#1D1D1F]">y</span> to confirm.
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
        </div>

        <div
          ref={scrollRef}
          className="h-[440px] overflow-y-auto px-4 py-3 bg-[#1a1a1a] font-mono text-[13px] leading-relaxed"
        >
          {lines.map((l, i) => (
            <div key={i} className={`whitespace-pre-wrap break-words ${colorFor(l.type)}`}>
              {l.text}
            </div>
          ))}
          {pending && (
            <div className="text-[#F2994A]">Confirm? (y/n)</div>
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
              placeholder={pending ? 'y / n' : "type a command… ('help' for the list)"}
              className="flex-1 bg-transparent font-mono text-[13px] text-white placeholder-[#6E6E73]/60 focus:outline-none disabled:opacity-50"
            />
          </form>
        </div>
      </div>
    </div>
  );
};
