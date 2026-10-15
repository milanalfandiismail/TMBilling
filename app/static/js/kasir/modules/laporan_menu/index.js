const LaporanMenu = {
    currentDate: null,
    currentKasirId: '',
    currentPage: 1,
    itemsPerPage: 10,
    allData: null,
    currentMetodePembayaran: '',
    _hasResizeListener: false,

    getAdaptivePerPage() {
        const width = window.innerWidth;
        if (width >= 1536) return 8;
        if (width >= 1280) return 7;
        if (width >= 1024) return 6;
        if (width >= 768) return 5;
        return 4;
    },

    _initResizeListener() {
        if (this._hasResizeListener) return;
        this._hasResizeListener = true;
        const handleResize = () => {
            if (typeof App !== 'undefined' && App.currentTab !== 'laporan_menu') return;
            const newPerPage = this.getAdaptivePerPage();
            if (newPerPage !== this.itemsPerPage) {
                this.itemsPerPage = newPerPage;
                this.currentPage = 1;
                this.fetchData();
            }
        };
        window.addEventListener('resize', (typeof Utils !== 'undefined' && Utils.debounce) ? Utils.debounce(handleResize, 200) : handleResize);
    },

    resetFilters() {
        this.currentDate = '';
        this.currentPage = 1;
        this.currentKasirId = '';
        this.currentMetodePembayaran = '';
        this.allData = null;
        const tglSelect = document.getElementById('laporan-menu-tanggal-select');
        if (tglSelect) tglSelect.innerHTML = '<option value="">Semua Tanggal</option>';
        const kasirSelect = document.getElementById('laporan-menu-kasir-select');
        if (kasirSelect) kasirSelect.innerHTML = '<option value="">Semua Kasir</option>';
        const metodeSelect = document.getElementById('laporan-menu-metode-pembayaran-select');
        if (metodeSelect) metodeSelect.innerHTML = '<option value="">Semua Metode</option>';
    },

    async load() {
        await this.loadKasirList();
        await this.loadTanggalList();
        await this.loadMetodePembayaranList();
    },

    async loadMetodePembayaranList() {
        const select = document.getElementById('laporan-menu-metode-pembayaran-select');
        if (!select) return;

        let paymentMethods = ["Tunai", "QRIS", "Transfer Bank"];
        try {
            const settingsData = await API.settings.getAll();
            if (settingsData && settingsData.success && settingsData.settings.payment_methods) {
                paymentMethods = settingsData.settings.payment_methods.split(',').map(s => s.trim());
            }
        } catch (e) {
            console.error("Gagal memuat metode pembayaran:", e);
        }

        select.innerHTML = '<option value="">Semua Metode</option>';
        paymentMethods.forEach(m => {
            select.innerHTML += `<option value="${m}">${m}</option>`;
        });
    },

    async loadKasirList() {
        const select = document.getElementById('laporan-menu-kasir-select');
        if (!select) return;

        try {
            const data = await API.report.kasirList();
            const kasirList = data.kasir || [];

            if (window.App && App.user && App.user.role === 'kasir') {
                select.classList.add('hidden');
                select.innerHTML = `<option value="${App.user.id}">${App.user.nama_lengkap || App.user.username}</option>`;
                select.value = App.user.id;
                return;
            }

            select.classList.remove('hidden');
            select.innerHTML = '<option value="">Semua Kasir</option>';
            kasirList.forEach(k => {
                select.innerHTML += `<option value="${k.id}">${k.nama}</option>`;
            });
        } catch (err) {
            console.error('Gagal memuat kasir untuk laporan menu:', err);
        }
    },

    async loadTanggalList() {
        const select = document.getElementById('laporan-menu-tanggal-select');
        const area = document.getElementById('laporan-menu-area');
        if (!select || !area) return;

        try {
            const data = await API.report.tanggalList();
            const tanggalList = data.tanggal || [];

            if (tanggalList.length === 0) {
                select.innerHTML = '<option value="">Semua Tanggal</option>';
                area.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-16 text-neutral-500 bg-[#0c0c0c] border border-dashed border-[#1c1c1c] rounded">
                        <svg class="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z"></path></svg>
                        <p class="text-xs lg:text-sm xl:text-base 2xl:text-lg font-bold uppercase tracking-wider text-neutral-300">Belum Ada Laporan</p>
                        <p class="text-[10px] xl:text-xs 2xl:text-sm text-neutral-500 mt-1">Belum ada transaksi</p>
                    </div>`;
                return;
            }

            select.innerHTML = '<option value="">Semua Tanggal</option>';
            tanggalList.forEach(tgl => {
                select.innerHTML += `<option value="${tgl}">${tgl}</option>`;
            });

            const firstDate = tanggalList[0];
            select.value = firstDate;
            await this.loadByDate(firstDate);
        } catch (err) {
            area.innerHTML = '<div class="text-center py-10 text-red-400 text-xs lg:text-sm 2xl:text-base">Gagal memuat daftar tanggal laporan menu</div>';
        }
    },

    async loadByDate(tanggal = '', kasirId = '', metodePembayaran = '') {
        this.currentDate = tanggal || '';
        this.currentKasirId = kasirId;
        this.currentMetodePembayaran = metodePembayaran;
        this.currentPage = 1;
        
        await this.fetchData();
    },

    _lastFingerprint: null,

    refreshLive() {
        if (typeof App !== 'undefined' && !['laporan_menu', 'laporan-menu'].includes(App.currentTab)) return;
        return this.fetchData(true);
    },

    async fetchData(isSilent = false) {
        this._initResizeListener();
        this.itemsPerPage = this.getAdaptivePerPage();
        const area = document.getElementById('laporan-menu-area');
        if (!area) return;

        if (!isSilent && (!this.allData) && typeof Skeleton !== 'undefined') {
            area.innerHTML = Skeleton.laporanMenu(this.itemsPerPage);
        }

        try {
            const data = await API.report.kantinByTanggal(this.currentDate, this.currentKasirId, this.currentPage, this.itemsPerPage, this.currentMetodePembayaran);
            
            const newFingerprint = JSON.stringify({
                date: this.currentDate,
                kasir: this.currentKasirId,
                page: this.currentPage,
                metode: this.currentMetodePembayaran,
                total: data.total_pendapatan_menu,
                items: (data.history_menu || []).map(m => m.id || m.no_nota)
            });

            if (isSilent && this._lastFingerprint === newFingerprint) {
                return; // Data tidak berubah
            }
            this._lastFingerprint = newFingerprint;
            this.allData = data;

            this.render();
        } catch (err) {
            if (!isSilent) {
                area.innerHTML = '<div class="text-center py-6 text-red-400 text-xs lg:text-sm 2xl:text-base">Gagal memuat data laporan menu</div>';
            }
        }
    },

    _buildBreakdownHtml(breakdownData) {
        if (!breakdownData || Object.keys(breakdownData).length === 0) return '';
        const entries = Object.entries(breakdownData);
        const tunaiEntry = entries.find(([m]) => m === 'Tunai');
        const nonTunaiEntries = entries.filter(([m]) => m !== 'Tunai').sort((a, b) => b[1].total - a[1].total);

        const sortedEntries = [];
        if (tunaiEntry) sortedEntries.push(tunaiEntry);
        sortedEntries.push(...nonTunaiEntries);

        if (sortedEntries.length === 0) return '';
        return `
            <div class="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2 py-1.5 px-2.5 sm:px-3 bg-[#080808] border border-[#1a1a1a] rounded-lg">
                <span class="text-[11px] sm:text-xs xl:text-xs 2xl:text-sm text-neutral-400 font-bold uppercase tracking-wider mr-1">Metode:</span>
                ${sortedEntries.map(([method, d]) => {
                    const mLower = (method || '').toLowerCase();
                    let colorClass = 'text-sky-400';
                    if (mLower === 'tunai') colorClass = 'text-amber-400';
                    else if (mLower === 'qris') colorClass = 'text-emerald-400';

                    return `
                        <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#111] border border-[#262626] text-xs xl:text-xs 2xl:text-sm font-mono">
                            <span class="${colorClass} font-sans font-bold">${Utils.escapeHtml(method)}</span>
                            <span class="text-neutral-100 font-bold">${Utils.formatRupiah(d.total || 0)}</span>
                            <span class="text-neutral-500 text-[10px] sm:text-[11px] xl:text-xs">(${d.count})</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    render() {
        const area = document.getElementById('laporan-menu-area');
        if (!area) return;

        const data = this.allData;
        if (!data || data.error) {
            area.innerHTML = '<div class="text-center py-6 text-neutral-500 text-xs lg:text-sm 2xl:text-base">Tidak ada data</div>';
            return;
        }

        let html = '';

        // Ringkasan card khusus Kantin
        html += `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2 lg:mb-2 xl:mb-3">
                <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-2 lg:p-1.5 xl:p-2.5 2xl:p-3 flex flex-col justify-between min-h-[2.8rem] lg:min-h-[3rem] 2xl:min-h-[3.5rem]">
                    <span class="text-[9px] xl:text-[10px] 2xl:text-xs text-neutral-500 uppercase font-bold tracking-wider leading-tight">Total Pendapatan Kantin & F&B</span>
                    <span class="text-base sm:text-lg xl:text-xl 2xl:text-2xl font-bold text-green-400 font-mono mt-0.5 truncate" title="${Utils.formatRupiah(data.total_pendapatan_menu || 0)}">${Utils.formatRupiah(data.total_pendapatan_menu || 0)}</span>
                </div>
                <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-2 lg:p-1.5 xl:p-2.5 2xl:p-3 flex flex-col justify-between min-h-[2.8rem] lg:min-h-[3rem] 2xl:min-h-[3.5rem]">
                    <span class="text-[9px] xl:text-[10px] 2xl:text-xs text-neutral-500 uppercase font-bold tracking-wider leading-tight">Total Transaksi Nota</span>
                    <span class="text-base sm:text-lg xl:text-xl 2xl:text-2xl font-bold text-neutral-100 font-mono mt-0.5 truncate">${data.total || 0}</span>
                </div>
            </div>`;

        // Table transaksi Kantin / POS F&B
        const menuList = data.history_menu || [];
        const totalPages = data.pages || 1;

        // Rincian per Metode Pembayaran (Semua data hari ini/filter)
        if (data.breakdown_metode && Object.keys(data.breakdown_metode).length > 0) {
            html += this._buildBreakdownHtml(data.breakdown_metode);
        } else if (menuList.length > 0) {
            const fallback = {};
            menuList.forEach(t => {
                const m = t.metode_pembayaran || 'Tunai';
                if (!fallback[m]) fallback[m] = { count: 0, total: 0 };
                fallback[m].count++;
                fallback[m].total += t.total_harga || 0;
            });
            html += this._buildBreakdownHtml(fallback);
        }

        const getPemesananLabel = (pcKode) => {
            if (!pcKode || pcKode === 'Bungkus' || pcKode === 'Take Away') return 'Take Away';
            if (pcKode === 'Tempat' || pcKode === 'Dine In') return 'Makan di Tempat';
            return `PC: ${pcKode}`;
        };

        html += `<h4 class="text-[11px] sm:text-xs xl:text-sm 2xl:text-base font-bold text-neutral-400 uppercase tracking-wider mb-1">Detail Penjualan Kantin / F&B</h4>`;

        if (menuList.length > 0) {
            html += `
                <!-- Mobile / Tablet Card View (<1024px) -->
                <div class="lg:hidden space-y-2 mb-2">
                    ${menuList.map(tm => `
                        <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-2 space-y-1.5">
                            <div class="flex items-center justify-between">
                                <div class="flex flex-col">
                                    <span class="font-mono font-bold text-neutral-200 text-xs">${tm.no_nota || '-'}</span>
                                    <span class="text-[10px] text-neutral-500 font-mono">${tm.waktu || '-'}</span>
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <span class="px-2 py-0.5 rounded text-[9px] font-bold ${tm.metode_pembayaran === 'Tunai' ? 'bg-neutral-800 text-neutral-300' : 'bg-emerald-950 text-emerald-400 border border-emerald-900'}">${tm.metode_pembayaran || 'Tunai'}</span>
                                    <span class="text-[9px] text-neutral-400 px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800">${getPemesananLabel(tm.pc_kode)}</span>
                                </div>
                            </div>
                            <div class="flex items-center justify-between pt-1 border-t border-[#1a1a1a]">
                                <div class="flex flex-col">
                                    <span class="font-semibold text-neutral-200 text-xs leading-tight break-words">${tm.menu_nama || '-'}</span>
                                    <span class="text-[10px] text-neutral-400">Jumlah: <strong class="font-mono text-neutral-200">${tm.jumlah || 0}</strong></span>
                                </div>
                                <div class="text-right">
                                    <div class="font-mono font-bold text-neutral-100 text-xs">${Utils.formatRupiah(tm.total_harga || 0)}</div>
                                    <div class="text-[10px] text-neutral-500 font-mono">
                                        Kembali: <span class="text-emerald-400 font-bold">${tm.kembalian ? Utils.formatRupiah(tm.kembalian) : '-'}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="flex items-center justify-between pt-1 border-t border-[#1a1a1a]">
                                <span class="text-[10px] text-neutral-400 font-medium">Kasir: <span class="text-neutral-300">${tm.kasir_nama || '-'}</span></span>
                                <button onclick="LaporanMenu.printStruk(${tm.id})" class="px-2 py-0.5 bg-neutral-900 border border-[#2a2a2a] hover:bg-neutral-800 text-neutral-300 text-[10px] font-bold rounded transition-colors inline-flex items-center gap-1">
                                    <span>Cetak</span>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <!-- Desktop Table View (≥1024px) -->
                <div class="hidden lg:block overflow-x-auto w-full border border-[#1c1c1c] rounded mb-2 lg:mb-2 xl:mb-3">
                    <table class="w-full text-xs xl:text-sm 2xl:text-base">
                        <thead class="bg-[#0c0c0c]">
                            <!-- Compact Laptop View Header (5 columns for lg & xl: 1024px - 1535px) -->
                            <tr class="hidden lg:table-row 2xl:hidden text-[10px] xl:text-xs text-neutral-500 uppercase tracking-wider border-b border-[#1c1c1c]">
                                <th class="px-2.5 xl:px-3 py-1 lg:py-1 xl:py-2 text-left font-bold">Nota & Waktu</th>
                                <th class="px-2.5 xl:px-3 py-1 lg:py-1 xl:py-2 text-left font-bold">Item Menu & Qty</th>
                                <th class="px-2.5 xl:px-3 py-1 lg:py-1 xl:py-2 text-right font-bold">Total & Pembayaran</th>
                                <th class="px-2.5 xl:px-3 py-1 lg:py-1 xl:py-2 text-left font-bold">Metode & Pemesanan</th>
                                <th class="px-2.5 xl:px-3 py-1 lg:py-1 xl:py-2 text-right font-bold">Kasir & Aksi</th>
                            </tr>
                            <!-- Wide Desktop View Header (11 columns for 2xl: ≥1536px) -->
                            <tr class="hidden 2xl:table-row text-[10px] xl:text-xs 2xl:text-sm text-neutral-500 uppercase tracking-wider border-b border-[#1c1c1c]">
                                <th class="px-3 xl:px-4 2xl:px-5 py-1 lg:py-1 xl:py-1.5 text-left font-bold">Waktu</th>
                                <th class="px-3 xl:px-4 2xl:px-5 py-1 lg:py-1 xl:py-1.5 text-left font-bold">Nota</th>
                                <th class="px-3 xl:px-4 2xl:px-5 py-1 lg:py-1 xl:py-1.5 text-left font-bold">Item Menu</th>
                                <th class="px-3 xl:px-4 2xl:px-5 py-1 lg:py-1 xl:py-1.5 text-center font-bold">Jumlah</th>
                                <th class="px-3 xl:px-4 2xl:px-5 py-1 lg:py-1 xl:py-1.5 text-right font-bold">Total Harga</th>
                                <th class="px-3 xl:px-4 2xl:px-5 py-1 lg:py-1 xl:py-1.5 text-right font-bold">Tunai</th>
                                <th class="px-3 xl:px-4 2xl:px-5 py-1 lg:py-1 xl:py-1.5 text-right font-bold">Kembalian</th>
                                <th class="px-3 xl:px-4 2xl:px-5 py-1 lg:py-1 xl:py-1.5 text-left font-bold">Metode</th>
                                <th class="px-3 xl:px-4 2xl:px-5 py-1 lg:py-1 xl:py-1.5 text-left font-bold">Pemesanan</th>
                                <th class="px-3 xl:px-4 2xl:px-5 py-1 lg:py-1 xl:py-1.5 text-left font-bold">Kasir</th>
                                <th class="px-3 xl:px-4 2xl:px-5 py-1 lg:py-1 xl:py-1.5 text-center font-bold">Aksi</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-[#1c1c1c] bg-[#050505]">
                            ${menuList.map(tm => `
                                <tr class="hover:bg-[#0c0c0c] transition-colors">
                                    <!-- Compact Cells (5 items for lg & xl) -->
                                    <td class="px-2.5 xl:px-3 py-1 hidden lg:table-cell 2xl:hidden">
                                        <div class="flex flex-col text-left">
                                             <span class="font-mono font-bold text-neutral-200 text-xs xl:text-sm whitespace-nowrap">${tm.no_nota || '-'}</span>
                                             <span class="text-[9px] xl:text-[10px] text-neutral-500 font-mono mt-0.5 whitespace-nowrap">${tm.waktu || '-'}</span>
                                        </div>
                                    </td>
                                    <td class="px-2.5 xl:px-3 py-1 hidden lg:table-cell 2xl:hidden">
                                        <div class="flex flex-col text-left">
                                             <span class="font-semibold text-neutral-200 text-xs xl:text-sm leading-tight break-words">${tm.menu_nama || '-'}</span>
                                             <span class="text-[9px] xl:text-[10px] text-neutral-400 mt-0.5">Jumlah: <strong class="font-mono text-neutral-300">${tm.jumlah || 0}</strong></span>
                                        </div>
                                    </td>
                                    <td class="px-2.5 xl:px-3 py-1 hidden lg:table-cell 2xl:hidden text-right">
                                        <div class="flex flex-col text-right">
                                             <span class="font-mono font-bold text-neutral-200 text-xs xl:text-sm whitespace-nowrap">${Utils.formatRupiah(tm.total_harga || 0)}</span>
                                             <span class="text-[9px] xl:text-[10px] text-neutral-500 font-mono mt-0.5 whitespace-nowrap">
                                                 Bayar: ${tm.tunai ? Utils.formatRupiah(tm.tunai) : '-'} <span class="text-neutral-600">|</span> Kembali: <span class="text-emerald-400 font-bold">${tm.kembalian ? Utils.formatRupiah(tm.kembalian) : '-'}</span>
                                             </span>
                                        </div>
                                    </td>
                                    <td class="px-2.5 xl:px-3 py-1 hidden lg:table-cell 2xl:hidden">
                                        <div class="flex flex-col items-start gap-0.5">
                                             <span class="px-1.5 py-0.5 rounded text-[9px] xl:text-[10px] font-bold ${tm.metode_pembayaran === 'Tunai' ? 'bg-neutral-800 text-neutral-300' : 'bg-emerald-950 text-emerald-400 border border-emerald-900'}">${tm.metode_pembayaran || 'Tunai'}</span>
                                             <span class="text-[9px] xl:text-[10px] text-neutral-400 whitespace-nowrap">${getPemesananLabel(tm.pc_kode)}</span>
                                        </div>
                                    </td>
                                    <td class="px-2.5 xl:px-3 py-1 hidden lg:table-cell 2xl:hidden text-right">
                                        <div class="flex flex-col items-end gap-1">
                                             <span class="text-neutral-300 font-medium text-xs xl:text-sm whitespace-nowrap">${tm.kasir_nama || '-'}</span>
                                             <button onclick="LaporanMenu.printStruk(${tm.id})" class="px-2 py-0.5 bg-neutral-900 border border-[#2a2a2a] hover:bg-neutral-800 text-neutral-300 text-[10px] xl:text-xs font-bold rounded transition-colors inline-flex items-center gap-1">
                                                 <span>Cetak</span>
                                             </button>
                                        </div>
                                    </td>

                                    <!-- Separated Wide Desktop Cells (11 columns for 2xl: ≥1536px) -->
                                    <td class="hidden 2xl:table-cell px-3 xl:px-4 2xl:px-5 py-1 xl:py-1.5 text-neutral-400 font-mono text-xs xl:text-sm 2xl:text-base whitespace-nowrap">
                                        ${tm.waktu || '-'}
                                    </td>
                                    <td class="hidden 2xl:table-cell px-3 xl:px-4 2xl:px-5 py-1 xl:py-1.5 font-mono font-bold text-neutral-200 text-xs xl:text-sm 2xl:text-base whitespace-nowrap">
                                        ${tm.no_nota || '-'}
                                    </td>
                                    <td class="hidden 2xl:table-cell px-3 xl:px-4 2xl:px-5 py-1 xl:py-1.5 font-semibold text-neutral-200 text-xs xl:text-sm 2xl:text-base leading-tight break-words">
                                        ${tm.menu_nama || '-'}
                                    </td>
                                    <td class="hidden 2xl:table-cell px-3 xl:px-4 2xl:px-5 py-1 xl:py-1.5 text-center font-mono font-bold text-neutral-300 text-xs xl:text-sm 2xl:text-base whitespace-nowrap">
                                        ${tm.jumlah || 0}
                                    </td>
                                    <td class="hidden 2xl:table-cell px-3 xl:px-4 2xl:px-5 py-1 xl:py-1.5 text-right font-mono font-bold text-neutral-200 text-xs xl:text-sm 2xl:text-base whitespace-nowrap">
                                        ${Utils.formatRupiah(tm.total_harga || 0)}
                                    </td>
                                    <td class="hidden 2xl:table-cell px-3 xl:px-4 2xl:px-5 py-1 xl:py-1.5 text-right font-mono text-neutral-300 text-xs xl:text-sm 2xl:text-base whitespace-nowrap">
                                        ${tm.tunai ? Utils.formatRupiah(tm.tunai) : '-'}
                                    </td>
                                    <td class="hidden 2xl:table-cell px-3 xl:px-4 2xl:px-5 py-1 xl:py-1.5 text-right font-mono font-bold text-emerald-400 text-xs xl:text-sm 2xl:text-base whitespace-nowrap">
                                        ${tm.kembalian ? Utils.formatRupiah(tm.kembalian) : '-'}
                                    </td>
                                    <td class="hidden 2xl:table-cell px-3 xl:px-4 2xl:px-5 py-1 xl:py-1.5 whitespace-nowrap">
                                        <span class="px-2.5 py-0.5 rounded text-[9px] xl:text-[10px] 2xl:text-xs font-bold ${tm.metode_pembayaran === 'Tunai' ? 'bg-neutral-800 text-neutral-300' : 'bg-emerald-950 text-emerald-400 border border-emerald-900'}">${tm.metode_pembayaran || 'Tunai'}</span>
                                    </td>
                                    <td class="hidden 2xl:table-cell px-3 xl:px-4 2xl:px-5 py-1 xl:py-1.5 text-neutral-400 text-xs xl:text-sm 2xl:text-base whitespace-nowrap">
                                        ${getPemesananLabel(tm.pc_kode)}
                                    </td>
                                    <td class="hidden 2xl:table-cell px-3 xl:px-4 2xl:px-5 py-1 xl:py-1.5 text-neutral-300 font-medium text-xs xl:text-sm 2xl:text-base whitespace-nowrap">
                                        ${tm.kasir_nama || '-'}
                                    </td>
                                    <td class="hidden 2xl:table-cell px-3 xl:px-4 2xl:px-5 py-1 xl:py-1.5 text-center whitespace-nowrap">
                                        <button onclick="LaporanMenu.printStruk(${tm.id})" class="px-2 py-0.5 2xl:px-3 2xl:py-1 bg-neutral-900 border border-[#2a2a2a] hover:bg-neutral-800 text-neutral-300 text-[10px] xl:text-xs 2xl:text-sm font-bold rounded transition-colors inline-flex items-center gap-1">
                                            <span>Cetak</span>
                                        </button>
                                    </td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>`;

            const totalItems = data.total || menuList.length;
            const startIdx = totalItems > 0 ? (this.currentPage - 1) * this.itemsPerPage + 1 : 0;
            const endIdx = Math.min(this.currentPage * this.itemsPerPage, totalItems);

            html += `
                <div class="flex flex-col sm:flex-row items-center justify-between gap-2 mt-2 pt-2 border-t border-[#1c1c1c] text-xs">
                    <div class="text-[11px] sm:text-xs text-neutral-400 font-mono">
                        ${totalItems > 0 ? `Menampilkan <span class="text-neutral-200 font-bold">${startIdx}</span> - <span class="text-neutral-200 font-bold">${endIdx}</span> dari <span class="text-neutral-200 font-bold">${totalItems}</span> transaksi` : 'Menampilkan 0 transaksi'}
                    </div>
                    <div class="flex items-center gap-1.5">
                        <button onclick="LaporanMenu.setPage(${this.currentPage - 1})" 
                            class="px-2.5 py-1 bg-[#121212] hover:bg-[#1a1a1a] border border-[#222] text-neutral-300 text-xs font-bold rounded transition-colors ${this.currentPage <= 1 ? 'opacity-30 cursor-not-allowed' : ''}" 
                            ${this.currentPage <= 1 ? 'disabled' : ''}>&larr; Prev</button>
                        <span class="px-2.5 py-1 text-xs text-neutral-300 font-mono bg-[#080808] border border-[#1c1c1c] rounded">
                            Hal. <strong class="text-neutral-100">${this.currentPage}</strong> / ${totalPages}
                        </span>
                        <button onclick="LaporanMenu.setPage(${this.currentPage + 1})" 
                            class="px-2.5 py-1 bg-[#121212] hover:bg-[#1a1a1a] border border-[#222] text-neutral-300 text-xs font-bold rounded transition-colors ${this.currentPage >= totalPages ? 'opacity-30 cursor-not-allowed' : ''}" 
                            ${this.currentPage >= totalPages ? 'disabled' : ''}>Next &rarr;</button>
                    </div>
                </div>`;
        } else {
            html += '<div class="text-center py-6 text-neutral-500 text-xs lg:text-sm 2xl:text-base">Tidak ada transaksi F&B pada tanggal ini</div>';
        }

        area.innerHTML = html;
    },

    setPage(page) {
        this.currentPage = page;
        this.fetchData();
    },

    filter() {
        const tanggal = document.getElementById('laporan-menu-tanggal-select').value;
        const kasirId = document.getElementById('laporan-menu-kasir-select').value;
        const metodePembayaran = document.getElementById('laporan-menu-metode-pembayaran-select')?.value || '';
        this.loadByDate(tanggal, kasirId, metodePembayaran);
    },

    async printStruk(tmId) {
        try {
            const res = await API.report.strukMenu(tmId);
            if (res) {
                StrukPreview.currentData = res;
                StrukPreview.printPreview();
            } else {
                Toast.error("Data struk tidak ditemukan");
            }
        } catch (err) {
            Toast.error("Gagal memuat struk: error koneksi");
        }
    },

    exportPDF() {
        const tanggal = document.getElementById('laporan-menu-tanggal-select').value || '';
        const kasirId = document.getElementById('laporan-menu-kasir-select').value;
        const metodePembayaran = document.getElementById('laporan-menu-metode-pembayaran-select')?.value || '';
        window.location.href = `/api/v1/kasir/report/export/kantin?tanggal=${tanggal}&kasir_id=${kasirId}&metode_pembayaran=${metodePembayaran}`;
    }
};

window.LaporanMenu = LaporanMenu;
