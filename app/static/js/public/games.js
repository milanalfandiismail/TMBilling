// app/static/js/public/games.js

document.addEventListener('DOMContentLoaded', () => {
    const GameLauncher = {
        games: [],
        categories: [],
        currentType: 'all', // 'all', 'game', 'aplikasi'
        currentCategory: 'all',
        searchQuery: '',

        async init() {
            this.bindEvents();
            await this.fetchCategories();
            await this.fetchGames();
        },

        bindEvents() {
            const searchInput = document.getElementById('search-game');
            if (searchInput) {
                let timeout;
                searchInput.addEventListener('input', (e) => {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => {
                        this.searchQuery = e.target.value.toLowerCase().trim();
                        this.renderGames();
                    }, 250);
                });
            }
        },

        async fetchCategories() {
            try {
                const res = await fetch('/api/v1/public/game/kategori');
                const json = await res.json();
                if (json.success) {
                    this.categories = json.data || [];
                    this.renderCategories();
                }
            } catch (err) {
                console.error("Gagal mengambil kategori:", err);
            }
        },

        async fetchGames() {
            try {
                const res = await fetch('/api/v1/public/game/all');
                const json = await res.json();
                if (json.success) {
                    this.games = json.data || [];
                    this.renderGames();
                }
            } catch (err) {
                console.error("Gagal mengambil daftar software/game:", err);
                const grid = document.getElementById('game-grid');
                if (grid) grid.innerHTML = '<div class="col-span-full text-center text-red-500 py-10 font-mono text-xs">Gagal memuat data. Silakan muat ulang halaman.</div>';
            }
        },

        setType(type) {
            this.currentType = type;
            ['all', 'game', 'aplikasi'].forEach(t => {
                const btn = document.getElementById(`btn-tipe-${t}`);
                if (btn) {
                    if (t === type) {
                        btn.className = "px-4 py-1.5 rounded-full text-xs font-bold transition-all bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]";
                    } else {
                        btn.className = "px-4 py-1.5 rounded-full text-xs font-bold transition-all bg-[#0f0f0f] text-neutral-400 border border-[#1f1f1f] hover:text-white hover:border-neutral-700";
                    }
                }
            });
            this.renderGames();
        },

        renderCategories() {
            const container = document.getElementById('kategori-filters');
            if (!container) return;

            let html = `
                <button onclick="GameLauncher.setCategory('all')" 
                    class="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${this.currentCategory === 'all' ? 'bg-neutral-100 text-black shadow-[0_0_10px_rgba(255,255,255,0.2)]' : 'bg-[#0f0f0f] text-neutral-400 border border-[#1f1f1f] hover:text-white hover:border-neutral-700'}">
                    Semua Genre
                </button>
            `;

            this.categories.forEach(c => {
                const isActive = this.currentCategory === c.nama;
                html += `
                    <button onclick="GameLauncher.setCategory('${c.nama}')" 
                        class="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${isActive ? 'bg-neutral-100 text-black shadow-[0_0_10px_rgba(255,255,255,0.2)]' : 'bg-[#0f0f0f] text-neutral-400 border border-[#1f1f1f] hover:text-white hover:border-neutral-700'}">
                        ${c.nama}
                    </button>
                `;
            });

            container.innerHTML = html;
        },

        setCategory(cat) {
            this.currentCategory = cat;
            this.renderCategories();
            this.renderGames();
        },

        renderGames() {
            const grid = document.getElementById('game-grid');
            const emptyState = document.getElementById('empty-state');
            if (!grid || !emptyState) return;

            let filtered = this.games;

            // Filter Tipe (Game / Aplikasi / Semua)
            if (this.currentType !== 'all') {
                filtered = filtered.filter(g => (g.tipe || 'game').toLowerCase() === this.currentType);
            }

            // Filter Kategori / Genre (Multi-genre support)
            if (this.currentCategory !== 'all') {
                const targetCat = this.currentCategory.toLowerCase();
                filtered = filtered.filter(g => {
                    if (Array.isArray(g.kategori_list) && g.kategori_list.length > 0) {
                        return g.kategori_list.some(k => k.toLowerCase() === targetCat);
                    }
                    return (g.kategori || '').toLowerCase().includes(targetCat);
                });
            }

            // Filter Search (Nama & Kategori)
            if (this.searchQuery) {
                filtered = filtered.filter(g => {
                    const matchNama = g.nama.toLowerCase().includes(this.searchQuery);
                    const matchKat = (g.kategori || '').toLowerCase().includes(this.searchQuery);
                    return matchNama || matchKat;
                });
            }

            if (filtered.length === 0) {
                grid.innerHTML = '';
                emptyState.classList.remove('hidden');
                emptyState.classList.add('flex');
                return;
            }

            emptyState.classList.add('hidden');
            emptyState.classList.remove('flex');

            const defaultIcon = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMWExYTFhIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZpbGw9IiM2NjYiIGR5PSIuM2VtIiBmb250LXNpemU9IjEweHgiIHRleHQtYW5jaG9yPSJtaWRkbGUiPj88L3RleHQ+PC9zdmc+";

            let html = '';
            filtered.forEach(g => {
                const iconUrl = g.icon_url || defaultIcon;
                const isApp = (g.tipe || 'game').toLowerCase() === 'aplikasi';
                const tipeLabel = isApp ? 'APLIKASI' : 'GAME';
                const tipeClass = isApp ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';

                // Handle multi-genre chips (max 2 visible chips + counter)
                const katList = Array.isArray(g.kategori_list) && g.kategori_list.length > 0 
                    ? g.kategori_list 
                    : (g.kategori ? g.kategori.split(',').map(k => k.trim()).filter(Boolean) : []);

                let genreHtml = '';
                if (katList.length > 0) {
                    const visibleTags = katList.slice(0, 2);
                    const extraCount = katList.length - 2;
                    visibleTags.forEach(tag => {
                        genreHtml += `<span class="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#1f1f1f]/80 backdrop-blur border border-[#2a2a2a] text-neutral-300 inline-block">${tag}</span> `;
                    });
                    if (extraCount > 0) {
                        genreHtml += `<span class="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#222]/80 backdrop-blur border border-[#333] text-neutral-400 inline-block">+${extraCount}</span>`;
                    }
                }

                html += `
                    <div class="group relative bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl overflow-hidden hover:border-emerald-500/40 transition-all duration-300 hover:shadow-[0_0_25px_rgba(16,185,129,0.15)] hover:-translate-y-1 flex flex-col shadow-lg shadow-black/40">
                        <div class="aspect-[3/4] relative overflow-hidden bg-[#111]">
                            <img src="${iconUrl}" alt="${g.nama}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" onerror="this.onerror=null; this.src='${defaultIcon}'">
                            <div class="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent opacity-90 group-hover:opacity-70 transition-opacity"></div>
                            
                            <!-- Top Right Type Badge -->
                            <div class="absolute top-2.5 right-2.5 z-10">
                                <span class="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider backdrop-blur-md border ${tipeClass}">
                                    ${tipeLabel}
                                </span>
                            </div>

                            <!-- Bottom Content -->
                            <div class="absolute bottom-0 left-0 p-3.5 w-full z-10 space-y-1.5">
                                <div class="flex flex-wrap gap-1 items-center">
                                    ${genreHtml}
                                </div>
                                <h3 class="text-xs sm:text-sm md:text-base font-bold text-white leading-snug line-clamp-2 drop-shadow-md">
                                    ${g.nama}
                                </h3>
                            </div>
                        </div>
                    </div>
                `;
            });

            grid.innerHTML = html;
        }
    };

    window.GameLauncher = GameLauncher;
    GameLauncher.init();
});
