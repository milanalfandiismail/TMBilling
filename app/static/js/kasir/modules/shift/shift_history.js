/**
 * Shift History & User Audit Logs Sub-module
 * Menangani tabel riwayat shift sebelumnya, filter periode tanggal, dan audit log user kasir.
 */
window.ShiftHistory = {
    getDateRange(preset) {
        const now = new Date();
        const formatDate = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        switch (preset) {
            case 'today': {
                const todayStr = formatDate(now);
                return { mulai: todayStr, selesai: todayStr };
            }
            case 'yesterday': {
                const y = new Date(now);
                y.setDate(y.getDate() - 1);
                const yStr = formatDate(y);
                return { mulai: yStr, selesai: yStr };
            }
            case '7days': {
                const start = new Date(now);
                start.setDate(start.getDate() - 6);
                return { mulai: formatDate(start), selesai: formatDate(now) };
            }
            case '30days': {
                const start = new Date(now);
                start.setDate(start.getDate() - 29);
                return { mulai: formatDate(start), selesai: formatDate(now) };
            }
            case 'this_month': {
                const first = new Date(now.getFullYear(), now.getMonth(), 1);
                const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                return { mulai: formatDate(first), selesai: formatDate(last) };
            }
            case 'last_month': {
                const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const last = new Date(now.getFullYear(), now.getMonth(), 0);
                return { mulai: formatDate(first), selesai: formatDate(last) };
            }
            case 'all':
            default:
                return { mulai: '', selesai: '' };
        }
    },

    setPeriodePreset(preset) {
        const select = document.getElementById('filter-shift-periode');
        if (select) {
            select.value = preset;
        }

        document.querySelectorAll('.shift-preset-btn').forEach(btn => {
            const onclickAttr = btn.getAttribute('onclick') || '';
            if (onclickAttr.includes(`'${preset}'`)) {
                btn.className = 'shift-preset-btn px-2.5 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded text-[11px] lg:max-xl:text-xs xl:text-sm font-bold transition-colors';
            } else {
                btn.className = 'shift-preset-btn px-2.5 py-1 bg-[#161616] hover:bg-[#222] text-neutral-300 hover:text-white border border-[#262626] rounded text-[11px] lg:max-xl:text-xs xl:text-sm font-semibold transition-colors';
            }
        });

        this.onPeriodeChange();
    },

    onPeriodeChange() {
        const select = document.getElementById('filter-shift-periode');
        const customContainer = document.getElementById('shift-custom-date-container');
        const mulaiInput = document.getElementById('filter-shift-mulai');
        const selesaiInput = document.getElementById('filter-shift-selesai');

        const val = select ? select.value : 'all';

        // Update pill highlight to match select value
        document.querySelectorAll('.shift-preset-btn').forEach(btn => {
            const onclickAttr = btn.getAttribute('onclick') || '';
            if (onclickAttr.includes(`'${val}'`)) {
                btn.className = 'shift-preset-btn px-2.5 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded text-[11px] lg:max-xl:text-xs xl:text-sm font-bold transition-colors';
            } else {
                btn.className = 'shift-preset-btn px-2.5 py-1 bg-[#161616] hover:bg-[#222] text-neutral-300 hover:text-white border border-[#262626] rounded text-[11px] lg:max-xl:text-xs xl:text-sm font-semibold transition-colors';
            }
        });

        if (val === 'custom') {
            if (customContainer) {
                customContainer.classList.remove('hidden');
                customContainer.classList.add('flex');
            }
        } else {
            if (customContainer) {
                customContainer.classList.add('hidden');
                customContainer.classList.remove('flex');
            }
            const range = this.getDateRange(val);
            if (mulaiInput) mulaiInput.value = range.mulai;
            if (selesaiInput) selesaiInput.value = range.selesai;
        }

        this.loadHistory();
    },

    resetHistoryFilter() {
        const periodeSelect = document.getElementById('filter-shift-periode');
        if (periodeSelect) periodeSelect.value = 'all';

        const kasirSelect = document.getElementById('filter-shift-kasir');
        if (kasirSelect) kasirSelect.value = '';

        const mulaiInput = document.getElementById('filter-shift-mulai');
        if (mulaiInput) mulaiInput.value = '';

        const selesaiInput = document.getElementById('filter-shift-selesai');
        if (selesaiInput) selesaiInput.value = '';

        const customContainer = document.getElementById('shift-custom-date-container');
        if (customContainer) {
            customContainer.classList.add('hidden');
            customContainer.classList.remove('flex');
        }

        document.querySelectorAll('.shift-preset-btn').forEach(btn => {
            const onclickAttr = btn.getAttribute('onclick') || '';
            if (onclickAttr.includes("'all'")) {
                btn.className = 'shift-preset-btn px-2.5 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded text-[11px] lg:max-xl:text-xs xl:text-sm font-bold transition-colors';
            } else {
                btn.className = 'shift-preset-btn px-2.5 py-1 bg-[#161616] hover:bg-[#222] text-neutral-300 hover:text-white border border-[#262626] rounded text-[11px] lg:max-xl:text-xs xl:text-sm font-semibold transition-colors';
            }
        });

        this.loadHistory();
    },

    async loadHistoryKasirList() {
        const select = document.getElementById('filter-shift-kasir');
        if (!select) return;

        try {
            const data = await API.shift.kasirList();
            const kasirList = data?.kasir || [];
            const currentVal = select.value;

            select.innerHTML = '<option value="">Semua Kasir</option>';
            kasirList.forEach(k => {
                select.innerHTML += `<option value="${k.id}">${Utils.escapeHtml(k.nama || k.username || 'Kasir #' + k.id)}</option>`;
            });

            if (currentVal) {
                select.value = currentVal;
            }
        } catch (err) {
            console.error('[Shift] Gagal memuat daftar kasir untuk filter:', err);
        }
    },

    _lastHistoryFingerprint: null,
    _lastUserLogsFingerprint: null,

    historyPerPage: 5,
    historyCurrentPage: 1,
    historyTotalPages: 1,
    _lastShifts: [],

    userLogsPerPage: 5,
    userLogsCurrentPage: 1,
    userLogsTotalPages: 1,
    _lastStaffLogs: [],

    renderHistoryPagination(totalCount) {
        const paginationContainer = document.getElementById('shift-history-pagination');
        const pageInfo = document.getElementById('shift-history-page-info');
        const prevBtn = document.getElementById('shift-history-prev-btn');
        const nextBtn = document.getElementById('shift-history-next-btn');

        if (!paginationContainer) return;

        if (totalCount === 0) {
            paginationContainer.classList.add('hidden');
            return;
        }

        paginationContainer.classList.remove('hidden');
        paginationContainer.classList.add('flex');

        const startIdx = (this.historyCurrentPage - 1) * this.historyPerPage + 1;
        const endIdx = Math.min(this.historyCurrentPage * this.historyPerPage, totalCount);

        if (pageInfo) {
            pageInfo.innerHTML = `Menampilkan <span class="font-bold text-neutral-200">${startIdx}</span> - <span class="font-bold text-neutral-200">${endIdx}</span> dari <span class="font-bold text-neutral-200">${totalCount}</span> shift`;
        }

        if (prevBtn) {
            prevBtn.disabled = this.historyCurrentPage <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.historyCurrentPage >= this.historyTotalPages;
        }
    },

    prevHistoryPage() {
        if (this.historyCurrentPage > 1) {
            this.historyCurrentPage--;
            this.renderHistoryTable();
        }
    },

    nextHistoryPage() {
        if (this.historyCurrentPage < this.historyTotalPages) {
            this.historyCurrentPage++;
            this.renderHistoryTable();
        }
    },

    renderHistoryTable() {
        const container = document.getElementById('shift-history-rows');
        if (!container) return;

        const shifts = this._lastShifts || [];
        this.historyTotalPages = Math.ceil(shifts.length / this.historyPerPage) || 1;
        this.historyCurrentPage = Math.max(1, Math.min(this.historyCurrentPage, this.historyTotalPages));

        if (shifts.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-6 text-neutral-500 text-xs">
                        Tidak ada data riwayat shift ditemukan
                    </td>
                </tr>
            `;
            this.renderHistoryPagination(0);
            return;
        }

        const startIndex = (this.historyCurrentPage - 1) * this.historyPerPage;
        const pageShifts = shifts.slice(startIndex, startIndex + this.historyPerPage);

        container.innerHTML = pageShifts.map(s => {
            const isForceClose = (s.catatan || '').includes('[FORCE CLOSE');
            let selisihBadge = '';
            if (s.selisih !== null && s.selisih !== undefined) {
                if (s.selisih > 0) {
                    selisihBadge = `<span class="px-1.5 py-0.5 rounded text-[10px] lg:text-[9px] xl:text-xs font-bold bg-emerald-950/70 text-emerald-400 border border-emerald-800/40 font-mono whitespace-nowrap">+${Utils.formatRawRupiah(s.selisih)}</span>`;
                } else if (s.selisih < 0) {
                    selisihBadge = `<span class="px-1.5 py-0.5 rounded text-[10px] lg:text-[9px] xl:text-xs font-bold bg-red-950/70 text-red-400 border border-red-800/40 font-mono whitespace-nowrap">-${Utils.formatRawRupiah(Math.abs(s.selisih))}</span>`;
                } else {
                    selisihBadge = `<span class="px-1.5 py-0.5 rounded text-[10px] lg:text-[9px] xl:text-xs font-bold bg-neutral-800 text-neutral-300 font-mono whitespace-nowrap">Rp 0</span>`;
                }
            } else {
                selisihBadge = '<span class="text-neutral-500 font-mono text-[10px] lg:text-[9px] xl:text-xs whitespace-nowrap">-</span>';
            }

            const tMulai = s.waktu_mulai ? s.waktu_mulai.split(' ')[1] : '-';
            const tSelesai = s.waktu_selesai ? s.waktu_selesai.split(' ')[1] : '-';
            const dMulai = s.waktu_mulai ? s.waktu_mulai.split(' ')[0].replace(/\/20\d\d/, '') : '';

            const statusBadge = isForceClose
                ? '<span class="px-1 sm:px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] xl:text-xs font-bold bg-red-950/70 text-red-400 border border-red-800/40 whitespace-nowrap"><span class="sm:hidden">FC</span><span class="hidden sm:inline">FORCE CLOSE</span></span>'
                : '<span class="px-1 sm:px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] xl:text-xs font-bold bg-emerald-950/70 text-emerald-400 border border-emerald-800/40 whitespace-nowrap"><span class="sm:hidden">SEL</span><span class="hidden sm:inline">SELESAI</span></span>';

            return `
                <tr class="hover:bg-[#141414] transition-colors border-b border-[#1c1c1c] text-xs lg:text-[10px] xl:text-xs 2xl:text-sm">
                    <!-- ID on >= lg -->
                    <td class="hidden lg:table-cell px-2.5 lg:px-2 xl:px-3 2xl:px-4 py-1.5 lg:py-1 xl:py-1.5 2xl:py-2.5 font-mono text-neutral-400 whitespace-nowrap">#${s.id}</td>
                    
                    <!-- Petugas & Waktu -->
                    <td class="px-1 sm:px-2.5 lg:px-2 xl:px-3 2xl:px-4 py-1.5 lg:py-1 xl:py-1.5 2xl:py-2.5 whitespace-nowrap">
                        <div class="font-bold text-neutral-200 truncate max-w-[55px] sm:max-w-[130px] lg:max-w-[100px] xl:max-w-[150px]" title="${Utils.escapeHtml(s.kasir_nama || 'Kasir')}">
                            <span class="lg:hidden text-neutral-500 font-mono font-normal">#${s.id} </span>${Utils.escapeHtml(s.kasir_nama || 'Kasir')}
                        </div>
                        <div class="sm:hidden text-[9px] text-neutral-500 font-mono leading-tight">${dMulai ? `<div>${dMulai}</div>` : ''}<div>${tMulai}-${tSelesai}</div></div>
                        <div class="hidden sm:block text-[10px] lg:text-[8.5px] xl:text-[10px] 2xl:text-xs text-neutral-500 font-mono whitespace-nowrap">${s.waktu_mulai ? s.waktu_mulai.split(' ')[0] : ''} ${tMulai} s/d ${tSelesai}</div>
                    </td>

                    <!-- Modal Awal on >= lg -->
                    <td class="hidden lg:table-cell px-2.5 lg:px-2 xl:px-3 2xl:px-4 py-1.5 lg:py-1 xl:py-1.5 2xl:py-2.5 font-mono text-neutral-300 whitespace-nowrap">${Utils.formatRupiah(s.modal_awal || 0)}</td>
                    
                    <!-- Penerimaan on < lg (Billing & Kantin combined) -->
                    <td class="lg:hidden px-1 sm:px-2 py-1.5 font-mono whitespace-nowrap">
                        <div class="text-neutral-200 text-[10px] sm:text-[11px] font-semibold">${Utils.formatRupiah(s.total_billing || 0)}</div>
                        <div class="text-neutral-400 text-[9px] sm:text-[10px]">${Utils.formatRupiah(s.total_kantin || 0)}</div>
                    </td>

                    <!-- Billing & Kantin separate on >= lg -->
                    <td class="hidden lg:table-cell px-2.5 lg:px-2 xl:px-3 2xl:px-4 py-1.5 lg:py-1 xl:py-1.5 2xl:py-2.5 font-mono text-neutral-300 whitespace-nowrap">${Utils.formatRupiah(s.total_billing || 0)}</td>
                    <td class="hidden lg:table-cell px-2.5 lg:px-2 xl:px-3 2xl:px-4 py-1.5 lg:py-1 xl:py-1.5 2xl:py-2.5 font-mono text-neutral-300 whitespace-nowrap">${Utils.formatRupiah(s.total_kantin || 0)}</td>

                    <!-- Kas & Selisih on < lg (Uang Fisik & Selisih combined) -->
                    <td class="lg:hidden px-1 sm:px-2 py-1.5 font-mono whitespace-nowrap">
                        <div class="font-bold text-neutral-100 text-[10px] sm:text-[11px]">${s.uang_fisik !== null && s.uang_fisik !== undefined ? Utils.formatRupiah(s.uang_fisik) : '-'}</div>
                        <div class="mt-0.5">${selisihBadge}</div>
                    </td>

                    <!-- Uang Fisik & Selisih separate on >= lg -->
                    <td class="hidden lg:table-cell px-2.5 lg:px-2 xl:px-3 2xl:px-4 py-1.5 lg:py-1 xl:py-1.5 2xl:py-2.5 font-mono font-bold text-neutral-100 whitespace-nowrap">${s.uang_fisik !== null && s.uang_fisik !== undefined ? Utils.formatRupiah(s.uang_fisik) : '-'}</td>
                    <td class="hidden lg:table-cell px-2.5 lg:px-2 xl:px-3 2xl:px-4 py-1.5 lg:py-1 xl:py-1.5 2xl:py-2.5 whitespace-nowrap">${selisihBadge}</td>

                    <!-- Status (both) -->
                    <td class="px-1 sm:px-2.5 lg:px-2 xl:px-3 2xl:px-4 py-1.5 lg:py-1 xl:py-1.5 2xl:py-2.5 whitespace-nowrap">${statusBadge}</td>

                    <!-- Aksi (both) -->
                    <td class="px-0.5 sm:px-2 lg:px-2.5 xl:px-3 2xl:px-4 py-1.5 lg:py-1 xl:py-1.5 2xl:py-2.5 text-right whitespace-nowrap">
                        <div class="flex items-center justify-end gap-0.5 sm:gap-1">
                            <button onclick="Shift.viewShiftDetail(${s.id})" title="Lihat Rekapitulasi"
                                class="p-1 lg:p-0.5 xl:p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white transition-colors">
                                <svg class="w-3.5 h-3.5 lg:w-3 lg:h-3 xl:w-4 xl:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                            </button>
                            <button onclick="Shift.printThermalReceipt(${s.id})" title="Cetak Struk Thermal 58mm"
                                class="p-1 lg:p-0.5 xl:p-1.5 rounded bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/40 text-amber-400 hover:text-amber-300 transition-colors">
                                <svg class="w-3.5 h-3.5 lg:w-3 lg:h-3 xl:w-4 xl:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        this.renderHistoryPagination(shifts.length);
    },

    refreshHistoryLive() {
        if (typeof App !== 'undefined' && !['shift', 'shift_history', 'user_logs'].includes(App.currentTab)) return;
        if (typeof App !== 'undefined' && App.currentTab === 'shift_history') {
            return this.loadHistory({}, true);
        }
        if (typeof App !== 'undefined' && App.currentTab === 'user_logs') {
            return this.loadUserLogs({}, true);
        }
        const historyTab = document.getElementById('shift-tab-history');
        const userLogsTab = document.getElementById('shift-tab-user-logs');
        if (historyTab && !historyTab.classList.contains('hidden')) {
            return this.loadHistory({}, true);
        }
        if (userLogsTab && !userLogsTab.classList.contains('hidden')) {
            return this.loadUserLogs({}, true);
        }
    },

    async loadHistory(params = {}, isSilent = false) {
        const container = document.getElementById('shift-history-rows');
        if (!container) return;

        if (!isSilent) {
            this.historyCurrentPage = 1;
        }

        if (!isSilent && (!this._lastShifts || this._lastShifts.length === 0) && typeof Skeleton !== 'undefined') {
            container.innerHTML = Skeleton.tableRows(5, 9);
        }

        try {
            const tanggalMulai = document.getElementById('filter-shift-mulai')?.value || params.tanggal_mulai || '';
            const tanggalSelesai = document.getElementById('filter-shift-selesai')?.value || params.tanggal_selesai || '';
            const kasirId = document.getElementById('filter-shift-kasir')?.value || params.kasir_id || '';

            const res = await API.shift.history({
                tanggal_mulai: tanggalMulai,
                tanggal_selesai: tanggalSelesai,
                kasir_id: kasirId,
                limit: 200
            });

            if (!res.success) throw new Error(res.error || 'Gagal memuat riwayat');

            const shifts = res.shifts?.data || [];
            const newFingerprint = JSON.stringify({
                mulai: tanggalMulai,
                selesai: tanggalSelesai,
                kasir: kasirId,
                shifts: shifts.map(s => ({ id: s.id, waktu_selesai: s.waktu_selesai, selisih: s.selisih }))
            });

            if (isSilent && this._lastHistoryFingerprint === newFingerprint) {
                return; // Data tidak berubah
            }
            this._lastHistoryFingerprint = newFingerprint;
            this._lastShifts = shifts;

            this.renderHistoryTable();
        } catch (err) {
            container.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-6 text-red-400 text-xs">
                        Error memuat riwayat: ${Utils.escapeHtml(err.message)}
                    </td>
                </tr>
            `;
            this.renderHistoryPagination(0);
        }
    },

    async viewShiftDetail(shiftId) {
        try {
            const res = await API.shift.getSummary(shiftId);
            if (!res.success || !res.summary) {
                throw new Error(res.error || 'Gagal memuat ringkasan shift');
            }
            this.showHasilShift(res.summary);
        } catch (err) {
            Toast.error('Gagal membuka rekap shift: ' + err.message);
        }
    },

    renderUserLogsPagination(totalCount) {
        const paginationContainer = document.getElementById('user-logs-pagination');
        const pageInfo = document.getElementById('user-logs-page-info');
        const prevBtn = document.getElementById('user-logs-prev-btn');
        const nextBtn = document.getElementById('user-logs-next-btn');

        if (!paginationContainer) return;

        if (totalCount === 0) {
            paginationContainer.classList.add('hidden');
            return;
        }

        paginationContainer.classList.remove('hidden');
        paginationContainer.classList.add('flex');

        const startIdx = (this.userLogsCurrentPage - 1) * this.userLogsPerPage + 1;
        const endIdx = Math.min(this.userLogsCurrentPage * this.userLogsPerPage, totalCount);

        if (pageInfo) {
            pageInfo.innerHTML = `Menampilkan <span class="font-bold text-neutral-200">${startIdx}</span> - <span class="font-bold text-neutral-200">${endIdx}</span> dari <span class="font-bold text-neutral-200">${totalCount}</span> log`;
        }

        if (prevBtn) {
            prevBtn.disabled = this.userLogsCurrentPage <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.userLogsCurrentPage >= this.userLogsTotalPages;
        }
    },

    prevUserLogsPage() {
        if (this.userLogsCurrentPage > 1) {
            this.userLogsCurrentPage--;
            this.renderUserLogsTable();
        }
    },

    nextUserLogsPage() {
        if (this.userLogsCurrentPage < this.userLogsTotalPages) {
            this.userLogsCurrentPage++;
            this.renderUserLogsTable();
        }
    },

    openUserLogDetail(index) {
        const log = this._lastStaffLogs ? this._lastStaffLogs[index] : null;
        if (!log) return;

        const modal = document.getElementById('modal-user-logs-detail');
        if (!modal) return;

        const elUser = document.getElementById('user-logs-detail-user');
        const elAction = document.getElementById('user-logs-detail-action');
        const elIp = document.getElementById('user-logs-detail-ip');
        const elTime = document.getElementById('user-logs-detail-time');
        const elDesc = document.getElementById('user-logs-detail-desc');

        if (elUser) elUser.innerText = log.user || 'system';
        if (elAction) {
            elAction.innerText = log.action || '-';
            const act = (log.action || '').toUpperCase();
            let badgeClass = 'bg-neutral-800 text-neutral-300 border border-neutral-700';
            if (act.includes('BUKA')) badgeClass = 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60';
            else if (act.includes('TUTUP')) badgeClass = 'bg-blue-950/80 text-blue-400 border border-blue-800/60';
            else if (act.includes('FORCE_CLOSE') || act.includes('GAGAL') || act.includes('HAPUS') || act.includes('DELETE') || act.includes('CLEAR')) badgeClass = 'bg-red-950/80 text-red-400 border border-red-800/60';
            else if (act.includes('KUOTA') || act.includes('UPDATE')) badgeClass = 'bg-purple-950/80 text-purple-400 border border-purple-800/60';
            else if (act.includes('LOGIN')) badgeClass = 'bg-amber-950/80 text-amber-400 border border-amber-800/60';
            elAction.className = `px-2 py-0.5 rounded text-[10px] 2xl:text-xs font-bold uppercase tracking-wider ${badgeClass}`;
        }
        if (elIp) elIp.innerText = log.ip_address || '-';
        if (elTime) elTime.innerText = log.timestamp || '-';
        if (elDesc) elDesc.innerText = log.detail || '-';

        modal.classList.remove('hidden');
    },

    closeUserLogDetail() {
        const modal = document.getElementById('modal-user-logs-detail');
        if (modal) modal.classList.add('hidden');
    },

    renderUserLogsTable() {
        const container = document.getElementById('user-logs-rows');
        if (!container) return;

        const staffLogs = this._lastStaffLogs || [];
        this.userLogsTotalPages = Math.ceil(staffLogs.length / this.userLogsPerPage) || 1;
        this.userLogsCurrentPage = Math.max(1, Math.min(this.userLogsCurrentPage, this.userLogsTotalPages));

        if (staffLogs.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-6 text-neutral-500 text-xs">
                        Tidak ada log aktivitas staff yang cocok dengan filter
                    </td>
                </tr>
            `;
            this.renderUserLogsPagination(0);
            return;
        }

        const startIndex = (this.userLogsCurrentPage - 1) * this.userLogsPerPage;
        const pageLogs = staffLogs.slice(startIndex, startIndex + this.userLogsPerPage);

        container.innerHTML = pageLogs.map((log, idx) => {
            const globalIndex = startIndex + idx;
            const act = (log.action || '').toUpperCase();
            let badgeClass = 'bg-neutral-800 text-neutral-300 border-neutral-700';
            if (act.includes('BUKA')) badgeClass = 'bg-emerald-950/70 text-emerald-400 border-emerald-800/40';
            else if (act.includes('TUTUP')) badgeClass = 'bg-blue-950/70 text-blue-400 border-blue-800/40';
            else if (act.includes('FORCE_CLOSE') || act.includes('GAGAL') || act.includes('HAPUS') || act.includes('DELETE') || act.includes('CLEAR')) badgeClass = 'bg-red-950/70 text-red-400 border-red-800/40';
            else if (act.includes('KUOTA') || act.includes('UPDATE')) badgeClass = 'bg-purple-950/70 text-purple-400 border-purple-800/40';
            else if (act.includes('LOGIN')) badgeClass = 'bg-amber-950/70 text-amber-400 border-amber-800/40';

            const compactLogTime = (log.timestamp || '').replace(/^20\d\d-/, '');

            return `
                <tr class="hover:bg-[#141414] transition-colors border-b border-[#1c1c1c] text-xs lg:text-[10px] xl:text-xs 2xl:text-sm">
                    <td class="px-1.5 sm:px-2 lg:px-2 xl:px-3.5 2xl:px-4 py-1.5 lg:py-1 xl:py-1.5 2xl:py-2.5 whitespace-nowrap">
                        <div class="sm:hidden font-mono text-neutral-300 text-[9px]">${compactLogTime}</div>
                        <div class="hidden sm:block font-mono text-neutral-300 text-[11px] lg:text-[10px] xl:text-xs">${log.timestamp || '-'}</div>
                        <div class="mt-0.5 lg:hidden">
                            <span class="px-1.5 py-0.2 rounded bg-neutral-900 border border-neutral-700 font-mono text-[8.5px] sm:text-[9px] text-neutral-300 font-semibold">${Utils.escapeHtml(log.user || 'system')}</span>
                        </div>
                    </td>
                    <td class="hidden lg:table-cell px-2 lg:px-2 xl:px-3.5 2xl:px-4 py-1.5 lg:py-1 xl:py-1.5 2xl:py-2.5 font-bold text-neutral-200 whitespace-nowrap">
                        <span class="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700 font-mono text-[10px] lg:text-[9px] xl:text-xs">${Utils.escapeHtml(log.user || 'system')}</span>
                    </td>
                    <td class="px-1.5 sm:px-2 lg:px-2 xl:px-3.5 2xl:px-4 py-1.5 lg:py-1 xl:py-1.5 2xl:py-2.5 whitespace-nowrap">
                        <span class="px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] lg:text-[9px] xl:text-xs font-bold border ${badgeClass}">${Utils.escapeHtml(log.action || '-')}</span>
                        <div class="mt-0.5 lg:hidden font-mono text-[8.5px] sm:text-[9px] text-neutral-500">${Utils.escapeHtml(log.ip_address || '-')}</div>
                    </td>
                    <td class="px-1.5 sm:px-2 lg:px-2 xl:px-3.5 2xl:px-4 py-1.5 lg:py-1 xl:py-1.5 2xl:py-2.5 text-neutral-300 truncate max-w-[75px] sm:max-w-[170px] md:max-w-[220px] lg:max-w-[180px] xl:max-w-[300px] 2xl:max-w-[450px]" title="${Utils.escapeHtml(log.detail || '-')}">
                        ${Utils.escapeHtml(log.detail || '-')}
                    </td>
                    <td class="hidden lg:table-cell px-2 lg:px-2 xl:px-3.5 2xl:px-4 py-1.5 lg:py-1 xl:py-1.5 2xl:py-2.5 font-mono text-[10px] lg:text-[9px] xl:text-xs text-neutral-500 whitespace-nowrap">${log.ip_address || '-'}</td>
                    <td class="px-1 sm:px-2 lg:px-2 xl:px-3.5 2xl:px-4 py-1.5 lg:py-1 xl:py-1.5 2xl:py-2.5 text-center whitespace-nowrap">
                        <button onclick="Shift.openUserLogDetail(${globalIndex})" title="Lihat Detail Log"
                            class="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-[9px] sm:text-[10px] lg:text-[9px] xl:text-xs font-semibold transition-colors">
                            Detail
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        this.renderUserLogsPagination(staffLogs.length);
    },

    async loadUserLogs(params = {}, isSilent = false) {
        const container = document.getElementById('user-logs-rows');
        if (!container) return;

        if (!isSilent) {
            this.userLogsCurrentPage = 1;
        }

        if (!isSilent && (!this._lastStaffLogs || this._lastStaffLogs.length === 0) && typeof Skeleton !== 'undefined') {
            container.innerHTML = Skeleton.tableRows(5, 6);
        }

        try {
            const search = document.getElementById('filter-user-logs-search')?.value?.trim() || '';
            const actionType = document.getElementById('filter-user-logs-action')?.value || '';

            const res = await API.report.logs(search, 200, '');
            const rawLogs = res.logs || [];

            // Filter log khusus aktivitas operasional staf (eksklusi ketat seluruh aktivitas member)
            const staffLogs = rawLogs.filter(log => {
                const act = (log.action || '').toUpperCase();

                // 1. Tolak segala log yang berelasi dengan member (member bukan staf)
                if (act.includes('MEMBER')) return false;

                // 2. Whitelist aksi operasional dan administratif staf
                const isStaffAction =
                    act.startsWith('SHIFT_') ||
                    act.endsWith('_USER') ||
                    act.includes('KUOTA') ||
                    ['LOGIN', 'LOGOUT', 'LOGIN_GAGAL', 'LOGIN_KASIR_BENEFIT', 'CLIENT_ADMIN_LOGIN', 'EMERGENCY_LOGIN', 'DELETE_STRUK', 'CLEAR_LOG', 'CLEAR_ALL_HISTORY', 'RESET_ADMIN'].includes(act) ||
                    act.startsWith('IP_WHITELIST');

                if (!isStaffAction) return false;

                // 3. Filter berdasarkan dropdown kategori aksi jika dipilih
                if (actionType === 'SHIFT') {
                    if (!act.startsWith('SHIFT_')) return false;
                } else if (actionType === 'USER') {
                    if (!act.endsWith('_USER')) return false;
                } else if (actionType === 'KUOTA') {
                    if (!act.includes('KUOTA')) return false;
                } else if (actionType === 'LOGIN') {
                    if (!['LOGIN', 'LOGOUT', 'LOGIN_GAGAL', 'LOGIN_KASIR_BENEFIT', 'CLIENT_ADMIN_LOGIN', 'EMERGENCY_LOGIN'].includes(act)) return false;
                } else if (actionType === 'AUDIT') {
                    if (!['DELETE_STRUK', 'CLEAR_LOG', 'CLEAR_ALL_HISTORY', 'RESET_ADMIN'].includes(act) && !act.startsWith('IP_WHITELIST')) return false;
                } else if (actionType) {
                    if (!act.includes(actionType.toUpperCase())) return false;
                }

                return true;
            });

            const newFingerprint = JSON.stringify({ search, actionType, count: staffLogs.length, top: staffLogs[0]?.timestamp });
            if (isSilent && this._lastUserLogsFingerprint === newFingerprint) {
                return; // Data tidak berubah
            }
            this._lastUserLogsFingerprint = newFingerprint;
            this._lastStaffLogs = staffLogs;

            this.renderUserLogsTable();
        } catch (err) {
            container.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-6 text-red-400 text-xs">
                        Error memuat log: ${Utils.escapeHtml(err.message)}
                    </td>
                </tr>
            `;
            this.renderUserLogsPagination(0);
        }
    },

    formatTime(dt) {
        if (!dt) return '-';
        if (typeof dt === 'string' && (dt.includes('WITA') || dt.includes('WIB') || dt.includes('WIT') || dt.includes('/'))) {
            return dt;
        }
        try {
            const d = new Date(dt.endsWith('Z') ? dt : dt + 'Z');
            if (isNaN(d.getTime())) return dt;
            return d.toLocaleString('id-ID', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });
        } catch (e) {
            return dt;
        }
    },

    formatTimeOnly(dt) {
        if (!dt) return '...';
        if (typeof dt === 'string') {
            const match = dt.match(/\b(\d{1,2}:\d{2})\b/);
            if (match) return match[1];
        }
        try {
            const d = new Date(dt.endsWith('Z') ? dt : dt + 'Z');
            if (isNaN(d.getTime())) return dt;
            return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return dt;
        }
    },

    refreshUserLogsLive() {
        if (App.currentTab !== 'user_logs') return;
        return this.loadUserLogs({}, true);
    }

};
