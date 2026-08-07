import React, { useEffect, useRef } from 'react';
import * as Blockly from 'blockly/core';
import { TOOLBOX, TOOLBOX_ITEM } from '../appBuilderBlock/blocks';
import { setAbBlockContext } from '../appBuilderBlock/fields';

// Replaces the old ActionEditor/ActionStepFields flat step-list editor
// (AppBuilderEditor.js) with a real Blockly canvas — see
// frontend/src/appBuilderBlock/ for the block defs/codegen/runtime this
// drives. Mirrors VakarBlockEditor.js's mount pattern, but simpler: rather
// than one workspace shared across the whole editor with an explicit
// save-outgoing/load-incoming effect on every context switch (needed there
// for cross-sprite undo continuity), each mount owns a fresh, disposable
// workspace — the parent forces a remount via a `key` change (node id +
// trigger) whenever the user selects a different component/trigger, so
// there's nothing to explicitly hand off. `value`/`context` are only read
// at mount time; the parent is expected to always change `key` alongside
// any `value` it wants reloaded (this holds for every call site today: a
// legacy-migration rewrite happens before the panel ever mounts for that
// trigger, not while it's already open).
export default function AppBuilderBlockPanel({ value, onChange, context, itemScope = false, label }) {
  const divRef = useRef(null);
  const wsRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!divRef.current || wsRef.current) return;
    setAbBlockContext(context);
    const ws = Blockly.inject(divRef.current, {
      toolbox: itemScope ? TOOLBOX_ITEM : TOOLBOX,
      renderer: 'zelos',
      trashcan: true,
      zoom: { controls: true, wheel: true, startScale: 0.85 },
      grid: { spacing: 24, length: 2, colour: '#e2e2e5', snap: true },
      move: { scrollbars: true, drag: true, wheel: false },
    });
    wsRef.current = ws;
    if (value?.blockly) {
      try {
        Blockly.serialization.workspaces.load(value.blockly, ws);
      } catch (err) {
        console.error('App Builder Blocks: failed to load workspace', err);
      }
    }
    ws.addChangeListener((e) => {
      if (e.isUiEvent) return;
      const json = Blockly.serialization.workspaces.save(ws);
      onChangeRef.current({ v: 1, blockly: json });
    });
    return () => {
      ws.dispose();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the TARGET/SCREEN dropdown fields' options current if the
  // component tree changes while this panel stays open (e.g. renaming
  // another component's text, which changes its picker label).
  useEffect(() => {
    setAbBlockContext(context);
  }, [context]);

  return (
    <div>
      <label className="block text-[10px] font-semibold text-[#6E6E73] dark:text-[#a1a1aa] uppercase tracking-wider mb-1.5">{label}</label>
      <div className="relative w-full rounded-lg border border-[#D2D2D7] dark:border-[#2a2a3c] overflow-hidden bg-white dark:bg-[#151520]" style={{ height: 420 }}>
        <div ref={divRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
