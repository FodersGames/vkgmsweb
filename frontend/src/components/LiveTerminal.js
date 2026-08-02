import React, { useEffect, useRef, useState } from 'react';

// A small typed sequence: each entry is a command line, followed by 0+ output
// lines. Kept factual and specific to Vakar rather than generic marketing
// copy — this is the "show, don't tell" version of the About section.
const SCRIPT = [
  { cmd: 'whoami', out: ['vakar-games — independent software company, est. 2024'] },
  { cmd: 'ls stack/', out: ['frontend/   React · Tailwind', 'backend/    FastAPI · MongoDB', 'games/      shipped on Roblox & the web'] },
  { cmd: 'cat philosophy.txt', out: ['No outsourced core systems.', 'Small team. We ship it, we support it, we own the bugs.'] },
];

const TYPE_MS = 26;
const LINE_PAUSE_MS = 420;
const BLOCK_PAUSE_MS = 900;

export const LiveTerminal = ({ className = '' }) => {
  const [lines, setLines] = useState([]); // committed lines: { text, kind: 'cmd'|'out' }
  const [typing, setTyping] = useState('');
  const [done, setDone] = useState(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduced.current) {
      // Skip the animation entirely — dump the final transcript.
      const all = [];
      SCRIPT.forEach(block => {
        all.push({ text: block.cmd, kind: 'cmd' });
        block.out.forEach(o => all.push({ text: o, kind: 'out' }));
      });
      setLines(all);
      setDone(true);
      return;
    }

    let cancelled = false;
    const wait = (ms) => new Promise(r => setTimeout(r, ms));

    const run = async () => {
      for (const block of SCRIPT) {
        if (cancelled) return;
        let acc = '';
        for (const ch of block.cmd) {
          if (cancelled) return;
          acc += ch;
          setTyping(acc);
          await wait(TYPE_MS);
        }
        await wait(LINE_PAUSE_MS);
        setLines(prev => [...prev, { text: block.cmd, kind: 'cmd' }]);
        setTyping('');
        for (const o of block.out) {
          if (cancelled) return;
          setLines(prev => [...prev, { text: o, kind: 'out' }]);
          await wait(220);
        }
        await wait(BLOCK_PAUSE_MS);
      }
      if (!cancelled) setDone(true);
    };
    run();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className={`rounded-2xl overflow-hidden liquid-glass ${className}`}>
      {/* Title bar — same chrome language as the admin CLI, for brand continuity */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-[#D2D2D7]/60">
        <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
        <span className="ml-3 text-[11px] font-mono text-[#6E6E73]">vakar@company — zsh</span>
      </div>
      <div className="px-5 py-5 font-mono text-[12.5px] leading-relaxed min-h-[220px]" aria-hidden="true">
        {lines.map((l, i) => (
          l.kind === 'cmd' ? (
            <p key={i} className="text-[#1D1D1F]"><span className="text-[#4ECDC4]">❯</span> {l.text}</p>
          ) : (
            <p key={i} className="text-[#6E6E73] pl-4">{l.text}</p>
          )
        ))}
        {!done && (
          <p className="text-[#1D1D1F]">
            <span className="text-[#4ECDC4]">❯</span> {typing}
            <span className="inline-block w-[7px] h-[13px] bg-[#1D1D1F] ml-0.5 align-middle animate-pulse" />
          </p>
        )}
        {done && (
          <p className="text-[#1D1D1F]">
            <span className="text-[#4ECDC4]">❯</span>
            <span className="inline-block w-[7px] h-[13px] bg-[#1D1D1F] ml-1.5 align-middle animate-pulse" />
          </p>
        )}
      </div>
      {/* Screen-reader friendly plain-text equivalent */}
      <p className="sr-only">
        whoami: vakar-games, independent software company, established 2024. Stack: React and Tailwind frontend, FastAPI and MongoDB backend, games shipped on Roblox and the web. Philosophy: no outsourced core systems, small team that ships and supports what it builds.
      </p>
    </div>
  );
};
