/**
 * Master E2E CLI untuk TMBilling.
 *
 * Registry suite tinggal di sini; Python hanya memanggil per id:
 *   node tests/e2e/run_all_e2e.js --list
 *   node tests/e2e/run_all_e2e.js --suite pc_billing --json tests/e2e/results/pc_billing.json
 *
 * Exit code: 0 = semua check lulus, 1 = ada check gagal / suite melempar error,
 * 2 = argumen salah atau browser tidak tersedia (bukan hasil tes).
 */
const fs = require('fs');
const path = require('path');
const { createReport, record, finish, normalize } = require('./lib/report');
const { launchBrowser, BrowserUnavailableError } = require('./lib/browser');

const suites = [
  {
    id: 'pc_billing',
    title: 'PC, denah meja, siklus billing, dan blackout',
    browser: true,
    runner: require('./test_e2e_pc_billing_lifecycle.js').runPCBillingLifecycleE2ETest,
  },
  {
    id: 'fnb_pos',
    title: 'POS kantin, stok, struk, dan laporan menu',
    browser: true,
    runner: require('./test_e2e_fnb_pos_struk.js').runFnBPosStrukE2ETest,
  },
  {
    id: 'member_paket',
    title: 'Member, paket billing, dan grup PC',
    browser: true,
    runner: require('./test_e2e_member_paket.js').runMemberPaketE2ETest,
  },
  {
    id: 'auth_shift_notes',
    title: 'Autentikasi, shift kasir, catatan, dan riwayat shift',
    browser: true,
    runner: require('./test_e2e_auth_shift_notes.js').runAuthShiftNotesE2ETest,
  },
  {
    id: 'hardware_maintenance_remote',
    title: 'Hardware checker, uptime, maintenance, dan remote tools',
    browser: true,
    runner: require('./test_e2e_hardware_maintenance_remote.js').runHardwareMaintenanceRemoteE2ETest,
  },
  {
    id: 'tournament_game',
    title: 'Turnamen eSports dan katalog game',
    browser: true,
    runner: require('./test_e2e_tournament_game.js').runTournamentGameE2ETest,
  },
  {
    id: 'settings_admin_logs',
    title: 'Settings, RBAC, user management, dan audit log',
    browser: true,
    runner: require('./test_e2e_settings_admin_logs.js').runSettingsAdminLogsE2ETest,
  },
  {
    id: 'public_portals_cms',
    title: 'Delapan portal publik dan CMS dokumentasi',
    browser: true,
    runner: require('./test_e2e_public_portals_cms.js').runPublicPortalsCMSE2ETest,
  },
  {
    id: '_selftest',
    title: 'Self-test: membuktikan runner meneruskan kegagalan',
    browser: false,
    runner: require('./lib/_selftest_suite.js').runRunnerSelfTest,
  },
  {
    id: '_smoke',
    title: 'Smoke: Chromium sungguhan bisa login ke dashboard',
    browser: true,
    runner: require('./lib/_smoke_suite.js').runSmokeE2ETest,
  },
  {
    id: '_harness',
    title: 'Harness: login, tab, API, DB, dan handshake client',
    browser: true,
    runner: require('./lib/_harness_suite.js').runHarnessE2ETest,
  },
];

function parseArgs(argv) {
  const opts = { list: false, suite: null, json: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--list') opts.list = true;
    else if (arg === '--suite') opts.suite = argv[++i];
    else if (arg === '--json') opts.json = argv[++i];
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`Argumen tidak dikenal: ${arg}`);
  }
  if (opts.suite !== null && !String(opts.suite).trim()) throw new Error('--suite butuh nilai id suite');
  if (opts.json !== null && !String(opts.json).trim()) throw new Error('--json butuh path berkas');
  return opts;
}

function selectSuites(spec) {
  // Tanpa --suite: jalankan semua suite bisnis, lewati suite internal (prefix `_`).
  if (spec === null) return suites.filter((s) => !s.id.startsWith('_'));
  const ids = String(spec).split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = ids.filter((id) => !suites.some((s) => s.id === id));
  if (unknown.length) throw new Error(`Suite tidak dikenal: ${unknown.join(', ')}. Lihat --list.`);
  return ids.map((id) => suites.find((s) => s.id === id));
}

function printUsage() {
  console.log([
    'Pemakaian: node tests/e2e/run_all_e2e.js [opsi]',
    '  --list            cetak satu id suite per baris',
    '  --suite a,b       jalankan hanya suite tersebut',
    '  --json <path>     tulis laporan hasil ke berkas JSON',
    '  --help            tampilkan bantuan ini',
  ].join('\n'));
}

async function main(argv) {
  let opts;
  let selected;
  try {
    opts = parseArgs(argv);
    if (opts.help) {
      printUsage();
      return 0;
    }
    if (opts.list) {
      suites.forEach((s) => console.log(s.id));
      return 0;
    }
    selected = selectSuites(opts.suite);
  } catch (err) {
    console.error(err.message);
    return 2;
  }

  // Browser hanya dinyalakan bila ada suite yang membutuhkannya, supaya suite
  // tanpa DOM (mis. _selftest) tetap bisa jalan di mesin tanpa Chromium.
  let session = null;
  if (selected.some((s) => s.browser)) {
    try {
      session = await launchBrowser();
    } catch (err) {
      if (err instanceof BrowserUnavailableError) {
        console.error(`BROWSER_NOT_AVAILABLE: ${err.message}`);
        if (err.detail) console.error(`Detail: ${err.detail}`);
        console.error(`Suite yang tidak bisa dijalankan: ${selected.filter((s) => s.browser).map((s) => s.id).join(', ')}`);
        return 2;
      }
      throw err;
    }
  }

  try {
    const reports = [];
    for (const suite of selected) {
      const started = Date.now();
      console.log(`\n▶ ${suite.id} — ${suite.title}`);
      let raw;
      try {
        raw = await suite.runner(session ? session.page : undefined);
      } catch (err) {
        const failedReport = createReport(suite.id);
        record(failedReport, 'suite exception', false, err && err.message ? err.message : String(err));
        raw = finish(failedReport);
      }
      const report = normalize(raw, suite.id);
      for (const check of report.checks) {
        const line = `  ${check.passed ? '[PASS]' : '[FAIL]'} ${check.name}${check.detail ? ` — ${check.detail}` : ''}`;
        if (check.passed) console.log(line);
        else console.error(line);
      }
      const durationMs = Date.now() - started;
      console.log(`  ${report.passed}/${report.total} check lulus dalam ${(durationMs / 1000).toFixed(2)}s`);
      reports.push({ ...report, durationMs });
    }

    const total = reports.reduce((n, r) => n + r.total, 0);
    const passed = reports.reduce((n, r) => n + r.passed, 0);
    const failed = reports.reduce((n, r) => n + r.failed, 0);

    console.log('\n=======================================================');
    console.log(`Suite: ${selected.map((s) => s.id).join(', ')}`);
    console.log(`Total check: ${total} (${passed} lulus, ${failed} gagal)`);
    console.log('=======================================================');

    if (opts.json) {
      const outPath = path.resolve(opts.json);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(
        outPath,
        JSON.stringify(
          { suite: selected.map((s) => s.id).join(','), suites: reports, total, passed, failed, endTime: new Date().toISOString() },
          null,
          2
        )
      );
      console.log(`Laporan ditulis: ${outPath}`);
    }

    return failed > 0 ? 1 : 0;
  } finally {
    if (session) await session.close();
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(err && err.stack ? err.stack : String(err));
      process.exit(1);
    }
  );
}

module.exports = { suites, main };
