// app/static/js/kasir/modules/user/index.js

const User = {
    editingId: null,
    _lastFingerprint: null,
    _allUsers: [],
    _hasResizeListener: false,
    _searchTimer: null,
    searchQuery: '',
    currentPage: 1,
    perPage: 7,

    refreshLive() {
        if (typeof App !== 'undefined' && App.currentTab !== 'user') return;
        const isAppModalOpen = document.getElementById('app-modal') && !document.getElementById('app-modal').classList.contains('hidden');
        if (isAppModalOpen) return;
        return this.load(true);
    },

    async load(isSilent = false) {
        const area = document.getElementById('user-table');
        if (!area) return;
        if (!isSilent && (!this._allUsers || this._allUsers.length === 0) && typeof Skeleton !== 'undefined') {
            area.innerHTML = Skeleton.userTable ? Skeleton.userTable(5) : '';
        }

        try {
            const data = await API.user.list();
            const users = data || [];
            const newFingerprint = JSON.stringify(users.map(u => ({ id: u.id, username: u.username, role: u.role, aktif: u.aktif, kuota_dasar: u.kuota_main_bulanan, kuota_sisa: u.sisa_kuota_menit })));

            if (isSilent && this._lastFingerprint === newFingerprint) {
                return; // Data tidak berubah
            }
            this._lastFingerprint = newFingerprint;
            this._allUsers = users;

            this.initSearch();
            this.render();
        } catch (err) {
            if (!isSilent) {
                area.innerHTML = '<div class="text-center text-red-400 py-10 text-xs sm:text-sm font-mono">Gagal memuat data kasir</div>';
                if (err.message && err.message.includes("Akses Ditolak")) {
                    area.innerHTML = '<div class="text-center text-red-400 py-10 text-xs sm:text-sm font-mono">Akses Ditolak. Anda bukan admin.</div>';
                }
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
                if (typeof App !== 'undefined' && App.currentTab === 'user') {
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
        const input = document.getElementById('user-search-input');
        const clearBtn = document.getElementById('user-search-clear');
        this.searchQuery = input ? input.value.trim().toLowerCase() : '';
        if (clearBtn) {
            clearBtn.classList.toggle('hidden', !this.searchQuery);
        }
        this.currentPage = 1;
        this.render();
    },

    clearSearch() {
        const input = document.getElementById('user-search-input');
        const clearBtn = document.getElementById('user-search-clear');
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

    render(users = null) {
        if (Array.isArray(users)) this._allUsers = users;
        const area = document.getElementById('user-table');
        if (!area) return;

        let filtered = this._allUsers || [];
        if (this.searchQuery) {
            const q = this.searchQuery;
            filtered = filtered.filter(u => 
                (u.username && u.username.toLowerCase().includes(q)) ||
                (u.nama_lengkap && u.nama_lengkap.toLowerCase().includes(q)) ||
                (u.role && u.role.toLowerCase().includes(q))
            );
        }

        if (filtered.length === 0) {
            area.innerHTML = `
                <div class="flex flex-col items-center justify-center py-10 sm:py-14 2xl:py-20 text-neutral-500 bg-[#050505] border border-dashed border-[#1c1c1c] rounded">
                    <svg class="w-8 h-8 2xl:w-10 2xl:h-10 mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                    <p class="text-xs 2xl:text-sm font-bold uppercase tracking-wider text-neutral-400">${this.searchQuery ? 'Staff Tidak Ditemukan' : 'Belum Ada User Staff'}</p>
                    <p class="text-[10px] 2xl:text-xs text-neutral-600 mt-0.5">${this.searchQuery ? 'Coba kata kunci pencarian lain' : 'Daftarkan akun kasir atau admin baru'}</p>
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

        const rowsHtml = pagedList.map(u => {
            const roleBadge = u.role === 'admin'
                ? '<span class="px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold bg-[#2d1215] text-red-400 border border-red-900/30 uppercase tracking-wide">Admin</span>'
                : '<span class="px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold bg-[#171717] text-neutral-300 border border-[#262626] uppercase tracking-wide">Staff</span>';

            const statusBadge = u.aktif
                ? '<span class="inline-flex items-center gap-1.5 text-[11px] sm:text-xs text-emerald-400 font-mono"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>Aktif</span>'
                : '<span class="inline-flex items-center gap-1.5 text-[11px] sm:text-xs text-neutral-500 font-mono"><span class="w-1.5 h-1.5 rounded-full bg-neutral-600"></span>Nonaktif</span>';

            const kuotaDisplay = u.role === 'kasir'
                ? `<div class="inline-flex items-center gap-1.5 font-mono text-xs 2xl:text-sm">
                    <span class="text-neutral-200 font-medium">${Math.floor((u.sisa_kuota_menit || 0) / 60)}j ${(u.sisa_kuota_menit || 0) % 60}m</span>
                    <span class="text-neutral-500 text-[10px] sm:text-xs">/ ${Math.floor((u.kuota_main_bulanan || 0) / 60)} Jam</span>
                    <button onclick="User.resetKuota(${u.id}, '${Utils.escapeHtml(u.username)}')" title="Reset Kuota Bermain" class="p-1 hover:bg-[#1a1a1a] rounded text-amber-400/80 hover:text-amber-400 transition-colors flex items-center justify-center">
                        <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    </button>
                   </div>`
                : '<span class="text-neutral-600 text-xs font-mono">-</span>';

            const initial = (u.username || '?').charAt(0).toUpperCase();

            return `
                <tr class="hover:bg-[#121212] transition-colors">
                    <td class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-left">
                        <div class="flex items-center gap-2 sm:gap-2.5">
                            <div class="w-6 h-6 sm:w-7 sm:h-7 2xl:w-8 2xl:h-8 rounded bg-[#171717] border border-[#262626] flex items-center justify-center text-neutral-200 font-bold text-xs 2xl:text-sm shrink-0">
                                ${initial}
                            </div>
                            <div class="min-w-0">
                                <div class="font-bold text-neutral-200 text-xs 2xl:text-sm truncate font-mono">${Utils.escapeHtml(u.username)}</div>
                                <div class="text-[10px] sm:text-xs text-neutral-500 truncate">${Utils.escapeHtml(u.nama_lengkap || '-')}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-center">
                        ${roleBadge}
                    </td>
                    <td class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-left">
                        ${kuotaDisplay}
                    </td>
                    <td class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-center">
                        ${statusBadge}
                    </td>
                    <td class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-right">
                        <div class="flex items-center justify-end gap-1 sm:gap-1.5">
                            <button onclick="User.edit(${u.id})" 
                                class="w-6 h-6 sm:w-7 sm:h-7 2xl:w-8 2xl:h-8 rounded bg-[#171717] border border-[#262626] text-neutral-300 hover:bg-neutral-100 hover:text-black transition-colors flex items-center justify-center shrink-0" 
                                title="Edit Akun">
                                <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5 2xl:w-4 2xl:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            </button>
                            <button onclick="User.delete(${u.id}, '${Utils.escapeHtml(u.username)}')" 
                                class="w-6 h-6 sm:w-7 sm:h-7 2xl:w-8 2xl:h-8 rounded bg-[#171717] border border-[#262626] text-red-400 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center shrink-0" 
                                title="Hapus Akun">
                                <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5 2xl:w-4 2xl:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        let paginationHtml = '';
        if (totalPages > 1) {
            paginationHtml = `
                <div class="flex items-center justify-between py-1.5 2xl:py-2 px-2.5 2xl:px-4 mt-2 2xl:mt-3 bg-[#050505] border border-[#1c1c1c] rounded text-xs 2xl:text-sm font-mono">
                    <button onclick="User.changePage(${safePage - 1})" 
                        ${safePage <= 1 ? 'disabled class="px-2 2xl:px-3 py-0.5 2xl:py-1 rounded text-neutral-600 cursor-not-allowed"' : 'class="px-2 2xl:px-3 py-0.5 2xl:py-1 rounded text-neutral-300 hover:text-white hover:bg-[#161616] transition-colors"'}>
                        &larr; Prev
                    </button>
                    <span class="text-neutral-400 text-[10px] sm:text-xs 2xl:text-sm">
                        Hal <strong class="text-neutral-100">${safePage}</strong> dari <strong class="text-neutral-100">${totalPages}</strong> (${total} User)
                    </span>
                    <button onclick="User.changePage(${safePage + 1})" 
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
                            <th class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-left font-bold">Operator</th>
                            <th class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-center font-bold">Role</th>
                            <th class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-left font-bold">Benefit Bermain</th>
                            <th class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-center font-bold">Status</th>
                            <th class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-2.5 text-right font-bold w-24 sm:w-28">Kelola</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#1a1a1a]">
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
            ${paginationHtml}
        `;
    },

    openAddModal() { this.showFormModal(); },

    showFormModal(userData = null) {
        this.editingId = userData ? userData.id : null;
        const isEdit = !!userData;

        const modalHtml = `
            <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-4 sm:p-5 max-w-lg w-full shadow-2xl">
                <div class="flex items-center justify-between pb-3 border-b border-[#1c1c1c] mb-3">
                    <div>
                        <h3 class="text-xs sm:text-sm font-bold text-neutral-100 uppercase tracking-wider">${isEdit ? 'Edit Akun Staff' : 'Tambah Staff Baru'}</h3>
                        <p class="text-[10px] sm:text-xs text-neutral-500">${isEdit ? 'Perbarui informasi dan hak akses pengguna' : 'Daftarkan staf kasir atau administrator sistem'}</p>
                    </div>
                    <button onclick="Modal.closeModal()" class="w-6 h-6 rounded bg-[#171717] border border-[#262626] text-neutral-400 hover:text-white flex items-center justify-center text-xs">&times;</button>
                </div>
                <div class="space-y-3">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                        <div>
                            <label for="inp-user-username" class="block text-[10px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Username <span class="text-red-400">*</span></label>
                            <input type="text" id="inp-user-username" maxlength="30" minlength="3" placeholder="Contoh: kasir1" value="${userData ? Utils.escapeHtml(userData.username) : ''}" class="w-full px-2.5 py-1.5 bg-[#050505] border border-[#1c1c1c] rounded text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 font-mono">
                            <p class="text-[9px] text-neutral-600 mt-0.5">3 - 30 karakter</p>
                        </div>
                        <div>
                            <label for="inp-user-nama" class="block text-[10px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Nama Lengkap</label>
                            <input type="text" id="inp-user-nama" maxlength="100" placeholder="Contoh: John Doe" value="${userData ? Utils.escapeHtml(userData.nama_lengkap || '') : ''}" class="w-full px-2.5 py-1.5 bg-[#050505] border border-[#1c1c1c] rounded text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500">
                        </div>
                    </div>
                    <div>
                        <label for="inp-user-pass" class="block text-[10px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Password ${isEdit ? '<span class="text-neutral-500 lowercase font-normal">(opsional)</span>' : '<span class="text-red-400">*</span>'}</label>
                        <input type="password" id="inp-user-pass" maxlength="32" minlength="6" placeholder="${isEdit ? '•••••••• (Biarkan kosong jika tidak diubah)' : 'Minimal 6 karakter'}" class="w-full px-2.5 py-1.5 bg-[#050505] border border-[#1c1c1c] rounded text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500">
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                        <div>
                            <label for="inp-user-role" class="block text-[10px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Role Hak Akses</label>
                            <select id="inp-user-role" class="w-full px-2.5 py-1.5 bg-[#050505] border border-[#1c1c1c] rounded text-xs text-neutral-200 focus:outline-none focus:border-neutral-500">
                                <option value="kasir" ${userData?.role === 'kasir' ? 'selected' : ''}>Staff Kasir</option>
                                <option value="admin" ${userData?.role === 'admin' ? 'selected' : ''}>Administrator</option>
                            </select>
                        </div>
                        <div>
                            <label for="inp-user-aktif" class="block text-[10px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Status Akun</label>
                            <select id="inp-user-aktif" class="w-full px-2.5 py-1.5 bg-[#050505] border border-[#1c1c1c] rounded text-xs text-neutral-200 focus:outline-none focus:border-neutral-500">
                                <option value="true" ${userData?.aktif !== false ? 'selected' : ''}>Aktif (Bisa Login)</option>
                                <option value="false" ${userData?.aktif === false ? 'selected' : ''}>Nonaktif (Diblokir)</option>
                            </select>
                        </div>
                    </div>
                    <div id="wrapper-kuota-main" class="${userData?.role === 'admin' ? 'hidden' : ''}">
                        <label for="inp-user-kuota" class="block text-[10px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Benefit Kuota Main Bulanan (Jam)</label>
                        <div class="relative">
                            <input type="number" id="inp-user-kuota" min="0" max="720" value="${userData ? Math.floor((userData.kuota_main_bulanan || 0) / 60) : 10}" class="w-full px-2.5 py-1.5 bg-[#050505] border border-[#1c1c1c] rounded text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 no-spinners [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-mono">
                            <span class="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 text-xs font-mono">Jam</span>
                        </div>
                        <p class="text-[9px] text-neutral-600 mt-0.5">Benefit bermain gratis di luar jam kerja (0 - 720 Jam)</p>
                    </div>
                </div>
                <div class="flex gap-2 justify-end mt-4 pt-3 border-t border-[#1c1c1c]">
                    <button onclick="Modal.closeModal()" class="px-3 py-1.5 bg-[#171717] border border-[#262626] hover:bg-[#222] text-neutral-400 text-xs font-bold rounded transition-colors">Batal</button>
                    <button onclick="User.addOrupdate()" class="px-3 py-1.5 bg-neutral-100 hover:bg-white text-black text-xs font-bold rounded transition-colors flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${isEdit ? 'M5 13l4 4L19 7' : 'M12 4v16m8-8H4'}"></path></svg>
                        ${isEdit ? 'Simpan Perubahan' : 'Daftarkan User'}
                    </button>
                </div>
            </div>`;
        Modal.show(modalHtml);

        setTimeout(() => {
            const roleEl = document.getElementById('inp-user-role');
            const kuotaWrap = document.getElementById('wrapper-kuota-main');
            if (roleEl && kuotaWrap) {
                roleEl.addEventListener('change', () => {
                    if (roleEl.value === 'kasir') {
                        kuotaWrap.classList.remove('hidden');
                    } else {
                        kuotaWrap.classList.add('hidden');
                    }
                });
            }
        }, 50);
    },

    async addOrupdate() {
        const username = document.getElementById('inp-user-username').value.trim();
        const nama_lengkap = document.getElementById('inp-user-nama').value.trim();
        const password = document.getElementById('inp-user-pass').value;
        const role = document.getElementById('inp-user-role').value;
        const aktif = document.getElementById('inp-user-aktif').value === 'true';
        const kuotaJam = parseInt(document.getElementById('inp-user-kuota')?.value || '0', 10);
        
        if (!username || (!this.editingId && !password)) return Toast.error("Username dan Password wajib diisi");
        if (!Utils.isValidUsername(username, 3, 30)) return Toast.error("Username harus 3 - 30 karakter (hanya huruf, angka, _, -, .)");
        if (password && !Utils.isValidPassword(password, 6, 32)) return Toast.error("Password harus 6 - 32 karakter");
        if (nama_lengkap && nama_lengkap.length > 100) return Toast.error("Nama lengkap maksimal 100 karakter");
        if (isNaN(kuotaJam) || kuotaJam < 0 || kuotaJam > 720) return Toast.error("Kuota main bulanan harus antara 0 s/d 720 jam");

        const data = { 
            username, 
            nama_lengkap, 
            role, 
            aktif,
            kuota_main_bulanan: role === 'kasir' ? kuotaJam * 60 : 0
        };
        if (password) data.password = password;

        try {
            if (this.editingId) {
                await API.user.update(this.editingId, data);
                Toast.success("User diperbarui");
            } else {
                await API.user.create(data);
                Toast.success("User ditambahkan");
            }
            Modal.closeModal();
            this.load();
        } catch (err) {
            Toast.error(err.message || "Gagal menyimpan");
        }
    },

    async edit(id) {
        try {
            const u = await API.user.get(id);
            this.showFormModal(u);
        } catch (err) {
            Toast.error("Gagal load data: " + err.message);
        }
    },

    async delete(id, username) {
        const message = `<div class="text-center"><p class="text-xs sm:text-sm text-neutral-300 font-semibold mb-1">Hapus akun <span class="text-neutral-100 font-bold font-mono">${Utils.escapeHtml(username)}</span>?</p><p class="text-[11px] sm:text-xs text-neutral-500">Semua hak akses akan dicabut secara permanen.</p></div>`;
        Modal.confirm(message, async () => {
            try {
                await API.user.delete(id);
                Toast.success("User dihapus");
                this.load();
            } catch (err) {
                Toast.error(err.message);
            }
        });
    },

    async resetKuota(id, username) {
        const message = `<div class="text-center"><p class="text-xs sm:text-sm text-neutral-300 font-semibold mb-1">Reset kuota bermain <span class="text-neutral-100 font-bold font-mono">${Utils.escapeHtml(username)}</span>?</p><p class="text-[11px] sm:text-xs text-neutral-500">Sisa kuota akan dikembalikan ke kuota bulanan penuh.</p></div>`;
        Modal.confirm(message, async () => {
            try {
                await API.user.resetKuota(id);
                Toast.success("Kuota bermain berhasil di-reset");
                this.load();
            } catch (err) {
                Toast.error(err.message || "Gagal me-reset kuota");
            }
        });
    }
};

window.User = User;
