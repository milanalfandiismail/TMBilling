/**
 * Kontrak laporan hasil E2E.
 *
 * Semua angka (total/passed/failed) dihitung dari daftar check, tidak pernah
 * ditulis tangan. `normalize()` menerima tiga bentuk return suite yang ada di
 * repo ini supaya 8 suite lama tetap jalan tanpa diubah.
 */
function createReport(suite) {
  return { suite, startTime: new Date().toISOString(), checks: [] };
}

function record(report, name, passed, detail = null) {
  report.checks.push({ name, passed: !!passed, detail });
}

function finish(report) {
  const total = report.checks.length;
  const passed = report.checks.filter((c) => c.passed).length;
  return { ...report, total, passed, failed: total - passed, endTime: new Date().toISOString() };
}

function normalize(raw, suite) {
  // Bentuk baru: { suite, checks: [...] }
  if (raw && Array.isArray(raw.checks)) return { ...raw, suite };

  // Bentuk `{ total, passed, failed, results }`: hitung ulang dari results,
  // jangan percaya penghitung manual suite.
  if (raw && Array.isArray(raw.results)) {
    const checks = raw.results.map((r) => ({
      name: r.name || r.label || 'check',
      passed: !!r.passed,
      detail: r.detail || r.message || null,
    }));
    const passed = checks.filter((c) => c.passed).length;
    return { suite, checks, total: checks.length, passed, failed: checks.length - passed };
  }

  // Bentuk lama: { totalTests, passed, failed, errors: [...] }
  const passed = (raw && raw.passed) || 0;
  const failed = (raw && raw.failed) || 0;
  const checks = [
    { name: 'legacy suite passed checks', passed: true, count: passed },
    ...(((raw && raw.errors) || []).map((e) => ({ name: String(e), passed: false, detail: null }))),
  ];
  // total diambil dari penghitung suite (bukan panjang `checks`) agar total = passed + failed.
  const rawTotal = raw && (raw.totalTests ?? raw.total);
  const total = rawTotal == null ? passed + failed : rawTotal;
  return { suite, checks, total, passed, failed };
}

module.exports = { createReport, record, finish, normalize };
