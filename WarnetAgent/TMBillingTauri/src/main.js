/**
 * TMBilling Client - Main Entry Point
 * Menggabungkan semua modul dan menginisialisasi aplikasi
 */

import { AppState } from './shared/state.js';
import { Api } from './shared/api.js';
import { UI } from './shared/ui.js';
import { Kiosk } from './kiosk/kiosk.js';
import { Overlay } from './overlay/overlay.js';
import { Admin } from './overlay/admin.js';
import { STATUS } from './shared/constants.js';

/**
 * Main Application Controller
 */
const App = {
    /**
     * Initialize application
     */
    async init() {
        console.log("TMBilling Client Started");

        // Load overlay HTML dynamically
        try {
            const response = await fetch('overlay.html');
            const overlayHtml = await response.text();
            const container = document.getElementById('overlay-container');
            if (container) {
                container.innerHTML = overlayHtml;
            }
        } catch (err) {
            console.error("Gagal load overlay.html:", err);
        }

        // Initialize modules
        Kiosk.init();
        Overlay.init();
        Admin.init();
        this.initAfkEvents();

        // Load initial data
        await this.loadInitialData();

        // Check external background
        await this.checkExternalBackground();

        // Setup event listeners from Rust
        this.initListeners();

        // Start in kiosk mode
        AppState.isOverlayActive = false;
        await Api.switchToKiosk();
    },

    /**
     * Load initial network info
     */
    async loadInitialData() {
        try {
            const info = await Api.getNetworkInfo();
            AppState.setNetworkInfo(info.ip, info.mac);
            UI.setNetworkInfo(info.ip, info.mac);

            // Load app version dynamically from Cargo.toml
            const version = await Api.getAppVersion();
            const versionEl = document.getElementById('client-version-display');
            if (versionEl) {
                versionEl.innerText = `TMBilling v${version}`;
            }
        } catch (err) {
            console.error("Gagal memuat info PC:", err);
        }
    },

    /**
     * Check and load external background image
     */
    async checkExternalBackground() {
        try {
            const externalPath = await Api.getExternalBg();
            if (externalPath) {
                console.log("Using external background:", externalPath);
                const { convertFileSrc } = window.__TAURI__.tauri;
                const assetUrl = convertFileSrc(externalPath);

                const loginScreen = document.getElementById('login-screen');
                if (loginScreen) {
                    loginScreen.style.backgroundImage = `linear-gradient(rgba(5, 5, 5, 0.6), rgba(5, 5, 5, 0.75)), url('${assetUrl}')`;
                }
            }
        } catch (err) {
            console.error("Gagal load external background:", err);
        }
    },

    /**
     * Initialize event listeners from Rust backend
     */
    initListeners() {
        // Time update from Rust polling
        Api.onEvent('time-update', (seconds) => {
            Overlay.updateTime(seconds);
        });

        // Status update from Rust polling
        Api.onEvent('status-update', async (status) => {
            console.log("Status update received:", status);
            AppState.currentStatus = status.status;

            // Update PC name dynamically
            if (status.pc_kode) {
                AppState.sessionData.pcKode = status.pc_kode;
                document.querySelectorAll('.pc-name-display').forEach(el => {
                    el.innerText = status.pc_kode;
                });
            }

            // Force logout if server says empty/error but client is overlay
            if (AppState.isOverlayActive && (status.status === STATUS.KOSONG || status.status === STATUS.ERROR)) {
                console.log("Sesi kosong/error di server. Mengunci client...");
                await Overlay.handleLogout(true);
                return;
            }

            // Handle shutdown timer
            if (status.status === STATUS.KOSONG && status.shutdown_timer > 0) {
                Overlay.startShutdownTimer(status.shutdown_timer);
            } else {
                Overlay.stopShutdownTimer();
            }

            // Auto-switch to overlay if server says active
            if (!AppState.isOverlayActive && (status.status === STATUS.AKTIF || status.status === STATUS.ADMIN)) {
                console.log("Auto-switching to overlay because status is:", status.status);
                AppState.isOverlayActive = true;

                const data = {
                    status: "success",
                    member_name: status.nama || "Guest",
                    group: status.grup || "Member",
                    remaining_seconds: status.sisa_waktu
                };

                AppState.setSessionData({
                    memberName: data.member_name,
                    group: data.group,
                    remainingSeconds: data.remaining_seconds
                });

                UI.resetOverlayUI();
                UI.setOverlayData(data);
                UI.showScreen('billing-overlay');
                await Api.switchToOverlay();
            }

            // Session Type identification
            if (status.status === STATUS.ADMIN) {
                AppState.sessionType = 'admin';
            } else if (status.nama && status.nama.toLowerCase().startsWith('guest')) {
                AppState.sessionType = 'guest';
            } else if (!AppState.sessionType && status.status === STATUS.AKTIF) {
                AppState.sessionType = 'member';
            }

            // Sync AFK state from server polling
            if (status.is_afk === true && !AppState.isAfk && AppState.isOverlayActive) {
                AppState.isAfk = true;
                UI.showScreen('afk-screen');
                await Api.switchToAfk();
            } else if (status.is_afk === false && AppState.isAfk) {
                AppState.isAfk = false;
                const unlockInput = document.getElementById('afk-unlock-input');
                if (unlockInput) unlockInput.value = '';
                document.getElementById('afk-error-msg')?.classList.add('hidden');
                UI.showScreen('billing-overlay');
                await Api.switchToOverlay();
            }
        });

        // Force lock event from Rust
        Api.onEvent('force-lock', () => {
            Overlay.handleLogout(true);
        });

        // Force AFK lock event from Rust
        Api.onEvent('force-afk-lock', async () => {
            console.log('Force AFK Lock received');
            AppState.isAfk = true;
            UI.showScreen('afk-screen');
            await Api.switchToAfk();
        });

        // Force AFK unlock event from Rust
        Api.onEvent('force-afk-unlock', async () => {
            console.log('Force AFK Unlock received');
            AppState.isAfk = false;
            const unlockInput = document.getElementById('afk-unlock-input');
            if (unlockInput) unlockInput.value = '';
            document.getElementById('afk-error-msg')?.classList.add('hidden');
            UI.showScreen('billing-overlay');
            await Api.switchToOverlay();
        });

        // PC identified event from server
        Api.onEvent('pc-identified', (res) => {
            if (res.pc_kode) {
                AppState.sessionData.pcKode = res.pc_kode;
                document.querySelectorAll('.pc-name-display').forEach(el => {
                    el.innerText = res.pc_kode;
                });
            }
        });

        // Admin hotkey from Rust
        Api.onEvent('show-admin-login', async () => {
            Admin.show();
        });
    },

    /**
     * Initialize AFK screen unlock events
     */
    initAfkEvents() {
        const unlockBtn = document.getElementById('afk-unlock-btn');
        const unlockInput = document.getElementById('afk-unlock-input');

        const performUnlock = async () => {
            const credential = (unlockInput?.value || '').trim();
            if (!credential) {
                UI.showAfkUnlockError('Masukkan password akun atau PIN!');
                return;
            }

            UI.setAfkUnlockLoading(true);
            try {
                await Api.afkUnlock(credential);
                AppState.isAfk = false;
                if (unlockInput) unlockInput.value = '';
                document.getElementById('afk-error-msg')?.classList.add('hidden');
                UI.showScreen('billing-overlay');
                await Api.switchToOverlay();
            } catch (err) {
                console.error('Gagal membuka kunci AFK:', err);
                UI.showAfkUnlockError(err || 'Password akun atau PIN salah!');
            } finally {
                UI.setAfkUnlockLoading(false);
            }
        };

        unlockBtn?.addEventListener('click', performUnlock);
        unlockInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') performUnlock();
        });
    }
};

// Start the app
App.init();
