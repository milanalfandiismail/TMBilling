/**
 * Dashboard - Refund Modal Sub-module
 * Menangani modal kalkulasi pengembalian (refund) sisa waktu paket tamu dan member.
 */
window.Dashboard = window.Dashboard || {};
Object.assign(window.Dashboard, {
    async showGuestRefundModal(sesiId) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        try {
            const [sesiRes, paketRes] = await Promise.all([
                API.sesi.detail(sesiId),
                API.sesi.getRiwayatPaket(sesiId)
            ]);
            const sesi = sesiRes.data || sesiRes;
            const riwayatPaket = paketRes.paket || [];

            let riwayatHtml = '';
            if (riwayatPaket.length === 0) {
                riwayatHtml = `<div class="text-center py-10 text-neutral-500 text-xs lg:text-base font-bold uppercase tracking-wider">Tidak ada riwayat paket refundable</div>`;
            } else {
                riwayatHtml = `
                    <div class="divide-y divide-[#1c1c1c]/60 max-h-[350px] overflow-y-auto pr-1 scrollbar-mono">
                        ${riwayatPaket.map(t => `
                            <div class="py-3 flex items-center justify-between gap-3">
                                <div class="min-w-0 flex-1">
                                    <div class="font-bold text-neutral-200 text-xs lg:text-base lg:truncate break-words whitespace-normal font-mono">${t.nama}</div>
                                    <div class="text-[9px] lg:text-base text-neutral-400 mt-0.5 font-semibold">
                                        QTY : <span class="text-neutral-200">${t.qty || 1}x</span> (${Utils.formatDurasiFriendly(t.durasi_menit)})
                                    </div>
                                    <div class="text-[9px] lg:text-base text-neutral-500 font-mono mt-0.5">
                                        ${t.dibuat_pada}
                                    </div>
                                </div>
                                <div class="text-right flex items-center gap-3">
                                    <span class="text-xs lg:text-base font-mono font-bold text-neutral-300">${Utils.formatRupiah(t.harga)}</span>
                                    <button onclick="Dashboard.refundGuestPaket(${sesiId}, ${t.id}, '${t.nama.replace(/'/g, "\\'")}', ${t.durasi_menit}, '${t.dibuat_pada}', ${sesi.sisa_waktu || 0})" 
                                        class="px-2 py-1 text-[9px] lg:text-xs font-bold bg-[#3b1216] border border-[#ef4444]/30 text-red-200 hover:bg-red-600 hover:text-white rounded transition-colors uppercase shrink-0 font-mono">
                                        REFUND
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            const detailHtml = `
                <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded-xl p-4 md:p-6 max-w-lg w-[calc(100%-2rem)] mx-auto md:w-full max-h-[85vh] overflow-y-auto scrollbar-thin my-auto">
                    <div class="flex items-center justify-between mb-4 pb-4 border-b border-[#1c1c1c]">
                        <div>
                            <h3 class="text-xs lg:text-base font-bold text-neutral-200 uppercase tracking-wider font-mono">Refund Paket Guest</h3>
                            <p class="text-[9px] lg:text-base text-neutral-500 mt-0.5">Riwayat Pembelian Paket Sesi Ini</p>
                        </div>
                        <button onclick="Modal.closeModal()" class="text-neutral-500 hover:text-neutral-300 text-xl leading-none">&times;</button>
                    </div>
                    <div class="bg-[#050505] border border-[#1c1c1c] rounded p-4">
                        ${riwayatHtml}
                    </div>
                    <div class="flex gap-3 justify-end mt-6 pt-4 border-t border-[#1c1c1c]">
                        <button onclick="Modal.closeModal()" class="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs lg:text-base font-bold rounded-lg transition-colors font-mono">Tutup</button>
                    </div>
                </div>`;
            Modal.show(detailHtml);
        } catch (err) {
            Toast.error('Gagal mengambil detail riwayat paket: ' + err.message);
        }
    },

    attachEvents() {
        if (window.DashboardSelection) {
            window.DashboardSelection.init();
        }
    },

    async refundGuestPaket(sesiId, transaksiId, namaPaket, durasiMenit, dibuatPada, sisaWaktuSekarang) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        const durasiFriendly = Utils.formatDurasiFriendly(durasiMenit);
        const sisaSekarangFriendly = Utils.formatDurasiFriendly(sisaWaktuSekarang);
        const setelahDeduction = Math.max(0, sisaWaktuSekarang - durasiMenit);
        const setelahDeductionFriendly = Utils.formatDurasiFriendly(setelahDeduction);

        const confirmHtml = `
            <div class="text-center space-y-2">
                <p class="text-xs lg:text-base text-neutral-400 font-bold uppercase tracking-wider">Refund Paket Billing Guest?</p>
                <div class="bg-[#050505] border border-[#2a2a2a] rounded-lg p-3 my-2 text-left space-y-1.5 font-mono">
                    <div class="flex justify-between text-neutral-300 text-xs lg:text-sm">
                        <span>Paket:</span>
                        <span class="font-bold text-neutral-200 text-right">${namaPaket}</span>
                    </div>
                    <div class="flex justify-between text-neutral-300 text-xs lg:text-sm border-t border-[#1c1c1c] pt-1.5">
                        <span>Total Waktu Sekarang:</span>
                        <span class="font-bold text-neutral-300 text-right">${sisaSekarangFriendly}</span>
                    </div>
                    <div class="flex justify-between text-neutral-300 text-xs lg:text-sm">
                        <span>Potongan Refund:</span>
                        <span class="font-bold text-red-400 text-right">-${durasiFriendly}</span>
                    </div>
                    <div class="flex justify-between text-neutral-300 text-xs lg:text-sm border-t border-[#1c1c1c]/80 pt-1.5">
                        <span>Total Akhir Waktu:</span>
                        <span class="font-bold text-emerald-400 text-right">${setelahDeductionFriendly}</span>
                    </div>
                    <div class="flex justify-between text-neutral-300 text-xs lg:text-sm border-t border-[#1c1c1c]/80 pt-1.5">
                        <span>Pembelian:</span>
                        <span class="text-neutral-400 text-right">${dibuatPada}</span>
                    </div>
                </div>
                <p class="text-[10px] lg:text-base text-neutral-500 mt-1">Total waktu bermain guest akan dikurangi menjadi <strong>${setelahDeductionFriendly}</strong>.</p>
            </div>
        `;
        Modal.confirm(confirmHtml, async () => {
            try {
                const res = await API.sesi.refundPaket(sesiId, transaksiId);
                Toast.success(res.message || 'Refund berhasil');
                Modal.closeModal();
                this.load();
            } catch (err) {
                Toast.error(err.message || 'Gagal refund');
            }
        });
    },

    async showMemberRefundModal(memberId) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        try {
            const [memberRes, paketRes] = await Promise.all([
                API.member.get(memberId),
                API.member.getPaket(memberId)
            ]);
            const member = memberRes.member || memberRes.data || memberRes;
            const riwayatPaket = paketRes.paket || [];

            let riwayatHtml = '';
            if (riwayatPaket.length === 0) {
                riwayatHtml = `<div class="text-center py-10 text-neutral-500 text-xs lg:text-base font-bold uppercase tracking-wider">Tidak ada riwayat paket refundable</div>`;
            } else {
                riwayatHtml = `
                    <div class="divide-y divide-[#1c1c1c]/60 max-h-[350px] overflow-y-auto pr-1 scrollbar-mono">
                        ${riwayatPaket.map(t => `
                            <div class="py-3 flex items-center justify-between gap-3">
                                <div class="min-w-0 flex-1">
                                    <div class="font-bold text-neutral-200 text-xs lg:text-base lg:truncate break-words whitespace-normal font-mono">${t.nama}</div>
                                    <div class="text-[9px] lg:text-base text-neutral-400 mt-0.5 font-semibold">
                                        QTY : <span class="text-neutral-200">${t.qty || 1}x</span> (${Utils.formatDurasiFriendly(t.durasi_menit)})
                                    </div>
                                    <div class="text-[9px] lg:text-base text-neutral-500 font-mono mt-0.5">
                                        ${t.dibuat_pada}
                                    </div>
                                </div>
                                <div class="text-right flex items-center gap-3">
                                    <span class="text-xs lg:text-base font-mono font-bold text-neutral-300">${Utils.formatRupiah(t.harga)}</span>
                                    <button onclick="Dashboard.refundMemberPaket(${memberId}, ${t.id}, '${t.nama.replace(/'/g, "\\'")}', ${t.durasi_menit}, '${t.dibuat_pada}', ${member.waktu_saved || member.waktu_tersimpan || 0})" 
                                        class="px-2 py-1 text-[9px] lg:text-xs font-bold bg-[#3b1216] border border-[#ef4444]/30 text-red-200 hover:bg-red-600 hover:text-white rounded transition-colors uppercase shrink-0 font-mono">
                                        REFUND
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            const detailHtml = `
                <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded-xl p-4 md:p-6 max-w-lg w-[calc(100%-2rem)] mx-auto md:w-full max-h-[85vh] overflow-y-auto scrollbar-thin my-auto">
                    <div class="flex items-center justify-between mb-4 pb-4 border-b border-[#1c1c1c]">
                        <div>
                            <h3 class="text-xs lg:text-base font-bold text-neutral-200 uppercase tracking-wider font-mono">Refund Paket Member</h3>
                            <p class="text-[9px] lg:text-base text-neutral-500 mt-0.5">Riwayat Pembelian Paket Member Ini</p>
                        </div>
                        <button onclick="Modal.closeModal()" class="text-neutral-500 hover:text-neutral-300 text-xl leading-none">&times;</button>
                    </div>
                    <div class="bg-[#050505] border border-[#1c1c1c] rounded p-4">
                        ${riwayatHtml}
                    </div>
                    <div class="flex gap-3 justify-end mt-6 pt-4 border-t border-[#1c1c1c]">
                        <button onclick="Modal.closeModal()" class="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs lg:text-base font-bold rounded-lg transition-colors font-mono">Tutup</button>
                    </div>
                </div>`;
            Modal.show(detailHtml);
        } catch (err) {
            Toast.error('Gagal mengambil detail riwayat paket: ' + err.message);
        }
    },

    async refundMemberPaket(memberId, transaksiId, namaPaket, durasiMenit, dibuatPada, sisaWaktuSekarang) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        const durasiFriendly = Utils.formatDurasiFriendly(durasiMenit);
        const sisaSekarangFriendly = Utils.formatDurasiFriendly(sisaWaktuSekarang);
        const setelahDeduction = Math.max(0, sisaWaktuSekarang - durasiMenit);
        const setelahDeductionFriendly = Utils.formatDurasiFriendly(setelahDeduction);

        const confirmHtml = `
            <div class="text-center space-y-2">
                <p class="text-xs lg:text-base text-neutral-400 font-bold uppercase tracking-wider">Refund Paket Billing Member?</p>
                <div class="bg-[#050505] border border-[#2a2a2a] rounded-lg p-3 my-2 text-left space-y-1.5 font-mono">
                    <div class="flex justify-between text-neutral-300 text-xs lg:text-sm">
                        <span>Paket:</span>
                        <span class="font-bold text-neutral-200 text-right">${namaPaket}</span>
                    </div>
                    <div class="flex justify-between text-neutral-300 text-xs lg:text-sm border-t border-[#1c1c1c] pt-1.5">
                        <span>Total Waktu Sekarang:</span>
                        <span class="font-bold text-neutral-300 text-right">${sisaSekarangFriendly}</span>
                    </div>
                    <div class="flex justify-between text-neutral-300 text-xs lg:text-sm">
                        <span>Potongan Refund:</span>
                        <span class="font-bold text-red-400 text-right">-${durasiFriendly}</span>
                    </div>
                    <div class="flex justify-between text-neutral-300 text-xs lg:text-sm border-t border-[#1c1c1c]/80 pt-1.5">
                        <span>Total Akhir Waktu:</span>
                        <span class="font-bold text-emerald-400 text-right">${setelahDeductionFriendly}</span>
                    </div>
                    <div class="flex justify-between text-neutral-300 text-xs lg:text-sm border-t border-[#1c1c1c]/80 pt-1.5">
                        <span>Pembelian:</span>
                        <span class="text-neutral-400 text-right">${dibuatPada}</span>
                    </div>
                </div>
                <p class="text-[10px] lg:text-base text-neutral-500 mt-1">Total waktu bermain member akan dikurangi menjadi <strong>${setelahDeductionFriendly}</strong>.</p>
            </div>
        `;
        Modal.confirm(confirmHtml, async () => {
            try {
                const res = await API.member.refundPaket(memberId, transaksiId);
                Toast.success(res.message || 'Refund berhasil');
                Modal.closeModal();
                this.load();
            } catch (err) {
                Toast.error(err.message || 'Gagal refund');
            }
        });
    },

});
