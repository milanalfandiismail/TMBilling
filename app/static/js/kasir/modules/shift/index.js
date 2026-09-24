// app/static/js/kasir/modules/shift/index.js
// Modul Handover Shift Kasir

const Shift = {
    activeShift: null,

    async load() {
        try {
            const res = await fetch('/api/v1/kasir/shift/active', { credentials: 'include' });
            const data = await res.json();
            if (data.success && data.shift) {
                this.activeShift = data.shift;
            } else {
                this.activeShift = null;
            }
            this.updateSidebarInfo();

            // Hanya kasir yang otomatis dipancing modal buka shift saat belum ada shift aktif
            const role = (window.App && window.App.user && window.App.user.role) || '';
            if (role === 'kasir' && !this.activeShift) {
                this.showBukaShiftModal();
            }
        } catch (err) {
            console.error('[Shift] Error:', err);
        }
    },

    // Cek di awal load apakah kasir perlu buka shift
    checkStartOfDay() {
        this.updateSidebarInfo();
    },

    updateSidebarInfo() {
        const el = document.getElementById('shift-info');
        if (!el) return;

        const role = (window.App && window.App.user && window.App.user.role) || '';

        // Tampilan untuk Admin
        if (role === 'admin') {
            if (this.activeShift) {
                const startTime = this.activeShift.waktu_mulai 
                    ? new Date(this.activeShift.waktu_mulai + 'Z').toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                    : '...';
                el.innerHTML = `
                    <div class="px-2.5 py-2 rounded-lg bg-neutral-900/90 border border-[#222] text-xs">
                        <div class="flex items-center justify-between mb-1.5">
                            <div class="flex items-center gap-1.5 min-w-0">
                                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                                <span class="text-neutral-200 font-semibold truncate text-[11px]">${Utils.escapeHtml(this.activeShift.kasir_nama || 'Kasir')}</span>
                            </div>
                            <span class="text-[10px] font-mono text-neutral-400">${startTime}</span>
                        </div>
                        <button onclick="Shift.showAdminForceCloseModal()" class="w-full py-1.5 px-2 bg-[#161616] hover:bg-[#202020] text-amber-400 hover:text-amber-300 font-bold text-[10px] rounded border border-neutral-700/60 flex items-center justify-center gap-1 transition-colors">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                            Kelola / Force Close
                        </button>
                    </div>
                `;
            } else {
                el.innerHTML = `
                    <div class="px-2.5 py-1.5 rounded-lg bg-neutral-900/50 border border-[#1c1c1c] text-[10px] text-neutral-500 text-center flex items-center justify-center gap-1.5">
                        <span class="w-1.5 h-1.5 rounded-full bg-neutral-600"></span>
                        Tidak Ada Shift Kasir Aktif
                    </div>
                `;
            }
            return;
        }

        // Tampilan untuk Kasir
        if (this.activeShift) {
            const startTime = this.activeShift.waktu_mulai 
                ? new Date(this.activeShift.waktu_mulai + 'Z').toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                : '...';
            el.innerHTML = `
                <div class="px-2.5 py-2 rounded-lg bg-emerald-950/20 border border-emerald-800/30 text-xs">
                    <div class="flex items-center justify-between mb-1">
                        <div class="flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span class="text-emerald-400 font-bold text-[11px]">Shift Aktif</span>
                        </div>
                        <span class="text-[10px] font-mono text-neutral-400">${startTime}</span>
                    </div>
                    <div class="text-[11px] text-neutral-400 font-mono mb-2">Modal: ${Utils.formatRupiah(this.activeShift.modal_awal || 0)}</div>
                    <button onclick="Shift.showTutupShiftModal()" class="w-full py-1.5 px-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white font-bold text-[10px] rounded border border-[#262626] transition-colors flex items-center justify-center gap-1">
                        <svg class="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                        Serah Terima Shift
                    </button>
                </div>
            `;
        } else {
            el.innerHTML = `
                <div class="px-2.5 py-2 rounded-lg bg-amber-950/20 border border-amber-800/30 text-xs">
                    <div class="flex items-center gap-1.5 mb-1.5">
                        <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                        <span class="text-amber-400 font-bold text-[11px]">Belum Buka Shift</span>
                    </div>
                    <button onclick="Shift.showBukaShiftModal()" class="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] rounded transition-colors flex items-center justify-center gap-1 shadow-sm">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                        Buka Shift Kasir
                    </button>
                </div>
            `;
        }
    },

    async showAdminForceCloseModal() {
        if (!this.activeShift) {
            Toast.info('Tidak ada shift kasir yang sedang aktif');
            return;
        }

        const shift = this.activeShift;
        const startTime = shift.waktu_mulai 
            ? new Date(shift.waktu_mulai + 'Z').toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
            : '-';

        const modalHtml = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in">
                <div class="px-6 py-5 border-b border-[#2a2a2a] flex items-center justify-between">
                    <div>
                        <h3 class="text-sm lg:max-xl:text-base xl:text-lg font-bold text-red-400 flex items-center gap-2">
                            <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                            Force Close Shift (Admin)
                        </h3>
                        <p class="text-[10px] lg:max-xl:text-xs xl:text-sm text-neutral-400 mt-1">Tutup paksa shift kasir darurat / berhalangan</p>
                    </div>
                    <button onclick="Modal.closeModal()" class="text-neutral-500 hover:text-white transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
                <div class="px-6 py-5 space-y-4 text-xs lg:max-xl:text-xs xl:text-sm">
                    <div class="p-3.5 rounded-lg bg-neutral-900/80 border border-[#222] space-y-2">
                        <div class="flex justify-between">
                            <span class="text-neutral-500">Kasir:</span>
                            <span class="text-neutral-200 font-bold">${Utils.escapeHtml(shift.kasir_nama || 'Kasir')}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-neutral-500">Mulai Shift:</span>
                            <span class="text-neutral-200 font-mono">${startTime}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-neutral-500">Modal Awal:</span>
                            <span class="text-neutral-200 font-mono">${Utils.formatRupiah(shift.modal_awal || 0)}</span>
                        </div>
                    </div>

                    <div>
                        <label for="admin-fc-alasan" class="text-xs lg:max-xl:text-xs xl:text-sm font-bold text-neutral-300 uppercase tracking-wider block mb-2">
                            Alasan Penutupan Paksa <span class="text-red-400">*</span>
                        </label>
                        <textarea id="admin-fc-alasan" rows="3" 
                            class="w-full px-3.5 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] focus:border-red-500/70 rounded-lg text-neutral-200 text-xs lg:max-xl:text-xs xl:text-sm focus:outline-none transition-colors"
                            placeholder="Contoh: Kasir pulang mendadak sakit, kasir lupa tutup shift, dll (min. 3 karakter)"></textarea>
                        <p class="text-[9px] lg:max-xl:text-[10px] xl:text-xs text-neutral-500 mt-1">Alasan wajib diisi untuk rekam jejak audit keamanan.</p>
                    </div>
                </div>
                <div class="px-6 py-4 border-t border-[#2a2a2a] flex justify-end gap-2 bg-[#0c0c0c]">
                    <button onclick="Modal.closeModal()" 
                        class="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs lg:max-xl:text-xs xl:text-sm font-bold rounded-lg transition-colors">Batal</button>
                    <button onclick="Shift.submitForceClose(${shift.id})" 
                        class="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs lg:max-xl:text-xs xl:text-sm font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                        Tutup Paksa Shift
                    </button>
                </div>
            </div>
        `;
        Modal.show(modalHtml);
    },

    async submitForceClose(shiftId) {
        const alasan = document.getElementById('admin-fc-alasan')?.value?.trim() || '';
        if (!alasan || alasan.length < 3) {
            Toast.error('Alasan force-close minimal 3 karakter');
            return;
        }
        if (alasan.length > 255) {
            Toast.error('Alasan force-close maksimal 255 karakter');
            return;
        }

        try {
            const res = await API.shift.forceClose({ shift_id: shiftId, alasan: alasan });
            if (!res.success) throw new Error(res.error || 'Gagal menutup paksa shift');
            
            Modal.closeModal();
            Toast.success('Shift berhasil ditutup paksa oleh Admin');
            this.activeShift = null;
            this.updateSidebarInfo();
            if (typeof Dashboard !== 'undefined' && Dashboard.load) Dashboard.load();
        } catch (err) {
            Toast.error(err.message || 'Gagal force close shift');
        }
    },

    showBukaShiftModal() {
        // Cek dulu apakah sudah ada shift aktif
        if (this.activeShift) return;

        const modalHtml = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in">
                <div class="px-6 py-5 border-b border-[#2a2a2a]">
                    <h3 class="text-sm lg:max-xl:text-base xl:text-lg font-bold text-neutral-100">Buka Shift Kasir</h3>
                    <p class="text-[10px] lg:max-xl:text-xs xl:text-sm text-neutral-500 mt-1">Masukkan modal awal (uang receh/kembalian) di laci</p>
                </div>
                <div class="px-6 py-5 space-y-4">
                    <div>
                        <label for="modal-awal-input" class="text-xs lg:max-xl:text-xs xl:text-sm font-bold text-neutral-400 uppercase tracking-wider block mb-2">Modal Awal (Rp)</label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-sm lg:max-xl:text-sm xl:text-base">Rp</span>
                            <input type="number" id="modal-awal-input" min="0" value="0"
                                class="w-full pl-10 pr-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-neutral-200 text-sm lg:max-xl:text-sm xl:text-base font-mono focus:border-neutral-500 transition-colors no-spinners [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0" />
                        </div>
                        <p class="text-[9px] lg:max-xl:text-[10px] xl:text-xs 2xl:text-sm text-neutral-500 mt-1 font-normal font-sans">Rp 0 - Rp 100.000.000 (uang receh/kembalian di laci)</p>
                    </div>
                </div>
                <div class="px-6 py-4 border-t border-[#2a2a2a] flex justify-end gap-2">
                    <button onclick="Shift.cancelBukaShift()" 
                        class="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs lg:max-xl:text-xs xl:text-sm font-bold rounded-lg transition-colors">Tutup</button>
                    <button onclick="Shift.submitBukaShift()" 
                        class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs lg:max-xl:text-xs xl:text-sm font-bold rounded-lg transition-colors">Mulai Shift</button>
                </div>
            </div>
        `;
        Modal.show(modalHtml);
    },

    async submitBukaShift() {
        const modalAwal = Utils.parseRupiah(document.getElementById('modal-awal-input')?.value || '0');
        if (modalAwal < 0 || modalAwal > 100000000) {
            Toast.error('Modal awal harus antara Rp0 s/d Rp100.000.000');
            return;
        }

        try {
            const res = await fetch('/api/v1/kasir/shift/start', {
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
                            <h3 class="text-sm lg:max-xl:text-base xl:text-lg font-bold text-neutral-100">Akhiri Shift Kasir</h3>
                            <p class="text-[10px] lg:max-xl:text-xs xl:text-sm text-neutral-500">Hitungan buta — hitung uang fisik dengan jujur</p>
                        </div>
                    </div>
                </div>
                <div class="px-6 py-5 space-y-4">
                    <!-- Blind Count Info -->
                    <div class="p-3 rounded-lg bg-amber-900/10 border border-amber-800/20">
                        <p class="text-xs lg:max-xl:text-xs xl:text-sm text-amber-400 font-bold uppercase tracking-wider flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m0 0v2m0-2h2m-2 0H10m9.364-7.364A9 9 0 115.636 5.636a9 9 0 0112.728 0z"/>
                            </svg>
                            Hitung Buta Aktif
                        </p>
                        <p class="text-[10px] lg:max-xl:text-xs xl:text-sm text-neutral-400 mt-1">Angka pendapatan disembunyikan. Hitung uang fisik di laci dan masukkan jumlahnya.</p>
                    </div>

                    <!-- Shift Info (safe to show — waktu & modal awal saja) -->
                    <div class="bg-[#0a0a0a] border border-[#1c1c1c] rounded-lg p-3 text-xs lg:max-xl:text-xs xl:text-sm space-y-1">
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
                        <label for="uang-fisik-input" class="text-xs lg:max-xl:text-xs xl:text-sm font-bold text-neutral-400 uppercase tracking-wider block mb-2">Uang Fisik di Laci (Rp)</label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-sm lg:max-xl:text-sm xl:text-base">Rp</span>
                            <input type="number" id="uang-fisik-input" min="0" value="0"
                                class="w-full pl-10 pr-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-neutral-200 text-sm lg:max-xl:text-sm xl:text-base font-mono focus:border-neutral-500 transition-colors no-spinners [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0" autofocus />
                        </div>
                        <p class="text-[9px] lg:max-xl:text-[10px] xl:text-xs 2xl:text-sm text-neutral-500 mt-1 font-normal font-sans">Rp 0 - Rp 100.000.000 (hitung seluruh uang tunai fisik di laci)</p>
                    </div>

                    <div>
                        <label for="catatan-shift-input" class="text-xs lg:max-xl:text-xs xl:text-sm font-bold text-neutral-400 uppercase tracking-wider block mb-2">Catatan Serah Terima (Opsional)</label>
                        <textarea id="catatan-shift-input" rows="2" maxlength="255"
                            class="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-neutral-200 text-xs lg:max-xl:text-xs xl:text-sm focus:border-neutral-500 transition-colors resize-none"
                            placeholder="Contoh: Selisih Rp2.000 karena pembulatan / titipan modal kasir selanjutnya"></textarea>
                        <p class="text-[9px] lg:max-xl:text-[10px] xl:text-xs text-neutral-500 mt-1 font-normal">Maksimal 255 karakter</p>
                    </div>
                </div>
                <div class="px-6 py-4 border-t border-[#2a2a2a] flex justify-end gap-2">
                    <button onclick="Modal.closeModal()" 
                        class="px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs lg:max-xl:text-xs xl:text-sm font-bold rounded-lg transition-colors">Batal</button>
                    <button onclick="Shift.submitTutupShift()" 
                        class="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs lg:max-xl:text-xs xl:text-sm font-bold rounded-lg transition-colors">Selesaikan Shift</button>
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
        const uangFisik = Utils.parseRupiah(document.getElementById('uang-fisik-input')?.value || '0');
        const catatan = document.getElementById('catatan-shift-input')?.value?.trim() || '';
        if (uangFisik < 0 || uangFisik > 100000000) {
            Toast.error('Uang fisik harus antara Rp0 s/d Rp100.000.000');
            return;
        }
        if (catatan.length > 255) {
            Toast.error('Catatan shift maksimal 255 karakter');
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
            const res = await fetch('/api/v1/kasir/shift/end', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ uang_fisik: uangFisik, catatan: catatan })
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
        const shiftId = result.id || result.shift_id;
        const rincian = result.rincian_pembayaran || result.detail_metode || null;

        // Hitung atau ambil rincian tunai
        const billingTunai = rincian?.tunai?.billing ?? result.total_billing ?? 0;
        const kantinTunai = rincian?.tunai?.kantin ?? result.total_kantin ?? 0;
        const refundTunai = result.total_refund ?? rincian?.tunai?.refund ?? 0;
        const totalTunaiBersih = rincian?.tunai?.total ?? ((billingTunai + kantinTunai) - refundTunai);

        // Ambil rincian non-tunai dinamis
        let nonTunaiList = [];
        let totalNonTunai = 0;
        if (rincian && Array.isArray(rincian.non_tunai)) {
            nonTunaiList = rincian.non_tunai;
            totalNonTunai = rincian.total_non_tunai || 0;
        } else if (result.breakdown) {
            for (const [method, amount] of Object.entries(result.breakdown)) {
                if (method !== 'Tunai') {
                    nonTunaiList.push({ method, total: amount || 0 });
                    totalNonTunai += (amount || 0);
                }
            }
        }

        // Hitung rekonsiliasi laci fisik
        const modalAwal = result.modal_awal || 0;
        const totalFisikSeharusnya = modalAwal + totalTunaiBersih;
        const uangFisik = result.uang_fisik;
        const selisih = result.selisih;

        let selisihHtml = '';
        if (selisih !== null && selisih !== undefined) {
            if (selisih > 0) {
                selisihHtml = `
                    <span class="text-emerald-400 font-mono font-bold text-xs lg:max-xl:text-xs xl:text-sm flex items-center gap-1.5">
                        <span class="text-[9px] lg:max-xl:text-[10px] xl:text-xs px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 font-bold">SURPLUS (+)</span>
                        Rp ${Utils.formatRawRupiah(selisih)}
                    </span>
                `;
            } else if (selisih < 0) {
                selisihHtml = `
                    <span class="text-red-400 font-mono font-bold text-xs lg:max-xl:text-xs xl:text-sm flex items-center gap-1.5">
                        <span class="text-[9px] lg:max-xl:text-[10px] xl:text-xs px-1.5 py-0.5 rounded bg-red-950/80 text-red-400 border border-red-800/50 font-bold">DEFISIT (-)</span>
                        Rp ${Utils.formatRawRupiah(Math.abs(selisih))}
                    </span>
                `;
            } else {
                selisihHtml = `
                    <span class="text-neutral-300 font-mono font-bold text-xs lg:max-xl:text-xs xl:text-sm flex items-center gap-1.5">
                        <span class="text-[9px] lg:max-xl:text-[10px] xl:text-xs px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700 font-bold">SESUAI / PAS</span>
                        Rp 0
                    </span>
                `;
            }
        } else {
            selisihHtml = '<span class="text-neutral-500 font-mono text-xs italic">- (Penutupan Paksa)</span>';
        }

        let nonTunaiRowsHtml = '';
        if (nonTunaiList.length > 0) {
            nonTunaiRowsHtml = nonTunaiList.map(item => `
                <div class="flex justify-between py-1 text-xs lg:max-xl:text-xs xl:text-sm">
                    <span class="text-neutral-400 flex items-center gap-1.5">
                        <span class="w-1.5 h-1.5 rounded-full bg-cyan-400/80"></span>
                        ${Utils.escapeHtml(item.method)}
                    </span>
                    <span class="text-neutral-200 font-mono">${Utils.formatRupiah(item.total || 0)}</span>
                </div>
            `).join('');
        } else {
            nonTunaiRowsHtml = '<p class="text-neutral-500 text-[10px] lg:max-xl:text-xs xl:text-sm italic py-0.5">Tidak ada penerimaan non-tunai</p>';
        }

        const isForceClose = (result.catatan || '').includes('[FORCE CLOSE');

        const modalHtml = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in">
                <!-- Header -->
                <div class="px-6 py-5 border-b border-[#2a2a2a] flex items-center justify-between">
                    <div>
                        <div class="flex items-center gap-2">
                            <h3 class="text-sm lg:max-xl:text-base xl:text-lg font-bold text-neutral-100">Rekapitulasi Shift Kasir</h3>
                            ${isForceClose ? '<span class="px-2 py-0.5 text-[10px] lg:max-xl:text-xs xl:text-xs font-bold rounded bg-red-950/80 text-red-400 border border-red-800/60">FORCE CLOSE</span>' : '<span class="px-2 py-0.5 text-[10px] lg:max-xl:text-xs xl:text-xs font-bold rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">SELESAI</span>'}
                        </div>
                        <p class="text-[10px] lg:max-xl:text-xs xl:text-sm text-neutral-500 mt-0.5">Laporan serah terima shift dan rekonsiliasi laci fisik</p>
                    </div>
                    <button onclick="Modal.closeModal()" class="text-neutral-500 hover:text-white transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>

                <div class="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto scrollbar-thin text-xs lg:max-xl:text-xs xl:text-sm">
                    <!-- Info Petugas & Waktu -->
                    <div class="p-3 rounded-lg bg-neutral-900/70 border border-[#222] space-y-1.5">
                        <div class="flex justify-between">
                            <span class="text-neutral-500">Kasir:</span>
                            <span class="text-neutral-200 font-bold">${Utils.escapeHtml(result.kasir_nama || 'Kasir')}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-neutral-500">Waktu Mulai:</span>
                            <span class="text-neutral-300 font-mono">${result.waktu_mulai || '-'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-neutral-500">Waktu Selesai:</span>
                            <span class="text-neutral-300 font-mono">${result.waktu_selesai || '-'}</span>
                        </div>
                    </div>

                    <!-- 1. Rincian Penerimaan Tunai -->
                    <div class="p-3.5 rounded-lg bg-[#0d0d0d] border border-[#202020] space-y-2">
                        <div class="flex items-center justify-between pb-1.5 border-b border-[#1c1c1c]">
                            <span class="text-xs lg:max-xl:text-xs xl:text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                                <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                                Penerimaan Tunai (Cash)
                            </span>
                            <span class="text-xs lg:max-xl:text-xs xl:text-sm font-bold text-amber-400 font-mono">${Utils.formatRupiah(totalTunaiBersih)}</span>
                        </div>
                        <div class="space-y-1 pt-1 text-xs lg:max-xl:text-xs xl:text-sm">
                            <div class="flex justify-between">
                                <span class="text-neutral-400">Billing Rental Tunai</span>
                                <span class="text-neutral-200 font-mono">${Utils.formatRupiah(billingTunai)}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-neutral-400">Kantin / F&B Tunai</span>
                                <span class="text-neutral-200 font-mono">${Utils.formatRupiah(kantinTunai)}</span>
                            </div>
                            ${refundTunai > 0 ? `
                            <div class="flex justify-between text-red-400">
                                <span>Refund Paket Tunai</span>
                                <span class="font-mono">- ${Utils.formatRupiah(refundTunai)}</span>
                            </div>` : ''}
                        </div>
                    </div>

                    <!-- 2. Rincian Penerimaan Non-Tunai Dinamis -->
                    <div class="p-3.5 rounded-lg bg-[#0d0d0d] border border-[#202020] space-y-2">
                        <div class="flex items-center justify-between pb-1.5 border-b border-[#1c1c1c]">
                            <span class="text-xs lg:max-xl:text-xs xl:text-sm font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                                <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
                                Penerimaan Non-Tunai (Digital)
                            </span>
                            <span class="text-xs lg:max-xl:text-xs xl:text-sm font-bold text-cyan-400 font-mono">${Utils.formatRupiah(totalNonTunai)}</span>
                        </div>
                        <div class="space-y-1 pt-1">
                            ${nonTunaiRowsHtml}
                        </div>
                    </div>

                    <!-- 3. Rekonsiliasi Laci Kasir -->
                    <div class="p-3.5 rounded-lg bg-neutral-900/90 border border-[#262626] space-y-2">
                        <div class="text-xs lg:max-xl:text-xs xl:text-sm font-bold text-neutral-300 uppercase tracking-wider pb-1.5 border-b border-[#222]">
                            Rekonsiliasi Laci Kasir
                        </div>
                        <div class="space-y-1.5 pt-1 text-xs lg:max-xl:text-xs xl:text-sm">
                            <div class="flex justify-between">
                                <span class="text-neutral-400">Modal Awal di Laci</span>
                                <span class="text-neutral-200 font-mono">${Utils.formatRupiah(modalAwal)}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-neutral-400">Total Tunai Masuk (Bersih)</span>
                                <span class="text-neutral-200 font-mono">${Utils.formatRupiah(totalTunaiBersih)}</span>
                            </div>
                            <div class="flex justify-between pt-1 border-t border-[#1c1c1c] font-semibold">
                                <span class="text-neutral-300">Total Seharusnya di Laci</span>
                                <span class="text-neutral-100 font-mono">${Utils.formatRupiah(totalFisikSeharusnya)}</span>
                            </div>
                            <div class="flex justify-between font-bold pt-1">
                                <span class="text-neutral-300">Uang Fisik Aktual di Laci</span>
                                <span class="text-white font-mono text-xs lg:max-xl:text-sm xl:text-base">${uangFisik !== null && uangFisik !== undefined ? Utils.formatRupiah(uangFisik) : '-'}</span>
                            </div>
                            <div class="flex justify-between items-center pt-1.5 border-t border-[#222]">
                                <span class="text-neutral-400 font-semibold">Selisih Keuangan</span>
                                ${selisihHtml}
                            </div>
                        </div>
                    </div>

                    <!-- Catatan Serah Terima -->
                    ${result.catatan ? `
                    <div class="p-3 rounded-lg bg-[#0e0e0e] border border-[#222] space-y-1">
                        <span class="text-[10px] lg:max-xl:text-xs xl:text-xs text-neutral-500 uppercase font-bold tracking-wider">Catatan Handover / Audit:</span>
                        <p class="text-neutral-300 italic text-[11px] lg:max-xl:text-xs xl:text-sm break-words whitespace-pre-wrap">${Utils.escapeHtml(result.catatan)}</p>
                    </div>` : ''}
                </div>

                <!-- Footer Aksi -->
                <div class="px-6 py-4 border-t border-[#2a2a2a] flex flex-wrap justify-between items-center gap-2 bg-[#0c0c0c]">
                    <div class="flex gap-2">
                        <button onclick="Shift.printHandover(${JSON.stringify(result).replace(/"/g, "'")})" 
                            class="px-3 lg:max-xl:px-3.5 xl:px-4 py-2 lg:max-xl:py-2.5 xl:py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-300 text-xs lg:max-xl:text-xs xl:text-sm font-bold rounded-lg transition-colors flex items-center gap-1.5">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                            Struk Browser
                        </button>
                        ${shiftId ? `
                        <button onclick="Shift.printThermalReceipt(${shiftId})" 
                            class="px-3 lg:max-xl:px-3.5 xl:px-4 py-2 lg:max-xl:py-2.5 xl:py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-300 text-xs lg:max-xl:text-xs xl:text-sm font-bold rounded-lg transition-colors flex items-center gap-1.5">
                            <svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                            Thermal 58mm
                        </button>
                        ` : ''}
                    </div>
                    <button onclick="Modal.closeModal()" 
                        class="px-4 py-2 bg-neutral-100 hover:bg-white text-black text-xs lg:max-xl:text-xs xl:text-sm font-bold rounded-lg transition-colors">Tutup</button>
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

        const rincian = result.rincian_pembayaran || result.detail_metode || null;
        const billingTunai = rincian?.tunai?.billing ?? result.total_billing ?? 0;
        const kantinTunai = rincian?.tunai?.kantin ?? result.total_kantin ?? 0;
        const refundTunai = result.total_refund ?? rincian?.tunai?.refund ?? 0;
        const totalTunaiBersih = rincian?.tunai?.total ?? ((billingTunai + kantinTunai) - refundTunai);

        const totalFisikSeharusnya = (result.modal_awal || 0) + totalTunaiBersih;
        const uangFisik = result.uang_fisik !== null && result.uang_fisik !== undefined 
            ? 'Rp ' + Utils.formatRawRupiah(result.uang_fisik) 
            : '-';

        let nonTunaiList = [];
        if (rincian && Array.isArray(rincian.non_tunai)) {
            nonTunaiList = rincian.non_tunai;
        } else if (result.breakdown) {
            for (const [m, a] of Object.entries(result.breakdown)) {
                if (m !== 'Tunai') nonTunaiList.push({ method: m, total: a || 0 });
            }
        }

        let nonTunaiPrint = '';
        if (nonTunaiList.length > 0) {
            nonTunaiPrint = '<div class="line"></div><div class="header" style="font-size:9px; text-align:left; margin-bottom:2px;">NON-TUNAI (DIGITAL):</div>';
            nonTunaiList.forEach(item => {
                nonTunaiPrint += `<div class="row"><span class="label"> - ${item.method}</span><span class="value">Rp ${Utils.formatRawRupiah(item.total || 0)}</span></div>`;
            });
        }

        let catatanPrint = '';
        if (result.catatan) {
            catatanPrint = `<div class="line"></div><div class="row"><span class="label">Catatan:</span><span class="value" style="font-weight:normal; text-align:right;">${Utils.escapeHtml(result.catatan)}</span></div>`;
        }

        let selisihPrint = '';
        if (result.selisih !== null && result.selisih !== undefined) {
            const label = result.selisih > 0 ? 'SURPLUS (+)' : (result.selisih < 0 ? 'DEFISIT (-)' : 'SESUAI (PAS)');
            selisihPrint = `<div class="selisih-label">${label} Rp ${Utils.formatRawRupiah(Math.abs(result.selisih))}</div>`;
        } else {
            selisihPrint = '<div class="selisih-label">PENUTUPAN PAKSA</div>';
        }

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
    <div class="row"><span class="label">Mulai</span><span class="value">${waktuMulai}</span></div>
    <div class="row"><span class="label">Selesai</span><span class="value">${waktuSelesai}</span></div>
    <div class="line"></div>
    <div class="row"><span class="label">Billing Tunai</span><span class="value">Rp ${Utils.formatRawRupiah(billingTunai)}</span></div>
    <div class="row"><span class="label">Kantin Tunai</span><span class="value">Rp ${Utils.formatRawRupiah(kantinTunai)}</span></div>
    ${refundTunai > 0 ? `<div class="row"><span class="label">Refund Tunai</span><span class="value">-Rp ${Utils.formatRawRupiah(refundTunai)}</span></div>` : ''}
    <div class="row totals"><span class="label">TOTAL TUNAI</span><span class="value">Rp ${Utils.formatRawRupiah(totalTunaiBersih)}</span></div>
    ${nonTunaiPrint}
    <div class="line"></div>
    <div class="row"><span class="label">Modal Awal Laci</span><span class="value">Rp ${modalAwal}</span></div>
    <div class="row"><span class="label">Seharusnya Laci</span><span class="value">Rp ${Utils.formatRawRupiah(totalFisikSeharusnya)}</span></div>
    <div class="row totals"><span class="label">Uang Fisik Laci</span><span class="value">${uangFisik}</span></div>
    ${selisihPrint}
    ${catatanPrint}
    <div class="line" style="border-top: 1px solid #000;"></div>
    <div class="footer">Terima kasih<br>Dicetak: ${new Date().toLocaleString('id-ID')}</div>
</body>
</html>`;

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

    async printThermalReceipt(shiftId) {
        if (!shiftId) {
            Toast.error('ID Shift tidak valid');
            return;
        }
        try {
            const res = await fetch(`/api/v1/kasir/shift/receipt/${shiftId}`, { credentials: 'include' });
            const data = await res.json();
            if (!data.success || !data.receipt_text) {
                throw new Error(data.error || 'Gagal memuat struk thermal');
            }

            const printContent = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Struk Thermal Shift</title>
<style>
    @page { margin: 0; size: 58mm auto; }
    body { font-family: 'Courier New', monospace; font-size: 10px; line-height: 1.2; margin: 0; padding: 6px; width: 58mm; color: #000; white-space: pre; }
</style>
</head>
<body>${Utils.escapeHtml(data.receipt_text)}</body>
</html>`;

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
        } catch (err) {
            Toast.error('Gagal mencetak struk thermal: ' + err.message);
        }
    },

    async loadHistory(params = {}) {
        const container = document.getElementById('shift-history-rows');
        if (!container) return;

        container.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-8 text-neutral-500 text-xs">
                    <div class="inline-block w-5 h-5 border-2 border-neutral-600 border-t-amber-400 rounded-full animate-spin mr-2 align-middle"></div>
                    Memuat riwayat serah terima shift...
                </td>
            </tr>
        `;

        try {
            const tanggalMulai = document.getElementById('filter-shift-mulai')?.value || params.tanggal_mulai || '';
            const tanggalSelesai = document.getElementById('filter-shift-selesai')?.value || params.tanggal_selesai || '';
            const kasirId = document.getElementById('filter-shift-kasir')?.value || params.kasir_id || '';

            const res = await API.shift.history({
                tanggal_mulai: tanggalMulai,
                tanggal_selesai: tanggalSelesai,
                kasir_id: kasirId,
                limit: 50
            });

            if (!res.success) throw new Error(res.error || 'Gagal memuat riwayat');

            const shifts = res.shifts?.data || [];
            if (shifts.length === 0) {
                container.innerHTML = `
                    <tr>
                        <td colspan="9" class="text-center py-8 text-neutral-500 text-xs">
                            Tidak ada data riwayat shift ditemukan
                        </td>
                    </tr>
                `;
                return;
            }

            container.innerHTML = shifts.map(s => {
                const isForceClose = (s.catatan || '').includes('[FORCE CLOSE');
                let selisihBadge = '';
                if (s.selisih !== null && s.selisih !== undefined) {
                    if (s.selisih > 0) {
                        selisihBadge = `<span class="px-1.5 py-0.5 rounded text-[10px] lg:max-xl:text-xs xl:text-sm font-bold bg-emerald-950/70 text-emerald-400 border border-emerald-800/40 font-mono">+${Utils.formatRawRupiah(s.selisih)}</span>`;
                    } else if (s.selisih < 0) {
                        selisihBadge = `<span class="px-1.5 py-0.5 rounded text-[10px] lg:max-xl:text-xs xl:text-sm font-bold bg-red-950/70 text-red-400 border border-red-800/40 font-mono">-${Utils.formatRawRupiah(Math.abs(s.selisih))}</span>`;
                    } else {
                        selisihBadge = `<span class="px-1.5 py-0.5 rounded text-[10px] lg:max-xl:text-xs xl:text-sm font-bold bg-neutral-800 text-neutral-300 font-mono">Rp 0</span>`;
                    }
                } else {
                    selisihBadge = '<span class="text-neutral-500 font-mono text-[10px] lg:max-xl:text-xs xl:text-sm">-</span>';
                }

                const statusBadge = isForceClose
                    ? '<span class="px-2 py-0.5 rounded text-[10px] lg:max-xl:text-xs xl:text-sm font-bold bg-red-950/70 text-red-400 border border-red-800/40">FORCE CLOSE</span>'
                    : '<span class="px-2 py-0.5 rounded text-[10px] lg:max-xl:text-xs xl:text-sm font-bold bg-emerald-950/70 text-emerald-400 border border-emerald-800/40">SELESAI</span>';

                return `
                    <tr class="hover:bg-[#141414] transition-colors border-b border-[#1c1c1c] text-xs lg:max-xl:text-xs xl:text-base">
                        <td class="px-4 lg:max-xl:px-4 xl:px-6 py-3 lg:max-xl:py-2.5 xl:py-4 font-mono text-neutral-400">#${s.id}</td>
                        <td class="px-4 lg:max-xl:px-4 xl:px-6 py-3 lg:max-xl:py-2.5 xl:py-4">
                            <div class="font-bold text-neutral-200">${Utils.escapeHtml(s.kasir_nama || 'Kasir')}</div>
                            <div class="text-[10px] lg:max-xl:text-xs xl:text-sm text-neutral-500 font-mono">${s.waktu_mulai || '-'} s/d ${s.waktu_selesai ? s.waktu_selesai.split(' ')[1] : '-'}</div>
                        </td>
                        <td class="px-4 lg:max-xl:px-4 xl:px-6 py-3 lg:max-xl:py-2.5 xl:py-4 font-mono text-neutral-300">${Utils.formatRupiah(s.modal_awal || 0)}</td>
                        <td class="px-4 lg:max-xl:px-4 xl:px-6 py-3 lg:max-xl:py-2.5 xl:py-4 font-mono text-neutral-300">${Utils.formatRupiah(s.total_billing || 0)}</td>
                        <td class="px-4 lg:max-xl:px-4 xl:px-6 py-3 lg:max-xl:py-2.5 xl:py-4 font-mono text-neutral-300">${Utils.formatRupiah(s.total_kantin || 0)}</td>
                        <td class="px-4 lg:max-xl:px-4 xl:px-6 py-3 lg:max-xl:py-2.5 xl:py-4 font-mono font-bold text-neutral-100">${s.uang_fisik !== null && s.uang_fisik !== undefined ? Utils.formatRupiah(s.uang_fisik) : '-'}</td>
                        <td class="px-4 lg:max-xl:px-4 xl:px-6 py-3 lg:max-xl:py-2.5 xl:py-4">${selisihBadge}</td>
                        <td class="px-4 lg:max-xl:px-4 xl:px-6 py-3 lg:max-xl:py-2.5 xl:py-4">${statusBadge}</td>
                        <td class="px-4 lg:max-xl:px-4 xl:px-6 py-3 lg:max-xl:py-2.5 xl:py-4 text-right">
                            <div class="flex items-center justify-end gap-1.5">
                                <button onclick="Shift.viewShiftDetail(${s.id})" title="Lihat Rekapitulasi"
                                    class="p-1.5 lg:max-xl:p-2 xl:p-2.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white transition-colors">
                                    <svg class="w-3.5 h-3.5 lg:max-xl:w-4 lg:max-xl:h-4 xl:w-5 xl:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                </button>
                                <button onclick="Shift.printThermalReceipt(${s.id})" title="Cetak Struk Thermal 58mm"
                                    class="p-1.5 lg:max-xl:p-2 xl:p-2.5 rounded bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/40 text-amber-400 hover:text-amber-300 transition-colors">
                                    <svg class="w-3.5 h-3.5 lg:max-xl:w-4 lg:max-xl:h-4 xl:w-5 xl:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (err) {
            container.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-6 text-red-400 text-xs lg:text-base">
                        Error memuat riwayat: ${Utils.escapeHtml(err.message)}
                    </td>
                </tr>
            `;
        }
    },

    async viewShiftDetail(shiftId) {
        try {
            const res = await API.shift.getSummary(shiftId);
            if (!res.success || !res.summary) {
                throw new Error(res.error || 'Gagal memuat ringkasan shift');
            }
            this.showHasilShift(res.summary);
        } catch (err) {
            Toast.error('Gagal membuka rekap shift: ' + err.message);
        }
    },

    async loadUserLogs(params = {}) {
        const container = document.getElementById('user-logs-rows');
        if (!container) return;

        container.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-8 text-neutral-500 text-xs lg:text-base">
                    <div class="inline-block w-5 h-5 border-2 border-neutral-600 border-t-cyan-400 rounded-full animate-spin mr-2 align-middle"></div>
                    Memuat log aktivitas staff...
                </td>
            </tr>
        `;

        try {
            const search = document.getElementById('filter-user-logs-search')?.value?.trim() || '';
            const actionType = document.getElementById('filter-user-logs-action')?.value || '';

            const res = await API.report.logs(search, 200, '');
            const rawLogs = res.logs || [];

            // Filter log yang relevan dengan aktivitas staf
            const staffActionKeywords = ['SHIFT', 'USER', 'RESET_KUOTA', 'LOGIN', 'LOGOUT'];
            const staffLogs = rawLogs.filter(log => {
                const act = (log.action || '').toUpperCase();
                const matchesKeyword = staffActionKeywords.some(kw => act.includes(kw));
                if (!matchesKeyword) return false;
                if (actionType && !act.includes(actionType.toUpperCase())) return false;
                return true;
            });

            if (staffLogs.length === 0) {
                container.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center py-8 text-neutral-500 text-xs lg:text-base">
                            Tidak ada log aktivitas staff yang cocok dengan filter
                        </td>
                    </tr>
                `;
                return;
            }

            container.innerHTML = staffLogs.map(log => {
                const act = (log.action || '').toUpperCase();
                let badgeClass = 'bg-neutral-800 text-neutral-300 border-neutral-700';
                if (act.includes('BUKA')) badgeClass = 'bg-emerald-950/70 text-emerald-400 border-emerald-800/40';
                else if (act.includes('TUTUP')) badgeClass = 'bg-blue-950/70 text-blue-400 border-blue-800/40';
                else if (act.includes('FORCE_CLOSE') || act.includes('GAGAL') || act.includes('HAPUS')) badgeClass = 'bg-red-950/70 text-red-400 border-red-800/40';
                else if (act.includes('KUOTA') || act.includes('UPDATE')) badgeClass = 'bg-purple-950/70 text-purple-400 border-purple-800/40';
                else if (act.includes('LOGIN')) badgeClass = 'bg-amber-950/70 text-amber-400 border-amber-800/40';

                return `
                    <tr class="hover:bg-[#141414] transition-colors border-b border-[#1c1c1c] text-xs lg:max-xl:text-xs xl:text-base">
                        <td class="px-4 lg:max-xl:px-4 xl:px-6 py-3 lg:max-xl:py-2.5 xl:py-4 font-mono text-neutral-400 whitespace-nowrap">${log.timestamp || '-'}</td>
                        <td class="px-4 lg:max-xl:px-4 xl:px-6 py-3 lg:max-xl:py-2.5 xl:py-4 font-bold text-neutral-200 whitespace-nowrap">
                            <span class="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700 font-mono text-[11px] lg:max-xl:text-xs xl:text-sm">${Utils.escapeHtml(log.user || 'system')}</span>
                        </td>
                        <td class="px-4 lg:max-xl:px-4 xl:px-6 py-3 lg:max-xl:py-2.5 xl:py-4 whitespace-nowrap">
                            <span class="px-2 py-0.5 rounded text-[10px] lg:max-xl:text-xs xl:text-sm font-bold border ${badgeClass}">${Utils.escapeHtml(log.action || '-')}</span>
                        </td>
                        <td class="px-4 lg:max-xl:px-4 xl:px-6 py-3 lg:max-xl:py-2.5 xl:py-4 text-neutral-300 break-words whitespace-pre-wrap">${Utils.escapeHtml(log.detail || '-')}</td>
                        <td class="px-4 lg:max-xl:px-4 xl:px-6 py-3 lg:max-xl:py-2.5 xl:py-4 font-mono text-[11px] lg:max-xl:text-xs xl:text-sm text-neutral-500 whitespace-nowrap">${log.ip_address || '-'}</td>
                    </tr>
                `;
            }).join('');
        } catch (err) {
            container.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-6 text-red-400 text-xs lg:text-base">
                        Error memuat log: ${Utils.escapeHtml(err.message)}
                    </td>
                </tr>
            `;
        }
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

