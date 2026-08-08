import React, { useState, useMemo, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import { resolveTheme, AppIcon, getLayout, CANVAS_WIDTH, CANVAS_HEIGHT, resolveTextSizePx, UPDATABLE_PROP, COMPONENT_META, flattenAllTargets, flattenUpdatableTargets } from '../constants/appBuilder';
import { createRuntimeHelpers } from '../appBuilderBlock/runtime';
import { sandboxFetch } from '../appBuilderBlock/sandboxFetch';
import { compileNodeBlocks } from '../appBuilderBlock/generators';
import { migrateToHatWorkspace, isV2Shape } from '../appBuilderBlock/legacyMigration';
import { setAbBlockContext } from '../appBuilderBlock/fields';
import { LEGACY_TRIGGER_TO_HAT } from '../appBuilderBlock/blocks';

// Resolves one element's (or screen's) single `.blocks` workspace to real
// Blockly JSON, migrating on the fly if it's still on an old shape (a flat
// action-list array, or a pre-hat v1 workspace saved under the old
// per-type actions.onClick/onChange/props.item_action/screen.actions.onOpen
// fields — see legacyMigration.js's header comment for the full chain).
// Unlike the editor (AppBuilderEditor.js's load()), this has nothing to
// persist the migration back to — it's re-derived on every call, which is
// fine since it's a pure, cheap, in-memory transform. `isScreen` picks
// which old field/hat mapping applies; everything else is looked up from
// COMPONENT_META exactly like AppBuilderEditor.js's migrateLegacyActions
// does. `screen`/`screens` populate the same target/screen dropdown
// registry AppBuilderBlockPanel does before authoring — a migrated
// target_id/screen_id must be a real option in that registry or the field
// silently drops it.
function resolveNodeWorkspace(node, isScreen, variableNames, screen, screens) {
  if (!node) return null;
  if (isV2Shape(node.blocks)) return node.blocks.blockly;

  let oldValue, hatType;
  if (isScreen) {
    oldValue = node.actions?.onOpen;
    hatType = 'ab_when_screen_opens';
  } else if (node.type === 'list') {
    oldValue = node.props?.item_action;
    hatType = 'ab_when_row_tapped';
  } else {
    const trigger = COMPONENT_META[node.type]?.actionTrigger;
    hatType = LEGACY_TRIGGER_TO_HAT[trigger];
    oldValue = trigger ? node.actions?.[trigger] : null;
  }
  if (!oldValue || !hatType) return null;

  setAbBlockContext({
    components: flattenAllTargets(screen),
    updatableIds: new Set(flattenUpdatableTargets(screen).map(t => t.id)),
    screens,
  });
  const { value } = migrateToHatWorkspace(oldValue, hatType, { variableNames });
  return value?.blockly || null;
}

const API = process.env.REACT_APP_BACKEND_URL || '';

// Standard boilerplate for the Push API's applicationServerKey — it wants
// the VAPID public key as raw bytes, not the base64url text the backend
// hands back.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// Interprets a Studio App's {screens, variables, theme} into a live,
// running mini-app: theming, local variable state, screen navigation, and
// running compiled Blockly action scripts (frontend/src/appBuilderBlock/) —
// a button's onClick/toggle's onChange/list row tap runs its trigger's
// compiled block workspace via runAction() below. Used both for the
// editor's live preview and the public /apps/:slug runtime page — this is
// the one place "what does a published app actually do" is implemented, so
// both surfaces stay identical. `ComponentVisual` (the per-type content
// renderer) is also exported standalone so the editor's design canvas can
// render true WYSIWYG previews without a second
// implementation.

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export function interpolate(str, vars, scope) {
  if (!str) return '';
  return String(str).replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, path) => {
    const parts = path.split('.');
    const root = parts[0];
    let val;
    if (scope && Object.prototype.hasOwnProperty.call(scope, root)) {
      val = scope[root];
      for (let i = 1; i < parts.length && val != null; i++) val = val[parts[i]];
    } else {
      val = vars ? vars[root] : undefined;
    }
    if (val === undefined || val === null) return '';
    return typeof val === 'object' ? JSON.stringify(val) : String(val);
  });
}

// Resolves whether a component should render at all: an imperative
// `set_visibility` action override (free) wins if one has been fired for
// this component id; otherwise a declarative `visible_if` condition
// (Vakar+ — see _check_component_tier in studio_apps.py) is evaluated
// against the current vars; with neither, it's visible.
function resolveVisible(node, vars, visibilityOverrides) {
  const override = visibilityOverrides ? visibilityOverrides[node.id] : undefined;
  if (override !== undefined) return override;
  const cond = node.visible_if;
  if (!cond?.variable) return true;
  const current = vars ? vars[cond.variable] : undefined;
  switch (cond.op) {
    case 'eq': return String(current ?? '') === String(cond.value ?? '');
    case 'neq': return String(current ?? '') !== String(cond.value ?? '');
    case 'gt': return (Number(current) || 0) > (Number(cond.value) || 0);
    case 'lt': return (Number(current) || 0) < (Number(cond.value) || 0);
    case 'truthy': return !!current && current !== '0' && current !== 'false';
    default: return true;
  }
}

// Generates its own QR image client-side (same `qrcode` package + pattern
// as the APK-download QR in AppBuilderEditor.js) — a small sub-component
// since QRCode.toDataURL is async and hooks can't live inline in a switch.
function QrVisual({ content, theme }) {
  const [dataUrl, setDataUrl] = useState('');
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(content || ' ', { width: 300, margin: 1 })
      .then(url => { if (!cancelled) setDataUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [content]);
  if (!dataUrl) return <div style={{ width: '100%', height: '100%', background: theme.colors.surface, border: `1px dashed ${theme.colors.border}` }} />;
  return <img src={dataUrl} alt="QR code" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
}

// Minimal, dependency-free formatting for the Rich Text component: **bold**
// and [label](url) links only, in that priority order — not full Markdown.
// Mirrored as plain-string HTML in exportApp.js's resolveRichText for the
// static export (React elements can't cross that boundary, only the same
// parsing logic can).
function renderRichText(text) {
  const nodes = [];
  let rest = text || '';
  let key = 0;
  const pattern = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/;
  while (rest) {
    const m = pattern.exec(rest);
    if (!m) { nodes.push(rest); break; }
    if (m.index > 0) nodes.push(rest.slice(0, m.index));
    if (m[1] !== undefined) {
      nodes.push(<strong key={key++}>{m[1]}</strong>);
    } else {
      // Content can come from a Data record another visitor typed (via
      // blocks) — reject non-http(s) schemes so a "link" can't smuggle a
      // javascript: URI that runs on click.
      const safeHref = /^https?:\/\//i.test(m[3]) ? m[3] : '#';
      nodes.push(<a key={key++} href={safeHref} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>{m[2]}</a>);
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return nodes;
}

// Own local expand/collapse state — same reason QrVisual below is its own
// component instead of an inline case (ComponentVisual itself stays
// hook-free so a switch-case can never violate the rules of hooks).
// Collapsed shows just the header; expanded fills the rest of this
// component's own box (its layout.h) with a scrollable content area —
// there's no "grow past your assigned box" in this absolute-positioned
// canvas, so size the box tall enough for the open state.
function AccordionVisual({ node, vars, theme }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ width: '100%', height: '100%', border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius * 0.6, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: theme.colors.text, fontFamily: FONT_STACK }}
      >
        <span>{interpolate(node.props?.title, vars) || 'Section title'}</span>
        <span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', display: 'flex', flexShrink: 0 }}>
          <AppIcon id="chevronDown" size={14} color={theme.colors.textMuted} />
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 12px 12px', fontSize: 13, color: theme.colors.textMuted, lineHeight: 1.5, overflowY: 'auto', flex: 1 }}>
          {interpolate(node.props?.content, vars)}
        </div>
      )}
    </div>
  );
}

// Ticks every second while mounted — same isolation reasoning as
// AccordionVisual above.
function CountdownVisual({ node, vars, theme }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const targetStr = interpolate(node.props?.target_date, vars);
  const target = targetStr ? new Date(targetStr).getTime() : NaN;
  const reached = !Number.isFinite(target);
  const diff = reached ? 0 : Math.max(0, target - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  const label = node.props?.label ? interpolate(node.props.label, vars) : '';
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      {label && <span style={{ fontSize: 11, color: theme.colors.textMuted }}>{label}</span>}
      <span style={{ fontSize: 20, fontWeight: 700, color: theme.colors.text, fontVariantNumeric: 'tabular-nums', fontFamily: FONT_STACK }}>
        {reached ? '—' : `${days}d ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
      </span>
    </div>
  );
}

function buttonStyle(theme, style) {
  switch (style) {
    case 'secondary':
      return { background: `${theme.colors.primary}1a`, color: theme.colors.primary, border: `1px solid ${theme.colors.primary}40` };
    case 'outline':
      return { background: 'transparent', color: theme.colors.text, border: `1px solid ${theme.colors.border}` };
    default:
      return { background: theme.colors.primary, color: theme.colors.primaryText, border: `1px solid ${theme.colors.primary}`, boxShadow: `0 6px 16px -6px ${theme.colors.primary}80` };
  }
}

// Renders a single component's content, filling 100% of whatever box it's
// placed in (the box itself — position/size — is the caller's job, see
// PositionedNode below and AppBuilderEditor.js's design canvas). `vars`/
// `setVars`/`runAction` can be omitted for a static, non-interactive
// preview (the editor canvas does this — clicking a button there should
// select it, not navigate).
export function ComponentVisual({ node, vars = {}, setVars, runAction, theme, overrides = {}, visibilityOverrides = {} }) {
  if (!node) return null;
  const interactive = typeof setVars === 'function';
  const override = overrides[node.id];
  switch (node.type) {
    case 'text':
      return (
        <p style={{
          margin: 0, width: '100%', height: '100%', fontSize: resolveTextSizePx(node.props),
          fontWeight: node.props?.weight === 'bold' ? 700 : 400,
          textAlign: node.props?.align || 'left', color: node.props?.color || theme.colors.text,
          lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflow: 'hidden',
        }}>
          {override !== undefined ? override : interpolate(node.props?.content, vars)}
        </p>
      );
    case 'button':
      return (
        <button
          onClick={() => runAction && runAction(node, 'ab_when_clicked')}
          onPointerDown={() => runAction && runAction(node, 'ab_when_pressed')}
          onPointerUp={() => runAction && runAction(node, 'ab_when_released')}
          style={{
            ...buttonStyle(theme, node.props?.style),
            width: '100%', height: '100%', borderRadius: theme.radius * 0.7, fontSize: 14, fontWeight: 600,
            cursor: interactive ? 'pointer' : 'default', fontFamily: FONT_STACK,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {node.props?.icon && <AppIcon id={node.props.icon} size={16} color="currentColor" />}
          {(override !== undefined ? override : interpolate(node.props?.label, vars)) || 'Button'}
        </button>
      );
    case 'image':
      return node.props?.url ? (
        <img
          src={node.props.url.startsWith('/') ? `${API}${node.props.url}` : node.props.url}
          alt=""
          style={{
            width: '100%', height: '100%', objectFit: node.props?.fit || 'cover', borderRadius: node.props?.radius ?? 12,
            border: node.props?.border ? `1px solid ${theme.colors.border}` : 'none', boxSizing: 'border-box', display: 'block',
          }}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%', borderRadius: node.props?.radius ?? 12,
          background: theme.colors.surface, border: `1px dashed ${theme.colors.border}`,
        }} />
      );
    case 'input': {
      const bound = !!node.props?.variable;
      const multiline = node.props?.input_type === 'multiline';
      const type = node.props?.input_type === 'number' ? 'number' : 'text';
      const maxLength = node.props?.max_length || undefined;
      const style = {
        width: '100%', height: '100%', padding: multiline ? '8px 12px' : '0 12px', borderRadius: theme.radius * 0.6, border: `1px solid ${theme.colors.border}`,
        fontSize: 14, boxSizing: 'border-box', fontFamily: FONT_STACK, background: bound ? theme.colors.surface : `${theme.colors.border}30`,
        color: theme.colors.text, resize: 'none',
      };
      if (!bound || !interactive) {
        return multiline
          ? <textarea placeholder={node.props?.placeholder} style={style} disabled title="This input isn't bound to a variable yet" maxLength={maxLength} />
          : <input type={type} placeholder={node.props?.placeholder} style={style} disabled title="This input isn't bound to a variable yet" maxLength={maxLength} />;
      }
      const commonProps = {
        placeholder: node.props?.placeholder,
        value: vars[node.props.variable] ?? '',
        onChange: e => setVars(v => ({ ...v, [node.props.variable]: e.target.value })),
        style, maxLength,
      };
      return multiline ? <textarea {...commonProps} /> : <input type={type} {...commonProps} />;
    }
    case 'toggle': {
      const bound = !!node.props?.variable;
      const on = vars[node.props?.variable] === 'true';
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: '100%', gap: 12 }}>
          <span style={{ fontSize: 14, color: theme.colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(override !== undefined ? override : interpolate(node.props?.label, vars)) || 'Toggle'}</span>
          <button
            disabled={!bound || !interactive}
            onClick={() => {
              if (!interactive || !bound) return;
              const next = vars[node.props.variable] === 'true' ? 'false' : 'true';
              setVars(v => ({ ...v, [node.props.variable]: next }));
              runAction && runAction(node, 'ab_when_changed');
            }}
            style={{
              width: 42, height: 24, borderRadius: 12, border: 'none', cursor: (bound && interactive) ? 'pointer' : 'default',
              position: 'relative', background: on ? theme.colors.primary : theme.colors.border, transition: 'background 0.2s',
              padding: 0, flexShrink: 0, opacity: bound ? 1 : 0.5,
            }}
          >
            <span style={{
              position: 'absolute', top: 2, left: on ? 20 : 2, width: 20, height: 20, borderRadius: '50%',
              background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
            }} />
          </button>
        </div>
      );
    }
    case 'icon':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AppIcon id={node.props?.icon || 'star'} size="100%" color={node.props?.color || theme.colors.text} />
        </div>
      );
    case 'list': {
      const raw = vars[node.props?.source_variable];
      let items = [];
      if (raw) {
        try {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (Array.isArray(parsed)) items = parsed;
        } catch { /* not valid JSON — render as empty */ }
      }
      if (items.length === 0) {
        return <p style={{ margin: 0, width: '100%', height: '100%', fontSize: 13, color: theme.colors.textMuted }}>{node.props?.empty_text || 'No items yet.'}</p>;
      }
      const imageTemplate = node.props?.item_image_template;
      const isGrid = node.props?.layout_mode === 'grid';
      const columns = Math.max(1, Number(node.props?.grid_columns) || 2);
      return (
        <div
          style={
            isGrid
              ? { display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 10, width: '100%', height: '100%', overflowY: 'auto', alignContent: 'start' }
              : { display: 'flex', flexDirection: 'column', gap: 8, width: '100%', height: '100%', overflowY: 'auto' }
          }
        >
          {items.slice(0, 50).map((item, i) => {
            const imgSrc = imageTemplate ? interpolate(imageTemplate, vars, { item }) : '';
            const text = interpolate(node.props?.item_template, vars, { item });
            // Whether this row is "tappable" no longer depends on knowing
            // ahead of time if a real "when a row is tapped" hat exists —
            // runAction() itself no-ops harmlessly if it doesn't, same as a
            // button with nothing wired to "when clicked" (see its own
            // unconditional `cursor: interactive ? 'pointer' : 'default'`).
            const clickable = interactive;
            const onClick = () => { if (clickable && runAction) runAction(node, 'ab_when_row_tapped', { item, index: i }); };
            if (isGrid) {
              return (
                <div
                  key={i} onClick={onClick}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    cursor: clickable ? 'pointer' : 'default',
                  }}
                >
                  {imgSrc && (
                    <img src={imgSrc} alt="" style={{ width: '100%', aspectRatio: '0.79', objectFit: 'contain', borderRadius: 12 }} />
                  )}
                  {text && <span style={{ fontSize: 12, color: theme.colors.text, textAlign: 'center' }}>{text}</span>}
                </div>
              );
            }
            return (
              <div
                key={i}
                onClick={onClick}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: theme.radius * 0.7, background: theme.colors.surface,
                  border: `1px solid ${theme.colors.border}`, fontSize: 13, color: theme.colors.text, flexShrink: 0,
                  cursor: clickable ? 'pointer' : 'default',
                }}
              >
                {imgSrc && (
                  <img src={imgSrc} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                )}
                <span>{text}</span>
              </div>
            );
          })}
        </div>
      );
    }
    case 'checkbox': {
      const bound = !!node.props?.variable;
      const checked = vars[node.props?.variable] === 'true';
      return (
        <div
          onClick={() => {
            if (!interactive || !bound) return;
            setVars(v => ({ ...v, [node.props.variable]: checked ? 'false' : 'true' }));
            runAction && runAction(node, 'ab_when_changed');
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', height: '100%', cursor: (bound && interactive) ? 'pointer' : 'default', opacity: bound ? 1 : 0.5 }}
        >
          <div style={{
            width: 20, height: 20, borderRadius: 5, flexShrink: 0, border: `1.5px solid ${checked ? theme.colors.primary : theme.colors.border}`,
            background: checked ? theme.colors.primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {checked && <AppIcon id="check" size={13} color={theme.colors.primaryText} strokeWidth={3} />}
          </div>
          <span style={{ fontSize: 14, color: theme.colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {interpolate(node.props?.label, vars) || 'Checkbox'}
          </span>
        </div>
      );
    }
    case 'rating': {
      const bound = !!node.props?.variable;
      const max = Math.max(1, Number(node.props?.max) || 5);
      const value = Number(vars[node.props?.variable]) || 0;
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', height: '100%' }}>
          {Array.from({ length: max }, (_, i) => i + 1).map(n => (
            <button
              key={n} disabled={!bound || !interactive}
              onClick={() => {
                setVars(v => ({ ...v, [node.props.variable]: String(n) }));
                runAction && runAction(node, 'ab_when_changed');
              }}
              style={{ background: 'none', border: 'none', padding: 0, cursor: (bound && interactive) ? 'pointer' : 'default', lineHeight: 0 }}
            >
              <AppIcon id="star" size={22} color={n <= value ? (node.props?.color || theme.colors.primary) : theme.colors.border} />
            </button>
          ))}
        </div>
      );
    }
    case 'progress': {
      const bound = !!node.props?.variable;
      const raw = bound ? Number(vars[node.props.variable]) : Number(node.props?.value);
      const pct = Math.max(0, Math.min(100, Number.isFinite(raw) ? raw : 0));
      return (
        <div style={{ width: '100%', height: '100%', borderRadius: 999, background: theme.colors.border, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: theme.colors.primary, transition: 'width 0.2s' }} />
        </div>
      );
    }
    case 'qr':
      return <QrVisual content={interpolate(node.props?.content, vars)} theme={theme} />;
    case 'slider': {
      const bound = !!node.props?.variable;
      const min = Number(node.props?.min) || 0, max = Number(node.props?.max) || 100, step = Number(node.props?.step) || 1;
      const value = Number(vars[node.props?.variable]) || min;
      return (
        <input
          type="range" min={min} max={max} step={step} value={value} disabled={!bound || !interactive}
          onChange={e => {
            setVars(v => ({ ...v, [node.props.variable]: e.target.value }));
            // Fires on every drag tick (native range `input` events are
            // continuous) — fine for the common case (set another variable,
            // show/hide something) but worth remembering if it's ever wired
            // to something expensive.
            runAction && runAction(node, 'ab_when_changed');
          }}
          style={{ width: '100%', accentColor: theme.colors.primary, opacity: bound ? 1 : 0.5 }}
        />
      );
    }
    case 'date': {
      const bound = !!node.props?.variable;
      const style = {
        width: '100%', height: '100%', padding: '0 12px', borderRadius: theme.radius * 0.6, border: `1px solid ${theme.colors.border}`,
        fontSize: 14, boxSizing: 'border-box', fontFamily: FONT_STACK, background: bound ? theme.colors.surface : `${theme.colors.border}30`, color: theme.colors.text,
      };
      if (!bound || !interactive) return <input type="date" style={style} disabled title="This input isn't bound to a variable yet" />;
      return (
        <input
          type="date" value={vars[node.props.variable] || ''}
          onChange={e => {
            setVars(v => ({ ...v, [node.props.variable]: e.target.value }));
            runAction && runAction(node, 'ab_when_changed');
          }}
          style={style}
        />
      );
    }
    case 'video':
      return node.props?.url ? (
        <video src={node.props.url} controls style={{ width: '100%', height: '100%', borderRadius: 8, background: '#000', objectFit: 'contain' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', borderRadius: 8, background: theme.colors.surface, border: `1px dashed ${theme.colors.border}` }} />
      );
    case 'webview':
      return node.props?.url ? (
        <iframe src={node.props.url} title="Embedded content" style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }} sandbox="allow-scripts allow-forms allow-same-origin allow-popups" />
      ) : (
        <div style={{ width: '100%', height: '100%', borderRadius: 8, background: theme.colors.surface, border: `1px dashed ${theme.colors.border}` }} />
      );
    case 'container': {
      const bg = node.props?.background === 'surface' ? theme.colors.surface
        : (node.props?.background && node.props.background !== 'none' ? node.props.background : 'transparent');
      return (
        <div style={{
          position: 'relative', width: '100%', height: '100%',
          background: bg,
          border: node.props?.border ? `1px solid ${theme.colors.border}` : 'none',
          borderRadius: node.props?.radius ?? 0,
          boxShadow: node.props?.shadow ? '0 10px 30px -12px rgba(0,0,0,0.18)' : 'none',
          opacity: (node.props?.opacity ?? 100) / 100,
          boxSizing: 'border-box', overflow: 'hidden',
        }}>
          {(node.children || []).map((child, i) => (
            <PositionedNode key={child.id} node={child} index={i} vars={vars} setVars={setVars} runAction={runAction} theme={theme} overrides={overrides} visibilityOverrides={visibilityOverrides} />
          ))}
        </div>
      );
    }
    case 'divider':
      // The box (layout.h) is a taller click/drag hitbox than the visual
      // rule itself — see DEFAULT_LAYOUT.divider's comment.
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '100%', height: 2, background: theme.colors.border }} />
        </div>
      );
    case 'spacer':
      return <div style={{ width: '100%', height: '100%' }} />;
    case 'select': {
      const bound = !!node.props?.variable;
      const options = (node.props?.options || '').split(',').map(s => s.trim()).filter(Boolean);
      const style = {
        width: '100%', height: '100%', padding: '0 12px', borderRadius: theme.radius * 0.6, border: `1px solid ${theme.colors.border}`,
        fontSize: 14, boxSizing: 'border-box', fontFamily: FONT_STACK, background: bound ? theme.colors.surface : `${theme.colors.border}30`,
        color: theme.colors.text,
      };
      if (!bound || !interactive) {
        return <select style={style} disabled title="This dropdown isn't bound to a variable yet"><option>{node.props?.placeholder || 'Choose…'}</option></select>;
      }
      return (
        <select
          value={vars[node.props.variable] ?? ''}
          onChange={e => { setVars(v => ({ ...v, [node.props.variable]: e.target.value })); runAction && runAction(node, 'ab_when_changed'); }}
          style={style}
        >
          <option value="" disabled>{node.props?.placeholder || 'Choose…'}</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    case 'search': {
      const bound = !!node.props?.variable;
      const style = {
        width: '100%', height: '100%', padding: '0 12px 0 34px', borderRadius: 999, border: `1px solid ${theme.colors.border}`,
        fontSize: 14, boxSizing: 'border-box', fontFamily: FONT_STACK, background: bound ? theme.colors.surface : `${theme.colors.border}30`,
        color: theme.colors.text,
      };
      return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>
            <AppIcon id="search" size={15} color={theme.colors.textMuted} />
          </div>
          {(!bound || !interactive) ? (
            <input type="search" placeholder={node.props?.placeholder} style={style} disabled title="This search bar isn't bound to a variable yet" />
          ) : (
            <input
              type="search" placeholder={node.props?.placeholder}
              value={vars[node.props.variable] ?? ''}
              onChange={e => { setVars(v => ({ ...v, [node.props.variable]: e.target.value })); runAction && runAction(node, 'ab_when_changed'); }}
              style={style}
            />
          )}
        </div>
      );
    }
    case 'radio': {
      const bound = !!node.props?.variable;
      const options = (node.props?.options || '').split(',').map(s => s.trim()).filter(Boolean);
      const selected = vars[node.props?.variable];
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', height: '100%', overflowY: 'auto' }}>
          {options.map(o => (
            <div
              key={o}
              onClick={() => {
                if (!bound || !interactive) return;
                setVars(v => ({ ...v, [node.props.variable]: o }));
                runAction && runAction(node, 'ab_when_changed');
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: (bound && interactive) ? 'pointer' : 'default', opacity: bound ? 1 : 0.5 }}
            >
              <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, border: `1.5px solid ${selected === o ? theme.colors.primary : theme.colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {selected === o && <div style={{ width: 10, height: 10, borderRadius: '50%', background: theme.colors.primary }} />}
              </div>
              <span style={{ fontSize: 14, color: theme.colors.text }}>{o}</span>
            </div>
          ))}
        </div>
      );
    }
    case 'stepper': {
      const bound = !!node.props?.variable;
      const min = Number(node.props?.min) || 0, max = Number(node.props?.max) || 100, step = Number(node.props?.step) || 1;
      const value = Number(vars[node.props?.variable]) || min;
      const change = (delta) => {
        if (!bound || !interactive) return;
        const next = Math.max(min, Math.min(max, value + delta));
        setVars(v => ({ ...v, [node.props.variable]: String(next) }));
        runAction && runAction(node, 'ab_when_changed');
      };
      const btnStyle = { width: 36, height: '100%', border: 'none', background: 'none', cursor: (bound && interactive) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.colors.text };
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: '100%', border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius * 0.6, opacity: bound ? 1 : 0.5, boxSizing: 'border-box' }}>
          <button disabled={!bound || !interactive} onClick={() => change(-step)} style={btnStyle}><AppIcon id="minus" size={14} color="currentColor" /></button>
          <span style={{ fontSize: 14, color: theme.colors.text, fontWeight: 600 }}>{value}</span>
          <button disabled={!bound || !interactive} onClick={() => change(step)} style={btnStyle}><AppIcon id="plus" size={14} color="currentColor" /></button>
        </div>
      );
    }
    case 'chart': {
      const raw = vars[node.props?.source_variable];
      let items = [];
      if (raw) {
        try { const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; if (Array.isArray(parsed)) items = parsed; } catch { /* not valid JSON */ }
      }
      if (items.length === 0) {
        return <p style={{ margin: 0, width: '100%', height: '100%', fontSize: 13, color: theme.colors.textMuted }}>No data yet.</p>;
      }
      const labelField = node.props?.label_field || 'label';
      const valueField = node.props?.value_field || 'value';
      const values = items.map(it => Number(it?.[valueField]) || 0);
      const maxVal = Math.max(1, ...values);
      const color = node.props?.color || theme.colors.primary;
      return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, width: '100%', height: '100%' }}>
          {items.slice(0, 12).map((it, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ width: '100%', maxWidth: 28, height: `${Math.max(2, (values[i] / maxVal) * 100)}%`, background: color, borderRadius: '4px 4px 0 0' }} />
              <span style={{ fontSize: 9, color: theme.colors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{String(it?.[labelField] ?? '')}</span>
            </div>
          ))}
        </div>
      );
    }
    case 'avatar': {
      const url = interpolate(node.props?.url, vars);
      const initials = interpolate(node.props?.initials, vars);
      const bg = node.props?.color || theme.colors.primary;
      return (
        <div
          onClick={() => runAction && runAction(node, 'ab_when_clicked')}
          style={{
            width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: url ? 'transparent' : bg, cursor: interactive ? 'pointer' : 'default', flexShrink: 0,
          }}
        >
          {url ? (
            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ color: theme.colors.primaryText, fontSize: 16, fontWeight: 700 }}>{(initials || '?').slice(0, 2).toUpperCase()}</span>
          )}
        </div>
      );
    }
    case 'map': {
      const lat = Number(interpolate(node.props?.latitude, vars)) || 48.8566;
      const lon = Number(interpolate(node.props?.longitude, vars)) || 2.3522;
      const delta = 0.01 * (21 - Math.max(1, Math.min(19, Number(node.props?.zoom) || 14)));
      const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
      const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&marker=${encodeURIComponent(`${lat},${lon}`)}`;
      return <iframe src={src} title="Map" style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }} />;
    }
    case 'bottomnav': {
      const items = Array.isArray(node.props?.items) ? node.props.items : [];
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', width: '100%', height: '100%', background: theme.colors.surface, borderTop: `1px solid ${theme.colors.border}`, boxSizing: 'border-box' }}>
          {items.map((it, i) => (
            <div
              key={i}
              onClick={() => runAction && runAction(node, 'ab_when_row_tapped', { item: it, index: i })}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: interactive ? 'pointer' : 'default', color: theme.colors.text, flex: 1 }}
            >
              <AppIcon id={it?.icon || 'star'} size={18} color={theme.colors.text} />
              <span style={{ fontSize: 10 }}>{it?.label}</span>
            </div>
          ))}
        </div>
      );
    }
    case 'appbar':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', height: '100%', background: theme.colors.surface, borderBottom: `1px solid ${theme.colors.border}`, padding: '0 12px', boxSizing: 'border-box' }}>
          {node.props?.show_back && (
            <button
              onClick={() => runAction && runAction(node, 'ab_when_clicked')}
              style={{ background: 'none', border: 'none', padding: 0, cursor: interactive ? 'pointer' : 'default', display: 'flex', color: theme.colors.text, transform: 'rotate(180deg)' }}
            >
              <AppIcon id="arrowRight" size={18} color="currentColor" />
            </button>
          )}
          <span style={{ fontSize: 16, fontWeight: 700, color: theme.colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {interpolate(node.props?.title, vars) || 'Title'}
          </span>
        </div>
      );
    case 'fab':
      return (
        <button
          onClick={() => runAction && runAction(node, 'ab_when_clicked')}
          style={{
            width: '100%', height: '100%', borderRadius: '50%', border: 'none', cursor: interactive ? 'pointer' : 'default',
            background: node.props?.color || theme.colors.primary, color: theme.colors.primaryText,
            display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 20px -6px ${theme.colors.primary}80`,
          }}
        >
          <AppIcon id={node.props?.icon || 'plus'} size={22} color="currentColor" />
        </button>
      );
    case 'richtext':
      return (
        <p style={{ margin: 0, width: '100%', height: '100%', fontSize: 14, lineHeight: 1.5, color: theme.colors.text, textAlign: node.props?.align || 'left', whiteSpace: 'pre-wrap', overflow: 'auto' }}>
          {renderRichText(interpolate(node.props?.content, vars))}
        </p>
      );
    case 'carousel': {
      const raw = vars[node.props?.source_variable];
      let items = [];
      if (raw) {
        try { const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; if (Array.isArray(parsed)) items = parsed; } catch { /* not valid JSON */ }
      }
      if (items.length === 0) {
        return <div style={{ width: '100%', height: '100%', borderRadius: 8, background: theme.colors.surface, border: `1px dashed ${theme.colors.border}` }} />;
      }
      const imageField = node.props?.image_field || 'image';
      return (
        <div style={{ display: 'flex', gap: 8, width: '100%', height: '100%', overflowX: 'auto' }}>
          {items.slice(0, 30).map((it, i) => (
            <img
              key={i} src={it?.[imageField]} alt=""
              onClick={() => runAction && runAction(node, 'ab_when_row_tapped', { item: it, index: i })}
              style={{ height: '100%', flexShrink: 0, borderRadius: 8, objectFit: 'cover', cursor: interactive ? 'pointer' : 'default' }}
            />
          ))}
        </div>
      );
    }
    case 'accordion':
      return <AccordionVisual node={node} vars={vars} theme={theme} />;
    case 'audio':
      return node.props?.url ? (
        <audio src={node.props.url} controls style={{ width: '100%' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', borderRadius: 8, background: theme.colors.surface, border: `1px dashed ${theme.colors.border}` }} />
      );
    case 'filepicker': {
      const bound = !!node.props?.variable;
      const inputId = `vk-filepicker-${node.id}`;
      return (
        <div style={{ width: '100%', height: '100%' }}>
          <label
            htmlFor={(bound && interactive) ? inputId : undefined}
            style={{
              width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: theme.radius * 0.6, border: `1px dashed ${theme.colors.border}`, fontSize: 13, color: theme.colors.text,
              cursor: (bound && interactive) ? 'pointer' : 'default', opacity: bound ? 1 : 0.5, boxSizing: 'border-box',
            }}
          >
            {node.props?.label || 'Choose file'}
          </label>
          {bound && interactive && (
            <input
              id={inputId} type="file" style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  setVars(v => ({ ...v, [node.props.variable]: String(reader.result || '') }));
                  runAction && runAction(node, 'ab_when_changed');
                };
                reader.readAsDataURL(file);
              }}
            />
          )}
        </div>
      );
    }
    case 'countdown':
      return <CountdownVisual node={node} vars={vars} theme={theme} />;
    case 'badge':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ padding: '4px 10px', borderRadius: 999, background: node.props?.color || theme.colors.primary, color: theme.colors.primaryText, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {interpolate(node.props?.text, vars) || 'NEW'}
          </span>
        </div>
      );
    default:
      return null;
  }
}

// Absolute-positions a component within its parent (the screen canvas, or
// a container) using its own `layout` (falls back to a sane per-type
// default for older data saved before free positioning existed).
export function PositionedNode({ node, index = 0, vars, setVars, runAction, theme, overrides, visibilityOverrides }) {
  const l = getLayout(node, index);
  if (!resolveVisible(node, vars, visibilityOverrides)) return null;
  const animation = node.props?.animation;
  const animClass = animation && animation !== 'none' ? `vk-anim-${animation}` : '';
  return (
    <div className={animClass} style={{ position: 'absolute', left: l.x, top: l.y, width: l.w, height: l.h }}>
      <ComponentVisual node={node} vars={vars} setVars={setVars} runAction={runAction} theme={theme} overrides={overrides} visibilityOverrides={visibilityOverrides} />
    </div>
  );
}

// A top-level component with layout.anchors (bottom nav bars, app bars,
// FABs — see the Anchors inspector section in AppBuilderEditor.js) is
// positioned here instead, against the REAL device viewport rather than
// the fixed CANVAS_WIDTH/CANVAS_HEIGHT reference frame every other
// component is scaled/letterboxed within (see AppRuntime below) — that's
// the whole point: a bar anchored to both left+right genuinely stretches
// to the true screen edge on any device, not just the design canvas's own
// 360px width. Plain CSS left/right/top/bottom does all the work; no
// resize-observer/JS math needed for this to "just work" on any screen
// size — both edges set on an axis makes the browser compute that
// dimension itself, so width/height is only set explicitly when just one
// edge on that axis is pinned (keeping the component's own designed size).
function AnchoredNode({ node, vars, setVars, runAction, theme, overrides, visibilityOverrides }) {
  if (!resolveVisible(node, vars, visibilityOverrides)) return null;
  const a = node.layout?.anchors || {};
  const l = getLayout(node);
  const style = { position: 'absolute', pointerEvents: 'auto' };
  if (a.left != null) style.left = a.left;
  if (a.right != null) style.right = a.right;
  if (a.top != null) style.top = a.top;
  if (a.bottom != null) style.bottom = a.bottom;
  if (!(a.left != null && a.right != null)) style.width = l.w;
  if (!(a.top != null && a.bottom != null)) style.height = l.h;
  const animation = node.props?.animation;
  const animClass = animation && animation !== 'none' ? `vk-anim-${animation}` : '';
  return (
    <div className={animClass} style={style}>
      <ComponentVisual node={node} vars={vars} setVars={setVars} runAction={runAction} theme={theme} overrides={overrides} visibilityOverrides={visibilityOverrides} />
    </div>
  );
}

export default function AppRuntime({ app, token, className = '', showWatermark = false }) {
  const theme = useMemo(() => resolveTheme(app?.theme), [app?.theme]);
  const screens = useMemo(() => app?.screens || [], [app]);
  const [screenId, setScreenId] = useState(screens[0]?.id);
  const [vars, setVars] = useState(() => Object.fromEntries((app?.variables || []).map(v => [v.name, v.initial_value ?? ''])));
  const [overrides, setOverrides] = useState({});
  const [visibilityOverrides, setVisibilityOverrides] = useState({});
  const [message, setMessage] = useState(null);
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);

  const screen = useMemo(() => screens.find(s => s.id === screenId) || screens[0], [screens, screenId]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const compute = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (w > 0 && h > 0) setScale(Math.min(w / CANVAS_WIDTH, h / CANVAS_HEIGHT));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const flash = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 3200);
  };

  // vars is read/written through a local snapshot (not React state directly)
  // since blocks commonly chain off one another within the same click (e.g.
  // "add 1 to coins" then "update text1 with coins") and must see each
  // other's just-written value without waiting for a re-render — same
  // reasoning the old flat-action interpreter used `currentVars` for.
  // `scope` is only set for a list row's tap, read by the "This item"
  // blocks (ab_item/ab_item_field/ab_item_index in appBuilderBlock/).
  const variableNames = useMemo(() => (app?.variables || []).map(v => v.name), [app]);
  // Keyed by workspace JSON (one per element/screen), value is the
  // {hatType: compiledFn} map compileNodeBlocks() returns — so switching
  // between a button's "when clicked"/"when pressed"/"when released" only
  // ever compiles that button's workspace once, not once per hat.
  const compileCacheRef = useRef(new WeakMap());
  const host = useMemo(() => ({
    screens,
    setScreen: setScreenId,
    updateText: (id, value) => setOverrides(o => ({ ...o, [id]: value })),
    setVisibility: (id, mode) => setVisibilityOverrides(o => {
      const cur = o[id];
      const next = mode === 'toggle' ? (cur === undefined ? false : !cur) : mode === 'show';
      return { ...o, [id]: next };
    }),
    flash,
    now: () => Date.now(),
    initialVars: Object.fromEntries((app?.variables || []).map(v => [v.name, v.initial_value ?? ''])),
    // Namespaces localStorage keys (Storage blocks) per app — every app's
    // live preview here shares the admin dashboard's own origin, so without
    // this, two different apps' "save value" blocks would read/overwrite
    // each other's data. The exported static bundle (exportApp.js) each get
    // their own real domain in production, where this matters less but is
    // harmless to keep for consistency.
    storagePrefix: `vkstore:${app?.slug || app?.id || 'app'}:`,
    // Network (fetch) blocks run inside a sandboxed, opaque-origin iframe —
    // see appBuilderBlock/sandboxFetch.js — so they can never read this
    // page's cookies/localStorage (this preview shares vakargames.com's own
    // origin with the logged-in user's session), regardless of what URL a
    // block is told to call.
    sandboxFetch,
    // Real decrypted values on the public app-play page (get_public_studio_app
    // includes them there — see studio_apps.py). The editor's own Preview
    // modal passes them in separately (AppBuilderEditor.js fetches its own
    // app's secrets via the owner-only endpoint) since the general app-load
    // response never includes decrypted values.
    secrets: app?.secrets || {},
    // Data blocks talk to OUR OWN backend (not an arbitrary external URL),
    // scoped by this app's own id/collection name — unlike sandboxFetch,
    // there's no ambient-session risk in calling it directly, and sending
    // the owner's token (when present) is what lets the editor's own
    // Preview reach a private/unpublished app's data.
    dataRequest: (method, collection, recordId, fields, appSessionToken) => {
      const appKey = app?.public_id || app?.slug || '';
      const base = `${API}/api/apps/${encodeURIComponent(appKey)}/data/${encodeURIComponent(collection)}`;
      const url = recordId ? `${base}/${encodeURIComponent(recordId)}` : base;
      return fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          // Two different, unrelated tokens can both be present on a write:
          // Authorization carries the logged-in Vakar Games site session
          // (only used so the owner's own editor Preview can reach a
          // private/unpublished app's data), X-App-Session carries the
          // Studio App's own in-app account session (required to write —
          // see studio_data.py) — never conflated into the same header.
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(appSessionToken ? { 'X-App-Session': appSessionToken } : {}),
        },
        body: fields !== undefined ? JSON.stringify({ fields }) : undefined,
      }).then(r => r.json());
    },
    // In-app accounts — a Studio App's own end-user login/signup, separate
    // from the logged-in Vakar Games session (`token` above is that site
    // session, only ever sent to dataRequest above; accountRequest's token
    // param is the app-specific session accountLogin/Signup returns).
    accountRequest: (path, body, appSessionToken) => {
      const appKey = app?.public_id || app?.slug || '';
      const url = `${API}/api/apps/${encodeURIComponent(appKey)}/accounts/${path}`;
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(appSessionToken ? { Authorization: `Bearer ${appSessionToken}` } : {}) },
        body: body != null ? JSON.stringify(body) : undefined,
      }).then(r => r.json());
    },
    loadStoredSession: () => {
      try {
        const raw = localStorage.getItem(`vkuser:${app?.slug || app?.id || 'app'}:session`);
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    },
    saveStoredSession: (nextSession) => {
      try {
        const key = `vkuser:${app?.slug || app?.id || 'app'}:session`;
        if (nextSession) localStorage.setItem(key, JSON.stringify(nextSession));
        else localStorage.removeItem(key);
      } catch { /* storage unavailable */ }
    },
    // Web Push — NOT Firebase/APNs, standard browser Push API (VAPID). Works
    // in real browsers and here on the public app-play page; support inside
    // an exported/APK app's WebView is real but not universal on Android and
    // absent entirely on iOS (WKWebView has no Push API) — pushSubscribe()
    // resolves false wherever it isn't available, same fail-quiet
    // convention as every other capability check in this runtime.
    pushSubscribe: async (sessionToken) => {
      try {
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
        const appKey = app?.public_id || app?.slug || '';
        const reg = await navigator.serviceWorker.register('/vk-push-sw.js');
        const keyRes = await fetch(`${API}/api/apps/${encodeURIComponent(appKey)}/push/vapid-public-key`);
        const { key } = await keyRes.json();
        let sub = await reg.pushManager.getSubscription();
        if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
        await fetch(`${API}/api/apps/${encodeURIComponent(appKey)}/push/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}) },
          body: JSON.stringify(sub.toJSON()),
        });
        return true;
      } catch {
        return false;
      }
    },
    pushSend: (username, title, pushBody) => {
      const appKey = app?.public_id || app?.slug || '';
      return fetch(`${API}/api/apps/${encodeURIComponent(appKey)}/push/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, title, body: pushBody }),
      }).then(() => {});
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [screens, app, token]);
  const helpers = useMemo(() => createRuntimeHelpers(host), [host]);

  // `node` is a component OR a screen object; `hatType` picks which of its
  // hats to run ('ab_when_clicked'/'ab_when_pressed'/'ab_when_released'/
  // 'ab_when_changed'/'ab_when_row_tapped'/'ab_when_screen_opens') — code
  // NOT chained under a matching hat in that element's workspace is simply
  // never compiled/called (see compileNodeBlocks), exactly like Scratch/MIT
  // App Inventor.
  const runAction = async (node, hatType, scope) => {
    const isScreen = node === screen;
    const blocklyJson = resolveNodeWorkspace(node, isScreen, variableNames, screen, screens);
    if (!blocklyJson) return;
    const cache = compileCacheRef.current;
    if (!cache.has(blocklyJson)) cache.set(blocklyJson, compileNodeBlocks(blocklyJson));
    const fn = cache.get(blocklyJson)[hatType];
    if (!fn) return;
    const currentVars = { ...vars };
    const setVar = (name, value) => {
      currentVars[name] = value;
      setVars(v => ({ ...v, [name]: value }));
    };
    await fn(currentVars, setVar, scope, helpers);
  };

  // Runs a screen's "when this screen opens" hat (edited via the ⚡ button
  // next to each screen in AppBuilderEditor.js's Screens list) whenever the
  // visible screen changes — including the very first screen shown on
  // mount, matching the natural "just opened" meaning.
  useEffect(() => {
    if (screen) runAction(screen, 'ab_when_screen_opens');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen?.id]);

  if (!screen) {
    return (
      <div className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: theme.colors.textMuted, fontSize: 13, background: theme.colors.background }}>
        No screens yet.
      </div>
    );
  }

  // Anchored top-level components (bottom nav/app bar/FAB, or anything
  // else the author pinned to an edge) render against the real viewport
  // wrapper below, not inside the scaled/letterboxed canvas — see
  // AnchoredNode's comment. Index is preserved from the original array
  // (not the filtered one) so an old, layout-less legacy component's
  // cascade-fallback position (getLayout's index parameter) is unaffected.
  const indexed = (screen.components || []).map((node, i) => ({ node, i }));
  const freeComponents = indexed.filter(({ node }) => !node.layout?.anchors);
  const anchoredComponents = indexed.filter(({ node }) => node.layout?.anchors);

  return (
    <div ref={wrapRef} className={className} style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: theme.colors.background, boxSizing: 'border-box' }}>
      <div style={{
        position: 'relative', width: CANVAS_WIDTH, height: CANVAS_HEIGHT, flexShrink: 0,
        transform: `scale(${scale})`, background: theme.colors.background, overflow: 'hidden', fontFamily: FONT_STACK,
      }}>
        {message && (
          <div style={{
            position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10,
            background: theme.colors.text, color: theme.colors.background, fontSize: 12, fontWeight: 600,
            padding: '8px 12px', borderRadius: theme.radius * 0.7, textAlign: 'center', boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
          }}>
            {message}
          </div>
        )}
        {freeComponents.map(({ node, i }) => (
          <PositionedNode key={node.id} node={node} index={i} vars={vars} setVars={setVars} runAction={runAction} theme={theme} overrides={overrides} visibilityOverrides={visibilityOverrides} />
        ))}
      </div>
      {anchoredComponents.length > 0 && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', fontFamily: FONT_STACK }}>
          {anchoredComponents.map(({ node }) => (
            <AnchoredNode key={node.id} node={node} vars={vars} setVars={setVars} runAction={runAction} theme={theme} overrides={overrides} visibilityOverrides={visibilityOverrides} />
          ))}
        </div>
      )}
      {showWatermark && (
        <a
          href="https://vakargames.com" target="_blank" rel="noopener noreferrer"
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20, textAlign: 'center',
            padding: '5px 0', fontSize: 10, fontWeight: 600, color: theme.colors.textMuted,
            background: `${theme.colors.surface}cc`, textDecoration: 'none', letterSpacing: '0.02em',
          }}
        >
          Made with <span style={{ color: '#EB5757' }}>♥</span> by Vakar
        </a>
      )}
    </div>
  );
}
