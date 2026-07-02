const Monitor = {
    async load() {
        try {
            const result = await window.API.monitor.all();
            if (result.success) {
                this.renderTable(result.data);
            } else {
                Toast.error("Gagal memuat hardware monitor");
            }
        } catch (error) {
            Toast.error("Gagal memuat hardware monitor");
            const container = document.getElementById('monitor-table');
            if (container) container.innerHTML = '<div class="text-center py-10 text-red-400 text-sm">Gagal memuat data.</div>';
        }
    },

    async deleteData(hardwareId, pcKode) {
        Modal.confirm(`Bersihkan data sensor hardware untuk PC ${pcKode}? Data sensor lama akan dihapus dari dashboard (tidak memengaruhi unit PC).`, async () => {
            try {
                const result = await window.API.monitor.delete(hardwareId);
                if (result.success) {
                    Toast.success(`Data sensor PC ${pcKode} berhasil dibersihkan`);
                    this.load();
                } else {
                    Toast.error(result.error || "Gagal menghapus data sensor");
                }
                } catch (error) {
                Toast.error(error.message || "Gagal menghapus data sensor");
            }
        });
    },

    getTempBadge(temp) {
        if (!temp || temp === 0) return `<span class="text-neutral-500 font-mono">-</span>`;
        if (temp >= 78) {
            return `<span class="px-1.5 py-0.5 rounded bg-red-900 border border-red-500 text-red-200 font-mono font-bold text-xs lg:text-base uppercase animate-pulse">🔥 ${temp}°C</span>`;
        }
        if (temp >= 65) {
            return `<span class="px-1.5 py-0.5 rounded border border-amber-600 text-amber-500 font-mono font-bold text-xs lg:text-base">${temp}°C</span>`;
        }
        return `<span class="font-mono text-neutral-300 text-xs lg:text-base font-semibold">${temp}°C</span>`;
    },

    renderTable(data) {
        const container = document.getElementById('monitor-table');
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-neutral-500">
                    <p class="text-base font-bold">Belum Ada Data Monitor</p>
                    <p class="text-xs lg:text-base text-neutral-500 mt-1">Pastikan C# Hardware Monitor Agent berjalan di client</p>
                </div>`;
            return;
        }

        let cardHtml = '';
        let tableRows = '';

        data.forEach(m => {
            const hasWarning = m.health && m.health.has_warning;

            let pcBadge = `<span class="w-1.5 h-1.5 rounded-full bg-neutral-200"></span>`;
            let warningText = '';
            if (hasWarning) {
                pcBadge = `
                    <div class="relative flex h-1.5 w-1.5">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                    </div>`;
                const warningList = m.health.warnings.join(', ');
                warningText = `
                    <div class="text-[10px] lg:text-base text-red-400 mt-1 font-sans font-bold flex items-center gap-1 animate-pulse" title="${warningList}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span class="truncate max-w-[120px] lg:max-w-none">${warningList}</span>
                    </div>`;
            }

            const cpuUsagePct = m.cpu_usage || 0;
            const cpuBar = `
                <div class="flex items-center gap-2">
                    <span class="text-xs lg:text-base text-neutral-200 font-mono font-bold w-8 text-right">${cpuUsagePct.toFixed(0)}%</span>
                    <div class="w-16 bg-neutral-800 rounded-full h-1 overflow-hidden">
                        <div class="bg-neutral-200 h-full" style="width: ${cpuUsagePct}%"></div>
                    </div>
                </div>`;

            const cpuTempBadge = this.getTempBadge(m.cpu_temp);
            const gpuTempBadge = this.getTempBadge(m.gpu_temp);

            let netHtml = '<span class="text-neutral-500 font-mono text-xs lg:text-base">--</span>';
            if (m.nic_speed) {
                if (m.nic_speed.includes('Gbps')) {
                    netHtml = `<span class="px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-300 text-xs lg:text-base font-bold font-mono">1 Gbps</span>`;
                } else {
                    netHtml = `<span class="px-1.5 py-0.5 rounded border border-red-950 text-red-500 text-xs lg:text-base font-bold font-mono">${m.nic_speed}</span>`;
                }
            }

            let formattedDate = 'OFFLINE';
            let updateClass = 'text-neutral-500';

            if (m.last_update) {
                formattedDate = m.last_update;
                if (m.last_update_ts) {
                    const diffSecs = Math.abs((Date.now() - m.last_update_ts) / 1000);
                    if (diffSecs < 15) updateClass = 'text-neutral-200 font-bold';
                    else if (diffSecs < 60) updateClass = 'text-neutral-400 font-medium';
                    else updateClass = 'text-neutral-500';
                }
            }

            const rowClass = hasWarning
                ? 'bg-red-500/5 hover:bg-red-500/10 border-b border-red-500/25 block xl:table-row py-3 xl:py-0 transition-colors'
                : 'hover:bg-[#0c0c0c] border-b border-neutral-700 block xl:table-row py-3 xl:py-0 transition-colors';

            const cardBg = hasWarning ? 'bg-red-500/5 border-red-500/25' : 'bg-[#050505] border-neutral-800';

            // === CARD LAYOUT (<1400px - Mobile to LG, hidden at xl) ===
            cardHtml += `
                <div class="block xl:hidden border rounded ${cardBg} p-3">
                    <!-- Row 1: PC name + Aksi -->
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2 min-w-0">
                            ${pcBadge}
                            <span class="font-bold text-neutral-100 font-mono text-sm truncate">${m.pc_kode}</span>
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                            <span class="text-[10px] font-mono ${updateClass}">${formattedDate}</span>
                            <button onclick="window.Monitor.deleteData(${m.id}, '${m.pc_kode}')" 
                                    class="p-1 rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-all" 
                                    title="Hapus Data Sensor PC ${m.pc_kode}">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <!-- Specs (optional) -->
                    <div class="text-[10px] text-neutral-500 mb-2 truncate">${m.cpu_name || ''}${m.gpu_name ? ' | ' + m.gpu_name : ''}</div>
                    ${warningText}
                    <!-- Row 2: Data chips -->
                    <div class="flex flex-wrap gap-x-3 gap-y-1.5">
                        <div class="flex items-center gap-1">
                            <span class="text-[9px] text-neutral-500 uppercase font-bold">CPU:</span>
                            <span class="text-xs text-neutral-200 font-mono font-bold">${cpuUsagePct.toFixed(0)}%</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <span class="text-[9px] text-neutral-500 uppercase font-bold">CPU T:</span>
                            ${cpuTempBadge.replace('text-xs lg:text-base', 'text-xs')}
                        </div>
                        <div class="flex items-center gap-1">
                            <span class="text-[9px] text-neutral-500 uppercase font-bold">GPU T:</span>
                            ${gpuTempBadge.replace('text-xs lg:text-base', 'text-xs')}
                        </div>
                        <div class="flex items-center gap-1">
                            <span class="text-[9px] text-neutral-500 uppercase font-bold">RAM:</span>
                            <span class="text-xs text-neutral-200 font-mono font-bold">${m.total_ram || '--'}</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <span class="text-[9px] text-neutral-500 uppercase font-bold">NET:</span>
                            ${netHtml.replace('text-xs lg:text-base', 'text-xs')}
                        </div>
                        ${m.active_window && m.active_window !== 'Idle / None' ? `
                        <div class="flex items-center gap-1 w-full mt-0.5 pt-1 border-t border-neutral-800">
                            <span class="text-[9px] text-neutral-500 uppercase font-bold shrink-0">WND:</span>
                            <span class="text-lg text-neutral-400 font-medium truncate" title="${m.active_window}">${m.active_window}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>`;

            // === TABLE ROWS (≥1400px - xl only) ===
            tableRows += `
                <tr class="${rowClass}">
                    <td class="px-2 xl:px-4 py-4 block xl:table-cell">
                        <div class="flex items-center gap-2">
                            ${pcBadge}
                            <span class="font-bold text-neutral-100 font-mono">${m.pc_kode}</span>
                        </div>
                        ${warningText}
                    </td>
                    <td class="px-2 xl:px-4 py-4 block xl:table-cell border-t border-neutral-700/50 xl:border-t-0">
                        <div class="text-xs lg:text-base text-neutral-200 font-semibold" title="Processor">${m.cpu_name || '--'}</div>
                        <div class="text-xs text-neutral-500 mt-1" title="VGA / GPU">${m.gpu_name || '--'}</div>
                        <div class="text-[10px] text-neutral-500 mt-0.5" title="Motherboard">${m.motherboard || ''}</div>
                    </td>
                    <td class="px-2 xl:px-4 py-4 block xl:table-cell text-left max-w-[150px]">
                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider xl:hidden">Active Window</span>
                        <div class="text-lg text-neutral-400 font-medium truncate w-full" title="${m.active_window || '--'}">${m.active_window && m.active_window !== 'Idle / None' ? m.active_window : '--'}</div>
                    </td>
                    <td class="px-2 xl:px-4 py-4 text-center block xl:table-cell">
                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider xl:hidden">CPU Usage</span>
                        ${cpuBar}
                    </td>
                    <td class="px-2 xl:px-4 py-4 text-center block xl:table-cell">
                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider xl:hidden">CPU Temp</span>
                        ${cpuTempBadge}
                    </td>
                    <td class="px-2 xl:px-4 py-4 text-center block xl:table-cell">
                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider xl:hidden">GPU Temp</span>
                        ${gpuTempBadge}
                    </td>
                    <td class="px-2 xl:px-4 py-4 text-center block xl:table-cell">
                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider xl:hidden">RAM</span>
                        <span class="text-xs text-neutral-200 font-mono font-bold">${m.total_ram || '--'}</span>
                    </td>
                    <td class="px-2 xl:px-4 py-4 text-center block xl:table-cell">
                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider xl:hidden">Network</span>
                        ${netHtml}
                    </td>
                    <td class="px-2 xl:px-4 py-4 text-right block xl:table-cell">
                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider xl:hidden">Terakhir Aktif</span>
                        <span class="text-xs font-mono ${updateClass}">${formattedDate}</span>
                    </td>
                    <td class="px-2 xl:px-4 py-4 text-center block xl:table-cell">
                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider xl:hidden">Aksi</span>
                        <button onclick="window.Monitor.deleteData(${m.id}, '${m.pc_kode}')" 
                                class="p-1.5 rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-all" 
                                title="Hapus Data Sensor PC ${m.pc_kode}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </td>
                </tr>`;
        });

        container.innerHTML = `
            <!-- Card Layout (Mobile to LG: <1400px) -->
            <div class="xl:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
                ${cardHtml}
            </div>
            <!-- XL Table Layout (≥1400px) -->
            <div class="hidden xl:block overflow-x-hidden w-full border border-neutral-800 rounded">
                <table class="w-full text-sm">
                    <thead class="hidden xl:table-header-group">
                        <tr class="text-[10px] text-neutral-500 uppercase tracking-wider border-b border-neutral-800 bg-[#0c0c0c]">
                            <th class="px-2 xl:px-4 py-3 text-left font-bold whitespace-nowrap">PC</th>
                            <th class="px-2 xl:px-4 py-3 text-left font-bold whitespace-nowrap">Spesifikasi</th>
                            <th class="px-2 xl:px-4 py-3 text-left font-bold whitespace-nowrap">Active Window</th>
                            <th class="px-2 xl:px-4 py-3 text-center font-bold whitespace-nowrap">CPU Usage</th>
                            <th class="px-2 xl:px-4 py-3 text-center font-bold whitespace-nowrap">CPU Temp</th>
                            <th class="px-2 xl:px-4 py-3 text-center font-bold whitespace-nowrap">GPU Temp</th>
                            <th class="px-2 xl:px-4 py-3 text-center font-bold whitespace-nowrap">RAM</th>
                            <th class="px-2 xl:px-4 py-3 text-center font-bold whitespace-nowrap">Network</th>
                            <th class="px-2 xl:px-4 py-3 text-right font-bold whitespace-nowrap">Terakhir Aktif</th>
                            <th class="px-2 xl:px-4 py-3 text-center font-bold whitespace-nowrap w-12">Aksi</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#1c1c1c] bg-[#050505]">
                        ${tableRows}
                    </tbody>
                </table>
            </div>`;
    }
};

window.Monitor = Monitor;
