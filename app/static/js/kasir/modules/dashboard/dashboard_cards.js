// app/static/js/kasir/modules/dashboard/dashboard_cards.js
// Mintlify Dark — PC Grid Cards

const DashboardCards = {
    renderTabs(data) {
        const container = document.getElementById('group-tabs');
        if (!container) return;

        const groups = Object.keys(data.by_grup || {}).sort();
        const meta = data.grup_meta || {};

        let html = `
            <button onclick="Dashboard.setGrup('semua')"
                class="px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 border
                ${Dashboard.activeGrup === 'semua'
                ? 'bg-neutral-100 text-black border-neutral-100 shadow-sm'
                : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-500 hover:text-neutral-100'}"
                data-grup="semua">
                SEMUA
            </button>
        `;

        groups.forEach(g => {
            const isActive = Dashboard.activeGrup === g;
            const customColor = meta[g]?.warna || '#737373';
            const count = (data.by_grup[g] || []).length;

            html += `
                <button onclick="Dashboard.setGrup('${g}')"
                    class="px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-150 border flex items-center gap-1.5
                    ${isActive
                    ? 'bg-neutral-100 text-black border-neutral-100 shadow-sm'
                    : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-500 hover:text-neutral-100'}">
                    <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${customColor}"></span>
                    ${g.toUpperCase()}
                    ${count ? `<span class="text-xs opacity-60">${count}</span>` : ''}
                </button>
            `;
        });

        container.innerHTML = html;
    },

    render(data) {
        const container = document.getElementById('pc-area');
        if (!container) return;

        let html = '';
        const allGroups = Object.keys(data.by_grup);
        const groupsToRender = Dashboard.activeGrup === 'semua'
            ? allGroups.sort()
            : [Dashboard.activeGrup];

        const gridCols = Dashboard.isSidebarMini
            ? 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12'
            : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-10';

        groupsToRender.forEach(grupKey => {
            const pcs = data.by_grup[grupKey] || [];
            if (pcs.length === 0) return;

            const aktif = pcs.filter(p => p.status === 'terpakai').length;

            html += `
                <div>
                    <div class="flex items-center justify-between mb-3 pb-2 border-b border-neutral-800">
                        <h4 class="text-xs font-semibold text-neutral-500 tracking-wider uppercase">${grupKey.toUpperCase()}</h4>
                        <span class="text-xs text-neutral-500 font-medium">${aktif} / ${pcs.length} aktif</span>
                    </div>
                    <div class="grid ${gridCols} gap-3">
                        ${pcs.map(pc => this.renderCard(pc)).join('')}
                    </div>
                </div>`;
        });

        container.innerHTML = html || '<div class="flex items-center justify-center py-16 text-neutral-500 text-sm">Tidak ada data PC</div>';
    },

    renderCard(pc) {
        const isActive = pc.status === 'terpakai';
        const sesi = pc.sesi_detail;
        const isLostConnection = isActive && (pc.status_koneksi === 'no_heartbeat' || pc.status_koneksi === 'offline');

        const customColor = pc.grup_warna || Dashboard.lastData?.grup_meta?.[pc.grup]?.warna || '#737373';
        const labelHtml = `<span class="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border" style="border-color:${customColor}30; color:${customColor}; background:${customColor}10">${pc.grup.toUpperCase()}</span>`;

        let bodyHtml = '';
        let buttonsHtml = '';
        let cardClasses = 'bg-[#0c0c0c] border-neutral-800';
        let statusDot = 'bg-neutral-500';

        // 1. TERPUTUS (lost connection mid-session)
        if (isLostConnection) {
            cardClasses = 'bg-[#0c0c0c] border-red-800/60 border-2';
            statusDot = 'bg-red-500 animate-pulse';

            bodyHtml = `
                <div class="text-center py-1">
                    <div class="text-lg font-bold text-red-400 font-mono">${sesi ? Utils.formatMenit(sesi.sisa_menit) : '--:--'}</div>
                    <div class="text-xs font-medium text-red-400 mt-0.5">Terputus</div>
                </div>
            `;
            buttonsHtml = `
                <div class="flex gap-1.5 mt-2 pt-2 border-t border-neutral-800">
                    <button onclick="event.stopPropagation(); Dashboard.tutupSesi(${sesi.id})"
                        class="flex-1 py-1 text-[10px] font-medium text-red-400 bg-red-500/10 border border-red-800/40 hover:bg-red-500/20 rounded-full transition-colors">STOP</button>
                    <button onclick="event.stopPropagation(); TambahModal.open(${sesi.id}, '${pc.grup}', '${pc.kode}', '${(sesi.nama_guest || sesi.member_nama || '').replace(/'/g, "\\'")}')"
                        class="flex-1 py-1 text-[10px] font-medium text-neutral-400 bg-neutral-800 border border-neutral-700 hover:border-neutral-500 rounded-full transition-colors">TAMBAH</button>
                </div>
            `;
        }
        // 2. AKTIF NORMAL
        else if (isActive && sesi) {
            statusDot = 'bg-emerald-500';

            if (sesi.tipe === 'admin') {
                statusDot = 'bg-amber-500';
                bodyHtml = `
                    <div class="text-center py-1">
                        <div class="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-800/40 px-2 py-0.5 rounded-full inline-block">ADMIN MODE</div>
                        <div class="text-sm font-medium text-neutral-200 truncate mt-1">${sesi.member_nama || 'Admin'}</div>
                    </div>
                `;
                buttonsHtml = `
                    <button onclick="event.stopPropagation(); Dashboard.logoutAdmin(${pc.id}, ${sesi.id})"
                        class="w-full mt-2 py-1 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-800/40 hover:bg-amber-500/20 rounded-full transition-colors">LOGOUT ADMIN</button>
                `;
            } else {
                let timeStr = 'Unlimited';
                let progressBarHtml = '';

                if (sesi.sisa_menit !== null && sesi.sisa_menit !== undefined) {
                    timeStr = Utils.formatMenit(sesi.sisa_menit);
                    if (sesi.durasi_beli_menit > 0) {
                        const pct = Math.max(0, Math.min(100, (sesi.sisa_menit / sesi.durasi_beli_menit) * 100));
                        const isCritical = sesi.sisa_menit <= 5;
                        const barColor = isCritical ? 'bg-red-500 animate-pulse' : 'bg-emerald-500';
                        progressBarHtml = `<div class="w-full bg-neutral-800 rounded-full h-1 mt-1.5 overflow-hidden"><div class="h-full ${barColor}" style="width: ${pct}%"></div></div>`;
                    }
                }

                bodyHtml = `
                    <div class="text-center py-1">
                        <div class="text-lg font-bold text-white font-mono tracking-tight">${timeStr}</div>
                        <div class="text-sm text-neutral-300 truncate" title="${sesi.nama_guest || sesi.member_nama || 'Guest'}">${sesi.nama_guest || sesi.member_nama || 'Guest'}</div>
                        ${progressBarHtml}
                    </div>
                `;

                buttonsHtml = `
                    <div class="flex gap-1.5 mt-2 pt-2 border-t border-neutral-800">
                        <button onclick="event.stopPropagation(); Dashboard.tutupSesi(${sesi.id})"
                            class="flex-1 py-1 text-[10px] font-medium text-red-400 bg-red-500/10 border border-red-800/40 hover:bg-red-500/20 rounded-full transition-colors">STOP</button>
                        <button onclick="event.stopPropagation(); TambahModal.open(${sesi.id}, '${pc.grup}', '${pc.kode}', '${(sesi.nama_guest || sesi.member_nama || '').replace(/'/g, "\\'")}')"
                            class="flex-1 py-1 text-[10px] font-medium text-neutral-400 bg-neutral-800 border border-neutral-700 hover:border-neutral-500 rounded-full transition-colors">TAMBAH</button>
                    </div>
                `;
            }
        }
        // 3. ADMIN BYPASS
        else if (pc.is_admin_mode) {
            statusDot = 'bg-amber-500';
            bodyHtml = `<div class="text-center py-1"><span class="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-800/40 px-2 py-0.5 rounded-full inline-block">ADMIN BYPASS</span></div>`;
            buttonsHtml = `
                <button onclick="event.stopPropagation(); Dashboard.logoutAdmin(${pc.id})"
                    class="w-full mt-2 py-1 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-800/40 hover:bg-amber-500/20 rounded-full transition-colors">LOGOUT ADMIN</button>
            `;
        }
        // 4. KOSONG (online)
        else if (pc.status_koneksi === 'online') {
            statusDot = 'bg-neutral-500';
            cardClasses = 'bg-[#0c0c0c] border-neutral-700 hover:border-neutral-500';
            bodyHtml = `<div class="text-center py-2"><span class="text-xs text-neutral-500 font-medium">KOSONG</span></div>`;
            buttonsHtml = `
                <button onclick="event.stopPropagation(); BukaModal.open('${pc.kode}', '${pc.grup}')"
                    class="w-full mt-2 py-1.5 text-xs font-medium text-black bg-emerald-500 hover:bg-emerald-400 rounded-full transition-colors">BUKA SESI</button>
            `;
        }
        // 5. OFFLINE — tetap kasih opsi BUKA SESI
        else {
            statusDot = 'bg-neutral-600';
            cardClasses = 'bg-[#0a0a0a] border-neutral-800 border-dashed opacity-70';
            bodyHtml = `<div class="text-center py-2"><span class="text-xs text-neutral-500 font-medium">OFFLINE</span></div>`;
            buttonsHtml = `
                <button onclick="event.stopPropagation(); BukaModal.open('${pc.kode}', '${pc.grup}')"
                    class="w-full mt-2 py-1.5 text-xs font-medium text-neutral-400 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 rounded-full transition-colors">BUKA SESI</button>
            `;
        }

        return `
            <div class="border ${cardClasses} rounded-xl p-3 cursor-pointer hover:border-neutral-700 transition-all"
                 onclick="Dashboard.showDetail(${pc.id})"
                 oncontextmenu="event.preventDefault(); event.stopPropagation(); Dashboard.showContextMenu(event, ${pc.id})">
                <div class="flex items-center justify-between mb-1.5">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="w-2 h-2 rounded-full ${statusDot} shrink-0"></span>
                        <span class="text-sm font-semibold text-neutral-100 font-mono">${pc.kode}</span>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 flex-wrap mb-1">
                    <span class="text-xs text-neutral-500 font-mono">${pc.ip_address || '-'}</span>
                    ${labelHtml}
                </div>
                ${(isActive || pc.is_admin_mode) && pc.active_window && pc.active_window !== 'Idle / None' ? `
                    <div class="text-xs text-neutral-500 truncate mb-1" title="${pc.active_window}">${pc.active_window}</div>
                ` : ''}
                ${bodyHtml}
                ${buttonsHtml}
            </div>
        `;
    }
};

window.DashboardCards = DashboardCards;
