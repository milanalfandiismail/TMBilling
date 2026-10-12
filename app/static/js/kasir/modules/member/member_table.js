// app/static/js/kasir/modules/member/member_table.js

const MemberTable = {
    render(members, meta = {}) {
        const container = document.getElementById('member-table');
        if (!container) return;

        if (!members || members.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-16 text-neutral-500 bg-[#0c0c0c] border border-dashed border-[#1c1c1c] rounded">
                    <svg class="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                    <p class="text-xs lg:text-sm font-bold uppercase tracking-wider">Member Tidak Ditemukan</p>
                    ${this.searchQuery || this.currentGrupId ? '<button onclick="Member.clearSearch()" class="mt-3 px-3 py-1.5 bg-neutral-100 hover:bg-white text-black text-xs font-bold rounded transition-colors">Bersihkan Filter</button>' : ''}
                </div>`;
            return;
        }

        let tableHtml = `
            <div class="overflow-x-auto w-full border border-[#1c1c1c] rounded">
                <table class="w-full text-xs">
                    <thead>
                        <tr class="text-[10px] sm:text-xs text-neutral-400 uppercase border-b border-[#1c1c1c] bg-[#0c0c0c] tracking-wider select-none">
                            <th class="px-2.5 sm:px-3 py-2 text-left font-semibold">
                                Member
                            </th>
                            <th class="hidden sm:table-cell px-2.5 sm:px-3 py-2 text-center font-semibold">
                                Grup
                            </th>
                            <th class="px-2.5 sm:px-3 py-2 text-center font-semibold">
                                Waktu
                            </th>
                            <th class="hidden md:table-cell px-2.5 sm:px-3 py-2 text-center font-semibold">
                                Berlaku Sampai
                            </th>
                            <th class="hidden sm:table-cell px-2.5 sm:px-3 py-2 text-center font-semibold">
                                Status
                            </th>
                            <th class="px-2.5 sm:px-3 py-2 text-right font-semibold">
                                Aksi
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#1c1c1c]">
                        ${members.map(m => {
                            const grupNama = (typeof m.grup === 'object' ? m.grup.nama : m.grup) || 'reguler';
                            return `
                                <tr class="hover:bg-[#141414] transition-colors">
                                    <!-- Col 1: Member (and Grup badge on < sm) -->
                                    <td class="px-2.5 sm:px-3 py-2 text-left">
                                        <div class="flex items-center gap-2">
                                            <div class="w-7 h-7 sm:w-8 sm:h-8 rounded bg-[#171717] border border-[#262626] flex items-center justify-center text-neutral-200 font-bold text-xs shrink-0">
                                                ${(m.username || '?').charAt(0).toUpperCase()}
                                            </div>
                                            <div class="min-w-0">
                                                <div class="font-bold text-neutral-200 text-xs sm:text-sm truncate max-w-[85px] sm:max-w-[140px] md:max-w-none" title="${m.username}">
                                                    ${m.username}
                                                </div>
                                                <div class="flex items-center gap-1.5 mt-0.5">
                                                    <span class="sm:hidden px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase shrink-0" style="background-color: ${m.grup_warna}15; color: ${m.grup_warna}; border: 1px solid ${m.grup_warna}30;">
                                                        ${grupNama}
                                                    </span>
                                                    <span class="hidden sm:inline text-[10px] text-neutral-500 truncate max-w-[120px] xl:max-w-[160px]">${m.nama_lengkap || '-'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    <!-- Col 2: Grup (hidden on < sm) -->
                                    <td class="hidden sm:table-cell px-2.5 sm:px-3 py-2 text-center">
                                        <span class="px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold uppercase inline-block" style="background-color: ${m.grup_warna}15; color: ${m.grup_warna}; border: 1px solid ${m.grup_warna}25;">
                                            ${grupNama}
                                        </span>
                                    </td>

                                    <!-- Col 3: Waktu (and status dot on < sm) -->
                                    <td class="px-2.5 sm:px-3 py-2 text-center font-mono">
                                        <div class="inline-flex flex-col items-center">
                                            <span class="text-neutral-200 font-bold text-xs sm:text-sm">${Utils.formatMenit(m.waktu_tersimpan)}</span>
                                            <span class="sm:hidden text-[9px] font-sans flex items-center gap-1 mt-0.5 ${m.aktif ? 'text-emerald-400' : 'text-neutral-500'}">
                                                <span class="w-1.5 h-1.5 rounded-full ${m.aktif ? 'bg-emerald-400' : 'bg-neutral-600'}"></span>
                                                ${m.aktif ? 'Aktif' : 'Kunci'}
                                            </span>
                                        </div>
                                    </td>

                                    <!-- Col 4: Berlaku Sampai (hidden on < md) -->
                                    <td class="hidden md:table-cell px-2.5 sm:px-3 py-2 text-center font-mono">
                                        <span class="text-neutral-400 text-xs">${m.kadaluarsa_pada_display || '-'}</span>
                                    </td>

                                    <!-- Col 5: Status (hidden on < sm) -->
                                    <td class="hidden sm:table-cell px-2.5 sm:px-3 py-2 text-center">
                                        ${m.aktif
                                            ? '<span class="inline-flex items-center gap-1 text-[10px] sm:text-xs text-neutral-200 bg-[#171717] border border-[#262626] px-2 py-0.5 rounded font-bold"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>Aktif</span>'
                                            : '<span class="inline-flex items-center gap-1 text-[10px] sm:text-xs text-neutral-500 bg-[#0c0c0c] border border-[#1c1c1c] px-2 py-0.5 rounded font-bold"><span class="w-1.5 h-1.5 rounded-full bg-neutral-600"></span>Terkunci</span>'}
                                    </td>

                                    <!-- Col 6: Aksi -->
                                    <td class="px-2.5 sm:px-3 py-2 text-right">
                                        <!-- Mobile View (< sm): Fast '+' and '⋮' -->
                                        <div class="flex sm:hidden items-center justify-end gap-1">
                                            <button onclick="Member.tambahWaktu(${m.id})" class="remote-hide-action p-1.5 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/60 transition-colors" title="Tambah Waktu">
                                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                                            </button>
                                            <button onclick="Member.showMobileActions(${m.id})" class="p-1.5 rounded bg-[#171717] border border-[#262626] text-neutral-300 hover:bg-neutral-100 hover:text-black transition-colors" title="Opsi Menu">
                                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                                            </button>
                                        </div>

                                        <!-- Tablet/Desktop View (>= sm): Full Buttons -->
                                        <div class="hidden sm:flex items-center justify-end gap-1 sm:gap-1.5">
                                            <button onclick="Member.showDetail(${m.id})" class="w-7 h-7 sm:w-8 sm:h-8 rounded bg-[#171717] border border-[#262626] text-neutral-300 hover:bg-neutral-100 hover:text-black transition-colors flex items-center justify-center" title="Detail">
                                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                            </button>
                                            <button onclick="Member.tambahWaktu(${m.id})" class="remote-hide-action w-7 h-7 sm:w-8 sm:h-8 rounded bg-[#171717] border border-[#262626] text-neutral-300 hover:bg-neutral-100 hover:text-black transition-colors flex items-center justify-center" title="Tambah Waktu">
                                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                                            </button>
                                            <button onclick="Member.edit(${m.id})" class="remote-hide-action w-7 h-7 sm:w-8 sm:h-8 rounded bg-[#171717] border border-[#262626] text-neutral-300 hover:bg-neutral-100 hover:text-black transition-colors flex items-center justify-center" title="Edit">
                                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                            </button>
                                            ${(window.App && App.user && App.user.role === 'kasir') ? '' : `
                                            <button onclick="Member.delete(${m.id})" class="remote-hide-action w-7 h-7 sm:w-8 sm:h-8 rounded bg-[#171717] border border-[#262626] text-red-400 hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center" title="Hapus">
                                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                            </button>`}
                                        </div>
                                    </td>
                                </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            <!-- Streamlined Pagination Footer -->
            ${(() => {
                const startItem = this.totalRecords === 0 ? 0 : (this.currentPage - 1) * this.perPage + 1;
                const endItem = Math.min(this.currentPage * this.perPage, this.totalRecords);
                return `
                <div class="flex flex-col sm:flex-row items-center justify-between gap-2 mt-2.5 px-1 text-xs font-mono">
                    <div class="text-neutral-400 text-[11px] sm:text-xs">
                        Menampilkan <strong class="text-neutral-200">${startItem} - ${endItem}</strong> dari <strong class="text-neutral-200">${this.totalRecords}</strong> Member
                    </div>
                    <div class="flex items-center gap-1.5">
                        <button onclick="Member.gotoPage(${this.currentPage - 1})"
                            class="px-2.5 sm:px-3 py-1 bg-[#171717] border border-[#262626] hover:bg-[#222] text-neutral-300 text-xs font-bold rounded transition-colors ${!meta.has_prev ? 'opacity-30 cursor-not-allowed' : ''}" ${!meta.has_prev ? 'disabled' : ''}>
                            &larr; Prev
                        </button>
                        <span class="px-3 py-1 bg-[#0c0c0c] border border-[#1c1c1c] rounded text-neutral-200 font-mono font-bold text-xs">
                            ${this.currentPage} / ${this.totalPages}
                        </span>
                        <button onclick="Member.gotoPage(${this.currentPage + 1})"
                            class="px-2.5 sm:px-3 py-1 bg-[#171717] border border-[#262626] hover:bg-[#222] text-neutral-300 text-xs font-bold rounded transition-colors ${!meta.has_next ? 'opacity-30 cursor-not-allowed' : ''}" ${!meta.has_next ? 'disabled' : ''}>
                            Next &rarr;
                        </button>
                    </div>
                </div>
                `;
            })()}
        `;

        container.innerHTML = tableHtml;
    }
};

window.MemberTable = MemberTable;
