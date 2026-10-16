/**
 * Shift Core Sub-module
 * Menangani buka/tutup shift, validasi izin operasional, rekonsiliasi kas, dan cetak handover.
 */
window.ShiftCore = {
    activeShift: null,

    async load(isInitial = false) {
        try {
            const data = await API.shift.active();
            const prevShift = this.activeShift;
            const newShift = (data && data.success && data.shift) ? data.shift : null;

            // Cek apakah ada perubahan status shift
            const isChanged = JSON.stringify(prevShift) !== JSON.stringify(newShift);
            this.activeShift = newShift;

            if (isChanged || isInitial) {
                this.updateSidebarInfo();
            }

            // Hanya kasir yang otomatis dipancing modal buka shift saat load awal dan belum ada shift aktif
            const role = (window.App && window.App.user && window.App.user.role) || '';
            if (isInitial && role === 'kasir' && !this.activeShift) {
                this.showBukaShiftModal();
            }
        } catch (err) {
            console.error('[Shift] Error:', err);
        }
    },

    canOperate() {
        const role = (window.App && window.App.user && window.App.user.role) || '';
        if (role === 'kasir' && !this.activeShift) {
            if (window.Toast) {
                Toast.warning('Harap buka shift kasir terlebih dahulu untuk melayani operasional.');
            }
            this.showBukaShiftModal();
            return false;
        }
        return true;
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
                const startTime = this.formatTimeOnly(this.activeShift.waktu_mulai);
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
            const startTime = this.formatTimeOnly(this.activeShift.waktu_mulai);
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
                        Akhiri Shift
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
            ? this.formatTime(shift.waktu_mulai)
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
                            Alasan Penutupan Paksa <span class="text-neutral-500 text-[10px] font-normal lowercase">(opsional)</span>
                        </label>
                        <textarea id="admin-fc-alasan" rows="3" 
                            class="w-full px-3.5 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] focus:border-red-500/70 rounded-lg text-neutral-200 text-xs lg:max-xl:text-xs xl:text-sm focus:outline-none transition-colors"
                            placeholder="Contoh: Kasir pulang mendadak sakit, kasir lupa tutup shift, dll (opsional)"></textarea>
                        <p class="text-[9px] lg:max-xl:text-[10px] xl:text-xs text-neutral-500 mt-1">Alasan opsional, akan dicatat dalam audit trail keamanan jika diisi.</p>
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
        if (alasan.length > 255) {
            Toast.error('Alasan force-close maksimal 255 karakter');
            return;
        }

        try {
            const res = await API.shift.forceClose({ shift_id: shiftId, alasan: alasan });
            if (!res || !res.success) throw new Error(res?.error || 'Gagal menutup paksa shift');
            
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
                            <input type="text" id="modal-awal-input" value="0" inputmode="numeric" oninput="Utils.formatInputRupiah(this)" onfocus="this.select()"
                                class="w-full pl-10 pr-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-neutral-200 text-sm lg:max-xl:text-sm xl:text-base font-mono focus:border-neutral-500 transition-colors"
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
            const data = await API.shift.start({ modal_awal: modalAwal });
            if (!data || !data.success) throw new Error(data?.error || 'Gagal buka shift');

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
                            <p class="text-[10px] lg:max-xl:text-xs xl:text-sm text-neutral-500">Hitungan buta: hitung uang fisik dengan jujur</p>
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
                        <label for="uang-fisik-input" class="text-xs lg:max-xl:text-xs xl:text-sm font-bold text-neutral-400 uppercase tracking-wider block mb-2">Uang Tunai Fisik di Laci (Rp)</label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-sm lg:max-xl:text-sm xl:text-base">Rp</span>
                            <input type="text" id="uang-fisik-input" value="0" inputmode="numeric" oninput="Utils.formatInputRupiah(this)" onfocus="this.select()"
                                class="w-full pl-10 pr-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-neutral-200 text-sm lg:max-xl:text-sm xl:text-base font-mono focus:border-neutral-500 transition-colors"
                                placeholder="0" autofocus />
                        </div>
                        <p class="text-[9px] lg:max-xl:text-[10px] xl:text-xs 2xl:text-sm text-neutral-500 mt-1 font-normal font-sans">
                            Hitung <span class="text-amber-400 font-bold">uang tunai (cash) saja</span> — QRIS &amp; transfer digital tidak masuk laci.
                        </p>
                    </div>

                    <div>
                        <label for="catatan-shift-input" class="text-xs lg:max-xl:text-xs xl:text-sm font-bold text-neutral-400 uppercase tracking-wider block mb-2">Catatan Akhiri Shift (Opsional)</label>
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
                        class="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs lg:max-xl:text-xs xl:text-sm font-bold rounded-lg transition-colors">Akhiri Shift</button>
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
            const data = await API.shift.end({ uang_fisik: uangFisik, catatan: catatan });
            if (!data || !data.success) throw new Error(data?.error || 'Gagal tutup shift');

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

        // Ambil rincian non-tunai dinamis (support array of objects maupun dict)
        let nonTunaiList = [];
        let totalNonTunai = 0;
        if (rincian && Array.isArray(rincian.non_tunai)) {
            nonTunaiList = rincian.non_tunai;
            totalNonTunai = rincian.total_non_tunai || nonTunaiList.reduce((acc, curr) => acc + (curr.total || 0), 0);
        } else if (rincian && rincian.non_tunai && typeof rincian.non_tunai === 'object') {
            for (const [method, amount] of Object.entries(rincian.non_tunai)) {
                const val = typeof amount === 'object' ? (amount.total || 0) : (amount || 0);
                nonTunaiList.push({ method, total: val });
                totalNonTunai += val;
            }
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
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl w-full max-w-lg lg:max-w-3xl xl:max-w-4xl 2xl:max-w-5xl overflow-hidden shadow-2xl animate-in flex flex-col max-h-[92vh]">
                <!-- Header -->
                <div class="px-4 py-3 lg:px-5 lg:py-3.5 xl:px-6 xl:py-4 border-b border-[#2a2a2a] flex items-center justify-between bg-[#141414] shrink-0">
                    <div>
                        <div class="flex items-center gap-2">
                            <h3 class="text-sm lg:text-base xl:text-lg font-bold text-neutral-100">Rekapitulasi Shift Kasir</h3>
                            ${isForceClose ? '<span class="px-2 py-0.5 text-[9px] lg:text-[10px] xl:text-xs font-bold rounded bg-red-950/80 text-red-400 border border-red-800/60">FORCE CLOSE</span>' : '<span class="px-2 py-0.5 text-[9px] lg:text-[10px] xl:text-xs font-bold rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">SELESAI</span>'}
                        </div>
                        <p class="text-[10px] lg:text-xs text-neutral-500 mt-0.5">Laporan serah terima shift dan rekonsiliasi laci fisik</p>
                    </div>
                    <button onclick="Modal.closeModal()" class="w-7 h-7 lg:w-8 lg:h-8 rounded-lg bg-[#1a1a1a] hover:bg-[#262626] border border-[#2e2e2e] text-neutral-400 hover:text-white flex items-center justify-center text-base font-bold transition-colors">
                        &times;
                    </button>
                </div>

                <!-- Body (Responsive 2-Column on lg, xl, 2xl) -->
                <div class="p-3.5 sm:p-4 lg:p-4 xl:p-5 2xl:p-6 space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3.5 xl:gap-4.5 overflow-y-auto scrollbar-thin text-xs lg:text-[11px] xl:text-xs 2xl:text-sm">
                    <!-- Left Column -->
                    <div class="space-y-2.5 lg:space-y-3 flex flex-col">
                        <!-- Info Petugas & Waktu -->
                        <div class="p-2.5 lg:p-2.5 xl:p-3 rounded-lg bg-[#0a0a0a] border border-[#1e1e1e] space-y-1">
                            <div class="flex justify-between items-center">
                                <span class="text-neutral-500 text-[11px] lg:text-[10.5px] xl:text-xs">Petugas Kasir:</span>
                                <span class="text-neutral-200 font-bold text-xs lg:text-[11px] xl:text-sm">${Utils.escapeHtml(result.kasir_nama || 'Kasir')}</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-neutral-500 text-[11px] lg:text-[10.5px] xl:text-xs">Waktu Mulai:</span>
                                <span class="text-neutral-300 font-mono text-[11px] lg:text-[10.5px] xl:text-xs">${result.waktu_mulai || '-'}</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-neutral-500 text-[11px] lg:text-[10.5px] xl:text-xs">Waktu Selesai:</span>
                                <span class="text-neutral-300 font-mono text-[11px] lg:text-[10.5px] xl:text-xs">${result.waktu_selesai || '-'}</span>
                            </div>
                        </div>

                        <!-- 1. Rincian Penerimaan Tunai -->
                        <div class="p-2.5 lg:p-2.5 xl:p-3 rounded-lg bg-[#0d0d0d] border border-[#202020] space-y-1.5">
                            <div class="flex items-center justify-between pb-1.5 border-b border-[#1c1c1c]">
                                <span class="text-[11px] lg:text-[10.5px] xl:text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                    Penerimaan Tunai (Cash)
                                </span>
                                <span class="text-xs lg:text-[11px] xl:text-sm font-bold text-amber-400 font-mono">${Utils.formatRupiah(totalTunaiBersih)}</span>
                            </div>
                            <div class="space-y-1 pt-0.5 text-[11px] lg:text-[10.5px] xl:text-xs">
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

                        <!-- 3. Penerimaan Digital (Hanya jika ada non-tunai) -->
                        ${nonTunaiList.length > 0 ? `
                        <div class="p-2.5 lg:p-2.5 xl:p-3 rounded-lg bg-[#0d0d0d] border border-cyan-900/30 space-y-1.5">
                            <div class="flex items-center justify-between pb-1.5 border-b border-cyan-900/20">
                                <span class="text-[11px] lg:text-[10.5px] xl:text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                                    Penerimaan Digital
                                </span>
                                <span class="text-xs lg:text-[11px] xl:text-sm font-bold text-cyan-400 font-mono">${Utils.formatRupiah(totalNonTunai)}</span>
                            </div>
                            <div class="space-y-1 pt-0.5">
                                ${nonTunaiRowsHtml}
                            </div>
                        </div>
                        ` : ''}
                    </div>

                    <!-- Right Column -->
                    <div class="space-y-2.5 lg:space-y-3 flex flex-col">
                        <!-- 2. Rekonsiliasi Laci (Tunai) -->
                        <div class="p-2.5 lg:p-2.5 xl:p-3 rounded-lg bg-[#0d0d0d] border border-amber-900/30 space-y-1.5">
                            <div class="text-[11px] lg:text-[10.5px] xl:text-xs font-bold text-amber-400 uppercase tracking-wider pb-1.5 border-b border-amber-900/20 flex items-center gap-1.5">
                                <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                Rekonsiliasi Laci (Tunai)
                            </div>
                            <div class="space-y-1 pt-0.5 text-[11px] lg:text-[10.5px] xl:text-xs">
                                <div class="flex justify-between">
                                    <span class="text-neutral-400">Modal Awal di Laci</span>
                                    <span class="text-neutral-200 font-mono">${Utils.formatRupiah(modalAwal)}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-neutral-400">Total Tunai Masuk (Bersih)</span>
                                    <span class="text-neutral-200 font-mono">${Utils.formatRupiah(totalTunaiBersih)}</span>
                                </div>
                                <div class="flex justify-between pt-1 border-t border-[#1c1c1c] font-semibold items-center">
                                    <span class="text-neutral-300 flex items-center gap-1.5">
                                        <span class="text-[8.5px] lg:text-[8px] xl:text-[9px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700 font-bold tracking-wider">SISTEM</span>
                                        Seharusnya di Laci
                                    </span>
                                    <span class="text-neutral-100 font-mono font-bold">${Utils.formatRupiah(totalFisikSeharusnya)}</span>
                                </div>
                                <div class="flex justify-between font-bold pt-1 items-center">
                                    <span class="text-neutral-300 flex items-center gap-1.5">
                                        <span class="text-[8.5px] lg:text-[8px] xl:text-[9px] px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/50 font-bold tracking-wider">KASIR</span>
                                        Dihitung Fisik
                                    </span>
                                    <span class="text-white font-mono text-xs lg:text-[11.5px] xl:text-sm">
                                        ${uangFisik !== null && uangFisik !== undefined ? Utils.formatRupiah(uangFisik) : '-'}
                                    </span>
                                </div>
                                <div class="flex justify-between items-center pt-1.5 border-t border-[#222]">
                                    <span class="text-neutral-400 font-semibold text-[11px] lg:text-[10.5px] xl:text-xs">Selisih Laci</span>
                                    ${selisihHtml}
                                </div>
                            </div>
                        </div>

                        <!-- Catatan Serah Terima (Jika Ada) -->
                        ${result.catatan ? `
                        <div class="p-2.5 lg:p-2.5 xl:p-3 rounded-lg bg-[#0e0e0e] border border-[#222] space-y-1">
                            <span class="text-[9.5px] lg:text-[9px] xl:text-[10px] text-neutral-500 uppercase font-bold tracking-wider block">Catatan Handover / Audit:</span>
                            <p class="text-neutral-300 italic text-[11px] lg:text-[10px] xl:text-xs break-words whitespace-pre-wrap leading-relaxed">${Utils.escapeHtml(result.catatan)}</p>
                        </div>` : `
                        <div class="p-2.5 lg:p-2.5 xl:p-3 rounded-lg bg-[#0e0e0e]/50 border border-[#1a1a1a] flex items-center justify-center text-center">
                            <span class="text-neutral-600 text-[10px] lg:text-[9.5px] xl:text-xs italic">Tidak ada catatan tambahan</span>
                        </div>`}
                    </div>
                </div>

                <!-- Footer Aksi -->
                <div class="px-4 py-2.5 lg:px-5 lg:py-3 xl:px-6 xl:py-3.5 border-t border-[#2a2a2a] flex flex-wrap justify-between items-center gap-2 bg-[#0c0c0c] shrink-0">
                    <div class="flex gap-2">
                        <button onclick="Shift.printHandover(${JSON.stringify(result).replace(/"/g, "'")})" 
                            class="px-2.5 py-1.5 lg:px-3 lg:py-1.5 xl:px-3.5 xl:py-2 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-300 text-xs lg:text-[10.5px] xl:text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                            Struk Browser
                        </button>
                        ${shiftId ? `
                        <button onclick="Shift.printThermalReceipt(${shiftId})" 
                            class="px-2.5 py-1.5 lg:px-3 lg:py-1.5 xl:px-3.5 xl:py-2 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-300 text-xs lg:text-[10.5px] xl:text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5">
                            <svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                            Thermal 58mm
                        </button>
                        ` : ''}
                    </div>
                    <button onclick="Modal.closeModal()" 
                        class="px-3.5 py-1.5 lg:px-4 lg:py-2 bg-neutral-100 hover:bg-white text-black text-xs lg:text-[10.5px] xl:text-xs font-bold rounded-lg transition-colors">Tutup</button>
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
            const data = await API.shift.receipt(shiftId);
            if (!data || !data.success || !data.receipt_text) {
                throw new Error(data?.error || 'Gagal memuat struk thermal');
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


};
