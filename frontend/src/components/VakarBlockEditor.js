import React, { useState, useEffect, useRef } from 'react';
import * as Blockly from 'blockly/core';
import JSZip from 'jszip';
import {
  ArrowLeft, Flag, Square, Plus, Trash2, Upload,
  Loader2, Check, AlertTriangle, Pencil, MonitorPlay, Volume2,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Maximize2, Minimize2, Download, Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TOOLBOX, COLORS, UNITY_BLOCKLY_THEME } from '../vakarBlock/blocks';
import '../vakarBlock/generators';
import { VakarBlockRuntime, VakarSprite } from '../vakarBlock/runtime';
import { exportSpriteWorkspace, md5 } from '../vakarBlock/sb3';

const API = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || '';

const resolveUrl = (url) => (url && url.startsWith('/') ? `${API}${url}` : url);
const genId = () => Math.random().toString(36).slice(2, 10);

// A fixed dark, Unity-editor-style theme for this one screen — deliberately
// NOT tied to the site's own light/dark toggle (`dark:` classes elsewhere
// in this codebase); the editor is a fullscreen standalone surface (see
// VakarBlockList.js's portal render) with its own consistent identity.
const U = {
  bg: '#1e1e1e',
  panel: '#252526',
  panelAlt: '#2d2d30',
  border: '#3f3f46',
  hover: '#37373d',
  text: '#d4d4d4',
  textMuted: '#9a9a9a',
  textDim: '#6a6a6a',
  accent: '#4FC1FF',
};
const inputCls = 'rounded px-2 py-1.5 text-xs bg-[#1e1e1e] border border-[#3f3f46] text-[#d4d4d4] outline-none focus:border-[#4FC1FF]';
const toolBtnCls = 'p-2 rounded text-[#9a9a9a] hover:text-[#d4d4d4] hover:bg-[#37373d] transition-colors';

// Moves the item with `id` one slot earlier/later in `list` (by id, not
// index, since callers always have the id at hand) — used for reordering
// costumes/sounds/backdrops. Returns the same array reference if the move
// is a no-op (already at that edge), so callers can skip a re-render.
function reorderById(list, id, direction) {
  const idx = list.findIndex((item) => item.id === id);
  const target = idx + direction;
  if (idx === -1 || target < 0 || target >= list.length) return list;
  const next = list.slice();
  [next[idx], next[target]] = [next[target], next[idx]];
  return next;
}

function SpeechBubble({ text }) {
  if (!text) return null;
  return (
    <div className="absolute left-1/2 -translate-x-1/2 -top-3 -translate-y-full whitespace-nowrap max-w-[160px] whitespace-normal">
      <div className="bg-white text-[#1D1D1F] text-xs font-medium rounded-2xl px-3 py-1.5 shadow-lg border border-[#D2D2D7]">
        {text}
      </div>
    </div>
  );
}

function SpriteThumb({ sprite, size = 40 }) {
  const costume = sprite.costumes?.find((c) => c.id === (sprite.current_costume_id || sprite.currentCostumeId)) || sprite.costumes?.[0];
  if (costume) {
    return <img src={resolveUrl(costume.image_url)} alt="" className="object-contain" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className="rounded-lg flex items-center justify-center font-bold text-white shrink-0"
      style={{ width: size, height: size, background: COLORS.motion }}
    >
      {(sprite.name || '?').slice(0, 1).toUpperCase()}
    </div>
  );
}

export default function VakarBlockEditor({ projectId, onBack, apiBase = '/api/admin/vakar-block-projects' }) {
  const { token } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportingSb3, setExportingSb3] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selectedSpriteId, setSelectedSpriteId] = useState(null);
  const [stageSelected, setStageSelected] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [, setRenderTick] = useState(0);
  const [editingName, setEditingName] = useState(false);
  // Right panel (stage + corral) width — bigger default than a first pass,
  // and user-resizable via the drag handle between it and the Blockly pane.
  const [rightPanelWidth, setRightPanelWidth] = useState(440);
  // Stage width/height inputs: kept as separate "draft" text while the user
  // is typing (null = not currently editing, show the live project value).
  // Clamping/parsing on every keystroke used to snap the field to 160 the
  // instant it was cleared, making it impossible to type a new number —
  // now only committed (parsed + clamped) on blur/Enter.
  const [widthDraft, setWidthDraft] = useState(null);
  const [heightDraft, setHeightDraft] = useState(null);
  // VakarGames Play UI — the login/register popup and the loading screen
  // are transient overlays a running project can trigger (see runtime.js's
  // vgPlayShowLogin/vgPlayOpenLoading); rendered here, React-managed,
  // rather than the original TurboWarp extension's raw document.body DOM
  // manipulation, to stay consistent with how the rest of this editor
  // renders everything else.
  const [vgLoginPopup, setVgLoginPopup] = useState(null); // null = closed, else {}
  const [vgLoadingScreen, setVgLoadingScreen] = useState(null); // null = hidden, else {visible,max}

  const blocklyDivRef = useRef(null);
  const workspaceRef = useRef(null);
  const runtimeRef = useRef(null);
  const costumeInputRef = useRef(null);
  const soundInputRef = useRef(null);
  const backdropInputRef = useRef(null);
  const resizingRef = useRef(false);
  const penCanvasRef = useRef(null);
  const stageBoxRef = useRef(null);
  const penPrevRef = useRef(new Map()); // spriteId -> {x, y, penDown} from the previous render tick, for drawing trail segments
  // Kept in sync (via plain assignment, further down, once `saveProject`/
  // `dirty`/`saving` actually exist) so the autosave interval and the
  // beforeunload warning below always see fresh values without needing to
  // re-run this effect on every render — it's set up exactly once.
  const saveProjectRef = useRef(() => {});
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const pressGreenFlagRef = useRef(() => {});
  const pressStopRef = useRef(() => {});
  const [presentMode, setPresentMode] = useState(false);

  const authHeaders = { Authorization: `Bearer ${token}` };

  // ── Autosave (every 20s while dirty) + warn before closing/reloading the
  // tab with unsaved changes. Declared here (before the loading-gate early
  // return below) since hooks must run unconditionally on every render —
  // the same lesson as the Blockly-injection effect's `[loading]` fix. ──
  useEffect(() => {
    const interval = setInterval(() => {
      if (dirtyRef.current && !savingRef.current) saveProjectRef.current();
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Keyboard shortcuts — Espace = drapeau vert, Échap = tout arrêter.
  // Ignored while an input/textarea (renaming a sprite, editing stage size,
  // a Blockly text field, …) has focus so a literal space keystroke isn't
  // hijacked.
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        pressGreenFlagRef.current();
      } else if (e.code === 'Escape') {
        pressStopRef.current();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Stylo (pen) canvas — a plain 2D canvas layered under the sprites,
  // sized to the stage's logical resolution (not its on-screen CSS size)
  // so drawing coordinates are just stage units, matching sprite.x/y
  // directly, with the browser handling the visual downscale via CSS. ──
  const clearPenCanvas = () => {
    const canvas = penCanvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  };

  const drawPenTrails = () => {
    const canvas = penCanvasRef.current;
    const rt = runtimeRef.current;
    if (!canvas || !rt) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    for (const sprite of rt.sprites.values()) {
      const prev = penPrevRef.current.get(sprite.id);
      if (sprite.penDown && prev && prev.penDown) {
        ctx.strokeStyle = sprite.penColor;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(w / 2 + prev.x, h / 2 - prev.y);
        ctx.lineTo(w / 2 + sprite.x, h / 2 - sprite.y);
        ctx.stroke();
      }
      penPrevRef.current.set(sprite.id, { x: sprite.x, y: sprite.y, penDown: sprite.penDown });
    }
  };

  const stampOnCanvas = (sprite) => {
    const canvas = penCanvasRef.current;
    const costume = sprite.costumes.find((c) => c.id === sprite.currentCostumeId) || sprite.costumes[0];
    if (!canvas || !costume) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth * ((sprite.size ?? 100) / 100);
      const h = img.naturalHeight * ((sprite.size ?? 100) / 100);
      ctx.drawImage(img, canvas.width / 2 + sprite.x - w / 2, canvas.height / 2 - sprite.y - h / 2, w, h);
    };
    img.src = resolveUrl(costume.image_url);
  };

  // ── Load project + create the runtime once ──────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`${apiBase}/${projectId}`, { headers: authHeaders });
        const data = await r.json();
        if (cancelled) return;
        setProject(data);
        setSelectedSpriteId(data.sprites?.[0]?.id || null);
        runtimeRef.current = new VakarBlockRuntime({
          sprites: new Map((data.sprites || []).map((s) => [s.id, new VakarSprite(s)])),
          onRender: () => { setRenderTick((t) => t + 1); drawPenTrails(); },
          onError: (e) => setErrorMsg(e?.message || String(e)),
          onPenClear: clearPenCanvas,
          onStamp: stampOnCanvas,
          onShowLoginPopup: () => setVgLoginPopup({}),
          onCloseLoginPopup: () => setVgLoginPopup(null),
          onLoadingScreen: (state) => setVgLoadingScreen(state?.visible ? state : null),
          initialBackdropName: (data.stage?.backdrops || []).find((b) => b.id === data.stage?.current_backdrop_id)?.name || null,
          // `basculer sur le décor` (vk_switch_backdrop) changes the visible
          // backdrop by NAME — look it up by name in the *live* project
          // state (not `data`, which goes stale the moment this closure was
          // created) and update `stage.current_backdrop_id` to match. An
          // unrecognized name is left alone rather than clearing the
          // backdrop — matches real Scratch, where switching to a
          // nonexistent backdrop name is a silent no-op, not a blank stage.
          onBackdropChange: (name) => {
            setProject((p) => {
              const found = (p.stage?.backdrops || []).find((b) => b.name === name);
              if (!found || p.stage.current_backdrop_id === found.id) return p;
              return { ...p, stage: { ...p.stage, current_backdrop_id: found.id } };
            });
          },
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      runtimeRef.current?.destroy();
      runtimeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, apiBase]);

  // ── Inject Blockly once the container exists ─────────────────────────────
  // Depends on `loading`, not `[]`: while loading is true this component
  // renders a spinner instead of the real layout, so `blocklyDivRef` isn't
  // attached to anything yet. An effect with `[]` deps only ever runs once,
  // right after that first (spinner) render — it would see a null ref and
  // permanently skip injection, since it never gets a second chance to run
  // once the real div exists. Re-running when `loading` flips to false is
  // what lets it actually find the div.
  useEffect(() => {
    if (!blocklyDivRef.current || workspaceRef.current) return;
    const ws = Blockly.inject(blocklyDivRef.current, {
      toolbox: TOOLBOX,
      renderer: 'zelos',
      theme: UNITY_BLOCKLY_THEME,
      trashcan: true,
      zoom: { controls: true, wheel: true, startScale: 0.85 },
      grid: { spacing: 24, length: 2, colour: '#333336', snap: true },
      move: { scrollbars: true, drag: true, wheel: false },
    });
    workspaceRef.current = ws;
    ws.addChangeListener((e) => {
      if (e.isUiEvent) return;
      setDirty(true);
    });
    return () => {
      ws.dispose();
      workspaceRef.current = null;
    };
  }, [loading]);

  // ── Load the selected sprite's script into the (single) Blockly workspace ─
  useEffect(() => {
    const ws = workspaceRef.current;
    if (!ws || !selectedSpriteId || !project) return;
    const sprite = project.sprites.find((s) => s.id === selectedSpriteId);
    ws.clear();
    if (sprite?.workspace) {
      try {
        Blockly.serialization.workspaces.load(sprite.workspace, ws);
      } catch (err) {
        console.error('Vakar Block: failed to load sprite workspace', err);
      }
    }
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSpriteId]);

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center h-full text-[#6a6a6a]" style={{ background: U.bg }}>
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  const selectedSprite = project.sprites.find((s) => s.id === selectedSpriteId) || null;
  const runtime = runtimeRef.current;
  const liveSprite = selectedSpriteId ? runtime?.sprites.get(selectedSpriteId) : null;

  // ── Sprite selection (persists the outgoing sprite's live workspace first) ─
  const selectSprite = (id) => {
    setStageSelected(false);
    if (id === selectedSpriteId) return;
    if (workspaceRef.current && selectedSpriteId) {
      const json = Blockly.serialization.workspaces.save(workspaceRef.current);
      setProject((p) => ({
        ...p,
        sprites: p.sprites.map((s) => (s.id === selectedSpriteId ? { ...s, workspace: json } : s)),
      }));
    }
    setSelectedSpriteId(id);
  };

  const addSprite = () => {
    setStageSelected(false);
    const id = genId();
    const newSprite = {
      id, name: `Sprite${project.sprites.length + 1}`,
      x: 0, y: 0, direction: 90, size: 100, visible: true,
      costumes: [], current_costume_id: null, sounds: [], workspace: null,
    };
    if (workspaceRef.current && selectedSpriteId) {
      const json = Blockly.serialization.workspaces.save(workspaceRef.current);
      setProject((p) => ({
        ...p,
        sprites: [...p.sprites.map((s) => (s.id === selectedSpriteId ? { ...s, workspace: json } : s)), newSprite],
      }));
    } else {
      setProject((p) => ({ ...p, sprites: [...p.sprites, newSprite] }));
    }
    runtime?.sprites.set(id, new VakarSprite(newSprite));
    setSelectedSpriteId(id);
  };

  const deleteSprite = (id) => {
    if (project.sprites.length <= 1) return;
    const remaining = project.sprites.filter((s) => s.id !== id);
    setProject((p) => ({ ...p, sprites: remaining }));
    runtime?.sprites.delete(id);
    if (selectedSpriteId === id) setSelectedSpriteId(remaining[0]?.id || null);
    setDirty(true);
  };

  const renameSprite = (id, name) => {
    setProject((p) => ({ ...p, sprites: p.sprites.map((s) => (s.id === id ? { ...s, name } : s)) }));
    const v = runtime?.sprites.get(id);
    if (v) v.name = name;
    setDirty(true);
  };

  const uploadCostume = async (file) => {
    if (!selectedSpriteId || !file) return;
    setErrorMsg('');
    const formData = new FormData();
    formData.append('file', file);
    const r = await fetch(`${apiBase}/${projectId}/asset`, { method: 'POST', headers: authHeaders, body: formData });
    const data = await r.json();
    if (!r.ok) { setErrorMsg(data.detail || "Impossible d'importer cette image."); return; }
    const costumeId = genId();
    const name = (file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'costume') || 'costume';
    setProject((p) => ({
      ...p,
      sprites: p.sprites.map((s) => s.id === selectedSpriteId ? {
        ...s,
        costumes: [...s.costumes, { id: costumeId, name, image_url: data.url }],
        current_costume_id: s.current_costume_id || costumeId,
      } : s),
    }));
    const v = runtime?.sprites.get(selectedSpriteId);
    if (v) {
      v.costumes = [...v.costumes, { id: costumeId, name, image_url: data.url }];
      if (!v.currentCostumeId) v.currentCostumeId = costumeId;
    }
    setDirty(true);
  };

  const deleteCostume = (costumeId) => {
    if (!selectedSpriteId) return;
    setProject((p) => ({
      ...p,
      sprites: p.sprites.map((s) => {
        if (s.id !== selectedSpriteId) return s;
        const costumes = s.costumes.filter((c) => c.id !== costumeId);
        return { ...s, costumes, current_costume_id: s.current_costume_id === costumeId ? (costumes[0]?.id || null) : s.current_costume_id };
      }),
    }));
    setDirty(true);
  };

  const moveCostume = (costumeId, direction) => {
    if (!selectedSpriteId) return;
    setProject((p) => ({
      ...p,
      sprites: p.sprites.map((s) => (s.id === selectedSpriteId ? { ...s, costumes: reorderById(s.costumes, costumeId, direction) } : s)),
    }));
    setDirty(true);
  };

  const uploadSound = async (file) => {
    if (!selectedSpriteId || !file) return;
    setErrorMsg('');
    const formData = new FormData();
    formData.append('file', file);
    const r = await fetch(`${apiBase}/${projectId}/asset`, { method: 'POST', headers: authHeaders, body: formData });
    const data = await r.json();
    if (!r.ok) { setErrorMsg(data.detail || "Impossible d'importer ce son."); return; }
    const soundId = genId();
    const name = file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'son';
    setProject((p) => ({
      ...p,
      sprites: p.sprites.map((s) => s.id === selectedSpriteId ? {
        ...s,
        sounds: [...(s.sounds || []), { id: soundId, name, audio_url: data.url }],
      } : s),
    }));
    const v = runtime?.sprites.get(selectedSpriteId);
    if (v) v.sounds = [...(v.sounds || []), { id: soundId, name, audio_url: data.url }];
    setDirty(true);
  };

  const deleteSound = (soundId) => {
    if (!selectedSpriteId) return;
    setProject((p) => ({
      ...p,
      sprites: p.sprites.map((s) => s.id === selectedSpriteId ? { ...s, sounds: (s.sounds || []).filter((snd) => snd.id !== soundId) } : s),
    }));
    const v = runtime?.sprites.get(selectedSpriteId);
    if (v) v.sounds = (v.sounds || []).filter((snd) => snd.id !== soundId);
    setDirty(true);
  };

  const moveSound = (soundId, direction) => {
    if (!selectedSpriteId) return;
    setProject((p) => ({
      ...p,
      sprites: p.sprites.map((s) => (s.id === selectedSpriteId ? { ...s, sounds: reorderById(s.sounds || [], soundId, direction) } : s)),
    }));
    setDirty(true);
  };

  const playSoundPreview = (soundUrl) => {
    const audio = new Audio(resolveUrl(soundUrl));
    audio.play().catch(() => {});
  };

  const uploadBackdrop = async (file) => {
    if (!file) return;
    setErrorMsg('');
    const formData = new FormData();
    formData.append('file', file);
    const r = await fetch(`${apiBase}/${projectId}/asset`, { method: 'POST', headers: authHeaders, body: formData });
    const data = await r.json();
    if (!r.ok) { setErrorMsg(data.detail || "Impossible d'importer cette image."); return; }
    const backdropId = genId();
    const name = file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'decor';
    setProject((p) => ({
      ...p,
      stage: {
        ...p.stage,
        backdrops: [...(p.stage.backdrops || []), { id: backdropId, name, image_url: data.url }],
        current_backdrop_id: p.stage.current_backdrop_id || backdropId,
      },
    }));
    setDirty(true);
  };

  const selectBackdrop = (id) => {
    setProject((p) => ({ ...p, stage: { ...p.stage, current_backdrop_id: id } }));
    setDirty(true);
  };

  const moveBackdrop = (id, direction) => {
    setProject((p) => ({ ...p, stage: { ...p.stage, backdrops: reorderById(p.stage.backdrops || [], id, direction) } }));
    setDirty(true);
  };

  const deleteBackdrop = (id) => {
    setProject((p) => {
      const backdrops = (p.stage.backdrops || []).filter((b) => b.id !== id);
      return {
        ...p,
        stage: {
          ...p.stage,
          backdrops,
          current_backdrop_id: p.stage.current_backdrop_id === id ? (backdrops[0]?.id || null) : p.stage.current_backdrop_id,
        },
      };
    });
    setDirty(true);
  };

  const renameBackdrop = (id, name) => {
    setProject((p) => ({
      ...p,
      stage: { ...p.stage, backdrops: (p.stage.backdrops || []).map((b) => (b.id === id ? { ...b, name } : b)) },
    }));
    setDirty(true);
  };

  const commitStageSize = (dim, rawValue, currentValue) => {
    const parsed = parseInt(rawValue, 10);
    const n = Math.max(160, Math.min(1280, Number.isFinite(parsed) ? parsed : currentValue));
    setProject((p) => ({ ...p, stage: { ...p.stage, [dim]: n } }));
    setDirty(true);
  };

  const startPanelResize = (e) => {
    e.preventDefault();
    resizingRef.current = true;
    const startX = e.clientX;
    const startWidth = rightPanelWidth;
    const onMove = (ev) => {
      if (!resizingRef.current) return;
      const next = Math.max(320, Math.min(680, startWidth + (startX - ev.clientX)));
      setRightPanelWidth(next);
    };
    const onUp = () => {
      resizingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (workspaceRef.current) Blockly.svgResize(workspaceRef.current);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const saveProject = async () => {
    setSaving(true);
    try {
      let sprites = project.sprites;
      if (workspaceRef.current && selectedSpriteId) {
        const json = Blockly.serialization.workspaces.save(workspaceRef.current);
        sprites = sprites.map((s) => (s.id === selectedSpriteId ? { ...s, workspace: json } : s));
      }
      const body = { name: project.name, stage: project.stage, sprites, variables: project.variables };
      const r = await fetch(`${apiBase}/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        setProject((p) => ({ ...p, sprites }));
        setDirty(false);
      } else {
        const data = await r.json().catch(() => ({}));
        setErrorMsg(data.detail || "Impossible d'enregistrer.");
      }
    } finally {
      setSaving(false);
    }
  };
  saveProjectRef.current = saveProject;
  dirtyRef.current = dirty;
  savingRef.current = saving;

  // Fetches an asset's real bytes (needed to MD5-name it the way .sb3
  // requires) and adds it to the zip, memoized per URL since costumes are
  // often reused across sprites/backdrops.
  const exportProjectAsSb3 = async () => {
    setExportingSb3(true);
    setErrorMsg('');
    try {
      let sprites = project.sprites;
      if (workspaceRef.current && selectedSpriteId) {
        const json = Blockly.serialization.workspaces.save(workspaceRef.current);
        sprites = sprites.map((s) => (s.id === selectedSpriteId ? { ...s, workspace: json } : s));
      }

      const zip = new JSZip();
      const warnings = new Set();
      const assetCache = new Map();
      const addAsset = async (url) => {
        if (!url) return null;
        if (assetCache.has(url)) return assetCache.get(url);
        const resp = await fetch(resolveUrl(url));
        const buf = await resp.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const hash = md5(bytes);
        const ext = (url.split('.').pop() || 'png').toLowerCase().split('?')[0];
        const filename = `${hash}.${ext}`;
        zip.file(filename, bytes);
        const entry = { assetId: hash, md5ext: filename, dataFormat: ext };
        assetCache.set(url, entry);
        return entry;
      };

      const targets = [];
      const stageBackdrops = [];
      for (const b of (project.stage?.backdrops || [])) {
        const a = await addAsset(b.image_url);
        if (a) stageBackdrops.push({ assetId: a.assetId, name: b.name, md5ext: a.md5ext, dataFormat: a.dataFormat, rotationCenterX: 0, rotationCenterY: 0 });
      }
      targets.push({
        isStage: true, name: 'Stage', variables: {}, lists: {}, broadcasts: {}, blocks: {}, comments: {},
        currentCostume: Math.max(0, stageBackdrops.findIndex((b, i) => (project.stage.backdrops[i] || {}).id === project.stage.current_backdrop_id)),
        costumes: stageBackdrops, sounds: [], volume: 100, layerOrder: 0, tempo: 60,
        videoTransparency: 50, videoState: 'on', textToSpeechLanguage: null,
      });

      for (const sprite of sprites) {
        const { blocks, variables } = exportSpriteWorkspace(sprite.workspace, warnings);
        const costumes = [];
        for (const c of sprite.costumes || []) {
          const a = await addAsset(c.image_url);
          if (a) costumes.push({ assetId: a.assetId, name: c.name, md5ext: a.md5ext, dataFormat: a.dataFormat, rotationCenterX: 0, rotationCenterY: 0 });
        }
        const sounds = [];
        for (const s of sprite.sounds || []) {
          const a = await addAsset(s.audio_url);
          if (a) sounds.push({ assetId: a.assetId, name: s.name, md5ext: a.md5ext, dataFormat: a.dataFormat, rate: 44100, sampleCount: 0 });
        }
        targets.push({
          isStage: false, name: sprite.name, variables, lists: {}, broadcasts: {}, blocks, comments: {},
          currentCostume: Math.max(0, (sprite.costumes || []).findIndex((c) => c.id === sprite.current_costume_id)),
          costumes, sounds, volume: sprite.volume ?? 100, visible: sprite.visible !== false,
          x: sprite.x || 0, y: sprite.y || 0, size: sprite.size ?? 100, direction: sprite.direction ?? 90,
          draggable: false, rotationStyle: 'all around', layerOrder: 1,
        });
      }

      const projectJson = { targets, monitors: [], extensions: [], meta: { semver: '3.0.0', vm: '0.2.0', agent: 'Vakar Block' } };
      zip.file('project.json', JSON.stringify(projectJson));
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.slug || 'projet'}.sb3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      if (warnings.size > 0) setErrorMsg(`Export : ${warnings.size} bloc(s) non exportés — ${Array.from(warnings).slice(0, 3).join(', ')}${warnings.size > 3 ? '…' : ''}`);
    } catch (err) {
      setErrorMsg(`Échec de l'export : ${err.message}`);
    } finally {
      setExportingSb3(false);
    }
  };

  const pressGreenFlag = () => {
    if (!runtime) return;
    let sprites = project.sprites;
    if (workspaceRef.current && selectedSpriteId) {
      const json = Blockly.serialization.workspaces.save(workspaceRef.current);
      sprites = sprites.map((s) => (s.id === selectedSpriteId ? { ...s, workspace: json } : s));
      setProject((p) => ({ ...p, sprites }));
    }
    runtime.sprites.clear();
    for (const s of sprites) runtime.sprites.set(s.id, new VakarSprite(s));
    for (const s of sprites) {
      const vSprite = runtime.sprites.get(s.id);
      if (s.id === selectedSpriteId && workspaceRef.current) {
        runtime.compileSprite(vSprite, workspaceRef.current);
      } else if (s.workspace) {
        const tempWs = new Blockly.Workspace();
        try {
          Blockly.serialization.workspaces.load(s.workspace, tempWs);
          runtime.compileSprite(vSprite, tempWs);
        } catch (err) {
          console.error('Vakar Block: compile error', err);
        } finally {
          tempWs.dispose();
        }
      }
    }
    setErrorMsg('');
    runtime.greenFlag();
  };

  const pressStop = () => runtime?.stop();
  pressGreenFlagRef.current = pressGreenFlag;
  pressStopRef.current = pressStop;

  const stage = project.stage || { width: 480, height: 360, backdrops: [], current_backdrop_id: null };
  const currentBackdrop = (stage.backdrops || []).find((b) => b.id === stage.current_backdrop_id);
  // Includes clones — `runtime.sprites` has extra entries beyond
  // `project.sprites` once a script has created any (see runtime.js's
  // createClone). Before anything has run, it mirrors project.sprites 1:1.
  // Sorted by layer (see runtime.js's `goToFrontBack`) — DOM order alone
  // gives correct visual stacking (later siblings draw on top), no z-index
  // needed.
  const displaySprites = (runtime ? Array.from(runtime.sprites.values()) : project.sprites)
    .slice()
    .sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0));
  const baseSize = 72;

  const handleStageMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * stage.width - stage.width / 2;
    const relY = stage.height / 2 - ((e.clientY - rect.top) / rect.height) * stage.height;
    runtime?.setMousePosition(relX, relY);
  };

  // Drag a sprite directly on the stage to reposition it — a plain click
  // (no movement past a small threshold) still triggers "quand ce sprite
  // est cliqué" instead, same distinction Scratch itself makes. Clones are
  // draggable too but never persisted back to `project.sprites` — they're
  // ephemeral runtime-only sprites with nothing to save.
  const startSpriteDrag = (e, sprite) => {
    e.stopPropagation();
    e.preventDefault();
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startX = sprite.x;
    const startY = sprite.y;
    let moved = false;
    const onMove = (ev) => {
      const rect = stageBoxRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (!moved && Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY) > 3) moved = true;
      if (!moved) return;
      const dxUnits = ((ev.clientX - startClientX) / rect.width) * stage.width;
      const dyUnits = ((ev.clientY - startClientY) / rect.height) * stage.height;
      sprite.x = startX + dxUnits;
      sprite.y = startY - dyUnits;
      setRenderTick((t) => t + 1);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (moved) {
        if (!sprite.isClone) {
          setProject((p) => ({ ...p, sprites: p.sprites.map((s) => (s.id === sprite.id ? { ...s, x: sprite.x, y: sprite.y } : s)) }));
          setDirty(true);
        }
      } else {
        runtime?.spriteClicked(sprite.id);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleBack = () => {
    if (dirty && !window.confirm('Des modifications ne sont pas enregistrées. Quitter quand même ?')) return;
    onBack();
  };

  return (
    <div className="h-full flex flex-col" style={{ background: U.bg }}>
      {/* Top bar — Unity's own toolbar: flat, dark, thin bottom border */}
      <div className="flex items-center gap-3 px-3 py-2 border-b shrink-0 flex-wrap" style={{ background: U.panelAlt, borderColor: U.border }}>
        <button onClick={handleBack} className={toolBtnCls}>
          <ArrowLeft size={16} />
        </button>

        {editingName ? (
          <input
            autoFocus
            value={project.name}
            onChange={(e) => setProject((p) => ({ ...p, name: e.target.value }))}
            onBlur={() => { setEditingName(false); setDirty(true); }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className={`text-sm font-semibold ${inputCls}`}
          />
        ) : (
          <button onClick={() => setEditingName(true)} className="flex items-center gap-1.5 text-sm font-semibold hover:opacity-80" style={{ color: U.text }}>
            {project.name}
            <Pencil size={11} style={{ color: U.textDim }} />
          </button>
        )}

        <div className="flex items-center gap-1.5 ml-1 px-1.5 border-x" style={{ borderColor: U.border }}>
          <button
            onClick={pressGreenFlag}
            title="Lancer le programme (Espace)"
            className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95"
            style={{ background: '#4CAF50' }}
          >
            <Flag size={14} fill="white" />
          </button>
          <button
            onClick={pressStop}
            title="Tout arrêter (Échap)"
            className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95"
            style={{ background: '#E64B3C' }}
          >
            <Square size={12} fill="white" />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {errorMsg && (
            <span className="flex items-center gap-1.5 text-[11px] text-red-400 max-w-[280px] truncate" title={errorMsg}>
              <AlertTriangle size={12} className="shrink-0" />{errorMsg}
            </span>
          )}
          {!presentMode && <span className="text-[11px]" style={{ color: U.textDim }}>{dirty ? 'Modifications non enregistrées' : 'À jour'}</span>}
          {!presentMode && (
            <button
              onClick={exportProjectAsSb3}
              disabled={exportingSb3}
              title="Exporter en .sb3 (ouvrable dans Scratch/TurboWarp)"
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold border transition-colors disabled:opacity-50"
              style={{ borderColor: U.border, color: U.text, background: U.panel }}
            >
              {exportingSb3 ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              {exportingSb3 ? 'Export…' : '.sb3'}
            </button>
          )}
          {!presentMode && (
            <button
              onClick={saveProject}
              disabled={saving}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold text-[#0e0e15] transition-colors disabled:opacity-50"
              style={{ background: U.accent }}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : dirty ? <Upload size={13} /> : <Check size={13} />}
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          )}
          <button
            onClick={() => { if (workspaceRef.current) Blockly.svgResize(workspaceRef.current); setPresentMode((v) => !v); }}
            title={presentMode ? 'Quitter la présentation' : 'Mode présentation — juste la scène'}
            className={toolBtnCls}
          >
            {presentMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* Body: Blockly workspace (left, majority — palette lives inside it) / stage+corral (right), same arrangement as Scratch's own editor.
          En mode présentation : seule la scène est affichée, en grand. */}
      <div className="flex-1 flex min-h-0">
        {/* Blockly workspace — hidden (not unmounted) in present mode: unmounting
            this div would detach Blockly's live injected SVG from the document
            while `workspaceRef.current` still points at it, and remounting a
            *new* div afterwards would leave the workspace's actual content
            stranded on the orphaned old node. CSS hiding keeps the same node. */}
        <div className={`flex-1 min-w-0 relative ${presentMode ? 'hidden' : ''}`}>
          <div ref={blocklyDivRef} className="absolute inset-0" />
        </div>

        {/* Drag handle — resizes the stage/corral panel; svgResize() on mouseup so Blockly's canvas catches up to its new width */}
        {!presentMode && (
          <div
            onMouseDown={startPanelResize}
            title="Glisser pour redimensionner"
            className="w-1 shrink-0 cursor-col-resize transition-colors"
            style={{ background: U.border }}
            onMouseEnter={(e) => { e.currentTarget.style.background = U.accent; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = U.border; }}
          />
        )}

        <div style={presentMode ? undefined : { width: rightPanelWidth, background: U.panel }} className={`${presentMode ? 'flex-1 items-center justify-center' : 'shrink-0'} flex flex-col overflow-y-auto`}>
          {/* Stage */}
          <div className={presentMode ? 'p-6 w-full max-w-3xl' : 'p-3 border-b'} style={presentMode ? undefined : { borderColor: U.border }}>
            <div
              ref={stageBoxRef}
              className="relative overflow-hidden border mx-auto"
              style={{
                width: '100%', maxWidth: presentMode ? 960 : rightPanelWidth - 40,
                aspectRatio: `${stage.width} / ${stage.height}`,
                borderColor: U.border,
                background: currentBackdrop ? `url(${resolveUrl(currentBackdrop.image_url)}) center/cover no-repeat` : '#0e0e10',
              }}
              onMouseMove={handleStageMouseMove}
              onMouseDown={() => runtime?.setMouseDown(true)}
              onMouseUp={() => runtime?.setMouseDown(false)}
            >
              <canvas
                ref={penCanvasRef}
                width={stage.width}
                height={stage.height}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
              {displaySprites.map((s) => {
                if (!s.visible) return null;
                const costume = s.costumes?.find((c) => c.id === (s.currentCostumeId ?? s.current_costume_id)) || s.costumes?.[0];
                const sizePx = (baseSize * (s.size ?? 100)) / 100;
                const leftPct = ((stage.width / 2 + s.x) / stage.width) * 100;
                const topPct = ((stage.height / 2 - s.y) / stage.height) * 100;
                // 'all around' rotates the costume with direction (default,
                // matches the sprite's own facing); 'left-right' only ever
                // mirrors horizontally (Scratch's usual platformer-character
                // convention — never tips the costume upside down); "don't
                // rotate" always draws it upright regardless of direction.
                const rotationStyle = s.rotationStyle || 'all around';
                let visualTransform = '';
                let bubbleCounterTransform = '';
                if (rotationStyle === 'all around') {
                  const deg = (s.direction ?? 90) - 90;
                  visualTransform = `rotate(${deg}deg)`;
                  bubbleCounterTransform = `rotate(${-deg}deg)`;
                } else if (rotationStyle === 'left-right') {
                  const normalized = (((s.direction ?? 90) + 180) % 360 + 360) % 360 - 180;
                  if (normalized < 0) {
                    visualTransform = 'scaleX(-1)';
                    bubbleCounterTransform = 'scaleX(-1)';
                  }
                }
                // Only couleur/fantôme/luminosité are visually implemented —
                // see runtime.js's VakarSprite.effects comment.
                const effects = s.effects || {};
                const opacity = Math.max(0, Math.min(1, 1 - (effects.GHOST || 0) / 100));
                const brightness = Math.max(0, (100 + (effects.BRIGHTNESS || 0)) / 100);
                const hueDeg = ((effects.COLOR || 0) / 200) * 360;
                return (
                  <div
                    key={s.id}
                    className="absolute cursor-grab"
                    onMouseDown={(e) => startSpriteDrag(e, s)}
                    style={{
                      left: `${leftPct}%`, top: `${topPct}%`,
                      width: sizePx, height: sizePx,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <div style={{ width: '100%', height: '100%', transform: visualTransform, opacity, filter: `brightness(${brightness}) hue-rotate(${hueDeg}deg)` }}>
                      {costume ? (
                        <img src={resolveUrl(costume.image_url)} alt="" className="w-full h-full object-contain select-none" draggable={false} />
                      ) : (
                        <div className="w-full h-full rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ background: COLORS.motion }}>
                          {(s.name || '?').slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    {s.bubbleText && (
                      <div style={{ transform: bubbleCounterTransform }}>
                        <SpeechBubble text={s.bubbleText} />
                      </div>
                    )}
                  </div>
                );
              })}
              {/* VakarGames "afficher texte" overlay — same stage coordinate
                  system as sprites above (see runtime.js's vgShowText). */}
              {runtime && Array.from(runtime.texts.values()).map((t, i) => {
                if (t.visible === false) return null;
                const leftPct = ((stage.width / 2 + (t.x || 0)) / stage.width) * 100;
                const topPct = ((stage.height / 2 - (t.y || 0)) / stage.height) * 100;
                const scaledSize = (t.size || 24) * (stage.width / 480);
                return (
                  <div
                    key={i}
                    className="absolute pointer-events-none whitespace-pre"
                    style={{
                      left: `${leftPct}%`, top: `${topPct}%`,
                      transform: 'translate(-50%, -50%)',
                      fontFamily: t.font || 'Arial',
                      fontSize: scaledSize,
                      color: t.color || '#FFFFFF',
                      fontWeight: t.bold ? 'bold' : 'normal',
                      fontStyle: t.italic ? 'italic' : 'normal',
                    }}
                  >
                    {t.text}
                  </div>
                );
              })}
            </div>

            {!presentMode && (
              <div className="flex items-center gap-2 mt-2.5">
                <label className="text-[10px] font-semibold" style={{ color: U.textMuted }}>Largeur</label>
                <input
                  type="number"
                  value={widthDraft !== null ? widthDraft : stage.width}
                  onChange={(e) => setWidthDraft(e.target.value)}
                  onBlur={(e) => { commitStageSize('width', e.target.value, stage.width); setWidthDraft(null); }}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  className={`w-16 ${inputCls}`}
                />
                <label className="text-[10px] font-semibold" style={{ color: U.textMuted }}>Hauteur</label>
                <input
                  type="number"
                  value={heightDraft !== null ? heightDraft : stage.height}
                  onChange={(e) => setHeightDraft(e.target.value)}
                  onBlur={(e) => { commitStageSize('height', e.target.value, stage.height); setHeightDraft(null); }}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  className={`w-16 ${inputCls}`}
                />
              </div>
            )}
          </div>

          {/* Corral: Scène (backdrops) tile + sprite tiles, Scratch's own layout */}
          {!presentMode && (
          <div className="p-3 border-b" style={{ borderColor: U.border }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: U.textMuted }}>Scène et sprites</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setStageSelected(true)}
                className="relative rounded p-1.5 flex flex-col items-center gap-1 border transition-all"
                style={stageSelected ? { borderColor: U.accent, background: `${U.accent}1a` } : { borderColor: 'transparent', background: U.panelAlt }}
              >
                {currentBackdrop ? (
                  <img src={resolveUrl(currentBackdrop.image_url)} alt="" className="w-9 h-9 rounded object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded flex items-center justify-center text-white" style={{ background: COLORS.events }}>
                    <MonitorPlay size={18} />
                  </div>
                )}
                <span className="text-[10px] font-medium truncate max-w-full" style={{ color: U.text }}>Scène</span>
              </button>
              {project.sprites.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectSprite(s.id)}
                  className="relative rounded p-1.5 flex flex-col items-center gap-1 border transition-all"
                  style={!stageSelected && selectedSpriteId === s.id ? { borderColor: U.accent, background: `${U.accent}1a` } : { borderColor: 'transparent', background: U.panelAlt }}
                >
                  <SpriteThumb sprite={s} size={36} />
                  <span className="text-[10px] font-medium truncate max-w-full" style={{ color: U.text }}>{s.name}</span>
                </button>
              ))}
              <button
                onClick={addSprite}
                title="Ajouter un sprite"
                className="rounded p-1.5 flex flex-col items-center justify-center gap-1 border border-dashed min-h-[62px] transition-colors"
                style={{ borderColor: U.border, color: U.textDim }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = U.accent; e.currentTarget.style.color = U.accent; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = U.border; e.currentTarget.style.color = U.textDim; }}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          )}

          {/* Scène sélectionnée : liste des décors */}
          {!presentMode && stageSelected && (
            <div className="p-3 flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: U.textMuted }}>Décors</p>
                <button onClick={() => backdropInputRef.current?.click()} className="p-1 rounded" style={{ color: U.accent }}>
                  <Plus size={13} />
                </button>
                <input ref={backdropInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { uploadBackdrop(e.target.files?.[0]); e.target.value = ''; }} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(stage.backdrops || []).map((b) => (
                  <div key={b.id} className="relative group">
                    <button
                      onClick={() => selectBackdrop(b.id)}
                      className="w-full rounded p-1.5 flex flex-col items-center gap-1 border transition-all"
                      style={stage.current_backdrop_id === b.id ? { borderColor: U.accent, background: `${U.accent}1a` } : { borderColor: 'transparent', background: U.panelAlt }}
                    >
                      <img src={resolveUrl(b.image_url)} alt={b.name} className="w-9 h-9 rounded object-cover" />
                      <span className="text-[9px] truncate max-w-full" style={{ color: U.textMuted }}>{b.name}</span>
                    </button>
                    <button onClick={() => deleteBackdrop(b.id)} className="absolute -top-1 -right-1 hidden group-hover:flex w-4 h-4 rounded-full bg-red-500 text-white items-center justify-center text-[9px]">×</button>
                    <button onClick={() => moveBackdrop(b.id, -1)} className="absolute bottom-0.5 left-0.5 hidden group-hover:flex w-4 h-4 rounded-full bg-black/80 text-white items-center justify-center shadow"><ChevronLeft size={10} /></button>
                    <button onClick={() => moveBackdrop(b.id, 1)} className="absolute bottom-0.5 right-0.5 hidden group-hover:flex w-4 h-4 rounded-full bg-black/80 text-white items-center justify-center shadow"><ChevronRight size={10} /></button>
                  </div>
                ))}
                {(stage.backdrops || []).length === 0 && (
                  <p className="col-span-3 text-[10px]" style={{ color: U.textDim }}>Aucun décor — importe une image pour habiller la scène.</p>
                )}
              </div>
              {stage.current_backdrop_id && (
                <input
                  value={(stage.backdrops || []).find((b) => b.id === stage.current_backdrop_id)?.name || ''}
                  onChange={(e) => renameBackdrop(stage.current_backdrop_id, e.target.value)}
                  className={`mt-3 w-full font-semibold ${inputCls}`}
                />
              )}
            </div>
          )}

          {/* Selected sprite: name + costumes */}
          {!presentMode && !stageSelected && selectedSprite && (
            <div className="p-3 flex-1">
              <div className="flex items-center gap-2 mb-3">
                <input
                  value={selectedSprite.name}
                  onChange={(e) => renameSprite(selectedSprite.id, e.target.value)}
                  className={`flex-1 min-w-0 font-semibold ${inputCls}`}
                />
                {project.sprites.length > 1 && (
                  <button onClick={() => deleteSprite(selectedSprite.id)} className="p-1.5 rounded text-[#9a9a9a] hover:text-red-400 hover:bg-red-500/10 shrink-0">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              {liveSprite && (
                <p className="text-[10px] font-mono mb-3" style={{ color: U.textDim }}>
                  x: {Math.round(liveSprite.x)} · y: {Math.round(liveSprite.y)} · {Math.round(liveSprite.direction)}°
                </p>
              )}

              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: U.textMuted }}>Costumes</p>
                <button onClick={() => costumeInputRef.current?.click()} className="p-1 rounded" style={{ color: U.accent }}>
                  <Plus size={13} />
                </button>
                <input ref={costumeInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { uploadCostume(e.target.files?.[0]); e.target.value = ''; }} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {selectedSprite.costumes.map((c) => (
                  <div key={c.id} className="relative group rounded border p-1.5 flex flex-col items-center gap-1" style={{ background: U.panelAlt, borderColor: U.border }}>
                    <img src={resolveUrl(c.image_url)} alt={c.name} className="w-9 h-9 object-contain" />
                    <span className="text-[9px] truncate max-w-full" style={{ color: U.textMuted }}>{c.name}</span>
                    <button onClick={() => deleteCostume(c.id)} className="absolute -top-1 -right-1 hidden group-hover:flex w-4 h-4 rounded-full bg-red-500 text-white items-center justify-center text-[9px]">×</button>
                    <button onClick={() => moveCostume(c.id, -1)} className="absolute bottom-0.5 left-0.5 hidden group-hover:flex w-4 h-4 rounded-full bg-black/80 text-white items-center justify-center shadow"><ChevronLeft size={10} /></button>
                    <button onClick={() => moveCostume(c.id, 1)} className="absolute bottom-0.5 right-0.5 hidden group-hover:flex w-4 h-4 rounded-full bg-black/80 text-white items-center justify-center shadow"><ChevronRight size={10} /></button>
                  </div>
                ))}
                {selectedSprite.costumes.length === 0 && (
                  <p className="col-span-3 text-[10px]" style={{ color: U.textDim }}>Aucun costume — importe une image.</p>
                )}
              </div>

              <div className="flex items-center justify-between mb-2 mt-4">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: U.textMuted }}>Sons</p>
                <button onClick={() => soundInputRef.current?.click()} className="p-1 rounded" style={{ color: U.accent }}>
                  <Plus size={13} />
                </button>
                <input ref={soundInputRef} type="file" accept="audio/*,.mp3,.wav,.ogg" className="hidden" onChange={(e) => { uploadSound(e.target.files?.[0]); e.target.value = ''; }} />
              </div>
              <div className="space-y-1.5">
                {(selectedSprite.sounds || []).map((snd) => (
                  <div key={snd.id} className="flex items-center gap-2 rounded border px-2 py-1.5" style={{ background: U.panelAlt, borderColor: U.border }}>
                    <button onClick={() => playSoundPreview(snd.audio_url)} className="p-1 rounded shrink-0" style={{ color: U.accent }} title="Écouter">
                      <Volume2 size={13} />
                    </button>
                    <span className="text-xs truncate flex-1" style={{ color: U.text }}>{snd.name}</span>
                    <button onClick={() => moveSound(snd.id, -1)} className="p-1 rounded shrink-0 hover:text-white" style={{ color: U.textDim }}><ChevronUp size={12} /></button>
                    <button onClick={() => moveSound(snd.id, 1)} className="p-1 rounded shrink-0 hover:text-white" style={{ color: U.textDim }}><ChevronDown size={12} /></button>
                    <button onClick={() => deleteSound(snd.id)} className="p-1 rounded shrink-0 hover:text-red-400" style={{ color: U.textDim }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {(selectedSprite.sounds || []).length === 0 && (
                  <p className="text-[10px]" style={{ color: U.textDim }}>Aucun son — importe un fichier mp3, wav ou ogg.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {vgLoadingScreen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center" style={{ background: 'rgba(10,15,25,0.88)', backdropFilter: 'blur(4px)' }}>
          <div style={{ width: 'min(620px, 82vw)' }}>
            <div className="w-full rounded overflow-hidden" style={{ height: 8, background: 'rgba(255,255,255,0.12)' }}>
              <div style={{ height: '100%', width: '0%', background: U.accent, borderRadius: 4, transition: 'width 0.3s ease' }} />
            </div>
          </div>
        </div>
      )}

      {vgLoginPopup && (
        <VGLoginPopup
          runtime={runtimeRef.current}
          onDone={() => setVgLoginPopup(null)}
        />
      )}
    </div>
  );
}

// VakarGames Play login/register popup — a React-managed equivalent of the
// original TurboWarp extension's raw document.body overlay (see
// runtime.js's vgPlayShowLogin/vgPlayAttemptLogin/vgPlayAttemptRegister —
// this component only renders the form and calls those; the actual network
// calls and session storage live in the runtime, independent of any DOM).
// French-only (unlike the original's 6-language selector) — matching this
// whole editor's French-only convention.
function VGLoginPopup({ runtime, onDone }) {
  const [tab, setTab] = useState('login');
  const [loginField, setLoginField] = useState('');
  const [loginPwd, setLoginPwd] = useState('');
  const [regUser, setRegUser] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPwd, setRegPwd] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const finish = () => {
    runtime?.vgPlayResolveLogin();
    onDone();
  };

  const submitLogin = async () => {
    setError(''); setBusy(true);
    const res = await runtime.vgPlayAttemptLogin(loginField.trim(), loginPwd);
    setBusy(false);
    if (res.ok) finish(); else setError(res.error);
  };
  const submitRegister = async () => {
    setError(''); setBusy(true);
    const res = await runtime.vgPlayAttemptRegister(regUser.trim(), regEmail.trim(), regPwd);
    setBusy(false);
    if (res.ok) finish(); else setError(res.error);
  };

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="rounded-2xl p-8 w-[340px] max-w-[90vw]" style={{ background: '#fff' }}>
        <div className="text-center mb-5">
          <div className="w-11 h-11 rounded-xl mx-auto mb-2.5 flex items-center justify-center" style={{ background: COLORS.vakargames }}>
            <Users size={20} color="#fff" />
          </div>
          <p className="text-lg font-bold" style={{ color: '#1a1a1a' }}>VakarGames Play</p>
        </div>
        <div className="flex gap-1 rounded-lg p-1 mb-5" style={{ background: '#f3f4f6' }}>
          {[['login', 'Connexion'], ['register', 'Créer un compte']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setTab(key); setError(''); }}
              className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-all"
              style={tab === key ? { background: '#fff', color: COLORS.vakargames, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' } : { background: 'transparent', color: '#666' }}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'login' ? (
          <div className="space-y-2.5">
            <input value={loginField} onChange={(e) => setLoginField(e.target.value)} placeholder="Pseudo ou email" className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none" style={{ borderColor: '#e5e7eb', color: '#1a1a1a' }} />
            <input value={loginPwd} onChange={(e) => setLoginPwd(e.target.value)} type="password" placeholder="Mot de passe" className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none" style={{ borderColor: '#e5e7eb', color: '#1a1a1a' }} />
            <button onClick={submitLogin} disabled={busy} className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-70" style={{ background: COLORS.vakargames }}>Se connecter</button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <input value={regUser} onChange={(e) => setRegUser(e.target.value)} placeholder="Pseudo (3-20 car., lettres/chiffres/_)" className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none" style={{ borderColor: '#e5e7eb', color: '#1a1a1a' }} />
            <input value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="Email" className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none" style={{ borderColor: '#e5e7eb', color: '#1a1a1a' }} />
            <input value={regPwd} onChange={(e) => setRegPwd(e.target.value)} type="password" placeholder="Mot de passe (min 6 car.)" className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none" style={{ borderColor: '#e5e7eb', color: '#1a1a1a' }} />
            <button onClick={submitRegister} disabled={busy} className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-70" style={{ background: COLORS.vakargames }}>Créer le compte</button>
          </div>
        )}
        {error && <p className="text-xs text-center mt-2.5" style={{ color: '#e53e3e' }}>{error}</p>}
      </div>
    </div>
  );
}
