/**
 * VNC Client - Core RFB Session & Clipboard
 */
class VNCSession {
    constructor(options) {
        this.options = Object.assign({
            screenContainer: null, // DOM element for canvas mount
            vncContainer: null,    // wrapper/container element
            wsUrl: '',
            password: '',
            scaleViewport: true,
            onConnect: () => { },
            onDisconnect: () => { },
            onError: () => { },
            onResolution: () => { }
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
        this._isRemoteFileFolder = false;
        this._potentialCopyTimer = null;
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
                dragViewport: false
            });
            try {
                this.rfb.showDotCursor = !isMobile;
            } catch (e) { }
            try {
                this.rfb.background = 'transparent';
            } catch (e) { }

            this.rfb.addEventListener('credentialsrequired', () => {
                const pass = prompt('TightVNC meminta Password:');
                if (pass !== null) {
                    this.rfb.sendCredentials({ password: pass });
                }
            });

            this.rfb.addEventListener('connect', () => {
                if (isMobile && this.rfb._gestures) {
                    try { this.rfb._gestures.detach(); } catch (e) { }
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
                        try { this.rfb.focus(); } catch (e) { }
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

                // Batalkan status copy file/folder karena remote terbukti mengirimkan teks clipboard
                if (this._potentialCopyTimer) {
                    clearTimeout(this._potentialCopyTimer);
                    this._potentialCopyTimer = null;
                }
                this._isRemoteFileFolder = false;

                // Sinkronkan teks dari remote langsung ke clipboard host kasir
                if (text) {
                    this.copyTextToHost(text, false);
                }

                const recInput = document.getElementById('vnc-clipboard-received-text');
                if (recInput) recInput.value = text;

                const badge = document.getElementById('vnc-clipboard-status-badge');
                if (badge && text) {
                    badge.textContent = 'Tersinkronisasi';
                    badge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-emerald-400 border border-emerald-700/50';
                }

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
                            } catch (e) { }
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
            try { this.bridgeEl.blur(); } catch (e) { }
        }
        try { this.rfb.focus(); } catch (e) { }

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
                    try { this.rfb.focus(); } catch (e) { }
                } else if (activeBefore && typeof activeBefore.focus === 'function') {
                    try { activeBefore.focus(); } catch (e) { }
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
                    try { this.bridgeEl.blur(); } catch (err) { }
                }
                if (this.rfb) {
                    try { this.rfb.focus(); } catch (err) { }
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
                    } catch (err) { }
                }
            }

            const isCtrlOrCmd = e.ctrlKey || e.metaKey;
            if (!isCtrlOrCmd) return;

            const key = e.key ? e.key.toLowerCase() : '';
            const isV = key === 'v' || e.code === 'KeyV';
            const isC = key === 'c' || e.code === 'KeyC';
            const isX = key === 'x' || e.code === 'KeyX';

            if (isC || isX) {
                this.lastCtrlCTime = Date.now();
                this._isRemoteFileFolder = false;
                if (this._potentialCopyTimer) clearTimeout(this._potentialCopyTimer);

                // Jika remote tidak mengirimkan teks clipboard dalam 200ms,
                // berarti yang disalin di Windows Explorer remote adalah file/folder
                this._potentialCopyTimer = setTimeout(() => {
                    this._isRemoteFileFolder = true;
                }, 200);

                // Safety release: jika event keyup Ctrl terlewat saat operasi copy di browser/OS,
                // pastikan modifier Ctrl dilepaskan di remote HANYA jika fisik Ctrl tidak lagi ditekan
                setTimeout(() => {
                    if (this.rfb && !this._isPhysicalCtrlDown && !this.modifiers['Ctrl']) {
                        try {
                            this.rfb.sendKey(0xffe3, 'ControlLeft', false);
                            this.rfb.sendKey(0xffe4, 'ControlRight', false);
                        } catch (err) { }
                    }
                }, 250);
            } else if (isV) {
                const isExplicitHostPaste = e.shiftKey || e.altKey;

                // Jika user baru saja menyalin file/folder di remote (bukan teks):
                // Biarkan Ctrl+V diteruskan secara native ke OS remote agar file/folder di-paste!
                if (!isExplicitHostPaste && this._isRemoteFileFolder) {
                    this._isRemoteFileFolder = false;
                    return;
                }

                this._isRemoteFileFolder = false;

                // Intersep Ctrl+V untuk menempelkan teks dari host ke remote secara otomatis
                e.stopImmediatePropagation();

                const actionId = ++this._pasteSeqId;
                this._currentPasteSeqId = actionId;

                // Siapkan bridgeEl agar siap menangkap paste secara native
                if (this.bridgeEl) {
                    this.bridgeEl.value = '';
                    try {
                        this.bridgeEl.focus();
                        this.bridgeEl.select();
                    } catch (err) { }
                }

                // Cadangan timeout 35ms: HANYA dieksekusi jika bridge paste TIDAK tertangkap oleh event paste native
                setTimeout(async () => {
                    if (this._lastHandledPasteSeqId === actionId) {
                        return;
                    }
                    this._lastHandledPasteSeqId = actionId;

                    let text = this.bridgeEl ? this.bridgeEl.value : '';
                    if (this.bridgeEl) {
                        this.bridgeEl.value = '';
                        try { this.bridgeEl.blur(); } catch (e) { }
                    }
                    if (this.rfb) {
                        try { this.rfb.focus(); } catch (e) { }
                    }
                    if (!text && navigator.clipboard && navigator.clipboard.readText) {
                        try {
                            text = await navigator.clipboard.readText();
                        } catch (err) { }
                    }
                    if (text) {
                        this.handlePastedText(text);
                    } else {
                        this.executePasteSequence();
                    }
                }, 35);
                return;
            } else {
                // Untuk shortcut Ctrl lainnya (seperti Ctrl+A, Ctrl+Z, dll.):
                // Pastikan remote menerima sinyal Ctrl aktif dan kembalikan fokus ke canvas jika perlu
                if (this.rfb) {
                    try {
                        this.rfb.sendKey(0xffe3, 'ControlLeft', true);
                    } catch (err) { }
                }
                if (this.bridgeEl && document.activeElement === this.bridgeEl) {
                    try { this.bridgeEl.blur(); } catch (e) { }
                    try { this.rfb.focus(); } catch (e) { }
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
                    } catch (err) { }
                }
            } else if (key === 'alt' || code === 'AltLeft' || code === 'AltRight') {
                if (!this.modifiers['Alt']) {
                    try {
                        this.rfb.sendKey(0xffe9, 'AltLeft', false);
                        this.rfb.sendKey(0xffea, 'AltRight', false);
                    } catch (err) { }
                }
            } else if (key === 'shift' || code === 'ShiftLeft' || code === 'ShiftRight') {
                if (!this.modifiers['Shift']) {
                    try {
                        this.rfb.sendKey(0xffe1, 'ShiftLeft', false);
                        this.rfb.sendKey(0xffe2, 'ShiftRight', false);
                    } catch (err) { }
                }
            } else if (key === 'meta' || code === 'MetaLeft' || code === 'MetaRight') {
                if (!this.modifiers['Win']) {
                    try {
                        this.rfb.sendKey(0xffeb, 'MetaLeft', false);
                        this.rfb.sendKey(0xffec, 'MetaRight', false);
                    } catch (err) { }
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

            // Jika sedang menempel file/folder di remote, biarkan native
            if (this._isRemoteFileFolder) return;

            let text = '';
            if (e.clipboardData) {
                text = e.clipboardData.getData('text/plain') || e.clipboardData.getData('text') || '';
            }
            if (!text && this.bridgeEl && this.bridgeEl.value) {
                text = this.bridgeEl.value;
            }
            if (this.bridgeEl) {
                this.bridgeEl.value = '';
                try { this.bridgeEl.blur(); } catch (err) { }
            }
            if (this.rfb) {
                try { this.rfb.focus(); } catch (err) { }
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

        // Reset flag copy remote saat window host mendapatkan fokus kembali dari luar
        this._boundWindowFocus = () => {
            this._isRemoteFileFolder = false;
        };
        window.addEventListener('focus', this._boundWindowFocus);

        // Lepas modifier jika window browser kehilangan fokus (alt-tab, switch window, etc.)
        this._boundWindowBlur = () => {
            this._isPhysicalCtrlDown = false;
            this._isRemoteFileFolder = false;
            if (this._potentialCopyTimer) {
                clearTimeout(this._potentialCopyTimer);
                this._potentialCopyTimer = null;
            }
            if (!this.modifiers['Ctrl'] && this.rfb) {
                try {
                    this.rfb.sendKey(0xffe3, 'ControlLeft', false);
                    this.rfb.sendKey(0xffe4, 'ControlRight', false);
                } catch (e) { }
            }
        };
        window.addEventListener('blur', this._boundWindowBlur);
    }

    teardownClipboardShortcuts() {
        this._isPhysicalCtrlDown = false;
        if (this._potentialCopyTimer) {
            clearTimeout(this._potentialCopyTimer);
            this._potentialCopyTimer = null;
        }
        this._isRemoteFileFolder = false;
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
        if (this._boundWindowFocus) {
            window.removeEventListener('focus', this._boundWindowFocus);
            this._boundWindowFocus = null;
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
        } catch (e) { }
    }

    focus() {
        if (this.rfb) {
            try { this.rfb.focus(); } catch (e) { }
        }
    }

}
window.VNCSession = VNCSession;
