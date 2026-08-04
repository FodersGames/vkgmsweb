import {
  Type, MousePointerClick, Image, TextCursorInput, LayoutGrid, Minus, MoveVertical,
  Sparkles, List as ListIcon, ToggleLeft,
} from 'lucide-react';

// Single source of truth for the Studio App Builder — used by the admin
// editor (component palette + inspector) and the runtime for defaults.
// V1 deliberately keeps the component tree flat (max one level of nesting
// via "container") rather than a free-form canvas — makes drag/drop and
// the inspector tractable without a full layout-constraint engine.
//
// `tier` on components/themes is a forward-compatible marker for the
// planned Vakar+ paid tier (design-system upgrade phase) — it's shown as a
// badge in the editor today but NOT enforced anywhere yet, since neither
// real subscriptions nor public (non-staff) access exist yet. Enforcement
// is a later phase once both of those ship.

export const genId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export const COMPONENT_TYPES = [
  {
    type: 'text', label: 'Text', icon: Type, isContainer: false, tier: 'free',
    defaultProps: { content: 'Text', size: 'md', weight: 'normal', align: 'left', color: '' },
  },
  {
    type: 'button', label: 'Button', icon: MousePointerClick, isContainer: false, supportsAction: true, tier: 'free',
    defaultProps: { label: 'Button', style: 'primary' },
  },
  {
    type: 'image', label: 'Image', icon: Image, isContainer: false, tier: 'free',
    defaultProps: { url: '', height: 160, radius: 12 },
  },
  {
    type: 'input', label: 'Input', icon: TextCursorInput, isContainer: false, tier: 'free',
    defaultProps: { placeholder: 'Type here…', variable: '' },
  },
  {
    type: 'container', label: 'Group', icon: LayoutGrid, isContainer: true, tier: 'free',
    defaultProps: { direction: 'column', gap: 12, align: 'stretch', padding: 0, background: 'none', border: false, radius: 0, shadow: false },
  },
  {
    type: 'divider', label: 'Divider', icon: Minus, isContainer: false, tier: 'free',
    defaultProps: {},
  },
  {
    type: 'spacer', label: 'Spacer', icon: MoveVertical, isContainer: false, tier: 'free',
    defaultProps: { size: 16 },
  },
  {
    type: 'icon', label: 'Icon', icon: Sparkles, isContainer: false, tier: 'premium',
    defaultProps: { icon: 'star', size: 28, color: '' },
  },
  {
    type: 'toggle', label: 'Toggle', icon: ToggleLeft, isContainer: false, tier: 'premium',
    defaultProps: { label: 'Toggle', variable: '' },
  },
  {
    type: 'list', label: 'List', icon: ListIcon, isContainer: false, tier: 'premium',
    defaultProps: { source_variable: '', item_template: '{{item}}', empty_text: 'No items yet.' },
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
];
export const THEME_MAP = Object.fromEntries(THEME_PRESETS.map(t => [t.id, t]));
export const DEFAULT_THEME_ID = 'mint';
export const resolveTheme = (id) => THEME_MAP[id] || THEME_MAP[DEFAULT_THEME_ID];

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
