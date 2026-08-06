import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import { Order } from 'blockly/javascript';

// ============================================================
// VAKAR BLOCK — custom block definitions.
// French labels, Scratch-style category colors. Operators/Variables/part of
// Control reuse Blockly's own stock blocks (math_arithmetic, logic_compare,
// logic_operation, logic_negate, math_random_int, variables_get,
// variables_set, math_change, controls_repeat_ext, controls_if) — imported
// wholesale via 'blockly/blocks' above — rather than reinventing them.
// Only genuinely Scratch-specific blocks (sprite motion/looks/events, plus
// "toujours"/"attendre"/"tout arrêter" which Blockly has no stock
// equivalent for) are defined here.
// ============================================================

export const COLORS = {
  events: '#FFBF00',
  motion: '#4C97FF',
  looks: '#9966FF',
  control: '#FFAB19',
  operators: '#59C059',
  variables: '#FF8C1A',
};

// French message overrides for the stock blocks we reuse, so the whole
// palette reads as French/kid-friendly, not a mix of English + French.
Object.assign(Blockly.Msg, {
  CONTROLS_REPEAT_TITLE: 'répéter %1 fois',
  CONTROLS_REPEAT_INPUT_DO: '',
  CONTROLS_IF_MSG_IF: 'si',
  CONTROLS_IF_MSG_THEN: 'alors',
  CONTROLS_IF_MSG_ELSE: 'sinon',
  CONTROLS_IF_IF_TITLE_IF: 'si',
  CONTROLS_IF_ELSE_TITLE_ELSE: 'sinon',
  LOGIC_COMPARE_TOOLTIP_EQ: 'Vrai si les deux valeurs sont égales.',
  LOGIC_OPERATION_AND: '%1 et %2',
  LOGIC_OPERATION_OR: '%1 ou %2',
  LOGIC_NEGATE_TITLE: 'pas %1',
  MATH_CHANGE_TITLE: 'changer %1 de %2',
  MATH_CHANGE_TITLE_ITEM: '%1',
  VARIABLES_SET: 'mettre %1 à %2',
  VARIABLES_SET_CREATE_GET: 'Créer une variable « %1 »',
  VARIABLES_DEFAULT_NAME: 'variable',
  NEW_VARIABLE: 'Créer une variable...',
  RENAME_VARIABLE: 'Renommer la variable...',
  DELETE_VARIABLE: 'Supprimer la variable « %1 »',
  MATH_RANDOM_INT_TITLE: 'nombre aléatoire entre %1 et %2',
});

const jsonBlocks = [
  // ---------- ÉVÉNEMENTS ----------
  {
    type: 'vk_when_green_flag',
    message0: '🏁 quand le drapeau vert est cliqué',
    nextStatement: null,
    colour: COLORS.events,
    tooltip: "Démarre ce script quand on appuie sur le drapeau vert.",
  },
  {
    type: 'vk_when_key_pressed',
    message0: 'quand la touche %1 est pressée',
    args0: [
      {
        type: 'field_dropdown',
        name: 'KEY',
        options: [
          ['espace', 'space'], ['flèche haut', 'up'], ['flèche bas', 'down'],
          ['flèche gauche', 'left'], ['flèche droite', 'right'],
          ['a', 'a'], ['b', 'b'], ['c', 'c'], ['d', 'd'], ['e', 'e'],
          ['w', 'w'], ['x', 'x'], ['entrée', 'enter'],
        ],
      },
    ],
    nextStatement: null,
    colour: COLORS.events,
    tooltip: 'Démarre ce script quand une touche du clavier est pressée.',
  },
  {
    type: 'vk_when_sprite_clicked',
    message0: '👆 quand ce sprite est cliqué',
    nextStatement: null,
    colour: COLORS.events,
    tooltip: "Démarre ce script quand on clique sur ce sprite.",
  },

  // ---------- MOUVEMENT ----------
  {
    type: 'vk_move_steps',
    message0: 'avancer de %1 pas',
    args0: [{ type: 'input_value', name: 'STEPS', check: 'Number' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.motion,
  },
  {
    type: 'vk_turn_right',
    message0: '↻ tourner à droite de %1 degrés',
    args0: [{ type: 'input_value', name: 'DEGREES', check: 'Number' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.motion,
  },
  {
    type: 'vk_turn_left',
    message0: '↺ tourner à gauche de %1 degrés',
    args0: [{ type: 'input_value', name: 'DEGREES', check: 'Number' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.motion,
  },
  {
    type: 'vk_go_to_xy',
    message0: 'aller à x: %1 y: %2',
    args0: [
      { type: 'input_value', name: 'X', check: 'Number' },
      { type: 'input_value', name: 'Y', check: 'Number' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.motion,
  },
  {
    type: 'vk_glide_to_xy',
    message0: 'glisser en %1 sec à x: %2 y: %3',
    args0: [
      { type: 'input_value', name: 'SECS', check: 'Number' },
      { type: 'input_value', name: 'X', check: 'Number' },
      { type: 'input_value', name: 'Y', check: 'Number' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.motion,
  },
  {
    type: 'vk_x_position',
    message0: 'position x',
    output: 'Number',
    colour: COLORS.motion,
  },
  {
    type: 'vk_y_position',
    message0: 'position y',
    output: 'Number',
    colour: COLORS.motion,
  },

  // ---------- APPARENCE ----------
  {
    type: 'vk_say_for_secs',
    message0: 'dire %1 pendant %2 secondes',
    args0: [
      { type: 'input_value', name: 'TEXT' },
      { type: 'input_value', name: 'SECS', check: 'Number' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.looks,
  },
  {
    type: 'vk_say',
    message0: 'dire %1',
    args0: [{ type: 'input_value', name: 'TEXT' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.looks,
  },
  {
    type: 'vk_next_costume',
    message0: 'costume suivant',
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.looks,
  },
  {
    type: 'vk_switch_costume',
    message0: 'basculer sur le costume %1',
    args0: [{ type: 'input_value', name: 'NAME' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.looks,
    tooltip: "Le nom du costume est visible dans le panneau des costumes du sprite.",
  },
  {
    type: 'vk_change_size',
    message0: 'changer la taille de %1 %%',
    args0: [{ type: 'input_value', name: 'DELTA', check: 'Number' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.looks,
  },
  {
    type: 'vk_set_size',
    message0: 'mettre la taille à %1 %%',
    args0: [{ type: 'input_value', name: 'SIZE', check: 'Number' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.looks,
  },
  {
    type: 'vk_show',
    message0: 'montrer',
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.looks,
  },
  {
    type: 'vk_hide',
    message0: 'cacher',
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.looks,
  },

  // ---------- CONTRÔLE (blocs sans équivalent Blockly natif) ----------
  {
    type: 'vk_wait_secs',
    message0: 'attendre %1 secondes',
    args0: [{ type: 'input_value', name: 'SECS', check: 'Number' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLORS.control,
  },
  {
    type: 'vk_forever',
    message0: 'toujours %1 %2',
    args0: [
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'DO' },
    ],
    previousStatement: null,
    colour: COLORS.control,
    tooltip: 'Répète les blocs à l’intérieur pour toujours.',
  },
  {
    type: 'vk_stop_all',
    message0: '⛔ tout arrêter',
    previousStatement: null,
    colour: COLORS.control,
  },
];

Blockly.defineBlocksWithJsonArray(jsonBlocks);

// Give stock blocks we reuse the Scratch-style colours too, so the palette
// looks consistent instead of Blockly's default blue-for-everything.
const STOCK_COLOUR_OVERRIDES = {
  controls_repeat_ext: COLORS.control,
  controls_if: COLORS.control,
  math_arithmetic: COLORS.operators,
  logic_compare: COLORS.operators,
  logic_operation: COLORS.operators,
  logic_negate: COLORS.operators,
  math_random_int: COLORS.operators,
  variables_get: COLORS.variables,
  variables_set: COLORS.variables,
  math_change: COLORS.variables,
  text: COLORS.looks,
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

// ---------- Toolbox (French category labels) ----------
export const TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category', name: 'Événements', colour: COLORS.events,
      contents: [
        { kind: 'block', type: 'vk_when_green_flag' },
        { kind: 'block', type: 'vk_when_key_pressed' },
        { kind: 'block', type: 'vk_when_sprite_clicked' },
      ],
    },
    {
      kind: 'category', name: 'Mouvement', colour: COLORS.motion,
      contents: [
        { kind: 'block', type: 'vk_move_steps', inputs: { STEPS: { shadow: { type: 'math_number', fields: { NUM: 10 } } } } },
        { kind: 'block', type: 'vk_turn_right', inputs: { DEGREES: { shadow: { type: 'math_number', fields: { NUM: 15 } } } } },
        { kind: 'block', type: 'vk_turn_left', inputs: { DEGREES: { shadow: { type: 'math_number', fields: { NUM: 15 } } } } },
        { kind: 'block', type: 'vk_go_to_xy', inputs: {
          X: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
          Y: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
        } },
        { kind: 'block', type: 'vk_glide_to_xy', inputs: {
          SECS: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
          X: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
          Y: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
        } },
        { kind: 'block', type: 'vk_x_position' },
        { kind: 'block', type: 'vk_y_position' },
      ],
    },
    {
      kind: 'category', name: 'Apparence', colour: COLORS.looks,
      contents: [
        { kind: 'block', type: 'vk_say_for_secs', inputs: {
          TEXT: { shadow: { type: 'text', fields: { TEXT: 'Bonjour !' } } },
          SECS: { shadow: { type: 'math_number', fields: { NUM: 2 } } },
        } },
        { kind: 'block', type: 'vk_say', inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: 'Bonjour !' } } } } },
        { kind: 'block', type: 'vk_next_costume' },
        { kind: 'block', type: 'vk_switch_costume', inputs: { NAME: { shadow: { type: 'text', fields: { TEXT: 'costume1' } } } } },
        { kind: 'block', type: 'vk_change_size', inputs: { DELTA: { shadow: { type: 'math_number', fields: { NUM: 10 } } } } },
        { kind: 'block', type: 'vk_set_size', inputs: { SIZE: { shadow: { type: 'math_number', fields: { NUM: 100 } } } } },
        { kind: 'block', type: 'vk_show' },
        { kind: 'block', type: 'vk_hide' },
      ],
    },
    {
      kind: 'category', name: 'Contrôle', colour: COLORS.control,
      contents: [
        { kind: 'block', type: 'vk_wait_secs', inputs: { SECS: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } },
        { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: { shadow: { type: 'math_number', fields: { NUM: 10 } } } } },
        { kind: 'block', type: 'vk_forever' },
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'vk_stop_all' },
      ],
    },
    {
      kind: 'category', name: 'Opérateurs', colour: COLORS.operators,
      contents: [
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_negate' },
        { kind: 'block', type: 'math_random_int', inputs: {
          FROM: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
          TO: { shadow: { type: 'math_number', fields: { NUM: 10 } } },
        } },
      ],
    },
    {
      kind: 'category', name: 'Variables', colour: COLORS.variables, custom: 'VARIABLE',
    },
  ],
};

export { Order };
