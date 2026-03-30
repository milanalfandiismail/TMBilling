// app/static/js/kasir/buka-modal.js

const BukaModal = {
    paketList: [],

    async init() {
        await this.loadPaket();
        Modals.init();
    },

    async loadPaket() {
        try {
            const data = await API.call('/paket/?aktif=true');
            this.paketList = data.paket;

            const opts = data.paket.map(p =>
                `<option value="${p.id}">${p.nama} - ${Utils.formatRupiah(p.harga)} (${p.durasi_menit}m)</option>`
            ).join('');

            document.getElementById('buka-paket').innerHTML = opts;
        } catch (e) {
            console.error('Load paket failed:', e);
        }
    },

    open(pcKode) {
        document.getElementById('buka-pc-kode').value = pcKode;
        document.getElementById('buka-guest').value = 'Guest';
        Modals.open('mod-buka');
    },

    async submit() {
        try {
            const pc = document.getElementById('buka-pc-kode').value;
            const paket = parseInt(document.getElementById('buka-paket').value);
            const namaGuest = document.getElementById('buka-guest').value.trim() || 'Guest';

            const body = {
                pc_kode: pc,
                paket_id: paket,
                nama_guest: namaGuest
            };

            await API.call('/kasir/buka-guest', { method: 'POST', body });

            Toast.success('Sesi Guest dibuka');
            Modals.close('mod-buka');
            Dashboard.load();
        } catch (e) {
            Toast.error(e.message);
        }
    }
};