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
            const totalAll = Object.values(this.data || {}).reduce((sum, list) => sum + (list || []).length, 0);
            const badge = document.getElementById('arsip-total-badge');
            if (badge) badge.textContent = totalAll + ' ITEM';
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
        this.renderGrupPills();
        this.renderPills();
        this.renderPanel();
    },

    switchGrup(id) {
        this.grupFilter = id === null ? null : Number(id);
        ArsipList.setGrup(this.grupFilter);
        this.renderGrupPills();
        this.renderPills();
        this.renderPanel();
    },

    // Pill grup mengikuti kategori yang dibuka: grup tanpa data arsip pada kategori itu tidak tampil.
    renderGrupPills() {
        const el = document.getElementById('arsip-grup-pills');
        if (!el) return;
        const counts = ArsipList.counts((this.data || {})[this.active] || []);
        if (Object.keys(counts).length === 0) {
            this.grupFilter = null;
            ArsipList.setGrup(null);
            el.innerHTML = '';
            el.classList.add('hidden');
            return;
        }
        el.classList.remove('hidden');

        const button = (id, arg, label, color, on) => `
            <button type="button" id="${id}" ${arg === null ? '' : `data-grup="${arg}"`} onclick="Arsip.switchGrup(${arg})"
                class="px-2.5 sm:px-3 py-1.5 rounded-md text-[11px] 2xl:text-xs font-bold tracking-wide uppercase whitespace-nowrap transition-colors border flex items-center gap-1.5 ${on
                    ? 'bg-neutral-100 text-black font-bold border-neutral-100'
                    : 'text-neutral-400 hover:text-neutral-200 border-transparent hover:bg-[#171717]'}">
                ${color ? `<span class="w-1.5 h-1.5 rounded-full" style="background-color: ${color};"></span>` : ''}
                ${ArsipList.esc(label)}
            </button>`;
        const groups = (Array.isArray(this.grupList) ? this.grupList : [])
            .filter(g => counts[String(g.id)]);
        const html = '<span class="text-[10px] font-bold uppercase tracking-widest text-neutral-600 mr-1 shrink-0">Grup</span>' + [button('arsip-grup-all', null, `SEMUA GRUP (${Object.values(counts).reduce((a, b) => a + b, 0)})`, null, this.grupFilter === null)]
            .concat(groups.map(g => button(
                `arsip-grup-${g.id}`,
                Number(g.id),
                `${g.nama.toUpperCase()}${g.aktif === false ? ' · ARSIP' : ''} (${counts[String(g.id)]})`,
                g.warna || '#3b82f6',
                Number(this.grupFilter) === Number(g.id)
            )))
            .join('');
        el.innerHTML = html;
    },

    renderPills() {
        const data = this.data || {};
        document.getElementById('arsip-pills').innerHTML = this.kategori.map(k => {
            // Jumlah ikut filter grup, sama seperti daftar yang tampil di panel.
            const count = (data[k.key] || []).filter(i => ArsipList.match(i)).length;
            const on = k.key === this.active;
            return `<button type="button" id="arsip-pill-${k.key}" onclick="Arsip.switchKategori('${k.key}')"
                class="px-2.5 sm:px-3 py-1.5 rounded-md text-[11px] 2xl:text-xs font-bold uppercase tracking-wide whitespace-nowrap border flex items-center gap-1.5 shrink-0 ${on ? 'bg-neutral-100 text-black border-neutral-100' : 'bg-[#0f0f0f] text-neutral-400 border-[#1f1f1f] hover:text-neutral-200 hover:border-[#333]'}">
                ${k.label} <span id="arsip-count-${k.key}" class="px-1.5 py-0.5 rounded text-[9px] font-mono ${on ? 'bg-black/15 text-black' : 'bg-[#1a1a1a] text-neutral-500'}">${count}</span>
            </button>`;
        }).join('');
    },

    renderPanel() {
        ArsipList.setGrup(this.grupFilter);
        const kat = this.kategori.find(k => k.key === this.active);
        const title = document.getElementById('arsip-panel-title');
        if (title) title.textContent = kat ? kat.label : this.active;
        const target = document.getElementById('arsip-panel-target');
        if (target) {
            const g = (this.grupList || []).find(x => Number(x.id) === Number(this.grupFilter));
            target.textContent = g ? 'GRUP: ' + String(g.nama).toUpperCase() : 'SEMUA GRUP';
        }
        ArsipList.mount({
            res: this.active,
            container: 'arsip-panel',
            items: (this.data || {})[this.active] || []
        });
        ArsipList.onChanged(() => this.load());
    }
};

window.Arsip = Arsip;
