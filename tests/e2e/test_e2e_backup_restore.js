/**
 * E2E: siklus backup -> mutasi -> restore pada sandbox.
 *
 * Endpoint backup asli dipanggil di sini. `BACKUP_DIR` dipaksa ke
 * instance/e2e/backups oleh e2e_sandbox_server.py, jadi folder `backups/`
 * produksi tidak boleh berubah — suite ini memeriksanya secara eksplisit.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { BASE_URL, login, logout, settingsTab, unique, check } = require('./lib/harness');
const { dbQuery, dbExec, PROJECT_ROOT } = require('./lib/db');
const { createReport, finish } = require('./lib/report');

const SANDBOX_BACKUP_DIR = path.resolve(
    process.env.BACKUP_DIR || path.join(PROJECT_ROOT, 'instance', 'e2e', 'backups')
);
const PRODUCTION_BACKUP_DIR = path.join(PROJECT_ROOT, 'backups');

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

function listDir(dir) {
    try { return fs.readdirSync(dir).sort(); } catch (err) { return []; }
}

async function runBackupRestoreE2ETest(page) {
    const report = createReport('backup_restore');
    const productionBefore = listDir(PRODUCTION_BACKUP_DIR);
    let archiveName = null;

    await login(page, 'admin');

    await check(report, 'Subtab local_backup terbuka dan tabel backup dirender', async () => {
        await settingsTab(page, 'local_backup');
        await page.waitForSelector('#backup-files-table-body');
    });

    await check(report, 'Trigger backup membuat satu arsip di direktori sandbox', async () => {
        const before = listDir(SANDBOX_BACKUP_DIR);
        const res = await http(page, 'POST', '/api/v1/kasir/backup/trigger');
        assert.strictEqual(res.status, 200, res.text);
        archiveName = res.json.filename;
        assert.ok(archiveName.startsWith('warnet_backup_') && archiveName.endsWith('.zip'));
        assert.ok(listDir(SANDBOX_BACKUP_DIR).includes(archiveName));
        assert.ok(listDir(SANDBOX_BACKUP_DIR).length >= before.length + 1);
    });

    await check(report, 'Backup tidak menyentuh folder backups produksi', async () => {
        assert.deepStrictEqual(listDir(PRODUCTION_BACKUP_DIR), productionBefore);
    });

    const marker = unique('e2e-restore-marker');

    await check(report, 'Data setelah backup hilang saat restore', async () => {
        await dbExec('INSERT INTO grup (nama) VALUES (?)', [marker]);
        assert.strictEqual((await dbQuery('SELECT id FROM grup WHERE nama = ?', [marker])).length, 1);

        const res = await http(page, 'POST', `/api/v1/kasir/backup/restore/${archiveName}`, { confirm: true });
        assert.strictEqual(res.status, 200, res.text);
        assert.strictEqual(res.json.restored, archiveName);
        assert.ok(fs.existsSync(path.join(SANDBOX_BACKUP_DIR, res.json.safety_backup)));
        assert.strictEqual((await dbQuery('SELECT id FROM grup WHERE nama = ?', [marker])).length, 0);
    });

    await check(report, 'DB sandbox masih bisa ditulis setelah restore', async () => {
        await dbExec('INSERT INTO grup (nama) VALUES (?)', [marker + '-after']);
        assert.strictEqual((await dbQuery('SELECT id FROM grup WHERE nama = ?', [marker + '-after'])).length, 1);
    });

    await check(report, 'Daftar backup memuat arsip dan tombol Restore tampil di UI', async () => {
        const res = await http(page, 'GET', '/api/v1/kasir/backup/list');
        assert.strictEqual(res.status, 200, res.text);
        assert.ok(res.json.backups.some((b) => b.filename === archiveName));
        await page.evaluate(() => Settings.loadBackupFiles());
        await page.waitForSelector('#backup-files-table-body button[title="Restore Database dari Berkas Ini"]', { timeout: 5000 });
    });

    await check(report, 'Restore tanpa konfirmasi 400 dan berkas tidak ada 404', async () => {
        const tanpaKonfirmasi = await http(page, 'POST', `/api/v1/kasir/backup/restore/${archiveName}`, {});
        assert.strictEqual(tanpaKonfirmasi.status, 400);
        const tidakAda = await http(page, 'POST', '/api/v1/kasir/backup/restore/warnet_backup_tidak_ada.zip', { confirm: true });
        assert.strictEqual(tidakAda.status, 404);
    });

    await check(report, 'Kasir tidak bisa restore (403)', async () => {
        await logout(page);
        await login(page, 'kasir');
        const res = await http(page, 'POST', `/api/v1/kasir/backup/restore/${archiveName}`, { confirm: true });
        assert.strictEqual(res.status, 403, res.text);
        await logout(page);
    });

    return finish(report);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runBackupRestoreE2ETest };
}
