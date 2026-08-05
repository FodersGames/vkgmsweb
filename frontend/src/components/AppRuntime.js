import React, { useState, useMemo, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import { resolveTheme, AppIcon, getLayout, CANVAS_WIDTH, CANVAS_HEIGHT, resolveTextSizePx, normalizeActions, UPDATABLE_PROP } from '../constants/appBuilder';

const API = process.env.REACT_APP_BACKEND_URL || '';

// Interprets a Studio App's {screens, variables, theme} into a live,
// running mini-app: theming, local variable state, screen navigation, and
// a small action interpreter (navigate / set_variable / update_text /
// show_message / open_link) — a button's onClick runs an ordered list of
// these (normalizeActions() reads pre-list saves as a one-step list). Used
// both for the editor's live preview and the public /apps/:slug runtime
// page — this is the one place "what does a published app actually do" is
// implemented, so both surfaces stay identical. `ComponentVisual` (the
// per-type content renderer) is also exported standalone so the editor's
// design canvas can render true WYSIWYG previews without a second
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

// Resolves an action's `index` field, which supports {{index}} interpolation
// (the list item_action scope includes it) as well as a plain literal number.
function resolveIndex(raw, currentVars, scope) {
  const n = Number(interpolate(String(raw ?? '0'), currentVars, scope));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

// `calculate`'s A/B fields deliberately don't require {{}} syntax — type a
// bare variable name (e.g. "price") or a literal number, whichever's there
// wins, no punctuation to remember. {{}} interpolation still works too
// (falls through below) for consistency with every other field.
function resolveNumberOrVariable(raw, currentVars, scope) {
  if (raw === undefined || raw === null || raw === '') return 0;
  const str = String(raw);
  const scopeVal = scope && Object.prototype.hasOwnProperty.call(scope, str) ? scope[str] : undefined;
  const varVal = scopeVal !== undefined ? scopeVal : currentVars[str];
  if (varVal !== undefined) return Number(varVal) || 0;
  return Number(interpolate(str, currentVars, scope)) || 0;
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
          onClick={() => runAction && runAction(node.actions?.onClick)}
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
              runAction && runAction(node.actions?.onChange);
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
      const itemAction = node.props?.item_action;
      const imageTemplate = node.props?.item_image_template;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', height: '100%', overflowY: 'auto' }}>
          {items.slice(0, 50).map((item, i) => {
            const imgSrc = imageTemplate ? interpolate(imageTemplate, vars, { item }) : '';
            return (
              <div
                key={i}
                onClick={() => { if (itemAction && interactive && runAction) runAction(itemAction, { item, index: i }); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: theme.radius * 0.7, background: theme.colors.surface,
                  border: `1px solid ${theme.colors.border}`, fontSize: 13, color: theme.colors.text, flexShrink: 0,
                  cursor: itemAction && interactive ? 'pointer' : 'default',
                }}
              >
                {imgSrc && (
                  <img src={imgSrc} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                )}
                <span>{interpolate(node.props?.item_template, vars, { item })}</span>
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
            runAction && runAction(node.actions?.onChange);
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
                runAction && runAction(node.actions?.onChange);
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
            runAction && runAction(node.actions?.onChange);
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
            runAction && runAction(node.actions?.onChange);
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

export default function AppRuntime({ app, className = '', showWatermark = false }) {
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

  // vars is read fresh each step (not stale-closed) since set_variable/
  // update_text steps commonly chain off one another in the same click
  // (e.g. "add 1 to coins" then "update text1 with coins"). `scope` is only
  // set for a list's item_action, so its fields can interpolate {{item...}}
  // the same way the list's own item_template already does. async only
  // because of 'wait' — every existing caller already fire-and-forgets the
  // result, so this is a backward-compatible engine change.
  const runOne = async (action, currentVars, scope) => {
    if (!action?.type) return;
    switch (action.type) {
      case 'navigate':
        if (action.screen_id && screens.some(s => s.id === action.screen_id)) setScreenId(action.screen_id);
        break;
      case 'calculate': {
        if (!action.variable) break;
        const a = resolveNumberOrVariable(action.a, currentVars, scope);
        const b = resolveNumberOrVariable(action.b, currentVars, scope);
        let result;
        if (action.op === 'subtract') result = a - b;
        else if (action.op === 'multiply') result = a * b;
        else if (action.op === 'divide') result = b !== 0 ? a / b : 0;
        else result = a + b;
        const next = String(result);
        currentVars[action.variable] = next;
        setVars(v => ({ ...v, [action.variable]: next }));
        break;
      }
      case 'reset_variables': {
        const initial = Object.fromEntries((app?.variables || []).map(v => [v.name, v.initial_value ?? '']));
        Object.assign(currentVars, initial);
        setVars(initial);
        break;
      }
      case 'random_pick': {
        if (!action.options_variable) break;
        const raw = currentVars[action.options_variable];
        let options = [];
        try { const parsed = raw ? JSON.parse(raw) : []; if (Array.isArray(parsed)) options = parsed; } catch { /* empty */ }
        if (options.length === 0) break;
        const totalWeight = options.reduce((sum, o) => sum + (Number(o.weight) || 0), 0);
        let picked = options[options.length - 1];
        if (totalWeight > 0) {
          let roll = Math.random() * totalWeight;
          for (const o of options) {
            roll -= (Number(o.weight) || 0);
            if (roll <= 0) { picked = o; break; }
          }
        } else {
          picked = options[Math.floor(Math.random() * options.length)];
        }
        const pickedValue = picked?.value;
        if (action.target_variable) {
          const pickedStr = typeof pickedValue === 'object' ? JSON.stringify(pickedValue) : String(pickedValue ?? '');
          currentVars[action.target_variable] = pickedStr;
          setVars(v => ({ ...v, [action.target_variable]: pickedStr }));
        }
        if (action.collection_variable) {
          const rawColl = currentVars[action.collection_variable];
          let arr = [];
          try { const parsed = rawColl ? JSON.parse(rawColl) : []; if (Array.isArray(parsed)) arr = parsed; } catch { /* start fresh */ }
          arr.push(pickedValue);
          const nextColl = JSON.stringify(arr);
          currentVars[action.collection_variable] = nextColl;
          setVars(v => ({ ...v, [action.collection_variable]: nextColl }));
        }
        break;
      }
      case 'copy_to_clipboard':
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(interpolate(action.text, currentVars, scope)).catch(() => {});
        }
        break;
      case 'vibrate':
        if (navigator.vibrate) navigator.vibrate(Number(action.duration_ms) || 200);
        break;
      case 'wait':
        await new Promise(resolve => setTimeout(resolve, Math.max(0, Number(action.duration_ms) || 0)));
        break;
      case 'set_variable': {
        if (!action.variable) break;
        const current = currentVars[action.variable];
        let next;
        if (action.value_mode === 'toggle_bool') next = current === 'true' ? 'false' : 'true';
        else if (action.value_mode === 'increment') next = String((Number(current) || 0) + (Number(action.value) || 1));
        else if (action.value_mode === 'decrement') next = String((Number(current) || 0) - (Number(action.value) || 1));
        else next = interpolate(action.value, currentVars, scope);
        currentVars[action.variable] = next;
        setVars(v => ({ ...v, [action.variable]: next }));
        break;
      }
      case 'update_text': {
        if (!action.target_id) break;
        const value = action.value_mode === 'variable' ? (currentVars[action.value] ?? '') : interpolate(action.value, currentVars, scope);
        setOverrides(o => ({ ...o, [action.target_id]: value }));
        break;
      }
      case 'set_visibility': {
        if (!action.target_id) break;
        setVisibilityOverrides(o => {
          const cur = o[action.target_id];
          const next = action.visible === 'toggle' ? (cur === undefined ? false : !cur) : action.visible === 'show';
          return { ...o, [action.target_id]: next };
        });
        break;
      }
      case 'list_add': {
        if (!action.variable) break;
        const raw = currentVars[action.variable];
        let arr = [];
        try { const parsed = raw ? JSON.parse(raw) : []; if (Array.isArray(parsed)) arr = parsed; } catch { /* start fresh */ }
        const value = action.value_mode === 'variable' ? (currentVars[action.value] ?? '') : interpolate(action.value, currentVars, scope);
        if (action.mode === 'prepend') arr.unshift(value);
        else if (action.mode === 'at_index') arr.splice(Math.max(0, Math.min(arr.length, resolveIndex(action.index, currentVars, scope))), 0, value);
        else arr.push(value);
        const next = JSON.stringify(arr);
        currentVars[action.variable] = next;
        setVars(v => ({ ...v, [action.variable]: next }));
        break;
      }
      case 'list_remove': {
        if (!action.variable) break;
        const raw = currentVars[action.variable];
        let arr = [];
        try { const parsed = raw ? JSON.parse(raw) : []; if (Array.isArray(parsed)) arr = parsed; } catch { /* nothing to remove */ }
        if (action.mode === 'clear') arr = [];
        else if (action.mode === 'first') arr.shift();
        else if (action.mode === 'at_index') { const i = resolveIndex(action.index, currentVars, scope); if (i >= 0 && i < arr.length) arr.splice(i, 1); }
        else arr.pop();
        const next = JSON.stringify(arr);
        currentVars[action.variable] = next;
        setVars(v => ({ ...v, [action.variable]: next }));
        break;
      }
      case 'show_message':
        flash(interpolate(action.text, currentVars, scope) || '…');
        break;
      case 'open_link':
        if (action.url) window.open(action.url, action.new_tab === false ? '_self' : '_blank', 'noopener,noreferrer');
        break;
      default:
        break;
    }
  };

  const runAction = async (actionOrList, scope) => {
    const currentVars = { ...vars };
    for (const action of normalizeActions(actionOrList)) await runOne(action, currentVars, scope);
  };

  if (!screen) {
    return (
      <div className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: theme.colors.textMuted, fontSize: 13, background: theme.colors.background }}>
        No screens yet.
      </div>
    );
  }

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
        {(screen.components || []).map((node, i) => (
          <PositionedNode key={node.id} node={node} index={i} vars={vars} setVars={setVars} runAction={runAction} theme={theme} overrides={overrides} visibilityOverrides={visibilityOverrides} />
        ))}
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
    </div>
  );
}
