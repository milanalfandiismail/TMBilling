const TambahModal = {
    sesiId: null,
    _currentPaketList: [],

    async open(sesiId, pcGrup) {
        this.sesiId = sesiId;

        try {
            const data = await API.paket.list({ aktif_only: true });
            const allPaket = Array.isArray(data) ? data : (data.paket || data.paket_list || []);

            let filteredPaket = [];
            if (pcGrup) {
                const targetGrup = String(pcGrup).toLowerCase();
                filteredPaket = allPaket.filter(p => {
                    const pg = String(p.grup || '').toLowerCase();
                    if (targetGrup === 'reguler') {
                        return pg === 'reguler' || pg === '';
                    }
                    return pg === targetGrup;
                });
            }

            this._currentPaketList = filteredPaket;

            if (!filteredPaket.length) {
                return Toast.error('Belum ada paket aktif untuk zona ' + String(pcGrup).toUpperCase());
            }

            const options = filteredPaket.map(p => {
                const durasi = p.durasi || p.durasi_menit || 0;
                return `
                    <div class="flex items-center justify-between p-3.5 bg-[#141414] border border-[#2a2a2a] rounded-xl transition-all gap-4 select-item relative hover:border-neutral-500" data-paket-id="${p.id}">
                        <div class="flex items-center gap-3 min-w-0 flex-1">
                            <input type="checkbox" id="chk-paket-${p.id}" value="${p.id}" onchange="TambahModal.togglePaketSelection(${p.id})" class="w-4 h-4 rounded text-neutral-100 border-[#2a2a2a] focus:ring-neutral-500 bg-[#050505] focus:ring-2 cursor-pointer shrink-0">
                            <label for="chk-paket-${p.id}" class="cursor-pointer min-w-0 flex-1 select-none flex flex-col justify-center py-0.5">
                                <span class="font-bold text-xs text-neutral-200 break-words whitespace-normal" title="${p.nama}">${p.nama}</span>
                                <span class="font-mono text-[10px] text-neutral-400 flex items-center gap-1.5 mt-0.5">
                                    <span>${Utils.formatDurasiFriendly(durasi)}</span>
                                    <span class="text-neutral-600">&bull;</span>
                                    <span class="text-emerald-400 font-bold">${Utils.formatRupiah(p.harga)}</span>
                                </span>
                            </label>
                        </div>
                        <!-- Qty input for this package -->
                        <div class="flex items-center bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg overflow-hidden h-8 opacity-45 pointer-events-none transition-all shrink-0" id="qty-container-${p.id}">
                            <button onclick="TambahModal.adjustPaketQty(${p.id}, -1)" class="w-7 h-full bg-[#1a1a1a] hover:bg-[#222] text-neutral-300 font-bold text-xs transition-colors flex items-center justify-center select-none">-</button>
                            <input type="number" id="qty-paket-${p.id}" value="1" min="1" max="100" class="w-10 h-full text-center bg-transparent border-none text-xs font-mono font-bold focus:ring-0 focus:outline-none p-0 !border-0" style="background-color: transparent !important; border: 0 !important;">
                            <button onclick="TambahModal.adjustPaketQty(${p.id}, 1)" class="w-7 h-full bg-[#1a1a1a] hover:bg-[#222] text-neutral-300 font-bold text-xs transition-colors flex items-center justify-center select-none">+</button>
                        </div>
                    </div>
                `;
            }).join('');

            const html = `
                <div class="bg-[#111] border border-[#2a2a2a] rounded-xl p-4 md:p-6 max-w-4xl w-[calc(100%-2rem)] mx-auto md:w-full shadow-2xl">
                    <div class="flex items-center justify-between mb-3 pb-2.5 border-b border-[#2a2a2a]">
                        <div>
                            <h3 class="text-xs font-bold text-neutral-200 uppercase tracking-wider">Tambah Waktu</h3>
                            <p class="text-[9px] text-neutral-500 mt-1">Menambah durasi sesi aktif (Multiple Paket)</p>
                        </div>
                        <button onclick="Modal.closeModal()" class="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 hover:text-neutral-100 hover:bg-[#222] transition-colors flex items-center justify-center text-lg leading-none">&times;</button>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-5">
                        <!-- Left Column: Sesi Info and Total Preview -->
                        <div class="md:col-span-1 space-y-4">
                            <div class="bg-[#161616] border border-[#2a2a2a] rounded-lg p-4">
                                <div class="text-[9px] text-neutral-500 uppercase font-bold">Zona PC</div>
                                <div class="font-bold text-xs text-neutral-200 mt-0.5 font-mono">${pcGrup ? pcGrup.toUpperCase() : 'STANDAR'}</div>
                            </div>
                            
                            <div class="bg-[#161616] border border-[#2a2a2a] rounded-lg p-4">
                                <div class="text-[9px] text-neutral-500 uppercase font-bold">Total Tambahan</div>
                                <div class="text-sm font-black text-neutral-200 mt-1" id="tambah-paket-total-preview">Pilih paket terlebih dahulu</div>
                            </div>
                        </div>
                        
                        <!-- Right Column: Package List (Spans 3 columns) -->
                        <div class="md:col-span-3 space-y-2">
                            <label class="text-[9px] text-neutral-400 uppercase font-bold tracking-wider font-mono block">Pilih Paket & Tentukan Kuantitas</label>
                            <div class="space-y-2 max-h-[160px] md:max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                                ${options}
                            </div>
                        </div>
                    </div>

                    <div class="flex gap-3 justify-end mt-6 pt-4 border-t border-[#2a2a2a]">
                        <button onclick="Modal.closeModal()" class="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs font-bold rounded-lg transition-colors">Batal</button>
                        <button onclick="TambahModal.submit()" class="px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-black text-xs font-bold rounded-lg transition-colors font-bold">Proses Tambah</button>
                    </div>
                </div>
            `;

            Modal.show(html);

            // Set up quantity input listener for manually entered numbers
            filteredPaket.forEach(p => {
                const qtyInput = document.getElementById(`qty-paket-${p.id}`);
                if (qtyInput) {
                    qtyInput.addEventListener('input', () => {
                        let val = parseInt(qtyInput.value);
                        if (isNaN(val) || val < 1) qtyInput.value = 1;
                        TambahModal.updateTotalPreview();
                    });
                }
            });

            TambahModal.updateTotalPreview();

        } catch (err) {
            Toast.error('Gagal memuat daftar paket');
        }
    },

    togglePaketSelection(paketId) {
        const chk = document.getElementById(`chk-paket-${paketId}`);
        const qtyContainer = document.getElementById(`qty-container-${paketId}`);
        const card = document.querySelector(`.select-item[data-paket-id="${paketId}"]`);
        
        if (chk && qtyContainer && card) {
            if (chk.checked) {
                qtyContainer.classList.remove('opacity-45', 'pointer-events-none');
                card.classList.remove('border-[#2a2a2a]', 'bg-[#141414]');
                card.classList.add('border-neutral-400', 'bg-[#1e1e1e]');
            } else {
                qtyContainer.classList.add('opacity-45', 'pointer-events-none');
                card.classList.remove('border-neutral-400', 'bg-[#1e1e1e]');
                card.classList.add('border-[#2a2a2a]', 'bg-[#141414]');
            }
        }
        this.updateTotalPreview();
    },

    adjustPaketQty(paketId, delta) {
        const qtyInput = document.getElementById(`qty-paket-${paketId}`);
        if (!qtyInput) return;
        let val = parseInt(qtyInput.value) || 1;
        val = Math.max(1, val + delta);
        qtyInput.value = val;
        this.updateTotalPreview();
    },

    updateTotalPreview() {
        const previewEl = document.getElementById('tambah-paket-total-preview');
        if (!previewEl) return;
        
        let totalMenit = 0;
        let totalHarga = 0;
        let checkedCount = 0;
        
        document.querySelectorAll('input[type="checkbox"][id^="chk-paket-"]:checked').forEach(chk => {
            const paketId = parseInt(chk.value);
            const qtyInput = document.getElementById(`qty-paket-${paketId}`);
            const qty = qtyInput ? (parseInt(qtyInput.value) || 1) : 1;
            const paket = (this._currentPaketList || []).find(p => p.id === paketId);
            
            if (paket) {
                const durasi = paket.durasi || paket.durasi_menit || 0;
                totalMenit += durasi * qty;
                totalHarga += (paket.harga || 0) * qty;
                checkedCount++;
            }
        });
        
        if (checkedCount > 0) {
            previewEl.innerHTML = `<div class="text-sm font-black text-neutral-100 font-mono">${Utils.formatDurasiFriendly(totalMenit)}</div><div class="text-xs font-bold text-emerald-400 font-mono mt-0.5">${Utils.formatRupiah(totalHarga)}</div>`;
        } else {
            previewEl.innerText = 'Pilih paket terlebih dahulu';
        }
    },

    async submit() {
        const selections = [];
        document.querySelectorAll('input[type="checkbox"][id^="chk-paket-"]:checked').forEach(chk => {
            const paketId = parseInt(chk.value);
            const qtyInput = document.getElementById(`qty-paket-${paketId}`);
            const qty = qtyInput ? (parseInt(qtyInput.value) || 1) : 1;
            selections.push({ paket_id: paketId, qty: qty });
        });

        if (selections.length === 0) return Toast.error('Pilih minimal satu paket terlebih dahulu');

        try {
            await API.sesi.tambahWaktu(this.sesiId, { selections: selections });
            Toast.success('Waktu berhasil ditambahkan');
            Modal.closeModal();
            if (typeof Dashboard !== 'undefined') Dashboard.load();
        } catch (err) {
            Toast.error(err.message);
        }
    }
};

window.TambahModal = TambahModal;
