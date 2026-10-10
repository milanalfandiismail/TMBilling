// static/js/kasir/modules/laporan_maintenance/index.js

const LaporanMaintenance = {
    reportData: null,
    pcs: [],
    currentPage: 1,
    perPage: 5,
    totalPages: 1,

    resetState() {
        this.reportData = null;
        this.pcs = [];
        this.currentPage = 1;
        this.totalPages = 1;
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

    _lastFingerprint: null,

    refreshLive() {
        if (typeof App !== 'undefined' && !['maintenance', 'laporan_maintenance'].includes(App.currentTab)) return;
        if (typeof App !== 'undefined' && App.currentTab === 'laporan_maintenance') {
            return this.loadReport(true);
        }
        const subTab = document.getElementById('maintenance-tab-report');
        if (subTab && subTab.classList.contains('hidden')) return;
        return this.loadReport(true);
    },

    async loadReport(isSilent = false) {
        const tbody = document.getElementById('report-maint-tbody');
        if (tbody && !isSilent && (!this.reportData) && typeof Skeleton !== 'undefined') {
            tbody.innerHTML = Skeleton.tableRows(5, 3);
        }

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
                const report = res.report || {};
                const newFingerprint = JSON.stringify({
                    tanggal,
                    kategori,
                    pcId,
                    total_biaya: report.total_biaya,
                    total_kasus: report.total_kasus,
                    list: (report.list_tiket || []).map(t => ({ id: t.id, biaya: t.biaya }))
                });

                if (isSilent && this._lastFingerprint === newFingerprint) {
                    return; // Data tidak berubah
                }
                this._lastFingerprint = newFingerprint;

                this.reportData = report;
                this.renderReport();
            }
        } catch (err) {
            if (!isSilent) {
                Toast.error('Gagal memuat laporan perawatan.');
            }
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
        const elHardware = document.getElementById('report-breakdown-hardware');
        const elSoftware = document.getElementById('report-breakdown-software');
        const elJaringan = document.getElementById('report-breakdown-jaringan');
        const elLainnya = document.getElementById('report-breakdown-lainnya');

        if (elHardware) elHardware.innerText = `${breakdown.HARDWARE || 0} kasus`;
        if (elSoftware) elSoftware.innerText = `${breakdown.SOFTWARE || 0} kasus`;
        if (elJaringan) elJaringan.innerText = `${breakdown.JARINGAN || 0} kasus`;
        if (elLainnya) elLainnya.innerText = `${breakdown.LAINNYA || 0} kasus`;

        // Render Tbody with 5-item Pagination
        const tbody = document.getElementById('report-maint-tbody');
        if (!tbody) return;

        const listTiket = this.reportData.list_tiket || [];
        this.currentTickets = listTiket;
        this.totalPages = Math.ceil(listTiket.length / this.perPage) || 1;
        this.currentPage = Math.max(1, Math.min(this.currentPage, this.totalPages));

        if (listTiket.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="py-4 text-center text-neutral-500 text-xs lg:text-[10px] xl:text-[11px] 2xl:text-sm">Belum ada riwayat perbaikan pada periode ini.</td>
                </tr>
            `;
            this.renderPagination(0);
            return;
        }

        const startIndex = (this.currentPage - 1) * this.perPage;
        const pageTickets = listTiket.slice(startIndex, startIndex + this.perPage);

        tbody.innerHTML = pageTickets.map((t, idx) => `
            <tr class="hover:bg-[#121212] transition-colors border-b border-[#1c1c1c] last:border-b-0">
                <td class="py-1.5 lg:py-1 xl:py-1.5 2xl:py-2 px-2.5 xl:px-3 2xl:px-4">
                    <div class="flex flex-col">
                        <span class="font-bold text-neutral-100 font-mono text-xs lg:text-[11px] xl:text-xs 2xl:text-sm">${t.pc_kode}</span>
                        <span class="text-neutral-500 font-mono text-[10px] lg:text-[9px] xl:text-[10px] 2xl:text-xs mt-0.5">${t.resolved_at || '-'}</span>
                    </div>
                </td>
                <td class="py-1.5 lg:py-1 xl:py-1.5 2xl:py-2 px-2.5 xl:px-3 2xl:px-4 whitespace-nowrap">
                    <div class="flex flex-col items-start gap-0.5">
                        <span class="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-bold uppercase tracking-wider text-[9px] lg:text-[9px] xl:text-[10px] 2xl:text-xs">${t.kategori}</span>
                        <span class="font-bold text-emerald-400 font-mono text-xs lg:text-[11px] xl:text-xs 2xl:text-sm">${formatRupiah(t.biaya)}</span>
                    </div>
                </td>
                <td class="py-1.5 lg:py-1 xl:py-1.5 2xl:py-2 px-2.5 xl:px-3 2xl:px-4">
                    <div class="flex flex-col">
                        <div class="font-semibold text-neutral-200 break-words leading-tight text-xs lg:text-[11px] xl:text-xs 2xl:text-sm">${t.judul}</div>
                        <div class="text-neutral-400 text-[10px] lg:text-[9px] xl:text-[10px] 2xl:text-xs mt-0.5 break-words leading-tight line-clamp-1" title="${this.escapeHtml(t.resolusi || '')}">${t.resolusi || '-'}</div>
                    </div>
                </td>
                <td class="py-1.5 lg:py-1 xl:py-1.5 2xl:py-2 px-2.5 xl:px-3 2xl:px-4 text-center whitespace-nowrap">
                    <button type="button" onclick="LaporanMaintenance.openDetailModal('${this.escapeHtml(t.id || '')}', ${startIndex + idx})"
                        class="inline-flex items-center gap-1.5 px-2 py-0.5 lg:px-2 lg:py-0.5 xl:px-2.5 xl:py-1 2xl:px-3.5 2xl:py-1.5 bg-[#171717] hover:bg-[#242424] border border-[#2a2a2a] hover:border-neutral-500 text-neutral-300 hover:text-white rounded text-xs lg:text-[9px] xl:text-xs 2xl:text-sm font-semibold transition-colors shadow-sm">
                        <svg class="w-3.5 h-3.5 2xl:w-4 2xl:h-4 text-neutral-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>Detail</span>
                    </button>
                </td>
            </tr>
        `).join('');

        this.renderPagination(listTiket.length);
    },

    openDetailModal(ticketId, index) {
        let ticket = null;
        if (ticketId && this.currentTickets && this.currentTickets.length > 0) {
            ticket = this.currentTickets.find(item => String(item.id) === String(ticketId));
        }
        if (!ticket && typeof index === 'number' && this.currentTickets && this.currentTickets[index]) {
            ticket = this.currentTickets[index];
        }
        if (!ticket) {
            if (window.Toast) Toast.error('Data tiket perbaikan tidak ditemukan');
            return;
        }

        const formatRupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num || 0);

        const elPc = document.getElementById('maint-report-detail-pc');
        const elKategori = document.getElementById('maint-report-detail-kategori');
        const elPrioritas = document.getElementById('maint-report-detail-prioritas');
        const elBiaya = document.getElementById('maint-report-detail-biaya');
        const elWaktuLapor = document.getElementById('maint-report-detail-waktu-lapor');
        const elWaktuSelesai = document.getElementById('maint-report-detail-waktu-selesai');
        const elReporter = document.getElementById('maint-report-detail-reporter');
        const elResolvedBy = document.getElementById('maint-report-detail-resolved-by');
        const elJudul = document.getElementById('maint-report-detail-judul');
        const elDeskripsi = document.getElementById('maint-report-detail-deskripsi');
        const elResolusi = document.getElementById('maint-report-detail-resolusi');

        if (elPc) elPc.innerText = ticket.pc_kode || 'PC';
        if (elKategori) elKategori.innerText = ticket.kategori || 'HARDWARE';
        if (elPrioritas) elPrioritas.innerText = ticket.prioritas || 'SEDANG';
        if (elBiaya) elBiaya.innerText = formatRupiah(ticket.biaya);
        if (elWaktuLapor) elWaktuLapor.innerText = ticket.created_at || '-';
        if (elWaktuSelesai) elWaktuSelesai.innerText = ticket.resolved_at || '-';
        if (elReporter) elReporter.innerText = ticket.reporter || '-';
        if (elResolvedBy) elResolvedBy.innerText = ticket.resolved_by || 'Staf IT';
        if (elJudul) elJudul.innerText = ticket.judul || '-';

        if (elDeskripsi) {
            if (ticket.deskripsi && ticket.deskripsi.trim() !== '') {
                elDeskripsi.innerHTML = this.escapeHtml(ticket.deskripsi);
                elDeskripsi.classList.remove('italic', 'text-neutral-500');
                elDeskripsi.classList.add('text-neutral-300');
            } else {
                elDeskripsi.innerHTML = '<span class="italic text-neutral-500">Tidak ada deskripsi keluhan tambahan.</span>';
            }
        }

        if (elResolusi) {
            if (ticket.resolusi && ticket.resolusi.trim() !== '') {
                elResolusi.innerHTML = this.escapeHtml(ticket.resolusi);
                elResolusi.classList.remove('italic', 'text-neutral-500');
                elResolusi.classList.add('text-emerald-300/90');
            } else {
                elResolusi.innerHTML = '<span class="italic text-neutral-500">Tidak ada catatan resolusi perbaikan.</span>';
            }
        }

        const modal = document.getElementById('modal-maint-report-detail');
        if (modal) {
            modal.classList.remove('hidden');
        }
    },

    closeDetailModal() {
        const modal = document.getElementById('modal-maint-report-detail');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    renderPagination(totalItems) {
        const pageInfo = document.getElementById('maint-report-page-info');
        const prevBtn = document.getElementById('maint-report-prev-btn');
        const nextBtn = document.getElementById('maint-report-next-btn');
        const paginationContainer = document.getElementById('maint-report-pagination');

        if (!paginationContainer) return;

        if (!totalItems || totalItems === 0) {
            paginationContainer.classList.add('hidden');
            return;
        }

        paginationContainer.classList.remove('hidden');

        if (pageInfo) {
            pageInfo.innerText = `Halaman ${this.currentPage} dari ${this.totalPages} (${totalItems} total riwayat)`;
        }

        if (prevBtn) {
            prevBtn.disabled = this.currentPage <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= this.totalPages;
        }
    },

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderReport();
        }
    },

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.renderReport();
        }
    },

    filter() {
        this.currentPage = 1;
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
    },

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
};
