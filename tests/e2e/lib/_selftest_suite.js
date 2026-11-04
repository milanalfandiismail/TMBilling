/**
 * Suite internal `_selftest` — sengaja gagal.
 *
 * Tujuannya bukan menguji aplikasi, melainkan membuktikan runner benar-benar
 * meneruskan kegagalan ke exit code. Kalau suite ini "lulus", runner sedang bohong.
 */
const { createReport, record, finish, normalize } = require('./report');

// `normalize()` adalah satu-satunya jembatan ke 8 suite lama; kalau bentuknya
// salah, semua total run jadi dusta. Jadi ikut diuji di sini.
function normalizeLegacyShapes() {
  const legacy = normalize({ totalTests: 3, passed: 2, failed: 1, errors: ['b: gagal'] }, 'legacy');
  const results = normalize(
    { total: 2, passed: 2, failed: 0, results: [{ name: 'a', passed: true }, { name: 'b', passed: true }] },
    'results'
  );
  return (
    legacy.total === 3 &&
    legacy.passed === 2 &&
    legacy.failed === 1 &&
    results.total === 2 &&
    results.passed === 2 &&
    results.failed === 0 &&
    results.checks.length === 2
  );
}

module.exports.runRunnerSelfTest = async () => {
  const r = createReport('_selftest');
  record(r, 'deliberate failure', false, 'expected failure');
  record(r, 'deliberate pass', true);
  record(r, 'normalize() membaca bentuk laporan lama dan baru', normalizeLegacyShapes());
  return finish(r);
};
