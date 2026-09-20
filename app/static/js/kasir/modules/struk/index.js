// app/static/js/kasir/modules/struk/index.js

const Struk = {
    currentData: null,
    currentPage: 1,
    currentDate: null,
    currentSubTab: 'billing',
    selectedId: null,
    searchQuery: '',
    searchDebounceTimer: null,

    resetState() {
        this.currentData = null;
        this.currentPage = 1;
        this.currentDate = null;
        this.selectedId = null;
        this.searchQuery = '';
        if (this.searchDebounceTimer) {
            clearTimeout(this.searchDebounceTimer);
            this.searchDebounceTimer = null;
        }
        try {
            localStorage.removeItem('lastStrukData');
        } catch (e) {}
        const printBtn = document.getElementById('btn-print-struk');
        if (printBtn) printBtn.classList.add('hidden');
        const previewContent = document.getElementById('struk-preview');
        if (previewContent) {
            previewContent.innerHTML = `
                <div class="text-center py-10 text-neutral-500 space-y-2">
                    <div class="text-3xl opacity-30">🧾</div>
                    <p class="text-xs lg:max-xl:text-xs xl:text-base font-medium">Pilih transaksi di samping untuk melihat preview struk</p>
                </div>`;
        }
        const searchInput = document.getElementById('struk-search');
        if (searchInput) searchInput.value = '';
        const searchClearBtn = document.getElementById('struk-search-clear');
        if (searchClearBtn) searchClearBtn.classList.add('hidden');
        const historyContainer = document.getElementById('struk-history-list');
        if (historyContainer) historyContainer.innerHTML = '';
        const dateSelect = document.getElementById('struk-date-picker');
        if (dateSelect) dateSelect.innerHTML = '<option value="">Semua Tanggal</option>';
    },

    async init() {
        await this.loadDateOptions();
        await this.loadHistory();

        const savedStruk = localStorage.getItem('lastStrukData');
        if (savedStruk) {
            try {
                this.currentData = JSON.parse(savedStruk);
                this.selectedId = this.currentData.no_nota || this.currentData.id;
                this.renderPreview(this.currentData);
                document.getElementById('btn-print-struk').classList.remove('hidden');
                this.updateActiveHistoryCard(this.selectedId);
            } catch (err) {
                localStorage.removeItem('lastStrukData');
            }
        }
    },

    switchSubTab(type) {
        this.currentSubTab = type;
        this.selectedId = null;
        // Update active state
        ['billing', 'kantin'].forEach(t => {
            const el = document.getElementById(`struk-sub-${t}`);
            if (el) {
                if (t === type) {
                    el.className = 'px-3 lg:max-xl:px-3.5 xl:px-4 py-1.5 text-xs lg:max-xl:text-xs xl:text-sm font-bold rounded-md transition-all bg-neutral-100 text-black';
                } else {
                    el.className = 'px-3 lg:max-xl:px-3.5 xl:px-4 py-1.5 text-xs lg:max-xl:text-xs xl:text-sm font-bold rounded-md transition-all bg-transparent text-neutral-400 hover:text-neutral-200';
                }
            }
        });
        this.currentPage = 1;
        this.loadHistory();
    },

    async loadDateOptions() {
        const selectEl = document.getElementById('struk-date-picker');
        if (!selectEl) return;

        try {
            const res = await window.API.report.tanggalList();
            const dates = res.tanggal || [];

            if (dates.length === 0) {
                selectEl.innerHTML = '<option value="">Semua Tanggal</option>';
                return;
            }

            const options = ['<option value="">Semua Tanggal</option>'].concat(dates.map(date => {
                const [y, m, d] = date.split('-');
                return `<option value="${date}">${d}/${m}/${y}</option>`;
            })).join('');

            selectEl.innerHTML = options;

        } catch (err) {
            selectEl.innerHTML = '<option value="">Gagal memuat</option>';
        }
    },

    handleSearch(val) {
        this.searchQuery = (val || '').trim();
        const clearBtn = document.getElementById('struk-search-clear');
        if (clearBtn) {
            clearBtn.classList.toggle('hidden', !this.searchQuery);
        }

        if (this.searchDebounceTimer) {
            clearTimeout(this.searchDebounceTimer);
        }
        this.searchDebounceTimer = setTimeout(() => {
            this.loadHistory(this.currentDate, 1);
        }, 250);
    },

    clearSearch() {
        const searchInput = document.getElementById('struk-search');
        if (searchInput) searchInput.value = '';
        const clearBtn = document.getElementById('struk-search-clear');
        if (clearBtn) clearBtn.classList.add('hidden');
        this.searchQuery = '';
        this.loadHistory(this.currentDate, 1);
    },

    handleDateChange(val) {
        this.currentDate = val || '';
        this.loadHistory(this.currentDate, 1);
    },

    updateActiveHistoryCard(activeId) {
        if (!activeId) return;
        const cards = document.querySelectorAll('.struk-history-card');
        cards.forEach(card => {
            const cardId = card.getAttribute('data-history-id');
            if (String(cardId) === String(activeId)) {
                card.classList.add('border-neutral-400', 'bg-[#141414]', 'ring-1', 'ring-neutral-400/40');
                card.classList.remove('bg-[#050505]', 'border-[#1c1c1c]');
            } else {
                card.classList.remove('border-neutral-400', 'bg-[#141414]', 'ring-1', 'ring-neutral-400/40');
                card.classList.add('bg-[#050505]', 'border-[#1c1c1c]');
            }
        });
    },

    async loadHistory(selectedDate = null, page = 1) {
        try {
            const container = document.getElementById('struk-history-list');
            if (!container) return;

            const dateSelect = document.getElementById('struk-date-picker');
            let targetDate = selectedDate !== null ? selectedDate : (dateSelect ? dateSelect.value : '');

            this.currentDate = targetDate || '';
            this.currentPage = page;

            container.innerHTML = '<div class="flex justify-center py-10"><div class="w-6 h-6 border-2 border-[#1c1c1c] border-t-neutral-100 rounded-full animate-spin"></div></div>';

            const apiFn = this.currentSubTab === 'kantin' ? window.API.report.kantinByTanggal : window.API.report.byTanggal;
            const res = await apiFn(this.currentDate, '', page, 8, '', this.searchQuery || '');
            let listData = [];
            if (this.currentSubTab === 'billing') {
                listData = res.history_struk || [];
            } else {
                listData = res.history_menu || [];
            }

            if (!listData || listData.length === 0) {
                container.innerHTML = `
                    <div class="py-10 px-4 text-center bg-[#050505] border border-dashed border-[#1c1c1c] rounded">
                        <p class="text-xs lg:max-xl:text-xs xl:text-base text-neutral-500 font-medium">Tidak ada transaksi</p>
                    </div>`;
                return;
            }

            let html = listData.map(item => {
                const noNota = item.no_nota || String(item.id);
                const totalBayar = item.total_harga || item.total_bayar || item.jumlah || 0;
                const nama = Struk.currentSubTab === 'kantin' ? 'Pelanggan POS' : (item.nama_pelanggan || 'Guest');
                const waktu = item.waktu || '';
                const clickId = Struk.currentSubTab === 'kantin' ? item.id : noNota;
                const isSelected = Struk.selectedId && (String(Struk.selectedId) === String(clickId) || String(Struk.selectedId) === String(noNota));
                const activeBorder = isSelected 
                    ? 'border-neutral-400 bg-[#141414] ring-1 ring-neutral-400/40' 
                    : 'bg-[#050505] border-[#1c1c1c] hover:border-neutral-500 hover:bg-[#0f0f0f]';

                return `
                    <div onclick="Struk.cetak('${clickId}')" data-history-id="${clickId}" class="struk-history-card border rounded p-2.5 sm:p-3 lg:max-xl:p-3 xl:p-3.5 cursor-pointer transition-all mb-2 ${activeBorder}">
                        <div class="flex items-center justify-between gap-2">
                            <div class="min-w-0 flex-1">
                                <div class="text-xs lg:max-xl:text-xs xl:text-sm font-bold text-neutral-200 truncate">${nama}</div>
                                <div class="text-[9px] lg:max-xl:text-[10px] xl:text-xs text-neutral-500 font-mono mt-0.5">${waktu}</div>
                            </div>
                            <div class="text-right shrink-0 font-mono">
                                <div class="text-xs lg:max-xl:text-xs xl:text-sm font-black text-neutral-100">${window.Utils ? window.Utils.formatRupiah(totalBayar) : totalBayar}</div>
                                <div class="text-[9px] lg:max-xl:text-[10px] xl:text-xs text-neutral-500 mt-0.5">${noNota}</div>
                            </div>
                        </div>
                    </div>`;
            }).join('');

            container.innerHTML = html;

            const pagContainer = document.getElementById('struk-pagination');
            if (pagContainer) {
                if (res.pages > 1) {
                    pagContainer.innerHTML = `
                        <div class="flex items-center justify-between py-2 px-3 bg-[#050505] border border-[#1c1c1c] rounded">
                            <button onclick="Struk.changePage(${res.page - 1})" class="px-2.5 lg:max-xl:px-3 xl:px-3.5 py-1 lg:max-xl:py-1 xl:py-1.5 bg-[#171717] border border-[#262626] hover:bg-neutral-100 hover:text-black text-neutral-300 text-xs lg:max-xl:text-xs xl:text-base font-bold rounded transition-colors ${!res.has_prev ? 'opacity-30 cursor-not-allowed' : ''}" ${!res.has_prev ? 'disabled' : ''}>&larr;</button>
                            <span class="text-xs lg:max-xl:text-xs xl:text-base font-bold text-neutral-400 font-mono">${res.page} / ${res.pages}</span>
                            <button onclick="Struk.changePage(${res.page + 1})" class="px-2.5 lg:max-xl:px-3 xl:px-3.5 py-1 lg:max-xl:py-1 xl:py-1.5 bg-[#171717] border border-[#262626] hover:bg-neutral-100 hover:text-black text-neutral-300 text-xs lg:max-xl:text-xs xl:text-base font-bold rounded transition-colors ${!res.has_next ? 'opacity-30 cursor-not-allowed' : ''}" ${!res.has_next ? 'disabled' : ''}>&rarr;</button>
                        </div>`;
                } else {
                    pagContainer.innerHTML = '';
                }
            }

        } catch (err) {
            const container = document.getElementById('struk-history-list');
            if (container) container.innerHTML = '<p class="text-xs text-red-400 text-center py-4">Gagal memuat riwayat</p>';
        }
    },

    async cetak(sesiId) {
        if (!sesiId) { Toast.error("ID sesi tidak valid"); return; }
        this.selectedId = sesiId;
        this.updateActiveHistoryCard(sesiId);

        try {
            document.getElementById('struk-preview').innerHTML = '<div class="flex justify-center py-10"><div class="w-6 h-6 border-2 border-[#1c1c1c] border-t-neutral-100 rounded-full animate-spin"></div></div>';

            let data;
            if (this.currentSubTab === 'kantin') {
                data = await API.report.strukMenu(sesiId);
            } else {
                data = await API.request(`/api/v1/kasir/report/struk/${sesiId}`);
            }

            this.currentData = data;
            localStorage.setItem('lastStrukData', JSON.stringify(data));
            this.renderPreview(data);
            document.getElementById('btn-print-struk').classList.remove('hidden');
        } catch (err) {
            Toast.error("Gagal mengambil data struk");
            document.getElementById('struk-preview').innerHTML = '<p class="text-xs text-red-400 text-center py-10">Gagal memuat data</p>';
        }
    },

    async deleteReceipt(id, nota) {
        Modal.confirm(`<div class="text-center"><p class="text-xs lg:max-xl:text-xs xl:text-base text-neutral-400">Hapus struk <span class="text-red-400 font-bold font-mono">${nota}</span>?</p><p class="text-[10px] lg:max-xl:text-[10px] xl:text-xs text-neutral-500 mt-1">Data akan dihapus permanen.</p></div>`, async () => {
            try {
                await API.report.deleteTransaction(id);
                Toast.success("Struk berhasil dihapus");
                this.loadHistory();
            } catch (err) {
                Toast.error(err.message || "Gagal menghapus struk");
            }
        });
    },

    async deleteByDate() {
        const dateSelect = document.getElementById('struk-date-picker');
        const targetDate = dateSelect ? dateSelect.value : '';
        if (!targetDate) { Toast.error("Pilih tanggal"); return; }

        Modal.confirm(`<div class="text-center"><p class="text-xs lg:max-xl:text-xs xl:text-base text-neutral-400">Hapus semua transaksi tanggal <span class="text-red-400 font-bold font-mono">${targetDate}</span>?</p></div>`, async () => {
            try {
                await API.report.deleteByDate(targetDate);
                Toast.success(`Transaksi ${targetDate} dihapus`);
                this.loadDateOptions();
                this.loadHistory();
            } catch (err) {
                Toast.error(err.message || "Gagal menghapus");
            }
        });
    },

    async clearAllHistory() {
        Modal.confirm('<div class="text-center"><p class="text-xs lg:max-xl:text-xs xl:text-base text-neutral-400 font-bold uppercase tracking-wider">Hapus semua riwayat transaksi?</p><p class="text-[10px] lg:max-xl:text-[10px] xl:text-xs text-neutral-500 mt-1">Tindakan ini tidak dapat dibatalkan.</p></div>', async () => {
            try {
                await API.report.clearTransactions();
                Toast.success("Riwayat berhasil dikosongkan");
                await this.loadDateOptions();
                await this.loadHistory();
            } catch (err) {
                Toast.error(err.message || "Gagal");
            }
        });
    },

    async changePage(p) {
        if (p < 1) return;
        await this.loadHistory(this.currentDate, p);
    }
};

Object.assign(Struk, StrukPreview);
window.Struk = Struk;

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.Struk) window.Struk.init();
    }, 300);
});
