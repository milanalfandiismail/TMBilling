// app/static/js/kasir/modules/arsip/index.js

// Tab terpusat "Data Diarsipkan": semua entitas arsip dalam satu daftar.
const Arsip = {
    sections: [
        { key: 'grup', label: 'Grup PC / Zona', fields: ['nama'] },
        { key: 'pc', label: 'Unit PC', fields: ['kode', 'nama', 'nama_grup'] },
        { key: 'paket', label: 'Paket Billing', fields: ['nama', 'nama_grup'] },
        { key: 'member', label: 'Member', fields: ['username', 'nama_lengkap'] },
        { key: 'user', label: 'User Staff', fields: ['username', 'role'] },
        { key: 'game', label: 'Game & Aplikasi', fields: ['nama', 'tipe'] },
        { key: 'menu', label: 'Menu FnB', fields: ['nama', 'kategori', 'harga'] }
    ],

    esc(value) {
        return (typeof Utils !== 'undefined' && Utils.escapeHtml)
            ? Utils.escapeHtml(value == null ? '' : String(value))
            : String(value == null ? '' : value);
    },

    title(res, item) {
        return item.kode || item.nama || item.username || `#${item.id}`;
    },

    isActive(item) {
        return item.aktif === undefined ? item.is_active : item.aktif;
    },

    meta(section, item) {
        return section.fields
            .filter(f => f !== 'nama' && f !== 'kode' && f !== 'username' && item[f])
            .map(f => this.esc(item[f]))
            .join(' · ');
    },

    async load() {
        document.getElementById('arsip-sections').innerHTML =
            '<div class="h-10 bg-[#202020] rounded"></div><div class="h-10 bg-[#202020] rounded"></div>';
        try {
            const res = await API.request('/api/v1/kasir/arsip/');
            this.render(res.data || {});
        } catch (e) {
            Toast.error(e.message || 'Gagal memuat data arsip');
            document.getElementById('arsip-sections').innerHTML =
                `<p class="text-xs text-red-400">${this.esc(e.message || 'Gagal memuat data arsip')}</p>`;
        }
    },

    render(data) {
        const container = document.getElementById('arsip-sections');
        const total = Object.values(data).reduce((n, list) => n + (list || []).length, 0);
        if (!total) {
            container.innerHTML = `<p class="text-xs text-neutral-500 py-6 text-center">Belum ada data yang diarsipkan.</p>`;
            return;
        }

        container.innerHTML = this.sections.map(section => {
            const items = data[section.key] || [];
            const rows = items.length
                ? items.map(item => this.row(section, item)).join('')
                : `<p class="text-[11px] text-neutral-600 px-2 py-1.5">Tidak ada data.</p>`;
            return `
                <div class="border border-[#1c1c1c] rounded overflow-hidden">
                    <div class="flex items-center justify-between px-2.5 py-1.5 bg-[#111111] border-b border-[#1c1c1c]">
                        <span class="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-300">${this.esc(section.label)}</span>
                        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1c1c1c] text-neutral-400">${items.length}</span>
                    </div>
                    <div class="divide-y divide-[#161616]">${rows}</div>
                </div>`;
        }).join('');
    },

    row(section, item) {
        const label = this.title(section.key, item);
        const meta = this.meta(section, item);
        const canRestore = this.isActive(item) === false;
        return `
            <div class="flex items-center gap-2 px-2.5 py-1.5">
                <div class="flex-1 min-w-0">
                    <p class="text-[11px] sm:text-xs font-semibold text-neutral-200 truncate">${this.esc(label)}</p>
                    ${meta ? `<p class="text-[10px] text-neutral-500 truncate">${meta}</p>` : ''}
                </div>
                ${canRestore ? `
                <button onclick="Arsip.restore('${section.key}', ${item.id}, '${this.jsString(label)}')"
                    class="w-6 h-6 rounded bg-[#171717] border border-[#262626] text-amber-400 hover:bg-amber-500 hover:text-black transition-colors flex items-center justify-center shadow-sm shrink-0" title="Pulihkan">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a5 5 0 015 5v1M3 10l4-4M3 10l4 4"></path></svg>
                </button>` : ''}
                <button onclick="Arsip.hapus('${section.key}', ${item.id}, '${this.jsString(label)}')"
                    class="w-6 h-6 rounded bg-[#171717] border border-[#262626] text-red-400 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center shadow-sm shrink-0" title="Hapus permanen">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>`;
    },

    jsString(text) {
        return String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    },

    restore(res, id, label) {
        Modal.confirm(`Pulihkan ${label} dari arsip?`, async () => {
            try {
                await API.request(`/api/v1/kasir/${res}/${id}/restore`, { method: 'POST' });
                Toast.success('Data dipulihkan');
                this.load();
            } catch (e) {
                Toast.error(e.message || 'Gagal memulihkan data');
            }
        });
    },

    hapus(res, id, label) {
        Modal.confirm(`Hapus permanen ${label}? Tindakan ini tidak bisa dibatalkan.`,
            async () => {
                try {
                    if (res === 'menu') {
                        await API.request(`/api/v1/kasir/menu/${id}/permanent`, { method: 'DELETE' });
                    } else {
                        await API.request(`/api/v1/kasir/${res}/${id}`, {
                            method: 'DELETE',
                            body: JSON.stringify({ confirm: label })
                        });
                    }
                    Toast.success('Data dihapus permanen');
                    this.load();
                } catch (e) {
                    Toast.error(e.message || 'Gagal menghapus data');
                }
            },
            null,
            { requireCheck: `${label} akan dihapus permanen dan tidak bisa dikembalikan.` });
    }
};

window.Arsip = Arsip;
