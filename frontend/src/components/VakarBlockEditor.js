import React, { useState, useEffect, useRef } from 'react';
import * as Blockly from 'blockly/core';
import {
  ArrowLeft, Flag, Square, Plus, Trash2, Upload,
  Loader2, Check, AlertTriangle, Pencil, MonitorPlay,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuth } from '../context/AuthContext';
import { TOOLBOX, COLORS } from '../vakarBlock/blocks';
import '../vakarBlock/generators';
import { VakarBlockRuntime, VakarSprite } from '../vakarBlock/runtime';

const API = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || '';

const resolveUrl = (url) => (url && url.startsWith('/') ? `${API}${url}` : url);
const genId = () => Math.random().toString(36).slice(2, 10);

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
  const [dirty, setDirty] = useState(false);
  const [selectedSpriteId, setSelectedSpriteId] = useState(null);
  const [stageSelected, setStageSelected] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [, setRenderTick] = useState(0);
  const [editingName, setEditingName] = useState(false);

  const blocklyDivRef = useRef(null);
  const workspaceRef = useRef(null);
  const runtimeRef = useRef(null);
  const costumeInputRef = useRef(null);
  const backdropInputRef = useRef(null);

  const authHeaders = { Authorization: `Bearer ${token}` };

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
          onRender: () => setRenderTick((t) => t + 1),
          onError: (e) => setErrorMsg(e?.message || String(e)),
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
  useEffect(() => {
    if (!blocklyDivRef.current || workspaceRef.current) return;
    const ws = Blockly.inject(blocklyDivRef.current, {
      toolbox: TOOLBOX,
      renderer: 'zelos',
      trashcan: true,
      zoom: { controls: true, wheel: true, startScale: 0.85 },
      grid: { spacing: 24, length: 2, colour: '#e2e2ea', snap: true },
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
  }, []);

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
      <div className="flex items-center justify-center h-[70vh] text-[#A1A1A6]">
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
      costumes: [], current_costume_id: null, workspace: null,
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

  const setStageSize = (dim, value) => {
    const n = Math.max(160, Math.min(1280, parseInt(value, 10) || 0));
    setProject((p) => ({ ...p, stage: { ...p.stage, [dim]: n } }));
    setDirty(true);
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

  const stage = project.stage || { width: 480, height: 360, backdrops: [], current_backdrop_id: null };
  const currentBackdrop = (stage.backdrops || []).find((b) => b.id === stage.current_backdrop_id);
  const displaySprites = project.sprites.map((s) => runtime?.sprites.get(s.id) || s);
  const baseSize = 72;

  return (
    <div className="h-full flex flex-col bg-[#F5F5F7] dark:bg-[#0e0e15]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#D2D2D7] dark:border-[#2a2a3c] bg-white dark:bg-[#151520] shrink-0 flex-wrap">
        <button onClick={onBack} className="p-2 rounded-lg text-[#6E6E73] dark:text-[#a1a1aa] hover:bg-[#F5F5F7] dark:hover:bg-white/[0.06]">
          <ArrowLeft size={16} />
        </button>

        {editingName ? (
          <input
            autoFocus
            value={project.name}
            onChange={(e) => setProject((p) => ({ ...p, name: e.target.value }))}
            onBlur={() => { setEditingName(false); setDirty(true); }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className="text-sm font-semibold rounded-lg px-2 py-1 bg-[#F5F5F7] dark:bg-[#0d0d14] border border-[#4ECDC4] text-[#1D1D1F] dark:text-[#e4e4e7] outline-none"
          />
        ) : (
          <button onClick={() => setEditingName(true)} className="flex items-center gap-1.5 text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] hover:opacity-70">
            {project.name}
            <Pencil size={11} className="text-[#A1A1A6]" />
          </button>
        )}

        <div className="flex items-center gap-2 ml-1">
          <button
            onClick={pressGreenFlag}
            title="Lancer le programme"
            className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
            style={{ background: '#4CAF50' }}
          >
            <Flag size={16} fill="white" />
          </button>
          <button
            onClick={pressStop}
            title="Tout arrêter"
            className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
            style={{ background: '#EF5350' }}
          >
            <Square size={14} fill="white" />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {errorMsg && (
            <span className="flex items-center gap-1.5 text-[11px] text-red-500 max-w-[280px] truncate" title={errorMsg}>
              <AlertTriangle size={12} className="shrink-0" />{errorMsg}
            </span>
          )}
          <span className="text-[11px] text-[#A1A1A6] dark:text-[#71717a]">{dirty ? 'Modifications non enregistrées' : 'À jour'}</span>
          <Button size="sm" icon={dirty ? Upload : Check} loading={saving} onClick={saveProject}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>

      {/* Body: Blockly workspace (left, majority — palette lives inside it) / stage+corral (right), same arrangement as Scratch's own editor */}
      <div className="flex-1 flex min-h-0">
        {/* Blockly workspace */}
        <div className="flex-1 min-w-0 relative">
          <div ref={blocklyDivRef} className="absolute inset-0" />
        </div>

        <div className="w-[340px] shrink-0 flex flex-col border-l border-[#D2D2D7] dark:border-[#2a2a3c] bg-white dark:bg-[#151520] overflow-y-auto">
          {/* Stage */}
          <div className="p-3 border-b border-[#D2D2D7] dark:border-[#2a2a3c]">
            <div
              className="relative rounded-xl overflow-hidden border-2 mx-auto"
              style={{
                width: '100%', maxWidth: 320,
                aspectRatio: `${stage.width} / ${stage.height}`,
                borderColor: COLORS.events,
                background: currentBackdrop ? `url(${resolveUrl(currentBackdrop.image_url)}) center/cover no-repeat` : 'linear-gradient(135deg, #eafcfb, #e4f3ff)',
              }}
            >
              {displaySprites.map((s) => {
                if (!s.visible) return null;
                const costume = s.costumes?.find((c) => c.id === (s.currentCostumeId ?? s.current_costume_id)) || s.costumes?.[0];
                const sizePx = (baseSize * (s.size ?? 100)) / 100;
                const leftPct = ((stage.width / 2 + s.x) / stage.width) * 100;
                const topPct = ((stage.height / 2 - s.y) / stage.height) * 100;
                return (
                  <div
                    key={s.id}
                    className="absolute cursor-pointer"
                    onClick={() => runtime?.spriteClicked(s.id)}
                    style={{
                      left: `${leftPct}%`, top: `${topPct}%`,
                      width: sizePx, height: sizePx,
                      transform: `translate(-50%, -50%) rotate(${(s.direction ?? 90) - 90}deg)`,
                    }}
                  >
                    {costume ? (
                      <img src={resolveUrl(costume.image_url)} alt="" className="w-full h-full object-contain select-none" draggable={false} />
                    ) : (
                      <div className="w-full h-full rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ background: COLORS.motion }}>
                        {(s.name || '?').slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    {s.bubbleText && (
                      <div style={{ transform: `rotate(${-(((s.direction ?? 90) - 90))}deg)` }}>
                        <SpeechBubble text={s.bubbleText} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 mt-2.5">
              <label className="text-[10px] text-[#6E6E73] dark:text-[#a1a1aa] font-semibold">Largeur</label>
              <input type="number" value={stage.width} onChange={(e) => setStageSize('width', e.target.value)}
                className="w-16 rounded px-1.5 py-1 text-xs bg-[#F5F5F7] dark:bg-[#0d0d14] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#e4e4e7]" />
              <label className="text-[10px] text-[#6E6E73] dark:text-[#a1a1aa] font-semibold">Hauteur</label>
              <input type="number" value={stage.height} onChange={(e) => setStageSize('height', e.target.value)}
                className="w-16 rounded px-1.5 py-1 text-xs bg-[#F5F5F7] dark:bg-[#0d0d14] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#e4e4e7]" />
            </div>
          </div>

          {/* Corral: Scène (backdrops) tile + sprite tiles, Scratch's own layout */}
          <div className="p-3 border-b border-[#D2D2D7] dark:border-[#2a2a3c]">
            <p className="text-[10px] font-bold text-[#A1A1A6] dark:text-[#71717a] uppercase tracking-widest mb-2">Scène et sprites</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setStageSelected(true)}
                className={`relative rounded-lg p-1.5 flex flex-col items-center gap-1 border-2 transition-all ${stageSelected ? 'border-[#4ECDC4] bg-[#4ECDC4]/5' : 'border-transparent bg-[#F5F5F7] dark:bg-[#0d0d14] hover:border-[#D2D2D7]'}`}
              >
                {currentBackdrop ? (
                  <img src={resolveUrl(currentBackdrop.image_url)} alt="" className="w-9 h-9 rounded object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded flex items-center justify-center text-white" style={{ background: COLORS.events }}>
                    <MonitorPlay size={18} />
                  </div>
                )}
                <span className="text-[10px] font-medium text-[#1D1D1F] dark:text-[#e4e4e7]">Scène</span>
              </button>
              {project.sprites.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectSprite(s.id)}
                  className={`relative rounded-lg p-1.5 flex flex-col items-center gap-1 border-2 transition-all ${!stageSelected && selectedSpriteId === s.id ? 'border-[#4ECDC4] bg-[#4ECDC4]/5' : 'border-transparent bg-[#F5F5F7] dark:bg-[#0d0d14] hover:border-[#D2D2D7]'}`}
                >
                  <SpriteThumb sprite={s} size={36} />
                  <span className="text-[10px] font-medium text-[#1D1D1F] dark:text-[#e4e4e7] truncate max-w-full">{s.name}</span>
                </button>
              ))}
              <button
                onClick={addSprite}
                title="Ajouter un sprite"
                className="rounded-lg p-1.5 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-[#D2D2D7] dark:border-[#2a2a3c] text-[#A1A1A6] hover:border-[#4ECDC4] hover:text-[#4ECDC4] min-h-[62px]"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Scène sélectionnée : liste des décors */}
          {stageSelected && (
            <div className="p-3 flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-[#A1A1A6] dark:text-[#71717a] uppercase tracking-widest">Décors</p>
                <button onClick={() => backdropInputRef.current?.click()} className="p-1 rounded-lg text-[#4ECDC4] hover:bg-[#4ECDC4]/10">
                  <Plus size={13} />
                </button>
                <input ref={backdropInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { uploadBackdrop(e.target.files?.[0]); e.target.value = ''; }} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(stage.backdrops || []).map((b) => (
                  <div key={b.id} className="relative group">
                    <button
                      onClick={() => selectBackdrop(b.id)}
                      className={`w-full rounded-lg p-1.5 flex flex-col items-center gap-1 border-2 transition-all ${stage.current_backdrop_id === b.id ? 'border-[#4ECDC4] bg-[#4ECDC4]/5' : 'border-transparent bg-[#F5F5F7] dark:bg-[#0d0d14] hover:border-[#D2D2D7]'}`}
                    >
                      <img src={resolveUrl(b.image_url)} alt={b.name} className="w-9 h-9 rounded object-cover" />
                      <span className="text-[9px] text-[#6E6E73] dark:text-[#a1a1aa] truncate max-w-full">{b.name}</span>
                    </button>
                    <button onClick={() => deleteBackdrop(b.id)} className="absolute -top-1 -right-1 hidden group-hover:flex w-4 h-4 rounded-full bg-red-500 text-white items-center justify-center text-[9px]">×</button>
                  </div>
                ))}
                {(stage.backdrops || []).length === 0 && (
                  <p className="col-span-3 text-[10px] text-[#A1A1A6] dark:text-[#71717a]">Aucun décor — importe une image pour habiller la scène.</p>
                )}
              </div>
              {stage.current_backdrop_id && (
                <input
                  value={(stage.backdrops || []).find((b) => b.id === stage.current_backdrop_id)?.name || ''}
                  onChange={(e) => renameBackdrop(stage.current_backdrop_id, e.target.value)}
                  className="mt-3 w-full rounded-lg px-2 py-1.5 text-xs font-semibold bg-[#F5F5F7] dark:bg-[#0d0d14] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#e4e4e7]"
                />
              )}
            </div>
          )}

          {/* Selected sprite: name + costumes */}
          {!stageSelected && selectedSprite && (
            <div className="p-3 flex-1">
              <div className="flex items-center gap-2 mb-3">
                <input
                  value={selectedSprite.name}
                  onChange={(e) => renameSprite(selectedSprite.id, e.target.value)}
                  className="flex-1 min-w-0 rounded-lg px-2 py-1.5 text-xs font-semibold bg-[#F5F5F7] dark:bg-[#0d0d14] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#e4e4e7]"
                />
                {project.sprites.length > 1 && (
                  <button onClick={() => deleteSprite(selectedSprite.id)} className="p-1.5 rounded-lg text-[#A1A1A6] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 shrink-0">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              {liveSprite && (
                <p className="text-[10px] text-[#A1A1A6] dark:text-[#71717a] font-mono mb-3">
                  x: {Math.round(liveSprite.x)} · y: {Math.round(liveSprite.y)} · {Math.round(liveSprite.direction)}°
                </p>
              )}

              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-[#A1A1A6] dark:text-[#71717a] uppercase tracking-widest">Costumes</p>
                <button onClick={() => costumeInputRef.current?.click()} className="p-1 rounded-lg text-[#4ECDC4] hover:bg-[#4ECDC4]/10">
                  <Plus size={13} />
                </button>
                <input ref={costumeInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { uploadCostume(e.target.files?.[0]); e.target.value = ''; }} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {selectedSprite.costumes.map((c) => (
                  <div key={c.id} className="relative group rounded-lg bg-[#F5F5F7] dark:bg-[#0d0d14] border border-[#D2D2D7] dark:border-[#2a2a3c] p-1.5 flex flex-col items-center gap-1">
                    <img src={resolveUrl(c.image_url)} alt={c.name} className="w-9 h-9 object-contain" />
                    <span className="text-[9px] text-[#6E6E73] dark:text-[#a1a1aa] truncate max-w-full">{c.name}</span>
                    <button onClick={() => deleteCostume(c.id)} className="absolute -top-1 -right-1 hidden group-hover:flex w-4 h-4 rounded-full bg-red-500 text-white items-center justify-center text-[9px]">×</button>
                  </div>
                ))}
                {selectedSprite.costumes.length === 0 && (
                  <p className="col-span-3 text-[10px] text-[#A1A1A6] dark:text-[#71717a]">Aucun costume — importe une image.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
