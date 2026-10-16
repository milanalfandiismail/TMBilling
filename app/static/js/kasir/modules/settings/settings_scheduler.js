// app/static/js/kasir/modules/settings/settings_scheduler.js
/**
 * Sub-modul SettingsScheduler untuk pengaturan Auto-Scheduler PC & Server:
 * jadwal backup otomatis, pembersihan log (cleanup), dan screenshot berkala.
 */

const SettingsScheduler = {
    _updateSchedulerPreview() {
        const bVal = document.getElementById('scheduler-backup-value')?.value || '60';
        const bUnit = document.getElementById('scheduler-backup-unit')?.value || 'menit';
        const cVal = document.getElementById('scheduler-cleanup-value')?.value || '30';
        const cUnit = document.getElementById('scheduler-cleanup-unit')?.value || 'hari';
        const sEnabled = document.getElementById('scheduler-screenshot-enabled')?.checked || false;
        const sVal = document.getElementById('scheduler-screenshot-value')?.value || '60';
        const sUnit = document.getElementById('scheduler-screenshot-unit')?.value || 'detik';

        document.getElementById('scheduler-backup-preview').innerHTML = `Backup otomatis setiap <strong class="text-neutral-300">${bVal} ${bUnit}</strong>`;
        document.getElementById('scheduler-cleanup-preview').innerHTML = `Hapus log lebih dari <strong class="text-neutral-300">${cVal} ${cUnit}</strong>`;

        const previewEl = document.getElementById('scheduler-screenshot-preview');
        if (previewEl) {
            if (sEnabled) {
                previewEl.innerHTML = `Screenshot otomatis setiap <strong class="text-neutral-300">${sVal} ${sUnit}</strong>`;
                previewEl.classList.remove('text-neutral-500');
                previewEl.classList.add('text-green-500');
            } else {
                previewEl.innerHTML = `Screenshot otomatis setiap <strong class="text-neutral-300">${sVal} ${sUnit}</strong> (Nonaktif)`;
                previewEl.classList.remove('text-green-500');
                previewEl.classList.add('text-neutral-500');
            }
        }
    },

    async saveSchedulerConfig() {
        const backupValue = document.getElementById('scheduler-backup-value')?.value;
        const backupUnit = document.getElementById('scheduler-backup-unit')?.value;
        const cleanupValue = document.getElementById('scheduler-cleanup-value')?.value;
        const cleanupUnit = document.getElementById('scheduler-cleanup-unit')?.value;
        const screenshotEnabled = document.getElementById('scheduler-screenshot-enabled')?.checked ? '1' : '0';
        const screenshotValue = document.getElementById('scheduler-screenshot-value')?.value;
        const screenshotUnit = document.getElementById('scheduler-screenshot-unit')?.value;

        if (!backupValue || !cleanupValue || !screenshotValue) {
            Toast.error('Semua field wajib diisi');
            return;
        }

        Toast.success('Menyimpan konfigurasi scheduler...');
        try {
            const res = await API.request('/api/v1/kasir/settings/scheduler', {
                method: 'PUT',
                body: JSON.stringify({
                    backup_value: parseInt(backupValue),
                    backup_unit: backupUnit,
                    cleanup_value: parseInt(cleanupValue),
                    cleanup_unit: cleanupUnit,
                    screenshot_enabled: screenshotEnabled,
                    screenshot_value: parseInt(screenshotValue),
                    screenshot_unit: screenshotUnit
                })
            });

            if (res.success) {
                Toast.success('Konfigurasi disimpan! Merestart aplikasi...');

                // Tampilkan overlay loading
                const overlay = document.createElement('div');
                overlay.id = 'scheduler-restart-overlay';
                overlay.className = 'fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center';
                overlay.innerHTML = `<div class="bg-[#0c0c0c] border border-[#1c1c1c] rounded-xl p-8 text-center max-w-sm">
                    <div class="text-4xl mb-4 animate-pulse">🔄</div>
                    <h3 class="text-lg font-bold text-neutral-200 mb-2">Menerapkan Perubahan</h3>
                    <p class="text-sm text-neutral-400">Server restart, halaman akan dimuat ulang...</p>
                </div>`;
                document.body.appendChild(overlay);

                // Trigger restart endpoint — error koneksi diharapkan karena server mati
                try {
                    await API.request('/api/v1/kasir/settings/scheduler/restart', { method: 'POST' });
                } catch (_) {
                    // Expected — server restart memutus koneksi
                }

                // Reload page setelah jeda biar server baru sempat start
                setTimeout(() => window.location.reload(), 3000);
                return;
            }
        } catch (err) {
            Toast.error('Gagal menyimpan scheduler: ' + err.message);
        }
    },

};

window.SettingsScheduler = SettingsScheduler;
