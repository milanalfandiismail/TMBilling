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

                            <div class="flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#232323] rounded-lg opacity-25">
                                <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                                    <svg class="w-[18px] h-[18px] text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                </div>
                                <span class="text-[10px] lg:text-base font-bold text-neutral-600 uppercase tracking-wider text-center leading-tight">Remote Layar</span>
                            </div>

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

                            <div class="flex flex-col items-center gap-2 p-4 bg-[#0a0a0a] border border-dashed border-[#1a1a1a] rounded-lg opacity-20"><span class="text-[9px] lg:text-base text-neutral-700 uppercase tracking-widest mt-4">—</span></div>
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
                </div>

                <div class="p-4 border-t border-[#2a2a2a] flex justify-end">
                    <button onclick="Modal.closeModal()" class="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs lg:text-base font-bold rounded-lg transition-colors">Tutup</button>
                </div>
            </div>
        `;

        Modal.show(modalHtml);
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
            const maxAttempts = 8;
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
    }
};
