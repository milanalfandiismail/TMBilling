'use strict';

/**
 * Task 11 — Admin: user/RBAC, redaksi settings, audit log, token klien,
 * plugin, dan penghapusan file explorer.
 *
 * Kontrak tiap check: hasil otorisasi (403/401), baris DB sandbox yang dibaca
 * ulang, atau nilai yang dibandingkan dengan sumber independen (manifest,
 * payload admin). Keberadaan elemen saja bukan check.
 *
 * Perilaku produk yang SENGAJA berlaku dan tidak "diperbaiki" di sini:
 * - `GET /api/v1/kasir/settings/` mengirim seluruh setting + `client_api_key`
 *   hanya untuk role admin; role lain hanya `payment_methods` + `vnc_password`.
 * - `admin_required` menjawab 403 JSON (bukan redirect) untuk sesi kasir.
 * - Token uninstall/emergency adalah `secrets.token_urlsafe(32)` dan dibuat
 *   sekali; string legacy tidak boleh muncul lagi.
 * - Login user nonaktif ditolak 401: `UserRepository.get_by_username()` hanya
 *   mengembalikan user `aktif=True`, jadi tidak ada sesi yang terbentuk.
 * - `POST /backup/manual` tidak pernah dipanggil sebagai admin: endpoint itu
 *   menyentuh instance/warnet.db dan folder backups/ produksi. Yang diuji
 *   adalah penolakan 403 sebelum body sempat berjalan.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { BASE_URL, CLIENT_API_KEY, login, logout, tab, settingsTab, unique, check } = require('./lib/harness');
const { dbQuery, dbExec } = require('./lib/db');
const { createReport, finish } = require('./lib/report');

const LEGACY_TOKENS = ['TM_UNINSTALL_SAFE_2026', 'TM123qaz!@#'];
const ADMIN_SETTINGS_KEYS = ['client_api_key', 'mikrotik_password', 'mikrotik_host', 'warnet_title'];

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

async function dbCount(sql, params = []) {
    const rows = await dbQuery(sql, params);
    return rows.length ? Number(rows[0].c) : 0;
}

/** Login dengan kredensial bebas (bukan hanya admin/kasir bawaan harness). */
async function loginAs(page, username, password) {
    await page.goto('about:blank');
    await page.context().clearCookies();
    await page.goto(`${BASE_URL}/kasir/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('#username', username);
    await page.fill('#password', password);
    await page.click('#btn-login');
}

/**
 * Re-login di tengah suite. `about:blank` wajib lebih dulu: request dashboard
 * yang masih terbang bisa menulis ulang cookie sesi setelah clearCookies, dan
 * `/kasir/login` akan me-redirect ke dashboard bila sesi masih valid.
 */
async function freshLogin(page, role) {
    await page.goto('about:blank');
    return login(page, role);
}

/** Putus sesi tanpa memicu redirect /kasir/login dari sesi yang masih hidup. */
async function dropSession(page) {
    await page.goto('about:blank');
    await page.context().clearCookies();
    await page.goto(`${BASE_URL}/kasir/login`, { waitUntil: 'domcontentloaded' });
}

/** fetch dari dalam halaman: ikut cookie sesi + header CSRF seperti API.request. */
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
        try { json = JSON.parse(text); } catch (e) { /* respons non-JSON (html 404) */ }
        return { status: res.status, json, text };
    }, { method, url, body });
}

/** Ambil nilai setting langsung dari tabel sandbox (sumber independen). */
async function settingValue(key) {
    const rows = await dbQuery('SELECT value FROM settings WHERE key = ?', [key]);
    return rows.length ? rows[0].value : undefined;
}

async function runSettingsAdminLogsE2ETest(page) {
    const report = createReport('settings_admin_logs');
    let adminSettings = null;
    let originalTitle = null;
    let kasirUsername = null;
    let kasirPassword = 'rahasia123';
    let kasirId = null;

    try {
        await freshLogin(page, 'admin');
    } catch (err) {
        for (const name of ['Admin login dan role admin terverifikasi']) {
            await check(report, name, async () => { throw err; });
        }
        return finish(report);
    }

    await check(report, 'Admin login dan role admin terverifikasi', async () => {
        const role = await page.evaluate(() => window.App && App.user && App.user.role);
        assert.strictEqual(role, 'admin');
    });

    await check(report, 'Payload settings admin memuat client_api_key sandbox dan mikrotik_password', async () => {
        const res = await page.evaluate(() => API.settings.getAll());
        assert.ok(res && res.success, 'settings admin gagal dimuat');
        adminSettings = res.settings;
        assert.strictEqual(adminSettings.client_api_key, CLIENT_API_KEY);
        assert.ok('mikrotik_password' in adminSettings, 'mikrotik_password harus ada untuk admin');
        assert.ok(adminSettings.payment_methods, 'payment_methods harus ada');
        originalTitle = adminSettings.warnet_title;
        assert.ok(originalTitle, 'warnet_title harus ada');
    });

    await check(report, 'Sepuluh subtab settings tampil eksklusif satu per satu', async () => {
        const subtabs = ['general', 'payment', 'kiosk', 'whitelist_ip', 'cloudflare_tunnel', 'scheduler', 'cloud_backup', 'local_backup', 'db_cleanup', 'migration'];
        for (const sub of subtabs) {
            await settingsTab(page, sub);
            const state = await page.evaluate((name) => {
                const all = Array.from(document.querySelectorAll('.subtab-content'));
                const target = document.getElementById(`subtab-${name}`);
                return {
                    found: !!target,
                    visible: !!target && !target.classList.contains('hidden'),
                    visibleCount: all.filter((el) => !el.classList.contains('hidden')).length,
                    targetId: target ? target.id : null,
                };
            }, sub);
            assert.ok(state.found, `subtab-${sub} tidak ada di DOM`);
            assert.ok(state.visible, `subtab-${sub} tidak tampil`);
            assert.strictEqual(state.visibleCount, 1, `subtab lain ikut tampil saat ${sub}`);
        }
    });

    const uniqueTitle = `Warnet E2E ${unique('judul')}`;
    await check(report, 'Simpan judul warnet lewat UI tersimpan di DB dan bisa dipulihkan', async () => {
        // Input judul berada di sub-tab kiosk (Profil & Struk), bukan general.
        await settingsTab(page, 'kiosk');
        await page.fill('#warnet-title-input', uniqueTitle);
        await page.evaluate(() => Settings.saveWarnetTitle());
        await dbWait('SELECT value FROM settings WHERE key = ?', ['warnet_title'], (rows) => rows.length === 1 && rows[0].value === uniqueTitle, 'warnet_title tersimpan');

        const restore = await http(page, 'PUT', '/api/v1/kasir/settings/warnet_title', { value: originalTitle });
        assert.strictEqual(restore.status, 200, `restore gagal: ${restore.text}`);
        assert.strictEqual(await settingValue('warnet_title'), originalTitle);
    });

    await check(report, 'Token uninstall acak, stabil di dua panggilan, dan tidak membocorkan emergency token', async () => {
        const url = `${BASE_URL}/api/v1/kasir/settings/uninstall-token/client`;
        const headers = { 'X-Client-Key': CLIENT_API_KEY };
        // Endpoint memetakan request.remote_addr ke PC terdaftar; Playwright datang dari loopback.
        const [pc] = await dbQuery("SELECT id, ip_address FROM pc WHERE kode = 'PC-05'");
        await dbExec("UPDATE pc SET ip_address = '127.0.0.1' WHERE id = ?", [pc.id]);
        const first = await page.request.get(url, { headers });
        assert.strictEqual(first.status(), 200);
        const a = await first.json();
        assert.strictEqual(a.success, true);
        const second = await page.request.get(url, { headers });
        const b = await second.json();
        await dbExec('UPDATE pc SET ip_address = ? WHERE id = ?', [pc.ip_address, pc.id]);

        assert.ok(typeof a.uninstall_token === 'string' && /^[A-Za-z0-9_-]{32,}$/.test(a.uninstall_token), `token tidak acak/url-safe: ${a.uninstall_token}`);
        LEGACY_TOKENS.forEach((legacy) => assert.notStrictEqual(a.uninstall_token, legacy, 'token legacy masih dipakai'));
        // Remediasi audit: endpoint klien hanya boleh mengirim token uninstall.
        assert.ok(!('emergency_token' in a), 'respons tidak boleh membocorkan emergency_token');
        assert.strictEqual(b.uninstall_token, a.uninstall_token, 'token uninstall berubah antar panggilan');
        assert.strictEqual(await settingValue('uninstall_token'), a.uninstall_token);
    });

    await check(report, 'Endpoint token menolak request tanpa X-Client-Key dengan 401', async () => {
        const res = await page.request.get(`${BASE_URL}/api/v1/kasir/settings/uninstall-token/client`);
        assert.strictEqual(res.status(), 401);
        const body = await res.json();
        assert.match(body.error, /API Key tidak valid/i);
    });

    kasirUsername = unique('kasir_e2e').replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 30);
    await check(report, 'User kasir baru dibuat lewat UI dan tercatat di DB', async () => {
        await tab(page, 'user');
        await page.evaluate(() => User.openAddModal());
        await page.waitForSelector('#inp-user-username', { state: 'visible', timeout: 5000 });
        await page.fill('#inp-user-username', kasirUsername);
        await page.fill('#inp-user-nama', 'Kasir E2E Task 11');
        await page.fill('#inp-user-pass', kasirPassword);
        await page.selectOption('#inp-user-role', 'kasir');
        await page.selectOption('#inp-user-aktif', 'true');
        await page.fill('#inp-user-kuota', '1');
        await page.click('button[onclick="User.addOrupdate()"]');

        const rows = await dbWait('SELECT id, username, role, aktif FROM user WHERE username = ?', [kasirUsername], (r) => r.length === 1, 'user baru tersimpan');
        kasirId = rows[0].id;
        assert.strictEqual(rows[0].role, 'kasir');
        assert.strictEqual(Number(rows[0].aktif), 1);
        await page.waitForFunction((name) => document.getElementById('user-table').innerText.includes(name), kasirUsername, { timeout: 5000 });
    });

    await check(report, 'File explorer dihapus: endpoint 404, tombol, container, dan modul tidak ada', async () => {
        const res = await page.request.get(`${BASE_URL}/api/v1/kasir/fileexplorer/roots`);
        assert.strictEqual(res.status(), 404);
        const state = await page.evaluate(() => ({
            button: !!document.getElementById('sidebar-fileexplorer-btn'),
            tab: !!document.getElementById('tab-fileexplorer'),
            module: typeof FileExplorer,
        }));
        assert.strictEqual(state.button, false);
        assert.strictEqual(state.tab, false);
        assert.strictEqual(state.module, 'undefined');
    });

    await check(report, 'Audit log memuat aksi nyata SETTINGS_UPDATE lewat filter unik', async () => {
        const res = await page.request.get(`${BASE_URL}/api/v1/kasir/report/log`, { params: { filter: uniqueTitle, limit: 20 } });
        assert.strictEqual(res.status(), 200);
        const body = await res.json();
        const hit = body.logs.find((log) => log.action === 'SETTINGS_UPDATE' && log.detail_json && log.detail_json.new_value === uniqueTitle);
        assert.ok(hit, `SETTINGS_UPDATE ${uniqueTitle} tidak ditemukan: ${JSON.stringify(body.logs.map((l) => l.action))}`);
        assert.strictEqual(hit.detail_json.key, 'warnet_title');
        assert.strictEqual(hit.user, 'admin');
        body.logs.forEach((log) => assert.ok(log.raw.toLowerCase().includes(uniqueTitle.toLowerCase()), 'filter tidak menyaring baris lain'));
    });

    await check(report, 'Audit log memfilter kategori AUTHENTICATION dan menghormati limit', async () => {
        const res = await page.request.get(`${BASE_URL}/api/v1/kasir/report/log`, { params: { kategori: 'AUTHENTICATION', limit: 2 } });
        assert.strictEqual(res.status(), 200);
        const body = await res.json();
        assert.strictEqual(body.logs.length, 2, 'limit tidak dihormati');
        body.logs.forEach((log) => assert.strictEqual(log.category, 'AUTHENTICATION'));
    });

    // --- Cek warisan suite lama (jangan diduplikasi di suite lain) ---

    await check(report, 'CMS documentation menampilkan tutorial hasil seed', async () => {
        const res = await page.goto(`${BASE_URL}/kasir/documentation`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#wiki-sidebar button[onclick^="Tutorials.selectTutorial("]', { timeout: 5000 });
        const count = await page.evaluate(() => document.querySelectorAll('#wiki-sidebar button[onclick^="Tutorials.selectTutorial("]').length);
        const title = await page.title();
        assert.strictEqual(res.status(), 200);
        assert.ok(count > 0);
        assert.match(title, /Dokumentasi|TMBilling/i);
        await page.goto(`${BASE_URL}/kasir/`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#tab-dash', { state: 'visible', timeout: 5000 });
    });

    await check(report, 'Endpoint branch lama 404 dan API.branch sudah dihapus', async () => {
        const branch = await page.evaluate(async () => {
            const res = await fetch('/api/v1/kasir/branch/list');
            return { status: res.status, apiBranchDefined: typeof API.branch !== 'undefined' };
        });
        assert.strictEqual(branch.status, 404);
        assert.strictEqual(branch.apiBranchDefined, false);
    });

    await check(report, 'Modal.show membuat modal aktif dan Modal.closeModal membersihkannya', async () => {
        const modal = await page.evaluate(() => {
            Modal.show('<div id="e2e-test-modal-content">E2E Modal Test</div>');
            const isActive = !!Modal.activeModal && !!document.getElementById('e2e-test-modal-content');
            Modal.closeModal();
            const isClosed = !Modal.activeModal && !document.getElementById('e2e-test-modal-content');
            return { isActive, isClosed };
        });
        assert.strictEqual(modal.isActive, true);
        assert.strictEqual(modal.isClosed, true);
    });

    // --- Sesi kasir: redaksi payload, 403, dan pembatasan tab ---

    await check(report, 'Akun kasir baru bisa login dan ditolak 403 di endpoint admin', async () => {
        await loginAs(page, kasirUsername, kasirPassword);
        await page.waitForURL(/\/kasir\/?$/, { timeout: 5000 });
        await page.waitForSelector('#tab-dash', { state: 'visible', timeout: 5000 });
        const role = await page.evaluate(() => App.user && App.user.role);
        assert.strictEqual(role, 'kasir');

        const res = await page.request.get(`${BASE_URL}/api/v1/kasir/user/`);
        assert.strictEqual(res.status(), 403);
        const body = await res.json();
        assert.match(body.error, /Hanya Admin yang diizinkan/i);
    });

    await check(report, 'Payload settings kasir hanya berisi payment_methods dan vnc_password', async () => {
        const res = await page.evaluate(() => API.settings.getAll());
        assert.ok(res && res.success);
        const keys = Object.keys(res.settings).sort();
        assert.deepStrictEqual(keys, ['payment_methods', 'vnc_password']);
        Array.from(new Set([...ADMIN_SETTINGS_KEYS, 'backup_gdrive_client_id', 'backup_gdrive_client_secret', 'backup_gdrive_folder_id', 'uninstall_token', 'emergency_token']))
            .forEach((key) => assert.ok(!(key in res.settings), `${key} bocor ke kasir`));
        const adminOnly = Object.keys(adminSettings).filter((key) => !(key in res.settings));
        assert.ok(adminOnly.length > 0, 'payload admin dan kasir tidak berbeda');
        assert.strictEqual(res.settings.vnc_password, await settingValue('vnc_password'));
    });

    await check(report, 'Mutasi admin oleh kasir ditolak 403 dan tidak mengubah data', async () => {
        const titleBefore = await settingValue('warnet_title');

        const attempts = [
            await http(page, 'PUT', '/api/v1/kasir/settings/warnet_title', { value: 'HACKED-E2E' }),
            await http(page, 'POST', '/api/v1/kasir/user/', { username: `${kasirUsername}_evil`, password: 'hunter22', role: 'admin', aktif: true }),
            await http(page, 'POST', '/api/v1/kasir/settings/backup/manual'),
        ];
        attempts.forEach((res, idx) => {
            assert.strictEqual(res.status, 403, `upaya ${idx} tidak 403: ${res.status} ${res.text}`);
        });
        const goneRes = await page.request.get(`${BASE_URL}/api/v1/kasir/fileexplorer/roots`);
        assert.strictEqual(goneRes.status(), 404);

        assert.strictEqual(await settingValue('warnet_title'), titleBefore);
        assert.strictEqual(await dbCount('SELECT COUNT(*) AS c FROM user WHERE username = ?', [`${kasirUsername}_evil`]), 0);
    });

    await check(report, 'Tab khusus admin ditolak untuk sesi kasir', async () => {
        for (const restricted of ['settings_general', 'user', 'analytics']) {
            await page.evaluate((id) => App.switchTab(id), restricted);
            const state = await page.evaluate(() => ({ tab: App.currentTab, dash: !document.getElementById('tab-dash').classList.contains('hidden') }));
            assert.strictEqual(state.tab, 'dash', `${restricted} tidak dipantulkan ke dash`);
            assert.strictEqual(state.dash, true);
        }
    });

    // --- Nonaktifkan lalu hapus user: login harus benar-benar diblokir ---

    await check(report, 'User dinonaktifkan lewat UI tidak bisa dipakai login', async () => {
        await freshLogin(page, 'admin');
        await tab(page, 'user');
        await page.evaluate((id) => User.edit(id), kasirId);
        await page.waitForSelector('#inp-user-aktif', { state: 'visible', timeout: 5000 });
        await page.selectOption('#inp-user-aktif', 'false');
        await page.click('button[onclick="User.addOrupdate()"]');
        await dbWait('SELECT aktif FROM user WHERE id = ?', [kasirId], (rows) => rows.length === 1 && Number(rows[0].aktif) === 0, 'user nonaktif tersimpan');

        // `UserRepository.get_by_username()` hanya mengembalikan user aktif, jadi
        // kredensial user nonaktif sudah ditolak 401 sebelum sesi dibuat.
        // Sesi admin dilepas dulu agar `/auth/check` benar-benar menguji sesi kosong.
        await dropSession(page);
        const csrf = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]').getAttribute('content'));
        const loginRes = await page.request.post(`${BASE_URL}/api/v1/kasir/auth/login`, {
            headers: { 'X-CSRFToken': csrf },
            data: { username: kasirUsername, password: kasirPassword },
        });
        assert.strictEqual(loginRes.status(), 401, `login user nonaktif: ${loginRes.status()}`);
        assert.match((await loginRes.json()).error, /Username atau password salah/i);
        const checkRes = await page.request.get(`${BASE_URL}/api/v1/kasir/auth/check`);
        assert.strictEqual((await checkRes.json()).logged_in, false, 'sesi user nonaktif masih dianggap login');
        const adminRes = await page.request.get(`${BASE_URL}/api/v1/kasir/user/`);
        assert.strictEqual(adminRes.status(), 401);
    });

    await check(report, 'User dihapus lewat UI hilang dari DB dan login ditolak 401', async () => {
        await freshLogin(page, 'admin');
        await tab(page, 'user');
        await page.evaluate(([id, name]) => User.delete(id, name), [kasirId, kasirUsername]);
        await page.waitForSelector('#modal-confirm-btn', { state: 'visible', timeout: 5000 });
        await page.fill('#modal-confirm-input', kasirUsername);
        await page.click('#modal-confirm-btn');
        await dbWait('SELECT id FROM user WHERE id = ?', [kasirId], (rows) => rows.length === 0, 'user terhapus dari DB');

        await dropSession(page);
        const csrf = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]').getAttribute('content'));
        const loginRes = await page.request.post(`${BASE_URL}/api/v1/kasir/auth/login`, {
            headers: { 'X-CSRFToken': csrf },
            data: { username: kasirUsername, password: kasirPassword },
        });
        assert.strictEqual(loginRes.status(), 401);
        assert.match((await loginRes.json()).error, /Username atau password salah/i);
    });

    await check(report, 'Tab berat berada di dalam scroll utama dan konten desktop terpusat', async () => {
        await freshLogin(page, 'admin');
        const originalViewport = page.viewportSize();
        await page.setViewportSize({ width: 1920, height: 1080 });
        const inside = await page.evaluate(() => ['tab-mikrotik', 'tab-settings', 'tab-analytics']
            .every((id) => {
                const el = document.getElementById(id);
                return !!el && !!el.closest('#main-scroll');
            }));
        assert.strictEqual(inside, true, 'tab berat masih dirender di luar #main-scroll');

        const boxes = [];
        await tab(page, 'settings_general');
        boxes.push(['settings', await page.evaluate(() => {
            const el = document.querySelector('#tab-settings > div');
            const s = document.getElementById('main-scroll').getBoundingClientRect();
            const r = el.getBoundingClientRect();
            return { width: r.width, left: r.left - s.left, right: s.right - r.right };
        }), 1280]);
        await tab(page, 'mikrotik');
        boxes.push(['mikrotik', await page.evaluate(() => {
            const r = document.getElementById('tab-mikrotik').getBoundingClientRect();
            const s = document.getElementById('main-scroll').getBoundingClientRect();
            return { width: r.width, left: r.left - s.left, right: s.right - r.right };
        }), 1024]);
        await tab(page, 'analytics');
        boxes.push(['analytics', await page.evaluate(() => {
            const r = document.getElementById('tab-analytics').getBoundingClientRect();
            const s = document.getElementById('main-scroll').getBoundingClientRect();
            return { width: r.width, left: r.left - s.left, right: s.right - r.right };
        }), 1280]);

        for (const [name, box, limit] of boxes) {
            assert.ok(box.width <= limit + 2, `${name} melebihi lebar ${limit}px: ${box.width}`);
            assert.ok(Math.abs(box.left - box.right) <= 12, `${name} tidak terpusat: ${box.left}/${box.right}`);
        }
        await page.setViewportSize(originalViewport || { width: 1280, height: 720 });
    });

    await check(report, 'Paket membatasi 8 baris pada lg, xl, dan 2xl', async () => {
        const originalViewport = page.viewportSize();
        const expected = [[1023, 7], [1024, 8], [1280, 8], [1536, 8]];
        for (const [width, rows] of expected) {
            await page.setViewportSize({ width, height: 900 });
            const actual = await page.evaluate(() => Paket.getAdaptivePerPage());
            assert.strictEqual(actual, rows, `viewport ${width}px menghasilkan ${actual} baris`);
        }
        await page.setViewportSize(originalViewport || { width: 1280, height: 720 });
    });

    await check(report, 'Panel analitik owner tidak memakai scroll internal', async () => {
        const source = fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'static', 'js', 'kasir', 'modules', 'owner', 'analytics.js'), 'utf8');
        assert.ok(!source.includes('setScroll('), 'helper setScroll masih ada');
        await tab(page, 'analytics');
        const unbounded = await page.evaluate(() => ['kpi-tabel-billing', 'kpi-tabel-kantin', 'kpi-paket', 'kpi-kasir']
            .every((id) => {
                const el = document.getElementById(id);
                return el && !el.style.maxHeight && !el.style.overflowY;
            }));
        assert.strictEqual(unbounded, true, 'panel analitik masih dibatasi scroll');
    });

    await check(report, 'Scrollbar global mengikuti tema gelap', async () => {
        const css = fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'static', 'css', 'tailwind.css'), 'utf8');
        assert.match(css, /::-webkit-scrollbar-thumb\{background:#333/, 'thumb scrollbar tidak gelap');
        assert.match(css, /color-scheme:dark/, 'color-scheme gelap tidak ada');
    });

    await check(report, 'Badge kategori log memakai latar netral bertema', async () => {
        await tab(page, 'log');
        await page.waitForSelector('#log-rows .log-category-badge', { timeout: 5000 });
        const color = await page.evaluate(() => getComputedStyle(document.querySelector('#log-rows .log-category-badge')).backgroundColor);
        assert.strictEqual(color, 'rgb(23, 23, 23)', `warna badge ${color}`);
    });

    await check(report, 'Tabel whitelist IP pas lebar pada lg, xl, dan 2xl', async () => {
        await tab(page, 'whitelist_ip');
        await page.evaluate(async (label) => {
            const meta = document.querySelector('meta[name="csrf-token"]');
            try {
                await fetch('/api/v1/kasir/settings/ip-whitelist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': meta.content },
                    body: JSON.stringify({ ip: '10.123.45.67', label }),
                });
            } catch (e) { /* entry mungkin sudah ada */ }
            await Settings._wlRefreshList();
        }, 'Label panjang untuk menguji kesesuaian lebar tabel whitelist');

        const originalViewport = page.viewportSize();
        for (const width of [1024, 1280, 1536]) {
            await page.setViewportSize({ width, height: 900 });
            const box = await page.evaluate(() => {
                const el = document.getElementById('wl-table-wrap');
                return { scroll: el.scrollWidth, client: el.clientWidth };
            });
            assert.ok(box.scroll <= box.client + 1, `viewport ${width}px overflow ${box.scroll}/${box.client}`);
        }
        await page.setViewportSize(originalViewport || { width: 1280, height: 720 });
    });

    await check(report, 'Pengumuman kiosk disanitasi: script/onclick/javascript: hilang, teks sah bertahan', async () => {
        await freshLogin(page, 'admin');
        const csrf = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]').getAttribute('content'));
        const [awal] = await dbQuery("SELECT value FROM settings WHERE key = 'warnet_announcement'");
        const payload = '<p>Promo <strong>Malam</strong></p><script>alert(1)</script><a href="javascript:alert(1)" onclick="alert(2)">klik</a>';
        try {
            const simpan = await page.request.put(`${BASE_URL}/api/v1/kasir/settings/warnet_announcement`, {
                headers: { 'X-CSRFToken': csrf },
                data: { value: payload },
            });
            assert.strictEqual(simpan.status(), 200, `simpan pengumuman: ${simpan.status()}`);

            const konfig = await page.request.get(`${BASE_URL}/api/v1/public/client/warnet`, {
                headers: { 'X-Client-Key': CLIENT_API_KEY },
            });
            assert.strictEqual(konfig.status(), 200);
            const html = String((await konfig.json()).announcement || '');
            assert.ok(html.includes('Promo') && html.includes('<strong>Malam</strong>'), `markup sah harus bertahan: ${html}`);
            assert.ok(!/<\s*script/i.test(html), `script harus hilang: ${html}`);
            assert.ok(!/onclick/i.test(html), `handler onclick harus hilang: ${html}`);
            assert.ok(!/javascript:/i.test(html), `protokol javascript: harus hilang: ${html}`);
        } finally {
            await page.request.put(`${BASE_URL}/api/v1/kasir/settings/warnet_announcement`, {
                headers: { 'X-CSRFToken': csrf },
                data: { value: awal ? awal.value : '' },
            });
        }
    });

    await check(report, 'Unduhan database mengirim file SQLite utuh, bukan file WAL hidup', async () => {
        const res = await page.request.get(`${BASE_URL}/api/v1/kasir/settings/backup/download`);
        assert.strictEqual(res.status(), 200, `unduh DB: ${res.status()}`);
        const body = await res.body();
        assert.ok(body.length > 4096, `ukuran file terlalu kecil: ${body.length}`);
        assert.strictEqual(body.slice(0, 16).toString('latin1'), 'SQLite format 3\u0000', 'header file bukan SQLite');
        const disposition = res.headers()['content-disposition'] || '';
        assert.match(disposition, /attachment/i, `header unduhan tidak sesuai: ${disposition}`);
    });

    await logout(page);
    return finish(report);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runSettingsAdminLogsE2ETest };
}
