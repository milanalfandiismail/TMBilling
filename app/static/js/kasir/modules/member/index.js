// app/static/js/kasir/modules/member/index.js

const Member = {
    allMembers: [],
    currentPage: 1,
    perPage: 5,
    searchQuery: '',
    currentGrupId: '',
    totalPages: 1,
    totalRecords: 0,
    _currentPaketList: [],

    _lastFingerprint: null,
    _hasResizeListener: false,
    _allGroups: [],

    getAdaptivePerPage() {
        const width = window.innerWidth;
        if (width >= 1536) return 10; // 2xl (10 baris, fit to screen)
        if (width >= 1280) return 8;  // xl (8 baris)
        if (width >= 768)  return 7;  // md, lg
        return 5;                     // < md
    },

    _initResizeListener() {
        if (this._hasResizeListener) return;
        this._hasResizeListener = true;
        window.addEventListener('resize', Utils.debounce(() => {
            if (typeof App !== 'undefined' && App.currentTab !== 'member') return;
            const newPerPage = this.getAdaptivePerPage();
            if (newPerPage !== this.perPage) {
                this.perPage = newPerPage;
                this.currentPage = 1;
                this.load();
            }
        }, 200));
    },

    resetFilters() {
        this.currentPage = 1;
        this.perPage = this.getAdaptivePerPage();
        this.searchQuery = '';
        this.currentGrupId = '';
        const searchInput = document.getElementById('member-search-input');
        if (searchInput) searchInput.value = '';
        const clearBtn = document.getElementById('member-search-clear');
        if (clearBtn) clearBtn.classList.add('hidden');
    },

    refreshLive() {
        if (typeof App !== 'undefined' && App.currentTab !== 'member') return;
        const modalTambah = document.getElementById('modal-tambah-member');
        const modalPaket = document.getElementById('modal-tambah-paket-member');
        const isAppModalOpen = document.getElementById('app-modal') && !document.getElementById('app-modal').classList.contains('hidden');
        if ((modalTambah && !modalTambah.classList.contains('hidden')) ||
            (modalPaket && !modalPaket.classList.contains('hidden')) ||
            isAppModalOpen) {
            return;
        }
        return this.load(true);
    },

    async load(isSilent = false) {
        this.perPage = this.getAdaptivePerPage();
        this._initResizeListener();

        const area = document.getElementById('member-table');
        if (area && !isSilent && (!this.allMembers || this.allMembers.length === 0) && typeof Skeleton !== 'undefined') {
            area.innerHTML = Skeleton.memberTable(this.getAdaptivePerPage());
        }

        try {
            const [memberData, grupData] = await Promise.all([
                API.member.list({
                    q: this.searchQuery,
                    page: this.currentPage,
                    per_page: this.perPage,
                    grup_id: this.currentGrupId
                }),
                API.grup.list()
            ]);

            const fetchedMembers = memberData.members || [];
            const newFingerprint = JSON.stringify({
                q: this.searchQuery,
                page: this.currentPage,
                per_page: this.perPage,
                grup: this.currentGrupId,
                members: fetchedMembers.map(m => ({ id: m.id, saldo: m.saldo, sisa_waktu: m.sisa_waktu, status: m.status }))
            });

            if (isSilent && this._lastFingerprint === newFingerprint) {
                return; // Data tidak berubah
            }
            this._lastFingerprint = newFingerprint;

            this.allMembers = fetchedMembers;
            this.totalPages = memberData.pages || 1;
            this.totalRecords = memberData.total || 0;
            this.currentPage = memberData.current_page || 1;

            const groups = grupData.grup || grupData.grup_list || grupData || [];
            this._allGroups = groups;
            this.renderGroupTabs(groups);

            const addGrupSelect = document.getElementById('inp-mem-grup');
            if (addGrupSelect && !isSilent) {
                addGrupSelect.innerHTML = groups.map(g => `<option value="${g.nama}">${g.nama.toUpperCase()}</option>`).join('');
            }

            this.render(this.allMembers, memberData);
        } catch (err) {
            if (!isSilent) {
                Toast.error('Gagal memuat member');
            }
        }
    },

    renderGroupTabs(groups) {
        const tabsContainer = document.getElementById('member-group-tabs');
        if (!tabsContainer) return;

        if (!groups || groups.length === 0) {
            tabsContainer.innerHTML = '<span class="text-[11px] text-neutral-500 py-1">Belum ada grup member</span>';
            return;
        }

        const isAllActive = !this.currentGrupId;
        let tabsHtml = `
            <button type="button" onclick="Member.selectGroup('')"
                class="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${isAllActive ? 'bg-[#161616] text-white border border-neutral-400 shadow-sm' : 'bg-[#0a0a0a] text-neutral-400 border border-[#1f1f1f] hover:border-[#333] hover:text-neutral-200'}">
                <span class="w-1.5 h-1.5 rounded-full ${isAllActive ? 'bg-neutral-200' : 'bg-neutral-600'}"></span>
                <span class="tracking-wide">SEMUA</span>
            </button>
        `;

        tabsHtml += groups.map(g => {
            const isActive = String(this.currentGrupId) === String(g.id);
            const gColor = g.warna || '#3B82F6';

            if (isActive) {
                return `
                    <button type="button" onclick="Member.selectGroup(${g.id})"
                        class="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 bg-[#161616] text-white border shadow-sm"
                        style="border-color: ${gColor};">
                        <span class="w-2 h-2 rounded-full" style="background-color: ${gColor};"></span>
                        <span class="tracking-wide">${Utils.escapeHtml(g.nama.toUpperCase())}</span>
                    </button>
                `;
            } else {
                return `
                    <button type="button" onclick="Member.selectGroup(${g.id})"
                        class="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 bg-[#0a0a0a] text-neutral-400 border border-[#1f1f1f] hover:border-[#333] hover:text-neutral-200">
                        <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${gColor};"></span>
                        <span class="tracking-wide">${Utils.escapeHtml(g.nama.toUpperCase())}</span>
                    </button>
                `;
            }
        }).join('');

        tabsContainer.innerHTML = tabsHtml;
    },

    selectGroup(grupId) {
        this.currentGrupId = (grupId !== undefined && grupId !== null && grupId !== '') ? String(grupId) : '';
        this.currentPage = 1;
        this.renderGroupTabs(this._allGroups || []);
        this.load();
    },

    doSearch() {
        const searchInput = document.getElementById('member-search-input');
        this.searchQuery = searchInput ? searchInput.value.trim() : '';
        const clearBtn = document.getElementById('member-search-clear');
        if (clearBtn) clearBtn.classList.toggle('hidden', !this.searchQuery);
        this.currentPage = 1;
        this.load();
    },

    debouncedSearch: Utils.debounce(function() {
        Member.doSearch();
    }, 400),

    clearSearch() {
        const searchInput = document.getElementById('member-search-input');
        if (searchInput) searchInput.value = '';
        const clearBtn = document.getElementById('member-search-clear');
        if (clearBtn) clearBtn.classList.add('hidden');
        this.searchQuery = '';
        this.currentPage = 1;
        this.load();
    },

    changePerPage(n) {
        this.perPage = parseInt(n) || this.getAdaptivePerPage();
        this.currentPage = 1;
        this.load();
    },

    gotoPage(p) {
        if (p < 1 || p > this.totalPages) return;
        this.currentPage = p;
        this.load();
    },

    showMobileActions(id) {
        const m = (this.allMembers || []).find(x => x.id === id);
        if (!m) return;
        const username = m.username || '-';
        const grupNama = (typeof m.grup === 'object' ? m.grup.nama : m.grup) || 'reguler';
        const modalHtml = `
            <div class="text-left space-y-3 p-1">
                <div class="flex items-center justify-between border-b border-[#262626] pb-2.5">
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded bg-[#171717] border border-[#262626] flex items-center justify-center text-neutral-200 font-bold text-xs">
                            ${username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div class="font-bold text-neutral-200 text-sm">${username}</div>
                            <div class="text-[11px] text-neutral-500">${m.nama_lengkap || '-'}</div>
                        </div>
                    </div>
                    <span class="text-[10px] px-2 py-0.5 rounded font-bold uppercase" style="background-color: ${m.grup_warna}20; color: ${m.grup_warna}; border: 1px solid ${m.grup_warna}40;">
                        ${grupNama}
                    </span>
                </div>
                <div class="grid grid-cols-2 gap-2 text-xs font-mono py-1">
                    <div class="bg-[#0a0a0a] border border-[#1f1f1f] p-2 rounded">
                        <span class="text-neutral-500 block text-[10px]">SISA WAKTU</span>
                        <span class="text-neutral-200 font-bold">${Utils.formatMenit(m.waktu_tersimpan)}</span>
                    </div>
                    <div class="bg-[#0a0a0a] border border-[#1f1f1f] p-2 rounded">
                        <span class="text-neutral-500 block text-[10px]">STATUS</span>
                        <span class="${m.aktif ? 'text-emerald-400' : 'text-neutral-500'} font-bold">${m.aktif ? 'Aktif' : 'Terkunci'}</span>
                    </div>
                </div>
                <div class="space-y-1.5 pt-1">
                    <button onclick="Modal.closeModal(); Member.tambahWaktu(${m.id})" class="w-full flex items-center justify-between px-3 py-2.5 bg-neutral-100 hover:bg-white text-black font-bold text-xs rounded-lg transition-colors">
                        <span class="flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                            Isi Saldo / Tambah Waktu
                        </span>
                        <span class="text-[10px] opacity-75">Beli Paket</span>
                    </button>
                    <button onclick="Modal.closeModal(); Member.showDetail(${m.id})" class="w-full flex items-center justify-between px-3 py-2 bg-[#171717] hover:bg-[#222] border border-[#262626] text-neutral-200 text-xs rounded-lg transition-colors font-semibold">
                        <span class="flex items-center gap-2">
                            <svg class="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                            Lihat Detail & Riwayat
                        </span>
                        <span class="text-neutral-500 text-[10px]">&rarr;</span>
                    </button>
                    <button onclick="Modal.closeModal(); Member.edit(${m.id})" class="w-full flex items-center justify-between px-3 py-2 bg-[#171717] hover:bg-[#222] border border-[#262626] text-neutral-200 text-xs rounded-lg transition-colors font-semibold">
                        <span class="flex items-center gap-2">
                            <svg class="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            Edit Profil
                        </span>
                        <span class="text-neutral-500 text-[10px]">&rarr;</span>
                    </button>
                    ${(window.App && App.user && App.user.role === 'kasir') ? '' : `
                    <button onclick="Modal.closeModal(); Member.delete(${m.id})" class="w-full flex items-center justify-between px-3 py-2 bg-red-950/20 hover:bg-red-900/30 border border-red-900/40 text-red-400 text-xs rounded-lg transition-colors font-semibold">
                        <span class="flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            Hapus Akun
                        </span>
                        <span class="text-red-500 text-[10px]">Permanen</span>
                    </button>`}
                </div>
            </div>
        `;
        const modalContainerHtml = `
            <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded-xl p-4 sm:p-5 max-w-sm w-full mx-auto shadow-2xl">
                ${modalHtml}
                <div class="mt-3 pt-2 border-t border-[#1c1c1c]">
                    <button onclick="Modal.closeModal()" class="w-full py-2 bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] text-neutral-300 text-xs font-bold rounded-lg transition-colors">Tutup</button>
                </div>
            </div>
        `;
        if (typeof Modal !== 'undefined' && typeof Modal.show === 'function') {
            Modal.show(modalContainerHtml, null, { disableBackdropClose: false });
        }
    },

    async add() {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
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
        if (!Utils.isValidUsername(data.username, 3, 30)) return Toast.error('Username harus 3 - 30 karakter (hanya huruf, angka, _, -, .)');
        if (!Utils.isValidPassword(data.password, 4, 16)) return Toast.error('Password PIN harus 4 - 16 karakter');
        if (data.nama_lengkap && data.nama_lengkap.length > 100) return Toast.error('Nama lengkap maksimal 100 karakter');
        if (data.email && !Utils.isValidEmail(data.email)) return Toast.error('Format email tidak valid atau melebihi 120 karakter');
        if (data.no_hp && !Utils.isValidPhone(data.no_hp)) return Toast.error('Nomor HP tidak valid (8-16 digit angka)');

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
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
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
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        const namaEl = document.getElementById('edit-member-nama');
        const emailEl = document.getElementById('edit-member-email');
        const passEl = document.getElementById('edit-member-password');

        const data = {
            nama_lengkap: namaEl ? namaEl.value.trim() : '',
            email: emailEl ? emailEl.value.trim() : '',
            grup: document.getElementById('edit-member-grup')?.value || '',
        };
        const password = passEl ? passEl.value : '';
        if (password) {
            if (!Utils.isValidPassword(password, 4, 16)) {
                return Toast.error('Password baru harus 4 - 16 karakter');
            }
            data.password = password;
        }
        if (data.nama_lengkap && data.nama_lengkap.length > 100) return Toast.error('Nama lengkap maksimal 100 karakter');
        if (data.email && !Utils.isValidEmail(data.email)) return Toast.error('Format email tidak valid atau melebihi 120 karakter');

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
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
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
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        const selections = [];
        let totalMenit = 0;
        let totalHarga = 0;
        let hasInvalidQty = false;
        const paketList = (typeof MemberRefill !== 'undefined' && MemberRefill._currentPaketList && MemberRefill._currentPaketList.length > 0)
            ? MemberRefill._currentPaketList
            : ((typeof Member !== 'undefined' && Member._currentPaketList && Member._currentPaketList.length > 0)
                ? Member._currentPaketList
                : (this._currentPaketList || []));
        
        if (typeof MemberRefill !== 'undefined' && MemberRefill._selections && Object.keys(MemberRefill._selections).length > 0) {
            Object.keys(MemberRefill._selections).forEach(idStr => {
                const paketId = parseInt(idStr);
                const sel = MemberRefill._selections[paketId];
                if (sel && sel.checked) {
                    const qty = sel.qty || 1;
                    if (qty < 1 || qty > 100) {
                        hasInvalidQty = true;
                    }
                    selections.push({ paket_id: paketId, qty: Math.max(1, Math.min(100, qty)) });
                    const paket = (paketList || []).find(p => p.id === paketId);
                    if (paket) {
                        const durasi = (paket.durasi_menit !== undefined ? paket.durasi_menit : (paket.durasi || 0));
                        totalMenit += durasi * qty;
                        totalHarga += (paket.harga || 0) * qty;
                    }
                }
            });
        } else {
            document.querySelectorAll('input[type="checkbox"][id^="mem-chk-paket-"]:checked').forEach(chk => {
                const paketId = parseInt(chk.value);
                const qtyInput = document.getElementById(`mem-qty-paket-${paketId}`);
                const qty = qtyInput ? (parseInt(qtyInput.value) || 1) : 1;
                if (qty < 1 || qty > 100) {
                    hasInvalidQty = true;
                }
                selections.push({ paket_id: paketId, qty: Math.max(1, Math.min(100, qty)) });
                
                const paket = (paketList || []).find(p => p.id === paketId);
                if (paket) {
                    const durasi = (paket.durasi_menit !== undefined ? paket.durasi_menit : (paket.durasi || 0));
                    totalMenit += durasi * qty;
                    totalHarga += (paket.harga || 0) * qty;
                }
            });
        }

        if (hasInvalidQty) {
            return Toast.error('Kuantitas paket harus antara 1 sampai 100');
        }

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
                const paket = (paketList || []).find(p => p.id === sel.paket_id);
                if (paket) {
                    dataLines.push({
                        label: `- ${paket.nama} ${sel.qty > 1 ? 'x' + sel.qty : ''}`,
                        value: Utils.formatRupiah((paket.harga || 0) * sel.qty)
                    });
                }
            });

            const metodePembayaran = document.getElementById('member-refill-metode-pembayaran')?.value || 'Tunai';

            dataLines.push(
                { separator: true },
                { label: 'Total Waktu Saat Ini', value: Utils.formatDurasiFriendly(sisaSekarang) },
                { label: 'Total Tambahan Waktu', value: Utils.formatDurasiFriendly(totalMenit) },
                { label: 'Total Setelah Ditambah', value: Utils.formatDurasiFriendly(totalSetelah), highlight: true },
                { separator: true },
                { label: 'Total Harga', value: Utils.formatRupiah(totalHarga), highlight: true },
                { label: 'Pembayaran', value: metodePembayaran, highlight: true }
            );

            ModalConfirmTambah.open({
                title: "Konfirmasi Isi Waktu Billing",
                dataLines: dataLines,
                onConfirm: async () => {
                    try {
                        await API.member.tambahWaktu(memberId, { member_id: memberId, selections: selections }, 1, metodePembayaran);
                        Toast.success('Saldo ditambahkan');
                        Modal.closeModal();
                        if (typeof Member !== 'undefined' && typeof Member.load === 'function' && (typeof App === 'undefined' || App.currentTab === 'member')) {
                            Member.load();
                        }
                        if (typeof Dashboard !== 'undefined' && typeof Dashboard.load === 'function' && typeof App !== 'undefined' && App.currentTab === 'dash') {
                            Dashboard.load();
                        }
                    } catch (err) {
                        Toast.error(err.message);
                    }
                }
            });
        } catch (err) {
            Toast.error('Gagal mengambil info member: ' + err.message);
        }
    },

    async refund(memberId, transaksiId, namaPaket, durasiMenit, dibuatPada, sisaWaktuSekarang) {
        if (window.BranchManager && BranchManager.activeBranchId && BranchManager.activeBranchId !== '0') {
            Toast.error('Akses Ditolak: Transaksi bersifat read-only di cabang remote.');
            return;
        }
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        const durasiFriendly = Utils.formatDurasiFriendly(durasiMenit);
        const sisaSekarangFriendly = Utils.formatDurasiFriendly(sisaWaktuSekarang);
        const setelahDeduction = Math.max(0, sisaWaktuSekarang - durasiMenit);
        const setelahDeductionFriendly = Utils.formatDurasiFriendly(setelahDeduction);

        const confirmHtml = `
            <div class="text-center space-y-2">
                <p class="text-xs lg:text-base text-neutral-400 font-bold uppercase tracking-wider">Refund Paket Billing Member?</p>
                <div class="bg-[#050505] border border-[#2a2a2a] rounded-lg p-3 my-2 text-left space-y-1.5 font-mono">
                    <div class="flex justify-between text-neutral-300 text-xs lg:text-sm">
                        <span>Paket:</span>
                        <span class="font-bold text-neutral-200 text-right">${namaPaket}</span>
                    </div>
                    <div class="flex justify-between text-neutral-300 text-xs lg:text-sm border-t border-[#1c1c1c] pt-1.5">
                        <span>Total Waktu Sekarang:</span>
                        <span class="font-bold text-neutral-300 text-right">${sisaSekarangFriendly}</span>
                    </div>
                    <div class="flex justify-between text-neutral-300 text-xs lg:text-sm">
                        <span>Potongan Refund:</span>
                        <span class="font-bold text-red-400 text-right">-${durasiFriendly}</span>
                    </div>
                    <div class="flex justify-between text-neutral-300 text-xs lg:text-sm border-t border-[#1c1c1c]/80 pt-1.5">
                        <span>Total Akhir Waktu:</span>
                        <span class="font-bold text-emerald-400 text-right">${setelahDeductionFriendly}</span>
                    </div>
                    <div class="flex justify-between text-neutral-300 text-xs lg:text-sm border-t border-[#1c1c1c]/80 pt-1.5">
                        <span>Pembelian:</span>
                        <span class="text-neutral-400 text-right">${dibuatPada}</span>
                    </div>
                </div>
                <p class="text-[10px] lg:text-base text-neutral-500 mt-1">Total waktu bermain member akan dikurangi menjadi <strong>${setelahDeductionFriendly}</strong>.</p>
            </div>
        `;
        Modal.confirm(confirmHtml, async () => {
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
