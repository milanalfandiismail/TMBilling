/**
 * Dashboard Detail Modal - Hardware Specs & Polling Sub-module
 * Menangani tampilan audit spesifikasi hardware, component diffing, telemetry live update, dan registrasi baseline.
 */
window.DashboardModalHardware = {
    showHardwareView(pcId, pcKode) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        document.getElementById('view-action-menu')?.classList.add('hidden');
        document.getElementById('view-process-list')?.classList.add('hidden');
        document.getElementById('view-remote-client')?.classList.add('hidden');
        document.getElementById('view-hardware-specs')?.classList.remove('hidden');
        document.getElementById('modal-card-main-footer')?.classList.add('hidden');
        
        this.currentHardwarePcId = pcId;
        this.currentHardwarePcKode = pcKode;
        this.loadHardwareData(pcId, pcKode, false);

        if (this._hardwarePollingTimer) clearInterval(this._hardwarePollingTimer);
        this._hardwarePollingTimer = setInterval(() => {
            const hwView = document.getElementById('view-hardware-specs');
            if (hwView && !hwView.classList.contains('hidden') && this.currentPcId && this.currentHardwarePcId === this.currentPcId) {
                this.loadHardwareData(this.currentHardwarePcId, this.currentHardwarePcKode || pcKode, true);
            }
        }, 3000);
    },

    backFromHardware() {
        if (this._hardwarePollingTimer) {
            clearInterval(this._hardwarePollingTimer);
            this._hardwarePollingTimer = null;
        }
        this.currentHardwarePcId = null;
        this.currentHardwarePcKode = null;
        this._lastHwFingerprint = null;
        this._lastHwStructureKey = null;
        this._lastHwData = null;
        this._lastHwPcId = null;

        document.getElementById('view-hardware-specs')?.classList.add('hidden');
        document.getElementById('view-action-menu')?.classList.remove('hidden');
        document.getElementById('modal-card-main-footer')?.classList.remove('hidden');
    },

    getHwTempBadge(temp) {
        const escapeHtml = (str) => {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        if (temp == null || temp === '-' || temp === 0) return `<span class="text-neutral-600 font-mono text-xs lg:max-xl:text-xs xl:text-base">-</span>`;
        const tempVal = parseFloat(temp);
        if (isNaN(tempVal)) return `<span class="text-neutral-500 font-mono text-xs lg:max-xl:text-xs xl:text-base">${escapeHtml(temp)}</span>`;
        if (tempVal >= 78) {
            return `<span class="px-2 py-0.5 rounded bg-red-950/80 border border-red-500 text-red-200 font-mono font-black text-xs lg:max-xl:text-xs xl:text-base uppercase animate-pulse shadow-sm shadow-red-950/50 flex items-center gap-1">🔥 ${tempVal}°C (HOT)</span>`;
        }
        if (tempVal >= 65) {
            return `<span class="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500/80 text-amber-300 font-mono font-bold text-xs lg:max-xl:text-xs xl:text-base flex items-center gap-1">⚠️ ${tempVal}°C (WARM)</span>`;
        }
        return `<span class="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/60 text-emerald-300 font-mono font-bold text-xs lg:max-xl:text-xs xl:text-base flex items-center gap-1">❄️ ${tempVal}°C (NORMAL)</span>`;
    },

    getHwNicBadge(speed) {
        const escapeHtml = (str) => {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        if (!speed || speed === '-' || speed === 'Unknown') return '<span class="text-neutral-500 font-mono text-xs lg:max-xl:text-xs xl:text-base">-</span>';
        const s = String(speed).toLowerCase();
        let isGigabitOrMore = false;
        if (s.includes('gbps')) {
            const val = parseFloat(s.replace(/[^0-9.]/g, ''));
            isGigabitOrMore = !isNaN(val) && val >= 1.0;
        } else if (s.includes('mbps')) {
            const val = parseFloat(s.replace(/[^0-9.]/g, ''));
            isGigabitOrMore = !isNaN(val) && val >= 1000.0;
        }

        if (isGigabitOrMore) {
            return `<span class="px-2 py-0.5 rounded border border-emerald-500/60 bg-emerald-950/60 text-emerald-300 font-bold font-mono text-xs lg:max-xl:text-xs xl:text-base flex items-center gap-1 shadow-sm shadow-emerald-950/40">⚡ ${escapeHtml(speed)} (Gigabit OK)</span>`;
        } else {
            return `<span class="px-2 py-0.5 rounded border border-red-500 bg-red-950/80 text-red-200 font-black font-mono text-xs lg:max-xl:text-xs xl:text-base animate-pulse flex items-center gap-1 shadow-sm shadow-red-950/50">⚠️ ${escapeHtml(speed)} (< 1 Gbps)</span>`;
        }
    },

    getHwCpuBadge(name) {
        const escapeHtml = (str) => {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        if (!name || name === '-') return '<span class="text-neutral-500 font-mono text-xs lg:max-xl:text-xs xl:text-base">-</span>';
        const n = String(name).toLowerCase();
        if (n.includes('intel') || n.includes('core') || n.includes('i3') || n.includes('i5') || n.includes('i7') || n.includes('i9') || n.includes('xeon')) {
            return `<span class="text-sky-300 font-bold font-mono text-xs lg:max-xl:text-xs xl:text-base truncate max-w-[180px] sm:max-w-[260px] lg:max-w-[220px] xl:max-w-[280px]" title="${escapeHtml(name)}">🔹 ${escapeHtml(name)}</span>`;
        }
        if (n.includes('amd') || n.includes('ryzen') || n.includes('threadripper') || n.includes('athlon')) {
            return `<span class="text-amber-400 font-bold font-mono text-xs lg:max-xl:text-xs xl:text-base truncate max-w-[180px] sm:max-w-[260px] lg:max-w-[220px] xl:max-w-[280px]" title="${escapeHtml(name)}">🔸 ${escapeHtml(name)}</span>`;
        }
        return `<span class="text-neutral-200 font-bold font-mono text-xs lg:max-xl:text-xs xl:text-base truncate max-w-[180px] sm:max-w-[260px] lg:max-w-[220px] xl:max-w-[280px]" title="${escapeHtml(name)}">🖥️ ${escapeHtml(name)}</span>`;
    },

    getHwGpuBadge(name) {
        const escapeHtml = (str) => {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        if (!name || name === '-') return '<span class="text-neutral-500 font-mono text-xs lg:max-xl:text-xs xl:text-base">-</span>';
        const n = String(name).toLowerCase();
        if (n.includes('nvidia') || n.includes('geforce') || n.includes('rtx') || n.includes('gtx')) {
            return `<span class="text-emerald-400 font-bold font-mono text-xs lg:max-xl:text-xs xl:text-base truncate max-w-[180px] sm:max-w-[260px] lg:max-w-[220px] xl:max-w-[280px]" title="${escapeHtml(name)}">🟢 ${escapeHtml(name)}</span>`;
        }
        if (n.includes('radeon') || n.includes('rx') || n.includes('amd')) {
            return `<span class="text-rose-400 font-bold font-mono text-xs lg:max-xl:text-xs xl:text-base truncate max-w-[180px] sm:max-w-[260px] lg:max-w-[220px] xl:max-w-[280px]" title="${escapeHtml(name)}">🔴 ${escapeHtml(name)}</span>`;
        }
        if (n.includes('arc') || n.includes('iris') || n.includes('intel')) {
            return `<span class="text-cyan-400 font-bold font-mono text-xs lg:max-xl:text-xs xl:text-base truncate max-w-[180px] sm:max-w-[260px] lg:max-w-[220px] xl:max-w-[280px]" title="${escapeHtml(name)}">🔵 ${escapeHtml(name)}</span>`;
        }
        return `<span class="text-emerald-400 font-bold font-mono text-xs lg:max-xl:text-xs xl:text-base truncate max-w-[180px] sm:max-w-[260px] lg:max-w-[220px] xl:max-w-[280px]" title="${escapeHtml(name)}">🎮 ${escapeHtml(name)}</span>`;
    },

    getHwRamBadge(ram) {
        const escapeHtml = (str) => {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        if (!ram || ram === '-') return '<span class="text-neutral-500 font-mono text-xs lg:max-xl:text-xs xl:text-base">-</span>';
        return `<span class="px-2 py-0.5 rounded border border-purple-800/60 bg-purple-950/50 text-purple-300 font-bold font-mono text-xs lg:max-xl:text-xs xl:text-base flex items-center gap-1 w-fit">💾 ${escapeHtml(ram)}</span>`;
    },

    getHwMbBadge(mb) {
        const escapeHtml = (str) => {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        if (!mb || mb === '-') return '<span class="text-neutral-500 font-mono text-xs lg:max-xl:text-xs xl:text-base">-</span>';
        return `<span class="text-amber-300 font-bold font-mono text-xs lg:max-xl:text-xs xl:text-base truncate max-w-[180px] sm:max-w-[260px] lg:max-w-[220px] xl:max-w-[280px]" title="${escapeHtml(mb)}">🎛️ ${escapeHtml(mb)}</span>`;
    },

    getHwStatusBadge(hwData) {
        if (!hwData) {
            return `<span class="px-2.5 py-1 rounded bg-amber-900/40 border border-amber-600/50 text-amber-300 text-[10px] lg:max-xl:text-xs xl:text-sm font-black uppercase tracking-wider font-mono">⚙️ Menunggu Telemetry</span>`;
        }
        const isHwMismatch = hwData.hardware_mismatch === true;
        const hasBaseline = !!hwData.hardware_baseline;

        if (isHwMismatch) {
            return `
                <span class="px-2.5 py-1 rounded bg-red-900/60 border border-red-500 text-red-200 text-[10px] lg:max-xl:text-xs xl:text-xs font-black uppercase tracking-wider animate-pulse flex items-center gap-1 font-mono shadow-sm shadow-red-950/50">
                    🚨 Hardware Ditukar / Hilang
                </span>`;
        } else if (hasBaseline) {
            return `
                <span class="px-2.5 py-1 rounded bg-green-950/60 border border-green-500/60 text-green-300 text-[10px] lg:max-xl:text-xs xl:text-xs font-black uppercase tracking-wider flex items-center gap-1 font-mono shadow-sm shadow-green-950/40">
                    🛡️ Internal Aman
                </span>`;
        } else {
            return `
                <span class="px-2.5 py-1 rounded bg-amber-900/50 border border-amber-600/50 text-amber-300 text-[10px] lg:max-xl:text-xs xl:text-xs font-black uppercase tracking-wider font-mono">
                    ⚙️ Menunggu Telemetry
                </span>`;
        }
    },

    renderRamPills(serials, isBaseline, baselineSpecs) {
        const escapeHtml = (str) => {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        if (!serials || !serials.length) return '<span class="text-neutral-600 font-mono text-xs lg:max-xl:text-xs xl:text-base">N/A</span>';
        return serials.map(r => {
            let isMatched = true;
            if (!isBaseline && baselineSpecs && baselineSpecs.RamSerials && baselineSpecs.RamSerials.length) {
                isMatched = baselineSpecs.RamSerials.includes(r);
            }
            if (!isMatched) {
                return `<span class="inline-block bg-red-950/80 text-red-200 border border-red-500 px-2 py-0.5 rounded mr-1 mb-1 font-bold text-[10px] lg:max-xl:text-xs xl:text-sm font-mono animate-pulse">🚨 ${escapeHtml(r)} (Tukar!)</span>`;
            }
            return `<span class="inline-block bg-[#121212] text-purple-300 border border-purple-900/50 px-2 py-0.5 rounded mr-1 mb-1 font-bold text-[10px] lg:max-xl:text-xs xl:text-sm font-mono">🏷️ ${escapeHtml(r)}</span>`;
        }).join('');
    },

    renderDiskPills(serials, isBaseline, baselineSpecs) {
        const escapeHtml = (str) => {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        if (!serials || !serials.length) return '<span class="text-neutral-600 font-mono text-xs lg:max-xl:text-xs xl:text-base">N/A</span>';
        return serials.map(d => {
            let isMatched = true;
            if (!isBaseline && baselineSpecs && baselineSpecs.DiskSerials && baselineSpecs.DiskSerials.length) {
                isMatched = baselineSpecs.DiskSerials.includes(d);
            }
            if (!isMatched) {
                return `<span class="inline-block bg-red-950/80 text-red-200 border border-red-500 px-2 py-0.5 rounded mr-1 mb-1 font-bold text-[10px] lg:max-xl:text-xs xl:text-sm font-mono animate-pulse">🚨 ${escapeHtml(d)} (Tukar!)</span>`;
            }
            return `<span class="inline-block bg-[#121212] text-cyan-300 border border-cyan-900/50 px-2 py-0.5 rounded mr-1 mb-1 font-bold text-[10px] lg:max-xl:text-xs xl:text-sm font-mono">💽 ${escapeHtml(d)}</span>`;
        }).join('');
    },

    updateHardwareTelemetryInPlace(pcId, pcKode, hwData) {
        if (!hwData) return false;
        const lastUpdateEl = document.getElementById('modal-hw-last-update');
        const cpuUsageValEl = document.getElementById('modal-hw-cpu-usage-val');
        const cpuUsageBarEl = document.getElementById('modal-hw-cpu-usage-bar');
        const cpuTempEl = document.getElementById('modal-hw-cpu-temp-val');
        const gpuTempEl = document.getElementById('modal-hw-gpu-temp-val');
        const activeWinEl = document.getElementById('modal-hw-active-window-val');
        const lastSyncEl = document.getElementById('modal-hw-last-sync-val');
        const cctvHintEl = document.getElementById('modal-hw-cctv-hint');

        if (!lastUpdateEl || !cpuUsageValEl || !cpuUsageBarEl || !cpuTempEl || !gpuTempEl) {
            return false;
        }

        const cpuUsage = typeof hwData.cpu_usage === 'number' ? hwData.cpu_usage : (parseInt(hwData.cpu_usage, 10) || 0);
        let cpuLoadTextColor = 'text-cyan-400';
        let cpuBarColor = 'bg-cyan-500';
        if (cpuUsage >= 80) {
            cpuLoadTextColor = 'text-red-400';
            cpuBarColor = 'bg-red-500';
        } else if (cpuUsage >= 50) {
            cpuLoadTextColor = 'text-amber-400';
            cpuBarColor = 'bg-amber-500';
        }

        lastUpdateEl.textContent = hwData.last_update || 'Baru saja';
        cpuUsageValEl.textContent = `${cpuUsage}%`;
        cpuUsageValEl.className = `text-base lg:max-xl:text-xl xl:text-2xl 2xl:text-3xl font-black font-mono ${cpuLoadTextColor} mt-0.5`;
        cpuUsageBarEl.className = `${cpuBarColor} h-full rounded-full transition-all duration-300`;
        cpuUsageBarEl.style.width = `${Math.min(100, Math.max(0, cpuUsage))}%`;
        cpuTempEl.innerHTML = this.getHwTempBadge(hwData.cpu_temp);
        gpuTempEl.innerHTML = this.getHwTempBadge(hwData.gpu_temp);

        if (activeWinEl) {
            const winTitle = hwData.active_window || '-';
            activeWinEl.textContent = `🪟 ${winTitle}`;
            activeWinEl.setAttribute('title', winTitle);
        }
        if (lastSyncEl) {
            lastSyncEl.textContent = hwData.last_update || hwData.hardware_last_sync || '-';
        }
        if (cctvHintEl) {
            cctvHintEl.textContent = `> ${hwData.last_update || hwData.hardware_last_sync || 'Waktu PC Mati'}`;
        }
        return true;
    },

    async loadHardwareData(pcId, pcKode, isSilent = false) {
        const contentEl = document.getElementById('modal-hw-content');
        const statusEl = document.getElementById('modal-hw-header-status');
        const refreshBtn = document.getElementById('btn-hw-refresh');

        if (!isSilent && (!this._lastHwData || this._lastHwPcId !== pcId)) {
            if (contentEl && typeof Skeleton !== 'undefined' && typeof Skeleton.hardwareDetailView === 'function') {
                contentEl.innerHTML = Skeleton.hardwareDetailView();
            }
        }

        if (!isSilent && refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.classList.add('opacity-50', 'cursor-not-allowed');
            refreshBtn.innerText = 'Menyegarkan...';
        }

        try {
            const res = await API.monitor.all();
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                refreshBtn.innerText = 'Segarkan Data';
            }

            if (res && res.success && Array.isArray(res.data)) {
                const hwData = res.data.find(item => item.pc_id === pcId);
                const newFingerprint = JSON.stringify(hwData || {});

                if (isSilent && this._lastHwFingerprint === newFingerprint && this._lastHwPcId === pcId) {
                    return; // Data identik, skip DOM touch
                }

                this._lastHwFingerprint = newFingerprint;
                this._lastHwData = hwData;
                this._lastHwPcId = pcId;

                const structureKey = hwData ? `${hwData.hardware_mismatch}_${Boolean(hwData.hardware_baseline)}_${Boolean(hwData.hardware_current_specs)}_${hwData.cpu_name}_${hwData.gpu_name}_${hwData.motherboard}` : 'empty';

                if (this._lastHwStructureKey === structureKey && this.updateHardwareTelemetryInPlace(pcId, pcKode, hwData)) {
                    if (statusEl) statusEl.innerHTML = this.getHwStatusBadge(hwData);
                    return;
                }

                this._lastHwStructureKey = structureKey;
                this.renderHardwareView(pcId, pcKode, hwData);
            } else if (!isSilent) {
                throw new Error((res && res.error) || 'Gagal mengambil data hardware');
            }
        } catch (err) {
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                refreshBtn.innerText = 'Segarkan Data';
            }
            if (!isSilent) {
                console.error('[DashboardDetailModal] Load hardware error:', err);
                if (contentEl) {
                    contentEl.innerHTML = `
                        <div class="py-16 text-center text-red-400 text-xs lg:text-sm font-mono space-y-2">
                            <p class="font-bold">Gagal memuat data hardware PC ${pcKode}</p>
                            <p class="text-neutral-500 text-[11px]">${err.message || 'Koneksi ke server terputus'}</p>
                            <button onclick="DashboardDetailModal.loadHardwareData(${pcId}, '${pcKode}', false)" class="mt-2 px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#252525] border border-[#333] text-neutral-200 text-xs rounded-lg transition-colors font-mono">
                                Coba Lagi
                            </button>
                        </div>
                    `;
                }
                if (statusEl) {
                    statusEl.innerHTML = `<span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-950/60 border border-red-800 text-red-400">ERROR</span>`;
                }
            }
        }
    },

    renderHardwareView(pcId, pcKode, hwData) {
        const contentEl = document.getElementById('modal-hw-content');
        const statusEl = document.getElementById('modal-hw-header-status');
        if (!contentEl) return;

        const escapeHtml = (str) => {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        if (statusEl) {
            statusEl.innerHTML = this.getHwStatusBadge(hwData);
        }

        if (!hwData) {
            contentEl.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-neutral-500 gap-2 text-center p-6 border border-dashed border-[#222] rounded-xl bg-[#0a0a0a]">
                    <div class="w-12 h-12 rounded-xl bg-[#141414] border border-[#222] flex items-center justify-center text-xl mb-1">🖥️</div>
                    <p class="text-xs lg:max-xl:text-lg xl:text-[22px] font-bold text-neutral-200 uppercase tracking-wider font-mono">Belum Ada Data Telemetri</p>
                    <p class="text-[9px] lg:max-xl:text-xs xl:text-base text-neutral-500 max-w-md">PC ${escapeHtml(pcKode)} belum mengirimkan log hardware atau agent Hardware Monitor belum aktif di client.</p>
                </div>
            `;
            return;
        }

        const isHwMismatch = hwData.hardware_mismatch === true;
        let baselineSpecs = null;
        let currentSpecs = null;

        try {
            if (hwData.hardware_baseline) {
                baselineSpecs = typeof hwData.hardware_baseline === 'string' ? JSON.parse(hwData.hardware_baseline) : hwData.hardware_baseline;
            }
            if (hwData.hardware_current_specs) {
                currentSpecs = typeof hwData.hardware_current_specs === 'string' ? JSON.parse(hwData.hardware_current_specs) : hwData.hardware_current_specs;
            }
        } catch (e) {
            console.error('[DashboardDetailModal] Parse specs error:', e);
        }

        let alertBannerHtml = '';
        if (isHwMismatch) {
            const cctvWindowDisplay = hwData.hardware_cctv_window || `${hwData.hardware_mismatch_time || '--:--'} (saat booting)`;
            alertBannerHtml += `
                <div class="p-3.5 sm:p-4 bg-red-950/30 border border-red-500/40 rounded-xl text-xs lg:max-xl:text-xs xl:text-sm text-red-200 space-y-2 shadow-lg shadow-red-950/30 animate-in min-w-0 w-full">
                    <div class="flex items-center justify-between min-w-0">
                        <div class="flex items-center gap-2 font-bold text-red-400 min-w-0">
                            <span class="text-base shrink-0">🚨</span>
                            <span class="text-xs lg:max-xl:text-base xl:text-lg uppercase tracking-wider font-mono truncate">DETEKSI PERUBAHAN HARDWARE INTERNAL:</span>
                        </div>
                        <span class="px-2 py-0.5 rounded bg-red-900/80 border border-red-500 text-red-100 text-[10px] lg:max-xl:text-xs xl:text-xs font-black uppercase tracking-wider font-mono shrink-0">
                            MISMATCH
                        </span>
                    </div>
                    <p class="font-mono text-xs lg:max-xl:text-xs xl:text-sm pl-2.5 border-l-2 border-red-500 bg-red-950/50 p-2.5 rounded text-red-200 leading-relaxed break-all min-w-0 w-full">
                        ${escapeHtml(hwData.hardware_mismatch_desc || 'Terdeteksi komponen fisik PC tidak cocok dengan baseline yang telah diverifikasi.')}
                    </p>
                    <div class="text-[11px] lg:max-xl:text-xs xl:text-sm text-neutral-400 flex flex-wrap items-center gap-1.5 min-w-0 pt-1">
                        <span>🎥</span>
                        <strong class="text-neutral-300 uppercase shrink-0">Rentang Waktu Estimasi (Referensi CCTV):</strong>
                        <span class="font-mono font-bold text-red-300 break-all min-w-0">${escapeHtml(cctvWindowDisplay)}</span>
                    </div>
                </div>
            `;
        }

        const cpuUsage = typeof hwData.cpu_usage === 'number' ? hwData.cpu_usage : (parseInt(hwData.cpu_usage, 10) || 0);
        let cpuLoadTextColor = 'text-cyan-400';
        let cpuBarColor = 'bg-cyan-500';
        if (cpuUsage >= 80) {
            cpuLoadTextColor = 'text-red-400';
            cpuBarColor = 'bg-red-500';
        } else if (cpuUsage >= 50) {
            cpuLoadTextColor = 'text-amber-400';
            cpuBarColor = 'bg-amber-500';
        }

        contentEl.innerHTML = `
            <div class="space-y-4 md:space-y-5">
                ${alertBannerHtml}

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
                    <!-- Card 1: Telemetri Real-Time -->
                    <div class="p-4 sm:p-5 bg-[#0c0c0c] border border-[#202020] rounded-xl flex flex-col justify-between space-y-3">
                        <div class="flex items-center justify-between border-b border-[#1c1c1c] pb-2.5">
                            <span class="text-xs lg:max-xl:text-lg xl:text-[22px] font-bold text-neutral-200 uppercase tracking-wider font-mono flex items-center gap-2">
                                <span>⚡</span> Telemetri Real-Time
                            </span>
                            <span class="text-[9px] lg:max-xl:text-xs xl:text-base text-neutral-500 font-mono" id="modal-hw-last-update">${escapeHtml(hwData.last_update || 'Baru saja')}</span>
                        </div>

                        <div class="grid grid-cols-3 gap-2.5">
                            <div class="p-2.5 bg-[#070707] border border-[#181818] rounded-lg flex flex-col justify-between">
                                <div class="text-[10px] lg:max-xl:text-xs xl:text-sm text-neutral-500 font-mono uppercase font-bold tracking-wider">CPU Load</div>
                                <div id="modal-hw-cpu-usage-val" class="text-base lg:max-xl:text-xl xl:text-2xl 2xl:text-3xl font-black font-mono ${cpuLoadTextColor} mt-0.5">${cpuUsage}%</div>
                                <div class="w-full bg-[#181818] h-1.5 lg:max-xl:h-2 xl:h-2 rounded-full overflow-hidden mt-1.5">
                                    <div id="modal-hw-cpu-usage-bar" class="${cpuBarColor} h-full rounded-full transition-all duration-300" style="width: ${Math.min(100, Math.max(0, cpuUsage))}%"></div>
                                </div>
                            </div>

                            <div class="p-2.5 bg-[#070707] border border-[#181818] rounded-lg flex flex-col justify-between">
                                <div class="text-[10px] lg:max-xl:text-xs xl:text-sm text-neutral-500 font-mono uppercase font-bold tracking-wider">Suhu CPU</div>
                                <div id="modal-hw-cpu-temp-val" class="mt-1">${this.getHwTempBadge(hwData.cpu_temp)}</div>
                            </div>

                            <div class="p-2.5 bg-[#070707] border border-[#181818] rounded-lg flex flex-col justify-between">
                                <div class="text-[10px] lg:max-xl:text-xs xl:text-sm text-neutral-500 font-mono uppercase font-bold tracking-wider">Suhu GPU</div>
                                <div id="modal-hw-gpu-temp-val" class="mt-1">${this.getHwTempBadge(hwData.gpu_temp)}</div>
                            </div>
                        </div>

                        <div class="p-2.5 bg-[#070707] border border-[#181818] rounded-lg font-mono space-y-1.5">
                            <div class="flex items-center justify-between text-[10px] lg:max-xl:text-xs xl:text-sm">
                                <span class="text-neutral-500 font-semibold uppercase tracking-wider">Jendela Aktif:</span>
                                <span id="modal-hw-active-window-val" class="text-xs lg:max-xl:text-xs xl:text-base text-sky-300 font-semibold truncate max-w-[200px] sm:max-w-[280px] lg:max-w-[240px] xl:max-w-[320px]" title="${escapeHtml(hwData.active_window || '-')}">🪟 ${escapeHtml(hwData.active_window || '-')}</span>
                            </div>
                            <div class="flex items-center justify-between text-[10px] lg:max-xl:text-xs xl:text-sm">
                                <span class="text-neutral-500 font-semibold uppercase tracking-wider">Terakhir PC Aktif / Sinkron:</span>
                                <span id="modal-hw-last-sync-val" class="text-xs lg:max-xl:text-xs xl:text-base text-neutral-300 font-bold font-mono">${escapeHtml(hwData.last_update || hwData.hardware_last_sync || '-')}</span>
                            </div>
                            <div class="pt-1.5 border-t border-[#181818] text-[9px] lg:max-xl:text-[10px] xl:text-xs text-neutral-500 flex items-start gap-1 leading-snug">
                                <span class="shrink-0">💡</span>
                                <span>Jika PC tidak dapat menyala/booting (indikasi RAM/komponen dilepas), cek CCTV mulai: <strong id="modal-hw-cctv-hint" class="text-amber-300">&gt; ${escapeHtml(hwData.last_update || hwData.hardware_last_sync || 'Waktu PC Mati')}</strong></span>
                            </div>
                        </div>
                    </div>

                    <!-- Card 2: Komponen Utama -->
                    <div class="p-4 sm:p-5 bg-[#0c0c0c] border border-[#202020] rounded-xl flex flex-col justify-between space-y-3">
                        <div class="flex items-center justify-between border-b border-[#1c1c1c] pb-2.5">
                            <span class="text-xs lg:max-xl:text-lg xl:text-[22px] font-bold text-neutral-200 uppercase tracking-wider font-mono flex items-center gap-2">
                                <span>⚙️</span> Komponen Utama
                            </span>
                            <span class="text-xs lg:max-xl:text-sm xl:text-base font-mono font-bold text-neutral-400 uppercase tracking-wider">${escapeHtml(hwData.pc_kode || pcKode)}</span>
                        </div>

                        <div class="space-y-2 font-mono">
                            <div class="flex items-center justify-between p-2 bg-[#070707] border border-[#181818] rounded-lg">
                                <span class="text-neutral-400 font-semibold text-[10px] lg:max-xl:text-xs xl:text-sm uppercase tracking-wider">Processor (CPU)</span>
                                ${this.getHwCpuBadge(hwData.cpu_name)}
                            </div>
                            <div class="flex items-center justify-between p-2 bg-[#070707] border border-[#181818] rounded-lg">
                                <span class="text-neutral-400 font-semibold text-[10px] lg:max-xl:text-xs xl:text-sm uppercase tracking-wider">Kartu Grafis (GPU)</span>
                                ${this.getHwGpuBadge(hwData.gpu_name)}
                            </div>
                            <div class="flex items-center justify-between p-2 bg-[#070707] border border-[#181818] rounded-lg">
                                <span class="text-neutral-400 font-semibold text-[10px] lg:max-xl:text-xs xl:text-sm uppercase tracking-wider">Total Memori RAM</span>
                                ${this.getHwRamBadge(hwData.total_ram)}
                            </div>
                            <div class="flex items-center justify-between p-2 bg-[#070707] border border-[#181818] rounded-lg">
                                <span class="text-neutral-400 font-semibold text-[10px] lg:max-xl:text-xs xl:text-sm uppercase tracking-wider">Motherboard</span>
                                ${this.getHwMbBadge(hwData.motherboard)}
                            </div>
                            <div class="flex items-center justify-between p-2 bg-[#070707] border border-[#181818] rounded-lg">
                                <span class="text-neutral-400 font-semibold text-[10px] lg:max-xl:text-xs xl:text-sm uppercase tracking-wider">Kecepatan Jaringan (NIC)</span>
                                ${this.getHwNicBadge(hwData.nic_speed)}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Split Matrix: Baseline Terkunci vs Terdeteksi Saat Ini -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 min-w-0">
                    <!-- Card 4: Baseline Terkunci -->
                    <div class="p-4 sm:p-5 bg-[#0c0c0c] border border-[#202020] rounded-xl flex flex-col justify-between space-y-4 min-w-0 overflow-hidden">
                        <div class="min-w-0 w-full">
                            <div class="flex flex-wrap items-center border-b border-[#1c1c1c] pb-2.5 min-w-0 mb-3 gap-x-2 gap-y-1 min-h-[52px]">
                                <span class="text-xs font-bold text-neutral-300 uppercase tracking-wider font-mono flex items-center gap-1.5 flex-1 min-w-0">
                                    <span>🔒</span> Baseline Resmi (Terkunci)
                                </span>
                                <span class="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-900/60 font-bold uppercase tracking-wider shrink-0">
                                    ${baselineSpecs ? 'TERDAFTAR' : 'KOSONG'}
                                </span>
                            </div>

                            ${baselineSpecs ? `
                                <div class="space-y-3 font-mono min-w-0 w-full">
                                    <div class="min-w-0 w-full">
                                        <span class="text-[9px] lg:max-xl:text-[10px] xl:text-xs text-neutral-500 uppercase font-bold tracking-wider block mb-1.5">🛠️ Komponen Internal:</span>
                                        <ul class="text-xs lg:max-xl:text-xs xl:text-sm space-y-2 font-mono text-neutral-400 min-w-0 w-full">
                                            <li class="flex flex-wrap items-baseline gap-1.5 min-w-0 w-full">
                                                <strong class="text-neutral-500 shrink-0">Mobo Model:</strong>
                                                <span class="break-all text-emerald-300 min-w-0">${escapeHtml(baselineSpecs.Motherboard || baselineSpecs.MotherboardName || hwData.motherboard || 'N/A')}</span>
                                            </li>
                                            <li class="flex flex-wrap items-baseline gap-1.5 min-w-0 w-full">
                                                <strong class="text-neutral-500 shrink-0">Mobo Serial:</strong>
                                                <span class="break-all text-neutral-300 min-w-0">${escapeHtml(baselineSpecs.MotherboardSerial || 'N/A')}</span>
                                            </li>
                                            <li class="flex flex-wrap items-baseline gap-1.5 min-w-0 w-full">
                                                <strong class="text-neutral-500 shrink-0">CPU ID:</strong>
                                                <span class="break-all text-neutral-300 min-w-0">${escapeHtml(baselineSpecs.CpuId || 'N/A')}</span>
                                            </li>
                                            <li class="flex flex-col gap-1 min-w-0 w-full">
                                                <strong class="text-neutral-500 shrink-0">GPU PNP:</strong>
                                                <span class="break-all text-neutral-300 font-mono text-[10px] sm:text-[11px] lg:max-xl:text-[11px] xl:text-xs bg-[#070707] border border-[#181818] p-2 rounded block w-full select-all leading-relaxed min-w-0 overflow-hidden" title="${escapeHtml(baselineSpecs.GpuPnpId || 'N/A')}">${escapeHtml(baselineSpecs.GpuPnpId || 'N/A')}</span>
                                            </li>
                                            <li class="min-w-0 w-full">
                                                <strong class="text-neutral-500 shrink-0">RAM Serials:</strong>
                                                <div class="pt-1 min-w-0">
                                                    ${this.renderRamPills(baselineSpecs.RamSerials, true, baselineSpecs)}
                                                </div>
                                            </li>
                                            <li class="min-w-0 w-full">
                                                <strong class="text-neutral-500 shrink-0">Disks:</strong>
                                                <div class="pt-1 min-w-0">
                                                    ${this.renderDiskPills(baselineSpecs.DiskSerials, true, baselineSpecs)}
                                                </div>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            ` : `
                                <div class="py-10 text-center text-neutral-500 font-mono text-xs lg:max-xl:text-sm xl:text-base">
                                    <p>Belum ada baseline terdaftar.</p>
                                    <p class="text-[9px] lg:max-xl:text-xs xl:text-sm text-neutral-600 mt-1">Klik tombol <b>Update Baseline</b> di bawah untuk mendaftarkan spesifikasi resmi.</p>
                                </div>
                            `}
                        </div>
                    </div>

                    <!-- Card 5: Terdeteksi Saat Ini -->
                    <div class="p-4 sm:p-5 bg-[#0c0c0c] border border-[#202020] rounded-xl flex flex-col justify-between space-y-4 min-w-0 overflow-hidden">
                        <div class="min-w-0 w-full">
                            <div class="flex flex-wrap items-center border-b border-[#1c1c1c] pb-2.5 min-w-0 mb-3 gap-x-2 gap-y-1 min-h-[52px]">
                                <span class="text-xs font-bold text-neutral-300 uppercase tracking-wider font-mono flex items-center gap-1.5 flex-1 min-w-0">
                                    <span>🔍</span> Terdeteksi Saat Ini (Live Telemetry)
                                </span>
                                <span class="text-[10px] font-mono text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded border border-blue-900/60 font-bold uppercase tracking-wider shrink-0">
                                    ${currentSpecs ? 'LIVE SPECS' : 'KOSONG'}
                                </span>
                            </div>

                            ${currentSpecs ? `
                                <div class="space-y-3 font-mono min-w-0 w-full">
                                    <div class="min-w-0 w-full">
                                        <span class="text-[9px] lg:max-xl:text-[10px] xl:text-xs text-neutral-500 uppercase font-bold tracking-wider block mb-1.5">🛠️ Komponen Internal:</span>
                                        <ul class="text-xs lg:max-xl:text-xs xl:text-sm space-y-2 font-mono text-neutral-400 min-w-0 w-full">
                                            <li class="flex flex-wrap items-baseline gap-1.5 min-w-0 w-full">
                                                <strong class="text-neutral-500 shrink-0">Mobo Model:</strong>
                                                <span class="break-all text-emerald-300 min-w-0">${escapeHtml(currentSpecs.Motherboard || currentSpecs.MotherboardName || hwData.motherboard || 'N/A')}</span>
                                            </li>
                                            <li class="flex flex-wrap items-baseline gap-1.5 min-w-0 w-full">
                                                <strong class="text-neutral-500 shrink-0">Mobo Serial:</strong>
                                                <span class="break-all text-neutral-300 min-w-0">${escapeHtml(currentSpecs.MotherboardSerial || 'N/A')}</span>
                                            </li>
                                            <li class="flex flex-wrap items-baseline gap-1.5 min-w-0 w-full">
                                                <strong class="text-neutral-500 shrink-0">CPU ID:</strong>
                                                <span class="break-all text-neutral-300 min-w-0">${escapeHtml(currentSpecs.CpuId || 'N/A')}</span>
                                            </li>
                                            <li class="flex flex-col gap-1 min-w-0 w-full">
                                                <strong class="text-neutral-500 shrink-0">GPU PNP:</strong>
                                                <span class="break-all text-neutral-300 font-mono text-[10px] sm:text-[11px] lg:max-xl:text-[11px] xl:text-xs bg-[#070707] border border-[#181818] p-2 rounded block w-full select-all leading-relaxed min-w-0 overflow-hidden" title="${escapeHtml(currentSpecs.GpuPnpId || 'N/A')}">${escapeHtml(currentSpecs.GpuPnpId || 'N/A')}</span>
                                            </li>
                                            <li class="min-w-0 w-full">
                                                <strong class="text-neutral-500 shrink-0">RAM Serials:</strong>
                                                <div class="pt-1 min-w-0">
                                                    ${this.renderRamPills(currentSpecs.RamSerials, false, baselineSpecs)}
                                                </div>
                                            </li>
                                            <li class="min-w-0 w-full">
                                                <strong class="text-neutral-500 shrink-0">Disks:</strong>
                                                <div class="pt-1 min-w-0">
                                                    ${this.renderDiskPills(currentSpecs.DiskSerials, false, baselineSpecs)}
                                                </div>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            ` : `
                                <div class="py-10 text-center text-neutral-500 font-mono text-xs lg:max-xl:text-sm xl:text-base">
                                    <p>Belum ada data komponen live terdeteksi.</p>
                                </div>
                            `}
                        </div>
                    </div>
                </div>

                <div class="flex justify-end pt-2">
                    <button onclick="DashboardDetailModal.registerBaselineFromModal(${pcId}, '${escapeHtml(pcKode)}')"
                        class="px-4 py-2.5 bg-neutral-100 hover:bg-white text-black text-xs lg:max-xl:text-xs xl:text-sm font-bold rounded-lg transition-colors flex items-center gap-1.5 font-mono shadow-md">
                        🔄 Update Baseline Resmi
                    </button>
                </div>
            </div>
        `;
    },

    registerBaselineFromModal(pcId, pcKode) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        const targetKode = (pcKode || '').startsWith('PC') ? pcKode : `PC ${pcKode}`;
        
        const confirmOverlayId = 'hw-baseline-confirm-overlay';
        const existing = document.getElementById(confirmOverlayId);
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = confirmOverlayId;
        overlay.className = 'fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in';
        overlay.innerHTML = `
            <div class="bg-[#0e0e0e] border border-[#262626] rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-amber-950/60 border border-amber-800/60 flex items-center justify-center text-lg shrink-0">
                        ⚠️
                    </div>
                    <div>
                        <h3 class="text-xs lg:text-sm font-bold text-neutral-100 uppercase tracking-wider font-mono">Perbarui Baseline Hardware</h3>
                        <p class="text-xs text-amber-400 font-mono font-bold">${targetKode}</p>
                    </div>
                </div>
                <div class="p-3.5 bg-[#141414] border border-[#222] rounded-lg">
                    <p class="text-xs text-neutral-300 leading-relaxed font-sans">
                        ⚠️ Gunakan tombol ini <b>HANYA</b> jika Anda (Owner/Admin) baru saja melakukan upgrade atau penggantian komponen fisik secara resmi pada <b>${targetKode}</b>.
                    </p>
                </div>
                <div class="flex gap-3 justify-end pt-1">
                    <button id="btn-hw-baseline-cancel" class="px-4 py-2 bg-[#1a1a1a] hover:bg-[#252525] border border-[#2a2a2a] text-neutral-300 text-xs font-bold rounded-lg transition-colors font-mono">
                        Batal
                    </button>
                    <button id="btn-hw-baseline-confirm" class="px-4 py-2 bg-neutral-100 hover:bg-white text-black text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 font-mono">
                        Ya, Lanjutkan
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const closeOverlay = () => {
            overlay.remove();
        };

        const cancelBtn = document.getElementById('btn-hw-baseline-cancel');
        if (cancelBtn) cancelBtn.onclick = closeOverlay;

        const confirmBtn = document.getElementById('btn-hw-baseline-confirm');
        if (confirmBtn) {
            confirmBtn.onclick = async () => {
                confirmBtn.disabled = true;
                confirmBtn.innerText = 'Memperbarui...';
                try {
                    Toast.info('Memperbarui baseline hardware...');
                    const res = await API.monitor.registerBaseline(pcId);
                    if (res && res.success) {
                        Toast.success(`Baseline hardware ${targetKode} berhasil diperbarui!`);
                        closeOverlay();
                        DashboardDetailModal.loadHardwareData(pcId, pcKode, false);
                    } else {
                        Toast.error((res && res.error) || 'Gagal memperbarui baseline');
                        confirmBtn.disabled = false;
                        confirmBtn.innerText = 'Ya, Lanjutkan';
                    }
                } catch (err) {
                    Toast.error(err.message || 'Gagal memperbarui baseline');
                    confirmBtn.disabled = false;
                    confirmBtn.innerText = 'Ya, Lanjutkan';
                }
            };
        }
    },

    syncLive: function(pcList) {
        const modalEl = document.getElementById('pc-detail-modal-card');
        if (!modalEl || !this.currentPcId) return;

        let targetPcList = pcList;
        if (!targetPcList && typeof Dashboard !== 'undefined' && Dashboard.lastData) {
            targetPcList = Dashboard.lastData.pc_list;
        }
        if (!targetPcList || !Array.isArray(targetPcList)) return;

        const pc = targetPcList.find(p => p.id === this.currentPcId);
        if (!pc) return;

        const isOnline = pc.status !== 'offline';
        const sesi = pc.sesi_detail;
        const isAfk = pc.is_afk || sesi?.is_afk;
        const isSystemMode = pc.is_system_mode || pc.status === 'system' || (sesi?.tipe === 'admin' && ((sesi?.nama_guest || '').toUpperCase() === 'SYSTEM' || (sesi?.member_nama || '').toUpperCase() === 'SYSTEM'));
        const isAdminMode = !isSystemMode && (pc.is_admin_mode || pc.status === 'admin' || (sesi?.tipe === 'admin'));

        // 1. In-place Update Header Mode Badge
        const badgeContainer = document.getElementById('pc-detail-modal-mode-badge');
        if (badgeContainer) {
            badgeContainer.innerHTML = isAfk ? '<span class="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded">🔒 AFK / Istirahat</span>' : (isSystemMode ? '<span class="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded">SYSTEM MODE</span>' : (isAdminMode ? '<span class="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded">ADMIN MODE</span>' : ''));
        }

        // 2. In-place Update Action Buttons Grid (kunci dengan state fingerprint agar 0 flicker pada tombol)
        const actionGrid = document.getElementById('modal-action-buttons-grid');
        const viewActionMenu = document.getElementById('view-action-menu');
        if (actionGrid && viewActionMenu && !viewActionMenu.classList.contains('hidden')) {
            const stateKey = `${pc.status}_${isOnline}_${Boolean(sesi)}_${Boolean(isAfk)}_${Boolean(isSystemMode)}_${Boolean(isAdminMode)}`;
            if (this._lastActionStateKey !== stateKey) {
                this._lastActionStateKey = stateKey;
                actionGrid.innerHTML = this.renderActionButtonsHtml(pc, isOnline, sesi, isAfk, isSystemMode, isAdminMode);
            }
        }

        // 3. In-place Update Screenshot Preview (delta-check anti-flicker)
        if (pc.screenshot_time && pc.screenshot_time !== this.lastScreenshotTime) {
            this.lastScreenshotTime = pc.screenshot_time;
            const timeEl = document.getElementById('screenshot-time');
            if (timeEl) timeEl.innerText = pc.screenshot_time;

            const imgEl = document.getElementById('screenshot-img');
            const placeholderEl = document.getElementById('screenshot-placeholder');
            const hintEl = document.getElementById('screenshot-fullscreen-hint');

            if (pc.screenshot_url) {
                const resolvedUrl = window.API ? API.resolveMediaUrl(pc.screenshot_url) : pc.screenshot_url;
                if (imgEl) {
                    imgEl.src = `${resolvedUrl}?t=${Date.now()}`;
                    imgEl.classList.remove('hidden');
                }
                if (placeholderEl) placeholderEl.classList.add('hidden');
                if (hintEl) hintEl.classList.remove('hidden');
            }
        }

        // 4. In-place Update Live Hardware Telemetry jika Tab Hardware Specs sedang aktif
        const hwView = document.getElementById('view-hardware-specs');
        if (hwView && !hwView.classList.contains('hidden') && this.currentPcId) {
            this.loadHardwareData(this.currentPcId, this.currentHardwarePcKode || pc.kode, true);
        }
    },


};
