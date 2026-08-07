// app/static/js/kasir/modules/dashboard/dashboard_process_monitor.js

/**
 * Modul Monitoring Proses Windows Client pada Dashboard Kasir.
 * Menangani penayangan tabel proses, pencarian proses, dan penghentian paksa (kill process).
 */

const DashboardProcessMonitor = {
    _activeProcesses: [],

    showProcesses(currentPcId) {
        document.getElementById('view-action-menu')?.classList.add('hidden');
        document.getElementById('view-process-list')?.classList.remove('hidden');
        const card = document.getElementById('pc-detail-modal-card');
        if (card) {
            card.classList.remove('max-w-lg');
            card.classList.add('max-w-4xl');
        }
        this.loadProcesses(currentPcId);
    },

    backToMenu() {
        document.getElementById('view-action-menu')?.classList.remove('hidden');
        document.getElementById('view-process-list')?.classList.add('hidden');
        const card = document.getElementById('pc-detail-modal-card');
        if (card) {
            card.classList.remove('max-w-4xl');
            card.classList.add('max-w-lg');
        }
    },

    renderProcessRows(pcId, processes) {
        const container = document.getElementById('modal-process-list');
        const countEl = document.getElementById('modal-pc-count');
        if (!container || !countEl) return;

        countEl.innerText = `${processes.length} PROSES`;

        if (processes.length === 0) {
            container.innerHTML = '<tr><td colspan="2" class="px-6 py-10 text-center text-neutral-500 text-xs lg:text-base font-mono">Tidak ada proses</td></tr>';
            return;
        }

        container.innerHTML = processes.map(p => `
            <tr class="hover:bg-[#121212] transition-colors">
                <td class="px-6 py-2.5 text-xs lg:text-base text-neutral-200 font-mono">
                    <div class="font-bold text-neutral-100">${p.name}</div>
                    <div class="text-[10px] lg:text-xs text-neutral-500 mt-0.5">${p.title || '-'}</div>
                </td>
                <td class="px-6 py-2.5 text-right whitespace-nowrap">
                    <button onclick="DashboardProcessMonitor.killProcess(${pcId}, '${p.name}')" class="px-3 py-1 bg-red-950/40 hover:bg-red-900 border border-red-800/40 hover:border-red-700 text-red-400 hover:text-red-200 text-xs font-bold rounded-lg transition-all font-mono uppercase tracking-wider">
                        Akhiri
                    </button>
                </td>
            </tr>
        `).join('');
    },

    async loadProcesses(pcId) {
        const container = document.getElementById('modal-process-list');
        if (container) container.innerHTML = '<tr><td colspan="2" class="px-6 py-10 text-center text-neutral-500 text-xs lg:text-base font-mono">Memuat...</td></tr>';

        try {
            const res = await fetch(`/api/v1/public/monitor/processes/${pcId}`);
            const json = await res.json();

            if (!json.success) throw new Error(json.error);

            let data = json.data || [];

            data.sort((a, b) => {
                const getMem = str => {
                    if (!str) return 0;
                    const match = str.match(/Mem:\s*(\d+)\s*MB/i);
                    return match ? parseInt(match[1], 10) : 0;
                };
                return getMem(b.title) - getMem(a.title);
            });

            this._activeProcesses = data;
            this.renderProcessRows(pcId, this._activeProcesses);

            const searchInput = document.getElementById('input-search-processes');
            if (searchInput) {
                searchInput.value = '';
                searchInput.oninput = (e) => {
                    const query = e.target.value.toLowerCase().trim();
                    const filtered = this._activeProcesses.filter(p =>
                        (p.name && p.name.toLowerCase().includes(query)) ||
                        (p.title && p.title.toLowerCase().includes(query))
                    );
                    this.renderProcessRows(pcId, filtered);
                };
            }
        } catch (err) {
            if (container) container.innerHTML = `<tr><td colspan="2" class="px-6 py-10 text-center text-red-400 text-xs lg:text-base font-mono">Gagal: ${err.message}</td></tr>`;
        }
    },

    async killProcess(pcId, name) {
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
                this.loadProcesses(pcId);
            } catch (err) {
                console.error('[DashboardProcessMonitor] Kill process error:', err);
                Toast.error(err.message || 'Gagal mengirim perintah kill process');
            }
        };
    }
};
