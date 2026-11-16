/**
 * VNC Client - Touch Gestures, Pan, Zoom, and Canvas Mouse Emulation
 */
if (typeof VNCSession !== 'undefined') {
    Object.assign(VNCSession.prototype, {
    isMobileDevice() {
        const isMobileUA = /Android|iPhone|iPad|iPod|Windows Phone|Mobile/i.test(navigator.userAgent);
        const isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        const isFine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
        if (isFine && !isMobileUA) return false;
        return isMobileUA || isCoarse;
    },

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
                this.rfb._refreshCursor = function () { };
                if (this.rfb._cursor) {
                    try {
                        this.rfb._cursor.detach();
                        this.rfb._cursor.show = function () { };
                        this.rfb._cursor.change = function () { };
                        this.rfb._cursor.move = function () { };
                        if (this.rfb._cursor._canvas) {
                            this.rfb._cursor._canvas.style.display = 'none';
                        }
                    } catch (e) { }
                }
            }
        } else {
            if (container) container.classList.remove('vnc-mobile-mode');
            if (canvas) canvas.style.cursor = 'default';
            if (this.rfb) {
                this.rfb.showDotCursor = true;
            }
        }
    },

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
    },

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
    },
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
    },

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
    },

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
                try { this.rfb.focus(); } catch (e) { }
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
    },

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
                        try { navigator.vibrate(50); } catch (err) { }
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
                            try { navigator.vibrate([25, 35, 25]); } catch (err) { }
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
    },

    });
}
