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

    function audioExt(filename) {
        const s = (filename || '').toLowerCase();
        if (s.endsWith('.mp3')) return 'mp3';
        if (s.endsWith('.wav')) return 'wav';
        if (s.endsWith('.ogg')) return 'ogg';
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
            this._fileIndex    = {};
            this._filesCache   = null;

            // Sounds (same server/cache as Files, separate ready/error state)
            this._soundsReady  = false;

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
            this._playSaveCache   = {};
            this._loadingPopup = null;
            this._loadingBarEl = null;
            this._loadingCount = 0;
            this._loadingMax   = 1;

            // In-game admin tools: journal + dev/logs panels
            this._logEntries  = [];   // { ts, level: 'info'|'warn'|'error', source, message }
            this._logCounts   = { info: 0, warn: 0, error: 0 };
            this._logsListEl  = null; // live-append target while the logs panel is open
            this._logFilters  = { info: true, warn: true, error: true, source: 'All', search: '' };
            this._logsAutoStick = true;
            this._devPanel    = null;
            this._logsPanel   = null;
            this._devPanelDirty = { inventory: false, stats: false, craft: false, tech: false, others: false };
            this._devCatState = {}; // per-category in-memory editor state while the dev panel is open
            this._logStatsEl = null;
            this._devPanelPausedRuntime = false; // whether WE paused the runtime (vs. it already being paused)
            this._devPanelOnClose = null; // resolves the "ouvrir panel développeur" block's promise on close
            this._devVarBindings = {}; // { category: 'NONE'|'AUTO'|variableId } for the current dev panel session

            // Auto-log any error assignment made anywhere in the extension,
            // without having to touch every call site individually.
            let _filesErrorVal = '';
            Object.defineProperty(this, '_filesError', {
                get: () => _filesErrorVal,
                set: (v) => { _filesErrorVal = v; if (v) this._log('error', 'Resources: ' + v); },
            });
            let _soundsErrorVal = '';
            Object.defineProperty(this, '_soundsError', {
                get: () => _soundsErrorVal,
                set: (v) => { _soundsErrorVal = v; if (v) this._log('error', 'Sounds: ' + v); },
            });
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
                    categoriesSave: { acceptReporters: true, items: ['inventory', 'stats', 'craft', 'tech', 'others'] },
                    gravite:       { acceptReporters: true, items: ['info', 'attention', 'erreur'] }
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
                    //  SONS
                    // ══════════════════════════════
                    { blockType: Scratch.BlockType.LABEL, text: '— Sons —' },

                    {
                        opcode:    'loadAllSounds',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'charger tous les sons dans le sprite [SPRITE]',
                        arguments: {
                            SPRITE: { type: Scratch.ArgumentType.STRING, defaultValue: 'Sprite1' }
                        }
                    },
                    {
                        opcode:    'soundsReady',
                        blockType: Scratch.BlockType.BOOLEAN,
                        text:      'sons prêts ?'
                    },
                    {
                        opcode:    'soundsError',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'erreur de chargement des sons'
                    },
                    {
                        opcode:    'loadSoundById',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'charger son [LABEL] ID [ID] dans sprite [SPRITE]',
                        arguments: {
                            LABEL:  { type: Scratch.ArgumentType.STRING, defaultValue: 'nom du son' },
                            ID:     { type: Scratch.ArgumentType.STRING, defaultValue: '' },
                            SPRITE: { type: Scratch.ArgumentType.STRING, defaultValue: 'Sprite1' }
                        }
                    },
                    '---',
                    {
                        opcode:    'removeAllSounds',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'supprimer tous les sons du sprite [SPRITE]',
                        arguments: {
                            SPRITE: { type: Scratch.ArgumentType.STRING, defaultValue: 'Sprite1' }
                        }
                    },
                    {
                        opcode:    'removeSoundByName',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'supprimer le son [NOM] du sprite [SPRITE]',
                        arguments: {
                            NOM:    { type: Scratch.ArgumentType.STRING, defaultValue: 'bruitage' },
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
                        text:      'ouvrir barre de chargement max [MAX]',
                        arguments: { MAX: { type: Scratch.ArgumentType.NUMBER, defaultValue: 10 } }
                    },
                    {
                        opcode:    'playFermerChargement',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'fermer barre de chargement'
                    },

                    // ══════════════════════════════
                    //  OUTILS DEV IN-GAME
                    // ══════════════════════════════
                    { blockType: Scratch.BlockType.LABEL, text: '— Outils Dev In-Game —' },
                    {
                        opcode:    'ouvrirPanelDev',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'ouvrir panel développeur du jeu'
                    },
                    {
                        opcode:    'ouvrirPanelLogs',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'ouvrir panel logs du jeu'
                    },
                    {
                        opcode:    'ecrireLog',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'écrire dans les logs [MESSAGE] gravité [GRAVITE]',
                        arguments: {
                            MESSAGE:  { type: Scratch.ArgumentType.STRING, defaultValue: 'Message' },
                            GRAVITE:  { type: Scratch.ArgumentType.STRING, menu: 'gravite', defaultValue: 'info' }
                        }
                    },
                    '---',
                    {
                        opcode:    'panelDevCategorieModifiee',
                        blockType: Scratch.BlockType.BOOLEAN,
                        text:      'panel dev : catégorie [CATEGORIE] modifiée ?',
                        arguments: {
                            CATEGORIE: { type: Scratch.ArgumentType.STRING, menu: 'categoriesSave', defaultValue: 'stats' }
                        }
                    },
                    '---',
                    {
                        opcode:    'copierPressePapier',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'copier [TEXTE] dans le presse-papier',
                        arguments: {
                            TEXTE: { type: Scratch.ArgumentType.STRING, defaultValue: 'texte à copier' }
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
                if (!res.ok) { this._log('warn', 'Shop: checkout rejected (product ' + productId + ')'); return false; }
                const data  = await res.json();
                checkoutUrl = data.checkout_url;
                sessionId   = data.session_id;
                this._log('info', 'Shop: checkout opened for product ' + productId);
            } catch (e) { this._log('error', 'Shop: network error during checkout — ' + e.message); return false; }

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
                            const ok = d.status === 'complete';
                            this._log(ok ? 'info' : 'warn', 'Shop: purchase ' + (ok ? 'confirmed' : 'not confirmed after window closed'));
                            resolve(ok);
                        } catch (e) { this._log('error', 'Shop: payment verification error — ' + e.message); resolve(false); }
                        return;
                    }

                    if (elapsed >= maxMs) {
                        clearInterval(interval);
                        this._log('warn', 'Shop: payment wait timed out');
                        resolve(false);
                        return;
                    }

                    try {
                        const r = await _fetch(`${API_URL}/api/shop/session/${encodeURIComponent(sessionId)}/status`);
                        const d = await r.json();
                        if (d.status === 'complete') {
                            clearInterval(interval);
                            if (popupRef && !popupRef.closed) popupRef.close();
                            this._log('info', 'Shop: purchase confirmed');
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
                this._log('info', 'Chat: message sent by ' + USERNAME);
            } catch (e) { this._log('error', 'Chat: failed to send message — ' + e.message); }
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

        async _addSoundToTarget(target, file) {
            const vm      = Scratch.vm;
            const storage = vm.runtime.storage;
            const ext     = audioExt(file.original_filename);

            const fileVersion = file.updated_at || file.uploaded_at || file.id;

            // Si le son existe déjà avec la même version → skip (pas de doublon)
            const existing = target.sprite.sounds_.find(s => s.name === file.name);
            if (existing) {
                await this._ensureFilesCache();
                const cached = await this._filesCache.get(file.id).catch(() => null);
                if (cached && cached.updated_at === fileVersion) return; // déjà à jour
                const idx = target.sprite.sounds_.indexOf(existing);
                if (idx !== -1) target.deleteSound(idx);
            }

            let dataFormat, formatTag, suffix;
            if (ext === 'mp3') { dataFormat = storage.DataFormat.MP3 || 'mp3'; formatTag = 'mp3'; suffix = '.mp3'; }
            else if (ext === 'ogg') { dataFormat = storage.DataFormat.OGG || 'ogg'; formatTag = 'ogg'; suffix = '.ogg'; }
            else { dataFormat = storage.DataFormat.WAV; formatTag = 'wav'; suffix = '.wav'; }

            const bytes = await this._getFileBytes(file.id, fileVersion);
            const asset = storage.createAsset(storage.AssetType.Sound, dataFormat, bytes, null, true);
            const soundObject = {
                asset,
                assetId:     asset.assetId,
                name:        file.name,
                dataFormat:  formatTag,
                format:      '',
                rate:        44100,
                sampleCount: 0,
                md5:         asset.assetId + suffix,
            };
            await vm.addSound(soundObject, target.id);
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
            // Images et sons sont tous deux reconnus ici ; chaque bloc filtre ensuite selon son besoin
            const files = (data.files || []).filter(f => fileExt(f.original_filename) !== null || audioExt(f.original_filename) !== null);
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
            this._soundsReady  = false;
            this._soundsError  = '';
        }

        hasInternet() {
            return navigator.onLine === true;
        }

        async useLiveVersion() {
            if (!this._filesSlug || !this._filesApiKey) {
                this._filesError = 'Configure the resources first.';
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
                    this._soundsReady  = false;
                }
                this._log('info', 'Resources: live version = ' + v);
            } catch (e) {
                this._filesError = 'Could not fetch the live version: ' + e.message;
            }
        }

        useVersion({ V }) {
            const tag = String(V).trim() || 'default';
            if (tag !== this._filesVersion) {
                this._filesVersion = tag;
                this._filesCache   = null;
                this._filesReady   = false;
                this._soundsReady  = false;
            }
        }

        currentVersion() { return this._filesVersion; }

        async loadAllToSprite({ SPRITE }) {
            if (!this._filesSlug || !this._filesApiKey) {
                this._filesError = 'Configure the resources first.';
                return;
            }
            const target = this._findTarget(SPRITE);
            if (!target) {
                this._filesError = 'Sprite "' + SPRITE + '" not found.';
                return;
            }
            this._filesReady = false;
            this._filesError = '';
            try {
                const files = await this._fetchFileList();
                const images = files.filter(f => fileExt(f.original_filename) !== null);
                let loaded = 0;
                for (const f of images) {
                    try {
                        await this._addCostumeToTarget(target, f);
                        loaded++;
                    } catch (e) {
                        console.warn('[VG] Could not load ' + f.name + ' : ' + e.message);
                        this._log('error', 'Resources: failed to load "' + f.name + '" — ' + e.message);
                    }
                }
                this._filesReady = true;
                this._log('info', `Resources: ${loaded}/${images.length} costumes loaded into "${SPRITE}"`);
            } catch (e) {
                this._filesError = e.message;
            }
        }

        filesReady()  { return this._filesReady; }
        filesError()  { return this._filesError; }

        async loadCostumeById({ ID, SPRITE }) {
            const target = this._findTarget(SPRITE);
            if (!target) { this._filesError = 'Sprite "' + SPRITE + '" not found.'; return; }

            let f = this._fileIndex[String(ID)];
            if (!f) {
                try { await this._fetchFileList(); } catch (e) { this._filesError = e.message; return; }
                f = this._fileIndex[String(ID)];
            }
            if (!f) { this._filesError = 'File ID "' + ID + '" not found in version "' + this._filesVersion + '".'; return; }
            if (fileExt(f.original_filename) === null) { this._filesError = '"' + f.name + '" is not an image (SVG/PNG/JPG).'; return; }

            try {
                await this._addCostumeToTarget(target, f);
            } catch (e) { this._filesError = e.message; }
        }

        async loadTextEngine({ GROUP_ID, SPRITE }) {
            const target = this._findTarget(SPRITE);
            if (!target) { this._filesError = 'Sprite "' + SPRITE + '" not found.'; return; }

            let files;
            try { files = await this._fetchFileList(); } catch (e) { this._filesError = e.message; return; }

            const gid   = String(GROUP_ID).trim();
            const group = files.filter(f => f.group_id === gid);
            if (!group.length) { this._filesError = 'Text engine group "' + gid + '" not found.'; return; }

            this._filesReady = false;
            this._filesError = '';
            try {
                let loaded = 0;
                for (const f of group) {
                    if (fileExt(f.original_filename) === null) continue;
                    try { await this._addCostumeToTarget(target, f); loaded++; }
                    catch (e) {
                        console.warn('[VG] Text engine: ' + f.name + ' → ' + e.message);
                        this._log('error', 'Text Engine: failed "' + f.name + '" — ' + e.message);
                    }
                }
                this._filesReady = true;
                this._log('info', `Text Engine: group "${gid}" — ${loaded} file(s) loaded`);
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

        // ══════════════════════════════════════════
        //  SONS — blocs
        // ══════════════════════════════════════════

        async loadAllSounds({ SPRITE }) {
            if (!this._filesSlug || !this._filesApiKey) {
                this._soundsError = 'Configure the resources first.';
                return;
            }
            const target = this._findTarget(SPRITE);
            if (!target) {
                this._soundsError = 'Sprite "' + SPRITE + '" not found.';
                return;
            }
            this._soundsReady = false;
            this._soundsError = '';
            try {
                const files  = await this._fetchFileList();
                const sounds = files.filter(f => audioExt(f.original_filename) !== null);
                let loaded = 0;
                for (const f of sounds) {
                    try {
                        await this._addSoundToTarget(target, f);
                        loaded++;
                    } catch (e) {
                        console.warn('[VG] Could not load sound ' + f.name + ' : ' + e.message);
                        this._log('error', 'Sounds: failed to load "' + f.name + '" — ' + e.message);
                    }
                }
                this._soundsReady = true;
                this._log('info', `Sounds: ${loaded}/${sounds.length} sounds loaded into "${SPRITE}"`);
            } catch (e) {
                this._soundsError = e.message;
            }
        }

        soundsReady() { return this._soundsReady; }
        soundsError() { return this._soundsError; }

        async loadSoundById({ ID, SPRITE }) {
            const target = this._findTarget(SPRITE);
            if (!target) { this._soundsError = 'Sprite "' + SPRITE + '" not found.'; return; }

            let f = this._fileIndex[String(ID)];
            if (!f) {
                try { await this._fetchFileList(); } catch (e) { this._soundsError = e.message; return; }
                f = this._fileIndex[String(ID)];
            }
            if (!f) { this._soundsError = 'File ID "' + ID + '" not found in version "' + this._filesVersion + '".'; return; }
            if (audioExt(f.original_filename) === null) { this._soundsError = '"' + f.name + '" is not a sound (MP3/WAV/OGG).'; return; }

            try {
                await this._addSoundToTarget(target, f);
            } catch (e) { this._soundsError = e.message; }
        }

        removeAllSounds({ SPRITE }) {
            const target = this._findTarget(SPRITE);
            if (!target) return;
            for (let i = target.sprite.sounds_.length - 1; i >= 0; i--) {
                target.deleteSound(i);
            }
        }

        removeSoundByName({ NOM, SPRITE }) {
            const target = this._findTarget(SPRITE);
            if (!target) return;
            const idx = target.sprite.sounds_.findIndex(s => s.name === String(NOM));
            if (idx !== -1) target.deleteSound(idx);
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
                if (!r.ok) {
                    localStorage.removeItem(this._playStorageKey());
                    this._log('warn', 'Session: resume rejected, signed out');
                    return;
                }
                const d = await r.json();
                this._playAccessToken = d.access_token;
                this._playPlayer      = d.player;
                this._log('info', 'Session: restored — ' + (d.player && d.player.username));
            } catch (e) { this._log('warn', 'Session: network unavailable, staying signed out — ' + e.message); }
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
            this._playSaveCache   = {};
            localStorage.removeItem(this._playStorageKey());
        }

        async playSauvegarder({ CATEGORIE, DONNEES }) {
            if (!this._playAccessToken) {
                this._log('warn', 'Save: not signed in, nothing was saved');
                return false;
            }
            const cat  = String(CATEGORIE);
            const data = String(DONNEES);
            // Defensive guard: warn if a script keeps saving this category while
            // the Dev Panel has it open — the game should be paused while the
            // panel is open, so this normally can't happen unless pause() failed.
            if (this._devPanel && this._devCatState[cat] && this._devCatState[cat].loaded) {
                this._log('warn', `Save: an external save for category "${cat}" ran while the Dev Panel had it open — the game may not be fully paused`, 'Dev Panel');
            }
            if (this._playSaveCache[cat] === data) return true; // rien changé → déjà sauvegardé
            try {
                const r = await _fetch(`${API_URL}/api/play/save`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this._playAccessToken}` },
                    body:    JSON.stringify({ category: cat, data: data, project_slug: this._playSlug })
                });
                if (r.ok) {
                    this._playSaveCache[cat] = data; // cache mis à jour uniquement si succès
                    this._log('info', 'Save: category "' + cat + '" saved');
                    return true;
                } else {
                    this._log('warn', 'Save: category "' + cat + '" rejected (HTTP ' + r.status + ')');
                    return false;
                }
            } catch (e) { this._log('error', 'Save: network error — ' + e.message); return false; }
        }

        async playCharger({ CATEGORIE }) {
            if (!this._playAccessToken) return '{}';
            try {
                const r = await _fetch(
                    `${API_URL}/api/play/load?category=${encodeURIComponent(CATEGORIE)}&project_slug=${encodeURIComponent(this._playSlug)}&_ts=${Date.now()}`,
                    { headers: { 'Authorization': `Bearer ${this._playAccessToken}` }, cache: 'no-store' }
                );
                if (!r.ok) { this._log('warn', 'Load: category "' + CATEGORIE + '" rejected (HTTP ' + r.status + ')'); return '{}'; }
                const d = await r.json();
                this._log('info', 'Load: category "' + CATEGORIE + '" loaded');
                return d.data || '{}';
            } catch (e) { this._log('error', 'Load: network error — ' + e.message); return '{}'; }
        }

        playPersonnaliser({ COULEUR, TITRE }) {
            this._playAccent = String(COULEUR).trim() || '#4ECDC4';
            this._playTitle  = String(TITRE).trim()   || 'VakarGames Play';
        }

        playOuvrirChargement({ MAX }) { this._showLoadingScreen(MAX); }
        playFermerChargement()        { this._closeLoadingScreen(); }

        _showLoadingScreen(max) {
            if (this._loadingPopup) { this._loadingPopup.remove(); }
            this._loadingCount = 0;
            this._loadingMax   = Math.max(1, parseInt(max) || 1);
            const accent = this._playAccent;

            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;z-index:999998;background:rgba(10,15,25,0.88);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
            this._loadingPopup = overlay;

            const wrap = document.createElement('div');
            wrap.style.cssText = 'width:min(620px,82vw)';

            const track = document.createElement('div');
            track.style.cssText = 'width:100%;height:8px;background:rgba(255,255,255,0.12);border-radius:4px;overflow:hidden';

            const bar = document.createElement('div');
            bar.style.cssText = `height:100%;width:0%;background:${accent};border-radius:4px;transition:width 0.3s ease`;
            track.appendChild(bar);
            wrap.appendChild(track);
            overlay.appendChild(wrap);
            this._loadingBarEl = bar;

            document.body.appendChild(overlay);
        }

        _updateLoadingScreen(name) {
            if (!this._loadingPopup || !this._loadingBarEl) return;
            this._loadingCount++;
            const pct = Math.min(this._loadingCount / this._loadingMax * 100, 100);
            this._loadingBarEl.style.width = pct + '%';
        }

        _closeLoadingScreen() {
            if (this._loadingPopup) { this._loadingPopup.remove(); this._loadingPopup = null; }
            this._loadingBarEl = null;
            this._loadingCount = 0;
            this._loadingMax   = 1;
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
                    if (!r.ok) {
                        errEl.textContent = d.detail || LANGS[lang].eLo;
                        setLoading(loginBtn, false);
                        this._log('warn', 'Auth: login failed — ' + (d.detail || LANGS[lang].eLo));
                        return;
                    }
                    localStorage.setItem(this._playStorageKey(), d.refresh_token);
                    this._playAccessToken = d.access_token;
                    this._playPlayer      = d.player;
                    this._log('info', 'Auth: login succeeded — ' + (d.player && d.player.username));
                    this._closePlayPopup();
                    if (onClose) onClose();
                } catch (err) {
                    errEl.textContent = LANGS[lang].eNe + ' (' + (err && err.message ? err.message : '?') + ')';
                    setLoading(loginBtn, false);
                    this._log('error', 'Auth: network error on login — ' + (err && err.message));
                }
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
                    if (!r.ok) {
                        errEl.textContent = d.detail || LANGS[lang].eRe;
                        setLoading(regBtn, false);
                        this._log('warn', 'Auth: registration failed — ' + (d.detail || LANGS[lang].eRe));
                        return;
                    }
                    localStorage.setItem(this._playStorageKey(), d.refresh_token);
                    this._playAccessToken = d.access_token;
                    this._playPlayer      = d.player;
                    this._log('info', 'Auth: account created and signed in — ' + (d.player && d.player.username));
                    this._closePlayPopup();
                    if (onClose) onClose();
                } catch (err) {
                    errEl.textContent = LANGS[lang].eNe + ' (' + (err && err.message ? err.message : '?') + ')';
                    setLoading(regBtn, false);
                    this._log('error', 'Auth: network error on registration — ' + (err && err.message));
                }
            });

            document.body.appendChild(overlay);
        }

        _closePlayPopup() {
            if (this._playPopup) { this._playPopup.remove(); this._playPopup = null; }
        }

        // ══════════════════════════════════════════
        //  IN-GAME DEV TOOLS — journal + panels
        // ══════════════════════════════════════════

        _log(level, message, source) {
            let text = String(message);
            let src  = source || 'System';
            if (!source) {
                const m = /^([^:]{2,24}):\s(.*)$/s.exec(text);
                if (m) { src = m[1]; text = m[2]; }
            }
            const entry = { ts: new Date(), level, source: src, message: text };
            this._logEntries.push(entry);
            if (this._logEntries.length > 500) this._logEntries.shift();
            if (this._logCounts[level] !== undefined) this._logCounts[level]++;
            if (this._logsListEl) {
                this._updateLogStats();
                if (this._logMatchesFilters(entry)) this._appendLogRow(entry);
            }
        }

        _escapeHtml(str) {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }

        ecrireLog({ MESSAGE, GRAVITE }) {
            const g = String(GRAVITE).trim().toLowerCase();
            const level = g === 'erreur' ? 'error' : g === 'attention' ? 'warn' : 'info';
            this._log(level, String(MESSAGE), 'Script');
        }

        panelDevCategorieModifiee({ CATEGORIE }) {
            const cat = String(CATEGORIE);
            const changed = !!this._devPanelDirty[cat];
            this._devPanelDirty[cat] = false;
            return changed;
        }

        // Pushes a freshly-saved Dev Panel value straight into the closest-matching
        // $-tagged global (Stage) Scratch variable, so the running game sees the
        // new value immediately — no need to wait for a "modifiée ?" poll to reload it.
        _pushValueToLocalVariable(categoryName, dataString) {
            try {
                const stage = Scratch.vm.runtime.getTargetForStage();
                if (!stage || !stage.variables) return false;
                const candidate = this._bestMatchingVariable(categoryName, this._getGlobalScalarVariables());
                if (!candidate) return false;
                const variable = stage.variables[candidate.id];
                if (!variable) return false;
                variable.value = dataString;
                return true;
            } catch (e) {
                this._log('error', 'Dev Panel: could not update local variable — ' + e.message, 'Dev Panel');
                return false;
            }
        }

        _getGlobalScalarVariables() {
            try {
                const stage = Scratch.vm.runtime.getTargetForStage();
                if (!stage || !stage.variables) return [];
                return Object.values(stage.variables)
                    .filter(v => v.type === '' && v.name.includes('$')) // scalar vars tagged with $, e.g. "$inventory"
                    .map(v => ({ id: v.id, name: v.name }))
                    .sort((a, b) => a.name.localeCompare(b.name));
            } catch { return []; }
        }

        // Picks the $-tagged variable whose name most closely matches a category
        // name (exact > substring > fuzzy), so the Dev Panel can pre-select a
        // sensible default instead of leaving it on "Auto-match by name".
        _bestMatchingVariable(categoryName, variables) {
            const clean = (s) => s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const catClean = clean(categoryName);
            if (!catClean) return null;
            let best = null;
            let bestScore = 0;
            for (const v of variables) {
                const varClean = clean(v.name);
                if (!varClean) continue;
                let score;
                if (varClean === catClean) {
                    score = 100;
                } else if (varClean.includes(catClean)) {
                    score = 80 * (catClean.length / varClean.length);
                } else if (catClean.includes(varClean)) {
                    score = 70 * (varClean.length / catClean.length);
                } else {
                    score = 50 * this._stringSimilarity(catClean, varClean);
                }
                if (score > bestScore) { bestScore = score; best = v; }
            }
            return bestScore >= 30 ? best : null;
        }

        _stringSimilarity(a, b) {
            const dist = this._levenshtein(a, b);
            const maxLen = Math.max(a.length, b.length) || 1;
            return 1 - dist / maxLen;
        }

        _levenshtein(a, b) {
            const m = a.length, n = b.length;
            const dp = [];
            for (let i = 0; i <= m; i++) { dp.push([i]); }
            for (let j = 1; j <= n; j++) { dp[0][j] = j; }
            for (let i = 1; i <= m; i++) {
                for (let j = 1; j <= n; j++) {
                    dp[i][j] = a[i - 1] === b[j - 1]
                        ? dp[i - 1][j - 1]
                        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
                }
            }
            return dp[m][n];
        }

        _setVariableById(variableId, dataString) {
            try {
                const stage = Scratch.vm.runtime.getTargetForStage();
                if (!stage || !stage.variables || !stage.variables[variableId]) return false;
                stage.variables[variableId].value = dataString;
                return true;
            } catch (e) {
                this._log('error', 'Dev Panel: could not update linked variable — ' + e.message, 'Dev Panel');
                return false;
            }
        }

        _loadVarBindings() {
            try {
                const raw = localStorage.getItem('vg_devpanel_varbind_' + this._playSlug);
                return raw ? JSON.parse(raw) : {};
            } catch { return {}; }
        }

        _saveVarBindings(bindings) {
            try { localStorage.setItem('vg_devpanel_varbind_' + this._playSlug, JSON.stringify(bindings)); } catch { /* noop */ }
        }

        // ── Clipboard ─────────────────────────────────────────────────────────

        async _copyToClipboard(text) {
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                    return true;
                }
                throw new Error('Clipboard API unavailable');
            } catch {
                try {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
                    document.body.appendChild(ta);
                    ta.focus();
                    ta.select();
                    const ok = document.execCommand('copy');
                    ta.remove();
                    return ok;
                } catch (e2) {
                    this._log('error', 'Clipboard: copy failed — ' + e2.message, 'Clipboard');
                    return false;
                }
            }
        }

        async copierPressePapier({ TEXTE }) {
            const text = String(TEXTE);
            const ok = await this._copyToClipboard(text);
            this._log(ok ? 'info' : 'warn', ok ? `Clipboard: copied ${text.length} character(s)` : 'Clipboard: copy failed', 'Clipboard');
        }

        // ── Permission gate ───────────────────────────────────────────────────

        async _checkPanelPermission(perm) {
            if (!this._playAccessToken) return false;
            try {
                const r = await _fetch(`${API_URL}/api/play/permissions?_ts=${Date.now()}`, {
                    headers: { 'Authorization': `Bearer ${this._playAccessToken}` },
                    cache: 'no-store'
                });
                if (!r.ok) return false;
                const d = await r.json();
                return !!(d.is_super_admin || (d.permissions || []).includes(perm));
            } catch (e) {
                this._log('error', 'Permissions: network error — ' + e.message, 'Permissions');
                return false;
            }
        }

        async ouvrirPanelDev() {
            const allowed = await this._checkPanelPermission('game_dev_panel');
            if (!allowed) {
                this._log('warn', 'Dev Panel: access denied' + (this._playPlayer ? ' (' + this._playPlayer.username + ')' : ' (not signed in)'), 'Dev Panel');
                return;
            }
            this._log('info', 'Dev Panel: opened by ' + (this._playPlayer ? this._playPlayer.username : '?'), 'Dev Panel');
            // Blocks script execution at this block until the panel is closed —
            // combined with the runtime pause, everything after this block only
            // runs once the developer closes the panel.
            return new Promise(resolve => this._showDevPanel(resolve));
        }

        async ouvrirPanelLogs() {
            const allowed = await this._checkPanelPermission('game_logs_panel');
            if (!allowed) {
                this._log('warn', 'Logs Panel: access denied' + (this._playPlayer ? ' (' + this._playPlayer.username + ')' : ' (not signed in)'), 'Logs Panel');
                return;
            }
            this._log('info', 'Logs Panel: opened by ' + (this._playPlayer ? this._playPlayer.username : '?'), 'Logs Panel');
            this._showLogsPanel();
        }

        // ── Shared chrome helpers ─────────────────────────────────────────────

        _panelIconBtn(label, title) {
            const b = document.createElement('button');
            b.textContent = label;
            b.title = title || '';
            b.style.cssText = 'background:#22232b;border:1px solid #34353f;color:#c7c8d1;font-size:11px;font-weight:600;padding:5px 10px;border-radius:5px;cursor:pointer;font-family:system-ui,sans-serif;white-space:nowrap';
            b.addEventListener('mouseenter', () => { b.style.background = '#2b2c36'; });
            b.addEventListener('mouseleave', () => { b.style.background = '#22232b'; });
            return b;
        }

        // ══════════════════════════════════════════
        //  DEV PANEL — landscape, multi-category editor
        // ══════════════════════════════════════════

        _pauseRuntimeForDevPanel() {
            if (this._devPanelPausedRuntime) return; // already paused by us
            try {
                if (typeof Scratch.vm.runtime.pause === 'function') {
                    Scratch.vm.runtime.pause();
                    this._devPanelPausedRuntime = true;
                    this._log('info', 'Dev Panel: game paused while the panel is open', 'Dev Panel');
                }
            } catch (e) {
                this._log('warn', 'Dev Panel: could not pause the game — ' + e.message, 'Dev Panel');
            }
        }

        _resumeRuntimeAfterDevPanel() {
            if (!this._devPanelPausedRuntime) return;
            try {
                if (typeof Scratch.vm.runtime.resume === 'function') {
                    Scratch.vm.runtime.resume();
                    this._log('info', 'Dev Panel: game resumed', 'Dev Panel');
                }
            } catch (e) {
                this._log('warn', 'Dev Panel: could not resume the game — ' + e.message, 'Dev Panel');
            } finally {
                this._devPanelPausedRuntime = false;
            }
        }

        _showDevPanel(onClose) {
            if (this._devPanel) {
                // Replacing an already-open panel: unstick any script waiting on it first.
                this._devPanel.remove();
                this._devPanel = null;
                const prevOnClose = this._devPanelOnClose;
                this._devPanelOnClose = null;
                if (prevOnClose) prevOnClose();
            }
            this._devPanelOnClose = onClose || null;
            this._pauseRuntimeForDevPanel();
            const accent = this._playAccent || '#4ECDC4';
            const categories = ['inventory', 'stats', 'craft', 'tech', 'others'];
            this._devCatState = {};
            for (const c of categories) this._devCatState[c] = { value: null, original: null, loaded: false };
            let activeCat = categories[0];
            const varBindings = this._loadVarBindings();
            const globalVars = this._getGlobalScalarVariables();

            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;z-index:999995;background:rgba(8,9,12,0.7);display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif';
            this._devPanel = overlay;

            const card = document.createElement('div');
            card.style.cssText = 'background:#1b1c22;border:1px solid #2f303a;border-radius:10px;width:900px;max-width:95vw;height:560px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 70px rgba(0,0,0,0.5);overflow:hidden';
            overlay.appendChild(card);

            // ── Title bar ──
            const titleBar = document.createElement('div');
            titleBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #2a2b34;flex-shrink:0';
            const titleLeft = document.createElement('div');
            titleLeft.style.cssText = 'display:flex;align-items:center;gap:10px';
            titleLeft.innerHTML = `<span style="font-size:14px">🛠</span><span style="font-size:14px;font-weight:700;color:#f2f2f5;letter-spacing:0.02em">Game Dev Panel</span><span style="font-size:10px;color:#6f7078;border:1px solid #34353f;border-radius:3px;padding:1px 6px">${this._escapeHtml(this._playSlug || 'unknown project')}</span>`;
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕';
            closeBtn.style.cssText = 'background:none;border:none;color:#8b8d97;font-size:16px;cursor:pointer;line-height:1;padding:2px 4px';
            closeBtn.addEventListener('click', () => {
                overlay.remove();
                this._devPanel = null;
                this._resumeRuntimeAfterDevPanel();
                const cb = this._devPanelOnClose;
                this._devPanelOnClose = null;
                if (cb) cb();
            });
            titleBar.appendChild(titleLeft);
            titleBar.appendChild(closeBtn);
            card.appendChild(titleBar);

            // ── Body: sidebar + editor (landscape) ──
            const body = document.createElement('div');
            body.style.cssText = 'flex:1;display:flex;min-height:0';
            card.appendChild(body);

            // Sidebar
            const sidebar = document.createElement('div');
            sidebar.style.cssText = 'width:210px;flex-shrink:0;border-right:1px solid #2a2b34;display:flex;flex-direction:column;background:#191a1f';
            body.appendChild(sidebar);

            const playerBlock = document.createElement('div');
            playerBlock.style.cssText = 'padding:14px;border-bottom:1px solid #2a2b34';
            const initials = (this._playPlayer && this._playPlayer.username ? this._playPlayer.username.slice(0, 2) : '??').toUpperCase();
            playerBlock.innerHTML =
                `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">` +
                `<div style="width:28px;height:28px;border-radius:50%;background:${accent}22;color:${accent};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${this._escapeHtml(initials)}</div>` +
                `<div style="min-width:0"><div style="font-size:12px;font-weight:700;color:#f2f2f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${this._escapeHtml(this._playPlayer ? this._playPlayer.username : 'Unknown')}</div>` +
                `<div style="font-size:10px;color:#5fd97f">● Connected</div></div></div>`;
            const copyIdBtn = this._panelIconBtn('Copy Player ID', 'Copy the current player ID to the clipboard');
            copyIdBtn.style.width = '100%';
            copyIdBtn.addEventListener('click', async () => {
                const id = this._playPlayer ? this._playPlayer.id : '';
                const ok = await this._copyToClipboard(String(id));
                copyIdBtn.textContent = ok ? 'Copied ✓' : 'Copy failed';
                setTimeout(() => { if (copyIdBtn.isConnected) copyIdBtn.textContent = 'Copy Player ID'; }, 1500);
            });
            playerBlock.appendChild(copyIdBtn);
            sidebar.appendChild(playerBlock);

            const navList = document.createElement('div');
            navList.style.cssText = 'flex:1;overflow-y:auto;padding:8px';
            sidebar.appendChild(navList);

            const navButtons = {};
            const renderNav = () => {
                let anyDirty = false;
                for (const cat of categories) {
                    const st = this._devCatState[cat];
                    const dirty = st.loaded && st.value !== st.original;
                    if (dirty) anyDirty = true;
                    const btn = navButtons[cat];
                    btn.style.background = cat === activeCat ? '#262832' : 'transparent';
                    btn.style.color = cat === activeCat ? '#f2f2f5' : '#a9aab3';
                    btn.querySelector('.vg-dot').style.background = dirty ? '#f39c12' : 'transparent';
                }
                saveAllBtn.disabled = !anyDirty;
                saveAllBtn.style.opacity = anyDirty ? '1' : '0.4';
                saveAllBtn.style.cursor = anyDirty ? 'pointer' : 'default';
            };

            for (const cat of categories) {
                const btn = document.createElement('button');
                btn.style.cssText = 'width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;background:transparent;border:none;color:#a9aab3;font-size:12px;font-weight:600;text-transform:capitalize;padding:8px 10px;border-radius:6px;cursor:pointer;margin-bottom:2px;font-family:system-ui,sans-serif';
                btn.innerHTML = `<span>${cat}</span><span class="vg-dot" style="width:6px;height:6px;border-radius:50%;flex-shrink:0"></span>`;
                btn.addEventListener('click', () => { activeCat = cat; renderEditor(); renderNav(); });
                navButtons[cat] = btn;
                navList.appendChild(btn);
            }

            const sidebarFooter = document.createElement('div');
            sidebarFooter.style.cssText = 'padding:10px;border-top:1px solid #2a2b34';
            const saveAllBtn = this._panelIconBtn('💾 Save All Categories', 'Save every category with unsaved changes');
            saveAllBtn.style.width = '100%';
            saveAllBtn.style.background = accent;
            saveAllBtn.style.color = '#0a0a0f';
            saveAllBtn.style.border = 'none';
            saveAllBtn.addEventListener('click', async () => {
                for (const cat of categories) {
                    const st = this._devCatState[cat];
                    if (st.loaded && st.value !== st.original) await saveCategory(cat);
                }
            });
            sidebarFooter.appendChild(saveAllBtn);
            sidebar.appendChild(sidebarFooter);

            // Editor (main area)
            const editor = document.createElement('div');
            editor.style.cssText = 'flex:1;display:flex;flex-direction:column;min-width:0';
            body.appendChild(editor);

            const editorHeader = document.createElement('div');
            editorHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #2a2b34;flex-shrink:0';
            const editorTitle = document.createElement('div');
            editorTitle.style.cssText = 'font-size:12px;font-weight:700;color:' + accent + ';text-transform:uppercase;letter-spacing:0.06em';
            const editorTools = document.createElement('div');
            editorTools.style.cssText = 'display:flex;gap:6px';
            const reloadBtn  = this._panelIconBtn('⟳ Reload', 'Discard local edits and re-fetch from the server');
            const formatBtn  = this._panelIconBtn('{ } Format', 'Pretty-print this JSON');
            const copyBtn    = this._panelIconBtn('⧉ Copy', 'Copy this category\'s JSON to the clipboard');
            const saveBtn    = this._panelIconBtn('Save', 'Save this category to the server');
            saveBtn.style.background = accent;
            saveBtn.style.color = '#0a0a0f';
            saveBtn.style.border = 'none';
            editorTools.appendChild(reloadBtn);
            editorTools.appendChild(formatBtn);
            editorTools.appendChild(copyBtn);
            editorTools.appendChild(saveBtn);
            editorHeader.appendChild(editorTitle);
            editorHeader.appendChild(editorTools);
            editor.appendChild(editorHeader);

            // ── Variable link row ──
            const linkRow = document.createElement('div');
            linkRow.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 16px;border-bottom:1px solid #2a2b34;flex-shrink:0;background:#191a1f';
            const linkLabel = document.createElement('span');
            linkLabel.textContent = 'Linked variable:';
            linkLabel.style.cssText = 'font-size:11px;color:#8b8d97;flex-shrink:0';
            const linkSelect = document.createElement('select');
            linkSelect.style.cssText = 'flex:1;background:#111218;border:1px solid #2f303a;border-radius:5px;color:#e7e7ea;font-size:11.5px;padding:4px 8px;outline:none;font-family:system-ui,sans-serif;max-width:320px';
            const rebuildLinkOptions = () => {
                const opts = [
                    '<option value="AUTO">Auto-match closest $ variable to "' + activeCat + '"</option>',
                    '<option value="NONE">Do not link a variable</option>',
                    ...globalVars.map(v => `<option value="${this._escapeHtml(v.id)}">${this._escapeHtml(v.name)}</option>`)
                ];
                linkSelect.innerHTML = opts.join('');
                let current = varBindings[activeCat];
                if (!current) {
                    // No saved preference yet — suggest the closest-matching $-tagged variable.
                    const suggestion = this._bestMatchingVariable(activeCat, globalVars);
                    current = suggestion ? suggestion.id : 'AUTO';
                }
                linkSelect.value = current;
            };
            linkSelect.addEventListener('change', () => {
                varBindings[activeCat] = linkSelect.value;
                this._saveVarBindings(varBindings);
            });
            linkRow.appendChild(linkLabel);
            linkRow.appendChild(linkSelect);
            editor.appendChild(linkRow);

            const textarea = document.createElement('textarea');
            textarea.spellcheck = false;
            textarea.style.cssText = 'flex:1;width:100%;box-sizing:border-box;background:#111218;border:none;color:#e7e7ea;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;padding:14px 16px;resize:none;outline:none';
            textarea.value = 'Loading…';
            editor.appendChild(textarea);

            const statusBar = document.createElement('div');
            statusBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:7px 16px;border-top:1px solid #2a2b34;font-size:11px;color:#8b8d97;flex-shrink:0';
            const validityEl = document.createElement('span');
            const metaEl = document.createElement('span');
            statusBar.appendChild(validityEl);
            statusBar.appendChild(metaEl);
            editor.appendChild(statusBar);

            const updateValidity = () => {
                const st = this._devCatState[activeCat];
                st.value = textarea.value;
                try {
                    JSON.parse(textarea.value || '{}');
                    validityEl.textContent = '✓ Valid JSON';
                    validityEl.style.color = '#5fd97f';
                } catch (e) {
                    validityEl.textContent = '✗ Invalid JSON — ' + e.message;
                    validityEl.style.color = '#e74c3c';
                }
                const dirty = st.loaded && st.value !== st.original;
                metaEl.textContent = textarea.value.length + ' chars' + (dirty ? ' · unsaved changes' : '');
                saveBtn.disabled = !dirty;
                saveBtn.style.opacity = dirty ? '1' : '0.4';
                saveBtn.style.cursor = dirty ? 'pointer' : 'default';
                renderNav();
            };
            textarea.addEventListener('input', updateValidity);

            const loadCategory = async (cat) => {
                const st = this._devCatState[cat];
                if (st.loaded) return;
                const data = await this.playCharger({ CATEGORIE: cat });
                st.value = data;
                st.original = data;
                st.loaded = true;
                if (cat === activeCat) renderEditor();
                renderNav();
            };

            const renderEditor = () => {
                editorTitle.textContent = activeCat;
                rebuildLinkOptions();
                const st = this._devCatState[activeCat];
                textarea.value = st.loaded ? st.value : 'Loading…';
                textarea.disabled = !st.loaded;
                if (!st.loaded) { loadCategory(activeCat); return; }
                updateValidity();
            };

            const saveCategory = async (cat) => {
                const st = this._devCatState[cat];
                try { JSON.parse(st.value || '{}'); }
                catch {
                    this._log('error', `Dev Panel: invalid JSON for category "${cat}", save aborted`, 'Dev Panel');
                    if (cat === activeCat) { validityEl.textContent = '✗ Invalid JSON — save aborted'; validityEl.style.color = '#e74c3c'; }
                    return;
                }
                if (cat === activeCat) { metaEl.textContent = 'Saving…'; metaEl.style.color = '#8b8d97'; }
                const success = await this.playSauvegarder({ CATEGORIE: cat, DONNEES: st.value });
                if (!success) {
                    this._log('error', `Dev Panel: save failed for category "${cat}" — the server rejected the request or the connection was lost`, 'Dev Panel');
                    if (cat === activeCat) {
                        metaEl.textContent = '✗ Save failed — see Logs Panel for details';
                        metaEl.style.color = '#e74c3c';
                    }
                    renderNav();
                    return;
                }
                st.original = st.value;
                this._devPanelDirty[cat] = true;

                const binding = varBindings[cat] || 'AUTO';
                let updatedLocally = false;
                let linkedVarName = null;
                if (binding === 'NONE') {
                    updatedLocally = false;
                } else if (binding === 'AUTO') {
                    updatedLocally = this._pushValueToLocalVariable(cat, st.value);
                    if (updatedLocally) linkedVarName = cat;
                } else {
                    updatedLocally = this._setVariableById(binding, st.value);
                    if (updatedLocally) {
                        const found = globalVars.find(v => v.id === binding);
                        linkedVarName = found ? found.name : binding;
                    }
                }

                this._log(
                    'info',
                    `Dev Panel: manual save "${cat}" by ${this._playPlayer ? this._playPlayer.username : '?'}` +
                    (updatedLocally ? ` — variable "${linkedVarName}" updated` : binding === 'NONE' ? ' — no variable linked' : ' — linked variable not found, server only'),
                    'Dev Panel'
                );
                if (cat === activeCat) {
                    updateValidity();
                    metaEl.style.color = '#8b8d97';
                    metaEl.textContent = (updatedLocally ? `Saved ✓ (server + "${linkedVarName}") · ` : 'Saved ✓ (server only) · ') + metaEl.textContent;
                }
                renderNav();
            };

            reloadBtn.addEventListener('click', async () => {
                this._devCatState[activeCat] = { value: null, original: null, loaded: false };
                renderEditor();
            });
            formatBtn.addEventListener('click', () => {
                try {
                    textarea.value = JSON.stringify(JSON.parse(textarea.value || '{}'), null, 2);
                    updateValidity();
                } catch { /* leave as-is if invalid */ }
            });
            copyBtn.addEventListener('click', async () => {
                const ok = await this._copyToClipboard(textarea.value);
                copyBtn.textContent = ok ? '✓ Copied' : 'Copy failed';
                setTimeout(() => { if (copyBtn.isConnected) copyBtn.textContent = '⧉ Copy'; }, 1200);
            });
            saveBtn.addEventListener('click', () => saveCategory(activeCat));

            renderNav();
            renderEditor();

            document.body.appendChild(overlay);
        }

        // ══════════════════════════════════════════
        //  LOGS PANEL — landscape, filterable, exportable
        // ══════════════════════════════════════════

        _logMatchesFilters(entry) {
            const f = this._logFilters;
            if (!f[entry.level]) return false;
            if (f.source !== 'All' && entry.source !== f.source) return false;
            if (f.search && !(entry.source + ' ' + entry.message).toLowerCase().includes(f.search.toLowerCase())) return false;
            return true;
        }

        _appendLogRow(entry) {
            if (!this._logsListEl) return;
            const color = entry.level === 'error' ? '#e74c3c' : entry.level === 'warn' ? '#f39c12' : '#8b8d97';
            const label = entry.level === 'error' ? 'ERROR' : entry.level === 'warn' ? 'WARN' : 'INFO';
            const row = document.createElement('div');
            row.style.cssText = 'display:grid;grid-template-columns:76px 56px 110px 1fr;gap:10px;padding:5px 10px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;border-bottom:1px solid rgba(255,255,255,0.045);align-items:start;line-height:1.4';
            row.innerHTML =
                `<span style="color:#5f6069;white-space:nowrap">${entry.ts.toLocaleTimeString()}</span>` +
                `<span style="color:${color};font-weight:700">${label}</span>` +
                `<span style="color:#7f96b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${this._escapeHtml(entry.source)}</span>` +
                `<span style="color:#e4e4e7;word-break:break-word">${this._escapeHtml(entry.message)}</span>`;
            this._logsListEl.appendChild(row);
            if (this._logsAutoStick) this._logsListEl.scrollTop = this._logsListEl.scrollHeight;
        }

        _renderLogsList() {
            if (!this._logsListEl) return;
            this._logsListEl.innerHTML = '';
            for (const entry of this._logEntries) {
                if (this._logMatchesFilters(entry)) this._appendLogRow(entry);
            }
        }

        _updateLogStats() {
            if (!this._logStatsEl) return;
            const c = this._logCounts;
            this._logStatsEl.innerHTML =
                `<span style="color:#8b8d97">${this._logEntries.length} total</span>` +
                `<span style="color:#8b8d97">·</span><span style="color:#8b8d97">${c.info} info</span>` +
                `<span style="color:#8b8d97">·</span><span style="color:#f39c12">${c.warn} warn</span>` +
                `<span style="color:#8b8d97">·</span><span style="color:#e74c3c">${c.error} error</span>`;
        }

        _logsAsText() {
            return this._logEntries
                .filter(e => this._logMatchesFilters(e))
                .map(e => `[${e.ts.toLocaleTimeString()}] [${e.level.toUpperCase()}] [${e.source}] ${e.message}`)
                .join('\n');
        }

        _showLogsPanel() {
            if (this._logsPanel) { this._logsPanel.remove(); this._logsPanel = null; this._logsListEl = null; }
            this._logFilters = { info: true, warn: true, error: true, source: 'All', search: '' };

            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;z-index:999994;background:rgba(8,9,12,0.7);display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif';
            this._logsPanel = overlay;

            const card = document.createElement('div');
            card.style.cssText = 'background:#1b1c22;border:1px solid #2f303a;border-radius:10px;width:960px;max-width:96vw;height:620px;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 24px 70px rgba(0,0,0,0.5);overflow:hidden';
            overlay.appendChild(card);

            // ── Title bar ──
            const titleBar = document.createElement('div');
            titleBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #2a2b34;flex-shrink:0';
            const titleLeft = document.createElement('div');
            titleLeft.style.cssText = 'display:flex;align-items:center;gap:10px';
            const statsEl = document.createElement('span');
            statsEl.style.cssText = 'font-size:11px;display:flex;gap:6px';
            this._logStatsEl = statsEl;
            titleLeft.innerHTML = '<span style="font-size:14px">📜</span><span style="font-size:14px;font-weight:700;color:#f2f2f5;letter-spacing:0.02em">Game Logs</span>';
            titleLeft.appendChild(statsEl);

            const titleActions = document.createElement('div');
            titleActions.style.cssText = 'display:flex;gap:6px;align-items:center';
            const copyAllBtn = this._panelIconBtn('⧉ Copy', 'Copy the currently visible log lines to the clipboard');
            const exportBtn  = this._panelIconBtn('⤓ Export .txt', 'Download the currently visible log lines as a text file');
            const clearBtn   = this._panelIconBtn('Clear', 'Clear the log history');
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕';
            closeBtn.style.cssText = 'background:none;border:none;color:#8b8d97;font-size:16px;cursor:pointer;line-height:1;padding:2px 4px';
            closeBtn.addEventListener('click', () => { overlay.remove(); this._logsPanel = null; this._logsListEl = null; this._logStatsEl = null; });

            copyAllBtn.addEventListener('click', async () => {
                const ok = await this._copyToClipboard(this._logsAsText());
                copyAllBtn.textContent = ok ? '✓ Copied' : 'Copy failed';
                setTimeout(() => { if (copyAllBtn.isConnected) copyAllBtn.textContent = '⧉ Copy'; }, 1200);
            });
            exportBtn.addEventListener('click', () => {
                const blob = new Blob([this._logsAsText()], { type: 'text/plain' });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement('a');
                a.href = url;
                a.download = 'vakargames-logs-' + Date.now() + '.txt';
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 2000);
            });
            clearBtn.addEventListener('click', () => {
                this._logEntries = [];
                this._logCounts  = { info: 0, warn: 0, error: 0 };
                this._renderLogsList();
                this._updateLogStats();
            });

            titleActions.appendChild(copyAllBtn);
            titleActions.appendChild(exportBtn);
            titleActions.appendChild(clearBtn);
            titleActions.appendChild(closeBtn);
            titleBar.appendChild(titleLeft);
            titleBar.appendChild(titleActions);
            card.appendChild(titleBar);

            // ── Toolbar: search + level filters + source filter ──
            const toolbar = document.createElement('div');
            toolbar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid #2a2b34;flex-shrink:0';

            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.placeholder = 'Search logs…';
            searchInput.style.cssText = 'flex:1;background:#111218;border:1px solid #2f303a;border-radius:6px;color:#e7e7ea;font-size:12px;padding:6px 10px;outline:none;font-family:system-ui,sans-serif';
            searchInput.addEventListener('input', () => {
                this._logFilters.search = searchInput.value;
                this._renderLogsList();
            });
            toolbar.appendChild(searchInput);

            const levelDefs = [['info', 'Info', '#8b8d97'], ['warn', 'Warning', '#f39c12'], ['error', 'Error', '#e74c3c']];
            const levelBtns = {};
            for (const [key, label, color] of levelDefs) {
                const b = document.createElement('button');
                b.textContent = label;
                b.style.cssText = `background:${color}22;border:1px solid ${color}55;color:${color};font-size:11px;font-weight:700;padding:5px 10px;border-radius:5px;cursor:pointer;font-family:system-ui,sans-serif`;
                b.addEventListener('click', () => {
                    this._logFilters[key] = !this._logFilters[key];
                    b.style.opacity = this._logFilters[key] ? '1' : '0.35';
                    this._renderLogsList();
                });
                levelBtns[key] = b;
                toolbar.appendChild(b);
            }

            const sourceSelect = document.createElement('select');
            sourceSelect.style.cssText = 'background:#111218;border:1px solid #2f303a;border-radius:6px;color:#e7e7ea;font-size:11px;padding:6px 8px;outline:none;font-family:system-ui,sans-serif';
            const refreshSources = () => {
                const sources = ['All', ...new Set(this._logEntries.map(e => e.source))].sort((a, b) => a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b));
                const current = sourceSelect.value || 'All';
                sourceSelect.innerHTML = sources.map(s => `<option value="${this._escapeHtml(s)}">${this._escapeHtml(s)}</option>`).join('');
                sourceSelect.value = sources.includes(current) ? current : 'All';
            };
            sourceSelect.addEventListener('change', () => {
                this._logFilters.source = sourceSelect.value;
                this._renderLogsList();
            });
            toolbar.appendChild(sourceSelect);
            card.appendChild(toolbar);

            // ── Column header ──
            const colHeader = document.createElement('div');
            colHeader.style.cssText = 'display:grid;grid-template-columns:76px 56px 110px 1fr;gap:10px;padding:6px 10px;font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#5f6069;border-bottom:1px solid #2a2b34;flex-shrink:0';
            colHeader.innerHTML = '<span>Time</span><span>Level</span><span>Source</span><span>Message</span>';
            card.appendChild(colHeader);

            // ── List ──
            const list = document.createElement('div');
            list.style.cssText = 'flex:1;overflow-y:auto';
            list.addEventListener('scroll', () => {
                this._logsAutoStick = (list.scrollTop + list.clientHeight >= list.scrollHeight - 24);
            });
            card.appendChild(list);
            this._logsListEl = list;

            refreshSources();
            this._renderLogsList();
            this._updateLogStats();

            document.body.appendChild(overlay);
        }
    }

    Scratch.extensions.register(new VakarGames());

})(Scratch);
