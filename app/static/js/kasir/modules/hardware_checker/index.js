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
            return '<span class="text-neutral-600 font-mono text-xs whitespace-nowrap">-</span>';
        }
        const str = String(nicSpeed).replace(/\s+/g, ' ').trim();
        const lower = str.toLowerCase();
        
        let isGigabitOrMore = false;
        if (lower.includes('gbps')) {
            const val = parseFloat(lower.replace(/[^0-9.]/g, ''));
            isGigabitOrMore = !isNaN(val) && val >= 1.0;
        } else if (lower.includes('mbps')) {
            const val = parseFloat(lower.replace(/[^0-9.]/g, ''));
            isGigabitOrMore = !isNaN(val) && val >= 1000.0;
        }

        const displayText = isGigabitOrMore ? '1 Gbps' : str;

        if (isGigabitOrMore) {
            return `<span class="px-1.5 sm:px-2 py-0.5 rounded border border-[#262626] bg-[#121212] text-neutral-300 font-mono font-bold text-[10px] sm:text-[11px] xl:text-xs whitespace-nowrap inline-flex items-center justify-center shrink-0"><span class="sm:hidden">1G</span><span class="hidden sm:inline">1 Gbps</span></span>`;
        } else {
            return `<span class="px-1.5 sm:px-2 py-0.5 rounded border border-red-950 bg-red-950/40 text-red-400 font-mono font-bold text-[10px] sm:text-[11px] xl:text-xs whitespace-nowrap inline-flex items-center justify-center shrink-0 animate-pulse" title="Kecepatan LAN di bawah 1 Gbps">${this.escapeHtml(displayText)}</span>`;
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
        const isShowingSkeleton = container && (container.querySelector('.animate-pulse') !== null || !container.querySelector('.hardware-checker-table'));

        if (container && (isShowingSkeleton || isInitial) && !isSilent) {
            container.innerHTML = `
                <div class="hardware-checker-table overflow-x-auto w-full border border-[#1c1c1c] rounded scrollbar-thin">
                    <table class="w-full text-xs xl:text-sm">
                        <thead>
                            <tr class="text-[10px] xl:text-xs text-neutral-500 uppercase tracking-wider border-b border-[#1c1c1c] bg-[#0c0c0c]">
                                <th class="px-1 sm:px-2 xl:px-4 py-1.5 sm:py-2 xl:py-3 text-left font-bold whitespace-nowrap min-w-[50px] sm:min-w-[75px] xl:min-w-[120px]">PC</th>
                                <th class="hidden 2xl:table-cell px-3 xl:px-4 py-3 text-left font-bold whitespace-nowrap w-32">Status</th>
                                <!-- Spesifikasi Header (< 2xl: sm, md, lg, xl) -->
                                <th class="2xl:hidden px-1 sm:px-2 xl:px-3 py-1.5 sm:py-2 xl:py-3 text-left font-bold min-w-[75px] sm:min-w-[130px]">Spesifikasi</th>
                                <!-- Wide Headers (≥ 2xl) -->
                                <th class="hidden 2xl:table-cell px-3 xl:px-4 py-3 text-left font-bold whitespace-nowrap min-w-[140px]">Motherboard</th>
                                <th class="hidden 2xl:table-cell px-3 xl:px-4 py-3 text-left font-bold whitespace-nowrap min-w-[150px]">Processor</th>
                                <th class="hidden 2xl:table-cell px-3 xl:px-4 py-3 text-left font-bold whitespace-nowrap min-w-[140px]">Graphics</th>
                                <!-- RAM & LAN Header (< 2xl) -->
                                <th class="2xl:hidden px-1 sm:px-1.5 xl:px-3 py-1.5 sm:py-2 xl:py-3 text-center font-bold whitespace-nowrap w-12 sm:w-16 xl:w-24">RAM & LAN</th>
                                <!-- Separate Headers (≥ 2xl) -->
                                <th class="hidden 2xl:table-cell px-3 xl:px-4 py-3 text-left font-bold whitespace-nowrap min-w-[110px]">Total RAM</th>
                                <th class="hidden 2xl:table-cell px-3 xl:px-4 py-3 text-center font-bold whitespace-nowrap w-28">Network</th>
                                <th class="hidden lg:table-cell px-2 xl:px-4 py-2 xl:py-3 text-right font-bold whitespace-nowrap min-w-[85px] xl:min-w-[150px]">Terakhir disinkronkan</th>
                                <th class="px-1 sm:px-2 xl:px-4 py-1.5 sm:py-2 xl:py-3 text-center font-bold whitespace-nowrap w-14 sm:w-24 xl:w-36">Aksi</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-[#1c1c1c] bg-[#050505]">
                            ${Array.from({ length: 5 }).map(() => `
                                <tr class="animate-pulse">
                                    <td class="px-2 xl:px-4 py-2 xl:py-3.5"><div class="h-4 w-16 bg-[#202020] rounded"></div></td>
                                    <td class="hidden 2xl:table-cell px-3 xl:px-4 py-3.5"><div class="h-5 w-24 bg-[#1a1a1a] rounded"></div></td>
                                    <td class="2xl:hidden px-2 xl:px-3 py-2 xl:py-3.5"><div class="h-4 w-32 bg-[#1a1a1a] rounded"></div></td>
                                    <td class="hidden 2xl:table-cell px-3 xl:px-4 py-3.5"><div class="h-4 w-28 bg-[#1a1a1a] rounded"></div></td>
                                    <td class="hidden 2xl:table-cell px-3 xl:px-4 py-3.5"><div class="h-4 w-28 bg-[#1a1a1a] rounded"></div></td>
                                    <td class="hidden 2xl:table-cell px-3 xl:px-4 py-3.5"><div class="h-4 w-28 bg-[#1a1a1a] rounded"></div></td>
                                    <td class="2xl:hidden px-1.5 xl:px-3 py-2 xl:py-3.5 text-center"><div class="h-4 w-12 bg-[#181818] rounded mx-auto"></div></td>
                                    <td class="hidden 2xl:table-cell px-3 xl:px-4 py-3.5"><div class="h-4 w-16 bg-[#181818] rounded"></div></td>
                                    <td class="hidden 2xl:table-cell px-3 xl:px-4 py-3.5 text-center"><div class="h-4 w-16 bg-[#181818] rounded mx-auto"></div></td>
                                    <td class="hidden lg:table-cell px-2 xl:px-4 py-2 xl:py-3.5 text-right"><div class="h-4 w-16 bg-[#161616] rounded ml-auto"></div></td>
                                    <td class="px-1.5 sm:px-2 xl:px-4 py-2 xl:py-3.5 text-center"><div class="h-6 w-20 bg-[#1f1f1f] rounded mx-auto"></div></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
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

    registerBaseline(pcId, pcKode, fromModal = false) {
        const targetKode = (pcKode || '').startsWith('PC') ? pcKode : `PC ${pcKode}`;
        Modal.confirm(
            `<div class="space-y-3 font-sans">
                <p class="text-xs sm:text-sm text-neutral-200">
                    Apakah Anda yakin ingin memperbarui baseline hardware & peripheral untuk <strong class="text-amber-400 font-mono">${this.escapeHtml(targetKode)}</strong>?
                </p>
                <div class="p-3 bg-amber-950/30 border border-amber-800/50 rounded text-[11px] sm:text-xs text-amber-200 leading-relaxed">
                    ⚠️ Gunakan tombol ini <strong>HANYA</strong> jika Anda (Owner/Admin) baru saja melakukan upgrade fisik atau mengganti periferal resmi pada <strong>${this.escapeHtml(targetKode)}</strong>.
                </div>
            </div>`,
            async () => {
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
            }
        );
    },

    getDiskModelNames(specs, m) {
        if (!specs && !m) return [];
        const results = [];
        const extract = (val) => {
            if (!val) return;
            if (Array.isArray(val)) {
                val.forEach(item => {
                    if (typeof item === 'string' && item.trim() && !results.includes(item.trim())) {
                        results.push(item.trim());
                    } else if (item && typeof item === 'object') {
                        const name = item.Model || item.model || item.Name || item.name || item.Caption || item.caption;
                        if (name && typeof name === 'string' && !results.includes(name.trim())) {
                            results.push(name.trim());
                        }
                    }
                });
            } else if (typeof val === 'string' && val.trim() && !results.includes(val.trim())) {
                results.push(val.trim());
            }
        };

        if (specs) {
            extract(specs.DiskModels);
            extract(specs.DiskNames);
            extract(specs.Disks);
            extract(specs.DriveModels);
            extract(specs.Drives);
            extract(specs.DiskModel);
            extract(specs.DiskName);
        }
        if (m) {
            extract(m.disk_models);
            extract(m.disk_names);
            extract(m.disk_name);
            extract(m.storage_model);
        }
        return results;
    },

    getRamModelNames(specs, m) {
        if (!specs && !m) return [];
        const results = [];
        const extract = (val) => {
            if (!val) return;
            if (Array.isArray(val)) {
                val.forEach(item => {
                    if (typeof item === 'string' && item.trim() && !results.includes(item.trim())) {
                        results.push(item.trim());
                    } else if (item && typeof item === 'object') {
                        const name = item.PartNumber || item.part_number || item.Model || item.model || item.Name || item.name;
                        if (name && typeof name === 'string' && !results.includes(name.trim())) {
                            results.push(name.trim());
                        }
                    }
                });
            } else if (typeof val === 'string' && val.trim() && !results.includes(val.trim())) {
                results.push(val.trim());
            }
        };

        if (specs) {
            extract(specs.RamModels);
            extract(specs.RamNames);
            extract(specs.RamPartNumbers);
            extract(specs.Rams);
            extract(specs.RamModel);
            extract(specs.RamName);
            extract(specs.RamPartNumber);
        }
        if (m) {
            extract(m.ram_models);
            extract(m.ram_names);
            extract(m.ram_model);
            extract(m.ram_part_number);
        }
        return results;
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

        const baseRamModels = this.getRamModelNames(baselineSpecs, m);
        const baseDiskModels = this.getDiskModelNames(baselineSpecs, m);
        const currRamModels = this.getRamModelNames(currentSpecs, m);
        const currDiskModels = this.getDiskModelNames(currentSpecs, m);

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
            <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded-lg max-w-4xl lg:max-w-5xl xl:max-w-6xl w-[calc(100%-2rem)] mx-auto shadow-2xl flex flex-col max-h-[90vh]">
                <!-- Header -->
                <div class="flex items-center justify-between p-4 sm:p-5 border-b border-[#1c1c1c] shrink-0">
                    <div class="flex items-center gap-2.5 flex-wrap">
                        <span class="text-lg font-black text-neutral-100 font-mono tracking-wider">${this.escapeHtml(m.pc_kode)}</span>
                        <span class="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-[#171717] border border-[#262626] text-neutral-300 font-mono">
                            ${this.escapeHtml(m.pc_grup_nama || 'REGULER')}
                        </span>
                        ${hwBadge}
                    </div>
                    <button type="button" onclick="Modal.closeModal()" class="text-neutral-400 hover:text-neutral-200 p-1 rounded hover:bg-[#1c1c1c] transition-colors" title="Tutup Modal">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <!-- Body -->
                <div class="p-4 sm:p-5 lg:p-6 space-y-4 overflow-y-auto max-h-[75vh] scrollbar-thin">
                    ${alertHtml}

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
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
                                <ul class="text-xs space-y-2.5 font-mono text-neutral-400">
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
                                    <li class="flex flex-col gap-0.5">
                                        <strong class="text-neutral-500 uppercase text-[10px]">Total RAM:</strong>
                                        <span class="text-neutral-100 font-bold select-all">${this.escapeHtml(m.total_ram || 'N/A')}</span>
                                    </li>
                                    <li class="flex flex-col gap-1">
                                        <strong class="text-neutral-500 uppercase text-[10px]">RAM Serials:</strong>
                                        <div class="flex flex-wrap">${renderRamPills(baselineSpecs.RamSerials, true)}</div>
                                    </li>
                                    ${baseRamModels.length > 0 ? `
                                    <li class="flex flex-col gap-1">
                                        <strong class="text-neutral-500 uppercase text-[10px]">Model RAM:</strong>
                                        <div class="flex flex-wrap gap-1">
                                            ${baseRamModels.map(name => `<span class="inline-block bg-[#121212] text-purple-300 border border-purple-900/50 px-2 py-0.5 rounded font-mono text-[11px]">🏷️ ${this.escapeHtml(name)}</span>`).join('')}
                                        </div>
                                    </li>` : ''}
                                    <li class="flex flex-col gap-1">
                                        <strong class="text-neutral-500 uppercase text-[10px]">Disk Serials:</strong>
                                        <div class="flex flex-wrap">${renderDiskPills(baselineSpecs.DiskSerials, true)}</div>
                                    </li>
                                    ${baseDiskModels.length > 0 ? `
                                    <li class="flex flex-col gap-1">
                                        <strong class="text-neutral-500 uppercase text-[10px]">Model SSD/Disk:</strong>
                                        <div class="flex flex-wrap gap-1">
                                            ${baseDiskModels.map(name => `<span class="inline-block bg-[#121212] text-cyan-300 border border-cyan-900/50 px-2 py-0.5 rounded font-mono text-[11px]">💽 ${this.escapeHtml(name)}</span>`).join('')}
                                        </div>
                                    </li>` : ''}
                                    <li class="flex flex-col gap-0.5 pt-1 border-t border-[#1c1c1c]/60">
                                        <strong class="text-neutral-500 uppercase text-[10px]">Network Adapter:</strong>
                                        <div class="mt-0.5">${nicBadgeHtml}</div>
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
                                <ul class="text-xs space-y-2.5 font-mono text-neutral-400">
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
                                    <li class="flex flex-col gap-0.5">
                                        <strong class="text-neutral-500 uppercase text-[10px]">Total RAM:</strong>
                                        <span class="text-neutral-100 font-bold select-all">${this.escapeHtml(m.total_ram || 'N/A')}</span>
                                    </li>
                                    <li class="flex flex-col gap-1">
                                        <strong class="text-neutral-500 uppercase text-[10px]">RAM Serials:</strong>
                                        <div class="flex flex-wrap">${renderRamPills(currentSpecs.RamSerials, false)}</div>
                                    </li>
                                    ${currRamModels.length > 0 ? `
                                    <li class="flex flex-col gap-1">
                                        <strong class="text-neutral-500 uppercase text-[10px]">Model RAM:</strong>
                                        <div class="flex flex-wrap gap-1">
                                            ${currRamModels.map(name => `<span class="inline-block bg-[#121212] text-purple-300 border border-purple-900/50 px-2 py-0.5 rounded font-mono text-[11px]">🏷️ ${this.escapeHtml(name)}</span>`).join('')}
                                        </div>
                                    </li>` : ''}
                                    <li class="flex flex-col gap-1">
                                        <strong class="text-neutral-500 uppercase text-[10px]">Disk Serials:</strong>
                                        <div class="flex flex-wrap">${renderDiskPills(currentSpecs.DiskSerials, false)}</div>
                                    </li>
                                    ${currDiskModels.length > 0 ? `
                                    <li class="flex flex-col gap-1">
                                        <strong class="text-neutral-500 uppercase text-[10px]">Model SSD/Disk:</strong>
                                        <div class="flex flex-wrap gap-1">
                                            ${currDiskModels.map(name => `<span class="inline-block bg-[#121212] text-cyan-300 border border-cyan-900/50 px-2 py-0.5 rounded font-mono text-[11px]">💽 ${this.escapeHtml(name)}</span>`).join('')}
                                        </div>
                                    </li>` : ''}
                                    <li class="flex flex-col gap-0.5 pt-1 border-t border-[#1c1c1c]/60">
                                        <strong class="text-neutral-500 uppercase text-[10px]">Network Adapter:</strong>
                                        <div class="mt-0.5">${nicBadgeHtml}</div>
                                    </li>
                                </ul>
                            ` : '<p class="text-xs text-neutral-500 italic">Belum ada telemetry terdeteksi.</p>'}
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="flex items-center justify-between p-4 sm:p-5 border-t border-[#1c1c1c] shrink-0 bg-[#080808]">
                    <div class="flex items-center gap-3 text-xs text-neutral-400 font-mono">
                        <span>Terakhir disinkronkan: <strong class="text-neutral-200">${this.escapeHtml(m.hardware_last_sync || m.last_update || 'Baru saja')}</strong></span>
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

    renderRow(m) {
        const hasBaseline = !!m.hardware_baseline;
        const isHwMismatch = m.hardware_mismatch === true;

        let rowClass = 'hover:bg-[#0c0c0c] border-b border-[#1c1c1c] transition-colors';
        if (isHwMismatch) {
            rowClass = 'bg-red-950/20 hover:bg-red-950/30 border-b border-red-500/40 text-red-200';
        }

        let hwBadge = '';
        let hwStatusBadge = '';
        if (isHwMismatch) {
            hwBadge = `
                <span class="px-1.5 sm:px-2 py-0.5 rounded bg-red-950/80 border border-red-500/80 text-red-200 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider animate-pulse flex items-center gap-0.5 sm:gap-1 shrink-0 whitespace-nowrap" title="🚨 Ditukar">
                    <span class="sm:hidden">🚨</span><span class="hidden sm:inline">🚨 Ditukar</span>
                </span>`;
            hwStatusBadge = `
                <span class="px-2.5 py-1 rounded bg-red-950/80 border border-red-500/80 text-red-200 text-xs font-bold uppercase tracking-wider animate-pulse inline-flex items-center gap-1.5 shadow-sm">
                    🚨 Ditukar
                </span>`;
        } else if (hasBaseline) {
            hwBadge = `
                <span class="px-1.5 sm:px-2 py-0.5 rounded bg-green-950/60 border border-green-500/50 text-green-300 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider flex items-center gap-0.5 sm:gap-1 shrink-0 whitespace-nowrap" title="🛡️ Aman">
                    <span class="sm:hidden">🛡️</span><span class="hidden sm:inline">🛡️ Aman</span>
                </span>`;
            hwStatusBadge = `
                <span class="px-2.5 py-1 rounded bg-green-950/60 border border-green-500/50 text-green-300 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 shadow-sm">
                    🛡️ Aman
                </span>`;
        } else {
            hwBadge = `
                <span class="px-1.5 sm:px-2 py-0.5 rounded bg-amber-950/50 border border-amber-600/50 text-amber-300 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider flex items-center gap-0.5 sm:gap-1 shrink-0 whitespace-nowrap" title="⚙️ Pending">
                    <span class="sm:hidden">⚙️</span><span class="hidden sm:inline">⚙️ Pending</span>
                </span>`;
            hwStatusBadge = `
                <span class="px-2.5 py-1 rounded bg-amber-950/50 border border-amber-600/50 text-amber-300 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 shadow-sm">
                    ⚙️ Pending
                </span>`;
        }

        const nicBadgeHtml = this.getNicSpeedBadge(m.nic_speed);

        let mismatchPill = '';
        if (isHwMismatch) {
            mismatchPill = `
                <div class="mt-1 text-[11px] font-mono text-red-300 line-clamp-1 max-w-[200px]" title="${this.escapeHtml(m.hardware_mismatch_desc || '')}">
                    ⚠️ ${this.escapeHtml(m.hardware_mismatch_desc || 'Mismatch')}
                </div>
            `;
        }

        return `
            <tr class="hardware-checker-row ${rowClass}">
                <td class="px-1 sm:px-2 xl:px-4 py-1.5 sm:py-2 xl:py-3.5 whitespace-nowrap min-w-[50px] sm:min-w-[70px] xl:min-w-[120px]">
                    <div class="flex items-center gap-1 flex-wrap">
                        <span class="font-bold text-neutral-100 font-mono text-xs sm:text-sm xl:text-base">${this.escapeHtml(m.pc_kode)}</span>
                        <div class="2xl:hidden">${hwBadge}</div>
                    </div>
                    ${mismatchPill}
                </td>
                <td class="hidden 2xl:table-cell px-3 xl:px-4 py-3.5 whitespace-nowrap w-32">
                    ${hwStatusBadge}
                </td>
                <!-- Spesifikasi Hardware Compact (< 2xl: sm, md, lg, xl) -->
                <td class="2xl:hidden px-1 sm:px-2 xl:px-3 py-1.5 sm:py-2 xl:py-3.5 min-w-[75px] sm:min-w-[110px] max-w-[95px] sm:max-w-[220px]">
                    <div class="text-[11px] sm:text-xs xl:text-sm text-neutral-200 font-mono font-medium truncate" title="CPU: ${this.escapeHtml(m.cpu_name || 'N/A')}">${this.escapeHtml(m.cpu_name || 'N/A')}</div>
                    <div class="text-[10px] sm:text-[11px] xl:text-xs text-neutral-400 font-mono truncate mt-0.5" title="GPU: ${this.escapeHtml(m.gpu_name || 'N/A')}">${this.escapeHtml(m.gpu_name || 'N/A')}</div>
                    <div class="hidden sm:block text-[10px] text-neutral-500 font-mono truncate mt-0.5" title="Motherboard: ${this.escapeHtml(m.motherboard || 'N/A')}">${this.escapeHtml(m.motherboard || 'N/A')}</div>
                </td>
                <!-- Wide Separate Columns (≥ 2xl) -->
                <td class="hidden 2xl:table-cell px-3 xl:px-4 py-3.5 min-w-[140px] max-w-[200px]">
                    <div class="text-xs xl:text-sm text-neutral-200 font-mono truncate" title="${this.escapeHtml(m.motherboard || 'N/A')}">${this.escapeHtml(m.motherboard || 'N/A')}</div>
                </td>
                <td class="hidden 2xl:table-cell px-3 xl:px-4 py-3.5 min-w-[150px] max-w-[200px]">
                    <div class="text-xs xl:text-sm text-neutral-200 font-mono truncate" title="${this.escapeHtml(m.cpu_name || 'N/A')}">${this.escapeHtml(m.cpu_name || 'N/A')}</div>
                </td>
                <td class="hidden 2xl:table-cell px-3 xl:px-4 py-3.5 min-w-[140px] max-w-[200px]">
                    <div class="text-xs xl:text-sm text-neutral-200 font-mono truncate" title="${this.escapeHtml(m.gpu_name || 'N/A')}">${this.escapeHtml(m.gpu_name || 'N/A')}</div>
                </td>
                <!-- RAM & LAN Compact (< 2xl: sm, md, lg, xl) -->
                <td class="2xl:hidden px-1 sm:px-1.5 xl:px-3 py-1.5 sm:py-2 xl:py-3.5 text-center whitespace-nowrap w-12 sm:w-16 xl:w-24">
                    <div class="text-[11px] sm:text-xs xl:text-sm font-bold text-neutral-200 font-mono">${this.escapeHtml(m.total_ram || '--')}</div>
                    <div class="mt-0.5 sm:mt-1 flex items-center justify-center">${nicBadgeHtml}</div>
                </td>
                <!-- Separate RAM & LAN (≥ 2xl) -->
                <td class="hidden 2xl:table-cell px-3 xl:px-4 py-3.5 whitespace-nowrap min-w-[110px] font-mono">
                    <span class="text-xs xl:text-sm font-bold text-neutral-200">${this.escapeHtml(m.total_ram || '--')}</span>
                </td>
                <td class="hidden 2xl:table-cell px-3 xl:px-4 py-3.5 text-center whitespace-nowrap w-28">
                    ${nicBadgeHtml}
                </td>
                <td class="hidden lg:table-cell px-2 xl:px-4 py-2 xl:py-3.5 text-right whitespace-nowrap font-mono text-[11px] xl:text-xs min-w-[85px] xl:min-w-[130px]">
                    <span class="text-neutral-400">${this.escapeHtml(m.hardware_last_sync || m.last_update || 'Baru saja')}</span>
                </td>
                <td class="px-1 sm:px-2 xl:px-4 py-1.5 sm:py-2 xl:py-3.5 text-center whitespace-nowrap w-14 sm:w-24 xl:w-36">
                    <div class="flex items-center justify-center gap-1 sm:gap-1.5">
                        <button type="button" onclick="HardwareChecker.showDetailModal(${m.pc_id})" id="btn-detail-${m.pc_id}"
                            class="p-1 sm:px-2 sm:py-1 bg-[#171717] hover:bg-[#222] border border-[#262626] text-neutral-200 text-[10px] sm:text-xs font-bold rounded transition-colors flex items-center justify-center gap-1" title="Lihat detail spesifikasi lengkap">
                            <span>🔍</span> <span class="hidden md:inline">Detail</span>
                        </button>
                        <button type="button" onclick="HardwareChecker.registerBaseline(${m.pc_id}, '${this.escapeHtml(m.pc_kode)}')"
                            class="remote-hide-action p-1 sm:px-2 sm:py-1 bg-neutral-100 hover:bg-white text-black text-[10px] sm:text-xs font-bold rounded transition-colors flex items-center justify-center gap-1" title="Perbarui baseline hardware resmi">
                            <span>🔄</span> <span class="hidden md:inline">Baseline</span>
                        </button>
                    </div>
                    <div class="hidden sm:block lg:hidden text-[9px] text-neutral-500 font-mono mt-0.5 text-center max-w-[70px] truncate mx-auto" title="${this.escapeHtml(m.hardware_last_sync || m.last_update || 'Baru saja')}">
                        ${this.escapeHtml(m.hardware_last_sync ? m.hardware_last_sync.split(' ')[1] || m.hardware_last_sync : 'Baru saja')}
                    </div>
                </td>
            </tr>
        `;
    },

    renderCard(m) {
        return this.renderRow(m);
    },

    renderTableWrapper(rowsHtml) {
        return `
            <div class="hardware-checker-table overflow-x-auto w-full border border-[#1c1c1c] rounded scrollbar-thin">
                <table class="w-full text-xs xl:text-sm">
                    <thead>
                        <tr class="text-[10px] xl:text-xs text-neutral-500 uppercase tracking-wider border-b border-[#1c1c1c] bg-[#0c0c0c]">
                            <th class="px-1 sm:px-2 xl:px-4 py-1.5 sm:py-2 xl:py-3 text-left font-bold whitespace-nowrap min-w-[50px] sm:min-w-[70px] xl:min-w-[120px]">PC</th>
                            <th class="hidden 2xl:table-cell px-3 xl:px-4 py-3 text-left font-bold whitespace-nowrap w-32">Status</th>
                            <!-- Spesifikasi Header (< 2xl: sm, md, lg, xl) -->
                            <th class="2xl:hidden px-1 sm:px-2 xl:px-3 py-1.5 sm:py-2 xl:py-3 text-left font-bold min-w-[75px] sm:min-w-[110px]">Spesifikasi</th>
                            <!-- Wide Headers (≥ 2xl) -->
                            <th class="hidden 2xl:table-cell px-3 xl:px-4 py-3 text-left font-bold whitespace-nowrap min-w-[140px]">Motherboard</th>
                            <th class="hidden 2xl:table-cell px-3 xl:px-4 py-3 text-left font-bold whitespace-nowrap min-w-[150px]">Processor</th>
                            <th class="hidden 2xl:table-cell px-3 xl:px-4 py-3 text-left font-bold whitespace-nowrap min-w-[140px]">Graphics</th>
                            <!-- RAM & LAN Header (< 2xl) -->
                            <th class="2xl:hidden px-1 sm:px-1.5 xl:px-3 py-1.5 sm:py-2 xl:py-3 text-center font-bold whitespace-nowrap w-12 sm:w-16 xl:w-24">RAM & LAN</th>
                            <!-- Separate Headers (≥ 2xl) -->
                            <th class="hidden 2xl:table-cell px-3 xl:px-4 py-3 text-left font-bold whitespace-nowrap min-w-[110px]">Total RAM</th>
                            <th class="hidden 2xl:table-cell px-3 xl:px-4 py-3 text-center font-bold whitespace-nowrap w-28">Network</th>
                            <th class="hidden lg:table-cell px-2 xl:px-4 py-2 xl:py-3 text-right font-bold whitespace-nowrap min-w-[85px] xl:min-w-[150px]">Terakhir disinkronkan</th>
                            <th class="px-1 sm:px-2 xl:px-4 py-1.5 sm:py-2 xl:py-3 text-center font-bold whitespace-nowrap w-14 sm:w-24 xl:w-36">Aksi</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#1c1c1c] bg-[#050505]">
                        ${rowsHtml}
                    </tbody>
                </table>
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

            container.innerHTML = this.renderTableWrapper(filteredData.map(m => this.renderRow(m)).join(''));
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

        let rowsHtml = '';
        sortedGroupEntries.forEach((g, groupIndex) => {
            rowsHtml += `
                <tr class="bg-[#080808]/90 border-b border-[#202020]">
                    <td colspan="12" class="px-3 xl:px-4 ${groupIndex > 0 ? 'pt-8 sm:pt-9' : 'pt-3.5 sm:pt-4'} pb-2.5">
                        <div class="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-[#141414] border border-[#262626] shadow-sm">
                            <span class="text-xs sm:text-sm font-black font-mono tracking-wider text-neutral-100 uppercase">${this.escapeHtml(g.name)}</span>
                            <span class="text-neutral-500 text-xs font-mono">&bull;</span>
                            <span class="px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800/60 text-emerald-300 font-mono text-[11px] sm:text-xs font-bold uppercase tracking-wider">${g.items.length} UNIT</span>
                        </div>
                    </td>
                </tr>
                ${g.items.map(m => this.renderRow(m)).join('')}
            `;
        });

        container.innerHTML = this.renderTableWrapper(rowsHtml);
    }
};

window.HardwareChecker = HardwareChecker;
