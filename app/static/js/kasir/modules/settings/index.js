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
                const announcementInput = document.getElementById('warnet-announcement-input');
                if (announcementInput && res.settings.warnet_announcement !== undefined) {
                    announcementInput.value = res.settings.warnet_announcement;
                }
                const qrisPreview = document.getElementById('settings-qris-preview');
                if (qrisPreview && res.settings.qris_image_url !== undefined) {
                    qrisPreview.src = res.settings.qris_image_url;
                }

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

    async saveKioskSettings() {
        const title = document.getElementById('warnet-title-input').value;
        const announcement = document.getElementById('warnet-announcement-input').value;
        const qrisFileInput = document.getElementById('qris-file-input');
        
        Toast.success('Menyimpan pengaturan Kiosk...');
        try {
            // 1. Simpan judul
            await API.request('/api/settings/warnet_title', {
                method: 'PUT',
                body: JSON.stringify({ value: title })
            });
            
            // 2. Simpan pengumuman
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
    }
};

window.Settings = Settings;
console.log("[Settings] index.js loaded");
