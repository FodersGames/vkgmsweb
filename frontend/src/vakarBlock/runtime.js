import { javascriptGenerator } from './generators';

// ============================================================
// VAKAR BLOCK — sprite state + the requestAnimationFrame scheduler that
// runs compiled scripts concurrently, generator-function-based (see the
// plan: yield inside `toujours`/`attendre`/`glisser` is what lets many
// scripts progress "at the same time" without blocking the browser).
// ============================================================

const HAT_TYPES = [
  'vk_when_green_flag', 'vk_when_key_pressed', 'vk_when_sprite_clicked',
  'vk_when_i_receive', 'vk_when_i_start_as_clone', 'vk_when_backdrop_switches_to',
];

// Full alphabet + digits, matching blocks.js's KEY_OPTIONS dropdown —
// DOM `event.code` values (KeyA.."KeyZ", Digit0.."Digit9") to our own key
// strings ('a'.."z", '0'.."9").
const KEY_MAP = {
  Space: 'space', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'enter',
  ...Object.fromEntries('abcdefghijklmnopqrstuvwxyz'.split('').map((k) => [`Key${k.toUpperCase()}`, k])),
  ...Object.fromEntries('0123456789'.split('').map((k) => [`Digit${k}`, k])),
};

// Approximate hitbox used for collision/touching checks, in stage units
// (not CSS pixels) — a real implementation would derive this from each
// costume's actual pixel dimensions, which aren't tracked yet. Documented
// simplification, not a bug: every sprite is treated as roughly the same
// physical size at 100%, scaled by its own size%.
const SENSING_HITBOX_UNITS = 40;

const genId = () => Math.random().toString(36).slice(2, 10);

const API = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL || '';
const resolveUrl = (url) => (url && url.startsWith('/') ? `${API}${url}` : url);

// The real, live VakarGames.com backend that the studio's own
// `turbowarp-extension/vakargames.js` TurboWarp extension talks to — the
// VakarGames-branded blocks below (Fichiers / Texte / Play) are a faithful
// re-implementation of that extension's *public* behavior against Vakar
// Block's own data model, not a copy of its code (that original targets
// scratch-vm's asset/storage internals, which Vakar Block doesn't have).
// Every network call below hits this real, in-production API — unlike
// everything else in Vakar Block, which is fully sandboxed/local.
const VG_API_URL = 'https://vakargames.com';

export class VakarSprite {
  constructor(data) {
    this.id = data.id;
    this.name = data.name || 'Sprite';
    this.x = data.x || 0;
    this.y = data.y || 0;
    this.direction = data.direction ?? 90;
    this.size = data.size ?? 100;
    this.visible = data.visible !== false;
    this.costumes = data.costumes || [];
    this.currentCostumeId = data.current_costume_id || (this.costumes[0] && this.costumes[0].id) || null;
    this.workspaceJson = data.workspace || null;
    this.bubbleText = null;
    this.vars = {};
    this.penDown = false;
    this.penColor = '#4C97FF';
    this.isClone = false;
    this.sounds = data.sounds || [];
    this.volume = data.volume ?? 100;
    // 'all around' (default, full rotation) | 'left-right' (flip only,
    // Scratch's usual platformer-character convention) | "don't rotate".
    // Values are Scratch's own STYLE-field tokens directly — see blocks.js's
    // EFFECT_OPTIONS comment for why (no translation table needed for sb3
    // import/export). Draw-time handling lives in VakarBlockEditor.js.
    this.rotationStyle = data.rotationStyle || 'all around';
    // Only COLOR/GHOST/BRIGHTNESS are actually rendered (CSS filter, see
    // VakarBlockEditor.js) — FISHEYE/WHIRL/PIXELATE/MOSAIC are tracked for
    // round-trip fidelity with imported/exported .sb3 projects but have no
    // visible effect yet. Documented gap, not a silent fake.
    this.effects = { COLOR: 0, FISHEYE: 0, WHIRL: 0, PIXELATE: 0, MOSAIC: 0, BRIGHTNESS: 0, GHOST: 0 };
    // Draw order relative to other sprites — higher draws on top. Assigned
    // sequentially by VakarBlockRuntime's constructor (sprite-list order is
    // the natural initial stacking order, matching Scratch's own default);
    // only `goToFrontBack` changes it after that.
    this.layer = 0;
  }

  get currentCostume() {
    return this.costumes.find((c) => c.id === this.currentCostumeId) || this.costumes[0] || null;
  }

  get costumeNumber() {
    const idx = this.costumes.findIndex((c) => c.id === this.currentCostumeId);
    return idx === -1 ? (this.costumes.length ? 1 : 0) : idx + 1;
  }

  resetToInitial(data) {
    this.x = data.x || 0;
    this.y = data.y || 0;
    this.direction = data.direction ?? 90;
    this.size = data.size ?? 100;
    this.visible = data.visible !== false;
    this.currentCostumeId = data.current_costume_id || (this.costumes[0] && this.costumes[0].id) || null;
    this.bubbleText = null;
    this.vars = {};
    this.rotationStyle = data.rotationStyle || 'all around';
    this.clearGraphicEffects();
  }

  moveSteps(steps) {
    const rad = ((90 - this.direction) * Math.PI) / 180;
    this.x += Math.cos(rad) * steps;
    this.y += Math.sin(rad) * steps;
  }

  turn(degrees) {
    this.direction = ((this.direction + degrees) % 360 + 360) % 360;
  }

  goTo(x, y) {
    this.x = x;
    this.y = y;
  }

  changeXBy(dx) {
    this.x += dx;
  }

  changeYBy(dy) {
    this.y += dy;
  }

  pointInDirection(deg) {
    this.direction = ((deg % 360) + 360) % 360;
  }

  setRotationStyle(style) {
    this.rotationStyle = style;
  }

  setEffect(name, value) {
    if (name in this.effects) this.effects[name] = value;
  }

  changeEffect(name, delta) {
    if (name in this.effects) this.effects[name] += delta;
  }

  clearGraphicEffects() {
    for (const k of Object.keys(this.effects)) this.effects[k] = 0;
  }

  *glideTo(secs, targetX, targetY) {
    const startX = this.x;
    const startY = this.y;
    const durationMs = Math.max(0, secs) * 1000;
    if (durationMs === 0) {
      this.goTo(targetX, targetY);
      return;
    }
    const start = performance.now();
    while (true) {
      const t = Math.min(1, (performance.now() - start) / durationMs);
      this.x = startX + (targetX - startX) * t;
      this.y = startY + (targetY - startY) * t;
      if (t >= 1) break;
      yield;
    }
  }

  nextCostume() {
    if (!this.costumes.length) return;
    const idx = this.costumes.findIndex((c) => c.id === this.currentCostumeId);
    const next = this.costumes[(idx + 1) % this.costumes.length];
    this.currentCostumeId = next.id;
  }

  switchCostume(name) {
    const found = this.costumes.find((c) => c.name === name);
    if (found) this.currentCostumeId = found.id;
  }

  changeSize(delta) {
    this.size = Math.max(5, Math.min(500, this.size + delta));
  }

  setSize(size) {
    this.size = Math.max(5, Math.min(500, size));
  }

  setVisible(v) {
    this.visible = v;
  }

  say(text) {
    this.bubbleText = text == null ? '' : String(text);
  }

  *sayFor(text, secs) {
    this.say(text);
    const durationMs = Math.max(0, secs) * 1000;
    const start = performance.now();
    while (performance.now() - start < durationMs) yield;
    this.bubbleText = null;
  }

  setPenDown(v) {
    this.penDown = v;
  }

  setPenColor(c) {
    this.penColor = c;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(100, v));
  }

  changeVolume(delta) {
    this.setVolume(this.volume + delta);
  }

  hitboxHalfSize() {
    return (SENSING_HITBOX_UNITS * (this.size ?? 100)) / 100 / 2;
  }
}

export class VakarBlockRuntime {
  constructor({ sprites, onRender, onError, onPenClear, onStamp, onShowLoginPopup, onCloseLoginPopup, onLoadingScreen, onBackdropChange, initialBackdropName }) {
    this.sprites = sprites; // Map<id, VakarSprite> — includes clones once created
    this.onRender = onRender || (() => {});
    this.onError = onError || (() => {});
    this.onPenClear = onPenClear || (() => {});
    this.onStamp = onStamp || (() => {});
    this.threads = [];
    this.running = false;
    this._rafId = null;
    this._stopped = false;
    this._compiled = new Map(); // spriteId -> { greenFlag, keyPressed, spriteClicked, messageReceived, cloneStart: [fn...] }
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this._keysDown = new Set();
    this._activeAudio = new Set();

    // ---------- VakarGames extension state (see the big comment block
    // above VG_API_URL) ----------
    this.texts = new Map(); // id -> {text,x,y,font,size,color,bold,italic,visible}
    this._vgFilesSlug = '';
    this._vgFilesKey = '';
    this._vgFilesVersion = 'default';
    this._vgFileIndex = {};
    this._vgPlaySlug = '';
    this._vgPlayAccessToken = null;
    this._vgPlayPlayer = null;
    this._vgPlaySaveCache = {};
    // UI hooks — the login popup and loading screen are rendered by
    // VakarBlockEditor.js (React-managed, consistent with how this whole
    // editor renders everything else) rather than raw `document.body`
    // DOM manipulation like the original TurboWarp extension does; the
    // runtime only ever asks for them via these callbacks.
    this.onShowLoginPopup = onShowLoginPopup || ((onDone) => onDone(false));
    this.onCloseLoginPopup = onCloseLoginPopup || (() => {});
    this.onLoadingScreen = onLoadingScreen || (() => {});

    // ---------- Décor (stage backdrop) ----------
    // The stage/backdrop itself is owned by VakarBlockEditor.js's React
    // state (project.stage), not the runtime — `onBackdropChange` is how a
    // running script's `basculer sur le décor` actually moves the visible
    // backdrop, mirroring how the login popup/loading screen are also
    // React-rendered rather than runtime-owned. `currentBackdropName`
    // still needs to live here too, since it's what
    // `event_whenbackdropswitchesto` scripts compare against.
    this.currentBackdropName = initialBackdropName || null;
    this.onBackdropChange = onBackdropChange || (() => {});

    // Initial stacking order = sprite-list order, matching Scratch's own
    // default (the sprite corral's order is also the initial layer order).
    let layerIdx = 0;
    for (const sprite of this.sprites.values()) sprite.layer = layerIdx++;

    this._keyDownHandler = (e) => {
      const key = KEY_MAP[e.code];
      if (key) this._keysDown.add(key);
      if (!this.running || !key) return;
      for (const sprite of this.sprites.values()) {
        const scripts = this._compiled.get(sprite.id);
        if (!scripts) continue;
        for (const item of scripts.keyPressed) {
          if (item.key === key) this._startThread(sprite, item.fn);
        }
      }
    };
    this._keyUpHandler = (e) => {
      const key = KEY_MAP[e.code];
      if (key) this._keysDown.delete(key);
    };
    window.addEventListener('keydown', this._keyDownHandler);
    window.addEventListener('keyup', this._keyUpHandler);
  }

  isKeyDown(key) {
    return this._keysDown.has(key);
  }

  setMousePosition(x, y) {
    this.mouseX = x;
    this.mouseY = y;
  }

  setMouseDown(v) {
    this.mouseDown = v;
  }

  // ---------- Son (sound) ----------
  playSound(sprite, name) {
    const sound = sprite.sounds.find((s) => s.name === name);
    if (!sound) return null;
    const audio = new Audio(resolveUrl(sound.audio_url));
    audio.volume = Math.max(0, Math.min(1, (sprite.volume ?? 100) / 100));
    this._activeAudio.add(audio);
    const cleanup = () => this._activeAudio.delete(audio);
    audio.addEventListener('ended', cleanup);
    audio.addEventListener('error', cleanup);
    audio.play()?.catch(() => {}); // e.g. blocked by the browser's autoplay policy — not fatal
    return audio;
  }

  *playSoundUntilDone(sprite, name) {
    const audio = this.playSound(sprite, name);
    if (!audio) return;
    while (this._activeAudio.has(audio)) yield;
  }

  stopAllSounds() {
    for (const audio of this._activeAudio) {
      audio.pause();
      audio.currentTime = 0;
    }
    this._activeAudio.clear();
  }

  // Recompiles one sprite's workspace (call whenever its blocks change or
  // when (re)loading a project — must be called before greenFlag() sees it).
  compileSprite(sprite, workspace) {
    const topBlocks = workspace.getTopBlocks(true);
    const scripts = { greenFlag: [], keyPressed: [], spriteClicked: [], messageReceived: [], cloneStart: [], backdropSwitch: [] };
    javascriptGenerator.init(workspace);

    // "Mes blocs" definitions aren't hats — collect their generated code
    // first so it can be prepended into every hat's compiled function body
    // (JS function declarations hoist within their scope, so any call site
    // finds them regardless of source order).
    let procedureDefs = '';
    for (const block of topBlocks) {
      if (block.type !== 'vk_procedure_def' || block.isDisabled?.()) continue;
      try {
        const raw = javascriptGenerator.blockToCode(block);
        procedureDefs += Array.isArray(raw) ? raw[0] : raw;
      } catch (err) {
        this.onError(err);
      }
    }

    // Generate every hat's code FIRST, deferring the `new Function(...)`
    // build — some stock Blockly blocks (e.g. math_random_int) don't inline
    // their own logic, they call a shared helper that Blockly only decides
    // to emit once, collected via `finish()` *after* every blockToCode call
    // has run. Building the Function per-hat immediately (the previous
    // approach) meant that helper never made it into any compiled script —
    // `nombre aléatoire entre` has been silently broken since round 1,
    // only surfacing as a `ReferenceError: mathRandomInt is not defined`
    // the first time a script that actually used it was really executed.
    const pending = [];
    for (const block of topBlocks) {
      if (block.isDisabled?.()) continue;
      if (!HAT_TYPES.includes(block.type)) continue;
      try {
        const raw = javascriptGenerator.blockToCode(block);
        pending.push({ block, code: Array.isArray(raw) ? raw[0] : raw });
      } catch (err) {
        this.onError(err);
      }
    }
    const helperDefs = javascriptGenerator.finish('');

    for (const { block, code } of pending) {
      let fn;
      try {
        fn = this._buildHatFunction(helperDefs + procedureDefs + code);
      } catch (err) {
        this.onError(err);
        continue;
      }
      if (block.type === 'vk_when_green_flag') scripts.greenFlag.push(fn);
      else if (block.type === 'vk_when_key_pressed') scripts.keyPressed.push({ key: block.getFieldValue('KEY'), fn });
      else if (block.type === 'vk_when_sprite_clicked') scripts.spriteClicked.push(fn);
      else if (block.type === 'vk_when_i_receive') scripts.messageReceived.push({ message: block.getFieldValue('MESSAGE'), fn });
      else if (block.type === 'vk_when_i_start_as_clone') scripts.cloneStart.push(fn);
      else if (block.type === 'vk_when_backdrop_switches_to') scripts.backdropSwitch.push({ backdrop: block.getFieldValue('BACKDROP'), fn });
    }
    this._compiled.set(sprite.id, scripts);
  }

  _buildHatFunction(fullCode) {
    // eslint-disable-next-line no-new-func
    const factory = new Function(`return function*(sprite, runtime) {\n${fullCode}\n}`);
    return factory();
  }

  greenFlag() {
    this._stopThreads();
    this.stopAllSounds();
    this._stopped = false;
    this.running = true;
    // Drop any clones left over from a previous run — a fresh green flag
    // starts from just the persisted sprites, matching Scratch's own reset.
    for (const [id, sprite] of Array.from(this.sprites.entries())) {
      if (sprite.isClone) {
        this.sprites.delete(id);
        this._compiled.delete(id);
      }
    }
    for (const sprite of this.sprites.values()) {
      const scripts = this._compiled.get(sprite.id);
      if (!scripts) continue;
      for (const fn of scripts.greenFlag) this._startThread(sprite, fn);
    }
    this._loop();
  }

  spriteClicked(spriteId) {
    if (!this.running) return;
    const sprite = this.sprites.get(spriteId);
    const scripts = this._compiled.get(spriteId);
    if (!sprite || !scripts) return;
    for (const fn of scripts.spriteClicked) this._startThread(sprite, fn);
  }

  // ---------- Diffusion (broadcasts) ----------
  broadcast(message) {
    if (!this.running) return;
    for (const sprite of this.sprites.values()) {
      const scripts = this._compiled.get(sprite.id);
      if (!scripts) continue;
      for (const item of scripts.messageReceived) {
        if (item.message === message) this._startThread(sprite, item.fn);
      }
    }
  }

  // ---------- Décor (stage backdrop) ----------
  // Edge-triggered, matching real Scratch: only an actual switch fires
  // `event_whenbackdropswitchesto` scripts — pressing green flag does NOT
  // re-fire them for whatever backdrop happens to already be active (same
  // reasoning as sprites not auto-resetting position on green flag, see
  // VakarSprite.resetToInitial's comment — Vakar Block's own greenFlag()
  // doesn't call it, on purpose, matching real Scratch VM behavior).
  switchBackdrop(name) {
    const target = String(name || '').trim();
    if (!target) return;
    this.currentBackdropName = target;
    this.onBackdropChange(target);
    if (!this.running) return;
    for (const sprite of this.sprites.values()) {
      const scripts = this._compiled.get(sprite.id);
      if (!scripts) continue;
      for (const item of scripts.backdropSwitch) {
        if (item.backdrop === target) this._startThread(sprite, item.fn);
      }
    }
  }

  // ---------- Clones ----------
  createClone(sourceSprite, targetName) {
    let source = sourceSprite;
    if (targetName && targetName !== 'moi-même') {
      const found = Array.from(this.sprites.values()).find((s) => s.name === targetName);
      if (found) source = found;
    }
    const clone = new VakarSprite({ id: genId(), name: source.name, costumes: source.costumes });
    clone.x = source.x;
    clone.y = source.y;
    clone.direction = source.direction;
    clone.size = source.size;
    clone.visible = source.visible;
    clone.currentCostumeId = source.currentCostumeId;
    clone.penDown = source.penDown;
    clone.penColor = source.penColor;
    clone.vars = { ...source.vars };
    clone.isClone = true;
    this.sprites.set(clone.id, clone);
    const scripts = this._compiled.get(source.id);
    if (scripts) {
      this._compiled.set(clone.id, scripts);
      for (const fn of scripts.cloneStart) this._startThread(clone, fn);
    }
    return clone;
  }

  deleteClone(spriteId) {
    const sprite = this.sprites.get(spriteId);
    if (!sprite || !sprite.isClone) return;
    this.sprites.delete(spriteId);
    this._compiled.delete(spriteId);
    this.threads = this.threads.filter((t) => t.sprite.id !== spriteId);
  }

  // ---------- Détection (sensing) ----------
  touching(sprite, target) {
    const key = (target || '').trim().toLowerCase();
    const half = sprite.hitboxHalfSize();
    if (key === 'bord' || key === 'edge') {
      // Stage bounds aren't known to the runtime (only the editor has the
      // project's stage size) — approximate with a generous fixed half-
      // extent; good enough until stage size is threaded through here too.
      const stageHalf = 240;
      return (
        sprite.x - half < -stageHalf || sprite.x + half > stageHalf ||
        sprite.y - half < -stageHalf || sprite.y + half > stageHalf
      );
    }
    if (key === 'souris' || key === 'mouse') {
      return (
        this.mouseX >= sprite.x - half && this.mouseX <= sprite.x + half &&
        this.mouseY >= sprite.y - half && this.mouseY <= sprite.y + half
      );
    }
    for (const other of this.sprites.values()) {
      if (other === sprite || !other.visible) continue;
      if (other.name !== target) continue;
      const oHalf = other.hitboxHalfSize();
      const overlap =
        Math.abs(sprite.x - other.x) < half + oHalf &&
        Math.abs(sprite.y - other.y) < half + oHalf;
      if (overlap) return true;
    }
    return false;
  }

  distanceTo(sprite, target) {
    const key = (target || '').trim().toLowerCase();
    let tx, ty;
    if (key === 'souris' || key === 'mouse') {
      tx = this.mouseX; ty = this.mouseY;
    } else {
      const other = Array.from(this.sprites.values()).find((s) => s.name === target);
      if (!other) return 0;
      tx = other.x; ty = other.y;
    }
    return Math.hypot(sprite.x - tx, sprite.y - ty);
  }

  // ---------- Mouvement : cibles nommées (aller à / s'orienter vers) ----------
  // Shared target resolution for `vk_go_to`/`vk_point_towards` — same
  // souris/sprite-name convention as touching()/distanceTo() above, plus
  // "aléatoire" for a random on-stage position. Uses the same hardcoded
  // stage-half-extent approximation as touching()'s "bord" case (the
  // runtime doesn't know the project's actual configured stage size, only
  // the editor does) — same documented simplification, not a new one.
  _resolveTargetPosition(target) {
    const key = (target || '').trim().toLowerCase();
    if (key === 'aléatoire' || key === 'random') {
      const half = 240;
      return { x: (Math.random() * 2 - 1) * half, y: (Math.random() * 2 - 1) * half * 0.75 };
    }
    if (key === 'souris' || key === 'mouse') return { x: this.mouseX, y: this.mouseY };
    const other = Array.from(this.sprites.values()).find((s) => s.name === target);
    return other ? { x: other.x, y: other.y } : null;
  }

  goToTarget(sprite, target) {
    const pos = this._resolveTargetPosition(target);
    if (pos) sprite.goTo(pos.x, pos.y);
  }

  pointTowards(sprite, target) {
    const pos = this._resolveTargetPosition(target);
    if (!pos) return;
    const dx = pos.x - sprite.x;
    const dy = pos.y - sprite.y;
    if (dx === 0 && dy === 0) return;
    sprite.pointInDirection(90 - (Math.atan2(dy, dx) * 180) / Math.PI);
  }

  // ---------- Apparence : ordre d'affichage (layers) ----------
  goToFrontBack(sprite, direction) {
    const layers = Array.from(this.sprites.values()).map((s) => s.layer ?? 0);
    sprite.layer = direction === 'back' ? Math.min(0, ...layers) - 1 : Math.max(0, ...layers) + 1;
  }

  // ---------- Stylo (pen) ----------
  clearPen() {
    this.onPenClear();
  }

  stamp(sprite) {
    this.onStamp(sprite);
  }

  // ---------- Attendre / arrêter (called as `runtime.xxx` from generated code) ----------
  *wait(secs) {
    const durationMs = Math.max(0, secs) * 1000;
    const start = performance.now();
    while (performance.now() - start < durationMs) yield;
  }

  stopAll() {
    this._stopped = true;
  }

  stop() {
    this._stopped = true;
    this._stopThreads();
    this.stopAllSounds();
    this.running = false;
    this.onRender();
  }

  _startThread(sprite, genFn) {
    try {
      const gen = genFn(sprite, this);
      this.threads.push({ gen, sprite });
    } catch (err) {
      this.onError(err);
    }
  }

  // ---------- Listes ----------
  list(sprite, name) {
    if (!Array.isArray(sprite.vars[name])) sprite.vars[name] = [];
    return sprite.vars[name];
  }

  // ══════════════════════════════════════════
  //  VakarGames extension — Fichiers / Texte / Play
  //  (see the VG_API_URL comment above for what this is and isn't a copy of)
  // ══════════════════════════════════════════

  // Bridges a plain Promise into the generator/yield concurrency model, the
  // same way `wait`/`glideTo` bridge real time — lets any async call (a
  // fetch to vakargames.com) cooperate with the rest of a script instead of
  // blocking the whole scheduler. `yield*` on the caller side lets the
  // resolved value flow back out as this generator's own `return` value.
  *awaitPromise(promise) {
    const state = { done: false };
    promise.then(
      (v) => { state.done = true; state.value = v; },
      (e) => { state.done = true; state.error = e; }
    );
    while (!state.done) yield;
    if (state.error) throw state.error;
    return state.value;
  }

  findSpriteByName(name) {
    return Array.from(this.sprites.values()).find((s) => s.name === name) || null;
  }

  // ---------- Fichiers (game asset files hosted on vakargames.com) ----------
  vgConfigureFiles(slug, key) {
    this._vgFilesSlug = String(slug || '').trim();
    this._vgFilesKey = String(key || '').trim();
    this._vgFileIndex = {};
  }

  vgUseVersion(v) {
    const tag = String(v || '').trim() || 'default';
    if (tag !== this._vgFilesVersion) {
      this._vgFilesVersion = tag;
      this._vgFileIndex = {};
    }
  }

  async _vgFetchFileList() {
    const url = `${VG_API_URL}/api/game/${encodeURIComponent(this._vgFilesSlug)}/files?version=${encodeURIComponent(this._vgFilesVersion)}`;
    const res = await fetch(url, { headers: { 'X-Files-Api-Key': this._vgFilesKey } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const files = data.files || [];
    this._vgFileIndex = {};
    for (const f of files) this._vgFileIndex[f.id] = f;
    return files;
  }

  // Fetches one file by id and adds/replaces it as a costume on the target
  // sprite — a simplified, Vakar-Block-shaped equivalent of the original
  // extension's `_addCostumeToTarget` (which writes into scratch-vm's own
  // asset storage; Vakar Block has no such system, so this just creates a
  // costume the normal way, `{id, name, image_url}` pointing at a blob URL).
  // No IndexedDB caching (the original extension's performance optimization
  // for repeated loads across sessions) — a documented simplification, not
  // an oversight.
  *vgLoadCostumeById(sprite, fileId, spriteName) {
    const target = this.findSpriteByName(spriteName) || sprite;
    const load = async () => {
      let f = this._vgFileIndex[String(fileId)];
      if (!f) { await this._vgFetchFileList(); f = this._vgFileIndex[String(fileId)]; }
      if (!f) throw new Error(`Fichier "${fileId}" introuvable (version "${this._vgFilesVersion}")`);
      const url = `${VG_API_URL}/api/game/${encodeURIComponent(this._vgFilesSlug)}/files/${encodeURIComponent(f.id)}/download`;
      const res = await fetch(url, { headers: { 'X-Files-Api-Key': this._vgFilesKey } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const existing = target.costumes.find((c) => c.name === f.name);
      if (existing) existing.image_url = objectUrl;
      else target.costumes.push({ id: genId(), name: f.name, image_url: objectUrl });
      if (!target.currentCostumeId) target.currentCostumeId = target.costumes[0]?.id || null;
    };
    yield* this.awaitPromise(load());
  }

  vgRemoveAllCostumes(sprite, spriteName) {
    const target = this.findSpriteByName(spriteName) || sprite;
    target.costumes.length = 0;
    target.currentCostumeId = null;
  }

  // ---------- Texte (HTML text overlay on the stage) ----------
  // Rendered by VakarBlockEditor.js alongside sprites (same coordinate
  // system, `onRender`-driven) rather than the original extension's raw
  // `document.body` overlay — Vakar Block's stage is already a bounded
  // React element, so positioning text relative to it directly is simpler
  // and keeps this consistent with how sprites/pen already render.
  vgShowText(id, props) {
    const key = String(id).trim();
    if (!key) return;
    this.texts.set(key, { ...(this.texts.get(key) || {}), ...props });
  }

  vgSetTextVisible(id, visible) {
    const t = this.texts.get(String(id).trim());
    if (t) t.visible = visible;
  }

  // ---------- VakarGames Play (real player accounts on vakargames.com) ----------
  _vgPlayStorageKey() {
    return 'vg_play_refresh_' + this._vgPlaySlug;
  }

  async _vgPlayRestoreSession() {
    let stored;
    try { stored = localStorage.getItem(this._vgPlayStorageKey()); } catch (e) { return; }
    if (!stored) return;
    try {
      const r = await fetch(`${VG_API_URL}/api/play/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: stored, project_slug: this._vgPlaySlug }),
      });
      if (!r.ok) { try { localStorage.removeItem(this._vgPlayStorageKey()); } catch (e) {} return; }
      const d = await r.json();
      this._vgPlayAccessToken = d.access_token;
      this._vgPlayPlayer = d.player;
    } catch (e) { /* stay signed out, no network — same as the original extension */ }
  }

  *vgPlayConfigure(slug) {
    this._vgPlaySlug = String(slug || '').trim();
    yield* this.awaitPromise(this._vgPlayRestoreSession());
  }

  // Suspends the calling script (via awaitPromise) until the editor reports
  // the login/register popup was resolved — `vgPlayResolveLogin()` (called
  // by VakarBlockEditor.js after a successful `vgPlayAttemptLogin`/
  // `vgPlayAttemptRegister`) is what actually resumes it. A no-op if
  // already signed in, matching the original extension.
  *vgPlayShowLogin() {
    if (this._vgPlayPlayer) return;
    yield* this.awaitPromise(new Promise((resolve) => {
      this._vgLoginResolve = resolve;
      this.onShowLoginPopup();
    }));
  }

  _vgApplyPlaySession(d) {
    try { localStorage.setItem(this._vgPlayStorageKey(), d.refresh_token); } catch (e) {}
    this._vgPlayAccessToken = d.access_token;
    this._vgPlayPlayer = d.player;
  }

  // Called by VakarBlockEditor.js's login popup form — real network calls,
  // fully independent of any DOM so they're unit-testable on their own.
  async vgPlayAttemptLogin(login, password) {
    try {
      const r = await fetch(`${VG_API_URL}/api/play/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password, project_slug: this._vgPlaySlug }),
      });
      let d = {}; try { d = await r.json(); } catch (e) {}
      if (!r.ok) return { ok: false, error: typeof d.detail === 'string' ? d.detail : 'Erreur de connexion' };
      this._vgApplyPlaySession(d);
      return { ok: true };
    } catch (e) { return { ok: false, error: 'Erreur réseau — ' + e.message }; }
  }

  async vgPlayAttemptRegister(username, email, password) {
    try {
      const r = await fetch(`${VG_API_URL}/api/play/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, project_slug: this._vgPlaySlug }),
      });
      let d = {}; try { d = await r.json(); } catch (e) {}
      if (!r.ok) return { ok: false, error: typeof d.detail === 'string' ? d.detail : "Erreur d'inscription" };
      this._vgApplyPlaySession(d);
      return { ok: true };
    } catch (e) { return { ok: false, error: 'Erreur réseau — ' + e.message }; }
  }

  // Resumes whichever script is currently suspended in `vgPlayShowLogin`.
  vgPlayResolveLogin() {
    if (this._vgLoginResolve) {
      const resolve = this._vgLoginResolve;
      this._vgLoginResolve = null;
      resolve();
    }
  }

  vgPlayIsConnected() {
    return !!this._vgPlayPlayer;
  }

  vgPlayDisconnect() {
    this._vgPlayAccessToken = null;
    this._vgPlayPlayer = null;
    this._vgPlaySaveCache = {};
    try { localStorage.removeItem(this._vgPlayStorageKey()); } catch (e) {}
  }

  *vgPlaySave(category, data) {
    if (!this._vgPlayAccessToken) return false;
    const cat = String(category);
    const payload = String(data);
    if (this._vgPlaySaveCache[cat] === payload) return true; // unchanged — matches the original's no-op guard
    const save = async () => {
      const r = await fetch(`${VG_API_URL}/api/play/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this._vgPlayAccessToken}` },
        body: JSON.stringify({ category: cat, data: payload, project_slug: this._vgPlaySlug }),
      });
      if (r.ok) { this._vgPlaySaveCache[cat] = payload; return true; }
      return false;
    };
    return yield* this.awaitPromise(save());
  }

  // Shaped as a COMMAND that writes straight into a variable, not a
  // REPORTER like the original extension's `playCharger` — Vakar Block
  // compiles each script to one flat JS function ahead of time (see
  // runtime.js's compileSprite), so a reporter expression has no way to
  // `yield` mid-expression while its own fetch resolves. See sb3.js's
  // import handler for `vakargames_playCharger` for how a Scratch project
  // using the real reporter shape gets translated onto this instead.
  *vgPlayLoad(sprite, category, varName) {
    let result = '{}';
    if (this._vgPlayAccessToken) {
      const load = async () => {
        const r = await fetch(
          `${VG_API_URL}/api/play/load?category=${encodeURIComponent(category)}&project_slug=${encodeURIComponent(this._vgPlaySlug)}&_ts=${Date.now()}`,
          { headers: { Authorization: `Bearer ${this._vgPlayAccessToken}` }, cache: 'no-store' }
        );
        if (!r.ok) return '{}';
        const d = await r.json();
        return d.data || '{}';
      };
      result = yield* this.awaitPromise(load());
    }
    sprite.vars[varName] = result;
  }

  vgPlayOpenLoading(max) {
    this.onLoadingScreen({ visible: true, max: Math.max(1, parseInt(max, 10) || 1) });
  }

  vgPlayCloseLoading() {
    this.onLoadingScreen({ visible: false });
  }

  _stopThreads() {
    this.threads = [];
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _loop() {
    if (this._rafId) return;
    const step = () => {
      if (this._stopped) {
        this.threads = [];
        this.running = false;
        this._stopped = false;
        this._rafId = null;
        this.onRender();
        return;
      }
      const alive = [];
      for (const thread of this.threads) {
        try {
          const { done } = thread.gen.next();
          if (!done) alive.push(thread);
        } catch (err) {
          this.onError(err);
        }
      }
      this.threads = alive;
      this.onRender();
      if (this.threads.length > 0) {
        this._rafId = requestAnimationFrame(step);
      } else {
        this._rafId = null;
        this.running = false;
      }
    };
    this._rafId = requestAnimationFrame(step);
  }

  destroy() {
    this._stopThreads();
    this.stopAllSounds();
    window.removeEventListener('keydown', this._keyDownHandler);
    window.removeEventListener('keyup', this._keyUpHandler);
  }
}
