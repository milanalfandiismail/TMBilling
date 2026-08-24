// vnc_client.js — Client Remote Control VNC Server untuk TMBilling

const VNCClient = {
    rfb: null,
    scaleFactor: true, // true = Fit to Viewport, false = 1:1 Native Resolution
    RFBClass: null,
    resizeObserver: null,
    remoteResolution: { width: 0, height: 0 },
    keyboardLayout: 'letters', // 'letters' | 'symbols' | 'function'
    shiftActive: false,
    zoomLevel: 1.0, // Zoom factor for GPU pinch-to-zoom (1.0x to 4.0x)
    panX: 0,        // X translation offset when zoomed
    panY: 0,        // Y translation offset when zoomed
    isPinchZooming: false, // Flag to separate pinch-zoom state from mouse click emulation
    
    // Sticky / Latching modifiers state
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

    // Helper untuk mengirimkan synthetic MouseEvent langsung ke canvas noVNC
    dispatchCanvasMouse(type, clientX, clientY, button = 0, buttons = 0) {
        const screen = document.getElementById('vnc-screen');
        if (!screen) return;
        const canvas = screen.querySelector('canvas');
        if (!canvas) return;

        const ev = new MouseEvent(type, {
            clientX: clientX,
            clientY: clientY,
            button: button,
            buttons: buttons,
            bubbles: true,
            cancelable: true,
            view: window
        });
        canvas.dispatchEvent(ev);
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
                dragViewport: false
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

                // Lepas gesture internal noVNC agar tidak mengganggu touch controller kita
                if (this.rfb._gestures) {
                    try { this.rfb._gestures.detach(); } catch(e) {}
                }

                // Terapkan mode tampilan, observer, dan touch controller terpadu
                this.zoomLevel = 1.0;
                this.panX = 0;
                this.panY = 0;
                this.isPinchZooming = false;
                this.applyDisplayMode();
                this.setupResizeObserver();
                this.setupCanvasTouchEmulation();

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

                this.releaseAllModifiers();

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
        this.releaseAllModifiers();
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

    // Hitung batas pan agar canvas tidak melayang keluar batas saat di-zoom
    getPanBounds(zoom) {
        const container = document.getElementById('vnc-container');
        const screen = document.getElementById('vnc-screen');
        if (!container || !screen) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        const canvas = screen.querySelector('canvas');
        if (!canvas) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };

        const baseW = canvas.offsetWidth || container.clientWidth;
        const baseH = canvas.offsetHeight || container.clientHeight;
        const contW = container.clientWidth;
        const contH = container.clientHeight;

        const scaledW = baseW * zoom;
        const scaledH = baseH * zoom;

        const maxPanX = Math.max(0, (scaledW - contW) / 2);
        const maxPanY = Math.max(0, (scaledH - contH) / 2);

        return {
            minX: -maxPanX,
            maxX: maxPanX,
            minY: -maxPanY,
            maxY: maxPanY
        };
    },

    // Terapkan transformasi hardware CSS untuk Zoom dan Pan yang 100% mulus (60fps)
    applyTransform(animate = false) {
        const screen = document.getElementById('vnc-screen');
        if (!screen) return;
        const canvas = screen.querySelector('canvas');
        if (!canvas) return;

        if (this.zoomLevel <= 1.0) {
            this.zoomLevel = 1.0;
            this.panX = 0;
            this.panY = 0;
        } else {
            const bounds = this.getPanBounds(this.zoomLevel);
            this.panX = Math.max(bounds.minX, Math.min(bounds.maxX, this.panX));
            this.panY = Math.max(bounds.minY, Math.min(bounds.maxY, this.panY));
        }

        if (animate) {
            canvas.style.transition = 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)';
        } else {
            canvas.style.transition = 'none';
        }

        canvas.style.transformOrigin = 'center center';
        canvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomLevel})`;
    },

    // Terapkan mode tampilan: Scaling ON (Fit) vs Scaling OFF (1:1 Native)
    applyDisplayMode() {
        const screen = document.getElementById('vnc-screen');
        const scaleLabel = document.getElementById('vnc-scale-label');
        const scaleBtn = document.getElementById('vnc-scale-btn');
        const resBadge = document.getElementById('vnc-resolution-badge');

        if (this.scaleFactor) {
            // Mode 1: SCALING ON (Fit to Viewport)
            if (screen) screen.className = 'w-full h-full overflow-hidden flex items-center justify-center';
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

        // Terapkan transformasi zoom
        this.applyTransform(false);

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
        this.zoomLevel = 1.0;
        this.panX = 0;
        this.panY = 0;
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
                this.applyTransform(false);
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

    // Unified Mobile Touch Handler (Chrome Remote Desktop Style)
    // Mengintegrasikan 1-Finger Tap/Drag/Long-Press & 2-Finger Pinch to Zoom di dalam kanvas remote
    setupCanvasTouchEmulation() {
        const container = document.getElementById('vnc-container');
        const screen = document.getElementById('vnc-screen');
        if (!container || !screen) return;

        if (container.dataset.unifiedTouchAttached) return;
        container.dataset.unifiedTouchAttached = 'true';

        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;
        let longPressTimer = null;
        let isLongPress = false;
        let isDragging = false;

        // Variabel untuk 2-Finger Pinch Zoom
        let touchStartDist = 0;
        let startZoom = 1.0;
        let startPanX = 0;
        let startPanY = 0;
        let startMidX = 0;
        let startMidY = 0;

        // 1. TOUCHSTART
        container.addEventListener('touchstart', (e) => {
            const canvas = screen.querySelector('canvas');
            if (!canvas) return;

            // 2 JARI: PINCH TO ZOOM DI DALAM KANVAS REMOTE
            if (e.touches.length >= 2) {
                if (longPressTimer) clearTimeout(longPressTimer);
                this.isPinchZooming = true;
                touchStartDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                startZoom = this.zoomLevel;
                startPanX = this.panX;
                startPanY = this.panY;
                startMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                startMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // 1 JARI: TAP / PAN / LONG-PRESS
            if (e.touches.length === 1) {
                this.isPinchZooming = false;
                isLongPress = false;
                isDragging = false;

                const touch = e.touches[0];
                touchStartX = touch.clientX;
                touchStartY = touch.clientY;
                touchStartTime = Date.now();
                startPanX = this.panX;
                startPanY = this.panY;

                // Update posisi mouse hover
                this.dispatchCanvasMouse('mousemove', touch.clientX, touch.clientY, 0, 0);

                // Long-Press Timer (500ms) untuk Right Click
                if (longPressTimer) clearTimeout(longPressTimer);
                longPressTimer = setTimeout(() => {
                    isLongPress = true;
                    this.dispatchCanvasMouse('mousemove', touch.clientX, touch.clientY, 0, 0);
                    this.dispatchCanvasMouse('mousedown', touch.clientX, touch.clientY, 2, 2);
                    setTimeout(() => {
                        this.dispatchCanvasMouse('mouseup', touch.clientX, touch.clientY, 2, 0);
                    }, 50);

                    if (navigator.vibrate) {
                        try { navigator.vibrate(50); } catch(err) {}
                    }
                    Toast.info('Klik Kanan (Right-Click)');
                }, 500);

                e.stopPropagation();
            }
        }, { capture: true, passive: false });

        // 2. TOUCHMOVE
        container.addEventListener('touchmove', (e) => {
            // Mode 2 Jari: Eksekusi Pinch Zoom
            if (e.touches.length >= 2) {
                if (longPressTimer) clearTimeout(longPressTimer);
                this.isPinchZooming = true;
                e.preventDefault();
                e.stopPropagation();

                if (touchStartDist > 0) {
                    const currentDist = Math.hypot(
                        e.touches[0].clientX - e.touches[1].clientX,
                        e.touches[0].clientY - e.touches[1].clientY
                    );
                    const currentMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                    const currentMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

                    const scaleFactor = currentDist / touchStartDist;
                    let targetZoom = Math.max(1.0, Math.min(4.0, startZoom * scaleFactor));
                    this.zoomLevel = targetZoom;

                    if (this.zoomLevel > 1.0) {
                        this.panX = startPanX + (currentMidX - startMidX);
                        this.panY = startPanY + (currentMidY - startMidY);
                    } else {
                        this.panX = 0;
                        this.panY = 0;
                    }

                    this.applyTransform(false);
                }
                return;
            }

            // Mode 1 Jari: Panning (Jika Sedang Zoom) atau Deteksi Gerakan
            if (e.touches.length === 1) {
                if (this.isPinchZooming) return;

                const touch = e.touches[0];
                const dx = touch.clientX - touchStartX;
                const dy = touch.clientY - touchStartY;
                const dist = Math.hypot(dx, dy);

                if (dist > 8) {
                    if (longPressTimer) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                    }
                    isDragging = true;

                    // Jika sedang di-zoom, geser kanvas secara langsung (Pan)
                    if (this.zoomLevel > 1.0) {
                        this.panX = startPanX + dx;
                        this.panY = startPanY + dy;
                        this.applyTransform(false);
                        e.preventDefault();
                    }
                }

                e.stopPropagation();
            }
        }, { capture: true, passive: false });

        // 3. TOUCHEND
        container.addEventListener('touchend', (e) => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }

            if (e.touches.length < 2) {
                touchStartDist = 0;
            }

            if (this.isPinchZooming) {
                if (e.touches.length === 0) {
                    this.isPinchZooming = false;
                    // Snap balik jika mendekati 1.0x
                    if (this.zoomLevel <= 1.05) {
                        this.zoomLevel = 1.0;
                        this.panX = 0;
                        this.panY = 0;
                        this.applyTransform(true);
                    }
                }
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            if (isLongPress || isDragging) {
                e.stopPropagation();
                e.preventDefault();
                return;
            }

            if (e.changedTouches.length === 1) {
                const touch = e.changedTouches[0];
                const elapsed = Date.now() - touchStartTime;
                const dx = touch.clientX - touchStartX;
                const dy = touch.clientY - touchStartY;
                const dist = Math.hypot(dx, dy);

                // Tap Cepat (< 400ms dan dist < 12px) -> Left Click
                if (elapsed < 400 && dist < 12) {
                    this.dispatchCanvasMouse('mousemove', touch.clientX, touch.clientY, 0, 0);
                    this.dispatchCanvasMouse('mousedown', touch.clientX, touch.clientY, 0, 1);
                    setTimeout(() => {
                        this.dispatchCanvasMouse('mouseup', touch.clientX, touch.clientY, 0, 0);
                    }, 35);

                    e.preventDefault();
                }

                e.stopPropagation();
            }
        }, { capture: true, passive: false });
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

    // Mengikat event pointerdown & pointerup/pointerleave untuk pengetikan instan
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
            if (!this.rfb) return;

            // Highlight visual ketika ditekan
            btn.classList.add('bg-neutral-200', 'text-black', 'border-white');
            btn.classList.remove('bg-[#141414]', 'text-neutral-200', 'border-[#222]', 'bg-[#222]');

            // Kirim key down ke VNC host
            this.rfb.sendKey(keysym, null, true);
        };

        const handleRelease = (e) => {
            e.preventDefault();
            if (!this.rfb) return;

            // Kembalikan visual ke warna asal
            btn.classList.remove('bg-neutral-200', 'text-black', 'border-white');
            if (typeof charOrKeyInfo !== 'string' && charOrKeyInfo.style && charOrKeyInfo.style.includes('bg-[#222]')) {
                btn.classList.add('bg-[#222]', 'text-neutral-200', 'border-[#222]');
            } else {
                btn.classList.add('bg-[#141414]', 'text-neutral-200', 'border-[#222]');
            }

            // Kirim key up ke VNC host
            this.rfb.sendKey(keysym, null, false);

            // Auto-turn off Shift jika mengetik huruf kapital
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

    // Toggle Sticky / Latching Modifier (Ctrl, Alt, Win, Shift)
    // Modifier akan TETAP AKTIF (berwarna putih) sampai diketuk lagi untuk OFF
    toggleModifier(modKey) {
        if (!this.rfb) return;
        const normalizedKey = modKey.charAt(0).toUpperCase() + modKey.slice(1).toLowerCase();
        const active = !this.modifiers[normalizedKey];
        this.modifiers[normalizedKey] = active;

        let keysym;
        if (normalizedKey === 'Ctrl') keysym = 0xffe3;
        else if (normalizedKey === 'Alt') keysym = 0xffe9;
        else if (normalizedKey === 'Win') keysym = 0xffeb;
        else if (normalizedKey === 'Shift') keysym = 0xffe1;

        // Kirim status key down jika active, key up jika inactive
        this.rfb.sendKey(keysym, null, active);

        // Update styling visual tombol toggle
        const btn = document.getElementById(`vnc-key-${normalizedKey.toLowerCase()}`);
        if (btn) {
            if (active) {
                btn.className = 'flex-1 py-1.5 bg-neutral-200 border border-white text-black text-[10px] font-bold rounded transition-colors shadow-sm';
            } else {
                btn.className = 'flex-1 py-1.5 bg-[#171717] border border-[#262626] text-neutral-400 text-[10px] font-bold rounded transition-colors';
            }
        }
    },

    // Force release all active modifiers (misal saat disconnect)
    releaseAllModifiers() {
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
    },

    // Send CAD
    sendCtrlAltDel() {
        if (!this.rfb) return;
        this.rfb.sendCtrlAltDel();
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
