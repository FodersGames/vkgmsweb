import * as Blockly from 'blockly/core';
import './blocks';
import './generators';

// ============================================================
// VAKAR BLOCK — starter templates. Built programmatically with real
// Blockly APIs (same technique as sb3.js's import builder) rather than
// hand-written JSON, so they're exercised through the exact same
// construction path already proven correct by the round-1/round-6 tests —
// a malformed hand-written JSON blob wouldn't get caught until someone
// actually opened the template in the editor.
// ============================================================

function num(ws, value) {
  const b = ws.newBlock('math_number');
  b.setFieldValue(String(value), 'NUM');
  return b;
}
function connectValue(block, inputName, valueBlock) {
  block.getInput(inputName).connection.connect(valueBlock.outputConnection);
}
function connectStack(...blocks) {
  for (let i = 0; i < blocks.length - 1; i++) blocks[i].nextConnection.connect(blocks[i + 1].previousConnection);
  return blocks[0];
}
function serialize(ws) {
  const state = Blockly.serialization.workspaces.save(ws);
  ws.dispose();
  return state;
}

// ---------- Modèle 1 : Déplacement aux flèches ----------
// Un sprite qu'on déplace avec les 4 flèches — montre les événements
// clavier, les rapporteurs de position (x/y) et les opérateurs.
function moverWorkspace() {
  const ws = new Blockly.Workspace();

  const reset = ws.newBlock('vk_when_green_flag');
  const goHome = ws.newBlock('vk_go_to_xy');
  connectValue(goHome, 'X', num(ws, 0));
  connectValue(goHome, 'Y', num(ws, 0));
  connectStack(reset, goHome);

  function arrowScript(key, dx, dy) {
    const hat = ws.newBlock('vk_when_key_pressed');
    hat.setFieldValue(key, 'KEY');
    const go = ws.newBlock('vk_go_to_xy');
    const xExpr = dx ? ws.newBlock('math_arithmetic') : ws.newBlock('vk_x_position');
    if (dx) {
      xExpr.setFieldValue(dx > 0 ? 'ADD' : 'MINUS', 'OP');
      connectValue(xExpr, 'A', ws.newBlock('vk_x_position'));
      connectValue(xExpr, 'B', num(ws, Math.abs(dx)));
    }
    const yExpr = dy ? ws.newBlock('math_arithmetic') : ws.newBlock('vk_y_position');
    if (dy) {
      yExpr.setFieldValue(dy > 0 ? 'ADD' : 'MINUS', 'OP');
      connectValue(yExpr, 'A', ws.newBlock('vk_y_position'));
      connectValue(yExpr, 'B', num(ws, Math.abs(dy)));
    }
    go.getInput('X').connection.connect(xExpr.outputConnection);
    go.getInput('Y').connection.connect(yExpr.outputConnection);
    connectStack(hat, go);
  }
  arrowScript('up', 0, 10);
  arrowScript('down', 0, -10);
  arrowScript('left', -10, 0);
  arrowScript('right', 10, 0);

  return serialize(ws);
}

// ---------- Modèle 2 : Attraper les points ----------
// Deux sprites : un joueur déplacé au clavier, un point qui tombe et se
// replace en haut à une position aléatoire quand il touche le joueur ou
// sort de l'écran — montre les variables, le hasard, la détection de
// collision et « toujours ».
function playerWorkspace() {
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('vk_when_green_flag');
  const goHome = ws.newBlock('vk_go_to_xy');
  connectValue(goHome, 'X', num(ws, 0));
  connectValue(goHome, 'Y', num(ws, -140));
  const setScore = ws.newBlock('variables_set');
  const scoreVar = ws.getVariableMap().createVariable('score');
  setScore.getField('VAR').setValue(scoreVar.getId());
  connectValue(setScore, 'VALUE', num(ws, 0));
  const forever = ws.newBlock('vk_forever');
  const ifLeft = ws.newBlock('controls_if');
  const leftDown = ws.newBlock('vk_key_down');
  leftDown.setFieldValue('left', 'KEY');
  ifLeft.getInput('IF0').connection.connect(leftDown.outputConnection);
  const goLeft = ws.newBlock('vk_go_to_xy');
  const xMinus = ws.newBlock('math_arithmetic');
  xMinus.setFieldValue('MINUS', 'OP');
  connectValue(xMinus, 'A', ws.newBlock('vk_x_position'));
  connectValue(xMinus, 'B', num(ws, 8));
  goLeft.getInput('X').connection.connect(xMinus.outputConnection);
  connectValue(goLeft, 'Y', ws.newBlock('vk_y_position'));
  ifLeft.getInput('DO0').connection.connect(goLeft.previousConnection);

  const ifRight = ws.newBlock('controls_if');
  const rightDown = ws.newBlock('vk_key_down');
  rightDown.setFieldValue('right', 'KEY');
  ifRight.getInput('IF0').connection.connect(rightDown.outputConnection);
  const goRight = ws.newBlock('vk_go_to_xy');
  const xPlus = ws.newBlock('math_arithmetic');
  xPlus.setFieldValue('ADD', 'OP');
  connectValue(xPlus, 'A', ws.newBlock('vk_x_position'));
  connectValue(xPlus, 'B', num(ws, 8));
  goRight.getInput('X').connection.connect(xPlus.outputConnection);
  connectValue(goRight, 'Y', ws.newBlock('vk_y_position'));
  ifRight.getInput('DO0').connection.connect(goRight.previousConnection);

  connectStack(ifLeft, ifRight);
  forever.getInput('DO').connection.connect(ifLeft.previousConnection);
  connectStack(hat, goHome, setScore, forever);
  return serialize(ws);
}

function fallingPointWorkspace() {
  const ws = new Blockly.Workspace();
  const randX = () => {
    const r = ws.newBlock('math_random_int');
    connectValue(r, 'FROM', num(ws, -200));
    connectValue(r, 'TO', num(ws, 200));
    return r;
  };

  const hat = ws.newBlock('vk_when_green_flag');
  const goStart = ws.newBlock('vk_go_to_xy');
  goStart.getInput('X').connection.connect(randX().outputConnection);
  connectValue(goStart, 'Y', num(ws, 160));

  const forever = ws.newBlock('vk_forever');
  const fall = ws.newBlock('vk_go_to_xy');
  const yMinus = ws.newBlock('math_arithmetic');
  yMinus.setFieldValue('MINUS', 'OP');
  connectValue(yMinus, 'A', ws.newBlock('vk_y_position'));
  connectValue(yMinus, 'B', num(ws, 3));
  connectValue(fall, 'X', ws.newBlock('vk_x_position'));
  fall.getInput('Y').connection.connect(yMinus.outputConnection);

  const ifCaught = ws.newBlock('controls_if');
  const touching = ws.newBlock('vk_touching');
  touching.setFieldValue('Joueur', 'TARGET');
  ifCaught.getInput('IF0').connection.connect(touching.outputConnection);
  const changeScore = ws.newBlock('math_change');
  const scoreVar = ws.getVariableMap().createVariable('score');
  changeScore.getField('VAR').setValue(scoreVar.getId());
  connectValue(changeScore, 'DELTA', num(ws, 1));
  const respawn1 = ws.newBlock('vk_go_to_xy');
  respawn1.getInput('X').connection.connect(randX().outputConnection);
  connectValue(respawn1, 'Y', num(ws, 160));
  connectStack(changeScore, respawn1);
  ifCaught.getInput('DO0').connection.connect(changeScore.previousConnection);

  const ifOffscreen = ws.newBlock('controls_if');
  const cmp = ws.newBlock('logic_compare');
  cmp.setFieldValue('LT', 'OP');
  connectValue(cmp, 'A', ws.newBlock('vk_y_position'));
  connectValue(cmp, 'B', num(ws, -180));
  ifOffscreen.getInput('IF0').connection.connect(cmp.outputConnection);
  const respawn2 = ws.newBlock('vk_go_to_xy');
  respawn2.getInput('X').connection.connect(randX().outputConnection);
  connectValue(respawn2, 'Y', num(ws, 160));
  ifOffscreen.getInput('DO0').connection.connect(respawn2.previousConnection);

  connectStack(fall, ifCaught, ifOffscreen);
  forever.getInput('DO').connection.connect(fall.previousConnection);
  connectStack(hat, goStart, forever);
  return serialize(ws);
}

export const VAKAR_BLOCK_TEMPLATES = [
  {
    id: 'mover',
    label: 'Déplacement aux flèches',
    description: 'Un sprite que tu déplaces avec les flèches du clavier.',
    build: () => ({
      stage: { width: 480, height: 360, backdrops: [], current_backdrop_id: null },
      sprites: [{
        id: 'sprite1', name: 'Sprite1', x: 0, y: 0, direction: 90, size: 100, visible: true,
        costumes: [], current_costume_id: null, sounds: [], workspace: moverWorkspace(),
      }],
    }),
  },
  {
    id: 'catch',
    label: 'Attraper les points',
    description: 'Déplace le joueur pour attraper les points qui tombent — variables, hasard et collisions.',
    build: () => ({
      stage: { width: 480, height: 360, backdrops: [], current_backdrop_id: null },
      sprites: [
        { id: 'joueur', name: 'Joueur', x: 0, y: -140, direction: 90, size: 100, visible: true, costumes: [], current_costume_id: null, sounds: [], workspace: playerWorkspace() },
        { id: 'point', name: 'Point', x: 0, y: 160, direction: 90, size: 50, visible: true, costumes: [], current_costume_id: null, sounds: [], workspace: fallingPointWorkspace() },
      ],
    }),
  },
];
