/**
 * Dashboard - Member Search & Quick Billing Sub-module
 * Menangani modal pencarian cepat member, filter grup, dan delegasi topup billing.
 */
window.Dashboard = window.Dashboard || {};
Object.assign(window.Dashboard, {
    async tambahWaktuMember() {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        let groups = [];
        try {
            const [memberData, grupData] = await Promise.all([
                API.member.list({ per_page: 9999 }),
                API.grup.list()
            ]);
            this._searchMembers = memberData.members || [];
            groups = grupData.grup || grupData || [];
        } catch (_) {
            this._searchMembers = [];
        }

        if (this._searchMembers.length === 0) {
            return Toast.error('Tidak ada member terdaftar');
        }

        this._searchFiltered = [...this._searchMembers];
        this._searchPage = 1;
        this._searchPerPage = 8;
        this._selectedGrup = '';

        const grupOptions = groups.map(g => `<option value="${g.nama.toLowerCase()}">${g.nama.toUpperCase()}</option>`).join('');

        const html = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-2xl p-4 sm:p-6 md:p-7 max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl w-[95vw] sm:w-[calc(100%-2rem)] md:w-full h-[88vh] max-h-[760px] flex flex-col my-auto shadow-2xl relative overflow-hidden">
                <!-- Header (Fixed) -->
                <div class="flex items-center justify-between mb-4 pb-3.5 border-b border-[#2a2a2a] shrink-0">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center shrink-0 shadow-inner">
                            <svg class="w-5 h-5 text-neutral-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                        </div>
                        <div>
                            <h3 class="text-sm sm:text-base md:text-lg font-bold text-neutral-100 uppercase tracking-wider font-mono">Tambah Waktu Member</h3>
                            <p class="text-[11px] sm:text-xs text-neutral-400 mt-0.5">Cari member, lalu pilih paket billing</p>
                        </div>
                    </div>
                    <button onclick="Modal.closeModal()" class="w-9 h-9 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 hover:text-neutral-100 hover:bg-[#222] transition-colors flex items-center justify-center text-xl leading-none">&times;</button>
                </div>

                <!-- Search & Filters (Fixed) -->
                <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 mb-3.5 shrink-0">
                    <div class="sm:col-span-8">
                        <label class="text-[11px] sm:text-xs text-neutral-400 font-bold uppercase tracking-wider mb-1.5 block">Cari Member</label>
                        <div class="relative">
                            <input type="text" id="member-search-input-dash" placeholder="Ketik nama atau username..."
                                class="w-full pl-9 pr-4 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-xs sm:text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 font-bold transition-all"
                                oninput="Dashboard._handleMemberSearchInput()">
                            <svg class="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        </div>
                    </div>
                    <div class="sm:col-span-4">
                        <label class="text-[11px] sm:text-xs text-neutral-400 font-bold uppercase tracking-wider mb-1.5 block">Filter Zona / Grup</label>
                        <select id="member-search-grup-dash" onchange="Dashboard._handleGrupFilterChange()"
                            class="w-full px-3.5 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-xs sm:text-sm text-neutral-200 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 font-bold transition-all">
                            <option value="">Semua Grup</option>
                            ${grupOptions}
                        </select>
                    </div>
                </div>

                <!-- Member List Section (Scrollable) -->
                <div class="flex-1 min-h-0 flex flex-col">
                    <div class="flex items-center justify-between mb-2 shrink-0">
                        <label class="text-[11px] sm:text-xs md:text-sm text-neutral-400 font-bold uppercase tracking-wider font-mono">Pilih Member</label>
                        <span id="member-search-count-badge" class="text-[10px] sm:text-xs text-neutral-500 font-mono font-medium">${this._searchPerPage} Member per Halaman</span>
                    </div>
                    <div id="member-search-results" class="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1.5 scrollbar-thin">
                        <div class="flex justify-center py-12">
                            <div class="w-6 h-6 border-2 border-[#2a2a2a] border-t-neutral-100 rounded-full animate-spin"></div>
                        </div>
                    </div>
                </div>

                <!-- Footer: Pagination & Batal (Fixed at bottom) -->
                <div class="shrink-0 mt-3 pt-3 border-t border-[#2a2a2a]">
                    <div id="member-search-pagination" class="flex items-center justify-between min-h-[34px]">
                    </div>
                    <div class="flex justify-end mt-2.5">
                        <button onclick="Modal.closeModal()" class="px-5 py-2 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 hover:text-neutral-200 text-xs sm:text-sm font-bold rounded-xl transition-colors">Batal</button>
                    </div>
                </div>
            </div>`;

        Modal.show(html);
        this._renderMemberSearch();
    },

    _handleGrupFilterChange() {
        const select = document.getElementById('member-search-grup-dash');
        this._selectedGrup = select ? select.value : '';
        this._applyFilters();
    },

    _applyFilters() {
        let filtered = [...this._searchMembers];

        if (this._selectedGrup) {
            filtered = filtered.filter(m => {
                const grupName = (typeof m.grup === 'object' ? (m.grup.nama || '').toLowerCase() : (m.grup || '').toLowerCase());
                const selected = (this._selectedGrup || '').toLowerCase();
                return grupName === selected;
            });
        }

        const query = document.getElementById('member-search-input-dash')?.value?.toLowerCase().trim() || '';
        if (query) {
            filtered = filtered.filter(m => {
                const username = (m.username || '').toLowerCase();
                const nama = (m.nama_lengkap || '').toLowerCase();
                return username.includes(query) || nama.includes(query);
            });
        }

        this._searchFiltered = filtered;
        this._searchPage = 1;
        this._renderMemberSearch();
    },

    _handleMemberSearchInput() {
        clearTimeout(this._searchDebounceTimer);
        this._searchDebounceTimer = setTimeout(() => {
            this._applyFilters();
        }, 500);
    },

    _renderMemberSearch() {
        const container = document.getElementById('member-search-results');
        if (!container) return;

        const total = this._searchFiltered.length;
        const totalPages = Math.max(1, Math.ceil(total / this._searchPerPage));
        const start = (this._searchPage - 1) * this._searchPerPage;
        const pageData = this._searchFiltered.slice(start, start + this._searchPerPage);

        const countBadge = document.getElementById('member-search-count-badge');
        if (countBadge) {
            countBadge.innerText = `${total} Member Ditemukan (${this._searchPerPage} per Halaman)`;
        }

        if (total === 0) {
            container.innerHTML = '<div class="flex justify-center py-12 text-neutral-500 text-xs sm:text-sm font-bold uppercase tracking-wider">Member tidak ditemukan</div>';
            this._renderMemberPagination(1, 0);
            return;
        }

        container.innerHTML = pageData.map(m => {
            const sisa = Utils.formatDurasiFriendly(m.waktu_saved || m.waktu_tersimpan);
            const grupNama = (typeof m.grup === 'object' ? (m.grup.nama || 'Reguler') : (m.grup || 'Reguler'));
            const grupWarna = m.grup_warna || '#737373';
            return `
                <div onclick="Dashboard._pilihMember(${m.id})"
                    class="flex items-center justify-between p-3.5 sm:p-4 bg-[#141414] hover:bg-[#181818] border border-[#2a2a2a] hover:border-neutral-500 rounded-xl cursor-pointer transition-all gap-3 sm:gap-4 select-none group">
                    <div class="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
                        <div class="w-10 h-10 rounded-xl bg-[#0a0a0a] border border-[#2a2a2a] group-hover:border-neutral-500 flex items-center justify-center text-neutral-200 font-bold text-xs sm:text-sm font-mono shrink-0 shadow-inner transition-colors">
                            ${(m.username || '?').charAt(0).toUpperCase()}
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                                <span class="font-bold text-xs sm:text-sm md:text-base text-neutral-100 font-mono truncate">${m.username}</span>
                                <span class="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold uppercase style-grup-badge shrink-0" style="border: 1px solid ${grupWarna}30; color: ${grupWarna}; background-color: ${grupWarna}15;">${grupNama}</span>
                            </div>
                            <div class="text-[11px] sm:text-xs text-neutral-400 truncate mt-0.5">${m.nama_lengkap || '-'}</div>
                        </div>
                    </div>
                    <div class="text-right shrink-0 ml-2">
                        <div class="text-[10px] sm:text-xs text-neutral-500 font-mono uppercase font-bold tracking-wider">Sisa Waktu</div>
                        <div class="text-xs sm:text-sm md:text-base font-bold text-emerald-400 font-mono mt-0.5">${sisa}</div>
                    </div>
                </div>
            `;
        }).join('');

        this._renderMemberPagination(this._searchPage, totalPages);
    },

    _renderMemberPagination(currentPage, totalPages) {
        const container = document.getElementById('member-search-pagination');
        if (!container) return;

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <span class="text-[11px] sm:text-xs text-neutral-500 font-mono">Halaman ${currentPage} dari ${totalPages}</span>
            <div class="flex gap-2">
                <button onclick="Dashboard._searchPage = ${Math.max(1, currentPage - 1)}; Dashboard._renderMemberSearch()"
                    class="px-3.5 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-300 text-xs font-bold rounded-lg transition-colors ${currentPage <= 1 ? 'opacity-30 cursor-not-allowed' : ''}"
                    ${currentPage <= 1 ? 'disabled' : ''}>
                    &larr; Sebelum
                </button>
                <button onclick="Dashboard._searchPage = ${Math.min(totalPages, currentPage + 1)}; Dashboard._renderMemberSearch()"
                    class="px-3.5 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-300 text-xs font-bold rounded-lg transition-colors ${currentPage >= totalPages ? 'opacity-30 cursor-not-allowed' : ''}"
                    ${currentPage >= totalPages ? 'disabled' : ''}>
                    Selanjutnya &rarr;
                </button>
            </div>`;
    },

    _pilihMember(memberId) {
        Modal.closeModal();
        if (typeof MemberRefill !== 'undefined' && MemberRefill.tambahWaktu) {
            MemberRefill.tambahWaktu(memberId);
        } else {
            Toast.error('Gagal: modul refill belum siap');
        }
    },


});
