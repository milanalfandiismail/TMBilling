// app/static/js/kasir/modules/dashboard/dashboard_compact.js

const CompactGrid = {
    renderTabs(data) {
        const container = document.getElementById('dashboard-tabs');
        if (!container) return;

        const groups = Object.keys(data.by_grup || {}).sort();
        const meta = data.grup_meta || {};

        let html = `
            <button onclick="Dashboard.setGrup('semua')" 
                class="px-3.5 py-1.5 rounded text-xs font-bold transition-all border
                ${Dashboard.activeGrup === 'semua'
                ? 'bg-neutral-100 text-black border-neutral-100 font-extrabold'
                : 'bg-[#0c0c0c] border-[#1c1c1c] text-neutral-400 hover:text-neutral-100 hover:bg-[#121212]'}">
                SEMUA ZONA
            </button>
        `;

        groups.forEach(g => {
            const isActive = Dashboard.activeGrup === g;
            const customColor = meta[g]?.warna || '#737373';

            html += `
                <button onclick="Dashboard.setGrup('${g}')" 
                    class="px-3.5 py-1.5 rounded text-xs font-bold transition-all border flex items-center gap-1.5
                    ${isActive
                    ? 'bg-neutral-100 text-black border-neutral-100 font-extrabold'
                    : 'bg-[#0c0c0c] border-[#1c1c1c] text-neutral-400 hover:text-neutral-100 hover:bg-[#121212]'}">
                    <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${customColor}"></span>
                    ${g.toUpperCase()}
                </button>
            `;
        });

        container.innerHTML = html;
    },

    _getGridSize(grup) {
        try {
            var s = localStorage.getItem('map_grid_' + grup);
            if (s) {
                var p = JSON.parse(s);
                return { cols: p.c || 10, rows: p.r || 7 };
            }
        } catch (e) {}
        return { cols: 10, rows: 7 };
    },

    _setGridSize(grup, cols, rows) {
        try {
            localStorage.setItem('map_grid_' + grup, JSON.stringify({ c: cols, r: rows }));
        } catch (e) {}
    },

    toggleAutoSort(grupKey) {
        const key = 'map_autosort_' + grupKey;
        const current = localStorage.getItem(key) === 'true';
        localStorage.setItem(key, !current ? 'true' : 'false');
        if (window.Dashboard && window.Dashboard.lastData) {
            window.Dashboard._render(window.Dashboard.lastData);
        }
    },

    renderCompactCard(pc) {
        const isActive = pc.status === 'terpakai';
        const sesi = pc.sesi_detail;
        const isLostConnection = isActive && (pc.status_koneksi === 'no_heartbeat' || pc.status_koneksi === 'offline');
        const customColor = Dashboard.lastData?.grup_meta?.[pc.grup]?.warna || '#737373';

        let cardBgClass = 'bg-[#161616] hover:bg-[#1c1c1c]';
        let cardBorderClass = 'border';
        let cardOpacityClass = 'opacity-100';
        let statusIndicator = '○';
        let indicatorColorClass = 'text-neutral-500';
        
        let activeAppName = '';
        let timerStr = '';
        let memberName = '';

        // Persistent group border color for all cards
        let borderStyle = `border-color: ${customColor}80`;

        if (isLostConnection) {
            cardBgClass = 'animate-pulse-red-bg';
            cardBorderClass = 'border';
            statusIndicator = '[!]';
            indicatorColorClass = 'text-red-500 animate-pulse';
            
            timerStr = sesi ? Utils.formatMenit(sesi.sisa_menit) : '--:--';
            activeAppName = '⚠️ TERPUTUS';
            memberName = sesi ? (sesi.nama_guest || sesi.member_nama || 'Guest') : '';
            // For lost connection, we let tailwind animate-pulse-red-bg handle background & border pulsing.
            // But we can still keep the border style colored as backup.
            borderStyle = '';
        } else if (isActive && sesi) {
            statusIndicator = '●';
            indicatorColorClass = 'text-emerald-400';
            cardBgClass = 'bg-[#0a140f] hover:bg-[#0f2017]';

            if (sesi.tipe === 'admin') {
                indicatorColorClass = 'text-amber-500';
                cardBgClass = 'bg-[#18120a] hover:bg-[#241b0f]';
                timerStr = 'ADMIN MODE';
                memberName = sesi.member_nama || 'ADMIN';
                activeAppName = '-';
            } else {
                indicatorColorClass = 'text-emerald-400';
                if (sesi.sisa_menit !== null && sesi.sisa_menit !== undefined) {
                    timerStr = Utils.formatMenit(sesi.sisa_menit);
                } else {
                    timerStr = 'Unlimited';
                }
                memberName = sesi.nama_guest || sesi.member_nama || 'Guest';
                activeAppName = pc.active_window || '-';
            }
        } else if (pc.is_admin_mode) {
            statusIndicator = '●';
            indicatorColorClass = 'text-amber-500';
            cardBgClass = 'bg-[#18120a] hover:bg-[#241b0f]';
            timerStr = 'ADMIN BYPASS';
            memberName = 'ADMIN';
            activeAppName = '-';
        } else if (pc.status_koneksi === 'online') {
            statusIndicator = '○';
            indicatorColorClass = 'text-neutral-400';
            cardBgClass = 'bg-[#1a1a1a] hover:bg-[#222]';
            timerStr = 'KOSONG';
            memberName = '-';
            activeAppName = '-';
        } else {
            cardOpacityClass = 'opacity-60';
            cardBgClass = 'bg-[#141414]';
            cardBorderClass = 'border border-dashed';
            statusIndicator = '○';
            indicatorColorClass = 'text-neutral-600';
            timerStr = 'OFFLINE';
            memberName = '-';
            activeAppName = '-';
        }

        const borderAttr = borderStyle ? `style="${borderStyle}"` : '';

        return `
            <div class="${cardBorderClass} ${cardBgClass} ${cardOpacityClass} rounded-xl p-2.5 sm:p-3 cursor-pointer transition-all hover:brightness-125 flex flex-col justify-between text-left h-[125px] w-full shadow-lg" 
                 ${borderAttr}
                 onclick="event.preventDefault(); event.stopPropagation(); Dashboard.showContextMenu(event, ${pc.id})"
                 oncontextmenu="event.preventDefault(); event.stopPropagation(); Dashboard.showContextMenu(event, ${pc.id})">
                <!-- Row 1: Kode PC - DOT -->
                <div class="flex items-center justify-between">
                    <span class="text-base lg:text-lg font-black text-neutral-100 tracking-tight">${pc.kode}</span>
                    <span class="w-2.5 h-2.5 rounded-full ${indicatorColorClass} shrink-0 bg-current"></span>
                </div>
                <!-- Row 2: Aplikasi / Active Window -->
                <div class="text-xs lg:text-sm text-neutral-400 truncate mt-0.5" title="${activeAppName}">
                    ${activeAppName}
                </div>
                <!-- Row 3: Timer -->
                <div class="text-sm lg:text-base font-black font-mono ${isActive && sesi && sesi.sisa_menit <= 5 && sesi.tipe !== 'admin' ? 'text-red-400 animate-pulse' : 'text-emerald-300'} mt-0.5">
                    ${timerStr}
                </div>
                <!-- Row 4: Nama Member / Guest -->
                <div class="text-xs lg:text-sm text-neutral-300 truncate font-bold mt-0.5" title="${memberName}">
                    ${memberName}
                </div>
            </div>
        `;
    },

    render(data) {
        const container = document.getElementById('pc-area');
        if (!container) {
            console.error('[CompactGrid] #pc-area not found!');
            return;
        }

        let html = '';
        const allGroups = Object.keys(data.by_grup || {});
        const groupsToRender = Dashboard.activeGrup === 'semua'
            ? allGroups.sort()
            : [Dashboard.activeGrup];

        const isAdmin = (document.body.dataset.kasirRole || '') === 'admin';
        const isMobile = window.innerWidth < 768;

        groupsToRender.forEach(grupKey => {
            const pcs = data.by_grup[grupKey] || [];
            if (pcs.length === 0) return;

            // Mobile strictly enforces Auto-Sort
            const isAutoSort = isMobile || (localStorage.getItem('map_autosort_' + grupKey) === 'true');

            // Sorting logic for Auto-Sort
            if (isAutoSort) {
                pcs.sort((a, b) => a.kode.localeCompare(b.kode, undefined, { numeric: true, sensitivity: 'base' }));
            }

            const gs = this._getGridSize(grupKey);
            const cols = gs.cols;
            const rows = gs.rows;

            const activeCount = pcs.filter(p => p.status === 'terpakai').length;

            const mapped = pcs.filter(p => p.pos_x >= 0 && p.pos_y >= 0);
            const unmapped = pcs.filter(p => p.pos_x < 0 || p.pos_y < 0);

            // Group Header with Auto-Sort button
            html += `
                <div class="mb-8">
                    <div class="flex items-center justify-between mb-4 pb-2 border-b border-[#252525]">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h4 class="text-xs font-bold text-neutral-300 tracking-wider uppercase">${grupKey.toUpperCase()}</h4>
                            <span class="text-xs text-neutral-400 font-mono font-bold">${activeCount} / ${pcs.length} AKTIF</span>
                            ${!isMobile ? `<span class="text-xs text-neutral-500 font-mono">(${cols}×${rows})</span>` : ''}
                        </div>
                        
                        <div class="flex items-center gap-2">
                            <!-- Auto-Sort Toggle Button (hidden on mobile) -->
                            <button onclick="CompactGrid.toggleAutoSort('${grupKey}')" 
                                class="px-2.5 py-1 rounded text-xs font-semibold border transition-all items-center gap-1.5 md:inline-flex hidden
                                ${isAutoSort 
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                                : 'bg-neutral-800 border-neutral-700 hover:bg-neutral-700 text-neutral-300'}">
                                🔄 Auto-Sort
                            </button>
                            
                            ${isAdmin && !isAutoSort && !isMobile ? `
                            <button onclick="MapView.openEditor('${grupKey}')" class="px-2.5 py-1 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 hover:border-neutral-500 rounded text-xs text-neutral-200 font-semibold transition-colors shrink-0 md:inline-flex hidden">
                                ✏️ Edit Denah
                            </button>
                            ` : ''}
                        </div>
                    </div>
                    
                    <!-- Grid Container -->
                    ${isAutoSort ? (isMobile ? `
                        <!-- Auto-Sort Mobile Grid: 2 columns natural wrap -->
                        <div class="grid gap-2 grid-cols-2">
                            ${pcs.map(pc => {
                                return `
                                    <div>
                                        ${this.renderCompactCard(pc)}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    ` : `
                        <!-- Auto-Sort Grid: flows naturally but scaled -->
                        <div class="auto-grid-wrapper overflow-hidden w-full" style="transition: height 0.15s ease-out;">
                            <div class="auto-grid-container grid gap-2 auto-rows-fr" data-cols="${Math.min(pcs.length, 10)}" style="grid-template-columns: repeat(${Math.min(pcs.length, 10)}, minmax(0, 1fr));">
                                ${pcs.map(pc => {
                                    return `
                                        <div>
                                            ${this.renderCompactCard(pc)}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `) : `
                        <!-- Manual Layout Grid: uses absolute pos_x / pos_y -->
                        <div class="manual-grid-wrapper overflow-hidden w-full" style="transition: height 0.15s ease-out;">
                            <div class="manual-grid-container grid gap-2 auto-rows-fr" data-cols="${cols}" data-rows="${rows}" style="grid-template-columns: repeat(${cols}, minmax(0, 1fr)); grid-template-rows: repeat(${rows}, minmax(0, 1fr));">
                                ${mapped.map(pc => {
                                    return `
                                        <div style="grid-column: ${pc.pos_x + 1}; grid-row: ${pc.pos_y + 1};">
                                            ${this.renderCompactCard(pc)}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                        
                        <!-- Unmapped Section -->
                        ${unmapped.length > 0 ? `
                        <div class="mt-3 p-3 bg-[#0c0c0c] border border-dashed border-[#1c1c1c] rounded-lg">
                            <span class="text-[10px] text-neutral-500 uppercase font-bold block mb-2">Belum Dipetakan:</span>
                            <div class="flex flex-wrap gap-2">
                                ${unmapped.map(pc => {
                                    return `
                                        <div class="w-[150px] shrink-0">
                                            ${this.renderCompactCard(pc)}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                        ` : ''}
                    `}
                </div>
            `;
        });

        container.innerHTML = html || '<div class="text-center py-20 text-neutral-500 text-sm">Data PC Tidak Tersedia</div>';
        Dashboard.attachEvents();
        this.adjustGridScale();
    },

    adjustGridScale() {
        // Scale manual grid
        const manualWrappers = document.querySelectorAll('.manual-grid-wrapper');
        manualWrappers.forEach(wrapper => {
            const grid = wrapper.querySelector('.manual-grid-container');
            if (!grid) return;
            
            const parent = wrapper.parentElement;
            if (!parent) return;
            
            const containerWidth = parent.clientWidth;
            if (containerWidth === 0) return;
            
            const cols = parseInt(grid.dataset.cols) || 10;
            const baseColWidth = 130;
            const gap = 8;
            const unscaledWidth = (cols * baseColWidth) + ((cols - 1) * gap);
            
            if (containerWidth < unscaledWidth) {
                const scale = containerWidth / unscaledWidth;
                grid.style.width = unscaledWidth + 'px';
                grid.style.transform = `scale(${scale})`;
                grid.style.transformOrigin = 'top left';
                
                const unscaledHeight = grid.scrollHeight;
                wrapper.style.height = (unscaledHeight * scale) + 'px';
            } else {
                grid.style.width = '';
                grid.style.transform = '';
                grid.style.transformOrigin = '';
                wrapper.style.height = '';
            }
        });

        // Scale auto-sort grid
        const autoWrappers = document.querySelectorAll('.auto-grid-wrapper');
        autoWrappers.forEach(wrapper => {
            const grid = wrapper.querySelector('.auto-grid-container');
            if (!grid) return;
            
            const parent = wrapper.parentElement;
            if (!parent) return;
            
            const containerWidth = parent.clientWidth;
            if (containerWidth === 0) return;
            
            const cols = parseInt(grid.dataset.cols) || 10;
            const baseColWidth = 130;
            const gap = 8;
            const unscaledWidth = (cols * baseColWidth) + ((cols - 1) * gap);
            
            if (containerWidth < unscaledWidth) {
                const scale = containerWidth / unscaledWidth;
                grid.style.width = unscaledWidth + 'px';
                grid.style.transform = `scale(${scale})`;
                grid.style.transformOrigin = 'top left';
                
                const unscaledHeight = grid.scrollHeight;
                wrapper.style.height = (unscaledHeight * scale) + 'px';
            } else {
                grid.style.width = '';
                grid.style.transform = '';
                grid.style.transformOrigin = '';
                wrapper.style.height = '';
            }
        });
    }
};

window.CompactGrid = CompactGrid;

// Scale grid on window resize
window.addEventListener('resize', () => {
    if (window.CompactGrid && typeof window.CompactGrid.adjustGridScale === 'function') {
        window.CompactGrid.adjustGridScale();
    }
});
