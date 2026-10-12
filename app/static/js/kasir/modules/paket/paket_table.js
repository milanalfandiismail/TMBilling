// app/static/js/kasir/modules/paket/paket_table.js

const PaketTable = {
    render(paketList, meta = {}) {
        const container = document.getElementById('paket-table');
        if (!container) return;

        const activeGroup = meta.activeGroup || (window.Paket && window.Paket.groups ? window.Paket.groups.find(g => Number(g.id) === Number(window.Paket.currentGrupId)) : null);
        const groupName = activeGroup ? activeGroup.nama.toUpperCase() : 'Grup';

        if (!paketList || paketList.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-10 sm:py-14 2xl:py-20 text-neutral-500 bg-[#050505] border border-dashed border-[#1c1c1c] rounded">
                    <svg class="w-8 h-8 2xl:w-10 2xl:h-10 mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
                    <p class="text-xs 2xl:text-sm font-bold uppercase tracking-wider text-neutral-400">Belum Ada Paket di ${Utils.escapeHtml(groupName)}</p>
                    <p class="text-[10px] 2xl:text-xs text-neutral-600 mt-0.5">Tambahkan paket baru untuk grup ini atau pilih grup lain</p>
                </div>`;
            return;
        }

        const page = meta.currentPage || (window.Paket ? window.Paket.currentPage : 1) || 1;
        const perPage = meta.perPage || (window.Paket ? window.Paket.perPage : 5) || 5;
        const total = paketList.length;
        const totalPages = Math.ceil(total / perPage) || 1;
        const safePage = Math.min(Math.max(1, page), totalPages);
        const startIndex = (safePage - 1) * perPage;
        const pagedList = paketList.slice(startIndex, startIndex + perPage);

        const rowsHtml = pagedList.map(p => `
            <tr class="hover:bg-[#121212] transition-colors">
                <td class="px-2.5 sm:px-3 2xl:px-4 py-1.5 sm:py-2 2xl:py-3 text-left">
                    <span class="font-bold text-neutral-200 block truncate max-w-[130px] sm:max-w-xs 2xl:max-w-none 2xl:text-sm">${Utils.escapeHtml(p.nama)}</span>
                </td>
                <td class="px-2 sm:px-3 2xl:px-4 py-1.5 sm:py-2 2xl:py-3 text-center font-mono">
                    <span class="text-neutral-300 font-bold bg-[#141414] border border-[#222] px-2 2xl:px-2.5 py-0.5 2xl:py-1 rounded text-[10px] sm:text-xs 2xl:text-sm whitespace-nowrap inline-block">
                        ${Utils.formatDurasiFriendly(p.durasi_menit)}
                    </span>
                </td>
                <td class="px-2 sm:px-3 2xl:px-4 py-1.5 sm:py-2 2xl:py-3 text-center font-mono">
                    <span class="text-neutral-100 font-bold whitespace-nowrap text-[11px] sm:text-xs 2xl:text-sm">
                        ${Utils.formatRupiah(p.harga)}
                    </span>
                </td>
                <td class="hidden sm:table-cell px-2 sm:px-3 2xl:px-4 py-1.5 sm:py-2 2xl:py-3 text-center font-mono text-neutral-400 text-xs 2xl:text-sm">
                    ${p.kadaluarsa_hari || 30} Hari
                </td>
                <td class="px-2 sm:px-3 2xl:px-4 py-1.5 sm:py-2 2xl:py-3 text-right remote-hide-action">
                    <div class="flex items-center justify-end gap-1 2xl:gap-1.5 remote-hide-action">
                        ${(window.App && App.user && App.user.role === 'kasir') ? '' : `
                        <button onclick="Paket.edit(${p.id})" class="w-6 h-6 sm:w-7 sm:h-7 2xl:w-8 2xl:h-8 rounded bg-[#171717] border border-[#262626] text-neutral-300 hover:bg-neutral-100 hover:text-black transition-colors flex items-center justify-center shrink-0" title="Edit">
                            <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5 2xl:w-4 2xl:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </button>
                        <button onclick="Paket.delete(${p.id})" class="w-6 h-6 sm:w-7 sm:h-7 2xl:w-8 2xl:h-8 rounded bg-[#171717] border border-[#262626] text-red-400 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center shrink-0" title="Hapus">
                            <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5 2xl:w-4 2xl:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>`}
                    </div>
                </td>
            </tr>
        `).join('');

        let paginationHtml = '';
        if (totalPages > 1) {
            paginationHtml = `
                <div class="flex items-center justify-between py-1.5 2xl:py-2.5 px-2.5 2xl:px-4 mt-2 2xl:mt-3 bg-[#050505] border border-[#1c1c1c] rounded text-xs 2xl:text-sm font-mono">
                    <button onclick="Paket.changePage(${safePage - 1})" 
                        ${safePage <= 1 ? 'disabled class="px-2 2xl:px-3 py-0.5 2xl:py-1 rounded text-neutral-600 cursor-not-allowed"' : 'class="px-2 2xl:px-3 py-0.5 2xl:py-1 rounded text-neutral-300 hover:text-white hover:bg-[#161616] transition-colors"'}>
                        &larr; Prev
                    </button>
                    <span class="text-neutral-400 text-[10px] sm:text-xs 2xl:text-sm">
                        Hal <strong class="text-neutral-100">${safePage}</strong> dari <strong class="text-neutral-100">${totalPages}</strong> (${total} Paket)
                    </span>
                    <button onclick="Paket.changePage(${safePage + 1})" 
                        ${safePage >= totalPages ? 'disabled class="px-2 2xl:px-3 py-0.5 2xl:py-1 rounded text-neutral-600 cursor-not-allowed"' : 'class="px-2 2xl:px-3 py-0.5 2xl:py-1 rounded text-neutral-300 hover:text-white hover:bg-[#161616] transition-colors"'}>
                        Next &rarr;
                    </button>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="overflow-x-auto w-full border border-[#1c1c1c] rounded">
                <table class="w-full text-xs 2xl:text-sm">
                    <thead>
                        <tr class="text-[10px] sm:text-xs 2xl:text-sm text-neutral-500 uppercase tracking-wider border-b border-[#1c1c1c] bg-[#0c0c0c]">
                            <th class="px-2.5 sm:px-3 2xl:px-4 py-2 2xl:py-3 text-left font-bold w-2/5 sm:w-1/3">Paket</th>
                            <th class="px-2 sm:px-3 2xl:px-4 py-2 2xl:py-3 text-center font-bold w-1/4 sm:w-1/5">Durasi</th>
                            <th class="px-2 sm:px-3 2xl:px-4 py-2 2xl:py-3 text-center font-bold w-1/4 sm:w-1/5">Harga</th>
                            <th class="hidden sm:table-cell px-2 sm:px-3 2xl:px-4 py-2 2xl:py-3 text-center font-bold w-1/6">Masa Aktif</th>
                            <th class="px-2 sm:px-3 2xl:px-4 py-2 2xl:py-3 text-right font-bold w-16 sm:w-20 2xl:w-24 remote-hide-action">Aksi</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#1a1a1a]">
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
            ${paginationHtml}
        `;
    }
};

window.PaketTable = PaketTable;
