// static/js/kasir/modules/fileexplorer/index.js

const FileExplorer = {
    currentPath: '',
    items: [],
    activeFile: null,
    activeFileMtime: null,
    roots: [],
    tempRoots: [],
    editor: null, // text area or CodeMirror instance

    async init() {
        // Coba load editor
        this.initEditor();
    },

    initEditor() {
        const container = document.getElementById('fe-editor-container');
        if (!container) return;
        
        // Kita gunakan textarea kustom bertema Noir Dark sebagai basis editor yang tangguh
        container.innerHTML = `
            <textarea id="fe-textarea-editor" class="w-full h-full p-4 bg-[#050505] text-neutral-200 border-none outline-none font-mono resize-none focus:ring-0 leading-relaxed text-xs" 
                spellcheck="false" placeholder="Tulis kode/teks di sini..."></textarea>
        `;
        
        const textarea = document.getElementById('fe-textarea-editor');
        if (textarea) {
            textarea.addEventListener('input', () => {
                const status = document.getElementById('fe-editor-status');
                if (status) status.textContent = 'Belum disimpan *';
                const saveBtn = document.getElementById('fe-save-btn');
                if (saveBtn) saveBtn.disabled = false;
            });
            
            // Tangkap shortcut Ctrl+S untuk simpan berkas
            textarea.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    this.saveFile();
                }
            });
        }
    },

    async load() {
        try {
            const res = await API.fileexplorer.getRoots();
            if (res && res.success) {
                this.roots = res.roots;
                if (this.roots.length > 0) {
                    await this.openDirectory(this.roots[0]);
                }
            }
        } catch (err) {
            Toast.error('Gagal memuat allowed roots: ' + err.message);
        }
    },

    async openDirectory(path) {
        try {
            const res = await API.fileexplorer.list(path);
            if (res && res.success) {
                this.currentPath = res.current_path;
                this.items = res.items;
                this.renderBreadcrumbs();
                this.renderItemList();
            } else {
                Toast.error('Gagal membuka folder: ' + res.error);
            }
        } catch (err) {
            Toast.error('Gagal memuat isi folder: ' + err.message);
        }
    },

    refresh() {
        this.openDirectory(this.currentPath);
    },

    renderBreadcrumbs() {
        const container = document.getElementById('fe-breadcrumbs');
        if (!container) return;
        container.innerHTML = '';

        // Deteksi OS separator (Windows backslash vs Unix slash)
        const isWindows = this.currentPath.includes('\\');
        const separator = isWindows ? '\\' : '/';
        const parts = this.currentPath.split(separator).filter(p => p !== '');
        
        let pathAccumulator = isWindows ? '' : '/';
        
        // Link untuk root utama
        if (isWindows && this.currentPath.match(/^[a-zA-Z]:/)) {
            const drive = this.currentPath.split(':')[0] + ':';
            pathAccumulator = drive;
            const driveSpan = document.createElement('span');
            driveSpan.className = 'hover:text-white cursor-pointer';
            driveSpan.textContent = drive;
            driveSpan.onclick = () => this.openDirectory(drive);
            container.appendChild(driveSpan);
        }

        parts.forEach((part, index) => {
            // Tambahkan separator
            const sep = document.createElement('span');
            sep.className = 'mx-1.5 text-neutral-600 select-none';
            sep.textContent = '>';
            container.appendChild(sep);

            // Tambahkan path
            if (isWindows) {
                if (pathAccumulator && !pathAccumulator.endsWith('\\')) {
                    pathAccumulator += '\\';
                }
                pathAccumulator += part;
            } else {
                if (pathAccumulator !== '/') pathAccumulator += '/';
                pathAccumulator += part;
            }

            const currentTarget = pathAccumulator;
            const partSpan = document.createElement('span');
            partSpan.className = 'hover:text-white cursor-pointer truncate max-w-[120px] inline-block align-middle';
            partSpan.textContent = part;
            partSpan.onclick = () => this.openDirectory(currentTarget);
            container.appendChild(partSpan);
        });
    },

    renderItemList() {
        const container = document.getElementById('fe-item-list');
        if (!container) return;
        container.innerHTML = '';

        if (this.items.length === 0) {
            container.innerHTML = '<div class="p-3 text-neutral-600 italic">Folder ini kosong</div>';
            return;
        }

        // Parent directory link jika bukan root allowed_roots
        const isRootAllowed = this.roots.map(r => r.toLowerCase()).includes(this.currentPath.toLowerCase());
        if (!isRootAllowed) {
            const parentDiv = document.createElement('div');
            parentDiv.className = 'flex items-center gap-2 p-1.5 rounded hover:bg-[#121212] hover:text-neutral-200 cursor-pointer font-semibold text-neutral-500';
            
            const isWindows = this.currentPath.includes('\\');
            const sep = isWindows ? '\\' : '/';
            const parts = this.currentPath.split(sep);
            parts.pop();
            const parentPath = parts.join(sep) || (isWindows ? '' : '/');

            parentDiv.innerHTML = `<span>⬆️</span> <span>.. (Parent Directory)</span>`;
            parentDiv.onclick = () => this.openDirectory(parentPath);
            container.appendChild(parentDiv);
        }

        this.items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'flex items-center justify-between group p-2 rounded hover:bg-[#121212] hover:text-neutral-200 cursor-pointer transition-all';
            itemDiv.onclick = () => {
                if (item.is_dir) {
                    this.openDirectory(item.path);
                } else {
                    this.openFile(item.path);
                }
            };
            
            const icon = item.is_dir ? '📁' : '📄';
            const sizeStr = item.size !== null ? ` (${this.formatBytes(item.size)})` : '';
            
            // Name and Icon Container
            const leftDiv = document.createElement('div');
            leftDiv.className = 'flex items-center gap-2 min-w-0 flex-1';
            leftDiv.innerHTML = `<span class="shrink-0">${icon}</span> <span class="truncate" title="${item.name}">${item.name}${sizeStr}</span>`;
            itemDiv.appendChild(leftDiv);

            // Action Buttons (Rename / Delete)
            const rightDiv = document.createElement('div');
            rightDiv.className = 'opacity-0 group-hover:opacity-100 flex items-center gap-1.5 shrink-0 pl-2 transition-opacity';
            
            const renameBtn = document.createElement('button');
            renameBtn.className = 'text-neutral-500 hover:text-neutral-300' ;
            renameBtn.innerHTML = '✏️';
            renameBtn.title = 'Ubah Nama';
            renameBtn.onclick = (e) => {
                e.stopPropagation();
                this.renameItem(item.path);
            };
            rightDiv.appendChild(renameBtn);

            // Jangan izinkan hapus root folder dari daftar list
            if (!this.roots.includes(item.path)) {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'text-neutral-500 hover:text-red-400';
                deleteBtn.innerHTML = '🗑️';
                deleteBtn.title = 'Hapus';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.deleteItem(item.path);
                };
                rightDiv.appendChild(deleteBtn);
            }

            itemDiv.appendChild(rightDiv);
            container.appendChild(itemDiv);
        });
    },

    filterItems() {
        const query = document.getElementById('fe-search-input')?.value.toLowerCase() || '';
        const listItems = document.querySelectorAll('#fe-item-list > div');
        
        listItems.forEach(div => {
            const text = div.innerText.toLowerCase();
            // Lewatkan parent directory (..)
            if (text.includes('.. (parent directory)')) return;
            
            if (text.includes(query)) {
                div.classList.remove('hidden');
            } else {
                div.classList.add('hidden');
            }
        });
    },

    async openFile(path) {
        try {
            const res = await API.fileexplorer.read(path);
            const placeholder = document.getElementById('fe-editor-placeholder');
            const fileInfo = document.getElementById('fe-file-info');
            const textarea = document.getElementById('fe-textarea-editor');
            const status = document.getElementById('fe-editor-status');
            const saveBtn = document.getElementById('fe-save-btn');

            if (res && res.success) {
                this.activeFile = path;
                this.activeFileMtime = res.mtime;

                if (placeholder) placeholder.classList.add('hidden');
                if (fileInfo) {
                    const filename = path.split(/[\\/]/).pop();
                    fileInfo.textContent = `📄 ${filename} (${this.formatBytes(res.size)})`;
                }
                if (textarea) {
                    textarea.value = res.content;
                    textarea.disabled = false;
                }
                if (status) status.textContent = 'Tersimpan';
                if (saveBtn) saveBtn.disabled = true;

                // Mobile view switch: hide list, show editor
                const leftPanel = document.getElementById('fe-left-panel');
                const rightPanel = document.getElementById('fe-right-panel');
                if (leftPanel && rightPanel && window.innerWidth < 768) {
                    leftPanel.classList.add('hidden');
                    rightPanel.classList.remove('hidden');
                }

                Toast.success('Berkas berhasil dimuat');
            } else {
                Toast.error('Gagal memuat berkas: ' + (res.error || 'Terjadi kesalahan'));
            }
        } catch (err) {
            Toast.error('Gagal membaca berkas: ' + err.message);
        }
    },

    backToTree() {
        const leftPanel = document.getElementById('fe-left-panel');
        const rightPanel = document.getElementById('fe-right-panel');
        if (leftPanel && rightPanel) {
            leftPanel.classList.remove('hidden');
            rightPanel.classList.add('hidden');
        }
    },

    async saveFile() {
        if (!this.activeFile) return;
        const textarea = document.getElementById('fe-textarea-editor');
        if (!textarea) return;

        const content = textarea.value;
        const saveBtn = document.getElementById('fe-save-btn');
        const status = document.getElementById('fe-editor-status');

        if (status) status.textContent = 'Sedang menyimpan...';

        try {
            const res = await API.fileexplorer.save(this.activeFile, content, this.activeFileMtime);
            if (res && res.success) {
                this.activeFileMtime = res.mtime;
                if (status) status.textContent = 'Tersimpan';
                if (saveBtn) saveBtn.disabled = true;
                Toast.success('Perubahan berhasil disimpan');
            } else {
                if (status) status.textContent = 'Gagal menyimpan';
                // Jika terjadi konflik, tanyakan override
                if (res.error && res.error.includes('Conflict')) {
                    if (confirm('Konflik: Berkas telah diubah di disk oleh pihak lain. Apakah Anda ingin menimpa secara paksa?')) {
                        this.forceSaveFile(content);
                    }
                } else {
                    Toast.error('Gagal menyimpan berkas: ' + res.error);
                }
            }
        } catch (err) {
            if (status) status.textContent = 'Gagal menyimpan';
            Toast.error('Gagal menyimpan: ' + err.message);
        }
    },

    async forceSaveFile(content) {
        const saveBtn = document.getElementById('fe-save-btn');
        const status = document.getElementById('fe-editor-status');
        try {
            const res = await API.fileexplorer.save(this.activeFile, content, null, true);
            if (res && res.success) {
                this.activeFileMtime = res.mtime;
                if (status) status.textContent = 'Tersimpan';
                if (saveBtn) saveBtn.disabled = true;
                Toast.success('Perubahan berhasil disimpan paksa');
            } else {
                Toast.error('Gagal menyimpan paksa: ' + res.error);
            }
        } catch (err) {
            Toast.error('Gagal menyimpan paksa: ' + err.message);
        }
    },

    createItem(isDir) {
        const type = isDir ? 'Folder' : 'Berkas';
        const name = prompt(`Masukkan nama ${type} baru:`);
        if (!name) return;

        API.fileexplorer.create(this.currentPath, name, isDir)
            .then(res => {
                if (res && res.success) {
                    Toast.success(`${type} berhasil dibuat`);
                    this.refresh();
                } else {
                    Toast.error(`Gagal membuat ${type}: ` + res.error);
                }
            })
            .catch(err => {
                Toast.error(`Gagal membuat ${type}: ` + err.message);
            });
    },

    renameItem(path) {
        const currentName = path.split(/[\\/]/).pop();
        const newName = prompt('Masukkan nama baru:', currentName);
        if (!newName || newName === currentName) return;

        API.fileexplorer.rename(path, newName)
            .then(res => {
                if (res && res.success) {
                    Toast.success('Nama berhasil diubah');
                    this.refresh();
                    // Jika file yang sedang aktif di-rename, update data aktif
                    if (this.activeFile === path) {
                        this.activeFile = res.path;
                        const fileInfo = document.getElementById('fe-file-info');
                        if (fileInfo) {
                            fileInfo.textContent = `📄 ${newName}`;
                        }
                    }
                } else {
                    Toast.error('Gagal merename: ' + res.error);
                }
            })
            .catch(err => {
                Toast.error('Gagal merename: ' + err.message);
            });
    },

    deleteItem(path) {
        const name = path.split(/[\\/]/).pop();
        if (!confirm(`Apakah Anda yakin ingin menghapus "${name}"?`)) return;

        API.fileexplorer.delete(path)
            .then(res => {
                if (res && res.success) {
                    Toast.success('Berhasil dihapus');
                    this.refresh();
                    // Jika file yang aktif dihapus, reset editor
                    if (this.activeFile === path) {
                        this.activeFile = null;
                        this.activeFileMtime = null;
                        const placeholder = document.getElementById('fe-editor-placeholder');
                        const fileInfo = document.getElementById('fe-file-info');
                        const textarea = document.getElementById('fe-textarea-editor');
                        if (placeholder) placeholder.classList.remove('hidden');
                        if (fileInfo) fileInfo.textContent = 'Tidak ada berkas terbuka';
                        if (textarea) {
                            textarea.value = '';
                            textarea.disabled = true;
                        }
                    }
                } else {
                    Toast.error('Gagal menghapus: ' + res.error);
                }
            })
            .catch(err => {
                Toast.error('Gagal menghapus: ' + err.message);
            });
    },

    // Allowed Roots Modals
    openRootsModal() {
        const modal = document.getElementById('fe-roots-modal');
        if (!modal) return;
        modal.classList.remove('hidden');

        // Copy roots
        this.tempRoots = [...this.roots];
        this.renderRootsList();
    },

    closeRootsModal() {
        const modal = document.getElementById('fe-roots-modal');
        if (modal) modal.classList.add('hidden');
    },

    renderRootsList() {
        const container = document.getElementById('fe-roots-list');
        if (!container) return;
        container.innerHTML = '';

        this.tempRoots.forEach((root, index) => {
            const rootItem = document.createElement('div');
            rootItem.className = 'flex items-center justify-between p-2 bg-[#171717] rounded border border-[#222] text-xs text-neutral-300';
            rootItem.innerHTML = `
                <span class="truncate font-mono">${root}</span>
                <button onclick="FileExplorer.removeRoot(${index})" class="text-red-400 hover:text-red-300 font-bold shrink-0 pl-3">Hapus</button>
            `;
            container.appendChild(rootItem);
        });
    },

    addRoot() {
        const input = document.getElementById('fe-new-root-input');
        if (!input) return;
        const newPath = input.value.trim();
        if (!newPath) return;

        if (this.tempRoots.includes(newPath)) {
            Toast.error('Path sudah terdaftar');
            return;
        }

        this.tempRoots.push(newPath);
        this.renderRootsList();
        input.value = '';
    },

    removeRoot(index) {
        if (this.tempRoots.length <= 1) {
            Toast.error('Wajib menyisakan minimal satu allowed root directory');
            return;
        }
        this.tempRoots.splice(index, 1);
        this.renderRootsList();
    },

    async saveRoots() {
        try {
            const res = await API.fileexplorer.setRoots(this.tempRoots);
            if (res && res.success) {
                this.roots = res.roots;
                this.closeRootsModal();
                Toast.success('Daftar direktori diizinkan berhasil diperbarui');
                // Reload explorer ke root pertama yang baru
                if (this.roots.length > 0) {
                    this.openDirectory(this.roots[0]);
                }
            } else {
                Toast.error('Gagal memperbarui: ' + res.error);
            }
        } catch (err) {
            Toast.error('Gagal memperbarui Allowed Roots: ' + err.message);
        }
    },

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
};

window.FileExplorer = FileExplorer;

document.addEventListener('DOMContentLoaded', () => {
    FileExplorer.init();
});
