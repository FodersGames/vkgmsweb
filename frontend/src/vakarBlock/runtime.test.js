import * as Blockly from 'blockly/core';
import './blocks';
import './generators';
import { VakarBlockRuntime, VakarSprite } from './runtime';

// Builds a headless (non-rendered) Blockly workspace with a real script —
// exercises the actual compile path (blocks.js + generators.js + the
// requestAnimationFrame scheduler in runtime.js) end to end, since this is
// the one part of Vakar Block that isn't provable just by reading the code:
// does the Scratch-style concurrency model (generator functions + yield)
// actually run compiled scripts correctly.

function numberBlock(ws, value) {
  const b = ws.newBlock('math_number');
  b.setFieldValue(String(value), 'NUM');
  return b;
}

function connectValue(block, inputName, valueBlock) {
  block.getInput(inputName).connection.connect(valueBlock.outputConnection);
}

function connectStack(...blocks) {
  for (let i = 0; i < blocks.length - 1; i++) {
    blocks[i].nextConnection.connect(blocks[i + 1].previousConnection);
  }
  return blocks[0];
}

test('compiles and runs a move + repeat + variable script on green flag', async () => {
  const ws = new Blockly.Workspace();
  const variable = ws.getVariableMap().createVariable('score');

  const hat = ws.newBlock('vk_when_green_flag');

  const move = ws.newBlock('vk_move_steps');
  connectValue(move, 'STEPS', numberBlock(ws, 10));

  const repeat = ws.newBlock('controls_repeat_ext');
  connectValue(repeat, 'TIMES', numberBlock(ws, 3));
  const turn = ws.newBlock('vk_turn_right');
  connectValue(turn, 'DEGREES', numberBlock(ws, 15));
  repeat.getInput('DO').connection.connect(turn.previousConnection);

  const setVar = ws.newBlock('variables_set');
  setVar.getField('VAR').setValue(variable.getId());
  connectValue(setVar, 'VALUE', numberBlock(ws, 5));

  connectStack(hat, move, repeat, setVar);

  const sprite = new VakarSprite({ id: 's1', name: 'Chat', x: 0, y: 0, direction: 90 });
  const rt = new VakarBlockRuntime({
    sprites: new Map([[sprite.id, sprite]]),
    onRender: () => {},
    onError: (e) => { throw e; },
  });

  rt.compileSprite(sprite, ws);
  rt.greenFlag();

  await new Promise((resolve) => { rt.onRender = resolve; });

  expect(sprite.x).toBeCloseTo(10);
  expect(sprite.y).toBeCloseTo(0);
  expect(sprite.direction).toBe((90 + 15 * 3) % 360);
  expect(sprite.vars.score).toBe(5);
  expect(rt.running).toBe(false);

  rt.destroy();
});

test('toujours keeps a thread alive until stop() is called', async () => {
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('vk_when_green_flag');
  const forever = ws.newBlock('vk_forever');
  const move = ws.newBlock('vk_move_steps');
  connectValue(move, 'STEPS', numberBlock(ws, 1));
  forever.getInput('DO').connection.connect(move.previousConnection);
  connectStack(hat, forever);

  const sprite = new VakarSprite({ id: 's1', name: 'Chat', x: 0, y: 0, direction: 90 });
  const rt = new VakarBlockRuntime({
    sprites: new Map([[sprite.id, sprite]]),
    onRender: () => {},
    onError: (e) => { throw e; },
  });

  rt.compileSprite(sprite, ws);
  rt.greenFlag();

  await new Promise((resolve) => {
    let frames = 0;
    rt.onRender = () => { frames += 1; if (frames >= 3) resolve(); };
  });

  expect(rt.running).toBe(true);
  expect(sprite.x).toBeGreaterThanOrEqual(2);

  rt.stop();
  expect(rt.running).toBe(false);
  expect(rt.threads.length).toBe(0);

  rt.destroy();
});

test('vk_stop_all actually works (runtime.stopAll was a latent bug — the plain runtimeApi object never had that method)', async () => {
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('vk_when_green_flag');
  const stopAll = ws.newBlock('vk_stop_all');
  connectStack(hat, stopAll);

  const sprite = new VakarSprite({ id: 's1', name: 'Chat' });
  const rt = new VakarBlockRuntime({
    sprites: new Map([[sprite.id, sprite]]),
    onRender: () => {},
    onError: (e) => { throw e; },
  });
  rt.compileSprite(sprite, ws);
  expect(() => rt.greenFlag()).not.toThrow();
  await new Promise((resolve) => { rt.onRender = resolve; });
  expect(rt.running).toBe(false);
  rt.destroy();
});

test('diffusion: broadcast from one sprite starts a "when I receive" thread on another', async () => {
  const wsA = new Blockly.Workspace();
  const hatA = wsA.newBlock('vk_when_green_flag');
  const broadcast = wsA.newBlock('vk_broadcast');
  broadcast.setFieldValue('score', 'MESSAGE');
  connectStack(hatA, broadcast);

  const wsB = new Blockly.Workspace();
  const hatB = wsB.newBlock('vk_when_i_receive');
  hatB.setFieldValue('score', 'MESSAGE');
  const move = wsB.newBlock('vk_move_steps');
  connectValue(move, 'STEPS', numberBlock(wsB, 10));
  connectStack(hatB, move);

  const spriteA = new VakarSprite({ id: 'a', name: 'Emetteur' });
  const spriteB = new VakarSprite({ id: 'b', name: 'Recepteur', direction: 90 });
  const rt = new VakarBlockRuntime({
    sprites: new Map([[spriteA.id, spriteA], [spriteB.id, spriteB]]),
    onRender: () => {},
    onError: (e) => { throw e; },
  });
  rt.compileSprite(spriteA, wsA);
  rt.compileSprite(spriteB, wsB);
  rt.greenFlag();

  await new Promise((resolve) => { rt.onRender = resolve; });
  expect(spriteB.x).toBeCloseTo(10);
  rt.destroy();
});

test('clones: createClone copies state and starts its own "when I start as clone" thread', () => {
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('vk_when_i_start_as_clone');
  const move = ws.newBlock('vk_move_steps');
  connectValue(move, 'STEPS', numberBlock(ws, 5));
  connectStack(hat, move);

  const source = new VakarSprite({ id: 'orig', name: 'Original', x: 20, y: 30, direction: 90 });
  source.vars.hp = 3;
  const rt = new VakarBlockRuntime({
    sprites: new Map([[source.id, source]]),
    onRender: () => {},
    onError: (e) => { throw e; },
  });
  rt.compileSprite(source, ws);
  rt.running = true; // clones' hats only start threads while the project is "running"

  const clone = rt.createClone(source, 'moi-même');
  expect(clone.isClone).toBe(true);
  expect(clone.x).toBe(20);
  expect(clone.y).toBe(30);
  expect(clone.vars.hp).toBe(3);
  expect(rt.sprites.get(clone.id)).toBe(clone);
  expect(rt.threads.some((t) => t.sprite === clone)).toBe(true);

  rt.deleteClone(clone.id);
  expect(rt.sprites.has(clone.id)).toBe(false);
  expect(rt.threads.some((t) => t.sprite === clone)).toBe(false);

  rt.destroy();
});

test('détection: touching() and distanceTo() use AABB overlap in stage units', () => {
  const a = new VakarSprite({ id: 'a', name: 'A', x: 0, y: 0, size: 100 });
  const b = new VakarSprite({ id: 'b', name: 'B', x: 5, y: 0, size: 100 });
  const c = new VakarSprite({ id: 'c', name: 'C', x: 500, y: 0, size: 100 });
  const rt = new VakarBlockRuntime({
    sprites: new Map([[a.id, a], [b.id, b], [c.id, c]]),
    onRender: () => {},
    onError: (e) => { throw e; },
  });

  expect(rt.touching(a, 'B')).toBe(true); // overlapping boxes
  expect(rt.touching(a, 'C')).toBe(false); // far away
  expect(rt.touching(c, 'bord')).toBe(true); // past the approximate stage edge
  expect(rt.touching(a, 'bord')).toBe(false);

  rt.setMousePosition(0, 0);
  expect(rt.touching(a, 'souris')).toBe(true);
  expect(Math.round(rt.distanceTo(a, 'B'))).toBe(5);

  rt.destroy();
});

test('listes: runtime.list() lazily creates a per-sprite array that generated list blocks would mutate', () => {
  const sprite = new VakarSprite({ id: 's1', name: 'Chat' });
  const rt = new VakarBlockRuntime({ sprites: new Map([[sprite.id, sprite]]), onRender: () => {}, onError: () => {} });

  const list = rt.list(sprite, 'inventaire');
  list.push('épée');
  list.push('bouclier');
  expect(rt.list(sprite, 'inventaire')).toEqual(['épée', 'bouclier']);
  expect(sprite.vars.inventaire).toEqual(['épée', 'bouclier']);

  rt.destroy();
});

test('son: playSound tracks active audio, stopAllSounds clears it, playSoundUntilDone waits for "ended"', () => {
  const sprite = new VakarSprite({ id: 's1', name: 'Chat', sounds: [{ id: 'snd1', name: 'miaou', audio_url: '/api/uploads/fake.mp3' }] });
  const rt = new VakarBlockRuntime({ sprites: new Map([[sprite.id, sprite]]), onRender: () => {}, onError: () => {} });

  const audio = rt.playSound(sprite, 'miaou');
  expect(audio).not.toBeNull();
  expect(rt._activeAudio.has(audio)).toBe(true);
  expect(rt.playSound(sprite, 'inconnu')).toBeNull(); // unknown sound name is a safe no-op

  rt.stopAllSounds();
  expect(rt._activeAudio.size).toBe(0);

  const gen = rt.playSoundUntilDone(sprite, 'miaou');
  let result = gen.next();
  expect(result.done).toBe(false);
  expect(rt._activeAudio.size).toBe(1);
  const [activeAudio] = rt._activeAudio;
  activeAudio.dispatchEvent(new Event('ended'));
  result = gen.next();
  expect(result.done).toBe(true);

  rt.destroy();
});

test('mes blocs: a defined procedure runs when called, called twice from two different scripts, and its own wait still yields correctly', async () => {
  const ws = new Blockly.Workspace();

  // définir sauter: avancer de 5, attendre 0.01s, avancer de 5
  const def = ws.newBlock('vk_procedure_def');
  def.setFieldValue('sauter', 'NAME');
  const move1 = ws.newBlock('vk_move_steps');
  connectValue(move1, 'STEPS', numberBlock(ws, 5));
  const wait = ws.newBlock('vk_wait_secs');
  connectValue(wait, 'SECS', numberBlock(ws, 0.01));
  const move2 = ws.newBlock('vk_move_steps');
  connectValue(move2, 'STEPS', numberBlock(ws, 5));
  connectStack(move1, wait, move2);
  def.getInput('DO').connection.connect(move1.previousConnection);

  // deux scripts séparés (déclenchés tous les deux par le drapeau vert)
  // appellent tous les deux "sauter" en même temps — vérifie que des appels
  // concurrents à la même procédure sont bien indépendants.
  const hatA = ws.newBlock('vk_when_green_flag');
  const callA = ws.newBlock('vk_procedure_call');
  callA.setFieldValue('sauter', 'NAME');
  connectStack(hatA, callA);

  const hatB = ws.newBlock('vk_when_green_flag');
  const callB = ws.newBlock('vk_procedure_call');
  callB.setFieldValue('sauter', 'NAME');
  connectStack(hatB, callB);

  const sprite = new VakarSprite({ id: 's1', name: 'Chat', x: 0, y: 0, direction: 90 });
  const rt = new VakarBlockRuntime({
    sprites: new Map([[sprite.id, sprite]]),
    onRender: () => {},
    onError: (e) => { throw e; },
  });
  rt.compileSprite(sprite, ws);
  rt.greenFlag();

  // the wait inside the procedure means neither call finishes on frame 1
  await new Promise((resolve) => { rt.onRender = resolve; });
  expect(sprite.x).toBeCloseTo(10); // both scripts' first "avancer de 5" has run (2 x 5)

  await new Promise((resolve) => {
    const check = () => { if (sprite.x >= 19.9) resolve(); else rt.onRender = check; };
    rt.onRender = check;
  });
  expect(sprite.x).toBeCloseTo(20); // both concurrent calls fully completed (2 x (5+5))
  expect(rt.running).toBe(false);

  rt.destroy();
});
