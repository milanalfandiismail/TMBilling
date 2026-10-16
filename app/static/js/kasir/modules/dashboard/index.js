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

    async load(isSilent = false) {
        const container = document.getElementById('pc-area');
        if (!this.lastData && !isSilent && container && !document.querySelector('.pc-card-item') && typeof Skeleton !== 'undefined') {
            container.innerHTML = Skeleton.pcCards(12);
        }
        try {
            const data = await API.dashboard.pcList();
            if (!data || !data.by_grup) throw new Error('Data format invalid - missing by_grup');
            const oldData = this.lastData;
            this.lastData = data; // Set dulu sebelum render agar renderCompactCard() bisa akses grup_meta saat render pertama
            this._render(data, false, oldData);
            this.updateTime();
            if (data.omzet_billing !== undefined || data.omzet_kantin !== undefined || data.omzet_hari_ini !== undefined) {
                this.updateHeaderOmzet(data.omzet_billing, data.omzet_kantin, data.omzet_hari_ini);
            }
        } catch (err) {
            console.error('[Dashboard] Error:', err);
            if (container && !this.lastData) {
                container.innerHTML = `<div class="text-center py-20 text-red-400 text-sm">Gagal memuat dashboard: ${err.message}<br><button onclick="Dashboard.load()" class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs lg:text-base font-semibold">Coba Lagi</button></div>`;
            }
        }
    },

    setGrup(grupKey) {
        this.activeGrup = grupKey;
        if (this.lastData) {
            this._render(this.lastData, true);
        }
    },

    showDetail(pcId) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        this._currentPcId = pcId;
        DashboardDetailModal.showDetail(pcId, this.lastData);
    },

    takeScreenshot(pcId) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        DashboardDetailModal.takeScreenshot(pcId);
    },

    remoteAction(pcId, action, pcKode = '') {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        DashboardDetailModal.remoteAction(pcId, action, pcKode);
    },

    viewFullscreen(imgEl) {
        DashboardDetailModal.viewFullscreen(imgEl);
    },

    showProcesses() {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        DashboardProcessMonitor.showProcesses(this._currentPcId);
    },

    backToMenu() {
        DashboardProcessMonitor.backToMenu();
    },

    loadProcesses(pcId) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        DashboardProcessMonitor.loadProcesses(pcId);
    },

    killProcess(pcId, name) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        DashboardProcessMonitor.killProcess(pcId, name);
    },

    async tutupSesi(sesiId) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
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


    async pindahPc(sesiId, tipe, pcGrup) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
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
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
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

    async clearSesiSystem(pcId, sesiId = null) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        Modal.confirm(`
            <div class="text-center">
                <p class="text-xs lg:text-base text-indigo-400 font-bold uppercase tracking-wider">Clear Sesi System?</p>
                <p class="text-[10px] lg:text-base text-neutral-400 mt-1">Sesi system darurat pada PC ini akan dibersihkan dan PC dikembalikan ke mode Kiosk (Terkunci).</p>
            </div>
        `, async () => {
            try {
                if (sesiId) {
                    await API.sesi.tutup(sesiId);
                }
                const res = await API.request(`/api/v1/kasir/pc/reset-admin/${pcId}`, {
                    method: 'POST'
                });
                if (res && res.error) throw new Error(res.error);
                Toast.success('Sesi system berhasil dibersihkan & PC dikunci');
                this.load();
            } catch (err) {
                Toast.error(err.message || 'Gagal membersihkan sesi system');
            }
        });
    },


    async wolSingle(pcId) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
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

    _hasStructureChanged(oldData, newData) {
        if (!oldData || !newData) return true;
        if (!oldData.pc_list || !newData.pc_list) return true;
        if (oldData.pc_list.length !== newData.pc_list.length) return true;

        const oldGroups = Array.isArray(oldData.by_grup)
            ? oldData.by_grup.slice().sort().join(',')
            : Object.keys(oldData.by_grup || {}).sort().join(',');
        const newGroups = Array.isArray(newData.by_grup)
            ? newData.by_grup.slice().sort().join(',')
            : Object.keys(newData.by_grup || {}).sort().join(',');
        if (oldGroups !== newGroups) return true;

        const oldMap = {};
        oldData.pc_list.forEach(p => { if (p && p.id != null) oldMap[p.id] = p; });

        for (let i = 0; i < newData.pc_list.length; i++) {
            const newPc = newData.pc_list[i];
            const oldPc = oldMap[newPc.id];
            if (!oldPc || oldPc.grup !== newPc.grup || oldPc.pos_x !== newPc.pos_x || oldPc.pos_y !== newPc.pos_y) {
                return true;
            }
        }
        return false;
    },

    _render(data, forceFull = false, previousData = null) {
        const container = document.getElementById('pc-area');
        const mapContainer = document.getElementById('map-view-container');
        if (mapContainer) mapContainer.classList.add('hidden');
        if (container) container.classList.remove('hidden');

        const prev = previousData || this._prevRenderedData || this.lastData;
        const hasRenderedCards = Boolean(document.querySelector('.pc-card-item'));
        const structureChanged = forceFull || !hasRenderedCards || this._hasStructureChanged(prev, data);

        if (structureChanged) {
            this.render(data);
            this.renderTabs(data);
            // Segera sync border color setelah full re-render agar warna grup tampil langsung tanpa jeda
            if (typeof this.syncLiveCards === 'function') {
                this.syncLiveCards(data);
            }
        } else if (typeof this.syncLiveCards === 'function') {
            this.syncLiveCards(data);
        }

        this._prevRenderedData = JSON.parse(JSON.stringify({
            pc_list: data.pc_list ? data.pc_list.map(p => ({ id: p.id, grup: p.grup, pos_x: p.pos_x, pos_y: p.pos_y })) : [],
            by_grup: data.by_grup ? Object.keys(data.by_grup) : []
        }));

        this.updateStats();

        // Live In-Place Sync ke modal detail PC dan modal tambah waktu jika sedang terbuka
        if (typeof DashboardDetailModal !== 'undefined' && DashboardDetailModal.syncLive) {
            DashboardDetailModal.syncLive(data.pc_list);
        }
        if (typeof TambahModal !== 'undefined' && TambahModal.syncLive) {
            TambahModal.syncLive(data.pc_list);
        }
    },

    openPcModal(pcId, kode) {
        this.showDetail(pcId);
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
    },

    showSettingsModal() {
        const nicDropEnabled = localStorage.getItem('dashboard_nic_drop_detection') !== 'false';
        const currentInterval = this.getRefreshInterval();

        const pollButtons = [
            { ms: 1000, label: '⚡ 1 Detik', sub: '(Realtime)', subClass: 'text-emerald-400' },
            { ms: 2000, label: '🚀 2 Detik', sub: 'Cepat', subClass: 'text-neutral-500' },
            { ms: 3000, label: '⏱️ 3 Detik', sub: 'Sedang', subClass: 'text-neutral-500' },
            { ms: 5000, label: '🐢 5 Detik', sub: 'Santai', subClass: 'text-neutral-500' }
        ].map(item => {
            const isActive = item.ms === currentInterval;
            const activeClasses = isActive
                ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300 shadow-md shadow-emerald-950/20"
                : "border-[#1c1c1c] bg-[#141414] text-neutral-400 hover:border-neutral-500";
            return `
                <button type="button" onclick="Dashboard.setPollingInterval(${item.ms})" id="btn-poll-${item.ms}"
                    class="px-3 sm:px-3.5 py-2.5 sm:py-3 rounded border text-xs sm:text-sm lg:max-xl:text-xs xl:text-base font-semibold transition-all text-center flex flex-col items-center justify-center gap-0.5 ${activeClasses}">
                    <span class="font-bold">${item.label}</span>
                    <span class="text-[9px] sm:text-[11px] ${item.subClass} font-mono font-normal">${item.sub}</span>
                </button>
            `;
        }).join('');

        const html = `
            <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-5 sm:p-6 md:p-7 max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl 2xl:max-w-3xl w-[95vw] sm:w-[calc(100%-2rem)] md:w-full shadow-2xl relative flex flex-col my-auto space-y-4 sm:space-y-5 lg:space-y-6 animate-in">
                <!-- Header (Fixed) -->
                <div class="flex items-center justify-between pb-3.5 sm:pb-4 lg:pb-5 border-b border-[#1c1c1c] shrink-0">
                    <div class="flex items-center gap-3 sm:gap-3.5">
                        <div class="w-10 h-10 sm:w-11 sm:h-11 lg:w-12 lg:h-12 rounded bg-[#171717] border border-[#262626] flex items-center justify-center shrink-0">
                            <svg class="w-5 h-5 sm:w-6 sm:h-6 text-neutral-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-xs lg:max-xl:text-lg xl:text-[22px] font-bold text-neutral-200 uppercase tracking-wider">Pengaturan Dashboard</h3>
                            <p class="text-[9px] lg:max-xl:text-xs xl:text-base text-neutral-500 mt-0.5">Konfigurasi visual, alert hardware, dan interval update</p>
                        </div>
                    </div>
                    <button onclick="Modal.closeModal()"
                        class="text-neutral-500 hover:text-neutral-300 transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>

                <!-- Body Options -->
                <div class="space-y-3.5 sm:space-y-4 lg:space-y-5">
                    <!-- Opsi 1: Deteksi LAN Drop -->
                    <div class="p-3.5 sm:p-4 lg:p-5 bg-[#050505] border border-[#1c1c1c] rounded space-y-2 sm:space-y-2.5">
                        <div class="flex items-center justify-between">
                            <label for="setting-nic-drop-toggle" class="font-bold text-neutral-200 cursor-pointer flex items-center gap-2 select-none text-xs sm:text-sm lg:max-xl:text-xs xl:text-base uppercase tracking-wider">
                                <span>🌐</span> Deteksi LAN Drop (&lt; 1 Gbps)
                            </label>
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" id="setting-nic-drop-toggle" class="sr-only peer" ${nicDropEnabled ? 'checked' : ''} onchange="Dashboard.toggleNicDropDetection(this.checked)">
                                <div class="w-10 h-5 sm:w-11 sm:h-6 bg-[#171717] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-black after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-100 after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-neutral-100 peer-checked:after:bg-black"></div>
                            </label>
                        </div>
                        <p class="text-[9px] lg:max-xl:text-xs xl:text-base text-neutral-500 leading-relaxed">
                            Menampilkan badge peringatan kuning/merah jika kecepatan LAN turun ke 100 Mbps / 10 Mbps. Matikan opsi ini jika warnet Anda menggunakan kabel Cat 5 atau switch 100 Mbps.
                        </p>
                    </div>

                    <!-- Opsi 2: Interval Polling -->
                    <div class="p-3.5 sm:p-4 lg:p-5 bg-[#050505] border border-[#1c1c1c] rounded space-y-2 sm:space-y-2.5">
                        <label class="block font-bold text-neutral-200 select-none flex items-center gap-2 text-xs sm:text-sm lg:max-xl:text-xs xl:text-base uppercase tracking-wider">
                            <span>⏱️</span> Interval Refresh Real-time
                        </label>
                        <p class="text-[9px] lg:max-xl:text-xs xl:text-base text-neutral-500 leading-relaxed mb-2">
                            Frekuensi update serentak data PC, status shift kasir, dan omzet di layar kasir.
                        </p>
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                            ${pollButtons}
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="flex justify-end pt-3 sm:pt-4 border-t border-[#1c1c1c]">
                    <button onclick="Modal.closeModal()"
                        class="px-4 lg:max-xl:px-5 xl:px-6 py-2 lg:max-xl:py-2.5 xl:py-2.5 bg-neutral-100 hover:bg-neutral-200 text-black text-xs lg:max-xl:text-xs xl:text-base font-bold rounded transition-colors uppercase tracking-wider">
                        Selesai
                    </button>
                </div>
            </div>
        `;

        if (typeof Modal !== 'undefined' && Modal.show) {
            Modal.show(html, null, { disableBackdropClose: false });
        }
    },

    closeSettingsModal() {
        if (typeof Modal !== 'undefined' && Modal.closeModal) {
            Modal.closeModal();
        }
    },

    toggleNicDropDetection(enabled) {
        localStorage.setItem('dashboard_nic_drop_detection', enabled ? 'true' : 'false');
        if (this.lastData) {
            this._render(this.lastData);
        }
        if (typeof Toast !== 'undefined') {
            Toast.success(enabled ? 'Deteksi LAN Drop diaktifkan' : 'Deteksi LAN Drop dinonaktifkan');
        }
    },

    getRefreshInterval() {
        try {
            const val = parseInt(localStorage.getItem('dashboard_refresh_interval'), 10);
            return (!isNaN(val) && val >= 1000) ? val : 1000;
        } catch (e) {
            return 1000;
        }
    },

    setPollingInterval(intervalMs) {
        try {
            localStorage.setItem('dashboard_refresh_interval', String(intervalMs));
        } catch (e) {
            console.error('[Dashboard] Error saving interval:', e);
        }
        this._updatePollingButtonUI(intervalMs);
        if (typeof App !== 'undefined' && App.restartDashboardPolling) {
            App.restartDashboardPolling();
        }
        if (typeof Toast !== 'undefined') {
            Toast.success(`Interval dashboard diset ke ${intervalMs / 1000} detik`);
        }
    },

    _updatePollingButtonUI(activeMs) {
        [1000, 2000, 3000, 5000].forEach(ms => {
            const btn = document.getElementById(`btn-poll-${ms}`);
            if (btn) {
                if (ms === activeMs) {
                    btn.className = "px-3 sm:px-3.5 py-2.5 sm:py-3 rounded border text-xs sm:text-sm lg:max-xl:text-xs xl:text-base font-semibold transition-all text-center flex flex-col items-center justify-center gap-0.5 border-emerald-500/60 bg-emerald-500/10 text-emerald-300 shadow-md shadow-emerald-950/20";
                } else {
                    btn.className = "px-3 sm:px-3.5 py-2.5 sm:py-3 rounded border text-xs sm:text-sm lg:max-xl:text-xs xl:text-base font-semibold transition-all text-center flex flex-col items-center justify-center gap-0.5 border-[#1c1c1c] bg-[#141414] text-neutral-400 hover:border-neutral-500";
                }
            }
        });
    }
};

Object.assign(Dashboard, CompactGrid);
window.Dashboard = Dashboard;
