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
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                if (tab) this.switchTab(tab);
            });
        });
    },
 
    switchTab(tab) {
        document.querySelectorAll('.nav-item').forEach(btn => {
            const onclick = btn.getAttribute('onclick') || '';
            const dataTab = btn.getAttribute('data-tab') || '';
            
            if (dataTab === tab || onclick.includes(`'${tab}'`)) {
                btn.classList.add('bg-neutral-100', 'text-[#050505]', 'font-bold');
                btn.classList.remove('text-neutral-400', 'hover:text-neutral-100', 'hover:bg-[#121212]');
            } else {
                btn.classList.remove('bg-neutral-100', 'text-[#050505]', 'font-bold');
                btn.classList.add('text-neutral-400', 'hover:text-neutral-100', 'hover:bg-[#121212]');
            }
        });

        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        const target = document.getElementById(`tab-${tab}`);
        if (target) target.classList.remove('hidden');

        // Auto-collapse settings submenu when switching to other tabs, and auto-expand when entering settings tab
        const settingsSubmenu = document.getElementById('settings-submenu');
        const settingsArrow = document.getElementById('settings-arrow');
        if (tab !== 'settings') {
            if (settingsSubmenu) settingsSubmenu.classList.add('hidden');
            if (settingsArrow) settingsArrow.classList.remove('rotate-180');
        } else {
            if (settingsSubmenu) settingsSubmenu.classList.remove('hidden');
            if (settingsArrow) settingsArrow.classList.add('rotate-180');
        }

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
            grup: 'Grup', laporan: 'Laporan Omzet Billing', laporan_menu: 'Laporan Omzet Kantin / F&B', log: 'Log Sistem',
            monitor: 'Hardware Monitor', blackout: 'Blackout',
            user: 'Kelola User', settings: 'Pengaturan', struk: 'Riwayat',
            menu: 'Kantin / POS F&B'
        };
 
        const titleEl = document.getElementById('page-title');
        if (titleEl) titleEl.innerText = titles[tab] || 'Panel';
    },
 
    async loadTab(tab) {
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
 
window.App = App;
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
