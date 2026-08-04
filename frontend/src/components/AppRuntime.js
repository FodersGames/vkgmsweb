import React, { useState, useMemo, useRef, useEffect } from 'react';
import { resolveTheme, AppIcon, getLayout, CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/appBuilder';

const API = process.env.REACT_APP_BACKEND_URL || '';

// Interprets a Studio App's {screens, variables, theme} into a live,
// running mini-app: theming, local variable state, screen navigation, and
// a small action interpreter (navigate / set_variable / show_message /
// call_api / open_link). Used both for the editor's live preview and the
// public /apps/:slug runtime page — this is the one place "what does a
// published app actually do" is implemented, so both surfaces stay
// identical. `ComponentVisual` (the per-type content renderer) is also
// exported standalone so the editor's design canvas can render true
// WYSIWYG previews without a second implementation.

const TEXT_SIZE_PX = { sm: 13, md: 15, lg: 20, xl: 28 };
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
export function ComponentVisual({ node, vars = {}, setVars, runAction, theme }) {
  if (!node) return null;
  const interactive = typeof setVars === 'function';
  switch (node.type) {
    case 'text':
      return (
        <p style={{
          margin: 0, width: '100%', height: '100%', fontSize: TEXT_SIZE_PX[node.props?.size] || 15,
          fontWeight: node.props?.weight === 'bold' ? 700 : 400,
          textAlign: node.props?.align || 'left', color: node.props?.color || theme.colors.text,
          lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflow: 'hidden',
        }}>
          {interpolate(node.props?.content, vars)}
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
          }}
        >
          {interpolate(node.props?.label, vars) || 'Button'}
        </button>
      );
    case 'image':
      return node.props?.url ? (
        <img
          src={node.props.url.startsWith('/') ? `${API}${node.props.url}` : node.props.url}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: node.props?.radius ?? 12, display: 'block' }}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%', borderRadius: node.props?.radius ?? 12,
          background: theme.colors.surface, border: `1px dashed ${theme.colors.border}`,
        }} />
      );
    case 'input': {
      const bound = !!node.props?.variable;
      const style = {
        width: '100%', height: '100%', padding: '0 12px', borderRadius: theme.radius * 0.6, border: `1px solid ${theme.colors.border}`,
        fontSize: 14, boxSizing: 'border-box', fontFamily: FONT_STACK, background: bound ? theme.colors.surface : `${theme.colors.border}30`,
        color: theme.colors.text,
      };
      if (!bound || !interactive) return <input placeholder={node.props?.placeholder} style={style} disabled title={bound ? '' : "This input isn't bound to a variable yet"} />;
      return (
        <input
          placeholder={node.props?.placeholder}
          value={vars[node.props.variable] ?? ''}
          onChange={e => setVars(v => ({ ...v, [node.props.variable]: e.target.value }))}
          style={style}
        />
      );
    }
    case 'toggle': {
      const bound = !!node.props?.variable;
      const on = vars[node.props?.variable] === 'true';
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: '100%', gap: 12 }}>
          <span style={{ fontSize: 14, color: theme.colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{interpolate(node.props?.label, vars) || 'Toggle'}</span>
          <button
            disabled={!bound || !interactive}
            onClick={() => interactive && bound && setVars(v => ({ ...v, [node.props.variable]: v[node.props.variable] === 'true' ? 'false' : 'true' }))}
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
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', height: '100%', overflowY: 'auto' }}>
          {items.slice(0, 50).map((item, i) => (
            <div key={i} style={{
              padding: '10px 12px', borderRadius: theme.radius * 0.7, background: theme.colors.surface,
              border: `1px solid ${theme.colors.border}`, fontSize: 13, color: theme.colors.text, flexShrink: 0,
            }}>
              {interpolate(node.props?.item_template, vars, { item })}
            </div>
          ))}
        </div>
      );
    }
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
          boxSizing: 'border-box', overflow: 'hidden',
        }}>
          {(node.children || []).map((child, i) => (
            <PositionedNode key={child.id} node={child} index={i} vars={vars} setVars={setVars} runAction={runAction} theme={theme} />
          ))}
        </div>
      );
    }
    case 'divider':
      return <div style={{ width: '100%', height: '100%', background: theme.colors.border }} />;
    case 'spacer':
      return <div style={{ width: '100%', height: '100%' }} />;
    default:
      return null;
  }
}

// Absolute-positions a component within its parent (the screen canvas, or
// a container) using its own `layout` (falls back to a sane per-type
// default for older data saved before free positioning existed).
export function PositionedNode({ node, index = 0, vars, setVars, runAction, theme }) {
  const l = getLayout(node, index);
  return (
    <div style={{ position: 'absolute', left: l.x, top: l.y, width: l.w, height: l.h }}>
      <ComponentVisual node={node} vars={vars} setVars={setVars} runAction={runAction} theme={theme} />
    </div>
  );
}

export default function AppRuntime({ app, token, className = '', showWatermark = false }) {
  const theme = useMemo(() => resolveTheme(app?.theme), [app?.theme]);
  const screens = useMemo(() => app?.screens || [], [app]);
  const [screenId, setScreenId] = useState(screens[0]?.id);
  const [vars, setVars] = useState(() => Object.fromEntries((app?.variables || []).map(v => [v.name, v.initial_value ?? ''])));
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

  const runAction = async (action) => {
    if (!action?.type) return;
    switch (action.type) {
      case 'navigate':
        if (action.screen_id && screens.some(s => s.id === action.screen_id)) setScreenId(action.screen_id);
        break;
      case 'set_variable': {
        if (!action.variable) break;
        setVars(v => {
          const current = v[action.variable];
          let next;
          if (action.value_mode === 'toggle_bool') next = current === 'true' ? 'false' : 'true';
          else if (action.value_mode === 'increment') next = String((Number(current) || 0) + (Number(action.value) || 1));
          else next = interpolate(action.value, v);
          return { ...v, [action.variable]: next };
        });
        break;
      }
      case 'show_message':
        flash(interpolate(action.text, vars) || '…');
        break;
      case 'open_link':
        if (action.url) window.open(action.url, action.new_tab === false ? '_self' : '_blank', 'noopener,noreferrer');
        break;
      case 'call_api': {
        if (!action.url) break;
        try {
          const headers = { 'Content-Type': 'application/json' };
          if (token) headers.Authorization = `Bearer ${token}`;
          const method = (action.method || 'GET').toUpperCase();
          const res = await fetch(`${API}${action.url}`, {
            method,
            headers,
            body: ['GET', 'HEAD'].includes(method) ? undefined : interpolate(action.body || '{}', vars),
          });
          let data = null;
          try { data = await res.json(); } catch { /* non-JSON response */ }
          if (action.store_in_variable) {
            setVars(v => ({ ...v, [action.store_in_variable]: typeof data === 'string' ? data : JSON.stringify(data ?? {}) }));
          }
          if (!res.ok) flash(`Request failed (${res.status})`);
        } catch {
          flash('Request failed.');
        }
        break;
      }
      default:
        break;
    }
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
          <PositionedNode key={node.id} node={node} index={i} vars={vars} setVars={setVars} runAction={runAction} theme={theme} />
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
