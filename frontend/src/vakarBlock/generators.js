import { javascriptGenerator, Order } from 'blockly/javascript';

// ============================================================
// VAKAR BLOCK — JS code generators for the custom blocks in blocks.js.
// Generated code calls into the small runtime API (`sprite.*`, `runtime.*`)
// that runtime.js exposes to every compiled script. Only `vk_wait_secs` and
// `vk_forever` actually `yield` — everything else is a cheap synchronous
// state mutation, so a script only pauses real time where the author put a
// wait/loop, exactly like Scratch.
// ============================================================

const forBlock = javascriptGenerator.forBlock;

// ---------- Événements ----------
// Hat blocks contribute no code of their own — runtime.js compiles the
// chain of blocks *after* the hat, not the hat itself.
forBlock['vk_when_green_flag'] = () => '';
forBlock['vk_when_key_pressed'] = () => '';
forBlock['vk_when_sprite_clicked'] = () => '';
forBlock['vk_when_i_receive'] = () => '';
forBlock['vk_broadcast'] = function (block) {
  return `runtime.broadcast(${JSON.stringify(block.getFieldValue('MESSAGE'))});\n`;
};
forBlock['vk_when_backdrop_switches_to'] = () => '';

// ---------- Mouvement ----------
forBlock['vk_move_steps'] = function (block, generator) {
  const steps = generator.valueToCode(block, 'STEPS', Order.NONE) || '0';
  return `sprite.moveSteps(${steps});\n`;
};
forBlock['vk_turn_right'] = function (block, generator) {
  const deg = generator.valueToCode(block, 'DEGREES', Order.NONE) || '0';
  return `sprite.turn(${deg});\n`;
};
forBlock['vk_turn_left'] = function (block, generator) {
  const deg = generator.valueToCode(block, 'DEGREES', Order.NONE) || '0';
  return `sprite.turn(-(${deg}));\n`;
};
forBlock['vk_go_to_xy'] = function (block, generator) {
  const x = generator.valueToCode(block, 'X', Order.NONE) || '0';
  const y = generator.valueToCode(block, 'Y', Order.NONE) || '0';
  return `sprite.goTo(${x}, ${y});\n`;
};
forBlock['vk_glide_to_xy'] = function (block, generator) {
  const secs = generator.valueToCode(block, 'SECS', Order.NONE) || '0';
  const x = generator.valueToCode(block, 'X', Order.NONE) || '0';
  const y = generator.valueToCode(block, 'Y', Order.NONE) || '0';
  return `yield* sprite.glideTo(${secs}, ${x}, ${y});\n`;
};
forBlock['vk_go_to'] = function (block) {
  return `runtime.goToTarget(sprite, ${JSON.stringify(block.getFieldValue('TARGET'))});\n`;
};
forBlock['vk_point_towards'] = function (block) {
  return `runtime.pointTowards(sprite, ${JSON.stringify(block.getFieldValue('TARGET'))});\n`;
};
forBlock['vk_x_position'] = function (block, generator) {
  return ['sprite.x', Order.MEMBER];
};
forBlock['vk_y_position'] = function (block, generator) {
  return ['sprite.y', Order.MEMBER];
};
forBlock['vk_change_x_by'] = function (block, generator) {
  const dx = generator.valueToCode(block, 'DX', Order.NONE) || '0';
  return `sprite.changeXBy(${dx});\n`;
};
forBlock['vk_change_y_by'] = function (block, generator) {
  const dy = generator.valueToCode(block, 'DY', Order.NONE) || '0';
  return `sprite.changeYBy(${dy});\n`;
};
forBlock['vk_point_in_direction'] = function (block, generator) {
  const dir = generator.valueToCode(block, 'DIRECTION', Order.NONE) || '90';
  return `sprite.pointInDirection(${dir});\n`;
};
forBlock['vk_set_rotation_style'] = function (block) {
  return `sprite.setRotationStyle(${JSON.stringify(block.getFieldValue('STYLE'))});\n`;
};

// ---------- Apparence ----------
forBlock['vk_say_for_secs'] = function (block, generator) {
  const text = generator.valueToCode(block, 'TEXT', Order.NONE) || "''";
  const secs = generator.valueToCode(block, 'SECS', Order.NONE) || '0';
  return `yield* sprite.sayFor(${text}, ${secs});\n`;
};
forBlock['vk_say'] = function (block, generator) {
  const text = generator.valueToCode(block, 'TEXT', Order.NONE) || "''";
  return `sprite.say(${text});\n`;
};
forBlock['vk_next_costume'] = () => 'sprite.nextCostume();\n';
forBlock['vk_switch_costume'] = function (block, generator) {
  const name = generator.valueToCode(block, 'NAME', Order.NONE) || "''";
  return `sprite.switchCostume(${name});\n`;
};
forBlock['vk_change_size'] = function (block, generator) {
  const delta = generator.valueToCode(block, 'DELTA', Order.NONE) || '0';
  return `sprite.changeSize(${delta});\n`;
};
forBlock['vk_set_size'] = function (block, generator) {
  const size = generator.valueToCode(block, 'SIZE', Order.NONE) || '100';
  return `sprite.setSize(${size});\n`;
};
forBlock['vk_switch_backdrop'] = function (block, generator) {
  const name = generator.valueToCode(block, 'NAME', Order.NONE) || "''";
  return `runtime.switchBackdrop(${name});\n`;
};
forBlock['vk_show'] = () => 'sprite.setVisible(true);\n';
forBlock['vk_hide'] = () => 'sprite.setVisible(false);\n';
forBlock['vk_costume_number'] = () => ['sprite.costumeNumber', Order.MEMBER];
forBlock['vk_costume_name'] = () => ["(sprite.currentCostume ? sprite.currentCostume.name : '')", Order.NONE];
forBlock['vk_set_effect'] = function (block, generator) {
  const value = generator.valueToCode(block, 'VALUE', Order.NONE) || '0';
  return `sprite.setEffect(${JSON.stringify(block.getFieldValue('EFFECT'))}, ${value});\n`;
};
forBlock['vk_change_effect'] = function (block, generator) {
  const value = generator.valueToCode(block, 'CHANGE', Order.NONE) || '0';
  return `sprite.changeEffect(${JSON.stringify(block.getFieldValue('EFFECT'))}, ${value});\n`;
};
forBlock['vk_clear_graphic_effects'] = () => 'sprite.clearGraphicEffects();\n';
forBlock['vk_go_to_front_back'] = function (block) {
  return `runtime.goToFrontBack(sprite, ${JSON.stringify(block.getFieldValue('FRONT_BACK'))});\n`;
};

// ---------- Contrôle ----------
forBlock['vk_wait_secs'] = function (block, generator) {
  const secs = generator.valueToCode(block, 'SECS', Order.NONE) || '0';
  return `yield* runtime.wait(${secs});\n`;
};
forBlock['vk_forever'] = function (block, generator) {
  const body = generator.statementToCode(block, 'DO');
  return `while (true) {\n${body}yield;\n}\n`;
};
// Override Blockly's own stock generator for controls_whileUntil (used for
// Scratch's "repeat until", reused here for round 6's sb3 import — see
// sb3.js). The stock JS generator emits a plain synchronous `while` loop
// with NO yield at all (confirmed by inspecting its actual output) — fine
// for normal JS, but fatal here: every hat compiles to a JS generator
// function driven one `.next()` per animation frame, so a loop with no
// yield inside it runs to completion (or hangs forever) in a single frame,
// freezing the whole cooperative scheduler exactly like a raw `while(true)`
// would if `vk_forever` didn't yield either. Same fix, same shape.
forBlock['controls_whileUntil'] = function (block, generator) {
  const mode = block.getFieldValue('MODE');
  const cond = generator.valueToCode(block, 'BOOL', Order.NONE) || 'false';
  const body = generator.statementToCode(block, 'DO');
  const test = mode === 'UNTIL' ? `!(${cond})` : cond;
  return `while (${test}) {\n${body}yield;\n}\n`;
};
forBlock['vk_stop_all'] = () => 'runtime.stopAll(); return;\n';
forBlock['vk_stop_this_script'] = () => 'return;\n';
forBlock['vk_wait_until'] = function (block, generator) {
  const cond = generator.valueToCode(block, 'CONDITION', Order.NONE) || 'false';
  return `while (!(${cond})) { yield; }\n`;
};

// ---------- Clones ----------
forBlock['vk_when_i_start_as_clone'] = () => '';
forBlock['vk_create_clone_of'] = function (block) {
  return `runtime.createClone(sprite, ${JSON.stringify(block.getFieldValue('TARGET'))});\n`;
};
forBlock['vk_delete_this_clone'] = () => 'runtime.deleteClone(sprite.id); return;\n';

// ---------- Détection ----------
forBlock['vk_touching'] = function (block) {
  return [`runtime.touching(sprite, ${JSON.stringify(block.getFieldValue('TARGET'))})`, Order.FUNCTION_CALL];
};
forBlock['vk_distance_to'] = function (block) {
  return [`runtime.distanceTo(sprite, ${JSON.stringify(block.getFieldValue('TARGET'))})`, Order.FUNCTION_CALL];
};
forBlock['vk_mouse_x'] = () => ['runtime.mouseX', Order.MEMBER];
forBlock['vk_mouse_y'] = () => ['runtime.mouseY', Order.MEMBER];
forBlock['vk_mouse_down'] = () => ['runtime.mouseDown', Order.MEMBER];
forBlock['vk_key_down'] = function (block) {
  return [`runtime.isKeyDown(${JSON.stringify(block.getFieldValue('KEY'))})`, Order.FUNCTION_CALL];
};

// ---------- Listes ----------
// Same name-based approach as `vk_switch_costume`/variables above — a list
// is just `sprite.vars[name]` expected to hold an array; `runtime.list()`
// lazily creates it. 1-indexed (item 1 is the first item), matching
// Scratch's own convention rather than JS's 0-indexing.
function listName(block) {
  return JSON.stringify(block.getFieldValue('LIST'));
}
forBlock['vk_list_add'] = function (block, generator) {
  const value = generator.valueToCode(block, 'VALUE', Order.NONE) || "''";
  return `runtime.list(sprite, ${listName(block)}).push(${value});\n`;
};
forBlock['vk_list_delete_item'] = function (block, generator) {
  const index = generator.valueToCode(block, 'INDEX', Order.NONE) || '1';
  return `runtime.list(sprite, ${listName(block)}).splice((${index}) - 1, 1);\n`;
};
forBlock['vk_list_delete_all'] = function (block) {
  return `runtime.list(sprite, ${listName(block)}).length = 0;\n`;
};
forBlock['vk_list_insert'] = function (block, generator) {
  const value = generator.valueToCode(block, 'VALUE', Order.NONE) || "''";
  const index = generator.valueToCode(block, 'INDEX', Order.NONE) || '1';
  return `runtime.list(sprite, ${listName(block)}).splice((${index}) - 1, 0, ${value});\n`;
};
forBlock['vk_list_replace'] = function (block, generator) {
  const index = generator.valueToCode(block, 'INDEX', Order.NONE) || '1';
  const value = generator.valueToCode(block, 'VALUE', Order.NONE) || "''";
  return `runtime.list(sprite, ${listName(block)}).splice((${index}) - 1, 1, ${value});\n`;
};
forBlock['vk_list_item'] = function (block, generator) {
  const index = generator.valueToCode(block, 'INDEX', Order.NONE) || '1';
  return [`runtime.list(sprite, ${listName(block)})[(${index}) - 1]`, Order.MEMBER];
};
forBlock['vk_list_length'] = function (block) {
  return [`runtime.list(sprite, ${listName(block)}).length`, Order.MEMBER];
};
forBlock['vk_list_contains'] = function (block, generator) {
  const value = generator.valueToCode(block, 'VALUE', Order.NONE) || "''";
  return [`runtime.list(sprite, ${listName(block)}).includes(${value})`, Order.FUNCTION_CALL];
};
forBlock['vk_list_index_of'] = function (block, generator) {
  const value = generator.valueToCode(block, 'VALUE', Order.NONE) || "''";
  return [`(runtime.list(sprite, ${listName(block)}).indexOf(${value}) + 1)`, Order.ADDITION];
};

// ---------- Stylo ----------
forBlock['vk_pen_down'] = () => 'sprite.setPenDown(true);\n';
forBlock['vk_pen_up'] = () => 'sprite.setPenDown(false);\n';
forBlock['vk_pen_clear'] = () => 'runtime.clearPen();\n';
forBlock['vk_pen_set_color'] = function (block) {
  return `sprite.setPenColor(${JSON.stringify(block.getFieldValue('COLOR'))});\n`;
};
forBlock['vk_pen_stamp'] = () => 'runtime.stamp(sprite);\n';

// ---------- Variables (override the stock generators) ----------
// Blockly's default variable generators emit bare JS identifiers scoped to
// one `workspaceToCode()` call. Each of our hat-blocks compiles to its own
// independent `new Function(...)`, so a bare identifier can't be shared
// between two concurrently-running scripts on the same sprite. Instead we
// route every variable read/write through `sprite.vars[name]` — since the
// same `sprite` instance is passed into every script for that sprite, this
// makes variables genuinely shared/live across all of a sprite's scripts,
// matching Scratch's own "this sprite only" variable semantics.
function varName(block) {
  const field = block.getField('VAR');
  return JSON.stringify(field ? field.getText() : 'variable');
}
forBlock['variables_get'] = function (block) {
  return [`(sprite.vars[${varName(block)}] ?? 0)`, Order.FUNCTION_CALL];
};
forBlock['variables_set'] = function (block, generator) {
  const value = generator.valueToCode(block, 'VALUE', Order.ASSIGNMENT) || '0';
  return `sprite.vars[${varName(block)}] = ${value};\n`;
};
forBlock['math_change'] = function (block, generator) {
  const value = generator.valueToCode(block, 'DELTA', Order.ADDITION) || '0';
  const name = varName(block);
  return `sprite.vars[${name}] = (sprite.vars[${name}] ?? 0) + (${value});\n`;
};

// ---------- Son ----------
forBlock['vk_play_sound'] = function (block) {
  return `runtime.playSound(sprite, ${JSON.stringify(block.getFieldValue('NAME'))});\n`;
};
forBlock['vk_play_sound_until_done'] = function (block) {
  return `yield* runtime.playSoundUntilDone(sprite, ${JSON.stringify(block.getFieldValue('NAME'))});\n`;
};
forBlock['vk_stop_all_sounds'] = () => 'runtime.stopAllSounds();\n';
forBlock['vk_set_volume'] = function (block, generator) {
  const v = generator.valueToCode(block, 'VOLUME', Order.NONE) || '100';
  return `sprite.setVolume(${v});\n`;
};
forBlock['vk_change_volume'] = function (block, generator) {
  const v = generator.valueToCode(block, 'VOLUME', Order.NONE) || '0';
  return `sprite.changeVolume(${v});\n`;
};
forBlock['vk_volume'] = () => ['sprite.volume', Order.MEMBER];

// ---------- Mes blocs ----------
// Named, no-parameter reusable sequences. `vk_procedure_def` compiles to a
// real JS generator-function DECLARATION (function* proc_name(sprite,
// runtime) {...}) — runtime.js's compileSprite() collects every top-level
// def block's generated code and prepends it into *every* compiled hat's
// function body (JS function declarations hoist within their containing
// scope, so a call site doesn't care about source order). `yield*`
// delegation on the call means a procedure's own waits/loops still
// cooperate correctly with the rest of the concurrency model.
function safeProcName(name) {
  return `proc_${String(name || 'bloc').replace(/[^a-zA-Z0-9_]/g, '_')}`;
}
forBlock['vk_procedure_def'] = function (block, generator) {
  const body = generator.statementToCode(block, 'DO');
  return `function* ${safeProcName(block.getFieldValue('NAME'))}(sprite, runtime) {\n${body}}\n`;
};
forBlock['vk_procedure_call'] = function (block) {
  return `yield* ${safeProcName(block.getFieldValue('NAME'))}(sprite, runtime);\n`;
};

forBlock['vk_text_contains'] = function (block, generator) {
  const a = generator.valueToCode(block, 'STRING1', Order.NONE) || "''";
  const b = generator.valueToCode(block, 'STRING2', Order.NONE) || "''";
  return [`String(${a}).toLowerCase().includes(String(${b}).toLowerCase())`, Order.FUNCTION_CALL];
};

// ---------- JSON ----------
// Pure functions on JSON *text* — no sprite/runtime state, so unlike every
// other reporter above these are generated as self-contained inline IIFEs
// rather than calling into runtime.js. `json_set`/`json_array_push` return
// a NEW json string rather than mutating anything (see blocks.js's
// tooltip/comment — verified against a real project's usage pattern of the
// third-party extension these came from). Value coercion tries JSON.parse
// first (so setting a numeric-looking value stores a real number, matching
// what the extension appeared to do) and falls back to the raw string.
forBlock['vk_json_get'] = function (block, generator) {
  const json = generator.valueToCode(block, 'JSON', Order.NONE) || "'{}'";
  const key = generator.valueToCode(block, 'KEY', Order.NONE) || "''";
  return [`(function(){try{var o=JSON.parse(${json});return (o&&typeof o==='object')?(o[${key}] ?? ''):'';}catch(e){return '';}})()`, Order.FUNCTION_CALL];
};
forBlock['vk_json_set'] = function (block, generator) {
  const json = generator.valueToCode(block, 'JSON', Order.NONE) || "'{}'";
  const key = generator.valueToCode(block, 'KEY', Order.NONE) || "''";
  const value = generator.valueToCode(block, 'VALUE', Order.NONE) || "''";
  return [`(function(){try{var o=JSON.parse(${json})||{};var v=${value};var pv;try{pv=JSON.parse(v);}catch(e2){pv=v;}o[${key}]=pv;return JSON.stringify(o);}catch(e){return ${json};}})()`, Order.FUNCTION_CALL];
};
forBlock['vk_json_array_get'] = function (block, generator) {
  const json = generator.valueToCode(block, 'JSON', Order.NONE) || "'[]'";
  const index = generator.valueToCode(block, 'INDEX', Order.NONE) || '1';
  return [`(function(){try{var a=JSON.parse(${json});return Array.isArray(a)?(a[(${index})-1] ?? ''):'';}catch(e){return '';}})()`, Order.FUNCTION_CALL];
};
forBlock['vk_json_array_push'] = function (block, generator) {
  const json = generator.valueToCode(block, 'JSON', Order.NONE) || "'[]'";
  const value = generator.valueToCode(block, 'VALUE', Order.NONE) || "''";
  return [`(function(){try{var a=JSON.parse(${json});if(!Array.isArray(a))a=[];var v=${value};var pv;try{pv=JSON.parse(v);}catch(e2){pv=v;}a.push(pv);return JSON.stringify(a);}catch(e){return ${json};}})()`, Order.FUNCTION_CALL];
};
forBlock['vk_json_keys'] = function (block, generator) {
  const json = generator.valueToCode(block, 'JSON', Order.NONE) || "'{}'";
  return [`(function(){try{var o=JSON.parse(${json});return JSON.stringify(o&&typeof o==='object'?Object.keys(o):[]);}catch(e){return '[]';}})()`, Order.FUNCTION_CALL];
};
forBlock['vk_json_values'] = function (block, generator) {
  const json = generator.valueToCode(block, 'JSON', Order.NONE) || "'{}'";
  return [`(function(){try{var o=JSON.parse(${json});return JSON.stringify(o&&typeof o==='object'?Object.values(o):[]);}catch(e){return '[]';}})()`, Order.FUNCTION_CALL];
};
forBlock['vk_json_length'] = function (block, generator) {
  const json = generator.valueToCode(block, 'JSON', Order.NONE) || "'[]'";
  return [`(function(){try{var v=JSON.parse(${json});if(Array.isArray(v))return v.length;if(v&&typeof v==='object')return Object.keys(v).length;return String(v).length;}catch(e){return 0;}})()`, Order.FUNCTION_CALL];
};

// ---------- VakarGames ----------
forBlock['vk_vg_configure_files'] = function (block) {
  return `runtime.vgConfigureFiles(${JSON.stringify(block.getFieldValue('SLUG'))}, ${JSON.stringify(block.getFieldValue('KEY'))});\n`;
};
forBlock['vk_vg_use_version'] = function (block) {
  return `runtime.vgUseVersion(${JSON.stringify(block.getFieldValue('V'))});\n`;
};
forBlock['vk_vg_load_costume_by_id'] = function (block) {
  return `yield* runtime.vgLoadCostumeById(sprite, ${JSON.stringify(block.getFieldValue('ID'))}, ${JSON.stringify(block.getFieldValue('SPRITE'))});\n`;
};
forBlock['vk_vg_remove_all_costumes'] = function (block) {
  return `runtime.vgRemoveAllCostumes(sprite, ${JSON.stringify(block.getFieldValue('SPRITE'))});\n`;
};
forBlock['vk_vg_show_text'] = function (block, generator) {
  const texte = generator.valueToCode(block, 'TEXTE', Order.NONE) || "''";
  const x = generator.valueToCode(block, 'X', Order.NONE) || '0';
  const y = generator.valueToCode(block, 'Y', Order.NONE) || '0';
  const taille = generator.valueToCode(block, 'TAILLE', Order.NONE) || '24';
  const id = JSON.stringify(block.getFieldValue('ID'));
  const police = JSON.stringify(block.getFieldValue('POLICE'));
  const couleur = JSON.stringify(block.getFieldValue('COULEUR'));
  const gras = JSON.stringify(block.getFieldValue('GRAS') === 'oui');
  const italique = JSON.stringify(block.getFieldValue('ITALIQUE') === 'oui');
  const visible = JSON.stringify(block.getFieldValue('VISIBLE') !== 'non');
  return `runtime.vgShowText(${id}, { text: ${texte}, x: ${x}, y: ${y}, size: ${taille}, font: ${police}, color: ${couleur}, bold: ${gras}, italic: ${italique}, visible: ${visible} });\n`;
};
forBlock['vk_vg_set_text_visible'] = function (block) {
  const visible = JSON.stringify(block.getFieldValue('VISIBLE') !== 'non');
  return `runtime.vgSetTextVisible(${JSON.stringify(block.getFieldValue('ID'))}, ${visible});\n`;
};
forBlock['vk_vg_play_configure'] = function (block) {
  return `yield* runtime.vgPlayConfigure(${JSON.stringify(block.getFieldValue('SLUG'))});\n`;
};
forBlock['vk_vg_play_show_login'] = () => 'yield* runtime.vgPlayShowLogin();\n';
forBlock['vk_vg_play_is_connected'] = () => ['runtime.vgPlayIsConnected()', Order.FUNCTION_CALL];
forBlock['vk_vg_play_disconnect'] = () => 'runtime.vgPlayDisconnect();\n';
forBlock['vk_vg_play_save'] = function (block, generator) {
  const donnees = generator.valueToCode(block, 'DONNEES', Order.NONE) || "'{}'";
  return `yield* runtime.vgPlaySave(${JSON.stringify(block.getFieldValue('CATEGORIE'))}, ${donnees});\n`;
};
forBlock['vk_vg_play_load'] = function (block) {
  return `yield* runtime.vgPlayLoad(sprite, ${JSON.stringify(block.getFieldValue('CATEGORIE'))}, ${JSON.stringify(block.getFieldValue('VAR'))});\n`;
};
forBlock['vk_vg_play_open_loading'] = function (block, generator) {
  const max = generator.valueToCode(block, 'MAX', Order.NONE) || '10';
  return `runtime.vgPlayOpenLoading(${max});\n`;
};
forBlock['vk_vg_play_close_loading'] = () => 'runtime.vgPlayCloseLoading();\n';

export { javascriptGenerator, Order };
