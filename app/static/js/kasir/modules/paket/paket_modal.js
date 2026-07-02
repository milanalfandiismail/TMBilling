// app/static/js/kasir/modules/paket/paket_modal.js
// Mintlify Dark — modal style konsisten

const PaketModal = {
    async showAddModal() {
        let grupOptions = '<option value="">- Pilih Grup -</option>';
        try {
            const grupResponse = await API.grup.list();
            const groups = grupResponse.grup || [];
            grupOptions = groups.map(g => `<option value="${g.nama}">${g.nama.toUpperCase()}</option>`).join('');
        } catch (_) {}

        const bodyHtml = `
            <div class="space-y-4">
                <div>
                    <label class="text-xs font-medium text-neutral-400 block">Nama Paket <span class="text-red-400">*</span></label>
                    <input type="text" id="modal-paket-nama" placeholder="REGULER - 3 Jam"
                        class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">
                    <p class="text-xs text-neutral-500 mt-1">Nama akan terisi otomatis saat Grup & Durasi dipilih</p>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs font-medium text-neutral-400 block">Grup PC <span class="text-red-400">*</span></label>
                        <select id="modal-paket-grup" onchange="Paket.suggestNameModal()"
                            class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">${grupOptions}</select>
                    </div>
                    <div>
                        <label class="text-xs font-medium text-neutral-400 block">Durasi (menit) <span class="text-red-400">*</span></label>
                        <input type="number" id="modal-paket-durasi" oninput="Paket.suggestNameModal()" placeholder="180"
                            class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs font-medium text-neutral-400 block">Harga (Rp) <span class="text-red-400">*</span></label>
                        <input type="text" id="modal-paket-harga" required inputmode="numeric" oninput="Utils.formatInputRupiah(this)" placeholder="12.000"
                            class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono">
                    </div>
                    <div>
                        <label class="text-xs font-medium text-neutral-400 block">Masa Aktif (hari)</label>
                        <input type="number" id="modal-paket-kadaluarsa" value="30"
                            class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">
                    </div>
                </div>
            </div>`;

        const modalHtml = UI.modalWrapper({
            icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>',
            title: 'Tambah Paket Billing',
            subtitle: 'Buat paket waktu bermain baru',
            body: bodyHtml,
            footer: `
                <button onclick="Modal.closeModal()" class="px-4 py-2 text-sm font-medium text-neutral-400 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 rounded-lg transition-colors">Batal</button>
                <button onclick="Paket.add()" class="px-4 py-2 text-sm font-medium text-black bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                    Tambah Paket
                </button>`,
        });

        Modal.show(modalHtml, null, { disableBackdropClose: true });
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

        const bodyHtml = `
            <div class="space-y-4">
                <div>
                    <label class="text-xs font-medium text-neutral-400 block">Nama Paket</label>
                    <input type="text" id="edit-paket-nama" value="${Utils.escapeHtml(paket.nama)}"
                        class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-xs font-medium text-neutral-400 block">Durasi (menit)</label>
                        <input type="number" id="edit-paket-durasi" value="${paket.durasi_menit}"
                            class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">
                    </div>
                    <div>
                        <label class="text-xs font-medium text-neutral-400 block">Harga (Rp)</label>
                        <input type="text" id="edit-paket-harga" value="${Utils.formatRawRupiah(paket.harga)}" required inputmode="numeric" oninput="Utils.formatInputRupiah(this)"
                            class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono font-medium">
                    </div>
                </div>
                <div>
                    <label class="text-xs font-medium text-neutral-400 block">Masa Aktif (hari)</label>
                    <input type="number" id="edit-paket-kadaluarsa" value="${paket.kadaluarsa_hari || 30}"
                        class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all">
                </div>
            </div>`;

        const modalHtml = UI.modalWrapper({
            icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>',
            title: 'Edit Paket',
            subtitle: `${paket.nama.toUpperCase()}`,
            body: bodyHtml,
            footer: `
                <button onclick="Modal.closeModal()" class="px-4 py-2 text-sm font-medium text-neutral-400 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 rounded-lg transition-colors">Batal</button>
                <button onclick="Paket.doEdit(${paket.id})" class="px-4 py-2 text-sm font-medium text-black bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors">Simpan</button>`,
        });

        Modal.show(modalHtml, null, { disableBackdropClose: true });
    }
};

window.PaketModal = PaketModal;
