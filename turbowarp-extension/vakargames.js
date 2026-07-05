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
            this._logEntries  = [];   // { ts, level: 'info'|'warn'|'error', message }
            this._logsListEl  = null; // live-append target while the logs panel is open
            this._devPanel    = null;
            this._logsPanel   = null;

            // Auto-log any error assignment made anywhere in the extension,
            // without having to touch every call site individually.
            let _filesErrorVal = '';
            Object.defineProperty(this, '_filesError', {
                get: () => _filesErrorVal,
                set: (v) => { _filesErrorVal = v; if (v) this._log('error', '[Ressources] ' + v); },
            });
            let _soundsErrorVal = '';
            Object.defineProperty(this, '_soundsError', {
                get: () => _soundsErrorVal,
                set: (v) => { _soundsErrorVal = v; if (v) this._log('error', '[Sons] ' + v); },
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
                if (!res.ok) { this._log('warn', 'Shop : checkout refusé (produit ' + productId + ')'); return false; }
                const data  = await res.json();
                checkoutUrl = data.checkout_url;
                sessionId   = data.session_id;
                this._log('info', 'Shop : checkout ouvert pour le produit ' + productId);
            } catch (e) { this._log('error', 'Shop : erreur réseau au checkout — ' + e.message); return false; }

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
                            this._log(ok ? 'info' : 'warn', 'Shop : achat ' + (ok ? 'confirmé' : 'non confirmé après fermeture de la fenêtre'));
                            resolve(ok);
                        } catch (e) { this._log('error', 'Shop : erreur de vérification du paiement — ' + e.message); resolve(false); }
                        return;
                    }

                    if (elapsed >= maxMs) {
                        clearInterval(interval);
                        this._log('warn', 'Shop : délai d\'attente du paiement dépassé');
                        resolve(false);
                        return;
                    }

                    try {
                        const r = await _fetch(`${API_URL}/api/shop/session/${encodeURIComponent(sessionId)}/status`);
                        const d = await r.json();
                        if (d.status === 'complete') {
                            clearInterval(interval);
                            if (popupRef && !popupRef.closed) popupRef.close();
                            this._log('info', 'Shop : achat confirmé');
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
                this._log('info', 'Chat : message envoyé par ' + USERNAME);
            } catch (e) { this._log('error', 'Chat : échec envoi message — ' + e.message); }
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
                    this._soundsReady  = false;
                }
                this._log('info', 'Ressources : version en ligne = ' + v);
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
                this._soundsReady  = false;
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
                const images = files.filter(f => fileExt(f.original_filename) !== null);
                let loaded = 0;
                for (const f of images) {
                    try {
                        await this._addCostumeToTarget(target, f);
                        loaded++;
                    } catch (e) {
                        console.warn('[VG] Impossible de charger ' + f.name + ' : ' + e.message);
                        this._log('error', 'Ressources : échec chargement "' + f.name + '" — ' + e.message);
                    }
                }
                this._filesReady = true;
                this._log('info', `Ressources : ${loaded}/${images.length} costumes chargés dans "${SPRITE}"`);
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
                let loaded = 0;
                for (const f of group) {
                    if (fileExt(f.original_filename) === null) continue;
                    try { await this._addCostumeToTarget(target, f); loaded++; }
                    catch (e) {
                        console.warn('[VG] Text engine: ' + f.name + ' → ' + e.message);
                        this._log('error', 'Text engine : échec "' + f.name + '" — ' + e.message);
                    }
                }
                this._filesReady = true;
                this._log('info', `Text engine : groupe "${gid}" — ${loaded} fichier(s) chargé(s)`);
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
                this._soundsError = 'Configurez les ressources d\'abord.';
                return;
            }
            const target = this._findTarget(SPRITE);
            if (!target) {
                this._soundsError = 'Sprite "' + SPRITE + '" introuvable.';
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
                        console.warn('[VG] Impossible de charger le son ' + f.name + ' : ' + e.message);
                        this._log('error', 'Sons : échec chargement "' + f.name + '" — ' + e.message);
                    }
                }
                this._soundsReady = true;
                this._log('info', `Sons : ${loaded}/${sounds.length} sons chargés dans "${SPRITE}"`);
            } catch (e) {
                this._soundsError = e.message;
            }
        }

        soundsReady() { return this._soundsReady; }
        soundsError() { return this._soundsError; }

        async loadSoundById({ ID, SPRITE }) {
            const target = this._findTarget(SPRITE);
            if (!target) { this._soundsError = 'Sprite "' + SPRITE + '" introuvable.'; return; }

            let f = this._fileIndex[String(ID)];
            if (!f) {
                try { await this._fetchFileList(); } catch (e) { this._soundsError = e.message; return; }
                f = this._fileIndex[String(ID)];
            }
            if (!f) { this._soundsError = 'Fichier ID "' + ID + '" introuvable dans la version "' + this._filesVersion + '".'; return; }
            if (audioExt(f.original_filename) === null) { this._soundsError = '"' + f.name + '" n\'est pas un son (MP3/WAV/OGG).'; return; }

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
                    this._log('warn', 'Session : reprise refusée, déconnecté');
                    return;
                }
                const d = await r.json();
                this._playAccessToken = d.access_token;
                this._playPlayer      = d.player;
                this._log('info', 'Session restaurée : ' + (d.player && d.player.username));
            } catch (e) { this._log('warn', 'Session : réseau indisponible, reste déconnecté — ' + e.message); }
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
            if (!this._playAccessToken) return;
            const cat  = String(CATEGORIE);
            const data = String(DONNEES);
            if (this._playSaveCache[cat] === data) return; // rien changé → skip
            try {
                const r = await _fetch(`${API_URL}/api/play/save`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this._playAccessToken}` },
                    body:    JSON.stringify({ category: cat, data: data, project_slug: this._playSlug })
                });
                if (r.ok) {
                    this._playSaveCache[cat] = data; // cache mis à jour uniquement si succès
                    this._log('info', 'Sauvegarde effectuée : catégorie "' + cat + '"');
                } else {
                    this._log('warn', 'Sauvegarde refusée : catégorie "' + cat + '" (HTTP ' + r.status + ')');
                }
            } catch (e) { this._log('error', 'Sauvegarde : erreur réseau — ' + e.message); }
        }

        async playCharger({ CATEGORIE }) {
            if (!this._playAccessToken) return '{}';
            try {
                const r = await _fetch(
                    `${API_URL}/api/play/load?category=${encodeURIComponent(CATEGORIE)}&project_slug=${encodeURIComponent(this._playSlug)}`,
                    { headers: { 'Authorization': `Bearer ${this._playAccessToken}` } }
                );
                if (!r.ok) { this._log('warn', 'Chargement refusé : catégorie "' + CATEGORIE + '" (HTTP ' + r.status + ')'); return '{}'; }
                const d = await r.json();
                this._log('info', 'Chargement effectué : catégorie "' + CATEGORIE + '"');
                return d.data || '{}';
            } catch (e) { this._log('error', 'Chargement : erreur réseau — ' + e.message); return '{}'; }
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
                        this._log('warn', 'Connexion échouée : ' + (d.detail || LANGS[lang].eLo));
                        return;
                    }
                    localStorage.setItem(this._playStorageKey(), d.refresh_token);
                    this._playAccessToken = d.access_token;
                    this._playPlayer      = d.player;
                    this._log('info', 'Connexion réussie : ' + (d.player && d.player.username));
                    this._closePlayPopup();
                    if (onClose) onClose();
                } catch (err) {
                    errEl.textContent = LANGS[lang].eNe + ' (' + (err && err.message ? err.message : '?') + ')';
                    setLoading(loginBtn, false);
                    this._log('error', 'Connexion : erreur réseau — ' + (err && err.message));
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
                        this._log('warn', 'Inscription échouée : ' + (d.detail || LANGS[lang].eRe));
                        return;
                    }
                    localStorage.setItem(this._playStorageKey(), d.refresh_token);
                    this._playAccessToken = d.access_token;
                    this._playPlayer      = d.player;
                    this._log('info', 'Compte créé et connecté : ' + (d.player && d.player.username));
                    this._closePlayPopup();
                    if (onClose) onClose();
                } catch (err) {
                    errEl.textContent = LANGS[lang].eNe + ' (' + (err && err.message ? err.message : '?') + ')';
                    setLoading(regBtn, false);
                    this._log('error', 'Inscription : erreur réseau — ' + (err && err.message));
                }
            });

            document.body.appendChild(overlay);
        }

        _closePlayPopup() {
            if (this._playPopup) { this._playPopup.remove(); this._playPopup = null; }
        }

        // ══════════════════════════════════════════
        //  OUTILS DEV IN-GAME — journal + panels
        // ══════════════════════════════════════════

        _log(level, message) {
            const entry = { ts: new Date(), level, message: String(message) };
            this._logEntries.push(entry);
            if (this._logEntries.length > 500) this._logEntries.shift();
            if (this._logsListEl) this._appendLogRow(entry);
        }

        _escapeHtml(str) {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }

        _appendLogRow(entry) {
            if (!this._logsListEl) return;
            const color = entry.level === 'error' ? '#e74c3c' : entry.level === 'warn' ? '#f39c12' : '#9aa0a6';
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;gap:8px;padding:4px 2px;font-family:monospace;font-size:11.5px;border-bottom:1px solid rgba(255,255,255,0.06);align-items:flex-start;line-height:1.4';
            row.innerHTML =
                `<span style="color:${color};font-weight:700;flex-shrink:0">●</span>` +
                `<span style="color:#777;flex-shrink:0;white-space:nowrap">${entry.ts.toLocaleTimeString()}</span>` +
                `<span style="color:#e4e4e7;word-break:break-word">${this._escapeHtml(entry.message)}</span>`;
            this._logsListEl.appendChild(row);
            this._logsListEl.scrollTop = this._logsListEl.scrollHeight;
        }

        ecrireLog({ MESSAGE, GRAVITE }) {
            const g = String(GRAVITE).trim().toLowerCase();
            const level = g === 'erreur' ? 'error' : g === 'attention' ? 'warn' : 'info';
            this._log(level, String(MESSAGE));
        }

        async _checkPanelPermission(perm) {
            if (!this._playAccessToken) return false;
            try {
                const r = await _fetch(`${API_URL}/api/play/permissions`, {
                    headers: { 'Authorization': `Bearer ${this._playAccessToken}` }
                });
                if (!r.ok) return false;
                const d = await r.json();
                return !!(d.is_super_admin || (d.permissions || []).includes(perm));
            } catch (e) {
                this._log('error', 'Vérification des permissions : erreur réseau — ' + e.message);
                return false;
            }
        }

        async ouvrirPanelDev() {
            const allowed = await this._checkPanelPermission('game_dev_panel');
            if (!allowed) {
                this._log('warn', 'Panel développeur : accès refusé' + (this._playPlayer ? ' (' + this._playPlayer.username + ')' : ' (non connecté)'));
                return;
            }
            this._log('info', 'Panel développeur ouvert par ' + (this._playPlayer ? this._playPlayer.username : '?'));
            this._showDevPanel();
        }

        async ouvrirPanelLogs() {
            const allowed = await this._checkPanelPermission('game_logs_panel');
            if (!allowed) {
                this._log('warn', 'Panel logs : accès refusé' + (this._playPlayer ? ' (' + this._playPlayer.username + ')' : ' (non connecté)'));
                return;
            }
            this._log('info', 'Panel logs ouvert par ' + (this._playPlayer ? this._playPlayer.username : '?'));
            this._showLogsPanel();
        }

        _showDevPanel() {
            if (this._devPanel) { this._devPanel.remove(); this._devPanel = null; }
            const accent = this._playAccent || '#4ECDC4';
            const categories = ['inventory', 'stats', 'craft', 'tech', 'others'];

            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;z-index:999995;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif';
            this._devPanel = overlay;

            const card = document.createElement('div');
            card.style.cssText = 'background:#1c1c24;border:1px solid #33334a;border-radius:12px;padding:20px;width:520px;max-width:92vw;max-height:86vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.4)';
            overlay.appendChild(card);

            const header = document.createElement('div');
            header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px';
            header.innerHTML = '<div style="font-size:15px;font-weight:700;color:#fff">🛠 Game Dev Panel</div>';
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕';
            closeBtn.style.cssText = 'background:none;border:none;color:#999;font-size:16px;cursor:pointer;line-height:1';
            closeBtn.addEventListener('click', () => { overlay.remove(); this._devPanel = null; });
            header.appendChild(closeBtn);
            card.appendChild(header);

            const sub = document.createElement('div');
            sub.style.cssText = 'font-size:11px;color:#888;margin-bottom:16px';
            sub.textContent = 'Connecté : ' + (this._playPlayer ? this._playPlayer.username : '?') + ' · projet : ' + this._playSlug;
            card.appendChild(sub);

            for (const cat of categories) {
                const block = document.createElement('div');
                block.style.cssText = 'margin-bottom:14px';

                const label = document.createElement('div');
                label.style.cssText = `font-size:11px;font-weight:700;color:${accent};margin-bottom:5px;text-transform:uppercase;letter-spacing:0.05em`;
                label.textContent = cat;
                block.appendChild(label);

                const textarea = document.createElement('textarea');
                textarea.spellcheck = false;
                textarea.style.cssText = 'width:100%;box-sizing:border-box;min-height:64px;background:#111118;border:1px solid #33334a;border-radius:6px;color:#eee;font-family:monospace;font-size:12px;padding:8px;resize:vertical';
                textarea.value = 'Chargement…';
                block.appendChild(textarea);

                const row = document.createElement('div');
                row.style.cssText = 'display:flex;gap:8px;margin-top:6px;align-items:center';
                const saveBtn = document.createElement('button');
                saveBtn.textContent = 'Enregistrer';
                saveBtn.style.cssText = `padding:6px 12px;background:${accent};color:#0a0a0f;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer`;
                const statusEl = document.createElement('span');
                statusEl.style.cssText = 'font-size:11px;color:#888';
                row.appendChild(saveBtn);
                row.appendChild(statusEl);
                block.appendChild(row);

                card.appendChild(block);

                this.playCharger({ CATEGORIE: cat }).then(data => { textarea.value = data; });

                saveBtn.addEventListener('click', async () => {
                    try {
                        JSON.parse(textarea.value);
                    } catch {
                        statusEl.textContent = 'JSON invalide';
                        statusEl.style.color = '#e74c3c';
                        this._log('error', `Panel dev : JSON invalide pour la catégorie "${cat}"`);
                        return;
                    }
                    statusEl.textContent = 'Enregistrement…';
                    statusEl.style.color = '#888';
                    await this.playSauvegarder({ CATEGORIE: cat, DONNEES: textarea.value });
                    statusEl.textContent = 'Enregistré ✓';
                    statusEl.style.color = '#2ecc71';
                    this._log('info', `Panel dev : sauvegarde manuelle "${cat}" par ${this._playPlayer ? this._playPlayer.username : '?'}`);
                    setTimeout(() => { if (statusEl.isConnected) statusEl.textContent = ''; }, 2000);
                });
            }

            document.body.appendChild(overlay);
        }

        _showLogsPanel() {
            if (this._logsPanel) { this._logsPanel.remove(); this._logsPanel = null; this._logsListEl = null; }

            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;z-index:999994;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif';
            this._logsPanel = overlay;

            const card = document.createElement('div');
            card.style.cssText = 'background:#111118;border:1px solid #2a2a3c;border-radius:12px;padding:16px;width:640px;max-width:94vw;height:70vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.4)';
            overlay.appendChild(card);

            const header = document.createElement('div');
            header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-shrink:0';
            header.innerHTML = '<div style="font-size:15px;font-weight:700;color:#fff">📜 Game Logs</div>';

            const btnGroup = document.createElement('div');
            btnGroup.style.cssText = 'display:flex;gap:10px;align-items:center';

            const clearBtn = document.createElement('button');
            clearBtn.textContent = 'Vider';
            clearBtn.style.cssText = 'background:none;border:1px solid #33334a;color:#999;font-size:11px;padding:4px 10px;border-radius:6px;cursor:pointer';
            clearBtn.addEventListener('click', () => {
                this._logEntries = [];
                if (this._logsListEl) this._logsListEl.innerHTML = '';
            });

            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕';
            closeBtn.style.cssText = 'background:none;border:none;color:#999;font-size:16px;cursor:pointer;line-height:1';
            closeBtn.addEventListener('click', () => { overlay.remove(); this._logsPanel = null; this._logsListEl = null; });

            btnGroup.appendChild(clearBtn);
            btnGroup.appendChild(closeBtn);
            header.appendChild(btnGroup);
            card.appendChild(header);

            const list = document.createElement('div');
            list.style.cssText = 'flex:1;overflow-y:auto;border-top:1px solid #2a2a3c;padding-top:6px';
            card.appendChild(list);
            this._logsListEl = list;

            for (const entry of this._logEntries) this._appendLogRow(entry);

            document.body.appendChild(overlay);
        }
    }

    Scratch.extensions.register(new VakarGames());

})(Scratch);
