const HardwareChecker = {
    openedDetails: new Set(),
    isLoading: false,

    escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    getNicSpeedBadge(nicSpeed) {
        if (!nicSpeed || nicSpeed === '--' || nicSpeed === 'Unknown') {
            return '<span class="text-neutral-500 font-mono">NIC: --</span>';
        }
        const str = String(nicSpeed).trim();
        const lower = str.toLowerCase();
        
        let isGigabitOrMore = false;
        if (lower.includes('gbps')) {
            const val = parseFloat(lower.replace(/[^0-9.]/g, ''));
            isGigabitOrMore = !isNaN(val) && val >= 1.0;
        } else if (lower.includes('mbps')) {
            const val = parseFloat(lower.replace(/[^0-9.]/g, ''));
            isGigabitOrMore = !isNaN(val) && val >= 1000.0;
        }

        if (isGigabitOrMore) {
            return `<span class="font-mono text-neutral-400">NIC: <strong class="text-emerald-400 font-bold">${this.escapeHtml(str)}</strong></span>`;
        } else {
            return `<span class="font-mono text-neutral-400">NIC: <strong class="text-red-400 font-bold animate-pulse" title="Kecepatan LAN di bawah 1 Gbps">${this.escapeHtml(str)}</strong></span>`;
        }
    },

    async load(isInitial = false) {
        if (this.isLoading) return;
        this.isLoading = true;

        const refreshBtn = document.getElementById('hc-refresh-btn');
        const refreshIcon = document.getElementById('hc-refresh-icon');
        if (refreshBtn) refreshBtn.disabled = true;
        if (refreshIcon) refreshIcon.classList.add('animate-spin');

        const container = document.getElementById('hardware-checker-container');
        const hasExistingCards = container && container.querySelector('.bg-\\[\\#0c0c0c\\]');

        if (container && (!hasExistingCards || isInitial)) {
            container.innerHTML = `
                <div class="flex justify-center py-10">
                    <div class="w-8 h-8 border-2 border-[#1c1c1c] border-t-neutral-100 rounded-full animate-spin"></div>
                </div>`;
        }

        try {
            const result = await window.API.monitor.all();
            if (result && result.success) {
                this.render(result.data);
            } else {
                Toast.error("Gagal memuat status hardware checker");
            }
        } catch (error) {
            console.error('[HardwareChecker] Load error:', error);
            Toast.error("Gagal memuat status hardware checker");
            if (container && !hasExistingCards) {
                container.innerHTML = '<div class="text-center py-10 text-red-400 text-sm font-medium">Gagal memuat data hardware checker.</div>';
            }
        } finally {
            this.isLoading = false;
            if (refreshBtn) refreshBtn.disabled = false;
            if (refreshIcon) refreshIcon.classList.remove('animate-spin');
        }
    },

    async registerBaseline(pcId, pcKode) {
        const targetKode = (pcKode || '').startsWith('PC') ? pcKode : `PC ${pcKode}`;
        if (!confirm(`Apakah Anda yakin ingin memperbarui baseline hardware & peripheral untuk ${targetKode}?\n\nGunakan tombol ini HANYA jika Anda (Owner/Admin) baru saja melakukan upgrade fisik atau mengganti periferal (mouse/keyboard/headset) resmi pada ${targetKode}.`)) {
            return;
        }
        try {
            Toast.info("Memperbarui baseline hardware & periferal...");
            const res = await API.request(`/api/v1/kasir/monitor/register/${pcId}`, {
                method: 'POST'
            });
            if (res && res.success) {
                Toast.success(`Baseline ${targetKode} berhasil diperbarui!`);
                this.load();
            } else {
                Toast.error(res.error || "Gagal memperbarui baseline");
            }
        } catch (err) {
            Toast.error(err.message || "Gagal memperbarui baseline");
        }
    },

    toggleDetails(pcId) {
        const el = document.getElementById(`hc-details-${pcId}`);
        const btn = document.getElementById(`hc-btn-details-${pcId}`);
        if (el) {
            if (el.classList.contains('hidden')) {
                el.classList.remove('hidden');
                this.openedDetails.add(pcId);
                if (btn) btn.innerHTML = `<span>▲</span> Sembunyikan Detail`;
            } else {
                el.classList.add('hidden');
                this.openedDetails.delete(pcId);
                if (btn) btn.innerHTML = `<span>▼</span> Spesifikasi Lengkap`;
            }
        }
    },

    render(data) {
        const container = document.getElementById('hardware-checker-container');
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-neutral-500 space-y-2">
                    <span class="text-3xl mb-1">🖥️</span>
                    <p class="text-xs lg:max-xl:text-lg xl:text-[22px] font-bold text-neutral-200 uppercase tracking-wider">Belum Ada Data Monitor PC</p>
                    <p class="text-[9px] lg:max-xl:text-xs xl:text-base text-neutral-500">Pastikan TMBilling Monitor Agent berjalan pada setiap client</p>
                </div>`;
            return;
        }

        // Sort data naturally by pc_kode
        data.sort((a, b) => (a.pc_kode || '').localeCompare(b.pc_kode || '', undefined, { numeric: true, sensitivity: 'base' }));

        let html = '';

        data.forEach(m => {
            const hasBaseline = !!m.hardware_baseline;
            const isHwMismatch = m.hardware_mismatch === true;
            const isPeriphMismatch = m.peripherals_mismatch === true;
            const isAnyMismatch = isHwMismatch || isPeriphMismatch;

            // Parsing Baseline dan Current Specs JSON
            let baselineSpecs = null;
            let currentSpecs = null;
            let baselinePeriph = null;
            let currentPeriph = null;
            let periphTracker = null;

            try {
                if (m.hardware_baseline) baselineSpecs = JSON.parse(m.hardware_baseline);
                if (m.hardware_current_specs) currentSpecs = JSON.parse(m.hardware_current_specs);
                if (m.peripherals_baseline) baselinePeriph = JSON.parse(m.peripherals_baseline);
                if (m.peripherals_current) currentPeriph = JSON.parse(m.peripherals_current);
                if (m.peripherals_disconnect_tracker) periphTracker = JSON.parse(m.peripherals_disconnect_tracker);
            } catch (err) {}

            let cardBorder = 'border-[#1c1c1c] hover:border-[#2a2a2a]';
            if (isAnyMismatch) {
                cardBorder = 'border-red-500/50 bg-red-950/10 shadow-lg shadow-red-950/20';
            }

            // Status Badge Internal Hardware
            let hwBadge = '';
            if (isHwMismatch) {
                hwBadge = `
                    <span class="px-2.5 py-1 rounded bg-red-900/60 border border-red-500 text-red-200 text-[10px] lg:max-xl:text-xs xl:text-xs font-bold uppercase tracking-wider animate-pulse flex items-center gap-1">
                        🚨 Hardware Ditukar / Hilang
                    </span>`;
            } else if (hasBaseline) {
                hwBadge = `
                    <span class="px-2.5 py-1 rounded bg-green-950/60 border border-green-500/60 text-green-300 text-[10px] lg:max-xl:text-xs xl:text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                        🛡️ Internal Aman
                    </span>`;
            } else {
                hwBadge = `
                    <span class="px-2.5 py-1 rounded bg-amber-900/50 border border-amber-600/50 text-amber-300 text-[10px] lg:max-xl:text-xs xl:text-xs font-bold uppercase tracking-wider">
                        ⚙️ Menunggu Telemetry
                    </span>`;
            }

            // Status Badge Peripherals
            let periphBadge = '';
            if (isPeriphMismatch) {
                periphBadge = `
                    <span class="px-2.5 py-1 rounded bg-red-900/60 border border-red-500 text-red-200 text-[10px] lg:max-xl:text-xs xl:text-xs font-bold uppercase tracking-wider animate-pulse flex items-center gap-1">
                        ⚠️ Periferal Tercuri / Diganti
                    </span>`;
            } else if (m.peripherals_baseline) {
                periphBadge = `
                    <span class="px-2.5 py-1 rounded bg-green-950/60 border border-green-500/60 text-green-300 text-[10px] lg:max-xl:text-xs xl:text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                        🛡️ Periferal Lengkap
                    </span>`;
            }

            // Peripherals Items Breakdown (Mouse, Keyboard, Headset + dynamic)
            const allPeriphKeys = Array.from(new Set([
                'Mouse', 'Keyboard', 'Headset',
                ...Object.keys(baselinePeriph || {}),
                ...Object.keys(currentPeriph || {})
            ]));

            let periphCardsHtml = '';

            allPeriphKeys.forEach(pKey => {
                const baseVal = baselinePeriph ? baselinePeriph[pKey] : null;
                const currVal = currentPeriph ? currentPeriph[pKey] : null;
                const isDisconnectedPending = periphTracker && periphTracker[pKey];

                let pStatusColor = 'border-[#1c1c1c] bg-[#0c0c0c] text-neutral-400';
                let pIcon = '🔌';
                let pStatusText = 'Belum Ada Data';

                if (currVal && currVal !== 'Unknown') {
                    pStatusColor = 'border-green-500/30 bg-green-950/20 text-green-300';
                    pIcon = '🟢';
                    pStatusText = 'Terhubung';
                } else if (isDisconnectedPending) {
                    pStatusColor = 'border-amber-500/40 bg-amber-950/30 text-amber-300 animate-pulse';
                    pIcon = '⏳';
                    pStatusText = 'Dicabut (< 5m)';
                } else if (baseVal && (!currVal || currVal === 'Unknown')) {
                    pStatusColor = 'border-red-500/50 bg-red-950/40 text-red-200 font-bold';
                    pIcon = '🔴';
                    pStatusText = 'Hilang / Dicabut';
                }

                const displayDevName = (currVal && currVal !== 'Unknown') ? currVal : (baseVal || null);

                periphCardsHtml += `
                    <div class="p-2.5 sm:p-3 rounded border ${pStatusColor} flex flex-col justify-between gap-1.5 transition-all min-w-0">
                        <div class="flex items-center justify-between gap-1 min-w-0">
                            <span class="text-xs lg:max-xl:text-xs xl:text-sm font-bold text-neutral-200 truncate">${this.escapeHtml(pKey)}</span>
                        </div>
                        <div class="space-y-1 min-w-0">
                            <div class="text-[10px] lg:max-xl:text-[10px] xl:text-xs font-mono flex items-center gap-1.5">
                                <span>${pIcon}</span>
                                <span>${pStatusText}</span>
                            </div>
                            <div class="text-[10px] lg:max-xl:text-[11px] xl:text-xs text-neutral-400 font-mono break-words leading-tight min-w-0">
                                ${displayDevName ? this.escapeHtml(displayDevName) : '<span class="text-neutral-600 italic">Tidak terdeteksi</span>'}
                            </div>
                        </div>
                    </div>`;
            });

            // CCTV Alerts Panel
            let alertHtml = '';
            if (isHwMismatch) {
                const cctvWindowDisplay = m.hardware_cctv_window || `${m.hardware_mismatch_time || '--:--'} (saat booting)`;
                alertHtml += `
                    <div class="p-3.5 sm:p-4 bg-red-950/30 border border-red-500/30 rounded text-xs lg:max-xl:text-xs xl:text-sm space-y-2 mt-3 min-w-0 w-full">
                        <div class="flex items-center gap-2 font-bold text-red-400 uppercase tracking-wider min-w-0">
                            <span>🚨</span> DETEKSI PERUBAHAN HARDWARE INTERNAL:
                        </div>
                        <p class="font-mono text-xs lg:max-xl:text-xs xl:text-sm pl-2.5 border-l-2 border-red-500 bg-red-950/50 p-2.5 rounded text-red-200 break-all min-w-0 w-full">${this.escapeHtml(m.hardware_mismatch_desc || 'Unknown mismatch')}</p>
                        <div class="text-[11px] lg:max-xl:text-xs xl:text-sm text-neutral-400 flex flex-wrap items-center gap-1.5 min-w-0">
                            <span>🎥</span> <strong class="text-neutral-300 uppercase shrink-0">Rentang Waktu Estimasi (Referensi CCTV):</strong> 
                            <span class="font-mono font-bold text-red-300 break-all min-w-0">${this.escapeHtml(cctvWindowDisplay)}</span>
                        </div>
                    </div>`;
            }

            if (isPeriphMismatch) {
                alertHtml += `
                    <div class="p-3.5 sm:p-4 bg-amber-500/10 border border-amber-500/30 rounded text-xs lg:max-xl:text-xs xl:text-sm space-y-2 mt-3 min-w-0 w-full">
                        <div class="flex items-center gap-2 font-bold text-amber-300 uppercase tracking-wider min-w-0">
                            <span>⚠️</span> PERINGATAN PERIFERAL DICABUT / DIGANTI:
                        </div>
                        <p class="font-mono text-xs lg:max-xl:text-xs xl:text-sm pl-2.5 border-l-2 border-amber-500 bg-amber-950/40 p-2.5 rounded text-amber-200 break-all min-w-0 w-full">${this.escapeHtml(m.peripherals_mismatch_desc || 'Peripheral mismatch')}</p>
                        <div class="text-[11px] lg:max-xl:text-xs xl:text-sm text-neutral-400 flex flex-wrap items-center gap-1.5 min-w-0">
                            <span>🎥</span> <strong class="text-neutral-300 uppercase shrink-0">Waktu Dicabut (CCTV):</strong> 
                            <span class="font-mono font-bold text-amber-300 break-all min-w-0">${this.escapeHtml(m.peripherals_mismatch_time || '--:--')}</span>
                        </div>
                    </div>`;
            }

            // Specs Details Accordion (Baseline vs Detected)
            let specDetailsHtml = '';
            if (currentSpecs || baselineSpecs || baselinePeriph || currentPeriph) {
                const renderRamPills = (serials, isBaseline) => {
                    if (!serials || !serials.length) return '<span class="text-neutral-600 font-mono text-xs lg:max-xl:text-xs xl:text-base">N/A</span>';
                    return serials.map(r => {
                        let isMatched = true;
                        if (!isBaseline && baselineSpecs && baselineSpecs.RamSerials && baselineSpecs.RamSerials.length) {
                            isMatched = baselineSpecs.RamSerials.includes(r);
                        }
                        if (!isMatched) {
                            return `<span class="inline-block bg-red-950/80 text-red-200 border border-red-500 px-2 py-0.5 rounded mr-1 mb-1 font-bold text-[10px] lg:max-xl:text-xs xl:text-sm font-mono animate-pulse">🚨 ${this.escapeHtml(r)} (Tukar!)</span>`;
                        }
                        return `<span class="inline-block bg-[#121212] text-purple-300 border border-purple-900/50 px-2 py-0.5 rounded mr-1 mb-1 font-bold text-[10px] lg:max-xl:text-xs xl:text-sm font-mono">🏷️ ${this.escapeHtml(r)}</span>`;
                    }).join('');
                };

                const renderDiskPills = (serials, isBaseline) => {
                    if (!serials || !serials.length) return '<span class="text-neutral-600 font-mono text-xs lg:max-xl:text-xs xl:text-base">N/A</span>';
                    return serials.map(d => {
                        let isMatched = true;
                        if (!isBaseline && baselineSpecs && baselineSpecs.DiskSerials && baselineSpecs.DiskSerials.length) {
                            isMatched = baselineSpecs.DiskSerials.includes(d);
                        }
                        if (!isMatched) {
                            return `<span class="inline-block bg-red-950/80 text-red-200 border border-red-500 px-2 py-0.5 rounded mr-1 mb-1 font-bold text-[10px] lg:max-xl:text-xs xl:text-sm font-mono animate-pulse">🚨 ${this.escapeHtml(d)} (Tukar!)</span>`;
                        }
                        return `<span class="inline-block bg-[#121212] text-cyan-300 border border-cyan-900/50 px-2 py-0.5 rounded mr-1 mb-1 font-bold text-[10px] lg:max-xl:text-xs xl:text-sm font-mono">💽 ${this.escapeHtml(d)}</span>`;
                    }).join('');
                };

                // Generate Peripherals lists for Baseline
                let basePeriphItemsHtml = '';
                allPeriphKeys.forEach(pKey => {
                    const bVal = baselinePeriph ? baselinePeriph[pKey] : null;
                    basePeriphItemsHtml += `
                        <li class="flex flex-wrap items-baseline gap-1.5 min-w-0 w-full">
                            <strong class="text-neutral-500 shrink-0">${this.escapeHtml(pKey)}:</strong>
                            <span class="break-words text-neutral-300 min-w-0">${bVal ? this.escapeHtml(bVal) : '<span class="text-neutral-600 italic">Belum terdaftar</span>'}</span>
                        </li>`;
                });

                // Generate Peripherals lists for Live Telemetry
                let currPeriphItemsHtml = '';
                allPeriphKeys.forEach(pKey => {
                    const cVal = currentPeriph ? currentPeriph[pKey] : null;
                    const isDisc = periphTracker && periphTracker[pKey];
                    let statusBadge = '';
                    if (cVal && cVal !== 'Unknown') {
                        statusBadge = '<span class="text-green-400 font-bold text-[10px] lg:max-xl:text-[11px] xl:text-xs ml-1 shrink-0">[🟢 Terhubung]</span>';
                    } else if (isDisc) {
                        statusBadge = '<span class="text-amber-400 font-bold text-[10px] lg:max-xl:text-[11px] xl:text-xs ml-1 shrink-0 animate-pulse">[⏳ Dicabut <5m]</span>';
                    } else {
                        statusBadge = '<span class="text-red-400 font-bold text-[10px] lg:max-xl:text-[11px] xl:text-xs ml-1 shrink-0">[🔴 Tidak Terdeteksi / Hilang]</span>';
                    }

                    currPeriphItemsHtml += `
                        <li class="flex flex-wrap items-baseline gap-1.5 min-w-0 w-full">
                            <strong class="text-neutral-500 shrink-0">${this.escapeHtml(pKey)}:</strong>
                            <span class="break-words text-neutral-300 font-mono min-w-0">${cVal && cVal !== 'Unknown' ? this.escapeHtml(cVal) : '<span class="text-neutral-600 italic">Tidak Terdeteksi</span>'}</span>
                            ${statusBadge}
                        </li>`;
                });

                const isDetailsOpen = this.openedDetails.has(m.pc_id);
                specDetailsHtml = `
                    <div class="mt-4 pt-4 border-t border-[#1c1c1c] space-y-4 ${isDetailsOpen ? '' : 'hidden'} min-w-0 w-full" id="hc-details-${m.pc_id}">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0 w-full">
                            <!-- Baseline Specs -->
                            <div class="p-4 sm:p-5 bg-[#050505] border border-[#1c1c1c] rounded space-y-4 min-w-0 overflow-hidden w-full">
                                <div class="min-w-0 w-full">
                                    <div class="flex flex-wrap items-center border-b border-[#1c1c1c] pb-2.5 min-w-0 mb-3 gap-x-2 gap-y-1 min-h-[36px]">
                                        <span class="text-xs font-bold text-neutral-300 uppercase tracking-wider font-mono flex items-center gap-1.5 flex-1 min-w-0">
                                            <span>🔒</span> Baseline Resmi (Terkunci)
                                        </span>
                                        <span class="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-900/60 font-bold uppercase tracking-wider shrink-0">
                                            ${baselineSpecs ? 'TERDAFTAR' : 'KOSONG'}
                                        </span>
                                    </div>
                                    ${baselineSpecs ? `
                                        <div class="space-y-3 min-w-0 w-full">
                                            <div class="min-w-0 w-full">
                                                <span class="text-[9px] lg:max-xl:text-[10px] xl:text-xs text-neutral-500 uppercase font-bold tracking-wider block mb-1.5">🛠️ Komponen Internal:</span>
                                                <ul class="text-xs lg:max-xl:text-xs xl:text-sm space-y-2 font-mono text-neutral-400 min-w-0 w-full">
                                                    <li class="flex flex-wrap items-baseline gap-1.5 min-w-0 w-full">
                                                        <strong class="text-neutral-500 shrink-0">Motherboard:</strong>
                                                        <span class="break-all text-neutral-300 min-w-0">${this.escapeHtml(baselineSpecs.MotherboardSerial || 'N/A')}</span>
                                                    </li>
                                                    <li class="flex flex-wrap items-baseline gap-1.5 min-w-0 w-full">
                                                        <strong class="text-neutral-500 shrink-0">CPU ID:</strong>
                                                        <span class="break-all text-neutral-300 min-w-0">${this.escapeHtml(baselineSpecs.CpuId || 'N/A')}</span>
                                                    </li>
                                                    <li class="flex flex-col gap-1 min-w-0 w-full">
                                                        <strong class="text-neutral-500 shrink-0">GPU PNP:</strong>
                                                        <span class="break-all text-neutral-300 font-mono text-[10px] sm:text-[11px] lg:max-xl:text-[11px] xl:text-xs bg-[#0c0c0c] border border-[#1c1c1c] p-2 rounded block w-full select-all leading-relaxed min-w-0 overflow-hidden" title="${this.escapeHtml(baselineSpecs.GpuPnpId || 'N/A')}">${this.escapeHtml(baselineSpecs.GpuPnpId || 'N/A')}</span>
                                                    </li>
                                                    <li class="min-w-0 w-full">
                                                        <strong class="text-neutral-500 shrink-0">RAM Serials:</strong>
                                                        <div class="pt-1 min-w-0">
                                                            ${renderRamPills(baselineSpecs.RamSerials, true)}
                                                        </div>
                                                    </li>
                                                    <li class="min-w-0 w-full">
                                                        <strong class="text-neutral-500 shrink-0">Disks:</strong>
                                                        <div class="pt-1 min-w-0">
                                                            ${renderDiskPills(baselineSpecs.DiskSerials, true)}
                                                        </div>
                                                    </li>
                                                </ul>
                                            </div>

                                            <div class="pt-2.5 border-t border-[#1c1c1c] min-w-0 w-full">
                                                <span class="text-[9px] lg:max-xl:text-[10px] xl:text-xs text-neutral-500 uppercase font-bold tracking-wider block mb-1.5">🎧 Periferal Gaming Terdaftar:</span>
                                                <ul class="text-xs lg:max-xl:text-xs xl:text-sm space-y-1.5 font-mono text-neutral-400 min-w-0 w-full">
                                                    ${basePeriphItemsHtml}
                                                </ul>
                                            </div>
                                        </div>
                                    ` : '<p class="text-xs lg:max-xl:text-xs xl:text-sm text-neutral-600">Belum ada baseline terdaftar.</p>'}
                                </div>
                            </div>

                            <!-- Current Detected Specs -->
                            <div class="p-4 sm:p-5 bg-[#050505] border border-[#1c1c1c] rounded space-y-4 min-w-0 overflow-hidden w-full">
                                <div class="min-w-0 w-full">
                                    <div class="flex flex-wrap items-center border-b border-[#1c1c1c] pb-2.5 min-w-0 mb-3 gap-x-2 gap-y-1 min-h-[36px]">
                                        <span class="text-xs font-bold text-neutral-300 uppercase tracking-wider font-mono flex items-center gap-1.5 flex-1 min-w-0">
                                            <span>🔍</span> Terdeteksi Saat Ini (Live Telemetry)
                                        </span>
                                        <span class="text-[10px] font-mono text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded border border-blue-900/60 font-bold uppercase tracking-wider shrink-0">
                                            ${currentSpecs ? 'LIVE SPECS' : 'KOSONG'}
                                        </span>
                                    </div>
                                    <div class="space-y-3 min-w-0 w-full">
                                        <div class="min-w-0 w-full">
                                            <span class="text-[9px] lg:max-xl:text-[10px] xl:text-xs text-neutral-500 uppercase font-bold tracking-wider block mb-1.5">🛠️ Komponen Internal:</span>
                                            <ul class="text-xs lg:max-xl:text-xs xl:text-sm space-y-2 font-mono text-neutral-400 min-w-0 w-full">
                                                <li class="flex flex-wrap items-baseline gap-1.5 min-w-0 w-full">
                                                    <strong class="text-neutral-500 shrink-0">Motherboard:</strong>
                                                    <span class="break-all text-neutral-300 min-w-0">${this.escapeHtml(currentSpecs?.MotherboardSerial || 'N/A')}</span>
                                                </li>
                                                <li class="flex flex-wrap items-baseline gap-1.5 min-w-0 w-full">
                                                    <strong class="text-neutral-500 shrink-0">CPU ID:</strong>
                                                    <span class="break-all text-neutral-300 min-w-0">${this.escapeHtml(currentSpecs?.CpuId || 'N/A')}</span>
                                                </li>
                                                <li class="flex flex-col gap-1 min-w-0 w-full">
                                                    <strong class="text-neutral-500 shrink-0">GPU PNP:</strong>
                                                    <span class="break-all text-neutral-300 font-mono text-[10px] sm:text-[11px] lg:max-xl:text-[11px] xl:text-xs bg-[#0c0c0c] border border-[#1c1c1c] p-2 rounded block w-full select-all leading-relaxed min-w-0 overflow-hidden" title="${this.escapeHtml(currentSpecs?.GpuPnpId || 'N/A')}">${this.escapeHtml(currentSpecs?.GpuPnpId || 'N/A')}</span>
                                                </li>
                                                <li class="min-w-0 w-full">
                                                    <strong class="text-neutral-500 shrink-0">RAM Serials:</strong>
                                                    <div class="pt-1 min-w-0">
                                                        ${renderRamPills(currentSpecs?.RamSerials, false)}
                                                    </div>
                                                </li>
                                                <li class="min-w-0 w-full">
                                                    <strong class="text-neutral-500 shrink-0">Disks:</strong>
                                                    <div class="pt-1 min-w-0">
                                                        ${renderDiskPills(currentSpecs?.DiskSerials, false)}
                                                    </div>
                                                </li>
                                            </ul>
                                        </div>

                                        <div class="pt-2.5 border-t border-[#1c1c1c] min-w-0 w-full">
                                            <span class="text-[9px] lg:max-xl:text-[10px] xl:text-xs text-neutral-500 uppercase font-bold tracking-wider block mb-1.5">🎧 Periferal Gaming Terdeteksi:</span>
                                            <ul class="text-xs lg:max-xl:text-xs xl:text-sm space-y-1.5 font-mono text-neutral-400 min-w-0 w-full">
                                                ${currPeriphItemsHtml}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>`;
            }

            const nicBadgeHtml = this.getNicSpeedBadge(m.nic_speed);

            html += `
                <div class="bg-[#0c0c0c] border ${cardBorder} rounded p-4 sm:p-5 lg:p-6 transition-all space-y-4 min-w-0 overflow-hidden">
                    <!-- Top Bar: Header & Actions (Responsive sm -> 2xl) -->
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-3 border-b border-[#1c1c1c] min-w-0">
                        <div class="min-w-0 flex-1">
                            <div class="flex flex-wrap items-center gap-2.5">
                                <h4 class="text-sm sm:text-base lg:max-xl:text-lg xl:text-xl font-black text-neutral-100 font-mono tracking-wider">${this.escapeHtml(m.pc_kode)}</h4>
                                ${hwBadge}
                                ${periphBadge}
                            </div>
                            <div class="text-[10px] lg:max-xl:text-xs xl:text-sm text-neutral-400 mt-1 break-words min-w-0">
                                <span class="font-bold text-neutral-300">${this.escapeHtml(m.cpu_name || '--')}</span> | ${this.escapeHtml(m.gpu_name || '--')} (${this.escapeHtml(m.total_ram || '--')})
                            </div>
                        </div>

                        <div class="flex flex-wrap sm:flex-nowrap items-center gap-2.5 self-stretch sm:self-auto shrink-0">
                            ${(currentSpecs || baselineSpecs || baselinePeriph || currentPeriph) ? `
                                <button id="hc-btn-details-${m.pc_id}" type="button" onclick="HardwareChecker.toggleDetails(${m.pc_id})"
                                    class="flex-1 sm:flex-none justify-center px-3 lg:max-xl:px-3.5 xl:px-4 py-2 lg:max-xl:py-2.5 xl:py-2.5 bg-[#171717] hover:bg-[#222] border border-[#262626] text-neutral-200 text-xs lg:max-xl:text-xs xl:text-base font-bold rounded transition-colors flex items-center gap-1.5">
                                    <span>${isDetailsOpen ? '▲' : '▼'}</span> ${isDetailsOpen ? 'Sembunyikan Detail' : 'Spesifikasi Lengkap'}
                                </button>
                            ` : ''}
                            <button type="button" onclick="HardwareChecker.registerBaseline(${m.pc_id}, '${this.escapeHtml(m.pc_kode)}')"
                                class="flex-1 sm:flex-none justify-center px-3 lg:max-xl:px-3.5 xl:px-4 py-2 lg:max-xl:py-2.5 xl:py-2.5 bg-neutral-100 hover:bg-neutral-200 text-black text-xs lg:max-xl:text-xs xl:text-base font-bold rounded transition-colors flex items-center gap-1.5">
                                🔄 Update Baseline
                            </button>
                        </div>
                    </div>

                    <!-- Split Panels on XL & 2XL (7 Cols Internal Specs / 5 Cols Peripherals) -->
                    <div class="grid grid-cols-1 xl:grid-cols-12 gap-4 min-w-0">
                        <!-- Internal Specs Summary (7 Cols) -->
                        <div class="xl:col-span-7 bg-[#050505] border border-[#1c1c1c] rounded p-3.5 sm:p-4 flex flex-col justify-between space-y-3 min-w-0">
                            <div class="text-xs lg:max-xl:text-sm xl:text-base text-neutral-300 font-bold uppercase tracking-wider flex items-center justify-between border-b border-[#1c1c1c] pb-2 min-w-0">
                                <span>🛠️ Komponen Internal Chassis</span>
                                <span class="text-[10px] lg:max-xl:text-xs xl:text-sm font-mono text-neutral-500 font-normal truncate max-w-[200px]" title="${this.escapeHtml(m.motherboard || 'Motherboard')}">${this.escapeHtml(m.motherboard || 'Motherboard')}</span>
                            </div>
                            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs lg:max-xl:text-xs xl:text-sm font-mono text-neutral-400 pt-1 min-w-0">
                                <div class="min-w-0">
                                    <span class="text-[9px] lg:max-xl:text-[10px] xl:text-xs text-neutral-500 uppercase font-semibold block">Processor</span>
                                    <span class="text-xs lg:max-xl:text-xs xl:text-sm text-neutral-200 break-words block font-mono">${this.escapeHtml(m.cpu_name || 'N/A')}</span>
                                </div>
                                <div class="min-w-0">
                                    <span class="text-[9px] lg:max-xl:text-[10px] xl:text-xs text-neutral-500 uppercase font-semibold block">Graphics Card</span>
                                    <span class="text-xs lg:max-xl:text-xs xl:text-sm text-neutral-200 break-words block font-mono">${this.escapeHtml(m.gpu_name || 'N/A')}</span>
                                </div>
                                <div class="min-w-0">
                                    <span class="text-[9px] lg:max-xl:text-[10px] xl:text-xs text-neutral-500 uppercase font-semibold block">Total Memory</span>
                                    <span class="text-xs lg:max-xl:text-xs xl:text-sm text-neutral-200 block font-mono">${this.escapeHtml(m.total_ram || 'N/A')}</span>
                                </div>
                            </div>
                            <div class="text-[10px] lg:max-xl:text-xs xl:text-xs text-neutral-500 pt-2 border-t border-[#1c1c1c]/60 flex flex-wrap items-center justify-between gap-2 min-w-0">
                                <span>Verifikasi Terakhir: <strong class="text-neutral-300">${this.escapeHtml(m.hardware_last_sync || m.last_update || 'Baru saja')}</strong></span>
                                ${nicBadgeHtml}
                            </div>
                        </div>

                        <!-- Peripherals Panel (5 Cols) -->
                        <div class="xl:col-span-5 bg-[#050505] border border-[#1c1c1c] rounded p-3.5 sm:p-4 space-y-3 min-w-0">
                            <div class="text-xs lg:max-xl:text-sm xl:text-base text-neutral-300 font-bold uppercase tracking-wider flex items-center justify-between border-b border-[#1c1c1c] pb-2 min-w-0">
                                <span>🎧 Periferal Gaming (USB / Audio)</span>
                                <span class="text-[10px] lg:max-xl:text-xs xl:text-xs text-neutral-500 font-mono font-normal shrink-0">Grace: 5m</span>
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-3 gap-2.5 pt-1 min-w-0">
                                ${periphCardsHtml}
                            </div>
                        </div>
                    </div>

                    <!-- Alert Panels (if any) -->
                    ${alertHtml}

                    <!-- Collapsible Full Hardware Matrix -->
                    ${specDetailsHtml}
                </div>`;
        });

        container.innerHTML = html;
    }
};

window.HardwareChecker = HardwareChecker;
