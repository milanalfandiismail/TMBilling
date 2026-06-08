// app/static/js/kasir/modules/pc/pc_grid.js

const PCGrid = {
    render(groupedData, meta = {}) {
        const container = document.getElementById('pc-table');
        if (!container) return;

        const groups = Object.keys(groupedData);
        if (groups.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-neutral-500 bg-[#0c0c0c] border border-dashed border-[#1c1c1c] rounded">
                    <svg class="w-12 h-12 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                    <p class="text-xs font-bold uppercase tracking-wider">Belum Ada Unit PC</p>
                </div>`;
            return;
        }

        let html = '';
        groups.forEach(grupKey => {
            const pcs = groupedData[grupKey] || [];
            if (pcs.length === 0) return;

            html += `
                <div class="mb-8 last:mb-0">
                    <div class="flex items-center gap-3 mb-4 pb-3 border-b border-[#1c1c1c]">
                        <h4 class="text-xs font-bold text-neutral-500 uppercase tracking-wider">${grupKey.toUpperCase()}</h4>
                        <span class="text-[10px] text-neutral-400 bg-[#171717] border border-[#262626] px-2 py-0.5 rounded font-bold">${pcs.length} UNIT</span>
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        ${pcs.map(pc => {
                            const pcGrupNama = (pc.grup || 'reguler').toLowerCase();
                            return `
                                <div class="bg-[#0c0c0c] border ${pc.aktif ? 'border-[#262626]' : 'border-[#1c1c1c] opacity-50'} rounded p-3 transition-colors hover:bg-[#121212] relative group">
                                    <div class="flex items-center justify-between mb-1.5">
                                        <span class="font-bold text-xs text-neutral-200">${pc.kode}</span>
                                        <span class="w-1.5 h-1.5 rounded-full ${pc.aktif ? 'bg-neutral-100' : 'bg-neutral-600'}"></span>
                                    </div>
                                    <div class="text-[9px] text-neutral-500 font-mono mb-2">${pc.ip_address || '-'}</div>
                                    <span class="text-[9px] text-neutral-400 bg-[#171717] border border-[#262626] px-1.5 py-0.5 rounded font-bold">${pcGrupNama.toUpperCase()}</span>
                                    <div class="absolute inset-0 bg-[#0c0c0c]/95 rounded flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onclick="PC.edit(${pc.id})" class="w-8 h-8 rounded bg-[#171717] border border-[#262626] text-neutral-300 hover:bg-neutral-100 hover:text-black transition-colors">
                                            <svg class="w-3.5 h-3.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                        </button>
                                        <button onclick="PC.delete(${pc.id})" class="w-8 h-8 rounded bg-[#171717] border border-[#262626] text-red-400 hover:bg-red-600 hover:text-white transition-colors">
                                            <svg class="w-3.5 h-3.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        </button>
                                    </div>
                                </div>`;
                        }).join('')}
                    </div>
                </div>`;
        });

        container.innerHTML = html;
    }
};

window.PCGrid = PCGrid;
