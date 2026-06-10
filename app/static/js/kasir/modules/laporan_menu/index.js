const LaporanMenu = {
    currentDate: null,
    currentKasirId: '',

    async load() {
        await this.loadKasirList();
        await this.loadTanggalList();
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
                select.innerHTML = '<option value="">-- Pilih Tanggal --</option>';
                area.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-16 text-neutral-500 bg-[#0c0c0c] border border-dashed border-[#1c1c1c] rounded">
                        <svg class="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z"></path></svg>
                        <p class="text-xs font-bold uppercase tracking-wider text-neutral-300">Belum Ada Laporan</p>
                        <p class="text-[10px] text-neutral-500 mt-1">Belum ada transaksi hari ini</p>
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
            area.innerHTML = '<div class="text-center py-10 text-red-400 text-xs">Gagal memuat daftar tanggal laporan menu</div>';
        }
    },

    async loadByDate(tanggal, kasirId = '') {
        if (!tanggal) return;
        this.currentDate = tanggal;
        this.currentKasirId = kasirId;
        
        const area = document.getElementById('laporan-menu-area');
        if (!area) return;

        area.innerHTML = '<div class="flex justify-center py-10"><div class="w-6 h-6 border-2 border-[#1c1c1c] border-t-neutral-100 rounded-full animate-spin"></div></div>';

        try {
            const data = await API.report.byTanggal(tanggal, kasirId, 1, 100);
            this.render(data);
        } catch (err) {
            area.innerHTML = '<div class="text-center py-10 text-red-400 text-xs">Gagal memuat data laporan menu</div>';
        }
    },

    render(data) {
        const area = document.getElementById('laporan-menu-area');
        if (!area) return;

        if (!data || data.error) {
            area.innerHTML = '<div class="text-center py-10 text-neutral-500 text-xs">Tidak ada data</div>';
            return;
        }

        let html = '';

        // Ringkasan card khusus Kantin
        html += `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-4 flex flex-col justify-between min-h-24">
                    <span class="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Total Pendapatan Kantin & F&B</span>
                    <span class="text-2xl font-bold text-green-400 font-mono mt-2">${Utils.formatRupiah(data.total_pendapatan_menu || 0)}</span>
                </div>
            </div>`;

        // Table transaksi Kantin / POS F&B
        const menuList = data.history_menu || [];
        if (menuList.length > 0) {
            html += `
                <div class="overflow-x-hidden w-full">
                    <table class="w-full text-xs block lg:table">
                        <thead class="hidden lg:table-header-group">
                            <tr class="text-[10px] text-neutral-500 uppercase tracking-wider border-b border-[#1c1c1c]">
                                <th class="px-4 py-3 text-left">Waktu</th>
                                <th class="px-4 py-3 text-left">Nota</th>
                                <th class="px-4 py-3 text-left">Item Menu</th>
                                <th class="px-4 py-3 text-center">Jumlah</th>
                                <th class="px-4 py-3 text-right">Total Harga</th>
                                <th class="px-4 py-3 text-left">PC / Keterangan</th>
                                <th class="px-4 py-3 text-left">Kasir</th>
                                <th class="px-4 py-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-[#2a2a2a] lg:divide-[#1c1c1c] block lg:table-row-group">
                            ${menuList.map(tm => `
                                <tr class="hover:bg-[#121212] transition-colors block lg:table-row py-3 lg:py-0 border-b border-[#2a2a2a] last:border-b-0 lg:border-b-0">
                                    <td class="px-4 py-3 text-neutral-400 font-mono flex lg:table-cell justify-between items-center">
                                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Waktu</span>
                                        <span>${tm.waktu || '-'}</span>
                                    </td>
                                    <td class="px-4 py-3 flex lg:table-cell justify-between items-center border-t border-[#2a2a2a]/50 lg:border-t-0">
                                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Nota</span>
                                        <span class="font-mono text-neutral-300">${tm.no_nota || '-'}</span>
                                    </td>
                                    <td class="px-4 py-3 text-neutral-200 flex lg:table-cell justify-between items-center">
                                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Item Menu</span>
                                        <span class="font-semibold">${tm.menu_nama || '-'}</span>
                                    </td>
                                    <td class="px-4 py-3 text-center font-mono flex lg:table-cell justify-between items-center">
                                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Jumlah</span>
                                        <span>${tm.jumlah || 0}</span>
                                    </td>
                                    <td class="px-4 py-3 text-right font-mono font-bold text-neutral-200 flex lg:table-cell justify-between items-center">
                                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Total Harga</span>
                                        <span>${Utils.formatRupiah(tm.total_harga || 0)}</span>
                                    </td>
                                    <td class="px-4 py-3 text-neutral-500 font-mono flex lg:table-cell justify-between items-center">
                                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider lg:hidden">PC</span>
                                        <span>${tm.pc_kode || '-'}</span>
                                    </td>
                                    <td class="px-4 py-3 text-neutral-500 flex lg:table-cell justify-between items-center">
                                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Kasir</span>
                                        <span>${tm.kasir_nama || '-'}</span>
                                    </td>
                                    <td class="px-4 py-3 text-center flex lg:table-cell justify-between items-center">
                                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Aksi</span>
                                        <button onclick="LaporanMenu.printStruk(${tm.id})" class="px-2.5 py-1 bg-neutral-900 border border-[#2a2a2a] hover:bg-neutral-800 text-neutral-300 text-[10px] font-bold rounded transition-colors">Cetak</button>
                                    </td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>`;
        } else {
            html += '<div class="text-center py-10 text-neutral-500 text-xs">Tidak ada transaksi F&B pada tanggal ini</div>';
        }

        area.innerHTML = html;
    },

    filter() {
        const tanggal = document.getElementById('laporan-menu-tanggal-select').value;
        const kasirId = document.getElementById('laporan-menu-kasir-select').value;
        this.loadByDate(tanggal, kasirId);
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
    }
};

window.LaporanMenu = LaporanMenu;
