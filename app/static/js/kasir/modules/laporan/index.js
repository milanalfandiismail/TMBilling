const Laporan = {
    currentDate: null,
    currentPage: 1,
    currentKasirId: '',

    async load() {
        await this.loadKasirList();
        await this.loadTanggalList();
    },

    async loadKasirList() {
        const select = document.getElementById('laporan-kasir-select');
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
            console.error('Gagal memuat kasir', err);
        }
    },

    async loadTanggalList() {
        const select = document.getElementById('laporan-tanggal-select');
        const area = document.getElementById('laporan-area');
        if (!select || !area) return;

        try {
            const data = await API.report.tanggalList();
            const tanggalList = data.tanggal || [];

            if (tanggalList.length === 0) {
                select.innerHTML = '<option value="">-- Pilih Tanggal --</option>';
                area.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-16 text-neutral-500 bg-[#0c0c0c] border border-dashed border-[#1c1c1c] rounded">
                        <svg class="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z"></path></svg>
                        <p class="text-xs lg:text-base font-bold uppercase tracking-wider text-neutral-300">Belum Ada Laporan</p>
                        <p class="text-[10px] lg:text-base text-neutral-500 mt-1">Belum ada transaksi hari ini</p>
                    </div>`;
                return;
            }

            select.innerHTML = '<option value="">-- Pilih Tanggal --</option>';
            tanggalList.forEach(tgl => {
                select.innerHTML += `<option value="${tgl}">${tgl}</option>`;
            });

            const firstDate = tanggalList[0];
            select.value = firstDate;
            await this.loadByDate(firstDate);
        } catch (err) {
            const area = document.getElementById('laporan-area');
            if (area) area.innerHTML = '<div class="text-center py-10 text-red-400 text-xs lg:text-base">Gagal memuat laporan</div>';
        }
    },

    async loadByDate(tanggal, kasirId = '', page = 1) {
        if (!tanggal) return;
        this.currentDate = tanggal;
        this.currentKasirId = kasirId;
        this.currentPage = page;
        
        const area = document.getElementById('laporan-area');
        if (!area) return;

        area.innerHTML = '<div class="flex justify-center py-10"><div class="w-6 h-6 border-2 border-[#1c1c1c] border-t-neutral-100 rounded-full animate-spin"></div></div>';

        try {
            const data = await API.report.byTanggal(tanggal, kasirId, page, 12);
            this.render(data);
        } catch (err) {
            area.innerHTML = '<div class="text-center py-10 text-red-400 text-xs lg:text-base">Gagal memuat laporan</div>';
        }
    },

    render(data) {
        const area = document.getElementById('laporan-area');
        if (!area) return;

        if (!data || data.error) {
            area.innerHTML = '<div class="text-center py-10 text-neutral-500 text-xs lg:text-base">Tidak ada data</div>';
            return;
        }

        let html = '';

        // Ringkasan cards untuk Billing saja
        html += `
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-3 flex flex-col justify-between h-20">
                    <span class="text-[9px] lg:text-base text-neutral-500 uppercase font-bold tracking-wider">Total Pendapatan Billing</span>
                    <span class="text-base font-bold text-neutral-100 font-mono mt-1">${Utils.formatRupiah(data.total_pendapatan_billing || 0)}</span>
                </div>
                <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-3 flex flex-col justify-between h-20">
                    <span class="text-[9px] lg:text-base text-neutral-500 uppercase font-bold tracking-wider">Total Sesi</span>
                    <span class="text-lg font-bold text-neutral-100 font-mono mt-1">${data.total_sesi || 0}</span>
                </div>
                <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-3 flex flex-col justify-between h-20">
                    <span class="text-[9px] lg:text-base text-neutral-500 uppercase font-bold tracking-wider">Sesi Member</span>
                    <span class="text-lg font-bold text-neutral-100 font-mono mt-1">${data.total_member || 0}</span>
                </div>
                <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-3 flex flex-col justify-between h-20">
                    <span class="text-[9px] lg:text-base text-neutral-500 uppercase font-bold tracking-wider">Sesi Guest</span>
                    <span class="text-lg font-bold text-neutral-100 font-mono mt-1">${data.total_guest || 0}</span>
                </div>
            </div>`;

        // Table transaksi Billing
        html += `<h4 class="text-xs lg:text-base font-bold text-neutral-400 uppercase tracking-wider mb-3">Detail Pendapatan Billing</h4>`;
        const transaksiList = data.history_struk || [];
        if (transaksiList.length > 0) {
            html += `
                <div class="overflow-x-hidden w-full mb-6">
                    <table class="w-full text-xs lg:text-base block lg:table">
                        <thead class="hidden lg:table-header-group">
                            <tr class="text-[10px] lg:text-base text-neutral-500 uppercase tracking-wider border-b border-[#1c1c1c]">
                                <th class="px-4 py-3 text-left">Waktu</th>
                                <th class="px-4 py-3 text-left">Nota</th>
                                <th class="px-4 py-3 text-left">Pelanggan</th>
                                <th class="px-4 py-3 text-right">Jumlah</th>
                                <th class="px-4 py-3 text-left">PC</th>
                                <th class="px-4 py-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-[#2a2a2a] lg:divide-[#1c1c1c] block lg:table-row-group">
                            ${transaksiList.map(t => `
                                <tr class="hover:bg-[#121212] transition-colors block lg:table-row py-3 lg:py-0 border-b border-[#2a2a2a] last:border-b-0 lg:border-b-0">
                                    <td class="px-4 py-3 text-neutral-400 font-mono flex lg:table-cell justify-between items-center">
                                        <span class="text-[10px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Waktu</span>
                                        <span>${t.waktu || '-'}</span>
                                    </td>
                                    <td class="px-4 py-3 flex lg:table-cell justify-between items-center border-t border-[#2a2a2a]/50 lg:border-t-0">
                                        <span class="text-[10px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Nota</span>
                                        <span class="font-mono text-neutral-300">${t.no_nota || '-'}</span>
                                    </td>
                                    <td class="px-4 py-3 text-neutral-400 flex lg:table-cell justify-between items-center">
                                        <span class="text-[10px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Pelanggan</span>
                                        <span>${t.nama_pelanggan || '-'}</span>
                                    </td>
                                    <td class="px-4 py-3 text-right font-mono font-bold text-neutral-200 flex lg:table-cell justify-between items-center">
                                        <span class="text-[10px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Jumlah</span>
                                        <span>${Utils.formatRupiah(t.jumlah || 0)}</span>
                                    </td>
                                    <td class="px-4 py-3 text-neutral-500 font-mono flex lg:table-cell justify-between items-center">
                                        <span class="text-[10px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider lg:hidden">PC</span>
                                        <span>${t.pc_kode || '-'}</span>
                                    </td>
                                    <td class="px-4 py-3 text-center flex lg:table-cell justify-between items-center">
                                        <span class="text-[10px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Aksi</span>
                                        <button onclick="Laporan.printStruk(${t.id})" class="px-2.5 py-1 bg-neutral-900 border border-[#2a2a2a] hover:bg-neutral-800 text-neutral-300 text-[10px] lg:text-base font-bold rounded transition-colors">Cetak</button>
                                    </td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>`;

            if (data.pages && data.pages > 1) {
                html += `
                    <div class="flex items-center justify-center gap-2 mt-2 mb-6">
                        <button onclick="Laporan.loadByDate('${this.currentDate}', '${this.currentKasirId}', ${this.currentPage - 1})" class="px-3 py-1.5 bg-[#0c0c0c] border border-[#1c1c1c] hover:bg-[#121212] text-neutral-400 text-xs lg:text-base font-bold rounded transition-colors ${this.currentPage <= 1 ? 'opacity-30 cursor-not-allowed' : ''}" ${this.currentPage <= 1 ? 'disabled' : ''}>&larr;</button>
                        <span class="px-4 py-1.5 text-xs lg:text-base text-neutral-200 font-mono">${this.currentPage} / ${data.pages}</span>
                        <button onclick="Laporan.loadByDate('${this.currentDate}', '${this.currentKasirId}', ${this.currentPage + 1})" class="px-3 py-1.5 bg-[#0c0c0c] border border-[#1c1c1c] hover:bg-[#121212] text-neutral-400 text-xs lg:text-base font-bold rounded transition-colors ${this.currentPage >= data.pages ? 'opacity-30 cursor-not-allowed' : ''}" ${this.currentPage >= data.pages ? 'disabled' : ''}>&rarr;</button>
                    </div>`;
            }
        } else {
            html += '<div class="text-center py-10 text-neutral-500 text-xs lg:text-base mb-6">Tidak ada transaksi billing di tanggal ini</div>';
        }

        area.innerHTML = html;
    },

    filter() {
        const tanggal = document.getElementById('laporan-tanggal-select').value;
        const kasirId = document.getElementById('laporan-kasir-select').value;
        this.loadByDate(tanggal, kasirId);
    },

    async printStruk(tId) {
        try {
            const res = await API.request(`/api/report/struk/${tId}`);
            if (res) {
                StrukPreview.currentData = res;
                StrukPreview.printPreview();
            } else {
                Toast.error("Data struk tidak ditemukan");
            }
        } catch (err) {
            Toast.error("Gagal memuat struk: error koneksi");
        }
    }
};
