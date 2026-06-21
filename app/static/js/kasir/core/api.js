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
            if (!res.ok) {
                // Session expired atau IP block — redirect ke login (kecuali endpoint auth)
                if ((res.status === 401 || res.status === 403) && !url.includes('/api/v1/kasir/auth/login') && !url.includes('/api/v1/kasir/auth/check')) {
                    window.location.href = '/kasir/login';
                    return;
                }
                throw new Error(data.error || `HTTP ${res.status}`);
            }
            return data;
        } catch (err) {
            console.error(`API Error [${url}]:`, err);
            throw err;
        }
    },

    // 🔗 AUTH KASIR
    auth: {
        login: (u, p) => API.request('/api/v1/kasir/auth/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) }),
        logout: () => API.request('/api/v1/kasir/auth/logout', { method: 'POST' }),
        check: () => API.request('/api/v1/kasir/auth/check')
    },

    // 🔗 DASHBOARD
    dashboard: {
        // Mengambil data PC yang sudah dikelompokkan berdasarkan grup
        pcList: () => API.request('/api/v1/kasir/dashboard/pc')
    },

    // 🟢 KELOLA GRUP (Baru ditambahkan agar FE dinamis)
    grup: {
        list: () => API.request('/api/v1/kasir/grup/'),
        create: (data) => API.request('/api/v1/kasir/grup/', { method: 'POST', body: JSON.stringify(data) }),
        delete: (id) => API.request(`/api/v1/kasir/grup/${id}`, { method: 'DELETE' })
    },

    // 🔗 KELOLA USER (Admin/Kasir)
    user: {
        list: () => API.request('/api/v1/kasir/user/'),
        get: (id) => API.request(`/api/v1/kasir/user/${id}`),
        create: (data) => API.request('/api/v1/kasir/user/', { method: 'POST', body: JSON.stringify(data) }),
        update: (id, data) => API.request(`/api/v1/kasir/user/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id) => API.request(`/api/v1/kasir/user/${id}`, { method: 'DELETE' })
    },

    // 🔗 KELOLA MEMBER
    member: {
        list: (params = {}) => {
            const q = new URLSearchParams();
            if (params.q) q.append('q', params.q);
            if (params.grup_id) q.append('grup_id', params.grup_id);
            if (params.page) q.append('page', params.page);
            if (params.per_page) q.append('per_page', params.per_page);
            const url = '/api/v1/kasir/member/' + (q.toString() ? `?${q}` : '');
            return API.request(url);
        },
        get: id => API.request(`/api/v1/kasir/member/${id}`),
        getPaket: (memberId) => API.request(`/api/v1/kasir/member/${memberId}/paket`),
        create: data => API.request('/api/v1/kasir/member/', { method: 'POST', body: JSON.stringify(data) }),
        update: (id, data) => API.request(`/api/v1/kasir/member/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: id => API.request(`/api/v1/kasir/member/${id}`, { method: 'DELETE' }),
        tambahWaktu: (memberId, paketIdOrPayload, qty = 1) => {
            if (paketIdOrPayload && typeof paketIdOrPayload === 'object') {
                return API.request('/api/v1/kasir/member/tambah-waktu', { method: 'POST', body: JSON.stringify(paketIdOrPayload) });
            }
            return API.request('/api/v1/kasir/member/tambah-waktu', { method: 'POST', body: JSON.stringify({ member_id: memberId, paket_id: paketIdOrPayload, qty }) });
        },
        refundPaket: (memberId, transaksiId) => API.request('/api/v1/kasir/member/refund-paket', {
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
            const url = '/api/v1/kasir/paket/' + (queryString ? `?${queryString}` : '');
            return API.request(url);
        },
        create: data => API.request('/api/v1/kasir/paket/', { method: 'POST', body: JSON.stringify(data) }),
        update: (id, data) => API.request(`/api/v1/kasir/paket/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: id => API.request(`/api/v1/kasir/paket/${id}`, { method: 'DELETE' })
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
            const url = '/api/v1/kasir/pc/' + (queryString ? `?${queryString}` : '');
            return API.request(url);
        },
        create: data => API.request('/api/v1/kasir/pc/', { method: 'POST', body: JSON.stringify(data) }),
        update: (id, data) => API.request(`/api/v1/kasir/pc/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: id => API.request(`/api/v1/kasir/pc/${id}`, { method: 'DELETE' }),
        batch: data => API.request('/api/v1/kasir/pc/batch', { method: 'POST', body: JSON.stringify(data) }),
        wol: (pcIds) => API.request('/api/v1/kasir/pc/wol', { method: 'POST', body: JSON.stringify({ pc_ids: pcIds }) }),
        wolMac: (macAddresses) => API.request('/api/v1/kasir/pc/wol', { method: 'POST', body: JSON.stringify({ mac_addresses: macAddresses }) })
    },

    // 🔗 LOGIKA SESI (GUEST & MEMBER)
    sesi: {
        bukaGuest: (pcKode, paketId, namaGuest) => API.request('/api/v1/kasir/sesi/buka-guest', { method: 'POST', body: JSON.stringify({ pc_kode: pcKode, paket_id: paketId, nama_guest: namaGuest }) }),
        bukaMember: (pcKode, username) => API.request('/api/v1/kasir/sesi/buka-member', { method: 'POST', body: JSON.stringify({ pc_kode: pcKode, username }) }),
        tambahWaktu: (sesiId, paketIdOrPayload, qty = 1) => {
            if (paketIdOrPayload && typeof paketIdOrPayload === 'object') {
                return API.request(`/api/v1/kasir/sesi/tambah-waktu-sesi/${sesiId}`, { method: 'POST', body: JSON.stringify(paketIdOrPayload) });
            }
            return API.request(`/api/v1/kasir/sesi/tambah-waktu-sesi/${sesiId}`, { method: 'POST', body: JSON.stringify({ paket_id: paketIdOrPayload, qty }) });
        },
        tutup: sesiId => API.request(`/api/v1/kasir/sesi/tutup/${sesiId}`, { method: 'POST' }),
        pindahPC: (sesiId, pcKodeBaru) => API.request(`/api/v1/kasir/sesi/pindah-pc/${sesiId}`, { method: 'POST', body: JSON.stringify({ pc_kode_baru: pcKodeBaru }) }),
        detail: sesiId => API.request(`/api/v1/kasir/sesi/sesi/${sesiId}`)
    },

    // 🔗 LAPORAN & LOG
    report: {
        harian: () => API.request('/api/v1/kasir/report/'),
        byTanggal: (tanggal, kasirId = '', page = 1, perPage = 10) => {
            let url = `/api/v1/kasir/report/laporan/billing?tanggal=${tanggal}&page=${page}&per_page=${perPage}`;
            if (kasirId) url += `&kasir_id=${kasirId}`;
            return API.request(url);
        },
        kantinByTanggal: (tanggal, kasirId = '', page = 1, perPage = 12) => {
            let url = `/api/v1/kasir/report/laporan/kantin?tanggal=${tanggal}&page=${page}&per_page=${perPage}`;
            if (kasirId) url += `&kasir_id=${kasirId}`;
            return API.request(url);
        },
        tanggalList: () => API.request('/api/v1/kasir/report/tanggal'),
        kasirList: () => API.request('/api/v1/kasir/report/kasir-list'),
        strukMenu: (tMenuId) => API.request(`/api/v1/kasir/report/struk/menu/${tMenuId}`),
        logs: (filter = '', limit = 500, kategori = '') => {
            const q = new URLSearchParams();
            if (filter) q.append('filter', filter);
            if (limit) q.append('limit', limit);
            if (kategori) q.append('kategori', kategori);
            return API.request(`/api/v1/kasir/report/log?${q}`);
        },
        clearLogs: () => API.request('/api/v1/kasir/report/log/clear', { method: 'POST' }),
        clearTransactions: () => API.request('/api/v1/kasir/report/transaksi/clear', { method: 'POST' }),
        deleteTransaction: (id) => API.request(`/api/v1/kasir/report/transaksi/${id}`, { method: 'DELETE' }),
        deleteByDate: (tanggal) => API.request(`/api/v1/kasir/report/transaksi/by-date/${tanggal}`, { method: 'DELETE' }),
        exportLogsUrl: (filter = '') => {
            let url = '/api/v1/kasir/report/log/export';
            if (filter) url += `?filter=${encodeURIComponent(filter)}`;
            return url;
        }
    },

    // 🖥️ HARDWARE MONITOR
    monitor: {
        all: () => API.request('/api/v1/public/monitor/all'),
        delete: (id) => API.request(`/api/v1/public/monitor/${id}`, { method: 'DELETE' })
    },

    // ⚡ BLACKOUT (MANUAL)
    blackout: {
        deteksi: (threshold) => API.request('/api/v1/kasir/blackout/deteksi', { method: 'POST', body: JSON.stringify({ threshold_menit: threshold }) }),
        list: (date) => API.request(`/api/v1/kasir/blackout/list${date ? '?date=' + date : ''}`),
        dates: () => API.request('/api/v1/kasir/blackout/dates'),
        resolveMember: (sesiId) => API.request(`/api/v1/kasir/blackout/resolve/member/${sesiId}`, { method: 'POST' }),
        resolveGuestLanjut: (sesiId, pcBaru) => API.request(`/api/v1/kasir/blackout/resolve/guest/lanjut/${sesiId}`, { method: 'POST', body: JSON.stringify({ pc_baru_id: pcBaru }) }),
        resolveGuestTutup: (sesiId) => API.request(`/api/v1/kasir/blackout/resolve/guest/tutup/${sesiId}`, { method: 'POST' }),
        resolveGuestSama: (sesiId) => API.request(`/api/v1/kasir/blackout/resolve/guest/sama/${sesiId}`, { method: 'POST' }),
        clearResolved: (date) => API.request('/api/v1/kasir/blackout/clear', { method: 'POST', body: JSON.stringify({ date }) }),
        forceAllAndDetect: () => API.request('/api/v1/kasir/blackout/force-all-and-detect', { method: 'POST' }),
    },

    settings: {
        getAll: () => API.request('/api/v1/kasir/settings/'),
        updateAutoShutdown: (timerSeconds) => API.request('/api/v1/kasir/settings/auto-shutdown', {
            method: 'PUT',
            body: JSON.stringify({ timer_seconds: timerSeconds })
        }),
        manualBackup: () => API.request('/api/v1/kasir/settings/backup/manual', {
            method: 'POST'
        }),
    },

    // 🔗 KANTIN / POS F&B
    menu: {
        list: () => API.request('/api/v1/kasir/menu/'),
        create: (formData) => API.request('/api/v1/kasir/menu/', { method: 'POST', body: formData }),
        update: (id, formData) => API.request(`/api/v1/kasir/menu/${id}`, { method: 'PUT', body: formData }),
        delete: (id) => API.request(`/api/v1/kasir/menu/${id}`, { method: 'DELETE' }),
        deletePermanent: (id) => API.request(`/api/v1/kasir/menu/${id}/permanent`, { method: 'DELETE' }),
        checkout: (cartItems, pcKode = null, tunai = 0, kembalian = 0) => API.request('/api/v1/kasir/menu/checkout', {
            method: 'POST',
            body: JSON.stringify({ cart_items: cartItems, pc_kode: pcKode, tunai, kembalian })
        }),
        transaksi: () => API.request('/api/v1/kasir/menu/transaksi')
    }

};

// Session polling — jalan langsung, gak perlu nunggu DOM
(function () {
    var sessionInterval = setInterval(function () {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/api/v1/kasir/auth/check', true);
        xhr.withCredentials = true;
        xhr.onload = function () {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (!data.logged_in) {
                        window.location.href = '/kasir/login';
                    }
                } catch (e) {
                    window.location.href = '/kasir/login';
                }
            }
        };
        xhr.onerror = function () {
            window.location.href = '/kasir/login';
        };
        xhr.send();
    }, 5000);
})();

// Pastikan object API bisa diakses secara global oleh file JS lainnya
window.API = API;