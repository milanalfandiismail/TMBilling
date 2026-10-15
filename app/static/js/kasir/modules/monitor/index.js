const Monitor = {
    _lastFingerprint: null,
    filterGroup: 'all',

    populateGroupFilter(data) {
        const select = document.getElementById('monitor-group-filter');
        if (!select) return;

        const currentVal = select.value || this.filterGroup || 'all';
        const groupMap = new Map();

        (data || []).forEach(m => {
            const gid = m.pc_grup_id !== null && m.pc_grup_id !== undefined ? String(m.pc_grup_id) : '0';
            const gname = m.pc_grup_nama || 'REGULER';
            if (!groupMap.has(gid)) {
                groupMap.set(gid, { id: Number(gid), name: gname });
            }
        });

        const sortedGroups = Array.from(groupMap.values()).sort((a, b) => a.id - b.id);

        let optionsHtml = '<option value="all">Semua Grup</option>';
        sortedGroups.forEach(g => {
            optionsHtml += `<option value="${g.id}">${Utils.escapeHtml(g.name.toUpperCase())}</option>`;
        });

        select.innerHTML = optionsHtml;
        if (sortedGroups.some(g => String(g.id) === currentVal) || currentVal === 'all') {
            select.value = currentVal;
            this.filterGroup = currentVal;
        } else {
            select.value = 'all';
            this.filterGroup = 'all';
        }
    },

    onGroupFilterChange(val) {
        this.filterGroup = val;
        this._lastFingerprint = null;
        if (this._lastData && this._lastData.length > 0) {
            this.renderTable(this._lastData);
        }
    },

    async load(isSilent = false) {
        const container = document.getElementById('monitor-table');
        if (container && !isSilent && (!this._lastData || this._lastData.length === 0) && typeof Skeleton !== 'undefined') {
            container.innerHTML = Skeleton.monitorRows(8);
        }

        try {
            const result = await window.API.monitor.all();
            if (result.success) {
                const data = result.data || [];
                this.populateGroupFilter(data);

                const newFingerprint = JSON.stringify(data.map(d => ({
                    id: d.id,
                    pc: d.pc_kode,
                    cpu_temp: d.cpu_temp,
                    cpu_usage: d.cpu_usage,
                    ram_usage: d.ram_usage,
                    gpu_temp: d.gpu_temp
                }))) + `_group_${this.filterGroup}`;
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

    getCpuTempBadge(temp) {
        if (!temp || temp === 0) return `<span class="text-neutral-600 font-mono text-[8px] sm:text-xs xl:text-sm inline-block min-w-[28px] sm:min-w-[54px] text-center">-</span>`;
        return `<span class="px-0.5 sm:px-2 py-0.2 sm:py-0.5 rounded border border-cyan-800/60 bg-cyan-950/60 text-cyan-300 font-mono font-bold text-[8px] sm:text-xs xl:text-sm inline-block min-w-[28px] sm:min-w-[54px] text-center">${temp}°C</span>`;
    },

    getGpuTempBadge(temp) {
        if (!temp || temp === 0) return `<span class="text-neutral-600 font-mono text-[8px] sm:text-xs xl:text-sm inline-block min-w-[28px] sm:min-w-[54px] text-center">-</span>`;
        return `<span class="px-0.5 sm:px-2 py-0.2 sm:py-0.5 rounded border border-amber-800/60 bg-amber-950/60 text-amber-300 font-mono font-bold text-[8px] sm:text-xs xl:text-sm inline-block min-w-[28px] sm:min-w-[54px] text-center">${temp}°C</span>`;
    },

    getTempBadge(temp) {
        return this.getCpuTempBadge(temp);
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

        // Sort data by group and pc_kode
        const sortedData = [...data].sort((a, b) => {
            const grupA = Number(a.pc_grup_id || 0);
            const grupB = Number(b.pc_grup_id || 0);
            if (grupA !== grupB) return grupA - grupB;
            return (a.pc_kode || '').localeCompare(b.pc_kode || '', undefined, { numeric: true, sensitivity: 'base' });
        });

        const effectiveData = this.filterGroup !== 'all'
            ? sortedData.filter(m => String(m.pc_grup_id || '0') === String(this.filterGroup))
            : sortedData;

        if (effectiveData.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-16 text-neutral-500 space-y-2">
                    <span class="text-2xl mb-1">🔍</span>
                    <p class="text-xs lg:text-sm font-bold text-neutral-200 uppercase tracking-wider">Tidak Ada PC Pada Grup Ini</p>
                    <p class="text-[10px] lg:text-xs text-neutral-500">Silakan pilih grup lain pada filter di atas</p>
                </div>`;
            return;
        }

        // Grouping berdasarkan pc_grup_id
        const groupMap = new Map();
        effectiveData.forEach(m => {
            const gid = m.pc_grup_id !== null && m.pc_grup_id !== undefined ? String(m.pc_grup_id) : '0';
            const gname = m.pc_grup_nama || 'REGULER';
            if (!groupMap.has(gid)) {
                groupMap.set(gid, { id: Number(gid), name: gname, items: [] });
            }
            groupMap.get(gid).items.push(m);
        });

        const sortedGroupEntries = Array.from(groupMap.values()).sort((a, b) => a.id - b.id);

        let tableRows = '';

        sortedGroupEntries.forEach((g, groupIndex) => {
            tableRows += `
                <tr class="bg-[#080808]/90 border-b border-[#202020]">
                    <td colspan="12" class="px-3 xl:px-4 ${groupIndex > 0 ? 'pt-8 sm:pt-9' : 'pt-3.5 sm:pt-4'} pb-2.5">
                        <div class="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-[#141414] border border-[#262626] shadow-sm">
                            <span class="text-xs sm:text-sm font-black font-mono tracking-wider text-neutral-100 uppercase">${Utils.escapeHtml(g.name)}</span>
                            <span class="text-neutral-500 text-xs font-mono">&bull;</span>
                            <span class="px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-800/60 text-cyan-300 font-mono text-[11px] sm:text-xs font-bold uppercase tracking-wider">${g.items.length} UNIT</span>
                        </div>
                    </td>
                </tr>`;

            g.items.forEach(m => {
                const cpuUsagePct = m.cpu_usage || 0;
                const cpuBar = `
                    <div class="flex items-center justify-center gap-1 sm:gap-1.5">
                        <span class="text-[10px] sm:text-xs xl:text-sm text-neutral-200 font-mono font-bold w-6 sm:w-9 text-right">${cpuUsagePct.toFixed(0)}%</span>
                        <div class="hidden sm:block w-8 sm:w-12 xl:w-16 bg-neutral-800 rounded-full h-1.5 overflow-hidden shrink-0">
                            <div class="bg-neutral-200 h-full" style="width: ${cpuUsagePct}%"></div>
                        </div>
                    </div>`;

                const cpuTempBadge = this.getCpuTempBadge(m.cpu_temp);
                const gpuTempBadge = this.getGpuTempBadge(m.gpu_temp);

                let netHtml = '<span class="text-neutral-600 font-mono text-[9px] sm:text-xs xl:text-sm whitespace-nowrap">-</span>';
                if (m.nic_speed) {
                    const speedText = String(m.nic_speed).replace(/\s+/g, ' ').trim();
                    const isGigabit = speedText.includes('Gbps') || speedText === '1000 Mbps';
                    if (isGigabit) {
                        netHtml = `<span class="px-1 sm:px-2 py-0.2 sm:py-0.5 rounded border border-[#262626] bg-[#121212] text-neutral-300 text-[8.5px] sm:text-xs xl:text-sm font-bold font-mono whitespace-nowrap inline-flex items-center justify-center shrink-0"><span class="sm:hidden">1G</span><span class="hidden sm:inline">1 Gbps</span></span>`;
                    } else {
                        netHtml = `<span class="px-1 sm:px-2 py-0.2 sm:py-0.5 rounded border border-red-950 bg-red-950/30 text-red-400 text-[8.5px] sm:text-xs xl:text-sm font-bold font-mono whitespace-nowrap inline-flex items-center justify-center shrink-0">${Utils.escapeHtml(speedText)}</span>`;
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

                const rowClass = 'hover:bg-[#0c0c0c] border-b border-[#1c1c1c] transition-colors';

                // === TABLE ROWS (1 Baris per PC di Semua Breakpoint: sm, md, lg, xl, 2xl) ===
                tableRows += `
                    <tr class="${rowClass}">
                        <td class="px-1 sm:px-2 xl:px-4 py-1.5 sm:py-2 xl:py-3.5 whitespace-nowrap min-w-[38px] sm:min-w-[70px] xl:min-w-[120px]">
                            <span class="font-bold text-neutral-100 font-mono text-[11px] sm:text-sm xl:text-base">${Utils.escapeHtml(m.pc_kode)}</span>
                        </td>
                        <td class="px-1 sm:px-2 xl:px-4 py-1.5 sm:py-2 xl:py-3.5 min-w-[55px] sm:min-w-[120px] max-w-[68px] sm:max-w-[220px]">
                            <div class="text-[10px] sm:text-xs xl:text-sm text-cyan-400 font-semibold truncate" title="${Utils.escapeHtml(m.cpu_name || '--')}">${m.cpu_name || '--'}</div>
                            <div class="text-[9px] sm:text-[11px] xl:text-xs text-amber-400 font-semibold mt-0.5 truncate" title="${Utils.escapeHtml(m.gpu_name || '--')}">${m.gpu_name || '--'}</div>
                            <!-- Active Window for < 2xl -->
                            <div class="hidden sm:flex 2xl:hidden text-[10px] xl:text-[11px] text-neutral-400 mt-0.5 truncate items-center gap-1" title="${Utils.escapeHtml(m.active_window || '--')}">
                                <span class="text-neutral-500">🪟</span> <span>${m.active_window && m.active_window !== 'Idle / None' ? Utils.escapeHtml(m.active_window) : '--'}</span>
                            </div>
                            ${m.motherboard ? `<div class="hidden xl:block text-[10px] text-neutral-600 mt-0.5 truncate" title="${Utils.escapeHtml(m.motherboard)}">${m.motherboard}</div>` : ''}
                        </td>
                        <!-- Separate Active Window column for ≥ 2xl -->
                        <td class="hidden 2xl:table-cell px-3 xl:px-4 py-3.5 text-left w-44 max-w-[180px]">
                            <div class="text-xs xl:text-sm text-neutral-400 font-medium truncate w-full" title="${Utils.escapeHtml(m.active_window || '--')}">${m.active_window && m.active_window !== 'Idle / None' ? Utils.escapeHtml(m.active_window) : '--'}</div>
                        </td>
                        <td class="px-0.5 sm:px-1.5 xl:px-4 py-1.5 sm:py-2 xl:py-3.5 text-center w-12 sm:w-20 xl:w-28 whitespace-nowrap">
                            ${cpuBar}
                            <!-- Compact Suhu inside CPU cell on small screens (< md: sm) -->
                            <div class="md:hidden mt-0.5 sm:mt-1 flex items-center justify-center gap-0.5 sm:gap-1">
                                ${cpuTempBadge}
                                ${gpuTempBadge}
                            </div>
                        </td>
                        <!-- Suhu Combined for md, lg, xl (hidden on < md, separate on ≥ 2xl) -->
                        <td class="hidden md:table-cell 2xl:hidden px-1.5 xl:px-3 py-2 xl:py-3.5 text-center whitespace-nowrap w-16 xl:w-24">
                            <div class="flex flex-col items-center gap-1">
                                ${cpuTempBadge}
                                ${gpuTempBadge}
                            </div>
                        </td>
                        <!-- Separate Temps (≥ 2xl) -->
                        <td class="hidden 2xl:table-cell px-3 xl:px-4 py-3.5 text-center w-24 whitespace-nowrap">
                            ${cpuTempBadge}
                        </td>
                        <td class="hidden 2xl:table-cell px-3 xl:px-4 py-3.5 text-center w-24 whitespace-nowrap">
                            ${gpuTempBadge}
                        </td>
                        <!-- RAM & Net Combined (< 2xl: sm, md, lg, xl) -->
                        <td class="2xl:hidden px-0.5 sm:px-1.5 xl:px-3 py-1.5 sm:py-2 xl:py-3.5 text-center whitespace-nowrap w-10 sm:w-16 xl:w-24">
                            <div class="text-[10px] sm:text-xs xl:text-sm text-neutral-200 font-mono font-bold">${m.total_ram || '--'}</div>
                            <div class="mt-0.5 sm:mt-1 flex items-center justify-center">${netHtml}</div>
                        </td>
                        <!-- Separate RAM & Net (≥ 2xl) -->
                        <td class="hidden 2xl:table-cell px-3 xl:px-4 py-3.5 text-center w-20 whitespace-nowrap">
                            <span class="text-xs xl:text-sm text-neutral-200 font-mono font-bold">${m.total_ram || '--'}</span>
                        </td>
                        <td class="hidden 2xl:table-cell px-3 xl:px-4 py-3.5 text-center w-28 whitespace-nowrap">
                            ${netHtml}
                        </td>
                        <!-- Terakhir Aktif (visible ≥ lg: 1024px+) -->
                        <td class="hidden lg:table-cell px-2 xl:px-4 py-2 xl:py-3.5 text-right whitespace-nowrap min-w-[85px] xl:w-32">
                            <span class="text-[11px] xl:text-xs font-mono ${updateClass}">${formattedDate}</span>
                        </td>
                        <td class="px-0.5 sm:px-1.5 xl:px-4 py-1.5 sm:py-2 xl:py-3.5 text-center w-8 sm:w-12 whitespace-nowrap">
                            <button onclick="window.Monitor.deleteData(${m.id}, '${m.pc_kode}')" 
                                    class="p-1 sm:p-1.5 rounded text-neutral-500 hover:text-red-400 hover:bg-[#121212] transition-all" 
                                    title="Hapus Data Sensor PC ${m.pc_kode} (Terakhir: ${formattedDate})">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </td>
                    </tr>`;
            });
        });

        container.innerHTML = `
            <!-- Unified 1-Row Table Layout di Semua Breakpoint (sm, md, lg, xl, 2xl) -->
            <div class="overflow-x-auto w-full border border-[#1c1c1c] rounded scrollbar-thin">
                <table class="w-full text-xs xl:text-sm">
                    <thead>
                        <tr class="text-[9px] sm:text-[10px] xl:text-xs text-neutral-500 uppercase tracking-wider border-b border-[#1c1c1c] bg-[#0c0c0c]">
                            <th class="px-1 sm:px-2 xl:px-4 py-1.5 sm:py-2 xl:py-3 text-left font-bold whitespace-nowrap min-w-[38px] sm:min-w-[70px] xl:min-w-[120px]">PC</th>
                            <th class="px-1 sm:px-2 xl:px-4 py-1.5 sm:py-2 xl:py-3 text-left font-bold min-w-[55px] sm:min-w-[130px]">Spesifikasi</th>
                            <th class="hidden 2xl:table-cell px-3 xl:px-4 py-3 text-left font-bold whitespace-nowrap w-44 max-w-[180px]">Active Window</th>
                            <th class="px-0.5 sm:px-1.5 xl:px-4 py-1.5 sm:py-2 xl:py-3 text-center font-bold whitespace-nowrap w-12 sm:w-20 xl:w-28">CPU Usage</th>
                            <!-- Suhu Header for md, lg, xl (< 2xl) -->
                            <th class="hidden md:table-cell 2xl:hidden px-1.5 xl:px-3 py-2 xl:py-3 text-center font-bold whitespace-nowrap w-16 xl:w-24">Suhu</th>
                            <!-- Separate Temp Headers (≥ 2xl) -->
                            <th class="hidden 2xl:table-cell px-3 xl:px-4 py-3 text-center font-bold whitespace-nowrap w-24">CPU Temp</th>
                            <th class="hidden 2xl:table-cell px-3 xl:px-4 py-3 text-center font-bold whitespace-nowrap w-24">GPU Temp</th>
                            <!-- RAM & LAN Header (< 2xl) -->
                            <th class="2xl:hidden px-0.5 sm:px-1.5 xl:px-3 py-1.5 sm:py-2 xl:py-3 text-center font-bold whitespace-nowrap w-10 sm:w-16 xl:w-24">RAM & LAN</th>
                            <!-- Separate RAM & Network Headers (≥ 2xl) -->
                            <th class="hidden 2xl:table-cell px-3 xl:px-4 py-3 text-center font-bold whitespace-nowrap w-20">RAM</th>
                            <th class="hidden 2xl:table-cell px-3 xl:px-4 py-3 text-center font-bold whitespace-nowrap w-28">Network</th>
                            <th class="hidden lg:table-cell px-2 xl:px-4 py-2 xl:py-3 text-right font-bold whitespace-nowrap min-w-[85px] xl:w-32">Terakhir Aktif</th>
                            <th class="px-0.5 sm:px-1 xl:px-4 py-1.5 sm:py-2 xl:py-3 text-center font-bold whitespace-nowrap w-8 sm:w-12">Aksi</th>
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
