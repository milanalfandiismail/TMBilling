const Blackout = {
    currentDate: null,
    allData: [],

    async load() {
        await this.loadDates();
    },

    async loadDates() {
        try {
            const data = await API.blackout.dates();
            const dates = data.dates || [];
            this.renderDatePicker(dates);
            if (dates.length > 0) {
                this.currentDate = dates[0];
                await this.loadList(dates[0]);
            } else {
                this.renderEmpty();
            }
        } catch (err) {
            console.error("Blackout load error:", err);
        }
    },

    renderDatePicker(dates) {
        const el = document.getElementById('blackout-date-picker');
        if (!el) return;
        el.innerHTML = dates.length === 0
            ? '<option value="">— Tidak Ada Data —</option>'
            : dates.map(d => `<option value="${d}">${d}</option>`).join('');
        el.onchange = () => this.loadList(el.value);
    },

    async loadList(date) {
        this.currentDate = date;
        const area = document.getElementById('blackout-list');
        if (!area) return;
        area.innerHTML = '<div class="flex justify-center py-12"><div class="w-6 h-6 border-2 border-[#1c1c1c] border-t-neutral-100 rounded-full animate-spin"></div></div>';

        try {
            const data = await API.blackout.list(date);
            this.allData = data.data || [];
            await this.populateGroupFilter();
            this.applyFilters();
        } catch (err) {
            area.innerHTML = '<div class="text-center text-neutral-500 py-10 text-xs lg:text-base">Gagal memuat data</div>';
        }
    },

    renderEmpty() {
        const area = document.getElementById('blackout-list');
        if (!area) return;
        area.innerHTML = `
            <div class="flex flex-col items-center justify-center py-16 text-neutral-500 bg-[#0c0c0c] border border-dashed border-[#1c1c1c] rounded">
                <svg class="w-12 h-12 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                <p class="text-xs lg:text-base font-bold uppercase tracking-wider text-neutral-300">Sistem Stabil</p>
                <p class="text-[10px] lg:text-base mt-1 text-neutral-500">Tidak ada sesi blackout yang terdeteksi.</p>
            </div>`;
    },

    async populateGroupFilter() {
        const select = document.getElementById('blackout-group-filter');
        if (!select) return;
        
        const prevVal = select.value;
        let groups = [];
        try {
            const res = await API.grup.list();
            // API returns { "grup": [{id, nama, ...}] }
            groups = (res.grup || []).map(g => g.nama.toLowerCase());
        } catch (err) {
            // Fallback jika API gagal
            groups = [...new Set(this.allData.map(s => s.grup).filter(Boolean))];
        }
        
        let html = '<option value="all">Semua Grup</option>';
        groups.forEach(g => {
            html += `<option value="${g}">${g.toUpperCase()}</option>`;
        });
        select.innerHTML = html;
        
        if (groups.includes(prevVal)) {
            select.value = prevVal;
        } else {
            select.value = 'all';
        }
    },

    applyFilters() {
        const filterType = document.getElementById('blackout-type-filter')?.value || 'all';
        const filterGroup = document.getElementById('blackout-group-filter')?.value || 'all';
        
        const filtered = this.allData.filter(s => {
            const matchType = filterType === 'all' || s.tipe === filterType;
            const matchGroup = filterGroup === 'all' || s.grup === filterGroup;
            return matchType && matchGroup;
        });
        
        this.renderList(filtered);
    },

    renderList(list) {
        const area = document.getElementById('blackout-list');
        if (!area) return;
        if (list.length === 0) {
            area.innerHTML = '<div class="text-center text-neutral-500 py-12 text-xs lg:text-base">— Tidak Ada Riwayat Blackout —</div>';
            return;
        }

        const pending = list.filter(s => !s.is_blackout_resolved);
        const resolved = list.filter(s => s.is_blackout_resolved);

        let html = '';

        if (pending.length > 0) {
            html += `
                <div class="mb-4 flex items-center gap-2">
                    <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                    <h4 class="text-xs lg:text-base font-bold text-red-400 uppercase tracking-wider">Tertunda (${pending.length})</h4>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">`;
            pending.forEach(s => { html += this.renderCard(s); });
            html += '</div>';
        }

        if (resolved.length > 0) {
            html += `
                <div class="mb-4 flex items-center justify-between">
                    <h4 class="text-xs lg:text-base font-bold text-neutral-400 uppercase tracking-wider">Selesai (${resolved.length})</h4>
                    <button onclick="Blackout.clearResolved()" class="text-xs lg:text-base text-red-400 hover:text-red-300 font-bold uppercase tracking-wider transition-colors">Bersihkan Log</button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60">`;
            resolved.forEach(s => { html += this.renderCard(s, true); });
            html += '</div>';
        }

        area.innerHTML = html;
    },

    renderCard(s, resolved = false) {
        const isMember = s.tipe === 'member';
        let aksiHtml = '';

        if (!resolved) {
            if (isMember) {
                aksiHtml = `
                    <div class="flex gap-2">
                        <button onclick="Blackout.resolveMember(${s.id}, '${s.username}', ${s.sisa_waktu_mati})" 
                            class="px-3 py-1.5 bg-[#171717] hover:bg-neutral-100 border border-[#262626] text-neutral-300 hover:text-black text-xs lg:text-base font-bold rounded transition-colors">KEMBALIKAN ${s.sisa_waktu_mati}m</button>
                        <button onclick="Blackout.resolveGuestTutup(${s.id}, '${s.username}')" 
                            class="px-3 py-1.5 bg-[#2d1215] hover:bg-[#ef4444] border border-[#ef4444]/30 text-red-400 hover:text-white text-xs lg:text-base font-bold rounded transition-colors">TUTUP</button>
                    </div>`;
            } else {
                aksiHtml = `
                    <div class="flex gap-2 flex-wrap">
                        <button onclick="Blackout.resolveGuestSama(${s.id}, '${s.username}')" 
                            class="px-3 py-1.5 bg-[#0c0c0c] border border-[#1c1c1c] hover:bg-[#171717] text-neutral-300 text-xs lg:text-base font-bold rounded transition-colors">PC SAMA</button>
                        <button onclick="Blackout.showLanjutModal(${s.id}, '${s.username}', '${s.grup}')" 
                            class="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-black text-xs lg:text-base font-bold rounded transition-colors">PINDAH PC</button>
                        <button onclick="Blackout.resolveGuestTutup(${s.id}, '${s.username}')" 
                            class="px-3 py-1.5 bg-[#2d1215] hover:bg-[#ef4444] border border-[#ef4444]/30 text-red-400 hover:text-white text-xs lg:text-base font-bold rounded transition-colors">TUTUP</button>
                    </div>`;
            }
        } else {
            aksiHtml = `<span class="text-xs lg:text-base font-bold text-neutral-400 flex items-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg> Teratasi</span>`;
        }

        const borderClass = resolved ? 'border-[#1c1c1c] opacity-50' : 'border-[#262626]';

        return `
            <div class="bg-[#0c0c0c] border ${borderClass} rounded p-4 relative">
                <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded bg-[#171717] border border-[#262626] flex items-center justify-center shrink-0">
                        ${isMember
                            ? '<svg class="w-5 h-5 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>'
                            : '<svg class="w-5 h-5 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>'}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-[9px] lg:text-base font-bold px-2 py-0.5 rounded bg-[#050505] text-neutral-400 border border-[#1c1c1c]">${isMember ? 'MEMBER' : 'TAMU'}</span>
                            <span class="text-xs lg:text-base font-bold text-neutral-200 lg:truncate break-words whitespace-normal font-mono">${s.username}</span>
                        </div>
                        <div class="flex items-center gap-3 text-[11px] text-neutral-500">
                            <span class="text-neutral-300 font-bold font-mono">PC ${s.pc_kode}</span>
                            <span class="font-mono">${s.grup}</span>
                            <span class="font-mono">Pukul: ${s.jam_mati}</span>
                            <span class="text-neutral-300 font-mono">Sisa: ${Utils.formatMenit(s.sisa_waktu_mati)}</span>
                        </div>
                    </div>
                </div>
                <div class="mt-3 pt-3 border-t border-[#1c1c1c] flex justify-end">
                    ${aksiHtml}
                </div>
            </div>`;
    },

    async deteksi() {
        const thresholdSelect = document.getElementById('blackout-threshold');
        const threshold = thresholdSelect ? parseInt(thresholdSelect.value) : 60;
        try {
            const result = await API.blackout.deteksi(threshold);
            if (result.total > 0) {
                Toast.success(`✅ ${result.message}`);
                await this.loadDates();
                if (typeof Dashboard !== 'undefined') await Dashboard.load();
            } else {
                Toast.success('Tidak ada sesi blackout yang terdeteksi.');
            }
        } catch (err) {
            Toast.error('Deteksi Gagal: ' + err.message);
        }
    },

    async resolveMember(sesiId, username, sisa) {
        const message = `<div class="text-center"><p class="text-xs lg:text-base text-neutral-400">Refund <span class="text-neutral-200 font-bold font-mono">${sisa} menit</span> ke member <span class="text-neutral-200 font-bold font-mono">"${username}"</span>?</p></div>`;
        Modal.confirm(message, async () => {
            try {
                await API.blackout.resolveMember(sesiId);
                Toast.success('✅ Refund berhasil');
                await this.loadList(this.currentDate);
            } catch (err) {
                Toast.error(err.message);
            }
        });
    },

    async resolveGuestSama(sesiId, namaGuest) {
        const message = `<div class="text-center"><p class="text-xs lg:text-base text-neutral-400">Lanjutkan sesi <span class="text-neutral-200 font-bold font-mono">"${namaGuest}"</span> di PC yang sama?</p></div>`;
        Modal.confirm(message, async () => {
            try {
                await API.blackout.resolveGuestSama(sesiId);
                Toast.success('✅ Sesi dilanjutkan');
                await this.loadList(this.currentDate);
            } catch (err) {
                Toast.error(err.message);
            }
        });
    },

    async showLanjutModal(sesiId, namaGuest, pcGrup) {
        const grup = pcGrup || 'reguler';
        try {
            const data = await API.pc.list();
            const kosong = (data.pc_list || []).filter(p => p.status === 'kosong' && p.grup === grup);

            if (kosong.length === 0) {
                return Toast.error(`Tidak ada PC kosong di ${grup.toUpperCase()}`);
            }

            let cardsHtml = '<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[50vh] overflow-y-auto p-1 scrollbar-thin">';
            kosong.forEach(pc => {
                cardsHtml += `
                    <div class="pc-card-tujuan bg-[#050505] border border-[#1c1c1c] rounded p-3 cursor-pointer hover:border-neutral-500 transition-colors text-center" data-pc-id="${pc.id}">
                        <div class="font-bold text-neutral-200 font-mono text-xs lg:text-base">${pc.kode}</div>
                        <div class="text-[9px] lg:text-base text-neutral-500 font-mono">${pc.ip_address || '-'}</div>
                    </div>`;
            });
            cardsHtml += '</div>';

            Modal.show(`
                <div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded p-6 max-w-2xl w-[calc(100%-2rem)] mx-auto md:w-full">
                    <div class="flex items-center justify-between mb-4 pb-4 border-b border-[#1c1c1c]">
                        <div>
                            <h3 class="text-xs lg:text-base font-bold text-neutral-200 uppercase tracking-wider">Pindahkan Sesi</h3>
                            <p class="text-[9px] lg:text-base text-neutral-500 mt-1">Guest: ${namaGuest} &middot; ${grup.toUpperCase()}</p>
                        </div>
                        <button onclick="Modal.closeModal()" class="text-neutral-500 hover:text-neutral-300 text-xl leading-none">&times;</button>
                    </div>
                    ${cardsHtml}
                    <div class="flex justify-end mt-4">
                        <button onclick="Modal.closeModal()" class="px-4 py-2 bg-[#171717] border border-[#262626] hover:bg-[#222] text-neutral-400 text-xs lg:text-base font-bold rounded transition-colors">Batal</button>
                    </div>
                </div>
            `);

            document.querySelectorAll('.pc-card-tujuan').forEach(card => {
                card.addEventListener('click', async () => {
                    const pcId = card.getAttribute('data-pc-id');
                    if (pcId) {
                        Modal.closeModal();
                        try {
                            await API.blackout.resolveGuestLanjut(sesiId, parseInt(pcId));
                            Toast.success('✅ Sesi berhasil dipindahkan');
                            await this.loadList(this.currentDate);
                        } catch (err) {
                            Toast.error(err.message);
                        }
                    }
                });
            });
        } catch (err) {
            Toast.error('Gagal memuat daftar PC');
        }
    },

    async resolveGuestTutup(sesiId, namaGuest) {
        const message = `<div class="text-center"><p class="text-xs lg:text-base text-neutral-400">Tutup sesi untuk guest <span class="text-red-400 font-bold">"${namaGuest}"</span>?</p></div>`;
        Modal.confirm(message, async () => {
            try {
                await API.blackout.resolveGuestTutup(sesiId);
                Toast.success('✅ Sesi ditutup');
                await this.loadList(this.currentDate);
            } catch (err) {
                Toast.error(err.message);
            }
        });
    },

    async clearResolved() {
        if (!this.currentDate) return;
        const message = `<div class="text-center"><p class="text-xs lg:text-base text-neutral-400 font-bold uppercase tracking-wider">Hapus semua data terselesaikan?</p><p class="text-[10px] lg:text-base text-neutral-500 mt-1">Tanggal: ${this.currentDate}</p></div>`;
        Modal.confirm(message, async () => {
            try {
                await API.blackout.clearResolved(this.currentDate);
                Toast.success('✅ Data dibersihkan');
                await this.loadDates();
            } catch (err) {
                Toast.error(err.message);
            }
        });
    },

    async forceAllAndDetect() {
        if (!confirm('⚠️ PERINGATAN: Tutup paksa semua sesi aktif?\n\nIni akan menutup semua sesi dan memindahkannya ke riwayat blackout.\n\nLanjutkan?')) return;

        try {
            const result = await API.blackout.forceAllAndDetect();
            Toast.success('✅ Grid shutdown dieksekusi');
            if (typeof Dashboard !== 'undefined') await Dashboard.load();
            await this.loadDates();
        } catch (err) {
            Toast.error('Gagal: ' + err.message);
        }
    }
};

window.Blackout = Blackout;
