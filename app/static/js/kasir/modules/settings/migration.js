// app/static/js/kasir/modules/settings/migration.js
// Migration Manager & Dashboard Update Module
// Responsif, Zero-Scrollbar, 2-Column Split, Search Filter Realtime, Dynamic Page Size & Detail Modal

const MigrationModule = {
    _status: null,
    _selectedFile: null,
    _historyList: [],
    _searchQuery: '',
    _currentPage: 1,
    _pageSize: 6,
    _mobileView: 'status',
    _activeDetailRevision: null,

    async init() {
        this._setupDropzone();
        this._setupSearch();
        this._setupResizeListener();
        this._setupModalEvents();
        await this.load();
    },

    _calcPageSize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (w < 768) return 5;
        if (w < 1024) return 8;
        if (w >= 1440 && h >= 1000) return 14;
        return 10;
    },

    _setupResizeListener() {
        window.addEventListener('resize', () => {
            const newSize = this._calcPageSize();
            if (newSize !== this._pageSize) {
                this._pageSize = newSize;
                this.renderHistoryPage();
            }
            // Auto sync mobile vs desktop layout visibility
            if (window.innerWidth >= 768) {
                const colStatus = document.getElementById('migration-col-status');
                const colHistory = document.getElementById('migration-col-history');
                if (colStatus) colStatus.classList.remove('hidden');
                if (colHistory) colHistory.classList.remove('hidden');
            } else {
                this.switchMobileView(this._mobileView || 'status');
            }
        });
    },

    _setupSearch() {
        const searchInput = document.getElementById('migration-search-input');
        if (!searchInput) return;

        searchInput.addEventListener('input', (e) => {
            this._searchQuery = (e.target.value || '').toLowerCase().trim();
            this._currentPage = 1;
            this.renderHistoryPage();
        });
    },

    _setupDropzone() {
        const dropzone = document.getElementById('migration-dropzone');
        if (!dropzone) return;

        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add('border-emerald-500', 'bg-[#121212]');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('border-emerald-500', 'bg-[#121212]');
            }, false);
        });

        dropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files.length > 0) {
                const input = document.getElementById('migration-file-input');
                if (input) {
                    input.files = files;
                    this.previewFile(input);
                }
            }
        }, false);
    },

    _setupModalEvents() {
        const modal = document.getElementById('modal-migration-detail');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeDetail();
            });
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeDetail();
        });
    },

    async load() {
        this._pageSize = this._calcPageSize();
        try {
            const data = await API.request('/api/v1/kasir/settings/migration/status');
            if (data && data.success) {
                this._status = data;
                this._historyList = data.history || [];
                this.renderStatus(data);
                
                const countBadge = document.getElementById('migration-total-count');
                if (countBadge) {
                    countBadge.textContent = `${this._historyList.length} Migrasi`;
                }

                this._currentPage = 1;
                this.renderHistoryPage();
            } else {
                this.renderError('Gagal memuat status migrasi');
            }
        } catch (err) {
            console.error('[Migration] Error loading status:', err);
            this.renderError(err.message || 'Koneksi error');
        }
    },

    renderStatus(data) {
        const badge = document.getElementById('migration-status-badge');
        const summary = document.getElementById('migration-schema-summary');

        if (badge) {
            if (data.needs_upgrade) {
                badge.textContent = '⚠️ Perlu Upgrade';
                badge.className = 'px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold font-mono bg-amber-500/20 text-amber-400 border border-amber-500/30';
                if (summary) {
                    summary.textContent = 'Perlu Upgrade';
                    summary.className = 'text-xs sm:text-sm font-mono font-bold text-amber-400 truncate block mt-0.5';
                }
            } else {
                badge.textContent = '✅ Up-to-Date';
                badge.className = 'px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
                if (summary) {
                    summary.textContent = 'Sinkron';
                    summary.className = 'text-xs sm:text-sm font-mono font-bold text-emerald-400 truncate block mt-0.5';
                }
            }
        }

        const setText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val || '-';
        };

        setText('migration-app-version', data.app_version);
        setText('migration-current-revision', data.current);
        setText('migration-head-revision', data.head);
        setText('migration-db-engine', 'SQLite 3 WAL');
        setText('migration-backup-status', 'Tersedia & Siap');
    },

    _getFilteredHistory() {
        if (!this._searchQuery) return this._historyList;
        const q = this._searchQuery;
        return this._historyList.filter(h => {
            const rev = (h.revision || '').toLowerCase();
            const down = (h.down_revision || '').toLowerCase();
            const desc = (h.description || '').toLowerCase();
            return rev.includes(q) || down.includes(q) || desc.includes(q);
        });
    },

    renderHistoryPage() {
        const tbody = document.getElementById('migration-history-table');
        if (!tbody) return;

        const filtered = this._getFilteredHistory();

        if (!filtered || filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-neutral-500 text-[10px] sm:text-[11px] font-mono">Tidak ada riwayat migrasi yang cocok</td></tr>';
            this._updatePaginationControls(1, 1);
            return;
        }

        const totalPages = Math.max(1, Math.ceil(filtered.length / this._pageSize));
        if (this._currentPage > totalPages) this._currentPage = totalPages;
        if (this._currentPage < 1) this._currentPage = 1;

        const start = (this._currentPage - 1) * this._pageSize;
        const pageItems = filtered.slice(start, start + this._pageSize);

        tbody.innerHTML = pageItems.map(h => {
            let statusBadge = '';
            if (h.is_head && h.is_current) {
                statusBadge = '<span class="text-emerald-400 font-bold text-[9px] sm:text-[10px]">⬆ HEAD / Aktif</span>';
            } else if (h.is_head) {
                statusBadge = '<span class="text-amber-400 font-bold text-[9px] sm:text-[10px]">⬆ HEAD</span>';
            } else if (h.is_current) {
                statusBadge = '<span class="text-blue-400 font-bold text-[9px] sm:text-[10px]">◉ Aktif</span>';
            } else {
                statusBadge = '<span class="text-neutral-600 text-[9px] sm:text-[10px]">—</span>';
            }

            const safeRev = (h.revision || '').replace(/'/g, "\'");

            return `
                <tr class="border-b border-[#171717] hover:bg-[#0a0a0a] transition-colors group">
                    <td class="py-2 text-[10px] sm:text-[11px] font-mono text-neutral-200 truncate w-14 sm:w-16">${h.revision || '-'}</td>
                    <td class="py-2 text-[10px] sm:text-[11px] font-mono text-neutral-500 truncate w-14 sm:w-16 hidden sm:table-cell">${h.down_revision || '-'}</td>
                    <td class="py-2 text-[10px] sm:text-[11px] text-neutral-300 truncate cursor-pointer hover:text-white" onclick="MigrationModule.showDetail('${safeRev}')" title="Klik untuk lihat detail">
                        <span class="truncate block hover:underline underline-offset-2 decoration-neutral-500">${h.description || '-'}</span>
                    </td>
                    <td class="py-2 text-center w-16 sm:w-20">${statusBadge}</td>
                    <td class="py-2 text-right w-9 sm:w-11 2xl:w-20">
                        <button type="button" onclick="MigrationModule.showDetail('${safeRev}')" title="Lihat detail lengkap"
                            class="p-1 sm:px-1.5 sm:py-0.5 rounded text-[9px] sm:text-[10px] font-medium bg-[#141414] hover:bg-neutral-800 text-neutral-300 hover:text-white border border-[#222] transition-colors inline-flex items-center gap-1 shadow-sm">
                            <svg class="w-3 h-3 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                            </svg>
                            <span class="hidden 2xl:inline">Detail</span>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        this._updatePaginationControls(this._currentPage, totalPages);
    },

    _updatePaginationControls(curr, total) {
        const info = document.getElementById('migration-page-info');
        const prevBtn = document.getElementById('migration-prev-btn');
        const nextBtn = document.getElementById('migration-next-btn');

        if (info) {
            info.textContent = `Hal ${curr} dari ${total}`;
        }
        if (prevBtn) {
            prevBtn.disabled = curr <= 1;
            if (curr <= 1) {
                prevBtn.classList.add('opacity-40', 'cursor-not-allowed', 'text-neutral-600');
                prevBtn.classList.remove('text-neutral-300', 'hover:bg-[#1a1a1a]');
            } else {
                prevBtn.classList.remove('opacity-40', 'cursor-not-allowed', 'text-neutral-600');
                prevBtn.classList.add('text-neutral-300', 'hover:bg-[#1a1a1a]');
            }
        }
        if (nextBtn) {
            nextBtn.disabled = curr >= total;
            if (curr >= total) {
                nextBtn.classList.add('opacity-40', 'cursor-not-allowed', 'text-neutral-600');
                nextBtn.classList.remove('text-neutral-300', 'hover:bg-[#1a1a1a]');
            } else {
                nextBtn.classList.remove('opacity-40', 'cursor-not-allowed', 'text-neutral-600');
                nextBtn.classList.add('text-neutral-300', 'hover:bg-[#1a1a1a]');
            }
        }
    },

    showDetail(revision) {
        const item = this._historyList.find(h => String(h.revision) === String(revision));
        if (!item) return;

        this._activeDetailRevision = item.revision;

        const revEl = document.getElementById('modal-mig-revision');
        const downEl = document.getElementById('modal-mig-down');
        const statusEl = document.getElementById('modal-mig-status');
        const descEl = document.getElementById('modal-mig-desc');
        const modal = document.getElementById('modal-migration-detail');

        if (revEl) revEl.textContent = item.revision || '-';
        if (downEl) downEl.textContent = item.down_revision || '-';

        if (statusEl) {
            if (item.is_head && item.is_current) {
                statusEl.innerHTML = '<span class="px-2 py-0.5 rounded font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">⬆ HEAD / Aktif</span>';
            } else if (item.is_head) {
                statusEl.innerHTML = '<span class="px-2 py-0.5 rounded font-bold bg-amber-950 text-amber-400 border border-amber-800">⬆ HEAD</span>';
            } else if (item.is_current) {
                statusEl.innerHTML = '<span class="px-2 py-0.5 rounded font-bold bg-blue-950 text-blue-400 border border-blue-800">◉ Aktif</span>';
            } else {
                statusEl.innerHTML = '<span class="text-neutral-500 font-mono">—</span>';
            }
        }

        if (descEl) {
            descEl.textContent = item.description || '(Tidak ada deskripsi pembaruan)';
        }

        if (modal) {
            modal.classList.remove('hidden');
        }
    },

    closeDetail() {
        const modal = document.getElementById('modal-migration-detail');
        if (modal) modal.classList.add('hidden');
        this._activeDetailRevision = null;
    },

    async copyRevision() {
        if (!this._activeDetailRevision) return;
        try {
            await navigator.clipboard.writeText(this._activeDetailRevision);
            const btn = document.getElementById('btn-copy-revision');
            if (btn) {
                const orig = btn.innerHTML;
                btn.innerHTML = `<svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg><span class="text-emerald-400">Tersalin!</span>`;
                setTimeout(() => {
                    btn.innerHTML = orig;
                }, 1500);
            }
            if (typeof Toast !== 'undefined') Toast.success('ID Revisi berhasil disalin!');
        } catch (_) {
            if (typeof Toast !== 'undefined') Toast.info(`Revisi: ${this._activeDetailRevision}`);
        }
    },

    prevPage() {
        if (this._currentPage > 1) {
            this._currentPage--;
            this.renderHistoryPage();
        }
    },

    nextPage() {
        const filtered = this._getFilteredHistory();
        const totalPages = Math.max(1, Math.ceil(filtered.length / this._pageSize));
        if (this._currentPage < totalPages) {
            this._currentPage++;
            this.renderHistoryPage();
        }
    },

    switchMobileView(view) {
        this._mobileView = view;
        const colStatus = document.getElementById('migration-col-status');
        const colHistory = document.getElementById('migration-col-history');
        const pillStatus = document.getElementById('migration-pill-status');
        const pillHistory = document.getElementById('migration-pill-history');

        if (window.innerWidth >= 768) {
            if (colStatus) colStatus.classList.remove('hidden');
            if (colHistory) colHistory.classList.remove('hidden');
            return;
        }

        if (view === 'status') {
            if (colStatus) colStatus.classList.remove('hidden');
            if (colHistory) colHistory.classList.add('hidden');

            if (pillStatus) {
                pillStatus.className = 'flex-1 py-1.5 px-3 text-[11px] font-bold rounded transition-all flex items-center justify-center gap-1.5 bg-neutral-200 text-black shadow-sm';
            }
            if (pillHistory) {
                pillHistory.className = 'flex-1 py-1.5 px-3 text-[11px] font-bold rounded transition-all flex items-center justify-center gap-1.5 text-neutral-400 hover:text-neutral-200';
            }
        } else {
            if (colStatus) colStatus.classList.add('hidden');
            if (colHistory) colHistory.classList.remove('hidden');

            if (pillHistory) {
                pillHistory.className = 'flex-1 py-1.5 px-3 text-[11px] font-bold rounded transition-all flex items-center justify-center gap-1.5 bg-neutral-200 text-black shadow-sm';
            }
            if (pillStatus) {
                pillStatus.className = 'flex-1 py-1.5 px-3 text-[11px] font-bold rounded transition-all flex items-center justify-center gap-1.5 text-neutral-400 hover:text-neutral-200';
            }
        }
    },

    renderError(msg) {
        const badge = document.getElementById('migration-status-badge');
        if (badge) {
            badge.textContent = '❌ Gagal Memuat';
            badge.className = 'px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold font-mono bg-red-500/20 text-red-400 border border-red-500/30';
        }
        const content = document.getElementById('migration-status-content');
        if (content) {
            content.innerHTML = `<div class="col-span-full text-center py-4 text-red-400 text-xs">${msg}</div>`;
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
        if (nameEl) nameEl.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;

        if (btn) {
            btn.disabled = false;
            btn.className = 'w-full py-2 bg-neutral-100 hover:bg-white text-black text-xs font-bold rounded transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer';
        }
    },

    clearSelectedFile(e) {
        if (e) e.stopPropagation();
        this._selectedFile = null;
        const input = document.getElementById('migration-file-input');
        if (input) input.value = '';

        const preview = document.getElementById('migration-file-preview');
        const btn = document.getElementById('migration-upload-btn');

        if (preview) preview.classList.add('hidden');
        if (btn) {
            btn.disabled = true;
            btn.className = 'w-full py-2 bg-neutral-800 text-neutral-500 text-xs font-bold rounded cursor-not-allowed transition-colors flex items-center justify-center gap-1.5 shadow-sm';
        }
    },

    async uploadUpdate() {
        if (!this._selectedFile) {
            if (typeof Toast !== 'undefined') Toast.error('Pilih file ZIP terlebih dahulu');
            return;
        }

        if (!this._selectedFile.name.match(/\.zip$/i)) {
            if (typeof Toast !== 'undefined') Toast.error('Hanya file .zip yang didukung');
            return;
        }

        const btn = document.getElementById('migration-upload-btn');
        const origContent = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin text-black" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg><span>Memproses...</span>`;
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

            if (result && result.success) {
                if (typeof Toast !== 'undefined') Toast.success('Update berhasil! Server akan restart...');
                
                const overlay = document.createElement('div');
                overlay.id = 'migration-restart-overlay';
                overlay.className = 'fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center';
                overlay.innerHTML = `
                    <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded-xl p-6 text-center max-w-sm">
                        <div class="text-4xl mb-3 animate-spin inline-block">⏳</div>
                        <h3 class="text-sm font-bold text-neutral-200 uppercase tracking-wider mb-1">Memproses Update &amp; Restart</h3>
                        <p class="text-xs text-neutral-400">Extract ZIP &rarr; Migrasi Database &rarr; Restart Server</p>
                    </div>
                `;
                document.body.appendChild(overlay);

                setTimeout(() => {
                    window.location.reload();
                }, 5000);
            } else {
                throw new Error(result?.error || 'Gagal mengunggah update');
            }
        } catch (err) {
            if (typeof Toast !== 'undefined') Toast.error(err.message || 'Gagal update');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origContent;
            }
        }
    }
};

window.MigrationModule = MigrationModule;

// Auto init dropzone, search & modal events when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    MigrationModule._setupDropzone();
    MigrationModule._setupSearch();
    MigrationModule._setupResizeListener();
    MigrationModule._setupModalEvents();
});
