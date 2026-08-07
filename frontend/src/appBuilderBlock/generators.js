import * as Blockly from 'blockly/core';
import { javascriptGenerator, Order } from 'blockly/javascript';
import './blocks';

// ============================================================
// APP BUILDER BLOCKS — JS code generators for the ab_* blocks in blocks.js,
// plus compileTrigger()/compileTriggerSource() which turn a saved workspace
// into runnable code.
//
// Unlike Vakar Block (frontend/src/vakarBlock/generators.js), which compiles
// every hat block to a JS *generator* function driven by a
// requestAnimationFrame scheduler (needed because Scratch scripts run
// indefinitely and concurrently), App Builder triggers are one-shot event
// handlers (a button's onClick, a toggle's onChange, a list row's tap) —
// there's no per-frame loop and no concurrent scripts sharing state, so
// compiled code is a plain `async function`, and `ab_wait` compiles to a
// real `await`. No yield/generator scheduler needed here.
// ============================================================

const forBlock = javascriptGenerator.forBlock;

function fieldStr(block, name) {
  return JSON.stringify(block.getFieldValue(name) || '');
}

// ---------- Variables ----------
forBlock['ab_get_variable'] = function (block) {
  return [`(vars[${fieldStr(block, 'VAR')}] ?? '')`, Order.FUNCTION_CALL];
};
forBlock['ab_set_variable'] = function (block, generator) {
  const value = generator.valueToCode(block, 'VALUE', Order.NONE) || "''";
  return `setVar(${fieldStr(block, 'VAR')}, ${value});\n`;
};
forBlock['ab_change_variable'] = function (block, generator) {
  const name = fieldStr(block, 'VAR');
  const delta = generator.valueToCode(block, 'DELTA', Order.NONE) || '0';
  return `setVar(${name}, String((Number(vars[${name}]) || 0) + (Number(${delta}) || 0)));\n`;
};
forBlock['ab_toggle_variable'] = function (block) {
  const name = fieldStr(block, 'VAR');
  return `setVar(${name}, (vars[${name}] === 'true' ? 'false' : 'true'));\n`;
};
forBlock['ab_reset_variables'] = function () {
  return 'helpers.resetVariables(setVar);\n';
};

// ---------- Navigate ----------
forBlock['ab_navigate'] = function (block) {
  return `helpers.navigate(${fieldStr(block, 'SCREEN')});\n`;
};

// ---------- Random reward ----------
forBlock['ab_random_pick'] = function (block, generator) {
  const dupAmount = generator.valueToCode(block, 'DUP_AMOUNT', Order.NONE) || '1';
  return `helpers.randomPick(vars, setVar, ${fieldStr(block, 'OPTIONS_VAR')}, ${fieldStr(block, 'TARGET_VAR')}, ${fieldStr(block, 'COLLECTION_VAR')}, ${fieldStr(block, 'DEDUPE_FIELD')}, ${fieldStr(block, 'DUP_VAR')}, ${dupAmount});\n`;
};

// ---------- Elements ----------
forBlock['ab_update_text'] = function (block, generator) {
  const value = generator.valueToCode(block, 'VALUE', Order.NONE) || "''";
  return `helpers.updateText(${fieldStr(block, 'TARGET')}, ${value});\n`;
};
forBlock['ab_set_visibility'] = function (block) {
  return `helpers.setVisibility(${fieldStr(block, 'TARGET')}, ${fieldStr(block, 'MODE')});\n`;
};

// ---------- Lists ----------
forBlock['ab_list_add'] = function (block, generator) {
  const value = generator.valueToCode(block, 'VALUE', Order.NONE) || "''";
  const index = generator.valueToCode(block, 'INDEX', Order.NONE) || '0';
  return `helpers.listAdd(vars, setVar, ${fieldStr(block, 'LIST_VAR')}, ${value}, ${fieldStr(block, 'MODE')}, ${index});\n`;
};
forBlock['ab_list_remove'] = function (block, generator) {
  const index = generator.valueToCode(block, 'INDEX', Order.NONE) || '0';
  return `helpers.listRemove(vars, setVar, ${fieldStr(block, 'LIST_VAR')}, ${fieldStr(block, 'MODE')}, ${index});\n`;
};
forBlock['ab_list_contains'] = function (block, generator) {
  const value = generator.valueToCode(block, 'VALUE', Order.NONE) || "''";
  return [`helpers.listContains(vars, ${fieldStr(block, 'LIST_VAR')}, ${value}, ${fieldStr(block, 'FIELD')})`, Order.FUNCTION_CALL];
};

// ---------- Feedback & Device ----------
forBlock['ab_show_message'] = function (block, generator) {
  const text = generator.valueToCode(block, 'TEXT', Order.NONE) || "''";
  return `helpers.showMessage(${text});\n`;
};
forBlock['ab_copy_to_clipboard'] = function (block, generator) {
  const text = generator.valueToCode(block, 'TEXT', Order.NONE) || "''";
  return `helpers.copyToClipboard(${text});\n`;
};
forBlock['ab_vibrate'] = function (block, generator) {
  const duration = generator.valueToCode(block, 'DURATION', Order.NONE) || '200';
  return `helpers.vibrate(${duration});\n`;
};
forBlock['ab_wait'] = function (block, generator) {
  const duration = generator.valueToCode(block, 'DURATION', Order.NONE) || '0';
  return `await helpers.wait(${duration});\n`;
};
forBlock['ab_elapsed_seconds'] = function (block) {
  return [`helpers.elapsedSeconds(vars, ${fieldStr(block, 'SINCE_VAR')})`, Order.FUNCTION_CALL];
};
forBlock['ab_mark_time'] = function (block) {
  return `helpers.markTime(setVar, ${fieldStr(block, 'VAR')});\n`;
};

// ---------- Links ----------
forBlock['ab_open_link'] = function (block, generator) {
  const url = generator.valueToCode(block, 'URL', Order.NONE) || "''";
  const newTab = JSON.stringify(block.getFieldValue('NEW_TAB') === 'TRUE');
  return `helpers.openLink(${url}, ${newTab});\n`;
};

// ---------- This item (list row tap scope) ----------
forBlock['ab_item'] = function () {
  return ["(scope && Object.prototype.hasOwnProperty.call(scope, 'item') ? scope.item : '')", Order.NONE];
};
forBlock['ab_item_field'] = function (block) {
  const field = fieldStr(block, 'FIELD');
  return [`((scope && scope.item && scope.item[${field}] !== undefined) ? scope.item[${field}] : '')`, Order.NONE];
};
forBlock['ab_item_index'] = function () {
  return ["(scope && scope.index !== undefined ? scope.index : 0)", Order.NONE];
};

// ---------- Legacy-migration compatibility bridge ----------
forBlock['ab_legacy_text'] = function (block) {
  return [`helpers.interpolate(${fieldStr(block, 'TEMPLATE')}, vars, scope)`, Order.FUNCTION_CALL];
};

// ============================================================
// Compile a saved Blockly workspace (Blockly.serialization.workspaces.save
// output) into either a callable async function (live editor/runtime) or
// its raw source text (static export — see exportApp.js). Both load the
// JSON into a throwaway headless workspace (compile-only, never rendered),
// walk its top-level blocks in canvas order (independent stacks execute
// top-to-bottom — there's no "hat" block needed to mark an entry point,
// unlike Vakar Block, since which trigger this workspace belongs to is
// already implied by which inspector panel/list saved it), and concatenate
// their generated code.
//
// `javascriptGenerator.finish('')` must run AFTER every blockToCode() call,
// not per-block — some stock generators (and potentially future ab_*
// helpers) emit a shared helper function lazily, collected once across the
// whole compile pass. Getting this order wrong is exactly the bug Vakar
// Block's own runtime.js documents hitting with math_random_int (see its
// compileSprite() comment) — same fix applied here preemptively.
// ============================================================
function generateBody(workspaceJson) {
  if (!workspaceJson) return '';
  const ws = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(workspaceJson, ws);
    javascriptGenerator.init(ws);
    const pieces = [];
    for (const block of ws.getTopBlocks(true)) {
      const raw = javascriptGenerator.blockToCode(block);
      pieces.push(Array.isArray(raw) ? raw[0] : raw);
    }
    const helperDefs = javascriptGenerator.finish('');
    return helperDefs + pieces.join('');
  } finally {
    ws.dispose();
  }
}

// Live editor preview + public runtime: a callable `async (vars, setVar,
// scope, helpers) => {...}`. Returns null for an empty/missing workspace —
// callers treat that as a no-op trigger.
export function compileTrigger(workspaceJson) {
  const body = generateBody(workspaceJson);
  if (!body.trim()) return null;
  // eslint-disable-next-line no-new-func
  const factory = new Function(`return async function (vars, setVar, scope, helpers) {\n${body}\n}`);
  return factory();
}

// Static export (exportApp.js): the same body as literal source text, so it
// can be embedded as a named function declaration directly in the generated
// script.js instead of going through `new Function` at export-open time.
export function compileTriggerSource(workspaceJson) {
  return generateBody(workspaceJson);
}

export { javascriptGenerator, Order };
