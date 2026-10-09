/**
 * Overlay Module
 * Handles overlay mode logic: timer display, logout, minimize
 */

import { AppState } from '../shared/state.js';
import { Api } from '../shared/api.js';
import { UI } from '../shared/ui.js';
import { formatTime } from '../shared/utils.js';
import {
    AUDIO_WARNING_15MIN_PATH,
    AUDIO_WARNING_5MIN_PATH,
    AUDIO_WARNING_1MIN_PATH,
    AUDIO_TARGET_SYSTEM_VOLUME,
    AUDIO_PLAYBACK_VOLUME,
    TIME_THRESHOLD_15MIN,
    TIME_THRESHOLD_5MIN,
    TIME_THRESHOLD_1MIN,
    STATUS
} from '../shared/constants.js';

export const Overlay = {
    /**
     * Initialize overlay mode
     */
    init() {
        this.bindEvents();
        this.renderQris();
    },

    /**
     * Bind overlay-specific events
     */
    bindEvents() {
        // Logout button
        document.getElementById('logout-btn')?.addEventListener('click', () => this.handleLogout());

        // Minimize button
        document.getElementById('minimize-btn')?.addEventListener('click', () => Api.minimize());

        // Logout confirmation modal
        document.getElementById('logout-cancel-btn')?.addEventListener('click', () => UI.toggleLogoutModal(false));
        document.getElementById('logout-confirm-btn')?.addEventListener('click', () => this.confirmLogout());

        // Control Panel Properties toolbar buttons
        document.getElementById('btn-prop-mouse')?.addEventListener('click', () => Api.openControlPanel('mouse'));
        document.getElementById('btn-prop-keyboard')?.addEventListener('click', () => Api.openControlPanel('keyboard'));
        document.getElementById('btn-prop-sound')?.addEventListener('click', () => Api.openControlPanel('sound'));
        document.getElementById('btn-prop-volume')?.addEventListener('click', () => Api.openControlPanel('volume'));
        document.getElementById('btn-prop-display')?.addEventListener('click', () => Api.openControlPanel('display'));

        // Modal Menu & Paket
        document.getElementById('btn-prop-menu-paket')?.addEventListener('click', () => this.openMenuPaketModal());
        document.getElementById('btn-close-menu-paket')?.addEventListener('click', () => this.closeMenuPaketModal());
        document.getElementById('btn-close-menu-esc')?.addEventListener('click', () => this.closeMenuPaketModal());
        document.getElementById('tab-btn-paket')?.addEventListener('click', () => this.switchMenuPaketTab('paket'));
        document.getElementById('tab-btn-menu')?.addEventListener('click', () => this.switchMenuPaketTab('menu'));

        // Modal QRIS Fullscreen HD
        document.getElementById('overlay-qris-card')?.addEventListener('click', () => this.openQrisFullscreen());
        document.getElementById('btn-expand-qris')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openQrisFullscreen();
        });
        document.getElementById('btn-close-qris-fullscreen')?.addEventListener('click', () => this.closeQrisFullscreen());
        document.getElementById('btn-close-qris-esc')?.addEventListener('click', () => this.closeQrisFullscreen());

        // Global Escape Key Listener for Modals
        if (!this._globalModalEventsBound) {
            window.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    const qrisModal = document.getElementById('modal-qris-fullscreen');
                    const menuModal = document.getElementById('modal-menu-paket');
                    if (qrisModal && !qrisModal.classList.contains('hidden')) {
                        this.closeQrisFullscreen();
                    } else if (menuModal && !menuModal.classList.contains('hidden')) {
                        this.closeMenuPaketModal();
                    }
                }
            });
            this._globalModalEventsBound = true;
        }

        // AFK Lock button & PIN modal
        document.getElementById('btn-lock-afk')?.addEventListener('click', () => this.handleLockAfk());
        document.getElementById('afk-pin-cancel-btn')?.addEventListener('click', () => UI.toggleAfkPinModal(false));
        document.getElementById('afk-pin-confirm-btn')?.addEventListener('click', () => this.confirmAfkPinLock());
        document.getElementById('afk-pin-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.confirmAfkPinLock();
            if (e.key === 'Escape') UI.toggleAfkPinModal(false);
        });
    },

    /**
     * Render QRIS image from configuration
     */
    async renderQris() {
        const qrisImg = document.getElementById('overlay-qris-img');
        const modalQrisImg = document.getElementById('overlay-qris-modal-img');
        const fallbackEl = document.getElementById('overlay-qris-fallback');
        if (!qrisImg) return;

        let qrisUrl = AppState.warnetConfig?.qris_url || AppState.warnetConfig?.qrisUrl;

        // If not yet available in AppState, fetch from API
        if (!qrisUrl) {
            try {
                const config = await Api.getWarnetConfig();
                if (config) {
                    AppState.setWarnetConfig(config);
                    qrisUrl = config.qris_url;
                }
            } catch (err) {
                console.warn("Gagal memuat konfigurasi QRIS overlay:", err);
            }
        }

        if (qrisUrl) {
            qrisImg.src = qrisUrl;
            qrisImg.classList.remove('hidden');
            if (modalQrisImg) modalQrisImg.src = qrisUrl;
            if (fallbackEl) fallbackEl.classList.add('hidden');
        } else {
            qrisImg.classList.add('hidden');
            if (modalQrisImg) modalQrisImg.src = '';
            if (fallbackEl) fallbackEl.classList.remove('hidden');
        }
    },

    /**
     * Handle logout button click
     */
    async handleLogout(isForced = false) {
        if (isForced) {
            await this.confirmLogout();
        } else {
            UI.toggleLogoutModal(true);
        }
    },

    /**
     * Handle AFK lock button click
     */
    async handleLockAfk() {
        if (AppState.sessionType === 'member') {
            try {
                await Api.afkLock(null);
                AppState.isAfk = true;
                UI.showScreen('afk-screen');
                await Api.switchToAfk();
            } catch (err) {
                console.error("Gagal Kunci Meja (Member):", err);
                UI.showToast(err || "Gagal mengunci meja", "error");
            }
        } else {
            UI.toggleAfkPinModal(true);
        }
    },

    /**
     * Confirm AFK lock with Guest PIN
     */
    async confirmAfkPinLock() {
        const pinInput = document.getElementById('afk-pin-input');
        const pin = (pinInput?.value || '').trim();
        if (!pin) {
            UI.showAfkPinError("PIN / Password tidak boleh kosong!");
            return;
        }

        try {
            await Api.afkLock(pin);
            AppState.isAfk = true;
            UI.toggleAfkPinModal(false);
            UI.showScreen('afk-screen');
            await Api.switchToAfk();
        } catch (err) {
            console.error("Gagal Kunci Meja (Guest PIN):", err);
            UI.showAfkPinError(err || "Gagal mengunci meja");
        }
    },

    /**
     * Confirm and execute logout
     */
    async confirmLogout() {
        UI.toggleLogoutModal(false);

        try {
            await Api.logout();
            this.resetState();
            UI.showScreen('login-screen');

            // Reset inputs
            document.getElementById('username').value = "";
            document.getElementById('password').value = "";

            // Switch to kiosk mode
            await Api.switchToKiosk();
        } catch (err) {
            console.error("Gagal Logout:", err);
            this.resetState();
            UI.showScreen('login-screen');
            await Api.switchToKiosk();
        }
    },

    /**
     * Reset overlay state
     */
    resetState() {
        AppState.resetSession();
        AppState.resetShutdownTimer();
        UI.resetOverlayUI();
        Api.setOverlayModalFullscreen(false);
    },

    /**
     * Update timer display & trigger warning alerts
     */
    updateTime(seconds) {
        UI.updateTime(seconds);

        if (!AppState.isOverlayActive || AppState.currentStatus === STATUS.ADMIN) {
            return;
        }

        // 1. Tangani Penambahan Waktu / Top-Up Billing (Reset flag jika sisa waktu bertambah)
        if (seconds > TIME_THRESHOLD_15MIN) {
            AppState.hasPlayed15MinAlert = false;
            AppState.hasPlayed5MinAlert = false;
            AppState.hasPlayed1MinAlert = false;
        } else if (seconds > TIME_THRESHOLD_5MIN) {
            AppState.hasPlayed5MinAlert = false;
            AppState.hasPlayed1MinAlert = false;
        } else if (seconds > TIME_THRESHOLD_1MIN) {
            AppState.hasPlayed1MinAlert = false;
        }

        // 2. Trigger Warning Audio Alerts (15 Menit, 5 Menit, 1 Menit)
        if (seconds <= TIME_THRESHOLD_15MIN && seconds > TIME_THRESHOLD_5MIN && !AppState.hasPlayed15MinAlert) {
            AppState.hasPlayed15MinAlert = true;
            this.playWarningAudio('15min');
        } else if (seconds <= TIME_THRESHOLD_5MIN && seconds > TIME_THRESHOLD_1MIN && !AppState.hasPlayed5MinAlert) {
            AppState.hasPlayed5MinAlert = true;
            this.playWarningAudio('5min');
        } else if (seconds <= TIME_THRESHOLD_1MIN && seconds > 0 && !AppState.hasPlayed1MinAlert) {
            AppState.hasPlayed1MinAlert = true;
            this.playWarningAudio('1min');
        }

        // 3. Auto-lock when time runs out
        if (seconds <= 0) {
            console.log("Waktu habis! Mengunci PC...");
            this.handleLogout(true);
        }
    },

    /**
     * Play warning audio with temporary 100% Windows volume override and dynamic auto-restore
     */
    async playWarningAudio(type = '5min') {
        const audioCandidates = [
            `assets/sounds/warning_${type}.mp3`,
            `assets/sounds/warning_${type}.wav`
        ];

        let prevVolume = null;
        try {
            // 1. Naikkan volume master Windows ke 100% dan un-mute (simpan volume asal secara dinamis)
            prevVolume = await Api.setSystemVolume(AUDIO_TARGET_SYSTEM_VOLUME);
        } catch (e) {
            console.warn("Gagal set system volume override:", e);
        }

        let isRestored = false;
        const restoreVolumeOnce = async () => {
            if (isRestored) return;
            isRestored = true;
            if (prevVolume !== null && prevVolume !== undefined) {
                try {
                    await Api.restoreSystemVolume(prevVolume);
                } catch (err) {
                    console.warn("Gagal restore system volume:", err);
                }
            }
        };

        const tryPlayCandidate = (index) => {
            if (index >= audioCandidates.length) {
                console.warn(`Semua kandidat audio untuk warning_${type} gagal diputar.`);
                restoreVolumeOnce();
                return;
            }

            const audioPath = audioCandidates[index];
            const alertAudio = new Audio(audioPath);
            alertAudio.volume = AUDIO_PLAYBACK_VOLUME;

            alertAudio.addEventListener('ended', restoreVolumeOnce, { once: true });
            alertAudio.addEventListener('error', () => {
                tryPlayCandidate(index + 1);
            }, { once: true });

            alertAudio.play().catch(() => {
                tryPlayCandidate(index + 1);
            });
        };

        // Safety fallback timeout: jika audio terputus atau suspend, kembalikan volume setelah 8 detik
        setTimeout(restoreVolumeOnce, 8000);

        tryPlayCandidate(0);
    },

    /**
     * Start shutdown timer
     */
    startShutdownTimer(seconds) {
        if (AppState.shutdownInterval) return;

        AppState.shutdownRemaining = seconds;
        UI.updateShutdownTimer(AppState.shutdownRemaining);

        AppState.shutdownInterval = setInterval(async () => {
            AppState.shutdownRemaining--;
            UI.updateShutdownTimer(AppState.shutdownRemaining);

            if (AppState.shutdownRemaining <= 0) {
                clearInterval(AppState.shutdownInterval);
                AppState.shutdownInterval = null;
                console.log("BOOM! PC SHUTTING DOWN...");
                await Api.forceShutdown();
            }
        }, 1000);
    },

    /**
     * Stop shutdown timer
     */
    stopShutdownTimer() {
        AppState.resetShutdownTimer();
        UI.updateShutdownTimer(0);
    },

    /**
     * Buka modal Menu & Paket (Fullscreen Center Modal)
     */
    async openMenuPaketModal() {
        const modal = document.getElementById('modal-menu-paket');
        const mainCard = document.getElementById('overlay-main-card');
        if (!modal) return;

        // 1. Pastikan data paket & menu siap dan ter-render duluan agar tidak ada delay visual
        if (!AppState.allPackages?.length || !AppState.allMenus?.length) {
            try {
                const config = await Api.getWarnetConfig();
                if (config) {
                    AppState.allPackages = config.paket || [];
                    AppState.allMenus = config.menu || [];
                }
            } catch (err) {
                console.warn("Gagal memuat paket/menu warnet:", err);
            }
        }

        this.renderPaketList();
        this.renderMenuList();
        this.switchMenuPaketTab('paket');

        // 2. Sembunyikan floating card overlay sementara agar modal tampil bersih di tengah layar
        if (mainCard) mainCard.classList.add('hidden');
        modal.classList.remove('hidden');
        await Api.setOverlayModalFullscreen(true);
    },

    /**
     * Tutup modal Menu & Paket (Kembalikan ukuran overlay ke pojok kanan atas)
     */
    async closeMenuPaketModal() {
        const modal = document.getElementById('modal-menu-paket');
        const mainCard = document.getElementById('overlay-main-card');
        if (modal) modal.classList.add('hidden');
        if (mainCard) mainCard.classList.remove('hidden');
        await Api.setOverlayModalFullscreen(false);
    },

    /**
     * Buka modal QRIS Fullscreen HD (Tengah Layar Monitor)
     */
    async openQrisFullscreen() {
        const qrisModal = document.getElementById('modal-qris-fullscreen');
        const mainCard = document.getElementById('overlay-main-card');
        if (!qrisModal) return;

        // Sembunyikan floating card overlay sementara
        if (mainCard) mainCard.classList.add('hidden');
        qrisModal.classList.remove('hidden');
        await Api.setOverlayModalFullscreen(true);
    },

    /**
     * Tutup modal QRIS Fullscreen HD (Kembalikan ukuran overlay ke pojok kanan atas)
     */
    async closeQrisFullscreen() {
        const qrisModal = document.getElementById('modal-qris-fullscreen');
        const mainCard = document.getElementById('overlay-main-card');
        if (qrisModal) qrisModal.classList.add('hidden');
        if (mainCard) mainCard.classList.remove('hidden');
        await Api.setOverlayModalFullscreen(false);
    },

    /**
     * Ganti tab aktif di modal Menu & Paket
     */
    switchMenuPaketTab(tab) {
        const tabPaketBtn = document.getElementById('tab-btn-paket');
        const tabMenuBtn = document.getElementById('tab-btn-menu');
        const contentPaket = document.getElementById('tab-content-paket');
        const contentMenu = document.getElementById('tab-content-menu');

        const activeClasses = ['bg-white/10', 'text-white', 'shadow-sm', 'font-semibold'];
        const inactiveClasses = ['text-[#86868b]', 'font-medium'];

        if (tab === 'paket') {
            tabPaketBtn?.classList.remove(...inactiveClasses);
            tabPaketBtn?.classList.add(...activeClasses);
            tabMenuBtn?.classList.remove(...activeClasses);
            tabMenuBtn?.classList.add(...inactiveClasses);

            contentPaket?.classList.remove('hidden');
            contentMenu?.classList.add('hidden');
        } else {
            tabMenuBtn?.classList.remove(...inactiveClasses);
            tabMenuBtn?.classList.add(...activeClasses);
            tabPaketBtn?.classList.remove(...activeClasses);
            tabPaketBtn?.classList.add(...inactiveClasses);

            contentMenu?.classList.remove('hidden');
            contentPaket?.classList.add('hidden');
        }
    },

    /**
     * Render daftar paket billing (Dengan Filter Grup & Sorting grup_id Server Match)
     */
    renderPaketList() {
        const filterContainer = document.getElementById('overlay-paket-group-filters');
        const itemsContainer = document.getElementById('overlay-paket-items-container') || document.getElementById('tab-content-paket');
        if (!itemsContainer) return;

        const packages = AppState.allPackages || [];
        if (packages.length === 0) {
            if (filterContainer) filterContainer.innerHTML = '';
            itemsContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center py-16 text-[#6e6e73]">
                    <svg class="w-10 h-10 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p class="text-xs font-semibold">Tidak ada paket billing aktif saat ini</p>
                </div>
            `;
            return;
        }

        // 1. Sorting berdasarkan grup_id (Ascending), lalu harga (Ascending)
        const sortedPackages = [...packages].sort((a, b) => {
            const gA = Number(a.grup_id ?? 999);
            const gB = Number(b.grup_id ?? 999);
            if (gA !== gB) return gA - gB;
            return (Number(a.harga) || 0) - (Number(b.harga) || 0);
        });

        // 2. Ekstrak grup unik
        const uniqueGroups = ['SEMUA', ...new Set(sortedPackages.map(p => (p.grup || 'Reguler').toUpperCase()))];
        this._selectedOverlayGroup = this._selectedOverlayGroup || 'SEMUA';

        // 3. Render Group Filter Pills
        if (filterContainer) {
            filterContainer.innerHTML = uniqueGroups.map(g => {
                const isActive = (this._selectedOverlayGroup === g);
                const activeClass = "bg-white text-black font-semibold shadow-sm";
                const inactiveClass = "bg-white/[0.06] hover:bg-white/[0.10] text-[#86868b] hover:text-white border border-white/[0.08]";
                return `
                    <button type="button" data-group="${g}"
                        class="overlay-group-pill px-3 py-1 rounded-xl text-[11px] transition-all whitespace-nowrap cursor-pointer ${isActive ? activeClass : inactiveClass}">
                        ${g === 'SEMUA' ? 'Semua' : g}
                    </button>
                `;
            }).join('');

            // Bind click listeners to filter pills
            filterContainer.querySelectorAll('.overlay-group-pill').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const group = e.currentTarget.getAttribute('data-group');
                    this._selectedOverlayGroup = group;
                    this.renderPaketList();
                });
            });
        }

        // 4. Filter daftar paket
        const filtered = (this._selectedOverlayGroup === 'SEMUA')
            ? sortedPackages
            : sortedPackages.filter(p => (p.grup || 'Reguler').toUpperCase() === this._selectedOverlayGroup);

        const formatDuration = (menit) => {
            if (!menit) return '-';
            if (menit >= 60) {
                const jam = menit / 60;
                return jam % 1 === 0 ? `${jam} Jam` : `${jam.toFixed(1)} Jam`;
            }
            return `${menit} Menit`;
        };

        const formatRupiah = (val) => {
            return `Rp ${Number(val || 0).toLocaleString('id-ID')}`;
        };

        itemsContainer.innerHTML = `
            <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5 lg:gap-3 xl:gap-3.5 2xl:gap-4 pb-2">
                ${filtered.map(p => `
                    <div class="p-3 lg:p-3.5 rounded-2xl bg-[#242426] hover:bg-[#2c2c2e] border border-white/[0.08] transition-all flex flex-col justify-between shadow-sm">
                        <div class="flex items-start justify-between gap-2 mb-2">
                            <span class="text-xs lg:text-sm font-semibold text-[#f5f5f7] leading-tight truncate" title="${p.nama || 'Paket'}">${p.nama || 'Paket'}</span>
                            <span class="text-[9px] font-medium px-2 py-0.5 rounded-lg bg-white/10 text-[#86868b] shrink-0 uppercase tracking-wider">${p.grup || 'Reguler'}</span>
                        </div>
                        <div class="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                            <span class="text-[10px] lg:text-[11px] text-[#86868b] font-medium">${formatDuration(p.durasi_menit)}</span>
                            <span class="text-xs lg:text-sm font-bold text-[#30d158] tracking-wide font-mono">${formatRupiah(p.harga)}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    /**
     * Render daftar menu kantin (Desktop Responsive Grid)
     */
    renderMenuList() {
        const container = document.getElementById('tab-content-menu');
        if (!container) return;

        const menus = AppState.allMenus || [];
        if (menus.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-16 text-[#6e6e73]">
                    <svg class="w-10 h-10 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                    </svg>
                    <p class="text-xs font-semibold">Tidak ada menu kantin aktif saat ini</p>
                </div>
            `;
            return;
        }

        const formatRupiah = (val) => {
            return `Rp ${Number(val || 0).toLocaleString('id-ID')}`;
        };

        container.innerHTML = `
            <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5 lg:gap-3 xl:gap-3.5 2xl:gap-4 pb-2">
                ${menus.map(m => `
                    <div class="p-3 lg:p-3.5 rounded-2xl bg-[#242426] hover:bg-[#2c2c2e] border border-white/[0.08] transition-all flex flex-col justify-between shadow-sm">
                        <div class="flex items-start justify-between gap-2 mb-2">
                            <span class="text-xs lg:text-sm font-semibold text-[#f5f5f7] leading-tight truncate" title="${m.nama || 'Menu'}">${m.nama || 'Menu'}</span>
                            <span class="text-[9px] font-medium px-2 py-0.5 rounded-lg bg-emerald-500/10 text-[#30d158] border border-emerald-500/20 shrink-0 uppercase tracking-wider">
                                Ready
                            </span>
                        </div>
                        <div class="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                            <span class="text-[10px] lg:text-[11px] text-[#86868b] font-medium">Kantin</span>
                            <span class="text-xs lg:text-sm font-bold text-[#30d158] tracking-wide font-mono">${formatRupiah(m.harga)}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
};
