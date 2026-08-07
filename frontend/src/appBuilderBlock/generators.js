import * as Blockly from 'blockly/core';
import { javascriptGenerator, Order } from 'blockly/javascript';
import { ALL_HAT_TYPES } from './blocks';

// ============================================================
// APP BUILDER BLOCKS — JS code generators for the ab_* blocks in blocks.js,
// plus compileNodeBlocks()/compileNodeBlocksSource() which turn one
// element's saved workspace into a map of {hatType: runnable code} — one
// entry per "when X" hat it contains. Only code chained below a hat block
// is ever compiled/runnable; a floating stack with no hat above it is
// silently never included (same "only what's under a hat runs" rule
// Scratch and MIT App Inventor both use), matching HAT_TYPES below.
//
// Unlike Vakar Block (frontend/src/vakarBlock/generators.js), which compiles
// every hat block to a JS *generator* function driven by a
// requestAnimationFrame scheduler (needed because Scratch scripts run
// indefinitely and concurrently), App Builder triggers are one-shot event
// handlers (a click, a value change, a screen opening) — there's no
// per-frame loop and no concurrent scripts sharing state, so each hat
// compiles to a plain `async function`, and `ab_wait`/`ab_wait_until`
// compile to a real `await`. No yield/generator scheduler needed here.
//
// Pure/stateless blocks (math, text) generate plain inline JS expressions
// directly — no helpers.* call needed. Only blocks that touch `vars`/
// `setVar` or non-trivial browser APIs call into `helpers.*`
// (appBuilderBlock/runtime.js).
// ============================================================

const forBlock = javascriptGenerator.forBlock;

function fieldStr(block, name) {
  return JSON.stringify(block.getFieldValue(name) || '');
}

// ---------- Events (hat blocks contribute no code of their own — the
// statements chained BELOW them are what compileNodeBlocks below actually
// compiles per hat) ----------
forBlock['ab_when_clicked'] = () => '';
forBlock['ab_when_pressed'] = () => '';
forBlock['ab_when_released'] = () => '';
forBlock['ab_when_changed'] = () => '';
forBlock['ab_when_row_tapped'] = () => '';
forBlock['ab_when_screen_opens'] = () => '';

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

// ---------- Math (pure inline expressions, no helpers) ----------
forBlock['ab_random_number'] = function (block, generator) {
  const a = generator.valueToCode(block, 'A', Order.NONE) || '0';
  const b = generator.valueToCode(block, 'B', Order.NONE) || '0';
  return [`(function(){var lo=Math.round(Number(${a})||0),hi=Math.round(Number(${b})||0);if(lo>hi){var t=lo;lo=hi;hi=t;}return Math.floor(Math.random()*(hi-lo+1))+lo;})()`, Order.FUNCTION_CALL];
};
forBlock['ab_round'] = function (block, generator) {
  const num = generator.valueToCode(block, 'NUM', Order.NONE) || '0';
  return [`Math.round(Number(${num}) || 0)`, Order.FUNCTION_CALL];
};
forBlock['ab_round_up'] = function (block, generator) {
  const num = generator.valueToCode(block, 'NUM', Order.NONE) || '0';
  return [`Math.ceil(Number(${num}) || 0)`, Order.FUNCTION_CALL];
};
forBlock['ab_round_down'] = function (block, generator) {
  const num = generator.valueToCode(block, 'NUM', Order.NONE) || '0';
  return [`Math.floor(Number(${num}) || 0)`, Order.FUNCTION_CALL];
};
forBlock['ab_abs'] = function (block, generator) {
  const num = generator.valueToCode(block, 'NUM', Order.NONE) || '0';
  return [`Math.abs(Number(${num}) || 0)`, Order.FUNCTION_CALL];
};
forBlock['ab_min'] = function (block, generator) {
  const a = generator.valueToCode(block, 'A', Order.NONE) || '0';
  const b = generator.valueToCode(block, 'B', Order.NONE) || '0';
  return [`Math.min(Number(${a}) || 0, Number(${b}) || 0)`, Order.FUNCTION_CALL];
};
forBlock['ab_max'] = function (block, generator) {
  const a = generator.valueToCode(block, 'A', Order.NONE) || '0';
  const b = generator.valueToCode(block, 'B', Order.NONE) || '0';
  return [`Math.max(Number(${a}) || 0, Number(${b}) || 0)`, Order.FUNCTION_CALL];
};
forBlock['ab_sqrt'] = function (block, generator) {
  const num = generator.valueToCode(block, 'NUM', Order.NONE) || '0';
  return [`Math.sqrt(Number(${num}) || 0)`, Order.FUNCTION_CALL];
};
forBlock['ab_power'] = function (block, generator) {
  const a = generator.valueToCode(block, 'A', Order.NONE) || '0';
  const b = generator.valueToCode(block, 'B', Order.NONE) || '0';
  return [`Math.pow(Number(${a}) || 0, Number(${b}) || 0)`, Order.FUNCTION_CALL];
};
forBlock['ab_modulo'] = function (block, generator) {
  const a = generator.valueToCode(block, 'A', Order.NONE) || '0';
  const b = generator.valueToCode(block, 'B', Order.NONE) || '1';
  return [`((Number(${a}) || 0) % (Number(${b}) || 1))`, Order.NONE];
};
forBlock['ab_is_number'] = function (block, generator) {
  const value = generator.valueToCode(block, 'VALUE', Order.NONE) || "''";
  return [`(${value} !== '' && !isNaN(Number(${value})))`, Order.NONE];
};
forBlock['ab_text_to_number'] = function (block, generator) {
  const text = generator.valueToCode(block, 'TEXT', Order.NONE) || "''";
  return [`(Number(${text}) || 0)`, Order.NONE];
};

// ---------- Text (pure inline expressions, no helpers) ----------
forBlock['ab_text_is_empty'] = function (block, generator) {
  const text = generator.valueToCode(block, 'TEXT', Order.NONE) || "''";
  return [`(String(${text}).length === 0)`, Order.NONE];
};
forBlock['ab_text_contains'] = function (block, generator) {
  const text = generator.valueToCode(block, 'TEXT', Order.NONE) || "''";
  const sub = generator.valueToCode(block, 'SUBSTR', Order.NONE) || "''";
  return [`String(${text}).includes(String(${sub}))`, Order.FUNCTION_CALL];
};
forBlock['ab_text_starts_with'] = function (block, generator) {
  const text = generator.valueToCode(block, 'TEXT', Order.NONE) || "''";
  const sub = generator.valueToCode(block, 'SUBSTR', Order.NONE) || "''";
  return [`String(${text}).startsWith(String(${sub}))`, Order.FUNCTION_CALL];
};
forBlock['ab_text_ends_with'] = function (block, generator) {
  const text = generator.valueToCode(block, 'TEXT', Order.NONE) || "''";
  const sub = generator.valueToCode(block, 'SUBSTR', Order.NONE) || "''";
  return [`String(${text}).endsWith(String(${sub}))`, Order.FUNCTION_CALL];
};
forBlock['ab_text_replace'] = function (block, generator) {
  const find = generator.valueToCode(block, 'FIND', Order.NONE) || "''";
  const replace = generator.valueToCode(block, 'REPLACE', Order.NONE) || "''";
  const text = generator.valueToCode(block, 'TEXT', Order.NONE) || "''";
  return [`String(${text}).split(String(${find})).join(String(${replace}))`, Order.FUNCTION_CALL];
};
forBlock['ab_text_uppercase'] = function (block, generator) {
  const text = generator.valueToCode(block, 'TEXT', Order.NONE) || "''";
  return [`String(${text}).toUpperCase()`, Order.FUNCTION_CALL];
};
forBlock['ab_text_lowercase'] = function (block, generator) {
  const text = generator.valueToCode(block, 'TEXT', Order.NONE) || "''";
  return [`String(${text}).toLowerCase()`, Order.FUNCTION_CALL];
};
forBlock['ab_text_split'] = function (block, generator) {
  const text = generator.valueToCode(block, 'TEXT', Order.NONE) || "''";
  const sep = generator.valueToCode(block, 'SEPARATOR', Order.NONE) || "''";
  return [`JSON.stringify(String(${text}).split(String(${sep})))`, Order.FUNCTION_CALL];
};
forBlock['ab_text_join_list'] = function (block, generator) {
  const sep = generator.valueToCode(block, 'SEPARATOR', Order.NONE) || "''";
  return [`helpers.getList(vars, ${fieldStr(block, 'LIST_VAR')}).map(String).join(String(${sep}))`, Order.FUNCTION_CALL];
};
forBlock['ab_text_substring'] = function (block, generator) {
  const start = generator.valueToCode(block, 'START', Order.NONE) || '0';
  const end = generator.valueToCode(block, 'END', Order.NONE) || '0';
  const text = generator.valueToCode(block, 'TEXT', Order.NONE) || "''";
  return [`String(${text}).slice(Number(${start}) || 0, Number(${end}) || 0)`, Order.FUNCTION_CALL];
};

// ---------- Elements ----------
forBlock['ab_update_text'] = function (block, generator) {
  const value = generator.valueToCode(block, 'VALUE', Order.NONE) || "''";
  return `helpers.updateText(${fieldStr(block, 'TARGET')}, ${value});\n`;
};
forBlock['ab_show_element'] = function (block) {
  return `helpers.setVisibility(${fieldStr(block, 'TARGET')}, 'show');\n`;
};
forBlock['ab_hide_element'] = function (block) {
  return `helpers.setVisibility(${fieldStr(block, 'TARGET')}, 'hide');\n`;
};
forBlock['ab_toggle_visibility'] = function (block) {
  return `helpers.setVisibility(${fieldStr(block, 'TARGET')}, 'toggle');\n`;
};

// ---------- Lists ----------
forBlock['ab_list_add_last'] = function (block, generator) {
  const value = generator.valueToCode(block, 'VALUE', Order.NONE) || "''";
  return `helpers.listAdd(vars, setVar, ${fieldStr(block, 'LIST_VAR')}, ${value}, 'append', 0);\n`;
};
forBlock['ab_list_add_first'] = function (block, generator) {
  const value = generator.valueToCode(block, 'VALUE', Order.NONE) || "''";
  return `helpers.listAdd(vars, setVar, ${fieldStr(block, 'LIST_VAR')}, ${value}, 'prepend', 0);\n`;
};
forBlock['ab_list_insert_at'] = function (block, generator) {
  const value = generator.valueToCode(block, 'VALUE', Order.NONE) || "''";
  const index = generator.valueToCode(block, 'INDEX', Order.NONE) || '0';
  return `helpers.listAdd(vars, setVar, ${fieldStr(block, 'LIST_VAR')}, ${value}, 'at_index', ${index});\n`;
};
forBlock['ab_list_remove_first'] = function (block) {
  return `helpers.listRemove(vars, setVar, ${fieldStr(block, 'LIST_VAR')}, 'first', 0);\n`;
};
forBlock['ab_list_remove_last'] = function (block) {
  return `helpers.listRemove(vars, setVar, ${fieldStr(block, 'LIST_VAR')}, 'last', 0);\n`;
};
forBlock['ab_list_remove_at'] = function (block, generator) {
  const index = generator.valueToCode(block, 'INDEX', Order.NONE) || '0';
  return `helpers.listRemove(vars, setVar, ${fieldStr(block, 'LIST_VAR')}, 'at_index', ${index});\n`;
};
forBlock['ab_list_clear'] = function (block) {
  return `helpers.listRemove(vars, setVar, ${fieldStr(block, 'LIST_VAR')}, 'clear', 0);\n`;
};
forBlock['ab_list_contains'] = function (block, generator) {
  const value = generator.valueToCode(block, 'VALUE', Order.NONE) || "''";
  return [`helpers.listContains(vars, ${fieldStr(block, 'LIST_VAR')}, ${value}, ${fieldStr(block, 'FIELD')})`, Order.FUNCTION_CALL];
};
forBlock['ab_list_length'] = function (block) {
  return [`helpers.getList(vars, ${fieldStr(block, 'LIST_VAR')}).length`, Order.MEMBER];
};
forBlock['ab_list_is_empty'] = function (block) {
  return [`(helpers.getList(vars, ${fieldStr(block, 'LIST_VAR')}).length === 0)`, Order.NONE];
};
forBlock['ab_list_item_at'] = function (block, generator) {
  const index = generator.valueToCode(block, 'INDEX', Order.NONE) || '0';
  return [`(helpers.getList(vars, ${fieldStr(block, 'LIST_VAR')})[Number(${index}) || 0] ?? '')`, Order.NONE];
};
forBlock['ab_list_replace_at'] = function (block, generator) {
  const index = generator.valueToCode(block, 'INDEX', Order.NONE) || '0';
  const value = generator.valueToCode(block, 'VALUE', Order.NONE) || "''";
  return `helpers.listReplaceAt(vars, setVar, ${fieldStr(block, 'LIST_VAR')}, ${index}, ${value});\n`;
};
forBlock['ab_list_index_of'] = function (block, generator) {
  const value = generator.valueToCode(block, 'VALUE', Order.NONE) || "''";
  return [`helpers.getList(vars, ${fieldStr(block, 'LIST_VAR')}).findIndex(function (x) { return String(x) === String(${value}); })`, Order.FUNCTION_CALL];
};
forBlock['ab_list_shuffle'] = function (block) {
  return `helpers.listShuffle(vars, setVar, ${fieldStr(block, 'LIST_VAR')});\n`;
};
forBlock['ab_list_reverse'] = function (block) {
  return `helpers.listReverse(vars, setVar, ${fieldStr(block, 'LIST_VAR')});\n`;
};
forBlock['ab_list_sort'] = function (block) {
  return `helpers.listSort(vars, setVar, ${fieldStr(block, 'LIST_VAR')}, ${fieldStr(block, 'MODE')});\n`;
};
forBlock['ab_list_duplicate'] = function (block) {
  return [`JSON.stringify(helpers.getList(vars, ${fieldStr(block, 'LIST_VAR')}))`, Order.FUNCTION_CALL];
};
forBlock['ab_list_create_empty'] = function () {
  return ["'[]'", Order.ATOMIC];
};
forBlock['ab_pick_random'] = function (block) {
  return [`helpers.pickRandom(vars, ${fieldStr(block, 'LIST_VAR')})`, Order.FUNCTION_CALL];
};
forBlock['ab_pick_weighted'] = function (block) {
  return [`helpers.pickWeighted(vars, ${fieldStr(block, 'LIST_VAR')}, ${fieldStr(block, 'FIELD')})`, Order.FUNCTION_CALL];
};
forBlock['ab_json_field'] = function (block, generator) {
  const jsonText = generator.valueToCode(block, 'JSON_TEXT', Order.NONE) || "''";
  const field = fieldStr(block, 'FIELD');
  return [`(function(){try{var o=JSON.parse(${jsonText});return (o&&typeof o==='object')?(o[${field}] ?? ''):'';}catch(e){return '';}})()`, Order.FUNCTION_CALL];
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
forBlock['ab_play_sound'] = function (block, generator) {
  const url = generator.valueToCode(block, 'URL', Order.NONE) || "''";
  return `helpers.playSound(${url});\n`;
};
forBlock['ab_prompt_input'] = function (block, generator) {
  const msg = generator.valueToCode(block, 'MSG', Order.NONE) || "''";
  return [`helpers.promptInput(${msg})`, Order.FUNCTION_CALL];
};
forBlock['ab_confirm'] = function (block, generator) {
  const msg = generator.valueToCode(block, 'MSG', Order.NONE) || "''";
  return [`helpers.confirmYesNo(${msg})`, Order.FUNCTION_CALL];
};
forBlock['ab_share'] = function (block, generator) {
  const text = generator.valueToCode(block, 'TEXT', Order.NONE) || "''";
  const url = generator.valueToCode(block, 'URL', Order.NONE) || "''";
  return `await helpers.shareContent(${text}, ${url});\n`;
};
forBlock['ab_choose_photo'] = function () {
  return ['(await helpers.choosePhoto())', Order.NONE];
};
forBlock['ab_get_latitude'] = function () {
  return ['(await helpers.getLatitude())', Order.NONE];
};
forBlock['ab_get_longitude'] = function () {
  return ['(await helpers.getLongitude())', Order.NONE];
};
forBlock['ab_is_online'] = function () {
  return ['helpers.isOnline()', Order.FUNCTION_CALL];
};
forBlock['ab_request_notification_permission'] = function () {
  return ['(await helpers.requestNotificationPermission())', Order.NONE];
};

// ---------- Links & Communication ----------
forBlock['ab_open_link_new_tab'] = function (block, generator) {
  const url = generator.valueToCode(block, 'URL', Order.NONE) || "''";
  return `helpers.openLink(${url}, true);\n`;
};
forBlock['ab_open_link_same_tab'] = function (block, generator) {
  const url = generator.valueToCode(block, 'URL', Order.NONE) || "''";
  return `helpers.openLink(${url}, false);\n`;
};
forBlock['ab_open_email'] = function (block, generator) {
  const address = generator.valueToCode(block, 'ADDRESS', Order.NONE) || "''";
  const subject = generator.valueToCode(block, 'SUBJECT', Order.NONE) || "''";
  const body = generator.valueToCode(block, 'BODY', Order.NONE) || "''";
  return `helpers.openEmail(${address}, ${subject}, ${body});\n`;
};
forBlock['ab_call_phone'] = function (block, generator) {
  const number = generator.valueToCode(block, 'NUMBER', Order.NONE) || "''";
  return `helpers.callPhone(${number});\n`;
};
forBlock['ab_send_sms'] = function (block, generator) {
  const number = generator.valueToCode(block, 'NUMBER', Order.NONE) || "''";
  const message = generator.valueToCode(block, 'MESSAGE', Order.NONE) || "''";
  return `helpers.sendSms(${number}, ${message});\n`;
};

// ---------- Date & Time ----------
forBlock['ab_current_timestamp'] = function () {
  return ['Date.now()', Order.FUNCTION_CALL];
};
forBlock['ab_format_date'] = function (block, generator) {
  const timestamp = generator.valueToCode(block, 'TIMESTAMP', Order.NONE) || '0';
  return [`helpers.formatDate(${timestamp}, ${fieldStr(block, 'STYLE')})`, Order.FUNCTION_CALL];
};
forBlock['ab_time_difference_seconds'] = function (block, generator) {
  const a = generator.valueToCode(block, 'A', Order.NONE) || '0';
  const b = generator.valueToCode(block, 'B', Order.NONE) || '0';
  return [`helpers.timeDifferenceSeconds(${a}, ${b})`, Order.FUNCTION_CALL];
};

// ---------- Control ----------
// Wraps its own { } block so `__list`/`__i` never collide with a sibling
// (or nested) ab_for_each elsewhere in the same compiled function — each
// gets its own JS block scope. `scope` is shadowed with `let` for the loop
// body only, so ab_item/ab_item_field/ab_item_index work inside it exactly
// like they do for a list row's tap, without leaking into code after the
// loop (which should still see whatever `scope` this trigger started with,
// e.g. nested for-each inside a list's own item_action).
forBlock['ab_for_each'] = function (block, generator) {
  const listVar = fieldStr(block, 'LIST_VAR');
  const body = generator.statementToCode(block, 'DO');
  return `{\n  const __list = helpers.getList(vars, ${listVar});\n  for (let __i = 0; __i < __list.length; __i++) {\n    let scope = { item: __list[__i], index: __i };\n${body}  }\n}\n`;
};
// Polls with a short delay rather than a tight loop, since compiled
// triggers are plain async functions (not Vakar Block's yield-driven
// generators) — an await-free `while` here would either resolve instantly
// forever or genuinely freeze the tab if the condition never becomes true.
forBlock['ab_wait_until'] = function (block, generator) {
  const cond = generator.valueToCode(block, 'CONDITION', Order.NONE) || 'false';
  return `while (!(${cond})) { await helpers.wait(50); }\n`;
};
forBlock['ab_stop_script'] = function () {
  return 'return;\n';
};

// ---------- Storage ----------
forBlock['ab_storage_set'] = function (block, generator) {
  const value = generator.valueToCode(block, 'VALUE', Order.NONE) || "''";
  return `helpers.storageSet(${fieldStr(block, 'KEY')}, ${value});\n`;
};
forBlock['ab_storage_get'] = function (block) {
  return [`helpers.storageGet(${fieldStr(block, 'KEY')})`, Order.FUNCTION_CALL];
};
forBlock['ab_storage_remove'] = function (block) {
  return `helpers.storageRemove(${fieldStr(block, 'KEY')});\n`;
};

// ---------- Navigate ----------
forBlock['ab_navigate'] = function (block) {
  return `helpers.navigate(${fieldStr(block, 'SCREEN')});\n`;
};
forBlock['ab_close_app'] = function () {
  return 'helpers.closeApp();\n';
};

// ---------- This item (list row tap scope / for-each loop scope) ----------
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
// output) into per-hat code — one entry per "when X" hat block found among
// its TOP-LEVEL blocks. Any top-level stack that ISN'T one of ALL_HAT_TYPES
// is skipped entirely: it was never attached under a hat, so — same rule
// Scratch/MIT App Inventor use — it's simply never run by the app. Loads
// into a throwaway headless workspace (compile-only, never rendered).
//
// `blockToCode(hatBlock)` (default opt_thisOnly=false) returns the hat's
// own contribution (empty, see the `forBlock['ab_when_*']` no-ops above)
// PLUS, by Blockly's own default behavior, everything chained after it via
// nextConnection — so this one call already yields exactly "the hat's
// whole body", with no manual chain-walking needed.
//
// `javascriptGenerator.finish('')` must run AFTER every blockToCode() call,
// not per-block — some stock generators (and potentially future ab_*
// helpers) emit a shared helper function lazily, collected once across the
// whole compile pass. Getting this order wrong is exactly the bug Vakar
// Block's own runtime.js documents hitting with math_random_int (see its
// compileSprite() comment) — same fix applied here preemptively. Every hat
// gets its own copy of the shared helper defs, since each compiles to an
// independent function.
// ============================================================
function generateByHat(workspaceJson) {
  const byHat = {};
  if (!workspaceJson) return byHat;
  const ws = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(workspaceJson, ws);
    javascriptGenerator.init(ws);
    const pending = [];
    for (const block of ws.getTopBlocks(true)) {
      if (!ALL_HAT_TYPES.includes(block.type)) continue; // not under a hat — ignored, on purpose
      const raw = javascriptGenerator.blockToCode(block);
      pending.push({ type: block.type, code: Array.isArray(raw) ? raw[0] : raw });
    }
    const helperDefs = javascriptGenerator.finish('');
    for (const { type, code } of pending) {
      // Two hats of the same type (e.g. someone adds "when clicked" twice)
      // both run, back to back, rather than one silently winning.
      byHat[type] = (byHat[type] || '') + helperDefs + code;
    }
    return byHat;
  } finally {
    ws.dispose();
  }
}

// Live editor preview + public runtime: {hatType: async (vars, setVar,
// scope, helpers) => {...}}. A hat with no code under it (or not present at
// all) simply has no entry — callers treat a missing entry as a no-op.
export function compileNodeBlocks(workspaceJson) {
  const byHat = generateByHat(workspaceJson);
  const compiled = {};
  for (const [hatType, body] of Object.entries(byHat)) {
    if (!body.trim()) continue;
    // eslint-disable-next-line no-new-func
    const factory = new Function(`return async function (vars, setVar, scope, helpers) {\n${body}\n}`);
    compiled[hatType] = factory();
  }
  return compiled;
}

// Static export (exportApp.js): {hatType: raw source text}, so each can be
// embedded as its own function body directly in the generated script.js
// instead of going through `new Function` at export-open time.
export function compileNodeBlocksSource(workspaceJson) {
  return generateByHat(workspaceJson);
}

export { javascriptGenerator, Order };
