import React, { useState, useMemo } from 'react';

const API = process.env.REACT_APP_BACKEND_URL || '';

// Interprets a Studio App's {screens, variables} into a live, running
// mini-app: local variable state, screen navigation, and a small action
// interpreter (navigate / set_variable / show_message / call_api /
// open_link). Used both for the editor's live preview and the public
// /apps/:slug runtime page — this is the one place "what does a published
// app actually do" is implemented, so both surfaces stay identical.

const TEXT_SIZE_PX = { sm: 13, md: 15, lg: 20, xl: 28 };

const BUTTON_STYLE = {
  primary: { background: '#1D1D1F', color: '#fff', border: '1px solid #1D1D1F' },
  secondary: { background: '#4ECDC4', color: '#0a2a27', border: '1px solid #4ECDC4' },
  outline: { background: 'transparent', color: '#1D1D1F', border: '1px solid #D2D2D7' },
};

function interpolate(str, vars) {
  if (!str) return '';
  return String(str).replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, name) => {
    const v = vars[name];
    return v === undefined || v === null ? '' : String(v);
  });
}

function RenderNode({ node, vars, setVars, runAction }) {
  if (!node) return null;
  switch (node.type) {
    case 'text':
      return (
        <p style={{
          margin: 0, fontSize: TEXT_SIZE_PX[node.props?.size] || 15,
          fontWeight: node.props?.weight === 'bold' ? 700 : 400,
          textAlign: node.props?.align || 'left', color: node.props?.color || '#1D1D1F',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {interpolate(node.props?.content, vars)}
        </p>
      );
    case 'button':
      return (
        <button
          onClick={() => runAction(node.actions?.onClick)}
          style={{
            ...(BUTTON_STYLE[node.props?.style] || BUTTON_STYLE.primary),
            padding: '11px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600,
            cursor: 'pointer', width: '100%', fontFamily: 'inherit',
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
          background: '#F5F5F7', border: '1px dashed #D2D2D7',
        }} />
      );
    case 'input': {
      const bound = !!node.props?.variable;
      const style = {
        width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #D2D2D7',
        fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit', background: bound ? '#fff' : '#FAFAFA',
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
    case 'container':
      return (
        <div style={{
          display: 'flex', flexDirection: node.props?.direction || 'column',
          gap: node.props?.gap ?? 12, alignItems: node.props?.align || 'stretch', width: '100%',
        }}>
          {(node.children || []).map(child => (
            <RenderNode key={child.id} node={child} vars={vars} setVars={setVars} runAction={runAction} />
          ))}
        </div>
      );
    case 'divider':
      return <div style={{ height: 1, background: '#D2D2D7', width: '100%' }} />;
    case 'spacer':
      return <div style={{ height: node.props?.size ?? 16 }} />;
    default:
      return null;
  }
}

export default function AppRuntime({ app, token, className = '' }) {
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
      <div className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#A1A1A6', fontSize: 13 }}>
        No screens yet.
      </div>
    );
  }

  return (
    <div className={className} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 16, padding: 20, height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      {message && (
        <div style={{
          position: 'absolute', top: 10, left: 12, right: 12, zIndex: 10,
          background: '#1D1D1F', color: '#fff', fontSize: 12, fontWeight: 600,
          padding: '8px 12px', borderRadius: 10, textAlign: 'center', boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
        }}>
          {message}
        </div>
      )}
      {(screen.components || []).map(node => (
        <RenderNode key={node.id} node={node} vars={vars} setVars={setVars} runAction={runAction} />
      ))}
    </div>
  );
}
