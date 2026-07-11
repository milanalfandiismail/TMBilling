// app/static/js/kasir/modules/paket/index.js

const Paket = {
    currentPage: 1,
    searchQuery: '',
    currentGrupId: '',

    async load() {
        const area = document.getElementById('paket-table');
        if (area) area.innerHTML = '<div class="flex justify-center py-8"><div class="w-6 h-6 border-2 border-[#1c1c1c] border-t-neutral-100 rounded-full animate-spin"></div></div>';

        try {
            const filterSelect = document.getElementById('paket-grup-filter-select');
            if (filterSelect && filterSelect.options.length <= 1) {
                const grupResponse = await API.grup.list();
                const groups = grupResponse.grup || [];
                
                const addSelect = document.getElementById('inp-paket-grup');
                if (addSelect) {
                    addSelect.innerHTML = groups.map(g => `<option value="${g.nama}">${g.nama.toUpperCase()}</option>`).join('');
                }
                
                filterSelect.innerHTML = '<option value="">Semua Grup</option>' + groups.map(g => `<option value="${g.id}">${g.nama.toUpperCase()}</option>`).join('');
            }

            const data = await API.paket.list({
                q: this.searchQuery || '',
                grup_id: this.currentGrupId || ''
            });
            
            const list = data.paket || [];
            this.render(list, data);
        } catch (err) {
            Toast.error('Gagal memuat paket');
        }
    },

    doSearch() {
        this.searchQuery = document.getElementById('paket-search-input').value.trim();
        this.currentGrupId = document.getElementById('paket-grup-filter-select').value;
        this.currentPage = 1;
        this.load();
    },

    debouncedSearch: Utils.debounce(function() {
        Paket.doSearch();
    }, 500),

    clearSearch() {
        document.getElementById('paket-search-input').value = '';
        document.getElementById('paket-grup-filter-select').value = '';
        this.searchQuery = '';
        this.currentGrupId = '';
        this.currentPage = 1;
        this.load();
    },

    changePage(page) {
        if (page < 1) return;
        this.currentPage = page;
        this.load();
    },

    async add() {
        const get = (modalId, legacyId) => {
            const m = document.getElementById(modalId);
            if (m) return m;
            return document.getElementById(legacyId);
        };
        const data = {
            nama: (get('modal-paket-nama', 'inp-paket-nama') || {}).value?.trim() || '',
            grup: (get('modal-paket-grup', 'inp-paket-grup') || {}).value || '',
            durasi_menit: parseInt((get('modal-paket-durasi', 'inp-paket-durasi') || {}).value || '0'),
            harga: parseInt(((get('modal-paket-harga', 'inp-paket-harga') || {}).value || '0').replace(/\./g, '')),
            kadaluarsa_hari: parseInt((get('modal-paket-kadaluarsa', 'inp-paket-kadaluarsa') || {}).value || '30')
        };
        if (!data.nama) return Toast.error('Nama paket wajib diisi');
        if (isNaN(data.durasi_menit) || data.durasi_menit <= 0) return Toast.error('Durasi tidak valid');
        if (isNaN(data.harga) || data.harga < 0) return Toast.error('Harga tidak valid');

        try {
            await API.paket.create(data);
            Toast.success(`Paket ${data.nama} berhasil dibuat`);
            Modal.closeModal();
            this.load();
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async edit(id) {
        try {
            const [paketResponse, grupResponse] = await Promise.all([
                API.paket.list(),
                API.grup.list()
            ]);
            const listPaket = paketResponse.paket || paketResponse.paket_list || [];
            const paket = listPaket.find(p => p.id === id);
            if (!paket) return Toast.error('Paket tidak ditemukan');
            const groups = grupResponse.grup || [];
            this.showEditModal(paket, groups);
        } catch (err) {
            Toast.error('Gagal memuat data edit');
        }
    },

    async doEdit(id) {
        const data = {
            nama: document.getElementById('edit-paket-nama').value.trim(),
            durasi_menit: parseInt(document.getElementById('edit-paket-durasi').value),
            harga: parseInt((document.getElementById('edit-paket-harga').value || '0').replace(/\./g, '')),
            kadaluarsa_hari: parseInt(document.getElementById('edit-paket-kadaluarsa').value)
        };
        if (!data.nama || isNaN(data.durasi_menit) || isNaN(data.harga)) return Toast.error('Lengkapi data');
        try {
            await API.paket.update(id, data);
            Toast.success('Paket berhasil diperbarui');
            Modal.closeModal();
            this.load();
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async delete(id) {
        const message = '<div class="text-center"><p class="text-xs lg:text-base text-neutral-400">Hapus paket ini? Sesi berjalan tidak terpengaruh.</p></div>';
        Modal.confirm(message, async () => {
            try {
                await API.paket.delete(id);
                Toast.success('Paket berhasil dihapus');
                this.load();
            } catch (err) {
                Toast.error(err.message);
            }
        });
    },

    clearForm() {
        ['inp-paket-nama', 'inp-paket-durasi', 'inp-paket-harga'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const kadal = document.getElementById('inp-paket-kadaluarsa');
        if (kadal) kadal.value = '30';
    },

    suggestName(isEdit = false) {
        const prefix = isEdit ? 'edit' : 'inp';
        const grupEl = document.getElementById(`${prefix}-paket-grup`);
        const durasiEl = document.getElementById(`${prefix}-paket-durasi`);
        const namaEl = document.getElementById(`${prefix}-paket-nama`);
        if (!grupEl || !durasiEl || !namaEl) return;
        const grup = grupEl.value;
        const durasi = parseInt(durasiEl.value);
        if (grup && !isNaN(durasi)) {
            let textDurasi = "";
            if (durasi >= 60) {
                const jam = durasi / 60;
                textDurasi = Number.isInteger(jam) ? `${jam} Jam` : `${jam.toFixed(1)} Jam`;
            } else {
                textDurasi = `${durasi} Menit`;
            }
            namaEl.value = `${grup.toUpperCase()} - ${textDurasi}`;
        }
    }
};

Object.assign(Paket, PaketTable);
Object.assign(Paket, PaketModal);
window.Paket = Paket;
