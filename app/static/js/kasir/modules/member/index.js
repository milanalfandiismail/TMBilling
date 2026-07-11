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
        const area = document.getElementById('member-table');
        if (area) area.innerHTML = '<div class="flex justify-center py-10"><div class="w-6 h-6 border-2 border-[#2a2a2a] border-t-neutral-100 rounded-full animate-spin"></div></div>';

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

    debouncedSearch: Utils.debounce(function() {
        Member.doSearch();
    }, 500),

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
        let totalMenit = 0;
        let totalHarga = 0;
        
        document.querySelectorAll('input[type="checkbox"][id^="mem-chk-paket-"]:checked').forEach(chk => {
            const paketId = parseInt(chk.value);
            const qtyInput = document.getElementById(`mem-qty-paket-${paketId}`);
            const qty = qtyInput ? (parseInt(qtyInput.value) || 1) : 1;
            selections.push({ paket_id: paketId, qty: qty });
            
            // MemberRefill has _currentPaketList
            if (typeof MemberRefill !== 'undefined' && MemberRefill._currentPaketList) {
                const paket = MemberRefill._currentPaketList.find(p => p.id === paketId);
                if (paket) {
                    totalMenit += (paket.durasi_menit || 0) * qty;
                    totalHarga += (paket.harga || 0) * qty;
                }
            }
        });

        if (selections.length === 0) return Toast.error('Pilih minimal satu paket terlebih dahulu');

        try {
            const memberInfo = await API.member.get(memberId);
            const member = memberInfo.member || memberInfo;
            
            let sisaSekarang = member.waktu_saved || member.waktu_tersimpan || 0;
            let totalSetelah = sisaSekarang + totalMenit;

            const dataLines = [
                { label: 'Member', value: member.username || member.nama || '-' },
                { separator: true },
                { label: 'Paket Terpilih', value: '' }
            ];

            selections.forEach(sel => {
                let paketList = typeof MemberRefill !== 'undefined' ? MemberRefill._currentPaketList : (this._currentPaketList || []);
                const paket = (paketList || []).find(p => p.id === sel.paket_id);
                if (paket) {
                    dataLines.push({
                        label: `- ${paket.nama} ${sel.qty > 1 ? 'x' + sel.qty : ''}`,
                        value: Utils.formatRupiah((paket.harga || 0) * sel.qty)
                    });
                }
            });

            dataLines.push(
                { separator: true },
                { label: 'Sisa Waktu Saat Ini', value: Utils.formatDurasiFriendly(sisaSekarang) },
                { label: 'Total Tambahan', value: Utils.formatDurasiFriendly(totalMenit) },
                { label: 'Total Setelah', value: Utils.formatDurasiFriendly(totalSetelah), highlight: true },
                { separator: true },
                { label: 'Total Harga', value: Utils.formatRupiah(totalHarga), highlight: true }
            );

            ModalConfirmTambah.open({
                title: "Konfirmasi Isi Waktu Billing",
                dataLines: dataLines,
                onConfirm: async () => {
                    try {
                        await API.member.tambahWaktu(memberId, { member_id: memberId, selections: selections });
                        Toast.success('Saldo ditambahkan');
                        Modal.closeModal();
                        this.load();
                    } catch (err) {
                        Toast.error(err.message);
                    }
                }
            });
        } catch (err) {
            Toast.error('Gagal mengambil info member: ' + err.message);
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
