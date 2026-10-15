// app/static/js/kasir/modules/grup/index.js

const Grup = {
    _lastFingerprint: null,
    _allGrupList: [],
    _hasResizeListener: false,
    _searchTimer: null,
    searchQuery: '',
    currentPage: 1,
    perPage: 7,

    refreshLive() {
        if (typeof App !== 'undefined' && App.currentTab !== 'grup') return;
        const isAppModalOpen = document.getElementById('app-modal') && !document.getElementById('app-modal').classList.contains('hidden');
        if (isAppModalOpen) return;
        return this.load(true);
    },

    async load(isSilent = false) {
        const area = document.getElementById('grup-table');
        if (area && !isSilent && (!this._allGrupList || this._allGrupList.length === 0) && typeof Skeleton !== 'undefined') {
            area.innerHTML = Skeleton.grupTable ? Skeleton.grupTable(5) : (Skeleton.tableRows ? Skeleton.tableRows(5, 4) : '');
        }
        try {
            const data = await API.grup.list();
            const list = data.grup || data.grup_list || [];
            
            const newFingerprint = JSON.stringify(list.map(g => ({ id: g.id, nama: g.nama, warna: g.warna, count: g.pc_count })));
            if (isSilent && this._lastFingerprint === newFingerprint) {
                return; // Data tidak berubah
            }
            this._lastFingerprint = newFingerprint;
            this._allGrupList = list;

            this.updateAllDropdowns(list);
            this.initSearch();
            if (area) this.render();
        } catch (err) {
            if (!isSilent) {
                console.error("Grup Load Error:", err);
            }
        }
    },

    getAdaptivePerPage() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (w >= 1536 || h >= 950) return 8; // 2XL / Ultrawide
        if (w >= 1280 || h >= 800) return 7; // XL Desktop
        if (w >= 1024) return 6;             // Laptop
        if (w >= 768) return 5;              // Tablet
        return 4;                            // Mobile
    },

    initSearch() {
        if (!this._hasResizeListener) {
            this._hasResizeListener = true;
            window.addEventListener('resize', () => {
                if (typeof App !== 'undefined' && App.currentTab === 'grup') {
                    const newPerPage = this.getAdaptivePerPage();
                    if (newPerPage !== this.perPage) {
                        this.perPage = newPerPage;
                        this.render();
                    }
                }
            });
        }
        this.perPage = this.getAdaptivePerPage();
    },

    debouncedSearch() {
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => this.doSearch(), 200);
    },

    doSearch() {
        const input = document.getElementById('grup-search-input');
        const clearBtn = document.getElementById('grup-search-clear');
        this.searchQuery = input ? input.value.trim().toLowerCase() : '';
        if (clearBtn) {
            clearBtn.classList.toggle('hidden', !this.searchQuery);
        }
        this.currentPage = 1;
        this.render();
    },

    clearSearch() {
        const input = document.getElementById('grup-search-input');
        const clearBtn = document.getElementById('grup-search-clear');
        if (input) input.value = '';
        if (clearBtn) clearBtn.classList.add('hidden');
        this.searchQuery = '';
        this.currentPage = 1;
        this.render();
    },

    changePage(page) {
        this.currentPage = page;
        this.render();
    },

    showAddModal() {
        const formHtml = `
            <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-4 sm:p-5 max-w-md w-full shadow-2xl">
                <div class="flex items-center justify-between pb-3 border-b border-[#1c1c1c] mb-3">
                    <div>
                        <h3 class="text-xs sm:text-sm font-bold text-neutral-100 uppercase tracking-wider">Tambah Grup Baru</h3>
                        <p class="text-[10px] sm:text-xs text-neutral-500">Buat zona / kelompok PC baru</p>
                    </div>
                    <button onclick="Modal.closeModal()" class="w-6 h-6 rounded bg-[#171717] border border-[#262626] text-neutral-400 hover:text-white flex items-center justify-center text-xs">&times;</button>
                </div>
                <div class="space-y-3">
                    <div>
                        <label for="modal-grup-nama" class="block text-[10px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Nama Grup <span class="text-red-400">*</span></label>
                        <input type="text" id="modal-grup-nama" maxlength="30" minlength="2" placeholder="Contoh: VIP, REGULER" class="w-full px-2.5 py-1.5 bg-[#050505] border border-[#1c1c1c] rounded text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 font-mono uppercase">
                        <p class="text-[9px] text-neutral-600 mt-0.5">2 - 30 karakter</p>
                    </div>
                    <div>
                        <label for="modal-grup-ket" class="block text-[10px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Keterangan <span class="text-neutral-500 lowercase">(opsional)</span></label>
                        <input type="text" id="modal-grup-ket" maxlength="200" placeholder="Deskripsi zona (opsional)" class="w-full px-2.5 py-1.5 bg-[#050505] border border-[#1c1c1c] rounded text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500">
                    </div>
                    <div>
                        <label for="modal-grup-warna" class="block text-[10px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Warna Grup</label>
                        <div class="flex items-center gap-2 px-2.5 py-1.5 bg-[#050505] border border-[#1c1c1c] rounded">
                            <input type="color" id="modal-grup-warna" value="#3b82f6" class="w-6 h-6 rounded border-0 bg-transparent cursor-pointer">
                            <span class="text-[10px] sm:text-xs text-neutral-400">Warna aksen lencana & map PC</span>
                        </div>
                    </div>
                </div>
                <div class="flex gap-2 justify-end mt-4 pt-3 border-t border-[#1c1c1c]">
                    <button onclick="Modal.closeModal()" class="px-3 py-1.5 bg-[#171717] border border-[#262626] hover:bg-[#222] text-neutral-400 text-xs font-bold rounded transition-colors">Batal</button>
                    <button onclick="Grup.add()" class="px-3 py-1.5 bg-neutral-100 hover:bg-white text-black text-xs font-bold rounded transition-colors flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        Simpan Grup
                    </button>
                </div>
            </div>`;
        Modal.show(formHtml, null, { disableBackdropClose: true });
    },

    async add() {
        const get = (modalId, legacyId) => {
            const m = document.getElementById(modalId);
            if (m) return m;
            return document.getElementById(legacyId);
        };
        const data = {
            nama: (get('modal-grup-nama', 'inp-grup-nama') || {}).value?.trim() || '',
            keterangan: (get('modal-grup-ket', 'inp-grup-ket') || {}).value?.trim() || '',
            warna: (get('modal-grup-warna', 'inp-grup-warna') || {}).value || '#888888'
        };
        if (!data.nama) return Toast.error("Nama grup wajib diisi");
        if (data.nama.length < 2 || data.nama.length > 30) return Toast.error("Nama grup harus 2 - 30 karakter");
        if (data.keterangan && data.keterangan.length > 200) return Toast.error("Keterangan grup maksimal 200 karakter");

        try {
            await API.grup.create(data);
            Toast.success(`Grup ${data.nama} berhasil disimpan`);
            Modal.closeModal();
            this.load();
        } catch (err) {
            Toast.error(err.message);
        }
    },

    showEditModal(id, nama, keterangan, warna) {
        const formHtml = `
            <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-4 sm:p-5 max-w-md w-full shadow-2xl">
                <input type="hidden" id="modal-grup-old-nama" value="${Utils.escapeHtml(nama)}">
                <div class="flex items-center justify-between pb-3 border-b border-[#1c1c1c] mb-3">
                    <div>
                        <h3 class="text-xs sm:text-sm font-bold text-neutral-100 uppercase tracking-wider">Edit Grup PC</h3>
                        <p class="text-[10px] sm:text-xs text-neutral-500">Perbarui informasi grup <strong class="text-neutral-300 font-mono">${Utils.escapeHtml(nama)}</strong></p>
                    </div>
                    <button onclick="Modal.closeModal()" class="w-6 h-6 rounded bg-[#171717] border border-[#262626] text-neutral-400 hover:text-white flex items-center justify-center text-xs">&times;</button>
                </div>
                <div class="space-y-3">
                    <div>
                        <label for="modal-grup-nama" class="block text-[10px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Nama Grup <span class="text-red-400">*</span></label>
                        <input type="text" id="modal-grup-nama" maxlength="30" minlength="2" value="${Utils.escapeHtml(nama)}" class="w-full px-2.5 py-1.5 bg-[#050505] border border-[#1c1c1c] rounded text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 font-mono uppercase">
                        <p class="text-[9px] text-neutral-600 mt-0.5">2 - 30 karakter</p>
                    </div>
                    <div>
                        <label for="modal-grup-ket" class="block text-[10px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Keterangan <span class="text-neutral-500 lowercase">(opsional)</span></label>
                        <input type="text" id="modal-grup-ket" maxlength="200" value="${Utils.escapeHtml(keterangan || '')}" class="w-full px-2.5 py-1.5 bg-[#050505] border border-[#1c1c1c] rounded text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500">
                    </div>
                    <div>
                        <label for="modal-grup-warna" class="block text-[10px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Warna Grup</label>
                        <div class="flex items-center gap-2 px-2.5 py-1.5 bg-[#050505] border border-[#1c1c1c] rounded">
                            <input type="color" id="modal-grup-warna" value="${warna || '#3b82f6'}" class="w-6 h-6 rounded border-0 bg-transparent cursor-pointer">
                            <span class="text-[10px] sm:text-xs text-neutral-400">Warna aksen lencana & map PC</span>
                        </div>
                    </div>
                </div>
                <div class="flex gap-2 justify-end mt-4 pt-3 border-t border-[#1c1c1c]">
                    <button onclick="Modal.closeModal()" class="px-3 py-1.5 bg-[#171717] border border-[#262626] hover:bg-[#222] text-neutral-400 text-xs font-bold rounded transition-colors">Batal</button>
                    <button onclick="Grup.edit(${id})" class="px-3 py-1.5 bg-neutral-100 hover:bg-white text-black text-xs font-bold rounded transition-colors flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                        Simpan Perubahan
                    </button>
                </div>
            </div>`;
        Modal.show(formHtml, null, { disableBackdropClose: true });
    },

    async edit(id) {
        const get = (modalId) => document.getElementById(modalId);
        const data = {
            nama: get('modal-grup-nama')?.value?.trim() || '',
            keterangan: get('modal-grup-ket')?.value?.trim() || '',
            warna: get('modal-grup-warna')?.value || '#888888'
        };
        const oldNama = get('modal-grup-old-nama')?.value;

        if (!data.nama) return Toast.error("Nama grup wajib diisi");
        if (data.nama.length < 2 || data.nama.length > 30) return Toast.error("Nama grup harus 2 - 30 karakter");
        if (data.keterangan && data.keterangan.length > 200) return Toast.error("Keterangan grup maksimal 200 karakter");

        try {
            await API.grup.update(id, data);
            
            // Migrate grid layout and sort settings in dashboard if group name changes
            if (oldNama && data.nama && data.nama !== oldNama) {
                const oldGrid = localStorage.getItem('map_grid_' + oldNama);
                if (oldGrid) localStorage.setItem('map_grid_' + data.nama, oldGrid);
                
                const oldSort = localStorage.getItem('map_autosort_' + oldNama);
                if (oldSort) localStorage.setItem('map_autosort_' + data.nama, oldSort);

                localStorage.removeItem('map_grid_' + oldNama);
                localStorage.removeItem('map_autosort_' + oldNama);
            }

            Toast.success(`Grup ${data.nama} berhasil diperbarui`);
            Modal.closeModal();
            this.load();
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async delete(id, nama) {
        const message = `<div class="text-center"><p class="text-xs sm:text-sm text-neutral-300 font-semibold mb-1">Hapus grup <span class="text-neutral-100 font-bold uppercase font-mono">${Utils.escapeHtml(nama)}</span>?</p><p class="text-[11px] sm:text-xs text-neutral-500">Pastikan tidak ada PC atau Paket yang masih terikat dengan grup ini.</p></div>`;
        Modal.confirm(message, async () => {
            try {
                await API.grup.delete(id);
                Toast.success("Grup berhasil dihapus");
                this.load();
            } catch (err) {
                Toast.error(err.message);
            }
        });
    },

    updateAllDropdowns(list) {
        const modalOptions = list.map(g => `<option value="${g.nama}">${g.nama.toUpperCase()}</option>`).join('');
        ['inp-pc-grup', 'inp-batch-grup', 'inp-paket-grup', 'inp-mem-grup', 'inp-member-grup'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = modalOptions;
        });

        const filterOptions = '<option value="">Semua Grup</option>' + list.map(g => `<option value="${g.id}">${g.nama.toUpperCase()}</option>`).join('');
        ['pc-grup-filter-select', 'paket-grup-filter-select', 'member-grup-filter-select'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const currentVal = el.value;
                el.innerHTML = filterOptions;
                if (currentVal) el.value = currentVal;
            }
        });
    },

    render(list = null) {
        if (Array.isArray(list)) this._allGrupList = list;
        const area = document.getElementById('grup-table');
        if (!area) return;

        let filtered = this._allGrupList || [];
        if (this.searchQuery) {
            const q = this.searchQuery;
            filtered = filtered.filter(g => 
                (g.nama && g.nama.toLowerCase().includes(q)) ||
                (g.keterangan && g.keterangan.toLowerCase().includes(q)) ||
                String(g.id).includes(q)
            );
        }

        if (filtered.length === 0) {
            area.innerHTML = `
                <div class="flex flex-col items-center justify-center py-10 sm:py-14 2xl:py-20 text-neutral-500 bg-[#050505] border border-dashed border-[#1c1c1c] rounded">
                    <svg class="w-8 h-8 2xl:w-10 2xl:h-10 mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 01-2-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                    <p class="text-xs 2xl:text-sm font-bold uppercase tracking-wider text-neutral-400">${this.searchQuery ? 'Grup Tidak Ditemukan' : 'Belum Ada Grup PC'}</p>
                    <p class="text-[10px] 2xl:text-xs text-neutral-600 mt-0.5">${this.searchQuery ? 'Coba kata kunci pencarian lain' : 'Tambahkan zona atau kelompok PC baru'}</p>
                </div>`;
            return;
        }

        const page = this.currentPage || 1;
        const perPage = this.perPage || this.getAdaptivePerPage();
        const total = filtered.length;
        const totalPages = Math.ceil(total / perPage) || 1;
        const safePage = Math.min(Math.max(1, page), totalPages);
        this.currentPage = safePage;
        const startIndex = (safePage - 1) * perPage;
        const pagedList = filtered.slice(startIndex, startIndex + perPage);

        const isKasir = Boolean(window.App && App.user && App.user.role === 'kasir');

        const rowsHtml = pagedList.map(g => {
            const safeNama = Utils.escapeHtml(g.nama);
            const safeKet = Utils.escapeHtml(g.keterangan || '-');
            const color = g.warna || '#3b82f6';
            const pcCount = g.pc_count != null ? g.pc_count : (g.jumlah_pc != null ? g.jumlah_pc : null);

            return `
                <tr class="hover:bg-[#121212] transition-colors">
                    <td class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-center font-mono text-neutral-500 text-xs 2xl:text-sm">
                        #${g.id}
                    </td>
                    <td class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-left">
                        <div class="flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style="background-color: ${color};"></span>
                            <span class="px-2 py-0.5 rounded text-[11px] sm:text-xs 2xl:text-sm font-bold tracking-wide uppercase inline-block font-mono" style="background-color: ${color}18; color: ${color}; border: 1px solid ${color}33;">
                                ${safeNama}
                            </span>
                        </div>
                    </td>
                    <td class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-left">
                        <div class="flex items-center gap-2">
                            <span class="text-neutral-300 text-xs 2xl:text-sm truncate max-w-[150px] sm:max-w-xs xl:max-w-md">${safeKet}</span>
                            ${pcCount != null ? `<span class="hidden sm:inline-flex px-1.5 py-0.2 rounded bg-[#171717] border border-[#222] text-[10px] 2xl:text-xs font-mono text-neutral-400 shrink-0">${pcCount} PC</span>` : ''}
                        </div>
                    </td>
                    <td class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-right remote-hide-action">
                        ${isKasir ? '' : `
                        <div class="flex items-center justify-end gap-1 sm:gap-1.5 remote-hide-action">
                            <button onclick="Grup.showEditModal(${g.id}, '${safeNama}', '${(g.keterangan || '').replace(/'/g, "\\'")}', '${color}')" 
                                class="w-6 h-6 sm:w-7 sm:h-7 2xl:w-8 2xl:h-8 rounded bg-[#171717] border border-[#262626] text-blue-400 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-center shrink-0" 
                                title="Edit Grup">
                                <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5 2xl:w-4 2xl:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            </button>
                            <button onclick="Grup.delete(${g.id}, '${safeNama}')" 
                                class="w-6 h-6 sm:w-7 sm:h-7 2xl:w-8 2xl:h-8 rounded bg-[#171717] border border-[#262626] text-red-400 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center shrink-0" 
                                title="Hapus Grup">
                                <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5 2xl:w-4 2xl:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>`}
                    </td>
                </tr>
            `;
        }).join('');

        let paginationHtml = '';
        if (totalPages > 1) {
            paginationHtml = `
                <div class="flex items-center justify-between py-1.5 2xl:py-2 px-2.5 2xl:px-4 mt-2 2xl:mt-3 bg-[#050505] border border-[#1c1c1c] rounded text-xs 2xl:text-sm font-mono">
                    <button onclick="Grup.changePage(${safePage - 1})" 
                        ${safePage <= 1 ? 'disabled class="px-2 2xl:px-3 py-0.5 2xl:py-1 rounded text-neutral-600 cursor-not-allowed"' : 'class="px-2 2xl:px-3 py-0.5 2xl:py-1 rounded text-neutral-300 hover:text-white hover:bg-[#161616] transition-colors"'}>
                        &larr; Prev
                    </button>
                    <span class="text-neutral-400 text-[10px] sm:text-xs 2xl:text-sm">
                        Hal <strong class="text-neutral-100">${safePage}</strong> dari <strong class="text-neutral-100">${totalPages}</strong> (${total} Grup)
                    </span>
                    <button onclick="Grup.changePage(${safePage + 1})" 
                        ${safePage >= totalPages ? 'disabled class="px-2 2xl:px-3 py-0.5 2xl:py-1 rounded text-neutral-600 cursor-not-allowed"' : 'class="px-2 2xl:px-3 py-0.5 2xl:py-1 rounded text-neutral-300 hover:text-white hover:bg-[#161616] transition-colors"'}>
                        Next &rarr;
                    </button>
                </div>
            `;
        }

        area.innerHTML = `
            <div class="overflow-x-auto w-full border border-[#1c1c1c] rounded">
                <table class="w-full text-xs 2xl:text-sm">
                    <thead>
                        <tr class="text-[10px] sm:text-xs 2xl:text-sm text-neutral-500 uppercase tracking-wider border-b border-[#1c1c1c] bg-[#0c0c0c]">
                            <th class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-center w-12 font-bold">ID</th>
                            <th class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-left font-bold">Nama Grup / Zona</th>
                            <th class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-left font-bold">Keterangan & PC</th>
                            <th class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-right font-bold w-24 sm:w-28 remote-hide-action">Aksi</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#1a1a1a]">
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
            ${paginationHtml}
        `;
    }
};

window.Grup = Grup;
