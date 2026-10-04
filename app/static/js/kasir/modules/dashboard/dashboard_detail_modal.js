// app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js

/**
 * Modul Modal Detail PC pada Dashboard Kasir.
 * Menampilkan rincian PC, screenshot preview, remote actions (restart/shutdown/WOL).
 */

const DashboardDetailModal = {
    currentPcId: null,
    lastScreenshotTime: null,
    lastScreenshotUrl: null,

    renderActionButtonsHtml(pc, isOnline, sesi, isAfk, isSystemMode, isAdminMode) {
        return `
            <button onclick="DashboardProcessMonitor.showProcesses(${pc.id})"
                class="flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#232323] hover:border-neutral-500 rounded-lg transition-colors ${!isOnline ? 'opacity-40 cursor-not-allowed' : ''}"
                ${!isOnline ? 'disabled' : ''}>
                <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path></svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-neutral-400 uppercase tracking-wider text-center leading-tight">Monitor Proses</span>
            </button>

            ${isOnline ? `
            <button onclick="DashboardDetailModal.openRemoteView(${pc.id}, '${pc.kode}')"
                class="flex flex-col items-center gap-2 p-4 bg-[#0a1520] border border-blue-900/40 hover:border-blue-500/60 hover:bg-[#0d1d2c] rounded-lg transition-colors">
                <div class="w-9 h-9 rounded-lg bg-blue-950/50 border border-blue-900/50 flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-blue-400 uppercase tracking-wider text-center leading-tight">Remote Layar</span>
            </button>` : `
            <div class="flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#232323] rounded-lg opacity-25 cursor-not-allowed">
                <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-neutral-600 uppercase tracking-wider text-center leading-tight">Remote Layar</span>
            </div>`}

            ${pc.mac_address ? `
            <button onclick="Modal.closeModal(); Dashboard.wolSingle(${pc.id})"
                class="flex flex-col items-center gap-2 p-4 bg-[#0a1a0f] border border-green-900/40 hover:border-green-600/60 hover:bg-[#0d2014] rounded-lg transition-colors">
                <div class="w-9 h-9 rounded-lg bg-green-950/50 border border-green-900/50 flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9"/></svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-green-500 uppercase tracking-wider text-center leading-tight">Wake-on-LAN</span>
            </button>` : `
            <div class="flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#1c1c1c] border-dashed rounded-lg opacity-30 cursor-not-allowed" title="Tidak ada MAC Address">
                <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#232323] flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9"/></svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-neutral-600 uppercase tracking-wider text-center leading-tight">Wake-on-LAN</span>
            </div>`}

            ${sesi && sesi.tipe !== 'admin' && !isSystemMode ? `
            <button onclick="Dashboard.pindahSesi(${sesi.id}, '${sesi.tipe}', '${pc.grup}')"
                class="flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#232323] hover:border-neutral-400 hover:bg-[#141414] rounded-lg transition-colors">
                <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-neutral-400 uppercase tracking-wider text-center leading-tight">Pindah PC</span>
            </button>` : `
            <div class="flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#1c1c1c] border-dashed rounded-lg opacity-25 cursor-not-allowed">
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
                class="flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#232323] hover:border-neutral-500 rounded-lg transition-colors ${!isOnline ? 'opacity-40 cursor-not-allowed' : ''}"
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
                class="flex flex-col items-center gap-2 p-4 bg-[#1a0a0f] border border-red-900/40 hover:border-red-600/60 hover:bg-[#200d14] rounded-lg transition-colors">
                <div class="w-9 h-9 rounded-lg bg-red-950/50 border border-red-900/50 flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
                    </svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-red-400 uppercase tracking-wider text-center leading-tight">Restart PC</span>
            </button>` : `
            <div class="flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#1c1c1c] border-dashed rounded-lg opacity-25 cursor-not-allowed" title="${isSystemMode ? 'Operasional dinonaktifkan untuk mode SYSTEM' : 'PC Offline'}">
                <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#232323] flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
                    </svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-neutral-600 uppercase tracking-wider text-center leading-tight">Restart PC</span>
            </div>`}

            ${isOnline && !isSystemMode ? `
            <button onclick="Modal.closeModal(); DashboardDetailModal.remoteAction(${pc.id}, 'shutdown', '${pc.kode}')"
                class="flex flex-col items-center gap-2 p-4 bg-[#1f0a0f] border border-red-900/50 hover:border-red-600/70 hover:bg-[#280d14] rounded-lg transition-colors">
                <div class="w-9 h-9 rounded-lg bg-red-950/60 border border-red-900/60 flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L12 12m0-6v6" />
                    </svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-red-500 uppercase tracking-wider text-center leading-tight">Shutdown PC</span>
            </button>` : `
            <div class="flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#1c1c1c] border-dashed rounded-lg opacity-25 cursor-not-allowed" title="${isSystemMode ? 'Operasional dinonaktifkan untuk mode SYSTEM' : 'PC Offline'}">
                <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#232323] flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L12 12m0-6v6" />
                    </svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-neutral-600 uppercase tracking-wider text-center leading-tight">Shutdown PC</span>
            </div>`}

            ${isSystemMode ? `
            <button onclick="Modal.closeModal(); Dashboard.clearSesiSystem(${pc.id}, ${sesi ? sesi.id : 'null'})"
                class="flex flex-col items-center gap-2 p-4 bg-[#0f121d] border border-indigo-900/50 hover:border-indigo-500/70 hover:bg-[#151928] rounded-lg transition-colors">
                <div class="w-9 h-9 rounded-lg bg-indigo-950/60 border border-indigo-900/60 flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-indigo-400 uppercase tracking-wider text-center leading-tight">Clear Sesi System</span>
            </button>` : (isAdminMode ? `
            <button onclick="Modal.closeModal(); Dashboard.logoutAdmin(${pc.id}, ${sesi ? sesi.id : 'null'})"
                class="flex flex-col items-center gap-2 p-4 bg-[#1f150a] border border-amber-900/50 hover:border-amber-500/70 hover:bg-[#2a1d0e] rounded-lg transition-colors">
                <div class="w-9 h-9 rounded-lg bg-amber-950/60 border border-amber-900/60 flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                    </svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-amber-400 uppercase tracking-wider text-center leading-tight">Logout Admin</span>
            </button>` : (isAfk ? `
            <button onclick="Modal.closeModal(); DashboardDetailModal.remoteAfkUnlock(${pc.id}, '${pc.kode}')"
                class="flex flex-col items-center gap-2 p-4 bg-[#1f1608] border border-amber-500/60 hover:border-amber-400 hover:bg-[#2e210c] rounded-lg transition-colors group">
                <div class="w-9 h-9 rounded-lg bg-amber-950/70 border border-amber-500/60 flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-amber-400 group-hover:text-amber-300 uppercase tracking-wider text-center leading-tight">Buka Kunci AFK</span>
            </button>` : (sesi && isOnline ? `
            <button onclick="Modal.closeModal(); DashboardDetailModal.remoteAfkLock(${pc.id}, '${pc.kode}')"
                class="flex flex-col items-center gap-2 p-4 bg-[#14120c] border border-amber-900/40 hover:border-amber-600/60 hover:bg-[#1e1a10] rounded-lg transition-colors group">
                <div class="w-9 h-9 rounded-lg bg-amber-950/50 border border-amber-900/50 flex items-center justify-center">
                    <svg class="w-[18px] h-[18px] text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke-width="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke-width="2"/>
                    </svg>
                </div>
                <span class="text-[10px] lg:text-base font-bold text-amber-500 group-hover:text-amber-400 uppercase tracking-wider text-center leading-tight">Kunci Meja AFK</span>
            </button>` : `
            <div class="flex flex-col items-center gap-2 p-4 bg-[#0a0a0a] border border-dashed border-[#1a1a1a] rounded-lg opacity-20"><span class="text-[9px] lg:text-base text-neutral-700 uppercase tracking-widest mt-4">—</span></div>`)))}
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
                        <div class="lg:col-span-7 xl:col-span-5 2xl:col-span-5 space-y-2.5 flex flex-col justify-start">
                            <div class="text-[10px] lg:text-xs text-neutral-400 uppercase font-bold tracking-wider font-mono">Aksi & Kontrol PC</div>
                            <div id="modal-action-buttons-grid" class="grid grid-cols-3 gap-2.5 md:gap-3">
                                ${this.renderActionButtonsHtml(pc, isOnline, sesi, isAfk, isSystemMode, isAdminMode)}
                            </div>
                        </div>

                        <!-- Right Column: Screenshot Preview -->
                        <div class="lg:col-span-5 xl:col-span-7 2xl:col-span-7 flex flex-col space-y-2.5">
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

            let attempts = 0;
            const maxAttempts = 15; // 15 attempts * 2 seconds = 30 seconds total timeout
            const interval = setInterval(async () => {
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
                            clearInterval(interval);
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
                    clearInterval(interval);
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

    remoteAction(pcId, action, pcKode = '') {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        const actionLabel = action === 'shutdown' ? 'Shutdown (Matikan)' : 'Restart (Mulai Ulang)';
        const pcName = pcKode || `PC #${pcId}`;

        Modal.confirm(`
            <div class="text-center">
                <p class="text-xs lg:text-base text-neutral-400 font-bold uppercase tracking-wider">${actionLabel} PC ${pcName}?</p>
                <p class="text-[10px] lg:text-base text-red-400 font-bold mt-1">⚠️ Perhatian: PC akan langsung mati/restart secara paksa. Semua pekerjaan yang belum disimpan di PC client akan hilang.</p>
            </div>
        `, async () => {
            try {
                const result = await API.request(`/api/v1/kasir/monitor/remote/${pcId}/${action}`, {
                    method: 'POST'
                });
                if (!result.success) {
                    throw new Error(result.error || 'Gagal mengirim perintah');
                }
                Toast.success(`Perintah ${action === 'shutdown' ? 'Shutdown' : 'Restart'} berhasil dikirim ke PC!`);
            } catch (err) {
                console.error('[DashboardDetailModal] Remote action error:', err);
                Toast.error(err.message || 'Gagal mengirim perintah remote');
            }
        });
    },

    remoteAfkLock(pcId, pcKode = '') {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        const pcName = pcKode || `PC #${pcId}`;

        setTimeout(() => {
            document.getElementById('remote-afk-pin-input')?.focus();
        }, 50);

        Modal.confirm(`
            <div class="space-y-3">
                <div class="text-center">
                    <p class="text-xs lg:text-base text-neutral-200 font-bold uppercase tracking-wider">Kunci Layar AFK PC ${pcName}</p>
                    <p class="text-[11px] lg:text-sm text-neutral-400 mt-1">Layar PC client akan dikunci. Tentukan PIN / Password untuk membuka kunci PC ini.</p>
                </div>
                <div class="text-left pt-2">
                    <label class="block text-xs font-semibold text-neutral-300 mb-1">PIN / Password Kunci Layar:</label>
                    <input type="password" id="remote-afk-pin-input" maxlength="32" placeholder="Masukkan PIN atau password bebas"
                        class="w-full bg-[#161616] border border-[#333] rounded-lg px-3 py-2.5 text-center text-sm font-mono tracking-widest text-white focus:border-amber-500 focus:outline-none">
                </div>
            </div>
        `, async () => {
            const pinInput = document.getElementById('remote-afk-pin-input');
            const pin = (pinInput?.value || '').trim();
            if (!pin) {
                Toast.error('PIN / Password kunci layar tidak boleh kosong!');
                return false;
            }

            try {
                const result = await API.request(`/api/v1/kasir/monitor/remote/${pcId}/afk-lock`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pin: pin })
                });
                if (!result.success) {
                    throw new Error(result.error || 'Gagal mengunci PC');
                }
                Toast.success(`PC ${pcName} berhasil dikunci!`);
                if (window.Dashboard) window.Dashboard._render(window.Dashboard.lastData);
                return true;
            } catch (err) {
                console.error('[DashboardDetailModal] Remote AFK Lock error:', err);
                Toast.error(err.message || 'Gagal mengunci PC');
                return false;
            }
        });
    },

    remoteAfkUnlock(pcId, pcKode = '') {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        const pcName = pcKode || `PC #${pcId}`;

        Modal.confirm(`
            <div class="text-center">
                <p class="text-xs lg:text-base text-amber-400 font-bold uppercase tracking-wider">Buka Kunci Layar (Master Unlock) PC ${pcName}?</p>
                <p class="text-[11px] lg:text-sm text-neutral-300 mt-2">Layar PC client akan langsung dibuka kuncinya dan kembali ke sesi aktif pengguna.</p>
            </div>
        `, async () => {
            try {
                const result = await API.request(`/api/v1/kasir/monitor/remote/${pcId}/afk-unlock`, {
                    method: 'POST'
                });
                if (!result.success) {
                    throw new Error(result.error || 'Gagal membuka kunci AFK');
                }
                Toast.success(`Kunci layar PC ${pcName} berhasil dibuka (Master Unlock)!`);
                if (window.Dashboard) window.Dashboard._render(window.Dashboard.lastData);
            } catch (err) {
                console.error('[DashboardDetailModal] Remote AFK Unlock error:', err);
                Toast.error(err.message || 'Gagal membuka kunci AFK');
            }
        });
    },

    viewFullscreen(imgEl) {
        if (!imgEl || !imgEl.src) return;
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4 cursor-pointer animate-in';
        overlay.onclick = () => overlay.remove();
        overlay.innerHTML = `
            <div class="relative w-full h-full flex items-center justify-center">
                <button class="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 border border-white/10 text-white/60 hover:text-white hover:bg-black/70 flex items-center justify-center text-xl leading-none transition-all z-10">&times;</button>
                <img src="${imgEl.src}" class="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
            </div>
        `;
        document.body.appendChild(overlay);
    },

    openRemoteView: function(pcId, pcKode) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        this.currentPcId = pcId;
        const modalBox = document.getElementById('pc-detail-modal-card');
        if (modalBox) {
            modalBox.classList.remove('max-w-lg');
            modalBox.classList.add('max-w-5xl');
        }

        const menu = document.getElementById('view-action-menu');
        const vncView = document.getElementById('view-remote-client');
        const hwView = document.getElementById('view-hardware-specs');
        const procView = document.getElementById('view-process-list');
        if (menu) menu.classList.add('hidden');
        if (hwView) hwView.classList.add('hidden');
        if (procView) procView.classList.add('hidden');
        if (vncView) vncView.classList.remove('hidden');
        document.getElementById('modal-card-main-footer')?.classList.add('hidden');

        const statusBadge = document.getElementById('modal-vnc-status-badge');
        if (statusBadge) {
            statusBadge.textContent = 'Terputus';
            statusBadge.className = 'px-2 py-1 rounded text-xs font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700';
        }

        const resBadge = document.getElementById('modal-vnc-resolution');
        if (resBadge) resBadge.classList.add('hidden');

        const placeholder = document.getElementById('modal-vnc-placeholder');
        if (placeholder) placeholder.classList.remove('hidden');

        const connectBtn = document.getElementById('modal-vnc-connect-btn');
        if (connectBtn) connectBtn.classList.remove('hidden');

        const disconnectBtn = document.getElementById('modal-vnc-disconnect-btn');
        if (disconnectBtn) disconnectBtn.classList.add('hidden');

        const kbBtn = document.getElementById('modal-vnc-keyboard-btn');
        if (kbBtn) kbBtn.classList.add('opacity-40', 'cursor-not-allowed');

        const kb = document.getElementById('modal-vnc-virtual-keyboard');
        if (kb) kb.classList.add('hidden');
    },

    startRemote: async function(pcId, pcKode) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        const loading = document.getElementById('modal-vnc-loading');
        if (loading) loading.classList.remove('hidden');

        const connectBtn = document.getElementById('modal-vnc-connect-btn');
        if (connectBtn) connectBtn.classList.add('hidden');

        try {
            const res = await API.request(`/api/v1/kasir/monitor/vnc_client/${pcId}/start`, { method: 'POST' });
            if (!res || !res.success) {
                throw new Error((res && res.error) || 'Gagal memulai VNC di client');
            }

            const token = res.token || `client_${pcId}`;
            const port = res.port || 8081;
            let url = (typeof VNCClient !== 'undefined' && VNCClient.resolveWebSocketUrl)
                ? VNCClient.resolveWebSocketUrl(token, port)
                : (window.location.protocol === 'https:'
                    ? `wss://${window.location.host}/ws/vnc?token=${encodeURIComponent(token)}`
                    : `ws://${window.location.hostname}:${port}/?token=${encodeURIComponent(token)}`);

            const screen = document.getElementById('modal-vnc-screen');
            const container = document.getElementById('modal-vnc-container');
            const placeholder = document.getElementById('modal-vnc-placeholder');
            const statusBadge = document.getElementById('modal-vnc-status-badge');
            const disconnectBtn = document.getElementById('modal-vnc-disconnect-btn');
            const kbBtn = document.getElementById('modal-vnc-keyboard-btn');
            const clipBtn = document.getElementById('modal-vnc-clip-btn');

            this.vncSession = VNCClient.createSession({
                screenContainer: screen,
                vncContainer: container,
                wsUrl: url,
                password: res.vnc_password,
                scaleViewport: true,
                onConnect: () => {
                    if (loading) loading.classList.add('hidden');
                    if (placeholder) placeholder.classList.add('hidden');
                    if (statusBadge) {
                        statusBadge.textContent = 'Terhubung';
                        statusBadge.className = 'px-2 py-1 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
                    }
                    if (disconnectBtn) disconnectBtn.classList.remove('hidden');
                    if (kbBtn) kbBtn.classList.remove('opacity-40', 'cursor-not-allowed');
                    if (clipBtn) clipBtn.classList.remove('opacity-40', 'cursor-not-allowed');
                    Toast.success(`Remote Control PC ${pcKode} aktif!`);
                },
                onDisconnect: () => {
                    if (loading) loading.classList.add('hidden');
                    this.disconnectRemote(pcId);
                },
                onError: (err) => {
                    if (loading) loading.classList.add('hidden');
                    Toast.error(`Gagal koneksi remote: ${err.message}`);
                    this.disconnectRemote(pcId);
                },
                onResolution: (w, h) => {
                    const resBadge = document.getElementById('modal-vnc-resolution');
                    if (resBadge) {
                        const modeText = this.vncSession.scaleFactor ? 'FIT' : '1:1';
                        resBadge.textContent = `${w} × ${h} (${modeText})`;
                        resBadge.classList.remove('hidden');
                    }
                },
                onClipboard: (text) => {
                    const rec = document.getElementById('modal-vnc-clip-rec');
                    if (rec) rec.value = text;
                    if (text && text.trim()) {
                        Toast.info(`📋 Teks disalin dari Remote PC ${pcKode}`);
                    }
                }
            });

            await this.vncSession.connect();

        } catch (err) {
            Toast.error(err.message || 'Gagal memulai remote session');
            if (loading) loading.classList.add('hidden');
            if (connectBtn) connectBtn.classList.remove('hidden');
            this.disconnectRemote(pcId);
        }
    },

    disconnectRemote: async function(pcId) {
        if (this.vncSession) {
            this.vncSession.disconnect();
            this.vncSession = null;
        }

        const statusBadge = document.getElementById('modal-vnc-status-badge');
        if (statusBadge) {
            statusBadge.textContent = 'Terputus';
            statusBadge.className = 'px-2 py-1 rounded text-xs font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700';
        }

        const resBadge = document.getElementById('modal-vnc-resolution');
        if (resBadge) resBadge.classList.add('hidden');

        const placeholder = document.getElementById('modal-vnc-placeholder');
        if (placeholder) placeholder.classList.remove('hidden');

        const connectBtn = document.getElementById('modal-vnc-connect-btn');
        if (connectBtn) connectBtn.classList.remove('hidden');

        const disconnectBtn = document.getElementById('modal-vnc-disconnect-btn');
        if (disconnectBtn) disconnectBtn.classList.add('hidden');

        const kbBtn = document.getElementById('modal-vnc-keyboard-btn');
        if (kbBtn) kbBtn.classList.add('opacity-40', 'cursor-not-allowed');

        const clipBtn = document.getElementById('modal-vnc-clip-btn');
        if (clipBtn) clipBtn.classList.add('opacity-40', 'cursor-not-allowed');

        const kb = document.getElementById('modal-vnc-virtual-keyboard');
        if (kb) kb.classList.add('hidden');

        const clipDrawer = document.getElementById('modal-vnc-clipboard-drawer');
        if (clipDrawer) clipDrawer.classList.add('hidden');

        try {
            await API.request(`/api/v1/kasir/monitor/vnc_client/${pcId}/stop`, { method: 'POST' });
        } catch (err) {
            console.error('[DashboardDetailModal] Error stopping remote proxy:', err);
        }
    },

    stopRemote: async function(pcId) {
        if (this.vncSession) {
            this.vncSession.disconnect();
            this.vncSession = null;
        }

        const menu = document.getElementById('view-action-menu');
        const vncView = document.getElementById('view-remote-client');
        if (menu) menu.classList.remove('hidden');
        if (vncView) vncView.classList.add('hidden');
        document.getElementById('modal-card-main-footer')?.classList.remove('hidden');

        try {
            await API.request(`/api/v1/kasir/monitor/vnc_client/${pcId}/stop`, { method: 'POST' });
        } catch (err) {
            console.error('[DashboardDetailModal] Error stopping remote proxy:', err);
        }
    },

    toggleScale: function() {
        if (this.vncSession) {
            this.vncSession.toggleScale();
            const label = document.getElementById('modal-vnc-scale-label');
            const btn = document.getElementById('modal-vnc-scale-btn');
            const resBadge = document.getElementById('modal-vnc-resolution');
            
            if (this.vncSession.scaleFactor) {
                if (label) label.textContent = 'Fit Layar';
                if (btn) btn.className = 'px-3 py-1.5 bg-emerald-950/40 border border-emerald-800/60 text-emerald-400 text-xs font-bold rounded hover:bg-emerald-900/40 transition-colors';
            } else {
                if (label) label.textContent = '1:1 Asli';
                if (btn) btn.className = 'px-3 py-1.5 bg-[#171717] border border-[#262626] text-neutral-300 text-xs font-bold rounded hover:bg-[#222] transition-colors';
            }

            if (this.vncSession.remoteResolution.width > 0 && resBadge) {
                const modeText = this.vncSession.scaleFactor ? 'FIT' : '1:1';
                resBadge.textContent = `${this.vncSession.remoteResolution.width} × ${this.vncSession.remoteResolution.height} (${modeText})`;
            }
        }
    },

    toggleFullscreen: function() {
        const container = document.getElementById('modal-vnc-container');
        if (!container) return;
        if (!document.fullscreenElement) {
            container.requestFullscreen().then(() => {
                setTimeout(() => {
                    if (this.vncSession) this.vncSession.applyDisplayMode();
                }, 100);
            }).catch(err => {
                Toast.error('Gagal fullscreen: ' + err.message);
            });
        } else {
            document.exitFullscreen().then(() => {
                setTimeout(() => {
                    if (this.vncSession) this.vncSession.applyDisplayMode();
                }, 100);
            });
        }
    },

    toggleVirtualKeyboard: function() {
        if (this.vncSession) {
            this.vncSession.toggleVirtualKeyboard('modal-vnc-virtual-keyboard', 'modal-');
        }
    },

    switchKeyboardLayout: function(layout) {
        if (this.vncSession) {
            this.vncSession.switchKeyboardLayout(layout, 'modal-');
        }
    },

    toggleModifier: function(modKey) {
        if (this.vncSession) {
            const active = this.vncSession.toggleModifier(modKey);
            const btn = document.getElementById(`modal-key-${modKey.toLowerCase()}`);
            if (btn) {
                if (active) {
                    btn.classList.add('bg-neutral-200', 'text-black', 'border-white');
                    btn.classList.remove('bg-[#171717]', 'text-neutral-400', 'border-[#262626]');
                } else {
                    btn.classList.remove('bg-neutral-200', 'text-black', 'border-white');
                    btn.classList.add('bg-[#171717]', 'text-neutral-400', 'border-[#262626]');
                }
            }
        }
    },

    sendSpecialKey: function(keysym) {
        if (this.vncSession) {
            this.vncSession.sendSpecialKey(keysym);
        }
    },

    sendShortcutPreset: function(preset) {
        if (this.vncSession) {
            this.vncSession.sendShortcutPreset(preset);
        }
    },

    toggleClipboardModal: function() {
        const drawer = document.getElementById('modal-vnc-clipboard-drawer');
        if (!drawer) return;
        const isHidden = drawer.classList.contains('hidden');
        if (isHidden) {
            drawer.classList.remove('hidden');
            const sendInput = document.getElementById('modal-vnc-clip-send');
            if (sendInput) {
                sendInput.focus();
                if (!sendInput.value && navigator.clipboard && navigator.clipboard.readText) {
                    navigator.clipboard.readText().then(t => {
                        if (t && !sendInput.value) sendInput.value = t;
                    }).catch(() => {});
                }
            }
            const recInput = document.getElementById('modal-vnc-clip-rec');
            if (recInput && this.vncSession) {
                recInput.value = this.vncSession.getRemoteClipboard() || '';
            }
        } else {
            drawer.classList.add('hidden');
        }
    },

    pasteHostToInput: async function() {
        const sendInput = document.getElementById('modal-vnc-clip-send');
        if (!sendInput) return;
        if (navigator.clipboard && navigator.clipboard.readText) {
            try {
                const t = await navigator.clipboard.readText();
                if (t) {
                    sendInput.value = t;
                    Toast.success('Teks diambil dari clipboard host');
                    return;
                }
            } catch (e) {
                console.warn('[VNC] Gagal baca clipboard:', e);
            }
        }
        Toast.info('Gunakan Ctrl+V atau tahan dan tempel secara manual');
        sendInput.focus();
    },

    sendClipboardToRemote: function() {
        if (!this.vncSession) {
            Toast.error('Remote belum terhubung');
            return;
        }
        const sendInput = document.getElementById('modal-vnc-clip-send');
        const text = sendInput ? sendInput.value : '';
        if (!text) {
            Toast.warning('Ketik atau tempel teks terlebih dahulu');
            if (sendInput) sendInput.focus();
            return;
        }
        this.vncSession.handlePastedText(text);
        Toast.success('Teks terkirim & ditempel di Remote Host');
    },

    copyReceivedToHost: async function() {
        if (!this.vncSession) {
            Toast.error('Remote belum terhubung');
            return;
        }
        const recInput = document.getElementById('modal-vnc-clip-rec');
        let text = recInput ? recInput.value : (this.vncSession ? this.vncSession.getRemoteClipboard() : '');

        if (!text && this.vncSession) {
            Toast.info('Meminta seleksi teks dari Remote Host (Ctrl+C)...');
            this.vncSession.sendCtrlKeySequence(0x0063, 'KeyC');
            await new Promise(r => setTimeout(r, 200));
            text = this.vncSession.getRemoteClipboard() || '';
            if (recInput && text) recInput.value = text;
        }

        if (!text) {
            Toast.warning('Belum ada teks di remote. Pilih/sorot teks di remote terlebih dahulu, lalu klik tombol ini.');
            return;
        }

        const copied = await this.vncSession.copyTextToHost(text, false);
        if (copied) {
            Toast.success('📋 Teks dari Remote Host disalin ke clipboard Host! Silakan Paste (Ctrl+V / Klik Kanan).');
        } else {
            Toast.info('Silakan salin teks manual dari kotak.');
            if (recInput) {
                recInput.focus();
                recInput.select();
            }
        }
    },

    pasteHostClipboardDirect: async function() {
        if (!this.vncSession) {
            Toast.error('Remote PC belum terhubung');
            return;
        }
        let text = '';
        if (navigator.clipboard && navigator.clipboard.readText) {
            try {
                text = await navigator.clipboard.readText();
            } catch (e) {}
        }
        if (text) {
            this.vncSession.handlePastedText(text);
            const sendInput = document.getElementById('modal-vnc-clip-send');
            if (sendInput) sendInput.value = text;
        } else {
            const sendInput = document.getElementById('modal-vnc-clip-send');
            if (sendInput && sendInput.value) {
                this.vncSession.handlePastedText(sendInput.value);
            } else {
                Toast.info('Gunakan Ctrl+V di dalam layar remote atau tempel manual di kotak input');
                if (sendInput) sendInput.focus();
            }
        }
    },

    copyRemoteClipboardDirect: async function() {
        if (!this.vncSession) {
            Toast.error('Remote PC belum terhubung');
            return;
        }
        const text = this.vncSession.getRemoteClipboard() || '';
        if (!text) {
            Toast.warning('Belum ada teks yang disalin dari remote PC (Gunakan Ctrl+C di remote)');
            return;
        }
        await this.vncSession.copyTextToHost(text, true);
    },

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

    onModalClose: function(pcId) {
        this.currentPcId = null;
        this.lastScreenshotTime = null;
        this.lastScreenshotUrl = null;
        this._lastActionStateKey = null;

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

        if (this.vncSession) {
            this.stopRemote(pcId);
        }
    }
};

window.addEventListener('beforeunload', () => {
    if (DashboardDetailModal.vncSession && DashboardDetailModal.currentPcId) {
        DashboardDetailModal.vncSession.disconnect();
        navigator.sendBeacon(`/api/v1/kasir/monitor/vnc_client/${DashboardDetailModal.currentPcId}/stop`);
    }
});

window.addEventListener('pagehide', () => {
    if (DashboardDetailModal.vncSession && DashboardDetailModal.currentPcId) {
        DashboardDetailModal.vncSession.disconnect();
        navigator.sendBeacon(`/api/v1/kasir/monitor/vnc_client/${DashboardDetailModal.currentPcId}/stop`);
    }
});
