// vnc_client.js — Client Remote Control VNC Server untuk TMBilling

const VNCClient = {
    rfb: null,
    scaleFactor: true, // true = Fit to Viewport, false = 1:1 Native Resolution
    RFBClass: null,
    resizeObserver: null,
    remoteResolution: { width: 0, height: 0 },
    
    // Sticky modifiers state
    modifiers: {
        Ctrl: false,
        Alt: false,
        Win: false,
        Shift: false
    },

    async getRFB() {
        if (this.RFBClass) return this.RFBClass;
        if (window.RFB) {
            this.RFBClass = window.RFB;
            return this.RFBClass;
        }
        try {
            const mod = await import('https://cdn.jsdelivr.net/npm/@novnc/novnc@1.4.0/core/rfb.js');
            this.RFBClass = mod.default;
            window.RFB = mod.default;
            return this.RFBClass;
        } catch (err) {
            console.error('Gagal memuat modul noVNC RFB:', err);
            return null;
        }
    },

    async connect() {
        const screen = document.getElementById('vnc-screen');
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
            Toast.error('Gagal memuat modul noVNC. Pastikan PC terhubung ke internet untuk mengunduh library rfb.js');
            return;
        }

        badge.textContent = 'Menyiapkan Websockify...';

        // 1. Panggil API backend untuk memastikan daemon websockify aktif
        let listenPort = 8081;
        let serverVncPassword = '';
        try {
            const startRes = await API.request('/api/v1/kasir/vnc/start', { method: 'POST' });
            if (startRes) {
                if (startRes.listen_port) {
                    listenPort = startRes.listen_port;
                }
                if (startRes.vnc_password) {
                    serverVncPassword = startRes.vnc_password;
                }
            }
        } catch (err) {
            badge.textContent = 'Gagal Start Service';
            badge.className = 'px-2 py-1 md:px-3 md:py-1.5 rounded text-[10px] md:text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30';
            Toast.error('Gagal memulai service VNC: ' + err.message);
            return;
        }

        // 2. Tentukan WebSocket URL
        let url;
        if (window.location.protocol === 'https:') {
            url = `wss://${window.location.host}/ws/vnc`;
        } else {
            url = `ws://${window.location.hostname}:${listenPort}`;
        }

        const vncPassword = (pwdInput && pwdInput.value) ? pwdInput.value : serverVncPassword;

        badge.textContent = 'Menghubungkan...';

        try {
            screen.innerHTML = '';
            
            this.rfb = new RFBClass(screen, url, {
                credentials: { password: vncPassword },
                scaleViewport: this.scaleFactor,
                clipViewport: false,
                dragViewport: true
            });

            this.rfb.addEventListener('credentialsrequired', () => {
                const pass = prompt('TightVNC meminta Password. Masukkan password VNC:');
                if (pass !== null) {
                    this.rfb.sendCredentials({ password: pass });
                    if (pwdInput) pwdInput.value = pass;
                }
            });

            this.rfb.addEventListener('connect', () => {
                badge.textContent = 'Terhubung';
                badge.className = 'px-2 py-1 md:px-3 md:py-1.5 rounded text-[10px] md:text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
                placeholder.classList.add('hidden');
                connectBtn.classList.add('hidden');
                disconnectBtn.classList.remove('hidden');

                // Terapkan mode tampilan & observasi resize
                this.applyDisplayMode();
                this.setupResizeObserver();

                // Focus kanvas
                setTimeout(() => {
                    if (this.rfb) {
                        try { this.rfb.focus(); } catch(e) {}
                    }
                }, 50);

                Toast.success('Koneksi VNC Server Terhubung');
            });

            // Tangkap resolusi dari frame pertama
            this.rfb.addEventListener('firstframe', () => {
                this.updateResolutionInfo();
                this.applyDisplayMode();
            });

            this.rfb.addEventListener('desktopname', () => {
                this.updateResolutionInfo();
            });

            this.rfb.addEventListener('disconnect', (e) => {
                badge.textContent = 'Terputus';
                badge.className = 'px-2 py-1 md:px-3 md:py-1.5 rounded text-[10px] md:text-xs font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700';
                placeholder.classList.remove('hidden');
                connectBtn.classList.remove('hidden');
                disconnectBtn.classList.add('hidden');
                
                // Reset HUD resolusi & panel mobile
                const resBadge = document.getElementById('vnc-resolution-badge');
                if (resBadge) resBadge.classList.add('hidden');

                document.getElementById('vnc-virtual-keyboard').classList.add('hidden');
                const optPanel = document.getElementById('vnc-options-panel');
                if (optPanel) optPanel.classList.add('hidden');

                if (this.resizeObserver) {
                    this.resizeObserver.disconnect();
                    this.resizeObserver = null;
                }

                if (e.detail && e.detail.clean) {
                    Toast.info('Koneksi VNC ditutup');
                } else {
                    Toast.error('Koneksi VNC terputus (Cek apakah TightVNC Server aktif di 127.0.0.1:5900)');
                }
            });

        } catch (err) {
            badge.textContent = 'Gagal Koneksi';
            badge.className = 'px-2 py-1 md:px-3 md:py-1.5 rounded text-[10px] md:text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30';
            Toast.error('Gagal memulai VNC Client: ' + err.message);
        }
    },

    disconnect() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        if (this.rfb) {
            this.rfb.disconnect();
            this.rfb = null;
        }
        const screen = document.getElementById('vnc-screen');
        if (screen) screen.innerHTML = '';
        
        const resBadge = document.getElementById('vnc-resolution-badge');
        if (resBadge) resBadge.classList.add('hidden');
    },

    // Deteksi resolusi remote & rasio aspek
    updateResolutionInfo() {
        if (!this.rfb) return;
        const w = this.rfb._fbWidth || (this.rfb._display ? this.rfb._display._fbWidth : 0);
        const h = this.rfb._fbHeight || (this.rfb._display ? this.rfb._display._fbHeight : 0);

        if (w > 0 && h > 0) {
            this.remoteResolution = { width: w, height: h };
            const resBadge = document.getElementById('vnc-resolution-badge');
            if (resBadge) {
                const modeText = this.scaleFactor ? 'FIT' : '1:1';
                resBadge.textContent = `${w} × ${h} (${modeText})`;
                resBadge.classList.remove('hidden');
            }
        }
    },

    // Terapkan mode tampilan: Scaling ON (Fit) vs Scaling OFF (1:1 Native)
    applyDisplayMode() {
        const screen = document.getElementById('vnc-screen');
        const scaleLabel = document.getElementById('vnc-scale-label');
        const scaleBtn = document.getElementById('vnc-scale-btn');
        const resBadge = document.getElementById('vnc-resolution-badge');

        if (this.scaleFactor) {
            // Mode 1: SCALING ON (Fit to Viewport)
            // Memenuhi kontainer secara proporsional dengan aspect ratio terkunci
            if (screen) {
                screen.className = 'w-full h-full overflow-hidden flex items-center justify-center';
            }
            if (scaleLabel) scaleLabel.textContent = 'Fit Layar';
            if (scaleBtn) {
                scaleBtn.className = 'flex-1 md:flex-none px-3 py-1.5 bg-emerald-950/40 border border-emerald-800/60 hover:bg-emerald-900/40 text-emerald-400 text-xs lg:text-sm font-bold rounded transition-colors whitespace-nowrap flex items-center gap-1.5 justify-center';
            }
            if (this.rfb) {
                this.rfb.scaleViewport = true;
            }
        } else {
            // Mode 2: SCALING OFF (1:1 Native Resolution)
            // Resolusi asli 100% dengan scrollable viewport jika melebihi ukuran layar
            if (screen) {
                screen.className = 'w-full h-full overflow-auto block scrollbar-mono';
            }
            if (scaleLabel) scaleLabel.textContent = '1:1 Asli';
            if (scaleBtn) {
                scaleBtn.className = 'flex-1 md:flex-none px-3 py-1.5 bg-[#171717] border border-[#262626] hover:bg-[#222] text-neutral-300 text-xs lg:text-sm font-bold rounded transition-colors whitespace-nowrap flex items-center gap-1.5 justify-center';
            }
            if (this.rfb) {
                this.rfb.scaleViewport = false;
            }
        }

        // Update teks HUD resolusi
        if (this.remoteResolution.width > 0 && resBadge) {
            const modeText = this.scaleFactor ? 'FIT' : '1:1';
            resBadge.textContent = `${this.remoteResolution.width} × ${this.remoteResolution.height} (${modeText})`;
        }

        // Pemicu resize event agar noVNC kanvas langsung sinkron
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
            if (this.rfb) {
                try { this.rfb.focus(); } catch (e) {}
            }
        }, 30);
    },

    toggleScale() {
        this.scaleFactor = !this.scaleFactor;
        this.applyDisplayMode();
    },

    // Observer untuk mendeteksi perubahan ukuran kontainer secara real-time
    setupResizeObserver() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        const container = document.getElementById('vnc-container');
        if (!container || typeof ResizeObserver === 'undefined') return;

        let resizeTimeout;
        this.resizeObserver = new ResizeObserver(() => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (this.rfb && this.scaleFactor) {
                    this.rfb.scaleViewport = true;
                }
                window.dispatchEvent(new Event('resize'));
            }, 50);
        });

        this.resizeObserver.observe(container);
    },

    toggleFullscreen() {
        const container = document.getElementById('vnc-container');
        if (!container) return;
        if (!document.fullscreenElement) {
            container.requestFullscreen().then(() => {
                setTimeout(() => this.applyDisplayMode(), 100);
            }).catch(err => {
                Toast.error('Gagal fullscreen: ' + err.message);
            });
        } else {
            document.exitFullscreen().then(() => {
                setTimeout(() => this.applyDisplayMode(), 100);
            });
        }
    },

    // Mobile Virtual Keyboard Toggle
    toggleVirtualKeyboard() {
        const kb = document.getElementById('vnc-virtual-keyboard');
        if (!kb) return;
        if (kb.classList.contains('hidden')) {
            kb.classList.remove('hidden');
            setTimeout(() => {
                const helper = document.getElementById('vnc-text-helper');
                if (helper) helper.focus();
            }, 50);
        } else {
            kb.classList.add('hidden');
        }
    },

    // Mobile Options Panel Toggle
    toggleMobileOptions() {
        const panel = document.getElementById('vnc-options-panel');
        if (!panel) return;
        panel.classList.toggle('hidden');
    },

    // Send text helper
    sendTextHelper() {
        const input = document.getElementById('vnc-text-helper');
        if (!input || !this.rfb) return;
        const text = input.value;
        if (!text) return;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const keysym = char.charCodeAt(0);
            this.rfb.sendKey(keysym, null, true);
            this.rfb.sendKey(keysym, null, false);
        }
        input.value = '';
        this.releaseModifiers();
        Toast.success('Teks berhasil dikirim');
    },

    // Send special keys
    sendSpecialKey(keysym) {
        if (!this.rfb) return;
        this.rfb.sendKey(keysym, null, true);
        this.rfb.sendKey(keysym, null, false);
        this.releaseModifiers();
    },

    // Toggle Modifier Sticky Key
    toggleModifier(modKey) {
        if (!this.rfb) return;
        const active = !this.modifiers[modKey];
        this.modifiers[modKey] = active;

        let keysym;
        if (modKey === 'Ctrl') keysym = 0xffe3;
        else if (modKey === 'Alt') keysym = 0xffe9;
        else if (modKey === 'Win') keysym = 0xffeb;
        else if (modKey === 'Shift') keysym = 0xffe1;

        this.rfb.sendKey(keysym, null, active);

        // Update button UI highlight
        const btn = document.getElementById(`vnc-key-${modKey.toLowerCase()}`);
        if (btn) {
            if (active) {
                btn.className = 'flex-1 py-1.5 bg-[#e5e5e5] border border-white text-black text-[10px] font-bold rounded transition-colors';
            } else {
                btn.className = 'flex-1 py-1.5 bg-[#171717] border border-[#262626] text-neutral-400 text-[10px] font-bold rounded transition-colors';
            }
        }
    },

    // Force release all active modifiers
    releaseModifiers() {
        if (!this.rfb) return;
        const keys = { 'Ctrl': 0xffe3, 'Alt': 0xffe9, 'Win': 0xffeb, 'Shift': 0xffe1 };
        for (const [key, keysym] of Object.entries(keys)) {
            if (this.modifiers[key]) {
                this.rfb.sendKey(keysym, null, false);
                this.modifiers[key] = false;
                const btn = document.getElementById(`vnc-key-${key.toLowerCase()}`);
                if (btn) {
                    btn.className = 'flex-1 py-1.5 bg-[#171717] border border-[#262626] text-neutral-400 text-[10px] font-bold rounded transition-colors';
                }
            }
        }
    },

    // Send CAD
    sendCtrlAltDel() {
        if (!this.rfb) return;
        this.rfb.sendCtrlAltDel();
        this.releaseModifiers();
    },

    // Send Shortcut Preset
    sendShortcutPreset(preset) {
        if (!this.rfb) return;
        if (preset === 'Win+R') {
            this.rfb.sendKey(0xffeb, null, true); // Win
            this.rfb.sendKey('r'.charCodeAt(0), null, true); // R
            this.rfb.sendKey('r'.charCodeAt(0), null, false);
            this.rfb.sendKey(0xffeb, null, false);
        } else if (preset === 'Win+D') {
            this.rfb.sendKey(0xffeb, null, true); // Win
            this.rfb.sendKey('d'.charCodeAt(0), null, true); // D
            this.rfb.sendKey('d'.charCodeAt(0), null, false);
            this.rfb.sendKey(0xffeb, null, false);
        } else if (preset === 'Alt+Tab') {
            this.rfb.sendKey(0xffe9, null, true); // Alt
            this.rfb.sendKey(0xff09, null, true); // Tab
            this.rfb.sendKey(0xff09, null, false);
            this.rfb.sendKey(0xffe9, null, false);
        } else if (preset === 'Alt+F4') {
            this.rfb.sendKey(0xffe9, null, true); // Alt
            this.rfb.sendKey(0xffbe, null, true); // F4 (0xffbe is F4)
            this.rfb.sendKey(0xffbe, null, false);
            this.rfb.sendKey(0xffe9, null, false);
        }
        this.releaseModifiers();
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

window.VNCClient = VNCClient;

document.addEventListener('DOMContentLoaded', () => {
    VNCClient.getRFB();
    VNCClient.load();
});
