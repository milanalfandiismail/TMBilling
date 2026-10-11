/**
 * @file stock_log.js (modules/menu/stock_log.js)
 * @description Modul antarmuka riwayat / log mutasi stok F&B (Restock Audit Log).
 */

const MenuStockLog = {
    currentPage: 1,
    perPage: 15,
    searchTimer: null,
    totalPages: 1,
    totalRecords: 0,
    operators: [],
    currentLogs: [],

    _lastFingerprint: null,

    async load(isSilent = false) {
        await this.fetchLogs(isSilent);
    },

    refreshLive() {
        if (typeof App !== 'undefined' && !['menu', 'menu_stock_log'].includes(App.currentTab)) return;
        if (typeof App !== 'undefined' && App.currentTab === 'menu_stock_log') {
            return this.fetchLogs(true);
        }
        const subTab = document.getElementById('menu-tab-stock-log');
        if (subTab && subTab.classList.contains('hidden')) return;
        return this.fetchLogs(true);
    },

    async fetchLogs(isSilent = false) {
        const tbody = document.getElementById('stock-log-table-body');
        if (!tbody) return;

        if (!isSilent && (!this.totalRecords || this.totalRecords === 0) && typeof Skeleton !== 'undefined') {
            tbody.innerHTML = Skeleton.tableRows(6, 7);
        }

        try {
            const searchInput = document.getElementById('stock-log-filter-search');
            const dateInput = document.getElementById('stock-log-filter-date');
            const operatorInput = document.getElementById('stock-log-filter-operator');

            const params = {
                search: searchInput ? searchInput.value.trim() : '',
                tanggal: dateInput ? dateInput.value : '',
                operator: operatorInput ? operatorInput.value : '',
                page: this.currentPage,
                per_page: this.perPage
            };

            const res = await API.menu.stockLogs(params);
            if (!res || !res.success) {
                throw new Error(res?.error || 'Gagal memuat log stok menu');
            }

            const items = res.data || [];
            this.currentLogs = items;
            const newFingerprint = JSON.stringify({ items, total: res.pagination?.total });
            if (isSilent && this._lastFingerprint === newFingerprint) {
                return; // Data tidak berubah
            }
            this._lastFingerprint = newFingerprint;

            this.totalPages = res.pagination ? res.pagination.pages : 1;
            this.totalRecords = res.pagination ? res.pagination.total : items.length;
            this.currentPage = res.pagination ? res.pagination.page : 1;

            if (res.operators && Array.isArray(res.operators)) {
                this.updateOperatorDropdown(res.operators, params.operator);
            }
            if (res.dates && Array.isArray(res.dates)) {
                this.updateDateDropdown(res.dates, params.tanggal);
            }

            this.renderTable(items);
            this.renderPagination(res.pagination);
        } catch (err) {
            if (!isSilent) {
                console.error('[MenuStockLog] Error fetchLogs:', err);
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="py-10 text-center text-rose-400 font-medium text-xs lg:max-xl:text-xs xl:text-sm">
                            ⚠️ Terjadi kesalahan saat memuat data: ${this.escapeHtml(err.message || 'Error')}
                        </td>
                    </tr>
                `;
                if (window.Toast) {
                    Toast.error(err.message || 'Gagal mengambil data log stok');
                }
            }
        }
    },

    updateDateDropdown(dates, selectedDate) {
        const select = document.getElementById('stock-log-filter-date');
        if (!select) return;

        const currentVal = selectedDate !== undefined ? selectedDate : select.value;
        let html = '<option value="">Semua Tanggal</option>';
        (dates || []).forEach(d => {
            if (!d) return;
            const isSel = d === currentVal ? 'selected' : '';
            const parts = d.split('-');
            const displayLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
            html += `<option value="${this.escapeHtml(d)}" ${isSel}>${this.escapeHtml(displayLabel)}</option>`;
        });
        select.innerHTML = html;
        if (currentVal && dates.includes(currentVal)) {
            select.value = currentVal;
        }
    },

    updateOperatorDropdown(operators, selectedOp) {
        const select = document.getElementById('stock-log-filter-operator');
        if (!select) return;

        const currentVal = selectedOp !== undefined ? selectedOp : select.value;
        let html = '<option value="">Semua Operator</option>';
        operators.forEach(op => {
            if (!op) return;
            const isSel = op === currentVal ? 'selected' : '';
            html += `<option value="${this.escapeHtml(op)}" ${isSel}>${this.escapeHtml(op)}</option>`;
        });
        select.innerHTML = html;
    },

    renderTable(items) {
        const tbody = document.getElementById('stock-log-table-body');
        if (!tbody) return;

        if (!items || items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="py-12 text-center text-neutral-500">
                        <div class="flex flex-col items-center justify-center gap-1.5">
                            <span class="text-2xl">📦</span>
                            <span class="text-xs lg:max-xl:text-xs xl:text-sm text-neutral-400 font-medium">Belum ada riwayat penambahan stok yang sesuai filter.</span>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = items.map((log, index) => {
            const qtyPlus = Number(log.jumlah_masuk) || 0;
            const stokLama = Number(log.stok_sebelum) || 0;
            const stokBaru = Number(log.stok_sesudah) || 0;
            const timeStr = log.created_at || '-';
            const opName = log.operator || 'system';

            const compactTimeStr = timeStr.replace(/\s*WITA|\s*WIB|\s*WIT/gi, '').replace(/\/20\d\d/, '');

            return `
                <tr class="hover:bg-[#111111] transition-colors text-xs lg:max-xl:text-[11px] xl:text-sm 2xl:text-base border-b border-[#171717] last:border-b-0">
                    <!-- Col 1 on < lg: Waktu & Operator Combined -->
                    <td class="lg:hidden py-1.5 sm:py-2 px-1.5 sm:px-2.5 whitespace-nowrap">
                        <div class="flex flex-col">
                            <span class="sm:hidden text-neutral-300 font-mono text-[9px] font-bold">${this.escapeHtml(compactTimeStr)}</span>
                            <span class="hidden sm:inline text-neutral-300 font-mono text-[11px] font-bold">${this.escapeHtml(timeStr)}</span>
                            <span class="text-neutral-500 text-[8.5px] sm:text-[10px] flex items-center gap-0.5 sm:gap-1 mt-0.5">
                                <svg class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-neutral-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                                </svg>
                                <span class="truncate max-w-[60px] sm:max-w-none">${this.escapeHtml(opName)}</span>
                            </span>
                        </div>
                    </td>
                    <!-- Col 1 on >= lg: Waktu separate -->
                    <td class="hidden lg:table-cell py-2.5 lg:max-xl:py-2 xl:py-3.5 2xl:py-4 px-4 lg:max-xl:px-2 xl:px-4 2xl:px-5 whitespace-nowrap text-neutral-400 font-mono text-xs lg:max-xl:text-[10px] xl:text-xs 2xl:text-sm">${this.escapeHtml(timeStr)}</td>

                    <!-- Menu (both) -->
                    <td class="py-1.5 sm:py-2 lg:py-2.5 px-1.5 sm:px-2.5 lg:px-3 xl:px-4 2xl:px-5 font-semibold text-neutral-100 text-[11px] sm:text-xs xl:text-sm 2xl:text-base max-w-[75px] sm:max-w-[170px] lg:max-w-[200px] truncate" title="${this.escapeHtml(log.menu_nama || '')}">
                        ${this.escapeHtml(log.menu_nama || '-')}
                    </td>

                    <!-- Col 3 on < lg: Stok & Mutasi Combined -->
                    <td class="lg:hidden py-1.5 sm:py-2 px-1.5 sm:px-2.5 text-center whitespace-nowrap">
                        <div class="flex flex-col items-center gap-0.5">
                            <div class="flex items-center gap-0.5 sm:gap-1">
                                <span class="font-mono font-bold text-emerald-400 text-[10px] sm:text-xs">+${qtyPlus.toLocaleString('id-ID')}</span>
                                <span class="hidden sm:inline px-1 py-0.2 rounded text-[8.5px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">RESTOCK</span>
                            </div>
                            <div class="text-[8.5px] sm:text-[10px] font-mono text-neutral-400">
                                <span>${stokLama.toLocaleString('id-ID')}</span>
                                <span class="text-neutral-600 mx-0.5">&rarr;</span>
                                <span class="text-neutral-200 font-bold">${stokBaru.toLocaleString('id-ID')}</span>
                            </div>
                        </div>
                    </td>

                    <!-- Cols on >= lg: Mutasi, Jumlah, Perubahan separate -->
                    <td class="hidden lg:table-cell py-2.5 lg:max-xl:py-2 xl:py-3.5 2xl:py-4 px-4 lg:max-xl:px-1.5 xl:px-4 2xl:px-5 text-center whitespace-nowrap">
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] lg:max-xl:text-[9px] xl:text-xs 2xl:text-sm font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                            RESTOCK
                        </span>
                    </td>
                    <td class="hidden lg:table-cell py-2.5 lg:max-xl:py-2 xl:py-3.5 2xl:py-4 px-4 lg:max-xl:px-1.5 xl:px-4 2xl:px-5 text-center font-mono font-bold text-emerald-400 text-xs lg:max-xl:text-[11px] xl:text-sm 2xl:text-base whitespace-nowrap">
                        +${qtyPlus.toLocaleString('id-ID')}
                    </td>
                    <td class="hidden lg:table-cell py-2.5 lg:max-xl:py-2 xl:py-3.5 2xl:py-4 px-4 lg:max-xl:px-1.5 xl:px-4 2xl:px-5 text-center font-mono text-xs lg:max-xl:text-[10px] xl:text-xs 2xl:text-sm whitespace-nowrap">
                        <span class="text-neutral-400">${stokLama.toLocaleString('id-ID')}</span>
                        <span class="text-neutral-500 mx-1">&rarr;</span>
                        <span class="text-neutral-100 font-bold">${stokBaru.toLocaleString('id-ID')}</span>
                    </td>
                    <td class="hidden lg:table-cell py-2.5 lg:max-xl:py-2 xl:py-3.5 2xl:py-4 px-4 lg:max-xl:px-2 xl:px-4 2xl:px-5 whitespace-nowrap">
                        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs lg:max-xl:text-[10px] xl:text-xs 2xl:text-sm font-medium bg-[#171717] text-neutral-300 border border-[#262626]">
                            <svg class="w-3 h-3 2xl:w-3.5 2xl:h-3.5 text-neutral-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                            </svg>
                            ${this.escapeHtml(opName)}
                        </span>
                    </td>

                    <!-- Aksi (both) -->
                    <td class="py-1.5 sm:py-2 lg:py-2.5 px-1 sm:px-2 lg:px-4 text-center whitespace-nowrap">
                        <button type="button" onclick="MenuStockLog.openDetailModal('${this.escapeHtml(log.id || '')}', ${index})"
                            class="inline-flex items-center gap-1 p-1 sm:px-2.5 sm:py-1 bg-[#171717] hover:bg-[#242424] border border-[#2a2a2a] hover:border-neutral-500 text-neutral-300 hover:text-white rounded text-xs font-semibold transition-colors shadow-sm" title="Lihat detail mutasi">
                            <svg class="w-3.5 h-3.5 text-neutral-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <span class="hidden sm:inline">Detail</span>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    openDetailModal(logId, index) {
        let log = null;
        if (logId && this.currentLogs && this.currentLogs.length > 0) {
            log = this.currentLogs.find(item => String(item.id) === String(logId));
        }
        if (!log && typeof index === 'number' && this.currentLogs && this.currentLogs[index]) {
            log = this.currentLogs[index];
        }
        if (!log) {
            if (window.Toast) Toast.error('Data mutasi tidak ditemukan');
            return;
        }

        const elMenu = document.getElementById('stock-log-detail-menu');
        const elJumlah = document.getElementById('stock-log-detail-jumlah');
        const elStokSebelum = document.getElementById('stock-log-detail-stok-sebelum');
        const elStokSesudah = document.getElementById('stock-log-detail-stok-sesudah');
        const elOperator = document.getElementById('stock-log-detail-operator');
        const elWaktu = document.getElementById('stock-log-detail-waktu');
        const elCatatan = document.getElementById('stock-log-detail-catatan');

        const qtyPlus = Number(log.jumlah_masuk) || 0;
        const stokLama = Number(log.stok_sebelum) || 0;
        const stokBaru = Number(log.stok_sesudah) || 0;

        if (elMenu) elMenu.innerText = log.menu_nama || '-';
        if (elJumlah) elJumlah.innerText = `+${qtyPlus.toLocaleString('id-ID')}`;
        if (elStokSebelum) elStokSebelum.innerText = stokLama.toLocaleString('id-ID');
        if (elStokSesudah) elStokSesudah.innerText = stokBaru.toLocaleString('id-ID');
        if (elOperator) {
            elOperator.innerHTML = `
                <svg class="w-3.5 h-3.5 text-neutral-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
                <span>${this.escapeHtml(log.operator || 'system')}</span>
            `;
        }
        if (elWaktu) elWaktu.innerText = log.created_at || '-';
        if (elCatatan) {
            if (log.catatan && log.catatan !== '-') {
                elCatatan.innerHTML = this.escapeHtml(log.catatan);
                elCatatan.classList.remove('italic', 'text-neutral-500');
                elCatatan.classList.add('text-neutral-200');
            } else {
                elCatatan.innerHTML = '<span class="italic text-neutral-500">Tidak ada catatan untuk mutasi ini.</span>';
            }
        }

        const modal = document.getElementById('modal-stock-log-detail');
        if (modal) {
            modal.classList.remove('hidden');
        }
    },

    closeDetailModal() {
        const modal = document.getElementById('modal-stock-log-detail');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    renderPagination(pagination) {
        const pageInfo = document.getElementById('stock-log-page-info');
        const prevBtn = document.getElementById('stock-log-prev-btn');
        const nextBtn = document.getElementById('stock-log-next-btn');

        if (!pagination) return;

        const total = pagination.total || 0;
        const page = pagination.page || 1;
        const pages = pagination.pages || 1;

        if (pageInfo) {
            pageInfo.innerText = `Halaman ${page} dari ${pages || 1} (${total} total mutasi)`;
        }

        if (prevBtn) {
            prevBtn.disabled = !pagination.has_prev;
        }
        if (nextBtn) {
            nextBtn.disabled = !pagination.has_next;
        }
    },

    onSearchInput() {
        if (this.searchTimer) clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => {
            this.currentPage = 1;
            this.fetchLogs();
        }, 300);
    },

    filter() {
        this.currentPage = 1;
        this.fetchLogs();
    },

    resetFilter() {
        const searchInput = document.getElementById('stock-log-filter-search');
        const dateInput = document.getElementById('stock-log-filter-date');
        const operatorInput = document.getElementById('stock-log-filter-operator');

        if (searchInput) searchInput.value = '';
        if (dateInput) dateInput.value = '';
        if (operatorInput) operatorInput.value = '';

        this.currentPage = 1;
        this.fetchLogs();
    },

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.fetchLogs();
        }
    },

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.fetchLogs();
        }
    },

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
};

window.MenuStockLog = MenuStockLog;
