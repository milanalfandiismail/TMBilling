import { Api } from './api.js';
import { UI } from './ui.js';

/**
 * Main Application Controller
 */
const App = {
    isOverlayActive: false,
    hasPlayed5MinAlert: false,

    async init() {
        console.log("TMBilling Client Started");
        this.bindEvents();
        await this.loadInitialData();
        await this.checkExternalBackground();
        this.initListeners();
        
        // Pastikan masuk mode kiosk saat pertama kali nyala
        this.isOverlayActive = false;
        await Api.switchToKiosk();
    },

    async checkExternalBackground() {
        try {
            const externalPath = await Api.getExternalBg();
            if (externalPath) {
                console.log("Using external background:", externalPath);
                // Konversi path file lokal jadi URL yang bisa dimengerti browser (Tauri Asset Protocol)
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

    initListeners() {
        // Dengerin update waktu dari Rust polling
        Api.onEvent('time-update', (seconds) => {
            UI.updateTime(seconds);
            
            // Pemicu Audio Peringatan Sisa Waktu 5 Menit (300 detik)
            if (this.isOverlayActive && 
                seconds <= 300 && 
                seconds > 290 && 
                !this.hasPlayed5MinAlert && 
                this.currentStatus !== 'admin') {
                
                this.hasPlayed5MinAlert = true;
                
                // Putar file MP3 secara asinkron (tidak memblokir jalannya antarmuka/game)
                const alertAudio = new Audio('assets/sounds/warning_5min.mp3');
                alertAudio.volume = 0.7; // Volume 70%
                alertAudio.play().catch(err => {
                    console.warn("Berkas audio warning_5min.mp3 belum tersedia atau gagal diputar:", err);
                });
            }
            
            // Auto-Lock jika waktu habis saat sedang bermain (Kecuali Admin)
            if (this.isOverlayActive && seconds <= 0 && this.currentStatus !== 'admin') {
                console.log("Waktu habis! Mengunci PC...");
                this.handleLogout(true);
            }
        });

        // Remote Activation (Kasir buka Guest) / Persistence (Habis Restart)
        Api.onEvent('status-update', async (status) => {
            console.log("Status update received:", status);
            this.currentStatus = status.status; // Simpan status terbaru
            
            // Update nama PC secara dinamis jika dikirim oleh server
            if (status.pc_kode) {
                document.querySelectorAll('.pc-name-display').forEach(el => {
                    el.innerText = status.pc_kode;
                });
            }
            
            // Jika di server kosong/error tapi di client overlay masih aktif -> PAKSA LOGOUT/LOCK
            if (this.isOverlayActive && (status.status === 'kosong' || status.status === 'error')) {
                console.log("Sesi kosong/error di server. Mengunci client...");
                await this.handleLogout(true);
                return;
            }

            // LOGIKA AUTO SHUTDOWN
            if (status.status === 'kosong' && status.shutdown_timer > 0) {
                this.startShutdownTimer(status.shutdown_timer);
            } else {
                this.stopShutdownTimer();
            }

            // Jika di server aktif tapi di client masih di login screen -> LANGSUNG BUKA
            if (!this.isOverlayActive && (status.status === 'aktif' || status.status === 'admin')) {
                console.log("Auto-switching to overlay because status is:", status.status);
                this.isOverlayActive = true;
                
                const data = {
                    status: "success",
                    member_name: status.nama || "Guest",
                    group: status.grup || "Member",
                    remaining_seconds: status.sisa_waktu
                };
                
                UI.setOverlayData(data);
                UI.showScreen('billing-overlay');
                await Api.switchToOverlay();
            }
        });

        // Dengerin paksaan lock (sesi abis)
        Api.onEvent('force-lock', () => {
            this.handleLogout(true);
        });

        // Dengerin info PC dari server (setelah identify)
        Api.onEvent('pc-identified', (res) => {
            if (res.pc_kode) {
                document.querySelectorAll('.pc-name-display').forEach(el => {
                    el.innerText = res.pc_kode;
                });
            }
        });

        // Dengerin Hotkey Admin dari Rust
        Api.onEvent('show-admin-login', async () => {
            // Cek apakah sebelumnya lagi di mode overlay
            this.wasOverlay = !document.getElementById('billing-overlay').classList.contains('hidden');
            UI.toggleAdminModal(true);
        });
    },

    async handleAdminCancel() {
        UI.toggleAdminModal(false);
        if (this.wasOverlay) {
            await Api.switchToOverlay();
        }
    },

    async loadInitialData() {
        try {
            const info = await Api.getNetworkInfo();
            UI.setNetworkInfo(info.ip, info.mac);
        } catch (err) {
            console.error("Gagal memuat info PC:", err);
        }
    },

    bindEvents() {
        // Event Login (Main Screen)
        document.getElementById('login-btn').addEventListener('click', () => this.handleLogin());
        document.getElementById('username').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
        document.getElementById('password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });

        // Event Logout
        document.getElementById('logout-btn').addEventListener('click', () => this.handleLogout());

        // Event Window Controls
        document.getElementById('minimize-btn').addEventListener('click', () => Api.minimize());

        // --- ADMIN MODAL EVENTS ---
        document.getElementById('admin-close-btn').addEventListener('click', () => this.handleAdminCancel());
        document.getElementById('admin-login-confirm-btn').addEventListener('click', () => this.handleAdminModalLogin());
        document.getElementById('admin-user').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleAdminModalLogin();
        });
        document.getElementById('admin-pass').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleAdminModalLogin();
        });

        // --- LOGOUT CONFIRM MODAL EVENTS ---
        document.getElementById('logout-cancel-btn').addEventListener('click', () => UI.toggleLogoutModal(false));
        document.getElementById('logout-confirm-btn').addEventListener('click', () => this.confirmLogout());
    },

    async handleLogin() {
        const user = document.getElementById('username').value.trim();
        const pass = document.getElementById('password').value.trim();

        UI.setLoginLoading(true);

        try {
            const res = await Api.login(user, pass, false);

            if (res.status === "success") {
                this.isOverlayActive = true;
                UI.setOverlayData(res);
                UI.showScreen('billing-overlay');
                await Api.switchToOverlay();
            }
        } catch (err) {
            UI.showToast(err);
            UI.shakeLogin();
        } finally {
            UI.setLoginLoading(false);
        }
    },

    async handleAdminModalLogin() {
        const user = document.getElementById('admin-user').value.trim();
        const pass = document.getElementById('admin-pass').value.trim();

        try {
            const res = await Api.login(user, pass, true);
            if (res.status === "success") {
                this.stopShutdownTimer(); // 🔥 MATIKAN TIMER LANGSUNG
                this.isOverlayActive = true;
                this.currentStatus = 'admin'; // Set status admin
                UI.toggleAdminModal(false);
                UI.setOverlayData(res);
                UI.showScreen('billing-overlay');
                await Api.switchToOverlay();
            }
        } catch (err) {
            UI.showAdminError(err);
        }
    },

    async handleLogout(isForced = false) {
        if (isForced) {
            await this.confirmLogout();
        } else {
            UI.toggleLogoutModal(true);
        }
    },

    async confirmLogout() {
        UI.toggleLogoutModal(false);
        try {
            await Api.logout();
            this.isOverlayActive = false;
            this.hasPlayed5MinAlert = false;
            UI.showScreen('login-screen');
            // Reset inputs
            document.getElementById('username').value = "";
            document.getElementById('password').value = "";

            // Masuk mode kiosk (Kunci keyboard & pasang Hotkey lagi)
            await Api.switchToKiosk();
        } catch (err) {
            console.error("Gagal Logout:", err);
            this.isOverlayActive = false;
            // Tetap paksa ke login screen & kiosk jika error
            UI.showScreen('login-screen');
            await Api.switchToKiosk();
        }
    },

    // --- SHUTDOWN TIMER HELPERS ---
    startShutdownTimer(seconds) {
        if (this.shutdownInterval) return; // Udah jalan
        
        this.shutdownRemaining = seconds;
        UI.updateShutdownTimer(this.shutdownRemaining);

        this.shutdownInterval = setInterval(async () => {
            this.shutdownRemaining--;
            UI.updateShutdownTimer(this.shutdownRemaining);

            if (this.shutdownRemaining <= 0) {
                clearInterval(this.shutdownInterval);
                this.shutdownInterval = null;
                console.log("BOOM! PC SHUTTING DOWN...");
                await Api.forceShutdown();
            }
        }, 1000);
    },

    stopShutdownTimer() {
        if (this.shutdownInterval) {
            clearInterval(this.shutdownInterval);
            this.shutdownInterval = null;
            UI.updateShutdownTimer(0);
        }
    }
};

// Start the app
App.init();
