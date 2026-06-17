const BukaModal = {
    pcKode: null,
    pcGrup: null,

    async open(pcKode, pcGrup) {
        this.pcKode = pcKode;
        this.pcGrup = pcGrup;

        const modalHtml = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl p-6 max-w-md w-[calc(100%-2rem)] mx-auto md:w-full relative shadow-2xl">
                <div class="flex items-center justify-between mb-4 pb-3 border-b border-[#2a2a2a]">
                    <div>
                        <h3 class="text-sm font-bold text-neutral-100">BUKA SESI BILLING</h3>
                        <p class="text-[10px] text-neutral-500 mt-0.5 font-mono">PC ${pcKode} &middot; ${pcGrup.toUpperCase()}</p>
                    </div>
                    <button onclick="BukaModal.closeModalSafe()" class="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 hover:text-neutral-100 hover:bg-[#222] transition-colors flex items-center justify-center text-lg leading-none">&times;</button>
                </div>

                <div class="space-y-4">
                    <div>
                        <label class="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mb-1 block">Nama Tamu / Guest</label>
                        <input type="text" id="buka-guest" value="Guest${String(Math.floor(Math.random() * 9000) + 1000)}" 
                            class="w-full px-3 py-2 bg-[#050505] border border-[#1c1c1c] rounded text-xs text-neutral-200 focus:outline-none focus:border-neutral-400 font-bold font-mono">
                    </div>
                    <div>
                        <label class="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mb-2 block">Pilih Paket Billing (Satu Klik)</label>
                        <div id="paket-grid-container" class="space-y-2 max-h-56 overflow-y-auto pr-1 scrollbar-mono">
                            <div class="flex items-center justify-center py-8 text-neutral-500 text-xs">
                                <div class="w-4 h-4 border-2 border-neutral-600 border-t-neutral-100 rounded-full animate-spin mr-2"></div>
                                Memuat paket...
                            </div>
                        </div>
                        <input type="hidden" id="buka-paket" value="">
                    </div>
                </div>

                <div class="flex gap-3 justify-end mt-6 pt-4 border-t border-[#2a2a2a]">
                    <button onclick="BukaModal.closeModalSafe()" class="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs font-bold rounded-lg transition-colors">Batal</button>
                    <button onclick="BukaModal.submit()" class="px-5 py-2.5 bg-neutral-100 text-[#050505] hover:bg-white text-xs font-bold rounded-lg transition-colors uppercase font-bold">Mulai Sesi</button>
                </div>
            </div>
        `;
        
        Modal.show(modalHtml);
        await this.loadPaket();
    },

    closeModalSafe() {
        Modal.closeModal();
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
                    if (targetGrup === 'reguler') {
                        return pg === 'reguler' || pg === '';
                    }
                    return pg === targetGrup;
                });
            }

            if (filteredPaket.length === 0) {
                grid.innerHTML = `<div class="py-6 text-center text-neutral-500 text-xs">Tidak ada paket aktif untuk zona ${String(this.pcGrup).toUpperCase()}</div>`;
                return;
            }

            grid.innerHTML = filteredPaket.map((p, i) => {
                const durasi = p.durasi || p.durasi_menit || 0;
                const durasiText = Utils.formatDurasiFriendly(durasi);
                
                return `
                    <div onclick="BukaModal.selectPaketCard(this, ${p.id})" 
                        class="paket-card relative border border-[#2a2a2a] bg-[#141414] rounded-lg p-3 cursor-pointer text-left transition-all hover:border-neutral-400 flex items-center justify-between gap-4"
                        data-paket-id="${p.id}">
                        <div class="flex items-center gap-3 min-w-0 flex-1">
                            <div class="check-indicator w-3.5 h-3.5 rounded-full border border-[#2a2a2a] flex items-center justify-center text-[8px] font-black text-transparent transition-all select-none shrink-0">✓</div>
                            <div class="min-w-0 flex-1 flex flex-col justify-center">
                                <span class="text-xs font-bold text-neutral-200 break-words whitespace-normal pr-2" title="${p.nama}">${p.nama}</span>
                                <span class="text-[9px] text-neutral-500 font-mono mt-0.5">${durasiText}</span>
                            </div>
                        </div>
                        <div class="text-xs font-bold text-emerald-400 font-mono shrink-0">${Utils.formatRupiah(p.harga || 0)}</div>
                    </div>
                `;
            }).join('');

            // Select first option by default
            if (filteredPaket.length > 0) {
                const firstCard = grid.querySelector('.paket-card');
                if (firstCard) {
                    BukaModal.selectPaketCard(firstCard, filteredPaket[0].id);
                }
            }

        } catch (err) {
            grid.innerHTML = '<div class="py-6 text-center text-red-400 text-xs">Gagal memuat paket</div>';
            Toast.error('Gagal memuat daftar paket');
        }
    },

    selectPaketCard(card, paketId) {
        document.querySelectorAll('.paket-card').forEach(el => {
            el.classList.remove('bg-[#1e1e1e]', 'border-neutral-300', 'ring-1', 'ring-neutral-300');
            el.classList.add('bg-[#141414]', 'border-[#2a2a2a]');
            
            const check = el.querySelector('.check-indicator');
            if (check) {
                check.classList.remove('bg-neutral-200', 'border-neutral-200', 'text-neutral-900');
                check.classList.add('border-[#2a2a2a]', 'text-transparent');
            }
        });

        card.classList.add('bg-[#1e1e1e]', 'border-neutral-300', 'ring-1', 'ring-neutral-300');
        card.classList.remove('bg-[#141414]', 'border-[#2a2a2a]');
        
        const check = card.querySelector('.check-indicator');
        if (check) {
            check.classList.remove('border-[#2a2a2a]', 'text-transparent');
            check.classList.add('bg-neutral-200', 'border-neutral-200', 'text-neutral-900');
        }

        const hiddenInput = document.getElementById('buka-paket');
        if (hiddenInput) hiddenInput.value = String(paketId);
    },

    async submit() {
        let paketId = document.getElementById('buka-paket')?.value;
        if (!paketId) {
            const selectedCard = document.querySelector('.paket-card.bg-[#1e1e1e]');
            if (selectedCard) paketId = selectedCard.dataset.paketId;
        }

        const inputGuest = document.getElementById('buka-guest');
        const namaGuest = (inputGuest ? inputGuest.value.trim() : '') || 'Guest' + String(Math.floor(Math.random() * 9000) + 1000);

        if (!paketId) return Toast.error('Pilih paket terlebih dahulu');

        try {
            await API.sesi.bukaGuest(this.pcKode, paketId, namaGuest);
            Toast.success('Sesi guest dibuka di PC ' + this.pcKode);
            BukaModal.closeModalSafe();
            if (typeof Dashboard !== 'undefined') Dashboard.load();
        } catch (err) {
            Toast.error(err.message);
        }
    }
};

window.BukaModal = BukaModal;
