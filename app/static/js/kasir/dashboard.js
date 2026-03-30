// app/static/js/kasir/dashboard.js

const Dashboard = {
    refreshInterval: null,

    async load() {
        try {
            // FIX: Cleanup dulu di server
            const data = await API.call('/kasir/pc');
            this.render(data);
            this.updateStats();
        } catch (e) {
            Toast.error('Gagal load dashboard: ' + e.message);
        }
    },

    render(data) {
        const groups = ['vvip', 'vip', 'reguler'];
        const names = { vvip: 'VVIP', vip: 'VIP', reguler: 'Reguler' };

        let html = '';
        let activeCount = 0;

        groups.forEach(g => {
            if (!data.by_grup[g]) return;
            const pcs = data.by_grup[g];
            const aktif = pcs.filter(p => p.status === 'terpakai').length;
            activeCount += aktif;

            html += `
                <div class="section">
                    <div class="section-title">
                        <span>${names[g]}</span>
                        <span>${aktif}/${pcs.length} aktif</span>
                    </div>
                    <div class="pc-grid">
                        ${pcs.map(pc => this.renderCard(pc)).join('')}
                    </div>
                </div>
            `;
        });

        document.getElementById('pc-area').innerHTML = html || '<div class="center">Tidak ada PC</div>';

        // FIX: Kalau ada sesi aktif, cek lebih sering
        this.adjustRefreshRate(activeCount);
    },

    renderCard(pc) {
        // FIX: Double check status
        const isOn = pc.status === 'terpakai' && pc.sesi_detail && pc.sesi_detail.sisa_menit > 0;
        const sesi = pc.sesi_detail;

        // Kalau sisa 0, treat sebagai kosong
        if (sesi && sesi.sisa_menit <= 0) {
            return this.renderEmptyCard(pc);
        }

        return `
            <div class="pc-card ${isOn ? 'active' : ''}" 
                 onclick="${isOn ? '' : `BukaModal.open('${pc.kode}')`}">
                <div class="pc-header">
                    <span class="pc-kode">${pc.kode}</span>
                    <span class="pc-status ${isOn ? 'on' : ''}"></span>
                </div>
                <div class="pc-info">${pc.nama}</div>
                <div class="pc-info"><span class="pc-ip">${pc.ip_address || 'No IP'}</span></div>
                <div class="pc-grup">${pc.grup}</div>
                ${isOn && sesi ? this.renderSession(sesi, pc) : this.renderEmpty()}
            </div>
        `;
    },

    renderSession(sesi, pc) {
        const waktu = Utils.formatDuration(sesi.sisa_menit);
        const shortWaktu = Utils.formatShort(sesi.sisa_menit);

        // FIX: Gunakan member_nama kalau ada, fallback ke nama_guest atau "Guest"
        const nama = sesi.member_nama || sesi.nama_guest || 'Guest';

        // Warning kalau waktu < 5 menit
        const isWarning = sesi.sisa_menit <= 5 && sesi.sisa_menit > 0;
        const timeStyle = isWarning ? 'color:#ff4444;' : '';

        // Tentukan apakah ini member (bisa topup) atau guest
        const isMember = sesi.tipe === 'member' && sesi.member_id;

        return `
            <div class="session-box">
                <div class="session-type">${sesi.tipe}</div>
                <div class="session-time" style="${timeStyle}" title="${waktu}">
                    ${shortWaktu}
                </div>
                <div class="session-user">${nama}</div>
                <div class="btn-row">
                    <button class="btn stop" onclick="event.stopPropagation(); Dashboard.stop(${sesi.id})">Stop</button>
                    <button class="btn add" onclick="event.stopPropagation(); Dashboard.tambah(${sesi.id})">+Waktu</button>
                </div>
            </div>
        `;
    },

    renderEmptyCard(pc) {
        return `
            <div class="pc-card" onclick="BukaModal.open('${pc.kode}')">
                <div class="pc-header">
                    <span class="pc-kode">${pc.kode}</span>
                    <span class="pc-status"></span>
                </div>
                <div class="pc-info">${pc.nama}</div>
                <div class="pc-info"><span class="pc-ip">${pc.ip_address || 'No IP'}</span></div>
                <div class="pc-grup">${pc.grup}</div>
                <div class="btn-row">
                    <button class="btn primary" style="width:100%">Buka Guest</button>
                </div>
            </div>
        `;
    },

    renderEmpty() {
        return `
            <div class="btn-row">
                <button class="btn primary" style="width:100%">Buka Guest</button>
            </div>
        `;
    },

    async stop(sesiId) {
        if (!confirm('Yakin tutup sesi ini?')) return;

        try {
            await API.call('/kasir/tutup/' + sesiId, { method: 'POST', body: {} });
            Toast.success('Sesi ditutup');
            this.load();
        } catch (e) {
            Toast.error(e.message);
        }
    },

    async tambah(sesiId) {
        TambahModal.open(sesiId);
    },

    async updateStats() {
        try {
            const r = await API.call('/kasir/laporan-harian');
            document.getElementById('stat-active').textContent = r.sesi_aktif;
            document.getElementById('stat-income').textContent = r.total_pendapatan.toLocaleString('id-ID');
        } catch (e) {
            console.error('Stats error:', e);
        }
    },

    adjustRefreshRate(activeCount) {
        // Kalau banyak yang aktif, refresh lebih sering
        const interval = activeCount > 0 ? 3000 : 10000; // 3 detik vs 10 detik

        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = setInterval(() => {
            if (App.currentTab === 'dash') this.load();
        }, interval);
    },

    startAutoRefresh() {
        this.load(); // Load pertama
    }
};