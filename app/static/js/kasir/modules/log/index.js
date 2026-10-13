const LogFormatter = {
    normalize(detailJson) {
        if (!detailJson) return null;
        if (typeof detailJson === 'string') {
            try {
                return JSON.parse(detailJson);
            } catch (e) {
                return detailJson;
            }
        }
        return detailJson;
    },

    formatCurrency(val) {
        if (typeof val === 'number') {
            return 'Rp ' + val.toLocaleString('id-ID');
        }
        return val;
    },

    formatKey(key) {
        if (!key) return '';
        let result = key.replace(/_/g, ' ');
        result = result.replace(/([A-Z])/g, ' $1');
        result = result.trim();
        return result.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    },

    formatValue(key, val) {
        if (val === null || val === undefined) return '-';
        const keyLower = key.toLowerCase();
        if (keyLower.includes('jumlah') || keyLower.includes('harga') || keyLower.includes('amount') || keyLower.includes('modal') || keyLower.includes('total') || keyLower.includes('saldo')) {
            return this.formatCurrency(val);
        }
        if (keyLower.includes('durasi') || keyLower.includes('menit')) {
            if (typeof val === 'number') {
                return val + ' Menit';
            }
        }
        return val;
    },

    formatRefund(data) {
        const title = "Detail Refund";
        let itemsHtml = '';
        const order = [
            { key: 'no_nota_refund', label: 'No. Nota Refund' },
            { key: 'no_nota_original', label: 'No. Nota Asal' },
            { key: 'jumlah_refund', label: 'Jumlah Refund' },
            { key: 'saldo_sebelum', label: 'Saldo/Durasi Sebelum' },
            { key: 'saldo_sesudah', label: 'Saldo/Durasi Sesudah' },
            { key: 'durasi_beli_sebelum', label: 'Durasi Sebelum' },
            { key: 'durasi_beli_sesudah', label: 'Durasi Sesudah' },
            { key: 'durasi_dikurangi', label: 'Durasi Dikurangi' },
            { key: 'username', label: 'Username Member' },
            { key: 'nama_guest', label: 'Nama Guest' }
        ];

        order.forEach(item => {
            if (data[item.key] !== undefined && data[item.key] !== null) {
                const val = this.formatValue(item.key, data[item.key]);
                itemsHtml += `
                    <div class="flex justify-between items-center py-1 border-b border-[#1c1c1c]/50 text-xs">
                        <span class="text-neutral-500 font-semibold uppercase tracking-wider">${item.label}</span>
                        <span class="text-neutral-200 font-mono font-bold">${val}</span>
                    </div>`;
            }
        });

        Object.keys(data).forEach(k => {
            if (!order.some(item => item.key === k)) {
                const label = this.formatKey(k);
                const val = this.formatValue(k, data[k]);
                itemsHtml += `
                    <div class="flex justify-between items-center py-1 border-b border-[#1c1c1c]/50 text-xs">
                        <span class="text-neutral-500 font-semibold uppercase tracking-wider">${label}</span>
                        <span class="text-neutral-200 font-mono font-bold">${val}</span>
                    </div>`;
            }
        });

        return `
            <div class="p-3 bg-[#0c0c0c] border border-red-500/30 rounded-lg space-y-2">
                <div class="text-xs font-bold uppercase text-red-400 tracking-wider flex items-center gap-1.5">
                    <span>🔄</span> ${title}
                </div>
                <div class="space-y-1">${itemsHtml}</div>
            </div>`;
    },

    formatDeleteStruk(data) {
        const title = "Detail Penghapusan Struk";
        let itemsHtml = '';
        const order = [
            { key: 'no_nota', label: 'No. Nota' },
            { key: 'jenis', label: 'Jenis Transaksi' },
            { key: 'jumlah', label: 'Jumlah / Nominal' },
            { key: 'tanggal', label: 'Tanggal Transaksi' },
            { key: 'keterangan', label: 'Keterangan' }
        ];

        order.forEach(item => {
            if (data[item.key] !== undefined && data[item.key] !== null) {
                const val = this.formatValue(item.key, data[item.key]);
                itemsHtml += `
                    <div class="flex justify-between items-center py-1 border-b border-[#1c1c1c]/50 text-xs">
                        <span class="text-neutral-500 font-semibold uppercase tracking-wider">${item.label}</span>
                        <span class="text-neutral-200 font-mono font-bold">${val}</span>
                    </div>`;
            }
        });

        Object.keys(data).forEach(k => {
            if (!order.some(item => item.key === k)) {
                const label = this.formatKey(k);
                const val = this.formatValue(k, data[k]);
                itemsHtml += `
                    <div class="flex justify-between items-center py-1 border-b border-[#1c1c1c]/50 text-xs">
                        <span class="text-neutral-500 font-semibold uppercase tracking-wider">${label}</span>
                        <span class="text-neutral-200 font-mono">${val}</span>
                    </div>`;
            }
        });

        return `
            <div class="p-3 bg-[#0c0c0c] border border-amber-500/30 rounded-lg space-y-2">
                <div class="text-xs font-bold uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                    <span>🗑️</span> ${title}
                </div>
                <div class="space-y-1">${itemsHtml}</div>
            </div>`;
    },

    formatEditPaket(data) {
        const title = "Perubahan Detail Paket";
        let itemsHtml = '';

        Object.keys(data).forEach(k => {
            const label = this.formatKey(k);
            const valObj = data[k];
            if (valObj && typeof valObj === 'object' && 'old' in valObj && 'new' in valObj) {
                const oldVal = this.formatValue(k, valObj.old);
                const newVal = this.formatValue(k, valObj.new);
                itemsHtml += `
                    <div class="flex justify-between items-center py-1 border-b border-[#1c1c1c]/50 text-xs gap-4">
                        <span class="text-neutral-500 font-semibold uppercase tracking-wider">${label}</span>
                        <span class="text-neutral-200 font-mono font-bold">
                            <span class="text-neutral-500 line-through">${oldVal}</span> 
                            <span class="text-neutral-400 mx-1">➔</span> 
                            <span class="text-emerald-400">${newVal}</span>
                        </span>
                    </div>`;
            } else {
                const val = this.formatValue(k, valObj);
                itemsHtml += `
                    <div class="flex justify-between items-center py-1 border-b border-[#1c1c1c]/50 text-xs">
                        <span class="text-neutral-500 font-semibold uppercase tracking-wider">${label}</span>
                        <span class="text-neutral-200 font-mono">${val}</span>
                    </div>`;
            }
        });

        return `
            <div class="p-3 bg-[#0c0c0c] border border-blue-500/30 rounded-lg space-y-2">
                <div class="text-xs font-bold uppercase text-blue-400 tracking-wider flex items-center gap-1.5">
                    <span>📝</span> ${title}
                </div>
                <div class="space-y-1">${itemsHtml}</div>
            </div>`;
    },

    formatGenericObject(obj, depth = 0) {
        if (!obj || Object.keys(obj).length === 0) return '';
        let itemsHtml = '';

        Object.keys(obj).forEach(k => {
            const label = this.formatKey(k);
            const val = obj[k];

            if (val && typeof val === 'object' && !Array.isArray(val)) {
                itemsHtml += `
                    <div class="py-1 border-b border-[#1c1c1c]/30 text-xs">
                        <div class="text-neutral-500 font-semibold uppercase tracking-wider mb-1">${label}</div>
                        <div class="border-l-2 border-[#1c1c1c] pl-3 py-1 mt-1 space-y-1">
                            ${this.formatGenericObject(val, depth + 1)}
                        </div>
                    </div>`;
            } else if (Array.isArray(val)) {
                itemsHtml += `
                    <div class="py-1 border-b border-[#1c1c1c]/30 text-xs">
                        <div class="text-neutral-500 font-semibold uppercase tracking-wider mb-1">${label}</div>
                        <div class="pl-3 py-1">
                            ${this.formatGenericArray(val, depth + 1)}
                        </div>
                    </div>`;
            } else {
                const formattedVal = this.formatValue(k, val);
                itemsHtml += `
                    <div class="flex justify-between items-center py-1 border-b border-[#1c1c1c]/30 text-xs">
                        <span class="text-neutral-500 font-semibold uppercase tracking-wider">${label}</span>
                        <span class="text-neutral-200 font-mono">${formattedVal}</span>
                    </div>`;
            }
        });

        return itemsHtml;
    },

    formatGenericArray(arr, depth = 0) {
        if (!arr || arr.length === 0) return '';
        let itemsHtml = '';
        arr.forEach((item, idx) => {
            if (item && typeof item === 'object') {
                itemsHtml += `
                    <div class="p-2 bg-[#0c0c0c] border border-[#1c1c1c] rounded text-xs space-y-1 my-1">
                        <div class="text-neutral-500 font-mono">Item #${idx + 1}</div>
                        ${this.formatGenericObject(item, depth + 1)}
                    </div>`;
            } else {
                itemsHtml += `<span class="inline-block px-2 py-0.5 bg-[#171717] border border-[#262626] rounded text-neutral-300 font-mono text-[10px] mr-1 mb-1">${item}</span>`;
            }
        });
        return `<div class="flex flex-wrap">${itemsHtml}</div>`;
    },

    resolveTheme(action) {
        const act = (action || '').toUpperCase();

        if (act.includes('REFUND'))
            return { icon: '🔄', title: 'Detail Refund', border: 'border-red-500/30', text: 'text-red-400' };
        if (act.includes('BLACKOUT'))
            return { icon: '⚡', title: 'Insiden Blackout (Mati Lampu)', border: 'border-amber-500/30', text: 'text-amber-400' };
        if (act.startsWith('BUKA_') || act.includes('TUTUP_SESI') || act === 'PINDAH_PC' || act === 'TAMBAH_WAKTU')
            return { icon: '🎮', title: 'Detail Sesi & Billing', border: 'border-emerald-500/30', text: 'text-emerald-400' };
        if (act === 'TRANSAKSI_MENU' || act.includes('MENU'))
            return { icon: '🍔', title: 'Detail Kantin & POS', border: 'border-amber-500/30', text: 'text-amber-400' };
        if (act.includes('MEMBER'))
            return { icon: '👤', title: 'Detail Member', border: 'border-purple-500/30', text: 'text-purple-400' };
        if (act.startsWith('SHIFT_'))
            return { icon: '💵', title: 'Detail Shift Kasir', border: 'border-cyan-500/30', text: 'text-cyan-400' };
        if (act.includes('PAKET'))
            return { icon: '💳', title: 'Detail Paket Billing', border: 'border-blue-500/30', text: 'text-blue-400' };
        if (act.includes('PC') || act.includes('GRUP') || act.includes('BATCH_') || act.includes('WOL_'))
            return { icon: '🖥️', title: 'Detail Unit PC / Zona', border: 'border-indigo-500/30', text: 'text-indigo-400' };
        if (act.includes('USER') || act.includes('LOGIN') || act.includes('LOGOUT') || act.includes('IP_WHITELIST'))
            return { icon: '🔑', title: 'Detail Akun & Keamanan', border: 'border-neutral-500/30', text: 'text-neutral-300' };
        if (act.includes('TIKET') || act.includes('MAINTENANCE'))
            return { icon: '🛠️', title: 'Detail Perawatan PC', border: 'border-orange-500/30', text: 'text-orange-400' };
        if (act.includes('CLEAR_') || act.includes('DELETE_STRUK') || act.includes('CLEANUP'))
            return { icon: '🧹', title: 'Pembersihan Log & Riwayat', border: 'border-rose-500/30', text: 'text-rose-400' };
        if (act.includes('SETTINGS') || act.includes('BACKUP') || act.includes('MIGRATION') || act.includes('SCHEDULER') || act.includes('DB_') || act.includes('UPDATE'))
            return { icon: '⚙️', title: 'Sistem & Konfigurasi', border: 'border-sky-500/30', text: 'text-sky-400' };

        return { icon: '📄', title: 'Detail Data', border: 'border-[#1c1c1c]', text: 'text-neutral-400' };
    },

    format(detailJson, action) {
        const data = this.normalize(detailJson);
        if (!data) return '';

        const actUpper = (action || '').toUpperCase();

        if (actUpper.includes('REFUND')) {
            return this.formatRefund(data);
        } else if (actUpper.includes('DELETE_STRUK')) {
            return this.formatDeleteStruk(data);
        } else if (actUpper.includes('EDIT_PAKET')) {
            return this.formatEditPaket(data);
        } else if (typeof data === 'object') {
            const theme = this.resolveTheme(action);
            const headerHtml = `
                <div class="text-xs font-bold uppercase ${theme.text} tracking-wider flex items-center gap-1.5 mb-2">
                    <span>${theme.icon}</span> ${theme.title}
                </div>`;

            if (Array.isArray(data)) {
                return `
                    <div class="p-3 bg-[#0c0c0c] border ${theme.border} rounded-lg space-y-1">
                        ${headerHtml}
                        ${this.formatGenericArray(data)}
                    </div>`;
            } else {
                return `
                    <div class="p-3 bg-[#0c0c0c] border ${theme.border} rounded-lg space-y-1">
                        ${headerHtml}
                        ${this.formatGenericObject(data)}
                    </div>`;
            }
        }
        return `<div class="p-2.5 bg-[#0c0c0c] border border-[#1c1c1c] rounded-lg text-xs text-neutral-300 font-mono">${Utils.escapeHtml(String(data))}</div>`;
    }
};

const Log = {
    currentCategory: 'Semua',
    rawLogs: [],
    filteredLogs: [],
    currentPage: 1,
    perPage: 8,
    _lastFingerprint: null,
    _hasResizeListener: false,

    getAdaptivePerPage() {
        const isMobile = window.innerWidth < 768;
        // Overhead komponen non-tabel (navbar ~56px, padding page ~16-48px, toolbar ~75-130px, card table header/pagination ~90px)
        const overhead = isMobile ? 260 : (window.innerWidth >= 1536 ? 240 : 220);
        const rowHeight = isMobile ? 48 : (window.innerWidth >= 1536 ? 38 : 34);
        const availableHeight = Math.max(120, window.innerHeight - overhead);
        const calculated = Math.floor(availableHeight / rowHeight);
        
        // Klem aman agar proporsional tanpa dead space dan tanpa scrollbar
        const minRows = isMobile ? 5 : 6;
        const maxRows = isMobile ? 6 : (window.innerWidth >= 1536 ? 14 : 10);
        return Math.max(minRows, Math.min(calculated, maxRows));
    },

    _wasMobile: null,

    _initResizeListener() {
        if (this._hasResizeListener) return;
        this._hasResizeListener = true;
        this._wasMobile = window.innerWidth < 768;
        const handleResize = () => {
            if (typeof App !== 'undefined' && App.currentTab !== 'log') return;
            const newPerPage = this.getAdaptivePerPage();
            const isMobileNow = window.innerWidth < 768;
            if (newPerPage !== this.perPage || isMobileNow !== this._wasMobile) {
                this._wasMobile = isMobileNow;
                this.perPage = newPerPage;
                this.currentPage = 1;
                this.render();
            }
        };
        window.addEventListener('resize', (typeof Utils !== 'undefined' && Utils.debounce) ? Utils.debounce(handleResize, 200) : handleResize);
    },

    // Pemetaan 5 kategori esensial ke canonical categories di backend
    CATEGORY_MAP: {
        'Semua': [],
        'auth': ['AUTHENTICATION', 'USER_ACCOUNT', 'AUTHORIZATION_SECURITY'],
        'billing': ['PAYMENT_BILLING', 'TRANSACTION', 'SESI_BILLING', 'DATA_CATALOG', 'transaksi', 'sesi'],
        'system': ['CONFIGURATION', 'API_INTEGRATION', 'BACKGROUND_JOB', 'MAINTENANCE', 'MONITOR_REMOTE', 'TOURNAMENT_GAME', 'SYSTEM', 'sistem'],
        'error': ['ERROR_FAILURE', 'blackout']
    },

    updatePillStyles() {
        const pills = ['Semua', 'auth', 'billing', 'system', 'error'];
        pills.forEach(p => {
            const el = document.getElementById(`log-cat-${p}`);
            if (el) {
                if (p === this.currentCategory) {
                    el.className = 'px-2.5 sm:px-3 py-1 sm:py-1.5 rounded text-xs 2xl:text-sm font-bold transition-all whitespace-nowrap bg-neutral-100 text-black shadow-sm shrink-0';
                } else {
                    el.className = 'px-2.5 sm:px-3 py-1 sm:py-1.5 rounded text-xs 2xl:text-sm font-bold transition-all whitespace-nowrap bg-[#0c0c0c] hover:bg-[#141414] text-neutral-400 hover:text-neutral-200 border border-[#1c1c1c] shrink-0';
                }
            }
        });
    },

    async load(filter = '', isSilent = false) {
        this._initResizeListener();
        this.perPage = this.getAdaptivePerPage();

        const container = document.getElementById('log-rows');
        if (container && !isSilent && (!this.rawLogs || this.rawLogs.length === 0) && typeof Skeleton !== 'undefined') {
            container.innerHTML = Skeleton.logRows ? Skeleton.logRows(this.perPage) : (Skeleton.tableRows ? Skeleton.tableRows(this.perPage, 8) : '');
        }

        try {
            this.updatePillStyles();
            const data = await API.report.logs(filter, 500, '');
            const logs = data.logs || [];

            const newFingerprint = JSON.stringify({ filter, count: logs.length, top: logs[0]?.timestamp });
            if (isSilent && this._lastFingerprint === newFingerprint) {
                return;
            }
            this._lastFingerprint = newFingerprint;
            this.rawLogs = logs;

            this.applyFilter();
        } catch (err) {
            if (!isSilent) {
                Toast.error('Gagal memuat log sistem');
            }
        }
    },

    refreshLive() {
        if (typeof App !== 'undefined' && App.currentTab !== 'log') return;
        const filterInput = document.getElementById('filter-log');
        const filterStr = filterInput ? filterInput.value.trim() : '';
        return this.load(filterStr, true);
    },

    switchCategory(category) {
        this.currentCategory = category;
        this.updatePillStyles();
        this.applyFilter();
    },

    filter() {
        const filterInput = document.getElementById('filter-log');
        const clearBtn = document.getElementById('btn-clear-log-search');
        if (filterInput && clearBtn) {
            clearBtn.classList.toggle('hidden', !filterInput.value.trim());
        }
        this.applyFilter();
    },

    applyFilter() {
        const filterInput = document.getElementById('filter-log');
        const query = filterInput ? filterInput.value.trim().toLowerCase() : '';

        const targetCats = this.CATEGORY_MAP[this.currentCategory] || [];

        this.filteredLogs = (this.rawLogs || []).filter(log => {
            // 1. Filter kategori
            if (this.currentCategory !== 'Semua' && targetCats.length > 0) {
                const logCat = (log.category || '').toUpperCase();
                const act = (log.action || '').toUpperCase();
                const matchesCat = targetCats.some(c => logCat.includes(c.toUpperCase()) || act.includes(c.toUpperCase()));
                if (!matchesCat) return false;
            }

            // 2. Filter search query
            if (query) {
                const fullText = `${log.timestamp || ''} ${log.user || ''} ${log.action || ''} ${log.detail || ''} ${log.ip_address || ''} ${log.category || ''}`.toLowerCase();
                if (!fullText.includes(query)) return false;
            }

            return true;
        });

        this.currentPage = 1;
        this.render();
    },

    render() {
        const tbody = document.getElementById('log-rows');
        if (!tbody) return;

        const isMobile = window.innerWidth < 768;
        const total = this.filteredLogs.length;
        const totalPages = Math.ceil(total / this.perPage) || 1;
        this.currentPage = Math.max(1, Math.min(this.currentPage, totalPages));

        if (total === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${isMobile ? 3 : 8}" class="text-center py-8 text-neutral-500 text-xs sm:text-sm">
                        Tidak ada catatan log yang cocok dengan filter
                    </td>
                </tr>`;
            this.updatePagination(0, 0, 0, 1);
            return;
        }

        const startIndex = (this.currentPage - 1) * this.perPage;
        const endIndex = Math.min(startIndex + this.perPage, total);
        const pageLogs = this.filteredLogs.slice(startIndex, endIndex);

        tbody.innerHTML = pageLogs.map((log, idx) => {
            const globalIndex = startIndex + idx;
            const cat = (log.category || '').toUpperCase();
            const act = (log.action || '').toUpperCase();

            // Badge Category Color
            let catBadge = 'bg-neutral-900 text-neutral-300 border-neutral-700';
            if (cat === 'AUTHENTICATION' || cat === 'USER_ACCOUNT') catBadge = 'bg-teal-950/70 text-teal-400 border-teal-800/50';
            else if (cat === 'AUTHORIZATION_SECURITY') catBadge = 'bg-indigo-950/70 text-indigo-400 border-indigo-800/50';
            else if (cat === 'PAYMENT_BILLING' || cat === 'TRANSACTION') catBadge = 'bg-emerald-950/70 text-emerald-400 border-emerald-800/50';
            else if (cat === 'SESI_BILLING' || cat === 'DATA_CATALOG') catBadge = 'bg-lime-950/70 text-lime-400 border-lime-800/50';
            else if (cat === 'CONFIGURATION' || cat === 'SYSTEM') catBadge = 'bg-sky-950/70 text-sky-400 border-sky-800/50';
            else if (cat === 'MONITOR_REMOTE' || cat === 'API_INTEGRATION') catBadge = 'bg-cyan-950/70 text-cyan-400 border-cyan-800/50';
            else if (cat === 'BACKGROUND_JOB' || cat === 'MAINTENANCE') catBadge = 'bg-purple-950/70 text-purple-400 border-purple-800/50';
            else if (cat === 'ERROR_FAILURE' || act.includes('ERROR') || act.includes('GAGAL')) catBadge = 'bg-red-950/70 text-red-400 border-red-800/50';

            // Split timestamp into time and date parts for clean multi-line display
            let datePart = '-';
            let timePart = '-';
            if (log.timestamp) {
                const parts = log.timestamp.split(' ');
                datePart = parts[0] || '';
                timePart = parts[1] || '';
            }

            if (isMobile) {
                // ===== MOBILE (< 768px): 3 Kolom Fluid (0px Horizontal Overflow) =====
                const compactTime = (log.timestamp || '').replace(/^20\d\d-/, '');
                return `
                    <tr class="hover:bg-[#141414] transition-colors border-b border-[#1c1c1c] text-xs">
                        <!-- Kolom 1: Waktu & Operator (33%) -->
                        <td class="px-2 py-1.5 align-middle overflow-hidden">
                            <div class="font-mono text-neutral-300 text-[10px] leading-tight">${compactTime}</div>
                            <div class="mt-0.5 truncate max-w-[90px]">
                                <span class="px-1.5 py-0.2 rounded bg-neutral-900 border border-neutral-700 font-mono text-[9px] text-neutral-300 font-semibold inline-block truncate">${Utils.escapeHtml(log.user || 'system')}</span>
                            </div>
                        </td>
                        <!-- Kolom 2: Aksi & Keterangan (52%) -->
                        <td class="px-2 py-1.5 align-middle min-w-0 overflow-hidden">
                            <div class="font-bold text-neutral-200 text-[10px] truncate leading-tight">${Utils.escapeHtml(log.action || '-')}</div>
                            <div class="text-[9px] text-neutral-400 truncate mt-0.5 leading-tight" title="${Utils.escapeHtml(log.detail || '-')}">
                                ${Utils.escapeHtml(log.detail || '-')}
                            </div>
                        </td>
                        <!-- Kolom 3: Tombol Detail (15%) -->
                        <td class="px-1.5 py-1.5 text-center align-middle overflow-hidden">
                            <button onclick="Log.openDetail(${globalIndex})" title="Lihat Detail Log"
                                class="px-2 py-1 rounded bg-[#171717] hover:bg-[#222] border border-[#262626] text-neutral-200 text-[9.5px] font-semibold transition-colors">
                                Detail
                            </button>
                        </td>
                    </tr>
                `;
            }

            // ===== DESKTOP / TABLET (>= 768px): 8 Kolom Lengkap Proporsional Anti-Overlap =====
            return `
                <tr class="hover:bg-[#141414] transition-colors border-b border-[#1c1c1c] text-xs lg:text-[10px] xl:text-xs 2xl:text-sm">
                    <!-- 1. No -->
                    <td class="px-2 py-1.5 font-mono text-neutral-600 text-[10px] lg:text-[9px] xl:text-xs text-center overflow-hidden">
                        #${String(globalIndex + 1).padStart(3, '0')}
                    </td>
                    <!-- 2. Waktu (Multi-line: Jam & Tanggal) -->
                    <td class="px-2 py-1.5 overflow-hidden">
                        <div class="font-mono text-neutral-200 text-[11px] lg:text-[10px] xl:text-xs leading-tight whitespace-nowrap">${timePart}</div>
                        <div class="font-mono text-neutral-500 text-[9.5px] lg:text-[8.5px] xl:text-[10px] leading-tight whitespace-nowrap">${datePart}</div>
                    </td>
                    <!-- 3. Operator -->
                    <td class="px-2 py-1.5 overflow-hidden text-center">
                        <span class="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700 font-mono text-[10px] lg:text-[9px] xl:text-xs text-neutral-200 truncate inline-block max-w-full" title="${Utils.escapeHtml(log.user || 'system')}">
                            ${Utils.escapeHtml(log.user || 'system')}
                        </span>
                    </td>
                    <!-- 4. Kategori -->
                    <td class="px-2 py-1.5 overflow-hidden text-center">
                        <span class="px-2 py-0.5 rounded text-[9px] sm:text-[10px] lg:text-[9px] xl:text-xs font-semibold border truncate inline-block max-w-full ${catBadge}" title="${Utils.escapeHtml(log.category || 'SYSTEM')}">
                            ${Utils.escapeHtml(log.category || 'SYSTEM')}
                        </span>
                    </td>
                    <!-- 5. Aksi (Multi-line break-words) -->
                    <td class="px-2 py-1.5 overflow-hidden">
                        <span class="font-bold text-neutral-200 text-[10px] lg:text-[9.5px] xl:text-xs leading-tight block break-words" title="${Utils.escapeHtml(log.action || '-')}">
                            ${Utils.escapeHtml(log.action || '-')}
                        </span>
                    </td>
                    <!-- 6. Keterangan / Detail (Truncate with max-w-full) -->
                    <td class="px-2.5 py-1.5 overflow-hidden">
                        <div class="text-neutral-300 text-[10px] lg:text-[9.5px] xl:text-xs truncate block max-w-full" title="${Utils.escapeHtml(log.detail || '-')}">
                            ${Utils.escapeHtml(log.detail || '-')}
                        </div>
                    </td>
                    <!-- 7. IP Address -->
                    <td class="px-2 py-1.5 font-mono text-[10px] lg:text-[9px] xl:text-xs text-neutral-400 overflow-hidden truncate">
                        ${log.ip_address || '-'}
                    </td>
                    <!-- 8. Tombol Detail -->
                    <td class="px-1.5 py-1.5 text-center whitespace-nowrap overflow-hidden">
                        <button onclick="Log.openDetail(${globalIndex})" title="Lihat Metadata & Detail JSON"
                            class="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded bg-[#171717] hover:bg-[#222] border border-[#262626] text-neutral-200 hover:text-white text-[9px] sm:text-[10px] lg:text-[9px] xl:text-xs font-semibold transition-colors">
                            Detail
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        this.updatePagination(startIndex + 1, endIndex, total, totalPages);
    },

    updatePagination(start, end, total, totalPages) {
        const infoEl = document.getElementById('log-page-info');
        const currEl = document.getElementById('log-page-current');
        const prevBtn = document.getElementById('btn-log-prev');
        const nextBtn = document.getElementById('btn-log-next');

        if (infoEl) {
            infoEl.textContent = total > 0 ? `Menampilkan ${start} - ${end} dari ${total} log` : 'Menampilkan 0 log';
        }
        if (currEl) {
            currEl.textContent = `${this.currentPage} / ${totalPages}`;
        }
        if (prevBtn) {
            prevBtn.disabled = this.currentPage <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= totalPages;
        }
    },

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.render();
        }
    },

    nextPage() {
        const totalPages = Math.ceil(this.filteredLogs.length / this.perPage) || 1;
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.render();
        }
    },

    openDetail(index) {
        const log = this.filteredLogs[index];
        if (!log) return;

        const modal = document.getElementById('modal-log-detail');
        if (!modal) return;

        // Populate fields
        const elTime = document.getElementById('log-detail-time');
        const elUser = document.getElementById('log-detail-user');
        const elCat = document.getElementById('log-detail-category');
        const elIp = document.getElementById('log-detail-ip');
        const elAct = document.getElementById('log-detail-action');
        const elDesc = document.getElementById('log-detail-desc');
        const elAgent = document.getElementById('log-detail-agent');
        const elAgentBox = document.getElementById('log-detail-agent-box');
        const elJsonBox = document.getElementById('log-detail-json-box');
        const elJsonContent = document.getElementById('log-detail-json-content');
        const elRaw = document.getElementById('log-detail-raw-content');

        if (elTime) elTime.innerText = log.timestamp || '-';
        if (elUser) elUser.innerText = log.user || 'system';
        if (elCat) elCat.innerText = log.category || 'SYSTEM';
        if (elIp) elIp.innerText = log.ip_address || '-';
        if (elAct) elAct.innerText = log.action || '-';
        if (elDesc) elDesc.innerText = log.detail || '-';

        if (elAgent && elAgentBox) {
            if (log.browser_agent && log.browser_agent !== '-') {
                elAgent.innerText = log.browser_agent;
                elAgentBox.classList.remove('hidden');
            } else {
                elAgentBox.classList.add('hidden');
            }
        }

        if (elJsonBox && elJsonContent) {
            if (log.detail_json) {
                try {
                    elJsonContent.innerHTML = LogFormatter.format(log.detail_json, log.action);
                    elJsonBox.classList.remove('hidden');
                } catch (e) {
                    elJsonBox.classList.add('hidden');
                }
            } else {
                elJsonBox.classList.add('hidden');
            }
        }

        if (elRaw) {
            const rawStr = log.raw || (typeof log.detail_json === 'string' ? log.detail_json : JSON.stringify(log, null, 2));
            elRaw.innerText = rawStr;
            elRaw.classList.add('hidden');
        }

        modal.classList.remove('hidden');
    },

    closeDetail() {
        const modal = document.getElementById('modal-log-detail');
        if (modal) modal.classList.add('hidden');
    },

    async clear() {
        const modalHtml = `
            <div class="text-left space-y-3">
                <div class="text-center">
                    <p class="text-xs sm:text-sm text-neutral-200 font-bold uppercase tracking-wider">Bersihkan Semua Audit Log?</p>
                    <p class="text-[11px] sm:text-xs text-neutral-400 mt-1">Tindakan ini akan mengosongkan riwayat log aktif di dashboard.</p>
                </div>
                <div class="p-3 bg-[#0c0c0c] border border-[#1c1c1c] rounded-lg text-xs space-y-2">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" id="chk-auto-archive" checked class="rounded border-neutral-700 bg-neutral-900 text-blue-500 focus:ring-0">
                        <span class="text-neutral-300 font-medium">Buat file arsip otomatis (.jsonl.gz)</span>
                    </label>
                    <p class="text-[10px] text-neutral-500 pl-5">File arsip disimpan di folder <code class="text-neutral-400">logs/archives/</code> untuk audit trail masa depan.</p>
                </div>
            </div>`;

        Modal.confirm(modalHtml, async () => {
            const archive = document.getElementById('chk-auto-archive') ? document.getElementById('chk-auto-archive').checked : true;
            try {
                const res = await API.report.clearLogs(archive);
                Toast.success(res.message || 'Log berhasil dibersihkan');
                this.load();
            } catch (err) {
                Toast.error(err.message || 'Gagal membersihkan log');
            }
        });
    },

    exportLogs() {
        const filterInput = document.getElementById('filter-log');
        const filter = filterInput ? filterInput.value.trim() : '';
        window.open(API.report.exportLogsUrl(filter), '_blank');
    },

    exportPDF() {
        const filterInput = document.getElementById('filter-log');
        const filter = filterInput ? filterInput.value.trim() : '';
        let url = '/api/v1/kasir/report/export/audit-pdf';
        if (filter) url += `?filter=${encodeURIComponent(filter)}`;
        window.open(url, '_blank');
    }
};

window.Log = Log;
