import {
  Type, MousePointerClick, Image, TextCursorInput, LayoutGrid, Minus, MoveVertical,
  Sparkles, List as ListIcon, ToggleLeft, CheckSquare, Star, Activity, QrCode,
  SlidersHorizontal, Calendar, Video, Globe,
  ChevronDown, Search, CircleDot, Plus, ChartBar, CircleUserRound, MapPin,
  PanelBottom, PanelTop, CirclePlus, Pilcrow, Images, ChevronsUpDown, Volume2,
  Paperclip, Timer, Tag,
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
  select: { x: 20, y: 20, w: 240, h: 44 },
  search: { x: 20, y: 20, w: 280, h: 44 },
  radio: { x: 20, y: 20, w: 240, h: 108 },
  stepper: { x: 20, y: 20, w: 160, h: 44 },
  chart: { x: 20, y: 20, w: 320, h: 200 },
  avatar: { x: 20, y: 20, w: 64, h: 64 },
  map: { x: 20, y: 20, w: 320, h: 200 },
  // Anchored to the screen's bottom/left/right edges by default (see
  // getLayout's anchor resolution) — stretches full-width and stays
  // pinned to the bottom regardless of what else is on the screen.
  bottomnav: { x: 0, y: CANVAS_HEIGHT - 64, w: CANVAS_WIDTH, h: 64, anchors: { left: 0, right: 0, bottom: 0 } },
  appbar: { x: 0, y: 0, w: CANVAS_WIDTH, h: 56, anchors: { left: 0, right: 0, top: 0 } },
  fab: { x: CANVAS_WIDTH - 76, y: CANVAS_HEIGHT - 116, w: 56, h: 56, anchors: { right: 20, bottom: 20 } },
  richtext: { x: 20, y: 20, w: 280, h: 90 },
  carousel: { x: 20, y: 20, w: 320, h: 180 },
  accordion: { x: 20, y: 20, w: 320, h: 60 },
  audio: { x: 20, y: 20, w: 280, h: 44 },
  filepicker: { x: 20, y: 20, w: 200, h: 44 },
  countdown: { x: 20, y: 20, w: 240, h: 60 },
  badge: { x: 20, y: 20, w: 80, h: 28 },
};

// `index` is only used as a fallback for components saved before free
// positioning existed (no `layout` field yet) — instead of stacking every
// legacy same-type component on the exact same default spot, it cascades
// them top to bottom by their position in the list, roughly approximating
// the old flow layout until the user drags them where they actually want.
//
// `layout.anchors` (optional, top-level components only — see the Anchors
// inspector section in AppBuilderEditor.js) pins one or more edges to the
// screen's own edges, constraint-style: {top, bottom, left, right}, each
// either a pixel margin or undefined/null for "not pinned". Pinning BOTH
// edges on an axis stretches the element to fill the gap between them
// (its stored w/h on that axis becomes a fallback, not the live size);
// pinning just one keeps its own w/h and only derives the offset. This
// resolves against the fixed CANVAS_WIDTH/CANVAS_HEIGHT reference frame —
// same one the runtime's letterboxed scale-to-fit already uses everywhere
// (see AppRuntime.js/exportApp.js) — so it's a purely additive, backward
// compatible convenience: a node with no `anchors` behaves exactly as
// before, byte-for-byte.
const ANCHOR_MIN_SIZE = 8;

export const getLayout = (node, index = 0) => {
  const base = node?.layout
    ? node.layout
    : { ...(DEFAULT_LAYOUT[node?.type] || { x: 20, y: 20, w: 120, h: 40 }) };
  const resolved = node?.layout ? base : { ...base, y: base.y + index * (base.h + 12) };
  const anchors = node?.layout?.anchors;
  if (!anchors) return resolved;

  let { x, y, w, h } = resolved;
  if (anchors.left != null && anchors.right != null) {
    x = anchors.left;
    w = Math.max(ANCHOR_MIN_SIZE, CANVAS_WIDTH - anchors.left - anchors.right);
  } else if (anchors.left != null) {
    x = anchors.left;
  } else if (anchors.right != null) {
    x = CANVAS_WIDTH - anchors.right - w;
  }
  if (anchors.top != null && anchors.bottom != null) {
    y = anchors.top;
    h = Math.max(ANCHOR_MIN_SIZE, CANVAS_HEIGHT - anchors.top - anchors.bottom);
  } else if (anchors.top != null) {
    y = anchors.top;
  } else if (anchors.bottom != null) {
    y = CANVAS_HEIGHT - anchors.bottom - h;
  }
  return { x, y, w, h };
};

// A component whose author never touched the Anchors inspector but placed
// it flush against a canvas edge anyway (e.g. a footer text dragged to the
// very bottom) still suffers the same letterboxing gap manual anchors were
// built to fix — the fixed 360x640 reference frame doesn't reach the real
// screen edge on a different aspect ratio, leaving dead space beyond it.
// This infers the same {top,bottom,left,right} shape automatically from
// raw proximity to an edge, so unanchored-but-edge-flush components get
// the same true-viewport-relative treatment as bottomnav/appbar/fab for
// free — explicit `layout.anchors` (if the author did set one, even a
// partial one) always wins as-is, this is purely a fallback for nodes that
// have none at all.
const AUTO_ANCHOR_EDGE_EPS = 6;

export const getEffectiveAnchors = (node) => {
  const manual = node?.layout?.anchors;
  if (manual) return manual;
  const l = getLayout(node);
  const anchors = {};
  if (l.x <= AUTO_ANCHOR_EDGE_EPS) anchors.left = Math.max(0, l.x);
  if (CANVAS_WIDTH - (l.x + l.w) <= AUTO_ANCHOR_EDGE_EPS) anchors.right = Math.max(0, CANVAS_WIDTH - (l.x + l.w));
  if (l.y <= AUTO_ANCHOR_EDGE_EPS) anchors.top = Math.max(0, l.y);
  if (CANVAS_HEIGHT - (l.y + l.h) <= AUTO_ANCHOR_EDGE_EPS) anchors.bottom = Math.max(0, CANVAS_HEIGHT - (l.y + l.h));
  return Object.keys(anchors).length ? anchors : null;
};

export const COMPONENT_TYPES = [
  {
    type: 'text', label: 'Text', icon: Type, isContainer: false, tier: 'free',
    defaultProps: { content: 'Text', size: 'md', weight: 'normal', align: 'left', color: '' },
  },
  {
    type: 'button', label: 'Button', icon: MousePointerClick, isContainer: false,
    actionTrigger: 'onClick', tier: 'free',
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
    type: 'toggle', label: 'Toggle', icon: ToggleLeft, isContainer: false,
    actionTrigger: 'onChange', tier: 'premium',
    defaultProps: { label: 'Toggle', variable: '' },
  },
  {
    type: 'list', label: 'List', icon: ListIcon, isContainer: false, tier: 'premium',
    // A row's tap runs the "when a row is tapped" hat in this node's own
    // `.blocks` workspace (appBuilderBlock/), with "This item"/"This item's
    // field"/"This item's position" blocks available inside it. No separate
    // premium gate needed — `list` itself is already a fully premium type.
    // item_image_template: optional, resolved the same way as item_template
    // (interpolate against {item}) — when set, each row also shows a small
    // image (e.g. {{item.image}}), for things like a card/product picture.
    // layout_mode/grid_columns: 'list' (default, single column, unchanged
    // behavior) or 'grid' — a real multi-column grid for things like a
    // trading-card collection, where the image is the dominant element per
    // cell instead of a small row thumbnail.
    defaultProps: { source_variable: '', item_template: '{{item}}', item_image_template: '', empty_text: 'No items yet.', layout_mode: 'list', grid_columns: 2 },
  },
  {
    type: 'checkbox', label: 'Checkbox', icon: CheckSquare, isContainer: false,
    actionTrigger: 'onChange', tier: 'free',
    defaultProps: { label: 'Checkbox', variable: '' },
  },
  {
    type: 'rating', label: 'Rating', icon: Star, isContainer: false,
    actionTrigger: 'onChange', tier: 'free',
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
    type: 'slider', label: 'Slider', icon: SlidersHorizontal, isContainer: false,
    actionTrigger: 'onChange', tier: 'premium',
    defaultProps: { variable: '', min: 0, max: 100, step: 1 },
  },
  {
    type: 'date', label: 'Date picker', icon: Calendar, isContainer: false,
    actionTrigger: 'onChange', tier: 'premium',
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
  {
    type: 'select', label: 'Dropdown', icon: ChevronDown, isContainer: false,
    actionTrigger: 'onChange', tier: 'free',
    defaultProps: { placeholder: 'Choose…', options: 'Option 1, Option 2, Option 3', variable: '' },
  },
  {
    type: 'search', label: 'Search bar', icon: Search, isContainer: false,
    actionTrigger: 'onChange', tier: 'free',
    defaultProps: { placeholder: 'Search…', variable: '' },
  },
  {
    type: 'radio', label: 'Radio group', icon: CircleDot, isContainer: false,
    actionTrigger: 'onChange', tier: 'premium',
    defaultProps: { options: 'Option 1, Option 2, Option 3', variable: '' },
  },
  {
    type: 'stepper', label: 'Stepper', icon: Plus, isContainer: false,
    actionTrigger: 'onChange', tier: 'free',
    defaultProps: { variable: '', min: 0, max: 100, step: 1 },
  },
  {
    // Reads a JSON array from a variable — the exact same shape the "Data"
    // blocks' "load all records into list" already produces (each item an
    // object with named fields), so a Data collection plots straight in.
    type: 'chart', label: 'Chart', icon: ChartBar, isContainer: false, tier: 'premium',
    defaultProps: { source_variable: '', label_field: 'label', value_field: 'value', color: '' },
  },
  {
    // `initials`/`url` both go through the same {{variable}} interpolation
    // as a Text's content — e.g. bind `initials` to a variable a block sets
    // from "current account username" (Accounts blocks) after login.
    type: 'avatar', label: 'Avatar', icon: CircleUserRound, isContainer: false,
    actionTrigger: 'onClick', tier: 'free',
    defaultProps: { url: '', initials: '', color: '' },
  },
  {
    // A plain OpenStreetMap embed (no API key, no new dependency) — lat/lon
    // support {{variable}} interpolation, so a block can drop a pin from a
    // Data record or the device's own location (see the "get latitude/
    // longitude" blocks).
    type: 'map', label: 'Map', icon: MapPin, isContainer: false, tier: 'premium',
    defaultProps: { latitude: '48.8566', longitude: '2.3522', zoom: 14 },
  },
  {
    // items: [{label, icon}] — what each tap actually does is authored as
    // blocks under this component's own "when a row is tapped" hat (same
    // mechanism as List), using the "This item" blocks to read which one
    // was tapped and navigate accordingly — not a fixed per-item screen
    // link, so the same block logic can e.g. also update a "selected tab"
    // variable to restyle the bar.
    type: 'bottomnav', label: 'Bottom nav bar', icon: PanelBottom, isContainer: false, tier: 'premium',
    defaultProps: { items: [{ label: 'Home', icon: 'home' }, { label: 'Profile', icon: 'user' }] },
  },
  {
    type: 'appbar', label: 'App bar', icon: PanelTop, isContainer: false,
    actionTrigger: 'onClick', tier: 'free',
    defaultProps: { title: 'Title', show_back: false },
  },
  {
    type: 'fab', label: 'Floating button', icon: CirclePlus, isContainer: false,
    actionTrigger: 'onClick', tier: 'premium',
    defaultProps: { icon: 'plus', color: '' },
  },
  {
    // Minimal, dependency-free formatting: **bold** and [text](url) links
    // only — not full Markdown. Parsed the same way in the live runtime and
    // the static export (see resolveRichText in both).
    type: 'richtext', label: 'Rich text', icon: Pilcrow, isContainer: false, tier: 'free',
    defaultProps: { content: 'Some **bold** text with a [link](https://vakargames.com).', align: 'left' },
  },
  {
    // Same source_variable/JSON-array convention as chart/list — pairs
    // naturally with a Data collection of {image, ...} records.
    type: 'carousel', label: 'Carousel', icon: Images, isContainer: false, tier: 'premium',
    defaultProps: { source_variable: '', image_field: 'image' },
  },
  {
    type: 'accordion', label: 'Accordion', icon: ChevronsUpDown, isContainer: false, tier: 'free',
    defaultProps: { title: 'Section title', content: 'Details go here.' },
  },
  {
    type: 'audio', label: 'Audio player', icon: Volume2, isContainer: false, tier: 'free',
    defaultProps: { url: '' },
  },
  {
    // Like Input's variable binding, but the value is a data: URL of
    // whatever file was picked (any type — Choose Photo, an existing
    // block, is the image-only equivalent of this as a block instead of a
    // draggable element).
    type: 'filepicker', label: 'File picker', icon: Paperclip, isContainer: false,
    actionTrigger: 'onChange', tier: 'premium',
    defaultProps: { label: 'Choose file', variable: '' },
  },
  {
    type: 'countdown', label: 'Countdown', icon: Timer, isContainer: false, tier: 'premium',
    defaultProps: { target_date: '', label: '' },
  },
  {
    type: 'badge', label: 'Badge', icon: Tag, isContainer: false, tier: 'free',
    defaultProps: { text: 'NEW', color: '' },
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
    // `blocks` (a single Blockly workspace holding this element's "when X"
    // hats — see appBuilderBlock/) starts undefined, not an empty
    // placeholder — nothing to migrate, nothing to run.
    layout: { ...DEFAULT_LAYOUT[type], ...(layoutOverride || {}) },
    ...(meta.isContainer ? { children: [] } : {}),
  };
}

// Basic imperative show/hide (free) is the `ab_set_visibility` block
// (frontend/src/appBuilderBlock/blocks.js). Declarative visibility (a
// component auto-hides based on a live condition, no button needed) is the
// Vakar+ perk — VISIBILITY_OPERATORS backs its condition builder, gated
// server-side alongside custom text sizing (see _check_component_tier in
// studio_apps.py).
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

// Target pickers for the "Update an element"/"Show or hide an element"
// blocks (frontend/src/appBuilderBlock/, AppBuilderBlockPanel.js) — walks
// one level into containers, matching the editor's own component-tree
// nesting limit (findComponent in AppBuilderEditor.js). Shared (not
// AppBuilderEditor.js-local) so the block panel's dynamic dropdown fields
// (fields.js) can be fed the same lists without a second implementation.
export function flattenUpdatableTargets(screen) {
  const out = [];
  const walk = (comp) => {
    if (UPDATABLE_TYPES.includes(comp.type)) {
      const prop = UPDATABLE_PROP[comp.type];
      const preview = String(comp.props?.[prop] || '').slice(0, 24) || '(empty)';
      out.push({ id: comp.id, label: `${COMPONENT_META[comp.type].label} — "${preview}"` });
    }
    if (comp.type === 'container') (comp.children || []).forEach(walk);
  };
  (screen?.components || []).forEach(walk);
  return out;
}

// Every component on the screen (any type) — unlike flattenUpdatableTargets
// above, not limited to text-bearing types.
export function flattenAllTargets(screen) {
  const out = [];
  const walk = (comp) => {
    const label = COMPONENT_META[comp.type]?.label || comp.type;
    const preview = comp.props?.content || comp.props?.label || comp.props?.placeholder || '';
    out.push({ id: comp.id, label: preview ? `${label} — "${String(preview).slice(0, 20)}"` : label });
    if (comp.type === 'container') (comp.children || []).forEach(walk);
  };
  (screen?.components || []).forEach(walk);
  return out;
}

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
// Device skins — purely cosmetic frame overlays for the design canvas and
// preview (notch/punch-hole shape + corner radius), so the canvas can look
// like a few well-known phone families instead of one neutral rectangle.
// Never affects layout math, the live runtime, or the static export — those
// intentionally render with no fake bezel (see the Preview modal comment in
// AppBuilderEditor.js).
// ============================================================
export const DEVICE_SKINS = [
  { id: 'neutral', label: 'Neutral', radius: 28, cutout: null },
  { id: 'iphone', label: 'iPhone-style', radius: 44, cutout: { type: 'pill', w: 90, h: 24, top: 14 } },
  { id: 'samsung', label: 'Samsung-style', radius: 30, cutout: { type: 'circle', d: 12, top: 12 } },
  { id: 'pixel', label: 'Pixel-style', radius: 34, cutout: { type: 'circle', d: 10, top: 16 } },
];
export const DEVICE_SKIN_MAP = Object.fromEntries(DEVICE_SKINS.map(s => [s.id, s]));
export const DEFAULT_DEVICE_SKIN_ID = 'neutral';
export const resolveDeviceSkin = (id) => DEVICE_SKIN_MAP[id] || DEVICE_SKIN_MAP[DEFAULT_DEVICE_SKIN_ID];

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
  'chevronDown', 'plus', 'minus',
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
  chevronDown: <polyline points="6 9 12 15 18 9" />,
  plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  minus: <line x1="5" y1="12" x2="19" y2="12" />,
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
  return { id, type, layout, props: animation ? { ...props, animation } : props };
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
