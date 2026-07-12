// app/static/js/public/games.js

document.addEventListener('DOMContentLoaded', () => {
    const GameLauncher = {
        games: [],
        categories: [],
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
                // Debounce search
                let timeout;
                searchInput.addEventListener('input', (e) => {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => {
                        this.searchQuery = e.target.value.toLowerCase().trim();
                        this.renderGames();
                    }, 300);
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
                console.error("Gagal mengambil daftar game:", err);
                const grid = document.getElementById('game-grid');
                if (grid) grid.innerHTML = '<div class="col-span-full text-center text-red-500 py-10">Gagal memuat data game.</div>';
            }
        },

        renderCategories() {
            const container = document.getElementById('kategori-filters');
            if (!container) return;

            let html = `
                <button onclick="GameLauncher.setCategory('all')" 
                    class="px-5 py-2 rounded-full text-xs lg:text-sm font-bold transition-all ${this.currentCategory === 'all' ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-[#0f0f0f] text-neutral-400 border border-[#1f1f1f] hover:text-white hover:border-neutral-700'}">
                    Semua
                </button>
            `;

            this.categories.forEach(c => {
                const isActive = this.currentCategory === c.nama;
                html += `
                    <button onclick="GameLauncher.setCategory('${c.nama}')" 
                        class="px-5 py-2 rounded-full text-xs lg:text-sm font-bold transition-all ${isActive ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-[#0f0f0f] text-neutral-400 border border-[#1f1f1f] hover:text-white hover:border-neutral-700'}">
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

            // Filter Kategori
            if (this.currentCategory !== 'all') {
                filtered = filtered.filter(g => g.kategori === this.currentCategory);
            }

            // Filter Search
            if (this.searchQuery) {
                filtered = filtered.filter(g => g.nama.toLowerCase().includes(this.searchQuery));
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
                html += `
                    <div class="group relative bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden hover:border-emerald-500/30 transition-all duration-300 hover:shadow-[0_0_30px_rgba(16,185,129,0.1)] hover:-translate-y-1">
                        <div class="aspect-[3/4] relative overflow-hidden bg-[#111]">
                            <img src="${iconUrl}" alt="${g.nama}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" onerror="this.onerror=null; this.src='${defaultIcon}'">
                            <div class="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent opacity-80 group-hover:opacity-60 transition-opacity"></div>
                            
                            <div class="absolute bottom-0 left-0 p-4 w-full">
                                <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#1a1a1a]/80 backdrop-blur border border-[#2a2a2a] text-emerald-400 mb-2 inline-block">
                                    ${g.kategori || 'Game'}
                                </span>
                                <h3 class="text-sm md:text-base font-bold text-white leading-tight line-clamp-2 drop-shadow-md">
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
