// app/static/js/kasir/modules/blackout/index.js

const Blackout = {
    currentDate: null,
    allData: [],
    filteredData: [],
    currentPage: 1,
    perPage: 6,
    totalPages: 1,
    currentStatusFilter: 'all',  // 'all' | 'pending' | 'resolved'
    currentTypeFilter: 'all',    // 'all' | 'member' | 'guest'
    currentGroupFilter: 'all',   // 'all' | specific group name (lowercase)
    searchQuery: '',
    _allGroups: [],
    _lastFingerprint: null,
    _hasResizeListener: false,

    getAdaptivePerPage() {
        const h = window.innerHeight;
        const w = window.innerWidth;
        if (h < 520) return 4;
        if (h < 640) return 5;
        if (w < 1280) return 6; // mobile, sm, md, lg: tepat 6 item
        if (w >= 1536 && h >= 1000) return 14;
        if (w >= 1280 && h >= 900) return 12;
        if (h >= 850) return 10;
        if (h >= 750) return 8;
        return 6;
    },

    _initResizeListener() {
        if (this._hasResizeListener) return;
        this._hasResizeListener = true;
        window.addEventListener('resize', Utils.debounce(() => {
            if (typeof App !== 'undefined' && App.currentTab !== 'blackout') return;
            const newPerPage = this.getAdaptivePerPage();
            if (newPerPage !== this.perPage) {
                this.perPage = newPerPage;
                this.currentPage = 1;
                this.applyFilters();
            }
        }, 200));
    },

    resetState() {
        this.currentDate = null;
        this.allData = [];
        this.filteredData = [];
        this.currentPage = 1;
        this.perPage = this.getAdaptivePerPage();
        this.currentStatusFilter = 'all';
        this.currentTypeFilter = 'all';
        this.currentGroupFilter = 'all';
        this.searchQuery = '';
        this._lastFingerprint = null;
    },

    async load() {
        this._initResizeListener();
        this.perPage = this.getAdaptivePerPage();
        await this.loadDates();
    },

    async loadDates() {
        try {
            const data = await API.blackout.dates();
            const dates = data.dates || [];
            this.renderDatePicker(dates);
            if (dates.length > 0) {
                this.currentDate = dates[0];
                await this.loadList(dates[0]);
            } else {
                this.allData = [];
                this.filteredData = [];
                this.renderEmpty();
            }
        } catch (err) {
            console.error("Blackout load error:", err);
            this.renderEmpty();
        }
    },

    renderDatePicker(dates) {
        const el = document.getElementById('blackout-date-picker');
        if (!el) return;
        el.innerHTML = dates.length === 0
            ? '<option value="">— Tidak Ada Data —</option>'
            : dates.map(d => `<option value="${d}">${d}</option>`).join('');
        el.onchange = () => this.loadList(el.value);
    },

    refreshLive() {
        if (typeof App !== 'undefined' && App.currentTab !== 'blackout') return;
        const isAppModalOpen = document.getElementById('app-modal') && !document.getElementById('app-modal').classList.contains('hidden');
        if (isAppModalOpen) return;
        return this.loadList(this.currentDate, true);
    },

    async loadList(date, isSilent = false) {
        this.currentDate = date;
        const tbody = document.getElementById('blackout-table-body');
        if (!tbody) return;

        if (!isSilent && (!this.allData || this.allData.length === 0)) {
            tbody.innerHTML = this.renderSkeletonRows(this.perPage || 5);
        }

        try {
            const data = await API.blackout.list(date);
            const list = data.data || [];

            const newFingerprint = JSON.stringify({
                date,
                items: list.map(b => ({
                    id: b.id,
                    pc: b.pc_kode,
                    jam: b.jam_mati,
                    tz: b.timezone,
                    sisa: b.sisa_waktu_mati,
                    resolved: b.is_blackout_resolved
                }))
            });

            if (isSilent && this._lastFingerprint === newFingerprint) {
                return; // Data tidak berubah
            }
            this._lastFingerprint = newFingerprint;
            this.allData = list;

            await this.populateGroupFilter();
            this.applyFilters();
        } catch (err) {
            console.error("Gagal memuat daftar blackout:", err);
            if (!isSilent) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center text-red-400 py-6 text-xs font-medium">Gagal memuat data blackout: ${Utils.escapeHtml(err.message || 'Error')}</td></tr>`;
            }
        }
    },

    renderSkeletonRows(count = 6) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <tr class="animate-pulse">
                    <td class="w-[32%] sm:w-[22%] md:w-[17%] lg:w-[14%] xl:w-[14%] 2xl:w-[14%] px-2 sm:px-2.5 py-1.5 text-left">
                        <div class="h-3.5 bg-[#202020] rounded w-16"></div>
                    </td>
                    <td class="hidden sm:table-cell sm:w-[26%] md:w-[23%] lg:w-[16%] xl:w-[17%] 2xl:w-[18%] px-2 sm:px-2.5 py-1.5 text-left">
                        <div class="h-3.5 bg-[#262626] rounded w-20"></div>
                    </td>
                    <td class="hidden lg:table-cell lg:w-[9%] xl:w-[9%] 2xl:w-[9%] px-2 sm:px-2.5 py-1.5 text-center">
                        <div class="h-3.5 bg-[#202020] rounded w-12 mx-auto"></div>
                    </td>
                    <td class="hidden md:table-cell md:w-[18%] lg:w-[15%] xl:w-[15%] 2xl:w-[15%] px-2 sm:px-2.5 py-1.5 text-center">
                        <div class="h-3.5 bg-[#1e1e1e] rounded w-16 mx-auto"></div>
                    </td>
                    <td class="w-[28%] sm:w-[22%] md:w-[16%] lg:w-[13%] xl:w-[13%] 2xl:w-[13%] px-2 sm:px-2.5 py-1.5 text-center">
                        <div class="h-3.5 bg-[#202020] rounded w-16 mx-auto"></div>
                    </td>
                    <td class="hidden lg:table-cell lg:w-[9%] xl:w-[9%] 2xl:w-[9%] px-2 sm:px-2.5 py-1.5 text-center">
                        <div class="h-3.5 bg-[#202020] rounded-full w-14 mx-auto"></div>
                    </td>
                    <td class="w-[40%] sm:w-[30%] md:w-[26%] lg:w-[24%] xl:w-[23%] 2xl:w-[22%] px-2 sm:px-2.5 py-1.5 text-right">
                        <div class="h-5 bg-[#202020] rounded w-20 ml-auto"></div>
                    </td>
                </tr>`;
        }
        return html;
    },

    async populateGroupFilter() {
        const select = document.getElementById('blackout-group-select');
        let groups = [];
        try {
            const res = await API.grup.list();
            groups = res.grup || [];
        } catch (err) {
            const unique = [...new Set(this.allData.map(s => s.grup).filter(Boolean))];
            groups = unique.map(name => ({ id: name, nama: name, warna: '#3B82F6' }));
        }
        this._allGroups = groups;

        if (select) {
            const prevVal = this.currentGroupFilter;
            let optionsHtml = '<option value="all">Semua Grup</option>';
            groups.forEach(g => {
                const gName = (g.nama || '').toLowerCase();
                optionsHtml += `<option value="${Utils.escapeHtml(gName)}">${Utils.escapeHtml(g.nama.toUpperCase())}</option>`;
            });
            select.innerHTML = optionsHtml;
            select.value = prevVal || 'all';
        }
    },

    renderStatusTabs() {
        const pendingCount = this.allData.filter(s => !s.is_blackout_resolved).length;
        const resolvedCount = this.allData.filter(s => s.is_blackout_resolved).length;
        const allCount = this.allData.length;

        const container = document.getElementById('blackout-status-tabs');
        if (!container) return;

        const st = this.currentStatusFilter;
        container.innerHTML = `
            <button type="button" onclick="Blackout.setStatusFilter('all')" data-status="all"
                class="blackout-status-pill px-2 py-0.5 sm:px-2.5 sm:py-1 rounded text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${st === 'all' ? 'bg-[#161616] text-white border border-neutral-400 shadow-sm' : 'bg-[#0a0a0a] text-neutral-400 border border-[#1f1f1f] hover:border-[#333] hover:text-neutral-200'}">
                <span>Semua</span>
                <span class="text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full ${st === 'all' ? 'bg-neutral-800 text-neutral-200' : 'bg-[#161616] text-neutral-500'} font-mono">${allCount}</span>
            </button>
            <button type="button" onclick="Blackout.setStatusFilter('pending')" data-status="pending"
                class="blackout-status-pill px-2 py-0.5 sm:px-2.5 sm:py-1 rounded text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${st === 'pending' ? 'bg-[#161616] text-white border border-red-500/60 shadow-sm' : 'bg-[#0a0a0a] text-neutral-400 border border-[#1f1f1f] hover:border-[#333] hover:text-neutral-200'}">
                <span class="w-1.5 h-1.5 rounded-full bg-red-500 ${pendingCount > 0 ? 'animate-pulse' : ''}"></span>
                <span>Menunggu</span>
                <span class="text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full ${st === 'pending' ? 'bg-red-950 text-red-300' : 'bg-[#161616] text-neutral-500'} font-mono">${pendingCount}</span>
            </button>
            <button type="button" onclick="Blackout.setStatusFilter('resolved')" data-status="resolved"
                class="blackout-status-pill px-2 py-0.5 sm:px-2.5 sm:py-1 rounded text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${st === 'resolved' ? 'bg-[#161616] text-white border border-emerald-500/60 shadow-sm' : 'bg-[#0a0a0a] text-neutral-400 border border-[#1f1f1f] hover:border-[#333] hover:text-neutral-200'}">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Selesai</span>
                <span class="text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full ${st === 'resolved' ? 'bg-emerald-950 text-emerald-300' : 'bg-[#161616] text-neutral-500'} font-mono">${resolvedCount}</span>
            </button>
        `;
    },

    setStatusFilter(status) {
        this.currentStatusFilter = status || 'all';
        this.currentPage = 1;
        this.applyFilters();
    },

    setTypeFilter(type) {
        this.currentTypeFilter = type || 'all';
        const select = document.getElementById('blackout-type-select');
        if (select) select.value = this.currentTypeFilter;
        this.currentPage = 1;
        this.applyFilters();
    },

    selectGroup(groupName) {
        this.currentGroupFilter = (groupName || '').toLowerCase() || 'all';
        const select = document.getElementById('blackout-group-select');
        if (select) select.value = this.currentGroupFilter;
        this.currentPage = 1;
        this.applyFilters();
    },

    doSearch() {
        const input = document.getElementById('blackout-search-input');
        this.searchQuery = input ? input.value.trim().toLowerCase() : '';
        const clearBtn = document.getElementById('blackout-search-clear');
        if (clearBtn) clearBtn.classList.toggle('hidden', !this.searchQuery);
        this.currentPage = 1;
        this.applyFilters();
    },

    debouncedSearch: Utils.debounce(function() {
        Blackout.doSearch();
    }, 300),

    clearSearch() {
        const input = document.getElementById('blackout-search-input');
        if (input) input.value = '';
        const clearBtn = document.getElementById('blackout-search-clear');
        if (clearBtn) clearBtn.classList.add('hidden');
        this.searchQuery = '';
        this.currentPage = 1;
        this.applyFilters();
    },

    resetFilters() {
        this.currentStatusFilter = 'all';
        this.currentTypeFilter = 'all';
        this.currentGroupFilter = 'all';
        this.searchQuery = '';
        this.currentPage = 1;

        const input = document.getElementById('blackout-search-input');
        if (input) input.value = '';
        const clearBtn = document.getElementById('blackout-search-clear');
        if (clearBtn) clearBtn.classList.add('hidden');

        const typeSelect = document.getElementById('blackout-type-select');
        if (typeSelect) typeSelect.value = 'all';

        const groupSelect = document.getElementById('blackout-group-select');
        if (groupSelect) groupSelect.value = 'all';

        this.applyFilters();
    },

    applyFilters() {
        const q = this.searchQuery;
        const status = this.currentStatusFilter;
        const type = this.currentTypeFilter;
        const group = this.currentGroupFilter;

        let filtered = this.allData.filter(s => {
            // Status match
            if (status === 'pending' && s.is_blackout_resolved) return false;
            if (status === 'resolved' && !s.is_blackout_resolved) return false;

            // Type match
            if (type !== 'all' && s.tipe !== type) return false;

            // Group match
            if (group !== 'all' && (s.grup || '').toLowerCase() !== group) return false;

            // Search query match (PC kode or Username)
            if (q) {
                const pcMatch = (s.pc_kode || '').toLowerCase().includes(q);
                const userMatch = (s.username || '').toLowerCase().includes(q);
                if (!pcMatch && !userMatch) return false;
            }

            return true;
        });

        // Sort: pending first, then tipe (member dulu baru guest), then grup, then id descending
        filtered.sort((a, b) => {
            if (a.is_blackout_resolved !== b.is_blackout_resolved) {
                return a.is_blackout_resolved ? 1 : -1;
            }
            if (a.tipe !== b.tipe) {
                return a.tipe === 'member' ? -1 : 1;
            }
            const grupDiff = (a.grup || '').localeCompare(b.grup || '');
            if (grupDiff !== 0) {
                return grupDiff;
            }
            return b.id - a.id;
        });

        this.filteredData = filtered;

        // Render counters on status pills
        this.renderStatusTabs();

        // Update Clear Resolved button visibility
        const clearBtn = document.getElementById('blackout-btn-clear-resolved');
        if (clearBtn) {
            const hasResolved = this.allData.some(s => s.is_blackout_resolved);
            clearBtn.classList.toggle('hidden', !hasResolved);
        }

        this.totalPages = Math.ceil(this.filteredData.length / this.perPage) || 1;
        if (this.currentPage > this.totalPages) {
            this.currentPage = this.totalPages;
        }
        if (this.currentPage < 1) {
            this.currentPage = 1;
        }

        const startIdx = (this.currentPage - 1) * this.perPage;
        const pageItems = this.filteredData.slice(startIdx, startIdx + this.perPage);

        this.renderTable(pageItems);
        this.renderPagination();
    },

    gotoPage(page) {
        if (page < 1 || page > this.totalPages) return;
        this.currentPage = page;
        const startIdx = (this.currentPage - 1) * this.perPage;
        const pageItems = this.filteredData.slice(startIdx, startIdx + this.perPage);
        this.renderTable(pageItems);
        this.renderPagination();
    },

    renderPagination() {
        const container = document.getElementById('blackout-pagination-controls');
        if (!container) return;

        const totalRecords = this.filteredData.length;
        if (totalRecords === 0) {
            container.innerHTML = '';
            return;
        }

        const startItem = (this.currentPage - 1) * this.perPage + 1;
        const endItem = Math.min(this.currentPage * this.perPage, totalRecords);
        const hasPrev = this.currentPage > 1;
        const hasNext = this.currentPage < this.totalPages;

        container.innerHTML = `
            <div class="flex items-center justify-between gap-1 text-[10px] sm:text-xs font-mono">
                <div class="text-neutral-400 truncate">
                    <span class="sm:hidden font-mono text-[10px]">${startItem}-${endItem}/${totalRecords}</span>
                    <span class="hidden sm:inline">Menampilkan <strong class="text-neutral-200">${startItem}-${endItem}</strong> dari <strong class="text-neutral-200">${totalRecords}</strong> Sesi</span>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                    <button onclick="Blackout.gotoPage(${this.currentPage - 1})"
                        class="px-2 sm:px-2.5 py-0.5 bg-[#171717] border border-[#262626] hover:bg-[#222] text-neutral-300 font-bold rounded transition-colors ${!hasPrev ? 'opacity-30 cursor-not-allowed' : ''}" ${!hasPrev ? 'disabled' : ''}
                        title="Halaman Sebelumnya">
                        <span class="sm:hidden font-bold">&lsaquo;</span>
                        <span class="hidden sm:inline">&larr; Prev</span>
                    </button>
                    <span class="px-1.5 sm:px-2 py-0.5 bg-[#0c0c0c] border border-[#1c1c1c] rounded text-neutral-200 font-mono font-bold text-[10px] sm:text-xs">
                        ${this.currentPage}/${this.totalPages}
                    </span>
                    <button onclick="Blackout.gotoPage(${this.currentPage + 1})"
                        class="px-2 sm:px-2.5 py-0.5 bg-[#171717] border border-[#262626] hover:bg-[#222] text-neutral-300 font-bold rounded transition-colors ${!hasNext ? 'opacity-30 cursor-not-allowed' : ''}" ${!hasNext ? 'disabled' : ''}
                        title="Halaman Berikutnya">
                        <span class="sm:hidden font-bold">&rsaquo;</span>
                        <span class="hidden sm:inline">Next &rarr;</span>
                    </button>
                </div>
            </div>
        `;
    },

    renderEmpty() {
        const tbody = document.getElementById('blackout-table-body');
        const pagination = document.getElementById('blackout-pagination-controls');
        if (pagination) pagination.innerHTML = '';
        if (!tbody) return;

        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="py-10 text-center">
                    <div class="flex flex-col items-center justify-center text-neutral-500">
                        <svg class="w-8 h-8 mb-2 opacity-30 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        <p class="text-xs font-bold uppercase tracking-wider text-neutral-300">Sistem Stabil</p>
                        <p class="text-[11px] text-neutral-500 mt-0.5">Tidak ada catatan sesi gangguan blackout pada tanggal ini.</p>
                    </div>
                </td>
            </tr>`;
    },

    renderTable(items) {
        const tbody = document.getElementById('blackout-table-body');
        if (!tbody) return;

        if (this.allData.length === 0) {
            this.renderEmpty();
            return;
        }

        if (items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="py-8 text-center">
                        <div class="flex flex-col items-center justify-center text-neutral-500">
                            <svg class="w-7 h-7 mb-1.5 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            <p class="text-xs font-bold uppercase tracking-wider text-neutral-400">Sesi Tidak Ditemukan</p>
                            <p class="text-[10px] text-neutral-500 mt-0.5">Tidak ada sesi yang cocok dengan kriteria filter saat ini.</p>
                            <button onclick="Blackout.resetFilters()" class="mt-2 px-2.5 py-1 bg-neutral-100 hover:bg-white text-black text-xs font-bold rounded transition-colors shadow-sm">Reset Filter</button>
                        </div>
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = items.map(s => this.renderRow(s)).join('');
    },

    renderRow(s) {
        const isMember = s.tipe === 'member';
        const isResolved = !!s.is_blackout_resolved;

        // Group styling
        const groupObj = (this._allGroups || []).find(g => (g.nama || '').toLowerCase() === (s.grup || '').toLowerCase());
        const groupColor = groupObj ? (groupObj.warna || '#3B82F6') : '#737373';

        // Unit PC display logic: absolutely clean without '??'
        let pcCodeDisplay = '';
        const rawPc = (s.pc_kode || '').trim();
        if (!rawPc || rawPc === '??' || rawPc === '-') {
            pcCodeDisplay = '<span class="font-mono text-neutral-500 text-xs font-medium">-</span>';
        } else {
            pcCodeDisplay = `<span class="font-mono font-bold text-neutral-200 text-xs tracking-tight">${Utils.escapeHtml(rawPc)}</span>`;
        }

        const groupBadge = `
            <span class="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider shrink-0"
                  style="color: ${groupColor}; background-color: ${groupColor}15; border: 1px solid ${groupColor}33">
                ${Utils.escapeHtml(s.grup || 'reguler')}
            </span>`;

        // Dynamic Timezone Display
        const tzLabel = Utils.escapeHtml(s.timezone || 'WITA');
        const waktuHtml = `
            <div class="flex items-center justify-center gap-1 font-mono">
                <span class="text-neutral-200 text-xs">${Utils.escapeHtml(s.jam_mati || '-')}</span>
                <span class="text-[9px] text-neutral-400 font-sans font-semibold">${tzLabel}</span>
            </div>`;

        // Action buttons (Segmented Action Button Group, Zero Wrapping)
        let actionHtml = '';
        if (isResolved) {
            actionHtml = `
                <div class="flex items-center justify-end gap-1 text-neutral-400 text-[10px] sm:text-[11px] font-semibold select-none">
                    <svg class="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                    <span>Teratasi</span>
                </div>`;
        } else if (isMember) {
            actionHtml = `
                <div class="inline-flex items-center rounded overflow-hidden border border-neutral-700/60 divide-x divide-neutral-700/60 shadow-sm shrink-0 whitespace-nowrap">
                    <button onclick="Blackout.resolveMember(${s.id}, '${Utils.escapeHtml(s.username)}', ${s.sisa_waktu_mati})"
                        class="px-2 sm:px-2.5 py-0.5 md:py-1 bg-neutral-100 hover:bg-white text-black text-[9px] sm:text-[10px] md:text-[11px] lg:text-xs font-bold transition-colors whitespace-nowrap"
                        title="Kembalikan sisa durasi ke saldo member">
                        <span class="sm:hidden">+${s.sisa_waktu_mati}m</span>
                        <span class="hidden sm:inline">Refund ${s.sisa_waktu_mati}m</span>
                    </button>
                    <button onclick="Blackout.resolveGuestTutup(${s.id}, '${Utils.escapeHtml(s.username)}')"
                        class="min-w-[24px] sm:min-w-[28px] px-2 sm:px-2.5 py-0.5 md:py-1 bg-[#2d1215] hover:bg-red-600 text-red-400 hover:text-white text-[9px] sm:text-[10px] md:text-[11px] lg:text-xs font-bold transition-colors whitespace-nowrap text-center"
                        title="Tutup sesi tanpa pengembalian">
                        ✕
                    </button>
                </div>`;
        } else {
            actionHtml = `
                <div class="inline-flex items-center rounded overflow-hidden border border-[#262626] divide-x divide-[#262626] shadow-sm shrink-0 whitespace-nowrap">
                    <button onclick="Blackout.resolveGuestSama(${s.id}, '${Utils.escapeHtml(s.username)}')"
                        class="px-1.5 sm:px-2 md:px-2.5 py-0.5 md:py-1 bg-[#171717] hover:bg-[#222] text-neutral-300 hover:text-white text-[9px] sm:text-[10px] md:text-[11px] lg:text-xs font-bold transition-colors whitespace-nowrap"
                        title="Lanjutkan sesi di PC yang sama">
                        Sama
                    </button>
                    <button onclick="Blackout.showLanjutModal(${s.id}, '${Utils.escapeHtml(s.username)}', '${Utils.escapeHtml(s.grup)}')"
                        class="px-1.5 sm:px-2 md:px-2.5 py-0.5 md:py-1 bg-neutral-100 hover:bg-white text-black text-[9px] sm:text-[10px] md:text-[11px] lg:text-xs font-bold transition-colors whitespace-nowrap"
                        title="Pindahkan sesi ke PC kosong lain">
                        Pindah
                    </button>
                    <button onclick="Blackout.resolveGuestTutup(${s.id}, '${Utils.escapeHtml(s.username)}')"
                        class="min-w-[24px] sm:min-w-[28px] px-2 sm:px-2.5 py-0.5 md:py-1 bg-[#2d1215] hover:bg-red-600 text-red-400 hover:text-white text-[9px] sm:text-[10px] md:text-[11px] lg:text-xs font-bold transition-colors whitespace-nowrap text-center"
                        title="Tutup sesi">
                        ✕
                    </button>
                </div>`;
        }

        const avatarSvg = isMember
            ? '<svg class="w-3 h-3 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>'
            : '<svg class="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>';

        const tipeBadge = isMember
            ? '<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-cyan-950/40 text-cyan-400 border border-cyan-800/40">MEMBER</span>'
            : '<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-950/40 text-amber-400 border border-amber-800/40">GUEST</span>';

        const statusBadge = isResolved
            ? '<span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-neutral-900 text-neutral-400 border border-neutral-700/50"><svg class="w-2.5 h-2.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>Selesai</span>'
            : '<span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-red-950/40 text-red-400 border border-red-800/40"><span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>Tertunda</span>';

        const rowOpacity = isResolved ? 'opacity-60 hover:opacity-100' : '';

        return `
            <tr class="hover:bg-[#141414] transition-colors ${rowOpacity}">
                <!-- Col 1: Unit PC (and Customer on < sm, Sesi ID on sm+) -->
                <td class="w-[32%] sm:w-[22%] md:w-[17%] lg:w-[14%] xl:w-[14%] 2xl:w-[14%] px-2 sm:px-2.5 py-1.5 text-left">
                    <div class="min-w-0">
                        <div class="flex items-center gap-1 flex-wrap">
                            ${pcCodeDisplay}
                            ${groupBadge}
                        </div>
                        <div class="sm:hidden text-[10px] text-neutral-300 font-medium truncate mt-0.5" title="${Utils.escapeHtml(s.username)}">
                            ${Utils.escapeHtml(s.username)}
                        </div>
                        <div class="hidden sm:block text-[9px] text-neutral-500 font-mono mt-0.5">
                            Sesi #${s.id}
                        </div>
                    </div>
                </td>

                <!-- Col 2: Pelanggan (hidden on < sm) -->
                <td class="hidden sm:table-cell sm:w-[26%] md:w-[23%] lg:w-[16%] xl:w-[17%] 2xl:w-[18%] px-2 sm:px-2.5 py-1.5 text-left">
                    <div class="flex items-center gap-1.5 min-w-0">
                        <div class="w-5 h-5 rounded bg-[#171717] border border-[#262626] flex items-center justify-center shrink-0">
                            ${avatarSvg}
                        </div>
                        <div class="min-w-0">
                            <span class="font-medium text-neutral-200 text-xs truncate block max-w-[120px] lg:max-w-[150px]" title="${Utils.escapeHtml(s.username)}">
                                ${Utils.escapeHtml(s.username)}
                            </span>
                            <span class="text-[9px] text-neutral-500 block">
                                ${isMember ? 'Akun Member' : 'Pengguna Guest'}
                            </span>
                        </div>
                    </div>
                </td>

                <!-- Col 3: Tipe Sesi (hidden on < lg) -->
                <td class="hidden lg:table-cell lg:w-[9%] xl:w-[9%] 2xl:w-[9%] px-2 sm:px-2.5 py-1.5 text-center">
                    ${tipeBadge}
                </td>

                <!-- Col 4: Waktu Terputus (hidden on < md) -->
                <td class="hidden md:table-cell md:w-[18%] lg:w-[15%] xl:w-[15%] 2xl:w-[15%] px-2 sm:px-2.5 py-1.5 text-center">
                    <div class="min-w-0">
                        ${waktuHtml}
                        <span class="text-[9px] text-neutral-500 block font-sans">Terputus</span>
                    </div>
                </td>

                <!-- Col 5: Sisa Durasi (and Micro Jam on < md) -->
                <td class="w-[28%] sm:w-[22%] md:w-[16%] lg:w-[13%] xl:w-[13%] 2xl:w-[13%] px-2 sm:px-2.5 py-1.5 text-center">
                    <div class="min-w-0">
                        <span class="font-mono text-emerald-400 font-bold bg-emerald-950/30 border border-emerald-800/30 px-1.5 py-0.2 rounded text-[10px] sm:text-xs">
                            +${Utils.formatMenit(s.sisa_waktu_mati)}
                        </span>
                        <div class="md:hidden text-[9px] text-neutral-500 font-mono mt-0.5">
                            ${Utils.escapeHtml(s.jam_mati || '-')} ${tzLabel}
                        </div>
                        <div class="hidden md:block text-[9px] text-neutral-500 font-sans mt-0.5">
                            Kompensasi
                        </div>
                    </div>
                </td>

                <!-- Col 6: Status (hidden on < lg) -->
                <td class="hidden lg:table-cell lg:w-[9%] xl:w-[9%] 2xl:w-[9%] px-2 sm:px-2.5 py-1.5 text-center">
                    ${statusBadge}
                </td>

                <!-- Col 7: Aksi Pemulihan -->
                <td class="w-[40%] sm:w-[30%] md:w-[26%] lg:w-[24%] xl:w-[23%] 2xl:w-[22%] px-2 sm:px-2.5 py-1.5 text-right">
                    ${actionHtml}
                </td>
            </tr>`;
    },

    async deteksi() {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        const thresholdSelect = document.getElementById('blackout-threshold');
        const threshold = thresholdSelect ? parseInt(thresholdSelect.value) : 60;
        try {
            const result = await API.blackout.deteksi(threshold);
            if (result.total > 0) {
                Toast.success(`✅ ${result.message}`);
                await this.loadDates();
                if (typeof Dashboard !== 'undefined') await Dashboard.load();
            } else {
                Toast.success('Tidak ada sesi blackout yang terdeteksi.');
            }
        } catch (err) {
            Toast.error('Deteksi Gagal: ' + err.message);
        }
    },

    async resolveMember(sesiId, username, sisa) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        const message = `<div class="text-center"><p class="text-xs sm:text-sm text-neutral-400">Refund <span class="text-neutral-200 font-bold font-mono">${sisa} menit</span> ke member <span class="text-neutral-200 font-bold font-mono">"${username}"</span>?</p></div>`;
        Modal.confirm(message, async () => {
            try {
                await API.blackout.resolveMember(sesiId);
                Toast.success('✅ Refund berhasil');
                await this.loadList(this.currentDate);
            } catch (err) {
                Toast.error(err.message);
            }
        });
    },

    async resolveGuestSama(sesiId, namaGuest) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        const message = `<div class="text-center"><p class="text-xs sm:text-sm text-neutral-400">Lanjutkan sesi <span class="text-neutral-200 font-bold font-mono">"${namaGuest}"</span> di PC yang sama?</p></div>`;
        Modal.confirm(message, async () => {
            try {
                await API.blackout.resolveGuestSama(sesiId);
                Toast.success('✅ Sesi dilanjutkan');
                await this.loadList(this.currentDate);
            } catch (err) {
                Toast.error(err.message);
            }
        });
    },

    async showLanjutModal(sesiId, namaGuest, pcGrup) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        const grup = (pcGrup || 'reguler').toLowerCase();
        try {
            const data = await API.pc.list();
            const kosong = (data.pc_list || []).filter(p => (p.status || '').toLowerCase() === 'kosong' && (p.grup || '').toLowerCase() === grup);

            if (kosong.length === 0) {
                return Toast.error(`Tidak ada PC kosong di ${grup.toUpperCase()}`);
            }

            let cardsHtml = '<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-2.5">';
            kosong.forEach(pc => {
                cardsHtml += `
                    <div class="pc-card-tujuan bg-[#050505] border border-[#1c1c1c] rounded p-2.5 sm:p-3 cursor-pointer hover:border-neutral-500 transition-colors text-center shadow-sm" data-pc-id="${pc.id}">
                        <div class="font-bold text-neutral-200 font-mono text-xs sm:text-sm">${Utils.escapeHtml(pc.kode)}</div>
                        <div class="text-[9px] sm:text-[10px] text-neutral-500 font-mono mt-0.5">${Utils.escapeHtml(pc.ip_address || '-')}</div>
                    </div>`;
            });
            cardsHtml += '</div>';

            Modal.show(`
                <div class="bg-[#0c0c0c] border border-[#262626] rounded-xl max-w-sm sm:max-w-md md:max-w-xl lg:max-w-2xl w-[calc(100%-1.5rem)] sm:w-[calc(100%-2rem)] md:w-full mx-auto max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
                    <!-- Modal Header (Fixed / Sticky) -->
                    <div class="shrink-0 flex items-center justify-between p-3.5 sm:p-5 border-b border-[#1c1c1c] bg-[#0c0c0c]">
                        <div>
                            <h3 class="text-xs sm:text-sm font-bold text-neutral-100 uppercase tracking-wider">Pindahkan Sesi</h3>
                            <p class="text-[10px] sm:text-xs text-neutral-500 mt-0.5">Guest: ${Utils.escapeHtml(namaGuest)} &middot; ${grup.toUpperCase()}</p>
                        </div>
                        <button onclick="Modal.closeModal()" class="text-neutral-400 hover:text-white p-1 rounded hover:bg-neutral-800 text-xl leading-none" title="Tutup">&times;</button>
                    </div>
                    <!-- Modal Body (Scrollable internal) -->
                    <div class="flex-1 overflow-y-auto p-3.5 sm:p-5 min-h-0">
                        ${cardsHtml}
                    </div>
                    <!-- Modal Footer (Fixed / Sticky - Always Visible) -->
                    <div class="shrink-0 flex justify-end p-3 sm:p-4 border-t border-[#1c1c1c] bg-[#080808]">
                        <button onclick="Modal.closeModal()" class="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-[#171717] border border-[#262626] hover:bg-[#222] text-neutral-300 hover:text-white text-xs font-bold rounded transition-colors shadow-sm">Batal</button>
                    </div>
                </div>
            `);

            document.querySelectorAll('.pc-card-tujuan').forEach(card => {
                card.addEventListener('click', async () => {
                    const pcId = card.getAttribute('data-pc-id');
                    if (pcId) {
                        Modal.closeModal();
                        try {
                            await API.blackout.resolveGuestLanjut(sesiId, parseInt(pcId));
                            Toast.success('✅ Sesi berhasil dipindahkan');
                            await this.loadList(this.currentDate);
                        } catch (err) {
                            Toast.error(err.message);
                        }
                    }
                });
            });
        } catch (err) {
            Toast.error('Gagal memuat daftar PC');
        }
    },

    async resolveGuestTutup(sesiId, namaGuest) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        const message = `<div class="text-center"><p class="text-xs sm:text-sm text-neutral-400">Tutup sesi untuk guest <span class="text-red-400 font-bold">"${namaGuest}"</span>?</p></div>`;
        Modal.confirm(message, async () => {
            try {
                await API.blackout.resolveGuestTutup(sesiId);
                Toast.success('✅ Sesi ditutup');
                await this.loadList(this.currentDate);
            } catch (err) {
                Toast.error(err.message);
            }
        });
    },

    async clearResolved() {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        if (!this.currentDate) return;
        const message = `<div class="text-center"><p class="text-xs sm:text-sm text-neutral-400 font-bold uppercase tracking-wider">Hapus semua data terselesaikan?</p><p class="text-[10px] sm:text-xs text-neutral-500 mt-1">Tanggal: ${this.currentDate}</p></div>`;
        Modal.confirm(message, async () => {
            try {
                await API.blackout.clearResolved(this.currentDate);
                Toast.success('✅ Data dibersihkan');
                await this.loadDates();
            } catch (err) {
                Toast.error(err.message);
            }
        });
    },

    async forceAllAndDetect() {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        if (!confirm('⚠️ PERINGATAN: Tutup paksa semua sesi aktif?\n\nIni akan menutup semua sesi dan memindahkannya ke riwayat blackout.\n\nLanjutkan?')) return;

        try {
            const result = await API.blackout.forceAllAndDetect();
            Toast.success('✅ Grid shutdown dieksekusi');
            if (typeof Dashboard !== 'undefined') await Dashboard.load();
            await this.loadDates();
        } catch (err) {
            Toast.error('Gagal: ' + err.message);
        }
    }
};

window.Blackout = Blackout;
