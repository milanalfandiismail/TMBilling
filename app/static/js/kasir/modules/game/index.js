const GameManagement = {
    currentCategory: 'all',
    searchQuery: '',
    allGames: [],

    async load() {
        try {
            const result = await window.API.request('/api/v1/kasir/game/');
            if (result && result.success) {
                this.allGames = result.data || [];
                this.render();
            } else {
                Toast.error("Gagal memuat daftar game");
            }
        } catch (error) {
            Toast.error("Error koneksi server saat memuat game");
        }
    },

    render() {
        const tbody = document.getElementById('game-table-body');
        const emptyState = document.getElementById('game-empty-state');
        if (!tbody) return;

        // Filter local
        const filtered = this.allGames.filter(g => {
            const matchesCat = this.currentCategory === 'all' || g.kategori === this.currentCategory;
            const matchesSearch = !this.searchQuery || g.nama.toLowerCase().includes(this.searchQuery.toLowerCase());
            return matchesCat && matchesSearch;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        tbody.innerHTML = filtered.map(g => {
            const iconHtml = g.icon_url 
                ? `<img src="${g.icon_url}" class="w-10 h-10 rounded-lg object-cover border border-[#222]" onerror="this.src='https://placehold.co/40'">`
                : `<div class="w-10 h-10 rounded-lg bg-neutral-900 border border-[#222] flex items-center justify-center text-xs font-bold text-neutral-600">🎮</div>`;

            return `
                <tr class="hover:bg-[#0f0f0f]/60 transition-colors">
                    <td class="p-4">${iconHtml}</td>
                    <td class="p-4 font-semibold text-neutral-100">
                        <div>${Utils.escapeHtml(g.nama)}</div>
                    </td>
                    <td class="p-4 text-neutral-400">${Utils.escapeHtml(g.kategori)}</td>
                    <td class="p-4">
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" class="sr-only peer" ${g.aktif ? 'checked' : ''} 
                                onchange="GameManagement.toggleAktif(${g.id}, this.checked)">
                            <div class="w-7 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-400 after:border-neutral-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-neutral-200 peer-checked:after:bg-black peer-checked:after:border-black"></div>
                        </label>
                    </td>
                    <td class="p-4 text-right space-x-1 shrink-0">
                        <button onclick="GameManagement.openEditModal(${g.id})" 
                            class="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded transition-all">
                            Edit
                        </button>
                        <button onclick="GameManagement.handleDelete(${g.id}, '${Utils.escapeHtml(g.nama)}')" 
                            class="px-2 py-1 bg-red-950/20 hover:bg-red-950/40 border border-red-950/60 text-red-400 rounded transition-all">
                            Hapus
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    filterCategory(category) {
        this.currentCategory = category;
        document.querySelectorAll('.game-cat-btn').forEach(btn => {
            if (btn.id === `game-cat-${category}`) {
                btn.className = "px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-100 font-bold border border-neutral-700 transition-all game-cat-btn";
            } else {
                btn.className = "px-3 py-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 transition-all game-cat-btn";
            }
        });
        this.render();
    },

    handleSearch(query) {
        this.searchQuery = query;
        this.render();
    },

    openAddModal() {
        document.getElementById('game-modal-title').innerText = "Tambah Game Baru";
        document.getElementById('form-game-id').value = "";
        document.getElementById('game-form').reset();
        document.getElementById('game-modal').classList.remove('hidden');
    },

    openEditModal(gameId) {
        const game = this.allGames.find(g => g.id === gameId);
        if (!game) return;

        document.getElementById('game-modal-title').innerText = "Edit Game";
        document.getElementById('form-game-id').value = game.id;
        document.getElementById('form-game-nama').value = game.nama;
        document.getElementById('form-game-kategori').value = game.kategori;
        document.getElementById('form-game-path').value = game.exe_path || '';
        document.getElementById('form-game-argumen').value = game.argumen || '';
        document.getElementById('form-game-aktif').checked = game.aktif;

        // Kosongkan file input
        document.getElementById('form-game-icon').value = "";

        document.getElementById('game-modal').classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('game-modal').classList.add('hidden');
    },

    async handleSubmit(event) {
        event.preventDefault();
        
        const gameId = document.getElementById('form-game-id').value;
        const formData = new FormData();
        
        formData.append('nama', document.getElementById('form-game-nama').value);
        formData.append('kategori', document.getElementById('form-game-kategori').value);
        formData.append('exe_path', document.getElementById('form-game-path').value);
        formData.append('argumen', document.getElementById('form-game-argumen').value);
        formData.append('aktif', document.getElementById('form-game-aktif').checked);
        
        const fileInput = document.getElementById('form-game-icon');
        if (fileInput.files.length > 0) {
            formData.append('icon', fileInput.files[0]);
        }

        try {
            let res;
            if (gameId) {
                res = await window.API.request(`/api/v1/kasir/game/${gameId}`, {
                    method: 'POST', // Flask edit endpoint mendukung POST untuk multipart/form-data
                    body: formData
                });
            } else {
                res = await window.API.request('/api/v1/kasir/game/', {
                    method: 'POST',
                    body: formData
                });
            }

            if (res && res.success) {
                Toast.success(gameId ? "Game berhasil diperbarui" : "Game baru berhasil ditambahkan");
                this.closeModal();
                this.load();
            } else {
                Toast.error(res.error || "Gagal menyimpan game");
            }
        } catch (error) {
            Toast.error(error.message || "Gagal menghubungi server");
        }
    },

    async toggleAktif(gameId, isChecked) {
        try {
            const formData = new FormData();
            formData.append('aktif', isChecked);

            const res = await window.API.request(`/api/v1/kasir/game/${gameId}`, {
                method: 'POST',
                body: formData
            });

            if (res && res.success) {
                Toast.success(isChecked ? "Game ditampilkan di publik" : "Game disembunyikan dari publik");
                // Update local state untuk menghindari refresh full
                const game = this.allGames.find(g => g.id === gameId);
                if (game) game.aktif = isChecked;
            } else {
                Toast.error(res.error || "Gagal mengubah visibilitas game");
                this.load(); // Rollback UI dengan load ulang
            }
        } catch (error) {
            Toast.error("Gagal menghubungi server");
            this.load();
        }
    },

    async handleDelete(gameId, gameNama) {
        if (!confirm(`Apakah Anda yakin ingin menghapus game "${gameNama}" secara permanen?`)) {
            return;
        }

        try {
            const res = await window.API.request(`/api/v1/kasir/game/${gameId}`, {
                method: 'DELETE'
            });

            if (res && res.success) {
                Toast.success(`Game "${gameNama}" berhasil dihapus`);
                this.load();
            } else {
                Toast.error(res.error || "Gagal menghapus game");
            }
        } catch (error) {
            Toast.error("Gagal menghubungi server");
        }
    }
};
