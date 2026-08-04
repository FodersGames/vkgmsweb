import {
  Type, MousePointerClick, Image, TextCursorInput, LayoutGrid, Minus, MoveVertical,
} from 'lucide-react';

// Single source of truth for the Studio App Builder — used by the admin
// editor (component palette + inspector) and, for defaults only, by the
// runtime when a component is missing a prop. V1 deliberately keeps the
// component tree flat (max one level of nesting via "container") rather
// than a free-form canvas — makes drag/drop and the inspector tractable
// without a full layout-constraint engine.

export const genId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export const COMPONENT_TYPES = [
  {
    type: 'text', label: 'Text', icon: Type, isContainer: false,
    defaultProps: { content: 'Text', size: 'md', weight: 'normal', align: 'left', color: '#1D1D1F' },
  },
  {
    type: 'button', label: 'Button', icon: MousePointerClick, isContainer: false, supportsAction: true,
    defaultProps: { label: 'Button', style: 'primary' },
  },
  {
    type: 'image', label: 'Image', icon: Image, isContainer: false,
    defaultProps: { url: '', height: 160, radius: 12 },
  },
  {
    type: 'input', label: 'Input', icon: TextCursorInput, isContainer: false,
    defaultProps: { placeholder: 'Type here…', variable: '' },
  },
  {
    type: 'container', label: 'Group', icon: LayoutGrid, isContainer: true,
    defaultProps: { direction: 'column', gap: 12, align: 'stretch' },
  },
  {
    type: 'divider', label: 'Divider', icon: Minus, isContainer: false,
    defaultProps: {},
  },
  {
    type: 'spacer', label: 'Spacer', icon: MoveVertical, isContainer: false,
    defaultProps: { size: 16 },
  },
];

export const COMPONENT_META = Object.fromEntries(COMPONENT_TYPES.map(c => [c.type, c]));

export function createComponent(type) {
  const meta = COMPONENT_META[type];
  if (!meta) return null;
  return {
    id: genId(),
    type,
    props: { ...meta.defaultProps },
    actions: {},
    ...(meta.isContainer ? { children: [] } : {}),
  };
}

export const ACTION_TYPES = [
  { type: 'navigate', label: 'Go to screen' },
  { type: 'set_variable', label: 'Set a variable' },
  { type: 'show_message', label: 'Show a message' },
  { type: 'call_api', label: 'Call an API' },
  { type: 'open_link', label: 'Open a link' },
];

export function createAction(type) {
  switch (type) {
    case 'navigate': return { type, screen_id: '' };
    case 'set_variable': return { type, variable: '', value_mode: 'literal', value: '' };
    case 'show_message': return { type, text: '' };
    case 'call_api': return { type, method: 'GET', url: '', body: '', store_in_variable: '' };
    case 'open_link': return { type, url: '', new_tab: true };
    default: return null;
  }
}

export const TEXT_SIZES = ['sm', 'md', 'lg', 'xl'];
export const BUTTON_STYLES = ['primary', 'secondary', 'outline'];
export const DIRECTIONS = ['column', 'row'];
