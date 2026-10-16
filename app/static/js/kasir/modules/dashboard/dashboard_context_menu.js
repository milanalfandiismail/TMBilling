/**
 * Dashboard - Context Menu Sub-module
 * Menangani context menu klik kanan PC card (quick billing, kunci meja, restart, shutdown, trigger screenshot).
 */
window.Dashboard = window.Dashboard || {};
Object.assign(window.Dashboard, {
    showContextMenu(event, pcId) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        this.closeContextMenu();

        const pc = this.lastData?.pc_list?.find(p => p.id === pcId);
        if (!pc) return;

        const isSystemMode = pc.is_system_mode || pc.status === 'system' || (pc.sesi_detail?.tipe === 'admin' && ((pc.sesi_detail?.nama_guest || '').toUpperCase() === 'SYSTEM' || (pc.sesi_detail?.member_nama || '').toUpperCase() === 'SYSTEM'));
        const isAdminMode = !isSystemMode && (pc.is_admin_mode || pc.status === 'admin' || pc.sesi_detail?.tipe === 'admin');
        const hasMac = !!pc.mac_address;
        const hasSesi = !isSystemMode && !isAdminMode && !!(pc.sesi_detail && pc.sesi_detail.tipe !== 'admin');

        const menu = document.createElement('div');
        menu.id = 'pc-context-menu';
        menu.className = [
            'fixed z-[9999] min-w-[200px] py-1.5',
            'bg-[#141414] border border-[#2a2a2a] rounded-xl shadow-2xl',
            'animate-in fade-in slide-in-from-top-1 duration-100'
        ].join(' ');

        // Context Menu khusus untuk Mode SYSTEM (Operasional dinonaktifkan, hanya Clear Sesi & Detail)
        if (isSystemMode) {
            menu.innerHTML = `
                <div class="px-4 py-2 border-b border-[#222] mb-1">
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-xs lg:text-base font-bold text-indigo-300 font-mono">${pc.kode}</span>
                        <span class="text-[9px] px-1.5 py-0.5 rounded bg-indigo-950 border border-indigo-700/50 text-indigo-300 font-bold tracking-wider">SYSTEM</span>
                    </div>
                    <div class="text-[10px] lg:text-xs text-neutral-500 font-mono mt-0.5">${pc.ip_address || 'Tidak ada IP'}</div>
                </div>

                <button class="ctx-item w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-neutral-300 hover:bg-[#1f1f1f] hover:text-white transition-colors text-left"
                        onclick="Dashboard.closeContextMenu(); Dashboard.showDetail(${pcId})">
                    <svg class="w-3.5 h-3.5 text-neutral-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span>Detail PC</span>
                </button>

                <div class="border-t border-[#222] my-1 remote-hide-action"></div>

                <button class="ctx-item remote-hide-action w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-indigo-400 hover:bg-indigo-950/40 hover:text-indigo-300 transition-colors text-left font-mono"
                        onclick="Dashboard.closeContextMenu(); Dashboard.clearSesiSystem(${pcId}, ${pc.sesi_detail ? pc.sesi_detail.id : 'null'})">
                    <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                    <span class="font-bold">Clear Sesi System</span>
                </button>
            `;
        } else {
            menu.innerHTML = `
                <div class="px-4 py-2 border-b border-[#222] mb-1">
                    <div class="text-xs lg:text-base font-bold text-neutral-200 font-mono">${pc.kode}</div>
                    <div class="text-[10px] lg:text-base text-neutral-500 font-mono">${pc.ip_address || 'Tidak ada IP'}</div>
                </div>

                <button class="ctx-item w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-neutral-300 hover:bg-[#1f1f1f] hover:text-white transition-colors text-left"
                        onclick="Dashboard.closeContextMenu(); Dashboard.showDetail(${pcId})">
                    <svg class="w-3.5 h-3.5 text-neutral-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span>Detail PC</span>
                </button>

                ${!pc.sesi_detail && !isAdminMode ? `
                <button class="ctx-item remote-hide-action w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-neutral-300 hover:bg-[#1f1f1f] hover:text-white transition-colors text-left"
                        onclick="Dashboard.closeContextMenu(); BukaModal.open('${pc.kode}', '${pc.grup}')">
                    <svg class="w-3.5 h-3.5 text-neutral-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                    <span>Buka Sesi</span>
                </button>` : ''}

                ${isAdminMode ? `
                <button class="ctx-item remote-hide-action w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-amber-400 hover:bg-amber-950/40 hover:text-amber-300 transition-colors text-left font-mono"
                        onclick="Dashboard.closeContextMenu(); Dashboard.logoutAdmin(${pcId}, ${pc.sesi_detail ? pc.sesi_detail.id : 'null'})">
                    <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                    </svg>
                    <span>Logout Sesi Admin</span>
                </button>` : ''}

                ${hasSesi ? `
                <button class="ctx-item remote-hide-action w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-neutral-300 hover:bg-[#1f1f1f] hover:text-white transition-colors text-left"
                        onclick="Dashboard.closeContextMenu(); TambahModal.open(${pc.sesi_detail.id}, '${pc.grup}')">
                    <svg class="w-3.5 h-3.5 text-neutral-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span>Tambah Waktu</span>
                </button>` : ''}

                ${hasSesi ? `
                <button class="ctx-item remote-hide-action w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-neutral-300 hover:bg-[#1f1f1f] hover:text-white transition-colors text-left font-mono"
                        onclick="Dashboard.closeContextMenu(); ${pc.sesi_detail.tipe === 'guest' ? `Dashboard.showGuestRefundModal(${pc.sesi_detail.id})` : `Dashboard.showMemberRefundModal(${pc.sesi_detail.member_id})`}">
                    <svg class="w-3.5 h-3.5 text-neutral-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z"/>
                    </svg>
                    <span>Refund Paket</span>
                </button>` : ''}

                ${hasSesi ? `
                <button class="ctx-item remote-hide-action w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors text-left"
                        onclick="Dashboard.closeContextMenu(); Dashboard.tutupSesi(${pc.sesi_detail.id})">
                    <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                    <span>Tutup Sesi</span>
                </button>` : ''}

                ${hasSesi ? `
                <button class="ctx-item remote-hide-action w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-neutral-300 hover:bg-[#1f1f1f] hover:text-white transition-colors text-left"
                        onclick="Dashboard.closeContextMenu(); Dashboard.pindahSesi(${pc.sesi_detail.id}, '${pc.sesi_detail.tipe}', '${pc.grup}')">
                    <svg class="w-3.5 h-3.5 text-neutral-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                    </svg>
                    <span>Pindah PC</span>
                </button>` : ''}

                <div class="border-t border-[#222] my-1 remote-hide-action"></div>

                ${hasMac ? `
                <button class="ctx-item remote-hide-action w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-green-400 hover:bg-green-950/40 hover:text-green-300 transition-colors text-left"
                        onclick="Dashboard.closeContextMenu(); Dashboard.wolSingle(${pcId})">
                    <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9"/>
                    </svg>
                    <span>Wake-on-LAN</span>
                    <span class="ml-auto text-[9px] lg:text-base text-green-700 font-mono">${pc.mac_address}</span>
                </button>` : `
                <div class="ctx-item remote-hide-action w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-neutral-600 cursor-not-allowed text-left" title="Tambahkan MAC Address di tab PC terlebih dahulu">
                    <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9"/>
                    </svg>
                    <span>Wake-on-LAN</span>
                    <span class="ml-auto text-[9px] lg:text-base text-neutral-700">No MAC</span>
                </div>`}

                ${pc.status !== 'offline' ? `
                <div class="border-t border-[#222] my-1 remote-hide-action"></div>
                <button class="ctx-item remote-hide-action w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors text-left"
                        onclick="Dashboard.closeContextMenu(); Dashboard.remoteAction(${pcId}, 'restart')">
                    <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
                    </svg>
                    <span>Restart PC</span>
                </button>
                <button class="ctx-item remote-hide-action w-full flex items-center gap-3 px-4 py-2 text-xs lg:text-base text-red-500 hover:bg-red-950/50 hover:text-red-400 transition-colors text-left"
                        onclick="Dashboard.closeContextMenu(); Dashboard.remoteAction(${pcId}, 'shutdown')">
                    <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L12 12m0-6v6" />
                    </svg>
                    <span>Shutdown PC</span>
                </button>` : ''}
            `;
        }

        document.body.appendChild(menu);
        const mw = menu.offsetWidth || 210;
        const mh = menu.offsetHeight || 220;
        let x = event.clientX;
        let y = event.clientY;
        if (x + mw > window.innerWidth) x = window.innerWidth - mw - 8;
        if (y + mh > window.innerHeight) y = window.innerHeight - mh - 8;
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        this.setupContextMenuListeners();
    },

    setupContextMenuListeners() {
        if (this._ctxOutsideHandler) {
            document.removeEventListener('click', this._ctxOutsideHandler);
            document.removeEventListener('contextmenu', this._ctxOutsideHandler);
        }
        if (this._ctxKeydownHandler) {
            document.removeEventListener('keydown', this._ctxKeydownHandler);
        }
        this._ctxOutsideHandler = (e) => {
            const menu = document.getElementById('pc-context-menu');
            if (menu && !menu.contains(e.target)) {
                this.closeContextMenu();
            }
        };
        this._ctxKeydownHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeContextMenu();
            }
        };
        setTimeout(() => {
            document.addEventListener('click', this._ctxOutsideHandler);
            document.addEventListener('contextmenu', this._ctxOutsideHandler);
            document.addEventListener('keydown', this._ctxKeydownHandler);
        }, 10);
    },

    closeContextMenu() {
        const el = document.getElementById('pc-context-menu');
        if (el) el.remove();
        if (this._ctxOutsideHandler) {
            document.removeEventListener('click', this._ctxOutsideHandler);
            document.removeEventListener('contextmenu', this._ctxOutsideHandler);
            this._ctxOutsideHandler = null;
        }
        if (this._ctxKeydownHandler) {
            document.removeEventListener('keydown', this._ctxKeydownHandler);
            this._ctxKeydownHandler = null;
        }
    },


});
