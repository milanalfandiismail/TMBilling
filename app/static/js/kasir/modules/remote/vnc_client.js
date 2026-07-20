// vnc_client.js — Client Remote Control VNC Server untuk TMBilling

const VNCClient = {
    rfb: null,
    scaleFactor: true,

    RFBClass: null,

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
        badge.className = 'px-2.5 py-1 rounded text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30';

        const RFBClass = await this.getRFB();
        if (!RFBClass) {
            badge.textContent = 'Gagal Load Module';
            badge.className = 'px-2.5 py-1 rounded text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30';
            Toast.error('Gagal memuat modul noVNC. Pastikan PC terhubung ke internet untuk mengunduh library rfb.js');
            return;
        }

        badge.textContent = 'Menyiapkan Websockify...';

        // 1. Panggil API backend untuk memastikan daemon websockify aktif
        let listenPort = 8081;
        try {
            const startRes = await API.request('/api/v1/kasir/vnc/start', { method: 'POST' });
            if (startRes && startRes.listen_port) {
                listenPort = startRes.listen_port;
            }
        } catch (err) {
            badge.textContent = 'Gagal Start Service';
            badge.className = 'px-2.5 py-1 rounded text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30';
            Toast.error('Gagal memulai service VNC: ' + err.message);
            return;
        }

        // 2. Tentukan WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let url;
        if (window.location.protocol === 'https:') {
            url = `wss://${window.location.host}/ws/vnc`;
        } else {
            url = `ws://${window.location.hostname}:${listenPort}`;
        }

        const vncPassword = pwdInput ? pwdInput.value : '';

        badge.textContent = 'Menghubungkan...';

        try {
            this.rfb = new RFBClass(screen, url, {
                credentials: { password: vncPassword },
                scaleViewport: this.scaleFactor
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
                badge.className = 'px-2.5 py-1 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
                placeholder.classList.add('hidden');
                connectBtn.classList.add('hidden');
                disconnectBtn.classList.remove('hidden');

                // Trigger resize & scale recalculation setelah DOM placeholder hidden
                setTimeout(() => {
                    if (this.rfb) {
                        this.rfb.scaleViewport = this.scaleFactor;
                        try { this.rfb.focus(); } catch(e) {}
                    }
                    window.dispatchEvent(new Event('resize'));
                }, 50);

                Toast.success('Koneksi VNC Server Terhubung');
            });

            // Pastikan saat frame pertama diterima, scaling langsung dipaksa update
            if (typeof this.rfb.addEventListener === 'function') {
                this.rfb.addEventListener('firstframe', () => {
                    if (this.rfb) {
                        this.rfb.scaleViewport = this.scaleFactor;
                    }
                    window.dispatchEvent(new Event('resize'));
                });
            }

            this.rfb.addEventListener('disconnect', (e) => {
                badge.textContent = 'Terputus';
                badge.className = 'px-2.5 py-1 rounded text-xs font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700';
                placeholder.classList.remove('hidden');
                connectBtn.classList.remove('hidden');
                disconnectBtn.classList.add('hidden');
                if (e.detail.clean) {
                    Toast.info('Koneksi VNC ditutup');
                } else {
                    Toast.error('Koneksi VNC terputus (Cek apakah TightVNC Server aktif di 127.0.0.1:5900)');
                }
            });

        } catch (err) {
            badge.textContent = 'Gagal Koneksi';
            badge.className = 'px-2.5 py-1 rounded text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30';
            Toast.error('Gagal memulai VNC Client: ' + err.message);
        }
    },

    disconnect() {
        if (this.rfb) {
            this.rfb.disconnect();
            this.rfb = null;
        }
        const screen = document.getElementById('vnc-screen');
        if (screen) screen.innerHTML = '';
    },

    toggleScale() {
        this.scaleFactor = !this.scaleFactor;
        const scaleBtn = document.getElementById('vnc-scale-btn');
        if (scaleBtn) {
            scaleBtn.textContent = this.scaleFactor ? '📐 Scaling On' : '📐 Scaling Off';
        }
        if (this.rfb) {
            this.rfb.scaleViewport = this.scaleFactor;
        }
    },

    toggleFullscreen() {
        const container = document.getElementById('vnc-container');
        if (!container) return;
        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(err => {
                Toast.error('Gagal fullscreen: ' + err.message);
            });
        } else {
            document.exitFullscreen();
        }
    }
};

window.VNCClient = VNCClient;

document.addEventListener('DOMContentLoaded', () => {
    VNCClient.getRFB();
});
