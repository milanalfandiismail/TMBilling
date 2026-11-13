// app/static/js/kasir/modules/arsip/index.js

// Tab terpusat "Data Diarsipkan": pill kategori horizontal + panel isi.
const Arsip = {
    kategori: [
        { key: 'grup', label: 'Grup PC / Zona', labelOf: (i) => i.nama, metaOf: (i) => i.keterangan || '', emptyText: 'Belum ada grup diarsipkan' },
        { key: 'pc', label: 'Unit PC', labelOf: (i) => i.kode, metaOf: (i) => i.nama_grup || '', emptyText: 'Belum ada PC diarsipkan' },
        { key: 'paket', label: 'Paket Billing', labelOf: (i) => i.nama, metaOf: (i) => i.nama_grup || '', emptyText: 'Belum ada paket diarsipkan' },
        { key: 'member', label: 'Member', labelOf: (i) => i.username, metaOf: (i) => i.nama_lengkap || '', emptyText: 'Belum ada member diarsipkan' },
        { key: 'user', label: 'User Staff', labelOf: (i) => i.username, metaOf: (i) => i.role || '', emptyText: 'Belum ada user diarsipkan' },
        { key: 'game', label: 'Game & Aplikasi', labelOf: (i) => i.nama, metaOf: (i) => i.tipe || '', emptyText: 'Belum ada game diarsipkan' },
        { key: 'menu', label: 'Menu FnB', labelOf: (i) => i.nama, metaOf: (i) => `${i.transaksi_count || 0} transaksi historis`, emptyText: 'Belum ada menu diarsipkan' }
    ],

    active: 'grup',
    data: null,

    async load() {
        document.getElementById('arsip-panel').innerHTML = '<div class="h-10 bg-[#202020] rounded m-2"></div>';
        try {
            const res = await API.request('/api/v1/kasir/arsip/');
            this.data = res.data || {};
            this.renderPills();
            this.renderPanel();
        } catch (e) {
            Toast.error(e.message || 'Gagal memuat data arsip');
            document.getElementById('arsip-panel').innerHTML =
                `<p class="text-xs text-red-400 px-2.5 py-3">${ArsipList.esc(e.message || 'Gagal memuat data arsip')}</p>`;
        }
    },

    switchKategori(key) {
        this.active = key;
        this.renderPills();
        this.renderPanel();
    },

    renderPills() {
        const data = this.data || {};
        document.getElementById('arsip-pills').innerHTML = this.kategori.map(k => {
            const count = (data[k.key] || []).length;
            const on = k.key === this.active;
            return `<button type="button" id="arsip-pill-${k.key}" onclick="Arsip.switchKategori('${k.key}')"
                class="px-2.5 py-1 rounded text-[11px] font-bold whitespace-nowrap transition-colors ${on ? 'bg-neutral-100 text-black' : 'text-neutral-400 hover:text-neutral-200 hover:bg-[#171717]'}">
                ${k.label} <span id="arsip-count-${k.key}" class="${on ? 'text-black/60' : 'text-neutral-600'}">${count}</span>
            </button>`;
        }).join('');
    },

    renderPanel() {
        const section = this.kategori.find(k => k.key === this.active) || this.kategori[0];
        document.getElementById('arsip-panel').innerHTML = ArsipList.rows({
            items: (this.data || {})[section.key] || [],
            res: section.key,
            labelOf: section.labelOf,
            metaOf: section.metaOf,
            emptyText: section.emptyText
        });
        ArsipList._onChange = () => this.load();
    }
};

window.Arsip = Arsip;
