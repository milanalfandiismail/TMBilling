const Log = {
    async load(filter = '', kategori = '') {
        try {
            const data = await API.report.logs(filter, 500, kategori);
            this.render(data.logs);
        } catch (err) {
            Toast.error('Gagal memuat log');
        }
    },
    
    render(logs) {
        const container = document.getElementById('log-content');
        if (!logs.length) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-16 text-neutral-500">
                    <p class="text-xs font-bold uppercase tracking-wider">Tidak ada log</p>
                </div>`;
            return;
        }
        
        container.innerHTML = logs.map((log, idx) => {
            let catColor = 'text-neutral-400 bg-[#0c0c0c] border-[#1c1c1c]';
            if (log.category === 'transaksi') catColor = 'text-neutral-200 bg-[#171717] border-neutral-700';
            else if (log.category === 'sesi') catColor = 'text-neutral-300 bg-[#0f0f0f] border-neutral-800';
            else if (log.category === 'blackout') catColor = 'text-red-400 bg-[#2d1215] border-red-900/30';
            else if (log.category === 'sistem') catColor = 'text-neutral-400 bg-[#111111] border-neutral-800';

            if (log.category === "unknown") {
                return `<div class="border-b border-[#1c1c1c] py-3 px-4 text-xs text-neutral-500 font-mono">${Utils.escapeHtml(log.raw)}</div>`;
            }

            return `
                <div class="border-b border-[#1c1c1c]/50 py-3 px-4 hover:bg-[#121212] transition-colors ${idx % 2 === 0 ? 'bg-[#0a0a0a]' : ''}">
                    <div class="flex items-center justify-between text-[10px] mb-1">
                        <div class="flex items-center gap-2">
                            <span class="text-neutral-600 font-mono">#${String(idx + 1).padStart(3, '0')}</span>
                            <span class="text-neutral-500 font-mono">${log.timestamp}</span>
                            <span class="px-2 py-0.5 rounded text-[10px] font-mono text-neutral-300 bg-[#171717] border border-[#262626]">${Utils.escapeHtml(log.user)}</span>
                        </div>
                        <span class="px-2 py-0.5 rounded text-[10px] font-medium border ${catColor}">${log.category}</span>
                    </div>
                    <div class="text-xs">
                        <span class="font-bold text-neutral-200">${Utils.escapeHtml(log.action)}</span>
                        <span class="text-neutral-500 ml-2 font-mono">${Utils.escapeHtml(log.detail)}</span>
                    </div>
                </div>`;
        }).join('');
    },
    
    filter() {
        const filterStr = document.getElementById('filter-log').value.trim();
        const filterCat = document.getElementById('filter-kategori-log').value;
        this.load(filterStr, filterCat);
    },
    
    async clear() {
        const message = '<div class="text-center"><p class="text-xs text-neutral-400 font-bold uppercase tracking-wider">Hapus semua log?</p><p class="text-[10px] text-neutral-500 mt-1">Tindakan ini bersifat permanen.</p></div>';
        Modal.confirm(message, async () => {
            try {
                await API.report.clearLogs();
                Toast.success('Log berhasil dibersihkan');
                this.load();
            } catch (err) {
                Toast.error(err.message);
            }
        });
    },
    
    exportLogs() {
        const filter = document.getElementById('filter-log').value.trim();
        window.open(API.report.exportLogsUrl(filter), '_blank');
    }
};

window.Log = Log;
