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
