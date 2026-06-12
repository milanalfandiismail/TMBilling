const Settings = {
    async load() {
        try {
            const res = await API.settings.getAll();
            if (res.success) {
                const timerInput = document.getElementById('shutdown-timer');
                if (timerInput && res.settings.auto_shutdown_timer_seconds) {
                    timerInput.value = res.settings.auto_shutdown_timer_seconds;
                }
                const tokenInput = document.getElementById('uninstall-token-input');
                if (tokenInput && res.settings.uninstall_token) {
                    tokenInput.value = res.settings.uninstall_token;
                }
                const apiKeyInput = document.getElementById('client-apikey-input');
                if (apiKeyInput && res.settings.client_api_key) {
                    apiKeyInput.value = res.settings.client_api_key;
                }
                const titleInput = document.getElementById('warnet-title-input');
                if (titleInput && res.settings.warnet_title) {
                    titleInput.value = res.settings.warnet_title;
                }
                const announcementInput = document.getElementById('warnet-announcement-input');
                if (announcementInput && res.settings.warnet_announcement) {
                    announcementInput.value = res.settings.warnet_announcement;
                }
                const qrisPreview = document.getElementById('settings-qris-preview');
                if (qrisPreview && res.settings.qris_image_url) {
                    qrisPreview.src = res.settings.qris_image_url;
                }
            }
        } catch (err) {
            console.error('Gagal load settings:', err);
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


    openBackupModal() {
        const modalHtml = `
            <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-6 max-w-md w-full">
                <div class="flex items-center justify-between mb-4 pb-4 border-b border-[#1c1c1c]">
                    <h3 class="text-xs lg:text-base font-bold text-neutral-200 uppercase tracking-wider">Backup Database</h3>
                    <button onclick="Modal.closeModal()" class="text-neutral-500 hover:text-neutral-300 text-xl leading-none">&times;</button>
                </div>
                <div class="space-y-3">
                    <button onclick="Settings.runServerBackup()" class="w-full p-4 bg-[#050505] hover:bg-[#121212] border border-[#1c1c1c] rounded text-left transition-colors">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-[#171717] border border-[#262626] text-neutral-300 rounded flex items-center justify-center font-mono font-bold">SV</div>
                            <div><div class="text-xs lg:text-base font-bold text-neutral-200 uppercase">Backup ke Server</div><div class="text-[10px] lg:text-base text-neutral-500 mt-0.5">Simpan di folder server</div></div>
                        </div>
                    </button>
                    <button onclick="Settings.runLocalBackup()" class="w-full p-4 bg-[#050505] hover:bg-[#121212] border border-[#1c1c1c] rounded text-left transition-colors">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-[#171717] border border-[#262626] text-neutral-300 rounded flex items-center justify-center font-mono font-bold">DL</div>
                            <div><div class="text-xs lg:text-base font-bold text-neutral-200 uppercase">Unduh Database</div><div class="text-[10px] lg:text-base text-neutral-500 mt-0.5">Download file database</div></div>
                        </div>
                    </button>
                </div>
            </div>`;
        Modal.show(modalHtml);
    },

    closeBackupModal() { Modal.closeModal(); },

    async runServerBackup() {
        this.closeBackupModal();
        Toast.success('Menginisialisasi backup...');
        try {
            await API.settings.manualBackup();
            Toast.success('Database berhasil dicadangkan');
        } catch (err) {
            Toast.error('Gagal: ' + err.message);
        }
    },

    runLocalBackup() {
        this.closeBackupModal();
        window.location.href = '/api/settings/backup/download';
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
    }
};

window.Settings = Settings;
