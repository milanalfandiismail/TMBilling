'use strict';

/**
 * Task 7 — Member, paket, grup, dan portal member.
 *
 * Kontrak tiap check: transisi state di DOM, baris DB sandbox, aritmatika
 * menit/rupiah yang eksak, hasil otorisasi, atau kontrak error. Keberadaan
 * elemen saja bukan check.
 *
 * Catatan model: Member tidak punya kolom `saldo`. Saldo member = kolom
 * `member.waktu_tersimpan` (menit), sedangkan nilai uang tercatat di
 * `transaksi.jumlah`. Refund MEMOTONG menit dan menulis transaksi negatif.
 */

const assert = require('assert');
const { BASE_URL, login, tab, api, clientPoll, waitFor, unique, check } = require('./lib/harness');
const { dbQuery, dbExec } = require('./lib/db');
const { createReport, finish } = require('./lib/report');

const SESI_AKTIF = 'aktif';
const SESI_SELESAI = 'selesai';

const CHECK_NAMES = [
    'Member baru dibuat lewat UI tersimpan di DB dengan password ter-hash dan status aktif',
    'Top-up lewat UI menambah waktu_tersimpan tepat 60 menit dan mencatat Transaksi Rp5.000',
    'Refund paket mengembalikan saldo ke 0 dan mencatat transaksi refund -Rp5.000',
    'Sesi member di PC-03 tercatat tipe member dan polling client mengembalikan is_member',
    'Backdate 10 menit memotong saldo member tepat 10 menit tanpa saldo negatif',
    'Tutup sesi member menyimpan sisa waktu ke DB dan tidak menyisakan saldo negatif',
    'Paket Uji 1 Menit benar-benar habis: sesi selesai dan saldo member 0 (tidak negatif)',
    'Member kadaluarsa ditolak login portal dengan pesan kadaluarsa',
    'Member aktif login portal dan dashboard menampilkan sisa menit sesuai DB',
    'Paket baru dibuat lewat UI tersimpan dengan durasi dan harga tepat',
    'Paket diedit lewat UI mengubah durasi dan harga di DB',
    'Paket dihapus lewat UI hilang dari DB',
    'Grup baru dibuat lewat UI tersimpan di DB',
    'Grup diedit lewat UI mengubah warna di DB',
    'Grup duplikat ditolak dengan error dan tidak menambah baris',
    'Grup yang masih punya PC menolak dihapus',
    'Grup kosong berhasil dihapus'
];

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

async function dbOne(sql, params) {
    const rows = await dbQuery(sql, params);
    if (rows.length !== 1) throw new Error(`harus 1 baris, dapat ${rows.length}: ${JSON.stringify(rows)}`);
    return rows[0];
}

async function pcByKode(kode) {
    return dbOne('SELECT id, kode, ip_address, mac_address, grup_id FROM pc WHERE kode = ?', [kode]);
}

async function paketByNama(nama) {
    return dbOne('SELECT id, nama, durasi_menit, harga FROM paket WHERE nama = ?', [nama]);
}

async function memberByUsername(username) {
    return dbOne('SELECT id, username, waktu_tersimpan FROM member WHERE username = ?', [username]);
}

/** Klik tombol konfirmasi; handler modal dipasang di setTimeout jadi coba ulang. */
async function clickConfirm(page, selector) {
    await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
    for (let i = 0; i < 3; i += 1) {
        await page.click(selector).catch(() => {});
        try {
            await page.waitForSelector(selector, { state: 'detached', timeout: 1000 });
            return;
        } catch (_) {
            // handler belum terpasang, ulangi
        }
    }
    throw new Error(`tombol konfirmasi ${selector} tidak menutup modal`);
}

async function kasirToastText(page) {
    return page.evaluate(() => Array.from(document.querySelectorAll('div.bottom-6.right-6'))
        .map((el) => (el.textContent || '').trim())
        .filter(Boolean)
        .join(' | '));
}

async function waitKasirToast(page, needle, timeout = 5000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        const text = await kasirToastText(page);
        if (text.includes(needle)) return text;
        await sleep(100);
    }
    throw new Error(`toast "${needle}" tidak muncul; toast terakhir: "${await kasirToastText(page)}"`);
}

async function portalToastText(page) {
    return page.evaluate(() => {
        const el = document.getElementById('toast-container');
        return el ? (el.textContent || '').trim() : '';
    });
}

async function waitPortalToast(page, needle, timeout = 5000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        const text = await portalToastText(page);
        if (text.includes(needle)) return text;
        await sleep(100);
    }
    throw new Error(`toast portal "${needle}" tidak muncul; toast terakhir: "${await portalToastText(page)}"`);
}

async function memberSearch(page, term) {
    await page.evaluate((value) => {
        const input = document.getElementById('member-search-input');
        if (input) input.value = value;
        Member.doSearch();
    }, term);
    await page.waitForSelector(`#member-table tr:has-text("${term}")`, { timeout: 5000 });
}

async function paketSearch(page, term) {
    await page.evaluate((value) => {
        const input = document.getElementById('paket-search-input');
        if (input) input.value = value;
        Paket.doSearch();
    }, term);
    await page.waitForSelector(`#paket-table tr:has-text("${term}")`, { timeout: 5000 });
}

async function grupSearch(page, term) {
    await page.evaluate((value) => {
        const input = document.getElementById('grup-search-input');
        if (input) input.value = value;
        Grup.doSearch();
    }, term);
    await page.waitForSelector(`#grup-table tr:has-text("${term}")`, { timeout: 5000 });
}

async function clickRowButton(page, tableSelector, rowText, title) {
    const row = page.locator(`${tableSelector} tr`, { hasText: rowText }).first();
    await row.locator(`button[title="${title}"]:visible`).first().click();
}

async function runMemberPaketE2ETest(page) {
    const report = createReport('member_paket');

    try {
        await login(page, 'admin');
    } catch (err) {
        for (const name of CHECK_NAMES) {
            await check(report, name, async () => { throw err; });
        }
        return finish(report);
    }

    const state = {};

    await check(report, CHECK_NAMES[0], async () => {
        await tab(page, 'member');
        const username = unique('member');
        state.memberName = username;

        await page.click('#tab-member button[onclick="Member.showAddModal()"]');
        await page.waitForSelector('#modal-mem-user', { state: 'visible' });
        await page.fill('#modal-mem-user', username);
        await page.fill('#modal-mem-pass', 'pass123');
        await page.fill('#modal-mem-nama', 'Member E2E');
        await page.selectOption('#modal-mem-grup', 'reguler');
        await page.click('button[onclick="Member.add()"]');

        const rows = await dbWait(
            'SELECT id FROM member WHERE username = ?',
            [username],
            (r) => r.length === 1,
            'member baru tersimpan di DB'
        );

        state.memberId = rows[0].id;
        const member = await dbOne(
            'SELECT username, password_hash, aktif, grup_id, waktu_tersimpan FROM member WHERE id = ?',
            [state.memberId]
        );
        assert.strictEqual(member.username, username);
        assert.strictEqual(member.aktif, 1);
        assert.notStrictEqual(member.password_hash, 'pass123');
        assert.ok(String(member.password_hash).length > 20, 'password harus tersimpan sebagai hash');
        assert.strictEqual(member.waktu_tersimpan, 0);
    });

    await check(report, CHECK_NAMES[1], async () => {
        const paket = await paketByNama('1 Jam Reguler');
        await memberSearch(page, state.memberName);
        await clickRowButton(page, '#member-table', state.memberName, 'Tambah Waktu');

        await page.waitForSelector(`#mem-chk-paket-${paket.id}`, { state: 'visible' });
        await page.check(`#mem-chk-paket-${paket.id}`);
        await page.click('button[onclick^="Member.doAddWaktu("]');
        await clickConfirm(page, '#modal-confirm-submit-btn');

        await dbWait(
            'SELECT waktu_tersimpan FROM member WHERE id = ?',
            [state.memberId],
            (r) => r.length === 1 && r[0].waktu_tersimpan === 60,
            'saldo member menjadi 60 menit'
        );

        const trx = await dbOne(
            'SELECT id, jenis, jumlah, menit, member_id, paket_id FROM transaksi WHERE member_id = ? AND jenis = ?',
            [state.memberId, 'beli_paket_member']
        );
        assert.strictEqual(trx.jumlah, 5000);
        assert.strictEqual(trx.menit, 60);
        assert.strictEqual(trx.paket_id, paket.id);
        state.topupTrxId = trx.id;
    });

    await check(report, CHECK_NAMES[2], async () => {
        const res = await api(page, `API.member.refundPaket(${state.memberId}, ${state.topupTrxId})`);
        assert.strictEqual(res.success, true);

        await dbWait(
            'SELECT waktu_tersimpan FROM member WHERE id = ?',
            [state.memberId],
            (r) => r.length === 1 && r[0].waktu_tersimpan === 0,
            'saldo member kembali 0 setelah refund'
        );

        const original = await dbOne('SELECT is_refunded FROM transaksi WHERE id = ?', [state.topupTrxId]);
        assert.strictEqual(original.is_refunded, 1);

        const refund = await dbOne(
            'SELECT jumlah, menit FROM transaksi WHERE member_id = ? AND jenis = ? ORDER BY id DESC LIMIT 1',
            [state.memberId, 'refund_paket']
        );
        assert.strictEqual(refund.jumlah, -5000);
        assert.strictEqual(refund.menit, -60);
    });

    await check(report, CHECK_NAMES[3], async () => {
        const member1 = await memberByUsername('member1');
        const pc3 = await pcByKode('PC-03');
        state.pc3 = pc3;
        state.member1 = member1;
        state.saldoAwal = member1.waktu_tersimpan;

        const idle = await clientPoll(page, { ip: pc3.ip_address, mac: pc3.mac_address });
        assert.strictEqual(idle.status, 'kosong');

        const open = await api(page, 'API.sesi.bukaMember("PC-03", "member1")');
        assert.strictEqual(open.success, true);
        assert.strictEqual(open.waktu_tersimpan, state.saldoAwal);
        state.sesi1 = open.sesi_id;

        const sesi = await dbOne(
            'SELECT tipe, member_id, pc_id, status, waktu_tersimpan_awal FROM sesi WHERE id = ?',
            [state.sesi1]
        );
        assert.strictEqual(sesi.tipe, 'member');
        assert.strictEqual(sesi.member_id, member1.id);
        assert.strictEqual(sesi.pc_id, pc3.id);
        assert.strictEqual(sesi.status, SESI_AKTIF);
        assert.strictEqual(sesi.waktu_tersimpan_awal, state.saldoAwal);

        const poll = await clientPoll(page, { ip: pc3.ip_address, mac: pc3.mac_address });
        assert.strictEqual(poll.status, SESI_AKTIF);
        assert.strictEqual(poll.is_member, true);
        assert.strictEqual(poll.member.username, 'member1');
        assert.strictEqual(poll.sisa_waktu, state.saldoAwal);
    });

    await check(report, CHECK_NAMES[4], async () => {
        // Sesi member menghitung sisa dari waktu_mulai_sesi, bukan mulai_pada.
        await dbExec("UPDATE sesi SET waktu_mulai_sesi = datetime('now','-10 minutes') WHERE id = ?", [state.sesi1]);

        const poll = await clientPoll(page, { ip: state.pc3.ip_address, mac: state.pc3.mac_address });
        assert.strictEqual(poll.status, SESI_AKTIF);
        assert.strictEqual(poll.sisa_waktu, state.saldoAwal - 10);
        assert.strictEqual(poll.member.waktu_tersimpan, state.saldoAwal - 10);
        assert.ok(poll.sisa_waktu >= 0, 'sisa waktu tidak boleh negatif');
    });

    await check(report, CHECK_NAMES[5], async () => {
        const res = await api(page, `API.sesi.tutup(${state.sesi1})`);
        assert.strictEqual(res.success, true);

        const rows = await dbWait(
            'SELECT waktu_tersimpan FROM member WHERE id = ?',
            [state.member1.id],
            (r) => r.length === 1 && r[0].waktu_tersimpan === state.saldoAwal - 10,
            'sisa waktu tersimpan ke member setelah sesi ditutup'
        );
        assert.ok(rows[0].waktu_tersimpan >= 0, 'saldo member tidak boleh negatif');

        const sesi = await dbOne('SELECT status FROM sesi WHERE id = ?', [state.sesi1]);
        assert.strictEqual(sesi.status, SESI_SELESAI);
    });

    await check(report, CHECK_NAMES[6], async () => {
        const paket = await paketByNama('Uji 1 Menit');
        const member3 = await memberByUsername('member3');
        const sebelum = member3.waktu_tersimpan;

        const topup = await api(page, `API.member.tambahWaktu(${member3.id}, ${paket.id}, 1, 'Tunai')`);
        assert.strictEqual(topup.success, true);

        await dbWait(
            'SELECT waktu_tersimpan FROM member WHERE id = ?',
            [member3.id],
            (r) => r.length === 1 && r[0].waktu_tersimpan === sebelum + 1,
            'saldo member3 bertambah tepat 1 menit'
        );
        const trx = await dbOne(
            'SELECT jumlah, menit FROM transaksi WHERE member_id = ? AND jenis = ? ORDER BY id DESC LIMIT 1',
            [member3.id, 'beli_paket_member']
        );
        assert.strictEqual(trx.menit, 1);
        assert.strictEqual(trx.jumlah, 1000);

        const pc4 = await pcByKode('PC-04');
        await clientPoll(page, { ip: pc4.ip_address, mac: pc4.mac_address });
        const open = await api(page, 'API.sesi.bukaMember("PC-04", "member3")');
        assert.strictEqual(open.success, true);
        const sesiId = open.sesi_id;

        await dbExec("UPDATE sesi SET waktu_mulai_sesi = datetime('now','-2 minutes') WHERE id = ?", [sesiId]);
        const poll = await clientPoll(page, { ip: pc4.ip_address, mac: pc4.mac_address });
        assert.strictEqual(poll.status, 'kosong');
        assert.strictEqual(poll.message, 'Waktu habis');

        const sesi = await dbOne('SELECT status FROM sesi WHERE id = ?', [sesiId]);
        assert.strictEqual(sesi.status, SESI_SELESAI);

        const setelah = await dbOne('SELECT waktu_tersimpan FROM member WHERE id = ?', [member3.id]);
        assert.strictEqual(setelah.waktu_tersimpan, 0, 'paket 1 menit habis tepat, saldo floored ke 0');
    });

    await check(report, CHECK_NAMES[7], async () => {
        const sebelum = await dbOne(
            'SELECT waktu_tersimpan, kadaluarsa_pada FROM member WHERE username = ?',
            ['member_expired']
        );

        await page.goto(`${BASE_URL}/member/login`, { waitUntil: 'domcontentloaded' });
        await page.fill('#username', 'member_expired');
        await page.fill('#password', 'pass123');
        await page.click('#btn-login');

        const toast = await waitPortalToast(page, 'kadaluarsa');
        assert.ok(/kadaluarsa/i.test(toast), `pesan error harus menyebut kadaluarsa: "${toast}"`);
        assert.ok(page.url().includes('/member/login'), 'member kadaluarsa harus tetap di halaman login');

        // Portal tidak memberi sesi: halaman dashboard memantul balik ke login.
        await page.goto(`${BASE_URL}/member`, { waitUntil: 'domcontentloaded' });
        assert.ok(page.url().includes('/member/login'), 'dashboard member harus menolak sesi kadaluarsa');

        const sesudah = await dbOne(
            'SELECT waktu_tersimpan, kadaluarsa_pada FROM member WHERE username = ?',
            ['member_expired']
        );
        assert.strictEqual(sesudah.waktu_tersimpan, sebelum.waktu_tersimpan);
        assert.strictEqual(sesudah.kadaluarsa_pada, sebelum.kadaluarsa_pada);
    });

    await check(report, CHECK_NAMES[8], async () => {
        const db = await dbOne('SELECT waktu_tersimpan FROM member WHERE username = ?', ['member1']);

        await page.goto(`${BASE_URL}/member/login`, { waitUntil: 'domcontentloaded' });
        await page.fill('#username', 'member1');
        await page.fill('#password', 'pass123');
        await page.click('#btn-login');
        await page.waitForURL(/\/member(\/dashboard)?\/?$/, { timeout: 5000 });

        const text = await page.evaluate(() => document.body.innerText);
        const match = text.match(/Total Sisa:\s*(\d+)\s*Menit/);
        assert.ok(match, 'dashboard member harus menampilkan "Total Sisa: N Menit"');
        assert.strictEqual(Number(match[1]), db.waktu_tersimpan);
    });

    await check(report, CHECK_NAMES[9], async () => {
        await login(page, 'admin');
        await tab(page, 'paket');
        const nama = unique('paket');
        state.paketName = nama;

        await page.click('#tab-paket button[onclick="Paket.showAddModal()"]');
        await page.waitForSelector('#modal-paket-nama', { state: 'visible' });
        await page.selectOption('#modal-paket-grup', 'reguler');
        // Durasi/harga diisi dulu: oninput durasi menimpa nama dengan nama saran.
        await page.fill('#modal-paket-durasi', '45');
        await page.fill('#modal-paket-harga', '7000');
        await page.fill('#modal-paket-nama', nama);
        await page.click('button[onclick="Paket.add()"]');

        const rows = await dbWait(
            'SELECT id, durasi_menit, harga, grup_id FROM paket WHERE nama = ?',
            [nama],
            (r) => r.length === 1,
            'paket baru tersimpan di DB'
        );
        const reguler = await dbOne("SELECT id FROM grup WHERE nama = 'reguler'");
        assert.strictEqual(rows[0].durasi_menit, 45);
        assert.strictEqual(rows[0].harga, 7000);
        assert.strictEqual(rows[0].grup_id, reguler.id);
        state.paketId = rows[0].id;
    });

    await check(report, CHECK_NAMES[10], async () => {
        await paketSearch(page, state.paketName);
        await clickRowButton(page, '#paket-table', state.paketName, 'Edit');
        await page.waitForSelector('#edit-paket-durasi', { state: 'visible' });
        await page.fill('#edit-paket-durasi', '50');
        await page.fill('#edit-paket-harga', '7500');
        await page.click('button[onclick^="Paket.doEdit("]');

        const rows = await dbWait(
            'SELECT durasi_menit, harga FROM paket WHERE id = ?',
            [state.paketId],
            (r) => r.length === 1 && r[0].durasi_menit === 50 && r[0].harga === 7500,
            'perubahan paket tersimpan di DB'
        );
        assert.strictEqual(rows[0].durasi_menit, 50);
        assert.strictEqual(rows[0].harga, 7500);
    });

    await check(report, CHECK_NAMES[11], async () => {
        await paketSearch(page, state.paketName);
        await clickRowButton(page, '#paket-table', state.paketName, 'Hapus');
        await clickConfirm(page, '#modal-confirm-btn');

        await dbWait(
            'SELECT id FROM paket WHERE id = ?',
            [state.paketId],
            (r) => r.length === 0,
            'paket hilang dari DB setelah dihapus'
        );
    });

    await check(report, CHECK_NAMES[12], async () => {
        await tab(page, 'grup');
        const nama = unique('grup');
        state.grupName = nama;

        await page.click('#tab-grup button[onclick="Grup.showAddModal()"]');
        await page.waitForSelector('#modal-grup-nama', { state: 'visible' });
        await page.fill('#modal-grup-nama', nama);
        await page.fill('#modal-grup-ket', 'Grup uji E2E');
        await page.click('button[onclick="Grup.add()"]');

        const rows = await dbWait(
            'SELECT id, warna, keterangan FROM grup WHERE nama = ?',
            [nama],
            (r) => r.length === 1,
            'grup baru tersimpan di DB'
        );
        state.grupId = rows[0].id;
        assert.strictEqual(rows[0].keterangan, 'Grup uji E2E');
    });

    await check(report, CHECK_NAMES[13], async () => {
        await grupSearch(page, state.grupName);
        await clickRowButton(page, '#grup-table', state.grupName, 'Edit Grup');
        await page.waitForSelector('#modal-grup-warna', { state: 'visible' });
        await page.$eval('#modal-grup-warna', (el) => { el.value = '#ff00aa'; });
        await page.click('button[onclick^="Grup.edit("]');

        const rows = await dbWait(
            'SELECT warna FROM grup WHERE id = ?',
            [state.grupId],
            (r) => r.length === 1 && r[0].warna === '#ff00aa',
            'warna grup berubah di DB'
        );
        assert.strictEqual(rows[0].warna, '#ff00aa');
    });

    await check(report, CHECK_NAMES[14], async () => {
        await page.click('#tab-grup button[onclick="Grup.showAddModal()"]');
        await page.waitForSelector('#modal-grup-nama', { state: 'visible' });
        await page.fill('#modal-grup-nama', state.grupName);
        await page.click('button[onclick="Grup.add()"]');

        const toast = await waitKasirToast(page, 'sudah ada');
        assert.ok(/sudah ada/i.test(toast), `error duplikat harus menyebut "sudah ada": "${toast}"`);
        const rows = await dbQuery('SELECT id FROM grup WHERE nama = ?', [state.grupName]);
        assert.strictEqual(rows.length, 1, 'grup duplikat tidak boleh menambah baris');

        await page.evaluate(() => Modal.closeModal());
    });

    await check(report, CHECK_NAMES[15], async () => {
        const pcKode = unique('PC-E2E');
        await dbExec("INSERT INTO pc (kode, nama, grup_id, zona, aktif) VALUES (?, ?, ?, 'reguler', 1)", [
            pcKode,
            'PC Grup Guard',
            state.grupId
        ]);
        state.pcKode = pcKode;

        await grupSearch(page, state.grupName);
        await clickRowButton(page, '#grup-table', state.grupName, 'Hapus Grup');
        await clickConfirm(page, '#modal-confirm-btn');

        const toast = await waitKasirToast(page, 'PC');
        assert.ok(/PC/i.test(toast), `error hapus harus menyebut PC: "${toast}"`);
        const rows = await dbQuery('SELECT id FROM grup WHERE id = ?', [state.grupId]);
        assert.strictEqual(rows.length, 1, 'grup berisi PC tidak boleh terhapus');
    });

    await check(report, CHECK_NAMES[16], async () => {
        await dbExec('DELETE FROM pc WHERE kode = ?', [state.pcKode]);

        await grupSearch(page, state.grupName);
        await clickRowButton(page, '#grup-table', state.grupName, 'Hapus Grup');
        await clickConfirm(page, '#modal-confirm-btn');

        await dbWait(
            'SELECT id FROM grup WHERE id = ?',
            [state.grupId],
            (r) => r.length === 0,
            'grup kosong terhapus dari DB'
        );
    });

    return finish(report);
}

module.exports = { runMemberPaketE2ETest };
