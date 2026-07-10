const BukaModal = {
    pcKode: null,
    pcGrup: null,
    _currentPaketList: [],

    async open(pcKode, pcGrup) {
        this.pcKode = pcKode;
        this.pcGrup = pcGrup;

        const modalHtml = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl p-4 md:p-6 max-w-md w-[calc(100%-2rem)] mx-auto md:w-full relative shadow-2xl">
                <div class="flex items-center justify-between mb-4 pb-3 border-b border-[#2a2a2a]">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                            <svg class="w-4 h-4 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                        <div>
                            <h3 class="text-xs lg:text-base font-bold text-neutral-100 uppercase tracking-wider">Buka Sesi Billing</h3>
                            <p class="text-[9px] lg:text-base text-neutral-500 mt-0.5 font-mono">PC ${pcKode} &middot; ${pcGrup.toUpperCase()}</p>
                        </div>
                    </div>
                    <button onclick="BukaModal.closeModalSafe()" class="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 hover:text-neutral-100 hover:bg-[#222] transition-colors flex items-center justify-center text-lg leading-none">&times;</button>
                </div>

                <div class="space-y-4">
                    <div>
                        <label class="text-[9px] lg:text-base text-neutral-400 font-bold uppercase tracking-wider mb-2 block">Nama Tamu / Guest</label>
                        <input type="text" id="buka-guest" value="Guest${String(Math.floor(Math.random() * 9000) + 1000)}" 
                            class="w-full px-4 py-2.5 bg-[#050505] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 font-bold font-mono transition-all">
                    </div>
                    <div>
                        <label class="text-[9px] lg:text-base text-neutral-400 font-bold uppercase tracking-wider mb-2 block">Pilih Paket Billing</label>
                        <div id="paket-grid-container" class="space-y-2 max-h-[160px] md:max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                            <div class="flex items-center justify-center py-8 text-neutral-500 text-xs lg:text-base">
                                <div class="w-4 h-4 border-2 border-neutral-600 border-t-neutral-100 rounded-full animate-spin mr-2"></div>
                                Memuat paket...
                            </div>
                        </div>
                        <input type="hidden" id="buka-paket" value="">
                    </div>
                </div>

                <div class="flex gap-3 justify-end mt-5 pt-4 border-t border-[#2a2a2a]">
                    <button onclick="BukaModal.closeModalSafe()" class="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs lg:text-base font-bold rounded-lg transition-colors">Batal</button>
                    <button onclick="BukaModal.submit()" class="px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-black text-xs lg:text-base font-bold rounded-lg transition-colors">Mulai Sesi</button>
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

            this._currentPaketList = filteredPaket;

            if (filteredPaket.length === 0) {
                grid.innerHTML = `<div class="py-6 text-center text-neutral-500 text-xs lg:text-base">Tidak ada paket aktif untuk zona ${String(this.pcGrup).toUpperCase()}</div>`;
                return;
            }

            grid.innerHTML = filteredPaket.map((p, i) => {
                const durasi = p.durasi || p.durasi_menit || 0;
                const durasiText = Utils.formatDurasiFriendly(durasi);
                
                return `
                    <div onclick="BukaModal.selectPaketCard(this, ${p.id})" 
                        class="paket-card relative border border-[#2a2a2a] bg-[#141414] rounded-xl p-3.5 cursor-pointer text-left transition-all hover:border-neutral-500 flex items-center justify-between gap-4 select-item"
                        data-paket-id="${p.id}">
                        <div class="flex items-center gap-3 min-w-0 flex-1">
                            <div class="check-indicator w-4 h-4 rounded-full border border-[#2a2a2a] flex items-center justify-center text-[8px] font-black text-transparent transition-all select-none shrink-0 bg-[#050505]">✓</div>
                            <div class="min-w-0 flex-1 flex flex-col justify-center py-0.5">
                                <span class="font-bold text-xs lg:text-base text-neutral-200 break-words whitespace-normal pr-2" title="${p.nama}">${p.nama}</span>
                                <span class="font-mono text-[10px] lg:text-base text-neutral-400 flex items-center gap-1.5 mt-0.5">
                                    <span>${durasiText}</span>
                                </span>
                            </div>
                        </div>
                        <div class="text-xs lg:text-base font-bold text-emerald-400 font-mono shrink-0">${Utils.formatRupiah(p.harga || 0)}</div>
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
            grid.innerHTML = '<div class="py-6 text-center text-red-400 text-xs lg:text-base">Gagal memuat paket</div>';
            Toast.error('Gagal memuat daftar paket');
        }
    },

    selectPaketCard(card, paketId) {
        document.querySelectorAll('.paket-card').forEach(el => {
            el.classList.remove('bg-[#1e1e1e]', 'border-neutral-400');
            el.classList.add('bg-[#141414]', 'border-[#2a2a2a]');
            
            const check = el.querySelector('.check-indicator');
            if (check) {
                check.classList.remove('bg-neutral-200', 'border-neutral-200', 'text-neutral-900');
                check.classList.add('border-[#2a2a2a]', 'text-transparent', 'bg-[#050505]');
            }
        });

        card.classList.add('bg-[#1e1e1e]', 'border-neutral-400');
        card.classList.remove('bg-[#141414]', 'border-[#2a2a2a]');
        
        const check = card.querySelector('.check-indicator');
        if (check) {
            check.classList.remove('border-[#2a2a2a]', 'text-transparent', 'bg-[#050505]');
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

        const paket = (this._currentPaketList || []).find(p => p.id === parseInt(paketId));
        if (!paket) return Toast.error('Paket tidak valid');

        // Use confirmation modal
        const dataLines = [
            { label: 'Target PC', value: this.pcKode },
            { label: 'Nama Guest', value: namaGuest },
            { separator: true },
            { label: 'Paket Terpilih', value: '' },
            { label: `- ${paket.nama}`, value: Utils.formatRupiah(paket.harga || 0) },
            { separator: true },
            { label: 'Total Durasi', value: Utils.formatDurasiFriendly(paket.durasi || paket.durasi_menit || 0), highlight: true },
            { label: 'Total Harga', value: Utils.formatRupiah(paket.harga || 0), highlight: true }
        ];

        ModalConfirmTambah.open({
            title: "Konfirmasi Buka Sesi",
            dataLines: dataLines,
            onConfirm: async () => {
                try {
                    await API.sesi.bukaGuest(this.pcKode, paketId, namaGuest);
                    Toast.success('Sesi guest dibuka di PC ' + this.pcKode);
                    Modal.closeModal(); // Close the confirmation modal
                    if (typeof Dashboard !== 'undefined') Dashboard.load();
                } catch (err) {
                    Toast.error(err.message);
                }
            }
        });
    }
};

window.BukaModal = BukaModal;
