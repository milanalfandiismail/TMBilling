// app/static/js/kasir/modules/branch/index.js
/**
 * Modul BranchManager untuk mengelola fitur Multi-Cabang di Kasir TMBilling.
 */

const BranchManager = {
    branches: [],
    activeBranchId: localStorage.getItem('active_branch_id') || '0',
    activeBranchName: localStorage.getItem('active_branch_name') || 'Lokal',
    localWarnetTitle: 'Cabang Lokal',

    async init() {
        // Cek apakah elemen dropdown ada di DOM (hanya untuk role admin)
        const dropdownContainer = document.getElementById('branch-selector-container');
        if (!dropdownContainer) return;

        // Ambil nama warnet lokal dari elemen atau settings
        const brandTitleElem = document.getElementById('navbar-brand-title');
        if (brandTitleElem && brandTitleElem.textContent.trim()) {
            this.localWarnetTitle = brandTitleElem.textContent.trim();
        }

        await this.loadBranches();
        this.renderNavbarDropdown();
        this.renderActiveBranchBanner();
        this.bindNavbarEvents();

        // Inisialisasi tab settings jika berada di halaman settings
        this.initSettingsPanel();
    },

    async loadBranches() {
        try {
            const res = await API.branch.list(false);
            if (res && res.success) {
                this.branches = res.data || [];
            }
        } catch (err) {
            console.error('[BranchManager] Gagal memuat daftar cabang:', err);
        }
    },

    renderNavbarDropdown() {
        const btn = document.getElementById('branch-selector-btn');
        const listContainer = document.getElementById('branch-selector-list');
        if (!btn || !listContainer) return;

        // Update label tombol navbar
        let displayName = this.localWarnetTitle;
        let isRemote = false;

        if (this.activeBranchId !== '0') {
            const activeBranch = this.branches.find(b => String(b.id) === String(this.activeBranchId));
            if (activeBranch) {
                displayName = activeBranch.nama;
                isRemote = true;
            } else {
                // Cabang tidak ditemukan lagi di list, reset ke lokal
                this.activeBranchId = '0';
                this.activeBranchName = this.localWarnetTitle;
                localStorage.setItem('active_branch_id', '0');
                localStorage.setItem('active_branch_name', this.localWarnetTitle);
            }
        }

        const labelElem = document.getElementById('branch-selector-current-label');
        if (labelElem) {
            labelElem.textContent = displayName;
        }

        const iconElem = document.getElementById('branch-selector-icon');
        if (iconElem) {
            if (isRemote) {
                iconElem.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
            } else {
                iconElem.className = 'w-2 h-2 rounded-full bg-blue-400';
            }
        }

        // Render daftar item dropdown
        let html = `
            <div class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-white/5 flex items-center justify-between">
                <span>Pilih Cabang</span>
                <span class="text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-neutral-400 font-mono">v1.6.0</span>
            </div>
            <div class="py-1 max-h-60 overflow-y-auto custom-scrollbar">
                <button type="button" data-branch-id="0" class="branch-option-item w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${this.activeBranchId === '0' ? 'bg-accent/15 text-accent font-bold' : 'text-neutral-300 hover:bg-white/5'}">
                    <div class="flex items-center gap-2">
                        <span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                        <span class="truncate max-w-[150px]">${this.localWarnetTitle} (Lokal)</span>
                    </div>
                    ${this.activeBranchId === '0' ? '<svg class="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' : ''}
                </button>
        `;

        this.branches.forEach(branch => {
            const isSelected = String(branch.id) === String(this.activeBranchId);
            const statusDot = branch.status_online
                ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>'
                : '<span class="w-1.5 h-1.5 rounded-full bg-red-400"></span>';

            html += `
                <button type="button" data-branch-id="${branch.id}" class="branch-option-item w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${isSelected ? 'bg-accent/15 text-accent font-bold' : 'text-neutral-300 hover:bg-white/5'}">
                    <div class="flex items-center gap-2">
                        ${statusDot}
                        <span class="truncate max-w-[150px]">${branch.nama}</span>
                    </div>
                    ${isSelected ? '<svg class="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' : ''}
                </button>
            `;
        });

        html += `
            </div>
            <div class="p-1.5 border-t border-white/5 bg-neutral-900/50">
                <button type="button" id="btn-open-branch-settings" class="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors font-medium">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    <span>Kelola Cabang...</span>
                </button>
            </div>
        `;

        listContainer.innerHTML = html;

        // Bind event klik item
        listContainer.querySelectorAll('.branch-option-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = item.getAttribute('data-branch-id');
                this.switchBranch(targetId);
                this.toggleDropdown(false);
            });
        });

        const btnManage = document.getElementById('btn-open-branch-settings');
        if (btnManage) {
            btnManage.addEventListener('click', () => {
                this.toggleDropdown(false);
                // Buka tab pengaturan -> subtab multi-cabang
                if (window.Navigation && Navigation.switchTab) {
                    Navigation.switchTab('settings');
                }
                setTimeout(() => {
                    const branchTabBtn = document.getElementById('tab-btn-settings-branch');
                    if (branchTabBtn) branchTabBtn.click();
                }, 100);
            });
        }
    },

    renderActiveBranchBanner() {
        let banner = document.getElementById('active-branch-banner');
        if (this.activeBranchId === '0') {
            if (banner) banner.remove();
            return;
        }

        const activeBranch = this.branches.find(b => String(b.id) === String(this.activeBranchId));
        const branchName = activeBranch ? activeBranch.nama : 'Cabang Remote';

        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'active-branch-banner';
            banner.className = 'bg-gradient-to-r from-emerald-950/80 via-emerald-900/40 to-neutral-950/80 border-b border-emerald-500/30 px-4 py-2 flex items-center justify-between text-xs backdrop-blur-md shadow-md';
            const mainContent = document.getElementById('main-content') || document.querySelector('main');
            if (mainContent && mainContent.parentNode) {
                mainContent.parentNode.insertBefore(banner, mainContent);
            }
        }

        banner.innerHTML = `
            <div class="flex items-center gap-2.5 text-emerald-300 font-medium">
                <span class="flex h-2 w-2 relative">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Mode Kontrol Terhubung: <strong class="text-white font-bold tracking-wide">${branchName}</strong></span>
                <span class="hidden sm:inline text-emerald-400/60 font-mono text-[11px]">(Data & Billing dari Server Remote)</span>
            </div>
            <button type="button" id="btn-return-local-branch" class="px-2.5 py-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-neutral-200 hover:text-white transition-all text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                <span>Kembali ke Lokal</span>
            </button>
        `;

        const btnReturn = document.getElementById('btn-return-local-branch');
        if (btnReturn) {
            btnReturn.addEventListener('click', () => {
                this.switchBranch('0');
            });
        }
    },

    bindNavbarEvents() {
        const btn = document.getElementById('branch-selector-btn');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown();
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('branch-selector-dropdown');
            if (dropdown && !dropdown.contains(e.target)) {
                this.toggleDropdown(false);
            }
        });
    },

    toggleDropdown(forceState = null) {
        const menu = document.getElementById('branch-selector-menu');
        if (!menu) return;
        const isOpen = !menu.classList.contains('hidden');
        const shouldOpen = forceState !== null ? forceState : !isOpen;

        if (shouldOpen) {
            menu.classList.remove('hidden');
        } else {
            menu.classList.add('hidden');
        }
    },

    async switchBranch(branchId) {
        this.activeBranchId = String(branchId);
        localStorage.setItem('active_branch_id', this.activeBranchId);

        let branchName = this.localWarnetTitle;
        if (this.activeBranchId !== '0') {
            const b = this.branches.find(x => String(x.id) === this.activeBranchId);
            if (b) branchName = b.nama;
        }
        this.activeBranchName = branchName;
        localStorage.setItem('active_branch_name', branchName);

        this.renderNavbarDropdown();
        this.renderActiveBranchBanner();

        if (window.Toast) {
            window.Toast.show(`Beralih ke ${branchName}`, "info");
        }

        // Trigger reload dashboard data
        if (window.Dashboard && typeof Dashboard.loadData === 'function') {
            Dashboard.loadData();
        } else if (window.Dashboard && typeof Dashboard.init === 'function') {
            Dashboard.init();
        }
    },

    // =========================================================================
    // SETTINGS PANEL INTEGRATION
    // =========================================================================
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

    async regenerateMyBranchKey() {
        if (this._isRegenerating) return;
        this._isRegenerating = true;
        setTimeout(() => { this._isRegenerating = false; }, 800);

        if (!confirm("Peringatan: Membuat ulang API Key akan memutuskan koneksi dari server cabang lain yang menyimpan kunci lama ini. Lanjutkan?")) {
            return;
        }

        try {
            const res = await API.branch.regenerateKey();
            if (res && res.success && res.data) {
                const keyInput = document.getElementById('my-branch-api-key-input');
                if (keyInput) keyInput.value = res.data.api_key;
                if (window.Toast) {
                    window.Toast.show("API Key berhasil di-regenerate!", "success");
                }
            }
        } catch (err) {
            alert("Gagal regenerate key: " + (err.message || err));
        }
    },

    renderBranchesSettingsTable() {
        const tbody = document.getElementById('branch-settings-tbody');
        if (!tbody) return;

        if (!this.branches || this.branches.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-8 text-center text-xs text-neutral-500">
                        Belum ada cabang lain yang terhubung. Klik tombol <strong>+ Tambah Cabang</strong> untuk menghubungkan cabang baru.
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        this.branches.forEach((branch, idx) => {
            const statusBadge = branch.status_online
                ? `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] lg:text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Online ${branch.latensi_ms ? `(${branch.latensi_ms}ms)` : ''}</span>`
                : `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] lg:text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20"><span class="w-1.5 h-1.5 rounded-full bg-red-400"></span> Offline</span>`;

            html += `
                <tr class="border-b border-[#1c1c1c] hover:bg-white/[0.02] transition-colors text-xs lg:text-base">
                    <td class="py-3 px-3 text-neutral-400 font-mono">${idx + 1}</td>
                    <td class="py-3 px-3 font-semibold text-neutral-200 font-sans">${branch.nama}</td>
                    <td class="py-3 px-3 text-neutral-400 font-mono text-xs lg:text-sm max-w-xs truncate">${branch.url}</td>
                    <td class="py-3 px-3">${statusBadge}</td>
                    <td class="py-3 px-3 text-right">
                        <div class="flex items-center justify-end gap-2">
                            <button type="button" onclick="BranchManager.testExistingBranch(${branch.id})" class="px-3 py-1.5 bg-[#171717] hover:bg-[#222] border border-[#262626] text-neutral-300 hover:text-white rounded text-[10px] lg:text-xs font-semibold transition-colors">
                                Tes
                            </button>
                            <button type="button" onclick="BranchManager.deleteBranch(${branch.id})" class="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded text-[10px] lg:text-xs font-semibold transition-colors">
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

        // Reset form
        document.getElementById('form-add-branch')?.reset();
        const testResult = document.getElementById('branch-test-result');
        if (testResult) testResult.innerHTML = '';
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

    async submitAddBranch(e) {
        if (e) e.preventDefault();
        const urlInput = document.getElementById('input-branch-url');
        const keyInput = document.getElementById('input-branch-key');
        const nameInput = document.getElementById('input-branch-nama');

        if (!urlInput || !keyInput) return;
        const payload = {
            url: urlInput.value.trim(),
            api_key: keyInput.value.trim(),
            nama: nameInput ? nameInput.value.trim() : ''
        };

        try {
            const res = await API.branch.add(payload);
            if (res && res.success) {
                if (window.Toast) {
                    window.Toast.show("Cabang berhasil ditambahkan!", "success");
                }
                this.closeAddBranchModal();
                await this.loadBranches();
                this.renderNavbarDropdown();
                this.renderBranchesSettingsTable();
            } else {
                alert(res.error || "Gagal menambahkan cabang");
            }
        } catch (err) {
            alert("Error: " + (err.message || err));
        }
    },

    async testExistingBranch(branchId) {
        const branch = this.branches.find(b => b.id === branchId);
        if (!branch) return;

        if (window.Toast) {
            window.Toast.show(`Menguji koneksi ke ${branch.nama}...`, "info");
        }

        try {
            // Ambil branch dengan key
            const resKey = await API.branch.list(true);
            const fullBranch = resKey.data.find(b => b.id === branchId);
            if (!fullBranch) return;

            const res = await API.branch.test(fullBranch.url, fullBranch.api_key);
            if (res && res.success && res.data && res.data.online) {
                if (window.Toast) {
                    window.Toast.show(`Koneksi ${branch.nama} Normal (${res.data.latency_ms}ms)`, "success");
                }
            } else {
                if (window.Toast) {
                    window.Toast.show(`Gagal terhubung ke ${branch.nama}`, "error");
                }
            }
            await this.loadBranches();
            this.renderNavbarDropdown();
            this.renderBranchesSettingsTable();
        } catch (err) {
            if (window.Toast) {
                window.Toast.show(`Gagal tes: ${err.message || err}`, "error");
            }
        }
    },

    async deleteBranch(branchId) {
        const branch = this.branches.find(b => b.id === branchId);
        if (!confirm(`Hapus koneksi ke cabang '${branch ? branch.nama : branchId}'?`)) {
            return;
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
                await this.loadBranches();
                this.renderNavbarDropdown();
                this.renderBranchesSettingsTable();
            } else {
                alert(res.error || "Gagal menghapus cabang");
            }
        } catch (err) {
            alert("Error: " + (err.message || err));
        }
    }
};

window.BranchManager = BranchManager;

// Auto-init saat DOM ready
document.addEventListener('DOMContentLoaded', () => {
    BranchManager.init();
});
