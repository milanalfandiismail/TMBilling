const Monitor = {
    _lastFingerprint: null,

    async load(isSilent = false) {
        const container = document.getElementById('monitor-table');
        if (container && !isSilent && (!this._lastData || this._lastData.length === 0) && typeof Skeleton !== 'undefined') {
            container.innerHTML = Skeleton.monitorRows(8);
        }

        try {
            const result = await window.API.monitor.all();
            if (result.success) {
                const data = result.data || [];
                const newFingerprint = JSON.stringify(data.map(d => ({
                    id: d.id,
                    pc: d.pc_kode,
                    cpu_temp: d.cpu_temp,
                    cpu_usage: d.cpu_usage,
                    ram_usage: d.ram_usage,
                    gpu_temp: d.gpu_temp
                })));
                if (isSilent && this._lastFingerprint === newFingerprint) {
                    return; // Data tidak berubah
                }
                this._lastFingerprint = newFingerprint;
                this._lastData = data;

                this.renderTable(data);
            } else if (!isSilent) {
                Toast.error("Gagal memuat hardware monitor");
            }
        } catch (error) {
            if (!isSilent) {
                Toast.error("Gagal memuat hardware monitor");
                if (container) container.innerHTML = '<div class="text-center py-10 text-red-400 text-sm">Gagal memuat data.</div>';
            }
        }
    },

    refreshLive() {
        if (App.currentTab !== 'monitor') return;
        return this.load(true);
    },

    async deleteData(hardwareId, pcKode) {
        if (!confirm(`Apakah Anda yakin ingin membersihkan data sensor hardware untuk PC ${pcKode}? (Tindakan ini hanya menghapus data sensor lama di dashboard, tidak menghapus unit PC)`)) {
            return;
        }
        try {
            const result = await window.API.monitor.delete(hardwareId);
            if (result.success) {
                Toast.success(`Data sensor PC ${pcKode} berhasil dibersihkan`);
                this.load(); // Refresh table
            } else {
                Toast.error(result.error || "Gagal menghapus data sensor");
            }
        } catch (error) {
            Toast.error(error.message || "Gagal menghapus data sensor");
        }
    },

    getTempBadge(temp) {
        if (!temp || temp === 0) return `<span class="text-neutral-600 font-mono text-xs xl:text-sm">-</span>`;
        if (temp >= 80) {
            return `<span class="px-2 py-0.5 rounded border border-red-800/50 bg-red-950/60 text-red-400 font-mono font-bold text-xs xl:text-sm inline-block min-w-[54px] text-center">${temp}°C</span>`;
        }
        if (temp >= 65) {
            return `<span class="px-2 py-0.5 rounded border border-amber-800/40 bg-amber-950/40 text-amber-400 font-mono font-bold text-xs xl:text-sm inline-block min-w-[54px] text-center">${temp}°C</span>`;
        }
        return `<span class="font-mono text-neutral-300 font-semibold text-xs xl:text-sm inline-block min-w-[54px] text-center">${temp}°C</span>`;
    },

    renderTable(data) {
        const container = document.getElementById('monitor-table');
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-neutral-500">
                    <p class="text-base font-bold">Belum Ada Data Monitor</p>
                    <p class="text-xs lg:text-base text-neutral-600 mt-1">Pastikan C# Hardware Monitor Agent berjalan di client</p>
                </div>`;
            return;
        }

        // Sort data naturally by pc_kode
        data.sort((a, b) => (a.pc_kode || '').localeCompare(b.pc_kode || '', undefined, { numeric: true, sensitivity: 'base' }));

        let cardHtml = '';
        let tableRows = '';

        data.forEach(m => {
            const hasWarning = m.health && m.health.has_warning;

            let pcBadge = `<span class="w-2 h-2 rounded-full bg-neutral-400 shrink-0"></span>`;
            let warningIndicator = '';
            if (hasWarning) {
                const warningList = (m.health.warnings || []).join(' • ');
                pcBadge = `
                    <div class="relative flex h-2 w-2 shrink-0">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </div>`;
                warningIndicator = `
                    <span class="px-1.5 py-0.5 rounded bg-red-950/80 border border-red-800/60 text-red-400 text-[10px] font-bold inline-flex items-center gap-1 cursor-help" title="${Utils.escapeHtml(warningList)}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>Perhatian</span>
                    </span>`;
            }

            const cpuUsagePct = m.cpu_usage || 0;
            const cpuBar = `
                <div class="flex items-center justify-center gap-2">
                    <span class="text-xs xl:text-sm text-neutral-200 font-mono font-bold w-9 text-right">${cpuUsagePct.toFixed(0)}%</span>
                    <div class="w-14 xl:w-16 bg-neutral-800 rounded-full h-1.5 overflow-hidden shrink-0">
                        <div class="bg-neutral-200 h-full" style="width: ${cpuUsagePct}%"></div>
                    </div>
                </div>`;

            const cpuTempBadge = this.getTempBadge(m.cpu_temp);
            const gpuTempBadge = this.getTempBadge(m.gpu_temp);

            let netHtml = '<span class="text-neutral-600 font-mono text-xs xl:text-sm">-</span>';
            if (m.nic_speed) {
                if (m.nic_speed.includes('Gbps')) {
                    netHtml = `<span class="px-1.5 py-0.5 rounded border border-[#262626] bg-[#121212] text-neutral-300 text-xs xl:text-sm font-bold font-mono">1 Gbps</span>`;
                } else {
                    netHtml = `<span class="px-1.5 py-0.5 rounded border border-red-950 bg-red-950/30 text-red-400 text-xs xl:text-sm font-bold font-mono">${m.nic_speed}</span>`;
                }
            }

            let formattedDate = 'OFFLINE';
            let updateClass = 'text-neutral-600';

            if (m.last_update) {
                formattedDate = m.last_update;
                if (m.last_update_ts) {
                    const diffSecs = Math.abs((Date.now() - m.last_update_ts) / 1000);
                    if (diffSecs < 15) updateClass = 'text-neutral-200 font-bold';
                    else if (diffSecs < 60) updateClass = 'text-neutral-400 font-medium';
                    else updateClass = 'text-neutral-600';
                }
            }

            const rowClass = hasWarning
                ? 'bg-red-500/5 hover:bg-red-500/10 border-b border-red-500/25 transition-colors'
                : 'hover:bg-[#0c0c0c] border-b border-[#1c1c1c] transition-colors';

            const cardBg = hasWarning ? 'bg-red-500/5 border-red-500/25' : 'bg-[#050505] border-[#1c1c1c]';

            // === CARD LAYOUT (<1280px - Mobile / Tablet / Laptop kecil, hidden at xl) ===
            cardHtml += `
                <div class="border rounded ${cardBg} p-3.5 space-y-2.5">
                    <!-- Header Card: PC Name + Warning Badge + Timestamp & Aksi -->
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2 min-w-0">
                            ${pcBadge}
                            <span class="font-bold text-neutral-100 font-mono text-sm sm:text-base">${m.pc_kode}</span>
                            ${warningIndicator}
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                            <span class="text-[10px] sm:text-xs font-mono ${updateClass}">${formattedDate}</span>
                            <button onclick="window.Monitor.deleteData(${m.id}, '${m.pc_kode}')" 
                                    class="p-1 rounded text-neutral-500 hover:text-red-400 hover:bg-[#121212] transition-all" 
                                    title="Hapus Data Sensor PC ${m.pc_kode}">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <!-- Specs -->
                    <div class="text-[11px] text-neutral-500 truncate">${m.cpu_name || ''}${m.gpu_name ? ' • ' + m.gpu_name : ''}</div>
                    
                    <!-- Data Chips Grid -->
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-[#1c1c1c]">
                        <div class="flex items-center justify-between bg-[#0a0a0a] p-1.5 rounded border border-[#181818]">
                            <span class="text-[9px] text-neutral-500 uppercase font-bold">CPU</span>
                            <span class="text-xs text-neutral-200 font-mono font-bold">${cpuUsagePct.toFixed(0)}%</span>
                        </div>
                        <div class="flex items-center justify-between bg-[#0a0a0a] p-1.5 rounded border border-[#181818]">
                            <span class="text-[9px] text-neutral-500 uppercase font-bold">CPU Temp</span>
                            ${cpuTempBadge}
                        </div>
                        <div class="flex items-center justify-between bg-[#0a0a0a] p-1.5 rounded border border-[#181818]">
                            <span class="text-[9px] text-neutral-500 uppercase font-bold">GPU Temp</span>
                            ${gpuTempBadge}
                        </div>
                        <div class="flex items-center justify-between bg-[#0a0a0a] p-1.5 rounded border border-[#181818]">
                            <span class="text-[9px] text-neutral-500 uppercase font-bold">RAM</span>
                            <span class="text-xs text-neutral-200 font-mono font-bold">${m.total_ram || '--'}</span>
                        </div>
                        <div class="flex items-center justify-between bg-[#0a0a0a] p-1.5 rounded border border-[#181818]">
                            <span class="text-[9px] text-neutral-500 uppercase font-bold">NET</span>
                            ${netHtml}
                        </div>
                    </div>
                    ${m.active_window && m.active_window !== 'Idle / None' ? `
                    <div class="flex items-center gap-1.5 pt-1 border-t border-[#181818]">
                        <span class="text-[9px] text-neutral-500 uppercase font-bold shrink-0">WND:</span>
                        <span class="text-xs text-neutral-400 font-medium truncate" title="${Utils.escapeHtml(m.active_window)}">${Utils.escapeHtml(m.active_window)}</span>
                    </div>
                    ` : ''}
                </div>`;

            // === TABLE ROWS (≥1280px - XL & 2XL) ===
            tableRows += `
                <tr class="${rowClass}">
                    <td class="px-3 xl:px-4 py-3.5 w-36 min-w-[130px]">
                        <div class="flex items-center gap-2">
                            ${pcBadge}
                            <span class="font-bold text-neutral-100 font-mono text-sm xl:text-base">${m.pc_kode}</span>
                        </div>
                        ${warningIndicator ? `<div class="mt-1">${warningIndicator}</div>` : ''}
                    </td>
                    <td class="px-3 xl:px-4 py-3.5 min-w-[180px] xl:min-w-[220px]">
                        <div class="text-xs xl:text-sm text-neutral-200 font-semibold truncate max-w-[240px]" title="${Utils.escapeHtml(m.cpu_name || '--')}">${m.cpu_name || '--'}</div>
                        <div class="text-[11px] xl:text-xs text-neutral-500 mt-0.5 truncate max-w-[240px]" title="${Utils.escapeHtml(m.gpu_name || '--')}">${m.gpu_name || '--'}</div>
                        ${m.motherboard ? `<div class="text-[10px] text-neutral-600 mt-0.5 truncate max-w-[240px]" title="${Utils.escapeHtml(m.motherboard)}">${m.motherboard}</div>` : ''}
                    </td>
                    <td class="px-3 xl:px-4 py-3.5 text-left w-44 max-w-[180px]">
                        <div class="text-xs xl:text-sm text-neutral-400 font-medium truncate w-full" title="${Utils.escapeHtml(m.active_window || '--')}">${m.active_window && m.active_window !== 'Idle / None' ? Utils.escapeHtml(m.active_window) : '--'}</div>
                    </td>
                    <td class="px-3 xl:px-4 py-3.5 text-center w-28">
                        ${cpuBar}
                    </td>
                    <td class="px-3 xl:px-4 py-3.5 text-center w-24">
                        ${cpuTempBadge}
                    </td>
                    <td class="px-3 xl:px-4 py-3.5 text-center w-24">
                        ${gpuTempBadge}
                    </td>
                    <td class="px-3 xl:px-4 py-3.5 text-center w-20">
                        <span class="text-xs xl:text-sm text-neutral-200 font-mono font-bold">${m.total_ram || '--'}</span>
                    </td>
                    <td class="px-3 xl:px-4 py-3.5 text-center w-24">
                        ${netHtml}
                    </td>
                    <td class="px-3 xl:px-4 py-3.5 text-right w-32">
                        <span class="text-xs xl:text-sm font-mono ${updateClass}">${formattedDate}</span>
                    </td>
                    <td class="px-3 xl:px-4 py-3.5 text-center w-14">
                        <button onclick="window.Monitor.deleteData(${m.id}, '${m.pc_kode}')" 
                                class="p-1.5 rounded text-neutral-500 hover:text-red-400 hover:bg-[#121212] transition-all" 
                                title="Hapus Data Sensor PC ${m.pc_kode}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </td>
                </tr>`;
        });

        container.innerHTML = `
            <!-- Card Layout (Mobile / Tablet / Laptop kecil: <1280px) -->
            <div class="xl:hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                ${cardHtml}
            </div>
            <!-- XL & 2XL Table Layout (≥1280px) -->
            <div class="hidden xl:block overflow-x-auto w-full border border-[#1c1c1c] rounded">
                <table class="w-full text-xs xl:text-sm table-auto">
                    <thead>
                        <tr class="text-[10px] xl:text-xs text-neutral-500 uppercase tracking-wider border-b border-[#1c1c1c] bg-[#0c0c0c]">
                            <th class="px-3 xl:px-4 py-3 text-left font-bold whitespace-nowrap w-36 min-w-[130px]">PC</th>
                            <th class="px-3 xl:px-4 py-3 text-left font-bold whitespace-nowrap min-w-[180px] xl:min-w-[220px]">Spesifikasi</th>
                            <th class="px-3 xl:px-4 py-3 text-left font-bold whitespace-nowrap w-44 max-w-[180px]">Active Window</th>
                            <th class="px-3 xl:px-4 py-3 text-center font-bold whitespace-nowrap w-28">CPU Usage</th>
                            <th class="px-3 xl:px-4 py-3 text-center font-bold whitespace-nowrap w-24">CPU Temp</th>
                            <th class="px-3 xl:px-4 py-3 text-center font-bold whitespace-nowrap w-24">GPU Temp</th>
                            <th class="px-3 xl:px-4 py-3 text-center font-bold whitespace-nowrap w-20">RAM</th>
                            <th class="px-3 xl:px-4 py-3 text-center font-bold whitespace-nowrap w-24">Network</th>
                            <th class="px-3 xl:px-4 py-3 text-right font-bold whitespace-nowrap w-32">Terakhir Aktif</th>
                            <th class="px-3 xl:px-4 py-3 text-center font-bold whitespace-nowrap w-14">Aksi</th>
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
