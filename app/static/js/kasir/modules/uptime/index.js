// app/static/js/kasir/modules/uptime/index.js

const UptimeTracker = {
    mode: 'daily', // 'daily' atau 'range'
    currentPreset: 'today',
    currentDate: null,
    _lastFingerprint: null,
    _lastData: null,
    
    // Pagination & Group Filter state
    currentPage: 1,
    perPage: 10,
    activeGroup: 'Semua',
    _rawData: [],
    _reportMeta: {},
    _hasResizeListener: false,

    getAdaptivePerPage() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (w >= 1536 && h >= 950) return 8;  // 2xl / 1080p full screen
        if (w >= 1024 && h >= 850) return 6;  // lg desktop
        if (w >= 768)  return 6;               // md tablet
        return 5;                              // mobile (< md)
    },

    _initResizeListener() {
        if (this._hasResizeListener) return;
        this._hasResizeListener = true;
        window.addEventListener('resize', () => {
            if (typeof App !== 'undefined' && App.currentTab !== 'uptime') return;
            const newPerPage = this.getAdaptivePerPage();
            if (newPerPage !== this.perPage) {
                this.perPage = newPerPage;
                this.currentPage = 1;
                this.renderTableContent();
            }
        });
    },

    init() {
        this.perPage = this.getAdaptivePerPage();
        this._initResizeListener();
        this.setPreset('today');
    },

    setPreset(preset) {
        this.currentPreset = preset;
        const now = new Date();
        const formatDate = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const customContainer = document.getElementById('uptime-custom-container');
        const dateInput = document.getElementById('uptime-date');
        const startInput = document.getElementById('uptime-start');
        const endInput = document.getElementById('uptime-end');
        const thSeenFirst = document.getElementById('th-seen-first');
        const thSeenLast = document.getElementById('th-seen-last');

        // Reset pill styles
        document.querySelectorAll('.uptime-preset-btn').forEach(btn => {
            btn.className = "uptime-preset-btn px-2 sm:px-2.5 py-1 rounded text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap bg-[#161616] hover:bg-[#222] text-neutral-300 hover:text-white border border-[#262626]";
        });
        const activeBtn = document.getElementById(`uptime-preset-${preset}`);
        if (activeBtn) {
            activeBtn.className = "uptime-preset-btn px-2 sm:px-2.5 py-1 rounded text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap bg-neutral-100 text-black shadow-sm";
        }

        this.currentPage = 1;
        this.activeGroup = 'Semua';

        if (preset === 'today') {
            if (customContainer) customContainer.classList.add('hidden');
            this.mode = 'daily';
            if (dateInput) dateInput.value = formatDate(now);
            if (thSeenFirst) thSeenFirst.textContent = 'Waktu / Rentang Aktif';
            if (thSeenLast) thSeenLast.textContent = 'Durasi Online & Billing';
            this.load();
        } else if (preset === 'yesterday') {
            if (customContainer) customContainer.classList.add('hidden');
            this.mode = 'daily';
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            if (dateInput) dateInput.value = formatDate(yesterday);
            if (thSeenFirst) thSeenFirst.textContent = 'Waktu / Rentang Aktif';
            if (thSeenLast) thSeenLast.textContent = 'Durasi Online & Billing';
            this.load();
        } else if (preset === '7days') {
            if (customContainer) customContainer.classList.add('hidden');
            this.mode = 'range';
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            if (startInput) startInput.value = formatDate(sevenDaysAgo);
            if (endInput) endInput.value = formatDate(now);
            if (thSeenFirst) thSeenFirst.textContent = 'Hari Aktif';
            if (thSeenLast) thSeenLast.textContent = 'Durasi Online & Billing';
            this.load();
        } else if (preset === '30days') {
            if (customContainer) customContainer.classList.add('hidden');
            this.mode = 'range';
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            if (startInput) startInput.value = formatDate(thirtyDaysAgo);
            if (endInput) endInput.value = formatDate(now);
            if (thSeenFirst) thSeenFirst.textContent = 'Hari Aktif';
            if (thSeenLast) thSeenLast.textContent = 'Durasi Online & Billing';
            this.load();
        } else if (preset === 'custom') {
            if (customContainer) {
                const isHidden = customContainer.classList.toggle('hidden');
                if (!isHidden) {
                    const cStart = document.getElementById('uptime-custom-start');
                    const cEnd = document.getElementById('uptime-custom-end');
                    if (cStart && !cStart.value) cStart.value = startInput?.value || formatDate(now);
                    if (cEnd && !cEnd.value) cEnd.value = endInput?.value || formatDate(now);
                }
            }
        }
    },

    applyCustom() {
        const cStart = document.getElementById('uptime-custom-start')?.value;
        const cEnd = document.getElementById('uptime-custom-end')?.value;
        if (!cStart || !cEnd) {
            if (typeof Toast !== 'undefined') Toast.error('Tanggal mulai dan akhir wajib diisi');
            return;
        }

        const dateInput = document.getElementById('uptime-date');
        const startInput = document.getElementById('uptime-start');
        const endInput = document.getElementById('uptime-end');
        const thSeenFirst = document.getElementById('th-seen-first');
        const thSeenLast = document.getElementById('th-seen-last');

        this.currentPage = 1;
        this.activeGroup = 'Semua';

        if (cStart === cEnd) {
            this.mode = 'daily';
            if (dateInput) dateInput.value = cStart;
            if (thSeenFirst) thSeenFirst.textContent = 'Waktu / Rentang Aktif';
            if (thSeenLast) thSeenLast.textContent = 'Durasi Online & Billing';
        } else {
            this.mode = 'range';
            if (startInput) startInput.value = cStart;
            if (endInput) endInput.value = cEnd;
            if (thSeenFirst) thSeenFirst.textContent = 'Hari Aktif';
            if (thSeenLast) thSeenLast.textContent = 'Durasi Online & Billing';
        }
        this.load();
    },

    toggleMode() {
        this.load();
    },

    refreshLive() {
        if (typeof App !== 'undefined' && App.currentTab !== 'uptime') return;
        return this.load(true);
    },

    async load(isSilent = false) {
        const tbody = document.getElementById('uptime-table-body');
        if (!tbody) return;
        
        if (!isSilent && (!this._lastData) && typeof Skeleton !== 'undefined') {
            tbody.innerHTML = Skeleton.tableRows(this.perPage, 4);
        }

        try {
            if (this.mode === 'daily') {
                const date = document.getElementById('uptime-date')?.value;
                if (!date) {
                    if (!isSilent && typeof Toast !== 'undefined') Toast.error('Tanggal wajib dipilih');
                    return;
                }
                
                const res = await API.uptime.daily(date);
                if (res.success) {
                    const newFingerprint = JSON.stringify({ mode: 'daily', date, data: res.pcs || res.data });
                    if (isSilent && this._lastFingerprint === newFingerprint) {
                        return; // Data tidak berubah
                    }
                    this._lastFingerprint = newFingerprint;
                    this._lastData = res;

                    this.processDailyData(res);
                } else {
                    throw new Error(res.error || 'Gagal memuat data');
                }
            } else {
                const start = document.getElementById('uptime-start')?.value;
                const end = document.getElementById('uptime-end')?.value;
                
                if (!start || !end) {
                    if (!isSilent && typeof Toast !== 'undefined') Toast.error('Tanggal mulai dan akhir wajib dipilih');
                    return;
                }
                
                const res = await API.uptime.range(start, end);
                if (res.success) {
                    const newFingerprint = JSON.stringify({ mode: 'range', start, end, data: res.pcs || res.data });
                    if (isSilent && this._lastFingerprint === newFingerprint) {
                        return; // Data tidak berubah
                    }
                    this._lastFingerprint = newFingerprint;
                    this._lastData = res;

                    this.processRangeData(res, start, end);
                } else {
                    throw new Error(res.error || 'Gagal memuat data');
                }
            }
        } catch (err) {
            if (!isSilent) {
                console.error('UptimeTracker Error:', err);
                tbody.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center py-10 text-red-500 font-medium">
                            ⚠️ Gagal memuat data: ${err.message}
                        </td>
                    </tr>
                `;
            }
        }
    },

    formatTimeOnly(isoStr) {
        if (!isoStr) return '-';
        try {
            const d = new Date(isoStr);
            return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '-';
        }
    },

    processDailyData(data) {
        const desc = document.getElementById('uptime-report-desc');
        if (desc) desc.textContent = `Laporan: ${Utils.formatTanggal(data.date)}`;

        const report = data.report || [];
        report.sort((a, b) => (a.pc_kode || '').localeCompare(b.pc_kode || '', undefined, { numeric: true, sensitivity: 'base' }));

        this._rawData = report;
        this._reportMeta = { mode: 'daily', date: data.date };

        // KPIs calculation
        let totalOnlineSec = 0;
        let totalBillingSec = 0;
        report.forEach(item => {
            totalOnlineSec += item.total_online_seconds;
            totalBillingSec += item.total_billing_seconds;
        });

        let avgUtil = 0;
        if (totalOnlineSec > 0) {
            avgUtil = Math.round((totalBillingSec / totalOnlineSec) * 100);
        }
        const onlineHours = (totalOnlineSec / 3600).toFixed(1);
        const billingHours = (totalBillingSec / 3600).toFixed(1);
        this.updateKPIs(avgUtil, `${onlineHours} Jam`, `${billingHours} Jam`);

        this.renderGroupPills(report);
        this.renderTableContent();
    },

    processRangeData(data, start, end) {
        const desc = document.getElementById('uptime-report-desc');
        if (desc) desc.textContent = `Laporan: ${Utils.formatTanggal(start)} s/d ${Utils.formatTanggal(end)}`;

        const pcs = data.pcs || [];
        pcs.sort((a, b) => (a.pc_kode || '').localeCompare(b.pc_kode || '', undefined, { numeric: true, sensitivity: 'base' }));

        this._rawData = pcs;
        this._reportMeta = { mode: 'range', start, end };

        const summary = data.summary || {};
        const onlineHours = (summary.total_online_menit / 60).toFixed(1);
        const billingHours = (summary.total_billing_menit / 60).toFixed(1);
        this.updateKPIs(summary.avg_utilisasi_persen, `${onlineHours} Jam`, `${billingHours} Jam`);

        this.renderGroupPills(pcs);
        this.renderTableContent();
    },

    renderGroupPills(items) {
        const pillsContainer = document.getElementById('uptime-group-pills');
        if (!pillsContainer) return;

        if (items.length === 0) {
            pillsContainer.innerHTML = '';
            return;
        }

        // Count per group
        const counts = { 'Semua': items.length };
        items.forEach(item => {
            const g = item.grup || 'Reguler';
            counts[g] = (counts[g] || 0) + 1;
        });

        const groups = Object.keys(counts);
        pillsContainer.innerHTML = groups.map(g => {
            const count = counts[g];
            const isActive = this.activeGroup === g;
            const activeCls = isActive 
                ? "bg-neutral-100 text-black font-bold shadow-sm" 
                : "bg-[#161616] hover:bg-[#222] text-neutral-300 hover:text-white border border-[#262626]";
            const label = g === 'Semua' ? '🌐 Semua' : g.toUpperCase();
            return `
                <button type="button" onclick="UptimeTracker.filterByGroup('${g}')"
                    class="uptime-group-btn px-2 sm:px-2.5 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs transition-all whitespace-nowrap flex items-center gap-1.5 ${activeCls}">
                    <span>${label}</span>
                    <span class="px-1.5 py-0.2 rounded-full text-[9px] ${isActive ? 'bg-black/20 text-black font-bold' : 'bg-[#262626] text-neutral-400'} font-mono">${count}</span>
                </button>
            `;
        }).join('');
    },

    filterByGroup(grup) {
        this.activeGroup = grup;
        this.currentPage = 1;
        this.renderGroupPills(this._rawData);
        this.renderTableContent();
    },

    goToPage(page) {
        this.currentPage = page;
        this.renderTableContent();
    },

    renderTableContent() {
        const tbody = document.getElementById('uptime-table-body');
        const pagContainer = document.getElementById('uptime-pagination');
        const pagInfo = document.getElementById('uptime-pagination-info');
        const pagControls = document.getElementById('uptime-pagination-controls');
        if (!tbody) return;

        // Filter by activeGroup
        let filtered = this._rawData;
        if (this.activeGroup !== 'Semua') {
            filtered = filtered.filter(item => (item.grup || 'Reguler') === this.activeGroup);
        }

        const totalFiltered = filtered.length;

        if (totalFiltered === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-8 text-neutral-500 text-xs">
                        Tidak ada aktivitas PC client yang terekam.
                    </td>
                </tr>
            `;
            if (pagContainer) pagContainer.classList.add('hidden');
            return;
        }

        // Pagination calculations
        const totalPages = Math.ceil(totalFiltered / this.perPage) || 1;
        if (this.currentPage > totalPages) this.currentPage = totalPages;
        if (this.currentPage < 1) this.currentPage = 1;

        const startIdx = (this.currentPage - 1) * this.perPage;
        const endIdx = Math.min(startIdx + this.perPage, totalFiltered);
        const pagedItems = filtered.slice(startIdx, endIdx);

        // Render rows
        if (this._reportMeta.mode === 'daily') {
            tbody.innerHTML = pagedItems.map(item => this._renderDailyRow(item)).join('');
        } else {
            tbody.innerHTML = pagedItems.map(item => this._renderRangeRow(item)).join('');
        }

        // Render Pagination Controls
        if (pagContainer && pagInfo && pagControls) {
            pagInfo.textContent = `Menampilkan ${startIdx + 1}-${endIdx} dari ${totalFiltered} PC`;
            if (totalFiltered <= this.perPage) {
                pagControls.innerHTML = '';
                pagContainer.classList.remove('hidden');
            } else {
                pagContainer.classList.remove('hidden');

                let buttonsHtml = '';

                // Prev button
                const prevDisabled = this.currentPage <= 1;
                buttonsHtml += `
                    <button type="button" onclick="UptimeTracker.goToPage(${this.currentPage - 1})" ${prevDisabled ? 'disabled' : ''}
                        class="px-2.5 py-1 rounded text-[10px] sm:text-xs font-bold transition-all bg-[#161616] border border-[#262626] text-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#222]">
                        &larr;
                    </button>
                `;

                // Page pills
                for (let p = 1; p <= totalPages; p++) {
                    const isCur = p === this.currentPage;
                    buttonsHtml += `
                        <button type="button" onclick="UptimeTracker.goToPage(${p})"
                            class="px-2.5 py-1 rounded text-[10px] sm:text-xs font-bold transition-all ${isCur ? 'bg-neutral-100 text-black shadow-sm' : 'bg-[#161616] hover:bg-[#222] text-neutral-300 border border-[#262626]'}">
                            ${p}
                        </button>
                    `;
                }

                // Next button
                const nextDisabled = this.currentPage >= totalPages;
                buttonsHtml += `
                    <button type="button" onclick="UptimeTracker.goToPage(${this.currentPage + 1})" ${nextDisabled ? 'disabled' : ''}
                        class="px-2.5 py-1 rounded text-[10px] sm:text-xs font-bold transition-all bg-[#161616] border border-[#262626] text-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#222]">
                        &rarr;
                    </button>
                `;

                pagControls.innerHTML = buttonsHtml;
            }
        }
    },

    _renderDailyRow(item) {
        const onlineMin = Math.round(item.total_online_seconds / 60);
        const billingMin = Math.round(item.total_billing_seconds / 60);
        const idleMin = Math.max(0, onlineMin - billingMin);

        const utilization = item.utilisasi_persen;
        let badgeColor = 'text-red-400 bg-red-950/20 border-red-900/30';
        if (utilization >= 70.0) {
            badgeColor = 'text-emerald-400 bg-emerald-950/20 border-emerald-900/30';
        } else if (utilization >= 40.0) {
            badgeColor = 'text-amber-400 bg-amber-950/20 border-amber-900/30';
        }

        const grupWarna = item.grup_warna || '#888888';

        return `
            <tr class="hover:bg-[#171717]/30 transition-colors border-b border-[#1c1c1c] last:border-b-0">
                <td class="py-2 sm:py-2.5 px-2.5 sm:px-3 text-neutral-200">
                    <div class="flex items-center gap-2 min-w-0">
                        <div class="flex flex-col min-w-0 flex-1">
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="font-bold font-mono text-neutral-100 text-xs sm:text-xs xl:text-sm">${item.pc_kode}</span>
                                <span class="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded inline-block w-fit" style="background-color: ${grupWarna}15; color: ${grupWarna}; border: 1px solid ${grupWarna}30;">${item.grup || 'Reguler'}</span>
                            </div>
                            <div class="md:hidden flex flex-col gap-0.5 mt-1 text-[10px] text-neutral-400 font-mono">
                                <div class="truncate max-w-[calc(100vw-145px)] md:max-w-none">
                                    <span class="text-neutral-500">Mulai:</span> <strong class="text-neutral-300">${item.first_seen_time || this.formatTimeOnly(item.first_seen)}</strong>
                                    <span class="text-neutral-600 mx-1">•</span>
                                    <span class="text-neutral-500">Akhir:</span> ${item.last_seen_time || this.formatTimeOnly(item.last_seen)}
                                </div>
                                <div class="truncate max-w-[calc(100vw-145px)] md:max-w-none">
                                    <span class="text-neutral-300 font-semibold">Online: ${Utils.formatMenit(onlineMin)}</span>
                                    <span class="text-neutral-600 mx-1">•</span>
                                    <span class="text-emerald-400 font-semibold">Bill: ${Utils.formatMenit(billingMin)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </td>
                <td class="hidden md:table-cell py-2 sm:py-2.5 px-2 sm:px-2.5 xl:px-4 text-neutral-300 font-mono whitespace-nowrap">
                    <div class="flex flex-col">
                        <span class="text-neutral-300 font-mono text-[10px] sm:text-xs">Mulai: <strong class="text-neutral-200">${item.first_seen_time || this.formatTimeOnly(item.first_seen)}</strong></span>
                        <span class="text-neutral-500 font-mono text-[10px] sm:text-xs mt-0.5">Akhir: ${item.last_seen_time || this.formatTimeOnly(item.last_seen)}</span>
                    </div>
                </td>
                <td class="hidden md:table-cell py-2 sm:py-2.5 px-2 sm:px-2.5 xl:px-4 text-neutral-300 font-mono whitespace-nowrap">
                    <div class="flex flex-col">
                        <span class="font-bold font-mono text-neutral-200 text-xs sm:text-xs xl:text-sm">Online: ${Utils.formatMenit(onlineMin)}</span>
                        <span class="text-[10px] sm:text-xs text-neutral-400 font-mono mt-0.5">
                            Billing: <strong class="text-emerald-400">${Utils.formatMenit(billingMin)}</strong> <span class="text-neutral-600">|</span> Idle: ${Utils.formatMenit(idleMin)}
                        </span>
                    </div>
                </td>
                <td class="py-2 sm:py-2.5 px-2.5 sm:px-3 xl:px-4 text-right md:text-center whitespace-nowrap shrink-0">
                    <div class="flex flex-col items-end md:items-center">
                        <span class="inline-block px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border ${badgeColor}">
                            ${utilization}%
                        </span>
                        <span class="text-[9px] text-neutral-500 font-mono mt-0.5">
                            ${utilization >= 70 ? 'Tinggi' : (utilization >= 40 ? 'Sedang' : 'Rendah')}
                        </span>
                    </div>
                </td>
            </tr>
        `;
    },

    _renderRangeRow(item) {
        const onlineMin = Math.round(item.total_online_menit);
        const billingMin = Math.round(item.total_billing_menit);
        const idleMin = Math.max(0, onlineMin - billingMin);

        const avgOnlinePerHari = Math.round(onlineMin / (item.hari_aktif || 1));

        const utilization = item.utilisasi_persen;
        let badgeColor = 'text-red-400 bg-red-950/20 border-red-900/30';
        if (utilization >= 70.0) {
            badgeColor = 'text-emerald-400 bg-emerald-950/20 border-emerald-900/30';
        } else if (utilization >= 40.0) {
            badgeColor = 'text-amber-400 bg-amber-950/20 border-amber-900/30';
        }

        const grupWarna = item.grup_warna || '#888888';

        return `
            <tr class="hover:bg-[#171717]/30 transition-colors border-b border-[#1c1c1c] last:border-b-0">
                <td class="py-2 sm:py-2.5 px-2.5 sm:px-3 text-neutral-200">
                    <div class="flex items-center gap-2 min-w-0">
                        <div class="flex flex-col min-w-0 flex-1">
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="font-bold font-mono text-neutral-100 text-xs sm:text-xs xl:text-sm">${item.pc_kode}</span>
                                <span class="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded inline-block w-fit" style="background-color: ${grupWarna}15; color: ${grupWarna}; border: 1px solid ${grupWarna}30;">${item.grup || 'Reguler'}</span>
                            </div>
                            <div class="md:hidden flex flex-col gap-0.5 mt-1 text-[10px] text-neutral-400 font-mono">
                                <div class="truncate max-w-[calc(100vw-145px)] md:max-w-none">
                                    <span class="text-neutral-500">Aktif:</span> <strong class="text-neutral-300">${item.hari_aktif} Hari</strong>
                                    <span class="text-neutral-600 mx-1">•</span>
                                    <span class="text-neutral-500">Rerata:</span> ${Utils.formatMenit(avgOnlinePerHari)}/hari
                                </div>
                                <div class="truncate max-w-[calc(100vw-145px)] md:max-w-none">
                                    <span class="text-neutral-300 font-semibold">Online: ${Utils.formatMenit(onlineMin)}</span>
                                    <span class="text-neutral-600 mx-1">•</span>
                                    <span class="text-emerald-400 font-semibold">Bill: ${Utils.formatMenit(billingMin)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </td>
                <td class="hidden md:table-cell py-2 sm:py-2.5 px-2 sm:px-2.5 xl:px-4 text-neutral-300 whitespace-nowrap">
                    <div class="flex flex-col">
                        <span class="text-neutral-200 font-semibold text-xs sm:text-xs xl:text-sm font-mono">${item.hari_aktif} Hari Aktif</span>
                        <span class="text-neutral-500 font-mono text-[10px] sm:text-xs mt-0.5">Rata-rata: ${Utils.formatMenit(avgOnlinePerHari)}/hari</span>
                    </div>
                </td>
                <td class="hidden md:table-cell py-2 sm:py-2.5 px-2 sm:px-2.5 xl:px-4 text-neutral-300 font-mono whitespace-nowrap">
                    <div class="flex flex-col">
                        <span class="font-bold font-mono text-neutral-200 text-xs sm:text-xs xl:text-sm">Online: ${Utils.formatMenit(onlineMin)}</span>
                        <span class="text-[10px] sm:text-xs text-neutral-400 font-mono mt-0.5">
                            Billing: <strong class="text-emerald-400">${Utils.formatMenit(billingMin)}</strong> <span class="text-neutral-600">|</span> Idle: ${Utils.formatMenit(idleMin)}
                        </span>
                    </div>
                </td>
                <td class="py-2 sm:py-2.5 px-2.5 sm:px-3 xl:px-4 text-right md:text-center whitespace-nowrap shrink-0">
                    <div class="flex flex-col items-end md:items-center">
                        <span class="inline-block px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border ${badgeColor}">
                            ${utilization}%
                        </span>
                        <span class="text-[9px] text-neutral-500 font-mono mt-0.5">
                            ${utilization >= 70 ? 'Tinggi' : (utilization >= 40 ? 'Sedang' : 'Rendah')}
                        </span>
                    </div>
                </td>
            </tr>
        `;
    },

    updateKPIs(avgUtil, onlineText, billingText) {
        const kpiAvg = document.getElementById('uptime-kpi-avg-util');
        const kpiOnline = document.getElementById('uptime-kpi-total-online');
        const kpiBilling = document.getElementById('uptime-kpi-total-billing');
        
        if (kpiAvg) {
            kpiAvg.textContent = `${avgUtil}%`;
            kpiAvg.className = 'text-base sm:text-lg xl:text-xl font-extrabold mt-0.5 ' + 
                (avgUtil >= 70 ? 'text-emerald-400' : (avgUtil >= 40 ? 'text-amber-400' : 'text-red-400'));
        }
        if (kpiOnline) kpiOnline.textContent = onlineText || '—';
        if (kpiBilling) kpiBilling.textContent = billingText || '—';
    }
};

window.UptimeTracker = UptimeTracker;
