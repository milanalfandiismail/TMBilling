const Grup = {
    async load() {
        const area = document.getElementById('grup-table');
        if (area && !area.closest('.tab-content').classList.contains('hidden')) {
            area.innerHTML = '<div class="flex justify-center py-8"><div class="w-6 h-6 border-2 border-neutral-800 border-t-neutral-100 rounded-full animate-spin"></div></div>';
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
        const bodyHtml = `
            <div class="space-y-4">
                <div>
                    <label class="text-xs font-medium text-neutral-400 block">Nama Grup <span class="text-red-400">*</span></label>
                    <input type="text" id="modal-grup-nama" placeholder="VIP"
                        class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">
                </div>
                <div>
                    <label class="text-xs font-medium text-neutral-400 block">Keterangan</label>
                    <input type="text" id="modal-grup-ket" placeholder="Zona VIP 6 PC"
                        class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">
                </div>
                <div>
                    <label class="text-xs font-medium text-neutral-400 block">Warna Grup</label>
                    <div class="flex items-center gap-3 px-4 py-2.5 bg-[#050505] border border-neutral-700 rounded-lg">
                        <input type="color" id="modal-grup-warna" value="#888888" class="w-8 h-8 rounded border-0 bg-transparent cursor-pointer">
                        <span class="text-xs text-neutral-500">Warna aksen untuk lencana grup</span>
                    </div>
                </div>
            </div>`;

        const modalHtml = UI.modalWrapper({
            icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>',
            title: 'Tambah Grup Baru',
            subtitle: 'Buat zona / kelompok PC baru',
            body: bodyHtml,
            footer: `
                <button onclick="Modal.closeModal()" class="px-4 py-2 text-sm font-medium text-neutral-400 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 rounded-lg transition-colors">Batal</button>
                <button onclick="Grup.add()" class="px-4 py-2 text-sm font-medium text-black bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                    Simpan Grup
                </button>`,
        });

        Modal.show(modalHtml, null, { disableBackdropClose: true });
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
                <div class="flex flex-col items-center justify-center py-20 text-neutral-500 bg-[#0c0c0c] border border-dashed border-neutral-800 rounded">
                    <svg class="w-12 h-12 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 01-2-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                    <p class="text-xs lg:text-base font-bold uppercase tracking-wider">Belum Ada Grup</p>
                </div>`;
            return;
        }

        area.innerHTML = `
            <div class="overflow-x-hidden w-full">
                <table class="w-full text-xs lg:text-base block lg:table">
                    <thead class="hidden lg:table-header-group">
                        <tr class="text-[9px] lg:text-base text-neutral-500 uppercase border-b border-neutral-800 tracking-wider">
                            <th class="px-6 py-4 text-left">ID</th>
                            <th class="px-6 py-4 text-left">Nama Grup</th>
                            <th class="px-6 py-4 text-left">Keterangan</th>
                            <th class="px-6 py-4 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[#2a2a2a] lg:divide-[#1c1c1c] block lg:table-row-group">
                        ${list.map(g => `
                            <tr class="hover:bg-neutral-800 transition-colors block lg:table-row py-3 lg:py-0 border-b border-neutral-700 last:border-b-0 lg:border-b-0">
                                <td class="px-6 py-4 flex lg:table-cell justify-between items-center">
                                    <span class="text-[10px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider lg:hidden">ID</span>
                                    <span class="font-mono text-neutral-500">#${g.id}</span>
                                </td>
                                <td class="px-6 py-4 flex lg:table-cell justify-between items-center border-t border-neutral-700/50 lg:border-t-0">
                                    <span class="text-[10px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Nama Grup</span>
                                    <span class="px-2.5 py-0.5 rounded text-[10px] lg:text-base font-bold uppercase" style="background-color: ${g.warna}15; color: ${g.warna}; border: 1px solid ${g.warna}25;">${g.nama}</span>
                                </td>
                                <td class="px-6 py-4 flex lg:table-cell justify-between items-center">
                                    <span class="text-[10px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Keterangan</span>
                                    <span class="text-neutral-400">${g.keterangan || '-'}</span>
                                </td>
                                <td class="px-6 py-4 text-right flex lg:table-cell justify-between items-center">
                                    <span class="text-[10px] lg:text-base text-neutral-500 font-bold uppercase tracking-wider lg:hidden">Aksi</span>
                                    ${(window.App && App.user && App.user.role === 'kasir') ? '' : `
                                    <button onclick="Grup.delete(${g.id}, '${g.nama}')" class="w-8 h-8 rounded bg-neutral-800 border border-neutral-700 text-red-400 hover:bg-red-600 hover:text-white transition-colors">
                                        <svg class="w-3.5 h-3.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>`}
                                </td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
    }
};

window.Grup = Grup;
