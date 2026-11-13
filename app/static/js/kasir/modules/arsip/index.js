// app/static/js/kasir/modules/arsip/index.js

// Tab terpusat "Data Diarsipkan": pill grup + pill kategori horizontal + panel isi.
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
    grupList: [],
    grupFilter: null,

    async load() {
        document.getElementById('arsip-panel').innerHTML = '<div class="h-10 bg-[#202020] rounded m-2"></div>';
        try {
            this.data = await ArsipList.loadAll();
            const groups = await API.grup.list({ include_arsip: true });
            this.grupList = groups.grup || groups.grup_list || (Array.isArray(groups) ? groups : []);
            this.renderGrupPills();
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

    switchGrup(id) {
        this.grupFilter = id === null ? null : Number(id);
        ArsipList.setGrup(this.grupFilter);
        this.renderGrupPills();
        this.renderPanel();
    },

    // Pill grup selalu ada, termasuk grup yang sudah diarsipkan, supaya isinya bisa difilter lalu dipulihkan.
    renderGrupPills() {
        const groups = Array.isArray(this.grupList) ? this.grupList : [];
        const pill = (id, label, color, on) => `<button type="button" id="${id}"
                onclick="Arsip.switchGrup(${id === 'arsip-grup-all' ? 'null' : id.split('-').pop()})"
                class="px-2.5 py-1 rounded text-[11px] whitespace-nowrap transition-colors border flex items-center gap-1.5 ${on ? 'bg-neutral-100 text-black font-bold border-neutral-100' : 'text-neutral-400 hover:text-neutral-200 border-transparent hover:bg-[#171717]'}">
                ${color ? `<span class="w-1.5 h-1.5 rounded-full" style="background-color:${color};"></span>` : ''}${ArsipList.esc(label)}
            </button>`;
        const html = [pill('arsip-grup-all', 'Semua Grup', null, this.grupFilter === null)]
            .concat(groups.map(g => pill(`arsip-grup-${g.id}`, `${g.nama}${g.aktif === false ? ' · arsip' : ''}`, g.warna || '#3b82f6', Number(this.grupFilter) === Number(g.id))))
            .join('');
        const el = document.getElementById('arsip-grup-pills');
        if (el) el.innerHTML = html;
    },

    switchGrup(id) {
        this.grupFilter = id === null ? null : Number(id);
        ArsipList.setGrup(this.grupFilter);
        this.renderGrupPills();
        this.renderPanel();
    },

    // Pill grup selalu ada - termasuk grup yang sudah diarsipkan - supaya isinya bisa difilter lalu dipulihkan.
    renderGrupPills() {
        const groups = Array.isArray(this.grupList) ? this.grupList : [];
        const button = (id, arg, label, color, on) => `
            <button type="button" id="${id}" onclick="Arsip.switchGrup(${arg})"
                class="px-2.5 py-1 rounded text-[11px] whitespace-nowrap transition-colors border flex items-center gap-1.5 ${on
                    ? 'bg-neutral-100 text-black font-bold border-neutral-100'
                    : 'text-neutral-400 hover:text-neutral-200 border-transparent hover:bg-[#171717]'}">
                ${color ? `<span class="w-1.5 h-1.5 rounded-full" style="background-color: ${color};"></span>` : ''}
                ${ArsipList.esc(label)}
            </button>`;
        const html = [button('arsip-grup-all', 'null', 'Semua Grup', null, this.grupFilter === null)]
            .concat(groups.map(g => button(
                `arsip-grup-${g.id}`,
                Number(g.id),
                `${g.nama}${g.aktif === false ? ' · arsip' : ''}`,
                g.warna || '#3b82f6',
                Number(this.grupFilter) === Number(g.id)
            )))
            .join('');
        const el = document.getElementById('arsip-grup-pills');
        if (el) el.innerHTML = html;
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
        ArsipList.setGrup(this.grupFilter);
        ArsipList.mount({
            res: this.active,
            container: 'arsip-panel',
            items: (this.data || {})[this.active] || []
        });
        ArsipList.onChanged(() => this.load());
    }
};

window.Arsip = Arsip;
