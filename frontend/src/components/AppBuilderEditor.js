import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, Plus, Trash2, Copy, Eye, Save, Globe, Lock,
  Check, X, ChevronRight, Palette, Download, Smartphone, Settings,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { useAuth } from '../context/AuthContext';
import {
  COMPONENT_TYPES, COMPONENT_META, ACTION_TYPES, genId, createComponent, createAction,
  THEME_PRESETS, ICON_IDS, AppIcon, getLayout, resolveTheme, CANVAS_WIDTH, CANVAS_HEIGHT,
} from '../constants/appBuilder';
import AppRuntime, { ComponentVisual } from './AppRuntime';
import { exportAppAsZip, generateAppZipBlob } from '../utils/exportApp';

const API = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || '';
const MIN_SIZE = 16;
const PACKAGE_ID_RE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
const SDK_LEVELS = [
  { v: 22, label: '22 — Android 5.1' }, { v: 23, label: '23 — Android 6.0' }, { v: 24, label: '24 — Android 7.0' },
  { v: 25, label: '25 — Android 7.1' }, { v: 26, label: '26 — Android 8.0' }, { v: 27, label: '27 — Android 8.1' },
  { v: 28, label: '28 — Android 9' }, { v: 29, label: '29 — Android 10' }, { v: 30, label: '30 — Android 11' },
  { v: 31, label: '31 — Android 12' }, { v: 32, label: '32 — Android 12L' }, { v: 33, label: '33 — Android 13' },
  { v: 34, label: '34 — Android 14' }, { v: 35, label: '35 — Android 15' },
];

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
      boxSizing: 'border-box', overflow: 'hidden',
    }}>
      {children}
    </div>
  );
}

function EditableBox({ node, index = 0, theme, selectedId, onSelect, onChangeLayout, onDelete }) {
  const layout = getLayout(node, index);
  const selected = selectedId === node.id;
  const isContainer = node.type === 'container';

  const startDrag = (e) => {
    e.stopPropagation();
    onSelect(node.id);
    const startX = e.clientX, startY = e.clientY;
    const orig = { ...layout };
    const onMove = (ev) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      onChangeLayout(node.id, { ...orig, x: Math.max(0, orig.x + dx), y: Math.max(0, orig.y + dy) });
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
      if (corner.includes('e')) w = Math.max(MIN_SIZE, orig.w + dx);
      if (corner.includes('s')) h = Math.max(MIN_SIZE, orig.h + dy);
      if (corner.includes('w')) { w = Math.max(MIN_SIZE, orig.w - dx); x = orig.x + (orig.w - w); }
      if (corner.includes('n')) { h = Math.max(MIN_SIZE, orig.h - dy); y = orig.y + (orig.h - h); }
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
              <EditableBox key={child.id} node={child} index={i} theme={theme} selectedId={selectedId} onSelect={onSelect} onChangeLayout={onChangeLayout} onDelete={onDelete} />
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
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
            style={{ position: 'absolute', top: -10, right: -10, width: 18, height: 18, borderRadius: '50%', background: '#EF4444', color: '#fff', border: '2px solid white', fontSize: 11, lineHeight: '14px', cursor: 'pointer', zIndex: 6 }}
          >
            ×
          </button>
        </>
      )}
    </div>
  );
}

function DesignCanvas({ screen, theme, selectedId, onSelect, onChangeLayout, onDelete }) {
  return (
    <div
      onMouseDown={() => onSelect(null)}
      style={{ position: 'relative', width: CANVAS_WIDTH, height: CANVAS_HEIGHT, background: theme.colors.background, overflow: 'hidden' }}
    >
      {(screen.components || []).map((node, i) => (
        <EditableBox key={node.id} node={node} index={i} theme={theme} selectedId={selectedId} onSelect={onSelect} onChangeLayout={onChangeLayout} onDelete={onDelete} />
      ))}
      {(screen.components || []).length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: theme.colors.textMuted, textAlign: 'center', padding: 24 }}>
          Empty screen — add a component from the palette, then drag it into place.
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

function PropsEditor({ node, onChange }) {
  const set = (key, value) => onChange(n => { n.props[key] = value; });

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
              <Select value={node.props.size || 'md'} onChange={e => set('size', e.target.value)} size="sm">
                {['sm', 'md', 'lg', 'xl'].map(s => <option key={s} value={s}>{s}</option>)}
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
        </div>
      );
    case 'image':
      return (
        <div className="space-y-3">
          <div>
            <label className={FIELD_LABEL}>Image URL</label>
            <input value={node.props.url || ''} onChange={e => set('url', e.target.value)} placeholder="https://… or /api/uploads/…" className={FIELD_INPUT} />
          </div>
          <div>
            <label className={FIELD_LABEL}>Corner radius</label>
            <input type="number" min="0" value={node.props.radius ?? 12} onChange={e => set('radius', Number(e.target.value))} className={FIELD_INPUT} />
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
            <p className="mt-1 text-[10px] text-[#A1A1A6]">What the visitor types is stored in this variable — usable in {'{{variable}}'} text or a "Call an API" action.</p>
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
    case 'list':
      return (
        <div className="space-y-3">
          <div>
            <label className={FIELD_LABEL}>Source variable</label>
            <input value={node.props.source_variable || ''} onChange={e => set('source_variable', e.target.value)} placeholder="e.g. apiResult" className={FIELD_INPUT} />
            <p className="mt-1 text-[10px] text-[#A1A1A6]">Expects a JSON array in this variable — e.g. the result of a "Call an API" action.</p>
          </div>
          <div>
            <label className={FIELD_LABEL}>Item template</label>
            <input value={node.props.item_template || ''} onChange={e => set('item_template', e.target.value)} placeholder="{{item.name}} — {{item.status}}" className={FIELD_INPUT} />
            <p className="mt-1 text-[10px] text-[#A1A1A6]">Use {'{{item}}'} for a simple value, or {'{{item.field}}'} if each entry is an object.</p>
          </div>
          <div>
            <label className={FIELD_LABEL}>Empty state text</label>
            <input value={node.props.empty_text || ''} onChange={e => set('empty_text', e.target.value)} className={FIELD_INPUT} />
          </div>
        </div>
      );
    case 'spacer':
      return <p className="text-xs text-[#A1A1A6]">Resize this on the canvas to change how much space it takes up.</p>;
    case 'divider':
      return <p className="text-xs text-[#A1A1A6]">Resize this on the canvas — width and thickness both follow its box.</p>;
    default:
      return null;
  }
}

function ActionEditor({ node, screens, onChange }) {
  const action = node.actions?.onClick || null;

  const setActionType = (type) => onChange(n => {
    if (!type) { delete n.actions.onClick; return; }
    n.actions.onClick = createAction(type);
  });
  const setField = (field, value) => onChange(n => { n.actions.onClick[field] = value; });

  return (
    <div className="space-y-3">
      <div>
        <label className={FIELD_LABEL}>When clicked</label>
        <Select value={action?.type || ''} onChange={e => setActionType(e.target.value)} size="sm" placeholder="No action">
          <option value="">No action</option>
          {ACTION_TYPES.map(a => <option key={a.type} value={a.type}>{a.label}</option>)}
        </Select>
      </div>

      {action?.type === 'navigate' && (
        <div>
          <label className={FIELD_LABEL}>Screen</label>
          <Select value={action.screen_id || ''} onChange={e => setField('screen_id', e.target.value)} size="sm">
            <option value="">Choose a screen…</option>
            {screens.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
      )}

      {action?.type === 'set_variable' && (
        <>
          <div>
            <label className={FIELD_LABEL}>Variable</label>
            <input value={action.variable || ''} onChange={e => setField('variable', e.target.value)} placeholder="e.g. count" className={FIELD_INPUT} />
          </div>
          <div>
            <label className={FIELD_LABEL}>How</label>
            <Select value={action.value_mode || 'literal'} onChange={e => setField('value_mode', e.target.value)} size="sm">
              <option value="literal">Set to a value</option>
              <option value="toggle_bool">Toggle true/false</option>
              <option value="increment">Increment by a number</option>
            </Select>
          </div>
          {action.value_mode !== 'toggle_bool' && (
            <div>
              <label className={FIELD_LABEL}>{action.value_mode === 'increment' ? 'Amount' : 'Value'}</label>
              <input value={action.value || ''} onChange={e => setField('value', e.target.value)} placeholder={action.value_mode === 'increment' ? '1' : 'Supports {{other_variable}}'} className={FIELD_INPUT} />
            </div>
          )}
        </>
      )}

      {action?.type === 'show_message' && (
        <div>
          <label className={FIELD_LABEL}>Message</label>
          <input value={action.text || ''} onChange={e => setField('text', e.target.value)} placeholder="Supports {{variable}}" className={FIELD_INPUT} />
        </div>
      )}

      {action?.type === 'call_api' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className={FIELD_LABEL}>Method</label>
              <Select value={action.method || 'GET'} onChange={e => setField('method', e.target.value)} size="sm">
                {['GET', 'POST', 'PUT', 'DELETE'].map(m => <option key={m} value={m}>{m}</option>)}
              </Select>
            </div>
            <div className="col-span-2">
              <label className={FIELD_LABEL}>Endpoint</label>
              <input value={action.url || ''} onChange={e => setField('url', e.target.value)} placeholder="/api/careers" className={FIELD_INPUT} />
            </div>
          </div>
          {action.method !== 'GET' && (
            <div>
              <label className={FIELD_LABEL}>Body (JSON)</label>
              <textarea rows={3} value={action.body || ''} onChange={e => setField('body', e.target.value)} placeholder='{"name": "{{userName}}"}' className={`${FIELD_INPUT} resize-none font-mono text-xs`} />
            </div>
          )}
          <div>
            <label className={FIELD_LABEL}>Store response in variable <span className="normal-case font-normal text-[#A1A1A6]">(optional)</span></label>
            <input value={action.store_in_variable || ''} onChange={e => setField('store_in_variable', e.target.value)} placeholder="e.g. apiResult" className={FIELD_INPUT} />
          </div>
        </>
      )}

      {action?.type === 'open_link' && (
        <>
          <div>
            <label className={FIELD_LABEL}>URL</label>
            <input value={action.url || ''} onChange={e => setField('url', e.target.value)} placeholder="https://…" className={FIELD_INPUT} />
          </div>
          <label className="flex items-center gap-2 text-xs text-[#6E6E73] dark:text-[#a1a1aa] cursor-pointer">
            <input type="checkbox" checked={action.new_tab !== false} onChange={e => setField('new_tab', e.target.checked)} />
            Open in a new tab
          </label>
        </>
      )}
    </div>
  );
}

// ============================================================
// Main editor
// ============================================================
export default function AppBuilderEditor({ appId, onBack, apiBase = '/api/admin/studio-apps', allowPremium = true, quota = null, enableApkBuild = false }) {
  const { token } = useAuth();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeScreenId, setActiveScreenId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [inspectorTab, setInspectorTab] = useState('props');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [apkBuild, setApkBuild] = useState(null);
  const [apkBusy, setApkBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [iconUploading, setIconUploading] = useState(false);
  const iconInputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}${apiBase}/${appId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      setApp(data);
      setActiveScreenId(data.screens?.[0]?.id || null);
    } finally {
      setLoading(false);
    }
  }, [appId, token, apiBase]);

  useEffect(() => { load(); }, [load]);

  const mutate = (fn) => {
    setApp(a => { const clone = structuredClone(a); fn(clone); return clone; });
    setDirty(true);
  };

  const handleIconUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIconUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const r = await fetch(`${API}/api/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await r.json();
      if (r.ok && data.url) mutate(a => { a.app_icon_url = data.url; });
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

  const addComponent = (type) => {
    // Adds inside the currently selected group, if any — otherwise at the top level.
    const selectedNode = selectedId ? findComponent(activeScreen, selectedId)?.node : null;
    const containerId = selectedNode?.type === 'container' ? selectedNode.id : null;
    const siblingCount = containerId
      ? (activeScreen.components.find(c => c.id === containerId)?.children.length || 0)
      : activeScreen.components.length;
    const cascade = (siblingCount % 6) * 14;
    const comp = createComponent(type, { x: 20 + cascade, y: 20 + cascade });
    mutate(a => {
      const screen = a.screens.find(s => s.id === activeScreenId);
      if (containerId) screen.components.find(c => c.id === containerId).children.push(comp);
      else screen.components.push(comp);
    });
    setSelectedId(comp.id);
    setInspectorTab('props');
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
    await fetch(`${API}${apiBase}/${appId}/visibility`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ visibility: next }),
    });
    setApp(a => ({ ...a, visibility: next }));
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

  if (loading || !app || !activeScreen) {
    return <div className="p-6"><div className="h-96 rounded-xl bg-[#F5F5F7] dark:bg-[#1c1c2e] animate-pulse" /></div>;
  }

  const selected = selectedId ? findComponent(activeScreen, selectedId)?.node : null;
  const theme = resolveTheme(app.theme);

  return (
    <div className="flex flex-col h-full">
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
        </div>

        <div className="flex-1" />

        <Button size="sm" variant="secondary" icon={Settings} onClick={() => setSettingsOpen(true)} title="Package name, SDK, icon">
          App Settings
        </Button>
        <Button size="sm" variant="secondary" onClick={toggleVisibility}>
          Make {app.visibility === 'public' ? 'Private' : 'Public'}
        </Button>
        <Button size="sm" variant={app.status === 'published' ? 'secondary' : 'accent'} onClick={toggleStatus}>
          {app.status === 'published' ? 'Unpublish' : 'Publish'}
        </Button>
        <Button size="sm" variant="secondary" icon={Eye} onClick={() => setPreviewOpen(true)}>Preview</Button>
        <Button
          size="sm" variant="secondary" icon={allowPremium ? Download : Lock}
          onClick={handleExport} loading={exporting}
          title={allowPremium ? 'Export as a VS Code project' : 'Requires Vakar+'}
        >
          Export
        </Button>
        {enableApkBuild && (
          <Button
            size="sm" variant="secondary" icon={Smartphone}
            onClick={startApkBuild} loading={apkInProgress} disabled={apkInProgress}
            title="Build an installable Android APK"
          >
            {apkInProgress ? 'Building…' : 'Build APK'}
          </Button>
        )}
        <Button size="sm" icon={justSaved ? Check : Save} onClick={save} loading={saving} disabled={!dirty && !saving}>
          {justSaved ? 'Saved' : dirty ? 'Save' : 'Saved'}
        </Button>
      </div>

      {saveError && (
        <div className="flex items-center justify-between gap-3 px-5 py-2.5 bg-red-50 dark:bg-red-500/10 border-b border-red-100 dark:border-red-500/20 text-xs text-red-600 dark:text-red-400 shrink-0">
          <span>{saveError}</span>
          {!allowPremium && saveError.toLowerCase().includes('vakar+') && (
            <a href="/vakar-plus" className="font-semibold underline shrink-0">Upgrade</a>
          )}
          <button onClick={() => setSaveError('')} className="shrink-0"><X size={12} /></button>
        </div>
      )}

      {quota && !allowPremium && (
        <div className="flex items-center justify-between gap-3 px-5 py-2 bg-[#4ECDC4]/8 border-b border-[#4ECDC4]/20 text-[11px] text-[#1D1D1F] dark:text-[#e4e4e7] shrink-0">
          <span>{quota.used}/{quota.max} apps used on your plan.</span>
          <a href="/vakar-plus" className="font-semibold text-[#4ECDC4] hover:underline shrink-0">Upgrade to Vakar+ for more</a>
        </div>
      )}

      {enableApkBuild && apkInProgress && (
        <div className="flex items-center gap-2 px-5 py-2 bg-zinc-50 dark:bg-white/[0.03] border-b border-[#D2D2D7] dark:border-[#2a2a3c] text-[11px] text-[#6E6E73] dark:text-[#a1a1aa] shrink-0">
          <div className="w-3 h-3 border-2 border-[#D2D2D7] dark:border-[#2a2a3c] border-t-[#4ECDC4] rounded-full animate-spin shrink-0" />
          <span>Building your APK — this usually takes a few minutes, you can keep editing in the meantime.</span>
        </div>
      )}
      {enableApkBuild && apkBuild?.status === 'ready' && !apkInProgress && (
        <div className="flex items-center justify-between gap-3 px-5 py-2 bg-emerald-50 dark:bg-emerald-500/10 border-b border-emerald-100 dark:border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-400 shrink-0">
          <span>Your APK is ready.</span>
          <a href={`${API}${apkBuild.apk_url}`} className="font-semibold underline shrink-0" download>Download APK</a>
        </div>
      )}
      {enableApkBuild && apkBuild?.status === 'failed' && !apkInProgress && (
        <div className="flex items-center justify-between gap-3 px-5 py-2 bg-red-50 dark:bg-red-500/10 border-b border-red-100 dark:border-red-500/20 text-[11px] text-red-600 dark:text-red-400 shrink-0">
          <span>APK build failed{apkBuild.error ? `: ${apkBuild.error}` : '.'}</span>
          <button onClick={startApkBuild} className="font-semibold underline shrink-0">Try again</button>
        </div>
      )}

      {/* Body */}
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
                  {app.screens.length > 1 && (
                    <button onClick={e => { e.stopPropagation(); deleteScreen(s.id); }} className="opacity-0 group-hover:opacity-100 shrink-0">
                      <X size={11} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addScreen} className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#A1A1A6] hover:text-[#4ECDC4] transition-colors">
              <Plus size={11} />Add screen
            </button>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] uppercase tracking-widest mb-2">Add component</p>
            <div className="grid grid-cols-2 gap-1.5">
              {COMPONENT_TYPES.map(c => {
                const locked = c.tier === 'premium' && !allowPremium;
                return (
                  <button
                    key={c.type}
                    onClick={() => locked ? setSaveError('This component requires Vakar+.') : addComponent(c.type)}
                    className={`relative flex flex-col items-center gap-1 py-2.5 rounded-lg border transition-colors ${
                      locked
                        ? 'border-[#D2D2D7] dark:border-[#2a2a3c] text-[#BFBFC4] dark:text-[#52525b] opacity-60'
                        : 'border-[#D2D2D7] dark:border-[#2a2a3c] text-[#6E6E73] dark:text-[#a1a1aa] hover:border-[#4ECDC4] hover:text-[#4ECDC4]'
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
                    onClick={() => locked ? setSaveError('This theme requires Vakar+.') : setTheme(t.id)}
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
              {COMPONENT_META[selected.type]?.supportsAction && (
                <div className="inline-flex rounded-full bg-[#EDEDEF] dark:bg-[#1c1c2e] p-1 gap-1 mb-4 w-full">
                  {[{ id: 'props', label: 'Content' }, { id: 'action', label: 'Action' }].map(t => (
                    <button
                      key={t.id} onClick={() => setInspectorTab(t.id)}
                      className={`flex-1 py-1.5 rounded-full text-[11px] font-semibold transition-all ${inspectorTab === t.id ? 'bg-white dark:bg-[#2a2a3c] text-[#1D1D1F] dark:text-white shadow-sm' : 'text-[#6E6E73] dark:text-[#a1a1aa]'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
              {(!COMPONENT_META[selected.type]?.supportsAction || inspectorTab === 'props') ? (
                <PropsEditor node={selected} onChange={updateSelected} />
              ) : (
                <ActionEditor node={selected} screens={app.screens} onChange={updateSelected} />
              )}
            </>
          )}
        </div>
      </div>

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
            </div>

            <div className="px-6 py-4 border-t border-[#D2D2D7] dark:border-[#2a2a3c] shrink-0">
              <Button className="w-full" onClick={() => setSettingsOpen(false)}>Done</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
