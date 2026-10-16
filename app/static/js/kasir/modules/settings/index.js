// app/static/js/kasir/modules/settings/index.js
/**
 * Modul Settings terpadu untuk halaman Pengaturan Kasir TMBilling.
 * Menggabungkan sub-modul terfokus:
 * - SettingsGeneral: Profil warnet, CKEditor announcement, pembayaran, backup, dan timezone.
 * - SettingsScheduler: Penjadwalan backup otomatis, log cleanup, dan screenshot berkala.
 * - SettingsNetwork: Whitelist IP kasir & Cloudflare Tunnel auto-manager.
 */

const Settings = {
    currentSubTab: 'general',

    // Spread sub-modul domain ke dalam facade objek
    ...(window.SettingsGeneral || {}),
    ...(window.SettingsScheduler || {}),
    ...(window.SettingsNetwork || {}),

    async load(preserveSubTab = false) {
        // Tampilkan sub-tab default (Umum & Kiosk) segera agar halaman tidak kosong
        if (!preserveSubTab && !this.currentSubTab) {
            this.currentSubTab = 'general';
        }
        this.switchSubTab(this.currentSubTab);

        try {
            await this.initCKEditor();
            const res = await API.settings.getAll();
            if (res && res.success && res.settings) {
                const timerInput = document.getElementById('shutdown-timer');
                if (timerInput && res.settings.auto_shutdown_timer_seconds !== undefined) {
                    timerInput.value = res.settings.auto_shutdown_timer_seconds;
                }
                const pollingVal = res.settings.client_polling_interval_seconds !== undefined ? parseInt(res.settings.client_polling_interval_seconds, 10) : 5;
                this.selectPollingInterval(pollingVal);
                const tokenInput = document.getElementById('uninstall-token-input');
                if (tokenInput && res.settings.uninstall_token !== undefined) {
                    tokenInput.value = res.settings.uninstall_token;
                }
                const apiKeyInput = document.getElementById('client-apikey-input');
                if (apiKeyInput && res.settings.client_api_key !== undefined) {
                    apiKeyInput.value = res.settings.client_api_key;
                }
                if (res.settings.payment_methods !== undefined) {
                    this.currentPaymentMethods = res.settings.payment_methods.split(',').map(s => s.trim()).filter(s => s);
                    this.renderPaymentMethods();
                } else {
                    this.currentPaymentMethods = ["Tunai", "QRIS", "Transfer Bank"];
                    this.renderPaymentMethods();
                }
                const titleInput = document.getElementById('warnet-title-input');
                if (titleInput && res.settings.warnet_title !== undefined) {
                    titleInput.value = res.settings.warnet_title;
                }
                const addressInput = document.getElementById('warnet-address-input');
                if (addressInput && res.settings.warnet_address !== undefined) {
                    addressInput.value = res.settings.warnet_address;
                }
                const phoneInput = document.getElementById('warnet-phone-input');
                if (phoneInput && res.settings.warnet_phone !== undefined) {
                    phoneInput.value = res.settings.warnet_phone;
                }
                const footerInput = document.getElementById('warnet-footer-input');
                if (footerInput && res.settings.warnet_footer !== undefined) {
                    footerInput.value = res.settings.warnet_footer;
                }
                const gmapsInput = document.getElementById('warnet-gmaps-input');
                if (gmapsInput && res.settings.warnet_gmaps !== undefined) {
                    gmapsInput.value = res.settings.warnet_gmaps;
                    this.updateGmapsPreview();
                }
                const announcementVal = res.settings.warnet_announcement !== undefined ? res.settings.warnet_announcement : '';
                const announcementInput = document.getElementById('warnet-announcement-input');
                if (announcementInput) {
                    announcementInput.value = announcementVal;
                }
                if (this.ckeditorAnnouncementInstance) {
                    this.ckeditorAnnouncementInstance.setData(announcementVal);
                }
                const qrisPreview = document.getElementById('settings-qris-preview');
                if (qrisPreview && res.settings.qris_image_url !== undefined) {
                    qrisPreview.src = window.API ? API.resolveMediaUrl(res.settings.qris_image_url) : res.settings.qris_image_url;
                }

                // Load TV Signage Settings
                const tvRunningText = document.getElementById('tv-running-text');
                if (tvRunningText) {
                    tvRunningText.value = res.settings.tv_running_text !== undefined ? res.settings.tv_running_text : 'Selamat datang di TMBilling! Nikmati koneksi internet ultra cepat...';
                }

                const tvLanPreview = document.getElementById('tv-lan-url-preview');
                if (tvLanPreview) {
                    tvLanPreview.innerText = `${window.location.origin}/tv`;
                }

                // Load Timezone
                this._populateTimezoneSelect(res.settings.timezone);

                // Load Backup Settings toggles
                const providers = ['discord', 'webdav', 'gdrive', 'nas'];
                providers.forEach(p => {
                    const el = document.getElementById(`backup-${p}-enabled`);
                    if (el) {
                        el.checked = res.settings[`backup_${p}_enabled`] === 'true';
                    }
                });

                // Load Backup Settings input fields
                const inputs = {
                    'backup-discord-url': res.settings.backup_discord_webhook_url,
                    'backup-webdav-url': res.settings.backup_webdav_url,
                    'backup-webdav-user': res.settings.backup_webdav_username,
                    'backup-webdav-pass': res.settings.backup_webdav_password,
                    'backup-gdrive-client-id': res.settings.backup_gdrive_client_id,
                    'backup-gdrive-client-secret': res.settings.backup_gdrive_client_secret,
                    'backup-gdrive-refresh-token': res.settings.backup_gdrive_refresh_token,
                    'backup-gdrive-folder-id': res.settings.backup_gdrive_folder_id,
                    'backup-nas-path': res.settings.backup_nas_path
                };
                Object.keys(inputs).forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.value = inputs[id] || '';
                    }
                });

                // Load Auto Scheduler values
                const bVal = document.getElementById('scheduler-backup-value');
                const bUnit = document.getElementById('scheduler-backup-unit');
                const cVal = document.getElementById('scheduler-cleanup-value');
                const cUnit = document.getElementById('scheduler-cleanup-unit');
                const sEnabled = document.getElementById('scheduler-screenshot-enabled');
                const sVal = document.getElementById('scheduler-screenshot-value');
                const sUnit = document.getElementById('scheduler-screenshot-unit');

                if (bVal && res.settings.auto_backup_value !== undefined) bVal.value = res.settings.auto_backup_value;
                if (bUnit && res.settings.auto_backup_unit !== undefined) bUnit.value = res.settings.auto_backup_unit;
                if (cVal && res.settings.auto_cleanup_value !== undefined) cVal.value = res.settings.auto_cleanup_value;
                if (cUnit && res.settings.auto_cleanup_unit !== undefined) cUnit.value = res.settings.auto_cleanup_unit;

                if (sEnabled && res.settings.screenshot_auto_enabled !== undefined) {
                    sEnabled.checked = (res.settings.screenshot_auto_enabled === "1" || res.settings.screenshot_auto_enabled === "true");
                }
                if (sVal && res.settings.screenshot_auto_value !== undefined) sVal.value = res.settings.screenshot_auto_value;
                if (sUnit && res.settings.screenshot_auto_unit !== undefined) sUnit.value = res.settings.screenshot_auto_unit;

                // Set initial disabled state
                const sCfg = document.getElementById('scheduler-screenshot-config');
                if (sEnabled && sCfg) {
                    const toggleDisabled = () => {
                        const checked = sEnabled.checked;
                        sVal.disabled = !checked;
                        sUnit.disabled = !checked;
                        if (checked) {
                            sCfg.classList.remove('opacity-50');
                        } else {
                            sCfg.classList.add('opacity-50');
                        }
                    };
                    toggleDisabled();
                    sEnabled.addEventListener('change', toggleDisabled);
                }
                this._updateSchedulerPreview();

                // Bind live preview update
                ['scheduler-backup-value', 'scheduler-backup-unit', 'scheduler-cleanup-value', 'scheduler-cleanup-unit', 'scheduler-screenshot-enabled', 'scheduler-screenshot-value', 'scheduler-screenshot-unit'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.addEventListener('change', () => this._updateSchedulerPreview());
                });

                // Fetch local backup files table
                this.loadBackupFiles();
            }
        } catch (err) {
            console.error('[Settings] Gagal load settings:', err);
        }
    },


    refreshLive() {
        if (typeof App !== 'undefined' && App.currentTab !== 'settings') return;
        const isAppModalOpen = document.getElementById('app-modal') && !document.getElementById('app-modal').classList.contains('hidden');
        if (isAppModalOpen) return;
        if (this.currentSubTab === 'plugins' && typeof PluginsModule !== 'undefined' && typeof PluginsModule.refreshLive === 'function') {
            return PluginsModule.refreshLive();
        }
        if (this.currentSubTab === 'branches' && typeof BranchManager !== 'undefined' && typeof BranchManager.refreshLive === 'function') {
            return BranchManager.refreshLive();
        }
    },


    switchSubTab(subTab) {
        if (subTab) {
            this.currentSubTab = subTab;
        }
        document.querySelectorAll('.subnav-item').forEach(btn => {
            const onclick = btn.getAttribute('onclick') || '';
            if (onclick.includes(`'${this.currentSubTab}'`)) {
                btn.classList.add('bg-neutral-800', 'text-neutral-100', 'font-bold');
                btn.classList.remove('text-neutral-400', 'hover:text-neutral-100', 'hover:bg-[#121212]');
            } else {
                btn.classList.remove('bg-neutral-800', 'text-neutral-100', 'font-bold');
                btn.classList.add('text-neutral-400', 'hover:text-neutral-100', 'hover:bg-[#121212]');
            }
        });

        document.querySelectorAll('.subtab-content').forEach(el => el.classList.add('hidden'));
        const target = document.getElementById(`subtab-${this.currentSubTab}`);
        if (target) {
            target.classList.remove('hidden');
        }

        // Backup & Local files — fetch backup list
        if (this.currentSubTab === 'local_backup' || this.currentSubTab === 'cloud_backup' || this.currentSubTab === 'backup') {
            this.loadBackupFiles();
        }

        // Whitelist IP — render & load data
        if (this.currentSubTab === 'whitelist_ip') {
            this._renderWhitelistIP();
            this._loadWhitelistStatus();
        }

        // Cloudflare Tunnel — load status
        if (this.currentSubTab === 'cloudflare_tunnel') {
            this.loadCloudflareTunnelStatus();
        }

        // Migrasi & Update — init module
        if (this.currentSubTab === 'migration') {
            if (typeof MigrationModule !== 'undefined') {
                MigrationModule.init();
            }
        }

        // Multi-Cabang & API — init module
        if (this.currentSubTab === 'branch') {
            if (typeof BranchManager !== 'undefined') {
                BranchManager.loadMyBranchKey();
                BranchManager.renderBranchesSettingsTable();
            }
        }


    },

    toggleSubmenu() {
        const submenu = document.getElementById('settings-submenu');
        const arrow = document.getElementById('settings-arrow');
        if (submenu) {
            submenu.classList.toggle('hidden');
            if (arrow) {
                if (submenu.classList.contains('hidden')) {
                    arrow.classList.remove('rotate-180');
                } else {
                    arrow.classList.add('rotate-180');
                }
            }
        }
    },

};

window.Settings = Settings;
