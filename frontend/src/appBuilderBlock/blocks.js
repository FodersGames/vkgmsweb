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
// English labels (App Builder's UI is English, unlike Vakar Block's French
// Scratch-style editor) — no Blockly.setLocale() call needed, core ships
// with English messages built in.
// ============================================================

export const COLORS = {
  navigate: '#2F80ED',
  variables: '#F2A93B',
  elements: '#9966FF',
  lists: '#CF63CF',
  feedback: '#5CB1D6',
  links: '#4ECDC4',
  logic: '#59C059',
  control: '#FFAB19',
  text: '#EB5757',
  item: '#2F9E44',
};

const jsonBlocks = [
  // ---------- Navigate ----------
  {
    type: 'ab_navigate',
    message0: 'go to screen %1',
    args0: [{ type: 'field_ab_screen', name: 'SCREEN' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.navigate,
    tooltip: 'Switches to a different screen.',
  },

  // ---------- Variables & Math ----------
  // App Builder variables are declared centrally (the Variables panel in
  // AppBuilderEditor.js's sidebar, a flat {name, initial_value} list), not
  // through Blockly's own variable-creation UI — so get/set/change use plain
  // field_input name fields (same convention as ab_list_add's LIST_VAR)
  // instead of reusing Blockly's stock variables_get/variables_set/
  // math_change, which are hard-wired to Blockly's own separate variable
  // model and would give users two conflicting places to manage variables.
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
  {
    type: 'ab_random_pick',
    message0: 'pick a random reward from %1',
    args0: [{ type: 'field_input', name: 'OPTIONS_VAR', text: 'rewards' }],
    message1: 'store picked reward in %1',
    args1: [{ type: 'field_input', name: 'TARGET_VAR', text: '' }],
    message2: 'also add it to list %1',
    args2: [{ type: 'field_input', name: 'COLLECTION_VAR', text: '' }],
    message3: 'if already owned (by field %1) credit %2 with %3',
    args3: [
      { type: 'field_input', name: 'DEDUPE_FIELD', text: '' },
      { type: 'field_input', name: 'DUP_VAR', text: '' },
      { type: 'input_value', name: 'DUP_AMOUNT', check: 'Number' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.variables,
    inputsInline: false,
    tooltip: 'Rolls a random reward from a weighted list (e.g. rarity odds) — perfect for chests, loot boxes, or gacha mechanics. Leave a field blank to skip that part.',
  },

  // ---------- Elements ----------
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
    type: 'ab_set_visibility',
    message0: '%1 element %2',
    args0: [
      { type: 'field_dropdown', name: 'MODE', options: [['show', 'show'], ['hide', 'hide'], ['toggle', 'toggle']] },
      { type: 'field_ab_target', name: 'TARGET' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.elements,
    tooltip: 'Shows, hides, or toggles another element.',
  },

  // ---------- Lists ----------
  {
    type: 'ab_list_add',
    message0: 'add %1 to list %2 %3',
    args0: [
      { type: 'input_value', name: 'VALUE' },
      { type: 'field_input', name: 'LIST_VAR', text: 'myList' },
      {
        type: 'field_dropdown', name: 'MODE',
        options: [['at the end', 'append'], ['at the start', 'prepend'], ['at position', 'at_index']],
      },
    ],
    message1: 'position (if "at position") %1',
    args1: [{ type: 'input_value', name: 'INDEX', check: 'Number' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.lists,
    tooltip: 'Adds a value to a list, at the start, end, or a specific position.',
  },
  {
    type: 'ab_list_remove',
    message0: 'remove from list %1 %2',
    args0: [
      { type: 'field_input', name: 'LIST_VAR', text: 'myList' },
      {
        type: 'field_dropdown', name: 'MODE',
        options: [['last item', 'last'], ['first item', 'first'], ['item at position', 'at_index'], ['everything', 'clear']],
      },
    ],
    message1: 'position (if "item at position") %1',
    args1: [{ type: 'input_value', name: 'INDEX', check: 'Number' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.lists,
    tooltip: 'Removes an item from a list.',
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

  // ---------- Feedback & Device ----------
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
    tooltip: 'Copies text so the visitor can paste it elsewhere.',
  },
  {
    type: 'ab_vibrate',
    message0: 'vibrate for %1 ms',
    args0: [{ type: 'input_value', name: 'DURATION', check: 'Number' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.feedback,
    tooltip: 'Triggers a short haptic buzz (phones only — no effect in a browser).',
  },
  {
    type: 'ab_wait',
    message0: 'wait %1 ms',
    args0: [{ type: 'input_value', name: 'DURATION', check: 'Number' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.feedback,
    tooltip: 'Pauses before the next block runs — useful for pacing a sequence.',
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

  // ---------- Links ----------
  {
    type: 'ab_open_link',
    message0: 'open link %1 new tab %2',
    args0: [
      { type: 'input_value', name: 'URL' },
      { type: 'field_checkbox', name: 'NEW_TAB', checked: true },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.links,
    tooltip: 'Opens a URL, in this app or a new tab.',
  },

  // ---------- This item (list row tap only — see TOOLBOX_ITEM below) ----------
  {
    type: 'ab_item',
    message0: 'this item',
    output: null,
    colour: COLORS.item,
    tooltip: 'The whole tapped row.',
  },
  {
    type: 'ab_item_field',
    message0: 'this item’s %1',
    args0: [{ type: 'field_input', name: 'FIELD', text: 'name' }],
    output: null,
    colour: COLORS.item,
    tooltip: 'One field of the tapped row (when each entry is an object).',
  },
  {
    type: 'ab_item_index',
    message0: 'this item’s position',
    output: 'Number',
    colour: COLORS.item,
    tooltip: 'The tapped row’s position in the list (0 = first).',
  },

  // ---------- Legacy-migration compatibility bridge (never in the toolbox) ----------
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
  logic_compare: COLORS.logic,
  logic_operation: COLORS.logic,
  logic_negate: COLORS.logic,
  math_arithmetic: COLORS.variables,
  math_number: COLORS.variables,
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
    contents: [{ kind: 'block', type: 'ab_navigate' }],
  },
  {
    kind: 'category', name: 'Variables & Math', colour: COLORS.variables,
    contents: [
      { kind: 'block', type: 'ab_set_variable', inputs: { VALUE: { shadow: { type: 'text', fields: { TEXT: '' } } } } },
      { kind: 'block', type: 'ab_get_variable' },
      { kind: 'block', type: 'ab_change_variable', inputs: { DELTA: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } },
      { kind: 'block', type: 'ab_toggle_variable' },
      { kind: 'block', type: 'ab_reset_variables' },
      { kind: 'block', type: 'ab_random_pick', inputs: { DUP_AMOUNT: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } },
      { kind: 'block', type: 'math_arithmetic', inputs: {
        A: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
        B: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
      } },
      { kind: 'block', type: 'math_number' },
    ],
  },
  {
    kind: 'category', name: 'Elements', colour: COLORS.elements,
    contents: [
      { kind: 'block', type: 'ab_update_text', inputs: { VALUE: { shadow: { type: 'text', fields: { TEXT: '' } } } } },
      { kind: 'block', type: 'ab_set_visibility' },
    ],
  },
  {
    kind: 'category', name: 'Lists', colour: COLORS.lists,
    contents: [
      { kind: 'block', type: 'ab_list_add', inputs: {
        VALUE: { shadow: { type: 'text', fields: { TEXT: '' } } },
        INDEX: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
      } },
      { kind: 'block', type: 'ab_list_remove', inputs: { INDEX: { shadow: { type: 'math_number', fields: { NUM: 0 } } } } },
      { kind: 'block', type: 'ab_list_contains', inputs: { VALUE: { shadow: { type: 'text', fields: { TEXT: '' } } } } },
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
    ],
  },
  {
    kind: 'category', name: 'Links', colour: COLORS.links,
    contents: [{ kind: 'block', type: 'ab_open_link', inputs: { URL: { shadow: { type: 'text', fields: { TEXT: 'https://' } } } } }],
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
    contents: [{ kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: { shadow: { type: 'math_number', fields: { NUM: 10 } } } } }],
  },
  {
    kind: 'category', name: 'Text', colour: COLORS.text,
    contents: [
      { kind: 'block', type: 'text' },
      { kind: 'block', type: 'text_join' },
      { kind: 'block', type: 'text_length', inputs: { VALUE: { shadow: { type: 'text', fields: { TEXT: '' } } } } },
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

// Default toolbox (component/toggle/etc. actions) — no "This item" category,
// scope.item/scope.index only exist while running a list row's tap action.
export const TOOLBOX = { kind: 'categoryToolbox', contents: BASE_CATEGORIES };

// Shown instead of TOOLBOX only when editing a list's `item_action`.
export const TOOLBOX_ITEM = { kind: 'categoryToolbox', contents: [...BASE_CATEGORIES, ITEM_CATEGORY] };

export { Order };
