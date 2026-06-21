const Log = {
    currentCategory: 'Semua',

    async load(filter = '', kategori = '') {
        try {
            const data = await API.report.logs(filter, 500, kategori);
            this.render(data.logs);
        } catch (err) {
            Toast.error('Gagal memuat log');
        }
    },

    switchCategory(category, btnEl) {
        this.currentCategory = category;
        const cats = ['Semua', 'sistem', 'transaksi', 'sesi', 'blackout'];
        cats.forEach(c => {
            const el = document.getElementById(`log-cat-${c}`);
            if (el) {
                if (c === category) {
                    el.className = 'px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap bg-neutral-100 text-black';
                } else {
                    el.className = 'px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap bg-transparent text-neutral-400 hover:text-neutral-200';
                }
            }
        });
        this.filter();
    },
    
    render(logs) {
        const container = document.getElementById('log-content');
        if (!logs.length) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-16 text-neutral-500">
                    <p class="text-xs lg:text-base font-bold uppercase tracking-wider">Tidak ada log</p>
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
                return `<div class="border-b border-[#1c1c1c] py-3 px-4 text-xs lg:text-base text-neutral-500 font-mono">${Utils.escapeHtml(log.raw)}</div>`;
            }

            let detailJsonHtml = '';
            if (log.detail_json) {
                try {
                    const jsonStr = typeof log.detail_json === 'string' ? log.detail_json : JSON.stringify(log.detail_json, null, 2);
                    detailJsonHtml = `<div class="mt-2 p-2 bg-[#0c0c0c] border border-[#1c1c1c] rounded text-[10px] lg:text-sm text-neutral-400 font-mono whitespace-pre overflow-x-auto">${Utils.escapeHtml(jsonStr)}</div>`;
                } catch (e) {
                    // Ignore
                }
            }

            return `
                <div class="border-b border-[#1c1c1c]/50 py-3 px-4 hover:bg-[#121212] transition-colors ${idx % 2 === 0 ? 'bg-[#0a0a0a]' : ''}">
                    <div class="flex items-center justify-between text-[10px] lg:text-base mb-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-neutral-600 font-mono">#${String(idx + 1).padStart(3, '0')}</span>
                            <span class="text-neutral-500 font-mono">${log.timestamp}</span>
                            <span class="px-2 py-0.5 rounded text-[10px] lg:text-base font-mono text-neutral-300 bg-[#171717] border border-[#262626]" title="Operator">${Utils.escapeHtml(log.user)}</span>
                            ${log.ip_address && log.ip_address !== '-' ? `<span class="px-2 py-0.5 rounded text-[10px] lg:text-base font-mono text-sky-400 bg-[#0c2a3b] border-transparent" title="IP Address">${Utils.escapeHtml(log.ip_address)}</span>` : ''}
                        </div>
                        <span class="px-2 py-0.5 rounded text-[10px] lg:text-base font-medium border ${catColor}">${log.category}</span>
                    </div>
                    <div class="text-xs lg:text-base mb-1">
                        <span class="font-bold text-neutral-200">${Utils.escapeHtml(log.action)}</span>
                        <span class="text-neutral-500 ml-2 font-mono">${Utils.escapeHtml(log.detail)}</span>
                    </div>
                    ${log.browser_agent && log.browser_agent !== '-' ? `<div class="text-[10px] lg:text-xs text-neutral-600 truncate" title="${Utils.escapeHtml(log.browser_agent)}">${Utils.escapeHtml(log.browser_agent)}</div>` : ''}
                    ${detailJsonHtml}
                </div>`;
        }).join('');
    },
    
    filter() {
        const filterStr = document.getElementById('filter-log').value.trim();
        const filterCat = this.currentCategory === 'Semua' ? '' : this.currentCategory;
        this.load(filterStr, filterCat);
    },
    
    async clear() {
        const message = '<div class="text-center"><p class="text-xs lg:text-base text-neutral-400 font-bold uppercase tracking-wider">Hapus semua log?</p><p class="text-[10px] lg:text-base text-neutral-500 mt-1">Tindakan ini bersifat permanen.</p></div>';
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
    },

    exportPDF() {
        const filter = document.getElementById('filter-log').value.trim();
        let url = '/api/v1/kasir/report/export/audit-pdf';
        if (filter) url += `?filter=${encodeURIComponent(filter)}`;
        window.open(url, '_blank');
    }
};

window.Log = Log;
