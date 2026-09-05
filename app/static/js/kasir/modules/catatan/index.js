// app/static/js/kasir/modules/catatan/index.js
// Modul Catatan Fleksibel (.txt) untuk Kasir dan Admin TMBilling

const Catatan = {
    notes: [],
    activeFilename: null,
    currentTitle: '',
    currentContent: '',
    isDirty: false,
    autoSaveTimer: null,
    autoSaveDelay: 1500, // 1.5 detik debounce auto-save
    mobileViewMode: 'editor', // 'editor' | 'list'

    async init() {
        await this.loadNotes();
        // Keyboard shortcut global Ctrl+S saat berada di tab catatan
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                const tabCatatan = document.getElementById('tab-catatan');
                if (tabCatatan && !tabCatatan.classList.contains('hidden') && this.activeFilename) {
                    e.preventDefault();
                    this.saveCurrentNote(true);
                }
            }
        });
    },

    async loadNotes(preserveSelection = true) {
        const container = document.getElementById('notes-list-container');
        if (container) {
            container.innerHTML = `
                <div class="flex justify-center items-center py-16">
                    <div class="w-6 h-6 border-2 border-[#2a2a2a] border-t-neutral-100 rounded-full animate-spin"></div>
                </div>
            `;
        }

        try {
            const res = await API.request('/api/v1/kasir/notes');
            if (res && res.success) {
                this.notes = res.notes || [];
                this.renderList();

                if (this.notes.length > 0) {
                    if (!preserveSelection || !this.activeFilename || !this.notes.some(n => n.filename === this.activeFilename)) {
                        this.selectNote(this.notes[0].filename);
                    }
                } else {
                    this.renderEmptyEditor();
                }
            }
        } catch (err) {
            console.error('[Catatan] Gagal memuat catatan:', err);
            if (container) {
                container.innerHTML = `
                    <div class="p-4 text-center text-xs text-red-400">
                        Gagal memuat catatan: ${err.message || 'Kesalahan jaringan'}
                    </div>
                `;
            }
        }
    },

    renderList() {
        const container = document.getElementById('notes-list-container');
        const countBadge = document.getElementById('notes-count-badge');
        const filterBadge = document.getElementById('notes-filter-badge');
        if (!container) return;

        const searchInput = document.getElementById('notes-search-input');
        const clearBtn = document.getElementById('notes-search-clear-btn');
        const filterText = searchInput ? searchInput.value.toLowerCase().trim() : '';

        if (clearBtn) {
            if (filterText) clearBtn.classList.remove('hidden');
            else clearBtn.classList.add('hidden');
        }

        const filtered = this.notes.filter(n => {
            if (!filterText) return true;
            return (n.title && n.title.toLowerCase().includes(filterText)) || 
                   (n.preview && n.preview.toLowerCase().includes(filterText));
        });

        if (countBadge) {
            countBadge.textContent = `${filtered.length} Catatan`;
        }
        if (filterBadge) {
            filterBadge.textContent = filterText ? `dari ${this.notes.length} total` : 'Berkas .txt';
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-48 text-neutral-500 text-xs text-center p-4 space-y-2">
                    <i class="fa-solid ${filterText ? 'fa-magnifying-glass' : 'fa-note-sticky'} text-neutral-600 text-2xl mb-1"></i>
                    <p class="text-xs lg:text-sm font-bold text-neutral-400 uppercase tracking-wider">${filterText ? 'Catatan Tidak Ditemukan' : 'Belum Ada Catatan'}</p>
                    <p class="text-[9px] lg:text-xs text-neutral-500">${filterText ? 'Klik tombol ✕ untuk mereset filter' : 'Klik tombol "+ Catatan Baru" di atas'}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(note => {
            const isActive = note.filename === this.activeFilename;
            const isPinned = !!note.is_pinned;
            const activeClass = isActive 
                ? 'bg-[#171717] border-neutral-500 text-white shadow-sm' 
                : 'bg-[#050505] border-[#1c1c1c] text-neutral-300 hover:bg-[#121212] hover:border-[#262626]';

            const previewText = note.preview ? note.preview.replace(/\n/g, ' ') : '(Catatan kosong)';
            const sizeKb = (note.size / 1024).toFixed(1);

            return `
                <div onclick="Catatan.selectNote('${encodeURIComponent(note.filename)}')"
                    class="p-3.5 rounded border cursor-pointer transition-colors ${activeClass} flex flex-col gap-2 relative group">
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2 flex-1 min-w-0">
                            ${isPinned ? '<i class="fa-solid fa-thumbtack text-amber-400 text-xs shrink-0" title="Disematkan ke posisi paling atas"></i>' : ''}
                            <h4 class="text-xs lg:text-sm font-bold truncate flex-1 min-w-0 ${isPinned ? 'text-amber-200' : 'text-neutral-200'}">${this.escapeHtml(note.title)}</h4>
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                            <span class="text-[10px] lg:text-xs font-mono text-neutral-500">${sizeKb} KB</span>
                            <button onclick="event.stopPropagation(); Catatan.togglePinNote('${encodeURIComponent(note.filename)}')"
                                class="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-amber-400 transition-colors shrink-0"
                                title="${isPinned ? 'Lepas sematan' : 'Sematkan ke posisi atas'}">
                                <i class="fa-solid fa-thumbtack text-xs ${isPinned ? 'text-amber-400' : 'opacity-25 hover:opacity-100'}"></i>
                            </button>
                        </div>
                    </div>
                    <p class="text-xs text-neutral-400 line-clamp-2 leading-relaxed font-sans">${this.escapeHtml(previewText)}</p>
                    <div class="flex items-center justify-between text-[10px] lg:text-xs text-neutral-500 pt-1.5 border-t border-[#1c1c1c]">
                        <span class="flex items-center gap-1"><i class="fa-regular fa-clock text-[10px]"></i> ${note.updated_at || '-'}</span>
                        ${isPinned ? '<span class="text-amber-400 font-bold uppercase text-[9px] tracking-wider">Disematkan</span>' : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    filterNotes() {
        this.renderList();
    },

    clearSearch() {
        const searchInput = document.getElementById('notes-search-input');
        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
        }
        this.renderList();
    },

    async togglePinCurrentNote() {
        if (!this.activeFilename) {
            Toast.warning('Pilih catatan terlebih dahulu');
            return;
        }
        await this.togglePinNote(encodeURIComponent(this.activeFilename));
    },

    async togglePinNote(encodedFilename) {
        const filename = decodeURIComponent(encodedFilename);
        try {
            const res = await API.request(`/api/v1/kasir/notes/${encodeURIComponent(filename)}/pin`, {
                method: 'POST'
            });
            if (res && res.success && res.result) {
                const isPinned = res.result.is_pinned;
                const note = this.notes.find(n => n.filename === filename);
                if (note) {
                    note.is_pinned = isPinned;
                }

                // Urutkan: Pinned selalu di atas, lalu timestamp terbaru
                this.notes.sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) || (b.updated_timestamp - a.updated_timestamp));

                if (this.activeFilename === filename) {
                    this.updatePinButtonState(isPinned);
                }
                this.renderList();
                Toast.success(isPinned ? 'Catatan disematkan ke posisi teratas' : 'Sematan catatan dilepas');
            }
        } catch (err) {
            Toast.error('Gagal mengubah status sematan: ' + err.message);
        }
    },

    updatePinButtonState(isPinned) {
        const pinBtn = document.getElementById('btn-pin-note');
        const pinIcon = document.getElementById('btn-pin-icon');
        if (!pinBtn) return;
        if (isPinned) {
            pinBtn.className = 'p-2.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-400 transition-colors shrink-0 flex items-center justify-center shadow-sm';
            pinBtn.title = 'Lepas sematan catatan ini';
            if (pinIcon) pinIcon.className = 'fa-solid fa-thumbtack text-xs lg:text-sm text-amber-400';
        } else {
            pinBtn.className = 'p-2.5 rounded bg-[#171717] hover:bg-[#222] border border-[#262626] text-neutral-400 hover:text-amber-400 transition-colors shrink-0 flex items-center justify-center';
            pinBtn.title = 'Sematkan catatan ini ke posisi paling atas';
            if (pinIcon) pinIcon.className = 'fa-solid fa-thumbtack text-xs lg:text-sm opacity-60 hover:opacity-100';
        }
        pinBtn.disabled = false;
    },

    async selectNote(encodedFilename) {
        const filename = decodeURIComponent(encodedFilename);
        if (this.isDirty && this.activeFilename && this.activeFilename !== filename) {
            // Simpan catatan yang sedang aktif sebelum berganti
            await this.saveCurrentNote(false);
        }

        this.activeFilename = filename;
        this.setSaveStatus('Memuat...', 'bg-neutral-800 text-neutral-300 border-neutral-700');

        try {
            const res = await API.request(`/api/v1/kasir/notes/${encodeURIComponent(filename)}`);
            if (res && res.success && res.note) {
                const note = res.note;
                this.currentTitle = note.title;
                this.currentContent = note.content;
                this.isDirty = false;

                const titleInput = document.getElementById('note-title-input');
                const contentEditor = document.getElementById('note-content-editor');
                const fileSize = document.getElementById('note-file-size');

                if (titleInput) titleInput.value = note.title;
                if (contentEditor) {
                    contentEditor.value = note.content;
                    contentEditor.disabled = false;
                }
                if (fileSize) fileSize.textContent = `${(note.size / 1024).toFixed(1)} KB`;

                const dupBtn = document.getElementById('btn-duplicate-note');
                const delBtn = document.getElementById('btn-delete-note');
                const dlBtn = document.getElementById('btn-download-note');
                if (dupBtn) dupBtn.disabled = false;
                if (delBtn) delBtn.disabled = false;
                if (dlBtn) dlBtn.disabled = false;
                this.updatePinButtonState(!!note.is_pinned);

                this.setSaveStatus('Tersimpan', 'bg-neutral-800 text-neutral-400 border-neutral-700');
                this.updateStats();
                this.renderList();

                // Pada tampilan mobile, alihkan fokus ke editor
                if (window.innerWidth < 768) {
                    this.showEditorPanelMobile();
                }
            }
        } catch (err) {
            Toast.error('Gagal membuka catatan: ' + err.message);
            this.setSaveStatus('Gagal', 'bg-red-950/40 text-red-400 border-red-800/60');
        }
    },

    renderEmptyEditor() {
        this.activeFilename = null;
        this.currentTitle = '';
        this.currentContent = '';
        this.isDirty = false;

        const titleInput = document.getElementById('note-title-input');
        const contentEditor = document.getElementById('note-content-editor');
        const fileSize = document.getElementById('note-file-size');
        const pinBtn = document.getElementById('btn-pin-note');
        const dupBtn = document.getElementById('btn-duplicate-note');
        const delBtn = document.getElementById('btn-delete-note');
        const dlBtn = document.getElementById('btn-download-note');

        if (titleInput) titleInput.value = '';
        if (contentEditor) {
            contentEditor.value = '';
            contentEditor.disabled = true;
        }
        if (fileSize) fileSize.textContent = '0 B';
        if (pinBtn) pinBtn.disabled = true;
        if (dupBtn) dupBtn.disabled = true;
        if (delBtn) delBtn.disabled = true;
        if (dlBtn) dlBtn.disabled = true;
        this.updatePinButtonState(false);

        this.setSaveStatus('Belum ada catatan', 'bg-neutral-800 text-neutral-500 border-neutral-700');
        this.updateStats();
    },

    async createNewNote() {
        const defaultTitle = `Catatan ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`;
        try {
            const res = await API.request('/api/v1/kasir/notes', {
                method: 'POST',
                body: JSON.stringify({
                    title: defaultTitle,
                    content: ''
                })
            });

            if (res && res.success && res.note) {
                Toast.success('Catatan baru berhasil dibuat');
                await this.loadNotes(false);
                this.selectNote(res.note.filename);

                const titleInput = document.getElementById('note-title-input');
                if (titleInput) {
                    titleInput.focus();
                    titleInput.select();
                }
            }
        } catch (err) {
            Toast.error('Gagal membuat catatan baru: ' + err.message);
        }
    },

    async duplicateCurrentNote() {
        if (!this.activeFilename) {
            Toast.warning('Pilih catatan yang ingin diduplikasi');
            return;
        }

        try {
            const res = await API.request(`/api/v1/kasir/notes/${encodeURIComponent(this.activeFilename)}/duplicate`, {
                method: 'POST'
            });

            if (res && res.success && res.note) {
                Toast.success(`Salinan dibuat: "${res.note.title}"`);
                await this.loadNotes(false);
                this.selectNote(res.note.filename);
            }
        } catch (err) {
            Toast.error('Gagal menduplikasi catatan: ' + err.message);
        }
    },

    onTitleChange() {
        const titleInput = document.getElementById('note-title-input');
        if (!titleInput) return;
        this.currentTitle = titleInput.value;
        this.isDirty = true;
        this.setSaveStatus('Ada perubahan...', 'bg-amber-500/20 text-amber-300 border-amber-500/40');
        this.triggerAutoSave();
    },

    onContentChange() {
        const contentEditor = document.getElementById('note-content-editor');
        if (!contentEditor) return;
        this.currentContent = contentEditor.value;
        this.isDirty = true;
        this.updateStats();
        this.setSaveStatus('Mengetik...', 'bg-neutral-800 text-neutral-300 border-neutral-600');
        this.triggerAutoSave();
    },

    triggerAutoSave() {
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }
        this.autoSaveTimer = setTimeout(() => {
            this.saveCurrentNote(false);
        }, this.autoSaveDelay);
    },

    async saveCurrentNote(manual = false) {
        if (!this.activeFilename) return;
        if (!this.isDirty && !manual) return;

        const titleInput = document.getElementById('note-title-input');
        const contentEditor = document.getElementById('note-content-editor');

        const title = titleInput ? titleInput.value.trim() : this.currentTitle;
        const content = contentEditor ? contentEditor.value : this.currentContent;

        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }

        this.setSaveStatus('Menyimpan...', 'bg-neutral-800 text-neutral-200 border-neutral-600');

        try {
            const res = await API.request(`/api/v1/kasir/notes/${encodeURIComponent(this.activeFilename)}`, {
                method: 'PUT',
                body: JSON.stringify({
                    title: title || 'Catatan Tanpa Judul',
                    content: content
                })
            });

            if (res && res.success && res.note) {
                this.isDirty = false;
                const oldFilename = this.activeFilename;
                this.activeFilename = res.note.filename;
                this.currentTitle = res.note.title;
                this.currentContent = res.note.content;

                const fileSize = document.getElementById('note-file-size');
                if (fileSize) fileSize.textContent = `${(res.note.size / 1024).toFixed(1)} KB`;

                this.setSaveStatus('Tersimpan', 'bg-neutral-800 text-neutral-400 border-neutral-700');
                if (manual) {
                    Toast.success('Catatan berhasil disimpan');
                }

                // Update info di array lokal tanpa re-render penuh jika hanya isi berubah
                const existing = this.notes.find(n => n.filename === oldFilename);
                if (existing) {
                    existing.filename = res.note.filename;
                    existing.title = res.note.title;
                    existing.size = res.note.size;
                    existing.preview = content.slice(0, 160).trim();
                    existing.updated_at = res.note.updated_at;
                    if (res.note.is_pinned !== undefined) existing.is_pinned = res.note.is_pinned;
                }
                this.renderList();

                setTimeout(() => {
                    if (!this.isDirty) {
                        this.setSaveStatus('Tersimpan', 'bg-neutral-800 text-neutral-400 border-neutral-700');
                    }
                }, 3000);
            }
        } catch (err) {
            this.setSaveStatus('Gagal simpan', 'bg-red-950/40 text-red-400 border-red-800/60');
            Toast.error('Gagal menyimpan catatan: ' + err.message);
        }
    },

    openDeleteModal() {
        if (!this.activeFilename) {
            Toast.warning('Pilih catatan yang ingin dihapus');
            return;
        }

        const modal = document.getElementById('notes-delete-modal');
        const filenameEl = document.getElementById('notes-delete-filename');
        if (filenameEl) {
            const displayName = this.currentTitle ? (this.currentTitle.endsWith('.txt') ? this.currentTitle : `${this.currentTitle}.txt`) : (this.activeFilename || '');
            filenameEl.textContent = displayName;
        }
        if (modal) modal.classList.remove('hidden');
    },

    closeDeleteModal() {
        const modal = document.getElementById('notes-delete-modal');
        if (modal) modal.classList.add('hidden');
    },

    async confirmDeleteNote() {
        if (!this.activeFilename) return;
        const title = this.currentTitle || this.activeFilename;
        const filenameToDelete = this.activeFilename;
        this.closeDeleteModal();

        try {
            const res = await API.request(`/api/v1/kasir/notes/${encodeURIComponent(filenameToDelete)}`, {
                method: 'DELETE'
            });

            if (res && res.success) {
                Toast.success(`Catatan "${title}" berhasil dihapus`);
                this.activeFilename = null;
                await this.loadNotes(false);
            }
        } catch (err) {
            Toast.error('Gagal menghapus catatan: ' + err.message);
        }
    },

    downloadCurrentNote() {
        if (!this.activeFilename) {
            Toast.warning('Pilih catatan terlebih dahulu');
            return;
        }
        const downloadUrl = `/api/v1/kasir/notes/${encodeURIComponent(this.activeFilename)}/download`;
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = this.activeFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        Toast.info(`Mengunduh ${this.activeFilename}...`);
    },

    handleEditorKeydown(e) {
        // Izinkan indentasi Tab pada textarea
        if (e.key === 'Tab') {
            e.preventDefault();
            const textarea = e.target;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            textarea.value = textarea.value.substring(0, start) + "\t" + textarea.value.substring(end);
            textarea.selectionStart = textarea.selectionEnd = start + 1;
            this.onContentChange();
        }
    },

    updateStats() {
        const statsEl = document.getElementById('note-stats-text');
        if (!statsEl) return;

        const text = this.currentContent || '';
        const charCount = text.length;
        const lineCount = text ? text.split('\n').length : 1;
        const words = text.trim().split(/\s+/).filter(w => w.length > 0);
        const wordCount = words.length;

        statsEl.textContent = `${wordCount} kata • ${charCount} karakter • ${lineCount} baris`;
    },

    setSaveStatus(text, badgeClass) {
        const statusEl = document.getElementById('note-save-status');
        if (statusEl) {
            statusEl.textContent = text;
            statusEl.className = `px-3.5 py-1.5 rounded text-xs lg:text-base font-semibold border transition-colors ${badgeClass}`;
        }
    },

    toggleMobileView() {
        const sidebar = document.getElementById('notes-sidebar-panel');
        const editor = document.getElementById('notes-editor-panel');
        const toggleIcon = document.getElementById('notes-mobile-toggle-icon');
        const toggleText = document.getElementById('notes-mobile-toggle-text');

        if (!sidebar || !editor) return;

        if (sidebar.classList.contains('hidden')) {
            // Tampilkan list
            sidebar.classList.remove('hidden');
            editor.classList.add('hidden');
            if (toggleIcon) toggleIcon.className = 'fa-solid fa-pen-to-square text-xs';
            if (toggleText) toggleText.textContent = 'Editor';
        } else {
            // Tampilkan editor
            sidebar.classList.add('hidden');
            editor.classList.remove('hidden');
            if (toggleIcon) toggleIcon.className = 'fa-solid fa-folder text-xs';
            if (toggleText) toggleText.textContent = 'Daftar';
        }
    },

    showEditorPanelMobile() {
        if (window.innerWidth >= 768) return;
        const sidebar = document.getElementById('notes-sidebar-panel');
        const editor = document.getElementById('notes-editor-panel');
        const toggleIcon = document.getElementById('notes-mobile-toggle-icon');
        const toggleText = document.getElementById('notes-mobile-toggle-text');

        if (sidebar && editor) {
            sidebar.classList.add('hidden');
            editor.classList.remove('hidden');
            if (toggleIcon) toggleIcon.className = 'fa-solid fa-folder text-xs';
            if (toggleText) toggleText.textContent = 'Daftar';
        }
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

window.Catatan = Catatan;

document.addEventListener('DOMContentLoaded', () => {
    // Siapkan modul Catatan
    Catatan.init();
});
