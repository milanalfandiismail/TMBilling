// vnc_client.js — Client Remote Control VNC Server untuk TMBilling

const VNCClient = {
    rfb: null,
    scaleFactor: true, // true = Fit to Viewport, false = 1:1 Native Resolution
    RFBClass: null,
    resizeObserver: null,
    remoteResolution: { width: 0, height: 0 },
    keyboardLayout: 'letters', // 'letters' | 'symbols'
    shiftActive: false,
    zoomLevel: 1.0, // Zoom factor for pinch-to-zoom
    
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
                this.zoomLevel = 1.0;
                this.applyDisplayMode();
                this.setupResizeObserver();
                this.setupCanvasTouchEmulation();
                this.setupPinchToZoom();

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
                this.setupCanvasTouchEmulation();
                this.setupPinchToZoom();
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
            if (this.zoomLevel > 1.0) {
                if (screen) screen.className = 'w-full h-full overflow-auto block scrollbar-mono';
            } else {
                if (screen) screen.className = 'w-full h-full overflow-hidden flex items-center justify-center';
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

        // Terapkan Zoom visual
        this.applyZoom();

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

    // Mengalkulasi ukuran kanvas berdasarkan zoom level
    applyZoom() {
        const screen = document.getElementById('vnc-screen');
        if (!screen) return;
        const canvas = screen.querySelector('canvas');
        if (!canvas || !this.remoteResolution.width) return;

        let originalWidth, originalHeight;
        if (this.scaleFactor) {
            const container = document.getElementById('vnc-container');
            const contW = container.clientWidth;
            const contH = container.clientHeight;
            const remoteRatio = this.remoteResolution.width / this.remoteResolution.height;
            const containerRatio = contW / contH;

            if (remoteRatio > containerRatio) {
                originalWidth = contW;
                originalHeight = contW / remoteRatio;
            } else {
                originalWidth = contH * remoteRatio;
                originalHeight = contH;
            }
        } else {
            originalWidth = this.remoteResolution.width;
            originalHeight = this.remoteResolution.height;
        }

        const zoomedW = Math.round(originalWidth * this.zoomLevel);
        const zoomedH = Math.round(originalHeight * this.zoomLevel);

        canvas.style.width = zoomedW + 'px';
        canvas.style.height = zoomedH + 'px';
    },

    toggleScale() {
        this.scaleFactor = !this.scaleFactor;
        this.zoomLevel = 1.0;
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
                this.applyZoom();
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

    // Emulasi Klik Layar Sentuh Lebih Responsif & Bebas Goyang
    setupCanvasTouchEmulation() {
        const screen = document.getElementById('vnc-screen');
        if (!screen) return;
        const canvas = screen.querySelector('canvas');
        if (!canvas) return;

        if (canvas.dataset.touchListenerAttached) return;
        canvas.dataset.touchListenerAttached = 'true';

        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;

        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                touchStartTime = Date.now();
            }
        }, { passive: true });

        canvas.addEventListener('touchend', (e) => {
            if (e.changedTouches.length === 1 && this.rfb) {
                const touchEndX = e.changedTouches[0].clientX;
                const touchEndY = e.changedTouches[0].clientY;
                const elapsed = Date.now() - touchStartTime;
                const dx = touchEndX - touchStartX;
                const dy = touchEndY - touchStartY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Sensitivitas wobble tap (15 piksel)
                if (elapsed < 300 && dist < 15) {
                    const rect = canvas.getBoundingClientRect();
                    const visualX = touchEndX - rect.left;
                    const visualY = touchEndY - rect.top;

                    const remoteW = this.remoteResolution.width || canvas.width;
                    const remoteH = this.remoteResolution.height || canvas.height;

                    const targetX = Math.round(visualX * (remoteW / rect.width));
                    const targetY = Math.round(visualY * (remoteH / rect.height));

                    this.rfb.sendMousePositions(targetX, targetY);

                    // Kirim Left Click mousedown & mouseup
                    this.rfb.sendMouseEvents(targetX, targetY, 1);
                    setTimeout(() => {
                        if (this.rfb) {
                            this.rfb.sendMouseEvents(targetX, targetY, 0);
                        }
                    }, 40);

                    e.preventDefault();
                }
            }
        }, { passive: false });
    },

    // Pinch to Zoom pada Mobile
    setupPinchToZoom() {
        const container = document.getElementById('vnc-container');
        if (!container) return;

        if (container.dataset.pinchListenerAttached) return;
        container.dataset.pinchListenerAttached = 'true';

        let touchStartDist = 0;
        let startZoom = 1.0;

        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                touchStartDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                startZoom = this.zoomLevel;
            }
        }, { passive: true });

        container.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && touchStartDist > 0) {
                const currentDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                let newZoom = startZoom * (currentDist / touchStartDist);
                // Limit zoom 1.0x s/d 3.0x
                newZoom = Math.max(1.0, Math.min(3.0, newZoom));
                this.zoomLevel = newZoom;
                
                // Atur class screen agar scrollbar muncul bila dizoom
                const screen = document.getElementById('vnc-screen');
                if (screen) {
                    if (newZoom > 1.0) {
                        screen.className = 'w-full h-full overflow-auto block scrollbar-mono';
                    } else {
                        if (this.scaleFactor) {
                            screen.className = 'w-full h-full overflow-hidden flex items-center justify-center';
                        } else {
                            screen.className = 'w-full h-full overflow-auto block scrollbar-mono';
                        }
                    }
                }

                this.applyZoom();
            }
        }, { passive: true });

        container.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                touchStartDist = 0;
            }
        }, { passive: true });
    },

    // Mobile Virtual Keyboard Toggle
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

    // Switch Keyboard Layout & Render
    switchKeyboardLayout(layout) {
        this.keyboardLayout = layout;

        const tabLetters = document.getElementById('vnc-kb-tab-letters');
        const tabSymbols = document.getElementById('vnc-kb-tab-symbols');

        if (tabLetters && tabSymbols) {
            if (layout === 'letters') {
                tabLetters.className = 'px-3 py-1 text-[10px] font-bold rounded bg-neutral-200 text-black transition-colors';
                tabSymbols.className = 'px-3 py-1 text-[10px] font-bold rounded bg-[#171717] border border-[#262626] text-neutral-400 hover:bg-[#222] transition-colors';
            } else {
                tabLetters.className = 'px-3 py-1 text-[10px] font-bold rounded bg-[#171717] border border-[#262626] text-neutral-400 hover:bg-[#222] transition-colors';
                tabSymbols.className = 'px-3 py-1 text-[10px] font-bold rounded bg-neutral-200 text-black transition-colors';
            }
        }

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

    renderKeyboardKeys() {
        const grid = document.getElementById('vnc-kb-keys-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const rows = this.keyboardLayout === 'letters' ? this.getLettersRows() : this.getSymbolsRows();

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

    // Mengikat event pointerdown & pointerup/pointerleave untuk emulasi tactile & instant response
    bindVirtualKeyEvents(btn, charOrKeyInfo) {
        let keysym;
        let isChar = false;
        let charVal = '';

        if (typeof charOrKeyInfo === 'string') {
            isChar = true;
            charVal = this.shiftActive && this.keyboardLayout === 'letters' ? charOrKeyInfo.toUpperCase() : charOrKeyInfo;
            keysym = charVal.charCodeAt(0);
        } else {
            if (charOrKeyInfo.action === 'shift') {
                btn.onclick = (e) => {
                    e.preventDefault();
                    this.toggleKeyboardShift();
                };
                // Cegah double tap zoom default mobile
                btn.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
                return;
            }
            if (charOrKeyInfo.action === 'backspace') keysym = 0xff08;
            else if (charOrKeyInfo.action === 'tab') keysym = 0xff09;
            else if (charOrKeyInfo.action === 'space') keysym = 0x0020;
            else if (charOrKeyInfo.action === 'enter') keysym = 0xff0d;
            else if (charOrKeyInfo.action === 'esc') keysym = 0xff1b;
        }

        const handlePress = (e) => {
            e.preventDefault();
            if (!this.rfb) return;

            // Efek visual langsung ketika ditekan ("tekan sampai berwarna")
            btn.classList.add('bg-neutral-200', 'text-black', 'border-white');
            btn.classList.remove('bg-[#141414]', 'text-neutral-200', 'border-[#222]', 'bg-[#222]');

            // Kirim sinyal key down
            this.rfb.sendKey(keysym, null, true);
        };

        const handleRelease = (e) => {
            e.preventDefault();
            if (!this.rfb) return;

            // Kembalikan efek visual tombol ketika dilepas
            btn.classList.remove('bg-neutral-200', 'text-black', 'border-white');
            if (typeof charOrKeyInfo !== 'string' && charOrKeyInfo.style && charOrKeyInfo.style.includes('bg-[#222]')) {
                btn.classList.add('bg-[#222]', 'text-neutral-200', 'border-[#222]');
            } else {
                btn.classList.add('bg-[#141414]', 'text-neutral-200', 'border-[#222]');
            }

            // Kirim sinyal key up
            this.rfb.sendKey(keysym, null, false);

            // Auto-turn off Shift setelah karakter huruf dilepaskan
            if (isChar && this.shiftActive && this.keyboardLayout === 'letters') {
                this.shiftActive = false;
                this.renderKeyboardKeys();
            }
            this.releaseModifiers();
        };

        btn.addEventListener('pointerdown', handlePress);
        btn.addEventListener('pointerup', handleRelease);
        btn.addEventListener('pointerleave', handleRelease);
        btn.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    },

    // Mobile Options Panel Toggle
    toggleMobileOptions() {
        const panel = document.getElementById('vnc-options-panel');
        if (!panel) return;
        panel.classList.toggle('hidden');
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
