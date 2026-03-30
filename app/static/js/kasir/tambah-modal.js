// app/static/js/kasir/tambah-modal.js

const TambahModal = {
    async init() {
        // Pakai paket list dari BukaModal
    },
    
    open(sesiId) {
        document.getElementById('tambah-sesi-id').value = sesiId;
        
        // Copy options dari buka-paket
        const opts = document.getElementById('buka-paket').innerHTML;
        document.getElementById('tambah-paket').innerHTML = opts;
        
        Modals.open('mod-tambah');
    },
    
    async submit() {
        try {
            const sesi = parseInt(document.getElementById('tambah-sesi-id').value);
            const paket = parseInt(document.getElementById('tambah-paket').value);
            
            await API.call('/kasir/tambah-waktu/' + sesi, { 
                method: 'POST', 
                body: { paket_id: paket } 
            });
            
            Toast.success('Waktu ditambah');
            Modals.close('mod-tambah');
            Dashboard.load();
        } catch (e) {
            Toast.error(e.message);
        }
    }
};