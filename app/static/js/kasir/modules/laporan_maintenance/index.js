// static/js/kasir/modules/laporan_maintenance/index.js

const LaporanMaintenance = {
    reportData: null,
    pcs: [],

    async init() {
        if (typeof flatpickr !== 'undefined') {
            flatpickr(".flatpickr-date", {
                dateFormat: "Y-m-d",
                theme: "dark",
                allowInput: true
            });
        }
        await this.loadReport();
    },

    async loadReport() {
        try {
            const start = document.getElementById('maint-report-start')?.value || '';
            const end = document.getElementById('maint-report-end')?.value || '';
            const kategori = document.getElementById('maint-report-kategori')?.value || '';
            const pcId = document.getElementById('maint-report-pc-val')?.value || '';

            let url = '/api/v1/kasir/maintenance/report?';
            if (start) url += `&start_date=${start}`;
            if (end) url += `&end_date=${end}`;
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

        document.getElementById('report-maint-biaya').innerText = formatRupiah(this.reportData.total_biaya);
        document.getElementById('report-maint-kasus').innerText = this.reportData.total_kasus;
        document.getElementById('report-maint-rata').innerText = formatRupiah(this.reportData.rata_rata_biaya);
        
        const topPcEl = document.getElementById('report-maint-top-pc');
        if (this.reportData.pc_paling_sering_rusak && this.reportData.pc_paling_sering_rusak.length > 0) {
            const topList = this.reportData.pc_paling_sering_rusak.map(item => `${item.pc_kode} (${item.jumlah}x)`).join(', ');
            topPcEl.innerText = topList;
            topPcEl.setAttribute('title', topList);
        } else {
            topPcEl.innerText = 'N/A';
        }

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
                    <td colspan="5" class="py-10 text-center text-neutral-500">Belum ada riwayat perbaikan pada periode ini.</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        listTiket.forEach(t => {
            tbody.innerHTML += `
                <tr class="hover:bg-[#121212] transition-colors">
                    <td class="py-2.5 px-3 text-neutral-400 font-mono">${t.resolved_at || '-'}</td>
                    <td class="py-2.5 px-3 font-bold text-neutral-100 font-mono">${t.pc_kode}</td>
                    <td class="py-2.5 px-3 font-mono text-[9px] lg:text-xs"><span class="px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-bold uppercase tracking-wider">${t.kategori}</span></td>
                    <td class="py-2.5 px-3">
                        <div class="font-bold text-neutral-200">${t.judul}</div>
                        <div class="text-neutral-500 text-[10px] lg:text-[13px] mt-0.5">${t.resolusi || '-'}</div>
                    </td>
                    <td class="py-2.5 px-3 text-right font-bold text-emerald-400 font-mono">${formatRupiah(t.biaya)}</td>
                </tr>
            `;
        });
    },

    filter() {
        this.loadReport();
    },

    exportReport() {
        const start = document.getElementById('maint-report-start')?.value || '';
        const end = document.getElementById('maint-report-end')?.value || '';
        const kategori = document.getElementById('maint-report-kategori')?.value || '';
        const pcId = document.getElementById('maint-report-pc-val')?.value || '';

        let url = '/api/v1/kasir/maintenance/export?';
        if (start) url += `&start_date=${start}`;
        if (end) url += `&end_date=${end}`;
        if (kategori) url += `&kategori=${kategori}`;
        if (pcId) url += `&pc_id=${pcId}`;

        window.open(url, '_blank');
    }
};
