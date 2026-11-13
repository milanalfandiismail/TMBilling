const App = {
    currentTab: 'dash',

    async init() {
        if (window.IS_DOCUMENTATION_PAGE) {
            await this.checkAuth();
            return;
        }
        const loggedIn = await this.checkAuth();
        if (!loggedIn) {
            return;
        }

        this.setupNavigation();
        this.switchTab('dash');
        await Grup.load();
        // Shift Handover load awal
        if (typeof Shift !== 'undefined') await Shift.load(true);
        this.updatePageTitle('dash');

        // Dynamic interval heartbeat untuk Dashboard, Seluruh Tab, dan In-Place Modal Sync
        this.startDashboardPolling();

        // Page Visibility API: kurangi frekuensi polling saat browser minimize / tab background (anti resource thrashing)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.startDashboardPolling(10000); // 10 detik saat tab tersembunyi
            } else {
                this.startDashboardPolling(); // restore normal
                if (this.currentTab === 'dash' || this.currentTab === 'dashboard') {
                    if (typeof Dashboard !== 'undefined') Dashboard.load(true);
                }
            }
        });

        // Session polling sudah di api.js (startSessionCheck)
    },

    startDashboardPolling(customInterval = null) {
        if (this._dashboardTimer) {
            clearInterval(this._dashboardTimer);
            this._dashboardTimer = null;
        }
        const interval = customInterval || ((typeof Dashboard !== 'undefined' && Dashboard.getRefreshInterval) ? Dashboard.getRefreshInterval() : 1000);
        let lastShiftCheck = 0;
        let lastStaticCheck = 0;

        this._dashboardTimer = setInterval(() => {
            const now = Date.now();

            // 1. Shift sync: di-throttle ke 60 detik (instan saat aksi buka/tutup shift)
            if (now - lastShiftCheck >= 60000) {
                lastShiftCheck = now;
                if (typeof Shift !== 'undefined') Shift.load(false);
            }

            // 2. Tab-specific live polling:
            // Tab live berjalan setiap tick (1-2s): dashboard, dash, monitor, server_statistic, screenshot
            // Tab statis di-throttle ke 60 detik saat dibiarkan aktif
            const isLiveTab = ['dashboard', 'dash', 'monitor', 'server_statistic', 'screenshot'].includes(this.currentTab);
            if (!isLiveTab) {
                if (now - lastStaticCheck < 60000) {
                    return;
                }
                lastStaticCheck = now;
            }

            // 3. Tab-specific live polling (In-place & Silent, state-preserving across all tabs)
            switch (this.currentTab) {
                case 'dashboard':
                case 'dash':
                    if (typeof Dashboard !== 'undefined') Dashboard.load(true);
                    break;
                case 'pc':
                    if (typeof PC !== 'undefined' && typeof PC.refreshLive === 'function') PC.refreshLive();
                    break;
                case 'paket':
                    if (typeof Paket !== 'undefined' && typeof Paket.refreshLive === 'function') Paket.refreshLive();
                    break;
                case 'member':
                    if (typeof Member !== 'undefined' && typeof Member.refreshLive === 'function') Member.refreshLive();
                    break;
                case 'grup':
                    if (typeof Grup !== 'undefined' && typeof Grup.refreshLive === 'function') Grup.refreshLive();
                    break;
                case 'user':
                    if (typeof User !== 'undefined' && typeof User.refreshLive === 'function') User.refreshLive();
                    break;
                case 'menu':
                    if (typeof Menu !== 'undefined' && typeof Menu.refreshLive === 'function') Menu.refreshLive();
                    break;
                case 'menu_stock_log':
                    if (typeof MenuStockLog !== 'undefined' && typeof MenuStockLog.refreshLive === 'function') MenuStockLog.refreshLive();
                    break;
                case 'tournament':
                    if (typeof Tournament !== 'undefined' && typeof Tournament.refreshLive === 'function') Tournament.refreshLive();
                    break;
                case 'catatan':
                    if (typeof Catatan !== 'undefined' && typeof Catatan.refreshLive === 'function') Catatan.refreshLive();
                    break;
                case 'struk':
                    if (typeof Struk !== 'undefined' && typeof Struk.refreshLive === 'function') Struk.refreshLive();
                    break;
                case 'screenshot':
                    if (typeof Screenshot !== 'undefined' && typeof Screenshot.refreshLive === 'function') Screenshot.refreshLive();
                    break;
                case 'log':
                    if (typeof Log !== 'undefined' && typeof Log.refreshLive === 'function') Log.refreshLive();
                    break;
                case 'monitor':
                    if (typeof Monitor !== 'undefined' && typeof Monitor.refreshLive === 'function') Monitor.refreshLive();
                    break;
                case 'hardware_checker':
                    if (typeof HardwareChecker !== 'undefined' && typeof HardwareChecker.refreshLive === 'function') HardwareChecker.refreshLive();
                    break;
                case 'maintenance':
                    if (typeof Maintenance !== 'undefined' && typeof Maintenance.refreshLive === 'function') Maintenance.refreshLive();
                    break;
                case 'laporan_maintenance':
                    if (typeof LaporanMaintenance !== 'undefined' && typeof LaporanMaintenance.refreshLive === 'function') LaporanMaintenance.refreshLive();
                    break;
                case 'uptime':
                    if (typeof UptimeTracker !== 'undefined' && typeof UptimeTracker.refreshLive === 'function') UptimeTracker.refreshLive();
                    break;
                case 'blackout':
                    if (typeof Blackout !== 'undefined' && typeof Blackout.refreshLive === 'function') Blackout.refreshLive();
                    break;
                case 'laporan':
                    if (typeof Laporan !== 'undefined' && typeof Laporan.refreshLive === 'function') Laporan.refreshLive();
                    break;
                case 'laporan_menu':
                    if (typeof LaporanMenu !== 'undefined' && typeof LaporanMenu.refreshLive === 'function') LaporanMenu.refreshLive();
                    break;
                case 'shift_history':
                case 'user_logs':
                    if (typeof Shift !== 'undefined' && typeof Shift.refreshHistoryLive === 'function') Shift.refreshHistoryLive();
                    break;
                case 'game_management':
                    if (typeof GameManagement !== 'undefined' && typeof GameManagement.refreshLive === 'function') GameManagement.refreshLive();
                    break;
                case 'analytics':
                    if (typeof OwnerAnalytics !== 'undefined' && typeof OwnerAnalytics.refreshLive === 'function') OwnerAnalytics.refreshLive();
                    break;
                case 'mikrotik':
                    if (typeof MikrotikModule !== 'undefined' && typeof MikrotikModule.refreshLive === 'function') MikrotikModule.refreshLive();
                    break;
                case 'tutorials':
                    if (typeof Tutorials !== 'undefined' && typeof Tutorials.refreshLive === 'function') Tutorials.refreshLive();
                    break;
                case 'server_statistic':
                    if (typeof ServerMonitor !== 'undefined' && typeof ServerMonitor.refreshLive === 'function') ServerMonitor.refreshLive();
                    break;
                case 'settings':
                case 'settings_general':
                case 'settings_payment':
                case 'settings_kiosk':
                case 'settings_tv':
                case 'whitelist_ip':
                case 'settings_cloud_backup':
                case 'settings_local_backup':
                case 'settings_db_cleanup':
                case 'settings_scheduler':
                case 'settings_migration':
                    if (typeof Settings !== 'undefined' && typeof Settings.refreshLive === 'function') Settings.refreshLive();
                    break;
            }
        }, interval);
    },

    restartDashboardPolling() {
        this.startDashboardPolling();
    },

    async checkAuth() {
        try {
            const result = await API.auth.check();
            this.user = result;
            if (!result.logged_in) {
                window.location.href = '/kasir/login';
                return false;
            }

            const userInfo = document.getElementById('user-info');
            if (userInfo && result.username) {
                const displayName = result.nama_lengkap || result.username;
                userInfo.innerHTML = `
                    <div class="w-9 h-9 rounded bg-neutral-100 flex items-center justify-center text-sm font-bold text-[#050505] shrink-0">
                        ${displayName.charAt(0).toUpperCase()}
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="text-sm font-semibold text-neutral-200 lg:truncate break-words whitespace-normal">${displayName}</div>
                        <div class="text-[10px] text-neutral-400 font-medium flex items-center gap-1.5">
                            <span class="w-1.5 h-1.5 rounded-full bg-neutral-500"></span>
                            Online
                        </div>
                    </div>
                `;
            }
            return true;
        } catch (err) {
            console.error('[Auth] Error:', err);
            window.location.href = '/kasir/login';
            return false;
        }
    },
 
    setupNavigation() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                if (tab) this.switchTab(tab);
            });
        });
    },
 
    switchTab(tab) {
        if (tab === 'dashboard') tab = 'dash';
        if (tab === 'game') tab = 'game_management';
        let mainTab = tab;
        let subTab = null;

        if (tab.startsWith('settings_') || tab === 'whitelist_ip') {
            if (tab === 'whitelist_ip') {
                mainTab = 'settings';
                subTab = 'whitelist_ip';
            } else {
                mainTab = 'settings';
                subTab = tab.replace('settings_', '');
            }
        }

        // RBAC: Kasir tidak boleh membuka tab admin-only
        const kasirOnlyRestricted = [
            'game', 'game_management',
            'user', 'shift_history', 'user_logs', 'log',
            'server_statistic', 'monitor', 'hardware_checker', 'uptime', 'maintenance', 'screenshot', 'remote_server',
            'settings', 'settings_general', 'settings_payment', 'settings_kiosk', 'settings_tv', 
            'settings_cloudflare_tunnel', 'settings_cloud_backup', 'settings_local_backup', 
            'settings_db_cleanup', 'settings_scheduler', 'settings_migration', 'whitelist_ip',
            'mikrotik', 'analytics'
        ];
        if (this.user && this.user.role === 'kasir' && kasirOnlyRestricted.includes(tab)) {
            Toast.error('Akses Ditolak: Hanya untuk Admin!');
            tab = 'dash';
            mainTab = 'dash';
            subTab = null;
        }


        document.querySelectorAll('.tab-btn').forEach(btn => {
            const onClick = btn.getAttribute('onclick') || '';
            const dataTab = btn.getAttribute('data-tab') || '';
            
            // Only match if data-tab exactly equals tab
            const matchData = dataTab === tab;
            
            if (matchData) {
                btn.classList.add('bg-neutral-100', 'text-[#050505]', 'font-bold');
                btn.classList.remove('text-neutral-400', 'hover:text-neutral-100', 'hover:bg-[#121212]');
            } else {
                btn.classList.remove('bg-neutral-100', 'text-[#050505]', 'font-bold');
                btn.classList.add('text-neutral-400', 'hover:text-neutral-100', 'hover:bg-[#121212]');
            }
        });

        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        const target = document.getElementById(`tab-${mainTab}`);
        if (target) {
            target.classList.remove('hidden');
            if (mainTab === 'server_statistic') {
                if (typeof ServerMonitor !== 'undefined') ServerMonitor.start();
            } else {
                if (typeof ServerMonitor !== 'undefined') ServerMonitor.stop();
            }
        }

        this.currentTab = tab;
        this.updatePageTitle(tab);
        this.loadTab(tab);

        // Toggle visibility of Header Omzet (hanya tampil di Dashboard pada desktop xl+)
        const omzetHeader = document.getElementById('header-omzet-container');
        if (omzetHeader) {
            if (tab === 'dash') {
                omzetHeader.classList.remove('hidden');
                omzetHeader.classList.add('hidden', 'xl:flex');
            } else {
                omzetHeader.classList.remove('xl:flex');
                omzetHeader.classList.add('hidden');
            }
        }

        // Auto-close sidebar on mobile/tablet after tab selection
        if (window.innerWidth < 1024) {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebar-overlay');
            if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
                sidebar.classList.add('-translate-x-full');
            }
            if (overlay && !overlay.classList.contains('hidden')) {
                overlay.classList.add('hidden');
            }
        }
    },

    updatePageTitle(tab) {
        const titles = {
            dash: 'Dashboard', pc: 'Unit PC', paket: 'Paket', member: 'Member',
            grup: 'Grup', arsip: 'Data Diarsipkan', game: 'Kelola Game & Aplikasi', game_management: 'Kelola Game & Aplikasi', laporan: 'Laporan Omzet Billing', laporan_menu: 'Laporan Omzet Kantin / F&B', log: 'Log Aktivitas Sistem',
            monitor: 'Hardware Monitor', hardware_checker: 'Hardware Checker', maintenance: 'Perawatan PC', laporan_maintenance: 'Laporan Perawatan', blackout: 'Pemulihan Mati Lampu', screenshot: 'Screenshot Monitor',
            uptime: 'Uptime Tracker',
            user: 'Kelola User', shift_history: 'Riwayat Serah Terima Shift', user_logs: 'Log & Audit Staff', settings: 'Pengaturan', struk: 'Riwayat',
            menu: 'Kantin / POS F&B', menu_stock_log: 'Log & Riwayat Stok Menu (F&B)', tournament: 'Manajemen Turnamen', catatan: 'Catatan',
            settings_general: 'Pengaturan Umum & Keamanan',
            settings_payment: 'Metode Pembayaran',
            settings_kiosk: 'Info Warnet & Kiosk',
            settings_tv: 'TV Signage Display',
            whitelist_ip: 'Pengaturan Whitelist IP',
            settings_cloud_backup: 'Cloud Backup',
            settings_local_backup: 'Berkas Backup Lokal',
            settings_db_cleanup: 'Pembersihan Database',
            settings_scheduler: 'Auto Scheduler',
            settings_migration: 'Migrasi & Update',
            tutorials: 'Dokumentasi & Tutorial',
            analytics: 'Analytics Owner',
            plugins: 'Plugins & Ekstensi',
            mikrotik: 'MikroTik Hotspot'
        };

        const titleEl = document.getElementById('page-title');
        if (titleEl) titleEl.innerText = titles[tab] || 'Panel';
    },
 
    async loadTab(tab) {
        // Close modal on tab change
        const modal = document.getElementById('modal');
        if (modal && !modal.classList.contains('hidden')) {
            Modal.close();
        }
        if (tab.startsWith('settings_') || tab === 'whitelist_ip') {
            if (tab === 'settings_tv') {
                if (typeof Settings !== 'undefined') {
                    await Settings.load(true);
                    Settings.switchSubTab('kiosk');
                    if (typeof Settings.switchKioskPill === 'function') {
                        Settings.switchKioskPill('tv');
                    }
                }
                return;
            }
            const sub = tab === 'whitelist_ip' ? 'whitelist_ip' : tab.replace('settings_', '');
            if (typeof Settings !== 'undefined') {
                await Settings.load(true);
                Settings.switchSubTab(sub);
            }
            return;
        }
        switch (tab) {
            case 'dashboard':
            case 'dash': await Dashboard.load(); break;
            case 'pc': await PC.load(); break;
            case 'paket': await Paket.load(); break;
            case 'member': await Member.load(); break;
            case 'laporan': await Laporan.load(); break;
            case 'laporan_menu': if (typeof LaporanMenu !== 'undefined') await LaporanMenu.load(); break;
            case 'log': await Log.load(); break;
            case 'grup': await Grup.load(); break;
            case 'game':
            case 'game_management': if (typeof GameManagement !== 'undefined') await GameManagement.init(); break;
            case 'monitor': if (typeof Monitor !== 'undefined') await Monitor.load(); break;
            case 'server_statistic':
                if (typeof ServerMonitor !== 'undefined') {
                    ServerMonitor.fetchMetrics();
                    ServerMonitor.checkLHMStatus();
                }
                break;
            case 'hardware_checker': if (typeof HardwareChecker !== 'undefined') await HardwareChecker.load(); break;
            case 'maintenance': if (typeof Maintenance !== 'undefined') await Maintenance.init(); break;
            case 'laporan_maintenance': if (typeof LaporanMaintenance !== 'undefined') await LaporanMaintenance.init(); break;
            case 'screenshot': if (typeof Screenshot !== 'undefined') Screenshot.init(); break;
            case 'uptime': if (typeof UptimeTracker !== 'undefined') await UptimeTracker.init(); break;
            case 'blackout': await Blackout.load(); break;
            case 'user': if (typeof User !== 'undefined') await User.load(); break;
            case 'arsip': if (typeof Arsip !== 'undefined') await Arsip.load(); break;
            case 'shift_history':
                if (typeof Shift !== 'undefined') {
                    await Shift.loadHistoryKasirList();
                    await Shift.loadHistory();
                }
                break;
            case 'user_logs': if (typeof Shift !== 'undefined') await Shift.loadUserLogs(); break;
            case 'struk': if (typeof Struk !== 'undefined') await Struk.init(); break;
            case 'settings': if (typeof Settings !== 'undefined') await Settings.load(); break;
            case 'menu': if (typeof Menu !== 'undefined') await Menu.load(); break;
            case 'menu_stock_log': if (typeof MenuStockLog !== 'undefined') await MenuStockLog.load(); break;
            case 'tournament': if (typeof Tournament !== 'undefined') await Tournament.load(); break;
            case 'catatan': if (typeof Catatan !== 'undefined') await Catatan.loadNotes(); break;
            case 'analytics': if (typeof OwnerAnalytics !== 'undefined') await OwnerAnalytics.load(); break;
            case 'mikrotik': if (typeof MikrotikModule !== 'undefined') MikrotikModule.init(); break;
            case 'tutorials': if (typeof Tutorials !== 'undefined') await Tutorials.load(); break;
            case 'remote_server': if (typeof VNCClient !== 'undefined') await VNCClient.load(); break;

        }
    },
 
    showTab(tab) { this.switchTab(tab); },

    async logout() {
        Modal.confirm('Yakin ingin logout?', async () => {
            try {
                await API.auth.logout();
                window.location.href = '/kasir/login';
            } catch (err) {
                Toast.error('Logout gagal');
            }
        });
    }
};
 
document.addEventListener('DOMContentLoaded', () => App.init());
 
const Sidebar = {
    toggleDropdown(id) {
        const submenu = document.getElementById(`${id}-submenu`);
        const arrow = document.getElementById(`${id}-arrow`);
        if (submenu) submenu.classList.toggle('hidden');
        if (arrow) arrow.classList.toggle('rotate-180');
    }
};

window.App = App;
window.Sidebar = Sidebar;
window.Dashboard = Dashboard;
window.PC = PC;
window.Paket = Paket;
window.Member = Member;
window.Laporan = Laporan;
window.LaporanMenu = typeof LaporanMenu !== 'undefined' ? LaporanMenu : undefined;
window.Log = Log;
window.BukaModal = typeof BukaModal !== 'undefined' ? BukaModal : undefined;
window.Blackout = typeof Blackout !== 'undefined' ? Blackout : undefined;
window.Monitor = typeof Monitor !== 'undefined' ? Monitor : undefined;
window.TambahModal = typeof TambahModal !== 'undefined' ? TambahModal : undefined;
window.Modal = Modal;
window.Toast = Toast;
window.User = typeof User !== 'undefined' ? User : undefined;
window.Menu = typeof Menu !== 'undefined' ? Menu : undefined;
window.MenuStockLog = typeof MenuStockLog !== 'undefined' ? MenuStockLog : undefined;
window.Tournament = typeof Tournament !== 'undefined' ? Tournament : undefined;
window.OwnerAnalytics = typeof OwnerAnalytics !== 'undefined' ? OwnerAnalytics : undefined;
window.Grup = typeof Grup !== 'undefined' ? Grup : undefined;
window.GameManagement = typeof GameManagement !== 'undefined' ? GameManagement : undefined;
window.ServerMonitor = typeof ServerMonitor !== 'undefined' ? ServerMonitor : undefined;
window.HardwareChecker = typeof HardwareChecker !== 'undefined' ? HardwareChecker : undefined;
window.Maintenance = typeof Maintenance !== 'undefined' ? Maintenance : undefined;
window.LaporanMaintenance = typeof LaporanMaintenance !== 'undefined' ? LaporanMaintenance : undefined;
window.Screenshot = typeof Screenshot !== 'undefined' ? Screenshot : undefined;
window.UptimeTracker = typeof UptimeTracker !== 'undefined' ? UptimeTracker : undefined;
window.Shift = typeof Shift !== 'undefined' ? Shift : undefined;
window.Struk = typeof Struk !== 'undefined' ? Struk : undefined;
window.Settings = typeof Settings !== 'undefined' ? Settings : undefined;
window.MikrotikModule = typeof MikrotikModule !== 'undefined' ? MikrotikModule : undefined;
window.Tutorials = typeof Tutorials !== 'undefined' ? Tutorials : undefined;
window.VNCClient = typeof VNCClient !== 'undefined' ? VNCClient : undefined;
window.VNCSession = typeof VNCSession !== 'undefined' ? VNCSession : undefined;
window.Catatan = typeof Catatan !== 'undefined' ? Catatan : undefined;
