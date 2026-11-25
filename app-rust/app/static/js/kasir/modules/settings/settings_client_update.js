// app/static/js/kasir/modules/settings/settings_client_update.js
/**
 * Sub-modul SettingsClientUpdate:
 * Mengelola upload paket biner TMBilling.exe untuk PC klien (WarnetAgent),
 * memvalidasi status biner di server, serta menyiarkan perintah pembaruan massal.
 */

const SettingsClientUpdate = {
    packageInfo: null,
    isUploading: false,

    init() {
        this.bindEvents();
        this.refresh();
    },

    bindEvents() {
        const dropzone = document.getElementById('client-update-dropzone');
        const fileInput = document.getElementById('client-update-file-input');

        if (!dropzone || !fileInput) return;

        dropzone.addEventListener('click', () => {
            if (!this.isUploading) fileInput.click();
        });

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('border-emerald-500', 'bg-[#121212]');
        });

        ['dragleave', 'dragend'].forEach(evt => {
            dropzone.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('border-emerald-500', 'bg-[#121212]');
            });
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('border-emerald-500', 'bg-[#121212]');

            if (this.isUploading) return;
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                this.uploadFile(files[0]);
            }
        });
    },

    onFileSelected(input) {
        if (input.files && input.files.length > 0) {
            this.uploadFile(input.files[0]);
        }
    },

    async refresh() {
        try {
            const res = await API.request('/api/v1/kasir/settings/client-update');
            if (res && res.success) {
                this.packageInfo = res;
                this.renderInfo();
            }
        } catch (err) {
            console.error('[ClientUpdate] Gagal memuat info paket:', err);
        }
    },

    renderInfo() {
        const info = this.packageInfo;
        const statusBadge = document.getElementById('client-update-status-badge');
        const sizeEl = document.getElementById('client-update-size');
        const dateEl = document.getElementById('client-update-date');
        const shaEl = document.getElementById('client-update-sha256');
        const btnDelete = document.getElementById('btn-delete-package');
        const btnBroadcast = document.getElementById('btn-broadcast-update');

        if (!info || !info.exists) {
            if (statusBadge) {
                statusBadge.className = 'px-2.5 py-1 rounded text-xs font-mono bg-neutral-900 text-neutral-500 border border-neutral-800';
                statusBadge.innerText = 'Paket Belum Tersedia';
            }
            if (sizeEl) sizeEl.innerText = '-';
            if (dateEl) dateEl.innerText = '-';
            if (shaEl) shaEl.innerText = '-';
            if (btnDelete) btnDelete.disabled = true;
            if (btnBroadcast) btnBroadcast.disabled = true;
            return;
        }

        if (statusBadge) {
            statusBadge.className = 'px-2.5 py-1 rounded text-xs font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/80 font-bold';
            statusBadge.innerText = '✓ Siap Distribusi';
        }
        if (sizeEl) sizeEl.innerText = info.file_size_formatted;
        if (dateEl) dateEl.innerText = info.modified_at;
        if (shaEl) shaEl.innerText = info.sha256;
        if (btnDelete) btnDelete.disabled = false;
        if (btnBroadcast) btnBroadcast.disabled = false;
    },

    uploadFile(file) {
        if (!file.name.toLowerCase().endsWith('.exe')) {
            alert('File harus berformat biner Windows (.exe)');
            return;
        }

        const formData = new FormData();
        formData.append('file', file, 'TMBilling.exe');

        const progressContainer = document.getElementById('client-update-progress-container');
        const progressBar = document.getElementById('client-update-progress-bar');
        const progressPercentage = document.getElementById('client-update-percentage');
        const progressStatus = document.getElementById('client-update-progress-status');
        const filenameEl = document.getElementById('client-update-filename');

        if (progressContainer) progressContainer.classList.remove('hidden');
        if (filenameEl) filenameEl.innerText = file.name;

        this.isUploading = true;

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/v1/kasir/settings/client-update/upload');

        const csrfToken = typeof API !== 'undefined' && API.csrfToken ? API.csrfToken() : '';
        if (csrfToken) {
            xhr.setRequestHeader('X-CSRFToken', csrfToken);
        }

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                if (progressBar) progressBar.style.width = percent + '%';
                if (progressPercentage) progressPercentage.innerText = percent + '%';
                if (progressStatus) progressStatus.innerText = `Mengunggah: ${percent}% (${(e.loaded / (1024 * 1024)).toFixed(1)}MB / ${(e.total / (1024 * 1024)).toFixed(1)}MB)`;
            }
        };

        const resetFileInput = () => {
            const fileInput = document.getElementById('client-update-file-input');
            if (fileInput) fileInput.value = '';
        };

        xhr.onload = () => {
            this.isUploading = false;
            resetFileInput();
            if (xhr.status >= 200 && xhr.status < 300) {
                if (progressStatus) progressStatus.innerText = '✓ Biner berhasil disimpan ke server!';
                setTimeout(() => {
                    if (progressContainer) progressContainer.classList.add('hidden');
                    this.refresh();
                }, 1500);
            } else {
                let errText = xhr.status === 413
                    ? 'Ukuran file melebihi batas maksimal server (256 MB)'
                    : 'Gagal mengunggah file';
                try {
                    const resp = JSON.parse(xhr.responseText);
                    if (resp.error) errText = resp.error;
                } catch (_) {}
                alert('Upload gagal: ' + errText);
                if (progressContainer) progressContainer.classList.add('hidden');
            }
        };

        xhr.onerror = () => {
            this.isUploading = false;
            resetFileInput();
            alert('Terjadi kesalahan jaringan saat mengunggah file');
            if (progressContainer) progressContainer.classList.add('hidden');
        };

        xhr.onabort = () => {
            this.isUploading = false;
            resetFileInput();
            if (progressContainer) progressContainer.classList.add('hidden');
        };

        xhr.send(formData);
    },

    copySha256() {
        if (this.packageInfo && this.packageInfo.sha256) {
            navigator.clipboard.writeText(this.packageInfo.sha256).then(() => {
                const btn = document.getElementById('btn-copy-sha256');
                if (btn) {
                    const original = btn.innerText;
                    btn.innerText = 'Disalin!';
                    setTimeout(() => btn.innerText = original, 2000);
                }
            });
        }
    },

    confirmDelete() {
        if (!confirm('Apakah Anda yakin ingin menghapus paket update TMBilling.exe dari server?')) return;
        API.request('/api/v1/kasir/settings/client-update', { method: 'DELETE' })
            .then(res => {
                if (res && res.success) {
                    this.refresh();
                } else {
                    alert('Gagal menghapus: ' + (res.error || 'Unknown error'));
                }
            })
            .catch(err => alert('Error: ' + err.message));
    },

    confirmBroadcast() {
        if (!confirm('Kirim sinyal update ke SEMUA PC yang sedang online sekarang?\n\nKlien akan mengunduh paket dan melakukan restart otomatis dalam ~5 detik.')) return;
        API.request('/api/v1/kasir/settings/client-update/broadcast', { method: 'POST', body: JSON.stringify({}) })
            .then(res => {
                if (res && res.success) {
                    alert(res.message);
                } else {
                    alert('Gagal: ' + (res.error || 'Unknown error'));
                }
            })
            .catch(err => alert('Error: ' + err.message));
    }
};

window.SettingsClientUpdate = SettingsClientUpdate;
