/**
 * E2E: privasi screenshot (admin-only, penyimpanan privat) dan revalidasi role
 * admin ke database pada middleware IP whitelist.
 *
 * Bukti yang diburu: kasir/anonim tidak bisa membaca metadata atau byte gambar,
 * path statis lama sudah mati, dan admin yang baru diturunkan tidak lagi mendapat
 * satu request gratis di luar whitelist.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { BASE_URL, CLIENT_API_KEY, login, logout, check, unique } = require('./lib/harness');
const { dbQuery, dbExec } = require('./lib/db');
const { createReport, finish } = require('./lib/report');

const PNG_BYTES = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP8z4AdMOEQH6QSAM1BAQ/oQeJvAAAAAElFTkSuQmCC',
    'base64'
);
// Ditunda: registry suite memuat semua modul sebelum env sandbox diset.
function sandboxInstanceDir() {
    return path.join(path.dirname(path.resolve(process.env.E2E_SANDBOX_DB)), 'instance');
}

async function http(page, method, url, body) {
    // URL absolut: setelah role diturunkan, dashboard bisa menavigasi halaman ke
    // about:blank sehingga fetch relatif gagal di-parse.
    const target = url.startsWith('http') ? url : `${BASE_URL}${url}`;
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
    }, { method, url: target, body });
}

/** Ambil status dari halaman tanpa cookie sesi (anonim). */
async function anonymousStatus(page, url) {
    return page.evaluate(async (url) => {
        const res = await fetch(url, { credentials: 'omit' });
        return res.status;
    }, url);
}

/** Kirim screenshot seperti agent klien: API key + IP PC lewat X-Forwarded-For. */
async function uploadScreenshot(page, pc) {
    const res = await page.request.post(`${BASE_URL}/api/v1/public/monitor/screenshot/upload`, {
        headers: { 'X-Client-Key': CLIENT_API_KEY, 'X-Forwarded-For': pc.ip_address },
        data: PNG_BYTES,
    });
    return { status: res.status(), text: await res.text() };
}

async function setAdminRole(role) {
    await dbExec("UPDATE user SET role = ? WHERE username = 'admin'", [role]);
}

async function runScreenshotWhitelistE2ETest(page) {
    const report = createReport('screenshot_whitelist');
    const [pc1] = await dbQuery('SELECT id, ip_address FROM pc WHERE kode = ?', ['PC-01']);

    await login(page, 'admin');

    await check(report, 'Screenshot PC klien tersimpan privat dan terbaca admin', async () => {
        const up = await uploadScreenshot(page, pc1);
        assert.strictEqual(up.status, 200, up.text);
        assert.ok(fs.existsSync(path.join(sandboxInstanceDir(), 'uploads', 'screenshots', 'PC-01.png')),
            'screenshot tidak tersimpan di instance privat');

        const all = await http(page, 'GET', '/api/v1/kasir/monitor/screenshot/all');
        assert.strictEqual(all.status, 200, all.text);
        const entry = (all.json.data || []).find((row) => row.pc_id === pc1.id);
        assert.ok(entry, 'PC-01 tidak ada di daftar status screenshot');
        assert.strictEqual(entry.screenshot_url, `/api/v1/kasir/monitor/screenshot/image/${pc1.id}`);

        const img = await page.request.get(`${BASE_URL}${entry.screenshot_url}`);
        assert.strictEqual(img.status(), 200);
        assert.ok(String(img.headers()['content-type']).includes('image/png'));
    });

    await check(report, 'Anonim tidak bisa membaca metadata/gambar dan path statis lama 404', async () => {
        assert.strictEqual(await anonymousStatus(page, '/api/v1/kasir/monitor/screenshot/all'), 401);
        assert.strictEqual(await anonymousStatus(page, `/api/v1/kasir/monitor/screenshot/image/${pc1.id}`), 401);
        assert.strictEqual(await anonymousStatus(page, '/static/uploads/screenshots/PC-01.png'), 404);
    });

    await check(report, 'Kasir ditolak pada metadata, status, dan gambar', async () => {
        await logout(page);
        await login(page, 'kasir');
        assert.strictEqual((await http(page, 'GET', '/api/v1/kasir/monitor/screenshot/all')).status, 403);
        assert.strictEqual((await http(page, 'GET', `/api/v1/kasir/monitor/screenshot/status/${pc1.id}`)).status, 403);
        assert.strictEqual((await http(page, 'GET', `/api/v1/kasir/monitor/screenshot/image/${pc1.id}`)).status, 403);
        await logout(page);
        await login(page, 'admin');
    });

    await check(report, 'Hapus PC permanen ikut menghapus screenshot privatnya', async () => {
        const [pc5] = await dbQuery('SELECT id, kode, ip_address FROM pc WHERE kode = ?', ['PC-05']);
        const up = await uploadScreenshot(page, pc5);
        assert.strictEqual(up.status, 200, up.text);
        const file = path.join(sandboxInstanceDir(), 'uploads', 'screenshots', `${pc5.kode}.png`);
        assert.ok(fs.existsSync(file), 'screenshot PC-05 tidak tersimpan');

        const del = await http(page, 'DELETE', `/api/v1/kasir/pc/${pc5.id}`, { confirm: pc5.kode });
        assert.strictEqual(del.status, 200, del.text);
        assert.strictEqual(fs.existsSync(file), false, 'screenshot PC-05 tertinggal setelah PC dihapus');
    });

    // Request via context API + token CSRF tersimpan: setelah role admin
    // diturunkan, polling dashboard bisa memicu navigasi dan membunuh page.evaluate.
    let csrfToken = '';
    const apiRequest = async (method, url, body) => {
        const headers = {};
        if (csrfToken) headers['X-CSRFToken'] = csrfToken;
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        const res = await page.request.fetch(`${BASE_URL}${url}`, {
            method,
            headers,
            data: body === undefined ? undefined : JSON.stringify(body),
        });
        const text = await res.text();
        let json = null;
        try { json = JSON.parse(text); } catch (e) { /* respons non-JSON */ }
        return { status: res.status(), json, text };
    };

    await check(report, 'Admin aktif tetap lolos whitelist, admin yang diturunkan langsung 403', async () => {
        csrfToken = await page.evaluate(() => {
            const meta = document.querySelector('meta[name="csrf-token"]');
            return meta ? meta.getAttribute('content') : '';
        });
        const toggle = await apiRequest('POST', '/api/v1/kasir/settings/ip-whitelist/toggle', { enabled: true });
        assert.strictEqual(toggle.status, 200, toggle.text);

        // X-Forwarded-For menaruh IP klien di luar whitelist; Waitress sandbox
        // mempercayai header ini dari 127.0.0.1 sehingga hanya bypass admin yang lolos.
        const headerLuar = { headers: { 'X-Forwarded-For': '203.0.113.9' } };
        const aktif = await page.request.get(`${BASE_URL}/api/v1/kasir/report/kasir-list`, headerLuar);
        assert.strictEqual(aktif.status(), 200, `admin aktif tidak lolos whitelist: ${await aktif.text()}`);

        await setAdminRole('kasir');
        const turun = await page.request.get(`${BASE_URL}/api/v1/kasir/report/kasir-list`, headerLuar);
        const isiTurun = await turun.text();
        assert.strictEqual(turun.status(), 403, `admin yang diturunkan masih lolos whitelist sekali: ${isiTurun}`);
        assert.ok(isiTurun.includes('forbidden'), isiTurun);
    });

    // Sesi lama dihancurkan oleh guard whitelist saat role diturunkan; login
    // ulang lewat API (tanpa navigasi) lalu bersihkan state global.
    await setAdminRole('admin');
    const loginPage = await page.request.get(`${BASE_URL}/kasir/login`);
    const loginCsrf = (await loginPage.text()).match(/name=["']csrf-token["'] content=["']([^"']+)["']/);
    const relogin = await page.request.post(`${BASE_URL}/api/v1/kasir/auth/login`, {
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': loginCsrf ? loginCsrf[1] : '' },
        data: { username: 'admin', password: 'admin123' },
    });
    assert.strictEqual(relogin.status(), 200, `login ulang admin gagal: ${await relogin.text()}`);
    const shell = await page.request.get(`${BASE_URL}/kasir/`);
    const metaCsrf = (await shell.text()).match(/name=["']csrf-token["'] content=["']([^"']+)["']/);
    csrfToken = metaCsrf ? metaCsrf[1] : '';
    const status = await apiRequest('GET', '/api/v1/kasir/settings/ip-whitelist/status');
    if (status.json && status.json.enabled) {
        await apiRequest('POST', '/api/v1/kasir/settings/ip-whitelist/toggle', { enabled: false });
    }
    const akhir = await apiRequest('GET', '/api/v1/kasir/settings/ip-whitelist/status');
    await check(report, 'Whitelist kembali nonaktif setelah suite', async () => {
        assert.strictEqual(akhir.status, 200, akhir.text);
        assert.strictEqual(Boolean(akhir.json && akhir.json.enabled), false, akhir.text);
    });

    return finish(report);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runScreenshotWhitelistE2ETest };
}

