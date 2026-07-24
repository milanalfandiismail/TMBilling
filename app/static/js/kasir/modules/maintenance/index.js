// static/js/kasir/modules/maintenance/index.js

const Maintenance = {
    tickets: [],
    pcs: [],

    async init() {
        await this.loadPCs();
        await this.load();
    },

    pcSelectContext: '',

    async loadPCs() {
        try {
            const res = await API.request('/api/v1/kasir/pc/');
            if (res && res.pc_list) {
                this.pcs = res.pc_list;
                this.renderPCSelectGrid();
            }
        } catch (err) {
            console.error('Gagal memuat list PC untuk Maintenance:', err);
        }
    },

    openSelectPCModal(context) {
        this.pcSelectContext = context;
        const allBtn = document.getElementById('btn-pc-select-all');
        
        if (context === 'input') {
            if (allBtn) allBtn.classList.add('hidden');
        } else {
            if (allBtn) allBtn.classList.remove('hidden');
        }

        const searchInput = document.getElementById('pc-select-search');
        if (searchInput) {
            searchInput.value = '';
        }
        this.filterPCSelectGrid();

        document.getElementById('modal-select-pc')?.classList.remove('hidden');
    },

    closeSelectPCModal() {
        document.getElementById('modal-select-pc')?.classList.add('hidden');
    },

    renderPCSelectGrid() {
        const container = document.getElementById('pc-select-grid-container');
        if (!container) return;

        const grouped = {};
        this.pcs.forEach(pc => {
            const g = pc.grup || 'Reguler';
            if (!grouped[g]) grouped[g] = [];
            grouped[g].push(pc);
        });

        let html = '';
        Object.keys(grouped).sort().forEach(gName => {
            html += `
                <div class="pc-group-section" data-group="${gName}">
                    <div class="text-[10px] uppercase font-bold text-neutral-500 tracking-wider mb-2 pb-1 border-b border-[#1f1f1f]">${gName}</div>
                    <div class="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        ${grouped[gName].map(pc => `
                            <button type="button" 
                                class="pc-item-btn p-2 bg-[#171717] border border-[#262626] rounded-lg text-center hover:bg-neutral-100 hover:text-black hover:border-white transition-all text-xs font-bold flex flex-col items-center justify-center gap-1"
                                style="border-left: 3px solid ${pc.grup_warna || '#888888'};"
                                data-id="${pc.id}" 
                                data-kode="${pc.kode}" 
                                data-nama="${pc.nama || ''}"
                                onclick="Maintenance.selectPCFromModal(${pc.id}, '${pc.kode}')">
                                <span class="text-neutral-100 font-mono">${pc.kode}</span>
                                <span class="text-[8px] lg:text-[10px] text-neutral-500 font-normal truncate max-w-full">${pc.nama || ''}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    filterPCSelectGrid() {
        const query = document.getElementById('pc-select-search')?.value.toLowerCase().trim() || '';
        const sections = document.querySelectorAll('.pc-group-section');

        sections.forEach(section => {
            let visibleCount = 0;
            const buttons = section.querySelectorAll('.pc-item-btn');
            buttons.forEach(btn => {
                const kode = btn.getAttribute('data-kode').toLowerCase();
                const nama = btn.getAttribute('data-nama').toLowerCase();
                if (kode.includes(query) || nama.includes(query)) {
                    btn.classList.remove('hidden');
                    visibleCount++;
                } else {
                    btn.classList.add('hidden');
                }
            });

            if (visibleCount > 0) {
                section.classList.remove('hidden');
            } else {
                section.classList.add('hidden');
            }
        });
    },

    selectPCFromModal(pcId, pcKode) {
        if (this.pcSelectContext === 'filter') {
            const valInput = document.getElementById('maint-filter-pc-val');
            const labelSpan = document.getElementById('label-maint-filter-pc');
            if (valInput) valInput.value = pcId || '';
            if (labelSpan) labelSpan.innerText = pcKode || 'Semua PC';
            this.load();
        } else if (this.pcSelectContext === 'report') {
            const valInput = document.getElementById('maint-report-pc-val');
            const labelSpan = document.getElementById('label-maint-report-pc');
            if (valInput) valInput.value = pcId || '';
            if (labelSpan) labelSpan.innerText = pcKode || 'Semua PC';
            if (typeof LaporanMaintenance !== 'undefined') {
                LaporanMaintenance.loadReport();
            }
        } else if (this.pcSelectContext === 'input') {
            const valInput = document.getElementById('maint-input-pc-val');
            const labelSpan = document.getElementById('label-maint-input-pc');
            if (valInput) valInput.value = pcId || '';
            if (labelSpan) labelSpan.innerText = pcKode || '-- Pilih Unit PC --';
        }

        this.closeSelectPCModal();
    },

    async load() {
        try {
            const status = document.getElementById('maint-filter-status')?.value || '';
            const pcId = document.getElementById('maint-filter-pc-val')?.value || '';
            
            let url = '/api/v1/kasir/maintenance/list?limit=100';
            if (status) url += `&status=${status}`;
            if (pcId) url += `&pc_id=${pcId}`;
            
            const res = await API.request(url);
            if (res && res.success) {
                this.tickets = res.tickets;
                this.renderTickets();
                this.updateStats();
            }
        } catch (err) {
            Toast.error('Gagal mengambil data tiket perawatan.');
        }
    },

    updateStats() {
        let baru = 0;
        let proses = 0;
        let selesai = 0;
        let nonaktif = 0;

        this.tickets.forEach(t => {
            if (t.status === 'BARU') baru++;
            else if (t.status === 'DIPROSES') proses++;
            else if (t.status === 'SELESAI') selesai++;
        });

        // Hitung PC nonaktif
        nonaktif = this.pcs.filter(pc => !pc.aktif).length;

        const statBaru = document.getElementById('stat-maint-baru');
        const statProses = document.getElementById('stat-maint-proses');
        const statSelesai = document.getElementById('stat-maint-selesai');
        const statNonaktif = document.getElementById('stat-maint-nonaktif');

        if (statBaru) statBaru.innerText = baru;
        if (statProses) statProses.innerText = proses;
        if (statSelesai) statSelesai.innerText = selesai;
        if (statNonaktif) statNonaktif.innerText = nonaktif;
    },

    renderTickets() {
        const tbody = document.getElementById('maintenance-tickets-tbody');
        if (!tbody) return;

        if (this.tickets.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="py-10 text-center text-neutral-500">Tidak ada tiket perbaikan yang aktif.</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        this.tickets.forEach(t => {
            let prioritasClass = 'bg-neutral-800 text-neutral-400';
            if (t.prioritas === 'KRITIS') prioritasClass = 'bg-red-950/40 text-red-400 border border-red-900/30';
            else if (t.prioritas === 'TINGGI') prioritasClass = 'bg-amber-950/40 text-amber-400 border border-amber-900/30';
            else if (t.prioritas === 'SEDANG') prioritasClass = 'bg-blue-950/40 text-blue-400 border border-blue-900/30';

            let statusClass = 'bg-neutral-900 text-neutral-500';
            if (t.status === 'BARU') statusClass = 'bg-yellow-950/40 text-yellow-400 border border-yellow-900/30';
            else if (t.status === 'DIPROSES') statusClass = 'bg-blue-950/40 text-blue-400 border border-blue-900/30';
            else if (t.status === 'SELESAI') statusClass = 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30';
            else if (t.status === 'DITOLAK') statusClass = 'bg-red-950/40 text-red-400 border border-red-900/30';

            let actionButtons = '';
            const isAdmin = !(window.App && App.user && App.user.role === 'kasir');

            if (t.status === 'BARU') {
                actionButtons = `
                    <button onclick="Maintenance.changeStatus(${t.id}, 'DIPROSES')" class="px-3.5 py-1.5 bg-blue-600/20 border border-blue-600/30 text-blue-400 rounded-lg hover:bg-blue-600/30 text-xs lg:text-sm font-bold transition-colors">Proses</button>
                    <button onclick="Maintenance.openUpdateModal(${t.id}, '${t.status}')" class="px-3.5 py-1.5 bg-red-600/20 border border-red-600/30 text-red-400 rounded-lg hover:bg-red-600/30 text-xs lg:text-sm font-bold transition-colors">Tolak</button>
                `;
            } else if (t.status === 'DIPROSES') {
                actionButtons = `
                    <button onclick="Maintenance.openUpdateModal(${t.id}, '${t.status}')" class="px-3.5 py-1.5 bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 rounded-lg hover:bg-emerald-600/30 text-xs lg:text-sm font-bold transition-colors">Selesaikan</button>
                `;
            } else {
                actionButtons = `
                    <button onclick="Maintenance.openDetailModal(${t.id})" class="px-3.5 py-1.5 bg-[#171717] border border-[#262626] text-neutral-300 rounded-lg hover:bg-neutral-100 hover:text-black text-xs lg:text-sm font-bold transition-colors">Detail</button>
                `;
            }

            if (isAdmin) {
                actionButtons += `
                    <button onclick="Maintenance.deleteTicket(${t.id})" class="px-3.5 py-1.5 bg-red-600/20 border border-red-600/30 text-red-400 rounded-lg hover:bg-red-600 hover:text-white text-xs lg:text-sm font-bold transition-colors" title="Hapus">Hapus</button>
                `;
            }

            tbody.innerHTML += `
                <tr class="hover:bg-[#121212] transition-colors">
                    <td class="py-3 px-4 font-mono font-bold text-neutral-100">${t.pc_kode}</td>
                    <td class="py-3 px-4 font-mono text-[10px] lg:text-xs text-neutral-400 font-bold uppercase tracking-wider">${t.kategori}</td>
                    <td class="py-3 px-4">
                        <span class="px-2.5 py-0.5 rounded text-[9px] lg:text-xs font-bold ${prioritasClass}">${t.prioritas}</span>
                    </td>
                    <td class="py-3 px-4 text-neutral-200">
                        <div class="truncate max-w-[200px]" title="${t.judul}">${t.judul}</div>
                    </td>
                    <td class="py-3 px-4 text-neutral-500 font-mono text-[9px] lg:text-xs">
                        <div class="font-bold">${t.reporter}</div>
                        <div class="text-[8px] lg:text-[10px] mt-0.5">${t.created_at}</div>
                    </td>
                    <td class="py-3 px-4">
                        <span class="px-2.5 py-0.5 rounded text-[9px] lg:text-xs font-bold ${statusClass}">${t.status}</span>
                    </td>
                    <td class="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">${actionButtons}</td>
                </tr>
            `;
        });
    },

    openCreateModal() {
        document.getElementById('modal-create-ticket')?.classList.remove('hidden');
    },

    closeCreateModal() {
        document.getElementById('modal-create-ticket')?.classList.add('hidden');
        document.getElementById('form-create-ticket')?.reset();
        
        const valInput = document.getElementById('maint-input-pc-val');
        const labelSpan = document.getElementById('label-maint-input-pc');
        if (valInput) valInput.value = '';
        if (labelSpan) labelSpan.innerText = '-- Pilih Unit PC --';
    },

    async submitCreate(e) {
        e.preventDefault();
        try {
            const pcId = document.getElementById('maint-input-pc-val').value;
            const kategori = document.getElementById('maint-input-kategori').value;
            const prioritas = document.getElementById('maint-input-prioritas').value;
            const judul = document.getElementById('maint-input-judul').value.trim();
            const deskripsi = document.getElementById('maint-input-deskripsi').value.trim();

            if (!pcId) {
                Toast.error('Harap pilih unit PC.');
                return;
            }

            const res = await API.request('/api/v1/kasir/maintenance/create', {
                method: 'POST',
                body: JSON.stringify({ pc_id: pcId, kategori, prioritas, judul, deskripsi })
            });

            if (res && res.success) {
                Toast.success('Laporan perbaikan berhasil dikirim.');
                this.closeCreateModal();
                await this.init();
            }
        } catch (err) {
            Toast.error(err.message || 'Gagal mengirim laporan perbaikan.');
        }
    },

    async changeStatus(ticketId, newStatus) {
        try {
            const res = await API.request(`/api/v1/kasir/maintenance/${ticketId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus })
            });
            if (res && res.success) {
                Toast.success(`Status tiket perbaikan berhasil diubah.`);
                await this.init();
            }
        } catch (err) {
            Toast.error(err.message || 'Gagal merubah status tiket.');
        }
    },

    openUpdateModal(ticketId, currentStatus) {
        document.getElementById('maint-update-id').value = ticketId;
        const statusSelect = document.getElementById('maint-update-status');
        
        if (currentStatus === 'BARU') {
            statusSelect.innerHTML = `
                <option value="DIPROSES">SEDANG DIPROSES</option>
                <option value="DITOLAK">DITOLAK / BATAL</option>
            `;
        } else if (currentStatus === 'DIPROSES') {
            statusSelect.innerHTML = `
                <option value="SELESAI">SELESAI (PC Auto-Aktif)</option>
                <option value="DITOLAK">DITOLAK / BATAL</option>
            `;
        }

        this.toggleResolutionFields();
        document.getElementById('modal-update-ticket')?.classList.remove('hidden');
    },

    closeUpdateModal() {
        document.getElementById('modal-update-ticket')?.classList.add('hidden');
        document.getElementById('form-update-ticket')?.reset();
    },

    toggleResolutionFields() {
        const status = document.getElementById('maint-update-status').value;
        const wrapper = document.getElementById('maint-resolution-wrapper');
        const label = document.getElementById('maint-label-resolusi');
        const biayaWrapper = document.getElementById('maint-biaya-wrapper');

        if (status === 'SELESAI') {
            wrapper.classList.remove('hidden');
            biayaWrapper.classList.remove('hidden');
            label.innerText = 'Catatan Resolusi / Tindakan Perbaikan *';
            document.getElementById('maint-update-resolusi').setAttribute('required', 'true');
        } else if (status === 'DITOLAK') {
            wrapper.classList.remove('hidden');
            biayaWrapper.classList.add('hidden');
            label.innerText = 'Alasan Penolakan / Pembatalan *';
            document.getElementById('maint-update-resolusi').setAttribute('required', 'true');
        } else {
            wrapper.classList.add('hidden');
            document.getElementById('maint-update-resolusi').removeAttribute('required');
        }
    },

    async submitUpdate(e) {
        e.preventDefault();
        try {
            const ticketId = document.getElementById('maint-update-id').value;
            const status = document.getElementById('maint-update-status').value;
            const resolusi = document.getElementById('maint-update-resolusi').value.trim();
            const biaya = document.getElementById('maint-update-biaya').value || 0;

            const res = await API.request(`/api/v1/kasir/maintenance/${ticketId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status, resolusi, biaya })
            });

            if (res && res.success) {
                Toast.success('Status perbaikan tiket berhasil di-update.');
                this.closeUpdateModal();
                await this.init();
            }
        } catch (err) {
            Toast.error(err.message || 'Gagal mengubah status perbaikan.');
        }
    },

    async openDetailModal(ticketId) {
        try {
            // Panggil API get status list dan cari yang sesuai
            const ticket = this.tickets.find(t => t.id === ticketId);
            if (!ticket) return;

            document.getElementById('maint-detail-pc').innerText = ticket.pc_kode;
            document.getElementById('maint-detail-kategori').innerText = ticket.kategori;
            document.getElementById('maint-detail-prioritas').innerText = ticket.prioritas;
            document.getElementById('maint-detail-reporter').innerText = ticket.reporter;
            document.getElementById('maint-detail-created').innerText = ticket.created_at;
            document.getElementById('maint-detail-deskripsi').innerText = ticket.deskripsi || '-';
            
            const statusEl = document.getElementById('maint-detail-status');
            statusEl.innerText = ticket.status;
            statusEl.className = 'font-bold';
            if (ticket.status === 'SELESAI') statusEl.classList.add('text-emerald-400');
            else if (ticket.status === 'DITOLAK') statusEl.classList.add('text-rose-400');
            else statusEl.classList.add('text-amber-400');

            const resolutionSection = document.getElementById('maint-detail-resolution-section');
            if (ticket.status === 'SELESAI' || ticket.status === 'DITOLAK') {
                resolutionSection.classList.remove('hidden');
                document.getElementById('maint-detail-resolved-by').innerText = ticket.resolved_by || 'Staff';
                document.getElementById('maint-detail-resolved-at').innerText = ticket.resolved_at || '-';
                document.getElementById('maint-detail-biaya').innerText = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(ticket.biaya || 0);
                document.getElementById('maint-detail-resolusi').innerText = ticket.resolusi || '-';
            } else {
                resolutionSection.classList.add('hidden');
            }

            document.getElementById('modal-detail-ticket')?.classList.remove('hidden');
        } catch (err) {
            Toast.error('Gagal menampilkan detail tiket.');
        }
    },

    closeDetailModal() {
        document.getElementById('modal-detail-ticket')?.classList.add('hidden');
    },

    async deleteTicket(ticketId) {
        if (!confirm('Apakah Anda yakin ingin menghapus tiket perawatan ini?')) return;
        try {
            const res = await API.request(`/api/v1/kasir/maintenance/${ticketId}`, {
                method: 'DELETE'
            });

            if (res && res.success) {
                Toast.success(res.message || 'Tiket perawatan berhasil dihapus.');
                await this.init();
            }
        } catch (err) {
            Toast.error(err.message || 'Gagal menghapus tiket perawatan.');
        }
    }
};
