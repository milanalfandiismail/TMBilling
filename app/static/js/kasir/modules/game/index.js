const GameManagement = {
    games: [],
    categories: [],
    currentCategory: 'all',
    searchQuery: '',

    async init() {
        await this.fetchCategories();
        await this.fetchGames();
    },

    async fetchCategories() {
        try {
            const res = await API.request('/api/v1/kasir/game/kategori');
            if (res.success) {
                this.categories = res.data;
                this.renderCategoryFilters();
                this.renderCategoryOptions();
            }
        } catch (e) {
            console.error('Error fetching categories:', e);
        }
    },

    async fetchGames() {
        try {
            const url = `/api/v1/kasir/game/?category=${this.currentCategory}&q=${this.searchQuery}`;
            const res = await API.request(url);
            if (res.success) {
                this.games = res.data;
                this.renderGames();
            }
        } catch (e) {
            console.error('Error fetching games:', e);
        }
    },

    renderCategoryFilters() {
        const filterSelect = document.getElementById('game-category-filter');
        if (!filterSelect) return;
        let html = '<option value="all">Semua Kategori</option>';
        this.categories.forEach(c => {
            html += `<option value="${c.nama}">${c.nama}</option>`;
        });
        filterSelect.innerHTML = html;
        filterSelect.value = this.currentCategory;
    },

    renderCategoryOptions() {
        const select = document.getElementById('form-game-kategori');
        if (!select) return;
        
        let html = `<option value="">Pilih Kategori...</option>`;
        this.categories.forEach(c => {
            html += `<option value="${c.nama}">${c.nama}</option>`;
        });
        select.innerHTML = html;
    },

    filterCategory(cat) {
        this.currentCategory = cat;
        this.fetchGames();
        this.renderCategoryFilters();
    },

    handleSearch(query) {
        this.searchQuery = query;
        this.fetchGames();
    },

    renderGames() {
        const tbody = document.getElementById('game-table-body');
        const emptyState = document.getElementById('game-empty-state');
        if (!tbody || !emptyState) return;

        if (this.games.length === 0) {
            tbody.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        let html = '';
        this.games.forEach(g => {
            const defaultIcon = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMWExYTFhIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZpbGw9IiM2NjYiIGR5PSIuM2VtIiBmb250LXNpemU9IjEweHgiIHRleHQtYW5jaG9yPSJtaWRkbGUiPj88L3RleHQ+PC9zdmc+";
            const iconUrl = g.icon_url || defaultIcon;
            html += `
                <tr class="hover:bg-[#121212] transition-colors block lg:table-row py-3 lg:py-0 border-b border-[#2a2a2a] last:border-b-0 lg:border-b-0">
                    <td class="px-4 py-2 text-left block lg:table-cell">
                        <div class="flex items-center gap-3">
                            <img src="${iconUrl}" alt="${g.nama}" class="w-10 h-10 lg:w-12 lg:h-12 rounded object-cover border border-[#262626] bg-[#1a1a1a]" onerror="this.onerror=null; this.src='${defaultIcon}'">
                            <div>
                                <div class="font-bold text-neutral-200 text-sm lg:text-base">${g.nama}</div>
                                <div class="text-[10px] lg:text-sm text-neutral-500 mt-0.5">${g.kategori || '-'}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-4 py-2 text-center flex lg:table-cell justify-between items-center border-t border-[#2a2a2a]/50 lg:border-t-0 mt-3 lg:mt-0 pt-3 lg:pt-0">
                        <span class="text-[10px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Tampilkan</span>
                        <span class="font-bold ${g.aktif ? 'text-green-500' : 'text-neutral-500'}">
                            ${g.aktif ? 'YA' : 'TIDAK'}
                        </span>
                    </td>
                    <td class="px-4 py-2 text-right flex lg:table-cell justify-between items-center">
                        <span class="text-[10px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Aksi</span>
                        <div class="flex justify-end gap-1.5">
                            <button onclick="GameManagement.openEditModal(${JSON.stringify(g).replace(/"/g, '&quot;')})" class="w-8 h-8 rounded bg-[#171717] border border-[#262626] text-neutral-300 hover:bg-neutral-100 hover:text-black transition-colors" title="Edit">
                                <svg class="w-3.5 h-3.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            </button>
                            <button onclick="GameManagement.deleteGame(${g.id}, '${g.nama}')" class="w-8 h-8 rounded bg-[#171717] border border-[#262626] text-red-400 hover:bg-red-600 hover:text-white transition-colors" title="Hapus">
                                <svg class="w-3.5 h-3.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    },

    openAddModal() {
        document.getElementById('form-game-id').value = '';
        document.getElementById('game-form').reset();
        document.getElementById('game-modal-title').textContent = 'Tambah Game Baru';
        document.getElementById('game-modal').classList.remove('hidden');
    },

    openEditModal(game) {
        document.getElementById('form-game-id').value = game.id;
        document.getElementById('form-game-nama').value = game.nama || '';
        document.getElementById('form-game-kategori').value = game.kategori || '';
        document.getElementById('form-game-path').value = game.exe_path || '';
        document.getElementById('form-game-argumen').value = game.argumen || '';
        document.getElementById('form-game-aktif').checked = game.aktif;
        document.getElementById('game-modal-title').textContent = 'Edit Game';
        document.getElementById('game-modal').classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('game-modal').classList.add('hidden');
    },

    async handleSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('form-game-id').value;
        const form = new FormData();
        form.append('nama', document.getElementById('form-game-nama').value);
        form.append('kategori', document.getElementById('form-game-kategori').value);
        form.append('exe_path', document.getElementById('form-game-path').value);
        form.append('argumen', document.getElementById('form-game-argumen').value);
        form.append('aktif', document.getElementById('form-game-aktif').checked);
        
        const fileInput = document.getElementById('form-game-icon');
        if (fileInput.files.length > 0) {
            form.append('icon', fileInput.files[0]);
        }

        const url = id ? `/api/v1/kasir/game/${id}` : '/api/v1/kasir/game/';
        
        try {
            const res = await API.request(url, {
                method: 'POST', // or PUT if API supports, we use POST for forms with files in Fetch easily
                body: form
            }, true); // isFormData=true

            if (res.success) {
                Toast.success(res.message);
                this.closeModal();
                this.fetchGames();
            } else {
                Toast.error(res.error || 'Gagal menyimpan game');
            }
        } catch (err) {
            console.error(err);
            Toast.error('Terjadi kesalahan jaringan');
        }
    },

    async deleteGame(id, nama) {
        if (!confirm(`Hapus game "${nama}" secara permanen?`)) return;
        try {
            const res = await API.request(`/api/v1/kasir/game/${id}`, { method: 'DELETE' });
            if (res.success) {
                Toast.success(res.message);
                this.fetchGames();
            } else {
                Toast.error(res.error || 'Gagal menghapus game');
            }
        } catch (e) {
            Toast.error('Terjadi kesalahan jaringan');
        }
    }
};

const KategoriManagement = {
    openModal() {
        this.renderTable();
        document.getElementById('kategori-modal').classList.remove('hidden');
    },
    
    closeModal() {
        document.getElementById('kategori-modal').classList.add('hidden');
    },
    
    renderTable() {
        const tbody = document.getElementById('kategori-table-body');
        const empty = document.getElementById('kategori-empty');
        if (GameManagement.categories.length === 0) {
            tbody.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }
        
        empty.classList.add('hidden');
        let html = '';
        GameManagement.categories.forEach(c => {
            html += `
                <tr class="hover:bg-[#121212] transition-colors block lg:table-row py-3 lg:py-0 border-b border-[#2a2a2a] last:border-b-0 lg:border-b-0">
                    <td class="px-4 py-3 font-bold text-neutral-200 block lg:table-cell text-left">${c.nama}</td>
                    <td class="px-4 py-3 text-right block lg:table-cell">
                        <div class="flex justify-end gap-1.5 mt-2 lg:mt-0">
                            <button onclick="KategoriManagement.delete(${c.id}, '${c.nama}')" class="w-8 h-8 rounded bg-[#171717] border border-[#262626] text-red-400 hover:bg-red-600 hover:text-white transition-colors" title="Hapus">
                                <svg class="w-3.5 h-3.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    },
    
    async addKategori(e) {
        e.preventDefault();
        const nama = document.getElementById('form-kategori-nama').value;
        try {
            const res = await API.request('/api/v1/kasir/game/kategori', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nama })
            });
            if (res.success) {
                Toast.success(res.message);
                document.getElementById('form-kategori-nama').value = '';
                await GameManagement.fetchCategories();
                this.renderTable();
            } else {
                Toast.error(res.error);
            }
        } catch (err) {
            Toast.error('Terjadi kesalahan');
        }
    },
    
    async delete(id, nama) {
        if (!confirm(`Hapus kategori "${nama}"?`)) return;
        try {
            const res = await API.request(`/api/v1/kasir/game/kategori/${id}`, { method: 'DELETE' });
            if (res.success) {
                Toast.success(res.message);
                await GameManagement.fetchCategories();
                this.renderTable();
            } else {
                Toast.error(res.error);
            }
        } catch (err) {
            Toast.error('Terjadi kesalahan');
        }
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Only init if we are on the game management tab (or globally if you prefer)
    // Actually we can init globally but it's better to fetch when tab is opened
    // But since it's an SPA-like tab system, we can just init.
    GameManagement.init();
});
