// app/static/js/kasir/components/modal-tambah.js

const TambahModal = {
    sesiId: null,
    isBatch: false,
    pcList: [],
    _currentPaketList: [],
    _sesiInfo: null,

    async open(sesiId, pcGrup) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        this.isBatch = false;
        this.pcList = [];
        this.sesiId = sesiId;
        await this._renderModal(sesiId, pcGrup);
    },

    async openBatch(pcList) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        if (!pcList || pcList.length === 0) return;
        this.isBatch = true;
        this.pcList = pcList;
        this.sesiId = pcList[0]?.sesi_detail?.id;
        const pcGrup = pcList[0]?.grup || 'reguler';
        await this._renderModal(this.sesiId, pcGrup);
    },

    async _renderModal(sesiId, pcGrup) {
        let paymentMethods = ["Tunai", "QRIS", "Transfer Bank"];
        try {
            const settingsData = await API.settings.getAll();
            if (settingsData && settingsData.success && settingsData.settings.payment_methods) {
                paymentMethods = settingsData.settings.payment_methods.split(',').map(s => s.trim());
            }
        } catch (e) {
            console.error("Gagal memuat metode pembayaran:", e);
        }

        try {
            let targetType = 'Guest / Tamu';
            let targetName = 'Guest';
            let pcKode = '-';
            let sisaWaktu = 0;
            let grupName = String(pcGrup || 'reguler').toUpperCase();

            if (this.isBatch) {
                targetType = 'Batch Sesi';
                targetName = `${this.pcList.length} Sesi Aktif`;
                pcKode = this.pcList.map(p => p.kode).join(', ');
                this._sesiInfo = null;
            } else {
                // Load detail sesi aktif
                const sesiResp = await API.sesi.detail(sesiId);
                const sesi = (sesiResp && sesiResp.sesi) ? sesiResp.sesi : (sesiResp && sesiResp.data ? sesiResp.data : sesiResp);
                this._sesiInfo = sesi;

                const isMember = sesi.tipe === 'member' || !!sesi.member_id;
                targetType = isMember ? 'Member' : 'Guest / Tamu';
                targetName = isMember ? (sesi.username || sesi.member_nama || 'Member') : (sesi.guest_nama || 'Guest');
                pcKode = sesi.pc_kode || '-';

                // Hitung sisa waktu secara akurat untuk Member maupun Guest
                if (typeof sesi.sisa_waktu === 'number') sisaWaktu = sesi.sisa_waktu;
                else if (typeof sesi.sisa_menit === 'number') sisaWaktu = sesi.sisa_menit;
                else if (typeof sesi.waktu_tersimpan === 'number') sisaWaktu = sesi.waktu_tersimpan;
                else if (typeof sesi.durasi_beli_menit === 'number') sisaWaktu = sesi.durasi_beli_menit;
                else sisaWaktu = 0;

                // Fallback pencarian realtime jika detail dari endpoint awal bernilai 0
                if (sisaWaktu === 0 && typeof Dashboard !== 'undefined' && Dashboard.lastData?.pc_list) {
                    const matchedPc = Dashboard.lastData.pc_list.find(p => 
                        (p.sesi_detail && (p.sesi_detail.id == sesiId || p.sesi_detail.sesi_id == sesiId)) || 
                        p.sesi_id == sesiId || 
                        (pcKode && pcKode !== '-' && p.kode === pcKode)
                    );
                    if (matchedPc) {
                        if (pcKode === '-') pcKode = matchedPc.kode;
                        if (matchedPc.sesi_detail) {
                            const sd = matchedPc.sesi_detail;
                            sisaWaktu = sd.sisa_menit !== undefined ? sd.sisa_menit : (sd.sisa_waktu !== undefined ? sd.sisa_waktu : 0);
                            if (isMember && (targetName === 'Member' || !targetName)) {
                                targetName = sd.username || sd.member_nama || 'Member';
                            }
                        }
                    }
                }

                // Update info sesi agar submit dan sync konsisten
                sesi.sisa_waktu = sisaWaktu;
                sesi.sisa_menit = sisaWaktu;

                const targetGrupEffective = sesi.grup || pcGrup || 'reguler';
                grupName = String(targetGrupEffective).toUpperCase();
            }

            const data = await API.paket.list({ aktif_only: true });
            const allPaket = Array.isArray(data) ? data : (data.paket || data.paket_list || []);

            let filteredPaket = [];
            const targetGrup = String(pcGrup || 'reguler').toLowerCase();
            filteredPaket = allPaket.filter(p => {
                const pg = String(p.grup || '').toLowerCase();
                if (targetGrup === 'reguler') {
                    return pg === 'reguler' || pg === '';
                }
                return pg === targetGrup;
            });

            this._currentPaketList = filteredPaket.length ? filteredPaket : allPaket;

            if (!this._currentPaketList.length) {
                return Toast.error('Belum ada paket aktif untuk zona ' + grupName);
            }

            const options = this._currentPaketList.map(p => {
                const durasi = p.durasi || p.durasi_menit || 0;
                const pricePerPc = p.harga || 0;
                const totalPrice = this.isBatch ? pricePerPc * this.pcList.length : pricePerPc;

                return `
                    <div class="flex items-center justify-between p-3 md:p-3.5 bg-[#171717] border border-[#262626] rounded transition-all gap-4 select-item relative hover:border-neutral-500" data-paket-id="${p.id}">
                        <div class="flex items-center gap-3 min-w-0 flex-1">
                            <input type="checkbox" id="chk-paket-${p.id}" value="${p.id}" onchange="TambahModal.togglePaketSelection(${p.id})" class="w-4 h-4 rounded text-neutral-100 border-[#262626] focus:ring-neutral-500 bg-[#050505] focus:ring-2 cursor-pointer shrink-0">
                            <label for="chk-paket-${p.id}" class="cursor-pointer min-w-0 flex-1 select-none flex flex-col justify-center py-0.5">
                                <span class="font-bold text-xs lg:max-xl:text-sm xl:text-base text-neutral-200 break-words whitespace-normal" title="${p.nama}">${p.nama}</span>
                                <span class="font-mono text-[10px] lg:max-xl:text-xs xl:text-sm text-neutral-400 flex items-center gap-1.5 mt-0.5">
                                    <span>${Utils.formatDurasiFriendly(durasi)}</span>
                                    <span class="text-neutral-600">&bull;</span>
                                    <span class="text-emerald-400 font-bold">${Utils.formatRupiah(pricePerPc)}</span>
                                    ${this.isBatch ? `<span class="text-neutral-500 font-mono">(@ PC)</span>` : ''}
                                </span>
                            </label>
                        </div>
                        <!-- Qty input for this package -->
                        <div class="flex items-center bg-[#050505] border border-[#262626] rounded overflow-hidden h-8 lg:max-xl:h-9 xl:h-10 opacity-45 pointer-events-none transition-all shrink-0" id="qty-container-${p.id}">
                            <button onclick="TambahModal.adjustPaketQty(${p.id}, -1)" class="w-7 lg:max-xl:w-8 xl:w-9 h-full bg-[#1a1a1a] hover:bg-[#222] text-neutral-300 font-bold text-xs lg:max-xl:text-xs xl:text-base transition-colors flex items-center justify-center select-none" type="button">-</button>
                            <input type="number" id="qty-paket-${p.id}" value="1" min="1" max="100" readonly class="no-spinners w-10 lg:max-xl:w-12 xl:w-14 h-full text-center bg-transparent border-none text-xs lg:max-xl:text-xs xl:text-base font-mono font-bold focus:ring-0 focus:outline-none p-0 !border-0 cursor-default select-none pointer-events-none" style="background-color: transparent !important; border: 0 !important;">
                            <button onclick="TambahModal.adjustPaketQty(${p.id}, 1)" class="w-7 lg:max-xl:w-8 xl:w-9 h-full bg-[#1a1a1a] hover:bg-[#222] text-neutral-300 font-bold text-xs lg:max-xl:text-xs xl:text-base transition-colors flex items-center justify-center select-none" type="button">+</button>
                        </div>
                    </div>
                `;
            }).join('');

            const titleHeader = this.isBatch ? `Tambah Waktu Bersama (${this.pcList.length} Sesi)` : 'Tambah Waktu Sesi';
            const subTitleHeader = this.isBatch 
                ? `${this.pcList.length} PC Aktif &middot; ${grupName}`
                : `${pcKode} &middot; <span class="text-neutral-300 font-bold">${targetName}</span> &middot; ${grupName}`;

            const targetDisplayCard = this.isBatch ? `
                <div class="bg-[#171717] border border-[#262626] rounded p-3.5 sm:p-4 space-y-2">
                    <div class="flex items-center justify-between">
                        <div class="text-[9px] lg:max-xl:text-xs xl:text-sm text-neutral-400 font-bold uppercase tracking-wider">Target ${this.pcList.length} Sesi Aktif</div>
                        <span class="px-2 py-0.5 rounded text-[9px] lg:max-xl:text-[10px] xl:text-xs font-mono font-bold bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 uppercase">BATCH</span>
                    </div>
                    <div class="flex flex-wrap gap-1.5 max-h-[85px] overflow-y-auto pr-1 scrollbar-thin">
                        ${this.pcList.map(p => `
                            <span class="px-2 py-0.5 rounded text-[11px] lg:max-xl:text-xs xl:text-sm font-mono font-bold bg-[#222] border border-[#333] text-neutral-200">
                                ${p.kode}
                            </span>
                        `).join('')}
                    </div>
                </div>
            ` : `
                <div class="bg-[#171717] border border-[#262626] rounded p-3.5 sm:p-4">
                    <div class="flex items-center justify-between">
                        <div class="text-[9px] lg:max-xl:text-xs xl:text-sm text-neutral-400 font-bold uppercase tracking-wider">${targetType}</div>
                        <span class="px-2 py-0.5 rounded text-[9px] lg:max-xl:text-[10px] xl:text-xs font-mono font-bold uppercase ${this._sesiInfo?.tipe === 'member' ? 'bg-indigo-950/60 border border-indigo-500/40 text-indigo-300' : 'bg-amber-950/60 border border-amber-500/40 text-amber-300'}">
                            ${this._sesiInfo?.tipe === 'member' ? 'MEMBER' : 'GUEST'}
                        </span>
                    </div>
                    <div class="font-bold text-xs lg:max-xl:text-sm xl:text-base text-neutral-100 mt-1 break-words font-mono">${targetName}</div>
                    
                    <div class="border-t border-[#262626] my-2.5"></div>
                    
                    <div class="grid grid-cols-2 gap-2 text-left">
                        <div>
                            <div class="text-[9px] lg:max-xl:text-xs xl:text-sm text-neutral-400 uppercase font-bold">Target PC</div>
                            <div class="font-mono font-bold text-neutral-200 text-xs lg:max-xl:text-sm xl:text-base mt-0.5">${pcKode}</div>
                        </div>
                        <div>
                            <div class="text-[9px] lg:max-xl:text-xs xl:text-sm text-neutral-400 uppercase font-bold">Sisa Waktu</div>
                            <div id="tambah-modal-sisa-waktu" class="font-mono font-bold text-neutral-200 text-xs lg:max-xl:text-sm xl:text-base mt-0.5">${Utils.formatDurasiFriendly(sisaWaktu)}</div>
                        </div>
                    </div>
                </div>
            `;

            const html = `
                <div id="modal-tambah-waktu-card" class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-4 sm:p-6 max-w-md md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-[1500px] w-[calc(100%-2rem)] lg:w-[92vw] xl:w-[88vw] 2xl:w-[84vw] max-h-[92vh] xl:max-h-[88vh] mx-auto flex flex-col my-auto shadow-2xl relative overflow-hidden">
                    <!-- Header -->
                    <div class="flex items-center justify-between mb-4 pb-3 border-b border-[#1c1c1c] shrink-0">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 lg:max-xl:w-10 lg:max-xl:h-10 xl:w-11 xl:h-11 rounded bg-[#171717] border border-[#262626] flex items-center justify-center shrink-0">
                                <svg class="w-4 h-4 lg:max-xl:w-5 lg:max-xl:h-5 xl:w-5 xl:h-5 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                            </div>
                            <div>
                                <h3 class="text-xs lg:max-xl:text-lg xl:text-[22px] font-bold text-neutral-200 uppercase tracking-wider">${titleHeader}</h3>
                                <p class="text-[9px] lg:max-xl:text-xs xl:text-base text-neutral-500 mt-0.5 font-mono">
                                    ${subTitleHeader}
                                </p>
                            </div>
                        </div>
                        <button onclick="Modal.closeModal()" class="w-8 h-8 lg:max-xl:w-9 lg:max-xl:h-9 xl:w-10 xl:h-10 rounded bg-[#171717] border border-[#262626] text-neutral-400 hover:text-neutral-100 hover:bg-[#222] transition-colors flex items-center justify-center text-lg leading-none">&times;</button>
                    </div>

                    <!-- Body (2-Column on lg/xl/2xl) -->
                    <div class="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-1">
                        <!-- Left Column: Sesi Info and Total Preview -->
                        <div class="lg:col-span-1 space-y-3.5 flex flex-col justify-between">
                            <div class="space-y-3.5">
                                ${targetDisplayCard}
                                
                                <!-- Total Preview Card -->
                                <div class="bg-[#171717] border border-[#262626] rounded p-3.5 sm:p-4">
                                    <div class="text-[9px] lg:max-xl:text-xs xl:text-sm text-neutral-400 font-bold uppercase tracking-wider">Total Tambahan Waktu</div>
                                    <div class="text-sm lg:max-xl:text-base xl:text-lg font-black text-neutral-200 mt-1" id="tambah-paket-total-preview">Pilih paket terlebih dahulu</div>
                                </div>

                                <!-- Payment Method Card -->
                                <div class="bg-[#171717] border border-[#262626] rounded p-3.5 sm:p-4">
                                    <label class="text-[9px] lg:max-xl:text-xs xl:text-sm text-neutral-400 font-bold uppercase tracking-wider block mb-1.5">Metode Bayar</label>
                                    <select id="tambah-metode-pembayaran" 
                                        class="w-full px-3 py-2 bg-[#050505] border border-[#1c1c1c] rounded text-xs lg:max-xl:text-xs xl:text-base text-neutral-200 focus:outline-none focus:border-neutral-500 font-bold transition-all">
                                        ${paymentMethods.map(m => `<option value="${m}">${m}</option>`).join('')}
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Right Column: Package List (Smooth Scrollable) -->
                        <div class="lg:col-span-2 xl:col-span-3 flex flex-col space-y-2.5 min-h-0">
                            <div class="flex items-center justify-between shrink-0">
                                <label class="text-[9px] lg:max-xl:text-xs xl:text-sm text-neutral-400 uppercase font-bold tracking-wider font-mono block">Pilih Paket &amp; Tentukan Kuantitas</label>
                                <span class="text-[10px] lg:max-xl:text-xs xl:text-sm text-neutral-500 font-mono">${this._currentPaketList.length} Paket Aktif (${grupName})</span>
                            </div>

                            <!-- Package List Container -->
                            <div class="space-y-2 flex-1 overflow-y-auto pr-1.5 scrollbar-thin max-h-[380px] md:max-h-[460px] lg:max-h-[520px] xl:max-h-[580px] min-h-[220px]">
                                ${options}
                            </div>
                        </div>
                    </div>

                    <!-- Footer: Action Buttons -->
                    <div class="flex gap-3 justify-end mt-4 pt-3 border-t border-[#1c1c1c] shrink-0">
                        <button onclick="Modal.closeModal()" class="px-3 lg:max-xl:px-3.5 xl:px-4 py-2 lg:max-xl:py-2.5 xl:py-2.5 bg-[#171717] border border-[#262626] hover:bg-[#222] text-neutral-200 text-xs lg:max-xl:text-xs xl:text-base font-bold rounded transition-colors">Batal</button>
                        <button onclick="TambahModal.submit()" class="px-3 lg:max-xl:px-3.5 xl:px-4 py-2 lg:max-xl:py-2.5 xl:py-2.5 bg-neutral-100 hover:bg-neutral-200 text-black text-xs lg:max-xl:text-xs xl:text-base font-bold rounded transition-colors">
                            ${this.isBatch ? `Tambah Waktu (${this.pcList.length} Sesi)` : 'Konfirmasi Penambahan'}
                        </button>
                    </div>
                </div>
            `;
            Modal.show(html);
        } catch (err) {
            console.error(err);
            Toast.error('Gagal membuka modal: ' + err.message);
        }
    },

    togglePaketSelection(paketId) {
        const checkbox = document.getElementById(`chk-paket-${paketId}`);
        const qtyContainer = document.getElementById(`qty-container-${paketId}`);
        const card = document.querySelector(`.select-item[data-paket-id="${paketId}"]`);
        
        if (checkbox.checked) {
            qtyContainer.classList.remove('opacity-45', 'pointer-events-none');
            card.classList.add('border-neutral-400', 'bg-[#222]');
            card.classList.remove('bg-[#171717]', 'border-[#262626]');
        } else {
            qtyContainer.classList.add('opacity-45', 'pointer-events-none');
            card.classList.remove('border-neutral-400', 'bg-[#222]');
            card.classList.add('bg-[#171717]', 'border-[#262626]');
        }

        this.updateTotal();
    },

    adjustPaketQty(paketId, delta) {
        const qtyInput = document.getElementById(`qty-paket-${paketId}`);
        if (!qtyInput) return;

        let currentVal = parseInt(qtyInput.value) || 1;
        let newVal = Math.max(1, Math.min(100, currentVal + delta));
        qtyInput.value = newVal;

        this.updateTotal();
    },

    updateTotal() {
        let totalMenit = 0;
        let totalHargaPerPc = 0;
        let selectedCount = 0;

        document.querySelectorAll('input[type="checkbox"][id^="chk-paket-"]:checked').forEach(chk => {
            const paketId = parseInt(chk.value);
            const qtyInput = document.getElementById(`qty-paket-${paketId}`);
            let qty = qtyInput ? (parseInt(qtyInput.value) || 1) : 1;
            qty = Math.max(1, Math.min(100, qty));
            if (qtyInput) qtyInput.value = qty;
            
            const paket = (this._currentPaketList || []).find(p => p.id === paketId);
            if (paket) {
                totalMenit += (paket.durasi || paket.durasi_menit || 0) * qty;
                totalHargaPerPc += (paket.harga || 0) * qty;
                selectedCount += qty;
            }
        });

        const previewEl = document.getElementById('tambah-paket-total-preview');
        if (!previewEl) return;

        if (selectedCount === 0) {
            previewEl.innerHTML = '<span class="text-xs text-neutral-500 italic font-normal">Pilih paket terlebih dahulu</span>';
        } else {
            const totalTagihan = this.isBatch ? totalHargaPerPc * this.pcList.length : totalHargaPerPc;
            previewEl.innerHTML = `
                <div class="text-emerald-400 font-mono text-sm lg:text-base font-black">+${Utils.formatDurasiFriendly(totalMenit)}</div>
                <div class="text-xs lg:text-sm font-mono text-neutral-300 font-bold mt-0.5">${Utils.formatRupiah(totalTagihan)}</div>
                ${this.isBatch ? `<div class="text-[10px] text-neutral-500 font-mono">(${this.pcList.length} PC × ${Utils.formatRupiah(totalHargaPerPc)})</div>` : ''}
            `;
        }
    },

    async submit() {
        const selections = [];
        let totalMenit = 0;
        let totalHargaPerPc = 0;
        
        let hasInvalidQty = false;
        document.querySelectorAll('input[type="checkbox"][id^="chk-paket-"]:checked').forEach(chk => {
            const paketId = parseInt(chk.value);
            const qtyInput = document.getElementById(`qty-paket-${paketId}`);
            let qty = qtyInput ? (parseInt(qtyInput.value) || 1) : 1;
            if (qty < 1 || qty > 100) {
                hasInvalidQty = true;
            }
            selections.push({ paket_id: paketId, qty: Math.max(1, Math.min(100, qty)) });
            
            const paket = (this._currentPaketList || []).find(p => p.id === paketId);
            if (paket) {
                totalMenit += (paket.durasi || paket.durasi_menit || 0) * qty;
                totalHargaPerPc += (paket.harga || 0) * qty;
            }
        });

        if (hasInvalidQty) {
            return Toast.error('Kuantitas paket harus antara 1 sampai 100');
        }

        if (selections.length === 0) return Toast.error('Pilih minimal satu paket terlebih dahulu');

        const metodePembayaran = document.getElementById('tambah-metode-pembayaran')?.value || 'Tunai';

        if (this.isBatch) {
            // Batch Mode Submit
            const sesiIds = this.pcList.map(p => p.sesi_detail.id);
            const pcKodes = this.pcList.map(p => p.kode);
            const totalTagihan = totalHargaPerPc * sesiIds.length;

            const dataLines = [
                { label: 'Target', value: `${sesiIds.length} Sesi Aktif (${pcKodes.slice(0, 4).join(', ')}${pcKodes.length > 4 ? '...' : ''})` },
                { separator: true },
                { label: 'Paket Tambahan', value: '' }
            ];

            selections.forEach(sel => {
                const paket = (this._currentPaketList || []).find(p => p.id === sel.paket_id);
                if (paket) {
                    dataLines.push({
                        label: `- ${paket.nama} ${sel.qty > 1 ? 'x' + sel.qty : ''}`,
                        value: `@ ${Utils.formatRupiah((paket.harga || 0) * sel.qty)}`
                    });
                }
            });

            dataLines.push(
                { separator: true },
                { label: 'Tambahan Durasi', value: `+${Utils.formatDurasiFriendly(totalMenit)} per PC` },
                { label: 'Total Tagihan', value: Utils.formatRupiah(totalTagihan), highlight: true },
                { label: 'Pembayaran', value: metodePembayaran, highlight: true }
            );

            ModalConfirmTambah.open({
                title: `Konfirmasi Tambah Waktu ${sesiIds.length} Sesi Bersama`,
                dataLines: dataLines,
                onConfirm: async () => {
                    try {
                        const res = await API.sesi.tambahWaktuBatch(sesiIds, { selections: selections }, 1, metodePembayaran);
                        if (res.success) {
                            Toast.success(`🟢 Berhasil menambah waktu pada ${res.total_success} sesi!`);
                            Modal.closeModal();
                            if (window.DashboardSelection) {
                                window.DashboardSelection.clearSelection();
                            }
                            if (typeof Dashboard !== 'undefined') Dashboard.load();
                        } else {
                            Toast.error('Gagal menambah waktu ke beberapa sesi');
                        }
                    } catch (err) {
                        Toast.error(err.message);
                    }
                }
            });
        } else {
            // Single Mode Submit
            try {
                const sesi = this._sesiInfo || (await API.sesi.detail(this.sesiId));
                
                let sisaSekarang = 0;
                if (sesi) {
                    if (typeof sesi.sisa_waktu === 'number') sisaSekarang = sesi.sisa_waktu;
                    else if (typeof sesi.sisa_menit === 'number') sisaSekarang = sesi.sisa_menit;
                    else if (typeof sesi.waktu_tersimpan === 'number') sisaSekarang = sesi.waktu_tersimpan;
                    else if (typeof sesi.durasi_beli_menit === 'number') sisaSekarang = sesi.durasi_beli_menit;
                }
                if (sisaSekarang === 0 && typeof Dashboard !== 'undefined' && Dashboard.lastData?.pc_list) {
                    const matchedPc = Dashboard.lastData.pc_list.find(p => 
                        (p.sesi_detail && (p.sesi_detail.id == this.sesiId || p.sesi_detail.sesi_id == this.sesiId)) || 
                        p.sesi_id == this.sesiId ||
                        (sesi?.pc_kode && sesi.pc_kode !== '-' && p.kode === sesi.pc_kode)
                    );
                    if (matchedPc && matchedPc.sesi_detail) {
                        sisaSekarang = matchedPc.sesi_detail.sisa_menit ?? matchedPc.sesi_detail.sisa_waktu ?? 0;
                    }
                }
                let totalSetelah = sisaSekarang + totalMenit;

                const isMember = sesi.tipe === 'member' || !!sesi.member_id;
                let targetName = isMember ? `Member: ${sesi.member_nama || sesi.username || '-'}` : `Guest: ${sesi.guest_nama || 'Guest'}`;
                let pcName = sesi.pc_kode || '-';

                const dataLines = [
                    { label: 'Target', value: `${pcName} (${targetName})` },
                    { separator: true },
                    { label: 'Paket Terpilih', value: '' }
                ];

                selections.forEach(sel => {
                    const paket = (this._currentPaketList || []).find(p => p.id === sel.paket_id);
                    if (paket) {
                        dataLines.push({
                            label: `- ${paket.nama} ${sel.qty > 1 ? 'x' + sel.qty : ''}`,
                            value: Utils.formatRupiah((paket.harga || 0) * sel.qty)
                        });
                    }
                });

                dataLines.push(
                    { separator: true },
                    { label: 'Total Waktu Saat Ini', value: Utils.formatDurasiFriendly(sisaSekarang) },
                    { label: 'Total Tambahan Waktu', value: Utils.formatDurasiFriendly(totalMenit) },
                    { label: 'Total Setelah Ditambah', value: Utils.formatDurasiFriendly(totalSetelah), highlight: true },
                    { separator: true },
                    { label: 'Total Harga', value: Utils.formatRupiah(totalHargaPerPc), highlight: true },
                    { label: 'Pembayaran', value: metodePembayaran, highlight: true }
                );

                ModalConfirmTambah.open({
                    title: "Konfirmasi Tambah Waktu Sesi",
                    dataLines: dataLines,
                    onConfirm: async () => {
                        try {
                            await API.sesi.tambahWaktu(this.sesiId, { selections: selections }, 1, metodePembayaran);
                            Toast.success('Waktu berhasil ditambahkan');
                            Modal.closeModal();
                            if (typeof Dashboard !== 'undefined') Dashboard.load();
                        } catch (err) {
                            Toast.error(err.message);
                        }
                    }
                });
            } catch (err) {
                Toast.error('Gagal memuat info sesi: ' + err.message);
            }
        }
    },

    syncLive(pcList) {
        const elSisa = document.getElementById('tambah-modal-sisa-waktu');
        if (!elSisa || this.isBatch || !this.sesiId) return;

        const list = Array.isArray(pcList) ? pcList : (typeof Dashboard !== 'undefined' && Dashboard.lastData?.pc_list ? Dashboard.lastData.pc_list : []);
        if (!list || !list.length) return;

        const targetPc = list.find(p => 
            (p.sesi_detail && (p.sesi_detail.id == this.sesiId || p.sesi_detail.sesi_id == this.sesiId)) || 
            p.sesi_id == this.sesiId || 
            (this._sesiInfo && this._sesiInfo.pc_kode && this._sesiInfo.pc_kode !== '-' && p.kode === this._sesiInfo.pc_kode)
        );
        if (targetPc && targetPc.sesi_detail) {
            const sd = targetPc.sesi_detail;
            const sisa = sd.sisa_menit !== undefined ? sd.sisa_menit : (sd.sisa_waktu !== undefined ? sd.sisa_waktu : (targetPc.sisa_waktu || 0));
            if (this._sesiInfo) {
                this._sesiInfo.sisa_waktu = sisa;
                this._sesiInfo.sisa_menit = sisa;
            }
            elSisa.textContent = Utils.formatDurasiFriendly(sisa);
        }
    }
};

window.TambahModal = TambahModal;
