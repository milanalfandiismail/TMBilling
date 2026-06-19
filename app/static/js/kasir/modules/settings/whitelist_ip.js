/**
 * IP Whitelist — modul interaksi UI sub-menu Settings.
 * Handle: list, add, remove, toggle, regenerate token, copy, QR.
 */
const WhitelistIP = {
    _newToken: '',

    async init() {
        await this.refresh();
        await this.loadStatus();
    },

    // ------------------------------------------------------------------
    // API HELPERS
    // ------------------------------------------------------------------

    async _fetch(method, path, body = undefined) {
        const headers = { 'Content-Type': 'application/json' };
        const csrfMeta = document.querySelector('meta[name="csrf-token"]');
        if (csrfMeta) headers['X-CSRFToken'] = csrfMeta.content;

        const opts = { method, headers };
        if (body) opts.body = JSON.stringify(body);

        const res = await fetch(path, opts);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            alert('Gagal: ' + (err.error || 'Unknown error'));
            throw new Error(err.error || 'Request failed');
        }
        return res.json();
    },

    // ------------------------------------------------------------------
    // REFRESH LIST
    // ------------------------------------------------------------------

    async refresh() {
        const data = await this._fetch('GET', '/api/settings/ip-whitelist');
        const entries = data.entries || [];
        this._renderTable(entries);
    },

    _renderTable(entries) {
        const tbody = document.getElementById('ipTableBody');
        const empty = document.getElementById('ipTableEmpty');
        const count = document.getElementById('ipCount');
        if (!tbody || !empty || !count) return;

        count.textContent = entries.length;

        if (entries.length === 0) {
            tbody.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }
        empty.classList.add('hidden');

        tbody.innerHTML = entries.map(e => {
            const date = e.added_at ? e.added_at.substring(0, 10) : '-';
            return `
                <tr class="border-b border-[#1c1c1c]/40">
                    <td class="py-2.5 font-mono text-neutral-200 text-xs lg:text-sm">${this._esc(e.ip)}</td>
                    <td class="py-2.5 text-neutral-400 text-xs lg:text-sm hidden sm:table-cell">${this._esc(e.label || '-')}</td>
                    <td class="py-2.5 text-neutral-500 text-xs hidden md:table-cell">${date}</td>
                    <td class="py-2.5 text-right">
                        <button onclick="WhitelistIP.remove('${this._esc(e.ip)}')"
                            class="text-red-400 hover:text-red-300 text-xs px-2 py-1 hover:bg-red-500/10 rounded transition-colors"
                            title="Hapus">🗑</button>
                    </td>
                </tr>`;
        }).join('');
    },

    // ------------------------------------------------------------------
    // ADD IP
    // ------------------------------------------------------------------

    async add() {
        const ipInput = document.getElementById('newIpInput');
        const labelInput = document.getElementById('newLabelInput');
        if (!ipInput) return;

        const ip = ipInput.value.trim();
        if (!ip) {
            alert('Masukkan IP address.');
            ipInput.focus();
            return;
        }

        const label = (labelInput ? labelInput.value.trim() : '');

        try {
            await this._fetch('POST', '/api/settings/ip-whitelist', { ip, label });
            ipInput.value = '';
            if (labelInput) labelInput.value = '';
            await this.refresh();
        } catch (e) {
            // error already alerted in _fetch
        }
    },

    // ------------------------------------------------------------------
    // REMOVE IP
    // ------------------------------------------------------------------

    async remove(ip) {
        if (!confirm(`Hapus ${ip} dari whitelist?`)) return;
        try {
            await this._fetch('DELETE', `/api/settings/ip-whitelist/${ip}`);
            await this.refresh();
        } catch (e) {
            // error already alerted
        }
    },

    // ------------------------------------------------------------------
    // TOGGLE
    // ------------------------------------------------------------------

    async toggle(enabled) {
        try {
            await this._fetch('POST', '/api/settings/ip-whitelist/toggle', { enabled });
        } catch (e) {
            // revert toggle visual
            const toggle = document.getElementById('whitelistToggle');
            if (toggle) toggle.checked = !enabled;
        }
    },

    // ------------------------------------------------------------------
    // REGENERATE TOKEN
    // ------------------------------------------------------------------

    async regenerate() {
        if (!confirm('Regenerate token?\n\nToken lama akan invalidate semua sesi yang sedang aktif. Lanjut?')) return;
        try {
            const data = await this._fetch('POST', '/api/settings/ip-whitelist/regenerate-token');
            this._newToken = data.token || '';
            document.getElementById('newTokenDisplay').textContent = this._newToken;
            document.getElementById('regenerateModal').classList.remove('hidden');
            await this.loadStatus();
        } catch (e) {
            // error already alerted
        }
    },

    closeRegenerateModal() {
        document.getElementById('regenerateModal').classList.add('hidden');
        this._newToken = '';
    },

    copyNewToken() {
        if (this._newToken) {
            navigator.clipboard.writeText(this._newToken).then(() => {
                alert('Token disalin!');
            }).catch(() => {
                prompt('Copy token:', this._newToken);
            });
        }
    },

    // ------------------------------------------------------------------
    // STATUS + TOGGLE INIT
    // ------------------------------------------------------------------

    async loadStatus() {
        try {
            const data = await this._fetch('GET', '/api/settings/ip-whitelist/status');

            // Toggle
            const toggle = document.getElementById('whitelistToggle');
            if (toggle) toggle.checked = data.enabled;

            // URL token
            const urlDisplay = document.getElementById('tokenUrlDisplay');
            if (urlDisplay) urlDisplay.textContent = data.full_url || '-';

            // Token masked
            const maskedDisplay = document.getElementById('tokenMaskedDisplay');
            if (maskedDisplay) maskedDisplay.textContent = data.token_masked || '-';

            // Public URL input
            const urlInput = document.getElementById('publicUrlInput');
            if (urlInput) urlInput.value = data.public_url || '';

            // QR code
            this._renderQR(data.full_url);

            // Current IP
            const ipDisplay = document.getElementById('currentIpDisplay');
            if (ipDisplay) ipDisplay.textContent = data.current_ip || '-';

            const ipStatus = document.getElementById('currentIpStatus');
            if (ipStatus && data.current_ip) {
                ipStatus.textContent = ''; // status checked later
            }
        } catch (e) {
            // skip — status not critical
        }
    },

    // ------------------------------------------------------------------
    // QR CODE
    // ------------------------------------------------------------------

    _renderQR(url) {
        const container = document.getElementById('qrcode');
        if (!container) return;
        container.innerHTML = '';
        if (!url || url === '-') return;
        try {
            new QRCode(container, {
                text: url,
                width: 140,
                height: 140,
                colorDark: '#000000',
                colorLight: '#ffffff'
            });
        } catch (e) {
            container.innerHTML = '<p class="text-xs text-neutral-500">QR error</p>';
        }
    },

    // ------------------------------------------------------------------
    // SAVE PUBLIC URL
    // ------------------------------------------------------------------

    async savePublicUrl() {
        const input = document.getElementById('publicUrlInput');
        if (!input) return;
        const url = input.value.trim();
        try {
            await this._fetch('POST', '/api/settings/app-public-url', { url });
            await this.loadStatus();
        } catch (e) {
            // error already alerted
        }
    },

    // ------------------------------------------------------------------
    // TRUST ONCE
    // ------------------------------------------------------------------

    async trustOnce(ip) {
        if (!ip) return;
        try {
            await this._fetch('POST', '/api/settings/ip-whitelist', { ip, label: 'Auto (Trust Once)' });
            window.location.href = '/kasir';
        } catch (e) {
            // error already alerted
        }
    },

    // ------------------------------------------------------------------
    // UTILS
    // ------------------------------------------------------------------

    copyToClipboard(elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;
        const text = el.textContent || el.value || '';
        navigator.clipboard.writeText(text).then(() => {
            alert('URL disalin!');
        }).catch(() => {
            prompt('Copy URL:', text);
        });
    },

    _esc(s) {
        if (!s) return '';
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(s));
        return div.innerHTML;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    WhitelistIP.init();
});
