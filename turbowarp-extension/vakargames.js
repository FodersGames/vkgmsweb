(function (Scratch) {
    'use strict';

    if (!Scratch.extensions.unsandboxed) {
        console.warn('[VakarGames] Running sandboxed — some blocks may not work. Reload with unsandboxed mode.');
    }

    const API_URL = 'https://vakargames.com';

    class VakarGames {
        constructor() {
            // Shop
            this._paymentStatus   = ''; // 'complete' | 'canceled' | 'error' | 'pending' | ''
            this._paymentSuccess  = false;
            // Chat
            this._chatSlug        = '';
            this._chatApiKey      = '';
            this._chatMessages    = [];
            this._prevMsgCount    = 0;
            this._newMessagesFlag = false;
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
                    {
                        blockType: Scratch.BlockType.LABEL,
                        text: '— Shop —'
                    },
                    {
                        opcode:    'openShopLink',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'open shop link [URL] player UID [UID]',
                        arguments: {
                            URL: { type: Scratch.ArgumentType.STRING, defaultValue: 'https://vakargames.com/shop/my-game?product=...' },
                            UID: { type: Scratch.ArgumentType.STRING, defaultValue: '' }
                        }
                    },
                    {
                        opcode:    'paymentSucceeded',
                        blockType: Scratch.BlockType.BOOLEAN,
                        text:      'last payment succeeded?'
                    },
                    {
                        opcode:    'paymentStatus',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'last payment status'
                    },

                    // ══════════════════════════════
                    //  CHAT GLOBAL
                    // ══════════════════════════════
                    {
                        blockType: Scratch.BlockType.LABEL,
                        text: '— Chat Global —'
                    },
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
                        opcode:    'fetchMessages',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'fetch last [LIMIT] messages',
                        arguments: {
                            LIMIT: { type: Scratch.ArgumentType.NUMBER, defaultValue: 50 }
                        }
                    },
                    {
                        opcode:    'newMessages',
                        blockType: Scratch.BlockType.BOOLEAN,
                        text:      'new messages received?'
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
                        arguments: {
                            INDEX: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 }
                        }
                    },
                    {
                        opcode:    'messageUsername',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'message [INDEX] username',
                        arguments: {
                            INDEX: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 }
                        }
                    },
                    {
                        opcode:    'messageLevel',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'message [INDEX] level',
                        arguments: {
                            INDEX: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 }
                        }
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

        async openShopLink({ URL: urlStr, UID }) {
            this._paymentStatus  = 'pending';
            this._paymentSuccess = false;

            // 1 — Parse game slug and product ID from the link
            let gameSlug, productId;
            try {
                const parsed  = new URL(urlStr);
                const parts   = parsed.pathname.split('/').filter(Boolean);
                gameSlug   = parts[1];          // /shop/<gameSlug>
                productId  = parsed.searchParams.get('product');
            } catch {
                this._paymentStatus = 'error';
                return;
            }

            if (!gameSlug || !productId || !UID) {
                this._paymentStatus = 'error';
                return;
            }

            // 2 — Create Stripe checkout session on the backend
            let sessionId, checkoutUrl;
            try {
                const res = await fetch(`${API_URL}/api/shop/${encodeURIComponent(gameSlug)}/checkout`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ product_id: productId, player_uid: UID })
                });
                if (!res.ok) { this._paymentStatus = 'error'; return; }
                const data  = await res.json();
                checkoutUrl = data.checkout_url;
                sessionId   = data.session_id;
            } catch {
                this._paymentStatus = 'error';
                return;
            }

            // 3 — Open Stripe in a popup window
            const popup = window.open(
                checkoutUrl,
                'stripe_checkout',
                'width=520,height=720,scrollbars=yes,resizable=yes'
            );
            if (!popup) { this._paymentStatus = 'error'; return; }

            // 4 — Poll backend every 3 s until payment complete or popup closed
            await new Promise((resolve) => {
                let closedAt = null;

                const interval = setInterval(async () => {
                    // Track when the popup closes
                    if (popup.closed && closedAt === null) closedAt = Date.now();

                    // 6 s after popup closes with no success → canceled
                    if (closedAt !== null && Date.now() - closedAt > 6000) {
                        clearInterval(interval);
                        if (this._paymentStatus !== 'complete') {
                            this._paymentStatus  = 'canceled';
                            this._paymentSuccess = false;
                        }
                        resolve();
                        return;
                    }

                    // Poll session status
                    try {
                        const r    = await fetch(`${API_URL}/api/shop/session/${encodeURIComponent(sessionId)}/status`);
                        const data = await r.json();
                        if (data.status === 'complete') {
                            clearInterval(interval);
                            this._paymentStatus  = 'complete';
                            this._paymentSuccess = true;
                            if (!popup.closed) popup.close();
                            resolve();
                        }
                    } catch { /* keep polling */ }
                }, 3000);
            });
        }

        paymentSucceeded() { return this._paymentSuccess;  }
        paymentStatus()    { return this._paymentStatus;   }

        // ══════════════════════════════════════════
        //  CHAT GLOBAL
        // ══════════════════════════════════════════

        setChatConfig({ SLUG, KEY }) {
            this._chatSlug   = SLUG;
            this._chatApiKey = KEY;
        }

        async sendMessage({ MSG, USERNAME, LEVEL }) {
            if (!this._chatSlug || !this._chatApiKey) return;
            try {
                await fetch(`${API_URL}/api/projects/${encodeURIComponent(this._chatSlug)}/chat`, {
                    method:  'POST',
                    headers: {
                        'Content-Type':  'application/json',
                        'X-Chat-Api-Key': this._chatApiKey
                    },
                    body: JSON.stringify({
                        username: String(USERNAME),
                        message:  String(MSG),
                        level:    parseInt(LEVEL) || null
                    })
                });
            } catch { /* ignore send errors */ }
        }

        async fetchMessages({ LIMIT }) {
            if (!this._chatSlug) return;
            const limit = Math.min(100, Math.max(1, parseInt(LIMIT) || 50));
            try {
                const r    = await fetch(`${API_URL}/api/projects/${encodeURIComponent(this._chatSlug)}/chat?limit=${limit}`);
                const data = await r.json();
                const msgs = data.messages || [];
                this._newMessagesFlag = msgs.length > this._prevMsgCount ||
                    (msgs.length > 0 && this._chatMessages.length > 0 &&
                     msgs[msgs.length - 1]?.id !== this._chatMessages[this._chatMessages.length - 1]?.id);
                this._prevMsgCount  = msgs.length;
                this._chatMessages  = msgs;
            } catch { this._newMessagesFlag = false; }
        }

        newMessages() {
            const flag = this._newMessagesFlag;
            this._newMessagesFlag = false; // auto-reset after reading
            return flag;
        }

        messageCount()          { return this._chatMessages.length; }

        messageText({ INDEX }) {
            return this._chatMessages[parseInt(INDEX)]?.message ?? '';
        }
        messageUsername({ INDEX }) {
            return this._chatMessages[parseInt(INDEX)]?.username ?? '';
        }
        messageLevel({ INDEX }) {
            return this._chatMessages[parseInt(INDEX)]?.level ?? 0;
        }

        lastMessageText() {
            const last = this._chatMessages[this._chatMessages.length - 1];
            return last?.message ?? '';
        }
        lastMessageUsername() {
            const last = this._chatMessages[this._chatMessages.length - 1];
            return last?.username ?? '';
        }
        lastMessageLevel() {
            const last = this._chatMessages[this._chatMessages.length - 1];
            return last?.level ?? 0;
        }
    }

    Scratch.extensions.register(new VakarGames());

})(Scratch);
