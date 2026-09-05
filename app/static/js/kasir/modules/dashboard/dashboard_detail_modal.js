// app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js

/**
 * Modul Modal Detail PC pada Dashboard Kasir.
 * Menampilkan rincian PC, screenshot preview, remote actions (restart/shutdown/WOL).
 */

const DashboardDetailModal = {
    showDetail(pcId, pcData) {
        if (!pcData || !pcData.pc_list) return;
        const pc = pcData.pc_list.find(p => p.id === pcId);
        if (!pc) return;

        const isOnline = pc.status !== 'offline';
        const sesi = pc.sesi_detail;
        const isAdminMode = pc.is_admin_mode || (sesi?.tipe === 'admin');

        const modalHtml = `
            <div id="pc-detail-modal-card" class="bg-[#111] border border-[#2a2a2a] rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in transition-all duration-300">
                <div class="px-6 py-4 border-b border-[#2a2a2a] flex items-center justify-between">
                    <div>
                        <h3 class="text-sm font-bold text-neutral-100 tracking-wide font-mono">${pc.kode}</h3>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="text-[10px] lg:text-base font-bold text-neutral-400 uppercase font-mono">${pc.grup}</span>
                            <span class="text-[9px] lg:text-base text-neutral-600 font-mono">${pc.ip_address}</span>
                        </div>
                    </div>
                    <button onclick="Modal.closeModal()" class="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 hover:text-neutral-100 hover:bg-[#222] transition-colors flex items-center justify-center text-lg leading-none">&times;</button>
                </div>

                <div id="modal-view-container" class="flex-1 overflow-y-auto flex flex-col">
                    <div id="view-action-menu" class="p-5">
                        <div class="grid grid-cols-3 gap-3">
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

                            ${sesi && sesi.tipe !== 'admin' ? `
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

                            <div class="flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#232323] rounded-lg opacity-25">
                                <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                                    <svg class="w-[18px] h-[18px] text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                </div>
                                <span class="text-[10px] lg:text-base font-bold text-neutral-600 uppercase tracking-wider text-center leading-tight">Hardware</span>
                            </div>

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

                            ${isOnline ? `
                            <button onclick="Modal.closeModal(); DashboardDetailModal.remoteAction(${pc.id}, 'restart', '${pc.kode}')"
                                class="flex flex-col items-center gap-2 p-4 bg-[#1a0a0f] border border-red-900/40 hover:border-red-600/60 hover:bg-[#200d14] rounded-lg transition-colors">
                                <div class="w-9 h-9 rounded-lg bg-red-950/50 border border-red-900/50 flex items-center justify-center">
                                    <svg class="w-[18px] h-[18px] text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
                                    </svg>
                                </div>
                                <span class="text-[10px] lg:text-base font-bold text-red-400 uppercase tracking-wider text-center leading-tight">Restart PC</span>
                            </button>` : `
                            <div class="flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#1c1c1c] border-dashed rounded-lg opacity-25 cursor-not-allowed">
                                <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#232323] flex items-center justify-center">
                                    <svg class="w-[18px] h-[18px] text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
                                    </svg>
                                </div>
                                <span class="text-[10px] lg:text-base font-bold text-neutral-600 uppercase tracking-wider text-center leading-tight">Restart PC</span>
                            </div>`}

                            ${isOnline ? `
                            <button onclick="Modal.closeModal(); DashboardDetailModal.remoteAction(${pc.id}, 'shutdown', '${pc.kode}')"
                                class="flex flex-col items-center gap-2 p-4 bg-[#1f0a0f] border border-red-900/50 hover:border-red-600/70 hover:bg-[#280d14] rounded-lg transition-colors">
                                <div class="w-9 h-9 rounded-lg bg-red-950/60 border border-red-900/60 flex items-center justify-center">
                                    <svg class="w-[18px] h-[18px] text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L12 12m0-6v6" />
                                    </svg>
                                </div>
                                <span class="text-[10px] lg:text-base font-bold text-red-500 uppercase tracking-wider text-center leading-tight">Shutdown PC</span>
                            </button>` : `
                            <div class="flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#1c1c1c] border-dashed rounded-lg opacity-25 cursor-not-allowed">
                                <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#232323] flex items-center justify-center">
                                    <svg class="w-[18px] h-[18px] text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L12 12m0-6v6" />
                                    </svg>
                                </div>
                                <span class="text-[10px] lg:text-base font-bold text-neutral-600 uppercase tracking-wider text-center leading-tight">Shutdown PC</span>
                            </div>`}

                            ${isAdminMode ? `
                            <button onclick="Modal.closeModal(); Dashboard.logoutAdmin(${pc.id}, ${sesi ? sesi.id : 'null'})"
                                class="flex flex-col items-center gap-2 p-4 bg-[#1f150a] border border-amber-900/50 hover:border-amber-500/70 hover:bg-[#2a1d0e] rounded-lg transition-colors">
                                <div class="w-9 h-9 rounded-lg bg-amber-950/60 border border-amber-900/60 flex items-center justify-center">
                                    <svg class="w-[18px] h-[18px] text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                                    </svg>
                                </div>
                                <span class="text-[10px] lg:text-base font-bold text-amber-400 uppercase tracking-wider text-center leading-tight">Logout Admin</span>
                            </button>` : `
                            <div class="flex flex-col items-center gap-2 p-4 bg-[#0a0a0a] border border-dashed border-[#1a1a1a] rounded-lg opacity-20"><span class="text-[9px] lg:text-base text-neutral-700 uppercase tracking-widest mt-4">—</span></div>`}
                        </div>

                        <div id="screenshot-preview-container" class="mt-4 p-4 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-[10px] lg:text-base font-bold text-neutral-400 uppercase tracking-wider font-mono">Tangkapan Layar</span>
                                <span id="screenshot-time" class="text-[9px] lg:text-base text-neutral-500 font-mono">
                                    ${pc.screenshot_time ? pc.screenshot_time : 'BELUM DIAMBIL'}
                                </span>
                            </div>
                            <div class="relative w-full aspect-video rounded-lg overflow-hidden border border-[#1a1a1a] bg-black/60 flex items-center justify-center group">
                                <img id="screenshot-img" src="${pc.screenshot_url ? pc.screenshot_url + '?t=' + Date.now() : ''}" 
                                    class="w-full h-full object-cover cursor-pointer transition-opacity duration-200 hover:opacity-90 ${pc.screenshot_url ? '' : 'hidden'}" 
                                    onclick="DashboardDetailModal.viewFullscreen(this)" />
                                <div id="screenshot-placeholder" class="text-neutral-600 text-xs lg:text-base font-mono ${pc.screenshot_url ? 'hidden' : ''}">Tidak ada gambar</div>
                                <div id="screenshot-fullscreen-hint" class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${pc.screenshot_url ? '' : 'hidden'}">
                                    <div class="bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center gap-2">
                                        <svg class="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
                                        <span class="text-[10px] lg:text-base font-bold text-white/80 uppercase tracking-wider">Fullscreen</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="view-process-list" class="hidden flex-1 flex flex-col overflow-hidden">
                        <div class="px-6 py-3 border-b border-[#1c1c1c] flex items-center justify-between">
                            <button onclick="DashboardProcessMonitor.backToMenu()" class="text-xs lg:text-base text-neutral-400 hover:text-neutral-200 font-bold transition-colors">&larr; Kembali</button>
                            <span id="modal-pc-count" class="text-xs lg:text-base text-neutral-500 font-mono">0 PROSES</span>
                        </div>
                        <div class="px-6 py-2.5 border-b border-[#1c1c1c] bg-[#0a0a0a] flex items-center">
                            <input type="text" id="input-search-processes" placeholder="Cari nama proses (contoh: chrome, valo)..." class="w-full bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-xs lg:text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 font-mono" />
                        </div>
                        <div class="flex-1 overflow-x-hidden overflow-y-auto scrollbar-mono w-full max-h-[55vh]">
                            <table class="w-full text-xs lg:text-base">
                                <thead class="sticky top-0 bg-[#0c0c0c] z-10">
                                    <tr class="border-b border-[#1c1c1c] text-[10px] lg:text-base text-neutral-500 uppercase tracking-wider">
                                        <th class="px-6 py-3 text-left">Layanan / Aplikasi</th>
                                        <th class="px-6 py-3 text-right w-32">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="modal-process-list" class="divide-y divide-[#1c1c1c]">
                                    <tr><td colspan="2" class="px-6 py-10 text-center text-neutral-500 text-xs lg:text-base font-mono">Memuat...</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <div class="p-4 border-t border-[#2a2a2a] flex justify-end">
                            <button id="btn-refresh-processes" onclick="DashboardProcessMonitor.loadProcesses(${pc.id})" class="px-4 py-2 bg-neutral-100 hover:bg-white text-black text-xs lg:text-base font-bold rounded-lg transition-colors">Segarkan</button>
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
                        <div id="modal-vnc-container" class="relative w-full aspect-video bg-black overflow-hidden flex items-center justify-center">
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
                                    <span>📋</span> Clipboard Remote PC ${pc.kode}
                                </span>
                                <button onclick="DashboardDetailModal.toggleClipboardModal()" class="text-[10px] text-neutral-400 hover:text-neutral-200">✕ Tutup</button>
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div class="space-y-1.5">
                                    <div class="flex items-center justify-between text-[10px] text-neutral-400 font-semibold">
                                        <span>⬆️ Kirim ke PC (Host → VNC)</span>
                                        <button onclick="DashboardDetailModal.pasteHostToInput()" class="text-emerald-400 hover:underline">Tempel dari Host</button>
                                    </div>
                                    <textarea id="modal-vnc-clip-send" rows="2" placeholder="Teks untuk dikirim ke PC..." class="w-full p-2 bg-[#050505] border border-[#1c1c1c] rounded text-xs text-neutral-200 font-mono resize-none focus:outline-none focus:border-neutral-500"></textarea>
                                    <button onclick="DashboardDetailModal.sendClipboardToRemote()" class="w-full py-1 bg-neutral-100 hover:bg-neutral-200 text-black text-xs font-bold rounded transition-colors">
                                        Kirim ke PC (Ctrl+V)
                                    </button>
                                </div>
                                <div class="space-y-1.5">
                                    <div class="flex items-center justify-between text-[10px] text-neutral-400 font-semibold">
                                        <span>⬇️ Diterima dari PC (VNC → Host)</span>
                                    </div>
                                    <textarea id="modal-vnc-clip-rec" rows="2" readonly placeholder="Teks dari PC saat dicopy..." class="w-full p-2 bg-[#050505] border border-[#1c1c1c] rounded text-xs text-emerald-400 font-mono resize-none focus:outline-none"></textarea>
                                    <button onclick="DashboardDetailModal.copyReceivedToHost()" class="w-full py-1 bg-[#171717] hover:bg-[#222] border border-[#262626] text-neutral-300 text-xs font-bold rounded transition-colors">
                                        Salin ke Clipboard HP/PC
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
                </div>

                <div class="p-4 border-t border-[#2a2a2a] flex justify-end">
                    <button onclick="Modal.closeModal()" class="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs lg:text-base font-bold rounded-lg transition-colors">Tutup</button>
                </div>
            </div>
        `;

        Modal.show(modalHtml, () => {
            DashboardDetailModal.onModalClose(pc.id);
        });
    },

    async takeScreenshot(pcId) {
        const btn = document.getElementById(`btn-screenshot-${pcId}`);
        const text = document.getElementById(`text-screenshot-${pcId}`);
        if (!btn) return;

        btn.disabled = true;
        btn.classList.add('opacity-40', 'cursor-not-allowed');
        const oldText = text.innerText;
        text.innerText = 'MEMINTA...';

        try {
            const result = await API.request(`/api/v1/kasir/monitor/screenshot/trigger/${pcId}`, {
                method: 'POST'
            });
            if (!result.success) {
                throw new Error(result.error || 'Gagal memicu screenshot');
            }

            Toast.success('Permintaan screenshot dikirim ke PC!');
            text.innerText = 'MENUNGGU...';

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

                        const prevTime = timeSpan ? timeSpan.innerText.trim() : '';
                        if (statusData.screenshot_time && statusData.screenshot_time !== prevTime) {
                            clearInterval(interval);
                            if (timeSpan) timeSpan.innerText = statusData.screenshot_time;
                            if (img) {
                                img.src = statusData.screenshot_url + '?t=' + Date.now();
                                img.classList.remove('hidden');
                            }
                            if (placeholder) placeholder.classList.add('hidden');

                            Toast.success('Tangkapan layar berhasil diperbarui!');
                            btn.disabled = false;
                            btn.classList.remove('opacity-40', 'cursor-not-allowed');
                            text.innerText = oldText;
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
                    text.innerText = oldText;
                }
            }, 2000);

        } catch (err) {
            console.error('[DashboardDetailModal] Screenshot error:', err);
            Toast.error(err.message || 'Gagal memicu screenshot');
            btn.disabled = false;
            btn.classList.remove('opacity-40', 'cursor-not-allowed');
            text.innerText = oldText;
        }
    },

    remoteAction(pcId, action, pcKode = '') {
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
        this.currentPcId = pcId;
        const modalBox = document.getElementById('pc-detail-modal-card');
        if (modalBox) {
            modalBox.classList.remove('max-w-lg');
            modalBox.classList.add('max-w-5xl');
        }

        const menu = document.getElementById('view-action-menu');
        const vncView = document.getElementById('view-remote-client');
        if (menu) menu.classList.add('hidden');
        if (vncView) vncView.classList.remove('hidden');

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
                    Toast.info(`📋 Teks disalin dari Remote PC ${pcKode}`);
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

        const modalBox = document.getElementById('pc-detail-modal-card');
        if (modalBox) {
            modalBox.classList.remove('max-w-5xl');
            modalBox.classList.add('max-w-lg');
        }

        const menu = document.getElementById('view-action-menu');
        const vncView = document.getElementById('view-remote-client');
        if (menu) menu.classList.remove('hidden');
        if (vncView) vncView.classList.add('hidden');

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
            Toast.error('Remote PC belum terhubung');
            return;
        }
        const sendInput = document.getElementById('modal-vnc-clip-send');
        const text = sendInput ? sendInput.value : '';
        if (!text) {
            Toast.warning('Ketik atau tempel teks terlebih dahulu');
            return;
        }
        const success = this.vncSession.sendClipboard(text);
        if (success) {
            Toast.success('Teks terkirim ke clipboard PC Klien (Ctrl+V di PC)');
            const drawer = document.getElementById('modal-vnc-clipboard-drawer');
            if (drawer) drawer.classList.add('hidden');
        } else {
            Toast.error('Gagal mengirim teks ke clipboard PC');
        }
    },

    copyReceivedToHost: async function() {
        const recInput = document.getElementById('modal-vnc-clip-rec');
        const text = recInput ? recInput.value : (this.vncSession ? this.vncSession.getRemoteClipboard() : '');
        if (!text) {
            Toast.warning('Belum ada teks yang disalin dari remote PC');
            return;
        }
        let copied = false;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                copied = true;
            } catch (e) {
                console.warn('[VNC] navigator.clipboard.writeText gagal:', e);
            }
        }
        if (!copied && recInput) {
            recInput.select();
            recInput.setSelectionRange(0, 99999);
            try {
                copied = document.execCommand('copy');
            } catch (e) {}
        }
        if (copied) {
            Toast.success('Teks berhasil disalin ke clipboard perangkat ini!');
        } else {
            Toast.info('Silakan salin teks manual dari kotak');
            if (recInput) recInput.focus();
        }
    },

    onModalClose: function(pcId) {
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
