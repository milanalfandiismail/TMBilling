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
        await this.loadWarnetConfig();
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

        // --- INFO TAB SWITCHING ---
        document.getElementById('tab-rules-btn').addEventListener('click', () => this.switchInfoTab('rules'));
        document.getElementById('tab-packages-btn').addEventListener('click', () => this.switchInfoTab('packages'));

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
    },

    switchInfoTab(tab) {
        const rulesPanel = document.getElementById('panel-rules');
        const packagesPanel = document.getElementById('panel-packages');
        const rulesBtn = document.getElementById('tab-rules-btn');
        const packagesBtn = document.getElementById('tab-packages-btn');

        if (!rulesPanel || !packagesPanel) return;

        if (tab === 'rules') {
            rulesPanel.classList.remove('hidden');
            packagesPanel.classList.add('hidden');
            rulesBtn.className = 'flex-1 px-3 py-1.5 bg-white/10 border border-white/10 text-[9px] font-bold rounded-lg text-white transition-all';
            packagesBtn.className = 'flex-1 px-3 py-1.5 bg-white/5 border border-white/5 text-[9px] font-bold rounded-lg text-neutral-400 hover:text-white transition-all';
        } else {
            rulesPanel.classList.add('hidden');
            packagesPanel.classList.remove('hidden');
            rulesBtn.className = 'flex-1 px-3 py-1.5 bg-white/5 border border-white/5 text-[9px] font-bold rounded-lg text-neutral-400 hover:text-white transition-all';
            packagesBtn.className = 'flex-1 px-3 py-1.5 bg-white/10 border border-white/10 text-[9px] font-bold rounded-lg text-white transition-all';
        }
    },

    async loadWarnetConfig() {
        try {
            const config = await Api.getWarnetConfig();
            console.log("Warnet config loaded:", config);

            // 1. Render Title
            if (config.title) {
                const titleEl = document.getElementById('kiosk-title');
                if (titleEl) titleEl.innerText = config.title;
            }

            // 2. Render QRIS (langsung ke img element, tanpa wrapper)
            const qrisImg = document.getElementById('kiosk-qris-img');
            if (qrisImg) {
                if (config.qris_url) {
                    qrisImg.src = config.qris_url;
                } else {
                    qrisImg.style.display = 'none';
                    const wrapper = qrisImg.parentElement;
                    if (wrapper) {
                        wrapper.innerHTML = `<div class="text-4xl font-black text-neutral-500 font-mono">?</div><div class="text-[9px] text-neutral-500 uppercase tracking-widest mt-2 font-bold">Offline</div>`;
                    }
                }
            }

            // 3. Render Announcement
            this.allRules = [];
            if (config.announcement) {
                this.allRules = config.announcement.split('\n').map(l => l.trim()).filter(l => l !== "");
            }
            this.currentRulesPage = 1;
            this.initRulesUI();

            // 4. Render Packages List
            this.allPackages = config.paket || [];
            this.initPackagesUI();

        } catch (err) {
            console.error("Gagal memuat konfigurasi warnet (Offline state):", err);

            const titleEl = document.getElementById('kiosk-title');
            if (titleEl) titleEl.innerText = "TMBilling";

            const qrisImg = document.getElementById('kiosk-qris-img');
            if (qrisImg) {
                qrisImg.style.display = 'none';
                const qrisCard = qrisImg.closest('.premium-cyber-card');
                if (qrisCard) {
                    qrisCard.innerHTML = `<div class="text-center py-4"><div class="text-4xl font-black text-neutral-500 font-mono">?</div><div class="text-[9px] text-neutral-500 uppercase tracking-widest mt-2 font-bold">Offline</div></div>`;
                }
            }

            const rulesContainer = document.getElementById('rules-container');
            if (rulesContainer) {
                rulesContainer.innerHTML = `<p class="text-neutral-500 italic">aturan tidak dapat dimuat</p>`;
            }
            const rulesPrevBtn = document.getElementById('rules-prev-btn');
            const rulesNextBtn = document.getElementById('rules-next-btn');
            const rulesPageIndicator = document.getElementById('rules-page-indicator');
            if (rulesPrevBtn) rulesPrevBtn.disabled = true;
            if (rulesNextBtn) rulesNextBtn.disabled = true;
            if (rulesPageIndicator) rulesPageIndicator.innerText = "1 / 1";

            const paketContainer = document.getElementById('paket-list-container');
            if (paketContainer) {
                paketContainer.innerHTML = `<p class="text-neutral-500 italic">tarif tidak dapat dimuat</p>`;
            }
        }
    },

    initPackagesUI() {
        if (!this.allPackages || this.allPackages.length === 0) {
            const paketContainer = document.getElementById('paket-list-container');
            if (paketContainer) paketContainer.innerHTML = `<p class="text-neutral-500 text-xs">Tidak ada paket aktif</p>`;
            return;
        }

        // Extract distinct groups
        const groups = [...new Set(this.allPackages.map(p => p.grup || 'Reguler'))];

        // Render tabs
        const tabsContainer = document.getElementById('paket-tabs');
        if (tabsContainer) {
            tabsContainer.innerHTML = groups.map((g, idx) => `
                <button class="paket-tab-btn px-2 py-0.5 bg-white/5 border border-white/10 text-[8px] font-bold rounded-lg hover:bg-white/10 transition-all text-neutral-400 whitespace-nowrap" data-group="${g}">
                    ${g}
                </button>
            `).join('');

            // Add click listeners
            const tabBtns = tabsContainer.querySelectorAll('.paket-tab-btn');
            tabBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    tabBtns.forEach(b => {
                        b.classList.remove('bg-white/10', 'text-white', 'border-accent');
                        b.classList.add('text-neutral-400');
                    });
                    btn.classList.add('bg-white/10', 'text-white', 'border-accent');
                    btn.classList.remove('text-neutral-400');
                    this.selectedGroup = btn.getAttribute('data-group');
                    this.currentPackagePage = 1;
                    this.renderPackages();
                });
            });

            // Select first group by default
            if (tabBtns.length > 0) {
                tabBtns[0].click();
            }
        }

        // Setup pagination button click listeners once
        const prevBtn = document.getElementById('paket-prev-btn');
        const nextBtn = document.getElementById('paket-next-btn');

        if (prevBtn && !prevBtn.hasListener) {
            prevBtn.addEventListener('click', () => {
                if (this.currentPackagePage > 1) {
                    this.currentPackagePage--;
                    this.renderPackages();
                }
            });
            prevBtn.hasListener = true;
        }
        if (nextBtn && !nextBtn.hasListener) {
            nextBtn.addEventListener('click', () => {
                if (this.currentPackagePage < this.totalPackagePages) {
                    this.currentPackagePage++;
                    this.renderPackages();
                }
            });
            nextBtn.hasListener = true;
        }
    },

    renderPackages() {
        const filtered = this.allPackages.filter(p => (p.grup || 'Reguler') === this.selectedGroup);
        const itemsPerPage = 10;
        this.totalPackagePages = Math.ceil(filtered.length / itemsPerPage) || 1;

        const startIdx = (this.currentPackagePage - 1) * itemsPerPage;
        const endIdx = startIdx + itemsPerPage;
        const pageItems = filtered.slice(startIdx, endIdx);

        const container = document.getElementById('paket-list-container');
        if (container) {
            if (pageItems.length === 0) {
                container.innerHTML = `<p class="text-neutral-500 text-xs">Tidak ada paket</p>`;
            } else {
                container.innerHTML = pageItems.map(p => {
                    const formatRupiah = (val) => {
                        return 'Rp ' + Number(val).toLocaleString('id-ID');
                    };
                    const hours = p.durasi_menit >= 60 ? (p.durasi_menit / 60) + ' Jam' : p.durasi_menit + ' Menit';
                    return `
                        <div class="flex items-center justify-between px-2 py-1 bg-white/5 border border-white/5 hover:border-white/10 rounded-xl transition-all">
                            <div class="text-left min-w-0">
                                <p class="text-[9px] font-bold text-neutral-200 truncate">${p.nama}</p>
                                <p class="text-[7px] text-neutral-500 mt-0.5">${hours}</p>
                            </div>
                            <span class="text-[9px] font-bold text-accent font-mono shrink-0 ml-2">${formatRupiah(p.harga)}</span>
                        </div>
                    `;
                }).join('');
            }
        }

        // Update pagination UI
        const prevBtn = document.getElementById('paket-prev-btn');
        const nextBtn = document.getElementById('paket-next-btn');
        const pageIndicator = document.getElementById('paket-page-indicator');

        if (pageIndicator) {
            pageIndicator.innerText = `${this.currentPackagePage} / ${this.totalPackagePages}`;
        }
        if (prevBtn) {
            prevBtn.disabled = this.currentPackagePage <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.currentPackagePage >= this.totalPackagePages;
        }
    },

    initRulesUI() {
        if (!this.allRules || this.allRules.length === 0) {
            const rulesContainer = document.getElementById('rules-container');
            if (rulesContainer) rulesContainer.innerHTML = `<p class="text-neutral-500 text-xs">Tidak ada aturan aktif</p>`;
            
            const prevBtn = document.getElementById('rules-prev-btn');
            const nextBtn = document.getElementById('rules-next-btn');
            const pageIndicator = document.getElementById('rules-page-indicator');
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
            if (pageIndicator) pageIndicator.innerText = "1 / 1";
            return;
        }

        const prevBtn = document.getElementById('rules-prev-btn');
        const nextBtn = document.getElementById('rules-next-btn');

        if (prevBtn && !prevBtn.hasListener) {
            prevBtn.addEventListener('click', () => {
                if (this.currentRulesPage > 1) {
                    this.currentRulesPage--;
                    this.renderRules();
                }
            });
            prevBtn.hasListener = true;
        }
        if (nextBtn && !nextBtn.hasListener) {
            nextBtn.addEventListener('click', () => {
                if (this.currentRulesPage < this.totalRulesPages) {
                    this.currentRulesPage++;
                    this.renderRules();
                }
            });
            nextBtn.hasListener = true;
        }

        this.renderRules();
    },

    renderRules() {
        const itemsPerPage = 10;
        this.totalRulesPages = Math.ceil(this.allRules.length / itemsPerPage) || 1;

        const startIdx = (this.currentRulesPage - 1) * itemsPerPage;
        const endIdx = startIdx + itemsPerPage;
        const pageItems = this.allRules.slice(startIdx, endIdx);

        const container = document.getElementById('rules-container');
        if (container) {
            if (pageItems.length === 0) {
                container.innerHTML = `<p class="text-neutral-500 text-xs">Tidak ada aturan</p>`;
            } else {
                container.innerHTML = pageItems.map(line => `<p class="border-b border-white/5 pb-1 last:border-0 text-[9px] leading-snug">${line}</p>`).join('');
            }
        }

        const prevBtn = document.getElementById('rules-prev-btn');
        const nextBtn = document.getElementById('rules-next-btn');
        const pageIndicator = document.getElementById('rules-page-indicator');

        if (pageIndicator) {
            pageIndicator.innerText = `${this.currentRulesPage} / ${this.totalRulesPages}`;
        }
        if (prevBtn) {
            prevBtn.disabled = this.currentRulesPage <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.currentRulesPage >= this.totalRulesPages;
        }
    }
};

// Start the app
App.init();
