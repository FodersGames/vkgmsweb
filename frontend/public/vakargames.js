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

            // HTML Overlay Text
            this._overlayContainer = null;
            this._overlayTexts     = new Map();

            // VakarGames Play
            this._playSlug        = '';
            this._playAccent      = '#4ECDC4';
            this._playTitle       = 'VakarGames Play';
            this._playAccessToken = null;
            this._playPlayer      = null;
            this._playPopup       = null;
            this._loadingPopup    = null;
            this._loadingList     = null;
            this._loadingCount    = 0;
        }

        getInfo() {
            return {
                id:     'vakargames',
                name:   'Vakar Games',
                color1: '#4ECDC4',
                color2: '#2CB5AC',
                color3: '#1aada6',
                menus: {
                    ouiNon:        { acceptReporters: true, items: ['oui', 'non'] },
                    categoriesSave: { acceptReporters: true, items: ['inventory', 'stats', 'craft', 'tech', 'others'] }
                },
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
                        opcode:    'loadTextEngine',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'charger text engine [LABEL] groupe [GROUP_ID] dans sprite [SPRITE]',
                        arguments: {
                            LABEL:    { type: Scratch.ArgumentType.STRING, defaultValue: 'ma police' },
                            GROUP_ID: { type: Scratch.ArgumentType.STRING, defaultValue: '' },
                            SPRITE:   { type: Scratch.ArgumentType.STRING, defaultValue: 'Sprite1' }
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

                    '---',

                    {
                        opcode:    'removeAllCostumes',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'supprimer tous les costumes du sprite [SPRITE]',
                        arguments: {
                            SPRITE: { type: Scratch.ArgumentType.STRING, defaultValue: 'Sprite1' }
                        }
                    },
                    {
                        opcode:    'removeCostumeByName',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'supprimer le costume [NOM] du sprite [SPRITE]',
                        arguments: {
                            NOM:    { type: Scratch.ArgumentType.STRING, defaultValue: 'chest' },
                            SPRITE: { type: Scratch.ArgumentType.STRING, defaultValue: 'Sprite1' }
                        }
                    },
                    {
                        opcode:    'removeUnnamedCostumes',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'supprimer les costumes sans nom du sprite [SPRITE]',
                        arguments: {
                            SPRITE: { type: Scratch.ArgumentType.STRING, defaultValue: 'Sprite1' }
                        }
                    },
                    {
                        opcode:    'removeCostumeByIndex',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'supprimer le costume numéro [NUM] du sprite [SPRITE]',
                        arguments: {
                            NUM:    { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
                            SPRITE: { type: Scratch.ArgumentType.STRING, defaultValue: 'Sprite1' }
                        }
                    },

                    // ══════════════════════════════
                    //  OVERLAY TEXTE HTML
                    // ══════════════════════════════
                    { blockType: Scratch.BlockType.LABEL, text: '— Overlay Texte —' },

                    {
                        opcode:    'afficherTexte',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'afficher texte id [ID] texte [TEXTE] x [X] y [Y] police [POLICE] taille [TAILLE] couleur [COULEUR] gras [GRAS] italique [ITALIQUE] visible [VISIBLE]',
                        arguments: {
                            ID:       { type: Scratch.ArgumentType.STRING, defaultValue: 'mon_texte' },
                            TEXTE:    { type: Scratch.ArgumentType.STRING, defaultValue: 'Bonjour' },
                            X:        { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
                            Y:        { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
                            POLICE:   { type: Scratch.ArgumentType.STRING, defaultValue: 'Arial' },
                            TAILLE:   { type: Scratch.ArgumentType.NUMBER, defaultValue: 24 },
                            COULEUR:  { type: Scratch.ArgumentType.STRING, defaultValue: '#FFFFFF' },
                            GRAS:     { type: Scratch.ArgumentType.STRING, menu: 'ouiNon', defaultValue: 'non' },
                            ITALIQUE: { type: Scratch.ArgumentType.STRING, menu: 'ouiNon', defaultValue: 'non' },
                            VISIBLE:  { type: Scratch.ArgumentType.STRING, menu: 'ouiNon', defaultValue: 'oui' }
                        }
                    },
                    {
                        opcode:    'changerVisibiliteTexte',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'texte id [ID] visible [VISIBLE]',
                        arguments: {
                            ID:      { type: Scratch.ArgumentType.STRING, defaultValue: 'mon_texte' },
                            VISIBLE: { type: Scratch.ArgumentType.STRING, menu: 'ouiNon', defaultValue: 'oui' }
                        }
                    },
                    {
                        opcode:    'supprimerTexte',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'supprimer texte id [ID]',
                        arguments: {
                            ID: { type: Scratch.ArgumentType.STRING, defaultValue: 'mon_texte' }
                        }
                    },
                    {
                        opcode:    'supprimerTousTextes',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'supprimer tous les textes'
                    },
                    {
                        opcode:    'texteExiste',
                        blockType: Scratch.BlockType.BOOLEAN,
                        text:      'texte id [ID] existe ?',
                        arguments: {
                            ID: { type: Scratch.ArgumentType.STRING, defaultValue: 'mon_texte' }
                        }
                    },

                    // ══════════════════════════════
                    //  VAKAR GAMES PLAY
                    // ══════════════════════════════
                    { blockType: Scratch.BlockType.LABEL, text: '— VakarGames Play —' },
                    {
                        opcode:    'playConfigurer',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'configurer VakarGames Play projet [SLUG]',
                        arguments: { SLUG: { type: Scratch.ArgumentType.STRING, defaultValue: 'mon-jeu' } }
                    },
                    {
                        opcode:    'playAfficherConnexion',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'afficher popup connexion VakarGames Play'
                    },
                    {
                        opcode:    'playEstConnecte',
                        blockType: Scratch.BlockType.BOOLEAN,
                        text:      'joueur connecté ?'
                    },
                    {
                        opcode:    'playNomJoueur',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'nom du joueur connecté'
                    },
                    {
                        opcode:    'playIdJoueur',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'id du joueur connecté'
                    },
                    {
                        opcode:    'playDeconnecter',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'déconnecter le joueur'
                    },
                    {
                        opcode:    'playSauvegarder',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'sauvegarder [CATEGORIE] données [DONNEES]',
                        arguments: {
                            CATEGORIE: { type: Scratch.ArgumentType.STRING, menu: 'categoriesSave', defaultValue: 'stats' },
                            DONNEES:   { type: Scratch.ArgumentType.STRING, defaultValue: '{}' }
                        }
                    },
                    {
                        opcode:    'playCharger',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'charger [CATEGORIE]',
                        arguments: {
                            CATEGORIE: { type: Scratch.ArgumentType.STRING, menu: 'categoriesSave', defaultValue: 'stats' }
                        }
                    },
                    {
                        opcode:    'playPersonnaliser',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'personnaliser popup couleur [COULEUR] titre [TITRE]',
                        arguments: {
                            COULEUR: { type: Scratch.ArgumentType.STRING, defaultValue: '#4ECDC4' },
                            TITRE:   { type: Scratch.ArgumentType.STRING, defaultValue: 'VakarGames Play' }
                        }
                    },
                    '---',
                    {
                        opcode:    'playOuvrirChargement',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'ouvrir écran de chargement'
                    },
                    {
                        opcode:    'playFermerChargement',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'fermer écran de chargement'
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

            // Clé de version : updated_at si présent (nouveaux fichiers), sinon uploaded_at (anciens)
            const fileVersion = file.updated_at || file.uploaded_at || file.id;

            // Si le costume existe déjà avec la même version → skip (pas de doublon)
            const existing = target.sprite.costumes_.find(c => c.name === file.name);
            if (existing) {
                await this._ensureFilesCache();
                const cached = await this._filesCache.get(file.id).catch(() => null);
                if (cached && cached.updated_at === fileVersion) return; // déjà à jour
                // Fichier mis à jour : supprime l'ancien avant d'ajouter le nouveau
                const idx = target.sprite.costumes_.indexOf(existing);
                if (idx !== -1) target.deleteCostume(idx);
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

            const bytes = await this._getFileBytes(file.id, fileVersion);

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
            this._updateLoadingScreen(file.name);
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

        async loadTextEngine({ GROUP_ID, SPRITE }) {
            const target = this._findTarget(SPRITE);
            if (!target) { this._filesError = 'Sprite "' + SPRITE + '" introuvable.'; return; }

            let files;
            try { files = await this._fetchFileList(); } catch (e) { this._filesError = e.message; return; }

            const gid   = String(GROUP_ID).trim();
            const group = files.filter(f => f.group_id === gid);
            if (!group.length) { this._filesError = 'Groupe text engine "' + gid + '" introuvable.'; return; }

            this._filesReady = false;
            this._filesError = '';
            try {
                for (const f of group) {
                    if (fileExt(f.original_filename) === null) continue;
                    try { await this._addCostumeToTarget(target, f); }
                    catch (e) { console.warn('[VG] Text engine: ' + f.name + ' → ' + e.message); }
                }
                this._filesReady = true;
            } catch (e) {
                this._filesError = e.message;
            }
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

        async removeAllCostumes({ SPRITE }) {
            const target = this._findTarget(SPRITE);
            if (!target) return;
            const vm      = Scratch.vm;
            const storage = vm.runtime.storage;

            // 1. Ajouter un costume SVG vide AVANT de supprimer (TurboWarp exige min 1)
            const blankSVG = new TextEncoder().encode(
                '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'
            );
            const asset = storage.createAsset(
                storage.AssetType.ImageVector, storage.DataFormat.SVG, blankSVG, null, true
            );
            const blank = {
                asset,
                assetId:          asset.assetId,
                name:             '',
                md5ext:           asset.assetId + '.svg',
                bitmapResolution: 1,
                rotationCenterX:  0,
                rotationCenterY:  0,
            };
            const oldCount = target.sprite.costumes_.length;
            await vm.addCostume(blank.md5ext, blank, target.id);

            // Forcer le nom vide (TurboWarp renomme automatiquement à l'ajout)
            const added = target.sprite.costumes_[target.sprite.costumes_.length - 1];
            if (added) added.name = '';

            // 2. Supprimer tous les anciens costumes (de la fin vers 0)
            for (let i = oldCount - 1; i >= 0; i--) {
                target.deleteCostume(i);
            }
        }

        removeCostumeByName({ NOM, SPRITE }) {
            const target = this._findTarget(SPRITE);
            if (!target) return;
            const idx = target.sprite.costumes_.findIndex(c => c.name === String(NOM));
            if (idx !== -1 && target.sprite.costumes_.length > 1) {
                target.deleteCostume(idx);
            }
        }

        removeCostumeByIndex({ NUM, SPRITE }) {
            const target = this._findTarget(SPRITE);
            if (!target) return;
            const idx = Math.round(Number(NUM)) - 1; // 1-based → 0-based
            if (idx >= 0 && idx < target.sprite.costumes_.length && target.sprite.costumes_.length > 1) {
                target.deleteCostume(idx);
            }
        }

        removeUnnamedCostumes({ SPRITE }) {
            const target = this._findTarget(SPRITE);
            if (!target) return;
            for (let i = target.sprite.costumes_.length - 1; i >= 0; i--) {
                if (!target.sprite.costumes_[i].name && target.sprite.costumes_.length > 1) {
                    target.deleteCostume(i);
                }
            }
        }

        // ── HTML Overlay Text Engine ─────────────────────────────────────────

        _ensureOverlay() {
            if (this._overlayContainer && document.body.contains(this._overlayContainer)) return;
            const canvas = Scratch.renderer && Scratch.renderer.canvas;
            if (!canvas || typeof document === 'undefined') return;

            const div = document.createElement('div');
            div.style.cssText = 'position:fixed;pointer-events:none;overflow:hidden;z-index:9999;';
            document.body.appendChild(div);
            this._overlayContainer = div;

            const sync = () => {
                const r = canvas.getBoundingClientRect();
                div.style.left   = r.left   + 'px';
                div.style.top    = r.top    + 'px';
                div.style.width  = r.width  + 'px';
                div.style.height = r.height + 'px';
                this._overlayTexts.forEach(el => {
                    const pos = this._toCSS(
                        parseFloat(el.dataset.sx || 0),
                        parseFloat(el.dataset.sy || 0),
                        parseFloat(el.dataset.sz || 24),
                        r.width, r.height
                    );
                    el.style.left     = pos.left;
                    el.style.top      = pos.top;
                    el.style.fontSize = pos.fontSize;
                });
            };

            sync();
            new ResizeObserver(sync).observe(canvas);
            window.addEventListener('resize', sync);
        }

        _toCSS(sx, sy, sz, w, h) {
            w = w || parseFloat(this._overlayContainer.style.width)  || 480;
            h = h || parseFloat(this._overlayContainer.style.height) || 360;
            return {
                left:     ((Number(sx) + 240) / 480 * w) + 'px',
                top:      ((180 - Number(sy)) / 360 * h) + 'px',
                fontSize: (Number(sz) * w / 480) + 'px',
            };
        }

        afficherTexte({ ID, TEXTE, X, Y, POLICE, TAILLE, COULEUR, GRAS, ITALIQUE, VISIBLE }) {
            this._ensureOverlay();
            if (!this._overlayContainer) return;
            const id = String(ID).trim();
            if (!id) return;

            let el = this._overlayTexts.get(id);
            if (!el) {
                el = document.createElement('div');
                el.style.position   = 'absolute';
                el.style.whiteSpace = 'pre';
                el.style.userSelect = 'none';
                el.style.transform  = 'translate(-50%, -50%)';
                this._overlayContainer.appendChild(el);
                this._overlayTexts.set(id, el);
            }

            el.dataset.sx = String(X);
            el.dataset.sy = String(Y);
            el.dataset.sz = String(TAILLE);

            const pos = this._toCSS(X, Y, TAILLE);
            el.style.left       = pos.left;
            el.style.top        = pos.top;
            el.style.fontSize   = pos.fontSize;
            el.style.fontFamily = String(POLICE) || 'Arial';
            el.style.color      = String(COULEUR) || '#FFFFFF';
            el.style.fontWeight = String(GRAS).toLowerCase()     === 'oui' ? 'bold'   : 'normal';
            el.style.fontStyle  = String(ITALIQUE).toLowerCase() === 'oui' ? 'italic' : 'normal';
            el.style.display    = String(VISIBLE).toLowerCase()  === 'non' ? 'none'   : '';
            el.textContent      = String(TEXTE);
        }

        changerVisibiliteTexte({ ID, VISIBLE }) {
            const el = this._overlayTexts.get(String(ID).trim());
            if (!el) return;
            el.style.display = String(VISIBLE).toLowerCase() === 'non' ? 'none' : '';
        }

        supprimerTexte({ ID }) {
            const id = String(ID).trim();
            const el = this._overlayTexts.get(id);
            if (el) { el.remove(); this._overlayTexts.delete(id); }
        }

        supprimerTousTextes() {
            this._overlayTexts.forEach(el => el.remove());
            this._overlayTexts.clear();
        }

        texteExiste({ ID }) {
            return this._overlayTexts.has(String(ID).trim());
        }

        // ══════════════════════════════════════════
        //  VAKAR GAMES PLAY
        // ══════════════════════════════════════════

        _playStorageKey() { return 'vg_play_refresh_' + this._playSlug; }

        async _playRestoreSession() {
            const stored = localStorage.getItem(this._playStorageKey());
            if (!stored) return;
            try {
                const r = await _fetch(`${API_URL}/api/play/refresh`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ refresh_token: stored })
                });
                if (!r.ok) { localStorage.removeItem(this._playStorageKey()); return; }
                const d = await r.json();
                this._playAccessToken = d.access_token;
                this._playPlayer      = d.player;
            } catch { /* réseau indisponible — reste déconnecté */ }
        }

        async playConfigurer({ SLUG }) {
            this._playSlug = String(SLUG).trim();
            await this._playRestoreSession();
        }

        async playAfficherConnexion() {
            if (this._playPlayer) return;
            return new Promise(resolve => this._showPlayPopup(resolve));
        }

        playEstConnecte() { return !!this._playPlayer; }
        playNomJoueur()   { return this._playPlayer ? this._playPlayer.username : ''; }
        playIdJoueur()    { return this._playPlayer ? this._playPlayer.id : ''; }

        playDeconnecter() {
            this._playAccessToken = null;
            this._playPlayer      = null;
            localStorage.removeItem(this._playStorageKey());
        }

        async playSauvegarder({ CATEGORIE, DONNEES }) {
            if (!this._playAccessToken) return;
            try {
                await _fetch(`${API_URL}/api/play/save`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this._playAccessToken}` },
                    body:    JSON.stringify({ category: String(CATEGORIE), data: String(DONNEES), project_slug: this._playSlug })
                });
            } catch { /* noop */ }
        }

        async playCharger({ CATEGORIE }) {
            if (!this._playAccessToken) return '{}';
            try {
                const r = await _fetch(
                    `${API_URL}/api/play/load?category=${encodeURIComponent(CATEGORIE)}&project_slug=${encodeURIComponent(this._playSlug)}`,
                    { headers: { 'Authorization': `Bearer ${this._playAccessToken}` } }
                );
                if (!r.ok) return '{}';
                const d = await r.json();
                return d.data || '{}';
            } catch { return '{}'; }
        }

        playPersonnaliser({ COULEUR, TITRE }) {
            this._playAccent = String(COULEUR).trim() || '#4ECDC4';
            this._playTitle  = String(TITRE).trim()   || 'VakarGames Play';
        }

        playOuvrirChargement() { this._showLoadingScreen(); }
        playFermerChargement() { this._closeLoadingScreen(); }

        _showLoadingScreen() {
            if (this._loadingPopup) { this._loadingPopup.remove(); }
            this._loadingCount = 0;
            const accent = this._playAccent;
            const title  = this._playTitle;

            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;z-index:999998;background:rgba(15,20,30,0.72);display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;backdrop-filter:blur(3px)';
            this._loadingPopup = overlay;

            const card = document.createElement('div');
            card.style.cssText = 'background:#fff;border-radius:18px;padding:28px 30px 24px;width:320px;max-width:90vw;box-shadow:0 24px 64px rgba(0,0,0,0.32)';
            overlay.appendChild(card);

            // Header: icon + title + subtitle
            const hdr = document.createElement('div');
            hdr.style.cssText = 'display:flex;align-items:center;gap:13px;margin-bottom:18px';
            hdr.innerHTML = `
                <div style="width:42px;height:42px;border-radius:11px;background:${accent};display:flex;align-items:center;justify-content:center;flex-shrink:0">
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                </div>
                <div>
                    <div style="font-size:15px;font-weight:700;color:#1a1a1a;line-height:1.2">${title}</div>
                    <div style="font-size:11px;color:#aaa;margin-top:2px;letter-spacing:0.02em">Loading resources…</div>
                </div>`;
            card.appendChild(hdr);

            // Spinner row
            const spinRow = document.createElement('div');
            spinRow.style.cssText = 'display:flex;align-items:center;gap:9px;margin-bottom:14px';
            spinRow.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 16 16" style="animation:_vg_spin 0.75s linear infinite;flex-shrink:0">
                    <style>@keyframes _vg_spin{to{transform:rotate(360deg)}}</style>
                    <circle cx="8" cy="8" r="5.5" fill="none" stroke="#e5e7eb" stroke-width="2"/>
                    <path d="M8 2.5A5.5 5.5 0 0 1 13.5 8" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <span style="font-size:12px;color:#888">Please wait…</span>`;
            card.appendChild(spinRow);

            // Separator
            const sep = document.createElement('div');
            sep.style.cssText = `height:1px;background:linear-gradient(90deg,${accent}40,transparent);margin-bottom:12px;border-radius:1px`;
            card.appendChild(sep);

            // Resource list
            const listWrap = document.createElement('div');
            listWrap.style.cssText = 'max-height:180px;overflow-y:auto;display:flex;flex-direction:column;gap:0';
            card.appendChild(listWrap);
            this._loadingList = listWrap;

            document.body.appendChild(overlay);
        }

        _updateLoadingScreen(name) {
            if (!this._loadingPopup || !this._loadingList) return;
            this._loadingCount++;
            const n = this._loadingCount;
            const accent = this._playAccent;

            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #f3f4f6';
            row.innerHTML = `
                <span style="font-size:10px;font-weight:700;color:${accent};min-width:18px;text-align:right;flex-shrink:0">${n}</span>
                <span style="flex:1;font-size:12px;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${name}">${name}</span>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style="flex-shrink:0"><circle cx="6.5" cy="6.5" r="6" fill="${accent}20"/><path d="M3.5 6.5l2 2 4-4" stroke="${accent}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
            this._loadingList.appendChild(row);
            this._loadingList.scrollTop = this._loadingList.scrollHeight;
        }

        _closeLoadingScreen() {
            if (this._loadingPopup) { this._loadingPopup.remove(); this._loadingPopup = null; }
            this._loadingList  = null;
            this._loadingCount = 0;
        }

        _showPlayPopup(onClose) {
            if (this._playPopup) { this._playPopup.remove(); this._playPopup = null; }
            const accent = this._playAccent;
            const title  = this._playTitle;

            const LANGS = {
                en: { flag:'🇬🇧', code:'EN', login:'Sign In',        register:'Create Account',  lPh:'Username or email',          pPh:'Password',                uPh:'Username (3-20 chars, letters/numbers/_)', ePh:'Email', rPPh:'Password (min 6 chars)',       lBtn:'Sign In',        rBtn:'Create Account',  eLo:'Login failed',             eRe:'Registration failed',     eNe:'Network error'  },
                fr: { flag:'🇫🇷', code:'FR', login:'Connexion',      register:'Créer un compte', lPh:'Pseudo ou email',            pPh:'Mot de passe',            uPh:'Pseudo (3-20 car., lettres/chiffres/_)',   ePh:'Email', rPPh:'Mot de passe (min 6 car.)', lBtn:'Se connecter',   rBtn:'Créer le compte', eLo:'Erreur de connexion',      eRe:"Erreur d'inscription",    eNe:'Erreur réseau'  },
                es: { flag:'🇪🇸', code:'ES', login:'Iniciar sesión', register:'Crear cuenta',    lPh:'Usuario o email',            pPh:'Contraseña',              uPh:'Usuario (3-20 car., letras/números/_)',    ePh:'Email', rPPh:'Contraseña (mín 6 car.)',   lBtn:'Iniciar sesión', rBtn:'Crear cuenta',    eLo:'Error de inicio de sesión',eRe:'Error de registro',       eNe:'Error de red'   },
                de: { flag:'🇩🇪', code:'DE', login:'Anmelden',       register:'Konto erstellen', lPh:'Benutzername oder E-Mail',   pPh:'Passwort',                uPh:'Benutzername (3-20 Zeichen, a-z/0-9/_)',  ePh:'E-Mail',rPPh:'Passwort (mind. 6 Zeichen)', lBtn:'Anmelden',       rBtn:'Konto erstellen', eLo:'Anmeldefehler',            eRe:'Registrierungsfehler',    eNe:'Netzwerkfehler' },
                pt: { flag:'🇧🇷', code:'PT', login:'Entrar',         register:'Criar conta',     lPh:'Usuário ou email',           pPh:'Senha',                   uPh:'Usuário (3-20 car., letras/números/_)',    ePh:'Email', rPPh:'Senha (mín 6 car.)',        lBtn:'Entrar',         rBtn:'Criar conta',     eLo:'Erro de login',            eRe:'Erro de registro',        eNe:'Erro de rede'   },
                it: { flag:'🇮🇹', code:'IT', login:'Accedi',         register:'Crea account',    lPh:'Nome utente o email',        pPh:'Password',                uPh:'Nome utente (3-20 car., lettere/numeri/_)',ePh:'Email', rPPh:'Password (min 6 car.)',     lBtn:'Accedi',         rBtn:'Crea account',    eLo:'Errore di accesso',        eRe:'Errore di registrazione', eNe:'Errore di rete' },
            };
            const savedLang = (() => { try { return localStorage.getItem('vg_play_lang') || 'en'; } catch { return 'en'; } })();
            let lang = LANGS[savedLang] ? savedLang : 'en';

            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif';
            this._playPopup = overlay;

            const card = document.createElement('div');
            card.style.cssText = 'background:#fff;border-radius:16px;padding:32px;width:340px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.25);position:relative';
            overlay.appendChild(card);

            // Language selector (top-right, no close button)
            const langSel = document.createElement('select');
            langSel.style.cssText = 'position:absolute;top:12px;right:14px;padding:3px 6px;border:1.5px solid #e5e7eb;border-radius:6px;font-size:13px;cursor:pointer;background:#fff;color:#444;outline:none';
            for (const [code, l] of Object.entries(LANGS)) {
                const opt = document.createElement('option');
                opt.value = code;
                opt.textContent = l.flag + ' ' + l.code;
                if (code === lang) opt.selected = true;
                langSel.appendChild(opt);
            }
            card.appendChild(langSel);

            const header = document.createElement('div');
            header.style.cssText = 'text-align:center;margin-bottom:20px';
            header.innerHTML = `<div style="width:44px;height:44px;border-radius:12px;background:${accent};margin:0 auto 10px;display:flex;align-items:center;justify-content:center"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></div><div style="font-size:18px;font-weight:700;color:#1a1a1a">${title}</div>`;
            card.appendChild(header);

            const tabBar = document.createElement('div');
            tabBar.style.cssText = 'display:flex;gap:4px;background:#f3f4f6;border-radius:8px;padding:4px;margin-bottom:20px';
            card.appendChild(tabBar);

            const loginTab = document.createElement('button');
            const regTab   = document.createElement('button');
            const tabStyle = (active) => `flex:1;padding:6px 0;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.15s;${active ? `background:#fff;color:${accent};box-shadow:0 1px 4px rgba(0,0,0,0.1)` : 'background:transparent;color:#666'}`;
            loginTab.style.cssText = tabStyle(true);
            regTab.style.cssText   = tabStyle(false);
            tabBar.appendChild(loginTab);
            tabBar.appendChild(regTab);

            const forms = document.createElement('div');
            card.appendChild(forms);

            const errEl = document.createElement('div');
            errEl.style.cssText = 'font-size:12px;color:#e53e3e;text-align:center;min-height:16px;margin-top:6px';
            card.appendChild(errEl);

            const mkInput = (type = 'text') => {
                const el = document.createElement('input');
                el.type = type;
                el.style.cssText = 'width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:14px;outline:none;margin-bottom:10px;transition:border 0.15s';
                el.addEventListener('focus', () => el.style.borderColor = accent);
                el.addEventListener('blur',  () => el.style.borderColor = '#e5e7eb');
                return el;
            };
            const mkBtn = () => {
                const b = document.createElement('button');
                b.style.cssText = `width:100%;padding:11px;background:${accent};color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-top:4px`;
                return b;
            };

            const loginField = mkInput();
            const loginPwd   = mkInput('password');
            const loginBtn   = mkBtn();
            const loginForm  = document.createElement('div');
            loginForm.appendChild(loginField);
            loginForm.appendChild(loginPwd);
            loginForm.appendChild(loginBtn);

            const regUser  = mkInput();
            const regEmail = mkInput();
            const regPwd   = mkInput('password');
            const regBtn   = mkBtn();
            const regForm  = document.createElement('div');
            regForm.style.display = 'none';
            regForm.appendChild(regUser);
            regForm.appendChild(regEmail);
            regForm.appendChild(regPwd);
            regForm.appendChild(regBtn);
            forms.appendChild(loginForm);
            forms.appendChild(regForm);

            const applyLang = (l) => {
                const t = LANGS[l];
                loginTab.textContent   = t.login;
                regTab.textContent     = t.register;
                loginField.placeholder = t.lPh;
                loginPwd.placeholder   = t.pPh;
                loginBtn.textContent   = t.lBtn;
                regUser.placeholder    = t.uPh;
                regEmail.placeholder   = t.ePh;
                regPwd.placeholder     = t.rPPh;
                regBtn.textContent     = t.rBtn;
            };
            applyLang(lang);

            langSel.addEventListener('change', () => {
                lang = langSel.value;
                try { localStorage.setItem('vg_play_lang', lang); } catch {}
                errEl.textContent = '';
                applyLang(lang);
            });

            const setTab = (isLogin) => {
                loginTab.style.cssText  = tabStyle(isLogin);
                regTab.style.cssText    = tabStyle(!isLogin);
                loginForm.style.display = isLogin ? '' : 'none';
                regForm.style.display   = isLogin ? 'none' : '';
                errEl.textContent = '';
            };
            loginTab.addEventListener('click', () => setTab(true));
            regTab.addEventListener('click',   () => setTab(false));

            const setLoading = (btn, loading) => { btn.disabled = loading; btn.style.opacity = loading ? '0.7' : '1'; };

            loginBtn.addEventListener('click', async () => {
                errEl.textContent = '';
                setLoading(loginBtn, true);
                try {
                    const r = await _fetch(`${API_URL}/api/play/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ login: loginField.value.trim(), password: loginPwd.value, project_slug: this._playSlug })
                    });
                    let d = {};
                    try { d = await r.json(); } catch {}
                    if (!r.ok) { errEl.textContent = d.detail || LANGS[lang].eLo; setLoading(loginBtn, false); return; }
                    localStorage.setItem(this._playStorageKey(), d.refresh_token);
                    this._playAccessToken = d.access_token;
                    this._playPlayer      = d.player;
                    this._closePlayPopup();
                    if (onClose) onClose();
                } catch (err) { errEl.textContent = LANGS[lang].eNe + ' (' + (err && err.message ? err.message : '?') + ')'; setLoading(loginBtn, false); }
            });

            regBtn.addEventListener('click', async () => {
                errEl.textContent = '';
                setLoading(regBtn, true);
                try {
                    const r = await _fetch(`${API_URL}/api/play/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: regUser.value.trim(), email: regEmail.value.trim(), password: regPwd.value, project_slug: this._playSlug })
                    });
                    let d = {};
                    try { d = await r.json(); } catch {}
                    if (!r.ok) { errEl.textContent = d.detail || LANGS[lang].eRe; setLoading(regBtn, false); return; }
                    localStorage.setItem(this._playStorageKey(), d.refresh_token);
                    this._playAccessToken = d.access_token;
                    this._playPlayer      = d.player;
                    this._closePlayPopup();
                    if (onClose) onClose();
                } catch (err) { errEl.textContent = LANGS[lang].eNe + ' (' + (err && err.message ? err.message : '?') + ')'; setLoading(regBtn, false); }
            });

            document.body.appendChild(overlay);
        }

        _closePlayPopup() {
            if (this._playPopup) { this._playPopup.remove(); this._playPopup = null; }
        }
    }

    Scratch.extensions.register(new VakarGames());

})(Scratch);
