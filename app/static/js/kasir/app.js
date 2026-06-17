const App = {
    currentTab: 'dash',

    async init() {
        console.log('[TMBilling] Initializing application...');
        const loggedIn = await this.checkAuth();
        if (!loggedIn) {
            return;
        }

        await this.loadTab('dash');
        await Grup.load();
        // Shift Handover — under maintenance
        // if (typeof Shift !== 'undefined') Shift.load();
        this.updatePageTitle('dash');

        console.log('[TMBilling] Application initialized.');
        setInterval(() => {
            if (this.currentTab === 'dash') Dashboard.load();
            if (this.currentTab === 'monitor' && typeof Monitor !== 'undefined') Monitor.load();
        }, 5000);
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
        let mainTab = tab;
        let subTab = null;

        if (tab.startsWith('settings_')) {
            mainTab = 'settings';
            subTab = tab.replace('settings_', '');
        }

        // RBAC: Kasir tidak boleh membuka tab admin-only
        const kasirOnlyRestricted = ['user', 'log', 'settings_general', 'settings_backup'];
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
        if (target) target.classList.remove('hidden');

        // Auto-expand/collapse submenus based on the active tab
        const tabToSubmenu = {
            menu: 'operasional', tournament: 'operasional',
            member: 'master', paket: 'master', pc: 'master', grup: 'master',
            user: 'staff',
            laporan: 'laporan', laporan_menu: 'laporan', struk: 'laporan',
            log: 'sistemlog',
            monitor: 'system', blackout: 'system',
            settings_general: 'settings',
            settings_backup: 'settings'
        };

        const activeSubmenu = tabToSubmenu[tab];
        
        const submenus = ['operasional', 'master', 'staff', 'laporan', 'sistemlog', 'system', 'settings'];
        submenus.forEach(sub => {
            const submenuEl = document.getElementById(`${sub}-submenu`);
            const arrowEl = document.getElementById(`${sub}-arrow`);
            if (sub === activeSubmenu) {
                if (submenuEl) submenuEl.classList.remove('hidden');
                if (arrowEl) arrowEl.classList.add('rotate-180');
            }
        });

        this.currentTab = tab;
        this.updatePageTitle(tab);
        this.loadTab(tab);

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
            grup: 'Grup', laporan: 'Laporan Omzet Billing', laporan_menu: 'Laporan Omzet Kantin / F&B', log: 'Log Aktivitas Sistem',
            monitor: 'Hardware Monitor', blackout: 'Blackout',
            user: 'Kelola User', settings: 'Pengaturan', struk: 'Riwayat',
            menu: 'Kantin / POS F&B', tournament: 'Manajemen Turnamen',
            settings_general: 'Pengaturan Umum & Kiosk',
            settings_backup: 'Pengaturan Database & Backup'
        };
 
        const titleEl = document.getElementById('page-title');
        if (titleEl) titleEl.innerText = titles[tab] || 'Panel';
    },
 
    async loadTab(tab) {
        if (tab.startsWith('settings_')) {
            const sub = tab.replace('settings_', '');
            if (typeof Settings !== 'undefined') {
                await Settings.load();
                Settings.switchSubTab(sub);
            }
            return;
        }
        switch (tab) {
            case 'dash': await Dashboard.load(); break;
            case 'pc': await PC.load(); break;
            case 'paket': await Paket.load(); break;
            case 'member': await Member.load(); break;
            case 'laporan': await Laporan.load(); break;
            case 'laporan_menu': if (typeof LaporanMenu !== 'undefined') await LaporanMenu.load(); break;
            case 'log': await Log.load(); break;
            case 'grup': await Grup.load(); break;
            case 'monitor': if (typeof Monitor !== 'undefined') await Monitor.load(); break;
            case 'blackout': await Blackout.load(); break;
            case 'user': if (typeof User !== 'undefined') await User.load(); break;
            case 'struk': if (typeof Struk !== 'undefined') await Struk.init(); break;
            case 'settings': if (typeof Settings !== 'undefined') await Settings.load(); break;
            case 'menu': if (typeof Menu !== 'undefined') await Menu.load(); break;
            case 'tournament': if (typeof Tournament !== 'undefined') await Tournament.load(); break;
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
window.LaporanMenu = LaporanMenu;
window.Log = Log;
window.BukaModal = BukaModal;
window.Blackout = Blackout;
window.Monitor = Monitor;
window.TambahModal = TambahModal;
window.Modal = Modal;
window.Toast = Toast;
window.User = User;
window.Menu = Menu;
window.Tournament = Tournament;
