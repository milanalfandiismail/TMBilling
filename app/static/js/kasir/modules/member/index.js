// app/static/js/kasir/modules/member/index.js

const Member = {
    allMembers: [],
    currentPage: 1,
    searchQuery: '',
    currentGrupId: '',
    totalPages: 1,
    totalRecords: 0,
    _currentPaketList: [],

    async load() {
        try {
            const [memberData, grupData] = await Promise.all([
                API.member.list({
                    q: this.searchQuery,
                    page: this.currentPage,
                    grup_id: this.currentGrupId
                }),
                API.grup.list()
            ]);

            this.allMembers = memberData.members || [];
            this.totalPages = memberData.pages || 1;
            this.totalRecords = memberData.total || 0;
            this.currentPage = memberData.current_page || 1;

            const groups = grupData.grup || grupData || [];

            const filterSelect = document.getElementById('member-grup-filter-select');
            if (filterSelect && filterSelect.options.length <= 1) {
                filterSelect.innerHTML = '<option value="">Semua Grup</option>' +
                    groups.map(g => `<option value="${g.id}" ${this.currentGrupId == g.id ? 'selected' : ''}>${g.nama.toUpperCase()}</option>`).join('');
            }

            const addGrupSelect = document.getElementById('inp-mem-grup');
            if (addGrupSelect) {
                addGrupSelect.innerHTML = groups.map(g => `<option value="${g.nama}">${g.nama.toUpperCase()}</option>`).join('');
            }

            this.render(this.allMembers, memberData);
        } catch (err) {
            Toast.error('Gagal memuat member');
        }
    },

    doSearch() {
        const searchInput = document.getElementById('member-search-input');
        const filterSelect = document.getElementById('member-grup-filter-select');
        this.searchQuery = searchInput ? searchInput.value.trim() : '';
        this.currentGrupId = filterSelect ? filterSelect.value : '';
        this.currentPage = 1;
        this.load();
    },

    clearSearch() {
        const searchInput = document.getElementById('member-search-input');
        const filterSelect = document.getElementById('member-grup-filter-select');
        if (searchInput) searchInput.value = '';
        if (filterSelect) filterSelect.value = '';
        this.searchQuery = '';
        this.currentGrupId = '';
        this.currentPage = 1;
        this.load();
    },

    gotoPage(p) {
        if (p < 1 || p > this.totalPages) return;
        this.currentPage = p;
        this.load();
    },

    async add() {
        const get = (modalId, legacyId) => {
            const m = document.getElementById(modalId);
            if (m) return m;
            return document.getElementById(legacyId);
        };
        const data = {
            username: (get('modal-mem-user', 'inp-mem-user') || {}).value?.trim() || '',
            password: (get('modal-mem-pass', 'inp-mem-pass') || {}).value || '',
            nama_lengkap: (get('modal-mem-nama', 'inp-mem-nama') || {}).value?.trim() || '',
            email: (get('modal-mem-email', 'inp-mem-email') || {}).value?.trim() || '',
            no_hp: (get('modal-mem-nohp', 'inp-mem-nohp') || {}).value?.trim() || '',
            grup: (get('modal-mem-grup', 'inp-mem-grup') || {}).value || ''
        };
        if (!data.username || !data.password) return Toast.error('Username dan password wajib diisi');
        try {
            await API.member.create(data);
            Toast.success(`Member ${data.username} berhasil didaftarkan`);
            Modal.closeModal();
            this.load();
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async edit(id) {
        try {
            const [memberResponse, grupData] = await Promise.all([
                API.member.get(id),
                API.grup.list()
            ]);
            const member = memberResponse.member || memberResponse.data || memberResponse;
            if (!member || member.error) return Toast.error('Member tidak ditemukan');
            const groups = grupData.grup || grupData.data || grupData || [];
            this.showEditModal(member, groups);
        } catch (err) {
            Toast.error('Gagal mengambil data untuk edit');
        }
    },

    async doEdit(id) {
        const data = {
            nama_lengkap: document.getElementById('edit-member-nama').value.trim(),
            email: document.getElementById('edit-member-email').value.trim(),
            grup: document.getElementById('edit-member-grup').value,
        };
        const password = document.getElementById('edit-member-password').value;
        if (password) data.password = password;
        try {
            await API.member.update(id, data);
            Toast.success('Berhasil diperbarui');
            Modal.closeModal();
            this.load();
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async delete(id) {
        const message = `<div class="text-center"><p class="text-xs lg:text-base text-neutral-400 font-bold">Hapus member ini? Semua data dan sisa waktu akan <span class="text-red-400">dihapus permanen</span>.</p></div>`;
        Modal.confirm(message, async () => {
            try {
                await API.member.delete(id);
                Toast.success('Member berhasil dihapus');
                this.load();
            } catch (err) {
                Toast.error(err.message);
            }
        });
    },

    async doAddWaktu(memberId) {
        const selections = [];
        document.querySelectorAll('input[type="checkbox"][id^="chk-paket-"]:checked').forEach(chk => {
            const paketId = parseInt(chk.value);
            const qtyInput = document.getElementById(`qty-paket-${paketId}`);
            const qty = qtyInput ? (parseInt(qtyInput.value) || 1) : 1;
            selections.push({ paket_id: paketId, qty: qty });
        });

        if (selections.length === 0) return Toast.error('Pilih minimal satu paket terlebih dahulu');

        // Hitung total
        let totalMenit = 0;
        let totalHarga = 0;
        selections.forEach(s => {
            const paket = MemberRefill._currentPaketList?.find(p => p.id === s.paket_id);
            if (paket) {
                totalMenit += (paket.durasi_menit || 0) * s.qty;
                totalHarga += (paket.harga || 0) * s.qty;
            }
        });

        // Confirm modal
        const confirmHtml = `
            <div class="bg-[#0c0c0c] border border-neutral-800 rounded-xl p-6 max-w-sm w-full shadow-xl">
                <div class="flex items-center justify-between pb-4 border-b border-neutral-800">
                    <h3 class="text-sm font-semibold text-neutral-100">Konfirmasi Tambah Waktu</h3>
                    <button onclick="Modal.closeModal()" class="w-7 h-7 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-neutral-100 transition-colors flex items-center justify-center">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                <div class="py-5 space-y-3">
                    <div class="bg-[#080808] border border-neutral-800 rounded-lg p-4 flex items-center justify-between">
                        <span class="text-xs text-neutral-400 font-medium">Total Waktu</span>
                        <span class="text-sm font-bold text-neutral-100 font-mono">${Utils.formatDurasiFriendly(totalMenit)}</span>
                    </div>
                    <div class="bg-[#080808] border border-neutral-800 rounded-lg p-4 flex items-center justify-between">
                        <span class="text-xs text-neutral-400 font-medium">Total Biaya</span>
                        <span class="text-sm font-bold text-emerald-400 font-mono">${Utils.formatRupiah(totalHarga)}</span>
                    </div>
                    <div class="bg-emerald-500/5 border border-emerald-800/20 rounded-lg p-3 text-xs text-neutral-400">
                        Saldo akan langsung ditambahkan ke member setelah konfirmasi.
                    </div>
                </div>
                <div class="flex gap-2 justify-end pt-4 border-t border-neutral-800">
                    <button onclick="Modal.closeModal(); MemberRefill.tambahWaktu(${memberId})" class="px-4 py-2 text-sm font-medium text-neutral-400 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 rounded-lg transition-colors">Batal</button>
                    <button onclick="Member._executeAddWaktu(${memberId})" class="px-4 py-2 text-sm font-medium text-black bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors">Tambah Waktu</button>
                </div>
            </div>`;
        Modal.show(confirmHtml);
    },

    async _executeAddWaktu(memberId) {
        const selections = [];
        document.querySelectorAll('input[type="checkbox"][id^="chk-paket-"]:checked').forEach(chk => {
            const paketId = parseInt(chk.value);
            const qtyInput = document.getElementById(`qty-paket-${paketId}`);
            const qty = qtyInput ? (parseInt(qtyInput.value) || 1) : 1;
            selections.push({ paket_id: paketId, qty: qty });
        });

        try {
            await API.member.tambahWaktu(memberId, { member_id: memberId, selections: selections });
            Toast.success('Saldo ditambahkan');
            Modal.closeModal();
            this.load();
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async refund(memberId, transaksiId) {
        Modal.confirm('<div class="text-center"><p class="text-xs lg:text-base text-neutral-400 font-bold uppercase tracking-wider">Refund Paket Billing?</p><p class="text-[10px] lg:text-base text-neutral-500 mt-1">Saldo waktu member akan dikurangi sesuai durasi paket.</p></div>', async () => {
            try {
                const res = await API.member.refundPaket(memberId, transaksiId);
                Toast.success(res.message || 'Refund berhasil');
                Modal.closeModal();
                this.load();
            } catch (err) {
                Toast.error(err.message || 'Gagal refund');
            }
        });
    },

    closeModalSafe() {
        if (typeof Modal !== 'undefined') Modal.closeModal();
        document.body.style.overflow = '';
    },

    clearForm() {
        ['inp-mem-user', 'inp-mem-pass', 'inp-mem-nama', 'inp-mem-email', 'inp-mem-nohp'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    }
};

Object.assign(Member, MemberTable);
Object.assign(Member, MemberModal);
Object.assign(Member, MemberRefill);
window.Member = Member;
