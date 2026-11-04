'use strict';

/**
 * Task 11 — Admin: user/RBAC, redaksi settings, audit log, token klien,
 * plugin, dan file explorer.
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
const { dbQuery } = require('./lib/db');
const { createReport, finish } = require('./lib/report');

const SENSITIVE_BLACKLIST = ['.env', 'warnet.db', 'initial_admin.txt', '.git'];
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

    await check(report, 'Uninstall/emergency token acak, bukan string legacy, dan stabil di dua panggilan', async () => {
        const url = `${BASE_URL}/api/v1/kasir/settings/uninstall-token/client`;
        const headers = { 'X-Client-Key': CLIENT_API_KEY };
        const first = await page.request.get(url, { headers });
        assert.strictEqual(first.status(), 200);
        const a = await first.json();
        assert.strictEqual(a.success, true);
        const second = await page.request.get(url, { headers });
        const b = await second.json();

        for (const token of [a.uninstall_token, a.emergency_token]) {
            assert.ok(typeof token === 'string' && /^[A-Za-z0-9_-]{32,}$/.test(token), `token tidak acak/url-safe: ${token}`);
            LEGACY_TOKENS.forEach((legacy) => assert.notStrictEqual(token, legacy, 'token legacy masih dipakai'));
        }
        assert.notStrictEqual(a.uninstall_token, a.emergency_token, 'dua token tidak boleh sama');
        assert.strictEqual(b.uninstall_token, a.uninstall_token, 'token uninstall berubah antar panggilan');
        assert.strictEqual(b.emergency_token, a.emergency_token, 'token emergency berubah antar panggilan');
        assert.strictEqual(await settingValue('uninstall_token'), a.uninstall_token);
        assert.strictEqual(await settingValue('emergency_token'), a.emergency_token);
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

    await check(report, 'File explorer mendaftar root dengan 200 dan menyembunyikan entri sensitif', async () => {
        await tab(page, 'fileexplorer');
        const rootsRes = await page.request.get(`${BASE_URL}/api/v1/kasir/fileexplorer/roots`);
        assert.strictEqual(rootsRes.status(), 200);
        const roots = (await rootsRes.json()).roots;
        assert.ok(Array.isArray(roots) && roots.length > 0, 'root file explorer kosong');

        const listRes = await page.request.get(`${BASE_URL}/api/v1/kasir/fileexplorer/list`, { params: { path: roots[0] } });
        assert.strictEqual(listRes.status(), 200);
        const listing = await listRes.json();
        assert.ok(Array.isArray(listing.items) && listing.items.length > 0, 'listing root kosong');
        const names = listing.items.map((item) => String(item.name).toLowerCase());
        SENSITIVE_BLACKLIST.forEach((bad) => assert.ok(!names.includes(bad), `${bad} bocor di listing`));
    });

    await check(report, 'File explorer menolak path traversal ../../ dengan 400', async () => {
        const roots = (await (await page.request.get(`${BASE_URL}/api/v1/kasir/fileexplorer/roots`)).json()).roots;
        const res = await page.request.get(`${BASE_URL}/api/v1/kasir/fileexplorer/list`, { params: { path: `${roots[0]}/../..` } });
        assert.strictEqual(res.status(), 400);
        const body = await res.json();
        assert.strictEqual(body.success, false);
        assert.match(body.error, /di luar batasan direktori/i);
    });

    await check(report, 'File explorer menolak berkas sensitif .env, warnet.db, initial_admin.txt, dan .git', async () => {
        const roots = (await (await page.request.get(`${BASE_URL}/api/v1/kasir/fileexplorer/roots`)).json()).roots;
        const root = roots[0];
        for (const name of ['.env', 'warnet.db', 'initial_admin.txt']) {
            const res = await page.request.get(`${BASE_URL}/api/v1/kasir/fileexplorer/read`, { params: { path: `${root}/${name}` } });
            assert.strictEqual(res.status(), 400, `${name} tidak ditolak (HTTP ${res.status()})`);
            const body = await res.json();
            assert.match(body.error, /dilindungi oleh sistem keamanan/i, `pesan ${name}: ${body.error}`);
        }
        const dirRes = await page.request.get(`${BASE_URL}/api/v1/kasir/fileexplorer/list`, { params: { path: `${root}/.git` } });
        assert.strictEqual(dirRes.status(), 400);
        assert.match((await dirRes.json()).error, /dilindungi oleh sistem keamanan/i);
    });

    await check(report, 'Plugin terpasang tampil sesuai manifest dan toggle tersimpan di DB', async () => {
        const manifestPath = path.join(__dirname, '..', '..', 'plugins', 'hello_world', 'manifest.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const apiRes = await page.request.get(`${BASE_URL}/api/v1/kasir/settings/plugins/`);
        assert.strictEqual(apiRes.status(), 200);
        const listed = (await apiRes.json()).plugins.find((p) => p.id === manifest.id);
        assert.ok(listed, `plugin ${manifest.id} tidak ada di manifest manager`);
        assert.strictEqual(listed.name, manifest.name);
        assert.strictEqual(listed.version, manifest.version);

        await tab(page, 'plugins');
        await page.waitForFunction((name) => document.getElementById('plugins-grid').innerText.includes(name), manifest.name, { timeout: 5000 });

        const key = `plugin_${manifest.id}_enabled`;
        const before = await settingValue(key);
        const firstValue = before === 'true' ? 'false' : 'true';
        await page.evaluate((id) => {
            document.querySelector(`input[onchange*="togglePlugin('${id}'"]`).click();
        }, manifest.id);
        await dbWait('SELECT value FROM settings WHERE key = ?', [key], (r) => r.length === 1 && r[0].value === firstValue, 'toggle plugin tersimpan');
        await page.evaluate((id) => {
            document.querySelector(`input[onchange*="togglePlugin('${id}'"]`).click();
        }, manifest.id);
        const afterSecond = before === 'true' ? 'true' : 'false';
        await dbWait('SELECT value FROM settings WHERE key = ?', [key], (r) => r.length === 1 && r[0].value === afterSecond, 'toggle plugin kembali');
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

    await check(report, 'Plugin SPA terpasang lewat App.openPluginSPA', async () => {
        const spa = await page.evaluate(() => {
            App.openPluginSPA('/api/plugin/hello_world/test', 'E2E Plugin SPA');
            const container = document.getElementById('tab-plugin-spa');
            const iframe = document.getElementById('plugin-spa-iframe');
            const titleEl = document.getElementById('page-title');
            return {
                visible: !!container && !container.classList.contains('hidden'),
                src: iframe ? iframe.getAttribute('src') : null,
                title: titleEl ? titleEl.innerText : '',
            };
        });
        assert.strictEqual(spa.visible, true);
        assert.strictEqual(spa.src, '/api/plugin/hello_world/test');
        assert.strictEqual(spa.title.trim().toUpperCase(), 'E2E PLUGIN SPA');
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
        const pluginKey = 'plugin_hello_world_enabled';
        const pluginBefore = await settingValue(pluginKey);

        const attempts = [
            await http(page, 'PUT', '/api/v1/kasir/settings/warnet_title', { value: 'HACKED-E2E' }),
            await http(page, 'POST', '/api/v1/kasir/user/', { username: `${kasirUsername}_evil`, password: 'hunter22', role: 'admin', aktif: true }),
            await http(page, 'POST', '/api/v1/kasir/settings/backup/manual'),
            await http(page, 'POST', '/api/v1/kasir/settings/plugins/toggle', { plugin_id: 'hello_world', enabled: false }),
        ];
        attempts.forEach((res, idx) => {
            assert.strictEqual(res.status, 403, `upaya ${idx} tidak 403: ${res.status} ${res.text}`);
        });
        const rootsRes = await page.request.get(`${BASE_URL}/api/v1/kasir/fileexplorer/roots`);
        assert.strictEqual(rootsRes.status(), 403);
        assert.match((await rootsRes.json()).error, /Hanya Admin/i);

        assert.strictEqual(await settingValue('warnet_title'), titleBefore);
        assert.strictEqual(await settingValue(pluginKey), pluginBefore);
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

    await logout(page);
    return finish(report);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runSettingsAdminLogsE2ETest };
}
