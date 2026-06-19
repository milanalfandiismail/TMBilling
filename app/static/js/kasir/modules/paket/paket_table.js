// app/static/js/kasir/modules/paket/paket_table.js

const PaketTable = {
    render(paketList, meta = {}) {
        const container = document.getElementById('paket-table');
        if (!container) return;

        if (!paketList || paketList.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-neutral-500 bg-[#0c0c0c] border border-dashed border-[#1c1c1c] rounded">
                    <svg class="w-12 h-12 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
                    <p class="text-xs lg:text-base font-bold uppercase tracking-wider">Belum Ada Paket Billing</p>
                </div>`;
            return;
        }

        const grouped = {};
        paketList.forEach(p => {
            const g = (p.grup || 'Reguler').toUpperCase();
            if (!grouped[g]) grouped[g] = [];
            grouped[g].push(p);
        });

        let html = '';
        Object.keys(grouped).sort().forEach(grupName => {
            const list = grouped[grupName];
            html += `
                <div class="mb-8 last:mb-0">
                    <div class="flex items-center gap-3 mb-4 pb-3 border-b border-[#1c1c1c]">
                        <h4 class="text-xs lg:text-base font-bold text-neutral-300 tracking-wider uppercase">${grupName}</h4>
                        <span class="text-[10px] lg:text-base text-neutral-400 bg-[#171717] border border-[#262626] px-2.5 py-0.5 rounded font-bold">${list.length} Paket</span>
                    </div>
                    <div class="overflow-x-hidden w-full">
                        <table class="w-full text-xs lg:text-base block lg:table">
                            <thead class="hidden lg:table-header-group">
                                <tr class="text-[9px] lg:text-base text-neutral-500 uppercase tracking-wider border-b border-[#1c1c1c]">
                                    <th class="px-4 py-2 text-left w-[45%] md:w-[35%] font-bold">Nama</th>
                                    <th class="px-4 py-2 text-center w-[25%] md:w-[20%] font-bold">Durasi</th>
                                    <th class="px-4 py-2 text-center w-[20%] md:w-[15%] font-bold">Harga</th>
                                    <th class="px-4 py-2 text-center w-[15%] font-bold">Masa Aktif</th>
                                    <th class="px-4 py-2 text-right w-[10%] md:w-[15%] font-bold">Aksi</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-[#2a2a2a] lg:divide-[#1c1c1c] block lg:table-row-group">
                                ${list.map(p => `
                                    <tr class="hover:bg-[#121212] transition-colors block lg:table-row py-3 lg:py-0 border-b border-[#2a2a2a] last:border-b-0 lg:border-b-0">
                                        <td class="px-4 py-2 text-left block lg:table-cell">
                                            <span class="font-bold text-neutral-200">${Utils.escapeHtml(p.nama)}</span>
                                        </td>
                                        <td class="px-4 py-2 text-center font-mono flex lg:table-cell justify-between items-center border-t border-[#2a2a2a]/50 lg:border-t-0">
                                            <span class="text-[10px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Durasi</span>
                                            <span class="text-neutral-300 font-bold">${Utils.formatDurasiFriendly(p.durasi_menit)}</span>
                                        </td>
                                        <td class="px-4 py-2 text-center font-mono flex lg:table-cell justify-between items-center">
                                            <span class="text-[10px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Harga</span>
                                            <span class="text-neutral-100 font-bold">${Utils.formatRupiah(p.harga)}</span>
                                        </td>
                                        <td class="px-4 py-2 text-center font-mono flex lg:table-cell justify-between items-center">
                                            <span class="text-[10px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Masa Aktif</span>
                                            <span class="text-neutral-400 font-bold">${p.kadaluarsa_hari || 30} Hari</span>
                                        </td>
                                        <td class="px-4 py-2 text-right flex lg:table-cell justify-between items-center">
                                            <span class="text-[10px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Aksi</span>
                                            <div class="flex justify-end gap-1.5">
                                                ${(window.App && App.user && App.user.role === 'kasir') ? '' : `
                                                <button onclick="Paket.edit(${p.id})" class="w-8 h-8 rounded bg-[#171717] border border-[#262626] text-neutral-300 hover:bg-neutral-100 hover:text-black transition-colors" title="Edit">
                                                    <svg class="w-3.5 h-3.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                                </button>
                                                <button onclick="Paket.delete(${p.id})" class="w-8 h-8 rounded bg-[#171717] border border-[#262626] text-red-400 hover:bg-red-600 hover:text-white transition-colors" title="Hapus">
                                                    <svg class="w-3.5 h-3.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                </button>`}
                                            </div>
                                        </td>
                                    </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>`;
        });

        container.innerHTML = html;
    }
};

window.PaketTable = PaketTable;
