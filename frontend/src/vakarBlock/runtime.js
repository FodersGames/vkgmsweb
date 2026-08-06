import { javascriptGenerator } from './generators';

// ============================================================
// VAKAR BLOCK — sprite state + the requestAnimationFrame scheduler that
// runs compiled scripts concurrently, generator-function-based (see the
// plan: yield inside `toujours`/`attendre`/`glisser` is what lets many
// scripts progress "at the same time" without blocking the browser).
// ============================================================

const HAT_TYPES = ['vk_when_green_flag', 'vk_when_key_pressed', 'vk_when_sprite_clicked'];

const KEY_MAP = {
  Space: 'space', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyA: 'a', KeyB: 'b', KeyC: 'c', KeyD: 'd', KeyE: 'e', KeyW: 'w', KeyX: 'x', Enter: 'enter',
};

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
}

const runtimeApi = {
  wait: function* (secs) {
    const durationMs = Math.max(0, secs) * 1000;
    const start = performance.now();
    while (performance.now() - start < durationMs) yield;
  },
};

export class VakarBlockRuntime {
  constructor({ sprites, onRender, onError }) {
    this.sprites = sprites; // Map<id, VakarSprite>
    this.onRender = onRender || (() => {});
    this.onError = onError || (() => {});
    this.threads = [];
    this.running = false;
    this._rafId = null;
    this._stopped = false;
    this._compiled = new Map(); // spriteId -> { greenFlag: [fn], keyPressed: [{key, fn}], spriteClicked: [fn] }
    this._keyHandler = (e) => {
      if (!this.running) return;
      const key = KEY_MAP[e.code];
      if (!key) return;
      for (const sprite of this.sprites.values()) {
        const scripts = this._compiled.get(sprite.id);
        if (!scripts) continue;
        for (const item of scripts.keyPressed) {
          if (item.key === key) this._startThread(sprite, item.fn);
        }
      }
    };
    window.addEventListener('keydown', this._keyHandler);
  }

  // Recompiles one sprite's workspace (call whenever its blocks change or
  // when (re)loading a project — must be called before greenFlag() sees it).
  compileSprite(sprite, workspace) {
    const topBlocks = workspace.getTopBlocks(true);
    const scripts = { greenFlag: [], keyPressed: [], spriteClicked: [] };
    javascriptGenerator.init(workspace);
    for (const block of topBlocks) {
      if (block.isDisabled?.()) continue;
      if (!HAT_TYPES.includes(block.type)) continue;
      let fn;
      try {
        fn = this._compileHat(block);
      } catch (err) {
        this.onError(err);
        continue;
      }
      if (block.type === 'vk_when_green_flag') scripts.greenFlag.push(fn);
      else if (block.type === 'vk_when_key_pressed') scripts.keyPressed.push({ key: block.getFieldValue('KEY'), fn });
      else if (block.type === 'vk_when_sprite_clicked') scripts.spriteClicked.push(fn);
    }
    javascriptGenerator.finish('');
    this._compiled.set(sprite.id, scripts);
  }

  _compileHat(hatBlock) {
    const raw = javascriptGenerator.blockToCode(hatBlock);
    const code = Array.isArray(raw) ? raw[0] : raw;
    // eslint-disable-next-line no-new-func
    const factory = new Function(`return function*(sprite, runtime) {\n${code}\n}`);
    return factory();
  }

  greenFlag() {
    this._stopThreads();
    this._stopped = false;
    this.running = true;
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

  _startThread(sprite, genFn) {
    try {
      const gen = genFn(sprite, runtimeApi);
      this.threads.push({ gen, sprite });
    } catch (err) {
      this.onError(err);
    }
  }

  stopAll() {
    this._stopped = true;
  }

  stop() {
    this._stopped = true;
    this._stopThreads();
    this.running = false;
    this.onRender();
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
    window.removeEventListener('keydown', this._keyHandler);
  }
}
