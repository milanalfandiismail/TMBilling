// app/static/js/kasir/modules/paket/index.js

const Paket = {
    currentPage: 1,
    perPage: 5,
    searchQuery: '',
    currentGrupId: null,
    groups: [],
    _allPaketList: [],
    _lastFingerprint: null,
    _hasResizeListener: false,

    getAdaptivePerPage() {
        const width = window.innerWidth;
        if (width >= 1536) return 11; // 2xl
        if (width >= 1280) return 8;  // xl
        if (width >= 768)  return 7;  // md, lg
        return 5;                     // < md
    },

    _initResizeListener() {
        if (this._hasResizeListener) return;
        this._hasResizeListener = true;
        window.addEventListener('resize', Utils.debounce(() => {
            if (typeof App !== 'undefined' && App.currentTab !== 'paket') return;
            const newPerPage = this.getAdaptivePerPage();
            if (newPerPage !== this.perPage) {
                this.perPage = newPerPage;
                this.renderActiveGroup();
            }
        }, 200));
    },

    resetFilters() {
        this.currentPage = 1;
        this.searchQuery = '';
        const searchInput = document.getElementById('paket-search-input');
        if (searchInput) searchInput.value = '';
        const clearBtn = document.getElementById('paket-search-clear');
        if (clearBtn) clearBtn.classList.add('hidden');
    },

    refreshLive() {
        if (typeof App !== 'undefined' && App.currentTab !== 'paket') return;
        const modalPaket = document.getElementById('modal-tambah-paket');
        const isAppModalOpen = document.getElementById('app-modal') && !document.getElementById('app-modal').classList.contains('hidden');
        if ((modalPaket && !modalPaket.classList.contains('hidden')) || isAppModalOpen) {
            return;
        }
        return this.load(true);
    },

    async load(isSilent = false) {
        this.perPage = this.getAdaptivePerPage();
        this._initResizeListener();

        const area = document.getElementById('paket-table');
        if (area && !isSilent && (!this._allPaketList || this._allPaketList.length === 0) && typeof Skeleton !== 'undefined') {
            area.innerHTML = Skeleton.paketTable(this.getAdaptivePerPage());
        }

        try {
            const [grupResponse, data] = await Promise.all([
                API.grup.list(),
                API.paket.list({
                    q: this.searchQuery || ''
                })
            ]);

            const list = data.paket || [];
            const rawGroups = grupResponse.grup || grupResponse.grup_list || [];
            // Urutkan grup berdasarkan ID ASC
            const groups = [...rawGroups].sort((a, b) => Number(a.id) - Number(b.id));
            this.groups = groups;

            // Default grup jika belum ada atau grup saat ini tidak valid
            if (!this.currentGrupId || !groups.some(g => Number(g.id) === Number(this.currentGrupId))) {
                this.currentGrupId = groups.length > 0 ? Number(groups[0].id) : null;
            }

            const newFingerprint = JSON.stringify({
                q: this.searchQuery,
                grup: this.currentGrupId,
                groups: groups.map(g => ({ id: g.id, nama: g.nama })),
                items: list.map(p => ({ id: p.id, nama: p.nama, harga: p.harga, durasi: p.durasi_menit, grup_id: p.grup_id, aktif: p.is_active }))
            });

            if (isSilent && this._lastFingerprint === newFingerprint) {
                return; // Data tidak berubah
            }
            this._lastFingerprint = newFingerprint;
            this._allPaketList = list;

            // Update dropdown grup pada modal tambah jika ada
            const addSelect = document.getElementById('inp-paket-grup');
            if (addSelect && !isSilent) {
                addSelect.innerHTML = groups.map(g => `<option value="${g.nama}">${g.nama.toUpperCase()}</option>`).join('');
            }
            const modalAddSelect = document.getElementById('modal-paket-grup');
            if (modalAddSelect && !isSilent) {
                modalAddSelect.innerHTML = groups.map(g => `<option value="${g.nama}">${g.nama.toUpperCase()}</option>`).join('');
            }

            // Render Tab Pills Grup & Konten Tabel Grup Aktif
            this.renderTabs();
            this.renderActiveGroup();
        } catch (err) {
            if (!isSilent) {
                Toast.error('Gagal memuat paket');
            }
        }
    },

    renderTabs() {
        const tabsContainer = document.getElementById('paket-group-tabs');
        if (!tabsContainer) return;

        if (!this.groups || this.groups.length === 0) {
            tabsContainer.innerHTML = '<span class="text-[11px] 2xl:text-xs text-neutral-500 py-1">Belum ada grup PC</span>';
            return;
        }

        const tabsHtml = this.groups.map(g => {
            const count = (this._allPaketList || []).filter(p => Number(p.grup_id) === Number(g.id)).length;
            const isActive = Number(this.currentGrupId) === Number(g.id);
            const gColor = g.warna || '#3B82F6';

            if (isActive) {
                return `
                    <button type="button" onclick="Paket.selectGroup(${g.id})"
                        class="px-2.5 sm:px-3 2xl:px-3.5 py-1 sm:py-1.5 2xl:py-2 rounded text-xs 2xl:text-sm font-bold transition-all flex items-center gap-1.5 2xl:gap-2 shrink-0 bg-[#161616] text-white border shadow-sm"
                        style="border-color: ${gColor};">
                        <span class="w-2 h-2 2xl:w-2.5 2xl:h-2.5 rounded-full" style="background-color: ${gColor};"></span>
                        <span class="tracking-wide">${Utils.escapeHtml(g.nama.toUpperCase())}</span>
                        <span class="text-[10px] 2xl:text-xs px-1.5 2xl:px-2 py-0.2 2xl:py-0.5 rounded font-mono bg-[#242424] text-neutral-200 font-bold">${count}</span>
                    </button>
                `;
            } else {
                return `
                    <button type="button" onclick="Paket.selectGroup(${g.id})"
                        class="px-2.5 sm:px-3 2xl:px-3.5 py-1 sm:py-1.5 2xl:py-2 rounded text-xs 2xl:text-sm font-bold transition-all flex items-center gap-1.5 2xl:gap-2 shrink-0 bg-[#0c0c0c] hover:bg-[#141414] text-neutral-400 hover:text-neutral-200 border border-[#1c1c1c]">
                        <span class="w-1.5 h-1.5 2xl:w-2 2xl:h-2 rounded-full opacity-60" style="background-color: ${gColor};"></span>
                        <span class="tracking-wide">${Utils.escapeHtml(g.nama.toUpperCase())}</span>
                        <span class="text-[10px] 2xl:text-xs px-1.5 2xl:px-2 py-0.2 2xl:py-0.5 rounded font-mono bg-[#141414] text-neutral-500 font-semibold">${count}</span>
                    </button>
                `;
            }
        }).join('');

        tabsContainer.innerHTML = tabsHtml;
    },

    selectGroup(grupId) {
        this.currentGrupId = Number(grupId);
        this.currentPage = 1;
        this.renderTabs();
        this.renderActiveGroup();
    },

    renderActiveGroup() {
        if (!this.currentGrupId && this.groups.length > 0) {
            this.currentGrupId = Number(this.groups[0].id);
        }
        const activeGroup = (this.groups || []).find(g => Number(g.id) === Number(this.currentGrupId));
        const filteredList = (this._allPaketList || []).filter(p => Number(p.grup_id) === Number(this.currentGrupId));

        PaketTable.render(filteredList, {
            activeGroup: activeGroup,
            currentPage: this.currentPage,
            perPage: this.perPage
        });
    },

    doSearch() {
        const input = document.getElementById('paket-search-input');
        this.searchQuery = input ? input.value.trim() : '';
        const clearBtn = document.getElementById('paket-search-clear');
        if (clearBtn) {
            clearBtn.classList.toggle('hidden', !this.searchQuery);
        }
        this.currentPage = 1;
        this.load();
    },

    debouncedSearch: Utils.debounce(function() {
        Paket.doSearch();
    }, 400),

    clearSearch() {
        const input = document.getElementById('paket-search-input');
        if (input) input.value = '';
        const clearBtn = document.getElementById('paket-search-clear');
        if (clearBtn) clearBtn.classList.add('hidden');
        this.searchQuery = '';
        this.currentPage = 1;
        this.load();
    },

    changePage(page) {
        if (page < 1) return;
        this.currentPage = page;
        this.renderActiveGroup();
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
        if (data.nama.length < 2 || data.nama.length > 50) return Toast.error('Nama paket harus 2 - 50 karakter');
        if (isNaN(data.durasi_menit) || data.durasi_menit < 1 || data.durasi_menit > 14400) return Toast.error('Durasi harus antara 1 - 14.400 menit');
        if (isNaN(data.harga) || data.harga < 0 || data.harga > 1000000000) return Toast.error('Harga tidak valid (maks. Rp1.000.000.000)');
        if (isNaN(data.kadaluarsa_hari) || data.kadaluarsa_hari < 1 || data.kadaluarsa_hari > 3650) return Toast.error('Masa aktif harus antara 1 - 3.650 hari');

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
            nama: document.getElementById('edit-paket-nama')?.value?.trim() || '',
            durasi_menit: parseInt(document.getElementById('edit-paket-durasi')?.value || '0'),
            harga: parseInt((document.getElementById('edit-paket-harga')?.value || '0').replace(/\./g, '')),
            kadaluarsa_hari: parseInt(document.getElementById('edit-paket-kadaluarsa')?.value || '30')
        };
        if (!data.nama) return Toast.error('Nama paket wajib diisi');
        if (data.nama.length < 2 || data.nama.length > 50) return Toast.error('Nama paket harus 2 - 50 karakter');
        if (isNaN(data.durasi_menit) || data.durasi_menit < 1 || data.durasi_menit > 14400) return Toast.error('Durasi harus antara 1 - 14.400 menit');
        if (isNaN(data.harga) || data.harga < 0 || data.harga > 1000000000) return Toast.error('Harga tidak valid (maks. Rp1.000.000.000)');
        if (isNaN(data.kadaluarsa_hari) || data.kadaluarsa_hari < 1 || data.kadaluarsa_hari > 3650) return Toast.error('Masa aktif harus antara 1 - 3.650 hari');

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
