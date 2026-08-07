import * as Blockly from 'blockly/core';
import { normalizeActions } from '../constants/appBuilder';
import './blocks';

// ============================================================
// APP BUILDER BLOCKS — migrates old trigger data all the way to the current
// shape: `{v: 2, blockly: <workspace JSON with a hat block>}`, the shape
// every element/screen's single `.blocks` field is stored as from here on.
// Three historical shapes feed into this, oldest first:
//   1. A flat action-list array (the original pre-Blockly ActionEditor;
//      see createAction()/ACTION_TYPES history in constants/appBuilder.js)
//      -> legacyActionsToBlockly() -> plain v1 Blockly JSON, no hat.
//   2. v1 Blockly JSON (`{v:1, blockly}`) — real blocks, but saved back
//      when a component still had one implicit trigger per type (onClick/
//      onChange) rather than explicit hat blocks -> wrapLegacyWorkspaceWithHat()
//      adds the right hat (ab_when_clicked/ab_when_changed/ab_when_row_tapped/
//      ab_when_screen_opens, chosen by the caller — see AppBuilderEditor.js/
//      AppRuntime.js, which own the element-type -> hat mapping since it
//      needs COMPONENT_META).
//   3. Already `{v:2, blockly}` — nothing to do.
// migrateToHatWorkspace() (bottom of this file) is the single entry point
// that walks 1 -> 2 -> 3 (or starts partway through) for one old value.
//
// legacyActionsToBlockly() modeled directly on Vakar Block's own .sb3
// importer (vakarBlock/sb3.js): a per-action-type handler table building
// real Blockly block instances in a throwaway headless
// `new Blockly.Workspace()`, then serialized once via
// Blockly.serialization.workspaces.save(). Unmapped/malformed actions are
// never silently dropped — they're collected into `warnings` and surfaced
// to the user, same convention as the sb3 importer.
//
// Run once, when an app with old-shape data is opened in the editor (see
// AppBuilderEditor.js's load()) — the migrated shape is written into
// in-memory app state; the next explicit save persists it. AppRuntime.js
// also calls this on the fly for any element it encounters that's still
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

// ============================================================
// v1 -> v2: wraps a v1 workspace (a flat statement chain with no hat block
// — everything in it ran unconditionally, since App Builder didn't have
// hats yet) under a fresh hat of the given type, so it keeps running under
// the new "only code under a matching hat ever runs" model (blocks.js/
// generators.js's compileNodeBlocks). Uses Blockly's own per-BLOCK
// serialization (not per-workspace) to move the old chain's root block —
// and everything chained after it — into the new workspace as a single
// unit, then connects it under the hat.
// ============================================================
function wrapLegacyWorkspaceWithHat(v1WorkspaceJson, hatType) {
  const ws = new Blockly.Workspace();
  const tempWs = new Blockly.Workspace();
  try {
    const hat = newBlock(ws, hatType);
    Blockly.serialization.workspaces.load(v1WorkspaceJson, tempWs);
    const roots = tempWs.getTopBlocks(true);
    if (roots.length > 0) {
      // v1 workspaces only ever held one linear chain (the old per-trigger
      // ActionEditor was strictly linear) — defensively only the first if
      // there happen to be more than one disconnected fragment.
      const rootState = Blockly.serialization.blocks.save(roots[0]);
      const imported = Blockly.serialization.blocks.append(rootState, ws);
      hat.nextConnection.connect(imported.previousConnection);
    }
    return Blockly.serialization.workspaces.save(ws);
  } finally {
    tempWs.dispose();
    ws.dispose();
  }
}

// isLegacyShape() (above) detects the oldest shape (a flat action array or
// pre-list single action). This detects the shape one step newer — a
// hat-less v1 workspace, saved by the block editor before hats existed —
// which also needs migrating (via wrapLegacyWorkspaceWithHat) but NOT
// through legacyActionsToBlockly again (it's already real Blockly JSON).
export function isV1Shape(value) {
  return !!(value && value.blockly && value.v === 1);
}

// True once a value is in the current, final shape — nothing to migrate.
export function isV2Shape(value) {
  return !!(value && value.blockly && value.v === 2);
}

// Orchestrates the full chain for one element's one old trigger value,
// whatever shape it's currently in, down to the final `{v: 2, blockly}` —
// or straight through unchanged if it's already there. `hatType` is the
// hat the caller has already decided this old value corresponds to (a
// button's old onClick -> ab_when_clicked, a list's old item_action ->
// ab_when_row_tapped, etc. — see AppBuilderEditor.js/AppRuntime.js, which
// own that per-element-type mapping since it needs COMPONENT_META).
export function migrateToHatWorkspace(oldValue, hatType, { variableNames = [] } = {}) {
  if (!oldValue) return { value: null, warnings: [] };
  if (isV2Shape(oldValue)) return { value: oldValue, warnings: [] };
  let v1Json;
  let warnings = [];
  if (isV1Shape(oldValue)) {
    v1Json = oldValue.blockly;
  } else {
    const migrated = legacyActionsToBlockly(oldValue, { variableNames });
    v1Json = migrated.value?.blockly;
    warnings = migrated.warnings;
  }
  if (!v1Json) return { value: null, warnings };
  const v2Json = wrapLegacyWorkspaceWithHat(v1Json, hatType);
  return { value: { v: 2, blockly: v2Json }, warnings };
}
