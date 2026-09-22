const HardwareChecker = {
    async load() {
        try {
            const container = document.getElementById('hardware-checker-container');
            if (container) {
                container.innerHTML = `
                    <div class="flex justify-center py-10">
                        <div class="w-8 h-8 border-2 border-[#1c1c1c] border-t-neutral-100 rounded-full animate-spin"></div>
                    </div>`;
            }
            
            const result = await window.API.monitor.all();
            if (result.success) {
                this.render(result.data);
            } else {
                Toast.error("Gagal memuat status hardware checker");
            }
        } catch (error) {
            Toast.error("Gagal memuat status hardware checker");
            const container = document.getElementById('hardware-checker-container');
            if (container) {
                container.innerHTML = '<div class="text-center py-10 text-red-400 text-sm font-medium">Gagal memuat data hardware checker.</div>';
            }
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
                if (btn) btn.innerHTML = `<span>▲</span> Sembunyikan Detail`;
            } else {
                el.classList.add('hidden');
                if (btn) btn.innerHTML = `<span>▼</span> Spesifikasi Lengkap`;
            }
        }
    },

    render(data) {
        const container = document.getElementById('hardware-checker-container');
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-neutral-500">
                    <span class="text-3xl mb-2">🖥️</span>
                    <p class="text-base font-bold text-neutral-300">Belum Ada Data Monitor PC</p>
                    <p class="text-xs text-neutral-600 mt-1">Pastikan TMBilling Monitor Agent berjalan pada setiap client</p>
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

            let cardBorder = 'border-[#1c1c1c] bg-[#0c0c0c] hover:border-[#2a2a2a]';
            if (isAnyMismatch) {
                cardBorder = 'border-red-500/50 bg-red-950/10 shadow-lg shadow-red-950/20';
            }

            // Status Badge Internal Hardware
            let hwBadge = '';
            if (isHwMismatch) {
                hwBadge = `
                    <span class="px-2 py-0.5 rounded bg-red-900/60 border border-red-500 text-red-200 text-[10px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1">
                        🚨 Hardware Ditukar / Hilang
                    </span>`;
            } else if (hasBaseline) {
                hwBadge = `
                    <span class="px-2 py-0.5 rounded bg-green-950/60 border border-green-500/60 text-green-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                        🛡️ Internal Aman
                    </span>`;
            } else {
                hwBadge = `
                    <span class="px-2 py-0.5 rounded bg-amber-900/50 border border-amber-600/50 text-amber-300 text-[10px] font-black uppercase tracking-wider">
                        ⚙️ Menunggu Telemetry
                    </span>`;
            }

            // Status Badge Peripherals
            let periphBadge = '';
            if (isPeriphMismatch) {
                periphBadge = `
                    <span class="px-2 py-0.5 rounded bg-red-900/60 border border-red-500 text-red-200 text-[10px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1">
                        ⚠️ Periferal Tercuri / Diganti
                    </span>`;
            } else if (m.peripherals_baseline) {
                periphBadge = `
                    <span class="px-2 py-0.5 rounded bg-green-950/60 border border-green-500/60 text-green-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                        🛡️ Periferal Lengkap
                    </span>`;
            }

            // Peripherals Items Breakdown (Mouse, Keyboard, Headset)
            const periphKeys = ['Mouse', 'Keyboard', 'Headset'];
            let periphCardsHtml = '';

            periphKeys.forEach(pKey => {
                const baseVal = baselinePeriph ? baselinePeriph[pKey] : null;
                const currVal = currentPeriph ? currentPeriph[pKey] : null;
                const isDisconnectedPending = periphTracker && periphTracker[pKey];

                let pStatusColor = 'border-[#222] bg-[#111] text-neutral-400';
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

                periphCardsHtml += `
                    <div class="p-2.5 rounded-lg border ${pStatusColor} flex flex-col justify-between transition-all">
                        <div class="flex items-center justify-between gap-1 mb-1">
                            <span class="text-[11px] font-bold text-neutral-200">${pKey}</span>
                            <span class="text-[10px] font-mono flex items-center gap-1">${pIcon} ${pStatusText}</span>
                        </div>
                        <div class="text-[10px] text-neutral-400 truncate" title="${currVal || baseVal || 'Tidak terdeteksi'}">
                            ${currVal || baseVal || '<span class="text-neutral-600">Tidak terdeteksi</span>'}
                        </div>
                    </div>`;
            });

            // CCTV Alerts Panel
            let alertHtml = '';
            if (isHwMismatch) {
                alertHtml += `
                    <div class="p-3.5 bg-red-950/30 border border-red-500/30 rounded-lg text-xs sm:text-sm text-red-200 space-y-1.5 mt-3">
                        <div class="flex items-center gap-1.5 font-bold text-red-400">
                            <span>🚨</span> DETEKSI PERUBAHAN HARDWARE INTERNAL:
                        </div>
                        <p class="font-mono text-xs pl-2 border-l-2 border-red-500 bg-red-950/50 p-2 rounded text-red-200">${m.hardware_mismatch_desc || 'Unknown mismatch'}</p>
                        <div class="text-[11px] text-neutral-400 flex flex-wrap items-center gap-1">
                            <span>🎥</span> <strong class="text-neutral-300">Waktu Kejadian (Referensi CCTV):</strong> 
                            <span class="font-mono font-bold text-red-300">${m.hardware_mismatch_time || '--:--'}</span>
                        </div>
                    </div>`;
            }

            if (isPeriphMismatch) {
                alertHtml += `
                    <div class="p-3.5 bg-red-950/30 border border-amber-500/40 rounded-lg text-xs sm:text-sm text-amber-200 space-y-1.5 mt-3">
                        <div class="flex items-center gap-1.5 font-bold text-amber-400">
                            <span>⚠️</span> PERINGATAN PERIFERAL DICABUT / DIGANTI:
                        </div>
                        <p class="font-mono text-xs pl-2 border-l-2 border-amber-500 bg-red-950/50 p-2 rounded text-amber-200">${m.peripherals_mismatch_desc || 'Peripheral mismatch'}</p>
                        <div class="text-[11px] text-neutral-400 flex flex-wrap items-center gap-1">
                            <span>🎥</span> <strong class="text-neutral-300">Waktu Dicabut (CCTV):</strong> 
                            <span class="font-mono font-bold text-amber-300">${m.peripherals_mismatch_time || '--:--'}</span>
                        </div>
                    </div>`;
            }

            // Specs Details Accordion (Baseline vs Detected)
            let specDetailsHtml = '';
            if (currentSpecs) {
                specDetailsHtml = `
                    <div class="mt-4 pt-4 border-t border-[#1c1c1c] space-y-4 hidden" id="hc-details-${m.pc_id}">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <!-- Baseline Specs -->
                            <div class="p-3.5 bg-[#050505] border border-[#171717] rounded-lg">
                                <h4 class="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2 border-b border-[#1c1c1c] pb-1 flex items-center gap-1.5">
                                    <span>🔒</span> Baseline Resmi (Terkunci)
                                </h4>
                                ${baselineSpecs ? `
                                    <ul class="text-xs space-y-1.5 font-mono text-neutral-400">
                                        <li><strong class="text-neutral-500">Motherboard:</strong> ${baselineSpecs.MotherboardSerial || 'N/A'}</li>
                                        <li><strong class="text-neutral-500">CPU ID:</strong> ${baselineSpecs.CpuId || 'N/A'}</li>
                                        <li><strong class="text-neutral-500">GPU PNP:</strong> <span class="truncate block max-w-[280px]" title="${baselineSpecs.GpuPnpId || 'N/A'}">${baselineSpecs.GpuPnpId || 'N/A'}</span></li>
                                        <li><strong class="text-neutral-500">RAM Serials:</strong>
                                            <ul class="list-disc pl-4 text-neutral-500 text-[10px] mt-0.5">
                                                ${(baselineSpecs.RamSerials || []).map(r => `<li>${r}</li>`).join('') || '<li>N/A</li>'}
                                            </ul>
                                        </li>
                                        <li><strong class="text-neutral-500">Disks:</strong>
                                            <ul class="list-disc pl-4 text-neutral-500 text-[10px] mt-0.5">
                                                ${(baselineSpecs.DiskSerials || []).map(d => `<li>${d}</li>`).join('') || '<li>N/A</li>'}
                                            </ul>
                                        </li>
                                    </ul>
                                ` : '<p class="text-xs text-neutral-600">Belum ada baseline terdaftar.</p>'}
                            </div>

                            <!-- Current Detected Specs -->
                            <div class="p-3.5 bg-[#050505] border border-[#171717] rounded-lg">
                                <h4 class="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2 border-b border-[#1c1c1c] pb-1 flex items-center gap-1.5">
                                    <span>🔍</span> Terdeteksi Saat Ini (Live Telemetry)
                                </h4>
                                <ul class="text-xs space-y-1.5 font-mono text-neutral-400">
                                    <li><strong class="text-neutral-500">Motherboard:</strong> ${currentSpecs.MotherboardSerial || 'N/A'}</li>
                                    <li><strong class="text-neutral-500">CPU ID:</strong> ${currentSpecs.CpuId || 'N/A'}</li>
                                    <li><strong class="text-neutral-500">GPU PNP:</strong> <span class="truncate block max-w-[280px]" title="${currentSpecs.GpuPnpId || 'N/A'}">${currentSpecs.GpuPnpId || 'N/A'}</span></li>
                                    <li><strong class="text-neutral-500">RAM Serials:</strong>
                                        <ul class="list-disc pl-4 text-neutral-500 text-[10px] mt-0.5">
                                            ${(currentSpecs.RamSerials || []).map(r => `<li>${r}</li>`).join('') || '<li>N/A</li>'}
                                        </ul>
                                    </li>
                                    <li><strong class="text-neutral-500">Disks:</strong>
                                        <ul class="list-disc pl-4 text-neutral-500 text-[10px] mt-0.5">
                                            ${(currentSpecs.DiskSerials || []).map(d => `<li>${d}</li>`).join('') || '<li>N/A</li>'}
                                        </ul>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>`;
            }

            html += `
                <div class="border ${cardBorder} rounded-xl p-4 sm:p-5 lg:p-6 transition-all space-y-4">
                    <!-- Top Bar: Header & Actions (Responsive sm -> 2xl) -->
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-3 border-b border-[#171717]">
                        <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-2">
                                <h4 class="text-base sm:text-lg font-black text-neutral-100 font-mono tracking-wider">${m.pc_kode}</h4>
                                ${hwBadge}
                                ${periphBadge}
                            </div>
                            <div class="text-xs text-neutral-400 mt-1">
                                <span class="font-bold text-neutral-300">${m.cpu_name || '--'}</span> | ${m.gpu_name || '--'} (${m.total_ram || '--'})
                            </div>
                        </div>

                        <div class="flex flex-wrap sm:flex-nowrap items-center gap-2 self-stretch sm:self-auto shrink-0">
                            ${currentSpecs ? `
                                <button id="hc-btn-details-${m.pc_id}" onclick="HardwareChecker.toggleDetails(${m.pc_id})"
                                    class="flex-1 sm:flex-none px-3 py-1.5 bg-[#171717] hover:bg-[#222] border border-[#262626] text-neutral-300 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1">
                                    <span>▼</span> Spesifikasi Lengkap
                                </button>
                            ` : ''}
                            <button onclick="HardwareChecker.registerBaseline(${m.pc_id}, '${m.pc_kode}')"
                                class="flex-1 sm:flex-none px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-black rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 shadow">
                                🔄 Update Baseline
                            </button>
                        </div>
                    </div>

                    <!-- Split Panels on XL & 2XL (7 Cols Internal Specs / 5 Cols Peripherals) -->
                    <div class="grid grid-cols-1 xl:grid-cols-12 gap-4">
                        <!-- Internal Specs Summary (7 Cols) -->
                        <div class="xl:col-span-7 p-3.5 bg-[#070707] border border-[#141414] rounded-xl flex flex-col justify-between space-y-2">
                            <div class="flex items-center justify-between text-xs text-neutral-400 font-bold border-b border-[#141414] pb-1.5">
                                <span>🛠️ Komponen Internal Chassis</span>
                                <span class="text-[11px] font-mono text-neutral-500">${m.motherboard || 'Motherboard'}</span>
                            </div>
                            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono text-neutral-400 pt-1">
                                <div>
                                    <span class="text-[10px] text-neutral-500 block">Processor</span>
                                    <span class="text-neutral-300 truncate block">${m.cpu_name || 'N/A'}</span>
                                </div>
                                <div>
                                    <span class="text-[10px] text-neutral-500 block">Graphics Card</span>
                                    <span class="text-neutral-300 truncate block">${m.gpu_name || 'N/A'}</span>
                                </div>
                                <div>
                                    <span class="text-[10px] text-neutral-500 block">Total Memory</span>
                                    <span class="text-neutral-300 block">${m.total_ram || 'N/A'}</span>
                                </div>
                            </div>
                            <div class="text-[11px] text-neutral-500 pt-1 flex items-center justify-between">
                                <span>Verifikasi Terakhir: <strong class="text-neutral-400">${m.hardware_last_sync || 'Baru saja'}</strong></span>
                                <span class="text-[10px] text-neutral-600">NIC: ${m.nic_speed || '--'}</span>
                            </div>
                        </div>

                        <!-- Peripherals Panel (5 Cols) -->
                        <div class="xl:col-span-5 p-3.5 bg-[#070707] border border-[#141414] rounded-xl space-y-2">
                            <div class="flex items-center justify-between text-xs text-neutral-400 font-bold border-b border-[#141414] pb-1.5">
                                <span>🎧 Periferal Gaming (USB / Audio)</span>
                                <span class="text-[10px] text-neutral-500 font-normal">Grace Period: 5m</span>
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-3 gap-2 pt-1">
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
