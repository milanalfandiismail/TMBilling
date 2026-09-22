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
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl p-5 sm:p-6 lg:p-7 xl:p-8 max-w-xl lg:max-w-2xl xl:max-w-3xl 2xl:max-w-4xl w-[calc(100%-2rem)] mx-auto md:w-full shadow-2xl">
                <div class="flex items-center justify-between mb-4 lg:mb-6 pb-3.5 lg:pb-4 border-b border-[#2a2a2a]">
                    <div>
                        <h3 class="text-sm sm:text-base lg:text-lg xl:text-xl font-bold text-neutral-100 tracking-wide">Tambah Unit PC</h3>
                        <p class="text-[10px] sm:text-xs lg:text-xs xl:text-sm text-neutral-500 mt-0.5">Registrasi stasiun warnet baru dengan auto-format kode</p>
                    </div>
                    <button onclick="Modal.closeModal()" class="w-8 h-8 lg:w-9 lg:h-9 xl:w-10 xl:h-10 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 hover:text-neutral-100 hover:bg-[#222] transition-colors flex items-center justify-center text-lg lg:text-xl leading-none">&times;</button>
                </div>
                <div class="space-y-3.5 lg:space-y-4 xl:space-y-5">
                    <!-- Row 1: Prefix, Nomor Unit, Grup (3 Kolom Selaras) -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4 xl:gap-5">
                        <div>
                            <label class="text-[9px] sm:text-[10px] lg:text-xs xl:text-sm text-neutral-400 mb-1.5 lg:mb-2 block uppercase font-bold tracking-wider truncate">Prefix Nama (Maks 6) <span class="text-red-400">*</span></label>
                            <input type="text" id="modal-pc-prefix" maxlength="6" value="PC" placeholder="PC" oninput="PC.updateAddPreview()" class="w-full px-3 py-2.5 lg:px-4 lg:py-3 xl:px-4.5 xl:py-3.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-sm xl:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 transition-all uppercase font-bold font-mono">
                        </div>
                        <div>
                            <label class="text-[9px] sm:text-[10px] lg:text-xs xl:text-sm text-neutral-400 mb-1.5 lg:mb-2 block uppercase font-bold tracking-wider truncate">Nomor Unit (Maks 4) <span class="text-red-400">*</span></label>
                            <input type="number" id="modal-pc-number" value="1" min="1" max="9999" placeholder="1" oninput="if(this.value.length > 4) this.value = this.value.slice(0, 4); PC.updateAddPreview()" class="w-full px-3 py-2.5 lg:px-4 lg:py-3 xl:px-4.5 xl:py-3.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-sm xl:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 transition-all font-bold font-mono">
                        </div>
                        <div>
                            <label class="text-[9px] sm:text-[10px] lg:text-xs xl:text-sm text-neutral-400 mb-1.5 lg:mb-2 block uppercase font-bold tracking-wider truncate">Grup Unit</label>
                            <select id="modal-pc-grup" class="w-full px-3 py-2.5 lg:px-4 lg:py-3 xl:px-4.5 xl:py-3.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-sm xl:text-base text-neutral-200 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 transition-all">${grupOptions}</select>
                        </div>
                    </div>

                    <!-- Live Preview Box -->
                    <div class="px-3.5 py-2.5 lg:px-4.5 lg:py-3 xl:px-5 xl:py-3.5 bg-[#0c0c0c] border border-[#1f1f1f] rounded-lg flex items-center justify-between">
                        <span class="text-[10px] sm:text-xs lg:text-xs xl:text-sm uppercase font-bold text-neutral-400">Preview Kode PC:</span>
                        <span id="modal-pc-preview" class="text-xs lg:text-sm xl:text-base font-black font-mono text-emerald-400 bg-emerald-950/40 px-3 py-1 rounded border border-emerald-500/30 tracking-tight">PC-1</span>
                    </div>

                    <!-- Row 2: IP Address, MAC Address, Nama Tampil (3 Kolom Selaras) -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4 xl:gap-5">
                        <div>
                            <label class="text-[9px] sm:text-[10px] lg:text-xs xl:text-sm text-neutral-400 mb-1.5 lg:mb-2 block uppercase font-bold tracking-wider truncate">IP Address</label>
                            <input type="text" id="modal-pc-ip" placeholder="192.168.1.101" class="w-full px-3 py-2.5 lg:px-4 lg:py-3 xl:px-4.5 xl:py-3.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-sm xl:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 transition-all font-mono">
                        </div>
                        <div>
                            <label class="text-[9px] sm:text-[10px] lg:text-xs xl:text-sm text-neutral-400 mb-1.5 lg:mb-2 block uppercase font-bold tracking-wider truncate">MAC Address (Opsional)</label>
                            <input type="text" id="modal-pc-mac" placeholder="AA:BB:CC:DD:EE:FF" class="w-full px-3 py-2.5 lg:px-4 lg:py-3 xl:px-4.5 xl:py-3.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-sm xl:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 transition-all font-mono uppercase">
                        </div>
                        <div>
                            <label class="text-[9px] sm:text-[10px] lg:text-xs xl:text-sm text-neutral-400 mb-1.5 lg:mb-2 block uppercase font-bold tracking-wider truncate">Nama Tampil (Opsional)</label>
                            <input type="text" id="modal-pc-nama" placeholder="Ikuti Kode PC" class="w-full px-3 py-2.5 lg:px-4 lg:py-3 xl:px-4.5 xl:py-3.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-sm xl:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 transition-all">
                        </div>
                    </div>
                </div>
                <div class="flex gap-3 justify-end mt-6 lg:mt-7 xl:mt-8 pt-4 lg:pt-5 border-t border-[#2a2a2a]">
                    <button onclick="Modal.closeModal()" class="px-4 py-2.5 lg:px-5 lg:py-3 xl:px-6 xl:py-3.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs lg:text-sm xl:text-base font-bold rounded-lg transition-colors">Batal</button>
                    <button onclick="PC.add()" class="px-5 py-2.5 lg:px-6 lg:py-3 xl:px-7 xl:py-3.5 bg-neutral-100 hover:bg-white text-black text-xs lg:text-sm xl:text-base font-bold rounded-lg transition-colors flex items-center gap-2">
                        <svg class="w-3.5 h-3.5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        Tambah PC
                    </button>
                </div>
            </div>`;
        Modal.show(formHtml, null, { disableBackdropClose: true });
        PC.updateAddPreview();
    },

    async showAddBatchModal() {
        let grupOptions = '<option value="">- Pilih Grup -</option>';
        try {
            const grupResponse = await API.grup.list();
            const groups = grupResponse.grup || [];
            grupOptions = groups.map(g => `<option value="${g.nama}">${g.nama.toUpperCase()}</option>`).join('');
        } catch (_) {}

        const formHtml = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl p-5 sm:p-6 lg:p-7 xl:p-8 max-w-xl lg:max-w-2xl xl:max-w-3xl 2xl:max-w-4xl w-[calc(100%-2rem)] mx-auto md:w-full shadow-2xl">
                <div class="flex items-center justify-between mb-4 lg:mb-6 pb-3.5 lg:pb-4 border-b border-[#2a2a2a]">
                    <div>
                        <h3 class="text-sm sm:text-base lg:text-lg xl:text-xl font-bold text-neutral-100 tracking-wide">Tambah Massal (Batch)</h3>
                        <p class="text-[10px] sm:text-xs lg:text-xs xl:text-sm text-neutral-500 mt-0.5">Registrasi beberapa PC sekaligus dengan auto-dash & rentang IP otomatis</p>
                    </div>
                    <button onclick="Modal.closeModal()" class="w-8 h-8 lg:w-9 lg:h-9 xl:w-10 xl:h-10 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 hover:text-neutral-100 hover:bg-[#222] transition-colors flex items-center justify-center text-lg lg:text-xl leading-none">&times;</button>
                </div>
                <div class="space-y-3.5 lg:space-y-4 xl:space-y-5">
                    <!-- Row 1: Prefix, No Mulai, No Akhir (3 Kolom Selaras) -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4 xl:gap-5">
                        <div>
                            <label class="text-[9px] sm:text-[10px] lg:text-xs xl:text-sm text-neutral-400 mb-1.5 lg:mb-2 block uppercase font-bold tracking-wider truncate">Prefix Nama (Maks 6) <span class="text-red-400">*</span></label>
                            <input type="text" id="modal-batch-prefix" maxlength="6" value="PC" placeholder="PC" oninput="PC.updateBatchPreview()" class="w-full px-3 py-2.5 lg:px-4 lg:py-3 xl:px-4.5 xl:py-3.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-sm xl:text-base text-neutral-200 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 transition-all uppercase font-bold font-mono">
                        </div>
                        <div>
                            <label class="text-[9px] sm:text-[10px] lg:text-xs xl:text-sm text-neutral-400 mb-1.5 lg:mb-2 block uppercase font-bold tracking-wider truncate">No Mulai (Maks 4) <span class="text-red-400">*</span></label>
                            <input type="number" id="modal-batch-start" value="1" min="1" max="9999" oninput="if(this.value.length > 4) this.value = this.value.slice(0, 4); PC.updateBatchPreview()" class="w-full px-3 py-2.5 lg:px-4 lg:py-3 xl:px-4.5 xl:py-3.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-sm xl:text-base text-neutral-200 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 transition-all font-bold font-mono">
                        </div>
                        <div>
                            <label class="text-[9px] sm:text-[10px] lg:text-xs xl:text-sm text-neutral-400 mb-1.5 lg:mb-2 block uppercase font-bold tracking-wider truncate">No Akhir (Maks 4) <span class="text-red-400">*</span></label>
                            <input type="number" id="modal-batch-end" value="10" min="1" max="9999" oninput="if(this.value.length > 4) this.value = this.value.slice(0, 4); PC.updateBatchPreview()" class="w-full px-3 py-2.5 lg:px-4 lg:py-3 xl:px-4.5 xl:py-3.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-sm xl:text-base text-neutral-200 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 transition-all font-bold font-mono">
                        </div>
                    </div>

                    <!-- Live Preview Box -->
                    <div class="px-3.5 py-2.5 lg:px-4.5 lg:py-3 xl:px-5 xl:py-3.5 bg-[#0c0c0c] border border-[#1f1f1f] rounded-lg flex items-center justify-between">
                        <span class="text-[10px] sm:text-xs lg:text-xs xl:text-sm uppercase font-bold text-neutral-400">Preview Rentang Kode:</span>
                        <span id="modal-batch-preview" class="text-xs lg:text-sm xl:text-base font-black font-mono text-emerald-400 bg-emerald-950/40 px-3 py-1 rounded border border-emerald-500/30 tracking-tight">PC-1 s/d PC-10 (10 Unit)</span>
                    </div>

                    <!-- Row 2: IP Awal, IP Akhir, Grup Unit (3 Kolom Selaras) -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4 xl:gap-5">
                        <div>
                            <label class="text-[9px] sm:text-[10px] lg:text-xs xl:text-sm text-neutral-400 mb-1.5 lg:mb-2 block uppercase font-bold tracking-wider truncate">IP Awal <span class="text-red-400">*</span></label>
                            <input type="text" id="modal-batch-ip-start" placeholder="192.168.1.101" oninput="PC.updateBatchPreview()" class="w-full px-3 py-2.5 lg:px-4 lg:py-3 xl:px-4.5 xl:py-3.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-sm xl:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 transition-all font-mono">
                        </div>
                        <div>
                            <label class="text-[9px] sm:text-[10px] lg:text-xs xl:text-sm text-neutral-400 mb-1.5 lg:mb-2 block uppercase font-bold tracking-wider truncate">IP Akhir <span class="text-red-400">*</span></label>
                            <input type="text" id="modal-batch-ip-end" placeholder="192.168.1.110" oninput="PC.updateBatchPreview()" class="w-full px-3 py-2.5 lg:px-4 lg:py-3 xl:px-4.5 xl:py-3.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-sm xl:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 transition-all font-mono">
                        </div>
                        <div>
                            <label class="text-[9px] sm:text-[10px] lg:text-xs xl:text-sm text-neutral-400 mb-1.5 lg:mb-2 block uppercase font-bold tracking-wider truncate">Grup Unit</label>
                            <select id="modal-batch-grup" class="w-full px-3 py-2.5 lg:px-4 lg:py-3 xl:px-4.5 xl:py-3.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-sm xl:text-base text-neutral-200 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 transition-all">${grupOptions}</select>
                        </div>
                    </div>
                </div>
                <div class="flex gap-3 justify-end mt-6 lg:mt-7 xl:mt-8 pt-4 lg:pt-5 border-t border-[#2a2a2a]">
                    <button onclick="Modal.closeModal()" class="px-4 py-2.5 lg:px-5 lg:py-3 xl:px-6 xl:py-3.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs lg:text-sm xl:text-base font-bold rounded-lg transition-colors">Batal</button>
                    <button onclick="PC.addBatch()" class="px-5 py-2.5 lg:px-6 lg:py-3 xl:px-7 xl:py-3.5 bg-neutral-100 hover:bg-white text-black text-xs lg:text-sm xl:text-base font-bold rounded-lg transition-colors flex items-center gap-2">
                        <svg class="w-3.5 h-3.5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z"></path></svg>
                        Daftarkan Batch PC
                    </button>
                </div>
            </div>`;
        Modal.show(formHtml, null, { disableBackdropClose: true });
        PC.updateBatchPreview();
    },

    showEditModal(pc, groups) {
        const grupOptions = groups.map(g => `<option value="${g.nama}" ${pc.grup === g.nama ? 'selected' : ''}>${g.nama.toUpperCase()}</option>`).join('');
        const formHtml = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl p-5 sm:p-6 lg:p-7 xl:p-8 max-w-xl lg:max-w-2xl xl:max-w-3xl 2xl:max-w-4xl w-[calc(100%-2rem)] mx-auto md:w-full shadow-2xl">
                <div class="flex items-center justify-between mb-4 lg:mb-6 pb-3.5 lg:pb-4 border-b border-[#2a2a2a]">
                    <div><h3 class="text-sm sm:text-base lg:text-lg xl:text-xl font-bold text-neutral-100 tracking-wide">Edit PC</h3><p class="text-[10px] sm:text-xs lg:text-xs xl:text-sm text-neutral-500 font-mono mt-0.5">${pc.kode}</p></div>
                    <button onclick="Modal.closeModal()" class="w-8 h-8 lg:w-9 lg:h-9 xl:w-10 xl:h-10 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 hover:text-neutral-100 hover:bg-[#222] transition-colors flex items-center justify-center text-lg lg:text-xl leading-none">&times;</button>
                </div>
                <div class="space-y-3.5 lg:space-y-4 xl:space-y-5">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4 xl:gap-5">
                        <div>
                            <label class="text-[9px] sm:text-[10px] lg:text-xs xl:text-sm text-neutral-400 mb-1.5 lg:mb-2 block uppercase font-bold tracking-wider truncate">Kode PC (Maks 11) <span class="text-red-400">*</span></label>
                            <input type="text" id="edit-pc-kode" maxlength="11" value="${pc.kode}" class="w-full px-3 py-2.5 lg:px-4 lg:py-3 xl:px-4.5 xl:py-3.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-sm xl:text-base text-neutral-200 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 transition-all uppercase font-bold font-mono">
                        </div>
                        <div>
                            <label class="text-[9px] sm:text-[10px] lg:text-xs xl:text-sm text-neutral-400 mb-1.5 lg:mb-2 block uppercase font-bold tracking-wider truncate">Grup Unit</label>
                            <select id="edit-pc-grup" class="w-full px-3 py-2.5 lg:px-4 lg:py-3 xl:px-4.5 xl:py-3.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-sm xl:text-base text-neutral-200 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 transition-all">${grupOptions}</select>
                        </div>
                    </div>
                    <div>
                        <label class="text-[9px] sm:text-[10px] lg:text-xs xl:text-sm text-neutral-400 mb-1.5 lg:mb-2 block uppercase font-bold tracking-wider truncate">Nama Unit</label>
                        <input type="text" id="edit-pc-nama" value="${Utils.escapeHtml(pc.nama || '')}" class="w-full px-3 py-2.5 lg:px-4 lg:py-3 xl:px-4.5 xl:py-3.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-sm xl:text-base text-neutral-200 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 transition-all">
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4 xl:gap-5">
                        <div>
                            <label class="text-[9px] sm:text-[10px] lg:text-xs xl:text-sm text-neutral-400 mb-1.5 lg:mb-2 block uppercase font-bold tracking-wider truncate">IP Address</label>
                            <input type="text" id="edit-pc-ip" value="${pc.ip_address || ''}" class="w-full px-3 py-2.5 lg:px-4 lg:py-3 xl:px-4.5 xl:py-3.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-sm xl:text-base text-neutral-200 font-mono focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 transition-all">
                        </div>
                        <div>
                            <label class="text-[9px] sm:text-[10px] lg:text-xs xl:text-sm text-neutral-400 mb-1.5 lg:mb-2 block uppercase font-bold tracking-wider truncate">MAC Address</label>
                            <input type="text" id="edit-pc-mac" value="${pc.mac_address || ''}" class="w-full px-3 py-2.5 lg:px-4 lg:py-3 xl:px-4.5 xl:py-3.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-sm xl:text-base text-neutral-200 font-mono uppercase focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 transition-all">
                        </div>
                    </div>
                </div>
                <div class="flex gap-3 justify-end mt-6 lg:mt-7 xl:mt-8 pt-4 lg:pt-5 border-t border-[#2a2a2a]">
                    <button onclick="Modal.closeModal()" class="px-4 py-2.5 lg:px-5 lg:py-3 xl:px-6 xl:py-3.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs lg:text-sm xl:text-base font-bold rounded-lg transition-colors">Batal</button>
                    <button onclick="PC.doEdit(${pc.id})" class="px-5 py-2.5 lg:px-6 lg:py-3 xl:px-7 xl:py-3.5 bg-neutral-100 hover:bg-white text-black text-xs lg:text-sm xl:text-base font-bold rounded-lg transition-colors">Simpan</button>
                </div>
            </div>`;
        Modal.show(formHtml, null, { disableBackdropClose: true });
    }
};

window.PCModal = PCModal;
