import * as Blockly from 'blockly/core';
import JSZip from 'jszip';
import './blocks';
import './generators';

// ============================================================
// VAKAR BLOCK — .sb3 (Scratch/TurboWarp project file) import & export.
// A genuinely large piece: Scratch's own block-graph format (a flat dict of
// block objects linked by `next`/`parent`/nested input references) is
// walked and translated to/from real Blockly blocks — built with Blockly's
// own APIs (`workspace.newBlock`, connections, `serialization.workspaces`)
// rather than hand-writing either JSON shape, so both directions reuse
// Blockly's own, already-correct serialization.
//
// Deliberately NOT a full Scratch VM reimplementation — see IMPORT_HANDLERS/
// EXPORT_HANDLERS below for exactly what's covered. Anything else is
// skipped with a warning surfaced to the user, never silently dropped.
//
// Known, stated scope gap: variable/list *initial values* have nowhere to
// go — Vakar Block doesn't persist `sprite.vars` at all (it's runtime-only,
// reset every load/green-flag; only the *scripts* that reference variables
// are persisted, via the blocks themselves). Only Scratch's block/costume/
// sound/sprite structure round-trips, not a project's starting data.
// ============================================================

// ---------- MD5 (pure JS — .sb3 asset filenames are `{md5}.{ext}`, and no
// browser API computes MD5; SHA-* via SubtleCrypto doesn't match Scratch's
// own asset-naming convention, so a small compliant implementation is
// needed here rather than skipped or approximated). ----------
function md5(bytes) {
  function rotl(x, c) { return (x << c) | (x >>> (32 - c)); }
  function toBytesLE(n) { return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]; }
  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const K = new Int32Array(64);
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32);

  const msgLen = bytes.length;
  const withOne = new Uint8Array(((msgLen + 8) >> 6) * 64 + 64);
  withOne.set(bytes);
  withOne[msgLen] = 0x80;
  const bitLenLo = (msgLen * 8) >>> 0;
  const bitLenHi = Math.floor((msgLen * 8) / 2 ** 32) >>> 0;
  const dv = new DataView(withOne.buffer);
  dv.setUint32(withOne.length - 8, bitLenLo, true);
  dv.setUint32(withOne.length - 4, bitLenHi, true);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let chunkStart = 0; chunkStart < withOne.length; chunkStart += 64) {
    const M = new Int32Array(16);
    for (let i = 0; i < 16; i++) M[i] = dv.getInt32(chunkStart + i * 4, true);
    let [A, B, C, D] = [a0, b0, c0, d0];
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + K[i] + M[g]) | 0;
      A = D; D = C; C = B;
      B = (B + rotl(F, s[i])) | 0;
    }
    a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
  }
  const out = [...toBytesLE(a0), ...toBytesLE(b0), ...toBytesLE(c0), ...toBytesLE(d0)];
  return out.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- Shared key-name tables (Scratch's key names differ from ours) ----------
const SCRATCH_KEY_TO_VK = {
  'space': 'space', 'up arrow': 'up', 'down arrow': 'down', 'left arrow': 'left', 'right arrow': 'right',
  'enter': 'enter', 'any': 'space',
};
const VK_KEY_TO_SCRATCH = {
  space: 'space', up: 'up arrow', down: 'down arrow', left: 'left arrow', right: 'right arrow', enter: 'enter',
};
for (const k of 'abcdefghijklmnopqrstuvwxyz0123456789') { SCRATCH_KEY_TO_VK[k] = k; VK_KEY_TO_SCRATCH[k] = k; }

const MENU_OPCODES = new Set([
  'looks_costume', 'looks_backdrops', 'sound_sounds_menu',
  'sensing_touchingobjectmenu', 'sensing_distancetomenu', 'sensing_keyoptions',
  'control_create_clone_of_menu', 'event_broadcast_menu',
]);
const LITERAL_OPCODES = new Set([
  'math_number', 'math_integer', 'math_whole_number', 'math_positive_number', 'math_angle', 'text', 'colour_picker',
]);

// ============================================================
// IMPORT
// ============================================================

export async function parseSb3(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const projectFile = zip.file('project.json');
  if (!projectFile) throw new Error("Fichier .sb3 invalide (project.json manquant).");
  const projectJson = JSON.parse(await projectFile.async('text'));
  return { zip, projectJson };
}

// STATEMENT-type inputs (SUBSTACK, custom_block, …) are always a real block
// referenced by id — never an inline primitive (only VALUE inputs can be
// inline, see resolveValue below), so this stays string-id-only.
function getInputBlockId(sb, name) {
  const entry = sb.inputs && sb.inputs[name];
  if (!entry) return null;
  const ref = entry[1];
  return typeof ref === 'string' ? ref : null;
}

const NUMBER_LITERAL_OPCODES = new Set(['math_number', 'math_integer', 'math_whole_number', 'math_positive_number', 'math_angle']);
// Scratch's inline-primitive input encoding — `[primitiveType, value, id?]`
// embedded directly in an input entry instead of a separate shadow block by
// id. Empirically, this is the MORE common of the two forms in real
// projects (confirmed against game/1.0.0.sb3: 57% of all input references
// used this form, not a separate block id) — math_number-family types.
const PRIMITIVE_NUMBER_TYPES = new Set([4, 5, 6, 7, 8]); // number/positive/whole/integer/angle
const PRIMITIVE_VARIABLE = 12;
const PRIMITIVE_LIST = 13;

// Builds a `variables_get` reporter for a variable referenced *inline* by
// name (Scratch embeds these directly in an input rather than pointing at a
// separate `data_variable` block — see PRIMITIVE_VARIABLE above). Reuses
// the workspace's existing variable of that name if one was already
// registered (from `target.variables`); otherwise creates one on the fly —
// this covers global ("for all sprites") variables, which live on the
// Stage's own `variables`, not any individual sprite's, so they're never
// pre-registered in a sprite's own workspace by the caller. generators.js's
// variables_get/variables_set read by the field's displayed NAME, not its
// Blockly id, so a freshly-minted id here is harmless as long as the name
// is right.
function buildVariableGetter(ws, name) {
  const b = ws.newBlock('variables_get');
  try {
    const map = ws.getVariableMap();
    const v = map.getVariable(name) || map.createVariable(name);
    b.getField('VAR').setValue(v.getId());
  } catch (e) { /* leave the field's own auto-created default variable */ }
  return b;
}

// Resolves ONE raw Scratch input reference (a block id string, or an inline
// primitive array) to either a literal or a real Blockly reporter block.
function resolveRef(ws, blocksDict, ref, ctx) {
  if (ref == null) return null;
  if (typeof ref === 'string') {
    const refBlock = blocksDict[ref];
    if (!refBlock) return null;
    if (LITERAL_OPCODES.has(refBlock.opcode) || MENU_OPCODES.has(refBlock.opcode)) {
      const fieldEntry = Object.values(refBlock.fields || {})[0];
      return { literal: fieldEntry ? fieldEntry[0] : '', isNumber: NUMBER_LITERAL_OPCODES.has(refBlock.opcode) };
    }
    const block = buildReporterBlock(ws, blocksDict, ref, ctx);
    return block ? { block } : null;
  }
  if (Array.isArray(ref)) {
    const [primitiveType, value] = ref;
    if (primitiveType === PRIMITIVE_VARIABLE) return { block: buildVariableGetter(ws, value) };
    if (primitiveType === PRIMITIVE_LIST) return { literal: String(value ?? ''), isNumber: false }; // best-effort: list name as text
    return { literal: String(value ?? ''), isNumber: PRIMITIVE_NUMBER_TYPES.has(primitiveType) };
  }
  return null;
}

// Resolves a VALUE input to either a literal (for fields) or recursively
// builds the real Blockly reporter block behind it (for inputs). `isNumber`
// reflects the *original* Scratch shadow's own type (math_number-family vs.
// text) — this must win over any caller hint, or a literal number ends up
// re-wrapped as a text shadow and gets read back as a string at runtime.
// The input entry itself is `[type, primary, shadow?]` — `primary` (the
// live value) is tried first, falling back to `shadow` (the third element,
// only present for type-3 "has both a block and a shadow behind it"
// inputs) if the primary side resolves to nothing.
function resolveValue(ws, blocksDict, sb, inputName, ctx) {
  const entry = sb.inputs && sb.inputs[inputName];
  if (!entry) return { literal: '', isNumber: false };
  const primary = resolveRef(ws, blocksDict, entry[1], ctx);
  if (primary) return primary;
  if (entry.length > 2) {
    const fallback = resolveRef(ws, blocksDict, entry[2], ctx);
    if (fallback) return fallback;
  }
  return { literal: '', isNumber: false };
}

function literalNumberBlock(ws, value) {
  const b = ws.newBlock('math_number');
  b.setFieldValue(String(value ?? 0), 'NUM');
  return b;
}
function literalTextBlock(ws, value) {
  const b = ws.newBlock('text');
  b.setFieldValue(String(value ?? ''), 'TEXT');
  return b;
}

// Connects a VALUE input by name. `asText` is only a *fallback* default for
// an input that was empty in the source (no shadow at all) — an actual
// resolved literal's own type (`resolved.isNumber`) always wins.
function connectValue(ws, block, inputName, resolved, { asText } = {}) {
  const input = block.getInput(inputName);
  if (!input) return;
  let valueBlock;
  if (resolved.block) valueBlock = resolved.block;
  else if (resolved.isNumber) valueBlock = literalNumberBlock(ws, resolved.literal);
  else valueBlock = asText ? literalTextBlock(ws, resolved.literal) : literalNumberBlock(ws, resolved.literal);
  input.connection.connect(valueBlock.outputConnection);
}

// One handler per supported Scratch opcode: `(sb, ws, blocksDict, ctx) => Block`.
// `ctx` = { warnings: Set<string>, varIdToName: {}, listIdToName: {} }
const IMPORT_HANDLERS = {};

function reg(opcode, fn) { IMPORT_HANDLERS[opcode] = fn; }

// ---------- Événements ----------
reg('event_whenflagclicked', (sb, ws) => ws.newBlock('vk_when_green_flag'));
reg('event_whenkeypressed', (sb, ws) => {
  const b = ws.newBlock('vk_when_key_pressed');
  const scratchKey = (sb.fields.KEY_OPTION || [''])[0];
  b.setFieldValue(SCRATCH_KEY_TO_VK[scratchKey] || 'space', 'KEY');
  return b;
});
reg('event_whenthisspriteclicked', (sb, ws) => ws.newBlock('vk_when_sprite_clicked'));
reg('event_whenbroadcastreceived', (sb, ws) => {
  const b = ws.newBlock('vk_when_i_receive');
  b.setFieldValue((sb.fields.BROADCAST_OPTION || ['message1'])[0], 'MESSAGE');
  return b;
});
reg('event_broadcast', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_broadcast');
  const resolved = resolveValue(ws, blocksDict, sb, 'BROADCAST_INPUT', ctx);
  b.setFieldValue(String(resolved.literal || 'message1'), 'MESSAGE');
  return b;
});

// ---------- Mouvement ----------
reg('motion_movesteps', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_move_steps');
  connectValue(ws, b, 'STEPS', resolveValue(ws, blocksDict, sb, 'STEPS', ctx));
  return b;
});
reg('motion_turnright', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_turn_right');
  connectValue(ws, b, 'DEGREES', resolveValue(ws, blocksDict, sb, 'DEGREES', ctx));
  return b;
});
reg('motion_turnleft', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_turn_left');
  connectValue(ws, b, 'DEGREES', resolveValue(ws, blocksDict, sb, 'DEGREES', ctx));
  return b;
});
reg('motion_gotoxy', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_go_to_xy');
  connectValue(ws, b, 'X', resolveValue(ws, blocksDict, sb, 'X', ctx));
  connectValue(ws, b, 'Y', resolveValue(ws, blocksDict, sb, 'Y', ctx));
  return b;
});
reg('motion_glidesecstoxy', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_glide_to_xy');
  connectValue(ws, b, 'SECS', resolveValue(ws, blocksDict, sb, 'SECS', ctx));
  connectValue(ws, b, 'X', resolveValue(ws, blocksDict, sb, 'X', ctx));
  connectValue(ws, b, 'Y', resolveValue(ws, blocksDict, sb, 'Y', ctx));
  return b;
});
reg('motion_xposition', (sb, ws) => ws.newBlock('vk_x_position'));
reg('motion_yposition', (sb, ws) => ws.newBlock('vk_y_position'));
reg('motion_changexby', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_change_x_by');
  connectValue(ws, b, 'DX', resolveValue(ws, blocksDict, sb, 'DX', ctx));
  return b;
});
reg('motion_changeyby', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_change_y_by');
  connectValue(ws, b, 'DY', resolveValue(ws, blocksDict, sb, 'DY', ctx));
  return b;
});
reg('motion_pointindirection', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_point_in_direction');
  connectValue(ws, b, 'DIRECTION', resolveValue(ws, blocksDict, sb, 'DIRECTION', ctx));
  return b;
});
reg('motion_setrotationstyle', (sb, ws) => {
  const b = ws.newBlock('vk_set_rotation_style');
  b.setFieldValue((sb.fields.STYLE || ['all around'])[0], 'STYLE');
  return b;
});

// ---------- Apparence ----------
reg('looks_sayforsecs', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_say_for_secs');
  connectValue(ws, b, 'TEXT', resolveValue(ws, blocksDict, sb, 'MESSAGE', ctx), { asText: true });
  connectValue(ws, b, 'SECS', resolveValue(ws, blocksDict, sb, 'SECS', ctx));
  return b;
});
reg('looks_say', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_say');
  connectValue(ws, b, 'TEXT', resolveValue(ws, blocksDict, sb, 'MESSAGE', ctx), { asText: true });
  return b;
});
reg('looks_nextcostume', (sb, ws) => ws.newBlock('vk_next_costume'));
reg('looks_switchcostumeto', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_switch_costume');
  connectValue(ws, b, 'NAME', resolveValue(ws, blocksDict, sb, 'COSTUME', ctx), { asText: true });
  return b;
});
reg('looks_changesizeby', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_change_size');
  connectValue(ws, b, 'DELTA', resolveValue(ws, blocksDict, sb, 'CHANGE', ctx));
  return b;
});
reg('looks_setsizeto', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_set_size');
  connectValue(ws, b, 'SIZE', resolveValue(ws, blocksDict, sb, 'SIZE', ctx));
  return b;
});
reg('looks_show', (sb, ws) => ws.newBlock('vk_show'));
reg('looks_hide', (sb, ws) => ws.newBlock('vk_hide'));
reg('looks_costumenumbername', (sb, ws) => {
  const which = (sb.fields.NUMBER_NAME || ['number'])[0];
  return ws.newBlock(which === 'name' ? 'vk_costume_name' : 'vk_costume_number');
});
reg('looks_seteffectto', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_set_effect');
  b.setFieldValue((sb.fields.EFFECT || ['GHOST'])[0], 'EFFECT');
  connectValue(ws, b, 'VALUE', resolveValue(ws, blocksDict, sb, 'VALUE', ctx));
  return b;
});
reg('looks_changeeffectby', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_change_effect');
  b.setFieldValue((sb.fields.EFFECT || ['GHOST'])[0], 'EFFECT');
  connectValue(ws, b, 'CHANGE', resolveValue(ws, blocksDict, sb, 'CHANGE', ctx));
  return b;
});
reg('looks_cleargraphiceffects', (sb, ws) => ws.newBlock('vk_clear_graphic_effects'));
reg('looks_gotofrontback', (sb, ws) => {
  const b = ws.newBlock('vk_go_to_front_back');
  b.setFieldValue((sb.fields.FRONT_BACK || ['front'])[0], 'FRONT_BACK');
  return b;
});

// ---------- Contrôle ----------
reg('control_wait', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_wait_secs');
  connectValue(ws, b, 'SECS', resolveValue(ws, blocksDict, sb, 'DURATION', ctx));
  return b;
});
reg('control_repeat', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('controls_repeat_ext');
  connectValue(ws, b, 'TIMES', resolveValue(ws, blocksDict, sb, 'TIMES', ctx));
  const bodyId = getInputBlockId(sb, 'SUBSTACK');
  if (bodyId) {
    const body = buildBlockChain(ws, blocksDict, bodyId, ctx);
    if (body) b.getInput('DO').connection.connect(body.previousConnection);
  }
  return b;
});
reg('control_forever', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_forever');
  const bodyId = getInputBlockId(sb, 'SUBSTACK');
  if (bodyId) {
    const body = buildBlockChain(ws, blocksDict, bodyId, ctx);
    if (body) b.getInput('DO').connection.connect(body.previousConnection);
  }
  return b;
});
reg('control_if', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('controls_if');
  const cond = resolveValue(ws, blocksDict, sb, 'CONDITION', ctx);
  if (cond.block) b.getInput('IF0').connection.connect(cond.block.outputConnection);
  const bodyId = getInputBlockId(sb, 'SUBSTACK');
  if (bodyId) {
    const body = buildBlockChain(ws, blocksDict, bodyId, ctx);
    if (body) b.getInput('DO0').connection.connect(body.previousConnection);
  }
  return b;
});
reg('control_if_else', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('controls_ifelse');
  const cond = resolveValue(ws, blocksDict, sb, 'CONDITION', ctx);
  if (cond.block) b.getInput('IF0').connection.connect(cond.block.outputConnection);
  const bodyId = getInputBlockId(sb, 'SUBSTACK');
  if (bodyId) {
    const body = buildBlockChain(ws, blocksDict, bodyId, ctx);
    if (body) b.getInput('DO0').connection.connect(body.previousConnection);
  }
  const elseId = getInputBlockId(sb, 'SUBSTACK2');
  if (elseId) {
    const elseBody = buildBlockChain(ws, blocksDict, elseId, ctx);
    if (elseBody) b.getInput('ELSE').connection.connect(elseBody.previousConnection);
  }
  return b;
});
reg('control_stop', (sb, ws, blocksDict, ctx) => {
  const option = (sb.fields.STOP_OPTION || [''])[0];
  if (option !== 'all') { ctx.warnings.add(`control_stop (${option})`); return null; }
  return ws.newBlock('vk_stop_all');
});
reg('control_create_clone_of', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_create_clone_of');
  const resolved = resolveValue(ws, blocksDict, sb, 'CLONE_OPTION', ctx);
  const target = resolved.literal === '_myself_' ? 'moi-même' : resolved.literal;
  b.setFieldValue(target || 'moi-même', 'TARGET');
  return b;
});
reg('control_start_as_clone', (sb, ws) => ws.newBlock('vk_when_i_start_as_clone'));
reg('control_delete_this_clone', (sb, ws) => ws.newBlock('vk_delete_this_clone'));
reg('control_repeat_until', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('controls_whileUntil');
  b.setFieldValue('UNTIL', 'MODE');
  const cond = resolveValue(ws, blocksDict, sb, 'CONDITION', ctx);
  if (cond.block) b.getInput('BOOL').connection.connect(cond.block.outputConnection);
  const bodyId = getInputBlockId(sb, 'SUBSTACK');
  if (bodyId) {
    const body = buildBlockChain(ws, blocksDict, bodyId, ctx);
    if (body) b.getInput('DO').connection.connect(body.previousConnection);
  }
  return b;
});

// ---------- Mes blocs (custom procedures, no-parameter only — see
// blocks.js's comment on vk_procedure_def; a proc with real Scratch
// arguments is skipped with a warning naming it, rather than silently
// dropping the arguments and producing a subtly wrong block). ----------
function safeParseJsonArray(s) {
  try { const v = JSON.parse(s || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
// `procedures_definition` is a hat (its own top-level script) whose BODY
// lives via `.next`, like any hat — not in a SUBSTACK input like every
// other C-block here. That's why it's handled as a special case in
// `buildProjectFromSb3`'s topIds loop rather than as a normal
// IMPORT_HANDLERS entry: a normal entry would leave buildBlockChain's own
// `id = sb.next` continuing to walk the body as if it were a SIBLING
// statement after the definition, double-processing it.
function buildProcedureDef(ws, blocksDict, defId, ctx) {
  const sb = blocksDict[defId];
  const protoId = getInputBlockId(sb, 'custom_block');
  const proto = protoId && blocksDict[protoId];
  const mutation = proto?.mutation || {};
  if (safeParseJsonArray(mutation.argumentnames).length > 0) {
    ctx.warnings.add(`procedures_definition avec paramètres (${mutation.proccode || '?'})`);
    return null;
  }
  const b = ws.newBlock('vk_procedure_def');
  b.setFieldValue(String(mutation.proccode || 'bloc').slice(0, 50), 'NAME');
  if (sb.next) {
    const body = buildBlockChain(ws, blocksDict, sb.next, ctx);
    if (body) b.getInput('DO').connection.connect(body.previousConnection);
  }
  return b;
}
reg('procedures_call', (sb, ws, blocksDict, ctx) => {
  const mutation = sb.mutation || {};
  if (safeParseJsonArray(mutation.argumentids).length > 0) {
    ctx.warnings.add(`procedures_call avec paramètres (${mutation.proccode || '?'})`);
    return null;
  }
  const b = ws.newBlock('vk_procedure_call');
  b.setFieldValue(String(mutation.proccode || 'bloc').slice(0, 50), 'NAME');
  return b;
});

// ---------- Détection ----------
function targetLiteral(resolved) {
  if (resolved.literal === '_mouse_') return 'souris';
  if (resolved.literal === '_edge_') return 'bord';
  return resolved.literal;
}
reg('sensing_touchingobject', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_touching');
  b.setFieldValue(targetLiteral(resolveValue(ws, blocksDict, sb, 'TOUCHINGOBJECTMENU', ctx)) || 'bord', 'TARGET');
  return b;
});
reg('sensing_distanceto', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_distance_to');
  b.setFieldValue(targetLiteral(resolveValue(ws, blocksDict, sb, 'DISTANCETOMENU', ctx)) || 'souris', 'TARGET');
  return b;
});
reg('sensing_mousex', (sb, ws) => ws.newBlock('vk_mouse_x'));
reg('sensing_mousey', (sb, ws) => ws.newBlock('vk_mouse_y'));
reg('sensing_mousedown', (sb, ws) => ws.newBlock('vk_mouse_down'));
reg('sensing_keypressed', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_key_down');
  const resolved = resolveValue(ws, blocksDict, sb, 'KEY_OPTION', ctx);
  b.setFieldValue(SCRATCH_KEY_TO_VK[resolved.literal] || 'space', 'KEY');
  return b;
});

// ---------- Opérateurs ----------
const ARITH_OP = { '+': 'ADD', '-': 'MINUS', '*': 'MULTIPLY', '/': 'DIVIDE' };
function arithHandler(opcodeSymbol) {
  return (sb, ws, blocksDict, ctx) => {
    const b = ws.newBlock('math_arithmetic');
    b.setFieldValue(ARITH_OP[opcodeSymbol], 'OP');
    connectValue(ws, b, 'A', resolveValue(ws, blocksDict, sb, 'NUM1', ctx));
    connectValue(ws, b, 'B', resolveValue(ws, blocksDict, sb, 'NUM2', ctx));
    return b;
  };
}
reg('operator_add', arithHandler('+'));
reg('operator_subtract', arithHandler('-'));
reg('operator_multiply', arithHandler('*'));
reg('operator_divide', arithHandler('/'));
function compareHandler(op) {
  return (sb, ws, blocksDict, ctx) => {
    const b = ws.newBlock('logic_compare');
    b.setFieldValue(op, 'OP');
    connectValue(ws, b, 'A', resolveValue(ws, blocksDict, sb, 'OPERAND1', ctx));
    connectValue(ws, b, 'B', resolveValue(ws, blocksDict, sb, 'OPERAND2', ctx));
    return b;
  };
}
reg('operator_equals', compareHandler('EQ'));
reg('operator_gt', compareHandler('GT'));
reg('operator_lt', compareHandler('LT'));
function logicHandler(op) {
  return (sb, ws, blocksDict, ctx) => {
    const b = ws.newBlock('logic_operation');
    b.setFieldValue(op, 'OP');
    connectValue(ws, b, 'A', resolveValue(ws, blocksDict, sb, 'OPERAND1', ctx));
    connectValue(ws, b, 'B', resolveValue(ws, blocksDict, sb, 'OPERAND2', ctx));
    return b;
  };
}
reg('operator_and', logicHandler('AND'));
reg('operator_or', logicHandler('OR'));
reg('operator_not', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('logic_negate');
  connectValue(ws, b, 'BOOL', resolveValue(ws, blocksDict, sb, 'OPERAND', ctx));
  return b;
});
reg('operator_random', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('math_random_int');
  connectValue(ws, b, 'FROM', resolveValue(ws, blocksDict, sb, 'FROM', ctx));
  connectValue(ws, b, 'TO', resolveValue(ws, blocksDict, sb, 'TO', ctx));
  return b;
});
reg('operator_join', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('text_join'); // default 2-slot shape matches Scratch's fixed 2-input join
  connectValue(ws, b, 'ADD0', resolveValue(ws, blocksDict, sb, 'STRING1', ctx), { asText: true });
  connectValue(ws, b, 'ADD1', resolveValue(ws, blocksDict, sb, 'STRING2', ctx), { asText: true });
  return b;
});
reg('operator_length', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('text_length');
  connectValue(ws, b, 'VALUE', resolveValue(ws, blocksDict, sb, 'STRING', ctx), { asText: true });
  return b;
});
reg('operator_mod', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('math_modulo');
  connectValue(ws, b, 'DIVIDEND', resolveValue(ws, blocksDict, sb, 'NUM1', ctx));
  connectValue(ws, b, 'DIVISOR', resolveValue(ws, blocksDict, sb, 'NUM2', ctx));
  return b;
});
reg('operator_round', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('math_round');
  b.setFieldValue('ROUND', 'OP');
  connectValue(ws, b, 'NUM', resolveValue(ws, blocksDict, sb, 'NUM', ctx));
  return b;
});

// ---------- Variables / Listes ----------
reg('data_variable', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('variables_get');
  const [, id] = sb.fields.VARIABLE || [null, null];
  if (ctx.varIdToName[id]) b.getField('VAR').setValue(id);
  return b;
});
reg('data_setvariableto', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('variables_set');
  const [, id] = sb.fields.VARIABLE || [null, null];
  if (ctx.varIdToName[id]) b.getField('VAR').setValue(id);
  connectValue(ws, b, 'VALUE', resolveValue(ws, blocksDict, sb, 'VALUE', ctx), { asText: true });
  return b;
});
reg('data_changevariableby', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('math_change');
  const [, id] = sb.fields.VARIABLE || [null, null];
  if (ctx.varIdToName[id]) b.getField('VAR').setValue(id);
  connectValue(ws, b, 'DELTA', resolveValue(ws, blocksDict, sb, 'VALUE', ctx));
  return b;
});
function listNameField(sb) {
  const [name] = sb.fields.LIST || [''];
  return name;
}
reg('data_addtolist', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_list_add');
  b.setFieldValue(listNameField(sb), 'LIST');
  connectValue(ws, b, 'VALUE', resolveValue(ws, blocksDict, sb, 'ITEM', ctx), { asText: true });
  return b;
});
reg('data_deleteoflist', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_list_delete_item');
  b.setFieldValue(listNameField(sb), 'LIST');
  connectValue(ws, b, 'INDEX', resolveValue(ws, blocksDict, sb, 'INDEX', ctx));
  return b;
});
reg('data_deletealloflist', (sb, ws) => {
  const b = ws.newBlock('vk_list_delete_all');
  b.setFieldValue(listNameField(sb), 'LIST');
  return b;
});
reg('data_insertatlist', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_list_insert');
  b.setFieldValue(listNameField(sb), 'LIST');
  connectValue(ws, b, 'VALUE', resolveValue(ws, blocksDict, sb, 'ITEM', ctx), { asText: true });
  connectValue(ws, b, 'INDEX', resolveValue(ws, blocksDict, sb, 'INDEX', ctx));
  return b;
});
reg('data_replaceitemoflist', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_list_replace');
  b.setFieldValue(listNameField(sb), 'LIST');
  connectValue(ws, b, 'INDEX', resolveValue(ws, blocksDict, sb, 'INDEX', ctx));
  connectValue(ws, b, 'VALUE', resolveValue(ws, blocksDict, sb, 'ITEM', ctx), { asText: true });
  return b;
});
reg('data_itemoflist', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_list_item');
  b.setFieldValue(listNameField(sb), 'LIST');
  connectValue(ws, b, 'INDEX', resolveValue(ws, blocksDict, sb, 'INDEX', ctx));
  return b;
});
reg('data_lengthoflist', (sb, ws) => {
  const b = ws.newBlock('vk_list_length');
  b.setFieldValue(listNameField(sb), 'LIST');
  return b;
});
reg('data_listcontainsitem', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_list_contains');
  b.setFieldValue(listNameField(sb), 'LIST');
  connectValue(ws, b, 'VALUE', resolveValue(ws, blocksDict, sb, 'ITEM', ctx), { asText: true });
  return b;
});
reg('data_itemnumoflist', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_list_index_of');
  b.setFieldValue(listNameField(sb), 'LIST');
  connectValue(ws, b, 'VALUE', resolveValue(ws, blocksDict, sb, 'ITEM', ctx), { asText: true });
  return b;
});

// ---------- Stylo ----------
reg('pen_clear', (sb, ws) => ws.newBlock('vk_pen_clear'));
reg('pen_stamp', (sb, ws) => ws.newBlock('vk_pen_stamp'));
reg('pen_penDown', (sb, ws) => ws.newBlock('vk_pen_down'));
reg('pen_penUp', (sb, ws) => ws.newBlock('vk_pen_up'));
reg('pen_setPenColorToColor', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_pen_set_color');
  const resolved = resolveValue(ws, blocksDict, sb, 'COLOR', ctx);
  b.setFieldValue(resolved.literal || '#4C97FF', 'COLOR');
  return b;
});

// ---------- Son ----------
reg('sound_play', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_play_sound');
  b.setFieldValue(resolveValue(ws, blocksDict, sb, 'SOUND_MENU', ctx).literal || 'son1', 'NAME');
  return b;
});
reg('sound_playuntildone', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_play_sound_until_done');
  b.setFieldValue(resolveValue(ws, blocksDict, sb, 'SOUND_MENU', ctx).literal || 'son1', 'NAME');
  return b;
});
reg('sound_stopallsounds', (sb, ws) => ws.newBlock('vk_stop_all_sounds'));
reg('sound_setvolumeto', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_set_volume');
  connectValue(ws, b, 'VOLUME', resolveValue(ws, blocksDict, sb, 'VOLUME', ctx));
  return b;
});
reg('sound_changevolumeby', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_change_volume');
  connectValue(ws, b, 'VOLUME', resolveValue(ws, blocksDict, sb, 'VOLUME', ctx));
  return b;
});
reg('sound_volume', (sb, ws) => ws.newBlock('vk_volume'));

// ---------- JSON (maps the third-party "SkyHigh173" TurboWarp JSON
// extension's blocks — opcode-namespaced `skyhigh173JSON_*` — onto Vakar
// Block's own JSON category). Input names (`json`/`item`/`value`, all
// lowercase, and the `Stype` field) were read directly off a real project
// using this extension rather than guessed, since the extension's own
// source isn't available locally to confirm from. Every instance in that
// real project was used purely as a value input, never as a statement,
// confirming these are pure/functional reporters — see blocks.js's
// vk_json_set/vk_json_array_push comment. ----------
reg('skyhigh173JSON_json_get', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_json_get');
  connectValue(ws, b, 'JSON', resolveValue(ws, blocksDict, sb, 'json', ctx), { asText: true });
  connectValue(ws, b, 'KEY', resolveValue(ws, blocksDict, sb, 'item', ctx), { asText: true });
  return b;
});
reg('skyhigh173JSON_json_array_get', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_json_array_get');
  connectValue(ws, b, 'JSON', resolveValue(ws, blocksDict, sb, 'json', ctx), { asText: true });
  connectValue(ws, b, 'INDEX', resolveValue(ws, blocksDict, sb, 'item', ctx));
  return b;
});
reg('skyhigh173JSON_json_set', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_json_set');
  connectValue(ws, b, 'JSON', resolveValue(ws, blocksDict, sb, 'json', ctx), { asText: true });
  connectValue(ws, b, 'KEY', resolveValue(ws, blocksDict, sb, 'item', ctx), { asText: true });
  connectValue(ws, b, 'VALUE', resolveValue(ws, blocksDict, sb, 'value', ctx), { asText: true });
  return b;
});
reg('skyhigh173JSON_json_array_push', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_json_array_push');
  connectValue(ws, b, 'JSON', resolveValue(ws, blocksDict, sb, 'json', ctx), { asText: true });
  connectValue(ws, b, 'VALUE', resolveValue(ws, blocksDict, sb, 'item', ctx), { asText: true });
  return b;
});
reg('skyhigh173JSON_json_get_all', (sb, ws, blocksDict, ctx) => {
  const stype = (sb.fields.Stype || ['keys'])[0];
  const b = ws.newBlock(stype === 'values' ? 'vk_json_values' : 'vk_json_keys');
  connectValue(ws, b, 'JSON', resolveValue(ws, blocksDict, sb, 'json', ctx), { asText: true });
  return b;
});
reg('skyhigh173JSON_json_length', (sb, ws, blocksDict, ctx) => {
  const b = ws.newBlock('vk_json_length');
  connectValue(ws, b, 'JSON', resolveValue(ws, blocksDict, sb, 'json', ctx), { asText: true });
  return b;
});

// When a block has no IMPORT_HANDLERS entry, everything nested under it
// (a C-block's SUBSTACK body, an if/else's branches, a reporter used as one
// of its arguments…) is dropped too — `buildBlockChain`/`buildReporterBlock`
// only ever look at the *wrapper* they failed to translate, never at what
// was inside it. Without this, an unsupported loop like Scratch's "repeat
// until" would silently vanish along with its entire body, and the import
// log would report exactly one skipped opcode when dozens of blocks were
// actually lost — misleading the user about how much of their project
// survived. Walks every nested input (recursing into both value/reporter
// slots and statement/substack slots — Scratch's own JSON doesn't
// distinguish them structurally, both are just `[type, blockId]` pairs) and
// records every opcode along the way that has no handler of its own. Does
// NOT rebuild any blocks — this is purely for accounting so the warning
// list reflects everything skipped, not just top-level casualties.
function collectDescendantWarnings(blocksDict, id, ctx, seen = new Set()) {
  if (!id || seen.has(id)) return;
  seen.add(id);
  const sb = blocksDict[id];
  if (!sb) return;
  if (!IMPORT_HANDLERS[sb.opcode] && !LITERAL_OPCODES.has(sb.opcode) && !MENU_OPCODES.has(sb.opcode)) {
    ctx.warnings.add(sb.opcode);
  }
  for (const entry of Object.values(sb.inputs || {})) {
    const ref = entry && entry[1];
    if (typeof ref === 'string') collectDescendantWarnings(blocksDict, ref, ctx, seen);
  }
  if (sb.next) collectDescendantWarnings(blocksDict, sb.next, ctx, seen);
}

// Builds one connected chain of statement blocks starting at `startId`,
// following `.next`. Reporter/value blocks are built separately, on demand,
// via resolveValue → buildReporterBlock (they're never top-level chain
// entries themselves).
function buildBlockChain(ws, blocksDict, startId, ctx) {
  let first = null;
  let prev = null;
  let id = startId;
  while (id) {
    const sb = blocksDict[id];
    if (!sb) break;
    const handler = IMPORT_HANDLERS[sb.opcode];
    let block = null;
    if (!handler) {
      collectDescendantWarnings(blocksDict, id, ctx);
    } else {
      try {
        block = handler(sb, ws, blocksDict, ctx);
      } catch (err) {
        ctx.warnings.add(`${sb.opcode} (erreur: ${err.message})`);
      }
    }
    if (block) {
      if (prev) prev.nextConnection.connect(block.previousConnection);
      else first = block;
      prev = block;
    }
    id = sb.next;
  }
  return first;
}

// A "reporter" is the same handler set, just expected to return a block
// with an outputConnection instead of being chained via previous/next.
function buildReporterBlock(ws, blocksDict, blockId, ctx) {
  const sb = blocksDict[blockId];
  if (!sb) return null;
  const handler = IMPORT_HANDLERS[sb.opcode];
  if (!handler) { collectDescendantWarnings(blocksDict, blockId, ctx); return null; }
  try {
    return handler(sb, ws, blocksDict, ctx);
  } catch (err) {
    ctx.warnings.add(`${sb.opcode} (erreur: ${err.message})`);
    return null;
  }
}

// Parses the already-loaded project.json into plain data: stage backdrop
// specs, one entry per sprite (with a serialized Blockly workspace ready to
// store as `sprite.workspace`), and a list of skipped-opcode warnings.
// Costume/sound *asset bytes* are returned separately (still zipped) since
// uploading them requires the caller's own authenticated fetch.
export function buildProjectFromSb3(projectJson) {
  const warnings = new Set();
  const stage = { width: 480, height: 360, backdrops: [], current_backdrop_id: null };
  const sprites = [];

  for (const target of projectJson.targets || []) {
    const assetSpecs = (list) => (list || []).map((a) => ({ zipName: `${a.assetId}.${a.dataFormat}`, name: a.name }));
    const costumeSpecs = assetSpecs(target.costumes);
    const soundSpecs = assetSpecs(target.sounds);

    if (target.isStage) {
      stage._backdropSpecs = costumeSpecs;
      stage._currentBackdropIndex = target.currentCostume || 0;
      continue;
    }

    const ws = new Blockly.Workspace();
    const varIdToName = {};
    for (const [id, entry] of Object.entries(target.variables || {})) {
      const name = entry[0];
      varIdToName[id] = name;
      try { ws.getVariableMap().createVariable(name, undefined, id); } catch (e) { /* duplicate name across sprites — fine, per-sprite workspace */ }
    }
    const listIdToName = {};
    for (const [id, entry] of Object.entries(target.lists || {})) listIdToName[id] = entry[0];

    const ctx = { warnings, varIdToName, listIdToName };
    const topIds = Object.entries(target.blocks || {}).filter(([, b]) => b.topLevel).map(([id]) => id);
    for (const topId of topIds) {
      if ((target.blocks[topId] || {}).opcode === 'procedures_definition') {
        buildProcedureDef(ws, target.blocks, topId, ctx);
      } else {
        buildBlockChain(ws, target.blocks, topId, ctx);
      }
    }

    let workspaceState = null;
    try { workspaceState = Blockly.serialization.workspaces.save(ws); } catch (err) { warnings.add(`sérialisation: ${err.message}`); }
    ws.dispose();

    sprites.push({
      name: target.name,
      x: target.x ?? 0,
      y: target.y ?? 0,
      direction: target.direction ?? 90,
      size: target.size ?? 100,
      visible: target.visible !== false,
      _costumeSpecs: costumeSpecs,
      _soundSpecs: soundSpecs,
      _currentCostumeIndex: target.currentCostume || 0,
      workspace: workspaceState,
    });
  }

  return { stage, sprites, warnings: Array.from(warnings) };
}

// ============================================================
// EXPORT — the reverse direction: a project's per-sprite Blockly workspace
// JSON → Scratch-shaped block dicts. Loads each sprite's stored workspace
// into a real (headless) Blockly.Workspace so the same block-model APIs
// (getInputTargetBlock, getNextBlock, field values) drive the walk, rather
// than re-parsing our own serialized JSON by hand.
// ============================================================

let _scratchIdCounter = 0;
function genScratchId() {
  _scratchIdCounter += 1;
  return `vk${_scratchIdCounter}${Math.random().toString(36).slice(2, 8)}`;
}

function scratchField(value) {
  return [String(value ?? ''), null];
}

const EXPORT_HANDLERS = {};
function regExport(blocklyType, fn) { EXPORT_HANDLERS[blocklyType] = fn; }

// Exports one VALUE input; returns a Scratch input-array `[1|2, blockId]` or
// null if nothing is connected (caller omits the input entirely then).
function exportValue(b, ownerId, inputName, blocksOut, ctx) {
  const target = b.getInputTargetBlock(inputName);
  if (!target) return null;
  const id = genScratchId();
  const built = buildExportBlock(target, id, ownerId, blocksOut, ctx);
  if (!built) return null;
  blocksOut[id] = built;
  return [built.shadow ? 1 : 2, id];
}

// Exports a STATEMENT input (a nested block stack, e.g. a repeat's body).
function exportStatement(b, ownerId, inputName, blocksOut, ctx) {
  const target = b.getInputTargetBlock(inputName);
  if (!target) return null;
  const firstId = exportChain(target, blocksOut, ctx, { parentId: ownerId });
  return firstId ? [2, firstId] : null;
}

function buildExportBlock(b, id, parentId, blocksOut, ctx) {
  const handler = EXPORT_HANDLERS[b.type];
  if (!handler) { ctx.warnings.add(`export: bloc non pris en charge (${b.type})`); return null; }
  let shape;
  try {
    shape = handler(b, id, blocksOut, ctx);
  } catch (err) {
    ctx.warnings.add(`export: ${b.type} (erreur: ${err.message})`);
    return null;
  }
  if (!shape) return null;
  const inputs = {};
  for (const [k, v] of Object.entries(shape.inputs || {})) if (v) inputs[k] = v;
  // `next` and `mutation` are opt-in overrides — only `vk_procedure_def`
  // needs `next` (its body is chained via `.next` like a hat's, not nested
  // in a SUBSTACK input — see its handler below) and only the two
  // procedure blocks need `mutation` (Scratch's own custom-block calling
  // convention). Every other handler leaves both undefined, preserving the
  // previous unconditional `next: null` / no-mutation behaviour.
  const out = { opcode: shape.opcode, next: shape.next ?? null, parent: parentId, inputs, fields: shape.fields || {}, shadow: !!shape.shadow, topLevel: false };
  if (shape.mutation) out.mutation = shape.mutation;
  return out;
}

// Walks a statement chain (via getNextBlock()); `topXY` marks the first
// block as a real top-level (hat) script at that canvas position.
function exportChain(block, blocksOut, ctx, { topXY, parentId } = {}) {
  let firstId = null;
  let prevId = null;
  let b = block;
  while (b) {
    const id = genScratchId();
    const built = buildExportBlock(b, id, prevId || parentId || null, blocksOut, ctx);
    if (built) {
      built.topLevel = !prevId && !!topXY;
      if (built.topLevel) { built.x = topXY.x; built.y = topXY.y; }
      blocksOut[id] = built;
      if (prevId) blocksOut[prevId].next = id;
      else firstId = id;
      prevId = id;
    }
    b = b.getNextBlock();
  }
  return firstId;
}

// ---------- Literal shadow blocks ----------
regExport('math_number', (b) => ({ opcode: 'math_number', fields: { NUM: scratchField(b.getFieldValue('NUM')) }, shadow: true }));
regExport('text', (b) => ({ opcode: 'text', fields: { TEXT: scratchField(b.getFieldValue('TEXT')) }, shadow: true }));

// ---------- Événements ----------
regExport('vk_when_green_flag', () => ({ opcode: 'event_whenflagclicked' }));
regExport('vk_when_key_pressed', (b) => ({ opcode: 'event_whenkeypressed', fields: { KEY_OPTION: scratchField(VK_KEY_TO_SCRATCH[b.getFieldValue('KEY')] || 'space') } }));
regExport('vk_when_sprite_clicked', () => ({ opcode: 'event_whenthisspriteclicked' }));
regExport('vk_when_i_receive', (b) => ({ opcode: 'event_whenbroadcastreceived', fields: { BROADCAST_OPTION: [b.getFieldValue('MESSAGE'), b.getFieldValue('MESSAGE')] } }));
regExport('vk_broadcast', (b, id, blocksOut) => {
  const menuId = genScratchId();
  blocksOut[menuId] = { opcode: 'event_broadcast_menu', next: null, parent: id, inputs: {}, fields: { BROADCAST_OPTION: [b.getFieldValue('MESSAGE'), b.getFieldValue('MESSAGE')] }, shadow: true, topLevel: false };
  return { opcode: 'event_broadcast', inputs: { BROADCAST_INPUT: [1, menuId] } };
});

// ---------- Mouvement ----------
regExport('vk_move_steps', (b, id, blocksOut, ctx) => ({ opcode: 'motion_movesteps', inputs: { STEPS: exportValue(b, id, 'STEPS', blocksOut, ctx) } }));
regExport('vk_turn_right', (b, id, blocksOut, ctx) => ({ opcode: 'motion_turnright', inputs: { DEGREES: exportValue(b, id, 'DEGREES', blocksOut, ctx) } }));
regExport('vk_turn_left', (b, id, blocksOut, ctx) => ({ opcode: 'motion_turnleft', inputs: { DEGREES: exportValue(b, id, 'DEGREES', blocksOut, ctx) } }));
regExport('vk_go_to_xy', (b, id, blocksOut, ctx) => ({ opcode: 'motion_gotoxy', inputs: { X: exportValue(b, id, 'X', blocksOut, ctx), Y: exportValue(b, id, 'Y', blocksOut, ctx) } }));
regExport('vk_glide_to_xy', (b, id, blocksOut, ctx) => ({ opcode: 'motion_glidesecstoxy', inputs: { SECS: exportValue(b, id, 'SECS', blocksOut, ctx), X: exportValue(b, id, 'X', blocksOut, ctx), Y: exportValue(b, id, 'Y', blocksOut, ctx) } }));
regExport('vk_x_position', () => ({ opcode: 'motion_xposition' }));
regExport('vk_y_position', () => ({ opcode: 'motion_yposition' }));
regExport('vk_change_x_by', (b, id, blocksOut, ctx) => ({ opcode: 'motion_changexby', inputs: { DX: exportValue(b, id, 'DX', blocksOut, ctx) } }));
regExport('vk_change_y_by', (b, id, blocksOut, ctx) => ({ opcode: 'motion_changeyby', inputs: { DY: exportValue(b, id, 'DY', blocksOut, ctx) } }));
regExport('vk_point_in_direction', (b, id, blocksOut, ctx) => ({ opcode: 'motion_pointindirection', inputs: { DIRECTION: exportValue(b, id, 'DIRECTION', blocksOut, ctx) } }));
regExport('vk_set_rotation_style', (b) => ({ opcode: 'motion_setrotationstyle', fields: { STYLE: scratchField(b.getFieldValue('STYLE')) } }));

// ---------- Apparence ----------
regExport('vk_say_for_secs', (b, id, blocksOut, ctx) => ({ opcode: 'looks_sayforsecs', inputs: { MESSAGE: exportValue(b, id, 'TEXT', blocksOut, ctx), SECS: exportValue(b, id, 'SECS', blocksOut, ctx) } }));
regExport('vk_say', (b, id, blocksOut, ctx) => ({ opcode: 'looks_say', inputs: { MESSAGE: exportValue(b, id, 'TEXT', blocksOut, ctx) } }));
regExport('vk_next_costume', () => ({ opcode: 'looks_nextcostume' }));
regExport('vk_switch_costume', (b, id, blocksOut, ctx) => ({ opcode: 'looks_switchcostumeto', inputs: { COSTUME: exportValue(b, id, 'NAME', blocksOut, ctx) } }));
regExport('vk_change_size', (b, id, blocksOut, ctx) => ({ opcode: 'looks_changesizeby', inputs: { CHANGE: exportValue(b, id, 'DELTA', blocksOut, ctx) } }));
regExport('vk_set_size', (b, id, blocksOut, ctx) => ({ opcode: 'looks_setsizeto', inputs: { SIZE: exportValue(b, id, 'SIZE', blocksOut, ctx) } }));
regExport('vk_show', () => ({ opcode: 'looks_show' }));
regExport('vk_hide', () => ({ opcode: 'looks_hide' }));
regExport('vk_costume_number', () => ({ opcode: 'looks_costumenumbername', fields: { NUMBER_NAME: scratchField('number') } }));
regExport('vk_costume_name', () => ({ opcode: 'looks_costumenumbername', fields: { NUMBER_NAME: scratchField('name') } }));
regExport('vk_set_effect', (b, id, blocksOut, ctx) => ({ opcode: 'looks_seteffectto', fields: { EFFECT: scratchField(b.getFieldValue('EFFECT')) }, inputs: { VALUE: exportValue(b, id, 'VALUE', blocksOut, ctx) } }));
regExport('vk_change_effect', (b, id, blocksOut, ctx) => ({ opcode: 'looks_changeeffectby', fields: { EFFECT: scratchField(b.getFieldValue('EFFECT')) }, inputs: { CHANGE: exportValue(b, id, 'CHANGE', blocksOut, ctx) } }));
regExport('vk_clear_graphic_effects', () => ({ opcode: 'looks_cleargraphiceffects' }));
regExport('vk_go_to_front_back', (b) => ({ opcode: 'looks_gotofrontback', fields: { FRONT_BACK: scratchField(b.getFieldValue('FRONT_BACK')) } }));

// ---------- Contrôle ----------
regExport('vk_wait_secs', (b, id, blocksOut, ctx) => ({ opcode: 'control_wait', inputs: { DURATION: exportValue(b, id, 'SECS', blocksOut, ctx) } }));
regExport('controls_repeat_ext', (b, id, blocksOut, ctx) => ({ opcode: 'control_repeat', inputs: { TIMES: exportValue(b, id, 'TIMES', blocksOut, ctx), SUBSTACK: exportStatement(b, id, 'DO', blocksOut, ctx) } }));
regExport('vk_forever', (b, id, blocksOut, ctx) => ({ opcode: 'control_forever', inputs: { SUBSTACK: exportStatement(b, id, 'DO', blocksOut, ctx) } }));
regExport('controls_if', (b, id, blocksOut, ctx) => ({ opcode: 'control_if', inputs: { CONDITION: exportValue(b, id, 'IF0', blocksOut, ctx), SUBSTACK: exportStatement(b, id, 'DO0', blocksOut, ctx) } }));
regExport('controls_ifelse', (b, id, blocksOut, ctx) => ({ opcode: 'control_if_else', inputs: { CONDITION: exportValue(b, id, 'IF0', blocksOut, ctx), SUBSTACK: exportStatement(b, id, 'DO0', blocksOut, ctx), SUBSTACK2: exportStatement(b, id, 'ELSE', blocksOut, ctx) } }));
regExport('vk_stop_all', () => ({ opcode: 'control_stop', fields: { STOP_OPTION: scratchField('all') } }));
regExport('vk_when_i_start_as_clone', () => ({ opcode: 'control_start_as_clone' }));
regExport('vk_create_clone_of', (b) => {
  const target = b.getFieldValue('TARGET');
  return { opcode: 'control_create_clone_of', fields: { CLONE_OPTION: scratchField(target === 'moi-même' ? '_myself_' : target) } };
});
regExport('vk_delete_this_clone', () => ({ opcode: 'control_delete_this_clone' }));
regExport('controls_whileUntil', (b, id, blocksOut, ctx) => {
  const mode = b.getFieldValue('MODE');
  const bodyStatement = exportStatement(b, id, 'DO', blocksOut, ctx);
  if (mode === 'UNTIL') {
    return { opcode: 'control_repeat_until', inputs: { CONDITION: exportValue(b, id, 'BOOL', blocksOut, ctx), SUBSTACK: bodyStatement } };
  }
  // "repeat while <cond>" has no direct Scratch opcode — "while X" and
  // "until not X" are logically equivalent, so wrapping the condition in a
  // NOT still round-trips to a script that behaves identically, rather than
  // silently dropping the block or the whole loop.
  const target = b.getInputTargetBlock('BOOL');
  if (!target) return { opcode: 'control_repeat_until', inputs: { SUBSTACK: bodyStatement } };
  const notId = genScratchId();
  const condId = genScratchId();
  const condBuilt = buildExportBlock(target, condId, notId, blocksOut, ctx);
  if (condBuilt) blocksOut[condId] = condBuilt;
  blocksOut[notId] = {
    opcode: 'operator_not', next: null, parent: id,
    inputs: condBuilt ? { OPERAND: [condBuilt.shadow ? 1 : 2, condId] } : {},
    fields: {}, shadow: false, topLevel: false,
  };
  return { opcode: 'control_repeat_until', inputs: { CONDITION: [2, notId], SUBSTACK: bodyStatement } };
});

// ---------- Mes blocs ----------
// `vk_procedure_def` exports via `next` (its body is chained hat-style,
// like Scratch's own `procedures_definition`), not via a normal nested
// SUBSTACK input — see `buildExportBlock`'s `shape.next` handling above and
// the import-side comment on `buildProcedureDef`.
regExport('vk_procedure_def', (b, id, blocksOut, ctx) => {
  const protoId = genScratchId();
  const procCode = b.getFieldValue('NAME') || 'bloc';
  blocksOut[protoId] = {
    opcode: 'procedures_prototype', next: null, parent: id, inputs: {}, fields: {},
    shadow: true, topLevel: false,
    mutation: { tagName: 'mutation', children: [], proccode: procCode, argumentids: '[]', argumentnames: '[]', argumentdefaults: '[]', warp: 'false' },
  };
  const bodyBlock = b.getInputTargetBlock('DO');
  const bodyFirstId = bodyBlock ? exportChain(bodyBlock, blocksOut, ctx, { parentId: id }) : null;
  return { opcode: 'procedures_definition', inputs: { custom_block: [1, protoId] }, next: bodyFirstId };
});
regExport('vk_procedure_call', (b) => ({
  opcode: 'procedures_call',
  mutation: { tagName: 'mutation', children: [], proccode: b.getFieldValue('NAME') || 'bloc', argumentids: '[]', warp: 'false' },
}));

// ---------- Détection ----------
function scratchTarget(v) {
  if (v === 'souris') return '_mouse_';
  if (v === 'bord') return '_edge_';
  return v;
}
regExport('vk_touching', (b) => ({ opcode: 'sensing_touchingobject', fields: { TOUCHINGOBJECTMENU: scratchField(scratchTarget(b.getFieldValue('TARGET'))) } }));
regExport('vk_distance_to', (b) => ({ opcode: 'sensing_distanceto', fields: { DISTANCETOMENU: scratchField(scratchTarget(b.getFieldValue('TARGET'))) } }));
regExport('vk_mouse_x', () => ({ opcode: 'sensing_mousex' }));
regExport('vk_mouse_y', () => ({ opcode: 'sensing_mousey' }));
regExport('vk_mouse_down', () => ({ opcode: 'sensing_mousedown' }));
regExport('vk_key_down', (b) => ({ opcode: 'sensing_keypressed', fields: { KEY_OPTION: scratchField(VK_KEY_TO_SCRATCH[b.getFieldValue('KEY')] || 'space') } }));

// ---------- Opérateurs ----------
const ARITH_OP_REV = { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/' };
const ARITH_OPCODE = { '+': 'operator_add', '-': 'operator_subtract', '*': 'operator_multiply', '/': 'operator_divide' };
regExport('math_arithmetic', (b, id, blocksOut, ctx) => ({
  opcode: ARITH_OPCODE[ARITH_OP_REV[b.getFieldValue('OP')]] || 'operator_add',
  inputs: { NUM1: exportValue(b, id, 'A', blocksOut, ctx), NUM2: exportValue(b, id, 'B', blocksOut, ctx) },
}));
const COMPARE_OPCODE = { EQ: 'operator_equals', GT: 'operator_gt', LT: 'operator_lt' };
regExport('logic_compare', (b, id, blocksOut, ctx) => ({
  opcode: COMPARE_OPCODE[b.getFieldValue('OP')] || 'operator_equals',
  inputs: { OPERAND1: exportValue(b, id, 'A', blocksOut, ctx), OPERAND2: exportValue(b, id, 'B', blocksOut, ctx) },
}));
regExport('logic_operation', (b, id, blocksOut, ctx) => ({
  opcode: b.getFieldValue('OP') === 'OR' ? 'operator_or' : 'operator_and',
  inputs: { OPERAND1: exportValue(b, id, 'A', blocksOut, ctx), OPERAND2: exportValue(b, id, 'B', blocksOut, ctx) },
}));
regExport('logic_negate', (b, id, blocksOut, ctx) => ({ opcode: 'operator_not', inputs: { OPERAND: exportValue(b, id, 'BOOL', blocksOut, ctx) } }));
regExport('math_random_int', (b, id, blocksOut, ctx) => ({ opcode: 'operator_random', inputs: { FROM: exportValue(b, id, 'FROM', blocksOut, ctx), TO: exportValue(b, id, 'TO', blocksOut, ctx) } }));
regExport('text_join', (b, id, blocksOut, ctx) => ({ opcode: 'operator_join', inputs: { STRING1: exportValue(b, id, 'ADD0', blocksOut, ctx), STRING2: exportValue(b, id, 'ADD1', blocksOut, ctx) } }));
regExport('text_length', (b, id, blocksOut, ctx) => ({ opcode: 'operator_length', inputs: { STRING: exportValue(b, id, 'VALUE', blocksOut, ctx) } }));
regExport('math_modulo', (b, id, blocksOut, ctx) => ({ opcode: 'operator_mod', inputs: { NUM1: exportValue(b, id, 'DIVIDEND', blocksOut, ctx), NUM2: exportValue(b, id, 'DIVISOR', blocksOut, ctx) } }));
regExport('math_round', (b, id, blocksOut, ctx) => ({ opcode: 'operator_round', inputs: { NUM: exportValue(b, id, 'NUM', blocksOut, ctx) } }));

// ---------- Variables / Listes ----------
regExport('variables_get', (b) => {
  const model = b.getField('VAR')?.getVariable?.();
  return { opcode: 'data_variable', fields: { VARIABLE: [model?.name || 'variable', model?.getId?.() || model?.id_ || null] } };
});
regExport('variables_set', (b, id, blocksOut, ctx) => {
  const model = b.getField('VAR')?.getVariable?.();
  return { opcode: 'data_setvariableto', fields: { VARIABLE: [model?.name || 'variable', model?.getId?.() || model?.id_ || null] }, inputs: { VALUE: exportValue(b, id, 'VALUE', blocksOut, ctx) } };
});
regExport('math_change', (b, id, blocksOut, ctx) => {
  const model = b.getField('VAR')?.getVariable?.();
  return { opcode: 'data_changevariableby', fields: { VARIABLE: [model?.name || 'variable', model?.getId?.() || model?.id_ || null] }, inputs: { VALUE: exportValue(b, id, 'DELTA', blocksOut, ctx) } };
});
regExport('vk_list_add', (b, id, blocksOut, ctx) => ({ opcode: 'data_addtolist', fields: { LIST: [b.getFieldValue('LIST'), null] }, inputs: { ITEM: exportValue(b, id, 'VALUE', blocksOut, ctx) } }));
regExport('vk_list_delete_item', (b, id, blocksOut, ctx) => ({ opcode: 'data_deleteoflist', fields: { LIST: [b.getFieldValue('LIST'), null] }, inputs: { INDEX: exportValue(b, id, 'INDEX', blocksOut, ctx) } }));
regExport('vk_list_delete_all', (b) => ({ opcode: 'data_deletealloflist', fields: { LIST: [b.getFieldValue('LIST'), null] } }));
regExport('vk_list_insert', (b, id, blocksOut, ctx) => ({ opcode: 'data_insertatlist', fields: { LIST: [b.getFieldValue('LIST'), null] }, inputs: { ITEM: exportValue(b, id, 'VALUE', blocksOut, ctx), INDEX: exportValue(b, id, 'INDEX', blocksOut, ctx) } }));
regExport('vk_list_replace', (b, id, blocksOut, ctx) => ({ opcode: 'data_replaceitemoflist', fields: { LIST: [b.getFieldValue('LIST'), null] }, inputs: { INDEX: exportValue(b, id, 'INDEX', blocksOut, ctx), ITEM: exportValue(b, id, 'VALUE', blocksOut, ctx) } }));
regExport('vk_list_item', (b, id, blocksOut, ctx) => ({ opcode: 'data_itemoflist', fields: { LIST: [b.getFieldValue('LIST'), null] }, inputs: { INDEX: exportValue(b, id, 'INDEX', blocksOut, ctx) } }));
regExport('vk_list_length', (b) => ({ opcode: 'data_lengthoflist', fields: { LIST: [b.getFieldValue('LIST'), null] } }));
regExport('vk_list_contains', (b, id, blocksOut, ctx) => ({ opcode: 'data_listcontainsitem', fields: { LIST: [b.getFieldValue('LIST'), null] }, inputs: { ITEM: exportValue(b, id, 'VALUE', blocksOut, ctx) } }));
regExport('vk_list_index_of', (b, id, blocksOut, ctx) => ({ opcode: 'data_itemnumoflist', fields: { LIST: [b.getFieldValue('LIST'), null] }, inputs: { ITEM: exportValue(b, id, 'VALUE', blocksOut, ctx) } }));

// ---------- Stylo ----------
regExport('vk_pen_clear', () => ({ opcode: 'pen_clear' }));
regExport('vk_pen_stamp', () => ({ opcode: 'pen_stamp' }));
regExport('vk_pen_down', () => ({ opcode: 'pen_penDown' }));
regExport('vk_pen_up', () => ({ opcode: 'pen_penUp' }));
regExport('vk_pen_set_color', (b, id, blocksOut) => {
  const colourId = genScratchId();
  blocksOut[colourId] = { opcode: 'colour_picker', next: null, parent: id, inputs: {}, fields: { COLOUR: scratchField(b.getFieldValue('COLOR')) }, shadow: true, topLevel: false };
  return { opcode: 'pen_setPenColorToColor', inputs: { COLOR: [1, colourId] } };
});

// ---------- Son ----------
regExport('vk_play_sound', (b) => ({ opcode: 'sound_play', fields: { SOUND_MENU: scratchField(b.getFieldValue('NAME')) } }));
regExport('vk_play_sound_until_done', (b) => ({ opcode: 'sound_playuntildone', fields: { SOUND_MENU: scratchField(b.getFieldValue('NAME')) } }));
regExport('vk_stop_all_sounds', () => ({ opcode: 'sound_stopallsounds' }));
regExport('vk_set_volume', (b, id, blocksOut, ctx) => ({ opcode: 'sound_setvolumeto', inputs: { VOLUME: exportValue(b, id, 'VOLUME', blocksOut, ctx) } }));
regExport('vk_change_volume', (b, id, blocksOut, ctx) => ({ opcode: 'sound_changevolumeby', inputs: { VOLUME: exportValue(b, id, 'VOLUME', blocksOut, ctx) } }));
regExport('vk_volume', () => ({ opcode: 'sound_volume' }));

// ---------- JSON ----------
// Exports back to the same third-party `skyhigh173JSON_*` opcode namespace
// used on import — round-trips correctly if the destination project also
// has that TurboWarp extension loaded; opens as unrecognized blocks
// otherwise (an inherent limit of reusing a third-party extension's own
// opcodes rather than inventing a Vakar-only namespace TurboWarp wouldn't
// recognize either).
regExport('vk_json_get', (b, id, blocksOut, ctx) => ({ opcode: 'skyhigh173JSON_json_get', inputs: { json: exportValue(b, id, 'JSON', blocksOut, ctx), item: exportValue(b, id, 'KEY', blocksOut, ctx) } }));
regExport('vk_json_array_get', (b, id, blocksOut, ctx) => ({ opcode: 'skyhigh173JSON_json_array_get', inputs: { json: exportValue(b, id, 'JSON', blocksOut, ctx), item: exportValue(b, id, 'INDEX', blocksOut, ctx) } }));
regExport('vk_json_set', (b, id, blocksOut, ctx) => ({ opcode: 'skyhigh173JSON_json_set', inputs: { json: exportValue(b, id, 'JSON', blocksOut, ctx), item: exportValue(b, id, 'KEY', blocksOut, ctx), value: exportValue(b, id, 'VALUE', blocksOut, ctx) } }));
regExport('vk_json_array_push', (b, id, blocksOut, ctx) => ({ opcode: 'skyhigh173JSON_json_array_push', inputs: { json: exportValue(b, id, 'JSON', blocksOut, ctx), item: exportValue(b, id, 'VALUE', blocksOut, ctx) } }));
regExport('vk_json_keys', (b, id, blocksOut, ctx) => ({ opcode: 'skyhigh173JSON_json_get_all', fields: { Stype: scratchField('keys') }, inputs: { json: exportValue(b, id, 'JSON', blocksOut, ctx) } }));
regExport('vk_json_values', (b, id, blocksOut, ctx) => ({ opcode: 'skyhigh173JSON_json_get_all', fields: { Stype: scratchField('values') }, inputs: { json: exportValue(b, id, 'JSON', blocksOut, ctx) } }));
regExport('vk_json_length', (b, id, blocksOut, ctx) => ({ opcode: 'skyhigh173JSON_json_length', inputs: { json: exportValue(b, id, 'JSON', blocksOut, ctx) } }));

// Exports one sprite's stored Blockly workspace JSON into Scratch-shaped
// `{blocks, variables}` for its target entry. `topXOffset` just fans
// multiple top-level scripts out horizontally so they don't stack exactly
// on top of each other in Scratch's own editor.
export function exportSpriteWorkspace(workspaceState, warnings) {
  const ws = new Blockly.Workspace();
  if (workspaceState) {
    try { Blockly.serialization.workspaces.load(workspaceState, ws); } catch (err) { warnings.add(`chargement de l'espace de travail: ${err.message}`); }
  }
  const blocks = {};
  const variables = {};
  const ctx = { warnings };
  const topBlocks = ws.getTopBlocks(true);
  topBlocks.forEach((b, i) => {
    const xy = b.getRelativeToSurfaceXY ? b.getRelativeToSurfaceXY() : { x: i * 300, y: 0 };
    exportChain(b, blocks, ctx, { topXY: { x: xy.x || i * 300, y: xy.y || 0 } });
  });
  for (const v of ws.getVariableMap().getAllVariables()) {
    variables[v.getId()] = [v.getName(), 0];
  }
  ws.dispose();
  return { blocks, variables };
}

export { md5, genScratchId };
