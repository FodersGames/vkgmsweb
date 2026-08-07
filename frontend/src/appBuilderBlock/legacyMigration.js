import * as Blockly from 'blockly/core';
import { normalizeActions } from '../constants/appBuilder';
import './blocks';

// ============================================================
// APP BUILDER BLOCKS — converts the old flat action-list format (a plain
// array of {type, ...fields} objects, see createAction()/ACTION_TYPES in
// constants/appBuilder.js) into a Blockly workspace JSON blob, the shape
// every trigger (node.actions.onClick/onChange, node.props.item_action) is
// stored as from here on (`{v: 1, blockly: <...>}`).
//
// Modeled directly on Vakar Block's own .sb3 importer (vakarBlock/sb3.js):
// a per-action-type handler table building real Blockly block instances in
// a throwaway headless `new Blockly.Workspace()`, then serialized once via
// Blockly.serialization.workspaces.save(). Unmapped/malformed actions are
// never silently dropped — they're collected into `warnings` and surfaced
// to the user, same convention as the sb3 importer.
//
// Run once, when an app with old-shape actions is opened in the editor
// (see AppBuilderEditor.js's load()) — the migrated shape is written into
// in-memory app state; the next explicit save persists it. AppRuntime.js
// also calls this on the fly for any trigger it encounters that's still
// old-shape (e.g. a published app nobody has re-opened in the editor yet),
// without persisting anything — it has nowhere to save to.
// ============================================================

function isLegacyShape(actions) {
  if (!actions) return false;
  if (Array.isArray(actions)) return true;
  // A pre-list single-action save (see normalizeActions' own comment) —
  // has a `type` field directly, unlike the new `{v, blockly}` shape.
  return typeof actions === 'object' && !!actions.type && !actions.blockly;
}
export { isLegacyShape };

const OP_MAP = { add: 'ADD', subtract: 'MINUS', multiply: 'MULTIPLY', divide: 'DIVIDE' };
const TEMPLATE_RE = /\{\{/;

function newBlock(ws, type) {
  return ws.newBlock(type);
}

function connectValue(block, inputName, valueBlock) {
  if (!valueBlock) return;
  const input = block.getInput(inputName);
  if (input && input.connection && valueBlock.outputConnection) {
    input.connection.connect(valueBlock.outputConnection);
  }
}

function numberBlock(ws, n) {
  const b = newBlock(ws, 'math_number');
  b.setFieldValue(String(Number(n) || 0), 'NUM');
  return b;
}

function textBlock(ws, str) {
  const b = newBlock(ws, 'text');
  b.setFieldValue(String(str ?? ''), 'TEXT');
  return b;
}

function legacyTextBlock(ws, template) {
  const b = newBlock(ws, 'ab_legacy_text');
  b.setFieldValue(String(template ?? ''), 'TEMPLATE');
  return b;
}

// A literal field that may contain {{var}} interpolation — same authoring
// shape `set_variable`/`update_text`/`list_add`/`show_message`/etc. all
// used. Plain text stays a native `text` block (nicer, editable); anything
// with {{}} keeps working exactly as before via the legacy-text bridge
// block rather than requiring a hand-built text_join chain.
function literalValueBlock(ws, raw) {
  const str = raw == null ? '' : String(raw);
  return TEMPLATE_RE.test(str) ? legacyTextBlock(ws, str) : textBlock(ws, str);
}

// Old `value_mode: 'literal' | 'variable'` fields — 'variable' copied
// another variable's raw value with no {{}} needed.
function literalOrVariableBlock(ws, raw, valueMode) {
  if (valueMode === 'variable') {
    const b = newBlock(ws, 'ab_get_variable');
    b.setFieldValue(String(raw || ''), 'VAR');
    return b;
  }
  return literalValueBlock(ws, raw);
}

// Mirrors resolveNumberOrVariable()'s authoring convention (calculate's A/B
// fields): a bare variable name, a literal number, or {{}} interpolation.
// `knownVars` (declared app.variables names) disambiguates a bare
// non-numeric token as "variable" vs. "leave as legacy text".
function numberOrVariableBlock(ws, raw, knownVars) {
  if (raw === undefined || raw === null || raw === '') return numberBlock(ws, 0);
  const str = String(raw);
  if (knownVars.has(str)) {
    const b = newBlock(ws, 'ab_get_variable');
    b.setFieldValue(str, 'VAR');
    return b;
  }
  if (TEMPLATE_RE.test(str)) return legacyTextBlock(ws, str);
  const n = Number(str);
  return Number.isFinite(n) ? numberBlock(ws, n) : legacyTextBlock(ws, str);
}

// Mirrors resolveIndex() — a literal number, the special `{{index}}` list-tap
// convenience (now the ab_item_index reporter), or {{}} interpolation.
function indexValueBlock(ws, raw) {
  const str = raw == null ? '0' : String(raw);
  if (str.trim() === '{{index}}') return newBlock(ws, 'ab_item_index');
  if (TEMPLATE_RE.test(str)) return legacyTextBlock(ws, str);
  const n = Number(str);
  return numberBlock(ws, Number.isFinite(n) ? n : 0);
}

const HANDLERS = {};
function reg(type, fn) { HANDLERS[type] = fn; }

reg('navigate', (a, ws) => {
  const b = newBlock(ws, 'ab_navigate');
  b.setFieldValue(a.screen_id || '', 'SCREEN');
  return b;
});

reg('set_variable', (a, ws, ctx) => {
  if (a.value_mode === 'toggle_bool') {
    const b = newBlock(ws, 'ab_toggle_variable');
    b.setFieldValue(a.variable || '', 'VAR');
    return b;
  }
  if (a.value_mode === 'increment' || a.value_mode === 'decrement') {
    const b = newBlock(ws, 'ab_change_variable');
    b.setFieldValue(a.variable || '', 'VAR');
    const amount = Number(a.value) || 1;
    connectValue(b, 'DELTA', numberBlock(ws, a.value_mode === 'decrement' ? -amount : amount));
    return b;
  }
  const b = newBlock(ws, 'ab_set_variable');
  b.setFieldValue(a.variable || '', 'VAR');
  connectValue(b, 'VALUE', literalValueBlock(ws, a.value));
  return b;
});

reg('calculate', (a, ws, ctx) => {
  const set = newBlock(ws, 'ab_set_variable');
  set.setFieldValue(a.variable || '', 'VAR');
  const op = newBlock(ws, 'math_arithmetic');
  op.setFieldValue(OP_MAP[a.op] || 'ADD', 'OP');
  connectValue(op, 'A', numberOrVariableBlock(ws, a.a, ctx.knownVars));
  connectValue(op, 'B', numberOrVariableBlock(ws, a.b, ctx.knownVars));
  connectValue(set, 'VALUE', op);
  return set;
});

// ab_random_pick no longer exists (split into simpler, composable blocks —
// see blocks.js's header comment) — reconstructs the exact same behavior as
// a small chain: pick a weighted item into a temp variable, copy it to
// target_variable if set, and (if collection_variable is set) either add it
// or — when dedupe_field is set and it's already present — credit
// duplicate_variable instead, via a real if/else + the new ab_json_field
// block (reading a field back out of the temp variable's JSON text, since
// the old in-memory-object shortcut the previous single block relied on
// isn't available once the picked value has to live in a variable).
reg('random_pick', (a, ws) => {
  const tempVar = `_picked_${(a.options_variable || 'reward').replace(/[^a-zA-Z0-9_]/g, '_')}`;

  const setPick = newBlock(ws, 'ab_set_variable');
  setPick.setFieldValue(tempVar, 'VAR');
  const pick = newBlock(ws, 'ab_pick_weighted');
  pick.setFieldValue(a.options_variable || '', 'LIST_VAR');
  pick.setFieldValue('weight', 'FIELD');
  connectValue(setPick, 'VALUE', pick);

  let tail = setPick;
  const chain = (next) => { tail.nextConnection.connect(next.previousConnection); tail = next; };
  const getTemp = () => { const g = newBlock(ws, 'ab_get_variable'); g.setFieldValue(tempVar, 'VAR'); return g; };

  if (a.target_variable) {
    const setTarget = newBlock(ws, 'ab_set_variable');
    setTarget.setFieldValue(a.target_variable, 'VAR');
    connectValue(setTarget, 'VALUE', getTemp());
    chain(setTarget);
  }

  if (a.collection_variable) {
    if (a.dedupe_field) {
      const ifElse = newBlock(ws, 'controls_ifelse');
      const contains = newBlock(ws, 'ab_list_contains');
      contains.setFieldValue(a.collection_variable, 'LIST_VAR');
      contains.setFieldValue(a.dedupe_field, 'FIELD');
      const field = newBlock(ws, 'ab_json_field');
      field.setFieldValue(a.dedupe_field, 'FIELD');
      connectValue(field, 'JSON_TEXT', getTemp());
      connectValue(contains, 'VALUE', field);
      const ifInput = ifElse.getInput('IF0');
      if (ifInput) ifInput.connection.connect(contains.outputConnection);

      let doHead = null;
      if (a.duplicate_variable) {
        doHead = newBlock(ws, 'ab_change_variable');
        doHead.setFieldValue(a.duplicate_variable, 'VAR');
        connectValue(doHead, 'DELTA', numberBlock(ws, a.duplicate_amount ?? 1));
      }
      const elseHead = newBlock(ws, 'ab_list_add_last');
      elseHead.setFieldValue(a.collection_variable, 'LIST_VAR');
      connectValue(elseHead, 'VALUE', getTemp());

      const doInput = ifElse.getInput('DO0');
      if (doHead && doInput) doInput.connection.connect(doHead.previousConnection);
      const elseInput = ifElse.getInput('ELSE');
      if (elseInput) elseInput.connection.connect(elseHead.previousConnection);

      chain(ifElse);
    } else {
      const addLast = newBlock(ws, 'ab_list_add_last');
      addLast.setFieldValue(a.collection_variable, 'LIST_VAR');
      connectValue(addLast, 'VALUE', getTemp());
      chain(addLast);
    }
  }

  return setPick;
});

reg('reset_variables', (a, ws) => newBlock(ws, 'ab_reset_variables'));

reg('update_text', (a, ws) => {
  const b = newBlock(ws, 'ab_update_text');
  b.setFieldValue(a.target_id || '', 'TARGET');
  connectValue(b, 'VALUE', literalOrVariableBlock(ws, a.value, a.value_mode));
  return b;
});

// ab_set_visibility no longer exists — split into ab_show_element/
// ab_hide_element/ab_toggle_visibility (see blocks.js).
reg('set_visibility', (a, ws) => {
  const type = a.visible === 'show' ? 'ab_show_element' : a.visible === 'hide' ? 'ab_hide_element' : 'ab_toggle_visibility';
  const b = newBlock(ws, type);
  b.setFieldValue(a.target_id || '', 'TARGET');
  return b;
});

// ab_list_add no longer exists — split into ab_list_add_last/
// ab_list_add_first/ab_list_insert_at (see blocks.js).
reg('list_add', (a, ws) => {
  const type = a.mode === 'prepend' ? 'ab_list_add_first' : a.mode === 'at_index' ? 'ab_list_insert_at' : 'ab_list_add_last';
  const b = newBlock(ws, type);
  b.setFieldValue(a.variable || '', 'LIST_VAR');
  connectValue(b, 'VALUE', literalOrVariableBlock(ws, a.value, a.value_mode));
  if (type === 'ab_list_insert_at') connectValue(b, 'INDEX', indexValueBlock(ws, a.index));
  return b;
});

// ab_list_remove no longer exists — split into ab_list_remove_first/
// ab_list_remove_last/ab_list_remove_at/ab_list_clear (see blocks.js).
reg('list_remove', (a, ws) => {
  const type = a.mode === 'clear' ? 'ab_list_clear' : a.mode === 'first' ? 'ab_list_remove_first' : a.mode === 'at_index' ? 'ab_list_remove_at' : 'ab_list_remove_last';
  const b = newBlock(ws, type);
  b.setFieldValue(a.variable || '', 'LIST_VAR');
  if (type === 'ab_list_remove_at') connectValue(b, 'INDEX', indexValueBlock(ws, a.index));
  return b;
});

reg('list_contains', (a, ws) => {
  const set = newBlock(ws, 'ab_set_variable');
  set.setFieldValue(a.target_variable || '', 'VAR');
  const contains = newBlock(ws, 'ab_list_contains');
  contains.setFieldValue(a.variable || '', 'LIST_VAR');
  contains.setFieldValue(a.field || '', 'FIELD');
  connectValue(contains, 'VALUE', textBlock(ws, a.value));
  connectValue(set, 'VALUE', contains);
  return set;
});

reg('show_message', (a, ws) => {
  const b = newBlock(ws, 'ab_show_message');
  connectValue(b, 'TEXT', literalValueBlock(ws, a.text));
  return b;
});

reg('copy_to_clipboard', (a, ws) => {
  const b = newBlock(ws, 'ab_copy_to_clipboard');
  connectValue(b, 'TEXT', literalValueBlock(ws, a.text));
  return b;
});

reg('vibrate', (a, ws) => {
  const b = newBlock(ws, 'ab_vibrate');
  connectValue(b, 'DURATION', numberBlock(ws, a.duration_ms ?? 200));
  return b;
});

reg('wait', (a, ws) => {
  const b = newBlock(ws, 'ab_wait');
  connectValue(b, 'DURATION', numberBlock(ws, a.duration_ms ?? 500));
  return b;
});

// The only action that expands into TWO chained blocks — see ab_elapsed_seconds/
// ab_mark_time's split in blocks.js. Returns the chain's first block; the
// caller (buildChain) discovers the rest via `_abNext` (a migration-only
// stash, not a real Blockly connection — set_variable+elapsed_seconds is
// already a nested pair, so ab_mark_time has to be chained separately).
reg('get_elapsed_time', (a, ws) => {
  const set = newBlock(ws, 'ab_set_variable');
  set.setFieldValue(a.target_variable || '', 'VAR');
  const elapsed = newBlock(ws, 'ab_elapsed_seconds');
  elapsed.setFieldValue(a.since_variable || '', 'SINCE_VAR');
  connectValue(set, 'VALUE', elapsed);
  if (a.since_variable && a.update_since !== false) {
    const mark = newBlock(ws, 'ab_mark_time');
    mark.setFieldValue(a.since_variable, 'VAR');
    set.nextConnection.connect(mark.previousConnection);
  }
  return set;
});

// ab_open_link no longer exists — split into ab_open_link_new_tab/
// ab_open_link_same_tab (see blocks.js).
reg('open_link', (a, ws) => {
  const b = newBlock(ws, a.new_tab === false ? 'ab_open_link_same_tab' : 'ab_open_link_new_tab');
  connectValue(b, 'URL', literalValueBlock(ws, a.url));
  return b;
});

// Follows a chain built by `get_elapsed_time`'s two-block expansion (or any
// future multi-block handler) to its real tail, so the next migrated action
// chains after it instead of after the first block only.
function chainTail(block) {
  let b = block;
  while (b.getNextBlock && b.getNextBlock()) b = b.getNextBlock();
  return b;
}

export function legacyActionsToBlockly(actions, { variableNames = [] } = {}) {
  const list = normalizeActions(actions);
  const ws = new Blockly.Workspace();
  const warnings = [];
  const ctx = { knownVars: new Set(variableNames) };
  let prev = null;
  try {
    for (const action of list) {
      const handler = HANDLERS[action?.type];
      if (!handler) {
        warnings.push(`Unsupported action "${action?.type || 'unknown'}" was dropped.`);
        continue;
      }
      let block;
      try {
        block = handler(action, ws, ctx);
      } catch (err) {
        warnings.push(`Couldn't migrate a "${action.type}" action: ${err.message}`);
        continue;
      }
      if (!block) continue;
      if (prev) prev.nextConnection.connect(block.previousConnection);
      prev = chainTail(block);
    }
    const json = list.length ? Blockly.serialization.workspaces.save(ws) : null;
    return { value: json ? { v: 1, blockly: json } : null, warnings };
  } finally {
    ws.dispose();
  }
}
