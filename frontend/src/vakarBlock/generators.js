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
forBlock['vk_x_position'] = function (block, generator) {
  return ['sprite.x', Order.MEMBER];
};
forBlock['vk_y_position'] = function (block, generator) {
  return ['sprite.y', Order.MEMBER];
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
forBlock['vk_show'] = () => 'sprite.setVisible(true);\n';
forBlock['vk_hide'] = () => 'sprite.setVisible(false);\n';

// ---------- Contrôle ----------
forBlock['vk_wait_secs'] = function (block, generator) {
  const secs = generator.valueToCode(block, 'SECS', Order.NONE) || '0';
  return `yield* runtime.wait(${secs});\n`;
};
forBlock['vk_forever'] = function (block, generator) {
  const body = generator.statementToCode(block, 'DO');
  return `while (true) {\n${body}yield;\n}\n`;
};
forBlock['vk_stop_all'] = () => 'runtime.stopAll(); return;\n';

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

export { javascriptGenerator, Order };
