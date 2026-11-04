'use strict';

/**
 * Task 13 — 8 portal publik dengan data nyata dari DB sandbox.
 *
 * Kontrak tiap check: teks DOM dibandingkan langsung dengan hasil `dbQuery`,
 * transisi state (sesi dibuka -> status TV berubah), aritmatika sisa PC, atau
 * kontrak status/error HTTP. "Halaman balas 200" bukan check.
 *
 * Catatan perilaku produk (diverifikasi, bukan asumsi plan):
 * - Landing TIDAK memuat daftar paket; ia memakai `warnet_title` dari settings.
 * - `/games` merender seluruh katalog; pagination `limit`/`offset` hanya ada di
 *   endpoint `/api/v1/public/game/all`, bukan di halaman.
 * - `/spesifikasi` menampilkan SEMUA PC aktif; hanya PC yang punya baris
 *   `hardware_monitor` yang terisi, sisanya "Belum Terkumpul".
 * - `/tv` dan `/tv/static` memakai template yang sama (`tv/static.html`) dan
 *   keduanya polling JSON tiap 10 detik; cache payload 5 detik.
 * - `/livepc` adalah peta status PC, bukan leaderboard skor.
 */

const assert = require('assert');
const { BASE_URL, login, api, waitFor, unique, check } = require('./lib/harness');
const { dbQuery, dbExec } = require('./lib/db');
const { createReport, finish } = require('./lib/report');

const CHECK_NAMES = [
    'Landing / menampilkan judul dan badge dari settings warnet_title di DB',
    '/paket menampilkan semua paket aktif dengan durasi dan harga persis dari DB',
    '/games merender seluruh katalog aktif berurutan sesuai DB',
    'API /api/v1/public/game/all menghormati limit/offset tanpa tumpang tindih',
    '/spesifikasi menampilkan PC-01 dengan trio CPU/GPU/RAM dari hardware_monitor',
    '/spesifikasi mencari kode PC dan menyaring kartu menjadi tepat satu',
    '/tv merender grup PC dan running text dari settings, payload sama dengan DOM',
    '/tv payload berubah menjadi terpakai setelah sesi dibuka (cache 5 detik)',
    '/livepc mencerminkan sesi aktif dan menghitung sisa PC kosong',
    '/member/login menolak password salah dengan 401',
    '/member/login menerima member1 dan dashboard menampilkan sisa menit DB',
    '/member/login menolak member kadaluarsa dengan 403 "Masa aktif member sudah kadaluarsa"',
    '8 portal punya <title> wajar dan tanpa overflow horizontal di 390 px'
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function dbOne(sql, params) {
    const rows = await dbQuery(sql, params);
    if (rows.length !== 1) throw new Error(`harus 1 baris, dapat ${rows.length}: ${JSON.stringify(rows)}`);
    return rows[0];
}

/** Polling nilai di DOM dengan argumen, batas 5 detik tanpa waitForTimeout. */
async function pageWait(page, fn, arg, label, timeout = 5000) {
    const deadline = Date.now() + timeout;
    let last;
    while (Date.now() < deadline) {
        last = await page.evaluate(fn, arg);
        if (last) return last;
        await sleep(100);
    }
    throw new Error(`${label} tidak terpenuhi dalam ${timeout} ms (nilai terakhir: ${JSON.stringify(last)})`);
}

async function getJson(page, path) {
    const res = await page.request.get(`${BASE_URL}${path}`);
    const body = await res.json().catch(() => ({}));
    return { status: res.status(), body };
}

/** PUT settings butuh CSRF dari meta halaman kasir yang sedang terbuka. */
async function putSetting(page, key, value) {
    const token = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') : '';
    });
    return page.request.put(`${BASE_URL}/api/v1/kasir/settings/${key}`, {
        headers: { 'X-CSRFToken': token, 'Content-Type': 'application/json' },
        data: { value }
    });
}

function rupiah(n) {
    return `Rp${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

function naturalSort(values) {
    return [...values].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }));
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
    throw new Error(`toast "${needle}" tidak muncul; toast terakhir: "${await portalToastText(page)}"`);
}

async function loginMember(page, username, password) {
    await page.goto(`${BASE_URL}/member/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('#username', username);
    await page.fill('#password', password);
    const responsePromise = page.waitForResponse(
        (res) => res.url().includes('/member/login') && res.request().method() === 'POST',
        { timeout: 5000 }
    );
    await page.click('#btn-login');
    const res = await responsePromise;
    return { status: res.status(), body: await res.json().catch(() => ({})) };
}

async function runPublicPortalsCMSE2ETest(page) {
    const report = createReport('public_portals_cms');
    const state = {};

    try {
        await login(page, 'admin');
    } catch (err) {
        for (const name of CHECK_NAMES) {
            await check(report, name, async () => { throw err; });
        }
        return finish(report);
    }

    // 1. Landing memakai warnet_title dari DB (bukan paket; template landing
    //    memang tidak punya daftar harga).
    await check(report, CHECK_NAMES[0], async () => {
        const title = unique('Arena E2E');
        state.warnetTitle = title;

        const res = await putSetting(page, 'warnet_title', title);
        assert.strictEqual(res.status(), 200, 'simpan warnet_title harus 200');

        const row = await dbOne("SELECT value FROM settings WHERE key = 'warnet_title'");
        assert.strictEqual(row.value, title);

        await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
        const rendered = await page.evaluate(() => ({
            title: document.title,
            body: document.body.innerText
        }));
        assert.strictEqual(rendered.title, `Beranda | ${title}`);
        // CSS `uppercase` mengubah innerText, jadi bandingkan case-insensitive
        // terhadap nilai yang benar-benar tersimpan di DB.
        assert.ok(
            rendered.body.toUpperCase().includes(`WELCOME TO ${row.value}`.toUpperCase()),
            'badge hero harus memakai warnet_title dari DB'
        );
    });

    // 2. /paket: setiap paket aktif beserta durasi dan harga dari DB.
    await check(report, CHECK_NAMES[1], async () => {
        const pakets = await dbQuery(
            `SELECT p.nama, p.durasi_menit, p.harga, g.nama AS grup
             FROM paket p JOIN grup g ON p.grup_id = g.id
             WHERE p.aktif = 1 ORDER BY p.id`
        );
        assert.ok(pakets.length > 0, 'seed harus punya paket aktif');

        await page.goto(`${BASE_URL}/paket`, { waitUntil: 'domcontentloaded' });
        const items = await pageWait(
            page,
            (expected) => {
                const nodes = Array.from(document.querySelectorAll('.group-pkg-item'));
                if (nodes.length !== expected) return false;
                return nodes.map((n) => n.innerText.replace(/\s+/g, ' ').trim());
            },
            pakets.length,
            `jumlah .group-pkg-item = ${pakets.length}`
        );

        for (const p of pakets) {
            const expected = [`${p.durasi_menit} Menit`, rupiah(p.harga)];
            const match = items.find((text) => text.includes(p.nama));
            assert.ok(match, `paket "${p.nama}" tidak dirender`);
            for (const needle of expected) {
                assert.ok(match.includes(needle), `paket "${p.nama}" harus memuat "${needle}", teks: "${match}"`);
            }
        }
    });

    // 3. /games: seluruh katalog aktif, urut nama seperti DB.
    await check(report, CHECK_NAMES[2], async () => {
        const tag = unique('game');
        const seeded = ['AAA ' + tag, 'MMM ' + tag, 'ZZZ ' + tag];
        for (const nama of seeded) {
            await dbExec("INSERT INTO game (nama, tipe, kategori, aktif) VALUES (?, 'game', 'E2E', 1)", [nama]);
        }

        const dbNames = (await dbQuery('SELECT nama FROM game WHERE aktif = 1 ORDER BY nama')).map((r) => r.nama);

        await page.goto(`${BASE_URL}/games`, { waitUntil: 'domcontentloaded' });
        const names = await pageWait(
            page,
            (expected) => {
                const cards = Array.from(document.querySelectorAll('#game-grid > div'));
                if (cards.length !== expected) return false;
                return cards.map((c) => (c.querySelector('h3') ? c.querySelector('h3').textContent.trim() : ''));
            },
            dbNames.length,
            `jumlah kartu game = ${dbNames.length}`
        );

        assert.deepStrictEqual(names, dbNames, 'urutan kartu game harus sama dengan ORDER BY nama di DB');
    });

    // 4. Pagination endpoint publik benar-benar memotong result set.
    await check(report, CHECK_NAMES[3], async () => {
        const dbNames = (await dbQuery('SELECT nama FROM game WHERE aktif = 1 ORDER BY nama')).map((r) => r.nama);
        assert.ok(dbNames.length >= 3, 'butuh minimal 3 game aktif untuk uji pagination');

        const first = await getJson(page, '/api/v1/public/game/all?limit=2&offset=0');
        assert.strictEqual(first.status, 200);
        assert.strictEqual(first.body.success, true);
        assert.deepStrictEqual(first.body.data.map((g) => g.nama), dbNames.slice(0, 2));

        const second = await getJson(page, '/api/v1/public/game/all?limit=2&offset=2');
        assert.strictEqual(second.status, 200);
        assert.deepStrictEqual(second.body.data.map((g) => g.nama), dbNames.slice(2, 4));

        const overlap = first.body.data
            .map((g) => g.nama)
            .filter((nama) => second.body.data.some((g) => g.nama === nama));
        assert.deepStrictEqual(overlap, [], 'halaman offset=2 tidak boleh mengulang isi offset=0');
    });

    // 5. /spesifikasi: PC-01 memakai nilai hardware_monitor dari DB.
    await check(report, CHECK_NAMES[4], async () => {
        const hw = await dbOne(
            'SELECT cpu_name, gpu_name, total_ram FROM hardware_monitor WHERE pc_id = (SELECT id FROM pc WHERE kode = ?)',
            ['PC-01']
        );

        await page.goto(`${BASE_URL}/spesifikasi`, { waitUntil: 'domcontentloaded' });
        const card = await pageWait(
            page,
            () => {
                const el = document.querySelector('.pc-spec-card[data-pc-kode="PC-01"]');
                return el ? el.innerText.replace(/\s+/g, ' ').trim() : false;
            },
            null,
            'kartu spesifikasi PC-01'
        );

        for (const value of [hw.cpu_name, hw.gpu_name, hw.total_ram]) {
            assert.ok(card.includes(value), `kartu PC-01 harus memuat "${value}", teks: "${card}"`);
        }

        const other = await page.evaluate(() => {
            const el = document.querySelector('.pc-spec-card[data-pc-kode="PC-02"]');
            return el ? el.innerText.replace(/\s+/g, ' ').trim() : null;
        });
        assert.ok(other, 'PC-02 tetap ditampilkan walau baseline hardware belum ada');
        assert.ok(other.includes('Belum Terkumpul'), 'PC tanpa hardware_monitor harus berlabel "Belum Terkumpul"');
    });

    // 6. Search debounce menyaring kartu ke tepat satu kode.
    await check(report, CHECK_NAMES[5], async () => {
        await page.fill('#specs-search-input', 'PC-03');
        const visible = await pageWait(
            page,
            () => {
                const cards = Array.from(document.querySelectorAll('.pc-spec-card:not(.hidden)'));
                if (cards.length !== 1) return false;
                return cards.map((c) => c.getAttribute('data-pc-kode'));
            },
            null,
            'filter pencarian menyisakan 1 kartu'
        );
        assert.deepStrictEqual(visible, ['PC-03']);
    });

    // 7. /tv: judul + running text dari settings, payload == DOM.
    await check(report, CHECK_NAMES[6], async () => {
        const runningText = unique('Running E2E');
        state.runningText = runningText;
        // Kembali ke dashboard: PUT settings butuh meta csrf-token kasir.
        await login(page, 'admin');
        const put = await putSetting(page, 'tv_running_text', runningText);
        assert.strictEqual(put.status(), 200);

        const dbPcs = await dbQuery('SELECT kode, grup_id FROM pc WHERE aktif = 1');
        assert.ok(dbPcs.length > 0);

        await page.goto(`${BASE_URL}/tv`, { waitUntil: 'domcontentloaded' });
        const dom = await pageWait(
            page,
            (expected) => {
                const row = document.getElementById('pc-groups-row');
                const title = document.getElementById('warnet-title');
                const running = document.getElementById('tv-running-text');
                if (!row || !title || !running) return false;
                if (!title.textContent.includes(expected.title)) return false;
                if (!running.textContent.includes(expected.running)) return false;
                const codes = Array.from(row.textContent.matchAll(/PC-\d+/g)).map((m) => m[0]);
                if (new Set(codes).size !== expected.count) return false;
                return Array.from(new Set(codes)).sort();
            },
            { title: state.warnetTitle, running: runningText, count: dbPcs.length },
            'DOM TV memuat judul, running text, dan semua kode PC'
        );

        const payload = await getJson(page, '/api/v1/public/tv/data');
        assert.strictEqual(payload.status, 200);
        assert.strictEqual(payload.body.success, true);
        const data = payload.body.data;
        assert.strictEqual(data.settings.warnet_title, state.warnetTitle);
        assert.strictEqual(data.settings.running_text, runningText);
        assert.deepStrictEqual(
            naturalSort(data.pc_list.map((p) => p.kode)),
            naturalSort(dbPcs.map((p) => p.kode))
        );
        state.tvBaseline = {
            aktif: data.occupancy.pc_aktif,
            pc02: data.pc_list.find((p) => p.kode === 'PC-02')
        };
        assert.strictEqual(state.tvBaseline.pc02.status, 'kosong');
        assert.ok(dom.every((kode) => data.pc_list.some((p) => p.kode === kode)));
    });

    // 8. Sesi baru -> payload TV berubah setelah cache 5 detik lewat.
    await check(report, CHECK_NAMES[7], async () => {
        // API.sesi hanya hidup di dashboard kasir; kembali ke sana dulu.
        await login(page, 'admin');
        const paket = await dbOne("SELECT id FROM paket WHERE nama = '1 Jam Reguler'");
        const opened = await api(page, `API.sesi.bukaGuest("PC-02", ${paket.id}, "Guest E2E")`);
        assert.strictEqual(opened.success, true);
        state.guestSesi = opened.sesi_id;

        const deadline = Date.now() + 5000;
        let data;
        while (Date.now() < deadline) {
            const res = await getJson(page, '/api/v1/public/tv/data');
            data = res.body.data;
            const pc = data.pc_list.find((p) => p.kode === 'PC-02');
            if (pc && pc.status === 'terpakai') break;
            await sleep(200);
        }
        const pc02 = data.pc_list.find((p) => p.kode === 'PC-02');
        assert.strictEqual(pc02.status, 'terpakai', 'PC-02 harus terpakai di payload TV setelah sesi dibuka');
        assert.strictEqual(data.occupancy.pc_aktif, state.tvBaseline.aktif + 1);

        await page.goto(`${BASE_URL}/tv`, { waitUntil: 'domcontentloaded' });
        const cardText = await pageWait(
            page,
            () => {
                const card = Array.from(document.querySelectorAll('#pc-groups-row .h-11'))
                    .find((el) => el.textContent.includes('PC-02'));
                return card ? card.innerText.replace(/\s+/g, ' ').trim() : false;
            },
            null,
            'kartu PC-02 di TV'
        );
        assert.ok(!/KOSONG/.test(cardText), `kartu PC-02 tidak boleh lagi KOSONG: "${cardText}"`);
    });

    // 9. /livepc: status sesi aktif + hitungan PC kosong.
    await check(report, CHECK_NAMES[8], async () => {
        const total = (await dbOne('SELECT COUNT(*) AS n FROM pc WHERE aktif = 1')).n;
        const aktif = (await dbOne("SELECT COUNT(*) AS n FROM sesi WHERE status = 'aktif'")).n;
        const dbKodes = naturalSort((await dbQuery('SELECT kode FROM pc WHERE aktif = 1')).map((r) => r.kode));

        await page.goto(`${BASE_URL}/livepc`, { waitUntil: 'domcontentloaded' });
        const rendered = await pageWait(
            page,
            (expected) => {
                const cards = Array.from(document.querySelectorAll('#pc-container .pc-group-grid > div'));
                if (cards.length !== expected) return false;
                const counter = document.getElementById('pc-counter');
                if (!counter || !counter.textContent.includes('PC Tersedia')) return false;
                return {
                    kodes: cards.map((c) => {
                        const span = c.querySelector('span.font-mono');
                        return span ? span.textContent.trim() : '';
                    }),
                    counter: counter.textContent.replace(/\s+/g, ' ').trim(),
                    pc02: cards
                        .filter((c) => c.textContent.includes('PC-02'))
                        .map((c) => c.innerText.replace(/\s+/g, ' ').trim())
                };
            },
            total,
            `jumlah kartu /livepc = ${total}`
        );

        assert.deepStrictEqual(rendered.kodes, dbKodes, 'urutan kartu harus natural sort kode PC dari DB');
        assert.ok(rendered.counter.includes(`${total - aktif} / ${total} PC Tersedia`), `counter salah: "${rendered.counter}"`);
        assert.strictEqual(rendered.pc02.length, 1);
        assert.ok(/SISA:/.test(rendered.pc02[0]), `PC-02 dengan sesi aktif harus menampilkan SISA: "${rendered.pc02[0]}"`);
    });

    // 10. Password salah -> 401, tetap di halaman login.
    await check(report, CHECK_NAMES[9], async () => {
        const res = await loginMember(page, 'member1', 'salah-total');
        assert.strictEqual(res.status, 401);
        assert.strictEqual(res.body.error, 'Password yang Anda masukkan salah');
        const toast = await waitPortalToast(page, 'salah');
        assert.ok(/salah/i.test(toast));
        assert.ok(page.url().includes('/member/login'));
    });

    // 11. Kredensial benar -> dashboard, sisa menit == DB.
    await check(report, CHECK_NAMES[10], async () => {
        const db = await dbOne("SELECT waktu_tersimpan FROM member WHERE username = 'member1'");
        const res = await loginMember(page, 'member1', 'pass123');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        await page.waitForURL(/\/member(\/dashboard)?\/?$/, { timeout: 5000 });

        const match = (await page.evaluate(() => document.body.innerText)).match(/Total Sisa:\s*(\d+)\s*Menit/);
        assert.ok(match, 'dashboard member harus menampilkan "Total Sisa: N Menit"');
        assert.strictEqual(Number(match[1]), db.waktu_tersimpan);
    });

    // 12. Member kadaluarsa -> 403 dengan pesan eksak (fix Task 7).
    await check(report, CHECK_NAMES[11], async () => {
        const expired = await dbOne(
            "SELECT kadaluarsa_pada, aktif FROM member WHERE username = 'member_expired'"
        );
        assert.strictEqual(expired.aktif, 1, 'member_expired seed harus aktif agar yang diuji benar-benar masa aktif');
        assert.ok(expired.kadaluarsa_pada, 'seed member_expired harus punya kadaluarsa_pada');

        await page.context().clearCookies();
        const res = await loginMember(page, 'member_expired', 'pass123');
        assert.strictEqual(res.status, 403);
        assert.strictEqual(res.body.error, 'Masa aktif member sudah kadaluarsa');
        const toast = await waitPortalToast(page, 'kadaluarsa');
        assert.ok(/kadaluarsa/i.test(toast));
        assert.ok(page.url().includes('/member/login'));

        await page.goto(`${BASE_URL}/member`, { waitUntil: 'domcontentloaded' });
        assert.ok(page.url().includes('/member/login'), 'dashboard member harus menolak sesi kadaluarsa');
    });

    // 13. Semua portal: title wajar + tidak overflow di 390 px.
    await check(report, CHECK_NAMES[12], async () => {
        await page.context().clearCookies();
        await page.setViewportSize({ width: 390, height: 844 });
        try {
            const portals = [
                { path: '/', title: `Beranda | ${state.warnetTitle}` },
                { path: '/paket', title: `Daftar Paket | ${state.warnetTitle}` },
                { path: '/games', title: `Daftar Aplikasi & Game | ${state.warnetTitle}` },
                { path: '/spesifikasi', title: `Spesifikasi PC | ${state.warnetTitle}` },
                { path: '/livepc', title: `Peta PC Live | ${state.warnetTitle}` },
                { path: '/member/login', title: `Login Member | ${state.warnetTitle}` },
                { path: '/tv', title: 'TMBilling - TV Signage (Dashboard Mode)' },
                { path: '/tv/static', title: 'TMBilling - TV Signage (Dashboard Mode)' }
            ];

            for (const portal of portals) {
                const response = await page.goto(`${BASE_URL}${portal.path}`, { waitUntil: 'domcontentloaded' });
                assert.strictEqual(response.status(), 200, `${portal.path} harus 200`);
                const info = await page.evaluate(() => ({
                    title: document.title,
                    scrollWidth: document.documentElement.scrollWidth,
                    innerWidth: window.innerWidth
                }));
                assert.strictEqual(info.title, portal.title, `title ${portal.path} tidak sesuai`);
                assert.ok(
                    info.scrollWidth <= info.innerWidth + 1,
                    `${portal.path} overflow horizontal: scrollWidth ${info.scrollWidth} > ${info.innerWidth}`
                );
            }

            // /tv/static adalah template yang sama dengan /tv: data PC ikut ter-render.
            await page.goto(`${BASE_URL}/tv/static`, { waitUntil: 'domcontentloaded' });
            await waitFor(page, () => {
                const row = document.getElementById('pc-groups-row');
                return row && /PC-\d+/.test(row.textContent);
            }, { label: 'kartu PC di /tv/static' });
        } finally {
            await page.setViewportSize({ width: 1280, height: 720 });
        }
    });

    return finish(report);
}

module.exports = { runPublicPortalsCMSE2ETest };
