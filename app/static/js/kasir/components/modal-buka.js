const BukaModal = {
    pcKode: null,
    pcGrup: null,
    _currentPaketList: [],
    _selectedPaketId: null,

    async open(pcKode, pcGrup) {
        this.pcKode = pcKode;
        this.pcGrup = pcGrup;
        this._selectedPaketId = null;

        let paymentMethods = ["Tunai", "QRIS", "Transfer Bank"];
        try {
            const settingsData = await API.settings.getAll();
            if (settingsData && settingsData.success && settingsData.settings.payment_methods) {
                paymentMethods = settingsData.settings.payment_methods.split(',').map(s => s.trim());
            }
        } catch (e) {
            console.error("Gagal memuat metode pembayaran:", e);
        }

        const modalHtml = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl p-4 md:p-6 max-w-md md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-[1500px] w-[calc(100%-2rem)] lg:w-[92vw] xl:w-[88vw] 2xl:w-[84vw] max-h-[92vh] xl:max-h-[88vh] mx-auto flex flex-col my-auto shadow-2xl relative overflow-hidden">
                <!-- Header -->
                <div class="flex items-center justify-between mb-3 pb-2.5 border-b border-[#2a2a2a] shrink-0">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                            <svg class="w-4 h-4 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                        <div>
                            <h3 class="text-xs lg:text-base font-bold text-neutral-100 uppercase tracking-wider">Buka Sesi Billing</h3>
                            <p class="text-[9px] lg:text-base text-neutral-500 mt-0.5 font-mono">${pcKode} &middot; ${pcGrup ? pcGrup.toUpperCase() : 'STANDAR'}</p>
                        </div>
                    </div>
                    <button onclick="BukaModal.closeModalSafe()" class="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 hover:text-neutral-100 hover:bg-[#222] transition-colors flex items-center justify-center text-lg leading-none">&times;</button>
                </div>

                <!-- Body (2-Column on lg/xl/2xl) -->
                <div class="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-1">
                    <!-- Left Column: Sesi Info & Inputs -->
                    <div class="lg:col-span-1 space-y-3.5 flex flex-col justify-between">
                        <div class="space-y-3.5">
                            <div class="bg-[#161616] border border-[#2a2a2a] rounded-lg p-3.5">
                                <div class="text-[9px] lg:text-xs text-neutral-500 uppercase font-bold tracking-wider">Target PC & Zona</div>
                                <div class="font-bold text-xs lg:text-base text-neutral-200 mt-1 font-mono flex items-center gap-2">
                                    <span class="text-neutral-100">${pcKode}</span>
                                    <span class="text-neutral-500">&bull;</span>
                                    <span class="px-2 py-0.5 rounded text-[10px] lg:text-xs bg-[#222] border border-[#333] text-neutral-300 uppercase">${pcGrup ? pcGrup.toUpperCase() : 'STANDAR'}</span>
                                </div>
                            </div>

                            <div class="bg-[#161616] border border-[#2a2a2a] rounded-lg p-3.5">
                                <label class="text-[9px] lg:text-xs text-neutral-500 uppercase font-bold tracking-wider block mb-1.5">Nama Tamu / Guest</label>
                                <input type="text" id="buka-guest" value="Guest${String(Math.floor(Math.random() * 9000) + 1000)}" 
                                    class="w-full px-3 py-2 bg-[#050505] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 font-bold font-mono transition-all">
                            </div>

                            <div class="bg-[#161616] border border-[#2a2a2a] rounded-lg p-3.5">
                                <div class="text-[9px] lg:text-xs text-neutral-500 uppercase font-bold tracking-wider">Paket Terpilih</div>
                                <div class="mt-1" id="buka-paket-preview">
                                    <span class="text-xs text-neutral-500 italic">Pilih paket di daftar sebelah</span>
                                </div>
                            </div>

                            <div class="bg-[#161616] border border-[#2a2a2a] rounded-lg p-3.5">
                                <label class="text-[9px] lg:text-xs text-neutral-500 uppercase font-bold tracking-wider block mb-1.5">Metode Pembayaran</label>
                                <select id="buka-metode-pembayaran" 
                                    class="w-full px-3 py-2 bg-[#050505] border border-[#2a2a2a] rounded text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 font-bold transition-all">
                                    ${paymentMethods.map(m => `<option value="${m}">${m}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Right Column: Package List (Smooth Scrollable) -->
                    <div class="lg:col-span-2 xl:col-span-3 flex flex-col space-y-2.5 min-h-0">
                        <div class="flex items-center justify-between shrink-0">
                            <label class="text-[9px] lg:text-xs text-neutral-400 uppercase font-bold tracking-wider font-mono block">Daftar Paket Billing</label>
                            <span id="buka-total-paket-badge" class="text-[10px] lg:text-xs text-neutral-500 font-mono">0 Paket Aktif</span>
                        </div>

                        <!-- Package List Container with smooth scrollbar -->
                        <div id="paket-grid-container" class="space-y-2 flex-1 overflow-y-auto pr-1.5 scrollbar-thin max-h-[380px] md:max-h-[460px] lg:max-h-[520px] xl:max-h-[580px] min-h-[220px]">
                            <div class="flex items-center justify-center py-12 text-neutral-500 text-xs lg:text-base">
                                <div class="w-4 h-4 border-2 border-neutral-600 border-t-neutral-100 rounded-full animate-spin mr-2"></div>
                                Memuat paket...
                            </div>
                        </div>
                        <input type="hidden" id="buka-paket" value="">
                    </div>
                </div>

                <!-- Footer Actions -->
                <div class="flex gap-3 justify-end mt-4 pt-3 border-t border-[#2a2a2a] shrink-0">
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
            } else {
                filteredPaket = allPaket;
            }

            this._currentPaketList = filteredPaket;
            const badgeEl = document.getElementById('buka-total-paket-badge');
            if (badgeEl) badgeEl.innerText = `${filteredPaket.length} Paket Aktif`;

            if (filteredPaket.length === 0) {
                grid.innerHTML = `<div class="py-12 text-center text-neutral-500 text-xs lg:text-base font-bold">Tidak ada paket aktif untuk zona ${String(this.pcGrup || '').toUpperCase()}</div>`;
                return;
            }

            // Default selection to first item
            if (!this._selectedPaketId && filteredPaket.length > 0) {
                this._selectedPaketId = filteredPaket[0].id;
            }

            grid.innerHTML = filteredPaket.map(p => {
                const durasi = p.durasi || p.durasi_menit || 0;
                const durasiText = Utils.formatDurasiFriendly(durasi);
                const isSelected = this._selectedPaketId === p.id;
                
                return `
                    <div onclick="BukaModal.selectPaket(${p.id})" 
                        class="paket-card relative border ${isSelected ? 'border-neutral-400 bg-[#1e1e1e]' : 'border-[#2a2a2a] bg-[#141414]'} rounded-xl p-3 md:p-3.5 cursor-pointer text-left transition-all hover:border-neutral-500 flex items-center justify-between gap-4 select-item"
                        data-paket-id="${p.id}">
                        <div class="flex items-center gap-3 min-w-0 flex-1">
                            <div class="check-indicator w-4 h-4 rounded-full border ${isSelected ? 'bg-neutral-200 border-neutral-200 text-neutral-900' : 'border-[#2a2a2a] text-transparent bg-[#050505]'} flex items-center justify-center text-[8px] font-black transition-all select-none shrink-0">✓</div>
                            <div class="min-w-0 flex-1 flex flex-col justify-center py-0.5">
                                <span class="font-bold text-xs lg:text-base text-neutral-200 break-words whitespace-normal pr-2" title="${p.nama}">${p.nama}</span>
                                <span class="font-mono text-[10px] lg:text-xs text-neutral-400 flex items-center gap-1.5 mt-0.5">
                                    <span>${durasiText}</span>
                                </span>
                            </div>
                        </div>
                        <div class="text-xs lg:text-base font-bold text-emerald-400 font-mono shrink-0">${Utils.formatRupiah(p.harga || 0)}</div>
                    </div>
                `;
            }).join('');

            this.updatePreview();

        } catch (err) {
            grid.innerHTML = '<div class="py-12 text-center text-red-400 text-xs lg:text-base">Gagal memuat daftar paket</div>';
            Toast.error('Gagal memuat daftar paket');
        }
    },

    selectPaket(paketId) {
        this._selectedPaketId = parseInt(paketId);
        
        const hiddenInput = document.getElementById('buka-paket');
        if (hiddenInput) hiddenInput.value = String(this._selectedPaketId);

        // Update card active classes
        document.querySelectorAll('.paket-card').forEach(el => {
            const cardPaketId = parseInt(el.dataset.paketId);
            const isMatch = cardPaketId === this._selectedPaketId;
            
            el.classList.toggle('bg-[#1e1e1e]', isMatch);
            el.classList.toggle('border-neutral-400', isMatch);
            el.classList.toggle('bg-[#141414]', !isMatch);
            el.classList.toggle('border-[#2a2a2a]', !isMatch);

            const check = el.querySelector('.check-indicator');
            if (check) {
                check.classList.toggle('bg-neutral-200', isMatch);
                check.classList.toggle('border-neutral-200', isMatch);
                check.classList.toggle('text-neutral-900', isMatch);
                check.classList.toggle('border-[#2a2a2a]', !isMatch);
                check.classList.toggle('text-transparent', !isMatch);
                check.classList.toggle('bg-[#050505]', !isMatch);
            }
        });

        this.updatePreview();
    },

    updatePreview() {
        const previewEl = document.getElementById('buka-paket-preview');
        if (!previewEl) return;

        const paket = (this._currentPaketList || []).find(p => p.id === this._selectedPaketId);
        if (paket) {
            const durasi = paket.durasi || paket.durasi_menit || 0;
            previewEl.innerHTML = `
                <div class="font-bold text-xs lg:text-sm text-neutral-100 font-mono">${paket.nama}</div>
                <div class="flex items-center justify-between text-[11px] lg:text-xs font-mono mt-1 pt-1 border-t border-[#222]">
                    <span class="text-neutral-400">${Utils.formatDurasiFriendly(durasi)}</span>
                    <span class="font-bold text-emerald-400">${Utils.formatRupiah(paket.harga || 0)}</span>
                </div>
            `;
            const hiddenInput = document.getElementById('buka-paket');
            if (hiddenInput) hiddenInput.value = String(paket.id);
        } else {
            previewEl.innerHTML = `<span class="text-xs text-neutral-500 italic">Pilih paket di daftar sebelah</span>`;
        }
    },

    async submit() {
        let paketId = this._selectedPaketId || document.getElementById('buka-paket')?.value;
        if (!paketId) return Toast.error('Pilih paket terlebih dahulu');

        const inputGuest = document.getElementById('buka-guest');
        const namaGuest = (inputGuest ? inputGuest.value.trim() : '') || 'Guest' + String(Math.floor(Math.random() * 9000) + 1000);

        const paket = (this._currentPaketList || []).find(p => p.id === parseInt(paketId));
        if (!paket) return Toast.error('Paket tidak valid');

        const metodePembayaran = document.getElementById('buka-metode-pembayaran')?.value || 'Tunai';

        const dataLines = [
            { label: 'Target PC', value: this.pcKode },
            { label: 'Nama Guest', value: namaGuest },
            { separator: true },
            { label: 'Paket Terpilih', value: '' },
            { label: `- ${paket.nama}`, value: Utils.formatRupiah(paket.harga || 0) },
            { separator: true },
            { label: 'Total Durasi', value: Utils.formatDurasiFriendly(paket.durasi || paket.durasi_menit || 0), highlight: true },
            { label: 'Total Harga', value: Utils.formatRupiah(paket.harga || 0), highlight: true },
            { label: 'Pembayaran', value: metodePembayaran, highlight: true }
        ];

        ModalConfirmTambah.open({
            title: "Konfirmasi Buka Sesi",
            dataLines: dataLines,
            onConfirm: async () => {
                try {
                    await API.sesi.bukaGuest(this.pcKode, paketId, namaGuest, metodePembayaran);
                    Toast.success('Sesi guest dibuka di PC ' + this.pcKode);
                    Modal.closeModal();
                    if (typeof Dashboard !== 'undefined') Dashboard.load();
                } catch (err) {
                    Toast.error(err.message);
                }
            }
        });
    }
};

window.BukaModal = BukaModal;
