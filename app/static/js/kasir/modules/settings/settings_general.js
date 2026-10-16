// app/static/js/kasir/modules/settings/settings_general.js
/**
 * Sub-modul SettingsGeneral untuk pengaturan umum toko/warnet, kiosk,
 * metode pembayaran, CKEditor, TV signage, timezone, dan backup database.
 */

const SettingsGeneral = {
    selectedPollingInterval: 5,
    ckeditorAnnouncementInstance: null,
    currentPaymentMethods: ['Tunai', 'QRIS', 'Transfer Bank'],

    async initCKEditor() {
        if (typeof ckeditor5 !== 'undefined') {
            window.ClassicEditor = ckeditor5.ClassicEditor;
        }
        if (typeof ClassicEditor === 'undefined') return;

        const editorEl = document.querySelector('#warnet-announcement-editor');
        if (!editorEl || this.ckeditorAnnouncementInstance) return;

        try {
            const plugins = typeof ckeditor5 !== 'undefined' ? [
                ckeditor5.Essentials, ckeditor5.Paragraph, ckeditor5.Heading,
                ckeditor5.Bold, ckeditor5.Italic, ckeditor5.Underline, ckeditor5.Strikethrough,
                ckeditor5.Alignment, ckeditor5.FontColor, ckeditor5.FontBackgroundColor,
                ckeditor5.FontSize, ckeditor5.FontFamily, ckeditor5.Highlight,
                ckeditor5.Link, ckeditor5.List, ckeditor5.TodoList,
                ckeditor5.Indent, ckeditor5.IndentBlock, ckeditor5.BlockQuote, ckeditor5.CodeBlock,
                ckeditor5.Undo
            ] : [];

            this.ckeditorAnnouncementInstance = await ClassicEditor.create(editorEl, {
                plugins: plugins,
                toolbar: {
                    items: [
                        'heading', '|',
                        'bold', 'italic', 'underline', 'strikethrough', 'highlight', '|',
                        'fontSize', 'fontFamily', 'fontColor', 'fontBackgroundColor', '|',
                        'alignment', 'link', 'bulletedList', 'numberedList', 'outdent', 'indent', '|',
                        'blockQuote', '|',
                        'undo', 'redo'
                    ],
                    shouldNotGroupWhenFull: true
                },
                placeholder: 'Tulis aturan atau pengumuman warnet di sini...',
                fontSize: {
                    options: [10, 12, 14, 'default', 18, 20, 24, 28, 32, 36, 48, 64],
                    supportAllValues: true
                },
                fontFamily: {
                    options: [
                        'default',
                        'Space Grotesk, sans-serif',
                        'Inter, sans-serif',
                        'Roboto, sans-serif',
                        'Arial, Helvetica, sans-serif',
                        'Courier New, Courier, monospace',
                        'Impact, sans-serif'
                    ],
                    supportAllValues: true
                }
            });

            const initialVal = document.getElementById('warnet-announcement-input')?.value || '';
            if (initialVal && this.ckeditorAnnouncementInstance) {
                this.ckeditorAnnouncementInstance.setData(initialVal);
            }
        } catch (e) {
            console.error('Gagal inisialisasi CKEditor di Settings:', e);
        }
    },
    async saveAutoShutdown() {
        const rawVal = document.getElementById('shutdown-timer')?.value;
        const val = parseInt(rawVal, 10);
        if (isNaN(val) || val < 30 || val > 600) {
            Toast.error('Timer auto-shutdown harus antara 30 s/d 600 detik (10 menit)');
            return;
        }
        try {
            await API.settings.updateAutoShutdown(val);
            Toast.success('Pengaturan auto-shutdown disimpan');
        } catch (err) {
            Toast.error('Gagal menyimpan: ' + err.message);
        }
    },

    switchGeneralMobileView(view) {
        const colOp = document.getElementById('general-col-operasional');
        const colSec = document.getElementById('general-col-keamanan');
        const pillOp = document.getElementById('general-mobile-pill-operasional');
        const pillSec = document.getElementById('general-mobile-pill-keamanan');

        if (!colOp || !colSec) return;

        if (view === 'keamanan') {
            colOp.classList.add('hidden');
            colSec.classList.remove('hidden');

            if (pillOp && pillSec) {
                pillOp.className = 'flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 text-neutral-400 hover:text-neutral-200';
                pillSec.className = 'flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 bg-neutral-200 text-black shadow-sm';
            }
        } else {
            colOp.classList.remove('hidden');
            colSec.classList.add('hidden');

            if (pillOp && pillSec) {
                pillOp.className = 'flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 bg-neutral-200 text-black shadow-sm';
                pillSec.className = 'flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 text-neutral-400 hover:text-neutral-200';
            }
        }
    },

    toggleApiKeyVisibility() {
        const input = document.getElementById('client-apikey-input');
        const icon = document.querySelector('#btn-toggle-apikey-eye i');
        if (!input) return;

        if (input.type === 'password') {
            input.type = 'text';
            if (icon) {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            }
        } else {
            input.type = 'password';
            if (icon) {
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        }
    },

    async copyClientApiKey() {
        const input = document.getElementById('client-apikey-input');
        if (!input || !input.value) {
            Toast.error('API Key kosong, tidak ada yang dapat disalin');
            return;
        }
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(input.value);
            } else {
                input.select();
                document.execCommand('copy');
            }
            Toast.success('API Key berhasil disalin ke clipboard');
        } catch (err) {
            Toast.error('Gagal menyalin API Key: ' + err.message);
        }
    },

    selectPollingInterval(val, autoSave = false) {
        val = parseInt(val, 10);
        if (![1, 5, 10].includes(val)) {
            val = 5;
        }
        this.selectedPollingInterval = val;
        [1, 5, 10].forEach(opt => {
            const btn = document.getElementById(`polling-interval-btn-${opt}`);
            if (!btn) return;
            const indicator = btn.querySelector('.polling-indicator');
            if (opt === val) {
                btn.classList.add('border-emerald-500/80', 'bg-emerald-950/20', 'ring-1', 'ring-emerald-500/50');
                btn.classList.remove('border-[#222]', 'bg-[#080808]');
                if (indicator) {
                    indicator.classList.add('bg-emerald-400', 'shadow-[0_0_8px_rgba(52,211,153,0.8)]');
                    indicator.classList.remove('bg-neutral-600');
                }
            } else {
                btn.classList.remove('border-emerald-500/80', 'bg-emerald-950/20', 'ring-1', 'ring-emerald-500/50');
                btn.classList.add('border-[#222]', 'bg-[#080808]');
                if (indicator) {
                    indicator.classList.remove('bg-emerald-400', 'shadow-[0_0_8px_rgba(52,211,153,0.8)]');
                    indicator.classList.add('bg-neutral-600');
                }
            }
        });

        if (autoSave === true) {
            this.saveClientPollingInterval();
        }
    },

    async saveClientPollingInterval() {
        const val = this.selectedPollingInterval || 5;
        if (![1, 5, 10].includes(val)) {
            Toast.error('Interval polling client hanya boleh bernilai 1, 5, atau 10 detik');
            return;
        }
        try {
            await API.settings.updateClientPollingInterval(val);
            Toast.success(`Interval polling client berhasil disetel ke ${val} detik`);
        } catch (err) {
            Toast.error('Gagal menyimpan interval polling: ' + err.message);
        }
    },

    async saveUninstallToken() {
        const val = document.getElementById('uninstall-token-input').value;
        try {
            await API.request('/api/v1/kasir/settings/uninstall_token', {
                method: 'PUT',
                body: JSON.stringify({ value: val })
            });
            Toast.success('Token uninstall client disimpan');
        } catch (err) {
            Toast.error('Gagal menyimpan token: ' + err.message);
        }
    },

    async savePaymentMethods() {
        const val = (this.currentPaymentMethods || []).join(',');
        try {
            await API.request('/api/v1/kasir/settings/payment_methods', {
                method: 'PUT',
                body: JSON.stringify({ value: val })
            });
            Toast.success('Metode pembayaran berhasil disimpan');
        } catch (err) {
            Toast.error('Gagal menyimpan metode pembayaran: ' + err.message);
        }
    },

    renderPaymentMethods() {
        const listEl = document.getElementById('payment-methods-list');
        if (!listEl) return;

        if (!this.currentPaymentMethods || this.currentPaymentMethods.length === 0) {
            listEl.innerHTML = `<li class="px-4 py-3 text-sm text-neutral-500 text-center italic">Belum ada metode pembayaran</li>`;
            return;
        }

        listEl.innerHTML = this.currentPaymentMethods.map((method, index) => `
            <li class="flex items-center justify-between px-4 py-2 hover:bg-[#0a0a0a] transition-colors">
                <span class="text-xs lg:text-base text-neutral-200 font-bold">${method}</span>
                <button onclick="Settings.removePaymentMethod(${index})" class="text-red-500 hover:text-red-400 p-1" title="Hapus">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                    </svg>
                </button>
            </li>
        `).join('');
    },

    addPaymentMethod() {
        const inputEl = document.getElementById('new-payment-method-input');
        if (!inputEl) return;

        const val = inputEl.value.trim();
        if (!val) return;

        if (!this.currentPaymentMethods) this.currentPaymentMethods = [];

        // Cek duplikat (case insensitive)
        const exists = this.currentPaymentMethods.some(m => m.toLowerCase() === val.toLowerCase());
        if (exists) {
            Toast.error('Metode pembayaran sudah ada');
            return;
        }

        this.currentPaymentMethods.push(val);
        inputEl.value = '';
        this.renderPaymentMethods();
    },

    removePaymentMethod(index) {
        if (!this.currentPaymentMethods) return;

        if (this.currentPaymentMethods[index].toLowerCase() === 'tunai') {
            Toast.error('Metode Tunai adalah metode dasar dan tidak dapat dihapus');
            return;
        }

        this.currentPaymentMethods.splice(index, 1);
        this.renderPaymentMethods();
    },

    async saveClientApiKey() {
        const val = document.getElementById('client-apikey-input').value;
        const cleanVal = (val || '').trim();
        if (!cleanVal) {
            Toast.error('API Key tidak boleh kosong');
            return;
        }
        if (cleanVal.length < 4 || cleanVal.length > 128) {
            Toast.error('Client API Key minimal 4 karakter dan maksimal 128 karakter');
            return;
        }
        try {
            await API.request('/api/v1/kasir/settings/apikey', {
                method: 'PUT',
                body: JSON.stringify({ value: cleanVal })
            });
            Toast.success('API Key berhasil disimpan ke .env server');
        } catch (err) {
            Toast.error('Gagal menyimpan API Key: ' + err.message);
        }
    },

    async saveBackupToggle(key, el) {
        try {
            const val = el.checked ? 'true' : 'false';
            await API.request(`/api/v1/kasir/settings/${key}`, {
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
                await API.request(`/api/v1/kasir/settings/${key}`, {
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
            const res = await API.request('/api/v1/kasir/backup/test-connection', {
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
            const res = await API.request('/api/v1/kasir/backup/trigger', { method: 'POST' });
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
            const res = await API.request('/api/v1/kasir/backup/list');
            if (res.success) {
                if (res.backups.length === 0) {
                    tbody.innerHTML = `<tr class="block lg:table-row"><td colspan="4" class="py-4 text-center text-neutral-500 block lg:table-cell">Tidak ada berkas backup di server.</td></tr>`;
                    return;
                }

                tbody.innerHTML = res.backups.map(b => `
                    <tr class="border-b border-[#2a2a2a] lg:border-[#1c1c1c] hover:bg-[#070707] transition-colors block lg:table-row py-3 lg:py-0 last:border-b-0">
                        <td class="py-2 lg:py-3 pr-2 text-neutral-200 text-xs lg:text-base font-bold flex lg:table-cell justify-between items-start sm:items-center">
                            <span class="lg:hidden text-[10px] font-bold uppercase text-neutral-500 font-sans">Nama Berkas</span>
                            <span class="break-all font-mono text-right lg:text-left">${b.filename}</span>
                        </td>
                        <td class="py-2 lg:py-3 pr-2 text-neutral-400 text-[10px] lg:text-sm flex lg:table-cell justify-between items-center border-t border-[#1c1c1c]/40 lg:border-t-0">
                            <span class="lg:hidden text-[10px] font-bold uppercase text-neutral-500 font-sans">Tanggal Dibuat</span>
                            <span class="font-mono text-right lg:text-left">${b.created_at}</span>
                        </td>
                        <td class="py-2 lg:py-3 pr-2 text-neutral-400 text-xs lg:text-base flex lg:table-cell justify-between items-center border-t border-[#1c1c1c]/40 lg:border-t-0">
                            <span class="lg:hidden text-[10px] font-bold uppercase text-neutral-500 font-sans">Ukuran</span>
                            <span class="font-mono text-right lg:text-left">${b.size_mb} MB</span>
                        </td>
                        <td class="py-2 lg:py-3 text-right flex lg:table-cell justify-between items-center border-t border-[#1c1c1c]/40 lg:border-t-0">
                            <span class="lg:hidden text-[10px] font-bold uppercase text-neutral-500 font-sans">Aksi</span>
                            <div class="flex items-center justify-end gap-2">
                                <button onclick="Settings.downloadBackup('${b.filename}')" class="px-2.5 py-1 bg-neutral-200 hover:bg-neutral-300 text-black text-[10px] lg:text-xs font-bold rounded transition-colors">Unduh</button>
                                <button onclick="Settings.deleteBackup('${b.filename}')" class="px-2.5 py-1 bg-red-950/40 hover:bg-red-900/40 border border-red-900/50 text-red-400 text-[10px] lg:text-xs font-bold rounded transition-colors">Hapus</button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            }
        } catch (err) {
            tbody.innerHTML = `<tr class="block lg:table-row"><td colspan="4" class="py-4 text-center text-red-500 block lg:table-cell">Gagal memuat berkas: ${err.message}</td></tr>`;
        }
    },

    downloadBackup(filename) {
        window.location.href = `/api/v1/kasir/backup/download/${filename}`;
    },

    async deleteBackup(filename) {
        if (!confirm(`Apakah Anda yakin ingin menghapus berkas backup "${filename}" secara permanen dari server?`)) {
            return;
        }
        try {
            const res = await API.request(`/api/v1/kasir/backup/delete/${filename}`, { method: 'DELETE' });
            if (res.success) {
                Toast.success(res.message);
                this.loadBackupFiles();
            }
        } catch (err) {
            Toast.error('Gagal menghapus berkas: ' + err.message);
        }
    },

    async executeDbMaintenance() {
        const retentionSelect = document.getElementById('db-retention-months');
        const retentionMonths = retentionSelect ? retentionSelect.value : '6';

        const confirmMsg = `<div class="text-xs lg:text-sm text-neutral-300 space-y-3 leading-relaxed">` +
            `<p>Apakah Anda yakin ingin melakukan pembersihan histori transaksi yang berumur lebih dari <strong class="text-neutral-100 font-bold underline underline-offset-2">${retentionMonths} bulan</strong>?</p>` +
            `<ul class="list-disc pl-5 space-y-1.5 text-neutral-400">` +
            `<li>File cadangan (backup) otomatis disimpan di folder <code class="text-neutral-200 font-mono bg-[#171717] px-1.5 py-0.5 rounded">backups/archive/</code></li>` +
            `<li>Kapasitas penyimpanan server akan dioptimalkan secara otomatis</li>` +
            `<li>Saldo member &amp; data utama <strong class="text-emerald-400 font-bold">TIDAK AKAN terhapus</strong></li>` +
            `</ul>` +
            `</div>`;

        Modal.confirm(confirmMsg, async () => {
            Toast.info('Sedang membuat backup &amp; membersihkan histori...');

            try {
                const res = await API.request('/api/v1/kasir/settings/database/purge-and-vacuum', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ retention_months: parseInt(retentionMonths, 10) })
                });

                if (res.success) {
                    const initialStr = res.storage_stats ? res.storage_stats.initial_size_human : '0 B';
                    const finalStr = res.storage_stats ? res.storage_stats.final_size_human : '0 B';
                    const savedStr = res.storage_stats ? res.storage_stats.saved_space_human : '0 B';

                    const totalRows = res.deleted_summary
                        ? Object.values(res.deleted_summary).reduce((a, b) => a + b, 0)
                        : 0;

                    Toast.success('Pembersihan &amp; pemeliharaan database berhasil diselesaikan!');

                    const modalHtml = `
                        <div class="bg-[#111] border border-[#2a2a2a] rounded-xl p-6 max-w-lg w-full animate-in space-y-5">
                            <div class="flex items-center justify-between border-b border-[#2a2a2a] pb-4">
                                <div class="flex items-center gap-3.5">
                                    <div class="w-11 h-11 rounded-lg bg-emerald-950/40 border border-emerald-900/50 flex items-center justify-center text-emerald-400 shrink-0">
                                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 class="text-sm lg:text-base font-bold text-neutral-100 uppercase tracking-wider">Pembersihan Database Berhasil</h3>
                                        <p class="text-xs text-neutral-400 mt-0.5">Kapasitas penyimpanan server berhasil dioptimalkan</p>
                                    </div>
                                </div>
                                <button onclick="Modal.closeModal(); Settings.loadBackupFiles();" class="text-neutral-500 hover:text-neutral-300 text-2xl leading-none">&times;</button>
                            </div>

                            <div class="space-y-3 text-xs lg:text-sm text-neutral-300">
                                <div class="p-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg flex items-center justify-between">
                                    <span class="text-neutral-400">📁 File Cadangan</span>
                                    <span class="font-mono text-neutral-100 font-bold">${res.backup_file}</span>
                                </div>
                                <div class="p-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg flex items-center justify-between">
                                    <span class="text-neutral-400">🧹 Riwayat Dihapus</span>
                                    <span class="font-bold text-emerald-400 text-sm lg:text-base">${totalRows.toLocaleString()} baris</span>
                                </div>
                                <div class="p-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg flex items-center justify-between">
                                    <span class="text-neutral-400">💾 Ukuran Storage</span>
                                    <span class="font-mono text-neutral-200">${initialStr} ➔ <strong class="text-emerald-400">${finalStr}</strong></span>
                                </div>
                                <div class="p-3.5 bg-emerald-950/20 border border-emerald-900/30 rounded-lg text-center font-bold text-xs lg:text-sm text-emerald-400">
                                    ✨ Berhasil menghemat ${savedStr} ruang disk server!
                                </div>
                            </div>

                            <div class="flex justify-end pt-3 border-t border-[#2a2a2a]">
                                <button onclick="Modal.closeModal(); Settings.loadBackupFiles();" class="px-5 py-2.5 bg-neutral-100 hover:bg-white text-black text-xs lg:text-sm font-bold rounded-lg transition-colors">
                                    Selesai
                                </button>
                            </div>
                        </div>
                    `;

                    Modal.show(modalHtml);
                    this.loadBackupFiles();
                } else {
                    Toast.error(res.error || 'Gagal melakukan pembersihan database.');
                }
            } catch (err) {
                Toast.error('Gagal melakukan pembersihan database: ' + err.message);
            }
        });
    },

    previewQRIS(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function (e) {
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
            { value: 'Asia/Jakarta', label: 'WIB (UTC+7) — Jakarta, Sumatra, Jawa' },
            { value: 'Asia/Makassar', label: 'WITA (UTC+8) — Makassar, Bali, Sulawesi' },
            { value: 'Asia/Jayapura', label: 'WIT (UTC+9) — Jayapura, Maluku, Papua' },
            { value: 'Asia/Kuala_Lumpur', label: 'MYT (UTC+8) — Malaysia' },
            { value: 'Asia/Singapore', label: 'SGT (UTC+8) — Singapore' },
            { value: 'Asia/Ho_Chi_Minh', label: 'ICT (UTC+7) — Vietnam' },
            { value: 'Asia/Bangkok', label: 'ICT (UTC+7) — Thailand' },
            { value: 'Asia/Manila', label: 'PHT (UTC+8) — Philippines' },
            { value: 'Europe/London', label: 'GMT/BST (UTC+0/1) — UK' },
            { value: 'Europe/Berlin', label: 'CET/CEST (UTC+1/2) — Germany' },
            { value: 'America/New_York', label: 'EST/EDT (UTC-5/4) — New York' },
            { value: 'Asia/Tokyo', label: 'JST (UTC+9) — Japan' },
            { value: 'Australia/Sydney', label: 'AEST/AEDT (UTC+10/11) — Sydney' },
        ];

        select.innerHTML = zones.map(z =>
            `<option value="${z.value}" ${z.value === (selected || 'Asia/Makassar') ? 'selected' : ''}>${z.label}</option>`
        ).join('');
    },

    async saveTimezone() {
        const val = document.getElementById('timezone-select').value;
        try {
            await API.request('/api/v1/kasir/settings/timezone', {
                method: 'PUT',
                body: JSON.stringify({ value: val })
            });
            Toast.success('Timezone berhasil diperbarui');
        } catch (err) {
            Toast.error('Gagal menyimpan timezone: ' + err.message);
        }
    },
    async saveKioskSettings() {
        const title = document.getElementById('warnet-title-input')?.value || '';
        const address = document.getElementById('warnet-address-input')?.value || '';
        const phone = document.getElementById('warnet-phone-input')?.value || '';
        const footer = document.getElementById('warnet-footer-input')?.value || '';
        const gmaps = document.getElementById('warnet-gmaps-input')?.value || '';
        const announcement = this.ckeditorAnnouncementInstance
            ? this.ckeditorAnnouncementInstance.getData()
            : (document.getElementById('warnet-announcement-input')?.value || '');
        const qrisFileInput = document.getElementById('qris-file-input');

        Toast.success('Menyimpan pengaturan Kiosk...');
        try {
            // 1. Simpan judul
            await API.request('/api/v1/kasir/settings/warnet_title', {
                method: 'PUT',
                body: JSON.stringify({ value: title })
            });

            // 2. Simpan alamat warnet
            await API.request('/api/v1/kasir/settings/warnet_address', {
                method: 'PUT',
                body: JSON.stringify({ value: address })
            });

            // 3. Simpan nomor telepon
            await API.request('/api/v1/kasir/settings/warnet_phone', {
                method: 'PUT',
                body: JSON.stringify({ value: phone })
            });

            // 4. Simpan pesan kaki struk
            await API.request('/api/v1/kasir/settings/warnet_footer', {
                method: 'PUT',
                body: JSON.stringify({ value: footer })
            });

            // 5. Simpan Google Maps
            await API.request('/api/v1/kasir/settings/warnet_gmaps', {
                method: 'PUT',
                body: JSON.stringify({ value: gmaps })
            });

            // 6. Simpan pengumuman
            await API.request('/api/v1/kasir/settings/warnet_announcement', {
                method: 'PUT',
                body: JSON.stringify({ value: announcement })
            });

            // 7. Upload QRIS jika ada file yang dipilih
            if (qrisFileInput.files && qrisFileInput.files[0]) {
                const formData = new FormData();
                formData.append('qris_image', qrisFileInput.files[0]);

                const uploadRes = await API.request('/api/v1/kasir/settings/qris', {
                    method: 'POST',
                    body: formData
                });

                if (uploadRes.qris_url) {
                    const preview = document.getElementById('settings-qris-preview');
                    if (preview) preview.src = window.API ? API.resolveMediaUrl(uploadRes.qris_url) : uploadRes.qris_url;
                }
            }

            Toast.success('Pengaturan Kiosk berhasil disimpan');
            await this.load(true); // Refresh data
        } catch (err) {
            Toast.error('Gagal menyimpan pengaturan Kiosk: ' + err.message);
        }
    },

    updateGmapsPreview() {
        const input = document.getElementById('warnet-gmaps-input');
        const previewBox = document.getElementById('settings-gmaps-preview-box');
        const iframeWrapper = document.getElementById('settings-gmaps-iframe-wrapper');
        const statusBadge = document.getElementById('settings-gmaps-status-badge');
        if (!input || !previewBox || !iframeWrapper || !statusBadge) return;

        const val = (input.value || '').trim();
        if (!val) {
            previewBox.classList.add('hidden');
            iframeWrapper.innerHTML = '';
            return;
        }

        let embedUrl = null;
        let navUrl = null;

        if (val.toLowerCase().includes('<iframe')) {
            const match = val.match(/src=["']([^"']+)["']/i);
            if (match && (match[1].startsWith('http://') || match[1].startsWith('https://'))) {
                embedUrl = match[1];
            }
        } else if (val.startsWith('https://www.google.com/maps/embed') || val.startsWith('http://www.google.com/maps/embed')) {
            embedUrl = val;
        } else if (val.startsWith('https://maps.app.goo.gl/') || val.startsWith('http://maps.app.goo.gl/') || val.startsWith('https://goo.gl/maps/') || val.startsWith('http://goo.gl/maps/')) {
            navUrl = val;
        } else if ((val.includes('google.com/maps') || val.includes('maps.google.com')) && (val.startsWith('http://') || val.startsWith('https://'))) {
            navUrl = val;
            if (val.includes('output=embed')) {
                embedUrl = val;
            }
        }

        previewBox.classList.remove('hidden');
        if (embedUrl) {
            statusBadge.textContent = 'Embed Aktif';
            statusBadge.className = 'text-[9px] font-mono text-emerald-400';
            const safeEmbed = window.Utils && Utils.escapeHtml ? Utils.escapeHtml(embedUrl) : embedUrl.replace(/"/g, '&quot;');
            iframeWrapper.innerHTML = `<iframe src="${safeEmbed}" class="w-full h-full border-0 rounded" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
        } else if (navUrl) {
            statusBadge.textContent = 'Link Navigasi';
            statusBadge.className = 'text-[9px] font-mono text-sky-400';
            const safeNav = window.Utils && Utils.escapeHtml ? Utils.escapeHtml(navUrl) : navUrl.replace(/"/g, '&quot;');
            iframeWrapper.innerHTML = `
                <div class="text-center p-4 space-y-2">
                    <p class="text-xs text-neutral-300 font-medium">Link share Google Maps terdeteksi.</p>
                    <a href="${safeNav}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#252525] border border-[#2e2e2e] text-emerald-400 text-xs font-bold rounded transition-colors">
                        Buka Tautan Peta ↗
                    </a>
                </div>
            `;
        } else {
            statusBadge.textContent = 'Format Tidak Dikenali';
            statusBadge.className = 'text-[9px] font-mono text-amber-400';
            iframeWrapper.innerHTML = `
                <div class="text-center p-4 text-xs text-amber-400/90">
                    Format tautan/iframe tidak dikenali. Pastikan menyalin kode &lt;iframe src="..."&gt; atau URL Google Maps valid.
                </div>
            `;
        }
    },

    async saveTVSignageSettings() {
        const runningTextEl = document.getElementById('tv-running-text');
        const runningText = runningTextEl ? runningTextEl.value : '';

        Toast.success('Menyimpan pengaturan TV Signage...');
        try {
            await API.request('/api/v1/kasir/settings/tv_running_text', {
                method: 'PUT',
                body: JSON.stringify({ value: runningText })
            });

            Toast.success('Pengaturan TV Signage berhasil disimpan');
            await this.load(true);
        } catch (err) {
            Toast.error('Gagal menyimpan pengaturan TV Signage: ' + err.message);
        }
    },

};

window.SettingsGeneral = SettingsGeneral;
