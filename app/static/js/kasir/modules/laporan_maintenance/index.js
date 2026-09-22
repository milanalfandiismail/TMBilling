// static/js/kasir/modules/laporan_maintenance/index.js

const LaporanMaintenance = {
    reportData: null,
    pcs: [],

    resetState() {
        this.reportData = null;
        this.pcs = [];
    },

    async init() {
        await this.loadTanggalList();
        if (typeof Maintenance !== 'undefined' && (!Maintenance.pcs || Maintenance.pcs.length === 0)) {
            Maintenance.loadPCs();
        }
        await this.loadReport();
    },

    async loadTanggalList() {
        const select = document.getElementById('maint-report-tanggal-select');
        if (!select) return;

        try {
            const data = await API.report.tanggalList();
            const tanggalList = data.tanggal || [];

            select.innerHTML = '<option value="">Semua Tanggal</option>';
            tanggalList.forEach(tgl => {
                select.innerHTML += `<option value="${tgl}">${tgl}</option>`;
            });
        } catch (err) {
            console.error('Gagal memuat list tanggal laporan maintenance:', err);
        }
    },

    async loadReport() {
        try {
            const tanggal = document.getElementById('maint-report-tanggal-select')?.value || '';
            const kategori = document.getElementById('maint-report-kategori')?.value || '';
            const pcId = document.getElementById('maint-report-pc-val')?.value || '';

            let url = '/api/v1/kasir/maintenance/report?';
            if (tanggal) url += `&tanggal=${tanggal}`;
            if (kategori) url += `&kategori=${kategori}`;
            if (pcId) url += `&pc_id=${pcId}`;

            const res = await API.request(url);
            if (res && res.success) {
                this.reportData = res.report;
                this.renderReport();
            }
        } catch (err) {
            Toast.error('Gagal memuat laporan perawatan.');
        }
    },

    renderReport() {
        if (!this.reportData) return;

        // Render Cards
        const formatRupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num || 0);

        const elBiaya = document.getElementById('report-maint-biaya');
        const elKasus = document.getElementById('report-maint-kasus');
        const elRata = document.getElementById('report-maint-rata');

        if (elBiaya) elBiaya.innerText = formatRupiah(this.reportData.total_biaya);
        if (elKasus) elKasus.innerText = this.reportData.total_kasus;
        if (elRata) elRata.innerText = formatRupiah(this.reportData.rata_rata_biaya);

        // Render Breakdown
        const breakdown = this.reportData.breakdown_kategori || {};
        document.getElementById('report-breakdown-hardware').innerText = `${breakdown.HARDWARE || 0} kasus`;
        document.getElementById('report-breakdown-software').innerText = `${breakdown.SOFTWARE || 0} kasus`;
        document.getElementById('report-breakdown-jaringan').innerText = `${breakdown.JARINGAN || 0} kasus`;
        document.getElementById('report-breakdown-lainnya').innerText = `${breakdown.LAINNYA || 0} kasus`;

        // Render Tbody
        const tbody = document.getElementById('report-maint-tbody');
        if (!tbody) return;

        const listTiket = this.reportData.list_tiket || [];
        if (listTiket.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" class="py-10 text-center text-neutral-500 text-xs lg:max-xl:text-xs xl:text-base">Belum ada riwayat perbaikan pada periode ini.</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        listTiket.forEach(t => {
            tbody.innerHTML += `
                <tr class="hover:bg-[#121212] transition-colors border-b border-[#1c1c1c] last:border-b-0">
                    <td class="py-2.5 px-3">
                        <div class="flex flex-col">
                            <span class="font-bold text-neutral-100 font-mono text-xs lg:max-xl:text-xs xl:text-base">${t.pc_kode}</span>
                            <span class="text-neutral-500 font-mono text-[10px] lg:max-xl:text-xs xl:text-sm mt-0.5">${t.resolved_at || '-'}</span>
                        </div>
                    </td>
                    <td class="py-2.5 px-3">
                        <div class="flex flex-col items-start gap-1">
                            <span class="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-bold uppercase tracking-wider text-[10px] lg:max-xl:text-[10px] xl:text-xs">${t.kategori}</span>
                            <span class="font-bold text-emerald-400 font-mono text-xs lg:max-xl:text-xs xl:text-base">${formatRupiah(t.biaya)}</span>
                        </div>
                    </td>
                    <td class="py-2.5 px-3">
                        <div class="flex flex-col">
                            <div class="font-bold text-neutral-200 break-words leading-snug text-xs lg:max-xl:text-xs xl:text-base">${t.judul}</div>
                            <div class="text-neutral-400 text-[10px] lg:max-xl:text-xs xl:text-sm mt-0.5 break-words leading-relaxed">${t.resolusi || '-'}</div>
                        </div>
                    </td>
                </tr>
            `;
        });
    },

    filter() {
        this.loadReport();
    },

    exportReport() {
        const tanggal = document.getElementById('maint-report-tanggal-select')?.value || '';
        const kategori = document.getElementById('maint-report-kategori')?.value || '';
        const pcId = document.getElementById('maint-report-pc-val')?.value || '';

        let url = '/api/v1/kasir/maintenance/export?';
        if (tanggal) url += `&tanggal=${tanggal}`;
        if (kategori) url += `&kategori=${kategori}`;
        if (pcId) url += `&pc_id=${pcId}`;

        window.open(url, '_blank');
    }
};
