// app/static/js/kasir/paket-manager.js

const PaketManager = {
    async load() {
        try {
            const data = await API.call('/paket/?aktif=false');
            this.render(data.paket);
        } catch (e) {
            Toast.error('Gagal load paket');
        }
    },

    render(pakets) {
        document.getElementById('paket-table').innerHTML = `
            <table style="width:100%">
                <thead>
                    <tr>
                        <th>Nama</th>
                        <th>Durasi</th>
                        <th>Harga</th>
                        <th>Kadaluarsa</th>
                        <th>Status</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    ${pakets.map(p => `
                        <tr style="${p.aktif ? '' : 'opacity:0.4'}">
                            <td style="font-weight:600">${p.nama}</td>
                            <td>${Utils.formatDuration(p.durasi_menit)}</td>
                            <td>${Utils.formatRupiah(p.harga)}</td>
                            <td>${p.kadaluarsa_hari} hari</td>
                            <td>${p.aktif ? '✅ Aktif' : '❌ Nonaktif'}</td>
                            <td>
                                <button class="btn stop" onclick="PaketManager.del(${p.id})">Hapus</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    async add() {
        const kadaluarsa = parseInt(document.getElementById('inp-paket-kadaluarsa').value);

        // Validasi minimal 1 hari
        if (kadaluarsa < 1) {
            Toast.error('Kadaluarsa minimal 1 hari');
            return;
        }

        try {
            const body = {
                nama: document.getElementById('inp-paket-nama').value,
                durasi_menit: parseInt(document.getElementById('inp-paket-durasi').value),
                harga: parseInt(document.getElementById('inp-paket-harga').value),
                kadaluarsa_hari: kadaluarsa
            };

            await API.call('/paket/', { method: 'POST', body });
            Toast.success('Paket ditambah');

            // Clear form
            document.getElementById('inp-paket-nama').value = '';
            document.getElementById('inp-paket-durasi').value = '';
            document.getElementById('inp-paket-harga').value = '';
            document.getElementById('inp-paket-kadaluarsa').value = 30;

            this.load();
            BukaModal.loadPaket(); // Refresh dropdown
        } catch (e) {
            Toast.error(e.message);
        }
    },

    async del(id) {
        if (!confirm('Hapus paket ini?')) return;

        try {
            const r = await API.call('/paket/' + id, { method: 'DELETE' });

            if (r.soft_deleted) {
                Toast.success('Paket dinonaktifkan (sudah pernah dipakai)');
            } else {
                Toast.success('Paket dihapus');
            }

            this.load();
            BukaModal.loadPaket();
        } catch (e) {
            Toast.error(e.message);
        }
    }
};