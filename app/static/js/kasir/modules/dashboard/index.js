// app/static/js/kasir/modules/dashboard/index.js

/**
 * Main Controller untuk Dashboard Kasir TMBilling.
 * Mengkoordinasikan perenderan grid PC, context menu, filter grup, dan modal refilling/refund.
 */

const Dashboard = {
    refreshInterval: null,
    isSidebarMini: false,
    activeGrup: 'semua',
    lastData: null,
    _currentPcId: null,
    _searchMembers: [],
    _searchFiltered: [],
    _searchPage: 1,
    _searchPerPage: 8,
    _searchDebounceTimer: null,

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
            this.lastData = data;
            this._render(data);
            this.updateTime();
            if (data.omzet_billing !== undefined || data.omzet_kantin !== undefined || data.omzet_hari_ini !== undefined) {
                this.updateHeaderOmzet(data.omzet_billing, data.omzet_kantin, data.omzet_hari_ini);
            }
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
            this._render(this.lastData);
        }
    },

    showDetail(pcId) {
        this._currentPcId = pcId;
        DashboardDetailModal.showDetail(pcId, this.lastData);
    },

    takeScreenshot(pcId) {
        DashboardDetailModal.takeScreenshot(pcId);
    },

    remoteAction(pcId, action, pcKode = '') {
        DashboardDetailModal.remoteAction(pcId, action, pcKode);
    },

    viewFullscreen(imgEl) {
        DashboardDetailModal.viewFullscreen(imgEl);
    },

    showProcesses() {
        DashboardProcessMonitor.showProcesses(this._currentPcId);
    },

    backToMenu() {
        DashboardProcessMonitor.backToMenu();
    },

    loadProcesses(pcId) {
        DashboardProcessMonitor.loadProcesses(pcId);
    },

    killProcess(pcId, name) {
        DashboardProcessMonitor.killProcess(pcId, name);
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

    async showGuestRefundModal(sesiId) {
        try {
            const [sesiRes, paketRes] = await Promise.all([
                API.sesi.detail(sesiId),
                API.sesi.getRiwayatPaket(sesiId)
            ]);
            const sesi = sesiRes.data || sesiRes;
            const riwayatPaket = paketRes.paket || [];

            let riwayatHtml = '';
            if (riwayatPaket.length === 0) {
                riwayatHtml = `<div class="text-center py-10 text-neutral-500 text-xs lg:text-base font-bold uppercase tracking-wider">Tidak ada riwayat paket refundable</div>`;
            } else {
                riwayatHtml = `
                    <div class="divide-y divide-[#1c1c1c]/60 max-h-[350px] overflow-y-auto pr-1 scrollbar-mono">
                        ${riwayatPaket.map(t => `
                            <div class="py-3 flex items-center justify-between gap-3">
                                <div class="min-w-0 flex-1">
                                    <div class="font-bold text-neutral-200 text-xs lg:text-base lg:truncate break-words whitespace-normal font-mono">${t.nama}</div>
                                    <div class="text-[9px] lg:text-base text-neutral-400 mt-0.5 font-semibold">
                                        QTY : <span class="text-neutral-200">${t.qty || 1}x</span> (${Utils.formatDurasiFriendly(t.durasi_menit)})
                                    </div>
                                    <div class="text-[9px] lg:text-base text-neutral-500 font-mono mt-0.5">
                                        ${t.dibuat_pada}
                                    </div>
                                </div>
                                <div class="text-right flex items-center gap-3">
                                    <span class="text-xs lg:text-base font-mono font-bold text-neutral-300">${Utils.formatRupiah(t.harga)}</span>
                                    <button onclick="Dashboard.refundGuestPaket(${sesiId}, ${t.id}, '${t.nama.replace(/'/g, "\\'")}', ${t.durasi_menit}, '${t.dibuat_pada}', ${sesi.sisa_waktu || 0})" 
                                        class="px-2 py-1 text-[9px] lg:text-xs font-bold bg-[#3b1216] border border-[#ef4444]/30 text-red-200 hover:bg-red-600 hover:text-white rounded transition-colors uppercase shrink-0 font-mono">
                                        REFUND
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            const detailHtml = `
                <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded-xl p-4 md:p-6 max-w-lg w-[calc(100%-2rem)] mx-auto md:w-full max-h-[85vh] overflow-y-auto scrollbar-thin my-auto">
                    <div class="flex items-center justify-between mb-4 pb-4 border-b border-[#1c1c1c]">
                        <div>
                            <h3 class="text-xs lg:text-base font-bold text-neutral-200 uppercase tracking-wider font-mono">Refund Paket Guest</h3>
                            <p class="text-[9px] lg:text-base text-neutral-500 mt-0.5">Riwayat Pembelian Paket Sesi Ini</p>
                        </div>
                        <button onclick="Modal.closeModal()" class="text-neutral-500 hover:text-neutral-300 text-xl leading-none">&times;</button>
                    </div>
                    <div class="bg-[#050505] border border-[#1c1c1c] rounded p-4">
                        ${riwayatHtml}
                    </div>
                    <div class="flex gap-3 justify-end mt-6 pt-4 border-t border-[#1c1c1c]">
                        <button onclick="Modal.closeModal()" class="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs lg:text-base font-bold rounded-lg transition-colors font-mono">Tutup</button>
                    </div>
                </div>`;
            Modal.show(detailHtml);
        } catch (err) {
            Toast.error('Gagal mengambil detail riwayat paket: ' + err.message);
        }
    },

    attachEvents() {
        // Event listeners handled via inline onclick handlers
    },

    async refundGuestPaket(sesiId, transaksiId, namaPaket, durasiMenit, dibuatPada, sisaWaktuSekarang) {
        const durasiFriendly = Utils.formatDurasiFriendly(durasiMenit);
        const sisaSekarangFriendly = Utils.formatDurasiFriendly(sisaWaktuSekarang);
        const setelahDeduction = Math.max(0, sisaWaktuSekarang - durasiMenit);
        const setelahDeductionFriendly = Utils.formatDurasiFriendly(setelahDeduction);

        const confirmHtml = `
            <div class="text-center space-y-2">
                <p class="text-xs lg:text-base text-neutral-400 font-bold uppercase tracking-wider">Refund Paket Billing Guest?</p>
                <div class="bg-[#050505] border border-[#2a2a2a] rounded-lg p-3 my-2 text-left space-y-1.5 font-mono">
                    <div class="flex justify-between text-neutral-300 text-xs lg:text-sm">
                        <span>Paket:</span>
                        <span class="font-bold text-neutral-200 text-right">${namaPaket}</span>
                    </div>
                    <div class="flex justify-between text-neutral-300 text-xs lg:text-sm border-t border-[#1c1c1c] pt-1.5">
                        <span>Total Waktu Sekarang:</span>
                        <span class="font-bold text-neutral-300 text-right">${sisaSekarangFriendly}</span>
                    </div>
                    <div class="flex justify-between text-neutral-300 text-xs lg:text-sm">
                        <span>Potongan Refund:</span>
                        <span class="font-bold text-red-400 text-right">-${durasiFriendly}</span>
                    </div>
                    <div class="flex justify-between text-neutral-300 text-xs lg:text-sm border-t border-[#1c1c1c]/80 pt-1.5">
                        <span>Total Akhir Waktu:</span>
                        <span class="font-bold text-emerald-400 text-right">${setelahDeductionFriendly}</span>
                    </div>
                    <div class="flex justify-between text-neutral-300 text-xs lg:text-sm border-t border-[#1c1c1c]/80 pt-1.5">
                        <span>Pembelian:</span>
                        <span class="text-neutral-400 text-right">${dibuatPada}</span>
                    </div>
                </div>
                <p class="text-[10px] lg:text-base text-neutral-500 mt-1">Total waktu bermain guest akan dikurangi menjadi <strong>${setelahDeductionFriendly}</strong>.</p>
            </div>
        `;
        Modal.confirm(confirmHtml, async () => {
            try {
                const res = await API.sesi.refundPaket(sesiId, transaksiId);
                Toast.success(res.message || 'Refund berhasil');
                Modal.closeModal();
                this.load();
            } catch (err) {
                Toast.error(err.message || 'Gagal refund');
            }
        });
    },

    async showMemberRefundModal(memberId) {
        try {
            const [memberRes, paketRes] = await Promise.all([
                API.member.get(memberId),
                API.member.getPaket(memberId)
            ]);
            const member = memberRes.member || memberRes.data || memberRes;
            const riwayatPaket = paketRes.paket || [];

            let riwayatHtml = '';
            if (riwayatPaket.length === 0) {
                riwayatHtml = `<div class="text-center py-10 text-neutral-500 text-xs lg:text-base font-bold uppercase tracking-wider">Tidak ada riwayat paket refundable</div>`;
            } else {
                riwayatHtml = `
                    <div class="divide-y divide-[#1c1c1c]/60 max-h-[350px] overflow-y-auto pr-1 scrollbar-mono">
                        ${riwayatPaket.map(t => `
                            <div class="py-3 flex items-center justify-between gap-3">
                                <div class="min-w-0 flex-1">
                                    <div class="font-bold text-neutral-200 text-xs lg:text-base lg:truncate break-words whitespace-normal font-mono">${t.nama}</div>
                                    <div class="text-[9px] lg:text-base text-neutral-400 mt-0.5 font-semibold">
                                        QTY : <span class="text-neutral-200">${t.qty || 1}x</span> (${Utils.formatDurasiFriendly(t.durasi_menit)})
                                    </div>
                                    <div class="text-[9px] lg:text-base text-neutral-500 font-mono mt-0.5">
                                        ${t.dibuat_pada}
                                    </div>
                                </div>
                                <div class="text-right flex items-center gap-3">
                                    <span class="text-xs lg:text-base font-mono font-bold text-neutral-300">${Utils.formatRupiah(t.harga)}</span>
                                    <button onclick="Dashboard.refundMemberPaket(${memberId}, ${t.id}, '${t.nama.replace(/'/g, "\\'")}', ${t.durasi_menit}, '${t.dibuat_pada}', ${member.waktu_saved || member.waktu_tersimpan || 0})" 
                                        class="px-2 py-1 text-[9px] lg:text-xs font-bold bg-[#3b1216] border border-[#ef4444]/30 text-red-200 hover:bg-red-600 hover:text-white rounded transition-colors uppercase shrink-0 font-mono">
                                        REFUND
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            const detailHtml = `
                <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded-xl p-4 md:p-6 max-w-lg w-[calc(100%-2rem)] mx-auto md:w-full max-h-[85vh] overflow-y-auto scrollbar-thin my-auto">
                    <div class="flex items-center justify-between mb-4 pb-4 border-b border-[#1c1c1c]">
                        <div>
                            <h3 class="text-xs lg:text-base font-bold text-neutral-200 uppercase tracking-wider font-mono">Refund Paket Member</h3>
                            <p class="text-[9px] lg:text-base text-neutral-500 mt-0.5">Riwayat Pembelian Paket Member Ini</p>
                        </div>
                        <button onclick="Modal.closeModal()" class="text-neutral-500 hover:text-neutral-300 text-xl leading-none">&times;</button>
                    </div>
                    <div class="bg-[#050505] border border-[#1c1c1c] rounded p-4">
                        ${riwayatHtml}
                    </div>
                    <div class="flex gap-3 justify-end mt-6 pt-4 border-t border-[#1c1c1c]">
                        <button onclick="Modal.closeModal()" class="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs lg:text-base font-bold rounded-lg transition-colors font-mono">Tutup</button>
                    </div>
                </div>`;
            Modal.show(detailHtml);
        } catch (err) {
            Toast.error('Gagal mengambil detail riwayat paket: ' + err.message);
        }
    },

    async refundMemberPaket(memberId, transaksiId, namaPaket, durasiMenit, dibuatPada, sisaWaktuSekarang) {
        const durasiFriendly = Utils.formatDurasiFriendly(durasiMenit);
        const sisaSekarangFriendly = Utils.formatDurasiFriendly(sisaWaktuSekarang);
        const setelahDeduction = Math.max(0, sisaWaktuSekarang - durasiMenit);
        const setelahDeductionFriendly = Utils.formatDurasiFriendly(setelahDeduction);

        const confirmHtml = `
            <div class="text-center space-y-2">
                <p class="text-xs lg:text-base text-neutral-400 font-bold uppercase tracking-wider">Refund Paket Billing Member?</p>
                <div class="bg-[#050505] border border-[#2a2a2a] rounded-lg p-3 my-2 text-left space-y-1.5 font-mono">
                    <div class="flex justify-between text-neutral-300 text-xs lg:text-sm">
                        <span>Paket:</span>
                        <span class="font-bold text-neutral-200 text-right">${namaPaket}</span>
                    </div>
                    <div class="flex justify-between text-neutral-300 text-xs lg:text-sm border-t border-[#1c1c1c] pt-1.5">
                        <span>Total Waktu Sekarang:</span>
                        <span class="font-bold text-neutral-300 text-right">${sisaSekarangFriendly}</span>
                    </div>
                    <div class="flex justify-between text-neutral-300 text-xs lg:text-sm">
                        <span>Potongan Refund:</span>
                        <span class="font-bold text-red-400 text-right">-${durasiFriendly}</span>
                    </div>
                    <div class="flex justify-between text-neutral-300 text-xs lg:text-sm border-t border-[#1c1c1c]/80 pt-1.5">
                        <span>Total Akhir Waktu:</span>
                        <span class="font-bold text-emerald-400 text-right">${setelahDeductionFriendly}</span>
                    </div>
                    <div class="flex justify-between text-neutral-300 text-xs lg:text-sm border-t border-[#1c1c1c]/80 pt-1.5">
                        <span>Pembelian:</span>
                        <span class="text-neutral-400 text-right">${dibuatPada}</span>
                    </div>
                </div>
                <p class="text-[10px] lg:text-base text-neutral-500 mt-1">Total waktu bermain member akan dikurangi menjadi <strong>${setelahDeductionFriendly}</strong>.</p>
            </div>
        `;
        Modal.confirm(confirmHtml, async () => {
            try {
                const res = await API.member.refundPaket(memberId, transaksiId);
                Toast.success(res.message || 'Refund berhasil');
                Modal.closeModal();
                this.load();
            } catch (err) {
                Toast.error(err.message || 'Gagal refund');
            }
        });
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
                            Toast.success(`Sesi dipindah ke ${pcKode}`);
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
            const statActive = document.getElementById('stat-active');
            const statAvailable = document.getElementById('stat-available');
            const statDisconnected = document.getElementById('stat-disconnected');
            const statIncome = document.getElementById('stat-income');

            if (!statActive && !statAvailable && !statDisconnected && !statIncome) {
                return;
            }

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

            if (statActive) statActive.innerText = activeCount;
            if (statAvailable) statAvailable.innerText = availableCount;
            if (statDisconnected) statDisconnected.innerText = disconnectedCount;
            if (statIncome) statIncome.innerText = Utils.formatRupiah(data.total_pendapatan || 0);
        } catch (err) {
            console.error('Stats error:', err);
        }
    },

    updateTime() {
        const container = document.querySelector('[data-timezone]');
        const tz = container?.dataset?.timezone || 'Asia/Makassar';
        const tzLabel = container?.dataset?.timezoneLabel || 'WITA';
        const opts = { hour: '2-digit', minute: '2-digit', timeZone: tz };
        const dateOpts = { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: tz };
        const now = new Date();
        const timeStr = now.toLocaleTimeString('id-ID', opts);
        const dateStr = now.toLocaleDateString('id-ID', dateOpts);
        const timeEl = document.getElementById('current-time');
        const dateEl = document.getElementById('current-date');
        if (timeEl) timeEl.innerText = `${timeStr} ${tzLabel}`;
        if (dateEl) dateEl.innerText = dateStr;
    },

    async logoutAdmin(pcId, sesiId = null) {
        Modal.confirm('<div class="text-center"><p class="text-xs lg:text-base text-neutral-400 font-bold uppercase tracking-wider">Tutup Sesi Admin?</p><p class="text-[10px] lg:text-base text-neutral-500 mt-1">Akses mode admin pada PC ini akan dicabut dan PC dikunci kembali ke mode Kiosk.</p></div>', async () => {
            try {
                if (sesiId) {
                    await API.sesi.tutup(sesiId);
                }
                const res = await API.request(`/api/v1/kasir/pc/reset-admin/${pcId}`, {
                    method: 'POST'
                });
                if (res && res.error) throw new Error(res.error);
                Toast.success('Sesi admin berhasil ditutup & PC dikunci');
                this.load();
            } catch (err) {
                Toast.error(err.message || 'Gagal menutup sesi admin');
            }
        });
    },

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

        menu.innerHTML = `
            <div class="px-4 py-2 border-b border-[#222] mb-1">
                <div class="text-xs lg:text-base font-bold text-neutral-200 font-mono">${pc.kode}</div>
                <div class="text-[10px] lg:text-base text-neutral-500 font-mono">${pc.ip_address || 'Tidak ada IP'}</div>
            </div>

            <button class="ctx-item w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-neutral-300 hover:bg-[#1f1f1f] hover:text-white transition-colors text-left"
                    onclick="Dashboard.closeContextMenu(); Dashboard.showDetail(${pcId})">
                <svg class="w-3.5 h-3.5 text-neutral-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>Detail PC</span>
            </button>

            ${!pc.sesi_detail && !isAdminMode ? `
            <button class="ctx-item w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-neutral-300 hover:bg-[#1f1f1f] hover:text-white transition-colors text-left"
                    onclick="Dashboard.closeContextMenu(); BukaModal.open('${pc.kode}', '${pc.grup}')">
                <svg class="w-3.5 h-3.5 text-neutral-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                <span>Buka Sesi</span>
            </button>` : ''}

            ${isAdminMode ? `
            <button class="ctx-item w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-amber-400 hover:bg-amber-950/40 hover:text-amber-300 transition-colors text-left font-mono"
                    onclick="Dashboard.closeContextMenu(); Dashboard.logoutAdmin(${pcId}, ${pc.sesi_detail ? pc.sesi_detail.id : 'null'})">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                </svg>
                <span>Logout Sesi Admin</span>
            </button>` : ''}

            ${hasSesi ? `
            <button class="ctx-item w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-neutral-300 hover:bg-[#1f1f1f] hover:text-white transition-colors text-left"
                    onclick="Dashboard.closeContextMenu(); TambahModal.open(${pc.sesi_detail.id}, '${pc.grup}')">
                <svg class="w-3.5 h-3.5 text-neutral-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>Tambah Waktu</span>
            </button>` : ''}

            ${hasSesi ? `
            <button class="ctx-item w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-neutral-300 hover:bg-[#1f1f1f] hover:text-white transition-colors text-left font-mono"
                    onclick="Dashboard.closeContextMenu(); ${pc.sesi_detail.tipe === 'guest' ? `Dashboard.showGuestRefundModal(${pc.sesi_detail.id})` : `Dashboard.showMemberRefundModal(${pc.sesi_detail.member_id})`}">
                <svg class="w-3.5 h-3.5 text-neutral-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z"/>
                </svg>
                <span>Refund Paket</span>
            </button>` : ''}

            ${hasSesi ? `
            <button class="ctx-item w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors text-left"
                    onclick="Dashboard.closeContextMenu(); Dashboard.tutupSesi(${pc.sesi_detail.id})">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
                <span>Tutup Sesi</span>
            </button>` : ''}

            ${hasSesi ? `
            <button class="ctx-item w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-neutral-300 hover:bg-[#1f1f1f] hover:text-white transition-colors text-left"
                    onclick="Dashboard.closeContextMenu(); Dashboard.pindahSesi(${pc.sesi_detail.id}, '${pc.sesi_detail.tipe}', '${pc.grup}')">
                <svg class="w-3.5 h-3.5 text-neutral-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                </svg>
                <span>Pindah PC</span>
            </button>` : ''}

            <div class="border-t border-[#222] my-1"></div>

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

        document.body.appendChild(menu);
        const mw = menu.offsetWidth || 210;
        const mh = menu.offsetHeight || 220;
        let x = event.clientX;
        let y = event.clientY;
        if (x + mw > window.innerWidth) x = window.innerWidth - mw - 8;
        if (y + mh > window.innerHeight) y = window.innerHeight - mh - 8;
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        if (this._ctxOutsideHandler) {
            document.removeEventListener('click', this._ctxOutsideHandler);
        }
        if (this._ctxKeydownHandler) {
            document.removeEventListener('keydown', this._ctxKeydownHandler);
        }
        this._ctxOutsideHandler = (e) => {
            if (!document.getElementById('pc-context-menu')?.contains(e.target)) {
                this.closeContextMenu();
            }
        };
        this._ctxKeydownHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeContextMenu();
            }
        };
        setTimeout(() => {
            document.addEventListener('click', this._ctxOutsideHandler);
            document.addEventListener('keydown', this._ctxKeydownHandler);
        }, 0);
    },

    closeContextMenu() {
        const el = document.getElementById('pc-context-menu');
        if (el) el.remove();
        if (this._ctxOutsideHandler) {
            document.removeEventListener('click', this._ctxOutsideHandler);
            this._ctxOutsideHandler = null;
        }
        if (this._ctxKeydownHandler) {
            document.removeEventListener('keydown', this._ctxKeydownHandler);
            this._ctxKeydownHandler = null;
        }
    },

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
    },

    _render(data) {
        const container = document.getElementById('pc-area');
        const mapContainer = document.getElementById('map-view-container');
        if (mapContainer) mapContainer.classList.add('hidden');
        if (container) container.classList.remove('hidden');
        this.render(data);
        this.renderTabs(data);
        this.updateStats();
    },

    openPcModal(pcId, kode) {
        this.showDetail(pcId);
    },

    async tambahWaktuMember() {
        let groups = [];
        try {
            const [memberData, grupData] = await Promise.all([
                API.member.list({ per_page: 9999 }),
                API.grup.list()
            ]);
            this._searchMembers = memberData.members || [];
            groups = grupData.grup || grupData || [];
        } catch (_) {
            this._searchMembers = [];
        }

        if (this._searchMembers.length === 0) {
            return Toast.error('Tidak ada member terdaftar');
        }

        this._searchFiltered = [...this._searchMembers];
        this._searchPage = 1;
        this._searchPerPage = 8;
        this._selectedGrup = '';

        const grupOptions = groups.map(g => `<option value="${g.nama.toLowerCase()}">${g.nama.toUpperCase()}</option>`).join('');

        const html = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-2xl p-4 sm:p-6 md:p-7 max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl w-[95vw] sm:w-[calc(100%-2rem)] md:w-full h-[88vh] max-h-[760px] flex flex-col my-auto shadow-2xl relative overflow-hidden">
                <!-- Header (Fixed) -->
                <div class="flex items-center justify-between mb-4 pb-3.5 border-b border-[#2a2a2a] shrink-0">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center shrink-0 shadow-inner">
                            <svg class="w-5 h-5 text-neutral-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                        </div>
                        <div>
                            <h3 class="text-sm sm:text-base md:text-lg font-bold text-neutral-100 uppercase tracking-wider font-mono">Tambah Waktu Member</h3>
                            <p class="text-[11px] sm:text-xs text-neutral-400 mt-0.5">Cari member, lalu pilih paket billing</p>
                        </div>
                    </div>
                    <button onclick="Modal.closeModal()" class="w-9 h-9 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 hover:text-neutral-100 hover:bg-[#222] transition-colors flex items-center justify-center text-xl leading-none">&times;</button>
                </div>

                <!-- Search & Filters (Fixed) -->
                <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 mb-3.5 shrink-0">
                    <div class="sm:col-span-8">
                        <label class="text-[11px] sm:text-xs text-neutral-400 font-bold uppercase tracking-wider mb-1.5 block">Cari Member</label>
                        <div class="relative">
                            <input type="text" id="member-search-input-dash" placeholder="Ketik nama atau username..."
                                class="w-full pl-9 pr-4 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-xs sm:text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 font-bold transition-all"
                                oninput="Dashboard._handleMemberSearchInput()">
                            <svg class="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        </div>
                    </div>
                    <div class="sm:col-span-4">
                        <label class="text-[11px] sm:text-xs text-neutral-400 font-bold uppercase tracking-wider mb-1.5 block">Filter Zona / Grup</label>
                        <select id="member-search-grup-dash" onchange="Dashboard._handleGrupFilterChange()"
                            class="w-full px-3.5 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-xs sm:text-sm text-neutral-200 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 font-bold transition-all">
                            <option value="">Semua Grup</option>
                            ${grupOptions}
                        </select>
                    </div>
                </div>

                <!-- Member List Section (Scrollable) -->
                <div class="flex-1 min-h-0 flex flex-col">
                    <div class="flex items-center justify-between mb-2 shrink-0">
                        <label class="text-[11px] sm:text-xs md:text-sm text-neutral-400 font-bold uppercase tracking-wider font-mono">Pilih Member</label>
                        <span id="member-search-count-badge" class="text-[10px] sm:text-xs text-neutral-500 font-mono font-medium">${this._searchPerPage} Member per Halaman</span>
                    </div>
                    <div id="member-search-results" class="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1.5 scrollbar-thin">
                        <div class="flex justify-center py-12">
                            <div class="w-6 h-6 border-2 border-[#2a2a2a] border-t-neutral-100 rounded-full animate-spin"></div>
                        </div>
                    </div>
                </div>

                <!-- Footer: Pagination & Batal (Fixed at bottom) -->
                <div class="shrink-0 mt-3 pt-3 border-t border-[#2a2a2a]">
                    <div id="member-search-pagination" class="flex items-center justify-between min-h-[34px]">
                    </div>
                    <div class="flex justify-end mt-2.5">
                        <button onclick="Modal.closeModal()" class="px-5 py-2 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 hover:text-neutral-200 text-xs sm:text-sm font-bold rounded-xl transition-colors">Batal</button>
                    </div>
                </div>
            </div>`;

        Modal.show(html);
        this._renderMemberSearch();
    },

    _handleGrupFilterChange() {
        const select = document.getElementById('member-search-grup-dash');
        this._selectedGrup = select ? select.value : '';
        this._applyFilters();
    },

    _applyFilters() {
        let filtered = [...this._searchMembers];

        if (this._selectedGrup) {
            filtered = filtered.filter(m => {
                const grupName = (typeof m.grup === 'object' ? (m.grup.nama || '').toLowerCase() : (m.grup || '').toLowerCase());
                const selected = (this._selectedGrup || '').toLowerCase();
                return grupName === selected;
            });
        }

        const query = document.getElementById('member-search-input-dash')?.value?.toLowerCase().trim() || '';
        if (query) {
            filtered = filtered.filter(m => {
                const username = (m.username || '').toLowerCase();
                const nama = (m.nama_lengkap || '').toLowerCase();
                return username.includes(query) || nama.includes(query);
            });
        }

        this._searchFiltered = filtered;
        this._searchPage = 1;
        this._renderMemberSearch();
    },

    _handleMemberSearchInput() {
        clearTimeout(this._searchDebounceTimer);
        this._searchDebounceTimer = setTimeout(() => {
            this._applyFilters();
        }, 500);
    },

    _renderMemberSearch() {
        const container = document.getElementById('member-search-results');
        if (!container) return;

        const total = this._searchFiltered.length;
        const totalPages = Math.max(1, Math.ceil(total / this._searchPerPage));
        const start = (this._searchPage - 1) * this._searchPerPage;
        const pageData = this._searchFiltered.slice(start, start + this._searchPerPage);

        const countBadge = document.getElementById('member-search-count-badge');
        if (countBadge) {
            countBadge.innerText = `${total} Member Ditemukan (${this._searchPerPage} per Halaman)`;
        }

        if (total === 0) {
            container.innerHTML = '<div class="flex justify-center py-12 text-neutral-500 text-xs sm:text-sm font-bold uppercase tracking-wider">Member tidak ditemukan</div>';
            this._renderMemberPagination(1, 0);
            return;
        }

        container.innerHTML = pageData.map(m => {
            const sisa = Utils.formatDurasiFriendly(m.waktu_saved || m.waktu_tersimpan);
            const grupNama = (typeof m.grup === 'object' ? (m.grup.nama || 'Reguler') : (m.grup || 'Reguler'));
            const grupWarna = m.grup_warna || '#737373';
            return `
                <div onclick="Dashboard._pilihMember(${m.id})"
                    class="flex items-center justify-between p-3.5 sm:p-4 bg-[#141414] hover:bg-[#181818] border border-[#2a2a2a] hover:border-neutral-500 rounded-xl cursor-pointer transition-all gap-3 sm:gap-4 select-none group">
                    <div class="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
                        <div class="w-10 h-10 rounded-xl bg-[#0a0a0a] border border-[#2a2a2a] group-hover:border-neutral-500 flex items-center justify-center text-neutral-200 font-bold text-xs sm:text-sm font-mono shrink-0 shadow-inner transition-colors">
                            ${(m.username || '?').charAt(0).toUpperCase()}
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                                <span class="font-bold text-xs sm:text-sm md:text-base text-neutral-100 font-mono truncate">${m.username}</span>
                                <span class="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold uppercase style-grup-badge shrink-0" style="border: 1px solid ${grupWarna}30; color: ${grupWarna}; background-color: ${grupWarna}15;">${grupNama}</span>
                            </div>
                            <div class="text-[11px] sm:text-xs text-neutral-400 truncate mt-0.5">${m.nama_lengkap || '-'}</div>
                        </div>
                    </div>
                    <div class="text-right shrink-0 ml-2">
                        <div class="text-[10px] sm:text-xs text-neutral-500 font-mono uppercase font-bold tracking-wider">Sisa Waktu</div>
                        <div class="text-xs sm:text-sm md:text-base font-bold text-emerald-400 font-mono mt-0.5">${sisa}</div>
                    </div>
                </div>
            `;
        }).join('');

        this._renderMemberPagination(this._searchPage, totalPages);
    },

    _renderMemberPagination(currentPage, totalPages) {
        const container = document.getElementById('member-search-pagination');
        if (!container) return;

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <span class="text-[11px] sm:text-xs text-neutral-500 font-mono">Halaman ${currentPage} dari ${totalPages}</span>
            <div class="flex gap-2">
                <button onclick="Dashboard._searchPage = ${Math.max(1, currentPage - 1)}; Dashboard._renderMemberSearch()"
                    class="px-3.5 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-300 text-xs font-bold rounded-lg transition-colors ${currentPage <= 1 ? 'opacity-30 cursor-not-allowed' : ''}"
                    ${currentPage <= 1 ? 'disabled' : ''}>
                    &larr; Sebelum
                </button>
                <button onclick="Dashboard._searchPage = ${Math.min(totalPages, currentPage + 1)}; Dashboard._renderMemberSearch()"
                    class="px-3.5 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-300 text-xs font-bold rounded-lg transition-colors ${currentPage >= totalPages ? 'opacity-30 cursor-not-allowed' : ''}"
                    ${currentPage >= totalPages ? 'disabled' : ''}>
                    Selanjutnya &rarr;
                </button>
            </div>`;
    },

    _pilihMember(memberId) {
        Modal.closeModal();
        if (typeof MemberRefill !== 'undefined' && MemberRefill.tambahWaktu) {
            MemberRefill.tambahWaktu(memberId);
        } else {
            Toast.error('Gagal: modul refill belum siap');
        }
    },

    updateHeaderOmzet(billing, kantin, total) {
        const billingEl = document.getElementById('header-omzet-billing');
        const kantinEl = document.getElementById('header-omzet-kantin');
        const totalEl = document.getElementById('header-omzet-value');

        const billingMobileEl = document.getElementById('dashboard-omzet-billing-mobile');
        const kantinMobileEl = document.getElementById('dashboard-omzet-kantin-mobile');
        
        const format = (val) => typeof Utils !== 'undefined' && Utils.formatRupiah ? Utils.formatRupiah(val || 0) : `Rp ${Number(val || 0).toLocaleString('id-ID')}`;

        const formattedBilling = format(billing);
        const formattedKantin = format(kantin);
        const formattedTotal = format(total !== undefined ? total : (Number(billing || 0) + Number(kantin || 0)));

        if (billingEl) billingEl.innerText = formattedBilling;
        if (kantinEl) kantinEl.innerText = formattedKantin;
        if (totalEl) totalEl.innerText = formattedTotal;

        if (billingMobileEl) billingMobileEl.innerText = formattedBilling;
        if (kantinMobileEl) kantinMobileEl.innerText = formattedKantin;
    }
};

Object.assign(Dashboard, CompactGrid);
window.Dashboard = Dashboard;
