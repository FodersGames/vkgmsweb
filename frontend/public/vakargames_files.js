// VakarGames Files Extension for TurboWarp
// Load game assets (SVG/PNG/JPG) from the VakarGames server with IndexedDB caching.
// Load as an *unsandboxed* custom extension in TurboWarp.
// URL: https://vakargames.com/vakargames_files.js

(function () {
  'use strict';

  // ── IndexedDB cache ──────────────────────────────────────────────────────────

  class VGCache {
    constructor(slug) {
      this._name = 'vg_files_' + slug.replace(/[^a-zA-Z0-9]/g, '_');
      this._db   = null;
    }

    open() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(this._name, 1);
        req.onupgradeneeded = e => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('files')) {
            db.createObjectStore('files', { keyPath: 'id' });
          }
        };
        req.onsuccess  = e => { this._db = e.target.result; resolve(); };
        req.onerror    = ()  => reject(new Error('IndexedDB unavailable'));
      });
    }

    get(id) {
      return new Promise((resolve, reject) => {
        const tx  = this._db.transaction('files', 'readonly');
        const req = tx.objectStore('files').get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror   = () => reject(req.error);
      });
    }

    put(id, updatedAt, data) {
      return new Promise((resolve, reject) => {
        const tx  = this._db.transaction('files', 'readwrite');
        const req = tx.objectStore('files').put({ id, updated_at: updatedAt, data });
        req.onsuccess = resolve;
        req.onerror   = () => reject(req.error);
      });
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function extOf(filename) {
    const s = (filename || '').toLowerCase();
    if (s.endsWith('.svg'))  return 'svg';
    if (s.endsWith('.png'))  return 'png';
    if (s.endsWith('.jpg') || s.endsWith('.jpeg')) return 'jpg';
    return null;
  }

  function isImage(filename) { return extOf(filename) !== null; }

  // ── Extension ────────────────────────────────────────────────────────────────

  class VakarGamesFilesExtension {

    constructor(runtime) {
      this.runtime          = runtime;
      this._serverUrl       = 'https://vakargames.com';
      this._slug            = '';
      this._apiKey          = '';
      this._resolvedVersion = 'default';
      this._ready           = false;
      this._error           = '';
      this._fileIndex       = {};   // id → file metadata
      this._cache           = null; // VGCache instance
    }

    getInfo() {
      return {
        id:     'vakargamesfiles',
        name:   'VakarGames Files',
        color1: '#4ECDC4',
        color2: '#3BB8B0',
        color3: '#2AA9A1',
        blocks: [

          // ── 1. Setup ─────────────────────────────────────────────────────────
          {
            opcode:    'configure',
            blockType: Scratch.BlockType.COMMAND,
            text:      'configure server [URL] project [SLUG] key [KEY]',
            arguments: {
              URL:  { type: Scratch.ArgumentType.STRING, defaultValue: 'https://vakargames.com' },
              SLUG: { type: Scratch.ArgumentType.STRING, defaultValue: 'my-game' },
              KEY:  { type: Scratch.ArgumentType.STRING, defaultValue: '' },
            },
          },

          '---',

          // ── 2. Network ───────────────────────────────────────────────────────
          {
            opcode:    'hasInternet',
            blockType: Scratch.BlockType.BOOLEAN,
            text:      'has internet connection?',
          },

          '---',

          // ── 3. Version ───────────────────────────────────────────────────────
          {
            opcode:    'useLiveVersion',
            blockType: Scratch.BlockType.COMMAND,
            text:      'use live version (from server)',
          },
          {
            opcode:    'useVersion',
            blockType: Scratch.BlockType.COMMAND,
            text:      'use version [V]',
            arguments: {
              V: { type: Scratch.ArgumentType.STRING, defaultValue: 'default' },
            },
          },
          {
            opcode:    'currentVersion',
            blockType: Scratch.BlockType.REPORTER,
            text:      'current version',
          },

          '---',

          // ── 4. Bulk load ─────────────────────────────────────────────────────
          {
            opcode:    'loadAllToSprite',
            blockType: Scratch.BlockType.COMMAND,
            text:      'load all images to sprite [SPRITE]',
            arguments: {
              SPRITE: { type: Scratch.ArgumentType.STRING, defaultValue: 'Sprite1' },
            },
          },
          {
            opcode:    'isReady',
            blockType: Scratch.BlockType.BOOLEAN,
            text:      'resources ready?',
          },
          {
            opcode:    'loadErrorReporter',
            blockType: Scratch.BlockType.REPORTER,
            text:      'load error',
          },

          '---',

          // ── 5. Single file ───────────────────────────────────────────────────
          {
            opcode:    'loadCostumeToSprite',
            blockType: Scratch.BlockType.COMMAND,
            text:      'load costume ID [ID] to sprite [SPRITE]',
            arguments: {
              ID:     { type: Scratch.ArgumentType.STRING, defaultValue: '' },
              SPRITE: { type: Scratch.ArgumentType.STRING, defaultValue: 'Sprite1' },
            },
          },
          {
            opcode:    'fileDisplayName',
            blockType: Scratch.BlockType.REPORTER,
            text:      'display name of file [ID]',
            arguments: {
              ID: { type: Scratch.ArgumentType.STRING, defaultValue: '' },
            },
          },
        ],
      };
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    _base() { return this._serverUrl.replace(/\/$/, ''); }

    async _fetch(url) {
      const res = await Scratch.fetch(url, {
        headers: { 'X-Files-Api-Key': this._apiKey },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
      return res;
    }

    async _ensureCache() {
      if (this._cache) return;
      this._cache = new VGCache(this._slug);
      await this._cache.open();
    }

    async _getBytes(fileId, originalFilename, updatedAt) {
      await this._ensureCache();
      const cached = await this._cache.get(fileId).catch(() => null);
      if (cached && cached.updated_at === updatedAt) {
        return cached.data; // Uint8Array from IndexedDB
      }
      const url = `${this._base()}/api/game/${this._slug}/files/${fileId}/download?version=${encodeURIComponent(this._resolvedVersion)}`;
      const res  = await this._fetch(url);
      const buf  = await res.arrayBuffer();
      const data = new Uint8Array(buf);
      await this._cache.put(fileId, updatedAt, data).catch(() => {});
      return data;
    }

    async _addCostume(target, fileId, originalFilename, displayName, updatedAt) {
      const vm      = Scratch.vm;
      const storage = vm.runtime.storage;
      const ext     = extOf(originalFilename);

      let assetType, dataFormat, md5ext;
      if (ext === 'svg') {
        assetType  = storage.AssetType.ImageVector;
        dataFormat = storage.DataFormat.SVG;
        md5ext     = '.svg';
      } else if (ext === 'png') {
        assetType  = storage.AssetType.ImageBitmap;
        dataFormat = storage.DataFormat.PNG;
        md5ext     = '.png';
      } else {
        assetType  = storage.AssetType.ImageBitmap;
        dataFormat = storage.DataFormat.JPEG;
        md5ext     = '.jpg';
      }

      const bytes  = await this._getBytes(fileId, originalFilename, updatedAt);
      const asset  = storage.createAsset(assetType, dataFormat, bytes, null, true);
      const costume = {
        asset,
        assetId: asset.assetId,
        name:    displayName,
        md5ext:  asset.assetId + md5ext,
        bitmapResolution: 1,
        rotationCenterX:  0,
        rotationCenterY:  0,
      };
      await vm.addCostume(costume.md5ext, costume, target.id);
    }

    _findTarget(spriteName) {
      const vm = Scratch.vm;
      return vm.runtime.getSpriteTargetByName(String(spriteName))
          || vm.runtime.targets.find(t => !t.isStage)
          || null;
    }

    // ── Block handlers ────────────────────────────────────────────────────────

    configure({ URL, SLUG, KEY }) {
      this._serverUrl       = String(URL).trim()   || 'https://vakargames.com';
      this._slug            = String(SLUG).trim();
      this._apiKey          = String(KEY).trim();
      this._cache           = null; // reset on re-configure
      this._fileIndex       = {};
      this._ready           = false;
      this._error           = '';
    }

    hasInternet() {
      return navigator.onLine === true;
    }

    async useLiveVersion() {
      if (!this._slug || !this._apiKey) {
        this._error = 'Configure first.';
        return;
      }
      try {
        const res  = await this._fetch(`${this._base()}/api/game/${this._slug}/live-version`);
        const data = await res.json();
        this._resolvedVersion = data.live_version || 'default';
        this._cache           = null; // version changed → new cache namespace
      } catch (e) {
        this._error = `Cannot fetch live version: ${e.message}`;
      }
    }

    useVersion({ V }) {
      const tag = String(V).trim() || 'default';
      if (tag !== this._resolvedVersion) {
        this._resolvedVersion = tag;
        this._cache           = null;
        this._ready           = false;
      }
    }

    currentVersion() { return this._resolvedVersion; }

    async loadAllToSprite({ SPRITE }) {
      if (!this._slug || !this._apiKey) {
        this._error = 'Configure the extension first.';
        return;
      }
      this._ready = false;
      this._error = '';

      const target = this._findTarget(SPRITE);
      if (!target) {
        this._error = `Sprite "${SPRITE}" not found.`;
        return;
      }

      try {
        const url  = `${this._base()}/api/game/${this._slug}/files?version=${encodeURIComponent(this._resolvedVersion)}`;
        const res  = await this._fetch(url);
        const data = await res.json();
        const imageFiles = (data.files || []).filter(f => isImage(f.original_filename));

        // Build index — keyed by stable asset ID (same across all versions)
        // AND by per-version doc id, so both kinds of IDs resolve
        this._fileIndex = {};
        for (const f of imageFiles) {
          this._fileIndex[f.id] = f;
          if (f.asset_id)  this._fileIndex[f.asset_id]  = f;
          if (f.stable_id) this._fileIndex[f.stable_id] = f;
        }

        // Load each image as a costume
        for (const f of imageFiles) {
          try {
            await this._addCostume(target, f.id, f.original_filename, f.name, f.updated_at);
          } catch (e) {
            console.warn('[VG Files] Could not load ' + f.name + ': ' + e.message);
          }
        }
        this._ready = true;
      } catch (e) {
        this._error = e.message;
        this._ready = false;
      }
    }

    isReady()            { return this._ready; }
    loadErrorReporter()  { return this._error; }

    async loadCostumeToSprite({ ID, SPRITE }) {
      const target = this._findTarget(SPRITE);
      if (!target) { this._error = `Sprite "${SPRITE}" not found.`; return; }

      let f = this._fileIndex[String(ID)];

      if (!f) {
        // Not in index — fetch file list to populate index
        try {
          const url  = `${this._base()}/api/game/${this._slug}/files?version=${encodeURIComponent(this._resolvedVersion)}`;
          const res  = await this._fetch(url);
          const data = await res.json();
          for (const file of (data.files || [])) {
            this._fileIndex[file.id] = file;
            if (file.asset_id)  this._fileIndex[file.asset_id]  = file;
            if (file.stable_id) this._fileIndex[file.stable_id] = file;
          }
          f = this._fileIndex[String(ID)];
        } catch (e) { this._error = e.message; return; }
      }

      if (!f) { this._error = `File ID "${ID}" not found in version "${this._resolvedVersion}".`; return; }
      if (!isImage(f.original_filename)) { this._error = `File "${f.name}" is not an image (SVG/PNG/JPG).`; return; }

      try {
        await this._addCostume(target, f.id, f.original_filename, f.name, f.updated_at);
      } catch (e) { this._error = e.message; }
    }

    fileDisplayName({ ID }) {
      const f = this._fileIndex[String(ID)];
      return f ? f.name : '';
    }
  }

  Scratch.extensions.register(new VakarGamesFilesExtension());
})();
