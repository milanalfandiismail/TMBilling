// app/static/js/kasir/modules/pc/pc_grid.js

const PCGrid = {
    render(dataInput, meta = {}) {
        const container = document.getElementById('pc-table');
        if (!container) return;

        // Support array flat maupun legacy grouped object
        let pcList = [];
        if (Array.isArray(dataInput)) {
            pcList = dataInput;
        } else if (dataInput && typeof dataInput === 'object') {
            pcList = Object.values(dataInput).flat();
        }

        const activeGroup = meta.activeGroup || (window.PC && window.PC.groups ? window.PC.groups.find(g => Number(g.id) === Number(window.PC.currentGrupId)) : null);
        const groupName = activeGroup ? activeGroup.nama.toUpperCase() : 'Grup';

        if (!pcList || pcList.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-10 sm:py-14 2xl:py-20 text-neutral-500 bg-[#050505] border border-dashed border-[#1c1c1c] rounded">
                    <svg class="w-8 h-8 2xl:w-10 2xl:h-10 mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                    <p class="text-xs 2xl:text-sm font-bold uppercase tracking-wider text-neutral-400">Belum Ada Unit PC di ${Utils.escapeHtml(groupName)}</p>
                    <p class="text-[10px] 2xl:text-xs text-neutral-600 mt-0.5">Tambahkan PC baru atau pilih grup lain</p>
                </div>`;
            return;
        }

        const page = meta.currentPage || (window.PC ? window.PC.currentPage : 1) || 1;
        const perPage = meta.perPage || (window.PC ? window.PC.perPage : 8) || 8;
        const total = pcList.length;
        const totalPages = Math.ceil(total / perPage) || 1;
        const safePage = Math.min(Math.max(1, page), totalPages);
        const startIndex = (safePage - 1) * perPage;
        const pagedList = pcList.slice(startIndex, startIndex + perPage);

        pagedList.sort((a, b) => (a.kode || '').localeCompare(b.kode || '', undefined, { numeric: true, sensitivity: 'base' }));

        const cardsHtml = pagedList.map(pc => {
            const pcGrupNama = (pc.grup || (activeGroup ? activeGroup.nama : 'reguler')).toLowerCase();
            const pcColor = pc.grup_warna || (activeGroup ? activeGroup.warna : '#3B82F6') || '#3B82F6';
            const isKasir = (window.App && App.user && App.user.role === 'kasir');

            let statusBadge = '';
            let statusDot = '';
            if (!pc.aktif) {
                statusBadge = '<span class="text-[8px] sm:text-[9px] 2xl:text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-500 shrink-0">MAINTENANCE</span>';
                statusDot = '<span class="w-2 h-2 2xl:w-2.5 2xl:h-2.5 rounded-full bg-neutral-600 shrink-0" title="MAINTENANCE"></span>';
            } else if (pc.status === 'terpakai') {
                statusBadge = '<span class="text-[8px] sm:text-[9px] 2xl:text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-950/60 border border-sky-800/50 text-sky-400 shrink-0">TERPAKAI</span>';
                statusDot = '<span class="relative flex h-2 w-2 2xl:h-2.5 2xl:w-2.5 shrink-0" title="TERPAKAI"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 2xl:h-2.5 2xl:w-2.5 bg-sky-500 shadow-[0_0_6px_rgba(14,165,233,0.6)]"></span></span>';
            } else if (pc.status === 'admin') {
                statusBadge = '<span class="text-[8px] sm:text-[9px] 2xl:text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-800/50 text-purple-400 shrink-0">ADMIN</span>';
                statusDot = '<span class="relative flex h-2 w-2 2xl:h-2.5 2xl:w-2.5 shrink-0" title="ADMIN"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 2xl:h-2.5 2xl:w-2.5 bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.6)]"></span></span>';
            } else {
                statusBadge = '<span class="text-[8px] sm:text-[9px] 2xl:text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/50 text-emerald-400 shrink-0">TERSEDIA</span>';
                statusDot = '<span class="relative flex h-2 w-2 2xl:h-2.5 2xl:w-2.5 shrink-0" title="TERSEDIA"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 2xl:h-2.5 2xl:w-2.5 bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]"></span></span>';
            }

            return `
                <div class="bg-[#0c0c0c] border ${pc.aktif ? 'border-[#242424]' : 'border-[#1a1a1a] opacity-60'} rounded p-2.5 sm:p-3 2xl:p-3.5 transition-colors hover:bg-[#121212] relative group flex flex-col justify-between min-h-[82px] sm:min-h-[88px] 2xl:min-h-[98px]">
                    <!-- Header: Kode PC + Icon + Dot Status -->
                    <div class="flex items-center justify-between gap-1.5 min-w-0">
                        <div class="flex items-center gap-1.5 min-w-0 flex-1">
                            <svg class="w-3.5 h-3.5 2xl:w-4 2xl:h-4 text-neutral-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                            <span class="font-bold text-xs sm:text-xs 2xl:text-sm text-neutral-100 truncate min-w-0" title="${Utils.escapeHtml(pc.kode)}">${Utils.escapeHtml(pc.kode)}</span>
                        </div>
                        ${statusDot}
                    </div>
                    <!-- Body: IP Address & Touch Action Buttons -->
                    <div class="text-[9px] sm:text-[10px] 2xl:text-xs text-neutral-400 font-mono my-1 flex items-center justify-between gap-1.5 min-w-0">
                        <span class="truncate min-w-0 flex-1">${Utils.escapeHtml(pc.ip_address || '-')}</span>
                        ${isKasir ? '' : `
                        <div class="flex xl:hidden items-center gap-1 remote-hide-action shrink-0">
                            <button onclick="PC.edit(${pc.id})" class="p-1 rounded bg-[#161616] text-neutral-300 hover:text-white" title="Edit PC">
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            </button>
                            <button onclick="PC.delete(${pc.id})" class="p-1 rounded bg-[#161616] text-red-400 hover:text-red-300" title="Hapus PC">
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>`}
                    </div>
                    <!-- Footer: Status Badge Penuh -->
                    <div class="flex items-center justify-start mt-auto">
                        ${statusBadge}
                    </div>
                    <!-- Desktop Hover Overlay (xl+) -->
                    ${isKasir ? '' : `
                    <div class="hidden xl:flex absolute inset-0 bg-[#0c0c0c]/90 rounded items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity remote-hide-action">
                        <button onclick="PC.edit(${pc.id})" class="w-7 h-7 2xl:w-8 2xl:h-8 rounded bg-[#171717] border border-[#262626] text-neutral-300 hover:bg-neutral-100 hover:text-black transition-colors flex items-center justify-center" title="Edit PC">
                            <svg class="w-3.5 h-3.5 2xl:w-4 2xl:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </button>
                        <button onclick="PC.delete(${pc.id})" class="w-7 h-7 2xl:w-8 2xl:h-8 rounded bg-[#171717] border border-[#262626] text-red-400 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center" title="Hapus PC">
                            <svg class="w-3.5 h-3.5 2xl:w-4 2xl:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>`}
                </div>
            `;
        }).join('');

        let paginationHtml = '';
        if (totalPages > 1) {
            paginationHtml = `
                <div class="flex items-center justify-between py-1.5 2xl:py-2.5 px-2.5 2xl:px-4 mt-2 2xl:mt-3 bg-[#050505] border border-[#1c1c1c] rounded text-xs 2xl:text-sm font-mono">
                    <button onclick="PC.changePage(${safePage - 1})" 
                        ${safePage <= 1 ? 'disabled class="px-2 2xl:px-3 py-0.5 2xl:py-1 rounded text-neutral-600 cursor-not-allowed"' : 'class="px-2 2xl:px-3 py-0.5 2xl:py-1 rounded text-neutral-300 hover:text-white hover:bg-[#161616] transition-colors"'}>
                        &larr; Prev
                    </button>
                    <span class="text-neutral-400 text-[10px] sm:text-xs 2xl:text-sm">
                        Hal <strong class="text-neutral-100">${safePage}</strong> dari <strong class="text-neutral-100">${totalPages}</strong> (${total} Unit)
                    </span>
                    <button onclick="PC.changePage(${safePage + 1})" 
                        ${safePage >= totalPages ? 'disabled class="px-2 2xl:px-3 py-0.5 2xl:py-1 rounded text-neutral-600 cursor-not-allowed"' : 'class="px-2 2xl:px-3 py-0.5 2xl:py-1 rounded text-neutral-300 hover:text-white hover:bg-[#161616] transition-colors"'}>
                        Next &rarr;
                    </button>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-2.5 2xl:gap-3">
                ${cardsHtml}
            </div>
            ${paginationHtml}
        `;
    }
};

window.PCGrid = PCGrid;
