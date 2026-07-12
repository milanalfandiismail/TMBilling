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
                container.innerHTML = '<div class="text-center py-10 text-red-400 text-sm">Gagal memuat data.</div>';
            }
        }
    },

    async registerBaseline(pcId, pcKode) {
        if (!confirm(`Apakah Anda yakin ingin memperbarui baseline hardware untuk PC ${pcKode}? Gunakan tombol ini HANYA jika Anda (Owner/Admin) baru saja melakukan upgrade/perubahan komponen secara fisik pada PC ${pcKode}.`)) {
            return;
        }
        try {
            Toast.success("Memperbarui baseline hardware...");
            const res = await API.request(`/api/v1/kasir/monitor/register/${pcId}`, {
                method: 'POST'
            });
            if (res && res.success) {
                Toast.success(`Baseline hardware PC ${pcKode} berhasil diperbarui!`);
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
                if (btn) btn.innerText = "Sembunyikan Spesifikasi";
            } else {
                el.classList.add('hidden');
                if (btn) btn.innerText = "Lihat Spesifikasi Lengkap";
            }
        }
    },

    render(data) {
        const container = document.getElementById('hardware-checker-container');
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-neutral-500">
                    <p class="text-base font-bold">Belum Ada Data Monitor PC</p>
                    <p class="text-xs text-neutral-600 mt-1">Pastikan C# Hardware Monitor Agent berjalan di client</p>
                </div>`;
            return;
        }

        let html = '';

        data.forEach(m => {
            const hasBaseline = !!m.hardware_baseline;
            const isMismatch = m.hardware_mismatch === true;
            
            let statusBadge = '';
            let cardBorder = 'border-[#1c1c1c] bg-[#0c0c0c]';
            let alertPanel = '';
            let syncTimeHtml = '';

            if (isMismatch) {
                cardBorder = 'border-red-500/50 bg-red-950/10 shadow-lg shadow-red-950/20';
                statusBadge = `
                    <span class="px-2.5 py-1 rounded bg-red-900/60 border border-red-500 text-red-200 text-[10px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1">
                        🚨 Swapped / Stolen Alert
                    </span>`;
                alertPanel = `
                    <div class="p-4 bg-red-950/30 border border-red-500/20 rounded-lg text-sm text-red-200 space-y-2 mt-4">
                        <div class="flex items-center gap-2 font-bold text-red-400">
                            <span>⚠️ DETEKSI PERUBAHAN HARDWARE:</span>
                        </div>
                        <p class="font-mono text-xs pl-2 border-l-2 border-red-500 bg-red-950/40 p-2 rounded text-red-300">${m.hardware_mismatch_desc || 'Unknown mismatch'}</p>
                        <div class="text-[11px] text-neutral-400 mt-2">
                            🎥 <strong class="text-neutral-300">Waktu Kejadian (Referensi CCTV):</strong> ${m.hardware_mismatch_time || '--:--'}
                        </div>
                    </div>`;
            } else if (hasBaseline) {
                statusBadge = `
                    <span class="px-2.5 py-1 rounded bg-green-950/60 border border-green-500/60 text-green-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                        🛡️ Aman (Protected)
                    </span>`;
                syncTimeHtml = `
                    <div class="text-xs text-neutral-500 mt-1">
                        Verifikasi Terakhir: <span class="font-mono font-bold text-neutral-300">${m.hardware_last_sync || 'Baru saja'}</span>
                    </div>`;
            } else {
                statusBadge = `
                    <span class="px-2.5 py-1 rounded bg-amber-900/50 border border-amber-600/50 text-amber-300 text-[10px] font-black uppercase tracking-wider">
                        ⚙️ Menunggu Telemetry...
                    </span>`;
            }

            // Parsing Baseline dan Current Specs JSON
            let baselineSpecs = null;
            let currentSpecs = null;
            try {
                if (m.hardware_baseline) baselineSpecs = JSON.parse(m.hardware_baseline);
                if (m.hardware_current_specs) currentSpecs = JSON.parse(m.hardware_current_specs);
            } catch (err) {}

            let specDetailsHtml = '';
            if (currentSpecs) {
                specDetailsHtml = `
                    <div class="mt-4 pt-4 border-t border-[#1c1c1c] space-y-4 hidden" id="hc-details-${m.pc_id}">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <!-- Baseline Specs -->
                            <div class="p-3 bg-[#050505] border border-[#171717] rounded-lg">
                                <h4 class="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2 border-b border-[#1c1c1c] pb-1 flex items-center gap-1">
                                    <span>🔒</span> Baseline Terkunci
                                </h4>
                                ${baselineSpecs ? `
                                    <ul class="text-xs space-y-1.5 font-mono text-neutral-500">
                                        <li><strong class="text-neutral-400">Motherboard:</strong> ${baselineSpecs.MotherboardSerial || 'N/A'}</li>
                                        <li><strong class="text-neutral-400">CPU ID:</strong> ${baselineSpecs.CpuId || 'N/A'}</li>
                                        <li><strong class="text-neutral-400">GPU PNP:</strong> <span class="truncate block max-w-[280px]" title="${baselineSpecs.GpuPnpId || 'N/A'}">${baselineSpecs.GpuPnpId || 'N/A'}</span></li>
                                        <li><strong class="text-neutral-400">RAM Serials:</strong>
                                            <ul class="list-disc pl-4 text-neutral-500 text-[10px] mt-0.5">
                                                ${(baselineSpecs.RamSerials || []).map(r => `<li>${r}</li>`).join('') || '<li>N/A</li>'}
                                            </ul>
                                        </li>
                                        <li><strong class="text-neutral-400">Disks:</strong>
                                            <ul class="list-disc pl-4 text-neutral-500 text-[10px] mt-0.5">
                                                ${(baselineSpecs.DiskSerials || []).map(d => `<li>${d}</li>`).join('') || '<li>N/A</li>'}
                                            </ul>
                                        </li>
                                    </ul>
                                ` : '<p class="text-xs text-neutral-600">Belum ada baseline terdaftar.</p>'}
                            </div>

                            <!-- Current Specs -->
                            <div class="p-3 bg-[#050505] border border-[#171717] rounded-lg">
                                <h4 class="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2 border-b border-[#1c1c1c] pb-1 flex items-center gap-1">
                                    <span>🔍</span> Terdeteksi Saat Ini
                                </h4>
                                <ul class="text-xs space-y-1.5 font-mono text-neutral-500">
                                    <li><strong class="text-neutral-400">Motherboard:</strong> ${currentSpecs.MotherboardSerial || 'N/A'}</li>
                                    <li><strong class="text-neutral-400">CPU ID:</strong> ${currentSpecs.CpuId || 'N/A'}</li>
                                    <li><strong class="text-neutral-400">GPU PNP:</strong> <span class="truncate block max-w-[280px]" title="${currentSpecs.GpuPnpId || 'N/A'}">${currentSpecs.GpuPnpId || 'N/A'}</span></li>
                                    <li><strong class="text-neutral-400">RAM Serials:</strong>
                                        <ul class="list-disc pl-4 text-neutral-500 text-[10px] mt-0.5">
                                            ${(currentSpecs.RamSerials || []).map(r => `<li>${r}</li>`).join('') || '<li>N/A</li>'}
                                        </ul>
                                    </li>
                                    <li><strong class="text-neutral-400">Disks:</strong>
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
                <div class="border ${cardBorder} rounded-xl p-5 transition-all">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <!-- Left Info -->
                        <div class="min-w-0">
                            <div class="flex items-center gap-2.5">
                                <h4 class="text-lg font-black text-neutral-100 font-mono tracking-wider">${m.pc_kode}</h4>
                                ${statusBadge}
                            </div>
                            <div class="text-xs text-neutral-400 mt-1">
                                <span class="font-bold text-neutral-300">${m.cpu_name || '--'}</span> | ${m.gpu_name || '--'} (${m.total_ram || '--'})
                            </div>
                            ${syncTimeHtml}
                        </div>

                        <!-- Right Actions -->
                        <div class="flex items-center gap-2 self-start sm:self-center shrink-0">
                            ${currentSpecs ? `
                                <button id="hc-btn-details-${m.pc_id}" onclick="HardwareChecker.toggleDetails(${m.pc_id})"
                                    class="px-3 py-1.5 bg-[#171717] hover:bg-[#222] border border-[#262626] text-neutral-300 rounded-lg text-xs font-bold transition-all">
                                    Lihat Spesifikasi Lengkap
                                </button>
                            ` : ''}
                            <button onclick="HardwareChecker.registerBaseline(${m.pc_id}, '${m.pc_kode}')"
                                class="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-black rounded-lg text-xs font-black transition-all flex items-center gap-1">
                                🔄 Update Baseline
                            </button>
                        </div>
                    </div>

                    <!-- Alert Panel -->
                    ${alertPanel}

                    <!-- Collapsible Details -->
                    ${specDetailsHtml}
                </div>`;
        });

        container.innerHTML = html;
    }
};

window.HardwareChecker = HardwareChecker;
