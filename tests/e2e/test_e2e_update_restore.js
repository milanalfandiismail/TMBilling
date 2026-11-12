/**
 * E2E: klaim tunggal pembaruan, recovery jurnal ekstraksi, dan validasi skema restore.
 *
 * Tidak pernah mengunggah ZIP yang strukturnya valid: route upload memanggil
 * `_launch_updater()` dan akan menjalankan `updater.bat` asli. Yang diuji hanya
 * jalur aman (409 saat klaim dipegang, 400 untuk ZIP tidak valid) plus ekstraktor
 * yang dijalankan langsung pada pohon sementara lewat `TM_UPDATE_ROOT`.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');
const { BASE_URL, login, check, unique } = require('./lib/harness');
const { dbQuery, dbExec, PROJECT_ROOT } = require('./lib/db');
const { createReport, finish } = require('./lib/report');

const PYTHON = process.env.E2E_PYTHON || path.join(PROJECT_ROOT, '.venv', 'Scripts', 'python.exe');
const CLAIM = path.join(PROJECT_ROOT, 'install_scripts', 'update_claim.py');
const EXTRACTOR = path.join(PROJECT_ROOT, 'install_scripts', 'extract_update.py');
const BACKUP_DIR = path.resolve(
    process.env.BACKUP_DIR || path.join(PROJECT_ROOT, 'instance', 'e2e', 'update_restore', 'backups')
);
// Ditunda: registry suite memuat semua modul sebelum env sandbox diset.
function sandboxDir(name) {
    return path.join(path.dirname(path.resolve(process.env.E2E_SANDBOX_DB)), name);
}
const SANDBOX_INSTANCE = () => sandboxDir('instance');
const SANDBOX_TMP = () => sandboxDir('tmp');

/** Jalankan Python di root repo; melempar bila exit code bukan 0. */
function runPy(args, extraEnv = {}) {
    const result = spawnSync(PYTHON, args, {
        cwd: PROJECT_ROOT,
        env: { ...process.env, ...extraEnv },
        encoding: 'utf8',
    });
    if (result.status !== 0) {
        throw new Error(`python ${args.join(' ')} gagal (exit ${result.status}): ${(result.stderr || result.stdout || '').trim()}`);
    }
    return (result.stdout || '').trim();
}

/** Jalankan Python dan kembalikan exit code apa adanya (untuk CLI klaim). */
function statusOf(args, extraEnv = {}) {
    return spawnSync(PYTHON, args, {
        cwd: PROJECT_ROOT,
        env: { ...process.env, ...extraEnv },
        encoding: 'utf8',
    }).status;
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
        try { json = JSON.parse(text); } catch (e) { /* respons non-JSON */ }
        return { status: res.status, json, text };
    }, { method, url, body });
}

/** Unggah berkas lewat multipart dari dalam halaman (butuh sesi + CSRF). */
async function uploadUpdate(page, name, bytes) {
    return page.evaluate(async ({ name, bytes }) => {
        const fd = new FormData();
        fd.append('update_file', new File([bytes], name, { type: 'application/zip' }));
        const headers = {};
        const csrf = document.querySelector('meta[name="csrf-token"]');
        if (csrf) headers['X-CSRFToken'] = csrf.getAttribute('content');
        const res = await fetch('/api/v1/kasir/settings/migration/upload', {
            method: 'POST',
            headers,
            credentials: 'include',
            body: fd,
        });
        const text = await res.text();
        let json = null;
        try { json = JSON.parse(text); } catch (e) { /* respons non-JSON */ }
        return { status: res.status, json, text };
    }, { name, bytes });
}

function claimRelease() {
    statusOf([CLAIM, 'release']);
}

/** Buat ZIP paket rilis minimal (run.py + app/config.py) di path tujuan. */
function writeReleaseZip(zipPath, configContent, extra = {}) {
    const script = [
        'import json, os, sys, zipfile',
        'zip_path, config = sys.argv[1], sys.argv[2]',
        'entries = {"run.py": "new", "app/config.py": config}',
        'entries.update(json.loads(sys.argv[3]))',
        'os.makedirs(os.path.dirname(zip_path), exist_ok=True)',
        'with zipfile.ZipFile(zip_path, "w") as zf:',
        '    for name, content in entries.items():',
        '        zf.writestr(name, content)',
    ].join('\n');
    runPy(['-c', script, zipPath, configContent, JSON.stringify(extra)]);
}

async function runUpdateRestoreE2ETest(page) {
    const report = createReport('update_restore');
    claimRelease();
    await login(page, 'admin');

    await check(report, 'Upload update ditolak 409 saat klaim dipegang runner', async () => {
        try {
            assert.strictEqual(statusOf([CLAIM, 'claim']), 0, 'CLI claim runner gagal');
            const res = await uploadUpdate(page, 'bukan-zip.zip', 'x');
            assert.strictEqual(res.status, 409, res.text);
            assert.ok(String(res.json && res.json.error).includes('Pembaruan lain sedang berjalan'), res.text);
            assert.strictEqual(fs.existsSync(path.join(SANDBOX_INSTANCE(), 'temp_update.zip')), false);
        } finally {
            claimRelease();
        }
    });

    await check(report, 'Upload ZIP tidak valid 400 dan klaim dilepas', async () => {
        claimRelease();
        try {
            const res = await uploadUpdate(page, 'bukan-zip.zip', 'x');
            assert.strictEqual(res.status, 400, res.text);
            assert.strictEqual(statusOf([CLAIM, 'active']), 1, 'klaim masih aktif setelah upload ditolak');
        } finally {
            claimRelease();
        }
    });

    await check(report, 'Restore menolak SQLite valid yang bukan skema TMBilling', async () => {
        const marker = unique('e2e-foreign-marker');
        await dbExec('INSERT INTO grup (nama) VALUES (?)', [marker]);
        const script = [
            'import os, sqlite3, sys, zipfile',
            'backup_dir, name = sys.argv[1], sys.argv[2]',
            'os.makedirs(backup_dir, exist_ok=True)',
            'tmp = os.path.join(backup_dir, "foreign_source.db")',
            'conn = sqlite3.connect(tmp)',
            'conn.execute("CREATE TABLE catatan (id INTEGER)")',
            'conn.commit()',
            'conn.close()',
            'with zipfile.ZipFile(os.path.join(backup_dir, name), "w") as zf:',
            '    zf.write(tmp, "warnet.db")',
            'os.remove(tmp)',
        ].join('\n');
        const name = 'warnet_backup_e2e_foreign.zip';
        runPy(['-c', script, BACKUP_DIR, name]);

        const res = await http(page, 'POST', `/api/v1/kasir/backup/restore/${name}`, { confirm: true });
        assert.strictEqual(res.status, 400, res.text);
        assert.ok(String(res.json && res.json.error).includes('tabel inti'), res.text);
        assert.strictEqual((await dbQuery('SELECT id FROM grup WHERE nama = ?', [marker])).length, 1,
            'database live ikut berubah padahal restore ditolak');
    });

    await check(report, 'Restore arsip sandbox sendiri berhasil dan DB tetap bisa ditulis', async () => {
        const trig = await http(page, 'POST', '/api/v1/kasir/backup/trigger');
        assert.strictEqual(trig.status, 200, trig.text);
        const res = await http(page, 'POST', `/api/v1/kasir/backup/restore/${trig.json.filename}`, { confirm: true });
        assert.strictEqual(res.status, 200, res.text);
        assert.strictEqual(res.json.restored, trig.json.filename);
        const after = unique('e2e-restore-ok');
        await dbExec('INSERT INTO grup (nama) VALUES (?)', [after]);
        assert.strictEqual((await dbQuery('SELECT id FROM grup WHERE nama = ?', [after])).length, 1);
    });

    await check(report, 'Ekstraktor menukar pohon sementara dan membersihkan jurnal', async () => {
        const root = fs.mkdtempSync(path.join(SANDBOX_TMP(), 'e2e-upd-'));
        try {
            fs.mkdirSync(path.join(root, 'app', 'static', 'uploads', 'screenshots'), { recursive: true });
            fs.writeFileSync(path.join(root, 'app', 'config.py'), 'OLD');
            fs.writeFileSync(path.join(root, 'run.py'), 'old');
            fs.writeFileSync(path.join(root, 'app', 'static', 'uploads', 'screenshots', 'PC-01.png'), 'png');
            writeReleaseZip(path.join(root, 'instance', 'temp_update.zip'), 'NEW');

            runPy([EXTRACTOR], { TM_UPDATE_ROOT: root });

            assert.strictEqual(fs.readFileSync(path.join(root, 'app', 'config.py'), 'utf8'), 'NEW');
            assert.strictEqual(fs.readFileSync(path.join(root, 'run.py'), 'utf8'), 'new');
            assert.ok(fs.existsSync(path.join(root, 'app', 'static', 'uploads', 'screenshots', 'PC-01.png')),
                'screenshot legacy hilang saat update');
            assert.strictEqual(fs.existsSync(path.join(root, 'instance', 'update_journal.json')), false, 'jurnal tersisa');
            assert.strictEqual(fs.existsSync(path.join(root, 'instance', 'temp_update.zip')), false, 'ZIP tidak dibersihkan');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    await check(report, 'Recovery jurnal mengembalikan pohon lama setelah replace terputus', async () => {
        const root = fs.mkdtempSync(path.join(SANDBOX_TMP(), 'e2e-rec-'));
        try {
            const rollback = path.join(root, 'instance', 'rollback_X');
            fs.mkdirSync(path.join(rollback, 'app'), { recursive: true });
            fs.mkdirSync(path.join(root, 'app'), { recursive: true });
            fs.writeFileSync(path.join(rollback, 'app', 'config.py'), 'OLD');
            fs.writeFileSync(path.join(root, 'app', 'config.py'), 'NEW');
            fs.writeFileSync(path.join(root, 'instance', 'update_journal.json'), JSON.stringify({
                rollback_dir: rollback,
                staging_dir: path.join(root, 'instance', 'staging_update'),
                entries: [{ name: 'app', had_old: true, old_moved: true, new_installed: true }],
            }));

            runPy(['-c', 'import install_scripts.extract_update as e; raise SystemExit(0 if e.recover_interrupted_swap() else 1)'],
                { TM_UPDATE_ROOT: root });
            assert.strictEqual(fs.readFileSync(path.join(root, 'app', 'config.py'), 'utf8'), 'OLD');
            assert.strictEqual(fs.existsSync(path.join(root, 'instance', 'update_journal.json')), false, 'jurnal tersisa');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    claimRelease();
    return finish(report);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runUpdateRestoreE2ETest };
}
