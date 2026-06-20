const Settings = {
    async load() {
        console.log("[Settings] load() called");
        // Tampilkan sub-tab default (Umum & Kiosk) segera agar halaman tidak kosong
        this.switchSubTab('general');

        try {
            console.log("[Settings] Fetching settings...");
            const res = await API.settings.getAll();
            console.log("[Settings] API settings response:", res);
            if (res && res.success && res.settings) {
                const timerInput = document.getElementById('shutdown-timer');
                if (timerInput && res.settings.auto_shutdown_timer_seconds !== undefined) {
                    timerInput.value = res.settings.auto_shutdown_timer_seconds;
                }
                const tokenInput = document.getElementById('uninstall-token-input');
                if (tokenInput && res.settings.uninstall_token !== undefined) {
                    tokenInput.value = res.settings.uninstall_token;
                }
                const apiKeyInput = document.getElementById('client-apikey-input');
                if (apiKeyInput && res.settings.client_api_key !== undefined) {
                    apiKeyInput.value = res.settings.client_api_key;
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
                const announcementInput = document.getElementById('warnet-announcement-input');
                if (announcementInput && res.settings.warnet_announcement !== undefined) {
                    announcementInput.value = res.settings.warnet_announcement;
                }
                const qrisPreview = document.getElementById('settings-qris-preview');
                if (qrisPreview && res.settings.qris_image_url !== undefined) {
                    qrisPreview.src = res.settings.qris_image_url;
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
                if (bVal && res.settings.auto_backup_value !== undefined) bVal.value = res.settings.auto_backup_value;
                if (bUnit && res.settings.auto_backup_unit !== undefined) bUnit.value = res.settings.auto_backup_unit;
                if (cVal && res.settings.auto_cleanup_value !== undefined) cVal.value = res.settings.auto_cleanup_value;
                if (cUnit && res.settings.auto_cleanup_unit !== undefined) cUnit.value = res.settings.auto_cleanup_unit;
                this._updateSchedulerPreview();

                // Bind live preview update
                ['scheduler-backup-value','scheduler-backup-unit','scheduler-cleanup-value','scheduler-cleanup-unit'].forEach(id => {
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

    async saveAutoShutdown() {
        const val = document.getElementById('shutdown-timer').value;
        try {
            await API.settings.updateAutoShutdown(val);
            Toast.success('Pengaturan auto-shutdown disimpan');
        } catch (err) {
            Toast.error('Gagal menyimpan: ' + err.message);
        }
    },

    async saveUninstallToken() {
        const val = document.getElementById('uninstall-token-input').value;
        try {
            await API.request('/api/settings/uninstall_token', {
                method: 'PUT',
                body: JSON.stringify({ value: val })
            });
            Toast.success('Token uninstall client disimpan');
        } catch (err) {
            Toast.error('Gagal menyimpan token: ' + err.message);
        }
    },

    async saveClientApiKey() {
        const val = document.getElementById('client-apikey-input').value;
        if (!val.trim()) {
            Toast.error('API Key tidak boleh kosong');
            return;
        }
        try {
            await API.request('/api/settings/apikey', {
                method: 'PUT',
                body: JSON.stringify({ value: val })
            });
            Toast.success('API Key berhasil disimpan ke .env server');
        } catch (err) {
            Toast.error('Gagal menyimpan API Key: ' + err.message);
        }
    },

    async saveBackupToggle(key, el) {
        try {
            const val = el.checked ? 'true' : 'false';
            await API.request(`/api/settings/${key}`, {
                method: 'PUT',
                body: JSON.stringify({ value: val })
            });
            Toast.success('Status provider berhasil disimpan');
        } catch (err) {
            Toast.error('Gagal menyimpan status provider: ' + err.message);
            el.checked = !el.checked; // Revert
        }
    },

    async saveProviderConfig(provider) {
        let configs = {};
        if (provider === 'discord') {
            configs['backup_discord_webhook_url'] = document.getElementById('backup-discord-url').value;
        } else if (provider === 'webdav') {
            configs['backup_webdav_url'] = document.getElementById('backup-webdav-url').value;
            configs['backup_webdav_username'] = document.getElementById('backup-webdav-user').value;
            configs['backup_webdav_password'] = document.getElementById('backup-webdav-pass').value;
        } else if (provider === 'gdrive') {
            configs['backup_gdrive_client_id'] = document.getElementById('backup-gdrive-client-id').value;
            configs['backup_gdrive_client_secret'] = document.getElementById('backup-gdrive-client-secret').value;
            configs['backup_gdrive_refresh_token'] = document.getElementById('backup-gdrive-refresh-token').value;
            configs['backup_gdrive_folder_id'] = document.getElementById('backup-gdrive-folder-id').value;
        } else if (provider === 'nas') {
            configs['backup_nas_path'] = document.getElementById('backup-nas-path').value;
        }

        Toast.success('Menyimpan konfigurasi...');
        try {
            for (const key of Object.keys(configs)) {
                await API.request(`/api/settings/${key}`, {
                    method: 'PUT',
                    body: JSON.stringify({ value: configs[key] })
                });
            }
            Toast.success(`Konfigurasi ${provider.toUpperCase()} berhasil disimpan!`);
        } catch (err) {
            Toast.error('Gagal menyimpan konfigurasi: ' + err.message);
        }
    },

    async testProviderConnection(provider) {
        let payload = {};
        if (provider === 'discord') {
            payload['url'] = document.getElementById('backup-discord-url').value;
        } else if (provider === 'webdav') {
            payload['url'] = document.getElementById('backup-webdav-url').value;
            payload['username'] = document.getElementById('backup-webdav-user').value;
            payload['password'] = document.getElementById('backup-webdav-pass').value;
        } else if (provider === 'gdrive') {
            payload['client_id'] = document.getElementById('backup-gdrive-client-id').value;
            payload['client_secret'] = document.getElementById('backup-gdrive-client-secret').value;
            payload['refresh_token'] = document.getElementById('backup-gdrive-refresh-token').value;
            payload['folder_id'] = document.getElementById('backup-gdrive-folder-id').value;
        } else if (provider === 'nas') {
            payload['path'] = document.getElementById('backup-nas-path').value;
        }

        Toast.success(`Menguji koneksi ${provider.toUpperCase()}...`);
        try {
            const res = await API.request('/api/backup/test-connection', {
                method: 'POST',
                body: JSON.stringify({ provider, ...payload })
            });
            if (res.success) {
                Toast.success(res.message || 'Koneksi Berhasil!');
            } else {
                Toast.error(res.error || 'Koneksi Gagal!');
            }
        } catch (err) {
            Toast.error('Error saat tes koneksi: ' + err.message);
        }
    },

    async triggerBackupNow() {
        Toast.success('Mengeksekusi backup cloud & lokal...');
        try {
            const res = await API.request('/api/backup/trigger', { method: 'POST' });
            if (res.success) {
                Toast.success('Backup berhasil diselesaikan!');
                this.loadBackupFiles();
            }
        } catch (err) {
            Toast.error('Gagal melakukan backup: ' + err.message);
        }
    },

    async loadBackupFiles() {
        const tbody = document.getElementById('backup-files-table-body');
        if (!tbody) return;

        try {
            const res = await API.request('/api/backup/list');
            if (res.success) {
                if (res.backups.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-neutral-500">Tidak ada berkas backup di server.</td></tr>`;
                    return;
                }
                
                tbody.innerHTML = res.backups.map(b => `
                    <tr class="border-b border-[#1c1c1c] hover:bg-[#070707] transition-colors">
                        <td class="py-3 pr-2 text-neutral-200 text-xs lg:text-base font-bold">${b.filename}</td>
                        <td class="py-3 pr-2 text-neutral-400 text-[10px] lg:text-sm">${b.created_at}</td>
                        <td class="py-3 pr-2 text-neutral-400 text-xs lg:text-base">${b.size_mb} MB</td>
                        <td class="py-3 text-right space-x-2">
                            <button onclick="Settings.downloadBackup('${b.filename}')" class="px-2.5 py-1 bg-neutral-200 hover:bg-neutral-300 text-black text-[10px] lg:text-xs font-bold rounded transition-colors">Unduh</button>
                            <button onclick="Settings.deleteBackup('${b.filename}')" class="px-2.5 py-1 bg-red-950/40 hover:bg-red-900/40 border border-red-900/50 text-red-400 text-[10px] lg:text-xs font-bold rounded transition-colors">Hapus</button>
                        </td>
                    </tr>
                `).join('');
            }
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-red-500">Gagal memuat berkas: ${err.message}</td></tr>`;
        }
    },

    downloadBackup(filename) {
        window.location.href = `/api/backup/download/${filename}`;
    },

    async deleteBackup(filename) {
        if (!confirm(`Apakah Anda yakin ingin menghapus berkas backup "${filename}" secara permanen dari server?`)) {
            return;
        }
        try {
            const res = await API.request(`/api/backup/delete/${filename}`, { method: 'DELETE' });
            if (res.success) {
                Toast.success(res.message);
                this.loadBackupFiles();
            }
        } catch (err) {
            Toast.error('Gagal menghapus berkas: ' + err.message);
        }
    },

    previewQRIS(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const preview = document.getElementById('settings-qris-preview');
                if (preview) preview.src = e.target.result;
            };
            reader.readAsDataURL(input.files[0]);
        }
    },

    viewQRIS() {
        const preview = document.getElementById('settings-qris-preview');
        if (!preview || !preview.src) return;
        const modalHtml = `
            <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-4 max-w-lg w-full">
                <div class="flex items-center justify-between mb-4 pb-4 border-b border-[#1c1c1c]">
                    <h3 class="text-sm font-bold text-neutral-200 uppercase tracking-wider">Preview QRIS</h3>
                    <button onclick="Modal.closeModal()" class="text-neutral-500 hover:text-neutral-300 text-xl leading-none">&times;</button>
                </div>
                <div class="flex items-center justify-center">
                    <img src="${preview.src}" class="max-w-full max-h-[70vh] object-contain rounded" alt="QRIS Full Preview">
                </div>
            </div>`;
        Modal.show(modalHtml);
    },

    _populateTimezoneSelect(selected) {
        const select = document.getElementById('timezone-select');
        if (!select) return;

        const zones = [
            {value: 'Asia/Jakarta', label: 'WIB (UTC+7) — Jakarta, Sumatra, Jawa'},
            {value: 'Asia/Makassar', label: 'WITA (UTC+8) — Makassar, Bali, Sulawesi'},
            {value: 'Asia/Jayapura', label: 'WIT (UTC+9) — Jayapura, Maluku, Papua'},
            {value: 'Asia/Kuala_Lumpur', label: 'MYT (UTC+8) — Malaysia'},
            {value: 'Asia/Singapore', label: 'SGT (UTC+8) — Singapore'},
            {value: 'Asia/Ho_Chi_Minh', label: 'ICT (UTC+7) — Vietnam'},
            {value: 'Asia/Bangkok', label: 'ICT (UTC+7) — Thailand'},
            {value: 'Asia/Manila', label: 'PHT (UTC+8) — Philippines'},
            {value: 'Europe/London', label: 'GMT/BST (UTC+0/1) — UK'},
            {value: 'Europe/Berlin', label: 'CET/CEST (UTC+1/2) — Germany'},
            {value: 'America/New_York', label: 'EST/EDT (UTC-5/4) — New York'},
            {value: 'Asia/Tokyo', label: 'JST (UTC+9) — Japan'},
            {value: 'Australia/Sydney', label: 'AEST/AEDT (UTC+10/11) — Sydney'},
        ];

        select.innerHTML = zones.map(z =>
            `<option value="${z.value}" ${z.value === (selected || 'Asia/Makassar') ? 'selected' : ''}>${z.label}</option>`
        ).join('');
    },

    async saveTimezone() {
        const val = document.getElementById('timezone-select').value;
        try {
            await API.request('/api/settings/timezone', {
                method: 'PUT',
                body: JSON.stringify({ value: val })
            });
            Toast.success('Timezone berhasil diperbarui');
        } catch (err) {
            Toast.error('Gagal menyimpan timezone: ' + err.message);
        }
    },

    // ------------------------------------------------------------------
    // AUTO SCHEDULER SUB-TAB
    // ------------------------------------------------------------------

    _updateSchedulerPreview() {
        const bVal = document.getElementById('scheduler-backup-value')?.value || '60';
        const bUnit = document.getElementById('scheduler-backup-unit')?.value || 'menit';
        const cVal = document.getElementById('scheduler-cleanup-value')?.value || '30';
        const cUnit = document.getElementById('scheduler-cleanup-unit')?.value || 'hari';
        document.getElementById('scheduler-backup-preview').innerHTML = `Backup otomatis setiap <strong class="text-neutral-300">${bVal} ${bUnit}</strong>`;
        document.getElementById('scheduler-cleanup-preview').innerHTML = `Hapus log lebih dari <strong class="text-neutral-300">${cVal} ${cUnit}</strong>`;
    },

    async saveSchedulerConfig() {
        const backupValue = document.getElementById('scheduler-backup-value')?.value;
        const backupUnit = document.getElementById('scheduler-backup-unit')?.value;
        const cleanupValue = document.getElementById('scheduler-cleanup-value')?.value;
        const cleanupUnit = document.getElementById('scheduler-cleanup-unit')?.value;

        if (!backupValue || !cleanupValue) {
            Toast.error('Semua field wajib diisi');
            return;
        }

        Toast.success('Menyimpan konfigurasi scheduler...');
        try {
            const res = await API.request('/api/settings/scheduler', {
                method: 'PUT',
                body: JSON.stringify({
                    backup_value: parseInt(backupValue),
                    backup_unit: backupUnit,
                    cleanup_value: parseInt(cleanupValue),
                    cleanup_unit: cleanupUnit
                })
            });

            if (res.success) {
                Toast.success('Konfigurasi disimpan! Merestart aplikasi...');

                // Tampilkan overlay loading
                const overlay = document.createElement('div');
                overlay.id = 'scheduler-restart-overlay';
                overlay.className = 'fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center';
                overlay.innerHTML = `<div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded-xl p-8 text-center max-w-sm">
                    <div class="text-4xl mb-4 animate-pulse">🔄</div>
                    <h3 class="text-lg font-bold text-neutral-200 mb-2">Menerapkan Perubahan</h3>
                    <p class="text-sm text-neutral-400">Server restart, halaman akan dimuat ulang...</p>
                </div>`;
                document.body.appendChild(overlay);

                // Trigger restart endpoint — error koneksi diharapkan karena server mati
                try {
                    await API.request('/api/settings/scheduler/restart', { method: 'POST' });
                } catch (_) {
                    // Expected — server restart memutus koneksi
                }

                // Reload page setelah jeda biar server baru sempat start
                setTimeout(() => window.location.reload(), 3000);
                return;
            }
        } catch (err) {
            Toast.error('Gagal menyimpan scheduler: ' + err.message);
        }
    },

    async saveKioskSettings() {
        const title = document.getElementById('warnet-title-input').value;
        const address = document.getElementById('warnet-address-input').value;
        const phone = document.getElementById('warnet-phone-input').value;
        const footer = document.getElementById('warnet-footer-input').value;
        const announcement = document.getElementById('warnet-announcement-input').value;
        const qrisFileInput = document.getElementById('qris-file-input');

        Toast.success('Menyimpan pengaturan Kiosk...');
        try {
            // 1. Simpan judul
            await API.request('/api/settings/warnet_title', {
                method: 'PUT',
                body: JSON.stringify({ value: title })
            });

            // 2. Simpan alamat warnet
            await API.request('/api/settings/warnet_address', {
                method: 'PUT',
                body: JSON.stringify({ value: address })
            });

            // 3. Simpan nomor telepon
            await API.request('/api/settings/warnet_phone', {
                method: 'PUT',
                body: JSON.stringify({ value: phone })
            });

            // 4. Simpan pesan kaki struk
            await API.request('/api/settings/warnet_footer', {
                method: 'PUT',
                body: JSON.stringify({ value: footer })
            });

            // 5. Simpan pengumuman
            await API.request('/api/settings/warnet_announcement', {
                method: 'PUT',
                body: JSON.stringify({ value: announcement })
            });
            
            // 3. Upload QRIS jika ada file yang dipilih
            if (qrisFileInput.files && qrisFileInput.files[0]) {
                const formData = new FormData();
                formData.append('qris_image', qrisFileInput.files[0]);
                
                const uploadRes = await API.request('/api/settings/qris', {
                    method: 'POST',
                    body: formData
                });
                
                if (uploadRes.qris_url) {
                    const preview = document.getElementById('settings-qris-preview');
                    if (preview) preview.src = uploadRes.qris_url;
                }
            }
            
            Toast.success('Pengaturan Kiosk berhasil disimpan');
            await this.load(); // Refresh data
        } catch (err) {
            Toast.error('Gagal menyimpan pengaturan Kiosk: ' + err.message);
        }
    },

    switchSubTab(subTab) {
        console.log("[Settings] switchSubTab called for:", subTab);
        document.querySelectorAll('.subnav-item').forEach(btn => {
            const onclick = btn.getAttribute('onclick') || '';
            if (onclick.includes(`'${subTab}'`)) {
                btn.classList.add('bg-neutral-800', 'text-neutral-100', 'font-bold');
                btn.classList.remove('text-neutral-400', 'hover:text-neutral-100', 'hover:bg-[#121212]');
            } else {
                btn.classList.remove('bg-neutral-800', 'text-neutral-100', 'font-bold');
                btn.classList.add('text-neutral-400', 'hover:text-neutral-100', 'hover:bg-[#121212]');
            }
        });

        document.querySelectorAll('.subtab-content').forEach(el => el.classList.add('hidden'));
        const target = document.getElementById(`subtab-${subTab}`);
        console.log("[Settings] switchSubTab target element:", target);
        if (target) {
            target.classList.remove('hidden');
            console.log("[Settings] switchSubTab target visible now, classes:", target.className);
        }

        // Whitelist IP — render & load data
        if (subTab === 'whitelist_ip') {
            this._renderWhitelistIP();
            this._loadWhitelistStatus();
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

    // ------------------------------------------------------------------
    // WHITELIST IP SUB-TAB
    // ------------------------------------------------------------------

    _renderWhitelistIP() {
        const target = document.getElementById('subtab-whitelist_ip');
        if (!target) return;
        if (target.dataset.rendered === 'true') return;
        target.dataset.rendered = 'true';

        target.innerHTML = `
        <div class="space-y-5">
            <!-- Status Toggle Card -->
            <div class="bg-[#050505] border border-[#1c1c1c] rounded-xl p-4 lg:p-5">
                <div class="flex items-center justify-between gap-4">
                    <div>
                        <p class="font-bold text-neutral-200 text-sm lg:text-base">Status Whitelist IP</p>
                        <p class="text-[10px] lg:text-xs text-neutral-500 mt-0.5">Lindungi dashboard dari akses IP tidak dikenal</p>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer shrink-0">
                        <input type="checkbox" id="wlToggle" class="sr-only peer" onchange="Settings._wlToggle(this.checked)">
                        <div class="w-10 h-5 lg:w-11 lg:h-6 bg-neutral-700 peer-checked:bg-emerald-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 lg:after:h-5 lg:after:w-5 after:transition-all"></div>
                    </label>
                </div>
            </div>

            <!-- Remote Access Card -->
            <div class="bg-[#050505] border border-[#1c1c1c] rounded-xl p-4 lg:p-5">
                <h3 class="font-bold text-neutral-200 text-sm lg:text-base mb-3">🔗 Akses dari HP / Remote (via Tunnel)</h3>
                <div class="mb-4">
                    <label class="text-[9px] lg:text-xs text-neutral-500 uppercase font-bold block mb-1">Domain Publik</label>
                    <div class="flex gap-2">
                        <input type="text" id="wlPublicUrl" placeholder="https://tmbilling.example.com"
                            class="flex-1 bg-[#0a0a0a] border border-[#1c1c1c] rounded px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-400 transition-colors">
                        <button onclick="Settings._wlSavePublicUrl()"
                            class="px-4 py-2 bg-neutral-800 border border-[#1c1c1c] rounded text-sm text-neutral-300 hover:bg-neutral-700 transition-colors font-semibold">Simpan</button>
                    </div>
                </div>
                <div class="bg-[#0a0a0a] border border-[#1c1c1c] rounded-lg overflow-hidden">
                    <div class="flex flex-col lg:flex-row">
                        <div class="p-4 flex items-center justify-center border-b lg:border-b-0 lg:border-r border-[#1c1c1c] bg-white">
                            <div id="wlQRCode" class="w-[140px] h-[140px] lg:w-[180px] lg:h-[180px]"></div>
                        </div>
                        <div class="p-4 flex-1 flex flex-col justify-center gap-3">
                            <div>
                                <p class="text-[9px] lg:text-xs text-neutral-500 uppercase font-bold mb-1">URL Token</p>
                                <div class="flex items-center gap-2">
                                    <code id="wlUrlDisplay" class="flex-1 bg-[#050505] border border-[#1c1c1c] rounded px-3 py-2 text-xs lg:text-sm text-neutral-300 font-mono break-all">-</code>
                                    <button onclick="Settings._wlCopyUrl()" class="shrink-0 px-3 py-2 bg-neutral-800 border border-[#1c1c1c] rounded text-sm text-neutral-300 hover:bg-neutral-700 transition-colors">📋</button>
                                </div>
                            </div>
                            <div class="text-[9px] lg:text-xs text-neutral-500">Token: <code id="wlTokenMasked" class="font-mono text-neutral-400">-</code></div>
                        </div>
                    </div>
                </div>
                <button onclick="Settings._wlRegenerate()" class="mt-4 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400 hover:bg-red-500/20 transition-colors font-bold">🔄 Regenerate Token</button>
                <p class="text-[9px] lg:text-xs text-neutral-600 mt-1">⚠️ Token lama jadi invalid. Semua sesi HP yang sedang aktif akan logout otomatis.</p>
            </div>

            <!-- Daftar IP Card -->
            <div class="bg-[#050505] border border-[#1c1c1c] rounded-xl p-4 lg:p-5">
                <h3 class="font-bold text-neutral-200 text-sm lg:text-base mb-3">📋 Daftar IP (<span id="wlCount">0</span>)</h3>
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-xs lg:text-sm">
                        <thead class="text-[9px] lg:text-xs text-neutral-500 uppercase border-b border-[#1c1c1c]">
                            <tr><th class="pb-2 font-bold">IP Address</th><th class="pb-2 font-bold hidden sm:table-cell">Label</th><th class="pb-2 font-bold hidden md:table-cell">Ditambahkan</th><th class="pb-2 font-bold text-right"></th></tr>
                        </thead>
                        <tbody id="wlTableBody"></tbody>
                    </table>
                </div>
                <div id="wlEmpty" class="text-center py-8 text-neutral-500 text-sm hidden">Belum ada IP.</div>
            </div>

            <!-- Tambah IP -->
            <div class="bg-[#050505] border border-[#1c1c1c] rounded-xl p-4 lg:p-5">
                <h3 class="font-bold text-neutral-200 text-sm lg:text-base mb-3">➕ Tambah IP Baru</h3>
                <div class="flex flex-col sm:flex-row gap-2">
                    <input type="text" id="wlNewIp" placeholder="192.168.1.30"
                        class="flex-1 bg-[#0a0a0a] border border-[#1c1c1c] rounded px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-400 font-mono">
                    <input type="text" id="wlNewLabel" placeholder="Label (opsional)"
                        class="sm:w-48 bg-[#0a0a0a] border border-[#1c1c1c] rounded px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none">
                    <button onclick="Settings._wlAddIp()" class="px-5 py-2 bg-neutral-800 border border-[#1c1c1c] rounded text-sm text-neutral-200 hover:bg-neutral-700 font-bold shrink-0">Tambah</button>
                </div>
            </div>
        </div>`;
    },

    async _wlFetch(method, path, body) {
        const headers = { 'Content-Type': 'application/json' };
        const csrfMeta = document.querySelector('meta[name="csrf-token"]');
        if (csrfMeta) headers['X-CSRFToken'] = csrfMeta.content;
        const opts = { method, headers };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(path, opts);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            throw new Error(err.error || 'Request failed');
        }
        return res.json();
    },

    async _loadWhitelistStatus() {
        try {
            const data = await this._wlFetch('GET', '/api/settings/ip-whitelist/status');
            const toggle = document.getElementById('wlToggle');
            if (toggle) toggle.checked = data.enabled;
            document.getElementById('wlUrlDisplay').textContent = data.full_url || '-';
            document.getElementById('wlTokenMasked').textContent = data.token_masked || '-';
            const urlInput = document.getElementById('wlPublicUrl');
            if (urlInput) urlInput.value = data.public_url || '';
            this._wlRenderQR(data.full_url);
            await this._wlRefreshList();
        } catch (e) { /* status not critical */ }
    },

    _wlRenderQR(url) {
        const c = document.getElementById('wlQRCode');
        if (!c) return;
        c.innerHTML = '';
        if (!url || url === '-') return;
        try {
            new QRCode(c, { text: url, width: 140, height: 140, colorDark: '#000000', colorLight: '#ffffff' });
        } catch (e) {}
    },

    async _wlRefreshList() {
        try {
            const data = await this._wlFetch('GET', '/api/settings/ip-whitelist');
            const entries = data.entries || [];
            document.getElementById('wlCount').textContent = entries.length;
            const tbody = document.getElementById('wlTableBody');
            const empty = document.getElementById('wlEmpty');
            if (entries.length === 0) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
            empty.classList.add('hidden');
            tbody.innerHTML = entries.map(e => {
                const d = e.added_at ? e.added_at.substring(0, 10) : '-';
                return `<tr class="border-b border-[#1c1c1c]/40">
                    <td class="py-2.5 font-mono text-neutral-200">${this._esc(e.ip)}</td>
                    <td class="py-2.5 text-neutral-400 hidden sm:table-cell">${this._esc(e.label || '-')}</td>
                    <td class="py-2.5 text-neutral-500 text-xs hidden md:table-cell">${d}</td>
                    <td class="py-2.5 text-right"><button onclick="Settings._wlRemove('${this._esc(e.ip)}')" class="text-red-400 hover:text-red-300 text-xs px-2">🗑</button></td>
                </tr>`;
            }).join('');
        } catch (e) {}
    },

    async _wlAddIp() {
        const ip = document.getElementById('wlNewIp').value.trim();
        if (!ip) { alert('Masukkan IP address.'); return; }
        const label = document.getElementById('wlNewLabel').value.trim();
        try {
            await this._wlFetch('POST', '/api/settings/ip-whitelist', { ip, label });
            document.getElementById('wlNewIp').value = '';
            document.getElementById('wlNewLabel').value = '';
            await this._wlRefreshList();
        } catch (e) {}
    },

    async _wlRemove(ip) {
        if (!confirm(`Hapus ${ip}?`)) return;
        try { await this._wlFetch('DELETE', `/api/settings/ip-whitelist/${ip}`); await this._wlRefreshList(); } catch (e) {}
    },

    async _wlToggle(enabled) {
        try { await this._wlFetch('POST', '/api/settings/ip-whitelist/toggle', { enabled }); } catch (e) { document.getElementById('wlToggle').checked = !enabled; }
    },

    async _wlRegenerate() {
        if (!confirm('Regenerate token? Token lama akan invalidate semua sesi yang sedang aktif.')) return;
        try {
            const data = await this._wlFetch('POST', '/api/settings/ip-whitelist/regenerate-token');
            alert('Token baru: ' + data.token);
            await this._loadWhitelistStatus();
        } catch (e) {}
    },

    async _wlSavePublicUrl() {
        const url = document.getElementById('wlPublicUrl').value.trim();
        try { await this._wlFetch('POST', '/api/settings/app-public-url', { url }); await this._loadWhitelistStatus(); } catch (e) {}
    },

    _wlCopyUrl() {
        const el = document.getElementById('wlUrlDisplay');
        const text = el ? (el.textContent || '') : '';
        if (!text || text === '-') {
            alert('URL token belum tersedia.');
            return;
        }
        try {
            navigator.clipboard.writeText(text);
            Toast.success('URL token disalin!');
        } catch (e) {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            alert('URL token disalin!');
        }
    },

    _esc(s) {
        if (!s) return '';
        const d = document.createElement('div');
        d.appendChild(document.createTextNode(s));
        return d.innerHTML;
    }
};

window.Settings = Settings;
console.log("[Settings] index.js loaded");
