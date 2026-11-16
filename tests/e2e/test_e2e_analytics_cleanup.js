/**
 * E2E: analitik paket mengabaikan baris siklus hidup (paket_id NULL) dan guard
 * hapus riwayat tanggal menolak selama ada sesi aktif.
 *
 * Baris `tutup_sesi`/`pindah_pc` tidak punya paket; sebelumnya baris itu muncul
 * sebagai "Paket dihapus" dan menambah penyebut refund rate.
 */
const assert = require('assert');
const { login, check, unique, tab, waitFor } = require('./lib/harness');
const { dbQuery } = require('./lib/db');
const { createReport, finish } = require('./lib/report');

/** Tanggal kalender lokal sesuai zona waktu aplikasi (seed: Asia/Jakarta). */
function todayLocal() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

async function http(page, method, url, body) {
    return page.evaluate(async ({ method, url, body }) => {
        const headers = {};
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        const csrf = document.querySelector('meta[name="csrf-token"]');
        if (csrf) headers['X-CSRFToken'] = csrf.getAttribute('content');
        const res = await fetch(url, {
            method,
            headers,
            credentials: 'include',
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const text = await res.text();
        let json = null;
        try { json = JSON.parse(text); } catch (e) { /* respons non-JSON */ }
        return { status: res.status, json, text };
    }, { method, url, body });
}

async function bukaGuest(page, pcKode, paketId) {
    return http(page, 'POST', '/api/v1/kasir/sesi/buka-guest', {
        pc_kode: pcKode,
        paket_id: paketId,
        nama_guest: unique('e2e-guest'),
    });
}

async function runAnalyticsCleanupE2ETest(page) {
    const report = createReport('analytics_cleanup');
    const today = todayLocal();
    const [paket1] = await dbQuery("SELECT id FROM paket WHERE nama = 'Uji 1 Menit'");

    await login(page, 'admin');
    const shift = await http(page, 'POST', '/api/v1/kasir/shift/start', { modal_awal: 100000 });
    assert.ok([200, 201].includes(shift.status), shift.text);

    const buka = await bukaGuest(page, 'PC-02', paket1.id);
    assert.strictEqual(buka.status, 201, buka.text);
    const tutup = await http(page, 'POST', `/api/v1/kasir/sesi/tutup/${buka.json.sesi_id}`);
    assert.strictEqual(tutup.status, 200, tutup.text);

    await check(report, 'Top Paket dan refund rate mengabaikan transaksi tanpa paket', async () => {
        const res = await http(page, 'GET', `/api/v1/kasir/dashboard/analytics?start=${today}&end=${today}`);
        assert.strictEqual(res.status, 200, res.text);
        const labels = (res.json.data.top_paket && res.json.data.top_paket.labels) || [];
        assert.ok(!JSON.stringify(labels).includes('Paket dihapus'), `label mengandung Paket dihapus: ${JSON.stringify(labels)}`);

        const [{ n }] = await dbQuery(
            "SELECT COUNT(*) AS n FROM transaksi WHERE paket_id IS NOT NULL AND is_refunded = 0 AND jenis != 'refund_paket'"
        );
        assert.strictEqual(res.json.data.refund_rate.total, n,
            `penyebut refund rate ${res.json.data.refund_rate.total} != pembelian ${n}`);
    });

    await check(report, 'Kartu Paket Terlaris di tab analytics tidak menampilkan Paket dihapus', async () => {
        await tab(page, 'analytics');
        await waitFor(page, () => document.body.innerText.includes('Paket'), { label: 'kartu analitik tampil' });
        const text = await page.evaluate(() => document.body.innerText);
        assert.ok(!text.includes('Paket dihapus'), 'UI menampilkan label Paket dihapus');
    });

    await check(report, 'Hapus riwayat tanggal ditolak saat sesi aktif, berhasil setelah ditutup', async () => {
        const sesi = await bukaGuest(page, 'PC-03', paket1.id);
        assert.strictEqual(sesi.status, 201, sesi.text);

        const ditolak = await http(page, 'DELETE', `/api/v1/kasir/report/transaksi/by-date/${today}`);
        assert.strictEqual(ditolak.status, 400, ditolak.text);
        assert.ok(String(ditolak.json && ditolak.json.error).includes('Tutup semua sesi aktif'), ditolak.text);

        const tutupSesi = await http(page, 'POST', `/api/v1/kasir/sesi/tutup/${sesi.json.sesi_id}`);
        assert.strictEqual(tutupSesi.status, 200, tutupSesi.text);

        const dihapus = await http(page, 'DELETE', `/api/v1/kasir/report/transaksi/by-date/${today}`);
        assert.strictEqual(dihapus.status, 200, dihapus.text);
        const [{ n }] = await dbQuery('SELECT COUNT(*) AS n FROM transaksi WHERE date(dibuat_pada) = ?', [today]);
        assert.strictEqual(n, 0, `masih ada ${n} transaksi pada ${today}`);
    });

    return finish(report);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runAnalyticsCleanupE2ETest };
}

