import {
  Type, MousePointerClick, Image, TextCursorInput, LayoutGrid, Minus, MoveVertical,
  Sparkles, List as ListIcon, ToggleLeft, CheckSquare, Star, Activity, QrCode,
  SlidersHorizontal, Calendar, Video, Globe,
} from 'lucide-react';

// Single source of truth for the Studio App Builder — used by the admin
// editor (component palette + inspector) and the runtime for defaults.
// V1 deliberately keeps the component tree flat (max one level of nesting
// via "container") — components are freely positioned/resized (`layout:
// {x,y,w,h}`, absolute pixels within CANVAS_WIDTH x CANVAS_HEIGHT, or
// relative to their parent container) rather than flowed, matching a
// MIT-App-Inventor-style designer canvas.
//
// `tier` on components/themes is a forward-compatible marker for the
// planned Vakar+ paid tier (design-system upgrade phase) — it's shown as a
// badge in the editor today but NOT enforced anywhere yet, since neither
// real subscriptions nor public (non-staff) access exist yet. Enforcement
// is a later phase once both of those ship.

export const genId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

// Reference design canvas size — a fixed-frame "phone screen" every screen
// is designed at. The public runtime scales this proportionally to fit the
// visitor's actual viewport; the editor and preview show it at 1:1 so
// placement/resizing is precise, like a real design tool.
export const CANVAS_WIDTH = 360;
export const CANVAS_HEIGHT = 640;

export const DEFAULT_LAYOUT = {
  text: { x: 20, y: 20, w: 240, h: 30 },
  button: { x: 20, y: 20, w: 160, h: 44 },
  image: { x: 20, y: 20, w: 200, h: 150 },
  input: { x: 20, y: 20, w: 240, h: 44 },
  container: { x: 20, y: 20, w: 300, h: 150 },
  // h:8 is the *click/drag hitbox* — the visual line itself stays a thin
  // 2px rule vertically centered inside that box (see AppRuntime.js /
  // exportApp.js's divider case). A 1px-tall box was nearly unselectable.
  divider: { x: 20, y: 20, w: 300, h: 8 },
  spacer: { x: 20, y: 20, w: 20, h: 20 },
  icon: { x: 20, y: 20, w: 32, h: 32 },
  toggle: { x: 20, y: 20, w: 200, h: 32 },
  list: { x: 20, y: 20, w: 300, h: 200 },
  checkbox: { x: 20, y: 20, w: 200, h: 28 },
  rating: { x: 20, y: 20, w: 160, h: 28 },
  progress: { x: 20, y: 20, w: 280, h: 12 },
  qr: { x: 20, y: 20, w: 140, h: 140 },
  slider: { x: 20, y: 20, w: 240, h: 32 },
  date: { x: 20, y: 20, w: 200, h: 44 },
  video: { x: 20, y: 20, w: 320, h: 180 },
  webview: { x: 20, y: 20, w: 320, h: 400 },
};

// `index` is only used as a fallback for components saved before free
// positioning existed (no `layout` field yet) — instead of stacking every
// legacy same-type component on the exact same default spot, it cascades
// them top to bottom by their position in the list, roughly approximating
// the old flow layout until the user drags them where they actually want.
export const getLayout = (node, index = 0) => {
  if (node?.layout) return node.layout;
  const base = DEFAULT_LAYOUT[node?.type] || { x: 20, y: 20, w: 120, h: 40 };
  return { ...base, y: base.y + index * (base.h + 12) };
};

export const COMPONENT_TYPES = [
  {
    type: 'text', label: 'Text', icon: Type, isContainer: false, tier: 'free',
    defaultProps: { content: 'Text', size: 'md', weight: 'normal', align: 'left', color: '' },
  },
  {
    type: 'button', label: 'Button', icon: MousePointerClick, isContainer: false, supportsAction: true,
    actionTrigger: 'onClick', actionLabel: 'When clicked', tier: 'free',
    defaultProps: { label: 'Button', style: 'primary', icon: '' },
  },
  {
    type: 'image', label: 'Image', icon: Image, isContainer: false, tier: 'free',
    defaultProps: { url: '', radius: 12, fit: 'cover', border: false },
  },
  {
    type: 'input', label: 'Input', icon: TextCursorInput, isContainer: false, tier: 'free',
    defaultProps: { placeholder: 'Type here…', variable: '', input_type: 'text', max_length: null },
  },
  {
    type: 'container', label: 'Group', icon: LayoutGrid, isContainer: true, tier: 'free',
    defaultProps: { background: 'none', border: false, radius: 0, shadow: false, opacity: 100 },
  },
  {
    type: 'divider', label: 'Divider', icon: Minus, isContainer: false, tier: 'free',
    defaultProps: {},
  },
  {
    type: 'spacer', label: 'Spacer', icon: MoveVertical, isContainer: false, tier: 'free',
    defaultProps: {},
  },
  {
    type: 'icon', label: 'Icon', icon: Sparkles, isContainer: false, tier: 'premium',
    defaultProps: { icon: 'star', color: '' },
  },
  {
    type: 'toggle', label: 'Toggle', icon: ToggleLeft, isContainer: false, supportsAction: true,
    actionTrigger: 'onChange', actionLabel: 'When toggled', tier: 'premium',
    defaultProps: { label: 'Toggle', variable: '' },
  },
  {
    type: 'list', label: 'List', icon: ListIcon, isContainer: false, tier: 'premium',
    // item_action: an optional single action (same shape as createAction())
    // run when a rendered row is tapped, with {{item...}} interpolation
    // available in its fields. No separate premium gate needed — `list`
    // itself is already a fully premium type.
    defaultProps: { source_variable: '', item_template: '{{item}}', empty_text: 'No items yet.', item_action: null },
  },
  {
    type: 'checkbox', label: 'Checkbox', icon: CheckSquare, isContainer: false, supportsAction: true,
    actionTrigger: 'onChange', actionLabel: 'When changed', tier: 'free',
    defaultProps: { label: 'Checkbox', variable: '' },
  },
  {
    type: 'rating', label: 'Rating', icon: Star, isContainer: false, supportsAction: true,
    actionTrigger: 'onChange', actionLabel: 'When changed', tier: 'free',
    defaultProps: { variable: '', max: 5, color: '' },
  },
  {
    type: 'progress', label: 'Progress bar', icon: Activity, isContainer: false, tier: 'free',
    defaultProps: { variable: '', value: 50 },
  },
  {
    // Live runtime (editor/preview/public page) renders a real, always
    // up-to-date QR — the exported static project bakes a one-time
    // snapshot at export time instead (see exportApp.js's qr case): a
    // genuinely live QR encoder there would mean vendoring a full
    // synchronous QR algorithm into the generated script.js, which is
    // disproportionate for the common case (encoding a fixed URL).
    type: 'qr', label: 'QR code', icon: QrCode, isContainer: false, tier: 'free',
    defaultProps: { content: 'https://vakargames.com' },
  },
  {
    type: 'slider', label: 'Slider', icon: SlidersHorizontal, isContainer: false, supportsAction: true,
    actionTrigger: 'onChange', actionLabel: 'When changed', tier: 'premium',
    defaultProps: { variable: '', min: 0, max: 100, step: 1 },
  },
  {
    type: 'date', label: 'Date picker', icon: Calendar, isContainer: false, supportsAction: true,
    actionTrigger: 'onChange', actionLabel: 'When changed', tier: 'premium',
    defaultProps: { variable: '' },
  },
  {
    type: 'video', label: 'Video', icon: Video, isContainer: false, tier: 'premium',
    defaultProps: { url: '' },
  },
  {
    type: 'webview', label: 'Web view', icon: Globe, isContainer: false, tier: 'premium',
    defaultProps: { url: '' },
  },
];

export const COMPONENT_META = Object.fromEntries(COMPONENT_TYPES.map(c => [c.type, c]));

export function createComponent(type, layoutOverride) {
  const meta = COMPONENT_META[type];
  if (!meta) return null;
  return {
    id: genId(),
    type,
    props: { ...meta.defaultProps },
    actions: {},
    layout: { ...DEFAULT_LAYOUT[type], ...(layoutOverride || {}) },
    ...(meta.isContainer ? { children: [] } : {}),
  };
}

// `category` groups the type picker into an <optgroup> (ActionEditor,
// AppBuilderEditor.js) instead of one long flat list — thirteen raw
// technical names read as overwhelming, six labeled sections don't.
export const ACTION_TYPES = [
  { type: 'navigate', label: 'Go to screen', category: 'Navigate' },
  { type: 'set_variable', label: 'Set a variable', category: 'Variables & Math' },
  { type: 'calculate', label: 'Calculate', category: 'Variables & Math' },
  { type: 'reset_variables', label: 'Reset all variables', category: 'Variables & Math' },
  { type: 'update_text', label: 'Update an element', category: 'Elements' },
  { type: 'set_visibility', label: 'Show/hide an element', category: 'Elements' },
  { type: 'list_add', label: 'Add to a list', category: 'Lists' },
  { type: 'list_remove', label: 'Remove from a list', category: 'Lists' },
  { type: 'show_message', label: 'Show a message', category: 'Feedback & Device' },
  { type: 'copy_to_clipboard', label: 'Copy to clipboard', category: 'Feedback & Device' },
  { type: 'vibrate', label: 'Vibrate', category: 'Feedback & Device' },
  { type: 'wait', label: 'Wait', category: 'Feedback & Device' },
  { type: 'open_link', label: 'Open a link', category: 'Links' },
];

// One plain-language line shown under the type picker once a step's type
// is chosen — the "very advanced but very simple to use" balance: more
// power in the dropdown, but nobody has to guess what a label means.
export const ACTION_DESCRIPTIONS = {
  navigate: 'Switches to a different screen.',
  set_variable: 'Sets, toggles, or adjusts a variable by a fixed amount.',
  calculate: 'Combines two numbers and stores the result in a variable.',
  reset_variables: 'Resets every variable back to its starting value — handy for a "Start over" button.',
  update_text: "Replaces an element's visible text.",
  set_visibility: 'Shows, hides, or toggles another element.',
  list_add: 'Adds a value to a list, at the start, end, or a specific position.',
  list_remove: 'Removes an item from a list.',
  show_message: 'Flashes a short message on screen.',
  copy_to_clipboard: 'Copies text so the visitor can paste it elsewhere.',
  vibrate: 'Triggers a short haptic buzz (phones only — no effect in a browser).',
  wait: 'Pauses before the next step runs — useful for pacing a sequence.',
  open_link: 'Opens a URL, in this app or a new tab.',
};

export function createAction(type) {
  switch (type) {
    case 'navigate': return { type, screen_id: '' };
    case 'set_variable': return { type, variable: '', value_mode: 'literal', value: '' };
    case 'calculate': return { type, variable: '', op: 'add', a: '', b: '' };
    case 'reset_variables': return { type };
    case 'update_text': return { type, target_id: '', value_mode: 'literal', value: '' };
    case 'set_visibility': return { type, target_id: '', visible: 'toggle' };
    // value_mode 'variable' copies another variable's current value (e.g. an
    // input bound to `entryText`) — the same convenience update_text already
    // offers, so "take what's in this input and add it to the list" doesn't
    // require manually typing {{entryText}}.
    case 'list_add': return { type, variable: '', mode: 'append', value_mode: 'literal', value: '', index: 0 };
    case 'list_remove': return { type, variable: '', mode: 'last', index: 0 };
    case 'show_message': return { type, text: '' };
    case 'copy_to_clipboard': return { type, text: '' };
    case 'vibrate': return { type, duration_ms: 200 };
    case 'wait': return { type, duration_ms: 500 };
    case 'open_link': return { type, url: '', new_tab: true };
    default: return null;
  }
}

// Basic imperative show/hide (free) is a plain action, above. Declarative
// visibility (a component auto-hides based on a live condition, no button
// needed) is the Vakar+ perk — VISIBILITY_OPERATORS backs its condition
// builder, gated server-side alongside custom text sizing (see
// _check_component_tier in studio_apps.py).
export const VISIBILITY_OPERATORS = [
  { id: 'eq', label: 'equals' },
  { id: 'neq', label: 'does not equal' },
  { id: 'gt', label: 'is greater than' },
  { id: 'lt', label: 'is less than' },
  { id: 'truthy', label: 'is set (not empty/0/false)' },
];

// A button's onClick used to be a single action object; it's now a list run
// in order (e.g. "add 1 to coins" then "update text1 with coins"), so both
// the editor and the two runtimes normalize through this — reading old
// single-object data as a one-step list, never requiring a backend migration.
export function normalizeActions(actions) {
  if (!actions) return [];
  return Array.isArray(actions) ? actions : [actions];
}

// Which prop of a component an "Update an element" action writes to, and
// which component types are valid targets for it — text content is the
// primary use case, button/toggle labels are the same idea applied to their
// own visible text.
export const UPDATABLE_PROP = { text: 'content', button: 'label', toggle: 'label' };
export const UPDATABLE_TYPES = Object.keys(UPDATABLE_PROP);

export const TEXT_SIZES = ['sm', 'md', 'lg', 'xl'];
export const TEXT_SIZE_PX = { sm: 13, md: 15, lg: 20, xl: 28 };
export const MIN_CUSTOM_TEXT_PX = 8;
export const MAX_CUSTOM_TEXT_PX = 96;
// A Vakar+ perk: a text can be given an exact pixel size instead of picking
// from the sm/md/lg/xl presets — `props.size === 'custom'` switches to
// `props.size_px`. Shared by AppRuntime.js and exportApp.js so both
// implementations compute the same size the same way.
export function resolveTextSizePx(props) {
  if (props?.size === 'custom') {
    const n = Number(props.size_px);
    return Number.isFinite(n) && n > 0 ? n : TEXT_SIZE_PX.md;
  }
  return TEXT_SIZE_PX[props?.size] || TEXT_SIZE_PX.md;
}

export const BUTTON_STYLES = ['primary', 'secondary', 'outline'];
export const DIRECTIONS = ['column', 'row'];

// Entrance animation, played once when a component mounts (screen
// navigation remounts the target screen, so re-visiting a screen replays
// it). 'fade' is free — a taste of the category; the rest are Vakar+
// (see PREMIUM_ANIMATIONS, also mirrored server-side in studio_apps.py).
// Class names match @keyframes/.vk-anim-* added to index.css.
export const ANIMATION_TYPES = [
  { id: 'none', label: 'None', tier: 'free' },
  { id: 'fade', label: 'Fade in', tier: 'free' },
  { id: 'slide-up', label: 'Slide up', tier: 'premium' },
  { id: 'slide-down', label: 'Slide down', tier: 'premium' },
  { id: 'pop', label: 'Pop', tier: 'premium' },
];
export const PREMIUM_ANIMATIONS = new Set(
  ANIMATION_TYPES.filter(a => a.tier === 'premium').map(a => a.id)
);

// ============================================================
// Themes — resolved app-wide color/radius defaults. Components with an
// explicit prop (e.g. a text's own `color`) still override the theme;
// leaving a prop blank falls back to the theme, which is what makes an
// app assembled from default-configured components still look coherent
// instead of flat grey-on-white.
// ============================================================
export const THEME_PRESETS = [
  {
    id: 'mint', label: 'Mint', tier: 'free',
    colors: { primary: '#4ECDC4', primaryText: '#062A27', background: '#F5F5F7', surface: '#FFFFFF', border: '#D2D2D7', text: '#1D1D1F', textMuted: '#6E6E73' },
    radius: 14,
  },
  {
    id: 'mono', label: 'Mono', tier: 'premium',
    colors: { primary: '#1D1D1F', primaryText: '#FFFFFF', background: '#FAFAFA', surface: '#FFFFFF', border: '#E5E5E5', text: '#1D1D1F', textMuted: '#71717A' },
    radius: 10,
  },
  {
    id: 'sunset', label: 'Sunset', tier: 'premium',
    colors: { primary: '#F2994A', primaryText: '#2B1400', background: '#FFF7F0', surface: '#FFFFFF', border: '#F5D9BF', text: '#2B1400', textMuted: '#8A6A4F' },
    radius: 18,
  },
  {
    id: 'ocean', label: 'Ocean', tier: 'premium',
    colors: { primary: '#2F80ED', primaryText: '#FFFFFF', background: '#F0F6FF', surface: '#FFFFFF', border: '#CBDFFB', text: '#0F1F33', textMuted: '#5B7492' },
    radius: 12,
  },
  {
    id: 'grape', label: 'Grape', tier: 'premium',
    colors: { primary: '#6C5CE7', primaryText: '#FFFFFF', background: '#F6F4FF', surface: '#FFFFFF', border: '#DCD5FA', text: '#1E1633', textMuted: '#6B5F8A' },
    radius: 16,
  },
  {
    id: 'midnight', label: 'Midnight', tier: 'premium',
    colors: { primary: '#4ECDC4', primaryText: '#06201D', background: '#14141C', surface: '#1C1C28', border: '#2A2A3C', text: '#EDEDF2', textMuted: '#9A9AB0' },
    radius: 14,
  },
  {
    id: 'forest', label: 'Forest', tier: 'premium',
    colors: { primary: '#2F9E44', primaryText: '#FFFFFF', background: '#F3FAF4', surface: '#FFFFFF', border: '#CFE8D5', text: '#163020', textMuted: '#5B7A66' },
    radius: 14,
  },
  {
    id: 'rose', label: 'Rose', tier: 'premium',
    colors: { primary: '#E85D8A', primaryText: '#FFFFFF', background: '#FFF3F7', surface: '#FFFFFF', border: '#F6D3E1', text: '#3A1424', textMuted: '#8A5B6E' },
    radius: 18,
  },
  {
    id: 'amber', label: 'Amber', tier: 'premium',
    colors: { primary: '#F2A93B', primaryText: '#2B1900', background: '#FFFAF0', surface: '#FFFFFF', border: '#F5E1BF', text: '#2B1900', textMuted: '#8A7350' },
    radius: 12,
  },
  {
    id: 'slate', label: 'Slate', tier: 'premium',
    colors: { primary: '#5B7A9A', primaryText: '#FFFFFF', background: '#F4F6F8', surface: '#FFFFFF', border: '#D8E0E7', text: '#1F2933', textMuted: '#64748B' },
    radius: 10,
  },
  {
    id: 'cyan', label: 'Cyan', tier: 'premium',
    colors: { primary: '#17B8C4', primaryText: '#06282B', background: '#F0FCFD', surface: '#FFFFFF', border: '#C6EEF1', text: '#0B2E31', textMuted: '#4C8A90' },
    radius: 16,
  },
  {
    id: 'crimson', label: 'Crimson', tier: 'premium',
    colors: { primary: '#E0435F', primaryText: '#FFFFFF', background: '#1A0E10', surface: '#241417', border: '#3D2226', text: '#F2E4E6', textMuted: '#B08A8F' },
    radius: 12,
  },
];
export const THEME_MAP = Object.fromEntries(THEME_PRESETS.map(t => [t.id, t]));
export const DEFAULT_THEME_ID = 'mint';
export const resolveTheme = (id) => THEME_MAP[id] || THEME_MAP[DEFAULT_THEME_ID];

// ============================================================
// Submission tags — a fixed taxonomy the submitter picks from (not free
// text) so the showcase/storefront filter chips (Applications.js) stay
// consistent instead of accumulating near-duplicate variants ("game" vs
// "Games" vs "gaming"). Mirrored server-side in studio_apps.py's
// ALLOWED_APP_TAGS — keep both lists in sync by hand, same precedent as
// every other cross-stack constant in this codebase.
// ============================================================
export const APP_TAGS = [
  'Productivity', 'Games', 'Social', 'Education', 'Finance',
  'Health & Fitness', 'Entertainment', 'Business', 'Utilities', 'Lifestyle',
  'Photo & Video', 'Travel', 'Food & Drink', 'Sports', 'Kids & Family', 'Other',
];
export const MIN_APP_TAGS = 1;
export const MAX_APP_TAGS = 3;

// ============================================================
// Icon set — a small, original, dependency-free line-icon registry so the
// runtime (public pages + editor preview) never needs an icon library.
// viewBox 0 0 24 24, stroke-based, currentColor.
// ============================================================
export const ICON_IDS = [
  'home', 'star', 'heart', 'check', 'bell', 'settings', 'user', 'cart',
  'search', 'mail', 'calendar', 'camera', 'chat', 'warning', 'arrowRight', 'lock',
];

export const ICON_PATHS = {
  home: <><path d="M3 11l9-7 9 7" /><path d="M5 10v9h14v-9" /></>,
  star: <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8-6.2 3.8 1.6-7L2 9.2l7.1-.6z" strokeLinejoin="round" />,
  heart: <path d="M12 21s-7-4.35-9.5-8.5C1 9 2.5 5 6 5c2 0 3.5 1.2 4 2.5.5-1.3 2-2.5 4-2.5 3.5 0 5 4 3.5 7.5C19 16.65 12 21 12 21z" strokeLinejoin="round" />,
  check: <path d="M4 12l5 5 11-11" />,
  bell: <><path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z" /><path d="M10 20a2 2 0 004 0" /></>,
  settings: <><line x1="4" y1="6" x2="20" y2="6" /><circle cx="9" cy="6" r="2" /><line x1="4" y1="12" x2="20" y2="12" /><circle cx="15" cy="12" r="2" /><line x1="4" y1="18" x2="20" y2="18" /><circle cx="9" cy="18" r="2" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></>,
  cart: <><path d="M3 4h2l2.4 12.4a2 2 0 002 1.6h8.2a2 2 0 002-1.6L21 8H6" /><circle cx="9" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /></>,
  search: <><circle cx="11" cy="11" r="6" /><line x1="20" y1="20" x2="15.5" y2="15.5" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" /></>,
  camera: <><path d="M4 8h3l2-2h6l2 2h3v11H4z" /><circle cx="12" cy="13.5" r="3.5" /></>,
  chat: <path d="M4 5h16v10H8l-4 4z" strokeLinejoin="round" />,
  warning: <><path d="M12 3l10 18H2z" strokeLinejoin="round" /><line x1="12" y1="9" x2="12" y2="14" /><circle cx="12" cy="17.3" r="0.6" fill="currentColor" stroke="none" /></>,
  arrowRight: <><line x1="4" y1="12" x2="20" y2="12" /><path d="M14 6l6 6-6 6" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></>,
};

export function AppIcon({ id, size = 24, color = 'currentColor', strokeWidth = 1.8 }) {
  const glyph = ICON_PATHS[id] || ICON_PATHS.star;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {glyph}
    </svg>
  );
}

// ============================================================
// Premium preview demos — small scripted scenes shown in a popup when a
// locked (Vakar+) theme or component is clicked, so instead of a bare
// "requires Vakar+" message the owner sees roughly what it looks like in a
// real, moving app. One scene per premium component type (so clicking
// `slider` looks nothing like clicking `list`) plus one shared `theme`
// scene reused across every premium theme (themes already differ from
// each other by color — the gap was staticness, not lack of variety).
// `theme` is also the fallback for premium *features* that aren't tied to
// a specific component type (custom text size, conditional visibility) —
// `AppBuilderEditor.js`'s onPremiumBlocked calls for those don't pass a
// `type`, only a `label`.
//
// Each scene: {components, vars, timeline?}. `timeline` (optional) is a
// plain ordered list of {atMs, vars} snapshots — PreviewPlayer
// (AppBuilderEditor.js) replays it on a loop by feeding `vars` into the
// same ComponentVisual/PositionedNode renderer everything else uses (a
// scripted mock, not a real interactive app — nothing is clickable).
// Components with no timeline entry just replay their own entrance
// `props.animation` every loop instead (PreviewPlayer remounts them).
// ============================================================
function previewNode(id, type, layout, props, animation) {
  return { id, type, actions: {}, layout, props: animation ? { ...props, animation } : props };
}

export const PREMIUM_PREVIEW_SCENES = {
  theme: {
    vars: { toggleVar: 'true', itemsVar: JSON.stringify(['Completed 5 workouts', 'Earned 120 points', 'Invited 2 friends']) },
    timeline: [
      { atMs: 0, vars: { toggleVar: 'true' } },
      { atMs: 1400, vars: { toggleVar: 'false' } },
      { atMs: 2800, vars: { toggleVar: 'true' } },
    ],
    components: [
      previewNode('t-title', 'text', { x: 24, y: 32, w: 280, h: 44 }, { content: 'Level Up', size: 'custom', size_px: 30, weight: 'bold', align: 'left', color: '' }, 'fade'),
      previewNode('t-subtitle', 'text', { x: 24, y: 78, w: 280, h: 22 }, { content: 'Your weekly recap', size: 'sm', weight: 'normal', align: 'left', color: '' }, 'fade'),
      previewNode('t-toggle', 'toggle', { x: 24, y: 118, w: 312, h: 32 }, { label: 'Push notifications', variable: 'toggleVar' }, 'slide-up'),
      previewNode('t-list', 'list', { x: 24, y: 166, w: 312, h: 192 }, { source_variable: 'itemsVar', item_template: '{{item}}', empty_text: 'No items yet.' }, 'slide-up'),
      previewNode('t-button', 'button', { x: 24, y: 378, w: 312, h: 48 }, { label: 'Continue', style: 'primary' }, 'pop'),
    ],
  },
  icon: {
    vars: {},
    components: [
      previewNode('i-caption', 'text', { x: 24, y: 40, w: 280, h: 22 }, { content: 'A full icon library', size: 'sm', weight: 'bold', align: 'left', color: '' }, 'fade'),
      previewNode('i-1', 'icon', { x: 24, y: 90, w: 48, h: 48 }, { icon: 'star', color: '' }, 'pop'),
      previewNode('i-2', 'icon', { x: 90, y: 90, w: 48, h: 48 }, { icon: 'heart', color: '' }, 'pop'),
      previewNode('i-3', 'icon', { x: 156, y: 90, w: 48, h: 48 }, { icon: 'bell', color: '' }, 'pop'),
      previewNode('i-4', 'icon', { x: 222, y: 90, w: 48, h: 48 }, { icon: 'chat', color: '' }, 'pop'),
    ],
  },
  toggle: {
    vars: { demoToggle: 'true' },
    timeline: [
      { atMs: 0, vars: { demoToggle: 'true' } },
      { atMs: 1200, vars: { demoToggle: 'false' } },
      { atMs: 2400, vars: { demoToggle: 'true' } },
    ],
    components: [
      previewNode('tg-caption', 'text', { x: 24, y: 60, w: 280, h: 22 }, { content: 'Live preference switches', size: 'sm', weight: 'bold', align: 'left', color: '' }, 'fade'),
      previewNode('tg-toggle', 'toggle', { x: 24, y: 100, w: 312, h: 32 }, { label: 'Notifications', variable: 'demoToggle' }, 'slide-up'),
    ],
  },
  list: {
    vars: { demoItems: JSON.stringify(['Design review', 'Ship v2', 'Write tests']) },
    components: [
      previewNode('l-caption', 'text', { x: 24, y: 32, w: 280, h: 22 }, { content: 'Dynamic, scrollable lists', size: 'sm', weight: 'bold', align: 'left', color: '' }, 'fade'),
      previewNode('l-list', 'list', { x: 24, y: 72, w: 312, h: 180 }, { source_variable: 'demoItems', item_template: '{{item}}', empty_text: 'No items yet.' }, 'slide-up'),
    ],
  },
  slider: {
    vars: { demoSlider: '0' },
    timeline: [
      { atMs: 0, vars: { demoSlider: '0' } },
      { atMs: 500, vars: { demoSlider: '35' } },
      { atMs: 1000, vars: { demoSlider: '70' } },
      { atMs: 1500, vars: { demoSlider: '100' } },
      { atMs: 2000, vars: { demoSlider: '55' } },
      { atMs: 2500, vars: { demoSlider: '0' } },
    ],
    components: [
      previewNode('sl-caption', 'text', { x: 24, y: 70, w: 280, h: 22 }, { content: 'Precise numeric input', size: 'sm', weight: 'bold', align: 'left', color: '' }, 'fade'),
      previewNode('sl-slider', 'slider', { x: 24, y: 110, w: 260, h: 32 }, { variable: 'demoSlider', min: 0, max: 100, step: 1 }, 'slide-up'),
    ],
  },
  date: {
    vars: { demoDate: '' },
    components: [
      previewNode('d-caption', 'text', { x: 24, y: 60, w: 280, h: 22 }, { content: 'Native date picking', size: 'sm', weight: 'bold', align: 'left', color: '' }, 'fade'),
      previewNode('d-date', 'date', { x: 24, y: 100, w: 200, h: 44 }, { variable: 'demoDate' }, 'pop'),
    ],
  },
  video: {
    vars: {},
    components: [
      previewNode('v-caption', 'text', { x: 24, y: 60, w: 280, h: 22 }, { content: 'Embed any video', size: 'sm', weight: 'bold', align: 'left', color: '' }, 'fade'),
      previewNode('v-video', 'video', { x: 24, y: 100, w: 260, h: 146 }, { url: '' }, 'pop'),
    ],
  },
  webview: {
    vars: {},
    components: [
      previewNode('w-caption', 'text', { x: 24, y: 60, w: 280, h: 22 }, { content: 'Embed any website', size: 'sm', weight: 'bold', align: 'left', color: '' }, 'fade'),
      previewNode('w-webview', 'webview', { x: 24, y: 100, w: 260, h: 160 }, { url: '' }, 'pop'),
    ],
  },
};
