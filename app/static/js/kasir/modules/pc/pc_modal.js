// app/static/js/kasir/modules/pc/pc_modal.js

const PCModal = {
    async showAddModal() {
        let grupOptions = '<option value="">- Pilih Grup -</option>';
        try {
            const grupResponse = await API.grup.list();
            const groups = grupResponse.grup || [];
            grupOptions = groups.map(g => `<option value="${g.nama}">${g.nama.toUpperCase()}</option>`).join('');
        } catch (_) {}

        const formHtml = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl p-6 max-w-lg w-[calc(100%-2rem)] mx-auto md:w-full shadow-2xl">
                <div class="flex items-center justify-between mb-5 pb-4 border-b border-[#2a2a2a]">
                    <div>
                        <h3 class="text-sm font-bold text-neutral-100 tracking-wide">Tambah Unit PC</h3>
                        <p class="text-[10px] lg:text-base text-neutral-500 mt-0.5">Registrasi stasiun warnet baru</p>
                    </div>
                    <button onclick="Modal.closeModal()" class="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 hover:text-neutral-100 hover:bg-[#222] transition-colors flex items-center justify-center text-lg leading-none">&times;</button>
                </div>
                <div class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Kode PC <span class="text-red-400">*</span></label>
                            <input type="text" id="modal-pc-kode" placeholder="Misal: PC-01" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors">
                        </div>
                        <div>
                            <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Nama Unit</label>
                            <input type="text" id="modal-pc-nama" placeholder="Nama tampil" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors">
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">IP Address</label>
                            <input type="text" id="modal-pc-ip" placeholder="192.168.1.101" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors font-mono">
                        </div>
                        <div>
                            <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">MAC Address</label>
                            <input type="text" id="modal-pc-mac" placeholder="AA:BB:CC:DD:EE:FF" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors font-mono">
                        </div>
                    </div>
                    <div>
                        <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Grup PC</label>
                        <select id="modal-pc-grup" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500 transition-colors">${grupOptions}</select>
                    </div>
                </div>
                <div class="flex gap-3 justify-end mt-6 pt-4 border-t border-[#2a2a2a]">
                    <button onclick="Modal.closeModal()" class="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs lg:text-base font-bold rounded-lg transition-colors">Batal</button>
                    <button onclick="PC.add()" class="px-5 py-2.5 bg-neutral-100 hover:bg-white text-black text-xs lg:text-base font-bold rounded-lg transition-colors flex items-center gap-2">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        Tambah PC
                    </button>
                </div>
            </div>`;
        Modal.show(formHtml, null, { disableBackdropClose: true });
    },

    async showAddBatchModal() {
        let grupOptions = '<option value="">- Pilih Grup -</option>';
        try {
            const grupResponse = await API.grup.list();
            const groups = grupResponse.grup || [];
            grupOptions = groups.map(g => `<option value="${g.nama}">${g.nama.toUpperCase()}</option>`).join('');
        } catch (_) {}

        const formHtml = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl p-6 max-w-xl w-[calc(100%-2rem)] mx-auto md:w-full shadow-2xl">
                <div class="flex items-center justify-between mb-5 pb-4 border-b border-[#2a2a2a]">
                    <div>
                        <h3 class="text-sm font-bold text-neutral-100 tracking-wide">Tambah Massal (Batch)</h3>
                        <p class="text-[10px] lg:text-base text-neutral-500 mt-0.5">Registrasi beberapa PC sekaligus dengan rentang IP otomatis</p>
                    </div>
                    <button onclick="Modal.closeModal()" class="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 hover:text-neutral-100 hover:bg-[#222] transition-colors flex items-center justify-center text-lg leading-none">&times;</button>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                        <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Prefix Nama</label>
                        <input type="text" id="modal-batch-prefix" value="PC-" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500 transition-colors">
                    </div>
                    <div>
                        <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">No Mulai</label>
                        <input type="number" id="modal-batch-start" value="1" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500 transition-colors">
                    </div>
                    <div>
                        <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">No Akhir</label>
                        <input type="number" id="modal-batch-end" value="10" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500 transition-colors">
                    </div>
                    <div>
                        <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">IP Awal</label>
                        <input type="text" id="modal-batch-ip-start" placeholder="192.168.1.101" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors font-mono">
                    </div>
                    <div>
                        <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">IP Akhir</label>
                        <input type="text" id="modal-batch-ip-end" placeholder="192.168.1.110" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors font-mono">
                    </div>
                    <div>
                        <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Grup Unit</label>
                        <select id="modal-batch-grup" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500 transition-colors">${grupOptions}</select>
                    </div>
                </div>
                <div class="flex gap-3 justify-end mt-6 pt-4 border-t border-[#2a2a2a]">
                    <button onclick="Modal.closeModal()" class="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs lg:text-base font-bold rounded-lg transition-colors">Batal</button>
                    <button onclick="PC.addBatch()" class="px-5 py-2.5 bg-neutral-100 hover:bg-white text-black text-xs lg:text-base font-bold rounded-lg transition-colors flex items-center gap-2">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z"></path></svg>
                        Daftarkan Batch PC
                    </button>
                </div>
            </div>`;
        Modal.show(formHtml, null, { disableBackdropClose: true });
    },

    showEditModal(pc, groups) {
        const grupOptions = groups.map(g => `<option value="${g.nama}" ${pc.grup === g.nama ? 'selected' : ''}>${g.nama.toUpperCase()}</option>`).join('');
        const formHtml = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl p-6 max-w-md w-[calc(100%-2rem)] mx-auto md:w-full shadow-2xl">
                <div class="flex items-center justify-between mb-5 pb-4 border-b border-[#2a2a2a]">
                    <div><h3 class="text-sm font-bold text-neutral-100 tracking-wide">Edit PC</h3><p class="text-[10px] lg:text-base text-neutral-500 font-mono mt-0.5">${pc.kode}</p></div>
                    <button onclick="Modal.closeModal()" class="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 hover:text-neutral-100 hover:bg-[#222] transition-colors flex items-center justify-center text-lg leading-none">&times;</button>
                </div>
                <div class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Kode PC</label>
                            <input type="text" id="edit-pc-kode" value="${pc.kode}" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500 transition-colors">
                        </div>
                        <div>
                            <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Grup</label>
                            <select id="edit-pc-grup" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500 transition-colors">${grupOptions}</select>
                        </div>
                    </div>
                    <div>
                        <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Nama Unit</label>
                        <input type="text" id="edit-pc-nama" value="${Utils.escapeHtml(pc.nama || '')}" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500 transition-colors">
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">IP Address</label>
                            <input type="text" id="edit-pc-ip" value="${pc.ip_address || ''}" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 font-mono focus:outline-none focus:border-neutral-500 transition-colors">
                        </div>
                        <div>
                            <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">MAC Address</label>
                            <input type="text" id="edit-pc-mac" value="${pc.mac_address || ''}" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 font-mono uppercase focus:outline-none focus:border-neutral-500 transition-colors">
                        </div>
                    </div>
                </div>
                <div class="flex gap-3 justify-end mt-6 pt-4 border-t border-[#2a2a2a]">
                    <button onclick="Modal.closeModal()" class="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs lg:text-base font-bold rounded-lg transition-colors">Batal</button>
                    <button onclick="PC.doEdit(${pc.id})" class="px-5 py-2.5 bg-neutral-100 hover:bg-white text-black text-xs lg:text-base font-bold rounded-lg transition-colors">Simpan</button>
                </div>
            </div>`;
        Modal.show(formHtml, null, { disableBackdropClose: true });
    }
};

window.PCModal = PCModal;
