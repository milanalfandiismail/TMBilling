// app/static/js/kasir/core/arsip_list.js
// Satu renderer baris arsip untuk tab Data Diarsipkan dan pill arsip tiap tab.
const ArsipList = {
    _refresh: null,

    esc(value) {
        return (typeof Utils !== 'undefined' && Utils.escapeHtml)
            ? Utils.escapeHtml(value == null ? '' : String(value))
            : String(value == null ? '' : value);
    },

    async fetch(key) {
        const payload = await API.request('/api/v1/kasir/arsip/');
        const data = payload.data || {};
        return data[key] || [];
    },

    async mount({ res, container, labelOf, metaOf, emptyText, onChange }) {
        this._refresh = () => this.mount({ res, container, labelOf, metaOf, emptyText, onChange });
        this._onChange = onChange || null;
        try {
            const items = await this.fetch(res);
            container.innerHTML = this.rows({ items, res, labelOf, metaOf, emptyText });
        } catch (e) {
            container.innerHTML = `<p class="text-xs text-red-400 px-2.5 py-3">${this.esc(e.message || 'Gagal memuat data arsip')}</p>`;
        }
    },

    rows({ items, res, labelOf, metaOf, emptyText }) {
        if (!items || !items.length) {
            return `<p class="text-xs text-neutral-500 py-6 text-center">${this.esc(emptyText || 'Belum ada data diarsipkan')}</p>`;
        }
        return `<div class="divide-y divide-[#161616]">${items.map(item => {
            const label = labelOf ? labelOf(item) : (item.nama || item.kode || item.username || `#${item.id}`);
            const meta = metaOf ? metaOf(item) : '';
            return `
            <div class="flex items-center gap-2 px-2.5 py-1.5">
                <div class="flex-1 min-w-0">
                    <p class="text-[11px] sm:text-xs font-semibold text-neutral-200 truncate">${this.esc(label)}</p>
                    ${meta ? `<p class="text-[10px] text-neutral-500 truncate">${this.esc(meta)}</p>` : ''}
                </div>
                <button onclick="ArsipList.restore('${res}', ${item.id}, '${this.jsString(label)}')"
                    class="w-6 h-6 rounded bg-[#171717] border border-[#262626] text-amber-400 hover:bg-amber-500 hover:text-black transition-colors flex items-center justify-center shadow-sm shrink-0" title="Pulihkan">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a5 5 0 015 5v1M3 10l4-4M3 10l4 4"></path></svg>
                </button>
                <button onclick="ArsipList.hapus('${res}', ${item.id}, '${this.jsString(label)}')"
                    class="w-6 h-6 rounded bg-[#171717] border border-[#262626] text-red-400 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center shadow-sm shrink-0" title="Hapus permanen">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>`;
        }).join('')}</div>`;
    },

    jsString(text) {
        return String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    },

    restore(res, id, label) {
        Modal.confirm(`Pulihkan ${label} dari arsip?`, async () => {
            try {
                await API.request(`/api/v1/kasir/${res}/${id}/restore`, { method: 'POST' });
                Toast.success('Data dipulihkan');
                this._changed();
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
                    this._changed();
                } catch (e) {
                    Toast.error(e.message || 'Gagal menghapus data');
                }
            },
            null,
            { requireCheck: `${label} akan dihapus permanen dan tidak bisa dikembalikan.` });
    },

    _changed() {
        if (this._onChange) this._onChange();
        else if (this._refresh) this._refresh();
    }
};

window.ArsipList = ArsipList;
