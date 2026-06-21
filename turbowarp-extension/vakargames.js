(function (Scratch) {
    'use strict';

    if (!Scratch.extensions.unsandboxed) {
        console.warn('[VakarGames] Reload with unsandboxed mode for full functionality.');
    }

    const API_URL = 'https://vakargames.com';

    class VakarGames {
        constructor() {
            // Chat
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
        //  SHOP — bloc rond, retourne true / false
        // ══════════════════════════════════════════
        async buyProduct({ URL: urlStr, UID }) {
            // Parse game slug + product ID depuis le lien
            let gameSlug, productId;
            try {
                const parsed = new URL(urlStr);
                const parts  = parsed.pathname.split('/').filter(Boolean);
                gameSlug  = parts[1];
                productId = parsed.searchParams.get('product');
            } catch { return false; }

            if (!gameSlug || !productId || !String(UID).trim()) return false;

            // Créer la session Stripe
            let sessionId, checkoutUrl;
            try {
                const res = await fetch(
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

            // Ouvrir Stripe dans un popup
            const popup = window.open(
                checkoutUrl,
                'stripe_checkout',
                'width=520,height=720,scrollbars=yes,resizable=yes'
            );
            if (!popup) return false;

            // Attendre le résultat : polling toutes les 3 s
            return await new Promise((resolve) => {
                let closedAt = null;

                const interval = setInterval(async () => {
                    if (popup.closed && closedAt === null) closedAt = Date.now();

                    // 6 s après fermeture sans succès → false
                    if (closedAt !== null && Date.now() - closedAt > 6000) {
                        clearInterval(interval);
                        resolve(false);
                        return;
                    }

                    // Vérifier le statut côté backend
                    try {
                        const r    = await fetch(`${API_URL}/api/shop/session/${encodeURIComponent(sessionId)}/status`);
                        const data = await r.json();
                        if (data.status === 'complete') {
                            clearInterval(interval);
                            if (!popup.closed) popup.close();
                            resolve(true);
                        }
                    } catch { /* continuer à poller */ }
                }, 3000);
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
                await fetch(`${API_URL}/api/projects/${encodeURIComponent(this._chatSlug)}/chat`, {
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

        // Bloc rond — fetch ET retourne JSON, met aussi à jour l'état interne
        async getMessages({ LIMIT }) {
            if (!this._chatSlug) return '[]';
            const limit = Math.min(100, Math.max(1, parseInt(LIMIT) || 50));
            try {
                const r    = await fetch(`${API_URL}/api/projects/${encodeURIComponent(this._chatSlug)}/chat?limit=${limit}`);
                const data = await r.json();
                const msgs = data.messages || [];
                this._newMsg       = msgs.length > this._prevCount ||
                    (msgs.length > 0 && this._chatMessages.length > 0 &&
                     msgs[msgs.length - 1]?.id !== this._chatMessages[this._chatMessages.length - 1]?.id);
                this._prevCount    = msgs.length;
                this._chatMessages = msgs;
                return JSON.stringify(msgs);
            } catch { return '[]'; }
        }

        newMessages() {
            const v = this._newMsg;
            this._newMsg = false; // auto-reset
            return v;
        }

        messageCount()             { return this._chatMessages.length; }
        messageText({ INDEX })     { return this._chatMessages[parseInt(INDEX)]?.message  ?? ''; }
        messageUsername({ INDEX }) { return this._chatMessages[parseInt(INDEX)]?.username ?? ''; }
        messageLevel({ INDEX })    { return this._chatMessages[parseInt(INDEX)]?.level    ?? 0;  }

        lastMessageText() {
            return this._chatMessages[this._chatMessages.length - 1]?.message  ?? '';
        }
        lastMessageUsername() {
            return this._chatMessages[this._chatMessages.length - 1]?.username ?? '';
        }
        lastMessageLevel() {
            return this._chatMessages[this._chatMessages.length - 1]?.level    ?? 0;
        }
    }

    Scratch.extensions.register(new VakarGames());

})(Scratch);
