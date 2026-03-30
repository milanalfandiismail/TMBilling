// app/static/js/kasir/pc-manager.js

const PCManager = {
    async load() {
        try {
            const data = await API.call('/layout/pc');
            this.render(data.pc_list);
        } catch (e) {
            Toast.error('Gagal load PC');
        }
    },
    
    render(pcs) {
        document.getElementById('pc-table').innerHTML = `
            <table>
                <tr>
                    <th>Kode</th>
                    <th>Nama</th>
                    <th>IP</th>
                    <th>Grup</th>
                    <th>Status</th>
                    <th>Aksi</th>
                </tr>
                ${pcs.map(pc => `
                    <tr>
                        <td style="font-weight:600">${pc.kode}</td>
                        <td>${pc.nama}</td>
                        <td><span class="pc-ip">${pc.ip_address || '-'}</span></td>
                        <td>${pc.grup}</td>
                        <td>${pc.status}</td>
                        <td>
                            <button class="btn stop" onclick="PCManager.del(${pc.id})" 
                                    ${pc.status === 'terpakai' ? 'disabled' : ''}>Hapus</button>
                        </td>
                    </tr>
                `).join('')}
            </table>
        `;
    },
    
    async add() {
        try {
            const body = {
                kode: document.getElementById('inp-pc-kode').value,
                nama: document.getElementById('inp-pc-nama').value,
                ip_address: document.getElementById('inp-pc-ip').value,
                grup: document.getElementById('inp-pc-grup').value
            };
            
            await API.call('/layout/pc', { method: 'POST', body });
            Toast.success('PC ditambah');
            
            // Clear
            ['inp-pc-kode', 'inp-pc-nama', 'inp-pc-ip'].forEach(id => {
                document.getElementById(id).value = '';
            });
            
            this.load();
            Dashboard.load();
        } catch (e) {
            Toast.error(e.message);
        }
    },
    
    async addBatch() {
        try {
            const body = {
                prefix: document.getElementById('inp-batch-prefix').value,
                start: parseInt(document.getElementById('inp-batch-start').value),
                end: parseInt(document.getElementById('inp-batch-end').value),
                grup: document.getElementById('inp-batch-grup').value,
                ip_base: document.getElementById('inp-batch-ip').value
            };
            
            const r = await API.call('/layout/pc/batch', { method: 'POST', body });
            Toast.success('Tambah ' + r.added + ' PC');
            
            this.load();
            Dashboard.load();
        } catch (e) {
            Toast.error(e.message);
        }
    },
    
    async del(id) {
        if (!confirm('Hapus PC ini?')) return;
        
        try {
            await API.call('/layout/pc/' + id, { method: 'DELETE' });
            Toast.success('PC dihapus');
            this.load();
            Dashboard.load();
        } catch (e) {
            Toast.error(e.message);
        }
    }
};