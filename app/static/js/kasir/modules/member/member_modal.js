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
                riwayatHtml = `<div class="text-center py-10 text-neutral-500 text-xs lg:text-base font-bold uppercase tracking-wider">Tidak ada riwayat paket</div>`;
            } else {
                riwayatHtml = `
                    <div class="divide-y divide-[#1c1c1c]/60 max-h-[220px] md:max-h-[350px] overflow-y-auto pr-1 scrollbar-mono">
                        ${riwayatPaket.map(t => `
                            <div class="py-3 flex items-center justify-between gap-3">
                                <div class="min-w-0 flex-1">
                                    <div class="font-bold text-neutral-200 text-xs lg:text-base lg:truncate break-words whitespace-normal">${t.nama}</div>
                                    <div class="text-[9px] lg:text-base text-neutral-400 mt-0.5 font-semibold">
                                        QTY : <span class="text-neutral-200">${t.qty || 1}x</span> (${Utils.formatDurasiFriendly(t.durasi_menit)})
                                    </div>
                                    <div class="text-[9px] lg:text-base text-neutral-500 font-mono mt-0.5">
                                        ${t.dibuat_pada}
                                    </div>
                                </div>
                                <div class="text-right flex items-center gap-3">
                                    <span class="text-xs lg:text-base font-mono font-bold text-neutral-300">${Utils.formatRupiah(t.harga)}</span>
                                    ${t.jenis === 'beli_paket_member' ? `
                                        <button onclick="Member.refund(${member.id}, ${t.id})" 
                                            class="px-2 py-1 text-[9px] lg:text-xs font-bold bg-[#3b1216] border border-[#ef4444]/30 text-red-200 hover:bg-red-600 hover:text-white rounded transition-colors uppercase shrink-0">
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
                <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded-xl p-4 md:p-6 max-w-5xl w-[calc(100%-2rem)] mx-auto md:w-full max-h-[85vh] overflow-y-auto scrollbar-thin my-auto">
                    <div class="flex items-center justify-between mb-4 pb-4 border-b border-[#1c1c1c]">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded bg-[#171717] border border-[#262626] flex items-center justify-center text-neutral-200 font-bold">${member.username.charAt(0).toUpperCase()}</div>
                            <div>
                                <h3 class="text-xs lg:text-base font-bold text-neutral-200 uppercase tracking-wider font-mono">${member.username}</h3>
                                <p class="text-[9px] lg:text-base text-neutral-500 mt-0.5">Profil & Riwayat Transaksi</p>
                            </div>
                        </div>
                        <button onclick="Modal.closeModal()" class="text-neutral-500 hover:text-neutral-300 text-xl leading-none">&times;</button>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <!-- Left Column: Member Info -->
                        <div class="space-y-4">
                            <div class="grid grid-cols-2 gap-3">
                                <div class="bg-[#050505] border border-[#1c1c1c] rounded p-4">
                                    <div class="text-[9px] lg:text-base text-neutral-500 uppercase mb-1 font-bold">ID</div>
                                    <div class="font-mono font-bold text-neutral-200">#${member.id}</div>
                                </div>
                                <div class="bg-[#050505] border border-[#1c1c1c] rounded p-4">
                                    <div class="text-[9px] lg:text-base text-neutral-500 uppercase mb-1 font-bold">Status</div>
                                    <div class="flex items-center gap-1.5 ${member.aktif ? 'text-neutral-200' : 'text-neutral-500'} font-bold">
                                        <span class="w-1.5 h-1.5 rounded-full ${member.aktif ? 'bg-neutral-200 animate-pulse' : 'bg-neutral-600'}"></span>
                                        ${member.aktif ? 'Aktif' : 'Terkunci'}
                                    </div>
                                </div>
                            </div>
                            <div class="bg-[#050505] border border-[#1c1c1c] rounded p-4">
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <div class="text-[9px] lg:text-base text-neutral-500 uppercase mb-1 font-bold">Tipe</div>
                                        <span class="px-2.5 py-0.5 rounded text-[10px] lg:text-base font-semibold uppercase style-grup-badge" style="border: 1px solid ${member.grup_warna || '#737373'}30; color: ${member.grup_warna || '#737373'}; background-color: ${member.grup_warna || '#737373'}15;">${grupNama}</span>
                                    </div>
                                    <div>
                                        <div class="text-[9px] lg:text-base text-neutral-500 uppercase mb-1 font-bold">Nama Lengkap</div>
                                        <div class="font-bold text-neutral-200">${member.nama_lengkap || '-'}</div>
                                    </div>
                                </div>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-[#1c1c1c]">
                                    <div>
                                        <div class="text-[9px] lg:text-base text-neutral-500 uppercase mb-1 font-bold">No. HP</div>
                                        <div class="font-mono font-bold text-neutral-300 text-xs lg:text-base">${member.no_hp || '-'}</div>
                                    </div>
                                    <div>
                                        <div class="text-[9px] lg:text-base text-neutral-500 uppercase mb-1 font-bold">Email</div>
                                        <div class="font-bold text-neutral-300 text-xs lg:text-base lg:truncate break-words whitespace-normal" title="${member.email || ''}">${member.email || '-'}</div>
                                    </div>
                                </div>
                            </div>
                            <div class="bg-[#050505] border border-[#1c1c1c] rounded p-4">
                                <div class="text-[9px] lg:text-base text-neutral-500 uppercase mb-1 font-bold">Sisa Waktu Bermain</div>
                                <div class="text-xl font-bold text-neutral-100 font-mono">${Utils.formatDurasiFriendly(member.waktu_saved || member.waktu_tersimpan)}</div>
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <div class="bg-[#050505] border border-[#1c1c1c] rounded p-4">
                                    <div class="text-[9px] lg:text-base text-neutral-400 font-bold uppercase mb-1.5 flex items-center gap-1">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                        Berlaku Sampai
                                    </div>
                                    <div class="font-mono font-bold text-neutral-200 text-xs lg:text-base">
                                        ${member.kadaluarsa_pada ? Utils.formatTanggal(member.kadaluarsa_pada) : '-'}
                                    </div>
                                    ${member.kadaluarsa_pada ? `<div class="text-[9px] lg:text-base text-neutral-500 mt-1 font-mono">${member.kadaluarsa_pada.split(' ')[1] || ''} WITA</div>` : ''}
                                </div>
                                <div class="bg-[#050505] border border-[#1c1c1c] rounded p-4">
                                    <div class="text-[9px] lg:text-base text-neutral-500 uppercase mb-1.5 flex items-center gap-1 font-bold">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                        Dibuat Pada
                                    </div>
                                    <div class="font-mono font-bold text-neutral-200 text-xs lg:text-base">
                                        ${member.dibuat_pada ? Utils.formatTanggal(member.dibuat_pada) : '-'}
                                    </div>
                                    ${member.dibuat_pada ? `<div class="text-[9px] lg:text-base text-neutral-500 mt-1 font-mono">${member.dibuat_pada.split(' ')[1] || ''} WITA</div>` : ''}
                                </div>
                            </div>
                        </div>

                        <!-- Right Column: Riwayat Paket / Refund -->
                        <div class="flex flex-col h-full border-t md:border-t-0 md:border-l border-[#1c1c1c] pt-4 md:pt-0 md:pl-6">
                            <h4 class="text-[10px] lg:text-base font-bold text-neutral-500 uppercase tracking-wider mb-3 font-mono">Riwayat Paket Aktif</h4>
                            <div class="flex-1 bg-[#050505] border border-[#1c1c1c] rounded p-4 overflow-y-auto max-h-[220px] md:max-h-[350px] scrollbar-thin">
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

        const formHtml = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl p-4 md:p-6 max-w-lg w-[calc(100%-2rem)] mx-auto md:w-full max-h-[85vh] overflow-y-auto scrollbar-thin my-auto shadow-2xl">
                <div class="flex items-center justify-between mb-5 pb-4 border-b border-[#2a2a2a]">
                    <div>
                        <h3 class="text-sm font-bold text-neutral-100 tracking-wide">Tambah Member Baru</h3>
                        <p class="text-[10px] lg:text-base text-neutral-500 mt-0.5">Daftarkan akun member warnet</p>
                    </div>
                    <button onclick="Modal.closeModal()" class="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 hover:text-neutral-100 hover:bg-[#222] transition-colors flex items-center justify-center text-lg leading-none">&times;</button>
                </div>
                <div class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Username <span class="text-red-400">*</span></label>
                            <input type="text" id="modal-mem-user" placeholder="username" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors">
                        </div>
                        <div>
                            <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Password <span class="text-red-400">*</span></label>
                            <input type="password" id="modal-mem-pass" placeholder="••••••••" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors">
                        </div>
                    </div>
                    <div>
                        <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Nama Lengkap</label>
                        <input type="text" id="modal-mem-nama" placeholder="Nama Lengkap" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors">
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Email</label>
                            <input type="email" id="modal-mem-email" placeholder="email@domain.com" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors">
                        </div>
                        <div>
                            <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">No HP</label>
                            <input type="text" id="modal-mem-nohp" placeholder="08xx-xxxx-xxxx" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors font-mono">
                        </div>
                    </div>
                    <div>
                        <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Grup Member</label>
                        <select id="modal-mem-grup" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500 transition-colors">${grupOptions}</select>
                    </div>
                </div>
                <div class="flex gap-3 justify-end mt-6 pt-4 border-t border-[#2a2a2a]">
                    <button onclick="Modal.closeModal()" class="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs lg:text-base font-bold rounded-lg transition-colors">Batal</button>
                    <button onclick="Member.add()" class="px-5 py-2.5 bg-neutral-100 hover:bg-white text-black text-xs lg:text-base font-bold rounded-lg transition-colors flex items-center gap-2">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        Tambah Member
                    </button>
                </div>
            </div>`;
        Modal.show(formHtml, null, { disableBackdropClose: true });
    },

    showEditModal(member, groups) {
        const currentGrup = (typeof member.grup === 'object' ? member.grup.nama : member.grup) || 'reguler';
        const grupOptions = groups.map(g => `<option value="${g.nama}" ${currentGrup === g.nama ? 'selected' : ''}>${g.nama.toUpperCase()}</option>`).join('');

        const formHtml = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl p-4 md:p-6 max-w-md w-[calc(100%-2rem)] mx-auto md:w-full max-h-[85vh] overflow-y-auto scrollbar-thin my-auto shadow-2xl">
                <div class="flex items-center justify-between mb-5 pb-4 border-b border-[#2a2a2a]">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                            <svg class="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </div>
                        <div>
                            <h3 class="text-sm font-bold text-neutral-100 tracking-wide">Edit Member</h3>
                            <p class="text-[10px] lg:text-base text-neutral-500 font-mono mt-0.5">${member.username}</p>
                        </div>
                    </div>
                    <button onclick="Modal.closeModal()" class="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 hover:text-neutral-100 hover:bg-[#222] transition-colors flex items-center justify-center text-lg leading-none">&times;</button>
                </div>
                <div class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Nama Lengkap</label>
                            <input type="text" id="edit-member-nama" value="${Utils.escapeHtml(member.nama_lengkap || '')}" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500 transition-colors">
                        </div>
                        <div>
                            <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Tipe Akun</label>
                            <select id="edit-member-grup" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500 transition-colors">${grupOptions}</select>
                        </div>
                    </div>
                    <div>
                        <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Email</label>
                        <input type="email" id="edit-member-email" value="${member.email || ''}" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500 transition-colors">
                    </div>
                    <div>
                        <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Password Baru (opsional)</label>
                        <input type="password" id="edit-member-password" placeholder="Kosongkan jika tidak ganti" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500 transition-colors">
                    </div>
                </div>
                <div class="flex gap-3 justify-end mt-6 pt-4 border-t border-[#2a2a2a]">
                    <button onclick="Modal.closeModal()" class="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs lg:text-base font-bold rounded-lg transition-colors">Batal</button>
                    <button onclick="Member.doEdit(${member.id})" class="px-5 py-2.5 bg-neutral-100 hover:bg-white text-black text-xs lg:text-base font-bold rounded-lg transition-colors">Simpan</button>
                </div>
            </div>`;
        Modal.show(formHtml, null, { disableBackdropClose: true });
    }
};

window.MemberModal = MemberModal;
