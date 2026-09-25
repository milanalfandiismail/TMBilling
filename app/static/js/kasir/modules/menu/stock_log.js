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

    async load() {
        await this.fetchLogs();
    },

    async fetchLogs() {
        const tbody = document.getElementById('stock-log-table-body');
        if (!tbody) return;

        // Render Loading spinner
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="py-12 text-center text-neutral-500">
                    <div class="flex flex-col items-center justify-center gap-2">
                        <div class="w-6 h-6 border-2 border-[#1c1c1c] border-t-neutral-100 rounded-full animate-spin"></div>
                        <span class="text-xs lg:max-xl:text-xs xl:text-sm text-neutral-400">Memuat riwayat stok...</span>
                    </div>
                </td>
            </tr>
        `;

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
            this.totalPages = res.pagination ? res.pagination.pages : 1;
            this.totalRecords = res.pagination ? res.pagination.total : items.length;
            this.currentPage = res.pagination ? res.pagination.page : 1;

            if (res.operators && Array.isArray(res.operators)) {
                this.updateOperatorDropdown(res.operators, params.operator);
            }

            this.renderTable(items);
            this.renderPagination(res.pagination);
        } catch (err) {
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

        tbody.innerHTML = items.map(log => {
            const qtyPlus = Number(log.jumlah_masuk) || 0;
            const stokLama = Number(log.stok_sebelum) || 0;
            const stokBaru = Number(log.stok_sesudah) || 0;
            const timeStr = log.created_at || '-';
            const opName = log.operator || 'system';
            const note = log.catatan && log.catatan !== '-' ? log.catatan : '<span class="text-neutral-600 italic">Tanpa catatan</span>';

            return `
                <tr class="hover:bg-[#111111] transition-colors text-xs lg:max-xl:text-[11px] xl:text-sm">
                    <td class="py-2.5 lg:max-xl:py-2 xl:py-3.5 px-4 lg:max-xl:px-2 xl:px-4 whitespace-nowrap text-neutral-400 font-mono text-xs lg:max-xl:text-[10px] xl:text-xs">${this.escapeHtml(timeStr)}</td>
                    <td class="py-2.5 lg:max-xl:py-2 xl:py-3.5 px-4 lg:max-xl:px-2 xl:px-4 font-semibold text-neutral-100 text-xs lg:max-xl:text-[11px] xl:text-sm max-w-[130px] lg:max-xl:max-w-[100px] xl:max-w-[160px] truncate" title="${this.escapeHtml(log.menu_nama || '')}">${this.escapeHtml(log.menu_nama || '-')}</td>
                    <td class="py-2.5 lg:max-xl:py-2 xl:py-3.5 px-4 lg:max-xl:px-1.5 xl:px-4 text-center whitespace-nowrap">
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] lg:max-xl:text-[9px] xl:text-xs font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                            RESTOCK
                        </span>
                    </td>
                    <td class="py-2.5 lg:max-xl:py-2 xl:py-3.5 px-4 lg:max-xl:px-1.5 xl:px-4 text-center font-mono font-bold text-emerald-400 text-xs lg:max-xl:text-[11px] xl:text-sm whitespace-nowrap">
                        +${qtyPlus.toLocaleString('id-ID')}
                    </td>
                    <td class="py-2.5 lg:max-xl:py-2 xl:py-3.5 px-4 lg:max-xl:px-1.5 xl:px-4 text-center font-mono text-xs lg:max-xl:text-[10px] xl:text-xs whitespace-nowrap">
                        <span class="text-neutral-400">${stokLama.toLocaleString('id-ID')}</span>
                        <span class="text-neutral-500 mx-1">&rarr;</span>
                        <span class="text-neutral-100 font-bold">${stokBaru.toLocaleString('id-ID')}</span>
                    </td>
                    <td class="py-2.5 lg:max-xl:py-2 xl:py-3.5 px-4 lg:max-xl:px-2 xl:px-4 whitespace-nowrap">
                        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs lg:max-xl:text-[10px] xl:text-xs font-medium bg-[#171717] text-neutral-300 border border-[#262626]">
                            <svg class="w-3 h-3 text-neutral-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                            </svg>
                            ${this.escapeHtml(opName)}
                        </span>
                    </td>
                    <td class="py-2.5 lg:max-xl:py-2 xl:py-3.5 px-4 lg:max-xl:px-2 xl:px-4 text-neutral-300 text-xs lg:max-xl:text-[11px] xl:text-sm max-w-[180px] lg:max-xl:max-w-[130px] xl:max-w-xs truncate" title="${this.escapeHtml(log.catatan || '')}">
                        ${note}
                    </td>
                </tr>
            `;
        }).join('');
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
