// app/static/js/kasir/modules/member/member_modal.js

const MemberModal = {
    async showDetail(id) {
        try {
            const [memberResponse, paketResponse] = await Promise.all([
                API.member.get(id),
                API.member.getPaket(id)
            ]);
            const member = memberResponse.member || memberResponse.data || memberResponse;
            if (!member) return Toast.error('Data tidak ditemukan');

            const riwayatPaket = paketResponse.paket || [];
            const grupNama = (typeof member.grup === 'object' ? member.grup.nama : member.grup) || 'reguler';

            let riwayatHtml = '';
            if (riwayatPaket.length === 0) {
                riwayatHtml = `<div class="text-center py-10 text-neutral-500 text-xs font-semibold uppercase tracking-wider">Tidak ada riwayat paket</div>`;
            } else {
                riwayatHtml = `
                    <div class="divide-y divide-neutral-800 max-h-[220px] md:max-h-[350px] overflow-y-auto pr-1 scrollbar-mono">
                        ${riwayatPaket.map(t => `
                            <div class="py-3 flex items-center justify-between gap-3">
                                <div class="min-w-0 flex-1">
                                    <div class="font-medium text-neutral-200 text-sm">${t.nama}</div>
                                    <div class="text-xs text-neutral-500 mt-0.5">
                                        QTY: <span class="text-neutral-300">${t.qty || 1}x</span> (${Utils.formatDurasiFriendly(t.durasi_menit)})
                                    </div>
                                    <div class="text-xs text-neutral-500 font-mono mt-0.5">
                                        ${t.dibuat_pada}
                                    </div>
                                </div>
                                <div class="text-right flex items-center gap-3">
                                    <span class="text-sm font-semibold font-mono text-neutral-200">${Utils.formatRupiah(t.harga)}</span>
                                    ${(t.jenis === 'beli_paket_member' || t.jenis === 'tambah_waktu_sesi') ? `
                                        <button onclick="Member.refund(${member.id}, ${t.id})"
                                            class="px-2 py-1 text-[10px] font-medium text-red-400 bg-red-500/10 border border-red-800/40 hover:bg-red-500/20 rounded-full transition-colors shrink-0 uppercase">
                                            REFUND
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            const detailHtml = `
                <div class="bg-[#0c0c0c] border border-neutral-800 rounded-xl p-4 md:p-6 max-w-5xl w-[calc(100%-2rem)] mx-auto md:w-full max-h-[85vh] overflow-y-auto scrollbar-thin my-auto">
                    <div class="flex items-center justify-between mb-4 pb-4 border-b border-neutral-800">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-200 font-bold">${member.username.charAt(0).toUpperCase()}</div>
                            <div>
                                <h3 class="text-sm font-semibold text-neutral-100 font-mono">${member.username}</h3>
                                <p class="text-xs text-neutral-500 mt-0.5">Profil & Riwayat Transaksi</p>
                            </div>
                        </div>
                        <button onclick="Modal.closeModal()" class="w-7 h-7 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-neutral-100 transition-colors flex items-center justify-center shrink-0"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <!-- Left Column: Member Info -->
                        <div class="space-y-4">
                            <div class="grid grid-cols-2 gap-3">
                                <div class="bg-[#050505] border border-neutral-800 rounded p-4">
                                    <div class="text-xs font-medium text-neutral-400">ID</div>
                                    <div class="font-mono font-bold text-neutral-200">#${member.id}</div>
                                </div>
                                <div class="bg-[#050505] border border-neutral-800 rounded p-4">
                                    <div class="text-xs font-medium text-neutral-400">Status</div>
                                    <div class="flex items-center gap-1.5 ${member.aktif ? 'text-neutral-200' : 'text-neutral-500'} font-bold">
                                        <span class="w-1.5 h-1.5 rounded-full ${member.aktif ? 'bg-neutral-200 animate-pulse' : 'bg-neutral-600'}"></span>
                                        ${member.aktif ? 'Aktif' : 'Terkunci'}
                                    </div>
                                </div>
                            </div>
                            <div class="bg-[#050505] border border-neutral-800 rounded p-4">
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <div class="text-xs font-medium text-neutral-400">Tipe</div>
                                        <span class="px-2.5 py-0.5 rounded text-xs font-semibold uppercase style-grup-badge" style="border: 1px solid ${member.grup_warna || '#737373'}30; color: ${member.grup_warna || '#737373'}; background-color: ${member.grup_warna || '#737373'}15;">${grupNama}</span>
                                    </div>
                                    <div>
                                        <div class="text-xs font-medium text-neutral-400">Nama Lengkap</div>
                                        <div class="font-bold text-neutral-200">${member.nama_lengkap || '-'}</div>
                                    </div>
                                </div>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-neutral-800">
                                    <div>
                                        <div class="text-xs font-medium text-neutral-400">No. HP</div>
                                        <div class="text-sm font-semibold text-neutral-200 font-mono">${member.no_hp || '-'}</div>
                                    </div>
                                    <div>
                                        <div class="text-xs font-medium text-neutral-400">Email</div>
                                        <div class="text-sm font-medium text-neutral-200" title="${member.email || ''}">${member.email || '-'}</div>
                                    </div>
                                </div>
                            </div>
                            <div class="bg-[#050505] border border-neutral-800 rounded p-4">
                                <div class="text-xs font-medium text-neutral-400">Sisa Waktu Bermain</div>
                                <div class="text-xl font-bold text-neutral-100 font-mono">${Utils.formatDurasiFriendly(member.waktu_saved || member.waktu_tersimpan)}</div>
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <div class="bg-[#050505] border border-neutral-800 rounded p-4">
                                    <div class="text-xs font-medium text-neutral-400 flex items-center gap-1">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                        Berlaku Sampai
                                    </div>
                                    <div class="text-sm font-semibold text-neutral-100 font-mono">
                                        ${member.kadaluarsa_pada_display || '-'}
                                    </div>
                                </div>
                                <div class="bg-[#050505] border border-neutral-800 rounded p-4">
                                    <div class="text-xs font-medium text-neutral-400 flex items-center gap-1">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                        Dibuat Pada
                                    </div>
                                    <div class="text-sm font-semibold text-neutral-100 font-mono">
                                        ${member.dibuat_pada_display || '-'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Right Column: Riwayat Paket / Refund -->
                        <div class="flex flex-col h-full border-t md:border-t-0 md:border-l border-neutral-800 pt-4 md:pt-0 md:pl-6">
                            <h4 class="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3 font-mono">Riwayat Paket Aktif</h4>
                            <div class="flex-1 bg-[#050505] border border-neutral-800 rounded p-4 overflow-y-auto max-h-[220px] md:max-h-[350px] scrollbar-thin">
                                ${riwayatHtml}
                            </div>
                        </div>
                    </div>
                </div>`;
            Modal.show(detailHtml);
        } catch (err) {
            Toast.error('Gagal mengambil detail');
        }
    },

    async showAddModal() {
        let grupOptions = '<option value="">- Pilih Grup -</option>';
        try {
            const grupData = await API.grup.list();
            const groups = grupData.grup || [];
            grupOptions = groups.map(g => `<option value="${g.nama}">${g.nama.toUpperCase()}</option>`).join('');
        } catch (_) { }

        const bodyHtml = `
            <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs font-medium text-neutral-400 block">Username <span class="text-red-400">*</span></label>
                        <input type="text" id="modal-mem-user" placeholder="username"
                            class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">
                    </div>
                    <div>
                        <label class="text-xs font-medium text-neutral-400 block">Password <span class="text-red-400">*</span></label>
                        <input type="password" id="modal-mem-pass" placeholder="Min 6 karakter"
                            class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">
                    </div>
                </div>
                <div>
                    <label class="text-xs font-medium text-neutral-400 block">Nama Lengkap</label>
                    <input type="text" id="modal-mem-nama" placeholder="Nama Lengkap"
                        class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs font-medium text-neutral-400 block">Email</label>
                        <input type="email" id="modal-mem-email" placeholder="email@domain.com"
                            class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">
                    </div>
                    <div>
                        <label class="text-xs font-medium text-neutral-400 block">No HP</label>
                        <input type="text" id="modal-mem-nohp" placeholder="08xx-xxxx-xxxx"
                            class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono">
                    </div>
                </div>
                <div>
                    <label class="text-xs font-medium text-neutral-400 block">Grup Member</label>
                    <select id="modal-mem-grup"
                        class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">${grupOptions}</select>
                </div>
            </div>`;

        const modalHtml = UI.modalWrapper({
            icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>',
            title: 'Tambah Member Baru',
            subtitle: 'Daftarkan akun member warnet',
            body: bodyHtml,
            footer: `
                <button onclick="Modal.closeModal()" class="px-4 py-2 text-sm font-medium text-neutral-400 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 rounded-lg transition-colors">Batal</button>
                <button onclick="Member.add()" class="px-4 py-2 text-sm font-medium text-black bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                    Tambah Member
                </button>`,
        });

        Modal.show(modalHtml, null, { disableBackdropClose: true });
    },

    showEditModal(member, groups) {
        const currentGrup = (typeof member.grup === 'object' ? member.grup.nama : member.grup) || 'reguler';
        const grupOptions = groups.map(g => `<option value="${g.nama}" ${currentGrup === g.nama ? 'selected' : ''}>${g.nama.toUpperCase()}</option>`).join('');

        const bodyHtml = `
            <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs font-medium text-neutral-400 block">Nama Lengkap</label>
                        <input type="text" id="edit-member-nama" value="${Utils.escapeHtml(member.nama_lengkap || '')}"
                            class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">
                    </div>
                    <div>
                        <label class="text-xs font-medium text-neutral-400 block">Tipe Akun</label>
                        <select id="edit-member-grup"
                            class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">${grupOptions}</select>
                    </div>
                </div>
                <div>
                    <label class="text-xs font-medium text-neutral-400 block">Email</label>
                    <input type="email" id="edit-member-email" value="${member.email || ''}"
                        class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">
                </div>
                <div>
                    <label class="text-xs font-medium text-neutral-400 block">Password Baru (opsional)</label>
                    <input type="password" id="edit-member-password" placeholder="Kosongkan jika tidak ganti"
                        class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">
                </div>
            </div>`;

        const modalHtml = UI.modalWrapper({
            icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>',
            title: 'Edit Member',
            subtitle: member.username,
            body: bodyHtml,
            footer: `
                <button onclick="Modal.closeModal()" class="px-4 py-2 text-sm font-medium text-neutral-400 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 rounded-lg transition-colors">Batal</button>
                <button onclick="Member.doEdit(${member.id})" class="px-4 py-2 text-sm font-medium text-black bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors">Simpan</button>`,
        });

        Modal.show(modalHtml, null, { disableBackdropClose: true });
    }
};

window.MemberModal = MemberModal;
