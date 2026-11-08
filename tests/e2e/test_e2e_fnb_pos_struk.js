'use strict';

/**
 * Task 6 — POS kantin, stok atomik, struk.
 *
 * Kontrak tiap check (spec §6): buktikan transisi state setelah aksi user,
 * baris DB yang independen, aritmatika uang eksak, atau kontrak error.
 * Keberadaan elemen saja bukan check.
 *
 * Catatan kontrak produk yang ditemukan saat menulis suite ini:
 * - Checkout TIDAK menulis `menu_stock_log`; hanya restock yang menulis log.
 *   Check 3 memverifikasi jumlah log tidak berubah oleh penjualan.
 * - Keranjang UI tidak bisa melebihi stok (addToCart membatasi), jadi skenario
 *   oversell dibuktikan lewat race stok (stok DB diubah setelah masuk keranjang)
 *   dan lewat API dengan qty > stok.
 */

const assert = require('assert');
const { login, tab, api, waitFor, unique, check } = require('./lib/harness');
const { dbQuery, dbExec } = require('./lib/db');
const { createReport, finish } = require('./lib/report');

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

/** Tunggu sampai fn(arg) di halaman memenuhi predicate (dijalankan di Node). */
async function evalWait(page, fn, arg, predicate, label, timeout = 5000) {
    const deadline = Date.now() + timeout;
    let last;
    let lastError = null;
    while (Date.now() < deadline) {
        try {
            last = await page.evaluate(fn, arg);
            lastError = null;
        } catch (err) {
            last = undefined;
            lastError = err && err.message ? err.message : String(err);
            await sleep(100);
            continue;
        }
        if (predicate(last)) return last;
        await sleep(100);
    }
    throw new Error(`${label} tidak terpenuhi dalam ${timeout}ms (nilai terakhir: ${JSON.stringify(last)}, error: ${lastError})`);
}

function rpInt(text) {
    const match = String(text || '').match(/\d[\d.]*/);
    return match ? parseInt(match[0].replace(/\./g, ''), 10) : NaN;
}

function formatRp(n) {
    return `Rp${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

async function menuByName(nama) {
    const rows = await dbQuery('SELECT id, nama, harga, stok, is_active FROM menu_item WHERE nama = ?', [nama]);
    if (rows.length !== 1) throw new Error(`Menu '${nama}' tidak ditemukan di DB sandbox`);
    return rows[0];
}

function cardSelector(nama) {
    return `#menu-catalog-grid div[title^="${nama} (Klik Kiri"]`;
}

async function openMenuTab(page) {
    await tab(page, 'menu');
    await page.waitForSelector('#menu-catalog-grid', { state: 'visible', timeout: 5000 });
}

async function clickMenuCard(page, nama) {
    await page.locator(`${cardSelector(nama)} h4`).first().click();
}

async function waitToast(page, pattern, label) {
    return evalWait(
        page,
        () => Array.from(document.querySelectorAll('span.text-sm.font-medium'))
            .map((s) => (s.textContent || '').trim()).join(' | '),
        null,
        (text) => pattern.test(String(text)),
        label
    );
}

/** Kosongkan keranjang lewat API modul agar tiap check mulai dari state bersih. */
async function clearCart(page) {
    await page.evaluate(() => {
        if (window.Menu && Menu.cart && Menu.cart.length) Menu.clearCart();
    });
    await waitFor(page, () => document.getElementById('menu-cart-count-badge').textContent.trim() === '0 item', {
        label: 'keranjang kosong',
    });
}

async function openCheckoutModal(page) {
    await page.locator('#tab-menu button', { hasText: 'Proses & Cetak Transaksi' }).first().click();
    await page.waitForSelector('#payment-tunai-input', { state: 'visible', timeout: 5000 });
    await page.waitForSelector('#btn-submit-payment', { state: 'visible', timeout: 5000 });
}

/** Isi tunai, pastikan kembalian UI dihitung, submit. Kembalikan teks kembalian. */
async function payCart(page, tunai) {
    await page.fill('#payment-tunai-input', String(tunai));
    const kembalian = await evalWait(
        page,
        () => {
            const el = document.getElementById('payment-kembalian-text');
            return el ? el.textContent.trim() : '';
        },
        null,
        (text) => text && /Rp/.test(text),
        'kembalian dihitung di modal pembayaran'
    );
    await page.click('#btn-submit-payment');
    return kembalian;
}

async function dismissPrintConfirm(page) {
    await page.waitForSelector('#modal-confirm-btn', { state: 'visible', timeout: 5000 });
    await page.click('#modal-cancel-btn');
    await waitFor(page, () => {
        const el = document.getElementById('modal-confirm-btn');
        return !el || el.offsetParent === null;
    }, { label: 'modal konfirmasi cetak tertutup' });
}

async function runFnBPosStrukE2ETest(page) {
    const report = createReport('fnb_pos');

    try {
        await login(page, 'admin');
    } catch (err) {
        check(report, 'Login admin', async () => { throw err; });
        return finish(report);
    }

    const state = {
        menu: null,
        restockNote: null,
        nota1: null,
        nota2: null,
        total1: null,
        firstTmId: null,
        rows1: null,
        aqua: null,
    };

    await check(report, 'Buat menu via form POS: harga & stok tersimpan persis di DB', async () => {
        const nama = unique('MenuE2E');
        const harga = 13500;
        const stok = 8;

        await openMenuTab(page);
        await page.click('#tab-menu button[onclick="Menu.showAddModal()"]');
        await page.waitForSelector('#menu-modal:not(.hidden)', { state: 'visible', timeout: 5000 });
        await page.fill('#menu-nama-input', nama);
        await page.fill('#menu-harga-input', String(harga));
        await page.fill('#menu-stok-input', String(stok));
        await page.click('#menu-btn-save');

        const rows = await dbWait(
            'SELECT id, nama, harga, stok, is_active FROM menu_item WHERE nama = ?',
            [nama],
            (r) => r.length === 1,
            'menu baru tersimpan'
        );
        assert.strictEqual(Number(rows[0].harga), harga, 'harga DB harus persis input');
        assert.strictEqual(Number(rows[0].stok), stok, 'stok DB harus persis input');
        assert.strictEqual(Number(rows[0].is_active), 1, 'menu baru harus aktif');

        await page.waitForSelector(`#menu-catalog-grid h4[title="${nama}"]`, { state: 'visible', timeout: 5000 });
        const card = await page.locator(cardSelector(nama)).first().innerText();
        assert.ok(/Stok:\s*8\b/.test(card), `kartu harus menampilkan Stok: 8, dapat: ${card}`);

        state.menu = { id: rows[0].id, nama, harga, stok };
    });

    await check(report, 'Restock +20 via UI: stok naik persis 20 dan satu log RESTOCK tercatat', async () => {
        assert.ok(state.menu, 'prasyarat: menu uji belum dibuat');
        const note = unique('RestockE2E');
        state.restockNote = note;

        await openMenuTab(page);
        const card = page.locator(cardSelector(state.menu.nama)).first();
        await card.hover();
        await card.locator('button[title="Tambah Stok (Restock)"]').click();
        await page.waitForSelector('#menu-restock-modal:not(.hidden)', { state: 'visible', timeout: 5000 });
        await page.fill('#menu-restock-qty-input', '20');
        await page.fill('#menu-restock-notes-input', note);
        await page.click('#menu-btn-save-restock');

        const expected = state.menu.stok + 20;
        await dbWait(
            'SELECT stok FROM menu_item WHERE id = ?',
            [state.menu.id],
            (r) => r.length === 1 && Number(r[0].stok) === expected,
            'stok bertambah tepat 20'
        );

        const logs = await dbWait(
            'SELECT tipe, jumlah_masuk, stok_sebelum, stok_sesudah, catatan FROM menu_stock_log WHERE menu_id = ? AND catatan = ?',
            [state.menu.id, note],
            (r) => r.length === 1,
            'log RESTOCK tersimpan'
        );
        assert.strictEqual(logs[0].tipe, 'RESTOCK');
        assert.strictEqual(Number(logs[0].jumlah_masuk), 20);
        assert.strictEqual(Number(logs[0].stok_sebelum), state.menu.stok);
        assert.strictEqual(Number(logs[0].stok_sesudah), expected);

        const stokText = await evalWait(
            page,
            (nama) => {
                const el = document.querySelector(`#menu-catalog-grid div[title^="${nama} (Klik Kiri"]`);
                return el ? el.innerText : null;
            },
            state.menu.nama,
            (text) => text && new RegExp(`Stok:\\s*${expected}\\b`).test(text),
            'kartu menampilkan stok baru'
        );
        assert.ok(stokText);

        state.menu.stok = expected;
    });

    await check(report, 'Checkout tunai 2 item: kembalian eksak, total DB, stok turun tepat, log penjualan tidak menulis stock log', async () => {
        assert.ok(state.restockNote, 'prasyarat: restock belum dilakukan');
        const indomie = await menuByName('Indomie Goreng');
        const kopi = await menuByName('Kopi Good Day');
        const logCountBefore = Number((await dbQuery('SELECT COUNT(*) AS c FROM menu_stock_log'))[0].c);

        const expectedTotal = indomie.harga * 2 + kopi.harga * 1;
        const tunai = 50000;
        const expectedKembalian = tunai - expectedTotal;

        await openMenuTab(page);
        await clickMenuCard(page, 'Indomie Goreng');
        await clickMenuCard(page, 'Indomie Goreng');
        await clickMenuCard(page, 'Kopi Good Day');
        await waitFor(page, () => document.getElementById('menu-cart-count-badge').textContent.trim() === '3 item', {
            label: 'keranjang berisi 3 item',
        });

        const cartTotal = rpInt(await page.textContent('#menu-cart-total'));
        assert.strictEqual(cartTotal, expectedTotal, 'total keranjang harus aritmatika harga seed');

        await openCheckoutModal(page);
        const kembalianText = await payCart(page, tunai);
        assert.strictEqual(rpInt(kembalianText), expectedKembalian, 'kembalian UI harus tunai - total');
        await waitToast(page, /Pembayaran berhasil/, 'toast pembayaran berhasil');
        await dismissPrintConfirm(page);

        const rows = await dbWait(
            'SELECT id, no_nota, menu_id, jumlah, total_harga, tunai, kembalian, pc_kode, metode_pembayaran FROM transaksi_menu WHERE menu_id IN (?, ?) ORDER BY id',
            [indomie.id, kopi.id],
            (r) => r.length === 2,
            'dua baris transaksi_menu'
        );
        const nota = rows[0].no_nota;
        assert.ok(/^TMM-\d{8}-\d{3}(-[0-9a-f]{6})?$/.test(nota), `format no_nota salah: ${nota}`);
        assert.ok(rows.every((r) => r.no_nota === nota), 'satu checkout harus satu no_nota');

        const rowIndomie = rows.find((r) => Number(r.menu_id) === Number(indomie.id));
        const rowKopi = rows.find((r) => Number(r.menu_id) === Number(kopi.id));
        assert.strictEqual(Number(rowIndomie.jumlah), 2);
        assert.strictEqual(Number(rowIndomie.total_harga), indomie.harga * 2);
        assert.strictEqual(Number(rowKopi.jumlah), 1);
        assert.strictEqual(Number(rowKopi.total_harga), kopi.harga);
        assert.strictEqual(Number(rowIndomie.tunai), tunai);
        assert.strictEqual(Number(rowIndomie.kembalian), expectedKembalian);
        assert.strictEqual(Number(rowKopi.kembalian), expectedKembalian);
        assert.strictEqual(rowIndomie.pc_kode, 'Tempat');
        assert.strictEqual(rowIndomie.metode_pembayaran, 'Tunai');
        assert.strictEqual(rows.reduce((sum, r) => sum + Number(r.total_harga), 0), expectedTotal);

        await dbWait('SELECT stok FROM menu_item WHERE id = ?', [indomie.id],
            (r) => Number(r[0].stok) === indomie.stok - 2, 'stok Indomie turun tepat 2');
        await dbWait('SELECT stok FROM menu_item WHERE id = ?', [kopi.id],
            (r) => Number(r[0].stok) === kopi.stok - 1, 'stok Kopi turun tepat 1');

        const logCountAfter = Number((await dbQuery('SELECT COUNT(*) AS c FROM menu_stock_log'))[0].c);
        assert.strictEqual(logCountAfter, logCountBefore, 'penjualan tidak boleh menulis menu_stock_log');

        state.nota1 = nota;
        state.total1 = expectedTotal;
        state.firstTmId = rows[0].id;
        state.rows1 = rows;
    });

    await check(report, 'Checkout kedua berurutan: no_nota baru unik & naik, stok Aqua turun tepat 1', async () => {
        assert.ok(state.nota1, 'prasyarat: checkout pertama belum terjadi');
        const aqua = await menuByName('Aqua Botol 600ml');
        state.aqua = aqua;

        await openMenuTab(page);
        await clickMenuCard(page, aqua.nama);
        await waitFor(page, () => document.getElementById('menu-cart-count-badge').textContent.trim() === '1 item', {
            label: 'keranjang berisi 1 item',
        });
        assert.strictEqual(rpInt(await page.textContent('#menu-cart-total')), aqua.harga);

        await openCheckoutModal(page);
        const kembalianText = await payCart(page, aqua.harga);
        assert.strictEqual(rpInt(kembalianText), 0, 'bayar pas harus kembalian nol');
        await waitToast(page, /Pembayaran berhasil/, 'toast checkout kedua');
        await dismissPrintConfirm(page);

        const rows = await dbWait(
            'SELECT id, no_nota, jumlah, total_harga, tunai, kembalian FROM transaksi_menu WHERE menu_id = ?',
            [aqua.id],
            (r) => r.length === 1,
            'baris transaksi Aqua'
        );
        const nota = rows[0].no_nota;
        assert.ok(/^TMM-\d{8}-\d{3}(-[0-9a-f]{6})?$/.test(nota));
        assert.notStrictEqual(nota, state.nota1, 'no_nota checkout kedua harus berbeda');
        const seq = (n) => Number(n.match(/-(\d{3})(?:-[0-9a-f]{6})?$/)[1]);
        assert.ok(seq(nota) > seq(state.nota1), `urutan nota harus naik: ${state.nota1} -> ${nota}`);
        assert.strictEqual(Number(rows[0].jumlah), 1);
        assert.strictEqual(Number(rows[0].total_harga), aqua.harga);
        assert.strictEqual(Number(rows[0].tunai), aqua.harga);
        assert.strictEqual(Number(rows[0].kembalian), 0);
        await dbWait('SELECT stok FROM menu_item WHERE id = ?', [aqua.id],
            (r) => Number(r[0].stok) === aqua.stok - 1, 'stok Aqua turun tepat 1');

        state.nota2 = nota;
    });

    await check(report, 'Oversell ditolak: stok tidak negatif dan tidak ada baris transaksi baru', async () => {
        assert.ok(state.aqua, 'prasyarat: checkout kedua belum terjadi');
        const menu = state.menu;

        await openMenuTab(page);
        await clearCart(page);
        await clickMenuCard(page, menu.nama);
        await waitFor(page, () => document.getElementById('menu-cart-count-badge').textContent.trim() === '1 item', {
            label: 'keranjang berisi 1 item menu uji',
        });

        // Simulasi stok diambil transaksi lain setelah item masuk keranjang.
        await dbExec('UPDATE menu_item SET stok = 0 WHERE id = ?', [menu.id]);
        const rowsBefore = Number((await dbQuery('SELECT COUNT(*) AS c FROM transaksi_menu WHERE menu_id = ?', [menu.id]))[0].c);

        await openCheckoutModal(page);
        await payCart(page, 20000);
        // UI menampilkan toast error generik dari catch (pesan stok server tidak diteruskan).
        await waitToast(page, /Gagal checkout|tidak mencukupi/i, 'toast penolakan stok dari checkout UI');

        const afterUi = await dbQuery('SELECT stok FROM menu_item WHERE id = ?', [menu.id]);
        assert.strictEqual(Number(afterUi[0].stok), 0, 'stok tidak boleh negatif');
        const rowsAfterUi = Number((await dbQuery('SELECT COUNT(*) AS c FROM transaksi_menu WHERE menu_id = ?', [menu.id]))[0].c);
        assert.strictEqual(rowsAfterUi, rowsBefore, 'checkout gagal tidak boleh menulis transaksi_menu');

        const clearBtn = page.locator('#menu-cart-clear-btn');
        await clearBtn.click();
        await waitFor(page, () => document.getElementById('menu-cart-count-badge').textContent.trim() === '0 item', {
            label: 'keranjang dikosongkan',
        });

        // Kasus eksak plan: stok 1, minta 2, lewat API.
        await dbExec('UPDATE menu_item SET stok = 1 WHERE id = ?', [menu.id]);
        const apiError = await page.evaluate(async ({ menuId }) => {
            try {
                await window.API.menu.checkout([{ menu_id: menuId, jumlah: 2 }], 'Tempat', 30000, 0, 'Tunai');
                return null;
            } catch (err) {
                return err && err.message ? err.message : String(err);
            }
        }, { menuId: menu.id });
        assert.ok(apiError && /tidak mencukupi/i.test(apiError), `API harus menolak oversell, dapat: ${apiError}`);

        const afterApi = await dbQuery('SELECT stok FROM menu_item WHERE id = ?', [menu.id]);
        assert.strictEqual(Number(afterApi[0].stok), 1, 'stok tetap 1 setelah penolakan');
        const rowsAfterApi = Number((await dbQuery('SELECT COUNT(*) AS c FROM transaksi_menu WHERE menu_id = ?', [menu.id]))[0].c);
        assert.strictEqual(rowsAfterApi, rowsBefore, 'API oversell tidak boleh menulis transaksi_menu');

        await dbExec('UPDATE menu_item SET stok = ? WHERE id = ?', [state.menu.stok - 2, menu.id]);
    });

    await check(report, 'Menu stok kosong seed tidak bisa masuk keranjang dan ditolak API', async () => {
        const kosong = await menuByName('Stok Kosong Uji');
        assert.strictEqual(Number(kosong.stok), 0);

        await openMenuTab(page);
        await clearCart(page);
        await clickMenuCard(page, kosong.nama);
        await page.waitForSelector('#menu-restock-modal:not(.hidden)', { state: 'visible', timeout: 5000 });
        const badge = (await page.textContent('#menu-cart-count-badge')).trim();
        assert.strictEqual(badge, '0 item', 'klik menu habis tidak boleh menambah keranjang');
        await page.locator('#menu-restock-modal button[onclick="Menu.closeRestockModal()"]').first().click();
        await page.waitForSelector('#menu-restock-modal', { state: 'hidden', timeout: 5000 });

        const rowsBefore = Number((await dbQuery('SELECT COUNT(*) AS c FROM transaksi_menu WHERE menu_id = ?', [kosong.id]))[0].c);
        const apiError = await page.evaluate(async ({ menuId }) => {
            try {
                await window.API.menu.checkout([{ menu_id: menuId, jumlah: 1 }], 'Tempat', 5000, 0, 'Tunai');
                return null;
            } catch (err) {
                return err && err.message ? err.message : String(err);
            }
        }, { menuId: kosong.id });
        assert.ok(apiError && /tidak mencukupi/i.test(apiError), `API harus menolak stok 0, dapat: ${apiError}`);

        const rowsAfter = Number((await dbQuery('SELECT COUNT(*) AS c FROM transaksi_menu WHERE menu_id = ?', [kosong.id]))[0].c);
        assert.strictEqual(rowsAfter, rowsBefore, 'penolakan stok 0 tidak boleh menulis transaksi_menu');
    });

    await check(report, 'Arsip menu: pindah ke daftar arsip dengan hitungan transaksi benar, lalu pulihkan', async () => {
        const indomie = await menuByName('Indomie Goreng');
        const soldRows = Number((await dbQuery('SELECT COUNT(*) AS c FROM transaksi_menu WHERE menu_id = ?', [indomie.id]))[0].c);
        assert.strictEqual(soldRows, 1, 'Indomie harus punya 1 baris transaksi sebelum arsip');

        await openMenuTab(page);
        await page.evaluate(() => { if (window.Menu) Menu.closeRestockModal(); });
        await clearCart(page);
        page.once('dialog', (dialog) => dialog.accept());
        const card = page.locator(cardSelector(indomie.nama)).first();
        await card.hover();
        await card.locator('button[title="Arsipkan Menu"]').click();

        await dbWait('SELECT is_active FROM menu_item WHERE id = ?', [indomie.id],
            (r) => Number(r[0].is_active) === 0, 'menu terarsip di DB');
        await evalWait(
            page,
            (nama) => document.querySelectorAll(`#menu-catalog-grid div[title^="${nama} (Klik Kiri"]`).length,
            indomie.nama,
            (count) => count === 0,
            'kartu hilang dari katalog aktif'
        );

        await page.click('#menu-tab-archived-btn');
        // Tampilan arsip memakai grid katalog yang sama (#menu-catalog-grid), bukan grid terpisah.
        await page.waitForSelector(`#menu-catalog-grid h4[title="${indomie.nama}"]`, { state: 'visible', timeout: 5000 });
        const archivedCard = page.locator(`#menu-catalog-grid div:has(h4[title="${indomie.nama}"])`).first();
        const archivedText = await archivedCard.innerText();
        assert.ok(new RegExp(`${soldRows} transaksi historis`).test(archivedText),
            `arsip harus menampilkan ${soldRows} transaksi historis, dapat: ${archivedText}`);

        await archivedCard.locator('button', { hasText: 'Pulihkan' }).click();
        await dbWait('SELECT is_active FROM menu_item WHERE id = ?', [indomie.id],
            (r) => Number(r[0].is_active) === 1, 'menu dipulihkan di DB');
        await page.click('#menu-tab-active-btn');
        await page.waitForSelector(cardSelector(indomie.nama), { state: 'visible', timeout: 5000 });
        const historyRows = Number((await dbQuery('SELECT COUNT(*) AS c FROM transaksi_menu WHERE menu_id = ?', [indomie.id]))[0].c);
        assert.strictEqual(historyRows, soldRows, 'pemulihan tidak boleh mengubah riwayat transaksi');
    });

    await check(report, 'Tab laporan menu: total hari ini sama dengan SUM transaksi_menu di DB', async () => {
        assert.ok(state.nota2, 'prasyarat: kedua checkout belum terjadi');
        const sum = await dbQuery('SELECT COALESCE(SUM(total_harga), 0) AS total, COUNT(DISTINCT no_nota) AS notas FROM transaksi_menu');
        const expectedTotal = Number(sum[0].total);
        const expectedNotas = Number(sum[0].notas);
        assert.strictEqual(expectedNotas, 2, 'sandbox harus berisi tepat 2 nota FnB');
        assert.strictEqual(expectedTotal, state.total1 + state.aqua.harga);

        await tab(page, 'laporan_menu');
        const summary = await evalWait(
            page,
            () => {
                const area = document.getElementById('laporan-menu-area');
                if (!area) return null;
                const spans = Array.from(area.querySelectorAll('span'));
                const totalLabel = spans.find((s) => s.textContent.trim() === 'Total Pendapatan Kantin & F&B');
                const notaLabel = spans.find((s) => s.textContent.trim() === 'Total Transaksi Nota');
                if (!totalLabel || !notaLabel) return null;
                const totalEl = totalLabel.parentElement.querySelector('span[title]');
                const notaEl = notaLabel.parentElement.querySelectorAll('span')[1];
                return {
                    total: totalEl ? totalEl.textContent.trim() : null,
                    nota: notaEl ? notaEl.textContent.trim() : null,
                };
            },
            null,
            (value) => value && rpInt(value.total) === expectedTotal && Number(value.nota) === expectedNotas,
            'ringkasan laporan menu sesuai DB'
        );
        assert.strictEqual(rpInt(summary.total), expectedTotal);
        assert.strictEqual(Number(summary.nota), expectedNotas);
    });

    await check(report, 'Tab struk: preview nota pertama dan API strukMenu sama dengan total DB', async () => {
        assert.ok(state.nota1 && state.firstTmId, 'prasyarat: checkout pertama belum terjadi');
        const expectedTotal = state.total1;
        const expectedKembalian = 50000 - expectedTotal;

        await tab(page, 'struk');
        await page.click('#struk-sub-kantin');
        await evalWait(
            page,
            () => document.querySelectorAll('#struk-history-list .struk-history-card').length,
            null,
            (count) => count >= 2,
            'riwayat struk kantin dimuat'
        );

        const historyCard = page.locator('#struk-history-list .struk-history-card', { hasText: state.nota1 }).first();
        await historyCard.click();
        // Kartu riwayat bisa merender nominal mentah ("26000") bila window.Utils tidak terpasang.
        const cardTotal = await historyCard.locator('div.text-xs.font-bold.text-neutral-100').first().innerText();
        assert.strictEqual(rpInt(cardTotal), expectedTotal,
            'nominal pada kartu riwayat harus sama dengan total nota');

        const preview = await evalWait(
            page,
            (nota) => {
                const el = document.querySelector('#struk-preview .thermal-paper');
                return el && el.innerText.includes(nota) ? el.innerText : null;
            },
            state.nota1,
            (text) => typeof text === 'string' && text.includes('TOTAL BAYAR'),
            'preview struk dirender'
        );
        assert.ok(preview.includes(state.nota1));
        assert.strictEqual(rpInt(preview.match(/TOTAL BAYAR\s+Rp?\s*([\d.]+)/)[1]), expectedTotal);
        assert.strictEqual(rpInt(preview.match(/Uang Tunai\s+Rp?\s*([\d.]+)/)[1]), 50000);
        assert.strictEqual(rpInt(preview.match(/Kembalian\s+Rp?\s*([\d.]+)/)[1]), expectedKembalian);

        const res = await api(page, `API.report.strukMenu(${state.firstTmId})`);
        assert.strictEqual(res.no_nota, state.nota1);
        assert.strictEqual(res.tipe, 'kantin');
        assert.strictEqual(Number(res.total_harga), expectedTotal);
        assert.strictEqual(Number(res.tunai), 50000);
        assert.strictEqual(Number(res.kembalian), expectedKembalian);
        assert.strictEqual(res.rincian.length, 2, 'rincian harus berisi dua item');
        assert.strictEqual(res.rincian.reduce((sum, r) => sum + Number(r.harga), 0), expectedTotal);
    });

    return finish(report);
}

module.exports = { runFnBPosStrukE2ETest };
