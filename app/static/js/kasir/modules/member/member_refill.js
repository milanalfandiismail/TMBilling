// app/static/js/kasir/modules/member/member_refill.js

const MemberRefill = {
    async tambahWaktu(memberId) {
        try {
            const response = await API.member.get(memberId);
            const member = response.member || response;
            if (!member) return Toast.error('Data tidak ditemukan');

            const mGrup = (typeof member.grup === 'object' ? member.grup.nama : member.grup) || 'reguler';
            const paketData = await API.paket.list({ aktif_only: true });
            const paketListFull = paketData.paket || paketData.paket_list || [];
            const paketList = paketListFull.filter(p => {
                const pGrup = (typeof p.grup === 'object' ? p.grup.nama : p.grup) || 'reguler';
                return pGrup.toLowerCase() === mGrup.toLowerCase();
            });
            if (!paketList.length) return Toast.error(`Tidak ada paket untuk ${mGrup.toUpperCase()}`);

            this._currentPaketList = paketList;

            const options = paketList.map((p, idx) => `
                <div class="flex items-center justify-between p-3 bg-[#141414] border border-[#2a2a2a] rounded-xl transition-all gap-4 select-item relative hover:border-neutral-500" data-paket-id="${p.id}">
                    <div class="flex items-center gap-3 min-w-0 flex-1">
                        <input type="checkbox" id="mem-chk-paket-${p.id}" value="${p.id}" onchange="MemberRefill.togglePaketSelection(${p.id})" class="w-4 h-4 rounded text-neutral-100 border-[#2a2a2a] focus:ring-neutral-500 bg-[#050505] focus:ring-2 cursor-pointer shrink-0">
                        <label for="mem-chk-paket-${p.id}" class="cursor-pointer min-w-0 flex-1 select-none flex flex-col justify-center py-0.5">
                            <span class="font-bold text-xs lg:text-base text-neutral-200 break-words whitespace-normal" title="${p.nama}">${p.nama}</span>
                            <span class="font-mono text-[10px] lg:text-base text-neutral-400 flex items-center gap-1.5 mt-0.5">
                                <span>${Utils.formatDurasiFriendly(p.durasi_menit)}</span>
                                <span class="text-neutral-600">&bull;</span>
                                <span class="text-emerald-400 font-bold">${Utils.formatRupiah(p.harga)}</span>
                            </span>
                        </label>
                    </div>
                    <!-- Qty input for this package -->
                    <div class="flex items-center bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg overflow-hidden h-8 opacity-45 pointer-events-none transition-all shrink-0" id="mem-qty-container-${p.id}">
                        <button onclick="MemberRefill.adjustPaketQty(${p.id}, -1)" class="w-7 h-full bg-[#1a1a1a] hover:bg-[#222] text-neutral-300 font-bold text-xs lg:text-base transition-colors flex items-center justify-center select-none">-</button>
                        <input type="number" id="mem-qty-paket-${p.id}" value="1" min="1" max="100" class="w-10 h-full text-center bg-transparent border-none text-xs lg:text-base font-mono font-bold focus:ring-0 focus:outline-none p-0 !border-0" style="background-color: transparent !important; border: 0 !important;">
                        <button onclick="MemberRefill.adjustPaketQty(${p.id}, 1)" class="w-7 h-full bg-[#1a1a1a] hover:bg-[#222] text-neutral-300 font-bold text-xs lg:text-base transition-colors flex items-center justify-center select-none">+</button>
                    </div>
                </div>
            `).join('');

            const html = `
                <div class="bg-[#111] border border-[#2a2a2a] rounded-xl p-4 md:p-6 max-w-4xl w-[calc(100%-2rem)] mx-auto md:w-full max-h-[85vh] overflow-y-auto scrollbar-thin my-auto shadow-2xl">
                    <div class="flex items-center justify-between mb-3 pb-2.5 border-b border-[#2a2a2a]">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center">
                                <svg class="w-4 h-4 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                            </div>
                            <div>
                                <h3 class="text-xs lg:text-base font-bold text-neutral-100 uppercase tracking-wider">Isi Waktu Billing</h3>
                                <p class="text-[9px] lg:text-base text-neutral-500 mt-0.5">Tambah saldo member (Multiple Paket)</p>
                            </div>
                        </div>
                        <button onclick="Modal.closeModal()" class="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 hover:text-neutral-100 hover:bg-[#222] transition-colors flex items-center justify-center text-lg leading-none">&times;</button>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-5">
                        <!-- Left Column: Member Info and Total Preview -->
                        <div class="md:col-span-1 space-y-4">
                            <div class="bg-[#161616] border border-[#2a2a2a] rounded-lg p-4">
                                <div class="text-[9px] lg:text-base text-neutral-500 uppercase font-bold">Member</div>
                                <div class="font-bold text-xs lg:text-base text-neutral-200 mt-0.5 lg:truncate break-words whitespace-normal">${member.username}</div>
                                
                                <div class="border-t border-[#2a2a2a] my-3"></div>
                                
                                <div class="text-[9px] lg:text-base text-neutral-500 uppercase font-bold">Sisa Waktu Saat Ini</div>
                                <div class="font-bold text-xs lg:text-base text-neutral-100 font-mono mt-0.5">${Utils.formatDurasiFriendly(member.waktu_saved || member.waktu_tersimpan)}</div>
                            </div>
                            
                            <div class="bg-[#161616] border border-[#2a2a2a] rounded-lg p-4">
                                <div class="text-[9px] lg:text-base text-neutral-500 uppercase font-bold">Total Tambahan</div>
                                <div class="text-sm font-black text-neutral-200 mt-1" id="tambah-waktu-total-preview">Pilih paket terlebih dahulu</div>
                            </div>
                        </div>
                        
                        <!-- Right Column: Package List -->
                        <div class="md:col-span-3 space-y-2">
                            <label class="text-[9px] lg:text-base text-neutral-400 uppercase font-bold tracking-wider font-mono block">Pilih Paket & Tentukan Kuantitas</label>
                            <div class="space-y-2 max-h-[160px] md:max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                                ${options}
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex gap-3 justify-end mt-5 pt-4 border-t border-[#2a2a2a]">
                        <button onclick="Modal.closeModal()" class="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs lg:text-base font-bold rounded-lg transition-colors">Batal</button>
                        <button onclick="Member.doAddWaktu(${memberId})" class="px-5 py-2.5 bg-neutral-100 hover:bg-[#e5e5e5] text-black text-xs lg:text-base font-bold rounded-lg transition-colors font-bold">Tambah Waktu</button>
                    </div>
                </div>`;
            Modal.show(html);
            
            paketList.forEach(p => {
                const qtyInput = document.getElementById(`mem-qty-paket-${p.id}`);
                if (qtyInput) {
                    qtyInput.addEventListener('input', () => {
                        let val = parseInt(qtyInput.value);
                        if (isNaN(val) || val < 1) qtyInput.value = 1;
                        MemberRefill.updateTotalPreview();
                    });
                }
            });

            MemberRefill.updateTotalPreview();
        } catch (err) {
            Toast.error(err.message);
        }
    },

    togglePaketSelection(paketId) {
        const chk = document.getElementById(`mem-chk-paket-${paketId}`);
        const container = document.getElementById(`mem-qty-container-${paketId}`);
        if (!chk || !container) return;
        
        if (chk.checked) {
            container.classList.remove('opacity-45', 'pointer-events-none');
            container.classList.add('opacity-100');
        } else {
            container.classList.add('opacity-45', 'pointer-events-none');
            container.classList.remove('opacity-100');
            const qtyInput = document.getElementById(`mem-qty-paket-${paketId}`);
            if (qtyInput) qtyInput.value = 1;
        }
        
        this.updateTotalPreview();
    },

    adjustPaketQty(paketId, delta) {
        const qtyInput = document.getElementById(`mem-qty-paket-${paketId}`);
        if (!qtyInput) return;
        
        let val = parseInt(qtyInput.value) + delta;
        if (val < 1) val = 1;
        if (val > 100) val = 100;
        qtyInput.value = val;
        
        this.updateTotalPreview();
    },

    updateTotalPreview() {
        const previewEl = document.getElementById('tambah-waktu-total-preview');
        if (!previewEl) return;
        
        let totalMenit = 0;
        let totalHarga = 0;
        let checkedCount = 0;
        
        document.querySelectorAll('input[type="checkbox"][id^="mem-chk-paket-"]:checked').forEach(chk => {
            const paketId = parseInt(chk.value);
            const qtyInput = document.getElementById(`mem-qty-paket-${paketId}`);
            const qty = qtyInput ? (parseInt(qtyInput.value) || 1) : 1;
            const paket = (this._currentPaketList || []).find(p => p.id === paketId);
            
            if (paket) {
                totalMenit += (paket.durasi_menit || 0) * qty;
                totalHarga += (paket.harga || 0) * qty;
                checkedCount++;
            }
        });
        
        if (checkedCount > 0) {
            previewEl.innerHTML = `<div class="text-sm font-black text-neutral-100 font-mono">${Utils.formatDurasiFriendly(totalMenit)}</div><div class="text-xs lg:text-base font-bold text-emerald-400 font-mono mt-0.5">${Utils.formatRupiah(totalHarga)}</div>`;
        } else {
            previewEl.innerText = 'Pilih paket terlebih dahulu';
        }
    }
};

window.MemberRefill = MemberRefill;
