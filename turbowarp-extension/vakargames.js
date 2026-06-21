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
            return null; // pas de référence popup en sandbox
        }
        if (typeof window !== 'undefined' && window.open) {
            return window.open(url, 'stripe_checkout', 'width=520,height=720,scrollbars=yes,resizable=yes');
        }
        return null;
    }

    class VakarGames {
        constructor() {
            this._chatSlug     = '';
            this._chatApiKey   = '';
            this._chatMessages = [];
            this._prevCount    = 0;
            this._newMsg       = false;
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
                    { blockType: Scratch.BlockType.LABEL, text: '— Chat Global —' },
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

                ]
            };
        }

        // ══════════════════════════════════════════
        //  SHOP
        // ══════════════════════════════════════════
        async buyProduct({ URL: urlStr, UID }) {
            // 1 — Parser le lien produit
            let gameSlug, productId;
            try {
                const parsed = new URL(urlStr);
                const parts  = parsed.pathname.split('/').filter(Boolean);
                gameSlug  = parts[1];
                productId = parsed.searchParams.get('product');
            } catch { return false; }

            if (!gameSlug || !productId || !String(UID).trim()) return false;

            // 2 — Créer la session Stripe via le backend
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

            // 3 — Ouvrir Stripe (sandbox → Scratch.openWindow, unsandboxed → window.open)
            const popupRef = _openWindow(checkoutUrl);

            // 4 — Poller le statut toutes les 3 s
            return await new Promise((resolve) => {
                let elapsed  = 0;
                const maxMs  = 600000; // 10 min max
                const pollMs = 3000;

                const interval = setInterval(async () => {
                    elapsed += pollMs;

                    // En mode unsandboxed : détecter la fermeture du popup
                    if (popupRef && popupRef.closed) {
                        clearInterval(interval);
                        // Laisser 6 s au webhook pour arriver
                        await new Promise(r => setTimeout(r, 6000));
                        try {
                            const r = await _fetch(`${API_URL}/api/shop/session/${encodeURIComponent(sessionId)}/status`);
                            const d = await r.json();
                            resolve(d.status === 'complete');
                        } catch { resolve(false); }
                        return;
                    }

                    // Timeout global
                    if (elapsed >= maxMs) {
                        clearInterval(interval);
                        resolve(false);
                        return;
                    }

                    // Vérifier le statut de la session
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
                this._chatMessages = msgs; // oldest → newest en interne

                // Retourner newest-first avec position (1 = le plus récent)
                const output = [...msgs].reverse().map((msg, i) => ({
                    position: i + 1,
                    username: msg.username,
                    message:  msg.message,
                    level:    msg.level ?? 0,
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

        // INDEX 1-basé, 1 = message le plus récent
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
    }

    Scratch.extensions.register(new VakarGames());

})(Scratch);
