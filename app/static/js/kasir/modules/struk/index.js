// app/static/js/kasir/modules/struk/index.js

const Struk = {
    currentData: null,
    currentPage: 1,
    currentDate: null,

    async init() {
        await this.loadDateOptions();
        await this.loadHistory();

        const savedStruk = localStorage.getItem('lastStrukData');
        if (savedStruk) {
            try {
                this.currentData = JSON.parse(savedStruk);
                this.renderPreview(this.currentData);
                document.getElementById('btn-print-struk').classList.remove('hidden');
            } catch (err) {
                localStorage.removeItem('lastStrukData');
            }
        }
    },

    async loadDateOptions() {
        const selectEl = document.getElementById('struk-date-picker');
        if (!selectEl) return;

        try {
            const res = await window.API.report.tanggalList();
            const dates = res.tanggal || [];

            if (dates.length === 0) {
                selectEl.innerHTML = '<option value="">Belum ada data</option>';
                return;
            }

            selectEl.innerHTML = dates.map(date => {
                const [y, m, d] = date.split('-');
                return `<option value="${date}">${d}/${m}/${y}</option>`;
            }).join('');

        } catch (err) {
            selectEl.innerHTML = '<option value="">Gagal memuat</option>';
        }
    },

    async loadHistory(selectedDate = null, page = 1) {
        try {
            const container = document.getElementById('struk-history-list');
            if (!container) return;

            const dateSelect = document.getElementById('struk-date-picker');
            let targetDate = selectedDate || (dateSelect ? dateSelect.value : '');

            if (!targetDate) {
                const tzoffset = (new Date()).getTimezoneOffset() * 60000;
                targetDate = (new Date(Date.now() - tzoffset)).toISOString().split('T')[0];
            }

            this.currentDate = targetDate;
            this.currentPage = page;

            container.innerHTML = '<div class="flex justify-center py-12"><div class="w-6 h-6 border-2 border-[#1c1c1c] border-t-neutral-100 rounded-full animate-spin"></div></div>';

            const res = await window.API.report.byTanggal(targetDate, '', page, 5);
            let listData = res.history_struk || [];

            if (!listData || listData.length === 0) {
                container.innerHTML = `
                    <div class="py-12 px-6 text-center bg-[#0c0c0c] border border-dashed border-[#1c1c1c] rounded">
                        <p class="text-sm text-neutral-500">Tidak ada transaksi</p>
                    </div>`;
                return;
            }

            let html = listData.map(item => {
                const noNota = item.no_nota || String(item.id);
                const totalBayar = item.jumlah || item.total_bayar || 0;
                const nama = item.nama_pelanggan || 'Guest';
                const waktu = item.waktu || '';

                return `
                    <div onclick="Struk.cetak('${noNota}')" class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-3.5 cursor-pointer hover:border-neutral-400 transition-colors mb-2 hover-card-trigger">
                        <div class="flex items-center justify-between">
                            <div class="min-w-0 flex-1">
                                <div class="text-sm font-bold text-neutral-200 lg:truncate break-words whitespace-normal">${nama}</div>
                                <div class="text-[10px] lg:text-base text-neutral-500 font-mono mt-0.5">${waktu}</div>
                            </div>
                            <div class="text-right ml-3 font-mono">
                                <div class="text-sm font-black text-neutral-100">${window.Utils ? window.Utils.formatRupiah(totalBayar) : totalBayar}</div>
                                <div class="text-[9px] lg:text-base text-neutral-600 mt-0.5">${noNota}</div>
                            </div>
                        </div>
                    </div>`;
            }).join('');

            container.innerHTML = html;

            const pagContainer = document.getElementById('struk-pagination');
            if (pagContainer) {
                if (res.pages > 1) {
                    pagContainer.innerHTML = `
                        <div class="flex items-center justify-between py-2 px-3 bg-[#0c0c0c] border border-[#1c1c1c] rounded mt-3">
                            <button onclick="Struk.changePage(${res.page - 1})" class="px-2.5 py-1 bg-[#171717] border border-[#262626] hover:bg-neutral-100 hover:text-black text-neutral-300 text-xs lg:text-base font-bold rounded transition-colors ${!res.has_prev ? 'opacity-30 cursor-not-allowed' : ''}" ${!res.has_prev ? 'disabled' : ''}>&larr;</button>
                            <span class="text-xs lg:text-base font-bold text-neutral-400 font-mono">${res.page} / ${res.pages}</span>
                            <button onclick="Struk.changePage(${res.page + 1})" class="px-2.5 py-1 bg-[#171717] border border-[#262626] hover:bg-neutral-100 hover:text-black text-neutral-300 text-xs lg:text-base font-bold rounded transition-colors ${!res.has_next ? 'opacity-30 cursor-not-allowed' : ''}" ${!res.has_next ? 'disabled' : ''}>&rarr;</button>
                        </div>`;
                } else {
                    pagContainer.innerHTML = '';
                }
            }

        } catch (err) {
            const container = document.getElementById('struk-history-list');
            if (container) container.innerHTML = '<p class="text-sm text-red-400 text-center py-4">Gagal memuat riwayat</p>';
        }
    },

    async cetak(sesiId) {
        if (!sesiId) { Toast.error("ID sesi tidak valid"); return; }
        try {
            document.getElementById('struk-preview').innerHTML = '<div class="flex justify-center py-10"><div class="w-6 h-6 border-2 border-[#1c1c1c] border-t-neutral-100 rounded-full animate-spin"></div></div>';
            const data = await API.request(`/api/report/struk/${sesiId}`);
            this.currentData = data;
            localStorage.setItem('lastStrukData', JSON.stringify(data));
            this.renderPreview(data);
            document.getElementById('btn-print-struk').classList.remove('hidden');
        } catch (err) {
            Toast.error("Gagal mengambil data struk");
            document.getElementById('struk-preview').innerHTML = '<p class="text-red-400 text-center py-10">Gagal memuat data</p>';
        }
    },

    async cariByNomor() {
        const noStruk = document.getElementById('struk-no').value.trim();
        if (!noStruk) { Toast.error("Masukkan nomor struk"); return; }
        try {
            const data = await API.request('/api/report/struk/by-no', {
                method: 'POST',
                body: JSON.stringify({ no_struk: noStruk })
            });
            this.currentData = data;
            localStorage.setItem('lastStrukData', JSON.stringify(data));
            this.renderPreview(data);
            document.getElementById('btn-print-struk').classList.remove('hidden');
        } catch (err) {
            Toast.error(err.message || "Struk tidak ditemukan");
            document.getElementById('struk-preview').innerHTML = '<p class="text-red-400 text-center py-10">Struk tidak ditemukan</p>';
            document.getElementById('btn-print-struk').classList.add('hidden');
        }
    },

    async deleteReceipt(id, nota) {
        Modal.confirm(`<div class="text-center"><p class="text-xs lg:text-base text-neutral-400">Hapus struk <span class="text-red-400 font-bold font-mono">${nota}</span>?</p><p class="text-[10px] lg:text-base text-neutral-500 mt-1">Data akan dihapus permanen.</p></div>`, async () => {
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

        Modal.confirm(`<div class="text-center"><p class="text-xs lg:text-base text-neutral-400">Hapus semua transaksi tanggal <span class="text-red-400 font-bold font-mono">${targetDate}</span>?</p></div>`, async () => {
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
        Modal.confirm('<div class="text-center"><p class="text-xs lg:text-base text-neutral-400 font-bold uppercase tracking-wider">Hapus semua riwayat transaksi?</p><p class="text-[10px] lg:text-base text-neutral-500 mt-1">Tindakan ini tidak dapat dibatalkan.</p></div>', async () => {
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
