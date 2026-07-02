const BukaModal = {
    pcKode: null,
    pcGrup: null,

    async open(pcKode, pcGrup) {
        this.pcKode = pcKode;
        this.pcGrup = pcGrup;

        const modalHtml = `
            <div class="bg-[#0c0c0c] border border-neutral-800 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-xl">
                <!-- Header -->
                <div class="flex items-center justify-between px-5 py-4 border-b border-neutral-800 shrink-0">
                    <div>
                        <h3 class="text-sm font-semibold text-neutral-100">Buka Sesi Billing</h3>
                        <p class="text-xs text-neutral-500 mt-0.5 font-mono">PC ${pcKode} · ${pcGrup.toUpperCase()}</p>
                    </div>
                    <button onclick="Modal.closeModal()" class="w-7 h-7 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-neutral-100 transition-colors flex items-center justify-center">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <!-- Body -->
                <div class="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-mono">
                    <!-- Guest Name -->
                    <div>
                        <label class="text-xs font-medium text-neutral-400 mb-1.5 block">Nama Tamu / Guest</label>
                        <input type="text" id="buka-guest" value="Guest${String(Math.floor(Math.random() * 9000) + 1000)}"
                            class="w-full h-10 px-3 bg-[#050505] border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono">
                    </div>

                    <!-- Paket Grid -->
                    <div>
                        <label class="text-xs font-medium text-neutral-400 mb-3 block">Pilih Paket Billing</label>
                        <div id="paket-grid-container" class="grid grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1 scrollbar-mono">
                            <div class="col-span-2 flex items-center justify-center py-8 text-neutral-500 text-xs">
                                <div class="w-4 h-4 border-2 border-neutral-600 border-t-neutral-100 rounded-full animate-spin mr-2"></div>
                                Memuat paket...
                            </div>
                        </div>
                        <input type="hidden" id="buka-paket" value="">
                    </div>
                </div>

                <!-- Footer -->
                <div class="flex gap-2 justify-end px-5 py-4 border-t border-neutral-800 bg-[#080808] shrink-0">
                    <button onclick="Modal.closeModal()" class="px-4 py-2 text-sm font-medium text-neutral-400 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 rounded-lg transition-colors">Batal</button>
                    <button onclick="BukaModal.submit()" class="px-4 py-2 text-sm font-medium text-black bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors">Mulai Sesi</button>
                </div>
            </div>
        `;

        Modal.show(modalHtml);
        await this.loadPaket();
    },

    async loadPaket() {
        const grid = document.getElementById('paket-grid-container');
        if (!grid) return;

        try {
            const data = await API.paket.list({ aktif_only: true });
            const allPaket = Array.isArray(data) ? data : (data.paket || data.paket_list || []);

            let filteredPaket = [];
            if (this.pcGrup) {
                const targetGrup = String(this.pcGrup).toLowerCase();
                filteredPaket = allPaket.filter(p => {
                    const pg = String(p.grup || '').toLowerCase();
                    if (targetGrup === 'reguler') return pg === 'reguler' || pg === '';
                    return pg === targetGrup;
                });
            }

            if (filteredPaket.length === 0) {
                grid.innerHTML = `<div class="col-span-2 py-8 text-center text-neutral-500 text-xs">Tidak ada paket aktif untuk zona ${String(this.pcGrup).toUpperCase()}</div>`;
                return;
            }

            grid.innerHTML = filteredPaket.map((p, i) => {
                const durasi = p.durasi || p.durasi_menit || 0;
                const durasiText = Utils.formatDurasiFriendly(durasi);
                const harga = Utils.formatRupiah(p.harga || 0);

                return `
                    <div onclick="BukaModal.selectPaket(this, ${p.id})"
                        class="paket-card border border-neutral-700 bg-[#080808] rounded-xl p-3 cursor-pointer transition-all hover:border-emerald-500/50 flex flex-col gap-2"
                        data-paket-id="${p.id}">
                        <div class="flex items-start justify-between gap-2">
                            <span class="text-xs font-semibold text-neutral-200 leading-tight line-clamp-2">${p.nama}</span>
                            <span class="check-indicator w-4 h-4 rounded-full border-2 border-neutral-700 flex items-center justify-center text-[8px] font-bold text-transparent shrink-0 mt-0.5">✓</span>
                        </div>
                        <div class="flex items-center justify-between mt-auto">
                            <span class="text-[10px] text-neutral-500 font-mono flex items-center gap-1">
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                ${durasiText}
                            </span>
                            <span class="text-xs font-bold text-emerald-400 font-mono">${harga}</span>
                        </div>
                    </div>
                `;
            }).join('');

            // Select first
            const first = grid.querySelector('.paket-card');
            if (first) this.selectPaket(first, filteredPaket[0].id);

        } catch (err) {
            grid.innerHTML = '<div class="col-span-2 py-8 text-center text-red-400 text-xs">Gagal memuat paket</div>';
            Toast.error('Gagal memuat daftar paket');
        }
    },

    selectPaket(card, paketId) {
        document.querySelectorAll('.paket-card').forEach(el => {
            el.classList.remove('border-emerald-500', 'bg-emerald-500/5');
            el.classList.add('border-neutral-700', 'bg-[#080808]');
            const c = el.querySelector('.check-indicator');
            if (c) { c.classList.remove('bg-emerald-500', 'border-emerald-500', 'text-white'); c.classList.add('border-neutral-700', 'text-transparent'); }
        });

        card.classList.add('border-emerald-500', 'bg-emerald-500/5');
        card.classList.remove('border-neutral-700', 'bg-[#080808]');
        const c = card.querySelector('.check-indicator');
        if (c) { c.classList.add('bg-emerald-500', 'border-emerald-500', 'text-white'); c.classList.remove('border-neutral-700', 'text-transparent'); }

        const hiddenInput = document.getElementById('buka-paket');
        if (hiddenInput) hiddenInput.value = String(paketId);
    },

    async submit() {
        let paketId = document.getElementById('buka-paket')?.value;
        if (!paketId) {
            const selected = document.querySelector('.paket-card.border-emerald-500');
            if (selected) paketId = selected.dataset.paketId;
        }

        const inputGuest = document.getElementById('buka-guest');
        const namaGuest = (inputGuest ? inputGuest.value.trim() : '') || 'Guest' + String(Math.floor(Math.random() * 9000) + 1000);

        if (!paketId) return Toast.error('Pilih paket terlebih dahulu');

        try {
            await API.sesi.bukaGuest(this.pcKode, paketId, namaGuest);
            Toast.success('Sesi guest dibuka di PC ' + this.pcKode);
            Modal.closeModal();
            if (typeof Dashboard !== 'undefined') Dashboard.load();
        } catch (err) {
            Toast.error(err.message);
        }
    }
};

window.BukaModal = BukaModal;
