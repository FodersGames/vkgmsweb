import { javascriptGenerator } from './generators';

// ============================================================
// VAKAR BLOCK — sprite state + the requestAnimationFrame scheduler that
// runs compiled scripts concurrently, generator-function-based (see the
// plan: yield inside `toujours`/`attendre`/`glisser` is what lets many
// scripts progress "at the same time" without blocking the browser).
// ============================================================

const HAT_TYPES = [
  'vk_when_green_flag', 'vk_when_key_pressed', 'vk_when_sprite_clicked',
  'vk_when_i_receive', 'vk_when_i_start_as_clone',
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
  }

  get currentCostume() {
    return this.costumes.find((c) => c.id === this.currentCostumeId) || this.costumes[0] || null;
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
  constructor({ sprites, onRender, onError, onPenClear, onStamp }) {
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
    const scripts = { greenFlag: [], keyPressed: [], spriteClicked: [], messageReceived: [], cloneStart: [] };
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
