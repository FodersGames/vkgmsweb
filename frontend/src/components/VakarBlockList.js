import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Blocks, Building2, Users, Search, Upload, AlertTriangle, X, Info, CheckCircle2, XCircle, Terminal } from 'lucide-react';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ConfirmDialog } from './ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import VakarBlockEditor from './VakarBlockEditor';
import { parseSb3, buildProjectFromSb3 } from '../vakarBlock/sb3';
import { VAKAR_BLOCK_TEMPLATES } from '../vakarBlock/templates';

const API = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || '';

const timeAgo = (iso) => {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export default function VakarBlockList() {
  const { token } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const [importLogs, setImportLogs] = useState(null); // null = no import run yet; [] once one starts
  const [pendingOpenId, setPendingOpenId] = useState(null); // project imported, waiting for the user to review the log before opening
  const importInputRef = useRef(null);
  const logsEndRef = useRef(null);

  useEffect(() => {
    if (importLogs) logsEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [importLogs]);

  const pushLog = (level, message) => setImportLogs((prev) => [...(prev || []), { level, message, t: Date.now() }]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/vakar-block-projects`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      setProjects(data.projects || []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { if (!editingId) load(); }, [load, editingId]);

  const createProject = async () => {
    if (!newName.trim()) return;
    const r = await fetch(`${API}/api/admin/vakar-block-projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await r.json();
    const template = VAKAR_BLOCK_TEMPLATES.find((t) => t.id === selectedTemplateId);
    if (data.id && template) {
      const built = template.build();
      await fetch(`${API}/api/admin/vakar-block-projects/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stage: built.stage, sprites: built.sprites }),
      });
    }
    setNewName('');
    setSelectedTemplateId(null);
    setCreating(false);
    if (data.id) setEditingId(data.id);
  };

  // Uploads one costume/backdrop/sound asset (extracted from the .sb3 zip)
  // through the same endpoint the editor's own upload buttons use.
  const uploadAssetBlob = async (projectId, blob, filename) => {
    const formData = new FormData();
    formData.append('file', new File([blob], filename));
    const r = await fetch(`${API}/api/admin/vakar-block-projects/${projectId}/asset`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || `Échec de l'import de ${filename}`);
    return data.url;
  };

  const importSb3File = async (file) => {
    if (!file) return;
    setImporting(true);
    setImportLogs([]);
    setPendingOpenId(null);
    let errorCount = 0;
    let projectId = null;
    try {
      pushLog('info', `Lecture de « ${file.name} » (${(file.size / 1024).toFixed(0)} Ko)…`);
      const buffer = await file.arrayBuffer();
      const { zip, projectJson } = await parseSb3(buffer);
      pushLog('success', `Archive .sb3 décompressée — ${(projectJson.targets || []).length} cible(s) (scène + sprites) trouvée(s).`);

      pushLog('info', 'Traduction des blocs Scratch en blocs Vakar Block…');
      const { stage, sprites, warnings } = buildProjectFromSb3(projectJson);
      pushLog(warnings.length ? 'warn' : 'success', `Traduction terminée — ${sprites.length} sprite(s), ${warnings.length} bloc(s)/champ(s) non pris en charge.`);
      for (const w of warnings) pushLog('warn', `  ↳ non pris en charge : ${w}`);

      const name = file.name.replace(/\.sb3$/i, '').slice(0, 80) || 'Projet importé';
      pushLog('info', `Création du projet « ${name} »…`);
      const createRes = await fetch(`${API}/api/admin/vakar-block-projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      const created = await createRes.json();
      if (!created.id) throw new Error(created.detail || 'Impossible de créer le projet.');
      projectId = created.id;
      pushLog('success', `Projet créé (id ${projectId}).`);

      const uploadSpec = async (spec, kind) => {
        const zipEntry = zip.file(spec.zipName);
        if (!zipEntry) {
          errorCount += 1;
          pushLog('error', `  ✗ ${kind} « ${spec.name} » : fichier « ${spec.zipName} » manquant dans l'archive.`);
          return null;
        }
        try {
          const blob = await zipEntry.async('blob');
          const url = await uploadAssetBlob(projectId, blob, spec.zipName);
          pushLog('success', `  ✓ ${kind} « ${spec.name} » importé.`);
          return { id: Math.random().toString(36).slice(2, 10), name: spec.name, url };
        } catch (err) {
          errorCount += 1;
          pushLog('error', `  ✗ ${kind} « ${spec.name} » : ${err.message}`);
          return null;
        }
      };

      pushLog('info', `Import des décors (${(stage._backdropSpecs || []).length})…`);
      const backdrops = [];
      for (const spec of stage._backdropSpecs || []) {
        const up = await uploadSpec(spec, 'Décor');
        if (up) backdrops.push({ id: up.id, name: up.name, image_url: up.url });
      }
      stage.backdrops = backdrops;
      stage.current_backdrop_id = backdrops[stage._currentBackdropIndex]?.id || backdrops[0]?.id || null;
      delete stage._backdropSpecs;
      delete stage._currentBackdropIndex;

      const finalSprites = [];
      for (const sprite of sprites) {
        pushLog('info', `Sprite « ${sprite.name} » : ${(sprite._costumeSpecs || []).length} costume(s), ${(sprite._soundSpecs || []).length} son(s)…`);
        const costumes = [];
        for (const spec of sprite._costumeSpecs || []) {
          const up = await uploadSpec(spec, 'Costume');
          if (up) costumes.push({ id: up.id, name: up.name, image_url: up.url });
        }
        const sounds = [];
        for (const spec of sprite._soundSpecs || []) {
          const up = await uploadSpec(spec, 'Son');
          if (up) sounds.push({ id: up.id, name: up.name, audio_url: up.url });
        }
        finalSprites.push({
          id: Math.random().toString(36).slice(2, 10),
          name: sprite.name, x: sprite.x, y: sprite.y, direction: sprite.direction,
          size: sprite.size, visible: sprite.visible,
          costumes, current_costume_id: costumes[sprite._currentCostumeIndex]?.id || costumes[0]?.id || null,
          sounds, workspace: sprite.workspace,
        });
      }
      if (finalSprites.length === 0) {
        pushLog('warn', "Aucun sprite dans l'archive — un sprite vide a été ajouté.");
        finalSprites.push({ id: Math.random().toString(36).slice(2, 10), name: 'Sprite1', x: 0, y: 0, direction: 90, size: 100, visible: true, costumes: [], current_costume_id: null, sounds: [], workspace: null });
      }

      pushLog('info', 'Enregistrement du projet…');
      const saveRes = await fetch(`${API}/api/admin/vakar-block-projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stage, sprites: finalSprites }),
      });
      if (!saveRes.ok) {
        const data = await saveRes.json().catch(() => ({}));
        throw new Error(data.detail || "Échec de l'enregistrement du projet.");
      }

      const totalWarn = warnings.length + errorCount;
      pushLog(totalWarn ? 'warn' : 'success', totalWarn
        ? `Import terminé avec ${totalWarn} problème(s) — vérifie le journal ci-dessus avant d'ouvrir le projet.`
        : 'Import terminé sans problème.');
      setPendingOpenId(projectId);
    } catch (err) {
      pushLog('error', `Import interrompu : ${err.message}`);
      if (projectId) pushLog('info', 'Le projet partiellement importé reste disponible dans la liste ci-dessous.');
    } finally {
      setImporting(false);
    }
  };

  const deleteProject = async (id) => {
    setDeleting(true);
    try {
      await fetch(`${API}/api/admin/vakar-block-projects/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setConfirm(null);
      await load();
    } finally {
      setDeleting(false);
    }
  };

  const q = search.trim().toLowerCase();
  const visible = projects.filter((p) => !q || p.name?.toLowerCase().includes(q) || p.slug?.toLowerCase().includes(q) || p.owner?.toLowerCase().includes(q));

  if (editingId) {
    // Rendered via a portal straight to <body>, outside the Dashboard's own
    // sidebar/topbar layout tree entirely — "just the editor, fullscreen"
    // means bypassing that chrome, not just filling the content pane inside it.
    return createPortal(
      <div className="fixed inset-0 z-[9999]">
        <VakarBlockEditor projectId={editingId} onBack={() => setEditingId(null)} />
      </div>,
      document.body
    );
  }

  return (
    <>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#1D1D1F] dark:text-[#e4e4e7]">Vakar Block</h2>
            <p className="text-sm text-[#6E6E73] dark:text-[#a1a1aa] mt-0.5">L'éditeur de blocs façon Scratch — sprites, costumes et scripts glisser-déposer</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={Upload} loading={importing} onClick={() => importInputRef.current?.click()}>Importer .sb3</Button>
            <input ref={importInputRef} type="file" accept=".sb3" className="hidden" onChange={(e) => { importSb3File(e.target.files?.[0]); e.target.value = ''; }} />
            <Button icon={Plus} onClick={() => setCreating(true)}>Nouveau projet</Button>
          </div>
        </div>

        {importLogs && (
          <div className="rounded-xl bg-[#0d0d14] border border-[#2a2a3c] overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[#2a2a3c] bg-[#151520]">
              <p className="text-xs font-semibold text-[#e4e4e7] flex items-center gap-1.5">
                <Terminal size={13} className="text-[#4ECDC4]" />
                Journal d'import{importing ? '…' : ''}
              </p>
              <div className="flex items-center gap-3">
                {pendingOpenId && !importing && (
                  <Button size="sm" onClick={() => { setEditingId(pendingOpenId); setPendingOpenId(null); }}>Ouvrir le projet</Button>
                )}
                {!importing && (
                  <button onClick={() => setImportLogs(null)} className="text-[#71717a] hover:text-white"><X size={13} /></button>
                )}
              </div>
            </div>
            <div className="p-3 max-h-64 overflow-y-auto font-mono text-[11px] space-y-1">
              {importLogs.map((log, i) => {
                const style = {
                  info: { icon: Info, cls: 'text-[#a1a1aa]' },
                  success: { icon: CheckCircle2, cls: 'text-emerald-400' },
                  warn: { icon: AlertTriangle, cls: 'text-amber-400' },
                  error: { icon: XCircle, cls: 'text-red-400' },
                }[log.level];
                const Icon = style.icon;
                return (
                  <div key={i} className={`flex items-start gap-1.5 ${style.cls}`}>
                    <Icon size={11} className="shrink-0 mt-0.5" />
                    <span className="whitespace-pre-wrap break-all">{log.message}</span>
                  </div>
                );
              })}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}

        {creating && (
          <div className="rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-5 space-y-4">
            <input
              autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createProject()}
              placeholder="Nom du projet, ex. « Mon jeu de chat »"
              className="w-full rounded-lg px-3 py-2 bg-[#F5F5F7] dark:bg-[#0d0d14] border border-[#D2D2D7] dark:border-[#2a2a3c] text-sm text-[#1D1D1F] dark:text-[#e4e4e7] focus:outline-none focus:border-[#4ECDC4]"
            />
            <div>
              <p className="text-[10px] font-semibold text-[#A1A1A6] dark:text-[#71717a] uppercase tracking-widest mb-2">Démarrer avec</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setSelectedTemplateId(null)}
                  className={`rounded-lg p-2.5 text-left border-2 transition-all ${!selectedTemplateId ? 'border-[#4ECDC4]' : 'border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#BFBFC4]'}`}
                >
                  <div className="w-full h-10 rounded-md bg-[#F5F5F7] dark:bg-[#0d0d14] border border-dashed border-[#D2D2D7] dark:border-[#2a2a3c] flex items-center justify-center mb-1.5">
                    <Plus size={13} className="text-[#A1A1A6]" />
                  </div>
                  <p className="text-[11px] font-semibold text-[#1D1D1F] dark:text-[#e4e4e7]">Vide</p>
                </button>
                {VAKAR_BLOCK_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplateId(t.id)}
                    title={t.description}
                    className={`rounded-lg p-2.5 text-left border-2 transition-all ${selectedTemplateId === t.id ? 'border-[#4ECDC4]' : 'border-[#D2D2D7] dark:border-[#2a2a3c] hover:border-[#BFBFC4]'}`}
                  >
                    <div className="w-full h-10 rounded-md mb-1.5 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #4ECDC4, #6C5CE7)' }}>
                      <Blocks size={16} className="text-white" />
                    </div>
                    <p className="text-[11px] font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] truncate">{t.label}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={createProject}>Créer</Button>
              <Button size="sm" variant="secondary" onClick={() => { setCreating(false); setNewName(''); setSelectedTemplateId(null); }}>Annuler</Button>
            </div>
          </div>
        )}

        <div className="relative max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1A6] dark:text-[#71717a] pointer-events-none" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="rounded-lg w-full pl-9 pr-3 py-2 text-sm bg-[#F5F5F7] dark:bg-[#111118] border border-[#D2D2D7] dark:border-[#2a2a3c] text-[#1D1D1F] dark:text-[#e4e4e7] focus:outline-none focus:ring-2 focus:ring-[#4ECDC4]/20 focus:border-[#4ECDC4]"
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-xl bg-[#D2D2D7] dark:bg-[#1c1c2e] animate-pulse" />)}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState icon={Blocks} title="Aucun projet" description="Crée ton premier projet Vakar Block — sprites, décors et blocs, tout en visuel." action={<Button icon={Plus} onClick={() => setCreating(true)}>Nouveau projet</Button>} />
        ) : visible.length === 0 ? (
          <EmptyState icon={Search} title="Aucun résultat" description="Essaie un autre terme de recherche." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((p) => (
              <div key={p.id} className="rounded-xl bg-white dark:bg-[#151520] border border-[#D2D2D7] dark:border-[#2a2a3c] p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1D1D1F] dark:text-[#e4e4e7] truncate">{p.name}</p>
                    <p className="text-[11px] text-[#A1A1A6] dark:text-[#71717a] font-mono truncate">/{p.slug}</p>
                  </div>
                  <span className="text-[10px] flex items-center gap-1 shrink-0">
                    {p.is_user_app ? (
                      <span className="inline-flex items-center gap-1 text-[#A1A1A6] dark:text-[#71717a]"><Users size={9} />{p.owner}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-[#4ECDC4]"><Building2 size={9} />Vakar</span>
                    )}
                  </span>
                </div>
                <p className="text-[10px] text-[#A1A1A6] dark:text-[#71717a]">{p.sprites?.length || 0} sprite{(p.sprites?.length || 0) === 1 ? '' : 's'} · mis à jour {timeAgo(p.updated_at)}</p>
                <div className="flex items-center gap-2 pt-2 border-t border-[#EDEDEF] dark:border-[#1c1c2e]">
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => setEditingId(p.id)}>Ouvrir</Button>
                  <button onClick={() => setConfirm(p.id)} title="Supprimer" className="p-2 text-[#A1A1A6] hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!confirm}
        onClose={() => !deleting && setConfirm(null)}
        onConfirm={() => deleteProject(confirm)}
        title="Supprimer ce projet ?"
        description="Cette action supprime définitivement les sprites, costumes et scripts. Impossible à annuler."
        confirmLabel="Supprimer"
        variant="destructive"
        loading={deleting}
      />
    </>
  );
}
