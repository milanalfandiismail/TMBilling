// app/static/js/kasir/modules/paket/paket_modal.js

const PaketModal = {
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
                        <h3 class="text-sm font-bold text-neutral-100 tracking-wide">Tambah Paket Billing</h3>
                        <p class="text-[10px] lg:text-base text-neutral-500 mt-0.5">Buat paket waktu bermain baru untuk grup PC</p>
                    </div>
                    <button onclick="Modal.closeModal()" class="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 hover:text-neutral-100 hover:bg-[#222] transition-colors flex items-center justify-center text-lg leading-none">&times;</button>
                </div>
                <div class="space-y-4">
                    <div>
                        <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Nama Paket <span class="text-red-400">*</span></label>
                        <input type="text" id="modal-paket-nama" placeholder="Misal: REGULER - 3 Jam" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors">
                        <p class="text-[9px] lg:text-base text-neutral-600 mt-1">Nama akan terisi otomatis saat Grup & Durasi dipilih</p>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Grup PC <span class="text-red-400">*</span></label>
                            <select id="modal-paket-grup" onchange="Paket.suggestNameModal()" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500 transition-colors">${grupOptions}</select>
                        </div>
                        <div>
                            <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Durasi (menit) <span class="text-red-400">*</span></label>
                            <input type="number" id="modal-paket-durasi" oninput="Paket.suggestNameModal()" placeholder="Contoh: 180" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors">
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Harga (Rp) <span class="text-red-400">*</span></label>
                            <input type="text" id="modal-paket-harga" required inputmode="numeric" oninput="Utils.formatInputRupiah(this)" placeholder="Contoh: 12.000" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors font-mono">
                        </div>
                        <div>
                            <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Masa Aktif (hari)</label>
                            <input type="number" id="modal-paket-kadaluarsa" value="30" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500 transition-colors">
                        </div>
                    </div>
                </div>
                <div class="flex gap-3 justify-end mt-6 pt-4 border-t border-[#2a2a2a]">
                    <button onclick="Modal.closeModal()" class="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs lg:text-base font-bold rounded-lg transition-colors">Batal</button>
                    <button onclick="Paket.add()" class="px-5 py-2.5 bg-neutral-100 hover:bg-white text-black text-xs lg:text-base font-bold rounded-lg transition-colors flex items-center gap-2">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        Tambah Paket
                    </button>
                </div>
            </div>`;
        Modal.show(formHtml, null, { disableBackdropClose: true });
    },

    suggestNameModal() {
        const grupEl = document.getElementById('modal-paket-grup');
        const durasiEl = document.getElementById('modal-paket-durasi');
        const namaEl = document.getElementById('modal-paket-nama');
        if (!grupEl || !durasiEl || !namaEl) return;
        const grup = grupEl.value;
        const durasi = parseInt(durasiEl.value);
        if (grup && !isNaN(durasi)) {
            let textDurasi = "";
            if (durasi >= 60) {
                const jam = durasi / 60;
                textDurasi = Number.isInteger(jam) ? `${jam} Jam` : `${jam.toFixed(1)} Jam`;
            } else {
                textDurasi = `${durasi} Menit`;
            }
            namaEl.value = `${grup.toUpperCase()} - ${textDurasi}`;
        }
    },

    showEditModal(paket, groups) {
        const grupOptions = groups.map(g => `<option value="${g.nama}" ${paket.grup === g.nama ? 'selected' : ''}>${g.nama.toUpperCase()}</option>`).join('');
        const formHtml = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl p-6 max-w-md w-[calc(100%-2rem)] mx-auto md:w-full shadow-2xl">
                <div class="flex items-center justify-between mb-5 pb-4 border-b border-[#2a2a2a]">
                    <div><h3 class="text-sm font-bold text-neutral-100 tracking-wide">Edit Paket</h3><p class="text-[10px] lg:text-base text-neutral-500 font-mono mt-0.5">${paket.nama.toUpperCase()}</p></div>
                    <button onclick="Modal.closeModal()" class="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 hover:text-neutral-100 hover:bg-[#222] transition-colors flex items-center justify-center text-lg leading-none">&times;</button>
                </div>
                <div class="space-y-4">
                    <div>
                        <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Nama Paket</label>
                        <input type="text" id="edit-paket-nama" value="${Utils.escapeHtml(paket.nama)}" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500 transition-colors">
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Durasi (menit)</label>
                            <input type="number" id="edit-paket-durasi" value="${paket.durasi_menit}" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500 transition-colors">
                        </div>
                        <div>
                            <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Harga (Rp)</label>
                            <input type="text" id="edit-paket-harga" value="${Utils.formatRawRupiah(paket.harga)}" required inputmode="numeric" oninput="Utils.formatInputRupiah(this)" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500 transition-colors font-mono font-bold">
                        </div>
                    </div>
                    <div>
                        <label class="text-[9px] lg:text-base text-neutral-500 mb-1.5 block uppercase font-bold tracking-wider">Masa Aktif (hari)</label>
                        <input type="number" id="edit-paket-kadaluarsa" value="${paket.kadaluarsa_hari || 30}" class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500 transition-colors">
                    </div>
                </div>
                <div class="flex gap-3 justify-end mt-6 pt-4 border-t border-[#2a2a2a]">
                    <button onclick="Modal.closeModal()" class="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs lg:text-base font-bold rounded-lg transition-colors">Batal</button>
                    <button onclick="Paket.doEdit(${paket.id})" class="px-5 py-2.5 bg-neutral-100 hover:bg-white text-black text-xs lg:text-base font-bold rounded-lg transition-colors">Simpan</button>
                </div>
            </div>`;
        Modal.show(formHtml, null, { disableBackdropClose: true });
    }
};

window.PaketModal = PaketModal;
