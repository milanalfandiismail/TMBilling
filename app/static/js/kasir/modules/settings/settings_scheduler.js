// app/static/js/kasir/modules/settings/settings_scheduler.js
/**
 * Sub-modul SettingsScheduler untuk pengaturan Auto-Scheduler PC & Server:
 * jadwal backup otomatis, pembersihan log (cleanup), dan screenshot berkala.
 * Responsif, zero-page-reload, dengan quick preset pills & live dynamic preview.
 */

const SettingsScheduler = {
    _capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    },

    _highlightPills(containerId, activeVal, activeUnit) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const pills = container.querySelectorAll('button');
        pills.forEach(pill => {
            const pVal = pill.getAttribute('data-val');
            const pUnit = pill.getAttribute('data-unit');
            const isActive = String(pVal) === String(activeVal) && String(pUnit) === String(activeUnit);

            if (isActive) {
                pill.className = pill.className
                    .replace(/bg-\[#141414\]/g, '')
                    .replace(/text-neutral-400/g, '')
                    .replace(/border-\[#222\]/g, '')
                    .replace(/hover:bg-\[#1a1a1a\]/g, '')
                    .trim();
                if (!pill.classList.contains('bg-white')) {
                    pill.classList.add('bg-white', 'text-black', 'border-white', 'font-bold');
                }
            } else {
                pill.classList.remove('bg-white', 'text-black', 'border-white', 'font-bold');
                if (!pill.classList.contains('text-neutral-400')) {
                    pill.classList.add('bg-[#141414]', 'text-neutral-400', 'border-[#222]', 'hover:bg-[#1a1a1a]', 'font-medium');
                }
            }
        });
    },

    setBackupPreset(val, unit) {
        const vInput = document.getElementById('scheduler-backup-value');
        const uInput = document.getElementById('scheduler-backup-unit');
        if (vInput) vInput.value = val;
        if (uInput) uInput.value = unit;
        this._updateSchedulerPreview();
    },

    setCleanupPreset(val, unit) {
        const vInput = document.getElementById('scheduler-cleanup-value');
        const uInput = document.getElementById('scheduler-cleanup-unit');
        if (vInput) vInput.value = val;
        if (uInput) uInput.value = unit;
        this._updateSchedulerPreview();
    },

    setScreenshotPreset(val, unit) {
        const vInput = document.getElementById('scheduler-screenshot-value');
        const uInput = document.getElementById('scheduler-screenshot-unit');
        if (vInput) vInput.value = val;
        if (uInput) uInput.value = unit;
        this._updateSchedulerPreview();
    },

    _updateSchedulerPreview() {
        const bVal = document.getElementById('scheduler-backup-value')?.value || '1';
        const bUnit = document.getElementById('scheduler-backup-unit')?.value || 'hari';
        const cVal = document.getElementById('scheduler-cleanup-value')?.value || '30';
        const cUnit = document.getElementById('scheduler-cleanup-unit')?.value || 'hari';
        const sEnabled = !!document.getElementById('scheduler-screenshot-enabled')?.checked;
        const sVal = document.getElementById('scheduler-screenshot-value')?.value || '60';
        const sUnit = document.getElementById('scheduler-screenshot-unit')?.value || 'detik';

        // Update Text Previews
        const bPrev = document.getElementById('scheduler-backup-preview');
        if (bPrev) {
            bPrev.innerHTML = `Backup otomatis setiap <strong class="text-neutral-200">${bVal} ${this._capitalize(bUnit)}</strong>.`;
        }

        const cPrev = document.getElementById('scheduler-cleanup-preview');
        if (cPrev) {
            cPrev.innerHTML = `Hapus log lebih dari <strong class="text-neutral-200">${cVal} ${this._capitalize(cUnit)}</strong>.`;
        }

        // Toggle Screenshot Status & Controls
        const sStatus = document.getElementById('scheduler-screenshot-status');
        if (sStatus) {
            sStatus.textContent = sEnabled ? 'Aktif' : 'Nonaktif';
            sStatus.className = sEnabled 
                ? 'ml-1.5 text-[9px] font-semibold text-emerald-400' 
                : 'ml-1.5 text-[9px] font-semibold text-neutral-500';
        }

        const sValEl = document.getElementById('scheduler-screenshot-value');
        const sUnitEl = document.getElementById('scheduler-screenshot-unit');
        if (sValEl) sValEl.disabled = !sEnabled;
        if (sUnitEl) sUnitEl.disabled = !sEnabled;

        const sCfg = document.getElementById('scheduler-screenshot-config');
        if (sCfg) {
            if (sEnabled) {
                sCfg.classList.remove('opacity-50', 'pointer-events-none');
            } else {
                sCfg.classList.add('opacity-50', 'pointer-events-none');
            }
        }

        const sPrev = document.getElementById('scheduler-screenshot-preview');
        if (sPrev) {
            if (sEnabled) {
                sPrev.innerHTML = `Screenshot otomatis setiap <strong class="text-neutral-200">${sVal} ${this._capitalize(sUnit)}</strong>.`;
            } else {
                sPrev.innerHTML = `Screenshot otomatis setiap <strong class="text-neutral-200">${sVal} ${this._capitalize(sUnit)}</strong> <span class="text-neutral-500">(Nonaktif)</span>.`;
            }
        }

        // Highlight preset pills
        this._highlightPills('scheduler-backup-pills', bVal, bUnit);
        this._highlightPills('scheduler-cleanup-pills', cVal, cUnit);
        this._highlightPills('scheduler-screenshot-pills', sVal, sUnit);
    },

    async saveSchedulerConfig() {
        const backupValue = document.getElementById('scheduler-backup-value')?.value;
        const backupUnit = document.getElementById('scheduler-backup-unit')?.value;
        const cleanupValue = document.getElementById('scheduler-cleanup-value')?.value;
        const cleanupUnit = document.getElementById('scheduler-cleanup-unit')?.value;
        const screenshotEnabled = document.getElementById('scheduler-screenshot-enabled')?.checked ? '1' : '0';
        const screenshotValue = document.getElementById('scheduler-screenshot-value')?.value;
        const screenshotUnit = document.getElementById('scheduler-screenshot-unit')?.value;

        if (!backupValue || parseInt(backupValue) < 1 || !cleanupValue || parseInt(cleanupValue) < 1 || !screenshotValue || parseInt(screenshotValue) < 1) {
            if (typeof Toast !== 'undefined') {
                Toast.error('Semua nilai interval harus berupa angka positif.');
            } else {
                alert('Semua nilai interval harus berupa angka positif.');
            }
            return;
        }

        const btn = document.getElementById('btn-save-scheduler');
        const origContent = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<svg class="w-4 h-4 animate-spin text-black" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg><span>Menyimpan...</span>`;
        }

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

            if (res && res.success) {
                // Trigger background scheduler restart silently
                try {
                    await API.request('/api/v1/kasir/settings/scheduler/restart', { method: 'POST' });
                } catch (_) {
                    // Ignored: Server restart will briefly disrupt socket or HTTP connection
                }

                if (typeof Toast !== 'undefined') {
                    Toast.success('Konfigurasi penjadwalan otomatis berhasil disimpan & diterapkan!');
                }
            } else {
                throw new Error(res?.message || 'Gagal menyimpan konfigurasi scheduler');
            }
        } catch (err) {
            if (typeof Toast !== 'undefined') {
                Toast.error('Gagal menyimpan scheduler: ' + (err.message || err));
            } else {
                alert('Gagal menyimpan scheduler: ' + (err.message || err));
            }
        } finally {
            if (btn) {
                setTimeout(() => {
                    btn.disabled = false;
                    btn.innerHTML = origContent;
                }, 600);
            }
        }
    }
};

// Bind input & change events for real-time reactivity
document.addEventListener('DOMContentLoaded', () => {
    ['scheduler-backup-value', 'scheduler-backup-unit', 'scheduler-cleanup-value', 'scheduler-cleanup-unit', 'scheduler-screenshot-enabled', 'scheduler-screenshot-value', 'scheduler-screenshot-unit'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                if (window.SettingsScheduler) window.SettingsScheduler._updateSchedulerPreview();
            });
            el.addEventListener('change', () => {
                if (window.SettingsScheduler) window.SettingsScheduler._updateSchedulerPreview();
            });
        }
    });
});

window.SettingsScheduler = SettingsScheduler;
