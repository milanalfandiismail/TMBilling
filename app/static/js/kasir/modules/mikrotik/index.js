/**
 * MikrotikModule - Module for Mikrotik Settings tab
 */

const MikrotikModule = {
    init: function () {
        this.loadSettings();
    },

    loadSettings: function () {
        API.request('/api/v1/kasir/mikrotik/config')
            .then(res => {
                if (res.success) {
                    const config = res.data;
                    document.getElementById('mikrotik-enabled').checked = config.enabled;
                    document.getElementById('mikrotik-host').value = config.host || '';
                    document.getElementById('mikrotik-port').value = config.port || '8728';
                    document.getElementById('mikrotik-username').value = config.username || '';
                    document.getElementById('mikrotik-password').value = config.password || '';
                    document.getElementById('mikrotik-profile').value = config.hotspot_profile || 'default';
                    this.updateUIState();
                }
            })
            .catch(err => Toast.show('Gagal memuat pengaturan MikroTik', 'error'));
    },

    updateUIState: function() {
        const isEnabled = document.getElementById('mikrotik-enabled').checked;
        const inputs = ['mikrotik-host', 'mikrotik-port', 'mikrotik-username', 'mikrotik-password', 'mikrotik-profile'];
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if(el) {
                el.disabled = !isEnabled;
                if (!isEnabled) {
                    el.classList.add('opacity-50', 'cursor-not-allowed');
                } else {
                    el.classList.remove('opacity-50', 'cursor-not-allowed');
                }
            }
        });
        
        const testBtn = document.getElementById('btn-mikrotik-test');
        const syncBtn = document.getElementById('btn-mikrotik-sync');
        if (testBtn) {
            testBtn.disabled = !isEnabled;
            if (!isEnabled) testBtn.classList.add('opacity-50', 'cursor-not-allowed');
            else testBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        if (syncBtn) {
            syncBtn.disabled = !isEnabled;
            if (!isEnabled) syncBtn.classList.add('opacity-50', 'cursor-not-allowed');
            else syncBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    },

    toggleIntegration: function (checkbox) {
        const isEnabled = checkbox.checked;
        const host = document.getElementById('mikrotik-host').value.trim();
        const port = document.getElementById('mikrotik-port').value.trim() || '8728';
        const username = document.getElementById('mikrotik-username').value.trim();
        const password = document.getElementById('mikrotik-password').value;
        const profile = document.getElementById('mikrotik-profile').value.trim() || 'default';
        
        API.request('/api/v1/kasir/mikrotik/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                enabled: isEnabled,
                host: host,
                port: port,
                username: username,
                password: password,
                hotspot_profile: profile
            })
        })
            .then(data => {
                if (data.success) {
                    Toast.show(checkbox.checked ? 'Integrasi MikroTik Diaktifkan' : 'Integrasi MikroTik Dinonaktifkan', 'success');
                    MikrotikModule.updateUIState();
                } else {
                    Toast.show(data.error || 'Gagal mengubah status', 'error');
                    checkbox.checked = !checkbox.checked; // Revert
                }
            })
            .catch(err => {
                Toast.show('Terjadi kesalahan', 'error');
                checkbox.checked = !checkbox.checked; // Revert
            });
    },

    saveConfig: function () {
        const isEnabled = document.getElementById('mikrotik-enabled').checked;
        const host = document.getElementById('mikrotik-host').value.trim();
        const port = document.getElementById('mikrotik-port').value.trim() || '8728';
        const username = document.getElementById('mikrotik-username').value.trim();
        const password = document.getElementById('mikrotik-password').value;
        const profile = document.getElementById('mikrotik-profile').value.trim() || 'default';

        if (!host || !username) {
            Toast.show('Host dan Username tidak boleh kosong', 'error');
            return;
        }

        API.request('/api/v1/kasir/mikrotik/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                enabled: isEnabled,
                host: host,
                port: port,
                username: username,
                password: password,
                hotspot_profile: profile
            })
        })
            .then(res => {
                if (res.success) {
                    Toast.show('Pengaturan MikroTik berhasil disimpan', 'success');
                } else {
                    Toast.show(res.error || 'Gagal menyimpan pengaturan', 'error');
                }
            })
            .catch(err => {
                Toast.show('Gagal menyimpan pengaturan', 'error');
            });
    },

    testConnection: function () {
        const host = document.getElementById('mikrotik-host').value.trim();
        const port = document.getElementById('mikrotik-port').value.trim() || '8728';
        const username = document.getElementById('mikrotik-username').value.trim();
        const password = document.getElementById('mikrotik-password').value;

        if (!host || !username) {
            Toast.show('Host dan Username tidak boleh kosong', 'error');
            return;
        }

        Toast.show('Menguji koneksi...', 'info');

        API.request('/api/v1/kasir/mikrotik/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host, port, username, password })
        })
            .then(data => {
                if (data.success) {
                    Toast.show(data.message || 'Koneksi MikroTik Berhasil', 'success');
                } else {
                    Toast.show(data.error || 'Gagal terhubung ke MikroTik', 'error');
                }
            })
            .catch(err => {
                Toast.show('Terjadi kesalahan jaringan', 'error');
            });
    },

    syncAllMembers: function () {
        Modal.confirm('Selaraskan SEMUA member TMBilling ke MikroTik Hotspot secara massal? Proses akan berjalan di latar belakang.', function () {
            Toast.show('Memicu sinkronisasi massal...', 'info');

            API.request('/api/v1/kasir/mikrotik/sync_all', {
                method: 'POST'
            })
                .then(res => {
                    if (res.success) {
                        Toast.show(res.message || 'Sinkronisasi massal berjalan', 'success');
                    } else {
                        Toast.show(res.error || 'Gagal memicu sinkronisasi', 'error');
                    }
                })
                .catch(err => {
                    Toast.show('Terjadi kesalahan jaringan', 'error');
                });
        });
    }
};

// Initialize when tab is shown
document.addEventListener('DOMContentLoaded', () => {
    MikrotikModule.init();
});
