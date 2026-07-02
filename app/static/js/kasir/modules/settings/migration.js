// app/static/js/kasir/modules/settings/migration.js
// Migration Manager & Dashboard Update Module

const MigrationModule = {
    _status: null,
    _selectedFile: null,

    async init() {
        await this.load();
    },

    async load() {
        try {
            const data = await API.request('/api/v1/kasir/settings/migration/status');
            if (data.success) {
                this._status = data;
                this.renderStatus(data);
                this.renderHistory(data.history || []);
            } else {
                this.renderError('Gagal memuat status migrasi');
            }
        } catch (err) {
            console.error('[Migration] Error loading status:', err);
            this.renderError(err.message);
        }
    },

    renderStatus(data) {
        const badge = document.getElementById('migration-status-badge');
        if (!badge) return;

        if (data.needs_upgrade) {
            badge.textContent = '⚠️ Perlu Upgrade';
            badge.className = 'px-3 py-1 rounded text-[10px] lg:text-xs font-bold font-mono bg-amber-500/20 text-amber-400 border border-amber-500/30';
        } else {
            badge.textContent = '✅ Up-to-Date';
            badge.className = 'px-3 py-1 rounded text-[10px] lg:text-xs font-bold font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
        }

        const setText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val || '-';
        };

        setText('migration-app-version', data.app_version);
        setText('migration-current-revision', data.current);
        setText('migration-head-revision', data.head);
    },

    renderHistory(history) {
        const tbody = document.getElementById('migration-history-table');
        if (!tbody) return;

        if (!history || history.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-neutral-500 text-xs lg:text-sm font-mono">Tidak ada riwayat migrasi</td></tr>';
            return;
        }

        tbody.innerHTML = history.map(h => {
            let statusBadge = '';
            if (h.is_head && h.is_current) {
                statusBadge = '<span class="text-emerald-400 font-bold text-[10px] lg:text-xs">⬆ HEAD / Aktif</span>';
            } else if (h.is_head) {
                statusBadge = '<span class="text-amber-400 font-bold text-[10px] lg:text-xs">⬆ HEAD</span>';
            } else if (h.is_current) {
                statusBadge = '<span class="text-blue-400 font-bold text-[10px] lg:text-xs">◉ Aktif</span>';
            } else {
                statusBadge = '<span class="text-neutral-500 text-[10px] lg:text-xs">—</span>';
            }

            return `
                <tr class="border-b border-neutral-800 hover:bg-[#0c0c0c] transition-colors">
                    <td class="py-2.5 text-[10px] lg:text-xs font-mono text-neutral-200">${h.revision || '-'}</td>
                    <td class="py-2.5 text-[10px] lg:text-xs font-mono text-neutral-500">${h.down_revision || '-'}</td>
                    <td class="py-2.5 text-[10px] lg:text-xs text-neutral-300">${h.description}</td>
                    <td class="py-2.5 text-right">${statusBadge}</td>
                </tr>
            `;
        }).join('');
    },

    renderError(msg) {
        const badge = document.getElementById('migration-status-badge');
        if (badge) {
            badge.textContent = '❌ Gagal Memuat';
            badge.className = 'px-3 py-1 rounded text-[10px] lg:text-xs font-bold font-mono bg-red-500/20 text-red-400 border border-red-500/30';
        }
        const content = document.getElementById('migration-status-content');
        if (content) {
            content.innerHTML = `<div class="text-center py-4 text-red-400 text-xs lg:text-sm">${msg}</div>`;
        }
    },

    previewFile(input) {
        const file = input.files[0];
        if (!file) return;
        this._selectedFile = file;

        const preview = document.getElementById('migration-file-preview');
        const nameEl = document.getElementById('migration-file-name');
        const btn = document.getElementById('migration-upload-btn');

        if (preview) preview.classList.remove('hidden');
        if (nameEl) nameEl.textContent = `📄 ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;

        if (btn) {
            btn.disabled = false;
            btn.className = 'px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-black text-xs lg:text-base font-bold rounded transition-colors cursor-pointer';
            btn.textContent = '⬆ Unggah & Update Aplikasi';
        }
    },

    async uploadUpdate() {
        if (!this._selectedFile) {
            Toast.error('Pilih file ZIP terlebih dahulu');
            return;
        }

        if (!this._selectedFile.name.match(/\.zip$/i)) {
            Toast.error('Hanya file .zip yang didukung');
            return;
        }

        const btn = document.getElementById('migration-upload-btn');
        const progress = document.getElementById('migration-progress-bar');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="animate-spin inline-block">⏳</span> Memproses...';
        }

        if (progress) {
            progress.style.width = '100%';
            progress.classList.remove('hidden');
        }

        try {
            const formData = new FormData();
            formData.append('update_file', this._selectedFile);

            const resp = await fetch('/api/v1/kasir/settings/migration/upload', {
                method: 'POST',
                headers: {
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
                },
                body: formData
            });

            const result = await resp.json();

            if (result.success) {
                Toast.success('✅ Update berhasil! Server akan restart...');
                // Tampilkan overlay restart
                const overlay = document.createElement('div');
                overlay.id = 'migration-restart-overlay';
                overlay.className = 'fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center';
                overlay.innerHTML = `
                    <div class="text-center p-8">
                        <div class="text-5xl mb-4 animate-spin inline-block">⏳</div>
                        <p class="text-neutral-200 text-sm lg:text-base font-bold uppercase tracking-wider">Memproses Update & Merestart Server...</p>
                        <p class="text-neutral-500 text-xs lg:text-sm mt-2">Extract ZIP → Migrasi Database → Restart</p>
                    </div>
                `;
                document.body.appendChild(overlay);

                // Auto reload setelah 5 detik
                setTimeout(() => {
                    window.location.reload();
                }, 5000);
            } else {
                throw new Error(result.error || 'Gagal mengunggah update');
            }
        } catch (err) {
            Toast.error(err.message);
            if (btn) {
                btn.disabled = false;
                btn.textContent = '⬆ Unggah & Update Aplikasi';
            }
            if (progress) {
                progress.style.width = '0%';
                progress.classList.add('hidden');
            }
        }
    },

};


