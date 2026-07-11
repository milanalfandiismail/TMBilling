// app/static/js/kasir/modules/pc/index.js

const PC = {
    currentPage: 1,
    searchQuery: '',
    currentGrupId: '',

    async load() {
        const area = document.getElementById('pc-table');
        if (!area) return;
        area.innerHTML = '<div class="flex justify-center py-8"><div class="w-6 h-6 border-2 border-[#1c1c1c] border-t-neutral-100 rounded-full animate-spin"></div></div>';

        try {
            const filterSelect = document.getElementById('pc-grup-filter-select');
            if (filterSelect && filterSelect.options.length <= 1) {
                const grupResponse = await API.grup.list();
                const groups = grupResponse.grup || [];
                
                const addSelect = document.getElementById('inp-pc-grup');
                if (addSelect) {
                    addSelect.innerHTML = groups.map(g => `<option value="${g.nama}">${g.nama.toUpperCase()}</option>`).join('');
                }
                const batchSelect = document.getElementById('inp-batch-grup');
                if (batchSelect) {
                    batchSelect.innerHTML = groups.map(g => `<option value="${g.nama}">${g.nama.toUpperCase()}</option>`).join('');
                }
                
                filterSelect.innerHTML = '<option value="">Semua Grup</option>' + groups.map(g => `<option value="${g.id}">${g.nama.toUpperCase()}</option>`).join('');
            }

            const data = await API.pc.list({
                q: this.searchQuery || '',
                grup_id: this.currentGrupId || ''
            });
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

    async add() {
        const get = (modalId, legacyId) => {
            const m = document.getElementById(modalId);
            if (m) return m;
            return document.getElementById(legacyId);
        };
        const data = {
            kode: (get('modal-pc-kode', 'inp-pc-kode') || {}).value?.trim() || '',
            nama: (get('modal-pc-nama', 'inp-pc-nama') || {}).value?.trim() || '',
            ip_address: (get('modal-pc-ip', 'inp-pc-ip') || {}).value?.trim() || '',
            mac_address: ((get('modal-pc-mac', 'inp-pc-mac') || {}).value?.trim() || '').toUpperCase(),
            grup: (get('modal-pc-grup', 'inp-pc-grup') || {}).value || ''
        };
        if (!data.kode) return Toast.error('Kode PC wajib diisi');
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
            kode: document.getElementById('edit-pc-kode').value.trim(),
            nama: document.getElementById('edit-pc-nama').value.trim(),
            ip_address: document.getElementById('edit-pc-ip').value.trim(),
            mac_address: document.getElementById('edit-pc-mac').value.trim().toUpperCase(),
            grup: document.getElementById('edit-pc-grup').value
        };
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
        const message = '<div class="text-center"><p class="text-xs lg:text-base text-neutral-400">Hapus PC ini? Data akan dihapus permanen.</p></div>';
        Modal.confirm(message, async () => {
            try {
                await API.pc.delete(id);
                Toast.success('PC berhasil dihapus');
                this.load();
            } catch (err) {
                Toast.error(err.message);
            }
        });
    },

    async addBatch() {
        const get = (modalId, legacyId) => {
            const m = document.getElementById(modalId);
            if (m) return m;
            return document.getElementById(legacyId);
        };
        const data = {
            prefix: (get('modal-batch-prefix', 'inp-batch-prefix') || {}).value?.trim() || 'PC-',
            start_num: parseInt((get('modal-batch-start', 'inp-batch-start') || {}).value || '1'),
            end_num: parseInt((get('modal-batch-end', 'inp-batch-end') || {}).value || '10'),
            grup: (get('modal-batch-grup', 'inp-batch-grup') || {}).value || '',
            ip_start: (get('modal-batch-ip-start', 'inp-batch-ip-start') || {}).value?.trim() || '',
            ip_end: (get('modal-batch-ip-end', 'inp-batch-ip-end') || {}).value?.trim() || ''
        };
        if (isNaN(data.start_num) || isNaN(data.end_num)) return Toast.error('Nomor urut tidak valid');
        if (data.start_num > data.end_num) return Toast.error('Nomor akhir harus lebih besar');
        if (!data.ip_start || !data.ip_end) return Toast.error('IP Start dan End wajib diisi');

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
            'inp-batch-prefix': 'PC-',
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
