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
        this.lastRemoteClipboard = '';
        this.onClipboardCallback = this.options.onClipboard || null;
        this._boundKeyDown = null;
        this._boundPasteHandler = null;
        this._lastToastMsg = '';
        this._lastToastTime = 0;
        this._isPhysicalCtrlDown = false;
        this._isPastingSequence = false;
        this._lastPasteTimestamp = 0;
        this._pasteSeqId = 0;
        this._currentPasteSeqId = 0;
        this._lastHandledPasteSeqId = 0;
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
                this.setupClipboardShortcuts();

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

            this.rfb.addEventListener('clipboard', (e) => {
                const text = (e && e.detail && typeof e.detail.text === 'string') ? e.detail.text : '';
                this.lastRemoteClipboard = text;
                this.copyTextToHost(text, true);
                if (typeof this.onClipboardCallback === 'function') {
                    this.onClipboardCallback(text);
                }
                window.dispatchEvent(new CustomEvent('vnc-clipboard-received', { detail: { text, session: this } }));

                // Saat remote menyelesaikan Ctrl+C (mengirim clipboard), pastikan Ctrl tidak tertinggal aktif di remote
                // HANYA lepaskan jika user sudah tidak lagi menekan Ctrl secara fisik di keyboard
                if (!this._isPhysicalCtrlDown && !this.modifiers['Ctrl']) {
                    setTimeout(() => {
                        if (this.rfb && !this._isPhysicalCtrlDown && !this.modifiers['Ctrl']) {
                            try {
                                this.rfb.sendKey(0xffe3, 'ControlLeft', false);
                                this.rfb.sendKey(0xffe4, 'ControlRight', false);
                            } catch(e) {}
                        }
                    }, 50);
                }
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
        this.teardownClipboardShortcuts();
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

    sendClipboard(text) {
        if (!this.rfb) return false;
        try {
            this.rfb.clipboardPasteFrom(text);
            return true;
        } catch (e) {
            console.error('[VNC] Error sending clipboard to remote:', e);
            return false;
        }
    }

    getRemoteClipboard() {
        return this.lastRemoteClipboard || '';
    }

    async readHostClipboard() {
        if (navigator.clipboard && navigator.clipboard.readText) {
            try {
                return await navigator.clipboard.readText();
            } catch (e) {
                console.warn('[VNC] Clipboard readText error:', e);
            }
        }
        return null;
    }

    executePasteSequence() {
        if (!this.rfb) return;

        const ctrl = 0xffe3;
        const vKey = 0x0076; // XK_v

        // Kembalikan fokus ke canvas segera jika bridgeEl sempat tersentuh
        if (this.bridgeEl && document.activeElement === this.bridgeEl) {
            try { this.bridgeEl.blur(); } catch (e) {}
        }
        try { this.rfb.focus(); } catch (e) {}

        // Jeda singkat 35ms agar paket ClientCutText tiba di TightVNC server via WebSocket sebelum tombol ditekan
        setTimeout(() => {
            if (!this.rfb) return;

            // Tahap 1: Pastikan Ctrl aktif di remote
            this.rfb.sendKey(ctrl, 'ControlLeft', true);

            setTimeout(() => {
                if (!this.rfb) return;

                // Tahap 2: Tekan tombol V (Ctrl sudah aktif di remote)
                this.rfb.sendKey(vKey, 'KeyV', true);

                setTimeout(() => {
                    if (!this.rfb) return;

                    // Tahap 3: Lepaskan V terlebih dahulu (Ctrl tetap ditahan)
                    this.rfb.sendKey(vKey, 'KeyV', false);

                    setTimeout(() => {
                        if (!this.rfb) return;

                        // Tahap 4: JANGAN lepaskan Ctrl jika user masih menekan tombol fisik Ctrl di keyboard
                        // atau jika modifier Ctrl di toolbar sedang aktif!
                        // Dengan mempertahankan Ctrl DOWN, user bisa langsung menekan Ctrl+A atau Ctrl+V berulang kali.
                        if (this._isPhysicalCtrlDown || this.modifiers['Ctrl']) {
                            this.rfb.sendKey(ctrl, 'ControlLeft', true);
                        } else {
                            this.rfb.sendKey(ctrl, 'ControlLeft', false);
                        }
                    }, 20);
                }, 25);
            }, 25);
        }, 35);
    }

    sendCtrlKeySequence(keysym, keyName) {
        if (!this.rfb) return;
        const ctrl = 0xffe3;
        try {
            this.rfb.sendKey(ctrl, 'ControlLeft', true);
            setTimeout(() => {
                if (!this.rfb) return;
                this.rfb.sendKey(keysym, keyName, true);
                setTimeout(() => {
                    if (!this.rfb) return;
                    this.rfb.sendKey(keysym, keyName, false);
                    setTimeout(() => {
                        if (!this.rfb) return;
                        if (this._isPhysicalCtrlDown || this.modifiers['Ctrl']) {
                            this.rfb.sendKey(ctrl, 'ControlLeft', true);
                        } else {
                            this.rfb.sendKey(ctrl, 'ControlLeft', false);
                        }
                    }, 20);
                }, 25);
            }, 25);
        } catch (e) {
            console.warn('[VNC] Error sending Ctrl key sequence:', e);
        }
    }

    notifyClipboardAction(msg, type = 'info') {
        const now = Date.now();
        if (this._lastToastMsg === msg && (now - (this._lastToastTime || 0)) < 2500) {
            return;
        }
        this._lastToastMsg = msg;
        this._lastToastTime = now;
        if (window.Toast && typeof window.Toast[type] === 'function') {
            window.Toast[type](msg);
        }
    }

    handlePastedText(text) {
        if (!text || !this.rfb) return;

        const now = Date.now();
        // Cegah eksekusi duplikat dalam 120ms jika teks sama persis (misal overlap event)
        if (this._lastPasteTimestamp && (now - this._lastPasteTimestamp < 120) && this.lastRemoteClipboard === text) {
            return;
        }
        this._lastPasteTimestamp = now;

        this.lastRemoteClipboard = text;
        this._lastSentHostText = text;

        // 1. Selalu kirim teks ke clipboard remote VNC via RFB ClientCutText
        this.sendClipboard(text);

        // 2. Sinkronkan ke input text di drawer/modal jika sedang terbuka
        const sendInputs = [
            document.getElementById('vnc-clipboard-send-text'),
            document.getElementById('modal-vnc-clip-send')
        ];
        sendInputs.forEach(inp => { if (inp) inp.value = text; });

        this.notifyClipboardAction('📋 Ditempel dari clipboard host ke remote', 'success');

        // 3. Picu simulasi Ctrl+V yang aman di remote machine
        this.executePasteSequence();
    }

    async pasteHostClipboardToRemote() {
        if (!this.rfb) return false;
        let text = '';
        if (navigator.clipboard && navigator.clipboard.readText) {
            try {
                text = await navigator.clipboard.readText();
            } catch (err) {
                // Ignore failure
            }
        }

        if (text) {
            this.handlePastedText(text);
            return true;
        } else {
            // Jika readText diblokir izin browser, fokuskan bridge untuk menangkap paste native
            if (this.bridgeEl) {
                this.bridgeEl.focus();
                this.bridgeEl.select();
            }
            this.sendCtrlKeySequence(0x0076, 'KeyV');
            return false;
        }
    }

    async copyTextToHost(text, showToast = true) {
        if (!text) return false;
        let copied = false;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                copied = true;
            } catch (err) {
                // Fallback di bawah jika navigator.clipboard gagal
            }
        }

        if (!copied) {
            try {
                const activeBefore = document.activeElement;
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.left = '0';
                ta.style.top = '0';
                ta.style.opacity = '0.01';
                ta.style.pointerEvents = 'none';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                copied = document.execCommand('copy');
                document.body.removeChild(ta);

                // Kembalikan fokus ke canvas agar browser mengirimkan event keyup ke noVNC
                if (this.rfb) {
                    try { this.rfb.focus(); } catch(e) {}
                } else if (activeBefore && typeof activeBefore.focus === 'function') {
                    try { activeBefore.focus(); } catch(e) {}
                }
            } catch (e) {
                console.warn('[VNC] execCommand copy fallback failed:', e);
            }
        }

        if (copied && showToast) {
            this.notifyClipboardAction('📋 Teks dari Remote disalin ke clipboard Host/HP', 'success');
        }
        return copied;
    }

    setupClipboardShortcuts() {
        const container = this.options.vncContainer;
        if (!container) return;

        // Pastikan container memiliki positioning context
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        // Buat bridge textarea di dalam viewport container (bukan off-screen -9999px)
        // Hal ini penting agar Chromium/WebKit mengizinkan event paste native tanpa mengorbankan UI
        if (!this.bridgeEl) {
            this.bridgeEl = document.createElement('textarea');
            this.bridgeEl.id = 'vnc-bridge-' + Math.random().toString(36).substring(2, 8);
            this.bridgeEl.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;opacity:0.01;border:none;margin:0;padding:0;outline:none;background:transparent;color:transparent;overflow:hidden;z-index:10;';
            this.bridgeEl.setAttribute('tabindex', '-1');
            this.bridgeEl.setAttribute('autocomplete', 'off');
            this.bridgeEl.setAttribute('autocorrect', 'off');
            this.bridgeEl.setAttribute('autocapitalize', 'off');
            this.bridgeEl.setAttribute('spellcheck', 'false');
            container.appendChild(this.bridgeEl);

            this._boundBridgePaste = (e) => {
                let text = '';
                if (e.clipboardData) {
                    text = e.clipboardData.getData('text/plain') || e.clipboardData.getData('text') || '';
                }
                if (!text && this.bridgeEl) {
                    text = this.bridgeEl.value;
                }
                if (this.bridgeEl) {
                    this.bridgeEl.value = '';
                    try { this.bridgeEl.blur(); } catch(err) {}
                }
                if (this.rfb) {
                    try { this.rfb.focus(); } catch(err) {}
                }
                if (text) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    this._lastHandledPasteSeqId = this._currentPasteSeqId;
                    this.handlePastedText(text);
                }
            };
            this.bridgeEl.addEventListener('paste', this._boundBridgePaste, true);
        }

        // Listener keydown pada WINDOW (capture phase):
        // Kunci keberhasilan: intersep Ctrl+V tanpa mengganggu shortcut Ctrl lainnya (Ctrl+A, Ctrl+C, dll.)
        this._boundKeyDown = (e) => {
            if (!this.rfb) return;

            const cont = this.options.vncContainer;
            if (!cont || cont.offsetParent === null) return;

            // Jangan intersep jika user sedang mengetik di input / textarea form UI lain (misal modal password, search, dll.)
            const activeEl = document.activeElement;
            const isOtherUIInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && activeEl !== this.bridgeEl;
            if (isOtherUIInput) return;

            // Catat status tombol fisik Ctrl dan pastikan remote menerima sinyal Ctrl aktif
            if (e.ctrlKey || e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight') {
                this._isPhysicalCtrlDown = true;
                if (this.rfb && !this.modifiers['Ctrl']) {
                    try {
                        this.rfb.sendKey(0xffe3, 'ControlLeft', true);
                    } catch(err) {}
                }
            }

            const isCtrlOrCmd = e.ctrlKey || e.metaKey;
            if (!isCtrlOrCmd) return;

            const key = e.key ? e.key.toLowerCase() : '';
            const isV = key === 'v' || e.code === 'KeyV';

            if (isV) {
                // KRUSIAL: Hentikan propagasi ke noVNC canvas agar noVNC TIDAK memanggil stopEvent/preventDefault()
                // JANGAN panggil e.preventDefault() agar browser diizinkan memicu event paste native ke bridgeEl
                e.stopImmediatePropagation();

                const actionId = ++this._pasteSeqId;
                this._currentPasteSeqId = actionId;

                // Siapkan bridgeEl agar siap menangkap paste secara native
                if (this.bridgeEl) {
                    this.bridgeEl.value = '';
                    try {
                        this.bridgeEl.focus();
                        this.bridgeEl.select();
                    } catch(err) {}
                }

                // Cadangan timeout 35ms: HANYA dieksekusi jika bridge paste TIDAK tertangkap oleh event paste native
                setTimeout(async () => {
                    // Jika aksi paste ini SUDAH ditangani oleh _boundBridgePaste, batalkan eksekusi cadangan!
                    if (this._lastHandledPasteSeqId === actionId) {
                        return;
                    }
                    this._lastHandledPasteSeqId = actionId;

                    let text = this.bridgeEl ? this.bridgeEl.value : '';
                    if (this.bridgeEl) {
                        this.bridgeEl.value = '';
                        try { this.bridgeEl.blur(); } catch(e) {}
                    }
                    if (this.rfb) {
                        try { this.rfb.focus(); } catch(e) {}
                    }
                    if (!text && navigator.clipboard && navigator.clipboard.readText) {
                        try {
                            text = await navigator.clipboard.readText();
                        } catch (err) {}
                    }
                    if (text) {
                        this.handlePastedText(text);
                    } else {
                        this.executePasteSequence();
                    }
                }, 35);
            } else if (key === 'c' || e.code === 'KeyC') {
                this.lastCtrlCTime = Date.now();
                // Safety release: jika event keyup Ctrl terlewat saat operasi copy di browser/OS,
                // pastikan modifier Ctrl dilepaskan di remote HANYA jika fisik Ctrl tidak lagi ditekan
                setTimeout(() => {
                    if (this.rfb && !this._isPhysicalCtrlDown && !this.modifiers['Ctrl']) {
                        try {
                            this.rfb.sendKey(0xffe3, 'ControlLeft', false);
                            this.rfb.sendKey(0xffe4, 'ControlRight', false);
                        } catch(err) {}
                    }
                }, 250);
            } else {
                // Untuk shortcut Ctrl lainnya (seperti Ctrl+A, Ctrl+Z, Ctrl+X, dll.):
                // Pastikan remote menerima sinyal Ctrl aktif dan kembalikan fokus ke canvas jika perlu
                if (this.rfb) {
                    try {
                        this.rfb.sendKey(0xffe3, 'ControlLeft', true);
                    } catch(err) {}
                }
                if (this.bridgeEl && document.activeElement === this.bridgeEl) {
                    try { this.bridgeEl.blur(); } catch(e) {}
                    try { this.rfb.focus(); } catch(e) {}
                }
            }
        };
        window.addEventListener('keydown', this._boundKeyDown, true);

        // Listener keyup pada WINDOW (capture phase):
        // Memastikan saat fisik tombol modifier dilepaskan oleh user di mana pun fokus berada,
        // remote VNC SELALU menerima sinyal rilis (up), mencegah Ctrl tersangkut (toggle on terus).
        this._boundKeyUp = (e) => {
            if (!this.rfb) return;

            const cont = this.options.vncContainer;
            if (!cont || cont.offsetParent === null) return;

            const key = e.key ? e.key.toLowerCase() : '';
            const code = e.code || '';

            if (key === 'control' || code === 'ControlLeft' || code === 'ControlRight') {
                this._isPhysicalCtrlDown = false;
                if (!this.modifiers['Ctrl']) {
                    try {
                        this.rfb.sendKey(0xffe3, 'ControlLeft', false);
                        this.rfb.sendKey(0xffe4, 'ControlRight', false);
                    } catch(err) {}
                }
            } else if (key === 'alt' || code === 'AltLeft' || code === 'AltRight') {
                if (!this.modifiers['Alt']) {
                    try {
                        this.rfb.sendKey(0xffe9, 'AltLeft', false);
                        this.rfb.sendKey(0xffea, 'AltRight', false);
                    } catch(err) {}
                }
            } else if (key === 'shift' || code === 'ShiftLeft' || code === 'ShiftRight') {
                if (!this.modifiers['Shift']) {
                    try {
                        this.rfb.sendKey(0xffe1, 'ShiftLeft', false);
                        this.rfb.sendKey(0xffe2, 'ShiftRight', false);
                    } catch(err) {}
                }
            } else if (key === 'meta' || code === 'MetaLeft' || code === 'MetaRight') {
                if (!this.modifiers['Win']) {
                    try {
                        this.rfb.sendKey(0xffeb, 'MetaLeft', false);
                        this.rfb.sendKey(0xffec, 'MetaRight', false);
                    } catch(err) {}
                }
            }
        };
        window.addEventListener('keyup', this._boundKeyUp, true);

        // Native paste event on window (menangkap paste jika canvas/container/bridge aktif)
        this._boundWindowPaste = (e) => {
            if (!this.rfb) return;
            const cont = this.options.vncContainer;
            if (!cont || cont.offsetParent === null) return;

            const activeEl = document.activeElement;
            const isOtherUIInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && activeEl !== this.bridgeEl;
            if (isOtherUIInput) return;

            let text = '';
            if (e.clipboardData) {
                text = e.clipboardData.getData('text/plain') || e.clipboardData.getData('text') || '';
            }
            if (!text && this.bridgeEl && this.bridgeEl.value) {
                text = this.bridgeEl.value;
            }
            if (this.bridgeEl) {
                this.bridgeEl.value = '';
                try { this.bridgeEl.blur(); } catch(err) {}
            }
            if (this.rfb) {
                try { this.rfb.focus(); } catch(err) {}
            }

            if (text) {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (this._currentPasteSeqId && this._lastHandledPasteSeqId === this._currentPasteSeqId) {
                    return;
                }
                this._lastHandledPasteSeqId = this._currentPasteSeqId;
                this.handlePastedText(text);
            }
        };
        window.addEventListener('paste', this._boundWindowPaste, true);

        // Pre-sync clipboard saat user kembali fokus ke tab / klik layar remote
        this._boundPreSync = async () => {
            if (!this.rfb) return;
            const cont = this.options.vncContainer;
            if (!cont || cont.offsetParent === null) return;
            if (navigator.clipboard && navigator.clipboard.readText) {
                try {
                    const text = await navigator.clipboard.readText();
                    if (text && text !== this.lastRemoteClipboard && text !== this._lastSentHostText) {
                        this._lastSentHostText = text;
                        this.sendClipboard(text);
                    }
                } catch (e) {}
            }
        };
        window.addEventListener('focus', this._boundPreSync);
        container.addEventListener('pointerdown', this._boundPreSync);

        // Lepas modifier jika window browser kehilangan fokus (alt-tab, switch window, etc.)
        this._boundWindowBlur = () => {
            this._isPhysicalCtrlDown = false;
            if (!this.modifiers['Ctrl'] && this.rfb) {
                try {
                    this.rfb.sendKey(0xffe3, 'ControlLeft', false);
                    this.rfb.sendKey(0xffe4, 'ControlRight', false);
                } catch(e) {}
            }
        };
        window.addEventListener('blur', this._boundWindowBlur);
    }

    teardownClipboardShortcuts() {
        this._isPhysicalCtrlDown = false;
        const container = this.options.vncContainer;
        if (this._boundKeyDown) {
            window.removeEventListener('keydown', this._boundKeyDown, true);
            this._boundKeyDown = null;
        }
        if (this._boundKeyUp) {
            window.removeEventListener('keyup', this._boundKeyUp, true);
            this._boundKeyUp = null;
        }
        if (this._boundWindowPaste) {
            window.removeEventListener('paste', this._boundWindowPaste, true);
            this._boundWindowPaste = null;
        }
        if (this._boundPreSync) {
            window.removeEventListener('focus', this._boundPreSync);
            if (container) container.removeEventListener('pointerdown', this._boundPreSync);
            this._boundPreSync = null;
        }
        if (this._boundWindowBlur) {
            window.removeEventListener('blur', this._boundWindowBlur);
            this._boundWindowBlur = null;
        }
        if (this.bridgeEl) {
            if (this._boundBridgePaste) {
                this.bridgeEl.removeEventListener('paste', this._boundBridgePaste, true);
                this._boundBridgePaste = null;
            }
            if (this.bridgeEl.parentNode) {
                this.bridgeEl.parentNode.removeChild(this.bridgeEl);
            }
            this.bridgeEl = null;
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
        this._isPhysicalCtrlDown = false;
        if (!this.rfb) return;
        const keys = { 'Ctrl': 0xffe3, 'Alt': 0xffe9, 'Win': 0xffeb, 'Shift': 0xffe1 };
        for (const [key, keysym] of Object.entries(keys)) {
            if (this.modifiers[key]) {
                this.rfb.sendKey(keysym, null, false);
                this.modifiers[key] = false;
            }
        }
        try {
            this.rfb.sendKey(0xffe3, 'ControlLeft', false);
            this.rfb.sendKey(0xffe4, 'ControlRight', false);
        } catch(e) {}
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
    lastReceivedClipboard: '',

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
            },
            onClipboard: (text) => {
                this.lastReceivedClipboard = text;
                const recInput = document.getElementById('vnc-clipboard-received-text');
                if (recInput) recInput.value = text;
                const badge = document.getElementById('vnc-clipboard-status-badge');
                if (badge) {
                    badge.textContent = 'Teks Baru Diterima';
                    badge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
                    setTimeout(() => {
                        badge.textContent = 'Tersinkronisasi';
                        badge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-400 border border-neutral-700';
                    }, 3000);
                }
                Toast.info('📋 Teks disalin dari Remote VNC');
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
                    }).catch(() => {});
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
        const modal = document.getElementById('vnc-clipboard-modal');
        if (modal) modal.classList.add('hidden');
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
            } catch (e) {}
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
