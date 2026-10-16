/**
 * Branch Remote Operators Module
 * Menangani akun kasir cabang remote, modal tambah/edit/hapus operator remote.
 */
window.BranchOperators = {
    remoteOperators: [],
    currentOperatorSubTab: 'active',
    operatorToDelete: null,

    async loadRemoteOperators(isSilent = false) {
        if (!isSilent) {
            this._lastOperatorsFingerprint = null;
        }

        const modalDeleteOp = document.getElementById('modal-delete-remote-op');
        const isModalOpen = modalDeleteOp && !modalDeleteOp.classList.contains('hidden');
        if (isSilent && isModalOpen) {
            return;
        }

        const tbody = document.getElementById('branch-operators-tbody');
        if (!isSilent && (!this.remoteOperators || this.remoteOperators.length === 0) && tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="py-8 text-center text-xs lg:max-xl:text-xs xl:text-base text-neutral-500">Memuat data akun kasir cabang...</td>
                </tr>
            `;
        }

        try {
            const res = await API.branch.operators();
            if (res && res.success) {
                const data = res.data || [];
                const searchInput = document.getElementById('filter-remote-op-search');
                const searchVal = searchInput ? searchInput.value.trim().toLowerCase() : '';
                const newFingerprint = JSON.stringify(data.map(op => ({
                    id: op.id,
                    operator: op.operator,
                    username: op.username,
                    branch_name: op.branch_name,
                    is_hidden: op.is_hidden,
                    total_billing: op.total_billing,
                    total_kantin: op.total_kantin,
                    terakhir_aktif: op.terakhir_aktif
                }))) + `_sub_${this.currentOperatorSubTab}_q_${searchVal}`;

                if (isSilent && this._lastOperatorsFingerprint === newFingerprint) {
                    return; // Data tidak berubah, cegah re-render DOM
                }
                this._lastOperatorsFingerprint = newFingerprint;
                this.remoteOperators = data;
                this.updateOperatorBadges();
                this.renderOperatorsTable();
            } else if (!isSilent) {
                this.remoteOperators = [];
                this.updateOperatorBadges();
                this.renderOperatorsTable();
            }
        } catch (err) {
            if (!isSilent) {
                console.error('[BranchManager] Gagal memuat operator remote:', err);
                this.remoteOperators = [];
                this.updateOperatorBadges();
                this.renderOperatorsTable();
            }
        }
    },

    updateOperatorBadges() {
        const activeCount = this.remoteOperators.filter(op => !op.is_hidden).length;
        const archivedCount = this.remoteOperators.filter(op => op.is_hidden).length;

        const badgeActive = document.getElementById('badge-count-op-active');
        const badgeArchived = document.getElementById('badge-count-op-archived');

        if (badgeActive) badgeActive.textContent = activeCount;
        if (badgeArchived) badgeArchived.textContent = archivedCount;
    },

    switchOperatorSubTab(tab) {
        this.currentOperatorSubTab = tab;
        this._lastOperatorsFingerprint = null;
        const btnActive = document.getElementById('btn-subtab-op-active');
        const btnArchived = document.getElementById('btn-subtab-op-archived');
        const badgeActive = document.getElementById('badge-count-op-active');
        const badgeArchived = document.getElementById('badge-count-op-archived');
        const titleEl = document.getElementById('op-table-title');
        const descEl = document.getElementById('op-table-desc');

        if (tab === 'active') {
            if (btnActive) {
                btnActive.className = 'px-4 py-2 bg-neutral-100 text-black text-xs lg:text-base font-bold rounded transition-colors flex items-center gap-2';
            }
            if (btnArchived) {
                btnArchived.className = 'px-4 py-2 bg-transparent text-neutral-400 hover:text-neutral-200 text-xs lg:text-base font-bold rounded transition-colors flex items-center gap-2';
            }
            if (badgeActive) {
                badgeActive.className = 'px-1.5 py-0.5 text-[10px] rounded-full bg-black/20 text-black font-mono font-bold';
            }
            if (badgeArchived) {
                badgeArchived.className = 'px-1.5 py-0.5 text-[10px] rounded-full bg-neutral-800 text-neutral-300 font-mono font-bold';
            }
            if (titleEl) titleEl.textContent = 'Daftar Akun Kasir Aktif';
            if (descEl) descEl.textContent = 'Akun yang tampil di dropdown filter laporan billing dan kantin.';
        } else {
            if (btnActive) {
                btnActive.className = 'px-4 py-2 bg-transparent text-neutral-400 hover:text-neutral-200 text-xs lg:text-base font-bold rounded transition-colors flex items-center gap-2';
            }
            if (btnArchived) {
                btnArchived.className = 'px-4 py-2 bg-neutral-100 text-black text-xs lg:text-base font-bold rounded transition-colors flex items-center gap-2';
            }
            if (badgeActive) {
                badgeActive.className = 'px-1.5 py-0.5 text-[10px] rounded-full bg-neutral-800 text-neutral-300 font-mono font-bold';
            }
            if (badgeArchived) {
                badgeArchived.className = 'px-1.5 py-0.5 text-[10px] rounded-full bg-black/20 text-black font-mono font-bold';
            }
            if (titleEl) titleEl.textContent = 'Daftar Akun Kasir Diarsipkan / Nonaktif';
            if (descEl) descEl.textContent = 'Akun yang disembunyikan dari dropdown filter laporan billing dan kantin. Riwayat dan log masa lalu tetap aman 100%.';
        }

        this.renderOperatorsTable();
    },

    filterOperatorsBySearch() {
        this._lastOperatorsFingerprint = null;
        this.renderOperatorsTable();
    },

    renderOperatorsTable() {
        const tbody = document.getElementById('branch-operators-tbody');
        if (!tbody) return;

        const isArchivedTab = this.currentOperatorSubTab === 'archived';
        let filtered = this.remoteOperators.filter(op => isArchivedTab ? op.is_hidden : !op.is_hidden);

        const searchInput = document.getElementById('filter-remote-op-search');
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

        if (query) {
            filtered = filtered.filter(op =>
                (op.operator && op.operator.toLowerCase().includes(query)) ||
                (op.username && op.username.toLowerCase().includes(query)) ||
                (op.branch_name && op.branch_name.toLowerCase().includes(query))
            );
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr class="block lg:table-row">
                    <td colspan="4" class="py-8 text-center text-xs lg:max-xl:text-xs xl:text-base text-neutral-500 block lg:table-cell">
                        ${query ? 'Tidak ada akun kasir yang cocok dengan pencarian.' : (isArchivedTab ? 'Belum ada akun kasir remote yang diarsipkan.' : 'Belum ada akun kasir remote yang tercatat di transaksi.')}
                    </td>
                </tr>
            `;
            return;
        }

        const rows = filtered.map((op, index) => {
            const formatMoney = (num) => {
                if (window.Utils && typeof window.Utils.formatRupiah === 'function') {
                    return window.Utils.formatRupiah(num || 0);
                }
                return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
            };

            const encodedOp = encodeURIComponent(op.operator);

            const actionButtons = isArchivedTab ? `
                <div class="flex items-center justify-end gap-1.5 flex-wrap">
                    <button type="button" onclick="BranchManager.restoreRemoteOperator('${encodedOp}')"
                        class="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-[11px] lg:max-xl:text-[11px] xl:text-xs font-bold rounded transition-colors flex items-center gap-1.5"
                        title="Aktifkan kembali ke dropdown laporan">
                        <i class="fa-solid fa-rotate-left text-[10px]"></i>
                        <span>Aktifkan</span>
                    </button>
                    <button type="button" onclick="BranchManager.openDeleteOperatorModal('${encodedOp}')"
                        class="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[11px] lg:max-xl:text-[11px] xl:text-xs font-bold rounded transition-colors flex items-center gap-1.5"
                        title="Hapus permanen identitas kasir">
                        <i class="fa-solid fa-trash text-[10px]"></i>
                        <span>Hapus</span>
                    </button>
                </div>
            ` : `
                <div class="flex items-center justify-end gap-1.5 flex-wrap">
                    <button type="button" onclick="BranchManager.hideRemoteOperator('${encodedOp}')"
                        class="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-[11px] lg:max-xl:text-[11px] xl:text-xs font-bold rounded transition-colors flex items-center gap-1.5"
                        title="Sembunyikan dari dropdown filter laporan aktif">
                        <i class="fa-solid fa-eye-slash text-[10px]"></i>
                        <span>Nonaktifkan</span>
                    </button>
                    <button type="button" onclick="BranchManager.openDeleteOperatorModal('${encodedOp}')"
                        class="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[11px] lg:max-xl:text-[11px] xl:text-xs font-bold rounded transition-colors flex items-center gap-1.5"
                        title="Hapus permanen identitas kasir">
                        <i class="fa-solid fa-trash text-[10px]"></i>
                        <span>Hapus</span>
                    </button>
                </div>
            `;

            const statusBadge = op.is_hidden ?
                `<span class="px-2 py-0.5 text-[10px] lg:max-xl:text-[10px] xl:text-xs rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold uppercase tracking-wider">Diarsipkan</span>` :
                `<span class="px-2 py-0.5 text-[10px] lg:max-xl:text-[10px] xl:text-xs rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider">Aktif</span>`;

            return `
                <tr class="border-b border-[#2a2a2a] lg:border-[#1c1c1c] hover:bg-white/[0.02] transition-colors text-xs lg:max-xl:text-xs xl:text-base block lg:table-row py-3 lg:py-0 last:border-b-0">
                    <td class="py-2 lg:py-2.5 px-3 flex lg:table-cell justify-between items-center">
                        <span class="lg:hidden text-[10px] font-bold uppercase text-neutral-500 font-sans">No & Status</span>
                        <div class="flex items-center gap-2">
                            <div class="font-mono text-neutral-400 font-bold">#${index + 1}</div>
                            <div class="mt-0 lg:mt-1">${statusBadge}</div>
                        </div>
                    </td>
                    <td class="py-2 lg:py-2.5 px-3 flex lg:table-cell justify-between items-start sm:items-center border-t border-[#1c1c1c]/40 lg:border-t-0">
                        <span class="lg:hidden text-[10px] font-bold uppercase text-neutral-500 font-sans">Identitas Kasir</span>
                        <div class="text-right lg:text-left">
                            <div class="flex items-center justify-end lg:justify-start gap-2">
                                <span class="w-5 h-5 rounded bg-[#171717] border border-[#262626] flex items-center justify-center text-[10px] text-neutral-400 shrink-0">👤</span>
                                <span class="font-bold text-neutral-100 text-xs lg:max-xl:text-xs xl:text-sm font-sans">${this.escapeHtml(op.operator)}</span>
                            </div>
                            <div class="flex items-center justify-end lg:justify-start gap-1.5 mt-0.5">
                                <span class="font-mono text-[10px] lg:max-xl:text-[10px] xl:text-xs text-neutral-400">@${this.escapeHtml(op.username)}</span>
                                <span class="px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] lg:max-xl:text-[9px] xl:text-[11px] font-bold font-mono">
                                    ${this.escapeHtml(op.branch_name)}
                                </span>
                            </div>
                        </div>
                    </td>
                    <td class="py-2 lg:py-2.5 px-3 flex lg:table-cell justify-between items-start sm:items-center border-t border-[#1c1c1c]/40 lg:border-t-0">
                        <span class="lg:hidden text-[10px] font-bold uppercase text-neutral-500 font-sans">Statistik</span>
                        <div class="text-right lg:text-left">
                            <div class="font-bold text-emerald-400 font-mono text-xs lg:max-xl:text-xs xl:text-sm">
                                ${formatMoney(op.total_nominal)}
                            </div>
                            <div class="text-[10px] lg:max-xl:text-[10px] xl:text-xs text-neutral-500 font-mono mt-0.5">
                                ${op.total_transaksi}x transaksi
                            </div>
                        </div>
                    </td>
                    <td class="py-2 lg:py-2.5 px-3 text-right flex lg:table-cell justify-between items-center border-t border-[#1c1c1c]/40 lg:border-t-0">
                        <span class="lg:hidden text-[10px] font-bold uppercase text-neutral-500 font-sans">Aktivitas & Aksi</span>
                        <div class="text-right">
                            <div class="text-[10px] lg:max-xl:text-[10px] xl:text-xs text-neutral-400 font-mono">
                                ${op.terakhir_aktif || '-'}
                            </div>
                            <div class="mt-1">
                                ${actionButtons}
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = rows;
    },

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    async hideRemoteOperator(encodedOp) {
        const op = decodeURIComponent(encodedOp);
        try {
            const res = await API.branch.hideOperator(op);
            if (res && res.success) {
                if (window.Toast) {
                    window.Toast.show(res.message || `Operator '${op}' berhasil dinonaktifkan`, 'success');
                }
                await this.loadRemoteOperators();
            } else {
                if (window.Toast) {
                    window.Toast.show(res.error || 'Gagal menonaktifkan operator', 'error');
                }
            }
        } catch (err) {
            console.error('[BranchManager] Error hide operator:', err);
            if (window.Toast) {
                window.Toast.show('Error: ' + (err.message || err), 'error');
            }
        }
    },

    async restoreRemoteOperator(encodedOp) {
        const op = decodeURIComponent(encodedOp);
        try {
            const res = await API.branch.restoreOperator(op);
            if (res && res.success) {
                if (window.Toast) {
                    window.Toast.show(res.message || `Operator '${op}' berhasil diaktifkan kembali`, 'success');
                }
                await this.loadRemoteOperators();
            } else {
                if (window.Toast) {
                    window.Toast.show(res.error || 'Gagal mengaktifkan operator', 'error');
                }
            }
        } catch (err) {
            console.error('[BranchManager] Error restore operator:', err);
            if (window.Toast) {
                window.Toast.show('Error: ' + (err.message || err), 'error');
            }
        }
    },

    openDeleteOperatorModal(encodedOp) {
        const op = decodeURIComponent(encodedOp);
        this.operatorToDelete = op;
        const nameEl = document.getElementById('modal-delete-op-name');
        if (nameEl) nameEl.textContent = op;

        const modal = document.getElementById('modal-delete-remote-op');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    },

    closeDeleteOperatorModal() {
        const modal = document.getElementById('modal-delete-remote-op');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        this.operatorToDelete = null;
    },

    async executeDeleteRemoteOperator() {
        if (!this.operatorToDelete) return;
        const op = this.operatorToDelete;
        const btn = document.getElementById('btn-confirm-delete-op');
        const originalText = btn ? btn.innerHTML : '';

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i> <span>Menghapus...</span>';
        }

        try {
            const res = await API.branch.deleteOperator(op);
            if (res && res.success) {
                if (window.Toast) {
                    window.Toast.show(res.message || `Operator '${op}' berhasil dihapus permanen`, 'success');
                }
                this.closeDeleteOperatorModal();
                await this.loadRemoteOperators();
            } else {
                if (window.Toast) {
                    window.Toast.show(res.error || 'Gagal menghapus operator', 'error');
                }
            }
        } catch (err) {
            console.error('[BranchManager] Error delete operator:', err);
            if (window.Toast) {
                window.Toast.show('Error: ' + (err.message || err), 'error');
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }
    },

};
