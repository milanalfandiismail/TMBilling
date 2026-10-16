// app/static/js/kasir/modules/settings/settings_network.js
/**
 * Sub-modul SettingsNetwork untuk pengaturan jaringan & remote akses:
 * Whitelist IP kasir, QR code link access, dan Cloudflare Tunnel Auto-Manager.
 */

const SettingsNetwork = {
    _renderWhitelistIP() {
        const target = document.getElementById('subtab-whitelist_ip');
        if (!target) return;
        if (target.dataset.rendered === 'true') return;
        target.dataset.rendered = 'true';

        target.innerHTML = `
        <div class="space-y-5">
            <!-- Status Toggle Card -->
            <div class="bg-[#050505] border border-[#1c1c1c] rounded-xl p-4 lg:p-5">
                <div class="flex items-center justify-between gap-4">
                    <div>
                        <label for="wlToggle" class="font-bold text-neutral-200 text-sm lg:text-base block">Status Whitelist IP</label>
                        <p class="text-[10px] lg:text-xs text-neutral-500 mt-0.5">Lindungi dashboard dari akses IP tidak dikenal</p>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer shrink-0" for="wlToggle">
                        <input type="checkbox" id="wlToggle" class="sr-only peer" onchange="Settings._wlToggle(this.checked)">
                        <div class="w-10 h-5 lg:w-11 lg:h-6 bg-neutral-700 peer-checked:bg-emerald-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 lg:after:h-5 lg:after:w-5 after:transition-all"></div>
                    </label>
                </div>
            </div>

            <!-- Remote Access Card -->
            <div class="bg-[#050505] border border-[#1c1c1c] rounded-xl p-4 lg:p-5">
                <h3 class="font-bold text-neutral-200 text-sm lg:text-base mb-3">🔗 Akses dari HP / Remote (via Tunnel)</h3>
                <div class="mb-4">
                    <label for="wlPublicUrl" class="text-[9px] lg:text-xs text-neutral-500 uppercase font-bold block mb-1">Domain Publik</label>
                    <div class="flex gap-2">
                        <input type="text" id="wlPublicUrl" placeholder="https://tmbilling.example.com"
                            class="flex-1 bg-[#0a0a0a] border border-[#1c1c1c] rounded px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-400 transition-colors">
                        <button onclick="Settings._wlSavePublicUrl()"
                            class="px-4 py-2 bg-neutral-800 border border-[#1c1c1c] rounded text-sm text-neutral-300 hover:bg-neutral-700 transition-colors font-semibold">Simpan</button>
                    </div>
                    <p class="text-[9px] lg:max-xl:text-[10px] xl:text-xs 2xl:text-sm text-neutral-500 mt-1 font-normal font-sans">Contoh: https://billing.domainanda.com atau IP publik statis</p>
                </div>
                <div class="bg-[#0a0a0a] border border-[#1c1c1c] rounded-lg overflow-hidden">
                    <div class="flex flex-col lg:flex-row">
                        <div class="p-4 flex items-center justify-center border-b lg:border-b-0 lg:border-r border-[#1c1c1c] bg-white">
                            <div id="wlQRCode" class="w-[140px] h-[140px] lg:w-[180px] lg:h-[180px]"></div>
                        </div>
                        <div class="p-4 flex-1 flex flex-col justify-center gap-3">
                            <div>
                                <p class="text-[9px] lg:text-xs text-neutral-500 uppercase font-bold mb-1">URL Token</p>
                                <div class="flex items-center gap-2">
                                    <code id="wlUrlDisplay" class="flex-1 bg-[#050505] border border-[#1c1c1c] rounded px-3 py-2 text-xs lg:text-sm text-neutral-300 font-mono break-all">-</code>
                                    <button onclick="Settings._wlCopyUrl()" class="shrink-0 px-3 py-2 bg-neutral-800 border border-[#1c1c1c] rounded text-sm text-neutral-300 hover:bg-neutral-700 transition-colors">📋</button>
                                </div>
                            </div>
                            <div class="text-[9px] lg:text-xs text-neutral-500">Token: <code id="wlTokenMasked" class="font-mono text-neutral-400">-</code></div>
                        </div>
                    </div>
                </div>
                <button onclick="Settings._wlRegenerate()" class="mt-4 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400 hover:bg-red-500/20 transition-colors font-bold">🔄 Regenerate Token</button>
                <p class="text-[9px] lg:text-xs text-neutral-600 mt-1">⚠️ Token lama jadi invalid. Semua sesi HP yang sedang aktif akan logout otomatis.</p>
            </div>

            <!-- Daftar IP Card -->
            <div class="bg-[#050505] border border-[#1c1c1c] rounded-xl p-4 lg:p-5">
                <h3 class="font-bold text-neutral-200 text-sm lg:text-base mb-3">📋 Daftar IP (<span id="wlCount">0</span>)</h3>
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-xs lg:text-sm">
                        <thead class="text-[9px] lg:text-xs text-neutral-500 uppercase border-b border-[#1c1c1c]">
                            <tr><th class="pb-2 font-bold">IP Address</th><th class="pb-2 font-bold hidden sm:table-cell">Label</th><th class="pb-2 font-bold hidden md:table-cell">Ditambahkan</th><th class="pb-2 font-bold text-right"></th></tr>
                        </thead>
                        <tbody id="wlTableBody"></tbody>
                    </table>
                </div>
                <div id="wlEmpty" class="text-center py-8 text-neutral-500 text-sm hidden">Belum ada IP.</div>
            </div>

            <!-- Tambah IP -->
            <div class="bg-[#050505] border border-[#1c1c1c] rounded-xl p-4 lg:p-5">
                <h3 class="font-bold text-neutral-200 text-sm lg:text-base mb-3">➕ Tambah IP Baru</h3>
                <div class="flex flex-col sm:flex-row gap-2">
                    <label for="wlNewIp" class="sr-only">Alamat IP Baru</label>
                    <input type="text" id="wlNewIp" placeholder="192.168.1.30"
                        class="flex-1 bg-[#0a0a0a] border border-[#1c1c1c] rounded px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-400 font-mono">
                    <label for="wlNewLabel" class="sr-only">Label IP Baru (Opsional)</label>
                    <input type="text" id="wlNewLabel" placeholder="Label (opsional)"
                        class="sm:w-48 bg-[#0a0a0a] border border-[#1c1c1c] rounded px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none">
                    <button onclick="Settings._wlAddIp()" class="px-5 py-2 bg-neutral-800 border border-[#1c1c1c] rounded text-sm text-neutral-200 hover:bg-neutral-700 font-bold shrink-0">Tambah</button>
                </div>
                <p class="text-[9px] lg:max-xl:text-[10px] xl:text-xs 2xl:text-sm text-neutral-500 mt-1 font-normal font-sans">Masukkan format IPv4 yang valid (contoh: 192.168.1.50) dan label pengenal opsional</p>
            </div>
            </div>
        </div>`;
    },

    async _wlFetch(method, path, body) {
        const headers = { 'Content-Type': 'application/json' };
        const csrfMeta = document.querySelector('meta[name="csrf-token"]');
        if (csrfMeta) headers['X-CSRFToken'] = csrfMeta.content;
        const opts = { method, headers };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(path, opts);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            throw new Error(err.error || 'Request failed');
        }
        return res.json();
    },

    async _loadWhitelistStatus() {
        try {
            const data = await this._wlFetch('GET', '/api/v1/kasir/settings/ip-whitelist/status');
            const toggle = document.getElementById('wlToggle');
            if (toggle) toggle.checked = data.enabled;
            document.getElementById('wlUrlDisplay').textContent = data.full_url || '-';
            document.getElementById('wlTokenMasked').textContent = data.token_masked || '-';
            const urlInput = document.getElementById('wlPublicUrl');
            if (urlInput) urlInput.value = data.public_url || '';
            this._wlRenderQR(data.full_url);
            await this._wlRefreshList();
        } catch (e) { /* status not critical */ }
    },

    _wlRenderQR(url) {
        const c = document.getElementById('wlQRCode');
        if (!c) return;
        c.innerHTML = '';
        if (!url || url === '-') return;
        try {
            new QRCode(c, { text: url, width: 140, height: 140, colorDark: '#000000', colorLight: '#ffffff' });
        } catch (e) { }
    },

    async _wlRefreshList() {
        try {
            const data = await this._wlFetch('GET', '/api/v1/kasir/settings/ip-whitelist');
            const entries = data.entries || [];
            document.getElementById('wlCount').textContent = entries.length;
            const tbody = document.getElementById('wlTableBody');
            const empty = document.getElementById('wlEmpty');
            if (entries.length === 0) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
            empty.classList.add('hidden');
            tbody.innerHTML = entries.map(e => {
                const d = e.added_at ? e.added_at.substring(0, 10) : '-';
                return `<tr class="border-b border-[#1c1c1c]/40">
                    <td class="py-2.5 font-mono text-neutral-200">${this._esc(e.ip)}</td>
                    <td class="py-2.5 text-neutral-400 hidden sm:table-cell">${this._esc(e.label || '-')}</td>
                    <td class="py-2.5 text-neutral-500 text-xs hidden md:table-cell">${d}</td>
                    <td class="py-2.5 text-right"><button onclick="Settings._wlRemove('${this._esc(e.ip)}')" class="text-red-400 hover:text-red-300 text-xs px-2">🗑</button></td>
                </tr>`;
            }).join('');
        } catch (e) { }
    },

    async _wlAddIp() {
        const ip = document.getElementById('wlNewIp').value.trim();
        if (!ip) { alert('Masukkan IP address.'); return; }
        const label = document.getElementById('wlNewLabel').value.trim();
        try {
            await this._wlFetch('POST', '/api/v1/kasir/settings/ip-whitelist', { ip, label });
            document.getElementById('wlNewIp').value = '';
            document.getElementById('wlNewLabel').value = '';
            await this._wlRefreshList();
            if (typeof Toast !== 'undefined') Toast.success('IP Whitelist berhasil ditambahkan');
        } catch (e) {
            if (typeof Toast !== 'undefined') Toast.error('Gagal menambahkan IP Whitelist');
        }
    },

    async _wlRemove(ip) {
        if (!confirm(`Hapus ${ip}?`)) return;
        try {
            await this._wlFetch('DELETE', `/api/v1/kasir/settings/ip-whitelist/${ip}`);
            await this._wlRefreshList();
            if (typeof Toast !== 'undefined') Toast.info('IP Whitelist berhasil dihapus');
        } catch (e) {
            if (typeof Toast !== 'undefined') Toast.error('Gagal menghapus IP Whitelist');
        }
    },

    async _wlToggle(enabled) {
        try {
            await this._wlFetch('POST', '/api/v1/kasir/settings/ip-whitelist/toggle', { enabled });
            if (typeof Toast !== 'undefined') {
                if (enabled) {
                    Toast.success('Whitelist IP diaktifkan');
                } else {
                    Toast.info('Whitelist IP dinonaktifkan');
                }
            }
        } catch (e) {
            document.getElementById('wlToggle').checked = !enabled;
            if (typeof Toast !== 'undefined') Toast.error('Gagal mengubah status Whitelist IP');
        }
    },

    async _wlRegenerate() {
        if (!confirm('Regenerate token? Token lama akan invalidate semua sesi yang sedang aktif.')) return;
        try {
            const data = await this._wlFetch('POST', '/api/v1/kasir/settings/ip-whitelist/regenerate-token');
            alert('Token baru: ' + data.token);
            await this._loadWhitelistStatus();
        } catch (e) { }
    },

    async _wlSavePublicUrl() {
        const url = document.getElementById('wlPublicUrl').value.trim();
        try {
            await this._wlFetch('POST', '/api/v1/kasir/settings/app-public-url', { url });
            await this._loadWhitelistStatus();
            if (typeof Toast !== 'undefined') Toast.success('URL Publik berhasil disimpan');
        } catch (e) {
            if (typeof Toast !== 'undefined') Toast.error('Gagal menyimpan URL Publik');
        }
    },

    _wlCopyUrl() {
        const el = document.getElementById('wlUrlDisplay');
        const text = el ? (el.textContent || '') : '';
        if (!text || text === '-') {
            alert('URL token belum tersedia.');
            return;
        }
        try {
            navigator.clipboard.writeText(text);
            Toast.success('URL token disalin!');
        } catch (e) {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
        }
    },

    _wlCopyUrl() {
        const el = document.getElementById('wlUrlDisplay');
        const text = el ? (el.textContent || '') : '';
        if (!text || text === '-') {
            alert('URL token belum tersedia.');
            return;
        }
        try {
            navigator.clipboard.writeText(text);
            Toast.success('URL token disalin!');
        } catch (e) {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            alert('URL token disalin!');
        }
    },

    _esc(s) {
        if (!s) return '';
        const d = document.createElement('div');
        d.appendChild(document.createTextNode(s));
        return d.innerHTML;
    },
    _cfPoller: null,

    async loadCloudflareTunnelStatus() {
        const badge = document.getElementById('cf-tunnel-status-badge');
        const tokenInput = document.getElementById('cf-tunnel-token-input');
        const toggle = document.getElementById('cf-tunnel-toggle');
        if (!badge) return;

        try {
            const res = await API.request('/api/v1/kasir/settings/cloudflare-tunnel/status');
            if (res.success && res.status) {
                const s = res.status;
                if (toggle) toggle.checked = s.enabled;
                if (tokenInput) {
                    if (s.token_set) {
                        tokenInput.value = '••••••••••••••••••••••••••••••••';
                        if (!tokenInput.dataset.focusBound) {
                            tokenInput.dataset.focusBound = 'true';
                            tokenInput.addEventListener('focus', () => {
                                if (tokenInput.value === '••••••••••••••••••••••••••••••••') {
                                    tokenInput.value = '';
                                }
                            });
                        }
                    } else {
                        tokenInput.value = '';
                        tokenInput.placeholder = 'Masukkan token eyJh...';
                    }
                }

                // Handle download progress
                if (s.download && s.download.downloading) {
                    this._cfWasDownloading = true;
                    const dl = s.download;
                    const downloadedMb = (dl.downloaded_bytes / 1048576).toFixed(1);
                    const totalMb = dl.total_bytes > 0 ? (dl.total_bytes / 1048576).toFixed(1) : '?';

                    badge.textContent = `🟡 Mengunduh cloudflared (${dl.percent}%)...`;
                    badge.className = 'px-3 py-1 rounded text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30';

                    Toast.progress(
                        'cf-download',
                        'Mengunduh cloudflared.exe',
                        dl.percent,
                        `${downloadedMb} MB / ${totalMb} MB`
                    );

                    if (!this._cfPoller) {
                        this._cfPoller = setInterval(() => this.loadCloudflareTunnelStatus(), 300);
                    }
                    return;
                } else {
                    if (this._cfPoller) {
                        clearInterval(this._cfPoller);
                        this._cfPoller = null;
                    }
                    if (this._cfWasDownloading) {
                        this._cfWasDownloading = false;
                        if (s.download && s.download.percent === 100) {
                            Toast.progress('cf-download', 'Unduhan Selesai!', 100, 'cloudflared.exe berhasil diverifikasi');
                        }
                    }
                }

                if (s.running) {
                    badge.textContent = '🟢 Tunnel Aktif';
                    badge.className = 'px-3 py-1 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
                } else if (s.enabled) {
                    badge.textContent = '🟡 Menghubungkan...';
                    badge.className = 'px-3 py-1 rounded text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30';
                } else {
                    badge.textContent = '🔴 Tunnel Nonaktif';
                    badge.className = 'px-3 py-1 rounded text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30';
                }
            }
        } catch (err) {
            badge.textContent = '⚠️ Gagal Load Status';
            badge.className = 'px-3 py-1 rounded text-xs font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700';
        }
    },

    async saveCloudflareToken() {
        const tokenInput = document.getElementById('cf-tunnel-token-input');
        const token = tokenInput ? tokenInput.value.trim() : '';

        if (!token || token === '••••••••••••••••••••••••••••••••') {
            Toast.error('Masukkan token Cloudflare Tunnel yang baru');
            return;
        }

        try {
            const res = await API.request('/api/v1/kasir/settings/cloudflare-tunnel/save-token', {
                method: 'POST',
                body: JSON.stringify({ token })
            });

            if (res.success) {
                Toast.success(res.message || 'Token berhasil disimpan');
                await this.loadCloudflareTunnelStatus();
            } else {
                Toast.error(res.error || 'Gagal menyimpan token');
            }
        } catch (err) {
            Toast.error('Gagal menyimpan token: ' + err.message);
        }
    },

    async toggleCloudflareTunnel(enable) {
        const toggle = document.getElementById('cf-tunnel-toggle');
        Toast.info(enable ? 'Mulai menjalankan Cloudflare Tunnel...' : 'Menghentikan Cloudflare Tunnel...');

        try {
            const res = await API.request('/api/v1/kasir/settings/cloudflare-tunnel/toggle', {
                method: 'POST',
                body: JSON.stringify({ enable })
            });

            if (res.success) {
                Toast.success(res.message);
                await this.loadCloudflareTunnelStatus();
            } else {
                if (toggle) toggle.checked = !enable;
                Toast.error(res.error || 'Gagal mengubah status tunnel');
            }
        } catch (err) {
            if (toggle) toggle.checked = !enable;
            Toast.error('Error saat mengubah status tunnel: ' + err.message);
        }
    },

};

window.SettingsNetwork = SettingsNetwork;
