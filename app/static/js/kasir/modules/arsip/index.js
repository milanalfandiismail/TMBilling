// app/static/js/kasir/modules/arsip/index.js

// Tab terpusat "Data Diarsipkan": pill kategori horizontal + panel isi.
const Arsip = {
    kategori: [
        { key: 'grup', label: 'Grup PC / Zona' },
        { key: 'pc', label: 'Unit PC' },
        { key: 'paket', label: 'Paket Billing' },
        { key: 'member', label: 'Member' },
        { key: 'user', label: 'User Staff' },
        { key: 'game', label: 'Game & Aplikasi' },
        { key: 'menu', label: 'Menu FnB' }
    ],

    active: 'grup',
    data: null,

    async load() {
        document.getElementById('arsip-panel').innerHTML = '<div class="h-10 bg-[#202020] rounded m-2"></div>';
        try {
            this.data = await ArsipList.loadAll();
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
                class="px-2.5 py-1 rounded text-[11px] font-bold whitespace-nowrap transition-colors border ${on ? ArsipList.PILL_ON : ArsipList.PILL_OFF}">
                ${k.label} <span id="arsip-count-${k.key}" class="${on ? 'text-black/60' : 'text-neutral-600'}">${count}</span>
            </button>`;
        }).join('');
    },

    renderPanel() {
        ArsipList.mount({
            res: this.active,
            container: 'arsip-panel',
            items: (this.data || {})[this.active] || []
        });
        ArsipList._onChange = () => this.load();
    }
};

window.Arsip = Arsip;
