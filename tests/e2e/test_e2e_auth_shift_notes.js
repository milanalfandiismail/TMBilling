'use strict';

/**
 * Task 8 — Autentikasi, shift kasir, catatan, dan riwayat shift.
 *
 * Kontrak tiap check: transisi state di DOM, baris DB sandbox, aritmatika
 * rupiah yang eksak, atau hasil otorisasi. Keberadaan elemen saja bukan check.
 *
 * Perilaku produk yang SENGAJA berlaku dan tidak boleh "diperbaiki" di sini:
 * - `get_shift_summary()` read-only: total dihitung dari `transaksi` dalam
 *   jendela shift, tidak pernah menulis/meng-commit `shift_record`.
 * - `force_close_shift()` menyimpan `uang_fisik = NULL` dan `selisih = NULL`
 *   (tidak memalsukan laci seimbang) dan struk mencetak BELUM DIHITUNG.
 * - Tutup shift biasa menyimpan selisih riil (blind cash reconciliation).
 * - Operator tak dikenal tidak diatribusikan ke admin pertama.
 *
 * Catatan model: kolom uang transaksi billing adalah `transaksi.jumlah`
 * (bukan `total`), dan timestamp DB adalah UTC naive sementara "hari ini"
 * dihitung pada zona settings (sandbox: Asia/Jakarta, UTC+7 tanpa DST).
 */

const assert = require('assert');
const { BASE_URL, login, tab, api, waitFor, unique, check } = require('./lib/harness');
const { dbQuery } = require('./lib/db');
const { createReport, finish } = require('./lib/report');

const TZ_OFFSET_HOURS = 7;
const JENIS_DIKECUALIKAN = "('tutup_sesi','pindah_pc','refund_paket')";

const CHECK_NAMES = [
    'Password salah ditolak dengan pesan spesifik dan tidak membuat sesi login',
    'Kasir ditolak 403 pada endpoint admin, sedangkan admin mendapat 200',
    'Shift kasir dibuka lewat UI dan tersimpan AKTIF dengan modal awal Rp50.000',
    'Membuka shift kedua saat shift masih aktif ditolak dan tidak menambah baris AKTIF',
    'Satu transaksi billing dan satu checkout FnB tercatat tepat dengan operator kasir1',
    'Total ringkasan shift sama dengan SUM transaksi independen di jendela shift',
    'GET ringkasan shift pada shift aktif tidak mengubah satu pun kolom shift_record',
    'Tutup shift dengan kas fisik lebih Rp5.000 menyimpan selisih +5000 dan struk menyebut LEBIH',
    'Shift kedua ditutup dengan kas fisik kurang Rp2.500 menyimpan selisih -2500',
    'Shift ketiga dibuka dengan modal Rp10.000 tanpa transaksi untuk uji penutupan paksa',
    'Catatan baru dibuat lewat UI dan tersimpan di daftar catatan',
    'Catatan tetap ada setelah halaman dimuat ulang dan isinya utuh',
    'Catatan terlihat oleh user kedua (admin) pada tab catatan',
    'Force close admin menyimpan uang_fisik dan selisih NULL serta struk BELUM DIHITUNG',
    'Riwayat shift menampilkan "-" dan FORCE CLOSE, bukan Rp 0, untuk shift tanpa hitung fisik',
    'Detail rekap shift paksa menampilkan "(Penutupan Paksa)"',
    'Laporan harian menampilkan total billing yang sama dengan SUM transaksi hari ini',
    'Export laporan billing mengembalikan PDF 200 application/pdf',
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

function hariIniLokal() {
    return new Date(Date.now() + TZ_OFFSET_HOURS * 3600 * 1000).toISOString().slice(0, 10);
}

/** Buka modal buka-shift yang sama dengan tombol sidebar, isi, lalu klik "Mulai Shift". */
async function bukaShiftLewatUI(page, modalAwal) {
    await page.evaluate(() => Shift.showBukaShiftModal());
    await page.waitForSelector('#modal-awal-input', { state: 'visible', timeout: 5000 });
    await page.fill('#modal-awal-input', String(modalAwal));
    await page.click('button[onclick="Shift.submitBukaShift()"]');
    const rows = await dbWait(
        'SELECT id, modal_awal FROM shift_record WHERE status = ? ORDER BY id DESC LIMIT 1',
        ['AKTIF'],
        (r) => r.length === 1,
        'shift AKTIF baru'
    );
    assert.strictEqual(Number(rows[0].modal_awal), modalAwal);
    return rows[0].id;
}

async function tutupShiftLewatUI(page, uangFisik) {
    await page.evaluate(() => Shift.showTutupShiftModal());
    await page.waitForSelector('#uang-fisik-input', { state: 'visible', timeout: 5000 });
    await page.fill('#uang-fisik-input', String(uangFisik));
    await page.click('button[onclick="Shift.submitTutupShift()"]');
}

async function tutupHasilModal(page) {
    await page.evaluate(() => {
        if (window.Modal && Modal.activeModal) Modal.closeModal();
    });
}

function cariId(rows, label) {
    if (rows.length !== 1) throw new Error(`${label} harus 1 baris: ${JSON.stringify(rows)}`);
    return rows[0].id;
}

/** `waitFor` mengirim fn ke browser tanpa closure; helper ini mengirim argumen eksplisit. */
async function tungguDiHalaman(page, fn, arg, label) {
    try {
        await page.waitForFunction(fn, arg, { timeout: 5000 });
    } catch (err) {
        throw new Error(`${label} tidak terpenuhi: ${err.message}`);
    }
}

async function loginBersih(page, role) {
    // Dashboard memasang polling periodik; request yang masih terbang bisa
    // men-set ulang cookie sesi tepat setelah clearCookies, sehingga
    // /kasir/login me-redirect balik ke dashboard. Bunuh halaman dulu.
    await page.goto('about:blank');
    return login(page, role);
}

async function runAuthShiftNotesE2ETest(page) {
    const report = createReport('auth_shift_notes');

    try {
        await page.context().clearCookies();
        await page.goto(`${BASE_URL}/kasir/login`);
    } catch (err) {
        for (const name of CHECK_NAMES) {
            await check(report, name, async () => { throw err; });
        }
        return finish(report);
    }

    const state = {};
    const today = hariIniLokal();
    state.today = today;

    await check(report, CHECK_NAMES[0], async () => {
        await page.fill('#username', 'kasir1');
        await page.fill('#password', 'password-salah-e2e');
        await page.click('#btn-login');

        await page.waitForSelector('#error-box:not(.hidden)', { timeout: 5000 });
        const pesan = (await page.textContent('#error-text')).trim();
        assert.ok(
            pesan.includes('Username atau password salah'),
            `pesan error harus spesifik, dapat: "${pesan}"`
        );
        assert.ok(page.url().includes('/kasir/login'), `harus tetap di halaman login, dapat ${page.url()}`);

        const cek = await page.request.get(`${BASE_URL}/api/v1/kasir/auth/check`);
        const cekBody = await cek.json();
        assert.strictEqual(cekBody.logged_in, false, `sesi tidak boleh terbentuk: ${JSON.stringify(cekBody)}`);

        const proteksi = await page.request.get(`${BASE_URL}/api/v1/kasir/shift/active`);
        assert.strictEqual(proteksi.status(), 401);
    });

    await check(report, CHECK_NAMES[1], async () => {
        await loginBersih(page, 'kasir');
        const ditolak = await page.request.get(`${BASE_URL}/api/v1/kasir/report/log`);
        assert.strictEqual(ditolak.status(), 403, 'kasir harus ditolak 403, bukan redirect login');
        const body = await ditolak.json();
        assert.ok(
            (body.error || '').includes('Akses Ditolak'),
            `pesan 403 harus jelas, dapat: ${JSON.stringify(body)}`
        );

        await loginBersih(page, 'admin');
        const diterima = await page.request.get(`${BASE_URL}/api/v1/kasir/report/log`);
        assert.strictEqual(diterima.status(), 200, 'admin harus bisa membuka endpoint admin');

        await loginBersih(page, 'kasir');
    });

    await check(report, CHECK_NAMES[2], async () => {
        state.kasirId = cariId(await dbQuery('SELECT id FROM user WHERE username = ?', ['kasir1']), 'user kasir1');
        state.shift1Id = await bukaShiftLewatUI(page, 50000);
        const row = await dbOne('SELECT status, modal_awal, uang_fisik, selisih, waktu_selesai FROM shift_record WHERE id = ?', [state.shift1Id]);
        assert.strictEqual(row.status, 'AKTIF');
        assert.strictEqual(Number(row.modal_awal), 50000);
        assert.strictEqual(row.uang_fisik, null);
        assert.strictEqual(row.selisih, null);
        assert.strictEqual(row.waktu_selesai, null);

        // Modal buka-shift menampilkan modal awal yang baru tersimpan.
        await tutupHasilModal(page);
        await page.evaluate(() => Shift.load());
        await waitFor(page, () => {
            const el = document.getElementById('shift-info');
            return el && el.textContent.includes('Modal: Rp50.000');
        }, { label: 'sidebar menampilkan modal awal' });
    });

    await check(report, CHECK_NAMES[3], async () => {
        const pesan = await page.evaluate(async () => {
            try {
                await API.shift.start({ modal_awal: 10000 });
                return null;
            } catch (err) {
                return err.message;
            }
        });
        assert.ok(pesan && pesan.includes('Masih ada shift aktif'), `harus ditolak, dapat: ${pesan}`);

        const aktif = await dbQuery('SELECT id FROM shift_record WHERE status = ?', ['AKTIF']);
        assert.strictEqual(aktif.length, 1);
        assert.strictEqual(Number(aktif[0].id), Number(state.shift1Id));
    });

    await check(report, CHECK_NAMES[4], async () => {
        const paket = await dbOne('SELECT id, nama, harga FROM paket WHERE nama = ?', ['1 Jam Reguler']);
        const menu = await dbOne('SELECT id, nama, harga FROM menu_item WHERE nama = ?', ['Indomie Goreng']);

        const sesi = await api(page, `API.sesi.bukaGuest('PC-01', ${paket.id}, 'Guest Shift E2E', 'Tunai')`);
        assert.strictEqual(sesi.success, true, JSON.stringify(sesi));
        state.sesiId = sesi.sesi_id;

        const billing = await dbOne(
            'SELECT jenis, jumlah, user_id, metode_pembayaran FROM transaksi WHERE sesi_id = ? OR (jenis = ? AND user_id = ?) ORDER BY id DESC LIMIT 1',
            [state.sesiId, 'beli_paket_guest', state.kasirId]
        );
        assert.strictEqual(billing.jenis, 'beli_paket_guest');
        assert.strictEqual(Number(billing.jumlah), Number(paket.harga));
        assert.strictEqual(Number(billing.user_id), Number(state.kasirId), 'transaksi harus atas nama kasir1');
        assert.strictEqual(billing.metode_pembayaran, 'Tunai');

        const total = menu.harga * 2;
        const checkout = await api(page, `API.menu.checkout([{ menu_id: ${menu.id}, jumlah: 2 }], null, ${total}, 0, 'Tunai')`);
        assert.ok(checkout && checkout.success !== false, JSON.stringify(checkout));

        const fnb = await dbOne(
            'SELECT total_harga, jumlah, kasir_id, metode_pembayaran FROM transaksi_menu ORDER BY id DESC LIMIT 1'
        );
        assert.strictEqual(Number(fnb.total_harga), Number(total));
        assert.strictEqual(Number(fnb.jumlah), 2);
        assert.strictEqual(Number(fnb.kasir_id), Number(state.kasirId));
        assert.strictEqual(fnb.metode_pembayaran, 'Tunai');
        state.fnbTotal = Number(total);
    });

    await check(report, CHECK_NAMES[5], async () => {
        const shift = await dbOne(
            'SELECT waktu_mulai, waktu_selesai, modal_awal FROM shift_record WHERE id = ?',
            [state.shift1Id]
        );
        const akhir = shift.waktu_selesai || new Date().toISOString().slice(0, 19).replace('T', ' ');

        // `datetime()` menormalkan presisi mikrodetik; perbandingan string mentah
        // gagal saat batas atas tanpa pecahan detik dibandingkan ke nilai berpecahan.
        const billing = await dbOne(
            `SELECT COALESCE(SUM(jumlah), 0) AS gross FROM transaksi
             WHERE datetime(dibuat_pada) >= datetime(?) AND datetime(dibuat_pada) <= datetime(?)
               AND user_id = ? AND jumlah > 0
               AND jenis NOT IN ${JENIS_DIKECUALIKAN}`,
            [shift.waktu_mulai, akhir, state.kasirId]
        );
        const kantin = await dbOne(
            `SELECT COALESCE(SUM(total_harga), 0) AS total FROM transaksi_menu
             WHERE datetime(tanggal) >= datetime(?) AND datetime(tanggal) <= datetime(?) AND kasir_id = ?`,
            [shift.waktu_mulai, akhir, state.kasirId]
        );

        const summary = await page.evaluate(() => API.shift.summary());
        assert.strictEqual(summary.success, true, JSON.stringify(summary));
        const s = summary.summary;
        state.totalSeharusnya = Number(s.total_seharusnya);
        state.totalBilling = Number(s.total_billing);
        state.totalKantin = Number(s.total_kantin);
        state.summarySebelum = s;

        assert.strictEqual(Number(billing.gross), 5000, 'billing independen harus Rp5.000');
        assert.strictEqual(Number(kantin.total), state.fnbTotal, 'kantin independen harus sama dengan checkout');
        assert.strictEqual(Number(s.total_billing), Number(billing.gross));
        assert.strictEqual(Number(s.total_kantin), Number(kantin.total));
        assert.strictEqual(
            Number(s.total_seharusnya),
            Number(shift.modal_awal) + Number(billing.gross) + Number(kantin.total),
            'uang seharusnya = modal awal + tunai bersih'
        );
    });

    await check(report, CHECK_NAMES[6], async () => {
        const sebelum = await dbOne('SELECT * FROM shift_record WHERE id = ?', [state.shift1Id]);
        const summary = await page.evaluate(() => API.shift.summary());
        assert.strictEqual(summary.success, true);
        assert.strictEqual(Number(summary.summary.total_billing), state.totalBilling);
        const sesudah = await dbOne('SELECT * FROM shift_record WHERE id = ?', [state.shift1Id]);
        assert.deepStrictEqual(sesudah, sebelum, 'GET ringkasan tidak boleh menulis ke shift_record');
    });

    await check(report, CHECK_NAMES[7], async () => {
        const uangFisik = state.totalSeharusnya + 5000;
        await tutupShiftLewatUI(page, uangFisik);

        const row = await dbWait(
            'SELECT status, uang_fisik, selisih, total_billing, total_kantin FROM shift_record WHERE id = ?',
            [state.shift1Id],
            (r) => r.length === 1 && r[0].status === 'SELESAI',
            'shift pertama SELESAI'
        ).then((r) => r[0]);

        assert.strictEqual(Number(row.uang_fisik), uangFisik);
        assert.strictEqual(Number(row.selisih), 5000, 'selisih harus persis +5000');
        assert.strictEqual(Number(row.total_billing), state.totalBilling);
        assert.strictEqual(Number(row.total_kantin), state.totalKantin);

        const struk = await page.evaluate((id) => API.shift.receipt(id), state.shift1Id);
        const teks = struk.receipt_text || '';
        assert.ok(teks.includes('Uang Seharusnya'), 'struk harus memuat Uang Seharusnya');
        assert.ok(teks.includes('LEBIH'), `struk harus menandai kelebihan kas: ${teks}`);
        assert.ok(
            teks.includes('5,000') || teks.includes('5.000'),
            `struk harus memuat nominal selisih 5000: ${teks}`
        );

        await waitFor(page, () => {
            const body = document.body.innerText || '';
            return body.includes('SURPLUS (+)') && body.includes('Rekapitulasi Shift Kasir');
        }, { label: 'modal rekap menampilkan SURPLUS' });
        await tutupHasilModal(page);
    });

    await check(report, CHECK_NAMES[8], async () => {
        state.shift2Id = await bukaShiftLewatUI(page, 20000);

        const paket = await dbOne('SELECT id, harga FROM paket WHERE nama = ?', ['1 Jam Reguler']);
        const sesi = await api(page, `API.sesi.bukaGuest('PC-02', ${paket.id}, 'Guest Shift Dua', 'Tunai')`);
        assert.strictEqual(sesi.success, true, JSON.stringify(sesi));

        const summary = await page.evaluate(() => API.shift.summary());
        assert.strictEqual(summary.success, true);
        const seharusnya = Number(summary.summary.total_seharusnya);
        assert.strictEqual(seharusnya, 25000, 'modal 20.000 + billing tunai 5.000');

        await tutupShiftLewatUI(page, seharusnya - 2500);
        const row = await dbWait(
            'SELECT status, uang_fisik, selisih FROM shift_record WHERE id = ?',
            [state.shift2Id],
            (r) => r.length === 1 && r[0].status === 'SELESAI',
            'shift kedua SELESAI'
        ).then((r) => r[0]);

        assert.strictEqual(Number(row.uang_fisik), seharusnya - 2500);
        assert.strictEqual(Number(row.selisih), -2500, 'selisih harus persis -2500');

        await waitFor(page, () => (document.body.innerText || '').includes('DEFISIT (-)'), { label: 'modal rekap menampilkan DEFISIT' });
        await tutupHasilModal(page);
    });

    await check(report, CHECK_NAMES[9], async () => {
        state.shift3Id = await bukaShiftLewatUI(page, 10000);
        const row = await dbOne('SELECT status, modal_awal FROM shift_record WHERE id = ?', [state.shift3Id]);
        assert.strictEqual(row.status, 'AKTIF');
        assert.strictEqual(Number(row.modal_awal), 10000);
        const trx = await dbOne('SELECT COUNT(*) AS n FROM transaksi WHERE user_id = ? AND jenis = ?', [state.kasirId, 'tambah_waktu_guest']);
        assert.strictEqual(Number(trx.n), 0);
    });

    await check(report, CHECK_NAMES[10], async () => {
        await tab(page, 'catatan');
        state.noteTitle = unique('Serah Terima E2E');
        state.noteBody = `Kas shift pagi: laci sudah dihitung. ${state.noteTitle}`;
        const aktifSebelum = await page.evaluate(() => (window.Catatan && Catatan.activeFilename) || '');

        await page.click('#tab-catatan button[onclick="Catatan.createNewNote()"]');
        await page.waitForSelector('#note-title-input', { state: 'visible', timeout: 5000 });
        await page.waitForFunction(
            (prev) => window.Catatan && Catatan.activeFilename && Catatan.activeFilename !== prev,
            aktifSebelum,
            { timeout: 5000 }
        );
        state.catatanDibuat = await page.evaluate(() => Catatan.activeFilename);

        await page.fill('#note-title-input', state.noteTitle);
        await page.fill('#note-content-editor', state.noteBody);
        await page.click('#note-save-status');

        await tungguDiHalaman(page, () => {
            const el = document.getElementById('note-save-status');
            return !!el && el.textContent.includes('Tersimpan');
        }, null, 'status simpan catatan');

        await tungguDiHalaman(page, (title) => {
            const el = document.getElementById('notes-list-container');
            return !!el && el.textContent.includes(title);
        }, state.noteTitle, 'judul catatan di daftar');

        // Catatan uji hidup di instance/notes bersama (sandbox hanya mengisolasi
        // SQLite), jadi hanya berkas yang dibuat run ini yang dihapus nanti.
        state.notesBaru = [state.catatanDibuat, `${state.noteTitle}.txt`];
    });

    await check(report, CHECK_NAMES[11], async () => {
        await page.reload();
        await page.waitForSelector('#tab-dash', { state: 'visible', timeout: 5000 });
        await tab(page, 'catatan');

        await tungguDiHalaman(page, (title) => {
            const el = document.getElementById('notes-list-container');
            return !!el && el.textContent.includes(title);
        }, state.noteTitle, 'catatan bertahan setelah reload');

        await page.locator('#notes-list-container').getByText(state.noteTitle, { exact: false }).first().click();
        await tungguDiHalaman(page, (title) => {
            const editor = document.getElementById('note-content-editor');
            return !!editor && editor.value.includes(title);
        }, state.noteTitle, 'isi catatan setelah reload');

        const isi = await page.inputValue('#note-content-editor');
        assert.ok(isi.includes(state.noteBody), `isi catatan harus utuh, dapat: "${isi}"`);
    });

    await check(report, CHECK_NAMES[12], async () => {
        await login(page, 'admin');
        await tab(page, 'catatan');
        await tungguDiHalaman(page, (title) => {
            const el = document.getElementById('notes-list-container');
            return !!el && el.textContent.includes(title);
        }, state.noteTitle, 'catatan terlihat oleh admin');

        await page.locator('#notes-list-container').getByText(state.noteTitle, { exact: false }).first().click();
        await tungguDiHalaman(page, (title) => {
            const editor = document.getElementById('note-content-editor');
            return !!editor && editor.value.includes(title);
        }, state.noteTitle, 'admin membuka isi catatan');
    });

    await check(report, CHECK_NAMES[13], async () => {
        const hasil = await api(
            page,
            `API.shift.forceClose({ shift_id: ${state.shift3Id}, alasan: 'uji e2e penutupan paksa' })`
        );
        assert.strictEqual(hasil.success, true, JSON.stringify(hasil));

        const row = await dbWait(
            'SELECT status, uang_fisik, selisih, catatan FROM shift_record WHERE id = ?',
            [state.shift3Id],
            (r) => r.length === 1 && r[0].status === 'SELESAI',
            'shift ketiga ditutup paksa'
        ).then((r) => r[0]);

        assert.strictEqual(row.uang_fisik, null, 'force close tidak boleh mengisi uang fisik');
        assert.strictEqual(row.selisih, null, 'force close tidak boleh memalsukan selisih 0');
        assert.ok((row.catatan || '').includes('[FORCE CLOSE'), `catatan harus berisi penanda: ${row.catatan}`);

        const struk = await page.evaluate((id) => API.shift.receipt(id), state.shift3Id);
        const teks = struk.receipt_text || '';
        assert.ok(teks.includes('BELUM DIHITUNG'), `struk harus BELUM DIHITUNG: ${teks}`);
        assert.ok(teks.includes('PENUTUPAN PAKSA'), `struk harus PENUTUPAN PAKSA: ${teks}`);
    });

    await check(report, CHECK_NAMES[14], async () => {
        await tab(page, 'shift_history');
        await page.waitForSelector('#shift-history-rows tr:has-text("FORCE CLOSE")', { timeout: 5000 });

        const sel = await page.evaluate(() => {
            const row = Array.from(document.querySelectorAll('#shift-history-rows tr'))
                .find((tr) => (tr.textContent || '').includes('FORCE CLOSE'));
            if (!row) return null;
            return Array.from(row.querySelectorAll('td')).map((td) => (td.textContent || '').trim());
        });

        assert.ok(sel, 'baris FORCE CLOSE harus ada di riwayat');
        assert.ok(sel.filter((t) => t === '-').length >= 2, `uang fisik & selisih harus "-": ${JSON.stringify(sel)}`);
        assert.ok(!sel.includes('Rp 0'), `tidak boleh menampilkan Rp 0: ${JSON.stringify(sel)}`);
    });

    await check(report, CHECK_NAMES[15], async () => {
        await page.evaluate((id) => Shift.viewShiftDetail(id), state.shift3Id);
        await waitFor(page, () => (document.body.innerText || '').includes('- (Penutupan Paksa)'), {
            label: 'detail rekap penutupan paksa',
        });
        await tutupHasilModal(page);
    });

    await check(report, CHECK_NAMES[16], async () => {
        const harian = await page.evaluate(() => API.report.harian());
        assert.strictEqual(harian.tanggal, state.today, `tanggal laporan harus hari ini: ${JSON.stringify(harian)}`);

        const db = await dbOne(
            `SELECT COALESCE(SUM(CASE WHEN jumlah > 0 THEN jumlah ELSE 0 END), 0)
                  - ABS(COALESCE(SUM(CASE WHEN jenis = 'refund_paket' THEN jumlah ELSE 0 END), 0)) AS total
             FROM transaksi WHERE date(dibuat_pada, '+${TZ_OFFSET_HOURS} hours') = ?`,
            [state.today]
        );
        const expected = Number(db.total);
        assert.strictEqual(Number(harian.total_billing), expected, `laporan harian harus sama dengan SUM DB hari ini (${expected})`);

        await tab(page, 'laporan');
        await page.evaluate((tgl) => Laporan.loadByDate(tgl, '', 1, ''), state.today);
        const teksNilai = await waitFor(page, () => {
            const label = Array.from(document.querySelectorAll('#laporan-area span'))
                .find((el) => (el.textContent || '').trim() === 'Total Pendapatan Billing');
            const nilai = label && label.nextElementSibling;
            return nilai && (nilai.textContent || '').trim() ? nilai.textContent.trim() : null;
        }, { label: 'kartu Total Pendapatan Billing' });

        const angkaUI = Number(teksNilai.replace(/[^\d]/g, ''));
        assert.strictEqual(angkaUI, expected, `kartu UI "${teksNilai}" harus sama dengan SUM DB (${expected})`);
        assert.strictEqual(expected, 25000, '15.000 seed + 5.000 shift 1 + 5.000 shift 2');
    });

    await check(report, CHECK_NAMES[17], async () => {
        const res = await page.request.get(
            `${BASE_URL}/api/v1/kasir/report/export/billing?tanggal=${state.today}`
        );
        assert.strictEqual(res.status(), 200);
        assert.ok(
            (res.headers()['content-type'] || '').includes('application/pdf'),
            `content-type harus PDF, dapat: ${res.headers()['content-type']}`
        );
        const buf = await res.body();
        assert.strictEqual(buf.slice(0, 4).toString(), '%PDF', 'badan respons harus PDF');

        // Tidak ada endpoint Excel/xlsx di aplikasi ini; PDF adalah satu-satunya export rincian.
        const xlsx = await page.request.get(
            `${BASE_URL}/api/v1/kasir/report/export/billing.xlsx?tanggal=${state.today}`
        );
        assert.notStrictEqual(xlsx.status(), 200, 'tidak boleh ada export Excel yang tidak diimplementasikan');
    });

    // Pembersihan catatan uji: instance/notes dipakai bersama, bukan bagian sandbox.
    try {
        const dihapus = await page.evaluate(async (nama) => {
            const hasil = [];
            for (const f of nama) {
                try {
                    await API.request(`/api/v1/kasir/notes/${encodeURIComponent(f)}`, { method: 'DELETE' });
                    hasil.push(f);
                } catch (_) {
                    // sudah tidak ada / gagal hapus: tidak menggagalkan suite
                }
            }
            return hasil;
        }, state.notesBaru || []);
        if (dihapus.length) console.log(`[auth_shift_notes] catatan uji dibersihkan: ${dihapus.join(', ')}`);
    } catch (err) {
        console.log(`[auth_shift_notes] pembersihan catatan dilewati: ${err.message}`);
    }

    return finish(report);
}

module.exports = { runAuthShiftNotesE2ETest };
