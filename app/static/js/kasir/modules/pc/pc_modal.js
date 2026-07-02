// app/static/js/kasir/modules/pc/pc_modal.js
// Mintlify Dark — modal style konsisten

const PCModal = {
    async showAddModal() {
        let grupOptions = '<option value="">- Pilih Grup -</option>';
        try {
            const grupResponse = await API.grup.list();
            const groups = grupResponse.grup || [];
            grupOptions = groups.map(g => `<option value="${g.nama}">${g.nama.toUpperCase()}</option>`).join('');
        } catch (_) {}

        const bodyHtml = `
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs font-medium text-neutral-400 block">Kode PC <span class="text-red-400">*</span></label>
                        <input type="text" id="modal-pc-kode" placeholder="PC-01"
                            class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">
                    </div>
                    <div>
                        <label class="text-xs font-medium text-neutral-400 block">Nama Unit</label>
                        <input type="text" id="modal-pc-nama" placeholder="Nama tampil"
                            class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs font-medium text-neutral-400 block">IP Address</label>
                        <input type="text" id="modal-pc-ip" placeholder="192.168.1.101"
                            class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono">
                    </div>
                    <div>
                        <label class="text-xs font-medium text-neutral-400 block">MAC Address</label>
                        <input type="text" id="modal-pc-mac" placeholder="AA:BB:CC:DD:EE:FF"
                            class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono">
                    </div>
                </div>
                <div>
                    <label class="text-xs font-medium text-neutral-400 block">Grup PC</label>
                    <select id="modal-pc-grup"
                        class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">${grupOptions}</select>
                </div>
            </div>`;

        const modalHtml = UI.modalWrapper({
            icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>',
            title: 'Tambah Unit PC',
            subtitle: 'Registrasi stasiun warnet baru',
            body: bodyHtml,
            footer: `
                <button onclick="Modal.closeModal()" class="px-4 py-2 text-sm font-medium text-neutral-400 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 rounded-lg transition-colors">Batal</button>
                <button onclick="PC.add()" class="px-4 py-2 text-sm font-medium text-black bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                    Tambah PC
                </button>`,
        });

        Modal.show(modalHtml, null, { disableBackdropClose: true });
    },

    async showAddBatchModal() {
        let grupOptions = '<option value="">- Pilih Grup -</option>';
        try {
            const grupResponse = await API.grup.list();
            const groups = grupResponse.grup || [];
            grupOptions = groups.map(g => `<option value="${g.nama}">${g.nama.toUpperCase()}</option>`).join('');
        } catch (_) {}

        const bodyHtml = `
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                    <label class="text-xs font-medium text-neutral-400 block">Prefix Nama</label>
                    <input type="text" id="modal-batch-prefix" value="PC-"
                        class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">
                </div>
                <div>
                    <label class="text-xs font-medium text-neutral-400 block">No Mulai</label>
                    <input type="number" id="modal-batch-start" value="1"
                        class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">
                </div>
                <div>
                    <label class="text-xs font-medium text-neutral-400 block">No Akhir</label>
                    <input type="number" id="modal-batch-end" value="10"
                        class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">
                </div>
                <div>
                    <label class="text-xs font-medium text-neutral-400 block">IP Awal</label>
                    <input type="text" id="modal-batch-ip-start" placeholder="192.168.1.101"
                        class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono">
                </div>
                <div>
                    <label class="text-xs font-medium text-neutral-400 block">IP Akhir</label>
                    <input type="text" id="modal-batch-ip-end" placeholder="192.168.1.110"
                        class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono">
                </div>
                <div>
                    <label class="text-xs font-medium text-neutral-400 block">Grup Unit</label>
                    <select id="modal-batch-grup"
                        class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">${grupOptions}</select>
                </div>
            </div>`;

        const modalHtml = UI.modalWrapper({
            icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z"/></svg>',
            title: 'Tambah Massal (Batch)',
            subtitle: 'Registrasi beberapa PC sekaligus',
            body: bodyHtml,
            width: 'max-w-xl',
            footer: `
                <button onclick="Modal.closeModal()" class="px-4 py-2 text-sm font-medium text-neutral-400 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 rounded-lg transition-colors">Batal</button>
                <button onclick="PC.addBatch()" class="px-4 py-2 text-sm font-medium text-black bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z"/></svg>
                    Daftarkan Batch
                </button>`,
        });

        Modal.show(modalHtml, null, { disableBackdropClose: true });
    },

    showEditModal(pc, groups) {
        const grupOptions = groups.map(g => `<option value="${g.nama}" ${pc.grup === g.nama ? 'selected' : ''}>${g.nama.toUpperCase()}</option>`).join('');

        const bodyHtml = `
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs font-medium text-neutral-400 block">Kode PC</label>
                        <input type="text" id="edit-pc-kode" value="${pc.kode}"
                            class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">
                    </div>
                    <div>
                        <label class="text-xs font-medium text-neutral-400 block">Grup</label>
                        <select id="edit-pc-grup"
                            class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">${grupOptions}</select>
                    </div>
                </div>
                <div>
                    <label class="text-xs font-medium text-neutral-400 block">Nama Unit</label>
                    <input type="text" id="edit-pc-nama" value="${Utils.escapeHtml(pc.nama || '')}"
                        class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs font-medium text-neutral-400 block">IP Address</label>
                        <input type="text" id="edit-pc-ip" value="${pc.ip_address || ''}"
                            class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">
                    </div>
                    <div>
                        <label class="text-xs font-medium text-neutral-400 block">MAC Address</label>
                        <input type="text" id="edit-pc-mac" value="${pc.mac_address || ''}"
                            class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 font-mono uppercase focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">
                    </div>
                </div>
            </div>`;

        const modalHtml = UI.modalWrapper({
            icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>',
            title: 'Edit PC',
            subtitle: pc.kode,
            body: bodyHtml,
            footer: `
                <button onclick="Modal.closeModal()" class="px-4 py-2 text-sm font-medium text-neutral-400 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 rounded-lg transition-colors">Batal</button>
                <button onclick="PC.doEdit(${pc.id})" class="px-4 py-2 text-sm font-medium text-black bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors">Simpan</button>`,
        });

        Modal.show(modalHtml, null, { disableBackdropClose: true });
    }
};

window.PCModal = PCModal;
