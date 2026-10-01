// app/static/js/kasir/modules/dashboard/dashboard_process_monitor.js

/**
 * Modul Monitoring Proses Windows Client pada Dashboard Kasir.
 * Menangani penayangan tabel proses, pencarian proses, penyegaran proses on-demand,
 * dan penghentian paksa (kill process).
 */

const DashboardProcessMonitor = {
    _activeProcesses: [],
    _lastUpdatedTsMap: {},
    _refreshIntervals: {},
    _livePollingTimer: null,

    showProcesses(currentPcId) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        document.getElementById('view-action-menu')?.classList.add('hidden');
        document.getElementById('view-hardware-specs')?.classList.add('hidden');
        document.getElementById('view-remote-client')?.classList.add('hidden');
        document.getElementById('view-process-list')?.classList.remove('hidden');
        document.getElementById('modal-card-main-footer')?.classList.add('hidden');
        this.loadProcesses(currentPcId, false);

        // Pasang continuous silent background polling (setiap 3 detik) selama tab proses terbuka
        if (this._livePollingTimer) clearInterval(this._livePollingTimer);
        this._livePollingTimer = setInterval(() => {
            const view = document.getElementById('view-process-list');
            if (view && !view.classList.contains('hidden') && DashboardDetailModal && DashboardDetailModal.currentPcId) {
                this.loadProcesses(DashboardDetailModal.currentPcId, false, false, true);
            }
        }, 3000);
    },

    backToMenu() {
        Object.keys(this._refreshIntervals).forEach(id => {
            clearInterval(this._refreshIntervals[id]);
            delete this._refreshIntervals[id];
        });
        if (this._livePollingTimer) {
            clearInterval(this._livePollingTimer);
            this._livePollingTimer = null;
        }
        document.getElementById('view-action-menu')?.classList.remove('hidden');
        document.getElementById('view-process-list')?.classList.add('hidden');
        document.getElementById('modal-card-main-footer')?.classList.remove('hidden');
    },

    renderSkeleton(count = 8) {
        let items = '';
        for (let i = 0; i < count; i++) {
            items += `
                <div class="flex items-center justify-between p-3 bg-[#141414] border border-[#222] rounded-xl gap-3 animate-pulse select-none">
                    <div class="min-w-0 flex-1 space-y-2">
                        <div class="h-3.5 bg-neutral-800 rounded w-7/12"></div>
                        <div class="h-2.5 bg-neutral-800/60 rounded w-9/12"></div>
                    </div>
                    <div class="w-16 h-7 bg-neutral-800/40 border border-neutral-800/60 rounded-lg shrink-0"></div>
                </div>
            `;
        }
        return items;
    },

    renderProcessRows(pcId, processes) {
        const container = document.getElementById('modal-process-list');
        const countEl = document.getElementById('modal-pc-count');
        if (!container || !countEl) return;

        countEl.innerText = `${processes.length} PROSES`;

        if (processes.length === 0) {
            container.innerHTML = '<div class="col-span-full py-12 text-center text-neutral-500 text-xs lg:text-sm font-mono">Tidak ada proses</div>';
            return;
        }

        container.innerHTML = processes.map(p => `
            <div class="flex items-center justify-between p-3 bg-[#141414] hover:bg-[#181818] border border-[#222] hover:border-neutral-500 rounded-xl transition-all gap-3 select-none group">
                <div class="min-w-0 flex-1 font-mono">
                    <div class="font-bold text-xs lg:text-sm text-neutral-100 truncate">${typeof escapeHtml === 'function' ? escapeHtml(p.name) : p.name}</div>
                    <div class="text-[10px] lg:text-xs text-neutral-400 truncate mt-0.5">${typeof escapeHtml === 'function' ? escapeHtml(p.title || '-') : (p.title || '-')}</div>
                </div>
                <button onclick="DashboardProcessMonitor.killProcess(${pcId}, '${(p.name || '').replace(/'/g, "\\'")}')" class="px-3 py-1.5 bg-red-950/40 hover:bg-red-900 border border-red-800/40 hover:border-red-700 text-red-400 hover:text-red-200 text-xs font-bold rounded-lg transition-all font-mono uppercase tracking-wider shrink-0">
                    Akhiri
                </button>
            </div>
        `).join('');
    },

    _sortProcesses(data) {
        return [...data].sort((a, b) => {
            const getMem = str => {
                if (!str) return 0;
                const match = str.match(/Mem:\s*(\d+)\s*MB/i);
                return match ? parseInt(match[1], 10) : 0;
            };
            return getMem(b.title) - getMem(a.title);
        });
    },

    _setupSearchFilter(pcId) {
        const searchInput = document.getElementById('input-search-processes');
        if (searchInput && !searchInput._boundLive) {
            searchInput._boundLive = true;
            searchInput.oninput = (e) => {
                const query = e.target.value.toLowerCase().trim();
                const filtered = this._activeProcesses.filter(p =>
                    (p.name && p.name.toLowerCase().includes(query)) ||
                    (p.title && p.title.toLowerCase().includes(query))
                );
                this.renderProcessRows(pcId, filtered);
            };
        }
    },

    async loadProcesses(pcId, isManualRefresh = false, skipTrigger = false, isSilent = false) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;

        const container = document.getElementById('modal-process-list');
        const countEl = document.getElementById('modal-pc-count');
        const refreshBtn = document.getElementById('btn-refresh-processes');

        if (this._refreshIntervals[pcId]) {
            clearInterval(this._refreshIntervals[pcId]);
            delete this._refreshIntervals[pcId];
        }

        const setBtnLoading = (text = 'Menyegarkan...') => {
            if (refreshBtn) {
                refreshBtn.disabled = true;
                refreshBtn.classList.add('opacity-50', 'cursor-not-allowed');
                refreshBtn.innerHTML = `
                    <span class="inline-flex items-center gap-1.5">
                        <svg class="animate-spin -ml-0.5 h-3.5 w-3.5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        ${text}
                    </span>
                `;
            }
        };

        const restoreBtn = () => {
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                refreshBtn.innerHTML = 'Segarkan';
            }
        };

        if (!isSilent && (!this._activeProcesses || !this._activeProcesses.length)) {
            // 1. Tampilkan Skeleton Loader HANYA saat data awal belum ada
            if (container) container.innerHTML = this.renderSkeleton(8);
        }

        if (!isManualRefresh) {
            // Mode A: Pembukaan Tab / Inisial / Silent Background Polling
            if (!isSilent) {
                if (countEl) countEl.innerText = 'MEMUAT...';
                setBtnLoading('Memuat...');
            }
            try {
                const json = await API.request(`/api/v1/kasir/monitor/processes/${pcId}`);
                if (!json.success) throw new Error(json.error || 'Gagal memuat proses');

                if (json.last_updated_ts) {
                    this._lastUpdatedTsMap[pcId] = json.last_updated_ts;
                }

                const sorted = this._sortProcesses(json.data || []);
                const isChanged = JSON.stringify(sorted) !== JSON.stringify(this._activeProcesses);

                if (isChanged || !isSilent) {
                    this._activeProcesses = sorted;
                    const searchInput = document.getElementById('input-search-processes');
                    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
                    if (query) {
                        const filtered = this._activeProcesses.filter(p =>
                            (p.name && p.name.toLowerCase().includes(query)) ||
                            (p.title && p.title.toLowerCase().includes(query))
                        );
                        this.renderProcessRows(pcId, filtered);
                    } else {
                        this.renderProcessRows(pcId, this._activeProcesses);
                    }
                    this._setupSearchFilter(pcId);
                }
            } catch (err) {
                if (!isSilent) {
                    console.error('[DashboardProcessMonitor] Load initial processes error:', err);
                    if (container) {
                        container.innerHTML = `<div class="col-span-full py-12 text-center text-red-400 text-xs lg:text-sm font-mono">Gagal memuat: ${typeof escapeHtml === 'function' ? escapeHtml(err.message) : err.message}</div>`;
                    }
                    if (countEl) countEl.innerText = '0 PROSES';
                }
            } finally {
                if (!isSilent) restoreBtn();
            }
            return;
        }

        // Mode B: Tombol "Segarkan" diklik atau Menunggu hasil Kill (On-demand ke Client PC + Polling)
        if (countEl) countEl.innerText = 'MEMINTA...';
        setBtnLoading('Menyegarkan...');

        let initialTs = this._lastUpdatedTsMap[pcId] || 0;

        try {
            // Jika belum tahu initial timestamp, cek dulu status saat ini
            if (initialTs === 0) {
                try {
                    const initRes = await API.request(`/api/v1/kasir/monitor/processes/${pcId}`);
                    if (initRes && initRes.success && initRes.last_updated_ts) {
                        initialTs = initRes.last_updated_ts;
                        this._lastUpdatedTsMap[pcId] = initialTs;
                    }
                } catch (_) {}
            }

            if (!skipTrigger) {
                // Kirim trigger refresh processes ke PC client
                const triggerRes = await API.request(`/api/v1/kasir/monitor/processes/${pcId}/trigger`, {
                    method: 'POST'
                });

                if (!triggerRes.success) {
                    throw new Error(triggerRes.error || 'Gagal mengirim permintaan refresh proses');
                }

                Toast.success('Permintaan proses dikirim ke PC client!');
            }
            if (countEl) countEl.innerText = 'MENUNGGU...';

            let attempts = 0;
            const maxAttempts = 15; // 15 attempts * 1.5 detik = 22.5 detik

            this._refreshIntervals[pcId] = setInterval(async () => {
                attempts++;
                try {
                    const pollRes = await API.request(`/api/v1/kasir/monitor/processes/${pcId}`);
                    if (pollRes && pollRes.success) {
                        const currentTs = pollRes.last_updated_ts || 0;
                        const isUpdated = initialTs > 0 ? (currentTs > initialTs) : (currentTs > 0);

                        if (isUpdated) {
                            clearInterval(this._refreshIntervals[pcId]);
                            delete this._refreshIntervals[pcId];

                            this._lastUpdatedTsMap[pcId] = currentTs;
                            this._activeProcesses = this._sortProcesses(pollRes.data || []);
                            this.renderProcessRows(pcId, this._activeProcesses);
                            this._setupSearchFilter(pcId);

                            Toast.success('Daftar proses PC berhasil diperbarui!');
                            restoreBtn();
                            return;
                        }
                    }
                } catch (err) {
                    console.error('[DashboardProcessMonitor] Error polling processes:', err);
                }

                if (attempts >= maxAttempts) {
                    clearInterval(this._refreshIntervals[pcId]);
                    delete this._refreshIntervals[pcId];

                    try {
                        const fallbackRes = await API.request(`/api/v1/kasir/monitor/processes/${pcId}`);
                        if (fallbackRes && fallbackRes.success) {
                            this._activeProcesses = this._sortProcesses(fallbackRes.data || []);
                            this.renderProcessRows(pcId, this._activeProcesses);
                            this._setupSearchFilter(pcId);
                        }
                    } catch (_) {}

                    Toast.info('Batas waktu habis: Memuat data proses terakhir dari server.');
                    restoreBtn();
                }
            }, 1500);

        } catch (err) {
            console.error('[DashboardProcessMonitor] Refresh processes trigger error:', err);
            Toast.error(err.message || 'Gagal mengirim permintaan refresh proses');
            restoreBtn();
            if (countEl) countEl.innerText = '0 PROSES';
            try {
                const fallbackRes = await API.request(`/api/v1/kasir/monitor/processes/${pcId}`);
                if (fallbackRes && fallbackRes.success) {
                    this._activeProcesses = this._sortProcesses(fallbackRes.data || []);
                    this.renderProcessRows(pcId, this._activeProcesses);
                    this._setupSearchFilter(pcId);
                }
            } catch (_) {}
        }
    },

    async killProcess(pcId, name) {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200';
        overlay.innerHTML = `
            <div class="bg-[#111] border border-[#2a2a2a] rounded-xl w-full max-w-sm flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                <div class="p-6 text-center">
                    <div class="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                    </div>
                    <p class="text-xs lg:text-base text-neutral-200 font-bold uppercase tracking-wider mb-2">Akhiri Proses?</p>
                    <p class="text-[10px] lg:text-sm text-neutral-500">Apakah Anda yakin ingin menghentikan paksa proses <strong class="text-red-400 font-mono">${name}</strong> di PC client?</p>
                </div>
                <div class="p-4 border-t border-[#2a2a2a] flex items-center justify-end gap-3 bg-[#0a0a0a]">
                    <button id="btn-cancel-kill" class="px-4 py-2 text-xs lg:text-sm font-bold text-neutral-400 hover:text-white transition-colors">Batal</button>
                    <button id="btn-confirm-kill" class="px-4 py-2 bg-red-950/80 hover:bg-red-900 border border-red-800 hover:border-red-700 text-red-200 text-xs lg:text-sm font-bold rounded-lg transition-all uppercase tracking-wider">Ya, Akhiri</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const closeConfirm = () => {
            overlay.classList.add('fade-out');
            setTimeout(() => overlay.remove(), 200);
        };

        document.getElementById('btn-cancel-kill').onclick = closeConfirm;
        document.getElementById('btn-confirm-kill').onclick = async () => {
            closeConfirm();
            try {
                const json = await window.API.monitor.processesKill(pcId, name);
                if (!json.success) throw new Error(json.error);
                Toast.success(`Perintah mengakhiri '${name}' berhasil dikirim!`);
                this.loadProcesses(pcId, true, true);
            } catch (err) {
                console.error('[DashboardProcessMonitor] Kill process error:', err);
                Toast.error(err.message || 'Gagal mengirim perintah kill process');
            }
        };
    }
};
