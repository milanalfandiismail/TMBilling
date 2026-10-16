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
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-2.5 sm:gap-3 xl:gap-4 items-start">
            <!-- Kolom Kiri: Status & Akses Remote -->
            <div class="space-y-2.5 sm:space-y-3 xl:space-y-4">
                <!-- Status Toggle Card -->
                <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-3 sm:p-3.5 xl:p-4 2xl:p-5">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                        <div class="min-w-0">
                            <h3 class="font-bold text-neutral-200 text-xs lg:text-sm xl:text-base 2xl:text-lg uppercase tracking-wider flex items-center gap-1.5">
                                <i class="fa-solid fa-shield-halved text-emerald-400 text-xs lg:text-sm xl:text-base 2xl:text-lg"></i>
                                <span>Status Whitelist IP</span>
                            </h3>
                            <p class="text-[10px] sm:text-xs xl:text-xs 2xl:text-sm text-neutral-400 mt-0.5">Lindungi dashboard kasir &amp; batasi hak akses hanya untuk IP terdaftar</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer shrink-0" for="wlToggle">
                            <input type="checkbox" id="wlToggle" class="sr-only peer" onchange="Settings._wlToggle(this.checked)">
                            <div class="w-10 h-5 lg:w-11 lg:h-6 bg-neutral-700 peer-checked:bg-emerald-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 lg:after:h-5 lg:after:w-5 after:transition-all"></div>
                        </label>
                    </div>
                </div>

                <!-- Remote Access Card -->
                <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-3 sm:p-3.5 xl:p-4 2xl:p-5 space-y-2.5 sm:space-y-3 xl:space-y-3.5">
                    <div class="flex items-center justify-between gap-2">
                        <h3 class="font-bold text-neutral-200 text-xs lg:text-sm xl:text-base 2xl:text-lg uppercase tracking-wider flex items-center gap-1.5 min-w-0 truncate">
                            <i class="fa-solid fa-link text-blue-400 text-xs lg:text-sm xl:text-base 2xl:text-lg"></i>
                            <span class="truncate">Akses HP &amp; Remote (via Tunnel)</span>
                        </h3>
                        <span class="px-1.5 sm:px-2 xl:px-2.5 2xl:px-3 py-0.5 xl:py-1 2xl:py-1.5 rounded text-[9px] sm:text-[10px] xl:text-xs 2xl:text-sm font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                            Token LAN/WAN
                        </span>
                    </div>
                    <div>
                        <label for="wlPublicUrl" class="text-xs lg:text-xs xl:text-sm 2xl:text-base text-neutral-300 font-semibold block mb-1">Domain Publik</label>
                        <div class="flex flex-col sm:flex-row gap-1.5">
                            <input type="text" id="wlPublicUrl" placeholder="https://billing.warnetanda.com"
                                class="w-full sm:flex-1 min-w-0 px-2.5 py-1.5 xl:py-2 2xl:py-2.5 2xl:px-3.5 bg-[#050505] border border-[#1c1c1c] rounded text-xs xl:text-sm 2xl:text-base text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors font-mono">
                            <button onclick="Settings._wlSavePublicUrl()"
                                class="w-full sm:w-auto px-3 py-1.5 xl:py-2 2xl:py-2.5 2xl:px-4 bg-neutral-100 hover:bg-neutral-200 text-black text-xs xl:text-sm 2xl:text-base font-bold rounded transition-colors shrink-0 active:scale-95 shadow-sm text-center">
                                Simpan
                            </button>
                        </div>
                        <p class="text-[10px] sm:text-xs xl:text-xs 2xl:text-sm text-neutral-400 mt-1 font-normal font-sans">Contoh: https://billing.domainanda.com atau IP publik statis</p>
                    </div>
                    
                    <!-- QR Code & Token Box -->
                    <div class="bg-[#050505] border border-[#1c1c1c] rounded-lg overflow-hidden">
                        <div class="flex flex-col sm:flex-row">
                            <div class="p-3 sm:p-3.5 xl:p-4 flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-[#1c1c1c] bg-white shrink-0">
                                <div id="wlQRCode" class="w-[120px] h-[120px] sm:w-[130px] sm:h-[130px] xl:w-[140px] xl:h-[140px] flex items-center justify-center overflow-hidden"></div>
                            </div>
                            <div class="p-3 sm:p-3.5 xl:p-4 flex-1 flex flex-col justify-center gap-2 xl:gap-3 min-w-0">
                                <div class="min-w-0">
                                    <p class="text-[9px] sm:text-[10px] xl:text-xs 2xl:text-sm text-neutral-400 uppercase font-bold mb-1">URL Token</p>
                                    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
                                        <code id="wlUrlDisplay" class="flex-1 bg-[#0a0a0a] border border-[#1c1c1c] rounded px-2.5 py-1.5 xl:py-2 2xl:py-2.5 text-xs xl:text-sm 2xl:text-base text-neutral-300 font-mono break-all min-w-0">-</code>
                                        <button onclick="Settings._wlCopyUrl()" class="w-full sm:w-auto shrink-0 p-2 sm:px-2.5 sm:py-1.5 xl:py-2 xl:px-3 2xl:py-2.5 2xl:px-4 bg-[#141414] hover:bg-[#202020] border border-[#252525] hover:border-neutral-500 rounded text-xs xl:text-sm 2xl:text-base text-neutral-300 transition-colors active:scale-95 shadow-sm text-center flex items-center justify-center gap-1.5" title="Salin URL Token">
                                            <i class="fa-solid fa-copy text-xs xl:text-sm 2xl:text-base"></i>
                                            <span class="sm:hidden font-sans font-semibold">Salin URL</span>
                                        </button>
                                    </div>
                                </div>
                                <div class="text-[10px] sm:text-xs xl:text-xs 2xl:text-sm text-neutral-400 font-mono truncate">Token: <code id="wlTokenMasked" class="text-neutral-300">-</code></div>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 pt-1">
                        <button onclick="Settings._wlRegenerate()" class="w-full sm:w-auto px-3 py-1.5 xl:py-2 2xl:py-2.5 2xl:px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded text-xs xl:text-sm 2xl:text-base text-red-400 transition-colors font-bold inline-flex items-center justify-center gap-1.5 active:scale-95">
                            <i class="fa-solid fa-arrows-rotate text-[11px] xl:text-xs 2xl:text-sm"></i>
                            <span>Regenerate Token</span>
                        </button>
                    </div>
                    <p class="text-[10px] sm:text-xs xl:text-xs 2xl:text-sm text-neutral-400">⚠️ Token lama otomatis tidak berlaku dan semua sesi HP yang sedang aktif akan logout.</p>
                </div>
            </div>

            <!-- Kolom Kanan: Tambah IP & Daftar IP -->
            <div class="space-y-2.5 sm:space-y-3 xl:space-y-4">
                <!-- Tambah IP Card -->
                <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-3 sm:p-3.5 xl:p-4 2xl:p-5">
                    <h3 class="font-bold text-neutral-200 text-xs lg:text-sm xl:text-base 2xl:text-lg uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        <i class="fa-solid fa-plus text-emerald-400 text-xs lg:text-sm xl:text-base 2xl:text-lg"></i>
                        <span>Tambah IP Baru</span>
                    </h3>
                    <div class="flex flex-col sm:flex-row gap-2">
                        <label for="wlNewIp" class="sr-only">Alamat IP Baru</label>
                        <input type="text" id="wlNewIp" placeholder="Contoh: 192.168.1.30"
                            class="w-full sm:flex-1 min-w-0 px-2.5 py-1.5 xl:py-2 2xl:py-2.5 2xl:px-3.5 bg-[#050505] border border-[#1c1c1c] rounded text-xs xl:text-sm 2xl:text-base text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 font-mono">
                        <label for="wlNewLabel" class="sr-only">Label IP Baru (Opsional)</label>
                        <input type="text" id="wlNewLabel" placeholder="Label (opsional)"
                            class="w-full sm:w-44 xl:w-48 min-w-0 px-2.5 py-1.5 xl:py-2 2xl:py-2.5 2xl:px-3.5 bg-[#050505] border border-[#1c1c1c] rounded text-xs xl:text-sm 2xl:text-base text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500">
                        <button onclick="Settings._wlAddIp()" class="w-full sm:w-auto px-3 py-1.5 xl:py-2 2xl:py-2.5 2xl:px-4 bg-neutral-100 hover:bg-neutral-200 text-black text-xs xl:text-sm 2xl:text-base font-bold rounded transition-colors shrink-0 active:scale-95 shadow-sm text-center">Tambah</button>
                    </div>
                    <p class="text-[10px] sm:text-xs xl:text-xs 2xl:text-sm text-neutral-400 mt-1.5 font-normal font-sans">Format IPv4 valid (contoh: 192.168.1.50) dan label pengenal opsional</p>
                </div>

                <!-- Daftar IP Card -->
                <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-3 sm:p-3.5 xl:p-4 2xl:p-5">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="font-bold text-neutral-200 text-xs lg:text-sm xl:text-base 2xl:text-lg uppercase tracking-wider flex items-center gap-1.5">
                            <i class="fa-solid fa-list-check text-neutral-400 text-xs lg:text-sm xl:text-base 2xl:text-lg"></i>
                            <span>Daftar IP Terdaftar</span>
                        </h3>
                        <span class="px-1.5 sm:px-2 xl:px-2.5 2xl:px-3 py-0.5 xl:py-1 2xl:py-1.5 rounded text-[9px] sm:text-[10px] xl:text-xs 2xl:text-sm font-semibold bg-neutral-800 text-neutral-300">
                            <span id="wlCount">0</span> IP
                        </span>
                    </div>
                    <div class="border border-[#1c1c1c] rounded bg-[#050505] overflow-hidden">
                        <div class="overflow-x-auto scrollbar-thin">
                            <table class="w-full text-left text-xs xl:text-sm 2xl:text-base border-collapse table-auto sm:table-fixed min-w-[310px] sm:min-w-0">
                                <thead class="text-[9px] sm:text-[10px] xl:text-xs 2xl:text-sm text-neutral-400 uppercase font-bold bg-[#0c0c0c] sticky top-0 z-10 border-b border-[#1c1c1c]">
                                    <tr>
                                        <th class="py-2.5 px-2.5 sm:px-3 w-auto min-w-[105px]">IP Address</th>
                                        <th class="py-2.5 px-2 sm:px-3 w-auto">Label</th>
                                        <th class="py-2.5 px-2 sm:px-3 w-20 sm:w-24 whitespace-nowrap">Ditambahkan</th>
                                        <th class="py-2.5 px-2 sm:px-3 w-10 sm:w-12 text-right whitespace-nowrap">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="wlTableBody" class="divide-y divide-[#191919]"></tbody>
                            </table>
                        </div>
                    </div>
                    <div id="wlEmpty" class="text-center py-6 text-neutral-500 text-xs xl:text-sm 2xl:text-base hidden">Belum ada IP yang terdaftar.</div>
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
            const size = window.innerWidth < 640 ? 120 : 130;
            new QRCode(c, { text: url, width: size, height: size, colorDark: '#000000', colorLight: '#ffffff' });
        } catch (e) { }
    },

    async _wlRefreshList() {
        try {
            const data = await this._wlFetch('GET', '/api/v1/kasir/settings/ip-whitelist');
            const entries = data.entries || [];
            document.getElementById('wlCount').textContent = entries.length;
            const tbody = document.getElementById('wlTableBody');
            const empty = document.getElementById('wlEmpty');
            if (entries.length === 0) {
                if (tbody) tbody.innerHTML = '';
                empty.classList.remove('hidden');
                return;
            }
            empty.classList.add('hidden');
            
            if (tbody) {
                tbody.innerHTML = entries.map(e => {
                    const d = e.added_at ? e.added_at.substring(0, 10) : '-';
                    return `<tr class="border-b border-[#1c1c1c]/40 hover:bg-[#121212] transition-colors">
                        <td class="py-2.5 px-2.5 sm:px-3 font-mono text-neutral-200 text-xs xl:text-sm 2xl:text-base font-bold whitespace-nowrap">${this._esc(e.ip)}</td>
                        <td class="py-2.5 px-2 sm:px-3 text-neutral-400 text-xs xl:text-sm 2xl:text-base truncate max-w-[85px] sm:max-w-[120px] xl:max-w-[160px]">${this._esc(e.label || '-')}</td>
                        <td class="py-2.5 px-2 sm:px-3 text-neutral-400 text-[10px] sm:text-xs xl:text-xs 2xl:text-sm font-mono whitespace-nowrap">${d}</td>
                        <td class="py-2.5 px-2 sm:px-3 text-right whitespace-nowrap">
                            <button onclick="Settings._wlRemove('${this._esc(e.ip)}')" class="p-1 sm:px-2 sm:py-1 xl:px-2.5 xl:py-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-950/30 rounded text-xs xl:text-sm 2xl:text-base font-medium transition-colors inline-flex items-center justify-center active:scale-95" title="Hapus IP">
                                <i class="fa-solid fa-trash-can text-[11px] xl:text-xs 2xl:text-sm"></i>
                            </button>
                        </td>
                    </tr>`;
                }).join('');
            }
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
