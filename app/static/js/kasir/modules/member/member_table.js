// app/static/js/kasir/modules/member/member_table.js

const MemberTable = {
    render(members, meta = {}) {
        const container = document.getElementById('member-table');
        if (!container) return;

        if (!members || members.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-neutral-500 bg-[#0c0c0c] border border-dashed border-[#1c1c1c] rounded">
                    <svg class="w-12 h-12 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                    <p class="text-xs font-bold uppercase tracking-wider">Member Tidak Ditemukan</p>
                    ${this.searchQuery ? '<button onclick="Member.clearSearch()" class="mt-4 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-black text-xs font-bold rounded transition-colors">Bersihkan Filter</button>' : ''}
                </div>`;
            return;
        }

        let tableHtml = `
            <div class="overflow-x-hidden w-full">
                <table class="w-full text-xs block lg:table">
                    <thead class="hidden lg:table-header-group">
                        <tr class="text-[9px] text-neutral-500 uppercase border-b border-[#1c1c1c] tracking-wider">
                            <th class="px-4 py-2.5 text-left">Member</th>
                            <th class="px-4 py-2.5 text-center">Grup</th>
                            <th class="px-4 py-2.5 text-center">Sisa Waktu</th>
                            <th class="px-4 py-2.5 text-center">Berlaku Sampai</th>
                            <th class="px-4 py-2.5 text-center">Status</th>
                            <th class="px-4 py-2.5 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#2a2a2a] lg:divide-[#1c1c1c] block lg:table-row-group">
                        ${members.map(m => {
                            const grupNama = (typeof m.grup === 'object' ? m.grup.nama : m.grup) || 'reguler';
                            return `
                                <tr class="hover:bg-[#121212] transition-colors block lg:table-row py-3 lg:py-0 border-b border-[#2a2a2a] last:border-b-0 lg:border-b-0">
                                    <td class="px-4 py-2 text-left block lg:table-cell">
                                        <div class="flex items-center gap-3">
                                            <div class="w-8 h-8 rounded bg-[#171717] border border-[#262626] flex items-center justify-center text-neutral-200 font-bold text-xs">${m.username.charAt(0).toUpperCase()}</div>
                                            <div>
                                                <div class="font-bold text-neutral-200 text-xs">
                                                    ${m.username}
                                                </div>
                                                <div class="text-[10px] text-neutral-500">${m.nama_lengkap || '-'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-4 py-2 text-center flex lg:table-cell justify-between items-center border-t border-[#1c1c1c]/30 lg:border-t-0">
                                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Grup</span>
                                        <span class="px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase style-grup-badge" style="background-color: ${m.grup_warna}15; color: ${m.grup_warna}; border: 1px solid ${m.grup_warna}25;">${grupNama}</span>
                                    </td>
                                    <td class="px-4 py-2 text-center font-mono flex lg:table-cell justify-between items-center">
                                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Sisa Waktu</span>
                                        <span class="text-neutral-300 font-bold">${Utils.formatMenit(m.waktu_tersimpan)}</span>
                                    </td>
                                    <td class="px-4 py-2 text-center font-mono flex lg:table-cell justify-between items-center">
                                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Berlaku Sampai</span>
                                        <span class="text-neutral-400 font-bold">${m.kadaluarsa_pada ? Utils.formatTanggal(m.kadaluarsa_pada) : '-'}</span>
                                    </td>
                                    <td class="px-4 py-2 text-center flex lg:table-cell justify-between items-center">
                                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Status</span>
                                        ${m.aktif
                                            ? '<span class="inline-flex items-center gap-1 text-[9px] text-neutral-200 bg-[#171717] border border-[#262626] px-2 py-0.5 rounded font-bold"><span class="w-1 h-1 rounded-full bg-neutral-300 animate-pulse"></span>Aktif</span>'
                                            : '<span class="inline-flex items-center gap-1 text-[9px] text-neutral-500 bg-[#0c0c0c] border border-[#1c1c1c] px-2 py-0.5 rounded font-bold"><span class="w-1 h-1 rounded-full bg-neutral-600"></span>Terkunci</span>'}
                                    </td>
                                    <td class="px-4 py-2 text-right flex lg:table-cell justify-between items-center">
                                        <span class="text-[10px] text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Aksi</span>
                                        <div class="flex justify-end gap-1.5">
                                            <button onclick="Member.showDetail(${m.id})" class="w-8 h-8 rounded bg-[#171717] border border-[#262626] text-neutral-300 hover:bg-neutral-100 hover:text-black transition-colors" title="Detail">
                                                <svg class="w-3.5 h-3.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                            </button>
                                            <button onclick="Member.tambahWaktu(${m.id})" class="w-8 h-8 rounded bg-[#171717] border border-[#262626] text-neutral-300 hover:bg-neutral-100 hover:text-black transition-colors" title="Tambah Waktu">
                                                <svg class="w-3.5 h-3.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                                            </button>
                                            <button onclick="Member.edit(${m.id})" class="w-8 h-8 rounded bg-[#171717] border border-[#262626] text-neutral-300 hover:bg-neutral-100 hover:text-black transition-colors" title="Edit">
                                                <svg class="w-3.5 h-3.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                            </button>
                                            <button onclick="Member.delete(${m.id})" class="w-8 h-8 rounded bg-[#171717] border border-[#262626] text-red-400 hover:bg-red-600 hover:text-white transition-colors" title="Hapus">
                                                <svg class="w-3.5 h-3.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div class="flex items-center justify-between mt-4 px-2">
                <div class="text-xs text-neutral-500">Total: <span class="text-neutral-200 font-bold">${this.totalRecords}</span> member</div>
                <div class="flex items-center gap-2">
                    <button onclick="Member.gotoPage(${this.currentPage - 1})" class="px-3 py-1.5 bg-[#171717] border border-[#262626] hover:bg-[#222] text-neutral-400 text-xs font-bold rounded transition-colors ${!meta.has_prev ? 'opacity-30 cursor-not-allowed' : ''}" ${!meta.has_prev ? 'disabled' : ''}>&larr;</button>
                    <span class="px-4 py-1.5 bg-[#0c0c0c] border border-[#1c1c1c] rounded text-xs text-neutral-200 font-mono font-bold">${this.currentPage} / ${this.totalPages}</span>
                    <button onclick="Member.gotoPage(${this.currentPage + 1})" class="px-3 py-1.5 bg-[#171717] border border-[#262626] hover:bg-[#222] text-neutral-400 text-xs font-bold rounded transition-colors ${!meta.has_next ? 'opacity-30 cursor-not-allowed' : ''}" ${!meta.has_next ? 'disabled' : ''}>&rarr;</button>
                </div>
            </div>
        `;

        container.innerHTML = tableHtml;
    }
};

window.MemberTable = MemberTable;
