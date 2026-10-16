/**
 * Dashboard Detail Modal - Remote Control & VNC Viewer Sub-module
 * Menangani embedded VNC RFB viewer, streaming, fullscreen screenshot preview, dan clipboard sync.
 */
window.DashboardModalRemote = {
    viewFullscreen(imgEl) {
        if (!imgEl || !imgEl.src) return;
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4 cursor-pointer animate-in';
        overlay.onclick = () => overlay.remove();
        overlay.innerHTML = `
            <div class="relative w-full h-full flex items-center justify-center">
                <button class="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 border border-white/10 text-white/60 hover:text-white hover:bg-black/70 flex items-center justify-center text-xl leading-none transition-all z-10">&times;</button>
                <img src="${imgEl.src}" class="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
            </div>
        `;
        document.body.appendChild(overlay);
    },

    openRemoteView: function(pcId, pcKode) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        this.currentPcId = pcId;
        const modalBox = document.getElementById('pc-detail-modal-card');
        if (modalBox) {
            modalBox.classList.remove('max-w-lg');
            modalBox.classList.add('max-w-5xl');
        }

        const menu = document.getElementById('view-action-menu');
        const vncView = document.getElementById('view-remote-client');
        const hwView = document.getElementById('view-hardware-specs');
        const procView = document.getElementById('view-process-list');
        if (menu) menu.classList.add('hidden');
        if (hwView) hwView.classList.add('hidden');
        if (procView) procView.classList.add('hidden');
        if (vncView) vncView.classList.remove('hidden');
        document.getElementById('modal-card-main-footer')?.classList.add('hidden');

        const statusBadge = document.getElementById('modal-vnc-status-badge');
        if (statusBadge) {
            statusBadge.textContent = 'Terputus';
            statusBadge.className = 'px-2 py-1 rounded text-xs font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700';
        }

        const resBadge = document.getElementById('modal-vnc-resolution');
        if (resBadge) resBadge.classList.add('hidden');

        const placeholder = document.getElementById('modal-vnc-placeholder');
        if (placeholder) placeholder.classList.remove('hidden');

        const connectBtn = document.getElementById('modal-vnc-connect-btn');
        if (connectBtn) connectBtn.classList.remove('hidden');

        const disconnectBtn = document.getElementById('modal-vnc-disconnect-btn');
        if (disconnectBtn) disconnectBtn.classList.add('hidden');

        const kbBtn = document.getElementById('modal-vnc-keyboard-btn');
        if (kbBtn) kbBtn.classList.add('opacity-40', 'cursor-not-allowed');

        const kb = document.getElementById('modal-vnc-virtual-keyboard');
        if (kb) kb.classList.add('hidden');
    },

    startRemote: async function(pcId, pcKode) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        const loading = document.getElementById('modal-vnc-loading');
        if (loading) loading.classList.remove('hidden');

        const connectBtn = document.getElementById('modal-vnc-connect-btn');
        if (connectBtn) connectBtn.classList.add('hidden');

        try {
            const res = await API.request(`/api/v1/kasir/monitor/vnc_client/${pcId}/start`, { method: 'POST' });
            if (!res || !res.success) {
                throw new Error((res && res.error) || 'Gagal memulai VNC di client');
            }

            const token = res.token || `client_${pcId}`;
            const port = res.port || 8081;
            let url = (typeof VNCClient !== 'undefined' && VNCClient.resolveWebSocketUrl)
                ? VNCClient.resolveWebSocketUrl(token, port)
                : (window.location.protocol === 'https:'
                    ? `wss://${window.location.host}/ws/vnc?token=${encodeURIComponent(token)}`
                    : `ws://${window.location.hostname}:${port}/?token=${encodeURIComponent(token)}`);

            const screen = document.getElementById('modal-vnc-screen');
            const container = document.getElementById('modal-vnc-container');
            const placeholder = document.getElementById('modal-vnc-placeholder');
            const statusBadge = document.getElementById('modal-vnc-status-badge');
            const disconnectBtn = document.getElementById('modal-vnc-disconnect-btn');
            const kbBtn = document.getElementById('modal-vnc-keyboard-btn');
            const clipBtn = document.getElementById('modal-vnc-clip-btn');

            this.vncSession = VNCClient.createSession({
                screenContainer: screen,
                vncContainer: container,
                wsUrl: url,
                password: res.vnc_password,
                scaleViewport: true,
                onConnect: () => {
                    if (loading) loading.classList.add('hidden');
                    if (placeholder) placeholder.classList.add('hidden');
                    if (statusBadge) {
                        statusBadge.textContent = 'Terhubung';
                        statusBadge.className = 'px-2 py-1 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
                    }
                    if (disconnectBtn) disconnectBtn.classList.remove('hidden');
                    if (kbBtn) kbBtn.classList.remove('opacity-40', 'cursor-not-allowed');
                    if (clipBtn) clipBtn.classList.remove('opacity-40', 'cursor-not-allowed');
                    Toast.success(`Remote Control PC ${pcKode} aktif!`);
                },
                onDisconnect: (e) => {
                    if (loading) loading.classList.add('hidden');
                    const isAbnormal = e && e.detail && !e.detail.clean;
                    if (isAbnormal) {
                        Toast.error(`Koneksi remote ke PC ${pcKode} terputus. Pastikan Firewall di PC Client mengizinkan Port 5900.`);
                    }
                    this.disconnectRemote(pcId);
                },
                onError: (err) => {
                    if (loading) loading.classList.add('hidden');
                    Toast.error(`Gagal koneksi remote: ${err.message}`);
                    this.disconnectRemote(pcId);
                },
                onResolution: (w, h) => {
                    const resBadge = document.getElementById('modal-vnc-resolution');
                    if (resBadge) {
                        const modeText = this.vncSession.scaleFactor ? 'FIT' : '1:1';
                        resBadge.textContent = `${w} × ${h} (${modeText})`;
                        resBadge.classList.remove('hidden');
                    }
                },
                onClipboard: (text) => {
                    const rec = document.getElementById('modal-vnc-clip-rec');
                    if (rec) rec.value = text;
                    if (text && text.trim()) {
                        Toast.info(`📋 Teks disalin dari Remote PC ${pcKode}`);
                    }
                }
            });

            await this.vncSession.connect();

        } catch (err) {
            Toast.error(err.message || 'Gagal memulai remote session');
            if (loading) loading.classList.add('hidden');
            if (connectBtn) connectBtn.classList.remove('hidden');
            this.disconnectRemote(pcId);
        }
    },

    disconnectRemote: async function(pcId) {
        if (this.vncSession) {
            this.vncSession.disconnect();
            this.vncSession = null;
        }

        const statusBadge = document.getElementById('modal-vnc-status-badge');
        if (statusBadge) {
            statusBadge.textContent = 'Terputus';
            statusBadge.className = 'px-2 py-1 rounded text-xs font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700';
        }

        const resBadge = document.getElementById('modal-vnc-resolution');
        if (resBadge) resBadge.classList.add('hidden');

        const placeholder = document.getElementById('modal-vnc-placeholder');
        if (placeholder) placeholder.classList.remove('hidden');

        const connectBtn = document.getElementById('modal-vnc-connect-btn');
        if (connectBtn) connectBtn.classList.remove('hidden');

        const disconnectBtn = document.getElementById('modal-vnc-disconnect-btn');
        if (disconnectBtn) disconnectBtn.classList.add('hidden');

        const kbBtn = document.getElementById('modal-vnc-keyboard-btn');
        if (kbBtn) kbBtn.classList.add('opacity-40', 'cursor-not-allowed');

        const clipBtn = document.getElementById('modal-vnc-clip-btn');
        if (clipBtn) clipBtn.classList.add('opacity-40', 'cursor-not-allowed');

        const kb = document.getElementById('modal-vnc-virtual-keyboard');
        if (kb) kb.classList.add('hidden');

        const clipDrawer = document.getElementById('modal-vnc-clipboard-drawer');
        if (clipDrawer) clipDrawer.classList.add('hidden');

        try {
            await API.request(`/api/v1/kasir/monitor/vnc_client/${pcId}/stop`, { method: 'POST' });
        } catch (err) {
            console.error('[DashboardDetailModal] Error stopping remote proxy:', err);
        }
    },

    stopRemote: async function(pcId) {
        if (this.vncSession) {
            this.vncSession.disconnect();
            this.vncSession = null;
        }

        const menu = document.getElementById('view-action-menu');
        const vncView = document.getElementById('view-remote-client');
        if (menu) menu.classList.remove('hidden');
        if (vncView) vncView.classList.add('hidden');
        document.getElementById('modal-card-main-footer')?.classList.remove('hidden');

        try {
            await API.request(`/api/v1/kasir/monitor/vnc_client/${pcId}/stop`, { method: 'POST' });
        } catch (err) {
            console.error('[DashboardDetailModal] Error stopping remote proxy:', err);
        }
    },

    toggleScale: function() {
        if (this.vncSession) {
            this.vncSession.toggleScale();
            const label = document.getElementById('modal-vnc-scale-label');
            const btn = document.getElementById('modal-vnc-scale-btn');
            const resBadge = document.getElementById('modal-vnc-resolution');
            
            if (this.vncSession.scaleFactor) {
                if (label) label.textContent = 'Fit Layar';
                if (btn) btn.className = 'px-3 py-1.5 bg-emerald-950/40 border border-emerald-800/60 text-emerald-400 text-xs font-bold rounded hover:bg-emerald-900/40 transition-colors';
            } else {
                if (label) label.textContent = '1:1 Asli';
                if (btn) btn.className = 'px-3 py-1.5 bg-[#171717] border border-[#262626] text-neutral-300 text-xs font-bold rounded hover:bg-[#222] transition-colors';
            }

            if (this.vncSession.remoteResolution.width > 0 && resBadge) {
                const modeText = this.vncSession.scaleFactor ? 'FIT' : '1:1';
                resBadge.textContent = `${this.vncSession.remoteResolution.width} × ${this.vncSession.remoteResolution.height} (${modeText})`;
            }
        }
    },

    toggleFullscreen: function() {
        const container = document.getElementById('modal-vnc-container');
        if (!container) return;
        if (!document.fullscreenElement) {
            container.requestFullscreen().then(() => {
                setTimeout(() => {
                    if (this.vncSession) this.vncSession.applyDisplayMode();
                }, 100);
            }).catch(err => {
                Toast.error('Gagal fullscreen: ' + err.message);
            });
        } else {
            document.exitFullscreen().then(() => {
                setTimeout(() => {
                    if (this.vncSession) this.vncSession.applyDisplayMode();
                }, 100);
            });
        }
    },

    toggleVirtualKeyboard: function() {
        if (this.vncSession) {
            this.vncSession.toggleVirtualKeyboard('modal-vnc-virtual-keyboard', 'modal-');
        }
    },

    switchKeyboardLayout: function(layout) {
        if (this.vncSession) {
            this.vncSession.switchKeyboardLayout(layout, 'modal-');
        }
    },

    toggleModifier: function(modKey) {
        if (this.vncSession) {
            const active = this.vncSession.toggleModifier(modKey);
            const btn = document.getElementById(`modal-key-${modKey.toLowerCase()}`);
            if (btn) {
                if (active) {
                    btn.classList.add('bg-neutral-200', 'text-black', 'border-white');
                    btn.classList.remove('bg-[#171717]', 'text-neutral-400', 'border-[#262626]');
                } else {
                    btn.classList.remove('bg-neutral-200', 'text-black', 'border-white');
                    btn.classList.add('bg-[#171717]', 'text-neutral-400', 'border-[#262626]');
                }
            }
        }
    },

    sendSpecialKey: function(keysym) {
        if (this.vncSession) {
            this.vncSession.sendSpecialKey(keysym);
        }
    },

    sendShortcutPreset: function(preset) {
        if (this.vncSession) {
            this.vncSession.sendShortcutPreset(preset);
        }
    },

    toggleClipboardModal: function() {
        const drawer = document.getElementById('modal-vnc-clipboard-drawer');
        if (!drawer) return;
        const isHidden = drawer.classList.contains('hidden');
        if (isHidden) {
            drawer.classList.remove('hidden');
            const sendInput = document.getElementById('modal-vnc-clip-send');
            if (sendInput) {
                sendInput.focus();
                if (!sendInput.value && navigator.clipboard && navigator.clipboard.readText) {
                    navigator.clipboard.readText().then(t => {
                        if (t && !sendInput.value) sendInput.value = t;
                    }).catch(() => {});
                }
            }
            const recInput = document.getElementById('modal-vnc-clip-rec');
            if (recInput && this.vncSession) {
                recInput.value = this.vncSession.getRemoteClipboard() || '';
            }
        } else {
            drawer.classList.add('hidden');
        }
    },

    pasteHostToInput: async function() {
        const sendInput = document.getElementById('modal-vnc-clip-send');
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
                console.warn('[VNC] Gagal baca clipboard:', e);
            }
        }
        Toast.info('Gunakan Ctrl+V atau tahan dan tempel secara manual');
        sendInput.focus();
    },

    sendClipboardToRemote: function() {
        if (!this.vncSession) {
            Toast.error('Remote belum terhubung');
            return;
        }
        const sendInput = document.getElementById('modal-vnc-clip-send');
        const text = sendInput ? sendInput.value : '';
        if (!text) {
            Toast.warning('Ketik atau tempel teks terlebih dahulu');
            if (sendInput) sendInput.focus();
            return;
        }
        this.vncSession.handlePastedText(text);
        Toast.success('Teks terkirim & ditempel di Remote Host');
    },

    copyReceivedToHost: async function() {
        if (!this.vncSession) {
            Toast.error('Remote belum terhubung');
            return;
        }
        const recInput = document.getElementById('modal-vnc-clip-rec');
        let text = recInput ? recInput.value : (this.vncSession ? this.vncSession.getRemoteClipboard() : '');

        if (!text && this.vncSession) {
            Toast.info('Meminta seleksi teks dari Remote Host (Ctrl+C)...');
            this.vncSession.sendCtrlKeySequence(0x0063, 'KeyC');
            await new Promise(r => setTimeout(r, 200));
            text = this.vncSession.getRemoteClipboard() || '';
            if (recInput && text) recInput.value = text;
        }

        if (!text) {
            Toast.warning('Belum ada teks di remote. Pilih/sorot teks di remote terlebih dahulu, lalu klik tombol ini.');
            return;
        }

        const copied = await this.vncSession.copyTextToHost(text, false);
        if (copied) {
            Toast.success('📋 Teks dari Remote Host disalin ke clipboard Host! Silakan Paste (Ctrl+V / Klik Kanan).');
        } else {
            Toast.info('Silakan salin teks manual dari kotak.');
            if (recInput) {
                recInput.focus();
                recInput.select();
            }
        }
    },

    pasteHostClipboardDirect: async function() {
        if (!this.vncSession) {
            Toast.error('Remote PC belum terhubung');
            return;
        }
        let text = '';
        if (navigator.clipboard && navigator.clipboard.readText) {
            try {
                text = await navigator.clipboard.readText();
            } catch (e) {}
        }
        if (text) {
            this.vncSession.handlePastedText(text);
            const sendInput = document.getElementById('modal-vnc-clip-send');
            if (sendInput) sendInput.value = text;
        } else {
            const sendInput = document.getElementById('modal-vnc-clip-send');
            if (sendInput && sendInput.value) {
                this.vncSession.handlePastedText(sendInput.value);
            } else {
                Toast.info('Gunakan Ctrl+V di dalam layar remote atau tempel manual di kotak input');
                if (sendInput) sendInput.focus();
            }
        }
    },

    copyRemoteClipboardDirect: async function() {
        if (!this.vncSession) {
            Toast.error('Remote PC belum terhubung');
            return;
        }
        const text = this.vncSession.getRemoteClipboard() || '';
        if (!text) {
            Toast.warning('Belum ada teks yang disalin dari remote PC (Gunakan Ctrl+C di remote)');
            return;
        }
        await this.vncSession.copyTextToHost(text, true);
    },

};

// Global window event listeners for cleaning up active VNC streaming
window.addEventListener('beforeunload', () => {
    if (window.DashboardDetailModal && window.DashboardDetailModal.vncSession && window.DashboardDetailModal.currentPcId) {
        window.DashboardDetailModal.vncSession.disconnect();
        navigator.sendBeacon(`/api/v1/kasir/monitor/vnc_client/${window.DashboardDetailModal.currentPcId}/stop`);
    }
});

window.addEventListener('pagehide', () => {
    if (window.DashboardDetailModal && window.DashboardDetailModal.vncSession && window.DashboardDetailModal.currentPcId) {
        window.DashboardDetailModal.vncSession.disconnect();
        navigator.sendBeacon(`/api/v1/kasir/monitor/vnc_client/${window.DashboardDetailModal.currentPcId}/stop`);
    }
});
