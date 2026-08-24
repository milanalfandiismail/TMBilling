// vnc_client.js — Client Remote Control VNC Server untuk TMBilling

const VNCClient = {
    rfb: null,
    scaleFactor: true, // true = Fit to Viewport, false = 1:1 Native Resolution
    RFBClass: null,
    resizeObserver: null,
    remoteResolution: { width: 0, height: 0 },
    keyboardLayout: 'letters', // 'letters' | 'symbols' | 'function'
    shiftActive: false,
    zoomLevel: 1.0, // Zoom factor for pinch-to-zoom
    isPinchZooming: false, // Flag to separate pinch-zoom state from mouse click emulation
    lastMouseX: 0,
    lastMouseY: 0,
    
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
                dragViewport: false,
                showDotCursor: false
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

                // Terapkan mode tampilan, observer, gestur, dan sembunyikan kursor mobile
                this.zoomLevel = 1.0;
                this.isPinchZooming = false;
                this.injectMobileCursorCSS();
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

    // Suntikkan style CSS untuk menyembunyikan kursor remote pada mobile secara total
    injectMobileCursorCSS() {
        const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
        if (!isTouch) return;

        if (document.getElementById('vnc-mobile-cursor-style')) return;
        const style = document.createElement('style');
        style.id = 'vnc-mobile-cursor-style';
        style.textContent = `
            #vnc-screen, #vnc-screen *, #vnc-container, #vnc-container *, #vnc-screen canvas {
                cursor: none !important;
                touch-action: none !important;
            }
        `;
        document.head.appendChild(style);
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

        // Matikan kursor bawaan noVNC
        if (screen) {
            const canvas = screen.querySelector('canvas');
            const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
            if (isTouch && canvas) {
                canvas.style.setProperty('cursor', 'none', 'important');
                canvas.style.touchAction = 'none';
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

    // Emulasi Touch Android Responsif (Mode Chrome Remote Desktop): Tap (Left Click), Double-Tap, Long-Press (Right Click), 1-Finger Pan
    setupCanvasTouchEmulation() {
        const screen = document.getElementById('vnc-screen');
        if (!screen) return;
        const canvas = screen.querySelector('canvas');
        if (!canvas) return;

        if (canvas.dataset.touchEmulationV2Attached) return;
        canvas.dataset.touchEmulationV2Attached = 'true';

        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;
        let longPressTimer = null;
        let isLongPress = false;
        let isDragging = false;
        let initialScrollX = 0;
        let initialScrollY = 0;

        // Gunakan Capture Phase agar mengontrol penuh sebelum noVNC internal handler
        canvas.addEventListener('touchstart', (e) => {
            // Multi-touch: Gestur Zoom (2 Jari)
            if (e.touches.length >= 2) {
                if (longPressTimer) clearTimeout(longPressTimer);
                this.isPinchZooming = true;
                if (this.rfb) {
                    this.rfb.sendMouseEvents(this.lastMouseX || 0, this.lastMouseY || 0, 0);
                }
                e.stopPropagation();
                return;
            }

            if (e.touches.length === 1) {
                this.isPinchZooming = false;
                isLongPress = false;
                isDragging = false;

                const touch = e.touches[0];
                touchStartX = touch.clientX;
                touchStartY = touch.clientY;
                touchStartTime = Date.now();
                initialScrollX = screen.scrollLeft;
                initialScrollY = screen.scrollTop;

                const rect = canvas.getBoundingClientRect();
                const visualX = touch.clientX - rect.left;
                const visualY = touch.clientY - rect.top;
                const remoteW = this.remoteResolution.width || canvas.width;
                const remoteH = this.remoteResolution.height || canvas.height;
                const targetX = Math.round(visualX * (remoteW / rect.width));
                const targetY = Math.round(visualY * (remoteH / rect.height));

                this.lastMouseX = targetX;
                this.lastMouseY = targetY;

                // Langsung sinkronkan posisi kursor remote
                if (this.rfb) {
                    this.rfb.sendMousePositions(targetX, targetY);
                }

                // Long-Press timer untuk Klik Kanan (500ms tanpa bergeser)
                if (longPressTimer) clearTimeout(longPressTimer);
                longPressTimer = setTimeout(() => {
                    isLongPress = true;
                    if (this.rfb) {
                        this.rfb.sendMousePositions(targetX, targetY);
                        this.rfb.sendMouseEvents(targetX, targetY, 4); // Right click down
                        setTimeout(() => {
                            if (this.rfb) this.rfb.sendMouseEvents(targetX, targetY, 0); // Right click up
                        }, 50);

                        if (navigator.vibrate) {
                            try { navigator.vibrate(50); } catch(err) {}
                        }
                        Toast.info('Klik Kanan (Right-Click)');
                    }
                }, 500);

                e.stopPropagation();
            }
        }, { capture: true, passive: false });

        canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length >= 2 || this.isPinchZooming) {
                if (longPressTimer) clearTimeout(longPressTimer);
                e.stopPropagation();
                return;
            }

            if (e.touches.length === 1) {
                const touch = e.touches[0];
                const dx = touch.clientX - touchStartX;
                const dy = touch.clientY - touchStartY;
                const dist = Math.hypot(dx, dy);

                // Jika pergeseran jari > 8px, ini adalah gesture pan/scroll, bukan tap
                if (dist > 8) {
                    if (longPressTimer) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                    }
                    isDragging = true;

                    // Jika sedang zoom in (> 1.0x) atau mode 1:1, geser scroll layar (Pan Viewport)
                    if (this.zoomLevel > 1.0 || !this.scaleFactor) {
                        screen.scrollLeft = initialScrollX - dx;
                        screen.scrollTop = initialScrollY - dy;
                        e.preventDefault();
                    }
                }

                e.stopPropagation();
            }
        }, { capture: true, passive: false });

        canvas.addEventListener('touchend', (e) => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }

            if (this.isPinchZooming) {
                if (e.touches.length === 0) {
                    this.isPinchZooming = false;
                }
                e.stopPropagation();
                return;
            }

            // Jika sudah memicu Long-Press atau sedang dragging pan, batalkan tap left-click
            if (isLongPress || isDragging) {
                e.stopPropagation();
                e.preventDefault();
                return;
            }

            if (e.changedTouches.length === 1 && this.rfb) {
                const touch = e.changedTouches[0];
                const elapsed = Date.now() - touchStartTime;
                const dx = touch.clientX - touchStartX;
                const dy = touch.clientY - touchStartY;
                const dist = Math.hypot(dx, dy);

                // Tap Cepat Responsif (< 400ms dan dist < 12px)
                if (elapsed < 400 && dist < 12) {
                    const rect = canvas.getBoundingClientRect();
                    const visualX = touch.clientX - rect.left;
                    const visualY = touch.clientY - rect.top;
                    const remoteW = this.remoteResolution.width || canvas.width;
                    const remoteH = this.remoteResolution.height || canvas.height;
                    const targetX = Math.round(visualX * (remoteW / rect.width));
                    const targetY = Math.round(visualY * (remoteH / rect.height));

                    this.lastMouseX = targetX;
                    this.lastMouseY = targetY;

                    // Kirim posisi + Left Click Down + Left Click Up secara instan
                    this.rfb.sendMousePositions(targetX, targetY);
                    this.rfb.sendMouseEvents(targetX, targetY, 1);
                    setTimeout(() => {
                        if (this.rfb) {
                            this.rfb.sendMouseEvents(targetX, targetY, 0);
                        }
                    }, 35);

                    e.preventDefault();
                }

                e.stopPropagation();
            }
        }, { capture: true, passive: false });
    },

    // Pinch to Zoom Terpusat pada Titik Cubitan Jari (Focal Point)
    setupPinchToZoom() {
        const container = document.getElementById('vnc-container');
        const screen = document.getElementById('vnc-screen');
        if (!container || !screen) return;

        if (container.dataset.pinchListenerV2Attached) return;
        container.dataset.pinchListenerV2Attached = 'true';

        let touchStartDist = 0;
        let startZoom = 1.0;
        let initialFocalX = 0;
        let initialFocalY = 0;

        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                this.isPinchZooming = true;
                touchStartDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                startZoom = this.zoomLevel;

                initialFocalX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                initialFocalY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                e.stopPropagation();
            }
        }, { capture: true, passive: false });

        container.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && touchStartDist > 0) {
                e.preventDefault();
                e.stopImmediatePropagation();
                e.stopPropagation();

                const currentDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                
                const currentFocalX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const currentFocalY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

                const canvas = screen.querySelector('canvas');
                if (!canvas) return;

                const rect = canvas.getBoundingClientRect();
                const relX = (currentFocalX - rect.left) / rect.width;
                const relY = (currentFocalY - rect.top) / rect.height;

                let newZoom = startZoom * (currentDist / touchStartDist);
                newZoom = Math.max(1.0, Math.min(3.5, newZoom));
                this.zoomLevel = newZoom;
                
                if (newZoom > 1.0) {
                    screen.className = 'w-full h-full overflow-auto block scrollbar-mono';
                } else {
                    if (this.scaleFactor) {
                        screen.className = 'w-full h-full overflow-hidden flex items-center justify-center';
                    } else {
                        screen.className = 'w-full h-full overflow-auto block scrollbar-mono';
                    }
                }

                this.applyZoom();

                const newRect = canvas.getBoundingClientRect();
                screen.scrollLeft = (relX * newRect.width) - (currentFocalX - screen.getBoundingClientRect().left);
                screen.scrollTop = (relY * newRect.height) - (currentFocalY - screen.getBoundingClientRect().top);
            }
        }, { capture: true, passive: false });

        container.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                touchStartDist = 0;
                if (e.touches.length === 0) {
                    this.isPinchZooming = false;
                }
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
