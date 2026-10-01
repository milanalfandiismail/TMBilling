// app/static/js/kasir/modules/dashboard/dashboard_compact.js

const CompactGrid = {
    _groupOffsets: {},

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
                return { cols: p.c || 12, rows: p.r || 7 };
            }
        } catch (e) { }
        return { cols: 12, rows: 7 };
    },

    _setGridSize(grup, cols, rows) {
        try {
            localStorage.setItem('map_grid_' + grup, JSON.stringify({ c: cols, r: rows }));
        } catch (e) { }
    },

    _getScreenCapacity() {
        const w = window.innerWidth;
        if (w >= 1536) return 12; // 2xl
        if (w >= 1280) return 10; // xl
        if (w >= 1024) return 8;  // lg
        return 8; // fallback md / tablet
    },

    updateGroupSlideUI(grupKey, animate = false) {
        const capacity = this._getScreenCapacity();
        const gs = this._getGridSize(grupKey);
        const cols = gs.cols || 12;
        const maxOffset = Math.max(0, cols - capacity);
        const offset = Math.min(maxOffset, Math.max(0, this._groupOffsets[grupKey] || 0));
        this._groupOffsets[grupKey] = offset;

        const viewport = document.querySelector(`.manual-grid-viewport[data-grup="${grupKey}"]`);
        if (!viewport) return;
        const grid = viewport.querySelector(`.manual-grid-container[data-grup="${grupKey}"]`);
        if (!grid) return;

        const compStyle = window.getComputedStyle(viewport);
        const padLeft = parseFloat(compStyle.paddingLeft) || 0;
        const padRight = parseFloat(compStyle.paddingRight) || 0;
        const innerWidth = viewport.clientWidth - padLeft - padRight;
        if (innerWidth <= 0) return;

        if (cols > capacity) {
            const gap = 8;
            const colWidth = (innerWidth - ((capacity - 1) * gap)) / capacity;
            const totalGridWidth = (cols * colWidth) + ((cols - 1) * gap);
            const translateX = -(offset * (colWidth + gap));

            grid.style.transition = animate ? 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)' : 'none';
            grid.style.width = totalGridWidth + 'px';
            grid.style.gridTemplateColumns = `repeat(${cols}, ${colWidth}px)`;
            grid.style.transform = `translateX(${translateX}px)`;
        } else {
            grid.style.transition = 'none';
            grid.style.width = '100%';
            grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
            grid.style.transform = 'none';
        }

        const prevBtn = document.getElementById(`group-prev-btn-${grupKey}`);
        const nextBtn = document.getElementById(`group-next-btn-${grupKey}`);
        const navLabel = document.getElementById(`group-nav-label-${grupKey}`);
        const captionBadge = document.getElementById(`group-caption-badge-${grupKey}`);

        if (prevBtn) prevBtn.disabled = (offset === 0);
        if (nextBtn) nextBtn.disabled = (offset >= maxOffset);
        if (navLabel) navLabel.innerText = `Kolom ${1 + offset}–${capacity + offset}`;
        if (captionBadge) captionBadge.innerText = `Kolom ${1 + offset}–${capacity + offset} dari ${cols}`;
    },

    nextColPage(grupKey) {
        const capacity = this._getScreenCapacity();
        const gs = this._getGridSize(grupKey);
        const cols = gs.cols || 12;
        const maxOffset = Math.max(0, cols - capacity);
        const currentOffset = this._groupOffsets[grupKey] || 0;
        
        const jump = cols - capacity;
        const newOffset = Math.min(maxOffset, currentOffset + jump);
        this._groupOffsets[grupKey] = newOffset;

        this.updateGroupSlideUI(grupKey, true);
    },

    prevColPage(grupKey) {
        const capacity = this._getScreenCapacity();
        const gs = this._getGridSize(grupKey);
        const cols = gs.cols || 12;
        const currentOffset = this._groupOffsets[grupKey] || 0;
        
        const jump = cols - capacity;
        const newOffset = Math.max(0, currentOffset - jump);
        this._groupOffsets[grupKey] = newOffset;

        this.updateGroupSlideUI(grupKey, true);
    },

    toggleAutoSort(grupKey) {
        const key = 'map_autosort_' + grupKey;
        const current = localStorage.getItem(key) === 'true';
        localStorage.setItem(key, !current ? 'true' : 'false');
        if (window.Dashboard && window.Dashboard.lastData) {
            window.Dashboard._render(window.Dashboard.lastData, true);
        }
    },

    isNicSpeedDrop(speed) {
        // Cek preferensi user: jika deteksi dimatikan (misal pakai Cat 5 / 100Mbps), jangan tampilkan warning
        const isDetectionEnabled = localStorage.getItem('dashboard_nic_drop_detection') !== 'false';
        if (!isDetectionEnabled) return false;

        if (!speed || speed === '-' || speed === 'Unknown') return false;
        const s = String(speed).toLowerCase();
        let isGigabitOrMore = false;
        if (s.includes('gbps')) {
            const val = parseFloat(s.replace(/[^0-9.]/g, ''));
            isGigabitOrMore = !isNaN(val) && val >= 1.0;
        } else if (s.includes('mbps')) {
            const val = parseFloat(s.replace(/[^0-9.]/g, ''));
            isGigabitOrMore = !isNaN(val) && val >= 1000.0;
        }
        return !isGigabitOrMore;
    },

    renderCompactCard(pc) {
        const isActive = pc.status === 'terpakai';
        const sesi = pc.sesi_detail;
        const isAfk = isActive && sesi && (pc.is_afk || sesi.is_afk);
        const isLostConnection = isActive && (pc.status_koneksi === 'no_heartbeat' || pc.status_koneksi === 'offline');
        const isOnline = pc.status_koneksi === 'online' || pc.online === true || isActive || pc.is_admin_mode;
        const isSpeedDrop = !isLostConnection && isOnline && this.isNicSpeedDrop(pc.nic_speed);
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
            borderStyle = '';
        } else if (isActive && sesi) {
            if (isAfk) {
                statusIndicator = '●';
                indicatorColorClass = 'text-amber-400 animate-pulse';
                cardBgClass = 'bg-[#1a1308] hover:bg-[#261c0c] border-amber-500/40';

                if (sesi.sisa_menit !== null && sesi.sisa_menit !== undefined) {
                    timerStr = Utils.formatMenit(sesi.sisa_menit);
                } else {
                    timerStr = 'Unlimited';
                }
                memberName = sesi.nama_guest || sesi.member_nama || 'Guest';
                activeAppName = pc.active_window ? `🔒 ${pc.active_window}` : '🔒 AFK / Istirahat';
            } else if (sesi.tipe === 'admin') {
                const isSystem = pc.is_system_mode || pc.status === 'system' || (sesi.nama_guest || '').toUpperCase() === 'SYSTEM' || (sesi.member_nama || '').toUpperCase() === 'SYSTEM';
                if (isSystem) {
                    indicatorColorClass = 'text-indigo-400';
                    cardBgClass = 'bg-[#0f121d] hover:bg-[#151928] border-indigo-500/30';
                    timerStr = 'SYSTEM MODE';
                    memberName = 'SYSTEM';
                    activeAppName = '-';
                } else {
                    indicatorColorClass = 'text-amber-500';
                    cardBgClass = 'bg-[#18120a] hover:bg-[#241b0f]';
                    timerStr = 'ADMIN MODE';
                    memberName = sesi.member_nama || 'ADMIN';
                    activeAppName = '-';
                }
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
        } else if (pc.is_system_mode || pc.status === 'system') {
            statusIndicator = '●';
            indicatorColorClass = 'text-indigo-400';
            cardBgClass = 'bg-[#0f121d] hover:bg-[#151928] border-indigo-500/30';
            timerStr = 'SYSTEM';
            memberName = 'SYSTEM';
            activeAppName = '-';
        } else if (pc.is_admin_mode || pc.status === 'admin') {
            statusIndicator = '●';
            indicatorColorClass = 'text-amber-500';
            cardBgClass = 'bg-[#18120a] hover:bg-[#241b0f]';
            timerStr = 'ADMIN';
            memberName = pc.sesi_detail?.member_nama || pc.sesi_detail?.nama_guest || 'ADMIN';
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

        // Jika PC online dan mengalami speed drop NIC (< 1 Gbps / 100M), aktifkan animasi card oranye berdenyut
        if (isSpeedDrop) {
            cardBgClass = 'animate-pulse-orange-bg';
            cardBorderClass = 'border';
            borderStyle = '';
        }

        const isSystemCard = pc.is_system_mode || pc.status === 'system' || (sesi?.tipe === 'admin' && ((sesi.nama_guest || '').toUpperCase() === 'SYSTEM' || (sesi.member_nama || '').toUpperCase() === 'SYSTEM'));
        const isAdminCard = !isSystemCard && (pc.is_admin_mode || pc.status === 'admin' || sesi?.tipe === 'admin');

        const borderAttr = borderStyle ? `style="${borderStyle}"` : '';
        const timerColorClass = isAfk ? 'text-amber-400' : (isSystemCard ? 'text-indigo-400' : (isAdminCard ? 'text-amber-400' : (isActive && sesi && sesi.sisa_menit <= 5 ? 'text-red-400 animate-pulse' : 'text-emerald-300')));
        // Tipografi dinamis yang fit dan proporsional untuk 8 kolom (lg), 10 kolom (xl), dan 12 kolom (2xl)
        const timerFontSizeClass = timerStr.length > 8 
            ? 'text-[10px] lg:text-[10px] xl:text-[11px] 2xl:text-xs' 
            : 'text-[11px] lg:text-xs xl:text-xs 2xl:text-sm';
            
        const kodeFontSizeClass = (pc.kode || '').length > 7 
            ? 'text-[10px] lg:text-[11px] xl:text-xs 2xl:text-sm' 
            : 'text-xs lg:text-xs xl:text-sm 2xl:text-base';

        const isSelected = window.DashboardSelection && window.DashboardSelection.isSelected(pc.id);
        const selectionClasses = isSelected ? 'ring-2 ring-indigo-500 border-indigo-400 bg-indigo-950/30' : '';

        // Row 2 styling: Prioritas Terputus (Merah) -> Speed Drop (Oranye) -> AFK -> Judul Proses Normal
        let row2Html = '';
        if (isLostConnection) {
            row2Html = `<div class="text-[9px] lg:text-[10px] xl:text-[11px] 2xl:text-xs text-red-400 font-bold truncate mt-0.5 animate-pulse" title="⚠️ TERPUTUS">⚠️ TERPUTUS</div>`;
        } else if (isSpeedDrop) {
            const displaySpeed = pc.nic_speed || '100 Mbps';
            const tooltipTitle = `⚠️ Kecepatan LAN Drop: ${displaySpeed} (Normal: 1 Gbps) | Proses: ${pc.active_window || '-'}`;
            row2Html = `<div class="text-[9px] lg:text-[10px] xl:text-[11px] 2xl:text-xs text-amber-400 font-bold truncate mt-0.5 animate-pulse" title="${tooltipTitle}">⚠️ LAN ${displaySpeed}</div>`;
        } else if (isActive && sesi && isAfk) {
            const afkText = pc.active_window ? `🔒 ${pc.active_window}` : '🔒 AFK / Istirahat';
            row2Html = `<div class="text-[9px] lg:text-[10px] xl:text-[11px] 2xl:text-xs text-amber-400 font-bold truncate mt-0.5" title="${afkText}">${afkText}</div>`;
        } else {
            row2Html = `<div class="text-[9px] lg:text-[10px] xl:text-[11px] 2xl:text-xs text-neutral-400 truncate mt-0.5" title="${activeAppName || '-'}">${activeAppName || '-'}</div>`;
        }

        return `
            <div class="pc-card-item relative ${cardBorderClass} ${cardBgClass} ${cardOpacityClass} ${selectionClasses} rounded-xl p-2 lg:p-2 xl:p-2.5 2xl:p-3 cursor-pointer transition-colors hover:brightness-125 flex flex-col justify-between text-left min-h-[96px] lg:min-h-[102px] xl:min-h-[108px] 2xl:min-h-[120px] h-auto w-full shadow-lg select-none" 
                 data-pc-id="${pc.id}"
                 data-pc-kode="${pc.kode}"
                 data-pc-grup="${pc.grup || ''}"
                 data-pos-x="${pc.pos_x !== undefined && pc.pos_x !== null ? pc.pos_x : -1}"
                 data-pos-y="${pc.pos_y !== undefined && pc.pos_y !== null ? pc.pos_y : -1}"
                 ${borderAttr}
                 ondragstart="return false"
                 onmousedown="event.button === 0 && window.DashboardSelection && DashboardSelection.handleCardMouseDown(event, ${pc.id})"
                 onclick="event.preventDefault(); event.stopPropagation(); (window.DashboardSelection ? DashboardSelection.handleCardClick(event, ${pc.id}) : Dashboard.showContextMenu(event, ${pc.id}))"
                 oncontextmenu="event.preventDefault(); event.stopPropagation(); (window.DashboardSelection ? DashboardSelection.handleCardContextMenu(event, ${pc.id}) : Dashboard.showContextMenu(event, ${pc.id}))">
                
                <!-- Row 1: Kode PC - Inline Selection Checkmark - Status DOT (Lebar leluasa tanpa badge pendesak) -->
                <div class="flex items-center justify-between gap-1">
                    <div class="flex items-center gap-1 min-w-0 flex-1">
                        <span class="selection-check-badge text-indigo-400 font-black text-[10px] lg:text-xs xl:text-xs 2xl:text-sm shrink-0 ${isSelected ? '' : 'hidden'}">✓</span>
                        <span class="${kodeFontSizeClass} font-black text-neutral-100 tracking-tight truncate flex-1">${pc.kode}</span>
                    </div>
                    <span class="pc-card-dot w-2 h-2 xl:w-2.5 xl:h-2.5 rounded-full ${indicatorColorClass} shrink-0 bg-current"></span>
                </div>
                <!-- Row 2: Aplikasi / Active Window / Status AFK & Terputus -->
                <div class="pc-card-row2">${row2Html}</div>
                <!-- Row 3: Timer -->
                <div class="pc-card-timer ${timerFontSizeClass} font-black font-mono ${timerColorClass} mt-0.5">
                    ${timerStr}
                </div>
                <!-- Row 4: Nama Member / Guest -->
                <div class="pc-card-user text-[9px] lg:text-[10px] xl:text-[11px] 2xl:text-xs text-neutral-300 truncate font-bold mt-0.5" title="${memberName}">
                    ${memberName}
                </div>
            </div>
        `;
    },

    syncLiveCards(data) {
        if (!data || !data.pc_list || !Array.isArray(data.pc_list)) return;
        const allCards = document.querySelectorAll('.pc-card-item');
        if (!allCards || allCards.length === 0) {
            this.render(data);
            return;
        }

        data.pc_list.forEach(pc => {
            const cardEl = document.querySelector(`.pc-card-item[data-pc-id="${pc.id}"]`);
            if (!cardEl) return;

            const isActive = pc.status === 'terpakai';
            const sesi = pc.sesi_detail;
            const isAfk = isActive && sesi && (pc.is_afk || sesi.is_afk);
            const isLostConnection = isActive && (pc.status_koneksi === 'no_heartbeat' || pc.status_koneksi === 'offline');
            const isOnline = pc.status_koneksi === 'online' || pc.online === true || isActive || pc.is_admin_mode;
            const isSpeedDrop = !isLostConnection && isOnline && this.isNicSpeedDrop(pc.nic_speed);
            const customColor = Dashboard.lastData?.grup_meta?.[pc.grup]?.warna || '#737373';

            let cardBgClass = 'bg-[#161616] hover:bg-[#1c1c1c]';
            let cardBorderClass = 'border';
            let cardOpacityClass = 'opacity-100';
            let indicatorColorClass = 'text-neutral-500';

            let activeAppName = '';
            let timerStr = '';
            let memberName = '';
            let borderStyle = `border-color: ${customColor}80`;

            if (isLostConnection) {
                cardBgClass = 'animate-pulse-red-bg';
                cardBorderClass = 'border';
                indicatorColorClass = 'text-red-500 animate-pulse';
                timerStr = sesi ? Utils.formatMenit(sesi.sisa_menit) : '--:--';
                activeAppName = '⚠️ TERPUTUS';
                memberName = sesi ? (sesi.nama_guest || sesi.member_nama || 'Guest') : '';
                borderStyle = '';
            } else if (isActive && sesi) {
                if (isAfk) {
                    indicatorColorClass = 'text-amber-400 animate-pulse';
                    cardBgClass = 'bg-[#1a1308] hover:bg-[#261c0c] border-amber-500/40';
                    timerStr = (sesi.sisa_menit !== null && sesi.sisa_menit !== undefined) ? Utils.formatMenit(sesi.sisa_menit) : 'Unlimited';
                    memberName = sesi.nama_guest || sesi.member_nama || 'Guest';
                    activeAppName = pc.active_window ? `🔒 ${pc.active_window}` : '🔒 AFK / Istirahat';
                } else if (sesi.tipe === 'admin') {
                    const isSystem = pc.is_system_mode || pc.status === 'system' || (sesi.nama_guest || '').toUpperCase() === 'SYSTEM' || (sesi.member_nama || '').toUpperCase() === 'SYSTEM';
                    if (isSystem) {
                        indicatorColorClass = 'text-indigo-400';
                        cardBgClass = 'bg-[#0f121d] hover:bg-[#151928] border-indigo-500/30';
                        timerStr = 'SYSTEM MODE';
                        memberName = 'SYSTEM';
                        activeAppName = '-';
                    } else {
                        indicatorColorClass = 'text-amber-500';
                        cardBgClass = 'bg-[#18120a] hover:bg-[#241b0f]';
                        timerStr = 'ADMIN MODE';
                        memberName = sesi.member_nama || 'ADMIN';
                        activeAppName = '-';
                    }
                } else {
                    indicatorColorClass = 'text-emerald-400';
                    timerStr = (sesi.sisa_menit !== null && sesi.sisa_menit !== undefined) ? Utils.formatMenit(sesi.sisa_menit) : 'Unlimited';
                    memberName = sesi.nama_guest || sesi.member_nama || 'Guest';
                    activeAppName = pc.active_window || '-';
                }
            } else if (pc.is_system_mode || pc.status === 'system') {
                indicatorColorClass = 'text-indigo-400';
                cardBgClass = 'bg-[#0f121d] hover:bg-[#151928] border-indigo-500/30';
                timerStr = 'SYSTEM';
                memberName = 'SYSTEM';
                activeAppName = '-';
            } else if (pc.is_admin_mode || pc.status === 'admin') {
                indicatorColorClass = 'text-amber-500';
                cardBgClass = 'bg-[#18120a] hover:bg-[#241b0f]';
                timerStr = 'ADMIN';
                memberName = pc.sesi_detail?.member_nama || pc.sesi_detail?.nama_guest || 'ADMIN';
                activeAppName = '-';
            } else if (pc.status_koneksi === 'online') {
                indicatorColorClass = 'text-neutral-400';
                cardBgClass = 'bg-[#1a1a1a] hover:bg-[#222]';
                timerStr = 'KOSONG';
                memberName = '-';
                activeAppName = '-';
            } else {
                cardOpacityClass = 'opacity-60';
                cardBgClass = 'bg-[#141414]';
                cardBorderClass = 'border border-dashed';
                indicatorColorClass = 'text-neutral-600';
                timerStr = 'OFFLINE';
                memberName = '-';
                activeAppName = '-';
            }

            if (isSpeedDrop) {
                cardBgClass = 'animate-pulse-orange-bg';
                cardBorderClass = 'border';
                borderStyle = '';
            }

            const isSystemCard = pc.is_system_mode || pc.status === 'system' || (sesi?.tipe === 'admin' && ((sesi.nama_guest || '').toUpperCase() === 'SYSTEM' || (sesi.member_nama || '').toUpperCase() === 'SYSTEM'));
            const isAdminCard = !isSystemCard && (pc.is_admin_mode || pc.status === 'admin' || sesi?.tipe === 'admin');
            const timerColorClass = isAfk ? 'text-amber-400' : (isSystemCard ? 'text-indigo-400' : (isAdminCard ? 'text-amber-400' : (isActive && sesi && sesi.sisa_menit <= 5 ? 'text-red-400 animate-pulse' : 'text-emerald-300')));
            const timerFontSizeClass = timerStr.length > 8 ? 'text-[10px] lg:text-[10px] xl:text-[11px] 2xl:text-xs' : 'text-[11px] lg:text-xs xl:text-xs 2xl:text-sm';

            let row2Html = '';
            if (isLostConnection) {
                row2Html = `<div class="text-[9px] lg:text-[10px] xl:text-[11px] 2xl:text-xs text-red-400 font-bold truncate mt-0.5 animate-pulse" title="⚠️ TERPUTUS">⚠️ TERPUTUS</div>`;
            } else if (isSpeedDrop) {
                const displaySpeed = pc.nic_speed || '100 Mbps';
                const tooltipTitle = `⚠️ Kecepatan LAN Drop: ${displaySpeed} (Normal: 1 Gbps) | Proses: ${pc.active_window || '-'}`;
                row2Html = `<div class="text-[9px] lg:text-[10px] xl:text-[11px] 2xl:text-xs text-amber-400 font-bold truncate mt-0.5 animate-pulse" title="${tooltipTitle}">⚠️ LAN ${displaySpeed}</div>`;
            } else if (isActive && sesi && isAfk) {
                const afkText = pc.active_window ? `🔒 ${pc.active_window}` : '🔒 AFK / Istirahat';
                row2Html = `<div class="text-[9px] lg:text-[10px] xl:text-[11px] 2xl:text-xs text-amber-400 font-bold truncate mt-0.5" title="${afkText}">${afkText}</div>`;
            } else {
                row2Html = `<div class="text-[9px] lg:text-[10px] xl:text-[11px] 2xl:text-xs text-neutral-400 truncate mt-0.5" title="${activeAppName || '-'}">${activeAppName || '-'}</div>`;
            }

            const timerEl = cardEl.querySelector('.pc-card-timer');
            if (timerEl) {
                if (timerEl.textContent.trim() !== timerStr) timerEl.textContent = timerStr;
                timerEl.className = `pc-card-timer ${timerFontSizeClass} font-black font-mono ${timerColorClass} mt-0.5`;
            }

            const row2El = cardEl.querySelector('.pc-card-row2');
            if (row2El) {
                if (row2El.innerHTML !== row2Html) row2El.innerHTML = row2Html;
            }

            const userEl = cardEl.querySelector('.pc-card-user');
            if (userEl) {
                if (userEl.textContent.trim() !== memberName) {
                    userEl.textContent = memberName;
                    userEl.title = memberName;
                }
            }

            const dotEl = cardEl.querySelector('.pc-card-dot');
            if (dotEl) {
                dotEl.className = `pc-card-dot w-2 h-2 xl:w-2.5 xl:h-2.5 rounded-full ${indicatorColorClass} shrink-0 bg-current`;
            }

            const isSelected = window.DashboardSelection && window.DashboardSelection.isSelected(pc.id);
            const selectionClasses = isSelected ? 'ring-2 ring-indigo-500 border-indigo-400 bg-indigo-950/30' : '';
            const targetClassName = `pc-card-item relative ${cardBorderClass} ${cardBgClass} ${cardOpacityClass} ${selectionClasses} rounded-xl p-2 lg:p-2 xl:p-2.5 2xl:p-3 cursor-pointer transition-colors hover:brightness-125 flex flex-col justify-between text-left min-h-[96px] lg:min-h-[102px] xl:min-h-[108px] 2xl:min-h-[120px] h-auto w-full shadow-lg select-none`;
            if (cardEl.className !== targetClassName) {
                cardEl.className = targetClassName;
            }
            if (borderStyle) {
                cardEl.style.borderColor = `${customColor}80`;
            } else {
                cardEl.style.borderColor = '';
            }
        });
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
        const capacity = this._getScreenCapacity();

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
            const cols = gs.cols || 12;
            const rows = gs.rows || 7;

            const activeCount = pcs.filter(p => p.status === 'terpakai').length;

            const mapped = pcs.filter(p => p.pos_x >= 0 && p.pos_y >= 0);
            const unmapped = pcs.filter(p => p.pos_x < 0 || p.pos_y < 0);

            const isCrossScreen = !isMobile && !isAutoSort && cols > capacity;
            const maxOffset = Math.max(0, cols - capacity);
            const offset = Math.min(maxOffset, this._groupOffsets[grupKey] || 0);

            // Kontrol Paging Slide Arrow di Header
            const pageNavHtml = isCrossScreen ? `
                <div class="flex items-center gap-1 bg-[#141414] border border-[#2a2a2a] rounded px-2 py-1 text-xs">
                    <button onclick="CompactGrid.prevColPage('${grupKey}')" 
                        id="group-prev-btn-${grupKey}"
                        ${offset === 0 ? 'disabled' : ''} 
                        title="Lihat kolom sebelumnya"
                        class="px-1.5 py-0.5 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded disabled:opacity-25 disabled:cursor-not-allowed transition-all">
                        ◀
                    </button>
                    <span id="group-nav-label-${grupKey}" class="font-mono text-[11px] text-neutral-300 font-bold px-1.5">
                        Kolom ${1 + offset}–${capacity + offset}
                    </span>
                    <button onclick="CompactGrid.nextColPage('${grupKey}')" 
                        id="group-next-btn-${grupKey}"
                        ${offset >= maxOffset ? 'disabled' : ''} 
                        title="Lihat kolom berikutnya"
                        class="px-1.5 py-0.5 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded disabled:opacity-25 disabled:cursor-not-allowed transition-all">
                        ▶
                    </button>
                </div>
            ` : '';

            // Helper Caption Banner untuk End-User Kasir/Operator
            const helperCaptionHtml = isCrossScreen ? `
                <div class="mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between gap-3 text-xs text-amber-300">
                    <div class="flex items-center gap-2">
                        <span class="text-base shrink-0">💡</span>
                        <span class="leading-relaxed">
                            Denah grup ini memiliki <strong>${cols} kolom</strong> (layar saat ini menampilkan <strong>${capacity} kolom</strong>). Gunakan tombol panah <strong>[ ◀ ] [ ▶ ]</strong> di kanan atas untuk menggeser dan melihat kolom lainnya.
                        </span>
                    </div>
                    <div id="group-caption-badge-${grupKey}" class="font-mono text-[11px] bg-amber-500/20 border border-amber-500/30 px-2 py-1 rounded text-amber-200 shrink-0 font-bold hidden sm:inline-block">
                        Kolom ${1 + offset}–${capacity + offset} dari ${cols}
                    </div>
                </div>
            ` : '';

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
                            ${pageNavHtml}

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
                        <div class="grid gap-2 grid-cols-2 p-1">
                            ${pcs.map(pc => {
                        return `
                                    <div>
                                        ${this.renderCompactCard(pc)}
                                    </div>
                                `;
                    }).join('')}
                        </div>
                    ` : `
                        <!-- Auto-Sort Grid: flows naturally in 8 (lg), 10 (xl), 12 (2xl) columns without overflow clipping -->
                        <div class="auto-grid-wrapper w-full p-1">
                            <div class="auto-grid-container grid gap-2 grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 auto-rows-fr">
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
                        ${helperCaptionHtml}
                        <!-- Manual Layout Grid: uses absolute pos_x / pos_y with paged sliding if cols > capacity -->
                        <div class="manual-grid-viewport overflow-hidden w-full p-1 relative" data-grup="${grupKey}">
                            <div class="manual-grid-container grid gap-2 auto-rows-fr" 
                                 data-grup="${grupKey}"
                                 data-cols="${cols}" 
                                 data-rows="${rows}"
                                 data-offset="${offset}"
                                 style="
                                    grid-template-columns: repeat(${cols}, minmax(0, 1fr)); 
                                    grid-template-rows: repeat(${rows}, minmax(0, 1fr));
                                 ">
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
        const emptyStateHtml = `
            <div class="flex flex-col items-center justify-center py-24 text-neutral-500 w-full">
                <div class="w-12 h-12 rounded-full bg-[#141414] border border-[#222] flex items-center justify-center mb-3 text-neutral-500 text-xl">
                    🖥️
                </div>
                <p class="text-xs lg:text-base font-bold uppercase tracking-wider text-neutral-400">Belum Ada Data PC</p>
                <p class="text-[10px] lg:text-xs text-neutral-600 mt-1 text-center">Tambahkan unit PC dan grup di tab data master</p>
            </div>
        `;

        container.innerHTML = html || emptyStateHtml;
        Dashboard.attachEvents();
        if (window.DashboardSelection) {
            window.DashboardSelection.init();
            window.DashboardSelection.updateUI();
        }

        // Langsung apply border color inline setelah innerHTML agar warna grup tampil di frame pertama tanpa jeda
        if (data && data.pc_list && data.grup_meta) {
            document.querySelectorAll('.pc-card-item').forEach(cardEl => {
                const pcId = parseInt(cardEl.dataset.pcId, 10);
                const pc = data.pc_list.find(p => p.id === pcId);
                if (!pc) return;
                const grup = pc.grup || '';
                const customColor = data.grup_meta?.[grup]?.warna || '#737373';
                const isLostConnection = (pc.status === 'terpakai') && (pc.status_koneksi === 'no_heartbeat' || pc.status_koneksi === 'offline');
                const isOnline = pc.status_koneksi === 'online' || pc.online === true || pc.status === 'terpakai' || pc.is_admin_mode;
                const isSpeedDrop = !isLostConnection && isOnline && this.isNicSpeedDrop(pc.nic_speed);
                if (!isLostConnection && !isSpeedDrop) {
                    cardEl.style.borderColor = `${customColor}80`;
                } else {
                    cardEl.style.borderColor = '';
                }
            });
        }

        this.adjustGridScale();
        requestAnimationFrame(() => {
            this.adjustGridScale();
        });
    },

    adjustGridScale() {
        document.querySelectorAll('.manual-grid-viewport').forEach(viewport => {
            const grupKey = viewport.dataset.grup;
            if (grupKey) {
                this.updateGroupSlideUI(grupKey, false);
            }
        });

        document.querySelectorAll('.auto-grid-wrapper').forEach(wrapper => {
            const grid = wrapper.querySelector('.auto-grid-container');
            if (grid) {
                grid.style.width = '100%';
                grid.style.transform = 'none';
            }
            wrapper.style.height = '';
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
