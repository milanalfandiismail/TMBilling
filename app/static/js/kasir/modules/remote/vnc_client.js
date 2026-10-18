/**
 * VNC Client - UI Modal Dialog & Toolbar Orchestrator
 */
const VNCClient = {
    rfb: null,
    scaleFactor: true,
    RFBClass: null,
    session: null,
    keyboardLayout: 'letters',
    shiftActive: false,
    remoteResolution: { width: 0, height: 0 },
    lastReceivedClipboard: '',

    async getRFB() {
        if (this.RFBClass) return this.RFBClass;
        if (window.RFB) {
            this.RFBClass = window.RFB;
            return this.RFBClass;
        }
        try {
            const mod = await import('/static/vendor/novnc/core/rfb.js');
            this.RFBClass = mod.default;
            window.RFB = mod.default;
            return this.RFBClass;
        } catch (err) {
            console.error('Gagal memuat modul noVNC RFB:', err);
            return null;
        }
    },

    // Dynamic Multi-Instance Session Factory
    createSession(options) {
        return new VNCSession(options);
    },

    resolveWebSocketUrl(token, defaultPort = 8081) {
        // Cek apakah sedang memilih cabang remote
        const activeBranchId = sessionStorage.getItem('active_branch_id');
        if (activeBranchId && activeBranchId !== '0' && typeof BranchManager !== 'undefined' && BranchManager.branches) {
            const branch = BranchManager.branches.find(b => String(b.id) === String(activeBranchId));
            if (branch && branch.url) {
                try {
                    const u = new URL(branch.url);
                    if (u.protocol === 'https:') {
                        return `wss://${u.host}/ws/vnc?token=${encodeURIComponent(token)}`;
                    } else {
                        const port = u.port || defaultPort;
                        return `ws://${u.hostname}:${port}/?token=${encodeURIComponent(token)}`;
                    }
                } catch (e) {
                    console.warn('[VNC] Gagal parse URL remote branch:', e);
                }
            }
        }

        // Default: Host lokal saat ini
        if (window.location.protocol === 'https:') {
            return `wss://${window.location.host}/ws/vnc?token=${encodeURIComponent(token)}`;
        } else {
            return `ws://${window.location.hostname}:${defaultPort}/?token=${encodeURIComponent(token)}`;
        }
    },

    // Backward compatibility for singleton Server Remote tab
    async connect() {
        const screen = document.getElementById('vnc-screen');
        const container = document.getElementById('vnc-container');
        const placeholder = document.getElementById('vnc-placeholder');
        const badge = document.getElementById('vnc-status-badge');
        const connectBtn = document.getElementById('vnc-connect-btn');
        const disconnectBtn = document.getElementById('vnc-disconnect-btn');
        const pwdInput = document.getElementById('vnc-password-input');

        if (!screen) return;

        badge.textContent = 'Memuat Modul VNC...';
        badge.className = 'px-2 py-1 md:px-3 md:py-1.5 rounded text-[10px] md:text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30';

        const RFBClass = await this.getRFB();
        if (!RFBClass) {
            badge.textContent = 'Gagal Load Module';
            badge.className = 'px-2 py-1 md:px-3 md:py-1.5 rounded text-[10px] md:text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30';
            Toast.error('Gagal memuat modul noVNC.');
            return;
        }

        badge.textContent = 'Menyiapkan Websockify...';

        let listenPort = 8081;
        let serverVncPassword = '';
        let startRes = null;
        try {
            startRes = await API.request('/api/v1/kasir/vnc/start', { method: 'POST' });
            if (startRes) {
                if (startRes.listen_port) listenPort = startRes.listen_port;
                if (startRes.vnc_password) serverVncPassword = startRes.vnc_password;
            }
        } catch (err) {
            badge.textContent = 'Gagal Start Service';
            badge.className = 'px-2 py-1 md:px-3 md:py-1.5 rounded text-[10px] md:text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30';
            Toast.error('Gagal memulai service VNC: ' + err.message);
            return;
        }

        const token = (startRes && startRes.token) || 'server';
        const url = this.resolveWebSocketUrl(token, listenPort);

        const vncPassword = (pwdInput && pwdInput.value) ? pwdInput.value : serverVncPassword;
        badge.textContent = 'Menghubungkan...';

        // Disconnect sesi lama jika ada sebelum membuka koneksi baru (anti orphan socket/session leak)
        if (this.session) {
            try {
                this.session.disconnect();
            } catch (e) {
                console.warn('[VNCClient] Error disconnecting previous session:', e);
            }
            this.session = null;
            this.rfb = null;
        }

        this.session = new VNCSession({
            screenContainer: screen,
            vncContainer: container,
            wsUrl: url,
            password: vncPassword,
            scaleViewport: this.scaleFactor,
            onConnect: () => {
                this.rfb = this.session.rfb;
                badge.textContent = 'Terhubung';
                badge.className = 'px-2 py-1 md:px-3 md:py-1.5 rounded text-[10px] md:text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
                if (placeholder) placeholder.classList.add('hidden');
                if (connectBtn) connectBtn.classList.add('hidden');
                if (disconnectBtn) disconnectBtn.classList.remove('hidden');
                Toast.success('Koneksi VNC Server Terhubung');
            },
            onDisconnect: (e) => {
                badge.textContent = 'Terputus';
                badge.className = 'px-2 py-1 md:px-3 md:py-1.5 rounded text-[10px] md:text-xs font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700';
                if (placeholder) placeholder.classList.remove('hidden');
                if (connectBtn) connectBtn.classList.remove('hidden');
                if (disconnectBtn) disconnectBtn.classList.add('hidden');

                const resBadge = document.getElementById('vnc-resolution-badge');
                if (resBadge) resBadge.classList.add('hidden');

                const kb = document.getElementById('vnc-virtual-keyboard');
                if (kb) kb.classList.add('hidden');
                const optPanel = document.getElementById('vnc-options-panel');
                if (optPanel) optPanel.classList.add('hidden');

                if (e.detail && e.detail.clean) {
                    Toast.info('Koneksi VNC ditutup');
                } else {
                    Toast.error('Koneksi VNC terputus (Cek apakah TightVNC Server aktif di 127.0.0.1:5900)');
                }
                this.session = null;
                this.rfb = null;
            },
            onError: (err) => {
                badge.textContent = 'Gagal Koneksi';
                badge.className = 'px-2 py-1 md:px-3 md:py-1.5 rounded text-[10px] md:text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30';
                Toast.error('Gagal VNC: ' + err.message);
                this.session = null;
                this.rfb = null;
            },
            onResolution: (w, h) => {
                this.remoteResolution = { width: w, height: h };
                const resBadge = document.getElementById('vnc-resolution-badge');
                if (resBadge) {
                    const modeText = this.scaleFactor ? 'FIT' : '1:1';
                    resBadge.textContent = `${w} × ${h} (${modeText})`;
                    resBadge.classList.remove('hidden');
                }
            },
            onClipboard: (text) => {
                this.lastReceivedClipboard = text;
                const recInput = document.getElementById('vnc-clipboard-received-text');
                if (recInput) recInput.value = text;
                const badge = document.getElementById('vnc-clipboard-status-badge');
                if (badge && text) {
                    badge.textContent = 'Tersinkronisasi';
                    badge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
                    setTimeout(() => {
                        badge.textContent = 'Tersinkronisasi';
                        badge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-400 border border-neutral-700';
                    }, 3000);
                }
                if (text && text.trim()) {
                    Toast.info('📋 Teks disalin dari Remote VNC');
                }
            }
        });

        await this.session.connect();
    },

    disconnect() {
        if (this.session) {
            this.session.disconnect();
            this.session = null;
            this.rfb = null;
        }
    },

    toggleScale() {
        if (this.session) {
            this.session.toggleScale();
            this.scaleFactor = this.session.scaleFactor;
            this.applyDisplayModeHUD();
        }
    },

    applyDisplayModeHUD() {
        const scaleLabel = document.getElementById('vnc-scale-label');
        const scaleBtn = document.getElementById('vnc-scale-btn');
        const resBadge = document.getElementById('vnc-resolution-badge');

        if (this.scaleFactor) {
            if (scaleLabel) scaleLabel.textContent = 'Fit Layar';
            if (scaleBtn) {
                scaleBtn.className = 'flex-1 md:flex-none px-3 py-1.5 bg-emerald-950/40 border border-emerald-800/60 hover:bg-emerald-900/40 text-emerald-400 text-xs lg:text-sm font-bold rounded transition-colors whitespace-nowrap flex items-center gap-1.5 justify-center';
            }
        } else {
            if (scaleLabel) scaleLabel.textContent = '1:1 Asli';
            if (scaleBtn) {
                scaleBtn.className = 'flex-1 md:flex-none px-3 py-1.5 bg-[#171717] border border-[#262626] hover:bg-[#222] text-neutral-300 text-xs lg:text-sm font-bold rounded transition-colors whitespace-nowrap flex items-center gap-1.5 justify-center';
            }
        }

        if (this.remoteResolution.width > 0 && resBadge) {
            const modeText = this.scaleFactor ? 'FIT' : '1:1';
            resBadge.textContent = `${this.remoteResolution.width} × ${this.remoteResolution.height} (${modeText})`;
        }
    },

    toggleFullscreen() {
        const container = document.getElementById('vnc-container');
        if (!container) return;
        if (!document.fullscreenElement) {
            container.requestFullscreen().then(() => {
                setTimeout(() => {
                    if (this.session) this.session.applyDisplayMode();
                    this.applyDisplayModeHUD();
                }, 100);
            }).catch(err => {
                Toast.error('Gagal fullscreen: ' + err.message);
            });
        } else {
            document.exitFullscreen().then(() => {
                setTimeout(() => {
                    if (this.session) this.session.applyDisplayMode();
                    this.applyDisplayModeHUD();
                }, 100);
            });
        }
    },

    toggleVirtualKeyboard() {
        const kb = document.getElementById('vnc-virtual-keyboard');
        if (!kb) return;
        if (kb.classList.contains('hidden')) {
            kb.classList.remove('hidden');
            this.switchKeyboardLayout('letters');
        } else {
            kb.classList.add('hidden');
        }
    },

    switchKeyboardLayout(layout) {
        this.keyboardLayout = layout;
        const tabLetters = document.getElementById('vnc-kb-tab-letters');
        const tabSymbols = document.getElementById('vnc-kb-tab-symbols');
        const tabFunction = document.getElementById('vnc-kb-tab-function');

        const activeClass = 'px-3 py-1 text-[10px] font-bold rounded bg-neutral-200 text-black transition-colors';
        const inactiveClass = 'px-3 py-1 text-[10px] font-bold rounded bg-[#171717] border border-[#262626] text-neutral-400 hover:bg-[#222] transition-colors';

        if (tabLetters) tabLetters.className = layout === 'letters' ? activeClass : inactiveClass;
        if (tabSymbols) tabSymbols.className = layout === 'symbols' ? activeClass : inactiveClass;
        if (tabFunction) tabFunction.className = layout === 'function' ? activeClass : inactiveClass;

        this.renderKeyboardKeys();
    },

    toggleKeyboardShift() {
        this.shiftActive = !this.shiftActive;
        this.renderKeyboardKeys();
    },

    getLettersRows() {
        return [
            ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
            ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
            ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
            [
                { label: '⇧', action: 'shift', style: 'bg-[#222] border-neutral-700 min-w-[36px]' },
                'z', 'x', 'c', 'v', 'b', 'n', 'm',
                { label: '⌫', action: 'backspace', style: 'bg-[#222] border-neutral-700 min-w-[36px]' }
            ],
            [
                { label: 'Esc', action: 'esc', style: 'bg-[#222] border-neutral-700' },
                { label: 'Tab', action: 'tab', style: 'bg-[#222] border-neutral-700' },
                { label: 'Spasi', action: 'space', style: 'flex-[2.5]' },
                { label: 'Enter', action: 'enter', style: 'bg-[#222] border-neutral-700' }
            ]
        ];
    },

    getSymbolsRows() {
        return [
            ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
            ['-', '/', ':', ';', '(', ')', '$', '&', '@', '"'],
            ['[', ']', '{', '}', '#', '%', '^', '*', '+', '='],
            ['_', '\\', '|', '~', '<', '>', ',', '.', '?', '!'],
            [
                { label: 'Esc', action: 'esc', style: 'bg-[#222] border-neutral-700' },
                { label: '⌫', action: 'backspace', style: 'bg-[#222] border-neutral-700' },
                { label: 'Spasi', action: 'space', style: 'flex-[2.5]' },
                { label: 'Enter', action: 'enter', style: 'bg-[#222] border-neutral-700' }
            ]
        ];
    },

    getFunctionRows() {
        return [
            [
                { label: 'F1', keysym: 0xffbe },
                { label: 'F2', keysym: 0xffbf },
                { label: 'F3', keysym: 0xffc0 },
                { label: 'F4', keysym: 0xffc1 },
                { label: 'F5', keysym: 0xffc2 },
                { label: 'F6', keysym: 0xffc3 }
            ],
            [
                { label: 'F7', keysym: 0xffc4 },
                { label: 'F8', keysym: 0xffc5 },
                { label: 'F9', keysym: 0xffc6 },
                { label: 'F10', keysym: 0xffc7 },
                { label: 'F11', keysym: 0xffc8 },
                { label: 'F12', keysym: 0xffc9 }
            ],
            [
                { label: 'Esc', action: 'esc', style: 'bg-[#222] border-neutral-700' },
                { label: 'Tab', action: 'tab', style: 'bg-[#222] border-neutral-700' },
                { label: 'Del', keysym: 0xffff, style: 'bg-[#222] border-neutral-700 text-red-400 font-bold' },
                { label: 'Home', keysym: 0xff50, style: 'bg-[#222] border-neutral-700' },
                { label: 'End', keysym: 0xff57, style: 'bg-[#222] border-neutral-700' },
                { label: 'PgUp', keysym: 0xff55, style: 'bg-[#222] border-neutral-700' },
                { label: 'PgDn', keysym: 0xff56, style: 'bg-[#222] border-neutral-700' }
            ],
            [
                { label: 'PrtSc', keysym: 0xff61, style: 'bg-[#222] border-neutral-700 text-[10px]' },
                { label: 'Insert', keysym: 0xff63, style: 'bg-[#222] border-neutral-700 text-[10px]' },
                { label: 'Spasi', action: 'space', style: 'flex-[2.5]' },
                { label: 'Enter', action: 'enter', style: 'bg-[#222] border-neutral-700' }
            ]
        ];
    },

    renderKeyboardKeys() {
        const grid = document.getElementById('vnc-kb-keys-grid');
        if (!grid) return;
        grid.innerHTML = '';

        let rows;
        if (this.keyboardLayout === 'letters') rows = this.getLettersRows();
        else if (this.keyboardLayout === 'symbols') rows = this.getSymbolsRows();
        else if (this.keyboardLayout === 'function') rows = this.getFunctionRows();
        else rows = this.getLettersRows();

        rows.forEach(row => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'flex gap-1 justify-center w-full';

            row.forEach(key => {
                const btn = document.createElement('button');
                let label;
                let btnClass = 'py-2 px-1 rounded text-neutral-200 bg-[#141414] border border-[#222] transition-colors text-xs text-center flex-1 select-none touch-manipulation font-semibold active:scale-[0.98]';

                if (typeof key === 'string') {
                    const displayChar = this.shiftActive && this.keyboardLayout === 'letters' ? key.toUpperCase() : key;
                    label = displayChar;
                    this.bindVirtualKeyEvents(btn, key);
                } else {
                    label = key.label;
                    if (key.style) btnClass += ' ' + key.style;
                    this.bindVirtualKeyEvents(btn, key);
                }

                btn.className = btnClass;
                btn.textContent = label;
                rowDiv.appendChild(btn);
            });
            grid.appendChild(rowDiv);
        });
    },

    bindVirtualKeyEvents(btn, charOrKeyInfo) {
        let keysym;
        let isChar = false;
        let charVal = '';

        if (typeof charOrKeyInfo === 'string') {
            isChar = true;
            charVal = this.shiftActive && this.keyboardLayout === 'letters' ? charOrKeyInfo.toUpperCase() : charOrKeyInfo;
            keysym = charVal.charCodeAt(0);
        } else {
            if (charOrKeyInfo.keysym) {
                keysym = charOrKeyInfo.keysym;
            } else if (charOrKeyInfo.action === 'shift') {
                btn.onclick = (e) => {
                    e.preventDefault();
                    this.toggleKeyboardShift();
                };
                btn.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
                return;
            } else if (charOrKeyInfo.action === 'backspace') keysym = 0xff08;
            else if (charOrKeyInfo.action === 'tab') keysym = 0xff09;
            else if (charOrKeyInfo.action === 'space') keysym = 0x0020;
            else if (charOrKeyInfo.action === 'enter') keysym = 0xff0d;
            else if (charOrKeyInfo.action === 'esc') keysym = 0xff1b;
        }

        const handlePress = (e) => {
            e.preventDefault();
            if (!this.session) return;
            btn.classList.add('bg-neutral-200', 'text-black', 'border-white');
            btn.classList.remove('bg-[#141414]', 'text-neutral-200', 'border-[#222]', 'bg-[#222]');
            this.session.sendKey(keysym, null, true);
        };

        const handleRelease = (e) => {
            e.preventDefault();
            if (!this.session) return;
            btn.classList.remove('bg-neutral-200', 'text-black', 'border-white');
            if (typeof charOrKeyInfo !== 'string' && charOrKeyInfo.style && charOrKeyInfo.style.includes('bg-[#222]')) {
                btn.classList.add('bg-[#222]', 'text-neutral-200', 'border-[#222]');
            } else {
                btn.classList.add('bg-[#141414]', 'text-neutral-200', 'border-[#222]');
            }
            this.session.sendKey(keysym, null, false);

            if (isChar && this.shiftActive && this.keyboardLayout === 'letters') {
                this.shiftActive = false;
                this.renderKeyboardKeys();
            }
        };

        btn.addEventListener('pointerdown', handlePress);
        btn.addEventListener('pointerup', handleRelease);
        btn.addEventListener('pointerleave', handleRelease);
        btn.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    },

    toggleModifier(modKey) {
        if (!this.session) return;
        const normalizedKey = modKey.charAt(0).toUpperCase() + modKey.slice(1).toLowerCase();
        const active = this.session.toggleModifier(modKey);

        const btn = document.getElementById(`vnc-key-${normalizedKey.toLowerCase()}`);
        if (btn) {
            if (active) {
                btn.className = 'flex-1 py-1.5 bg-neutral-200 border border-white text-black text-[10px] font-bold rounded transition-colors shadow-sm';
            } else {
                btn.className = 'flex-1 py-1.5 bg-[#171717] border border-[#262626] text-neutral-400 text-[10px] font-bold rounded transition-colors';
            }
        }
    },

    releaseAllModifiers() {
        if (this.session) {
            this.session.releaseAllModifiers();
            const keys = ['Ctrl', 'Alt', 'Win', 'Shift'];
            keys.forEach(key => {
                const btn = document.getElementById(`vnc-key-${key.toLowerCase()}`);
                if (btn) {
                    btn.className = 'flex-1 py-1.5 bg-[#171717] border border-[#262626] text-neutral-400 text-[10px] font-bold rounded transition-colors';
                }
            });
        }
    },

    toggleMobileOptions() {
        const panel = document.getElementById('vnc-options-panel');
        if (panel) panel.classList.toggle('hidden');
    },

    sendSpecialKey(keysym) {
        if (this.session) {
            this.session.sendKey(keysym, null, true);
            this.session.sendKey(keysym, null, false);
        }
    },



    sendShortcutPreset(preset) {
        if (!this.session) return;
        if (preset === 'Win+R') {
            this.session.sendKey(0xffeb, null, true);
            this.session.sendKey('r'.charCodeAt(0), null, true);
            this.session.sendKey('r'.charCodeAt(0), null, false);
            this.session.sendKey(0xffeb, null, false);
        } else if (preset === 'Win+D') {
            this.session.sendKey(0xffeb, null, true);
            this.session.sendKey('d'.charCodeAt(0), null, true);
            this.session.sendKey('d'.charCodeAt(0), null, false);
            this.session.sendKey(0xffeb, null, false);
        } else if (preset === 'Alt+Tab') {
            this.session.sendKey(0xffe9, null, true);
            this.session.sendKey(0xff09, null, true);
            this.session.sendKey(0xff09, null, false);
            this.session.sendKey(0xffe9, null, false);
        } else if (preset === 'Alt+F4') {
            this.session.sendKey(0xffe9, null, true);
            this.session.sendKey(0xffbe, null, true);
            this.session.sendKey(0xffbe, null, false);
            this.session.sendKey(0xffe9, null, false);
        }
    },

    toggleClipboardModal() {
        const modal = document.getElementById('vnc-clipboard-modal');
        if (!modal) return;
        const isHidden = modal.classList.contains('hidden');
        if (isHidden) {
            modal.classList.remove('hidden');
            const sendInput = document.getElementById('vnc-clipboard-send-text');
            if (sendInput) {
                sendInput.focus();
                if (!sendInput.value && navigator.clipboard && navigator.clipboard.readText) {
                    navigator.clipboard.readText().then(t => {
                        if (t && !sendInput.value) sendInput.value = t;
                    }).catch(() => { });
                }
            }
            const recInput = document.getElementById('vnc-clipboard-received-text');
            if (recInput && this.session) {
                recInput.value = this.session.getRemoteClipboard() || this.lastReceivedClipboard || '';
            }
        } else {
            modal.classList.add('hidden');
        }
    },

    async pasteHostToInput() {
        const sendInput = document.getElementById('vnc-clipboard-send-text');
        if (!sendInput) return;
        if (navigator.clipboard && navigator.clipboard.readText) {
            try {
                const t = await navigator.clipboard.readText();
                if (t) {
                    sendInput.value = t;
                    Toast.success('Teks diambil dari clipboard host');
                    return;
                }
            } catch (e) {
                console.warn('[VNC] Gagal membaca clipboard host:', e);
            }
        }
        Toast.info('Gunakan Ctrl+V atau tahan dan tempel secara manual');
        sendInput.focus();
    },

    sendClipboardToRemote() {
        if (!this.session) {
            Toast.error('VNC belum terhubung');
            return;
        }
        const sendInput = document.getElementById('vnc-clipboard-send-text');
        const text = sendInput ? sendInput.value : '';
        if (!text) {
            Toast.warning('Ketik atau tempel teks terlebih dahulu');
            if (sendInput) sendInput.focus();
            return;
        }
        // Kirim teks dan langsung paste ke remote host
        this.session.handlePastedText(text);
        Toast.success('Teks terkirim & ditempel ke Remote Host!');
    },

    async copyReceivedToHost() {
        if (!this.session) {
            Toast.error('VNC belum terhubung');
            return;
        }
        const recInput = document.getElementById('vnc-clipboard-received-text');
        let text = recInput ? recInput.value : (this.session ? this.session.getRemoteClipboard() : '');

        // Jika teks masih kosong, kirim sinyal Ctrl+C ke remote host untuk menyalin teks yang sedang aktif/diseleksi
        if (!text) {
            Toast.info('Meminta seleksi teks dari Remote Host (Ctrl+C)...');
            this.session.sendCtrlKeySequence(0x0063, 'KeyC');
            await new Promise(r => setTimeout(r, 200));
            text = this.session.getRemoteClipboard() || this.lastReceivedClipboard || '';
            if (recInput && text) recInput.value = text;
        }

        if (!text) {
            Toast.warning('Belum ada teks di remote. Pilih/sorot teks di remote terlebih dahulu, lalu klik tombol ini.');
            return;
        }

        const copied = await this.session.copyTextToHost(text, false);
        if (copied) {
            Toast.success('📋 Teks dari Remote Host disalin ke clipboard Host! Silakan Paste (Ctrl+V / Klik Kanan).');
            if (recInput) recInput.value = text;
        } else {
            Toast.info('Silakan salin teks manual dari kotak di bawah');
            if (recInput) {
                recInput.focus();
                recInput.select();
            }
        }
    },

    async pasteHostClipboardDirect() {
        if (!this.session) {
            Toast.error('VNC belum terhubung');
            return;
        }
        let text = '';
        if (navigator.clipboard && navigator.clipboard.readText) {
            try {
                text = await navigator.clipboard.readText();
            } catch (e) { }
        }
        if (text) {
            this.session.handlePastedText(text);
            const sendInput = document.getElementById('vnc-clipboard-send-text');
            if (sendInput) sendInput.value = text;
        } else {
            const sendInput = document.getElementById('vnc-clipboard-send-text');
            if (sendInput && sendInput.value) {
                this.session.handlePastedText(sendInput.value);
            } else {
                Toast.info('Gunakan Ctrl+V di dalam layar remote atau tempel manual di kotak input');
                if (sendInput) sendInput.focus();
            }
        }
    },

    async copyRemoteClipboardDirect() {
        if (!this.session) {
            Toast.error('VNC belum terhubung');
            return;
        }
        const text = this.session.getRemoteClipboard() || this.lastReceivedClipboard || '';
        if (!text) {
            Toast.warning('Belum ada teks yang disalin dari remote VNC (Gunakan Ctrl+C di remote)');
            return;
        }
        await this.session.copyTextToHost(text, true);
    },

    async load() {
        try {
            const res = await API.settings.getAll();
            if (res && res.success && res.settings && res.settings.vnc_password !== undefined) {
                const pwdInput = document.getElementById('vnc-password-input');
                if (pwdInput) pwdInput.value = res.settings.vnc_password;
            }
        } catch (err) {
            console.error('Gagal memuat password VNC global:', err);
        }
    },

    async saveGlobalPassword() {
        const pwdInput = document.getElementById('vnc-password-input');
        if (!pwdInput) return;
        const val = pwdInput.value;
        const saveBtn = document.getElementById('vnc-save-pw-btn');
        if (saveBtn) saveBtn.disabled = true;
        try {
            await API.request('/api/v1/kasir/settings/vnc_password', {
                method: 'PUT',
                body: JSON.stringify({ value: val })
            });
            Toast.success('Password VNC berhasil disimpan ke server');
        } catch (err) {
            Toast.error('Gagal menyimpan password VNC: ' + err.message);
        } finally {
            if (saveBtn) saveBtn.disabled = false;
        }
    }
};

window.VNCSession = VNCSession;
window.VNCClient = VNCClient;

document.addEventListener('DOMContentLoaded', () => {
    VNCClient.getRFB();
    VNCClient.load();
});
