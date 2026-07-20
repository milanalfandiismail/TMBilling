/**
 * Server Monitor Module
 * Handles polling and updating of the Server Resource Monitor widget on the Dashboard.
 */

const ServerMonitor = {
    interval: null,
    isPolling: false,

    start() {
        if (this.isPolling) return;
        this.isPolling = true;
        this.checkLHMStatus();
        this.fetchMetrics();
        this.interval = setInterval(() => this.fetchMetrics(), 5000);
    },

    stop() {
        if (!this.isPolling) return;
        this.isPolling = false;
        if (this.interval) clearInterval(this.interval);
    },
    
    async checkLHMStatus() {
        try {
            const res = await API.request('/api/v1/kasir/server-monitor/lhm/status');
            if (res.success) {
                const toggle = document.getElementById('lhm-toggle');
                if (toggle) toggle.checked = res.is_running;
            }
        } catch (e) {
            console.error('Failed to check LHM status', e);
        }
    },
    
    async toggleLHM(isEnabled) {
        try {
            const endpoint = isEnabled ? '/api/v1/kasir/server-monitor/lhm/start' : '/api/v1/kasir/server-monitor/lhm/stop';
            const res = await API.request(endpoint, { method: 'POST' });
            if (res.success) {
                Toast.success(res.message);
            } else {
                Toast.error(res.error || 'Terjadi kesalahan sistem');
                document.getElementById('lhm-toggle').checked = !isEnabled;
            }
        } catch (e) {
            console.error(e);
            Toast.error('Gagal menghubungi server');
            document.getElementById('lhm-toggle').checked = !isEnabled;
        }
    },

    async fetchMetrics() {
        try {
            const res = await API.request('/api/v1/kasir/server-monitor');
            if (res.success && res.data) {
                this.updateUI(res.data);
                document.getElementById('sm-status').innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span> Online';
                document.getElementById('sm-status').classList.replace('text-neutral-500', 'text-emerald-500');
                document.getElementById('sm-status').classList.replace('text-red-500', 'text-emerald-500');
            }
        } catch (err) {
            console.error('Server Monitor Error:', err);
            document.getElementById('sm-status').innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span> Terputus';
            document.getElementById('sm-status').classList.replace('text-emerald-500', 'text-red-500');
            document.getElementById('sm-status').classList.replace('text-neutral-500', 'text-red-500');
        }
    },

    updateUI(data) {
        this.updateCpu(data.cpu);
        this.updateRam(data.ram);
        this.updateDiskList(data.disk);
        this.updateNicList(data.nic);
        this.updateGpuList(data.gpu);
    },

    updateCpu(cpu) {
        if (!cpu) return;
        document.getElementById('sm-cpu-val').innerText = `${cpu.percent.toFixed(1)}%`;
        if (cpu.name) document.getElementById('sm-cpu-name').innerText = cpu.name;
        
        const bar = document.getElementById('sm-cpu-bar');
        bar.style.width = `${cpu.percent}%`;
        this.updateBarColor(bar, cpu.percent);
        
        document.getElementById('sm-cpu-cores').innerText = `${cpu.cores || 0} Cores / ${cpu.threads || 0} Threads`;
        document.getElementById('sm-cpu-freq').innerText = cpu.freq_mhz > 0 ? `${cpu.freq_mhz} MHz` : '--';
        
        const tempEl = document.getElementById('sm-cpu-temp');
        if (tempEl) {
            tempEl.innerText = cpu.temp !== "N/A" ? `${cpu.temp}°C` : '--';
        }
    },

    updateRam(ram) {
        if (!ram) return;
        document.getElementById('sm-ram-val').innerText = `${ram.percent.toFixed(1)}%`;
        
        const bar = document.getElementById('sm-ram-bar');
        bar.style.width = `${ram.percent}%`;
        this.updateBarColor(bar, ram.percent);
        
        const usedGb = (ram.used / (1024 ** 3)).toFixed(1);
        const totalGb = (ram.total / (1024 ** 3)).toFixed(1);
        
        document.getElementById('sm-ram-used').innerText = `${usedGb} GB Terpakai`;
        document.getElementById('sm-ram-total').innerText = `Total: ${totalGb} GB`;
    },

    updateDiskList(disks) {
        const container = document.getElementById('sm-disk-list');
        if (!disks || disks.length === 0) {
            container.innerHTML = '<div class="text-[11px] text-neutral-600 font-mono italic">Tidak ada storage</div>';
            return;
        }
        
        let html = '';
        disks.forEach(d => {
            const usedGb = (d.used / (1024**3)).toFixed(1);
            const totalGb = (d.total / (1024**3)).toFixed(1);
            const freeGb = (d.free / (1024**3)).toFixed(1);
            
            let color = 'bg-purple-500';
            if (d.percent > 90) color = 'bg-red-500';
            else if (d.percent > 75) color = 'bg-yellow-500';
            
            html += `
                <div class="flex flex-col justify-between">
                    <div>
                        <div class="flex justify-between items-baseline mb-2">
                            <span class="text-sm lg:text-base font-bold text-neutral-300 font-mono flex items-center gap-1.5 truncate">
                                <svg class="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
                                ${d.device} ${d.fstype ? `(${d.fstype})` : ''}
                            </span>
                            <span class="text-xl lg:text-2xl font-black text-neutral-100 font-mono">${d.percent.toFixed(1)}%</span>
                        </div>
                        <div class="h-3 w-full bg-[#1a1a1a] rounded-full overflow-hidden mb-4">
                            <div class="h-full ${color} rounded-full transition-all duration-500" style="width: ${d.percent}%"></div>
                        </div>
                    </div>
                    <div class="flex justify-between text-xs lg:text-sm text-neutral-500 font-mono bg-[#0c0c0c] p-3 rounded-lg border border-[#1a1a1a]">
                        <span>Free: ${freeGb} GB</span>
                        <span class="text-purple-500 font-bold">Total: ${totalGb} GB</span>
                    </div>
                </div>
            `;
            
            // Alert logic
            if (d.percent > 95 && d.mountpoint === 'C:\\') {
                if (typeof UI !== 'undefined' && UI.showToast) {
                    UI.showToast(`Peringatan: Storage C: hampir penuh! Sisa ${freeGb} GB`, 'warning');
                }
            }
        });
        container.innerHTML = html;
    },

    updateNicList(nics) {
        const container = document.getElementById('sm-nic-list');
        if (!nics || nics.length === 0) {
            container.innerHTML = '<div class="text-[11px] text-neutral-600 font-mono italic">Tidak ada network adapter</div>';
            return;
        }
        
        // Sort NICs: Active first, then by speed (highest first), then alphabetically
        nics.sort((a, b) => {
            if (a.is_up && !b.is_up) return -1;
            if (!a.is_up && b.is_up) return 1;
            if (a.speed_mbps !== b.speed_mbps) {
                return (b.speed_mbps || 0) - (a.speed_mbps || 0);
            }
            return (a.name || '').localeCompare(b.name || '');
        });
        
        let html = '';
        nics.forEach(n => {
            const rxKbps = (n.rx_bytes_sec / 1024).toFixed(1);
            const txKbps = (n.tx_bytes_sec / 1024).toFixed(1);
            const statusDot = n.is_up ? '<span class="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.8)]"></span>' : '<span class="w-1.5 h-1.5 rounded-full bg-neutral-600"></span>';
            let speedClass = 'text-neutral-500';
            let speedText = '';
            if (n.speed_mbps > 0) {
                speedText = n.speed_mbps + ' Mbps';
                if (n.speed_mbps >= 1000) {
                    speedClass = 'text-emerald-500 font-bold drop-shadow-[0_0_2px_rgba(16,185,129,0.3)]';
                } else if (n.speed_mbps <= 100) {
                    speedClass = 'text-rose-500 font-bold drop-shadow-[0_0_2px_rgba(244,63,94,0.3)]';
                } else {
                    speedClass = 'text-blue-400 font-bold';
                }
            }
            
            html += `
                <div class="flex flex-col justify-between">
                    <div>
                        <div class="flex justify-between items-baseline mb-2">
                            <span class="text-sm lg:text-base font-bold text-neutral-300 truncate max-w-[200px] flex items-center gap-1.5" title="${n.name}">
                                ${statusDot} ${n.name}
                            </span>
                            <span class="text-lg lg:text-xl ${speedClass} font-mono">${speedText}</span>
                        </div>
                        <div class="text-xs lg:text-sm text-neutral-400 font-mono mb-4">
                            IP: <span class="text-cyan-500">${n.ip_address}</span>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3 text-xs lg:text-sm text-neutral-500 font-mono bg-[#0c0c0c] p-3 rounded-lg border border-[#1a1a1a]">
                        <div class="flex items-center gap-2">
                            <svg class="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>
                            <span class="font-bold">${rxKbps} KB/s</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>
                            <span class="font-bold">${txKbps} KB/s</span>
                        </div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    },

    updateGpuList(gpus) {
        const wrapper = document.getElementById('sm-gpu-container');
        const container = document.getElementById('sm-gpu-list');
        
        if (!gpus || gpus.length === 0) {
            wrapper.style.display = 'none';
            return;
        }
        
        wrapper.style.display = 'block';
        let html = '';
        gpus.forEach(g => {
            let bodyHtml = '';
            if (g.load !== "N/A") {
                const loadStr = `${g.load.toFixed(1)}%`;
                const tempStr = g.temp_c !== "N/A" && g.temp_c !== undefined ? `${g.temp_c}°C` : "N/A";
                let color = 'bg-rose-500';
                let barWidth = g.load;
                if (barWidth > 85) color = 'bg-red-500';
                else if (barWidth > 70) color = 'bg-yellow-500';
                
                bodyHtml = `
                    <div class="flex flex-col justify-between">
                        <div class="flex justify-between items-baseline mb-2">
                            <span class="text-sm lg:text-base font-bold text-neutral-300 truncate max-w-[200px]" title="${g.name}">
                                ${g.name}
                            </span>
                            <span class="text-lg lg:text-xl font-black text-neutral-100 font-mono">${loadStr}</span>
                        </div>
                        <div class="h-3 w-full bg-[#1a1a1a] rounded-full overflow-hidden mb-4">
                            <div class="h-full ${color} rounded-full transition-all duration-500" style="width: ${barWidth}%"></div>
                        </div>
                        <div class="flex justify-between text-xs lg:text-sm text-neutral-500 font-mono bg-[#0c0c0c] p-3 rounded-lg border border-[#1a1a1a]">
                            <span>Temp: <span class="text-rose-500 font-bold">${tempStr}</span></span>
                            ${g.mem_total_mb > 0 ? `<span>VRAM: <span class="text-rose-500 font-bold">${(g.mem_used_mb / 1024).toFixed(1)} / ${(g.mem_total_mb / 1024).toFixed(1)} GB</span></span>` : '<span>VRAM: <span class="text-rose-500 font-bold">N/A</span></span>'}
                        </div>
                    </div>
                `;
            } else {
                bodyHtml = `
                    <div class="flex flex-col mb-1">
                        <span class="text-xs lg:text-sm font-bold text-neutral-300 truncate w-full" title="${g.name}">
                            ${g.name}
                        </span>
                        <span class="text-[10px] lg:text-xs text-neutral-500 italic mt-1">Data sensor tidak tersedia (Hanya mendukung NVIDIA)</span>
                    </div>
                `;
            }
            
            html += `
                <div class="bg-[#111] p-3 rounded-lg border border-[#1a1a1a]">
                    ${bodyHtml}
                </div>
            `;
        });
        container.innerHTML = html;
    },

    updateBarColor(barElement, percent) {
        barElement.classList.remove('bg-emerald-500', 'bg-yellow-500', 'bg-red-500', 'bg-blue-500', 'bg-purple-500');
        
        if (percent > 85) {
            barElement.classList.add('bg-red-500');
        } else if (percent > 70) {
            barElement.classList.add('bg-yellow-500');
        } else {
            // Default colors based on ID
            if (barElement.id.includes('cpu')) barElement.classList.add('bg-emerald-500');
            else if (barElement.id.includes('ram')) barElement.classList.add('bg-blue-500');
            else if (barElement.id.includes('disk')) barElement.classList.add('bg-purple-500');
            else barElement.classList.add('bg-emerald-500');
        }
    }
};

window.ServerMonitor = ServerMonitor;
