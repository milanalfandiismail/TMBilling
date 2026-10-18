/**
 * Branch Core Module
 * Menangani state aktif cabang, switcher dropdown navbar, auto-refresh live, dan data sync.
 */
window.BranchCore = {
    branches: [],
    activeBranchId: sessionStorage.getItem('active_branch_id') || '0',
    activeBranchName: sessionStorage.getItem('active_branch_name') || 'Lokal',
    localWarnetTitle: 'Cabang Lokal',
    _lastBranchesFingerprint: null,

    async init() {
        // 100% Zero UI/UX & Security: Jika user login sebagai kasir, hentikan total modul ini
        const userRole = document.body.getAttribute('data-kasir-role');
        if (userRole !== 'admin') {
            return;
        }

        // Bersihkan sisa localStorage lama agar default selalu cabang lokal saat browser ditutup
        try {
            localStorage.removeItem('active_branch_id');
            localStorage.removeItem('active_branch_name');
        } catch (e) {}

        // Cek apakah elemen dropdown ada di DOM (hanya untuk role admin)
        const dropdownContainer = document.getElementById('branch-selector-container');
        if (!dropdownContainer) return;

        // Ambil nama warnet lokal dari elemen brand sidebar
        const brandTitleElem = document.getElementById('sidebar-brand-title');
        if (brandTitleElem) {
            const def = brandTitleElem.getAttribute('data-default-title') || brandTitleElem.textContent.trim();
            if (def) this.localWarnetTitle = def;
        }

        await this.loadBranches();
        this.renderNavbarDropdown();
        this.updateBrandAndSidebarVisibility();
        this.removeActiveBranchBanner();
        this.bindNavbarEvents();

        // Inisialisasi tab settings jika berada di halaman settings
        this.initSettingsPanel();
    },

    async loadBranches(isSilent = false) {
        try {
            const res = await API.branch.list(false);
            if (res && res.success) {
                const data = res.data || [];
                const newFingerprint = JSON.stringify(data.map(b => ({
                    id: b.id,
                    nama: b.nama,
                    url: b.url,
                    status_online: b.status_online,
                    latensi_ms: b.latensi_ms
                }))) + `_active_${this.activeBranchId}`;

                const changed = this._lastBranchesFingerprint !== newFingerprint;
                this.branches = data;
                this._lastBranchesFingerprint = newFingerprint;
                return changed;
            }
        } catch (err) {
            console.error('[BranchManager] Gagal memuat daftar cabang:', err);
        }
        return false;
    },

    async refreshLive() {
        const userRole = document.body.getAttribute('data-kasir-role');
        if (userRole !== 'admin') return;

        const branchesChanged = await this.loadBranches(true);
        if (branchesChanged) {
            const listContainer = document.getElementById('branch-selector-list');
            const isDropdownOpen = listContainer && !listContainer.classList.contains('hidden');
            if (!isDropdownOpen) {
                this.renderNavbarDropdown();
            }

            if (App.currentTab === 'branch') {
                const modalBranch = document.getElementById('modal-tambah-cabang');
                const isModalOpen = modalBranch && !modalBranch.classList.contains('hidden');
                if (!isModalOpen) {
                    this.renderBranchesSettingsTable();
                }
            }
        }

        if (App.currentTab === 'branch_inbound') {
            await this.loadInboundBranches(true);
        } else if (App.currentTab === 'branch_kasir') {
            await this.loadRemoteOperators(true);
        }
    },

    renderNavbarDropdown() {
        const btn = document.getElementById('branch-selector-btn');
        const listContainer = document.getElementById('branch-selector-list');
        if (!btn || !listContainer) return;

        // Update label tombol navbar
        let displayName = this.localWarnetTitle;
        let isRemote = false;

        if (this.activeBranchId !== '0') {
            const activeBranch = this.branches.find(b => String(b.id) === String(this.activeBranchId));
            if (activeBranch) {
                displayName = activeBranch.nama;
                isRemote = true;
            } else if (this.branches.length > 0) {
                // Hanya reset ke lokal jika daftar cabang sudah selesai dimuat dan ID benar-benar tidak ditemukan
                this.activeBranchId = '0';
                this.activeBranchName = this.localWarnetTitle;
                sessionStorage.setItem('active_branch_id', '0');
                sessionStorage.setItem('active_branch_name', this.localWarnetTitle);
            } else {
                // Cabang masih dalam proses pengambilan data dari API, pertahankan nama dari cache
                const cachedName = sessionStorage.getItem('active_branch_name');
                if (cachedName) displayName = cachedName;
                isRemote = true;
            }
        }

        const labelElem = document.getElementById('branch-selector-current-label');
        if (labelElem) {
            labelElem.textContent = displayName;
        }

        const iconElem = document.getElementById('branch-selector-icon');
        if (iconElem) {
            if (isRemote) {
                iconElem.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
            } else {
                iconElem.className = 'w-2 h-2 rounded-full bg-blue-400';
            }
        }

        // Render daftar item dropdown
        const displayVersion = window.APP_VERSION || document.querySelector('meta[name="app-version"]')?.content || 'v1.6.5';
        let html = `
            <div class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-white/5 flex items-center justify-between">
                <span>Pilih Cabang</span>
                <span class="text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-neutral-400 font-mono">${displayVersion}</span>
            </div>
            <div class="py-1 max-h-60 overflow-y-auto custom-scrollbar">
                <button type="button" data-branch-id="0" class="branch-option-item w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${this.activeBranchId === '0' ? 'bg-accent/15 text-accent font-bold' : 'text-neutral-300 hover:bg-white/5'}">
                    <div class="flex items-center gap-2">
                        <span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                        <span class="truncate max-w-[150px]">${this.localWarnetTitle} (Lokal)</span>
                    </div>
                    ${this.activeBranchId === '0' ? '<svg class="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' : ''}
                </button>
        `;

        this.branches.forEach(branch => {
            const isSelected = String(branch.id) === String(this.activeBranchId);
            const isOnline = Boolean(branch.status_online);
            const statusDot = isOnline
                ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>'
                : '<span class="w-1.5 h-1.5 rounded-full bg-red-400"></span>';

            const badgeOffline = !isOnline 
                ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-medium">Offline</span>'
                : '';

            html += `
                <button type="button" data-branch-id="${branch.id}" title="${!isOnline ? 'Cabang offline - Klik untuk mencoba tes koneksi dan beralih' : ''}" class="branch-option-item w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${isSelected ? 'bg-accent/15 text-accent font-bold' : (!isOnline ? 'text-neutral-400 hover:bg-white/5' : 'text-neutral-300 hover:bg-white/5')}">
                    <div class="flex items-center gap-2 min-w-0">
                        ${statusDot}
                        <span class="truncate max-w-[140px]">${branch.nama}</span>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                        ${badgeOffline}
                        ${isSelected ? '<svg class="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' : ''}
                    </div>
                </button>
            `;
        });

        html += `
            </div>
            <div class="p-1.5 border-t border-white/5 bg-neutral-900/50">
                <button type="button" id="btn-open-branch-settings" class="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors font-medium">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    <span>Kelola Cabang...</span>
                </button>
            </div>
        `;

        listContainer.innerHTML = html;

        // Bind event klik item
        listContainer.querySelectorAll('.branch-option-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = item.getAttribute('data-branch-id');
                this.switchBranch(targetId);
                this.toggleDropdown(false);
            });
        });

        const btnManage = document.getElementById('btn-open-branch-settings');
        if (btnManage) {
            btnManage.addEventListener('click', () => {
                this.toggleDropdown(false);
                if (this.activeBranchId !== '0') {
                    // Jika sedang di cabang remote dan ingin mengelola cabang, kembalikan dulu ke Cabang Lokal
                    this.switchBranch('0');
                }
                if (window.App && App.switchTab) {
                    App.switchTab('branch');
                }
            });
        }
    },

    showSwitchLoading(targetName, statusText = 'Menghubungkan ke server cabang...') {
        const overlay = document.getElementById('branch-switch-overlay');
        const titleEl = document.getElementById('branch-switch-title');
        const statusEl = document.getElementById('branch-switch-status');
        if (titleEl) {
            titleEl.textContent = targetName ? `Menghubungkan: ${targetName}` : 'Menghubungkan Cabang...';
        }
        if (statusEl) {
            statusEl.textContent = statusText;
        }
        if (overlay) {
            overlay.classList.remove('hidden');
            overlay.classList.add('flex');
        }
    },

    updateSwitchStatus(statusText) {
        const statusEl = document.getElementById('branch-switch-status');
        if (statusEl) {
            statusEl.textContent = statusText;
        }
    },

    hideSwitchLoading() {
        const overlay = document.getElementById('branch-switch-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
        }
    },

    updateBrandAndSidebarVisibility() {
        const titleEl = document.getElementById('sidebar-brand-title');
        const subTitleEl = document.getElementById('sidebar-brand-subtitle');
        const badgeContainer = document.getElementById('sidebar-brand-badge-container');
        const badgeText = document.getElementById('sidebar-brand-badge-text');
        const logoImg = document.getElementById('sidebar-brand-logo-img');
        const fileExplorerBtn = document.getElementById('sidebar-fileexplorer-btn');
        const documentationBtn = document.getElementById('sidebar-documentation-btn');
        const remoteHiddenElements = document.querySelectorAll('.sidebar-remote-hidden, .sidebar-branch-group, #sidebar-branch-wrapper, #sidebar-branch-section, #sidebar-staff-group, #sidebar-settings-group');

        const defaultTitle = (titleEl && titleEl.getAttribute('data-default-title')) || this.localWarnetTitle || 'TMBilling';
        const defaultSubtitle = (subTitleEl && subTitleEl.getAttribute('data-default-subtitle')) || 'Kasir Panel';

        if (this.activeBranchId === '0') {
            // MODE CABANG LOKAL
            document.body.setAttribute('data-branch-mode', 'local');
            if (titleEl) {
                titleEl.textContent = defaultTitle;
                titleEl.title = defaultTitle;
            }
            if (subTitleEl) {
                subTitleEl.textContent = defaultSubtitle;
                subTitleEl.className = 'text-[10px] text-neutral-500 leading-tight mt-0.5';
            }
            if (badgeContainer) {
                badgeContainer.className = 'w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center shrink-0 transition-all overflow-hidden select-none';
            }
            if (logoImg) {
                logoImg.classList.remove('hidden');
            }
            if (badgeText) {
                badgeText.classList.add('hidden');
                badgeText.textContent = '';
            }
            // Tampilkan kembali seluruh elemen lokal di sidebar
            remoteHiddenElements.forEach(el => el.classList.remove('hidden'));
            if (fileExplorerBtn) fileExplorerBtn.classList.remove('hidden');
            if (documentationBtn) documentationBtn.classList.remove('hidden');

            document.title = `${defaultTitle} - Kasir`;
        } else {
            // MODE CABANG REMOTE (READ-ONLY)
            document.body.setAttribute('data-branch-mode', 'remote');
            let branchName = this.activeBranchName || 'Cabang Remote';
            const b = this.branches.find(x => String(x.id) === String(this.activeBranchId));
            if (b && b.nama) branchName = b.nama;

            if (titleEl) {
                titleEl.textContent = branchName;
                titleEl.title = `${branchName} (Remote - Read Only)`;
            }
            if (subTitleEl) {
                subTitleEl.innerHTML = `<span class="inline-flex items-center gap-1.5 text-emerald-400 font-bold"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Cabang Remote (Read-Only)</span>`;
                subTitleEl.className = 'text-[10px] leading-tight mt-0.5';
            }
            if (badgeContainer) {
                badgeContainer.className = 'w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-500 text-black flex items-center justify-center shrink-0 shadow-lg shadow-emerald-950/40 transition-all select-none';
            }
            if (logoImg) {
                logoImg.classList.add('hidden');
            }
            if (badgeText) {
                badgeText.classList.remove('hidden');
                badgeText.className = 'text-black font-black text-xs uppercase';
                badgeText.textContent = branchName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'RM';
            }
            // Sembunyikan menu-menu server lokal, staf, utilitas & pengaturan di sidebar
            remoteHiddenElements.forEach(el => el.classList.add('hidden'));
            if (fileExplorerBtn) fileExplorerBtn.classList.add('hidden');
            if (documentationBtn) documentationBtn.classList.add('hidden');

            // Jika sedang membuka tab yang tidak diizinkan di cabang remote, otomatis alihkan ke Dashboard
            const remoteRestricted = [
                'branch', 'branch_inbound', 'branch_kasir', 'fileexplorer', 'tutorials',
                'user', 'shift_history', 'user_logs',
                'hardware_checker', 'remote_server', 'catatan', 'blackout',
                'mikrotik', 'log', 'plugins', 'plugin-spa',
                'settings', 'settings_general', 'settings_payment', 'settings_kiosk', 'settings_tv',
                'whitelist_ip', 'settings_cloudflare_tunnel', 'settings_cloud_backup', 'settings_local_backup',
                'settings_db_cleanup', 'settings_scheduler', 'settings_migration'
            ];
            if (window.App && remoteRestricted.includes(App.currentTab)) {
                App.switchTab('dash');
            }

            document.title = `${branchName} (Read-Only) - Kasir Panel`;
        }
    },

    removeActiveBranchBanner() {
        const banner = document.getElementById('active-branch-banner');
        if (banner) banner.remove();
    },

    bindNavbarEvents() {
        const btn = document.getElementById('branch-selector-btn');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown();
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('branch-selector-dropdown');
            if (dropdown && !dropdown.contains(e.target)) {
                this.toggleDropdown(false);
            }
        });
    },

    toggleDropdown(forceState = null) {
        const menu = document.getElementById('branch-selector-menu');
        if (!menu) return;
        const isOpen = !menu.classList.contains('hidden');
        const shouldOpen = forceState !== null ? forceState : !isOpen;

        if (shouldOpen) {
            menu.classList.remove('hidden');
        } else {
            menu.classList.add('hidden');
        }
    },

    async switchBranch(branchId) {
        const userRole = document.body.getAttribute('data-kasir-role');
        if (userRole !== 'admin') {
            if (window.Toast) {
                window.Toast.error('Akses Ditolak: Hanya Admin yang dapat berganti cabang!');
            }
            return;
        }

        const targetIdStr = String(branchId);
        // Jika sudah aktif di cabang yang sama, tidak perlu aksi apa-apa
        if (targetIdStr === this.activeBranchId) {
            return;
        }

        const btn = document.getElementById('branch-selector-btn');
        const iconElem = document.getElementById('branch-selector-icon');

        // KASUS 1: Beralih kembali ke Cabang Lokal (ID = '0')
        if (targetIdStr === '0') {
            if (btn) btn.disabled = true;
            this.showSwitchLoading(this.localWarnetTitle + ' (Lokal)', 'Mengembalikan koneksi ke server database lokal...');

            try {
                if (API.branch && API.branch.switchContext) {
                    await API.branch.switchContext(0);
                }

                this.activeBranchId = '0';
                this.activeBranchName = this.localWarnetTitle;
                sessionStorage.setItem('active_branch_id', '0');
                sessionStorage.setItem('active_branch_name', this.localWarnetTitle);

                this.renderNavbarDropdown();
                this.updateBrandAndSidebarVisibility();
                this.removeActiveBranchBanner();

                this.updateSwitchStatus('Memuat ulang seluruh data PC, grup & transaksi lokal...');
                await this.refreshAllModulesAfterBranchSwitch();

                this.hideSwitchLoading();
                if (window.Toast) {
                    window.Toast.show(`Kembali ke ${this.localWarnetTitle} (Lokal)`, "info");
                }
            } catch (e) {
                console.warn('[BranchManager] Sync server context lokal warn:', e);
                this.hideSwitchLoading();
                if (window.Toast) {
                    window.Toast.show('Terjadi kendala saat memuat data lokal: ' + (e.message || e), 'warning');
                }
            } finally {
                if (btn) btn.disabled = false;
                this.renderNavbarDropdown();
            }
            return;
        }

        // KASUS 2: Beralih ke Cabang Remote (ID > '0')
        const targetBranch = this.branches.find(x => String(x.id) === targetIdStr);
        if (!targetBranch) {
            if (window.Toast) window.Toast.show("Cabang tujuan tidak ditemukan", "error");
            return;
        }

        // Tampilkan feedback visual & loading overlay saat menguji koneksi
        if (btn) btn.disabled = true;
        if (iconElem) {
            iconElem.className = 'w-2 h-2 rounded-full bg-amber-400 animate-ping';
        }

        this.showSwitchLoading(targetBranch.nama, 'Menguji koneksi & verifikasi kunci API cabang...');

        try {
            const res = await API.branch.switchContext(targetBranch.id);
            if (!res || !res.success) {
                // KONEKSI GAGAL: BATALKAN PERPINDAHAN CABANG!
                targetBranch.status_online = false;
                this.hideSwitchLoading();
                this.renderNavbarDropdown();
                if (window.Toast) {
                    window.Toast.show(res?.error || `Cabang '${targetBranch.nama}' tidak dapat terhubung. Pergantian cabang dibatalkan.`, "error");
                }
                return;
            }

            // KONEKSI BERHASIL: Siapkan data cabang remote
            targetBranch.status_online = true;
            this.activeBranchId = targetIdStr;
            this.activeBranchName = res.data?.branch_name || targetBranch.nama;
            sessionStorage.setItem('active_branch_id', this.activeBranchId);
            sessionStorage.setItem('active_branch_name', this.activeBranchName);

            this.renderNavbarDropdown();
            this.updateBrandAndSidebarVisibility();
            this.removeActiveBranchBanner();

            // Jika beralih ke cabang remote dan sedang membuka tab manajemen cabang/lokal, otomatis alihkan ke Dashboard
            if (window.App && ['branch', 'branch_inbound', 'branch_kasir', 'fileexplorer', 'tutorials'].includes(App.currentTab)) {
                App.switchTab('dash');
            }

            this.updateSwitchStatus('Menyinkronkan data PC, grup & transaksi cabang...');
            await this.refreshAllModulesAfterBranchSwitch();

            this.hideSwitchLoading();

            // Toast sukses HANYA dimunculkan setelah data 100% selesai di-fetch dan ter-render
            if (window.Toast) {
                window.Toast.show(`Berhasil beralih ke ${this.activeBranchName}`, "success");
            }

        } catch (err) {
            targetBranch.status_online = false;
            this.hideSwitchLoading();
            this.renderNavbarDropdown();
            if (window.Toast) {
                window.Toast.show(`Gagal terhubung ke ${targetBranch.nama}: ${err.message || 'Server offline'}`, "error");
            }
        } finally {
            if (btn) btn.disabled = false;
            this.renderNavbarDropdown();
        }
    },

    handleActiveBranchDisconnect() {
        if (this.activeBranchId === '0') return;

        const targetBranch = this.branches.find(b => String(b.id) === String(this.activeBranchId));
        if (targetBranch) {
            targetBranch.status_online = false;
        }

        const disconnectedName = this.activeBranchName;
        if (window.Toast) {
            window.Toast.show(`Koneksi ke cabang '${disconnectedName}' terputus. Mengembalikan kontrol panel ke Cabang Lokal...`, "warning");
        }

        // Failover aman kembali ke Cabang Lokal dengan perlindungan loading overlay
        this.switchBranch('0');
    },

    async refreshAllModulesAfterBranchSwitch() {
        // =====================================================================
        // REFRESH & RESET SELURUH DATA SISTEM KASIR SECARA MENYELURUH (0s DELAY)
        // =====================================================================
        try {
            // 1. Reset filter dan state modul-modul agar bersih dan tidak menyisakan data cabang lama
            if (typeof PC !== 'undefined' && typeof PC.resetFilters === 'function') PC.resetFilters();
            if (typeof Paket !== 'undefined' && typeof Paket.resetFilters === 'function') Paket.resetFilters();
            if (typeof Member !== 'undefined' && typeof Member.resetFilters === 'function') Member.resetFilters();
            if (typeof Menu !== 'undefined' && typeof Menu.resetState === 'function') Menu.resetState();
            if (typeof Laporan !== 'undefined' && typeof Laporan.resetFilters === 'function') Laporan.resetFilters();
            if (typeof LaporanMenu !== 'undefined' && typeof LaporanMenu.resetFilters === 'function') LaporanMenu.resetFilters();
            if (typeof Struk !== 'undefined' && typeof Struk.resetState === 'function') Struk.resetState();
            if (typeof Maintenance !== 'undefined' && typeof Maintenance.resetState === 'function') Maintenance.resetState();
            if (typeof LaporanMaintenance !== 'undefined' && typeof LaporanMaintenance.resetState === 'function') LaporanMaintenance.resetState();
            if (typeof Blackout !== 'undefined' && typeof Blackout.resetState === 'function') Blackout.resetState();
            if (typeof Screenshot !== 'undefined' && typeof Screenshot.resetState === 'function') Screenshot.resetState();

            // 2. Refresh Grup Sistem Global (opsi filter & dropdown di seluruh modal sinkron)
            if (typeof Grup !== 'undefined' && typeof Grup.load === 'function') {
                await Grup.load();
            }

            // 3. Selalu muat data Dashboard (PC dan grup) dengan grup bersih
            if (typeof Dashboard !== 'undefined') {
                Dashboard.activeGrup = 'semua';
                if (typeof Dashboard.load === 'function') {
                    await Dashboard.load();
                }
            }

            // 4. Muat ulang tab yang sedang aktif saat ini di layar pengguna
            if (typeof App !== 'undefined' && App.currentTab) {
                if (App.currentTab === 'settings' || App.currentTab.startsWith('settings_')) {
                    if (typeof Settings !== 'undefined') {
                        await Settings.load(true);
                    }
                } else if (App.currentTab === 'server_statistic') {
                    if (typeof ServerMonitor !== 'undefined') {
                        await ServerMonitor.fetchMetrics();
                        await ServerMonitor.checkLHMStatus();
                    }
                } else if (App.currentTab !== 'dash' && typeof App.loadTab === 'function') {
                    await App.loadTab(App.currentTab);
                }
            }
        } catch (err) {
            console.error('[BranchManager] Error saat sinkronisasi seluruh data cabang:', err);
        }
    },

};
