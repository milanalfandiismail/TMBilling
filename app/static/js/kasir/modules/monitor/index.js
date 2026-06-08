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
        if (!temp || temp === 0) return `<span class="text-neutral-600 font-mono">-</span>`;
        if (temp >= 78) {
            return `<span class="px-1.5 py-0.5 rounded bg-red-900 border border-red-500 text-red-200 font-mono font-bold text-xs uppercase animate-pulse">🔥 ${temp}°C</span>`;
        }
        if (temp >= 65) {
            return `<span class="px-1.5 py-0.5 rounded border border-amber-600 text-amber-500 font-mono font-bold text-xs">${temp}°C</span>`;
        }
        return `<span class="font-mono text-neutral-300 text-xs font-semibold">${temp}°C</span>`;
    },

    renderTable(data) {
        const container = document.getElementById('monitor-table');
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-neutral-500">
                    <p class="text-base font-bold">Belum Ada Data Monitor</p>
                    <p class="text-xs text-neutral-600 mt-1">Pastikan C# Hardware Monitor Agent berjalan di client</p>
                </div>`;
            return;
        }

        let html = `
            <div class="overflow-x-hidden w-full border border-[#1c1c1c] rounded">
                <table class="w-full text-sm block lg:table">
                    <thead class="hidden lg:table-header-group">
                        <tr class="text-[10px] text-neutral-500 uppercase tracking-wider border-b border-[#1c1c1c] bg-[#0c0c0c]">
                            <th class="px-6 py-3 text-left font-bold">PC</th>
                            <th class="px-6 py-3 text-left font-bold">Spesifikasi</th>
                            <th class="px-6 py-3 text-center font-bold">CPU Usage</th>
                            <th class="px-6 py-3 text-center font-bold">CPU Temp</th>
                            <th class="px-6 py-3 text-center font-bold">GPU Temp</th>
                            <th class="px-6 py-3 text-center font-bold">RAM</th>
                            <th class="px-6 py-3 text-center font-bold">Network</th>
                            <th class="px-6 py-3 text-right font-bold">Terakhir Aktif</th>
                            <th class="px-6 py-3 text-center font-bold w-16">Aksi</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#2a2a2a] lg:divide-[#1c1c1c] bg-[#050505] block lg:table-row-group">
        `;

        data.forEach(m => {
            const cpuUsagePct = m.cpu_usage || 0;
            const cpuBar = `
                <div class="flex items-center justify-center gap-2">
                    <span class="text-xs text-neutral-200 font-mono font-bold w-8 text-right">${cpuUsagePct.toFixed(0)}%</span>
                    <div class="w-16 bg-neutral-800 rounded-full h-1 overflow-hidden">
                        <div class="bg-neutral-200 h-full" style="width: ${cpuUsagePct}%"></div>
                    </div>
                </div>
            `;

            const cpuTempBadge = this.getTempBadge(m.cpu_temp);
            const gpuTempBadge = this.getTempBadge(m.gpu_temp);

            let netHtml = '<span class="text-neutral-600 font-mono text-xs">--</span>';
            if (m.nic_speed) {
                if (m.nic_speed.includes('Gbps')) {
                    netHtml = `<span class="px-1.5 py-0.5 rounded border border-[#262626] text-neutral-300 text-xs font-bold font-mono">1 Gbps</span>`;
                } else {
                    netHtml = `<span class="px-1.5 py-0.5 rounded border border-red-950 text-red-500 text-xs font-bold font-mono">${m.nic_speed}</span>`;
                }
            }

            let formattedDate = 'OFFLINE';
            let updateClass = 'text-neutral-600';

            if (m.last_update) {
                try {
                    const d = new Date(String(m.last_update).replace(/-/g, '/'));
                    if (!isNaN(d.getTime())) {
                        formattedDate = d.toLocaleString('id-ID', {
                            day: 'numeric', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                        });
                        const diffSecs = Math.abs((Date.now() - d.getTime()) / 1000);
                        if (diffSecs < 15) updateClass = 'text-neutral-200 font-bold';
                        else if (diffSecs < 60) updateClass = 'text-neutral-400 font-medium';
                        else updateClass = 'text-neutral-600';
                    }
                } catch (e) {
                    formattedDate = m.last_update;
                }
            }

            html += `
                <tr class="hover:bg-[#0c0c0c] transition-colors border-b border-[#2a2a2a] block lg:table-row py-3 lg:py-0">
                    <td class="px-6 py-4 block lg:table-cell">
                        <div class="flex items-center gap-2">
                            <span class="w-1.5 h-1.5 rounded-full bg-neutral-200"></span>
                            <span class="font-bold text-neutral-100 font-mono">${m.pc_kode}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4 block lg:table-cell border-t border-[#2a2a2a]/50 lg:border-t-0">
                        <div class="text-xs text-neutral-200 font-semibold" title="Processor">${m.cpu_name || '--'}</div>
                        <div class="text-xs text-neutral-500 mt-1" title="VGA / GPU">${m.gpu_name || '--'}</div>
                        <div class="text-[10px] text-neutral-600 mt-0.5" title="Motherboard">${m.motherboard || ''}</div>
                    </td>
                    <td class="px-6 py-4 text-center flex lg:table-cell justify-between items-center">
                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider lg:hidden">CPU Usage</span>
                        ${cpuBar}
                    </td>
                    <td class="px-6 py-4 text-center flex lg:table-cell justify-between items-center">
                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider lg:hidden">CPU Temp</span>
                        ${cpuTempBadge}
                    </td>
                    <td class="px-6 py-4 text-center flex lg:table-cell justify-between items-center">
                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider lg:hidden">GPU Temp</span>
                        ${gpuTempBadge}
                    </td>
                    <td class="px-6 py-4 text-center flex lg:table-cell justify-between items-center">
                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider lg:hidden">RAM</span>
                        <span class="text-xs text-neutral-200 font-mono font-bold">${m.total_ram || '--'}</span>
                    </td>
                    <td class="px-6 py-4 text-center flex lg:table-cell justify-between items-center">
                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Network</span>
                        ${netHtml}
                    </td>
                    <td class="px-6 py-4 text-right flex lg:table-cell justify-between items-center">
                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Terakhir Aktif</span>
                        <span class="text-xs font-mono ${updateClass}">${formattedDate}</span>
                    </td>
                    <td class="px-6 py-4 text-center flex lg:table-cell justify-between items-center">
                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Aksi</span>
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

        html += `</tbody></table></div>`;
        container.innerHTML = html;
    }
};

window.Monitor = Monitor;
