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

// Like runAndWait, but waits across every animation frame until every
// thread has actually finished — needed once a script contains a loop that
// yields more than once (e.g. controls_whileUntil, see generators.js's
// override), where a single frame only advances it by one iteration.
async function runToCompletion(rt) {
  rt.greenFlag();
  while (rt.running) {
    await new Promise((resolve) => { rt.onRender = resolve; });
  }
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

// Round 9 additions: custom procedures, "repeat until", the motion/looks
// opcodes added while investigating the real game/1.0.0.sb3 bug report, and
// the third-party SkyHigh173 JSON extension. Same hand-crafted-but-real-
// shaped fixture discipline as above.
function proceduresAndMotionProject() {
  return {
    targets: [
      { isStage: true, name: 'Stage', variables: {}, lists: {}, broadcasts: {}, blocks: {}, costumes: [], sounds: [], currentCostume: 0 },
      {
        // No layer effect on this sprite — it just needs to exist so the
        // "go to back" test has something to be behind.
        isStage: false, name: 'Other', variables: {}, lists: {}, blocks: {},
        x: 0, y: 0, direction: 90, size: 100, visible: true, currentCostume: 0, costumes: [], sounds: [],
      },
      {
        isStage: false, name: 'Worker', variables: { v2: ['costNum', 0] }, lists: {},
        x: 0, y: 0, direction: 90, size: 100, visible: true, currentCostume: 0, costumes: [], sounds: [],
        blocks: {
          // définir "ajouter_cinq" — a param-less custom block, its own
          // top-level script, body chained via `.next` like a hat.
          procDef1: { opcode: 'procedures_definition', next: 'bodyChange1', parent: null, inputs: { custom_block: [1, 'proto1'] }, fields: {}, topLevel: true, x: -200, y: 0 },
          proto1: {
            opcode: 'procedures_prototype', next: null, parent: 'procDef1', inputs: {}, fields: {}, shadow: true,
            mutation: { tagName: 'mutation', children: [], proccode: 'ajouter_cinq', argumentnames: '[]', argumentids: '[]', argumentdefaults: '[]', warp: 'false' },
          },
          bodyChange1: { opcode: 'motion_changexby', next: null, parent: 'procDef1', inputs: { DX: [1, 'num5'] }, fields: {} },
          num5: { opcode: 'math_number', next: null, parent: 'bodyChange1', inputs: {}, fields: { NUM: ['5', null] }, shadow: true },

          hat1: { opcode: 'event_whenflagclicked', next: 'call1', parent: null, inputs: {}, fields: {}, topLevel: true, x: 0, y: 0 },
          call1: {
            opcode: 'procedures_call', next: 'repeatUntil1', parent: 'hat1', inputs: {}, fields: {},
            mutation: { tagName: 'mutation', children: [], proccode: 'ajouter_cinq', argumentids: '[]', warp: 'false' },
          },
          repeatUntil1: { opcode: 'control_repeat_until', next: 'point1', parent: 'call1', inputs: { CONDITION: [2, 'cmp1'], SUBSTACK: [2, 'changeInLoop'] }, fields: {} },
          cmp1: { opcode: 'operator_gt', next: null, parent: 'repeatUntil1', inputs: { OPERAND1: [3, 'xpos1'], OPERAND2: [1, 'num7'] }, fields: {} },
          xpos1: { opcode: 'motion_xposition', next: null, parent: 'cmp1', inputs: {}, fields: {} },
          num7: { opcode: 'math_number', next: null, parent: 'cmp1', inputs: {}, fields: { NUM: ['7', null] }, shadow: true },
          changeInLoop: { opcode: 'motion_changexby', next: null, parent: 'repeatUntil1', inputs: { DX: [1, 'num1'] }, fields: {} },
          num1: { opcode: 'math_number', next: null, parent: 'changeInLoop', inputs: {}, fields: { NUM: ['1', null] }, shadow: true },
          point1: { opcode: 'motion_pointindirection', next: 'rotstyle1', parent: 'repeatUntil1', inputs: { DIRECTION: [1, 'num45'] }, fields: {} },
          num45: { opcode: 'math_number', next: null, parent: 'point1', inputs: {}, fields: { NUM: ['45', null] }, shadow: true },
          rotstyle1: { opcode: 'motion_setrotationstyle', next: 'front1', parent: 'point1', inputs: {}, fields: { STYLE: ['left-right', null] } },
          front1: { opcode: 'looks_gotofrontback', next: 'ghost1', parent: 'rotstyle1', inputs: {}, fields: { FRONT_BACK: ['back', null] } },
          ghost1: { opcode: 'looks_seteffectto', next: 'ghost2', parent: 'front1', inputs: { VALUE: [1, 'num30'] }, fields: { EFFECT: ['GHOST', null] } },
          num30: { opcode: 'math_number', next: null, parent: 'ghost1', inputs: {}, fields: { NUM: ['30', null] }, shadow: true },
          ghost2: { opcode: 'looks_changeeffectby', next: 'setCostNum', parent: 'ghost1', inputs: { CHANGE: [1, 'num10'] }, fields: { EFFECT: ['GHOST', null] } },
          num10: { opcode: 'math_number', next: null, parent: 'ghost2', inputs: {}, fields: { NUM: ['10', null] }, shadow: true },
          setCostNum: { opcode: 'data_setvariableto', next: null, parent: 'ghost2', inputs: { VALUE: [3, 'costnum1'] }, fields: { VARIABLE: ['costNum', 'v2'] } },
          costnum1: { opcode: 'looks_costumenumbername', next: null, parent: 'setCostNum', inputs: {}, fields: { NUMBER_NAME: ['number', null] } },
        },
      },
    ],
  };
}

test('sb3 import: custom procedures, "repeat until", and motion/looks additions compile and run correctly', async () => {
  const { sprites, warnings } = buildProjectFromSb3(proceduresAndMotionProject());
  expect(warnings).toEqual([]);
  expect(sprites.length).toBe(2);

  const other = new VakarSprite({ id: 'other', name: 'Other', x: 0, y: 0, direction: 90, workspace: sprites[0].workspace });
  const worker = new VakarSprite({ id: 'worker', name: 'Worker', x: 0, y: 0, direction: 90, workspace: sprites[1].workspace });
  const rt = new VakarBlockRuntime({ sprites: new Map([[other.id, other], [worker.id, worker]]), onRender: () => {}, onError: (e) => { throw e; } });
  for (const [sprite, data] of [[other, sprites[0]], [worker, sprites[1]]]) {
    const ws = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(data.workspace, ws);
    rt.compileSprite(sprite, ws);
    ws.dispose();
  }

  await runToCompletion(rt);

  // proc call (+5) then repeat-until x>7, +1 each pass => 5,6,7,8, stop at 8
  expect(worker.x).toBeCloseTo(8);
  expect(worker.direction).toBe(45);
  expect(worker.rotationStyle).toBe('left-right');
  expect(worker.layer).toBeLessThan(other.layer); // "aller derrière"
  expect(worker.effects.GHOST).toBe(40); // 30 then +10
  expect(worker.vars.costNum).toBe(0); // no costumes on this sprite

  rt.destroy();
});

test('sb3 export: procedures, repeat-until (both modes), and motion/looks additions round-trip through import again', async () => {
  const { sprites } = buildProjectFromSb3(proceduresAndMotionProject());
  const warnings = new Set();
  const exported = exportSpriteWorkspace(sprites[1].workspace, warnings); // "Worker"
  expect(Array.from(warnings)).toEqual([]);

  const opcodes = Object.values(exported.blocks).map((b) => b.opcode);
  expect(opcodes).toEqual(expect.arrayContaining([
    'procedures_definition', 'procedures_prototype', 'procedures_call',
    'control_repeat_until', 'motion_changexby', 'motion_pointindirection',
    'motion_setrotationstyle', 'looks_gotofrontback', 'looks_seteffectto',
    'looks_changeeffectby', 'looks_costumenumbername',
  ]));
  const def = Object.values(exported.blocks).find((b) => b.opcode === 'procedures_definition');
  expect(def.topLevel).toBe(true);
  expect(def.next).toBeTruthy(); // body chained via `.next`, not a nested input

  const reimported = buildProjectFromSb3({
    targets: [{ isStage: false, name: 'Worker2', variables: { v2: ['costNum', 0] }, lists: {}, blocks: exported.blocks, costumes: [], sounds: [], currentCostume: 0 }],
  });
  expect(reimported.warnings).toEqual([]);

  const other = new VakarSprite({ id: 'other2', name: 'Other2', x: 0, y: 0, direction: 90 });
  const worker = new VakarSprite({ id: 'worker2', name: 'Worker2', x: 0, y: 0, direction: 90, workspace: reimported.sprites[0].workspace });
  const rt = new VakarBlockRuntime({ sprites: new Map([[other.id, other], [worker.id, worker]]), onRender: () => {}, onError: (e) => { throw e; } });
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(reimported.sprites[0].workspace, ws);
  rt.compileSprite(worker, ws);
  ws.dispose();

  await runToCompletion(rt);
  expect(worker.x).toBeCloseTo(8);
  expect(worker.direction).toBe(45);
  expect(worker.rotationStyle).toBe('left-right');
  expect(worker.layer).toBeLessThan(other.layer);
  expect(worker.effects.GHOST).toBe(40);

  rt.destroy();
});

test('sb3 export: a native "repeat while" block (no direct Scratch opcode) round-trips via a NOT-wrapped "repeat until"', async () => {
  // Built directly with Blockly APIs (not via sb3 import) since "repeat
  // while" only exists as a Vakar Block native convenience — Scratch itself
  // has no such opcode, only "repeat until" (see controls_whileUntil's
  // export handler in sb3.js).
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('vk_when_green_flag');
  const loop = ws.newBlock('controls_whileUntil');
  loop.setFieldValue('WHILE', 'MODE');
  const cond = ws.newBlock('logic_compare');
  cond.setFieldValue('LT', 'OP');
  const xpos = ws.newBlock('vk_x_position');
  const five = ws.newBlock('math_number');
  five.setFieldValue('5', 'NUM');
  xpos.outputConnection.connect(cond.getInput('A').connection);
  five.outputConnection.connect(cond.getInput('B').connection);
  cond.outputConnection.connect(loop.getInput('BOOL').connection);
  const step = ws.newBlock('vk_change_x_by');
  const one = ws.newBlock('math_number');
  one.setFieldValue('1', 'NUM');
  one.outputConnection.connect(step.getInput('DX').connection);
  loop.getInput('DO').connection.connect(step.previousConnection);
  hat.nextConnection.connect(loop.previousConnection);

  const warnings = new Set();
  const workspaceState = Blockly.serialization.workspaces.save(ws);
  ws.dispose();
  const exported = exportSpriteWorkspace(workspaceState, warnings);
  expect(Array.from(warnings)).toEqual([]);
  const repeatBlock = Object.values(exported.blocks).find((b) => b.opcode === 'control_repeat_until');
  expect(repeatBlock).toBeTruthy();
  const notBlock = Object.values(exported.blocks).find((b) => b.opcode === 'operator_not');
  expect(notBlock).toBeTruthy(); // "while x<5" exported as "until not(x<5)"

  const reimported = buildProjectFromSb3({
    targets: [{ isStage: false, name: 'W', variables: {}, lists: {}, blocks: exported.blocks, costumes: [], sounds: [], currentCostume: 0 }],
  });
  expect(reimported.warnings).toEqual([]);

  const sprite = new VakarSprite({ id: 'w', name: 'W', x: 0, y: 0, direction: 90, workspace: reimported.sprites[0].workspace });
  const rt = new VakarBlockRuntime({ sprites: new Map([[sprite.id, sprite]]), onRender: () => {}, onError: (e) => { throw e; } });
  const ws2 = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(reimported.sprites[0].workspace, ws2);
  rt.compileSprite(sprite, ws2);
  ws2.dispose();

  await runToCompletion(rt);
  // "repeat while x<5, +1 each pass" => 1,2,3,4,5 — stops once x is no longer < 5
  expect(sprite.x).toBeCloseTo(5);

  rt.destroy();
});

// Shapes taken directly from the real game/1.0.0.sb3 file (see round 9's
// memory notes) — every vakargames_* argument is a VALUE input, never a
// `fields` entry, even though it's almost always a plain literal.
function vakargamesProject() {
  return {
    targets: [
      { isStage: true, name: 'Stage', variables: {}, lists: {}, broadcasts: {}, blocks: {}, costumes: [], sounds: [], currentCostume: 0 },
      {
        isStage: false, name: 'items', variables: { v1: ['sauvegarde', 0] }, lists: {},
        x: 0, y: 0, direction: 90, size: 100, visible: true, currentCostume: 0, costumes: [], sounds: [],
        blocks: {
          hat1: { opcode: 'event_whenflagclicked', next: 'cfg1', parent: null, inputs: {}, fields: {}, topLevel: true, x: 0, y: 0 },
          cfg1: { opcode: 'vakargames_configureFiles', next: 'ver1', parent: 'hat1', inputs: { SLUG: [1, [10, 'survivor']], KEY: [1, [10, 'secret-key']] }, fields: {} },
          ver1: { opcode: 'vakargames_useVersion', next: 'load1', parent: 'cfg1', inputs: { V: [1, [10, '1.0']] }, fields: {} },
          load1: { opcode: 'vakargames_loadCostumeById', next: 'rm1', parent: 'ver1', inputs: { LABEL: [1, [10, 'nail']], ID: [1, [10, 'file123']], SPRITE: [1, [10, 'items']] }, fields: {} },
          rm1: { opcode: 'vakargames_removeAllCostumes', next: 'txt1', parent: 'load1', inputs: { SPRITE: [1, [10, 'items']] }, fields: {} },
          txt1: {
            opcode: 'vakargames_afficherTexte', next: 'vis1', parent: 'rm1',
            inputs: {
              ID: [1, [10, 'shop_label']], TEXTE: [1, [10, 'No Offers.']], X: [1, [4, '0']], Y: [1, [4, '0']],
              POLICE: [1, [10, 'Arial']], TAILLE: [1, [4, '20']], COULEUR: [1, [10, '#FFFFFF']],
              GRAS: [1, 'gras1'], ITALIQUE: [1, 'ita1'], VISIBLE: [1, 'vis1menu'],
            },
            fields: {},
          },
          gras1: { opcode: 'vakargames_menu_ouiNon', next: null, parent: 'txt1', inputs: {}, fields: { ouiNon: ['non', null] }, shadow: true },
          ita1: { opcode: 'vakargames_menu_ouiNon', next: null, parent: 'txt1', inputs: {}, fields: { ouiNon: ['non', null] }, shadow: true },
          vis1menu: { opcode: 'vakargames_menu_ouiNon', next: null, parent: 'txt1', inputs: {}, fields: { ouiNon: ['oui', null] }, shadow: true },
          vis1: { opcode: 'vakargames_changerVisibiliteTexte', next: 'playcfg1', parent: 'txt1', inputs: { ID: [1, [10, 'shop_label']], VISIBLE: [1, 'vis2menu'] }, fields: {} },
          vis2menu: { opcode: 'vakargames_menu_ouiNon', next: null, parent: 'vis1', inputs: {}, fields: { ouiNon: ['non', null] }, shadow: true },
          playcfg1: { opcode: 'vakargames_playConfigurer', next: 'login1', parent: 'vis1', inputs: { SLUG: [1, [10, 'survivor']] }, fields: {} },
          login1: { opcode: 'vakargames_playAfficherConnexion', next: 'connected1', parent: 'playcfg1', inputs: {}, fields: {} },
          connected1: { opcode: 'vakargames_playEstConnecte', next: null, parent: 'login1', inputs: {}, fields: {} },
          save1: {
            opcode: 'vakargames_playSauvegarder', next: 'load2', parent: null, topLevel: true, x: 100, y: 100,
            inputs: { CATEGORIE: [1, [10, 'stats']], DONNEES: [1, [10, '{"coins":5}']] }, fields: {},
          },
          load2: { opcode: 'data_setvariableto', next: 'discon1', parent: 'save1', inputs: { VALUE: [3, 'charger1'] }, fields: { VARIABLE: ['sauvegarde', 'v1'] } },
          charger1: { opcode: 'vakargames_playCharger', next: null, parent: 'load2', inputs: { CATEGORIE: [1, [10, 'stats']] }, fields: {} },
          discon1: { opcode: 'vakargames_playDeconnecter', next: 'loading1', parent: 'load2', inputs: {}, fields: {} },
          loading1: { opcode: 'vakargames_playOuvrirChargement', next: 'closeloading1', parent: 'discon1', inputs: { MAX: [1, [4, '15']] }, fields: {} },
          closeloading1: { opcode: 'vakargames_playFermerChargement', next: null, parent: 'loading1', inputs: {}, fields: {} },
        },
      },
    ],
  };
}

test('sb3 import: all vakargames_* opcodes translate to real Vakar Block blocks with correct argument values', () => {
  const { sprites, warnings } = buildProjectFromSb3(vakargamesProject());
  expect(warnings).toEqual([]);

  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(sprites[0].workspace, ws);
  const byType = (type) => ws.getAllBlocks(false).find((b) => b.type === type);

  expect(byType('vk_vg_configure_files').getFieldValue('SLUG')).toBe('survivor');
  expect(byType('vk_vg_configure_files').getFieldValue('KEY')).toBe('secret-key');
  expect(byType('vk_vg_use_version').getFieldValue('V')).toBe('1.0');
  expect(byType('vk_vg_load_costume_by_id').getFieldValue('ID')).toBe('file123');
  expect(byType('vk_vg_load_costume_by_id').getFieldValue('SPRITE')).toBe('items');
  expect(byType('vk_vg_remove_all_costumes').getFieldValue('SPRITE')).toBe('items');
  expect(byType('vk_vg_show_text').getFieldValue('ID')).toBe('shop_label');
  expect(byType('vk_vg_show_text').getFieldValue('GRAS')).toBe('non');
  expect(byType('vk_vg_show_text').getFieldValue('VISIBLE')).toBe('oui'); // extracted from the vakargames_menu_ouiNon shadow
  expect(byType('vk_vg_set_text_visible').getFieldValue('VISIBLE')).toBe('non');
  expect(byType('vk_vg_play_configure').getFieldValue('SLUG')).toBe('survivor');
  expect(byType('vk_vg_play_show_login')).toBeTruthy();
  expect(byType('vk_vg_play_is_connected')).toBeTruthy();
  expect(byType('vk_vg_play_save').getFieldValue('CATEGORIE')).toBe('stats');
  expect(byType('vk_vg_play_disconnect')).toBeTruthy();
  expect(byType('vk_vg_play_open_loading')).toBeTruthy();
  expect(byType('vk_vg_play_close_loading')).toBeTruthy();

  // The REPORTER→COMMAND special case: "mettre sauvegarde à (charger stats)"
  // becomes "charger stats dans la variable sauvegarde" directly, not a
  // variables_set wrapping a reporter.
  const loadBlock = byType('vk_vg_play_load');
  expect(loadBlock).toBeTruthy();
  expect(loadBlock.getFieldValue('CATEGORIE')).toBe('stats');
  expect(loadBlock.getFieldValue('VAR')).toBe('sauvegarde');
  expect(byType('variables_set')).toBeUndefined(); // confirms it did NOT fall through to the generic path

  ws.dispose();
});

test('sb3 export: vakargames_* blocks round-trip through import again with the same values (incl. the play_load reporter-shape reversal)', () => {
  const { sprites } = buildProjectFromSb3(vakargamesProject());
  const warnings = new Set();
  const exported = exportSpriteWorkspace(sprites[0].workspace, warnings);
  expect(Array.from(warnings)).toEqual([]);

  const opcodes = Object.values(exported.blocks).map((b) => b.opcode);
  expect(opcodes).toEqual(expect.arrayContaining([
    'vakargames_configureFiles', 'vakargames_useVersion', 'vakargames_loadCostumeById',
    'vakargames_removeAllCostumes', 'vakargames_afficherTexte', 'vakargames_changerVisibiliteTexte',
    'vakargames_playConfigurer', 'vakargames_playAfficherConnexion', 'vakargames_playEstConnecte',
    'vakargames_playSauvegarder', 'vakargames_playCharger', 'vakargames_playDeconnecter',
    'vakargames_playOuvrirChargement', 'vakargames_playFermerChargement', 'data_setvariableto',
  ]));

  const reimported = buildProjectFromSb3({
    targets: [{ isStage: false, name: 'items2', variables: { v1: ['sauvegarde', 0] }, lists: {}, blocks: exported.blocks, costumes: [], sounds: [], currentCostume: 0 }],
  });
  expect(reimported.warnings).toEqual([]);
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(reimported.sprites[0].workspace, ws);
  const byType = (type) => ws.getAllBlocks(false).find((b) => b.type === type);
  expect(byType('vk_vg_configure_files').getFieldValue('SLUG')).toBe('survivor');
  expect(byType('vk_vg_play_load').getFieldValue('CATEGORIE')).toBe('stats');
  expect(byType('vk_vg_play_load').getFieldValue('VAR')).toBe('sauvegarde');
  ws.dispose();
});

function jsonExtensionProject() {
  return {
    targets: [
      { isStage: true, name: 'Stage', variables: {}, lists: {}, broadcasts: {}, blocks: {}, costumes: [], sounds: [], currentCostume: 0 },
      {
        isStage: false, name: 'Data', variables: { v1: ['get', 0], v2: ['set', 0], v3: ['pushed', 0], v4: ['keys', 0], v5: ['len', 0] }, lists: {},
        x: 0, y: 0, direction: 90, size: 100, visible: true, currentCostume: 0, costumes: [], sounds: [],
        blocks: {
          hat1: { opcode: 'event_whenflagclicked', next: 'get1', parent: null, inputs: {}, fields: {}, topLevel: true, x: 0, y: 0 },
          get1: { opcode: 'data_setvariableto', next: 'set1', parent: 'hat1', inputs: { VALUE: [3, 'jget1'] }, fields: { VARIABLE: ['get', 'v1'] } },
          jget1: { opcode: 'skyhigh173JSON_json_get', next: null, parent: 'get1', inputs: { json: [1, [10, '{"a":1}']], item: [1, [10, 'a']] }, fields: {} },
          set1: { opcode: 'data_setvariableto', next: 'push1', parent: 'get1', inputs: { VALUE: [3, 'jset1'] }, fields: { VARIABLE: ['set', 'v2'] } },
          jset1: { opcode: 'skyhigh173JSON_json_set', next: null, parent: 'set1', inputs: { json: [1, [10, '{}']], item: [1, [10, 'k']], value: [1, [10, '5']] }, fields: {} },
          push1: { opcode: 'data_setvariableto', next: 'keys1', parent: 'set1', inputs: { VALUE: [3, 'jpush1'] }, fields: { VARIABLE: ['pushed', 'v3'] } },
          jpush1: { opcode: 'skyhigh173JSON_json_array_push', next: null, parent: 'push1', inputs: { json: [1, [10, '[1,2]']], item: [1, [10, '3']] }, fields: {} },
          keys1: { opcode: 'data_setvariableto', next: 'len1', parent: 'push1', inputs: { VALUE: [3, 'jkeys1'] }, fields: { VARIABLE: ['keys', 'v4'] } },
          jkeys1: { opcode: 'skyhigh173JSON_json_get_all', next: null, parent: 'keys1', inputs: { json: [1, [10, '{"x":1,"y":2}']] }, fields: { Stype: ['keys', null] } },
          len1: { opcode: 'data_setvariableto', next: null, parent: 'keys1', inputs: { VALUE: [3, 'jlen1'] }, fields: { VARIABLE: ['len', 'v5'] } },
          jlen1: { opcode: 'skyhigh173JSON_json_length', next: null, parent: 'len1', inputs: { json: [1, [10, '[1,2,3]']] }, fields: {} },
        },
      },
    ],
  };
}

test('sb3 import: the SkyHigh173 JSON extension maps to real, executing JSON blocks', async () => {
  const { sprites, warnings } = buildProjectFromSb3(jsonExtensionProject());
  expect(warnings).toEqual([]);

  const sprite = new VakarSprite({ id: 'data', name: 'Data', workspace: sprites[0].workspace });
  const rt = new VakarBlockRuntime({ sprites: new Map([[sprite.id, sprite]]), onRender: () => {}, onError: (e) => { throw e; } });
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(sprites[0].workspace, ws);
  rt.compileSprite(sprite, ws);
  ws.dispose();

  await runAndWait(rt);

  expect(sprite.vars.get).toBe(1);
  expect(JSON.parse(sprite.vars.set)).toEqual({ k: 5 });
  expect(JSON.parse(sprite.vars.pushed)).toEqual([1, 2, 3]);
  expect(JSON.parse(sprite.vars.keys)).toEqual(['x', 'y']);
  expect(sprite.vars.len).toBe(3);

  rt.destroy();
});
