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
        document.getElementById('tab-btn-paket')?.addEventListener('click', () => this.switchMenuPaketTab('paket'));
        document.getElementById('tab-btn-menu')?.addEventListener('click', () => this.switchMenuPaketTab('menu'));
    },

    /**
     * Render QRIS image from configuration
     */
    async renderQris() {
        const qrisImg = document.getElementById('overlay-qris-img');
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
            if (fallbackEl) fallbackEl.classList.add('hidden');
        } else {
            qrisImg.classList.add('hidden');
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
     * Buka modal Menu & Paket (In-Card Modal Zero-Glitch)
     */
    async openMenuPaketModal() {
        const modal = document.getElementById('modal-menu-paket');
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

        // 2. Tampilkan modal seketika di dalam card
        modal.classList.remove('hidden');

        // Bind Escape key sekali saja
        if (!this._menuModalEventsBound) {
            window.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                    this.closeMenuPaketModal();
                }
            });
            this._menuModalEventsBound = true;
        }
    },

    /**
     * Tutup modal Menu & Paket
     */
    closeMenuPaketModal() {
        const modal = document.getElementById('modal-menu-paket');
        if (modal) modal.classList.add('hidden');
    },

    /**
     * Ganti tab aktif di modal Menu & Paket
     */
    switchMenuPaketTab(tab) {
        const tabPaketBtn = document.getElementById('tab-btn-paket');
        const tabMenuBtn = document.getElementById('tab-btn-menu');
        const contentPaket = document.getElementById('tab-content-paket');
        const contentMenu = document.getElementById('tab-content-menu');

        const activeClasses = ['bg-accent', 'text-white', 'shadow-md', 'shadow-accent/20'];
        const inactiveClasses = ['bg-white/5', 'text-neutral-400', 'hover:text-white', 'hover:bg-white/10', 'border', 'border-white/5'];

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
     * Render daftar paket billing (Grid 3 Kolom Lapang)
     */
    renderPaketList() {
        const container = document.getElementById('tab-content-paket');
        if (!container) return;

        const packages = AppState.allPackages || [];
        if (packages.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-16 text-neutral-500">
                    <svg class="w-10 h-10 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p class="text-xs font-semibold">Tidak ada paket billing aktif saat ini</p>
                </div>
            `;
            return;
        }

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

        container.innerHTML = `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pb-2">
                ${packages.map(p => `
                    <div class="p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-accent/30 transition-all flex flex-col justify-between">
                        <div class="flex items-start justify-between gap-1.5 mb-1.5">
                            <span class="text-xs font-bold text-white leading-tight truncate" title="${p.nama || 'Paket'}">${p.nama || 'Paket'}</span>
                            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-neutral-300 shrink-0 uppercase tracking-wider">${p.grup || 'Reguler'}</span>
                        </div>
                        <div class="flex items-center justify-between mt-2 pt-1.5 border-t border-white/5">
                            <span class="text-[10px] text-neutral-400 font-medium">⏱️ ${formatDuration(p.durasi_menit)}</span>
                            <span class="text-xs font-black text-accent tracking-wide">${formatRupiah(p.harga)}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    /**
     * Render daftar menu kantin (Status Ready Hardcode & Grid 3 Kolom Lapang)
     */
    renderMenuList() {
        const container = document.getElementById('tab-content-menu');
        if (!container) return;

        const menus = AppState.allMenus || [];
        if (menus.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-16 text-neutral-500">
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
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pb-2">
                ${menus.map(m => `
                    <div class="p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-accent/30 transition-all flex flex-col justify-between">
                        <div class="flex items-start justify-between gap-1.5 mb-1.5">
                            <span class="text-xs font-bold text-white leading-tight truncate" title="${m.nama || 'Menu'}">${m.nama || 'Menu'}</span>
                            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 uppercase tracking-wider">
                                Ready
                            </span>
                        </div>
                        <div class="flex items-center justify-between mt-2 pt-1.5 border-t border-white/5">
                            <span class="text-[10px] text-neutral-400 font-medium">🍽️ Kantin</span>
                            <span class="text-xs font-black text-accent tracking-wide">${formatRupiah(m.harga)}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
};
