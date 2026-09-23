// app/static/js/kasir/components/modal-buka.js

const BukaModal = {
    pcKode: null,
    pcGrup: null,
    isBatch: false,
    pcList: [],
    _currentPaketList: [],
    _selectedPaketId: null,

    async open(pcKode, pcGrup) {
        this.isBatch = false;
        this.pcList = [];
        this.pcKode = pcKode;
        this.pcGrup = pcGrup;
        this._selectedPaketId = null;
        await this._renderModal();
    },

    async openBatch(pcList) {
        if (!pcList || pcList.length === 0) return;
        this.isBatch = true;
        this.pcList = pcList;
        this.pcKode = pcList.map(p => p.kode).join(', ');
        // If all PCs have same group, use it; otherwise 'semua'
        const groups = [...new Set(pcList.map(p => p.grup || 'reguler'))];
        this.pcGrup = groups.length === 1 ? groups[0] : '';
        this._selectedPaketId = null;
        await this._renderModal();
    },

    async _renderModal() {
        let paymentMethods = ["Tunai", "QRIS", "Transfer Bank"];
        try {
            const settingsData = await API.settings.getAll();
            if (settingsData && settingsData.success && settingsData.settings.payment_methods) {
                paymentMethods = settingsData.settings.payment_methods.split(',').map(s => s.trim());
            }
        } catch (e) {
            console.error("Gagal memuat metode pembayaran:", e);
        }

        const titleText = this.isBatch ? `Buka Sesi Bersama (${this.pcList.length} PC)` : 'Buka Sesi Billing';
        const subTitleText = this.isBatch 
            ? `${this.pcList.length} PC Terpilih &middot; ${this.pcGrup ? this.pcGrup.toUpperCase() : 'MULTI ZONA'}`
            : `${this.pcKode} &middot; ${this.pcGrup ? this.pcGrup.toUpperCase() : 'STANDAR'}`;

        const defaultGuestName = this.isBatch ? 'Squad' : `Guest${String(Math.floor(Math.random() * 9000) + 1000)}`;

        const targetPcDisplay = this.isBatch ? `
            <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                    <span class="text-[9px] lg:text-xs text-neutral-500 uppercase font-bold tracking-wider">Target ${this.pcList.length} Unit PC</span>
                    <span class="text-[10px] text-indigo-400 font-mono font-bold">${this.pcGrup ? this.pcGrup.toUpperCase() : 'MULTI ZONA'}</span>
                </div>
                <div class="flex flex-wrap gap-1.5 max-h-[85px] overflow-y-auto pr-1 scrollbar-thin">
                    ${this.pcList.map(p => `
                        <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#222] border border-[#333] text-neutral-200">
                            ${p.kode}
                        </span>
                    `).join('')}
                </div>
            </div>
        ` : `
            <div>
                <div class="text-[9px] lg:text-xs text-neutral-500 uppercase font-bold tracking-wider">Target PC &amp; Zona</div>
                <div class="font-bold text-xs lg:text-base text-neutral-200 mt-1 font-mono flex items-center gap-2">
                    <span class="text-neutral-100">${this.pcKode}</span>
                    <span class="text-neutral-500">&bull;</span>
                    <span class="px-2 py-0.5 rounded text-[10px] lg:text-xs bg-[#222] border border-[#333] text-neutral-300 uppercase">${this.pcGrup ? this.pcGrup.toUpperCase() : 'STANDAR'}</span>
                </div>
            </div>
        `;

        const guestLabel = this.isBatch ? 'Prefix Nama Tamu' : 'Nama Tamu / Guest';
        const guestPlaceholder = this.isBatch ? 'Contoh: Squad atau Party' : 'Contoh: Guest1234';

        const modalHtml = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl p-4 md:p-6 max-w-md md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-[1500px] w-[calc(100%-2rem)] lg:w-[92vw] xl:w-[88vw] 2xl:w-[84vw] max-h-[92vh] xl:max-h-[88vh] mx-auto flex flex-col my-auto shadow-2xl relative overflow-hidden">
                <!-- Header -->
                <div class="flex items-center justify-between mb-3 pb-2.5 border-b border-[#2a2a2a] shrink-0">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                            <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                        <div>
                            <h3 class="text-xs lg:text-base font-bold text-neutral-100 uppercase tracking-wider">${titleText}</h3>
                            <p class="text-[9px] lg:text-base text-neutral-500 mt-0.5 font-mono">${subTitleText}</p>
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
                                ${targetPcDisplay}
                            </div>

                            <div class="bg-[#161616] border border-[#2a2a2a] rounded-lg p-3.5">
                                <label for="buka-guest" class="text-[9px] lg:text-xs text-neutral-500 uppercase font-bold tracking-wider block mb-1.5">${guestLabel}</label>
                                <input type="text" id="buka-guest" value="${defaultGuestName}" placeholder="${guestPlaceholder}"
                                    class="w-full px-3 py-2 bg-[#050505] border border-[#2a2a2a] rounded-lg text-xs lg:text-base text-neutral-200 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 font-bold font-mono transition-all"
                                    oninput="BukaModal.updatePreview()">
                                ${this.isBatch ? `
                                <p id="buka-guest-preview-text" class="text-[9px] lg:max-xl:text-[10px] xl:text-xs 2xl:text-sm text-neutral-500 mt-1 font-mono">
                                    Format: ${defaultGuestName}-1, ${defaultGuestName}-2, ...
                                </p>` : `
                                <p class="text-[9px] lg:max-xl:text-[10px] xl:text-xs 2xl:text-sm text-neutral-500 mt-1 font-normal font-sans">Maksimal 30 karakter</p>`}
                            </div>

                            <div class="bg-[#161616] border border-[#2a2a2a] rounded-lg p-3.5">
                                <div class="text-[9px] lg:text-xs text-neutral-500 uppercase font-bold tracking-wider">Paket Terpilih</div>
                                <div class="mt-1" id="buka-paket-preview">
                                    <span class="text-xs text-neutral-500 italic">Pilih paket di daftar sebelah</span>
                                </div>
                            </div>

                            <div class="bg-[#161616] border border-[#2a2a2a] rounded-lg p-3.5">
                                <label for="buka-metode-pembayaran" class="text-[9px] lg:text-xs text-neutral-500 uppercase font-bold tracking-wider block mb-1.5">Metode Pembayaran</label>
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
                    <button onclick="BukaModal.submit()" class="px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-black text-xs lg:text-base font-bold rounded-lg transition-colors">
                        ${this.isBatch ? `Buka ${this.pcList.length} Sesi Sekaligus` : 'Mulai Sesi'}
                    </button>
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
        const badge = document.getElementById('buka-total-paket-badge');

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
            if (badge) badge.innerText = `${filteredPaket.length} Paket Aktif`;

            if (filteredPaket.length === 0) {
                if (grid) grid.innerHTML = `<div class="text-center py-12 text-neutral-500 text-xs lg:text-base">Belum ada paket aktif untuk zona ini</div>`;
                return;
            }

            if (grid) {
                grid.innerHTML = filteredPaket.map(p => {
                    const durasi = p.durasi || p.durasi_menit || 0;
                    const isSelected = p.id === this._selectedPaketId;
                    const pricePerPc = p.harga || 0;
                    const totalPrice = this.isBatch ? pricePerPc * this.pcList.length : pricePerPc;

                    return `
                        <div class="paket-card p-3 md:p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${isSelected ? 'bg-[#1e1e1e] border-neutral-400' : 'bg-[#141414] border-[#2a2a2a] hover:border-neutral-500'}"
                            data-paket-id="${p.id}" onclick="BukaModal.selectPaket(${p.id})">
                            <div class="flex items-center gap-3 min-w-0">
                                <div class="check-indicator w-5 h-5 rounded-md border flex items-center justify-center text-[10px] font-bold ${isSelected ? 'bg-neutral-200 border-neutral-200 text-neutral-900' : 'border-[#2a2a2a] text-transparent bg-[#050505]'}">
                                    ✓
                                </div>
                                <div class="min-w-0">
                                    <div class="font-bold text-xs lg:text-base text-neutral-100 font-mono truncate" title="${p.nama}">${p.nama}</div>
                                    <div class="text-[10px] lg:text-xs text-neutral-400 font-mono mt-0.5 flex items-center gap-2">
                                        <span>${Utils.formatDurasiFriendly(durasi)}</span>
                                        ${this.isBatch ? `<span class="text-neutral-500">&bull;</span><span class="text-neutral-400">@ ${Utils.formatRupiah(pricePerPc)}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                            <div class="text-right shrink-0">
                                <div class="font-black text-xs lg:text-base text-emerald-400 font-mono">${Utils.formatRupiah(totalPrice)}</div>
                                ${this.isBatch ? `<div class="text-[9px] text-neutral-500 font-mono">${this.pcList.length} PC</div>` : ''}
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } catch (err) {
            console.error(err);
            if (grid) grid.innerHTML = `<div class="text-center py-12 text-red-400 text-xs lg:text-base">Gagal memuat paket: ${err.message}</div>`;
        }
    },

    selectPaket(paketId) {
        this._selectedPaketId = paketId;
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
        const previewText = document.getElementById('buka-guest-preview-text');
        const inputGuest = document.getElementById('buka-guest');
        const prefix = (inputGuest ? inputGuest.value.trim() : '') || (this.isBatch ? 'Squad' : 'Guest');

        if (this.isBatch && previewText) {
            previewText.innerText = `Format: ${prefix}-1, ${prefix}-2, ${prefix}-3... (${this.pcList.length} PC)`;
        }

        if (!previewEl) return;

        const paket = (this._currentPaketList || []).find(p => p.id === this._selectedPaketId);
        if (paket) {
            const durasi = paket.durasi || paket.durasi_menit || 0;
            const pricePerPc = paket.harga || 0;
            const totalPrice = this.isBatch ? pricePerPc * this.pcList.length : pricePerPc;

            previewEl.innerHTML = `
                <div class="font-bold text-xs lg:text-sm text-neutral-100 font-mono">${paket.nama}</div>
                <div class="flex items-center justify-between text-[11px] lg:text-xs font-mono mt-1 pt-1 border-t border-[#222]">
                    <span class="text-neutral-400">${Utils.formatDurasiFriendly(durasi)}</span>
                    <span class="font-bold text-emerald-400">${Utils.formatRupiah(totalPrice)}</span>
                </div>
                ${this.isBatch ? `
                <div class="text-[10px] text-neutral-500 font-mono mt-0.5 text-right">
                    (${this.pcList.length} × ${Utils.formatRupiah(pricePerPc)})
                </div>` : ''}
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
        const namaGuest = (inputGuest ? inputGuest.value.trim() : '') || (this.isBatch ? 'Squad' : ('Guest' + String(Math.floor(Math.random() * 9000) + 1000)));

        const paket = (this._currentPaketList || []).find(p => p.id === parseInt(paketId));
        if (!paket) return Toast.error('Paket tidak valid');

        const metodePembayaran = document.getElementById('buka-metode-pembayaran')?.value || 'Tunai';

        if (this.isBatch) {
            // Batch Mode Submit
            const pcKodes = this.pcList.map(p => p.kode);
            const pricePerPc = paket.harga || 0;
            const totalPrice = pricePerPc * pcKodes.length;

            const dataLines = [
                { label: 'Target PC', value: `${pcKodes.length} Unit (${pcKodes.slice(0, 4).join(', ')}${pcKodes.length > 4 ? '...' : ''})` },
                { label: 'Prefix Tamu', value: namaGuest },
                { separator: true },
                { label: 'Paket Terpilih', value: '' },
                { label: `- ${paket.nama}`, value: `@ ${Utils.formatRupiah(pricePerPc)}` },
                { separator: true },
                { label: 'Total Durasi', value: Utils.formatDurasiFriendly(paket.durasi || paket.durasi_menit || 0), highlight: true },
                { label: 'Total Tagihan', value: Utils.formatRupiah(totalPrice), highlight: true },
                { label: 'Pembayaran', value: metodePembayaran, highlight: true }
            ];

            ModalConfirmTambah.open({
                title: `Konfirmasi Buka ${pcKodes.length} Sesi Bersama`,
                dataLines: dataLines,
                onConfirm: async () => {
                    try {
                        const res = await API.sesi.bukaGuestBatch(pcKodes, parseInt(paketId), namaGuest, metodePembayaran);
                        if (res.success) {
                            Toast.success(`🟢 Berhasil membuka ${res.total_success} sesi bersama!`);
                            Modal.closeModal();
                            if (window.DashboardSelection) {
                                window.DashboardSelection.clearSelection();
                            }
                            if (typeof Dashboard !== 'undefined') Dashboard.load();
                        } else {
                            Toast.error(res.error || 'Gagal membuka sesi');
                        }
                    } catch (err) {
                        Toast.error(err.message);
                    }
                }
            });
        } else {
            // Single Mode Submit
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
    }
};

window.BukaModal = BukaModal;
