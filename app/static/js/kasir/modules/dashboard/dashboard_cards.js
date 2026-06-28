// app/static/js/kasir/modules/dashboard/dashboard_cards.js

const DashboardCards = {
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

    render(data) {
        const container = document.getElementById('pc-area');
        if (!container) {
            console.error('[Dashboard] #pc-area not found!');
            return;
        }

        let html = '';
        const allGroups = Object.keys(data.by_grup);
        const groupsToRender = Dashboard.activeGrup === 'semua'
            ? allGroups.sort()
            : [Dashboard.activeGrup];

        const gridCols = Dashboard.isSidebarMini
            ? 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12'
            : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10';

        groupsToRender.forEach(grupKey => {
            const pcs = data.by_grup[grupKey] || [];
            if (pcs.length === 0) return;

            const aktif = pcs.filter(p => p.status === 'terpakai').length;

            html += `
                <div class="mb-8">
                    <div class="flex items-center justify-between mb-4 pb-2 border-b border-[#252525]">
                        <h4 class="text-xs font-bold text-neutral-300 tracking-wider uppercase">${grupKey.toUpperCase()}</h4>
                        <span class="text-xs text-neutral-400 font-mono font-bold">${aktif} / ${pcs.length} AKTIF</span>
                    </div>
                    <div class="grid ${gridCols} gap-4">
                        ${pcs.map(pc => this.renderCard(pc)).join('')}
                    </div>
                </div>`;
        });

        container.innerHTML = html || '<div class="text-center py-20 text-neutral-500 text-sm">Data PC Tidak Tersedia</div>';
        Dashboard.attachEvents();
    },

    renderCard(pc) {
        const isActive = pc.status === 'terpakai';
        const sesi = pc.sesi_detail;
        const groupLower = (pc.grup || '').toLowerCase();
        const isLostConnection = isActive && (pc.status_koneksi === 'no_heartbeat' || pc.status_koneksi === 'offline');

        const customColor = Dashboard.lastData?.grup_meta?.[pc.grup]?.warna || '#737373';
        const labelHtml = `<span class="px-1 py-0.5 rounded-[3px] text-[10px] lg:text-xs font-bold border leading-none tracking-wide" style="color: ${customColor}; border-color: ${customColor}30; background-color: ${customColor}10">${pc.grup.toUpperCase()}</span>`;

        let cardContent = '';
        let buttons = '';
        let cardBgClass = 'bg-[#161616] hover:bg-[#1c1c1c]';
        let cardBorderClass = 'border-[#262626]';
        let cardOpacityClass = 'opacity-100';
        let statusIndicator = '○';
        let indicatorColorClass = 'text-neutral-500';
        let textColorClass = 'text-neutral-200';

        // 1. KONDISI TERPUTUS DI TENGAH SESI (EMERGENCY)
        if (isLostConnection) {
            cardBgClass = 'bg-[#161616]';
            cardBorderClass = 'border-[#ef4444] border-dashed';
            statusIndicator = '[!]';
            indicatorColorClass = 'text-red-500 animate-pulse';

            cardContent = `
                <div class="text-center py-2">
                    <div class="text-lg font-black text-red-500 font-mono tracking-tight">${sesi ? Utils.formatMenit(sesi.sisa_menit) : '--:--'}</div>
                    <div class="text-xs text-[#f43f5e] font-black tracking-widest animate-pulse mt-1">⚠️ TERPUTUS</div>
                    <div class="text-lg text-neutral-400 font-medium truncate block mt-1" title="${sesi ? (sesi.nama_guest || sesi.member_nama || 'Guest') : ''}">${sesi ? (sesi.nama_guest || sesi.member_nama || 'Guest') : ''}</div>
                </div>
            `;
            buttons = `
                <div class="flex gap-1 mt-3 pt-2 border-t border-red-950/40">
                    <button onclick="event.stopPropagation(); Dashboard.tutupSesi(${sesi.id})" 
                        class="flex-1 py-1 text-[10px] font-bold bg-[#3b1216] border border-[#ef4444]/30 text-red-200 hover:bg-red-600 hover:text-white rounded transition-colors uppercase">STOP</button>
                    <button onclick="event.stopPropagation(); TambahModal.open(${sesi.id}, '${pc.grup}')" 
                        class="flex-1 py-1 text-[10px] font-bold bg-[#171717] border border-[#262626] text-neutral-300 hover:bg-neutral-100 hover:text-black rounded transition-colors uppercase">TAMBAH</button>
                </div>
            `;
        }
        // 2. KONDISI AKTIF NORMAL
        else if (isActive && sesi) {
            statusIndicator = '●';
            indicatorColorClass = 'text-emerald-400';
            cardBgClass = 'bg-[#0a140f] hover:bg-[#0f2017]';
            cardBorderClass = 'border-emerald-500/20';
            textColorClass = 'text-neutral-200';

            if (sesi.tipe === 'admin') {
                indicatorColorClass = 'text-amber-500';
                cardBgClass = 'bg-[#18120a] hover:bg-[#241b0f]';
                cardBorderClass = 'border-amber-500/20';
                cardContent = `
                    <div class="text-center py-2 ${textColorClass}">
                        <div class="text-xs font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded inline-block">ADMIN MODE</div>
                        <div class="text-lg font-bold truncate block mt-1.5">${sesi.member_nama || 'ADMIN'}</div>
                    </div>
                `;
                buttons = `
                    <button onclick="event.stopPropagation(); Dashboard.logoutAdmin(${pc.id}, ${sesi.id})" 
                        class="w-full mt-3 py-1.5 text-[10px] font-bold bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-300 hover:bg-neutral-100 hover:text-black rounded transition-colors uppercase">
                        LOGOUT ADMIN
                    </button>
                `;
            } else {
                let timeStr = 'Unlimited';
                let progressBarHtml = '';

                if (sesi.sisa_menit !== null && sesi.sisa_menit !== undefined) {
                    timeStr = Utils.formatMenit(sesi.sisa_menit);

                    if (sesi.durasi_beli_menit > 0) {
                        const pct = Math.max(0, Math.min(100, (sesi.sisa_menit / sesi.durasi_beli_menit) * 100));
                        const isCritical = sesi.sisa_menit <= 5;
                        const barColor = isCritical ? 'bg-red-500 animate-pulse' : 'bg-emerald-400';
                        progressBarHtml = `
                            <div class="w-full bg-neutral-900 rounded-full h-1 mt-1.5 overflow-hidden border border-white/5">
                                <div class="h-full ${barColor}" style="width: ${pct}%"></div>
                            </div>
                        `;
                    }
                }

                cardContent = `
                    <div class="text-center py-2 ${textColorClass}">
                        <div class="text-lg font-black font-mono tracking-tight">${timeStr}</div>
                        <div class="text-lg font-bold truncate block opacity-80" title="${sesi.nama_guest || sesi.member_nama || 'Guest'}">${sesi.nama_guest || sesi.member_nama || 'Guest'}</div>
                        ${progressBarHtml}
                    </div>
                `;

                buttons = `
                    <div class="flex gap-1 mt-3 pt-2 border-t border-white/5">
                        <button onclick="event.stopPropagation(); Dashboard.tutupSesi(${sesi.id})" 
                            class="flex-1 py-1 text-[10px] font-bold bg-[#3b1216] border border-[#ef4444]/20 text-red-200 hover:bg-red-600 hover:text-white rounded transition-colors uppercase">STOP</button>
                        <button onclick="event.stopPropagation(); TambahModal.open(${sesi.id}, '${pc.grup}')" 
                            class="flex-1 py-1 text-[10px] font-bold bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-300 hover:bg-neutral-100 hover:text-black rounded transition-colors uppercase">TAMBAH</button>
                    </div>
                `;
            }
        }
        // 3. ADMIN MODE TANPA SESI TRANSAKSI
        else if (pc.is_admin_mode) {
            statusIndicator = '●';
            indicatorColorClass = 'text-amber-500';
            cardBgClass = 'bg-[#18120a] hover:bg-[#241b0f]';
            cardBorderClass = 'border-amber-500/20';
            textColorClass = 'text-neutral-200';

            cardContent = `
                <div class="text-center py-2 ${textColorClass}">
                    <div class="text-xs font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded inline-block">ADMIN BYPASS</div>
                </div>
            `;
            buttons = `
                <button onclick="event.stopPropagation(); Dashboard.logoutAdmin(${pc.id})" 
                    class="w-full mt-3 py-1.5 text-[10px] font-bold bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-300 hover:bg-neutral-100 hover:text-black rounded transition-colors uppercase">
                    LOGOUT ADMIN
                </button>
            `;
        }
        // 4. KONDISI KOSONG (ONLINE)
        else if (pc.status_koneksi === 'online') {
            statusIndicator = '○';
            indicatorColorClass = 'text-neutral-400';

            cardBgClass = 'bg-[#1a1a1a] hover:bg-[#222]';
            cardBorderClass = 'border-[#2e2e2e]';

            cardContent = `
                <div class="text-center py-3">
                    <div class="text-xs text-neutral-500 font-bold tracking-widest uppercase">KOSONG</div>
                </div>
            `;
            buttons = `
                <button onclick="event.stopPropagation(); BukaModal.open('${pc.kode}', '${pc.grup}')" 
                    class="w-full mt-2 py-1.5 text-xs font-bold text-neutral-300 bg-[#171717] border border-[#262626] hover:bg-neutral-100 hover:text-black rounded transition-all uppercase">
                    BUKA SESI
                </button>
            `;
        }
        // 5. KONDISI OFFLINE MATI
        else {
            cardOpacityClass = 'opacity-50';
            cardBgClass = 'bg-[#141414]';
            cardBorderClass = 'border-[#222] border-dashed';
            statusIndicator = '[!]';
            indicatorColorClass = 'text-neutral-600';

            cardContent = `
                <div class="text-center py-3">
                    <div class="text-xs text-neutral-600 font-bold tracking-widest uppercase">OFFLINE</div>
                </div>
            `;
            buttons = `
                <button onclick="event.stopPropagation(); BukaModal.open('${pc.kode}', '${pc.grup}')" 
                    class="w-full mt-2 py-1.5 text-xs font-bold text-neutral-400 bg-[#171717] border border-[#262626] hover:bg-neutral-100 hover:text-black rounded transition-all uppercase">
                    BUKA SESI
                </button>
            `;
        }

        return `
            <div class="border ${cardBorderClass} ${cardBgClass} ${cardOpacityClass} rounded-lg p-3 cursor-pointer transition-all hover-card-trigger" 
                 onclick="Dashboard.showDetail(${pc.id})"
                 oncontextmenu="event.preventDefault(); event.stopPropagation(); Dashboard.showContextMenu(event, ${pc.id})">
                <!-- Row 1: Kode + Status -->
                <div class="flex items-center justify-between mb-1">
                    <span class="text-sm font-bold tracking-tight ${textColorClass}">${pc.kode}</span>
                    <div class="flex items-center gap-1.5">
                        <button onclick="event.stopPropagation(); Dashboard.showDetail(${pc.id})" 
                            class="lg:hidden p-1 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded transition-colors w-7 h-7 flex items-center justify-center text-sm font-bold leading-none select-none"
                            title="Opsi PC">
                            ⋮
                        </button>
                        <span class="text-xs font-bold font-mono leading-none ${indicatorColorClass}">${statusIndicator}</span>
                    </div>
                </div>
                <!-- Row 2: IP -->
                <div class="mb-0.5">
                    <span class="text-[11px] text-neutral-600 font-mono">${pc.ip_address || '-'}</span>
                </div>
                <!-- Row 3: Active Window -->
                ${(isActive || pc.is_admin_mode) && pc.active_window && pc.active_window !== 'Idle / None' ? `
                <div class="mb-0.5 truncate text-lg text-neutral-500 font-medium" title="${pc.active_window}">
                    ${pc.active_window}
                </div>
                ` : ''}
                <!-- Row 4: Grup badge -->
                <div class="mb-0.5">
                    ${labelHtml}
                </div>
                ${cardContent}
                ${buttons}
            </div>
        `;
    }
};

window.DashboardCards = DashboardCards;
