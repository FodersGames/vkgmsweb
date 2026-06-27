(function (Scratch) {
    'use strict';

    const API_URL = 'https://vakargames.com';

    // Détecte le mode : sandboxed (Scratch.fetch) ou unsandboxed (fetch natif)
    function _fetch(url, opts) {
        if (typeof Scratch !== 'undefined' && Scratch.fetch) {
            return Scratch.fetch(url, opts);
        }
        return fetch(url, opts);
    }

    // Ouvre une URL : Scratch.openWindow (sandbox) ou window.open (unsandboxed)
    function _openWindow(url) {
        if (typeof Scratch !== 'undefined' && Scratch.openWindow) {
            Scratch.openWindow(url, 'stripe_checkout');
            return null;
        }
        if (typeof window !== 'undefined' && window.open) {
            return window.open(url, 'stripe_checkout', 'width=520,height=720,scrollbars=yes,resizable=yes');
        }
        return null;
    }

    // ── IndexedDB cache pour les fichiers de jeu ──────────────────────────────

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
                req.onsuccess = e => { this._db = e.target.result; resolve(); };
                req.onerror   = ()  => reject(new Error('IndexedDB unavailable'));
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

    // ── Helpers fichiers ──────────────────────────────────────────────────────

    function fileExt(filename) {
        const s = (filename || '').toLowerCase();
        if (s.endsWith('.svg'))  return 'svg';
        if (s.endsWith('.png'))  return 'png';
        if (s.endsWith('.jpg') || s.endsWith('.jpeg')) return 'jpg';
        return null;
    }

    // ── Extension principale ──────────────────────────────────────────────────

    class VakarGames {
        constructor() {
            // Chat
            this._chatSlug     = '';
            this._chatApiKey   = '';
            this._chatMessages = [];
            this._prevCount    = 0;
            this._newMsg       = false;

            // Files
            this._filesSlug    = '';
            this._filesApiKey  = '';
            this._filesVersion = 'default';
            this._filesReady   = false;
            this._filesError   = '';
            this._fileIndex    = {};
            this._filesCache   = null;
        }

        getInfo() {
            return {
                id:     'vakargames',
                name:   'Vakar Games',
                color1: '#4ECDC4',
                color2: '#2CB5AC',
                color3: '#1aada6',
                blocks: [

                    // ══════════════════════════════
                    //  SHOP
                    // ══════════════════════════════
                    { blockType: Scratch.BlockType.LABEL, text: '— Shop —' },
                    {
                        opcode:    'buyProduct',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'buy [URL] player UID [UID]',
                        arguments: {
                            URL: { type: Scratch.ArgumentType.STRING, defaultValue: 'https://vakargames.com/shop/my-game?product=...' },
                            UID: { type: Scratch.ArgumentType.STRING, defaultValue: '' }
                        }
                    },

                    // ══════════════════════════════
                    //  CHAT GLOBAL
                    // ══════════════════════════════
                    { blockType: Scratch.BlockType.LABEL, text: '— Chat —' },
                    {
                        opcode:    'setChatConfig',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'configure chat project [SLUG] key [KEY]',
                        arguments: {
                            SLUG: { type: Scratch.ArgumentType.STRING, defaultValue: 'my-game' },
                            KEY:  { type: Scratch.ArgumentType.STRING, defaultValue: '' }
                        }
                    },
                    {
                        opcode:    'sendMessage',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'send [MSG] as [USERNAME] level [LEVEL]',
                        arguments: {
                            MSG:      { type: Scratch.ArgumentType.STRING, defaultValue: 'Hello!' },
                            USERNAME: { type: Scratch.ArgumentType.STRING, defaultValue: 'Player' },
                            LEVEL:    { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 }
                        }
                    },
                    {
                        opcode:    'getMessages',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'get [LIMIT] last messages',
                        arguments: {
                            LIMIT: { type: Scratch.ArgumentType.NUMBER, defaultValue: 50 }
                        }
                    },
                    {
                        opcode:    'newMessages',
                        blockType: Scratch.BlockType.BOOLEAN,
                        text:      'new messages?'
                    },
                    {
                        opcode:    'messageCount',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'message count'
                    },
                    {
                        opcode:    'messageText',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'message [INDEX] text',
                        arguments: { INDEX: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 } }
                    },
                    {
                        opcode:    'messageUsername',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'message [INDEX] username',
                        arguments: { INDEX: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 } }
                    },
                    {
                        opcode:    'messageLevel',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'message [INDEX] level',
                        arguments: { INDEX: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 } }
                    },
                    {
                        opcode:    'lastMessageText',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'last message text'
                    },
                    {
                        opcode:    'lastMessageUsername',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'last message username'
                    },
                    {
                        opcode:    'lastMessageLevel',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'last message level'
                    },

                    // ══════════════════════════════
                    //  FICHIERS / RESSOURCES
                    // ══════════════════════════════
                    { blockType: Scratch.BlockType.LABEL, text: '— Ressources —' },

                    // Config
                    {
                        opcode:    'configureFiles',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'configurer ressources projet [SLUG] clé [KEY]',
                        arguments: {
                            SLUG: { type: Scratch.ArgumentType.STRING, defaultValue: 'mon-jeu' },
                            KEY:  { type: Scratch.ArgumentType.STRING, defaultValue: '' }
                        }
                    },

                    // Réseau
                    {
                        opcode:    'hasInternet',
                        blockType: Scratch.BlockType.BOOLEAN,
                        text:      'connexion internet disponible ?'
                    },

                    // Version
                    {
                        opcode:    'useLiveVersion',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'utiliser la version en ligne'
                    },
                    {
                        opcode:    'useVersion',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'utiliser la version [V]',
                        arguments: {
                            V: { type: Scratch.ArgumentType.STRING, defaultValue: 'default' }
                        }
                    },
                    {
                        opcode:    'currentVersion',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'version actuelle'
                    },

                    // Chargement groupé
                    {
                        opcode:    'loadAllToSprite',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'charger toutes les images dans le sprite [SPRITE]',
                        arguments: {
                            SPRITE: { type: Scratch.ArgumentType.STRING, defaultValue: 'Sprite1' }
                        }
                    },
                    {
                        opcode:    'filesReady',
                        blockType: Scratch.BlockType.BOOLEAN,
                        text:      'ressources prêtes ?'
                    },
                    {
                        opcode:    'filesError',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'erreur de chargement'
                    },

                    // Fichier individuel
                    {
                        opcode:    'loadCostumeById',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'charger costume [LABEL] ID [ID] dans sprite [SPRITE]',
                        arguments: {
                            LABEL:  { type: Scratch.ArgumentType.STRING, defaultValue: 'nom asset' },
                            ID:     { type: Scratch.ArgumentType.STRING, defaultValue: '' },
                            SPRITE: { type: Scratch.ArgumentType.STRING, defaultValue: 'Sprite1' }
                        }
                    },
                    {
                        opcode:    'fileDisplayName',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'nom du fichier [ID]',
                        arguments: {
                            ID: { type: Scratch.ArgumentType.STRING, defaultValue: '' }
                        }
                    },

                    // Lecture du centre de rotation (pour le copier dans le dashboard)
                    {
                        opcode:    'costumeCenterX',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'centre rotation X costume [COSTUME] sprite [SPRITE]',
                        arguments: {
                            COSTUME: { type: Scratch.ArgumentType.STRING, defaultValue: 'costume1' },
                            SPRITE:  { type: Scratch.ArgumentType.STRING, defaultValue: 'Sprite1' }
                        }
                    },
                    {
                        opcode:    'costumeCenterY',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'centre rotation Y costume [COSTUME] sprite [SPRITE]',
                        arguments: {
                            COSTUME: { type: Scratch.ArgumentType.STRING, defaultValue: 'costume1' },
                            SPRITE:  { type: Scratch.ArgumentType.STRING, defaultValue: 'Sprite1' }
                        }
                    },
                ]
            };
        }

        // ══════════════════════════════════════════
        //  SHOP
        // ══════════════════════════════════════════
        async buyProduct({ URL: urlStr, UID }) {
            let gameSlug, productId;
            try {
                const parsed = new URL(urlStr);
                const parts  = parsed.pathname.split('/').filter(Boolean);
                gameSlug  = parts[1];
                productId = parsed.searchParams.get('product');
            } catch { return false; }

            if (!gameSlug || !productId || !String(UID).trim()) return false;

            let sessionId, checkoutUrl;
            try {
                const res = await _fetch(
                    `${API_URL}/api/shop/${encodeURIComponent(gameSlug)}/checkout`,
                    {
                        method:  'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body:    JSON.stringify({ product_id: productId, player_uid: String(UID).trim() })
                    }
                );
                if (!res.ok) return false;
                const data  = await res.json();
                checkoutUrl = data.checkout_url;
                sessionId   = data.session_id;
            } catch { return false; }

            const popupRef = _openWindow(checkoutUrl);

            return await new Promise((resolve) => {
                let elapsed  = 0;
                const maxMs  = 600000;
                const pollMs = 3000;

                const interval = setInterval(async () => {
                    elapsed += pollMs;

                    if (popupRef && popupRef.closed) {
                        clearInterval(interval);
                        await new Promise(r => setTimeout(r, 6000));
                        try {
                            const r = await _fetch(`${API_URL}/api/shop/session/${encodeURIComponent(sessionId)}/status`);
                            const d = await r.json();
                            resolve(d.status === 'complete');
                        } catch { resolve(false); }
                        return;
                    }

                    if (elapsed >= maxMs) {
                        clearInterval(interval);
                        resolve(false);
                        return;
                    }

                    try {
                        const r = await _fetch(`${API_URL}/api/shop/session/${encodeURIComponent(sessionId)}/status`);
                        const d = await r.json();
                        if (d.status === 'complete') {
                            clearInterval(interval);
                            if (popupRef && !popupRef.closed) popupRef.close();
                            resolve(true);
                        }
                    } catch { /* continuer */ }
                }, pollMs);
            });
        }

        // ══════════════════════════════════════════
        //  CHAT GLOBAL
        // ══════════════════════════════════════════
        setChatConfig({ SLUG, KEY }) {
            this._chatSlug   = String(SLUG);
            this._chatApiKey = String(KEY);
        }

        async sendMessage({ MSG, USERNAME, LEVEL }) {
            if (!this._chatSlug || !this._chatApiKey) return;
            try {
                await _fetch(`${API_URL}/api/projects/${encodeURIComponent(this._chatSlug)}/chat`, {
                    method:  'POST',
                    headers: {
                        'Content-Type':   'application/json',
                        'X-Chat-Api-Key': this._chatApiKey
                    },
                    body: JSON.stringify({
                        username: String(USERNAME),
                        message:  String(MSG),
                        level:    parseInt(LEVEL) || null
                    })
                });
            } catch {}
        }

        async getMessages({ LIMIT }) {
            if (!this._chatSlug) return '[]';
            const limit = Math.min(100, Math.max(1, parseInt(LIMIT) || 50));
            try {
                const r    = await _fetch(`${API_URL}/api/projects/${encodeURIComponent(this._chatSlug)}/chat?limit=${limit}`);
                const data = await r.json();
                const msgs = data.messages || [];

                this._newMsg = msgs.length > this._prevCount ||
                    (msgs.length > 0 && this._chatMessages.length > 0 &&
                     msgs[msgs.length - 1]?.timestamp !== this._chatMessages[this._chatMessages.length - 1]?.timestamp);
                this._prevCount    = msgs.length;
                this._chatMessages = msgs;

                const output = [...msgs].reverse().map((msg, i) => ({
                    position:  i + 1,
                    username:  msg.username,
                    message:   msg.message,
                    level:     msg.level ?? 0,
                    timestamp: msg.timestamp,
                }));

                return JSON.stringify(output);
            } catch { return '[]'; }
        }

        newMessages() {
            const v = this._newMsg;
            this._newMsg = false;
            return v;
        }

        messageCount() { return this._chatMessages.length; }

        _msgAt(index) {
            const i = parseInt(index);
            if (i < 1 || i > this._chatMessages.length) return undefined;
            return this._chatMessages[this._chatMessages.length - i];
        }

        messageText({ INDEX })     { return this._msgAt(INDEX)?.message  ?? ''; }
        messageUsername({ INDEX }) { return this._msgAt(INDEX)?.username ?? ''; }
        messageLevel({ INDEX })    { return this._msgAt(INDEX)?.level    ?? 0;  }
        lastMessageText()          { return this._msgAt(1)?.message  ?? ''; }
        lastMessageUsername()      { return this._msgAt(1)?.username ?? ''; }
        lastMessageLevel()         { return this._msgAt(1)?.level    ?? 0;  }

        // ══════════════════════════════════════════
        //  FICHIERS / RESSOURCES — helpers internes
        // ══════════════════════════════════════════

        async _ensureFilesCache() {
            if (this._filesCache) return;
            this._filesCache = new VGCache(this._filesSlug + '_' + this._filesVersion);
            await this._filesCache.open();
        }

        async _fetchWithKey(url) {
            const res = await _fetch(url, {
                headers: { 'X-Files-Api-Key': this._filesApiKey }
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res;
        }

        async _getFileBytes(fileId, updatedAt) {
            await this._ensureFilesCache();
            const cached = await this._filesCache.get(fileId).catch(() => null);
            if (cached && cached.updated_at === updatedAt) {
                return cached.data; // Uint8Array depuis IndexedDB
            }
            const url = `${API_URL}/api/game/${encodeURIComponent(this._filesSlug)}/files/${encodeURIComponent(fileId)}/download`;
            const res = await this._fetchWithKey(url);
            const buf = await res.arrayBuffer();
            const data = new Uint8Array(buf);
            await this._filesCache.put(fileId, updatedAt, data).catch(() => {});
            return data;
        }

        // Parse SVG pour obtenir ses dimensions réelles et calculer le centre auto
        _parseSVGCenter(bytes) {
            try {
                const svgStr = new TextDecoder().decode(bytes);
                const parser = new DOMParser();
                const doc    = parser.parseFromString(svgStr, 'image/svg+xml');
                const svgEl  = doc.documentElement;

                // Essayer viewBox en premier (plus fiable)
                const vb = svgEl.getAttribute('viewBox');
                if (vb) {
                    const parts = vb.trim().split(/[\s,]+/).map(Number);
                    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
                        return { x: parts[2] / 2, y: parts[3] / 2 };
                    }
                }

                // Fallback sur width/height
                const w = parseFloat(svgEl.getAttribute('width')  || '0');
                const h = parseFloat(svgEl.getAttribute('height') || '0');
                if (w > 0 && h > 0) return { x: w / 2, y: h / 2 };
            } catch {}
            return null;
        }

        async _addCostumeToTarget(target, file) {
            const vm      = Scratch.vm;
            const storage = vm.runtime.storage;
            const ext     = fileExt(file.original_filename);

            // Si le costume existe déjà avec le même updated_at → skip (pas de doublon)
            const existing = target.sprite.costumes_.find(c => c.name === file.name);
            if (existing) {
                const cached = await this._filesCache.get(file.id).catch(() => null);
                if (cached && cached.updated_at === file.updated_at) return; // déjà à jour
                // Fichier mis à jour : supprime l'ancien avant d'ajouter le nouveau
                const idx = target.sprite.costumes_.indexOf(existing);
                if (idx !== -1) vm.deleteCostume(target.id, idx);
            }

            let assetType, dataFormat, suffix;
            if (ext === 'svg') {
                assetType  = storage.AssetType.ImageVector;
                dataFormat = storage.DataFormat.SVG;
                suffix     = '.svg';
            } else if (ext === 'png') {
                assetType  = storage.AssetType.ImageBitmap;
                dataFormat = storage.DataFormat.PNG;
                suffix     = '.png';
            } else {
                assetType  = storage.AssetType.ImageBitmap;
                dataFormat = storage.DataFormat.JPEG;
                suffix     = '.jpg';
            }

            const bytes = await this._getFileBytes(file.id, file.updated_at);

            // Priorité : valeurs stockées dans la BDD → parsing SVG → 0,0
            let rotX = (file.rotation_center_x != null) ? file.rotation_center_x : null;
            let rotY = (file.rotation_center_y != null) ? file.rotation_center_y : null;

            if ((rotX === null || rotY === null) && ext === 'svg') {
                const auto = this._parseSVGCenter(bytes);
                if (auto) {
                    if (rotX === null) rotX = auto.x;
                    if (rotY === null) rotY = auto.y;
                }
            }

            rotX = rotX ?? 0;
            rotY = rotY ?? 0;

            const asset   = storage.createAsset(assetType, dataFormat, bytes, null, true);
            const costume = {
                asset,
                assetId:          asset.assetId,
                name:             file.name,
                md5ext:           asset.assetId + suffix,
                bitmapResolution: 1,
                rotationCenterX:  rotX,
                rotationCenterY:  rotY,
            };
            await vm.addCostume(costume.md5ext, costume, target.id);
        }

        _findTarget(spriteName) {
            const vm = Scratch.vm;
            return vm.runtime.getSpriteTargetByName(String(spriteName))
                || vm.runtime.targets.find(t => !t.isStage)
                || null;
        }

        async _fetchFileList() {
            const url = `${API_URL}/api/game/${encodeURIComponent(this._filesSlug)}/files?version=${encodeURIComponent(this._filesVersion)}`;
            const res = await this._fetchWithKey(url);
            const data = await res.json();
            const files = (data.files || []).filter(f => fileExt(f.original_filename) !== null);
            this._fileIndex = {};
            for (const f of files) this._fileIndex[f.id] = f;
            return files;
        }

        // ══════════════════════════════════════════
        //  FICHIERS / RESSOURCES — blocs
        // ══════════════════════════════════════════

        configureFiles({ SLUG, KEY }) {
            this._filesSlug    = String(SLUG).trim();
            this._filesApiKey  = String(KEY).trim();
            this._filesCache   = null;
            this._fileIndex    = {};
            this._filesReady   = false;
            this._filesError   = '';
        }

        hasInternet() {
            return navigator.onLine === true;
        }

        async useLiveVersion() {
            if (!this._filesSlug || !this._filesApiKey) {
                this._filesError = 'Configurez les ressources d\'abord.';
                return;
            }
            try {
                const res  = await this._fetchWithKey(`${API_URL}/api/game/${encodeURIComponent(this._filesSlug)}/live-version`);
                const data = await res.json();
                const v    = data.live_version || 'default';
                if (v !== this._filesVersion) {
                    this._filesVersion = v;
                    this._filesCache   = null; // nouveau namespace de cache
                    this._filesReady   = false;
                }
            } catch (e) {
                this._filesError = 'Impossible de récupérer la version en ligne : ' + e.message;
            }
        }

        useVersion({ V }) {
            const tag = String(V).trim() || 'default';
            if (tag !== this._filesVersion) {
                this._filesVersion = tag;
                this._filesCache   = null;
                this._filesReady   = false;
            }
        }

        currentVersion() { return this._filesVersion; }

        async loadAllToSprite({ SPRITE }) {
            if (!this._filesSlug || !this._filesApiKey) {
                this._filesError = 'Configurez les ressources d\'abord.';
                return;
            }
            const target = this._findTarget(SPRITE);
            if (!target) {
                this._filesError = 'Sprite "' + SPRITE + '" introuvable.';
                return;
            }
            this._filesReady = false;
            this._filesError = '';
            try {
                const files = await this._fetchFileList();
                for (const f of files) {
                    try {
                        await this._addCostumeToTarget(target, f);
                    } catch (e) {
                        console.warn('[VG] Impossible de charger ' + f.name + ' : ' + e.message);
                    }
                }
                this._filesReady = true;
            } catch (e) {
                this._filesError = e.message;
            }
        }

        filesReady()  { return this._filesReady; }
        filesError()  { return this._filesError; }

        async loadCostumeById({ ID, SPRITE }) {
            const target = this._findTarget(SPRITE);
            if (!target) { this._filesError = 'Sprite "' + SPRITE + '" introuvable.'; return; }

            let f = this._fileIndex[String(ID)];
            if (!f) {
                try { await this._fetchFileList(); } catch (e) { this._filesError = e.message; return; }
                f = this._fileIndex[String(ID)];
            }
            if (!f) { this._filesError = 'Fichier ID "' + ID + '" introuvable dans la version "' + this._filesVersion + '".'; return; }
            if (fileExt(f.original_filename) === null) { this._filesError = '"' + f.name + '" n\'est pas une image (SVG/PNG/JPG).'; return; }

            try {
                await this._addCostumeToTarget(target, f);
            } catch (e) { this._filesError = e.message; }
        }

        fileDisplayName({ ID }) {
            const f = this._fileIndex[String(ID)];
            return f ? f.name : '';
        }

        // Lit le centre de rotation d'un costume existant dans TurboWarp
        // Utile pour copier la valeur dans le dashboard avant d'uploader le fichier
        _getCostumeCenter(spriteName, costumeName) {
            const target = Scratch.vm.runtime.getSpriteTargetByName(String(spriteName));
            if (!target) return null;
            const costume = target.sprite.costumes_.find(
                c => c.name === String(costumeName)
            );
            return costume || null;
        }

        costumeCenterX({ COSTUME, SPRITE }) {
            const c = this._getCostumeCenter(SPRITE, COSTUME);
            return c != null ? c.rotationCenterX : '';
        }

        costumeCenterY({ COSTUME, SPRITE }) {
            const c = this._getCostumeCenter(SPRITE, COSTUME);
            return c != null ? c.rotationCenterY : '';
        }
    }

    Scratch.extensions.register(new VakarGames());

})(Scratch);
