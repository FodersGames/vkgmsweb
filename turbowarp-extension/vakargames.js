// ===========================================================
//  Vakar Games — TurboWarp Extension
//  Toutes les fonctionnalités Vakar Games dans un seul fichier
// ===========================================================

(function (Scratch) {
    'use strict';

    if (!Scratch.extensions.unsandboxed) {
        throw new Error('Vakar Games extension must run unsandboxed.');
    }

    const API_URL = 'https://vakargames.com';

    class VakarGames {
        constructor() {
            // Config
            this._slug       = '';
            this._uid        = '';
            // Serveur
            this._serverStatus = '';
            // Dernier gift réclamé
            this._giftFound    = false;
            this._giftVariable = '';
            this._giftAmount   = '';
        }

        getInfo() {
            return {
                id:     'vakargames',
                name:   'Vakar Games',
                color1: '#4ECDC4',
                color2: '#2CB5AC',
                color3: '#1aada6',
                blocks: [

                    // ── Configuration ──────────────────────────────────
                    {
                        opcode:    'setSlug',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'set game project [SLUG]',
                        arguments: {
                            SLUG: { type: Scratch.ArgumentType.STRING, defaultValue: 'my-game' }
                        }
                    },
                    {
                        opcode:    'setUID',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'set player UID [UID]',
                        arguments: {
                            UID: { type: Scratch.ArgumentType.STRING, defaultValue: '' }
                        }
                    },
                    {
                        opcode:    'getSlug',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'current project slug',
                    },
                    {
                        opcode:    'getUID',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'current player UID',
                    },

                    // ── Serveur ────────────────────────────────────────
                    { blockType: Scratch.BlockType.LABEL, text: '— Serveur —' },
                    {
                        opcode:    'fetchServerStatus',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'fetch server status',
                    },
                    {
                        opcode:    'serverStatus',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'server status',
                    },
                    {
                        opcode:    'isServerOpen',
                        blockType: Scratch.BlockType.BOOLEAN,
                        text:      'server is open?',
                    },
                    {
                        opcode:    'isServerMaintenance',
                        blockType: Scratch.BlockType.BOOLEAN,
                        text:      'server is in maintenance?',
                    },

                    // ── Items / Gifts ──────────────────────────────────
                    { blockType: Scratch.BlockType.LABEL, text: '— Items —' },
                    {
                        opcode:    'claimGift',
                        blockType: Scratch.BlockType.COMMAND,
                        text:      'claim next gift for UID [UID]',
                        arguments: {
                            UID: { type: Scratch.ArgumentType.STRING, defaultValue: '' }
                        }
                    },
                    {
                        opcode:    'giftFound',
                        blockType: Scratch.BlockType.BOOLEAN,
                        text:      'gift was found?',
                    },
                    {
                        opcode:    'lastGiftVariable',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'last gift variable',
                    },
                    {
                        opcode:    'lastGiftAmount',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'last gift amount',
                    },

                    // ── Variables ──────────────────────────────────────
                    { blockType: Scratch.BlockType.LABEL, text: '— Variables —' },
                    {
                        opcode:    'getVariableValue',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'variable [NAME] value [INDEX]',
                        arguments: {
                            NAME:  { type: Scratch.ArgumentType.STRING, defaultValue: 'coins' },
                            INDEX: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 }
                        }
                    },
                    {
                        opcode:    'getVariableCount',
                        blockType: Scratch.BlockType.REPORTER,
                        text:      'variable [NAME] count',
                        arguments: {
                            NAME: { type: Scratch.ArgumentType.STRING, defaultValue: 'coins' }
                        }
                    },

                ]
            };
        }

        // ── Configuration ────────────────────────────────────────────
        setSlug({ SLUG }) { this._slug = SLUG; }
        setUID({ UID })   { this._uid  = UID;  }
        getSlug()         { return this._slug;  }
        getUID()          { return this._uid;   }

        // ── Serveur ──────────────────────────────────────────────────
        async fetchServerStatus() {
            try {
                const r    = await fetch(`${API_URL}/api/projects/${encodeURIComponent(this._slug)}/status`);
                const data = await r.json();
                this._serverStatus = data.status || 'unknown';
            } catch {
                this._serverStatus = 'error';
            }
        }

        serverStatus()        { return this._serverStatus; }
        isServerOpen()        { return this._serverStatus === 'open'; }
        isServerMaintenance() { return this._serverStatus === 'maintenance'; }

        // ── Items / Gifts ────────────────────────────────────────────
        async claimGift({ UID }) {
            const uid = (UID && UID.trim()) ? UID.trim() : this._uid;
            if (!uid) { this._giftFound = false; return; }
            try {
                const r    = await fetch(`${API_URL}/api/projects/${encodeURIComponent(this._slug)}/claimgift/${encodeURIComponent(uid)}`);
                const data = await r.json();
                if (data.length === 0) {
                    this._giftFound    = false;
                    this._giftVariable = '';
                    this._giftAmount   = '';
                } else {
                    this._giftFound    = true;
                    this._giftVariable = data.variable || '';
                    this._giftAmount   = data.amount   || '';
                }
            } catch {
                this._giftFound = false;
            }
        }

        giftFound()       { return this._giftFound;    }
        lastGiftVariable(){ return this._giftVariable; }
        lastGiftAmount()  { return this._giftAmount;   }

        // ── Variables ────────────────────────────────────────────────
        async getVariableValue({ NAME, INDEX }) {
            try {
                const r    = await fetch(`${API_URL}/api/projects/${encodeURIComponent(this._slug)}/variable/${encodeURIComponent(NAME)}`);
                const data = await r.json();
                return data[`value_${INDEX}`] ?? '';
            } catch { return ''; }
        }

        async getVariableCount({ NAME }) {
            try {
                const r    = await fetch(`${API_URL}/api/projects/${encodeURIComponent(this._slug)}/variable/${encodeURIComponent(NAME)}`);
                const data = await r.json();
                return data.count ?? 0;
            } catch { return 0; }
        }
    }

    Scratch.extensions.register(new VakarGames());

})(Scratch);
