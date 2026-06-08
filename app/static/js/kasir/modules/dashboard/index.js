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
            console.log('[Dashboard] Fetching PC data...');
            const data = await API.dashboard.pcList();
            console.log('[Dashboard] Response:', data);
            if (!data || !data.by_grup) throw new Error('Data format invalid - missing by_grup');
            const groups = Object.keys(data.by_grup);
            console.log('[Dashboard] Loaded', data.pc_list?.length, 'PCs, groups:', groups);
            if (groups.length === 0) throw new Error('Tidak ada grup PC tersedia');
            this.lastData = data;
            this.renderTabs(data);
            this.render(data);
            this.updateStats();
            this.updateTime();
        } catch (err) {
            console.error('[Dashboard] Error:', err);
            if (container) {
                container.innerHTML = `<div class="text-center py-20 text-red-400 text-sm">Gagal memuat dashboard: ${err.message}<br><button onclick="Dashboard.load()" class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold">Coba Lagi</button></div>`;
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
                            <span class="text-[10px] font-bold text-neutral-400 uppercase font-mono">${pc.grup}</span>
                            <span class="text-[9px] text-neutral-600 font-mono">${pc.ip_address}</span>
                        </div>
                    </div>
                    <button onclick="Modal.closeModal()" class="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 hover:text-neutral-100 hover:bg-[#222] transition-colors flex items-center justify-center text-lg leading-none">&times;</button>
                </div>

                <div id="modal-view-container" class="flex-1 overflow-hidden flex flex-col">
                    <div id="view-action-menu" class="p-6">
                        <div class="grid grid-cols-2 gap-3">
                            <button onclick="Dashboard.showProcesses()" 
                                class="flex flex-col items-center gap-3 p-6 bg-[#0f0f0f] border border-[#232323] hover:border-neutral-500 rounded-lg transition-colors ${!isOnline ? 'opacity-40 cursor-not-allowed' : ''}"
                                ${!isOnline ? 'disabled' : ''}>
                                <div class="w-10 h-10 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                                    <svg class="w-5 h-5 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path></svg>
                                </div>
                                <span class="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Monitor Proses</span>
                            </button>

                            <div class="flex flex-col items-center gap-3 p-6 bg-[#0f0f0f] border border-[#232323] rounded-lg opacity-30">
                                <div class="w-10 h-10 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                                    <svg class="w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                </div>
                                <span class="text-[10px] font-bold text-neutral-600 uppercase tracking-wider">Remote Layar</span>
                            </div>

                            <!-- Terminal slot → Pindah PC (aktif hanya jika ada sesi non-admin) -->
                            ${sesi && sesi.tipe !== 'admin' ? `
                            <button onclick="Dashboard.pindahSesi(${sesi.id}, '${sesi.tipe}', '${pc.grup}')"
                                class="flex flex-col items-center gap-3 p-6 bg-[#0f0f0f] border border-[#232323] hover:border-neutral-400 hover:bg-[#141414] rounded-lg transition-colors">
                                <div class="w-10 h-10 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                                    <svg class="w-5 h-5 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                    </svg>
                                </div>
                                <span class="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Pindah PC</span>
                            </button>
                            ` : `
                            <div class="flex flex-col items-center gap-3 p-6 bg-[#0f0f0f] border border-[#1c1c1c] border-dashed rounded-lg opacity-30 cursor-not-allowed">
                                <div class="w-10 h-10 rounded-lg bg-[#1a1a1a] border border-[#232323] flex items-center justify-center">
                                    <svg class="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                    </svg>
                                </div>
                                <span class="text-[10px] font-bold text-neutral-600 uppercase tracking-wider">Pindah PC</span>
                            </div>
                            `}

                            <!-- Hardware slot -->
                            <div class="flex flex-col items-center gap-3 p-6 bg-[#0f0f0f] border border-[#232323] rounded-lg opacity-25">
                                <div class="w-10 h-10 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                                    <svg class="w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                </div>
                                <span class="text-[10px] font-bold text-neutral-600 uppercase tracking-wider">Hardware</span>
                            </div>
                        </div>
                    </div>

                    <div id="view-process-list" class="hidden flex-1 flex flex-col overflow-hidden">
                        <div class="px-6 py-3 border-b border-[#1c1c1c] flex items-center justify-between">
                            <button onclick="Dashboard.backToMenu()" class="text-xs text-neutral-400 hover:text-neutral-200 font-bold transition-colors">&larr; Kembali</button>
                            <span id="modal-pc-count" class="text-xs text-neutral-500 font-mono">0 PROSES</span>
                        </div>
                        <div class="flex-1 overflow-x-hidden overflow-y-auto scrollbar-mono w-full">
                            <table class="w-full text-xs">
                                <thead class="sticky top-0 bg-[#0c0c0c]">
                                    <tr class="border-b border-[#1c1c1c] text-[10px] text-neutral-500 uppercase tracking-wider">
                                        <th class="px-6 py-3 text-left">Nama</th>
                                        <th class="px-6 py-3 text-left">Judul</th>
                                    </tr>
                                </thead>
                                <tbody id="modal-process-list" class="divide-y divide-[#1c1c1c]">
                                    <tr><td colspan="2" class="px-6 py-10 text-center text-neutral-500 text-xs font-mono">Memuat...</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <div class="p-4 border-t border-[#2a2a2a] flex justify-end">
                            <button id="btn-refresh-processes" onclick="Dashboard.loadProcesses(${pc.id})" class="px-4 py-2 bg-neutral-100 hover:bg-white text-black text-xs font-bold rounded-lg transition-colors">Segarkan</button>
                        </div>
                    </div>
                </div>

                <div class="p-4 border-t border-[#2a2a2a] flex justify-end">
                    <button onclick="Modal.closeModal()" class="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs font-bold rounded-lg transition-colors">Tutup</button>
                </div>
            </div>
        `;

        Modal.show(modalHtml);
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
        container.innerHTML = '<tr><td colspan="2" class="px-6 py-10 text-center text-neutral-500 text-xs font-mono">Memuat...</td></tr>';

        try {
            const res = await fetch(`/api/monitor/processes/${pcId}`);
            const json = await res.json();

            if (!json.success) throw new Error(json.error);

            const data = json.data || [];
            countEl.innerText = `${data.length} PROSES`;

            if (data.length === 0) {
                container.innerHTML = '<tr><td colspan="2" class="px-6 py-10 text-center text-neutral-500 text-xs font-mono">Tidak ada proses</td></tr>';
                return;
            }

            container.innerHTML = data.map(p => `
                <tr class="hover:bg-[#121212] transition-colors">
                    <td class="px-6 py-3 text-xs text-neutral-200 font-mono">${p.name}</td>
                    <td class="px-6 py-3 text-xs text-neutral-500 font-mono">${p.title || '-'}</td>
                </tr>
            `).join('');

        } catch (err) {
            container.innerHTML = `<tr><td colspan="2" class="px-6 py-10 text-center text-red-400 text-xs font-mono">Gagal: ${err.message}</td></tr>`;
        }
    },

    async tutupSesi(sesiId) {
        Modal.confirm('<div class="text-center"><p class="text-xs text-neutral-400 font-bold uppercase tracking-wider">Tutup Sesi Billing?</p><p class="text-[10px] text-neutral-500 mt-1">Sesi transaksi ini akan dihentikan.</p></div>', async () => {
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
                        <div class="font-bold text-neutral-200 font-mono text-xs">${pc.kode}</div>
                        <div class="text-[9px] text-neutral-500 font-mono">${pc.ip_address || '-'}</div>
                    </div>
                `;
            });
            cardsHtml += '</div>';

            const modalHtml = `
                <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-6 max-w-2xl w-full">
                    <div class="flex items-center justify-between mb-4 pb-4 border-b border-[#1c1c1c]">
                        <div>
                            <h3 class="text-xs font-bold text-neutral-200 uppercase tracking-wider">Pindah Sesi</h3>
                            <p class="text-[9px] text-neutral-500 mt-1">Pilih PC tujuan di grup ${pcGrup.toUpperCase()}</p>
                        </div>
                        <button onclick="Modal.closeModal()" class="text-neutral-500 hover:text-neutral-300 text-xl leading-none">&times;</button>
                    </div>
                    ${cardsHtml}
                    <div class="flex justify-end mt-4">
                        <button onclick="Modal.closeModal()" class="px-4 py-2 bg-[#171717] border border-[#262626] hover:bg-[#222] text-neutral-400 text-xs font-bold rounded transition-colors">Batal</button>
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
            if (statIncome) statIncome.innerText = 'Rp ' + (data.total_pendapatan || 0).toLocaleString('id-ID');
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
        Modal.confirm('<div class="text-center"><p class="text-xs text-neutral-400 font-bold uppercase tracking-wider">Paksa Logout Admin?</p><p class="text-[10px] text-neutral-500 mt-1">Akses bypass administrator pada unit ini akan dicabut.</p></div>', async () => {
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
    }
};

Object.assign(Dashboard, DashboardCards);
window.Dashboard = Dashboard;
