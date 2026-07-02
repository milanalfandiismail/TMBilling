// app/static/js/kasir/modules/member/member_refill.js
// Mintlify Dark — konsisten dengan modal tambah waktu dashboard

const MemberRefill = {
    _currentPaketList: [],

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
            MemberRefill._currentPaketList = paketList;

            const options = paketList.map((p, idx) => `
                <div class="flex items-center justify-between p-3 bg-[#080808] border border-neutral-700 rounded-xl transition-all gap-4 select-item relative hover:border-emerald-500/50" data-paket-id="${p.id}">
                    <div class="flex items-center gap-3 min-w-0 flex-1">
                        <input type="checkbox" id="chk-paket-${p.id}" value="${p.id}" onchange="Member.togglePaketSelection(${p.id})" class="w-4 h-4 rounded border-neutral-600 focus:ring-emerald-500 bg-[#050505] focus:ring-2 cursor-pointer shrink-0 text-emerald-500">
                        <label for="chk-paket-${p.id}" class="cursor-pointer min-w-0 flex-1 select-none flex flex-col justify-center py-0.5">
                            <span class="font-medium text-sm text-neutral-200" title="${p.nama}">${p.nama}</span>
                            <span class="font-mono text-xs text-neutral-500 flex items-center gap-1.5 mt-0.5">
                                <span>${Utils.formatDurasiFriendly(p.durasi_menit)}</span>
                                <span class="text-neutral-600">&bull;</span>
                                <span class="text-emerald-400 font-semibold">${Utils.formatRupiah(p.harga)}</span>
                            </span>
                        </label>
                    </div>
                    <!-- Qty -->
                    <div class="flex items-center bg-[#0c0c0c] border border-neutral-700 rounded-lg overflow-hidden h-8 opacity-45 pointer-events-none transition-all shrink-0" id="qty-container-${p.id}">
                        <button onclick="Member.adjustPaketQty(${p.id}, -1)" class="w-7 h-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs transition-colors flex items-center justify-center select-none">-</button>
                        <input type="number" id="qty-paket-${p.id}" value="1" min="1" max="100" class="w-10 h-full text-center bg-transparent border-none text-xs font-mono font-semibold focus:ring-0 focus:outline-none p-0 !border-0" style="background-color: transparent !important; border: 0 !important;">
                        <button onclick="Member.adjustPaketQty(${p.id}, 1)" class="w-7 h-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs transition-colors flex items-center justify-center select-none">+</button>
                    </div>
                </div>
            `).join('');

            const bodyHtml = `
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="md:col-span-1 space-y-3">
                        <div class="bg-[#080808] border border-neutral-700 rounded-lg p-3">
                            <div class="text-[10px] text-neutral-500 font-medium">Member</div>
                            <div class="text-sm font-semibold text-neutral-200 mt-0.5 truncate">${member.username}</div>
                        </div>
                        <div class="bg-[#080808] border border-neutral-700 rounded-lg p-3">
                            <div class="text-[10px] text-neutral-500 font-medium">Sisa Waktu</div>
                            <div class="text-sm font-semibold text-neutral-100 font-mono mt-0.5">${Utils.formatDurasiFriendly(member.waktu_saved || member.waktu_tersimpan)}</div>
                        </div>
                        <div class="bg-[#080808] border border-neutral-700 rounded-lg p-3">
                            <div class="text-[10px] text-neutral-500 font-medium">Total Tambahan</div>
                            <div id="tambah-waktu-total-preview" class="text-xs text-neutral-500 mt-1">Pilih paket terlebih dahulu</div>
                        </div>
                    </div>
                    <div class="md:col-span-3 space-y-2">
                        <label class="text-xs font-medium text-neutral-400 block">Pilih Paket & Kuantitas</label>
                        <div class="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-mono">
                            ${options}
                        </div>
                    </div>
                </div>`;

            const modalHtml = `
                <div class="bg-[#0c0c0c] border border-neutral-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl">
                    <div class="flex items-start justify-between px-5 py-4 border-b border-neutral-800 shrink-0 gap-3">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0">
                                <svg class="w-4 h-4 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                            </div>
                            <div>
                                <h3 class="text-sm font-semibold text-neutral-100">Isi Waktu Billing</h3>
                                <p class="text-xs text-neutral-500 mt-0.5">Tambah saldo member</p>
                            </div>
                        </div>
                        <button onclick="Modal.closeModal()" class="w-7 h-7 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-neutral-100 transition-colors flex items-center justify-center shrink-0">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                    <div class="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-mono">
                        ${bodyHtml}
                    </div>
                    <div class="flex items-center justify-end gap-2 px-5 py-4 border-t border-neutral-800 bg-[#080808] shrink-0">
                        <button onclick="Modal.closeModal()" class="px-4 py-2 text-sm font-medium text-neutral-400 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 rounded-lg transition-colors">Batal</button>
                        <button onclick="Member.doAddWaktu(${memberId})" class="px-4 py-2 text-sm font-medium text-black bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors">Tambah Waktu</button>
                    </div>
                </div>`;

            Modal.show(modalHtml);

            paketList.forEach(p => {
                const qtyInput = document.getElementById(`qty-paket-${p.id}`);
                if (qtyInput) {
                    qtyInput.addEventListener('input', () => {
                        let val = parseInt(qtyInput.value);
                        if (isNaN(val) || val < 1) qtyInput.value = 1;
                        Member.updateTotalPreview();
                    });
                }
            });

            Member.updateTotalPreview();
        } catch (err) {
            Toast.error(err.message);
        }
    },

    togglePaketSelection(paketId) {
        const chk = document.getElementById(`chk-paket-${paketId}`);
        const qtyContainer = document.getElementById(`qty-container-${paketId}`);
        const card = document.querySelector(`.select-item[data-paket-id="${paketId}"]`);

        if (chk && qtyContainer && card) {
            if (chk.checked) {
                qtyContainer.classList.remove('opacity-45', 'pointer-events-none');
                card.classList.remove('border-neutral-700', 'bg-[#080808]');
                card.classList.add('border-emerald-500/50', 'bg-[#121212]');
            } else {
                qtyContainer.classList.add('opacity-45', 'pointer-events-none');
                card.classList.remove('border-emerald-500/50', 'bg-[#121212]');
                card.classList.add('border-neutral-700', 'bg-[#080808]');
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
        const previewEl = document.getElementById('tambah-waktu-total-preview');
        if (!previewEl) return;

        let totalMenit = 0;
        let totalHarga = 0;
        let checkedCount = 0;

        document.querySelectorAll('input[type="checkbox"][id^="chk-paket-"]:checked').forEach(chk => {
            const paketId = parseInt(chk.value);
            const qtyInput = document.getElementById(`qty-paket-${paketId}`);
            const qty = qtyInput ? (parseInt(qtyInput.value) || 1) : 1;
            const paket = (MemberRefill._currentPaketList || []).find(p => p.id === paketId);

            if (paket) {
                totalMenit += (paket.durasi_menit || 0) * qty;
                totalHarga += (paket.harga || 0) * qty;
                checkedCount++;
            }
        });

        if (checkedCount > 0) {
            previewEl.innerHTML = `<div class="flex items-center justify-between"><span class="text-[10px] text-neutral-500">Durasi</span><span class="text-sm font-bold text-neutral-100 font-mono">${Utils.formatDurasiFriendly(totalMenit)}</span></div><div class="flex items-center justify-between mt-1.5 pt-1.5 border-t border-neutral-800"><span class="text-[10px] text-neutral-500">Biaya</span><span class="text-sm font-bold text-emerald-400 font-mono">${Utils.formatRupiah(totalHarga)}</span></div>`;
        } else {
            previewEl.innerText = 'Pilih paket terlebih dahulu';
        }
    }
};

window.MemberRefill = MemberRefill;
