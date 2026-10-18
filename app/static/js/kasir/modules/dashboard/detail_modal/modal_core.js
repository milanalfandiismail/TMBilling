/**
 * Dashboard Detail Modal - Core Sub-module
 * Menangani rendering tombol aksi, pembukaan modal detail PC, dan pembersihan onModalClose.
 */
window.DashboardModalCore = {
    renderActionButtonsHtml(pc, isOnline, sesi, isAfk, isSystemMode, isAdminMode) {
        return `
            <button onclick="DashboardProcessMonitor.showProcesses(${pc.id})"
                class="remote-hide-action flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#232323] hover:border-neutral-500 rounded-lg transition-colors ${!isOnline ? 'opacity-40 cursor-not-allowed' : ''}"
                ${!isOnline ? 'disabled' : ''}>
                <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path></svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-neutral-400 uppercase tracking-wider text-center leading-tight">Monitor Proses</span>
            </button>

            ${isOnline ? `
            <button onclick="DashboardDetailModal.openRemoteView(${pc.id}, '${pc.kode}')"
                class="remote-hide-action flex flex-col items-center gap-2 p-4 bg-[#0a1520] border border-blue-900/40 hover:border-blue-500/60 hover:bg-[#0d1d2c] rounded-lg transition-colors">
                <div class="w-9 h-9 rounded-lg bg-blue-950/50 border border-blue-900/50 flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-blue-400 uppercase tracking-wider text-center leading-tight">Remote Layar</span>
            </button>` : `
            <div class="remote-hide-action flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#232323] rounded-lg opacity-25 cursor-not-allowed">
                <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-neutral-600 uppercase tracking-wider text-center leading-tight">Remote Layar</span>
            </div>`}

            ${pc.mac_address ? `
            <button onclick="Modal.closeModal(); Dashboard.wolSingle(${pc.id})"
                class="remote-hide-action flex flex-col items-center gap-2 p-4 bg-[#0a1a0f] border border-green-900/40 hover:border-green-600/60 hover:bg-[#0d2014] rounded-lg transition-colors">
                <div class="w-9 h-9 rounded-lg bg-green-950/50 border border-green-900/50 flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9"/></svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-green-500 uppercase tracking-wider text-center leading-tight">Wake-on-LAN</span>
            </button>` : `
            <div class="remote-hide-action flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#1c1c1c] border-dashed rounded-lg opacity-30 cursor-not-allowed" title="Tidak ada MAC Address">
                <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#232323] flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9"/></svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-neutral-600 uppercase tracking-wider text-center leading-tight">Wake-on-LAN</span>
            </div>`}

            ${sesi && sesi.tipe !== 'admin' && !isSystemMode ? `
            <button onclick="Dashboard.pindahSesi(${sesi.id}, '${sesi.tipe}', '${pc.grup}')"
                class="remote-hide-action flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#232323] hover:border-neutral-400 hover:bg-[#141414] rounded-lg transition-colors">
                <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-neutral-400 uppercase tracking-wider text-center leading-tight">Pindah PC</span>
            </button>` : `
            <div class="remote-hide-action flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#1c1c1c] border-dashed rounded-lg opacity-25 cursor-not-allowed">
                <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#232323] flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-neutral-600 uppercase tracking-wider text-center leading-tight">Pindah PC</span>
            </div>`}

            <button onclick="DashboardDetailModal.showHardwareView(${pc.id}, '${pc.kode}')"
                class="flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#232323] hover:border-neutral-500 hover:bg-[#141414] rounded-lg transition-colors group">
                <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] group-hover:border-neutral-500 flex items-center justify-center transition-colors">
                    <svg class="w-[18px] h-[18px] text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-neutral-400 group-hover:text-neutral-200 uppercase tracking-wider text-center leading-tight transition-colors">Hardware</span>
            </button>

            <button id="btn-screenshot-${pc.id}" onclick="DashboardDetailModal.takeScreenshot(${pc.id})"
                class="remote-hide-action flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#232323] hover:border-neutral-500 rounded-lg transition-colors ${!isOnline ? 'opacity-40 cursor-not-allowed' : ''}"
                ${!isOnline ? 'disabled' : ''}>
                <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                </div>
                <span id="text-screenshot-${pc.id}" class="text-[10px] lg:text-base font-bold text-neutral-400 uppercase tracking-wider text-center leading-tight">Ambil Gambar</span>
            </button>

            ${isOnline && !isSystemMode ? `
            <button onclick="Modal.closeModal(); DashboardDetailModal.remoteAction(${pc.id}, 'restart', '${pc.kode}')"
                class="remote-hide-action flex flex-col items-center gap-2 p-4 bg-[#1a0a0f] border border-red-900/40 hover:border-red-600/60 hover:bg-[#200d14] rounded-lg transition-colors">
                <div class="w-9 h-9 rounded-lg bg-red-950/50 border border-red-900/50 flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
                    </svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-red-400 uppercase tracking-wider text-center leading-tight">Restart PC</span>
            </button>` : `
            <div class="remote-hide-action flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#1c1c1c] border-dashed rounded-lg opacity-25 cursor-not-allowed" title="${isSystemMode ? 'Operasional dinonaktifkan untuk mode SYSTEM' : 'PC Offline'}">
                <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#232323] flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
                    </svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-neutral-600 uppercase tracking-wider text-center leading-tight">Restart PC</span>
            </div>`}

            ${isOnline && !isSystemMode ? `
            <button onclick="Modal.closeModal(); DashboardDetailModal.remoteAction(${pc.id}, 'shutdown', '${pc.kode}')"
                class="remote-hide-action flex flex-col items-center gap-2 p-4 bg-[#1f0a0f] border border-red-900/50 hover:border-red-600/70 hover:bg-[#280d14] rounded-lg transition-colors">
                <div class="w-9 h-9 rounded-lg bg-red-950/60 border border-red-900/60 flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L12 12m0-6v6" />
                    </svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-red-500 uppercase tracking-wider text-center leading-tight">Shutdown PC</span>
            </button>` : `
            <div class="remote-hide-action flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#1c1c1c] border-dashed rounded-lg opacity-25 cursor-not-allowed" title="${isSystemMode ? 'Operasional dinonaktifkan untuk mode SYSTEM' : 'PC Offline'}">
                <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#232323] flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L12 12m0-6v6" />
                    </svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-neutral-600 uppercase tracking-wider text-center leading-tight">Shutdown PC</span>
            </div>`}

            ${isSystemMode ? `
            <button onclick="Modal.closeModal(); Dashboard.clearSesiSystem(${pc.id}, ${sesi ? sesi.id : 'null'})"
                class="remote-hide-action flex flex-col items-center gap-2 p-4 bg-[#0f121d] border border-indigo-900/50 hover:border-indigo-500/70 hover:bg-[#151928] rounded-lg transition-colors">
                <div class="w-9 h-9 rounded-lg bg-indigo-950/60 border border-indigo-900/60 flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-indigo-400 uppercase tracking-wider text-center leading-tight">Clear Sesi System</span>
            </button>` : (isAdminMode ? `
            <button onclick="Modal.closeModal(); Dashboard.logoutAdmin(${pc.id}, ${sesi ? sesi.id : 'null'})"
                class="remote-hide-action flex flex-col items-center gap-2 p-4 bg-[#1f150a] border border-amber-900/50 hover:border-amber-500/70 hover:bg-[#2a1d0e] rounded-lg transition-colors">
                <div class="w-9 h-9 rounded-lg bg-amber-950/60 border border-amber-900/60 flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                    </svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-amber-400 uppercase tracking-wider text-center leading-tight">Logout Admin</span>
            </button>` : (isAfk ? `
            <button onclick="Modal.closeModal(); DashboardDetailModal.remoteAfkUnlock(${pc.id}, '${pc.kode}')"
                class="remote-hide-action flex flex-col items-center gap-2 p-4 bg-[#1f1608] border border-amber-500/60 hover:border-amber-400 hover:bg-[#2e210c] rounded-lg transition-colors group">
                <div class="w-9 h-9 rounded-lg bg-amber-950/70 border border-amber-500/60 flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-amber-400 group-hover:text-amber-300 uppercase tracking-wider text-center leading-tight">Buka Kunci AFK</span>
            </button>` : (sesi && isOnline ? `
            <button onclick="Modal.closeModal(); DashboardDetailModal.remoteAfkLock(${pc.id}, '${pc.kode}')"
                class="remote-hide-action flex flex-col items-center gap-2 p-4 bg-[#14120c] border border-amber-900/40 hover:border-amber-600/60 hover:bg-[#1e1a10] rounded-lg transition-colors group">
                <div class="w-9 h-9 rounded-lg bg-amber-950/50 border border-amber-900/50 flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke-width="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke-width="2"/>
                    </svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-amber-500 group-hover:text-amber-400 uppercase tracking-wider text-center leading-tight">Kunci Meja AFK</span>
            </button>` : `
            <div class="remote-hide-action flex flex-col items-center gap-2 p-4 bg-[#0a0a0a] border border-dashed border-[#1a1a1a] rounded-lg opacity-20"><span class="text-[9px] lg:text-base text-neutral-700 uppercase tracking-widest mt-4">—</span></div>`)))}
        `;
    },

    showDetail(pcId, pcData) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        if (!pcData || !pcData.pc_list) return;
        const pc = pcData.pc_list.find(p => p.id === pcId);
        if (!pc) return;

        this.currentPcId = pcId;
        this.lastScreenshotTime = pc.screenshot_time || null;
        this.lastScreenshotUrl = pc.screenshot_url || null;

        const isOnline = pc.status !== 'offline';
        const sesi = pc.sesi_detail;
        const isAfk = pc.is_afk || sesi?.is_afk;
        const isSystemMode = pc.is_system_mode || pc.status === 'system' || (sesi?.tipe === 'admin' && ((sesi?.nama_guest || '').toUpperCase() === 'SYSTEM' || (sesi?.member_nama || '').toUpperCase() === 'SYSTEM'));
        const isAdminMode = !isSystemMode && (pc.is_admin_mode || pc.status === 'admin' || (sesi?.tipe === 'admin'));

        const modalHtml = `
            <div id="pc-detail-modal-card" class="bg-[#111] border border-[#2a2a2a] rounded-xl w-[calc(100%-2rem)] lg:w-[92vw] xl:w-[88vw] 2xl:w-[84vw] max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-[1500px] h-[85vh] xl:h-[90vh] 2xl:h-[92vh] max-h-[94vh] xl:max-h-[94vh] 2xl:max-h-[96vh] flex flex-col overflow-hidden shadow-2xl animate-in transition-all duration-300">
                <div class="px-5 md:px-6 py-3.5 md:py-4 border-b border-[#2a2a2a] flex items-center justify-between shrink-0">
                    <div>
                        <div class="flex items-center gap-2">
                            <h3 class="text-xs md:text-sm lg:text-base font-bold text-neutral-100 tracking-wide font-mono">${pc.kode}</h3>
                            <div id="pc-detail-modal-mode-badge" class="inline-flex items-center">
                                ${isAfk ? '<span class="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded">🔒 AFK / Istirahat</span>' : (isSystemMode ? '<span class="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded">SYSTEM MODE</span>' : (isAdminMode ? '<span class="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded">ADMIN MODE</span>' : ''))}
                            </div>
                        </div>
                        <div class="flex items-center gap-2 mt-0.5">
                            <span class="text-[10px] lg:text-xs font-bold text-neutral-400 uppercase font-mono">${pc.grup}</span>
                            <span class="text-[9px] lg:text-xs text-neutral-600 font-mono">${pc.ip_address}</span>
                        </div>
                    </div>
                    <button onclick="Modal.closeModal()" class="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 hover:text-neutral-100 hover:bg-[#222] transition-colors flex items-center justify-center text-lg leading-none">&times;</button>
                </div>

                <div id="modal-view-container" class="flex-1 min-h-0 overflow-y-auto flex flex-col scrollbar-thin">
                    <div id="view-action-menu" class="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0 overflow-y-auto scrollbar-thin">
                        <!-- Left Column: Action Buttons -->
                        <div class="col-span-full lg:col-span-7 xl:col-span-5 2xl:col-span-5 space-y-2.5 flex flex-col justify-start">
                            <div class="text-[10px] lg:text-xs text-neutral-400 uppercase font-bold tracking-wider font-mono">Aksi & Kontrol PC</div>
                            <div id="modal-action-buttons-grid" class="grid grid-cols-3 gap-2.5 md:gap-3">
                                ${this.renderActionButtonsHtml(pc, isOnline, sesi, isAfk, isSystemMode, isAdminMode)}
                            </div>
                        </div>

                        <!-- Right Column: Screenshot Preview -->
                        <div class="remote-hide-action lg:col-span-5 xl:col-span-7 2xl:col-span-7 flex flex-col space-y-2.5">
                            <div class="text-[10px] lg:text-xs text-neutral-400 uppercase font-bold tracking-wider font-mono">Tangkapan Layar Client</div>
                            <div id="screenshot-preview-container" class="p-3.5 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg flex-1 flex flex-col justify-between">
                                <div class="flex items-center justify-between mb-2 shrink-0">
                                    <span class="text-[10px] lg:text-xs font-bold text-neutral-400 uppercase tracking-wider font-mono">Waktu Pengambilan</span>
                                    <span id="screenshot-time" class="text-[9px] lg:text-xs text-neutral-500 font-mono">
                                        ${pc.screenshot_time ? pc.screenshot_time : 'BELUM DIAMBIL'}
                                    </span>
                                </div>
                                <div class="relative w-full aspect-video rounded-lg overflow-hidden border border-[#1a1a1a] bg-black flex items-center justify-center group flex-1">
                                    <img id="screenshot-img" src="${pc.screenshot_url && window.API ? API.resolveMediaUrl(pc.screenshot_url) + '?t=' + Date.now() : (pc.screenshot_url ? pc.screenshot_url + '?t=' + Date.now() : '')}" 
                                        class="w-full h-full object-contain cursor-pointer transition-opacity duration-200 hover:opacity-90 ${pc.screenshot_url ? '' : 'hidden'}" 
                                        onclick="DashboardDetailModal.viewFullscreen(this)" />
                                    <div id="screenshot-placeholder" class="text-neutral-600 text-xs lg:text-sm font-mono ${pc.screenshot_url ? 'hidden' : ''}">Tidak ada gambar</div>
                                    <div id="screenshot-fullscreen-hint" class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${pc.screenshot_url ? '' : 'hidden'}">
                                        <div class="bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center gap-2">
                                            <svg class="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
                                            <span class="text-[10px] lg:text-xs font-bold text-white/80 uppercase tracking-wider">Fullscreen</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="view-process-list" class="hidden flex-1 flex flex-col overflow-hidden">
                        <div class="px-5 md:px-6 py-3 border-b border-[#1c1c1c] flex items-center justify-between shrink-0">
                            <button onclick="DashboardProcessMonitor.backToMenu()" class="text-xs lg:text-sm text-neutral-400 hover:text-neutral-200 font-bold transition-colors flex items-center gap-1.5">&larr; Kembali</button>
                            <span id="modal-pc-count" class="text-xs lg:text-sm text-neutral-400 font-mono font-bold">0 PROSES</span>
                        </div>
                        <div class="px-5 md:px-6 py-2.5 border-b border-[#1c1c1c] bg-[#0a0a0a] flex items-center shrink-0">
                            <div class="relative w-full">
                                <input type="text" id="input-search-processes" placeholder="Cari nama proses (contoh: chrome, valo)..." class="w-full bg-[#141414] border border-[#2a2a2a] rounded-lg pl-9 pr-3 py-2 text-xs lg:text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 font-mono" />
                                <svg class="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            </div>
                        </div>
                        <div class="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-4">
                            <div id="modal-process-list" class="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                                ${typeof DashboardProcessMonitor !== 'undefined' && typeof DashboardProcessMonitor.renderSkeleton === 'function' ? DashboardProcessMonitor.renderSkeleton(8) : '<div class="col-span-full py-12 text-center text-neutral-500 text-xs lg:text-sm font-mono">Memuat...</div>'}
                            </div>
                        </div>
                        <div class="p-3.5 md:p-4 border-t border-[#2a2a2a] flex justify-end shrink-0 bg-[#0c0c0c]">
                            <button id="btn-refresh-processes" onclick="DashboardProcessMonitor.loadProcesses(${pc.id}, true)" class="px-4 py-2 bg-neutral-100 hover:bg-white text-black text-xs lg:text-sm font-bold rounded-lg transition-colors">Segarkan</button>
                        </div>
                    </div>

                    <div id="view-remote-client" class="hidden flex-1 flex flex-col overflow-hidden">
                        <div class="px-6 py-3 border-b border-[#1c1c1c] flex items-center justify-between">
                            <button onclick="DashboardDetailModal.stopRemote(${pc.id})" class="text-xs lg:text-base text-neutral-400 hover:text-neutral-200 font-bold transition-colors">&larr; Kembali / Tutup</button>
                            <div class="flex items-center gap-2">
                                <span id="modal-vnc-status-badge" class="px-2 py-1 rounded text-xs font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700">Terputus</span>
                                <span id="modal-vnc-resolution" class="text-xs lg:text-base text-neutral-500 font-mono hidden">0 × 0 (FIT)</span>
                            </div>
                        </div>
                        <div id="modal-vnc-container" tabindex="0" class="relative w-full aspect-video bg-black overflow-hidden flex items-center justify-center outline-none focus:ring-1 focus:ring-neutral-700">
                            <div id="modal-vnc-screen" class="w-full h-full flex items-center justify-center"></div>
                            <div id="modal-vnc-loading" class="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-3 z-20 hidden">
                                <svg class="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span class="text-xs lg:text-sm text-neutral-400 font-mono uppercase tracking-wider">Menghubungkan ke PC Client...</span>
                            </div>
                            <div id="modal-vnc-placeholder" class="absolute inset-0 flex flex-col items-center justify-center bg-[#070707] text-neutral-500 space-y-3 z-10 p-4 text-center">
                                <svg class="w-12 h-12 stroke-neutral-700" fill="none" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <p class="text-xs lg:text-base font-semibold text-neutral-400">Klik "Hubungkan" untuk memulai Sesi Remote Control PC ${pc.kode}</p>
                                <button onclick="DashboardDetailModal.startRemote(${pc.id}, '${pc.kode}')" id="modal-vnc-connect-btn" class="px-4 py-2 bg-neutral-100 hover:bg-white text-black text-xs lg:text-sm font-bold rounded transition-colors flex items-center gap-1">
                                    <span>▶</span> Hubungkan
                                </button>
                            </div>
                        </div>

                        <!-- Virtual QWERTY Keyboard Dock -->
                        <div id="modal-vnc-virtual-keyboard" class="hidden bg-[#0a0a0a] border-t border-[#1c1c1c] p-2 md:p-2.5 space-y-2 shrink-0 select-none">
                            <div class="flex items-center justify-between border-b border-[#1c1c1c] pb-1.5">
                                <div class="flex items-center gap-1.5">
                                    <button onclick="DashboardDetailModal.switchKeyboardLayout('letters')" id="modal-kb-tab-letters" class="px-3 py-1 text-[10px] font-bold rounded bg-neutral-200 text-black transition-colors">Abc</button>
                                    <button onclick="DashboardDetailModal.switchKeyboardLayout('symbols')" id="modal-kb-tab-symbols" class="px-3 py-1 text-[10px] font-bold rounded bg-[#171717] border border-[#262626] text-neutral-400 hover:bg-[#222] transition-colors">123 / Simbol</button>
                                    <button onclick="DashboardDetailModal.switchKeyboardLayout('function')" id="modal-kb-tab-function" class="px-3 py-1 text-[10px] font-bold rounded bg-[#171717] border border-[#262626] text-neutral-400 hover:bg-[#222] transition-colors">Fn</button>
                                </div>
                                <div class="flex items-center gap-1">
                                    <button onclick="DashboardDetailModal.toggleVirtualKeyboard()" class="px-2.5 py-1 bg-[#171717] hover:bg-[#222] border border-[#262626] text-neutral-300 text-[10px] font-bold rounded transition-colors">Tutup</button>
                                </div>
                            </div>
                            <div id="modal-kb-keys-grid" class="flex flex-col gap-1 w-full font-mono"></div>
                            <div class="flex items-center justify-between gap-3 border-t border-[#1c1c1c] pt-2">
                                <div class="flex items-center gap-1 flex-1">
                                    <button id="modal-key-ctrl" onclick="DashboardDetailModal.toggleModifier('Ctrl')" class="flex-1 py-1.5 bg-[#171717] border border-[#262626] text-neutral-400 text-[10px] font-bold rounded transition-colors">Ctrl</button>
                                    <button id="modal-key-alt" onclick="DashboardDetailModal.toggleModifier('Alt')" class="flex-1 py-1.5 bg-[#171717] border border-[#262626] text-neutral-400 text-[10px] font-bold rounded transition-colors">Alt</button>
                                    <button id="modal-key-win" onclick="DashboardDetailModal.toggleModifier('Win')" class="flex-1 py-1.5 bg-[#171717] border border-[#262626] text-neutral-400 text-[10px] font-bold rounded transition-colors">Win</button>
                                    <button id="modal-key-shift" onclick="DashboardDetailModal.toggleModifier('Shift')" class="flex-1 py-1.5 bg-[#171717] border border-[#262626] text-neutral-400 text-[10px] font-bold rounded transition-colors">Shift</button>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <div class="flex items-center gap-0.5">
                                        <button onclick="DashboardDetailModal.sendSpecialKey(0xff51)" class="w-8 py-1.5 bg-[#1c1c1c] hover:bg-[#252525] text-neutral-300 text-center rounded text-xs">◀</button>
                                        <div class="flex flex-col gap-0.5">
                                            <button onclick="DashboardDetailModal.sendSpecialKey(0xff52)" class="w-8 py-1 bg-[#1c1c1c] hover:bg-[#252525] text-neutral-300 text-center rounded text-[10px]">▲</button>
                                            <button onclick="DashboardDetailModal.sendSpecialKey(0xff54)" class="w-8 py-1 bg-[#1c1c1c] hover:bg-[#252525] text-neutral-300 text-center rounded text-[10px]">▼</button>
                                        </div>
                                        <button onclick="DashboardDetailModal.sendSpecialKey(0xff53)" class="w-8 py-1.5 bg-[#1c1c1c] hover:bg-[#252525] text-neutral-300 text-center rounded text-xs">▶</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Modal VNC Clipboard Drawer -->
                        <div id="modal-vnc-clipboard-drawer" class="hidden p-3 bg-[#0a0a0a] border-t border-[#1c1c1c] space-y-2.5 select-text">
                            <div class="flex items-center justify-between">
                                <span class="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                                    <span>📋</span> Clipboard Remote Host ${pc.kode}
                                </span>
                                <div class="flex items-center gap-2">
                                    <span class="text-[10px] text-neutral-400 hidden sm:inline">💡 Shortcut <b>Ctrl+C</b> & <b>Ctrl+V</b> aktif otomatis</span>
                                    <button onclick="DashboardDetailModal.toggleClipboardModal()" class="text-[10px] text-neutral-400 hover:text-neutral-200">✕ Tutup</button>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div class="space-y-1.5">
                                    <div class="flex items-center justify-between text-[10px] text-neutral-400 font-semibold">
                                        <span>⬆️ Kirim ke Remote Host</span>
                                        <button onclick="DashboardDetailModal.pasteHostToInput()" class="text-emerald-400 hover:underline">Tempel dari Host</button>
                                    </div>
                                    <textarea id="modal-vnc-clip-send" rows="2" placeholder="Ketik atau tempel teks untuk dikirim ke Remote Host..." class="w-full p-2 bg-[#050505] border border-[#1c1c1c] rounded text-xs text-neutral-200 font-mono resize-none focus:outline-none focus:border-neutral-500"></textarea>
                                    <button onclick="DashboardDetailModal.sendClipboardToRemote()" class="w-full py-1.5 bg-neutral-100 hover:bg-neutral-200 text-black text-xs font-bold rounded transition-colors flex items-center justify-center gap-1.5">
                                        <span>🚀</span> Kirim ke Remote Host
                                    </button>
                                </div>
                                <div class="space-y-1.5">
                                    <div class="flex items-center justify-between text-[10px] text-neutral-400 font-semibold">
                                        <span>⬇️ Ambil dari Remote Host</span>
                                    </div>
                                    <textarea id="modal-vnc-clip-rec" rows="2" readonly placeholder="Teks yang disalin di Remote Host..." class="w-full p-2 bg-[#050505] border border-[#1c1c1c] rounded text-xs text-emerald-400 font-mono resize-none focus:outline-none"></textarea>
                                    <button onclick="DashboardDetailModal.copyReceivedToHost()" class="w-full py-1.5 bg-[#171717] hover:bg-[#222] border border-[#262626] text-neutral-300 text-xs font-bold rounded transition-colors flex items-center justify-center gap-1.5">
                                        <span>📋</span> Ambil & Salin ke Clipboard Host/HP
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Footer Control Bar -->
                        <div class="p-3 bg-[#0a0a0a] border-t border-[#1a1a1a] flex flex-wrap gap-2 items-center justify-between">
                            <div class="flex gap-2">
                                <button id="modal-vnc-scale-btn" onclick="DashboardDetailModal.toggleScale()" class="px-3 py-1.5 bg-emerald-950/40 border border-emerald-800/60 text-emerald-400 text-xs font-bold rounded hover:bg-emerald-900/40 transition-colors">
                                    <span id="modal-vnc-scale-label">Fit Layar</span>
                                </button>
                                <button id="modal-vnc-keyboard-btn" onclick="DashboardDetailModal.toggleVirtualKeyboard()" class="px-3 py-1.5 bg-[#171717] border border-[#262626] text-neutral-300 text-xs font-bold rounded hover:bg-[#222] transition-colors opacity-40 cursor-not-allowed">
                                    ⌨️ Keyboard
                                </button>
                                <button id="modal-vnc-clip-btn" onclick="DashboardDetailModal.toggleClipboardModal()" class="px-3 py-1.5 bg-[#171717] border border-[#262626] text-neutral-300 text-xs font-bold rounded hover:bg-[#222] transition-colors opacity-40 cursor-not-allowed" title="Sinkronisasi Clipboard">
                                    📋 Clipboard
                                </button>
                                <button onclick="DashboardDetailModal.toggleFullscreen()" class="px-3 py-1.5 bg-[#171717] border border-[#262626] text-neutral-300 text-xs font-bold rounded hover:bg-[#222] transition-colors">
                                    Fullscreen
                                </button>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="DashboardDetailModal.disconnectRemote(${pc.id})" id="modal-vnc-disconnect-btn" class="px-4 py-1.5 bg-red-950/40 border border-red-800/60 text-red-400 text-xs font-bold rounded hover:bg-red-900/40 transition-colors hidden">
                                    Putuskan
                                </button>
                                <button onclick="DashboardDetailModal.stopRemote(${pc.id})" class="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold rounded transition-colors">
                                    Tutup
                                </button>
                            </div>
                        </div>
                    </div>

                    <div id="view-hardware-specs" class="hidden flex-1 flex flex-col overflow-hidden">
                        <div class="px-5 md:px-6 py-3 border-b border-[#1c1c1c] flex items-center justify-between shrink-0 bg-[#0c0c0c]">
                            <button onclick="DashboardDetailModal.backFromHardware()" class="text-xs lg:max-xl:text-sm xl:text-base text-neutral-400 hover:text-neutral-200 font-bold transition-colors flex items-center gap-1.5 font-mono">
                                &larr; Kembali
                            </button>
                            <div id="modal-hw-header-status" class="flex items-center gap-2">
                                <span class="text-xs lg:max-xl:text-sm xl:text-base text-neutral-400 font-mono font-bold">HARDWARE MONITOR</span>
                            </div>
                        </div>
                        <div class="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-4 md:p-6" id="modal-hw-scroll-container">
                            <div id="modal-hw-content" class="space-y-4">
                                ${typeof Skeleton !== 'undefined' && typeof Skeleton.hardwareDetailView === 'function' ? Skeleton.hardwareDetailView() : '<div class="py-16 text-center text-neutral-500 text-xs lg:max-xl:text-sm xl:text-base font-mono">Memuat data hardware...</div>'}
                            </div>
                        </div>
                        <div class="p-3.5 md:p-4 border-t border-[#2a2a2a] flex items-center justify-between shrink-0 bg-[#0c0c0c]">
                            <button id="btn-hw-update-baseline" onclick="DashboardDetailModal.registerBaselineFromModal(${pc.id}, '${pc.kode}')" class="px-3 lg:max-xl:px-3.5 xl:px-4 py-2 lg:max-xl:py-2.5 xl:py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs lg:max-xl:text-xs xl:text-base font-bold rounded-lg transition-colors flex items-center gap-1.5 font-mono">
                                <span>🔄</span> Update Baseline
                            </button>
                            <button id="btn-hw-refresh" onclick="DashboardDetailModal.loadHardwareData(${pc.id}, '${pc.kode}')" class="px-3 lg:max-xl:px-3.5 xl:px-4 py-2 lg:max-xl:py-2.5 xl:py-2.5 bg-neutral-100 hover:bg-white text-black text-xs lg:max-xl:text-xs xl:text-base font-bold rounded-lg transition-colors font-mono">
                                Segarkan Data
                            </button>
                        </div>
                    </div>
                </div>

                <div id="modal-card-main-footer" class="p-3.5 md:p-4 border-t border-[#2a2a2a] flex justify-end shrink-0 bg-[#0c0c0c]">
                    <button onclick="Modal.closeModal()" class="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs lg:text-base font-bold rounded-lg transition-colors">Tutup</button>
                </div>
            </div>
        `;

        Modal.show(modalHtml, () => {
            DashboardDetailModal.onModalClose(pc.id);
        });
        this.fetchScreenshotStatus(pc.id);
    },

    async fetchScreenshotStatus(pcId) {
        try {
            const statusData = await API.request(`/api/v1/kasir/monitor/screenshot/status/${pcId}`);
            if (statusData && statusData.success && statusData.screenshot_url && this.currentPcId === pcId) {
                const timeSpan = document.getElementById('screenshot-time');
                const img = document.getElementById('screenshot-img');
                const placeholder = document.getElementById('screenshot-placeholder');
                const hint = document.getElementById('screenshot-fullscreen-hint');

                if (timeSpan && statusData.screenshot_time) {
                    timeSpan.innerText = statusData.screenshot_time;
                }
                if (img) {
                    const resolvedUrl = window.API ? API.resolveMediaUrl(statusData.screenshot_url) : statusData.screenshot_url;
                    img.src = resolvedUrl + '?t=' + Date.now();
                    img.classList.remove('hidden');
                }
                if (placeholder) placeholder.classList.add('hidden');
                if (hint) hint.classList.remove('hidden');
                this.lastScreenshotTime = statusData.screenshot_time;
                this.lastScreenshotUrl = statusData.screenshot_url;
            }
        } catch (e) {
            // Abaikan jika request gagal atau modal telah ditutup
        }
    },

    async takeScreenshot(pcId) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        const btn = document.getElementById(`btn-screenshot-${pcId}`);
        const text = document.getElementById(`text-screenshot-${pcId}`);
        if (!btn) return;

        btn.disabled = true;
        btn.classList.add('opacity-40', 'cursor-not-allowed');
        const oldText = text ? text.innerText : 'Ambil Gambar';
        if (text) text.innerText = 'MEMINTA...';

        try {
            // Ambil mtime awal sebelum trigger screenshot dikirim
            let initialMtime = 0;
            try {
                const initRes = await API.request(`/api/v1/kasir/monitor/screenshot/status/${pcId}`);
                if (initRes && initRes.success && initRes.mtime) {
                    initialMtime = initRes.mtime;
                }
            } catch (e) {
                // Abaikan error initial check
            }

            const result = await API.request(`/api/v1/kasir/monitor/screenshot/trigger/${pcId}`, {
                method: 'POST'
            });
            if (!result.success) {
                throw new Error(result.error || 'Gagal memicu screenshot');
            }

            Toast.success('Permintaan screenshot dikirim ke PC!');
            if (text) text.innerText = 'MENUNGGU...';

            if (this._screenshotTimer) {
                clearInterval(this._screenshotTimer);
                this._screenshotTimer = null;
            }

            let attempts = 0;
            const maxAttempts = 15; // 15 attempts * 2 seconds = 30 seconds total timeout
            this._screenshotTimer = setInterval(async () => {
                attempts++;
                try {
                    const statusData = await API.request(`/api/v1/kasir/monitor/screenshot/status/${pcId}`);
                    if (statusData.success && statusData.screenshot_url) {
                        const timeSpan = document.getElementById('screenshot-time');
                        const img = document.getElementById('screenshot-img');
                        const placeholder = document.getElementById('screenshot-placeholder');
                        const hint = document.getElementById('screenshot-fullscreen-hint');

                        const currentMtime = statusData.mtime || 0;
                        const isUpdated = initialMtime > 0 ? (currentMtime > initialMtime) : (currentMtime > 0);

                        if (isUpdated) {
                            if (this._screenshotTimer) {
                                clearInterval(this._screenshotTimer);
                                this._screenshotTimer = null;
                            }
                            if (timeSpan && statusData.screenshot_time) {
                                timeSpan.innerText = statusData.screenshot_time;
                            }
                            if (img) {
                                const resolvedUrl = window.API ? API.resolveMediaUrl(statusData.screenshot_url) : statusData.screenshot_url;
                                img.src = resolvedUrl + '?t=' + Date.now();
                                img.classList.remove('hidden');
                            }
                            if (placeholder) placeholder.classList.add('hidden');
                            if (hint) hint.classList.remove('hidden');

                            Toast.success('Tangkapan layar berhasil diperbarui!');
                            btn.disabled = false;
                            btn.classList.remove('opacity-40', 'cursor-not-allowed');
                            if (text) text.innerText = oldText;
                            return;
                        }
                    }
                } catch (err) {
                    console.error('[DashboardDetailModal] Error polling screenshot:', err);
                }

                if (attempts >= maxAttempts) {
                    if (this._screenshotTimer) {
                        clearInterval(this._screenshotTimer);
                        this._screenshotTimer = null;
                    }
                    Toast.error('Batas waktu habis: PC klien tidak merespon permintaan screenshot.');
                    btn.disabled = false;
                    btn.classList.remove('opacity-40', 'cursor-not-allowed');
                    if (text) text.innerText = oldText;
                }
            }, 2000);

        } catch (err) {
            console.error('[DashboardDetailModal] Screenshot error:', err);
            Toast.error(err.message || 'Gagal memicu screenshot');
            btn.disabled = false;
            btn.classList.remove('opacity-40', 'cursor-not-allowed');
            if (text) text.innerText = oldText;
        }
    },

    onModalClose(pcId) {
        this.currentPcId = null;
        this.lastScreenshotTime = null;
        this.lastScreenshotUrl = null;
        this._lastActionStateKey = null;

        if (this._screenshotTimer) {
            clearInterval(this._screenshotTimer);
            this._screenshotTimer = null;
        }

        if (this._hardwarePollingTimer) {
            clearInterval(this._hardwarePollingTimer);
            this._hardwarePollingTimer = null;
        }
        if (typeof DashboardModalHardware !== 'undefined' && DashboardModalHardware._hardwarePollingTimer) {
            clearInterval(DashboardModalHardware._hardwarePollingTimer);
            DashboardModalHardware._hardwarePollingTimer = null;
        }

        if (typeof DashboardProcessMonitor !== 'undefined' && DashboardProcessMonitor.backToMenu) {
            DashboardProcessMonitor.backToMenu();
        }

        this.currentHardwarePcId = null;
        this.currentHardwarePcKode = null;
        this._lastHwFingerprint = null;
        this._lastHwStructureKey = null;
        this._lastHwData = null;
        this._lastHwPcId = null;

        if (this.vncSession) {
            this.stopRemote(pcId);
        }
    }
};
