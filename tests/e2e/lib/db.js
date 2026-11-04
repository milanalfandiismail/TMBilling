/**
 * Akses SQLite sandbox E2E lewat `sqlite3` bawaan Python.
 *
 * Tidak ada paket npm tambahan dan tidak bergantung pada CLI `sqlite3`.
 * Hanya database sandbox yang boleh disentuh — database produksi diblokir.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const SANDBOX_DB_PATH = path.join(PROJECT_ROOT, 'instance', 'warnet_e2e_sandbox.db');

// Dieksekusi sebagai satu proses Python pendek: baca JSON dari stdin, tulis JSON ke stdout.
const PY_SCRIPT = [
  'import json, sqlite3, sys',
  'req = json.load(sys.stdin)',
  'conn = sqlite3.connect(req["db"])',
  'conn.row_factory = sqlite3.Row',
  'try:',
  '    cur = conn.execute(req["sql"], req["params"])',
  '    if req["exec"]:',
  '        conn.commit()',
  '        print(json.dumps({"changes": cur.rowcount, "lastInsertRowid": cur.lastrowid}))',
  '    else:',
  '        print(json.dumps([dict(row) for row in cur.fetchall()]))',
  'finally:',
  '    conn.close()',
].join('\n');

function pythonExe() {
  const candidates = [
    process.env.E2E_PYTHON,
    path.join(PROJECT_ROOT, '.venv', 'Scripts', 'python.exe'),
    path.join(PROJECT_ROOT, '.venv', 'bin', 'python'),
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('python .venv tidak ditemukan; set E2E_PYTHON ke interpreter yang punya modul sqlite3');
  return found;
}

function run(dbPath, sql, params, isExec) {
  const resolved = path.resolve(dbPath);
  if (resolved !== path.resolve(SANDBOX_DB_PATH)) {
    throw new Error(`db.js hanya boleh menyentuh sandbox (${SANDBOX_DB_PATH}), diminta ${resolved}`);
  }
  if (!fs.existsSync(resolved)) {
    throw new Error(`database sandbox belum ada: ${resolved} (jalankan lewat tests/e2e/run_all_e2e.py)`);
  }

  const result = spawnSync(pythonExe(), ['-c', PY_SCRIPT], {
    input: JSON.stringify({ db: resolved, sql, params: params || [], exec: Boolean(isExec) }),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    throw new Error(`sqlite3 gagal (exit ${result.status}): ${stderr || sql}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (err) {
    throw new Error(`output sqlite3 bukan JSON: ${String(result.stdout).slice(0, 300)}`);
  }
}

/** Jalankan SELECT; mengembalikan array objek baris. */
async function dbQuery(sql, params = []) {
  return run(SANDBOX_DB_PATH, sql, params, false);
}

/** Jalankan INSERT/UPDATE/DELETE; mengembalikan `{changes, lastInsertRowid}`. */
async function dbExec(sql, params = []) {
  return run(SANDBOX_DB_PATH, sql, params, true);
}

module.exports = { dbQuery, dbExec, SANDBOX_DB_PATH, PROJECT_ROOT };
