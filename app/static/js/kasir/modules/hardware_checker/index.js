const HardwareChecker = {
    isLoading: false,
    _cachedData: [],
    filterGroup: 'all',

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

    refreshLive() {
        if (typeof App !== 'undefined' && App.currentTab !== 'hardware_checker') return;
        return this.load(false, true);
    },

    async load(isInitial = false, isSilent = false) {
        if (this.isLoading) return;
        this.isLoading = true;

        const container = document.getElementById('hardware-checker-container');
        const isShowingSkeleton = container && (container.querySelector('.animate-pulse') !== null || !container.querySelector('.hardware-checker-card'));

        if (container && (isShowingSkeleton || isInitial) && !isSilent) {
            container.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-2 gap-3.5 sm:gap-4">
                    ${Array.from({ length: 4 }).map(() => `
                        <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-3.5 sm:p-4 space-y-3 animate-pulse">
                            <div class="flex items-center justify-between gap-2 pb-2.5 border-b border-[#1c1c1c]">
                                <div class="flex items-center gap-2">
                                    <div class="h-4 w-16 bg-[#202020] rounded"></div>
                                    <div class="h-4 w-14 bg-[#1a1a1a] rounded"></div>
                                    <div class="h-4 w-20 bg-[#181818] rounded"></div>
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <div class="h-6 w-14 bg-[#1a1a1a] rounded"></div>
                                    <div class="h-6 w-16 bg-[#202020] rounded"></div>
                                </div>
                            </div>
                            <div class="bg-[#050505] border border-[#1c1c1c] rounded p-2.5 sm:p-3 space-y-2">
                                <div class="flex items-center justify-between border-b border-[#1c1c1c] pb-1.5">
                                    <div class="h-3 w-16 bg-[#202020] rounded"></div>
                                    <div class="h-3 w-28 bg-[#1a1a1a] rounded"></div>
                                </div>
                                <div class="grid grid-cols-3 gap-2 pt-1">
                                    <div class="h-7 bg-[#141414] rounded"></div>
                                    <div class="h-7 bg-[#141414] rounded"></div>
                                    <div class="h-7 bg-[#141414] rounded"></div>
                                </div>
                                <div class="flex items-center justify-between pt-1 border-t border-[#1c1c1c]/60">
                                    <div class="h-2.5 w-24 bg-[#161616] rounded"></div>
                                    <div class="h-2.5 w-16 bg-[#161616] rounded"></div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        try {
            const result = await window.API.monitor.all();
            if (result && result.success) {
                this._cachedData = Array.isArray(result.data) ? result.data : [];
                this.populateGroupFilter(this._cachedData);

                const fingerprint = JSON.stringify(result.data) + `_group_${this.filterGroup}`;
                if (!isSilent || this._lastFingerprint !== fingerprint || isShowingSkeleton) {
                    this._lastFingerprint = fingerprint;
                    this.render(this._cachedData);
                }
            } else if (!isSilent) {
                Toast.error("Gagal memuat status hardware checker");
            }
        } catch (error) {
            if (!isSilent) {
                console.error('[HardwareChecker] Load error:', error);
                Toast.error("Gagal memuat status hardware checker");
                if (container) {
                    container.innerHTML = '<div class="text-center py-10 text-red-400 text-sm font-medium">Gagal memuat data hardware checker.</div>';
                }
            }
        } finally {
            this.isLoading = false;
        }
    },

    populateGroupFilter(data) {
        const select = document.getElementById('hc-group-filter');
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
            optionsHtml += `<option value="${g.id}">${this.escapeHtml(g.name.toUpperCase())}</option>`;
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
        if (this._cachedData && this._cachedData.length > 0) {
            this.render(this._cachedData);
        }
    },

    async registerBaseline(pcId, pcKode, fromModal = false) {
        const targetKode = (pcKode || '').startsWith('PC') ? pcKode : `PC ${pcKode}`;
        if (!confirm(`Apakah Anda yakin ingin memperbarui baseline hardware & peripheral untuk ${targetKode}?\n\nGunakan tombol ini HANYA jika Anda (Owner/Admin) baru saja melakukan upgrade fisik atau mengganti periferal resmi pada ${targetKode}.`)) {
            return;
        }
        try {
            Toast.info("Memperbarui baseline hardware & periferal...");
            const res = await API.request(`/api/v1/kasir/monitor/register/${pcId}`, {
                method: 'POST'
            });
            if (res && res.success) {
                Toast.success(`Baseline ${targetKode} berhasil diperbarui!`);
                this._lastFingerprint = null;
                await this.load(false, true);
                if (fromModal) {
                    this.showDetailModal(pcId);
                }
            } else {
                Toast.error(res.error || "Gagal memperbarui baseline");
            }
        } catch (err) {
            Toast.error(err.message || "Gagal memperbarui baseline");
        }
    },

    showDetailModal(pcId) {
        const m = (this._cachedData || []).find(p => String(p.pc_id) === String(pcId));
        if (!m) {
            Toast.error("Data spesifikasi PC tidak ditemukan");
            return;
        }

        const hasBaseline = !!m.hardware_baseline;
        const isHwMismatch = m.hardware_mismatch === true;

        let baselineSpecs = null;
        let currentSpecs = null;
        try {
            if (m.hardware_baseline) baselineSpecs = JSON.parse(m.hardware_baseline);
            if (m.hardware_current_specs) currentSpecs = JSON.parse(m.hardware_current_specs);
        } catch (err) {}

        let hwBadge = '';
        if (isHwMismatch) {
            hwBadge = `
                <span class="px-2 py-0.5 rounded bg-red-950/80 border border-red-500/80 text-red-200 text-[10px] font-bold uppercase tracking-wider animate-pulse flex items-center gap-1 shrink-0">
                    🚨 Ditukar
                </span>`;
        } else if (hasBaseline) {
            hwBadge = `
                <span class="px-2 py-0.5 rounded bg-green-950/60 border border-green-500/50 text-green-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0">
                    🛡️ Aman
                </span>`;
        } else {
            hwBadge = `
                <span class="px-2 py-0.5 rounded bg-amber-950/50 border border-amber-600/50 text-amber-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0">
                    ⚙️ Pending
                </span>`;
        }

        let alertHtml = '';
        if (isHwMismatch) {
            const cctvWindowDisplay = m.hardware_cctv_window || `${m.hardware_mismatch_time || '--:--'} (saat booting)`;
            alertHtml = `
                <div class="p-3 bg-red-950/40 border border-red-500/40 rounded text-xs space-y-2">
                    <div class="flex items-center gap-1.5 font-bold text-red-400 uppercase tracking-wider text-xs">
                        <span>🚨</span> DETEKSI PERUBAHAN HARDWARE
                    </div>
                    <div class="font-mono text-xs pl-2.5 border-l-2 border-red-500 bg-red-950/60 p-2.5 rounded text-red-200 break-words whitespace-pre-wrap">
                        ${this.escapeHtml(m.hardware_mismatch_desc || 'Hardware signature tidak cocok')}
                    </div>
                    <div class="text-xs text-neutral-400 flex flex-wrap items-center gap-1.5">
                        <span>🎥</span> <strong class="text-neutral-300 uppercase">Estimasi CCTV:</strong> 
                        <span class="font-mono font-bold text-red-300">${this.escapeHtml(cctvWindowDisplay)}</span>
                    </div>
                </div>`;
        }

        const renderRamPills = (serials, isBaseline) => {
            if (!serials || !serials.length) return '<span class="text-neutral-600 font-mono text-xs">N/A</span>';
            return serials.map(r => {
                let isMatched = true;
                if (!isBaseline && baselineSpecs && baselineSpecs.RamSerials && baselineSpecs.RamSerials.length) {
                    isMatched = baselineSpecs.RamSerials.includes(r);
                }
                if (!isMatched) {
                    return `<span class="inline-block bg-red-950/90 text-red-200 border border-red-500 px-2 py-0.5 rounded mr-1.5 mb-1.5 font-bold text-[11px] font-mono animate-pulse">🚨 ${this.escapeHtml(r)}</span>`;
                }
                return `<span class="inline-block bg-[#121212] text-purple-300 border border-purple-900/50 px-2 py-0.5 rounded mr-1.5 mb-1.5 font-bold text-[11px] font-mono">🏷️ ${this.escapeHtml(r)}</span>`;
            }).join('');
        };

        const renderDiskPills = (serials, isBaseline) => {
            if (!serials || !serials.length) return '<span class="text-neutral-600 font-mono text-xs">N/A</span>';
            return serials.map(d => {
                let isMatched = true;
                if (!isBaseline && baselineSpecs && baselineSpecs.DiskSerials && baselineSpecs.DiskSerials.length) {
                    isMatched = baselineSpecs.DiskSerials.includes(d);
                }
                if (!isMatched) {
                    return `<span class="inline-block bg-red-950/90 text-red-200 border border-red-500 px-2 py-0.5 rounded mr-1.5 mb-1.5 font-bold text-[11px] font-mono animate-pulse">🚨 ${this.escapeHtml(d)}</span>`;
                }
                return `<span class="inline-block bg-[#121212] text-cyan-300 border border-cyan-900/50 px-2 py-0.5 rounded mr-1.5 mb-1.5 font-bold text-[11px] font-mono">💽 ${this.escapeHtml(d)}</span>`;
            }).join('');
        };

        const nicBadgeHtml = this.getNicSpeedBadge(m.nic_speed);

        const modalContent = `
            <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded-lg max-w-4xl w-[calc(100%-2rem)] mx-auto shadow-2xl flex flex-col max-h-[90vh]">
                <!-- Header -->
                <div class="flex items-center justify-between p-4 sm:p-5 border-b border-[#1c1c1c] shrink-0">
                    <div class="flex items-center gap-2.5 flex-wrap">
                        <span class="text-lg font-black text-neutral-100 font-mono tracking-wider">${this.escapeHtml(m.pc_kode)}</span>
                        <span class="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-[#171717] border border-[#262626] text-neutral-300">
                            ${this.escapeHtml(m.pc_grup_nama || 'REGULER')}
                        </span>
                        ${hwBadge}
                    </div>
                    <button type="button" onclick="Modal.closeModal()" class="text-neutral-400 hover:text-neutral-200 p-1 rounded hover:bg-[#1c1c1c] transition-colors" title="Tutup Modal">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <!-- Body -->
                <div class="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[70vh] scrollbar-thin">
                    ${alertHtml}

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <!-- Baseline Specs -->
                        <div class="p-4 bg-[#050505] border border-[#1c1c1c] rounded space-y-3">
                            <div class="flex items-center justify-between border-b border-[#1c1c1c] pb-2">
                                <span class="text-xs font-bold text-neutral-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                                    <span>🔒</span> Baseline Resmi
                                </span>
                                <span class="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-900/60 font-bold uppercase">
                                    ${baselineSpecs ? 'TERKUNCI' : 'KOSONG'}
                                </span>
                            </div>
                            ${baselineSpecs ? `
                                <ul class="text-xs space-y-2 font-mono text-neutral-400">
                                    <li class="flex flex-col gap-0.5">
                                        <strong class="text-neutral-500 uppercase text-[10px]">Motherboard:</strong>
                                        <span class="text-emerald-300 select-all font-semibold">${this.escapeHtml(m.motherboard || 'N/A')}</span>
                                    </li>
                                    <li class="flex flex-col gap-0.5">
                                        <strong class="text-neutral-500 uppercase text-[10px]">Serial Motherboard:</strong>
                                        <span class="text-neutral-200 select-all bg-[#0a0a0a] border border-[#1c1c1c] p-1.5 rounded">${this.escapeHtml(baselineSpecs.MotherboardSerial || 'N/A')}</span>
                                    </li>
                                    <li class="flex flex-col gap-0.5">
                                        <strong class="text-neutral-500 uppercase text-[10px]">CPU:</strong>
                                        <span class="text-neutral-300 font-semibold">${this.escapeHtml(m.cpu_name || 'N/A')}</span>
                                    </li>
                                    <li class="flex flex-col gap-0.5">
                                        <strong class="text-neutral-500 uppercase text-[10px]">CPU ID:</strong>
                                        <span class="text-neutral-200 select-all bg-[#0a0a0a] border border-[#1c1c1c] p-1.5 rounded">${this.escapeHtml(baselineSpecs.CpuId || 'N/A')}</span>
                                    </li>
                                    <li class="flex flex-col gap-0.5">
                                        <strong class="text-neutral-500 uppercase text-[10px]">GPU:</strong>
                                        <span class="text-neutral-300 font-semibold">${this.escapeHtml(m.gpu_name || 'N/A')}</span>
                                    </li>
                                    <li class="flex flex-col gap-0.5">
                                        <strong class="text-neutral-500 uppercase text-[10px]">GPU PNP ID:</strong>
                                        <span class="text-neutral-300 text-[11px] bg-[#0c0c0c] border border-[#1c1c1c] p-2 rounded block select-all break-all leading-normal">${this.escapeHtml(baselineSpecs.GpuPnpId || 'N/A')}</span>
                                    </li>
                                    <li class="flex flex-col gap-1">
                                        <strong class="text-neutral-500 uppercase text-[10px]">RAM Serials:</strong>
                                        <div class="flex flex-wrap">${renderRamPills(baselineSpecs.RamSerials, true)}</div>
                                    </li>
                                    <li class="flex flex-col gap-1">
                                        <strong class="text-neutral-500 uppercase text-[10px]">Disk Serials:</strong>
                                        <div class="flex flex-wrap">${renderDiskPills(baselineSpecs.DiskSerials, true)}</div>
                                    </li>
                                </ul>
                            ` : '<p class="text-xs text-neutral-500 italic">Belum ada baseline terdaftar.</p>'}
                        </div>

                        <!-- Live Telemetry Specs -->
                        <div class="p-4 bg-[#050505] border border-[#1c1c1c] rounded space-y-3">
                            <div class="flex items-center justify-between border-b border-[#1c1c1c] pb-2">
                                <span class="text-xs font-bold text-neutral-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                                    <span>🔍</span> Live Telemetry
                                </span>
                                <span class="text-[10px] font-mono text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded border border-blue-900/60 font-bold uppercase">
                                    ${currentSpecs ? 'LIVE' : 'KOSONG'}
                                </span>
                            </div>
                            ${currentSpecs ? `
                                <ul class="text-xs space-y-2 font-mono text-neutral-400">
                                    <li class="flex flex-col gap-0.5">
                                        <strong class="text-neutral-500 uppercase text-[10px]">Motherboard:</strong>
                                        <span class="text-emerald-300 select-all font-semibold">${this.escapeHtml(m.motherboard || 'N/A')}</span>
                                    </li>
                                    <li class="flex flex-col gap-0.5">
                                        <strong class="text-neutral-500 uppercase text-[10px]">Serial Motherboard:</strong>
                                        <span class="text-neutral-200 select-all bg-[#0a0a0a] border border-[#1c1c1c] p-1.5 rounded">${this.escapeHtml(currentSpecs.MotherboardSerial || 'N/A')}</span>
                                    </li>
                                    <li class="flex flex-col gap-0.5">
                                        <strong class="text-neutral-500 uppercase text-[10px]">CPU:</strong>
                                        <span class="text-neutral-300 font-semibold">${this.escapeHtml(m.cpu_name || 'N/A')}</span>
                                    </li>
                                    <li class="flex flex-col gap-0.5">
                                        <strong class="text-neutral-500 uppercase text-[10px]">CPU ID:</strong>
                                        <span class="text-neutral-200 select-all bg-[#0a0a0a] border border-[#1c1c1c] p-1.5 rounded">${this.escapeHtml(currentSpecs.CpuId || 'N/A')}</span>
                                    </li>
                                    <li class="flex flex-col gap-0.5">
                                        <strong class="text-neutral-500 uppercase text-[10px]">GPU:</strong>
                                        <span class="text-neutral-300 font-semibold">${this.escapeHtml(m.gpu_name || 'N/A')}</span>
                                    </li>
                                    <li class="flex flex-col gap-0.5">
                                        <strong class="text-neutral-500 uppercase text-[10px]">GPU PNP ID:</strong>
                                        <span class="text-neutral-300 text-[11px] bg-[#0c0c0c] border border-[#1c1c1c] p-2 rounded block select-all break-all leading-normal">${this.escapeHtml(currentSpecs.GpuPnpId || 'N/A')}</span>
                                    </li>
                                    <li class="flex flex-col gap-1">
                                        <strong class="text-neutral-500 uppercase text-[10px]">RAM Serials:</strong>
                                        <div class="flex flex-wrap">${renderRamPills(currentSpecs.RamSerials, false)}</div>
                                    </li>
                                    <li class="flex flex-col gap-1">
                                        <strong class="text-neutral-500 uppercase text-[10px]">Disk Serials:</strong>
                                        <div class="flex flex-wrap">${renderDiskPills(currentSpecs.DiskSerials, false)}</div>
                                    </li>
                                </ul>
                            ` : '<p class="text-xs text-neutral-500 italic">Belum ada telemetry terdeteksi.</p>'}
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="flex items-center justify-between p-4 sm:p-5 border-t border-[#1c1c1c] shrink-0 bg-[#080808]">
                    <div class="flex items-center gap-3 text-xs text-neutral-400 font-mono">
                        <span>Sync: <strong class="text-neutral-200">${this.escapeHtml(m.hardware_last_sync || m.last_update || 'Baru saja')}</strong></span>
                        <span class="hidden sm:inline">&bull;</span>
                        <span class="hidden sm:inline">${nicBadgeHtml}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" onclick="Modal.closeModal()"
                            class="px-4 py-2 bg-[#171717] hover:bg-[#222] border border-[#262626] text-neutral-300 text-xs font-bold rounded transition-colors">
                            Tutup
                        </button>
                        <button type="button" onclick="HardwareChecker.registerBaseline(${m.pc_id}, '${this.escapeHtml(m.pc_kode)}', true);"
                            class="remote-hide-action px-4 py-2 bg-neutral-100 hover:bg-white text-black text-xs font-bold rounded transition-colors flex items-center gap-1.5 shadow">
                            <span>🔄</span> Perbarui Baseline
                        </button>
                    </div>
                </div>
            </div>
        `;

        Modal.show(modalContent, null, { disableBackdropClose: false });
    },

    renderCard(m) {
        const hasBaseline = !!m.hardware_baseline;
        const isHwMismatch = m.hardware_mismatch === true;

        let cardBorder = 'border-[#1c1c1c] hover:border-[#2a2a2a]';
        if (isHwMismatch) {
            cardBorder = 'border-red-500/50 bg-red-950/10 shadow-lg shadow-red-950/20';
        }

        let hwBadge = '';
        if (isHwMismatch) {
            hwBadge = `
                <span class="px-2 py-0.5 rounded bg-red-950/80 border border-red-500/80 text-red-200 text-[10px] font-bold uppercase tracking-wider animate-pulse flex items-center gap-1 shrink-0">
                    🚨 Ditukar
                </span>`;
        } else if (hasBaseline) {
            hwBadge = `
                <span class="px-2 py-0.5 rounded bg-green-950/60 border border-green-500/50 text-green-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0">
                    🛡️ Aman
                </span>`;
        } else {
            hwBadge = `
                <span class="px-2 py-0.5 rounded bg-amber-950/50 border border-amber-600/50 text-amber-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0">
                    ⚙️ Pending
                </span>`;
        }

        let alertHtml = '';
        if (isHwMismatch) {
            alertHtml = `
                <div class="p-2.5 bg-red-950/30 border border-red-500/30 rounded text-xs space-y-1 min-w-0">
                    <div class="flex items-center gap-1.5 font-bold text-red-400 text-[11px]">
                        <span>🚨</span> DETEKSI PERUBAHAN HARDWARE:
                    </div>
                    <p class="font-mono text-[11px] text-red-200 line-clamp-2">${this.escapeHtml(m.hardware_mismatch_desc || 'Hardware signature mismatch')}</p>
                </div>`;
        }

        const nicBadgeHtml = this.getNicSpeedBadge(m.nic_speed);

        return `
            <div class="hardware-checker-card bg-[#0c0c0c] border ${cardBorder} rounded-lg p-3 sm:p-3.5 md:p-4 transition-all space-y-2.5 min-w-0 overflow-hidden">
                <!-- Top Bar: Header & Actions -->
                <div class="flex items-center justify-between gap-2 pb-2.5 border-b border-[#1c1c1c] min-w-0">
                    <div class="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap">
                        <h4 class="text-sm sm:text-base font-black text-neutral-100 font-mono tracking-wider">${this.escapeHtml(m.pc_kode)}</h4>
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#171717] border border-[#262626] text-neutral-400">
                            ${this.escapeHtml(m.pc_grup_nama || 'REGULER')}
                        </span>
                        ${hwBadge}
                    </div>

                    <div class="flex items-center gap-1.5 shrink-0">
                        <button type="button" onclick="HardwareChecker.showDetailModal(${m.pc_id})"
                            class="px-2.5 py-1 sm:py-1.5 bg-[#171717] hover:bg-[#222] border border-[#262626] text-neutral-200 text-[11px] sm:text-xs font-bold rounded transition-colors flex items-center gap-1" title="Lihat detail spesifikasi lengkap">
                            <span>🔍</span> <span>Detail</span>
                        </button>
                        <button type="button" onclick="HardwareChecker.registerBaseline(${m.pc_id}, '${this.escapeHtml(m.pc_kode)}')"
                            class="remote-hide-action px-2.5 py-1 sm:py-1.5 bg-neutral-100 hover:bg-white text-black text-[11px] sm:text-xs font-bold rounded transition-colors flex items-center gap-1" title="Perbarui baseline hardware resmi">
                            <span>🔄</span> <span class="hidden sm:inline">Baseline</span>
                        </button>
                    </div>
                </div>

                <!-- Internal Specs Summary -->
                <div class="bg-[#050505] border border-[#1c1c1c] rounded p-2.5 sm:p-3 space-y-2 min-w-0">
                    <div class="text-[11px] text-neutral-400 font-bold uppercase tracking-wider flex items-center justify-between border-b border-[#1c1c1c] pb-1.5 min-w-0">
                        <span class="flex items-center gap-1 font-mono text-neutral-300"><span>🛠️</span> Specs</span>
                        <span class="text-[10px] font-mono text-neutral-500 font-normal truncate max-w-[150px] sm:max-w-[220px]" title="${this.escapeHtml(m.motherboard || 'Motherboard')}">${this.escapeHtml(m.motherboard || 'Motherboard')}</span>
                    </div>
                    <div class="grid grid-cols-3 gap-2 text-xs font-mono text-neutral-400 min-w-0">
                        <div class="min-w-0">
                            <span class="text-[9px] text-neutral-500 uppercase font-semibold block truncate">Processor</span>
                            <span class="text-[11px] sm:text-xs text-neutral-200 truncate block font-mono" title="${this.escapeHtml(m.cpu_name || 'N/A')}">${this.escapeHtml(m.cpu_name || 'N/A')}</span>
                        </div>
                        <div class="min-w-0">
                            <span class="text-[9px] text-neutral-500 uppercase font-semibold block truncate">Graphics</span>
                            <span class="text-[11px] sm:text-xs text-neutral-200 truncate block font-mono" title="${this.escapeHtml(m.gpu_name || 'N/A')}">${this.escapeHtml(m.gpu_name || 'N/A')}</span>
                        </div>
                        <div class="min-w-0">
                            <span class="text-[9px] text-neutral-500 uppercase font-semibold block truncate">Memory</span>
                            <span class="text-[11px] sm:text-xs text-neutral-200 truncate block font-mono" title="${this.escapeHtml(m.total_ram || 'N/A')}">${this.escapeHtml(m.total_ram || 'N/A')}</span>
                        </div>
                    </div>
                    <div class="text-[10px] text-neutral-500 pt-1.5 border-t border-[#1c1c1c]/60 flex items-center justify-between gap-2 min-w-0">
                        <span class="truncate">Sync: <strong class="text-neutral-300">${this.escapeHtml(m.hardware_last_sync || m.last_update || 'Baru saja')}</strong></span>
                        ${nicBadgeHtml}
                    </div>
                </div>

                <!-- Alert Panels (if any) -->
                ${alertHtml}
            </div>
        `;
    },

    render(data) {
        const container = document.getElementById('hardware-checker-container');
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-neutral-500 space-y-2 col-span-1 lg:col-span-2">
                    <span class="text-3xl mb-1">🖥️</span>
                    <p class="text-xs lg:text-sm xl:text-base font-bold text-neutral-200 uppercase tracking-wider">Belum Ada Data Monitor PC</p>
                    <p class="text-[10px] lg:text-xs text-neutral-500">Pastikan TMBilling Monitor Agent berjalan pada setiap client</p>
                </div>`;
            return;
        }

        const sortedData = [...data].sort((a, b) => {
            const grupA = Number(a.pc_grup_id || 0);
            const grupB = Number(b.pc_grup_id || 0);
            if (grupA !== grupB) return grupA - grupB;
            return (a.pc_kode || '').localeCompare(b.pc_kode || '', undefined, { numeric: true, sensitivity: 'base' });
        });

        if (this.filterGroup !== 'all') {
            const filteredData = sortedData.filter(m => String(m.pc_grup_id || '0') === String(this.filterGroup));
            if (filteredData.length === 0) {
                container.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-16 text-neutral-500 space-y-2 col-span-1 lg:col-span-2">
                        <span class="text-2xl mb-1">🔍</span>
                        <p class="text-xs lg:text-sm font-bold text-neutral-200 uppercase tracking-wider">Tidak Ada PC Pada Grup Ini</p>
                        <p class="text-[10px] lg:text-xs text-neutral-500">Silakan pilih grup lain pada filter di atas</p>
                    </div>`;
                return;
            }

            container.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-2 gap-3 sm:gap-4">
                    ${filteredData.map(m => this.renderCard(m)).join('')}
                </div>
            `;
            return;
        }

        // Grouping berdasarkan pc_grup_id saat "Semua Grup" (all)
        const groupMap = new Map();
        sortedData.forEach(m => {
            const gid = m.pc_grup_id !== null && m.pc_grup_id !== undefined ? String(m.pc_grup_id) : '0';
            const gname = m.pc_grup_nama || 'REGULER';
            if (!groupMap.has(gid)) {
                groupMap.set(gid, { id: Number(gid), name: gname, items: [] });
            }
            groupMap.get(gid).items.push(m);
        });

        const sortedGroupEntries = Array.from(groupMap.values()).sort((a, b) => a.id - b.id);

        let html = '';
        sortedGroupEntries.forEach(g => {
            html += `
                <div class="space-y-3 mb-6">
                    <div class="flex items-center gap-2 pb-2 border-b border-[#1c1c1c]">
                        <span class="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono">
                            [ ${this.escapeHtml(g.name)} &bull; ${g.items.length} UNIT ]
                        </span>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-2 gap-3 sm:gap-4">
                        ${g.items.map(m => this.renderCard(m)).join('')}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }
};

window.HardwareChecker = HardwareChecker;
