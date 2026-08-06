import * as Blockly from 'blockly/core';
import './blocks';
import './generators';
import { VakarBlockRuntime, VakarSprite } from './runtime';
import { VAKAR_BLOCK_TEMPLATES } from './templates';

// Templates are built with real Blockly APIs (see templates.js) — this
// confirms each one actually compiles and runs cleanly through the real
// runtime for a few real frames, not just that `build()` doesn't throw.
// Not all templates loop forever ("mover"'s scripts are one-shot key
// events, so its threads can finish on frame 1) — waiting a short fixed
// real-time window rather than a frame count works for either shape.
test.each(VAKAR_BLOCK_TEMPLATES)('template "$id" compiles and runs without error', async (template) => {
  const data = template.build();
  expect(data.sprites.length).toBeGreaterThan(0);

  const sprites = new Map(data.sprites.map((s) => [s.id, new VakarSprite(s)]));
  let caughtError = null;
  const rt = new VakarBlockRuntime({
    sprites,
    onRender: () => {},
    onError: (e) => { caughtError = e; },
  });

  for (const s of data.sprites) {
    const sprite = sprites.get(s.id);
    const ws = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(s.workspace, ws);
    rt.compileSprite(sprite, ws);
    ws.dispose();
  }

  rt.greenFlag();
  await new Promise((resolve) => setTimeout(resolve, 150));
  expect(caughtError).toBeNull();

  rt.stop();
  rt.destroy();
});
