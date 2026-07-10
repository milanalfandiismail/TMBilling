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

                UI.setOverlayData(data);
                UI.showScreen('billing-overlay');
                await Api.switchToOverlay();
            }
        });

        // Force lock event from Rust
        Api.onEvent('force-lock', () => {
            Overlay.handleLogout(true);
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
    }
};

// Start the app
App.init();
