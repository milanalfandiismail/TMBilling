// app/static/js/kasir/modules/settings/settings_general.js
/**
 * Sub-modul SettingsGeneral untuk pengaturan umum toko/warnet, kiosk,
 * metode pembayaran, CKEditor, TV signage, timezone, dan backup database.
 */

const SettingsGeneral = {
    selectedPollingInterval: 5,
    ckeditorAnnouncementInstance: null,
    currentPaymentMethods: ['Tunai', 'QRIS', 'Transfer Bank'],
    paymentPresets: ['QRIS', 'Transfer Bank', 'DANA', 'GoPay', 'OVO', 'ShopeePay'],

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

            // Batasi tinggi editable CKEditor agar internal scrollbar aktif (ukuran diatur responsif via CSS media queries)
            const editableEl = this.ckeditorAnnouncementInstance?.ui?.view?.editable?.element;
            if (editableEl) {
                editableEl.style.overflowY = 'auto';
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

    switchDbCleanupMobileView(view) {
        const colAct = document.getElementById('db-col-action');
        const colSafe = document.getElementById('db-col-safety');
        const pillAct = document.getElementById('db-mobile-pill-action');
        const pillSafe = document.getElementById('db-mobile-pill-safety');

        if (!colAct || !colSafe) return;

        if (view === 'safety') {
            colAct.classList.add('hidden');
            colSafe.classList.remove('hidden');

            if (pillAct && pillSafe) {
                pillAct.className = 'flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 text-neutral-400 hover:text-neutral-200';
                pillSafe.className = 'flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 bg-neutral-200 text-black shadow-sm';
            }
        } else {
            colAct.classList.remove('hidden');
            colSafe.classList.add('hidden');

            if (pillAct && pillSafe) {
                pillAct.className = 'flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 bg-neutral-200 text-black shadow-sm';
                pillSafe.className = 'flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 text-neutral-400 hover:text-neutral-200';
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

    async savePaymentMethods(silent = false) {
        const val = (this.currentPaymentMethods || []).join(',');
        try {
            await API.request('/api/v1/kasir/settings/payment_methods', {
                method: 'PUT',
                body: JSON.stringify({ value: val })
            });
            if (!silent) {
                Toast.success('Metode pembayaran berhasil disimpan');
            }
        } catch (err) {
            Toast.error('Gagal menyimpan metode pembayaran: ' + err.message);
        }
    },

    renderPaymentMethods() {
        const listEl = document.getElementById('payment-methods-list');
        const presetsEl = document.getElementById('payment-quick-presets');
        const countBadge = document.getElementById('payment-methods-count');

        if (!this.currentPaymentMethods || this.currentPaymentMethods.length === 0) {
            this.currentPaymentMethods = ['Tunai', 'QRIS', 'Transfer Bank'];
        }

        if (countBadge) {
            countBadge.innerText = `${this.currentPaymentMethods.length} Aktif`;
        }

        // Render Quick Preset Chips
        if (presetsEl) {
            const currentLower = this.currentPaymentMethods.map(m => m.toLowerCase());
            const available = (this.paymentPresets || ['QRIS', 'Transfer Bank', 'DANA', 'GoPay', 'OVO', 'ShopeePay']).filter(p => !currentLower.includes(p.toLowerCase()));
            if (available.length === 0) {
                presetsEl.innerHTML = `<span class="text-[10px] text-neutral-500 italic">Semua preset populer sudah aktif</span>`;
            } else {
                presetsEl.innerHTML = available.map(p => `
                    <button type="button" onclick="Settings.addPaymentMethod('${p}')"
                        class="px-2 xl:px-2.5 2xl:px-3 py-0.5 xl:py-1 2xl:py-1.5 rounded bg-[#111] hover:bg-[#1f1f1f] border border-[#262626] hover:border-neutral-500 text-[10px] sm:text-xs xl:text-xs 2xl:text-sm font-medium text-neutral-300 hover:text-neutral-100 transition-all flex items-center gap-1 active:scale-95 shadow-sm">
                        <i class="fa-solid fa-plus text-[9px] sm:text-[10px] xl:text-xs 2xl:text-sm text-neutral-400"></i>
                        <span>${p}</span>
                    </button>
                `).join('');
            }
        }

        // Render Active Payment Methods Grid Chips
        if (!listEl) return;

        listEl.innerHTML = this.currentPaymentMethods.map((method, index) => {
            const isTunai = method.toLowerCase() === 'tunai';
            const icon = isTunai ? 'fa-money-bill-wave text-emerald-400' :
                         method.toLowerCase().includes('qris') ? 'fa-qrcode text-amber-400' :
                         method.toLowerCase().includes('bank') ? 'fa-building-columns text-blue-400' :
                         'fa-wallet text-indigo-400';

            if (isTunai) {
                return `
                <div class="flex items-center justify-between px-2.5 py-1.5 xl:py-2 2xl:py-2.5 bg-[#0a0a0a] border border-[#1f1f1f] rounded text-xs xl:text-sm 2xl:text-base">
                    <span class="flex items-center gap-1.5 text-neutral-200 font-bold truncate">
                        <i class="fa-solid ${icon} text-xs xl:text-sm 2xl:text-base shrink-0"></i>
                        <span class="truncate">${method}</span>
                    </span>
                    <span class="px-1.5 sm:px-2 xl:px-2.5 2xl:px-3 py-0.5 xl:py-1 2xl:py-1.5 rounded text-[9px] sm:text-[10px] xl:text-xs 2xl:text-sm font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                        🔒 Wajib
                    </span>
                </div>`;
            }

            return `
            <div class="flex items-center justify-between px-2.5 py-1.5 xl:py-2 2xl:py-2.5 bg-[#0a0a0a] hover:bg-[#111] border border-[#1f1f1f] hover:border-[#2a2a2a] rounded text-xs xl:text-sm 2xl:text-base transition-colors group">
                <span class="flex items-center gap-1.5 text-neutral-200 font-medium truncate">
                    <i class="fa-solid ${icon} text-xs xl:text-sm 2xl:text-base shrink-0"></i>
                    <span class="truncate">${method}</span>
                </span>
                <button type="button" onclick="Settings.confirmRemovePaymentMethod(${index})"
                    class="text-neutral-500 hover:text-red-400 p-0.5 transition-colors shrink-0"
                    title="Hapus ${method}">
                    <i class="fa-solid fa-trash-can text-[11px] xl:text-xs 2xl:text-sm"></i>
                </button>
            </div>`;
        }).join('');
    },

    confirmRemovePaymentMethod(index) {
        if (!this.currentPaymentMethods || !this.currentPaymentMethods[index]) return;

        const target = this.currentPaymentMethods[index];
        if (target.toLowerCase() === 'tunai') {
            Toast.error('Metode Tunai adalah metode dasar dan tidak dapat dihapus');
            return;
        }

        const icon = target.toLowerCase().includes('qris') ? 'fa-qrcode text-amber-400' :
                     target.toLowerCase().includes('bank') ? 'fa-building-columns text-blue-400' :
                     'fa-wallet text-indigo-400';

        const modalHtml = `
            <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-5 max-w-md w-[calc(100%-2rem)] mx-auto shadow-2xl flex flex-col space-y-4">
                <!-- Header -->
                <div class="flex items-center justify-between pb-3 border-b border-[#1c1c1c]">
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                            <i class="fa-solid fa-triangle-exclamation text-red-400 text-sm"></i>
                        </div>
                        <h3 class="text-xs sm:text-sm font-bold text-neutral-200 uppercase tracking-wider">
                            Konfirmasi Hapus Metode
                        </h3>
                    </div>
                    <button type="button" onclick="Modal.closeModal()" class="text-neutral-500 hover:text-neutral-300 text-lg leading-none transition-colors">&times;</button>
                </div>

                <!-- Body / Target Method Badge -->
                <div class="space-y-3">
                    <p class="text-xs text-neutral-400">
                        Apakah Anda yakin ingin menghapus metode pembayaran berikut?
                    </p>

                    <div class="flex items-center gap-2 px-3 py-2 bg-[#121212] border border-[#222] rounded-md">
                        <i class="fa-solid ${icon} text-base shrink-0"></i>
                        <span class="text-xs sm:text-sm font-bold text-neutral-100 tracking-wide">${target}</span>
                    </div>

                    <!-- Warning Points -->
                    <div class="p-2.5 bg-amber-500/10 border border-amber-500/25 rounded space-y-1.5">
                        <div class="flex items-start gap-2">
                            <i class="fa-solid fa-ban text-amber-400 text-xs mt-0.5 shrink-0"></i>
                            <p class="text-[11px] text-amber-200/90 leading-tight">
                                <strong class="text-amber-300">Transaksi Baru:</strong> Metode ini tidak akan lagi muncul sebagai opsi pilihan di Kasir, POS, Refill, dan Kiosk.
                            </p>
                        </div>
                        <div class="flex items-start gap-2">
                            <i class="fa-solid fa-shield-halved text-emerald-400 text-xs mt-0.5 shrink-0"></i>
                            <p class="text-[11px] text-emerald-200/90 leading-tight">
                                <strong class="text-emerald-300">Riwayat Transaksi Aman:</strong> Transaksi lama yang pernah dibayar memakai metode ini <strong class="underline decoration-emerald-500/50">TIDAK akan menjadi null</strong> dan laporan keuangan tetap akurat.
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Footer Actions -->
                <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1c1c1c]">
                    <button type="button" id="modal-cancel-delete-method" onclick="Modal.closeModal()"
                        class="px-3.5 py-2 bg-[#171717] hover:bg-[#222] border border-[#262626] text-neutral-200 text-xs font-bold rounded transition-colors focus:ring-1 focus:ring-neutral-400">
                        Batal
                    </button>
                    <button type="button" id="modal-confirm-delete-method" onclick="Settings.removePaymentMethod(${index})"
                        class="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded transition-colors flex items-center gap-1.5 shadow-sm active:scale-95">
                        <i class="fa-solid fa-trash-can text-[11px]"></i>
                        <span>Hapus Metode</span>
                    </button>
                </div>
            </div>`;

        Modal.show(modalHtml);

        // Autofocus tombol Batal untuk proteksi accidental enter
        setTimeout(() => {
            const cancelBtn = document.getElementById('modal-cancel-delete-method');
            if (cancelBtn) cancelBtn.focus();
        }, 50);
    },

    async addPaymentMethod(val = null) {
        let cleanVal = '';
        if (typeof val === 'string' && val.trim()) {
            cleanVal = val.trim();
        } else {
            const inputEl = document.getElementById('new-payment-method-input');
            cleanVal = inputEl ? inputEl.value.trim() : '';
        }

        if (!cleanVal) {
            Toast.error('Ketik nama metode pembayaran yang ingin ditambahkan');
            return;
        }

        if (cleanVal.length > 50) {
            Toast.error('Nama metode pembayaran maksimal 50 karakter');
            return;
        }

        if (!this.currentPaymentMethods) this.currentPaymentMethods = [];

        // Cek duplikat (case insensitive)
        const exists = this.currentPaymentMethods.some(m => m.toLowerCase() === cleanVal.toLowerCase());
        if (exists) {
            Toast.error(`Metode "${cleanVal}" sudah ada`);
            return;
        }

        this.currentPaymentMethods.push(cleanVal);

        const inputEl = document.getElementById('new-payment-method-input');
        if (inputEl) inputEl.value = '';

        this.renderPaymentMethods();
        await this.savePaymentMethods();
    },

    async removePaymentMethod(index) {
        if (!this.currentPaymentMethods || !this.currentPaymentMethods[index]) return;

        const target = this.currentPaymentMethods[index];
        if (target.toLowerCase() === 'tunai') {
            Toast.error('Metode Tunai adalah metode dasar dan tidak dapat dihapus');
            return;
        }

        // Close modal if open
        if (typeof Modal !== 'undefined' && Modal.closeModal) {
            Modal.closeModal();
        }

        this.currentPaymentMethods.splice(index, 1);
        this.renderPaymentMethods();
        await this.savePaymentMethods(true);
        Toast.success(`Metode "${target}" berhasil dihapus`);
    },

    switchPaymentMobileView(view) {
        const colMethods = document.getElementById('payment-col-methods');
        const colQris = document.getElementById('payment-col-qris');
        const pillMethods = document.getElementById('payment-mobile-pill-methods');
        const pillQris = document.getElementById('payment-mobile-pill-qris');

        if (!colMethods || !colQris) return;

        if (view === 'qris') {
            colMethods.classList.add('hidden');
            colQris.classList.remove('hidden');

            if (pillMethods && pillQris) {
                pillMethods.className = 'flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 text-neutral-400 hover:text-neutral-200';
                pillQris.className = 'flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 bg-neutral-200 text-black shadow-sm';
            }
        } else {
            colMethods.classList.remove('hidden');
            colQris.classList.add('hidden');

            if (pillMethods && pillQris) {
                pillMethods.className = 'flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 bg-neutral-200 text-black shadow-sm';
                pillQris.className = 'flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 text-neutral-400 hover:text-neutral-200';
            }
        }
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
                    tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-neutral-400 text-xs xl:text-sm 2xl:text-base font-sans">Tidak ada berkas backup di server.</td></tr>`;
                    return;
                }

                tbody.innerHTML = res.backups.map(b => `
                    <tr class="border-b border-[#1c1c1c] hover:bg-[#070707] transition-colors">
                        <td class="py-2 sm:py-2.5 xl:py-3 px-2 sm:px-2.5 xl:px-4 text-neutral-200">
                            <div class="flex items-center gap-2 min-w-0">
                                <i class="fa-solid fa-file-zipper text-emerald-400 text-xs xl:text-sm shrink-0"></i>
                                <div class="min-w-0 flex-1">
                                    <div class="font-bold font-mono text-xs xl:text-sm 2xl:text-base truncate max-w-[calc(100vw-165px)] md:max-w-none md:whitespace-nowrap" title="${b.filename}">
                                        ${b.filename}
                                    </div>
                                    <div class="md:hidden flex items-center gap-1.5 mt-0.5 text-[10px] text-neutral-400 font-mono">
                                        <span>${b.created_at}</span>
                                        <span class="text-neutral-600">&bull;</span>
                                        <span class="text-neutral-300 font-semibold">${b.size_mb} MB</span>
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td class="hidden md:table-cell py-2 sm:py-2.5 xl:py-3 px-2 sm:px-2.5 xl:px-4 text-neutral-400 text-[10px] sm:text-xs xl:text-xs 2xl:text-sm font-mono whitespace-nowrap">
                            ${b.created_at}
                        </td>
                        <td class="hidden md:table-cell py-2 sm:py-2.5 xl:py-3 px-2 sm:px-2.5 xl:px-4 text-neutral-300 text-[10px] sm:text-xs xl:text-sm 2xl:text-base font-mono whitespace-nowrap">
                            ${b.size_mb} MB
                        </td>
                        <td class="py-2 sm:py-2.5 xl:py-3 px-2 sm:px-2.5 xl:px-4 text-right whitespace-nowrap shrink-0">
                            <div class="flex items-center justify-end gap-1 sm:gap-1.5 xl:gap-2">
                                <button onclick="Settings.downloadBackup('${b.filename}')" class="p-1.5 md:px-2.5 md:py-1 xl:px-3 xl:py-1.5 bg-neutral-200 hover:bg-neutral-300 text-black text-xs xl:text-xs 2xl:text-sm font-bold rounded transition-colors active:scale-95 shadow-sm inline-flex items-center gap-1.5" title="Unduh Berkas Backup">
                                    <i class="fa-solid fa-download text-[11px] xl:text-xs"></i>
                                    <span class="hidden md:inline">Unduh</span>
                                </button>
                                <button onclick="Settings.deleteBackup('${b.filename}')" class="p-1.5 md:px-2.5 md:py-1 xl:px-3 xl:py-1.5 bg-red-950/40 hover:bg-red-900/40 border border-red-900/50 text-red-400 text-xs xl:text-xs 2xl:text-sm font-bold rounded transition-colors active:scale-95 inline-flex items-center gap-1.5" title="Hapus Berkas Backup">
                                    <i class="fa-solid fa-trash-can text-[11px] xl:text-xs"></i>
                                    <span class="hidden md:inline">Hapus</span>
                                </button>
                            </div>
                        </td>
                    </tr>`).join('');
            }
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-red-500 font-sans">Gagal memuat berkas: ${err.message}</td></tr>`;
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

    async loadDbStats() {
        try {
            const res = await API.request('/api/v1/kasir/settings/database/stats', { method: 'GET' });
            if (res && res.success && res.stats) {
                const s = res.stats;
                const elSize = document.getElementById('db-stat-size');
                const elStatus = document.getElementById('db-stat-status');
                const elHistory = document.getElementById('db-stat-history-count');
                const elLastArchive = document.getElementById('db-stat-last-archive');
                const elLastArchiveSub = document.getElementById('db-stat-last-archive-sub');

                if (elSize) elSize.textContent = s.db_size_human || '---';
                if (elStatus) {
                    elStatus.textContent = s.status === 'optimal' ? 'Optimal' : 'Perlu Pemeliharaan';
                    elStatus.className = s.status === 'optimal'
                        ? 'px-1.5 py-0.2 rounded text-[8px] sm:text-[9px] font-mono font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0'
                        : 'px-1.5 py-0.2 rounded text-[8px] sm:text-[9px] font-mono font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0';
                }
                if (elHistory) elHistory.textContent = (s.total_history_rows || 0).toLocaleString('id-ID');
                if (elLastArchive) {
                    elLastArchive.textContent = s.last_archive ? s.last_archive.date : 'Belum Ada';
                }
                if (elLastArchiveSub) {
                    if (s.last_archive) {
                        elLastArchiveSub.textContent = `(${s.last_archive.size_human})`;
                        const archiveCard = document.getElementById('db-stat-archive-card');
                        if (archiveCard) {
                            archiveCard.title = `Berkas: ${s.last_archive.filename} (${s.last_archive.size_human})`;
                        }
                    } else {
                        elLastArchiveSub.textContent = '';
                    }
                }
            }
        } catch (err) {
            console.warn('Gagal memuat statistik database:', err);
        }
        const retentionMonths = parseInt(document.getElementById('db-retention-months')?.value || '6', 10);
        this.updateCutoffDateDisplay(retentionMonths);
    },

    selectRetentionMonths(months) {
        const input = document.getElementById('db-retention-months');
        if (input) input.value = months;

        document.querySelectorAll('.db-retention-pill').forEach(btn => {
            const m = btn.getAttribute('data-months');
            if (m === months.toString()) {
                btn.className = 'db-retention-pill px-2.5 py-1.5 rounded text-[10px] sm:text-xs font-semibold border transition-all text-center bg-white text-black border-white shadow-sm font-bold';
            } else {
                btn.className = 'db-retention-pill px-2.5 py-1.5 rounded text-[10px] sm:text-xs font-semibold border transition-all text-center bg-[#171717] text-neutral-300 border-[#262626] hover:bg-[#222]';
            }
        });

        this.updateCutoffDateDisplay(months);
    },

    updateCutoffDateDisplay(months) {
        const d = new Date();
        d.setMonth(d.getMonth() - months);
        const monthsId = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const formatted = `${d.getDate()} ${monthsId[d.getMonth()]} ${d.getFullYear()}`;
        const el = document.getElementById('db-cutoff-date');
        if (el) el.textContent = formatted;
        return formatted;
    },

    async executeDbMaintenance() {
        const retentionInput = document.getElementById('db-retention-months');
        const retentionMonths = retentionInput ? parseInt(retentionInput.value, 10) : 6;
        const cutoffStr = this.updateCutoffDateDisplay(retentionMonths);

        const modalContent = `
            <div class="bg-[#111] border border-[#262626] rounded-xl p-5 sm:p-6 max-w-md w-full space-y-4">
                <div class="flex items-center gap-3 border-b border-[#222] pb-3">
                    <div class="w-10 h-10 rounded bg-amber-950/40 border border-amber-800/50 flex items-center justify-center text-amber-400 shrink-0">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-sm sm:text-base font-bold text-neutral-100 uppercase tracking-wider">Konfirmasi Pembersihan</h3>
                        <p class="text-xs text-neutral-400">Pembersihan data histori &amp; optimasi VACUUM</p>
                    </div>
                </div>

                <div class="space-y-3 text-xs text-neutral-300">
                    <p>Anda akan membersihkan riwayat operasional yang berumur lebih dari <strong class="text-white font-bold underline underline-offset-2">${retentionMonths} Bulan</strong> (sebelum ${cutoffStr}).</p>
                    
                    <div class="p-3 bg-[#080808] border border-[#1c1c1c] rounded space-y-2 text-[11px]">
                        <div class="flex items-center gap-2 text-emerald-400">
                            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                            <span>Cadangan otomatis disimpan di <strong>backups/archive/</strong></span>
                        </div>
                        <div class="flex items-center gap-2 text-emerald-400">
                            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                            <span>Saldo &amp; data member <strong>100% aman (tidak disentuh)</strong></span>
                        </div>
                    </div>

                    <label class="flex items-start gap-2 pt-1 cursor-pointer select-none">
                        <input type="checkbox" id="db-confirm-check" class="mt-0.5 rounded bg-[#171717] border-[#333] text-white focus:ring-0">
                        <span class="text-neutral-300 text-[11px]">Saya memahami bahwa data sebelum tanggal tersebut akan diarsipkan &amp; dibersihkan.</span>
                    </label>
                </div>

                <div class="flex items-center justify-end gap-2 pt-3 border-t border-[#222]">
                    <button type="button" onclick="Modal.closeModal()" class="px-3.5 py-1.5 rounded text-xs text-neutral-400 hover:text-white bg-[#171717] hover:bg-[#222] transition-colors">
                        Batalkan
                    </button>
                    <button type="button" id="btn-do-purge" onclick="Settings.startPurgeProcess(${retentionMonths})" disabled class="px-4 py-1.5 rounded text-xs font-bold bg-neutral-600 text-neutral-300 cursor-not-allowed transition-all flex items-center gap-1.5">
                        <span>Ya, Mulai Pembersihan</span>
                    </button>
                </div>
            </div>
        `;

        Modal.show(modalContent);
        setTimeout(() => {
            const check = document.getElementById('db-confirm-check');
            const btn = document.getElementById('btn-do-purge');
            if (check && btn) {
                check.addEventListener('change', () => {
                    btn.disabled = !check.checked;
                    if (check.checked) {
                        btn.className = 'px-4 py-1.5 rounded text-xs font-bold bg-white text-black hover:bg-neutral-200 transition-all flex items-center gap-1.5 shadow-sm';
                    } else {
                        btn.className = 'px-4 py-1.5 rounded text-xs font-bold bg-neutral-600 text-neutral-300 cursor-not-allowed transition-all flex items-center gap-1.5';
                    }
                });
            }
        }, 50);
    },

    async startPurgeProcess(retentionMonths) {
        const btn = document.getElementById('btn-do-purge');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<svg class="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg><span>Memproses Backup &amp; VACUUM...</span>';
        }

        Toast.info('Sedang membuat backup &amp; membersihkan histori...');

        try {
            const res = await API.request('/api/v1/kasir/settings/database/purge-and-vacuum', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ retention_months: parseInt(retentionMonths, 10) })
            });

            Modal.closeModal();

            if (res.success) {
                const initialStr = res.storage_stats ? res.storage_stats.initial_size_human : '0 B';
                const finalStr = res.storage_stats ? res.storage_stats.final_size_human : '0 B';
                const savedStr = res.storage_stats ? res.storage_stats.saved_space_human : '0 B';

                const totalRows = res.deleted_summary
                    ? Object.values(res.deleted_summary).reduce((a, b) => a + b, 0)
                    : 0;

                Toast.success('Pembersihan &amp; pemeliharaan database berhasil diselesaikan!');

                const tableRowsHtml = res.deleted_summary
                    ? Object.entries(res.deleted_summary).map(([tbl, count]) => `
                        <tr class="border-b border-[#222]">
                            <td class="py-1.5 px-3 font-mono text-neutral-300">${tbl}</td>
                            <td class="py-1.5 px-3 text-right font-mono font-bold text-neutral-100">${(count || 0).toLocaleString('id-ID')}</td>
                        </tr>
                    `).join('')
                    : '';

                const modalHtml = `
                    <div class="bg-[#111] border border-[#2a2a2a] rounded-xl p-5 sm:p-6 max-w-lg w-full space-y-4">
                        <div class="flex items-center justify-between border-b border-[#2a2a2a] pb-3">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-lg bg-emerald-950/40 border border-emerald-900/50 flex items-center justify-center text-emerald-400 shrink-0">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                    </svg>
                                </div>
                                <div>
                                    <h3 class="text-sm sm:text-base font-bold text-white uppercase tracking-wider">Pemeliharaan Selesai</h3>
                                    <p class="text-[11px] text-neutral-400">Database berhasil dibersihkan &amp; dioptimasi</p>
                                </div>
                            </div>
                            <button onclick="Modal.closeModal()" class="text-neutral-400 hover:text-white transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        <div class="grid grid-cols-3 gap-2 text-center">
                            <div class="bg-[#181818] p-2.5 rounded-lg border border-[#262626]">
                                <span class="text-[10px] text-neutral-400 uppercase font-medium block">Ukuran Awal</span>
                                <span class="text-xs sm:text-sm font-bold font-mono text-neutral-200">${initialStr}</span>
                            </div>
                            <div class="bg-[#181818] p-2.5 rounded-lg border border-[#262626]">
                                <span class="text-[10px] text-neutral-400 uppercase font-medium block">Ukuran Akhir</span>
                                <span class="text-xs sm:text-sm font-bold font-mono text-emerald-400">${finalStr}</span>
                            </div>
                            <div class="bg-[#181818] p-2.5 rounded-lg border border-[#262626]">
                                <span class="text-[10px] text-neutral-400 uppercase font-medium block">Ruang Hemat</span>
                                <span class="text-xs sm:text-sm font-bold font-mono text-emerald-400">${savedStr}</span>
                            </div>
                        </div>

                        <div class="space-y-1.5">
                            <span class="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">Rincian Data Yang Dibersihkan:</span>
                            <div class="bg-[#080808] border border-[#222] rounded overflow-hidden max-h-40 overflow-y-auto">
                                <table class="w-full text-xs">
                                    <tbody>
                                        ${tableRowsHtml}
                                        <tr class="bg-[#141414] font-bold">
                                            <td class="py-1.5 px-3 text-neutral-300">Total Baris Terhapus</td>
                                            <td class="py-1.5 px-3 text-right font-mono text-emerald-400">${totalRows.toLocaleString('id-ID')}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div class="p-2.5 bg-[#0a0a0a] border border-[#222] rounded flex items-center justify-between text-xs">
                            <div class="flex items-center gap-2 truncate text-neutral-300">
                                <svg class="w-4 h-4 text-neutral-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
                                <span class="truncate text-[11px]">Arsip: <strong class="text-neutral-200 font-mono">${res.backup_file || 'cadangan.db'}</strong></span>
                            </div>
                            <span class="text-[10px] text-neutral-500 shrink-0">Folder: backups/archive/</span>
                        </div>

                        <div class="flex justify-end pt-2 border-t border-[#222]">
                            <button onclick="Modal.closeModal()" class="px-4 py-1.5 bg-neutral-200 hover:bg-white text-black text-xs font-bold rounded transition-colors">
                                Selesai
                            </button>
                        </div>
                    </div>
                `;

                Modal.show(modalHtml);
                await this.loadDbStats();
            } else {
                Toast.error(res.error || 'Gagal melakukan pemeliharaan database');
            }
        } catch (err) {
            Modal.closeModal();
            Toast.error('Terjadi kesalahan: ' + err.message);
        }
    },
    async previewQRIS(input) {
        if (!input.files || !input.files[0]) return;
        const file = input.files[0];

        // 1. Preview instan lokal
        const reader = new FileReader();
        reader.onload = function (e) {
            const preview = document.getElementById('settings-qris-preview');
            if (preview) preview.src = e.target.result;
        };
        reader.readAsDataURL(file);

        // 2. Auto-upload instan ke server
        Toast.info('Mengunggah gambar QRIS...');
        try {
            const formData = new FormData();
            formData.append('qris_image', file);
            const uploadRes = await API.request('/api/v1/kasir/settings/qris', {
                method: 'POST',
                body: formData
            });

            if (uploadRes && uploadRes.qris_url) {
                const preview = document.getElementById('settings-qris-preview');
                if (preview) preview.src = window.API ? API.resolveMediaUrl(uploadRes.qris_url) : uploadRes.qris_url;
                Toast.success('Gambar QRIS berhasil diperbarui');
            } else {
                Toast.success('Gambar QRIS berhasil diunggah');
            }
        } catch (err) {
            Toast.error('Gagal mengunggah QRIS: ' + err.message);
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
    switchKioskPill(view) {
        const views = [
            { id: 'profile', minW: 'min-w-[120px]' },
            { id: 'maps', minW: 'min-w-[120px]' },
            { id: 'announcement', minW: 'min-w-[140px]' },
            { id: 'tv', minW: 'min-w-[120px]' }
        ];

        views.forEach(item => {
            const v = item.id;
            const viewEl = document.getElementById(`kiosk-view-${v}`);
            const pillEl = document.getElementById(`kiosk-pill-${v}`);
            if (!viewEl || !pillEl) return;

            if (v === view) {
                viewEl.classList.remove('hidden');
                pillEl.className = `flex-1 ${item.minW} py-1.5 xl:py-2 2xl:py-2.5 px-3 2xl:px-4 text-xs xl:text-sm 2xl:text-base font-bold rounded-md transition-all flex items-center justify-center gap-1.5 bg-neutral-200 text-black shadow-sm`;
            } else {
                viewEl.classList.add('hidden');
                pillEl.className = `flex-1 ${item.minW} py-1.5 xl:py-2 2xl:py-2.5 px-3 2xl:px-4 text-xs xl:text-sm 2xl:text-base font-bold rounded-md transition-all flex items-center justify-center gap-1.5 text-neutral-400 hover:text-neutral-200`;
            }
        });

        if (view === 'maps' && typeof this.updateGmapsPreview === 'function') {
            this.updateGmapsPreview();
        }
    },

    toggleGmapsPreview() {
        const box = document.getElementById('settings-gmaps-preview-box');
        if (box) {
            box.classList.toggle('hidden');
            if (!box.classList.contains('hidden') && typeof this.updateGmapsPreview === 'function') {
                this.updateGmapsPreview();
            }
        }
    },

    async saveWarnetTitle() {
        const input = document.getElementById('warnet-title-input');
        const val = input ? input.value.trim() : '';
        try {
            await API.request('/api/v1/kasir/settings/warnet_title', {
                method: 'PUT',
                body: JSON.stringify({ value: val })
            });
            Toast.success('Nama warnet berhasil disimpan');
        } catch (err) {
            Toast.error('Gagal menyimpan nama warnet: ' + err.message);
        }
    },

    async saveWarnetPhone() {
        const input = document.getElementById('warnet-phone-input');
        const val = input ? input.value.trim() : '';
        try {
            await API.request('/api/v1/kasir/settings/warnet_phone', {
                method: 'PUT',
                body: JSON.stringify({ value: val })
            });
            Toast.success('Nomor telepon berhasil disimpan');
        } catch (err) {
            Toast.error('Gagal menyimpan nomor telepon: ' + err.message);
        }
    },

    async saveWarnetAddress() {
        const input = document.getElementById('warnet-address-input');
        const val = input ? input.value.trim() : '';
        try {
            await API.request('/api/v1/kasir/settings/warnet_address', {
                method: 'PUT',
                body: JSON.stringify({ value: val })
            });
            Toast.success('Alamat warnet berhasil disimpan');
        } catch (err) {
            Toast.error('Gagal menyimpan alamat warnet: ' + err.message);
        }
    },

    async saveWarnetFooter() {
        const input = document.getElementById('warnet-footer-input');
        const val = input ? input.value.trim() : '';
        try {
            await API.request('/api/v1/kasir/settings/warnet_footer', {
                method: 'PUT',
                body: JSON.stringify({ value: val })
            });
            Toast.success('Pesan kaki struk berhasil disimpan');
        } catch (err) {
            Toast.error('Gagal menyimpan pesan kaki struk: ' + err.message);
        }
    },

    async saveWarnetGmaps() {
        const input = document.getElementById('warnet-gmaps-input');
        const val = input ? input.value.trim() : '';
        try {
            await API.request('/api/v1/kasir/settings/warnet_gmaps', {
                method: 'PUT',
                body: JSON.stringify({ value: val })
            });
            if (typeof this.updateGmapsPreview === 'function') {
                this.updateGmapsPreview();
            }
            Toast.success('Lokasi Google Maps berhasil disimpan');
        } catch (err) {
            Toast.error('Gagal menyimpan lokasi Google Maps: ' + err.message);
        }
    },

    async saveWarnetAnnouncement() {
        const announcement = this.ckeditorAnnouncementInstance
            ? this.ckeditorAnnouncementInstance.getData()
            : (document.getElementById('warnet-announcement-input')?.value || '');
        try {
            await API.request('/api/v1/kasir/settings/warnet_announcement', {
                method: 'PUT',
                body: JSON.stringify({ value: announcement })
            });
            Toast.success('Aturan & pengumuman Kiosk berhasil disimpan');
        } catch (err) {
            Toast.error('Gagal menyimpan aturan Kiosk: ' + err.message);
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

// QRIS upload kini mandiri di subtab pembayaran (previewQRIS auto-upload)

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
