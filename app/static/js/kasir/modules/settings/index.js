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
                    <h3 class="text-xs font-bold text-neutral-200 uppercase tracking-wider">Backup Database</h3>
                    <button onclick="Modal.closeModal()" class="text-neutral-500 hover:text-neutral-300 text-xl leading-none">&times;</button>
                </div>
                <div class="space-y-3">
                    <button onclick="Settings.runServerBackup()" class="w-full p-4 bg-[#050505] hover:bg-[#121212] border border-[#1c1c1c] rounded text-left transition-colors">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-[#171717] border border-[#262626] text-neutral-300 rounded flex items-center justify-center font-mono font-bold">SV</div>
                            <div><div class="text-xs font-bold text-neutral-200 uppercase">Backup ke Server</div><div class="text-[10px] text-neutral-500 mt-0.5">Simpan di folder server</div></div>
                        </div>
                    </button>
                    <button onclick="Settings.runLocalBackup()" class="w-full p-4 bg-[#050505] hover:bg-[#121212] border border-[#1c1c1c] rounded text-left transition-colors">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-[#171717] border border-[#262626] text-neutral-300 rounded flex items-center justify-center font-mono font-bold">DL</div>
                            <div><div class="text-xs font-bold text-neutral-200 uppercase">Unduh Database</div><div class="text-[10px] text-neutral-500 mt-0.5">Download file database</div></div>
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
    }
};

window.Settings = Settings;
