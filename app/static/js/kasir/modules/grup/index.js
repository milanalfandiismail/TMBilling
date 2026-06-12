const Grup = {
    async load() {
        const area = document.getElementById('grup-table');
        if (area && !area.closest('.tab-content').classList.contains('hidden')) {
            area.innerHTML = '<div class="flex justify-center py-8"><div class="w-6 h-6 border-2 border-[#1c1c1c] border-t-neutral-100 rounded-full animate-spin"></div></div>';
        }
        try {
            const data = await API.grup.list();
            const list = data.grup || data.grup_list || [];
            this.updateAllDropdowns(list);
            if (area) this.render(list);
        } catch (err) {
            console.error("Grup Load Error:", err);
        }
    },

    showAddModal() {
        const formHtml = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl p-6 max-w-md w-[calc(100%-2rem)] mx-auto md:w-full shadow-2xl">
                <div class="flex items-center justify-between mb-5 pb-4 border-b border-[#2a2a2a]">
                    <div>
                        <h3 class="text-sm font-bold text-neutral-100 tracking-wide">Tambah Grup Baru</h3>
                        <p class="text-[10px] lg:text-base text-neutral-500 mt-0.5">Buat zona / kelompok PC baru</p>
                    </div>
                    <button onclick="Modal.closeModal()" class="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 hover:text-neutral-100 hover:bg-[#222] transition-colors flex items-center justify-center text-lg leading-none">&times;</button>
                </div>
                <div class="space-y-4">
                    <div>
                        <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Nama Grup <span class="text-red-400">*</span></label>
                        <input type="text" id="modal-grup-nama" placeholder="Nama Grup" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors">
                    </div>
                    <div>
                        <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Keterangan</label>
                        <input type="text" id="modal-grup-ket" placeholder="Deskripsi grup (opsional)" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors">
                    </div>
                    <div>
                        <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Warna Grup</label>
                        <div class="flex items-center gap-3 px-4 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
                            <input type="color" id="modal-grup-warna" value="#888888" class="w-8 h-8 rounded border-0 bg-transparent cursor-pointer">
                            <span class="text-[10px] lg:text-base text-neutral-500">Warna aksen untuk lencana grup ini</span>
                        </div>
                    </div>
                </div>
                <div class="flex gap-3 justify-end mt-6 pt-4 border-t border-[#2a2a2a]">
                    <button onclick="Modal.closeModal()" class="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs lg:text-base font-bold rounded-lg transition-colors">Batal</button>
                    <button onclick="Grup.add()" class="px-5 py-2.5 bg-neutral-100 hover:bg-white text-black text-xs lg:text-base font-bold rounded-lg transition-colors flex items-center gap-2">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        Simpan Grup
                    </button>
                </div>
            </div>`;
        Modal.show(formHtml, null, { disableBackdropClose: true });
    },

    async add() {
        const get = (modalId, legacyId) => {
            const m = document.getElementById(modalId);
            if (m) return m;
            return document.getElementById(legacyId);
        };
        const data = {
            nama: (get('modal-grup-nama', 'inp-grup-nama') || {}).value?.trim() || '',
            keterangan: (get('modal-grup-ket', 'inp-grup-ket') || {}).value?.trim() || '',
            warna: (get('modal-grup-warna', 'inp-grup-warna') || {}).value || '#888888'
        };
        if (!data.nama) return Toast.error("Nama grup wajib diisi");
        try {
            await API.grup.create(data);
            Toast.success(`Grup ${data.nama} berhasil disimpan`);
            Modal.closeModal();
            this.load();
        } catch (err) {
            Toast.error(err.message);
        }
    },


    async delete(id, nama) {
        const message = `<div class="text-center"><p class="text-xs lg:text-base text-neutral-400">Hapus grup <span class="text-neutral-200 font-bold uppercase">${nama}</span>? Pastikan tidak ada PC atau Paket yang terikat.</p></div>`;
        Modal.confirm(message, async () => {
            try {
                await API.grup.delete(id);
                Toast.success("Grup berhasil dihapus");
                this.load();
            } catch (err) {
                Toast.error(err.message);
            }
        });
    },

    updateAllDropdowns(list) {
        const options = list.map(g => `<option value="${g.nama}">GRUP: ${g.nama.toUpperCase()}</option>`).join('');
        ['inp-pc-grup', 'inp-batch-grup', 'inp-paket-grup', 'inp-member-grup'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = options;
        });
        const filterSelect = document.getElementById('member-grup-filter-select');
        if (filterSelect) {
            filterSelect.innerHTML = '<option value="">Semua Grup</option>' + options;
        }
    },

    render(list) {
        const area = document.getElementById('grup-table');
        if (list.length === 0) {
            area.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-neutral-500 bg-[#0c0c0c] border border-dashed border-[#1c1c1c] rounded">
                    <svg class="w-12 h-12 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 01-2-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                    <p class="text-xs lg:text-base font-bold uppercase tracking-wider">Belum Ada Grup</p>
                </div>`;
            return;
        }

        area.innerHTML = `
            <div class="overflow-x-hidden w-full">
                <table class="w-full text-xs lg:text-base block lg:table">
                    <thead class="hidden lg:table-header-group">
                        <tr class="text-[9px] lg:text-base text-neutral-500 uppercase border-b border-[#1c1c1c] tracking-wider">
                            <th class="px-6 py-4 text-left">ID</th>
                            <th class="px-6 py-4 text-left">Nama Grup</th>
                            <th class="px-6 py-4 text-left">Keterangan</th>
                            <th class="px-6 py-4 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#2a2a2a] lg:divide-[#1c1c1c] block lg:table-row-group">
                        ${list.map(g => `
                            <tr class="hover:bg-[#121212] transition-colors block lg:table-row py-3 lg:py-0 border-b border-[#2a2a2a] last:border-b-0 lg:border-b-0">
                                <td class="px-6 py-4 flex lg:table-cell justify-between items-center">
                                    <span class="text-[10px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider lg:hidden">ID</span>
                                    <span class="font-mono text-neutral-500">#${g.id}</span>
                                </td>
                                <td class="px-6 py-4 flex lg:table-cell justify-between items-center border-t border-[#2a2a2a]/50 lg:border-t-0">
                                    <span class="text-[10px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Nama Grup</span>
                                    <span class="px-2.5 py-0.5 rounded text-[10px] lg:text-base font-bold uppercase" style="background-color: ${g.warna}15; color: ${g.warna}; border: 1px solid ${g.warna}25;">${g.nama}</span>
                                </td>
                                <td class="px-6 py-4 flex lg:table-cell justify-between items-center">
                                    <span class="text-[10px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Keterangan</span>
                                    <span class="text-neutral-400">${g.keterangan || '-'}</span>
                                </td>
                                <td class="px-6 py-4 text-right flex lg:table-cell justify-between items-center">
                                    <span class="text-[10px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Aksi</span>
                                    <button onclick="Grup.delete(${g.id}, '${g.nama}')" class="w-8 h-8 rounded bg-[#171717] border border-[#262626] text-red-400 hover:bg-red-600 hover:text-white transition-colors">
                                        <svg class="w-3.5 h-3.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                </td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
    }
};

window.Grup = Grup;
