// vnc_client.js — Reusable VNC Session and Client Remote Control for TMBilling

class VNCSession {
    constructor(options) {
        this.options = Object.assign({
            screenContainer: null, // DOM element for canvas mount
            vncContainer: null,    // wrapper/container element
            wsUrl: '',
            password: '',
            scaleViewport: true,
            onConnect: () => {},
            onDisconnect: () => {},
            onError: () => {},
            onResolution: () => {}
        }, options);

        this.rfb = null;
        this.scaleFactor = this.options.scaleViewport;
        this.zoomLevel = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.isPinchZooming = false;
        this.modifiers = { Ctrl: false, Alt: false, Win: false, Shift: false };
        this.remoteResolution = { width: 0, height: 0 };
        this.resizeObserver = null;
        this.keyboardLayout = 'letters';
        this.shiftActive = false;
    }

    isMobileDevice() {
        const isMobileUA = /Android|iPhone|iPad|iPod|Windows Phone|Mobile/i.test(navigator.userAgent);
        const isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        const isFine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
        if (isFine && !isMobileUA) return false;
        return isMobileUA || isCoarse;
    }

    enforceMobileCursorBehavior() {
        const container = this.options.vncContainer;
        const screen = this.options.screenContainer;
        const canvas = screen ? screen.querySelector('canvas') : null;
        const isMobile = this.isMobileDevice();

        if (isMobile) {
            if (container) container.classList.add('vnc-mobile-mode');
            if (canvas) canvas.style.cursor = 'none';
            if (this.rfb) {
                this.rfb.showDotCursor = false;
                this.rfb._refreshCursor = function() {};
                if (this.rfb._cursor) {
                    try {
                        this.rfb._cursor.detach();
                        this.rfb._cursor.show = function() {};
                        this.rfb._cursor.change = function() {};
                        this.rfb._cursor.move = function() {};
                        if (this.rfb._cursor._canvas) {
                            this.rfb._cursor._canvas.style.display = 'none';
                        }
                    } catch(e) {}
                }
            }
        } else {
            if (container) container.classList.remove('vnc-mobile-mode');
            if (canvas) canvas.style.cursor = 'default';
            if (this.rfb) {
                this.rfb.showDotCursor = true;
            }
        }
    }

    dispatchCanvasMouse(type, clientX, clientY, button = 0, buttons = 0, detail = 1) {
        const screen = this.options.screenContainer;
        if (!screen) return;
        const canvas = screen.querySelector('canvas');
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const relX = (clientX - rect.left) / rect.width;
        const relY = (clientY - rect.top) / rect.height;

        const clampedRelX = Math.max(0, Math.min(1, relX));
        const clampedRelY = Math.max(0, Math.min(1, relY));

        const baseW = canvas.offsetWidth || (rect.width / (this.zoomLevel || 1.0));
        const baseH = canvas.offsetHeight || (rect.height / (this.zoomLevel || 1.0));

        const syntheticClientX = rect.left + (clampedRelX * baseW);
        const syntheticClientY = rect.top + (clampedRelY * baseH);

        const ev = new MouseEvent(type, {
            clientX: syntheticClientX,
            clientY: syntheticClientY,
            button: button,
            buttons: buttons,
            detail: detail,
            bubbles: true,
            cancelable: true,
            view: window
        });
        canvas.dispatchEvent(ev);
    }

    dispatchCanvasWheel(clientX, clientY, deltaY) {
        const screen = this.options.screenContainer;
        if (!screen) return;
        const canvas = screen.querySelector('canvas');
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const relX = (clientX - rect.left) / rect.width;
        const relY = (clientY - rect.top) / rect.height;

        const clampedRelX = Math.max(0, Math.min(1, relX));
        const clampedRelY = Math.max(0, Math.min(1, relY));

        const baseW = canvas.offsetWidth || (rect.width / (this.zoomLevel || 1.0));
        const baseH = canvas.offsetHeight || (rect.height / (this.zoomLevel || 1.0));

        const syntheticClientX = rect.left + (clampedRelX * baseW);
        const syntheticClientY = rect.top + (clampedRelY * baseH);

        const ev = new WheelEvent('wheel', {
            clientX: syntheticClientX,
            clientY: syntheticClientY,
            deltaY: deltaY,
            deltaMode: 0,
            bubbles: true,
            cancelable: true,
            view: window
        });
        canvas.dispatchEvent(ev);
    }

    async connect() {
        const RFBClass = await VNCClient.getRFB();
        if (!RFBClass) {
            this.options.onError(new Error('Gagal memuat modul noVNC'));
            return;
        }

        const isMobile = this.isMobileDevice();
        try {
            if (this.options.screenContainer) {
                this.options.screenContainer.innerHTML = '';
            }

            this.rfb = new RFBClass(this.options.screenContainer, this.options.wsUrl, {
                credentials: { password: this.options.password },
                scaleViewport: this.scaleFactor,
                clipViewport: false,
                dragViewport: false,
                showDotCursor: !isMobile
            });
            try {
                this.rfb.background = 'transparent';
            } catch(e) {}

            this.rfb.addEventListener('credentialsrequired', () => {
                const pass = prompt('TightVNC meminta Password:');
                if (pass !== null) {
                    this.rfb.sendCredentials({ password: pass });
                }
            });

            this.rfb.addEventListener('connect', () => {
                if (isMobile && this.rfb._gestures) {
                    try { this.rfb._gestures.detach(); } catch(e) {}
                }
                this.zoomLevel = 1.0;
                this.panX = 0;
                this.panY = 0;
                this.isPinchZooming = false;
                this.enforceMobileCursorBehavior();
                this.applyDisplayMode();
                this.setupResizeObserver();
                this.setupCanvasTouchEmulation();

                setTimeout(() => {
                    if (this.rfb) {
                        try { this.rfb.focus(); } catch(e) {}
                    }
                }, 50);

                this.options.onConnect();
            });

            this.rfb.addEventListener('firstframe', () => {
                this.updateResolutionInfo();
                this.enforceMobileCursorBehavior();
                this.applyDisplayMode();
            });

            this.rfb.addEventListener('desktopname', () => {
                this.updateResolutionInfo();
            });

            this.rfb.addEventListener('disconnect', (e) => {
                if (this.resizeObserver) {
                    this.resizeObserver.disconnect();
                    this.resizeObserver = null;
                }
                this.releaseAllModifiers();
                this.options.onDisconnect(e);
            });

        } catch (err) {
            this.options.onError(err);
        }
    }

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
        const container = this.options.vncContainer;
        if (container) {
            container.removeAttribute('data-unified-touch-attached');
            const newContainer = container.cloneNode(true);
            if (container.parentNode) {
                container.parentNode.replaceChild(newContainer, container);
            }
            this.options.vncContainer = newContainer;
            if (this.options.screenContainer) {
                const screenId = this.options.screenContainer.id;
                const newScreen = newContainer.querySelector(`#${screenId}`) || document.getElementById(screenId);
                if (newScreen) {
                    this.options.screenContainer = newScreen;
                    newScreen.innerHTML = '';
                }
            }
        } else if (this.options.screenContainer) {
            this.options.screenContainer.innerHTML = '';
        }
    }

    updateResolutionInfo() {
        if (!this.rfb) return;
        const w = this.rfb._fbWidth || (this.rfb._display ? this.rfb._display._fbWidth : 0);
        const h = this.rfb._fbHeight || (this.rfb._display ? this.rfb._display._fbHeight : 0);
        if (w > 0 && h > 0) {
            this.remoteResolution = { width: w, height: h };
            this.options.onResolution(w, h);
        }
    }

    getPanBounds(zoom) {
        const container = this.options.vncContainer;
        const screen = this.options.screenContainer;
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

        return { minX: -maxPanX, maxX: maxPanX, minY: -maxPanY, maxY: maxPanY };
    }

    applyTransform(animate = false) {
        const screen = this.options.screenContainer;
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
    }

    applyDisplayMode() {
        const screen = this.options.screenContainer;
        if (this.scaleFactor) {
            if (screen) screen.className = 'w-full h-full overflow-hidden flex items-center justify-center';
            if (this.rfb) this.rfb.scaleViewport = true;
        } else {
            if (screen) screen.className = 'w-full h-full overflow-auto block scrollbar-mono';
            if (this.rfb) this.rfb.scaleViewport = false;
        }
        this.enforceMobileCursorBehavior();
        this.applyTransform(false);

        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
            if (this.rfb) {
                try { this.rfb.focus(); } catch (e) {}
            }
        }, 30);
    }

    toggleScale() {
        this.scaleFactor = !this.scaleFactor;
        this.zoomLevel = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.applyDisplayMode();
    }

    setupResizeObserver() {
        if (this.resizeObserver) this.resizeObserver.disconnect();
        const container = this.options.vncContainer;
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
    }

    setupCanvasTouchEmulation() {
        const container = this.options.vncContainer;
        const screen = this.options.screenContainer;
        if (!container || !screen) return;

        if (container.dataset.unifiedTouchAttached) return;
        container.dataset.unifiedTouchAttached = 'true';

        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;
        let lastScrollTouchY = 0;
        let isScrolling = false;
        let longPressTimer = null;
        let isLongPress = false;
        let isDragging = false;

        let lastTapTime = 0;
        let lastTapX = 0;
        let lastTapY = 0;

        let touchStartDist = 0;
        let startZoom = 1.0;
        let startPanX = 0;
        let startPanY = 0;
        let startMidX = 0;
        let startMidY = 0;

        container.addEventListener('touchstart', (e) => {
            const canvas = screen.querySelector('canvas');
            if (!canvas) return;

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

            if (e.touches.length === 1) {
                this.isPinchZooming = false;
                isLongPress = false;
                isDragging = false;
                isScrolling = false;

                const touch = e.touches[0];
                touchStartX = touch.clientX;
                touchStartY = touch.clientY;
                lastScrollTouchY = touch.clientY;
                touchStartTime = Date.now();
                startPanX = this.panX;
                startPanY = this.panY;

                this.dispatchCanvasMouse('mousemove', touch.clientX, touch.clientY, 0, 0);

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

        container.addEventListener('touchmove', (e) => {
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

            if (e.touches.length === 1) {
                if (this.isPinchZooming) return;
                const touch = e.touches[0];
                const dx = touch.clientX - touchStartX;
                const dy = touch.clientY - touchStartY;
                const dist = Math.hypot(dx, dy);

                if (dist > 12) {
                    if (longPressTimer) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                    }
                    isDragging = true;

                    // 1-finger vertical sweep gesture for mouse wheel scroll (berlaku di semua zoom level)
                    const scrollDy = touch.clientY - lastScrollTouchY;
                    if (Math.abs(scrollDy) >= 15) {
                        isScrolling = true;
                        // Jari sapu ke atas (scrollDy < 0) -> scroll halaman ke bawah (deltaY > 0)
                        // Jari sapu ke bawah (scrollDy > 0) -> scroll halaman ke atas (deltaY < 0)
                        const deltaY = scrollDy < 0 ? 100 : -100;
                        this.dispatchCanvasWheel(touch.clientX, touch.clientY, deltaY);
                        lastScrollTouchY = touch.clientY;
                    }

                    e.preventDefault();
                }
                e.stopPropagation();
            }
        }, { capture: true, passive: false });

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

            if (isLongPress || isDragging || isScrolling) {
                e.stopPropagation();
                e.preventDefault();
                return;
            }

            if (e.changedTouches.length === 1) {
                const touch = e.changedTouches[0];
                const now = Date.now();
                const elapsed = now - touchStartTime;
                const dx = touch.clientX - touchStartX;
                const dy = touch.clientY - touchStartY;
                const dist = Math.hypot(dx, dy);

                if (elapsed < 450 && dist < 15) {
                    const timeSinceLastTap = now - lastTapTime;
                    const distFromLastTap = Math.hypot(touch.clientX - lastTapX, touch.clientY - lastTapY);

                    if (timeSinceLastTap < 400 && distFromLastTap < 30) {
                        const targetX = lastTapX;
                        const targetY = lastTapY;
                        this.dispatchCanvasMouse('mousemove', targetX, targetY, 0, 0);
                        this.dispatchCanvasMouse('mousedown', targetX, targetY, 0, 1, 2);
                        setTimeout(() => {
                            this.dispatchCanvasMouse('mouseup', targetX, targetY, 0, 0, 2);
                        }, 30);

                        if (navigator.vibrate) {
                            try { navigator.vibrate([25, 35, 25]); } catch(err) {}
                        }
                        lastTapTime = 0;
                        lastTapX = 0;
                        lastTapY = 0;
                    } else {
                        lastTapTime = now;
                        lastTapX = touch.clientX;
                        lastTapY = touch.clientY;

                        this.dispatchCanvasMouse('mousemove', touch.clientX, touch.clientY, 0, 0);
                        this.dispatchCanvasMouse('mousedown', touch.clientX, touch.clientY, 0, 1, 1);
                        setTimeout(() => {
                            this.dispatchCanvasMouse('mouseup', touch.clientX, touch.clientY, 0, 0, 1);
                        }, 30);
                    }
                    e.preventDefault();
                }
                e.stopPropagation();
            }
        }, { capture: true, passive: false });
    }

    sendKey(keysym, name, down) {
        if (this.rfb) {
            this.rfb.sendKey(keysym, name, down);
        }
    }

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

        this.rfb.sendKey(keysym, null, active);
        return active;
    }

    releaseAllModifiers() {
        if (!this.rfb) return;
        const keys = { 'Ctrl': 0xffe3, 'Alt': 0xffe9, 'Win': 0xffeb, 'Shift': 0xffe1 };
        for (const [key, keysym] of Object.entries(keys)) {
            if (this.modifiers[key]) {
                this.rfb.sendKey(keysym, null, false);
                this.modifiers[key] = false;
            }
        }
    }

    focus() {
        if (this.rfb) {
            try { this.rfb.focus(); } catch(e) {}
        }
    }



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
    }

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
    }

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
    }

    toggleVirtualKeyboard(kbId, prefix = '') {
        const kb = document.getElementById(kbId);
        if (!kb) return;
        if (kb.classList.contains('hidden')) {
            kb.classList.remove('hidden');
            this.switchKeyboardLayout('letters', prefix);
        } else {
            kb.classList.add('hidden');
        }
    }

    switchKeyboardLayout(layout, prefix = '') {
        this.keyboardLayout = layout;
        const tabLetters = document.getElementById(`${prefix}kb-tab-letters`);
        const tabSymbols = document.getElementById(`${prefix}kb-tab-symbols`);
        const tabFunction = document.getElementById(`${prefix}kb-tab-function`);

        const activeClass = 'px-3 py-1 text-[10px] font-bold rounded bg-neutral-200 text-black transition-colors';
        const inactiveClass = 'px-3 py-1 text-[10px] font-bold rounded bg-[#171717] border border-[#262626] text-neutral-400 hover:bg-[#222] transition-colors';

        if (tabLetters) tabLetters.className = layout === 'letters' ? activeClass : inactiveClass;
        if (tabSymbols) tabSymbols.className = layout === 'symbols' ? activeClass : inactiveClass;
        if (tabFunction) tabFunction.className = layout === 'function' ? activeClass : inactiveClass;

        this.renderKeyboardKeys(`${prefix}kb-keys-grid`, prefix);
    }

    toggleKeyboardShift(gridId, prefix = '') {
        this.shiftActive = !this.shiftActive;
        this.renderKeyboardKeys(gridId, prefix);
    }

    renderKeyboardKeys(gridId, prefix = '') {
        const grid = document.getElementById(gridId);
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
                    this.bindVirtualKeyEvents(btn, key, gridId, prefix);
                } else {
                    label = key.label;
                    if (key.style) btnClass += ' ' + key.style;
                    this.bindVirtualKeyEvents(btn, key, gridId, prefix);
                }

                btn.className = btnClass;
                btn.textContent = label;
                rowDiv.appendChild(btn);
            });
            grid.appendChild(rowDiv);
        });
    }

    bindVirtualKeyEvents(btn, charOrKeyInfo, gridId, prefix = '') {
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
                    this.toggleKeyboardShift(gridId, prefix);
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
            btn.classList.add('bg-neutral-200', 'text-black', 'border-white');
            btn.classList.remove('bg-[#141414]', 'text-neutral-200', 'border-[#222]', 'bg-[#222]');
            this.sendKey(keysym, null, true);
        };

        const handleRelease = (e) => {
            e.preventDefault();
            btn.classList.remove('bg-neutral-200', 'text-black', 'border-white');
            if (typeof charOrKeyInfo !== 'string' && charOrKeyInfo.style && charOrKeyInfo.style.includes('bg-[#222]')) {
                btn.classList.add('bg-[#222]', 'text-neutral-200', 'border-[#222]');
            } else {
                btn.classList.add('bg-[#141414]', 'text-neutral-200', 'border-[#222]');
            }
            this.sendKey(keysym, null, false);

            if (isChar && this.shiftActive && this.keyboardLayout === 'letters') {
                this.shiftActive = false;
                this.renderKeyboardKeys(gridId, prefix);
            }
        };

        btn.addEventListener('pointerdown', handlePress);
        btn.addEventListener('pointerup', handleRelease);
        btn.addEventListener('pointerleave', handleRelease);
        btn.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    }

    sendShortcutPreset(preset) {
        if (preset === 'Win+R') {
            this.sendKey(0xffeb, null, true);
            this.sendKey('r'.charCodeAt(0), null, true);
            this.sendKey('r'.charCodeAt(0), null, false);
            this.sendKey(0xffeb, null, false);
        } else if (preset === 'Win+D') {
            this.sendKey(0xffeb, null, true);
            this.sendKey('d'.charCodeAt(0), null, true);
            this.sendKey('d'.charCodeAt(0), null, false);
            this.sendKey(0xffeb, null, false);
        } else if (preset === 'Alt+Tab') {
            this.sendKey(0xffe9, null, true);
            this.sendKey(0xff09, null, true);
            this.sendKey(0xff09, null, false);
            this.sendKey(0xffe9, null, false);
        } else if (preset === 'Alt+F4') {
            this.sendKey(0xffe9, null, true);
            this.sendKey(0xffbe, null, true);
            this.sendKey(0xffbe, null, false);
            this.sendKey(0xffe9, null, false);
        }
    }

    sendSpecialKey(keysym) {
        this.sendKey(keysym, null, true);
        this.sendKey(keysym, null, false);
    }
}

const VNCClient = {
    rfb: null,
    scaleFactor: true,
    RFBClass: null,
    session: null,
    keyboardLayout: 'letters',
    shiftActive: false,
    remoteResolution: { width: 0, height: 0 },

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
        try {
            const startRes = await API.request('/api/v1/kasir/vnc/start', { method: 'POST' });
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
