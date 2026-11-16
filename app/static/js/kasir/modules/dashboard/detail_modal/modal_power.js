/**
 * Dashboard Detail Modal - Power & AFK Actions Sub-module
 * Menangani aksi daya PC: Restart, Shutdown, Cancel Shutdown, WOL, serta Remote AFK Lock/Unlock.
 */
window.DashboardModalPower = {
    remoteAction(pcId, action, pcKode = '') {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        const actionLabel = action === 'shutdown' ? 'Shutdown (Matikan)' : 'Restart (Mulai Ulang)';
        const pcName = pcKode || `PC #${pcId}`;

        Modal.confirm(`
            <div class="text-center">
                <p class="text-xs lg:text-base text-neutral-400 font-bold uppercase tracking-wider">${actionLabel} PC ${pcName}?</p>
                <p class="text-[10px] lg:text-base text-red-400 font-bold mt-1">⚠️ Perhatian: PC akan langsung mati/restart secara paksa. Semua pekerjaan yang belum disimpan di PC client akan hilang.</p>
            </div>
        `, async () => {
            try {
                const result = await API.request(`/api/v1/kasir/monitor/remote/${pcId}/${action}`, {
                    method: 'POST'
                });
                if (!result.success) {
                    throw new Error(result.error || 'Gagal mengirim perintah');
                }
                Toast.success(`Perintah ${action === 'shutdown' ? 'Shutdown' : 'Restart'} berhasil dikirim ke PC!`);
            } catch (err) {
                console.error('[DashboardDetailModal] Remote action error:', err);
                Toast.error(err.message || 'Gagal mengirim perintah remote');
            }
        });
    },

    remoteAfkLock(pcId, pcKode = '') {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        const pcName = pcKode || `PC #${pcId}`;

        setTimeout(() => {
            document.getElementById('remote-afk-pin-input')?.focus();
        }, 50);

        Modal.confirm(`
            <div class="space-y-3">
                <div class="text-center">
                    <p class="text-xs lg:text-base text-neutral-200 font-bold uppercase tracking-wider">Kunci Layar AFK PC ${pcName}</p>
                    <p class="text-[11px] lg:text-sm text-neutral-400 mt-1">Layar PC client akan dikunci. Tentukan PIN / Password untuk membuka kunci PC ini.</p>
                </div>
                <div class="text-left pt-2">
                    <label class="block text-xs font-semibold text-neutral-300 mb-1">PIN / Password Kunci Layar:</label>
                    <input type="password" id="remote-afk-pin-input" maxlength="32" placeholder="Masukkan PIN atau password bebas"
                        class="w-full bg-[#161616] border border-[#333] rounded-lg px-3 py-2.5 text-center text-sm font-mono tracking-widest text-white focus:border-amber-500 focus:outline-none">
                </div>
            </div>
        `, async () => {
            const pinInput = document.getElementById('remote-afk-pin-input');
            const pin = (pinInput?.value || '').trim();
            if (!pin) {
                Toast.error('PIN / Password kunci layar tidak boleh kosong!');
                return false;
            }

            try {
                const result = await API.request(`/api/v1/kasir/monitor/remote/${pcId}/afk-lock`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pin: pin })
                });
                if (!result.success) {
                    throw new Error(result.error || 'Gagal mengunci PC');
                }
                Toast.success(`PC ${pcName} berhasil dikunci!`);
                if (window.Dashboard) window.Dashboard._render(window.Dashboard.lastData);
                return true;
            } catch (err) {
                console.error('[DashboardDetailModal] Remote AFK Lock error:', err);
                Toast.error(err.message || 'Gagal mengunci PC');
                return false;
            }
        });
    },

    remoteAfkUnlock(pcId, pcKode = '') {
        if (typeof Shift !== 'undefined' && !Shift.canOperate()) return;
        const pcName = pcKode || `PC #${pcId}`;

        Modal.confirm(`
            <div class="text-center">
                <p class="text-xs lg:text-base text-amber-400 font-bold uppercase tracking-wider">Buka Kunci Layar (Master Unlock) PC ${pcName}?</p>
                <p class="text-[11px] lg:text-sm text-neutral-300 mt-2">Layar PC client akan langsung dibuka kuncinya dan kembali ke sesi aktif pengguna.</p>
            </div>
        `, async () => {
            try {
                const result = await API.request(`/api/v1/kasir/monitor/remote/${pcId}/afk-unlock`, {
                    method: 'POST'
                });
                if (!result.success) {
                    throw new Error(result.error || 'Gagal membuka kunci AFK');
                }
                Toast.success(`Kunci layar PC ${pcName} berhasil dibuka (Master Unlock)!`);
                if (window.Dashboard) window.Dashboard._render(window.Dashboard.lastData);
            } catch (err) {
                console.error('[DashboardDetailModal] Remote AFK Unlock error:', err);
                Toast.error(err.message || 'Gagal membuka kunci AFK');
            }
        });
    },

};
