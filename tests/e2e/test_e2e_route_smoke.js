/**
 * Suite `route_smoke`: memastikan setiap rute yang belum dipakai suite bisnis
 * tetap dijalankan lewat HTTP sehingga gerbang cakupan (`check_coverage_gate.py`)
 * tidak menemukan endpoint yang tidak pernah dipanggil.
 *
 * Kontrak: rute boleh membalas 2xx/4xx (payload sengaja minimal atau id fiktif),
 * tetapi tidak boleh 5xx dan tidak boleh gagal di level koneksi.
 */
const assert = require('assert');
const { createReport, record, finish } = require('./lib/report');
const { BASE_URL, login, tab, check } = require('./lib/harness');

const ID = '999999';

// Dijalankan setelah login admin; CSRF diambil dari meta halaman kasir.
async function csrfOf(page) {
  return page.evaluate(() => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
  });
}

async function callKasir(page, token, method, path, data) {
  const res = await page.request.fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'X-CSRFToken': token, 'Content-Type': 'application/json' },
    data: data === undefined ? undefined : JSON.stringify(data),
  });
  const body = await res.json().catch(async () => ({ raw: (await res.text().catch(() => '')).slice(0, 120) }));
  return { status: res.status(), body };
}

async function callClient(page, method, path, data) {
  const res = await page.request.fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'X-Client-Key': process.env.CLIENT_API_KEY || 'e2e-client-key', 'X-Forwarded-For': '192.168.1.11' },
    data: data === undefined ? undefined : JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status(), body };
}

async function callPublic(page, method, path, data) {
  const res = await page.request.fetch(`${BASE_URL}${path}`, {
    method,
    data: data === undefined ? undefined : JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status(), body };
}

const CLIENT_GROUPS = [
  ['client agent (API key)', [
    ['POST', '/api/v1/public/client/identify', { ip_address: '192.168.1.11' }],
    ['POST', '/api/v1/public/client/selesai', { ip_address: '192.168.1.11' }],
    ['POST', '/api/v1/public/client/afk-lock', { ip_address: '192.168.1.11' }],
    ['POST', '/api/v1/public/client/afk-unlock', { ip_address: '192.168.1.11', pin: '0000' }],
    ['POST', '/api/v1/public/client/vnc_ready', { ip_address: '192.168.1.11' }],
    ['POST', '/api/v1/public/client/vnc_stopped', { ip_address: '192.168.1.11' }],
    ['POST', '/api/v1/public/client/admin-login', { ip_address: '192.168.1.11' }],
  ]],
];

const PUBLIC_GROUPS = [
  ['auth publik member', [
    ['POST', '/api/v1/public/auth/status', { username: 'member1' }],
    ['POST', '/api/v1/public/auth/login', { username: 'member1', password: 'salah' }],
    ['POST', '/api/v1/public/auth/logout', {}],
  ]],
  ['portal & halaman publik', [
    ['GET', '/api/health'],
    ['GET', '/tv/dynamic'],
  ]],
];

const KASIR_GROUPS = [
  ['auth kasir', [
    ['POST', '/api/v1/kasir/auth/admin-check', { username: 'admin', password: 'admin123' }],
    ['POST', '/api/v1/kasir/auth/logout', {}],
  ]],
  ['perangkat PC', [
    ['POST', '/api/v1/kasir/pc/', { kode: 'PC-SMOKE', grup_id: 1, ip_address: '192.168.1.90' }],
    ['POST', '/api/v1/kasir/pc/batch', { grup_id: 1, jumlah: 0 }],
    ['PUT', `/api/v1/kasir/pc/${ID}`, { kode: 'PC-SMOKE' }],
    ['PUT', `/api/v1/kasir/pc/${ID}/position`, { x: 1, y: 1 }],
    ['POST', `/api/v1/kasir/pc/reset-admin/${ID}`, {}],
  ]],
  ['sesi lanjutan', [
    ['POST', '/api/v1/kasir/sesi/buka-guest-batch', { pc_kode: ['PC-TIDAK-ADA'], paket_id: 1 }],
    ['POST', '/api/v1/kasir/sesi/tambah-waktu-batch', { sesi_id: [ID], paket_id: 1 }],
    ['POST', '/api/v1/kasir/sesi/tutup-batch', { sesi_id: [ID] }],
    ['POST', '/api/v1/kasir/sesi/refund-paket', { transaksi_id: ID }],
    ['GET', `/api/v1/kasir/sesi/${ID}/riwayat-paket`],
  ]],
  ['blackout lanjutan', [
    ['POST', `/api/v1/kasir/blackout/resolve/member/${ID}`, { paket_id: 1 }],
    ['POST', '/api/v1/kasir/blackout/clear', {}],
  ]],
  ['member lanjutan', [
    ['GET', `/api/v1/kasir/member/${ID}/paket`],
    ['PUT', `/api/v1/kasir/member/${ID}`, { nama: 'member-smoke' }],
    ['DELETE', `/api/v1/kasir/member/${ID}`],
  ]],
  ['menu lanjutan', [
    ['GET', '/api/v1/kasir/menu/transaksi'],
    ['GET', '/api/v1/kasir/menu/stock-logs/dates'],
    ['PUT', `/api/v1/kasir/menu/${ID}`, { nama: 'menu-smoke' }],
    ['DELETE', `/api/v1/kasir/menu/${ID}/permanent`],
  ]],
  ['game & turnamen', [
    ['POST', '/api/v1/kasir/game/kategori', { nama: 'Smoke Kategori' }],
    ['DELETE', `/api/v1/kasir/game/kategori/${ID}`],
    ['POST', `/api/v1/kasir/tournament/stage/${ID}/finish`, {}],
    ['DELETE', `/api/v1/kasir/tournament/${ID}`],
  ]],
  ['maintenance lanjutan', [
    ['GET', '/api/v1/kasir/maintenance/export'],
    ['DELETE', `/api/v1/kasir/maintenance/${ID}`],
  ]],
  ['catatan shift', [
    ['POST', '/api/v1/kasir/notes/catatan-smoke.txt/duplicate', {}],
    ['POST', '/api/v1/kasir/notes/catatan-smoke.txt/pin', {}],
    ['GET', '/api/v1/kasir/notes/catatan-smoke.txt/download'],
  ]],
  ['monitor & remote', [
    ['GET', '/api/v1/kasir/dashboard/server-metrics'],
    ['GET', `/api/v1/kasir/monitor/hardware/${ID}`],
    ['POST', `/api/v1/kasir/monitor/register/${ID}`, {}],
    ['GET', `/api/v1/kasir/monitor/vnc_client/${ID}/status`],
    ['POST', `/api/v1/kasir/monitor/vnc_client/${ID}/start`, {}],
    ['POST', `/api/v1/kasir/monitor/vnc_client/${ID}/stop`, {}],
    ['DELETE', `/api/v1/kasir/monitor/${ID}`],
    ['POST', `/api/v1/kasir/monitor/remote/${ID}/afk-lock`, {}],
    ['POST', `/api/v1/kasir/monitor/remote/${ID}/afk-unlock`, {}],
    ['POST', '/api/v1/kasir/monitor/remote/batch', { pc_ids: [ID], action: 'afk_lock' }],
    ['GET', '/api/v1/kasir/vnc/status'],
    ['POST', `/api/v1/kasir/vnc/client/${ID}/start`, {}],
    ['POST', `/api/v1/kasir/vnc/client/${ID}/stop`, {}],
  ]],
  ['arsip lanjutan', [
    ['GET', '/api/v1/kasir/arsip/'],
    ['POST', '/api/v1/kasir/grup/999999/archive'],
    ['POST', '/api/v1/kasir/grup/999999/restore'],
    ['POST', '/api/v1/kasir/pc/999999/archive'],
    ['POST', '/api/v1/kasir/pc/999999/restore'],
    ['POST', '/api/v1/kasir/paket/999999/archive'],
    ['POST', '/api/v1/kasir/paket/999999/restore'],
    ['POST', '/api/v1/kasir/member/999999/archive'],
    ['POST', '/api/v1/kasir/member/999999/restore'],
    ['POST', '/api/v1/kasir/user/999999/archive'],
    ['POST', '/api/v1/kasir/user/999999/restore'],
    ['POST', '/api/v1/kasir/game/999999/archive'],
    ['POST', '/api/v1/kasir/game/999999/restore'],
  ]],
  ['laporan lanjutan', [
    ['GET', '/api/v1/kasir/report/blackout-log'],
    ['GET', '/api/v1/kasir/report/export/audit-pdf'],
    ['GET', '/api/v1/kasir/report/export/kantin'],
    ['GET', '/api/v1/kasir/report/export/pnl'],
    ['GET', '/api/v1/kasir/report/log/export'],
    ['GET', '/api/v1/kasir/uptime/range?start=2026-01-01&end=2026-01-02'],
    ['DELETE', `/api/v1/kasir/report/transaksi/${ID}`],
  ]],
  ['backup lanjutan', [
    ['POST', '/api/v1/kasir/backup/test-connection', {}],
    ['GET', '/api/v1/kasir/backup/download/tidak-ada.zip'],
    ['DELETE', '/api/v1/kasir/backup/delete/tidak-ada.zip'],
  ]],
  ['mikrotik', [
    ['POST', '/api/v1/kasir/mikrotik/config', { host: '', username: '', password: '' }],
    ['POST', '/api/v1/kasir/mikrotik/test', { host: '', username: '', password: '' }],
    ['POST', '/api/v1/kasir/mikrotik/sync_all', {}],
  ]],
  ['tutorial', [
    ['POST', '/api/v1/kasir/tutorials/cleanup-temp', {}],
    ['POST', '/api/v1/kasir/tutorials/export-json', {}],
    ['POST', '/api/v1/kasir/tutorials/upload-image', {}],
    ['DELETE', '/api/v1/kasir/tutorials/categories/kategori-tidak-ada'],
  ]],
  ['user lanjutan', [
    ['POST', `/api/v1/kasir/user/${ID}/reset-kuota`, {}],
  ]],
  // Mutasi yang mengubah konfigurasi global dijalankan paling akhir.
  ['settings lanjutan', [
    ['POST', '/api/v1/kasir/settings/app-public-url', { url: 'http://127.0.0.1' }],
    ['PUT', '/api/v1/kasir/settings/timezone', { timezone: 'Asia/Jakarta' }],
    ['PUT', '/api/v1/kasir/settings/scheduler', { jam_backup: 3 }],
    ['PUT', '/api/v1/kasir/settings/auto-shutdown', { enabled: false }],
    ['PUT', '/api/v1/kasir/settings/client-polling-interval', { interval: 5 }],
    ['POST', '/api/v1/kasir/settings/scheduler/restart', {}],
    ['POST', '/api/v1/kasir/settings/ip-whitelist/regenerate-token', {}],
    ['POST', '/api/v1/kasir/settings/cloudflare-tunnel/save-token', { token: '' }],
    ['POST', '/api/v1/kasir/settings/cloudflare-tunnel/toggle', { enabled: false }],
    ['POST', '/api/v1/kasir/settings/qris', {}],
    ['POST', '/api/v1/kasir/settings/database/purge-and-vacuum', { confirm: false }],
    ['PUT', '/api/v1/kasir/settings/apikey', { api_key: 'e2e-client-key' }],
  ]],
  ['pembersihan riwayat', [
    ['POST', '/api/v1/kasir/report/log/clear', { archive: false }],
    ['POST', '/api/v1/kasir/report/transaksi/clear', { tanggal: '2000-01-01' }],
  ]],
];

function describeFailure(method, path, result) {
  return `${method} ${path} -> ${result.status} ${JSON.stringify(result.body).slice(0, 160)}`;
}

async function runSmokeGroup(page, token, label, entries) {
  const failures = [];
  for (const [method, path, data] of entries) {
    const result = await callKasir(page, token, method, path, data);
    if (result.status >= 500 || result.status === 0) failures.push(describeFailure(method, path, result));
  }
  assert.deepStrictEqual(failures, [], `${label} membalas 5xx`);
}

async function runRouteSmokeE2ETest(page) {
  const report = createReport('route_smoke');
  await page.goto(`${BASE_URL}/kasir/login`, { waitUntil: 'domcontentloaded' });

  await check(report, 'Rute klien agent merespons tanpa 5xx', async () => {
    const failures = [];
    for (const [, entries] of CLIENT_GROUPS) {
      for (const [method, path, data] of entries) {
        const result = await callClient(page, method, path, data);
        if (result.status >= 500) failures.push(describeFailure(method, path, result));
      }
    }
    assert.deepStrictEqual(failures, [], 'rute klien agent membalas 5xx');
  });

  await check(report, 'Rute publik merespons tanpa 5xx', async () => {
    const failures = [];
    for (const [, entries] of PUBLIC_GROUPS) {
      for (const [method, path, data] of entries) {
        const result = await callPublic(page, method, path, data);
        if (result.status >= 500) failures.push(describeFailure(method, path, result));
      }
    }
    assert.deepStrictEqual(failures, [], 'rute publik membalas 5xx');
  });

  await login(page, 'admin');
  const token = await csrfOf(page);

  await check(report, 'Rute portal member merespons tanpa 5xx', async () => {
    await page.goto(`${BASE_URL}/member/login`, { waitUntil: 'domcontentloaded' });
    const portalToken = await csrfOf(page);
    const failures = [];
    for (const [method, path, data] of [
      ['POST', '/member/profile/update', { nama: 'Smoke Member' }],
      ['POST', '/member/logout', {}],
    ]) {
      const result = await callKasir(page, portalToken, method, path, data);
      if (result.status >= 500) failures.push(describeFailure(method, path, result));
    }
    assert.deepStrictEqual(failures, [], 'rute portal member membalas 5xx');
  });

  await check(report, 'CSRF halaman portal tersedia', async () => {
    await page.goto(`${BASE_URL}/kasir/`, { waitUntil: 'domcontentloaded' });
    assert.ok(await csrfOf(page), 'meta csrf-token harus ada di dashboard kasir');
  });

  for (const [label, entries] of KASIR_GROUPS) {
    await check(report, `Rute kasir: ${label}`, () => runSmokeGroup(page, token, label, entries));
  }

  await check(report, 'Header dan aksi arsip mengikuti tabel aktif tiap tab', async () => {
    await login(page, 'admin');
    const diffs = [];
    for (const [t, tabId] of [['grup', 'grup'], ['paket', 'paket'], ['member', 'member'], ['user', 'user'], ['game', 'game_management']]) {
      await tab(page, tabId);
      await page.waitForTimeout(250);
      const result = await page.evaluate(({ res, tabId }) => {
        const samples = {
          grup: { id: 1, nama: 'G', keterangan: 'k' },
          paket: { id: 1, nama: 'P', durasi_menit: 60, harga: 5000, kadaluarsa_hari: 30 },
          member: { id: 1, username: 'm', nama_lengkap: 'M', grup: 'Reguler', waktu_tersimpan: 60, kadaluarsa_pada_display: '-' },
          user: { id: 1, username: 'u', role: 'kasir', kuota_main_bulanan: 0 },
          game: { id: 1, nama: 'G', tipe: 'FPS', kategori: 'eSports' }
        };
        const div = document.createElement('div');
        div.innerHTML = ArsipList.render({ items: [samples[res]], res });
        const heads = [...div.querySelectorAll('thead th')].map(e => e.textContent.trim());
        const buttons = [...div.querySelectorAll('tbody button')].map(b => b.title).sort();
        const scope = document.getElementById(`tab-${tabId}`) || document;
        const tables = [...scope.querySelectorAll('table')]
          .filter(tb => tb.querySelectorAll('thead th').length > 1)
          .sort((a, b) => b.querySelectorAll('thead th').length - a.querySelectorAll('thead th').length);
        const active = [...(tables[0]?.querySelectorAll('thead th') || [])]
          .filter(e => e.offsetParent !== null)
          .map(e => e.textContent.trim());
        return { heads, buttons, active };
      }, { res: t, tabId });
      if (JSON.stringify(result.heads) !== JSON.stringify(result.active)) {
        diffs.push(`${t}: ${JSON.stringify(result.active)} vs ${JSON.stringify(result.heads)}`);
      }
      if (JSON.stringify(result.buttons) !== JSON.stringify(['Hapus permanen', 'Pulihkan'])) {
        diffs.push(`${t}: aksi ${JSON.stringify(result.buttons)}`);
      }
    }
    assert.deepStrictEqual(diffs, []);
  });

  await check(report, 'Semua tab menampilkan daftar arsip tanpa teks rusak', async () => {
    await login(page, 'admin');
    const broken = [];
    for (const [t, tabId] of [['grup', 'grup'], ['pc', 'pc'], ['paket', 'paket'], ['member', 'member'], ['user', 'user'], ['game', 'game_management'], ['menu', 'menu']]) {
      await tab(page, tabId);
      await page.click(t === 'menu' ? '#menu-tab-archived-btn' : `#${t}-view-arsip`);
      await page.waitForTimeout(300);
      const el = page.locator(`#${t}-arsip-list`);
      if (!(await el.isVisible())) { broken.push(`${t}:tidak-terlihat`); continue; }
      const text = (await el.innerText()).trim();
      if (/undefined|NaN/.test(text)) broken.push(`${t}:teks-rusak`);
      if (text === '') broken.push(`${t}:kosong-tanpa-pesan`);
    }
    assert.deepStrictEqual(broken, []);
  });

  await check(report, 'Tab Data Diarsipkan memakai pill kategori, bukan tumpukan seksi', async () => {
    await login(page, 'admin');
    await tab(page, 'arsip');
    await page.waitForSelector('#arsip-pill-pc', { state: 'visible', timeout: 10000 });
    await page.click('#arsip-pill-pc');
    const pillClass = await page.getAttribute('#arsip-pill-pc', 'class');
    assert.ok(/bg-neutral-100/.test(pillClass || ''), 'pill PC harus aktif setelah diklik');
    const panelText = await page.locator('#arsip-panel').innerText();
    assert.ok(!panelText.includes('Grup PC / Zona'), 'panel PC tidak boleh menampilkan seksi grup');
  });

  await check(report, 'Pill arsip per tab menukar daftar aktif dengan daftar arsip', async () => {
    await tab(page, 'paket');
    await page.waitForSelector('#paket-view-arsip', { state: 'visible', timeout: 10000 });
    await page.click('#paket-view-arsip');
    await page.waitForSelector('#paket-arsip-list', { state: 'visible', timeout: 5000 });
    assert.ok(await page.locator('#paket-table').isHidden(), 'tabel aktif harus tersembunyi saat mode arsip');
    await page.click('#paket-view-aktif');
    await page.waitForSelector('#paket-table', { state: 'visible', timeout: 5000 });
    assert.ok(await page.locator('#paket-arsip-list').isHidden(), 'daftar arsip harus tersembunyi saat kembali aktif');
  });

  return finish(report);
}

module.exports = { runRouteSmokeE2ETest };
