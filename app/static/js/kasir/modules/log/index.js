const LogFormatter = {
    normalize(detailJson) {
        if (!detailJson) return null;
        if (typeof detailJson === 'string') {
            try {
                return JSON.parse(detailJson);
            } catch (e) {
                return detailJson;
            }
        }
        return detailJson;
    },

    formatCurrency(val) {
        if (typeof val === 'number') {
            return 'Rp ' + val.toLocaleString('id-ID');
        }
        return val;
    },

    formatKey(key) {
        if (!key) return '';
        let result = key.replace(/_/g, ' ');
        result = result.replace(/([A-Z])/g, ' $1');
        result = result.trim();
        return result.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    },

    formatValue(key, val) {
        if (val === null || val === undefined) return '-';
        const keyLower = key.toLowerCase();
        if (keyLower.includes('jumlah') || keyLower.includes('harga') || keyLower.includes('amount') || keyLower.includes('modal') || keyLower.includes('total') || keyLower.includes('saldo')) {
            return this.formatCurrency(val);
        }
        if (keyLower.includes('durasi') || keyLower.includes('menit')) {
            if (typeof val === 'number') {
                return val + ' Menit';
            }
        }
        return val;
    },

    formatRefund(data) {
        const title = "Detail Refund";
        let itemsHtml = '';
        const order = [
            { key: 'no_nota_refund', label: 'No. Nota Refund' },
            { key: 'no_nota_original', label: 'No. Nota Asal' },
            { key: 'jumlah_refund', label: 'Jumlah Refund' },
            { key: 'saldo_sebelum', label: 'Saldo/Durasi Sebelum' },
            { key: 'saldo_sesudah', label: 'Saldo/Durasi Sesudah' },
            { key: 'durasi_beli_sebelum', label: 'Durasi Sebelum' },
            { key: 'durasi_beli_sesudah', label: 'Durasi Sesudah' },
            { key: 'durasi_dikurangi', label: 'Durasi Dikurangi' },
            { key: 'username', label: 'Username Member' },
            { key: 'nama_guest', label: 'Nama Guest' }
        ];

        order.forEach(item => {
            if (data[item.key] !== undefined && data[item.key] !== null) {
                const val = this.formatValue(item.key, data[item.key]);
                itemsHtml += `
                    <div class="flex justify-between items-center py-1 border-b border-[#1c1c1c]/50 text-[10px] lg:text-xs">
                        <span class="text-neutral-500 font-semibold uppercase tracking-wider">${item.label}</span>
                        <span class="text-neutral-200 font-mono font-bold">${val}</span>
                    </div>`;
            }
        });

        Object.keys(data).forEach(k => {
            if (!order.some(item => item.key === k)) {
                const label = this.formatKey(k);
                const val = this.formatValue(k, data[k]);
                itemsHtml += `
                    <div class="flex justify-between items-center py-1 border-b border-[#1c1c1c]/50 text-[10px] lg:text-xs">
                        <span class="text-neutral-500 font-semibold uppercase tracking-wider">${label}</span>
                        <span class="text-neutral-200 font-mono font-bold">${val}</span>
                    </div>`;
            }
        });

        return `
            <div class="mt-2 p-3 bg-[#0c0c0c] border border-red-500/20 rounded max-w-lg space-y-2">
                <div class="text-[10px] lg:text-xs font-black uppercase text-red-400 tracking-wider flex items-center gap-1.5">
                    <span>🔄</span> ${title}
                </div>
                <div class="space-y-1.5">${itemsHtml}</div>
            </div>`;
    },

    formatDeleteStruk(data) {
        const title = "Detail Penghapusan Struk";
        let itemsHtml = '';
        const order = [
            { key: 'no_nota', label: 'No. Nota' },
            { key: 'jenis', label: 'Jenis Transaksi' },
            { key: 'jumlah', label: 'Jumlah / Nominal' },
            { key: 'tanggal', label: 'Tanggal Transaksi' },
            { key: 'keterangan', label: 'Keterangan' }
        ];

        order.forEach(item => {
            if (data[item.key] !== undefined && data[item.key] !== null) {
                const val = this.formatValue(item.key, data[item.key]);
                itemsHtml += `
                    <div class="flex justify-between items-center py-1 border-b border-[#1c1c1c]/50 text-[10px] lg:text-xs">
                        <span class="text-neutral-500 font-semibold uppercase tracking-wider">${item.label}</span>
                        <span class="text-neutral-200 font-mono font-bold">${val}</span>
                    </div>`;
            }
        });

        Object.keys(data).forEach(k => {
            if (!order.some(item => item.key === k)) {
                const label = this.formatKey(k);
                const val = this.formatValue(k, data[k]);
                itemsHtml += `
                    <div class="flex justify-between items-center py-1 border-b border-[#1c1c1c]/50 text-[10px] lg:text-xs">
                        <span class="text-neutral-500 font-semibold uppercase tracking-wider">${label}</span>
                        <span class="text-neutral-200 font-mono">${val}</span>
                    </div>`;
            }
        });

        return `
            <div class="mt-2 p-3 bg-[#0c0c0c] border border-amber-500/20 rounded max-w-lg space-y-2">
                <div class="text-[10px] lg:text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                    <span>🗑️</span> ${title}
                </div>
                <div class="space-y-1.5">${itemsHtml}</div>
            </div>`;
    },

    formatEditPaket(data) {
        const title = "Perubahan Detail Paket";
        let itemsHtml = '';

        Object.keys(data).forEach(k => {
            const label = this.formatKey(k);
            const valObj = data[k];
            if (valObj && typeof valObj === 'object' && 'old' in valObj && 'new' in valObj) {
                const oldVal = this.formatValue(k, valObj.old);
                const newVal = this.formatValue(k, valObj.new);
                itemsHtml += `
                    <div class="flex justify-between items-center py-1 border-b border-[#1c1c1c]/50 text-[10px] lg:text-xs gap-4">
                        <span class="text-neutral-500 font-semibold uppercase tracking-wider">${label}</span>
                        <span class="text-neutral-200 font-mono font-bold">
                            <span class="text-neutral-500 line-through">${oldVal}</span> 
                            <span class="text-neutral-400 mx-1">➔</span> 
                            <span class="text-green-400">${newVal}</span>
                        </span>
                    </div>`;
            } else {
                const val = this.formatValue(k, valObj);
                itemsHtml += `
                    <div class="flex justify-between items-center py-1 border-b border-[#1c1c1c]/50 text-[10px] lg:text-xs">
                        <span class="text-neutral-500 font-semibold uppercase tracking-wider">${label}</span>
                        <span class="text-neutral-200 font-mono">${val}</span>
                    </div>`;
            }
        });

        return `
            <div class="mt-2 p-3 bg-[#0c0c0c] border border-blue-500/20 rounded max-w-lg space-y-2">
                <div class="text-[10px] lg:text-xs font-black uppercase text-blue-400 tracking-wider flex items-center gap-1.5">
                    <span>📝</span> ${title}
                </div>
                <div class="space-y-1.5">${itemsHtml}</div>
            </div>`;
    },

    formatGenericObject(obj, depth = 0) {
        if (!obj || Object.keys(obj).length === 0) return '';
        let itemsHtml = '';
        
        Object.keys(obj).forEach(k => {
            const label = this.formatKey(k);
            const val = obj[k];
            
            if (val && typeof val === 'object' && !Array.isArray(val)) {
                itemsHtml += `
                    <div class="py-1 border-b border-[#1c1c1c]/30 text-[10px] lg:text-xs">
                        <div class="text-neutral-500 font-semibold uppercase tracking-wider mb-1">${label}</div>
                        <div class="border-l-2 border-[#1c1c1c] pl-3 py-1 mt-1 space-y-1">
                            ${this.formatGenericObject(val, depth + 1)}
                        </div>
                    </div>`;
            } else if (Array.isArray(val)) {
                itemsHtml += `
                    <div class="py-1 border-b border-[#1c1c1c]/30 text-[10px] lg:text-xs">
                        <div class="text-neutral-500 font-semibold uppercase tracking-wider mb-1">${label}</div>
                        <div class="pl-3 py-1">
                            ${this.formatGenericArray(val, depth + 1)}
                        </div>
                    </div>`;
            } else {
                const formattedVal = this.formatValue(k, val);
                itemsHtml += `
                    <div class="flex justify-between items-center py-1 border-b border-[#1c1c1c]/30 text-[10px] lg:text-xs">
                        <span class="text-neutral-500 font-semibold uppercase tracking-wider">${label}</span>
                        <span class="text-neutral-200 font-mono">${formattedVal}</span>
                    </div>`;
            }
        });
        
        return itemsHtml;
    },

    formatGenericArray(arr, depth = 0) {
        if (!arr || arr.length === 0) return '';
        let itemsHtml = '';
        arr.forEach((item, idx) => {
            if (item && typeof item === 'object') {
                itemsHtml += `
                    <div class="p-2 bg-[#0c0c0c] border border-[#1c1c1c] rounded text-[10px] lg:text-xs space-y-1 my-1">
                        <div class="text-neutral-500 font-mono">Item #${idx + 1}</div>
                        ${this.formatGenericObject(item, depth + 1)}
                    </div>`;
            } else {
                itemsHtml += `<span class="inline-block px-2 py-0.5 bg-[#171717] border border-[#262626] rounded text-neutral-300 font-mono text-[10px] mr-1 mb-1">${item}</span>`;
            }
        });
        return `<div class="flex flex-wrap">${itemsHtml}</div>`;
    },

    resolveTheme(action) {
        const act = (action || '').toUpperCase();
        
        // 1. Refund
        if (act.includes('REFUND')) 
            return { icon: '🔄', title: 'Detail Refund', border: 'border-red-500/20', text: 'text-red-400' };
        
        // 2. Blackout / Mati Lampu
        if (act.includes('BLACKOUT')) 
            return { icon: '⚡', title: 'Insiden Blackout (Mati Lampu)', border: 'border-amber-500/30', text: 'text-amber-400' };

        // 3. Sesi & Billing
        if (act.startsWith('BUKA_') || act.includes('TUTUP_SESI') || act === 'PINDAH_PC' || act === 'TAMBAH_WAKTU') 
            return { icon: '🎮', title: 'Detail Sesi & Billing', border: 'border-emerald-500/20', text: 'text-emerald-400' };
        
        // 4. Kantin & POS F&B
        if (act === 'TRANSAKSI_MENU' || act.includes('MENU')) 
            return { icon: '🍔', title: 'Detail Kantin & POS', border: 'border-amber-500/20', text: 'text-amber-400' };
        
        // 5. Member
        if (act.includes('MEMBER')) 
            return { icon: '👤', title: 'Detail Member', border: 'border-purple-500/20', text: 'text-purple-400' };
        
        // 6. Shift Kasir
        if (act.startsWith('SHIFT_')) 
            return { icon: '💵', title: 'Detail Shift Kasir', border: 'border-cyan-500/20', text: 'text-cyan-400' };
        
        // 7. Paket Billing
        if (act.includes('PAKET')) 
            return { icon: '💳', title: 'Detail Paket Billing', border: 'border-blue-500/20', text: 'text-blue-400' };
        
        // 8. Unit PC / Zona
        if (act.includes('PC') || act.includes('GRUP') || act.includes('BATCH_') || act.includes('WOL_')) 
            return { icon: '🖥️', title: 'Detail Unit PC / Zona', border: 'border-indigo-500/20', text: 'text-indigo-400' };
        
        // 9. Akun & Keamanan (Auth, Whitelist)
        if (act.includes('USER') || act.includes('LOGIN') || act.includes('LOGOUT') || act.includes('IP_WHITELIST')) 
            return { icon: '🔑', title: 'Detail Akun & Keamanan', border: 'border-neutral-500/20', text: 'text-neutral-300' };
        
        // 10. Perawatan & Tiket PC
        if (act.includes('TIKET') || act.includes('MAINTENANCE')) 
            return { icon: '🛠️', title: 'Detail Perawatan PC', border: 'border-orange-500/20', text: 'text-orange-400' };
        
        // 11. Pembersihan Log, Hapus Struk & Riwayat
        if (act.includes('CLEAR_') || act.includes('DELETE_STRUK') || act.includes('CLEANUP')) 
            return { icon: '🧹', title: 'Pembersihan Log & Riwayat', border: 'border-rose-500/20', text: 'text-rose-400' };

        // 12. Sistem, Backup, Scheduler & Settings
        if (act.includes('SETTINGS') || act.includes('BACKUP') || act.includes('MIGRATION') || act.includes('SCHEDULER') || act.includes('DB_') || act.includes('UPDATE')) 
            return { icon: '⚙️', title: 'Sistem & Konfigurasi', border: 'border-sky-500/20', text: 'text-sky-400' };
        
        return { icon: '📄', title: 'Detail Data', border: 'border-[#1c1c1c]', text: 'text-neutral-400' };
    },

    renderRawToggle(rawStr) {
        const uniqId = 'raw-json-' + Math.random().toString(36).substring(2, 9);
        return `
            <div class="mt-2 text-[10px] lg:text-xs">
                <button onclick="document.getElementById('${uniqId}').classList.toggle('hidden')" class="text-neutral-600 hover:text-neutral-400 font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors">
                    <span>⚙️</span> Lihat Data Mentah (Raw)
                </button>
                <div id="${uniqId}" class="hidden mt-2 p-2 bg-[#050505] border border-[#1c1c1c] rounded text-[10px] lg:text-sm text-neutral-400 font-mono whitespace-pre overflow-x-auto">${Utils.escapeHtml(rawStr)}</div>
            </div>`;
    },

    format(detailJson, action, detail) {
        const data = this.normalize(detailJson);
        if (!data) return '';

        let formattedHtml = '';
        const actUpper = (action || '').toUpperCase();

        if (actUpper.includes('REFUND')) {
            formattedHtml = this.formatRefund(data);
        } else if (actUpper.includes('DELETE_STRUK')) {
            formattedHtml = this.formatDeleteStruk(data);
        } else if (actUpper.includes('EDIT_PAKET')) {
            formattedHtml = this.formatEditPaket(data);
        } else if (typeof data === 'object') {
            const theme = this.resolveTheme(action);
            const headerHtml = `
                <div class="text-[10px] lg:text-xs font-black uppercase ${theme.text} tracking-wider flex items-center gap-1.5 mb-2">
                    <span>${theme.icon}</span> ${theme.title}
                </div>`;

            if (Array.isArray(data)) {
                formattedHtml = `
                    <div class="mt-2 p-3 bg-[#0c0c0c] border ${theme.border} rounded max-w-lg space-y-1">
                        ${headerHtml}
                        ${this.formatGenericArray(data)}
                    </div>`;
            } else {
                formattedHtml = `
                    <div class="mt-2 p-3 bg-[#0c0c0c] border ${theme.border} rounded max-w-lg space-y-1">
                        ${headerHtml}
                        ${this.formatGenericObject(data)}
                    </div>`;
            }
        } else {
            formattedHtml = `<div class="mt-2 text-[10px] lg:text-xs text-neutral-400 font-mono">${Utils.escapeHtml(String(data))}</div>`;
        }

        const rawStr = typeof detailJson === 'string' ? detailJson : JSON.stringify(detailJson, null, 2);
        return formattedHtml + this.renderRawToggle(rawStr);
    }
};

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
                    detailJsonHtml = LogFormatter.format(log.detail_json, log.action, log.detail);
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
        const modalHtml = `
            <div class="text-left space-y-3">
                <div class="text-center">
                    <p class="text-xs lg:text-base text-neutral-200 font-bold uppercase tracking-wider">Bersihkan Semua Audit Log?</p>
                    <p class="text-[11px] lg:text-xs text-neutral-400 mt-1">Tindakan ini akan mengosongkan riwayat log aktif di dashboard.</p>
                </div>
                <div class="p-3 bg-[#0c0c0c] border border-[#1c1c1c] rounded text-xs space-y-2">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" id="chk-auto-archive" checked class="rounded border-neutral-700 bg-neutral-900 text-blue-500 focus:ring-0">
                        <span class="text-neutral-300 font-medium">Buat file arsip otomatis (.jsonl.gz)</span>
                    </label>
                    <p class="text-[10px] text-neutral-500 pl-5">File arsip disimpan di folder <code class="text-neutral-400">logs/archives/</code> untuk audit trail masa depan.</p>
                </div>
            </div>`;

        Modal.confirm(modalHtml, async () => {
            const archive = document.getElementById('chk-auto-archive') ? document.getElementById('chk-auto-archive').checked : true;
            try {
                const res = await API.report.clearLogs(archive);
                Toast.success(res.message || 'Log berhasil dibersihkan');
                this.load();
            } catch (err) {
                Toast.error(err.message || 'Gagal membersihkan log');
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
