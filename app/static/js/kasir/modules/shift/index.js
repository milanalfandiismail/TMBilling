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
                        <h3 class="text-base font-bold text-red-400 flex items-center gap-2">
                            <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                            Force Close Shift (Admin)
                        </h3>
                        <p class="text-xs text-neutral-400 mt-1">Tutup paksa shift kasir darurat / berhalangan</p>
                    </div>
                    <button onclick="Modal.closeModal()" class="text-neutral-500 hover:text-white transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
                <div class="px-6 py-5 space-y-4">
                    <div class="p-3.5 rounded-lg bg-neutral-900/80 border border-[#222] space-y-2 text-xs">
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
                        <label for="admin-fc-alasan" class="text-xs font-bold text-neutral-300 uppercase tracking-wider block mb-2">
                            Alasan Penutupan Paksa <span class="text-red-400">*</span>
                        </label>
                        <textarea id="admin-fc-alasan" rows="3" 
                            class="w-full px-3.5 py-2.5 bg-[#0a0a0a] border border-[#2a2a2a] focus:border-red-500/70 rounded-lg text-neutral-200 text-xs focus:outline-none transition-colors"
                            placeholder="Contoh: Kasir pulang mendadak sakit, kasir lupa tutup shift, dll (min. 3 karakter)"></textarea>
                        <p class="text-[10px] text-neutral-500 mt-1">Alasan wajib diisi untuk rekam jejak audit keamanan.</p>
                    </div>
                </div>
                <div class="px-6 py-4 border-t border-[#2a2a2a] flex justify-end gap-2 bg-[#0c0c0c]">
                    <button onclick="Modal.closeModal()" 
                        class="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-400 text-xs font-bold rounded-lg transition-colors">Batal</button>
                    <button onclick="Shift.submitForceClose(${shift.id})" 
                        class="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm">
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
                    <h3 class="text-base font-bold text-neutral-100">Buka Shift Kasir</h3>
                    <p class="text-xs text-neutral-500 mt-1">Masukkan modal awal (uang receh/kembalian) di laci</p>
                </div>
                <div class="px-6 py-5 space-y-4">
                    <div>
                        <label for="modal-awal-input" class="text-xs font-bold text-neutral-400 uppercase tracking-wider block mb-2">Modal Awal (Rp)</label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-sm">Rp</span>
                            <input type="number" id="modal-awal-input" min="0" value="0"
                                class="w-full pl-10 pr-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-neutral-200 text-sm font-mono focus:border-neutral-500 transition-colors"
                                placeholder="0" />
                        </div>
                        <p class="text-[9px] lg:max-xl:text-[10px] xl:text-xs 2xl:text-sm text-neutral-500 mt-1 font-normal font-sans">Rp 0 - Rp 100.000.000 (uang receh/kembalian di laci)</p>
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
                        <label for="uang-fisik-input" class="text-xs font-bold text-neutral-400 uppercase tracking-wider block mb-2">Uang Fisik di Laci (Rp)</label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-sm">Rp</span>
                            <input type="number" id="uang-fisik-input" min="0" value="0"
                                class="w-full pl-10 pr-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-neutral-200 text-sm font-mono focus:border-neutral-500 transition-colors"
                                placeholder="0" autofocus />
                        </div>
                        <p class="text-[9px] lg:max-xl:text-[10px] xl:text-xs 2xl:text-sm text-neutral-500 mt-1 font-normal font-sans">Rp 0 - Rp 100.000.000 (hitung seluruh uang tunai fisik di laci)</p>
                    </div>

                    <div>
                        <label for="catatan-shift-input" class="text-xs font-bold text-neutral-400 uppercase tracking-wider block mb-2">Catatan Serah Terima (Opsional)</label>
                        <textarea id="catatan-shift-input" rows="2" maxlength="255"
                            class="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-neutral-200 text-xs focus:border-neutral-500 transition-colors resize-none"
                            placeholder="Contoh: Selisih Rp2.000 karena pembulatan / titipan modal kasir selanjutnya"></textarea>
                        <p class="text-[9px] text-neutral-500 mt-1 font-normal">Maksimal 255 karakter</p>
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
        const selisihClass = result.selisih >= 0 ? 'text-emerald-400' : 'text-red-400';
        const selisihLabel = result.selisih >= 0 ? 'SURPLUS' : 'DEFISIT';

        let breakdownHtml = '';
        if (result.breakdown) {
            breakdownHtml = '<div class="border-t border-[#1c1c1c] pt-2 mt-2 space-y-1"><span class="text-[10px] text-neutral-500 uppercase font-bold">Rincian Metode Pembayaran:</span>';
            for (const [method, amount] of Object.entries(result.breakdown)) {
                breakdownHtml += `
                    <div class="flex justify-between">
                        <span class="text-neutral-400">- ${method}</span>
                        <span class="text-neutral-300 font-mono">${Utils.formatRupiah(amount || 0)}</span>
                    </div>
                `;
            }
            breakdownHtml += '</div>';
        }

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
                        ${breakdownHtml}
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
                        ${result.catatan ? `
                        <div class="border-t border-[#1c1c1c] pt-2 flex flex-col gap-1">
                            <span class="text-[10px] text-neutral-500 uppercase font-bold">Catatan Handover:</span>
                            <p class="text-neutral-300 italic text-[11px] bg-[#141414] p-2 rounded border border-[#222]">${Utils.escapeHtml(result.catatan)}</p>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <div class="px-6 py-4 border-t border-[#2a2a2a] flex flex-wrap justify-between items-center gap-2">
                    <div class="flex gap-2">
                        <button onclick="Shift.printHandover(${JSON.stringify(result).replace(/"/g, "'")})" 
                            class="px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-300 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                            </svg>
                            Struk HTML
                        </button>
                        ${result.id ? `
                        <button onclick="Shift.printThermalReceipt(${result.id})" 
                            class="px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222] text-neutral-300 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5">
                            <svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                            </svg>
                            Thermal 58mm
                        </button>
                        ` : ''}
                    </div>
                    <button onclick="Modal.closeModal()" 
                        class="px-4 py-2 bg-neutral-100 hover:bg-white text-black text-xs font-bold rounded-lg transition-colors">Tutup</button>
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

        let breakdownPrint = '';
        if (result.breakdown) {
            breakdownPrint = '<div class="line"></div><div class="header" style="font-size:9px; margin-bottom: 2px;">RINCIAN PEMBAYARAN:</div>';
            for (const [method, amount] of Object.entries(result.breakdown)) {
                breakdownPrint += `<div class="row"><span class="label"> - ${method}</span><span class="value">Rp ${Utils.formatRawRupiah(amount || 0)}</span></div>`;
            }
        }

        let catatanPrint = '';
        if (result.catatan) {
            catatanPrint = `<div class="line"></div><div class="row"><span class="label">Catatan:</span><span class="value" style="font-weight:normal; text-align:right;">${Utils.escapeHtml(result.catatan)}</span></div>`;
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
    <div class="row"><span class="label">Waktu Mulai</span><span class="value">${waktuMulai}</span></div>
    <div class="row"><span class="label">Waktu Selesai</span><span class="value">${waktuSelesai}</span></div>
    <div class="line"></div>
    <div class="row"><span class="label">Modal Awal</span><span class="value">Rp ${modalAwal}</span></div>
    <div class="row"><span class="label">Pendapatan Billing</span><span class="value">Rp ${billing}</span></div>
    <div class="row"><span class="label">Pendapatan Kantin</span><span class="value">Rp ${kantin}</span></div>
    <div class="row totals"><span class="label">TOTAL PENDAPATAN</span><span class="value">Rp ${totalPendapatan}</span></div>
    ${breakdownPrint}
    <div class="line"></div>
    <div class="row"><span class="label">Uang Fisik</span><span class="value">Rp ${uangFisik}</span></div>
    <div class="selisih-label">${result.selisih >= 0 ? 'SURPLUS' : 'DEFISIT'} Rp ${Math.abs(result.selisih || 0).toLocaleString('id-ID')}</div>
    ${catatanPrint}
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

