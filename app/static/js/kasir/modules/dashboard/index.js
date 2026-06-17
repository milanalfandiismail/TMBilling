// app/static/js/kasir/modules/dashboard/index.js

const Dashboard = {
    refreshInterval: null,
    isSidebarMini: false,
    activeGrup: 'semua',
    lastData: null,
    _currentPcId: null,

    grupStyles: {
        'vvip': { text: 'text-rose-400', border: 'border-rose-800', bg: 'bg-rose-500/10', dot: 'bg-rose-500' },
        'vip': { text: 'text-amber-400', border: 'border-amber-800', bg: 'bg-amber-500/10', dot: 'bg-amber-500' },
        'reguler': { text: 'text-indigo-400', border: 'border-indigo-800', bg: 'bg-indigo-500/10', dot: 'bg-indigo-500' }
    },

    toggleSidebar() {
        DashboardSidebar.toggleSidebar();
    },

    async load() {
        const container = document.getElementById('pc-area');
        try {
            const data = await API.dashboard.pcList();
            if (!data || !data.by_grup) throw new Error('Data format invalid - missing by_grup');
            const groups = Object.keys(data.by_grup);
            if (groups.length === 0) throw new Error('Tidak ada grup PC tersedia');
            this.lastData = data;
            this.renderTabs(data);
            this.render(data);
            this.updateStats();
            this.updateTime();
        } catch (err) {
            console.error('[Dashboard] Error:', err);
            if (container) {
                container.innerHTML = `<div class="text-center py-20 text-red-400 text-sm">Gagal memuat dashboard: ${err.message}<br><button onclick="Dashboard.load()" class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs lg:text-base font-semibold">Coba Lagi</button></div>`;
            }
        }
    },

    setGrup(grupKey) {
        this.activeGrup = grupKey;
        if (this.lastData) {
            this.renderTabs(this.lastData);
            this.render(this.lastData);
        }
    },

    showDetail(pcId) {
        this._currentPcId = pcId;
        const pc = this.lastData.pc_list.find(p => p.id === pcId);
        if (!pc) return;

        const isOnline = pc.status !== 'offline';
        const sesi = pc.sesi_detail;

        const modalHtml = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in">
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

                            <!-- 1. Monitor Proses -->
                            <button onclick="Dashboard.showProcesses()"
                                class="flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#232323] hover:border-neutral-500 rounded-lg transition-colors ${!isOnline ? 'opacity-40 cursor-not-allowed' : ''}"
                                ${!isOnline ? 'disabled' : ''}>
                                <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                                    <svg class="w-4.5 h-4.5 w-[18px] h-[18px] text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path></svg>
                                </div>
                                <span class="text-[10px] lg:text-base font-bold text-neutral-400 uppercase tracking-wider text-center leading-tight">Monitor Proses</span>
                            </button>

                            <!-- 2. Remote Layar (disabled) -->
                            <div class="flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#232323] rounded-lg opacity-25">
                                <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                                    <svg class="w-[18px] h-[18px] text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                </div>
                                <span class="text-[10px] lg:text-base font-bold text-neutral-600 uppercase tracking-wider text-center leading-tight">Remote Layar</span>
                            </div>

                            <!-- 3. Wake-on-LAN -->
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

                            <!-- 4. Pindah PC -->
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

                            <!-- 5. Hardware (reserved) -->
                            <div class="flex flex-col items-center gap-2 p-4 bg-[#0f0f0f] border border-[#232323] rounded-lg opacity-25">
                                <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                                    <svg class="w-[18px] h-[18px] text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                </div>
                                <span class="text-[10px] lg:text-base font-bold text-neutral-600 uppercase tracking-wider text-center leading-tight">Hardware</span>
                            </div>

                            <!-- 6-9: Reserved slots -->
                            <button id="btn-screenshot-${pc.id}" onclick="Dashboard.takeScreenshot(${pc.id})"
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
                            <!-- 7. Restart PC -->
                            ${isOnline ? `
                            <button onclick="Modal.closeModal(); Dashboard.remoteAction(${pc.id}, 'restart')"
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

                            <!-- 8. Shutdown PC -->
                            ${isOnline ? `
                            <button onclick="Modal.closeModal(); Dashboard.remoteAction(${pc.id}, 'shutdown')"
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

                        <!-- Area Preview Tangkapan Layar -->
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
                                    onclick="Dashboard.viewFullscreen(this)" />
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
                            <button onclick="Dashboard.backToMenu()" class="text-xs lg:text-base text-neutral-400 hover:text-neutral-200 font-bold transition-colors">&larr; Kembali</button>
                            <span id="modal-pc-count" class="text-xs lg:text-base text-neutral-500 font-mono">0 PROSES</span>
                        </div>
                        <div class="flex-1 overflow-x-hidden overflow-y-auto scrollbar-mono w-full">
                            <table class="w-full text-xs lg:text-base">
                                <thead class="sticky top-0 bg-[#0c0c0c]">
                                    <tr class="border-b border-[#1c1c1c] text-[10px] lg:text-base text-neutral-500 uppercase tracking-wider">
                                        <th class="px-6 py-3 text-left">Nama</th>
                                        <th class="px-6 py-3 text-left">Judul</th>
                                    </tr>
                                </thead>
                                <tbody id="modal-process-list" class="divide-y divide-[#1c1c1c]">
                                    <tr><td colspan="2" class="px-6 py-10 text-center text-neutral-500 text-xs lg:text-base font-mono">Memuat...</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <div class="p-4 border-t border-[#2a2a2a] flex justify-end">
                            <button id="btn-refresh-processes" onclick="Dashboard.loadProcesses(${pc.id})" class="px-4 py-2 bg-neutral-100 hover:bg-white text-black text-xs lg:text-base font-bold rounded-lg transition-colors">Segarkan</button>
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
            const response = await fetch(`/api/monitor/screenshot/trigger/${pcId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Gagal memicu screenshot');
            }

            Toast.success('Permintaan screenshot dikirim ke PC!');
            text.innerText = 'MENUNGGU...';

            // Polling status screenshot baru setiap 2 detik (maksimal 8 kali = 16 detik)
            let attempts = 0;
            const maxAttempts = 8;
            const interval = setInterval(async () => {
                attempts++;
                try {
                    const statusRes = await fetch(`/api/monitor/screenshot/status/${pcId}`);
                    const statusData = await statusRes.json();
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
                    console.error('[Dashboard] Error polling screenshot:', err);
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
            console.error('[Dashboard] Screenshot error:', err);
            Toast.error(err.message || 'Gagal memicu screenshot');
            btn.disabled = false;
            btn.classList.remove('opacity-40', 'cursor-not-allowed');
            text.innerText = oldText;
        }
    },

    remoteAction(pcId, action) {
        const actionLabel = action === 'shutdown' ? 'Shutdown (Matikan)' : 'Restart (Mulai Ulang)';
        const pc = this.lastData?.pc_list?.find(p => p.id === pcId);
        const pcName = pc ? pc.kode : `PC #${pcId}`;

        Modal.confirm(`
            <div class="text-center">
                <p class="text-xs lg:text-base text-neutral-400 font-bold uppercase tracking-wider">${actionLabel} PC ${pcName}?</p>
                <p class="text-[10px] lg:text-base text-red-400 font-bold mt-1">⚠️ Perhatian: PC akan langsung mati/restart secara paksa. Semua pekerjaan yang belum disimpan di PC client akan hilang.</p>
            </div>
        `, async () => {
            try {
                const response = await fetch(`/api/monitor/remote/${pcId}/${action}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                const result = await response.json();
                if (!result.success) {
                    throw new Error(result.error || 'Gagal mengirim perintah');
                }
                Toast.success(`Perintah ${action === 'shutdown' ? 'Shutdown' : 'Restart'} berhasil dikirim ke PC!`);
            } catch (err) {
                console.error('[Dashboard] Remote action error:', err);
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

    showProcesses() {
        document.getElementById('view-action-menu').classList.add('hidden');
        document.getElementById('view-process-list').classList.remove('hidden');
        this.loadProcesses(this._currentPcId);
    },

    backToMenu() {
        document.getElementById('view-action-menu').classList.remove('hidden');
        document.getElementById('view-process-list').classList.add('hidden');
    },

    async loadProcesses(pcId) {
        const container = document.getElementById('modal-process-list');
        const countEl = document.getElementById('modal-pc-count');
        container.innerHTML = '<tr><td colspan="2" class="px-6 py-10 text-center text-neutral-500 text-xs lg:text-base font-mono">Memuat...</td></tr>';

        try {
            const res = await fetch(`/api/monitor/processes/${pcId}`);
            const json = await res.json();

            if (!json.success) throw new Error(json.error);

            const data = json.data || [];
            countEl.innerText = `${data.length} PROSES`;

            if (data.length === 0) {
                container.innerHTML = '<tr><td colspan="2" class="px-6 py-10 text-center text-neutral-500 text-xs lg:text-base font-mono">Tidak ada proses</td></tr>';
                return;
            }

            container.innerHTML = data.map(p => `
                <tr class="hover:bg-[#121212] transition-colors">
                    <td class="px-6 py-3 text-xs lg:text-base text-neutral-200 font-mono">${p.name}</td>
                    <td class="px-6 py-3 text-xs lg:text-base text-neutral-500 font-mono">${p.title || '-'}</td>
                </tr>
            `).join('');

        } catch (err) {
            container.innerHTML = `<tr><td colspan="2" class="px-6 py-10 text-center text-red-400 text-xs lg:text-base font-mono">Gagal: ${err.message}</td></tr>`;
        }
    },

    async tutupSesi(sesiId) {
        Modal.confirm('<div class="text-center"><p class="text-xs lg:text-base text-neutral-400 font-bold uppercase tracking-wider">Tutup Sesi Billing?</p><p class="text-[10px] lg:text-base text-neutral-500 mt-1">Sesi transaksi ini akan dihentikan.</p></div>', async () => {
            try {
                await API.sesi.tutup(sesiId);
                Toast.success('Sesi ditutup');
                this.load();
            } catch (err) {
                Toast.error(err.message);
            }
        });
    },

    pindahSesi(sesiId, tipe, grup) {
        this.pindahPc(sesiId, tipe, grup);
    },

    attachEvents() {
        // no longer needed - buttons use inline onclick
    },

    async pindahPc(sesiId, tipe, pcGrup) {
        try {
            const data = await API.pc.list();
            const kosong = (data.pc_list || []).filter(p => p.status === 'kosong' && p.grup === pcGrup);

            if (kosong.length === 0) {
                Toast.error(`Tidak ada PC kosong di ${pcGrup.toUpperCase()}`);
                return;
            }

            let cardsHtml = '<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-[50vh] overflow-y-auto p-2 scrollbar-mono">';
            kosong.forEach(pc => {
                cardsHtml += `
                    <div class="pc-card-tujuan bg-[#050505] border border-[#1c1c1c] rounded p-3 cursor-pointer hover:border-neutral-500 transition-colors text-center"
                         data-pc-kode="${pc.kode}">
                        <div class="font-bold text-neutral-200 font-mono text-xs lg:text-base">${pc.kode}</div>
                    </div>
                `;
            });
            cardsHtml += '</div>';

            const modalHtml = `
                <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-6 max-w-2xl w-full">
                    <div class="flex items-center justify-between mb-4 pb-4 border-b border-[#1c1c1c]">
                        <div>
                            <h3 class="text-xs lg:text-base font-bold text-neutral-200 uppercase tracking-wider">Pindah Sesi</h3>
                            <p class="text-[9px] lg:text-base text-neutral-500 mt-1">Pilih PC tujuan di grup ${pcGrup.toUpperCase()}</p>
                        </div>
                        <button onclick="Modal.closeModal()" class="text-neutral-500 hover:text-neutral-300 text-xl leading-none">&times;</button>
                    </div>
                    ${cardsHtml}
                    <div class="flex justify-end mt-4">
                        <button onclick="Modal.closeModal()" class="px-4 py-2 bg-[#171717] border border-[#262626] hover:bg-[#222] text-neutral-400 text-xs lg:text-base font-bold rounded transition-colors">Batal</button>
                    </div>
                </div>
            `;
            Modal.show(modalHtml);

            document.querySelectorAll('.pc-card-tujuan').forEach(card => {
                card.addEventListener('click', async () => {
                    const pcKode = card.getAttribute('data-pc-kode');
                    if (pcKode) {
                        Modal.closeModal();
                        try {
                            await API.sesi.pindahPC(sesiId, pcKode);
                            Toast.success(`Sesi dipindah ke PC ${pcKode}`);
                            this.load();
                        } catch (err) {
                            Toast.error(err.message);
                        }
                    }
                });
            });
        } catch (err) {
            Toast.error('Gagal memuat daftar PC');
        }
    },

    async updateStats() {
        try {
            const data = await API.report.harian();

            let activeCount = 0;
            let availableCount = 0;
            let disconnectedCount = 0;

            if (this.lastData && this.lastData.pc_list) {
                this.lastData.pc_list.forEach(pc => {
                    if (pc.status === 'terpakai') {
                        activeCount++;
                    }
                    if (pc.status_koneksi === 'online' && pc.status === 'kosong') {
                        availableCount++;
                    }
                    if (pc.status_koneksi === 'no_heartbeat' || (pc.status === 'terpakai' && pc.status_koneksi === 'offline')) {
                        disconnectedCount++;
                    }
                });
            }

            const statActive = document.getElementById('stat-active');
            const statAvailable = document.getElementById('stat-available');
            const statDisconnected = document.getElementById('stat-disconnected');
            const statIncome = document.getElementById('stat-income');

            if (statActive) statActive.innerText = activeCount;
            if (statAvailable) statAvailable.innerText = availableCount;
            if (statDisconnected) statDisconnected.innerText = disconnectedCount;
            if (statIncome) statIncome.innerText = Utils.formatRupiah(data.total_pendapatan || 0);
        } catch (err) {
            console.error('Stats error:', err);
        }
    },

    updateTime() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeEl = document.getElementById('current-time');
        const dateEl = document.getElementById('current-date');
        if (timeEl) timeEl.innerText = timeStr;
        if (dateEl) dateEl.innerText = dateStr;
    },

    async logoutAdmin(pcId, sesiId = null) {
        Modal.confirm('<div class="text-center"><p class="text-xs lg:text-base text-neutral-400 font-bold uppercase tracking-wider">Paksa Logout Admin?</p><p class="text-[10px] lg:text-base text-neutral-500 mt-1">Akses bypass administrator pada unit ini akan dicabut.</p></div>', async () => {
            try {
                if (sesiId) {
                    await API.sesi.tutup(sesiId);
                } else {
                    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
                    const res = await fetch(`/api/pc/reset-admin/${pcId}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': csrfToken
                        }
                    });
                    const json = await res.json();
                    if (!json.success) throw new Error(json.error || 'Gagal reset admin');
                }
                Toast.success('Admin berhasil dilogout');
                this.load();
            } catch (err) {
                Toast.error(err.message);
            }
        });
    },

    // =========================================================
    // RIGHT-CLICK CONTEXT MENU
    // =========================================================

    showContextMenu(event, pcId) {
        this.closeContextMenu();

        const pc = this.lastData?.pc_list?.find(p => p.id === pcId);
        if (!pc) return;

        const hasMac = !!pc.mac_address;
        const hasSesi = !!(pc.sesi_detail && pc.sesi_detail.tipe !== 'admin');
        const isAdminMode = pc.is_admin_mode || (pc.sesi_detail?.tipe === 'admin');

        const menu = document.createElement('div');
        menu.id = 'pc-context-menu';
        menu.className = [
            'fixed z-[9999] min-w-[200px] py-1.5',
            'bg-[#141414] border border-[#2a2a2a] rounded-xl shadow-2xl',
            'animate-in fade-in slide-in-from-top-1 duration-100'
        ].join(' ');

        // Header — nama PC
        menu.innerHTML = `
            <div class="px-4 py-2 border-b border-[#222] mb-1">
                <div class="text-xs lg:text-base font-bold text-neutral-200 font-mono">${pc.kode}</div>
                <div class="text-[10px] lg:text-base text-neutral-500 font-mono">${pc.ip_address || 'Tidak ada IP'}</div>
            </div>

            <!-- Detail PC -->
            <button class="ctx-item w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-neutral-300 hover:bg-[#1f1f1f] hover:text-white transition-colors text-left"
                    onclick="Dashboard.closeContextMenu(); Dashboard.showDetail(${pcId})">
                <svg class="w-3.5 h-3.5 text-neutral-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>Detail PC</span>
            </button>

            <!-- Buka Sesi (jika kosong) -->
            ${!pc.sesi_detail && !isAdminMode ? `
            <button class="ctx-item w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-neutral-300 hover:bg-[#1f1f1f] hover:text-white transition-colors text-left"
                    onclick="Dashboard.closeContextMenu(); BukaModal.open('${pc.kode}', '${pc.grup}')">
                <svg class="w-3.5 h-3.5 text-neutral-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                <span>Buka Sesi</span>
            </button>` : ''}

            <!-- Tambah Waktu (jika ada sesi aktif non-admin) -->
            ${hasSesi ? `
            <button class="ctx-item w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-neutral-300 hover:bg-[#1f1f1f] hover:text-white transition-colors text-left"
                    onclick="Dashboard.closeContextMenu(); TambahModal.open(${pc.sesi_detail.id}, '${pc.grup}')">
                <svg class="w-3.5 h-3.5 text-neutral-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>Tambah Waktu</span>
            </button>` : ''}

            <!-- Tutup Sesi (jika ada sesi aktif non-admin) -->
            ${hasSesi ? `
            <button class="ctx-item w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors text-left"
                    onclick="Dashboard.closeContextMenu(); Dashboard.tutupSesi(${pc.sesi_detail.id})">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
                <span>Tutup Sesi</span>
            </button>` : ''}

            <div class="border-t border-[#222] my-1"></div>

            <!-- Wake-on-LAN -->
            ${hasMac ? `
            <button class="ctx-item w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-green-400 hover:bg-green-950/40 hover:text-green-300 transition-colors text-left"
                    onclick="Dashboard.closeContextMenu(); Dashboard.wolSingle(${pcId})">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9"/>
                </svg>
                <span>Wake-on-LAN</span>
                <span class="ml-auto text-[9px] lg:text-base text-green-700 font-mono">${pc.mac_address}</span>
            </button>` : `
            <div class="ctx-item w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-neutral-600 cursor-not-allowed text-left" title="Tambahkan MAC Address di tab PC terlebih dahulu">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9"/>
                </svg>
                <span>Wake-on-LAN</span>
                <span class="ml-auto text-[9px] lg:text-base text-neutral-700">No MAC</span>
            </div>`}

            <!-- Remote Power Actions (Hanya jika PC Online) -->
            ${pc.status !== 'offline' ? `
            <div class="border-t border-[#222] my-1"></div>
            <button class="ctx-item w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors text-left"
                    onclick="Dashboard.closeContextMenu(); Dashboard.remoteAction(${pcId}, 'restart')">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
                </svg>
                <span>Restart PC</span>
            </button>
            <button class="ctx-item w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-red-500 hover:bg-red-950/50 hover:text-red-400 transition-colors text-left"
                    onclick="Dashboard.closeContextMenu(); Dashboard.remoteAction(${pcId}, 'shutdown')">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L12 12m0-6v6" />
                </svg>
                <span>Shutdown PC</span>
            </button>` : ''}
        `;

        // Posisi menu relatif ke kursor, jaga agar tidak keluar layar
        document.body.appendChild(menu);
        const mw = menu.offsetWidth || 210;
        const mh = menu.offsetHeight || 220;
        let x = event.clientX;
        let y = event.clientY;
        if (x + mw > window.innerWidth) x = window.innerWidth - mw - 8;
        if (y + mh > window.innerHeight) y = window.innerHeight - mh - 8;
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        // Tutup saat klik di luar (pasang listener baru, lepas yang lama dulu)
        if (this._ctxOutsideHandler) {
            document.removeEventListener('click', this._ctxOutsideHandler);
        }
        this._ctxOutsideHandler = (e) => {
            if (!document.getElementById('pc-context-menu')?.contains(e.target)) {
                this.closeContextMenu();
            }
        };
        // setTimeout agar click event yang memicu showContextMenu tidak langsung menutupnya
        setTimeout(() => {
            document.addEventListener('click', this._ctxOutsideHandler);
        }, 0);
    },

    closeContextMenu() {
        const el = document.getElementById('pc-context-menu');
        if (el) el.remove();
        // Bersihkan listener agar tidak menumpuk
        if (this._ctxOutsideHandler) {
            document.removeEventListener('click', this._ctxOutsideHandler);
            this._ctxOutsideHandler = null;
        }
    },

    /** Nyalakan satu PC via WoL (dipanggil dari context menu) */
    async wolSingle(pcId) {
        try {
            const result = await API.pc.wol([pcId]);
            const ok = result.result?.success || [];
            const errs = result.result?.errors || [];
            if (ok.length > 0) {
                Toast.success(`🟢 Magic Packet dikirim ke <strong>${ok.join(', ')}</strong>`);
            }
            if (errs.length > 0) {
                Toast.error(errs.map(e => e.error).join('<br>'));
            }
        } catch (err) {
            Toast.error(err.message);
        }
    }
};

Object.assign(Dashboard, DashboardCards);
window.Dashboard = Dashboard;
console.log('[Dashboard] Module initialized.');
