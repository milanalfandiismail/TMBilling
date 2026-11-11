'use strict';

/**
 * Task 5 — Billing & PC lifecycle.
 *
 * Kontrak tiap check: buktikan transisi state, baris DB, aritmatika uang,
 * hasil otorisasi, atau kontrak error. Keberadaan elemen saja bukan check.
 *
 * Literal status/jenis diambil dari app/utils/constants.py:
 *   SesiStatus.AKTIF = 'aktif', SesiStatus.SELESAI = 'selesai'
 *   TransaksiJenis.BELI_PAKET_GUEST = 'beli_paket_guest'
 *   TransaksiJenis.TAMBAH_WAKTU_GUEST = 'tambah_waktu_guest'
 */

const assert = require('assert');
const { BASE_URL, CLIENT_API_KEY, login, tab, api, clientPoll, waitFor, unique, check } = require('./lib/harness');
const { dbQuery, dbExec } = require('./lib/db');
const { createReport, finish } = require('./lib/report');

const SESI_AKTIF = 'aktif';
const SESI_SELESAI = 'selesai';
const PC_KOSONG = 'kosong';
const JENIS_BELI_GUEST = 'beli_paket_guest';
const JENIS_TAMBAH_WAKTU = 'tambah_waktu_guest';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function dbWait(sql, params, predicate, label, timeout = 5000) {
    const deadline = Date.now() + timeout;
    let rows = [];
    while (Date.now() < deadline) {
        rows = await dbQuery(sql, params);
        if (predicate(rows)) return rows;
        await sleep(100);
    }
    throw new Error(`${label} tidak terpenuhi dalam ${timeout}ms; baris terakhir: ${JSON.stringify(rows)}`);
}

async function pcByKode(kode) {
    const rows = await dbQuery('SELECT id, kode, ip_address, mac_address, grup_id FROM pc WHERE kode = ?', [kode]);
    if (rows.length !== 1) throw new Error(`PC ${kode} tidak ditemukan di DB sandbox`);
    return rows[0];
}

async function paketByNama(nama) {
    const rows = await dbQuery('SELECT id, nama, durasi_menit, harga FROM paket WHERE nama = ?', [nama]);
    if (rows.length !== 1) throw new Error(`Paket ${nama} tidak ditemukan di DB sandbox`);
    return rows[0];
}

async function refreshDashboard(page) {
    await page.evaluate(async () => {
        if (window.Dashboard && typeof Dashboard.load === 'function') await Dashboard.load();
    });
    await page.waitForSelector('.pc-card-item[data-pc-kode]', { timeout: 5000 });
}

async function dashboardTimer(page, kode) {
    return page.evaluate((k) => {
        const card = document.querySelector('.pc-card-item[data-pc-kode="' + k + '"]');
        return card ? (card.querySelector('.pc-card-timer')?.textContent || '').trim() : null;
    }, kode);
}

async function openContextMenu(page, kode) {
    const card = page.locator(`.pc-card-item[data-pc-kode="${kode}"]`);
    await card.click({ button: 'right' });
    await page.waitForSelector('#pc-context-menu', { state: 'visible', timeout: 5000 });
}

async function clickMenuItem(page, label) {
    await page.locator('#pc-context-menu button', { hasText: label }).first().click();
}

/**
 * Tombol konfirmasi dipasangi handler di dalam setTimeout, jadi klik pertama
 * bisa jatuh sebelum listener siap. Klik ulang sampai overlay-nya hilang.
 */
async function clickConfirm(page, selector) {
    await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
    for (let attempt = 0; attempt < 3; attempt++) {
        await page.click(selector);
        const deadline = Date.now() + 2000;
        while (Date.now() < deadline) {
            if (!(await page.$(selector))) return;
            await sleep(100);
        }
    }
    throw new Error(`Tombol konfirmasi ${selector} tidak merespons setelah 3 percobaan`);
}

async function pcCardText(page, kode) {
    return page.evaluate((k) => {
        const span = document.querySelector(`#pc-table span[title="${k}"]`);
        if (!span) return null;
        let node = span;
        while (node.parentElement && !node.parentElement.classList.contains('grid')) node = node.parentElement;
        return node.innerText;
    }, kode);
}

function rupiahToInt(text) {
    return Number(String(text).replace(/[^0-9]/g, ''));
}

/**
 * Buka struk dari riwayat lalu tunggu sampai thermal paper menampilkan nota
 * yang diminta (bukan sisa render localStorage).
 */
async function readReceipt(page, noNota, timeout = 5000) {
    await page.fill('#struk-search', noNota);
    await page.waitForSelector(`.struk-history-card[data-history-id="${noNota}"]`, { timeout });
    await page.click(`.struk-history-card[data-history-id="${noNota}"]`);

    const deadline = Date.now() + timeout;
    let last = null;
    while (Date.now() < deadline) {
        last = await page.evaluate((expected) => {
            const el = document.querySelector('#struk-preview .thermal-paper');
            if (!el) return null;
            const text = (el.innerText || '').replace(/\u00a0/g, ' ');
            const nota = text.match(/No\. Nota\s+(\S+)/);
            const total = text.match(/TOTAL BAYAR\s+(Rp[\d.]+)/);
            if (!nota || !total || nota[1] !== expected) return null;
            return { nota: nota[1], total: total[1] };
        }, noNota);
        if (last) return last;
        await sleep(100);
    }
    throw new Error(`Struk ${noNota} tidak tampil; render terakhir: ${JSON.stringify(last)}`);
}

/** POST emergency-login persis seperti PC klien (X-Client-Key, body token opsional). */
async function emergencyLogin(page, { ip, mac, token, username } = {}) {
    const data = { ip_address: ip, mac_address: mac };
    if (username !== undefined) data.username = username;
    if (token !== undefined) data.token = token;
    const res = await page.request.post(`${BASE_URL}/api/v1/public/client/emergency-login`, {
        headers: { 'X-Client-Key': CLIENT_API_KEY },
        data,
    });
    const body = await res.json().catch(() => ({}));
    return { ...body, http_status: res.status() };
}

/**
 * Buka tab blackout lalu render tanggal yang benar-benar memuat sesi tsb.
 * Tanggal daftar dihitung dari mulai_pada (zona tampilan), jadi cari lewat API.
 */
async function showBlackoutSesi(page, sesiId) {
    await tab(page, 'blackout');
    const dates = (await api(page, 'API.blackout.dates()')).dates || [];
    for (const date of dates) {
        const res = await api(page, `API.blackout.list(${JSON.stringify(date)})`);
        if ((res.data || []).some((s) => Number(s.id) === Number(sesiId))) {
            await page.evaluate((d) => Blackout.loadList(d), date);
            await page.waitForSelector('#blackout-table-body tr', { timeout: 5000 });
            return date;
        }
    }
    throw new Error(`sesi #${sesiId} tidak muncul di daftar blackout`);
}

function blackoutRow(page, kode) {
    return page.locator('#blackout-table-body tr', { hasText: kode }).first();
}

/**
 * App.switchTab() memanggil loadTab() tanpa await, jadi tunggu kartu analytics
 * tampil lagi (load() menyembunyikannya sinkron sebelum fetch) lalu baca KPI.
 */
async function openAnalytics(page) {
    await tab(page, 'analytics');
    await page.waitForSelector('#analytics-cards:not(.hidden)', { timeout: 5000 });
    return rupiahToInt(await page.textContent('#kpi-total-billing'));
}

async function runPCBillingLifecycleE2ETest(page) {
    const report = createReport('pc_billing');

    try {
        await login(page, 'admin');
    } catch (err) {
        for (const name of [
            'Seed PC-01 berstatus Tersedia di dashboard dan tab PC',
            'Buka sesi guest via modal dashboard: sesi aktif 60 menit + transaksi Rp5.000',
            'Polling client PC-01 mengembalikan kode PC, sisa waktu, dan nama guest',
            'Tambah waktu via modal dashboard: durasi 120 menit + transaksi Rp5.000',
            'Pindah PC: sesi aktif pindah ke PC-02 dan PC-01 kembali kosong',
            'Sesi kedaluwarsa via polling: status selesai tanpa duplikasi transaksi',
            'Tutup sesi via UI: status selesai dan total struk = total transaksi sesi',
            'Polling dengan X-Client-Key salah ditolak 401 tanpa mengubah sesi',
            'Heartbeat last_sync tersimpan maksimal 35 detik setelah polling',
            'Deteksi blackout menandai sesi basi dan menampilkan baris PC-01',
            'Resolusi guest sama menutup sesi lama dan membuka sesi dengan sisa audit',
            'Resolusi guest pindah memindahkan sisa audit ke PC-02 satu grup',
            'Deteksi blackout mengabaikan sesi dengan last_sync segar',
            'Heartbeat hanya menulis last_sync setelah jendela 30 detik',
            'Tutup blackout mencatat transaksi tutup_sesi Rp0',
            'Emergency login tanpa token ditolak 403 tanpa mengubah PC maupun sesi',
            'Emergency login bertoken menutup sesi aktif, mengaktifkan admin mode, dan mencatat audit',
            'Force-all menutup semua sesi aktif dan mencatat tutup_sesi Rp0',
            'Pendapatan analytics naik tepat sebesar transaksi pemulihan blackout',
        ]) {
            check(report, name, async () => { throw err; });
        }
        return finish(report);
    }

    const state = { guestName: null, sesiId: null, pindahSesiId: null };

    await check(report, 'Seed PC-01 berstatus Tersedia di dashboard dan tab PC', async () => {
        const pc1 = await pcByKode('PC-01');
        assert.strictEqual(pc1.ip_address, '192.168.1.11');

        await tab(page, 'dash');
        await refreshDashboard(page);

        const poll = await clientPoll(page, { ip: pc1.ip_address, mac: pc1.mac_address });
        assert.strictEqual(poll.http_status, 200, 'polling PC-01 harus 200');
        assert.strictEqual(poll.status, PC_KOSONG, 'PC-01 tanpa sesi harus berstatus kosong');

        await refreshDashboard(page);
        const timer = await dashboardTimer(page, 'PC-01');
        assert.strictEqual(timer, 'KOSONG', `kartu PC-01 harus online & kosong, bukan "${timer}"`);

        await tab(page, 'pc');
        const cardText = await pcCardText(page, 'PC-01');
        assert.ok(cardText, 'kartu PC-01 harus tampil di tab PC');
        assert.ok(/TERSEDIA/.test(cardText), `badge PC-01 harus TERSEDIA, dapat: ${cardText}`);

        assert.deepStrictEqual(
            await dbQuery('SELECT id FROM sesi WHERE pc_id = ? AND status = ?', [pc1.id, SESI_AKTIF]),
            [],
            'tidak boleh ada sesi aktif tersisa pada PC-01'
        );
    });

    await check(report, 'Buka sesi guest via modal dashboard: sesi aktif 60 menit + transaksi Rp5.000', async () => {
        const paket = await paketByNama('1 Jam Reguler');
        assert.strictEqual(paket.durasi_menit, 60);
        assert.strictEqual(paket.harga, 5000);

        await tab(page, 'dash');
        await refreshDashboard(page);
        await openContextMenu(page, 'PC-01');
        await clickMenuItem(page, 'Buka Sesi');
        await page.waitForSelector('#buka-guest', { state: 'visible', timeout: 5000 });
        await page.waitForSelector(`.paket-card[data-paket-id="${paket.id}"]`, { state: 'visible', timeout: 5000 });

        state.guestName = unique('GuestE2E');
        await page.fill('#buka-guest', state.guestName);
        await page.click(`.paket-card[data-paket-id="${paket.id}"]`);
        await page.locator('button', { hasText: 'Mulai Sesi' }).first().click();
        await clickConfirm(page, '#modal-confirm-submit-btn');

        const pc1 = await pcByKode('PC-01');
        const sesiRows = await dbWait(
            'SELECT id, pc_id, tipe, status, durasi_beli_menit, total_bayar, nama_guest FROM sesi WHERE pc_id = ? AND status = ? ORDER BY id DESC',
            [pc1.id, SESI_AKTIF],
            (rows) => rows.length === 1 && rows[0].nama_guest === state.guestName,
            'sesi guest aktif di PC-01'
        );
        const sesi = sesiRows[0];
        state.sesiId = sesi.id;

        assert.strictEqual(sesi.tipe, 'guest');
        assert.strictEqual(sesi.durasi_beli_menit, 60);
        assert.strictEqual(sesi.total_bayar, 5000);

        const trx = await dbQuery('SELECT jenis, jumlah, menit FROM transaksi WHERE sesi_id = ? ORDER BY id', [sesi.id]);
        assert.strictEqual(trx.length, 1, 'harus ada tepat 1 transaksi pembukaan');
        assert.strictEqual(trx[0].jenis, JENIS_BELI_GUEST);
        assert.strictEqual(Number(trx[0].jumlah), 5000);
        assert.strictEqual(Number(trx[0].menit), 60);

        await waitFor(page, () => !document.getElementById('buka-guest'), { label: 'modal buka sesi tertutup' });
    });

    await check(report, 'Polling client PC-01 mengembalikan kode PC, sisa waktu, dan nama guest', async () => {
        assert.ok(state.sesiId, 'prasyarat: sesi guest belum dibuat');
        const pc1 = await pcByKode('PC-01');

        const res = await clientPoll(page, { ip: pc1.ip_address, mac: pc1.mac_address });
        assert.strictEqual(res.http_status, 200);
        assert.strictEqual(res.status, 'aktif');
        assert.strictEqual(res.pc_kode, 'PC-01');
        assert.strictEqual(res.nama, state.guestName);
        assert.ok(Number.isInteger(res.sisa_waktu), `sisa_waktu harus integer, dapat ${res.sisa_waktu}`);
        assert.ok(res.sisa_waktu >= 59 && res.sisa_waktu <= 60, `sisa_waktu harus 59..60, dapat ${res.sisa_waktu}`);
    });

    await check(report, 'Tambah waktu via modal dashboard: durasi 120 menit + transaksi Rp5.000', async () => {
        assert.ok(state.sesiId, 'prasyarat: sesi guest belum dibuat');
        const paket = await paketByNama('1 Jam Reguler');

        await tab(page, 'dash');
        await refreshDashboard(page);
        await openContextMenu(page, 'PC-01');
        await clickMenuItem(page, 'Tambah Waktu');
        await page.waitForSelector(`#chk-paket-${paket.id}`, { state: 'visible', timeout: 5000 });

        await page.check(`#chk-paket-${paket.id}`);
        await page.locator('button', { hasText: 'Konfirmasi Penambahan' }).first().click();
        await clickConfirm(page, '#modal-confirm-submit-btn');

        const sesiRows = await dbWait(
            'SELECT durasi_beli_menit, total_bayar, status FROM sesi WHERE id = ?',
            [state.sesiId],
            (rows) => rows.length === 1 && rows[0].durasi_beli_menit === 120,
            'durasi sesi menjadi 120 menit'
        );
        assert.strictEqual(sesiRows[0].status, SESI_AKTIF);
        assert.strictEqual(sesiRows[0].total_bayar, 10000);

        const trx = await dbQuery('SELECT jenis, jumlah, menit FROM transaksi WHERE sesi_id = ? ORDER BY id', [state.sesiId]);
        assert.deepStrictEqual(trx.map((t) => t.jenis), [JENIS_BELI_GUEST, JENIS_TAMBAH_WAKTU]);
        assert.deepStrictEqual(trx.map((t) => Number(t.jumlah)), [5000, 5000]);
        assert.deepStrictEqual(trx.map((t) => Number(t.menit)), [60, 60]);

        await refreshDashboard(page);
        const timer = await dashboardTimer(page, 'PC-01');
        assert.ok(/^\d+j( \d+m)?$/.test(timer), `kartu PC-01 harus tetap aktif (timer), dapat "${timer}"`);
    });

    await check(report, 'Pindah PC: sesi aktif pindah ke PC-02 dan PC-01 kembali kosong', async () => {
        assert.ok(state.sesiId, 'prasyarat: sesi guest belum dibuat');
        const pc1 = await pcByKode('PC-01');
        const pc2 = await pcByKode('PC-02');

        const res = await api(page, `API.sesi.pindahPC(${state.sesiId}, "PC-02")`);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.pc_baru, 'PC-02');

        await dbWait(
            'SELECT status FROM sesi WHERE id = ?',
            [state.sesiId],
            (rows) => rows.length === 1 && rows[0].status === SESI_SELESAI,
            'sesi lama ditutup oleh pindah PC'
        );

        const aktifRows = await dbWait(
            'SELECT id, pc_id, status, sesi_asal_id FROM sesi WHERE pc_id = ? AND status = ?',
            [pc2.id, SESI_AKTIF],
            (rows) => rows.length === 1,
            'sesi aktif baru di PC-02'
        );
        state.pindahSesiId = aktifRows[0].id;
        assert.notStrictEqual(state.pindahSesiId, state.sesiId, 'pindah PC harus membuat sesi baru');
        assert.strictEqual(aktifRows[0].sesi_asal_id, state.sesiId);

        assert.deepStrictEqual(
            await dbQuery('SELECT id FROM sesi WHERE pc_id = ? AND status = ?', [pc1.id, SESI_AKTIF]),
            [],
            'PC-01 tidak boleh punya sesi aktif setelah pindah'
        );

        await refreshDashboard(page);
        const timerPc2 = await dashboardTimer(page, 'PC-02');
        assert.ok(/^\d+j( \d+m)?$/.test(timerPc2), `kartu PC-02 harus aktif, dapat "${timerPc2}"`);
        const timerPc1 = await dashboardTimer(page, 'PC-01');
        assert.ok(['KOSONG', 'OFFLINE'].includes(timerPc1), `kartu PC-01 harus kosong, dapat "${timerPc1}"`);
    });

    await check(report, 'Sesi kedaluwarsa via polling: status selesai dengan satu transaksi tutup', async () => {
        const paket = await paketByNama('Uji 1 Menit');
        assert.strictEqual(paket.durasi_menit, 1);
        assert.strictEqual(paket.harga, 1000);

        const open = await api(page, `API.sesi.bukaGuest("PC-03", ${paket.id}, "GuestExpire", "Tunai")`);
        assert.strictEqual(open.success, true);
        assert.ok(Number.isInteger(open.sesi_id), 'respons buka-guest harus memuat sesi_id');

        const before = await dbQuery('SELECT jenis, jumlah FROM transaksi WHERE sesi_id = ?', [open.sesi_id]);
        assert.strictEqual(before.length, 1);
        assert.strictEqual(Number(before[0].jumlah), 1000);

        // Sesi guest mengukur waktu dari mulai_pada (bukan waktu_mulai_sesi).
        await dbExec("UPDATE sesi SET mulai_pada = datetime(mulai_pada, '-61 minutes') WHERE id = ?", [open.sesi_id]);

        const pc3 = await pcByKode('PC-03');
        const poll = await clientPoll(page, { ip: pc3.ip_address, mac: pc3.mac_address });
        assert.strictEqual(poll.http_status, 200);
        assert.strictEqual(poll.status, PC_KOSONG, 'polling sesi habis harus mengembalikan status kosong');
        assert.strictEqual(poll.pc_kode, 'PC-03');

        const sesiRows = await dbWait(
            'SELECT status, selesai_pada FROM sesi WHERE id = ?',
            [open.sesi_id],
            (rows) => rows.length === 1 && rows[0].status === SESI_SELESAI,
            'sesi kedaluwarsa berstatus selesai'
        );
        assert.ok(sesiRows[0].selesai_pada, 'selesai_pada harus terisi');

        const after = await dbQuery('SELECT jenis, jumlah FROM transaksi WHERE sesi_id = ?', [open.sesi_id]);
        assert.strictEqual(after.length, 2, 'kedaluwarsa harus mencatat tepat satu transaksi tutup');
        assert.strictEqual(
            after.filter((t) => t.jenis === 'tutup_sesi').length,
            1,
            'transaksi tutup_sesi harus tercatat sekali'
        );
        assert.strictEqual(after.reduce((sum, t) => sum + Number(t.jumlah), 0), 1000);
    });

    await check(report, 'Tutup sesi via UI: status selesai dan total struk = total transaksi sesi', async () => {
        assert.ok(state.pindahSesiId, 'prasyarat: sesi belum dipindah ke PC-02');

        await tab(page, 'dash');
        await refreshDashboard(page);
        await openContextMenu(page, 'PC-02');
        await clickMenuItem(page, 'Tutup Sesi');
        await clickConfirm(page, '#modal-confirm-btn');

        await dbWait(
            'SELECT status, selesai_pada FROM sesi WHERE id = ?',
            [state.pindahSesiId],
            (rows) => rows.length === 1 && rows[0].status === SESI_SELESAI,
            'sesi di PC-02 berstatus selesai'
        );

        const lineage = [state.sesiId, state.pindahSesiId];
        const rows = await dbQuery(
            'SELECT no_nota, jenis, jumlah FROM transaksi WHERE sesi_id IN (?, ?) AND no_nota IS NOT NULL ORDER BY id',
            lineage
        );
        assert.strictEqual(rows.length, 2, 'harus ada 2 nota berbayar pada silsilah sesi');
        assert.ok(rows.every((r) => Number.isInteger(Number(r.jumlah))));
        const dbTotal = rows.reduce((sum, r) => sum + Number(r.jumlah), 0);
        assert.strictEqual(dbTotal, 10000, 'total transaksi silsilah sesi harus Rp10.000');

        await tab(page, 'struk');
        let uiTotal = 0;
        for (const row of rows) {
            const receipt = await readReceipt(page, row.no_nota);
            assert.strictEqual(receipt.nota, row.no_nota);
            const amount = rupiahToInt(receipt.total);
            assert.ok(Number.isInteger(amount));
            assert.strictEqual(amount, Number(row.jumlah), `total struk ${row.no_nota} harus sama dengan baris DB`);
            uiTotal += amount;
        }
        assert.strictEqual(uiTotal, dbTotal, 'jumlah struk yang dicetak harus sama dengan total transaksi sesi');
    });

    await check(report, 'Polling dengan X-Client-Key salah ditolak 401 tanpa mengubah sesi', async () => {
        const paket = await paketByNama('1 Jam Reguler');
        const open = await api(page, `API.sesi.bukaGuest("PC-04", ${paket.id}, "GuestWrongKey", "Tunai")`);
        assert.strictEqual(open.success, true);

        const pc4 = await pcByKode('PC-04');
        const bad = await clientPoll(page, {
            ip: pc4.ip_address,
            mac: pc4.mac_address,
            key: 'e2e-wrong-client-key',
        });
        assert.strictEqual(bad.http_status, 401, 'API key salah harus ditolak 401');
        assert.ok(/API Key tidak valid/.test(String(bad.error || '')), `pesan error tidak sesuai: ${bad.error}`);

        const rows = await dbQuery('SELECT status, last_sync FROM sesi WHERE id = ?', [open.sesi_id]);
        assert.strictEqual(rows.length, 1);
        assert.strictEqual(rows[0].status, SESI_AKTIF, 'sesi tidak boleh berubah oleh request tidak sah');
        assert.strictEqual(rows[0].last_sync, null, 'request tidak sah tidak boleh menulis heartbeat');
    });

    await check(report, 'Heartbeat last_sync tersimpan maksimal 35 detik setelah polling', async () => {
        const paket = await paketByNama('1 Jam Reguler');
        const open = await api(page, `API.sesi.bukaGuest("PC-05", ${paket.id}, "GuestHeartbeat", "Tunai")`);
        assert.strictEqual(open.success, true);

        const pc5 = await pcByKode('PC-05');
        const poll = await clientPoll(page, { ip: pc5.ip_address, mac: pc5.mac_address });
        assert.strictEqual(poll.http_status, 200);
        assert.strictEqual(poll.status, SESI_AKTIF);
        assert.strictEqual(poll.pc_kode, 'PC-05');

        const rows = await dbWait(
            'SELECT last_sync FROM sesi WHERE id = ?',
            [open.sesi_id],
            (r) => r.length === 1 && r[0].last_sync !== null,
            'last_sync tersimpan setelah polling',
            35000
        );
        assert.ok(rows[0].last_sync, 'last_sync tidak boleh null');
    });

    // ------------------------------------------------------------------
    // Task 12 — Blackout & emergency recovery
    // ------------------------------------------------------------------
    // Catatan prasyarat state: PC-01/02/03 kosong, PC-04 aktif tanpa last_sync,
    // PC-05 aktif dengan last_sync segar (sisa check heartbeat di atas).

    await check(report, 'Deteksi blackout menandai sesi basi dan menampilkan baris PC-01', async () => {
        // Baseline pendapatan & id transaksi diambil sebelum satu pun transaksi Task 12 dibuat.
        state.analyticsStart = await openAnalytics(page);
        state.transaksiMaxId = (await dbQuery('SELECT COALESCE(MAX(id), 0) AS maxId FROM transaksi'))[0].maxId;

        const paket = await paketByNama('1 Jam Reguler');
        const open = await api(page, `API.sesi.bukaGuest("PC-01", ${paket.id}, "GuestStale", "Tunai")`);
        assert.strictEqual(open.success, true);
        state.staleSesiId = open.sesi_id;

        // mulai_pada T-40', last_sync T-10' -> sisa audit 30 menit (bukan sisa real-time 20).
        await dbExec("UPDATE sesi SET mulai_pada = datetime(mulai_pada, '-40 minutes') WHERE id = ?", [state.staleSesiId]);
        await dbExec("UPDATE sesi SET last_sync = datetime(mulai_pada, '+30 minutes') WHERE id = ?", [state.staleSesiId]);

        // Sesi PC-05 dari check heartbeat bisa sync < 1 detik lalu;
        // mundurkan supaya hasil deteksi deterministik pada threshold 1 menit.
        const pc5 = await pcByKode('PC-05');
        const pc5Aktif = (await dbQuery('SELECT id FROM sesi WHERE pc_id = ? AND status = ?', [pc5.id, SESI_AKTIF]))[0];
        assert.ok(pc5Aktif, 'prasyarat: sesi PC-05 aktif dari check heartbeat');
        state.pc5SesiId = Number(pc5Aktif.id);
        await dbExec("UPDATE sesi SET last_sync = datetime(last_sync, '-10 minutes') WHERE id = ?", [state.pc5SesiId]);

        const deteksi = await api(page, 'API.blackout.deteksi(1)');
        assert.strictEqual(deteksi.success, true);
        assert.ok(deteksi.total >= 1, `harus ada sesi terdeteksi, dapat ${deteksi.total}`);

        const row = (await dbQuery('SELECT status, is_blackout_suspect, is_blackout_resolved, sisa_menit_saat_mati FROM sesi WHERE id = ?', [state.staleSesiId]))[0];
        assert.strictEqual(row.status, SESI_SELESAI);
        assert.strictEqual(Number(row.is_blackout_suspect), 1);
        assert.strictEqual(Number(row.is_blackout_resolved), 0);
        assert.strictEqual(Number(row.sisa_menit_saat_mati), 30);

        await showBlackoutSesi(page, state.staleSesiId);
        const text = await blackoutRow(page, 'PC-01').innerText();
        assert.ok(/GuestStale/.test(text), `baris blackout harus memuat nama guest: ${text}`);
        assert.ok(/\+30m/.test(text), `baris blackout harus memuat sisa audit 30m: ${text}`);
    });

    await check(report, 'Resolusi guest sama menutup sesi lama dan membuka sesi dengan sisa audit', async () => {
        assert.ok(state.staleSesiId, 'prasyarat: sesi blackout belum dibuat');

        await showBlackoutSesi(page, state.staleSesiId);
        await blackoutRow(page, 'PC-01').locator('button[title="Lanjutkan sesi di PC yang sama"]').click({ timeout: 5000 });
        await clickConfirm(page, '#modal-confirm-btn');

        const lama = (await dbWait(
            'SELECT status, is_blackout_resolved, waktu_resolved FROM sesi WHERE id = ?',
            [state.staleSesiId],
            (rows) => rows.length === 1 && Number(rows[0].is_blackout_resolved) === 1,
            'sesi lama ditandai resolved'
        ))[0];
        assert.strictEqual(lama.status, SESI_SELESAI);
        assert.ok(lama.waktu_resolved, 'waktu_resolved harus terisi');

        const pc1 = await pcByKode('PC-01');
        const aktif = await dbQuery(
            'SELECT id, tipe, nama_guest, durasi_beli_menit, total_bayar, sesi_asal_id FROM sesi WHERE pc_id = ? AND status = ?',
            [pc1.id, SESI_AKTIF]
        );
        assert.strictEqual(aktif.length, 1, 'PC-01 harus punya tepat satu sesi aktif');
        assert.strictEqual(aktif[0].tipe, 'guest');
        assert.strictEqual(aktif[0].nama_guest, 'GuestStale');
        assert.strictEqual(Number(aktif[0].durasi_beli_menit), 30);
        assert.strictEqual(Number(aktif[0].total_bayar), 5000);
        assert.strictEqual(Number(aktif[0].sesi_asal_id), Number(state.staleSesiId));
        const samaSesiId = Number(aktif[0].id);

        assert.deepStrictEqual(
            await dbQuery('SELECT id FROM transaksi WHERE sesi_id = ?', [samaSesiId]),
            [],
            'lanjut di PC yang sama tidak boleh membuat transaksi baru'
        );
    });

    await check(report, 'Resolusi guest pindah memindahkan sisa audit ke PC-02 satu grup', async () => {
        const paket = await paketByNama('2 Jam Reguler');
        const open = await api(page, `API.sesi.bukaGuest("PC-03", ${paket.id}, "GuestLanjut", "Tunai")`);
        assert.strictEqual(open.success, true);
        state.lanjutSesiId = open.sesi_id;

        await dbExec("UPDATE sesi SET mulai_pada = datetime(mulai_pada, '-40 minutes') WHERE id = ?", [state.lanjutSesiId]);
        await dbExec("UPDATE sesi SET last_sync = datetime(mulai_pada, '+30 minutes') WHERE id = ?", [state.lanjutSesiId]);

        // Threshold 5 menit, bukan 0: sesi yang baru dibuka (sisa check sebelumnya) tidak boleh ikut tertandai.
        const deteksi = await api(page, 'API.blackout.deteksi(5)');
        assert.strictEqual(deteksi.success, true);
        assert.ok(deteksi.total >= 1, 'sesi PC-03 harus terdeteksi');

        const snap = (await dbQuery('SELECT sisa_menit_saat_mati FROM sesi WHERE id = ?', [state.lanjutSesiId]))[0];
        assert.strictEqual(Number(snap.sisa_menit_saat_mati), 90);

        await showBlackoutSesi(page, state.lanjutSesiId);
        await blackoutRow(page, 'PC-03').locator('button[title="Pindahkan sesi ke PC kosong lain"]').click({ timeout: 5000 });
        await page.locator('.pc-card-tujuan', { hasText: 'PC-02' }).first().click({ timeout: 5000 });

        const pc2 = await pcByKode('PC-02');
        const aktif = await dbWait(
            'SELECT id, nama_guest, durasi_beli_menit, total_bayar FROM sesi WHERE pc_id = ? AND status = ?',
            [pc2.id, SESI_AKTIF],
            (rows) => rows.length === 1,
            'sesi pindahan aktif di PC-02'
        );
        assert.strictEqual(aktif[0].nama_guest, 'GuestLanjut');
        assert.strictEqual(Number(aktif[0].durasi_beli_menit), 90);
        assert.strictEqual(Number(aktif[0].total_bayar), 9000);
        state.pindahBlackoutSesiId = Number(aktif[0].id);

        const pc3 = await pcByKode('PC-03');
        assert.deepStrictEqual(
            await dbQuery('SELECT id FROM sesi WHERE pc_id = ? AND status = ?', [pc3.id, SESI_AKTIF]),
            [],
            'PC-03 harus kosong setelah sesi dipindah'
        );
        const lama = (await dbQuery('SELECT status, is_blackout_resolved FROM sesi WHERE id = ?', [state.lanjutSesiId]))[0];
        assert.strictEqual(lama.status, SESI_SELESAI);
        assert.strictEqual(Number(lama.is_blackout_resolved), 1);
        assert.deepStrictEqual(
            await dbQuery('SELECT id FROM transaksi WHERE sesi_id = ?', [state.pindahBlackoutSesiId]),
            [],
            'pindah PC tidak boleh membuat transaksi baru'
        );
        assert.strictEqual(
            Number((await dbQuery('SELECT sesi_asal_id FROM sesi WHERE id = ?', [state.pindahBlackoutSesiId]))[0].sesi_asal_id),
            Number(state.lanjutSesiId)
        );
    });

    await check(report, 'Deteksi blackout mengabaikan sesi dengan last_sync segar', async () => {
        const deteksi = await api(page, 'API.blackout.deteksi(5)');
        assert.strictEqual(deteksi.success, true);
        assert.strictEqual(deteksi.total, 0, 'sesi dengan last_sync segar tidak boleh jadi false positive');

        const pc1 = await pcByKode('PC-01');
        const pc4 = await pcByKode('PC-04');
        const rows = await dbQuery(
            'SELECT id, is_blackout_suspect FROM sesi WHERE pc_id IN (?, ?) AND status = ? ORDER BY id',
            [pc1.id, pc4.id, SESI_AKTIF]
        );
        assert.strictEqual(rows.length, 2, 'PC-01 hasil resolusi dan PC-04 harus tetap aktif');
        for (const r of rows) {
            assert.strictEqual(Number(r.is_blackout_suspect), 0, `sesi #${r.id} tidak boleh suspect`);
        }
    });

    await check(report, 'Heartbeat hanya menulis last_sync setelah jendela 30 detik', async () => {
        const pc4 = await pcByKode('PC-04');
        const aktif = (await dbQuery('SELECT id FROM sesi WHERE pc_id = ? AND status = ?', [pc4.id, SESI_AKTIF]))[0];
        assert.ok(aktif, 'prasyarat: sesi PC-04 aktif');

        const first = await clientPoll(page, { ip: pc4.ip_address, mac: pc4.mac_address });
        assert.strictEqual(first.http_status, 200);
        const v1 = (await dbWait(
            'SELECT last_sync FROM sesi WHERE id = ?',
            [aktif.id],
            (r) => r.length === 1 && r[0].last_sync !== null,
            'heartbeat pertama tersimpan'
        ))[0].last_sync;

        const second = await clientPoll(page, { ip: pc4.ip_address, mac: pc4.mac_address });
        assert.strictEqual(second.http_status, 200);
        const v2 = (await dbQuery('SELECT last_sync FROM sesi WHERE id = ?', [aktif.id]))[0].last_sync;
        assert.strictEqual(v2, v1, 'polling kedua di dalam 30 detik tidak boleh menulis last_sync');

        await dbExec("UPDATE sesi SET last_sync = datetime(last_sync, '-31 minutes') WHERE id = ?", [aktif.id]);
        const backdated = (await dbQuery('SELECT last_sync FROM sesi WHERE id = ?', [aktif.id]))[0].last_sync;
        assert.ok(backdated < v1, `nilai backdate harus lebih lama: ${backdated} vs ${v1}`);

        const third = await clientPoll(page, { ip: pc4.ip_address, mac: pc4.mac_address });
        assert.strictEqual(third.http_status, 200);
        const v3 = (await dbWait(
            'SELECT last_sync FROM sesi WHERE id = ?',
            [aktif.id],
            (r) => r.length === 1 && r[0].last_sync !== backdated,
            'heartbeat setelah backdate tersimpan'
        ))[0].last_sync;
        assert.ok(v3 > backdated, `last_sync harus maju: ${v3} vs ${backdated}`);
        assert.ok(v3 >= v1, `last_sync tidak boleh mundur: ${v3} vs ${v1}`);
    });

    await check(report, 'Tutup blackout mencatat transaksi tutup_sesi Rp0', async () => {
        // Sesi PC-05 sudah ditandai suspect oleh deteksi threshold 0 di check pertama.
        const suspect = await dbQuery(
            'SELECT id FROM sesi WHERE pc_id = (SELECT id FROM pc WHERE kode = ?) AND is_blackout_suspect = 1 AND is_blackout_resolved = 0',
            ['PC-05']
        );
        assert.strictEqual(suspect.length, 1, 'sesi PC-05 harus suspect dan belum resolved');
        const sesiId = Number(suspect[0].id);

        const before = await dbQuery('SELECT jenis, jumlah FROM transaksi WHERE sesi_id = ? ORDER BY id', [sesiId]);
        assert.strictEqual(before.length, 1);
        assert.strictEqual(Number(before[0].jumlah), 5000);

        await showBlackoutSesi(page, sesiId);
        await blackoutRow(page, 'PC-05').locator('button[title="Tutup sesi"]').click({ timeout: 5000 });
        await clickConfirm(page, '#modal-confirm-btn');

        const after = await dbWait(
            'SELECT jenis, jumlah FROM transaksi WHERE sesi_id = ? ORDER BY id',
            [sesiId],
            (rows) => rows.length === 2,
            'transaksi tutup blackout tercatat'
        );
        assert.deepStrictEqual(after.map((t) => t.jenis), [JENIS_BELI_GUEST, 'tutup_sesi']);
        assert.deepStrictEqual(after.map((t) => Number(t.jumlah)), [5000, 0]);

        const sesi = (await dbQuery('SELECT status, is_blackout_resolved FROM sesi WHERE id = ?', [sesiId]))[0];
        assert.strictEqual(sesi.status, SESI_SELESAI);
        assert.strictEqual(Number(sesi.is_blackout_resolved), 1);
    });

    await check(report, 'Emergency login tanpa token ditolak 403 tanpa mengubah PC maupun sesi', async () => {
        const pc2 = await pcByKode('PC-02');
        const pcBefore = await dbQuery('SELECT * FROM pc WHERE id = ?', [pc2.id]);
        const sesiBefore = await dbQuery('SELECT * FROM sesi WHERE pc_id = ? ORDER BY id', [pc2.id]);

        const tanpaToken = await emergencyLogin(page, { ip: pc2.ip_address, mac: pc2.mac_address });
        assert.strictEqual(tanpaToken.http_status, 403, `harus 403, dapat ${tanpaToken.http_status}`);

        const tokenSalah = await emergencyLogin(page, { ip: pc2.ip_address, mac: pc2.mac_address, token: 'token-palsu' });
        assert.strictEqual(tokenSalah.http_status, 403, `harus 403, dapat ${tokenSalah.http_status}`);
        assert.ok(/Token emergency login tidak valid/.test(String(tokenSalah.error || '')), `pesan error tidak sesuai: ${tokenSalah.error}`);

        assert.deepStrictEqual(await dbQuery('SELECT * FROM pc WHERE id = ?', [pc2.id]), pcBefore, 'baris PC tidak boleh berubah');
        assert.deepStrictEqual(await dbQuery('SELECT * FROM sesi WHERE pc_id = ? ORDER BY id', [pc2.id]), sesiBefore, 'baris sesi tidak boleh berubah');
        assert.strictEqual(Number(pcBefore[0].is_admin_mode), 0);

        // get_or_create_emergency_token() sudah berjalan sebelum validasi token.
        const settingsRow = (await dbQuery("SELECT value FROM settings WHERE key = 'emergency_token'"))[0];
        assert.ok(settingsRow && settingsRow.value, 'emergency_token harus tersedia di tabel settings');
        state.emergencyToken = settingsRow.value;
    });

    await check(report, 'Emergency login bertoken menutup sesi aktif, mengaktifkan admin mode, dan mencatat audit', async () => {
        assert.ok(state.emergencyToken, 'prasyarat: token emergency belum dibaca');
        const pc2 = await pcByKode('PC-02');
        const marker = unique('Emergency');

        const res = await emergencyLogin(page, {
            ip: pc2.ip_address,
            mac: pc2.mac_address,
            token: state.emergencyToken,
            username: marker,
        });
        assert.strictEqual(res.http_status, 200, `harus 200, dapat ${res.http_status}: ${JSON.stringify(res)}`);
        assert.strictEqual(res.success, true);

        const pc = (await dbQuery('SELECT is_admin_mode FROM pc WHERE id = ?', [pc2.id]))[0];
        assert.strictEqual(Number(pc.is_admin_mode), 1);

        const lama = (await dbQuery('SELECT status, selesai_pada FROM sesi WHERE id = ?', [state.pindahBlackoutSesiId]))[0];
        assert.strictEqual(lama.status, SESI_SELESAI, 'sesi guest sebelumnya harus ditutup');
        assert.ok(lama.selesai_pada, 'selesai_pada sesi lama harus terisi');

        const aktif = await dbQuery(
            'SELECT tipe, is_admin, nama_guest FROM sesi WHERE pc_id = ? AND status = ?',
            [pc2.id, SESI_AKTIF]
        );
        assert.strictEqual(aktif.length, 1, 'PC-02 harus punya tepat satu sesi aktif (admin)');
        assert.strictEqual(aktif[0].tipe, 'admin');
        assert.strictEqual(Number(aktif[0].is_admin), 1);
        assert.strictEqual(aktif[0].nama_guest, 'SYSTEM');

        const logs = await api(page, `API.report.logs(${JSON.stringify(marker)}, 100)`);
        assert.ok(Array.isArray(logs.logs), `respons log tidak valid: ${JSON.stringify(logs)}`);
        assert.ok(
            logs.logs.some((l) => l.action === 'EMERGENCY_LOGIN' && String(l.detail).includes(marker)),
            `audit EMERGENCY_LOGIN dengan penanda ${marker} tidak ditemukan`
        );
    });

    await check(report, 'Emergency login tanpa token diterima bila IP request sama dengan IP PC', async () => {
        const pc5 = await pcByKode('PC-05');
        const ipAwal = pc5.ip_address;

        try {
            await dbExec('UPDATE pc SET ip_address = ? WHERE id = ?', ['127.0.0.1', pc5.id]);
            const res = await emergencyLogin(page, { ip: '127.0.0.1', mac: pc5.mac_address, username: unique('EmergencyIp') });
            assert.strictEqual(res.http_status, 200, `harus 200 dari IP yang sama, dapat ${res.http_status}: ${JSON.stringify(res)}`);
            assert.strictEqual(res.success, true);

            const pc = (await dbQuery('SELECT is_admin_mode FROM pc WHERE id = ?', [pc5.id]))[0];
            assert.strictEqual(Number(pc.is_admin_mode), 1, 'admin mode harus aktif');
        } finally {
            await dbExec(
                "DELETE FROM sesi WHERE pc_id = ? AND tipe = 'admin' AND nama_guest = 'SYSTEM' AND status = ?",
                [pc5.id, SESI_AKTIF]
            );
            await dbExec('UPDATE pc SET is_admin_mode = 0, ip_address = ? WHERE id = ?', [ipAwal, pc5.id]);
        }
    });

    await check(report, 'Force-all menutup semua sesi aktif dan mencatat tutup_sesi Rp0', async () => {
        const aktifRows = await dbQuery('SELECT id, tipe FROM sesi WHERE status = ? ORDER BY id', [SESI_AKTIF]);
        const aktifBefore = aktifRows.map((r) => Number(r.id));
        const billable = aktifRows.filter((r) => r.tipe === 'guest' || r.tipe === 'member').map((r) => Number(r.id));
        assert.ok(aktifBefore.length >= 1, 'harus ada sesi aktif untuk ditutup');

        const trxBefore = (await dbQuery('SELECT COUNT(*) AS n, COALESCE(MAX(id), 0) AS maxId FROM transaksi'))[0];

        page.once('dialog', (dialog) => dialog.accept());
        await page.evaluate(() => Blackout.forceAllAndDetect());

        const deadline = Date.now() + 5000;
        let sisa = null;
        while (Date.now() < deadline) {
            sisa = Number((await dbQuery('SELECT COUNT(*) AS n FROM sesi WHERE status = ?', [SESI_AKTIF]))[0].n);
            if (sisa === 0) break;
            await sleep(100);
        }
        assert.strictEqual(sisa, 0, 'semua sesi aktif harus tertutup');

        const placeholders = aktifBefore.map(() => '?').join(',');
        const rows = await dbQuery(`SELECT id, status, selesai_pada, is_blackout_suspect FROM sesi WHERE id IN (${placeholders})`, aktifBefore);
        assert.strictEqual(rows.length, aktifBefore.length, 'jumlah sesi yang diubah harus sama');
        for (const r of rows) {
            assert.strictEqual(r.status, SESI_SELESAI, `sesi #${r.id} harus selesai`);
            assert.ok(r.selesai_pada, `sesi #${r.id} harus punya selesai_pada`);
            if (billable.includes(Number(r.id))) {
                assert.strictEqual(Number(r.is_blackout_suspect), 1, `sesi #${r.id} harus masuk riwayat blackout`);
            }
        }

        const placeholdersBillable = billable.map(() => '?').join(',');
        const tutup = await dbQuery(
            `SELECT COUNT(DISTINCT sesi_id) AS n FROM transaksi WHERE id > ? AND jenis = 'tutup_sesi' AND jumlah = 0 AND sesi_id IN (${placeholdersBillable})`,
            [Number(trxBefore.maxId), ...billable]
        );
        assert.strictEqual(Number(tutup[0].n), billable.length, 'satu tutup_sesi Rp0 per sesi billable');
    });

    await check(report, 'Pendapatan analytics naik tepat sebesar transaksi pemulihan blackout', async () => {
        assert.ok(Number.isInteger(state.analyticsStart), 'prasyarat: baseline analytics belum diambil');

        const uiEnd = await openAnalytics(page);

        const dbDelta = Number((await dbQuery(
            'SELECT COALESCE(SUM(jumlah), 0) AS total FROM transaksi WHERE id > ? AND jumlah > 0',
            [state.transaksiMaxId]
        ))[0].total);

        assert.strictEqual(dbDelta, 14000, `transaksi pemulihan harus Rp14.000, dapat ${dbDelta}`);
        assert.strictEqual(uiEnd - state.analyticsStart, dbDelta, `delta UI ${uiEnd - state.analyticsStart} != delta DB ${dbDelta}`);
    });

    return finish(report);
}

module.exports = { runPCBillingLifecycleE2ETest };
