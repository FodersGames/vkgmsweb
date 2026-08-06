import * as Blockly from 'blockly/core';
import './blocks';
import './generators';
import { VakarBlockRuntime, VakarSprite } from './runtime';
import { buildProjectFromSb3, exportSpriteWorkspace } from './sb3';

// A hand-crafted but structurally real Scratch project.json fragment
// (matching the actual sb3 block-dict shape: opcode/next/parent/inputs/
// fields) — no real .sb3 file is available in this environment, so this is
// the closest thing to "import a real Scratch project" that can be
// verified here. Covers: green flag, move, repeat+turn, if/else, variable
// set, broadcast → receive across two sprites.
function scratchProject() {
  return {
    targets: [
      {
        isStage: true, name: 'Stage', variables: {}, lists: {}, broadcasts: {},
        blocks: {}, costumes: [{ assetId: 'bg1', name: 'fond', dataFormat: 'svg' }], sounds: [], currentCostume: 0,
      },
      {
        isStage: false, name: 'Chat', variables: { var1: ['score', 0] }, lists: {}, broadcasts: {},
        x: 0, y: 0, direction: 90, size: 100, visible: true, currentCostume: 0,
        costumes: [{ assetId: 'cos1', name: 'costume1', dataFormat: 'svg' }],
        sounds: [{ assetId: 'snd1', name: 'miaou', dataFormat: 'wav' }],
        blocks: {
          hat1: { opcode: 'event_whenflagclicked', next: 'move1', parent: null, inputs: {}, fields: {}, topLevel: true, x: 0, y: 0 },
          move1: { opcode: 'motion_movesteps', next: 'repeat1', parent: 'hat1', inputs: { STEPS: [1, 'num1'] }, fields: {} },
          num1: { opcode: 'math_number', next: null, parent: 'move1', inputs: {}, fields: { NUM: ['10', null] }, shadow: true },
          repeat1: { opcode: 'control_repeat', next: 'ifelse1', parent: 'move1', inputs: { TIMES: [1, 'num2'], SUBSTACK: [2, 'turn1'] }, fields: {} },
          num2: { opcode: 'math_number', next: null, parent: 'repeat1', inputs: {}, fields: { NUM: ['3', null] }, shadow: true },
          turn1: { opcode: 'motion_turnright', next: null, parent: 'repeat1', inputs: { DEGREES: [1, 'num3'] }, fields: {} },
          num3: { opcode: 'math_number', next: null, parent: 'turn1', inputs: {}, fields: { NUM: ['15', null] }, shadow: true },
          ifelse1: {
            opcode: 'control_if_else', next: 'setvar1', parent: 'repeat1',
            inputs: { CONDITION: [2, 'cmp1'], SUBSTACK: [2, 'showBlk'], SUBSTACK2: [2, 'hideBlk'] }, fields: {},
          },
          cmp1: { opcode: 'operator_gt', next: null, parent: 'ifelse1', inputs: { OPERAND1: [1, 'numA'], OPERAND2: [1, 'numB'] }, fields: {} },
          numA: { opcode: 'math_number', next: null, parent: 'cmp1', inputs: {}, fields: { NUM: ['5', null] }, shadow: true },
          numB: { opcode: 'math_number', next: null, parent: 'cmp1', inputs: {}, fields: { NUM: ['1', null] }, shadow: true },
          showBlk: { opcode: 'looks_show', next: null, parent: 'ifelse1', inputs: {}, fields: {} },
          hideBlk: { opcode: 'looks_hide', next: null, parent: 'ifelse1', inputs: {}, fields: {} },
          setvar1: {
            opcode: 'data_setvariableto', next: 'bcast1', parent: 'ifelse1',
            inputs: { VALUE: [1, 'num4'] }, fields: { VARIABLE: ['score', 'var1'] },
          },
          num4: { opcode: 'math_number', next: null, parent: 'setvar1', inputs: {}, fields: { NUM: ['5', null] }, shadow: true },
          bcast1: {
            opcode: 'event_broadcast', next: null, parent: 'setvar1',
            inputs: { BROADCAST_INPUT: [1, 'menu1'] }, fields: {},
          },
          menu1: { opcode: 'event_broadcast_menu', next: null, parent: 'bcast1', inputs: {}, fields: { BROADCAST_OPTION: ['go', 'go'] }, shadow: true },
        },
      },
      {
        isStage: false, name: 'Receveur', variables: {}, lists: {}, broadcasts: {},
        x: -50, y: 0, direction: 90, size: 100, visible: true, currentCostume: 0,
        costumes: [], sounds: [],
        blocks: {
          hat2: { opcode: 'event_whenbroadcastreceived', next: 'move2', parent: null, inputs: {}, fields: { BROADCAST_OPTION: ['go', 'go'] }, topLevel: true, x: 0, y: 0 },
          move2: { opcode: 'motion_movesteps', next: null, parent: 'hat2', inputs: { STEPS: [1, 'num5'] }, fields: {} },
          num5: { opcode: 'math_number', next: null, parent: 'move2', inputs: {}, fields: { NUM: ['7', null] }, shadow: true },
        },
      },
    ],
  };
}

async function runAndWait(rt) {
  rt.greenFlag();
  await new Promise((resolve) => { rt.onRender = resolve; });
}

test('sb3 import: a hand-crafted real-shaped Scratch project compiles and runs correctly', async () => {
  const { stage, sprites, warnings } = buildProjectFromSb3(scratchProject());

  expect(warnings).toEqual([]);
  expect(sprites.length).toBe(2);
  expect(stage._backdropSpecs[0].name).toBe('fond');
  expect(sprites[0]._costumeSpecs[0].name).toBe('costume1');
  expect(sprites[0]._soundSpecs[0].name).toBe('miaou');

  const chat = new VakarSprite({ id: 'chat', name: 'Chat', x: 0, y: 0, direction: 90, workspace: sprites[0].workspace });
  const receveur = new VakarSprite({ id: 'recv', name: 'Receveur', x: -50, y: 0, direction: 90, workspace: sprites[1].workspace });
  const rt = new VakarBlockRuntime({
    sprites: new Map([[chat.id, chat], [receveur.id, receveur]]),
    onRender: () => {},
    onError: (e) => { throw e; },
  });

  for (const [sprite, data] of [[chat, sprites[0]], [receveur, sprites[1]]]) {
    const ws = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(data.workspace, ws);
    rt.compileSprite(sprite, ws);
    ws.dispose();
  }

  await runAndWait(rt);

  // move 10, then repeat 3x turn 15° => direction 90+45=135
  expect(chat.x).toBeCloseTo(10);
  expect(chat.direction).toBe(135);
  // if (5 > 1) => show, not hide
  expect(chat.visible).toBe(true);
  // variable set to 5
  expect(chat.vars.score).toBe(5);
  // broadcast "go" reached the other sprite's "when I receive" script
  // (starts at x:-50, moves 7 steps at direction 90 → -43)
  expect(receveur.x).toBeCloseTo(-43);

  rt.destroy();
});

test('sb3 export: re-exporting an imported workspace round-trips through import again', async () => {
  const { sprites } = buildProjectFromSb3(scratchProject());
  const warnings = new Set();
  const exported = exportSpriteWorkspace(sprites[0].workspace, warnings);

  expect(Array.from(warnings)).toEqual([]);
  const opcodes = Object.values(exported.blocks).map((b) => b.opcode);
  expect(opcodes).toEqual(expect.arrayContaining([
    'event_whenflagclicked', 'motion_movesteps', 'control_repeat', 'motion_turnright',
    'control_if_else', 'operator_gt', 'data_setvariableto', 'event_broadcast',
  ]));
  const hat = Object.values(exported.blocks).find((b) => b.opcode === 'event_whenflagclicked');
  expect(hat.topLevel).toBe(true);

  // Round-trip: feed the exported blocks back through the importer and
  // confirm it still compiles and runs with the same result.
  const reimported = buildProjectFromSb3({
    targets: [{ isStage: false, name: 'Chat2', variables: { var1: ['score', 0] }, lists: {}, blocks: exported.blocks, costumes: [], sounds: [], currentCostume: 0 }],
  });
  expect(reimported.warnings).toEqual([]);

  const sprite = new VakarSprite({ id: 's1', name: 'Chat2', x: 0, y: 0, direction: 90, workspace: reimported.sprites[0].workspace });
  const rt = new VakarBlockRuntime({ sprites: new Map([[sprite.id, sprite]]), onRender: () => {}, onError: (e) => { throw e; } });
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(reimported.sprites[0].workspace, ws);
  rt.compileSprite(sprite, ws);
  ws.dispose();

  await runAndWait(rt);
  expect(sprite.x).toBeCloseTo(10);
  expect(sprite.direction).toBe(135);
  expect(sprite.vars.score).toBe(5);

  rt.destroy();
});
