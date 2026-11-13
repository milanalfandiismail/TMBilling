// app/static/js/kasir/core/arsip_list.js
// Skema kolom arsip per resource + renderer bersama. Arsip selalu memakai bentuk
// dan kolom yang sama dengan data aktif di tabnya (tabel tetap tabel, kartu tetap kartu).
const ArsipList = {
    _refresh: null,

    // head = kolom tabel aktif apa adanya; cells sejajar dengan head.
    SCHEMA: {
        grup: {
            layout: 'table',
            head: ['ID', 'Nama Grup / Zona', 'Keterangan & PC'],
            emptyText: 'Belum ada grup diarsipkan',
            cells: [g => g.id, g => g.nama, g => g.keterangan || '-']
        },
        paket: {
            layout: 'table',
            head: ['Paket', 'Durasi', 'Harga', 'Masa Aktif'],
            emptyText: 'Belum ada paket diarsipkan',
            cells: [p => p.nama, p => `${p.durasi_menit} menit`,
                p => Utils.formatRupiah(p.harga), p => `${p.kadaluarsa_hari} hari`]
        },
        member: {
            layout: 'table',
            head: ['Member', 'Grup', 'Waktu', 'Berlaku Sampai', 'Status'],
            emptyText: 'Belum ada member diarsipkan',
            cells: [m => m.username + (m.nama_lengkap ? ` - ${m.nama_lengkap}` : ''),
                m => m.grup || '-', m => `${m.waktu_tersimpan ?? 0} menit`,
                m => m.kadaluarsa_pada_display || '-', () => 'ARSIP']
        },
        user: {
            layout: 'table',
            head: ['Operator', 'Role', 'Benefit Bermain', 'Status'],
            action: 'Kelola',
            emptyText: 'Belum ada user diarsipkan',
            cells: [u => u.username, u => u.role,
                u => u.kuota_main_bulanan ? `${u.sisa_kuota_menit}/${u.kuota_main_bulanan} menit` : '-',
                () => 'ARSIP']
        },
        game: {
            layout: 'table',
            head: ['Item, Cover & Path', 'Jenis', 'Kategori / Genre', 'Publik'],
            emptyText: 'Belum ada game diarsipkan',
            cells: [g => g.nama, g => g.tipe || '-', g => g.kategori || '-', () => 'Tidak']
        },
        pc: {
            layout: 'card',
            emptyText: 'Belum ada PC diarsipkan',
            labelOf: p => p.kode,
            metaOf: p => p.ip_address || '-'
        },
        menu: {
            layout: 'card',
            emptyText: 'Belum ada menu diarsipkan',
            labelOf: m => m.nama,
            metaOf: m => `${m.transaksi_count || 0} transaksi historis · ${Utils.formatRupiah(m.harga)}`,
            imageOf: m => m.gambar_path
        }
    },

    PILL_BASE: 'px-2.5 py-1 rounded text-[11px] ',
    PILL_ON: 'bg-neutral-100 text-black font-bold',
    PILL_OFF: 'text-neutral-400 hover:text-neutral-200 hover:bg-[#171717] font-medium',

    esc(value) {
        return (typeof Utils !== 'undefined' && Utils.escapeHtml)
            ? Utils.escapeHtml(value == null ? '' : String(value))
            : String(value == null ? '' : value);
    },

    schemaOf(res) {
        return this.SCHEMA[res] || { layout: 'card', emptyText: 'Belum ada data diarsipkan' };
    },

    async fetch(key) {
        const items = await this.loadAll();
        return items[key] || [];
    },

    async loadAll() {
        const payload = await API.request('/api/v1/kasir/arsip/');
        return payload.data || {};
    },

    async mount({ res, container, items }) {
        const el = typeof container === 'string' ? document.getElementById(container) : container;
        if (!el) return;
        this._refresh = () => this.mount({ res, container });
        try {
            const list = items || await this.fetch(res);
            el.innerHTML = list.length
                ? this.render({ items: list, res })
                : `<p class="text-xs text-neutral-500 text-center py-6">${this.esc(this.schemaOf(res).emptyText)}</p>`;
        } catch (e) {
            el.innerHTML = `<p class="text-xs text-red-400 px-2.5 py-3">${this.esc(e.message || 'Gagal memuat data arsip')}</p>`;
        }
    },

    render({ items, res }) {
        return this.schemaOf(res).layout === 'card'
            ? this.cards({ items, res })
            : this.table({ items, res });
    },

    // Alias lama: pemanggil yang masih memakai labelOf/metaOf mendapat bentuk yang benar.
    table({ items, res }) {
        const schema = this.schemaOf(res);
        const head = schema.head || [];
        const actionHead = schema.action || 'Aksi';
        const th = (label, i) => {
            const align = i === 0 ? 'text-left' : 'text-center';
            return `<th class="px-2 sm:px-3 py-2 ${align} font-bold">${this.esc(label)}</th>`;
        };
        const header = head.map(th).join('') +
            `<th class="px-2 sm:px-3 py-2 text-right font-bold w-16 sm:w-20">${this.esc(actionHead)}</th>`;
        const body = items.map(item => {
            const cells = (schema.cells || []).map((fn, i) => {
                const align = i === 0 ? 'text-left' : 'text-center';
                return `<td class="px-2 sm:px-3 py-2 ${align} text-neutral-300">${this.esc(fn(item))}</td>`;
            }).join('');
            return `<tr class="hover:bg-[#0d0d0d]">${cells}
                <td class="px-2 sm:px-3 py-2 text-right">${this.actions(res, item, schema)}</td>
            </tr>`;
        }).join('');
        return `<div class="overflow-x-auto w-full">
            <table class="w-full text-xs 2xl:text-sm">
                <thead>
                    <tr class="text-[10px] sm:text-xs 2xl:text-sm text-neutral-500 uppercase tracking-wider border-b border-[#1c1c1c] bg-[#0c0c0c]">${header}</tr>
                </thead>
                <tbody class="divide-y divide-[#1a1a1a]">${body}</tbody>
            </table>
        </div>`;
    },

    cards({ items, res }) {
        const schema = this.schemaOf(res);
        const isMenu = res === 'menu';
        const grid = isMenu
            ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3'
            : 'grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-2.5 2xl:gap-3';
        const body = items.map(item => {
            const label = schema.labelOf ? schema.labelOf(item) : (item.nama || item.kode || `#${item.id}`);
            const meta = schema.metaOf ? schema.metaOf(item) : '';
            const img = isMenu && schema.imageOf ? API.resolveMediaUrl(schema.imageOf(item)) : null;
            const preview = isMenu
                ? (img
                    ? `<div class="w-full aspect-[4/3] overflow-hidden border-b border-[#1f1f1f] bg-[#0c0c0c]">
                           <img src="${img}" alt="${this.esc(label)}" class="w-full h-full object-cover object-center" loading="lazy">
                       </div>`
                    : `<div class="w-full aspect-[4/3] border-b border-[#1f1f1f] bg-[#090909] flex items-center justify-center text-[9px] text-neutral-600">No Image</div>`)
                : '';
            return `<div class="${isMenu
                ? 'bg-[#0c0c0c] border border-[#1c1c1c] rounded-lg overflow-hidden flex flex-col'
                : 'bg-[#0c0c0c] border border-[#1a1a1a] rounded p-2.5 sm:p-3 min-h-[82px] flex flex-col justify-between opacity-60'}">
                ${preview}
                <div class="${isMenu ? 'p-2 sm:p-2.5 flex flex-col gap-1 flex-1' : ''}">
                    <p class="text-[11px] sm:text-xs font-semibold text-neutral-200 truncate" title="${this.esc(label)}">${this.esc(label)}</p>
                    ${meta ? `<p class="text-[9px] sm:text-[10px] text-neutral-500 truncate">${this.esc(meta)}</p>` : ''}
                    <div class="flex items-center gap-1 mt-auto pt-1.5">${this.actions(res, item, schema)}</div>
                </div>
            </div>`;
        }).join('');
        return `<div class="${grid} p-2 sm:p-2.5">${body}</div>`;
    },

    actions(res, item, schema) {
        const label = schema.labelOf ? schema.labelOf(item) : (item.nama || item.kode || item.username || `#${item.id}`);
        const arg = this.jsString(label);
        return `<span class="inline-flex items-center gap-1">
            <button onclick="ArsipList.restore('${res}', ${item.id}, '${arg}')"
                class="w-6 h-6 rounded bg-[#171717] border border-[#262626] text-amber-400 hover:bg-amber-500 hover:text-black transition-colors flex items-center justify-center shrink-0" title="Pulihkan">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a5 5 0 015 5v1M3 10l4-4M3 10l4 4"></path></svg>
            </button>
            <button onclick="ArsipList.hapus('${res}', ${item.id}, '${arg}')"
                class="w-6 h-6 rounded bg-[#171717] border border-[#262626] text-red-400 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center shrink-0" title="Hapus permanen">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        </span>`;
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
