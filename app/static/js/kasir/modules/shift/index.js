// app/static/js/kasir/modules/shift/index.js
// Modul Handover Shift Kasir

const Shift = {
    activeShift: null,

    async load() {
        try {
            const res = await fetch('/api/shift/active', { credentials: 'include' });
            const data = await res.json();
            if (data.success && data.shift) {
                this.activeShift = data.shift;
                this.checkStartOfDay();
            } else {
                this.activeShift = null;
                this.showBukaShiftModal();
            }
        } catch (err) {
            console.error('[Shift] Error:', err);
        }
    },

    // Cek di awal load apakah kasir perlu buka shift
    checkStartOfDay() {
        // Shift aktif ditemukan — sembunyikan modal buka
        // Tapi update sidebar dengan info shift
        this.updateSidebarInfo();
    },

    updateSidebarInfo() {
        const el = document.getElementById('shift-info');
        if (!el) return;
        if (this.activeShift) {
            const startTime = this.activeShift.waktu_mulai 
                ? new Date(this.activeShift.waktu_mulai + 'Z').toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                : '...';
            el.innerHTML = `
                <div class="px-3 py-2 rounded-lg bg-emerald-900/20 border border-emerald-800/30 text-xs">
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span class="text-emerald-400 font-bold">Shift Aktif</span>
                    </div>
                    <div class="text-neutral-400 mt-1 font-mono">Buka: ${startTime}</div>
                    <div class="text-neutral-400 font-mono">Modal: ${Utils.formatRupiah(this.activeShift.modal_awal || 0)}</div>
                </div>
            `;
        } else {
            el.innerHTML = `
                <div class="px-3 py-2 rounded-lg bg-amber-900/20 border border-amber-800/30 text-xs">
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                        <span class="text-amber-400 font-bold">Belum Buka Shift</span>
                    </div>
                    <button onclick="Shift.showBukaShiftModal()" class="mt-2 w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded transition-colors">BUKA SHIFT</button>
                </div>
            `;
        }
    },

    showBukaShiftModal() {
        // Cek dulu apakah sudah ada shift aktif
        if (this.activeShift) return;

        const modalHtml = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in">
                <div class="px-6 py-5 border-b border-[#2a2a2a]">
                    <h3 class="text-base font-bold text-neutral-100">Buka Shift Kasir</h3>
                    <p class="text-xs text-neutral-500 mt-1">Masukkan modal awal (uang receh/kembalian) di laci</p>
                </div>
                <div class="px-6 py-5 space-y-4">
                    <div>
                        <label class="text-xs font-bold text-neutral-400 uppercase tracking-wider block mb-2">Modal Awal (Rp)</label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-sm">Rp</span>
                            <input type="number" id="modal-awal-input" min="0" value="0"
                                class="w-full pl-10 pr-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-neutral-200 text-sm font-mono focus:border-neutral-500 transition-colors"
                                placeholder="0" />
                        </div>
                        <p class="text-[10px] text-neutral-500 mt-1.5">Jumlah uang receh/kembalian yang disiapkan di laci kasir</p>
                    </div>
                </div>
                <div class="px-6 py-4 border-t border-[#2a2a2a] flex justify-end gap-2">
                    <button onclick="Shift.cancelBukaShift()" 
                        class="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs font-bold rounded-lg transition-colors">Tutup</button>
                    <button onclick="Shift.submitBukaShift()" 
                        class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors">Mulai Shift</button>
                </div>
            </div>
        `;
        Modal.show(modalHtml);
    },

    async submitBukaShift() {
        const modalAwal = parseInt(document.getElementById('modal-awal-input')?.value || '0');
        if (modalAwal < 0) {
            Toast.error('Modal awal tidak boleh negatif');
            return;
        }

        try {
            const res = await fetch('/api/shift/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ modal_awal: modalAwal })
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${res.status}`);
            }
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Gagal buka shift');

            this.activeShift = data.shift;
            this.updateSidebarInfo();
            Modal.closeModal();
            Toast.success(`Shift berhasil dibuka! Modal: ${Utils.formatRupiah(modalAwal || 0)}`);

            // Trigger dashboard reload biar segar
            if (typeof Dashboard !== 'undefined' && Dashboard.load) Dashboard.load();
        } catch (err) {
            Toast.error(err.message);
        }
    },

    cancelBukaShift() {
        Modal.closeModal();
    },

    showTutupShiftModal() {
        if (!this.activeShift) {
            Toast.error('Tidak ada shift aktif');
            return;
        }

        // HITUNG BUTA — angka pendapatan seharusnya TIDAK ditampilkan
        const modalHtml = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in">
                <div class="px-6 py-5 border-b border-[#2a2a2a]">
                    <div class="flex items-center gap-3 mb-1">
                        <div class="w-8 h-8 rounded-lg bg-amber-900/30 border border-amber-800/40 flex items-center justify-center">
                            <span class="text-amber-400 text-sm font-bold">!</span>
                        </div>
                        <div>
                            <h3 class="text-sm font-bold text-neutral-100">Akhiri Shift Kasir</h3>
                            <p class="text-[10px] text-neutral-500">Hitungan buta — hitung uang fisik dengan jujur</p>
                        </div>
                    </div>
                </div>
                <div class="px-6 py-5 space-y-4">
                    <!-- Blind Count Info -->
                    <div class="p-3 rounded-lg bg-amber-900/10 border border-amber-800/20">
                        <p class="text-xs text-amber-400 font-bold uppercase tracking-wider flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m0 0v2m0-2h2m-2 0H10m9.364-7.364A9 9 0 115.636 5.636a9 9 0 0112.728 0z"/>
                            </svg>
                            Hitung Buta Aktif
                        </p>
                        <p class="text-[10px] text-neutral-400 mt-1">Angka pendapatan disembunyikan. Hitung uang fisik di laci dan masukkan jumlahnya.</p>
                    </div>

                    <!-- Shift Info (safe to show — waktu & modal awal saja) -->
                    <div class="bg-[#0a0a0a] border border-[#1c1c1c] rounded-lg p-3 text-xs space-y-1">
                        <div class="flex justify-between">
                            <span class="text-neutral-500">Waktu Mulai</span>
                            <span class="text-neutral-300 font-mono">${this.formatTime(this.activeShift.waktu_mulai)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-neutral-500">Modal Awal</span>
                            <span class="text-neutral-300 font-mono">${Utils.formatRupiah(this.activeShift.modal_awal || 0)}</span>
                        </div>
                        <div class="border-t border-[#1c1c1c] pt-1 mt-1 flex justify-between">
                            <span class="text-neutral-500">Pendapatan Seharusnya</span>
                            <span class="text-neutral-600 font-mono italic">— (disembunyikan)</span>
                        </div>
                    </div>

                    <div>
                        <label class="text-xs font-bold text-neutral-400 uppercase tracking-wider block mb-2">Uang Fisik di Laci (Rp)</label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-sm">Rp</span>
                            <input type="number" id="uang-fisik-input" min="0" value="0"
                                class="w-full pl-10 pr-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-neutral-200 text-sm font-mono focus:border-neutral-500 transition-colors"
                                placeholder="0" autofocus />
                        </div>
                        <p class="text-[10px] text-neutral-500 mt-1.5">Jumlah uang yang kamu hitung secara fisik di laci</p>
                    </div>
                </div>
                <div class="px-6 py-4 border-t border-[#2a2a2a] flex justify-end gap-2">
                    <button onclick="Modal.closeModal()" 
                        class="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs font-bold rounded-lg transition-colors">Batal</button>
                    <button onclick="Shift.submitTutupShift()" 
                        class="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors">Selesaikan Shift</button>
                </div>
            </div>
        `;
        Modal.show(modalHtml);

        // Auto-focus input uang fisik
        setTimeout(() => {
            const input = document.getElementById('uang-fisik-input');
            if (input) input.focus();
        }, 200);
    },

    async submitTutupShift() {
        const uangFisik = parseInt(document.getElementById('uang-fisik-input')?.value || '0');
        if (uangFisik < 0) {
            Toast.error('Uang fisik tidak boleh negatif');
            return;
        }
        if (uangFisik === 0) {
            const confirmed = await new Promise(resolve => {
                Modal.confirm(
                    '<div class="text-center"><p class="text-sm text-neutral-400 font-bold">Yakin uang fisik Rp 0?</p><p class="text-xs text-neutral-500 mt-1">Pastikan kamu sudah menghitung semua uang di laci.</p></div>',
                    () => resolve(true),
                    () => resolve(false)
                );
            });
            if (!confirmed) return;
        }

        try {
            const res = await fetch('/api/shift/end', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ uang_fisik: uangFisik })
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${res.status}`);
            }
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Gagal tutup shift');

            const r = data.result;

            // Tampilkan hasil (sekarang baru boleh liat)
            this.showHasilShift(r);
            this.activeShift = null;
            this.updateSidebarInfo();

            // Refresh dashboard
            if (typeof Dashboard !== 'undefined' && Dashboard.load) Dashboard.load();
        } catch (err) {
            Toast.error(err.message);
        }
    },

    showHasilShift(result) {
        const selisihClass = result.selisih >= 0 ? 'text-emerald-400' : 'text-red-400';
        const selisihLabel = result.selisih >= 0 ? 'SURPLUS' : 'DEFISIT';

        const modalHtml = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in">
                <div class="px-6 py-5 border-b border-[#2a2a2a]">
                    <h3 class="text-base font-bold text-neutral-100">Shift Selesai ✅</h3>
                    <p class="text-xs text-neutral-500 mt-1">Handover shift kasir berhasil dicatat</p>
                </div>
                <div class="px-6 py-5 space-y-3 text-xs">
                    <div class="bg-[#0a0a0a] border border-[#1c1c1c] rounded-lg p-4 space-y-2.5">
                        <div class="flex justify-between">
                            <span class="text-neutral-500">Kasir</span>
                            <span class="text-neutral-200 font-bold">${result.kasir_nama}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-neutral-500">Waktu Mulai</span>
                            <span class="text-neutral-300 font-mono">${result.waktu_mulai}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-neutral-500">Waktu Selesai</span>
                            <span class="text-neutral-300 font-mono">${result.waktu_selesai}</span>
                        </div>
                        <div class="border-t border-[#1c1c1c] pt-2"></div>
                        <div class="flex justify-between">
                            <span class="text-neutral-500">Modal Awal</span>
                            <span class="text-neutral-300 font-mono">${Utils.formatRupiah(result.modal_awal || 0)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-neutral-500">Pendapatan Billing</span>
                            <span class="text-emerald-300 font-mono">${Utils.formatRupiah(result.total_billing || 0)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-neutral-500">Pendapatan Kantin</span>
                            <span class="text-amber-300 font-mono">${Utils.formatRupiah(result.total_kantin || 0)}</span>
                        </div>
                        <div class="flex justify-between font-bold">
                            <span class="text-neutral-300">Total Pendapatan</span>
                            <span class="text-neutral-100 font-mono">${Utils.formatRupiah(result.total_pendapatan || 0)}</span>
                        </div>
                        <div class="border-t border-[#1c1c1c] pt-2"></div>
                        <div class="flex justify-between">
                            <span class="text-neutral-400">Uang Fisik</span>
                            <span class="text-neutral-100 font-mono font-bold">${Utils.formatRupiah(result.uang_fisik || 0)}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-neutral-400">Selisih</span>
                            <span class="${selisihClass} font-mono font-bold text-sm flex items-center gap-1.5">
                                <span class="text-[9px] px-1.5 py-0.5 rounded ${result.selisih >= 0 ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'} font-bold">${selisihLabel}</span>
                                Rp ${Utils.formatRawRupiah(Math.abs(result.selisih) || 0)}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="px-6 py-4 border-t border-[#2a2a2a] flex justify-between gap-2">
                    <button onclick="Shift.printHandover(${JSON.stringify(result).replace(/"/g, "'")})" 
                        class="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-300 text-xs font-bold rounded-lg transition-colors flex items-center gap-2">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                        </svg>
                        Cetak Struk
                    </button>
                    <button onclick="Modal.closeModal()" 
                        class="px-4 py-2.5 bg-neutral-100 hover:bg-white text-black text-xs font-bold rounded-lg transition-colors">Tutup</button>
                </div>
            </div>
        `;
        Modal.show(modalHtml);
    },

    printHandover(result) {
        const kasirNama = result.kasir_nama || 'Kasir';
        const waktuMulai = result.waktu_mulai || '-';
        const waktuSelesai = result.waktu_selesai || '-';
        const modalAwal = Utils.formatRawRupiah(result.modal_awal || 0);
        const billing = Utils.formatRawRupiah(result.total_billing || 0);
        const kantin = Utils.formatRawRupiah(result.total_kantin || 0);
        const totalPendapatan = Utils.formatRawRupiah(result.total_pendapatan || 0);
        const uangFisik = Utils.formatRawRupiah(result.uang_fisik || 0);
        const selisih = Utils.formatRawRupiah(result.selisih || 0);
        const selisihLabel = result.selisih >= 0 ? 'SURPLUS' : 'DEFISIT';

        const printContent = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Struk Handover Shift</title>
<style>
    @page { margin: 0; size: 58mm auto; }
    body { font-family: 'Courier New', monospace; font-size: 10px; margin: 0; padding: 8px; width: 58mm; color: #000; }
    .header { text-align: center; font-weight: bold; font-size: 12px; margin-bottom: 4px; }
    .sub { text-align: center; font-size: 9px; margin-bottom: 8px; }
    .line { border-top: 1px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; padding: 1px 0; }
    .label { }
    .value { font-weight: bold; }
    .totals { font-weight: bold; font-size: 11px; }
    .selisih-label { text-align: center; font-weight: bold; font-size: 11px; margin: 4px 0; }
    .footer { text-align: center; font-size: 9px; margin-top: 8px; }
</style>
</head>
<body>
    <div class="header">LAPORAN HANDOVER SHIFT</div>
    <div class="sub">${waktuSelesai}</div>
    <div class="line"></div>
    <div class="row"><span class="label">Kasir</span><span class="value">${kasirNama}</span></div>
    <div class="row"><span class="label">Waktu Mulai</span><span class="value">${waktuMulai}</span></div>
    <div class="row"><span class="label">Waktu Selesai</span><span class="value">${waktuSelesai}</span></div>
    <div class="line"></div>
    <div class="row"><span class="label">Modal Awal</span><span class="value">Rp ${modalAwal}</span></div>
    <div class="row"><span class="label">Pendapatan Billing</span><span class="value">Rp ${billing}</span></div>
    <div class="row"><span class="label">Pendapatan Kantin</span><span class="value">Rp ${kantin}</span></div>
    <div class="row totals"><span class="label">TOTAL PENDAPATAN</span><span class="value">Rp ${totalPendapatan}</span></div>
    <div class="line"></div>
    <div class="row"><span class="label">Uang Fisik</span><span class="value">Rp ${uangFisik}</span></div>
    <div class="selisih-label">${selisihLabel} Rp ${Math.abs(result.selisih || 0).toLocaleString('id-ID')}</div>
    <div class="line" style="border-top: 1px solid #000;"></div>
    <div class="footer">Terima kasih<br>Dicetak: ${new Date().toLocaleString('id-ID')}</div>
</body>
</html>`;

        // Cetak via iframe — standar pola existing
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(printContent);
        doc.close();
        setTimeout(() => {
            iframe.contentWindow.print();
            setTimeout(() => document.body.removeChild(iframe), 500);
        }, 300);
    },

    formatTime(dt) {
        if (!dt) return '-';
        try {
            return new Date(dt + 'Z').toLocaleString('id-ID', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });
        } catch (e) {
            return dt;
        }
    }
};

window.Shift = Shift;
console.log('[Shift] Module initialized.');
