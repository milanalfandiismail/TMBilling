/**
 * Branch Inbound Module
 * Menangani koneksi masuk (inbound), tabel inbound, approval, penolakan, blokir, dan hapus.
 */
window.BranchInbound = {
    inboundBranches: [],
    filterInboundQuery: '',
    inboundSubTab: 'all',
    pendingInboundId: null,
    pendingInboundName: '',
    _lastInboundFingerprint: null,

    switchInboundSubTab(subTab) {
        this.inboundSubTab = subTab;
        this._lastInboundFingerprint = null;
        const tabs = ['all', 'active', 'blocked'];
        tabs.forEach(t => {
            const btn = document.getElementById(`btn-subtab-inbound-${t}`);
            const badge = document.getElementById(`badge-count-inbound-${t}`);
            if (!btn) return;
            if (t === subTab) {
                btn.className = 'px-4 py-2 bg-neutral-100 text-black text-xs lg:text-base font-bold rounded transition-colors flex items-center gap-2';
                if (badge) badge.className = 'px-1.5 py-0.5 text-[10px] rounded-full bg-black/20 text-black font-mono font-bold';
            } else {
                btn.className = 'px-4 py-2 bg-transparent text-neutral-400 hover:text-neutral-200 text-xs lg:text-base font-bold rounded transition-colors flex items-center gap-2';
                if (badge) badge.className = 'px-1.5 py-0.5 text-[10px] rounded-full bg-neutral-800 text-neutral-300 font-mono font-bold';
            }
        });
        this.renderInboundTable();
    },

    updateInboundBadgeCounts() {
        const all = this.inboundBranches.length;
        const active = this.inboundBranches.filter(b => b.status === 'aktif').length;
        const blocked = this.inboundBranches.filter(b => b.status === 'diblokir').length;

        const elAll = document.getElementById('badge-count-inbound-all');
        const elActive = document.getElementById('badge-count-inbound-active');
        const elBlocked = document.getElementById('badge-count-inbound-blocked');

        if (elAll) elAll.textContent = all;
        if (elActive) elActive.textContent = active;
        if (elBlocked) elBlocked.textContent = blocked;
    },

    async loadInboundBranches(isSilent = false) {
        if (!isSilent) {
            this._lastInboundFingerprint = null;
        }

        const modalBlock = document.getElementById('modal-block-inbound');
        const modalUnblock = document.getElementById('modal-unblock-inbound');
        const modalDelete = document.getElementById('modal-delete-inbound');
        const isModalOpen = (modalBlock && !modalBlock.classList.contains('hidden')) ||
                            (modalUnblock && !modalUnblock.classList.contains('hidden')) ||
                            (modalDelete && !modalDelete.classList.contains('hidden'));
        if (isSilent && isModalOpen) {
            return;
        }

        const tbody = document.getElementById('inbound-branch-table-body');
        if (!isSilent && (!this.inboundBranches || this.inboundBranches.length === 0) && tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-8 text-neutral-500 text-xs lg:max-xl:text-xs xl:text-base font-mono">
                        <i class="fa-solid fa-spinner fa-spin mr-2"></i> Memuat daftar koneksi masuk...
                    </td>
                </tr>
            `;
        }

        try {
            const res = await API.branch.inboundList();
            if (res && res.success) {
                const data = res.data || [];
                const searchInput = document.getElementById('filter-inbound-search');
                const searchVal = searchInput ? searchInput.value.trim().toLowerCase() : '';
                const newFingerprint = JSON.stringify(data.map(b => ({
                    id: b.id,
                    status: b.status,
                    nama: b.nama,
                    ip: b.ip_address,
                    mac: b.mac_address,
                    terakhir_aktif: b.terakhir_aktif,
                    total_requests: b.total_requests
                }))) + `_sub_${this.inboundSubTab}_q_${searchVal}`;

                if (isSilent && this._lastInboundFingerprint === newFingerprint) {
                    return; // Data tidak berubah, cegah re-render DOM
                }
                this._lastInboundFingerprint = newFingerprint;
                this.inboundBranches = data;
                this.updateInboundBadgeCounts();
                this.renderInboundTable();
            } else if (!isSilent) {
                this.inboundBranches = [];
                this.updateInboundBadgeCounts();
                this.renderInboundTable();
            }
        } catch (err) {
            if (!isSilent) {
                console.error('[BranchManager] Gagal memuat inbound branches:', err);
                this.inboundBranches = [];
                this.updateInboundBadgeCounts();
                this.renderInboundTable();
            }
        }
    },

    filterInboundBySearch() {
        const input = document.getElementById('filter-inbound-search');
        this.filterInboundQuery = input ? input.value.trim().toLowerCase() : '';
        this._lastInboundFingerprint = null;
        this.renderInboundTable();
    },

    renderInboundTable() {
        const tbody = document.getElementById('inbound-branch-table-body');
        if (!tbody) return;

        let filtered = this.inboundBranches || [];

        // Filter berdasarkan subTab
        if (this.inboundSubTab === 'active') {
            filtered = filtered.filter(b => b.status === 'aktif');
        } else if (this.inboundSubTab === 'blocked') {
            filtered = filtered.filter(b => b.status === 'diblokir');
        }

        // Filter pencarian
        if (this.filterInboundQuery) {
            const q = this.filterInboundQuery;
            filtered = filtered.filter(b => 
                (b.nama && b.nama.toLowerCase().includes(q)) ||
                (b.ip_address && b.ip_address.toLowerCase().includes(q)) ||
                (b.mac_address && b.mac_address.toLowerCase().includes(q)) ||
                (b.operator_terakhir && b.operator_terakhir.toLowerCase().includes(q))
            );
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr class="block lg:table-row">
                    <td colspan="5" class="text-center py-8 text-neutral-500 text-xs lg:max-xl:text-xs xl:text-base font-mono block lg:table-cell">
                        ${this.filterInboundQuery ? 'Tidak ada cabang yang cocok dengan pencarian.' : 'Belum ada cabang luar yang terhubung ke server ini.'}
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map((b, idx) => {
            const isBlocked = b.status === 'diblokir';
            const statusBadge = isBlocked
                ? `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] lg:max-xl:text-[10px] xl:text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                     <span class="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                     Diblokir
                   </span>`
                : `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] lg:max-xl:text-[10px] xl:text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                     <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                     Terhubung
                   </span>`;

            let lastActiveFormatted = '-';
            if (b.terakhir_aktif) {
                try {
                    const d = new Date(b.terakhir_aktif);
                    lastActiveFormatted = d.toLocaleString('id-ID', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit'
                    });
                } catch (e) {
                    lastActiveFormatted = b.terakhir_aktif;
                }
            }

            const safeName = (b.nama || '').replace(/'/g, "\\'");

            const actionBlockBtn = isBlocked
                ? `<button type="button" onclick="BranchManager.openUnblockInboundModal(${b.id}, '${safeName}')"
                     class="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded text-[11px] lg:max-xl:text-[11px] xl:text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                     title="Buka Blokir">
                     <i class="fa-solid fa-lock-open text-[10px]"></i>
                     <span>Buka Blokir</span>
                   </button>`
                : `<button type="button" onclick="BranchManager.openBlockInboundModal(${b.id}, '${safeName}')"
                     class="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded text-[11px] lg:max-xl:text-[11px] xl:text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                     title="Blokir Akses">
                     <i class="fa-solid fa-ban text-[10px]"></i>
                     <span>Blokir</span>
                   </button>`;

            const actionDeleteBtn = `
                <button type="button" onclick="BranchManager.openDeleteInboundModal(${b.id}, '${safeName}')"
                  class="px-2.5 py-1 bg-[#171717] hover:bg-red-500/20 border border-[#262626] hover:border-red-500/30 text-neutral-400 hover:text-red-400 rounded text-[11px] lg:max-xl:text-[11px] xl:text-xs font-bold transition-colors inline-flex items-center gap-1"
                  title="Hapus riwayat">
                  <i class="fa-solid fa-trash text-[10px]"></i>
                </button>
            `;

            return `
                <tr class="border-b border-[#2a2a2a] lg:border-[#1c1c1c] hover:bg-white/[0.02] transition-colors text-xs lg:max-xl:text-xs xl:text-base block lg:table-row py-3 lg:py-0 last:border-b-0">
                    <td class="py-2 lg:py-2.5 px-3 flex lg:table-cell justify-between items-center">
                        <span class="lg:hidden text-[10px] font-bold uppercase text-neutral-500 font-sans">No & Status</span>
                        <div class="flex items-center gap-2">
                            <div class="font-mono text-neutral-400 font-bold">#${idx + 1}</div>
                            <div class="mt-0 lg:mt-1">${statusBadge}</div>
                        </div>
                    </td>
                    <td class="py-2 lg:py-2.5 px-3 flex lg:table-cell justify-between items-start sm:items-center border-t border-[#1c1c1c]/40 lg:border-t-0">
                        <span class="lg:hidden text-[10px] font-bold uppercase text-neutral-500 font-sans">Cabang</span>
                        <div class="text-right lg:text-left">
                            <div class="font-bold text-neutral-100 text-xs lg:max-xl:text-xs xl:text-sm font-sans">${this.escapeHtml(b.nama || '-')}</div>
                            <div class="text-[10px] lg:max-xl:text-[10px] xl:text-xs text-neutral-500 font-mono mt-0.5 truncate max-w-[180px]">${this.escapeHtml(b.url || '-')}</div>
                        </div>
                    </td>
                    <td class="py-2 lg:py-2.5 px-3 flex lg:table-cell justify-between items-start sm:items-center border-t border-[#1c1c1c]/40 lg:border-t-0">
                        <span class="lg:hidden text-[10px] font-bold uppercase text-neutral-500 font-sans">Hardware / IP</span>
                        <div class="text-right lg:text-left">
                            <div class="font-mono text-neutral-300 font-semibold text-xs lg:max-xl:text-xs xl:text-sm">${this.escapeHtml(b.mac_address || '-')}</div>
                            <div class="text-[10px] lg:max-xl:text-[10px] xl:text-xs text-neutral-500 font-mono mt-0.5">${this.escapeHtml(b.ip_address || '-')}</div>
                        </div>
                    </td>
                    <td class="py-2 lg:py-2.5 px-3 flex lg:table-cell justify-between items-start sm:items-center border-t border-[#1c1c1c]/40 lg:border-t-0">
                        <span class="lg:hidden text-[10px] font-bold uppercase text-neutral-500 font-sans">Operator</span>
                        <div class="text-right lg:text-left">
                            <div class="font-mono text-neutral-200 font-medium text-xs lg:max-xl:text-xs xl:text-sm">${this.escapeHtml(b.operator_terakhir || '-')}</div>
                            <div class="text-[10px] lg:max-xl:text-[10px] xl:text-xs text-neutral-500 font-mono mt-0.5">${lastActiveFormatted}</div>
                        </div>
                    </td>
                    <td class="py-2 lg:py-2.5 px-3 text-right flex lg:table-cell justify-between items-center border-t border-[#1c1c1c]/40 lg:border-t-0">
                        <span class="lg:hidden text-[10px] font-bold uppercase text-neutral-500 font-sans">Total & Aksi</span>
                        <div class="text-right">
                            <div class="flex items-center justify-end">
                                <span class="inline-block px-2 py-0.5 rounded bg-neutral-900 border border-[#262626] font-mono text-[11px] lg:max-xl:text-[11px] xl:text-xs text-neutral-300 font-bold">
                                    ${b.total_request || 1}x akses
                                </span>
                            </div>
                            <div class="flex items-center justify-end gap-1.5 mt-1.5 flex-wrap">
                                ${actionBlockBtn}
                                ${actionDeleteBtn}
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    // Modal Handlers: Blokir
    openBlockInboundModal(id, nama) {
        this.pendingInboundId = id;
        this.pendingInboundName = nama;
        const nameEl = document.getElementById('modal-block-inbound-name');
        if (nameEl) nameEl.textContent = nama;
        const modal = document.getElementById('modal-block-inbound');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    },

    closeBlockInboundModal() {
        this.pendingInboundId = null;
        this.pendingInboundName = '';
        const modal = document.getElementById('modal-block-inbound');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    },

    async executeBlockInbound() {
        if (!this.pendingInboundId) return;
        const id = this.pendingInboundId;
        const nama = this.pendingInboundName;
        const btn = document.getElementById('btn-confirm-block-inbound');
        const origText = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i> Memproses...';
        }

        try {
            const res = await API.branch.inboundBlock(id);
            if (res && res.success) {
                if (window.Toast) {
                    window.Toast.show(res.message || `Cabang '${nama}' berhasil diblokir`, 'success');
                }
                this.closeBlockInboundModal();
                await this.loadInboundBranches();
            } else {
                if (window.Toast) {
                    window.Toast.show(res.error || 'Gagal memblokir cabang', 'error');
                }
            }
        } catch (err) {
            console.error('[BranchManager] Error blocking inbound branch:', err);
            if (window.Toast) {
                window.Toast.show('Error: ' + (err.message || err), 'error');
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origText;
            }
        }
    },

    // Modal Handlers: Buka Blokir
    openUnblockInboundModal(id, nama) {
        this.pendingInboundId = id;
        this.pendingInboundName = nama;
        const nameEl = document.getElementById('modal-unblock-inbound-name');
        if (nameEl) nameEl.textContent = nama;
        const modal = document.getElementById('modal-unblock-inbound');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    },

    closeUnblockInboundModal() {
        this.pendingInboundId = null;
        this.pendingInboundName = '';
        const modal = document.getElementById('modal-unblock-inbound');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    },

    async executeUnblockInbound() {
        if (!this.pendingInboundId) return;
        const id = this.pendingInboundId;
        const nama = this.pendingInboundName;
        const btn = document.getElementById('btn-confirm-unblock-inbound');
        const origText = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i> Memproses...';
        }

        try {
            const res = await API.branch.inboundUnblock(id);
            if (res && res.success) {
                if (window.Toast) {
                    window.Toast.show(res.message || `Blokir cabang '${nama}' berhasil dibuka`, 'success');
                }
                this.closeUnblockInboundModal();
                await this.loadInboundBranches();
            } else {
                if (window.Toast) {
                    window.Toast.show(res.error || 'Gagal membuka blokir cabang', 'error');
                }
            }
        } catch (err) {
            console.error('[BranchManager] Error unblocking inbound branch:', err);
            if (window.Toast) {
                window.Toast.show('Error: ' + (err.message || err), 'error');
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origText;
            }
        }
    },

    // Modal Handlers: Hapus
    openDeleteInboundModal(id, nama) {
        this.pendingInboundId = id;
        this.pendingInboundName = nama;
        const nameEl = document.getElementById('modal-delete-inbound-name');
        if (nameEl) nameEl.textContent = nama;
        const modal = document.getElementById('modal-delete-inbound');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    },

    closeDeleteInboundModal() {
        this.pendingInboundId = null;
        this.pendingInboundName = '';
        const modal = document.getElementById('modal-delete-inbound');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    },

    async executeDeleteInbound() {
        if (!this.pendingInboundId) return;
        const id = this.pendingInboundId;
        const nama = this.pendingInboundName;
        const btn = document.getElementById('btn-confirm-delete-inbound');
        const origText = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i> Memproses...';
        }

        try {
            const res = await API.branch.inboundDelete(id);
            if (res && res.success) {
                if (window.Toast) {
                    window.Toast.show(res.message || `Riwayat cabang '${nama}' berhasil dihapus`, 'success');
                }
                this.closeDeleteInboundModal();
                await this.loadInboundBranches();
            } else {
                if (window.Toast) {
                    window.Toast.show(res.error || 'Gagal menghapus riwayat cabang', 'error');
                }
            }
        } catch (err) {
            console.error('[BranchManager] Error deleting inbound branch:', err);
            if (window.Toast) {
                window.Toast.show('Error: ' + (err.message || err), 'error');
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origText;
            }
        }
    }

};
