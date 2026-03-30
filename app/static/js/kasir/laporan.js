// app/static/js/kasir/laporan.js

const Laporan = {
    async load() {
        try {
            const r = await API.call('/kasir/laporan-harian');
            this.render(r);
        } catch (e) {
            Toast.error('Gagal load laporan');
        }
    },
    
    render(r) {
        document.getElementById('laporan-area').innerHTML = `
            <div class="pc-grid" style="grid-template-columns: repeat(3, 1fr); max-width: 600px;">
                <div class="pc-card" style="text-align:center; cursor:default;">
                    <div style="font-size: 24px; font-weight:700; margin-bottom:4px;">
                        ${Utils.formatRupiah(r.total_pendapatan)}
                    </div>
                    <div class="pc-grup">Pendapatan</div>
                </div>
                <div class="pc-card" style="text-align:center; cursor:default;">
                    <div style="font-size: 24px; font-weight:700; margin-bottom:4px;">
                        ${r.total_sesi}
                    </div>
                    <div class="pc-grup">Total Sesi</div>
                </div>
                <div class="pc-card" style="text-align:center; cursor:default;">
                    <div style="font-size: 24px; font-weight:700; margin-bottom:4px;">
                        ${r.sesi_aktif}
                    </div>
                    <div class="pc-grup">Aktif</div>
                </div>
            </div>
        `;
    }
};