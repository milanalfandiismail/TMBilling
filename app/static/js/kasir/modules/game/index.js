// app/static/js/kasir/modules/game/index.js

const GameManagement = {
    games: [],
    categories: [],
    currentType: 'all',
    currentCategory: 'all',
    searchQuery: '',
    selectedCategories: [],
    currentPage: 1,
    perPage: 8,
    _hasResizeListener: false,
    _wasMobile: null,
    
    // Canvas Cropper State (Aspect Ratio 3:4)
    cropperState: {
        image: null,
        zoom: 1.0,
        panX: 0,
        panY: 0,
        isDragging: false,
        startX: 0,
        startY: 0,
        isImageModified: false,
        existingIconUrl: null
    },

    getAdaptivePerPage() {
        const width = window.innerWidth;
        if (width >= 1536) return 10;
        if (width >= 1280) return 8;
        if (width >= 768) return 7;
        return 6; // mobile
    },

    _initResizeListener() {
        if (this._hasResizeListener) return;
        this._hasResizeListener = true;
        this._wasMobile = window.innerWidth < 768;
        const handleResize = () => {
            if (typeof App !== 'undefined' && !['game', 'game_management'].includes(App.currentTab)) return;
            const newPerPage = this.getAdaptivePerPage();
            const isMobileNow = window.innerWidth < 768;
            if (newPerPage !== this.perPage || isMobileNow !== this._wasMobile) {
                this._wasMobile = isMobileNow;
                this.perPage = newPerPage;
                this.currentPage = 1;
                this.renderGames();
            }
        };
        window.addEventListener('resize', (typeof Utils !== 'undefined' && Utils.debounce) ? Utils.debounce(handleResize, 200) : handleResize);
    },

    async init() {
        this.setupCropperEvents();
        await this.fetchCategories();
        await this.fetchGames();
    },

    async fetchCategories() {
        try {
            const res = await API.request('/api/v1/kasir/game/kategori');
            if (res.success) {
                this.categories = res.data || [];
                this.renderCategoryFilters();
                this.renderCategoryQuickPills();
            }
        } catch (e) {
            console.error('Error fetching categories:', e);
        }
    },

    _lastFingerprint: null,

    refreshLive() {
        if (typeof App !== 'undefined' && !['game', 'game_management'].includes(App.currentTab)) return;
        const modalForm = document.getElementById('game-modal');
        const isAppModalOpen = document.getElementById('app-modal') && !document.getElementById('app-modal').classList.contains('hidden');
        if ((modalForm && !modalForm.classList.contains('hidden')) || isAppModalOpen) {
            return;
        }
        return this.fetchGames(true);
    },

    async fetchGames(isSilent = false) {
        this._initResizeListener();
        this.perPage = this.getAdaptivePerPage();

        const tbody = document.getElementById('game-table-body');
        if (tbody && !isSilent && (!this.games || this.games.length === 0) && typeof Skeleton !== 'undefined') {
            tbody.innerHTML = Skeleton.gameRows ? Skeleton.gameRows(this.perPage) : (Skeleton.tableRows ? Skeleton.tableRows(this.perPage, 5) : '');
        }

        try {
            const url = `/api/v1/kasir/game/?category=${this.currentCategory}&tipe=${this.currentType}&q=${encodeURIComponent(this.searchQuery)}`;
            const res = await API.request(url);
            if (res.success) {
                const games = res.data || [];
                const newFingerprint = JSON.stringify({
                    cat: this.currentCategory,
                    type: this.currentType,
                    q: this.searchQuery,
                    games: games.map(g => ({ id: g.id, nama: g.nama, play_count: g.play_count, is_active: g.is_active }))
                });

                if (isSilent && this._lastFingerprint === newFingerprint) {
                    return; // Data tidak berubah
                }
                this._lastFingerprint = newFingerprint;

                this.games = games;
                this.renderGames();
            }
        } catch (e) {
            if (!isSilent) {
                console.error('Error fetching games/apps:', e);
            }
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

    filterType(type) {
        this.currentType = type;
        this.currentPage = 1;
        this.fetchGames();
    },

    filterCategory(cat) {
        this.currentCategory = cat;
        this.currentPage = 1;
        this.fetchGames();
    },

    handleSearch(query) {
        this.searchQuery = query;
        const clearBtn = document.getElementById('btn-clear-game-search');
        if (clearBtn) {
            clearBtn.classList.toggle('hidden', !query.trim());
        }
        this.currentPage = 1;
        this.fetchGames();
    },

    resetFilters() {
        const searchInput = document.getElementById('game-search');
        if (searchInput) searchInput.value = '';
        const typeFilter = document.getElementById('game-type-filter');
        if (typeFilter) typeFilter.value = 'all';
        const catFilter = document.getElementById('game-category-filter');
        if (catFilter) catFilter.value = 'all';
        const clearBtn = document.getElementById('btn-clear-game-search');
        if (clearBtn) clearBtn.classList.add('hidden');
        this.searchQuery = '';
        this.currentType = 'all';
        this.currentCategory = 'all';
        this.currentPage = 1;
        this.fetchGames();
    },

    renderGames() {
        const tbody = document.getElementById('game-table-body');
        const emptyState = document.getElementById('game-empty-state');
        if (!tbody || !emptyState) return;

        const isMobile = window.innerWidth < 768;
        const total = this.games.length;
        const totalPages = Math.ceil(total / this.perPage) || 1;
        this.currentPage = Math.max(1, Math.min(this.currentPage, totalPages));

        if (total === 0) {
            tbody.innerHTML = '';
            emptyState.classList.remove('hidden');
            this.updatePagination(0, 0, 0, 1);
            return;
        }

        emptyState.classList.add('hidden');

        const startIndex = (this.currentPage - 1) * this.perPage;
        const endIndex = Math.min(startIndex + this.perPage, total);
        const pageGames = this.games.slice(startIndex, endIndex);

        let html = '';
        pageGames.forEach(g => {
            const defaultIcon = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMWExYTFhIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZpbGw9IiM2NjYiIGR5PSIuM2VtIiBmb250LXNpemU9IjEweHgiIHRleHQtYW5jaG9yPSJtaWRkbGUiPj88L3RleHQ+PC9zdmc+";
            const iconUrl = g.icon_url && window.API ? API.resolveMediaUrl(g.icon_url) : (g.icon_url || defaultIcon);
            const isApp = (g.tipe || 'game').toLowerCase() === 'aplikasi';
            const tipeBadge = isApp 
                ? '<span class="px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 uppercase">Aplikasi</span>'
                : '<span class="px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">Game</span>';

            const katList = Array.isArray(g.kategori_list) && g.kategori_list.length > 0 
                ? g.kategori_list 
                : (g.kategori ? g.kategori.split(',').map(k => k.trim()).filter(Boolean) : []);

            let tagsHtml = '';
            if (katList.length > 0) {
                tagsHtml = katList.map(tag => `<span class="px-1.5 py-0.5 bg-[#141414] border border-[#1c1c1c] rounded text-[9px] sm:text-[10px] text-neutral-300 font-mono inline-block truncate max-w-[120px]">${tag}</span>`).join(' ');
            } else {
                tagsHtml = '<span class="text-neutral-600 text-xs">-</span>';
            }

            if (isMobile) {
                // ===== MOBILE (< 768px): 3 Kolom Fluid (0px Horizontal Overflow) =====
                html += `
                    <tr class="hover:bg-[#141414] transition-colors border-b border-[#1c1c1c] text-xs">
                        <!-- Col 1: Cover + Nama + Tipe (50%) -->
                        <td class="px-2 py-1.5 align-middle overflow-hidden">
                            <div class="flex items-center gap-2">
                                <img src="${iconUrl}" alt="${g.nama}" 
                                    class="w-8 h-11 rounded object-cover border border-[#1c1c1c] bg-[#141414] shadow-sm flex-shrink-0 ${g.icon ? 'cursor-pointer' : ''}" 
                                    onerror="this.onerror=null; this.src='${defaultIcon}'" 
                                    ${g.icon ? `onclick="GameManagement.openLightbox('${iconUrl}', '${g.nama.replace(/'/g, "\\'")}', '${(g.tipe || 'game')}', '${(g.kategori || '').replace(/'/g, "\\'")}')"` : ''}>
                                <div class="min-w-0 flex-1">
                                    <div class="font-bold text-neutral-100 text-[11px] truncate leading-tight">${g.nama}</div>
                                    <div class="mt-0.5 flex items-center gap-1">${tipeBadge}</div>
                                </div>
                            </div>
                        </td>
                        <!-- Col 2: Kategori & Status (30%) -->
                        <td class="px-2 py-1.5 align-middle overflow-hidden">
                            <div class="truncate max-w-[100px] text-[9.5px] text-neutral-400 leading-tight">${katList.slice(0, 2).join(', ') || '-'}</div>
                            <div class="mt-0.5">
                                <span class="font-mono text-[9px] font-bold ${g.aktif ? 'text-emerald-400' : 'text-neutral-500'}">
                                    ${g.aktif ? '● AKTIF' : '○ NONAKTIF'}
                                </span>
                            </div>
                        </td>
                        <!-- Col 3: Aksi (20% text-center) -->
                        <td class="px-1.5 py-1.5 text-center align-middle overflow-hidden remote-hide-action">
                            <div class="flex items-center justify-center gap-1">
                                <button onclick="GameManagement.openEditModal(${JSON.stringify(g).replace(/"/g, '&quot;')})" 
                                    class="w-6 h-6 rounded bg-[#171717] border border-[#262626] text-neutral-300 hover:bg-neutral-100 hover:text-black transition-colors flex items-center justify-center shadow-sm" title="Edit">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                </button>
                                <button onclick="GameManagement.deleteGame(${g.id}, '${g.nama.replace(/'/g, "\\'")}')" 
                                    class="w-6 h-6 rounded bg-[#171717] border border-[#262626] text-red-400 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center shadow-sm" title="Hapus">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            } else {
                // ===== DESKTOP / TABLET (>= 768px): 5 Kolom Proporsional =====
                html += `
                    <tr class="hover:bg-[#141414] transition-colors border-b border-[#1c1c1c] text-xs lg:text-[10px] xl:text-xs 2xl:text-sm">
                        <!-- Col 1: Cover + Nama + Path (36%) -->
                        <td class="px-2.5 py-1.5 align-middle overflow-hidden">
                            <div class="flex items-center gap-3">
                                <img src="${iconUrl}" alt="${g.nama}" 
                                    class="w-8 h-11 xl:w-9 xl:h-12 rounded object-cover border border-[#1c1c1c] bg-[#141414] shadow-sm flex-shrink-0 ${g.icon ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}" 
                                    onerror="this.onerror=null; this.src='${defaultIcon}'" 
                                    ${g.icon ? `onclick="GameManagement.openLightbox('${iconUrl}', '${g.nama.replace(/'/g, "\\'")}', '${(g.tipe || 'game')}', '${(g.kategori || '').replace(/'/g, "\\'")}')" title="Klik untuk lihat ukuran penuh"` : ''}>
                                <div class="min-w-0 flex-1">
                                    <div class="font-bold text-neutral-100 text-xs 2xl:text-sm truncate">${g.nama}</div>
                                    <div class="text-[9.5px] xl:text-[10px] 2xl:text-xs text-neutral-500 font-mono mt-0.5 truncate max-w-xs" title="${g.exe_path || '-'}">${g.exe_path || '-'}</div>
                                </div>
                            </div>
                        </td>
                        <!-- Col 2: Jenis (w-20 text-center) -->
                        <td class="px-2 py-1.5 align-middle text-center overflow-hidden">
                            ${tipeBadge}
                        </td>
                        <!-- Col 3: Kategori / Genre (26%) -->
                        <td class="px-2.5 py-1.5 align-middle overflow-hidden">
                            <div class="flex flex-wrap gap-1 items-center">
                                ${tagsHtml}
                            </div>
                        </td>
                        <!-- Col 4: Publik (w-16 text-center) -->
                        <td class="px-2 py-1.5 align-middle text-center overflow-hidden">
                            <span class="font-bold text-xs ${g.aktif ? 'text-emerald-400' : 'text-neutral-500'}">
                                ${g.aktif ? 'YA' : 'TIDAK'}
                            </span>
                        </td>
                        <!-- Col 5: Aksi (w-24 text-center) -->
                        <td class="px-2 py-1.5 align-middle text-center overflow-hidden remote-hide-action">
                            <div class="flex justify-center items-center gap-1.5">
                                ${g.icon ? `
                                <button onclick="GameManagement.openLightbox('${iconUrl}', '${g.nama.replace(/'/g, "\\'")}', '${(g.tipe || 'game')}', '${(g.kategori || '').replace(/'/g, "\\'")}')" 
                                    class="w-6 h-6 xl:w-7 xl:h-7 rounded bg-[#171717] border border-[#262626] text-neutral-300 hover:bg-neutral-100 hover:text-black transition-colors flex items-center justify-center shadow-sm" title="Lihat Fullscreen">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                </button>
                                ` : ''}
                                <button onclick="GameManagement.openEditModal(${JSON.stringify(g).replace(/"/g, '&quot;')})" 
                                    class="w-6 h-6 xl:w-7 xl:h-7 rounded bg-[#171717] border border-[#262626] text-neutral-300 hover:bg-neutral-100 hover:text-black transition-colors flex items-center justify-center shadow-sm" title="Edit">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                </button>
                                <button onclick="GameManagement.deleteGame(${g.id}, '${g.nama.replace(/'/g, "\\'")}')" 
                                    class="w-6 h-6 xl:w-7 xl:h-7 rounded bg-[#171717] border border-[#262626] text-red-400 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center shadow-sm" title="Hapus">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }
        });
        tbody.innerHTML = html;
        this.updatePagination(startIndex + 1, endIndex, total, totalPages);
    },

    updatePagination(start, end, total, totalPages) {
        const infoEl = document.getElementById('game-page-info');
        const currEl = document.getElementById('game-page-current');
        const prevBtn = document.getElementById('btn-game-prev');
        const nextBtn = document.getElementById('btn-game-next');

        if (infoEl) {
            infoEl.textContent = total > 0 ? `Menampilkan ${start} - ${end} dari ${total} item` : 'Menampilkan 0 item';
        }
        if (currEl) {
            currEl.textContent = `${this.currentPage} / ${totalPages}`;
        }
        if (prevBtn) {
            prevBtn.disabled = this.currentPage <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= totalPages;
        }
    },

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderGames();
        }
    },

    nextPage() {
        const totalPages = Math.ceil(this.games.length / this.perPage) || 1;
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.renderGames();
        }
    },

    // ==================== STATE RESET & MODAL LIFECYCLE ====================

    resetForm() {
        // Reset HTML Form fields
        document.getElementById('form-game-id').value = '';
        const form = document.getElementById('game-form');
        if (form) form.reset();
        
        const fileInput = document.getElementById('form-game-icon');
        if (fileInput) fileInput.value = '';
        
        const customTagInput = document.getElementById('custom-tag-input');
        if (customTagInput) customTagInput.value = '';

        // Reset Categories
        this.selectedCategories = [];
        this.renderSelectedCategoryTags();
        this.renderCategoryQuickPills();

        // Reset Cropper State completely
        this.cropperState = {
            image: null,
            zoom: 1.0,
            panX: 0,
            panY: 0,
            isDragging: false,
            startX: 0,
            startY: 0,
            isImageModified: false,
            existingIconUrl: null
        };

        const zoomSlider = document.getElementById('cropper-zoom-slider');
        if (zoomSlider) zoomSlider.value = 1;
        const zoomText = document.getElementById('zoom-level-text');
        if (zoomText) zoomText.textContent = '1.0x';

        this.renderCropperCanvas();
    },

    modalActiveTab: 'data',

    switchModalTab(tabName) {
        this.modalActiveTab = tabName;
        const secData = document.getElementById('modal-section-data');
        const secCover = document.getElementById('modal-section-cover');
        const btnData = document.getElementById('tab-btn-modal-data');
        const btnCover = document.getElementById('tab-btn-modal-cover');

        if (!secData || !secCover) return;

        if (tabName === 'cover') {
            secData.classList.add('max-md:hidden');
            secCover.classList.remove('max-md:hidden');
            secCover.classList.add('max-md:flex');

            if (btnData) {
                btnData.className = "flex-1 py-2 text-xs font-bold transition-colors border-b-2 border-transparent text-neutral-400 hover:text-neutral-200 flex items-center justify-center gap-1.5";
            }
            if (btnCover) {
                btnCover.className = "flex-1 py-2 text-xs font-bold transition-colors border-b-2 border-neutral-200 text-neutral-100 flex items-center justify-center gap-1.5";
            }

            setTimeout(() => {
                this.renderCropperCanvas();
            }, 40);
        } else {
            secCover.classList.add('max-md:hidden');
            secCover.classList.remove('max-md:flex');
            secData.classList.remove('max-md:hidden');

            if (btnData) {
                btnData.className = "flex-1 py-2 text-xs font-bold transition-colors border-b-2 border-neutral-200 text-neutral-100 flex items-center justify-center gap-1.5";
            }
            if (btnCover) {
                btnCover.className = "flex-1 py-2 text-xs font-bold transition-colors border-b-2 border-transparent text-neutral-400 hover:text-neutral-200 flex items-center justify-center gap-1.5";
            }
        }
    },

    openAddModal() {
        this.resetForm();
        this.switchModalTab('data');
        document.getElementById('form-game-tipe').value = 'game';
        document.getElementById('form-game-aktif').checked = true;
        document.getElementById('game-modal-title').textContent = 'Tambah Item Baru (Game / Aplikasi)';
        document.getElementById('game-modal').classList.remove('hidden');
    },

    openEditModal(game) {
        this.resetForm();
        this.switchModalTab('data');
        
        document.getElementById('form-game-id').value = game.id;
        document.getElementById('form-game-tipe').value = (game.tipe || 'game').toLowerCase();
        document.getElementById('form-game-nama').value = game.nama || '';
        document.getElementById('form-game-path').value = game.exe_path || '';
        document.getElementById('form-game-argumen').value = game.argumen || '';
        document.getElementById('form-game-aktif').checked = Boolean(game.aktif);
        
        // Populate Categories
        const katList = Array.isArray(game.kategori_list) && game.kategori_list.length > 0 
            ? game.kategori_list 
            : (game.kategori ? game.kategori.split(',').map(k => k.trim()).filter(Boolean) : []);
        this.selectedCategories = [...katList];
        this.renderSelectedCategoryTags();
        this.renderCategoryQuickPills();

        // If game has existing icon, preview it on canvas without marking it as modified
        if (game.icon_url) {
            const defaultIcon = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMWExYTFhIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZpbGw9IiM2NjYiIGR5PSIuM2VtIiBmb250LXNpemU9IjEweHgiIHRleHQtYW5jaG9yPSJtaWRkbGUiPj88L3RleHQ+PC9zdmc+";
            const fullUrl = window.API ? API.resolveMediaUrl(game.icon_url) : game.icon_url;
            this.cropperState.existingIconUrl = fullUrl;
            
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                this.cropperState.image = img;
                this.cropperState.isImageModified = false; // Not modified yet
                this.renderCropperCanvas();
            };
            img.onerror = () => {
                this.renderCropperCanvas();
            };
            img.src = fullUrl;
        }

        const tipeLabel = (game.tipe || 'game').toLowerCase() === 'aplikasi' ? 'Aplikasi' : 'Game';
        document.getElementById('game-modal-title').textContent = `Edit ${tipeLabel}: ${game.nama}`;
        document.getElementById('game-modal').classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('game-modal').classList.add('hidden');
        this.resetForm();
    },

    // ==================== MULTI-CATEGORY / TAGS MANAGEMENT ====================

    renderSelectedCategoryTags() {
        const container = document.getElementById('selected-category-tags');
        const countBadge = document.getElementById('selected-count-badge');
        if (!container) return;

        if (this.selectedCategories.length === 0) {
            container.innerHTML = '<span class="text-[11px] text-neutral-600 italic px-1" id="category-placeholder-text">Klik pil di bawah atau ketik tag...</span>';
            if (countBadge) countBadge.textContent = '0 terpilih';
            return;
        }

        if (countBadge) countBadge.textContent = `${this.selectedCategories.length} terpilih`;

        let html = '';
        this.selectedCategories.forEach(tag => {
            html += `
                <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold">
                    <span>${tag}</span>
                    <button type="button" onclick="GameManagement.removeCategoryTag('${tag.replace(/'/g, "\\'")}')" class="text-emerald-400/70 hover:text-emerald-200 hover:bg-emerald-500/20 rounded px-1 leading-none transition-colors">
                        ×
                    </button>
                </span>
            `;
        });
        container.innerHTML = html;
    },

    renderCategoryQuickPills() {
        const container = document.getElementById('category-quick-pills');
        if (!container) return;

        let html = '';
        this.categories.forEach(c => {
            const isSelected = this.selectedCategories.includes(c.nama);
            const activeClass = isSelected 
                ? 'bg-emerald-500 text-black font-bold shadow-sm' 
                : 'bg-[#141414] hover:bg-[#202020] text-neutral-300 border border-[#222]';
            html += `
                <button type="button" onclick="GameManagement.toggleCategoryPill('${c.nama.replace(/'/g, "\\'")}')"
                    class="px-2 py-0.5 rounded text-[10px] transition-all flex items-center gap-1 ${activeClass}">
                    <span>${c.nama}</span>
                    ${isSelected ? '<span>✓</span>' : '<span>+</span>'}
                </button>
            `;
        });
        container.innerHTML = html || '<span class="text-[10px] text-neutral-600">Belum ada kategori master.</span>';
    },

    toggleCategoryPill(nama) {
        if (this.selectedCategories.includes(nama)) {
            this.removeCategoryTag(nama);
        } else {
            this.addCategoryTag(nama);
        }
    },

    addCategoryTag(nama) {
        const trimmed = nama.trim();
        if (!trimmed) return;
        if (!this.selectedCategories.includes(trimmed)) {
            this.selectedCategories.push(trimmed);
            this.renderSelectedCategoryTags();
            this.renderCategoryQuickPills();
        }
    },

    removeCategoryTag(nama) {
        this.selectedCategories = this.selectedCategories.filter(t => t !== nama);
        this.renderSelectedCategoryTags();
        this.renderCategoryQuickPills();
    },

    handleCustomTagKeydown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.addCustomTagFromInput();
        }
    },

    addCustomTagFromInput() {
        const input = document.getElementById('custom-tag-input');
        if (!input) return;
        const val = input.value.trim();
        if (val) {
            // Support comma separated input in custom tag
            val.split(',').forEach(tag => {
                if (tag.trim()) this.addCategoryTag(tag.trim());
            });
            input.value = '';
        }
    },

    // ==================== IMAGE CANVAS CROPPER & ZOOM (3:4 RATIO) ====================

    setupCropperEvents() {
        const viewport = document.getElementById('cropper-viewport-container');
        if (!viewport) return;

        const onStart = (e) => {
            if (!this.cropperState.image) return;
            this.cropperState.isDragging = true;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            this.cropperState.startX = clientX - this.cropperState.panX;
            this.cropperState.startY = clientY - this.cropperState.panY;
        };

        const onMove = (e) => {
            if (!this.cropperState.isDragging || !this.cropperState.image) return;
            e.preventDefault();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            this.cropperState.panX = clientX - this.cropperState.startX;
            this.cropperState.panY = clientY - this.cropperState.startY;
            this.cropperState.isImageModified = true;
            this.renderCropperCanvas();
        };

        const onEnd = () => {
            this.cropperState.isDragging = false;
        };

        viewport.addEventListener('mousedown', onStart);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);

        viewport.addEventListener('touchstart', onStart, { passive: true });
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onEnd);
    },

    handleImageSelected(input) {
        if (!input.files || input.files.length === 0) return;
        const file = input.files[0];
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.cropperState.image = img;
                this.cropperState.zoom = 1.0;
                this.cropperState.panX = 0;
                this.cropperState.panY = 0;
                this.cropperState.isImageModified = true;
                
                const zoomSlider = document.getElementById('cropper-zoom-slider');
                if (zoomSlider) zoomSlider.value = 1;
                const zoomText = document.getElementById('zoom-level-text');
                if (zoomText) zoomText.textContent = '1.0x';

                this.renderCropperCanvas();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    handleZoomChange(val) {
        this.cropperState.zoom = parseFloat(val);
        this.cropperState.isImageModified = true;
        const zoomText = document.getElementById('zoom-level-text');
        if (zoomText) zoomText.textContent = `${this.cropperState.zoom.toFixed(1)}x`;
        this.renderCropperCanvas();
    },

    clearImageState() {
        const fileInput = document.getElementById('form-game-icon');
        if (fileInput) fileInput.value = '';
        
        this.cropperState.image = null;
        this.cropperState.zoom = 1.0;
        this.cropperState.panX = 0;
        this.cropperState.panY = 0;
        this.cropperState.isImageModified = true; // Mark as modified (cleared)
        this.cropperState.existingIconUrl = null;
        
        this.renderCropperCanvas();
    },

    renderCropperCanvas() {
        const canvas = document.getElementById('cropper-canvas');
        const placeholder = document.getElementById('cropper-placeholder');
        const guide = document.getElementById('cropper-guide');
        const resetBtn = document.getElementById('btn-reset-image');
        const previewBtn = document.getElementById('btn-preview-game-modal');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const cw = canvas.width;  // 300
        const ch = canvas.height; // 400

        ctx.clearRect(0, 0, cw, ch);

        if (!this.cropperState.image) {
            if (placeholder) placeholder.classList.remove('hidden');
            if (guide) guide.classList.add('hidden');
            if (resetBtn) resetBtn.classList.add('hidden');
            if (previewBtn) previewBtn.classList.add('hidden');
            return;
        }

        if (placeholder) placeholder.classList.add('hidden');
        if (guide) guide.classList.remove('hidden');
        if (resetBtn) resetBtn.classList.remove('hidden');
        if (previewBtn) previewBtn.classList.remove('hidden');

        const img = this.cropperState.image;
        
        // Calculate base cover scaling
        const scale = Math.max(cw / img.width, ch / img.height) * this.cropperState.zoom;
        const nw = img.width * scale;
        const nh = img.height * scale;

        const cx = (cw - nw) / 2 + this.cropperState.panX;
        const cy = (ch - nh) / 2 + this.cropperState.panY;

        ctx.fillStyle = "#050505";
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, cx, cy, nw, nh);
    },

    async getCroppedBlob() {
        const canvas = document.getElementById('cropper-canvas');
        if (!canvas || !this.cropperState.image) return null;

        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/jpeg', 0.90);
        });
    },

    // ==================== SUBMIT & DELETE ====================

    async handleSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('form-game-id').value;
        const nama = document.getElementById('form-game-nama').value.trim();
        const exePath = document.getElementById('form-game-path').value.trim();

        if (!nama || nama.length < 2 || nama.length > 100) {
            Toast.error('Nama game/aplikasi harus antara 2 sampai 100 karakter');
            return;
        }
        if (exePath.length > 255) {
            Toast.error('Lokasi file (exe_path) maksimal 255 karakter');
            return;
        }

        const saveBtn = document.getElementById('btn-save-game');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="animate-spin inline-block mr-1">↻</span> Menyimpan...';
        }

        try {
            const form = new FormData();
            form.append('nama', nama);
            form.append('tipe', document.getElementById('form-game-tipe').value);
            form.append('kategori', this.selectedCategories.join(', '));
            form.append('exe_path', exePath);
            form.append('argumen', document.getElementById('form-game-argumen').value.trim());
            form.append('aktif', document.getElementById('form-game-aktif').checked);
            
            // Handle Cropped Image Blob or Hapus Icon
            if (this.cropperState.isImageModified && this.cropperState.image) {
                const blob = await this.getCroppedBlob();
                if (blob) {
                    form.append('icon', blob, 'cover.jpg');
                }
            } else if (this.cropperState.isImageModified && !this.cropperState.image) {
                form.append('hapus_icon', 'true');
            }

            const url = id ? `/api/v1/kasir/game/${id}` : '/api/v1/kasir/game/';
            
            const res = await API.request(url, {
                method: 'POST',
                body: form
            }, true); // isFormData=true

            if (res.success) {
                Toast.success(res.message);
                this.closeModal();
                this.fetchGames();
            } else {
                Toast.error(res.error || 'Gagal menyimpan data');
            }
        } catch (err) {
            console.error(err);
            Toast.error('Terjadi kesalahan jaringan');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Simpan';
            }
        }
    },

    async deleteGame(id, nama) {
        if (!confirm(`Hapus "${nama}" secara permanen dari katalog?`)) return;
        try {
            const res = await API.request(`/api/v1/kasir/game/${id}`, { method: 'DELETE' });
            if (res.success) {
                Toast.success(res.message);
                this.fetchGames();
            } else {
                Toast.error(res.error || 'Gagal menghapus');
            }
        } catch (e) {
            Toast.error('Terjadi kesalahan jaringan');
        }
    },

    // ==================== LIGHTBOX FULLSCREEN PREVIEW ====================
    previewFromModal() {
        const canvas = document.getElementById('cropper-canvas');
        if (!canvas || !this.cropperState.image) return;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const rawNama = document.getElementById('form-game-nama')?.value?.trim();
        const nama = rawNama || "Preview Cover Art";
        const tipe = document.getElementById('form-game-tipe')?.value || "game";
        const kategori = this.selectedCategories.join(', ');
        this.openLightbox(dataUrl, nama, tipe, kategori);
    },

    openLightbox(iconUrl, nama, tipe, kategori) {
        event?.stopPropagation();
        const modal = document.getElementById("game-lightbox-modal");
        const img = document.getElementById("game-lightbox-img");
        const title = document.getElementById("game-lightbox-title");
        const badge = document.getElementById("game-lightbox-badge");
        const katSpan = document.getElementById("game-lightbox-kategori");
        if (!modal || !img) return;

        img.src = iconUrl;
        if (title) title.textContent = nama || "Cover Art";
        
        const isApp = (tipe || 'game').toLowerCase() === 'aplikasi';
        if (badge) {
            badge.textContent = isApp ? 'Aplikasi' : 'Game';
            badge.className = isApp 
                ? 'px-2.5 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-bold rounded-lg uppercase tracking-wider'
                : 'px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-lg uppercase tracking-wider';
        }

        if (katSpan) {
            katSpan.textContent = kategori ? `Genre / Kategori: ${kategori}` : '';
        }

        modal.classList.remove("hidden");
        document.body.style.overflow = "hidden";

        if (!this._lightboxEscBound) {
            this._lightboxEscBound = true;
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape" && !modal.classList.contains("hidden")) {
                    this.closeLightbox();
                }
            });
        }
    },

    closeLightbox() {
        const modal = document.getElementById("game-lightbox-modal");
        if (modal) {
            modal.classList.add("hidden");
            const img = document.getElementById("game-lightbox-img");
            if (img) img.src = "";
            document.body.style.overflow = "";
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
                <tr class="hover:bg-[#121212] transition-colors block lg:table-row py-3 lg:py-0 border-b border-[#1c1c1c] last:border-b-0 lg:border-b-0">
                    <td class="px-3 lg:max-xl:px-4 xl:px-4 py-2 lg:max-xl:py-2.5 xl:py-3 font-bold text-neutral-200 block lg:table-cell text-left text-xs lg:max-xl:text-xs xl:text-base">${c.nama}</td>
                    <td class="px-3 lg:max-xl:px-4 xl:px-4 py-2 lg:max-xl:py-2.5 xl:py-3 text-right block lg:table-cell">
                        <div class="flex justify-end gap-1.5 mt-2 lg:mt-0">
                            <button onclick="KategoriManagement.delete(${c.id}, '${c.nama.replace(/'/g, "\\'")}')" class="w-7 h-7 lg:max-xl:w-7 lg:max-xl:h-7 xl:w-8 xl:h-8 rounded bg-[#171717] border border-[#262626] text-red-400 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center" title="Hapus">
                                <svg class="w-3.5 h-3.5 lg:max-xl:w-3.5 lg:max-xl:h-3.5 xl:w-4 xl:h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
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
        const input = document.getElementById('form-kategori-nama');
        const nama = input.value.trim();
        if (!nama) return;
        try {
            const res = await API.request('/api/v1/kasir/game/kategori', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nama })
            });
            if (res.success) {
                Toast.success(res.message);
                input.value = '';
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

window.GameManagement = GameManagement;
