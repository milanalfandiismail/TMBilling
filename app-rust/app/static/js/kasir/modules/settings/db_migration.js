// Sub-tab Pengaturan: migrasi database Python 1.6.5 ke Rust.
const DbMigration = {
    token: null,
    file: null,
    init() {
        this.token = null;
        this.file = null;
        this._setApplyEnabled(false);
        document.getElementById('db-import-status').textContent = '';
        document.getElementById('db-import-preview').classList.add('hidden');
        document.getElementById('db-import-file-preview').classList.add('hidden');
    },
    pick(input) {
        this._setFile(input.files[0] || null);
    },
    drop(ev) {
        ev.preventDefault();
        this._setFile(ev.dataTransfer.files[0] || null);
    },
    clearFile(ev) {
        ev.stopPropagation();
        this.init();
        document.getElementById('db-import-file').value = '';
    },
    _setFile(file) {
        this.file = file;
        const strip = document.getElementById('db-import-file-preview');
        document.getElementById('db-import-file-name').textContent = file ? file.name : '';
        strip.classList.toggle('hidden', !file);
        this.token = null;
        this._setApplyEnabled(false);
    },
    _setApplyEnabled(on) {
        document.getElementById('db-import-apply-btn').disabled = !on;
    },
    _teks(id, nilai) {
        const el = document.getElementById(id);
        if (el) el.textContent = nilai;
    },
    _daftar(id, arr, kosong) {
        const el = document.getElementById(id);
        if (el) el.textContent = (arr && arr.length) ? arr.join(', ') : kosong;
    },
    async preview() {
        const file = this.file;
        if (!file) {
            Toast.error('Pilih berkas database terlebih dahulu');
            return;
        }
        const btn = document.getElementById('db-import-preview-btn');
        btn.disabled = true;
        this._teks('db-import-status', 'Membaca berkas...');
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await API.request('/api/v1/kasir/settings/database/import/preview', {
                method: 'POST',
                body: fd
            });
            const p = res.preview || {};
            this.token = res.token;
            this._teks('db-import-token-badge', 'token ' + String(res.token || '').slice(0, 8));
            this._teks('db-import-tables', p.tables ?? '-');
            this._teks('db-import-rows', p.rows ?? '-');
            this._teks('db-import-revision', p.python_revision || 'tidak tercatat');
            this._teks('db-import-duplikat', (p.duplikat_sesi_pc || 0) + ' / ' + (p.duplikat_sesi_member || 0));
            this._daftar('db-import-missing-tables', p.missing_tables, 'Tidak ada');
            this._daftar('db-import-missing-columns', p.missing_columns, 'Tidak ada');
            this._daftar('db-import-missing-indexes', p.missing_indexes, 'Tidak ada');
            const warn = document.getElementById('db-import-warning');
            const ganda = (p.duplikat_sesi_pc || 0) > 0 || (p.duplikat_sesi_member || 0) > 0;
            if (ganda) {
                warn.textContent = 'Database sumber memiliki lebih dari satu sesi aktif pada PC/member yang sama. Migrasi akan ditolak sampai data itu dibereskan.';
                warn.classList.remove('hidden');
            } else {
                warn.classList.add('hidden');
            }
            document.getElementById('db-import-preview').classList.remove('hidden');
            this._setApplyEnabled(!ganda);
            this._teks('db-import-status', 'Pratinjau siap. Periksa daftar di samping sebelum menerapkan.');
        } catch (e) {
            this.token = null;
            this._setApplyEnabled(false);
            this._teks('db-import-status', '');
            Toast.error(e.message || 'Gagal membaca berkas');
        } finally {
            btn.disabled = false;
        }
    },
    apply() {
        if (!this.token) {
            Toast.error('Lakukan pratinjau terlebih dahulu');
            return;
        }
        const token = this.token;
        Modal.confirm(
            'Seluruh data pada database Rust aktif akan diganti dengan isi berkas yang dipratinjau. ' +
            'Pastikan server Python sudah dihentikan dan Anda memiliki salinan cadangan.',
            async () => {
                try {
                    const res = await API.request('/api/v1/kasir/settings/database/import/apply', {
                        method: 'POST',
                        body: JSON.stringify({ token })
                    });
                    const r = res.result || {};
                    Toast.success(r.message + ' (' + (r.rows_imported ?? 0) + ' baris) - login ulang diperlukan');
                    document.getElementById('db-import-status').textContent =
                        'Selesai. Snapshot: ' + (r.safety_backup || '-') + '. Mengalihkan ke halaman login...';
                    setTimeout(() => { window.location.href = '/kasir/login'; }, 1800);
                } catch (e) {
                    Toast.error(e.message || 'Migrasi gagal');
                }
            },
            null,
            { requireCheck: 'Saya sudah menghentikan server Python dan memahami data aktif akan ditimpa.' }
        );
    }
};
window.DbMigration = DbMigration;
