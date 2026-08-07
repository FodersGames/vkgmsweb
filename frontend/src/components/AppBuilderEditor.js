import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ArrowLeft, Plus, Trash2, Copy, Eye, Save, Globe, Lock,
  Check, X, ChevronRight, Palette, Download, Smartphone, Settings,
  Send, Clock, ThumbsDown, DollarSign, Package, Monitor, Undo2, Redo2,
  ShieldAlert, EyeOff, History, Zap,
} from 'lucide-react';
import QRCode from 'qrcode';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { useAuth } from '../context/AuthContext';
import {
  COMPONENT_TYPES, COMPONENT_META, genId, createComponent,
  THEME_PRESETS, ICON_IDS, AppIcon, getLayout, resolveTheme, CANVAS_WIDTH, CANVAS_HEIGHT,
  MIN_CUSTOM_TEXT_PX, MAX_CUSTOM_TEXT_PX,
  PREMIUM_PREVIEW_SCENES, ANIMATION_TYPES, VISIBILITY_OPERATORS,
  APP_TAGS, MIN_APP_TAGS, MAX_APP_TAGS, flattenUpdatableTargets, flattenAllTargets,
} from '../constants/appBuilder';
import AppRuntime, { ComponentVisual, PositionedNode } from './AppRuntime';
import { exportAppAsZip, generateAppZipBlob } from '../utils/exportApp';
import { ConfirmDialog } from './ConfirmDialog';
import { VersionHistoryModal } from './VersionHistoryModal';
import AppBuilderBlockPanel from './AppBuilderBlockPanel';
import { migrateToHatWorkspace, isV2Shape } from '../appBuilderBlock/legacyMigration';
import { setAbBlockContext } from '../appBuilderBlock/fields';
import { HAT_TYPES_BY_COMPONENT, SCREEN_HAT_TYPES, LEGACY_TRIGGER_TO_HAT, buildToolbox } from '../appBuilderBlock/blocks';

const API = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || '';
const MIN_SIZE = 24;
// Below this viewport width the builder's drag/resize canvas isn't usable —
// shown instead of the editor entirely (both the admin and public entry
// points render this same component, so gating here covers both).
const MOBILE_GUARD_MAX_WIDTH = 900;
// Mirrors backend/app/routers/studio_apps.py's FREE_MAX_SCREENS_PER_APP —
// client-side only for the "Add screen" upsell gate; the backend is the
// real enforcement (same cross-stack duplication tradeoff as `tier` tags).
const FREE_MAX_SCREENS = 15;
// Mirrors backend/app/routers/studio_apps.py's CREATOR_SHARE_PCT (60% to the
// creator) — used only for the "you keep X%" copy in the pricing field.
const PLATFORM_SHARE_PCT = 40;
const PACKAGE_ID_RE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
const SDK_LEVELS = [
  { v: 22, label: '22 — Android 5.1' }, { v: 23, label: '23 — Android 6.0' }, { v: 24, label: '24 — Android 7.0' },
  { v: 25, label: '25 — Android 7.1' }, { v: 26, label: '26 — Android 8.0' }, { v: 27, label: '27 — Android 8.1' },
  { v: 28, label: '28 — Android 9' }, { v: 29, label: '29 — Android 10' }, { v: 30, label: '30 — Android 11' },
  { v: 31, label: '31 — Android 12' }, { v: 32, label: '32 — Android 12L' }, { v: 33, label: '33 — Android 13' },
  { v: 34, label: '34 — Android 14' }, { v: 35, label: '35 — Android 15' }, { v: 36, label: '36 — Android 16' },
];

// Plays a PREMIUM_PREVIEW_SCENES entry on a loop inside the locked-feature
// popup — a tiny scripted mock (not a real interactive app, nothing here
// is clickable) that feeds a scene's `vars` into the exact same
// ComponentVisual/PositionedNode renderer used everywhere else, so a
// locked component/theme looks like it's actually being used instead of a
// frozen screenshot. Components with a `timeline` (toggle/slider) get
// their bound variable driven through scripted steps; every component also
// gets its entrance `props.animation` replayed each loop via a changing
// `key` (remounting restarts a CSS animation).
function PreviewPlayer({ scene, theme }) {
  const [vars, setVars] = useState(scene.vars || {});
  const [replayKey, setReplayKey] = useState(0);

  useEffect(() => {
    setVars(scene.vars || {});
    setReplayKey(k => k + 1);
    const timeline = scene.timeline;
    if (!timeline || !timeline.length) {
      const t = setInterval(() => setReplayKey(k => k + 1), 3000);
      return () => clearInterval(t);
    }
    const loopMs = Math.max(...timeline.map(s => s.atMs)) + 1200;
    let timeouts = [];
    const schedule = () => {
      timeouts = timeline.map(step => setTimeout(() => setVars(v => ({ ...v, ...step.vars })), step.atMs));
    };
    schedule();
    const loop = setInterval(() => {
      timeouts.forEach(clearTimeout);
      setVars(scene.vars || {});
      setReplayKey(k => k + 1);
      schedule();
    }, loopMs);
    return () => { timeouts.forEach(clearTimeout); clearInterval(loop); };
  }, [scene]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: theme.colors.background, overflow: 'hidden' }}>
      {scene.components.map((node, i) => (
        <PositionedNode key={`${node.id}-${replayKey}`} node={node} index={i} vars={vars} theme={theme} />
      ))}
    </div>
  );
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

// Auto-converts every element/screen still on an old data shape — a flat
// action-list array, or a pre-hat v1 Blockly workspace saved under the old
// per-type actions.onClick/onChange/props.item_action/screen.actions.onOpen
// fields — all the way to the current `{v: 2, blockly}` shape stored in a
// single `.blocks` field, wrapping each in the hat block it now needs (see
// legacyMigration.js's header comment for the full 3-step chain). Mutates
// `app` directly (freshly parsed JSON from load(), not shared/rendered yet)
// and returns any warnings for unmappable actions, surfaced via the banner
// rendered near the top of this component.
function migrateLegacyActions(app) {
  const warnings = [];
  const variableNames = (app.variables || []).map(v => v.name);
  const migrate = (oldValue, hatType, where) => {
    const { value, warnings: w } = migrateToHatWorkspace(oldValue, hatType, { variableNames });
    w.forEach(msg => warnings.push(`${where}: ${msg}`));
    return value;
  };
  for (const screen of app.screens || []) {
    // Target/screen dropdown fields (ab_update_text/ab_show_element's
    // TARGET, ab_navigate's SCREEN) validate against whatever
    // setAbBlockContext registry is live when a block's field is set — a
    // migrated action's target_id/screen_id must be a real option in that
    // registry or the field silently drops it. Populate it with this
    // screen's real component tree before migrating anything on it (same
    // scoping AppBuilderBlockPanel uses once the app is past migration).
    setAbBlockContext({
      components: flattenAllTargets(screen),
      updatableIds: new Set(flattenUpdatableTargets(screen).map(t => t.id)),
      screens: app.screens || [],
    });

    if (screen.actions?.onOpen && !isV2Shape(screen.blocks)) {
      screen.blocks = migrate(screen.actions.onOpen, 'ab_when_screen_opens', `${screen.name || 'Screen'} (when it opens)`);
    }
    delete screen.actions;

    const walk = (comp) => {
      if (!isV2Shape(comp.blocks)) {
        const label = COMPONENT_META[comp.type]?.label || comp.type;
        if (comp.type === 'list') {
          if (comp.props?.item_action) comp.blocks = migrate(comp.props.item_action, 'ab_when_row_tapped', `${screen.name || 'Screen'} → ${label}`);
        } else {
          const trigger = COMPONENT_META[comp.type]?.actionTrigger;
          const hatType = LEGACY_TRIGGER_TO_HAT[trigger];
          if (hatType && comp.actions?.[trigger]) comp.blocks = migrate(comp.actions[trigger], hatType, `${screen.name || 'Screen'} → ${label}`);
        }
      }
      delete comp.actions;
      if (comp.props) delete comp.props.item_action;
      if (comp.type === 'container') (comp.children || []).forEach(walk);
    };
    (screen.components || []).forEach(walk);
  }
  return warnings;
}

function findComponent(screen, id) {
  for (const c of screen.components) {
    if (c.id === id) return { node: c, containerId: null };
    if (c.type === 'container') {
      const child = (c.children || []).find(ch => ch.id === id);
      if (child) return { node: child, containerId: c.id };
    }
  }
  return null;
}

// ============================================================
// Design canvas — a true WYSIWYG, MIT-App-Inventor-style phone-shaped
// surface: components render via ComponentVisual (the exact same renderer
// the real app uses) positioned absolutely per their `layout`, and can be
// dragged/resized directly with the mouse. No list, no reordering by
// index — position is the only order that matters now.
// ============================================================
function resizeHandleStyle(corner) {
  const base = { position: 'absolute', width: 10, height: 10, background: '#4ECDC4', border: '2px solid white', borderRadius: '50%', zIndex: 5 };
  const pos = {
    nw: { top: -5, left: -5, cursor: 'nwse-resize' },
    ne: { top: -5, right: -5, cursor: 'nesw-resize' },
    sw: { bottom: -5, left: -5, cursor: 'nesw-resize' },
    se: { bottom: -5, right: -5, cursor: 'nwse-resize' },
  };
  return { ...base, ...pos[corner] };
}

function ContainerChrome({ node, theme, children }) {
  const bg = node.props?.background === 'surface' ? theme.colors.surface
    : (node.props?.background && node.props.background !== 'none' ? node.props.background : 'transparent');
  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%', background: bg,
      border: node.props?.border ? `1px solid ${theme.colors.border}` : '1px dashed #C7C7CC',
      borderRadius: node.props?.radius ?? 0,
      boxShadow: node.props?.shadow ? '0 10px 30px -12px rgba(0,0,0,0.18)' : 'none',
      // Editor-only wrapper (the shipped app's own container rendering is
      // AppRuntime.js's separate code) — 'visible' so a child's own resize
      // handles stay grabbable when the child sits flush against an edge,
      // instead of being clipped off along with anything that overflows.
      boxSizing: 'border-box', overflow: 'visible',
    }}>
      {children}
    </div>
  );
}

function EditableBox({ node, index = 0, theme, selectedId, onSelect, onChangeLayout, onDelete, bounds }) {
  const layout = getLayout(node, index);
  const selected = selectedId === node.id;
  const isContainer = node.type === 'container';

  const startDrag = (e) => {
    e.stopPropagation();
    onSelect(node.id);
    const startX = e.clientX, startY = e.clientY;
    const orig = { ...layout };
    const maxX = Math.max(0, bounds.w - orig.w), maxY = Math.max(0, bounds.h - orig.h);
    const onMove = (ev) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      onChangeLayout(node.id, {
        ...orig,
        x: Math.min(maxX, Math.max(0, orig.x + dx)),
        y: Math.min(maxY, Math.max(0, orig.y + dy)),
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startResize = (e, corner) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(node.id);
    const startX = e.clientX, startY = e.clientY;
    const orig = { ...layout };
    const onMove = (ev) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      let { x, y, w, h } = orig;
      if (corner.includes('e')) w = Math.min(bounds.w - orig.x, Math.max(MIN_SIZE, orig.w + dx));
      if (corner.includes('s')) h = Math.min(bounds.h - orig.y, Math.max(MIN_SIZE, orig.h + dy));
      if (corner.includes('w')) { w = Math.max(MIN_SIZE, Math.min(orig.x + orig.w, orig.w - dx)); x = orig.x + (orig.w - w); }
      if (corner.includes('n')) { h = Math.max(MIN_SIZE, Math.min(orig.y + orig.h, orig.h - dy)); y = orig.y + (orig.h - h); }
      onChangeLayout(node.id, { x, y, w, h });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      onMouseDown={startDrag}
      style={{
        position: 'absolute', left: layout.x, top: layout.y, width: layout.w, height: layout.h,
        cursor: 'move', outline: selected ? '2px solid #4ECDC4' : '1px dashed transparent', outlineOffset: 1,
      }}
    >
      <div style={{ width: '100%', height: '100%', pointerEvents: isContainer ? 'auto' : 'none' }}>
        {isContainer ? (
          <ContainerChrome node={node} theme={theme}>
            {(node.children || []).map((child, i) => (
              <EditableBox key={child.id} node={child} index={i} theme={theme} selectedId={selectedId} onSelect={onSelect} onChangeLayout={onChangeLayout} onDelete={onDelete} bounds={{ w: layout.w, h: layout.h }} />
            ))}
          </ContainerChrome>
        ) : (
          <ComponentVisual node={node} theme={theme} />
        )}
      </div>
      {selected && (
        <>
          {['nw', 'ne', 'sw', 'se'].map(corner => (
            <div key={corner} onMouseDown={(e) => startResize(e, corner)} style={resizeHandleStyle(corner)} />
          ))}
          {/* Top-center, not a corner — every corner already hosts a resize
              handle, and this used to sit on top of the NE one, swallowing
              its clicks (grabbing that corner deleted the component instead
              of resizing it). */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
            style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', width: 18, height: 18, borderRadius: '50%', background: '#EF4444', color: '#fff', border: '2px solid white', fontSize: 11, lineHeight: '14px', cursor: 'pointer', zIndex: 6 }}
          >
            ×
          </button>
        </>
      )}
    </div>
  );
}

function DesignCanvas({ screen, theme, selectedId, onSelect, onChangeLayout, onDelete, onDropComponent, dragOver, onDragOverChange }) {
  return (
    <div
      onMouseDown={() => onSelect(null)}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('application/x-vakar-component')) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        if (!dragOver) onDragOverChange?.(true);
      }}
      onDragLeave={() => onDragOverChange?.(false)}
      onDrop={(e) => {
        const type = e.dataTransfer.getData('application/x-vakar-component');
        onDragOverChange?.(false);
        if (!type) return;
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        onDropComponent?.(type, { x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      style={{
        position: 'relative', width: CANVAS_WIDTH, height: CANVAS_HEIGHT, background: theme.colors.background, overflow: 'hidden',
        outline: dragOver ? '2px dashed #4ECDC4' : 'none', outlineOffset: -2,
      }}
    >
      {(screen.components || []).map((node, i) => (
        <EditableBox key={node.id} node={node} index={i} theme={theme} selectedId={selectedId} onSelect={onSelect} onChangeLayout={onChangeLayout} onDelete={onDelete} bounds={{ w: CANVAS_WIDTH, h: CANVAS_HEIGHT }} />
      ))}
      {(screen.components || []).length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: theme.colors.textMuted, textAlign: 'center', padding: 24, pointerEvents: 'none' }}>
          Empty screen — drag a component from the palette, or click one to add it.
        </div>
      )}
    </div>
  );
}

// ============================================================
// Inspector — props editor for the selected component, action editor for
// components that support one (buttons), or screen/variables settings
// when nothing is selected.
// ============================================================
const FIELD_LABEL = 'block text-[10px] font-semibold text-[#6E6E73] dark:text-[#a1a1aa] uppercase tracking-wider mb-1.5';
const FIELD_INPUT = 'w-full rounded-lg px-3 py-2 bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#e4e4e7] text-sm focus:outline-none focus:border-[#4ECDC4]';

function PropsEditor({ node, onChange, allowPremium, onUploadImage, onPremiumBlocked, screens, screen, onEditItemAction }) {
  const set = (key, value) => onChange(n => { n.props[key] = value; });
  const [imgUploading, setImgUploading] = useState(false);
  const imgInputRef = useRef(null);

  switch (node.type) {
    case 'text':
      return (
        <div className="space-y-3">
          <div>
            <label className={FIELD_LABEL}>Content</label>
            <textarea rows={3} value={node.props.content || ''} onChange={e => set('content', e.target.value)} className={`${FIELD_INPUT} resize-none`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={FIELD_LABEL}>Size</label>
              <Select
                value={node.props.size || 'md'}
                onChange={e => {
                  if (e.target.value === 'custom' && !allowPremium) { onPremiumBlocked?.('Custom text size requires Vakar+.'); return; }
                  set('size', e.target.value);
                }}
                size="sm"
              >
                {['sm', 'md', 'lg', 'xl'].map(s => <option key={s} value={s}>{s}</option>)}
                <option value="custom">{allowPremium ? 'Custom…' : 'Custom… (Vakar+)'}</option>
              </Select>
            </div>
            <div>
              <label className={FIELD_LABEL}>Weight</label>
              <Select value={node.props.weight || 'normal'} onChange={e => set('weight', e.target.value)} size="sm">
                <option value="normal">Normal</option>
                <option value="bold">Bold</option>
              </Select>
            </div>
            <div>
              <label className={FIELD_LABEL}>Align</label>
              <Select value={node.props.align || 'left'} onChange={e => set('align', e.target.value)} size="sm">
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </Select>
            </div>
            <div>
              <label className={FIELD_LABEL}>Color</label>
              <input type="color" value={node.props.color || '#1D1D1F'} onChange={e => set('color', e.target.value)} className="w-full h-9 rounded-lg border border-[#D2D2D7] dark:border-[#2a2a3c] bg-white dark:bg-[#151520]" />
            </div>
          </div>
          {node.props.size === 'custom' && allowPremium && (
            <div>
              <label className={FIELD_LABEL}>Exact size (px)</label>
              <input
                type="number" min={MIN_CUSTOM_TEXT_PX} max={MAX_CUSTOM_TEXT_PX}
                value={node.props.size_px ?? 15}
                onChange={e => set('size_px', Math.max(MIN_CUSTOM_TEXT_PX, Math.min(MAX_CUSTOM_TEXT_PX, Number(e.target.value) || MIN_CUSTOM_TEXT_PX)))}
                className={FIELD_INPUT}
              />
            </div>
          )}
        </div>
      );
    case 'button':
      return (
        <div className="space-y-3">
          <div>
            <label className={FIELD_LABEL}>Label</label>
            <input value={node.props.label || ''} onChange={e => set('label', e.target.value)} className={FIELD_INPUT} />
          </div>
          <div>
            <label className={FIELD_LABEL}>Style</label>
            <Select value={node.props.style || 'primary'} onChange={e => set('style', e.target.value)} size="sm">
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
              <option value="outline">Outline</option>
            </Select>
          </div>
          <div>
            <label className={FIELD_LABEL}>Icon (optional)</label>
            <div className="grid grid-cols-5 gap-1.5">
              <button
                onClick={() => set('icon', '')}
                className={`py-2 rounded-lg border text-[10px] font-semibold transition-colors ${!node.props.icon ? 'border-[#4ECDC4] bg-[#4ECDC4]/10 text-[#4ECDC4]' : 'border-[#D2D2D7] dark:border-[#2a2a3c] text-[#6E6E73] dark:text-[#a1a1aa] hover:border-[#BFBFC4]'}`}
              >
                None
              </button>
              {ICON_IDS.map(id => (
                <button
                  key={id} onClick={() => set('icon', id)}
                  className={`flex items-center justify-center py-2 rounded-lg border transition-colors ${node.props.icon === id ? 'border-[#4ECDC4] bg-[#4ECDC4]/10 text-[#4ECDC4]' : 'border-[#D2D2D7] dark:border-[#2a2a3c] text-[#6E6E73] dark:text-[#a1a1aa] hover:border-[#BFBFC4]'}`}
                >
                  <AppIcon id={id} size={14} color="currentColor" />
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    case 'image':
      return (
        <div className="space-y-3">
          <div>
            <label className={FIELD_LABEL}>Image URL</label>
            <input value={node.props.url || ''} onChange={e => set('url', e.target.value)} placeholder="https://… or upload below" className={FIELD_INPUT} />
          </div>
          {onUploadImage && (
            <div>
              <button
                type="button" onClick={() => imgInputRef.current?.click()} disabled={imgUploading}
                className="text-xs font-semibold text-[#4ECDC4] hover:underline disabled:opacity-50"
              >
                {imgUploading ? 'Uploading…' : 'Upload an image'}
              </button>
              <input
                ref={imgInputRef} type="file" accept=".jpg,.jpeg,.png,.gif,.webp" className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setImgUploading(true);
                  try {
                    const url = await onUploadImage(file);
                    if (url) set('url', url);
                  } finally {
                    setImgUploading(false);
                  }
                }}
              />
              <p className="mt-1 text-[10px] text-[#A1A1A6]">Counts toward your app's storage quota.</p>
            </div>
          )}
          <div>
            <label className={FIELD_LABEL}>Corner radius</label>
            <input type="number" min="0" value={node.props.radius ?? 12} onChange={e => set('radius', Number(e.target.value))} className={FIELD_INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={FIELD_LABEL}>Fit</label>
              <Select value={node.props.fit || 'cover'} onChange={e => set('fit', e.target.value)} size="sm">
                <option value="cover">Cover (crop to fill)</option>
                <option value="contain">Contain (show whole image)</option>
              </Select>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-[#6E6E73] dark:text-[#a1a1aa] cursor-pointer self-end pb-2">
              <input type="checkbox" checked={!!node.props.border} onChange={e => set('border', e.target.checked)} />Border
            </label>
          </div>
        </div>
      );
    case 'input':
      return (
        <div className="space-y-3">
          <div>
            <label className={FIELD_LABEL}>Placeholder</label>
            <input value={node.props.placeholder || ''} onChange={e => set('placeholder', e.target.value)} className={FIELD_INPUT} />
          </div>
          <div>
            <label className={FIELD_LABEL}>Bound variable</label>
            <input value={node.props.variable || ''} onChange={e => set('variable', e.target.value)} placeholder="e.g. userName" className={FIELD_INPUT} />
            <p className="mt-1 text-[10px] text-[#A1A1A6]">What the visitor types is stored in this variable — usable in {'{{variable}}'} text or an "Update an element" action.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={FIELD_LABEL}>Type</label>
              <Select value={node.props.input_type || 'text'} onChange={e => set('input_type', e.target.value)} size="sm">
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="multiline">Multi-line</option>
              </Select>
            </div>
            <div>
              <label className={FIELD_LABEL}>Max length</label>
              <input
                type="number" min="0" value={node.props.max_length ?? ''}
                onChange={e => set('max_length', e.target.value ? Math.max(1, Number(e.target.value)) : null)}
                placeholder="No limit" className={FIELD_INPUT}
              />
            </div>
          </div>
        </div>
      );
    case 'container':
      return (
        <div className="space-y-3">
          <p className="text-[10px] text-[#A1A1A6]">While this group is selected, components added from the palette go inside it — drag and resize them freely within its bounds.</p>
          <div>
            <label className={FIELD_LABEL}>Corner radius</label>
            <input type="number" min="0" value={node.props.radius ?? 0} onChange={e => set('radius', Number(e.target.value))} className={FIELD_INPUT} />
          </div>
          <div>
            <label className={FIELD_LABEL}>Background</label>
            <Select value={node.props.background || 'none'} onChange={e => set('background', e.target.value)} size="sm">
              <option value="none">Transparent</option>
              <option value="surface">Theme surface</option>
            </Select>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs text-[#6E6E73] dark:text-[#a1a1aa] cursor-pointer">
              <input type="checkbox" checked={!!node.props.border} onChange={e => set('border', e.target.checked)} />Border
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[#6E6E73] dark:text-[#a1a1aa] cursor-pointer">
              <input type="checkbox" checked={!!node.props.shadow} onChange={e => set('shadow', e.target.checked)} />Shadow
            </label>
          </div>
          <div>
            <label className={FIELD_LABEL}>Opacity ({node.props.opacity ?? 100}%)</label>
            <input type="range" min="0" max="100" value={node.props.opacity ?? 100} onChange={e => set('opacity', Number(e.target.value))} className="w-full" />
          </div>
        </div>
      );
    case 'toggle':
      return (
        <div className="space-y-3">
          <div>
            <label className={FIELD_LABEL}>Label</label>
            <input value={node.props.label || ''} onChange={e => set('label', e.target.value)} className={FIELD_INPUT} />
          </div>
          <div>
            <label className={FIELD_LABEL}>Bound variable</label>
            <input value={node.props.variable || ''} onChange={e => set('variable', e.target.value)} placeholder="e.g. notificationsOn" className={FIELD_INPUT} />
            <p className="mt-1 text-[10px] text-[#A1A1A6]">Stores "true" or "false" — usable with a "Set a variable" action's toggle mode too.</p>
          </div>
        </div>
      );
    case 'icon':
      return (
        <div className="space-y-3">
          <div>
            <label className={FIELD_LABEL}>Icon</label>
            <div className="grid grid-cols-4 gap-1.5">
              {ICON_IDS.map(id => (
                <button
                  key={id} onClick={() => set('icon', id)}
                  className={`flex items-center justify-center py-2 rounded-lg border transition-colors ${node.props.icon === id ? 'border-[#4ECDC4] bg-[#4ECDC4]/10 text-[#4ECDC4]' : 'border-[#D2D2D7] dark:border-[#2a2a3c] text-[#6E6E73] dark:text-[#a1a1aa] hover:border-[#BFBFC4]'}`}
                >
                  <AppIcon id={id} size={16} color="currentColor" />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={FIELD_LABEL}>Color</label>
            <input type="color" value={node.props.color || '#1D1D1F'} onChange={e => set('color', e.target.value)} className="w-full h-9 rounded-lg border border-[#D2D2D7] dark:border-[#2a2a3c] bg-white dark:bg-[#151520]" />
          </div>
        </div>
      );
    case 'list': {
      return (
        <div className="space-y-3">
          <div>
            <label className={FIELD_LABEL}>Source variable</label>
            <input value={node.props.source_variable || ''} onChange={e => set('source_variable', e.target.value)} placeholder="e.g. apiResult" className={FIELD_INPUT} />
            <p className="mt-1 text-[10px] text-[#A1A1A6]">Expects a JSON array in this variable — set it from a "Set a variable" action, or bind it to an Input.</p>
          </div>
          <div>
            <label className={FIELD_LABEL}>Item template</label>
            <input value={node.props.item_template || ''} onChange={e => set('item_template', e.target.value)} placeholder="{{item.name}} — {{item.status}}" className={FIELD_INPUT} />
            <p className="mt-1 text-[10px] text-[#A1A1A6]">Use {'{{item}}'} for a simple value, or {'{{item.field}}'} if each entry is an object.</p>
          </div>
          <div>
            <label className={FIELD_LABEL}>Item image (optional)</label>
            <input value={node.props.item_image_template || ''} onChange={e => set('item_image_template', e.target.value)} placeholder="{{item.image}}" className={FIELD_INPUT} />
            <p className="mt-1 text-[10px] text-[#A1A1A6]">If each entry is an object with an image URL field, show it as a picture next to (or as) each item.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 items-end">
            <div>
              <label className={FIELD_LABEL}>Layout</label>
              <Select value={node.props.layout_mode || 'list'} onChange={e => set('layout_mode', e.target.value)} size="sm">
                <option value="list">List (rows)</option>
                <option value="grid">Grid (cards)</option>
              </Select>
            </div>
            {node.props.layout_mode === 'grid' && (
              <div>
                <label className={FIELD_LABEL}>Columns</label>
                <input
                  type="number" min="1" max="4" value={node.props.grid_columns ?? 2}
                  onChange={e => set('grid_columns', Math.max(1, Math.min(4, Number(e.target.value) || 2)))}
                  className={FIELD_INPUT}
                />
              </div>
            )}
          </div>
          {node.props.layout_mode === 'grid' && (
            <p className="text-[10px] text-[#A1A1A6] -mt-1">Grid mode makes the image the main element per cell — great for a card/photo collection.</p>
          )}
          <div>
            <label className={FIELD_LABEL}>Empty state text</label>
            <input value={node.props.empty_text || ''} onChange={e => set('empty_text', e.target.value)} className={FIELD_INPUT} />
          </div>
          <div className="pt-3 border-t border-[#D2D2D7] dark:border-[#2a2a3c]">
            <label className={FIELD_LABEL}>When a row is tapped</label>
            <button
              type="button" onClick={onEditItemAction}
              className="w-full flex items-center justify-between gap-2 rounded-lg border border-[#D2D2D7] dark:border-[#2a2a3c] px-3 py-2.5 text-xs font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] hover:border-[#4ECDC4] hover:text-[#4ECDC4] transition-colors"
            >
              Edit tap action
              <ChevronRight size={14} />
            </button>
            <p className="mt-2 text-[10px] text-[#A1A1A6]">Opens the full block editor — use the "This item" blocks for the tapped row's value, field, or position.</p>
          </div>
        </div>
      );
    }
    case 'spacer':
      return <p className="text-xs text-[#A1A1A6]">Resize this on the canvas to change how much space it takes up.</p>;
    case 'divider':
      return <p className="text-xs text-[#A1A1A6]">Resize this on the canvas — width and thickness both follow its box.</p>;
    case 'checkbox':
      return (
        <div className="space-y-3">
          <div>
            <label className={FIELD_LABEL}>Label</label>
            <input value={node.props.label || ''} onChange={e => set('label', e.target.value)} className={FIELD_INPUT} />
          </div>
          <div>
            <label className={FIELD_LABEL}>Bound variable</label>
            <input value={node.props.variable || ''} onChange={e => set('variable', e.target.value)} placeholder="e.g. agreedToTerms" className={FIELD_INPUT} />
            <p className="mt-1 text-[10px] text-[#A1A1A6]">Stores "true" or "false".</p>
          </div>
        </div>
      );
    case 'rating':
      return (
        <div className="space-y-3">
          <div>
            <label className={FIELD_LABEL}>Bound variable</label>
            <input value={node.props.variable || ''} onChange={e => set('variable', e.target.value)} placeholder="e.g. userRating" className={FIELD_INPUT} />
            <p className="mt-1 text-[10px] text-[#A1A1A6]">Stores the selected number (1–max) as text.</p>
          </div>
          <div>
            <label className={FIELD_LABEL}>Max stars</label>
            <input type="number" min="1" max="10" value={node.props.max ?? 5} onChange={e => set('max', Math.max(1, Math.min(10, Number(e.target.value) || 5)))} className={FIELD_INPUT} />
          </div>
          <div>
            <label className={FIELD_LABEL}>Color</label>
            <input type="color" value={node.props.color || '#4ECDC4'} onChange={e => set('color', e.target.value)} className="w-full h-9 rounded-lg border border-[#D2D2D7] dark:border-[#2a2a3c] bg-white dark:bg-[#151520]" />
          </div>
        </div>
      );
    case 'progress':
      return (
        <div className="space-y-3">
          <div>
            <label className={FIELD_LABEL}>Bound variable (optional)</label>
            <input value={node.props.variable || ''} onChange={e => set('variable', e.target.value)} placeholder="e.g. uploadPercent" className={FIELD_INPUT} />
            <p className="mt-1 text-[10px] text-[#A1A1A6]">A number 0–100. Leave empty to use a fixed value instead.</p>
          </div>
          {!node.props.variable && (
            <div>
              <label className={FIELD_LABEL}>Value ({node.props.value ?? 50}%)</label>
              <input type="range" min="0" max="100" value={node.props.value ?? 50} onChange={e => set('value', Number(e.target.value))} className="w-full" />
            </div>
          )}
        </div>
      );
    case 'qr':
      return (
        <div className="space-y-3">
          <div>
            <label className={FIELD_LABEL}>Content</label>
            <input value={node.props.content || ''} onChange={e => set('content', e.target.value)} placeholder="https://…" className={FIELD_INPUT} />
            <p className="mt-1 text-[10px] text-[#A1A1A6]">Can include a variable's value, e.g. {'{{profileUrl}}'} — note the exported/APK version bakes in a one-time snapshot, it won't update live.</p>
          </div>
        </div>
      );
    case 'slider':
      return (
        <div className="space-y-3">
          <div>
            <label className={FIELD_LABEL}>Bound variable</label>
            <input value={node.props.variable || ''} onChange={e => set('variable', e.target.value)} placeholder="e.g. volume" className={FIELD_INPUT} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={FIELD_LABEL}>Min</label>
              <input type="number" value={node.props.min ?? 0} onChange={e => set('min', Number(e.target.value))} className={FIELD_INPUT} />
            </div>
            <div>
              <label className={FIELD_LABEL}>Max</label>
              <input type="number" value={node.props.max ?? 100} onChange={e => set('max', Number(e.target.value))} className={FIELD_INPUT} />
            </div>
            <div>
              <label className={FIELD_LABEL}>Step</label>
              <input type="number" value={node.props.step ?? 1} onChange={e => set('step', Number(e.target.value))} className={FIELD_INPUT} />
            </div>
          </div>
        </div>
      );
    case 'date':
      return (
        <div>
          <label className={FIELD_LABEL}>Bound variable</label>
          <input value={node.props.variable || ''} onChange={e => set('variable', e.target.value)} placeholder="e.g. birthDate" className={FIELD_INPUT} />
          <p className="mt-1 text-[10px] text-[#A1A1A6]">Stores a date as YYYY-MM-DD text.</p>
        </div>
      );
    case 'video':
      return (
        <div>
          <label className={FIELD_LABEL}>Video URL</label>
          <input value={node.props.url || ''} onChange={e => set('url', e.target.value)} placeholder="https://…mp4" className={FIELD_INPUT} />
        </div>
      );
    case 'webview':
      return (
        <div>
          <label className={FIELD_LABEL}>URL to embed</label>
          <input value={node.props.url || ''} onChange={e => set('url', e.target.value)} placeholder="https://…" className={FIELD_INPUT} />
        </div>
      );
    default:
      return null;
  }
}

// Components a button click can push a value into — text content, or a
// button/toggle's own label. Flattened one level deep (screen top level +
// container children), matching the builder's max-one-nesting-level model.
// Same label convention as flattenAllTargets above (so a row here reads
// identically to how it'd show up in a set_visibility/update_text target
// picker), plus indentation depth for the Layers panel — the only way to
// select a component other than clicking it directly on the canvas, which
// doesn't scale once a screen has many components or some are hidden
// behind visible_if/set_visibility.
function buildLayerRows(screen) {
  const out = [];
  const walk = (comp, depth) => {
    const meta = COMPONENT_META[comp.type];
    const preview = comp.props?.content || comp.props?.label || comp.props?.placeholder || '';
    out.push({
      id: comp.id, depth, icon: meta?.icon,
      text: preview ? `${meta?.label || comp.type} — "${String(preview).slice(0, 18)}"` : (meta?.label || comp.type),
    });
    if (comp.type === 'container') (comp.children || []).forEach(child => walk(child, depth + 1));
  };
  (screen?.components || []).forEach(comp => walk(comp, 0));
  return out;
}

// Some toggles/checkboxes/sliders don't need an onChange action at all —
// their real effect is a declarative `visible_if` on OTHER components
// reacting to the same bound variable (e.g. a "Hide completed" toggle).
// That's invisible from the toggle's own Inspector otherwise, which reads
// as "this does nothing" even though it clearly does something in the
// running app — this surfaces the connection instead of hiding it.
function findVisibilityDependents(screen, variable) {
  if (!variable) return [];
  const out = [];
  const walk = (comp) => {
    if (comp.visible_if?.variable === variable) {
      const meta = COMPONENT_META[comp.type];
      const preview = comp.props?.content || comp.props?.label || comp.props?.placeholder || '';
      out.push(preview ? `${meta?.label || comp.type} — "${String(preview).slice(0, 18)}"` : (meta?.label || comp.type));
    }
    if (comp.type === 'container') (comp.children || []).forEach(walk);
  };
  (screen?.components || []).forEach(walk);
  return out;
}

// Shared across every component type (not type-specific like PropsEditor) —
// entrance animation and conditional visibility apply to any component.
function ComponentExtras({ node, onChange, allowPremium, onPremiumBlocked }) {
  const setProp = (key, value) => onChange(n => { n.props[key] = value; });
  const hasCondition = !!node.visible_if?.variable;
  const setCondition = (patch) => onChange(n => {
    n.visible_if = { ...(n.visible_if || { variable: '', op: 'eq', value: '' }), ...patch };
  });

  return (
    <div className="mt-4 pt-4 border-t border-[#D2D2D7] dark:border-[#2a2a3c] space-y-4">
      <div>
        <label className={FIELD_LABEL}>Entrance animation</label>
        <Select
          value={node.props?.animation || 'none'}
          onChange={e => {
            const anim = ANIMATION_TYPES.find(a => a.id === e.target.value);
            if (anim?.tier === 'premium' && !allowPremium) { onPremiumBlocked?.(`"${anim.label}" requires Vakar+.`); return; }
            setProp('animation', e.target.value);
          }}
          size="sm"
        >
          {ANIMATION_TYPES.map(a => (
            <option key={a.id} value={a.id}>{a.tier === 'premium' && !allowPremium ? `${a.label} (Vakar+)` : a.label}</option>
          ))}
        </Select>
      </div>
      <div>
        <label className="flex items-center gap-2 text-xs text-[#6E6E73] dark:text-[#a1a1aa] cursor-pointer mb-2">
          <input
            type="checkbox" checked={hasCondition}
            onChange={e => {
              if (e.target.checked) {
                if (!allowPremium) { onPremiumBlocked?.('Conditional visibility requires Vakar+.'); return; }
                setCondition({});
              } else {
                onChange(n => { delete n.visible_if; });
              }
            }}
          />
          Only show when a condition is met {!allowPremium && <span className="text-[#A1A1A6]">(Vakar+)</span>}
        </label>
        {hasCondition && (
          <div className="grid grid-cols-3 gap-2">
            <input value={node.visible_if.variable || ''} onChange={e => setCondition({ variable: e.target.value })} placeholder="variable" className={FIELD_INPUT} />
            <Select value={node.visible_if.op || 'eq'} onChange={e => setCondition({ op: e.target.value })} size="sm">
              {VISIBILITY_OPERATORS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </Select>
            {node.visible_if.op !== 'truthy' && (
              <input value={node.visible_if.value ?? ''} onChange={e => setCondition({ value: e.target.value })} placeholder="value" className={FIELD_INPUT} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main editor
// ============================================================
export default function AppBuilderEditor({ appId, onBack, apiBase = '/api/admin/studio-apps', allowPremium = true, quota = null, enableApkBuild = false }) {
  const { token } = useAuth();
  const [isNarrowViewport, setIsNarrowViewport] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= MOBILE_GUARD_MAX_WIDTH
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_GUARD_MAX_WIDTH}px)`);
    const onChange = (e) => setIsNarrowViewport(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [migrationWarnings, setMigrationWarnings] = useState([]);
  const [activeScreenId, setActiveScreenId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  // { nodeId, isScreen? } when the full-screen block editor is open for that
  // element's or screen's single `.blocks` workspace — null means the
  // normal Designer view (palette/canvas/inspector). Replaces the old
  // cramped in-sidebar Blockly panel with a real MIT-App-Inventor-style
  // full-page Blocks mode.
  const [blocksTarget, setBlocksTarget] = useState(null);
  const [dirty, setDirty] = useState(false);
  // Undo/redo — a plain stack of whole-app snapshots, capped at 50. mutate()
  // already structuredClone()s the app on every change, so this just keeps
  // one extra clone per step rather than needing any diffing/patching.
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingFile, setExportingFile] = useState(false);
  const [apkBuild, setApkBuild] = useState(null);
  const [apkBusy, setApkBusy] = useState(false);
  const [apkQrOpen, setApkQrOpen] = useState(false);
  const [apkQrDataUrl, setApkQrDataUrl] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [iconUploading, setIconUploading] = useState(false);
  const iconInputRef = useRef(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  // { kind: 'theme', theme } | { kind: 'component', meta } | null — shows a
  // pre-built demo screen instead of just a "requires Vakar+" text message
  // when a locked theme/component is clicked.
  const [previewFeature, setPreviewFeature] = useState(null);
  const [reviewForm, setReviewForm] = useState({ name: '', description: '', tags: [], logo_url: '', banner_url: '', price_cents: 0, changelog: '' });
  const [charterAccepted, setCharterAccepted] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewLogoUploading, setReviewLogoUploading] = useState(false);
  const [reviewBannerUploading, setReviewBannerUploading] = useState(false);
  const reviewLogoInputRef = useRef(null);
  // "Remove from Applications" — a real, consequential action (may have
  // installs/sales), so it gets a reason field AND a type-to-confirm input
  // instead of the single-click ConfirmDialog used everywhere else.
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawConfirmName, setWithdrawConfirmName] = useState('');
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [republishConfirmOpen, setRepublishConfirmOpen] = useState(false);
  const [republishSubmitting, setRepublishSubmitting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [quotaBannerDismissed, setQuotaBannerDismissed] = useState(false);
  const [canvasDragOver, setCanvasDragOver] = useState(false);
  const [exportHubOpen, setExportHubOpen] = useState(false);
  const [publishHubOpen, setPublishHubOpen] = useState(false);
  const reviewBannerInputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}${apiBase}/${appId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      setMigrationWarnings(migrateLegacyActions(data));
      setApp(data);
      setActiveScreenId(data.screens?.[0]?.id || null);
    } finally {
      setLoading(false);
    }
  }, [appId, token, apiBase]);

  useEffect(() => { load(); }, [load]);

  const mutate = (fn) => {
    setHistory(h => [...h.slice(-49), app]);
    setFuture([]);
    setApp(a => { const clone = structuredClone(a); fn(clone); return clone; });
    setDirty(true);
  };

  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setFuture(f => [app, ...f].slice(0, 50));
    setApp(prev);
    setDirty(true);
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture(f => f.slice(1));
    setHistory(h => [...h, app].slice(-50));
    setApp(next);
    setDirty(true);
  };

  // App-scoped upload (icon, or an image component's picture) — counts
  // toward the app's storage quota (20MB free / 1GB Vakar+), unlike the
  // site-wide /api/upload endpoint. Staff/house apps (apiBase points at
  // /admin/studio-apps) aren't quota'd, same as everywhere else in this file.
  const uploadAsset = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const r = await fetch(`${API}${apiBase}/${appId}/asset`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || 'Upload failed.');
    return data.url;
  };

  const uploadImageAsset = async (file) => {
    try {
      return await uploadAsset(file);
    } catch (e) {
      setSaveError(e.message);
      return null;
    }
  };

  const handleIconUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIconUploading(true);
    try {
      const url = await uploadAsset(file);
      mutate(a => { a.app_icon_url = url; });
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setIconUploading(false);
      e.target.value = '';
    }
  };

  const activeScreen = app?.screens.find(s => s.id === activeScreenId);

  useEffect(() => { setSelectedId(null); }, [activeScreenId]);

  const addScreen = () => {
    const id = genId();
    mutate(a => { a.screens.push({ id, name: `Screen ${a.screens.length + 1}`, components: [] }); });
    setActiveScreenId(id);
  };
  const renameScreen = (id, name) => mutate(a => { const s = a.screens.find(s => s.id === id); if (s) s.name = name; });
  const deleteScreen = (id) => {
    if (app.screens.length <= 1) return;
    const remaining = app.screens.filter(s => s.id !== id);
    mutate(a => { a.screens = a.screens.filter(s => s.id !== id); });
    if (activeScreenId === id) setActiveScreenId(remaining[0]?.id);
  };
  const moveScreen = (id, dir) => mutate(a => {
    const idx = a.screens.findIndex(s => s.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= a.screens.length) return;
    const [item] = a.screens.splice(idx, 1);
    a.screens.splice(newIdx, 0, item);
  });

  const addComponent = (type, dropPos) => {
    // Adds inside the currently selected group, if any — otherwise at the top level.
    const selectedNode = selectedId ? findComponent(activeScreen, selectedId)?.node : null;
    const containerId = selectedNode?.type === 'container' ? selectedNode.id : null;
    const siblingCount = containerId
      ? (activeScreen.components.find(c => c.id === containerId)?.children.length || 0)
      : activeScreen.components.length;
    const comp = createComponent(type);
    if (dropPos) {
      // Dropped from the palette — center the new component on the cursor,
      // clamped to stay fully inside the canvas.
      const maxX = Math.max(0, CANVAS_WIDTH - comp.layout.w);
      const maxY = Math.max(0, CANVAS_HEIGHT - comp.layout.h);
      comp.layout.x = Math.min(maxX, Math.max(0, dropPos.x - comp.layout.w / 2));
      comp.layout.y = Math.min(maxY, Math.max(0, dropPos.y - comp.layout.h / 2));
    } else {
      const cascade = (siblingCount % 6) * 14;
      comp.layout.x = 20 + cascade;
      comp.layout.y = 20 + cascade;
    }
    mutate(a => {
      const screen = a.screens.find(s => s.id === activeScreenId);
      if (containerId) screen.components.find(c => c.id === containerId).children.push(comp);
      else screen.components.push(comp);
    });
    setSelectedId(comp.id);
  };

  const updateSelected = (updater) => {
    if (!selectedId) return;
    mutate(a => {
      const screen = a.screens.find(s => s.id === activeScreenId);
      const found = findComponent(screen, selectedId);
      if (found) updater(found.node);
    });
  };

  const deleteComponent = (id) => {
    mutate(a => {
      const screen = a.screens.find(s => s.id === activeScreenId);
      const found = findComponent(screen, id);
      if (!found) return;
      if (found.containerId) {
        const container = screen.components.find(c => c.id === found.containerId);
        container.children = container.children.filter(c => c.id !== id);
      } else {
        screen.components = screen.components.filter(c => c.id !== id);
      }
    });
    if (selectedId === id) setSelectedId(null);
  };

  const duplicateComponent = (id) => {
    mutate(a => {
      const screen = a.screens.find(s => s.id === activeScreenId);
      const found = findComponent(screen, id);
      if (!found) return;
      const clone = { ...structuredClone(found.node), id: genId() };
      const l = getLayout(clone);
      clone.layout = { ...l, x: l.x + 16, y: l.y + 16 };
      if (found.containerId) {
        const container = screen.components.find(c => c.id === found.containerId);
        const idx = container.children.findIndex(c => c.id === id);
        container.children.splice(idx + 1, 0, clone);
      } else {
        const idx = screen.components.findIndex(c => c.id === id);
        screen.components.splice(idx + 1, 0, clone);
      }
    });
  };

  const updateLayout = (id, layout) => mutate(a => {
    const screen = a.screens.find(s => s.id === activeScreenId);
    const found = findComponent(screen, id);
    if (found) found.node.layout = layout;
  });

  // Delete/Backspace/arrow-key/undo-redo canvas shortcuts — disabled while
  // typing in any text field (so deleting a character in, say, a props text
  // field doesn't delete the selected component) or while a modal is open
  // (so a stray keypress behind the preview/settings/review dialog can't
  // reach the canvas).
  useEffect(() => {
    const anyModalOpen = previewOpen || settingsOpen || reviewOpen || !!previewFeature;
    const isTypingTarget = (el) => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    const onKeyDown = (e) => {
      if (anyModalOpen || isTypingTarget(document.activeElement)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (!selectedId) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteComponent(selectedId);
      } else if (e.key === 'Escape') {
        setSelectedId(null);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const screen = app.screens.find(s => s.id === activeScreenId);
        const found = findComponent(screen, selectedId);
        if (!found) return;
        const l = getLayout(found.node);
        const step = e.shiftKey ? 10 : 1;
        const next = { ...l };
        if (e.key === 'ArrowUp') next.y = Math.max(0, next.y - step);
        if (e.key === 'ArrowDown') next.y += step;
        if (e.key === 'ArrowLeft') next.x = Math.max(0, next.x - step);
        if (e.key === 'ArrowRight') next.x += step;
        updateLayout(selectedId, next);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // Deliberately not listing deleteComponent/updateLayout/undo/redo — like
    // every other handler in this component they're plain functions
    // recreated each render, not useCallback-memoized, so listing them only
    // trades this warning for an "extract to useCallback" one instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, activeScreenId, app, previewOpen, settingsOpen, reviewOpen, previewFeature, history, future]);

  const setTheme = (id) => mutate(a => { a.theme = id; });

  const addVariable = () => mutate(a => { a.variables.push({ name: `var${a.variables.length + 1}`, initial_value: '' }); });
  const updateVariable = (idx, field, value) => mutate(a => { a.variables[idx][field] = value; });
  const removeVariable = (idx) => mutate(a => { a.variables.splice(idx, 1); });

  const [saveError, setSaveError] = useState('');

  const save = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const r = await fetch(`${API}${apiBase}/${appId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: app.name, description: app.description, accent_color: app.accent_color, theme: app.theme,
          screens: app.screens, variables: app.variables,
          package_id: app.package_id, min_sdk: app.min_sdk, target_sdk: app.target_sdk,
          app_display_name: app.app_display_name, app_icon_url: app.app_icon_url,
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.detail || 'Could not save.');
      }
      setDirty(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async () => {
    const next = app.status === 'published' ? 'draft' : 'published';
    if (dirty) await save();
    const r = await fetch(`${API}${apiBase}/${appId}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: next }),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setSaveError(data.detail || 'Could not update status.');
      return;
    }
    setApp(a => ({ ...a, status: next }));
  };

  const toggleVisibility = async () => {
    const next = app.visibility === 'public' ? 'private' : 'public';
    const r = await fetch(`${API}${apiBase}/${appId}/visibility`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ visibility: next }),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setSaveError(data.detail || 'Could not update visibility.');
      return;
    }
    setApp(a => ({ ...a, visibility: next }));
  };

  const withdrawApp = async () => {
    setWithdrawSubmitting(true);
    setSaveError('');
    try {
      const r = await fetch(`${API}${apiBase}/${appId}/withdraw`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: withdrawReason.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setSaveError(data.detail || 'Could not remove this app.'); return; }
      setApp(a => ({ ...a, visibility: 'private', owner_withdrawal_reason: withdrawReason.trim() }));
      setWithdrawOpen(false);
      setWithdrawReason('');
      setWithdrawConfirmName('');
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  const republishApp = async () => {
    const r = await fetch(`${API}${apiBase}/${appId}/republish`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { setSaveError(data.detail || 'Could not republish this app.'); return; }
    setApp(a => ({ ...a, visibility: 'public', owner_withdrawal_reason: '' }));
  };

  const openReviewModal = () => {
    setReviewForm({
      name: app.review_name || app.name || '',
      description: app.review_description || app.description || '',
      tags: app.review_tags || [],
      logo_url: app.review_logo_url || app.app_icon_url || '',
      banner_url: app.review_banner_url || '',
      price_cents: app.price_cents || 0,
      changelog: '',
    });
    setCharterAccepted(false);
    setReviewOpen(true);
  };

  const toggleReviewTag = (t) => setReviewForm(f => {
    const active = f.tags.includes(t);
    if (!active && f.tags.length >= MAX_APP_TAGS) return f;
    return { ...f, tags: active ? f.tags.filter(x => x !== t) : [...f.tags, t] };
  });

  const uploadReviewImage = async (file, field, setBusy) => {
    setBusy(true);
    try {
      const url = await uploadAsset(file);
      setReviewForm(f => ({ ...f, [field]: url }));
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitReview = async () => {
    setReviewSubmitting(true);
    setSaveError('');
    try {
      const r = await fetch(`${API}${apiBase}/${appId}/submit-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...reviewForm, charter_accepted: charterAccepted }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || 'Could not submit for review.');
      setReviewOpen(false);
      await load();
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleExport = async () => {
    if (!allowPremium) { setSaveError('Code export requires Vakar+.'); return; }
    setExporting(true);
    try {
      await exportAppAsZip(app, { showWatermark: !allowPremium });
    } finally {
      setExporting(false);
    }
  };

  const handleExportFile = async () => {
    setExportingFile(true);
    setSaveError('');
    try {
      const r = await fetch(`${API}${apiBase}/${appId}/export-file`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error('Could not export this app.');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${app.slug}.vakarstudio`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setExportingFile(false);
    }
  };

  const loadApkStatus = useCallback(async () => {
    if (!enableApkBuild) return null;
    try {
      const r = await fetch(`${API}${apiBase}/${appId}/build-apk/latest`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return null;
      const data = await r.json();
      setApkBuild(data.build);
      return data.build;
    } catch {
      return null;
    }
  }, [enableApkBuild, apiBase, appId, token]);

  useEffect(() => { loadApkStatus(); }, [loadApkStatus]);

  useEffect(() => {
    if (!enableApkBuild) return undefined;
    if (!apkBuild || (apkBuild.status !== 'queued' && apkBuild.status !== 'building')) return undefined;
    const t = setInterval(async () => {
      const b = await loadApkStatus();
      if (b && b.status !== 'queued' && b.status !== 'building') clearInterval(t);
    }, 5000);
    return () => clearInterval(t);
  }, [enableApkBuild, apkBuild, loadApkStatus]);

  // Generated lazily (only once the user opens the QR panel) rather than on
  // every ready build, since most downloads happen via the button, not a scan.
  useEffect(() => {
    if (!apkQrOpen || !apkBuild?.apk_url) return undefined;
    let cancelled = false;
    QRCode.toDataURL(`${API}${apkBuild.apk_url}`, { width: 220, margin: 1 })
      .then(url => { if (!cancelled) setApkQrDataUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [apkQrOpen, apkBuild?.apk_url]);

  const startApkBuild = async () => {
    setApkBusy(true);
    setSaveError('');
    try {
      const blob = await generateAppZipBlob(app, { showWatermark: !allowPremium });
      const formData = new FormData();
      formData.append('file', blob, 'bundle.zip');
      const uploadRes = await fetch(`${API}${apiBase}/${appId}/apk-bundle`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.detail || 'Could not prepare the build.');

      const triggerRes = await fetch(`${API}${apiBase}/${appId}/build-apk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bundle_url: uploadData.url }),
      });
      const triggerData = await triggerRes.json();
      if (!triggerRes.ok) throw new Error(triggerData.detail || 'Could not start the build.');
      setApkBuild({ status: 'building' });
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setApkBusy(false);
    }
  };

  const apkInProgress = apkBusy || apkBuild?.status === 'queued' || apkBuild?.status === 'building';

  if (isNarrowViewport) {
    return (
      <div className="h-full flex items-center justify-center p-6 bg-[#F5F5F7] dark:bg-[#0f0f18]">
        <div className="max-w-xs text-center rounded-xl border border-[#D2D2D7] dark:border-[#2a2a3c] bg-white dark:bg-[#151520] p-6">
          <Monitor size={28} className="mx-auto mb-3 text-[#4ECDC4]" />
          <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] mb-1.5">This needs a bigger screen</p>
          <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa]">
            The App Builder's drag-and-drop canvas isn't usable on a phone. Switch to a computer, or turn on "Desktop site" in your phone browser's menu.
          </p>
        </div>
      </div>
    );
  }

  if (loading || !app || !activeScreen) {
    return <div className="p-6"><div className="h-96 rounded-xl bg-[#F5F5F7] dark:bg-[#1c1c2e] animate-pulse" /></div>;
  }

  const selected = selectedId ? findComponent(activeScreen, selectedId)?.node : null;
  const theme = resolveTheme(app.theme);

  // Resolved fresh from `blocksTarget` (not from `selected`) so the
  // full-screen Blocks view keeps working correctly regardless of what's
  // currently selected in the (hidden, while Blocks is open) inspector — a
  // screen's own workspace isn't even scoped to `activeScreen` at all,
  // since the Zap button that opens it lives on every row in the Screens
  // list, not just the active one. Every element/screen has exactly ONE
  // workspace (`.blocks`) now — no more per-trigger split, since a single
  // workspace can hold every hat ("when clicked", "when pressed down", …)
  // that element supports side by side.
  const blocksScreen = blocksTarget?.isScreen ? app.screens.find(s => s.id === blocksTarget.nodeId) : null;
  const blocksNode = blocksTarget && !blocksTarget.isScreen ? findComponent(activeScreen, blocksTarget.nodeId)?.node : null;
  const blocksValue = blocksTarget?.isScreen ? blocksScreen?.blocks : blocksNode?.blocks;
  const blocksHatTypes = blocksTarget?.isScreen ? SCREEN_HAT_TYPES : (HAT_TYPES_BY_COMPONENT[blocksNode?.type] || []);
  const setBlocksValue = (next) => {
    if (!blocksTarget) return;
    mutate(a => {
      if (blocksTarget.isScreen) {
        const screen = a.screens.find(s => s.id === blocksTarget.nodeId);
        if (screen) screen.blocks = next;
        return;
      }
      const screen = a.screens.find(s => s.id === activeScreenId);
      const found = findComponent(screen, blocksTarget.nodeId);
      if (found) found.node.blocks = next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Auto-migration notice — shown once, the moment an app with old-shape
          actions (pre-Blockly editor) is opened; see migrateLegacyActions()
          above. Purely informational: the migrated blocks are already in
          `app` state, ready to review/save like any other change. */}
      {migrationWarnings.length > 0 && (
        <div className="flex items-start gap-2 px-5 py-2.5 border-b border-amber-500/20 bg-amber-500/10 text-[11px] text-amber-700 dark:text-amber-400 shrink-0">
          <ShieldAlert size={14} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">This app's actions were upgraded to the new block editor. A few couldn't be converted automatically:</p>
            <ul className="mt-1 list-disc list-inside space-y-0.5">
              {migrationWarnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
          <button onClick={() => setMigrationWarnings([])} className="p-1 shrink-0 hover:opacity-70"><X size={12} /></button>
        </div>
      )}
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[#D2D2D7] dark:border-[#2a2a3c] shrink-0 flex-wrap">
        <button onClick={onBack} className="p-1.5 rounded-lg text-[#6E6E73] dark:text-[#a1a1aa] hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06]">
          <ArrowLeft size={16} />
        </button>
        {editingName ? (
          <input
            autoFocus value={app.name}
            onChange={e => mutate(a => { a.name = e.target.value; })}
            onBlur={() => setEditingName(false)}
            onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
            className="text-sm font-semibold bg-transparent border-b border-[#4ECDC4] text-[#1D1D1F] dark:text-[#e4e4e7] focus:outline-none px-0.5"
          />
        ) : (
          <button onClick={() => setEditingName(true)} className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] hover:text-[#4ECDC4] transition-colors">
            {app.name}
          </button>
        )}

        <div className="flex items-center gap-1.5 ml-1">
          <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${app.status === 'published' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-100 dark:bg-[#2a2a3c] text-zinc-500 dark:text-[#a1a1aa]'}`}>
            {app.status}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#4ECDC4]/10 text-[#4ECDC4] flex items-center gap-1">
            {app.visibility === 'public' ? <Globe size={10} /> : <Lock size={10} />}{app.visibility}
          </span>
          {enableApkBuild && app.review_status && app.review_status !== 'none' && (
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full flex items-center gap-1 ${
              app.review_status === 'approved' ? 'bg-emerald-500/10 text-emerald-500'
                : app.review_status === 'rejected' ? 'bg-red-500/10 text-red-500'
                : 'bg-amber-500/10 text-amber-500'
            }`}>
              {app.review_status === 'approved' ? <Check size={10} /> : app.review_status === 'rejected' ? <ThumbsDown size={10} /> : <Clock size={10} />}
              {app.review_status === 'approved' ? 'Approved' : app.review_status === 'rejected' ? 'Changes requested' : 'Pending review'}
            </span>
          )}
          {enableApkBuild && app.price_cents > 0 && (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#F2994A]/10 text-[#F2994A] flex items-center gap-1">
              <DollarSign size={10} />${(app.price_cents / 100).toFixed(2)}
            </span>
          )}
          {enableApkBuild && !!app.creator_earnings_cents && (
            <span title="Total earned from sales" className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center gap-1">
              Earned ${(app.creator_earnings_cents / 100).toFixed(2)}
            </span>
          )}
        </div>

        <div className="flex-1" />

        {enableApkBuild && app.version_history?.length > 0 && (
          <Button size="sm" variant="secondary" icon={History} onClick={() => setHistoryOpen(true)} title="Version history">
            v{app.version_number}
          </Button>
        )}
        <Button size="sm" variant="secondary" icon={Settings} onClick={() => setSettingsOpen(true)} title="Package name, SDK, icon">
          App Settings
        </Button>
        {enableApkBuild ? (
          <Button size="sm" variant="accent" icon={Send} onClick={() => setPublishHubOpen(true)} title="Submit, withdraw or republish this app">
            Publish
          </Button>
        ) : (
          <>
            <Button size="sm" variant="secondary" onClick={toggleVisibility}>
              Make {app.visibility === 'public' ? 'Private' : 'Public'}
            </Button>
            <Button size="sm" variant={app.status === 'published' ? 'secondary' : 'accent'} onClick={toggleStatus}>
              {app.status === 'published' ? 'Unpublish' : 'Publish'}
            </Button>
          </>
        )}
        <Button size="sm" variant="secondary" icon={Eye} onClick={() => setPreviewOpen(true)}>Preview</Button>
        <Button size="sm" variant="secondary" icon={Download} onClick={() => setExportHubOpen(true)} title="Export or build this app">
          Export
        </Button>
        <Button size="sm" variant="secondary" icon={Undo2} onClick={undo} disabled={history.length === 0} title="Undo (Ctrl+Z)" />
        <Button size="sm" variant="secondary" icon={Redo2} onClick={redo} disabled={future.length === 0} title="Redo (Ctrl+Shift+Z)" />
        <Button size="sm" icon={justSaved ? Check : Save} onClick={save} loading={saving} disabled={!dirty && !saving}>
          {justSaved ? 'Saved' : dirty ? 'Save' : 'Saved'}
        </Button>
      </div>

      {enableApkBuild && app.admin_takedown && (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-red-50 dark:bg-red-500/10 border-b border-red-100 dark:border-red-500/20 text-xs text-red-600 dark:text-red-400 shrink-0">
          <ShieldAlert size={13} className="shrink-0" />
          <span>Suspended by moderation{app.admin_takedown_reason ? `: ${app.admin_takedown_reason}` : ''} — contact support to appeal.</span>
        </div>
      )}
      {enableApkBuild && !app.admin_takedown && app.admin_delisted && (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-100 dark:border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 shrink-0">
          <EyeOff size={13} className="shrink-0" />
          <span>Removed from the Applications catalog by moderation{app.admin_delisted_reason ? `: ${app.admin_delisted_reason}` : ''} — direct links still work.</span>
        </div>
      )}

      {saveError && (
        <div className="flex items-center justify-between gap-3 px-5 py-2.5 bg-red-50 dark:bg-red-500/10 border-b border-red-100 dark:border-red-500/20 text-xs text-red-600 dark:text-red-400 shrink-0">
          <span>{saveError}</span>
          {!allowPremium && saveError.toLowerCase().includes('vakar+') && (
            <a href="/vakar-plus" className="font-semibold underline shrink-0">Upgrade</a>
          )}
          <button onClick={() => setSaveError('')} className="shrink-0"><X size={12} /></button>
        </div>
      )}

      {quota && !allowPremium && !quotaBannerDismissed && (
        <div className="flex items-center justify-between gap-3 px-5 py-2 bg-[#4ECDC4]/8 border-b border-[#4ECDC4]/20 text-[11px] text-[#1D1D1F] dark:text-[#e4e4e7] shrink-0">
          <span>{quota.used}/{quota.max} apps used on your plan.</span>
          <div className="flex items-center gap-3 shrink-0">
            <a href="/vakar-plus" className="font-semibold text-[#4ECDC4] hover:underline shrink-0">Upgrade to Vakar+ for more</a>
            <button onClick={() => setQuotaBannerDismissed(true)} className="shrink-0" title="Dismiss"><X size={12} /></button>
          </div>
        </div>
      )}

      {enableApkBuild && apkInProgress && (
        <div className="flex items-center gap-2 px-5 py-2 bg-zinc-50 dark:bg-white/[0.03] border-b border-[#D2D2D7] dark:border-[#2a2a3c] text-[11px] text-[#6E6E73] dark:text-[#a1a1aa] shrink-0">
          <div className="w-3 h-3 border-2 border-[#D2D2D7] dark:border-[#2a2a3c] border-t-[#4ECDC4] rounded-full animate-spin shrink-0" />
          <span>Building your APK — this usually takes a few minutes, you can keep editing in the meantime.</span>
        </div>
      )}
      {enableApkBuild && apkBuild?.status === 'ready' && !apkInProgress && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-500/20 shrink-0">
          <div className="flex items-center justify-between gap-3 px-5 py-2 text-[11px] text-emerald-700 dark:text-emerald-400">
            <span>Your APK is ready.</span>
            <div className="flex items-center gap-3 shrink-0">
              <button onClick={() => setApkQrOpen(o => !o)} className="font-semibold underline">
                {apkQrOpen ? 'Hide QR code' : 'Show QR code'}
              </button>
              <a href={`${API}${apkBuild.apk_url}`} className="font-semibold underline" download>Download APK</a>
            </div>
          </div>
          {apkQrOpen && (
            <div className="flex flex-col items-center gap-2 px-5 pb-4">
              {apkQrDataUrl ? (
                <img
                  src={apkQrDataUrl} width={160} height={160}
                  alt="QR code linking to the APK download"
                  className="rounded-lg border border-emerald-100 dark:border-emerald-500/20 bg-white p-1.5"
                />
              ) : (
                <div className="w-40 h-40 rounded-lg bg-white/60 dark:bg-white/10 animate-pulse" />
              )}
              <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80">Scan with your phone's camera to download the APK.</p>
            </div>
          )}
        </div>
      )}
      {enableApkBuild && apkBuild?.status === 'failed' && !apkInProgress && (
        <div className="flex items-center justify-between gap-3 px-5 py-2 bg-red-50 dark:bg-red-500/10 border-b border-red-100 dark:border-red-500/20 text-[11px] text-red-600 dark:text-red-400 shrink-0">
          <span>APK build failed{apkBuild.error ? `: ${apkBuild.error}` : '.'}</span>
          <button onClick={startApkBuild} className="font-semibold underline shrink-0">Try again</button>
        </div>
      )}

      {/* Designer / Builder switch — persistent above the canvas (and the
          Blocks view), MIT-App-Inventor style. Replaces the old per-component
          "Action" button that used to live buried in the inspector. Builder
          opens whatever is selected on the canvas, or the active screen's own
          workspace if nothing is selected. */}
      <div className="flex items-center gap-3 px-5 py-2 border-b border-[#D2D2D7] dark:border-[#2a2a3c] shrink-0">
        <div className="inline-flex rounded-full bg-[#EDEDEF] dark:bg-[#1c1c2e] p-1 gap-1">
          <button
            onClick={() => setBlocksTarget(null)}
            className={`px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition-all ${!blocksTarget ? 'bg-white dark:bg-[#2a2a3c] text-[#1D1D1F] dark:text-white shadow-sm' : 'text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#4ECDC4]'}`}
          >
            Designer
          </button>
          <button
            onClick={() => {
              if (blocksTarget) return;
              if (selectedId && selected && HAT_TYPES_BY_COMPONENT[selected.type]) setBlocksTarget({ nodeId: selectedId });
              else if (activeScreenId) setBlocksTarget({ nodeId: activeScreenId, isScreen: true });
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition-all ${blocksTarget ? 'bg-white dark:bg-[#2a2a3c] text-[#1D1D1F] dark:text-white shadow-sm' : 'text-[#6E6E73] dark:text-[#a1a1aa] hover:text-[#4ECDC4]'}`}
          >
            <Zap size={11} />Builder
          </button>
        </div>
        {blocksTarget && (blocksNode || blocksScreen) && (
          <span className="text-xs font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">
            {blocksTarget.isScreen ? `Screen: ${blocksScreen?.name || 'Untitled'}` : COMPONENT_META[blocksNode?.type]?.label}
          </span>
        )}
      </div>

      {/* Body */}
      {blocksTarget && (blocksNode || blocksScreen) ? (
        /* Full-screen Blocks mode (MIT-App-Inventor-style Designer/Blocks
           toggle) — replaces the palette/canvas/inspector entirely instead
           of squeezing a Blockly canvas into the 288px inspector sidebar. */
        <div className="flex-1 flex flex-col min-h-0">
          {!blocksTarget.isScreen && (() => {
            const dependents = findVisibilityDependents(activeScreen, blocksNode.props?.variable);
            return dependents.length > 0 ? (
              <div className="mx-5 mt-3 p-2.5 rounded-lg bg-[#4ECDC4]/8 border border-[#4ECDC4]/20 text-[11px] text-[#1D1D1F] dark:text-[#e4e4e7] shrink-0">
                This value already controls whether these are shown: <strong>{dependents.join(', ')}</strong> — see each one's Visibility setting. No action needed here for that part.
              </div>
            ) : null;
          })()}
          <div className="flex-1 min-h-0 p-4">
            <AppBuilderBlockPanel
              key={blocksTarget.nodeId}
              value={blocksValue}
              onChange={setBlocksValue}
              context={{
                components: flattenAllTargets(blocksScreen || activeScreen),
                updatableIds: new Set(flattenUpdatableTargets(blocksScreen || activeScreen).map(t => t.id)),
                screens: app.screens,
              }}
              toolbox={buildToolbox(blocksHatTypes)}
              fullScreen
            />
          </div>
        </div>
      ) : (
      <div className="flex-1 flex min-h-0">
        {/* Left: screens + palette */}
        <div className="w-56 border-r border-[#D2D2D7] dark:border-[#2a2a3c] overflow-y-auto shrink-0 p-4 space-y-6">
          <div>
            <p className="text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] uppercase tracking-widest mb-2">Screens</p>
            <div className="space-y-1">
              {app.screens.map((s, i) => (
                <div
                  key={s.id}
                  onClick={() => setActiveScreenId(s.id)}
                  className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                    activeScreenId === s.id ? 'bg-[#1D1D1F] dark:bg-[#4ECDC4] text-white dark:text-[#0a0a0f]' : 'text-[#3A3A3C] dark:text-[#d4d4d8] hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <input
                    value={s.name}
                    onChange={e => renameScreen(s.id, e.target.value)}
                    onClick={e => e.stopPropagation()}
                    className="flex-1 min-w-0 bg-transparent focus:outline-none truncate"
                  />
                  <button
                    title="Screen blocks"
                    onClick={e => { e.stopPropagation(); setBlocksTarget({ nodeId: s.id, isScreen: true }); }}
                    className="opacity-0 group-hover:opacity-100 shrink-0"
                  >
                    <Zap size={11} />
                  </button>
                  {app.screens.length > 1 && (
                    <button onClick={e => { e.stopPropagation(); deleteScreen(s.id); }} className="opacity-0 group-hover:opacity-100 shrink-0">
                      <X size={11} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {(allowPremium || app.screens.length < FREE_MAX_SCREENS) ? (
              <button onClick={addScreen} className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#A1A1A6] hover:text-[#4ECDC4] transition-colors">
                <Plus size={11} />Add screen
              </button>
            ) : (
              <button onClick={() => setSaveError(`Free plan is limited to ${FREE_MAX_SCREENS} pages.`)} className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#BFBFC4] dark:text-[#52525b]">
                <Lock size={10} />Add screen (Vakar+)
              </button>
            )}
          </div>

          <div>
            <p className="text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] uppercase tracking-widest mb-2">Layers</p>
            <div className="space-y-0.5">
              {buildLayerRows(activeScreen).map(row => (
                <button
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  style={{ paddingLeft: 8 + row.depth * 14 }}
                  className={`w-full flex items-center gap-1.5 pr-2 py-1 rounded-md text-left text-[11px] transition-colors ${
                    selectedId === row.id ? 'bg-[#4ECDC4]/15 text-[#4ECDC4] font-semibold' : 'text-[#6E6E73] dark:text-[#a1a1aa] hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06]'
                  }`}
                >
                  {row.icon && <row.icon size={11} className="shrink-0" />}
                  <span className="truncate">{row.text}</span>
                </button>
              ))}
              {(!activeScreen?.components || activeScreen.components.length === 0) && (
                <p className="text-[11px] text-[#A1A1A6] px-2 py-1">No components on this screen yet.</p>
              )}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] uppercase tracking-widest mb-2">Add component</p>
            <div className="grid grid-cols-2 gap-1.5">
              {COMPONENT_TYPES.map(c => {
                const locked = c.tier === 'premium' && !allowPremium;
                return (
                  <button
                    key={c.type}
                    draggable={!locked}
                    onDragStart={(e) => {
                      if (locked) { e.preventDefault(); return; }
                      e.dataTransfer.setData('application/x-vakar-component', c.type);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => locked ? setPreviewFeature({ kind: 'component', meta: c }) : addComponent(c.type)}
                    className={`relative flex flex-col items-center gap-1 py-2.5 rounded-lg border transition-colors ${
                      locked
                        ? 'border-[#D2D2D7] dark:border-[#2a2a3c] text-[#BFBFC4] dark:text-[#52525b] opacity-60 cursor-not-allowed'
                        : 'border-[#D2D2D7] dark:border-[#2a2a3c] text-[#6E6E73] dark:text-[#a1a1aa] hover:border-[#4ECDC4] hover:text-[#4ECDC4] cursor-grab active:cursor-grabbing'
                    }`}
                  >
                    {c.tier === 'premium' && (
                      <span title={locked ? 'Requires Vakar+' : 'Vakar+ component'} className="absolute top-1 right-1 text-[#F2994A]"><Lock size={9} /></span>
                    )}
                    <c.icon size={15} />
                    <span className="text-[10px] font-medium">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Palette size={10} />Theme
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {THEME_PRESETS.map(t => {
                const locked = t.tier === 'premium' && !allowPremium;
                return (
                  <button
                    key={t.id}
                    onClick={() => locked ? setPreviewFeature({ kind: 'theme', theme: t }) : setTheme(t.id)}
                    title={locked ? `${t.label} — requires Vakar+` : t.label}
                    className={`relative h-9 rounded-lg border-2 transition-all ${app.theme === t.id || (!app.theme && t.id === 'mint') ? 'border-[#4ECDC4] scale-105' : 'border-transparent'} ${locked ? 'opacity-50' : ''}`}
                    style={{ background: `linear-gradient(135deg, ${t.colors.primary}, ${t.colors.background})` }}
                  >
                    {t.tier === 'premium' && (
                      <span title="Vakar+ theme" className="absolute -top-1 -right-1 bg-white dark:bg-[#151520] rounded-full p-0.5 text-[#F2994A] shadow"><Lock size={8} /></span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] uppercase tracking-widest mb-2">Variables</p>
            <div className="space-y-1.5">
              {app.variables.map((v, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input value={v.name} onChange={e => updateVariable(i, 'name', e.target.value)} placeholder="name" className="w-[45%] rounded-md px-1.5 py-1 text-[11px] bg-[#F5F5F7] dark:bg-[#0d0d14] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#e4e4e7] focus:outline-none" />
                  <input value={v.initial_value} onChange={e => updateVariable(i, 'initial_value', e.target.value)} placeholder="initial" className="flex-1 min-w-0 rounded-md px-1.5 py-1 text-[11px] bg-[#F5F5F7] dark:bg-[#0d0d14] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#e4e4e7] focus:outline-none" />
                  <button onClick={() => removeVariable(i)} className="text-[#A1A1A6] hover:text-red-500 shrink-0"><X size={11} /></button>
                </div>
              ))}
            </div>
            <button onClick={addVariable} className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#A1A1A6] hover:text-[#4ECDC4] transition-colors">
              <Plus size={11} />Add variable
            </button>
          </div>
        </div>

        {/* Center: canvas */}
        <div className="flex-1 overflow-auto p-8 bg-[#FAFAFA] dark:bg-[#0d0d14] flex items-start justify-center">
          <div className="rounded-[28px] border border-[#D2D2D7] dark:border-[#2a2a3c] shadow-sm overflow-hidden" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
            <DesignCanvas
              screen={activeScreen}
              theme={theme}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onChangeLayout={updateLayout}
              onDelete={deleteComponent}
              onDropComponent={addComponent}
              dragOver={canvasDragOver}
              onDragOverChange={setCanvasDragOver}
            />
          </div>
        </div>

        {/* Right: inspector */}
        <div className="w-72 border-l border-[#D2D2D7] dark:border-[#2a2a3c] overflow-y-auto shrink-0 p-4">
          {!selected ? (
            <div className="text-xs text-[#A1A1A6] dark:text-[#71717a] text-center py-10">
              Select a component to edit its properties.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <ChevronRight size={12} className="text-[#A1A1A6]" />
                  <p className="text-xs font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">{COMPONENT_META[selected.type]?.label}</p>
                </div>
                <button onClick={() => duplicateComponent(selected.id)} title="Duplicate" className="p-1 text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white">
                  <Copy size={13} />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {['x', 'y', 'w', 'h'].map(key => {
                  const l = getLayout(selected);
                  return (
                    <div key={key}>
                      <label className="block text-[9px] font-semibold text-[#A1A1A6] dark:text-[#71717a] uppercase tracking-wider mb-1">{key}</label>
                      <input
                        type="number" value={Math.round(l[key])}
                        onChange={e => {
                          const n = Number(e.target.value) || 0;
                          const min = (key === 'w' || key === 'h') ? MIN_SIZE : 0;
                          updateLayout(selected.id, { ...l, [key]: Math.max(min, n) });
                        }}
                        className="w-full rounded-md px-1.5 py-1 text-xs bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#e4e4e7] focus:outline-none focus:border-[#4ECDC4]"
                      />
                    </div>
                  );
                })}
              </div>
              {HAT_TYPES_BY_COMPONENT[selected.type] && (
                <p className="flex items-center gap-1.5 mb-4 text-[10px] text-[#A1A1A6] dark:text-[#71717a]">
                  <Zap size={10} className="shrink-0" />This component has blocks — switch to <strong className="font-semibold text-[#6E6E73] dark:text-[#a1a1aa]">Builder</strong> above to edit them.
                </p>
              )}
              <PropsEditor
                node={selected} onChange={updateSelected} allowPremium={allowPremium} onUploadImage={uploadImageAsset}
                onPremiumBlocked={() => setPreviewFeature({ kind: 'component', meta: { label: 'Custom text size' } })}
                screens={app.screens} screen={activeScreen}
                onEditItemAction={() => setBlocksTarget({ nodeId: selected.id })}
              />
              <ComponentExtras
                node={selected} onChange={updateSelected} allowPremium={allowPremium}
                onPremiumBlocked={(msg) => setPreviewFeature({ kind: 'component', meta: { label: msg || 'This feature' } })}
              />
            </>
          )}
        </div>
      </div>
      )}

      {/* Preview modal — same clean device-frame simulation as the canvas, no fake status bar/bezel (that's reserved for the real published app / APK) */}
      {previewOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/50" onClick={() => setPreviewOpen(false)}>
          <div
            onClick={e => e.stopPropagation()}
            className="relative bg-white rounded-[28px] border border-[#D2D2D7] shadow-2xl overflow-hidden"
            style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, maxHeight: '90vh' }}
          >
            <button onClick={() => setPreviewOpen(false)} className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center">
              <X size={14} />
            </button>
            <AppRuntime app={app} token={token} className="w-full h-full" showWatermark={!allowPremium} />
          </div>
        </div>
      )}

      {/* Export hub — every download/build format in one place instead of a
          row of top-bar buttons. .aab and .ipa are placeholders (Google
          Play / iOS build pipelines don't exist yet). */}
      {exportHubOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/50" onClick={() => setExportHubOpen(false)}>
          <div
            onClick={e => e.stopPropagation()}
            className="rounded-2xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] w-full max-w-sm overflow-hidden max-h-[85vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#D2D2D7] dark:border-[#2a2a3c] shrink-0">
              <h3 className="font-display text-lg font-medium text-[#1D1D1F] dark:text-[#e4e4e7]">Export</h3>
              <button onClick={() => setExportHubOpen(false)} className="p-1.5 text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-4 space-y-2 overflow-y-auto">
              <button
                onClick={handleExportFile}
                disabled={exportingFile}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#4ECDC4] transition-colors text-left disabled:opacity-60"
              >
                <Package size={16} className="text-[#4ECDC4] shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">.vakarstudio</span>
                  <span className="block text-[10px] text-[#A1A1A6]">Encrypted project file — importable back into Vakar Studio</span>
                </span>
                {exportingFile && <div className="w-3.5 h-3.5 border-2 border-[#D2D2D7] border-t-[#4ECDC4] rounded-full animate-spin shrink-0" />}
              </button>

              <button
                onClick={handleExport}
                disabled={exporting}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#4ECDC4] transition-colors text-left disabled:opacity-60"
              >
                {allowPremium ? <Download size={16} className="text-[#4ECDC4] shrink-0" /> : <Lock size={16} className="text-[#A1A1A6] shrink-0" />}
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">.zip</span>
                  <span className="block text-[10px] text-[#A1A1A6]">{allowPremium ? 'Full VS Code project source' : 'Requires Vakar+'}</span>
                </span>
                {exporting && <div className="w-3.5 h-3.5 border-2 border-[#D2D2D7] border-t-[#4ECDC4] rounded-full animate-spin shrink-0" />}
              </button>

              {enableApkBuild && (
                <button
                  onClick={apkBuild?.status === 'ready' ? undefined : startApkBuild}
                  disabled={apkInProgress}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#4ECDC4] transition-colors text-left disabled:opacity-60"
                >
                  <Smartphone size={16} className="text-[#4ECDC4] shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">.apk</span>
                    <span className="block text-[10px] text-[#A1A1A6]">
                      {apkInProgress ? 'Building…' : apkBuild?.status === 'ready' ? 'Ready — see the download banner above' : 'Installable Android package'}
                    </span>
                  </span>
                  {apkInProgress && <div className="w-3.5 h-3.5 border-2 border-[#D2D2D7] border-t-[#4ECDC4] rounded-full animate-spin shrink-0" />}
                </button>
              )}

              {enableApkBuild && (
                <div className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-[#D2D2D7] dark:border-[#2a2a3c] opacity-60">
                  <Package size={16} className="text-[#A1A1A6] shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">.aab</span>
                    <span className="block text-[10px] text-[#A1A1A6]">For Google Play submission</span>
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-[#2a2a3c] text-zinc-500 dark:text-[#a1a1aa] shrink-0">Coming soon</span>
                </div>
              )}

              <div className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-[#D2D2D7] dark:border-[#2a2a3c] opacity-60">
                <Smartphone size={16} className="text-[#A1A1A6] shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">.ipa</span>
                  <span className="block text-[10px] text-[#A1A1A6]">iOS</span>
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-[#2a2a3c] text-zinc-500 dark:text-[#a1a1aa] shrink-0">Coming soon</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Publish hub — Submit Version / Remove from Applications / Republish,
          gathered behind one top-bar button instead of three. */}
      {publishHubOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/50" onClick={() => setPublishHubOpen(false)}>
          <div
            onClick={e => e.stopPropagation()}
            className="rounded-2xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] w-full max-w-sm overflow-hidden max-h-[85vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#D2D2D7] dark:border-[#2a2a3c] shrink-0">
              <h3 className="font-display text-lg font-medium text-[#1D1D1F] dark:text-[#e4e4e7]">Publish</h3>
              <button onClick={() => setPublishHubOpen(false)} className="p-1.5 text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-4 space-y-2 overflow-y-auto">
              <button
                onClick={() => { setPublishHubOpen(false); openReviewModal(); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#4ECDC4] transition-colors text-left"
              >
                <Send size={16} className="text-[#4ECDC4] shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Submit Version</span>
                  <span className="block text-[10px] text-[#A1A1A6]">Send this version for admin review — approval is what publishes it</span>
                </span>
              </button>

              {app.visibility === 'public' && app.ever_approved && !app.admin_takedown && (
                <button
                  onClick={() => { setPublishHubOpen(false); setWithdrawOpen(true); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-red-400 transition-colors text-left"
                >
                  <ShieldAlert size={16} className="text-red-500 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Remove from Applications</span>
                    <span className="block text-[10px] text-[#A1A1A6]">Pull this app down yourself</span>
                  </span>
                </button>
              )}

              {app.visibility === 'private' && app.owner_withdrawal_reason && !app.admin_takedown && (
                <button
                  onClick={() => { setPublishHubOpen(false); setRepublishConfirmOpen(true); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#4ECDC4] transition-colors text-left"
                >
                  <Eye size={16} className="text-[#4ECDC4] shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Republish to Applications</span>
                    <span className="block text-[10px] text-[#A1A1A6]">Undo your own withdrawal and go back live</span>
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* App Settings modal — Android build config for the APK export */}
      {settingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/50" onClick={() => setSettingsOpen(false)}>
          <div
            onClick={e => e.stopPropagation()}
            className="rounded-2xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] w-full max-w-md overflow-hidden max-h-[85vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#D2D2D7] dark:border-[#2a2a3c] shrink-0">
              <h3 className="font-display text-lg font-medium text-[#1D1D1F] dark:text-[#e4e4e7]">App Settings</h3>
              <button onClick={() => setSettingsOpen(false)} className="p-1.5 text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 overflow-y-auto">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => iconInputRef.current?.click()}
                  className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 bg-[#F5F5F7] dark:bg-[#0d0d14] border border-[#D2D2D7] dark:border-[#2a2a3c] flex items-center justify-center"
                >
                  {app.app_icon_url ? (
                    <img src={app.app_icon_url.startsWith('/') ? `${API}${app.app_icon_url}` : app.app_icon_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Smartphone size={20} className="text-[#A1A1A6]" />
                  )}
                </button>
                <div>
                  <button onClick={() => iconInputRef.current?.click()} disabled={iconUploading} className="text-xs font-semibold text-[#4ECDC4] hover:underline disabled:opacity-50">
                    {iconUploading ? 'Uploading…' : app.app_icon_url ? 'Change icon' : 'Upload icon'}
                  </button>
                  <p className="text-[10px] text-[#A1A1A6] mt-1">Square image, at least 512×512px.</p>
                </div>
                <input ref={iconInputRef} type="file" accept=".jpg,.jpeg,.png" className="hidden" onChange={handleIconUpload} />
              </div>

              <div>
                <label className={FIELD_LABEL}>App display name</label>
                <input
                  value={app.app_display_name || ''}
                  onChange={e => mutate(a => { a.app_display_name = e.target.value; })}
                  placeholder={app.name}
                  className={FIELD_INPUT}
                />
                <p className="mt-1 text-[10px] text-[#A1A1A6]">Shown under the icon on the home screen. Defaults to the app's name above.</p>
              </div>

              <div>
                <label className={FIELD_LABEL}>Package name</label>
                <input
                  value={app.package_id || ''}
                  onChange={e => mutate(a => { a.package_id = e.target.value; })}
                  placeholder={`com.vakargames.studioapp.app${(app.slug || '').replace(/-/g, '')}`}
                  className={`${FIELD_INPUT} font-mono`}
                />
                {app.package_id && !PACKAGE_ID_RE.test(app.package_id) && (
                  <p className="mt-1 text-[10px] text-red-500">Invalid — use reverse-DNS style like com.yourname.appname (letters, numbers, underscores, no segment starting with a number).</p>
                )}
                <p className="mt-1 text-[10px] text-[#A1A1A6]">Uniquely identifies your app on Android — best set once and left alone.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={FIELD_LABEL}>Min SDK</label>
                  <Select value={String(app.min_sdk ?? 22)} onChange={e => mutate(a => { a.min_sdk = Number(e.target.value); })} size="sm">
                    {SDK_LEVELS.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
                  </Select>
                </div>
                <div>
                  <label className={FIELD_LABEL}>Target SDK</label>
                  <Select value={String(app.target_sdk ?? 34)} onChange={e => mutate(a => { a.target_sdk = Number(e.target.value); })} size="sm">
                    {SDK_LEVELS.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
                  </Select>
                </div>
              </div>

              {typeof app.storage_used_bytes === 'number' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={FIELD_LABEL}>Storage</label>
                    <span className="text-[10px] text-[#A1A1A6]">{formatBytes(app.storage_used_bytes)} / {formatBytes(app.storage_max_bytes)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#F5F5F7] dark:bg-[#0d0d14] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${app.storage_used_bytes >= app.storage_max_bytes ? 'bg-red-500' : 'bg-[#4ECDC4]'}`}
                      style={{ width: `${Math.min(100, (app.storage_used_bytes / app.storage_max_bytes) * 100)}%` }}
                    />
                  </div>
                  {!allowPremium && (
                    <p className="mt-1 text-[10px] text-[#A1A1A6]">Icon and uploaded images count toward this. <a href="/vakar-plus" className="text-[#4ECDC4] font-semibold hover:underline">Upgrade to Vakar+ for 1GB</a>.</p>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[#D2D2D7] dark:border-[#2a2a3c] shrink-0">
              <Button className="w-full" onClick={() => setSettingsOpen(false)}>Done</Button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Version modal — self-service only. Sending this sets
          review_status to "pending"; approval is the only way a self-service
          app becomes publicly reachable (see get_public_studio_app). */}
      {reviewOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/50" onClick={() => !reviewSubmitting && setReviewOpen(false)}>
          <div
            onClick={e => e.stopPropagation()}
            className="rounded-2xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] w-full max-w-md overflow-hidden max-h-[85vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#D2D2D7] dark:border-[#2a2a3c] shrink-0">
              <h3 className="font-display text-lg font-medium text-[#1D1D1F] dark:text-[#e4e4e7]">Submit Version</h3>
              <button onClick={() => setReviewOpen(false)} className="p-1.5 text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 overflow-y-auto">
              <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa]">
                An admin reviews this before it goes live. If approved, your app becomes public and appears on Applications.
              </p>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => reviewLogoInputRef.current?.click()}
                  className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 bg-[#F5F5F7] dark:bg-[#0d0d14] border border-[#D2D2D7] dark:border-[#2a2a3c] flex items-center justify-center"
                >
                  {reviewForm.logo_url ? (
                    <img src={reviewForm.logo_url.startsWith('/') ? `${API}${reviewForm.logo_url}` : reviewForm.logo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Smartphone size={20} className="text-[#A1A1A6]" />
                  )}
                </button>
                <div>
                  <button onClick={() => reviewLogoInputRef.current?.click()} disabled={reviewLogoUploading} className="text-xs font-semibold text-[#4ECDC4] hover:underline disabled:opacity-50">
                    {reviewLogoUploading ? 'Uploading…' : reviewForm.logo_url ? 'Change logo' : 'Upload logo (required)'}
                  </button>
                  <p className="text-[10px] text-[#A1A1A6] mt-1">Square image, at least 512×512px.</p>
                </div>
                <input ref={reviewLogoInputRef} type="file" accept=".jpg,.jpeg,.png,.gif,.webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadReviewImage(f, 'logo_url', setReviewLogoUploading); }} />
              </div>

              <div>
                <button
                  onClick={() => reviewBannerInputRef.current?.click()}
                  className="w-full h-24 rounded-xl overflow-hidden bg-[#F5F5F7] dark:bg-[#0d0d14] border border-dashed border-[#D2D2D7] dark:border-[#2a2a3c] flex items-center justify-center"
                >
                  {reviewForm.banner_url ? (
                    <img src={reviewForm.banner_url.startsWith('/') ? `${API}${reviewForm.banner_url}` : reviewForm.banner_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-[#4ECDC4]">{reviewBannerUploading ? 'Uploading…' : 'Upload a banner (optional)'}</span>
                  )}
                </button>
                <input ref={reviewBannerInputRef} type="file" accept=".jpg,.jpeg,.png,.gif,.webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadReviewImage(f, 'banner_url', setReviewBannerUploading); }} />
              </div>

              <div>
                <label className={FIELD_LABEL}>Name</label>
                <input value={reviewForm.name} onChange={e => setReviewForm(f => ({ ...f, name: e.target.value }))} className={FIELD_INPUT} maxLength={80} />
              </div>

              <div>
                <label className={FIELD_LABEL}>Description</label>
                <textarea rows={3} value={reviewForm.description} onChange={e => setReviewForm(f => ({ ...f, description: e.target.value }))} className={`${FIELD_INPUT} resize-none`} maxLength={600} />
              </div>

              <div>
                <label className={FIELD_LABEL}>Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {APP_TAGS.map(t => {
                    const active = reviewForm.tags.includes(t);
                    const disabled = !active && reviewForm.tags.length >= MAX_APP_TAGS;
                    return (
                      <button
                        key={t} type="button" disabled={disabled} onClick={() => toggleReviewTag(t)}
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                          active
                            ? 'bg-[#4ECDC4] border-[#4ECDC4] text-white'
                            : disabled
                              ? 'border-[#EDEDEF] dark:border-[#2a2a3c] text-[#D2D2D7] dark:text-[#3f3f4c] cursor-not-allowed'
                              : 'border-[#D2D2D7] dark:border-[#2a2a3c] text-[#6E6E73] dark:text-[#a1a1aa] hover:border-[#4ECDC4] hover:text-[#4ECDC4]'
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[10px] text-[#A1A1A6]">Choose {MIN_APP_TAGS}–{MAX_APP_TAGS} — {reviewForm.tags.length}/{MAX_APP_TAGS} selected.</p>
              </div>

              <div>
                <label className={FIELD_LABEL}>Access</label>
                {!allowPremium ? (
                  <p className="text-xs text-[#A1A1A6] flex items-center gap-1.5"><Lock size={11} />Free apps only — <a href="/vakar-plus" className="text-[#4ECDC4] font-semibold hover:underline">Vakar+ unlocks paid apps</a>.</p>
                ) : (
                  <>
                    <div className="inline-flex rounded-full bg-[#EDEDEF] dark:bg-[#1c1c2e] p-1 gap-1 mb-2">
                      {[{ id: 'free', label: 'Free' }, { id: 'paid', label: 'Paid' }].map(o => (
                        <button
                          key={o.id}
                          onClick={() => setReviewForm(f => ({ ...f, price_cents: o.id === 'free' ? 0 : Math.max(f.price_cents, 100) }))}
                          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                            (o.id === 'paid') === (reviewForm.price_cents > 0) ? 'bg-white dark:bg-[#2a2a3c] text-[#1D1D1F] dark:text-white shadow-sm' : 'text-[#6E6E73] dark:text-[#a1a1aa]'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                    {reviewForm.price_cents > 0 && (
                      <div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#A1A1A6]">$</span>
                          <input
                            type="number" min="1" step="0.01"
                            value={(reviewForm.price_cents / 100).toFixed(2)}
                            onChange={e => setReviewForm(f => ({ ...f, price_cents: Math.max(100, Math.round(Number(e.target.value) * 100) || 0) }))}
                            className={`${FIELD_INPUT} pl-6`}
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-[#A1A1A6]">Minimum $1.00. You keep {100 - PLATFORM_SHARE_PCT}% of every sale (${((reviewForm.price_cents * (100 - PLATFORM_SHARE_PCT) / 100) / 100).toFixed(2)} per copy) — the rest covers payment fees, servers and hosting.</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {app.ever_approved && (
                <div>
                  <div className="flex items-center justify-between">
                    <label className={FIELD_LABEL}>What's new in this update</label>
                    {app.version_history?.length > 0 && (
                      <button type="button" onClick={() => setHistoryOpen(true)} className="text-[10px] font-semibold text-[#4ECDC4] hover:underline flex items-center gap-1">
                        <History size={10} />View past updates
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={3} value={reviewForm.changelog}
                    onChange={e => setReviewForm(f => ({ ...f, changelog: e.target.value }))}
                    placeholder="e.g. Fixed the scoring bug, added a dark theme option…"
                    className={`${FIELD_INPUT} resize-none`} maxLength={600}
                  />
                  <p className="mt-1 text-[10px] text-[#A1A1A6]">Your app stays live and unchanged for everyone while this update is reviewed — it only replaces the live version once approved.</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[#D2D2D7] dark:border-[#2a2a3c] shrink-0 space-y-3">
              <label className="flex items-start gap-2 text-[11px] text-[#6E6E73] dark:text-[#a1a1aa] cursor-pointer">
                <input
                  type="checkbox" checked={charterAccepted}
                  onChange={e => setCharterAccepted(e.target.checked)}
                  className="mt-0.5 shrink-0"
                />
                <span>
                  I have read and accept the{' '}
                  <a href="/studio-charter" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#4ECDC4] hover:underline">Studio Publisher Charter</a>.
                </span>
              </label>
              <Button
                className="w-full" icon={Send} loading={reviewSubmitting}
                disabled={
                  !reviewForm.name.trim() || !reviewForm.description.trim() || !reviewForm.logo_url
                  || reviewForm.tags.length < MIN_APP_TAGS
                  || (reviewForm.price_cents > 0 && reviewForm.price_cents < 100)
                  || (app.ever_approved && !reviewForm.changelog.trim())
                  || !charterAccepted
                }
                onClick={submitReview}
              >
                Submit for review
              </Button>
            </div>
          </div>
        </div>
      )}

      <VersionHistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} history={app.version_history} />

      <ConfirmDialog
        isOpen={republishConfirmOpen}
        onClose={() => !republishSubmitting && setRepublishConfirmOpen(false)}
        onConfirm={async () => {
          setRepublishSubmitting(true);
          try { await republishApp(); setRepublishConfirmOpen(false); } finally { setRepublishSubmitting(false); }
        }}
        title="Republish this app?"
        description="It goes back to public immediately, using the same last-approved version — no new review needed."
        confirmLabel="Republish"
        variant="accent"
        loading={republishSubmitting}
      />

      {/* "Remove from Applications" — a genuinely consequential self-service
          action (may have installs/sales), so it needs a reason AND a
          type-to-confirm input, not the single-click ConfirmDialog used for
          republish above or anywhere else in this editor. */}
      {withdrawOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/50" onClick={() => !withdrawSubmitting && setWithdrawOpen(false)}>
          <div
            onClick={e => e.stopPropagation()}
            className="rounded-2xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] w-full max-w-md overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#D2D2D7] dark:border-[#2a2a3c]">
              <h3 className="font-display text-lg font-medium text-[#1D1D1F] dark:text-[#e4e4e7] flex items-center gap-2">
                <ShieldAlert size={17} className="text-red-500" />Remove from Applications
              </h3>
              <button onClick={() => setWithdrawOpen(false)} className="p-1.5 text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-xs text-[#6E6E73] dark:text-[#a1a1aa]">
                Your app is pulled from Applications immediately — strangers can no longer reach it. You can republish it yourself at any time, unless it's later suspended by moderation.
              </p>
              <div>
                <label className={FIELD_LABEL}>Why are you removing it?</label>
                <textarea
                  autoFocus rows={2} value={withdrawReason} onChange={e => setWithdrawReason(e.target.value)}
                  placeholder="e.g. Taking it down for a rework" className={`${FIELD_INPUT} resize-none`} maxLength={500}
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Type "{app.name}" to confirm</label>
                <input
                  value={withdrawConfirmName} onChange={e => setWithdrawConfirmName(e.target.value)}
                  placeholder={app.name} className={FIELD_INPUT}
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#D2D2D7] dark:border-[#2a2a3c] flex gap-2">
              <Button
                className="flex-1" variant="danger" icon={ShieldAlert} loading={withdrawSubmitting}
                disabled={!withdrawReason.trim() || withdrawConfirmName.trim() !== app.name.trim()}
                onClick={withdrawApp}
              >
                Remove from Applications
              </Button>
              <Button variant="secondary" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Premium preview — shows a pre-built demo screen instead of just a
          "requires Vakar+" message, so a locked theme/component/custom-size
          shows what it actually looks like in a real app. */}
      {previewFeature && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/50" onClick={() => setPreviewFeature(null)}>
          <div onClick={e => e.stopPropagation()} className="flex flex-col items-center">
            <div
              className="rounded-[28px] border border-[#D2D2D7] shadow-2xl overflow-hidden relative"
              style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
            >
              {(() => {
                const theme = resolveTheme(previewFeature.kind === 'theme' ? previewFeature.theme.id : app.theme);
                const scene = PREMIUM_PREVIEW_SCENES[previewFeature.kind === 'component' ? previewFeature.meta?.type : null]
                  || PREMIUM_PREVIEW_SCENES.theme;
                return <PreviewPlayer scene={scene} theme={theme} />;
              })()}
            </div>
            <div className="mt-4 text-center max-w-xs">
              <p className="text-sm font-semibold text-white flex items-center justify-center gap-1.5">
                <Lock size={13} />
                {previewFeature.kind === 'theme' ? `${previewFeature.theme.label} theme` : previewFeature.meta.label} — Vakar+
              </p>
              <p className="text-xs text-white/70 mt-1">A preview of what this looks like in a real app.</p>
              <div className="flex items-center justify-center gap-2 mt-3">
                <Button size="sm" variant="secondary" onClick={() => setPreviewFeature(null)}>Close</Button>
                <Button size="sm" onClick={() => { window.location.href = '/vakar-plus'; }}>Upgrade to Vakar+</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
