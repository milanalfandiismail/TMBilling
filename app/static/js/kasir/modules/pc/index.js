// app/static/js/kasir/modules/pc/index.js

const PC = {
    currentPage: 1,
    searchQuery: '',
    currentGrupId: '',

    resetFilters() {
        this.currentPage = 1;
        this.searchQuery = '';
        this.currentGrupId = '';
        const searchInput = document.getElementById('pc-search-input');
        if (searchInput) searchInput.value = '';
        const filterSelect = document.getElementById('pc-grup-filter-select');
        if (filterSelect) filterSelect.innerHTML = '<option value="">Semua Grup</option>';
    },

    async load() {
        const area = document.getElementById('pc-table');
        if (!area) return;
        area.innerHTML = '<div class="flex justify-center py-8"><div class="w-6 h-6 border-2 border-[#1c1c1c] border-t-neutral-100 rounded-full animate-spin"></div></div>';

        try {
            const [grupResponse, data] = await Promise.all([
                API.grup.list(),
                API.pc.list({
                    q: this.searchQuery || '',
                    grup_id: this.currentGrupId || ''
                })
            ]);

            const groups = grupResponse.grup || grupResponse.grup_list || [];
            const filterSelect = document.getElementById('pc-grup-filter-select');
            if (filterSelect) {
                filterSelect.innerHTML = '<option value="">Semua Grup</option>' + groups.map(g => `<option value="${g.id}" ${String(this.currentGrupId) === String(g.id) ? 'selected' : ''}>${g.nama.toUpperCase()}</option>`).join('');
            }

            const addSelect = document.getElementById('inp-pc-grup');
            if (addSelect) {
                addSelect.innerHTML = groups.map(g => `<option value="${g.nama}">${g.nama.toUpperCase()}</option>`).join('');
            }
            const batchSelect = document.getElementById('inp-batch-grup');
            if (batchSelect) {
                batchSelect.innerHTML = groups.map(g => `<option value="${g.nama}">${g.nama.toUpperCase()}</option>`).join('');
            }

            this.render(data.grouped || {}, data);
        } catch (err) {
            Toast.error('Gagal memuat daftar PC');
        }
    },

    doSearch() {
        this.searchQuery = document.getElementById('pc-search-input').value.trim();
        this.currentGrupId = document.getElementById('pc-grup-filter-select').value;
        this.currentPage = 1;
        this.load();
    },

    debouncedSearch: Utils.debounce(function() {
        PC.doSearch();
    }, 500),

    clearSearch() {
        document.getElementById('pc-search-input').value = '';
        document.getElementById('pc-grup-filter-select').value = '';
        this.searchQuery = '';
        this.currentGrupId = '';
        this.currentPage = 1;
        this.load();
    },

    changePage(page) {
        if (page < 1) return;
        this.currentPage = page;
        this.load();
    },

    updateAddPreview() {
        const prefixEl = document.getElementById('modal-pc-prefix');
        const numEl = document.getElementById('modal-pc-number');
        const prevEl = document.getElementById('modal-pc-preview');
        if (!prevEl) return;
        const prefix = (prefixEl?.value || '').trim().toUpperCase().replace(/[-_]+$/, '');
        let num = (numEl?.value || '1').trim();
        if (num.length > 4) {
            num = num.slice(0, 4);
            if (numEl) numEl.value = num;
        }
        const kode = prefix ? `${prefix}-${num}` : num;
        prevEl.textContent = kode || '-';
    },

    updateBatchPreview() {
        const prefixEl = document.getElementById('modal-batch-prefix');
        const startEl = document.getElementById('modal-batch-start');
        const endEl = document.getElementById('modal-batch-end');
        const ipStartEl = document.getElementById('modal-batch-ip-start');
        const ipEndEl = document.getElementById('modal-batch-ip-end');
        const prevEl = document.getElementById('modal-batch-preview');
        if (!prevEl) return;

        const prefix = (prefixEl?.value || '').trim().toUpperCase().replace(/[-_]+$/, '');
        let startVal = (startEl?.value || '').trim();
        let endVal = (endEl?.value || '').trim();
        if (startVal.length > 4) {
            startVal = startVal.slice(0, 4);
            if (startEl) startEl.value = startVal;
        }
        if (endVal.length > 4) {
            endVal = endVal.slice(0, 4);
            if (endEl) endEl.value = endVal;
        }
        const start = parseInt(startVal || '0');
        const end = parseInt(endVal || '0');

        if (isNaN(start) || isNaN(end) || start < 1 || end < 1) {
            prevEl.className = 'text-xs lg:text-sm xl:text-base font-black font-mono text-amber-400 bg-amber-950/40 px-3 py-1 rounded border border-amber-500/30 tracking-tight';
            prevEl.textContent = 'Nomor unit wajib diisi (1-9999)';
            return;
        }

        if (start > end) {
            prevEl.className = 'text-xs lg:text-sm xl:text-base font-black font-mono text-rose-400 bg-rose-950/40 px-3 py-1 rounded border border-rose-500/30 tracking-tight';
            prevEl.textContent = `Error: No Mulai (${start}) > No Akhir (${end})`;
            return;
        }

        const count = end - start + 1;
        const kStart = prefix ? `${prefix}-${start}` : `${start}`;
        const kEnd = prefix ? `${prefix}-${end}` : `${end}`;

        // Check IP Range count if filled
        const ipStart = (ipStartEl?.value || '').trim();
        const ipEnd = (ipEndEl?.value || '').trim();
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

        if (ipStart && ipEnd) {
            if (ipRegex.test(ipStart) && ipRegex.test(ipEnd)) {
                const ipToInt = (ip) => ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
                const ipStartInt = ipToInt(ipStart);
                const ipEndInt = ipToInt(ipEnd);
                if (ipStartInt > ipEndInt) {
                    prevEl.className = 'text-xs lg:text-sm xl:text-base font-black font-mono text-rose-400 bg-rose-950/40 px-3 py-1 rounded border border-rose-500/30 tracking-tight';
                    prevEl.textContent = `Error: IP Awal > IP Akhir`;
                    return;
                }
                const ipCount = ipEndInt - ipStartInt + 1;
                if (ipCount !== count) {
                    prevEl.className = 'text-xs lg:text-sm xl:text-base font-black font-mono text-amber-400 bg-amber-950/40 px-3 py-1 rounded border border-amber-500/30 tracking-tight';
                    prevEl.textContent = `${kStart} s/d ${kEnd} (${count} Unit) • IP ${ipCount} Slot`;
                    return;
                }
            }
        }

        prevEl.className = 'text-xs lg:text-sm xl:text-base font-black font-mono text-emerald-400 bg-emerald-950/40 px-3 py-1 rounded border border-emerald-500/30 tracking-tight';
        prevEl.textContent = `${kStart} s/d ${kEnd} (${count} Unit)`;
    },

    async add() {
        const prefixEl = document.getElementById('modal-pc-prefix');
        const numberEl = document.getElementById('modal-pc-number');
        let kode = '';

        if (prefixEl || numberEl) {
            const prefix = (prefixEl?.value || '').trim().toUpperCase().replace(/[-_]+$/, '');
            let number = (numberEl?.value || '').trim();
            if (!number) return Toast.error('Nomor Unit wajib diisi');
            if (number.length > 4) return Toast.error('Nomor Unit maksimal 4 digit (1-9999)');
            if (isNaN(parseInt(number)) || parseInt(number) < 1 || parseInt(number) > 9999) return Toast.error('Nomor Unit harus angka antara 1 sampai 9999');
            kode = prefix ? `${prefix}-${number}` : number;
        } else {
            const kodeInput = document.getElementById('modal-pc-kode') || document.getElementById('inp-pc-kode');
            kode = (kodeInput?.value || '').trim().toUpperCase();
        }

        const get = (modalId, legacyId) => {
            const m = document.getElementById(modalId);
            if (m) return m;
            return document.getElementById(legacyId);
        };
        const data = {
            kode: kode,
            nama: (get('modal-pc-nama', 'inp-pc-nama') || {}).value?.trim() || '',
            ip_address: (get('modal-pc-ip', 'inp-pc-ip') || {}).value?.trim() || '',
            mac_address: ((get('modal-pc-mac', 'inp-pc-mac') || {}).value?.trim() || '').toUpperCase(),
            grup: (get('modal-pc-grup', 'inp-pc-grup') || {}).value || ''
        };
        if (!data.kode) return Toast.error('Kode PC wajib diisi');
        if (data.kode.length > 11) return Toast.error('Kode PC maksimal 11 karakter');
        if (!/^[A-Za-z0-9\-_]+$/.test(data.kode)) return Toast.error('Kode PC hanya boleh huruf, angka, (-), dan (_)');
        try {
            await API.pc.create(data);
            Toast.success(`PC ${data.kode} berhasil ditambahkan`);
            Modal.closeModal();
            this.load();
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async edit(id) {
        try {
            const [pcResponse, grupResponse] = await Promise.all([
                API.pc.list(),
                API.grup.list()
            ]);
            const listPc = pcResponse.pc_list || [];
            const pc = listPc.find(p => p.id === id);
            if (!pc) return Toast.error('PC tidak ditemukan');
            const groups = grupResponse.grup || [];
            this.showEditModal(pc, groups);
        } catch (err) {
            Toast.error('Gagal mengambil data');
        }
    },

    async doEdit(id) {
        const data = {
            kode: document.getElementById('edit-pc-kode').value.trim().toUpperCase(),
            nama: document.getElementById('edit-pc-nama').value.trim(),
            ip_address: document.getElementById('edit-pc-ip').value.trim(),
            mac_address: document.getElementById('edit-pc-mac').value.trim().toUpperCase(),
            grup: document.getElementById('edit-pc-grup').value
        };
        if (!data.kode) return Toast.error('Kode PC wajib diisi');
        if (data.kode.length > 11) return Toast.error('Kode PC maksimal 11 karakter');
        if (!/^[A-Za-z0-9\-_]+$/.test(data.kode)) return Toast.error('Kode PC hanya boleh huruf, angka, (-), dan (_)');
        try {
            await API.pc.update(id, data);
            Toast.success('Data PC berhasil diperbarui');
            Modal.closeModal();
            this.load();
        } catch (err) {
            Toast.error(err.message);
        }
    },

    async delete(id) {
        const message = '<div class="text-center"><p class="text-xs lg:text-base text-neutral-300 font-semibold mb-1">Hapus PC ini secara permanen?</p><p class="text-[11px] lg:text-sm text-neutral-500">Seluruh data uptime log, hardware telemetry, proses, dan tiket perawatan unit ini akan dihapus bersih.</p></div>';
        Modal.confirm(message, async () => {
            try {
                const res = await API.pc.delete(id);
                Toast.success(res.message || 'PC berhasil dihapus');
                this.load();
            } catch (err) {
                Toast.error(err.message || 'Gagal menghapus PC');
            }
        });
    },

    async addBatch() {
        const get = (modalId, legacyId) => {
            const m = document.getElementById(modalId);
            if (m) return m;
            return document.getElementById(legacyId);
        };
        const rawPrefix = (get('modal-batch-prefix', 'inp-batch-prefix') || {}).value?.trim().toUpperCase() || 'PC';
        const cleanPrefix = rawPrefix.replace(/[-_]+$/, '');
        const data = {
            prefix: cleanPrefix,
            start_num: parseInt((get('modal-batch-start', 'inp-batch-start') || {}).value || '1'),
            end_num: parseInt((get('modal-batch-end', 'inp-batch-end') || {}).value || '10'),
            grup: (get('modal-batch-grup', 'inp-batch-grup') || {}).value || '',
            ip_start: (get('modal-batch-ip-start', 'inp-batch-ip-start') || {}).value?.trim() || '',
            ip_end: (get('modal-batch-ip-end', 'inp-batch-ip-end') || {}).value?.trim() || ''
        };
        if (data.prefix.length > 6) return Toast.error('Prefix Kode PC maksimal 6 karakter');
        if (data.prefix && !/^[A-Za-z0-9\-_]*$/.test(data.prefix)) return Toast.error('Prefix hanya boleh huruf, angka, (-), dan (_)');
        if (isNaN(data.start_num) || isNaN(data.end_num)) return Toast.error('Nomor urut tidak valid');
        if (data.start_num < 1 || data.end_num > 9999 || String(data.end_num).length > 4 || String(data.start_num).length > 4) {
            return Toast.error('Nomor unit harus antara 1 sampai 9999 (maks 4 digit)');
        }
        if (data.start_num > data.end_num) {
            return Toast.error(`Nomor awal (${data.start_num}) tidak boleh lebih besar dari nomor akhir (${data.end_num})`);
        }
        const maxExpectedKode = data.prefix ? `${data.prefix}-${data.end_num}` : `${data.end_num}`;
        if (maxExpectedKode.length > 11) return Toast.error('Kombinasi prefix dan nomor akhir melebihi 11 karakter');
        if (!data.ip_start || !data.ip_end) return Toast.error('IP Awal dan IP Akhir wajib diisi');

        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipRegex.test(data.ip_start)) return Toast.error('Format IP Address Awal tidak valid (contoh: 192.168.1.101)');
        if (!ipRegex.test(data.ip_end)) return Toast.error('Format IP Address Akhir tidak valid (contoh: 192.168.1.110)');

        const ipToInt = (ip) => ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
        const ipStartInt = ipToInt(data.ip_start);
        const ipEndInt = ipToInt(data.ip_end);

        if (ipStartInt > ipEndInt) {
            return Toast.error(`IP Address Awal (${data.ip_start}) tidak boleh lebih besar dari IP Address Akhir (${data.ip_end})`);
        }

        const ipCount = ipEndInt - ipStartInt + 1;
        const pcCount = data.end_num - data.start_num + 1;
        if (ipCount !== pcCount) {
            return Toast.error(`Rentang IP (${ipCount} IP) tidak sama dengan jumlah unit PC (${pcCount} Unit). Sesuaikan IP Address Akhir!`);
        }

        try {
            const result = await API.pc.batch(data);
            
            if (result.added > 0) {
                Toast.success(`${result.added} PC baru berhasil terdaftar`);
                Modal.closeModal();
            }
            
            if (result.errors && result.errors.length > 0) {
                const errorList = result.errors.map(err => `• ${err}`).join('<br>');
                Toast.error(`<strong>Registrasi Batch Bermasalah:</strong><br>${errorList}`);
            }
            
            this.load();
        } catch (err) {
            Toast.error(err.message);
        }
    },

    clearForm() {
        ['inp-pc-kode', 'inp-pc-nama', 'inp-pc-ip', 'inp-pc-mac'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    },

    clearBatchForm() {
        const els = {
            'inp-batch-prefix': 'PC',
            'inp-batch-start': '1',
            'inp-batch-end': '10',
            'inp-batch-ip-start': '',
            'inp-batch-ip-end': ''
        };
        for (const [id, val] of Object.entries(els)) {
            const el = document.getElementById(id);
            if (el) el.value = val;
        }
    },

    switchAddMode(mode) {
        const btnSingle = document.getElementById('btn-pc-single');
        const btnBatch = document.getElementById('btn-pc-batch');
        const formSingle = document.getElementById('form-pc-single');
        const formBatch = document.getElementById('form-pc-batch');

        if (!btnSingle || !btnBatch || !formSingle || !formBatch) return;

        if (mode === 'single') {
            btnSingle.className = 'px-3.5 py-1.5 rounded text-xs lg:text-base font-bold bg-neutral-100 text-black transition-all';
            btnBatch.className = 'px-3.5 py-1.5 rounded text-xs lg:text-base font-bold text-neutral-400 hover:text-neutral-200 transition-all';
            formSingle.classList.remove('hidden');
            formBatch.classList.add('hidden');
        } else {
            btnSingle.className = 'px-3.5 py-1.5 rounded text-xs lg:text-base font-bold text-neutral-400 hover:text-neutral-200 transition-all';
            btnBatch.className = 'px-3.5 py-1.5 rounded text-xs lg:text-base font-bold bg-neutral-100 text-black transition-all';
            formSingle.classList.add('hidden');
            formBatch.classList.remove('hidden');
        }
    }
};

Object.assign(PC, PCGrid);
Object.assign(PC, PCModal);
window.PC = PC;
