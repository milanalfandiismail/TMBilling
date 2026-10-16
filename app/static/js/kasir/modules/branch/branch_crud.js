/**
 * Branch CRUD Module
 * Menangani pengelolaan konfigurasi outbound cabang, modal tambah/edit/hapus, dan uji koneksi.
 */
window.BranchCrud = {
    initSettingsPanel() {
        // Muat my key jika elemennya ada
        this.loadMyBranchKey();
        this.renderBranchesSettingsTable();
    },

    async loadMyBranchKey() {
        const keyInput = document.getElementById('my-branch-api-key-input');
        if (!keyInput) return;

        try {
            const res = await API.branch.myKey();
            if (res && res.success && res.data) {
                keyInput.value = res.data.api_key || '';
            }
        } catch (err) {
            console.error('[BranchManager] Gagal load my branch key:', err);
        }
    },

    async copyMyBranchKey() {
        if (this._isCopying) return;
        this._isCopying = true;
        setTimeout(() => { this._isCopying = false; }, 600);

        const keyInput = document.getElementById('my-branch-api-key-input');
        if (!keyInput) return;

        let textToCopy = keyInput.value;
        if (!textToCopy || textToCopy === '...') {
            await this.loadMyBranchKey();
            textToCopy = keyInput.value;
        }

        if (!textToCopy || textToCopy === '...') {
            if (window.Toast) {
                window.Toast.show("Kunci API belum termuat, silakan coba lagi.", "error");
            }
            return;
        }

        let copied = false;

        // 1. Coba Modern Clipboard API jika didukung dan secure context
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(textToCopy);
                copied = true;
            } catch (err) {
                console.warn('[BranchManager] navigator.clipboard gagal, fallback ke textarea:', err);
            }
        }

        // 2. Fallback universal untuk input bertipe password atau non-HTTPS/IP LAN
        // (Browser memblokir copy langsung dari input[type=password], jadi gunakan textarea sementara)
        if (!copied) {
            try {
                const tempTextArea = document.createElement('textarea');
                tempTextArea.value = textToCopy;
                tempTextArea.style.position = 'fixed';
                tempTextArea.style.left = '-9999px';
                tempTextArea.style.top = '-9999px';
                tempTextArea.setAttribute('readonly', '');
                document.body.appendChild(tempTextArea);
                tempTextArea.focus();
                tempTextArea.select();
                tempTextArea.setSelectionRange(0, 99999);

                copied = document.execCommand('copy');
                document.body.removeChild(tempTextArea);
            } catch (err) {
                console.error('[BranchManager] Fallback textarea copy gagal:', err);
            }
        }

        const btnCopy = document.getElementById('btn-copy-my-branch-key');
        if (copied) {
            if (btnCopy) {
                const originalHtml = btnCopy.innerHTML;
                btnCopy.innerHTML = '<i class="fa-solid fa-check text-emerald-400"></i><span class="text-emerald-400">Tersalin!</span>';
                setTimeout(() => {
                    btnCopy.innerHTML = originalHtml;
                }, 2000);
            }
            if (window.Toast) {
                window.Toast.show("API Key berhasil disalin ke clipboard!", "success");
            }
        } else {
            if (window.Toast) {
                window.Toast.show("Gagal menyalin otomatis, silakan buka ikon mata dan salin manual.", "error");
            }
        }
    },

    regenerateMyBranchKey() {
        this.openRegenKeyModal();
    },

    openRegenKeyModal() {
        const modal = document.getElementById('modal-regen-branch-key');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    },

    closeRegenKeyModal() {
        const modal = document.getElementById('modal-regen-branch-key');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    },

    async executeRegenerateKey() {
        const btn = document.getElementById('btn-confirm-regen-key');
        const origText = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i> Memproses...';
        }
        try {
            const res = await API.branch.regenerateKey();
            if (res && res.success && res.data) {
                const keyInput = document.getElementById('my-branch-api-key-input');
                if (keyInput) keyInput.value = res.data.api_key;
                if (window.Toast) {
                    window.Toast.show("Branch API Key berhasil dibuat ulang!", "success");
                }
                this.closeRegenKeyModal();
            } else {
                if (window.Toast) {
                    window.Toast.show(res.error || "Gagal membuat ulang kunci", "error");
                }
            }
        } catch (err) {
            if (window.Toast) {
                window.Toast.show("Gagal regenerate key: " + (err.message || err), "error");
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origText;
            }
        }
    },

    renderBranchesSettingsTable() {
        const tbody = document.getElementById('branch-settings-tbody');
        if (!tbody) return;

        if (!this.branches || this.branches.length === 0) {
            tbody.innerHTML = `
                <tr class="block lg:table-row">
                    <td colspan="3" class="py-8 text-center text-xs text-neutral-500 block lg:table-cell">
                        Belum ada cabang lain yang terhubung. Klik tombol <strong>+ Tambah Cabang</strong> untuk menghubungkan cabang baru.
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        this.branches.forEach((branch, idx) => {
            const statusBadge = branch.status_online
                ? `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] lg:max-xl:text-[10px] xl:text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Online ${branch.latensi_ms ? `(${branch.latensi_ms}ms)` : ''}</span>`
                : `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] lg:max-xl:text-[10px] xl:text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20"><span class="w-1.5 h-1.5 rounded-full bg-red-400"></span> Offline</span>`;

            html += `
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
                            <div class="font-bold text-neutral-100 text-xs lg:max-xl:text-xs xl:text-sm font-sans">${this.escapeHtml(branch.nama)}</div>
                            <div class="text-[10px] lg:max-xl:text-[10px] xl:text-xs text-neutral-400 font-mono mt-0.5 max-w-sm truncate">${this.escapeHtml(branch.url)}</div>
                        </div>
                    </td>
                    <td class="py-2 lg:py-2.5 px-3 text-right flex lg:table-cell justify-between items-center border-t border-[#1c1c1c]/40 lg:border-t-0">
                        <span class="lg:hidden text-[10px] font-bold uppercase text-neutral-500 font-sans">Aksi Kontrol</span>
                        <div class="flex items-center justify-end gap-1.5 flex-wrap">
                            <button type="button" onclick="BranchManager.testExistingBranch(${branch.id})" class="px-2.5 py-1 bg-[#171717] hover:bg-[#222] border border-[#262626] text-neutral-300 hover:text-white rounded text-[11px] lg:max-xl:text-[11px] xl:text-xs font-bold transition-colors">
                                Tes
                            </button>
                            <button type="button" onclick="BranchManager.editBranch(${branch.id})" class="px-2.5 py-1 bg-[#171717] hover:bg-[#222] border border-[#262626] text-neutral-300 hover:text-white rounded text-[11px] lg:max-xl:text-[11px] xl:text-xs font-bold transition-colors">
                                Edit
                            </button>
                            <button type="button" onclick="BranchManager.deleteBranch(${branch.id})" class="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded text-[11px] lg:max-xl:text-[11px] xl:text-xs font-bold transition-colors">
                                Hapus
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    },

    openAddBranchModal() {
        const modal = document.getElementById('modal-add-branch');
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.classList.add('flex');

        // Reset form ke mode Tambah
        document.getElementById('form-add-branch')?.reset();
        const idInput = document.getElementById('input-branch-id');
        if (idInput) idInput.value = '';

        const title = document.getElementById('modal-branch-title');
        if (title) title.textContent = 'Hubungkan Cabang Baru';

        const btnSubmit = document.getElementById('btn-submit-branch');
        if (btnSubmit) btnSubmit.textContent = 'Simpan Cabang';

        const hint = document.getElementById('input-branch-key-hint');
        if (hint) hint.textContent = 'Salin dari menu Pengaturan → Multi-Cabang di server warnet target.';

        const testResult = document.getElementById('branch-test-result');
        if (testResult) testResult.innerHTML = '';
    },

    async editBranch(branchId) {
        const modal = document.getElementById('modal-add-branch');
        if (!modal) return;

        // Ambil data cabang termasuk API key dari server
        let branch = null;
        try {
            const res = await API.branch.list(true);
            if (res && res.success && res.data) {
                branch = res.data.find(b => b.id === branchId);
            }
        } catch (err) {
            console.error('[BranchManager] Gagal memuat data cabang untuk edit:', err);
        }

        if (!branch) {
            branch = this.branches.find(b => b.id === branchId);
        }

        if (!branch) {
            if (window.Toast) window.Toast.show("Data cabang tidak ditemukan", "error");
            return;
        }

        const idInput = document.getElementById('input-branch-id');
        const urlInput = document.getElementById('input-branch-url');
        const keyInput = document.getElementById('input-branch-key');
        const nameInput = document.getElementById('input-branch-nama');
        const title = document.getElementById('modal-branch-title');
        const btnSubmit = document.getElementById('btn-submit-branch');
        const hint = document.getElementById('input-branch-key-hint');
        const testResult = document.getElementById('branch-test-result');

        if (idInput) idInput.value = branch.id;
        if (urlInput) urlInput.value = branch.url || '';
        if (keyInput) keyInput.value = branch.api_key || '';
        if (nameInput) nameInput.value = branch.nama || '';
        if (title) title.textContent = 'Edit Informasi Cabang';
        if (btnSubmit) btnSubmit.textContent = 'Perbarui Cabang';
        if (hint) hint.textContent = 'Perbarui URL, API Key, atau Nama cabang sesuai kebutuhan.';
        if (testResult) testResult.innerHTML = '';

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    },

    closeAddBranchModal() {
        const modal = document.getElementById('modal-add-branch');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    },

    async testConnectionInModal() {
        const urlInput = document.getElementById('input-branch-url');
        const keyInput = document.getElementById('input-branch-key');
        const nameInput = document.getElementById('input-branch-nama');
        const resultDiv = document.getElementById('branch-test-result');
        const btnTest = document.getElementById('btn-test-branch-connection');

        if (!urlInput || !keyInput || !resultDiv) return;
        const url = urlInput.value.trim();
        const apiKey = keyInput.value.trim();

        if (!url || !apiKey) {
            resultDiv.innerHTML = '<span class="text-xs text-amber-400">Harap isi URL dan API Key terlebih dahulu.</span>';
            return;
        }

        if (btnTest) {
            btnTest.disabled = true;
            btnTest.textContent = 'Menguji...';
        }
        resultDiv.innerHTML = '<span class="text-xs text-neutral-400 animate-pulse">Menghubungi server remote...</span>';

        try {
            const res = await API.branch.test(url, apiKey);
            if (res && res.success && res.data && res.data.online) {
                resultDiv.innerHTML = `
                    <div class="p-3 rounded bg-[#050505] border border-emerald-500/30 text-xs lg:text-sm text-emerald-400 flex items-center justify-between">
                        <span>Terhubung! Latensi: <strong>${res.data.latency_ms}ms</strong></span>
                        <span>Nama: <strong>${res.data.warnet_title}</strong></span>
                    </div>
                `;
                // Auto-fill nama jika masih kosong
                if (nameInput && !nameInput.value.trim() && res.data.warnet_title) {
                    nameInput.value = res.data.warnet_title;
                }
            } else {
                resultDiv.innerHTML = `<div class="p-2.5 rounded bg-[#050505] border border-red-500/30 text-xs text-red-400">Gagal terhubung: ${res.error || 'Respon tidak valid'}</div>`;
            }
        } catch (err) {
            resultDiv.innerHTML = `<div class="p-2.5 rounded bg-[#050505] border border-red-500/30 text-xs text-red-400">Error: ${err.message || err}</div>`;
        } finally {
            if (btnTest) {
                btnTest.disabled = false;
                btnTest.textContent = 'Tes & Ambil Nama';
            }
        }
    },

    async submitBranchForm(e) {
        if (e) e.preventDefault();
        const idInput = document.getElementById('input-branch-id');
        const urlInput = document.getElementById('input-branch-url');
        const keyInput = document.getElementById('input-branch-key');
        const nameInput = document.getElementById('input-branch-nama');

        if (!urlInput || !keyInput) return;

        const branchId = idInput ? idInput.value.trim() : '';
        const isEdit = Boolean(branchId);
        const payload = {
            url: urlInput.value.trim(),
            api_key: keyInput.value.trim(),
            nama: nameInput ? nameInput.value.trim() : ''
        };

        if (!payload.url || payload.url.length < 4 || payload.url.length > 255) {
            if (window.Toast) window.Toast.error("URL server cabang harus antara 4 - 255 karakter");
            return;
        }
        if (!payload.api_key || payload.api_key.length < 16 || payload.api_key.length > 128) {
            if (window.Toast) window.Toast.error("API Key cabang harus antara 16 - 128 karakter");
            return;
        }
        if (payload.nama && (payload.nama.length < 2 || payload.nama.length > 50)) {
            if (window.Toast) window.Toast.error("Nama cabang harus antara 2 - 50 karakter");
            return;
        }

        const btnSubmit = document.getElementById('btn-submit-branch');
        const originalText = btnSubmit ? btnSubmit.textContent : '';
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.textContent = isEdit ? 'Menyimpan Perubahan...' : 'Menyimpan Cabang...';
        }

        try {
            let res;
            if (isEdit) {
                res = await API.branch.update(branchId, payload);
            } else {
                res = await API.branch.add(payload);
            }

            if (res && res.success) {
                const msg = isEdit ? "Informasi cabang berhasil diperbarui!" : "Cabang berhasil ditambahkan!";
                if (window.Toast) {
                    window.Toast.show(msg, "success");
                }
                this.closeAddBranchModal();
                await this.loadBranches();

                // Jika cabang yang diedit sedang aktif di kontrol panel, perbarui namanya
                if (isEdit && String(this.activeBranchId) === String(branchId)) {
                    const updated = this.branches.find(b => String(b.id) === String(branchId));
                    if (updated) {
                        this.activeBranchName = updated.nama;
                        sessionStorage.setItem('active_branch_name', updated.nama);
                    }
                }

                this.renderNavbarDropdown();
                this.renderBranchesSettingsTable();
            } else {
                if (window.Toast) {
                    window.Toast.show(res.error || (isEdit ? "Gagal memperbarui cabang" : "Gagal menambahkan cabang"), "error");
                }
            }
        } catch (err) {
            if (window.Toast) {
                window.Toast.show("Error: " + (err.message || err), "error");
            }
        } finally {
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.textContent = originalText;
            }
        }
    },

    submitAddBranch(e) {
        return this.submitBranchForm(e);
    },

    async testExistingBranch(branchId) {
        const branch = this.branches.find(b => b.id === branchId);
        if (!branch) return;

        if (window.Toast) {
            window.Toast.show(`Menguji koneksi ke ${branch.nama}...`, "info");
        }

        try {
            const res = await API.branch.testBranch(branchId);
            if (res && res.success && res.data && res.data.online) {
                if (window.Toast) {
                    window.Toast.show(`Koneksi ${branch.nama} Normal (${res.data.latency_ms}ms)`, "success");
                }
            } else {
                if (window.Toast) {
                    window.Toast.show(res?.error || `Gagal terhubung ke ${branch.nama}`, "error");
                }
            }
            await this.loadBranches();
            this.renderNavbarDropdown();
            this.renderBranchesSettingsTable();
        } catch (err) {
            if (window.Toast) {
                window.Toast.show(`Gagal tes: ${err.message || err}`, "error");
            }
            await this.loadBranches();
            this.renderNavbarDropdown();
            this.renderBranchesSettingsTable();
        }
    },

    openDeleteBranchModal(branchId) {
        const branch = this.branches.find(b => b.id === branchId);
        this.pendingDeleteBranchId = branchId;
        const nameEl = document.getElementById('modal-delete-branch-name');
        if (nameEl) nameEl.textContent = branch ? branch.nama : `Cabang #${branchId}`;
        const modal = document.getElementById('modal-delete-branch');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    },

    closeDeleteBranchModal() {
        this.pendingDeleteBranchId = null;
        const modal = document.getElementById('modal-delete-branch');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    },

    async executeDeleteBranch() {
        if (!this.pendingDeleteBranchId) return;
        const branchId = this.pendingDeleteBranchId;
        const btn = document.getElementById('btn-confirm-delete-branch');
        const origText = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i> Menghapus...';
        }

        try {
            const res = await API.branch.delete(branchId);
            if (res && res.success) {
                if (window.Toast) {
                    window.Toast.show("Cabang berhasil dihapus", "success");
                }
                if (String(this.activeBranchId) === String(branchId)) {
                    this.switchBranch('0');
                }
                this.closeDeleteBranchModal();
                await this.loadBranches();
                this.renderNavbarDropdown();
                this.renderBranchesSettingsTable();
            } else {
                if (window.Toast) {
                    window.Toast.show(res.error || "Gagal menghapus cabang", "error");
                }
            }
        } catch (err) {
            if (window.Toast) {
                window.Toast.show("Error: " + (err.message || err), "error");
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origText;
            }
        }
    },

    deleteBranch(branchId) {
        this.openDeleteBranchModal(branchId);
    },

};
