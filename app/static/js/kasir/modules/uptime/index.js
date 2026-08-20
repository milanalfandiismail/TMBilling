// app/static/js/kasir/modules/uptime/index.js

const UptimeTracker = {
    mode: 'daily', // 'daily' atau 'range'
    currentDate: null,
    
    init() {
        const today = new Date().toISOString().split('T')[0];
        
        // Set default dates
        const dateInput = document.getElementById('uptime-date');
        const startInput = document.getElementById('uptime-start');
        const endInput = document.getElementById('uptime-end');
        
        if (dateInput) dateInput.value = today;
        
        if (startInput && endInput) {
            // Default range 7 hari yang lalu s/d hari ini
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            startInput.value = sevenDaysAgo.toISOString().split('T')[0];
            endInput.value = today;
        }

        this.toggleMode();
        this.load();
    },

    toggleMode() {
        const select = document.getElementById('uptime-mode-select');
        if (!select) return;
        
        this.mode = select.value;
        
        const dailyFilter = document.getElementById('uptime-daily-filter');
        const rangeFilter = document.getElementById('uptime-range-filter');
        const thSeenFirst = document.getElementById('th-seen-first');
        const thSeenLast = document.getElementById('th-seen-last');

        if (this.mode === 'daily') {
            if (dailyFilter) dailyFilter.classList.remove('hidden');
            if (rangeFilter) rangeFilter.classList.add('hidden');
            if (thSeenFirst) thSeenFirst.textContent = 'Mulai Aktif';
            if (thSeenLast) thSeenLast.textContent = 'Terakhir Aktif';
        } else {
            if (dailyFilter) dailyFilter.classList.add('hidden');
            if (rangeFilter) rangeFilter.classList.remove('hidden');
            if (thSeenFirst) thSeenFirst.textContent = 'Hari Aktif';
            if (thSeenLast) thSeenLast.textContent = 'Rata-rata / Hari';
        }
        this.load();
    },

    async load() {
        const tbody = document.getElementById('uptime-table-body');
        if (!tbody) return;
        
        // Show loading spinner
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-10">
                    <div class="flex justify-center items-center gap-2">
                        <div class="w-6 h-6 border-2 border-[#1c1c1c] border-t-neutral-100 rounded-full animate-spin"></div>
                        <span class="text-neutral-500 text-xs">Memuat laporan...</span>
                    </div>
                </td>
            </tr>
        `;

        try {
            if (this.mode === 'daily') {
                const date = document.getElementById('uptime-date')?.value;
                if (!date) {
                    Toast.error('Tanggal wajib dipilih');
                    return;
                }
                
                const res = await API.uptime.daily(date);
                if (res.success) {
                    this.renderDaily(res);
                } else {
                    throw new Error(res.error || 'Gagal memuat data');
                }
            } else {
                const start = document.getElementById('uptime-start')?.value;
                const end = document.getElementById('uptime-end')?.value;
                
                if (!start || !end) {
                    Toast.error('Tanggal mulai dan akhir wajib dipilih');
                    return;
                }
                
                const res = await API.uptime.range(start, end);
                if (res.success) {
                    this.renderRange(res, start, end);
                } else {
                    throw new Error(res.error || 'Gagal memuat data');
                }
            }
        } catch (err) {
            console.error('UptimeTracker Error:', err);
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-10 text-red-500 font-medium">
                        ⚠️ Gagal memuat data: ${err.message}
                    </td>
                </tr>
            `;
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

    renderDaily(data) {
        const tbody = document.getElementById('uptime-table-body');
        const desc = document.getElementById('uptime-report-desc');
        
        // Update Description
        if (desc) desc.textContent = `Laporan tanggal: ${Utils.formatTanggal(data.date)}`;

        const report = data.report || [];
        
        if (report.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-10 text-neutral-500">
                        Tidak ada aktivitas PC client yang terekam pada tanggal ini.
                    </td>
                </tr>
            `;
            this.updateKPIs(0, 0, 0);
            return;
        }

        let totalOnlineSec = 0;
        let totalBillingSec = 0;
        let html = '';

        report.forEach(item => {
            totalOnlineSec += item.total_online_seconds;
            totalBillingSec += item.total_billing_seconds;

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

            html += `
                <tr class="hover:bg-[#111]/30 transition-colors">
                    <td class="px-6 py-3.5 font-bold font-mono text-neutral-100">${item.pc_kode}</td>
                    <td class="px-6 py-3.5"><span class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-[#222] bg-[#111] text-neutral-400">${item.grup || 'Reguler'}</span></td>
                    <td class="px-6 py-3.5 font-mono text-neutral-500">${item.first_seen_time || this.formatTimeOnly(item.first_seen)}</td>
                    <td class="px-6 py-3.5 font-mono text-neutral-500">${item.last_seen_time || this.formatTimeOnly(item.last_seen)}</td>
                    <td class="px-6 py-3.5 font-bold font-mono text-neutral-300">${Utils.formatMenit(onlineMin)}</td>
                    <td class="px-6 py-3.5 font-bold font-mono text-emerald-400">${Utils.formatMenit(billingMin)}</td>
                    <td class="px-6 py-3.5 font-mono text-neutral-500">${Utils.formatMenit(idleMin)}</td>
                    <td class="px-6 py-3.5 text-center">
                        <span class="inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${badgeColor}">
                            ${utilization}%
                        </span>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

        // Hitung rata-rata utilisasi
        let avgUtil = 0;
        if (totalOnlineSec > 0) {
            avgUtil = Math.round((totalBillingSec / totalOnlineSec) * 100);
        }

        const onlineHours = (totalOnlineSec / 3600).toFixed(1);
        const billingHours = (totalBillingSec / 3600).toFixed(1);

        this.updateKPIs(avgUtil, `${onlineHours} Jam`, `${billingHours} Jam`);
    },

    renderRange(data, start, end) {
        const tbody = document.getElementById('uptime-table-body');
        const desc = document.getElementById('uptime-report-desc');
        
        // Update Description
        if (desc) desc.textContent = `Laporan rentang: ${Utils.formatTanggal(start)} s/d ${Utils.formatTanggal(end)}`;

        const pcs = data.pcs || [];
        
        if (pcs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-10 text-neutral-500">
                        Tidak ada data uptime terekam dalam rentang tanggal ini.
                    </td>
                </tr>
            `;
            this.updateKPIs(0, 0, 0);
            return;
        }

        let html = '';
        pcs.forEach(item => {
            const onlineMin = Math.round(item.total_online_menit);
            const billingMin = Math.round(item.total_billing_menit);
            const idleMin = Math.max(0, onlineMin - billingMin);

            const avgOnlinePerHari = Math.round(onlineMin / item.hari_aktif);

            const utilization = item.utilisasi_persen;
            let badgeColor = 'text-red-400 bg-red-950/20 border-red-900/30';
            if (utilization >= 70.0) {
                badgeColor = 'text-emerald-400 bg-emerald-950/20 border-emerald-900/30';
            } else if (utilization >= 40.0) {
                badgeColor = 'text-amber-400 bg-amber-950/20 border-amber-900/30';
            }

            html += `
                <tr class="hover:bg-[#111]/30 transition-colors">
                    <td class="px-6 py-3.5 font-bold font-mono text-neutral-100">${item.pc_kode}</td>
                    <td class="px-6 py-3.5"><span class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-[#222] bg-[#111] text-neutral-400">${item.grup || 'Reguler'}</span></td>
                    <td class="px-6 py-3.5 font-semibold text-neutral-300">${item.hari_aktif} Hari</td>
                    <td class="px-6 py-3.5 font-mono text-neutral-500">${Utils.formatMenit(avgOnlinePerHari)} / hari</td>
                    <td class="px-6 py-3.5 font-bold font-mono text-neutral-300">${Utils.formatMenit(onlineMin)}</td>
                    <td class="px-6 py-3.5 font-bold font-mono text-emerald-400">${Utils.formatMenit(billingMin)}</td>
                    <td class="px-6 py-3.5 font-mono text-neutral-500">${Utils.formatMenit(idleMin)}</td>
                    <td class="px-6 py-3.5 text-center">
                        <span class="inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${badgeColor}">
                            ${utilization}%
                        </span>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

        const summary = data.summary || {};
        const onlineHours = (summary.total_online_menit / 60).toFixed(1);
        const billingHours = (summary.total_billing_menit / 60).toFixed(1);
        
        this.updateKPIs(summary.avg_utilisasi_persen, `${onlineHours} Jam`, `${billingHours} Jam`);
    },

    updateKPIs(avgUtil, onlineText, billingText) {
        const kpiAvg = document.getElementById('uptime-kpi-avg-util');
        const kpiOnline = document.getElementById('uptime-kpi-total-online');
        const kpiBilling = document.getElementById('uptime-kpi-total-billing');
        
        if (kpiAvg) {
            kpiAvg.textContent = `${avgUtil}%`;
            // Dynamic text colors based on score
            kpiAvg.className = 'text-xl lg:text-3xl font-extrabold mt-1 ' + 
                (avgUtil >= 70 ? 'text-emerald-400' : (avgUtil >= 40 ? 'text-amber-400' : 'text-red-400'));
        }
        if (kpiOnline) kpiOnline.textContent = onlineText || '—';
        if (kpiBilling) kpiBilling.textContent = billingText || '—';
    }
};

window.UptimeTracker = UptimeTracker;
