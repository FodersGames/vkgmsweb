import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import { Order } from 'blockly/javascript';
import './fields';

// ============================================================
// APP BUILDER BLOCKS — custom block definitions for the Studio App
// Builder's action system (replaces the old flat ActionEditor/
// ActionStepFields step list — see AppBuilderEditor.js). Mirrors Vakar
// Block's own architecture (frontend/src/vakarBlock/blocks.js): stock
// Blockly blocks reused wholesale for anything generic (if/else, repeat,
// math, logic, text, variable get/set), only domain-specific `ab_*` blocks
// defined here.
//
// One block, one operation: every block here does exactly one thing (no
// mode/behavior dropdowns bundling several distinct actions into one block,
// e.g. "add to list" is three separate blocks — add-to-end/add-to-start/
// insert-at-position — not one block with an ADD/PREPEND/INSERT dropdown).
// This matches MIT App Inventor's own block palette philosophy and is
// deliberately simpler to read/compose than the terser Scratch convention.
//
// English labels (App Builder's UI is English, unlike Vakar Block's French
// Scratch-style editor) — no Blockly.setLocale() call needed, core ships
// with English messages built in.
// ============================================================

export const COLORS = {
  events: '#FFBF00',
  navigate: '#2F80ED',
  variables: '#F2A93B',
  math: '#5B9E56',
  text: '#EB5757',
  elements: '#9966FF',
  lists: '#CF63CF',
  feedback: '#5CB1D6',
  device: '#3D8EBF',
  links: '#4ECDC4',
  datetime: '#B08968',
  logic: '#59C059',
  control: '#FFAB19',
  storage: '#8395A7',
  item: '#2F9E44',
  network: '#457B9D',
  secrets: '#6D597A',
  data: '#E07A5F',
};

const jsonBlocks = [
  // ============================================================
  // Events — hat blocks (Scratch/MIT-App-Inventor style): each element (or
  // screen) has exactly ONE Blockly workspace, which can hold several of
  // these, one per thing that can happen to it (a button can have "when
  // clicked" AND "when pressed down" AND "when released" side by side).
  // Only the blocks chained BELOW a hat run when that hat's event actually
  // fires — a floating stack with no hat above it is never called by the
  // app at all (see generators.js's compileNodeBlocks, which only compiles
  // top-level chains that start with one of these). `nextStatement` only —
  // a hat can never be attached below another block.
  // ============================================================
  {
    type: 'ab_when_clicked',
    message0: '👆 when clicked',
    nextStatement: null,
    colour: COLORS.events,
    tooltip: 'Runs when this element is clicked/tapped.',
  },
  {
    type: 'ab_when_pressed',
    message0: '👇 when pressed down',
    nextStatement: null,
    colour: COLORS.events,
    tooltip: 'Runs the instant the finger/mouse button goes down — before it’s released.',
  },
  {
    type: 'ab_when_released',
    message0: '☝️ when released',
    nextStatement: null,
    colour: COLORS.events,
    tooltip: 'Runs when the finger/mouse button lifts back up.',
  },
  {
    type: 'ab_when_changed',
    message0: '🔄 when value changes',
    nextStatement: null,
    colour: COLORS.events,
    tooltip: 'Runs whenever this element’s value changes.',
  },
  {
    type: 'ab_when_row_tapped',
    message0: '👆 when a row is tapped',
    nextStatement: null,
    colour: COLORS.events,
    tooltip: 'Runs when the visitor taps one of this list’s rows — use the "This item" blocks below to read what was tapped.',
  },
  {
    type: 'ab_when_screen_opens',
    message0: '🏁 when this screen opens',
    nextStatement: null,
    colour: COLORS.events,
    tooltip: 'Runs once, every time this screen becomes visible (including when the app first opens on it).',
  },

  // ============================================================
  // Navigate
  // ============================================================
  {
    type: 'ab_navigate',
    message0: 'go to screen %1',
    args0: [{ type: 'field_ab_screen', name: 'SCREEN' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.navigate,
    tooltip: 'Switches to a different screen.',
  },
  {
    type: 'ab_close_app',
    message0: 'close the app',
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.navigate,
    tooltip: 'Attempts to close the app. Only works in limited cases (e.g. a window the app itself opened) — browsers don’t allow a normal page to close itself or a real device to quit an app from a webpage.',
  },

  // ============================================================
  // Variables & Math
  // ============================================================
  // App Builder variables are declared centrally (the Variables panel in
  // AppBuilderEditor.js's sidebar, a flat {name, initial_value} list), not
  // through Blockly's own variable-creation UI — so get/set/change use plain
  // field_input name fields instead of reusing Blockly's stock
  // variables_get/variables_set/math_change, which are hard-wired to
  // Blockly's own separate variable model and would give users two
  // conflicting places to manage variables.
  {
    type: 'ab_get_variable',
    message0: '%1',
    args0: [{ type: 'field_input', name: 'VAR', text: 'variable' }],
    output: null,
    colour: COLORS.variables,
    tooltip: 'Reads a variable’s current value.',
  },
  {
    type: 'ab_set_variable',
    message0: 'set %1 to %2',
    args0: [
      { type: 'field_input', name: 'VAR', text: 'variable' },
      { type: 'input_value', name: 'VALUE' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.variables,
    tooltip: 'Sets a variable to a value.',
  },
  {
    type: 'ab_change_variable',
    message0: 'change %1 by %2',
    args0: [
      { type: 'field_input', name: 'VAR', text: 'variable' },
      { type: 'input_value', name: 'DELTA', check: 'Number' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.variables,
    tooltip: 'Adds (or subtracts, with a negative number) to a numeric variable.',
  },
  {
    type: 'ab_toggle_variable',
    message0: 'toggle %1',
    args0: [{ type: 'field_input', name: 'VAR', text: 'variable' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.variables,
    tooltip: 'Flips a "true"/"false" variable to its opposite value.',
  },
  {
    type: 'ab_reset_variables',
    message0: 'reset all variables',
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.variables,
    tooltip: 'Resets every variable back to its starting value.',
  },
  // ---------- Math ----------
  {
    type: 'ab_random_number',
    message0: 'random number from %1 to %2',
    args0: [
      { type: 'input_value', name: 'A', check: 'Number' },
      { type: 'input_value', name: 'B', check: 'Number' },
    ],
    output: 'Number',
    colour: COLORS.math,
    tooltip: 'A random whole number between the two values (inclusive).',
  },
  {
    type: 'ab_round',
    message0: 'round %1',
    args0: [{ type: 'input_value', name: 'NUM', check: 'Number' }],
    output: 'Number',
    colour: COLORS.math,
  },
  {
    type: 'ab_round_up',
    message0: 'round up %1',
    args0: [{ type: 'input_value', name: 'NUM', check: 'Number' }],
    output: 'Number',
    colour: COLORS.math,
  },
  {
    type: 'ab_round_down',
    message0: 'round down %1',
    args0: [{ type: 'input_value', name: 'NUM', check: 'Number' }],
    output: 'Number',
    colour: COLORS.math,
  },
  {
    type: 'ab_abs',
    message0: 'absolute value of %1',
    args0: [{ type: 'input_value', name: 'NUM', check: 'Number' }],
    output: 'Number',
    colour: COLORS.math,
  },
  {
    type: 'ab_min',
    message0: 'smaller of %1 and %2',
    args0: [
      { type: 'input_value', name: 'A', check: 'Number' },
      { type: 'input_value', name: 'B', check: 'Number' },
    ],
    output: 'Number',
    colour: COLORS.math,
  },
  {
    type: 'ab_max',
    message0: 'larger of %1 and %2',
    args0: [
      { type: 'input_value', name: 'A', check: 'Number' },
      { type: 'input_value', name: 'B', check: 'Number' },
    ],
    output: 'Number',
    colour: COLORS.math,
  },
  {
    type: 'ab_sqrt',
    message0: 'square root of %1',
    args0: [{ type: 'input_value', name: 'NUM', check: 'Number' }],
    output: 'Number',
    colour: COLORS.math,
  },
  {
    type: 'ab_power',
    message0: '%1 to the power of %2',
    args0: [
      { type: 'input_value', name: 'A', check: 'Number' },
      { type: 'input_value', name: 'B', check: 'Number' },
    ],
    output: 'Number',
    colour: COLORS.math,
  },
  {
    type: 'ab_modulo',
    message0: 'remainder of %1 ÷ %2',
    args0: [
      { type: 'input_value', name: 'A', check: 'Number' },
      { type: 'input_value', name: 'B', check: 'Number' },
    ],
    output: 'Number',
    colour: COLORS.math,
  },
  {
    type: 'ab_is_number',
    message0: '%1 is a number?',
    args0: [{ type: 'input_value', name: 'VALUE' }],
    output: 'Boolean',
    colour: COLORS.math,
  },
  {
    type: 'ab_text_to_number',
    message0: 'convert %1 to a number',
    args0: [{ type: 'input_value', name: 'TEXT' }],
    output: 'Number',
    colour: COLORS.math,
    tooltip: 'Reads a number out of text — 0 if the text isn’t a valid number.',
  },

  // ============================================================
  // Text
  // ============================================================
  {
    type: 'ab_text_is_empty',
    message0: '%1 is empty?',
    args0: [{ type: 'input_value', name: 'TEXT' }],
    output: 'Boolean',
    colour: COLORS.text,
  },
  {
    type: 'ab_text_contains',
    message0: '%1 contains %2 ?',
    args0: [
      { type: 'input_value', name: 'TEXT' },
      { type: 'input_value', name: 'SUBSTR' },
    ],
    output: 'Boolean',
    colour: COLORS.text,
  },
  {
    type: 'ab_text_starts_with',
    message0: '%1 starts with %2 ?',
    args0: [
      { type: 'input_value', name: 'TEXT' },
      { type: 'input_value', name: 'SUBSTR' },
    ],
    output: 'Boolean',
    colour: COLORS.text,
  },
  {
    type: 'ab_text_ends_with',
    message0: '%1 ends with %2 ?',
    args0: [
      { type: 'input_value', name: 'TEXT' },
      { type: 'input_value', name: 'SUBSTR' },
    ],
    output: 'Boolean',
    colour: COLORS.text,
  },
  {
    type: 'ab_text_replace',
    message0: 'replace %1 with %2 in %3',
    args0: [
      { type: 'input_value', name: 'FIND' },
      { type: 'input_value', name: 'REPLACE' },
      { type: 'input_value', name: 'TEXT' },
    ],
    output: null,
    colour: COLORS.text,
    tooltip: 'Replaces every occurrence, not just the first.',
  },
  {
    type: 'ab_text_uppercase',
    message0: '%1 in UPPERCASE',
    args0: [{ type: 'input_value', name: 'TEXT' }],
    output: null,
    colour: COLORS.text,
  },
  {
    type: 'ab_text_lowercase',
    message0: '%1 in lowercase',
    args0: [{ type: 'input_value', name: 'TEXT' }],
    output: null,
    colour: COLORS.text,
  },
  {
    type: 'ab_text_split',
    message0: 'split %1 by %2',
    args0: [
      { type: 'input_value', name: 'TEXT' },
      { type: 'input_value', name: 'SEPARATOR' },
    ],
    output: null,
    colour: COLORS.text,
    tooltip: 'Splits text into a list — plug this into "set [variable] to" to store the result as a list.',
  },
  {
    type: 'ab_text_join_list',
    message0: 'join list %1 with %2',
    args0: [
      { type: 'field_input', name: 'LIST_VAR', text: 'myList' },
      { type: 'input_value', name: 'SEPARATOR' },
    ],
    output: null,
    colour: COLORS.text,
    tooltip: 'Combines every item of a list into one piece of text.',
  },
  {
    type: 'ab_text_substring',
    message0: 'text from position %1 to %2 in %3',
    args0: [
      { type: 'input_value', name: 'START', check: 'Number' },
      { type: 'input_value', name: 'END', check: 'Number' },
      { type: 'input_value', name: 'TEXT' },
    ],
    output: null,
    colour: COLORS.text,
    tooltip: 'Position 0 is the first character.',
  },

  // ============================================================
  // Elements
  // ============================================================
  {
    type: 'ab_update_text',
    message0: 'update %1 to %2',
    args0: [
      { type: 'field_ab_target', name: 'TARGET', updatable: true },
      { type: 'input_value', name: 'VALUE' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.elements,
    tooltip: "Replaces an element's visible text.",
  },
  {
    type: 'ab_show_element',
    message0: 'show element %1',
    args0: [{ type: 'field_ab_target', name: 'TARGET' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.elements,
  },
  {
    type: 'ab_hide_element',
    message0: 'hide element %1',
    args0: [{ type: 'field_ab_target', name: 'TARGET' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.elements,
  },
  {
    type: 'ab_toggle_visibility',
    message0: 'toggle visibility of element %1',
    args0: [{ type: 'field_ab_target', name: 'TARGET' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.elements,
  },

  // ============================================================
  // Lists
  // ============================================================
  {
    type: 'ab_list_add_last',
    message0: 'add %1 to end of list %2',
    args0: [
      { type: 'input_value', name: 'VALUE' },
      { type: 'field_input', name: 'LIST_VAR', text: 'myList' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.lists,
  },
  {
    type: 'ab_list_add_first',
    message0: 'add %1 to start of list %2',
    args0: [
      { type: 'input_value', name: 'VALUE' },
      { type: 'field_input', name: 'LIST_VAR', text: 'myList' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.lists,
  },
  {
    type: 'ab_list_insert_at',
    message0: 'insert %1 at position %2 in list %3',
    args0: [
      { type: 'input_value', name: 'VALUE' },
      { type: 'input_value', name: 'INDEX', check: 'Number' },
      { type: 'field_input', name: 'LIST_VAR', text: 'myList' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.lists,
  },
  {
    type: 'ab_list_remove_first',
    message0: 'remove first item from list %1',
    args0: [{ type: 'field_input', name: 'LIST_VAR', text: 'myList' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.lists,
  },
  {
    type: 'ab_list_remove_last',
    message0: 'remove last item from list %1',
    args0: [{ type: 'field_input', name: 'LIST_VAR', text: 'myList' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.lists,
  },
  {
    type: 'ab_list_remove_at',
    message0: 'remove item at position %1 from list %2',
    args0: [
      { type: 'input_value', name: 'INDEX', check: 'Number' },
      { type: 'field_input', name: 'LIST_VAR', text: 'myList' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.lists,
  },
  {
    type: 'ab_list_clear',
    message0: 'clear list %1',
    args0: [{ type: 'field_input', name: 'LIST_VAR', text: 'myList' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.lists,
  },
  {
    type: 'ab_list_contains',
    message0: 'list %1 contains %2 %3',
    args0: [
      { type: 'field_input', name: 'LIST_VAR', text: 'myList' },
      { type: 'input_value', name: 'VALUE' },
      { type: 'field_input', name: 'FIELD', text: '' },
    ],
    output: 'Boolean',
    colour: COLORS.lists,
    tooltip: 'Checks whether a list has a matching entry. Leave the field blank to compare whole items; set it to check one object field of each entry (e.g. "name").',
  },
  {
    type: 'ab_list_length',
    message0: 'length of list %1',
    args0: [{ type: 'field_input', name: 'LIST_VAR', text: 'myList' }],
    output: 'Number',
    colour: COLORS.lists,
  },
  {
    type: 'ab_list_is_empty',
    message0: 'list %1 is empty?',
    args0: [{ type: 'field_input', name: 'LIST_VAR', text: 'myList' }],
    output: 'Boolean',
    colour: COLORS.lists,
  },
  {
    type: 'ab_list_item_at',
    message0: 'item at position %1 in list %2',
    args0: [
      { type: 'input_value', name: 'INDEX', check: 'Number' },
      { type: 'field_input', name: 'LIST_VAR', text: 'myList' },
    ],
    output: null,
    colour: COLORS.lists,
    tooltip: 'Position 0 is the first item.',
  },
  {
    type: 'ab_list_replace_at',
    message0: 'replace item at position %1 in list %2 with %3',
    args0: [
      { type: 'input_value', name: 'INDEX', check: 'Number' },
      { type: 'field_input', name: 'LIST_VAR', text: 'myList' },
      { type: 'input_value', name: 'VALUE' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.lists,
  },
  {
    type: 'ab_list_index_of',
    message0: 'position of %1 in list %2',
    args0: [
      { type: 'input_value', name: 'VALUE' },
      { type: 'field_input', name: 'LIST_VAR', text: 'myList' },
    ],
    output: 'Number',
    colour: COLORS.lists,
    tooltip: '-1 if the value isn’t in the list.',
  },
  {
    type: 'ab_list_shuffle',
    message0: 'shuffle list %1',
    args0: [{ type: 'field_input', name: 'LIST_VAR', text: 'myList' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.lists,
  },
  {
    type: 'ab_list_reverse',
    message0: 'reverse list %1',
    args0: [{ type: 'field_input', name: 'LIST_VAR', text: 'myList' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.lists,
  },
  {
    type: 'ab_list_sort',
    message0: 'sort list %1 %2',
    args0: [
      { type: 'field_input', name: 'LIST_VAR', text: 'myList' },
      {
        type: 'field_dropdown', name: 'MODE',
        options: [['A → Z', 'alpha_asc'], ['Z → A', 'alpha_desc'], ['smallest → largest', 'num_asc'], ['largest → smallest', 'num_desc']],
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.lists,
  },
  {
    type: 'ab_list_duplicate',
    message0: 'copy of list %1',
    args0: [{ type: 'field_input', name: 'LIST_VAR', text: 'myList' }],
    output: null,
    colour: COLORS.lists,
    tooltip: 'A new, independent copy — plug into "set [variable] to" to store it separately.',
  },
  {
    type: 'ab_list_create_empty',
    message0: 'empty list',
    output: null,
    colour: COLORS.lists,
    tooltip: 'Plug into "set [variable] to", then add items with the "add to list" blocks.',
  },
  {
    type: 'ab_pick_random',
    message0: 'random item from list %1',
    args0: [{ type: 'field_input', name: 'LIST_VAR', text: 'myList' }],
    output: null,
    colour: COLORS.lists,
  },
  {
    type: 'ab_pick_weighted',
    message0: 'weighted random item from list %1 (weight field %2)',
    args0: [
      { type: 'field_input', name: 'LIST_VAR', text: 'myList' },
      { type: 'field_input', name: 'FIELD', text: 'weight' },
    ],
    output: null,
    colour: COLORS.lists,
    tooltip: 'Each item should be an object with a number field (e.g. "weight") — higher numbers are picked more often. Great for loot boxes / gacha-style rewards.',
  },
  {
    type: 'ab_json_field',
    message0: 'field %1 of %2',
    args0: [
      { type: 'field_input', name: 'FIELD', text: 'name' },
      { type: 'input_value', name: 'JSON_TEXT' },
    ],
    output: null,
    colour: COLORS.lists,
    tooltip: 'Reads one field out of a rich (object-shaped) list item — e.g. the "name" field of a reward.',
  },

  // ============================================================
  // Feedback & Device
  // ============================================================
  {
    type: 'ab_show_message',
    message0: 'show message %1',
    args0: [{ type: 'input_value', name: 'TEXT' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.feedback,
    tooltip: 'Flashes a short message on screen.',
  },
  {
    type: 'ab_copy_to_clipboard',
    message0: 'copy to clipboard %1',
    args0: [{ type: 'input_value', name: 'TEXT' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.feedback,
  },
  {
    type: 'ab_vibrate',
    message0: 'vibrate for %1 ms',
    args0: [{ type: 'input_value', name: 'DURATION', check: 'Number' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.feedback,
    tooltip: 'Phones only — no effect in a desktop browser.',
  },
  {
    type: 'ab_wait',
    message0: 'wait %1 ms',
    args0: [{ type: 'input_value', name: 'DURATION', check: 'Number' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.feedback,
  },
  {
    type: 'ab_elapsed_seconds',
    message0: 'seconds since %1 was set',
    args0: [{ type: 'field_input', name: 'SINCE_VAR', text: 'lastClaim' }],
    output: 'Number',
    colour: COLORS.feedback,
    tooltip: 'Measures how long it’s been since a variable was last set — perfect for daily rewards or idle earnings.',
  },
  {
    type: 'ab_mark_time',
    message0: 'remember current time in %1',
    args0: [{ type: 'field_input', name: 'VAR', text: 'lastClaim' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.feedback,
    tooltip: 'Stamps a variable with the current time — pair with "seconds since" above.',
  },
  {
    type: 'ab_play_sound',
    message0: 'play sound %1',
    args0: [{ type: 'input_value', name: 'URL' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.feedback,
  },
  {
    type: 'ab_prompt_input',
    message0: 'ask for text with message %1',
    args0: [{ type: 'input_value', name: 'MSG' }],
    output: null,
    colour: COLORS.feedback,
    tooltip: 'Pops up a native dialog asking the visitor to type something — empty text if they cancel.',
  },
  {
    type: 'ab_confirm',
    message0: 'ask yes/no %1',
    args0: [{ type: 'input_value', name: 'MSG' }],
    output: 'Boolean',
    colour: COLORS.feedback,
    tooltip: 'Pops up a native OK/Cancel dialog.',
  },
  {
    type: 'ab_share',
    message0: 'share text %1 link %2',
    args0: [
      { type: 'input_value', name: 'TEXT' },
      { type: 'input_value', name: 'URL' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.device,
    tooltip: 'Opens the device’s native share sheet. On devices without one, copies the text/link instead.',
  },
  {
    type: 'ab_choose_photo',
    message0: 'choose or take a photo',
    output: null,
    colour: COLORS.device,
    tooltip: 'Opens the device’s camera/photo picker and waits for a picture — returns it as image data, or nothing if cancelled. Plug into an Image element’s URL or into "set [variable] to".',
  },
  {
    type: 'ab_get_latitude',
    message0: 'current latitude',
    output: 'Number',
    colour: COLORS.device,
    tooltip: 'Asks the visitor to share their location the first time it’s used.',
  },
  {
    type: 'ab_get_longitude',
    message0: 'current longitude',
    output: 'Number',
    colour: COLORS.device,
  },
  {
    type: 'ab_is_online',
    message0: 'device is online?',
    output: 'Boolean',
    colour: COLORS.device,
  },
  {
    type: 'ab_request_notification_permission',
    message0: 'ask for notification permission',
    output: 'Boolean',
    colour: COLORS.device,
    tooltip: 'True if the visitor allowed notifications.',
  },

  // ============================================================
  // Links & Communication
  // ============================================================
  {
    type: 'ab_open_link_new_tab',
    message0: 'open link %1 in new tab',
    args0: [{ type: 'input_value', name: 'URL' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.links,
  },
  {
    type: 'ab_open_link_same_tab',
    message0: 'open link %1 in this app',
    args0: [{ type: 'input_value', name: 'URL' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.links,
  },
  {
    type: 'ab_open_email',
    message0: 'open email to %1 subject %2 body %3',
    args0: [
      { type: 'input_value', name: 'ADDRESS' },
      { type: 'input_value', name: 'SUBJECT' },
      { type: 'input_value', name: 'BODY' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.links,
  },
  {
    type: 'ab_call_phone',
    message0: 'call phone number %1',
    args0: [{ type: 'input_value', name: 'NUMBER' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.links,
  },
  {
    type: 'ab_send_sms',
    message0: 'send text message to %1 saying %2',
    args0: [
      { type: 'input_value', name: 'NUMBER' },
      { type: 'input_value', name: 'MESSAGE' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.links,
  },

  // ============================================================
  // Date & Time
  // ============================================================
  {
    type: 'ab_current_timestamp',
    message0: 'current date and time',
    output: 'Number',
    colour: COLORS.datetime,
    tooltip: 'A number you can store and compare — plug into "format" below to show it, or into "seconds between" to measure a duration.',
  },
  {
    type: 'ab_format_date',
    message0: 'format %1 as %2',
    args0: [
      { type: 'input_value', name: 'TIMESTAMP', check: 'Number' },
      {
        type: 'field_dropdown', name: 'STYLE',
        options: [['date', 'date'], ['time', 'time'], ['date and time', 'datetime']],
      },
    ],
    output: null,
    colour: COLORS.datetime,
  },
  {
    type: 'ab_time_difference_seconds',
    message0: 'seconds between %1 and %2',
    args0: [
      { type: 'input_value', name: 'A', check: 'Number' },
      { type: 'input_value', name: 'B', check: 'Number' },
    ],
    output: 'Number',
    colour: COLORS.datetime,
  },

  // ============================================================
  // Control (additions — if/else/repeat/logic/text stay on Blockly's stock
  // blocks, imported wholesale via 'blockly/blocks' above)
  // ============================================================
  {
    type: 'ab_for_each',
    message0: 'for each item in list %1',
    args0: [{ type: 'field_input', name: 'LIST_VAR', text: 'myList' }],
    message1: 'do %1',
    args1: [{ type: 'input_statement', name: 'DO' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.control,
    tooltip: 'Use the "This item"/"This item’s position" blocks inside to read the current item.',
  },
  {
    type: 'ab_wait_until',
    message0: 'wait until %1 is true',
    args0: [{ type: 'input_value', name: 'CONDITION', check: 'Boolean' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.control,
  },
  {
    type: 'ab_stop_script',
    message0: '⛔ stop this script',
    previousStatement: null,
    colour: COLORS.control,
  },

  // ============================================================
  // Storage — persists after the visitor closes the app, unlike variables
  // (which reset to their initial value every session).
  // ============================================================
  {
    type: 'ab_storage_set',
    message0: 'save %1 under %2',
    args0: [
      { type: 'input_value', name: 'VALUE' },
      { type: 'field_input', name: 'KEY', text: 'myKey' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.storage,
  },
  {
    type: 'ab_storage_get',
    message0: 'read saved value %1',
    args0: [{ type: 'field_input', name: 'KEY', text: 'myKey' }],
    output: null,
    colour: COLORS.storage,
    tooltip: 'Empty text if nothing was saved under this key yet.',
  },
  {
    type: 'ab_storage_remove',
    message0: 'delete saved value %1',
    args0: [{ type: 'field_input', name: 'KEY', text: 'myKey' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.storage,
  },

  // ============================================================
  // Web Requests — run inside a security sandbox in the live editor/public
  // preview (see appBuilderBlock/sandboxFetch.js): the request itself can
  // still succeed or fail normally, but it can never read this site's
  // session. Only ever reaches servers that allow cross-origin requests
  // (the browser's normal CORS rules still apply) — returns empty text on
  // any failure, same fail-quiet convention as every other block here.
  // ============================================================
  {
    type: 'ab_http_get',
    message0: 'web request GET %1',
    args0: [{ type: 'input_value', name: 'URL' }],
    output: null,
    colour: COLORS.network,
    tooltip: 'Fetches a URL and returns the response text (parse JSON with the "field of" block above). Empty text if the request fails.',
  },
  {
    type: 'ab_http_post',
    message0: 'web request POST %1 body %2',
    args0: [
      { type: 'input_value', name: 'URL' },
      { type: 'input_value', name: 'BODY' },
    ],
    output: null,
    colour: COLORS.network,
    tooltip: 'Sends a POST request and returns the response text. Empty text if the request fails.',
  },

  // ============================================================
  // Secrets (Integrations tab) — a named token, picked from a dropdown (not
  // free text) so it can't silently typo into an empty string. Not a real
  // secret vault once this app is live/exported — see the Integrations
  // modal's own warning copy (AppBuilderEditor.js) for why.
  // ============================================================
  {
    type: 'ab_secret',
    message0: 'value of key %1',
    args0: [{ type: 'field_ab_secret', name: 'NAME' }],
    output: null,
    colour: COLORS.secrets,
    tooltip: 'Reads a value stored in this app\'s Integrations tab. Empty text if not set.',
  },

  // ============================================================
  // Data — a tiny shared database per app (see backend/app/routers/
  // studio_data.py). Records are plain JSON objects, no fixed schema.
  // Shared/public, not per-visitor-private — see that file's docstring.
  // ============================================================
  {
    type: 'ab_data_list_into',
    message0: 'load all records from %1 into list %2',
    args0: [
      { type: 'field_input', name: 'COLLECTION', text: 'myCollection' },
      { type: 'field_input', name: 'LIST_VAR', text: 'myList' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.data,
    tooltip: 'Fetches every record into a list variable — each item is a JSON object with an "id" field plus whatever fields you gave it. Use the List blocks (field of, item at index, for each…) to work with it.',
  },
  {
    type: 'ab_data_add',
    message0: 'add record to %1 with fields %2',
    args0: [
      { type: 'field_input', name: 'COLLECTION', text: 'myCollection' },
      { type: 'input_value', name: 'FIELDS' },
    ],
    output: null,
    colour: COLORS.data,
    tooltip: 'Creates a new record from a JSON object of fields, e.g. {"name": "Alice", "score": 10}. Returns the new record\'s id — store it if you\'ll need to update/delete this record later.',
  },
  {
    type: 'ab_data_update',
    message0: 'update record %1 in %2 with fields %3',
    args0: [
      { type: 'input_value', name: 'RECORD_ID' },
      { type: 'field_input', name: 'COLLECTION', text: 'myCollection' },
      { type: 'input_value', name: 'FIELDS' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.data,
    tooltip: 'Merges the given fields into an existing record — get its id from a loaded list\'s "id" field.',
  },
  {
    type: 'ab_data_delete',
    message0: 'delete record %1 from %2',
    args0: [
      { type: 'input_value', name: 'RECORD_ID' },
      { type: 'field_input', name: 'COLLECTION', text: 'myCollection' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.data,
  },

  // ============================================================
  // This item (list row tap only — see ITEM_CATEGORY/buildToolbox below;
  // also reused inside "for each item in list" loop bodies)
  // ============================================================
  {
    type: 'ab_item',
    message0: 'this item',
    output: null,
    colour: COLORS.item,
    tooltip: 'The whole current item.',
  },
  {
    type: 'ab_item_field',
    message0: 'this item’s %1',
    args0: [{ type: 'field_input', name: 'FIELD', text: 'name' }],
    output: null,
    colour: COLORS.item,
    tooltip: 'One field of the current item (when it’s an object).',
  },
  {
    type: 'ab_item_index',
    message0: 'this item’s position',
    output: 'Number',
    colour: COLORS.item,
    tooltip: 'The current item’s position in the list (0 = first).',
  },

  // ============================================================
  // Legacy-migration compatibility bridge (never in the toolbox)
  // ============================================================
  {
    type: 'ab_legacy_text',
    message0: '⚠ legacy text %1',
    args0: [{ type: 'field_input', name: 'TEMPLATE', text: '' }],
    output: null,
    colour: '#8395A7',
    tooltip: 'Auto-created when migrating an old app — behaves exactly like the text it replaces (supports {{variable}}). Safe to leave as-is, or replace with real text/variable blocks.',
  },
];

Blockly.defineBlocksWithJsonArray(jsonBlocks);

// Give the stock blocks we reuse App-Builder-appropriate colours too, so the
// palette reads as one coherent system instead of Blockly's default
// blue-for-everything.
const STOCK_COLOUR_OVERRIDES = {
  controls_if: COLORS.control,
  controls_ifelse: COLORS.control,
  controls_repeat_ext: COLORS.control,
  controls_whileUntil: COLORS.control,
  logic_compare: COLORS.logic,
  logic_operation: COLORS.logic,
  logic_negate: COLORS.logic,
  math_arithmetic: COLORS.math,
  math_number: COLORS.math,
  text: COLORS.text,
  text_join: COLORS.text,
  text_length: COLORS.text,
};
for (const [type, colour] of Object.entries(STOCK_COLOUR_OVERRIDES)) {
  if (Blockly.Blocks[type]) {
    const original = Blockly.Blocks[type].init;
    Blockly.Blocks[type].init = function () {
      original.call(this);
      this.setColour(colour);
    };
  }
}

const BASE_CATEGORIES = [
  {
    kind: 'category', name: 'Navigate', colour: COLORS.navigate,
    contents: [
      { kind: 'block', type: 'ab_navigate' },
      { kind: 'block', type: 'ab_close_app' },
    ],
  },
  {
    kind: 'category', name: 'Variables', colour: COLORS.variables,
    contents: [
      { kind: 'block', type: 'ab_set_variable', inputs: { VALUE: { shadow: { type: 'text', fields: { TEXT: '' } } } } },
      { kind: 'block', type: 'ab_get_variable' },
      { kind: 'block', type: 'ab_change_variable', inputs: { DELTA: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } },
      { kind: 'block', type: 'ab_toggle_variable' },
      { kind: 'block', type: 'ab_reset_variables' },
    ],
  },
  {
    kind: 'category', name: 'Math', colour: COLORS.math,
    contents: [
      { kind: 'block', type: 'math_arithmetic', inputs: {
        A: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
        B: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
      } },
      { kind: 'block', type: 'math_number' },
      { kind: 'block', type: 'ab_random_number', inputs: {
        A: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
        B: { shadow: { type: 'math_number', fields: { NUM: 10 } } },
      } },
      { kind: 'block', type: 'ab_round' },
      { kind: 'block', type: 'ab_round_up' },
      { kind: 'block', type: 'ab_round_down' },
      { kind: 'block', type: 'ab_abs' },
      { kind: 'block', type: 'ab_min' },
      { kind: 'block', type: 'ab_max' },
      { kind: 'block', type: 'ab_sqrt' },
      { kind: 'block', type: 'ab_power', inputs: { B: { shadow: { type: 'math_number', fields: { NUM: 2 } } } } },
      { kind: 'block', type: 'ab_modulo' },
      { kind: 'block', type: 'ab_is_number' },
      { kind: 'block', type: 'ab_text_to_number' },
    ],
  },
  {
    kind: 'category', name: 'Text', colour: COLORS.text,
    contents: [
      { kind: 'block', type: 'text' },
      { kind: 'block', type: 'text_join' },
      { kind: 'block', type: 'text_length', inputs: { VALUE: { shadow: { type: 'text', fields: { TEXT: '' } } } } },
      { kind: 'block', type: 'ab_text_is_empty' },
      { kind: 'block', type: 'ab_text_contains' },
      { kind: 'block', type: 'ab_text_starts_with' },
      { kind: 'block', type: 'ab_text_ends_with' },
      { kind: 'block', type: 'ab_text_replace' },
      { kind: 'block', type: 'ab_text_uppercase' },
      { kind: 'block', type: 'ab_text_lowercase' },
      { kind: 'block', type: 'ab_text_split', inputs: { SEPARATOR: { shadow: { type: 'text', fields: { TEXT: ',' } } } } },
      { kind: 'block', type: 'ab_text_join_list', inputs: { SEPARATOR: { shadow: { type: 'text', fields: { TEXT: ', ' } } } } },
      { kind: 'block', type: 'ab_text_substring', inputs: {
        START: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
        END: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
      } },
    ],
  },
  {
    kind: 'category', name: 'Elements', colour: COLORS.elements,
    contents: [
      { kind: 'block', type: 'ab_update_text', inputs: { VALUE: { shadow: { type: 'text', fields: { TEXT: '' } } } } },
      { kind: 'block', type: 'ab_show_element' },
      { kind: 'block', type: 'ab_hide_element' },
      { kind: 'block', type: 'ab_toggle_visibility' },
    ],
  },
  {
    kind: 'category', name: 'Lists', colour: COLORS.lists,
    contents: [
      { kind: 'block', type: 'ab_list_create_empty' },
      { kind: 'block', type: 'ab_list_add_last', inputs: { VALUE: { shadow: { type: 'text', fields: { TEXT: '' } } } } },
      { kind: 'block', type: 'ab_list_add_first', inputs: { VALUE: { shadow: { type: 'text', fields: { TEXT: '' } } } } },
      { kind: 'block', type: 'ab_list_insert_at', inputs: {
        VALUE: { shadow: { type: 'text', fields: { TEXT: '' } } },
        INDEX: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
      } },
      { kind: 'block', type: 'ab_list_remove_first' },
      { kind: 'block', type: 'ab_list_remove_last' },
      { kind: 'block', type: 'ab_list_remove_at', inputs: { INDEX: { shadow: { type: 'math_number', fields: { NUM: 0 } } } } },
      { kind: 'block', type: 'ab_list_clear' },
      { kind: 'block', type: 'ab_list_replace_at', inputs: {
        INDEX: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
        VALUE: { shadow: { type: 'text', fields: { TEXT: '' } } },
      } },
      { kind: 'block', type: 'ab_list_contains', inputs: { VALUE: { shadow: { type: 'text', fields: { TEXT: '' } } } } },
      { kind: 'block', type: 'ab_list_length' },
      { kind: 'block', type: 'ab_list_is_empty' },
      { kind: 'block', type: 'ab_list_item_at', inputs: { INDEX: { shadow: { type: 'math_number', fields: { NUM: 0 } } } } },
      { kind: 'block', type: 'ab_list_index_of', inputs: { VALUE: { shadow: { type: 'text', fields: { TEXT: '' } } } } },
      { kind: 'block', type: 'ab_list_shuffle' },
      { kind: 'block', type: 'ab_list_reverse' },
      { kind: 'block', type: 'ab_list_sort' },
      { kind: 'block', type: 'ab_list_duplicate' },
      { kind: 'block', type: 'ab_pick_random' },
      { kind: 'block', type: 'ab_pick_weighted' },
      { kind: 'block', type: 'ab_json_field' },
    ],
  },
  {
    kind: 'category', name: 'Feedback & Device', colour: COLORS.feedback,
    contents: [
      { kind: 'block', type: 'ab_show_message', inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: '…' } } } } },
      { kind: 'block', type: 'ab_copy_to_clipboard', inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: '' } } } } },
      { kind: 'block', type: 'ab_vibrate', inputs: { DURATION: { shadow: { type: 'math_number', fields: { NUM: 200 } } } } },
      { kind: 'block', type: 'ab_wait', inputs: { DURATION: { shadow: { type: 'math_number', fields: { NUM: 500 } } } } },
      { kind: 'block', type: 'ab_elapsed_seconds' },
      { kind: 'block', type: 'ab_mark_time' },
      { kind: 'block', type: 'ab_play_sound', inputs: { URL: { shadow: { type: 'text', fields: { TEXT: '' } } } } },
      { kind: 'block', type: 'ab_prompt_input', inputs: { MSG: { shadow: { type: 'text', fields: { TEXT: '' } } } } },
      { kind: 'block', type: 'ab_confirm', inputs: { MSG: { shadow: { type: 'text', fields: { TEXT: '' } } } } },
      { kind: 'block', type: 'ab_share', inputs: {
        TEXT: { shadow: { type: 'text', fields: { TEXT: '' } } },
        URL: { shadow: { type: 'text', fields: { TEXT: '' } } },
      } },
      { kind: 'block', type: 'ab_choose_photo' },
      { kind: 'block', type: 'ab_get_latitude' },
      { kind: 'block', type: 'ab_get_longitude' },
      { kind: 'block', type: 'ab_is_online' },
      { kind: 'block', type: 'ab_request_notification_permission' },
    ],
  },
  {
    kind: 'category', name: 'Links & Communication', colour: COLORS.links,
    contents: [
      { kind: 'block', type: 'ab_open_link_new_tab', inputs: { URL: { shadow: { type: 'text', fields: { TEXT: 'https://' } } } } },
      { kind: 'block', type: 'ab_open_link_same_tab', inputs: { URL: { shadow: { type: 'text', fields: { TEXT: 'https://' } } } } },
      { kind: 'block', type: 'ab_open_email', inputs: {
        ADDRESS: { shadow: { type: 'text', fields: { TEXT: '' } } },
        SUBJECT: { shadow: { type: 'text', fields: { TEXT: '' } } },
        BODY: { shadow: { type: 'text', fields: { TEXT: '' } } },
      } },
      { kind: 'block', type: 'ab_call_phone', inputs: { NUMBER: { shadow: { type: 'text', fields: { TEXT: '' } } } } },
      { kind: 'block', type: 'ab_send_sms', inputs: {
        NUMBER: { shadow: { type: 'text', fields: { TEXT: '' } } },
        MESSAGE: { shadow: { type: 'text', fields: { TEXT: '' } } },
      } },
    ],
  },
  {
    kind: 'category', name: 'Date & Time', colour: COLORS.datetime,
    contents: [
      { kind: 'block', type: 'ab_current_timestamp' },
      { kind: 'block', type: 'ab_format_date' },
      { kind: 'block', type: 'ab_time_difference_seconds' },
    ],
  },
  {
    kind: 'category', name: 'Logic', colour: COLORS.logic,
    contents: [
      { kind: 'block', type: 'controls_if' },
      { kind: 'block', type: 'controls_ifelse' },
      { kind: 'block', type: 'logic_compare' },
      { kind: 'block', type: 'logic_operation' },
      { kind: 'block', type: 'logic_negate' },
    ],
  },
  {
    kind: 'category', name: 'Control', colour: COLORS.control,
    contents: [
      { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: { shadow: { type: 'math_number', fields: { NUM: 10 } } } } },
      { kind: 'block', type: 'controls_whileUntil' },
      { kind: 'block', type: 'ab_for_each' },
      { kind: 'block', type: 'ab_wait_until' },
      { kind: 'block', type: 'ab_stop_script' },
    ],
  },
  {
    kind: 'category', name: 'Storage', colour: COLORS.storage,
    contents: [
      { kind: 'block', type: 'ab_storage_set', inputs: { VALUE: { shadow: { type: 'text', fields: { TEXT: '' } } } } },
      { kind: 'block', type: 'ab_storage_get' },
      { kind: 'block', type: 'ab_storage_remove' },
    ],
  },
  {
    kind: 'category', name: 'Web Requests', colour: COLORS.network,
    contents: [
      { kind: 'block', type: 'ab_http_get', inputs: { URL: { shadow: { type: 'text', fields: { TEXT: 'https://' } } } } },
      { kind: 'block', type: 'ab_http_post', inputs: {
        URL: { shadow: { type: 'text', fields: { TEXT: 'https://' } } },
        BODY: { shadow: { type: 'text', fields: { TEXT: '' } } },
      } },
      { kind: 'block', type: 'ab_json_field' },
    ],
  },
  {
    kind: 'category', name: 'Secrets', colour: COLORS.secrets,
    contents: [
      { kind: 'block', type: 'ab_secret' },
    ],
  },
  {
    kind: 'category', name: 'Data', colour: COLORS.data,
    contents: [
      { kind: 'block', type: 'ab_data_list_into' },
      { kind: 'block', type: 'ab_data_add', inputs: { FIELDS: { shadow: { type: 'text', fields: { TEXT: '{"name": "Alice"}' } } } } },
      { kind: 'block', type: 'ab_data_update', inputs: { FIELDS: { shadow: { type: 'text', fields: { TEXT: '{"name": "Alice"}' } } } } },
      { kind: 'block', type: 'ab_data_delete' },
    ],
  },
];

const ITEM_CATEGORY = {
  kind: 'category', name: 'This item', colour: COLORS.item,
  contents: [
    { kind: 'block', type: 'ab_item' },
    { kind: 'block', type: 'ab_item_field' },
    { kind: 'block', type: 'ab_item_index' },
  ],
};

// Which hat(s) each element type can have — drives both the toolbox's
// Events category (buildToolbox below) and the mapping legacyMigration.js
// uses to wrap an old pre-hat trigger in the right hat automatically.
export const HAT_TYPES_BY_COMPONENT = {
  button: ['ab_when_clicked', 'ab_when_pressed', 'ab_when_released'],
  toggle: ['ab_when_changed'],
  checkbox: ['ab_when_changed'],
  rating: ['ab_when_changed'],
  slider: ['ab_when_changed'],
  date: ['ab_when_changed'],
  list: ['ab_when_row_tapped'],
};
export const SCREEN_HAT_TYPES = ['ab_when_screen_opens'];
// Which hat an element's single old (pre-hat) trigger becomes when migrated
// — see legacyMigration.js's migrateToHatWorkspace(). A button's old
// COMPONENT_META actionTrigger is 'onClick', everything else that had one
// was 'onChange'; lists never had an actionTrigger (their old item_action
// always maps to ab_when_row_tapped, handled as its own special case by
// the callers, not through this map).
export const LEGACY_TRIGGER_TO_HAT = { onClick: 'ab_when_clicked', onChange: 'ab_when_changed' };
export const ALL_HAT_TYPES = [
  'ab_when_clicked', 'ab_when_pressed', 'ab_when_released',
  'ab_when_changed', 'ab_when_row_tapped', 'ab_when_screen_opens',
];

// Builds a toolbox scoped to one element's own possible hats — an "Events"
// category up front (so it's the first thing you see, same emphasis
// Scratch gives its hat blocks) plus every general-purpose category, plus
// "This item" only when a row-tap hat is on offer (scope.item/scope.index
// only ever exist while that specific hat's code is actually running).
export function buildToolbox(hatTypes) {
  const events = {
    kind: 'category', name: 'Events', colour: COLORS.events,
    contents: hatTypes.map(type => ({ kind: 'block', type })),
  };
  const categories = [events, ...BASE_CATEGORIES];
  if (hatTypes.includes('ab_when_row_tapped')) categories.push(ITEM_CATEGORY);
  return { kind: 'categoryToolbox', contents: categories };
}

export { Order };
