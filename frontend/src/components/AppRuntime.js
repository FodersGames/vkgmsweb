import React, { useState, useMemo } from 'react';
import { resolveTheme, AppIcon } from '../constants/appBuilder';

const API = process.env.REACT_APP_BACKEND_URL || '';

// Interprets a Studio App's {screens, variables, theme} into a live,
// running mini-app: theming, local variable state, screen navigation, and
// a small action interpreter (navigate / set_variable / show_message /
// call_api / open_link). Used both for the editor's live preview and the
// public /apps/:slug runtime page — this is the one place "what does a
// published app actually do" is implemented, so both surfaces stay
// identical.

const TEXT_SIZE_PX = { sm: 13, md: 15, lg: 20, xl: 28 };
const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

function interpolate(str, vars, scope) {
  if (!str) return '';
  return String(str).replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, path) => {
    const parts = path.split('.');
    const root = parts[0];
    let val;
    if (scope && Object.prototype.hasOwnProperty.call(scope, root)) {
      val = scope[root];
      for (let i = 1; i < parts.length && val != null; i++) val = val[parts[i]];
    } else {
      val = vars[root];
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

function RenderNode({ node, vars, setVars, runAction, theme }) {
  if (!node) return null;
  switch (node.type) {
    case 'text':
      return (
        <p style={{
          margin: 0, fontSize: TEXT_SIZE_PX[node.props?.size] || 15,
          fontWeight: node.props?.weight === 'bold' ? 700 : 400,
          textAlign: node.props?.align || 'left', color: node.props?.color || theme.colors.text,
          lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {interpolate(node.props?.content, vars)}
        </p>
      );
    case 'button':
      return (
        <button
          onClick={() => runAction(node.actions?.onClick)}
          style={{
            ...buttonStyle(theme, node.props?.style),
            padding: '11px 18px', borderRadius: theme.radius * 0.7, fontSize: 14, fontWeight: 600,
            cursor: 'pointer', width: '100%', fontFamily: FONT_STACK, transition: 'opacity 0.15s',
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
          style={{ width: '100%', height: node.props?.height || 160, objectFit: 'cover', borderRadius: node.props?.radius ?? 12, display: 'block' }}
        />
      ) : (
        <div style={{
          width: '100%', height: node.props?.height || 160, borderRadius: node.props?.radius ?? 12,
          background: theme.colors.surface, border: `1px dashed ${theme.colors.border}`,
        }} />
      );
    case 'input': {
      const bound = !!node.props?.variable;
      const style = {
        width: '100%', padding: '10px 12px', borderRadius: theme.radius * 0.6, border: `1px solid ${theme.colors.border}`,
        fontSize: 14, boxSizing: 'border-box', fontFamily: FONT_STACK, background: bound ? theme.colors.surface : `${theme.colors.border}30`,
        color: theme.colors.text,
      };
      if (!bound) return <input placeholder={node.props?.placeholder} style={style} disabled title="This input isn't bound to a variable yet" />;
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12 }}>
          <span style={{ fontSize: 14, color: theme.colors.text }}>{interpolate(node.props?.label, vars) || 'Toggle'}</span>
          <button
            disabled={!bound}
            onClick={() => bound && setVars(v => ({ ...v, [node.props.variable]: v[node.props.variable] === 'true' ? 'false' : 'true' }))}
            style={{
              width: 42, height: 24, borderRadius: 12, border: 'none', cursor: bound ? 'pointer' : 'not-allowed',
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
      return <AppIcon id={node.props?.icon || 'star'} size={node.props?.size || 28} color={node.props?.color || theme.colors.text} />;
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
        return <p style={{ margin: 0, fontSize: 13, color: theme.colors.textMuted }}>{node.props?.empty_text || 'No items yet.'}</p>;
      }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          {items.slice(0, 50).map((item, i) => (
            <div key={i} style={{
              padding: '10px 12px', borderRadius: theme.radius * 0.7, background: theme.colors.surface,
              border: `1px solid ${theme.colors.border}`, fontSize: 13, color: theme.colors.text,
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
          display: 'flex', flexDirection: node.props?.direction || 'column',
          gap: node.props?.gap ?? 12, alignItems: node.props?.align || 'stretch', width: '100%',
          background: bg,
          border: node.props?.border ? `1px solid ${theme.colors.border}` : 'none',
          borderRadius: node.props?.radius ?? 0,
          padding: node.props?.padding ?? 0,
          boxShadow: node.props?.shadow ? '0 10px 30px -12px rgba(0,0,0,0.18)' : 'none',
          boxSizing: 'border-box',
        }}>
          {(node.children || []).map(child => (
            <RenderNode key={child.id} node={child} vars={vars} setVars={setVars} runAction={runAction} theme={theme} />
          ))}
        </div>
      );
    }
    case 'divider':
      return <div style={{ height: 1, background: theme.colors.border, width: '100%' }} />;
    case 'spacer':
      return <div style={{ height: node.props?.size ?? 16 }} />;
    default:
      return null;
  }
}

function StatusBar({ theme }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 20px 2px', fontSize: 12, fontWeight: 600, color: theme.colors.text,
      fontFamily: FONT_STACK, userSelect: 'none', flexShrink: 0,
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ width: 14, height: 8, borderRadius: 2, border: `1.3px solid ${theme.colors.text}`, position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 1.5, right: 4, background: theme.colors.text, borderRadius: 0.5 }} />
        </div>
      </div>
    </div>
  );
}

export default function AppRuntime({ app, token, className = '' }) {
  const theme = useMemo(() => resolveTheme(app?.theme), [app?.theme]);
  const screens = useMemo(() => app?.screens || [], [app]);
  const [screenId, setScreenId] = useState(screens[0]?.id);
  const [vars, setVars] = useState(() => Object.fromEntries((app?.variables || []).map(v => [v.name, v.initial_value ?? ''])));
  const [message, setMessage] = useState(null);

  const screen = useMemo(() => screens.find(s => s.id === screenId) || screens[0], [screens, screenId]);

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
    <div className={className} style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', background: theme.colors.background, fontFamily: FONT_STACK, boxSizing: 'border-box' }}>
      <StatusBar theme={theme} />
      {message && (
        <div style={{
          position: 'absolute', top: 40, left: 12, right: 12, zIndex: 10,
          background: theme.colors.text, color: theme.colors.background, fontSize: 12, fontWeight: 600,
          padding: '8px 12px', borderRadius: theme.radius * 0.7, textAlign: 'center', boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
        }}>
          {message}
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, boxSizing: 'border-box' }}>
        {(screen.components || []).map(node => (
          <RenderNode key={node.id} node={node} vars={vars} setVars={setVars} runAction={runAction} theme={theme} />
        ))}
      </div>
    </div>
  );
}
