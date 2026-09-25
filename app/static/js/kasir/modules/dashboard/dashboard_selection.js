// app/static/js/kasir/modules/dashboard/dashboard_selection.js

/**
 * DashboardSelection: Controller untuk Multi-Card Selection (Desktop: LG, XL, 2XL)
 * Mendukung Card-to-Card Range Swipe/Drag Selection, Ctrl+Click, Info Pill Counter, dan Batch Context Menu.
 */

const DashboardSelection = {
    selectedPcIds: new Set(),
    lastSelectedId: null,
    
    // Card-to-Card Drag state
    isMouseDown: false,
    dragStartPcId: null,
    currentHoverPcId: null,
    hasDragged: false,
    _justFinishedDrag: false,
    _initialized: false,

    isDesktopBreakpoint() {
        return typeof window !== 'undefined' && window.innerWidth >= 1024;
    },

    init() {
        if (this._initialized) return;
        this._initialized = true;

        this._createFloatingToolbar();
        this._attachGlobalListeners();
    },

    _createFloatingToolbar() {
        if (document.getElementById('batch-action-toolbar')) return;
        const toolbar = document.createElement('div');
        toolbar.id = 'batch-action-toolbar';
        toolbar.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[9995] bg-[#111111]/95 backdrop-blur-md border border-[#2a2a2a] rounded-full px-4 py-2 shadow-[0_10px_35px_rgba(0,0,0,0.8)] flex items-center gap-3 hidden animate-in slide-in-from-bottom-3 duration-200';
        document.body.appendChild(toolbar);
    },

    _attachGlobalListeners() {
        // Clear selection on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.selectedPcIds.size > 0) {
                if (!document.getElementById('pc-context-menu')) {
                    this.clearSelection();
                }
            }
        });

        // Global mousemove to track card-to-card drag smoothly using elementFromPoint
        window.addEventListener('mousemove', (e) => {
            if (!this.isMouseDown || !this.dragStartPcId || !this.isDesktopBreakpoint()) return;

            const el = document.elementFromPoint(e.clientX, e.clientY);
            if (!el) return;

            const card = el.closest('.pc-card-item');
            if (!card || !card.dataset.pcId) return;

            const targetPcId = parseInt(card.dataset.pcId);
            if (targetPcId && targetPcId !== this.currentHoverPcId) {
                this.currentHoverPcId = targetPcId;
                if (targetPcId !== this.dragStartPcId) {
                    this.hasDragged = true;
                }
                this.selectRange(this.dragStartPcId, targetPcId);
            }
        });

        // Global mouseup to finalize card drag without clearing selection
        window.addEventListener('mouseup', () => {
            if (this.isMouseDown) {
                this.isMouseDown = false;
                if (this.hasDragged) {
                    this._justFinishedDrag = true;
                    setTimeout(() => {
                        this._justFinishedDrag = false;
                    }, 120);
                }
                this.dragStartPcId = null;
                this.currentHoverPcId = null;
                this.hasDragged = false;
            }
        });

        // Click outside on background to clear selection if not holding Ctrl
        window.addEventListener('click', (e) => {
            if (!this.isDesktopBreakpoint()) return;
            if (this._justFinishedDrag) return;
            if (this.selectedPcIds.size === 0) return;

            const target = e.target;
            if (!target.closest('.pc-card-item, #batch-action-toolbar, #pc-context-menu') && !e.ctrlKey && !e.metaKey) {
                this.clearSelection();
            }
        });
    },

    // Get list of PC IDs in order as currently displayed in the DOM
    getDisplayedPcIds() {
        const cards = document.querySelectorAll('.pc-card-item');
        const ids = [];
        cards.forEach(c => {
            const id = parseInt(c.dataset.pcId);
            if (id) ids.push(id);
        });
        return ids;
    },

    handleCardMouseDown(event, pcId) {
        if (!this.isDesktopBreakpoint()) return;
        if (event.button !== 0) return; // Only left click

        // If Ctrl or Shift is held, leave it to click handler
        if (event.ctrlKey || event.metaKey || event.shiftKey) return;

        // Prevent native browser text selection/drag ghost
        event.preventDefault();

        this.isMouseDown = true;
        this.dragStartPcId = pcId;
        this.currentHoverPcId = pcId;
        this.hasDragged = false;
    },

    handleCardClick(event, pcId) {
        if (!this.isDesktopBreakpoint()) {
            Dashboard.showContextMenu(event, pcId);
            return;
        }

        // If user just finished dragging across cards, ignore click event
        if (this._justFinishedDrag) {
            this._justFinishedDrag = false;
            return;
        }

        const isCtrl = event.ctrlKey || event.metaKey;
        const isShift = event.shiftKey;

        if (isShift && this.lastSelectedId !== null) {
            this.selectRange(this.lastSelectedId, pcId);
            return;
        }

        if (isCtrl) {
            this.toggleSelect(pcId);
            return;
        }

        // If multiple cards are already selected:
        if (this.selectedPcIds.size > 1) {
            if (this.selectedPcIds.has(pcId)) {
                // Clicked on one of the selected cards: open batch context menu
                this.showBatchContextMenu(event);
            } else {
                // Clicked on an unselected card: clear selection and open single context menu
                this.clearSelection();
                Dashboard.showContextMenu(event, pcId);
            }
            return;
        }

        // Single normal click: Open standard context menu
        Dashboard.showContextMenu(event, pcId);
    },

    handleCardContextMenu(event, pcId) {
        if (!this.isDesktopBreakpoint()) {
            Dashboard.showContextMenu(event, pcId);
            return;
        }

        const isCtrl = event.ctrlKey || event.metaKey;
        if (isCtrl) {
            this.toggleSelect(pcId);
            return;
        }

        // If multiple cards are selected and right-clicking on one of them:
        if (this.selectedPcIds.size > 1 && this.selectedPcIds.has(pcId)) {
            this.showBatchContextMenu(event);
            return;
        }

        // If right clicking on unselected card while others were selected: clear and open single menu
        if (this.selectedPcIds.size > 0 && !this.selectedPcIds.has(pcId)) {
            this.clearSelection();
        }

        Dashboard.showContextMenu(event, pcId);
    },

    toggleSelect(pcId) {
        if (this.selectedPcIds.has(pcId)) {
            this.selectedPcIds.delete(pcId);
        } else {
            this.selectedPcIds.add(pcId);
            this.lastSelectedId = pcId;
        }
        this.updateUI();
    },

    selectRange(fromPcId, toPcId) {
        const displayedIds = this.getDisplayedPcIds();
        const fromIdx = displayedIds.indexOf(fromPcId);
        const toIdx = displayedIds.indexOf(toPcId);

        if (fromIdx === -1 || toIdx === -1) return;

        const start = Math.min(fromIdx, toIdx);
        const end = Math.max(fromIdx, toIdx);

        this.selectedPcIds.clear();
        for (let i = start; i <= end; i++) {
            this.selectedPcIds.add(displayedIds[i]);
        }
        this.lastSelectedId = toPcId;
        this.updateUI();
    },

    clearSelection() {
        this.selectedPcIds.clear();
        this.lastSelectedId = null;
        this.isMouseDown = false;
        this.hasDragged = false;
        this.dragStartPcId = null;
        this.currentHoverPcId = null;
        this.updateUI();
    },

    isSelected(pcId) {
        return this.selectedPcIds.has(pcId);
    },

    getSelectedPcs() {
        const allPcs = Dashboard.lastData?.pc_list || [];
        return allPcs.filter(p => this.selectedPcIds.has(p.id));
    },

    _applyCardSelectionVisual(card, isSelected) {
        const badge = card.querySelector('.selection-check-badge');
        if (isSelected) {
            card.classList.add('ring-2', 'ring-indigo-500', 'border-indigo-400', 'bg-indigo-950/30');
            if (badge) badge.classList.remove('hidden');
        } else {
            card.classList.remove('ring-2', 'ring-indigo-500', 'border-indigo-400', 'bg-indigo-950/30');
            if (badge) badge.classList.add('hidden');
        }
    },

    updateUI() {
        // 1. Update Card Visuals in DOM
        const cards = document.querySelectorAll('.pc-card-item');
        cards.forEach(card => {
            const pcId = parseInt(card.dataset.pcId);
            const isSel = this.selectedPcIds.has(pcId);
            this._applyCardSelectionVisual(card, isSel);
        });

        // 2. Update Floating Info Pill
        this._renderFloatingToolbar();
    },

    _renderFloatingToolbar() {
        const toolbar = document.getElementById('batch-action-toolbar');
        if (!toolbar) return;

        const count = this.selectedPcIds.size;
        if (count < 2 || !this.isDesktopBreakpoint()) {
            toolbar.classList.add('hidden');
            return;
        }

        const selectedPcs = this.getSelectedPcs();
        const pcKodeSummary = selectedPcs.slice(0, 5).map(p => p.kode).join(', ') + (selectedPcs.length > 5 ? ` +${selectedPcs.length - 5}` : '');

        toolbar.innerHTML = `
            <div class="flex items-center gap-2.5">
                <span class="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                <span class="text-xs font-mono font-medium text-neutral-300">
                    <strong class="text-indigo-300 font-bold">${count} PC Terpilih:</strong> ${pcKodeSummary}
                </span>
            </div>
            <button onclick="DashboardSelection.clearSelection()" 
                class="p-1 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-full transition-colors ml-1" 
                title="Batalkan Pilihan (Esc)">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        `;
        toolbar.classList.remove('hidden');
    },

    showBatchContextMenu(event) {
        Dashboard.closeContextMenu();
        const selectedPcs = this.getSelectedPcs();
        if (selectedPcs.length === 0) return;

        const count = selectedPcs.length;
        const kosongPcs = selectedPcs.filter(p => p.status === 'kosong');
        const aktifPcs = selectedPcs.filter(p => p.status === 'terpakai' && p.sesi_detail && p.sesi_detail.tipe !== 'admin');
        const macPcs = selectedPcs.filter(p => !!p.mac_address);
        const onlinePcs = selectedPcs.filter(p => p.status_koneksi === 'online');

        // Smart Visibility Logic:
        // - Buka Sesi (Guest Batch): Only if ALL selected PCs are empty/idle
        // - Tambah Sesi: Only if ALL selected PCs have active playing sessions
        // - If mixed: neither Buka Sesi nor Tambah Sesi is shown
        const isAllKosong = (kosongPcs.length === count);
        const isAllAktif = (aktifPcs.length === count);

        const pcSummary = selectedPcs.length <= 3 
            ? selectedPcs.map(p => p.kode).join(', ') 
            : `${selectedPcs.slice(0, 3).map(p => p.kode).join(', ')} +${selectedPcs.length - 3}`;

        const menu = document.createElement('div');
        menu.id = 'pc-context-menu';
        menu.className = 'fixed z-[9999] w-56 lg:w-60 xl:w-64 max-w-[280px] py-1.5 bg-[#141414] border border-[#2a2a2a] rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-1 duration-100 overflow-hidden select-none';

        menu.innerHTML = `
            <div class="px-3.5 py-2 border-b border-[#222] mb-1 min-w-0">
                <div class="text-xs lg:text-sm font-bold text-indigo-300 font-mono flex items-center gap-1.5 truncate">
                    <span class="w-2 h-2 rounded-full bg-indigo-400 shrink-0"></span>
                    <span class="truncate">${count} Unit PC Terpilih</span>
                </div>
                <div class="text-[10px] lg:text-xs text-neutral-400 font-mono truncate mt-0.5" title="${selectedPcs.map(p => p.kode).join(', ')}">
                    ${pcSummary}
                </div>
            </div>

            <!-- Buka Sesi (Guest Batch) - Only if ALL PCs are empty -->
            ${isAllKosong ? `
            <button class="ctx-item w-full flex items-center gap-2.5 px-3.5 py-2 text-xs lg:text-sm text-emerald-300 hover:bg-[#1f1f1f] hover:text-emerald-200 transition-colors text-left min-w-0"
                    onclick="Dashboard.closeContextMenu(); DashboardSelection.openBatchBukaModal()">
                <svg class="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                <span class="truncate">Buka Sesi (${count} PC)</span>
            </button>` : ''}

            <!-- Tambah Sesi - Only if ALL PCs have active sessions -->
            ${isAllAktif ? `
            <button class="ctx-item w-full flex items-center gap-2.5 px-3.5 py-2 text-xs lg:text-sm text-neutral-300 hover:bg-[#1f1f1f] hover:text-white transition-colors text-left min-w-0"
                    onclick="Dashboard.closeContextMenu(); DashboardSelection.openBatchTambahModal()">
                <svg class="w-3.5 h-3.5 text-neutral-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <span class="truncate">Tambah Waktu (${count} Sesi)</span>
            </button>` : ''}

            <!-- Tutup Sesi - If any active sessions exist -->
            ${aktifPcs.length > 0 ? `
            <button class="ctx-item w-full flex items-center gap-2.5 px-3.5 py-2 text-xs lg:text-sm text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors text-left min-w-0"
                    onclick="Dashboard.closeContextMenu(); DashboardSelection.tutupSesiBatchConfirm()">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                <span class="truncate">Tutup Sesi (${aktifPcs.length} Sesi)</span>
            </button>` : ''}

            <!-- Wake-on-LAN -->
            ${macPcs.length > 0 ? `
            <div class="border-t border-[#222] my-1"></div>
            <button class="ctx-item w-full flex items-center gap-2.5 px-3.5 py-2 text-xs lg:text-sm text-green-400 hover:bg-green-950/40 hover:text-green-300 transition-colors text-left font-mono min-w-0"
                    onclick="Dashboard.closeContextMenu(); DashboardSelection.wolBatchAction()">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9"/></svg>
                <span class="truncate">Wake-on-LAN (${macPcs.length} PC)</span>
            </button>` : ''}

            <!-- Restart & Shutdown -->
            ${onlinePcs.length > 0 ? `
            <div class="border-t border-[#222] my-1"></div>
            <button class="ctx-item w-full flex items-center gap-2.5 px-3.5 py-2 text-xs lg:text-sm text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors text-left min-w-0"
                    onclick="Dashboard.closeContextMenu(); DashboardSelection.remoteBatchConfirm('restart')">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5"/></svg>
                <span class="truncate">Restart (${onlinePcs.length} PC)</span>
            </button>
            <button class="ctx-item w-full flex items-center gap-2.5 px-3.5 py-2 text-xs lg:text-sm text-red-500 hover:bg-red-950/50 hover:text-red-400 transition-colors text-left min-w-0"
                    onclick="Dashboard.closeContextMenu(); DashboardSelection.remoteBatchConfirm('shutdown')">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L12 12m0-6v6"/></svg>
                <span class="truncate">Shutdown (${onlinePcs.length} PC)</span>
            </button>` : ''}

            <div class="border-t border-[#222] my-1"></div>
            <button class="ctx-item w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-neutral-400 hover:bg-[#1f1f1f] hover:text-neutral-200 transition-colors text-left font-mono min-w-0"
                    onclick="Dashboard.closeContextMenu(); DashboardSelection.clearSelection()">
                <svg class="w-3.5 h-3.5 text-neutral-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                <span class="truncate">Batalkan Pilihan (Esc)</span>
            </button>
        `;

        document.body.appendChild(menu);
        const mw = menu.offsetWidth || 220;
        const mh = menu.offsetHeight || 240;
        let x = event.clientX || window.innerWidth / 2;
        let y = event.clientY || window.innerHeight / 2;
        if (x + mw > window.innerWidth) x = window.innerWidth - mw - 8;
        if (y + mh > window.innerHeight) y = window.innerHeight - mh - 8;
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        if (typeof Dashboard !== 'undefined' && typeof Dashboard.setupContextMenuListeners === 'function') {
            Dashboard.setupContextMenuListeners();
        }
    },

    openBatchBukaModal() {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        const selectedPcs = this.getSelectedPcs();
        const kosongPcs = selectedPcs.filter(p => p.status === 'kosong');
        if (kosongPcs.length === 0) {
            return Toast.error('Tidak ada PC kosong yang terpilih');
        }
        if (typeof BukaModal !== 'undefined' && typeof BukaModal.openBatch === 'function') {
            BukaModal.openBatch(kosongPcs);
        }
    },

    openBatchTambahModal() {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        const selectedPcs = this.getSelectedPcs();
        const aktifPcs = selectedPcs.filter(p => p.status === 'terpakai' && p.sesi_detail && p.sesi_detail.tipe !== 'admin');
        if (aktifPcs.length === 0) {
            return Toast.error('Tidak ada sesi bermain aktif yang terpilih');
        }
        if (typeof TambahModal !== 'undefined' && typeof TambahModal.openBatch === 'function') {
            TambahModal.openBatch(aktifPcs);
        }
    },

    async wolBatchAction() {
        const selectedPcs = this.getSelectedPcs();
        const macPcs = selectedPcs.filter(p => !!p.mac_address);
        if (macPcs.length === 0) {
            return Toast.error('Tidak ada PC dengan MAC Address yang terpilih');
        }

        try {
            const pcIds = macPcs.map(p => p.id);
            const result = await API.pc.wol(pcIds);
            const ok = result.result?.success || [];
            const errs = result.result?.errors || [];
            if (ok.length > 0) {
                Toast.success(`🟢 Magic Packet dikirim ke ${ok.length} PC (<strong>${ok.join(', ')}</strong>)`);
            }
            if (errs.length > 0) {
                Toast.error(errs.map(e => e.error).join('<br>'));
            }
        } catch (err) {
            Toast.error(err.message);
        }
    },

    tutupSesiBatchConfirm() {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        const selectedPcs = this.getSelectedPcs();
        const aktifPcs = selectedPcs.filter(p => p.status === 'terpakai' && p.sesi_detail && p.sesi_detail.tipe !== 'admin');
        if (aktifPcs.length === 0) return Toast.error('Tidak ada sesi aktif terpilih');

        const sesiIds = aktifPcs.map(p => p.sesi_detail.id);

        Modal.confirm(`
            <div class="space-y-3 min-w-0">
                <p class="text-xs lg:text-sm text-neutral-200 font-bold uppercase tracking-wider">Tutup ${sesiIds.length} Sesi Billing?</p>
                <div class="bg-[#161616] border border-[#262626] rounded-xl p-3 max-h-36 overflow-y-auto scrollbar-thin">
                    <div class="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-1.5">Target PC (${aktifPcs.length} Unit):</div>
                    <div class="flex flex-wrap gap-1.5">
                        ${aktifPcs.map(p => `<span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#222] border border-[#333] text-indigo-300">${p.kode}</span>`).join('')}
                    </div>
                </div>
                <p class="text-[11px] lg:text-xs text-neutral-400">Semua sesi transaksi di atas akan dihentikan secara bersamaan.</p>
            </div>
        `, async () => {
            try {
                const res = await API.sesi.tutupBatch(sesiIds);
                if (res.success) {
                    Toast.success(`${res.total_success} sesi berhasil ditutup`);
                    DashboardSelection.clearSelection();
                    if (typeof Dashboard !== 'undefined') Dashboard.load();
                } else {
                    Toast.error('Gagal menutup beberapa sesi');
                }
            } catch (err) {
                Toast.error(err.message);
            }
        });
    },

    remoteBatchConfirm(action) {
        const selectedPcs = this.getSelectedPcs();
        const onlinePcs = selectedPcs.filter(p => p.status_koneksi === 'online');
        if (onlinePcs.length === 0) return Toast.error('Tidak ada PC online terpilih');

        const pcIds = onlinePcs.map(p => p.id);
        const actionLabel = action === 'shutdown' ? 'Shutdown (Matikan)' : 'Restart (Mulai Ulang)';

        Modal.confirm(`
            <div class="space-y-3 min-w-0">
                <p class="text-xs lg:text-sm text-neutral-200 font-bold uppercase tracking-wider">${actionLabel} ${pcIds.length} Unit PC?</p>
                <div class="bg-[#161616] border border-[#262626] rounded-xl p-3 max-h-36 overflow-y-auto scrollbar-thin">
                    <div class="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-1.5">Target PC (${onlinePcs.length} Unit):</div>
                    <div class="flex flex-wrap gap-1.5">
                        ${onlinePcs.map(p => `<span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#222] border border-[#333] text-indigo-300">${p.kode}</span>`).join('')}
                    </div>
                </div>
                <p class="text-[11px] lg:text-xs text-red-400 font-bold">⚠️ Perhatian: PC akan langsung mati/restart secara paksa. Semua pekerjaan yang belum disimpan di PC client akan hilang.</p>
            </div>
        `, async () => {
            try {
                const res = await API.monitor.remoteBatch(pcIds, action);
                if (res.success) {
                    Toast.success(`Perintah ${action === 'shutdown' ? 'Shutdown' : 'Restart'} berhasil dikirim ke ${res.total_success} PC!`);
                    DashboardSelection.clearSelection();
                } else {
                    Toast.error('Gagal mengirim perintah remote ke beberapa PC');
                }
            } catch (err) {
                Toast.error(err.message || 'Gagal mengirim perintah remote');
            }
        });
    }
};

window.DashboardSelection = DashboardSelection;
