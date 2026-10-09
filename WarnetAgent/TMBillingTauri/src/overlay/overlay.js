/**
 * Overlay Module
 * Handles overlay mode logic: timer display, logout, minimize
 */

import { AppState } from '../shared/state.js';
import { Api } from '../shared/api.js';
import { UI } from '../shared/ui.js';
import { formatTime, escapeHtml, formatRupiah, formatDuration } from '../shared/utils.js';
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

        // Modal Detail Item (Paket & Menu F&B)
        document.getElementById('btn-close-item-detail')?.addEventListener('click', () => this.closeItemDetailModal());
        document.getElementById('btn-close-item-detail-footer')?.addEventListener('click', () => this.closeItemDetailModal());
        const itemDetailModal = document.getElementById('modal-item-detail');
        itemDetailModal?.addEventListener('click', (e) => {
            if (e.target === itemDetailModal) this.closeItemDetailModal();
        });

        // Modal Status Member
        document.getElementById('btn-member-status')?.addEventListener('click', () => this.openMemberStatusModal());
        document.getElementById('btn-close-member-status')?.addEventListener('click', () => this.closeMemberStatusModal());
        document.getElementById('btn-done-member-status')?.addEventListener('click', () => this.closeMemberStatusModal());
        const memberStatusModal = document.getElementById('modal-member-status');
        memberStatusModal?.addEventListener('click', (e) => {
            if (e.target === memberStatusModal) this.closeMemberStatusModal();
        });

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
                    const detailModal = document.getElementById('modal-item-detail');
                    const memberModal = document.getElementById('modal-member-status');
                    const qrisModal = document.getElementById('modal-qris-fullscreen');
                    const menuModal = document.getElementById('modal-menu-paket');
                    if (detailModal && !detailModal.classList.contains('hidden')) {
                        this.closeItemDetailModal();
                    } else if (memberModal && !memberModal.classList.contains('hidden')) {
                        this.closeMemberStatusModal();
                    } else if (qrisModal && !qrisModal.classList.contains('hidden')) {
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
        this.closeItemDetailModal();
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
     * Dapatkan styling badge dinamis untuk grup paket (Apple Dark Mode aesthetic)
     */
    getGroupBadgeClass(groupName) {
        const name = String(groupName || 'REGULER').toUpperCase().trim();
        if (name.includes('SULTAN') || name.includes('VVIP') || name.includes('GOLD') || name.includes('ROYAL')) {
            return 'bg-amber-500/15 text-amber-400 border border-amber-500/25';
        }
        if (name.includes('VIP')) {
            return 'bg-purple-500/15 text-purple-400 border border-purple-500/25';
        }
        if (name.includes('ESPORT') || name.includes('GAMING') || name.includes('PRO') || name.includes('TOURNAMENT')) {
            return 'bg-emerald-500/15 text-[#30d158] border border-emerald-500/25';
        }
        if (name.includes('STREAM') || name.includes('STUDIO') || name.includes('PODCAST')) {
            return 'bg-rose-500/15 text-rose-400 border border-rose-500/25';
        }
        if (name.includes('REGULER') || name.includes('REGULAR') || name.includes('STANDARD')) {
            return 'bg-blue-500/15 text-blue-400 border border-blue-500/25';
        }
        
        // Fallback: Deterministic dynamic color from group name hash
        const palette = [
            'bg-blue-500/15 text-blue-400 border border-blue-500/25',
            'bg-purple-500/15 text-purple-400 border border-purple-500/25',
            'bg-amber-500/15 text-amber-400 border border-amber-500/25',
            'bg-emerald-500/15 text-[#30d158] border border-emerald-500/25',
            'bg-rose-500/15 text-rose-400 border border-rose-500/25',
            'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25'
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % palette.length;
        return palette[index];
    },

    /**
     * Tampilkan popup detail lengkap untuk Paket Billing atau Menu Kantin
     */
    showItemDetailModal(type, item) {
        const modal = document.getElementById('modal-item-detail');
        if (!modal || !item) return;

        const iconBox = document.getElementById('item-detail-icon-box');
        const typeBadge = document.getElementById('item-detail-type-badge');
        const titleEl = document.getElementById('item-detail-title');
        const priceEl = document.getElementById('item-detail-price');
        const fieldsEl = document.getElementById('item-detail-fields');

        if (type === 'paket') {
            if (iconBox) iconBox.innerText = '🏷️';
            if (typeBadge) {
                typeBadge.innerText = 'Detail Paket Billing';
                typeBadge.className = 'text-[10px] lg:text-[11px] font-semibold text-[#30d158] uppercase tracking-wider';
            }
            if (titleEl) titleEl.innerText = item.nama || 'Paket Billing';
            if (priceEl) priceEl.innerText = formatRupiah(item.harga);

            const menit = Number(item.durasi_menit) || 0;
            let durasiText = `${menit} Menit`;
            if (menit >= 60) {
                const jam = menit / 60;
                durasiText = jam % 1 === 0 ? `${jam} Jam (${menit} Menit)` : `${jam.toFixed(1)} Jam (${menit} Menit)`;
            }

            const kadaluarsa = Number(item.kadaluarsa_hari);
            let masaBerlakuText = '30 Hari';
            if (kadaluarsa && kadaluarsa > 0) {
                masaBerlakuText = `${kadaluarsa} Hari`;
            } else if (item.kadaluarsa_hari === 0 || item.kadaluarsa_hari === '0') {
                masaBerlakuText = 'Aktif Saat Sesi';
            }

            const groupBadgeClass = this.getGroupBadgeClass(item.grup);

            if (fieldsEl) {
                fieldsEl.innerHTML = `
                    <div class="flex items-center justify-between py-1.5 lg:py-2 xl:py-2.5 2xl:py-3 border-b border-white/[0.06]">
                        <span class="text-[#86868b] font-medium text-xs lg:text-xs xl:text-sm 2xl:text-base">Grup Ruangan</span>
                        <span class="px-2 lg:px-2.5 xl:px-3 py-0.5 lg:py-1 rounded-lg font-semibold text-xs lg:text-xs xl:text-sm 2xl:text-base uppercase tracking-wider ${groupBadgeClass}">${escapeHtml(item.grup || 'Reguler')}</span>
                    </div>
                    <div class="flex items-center justify-between py-1.5 lg:py-2 xl:py-2.5 2xl:py-3 border-b border-white/[0.06]">
                        <span class="text-[#86868b] font-medium text-xs lg:text-xs xl:text-sm 2xl:text-base">Total Durasi</span>
                        <span class="text-[#f5f5f7] font-bold text-xs lg:text-xs xl:text-sm 2xl:text-base font-mono">${durasiText}</span>
                    </div>
                    <div class="flex items-center justify-between py-1.5 lg:py-2 xl:py-2.5 2xl:py-3 border-b border-white/[0.06]">
                        <span class="text-[#86868b] font-medium text-xs lg:text-xs xl:text-sm 2xl:text-base">Masa Aktif: Berlaku s/d</span>
                        <span class="text-[#f5f5f7] font-bold text-xs lg:text-xs xl:text-sm 2xl:text-base font-mono">${masaBerlakuText}</span>
                    </div>
                    <div class="mt-2.5 lg:mt-3 xl:mt-3.5 p-2 lg:p-2.5 xl:p-3 rounded-xl lg:rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-left">
                        <span class="text-xs lg:text-sm xl:text-base shrink-0">💡</span>
                        <span class="text-[10px] lg:text-[11px] xl:text-xs 2xl:text-sm text-amber-400 font-medium">Masa aktif hanya berlaku untuk member</span>
                    </div>
                `;
            }
        } else {
            // Menu Kantin F&B
            if (iconBox) iconBox.innerText = '🍜';
            if (typeBadge) {
                typeBadge.innerText = 'Detail Menu Kantin (F&B)';
                typeBadge.className = 'text-[10px] lg:text-[11px] xl:text-xs 2xl:text-sm font-semibold text-[#ff9f0a] uppercase tracking-wider';
            }
            if (titleEl) titleEl.innerText = item.nama || 'Menu Kantin';
            if (priceEl) priceEl.innerText = formatRupiah(item.harga);

            if (fieldsEl) {
                fieldsEl.innerHTML = `
                    <div class="flex items-center justify-between py-1.5 lg:py-2 xl:py-2.5 2xl:py-3 border-b border-white/[0.06]">
                        <span class="text-[#86868b] font-medium text-xs lg:text-xs xl:text-sm 2xl:text-base">Kategori</span>
                        <span class="px-2 lg:px-2.5 xl:px-3 py-0.5 lg:py-1 rounded-lg bg-white/10 text-[#f5f5f7] font-semibold text-xs lg:text-xs xl:text-sm 2xl:text-base uppercase tracking-wider">Kantin (F&B)</span>
                    </div>
                    <div class="flex items-center justify-between py-1.5 lg:py-2 xl:py-2.5 2xl:py-3 border-b border-white/[0.06]">
                        <span class="text-[#86868b] font-medium text-xs lg:text-xs xl:text-sm 2xl:text-base">Status Ketersediaan</span>
                        <span class="px-2 lg:px-2.5 xl:px-3 py-0.5 lg:py-1 rounded-lg bg-emerald-500/10 text-[#30d158] border border-emerald-500/20 font-semibold text-xs lg:text-xs xl:text-sm 2xl:text-base uppercase tracking-wider">Ready / Tersedia</span>
                    </div>
                    <div class="pt-1.5 lg:pt-2 text-[11px] lg:text-xs xl:text-sm 2xl:text-base text-[#86868b] leading-relaxed">
                        🍜 <em>Untuk memesan makanan minuman, silahkan ke meja operator/kasir.</em>
                    </div>
                `;
            }
        }

        modal.classList.remove('hidden');
    },

    /**
     * Tutup popup detail item
     */
    closeItemDetailModal() {
        const modal = document.getElementById('modal-item-detail');
        if (modal) modal.classList.add('hidden');
    },

    /**
     * Buka modal Status & Profil Member (Fullscreen Center Modal)
     */
    async openMemberStatusModal() {
        const modal = document.getElementById('modal-member-status');
        const mainCard = document.getElementById('overlay-main-card');
        if (!modal) return;

        const member = AppState.memberData || {
            username: AppState.sessionData?.memberName || 'Member',
            nama_lengkap: AppState.sessionData?.memberName || 'Member',
            grup: AppState.sessionData?.group || 'Reguler',
            waktu_tersimpan: Math.floor((AppState.sessionData?.remainingSeconds || 0) / 60)
        };

        const nameEl = document.getElementById('member-modal-name');
        const usernameEl = document.getElementById('member-modal-username');
        const groupBadge = document.getElementById('member-modal-group-badge');
        const fieldsEl = document.getElementById('member-modal-fields');

        if (nameEl) nameEl.innerText = member.nama_lengkap || member.username || 'Member';
        if (usernameEl) usernameEl.innerText = `@${member.username || '-'}`;
        
        const groupName = member.grup || 'Reguler';
        if (groupBadge) {
            groupBadge.innerText = groupName;
            groupBadge.className = `px-2.5 lg:px-3 py-0.5 lg:py-1 rounded-lg text-[10px] lg:text-[11px] xl:text-xs 2xl:text-sm font-semibold uppercase tracking-wider ${this.getGroupBadgeClass(groupName)}`;
        }

        const menitTersimpan = Number(member.waktu_tersimpan) || 0;
        let saldoText = `${menitTersimpan} Menit`;
        if (menitTersimpan >= 60) {
            const jam = Math.floor(menitTersimpan / 60);
            const sisaM = menitTersimpan % 60;
            saldoText = sisaM > 0 ? `${jam} Jam ${sisaM} Menit (${menitTersimpan} Menit)` : `${jam} Jam (${menitTersimpan} Menit)`;
        }

        const masaAktifText = member.kadaluarsa_pada_display || member.kadaluarsa_pada || 'Tidak Terbatas';
        const dibuatText = member.dibuat_pada_display || member.dibuat_pada || '-';
        const noHpText = member.no_hp || '-';
        const emailText = member.email || '-';

        if (fieldsEl) {
            fieldsEl.innerHTML = `
                <div class="flex items-center justify-between py-1.5 lg:py-2 xl:py-2.5 2xl:py-3 border-b border-white/[0.06]">
                    <span class="text-[#86868b] font-medium text-xs lg:text-xs xl:text-sm 2xl:text-base">Grup Ruangan</span>
                    <span class="px-2 lg:px-2.5 xl:px-3 py-0.5 lg:py-1 rounded-lg font-semibold text-xs lg:text-xs xl:text-sm 2xl:text-base uppercase tracking-wider ${this.getGroupBadgeClass(groupName)}">${escapeHtml(groupName)}</span>
                </div>
                <div class="flex items-center justify-between py-1.5 lg:py-2 xl:py-2.5 2xl:py-3 border-b border-white/[0.06]">
                    <span class="text-[#86868b] font-medium text-xs lg:text-xs xl:text-sm 2xl:text-base">Total Sisa Waktu</span>
                    <span class="text-[#30d158] font-bold text-xs lg:text-xs xl:text-sm 2xl:text-base font-mono">${saldoText}</span>
                </div>
                <div class="flex items-center justify-between py-1.5 lg:py-2 xl:py-2.5 2xl:py-3 border-b border-white/[0.06]">
                    <span class="text-[#86868b] font-medium text-xs lg:text-xs xl:text-sm 2xl:text-base">Masa Aktif: Berlaku s/d</span>
                    <span class="text-[#f5f5f7] font-semibold text-xs lg:text-xs xl:text-sm 2xl:text-base font-mono">${escapeHtml(masaAktifText)}</span>
                </div>
                <div class="flex items-center justify-between py-1.5 lg:py-2 xl:py-2.5 2xl:py-3 border-b border-white/[0.06]">
                    <span class="text-[#86868b] font-medium text-xs lg:text-xs xl:text-sm 2xl:text-base">No. WhatsApp / HP</span>
                    <span class="text-[#f5f5f7] font-medium text-xs lg:text-xs xl:text-sm 2xl:text-base">${escapeHtml(noHpText)}</span>
                </div>
                <div class="flex items-center justify-between py-1.5 lg:py-2 xl:py-2.5 2xl:py-3 border-b border-white/[0.06]">
                    <span class="text-[#86868b] font-medium text-xs lg:text-xs xl:text-sm 2xl:text-base">Email</span>
                    <span class="text-[#f5f5f7] font-medium text-xs lg:text-xs xl:text-sm 2xl:text-base truncate max-w-[180px] lg:max-w-[220px] xl:max-w-[280px] 2xl:max-w-[340px]">${escapeHtml(emailText)}</span>
                </div>
                <div class="flex items-center justify-between py-1.5 lg:py-2 xl:py-2.5 2xl:py-3 border-b border-white/[0.06]">
                    <span class="text-[#86868b] font-medium text-xs lg:text-xs xl:text-sm 2xl:text-base">Terdaftar Sejak</span>
                    <span class="text-[#86868b] font-medium text-xs lg:text-xs xl:text-sm 2xl:text-base">${escapeHtml(dibuatText)}</span>
                </div>
                <div class="flex items-center justify-between py-1.5 lg:py-2 xl:py-2.5 2xl:py-3">
                    <span class="text-[#86868b] font-medium text-xs lg:text-xs xl:text-sm 2xl:text-base">Status Keanggotaan</span>
                    <span class="px-2 lg:px-2.5 xl:px-3 py-0.5 lg:py-1 rounded-lg bg-emerald-500/10 text-[#30d158] border border-emerald-500/20 font-semibold text-xs lg:text-xs xl:text-sm 2xl:text-base uppercase tracking-wider">Aktif / Verified</span>
                </div>
            `;
        }

        if (mainCard) mainCard.classList.add('hidden');
        modal.classList.remove('hidden');
        await Api.setOverlayModalFullscreen(true);
    },

    /**
     * Tutup modal Status Member
     */
    async closeMemberStatusModal() {
        const modal = document.getElementById('modal-member-status');
        const mainCard = document.getElementById('overlay-main-card');
        if (modal) modal.classList.add('hidden');
        if (mainCard) mainCard.classList.remove('hidden');
        await Api.setOverlayModalFullscreen(false);
    },

    /**
     * Render daftar paket billing (Dengan Filter Grup, 2-Line Natural Wrapping & Interactive Detail Click)
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

        const formatDurationLocal = (menit) => {
            if (!menit) return '-';
            if (menit >= 60) {
                const jam = menit / 60;
                return jam % 1 === 0 ? `${jam} Jam` : `${jam.toFixed(1)} Jam`;
            }
            return `${menit} Menit`;
        };

        itemsContainer.innerHTML = `
            <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5 lg:gap-3 xl:gap-3.5 2xl:gap-4 pb-2">
                ${filtered.map(p => {
                    const groupBadgeClass = this.getGroupBadgeClass(p.grup);
                    return `
                    <div data-paket-id="${p.id}"
                        class="overlay-paket-card p-3 lg:p-3.5 rounded-2xl bg-[#242426] hover:bg-[#2c2c2e] border border-white/[0.08] hover:border-[#30d158]/40 transition-all flex flex-col justify-between shadow-sm cursor-pointer group active:scale-[0.98] select-none"
                        title="Klik untuk melihat detail lengkap ${escapeHtml(p.nama || 'Paket')}">
                        <div class="flex items-start justify-between gap-2 mb-2">
                            <span class="text-xs lg:text-sm font-semibold text-[#f5f5f7] group-hover:text-white leading-snug line-clamp-2 break-words min-h-[2.25rem] flex items-center">
                                ${escapeHtml(p.nama || 'Paket')}
                            </span>
                            <span class="text-[9px] font-medium px-2 py-0.5 rounded-lg shrink-0 uppercase tracking-wider ${groupBadgeClass}">
                                ${escapeHtml(p.grup || 'Reguler')}
                            </span>
                        </div>
                        <div class="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                            <span class="text-[10px] lg:text-[11px] text-[#86868b] font-medium">${formatDurationLocal(p.durasi_menit)}</span>
                            <div class="flex items-center gap-1.5">
                                <span class="text-xs lg:text-sm font-bold text-[#30d158] tracking-wide font-mono">${formatRupiah(p.harga)}</span>
                                <svg class="w-3.5 h-3.5 text-[#86868b] group-hover:text-[#30d158] transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                `}).join('')}
            </div>
        `;

        // 5. Bind click listeners to cards for opening detail modal
        itemsContainer.querySelectorAll('.overlay-paket-card').forEach(card => {
            card.addEventListener('click', () => {
                const pId = card.getAttribute('data-paket-id');
                const paketObj = filtered.find(item => String(item.id) === String(pId));
                if (paketObj) this.showItemDetailModal('paket', paketObj);
            });
        });
    },

    /**
     * Render daftar menu kantin (Dengan 2-Line Natural Wrapping & Interactive Detail Click)
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

        container.innerHTML = `
            <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5 lg:gap-3 xl:gap-3.5 2xl:gap-4 pb-2">
                ${menus.map(m => `
                    <div data-menu-id="${m.id}"
                        class="overlay-menu-card p-3 lg:p-3.5 rounded-2xl bg-[#242426] hover:bg-[#2c2c2e] border border-white/[0.08] hover:border-[#30d158]/40 transition-all flex flex-col justify-between shadow-sm cursor-pointer group active:scale-[0.98] select-none"
                        title="Klik untuk melihat detail lengkap ${escapeHtml(m.nama || 'Menu')}">
                        <div class="flex items-start justify-between gap-2 mb-2">
                            <span class="text-xs lg:text-sm font-semibold text-[#f5f5f7] group-hover:text-white leading-snug line-clamp-2 break-words min-h-[2.25rem] flex items-center">
                                ${escapeHtml(m.nama || 'Menu')}
                            </span>
                            <span class="text-[9px] font-medium px-2 py-0.5 rounded-lg bg-emerald-500/10 text-[#30d158] border border-emerald-500/20 shrink-0 uppercase tracking-wider">
                                Ready
                            </span>
                        </div>
                        <div class="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                            <span class="text-[10px] lg:text-[11px] text-[#86868b] font-medium">Kantin</span>
                            <div class="flex items-center gap-1.5">
                                <span class="text-xs lg:text-sm font-bold text-[#30d158] tracking-wide font-mono">${formatRupiah(m.harga)}</span>
                                <svg class="w-3.5 h-3.5 text-[#86868b] group-hover:text-[#30d158] transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // Bind click listeners to menu cards
        container.querySelectorAll('.overlay-menu-card').forEach(card => {
            card.addEventListener('click', () => {
                const mId = card.getAttribute('data-menu-id');
                const menuObj = menus.find(item => String(item.id) === String(mId));
                if (menuObj) this.showItemDetailModal('menu', menuObj);
            });
        });
    }
};
