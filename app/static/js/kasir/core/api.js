// static/js/kasir/core/api.js

const API = {
    base: '',
    async request(url, options = {}) {
        try {
            const method = (options.method || 'GET').toUpperCase();
            const headers = { ...options.headers };
            
            if (!(options.body instanceof FormData)) {
                headers['Content-Type'] = 'application/json';
            }

            // Tambahkan CSRF Token untuk metode yang mengubah data
            if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
                const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
                if (csrfToken) {
                    headers['X-CSRFToken'] = csrfToken;
                }
            }

            const res = await fetch(this.base + url, {
                ...options,
                method,
                headers,
                credentials: 'include'
            });
            const txt = await res.text();
            let data;
            try { data = JSON.parse(txt); } catch (e) { data = { error: txt }; }
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            return data;
        } catch (err) {
            console.error(`API Error [${url}]:`, err);
            throw err;
        }
    },

    // 🔗 AUTH KASIR
    auth: {
        login: (u, p) => API.request('/api/kasir/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) }),
        logout: () => API.request('/api/kasir/logout', { method: 'POST' }),
        check: () => API.request('/api/kasir/check')
    },

    // 🔗 DASHBOARD
    dashboard: {
        // Mengambil data PC yang sudah dikelompokkan berdasarkan grup
        pcList: () => API.request('/kasir/api/pc')
    },

    // 🟢 KELOLA GRUP (Baru ditambahkan agar FE dinamis)
    grup: {
        list: () => API.request('/api/grup/'),
        create: (data) => API.request('/api/grup/', { method: 'POST', body: JSON.stringify(data) }),
        delete: (id) => API.request(`/api/grup/${id}`, { method: 'DELETE' })
    },

    // 🔗 KELOLA USER (Admin/Kasir)
    user: {
        list: () => API.request('/api/user/'),
        get: (id) => API.request(`/api/user/${id}`),
        create: (data) => API.request('/api/user/', { method: 'POST', body: JSON.stringify(data) }),
        update: (id, data) => API.request(`/api/user/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id) => API.request(`/api/user/${id}`, { method: 'DELETE' })
    },

    // 🔗 KELOLA MEMBER
    member: {
        list: (params = {}) => {
            const q = new URLSearchParams();
            if (params.q) q.append('q', params.q);
            if (params.grup_id) q.append('grup_id', params.grup_id);
            if (params.page) q.append('page', params.page);
            if (params.per_page) q.append('per_page', params.per_page);
            const url = '/api/member' + (q.toString() ? `?${q}` : '');
            return API.request(url);
        },
        get: id => API.request(`/api/member/${id}`),
        getPaket: (memberId) => API.request(`/api/member/${memberId}/paket`),
        create: data => API.request('/api/member', { method: 'POST', body: JSON.stringify(data) }),
        update: (id, data) => API.request(`/api/member/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: id => API.request(`/api/member/${id}`, { method: 'DELETE' }),
        tambahWaktu: (memberId, paketIdOrPayload, qty = 1) => {
            if (paketIdOrPayload && typeof paketIdOrPayload === 'object') {
                return API.request('/api/tambah-waktu', { method: 'POST', body: JSON.stringify(paketIdOrPayload) });
            }
            return API.request('/api/tambah-waktu', { method: 'POST', body: JSON.stringify({ member_id: memberId, paket_id: paketIdOrPayload, qty }) });
        },
        refundPaket: (memberId, transaksiId) => API.request('/api/member/refund-paket', {
            method: 'POST',
            body: JSON.stringify({ member_id: memberId, transaksi_id: transaksiId })
        }),
    },

    // 🔗 KELOLA PAKET
    paket: {
        list: (params = {}) => {
            const q = new URLSearchParams();
            if (params.aktif_only) q.append('aktif', 'true');
            if (params.grup) q.append('grup', params.grup);
            if (params.grup_id) q.append('grup_id', params.grup_id);
            if (params.q) q.append('q', params.q);
            if (params.page) q.append('page', params.page);
            if (params.per_page) q.append('per_page', params.per_page);

            const queryString = q.toString();
            const url = '/api/paket/' + (queryString ? `?${queryString}` : '');
            return API.request(url);
        },
        create: data => API.request('/api/paket/', { method: 'POST', body: JSON.stringify(data) }),
        update: (id, data) => API.request(`/api/paket/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: id => API.request(`/api/paket/${id}`, { method: 'DELETE' })
    },

    // 🔗 KELOLA PC
    pc: {
        list: (params = {}) => {
            const q = new URLSearchParams();
            if (params.q) q.append('q', params.q);
            if (params.grup_id) q.append('grup_id', params.grup_id);
            if (params.page) q.append('page', params.page);
            if (params.per_page) q.append('per_page', params.per_page);

            const queryString = q.toString();
            const url = '/api/pc' + (queryString ? `?${queryString}` : '');
            return API.request(url);
        },
        create: data => API.request('/api/pc', { method: 'POST', body: JSON.stringify(data) }),
        update: (id, data) => API.request(`/api/pc/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: id => API.request(`/api/pc/${id}`, { method: 'DELETE' }),
        batch: data => API.request('/api/pc/batch', { method: 'POST', body: JSON.stringify(data) }),
        wol: (pcIds) => API.request('/api/pc/wol', { method: 'POST', body: JSON.stringify({ pc_ids: pcIds }) }),
        wolMac: (macAddresses) => API.request('/api/pc/wol', { method: 'POST', body: JSON.stringify({ mac_addresses: macAddresses }) })
    },

    // 🔗 LOGIKA SESI (GUEST & MEMBER)
    sesi: {
        bukaGuest: (pcKode, paketId, namaGuest) => API.request('/api/sesi/buka-guest', { method: 'POST', body: JSON.stringify({ pc_kode: pcKode, paket_id: paketId, nama_guest: namaGuest }) }),
        bukaMember: (pcKode, username) => API.request('/api/sesi/buka-member', { method: 'POST', body: JSON.stringify({ pc_kode: pcKode, username }) }),
        tambahWaktu: (sesiId, paketIdOrPayload, qty = 1) => {
            if (paketIdOrPayload && typeof paketIdOrPayload === 'object') {
                return API.request(`/api/sesi/tambah-waktu-sesi/${sesiId}`, { method: 'POST', body: JSON.stringify(paketIdOrPayload) });
            }
            return API.request(`/api/sesi/tambah-waktu-sesi/${sesiId}`, { method: 'POST', body: JSON.stringify({ paket_id: paketIdOrPayload, qty }) });
        },
        tutup: sesiId => API.request(`/api/sesi/tutup/${sesiId}`, { method: 'POST' }),
        pindahPC: (sesiId, pcKodeBaru) => API.request(`/api/sesi/pindah-pc/${sesiId}`, { method: 'POST', body: JSON.stringify({ pc_kode_baru: pcKodeBaru }) }),
        detail: sesiId => API.request(`/api/sesi/sesi/${sesiId}`)
    },

    // 🔗 LAPORAN & LOG
    report: {
        harian: () => API.request('/api/report/laporan-harian'),
        byTanggal: (tanggal, kasirId = '', page = 1, perPage = 10) => {
            let url = `/api/report/laporan?tanggal=${tanggal}&page=${page}&per_page=${perPage}`;
            if (kasirId) url += `&kasir_id=${kasirId}`;
            return API.request(url);
        },
        tanggalList: () => API.request('/api/report/tanggal'),
        kasirList: () => API.request('/api/report/kasir-list'),
        strukMenu: (tMenuId) => API.request(`/api/report/struk/menu/${tMenuId}`),
        logs: (filter = '', limit = 500, kategori = '') => {
            const q = new URLSearchParams();
            if (filter) q.append('filter', filter);
            if (limit) q.append('limit', limit);
            if (kategori) q.append('kategori', kategori);
            return API.request(`/api/report/log?${q}`);
        },
        clearLogs: () => API.request('/api/report/log/clear', { method: 'POST' }),
        clearTransactions: () => API.request('/api/report/transaksi/clear', { method: 'POST' }),
        deleteTransaction: (id) => API.request(`/api/report/transaksi/${id}`, { method: 'DELETE' }),
        deleteByDate: (tanggal) => API.request(`/api/report/transaksi/by-date/${tanggal}`, { method: 'DELETE' }),
        exportLogsUrl: (filter = '') => {
            let url = '/api/report/log/export';
            if (filter) url += `?filter=${encodeURIComponent(filter)}`;
            return url;
        }
    },

    // 🖥️ HARDWARE MONITOR
    monitor: {
        all: () => API.request('/api/monitor/all'),
        delete: (id) => API.request(`/api/monitor/${id}`, { method: 'DELETE' })
    },

    // ⚡ BLACKOUT (MANUAL)
    blackout: {
        deteksi: (threshold) => API.request('/api/blackout/deteksi', { method: 'POST', body: JSON.stringify({ threshold_menit: threshold }) }),
        list: (date) => API.request(`/api/blackout/list${date ? '?date=' + date : ''}`),
        dates: () => API.request('/api/blackout/dates'),
        resolveMember: (sesiId) => API.request(`/api/blackout/resolve/member/${sesiId}`, { method: 'POST' }),
        resolveGuestLanjut: (sesiId, pcBaru) => API.request(`/api/blackout/resolve/guest/lanjut/${sesiId}`, { method: 'POST', body: JSON.stringify({ pc_baru_id: pcBaru }) }),
        resolveGuestTutup: (sesiId) => API.request(`/api/blackout/resolve/guest/tutup/${sesiId}`, { method: 'POST' }),
        resolveGuestSama: (sesiId) => API.request(`/api/blackout/resolve/guest/sama/${sesiId}`, { method: 'POST' }),
        clearResolved: (date) => API.request('/api/blackout/clear', { method: 'POST', body: JSON.stringify({ date }) }),
        forceAllAndDetect: () => API.request('/api/blackout/force-all-and-detect', { method: 'POST' }),
    },

    settings: {
        getAll: () => API.request('/api/settings'),
        updateAutoShutdown: (timerSeconds) => API.request('/api/settings/auto-shutdown', {
            method: 'PUT',
            body: JSON.stringify({ timer_seconds: timerSeconds })
        }),
        manualBackup: () => API.request('/api/settings/backup/manual', {
            method: 'POST'
        }),
    },

    // 🔗 KANTIN / POS F&B
    menu: {
        list: () => API.request('/api/menu'),
        create: (formData) => API.request('/api/menu', { method: 'POST', body: formData }),
        update: (id, formData) => API.request(`/api/menu/${id}`, { method: 'PUT', body: formData }),
        delete: (id) => API.request(`/api/menu/${id}`, { method: 'DELETE' }),
        deletePermanent: (id) => API.request(`/api/menu/${id}/permanent`, { method: 'DELETE' }),
        checkout: (cartItems, pcKode = null, tunai = 0, kembalian = 0) => API.request('/api/menu/checkout', {
            method: 'POST',
            body: JSON.stringify({ cart_items: cartItems, pc_kode: pcKode, tunai, kembalian })
        }),
        transaksi: () => API.request('/api/menu/transaksi')
    }

};

// Pastikan object API bisa diakses secara global oleh file JS lainnya
window.API = API;