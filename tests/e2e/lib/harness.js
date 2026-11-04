/**
 * Harness bersama untuk seluruh suite E2E berbasis browser TMBilling.
 *
 * Semua helper di sini bekerja pada objek `page` dari Playwright (satu context
 * dipakai ulang antar suite oleh lib/browser.js), jadi setiap login diawali
 * pembersihan cookie agar sesi suite sebelumnya tidak bocor.
 */
const { BASE_URL } = require('./browser');
const { record } = require('./report');

const CLIENT_API_KEY = 'e2e-client-key';

const CREDENTIALS = {
  admin: { username: 'admin', password: 'admin123' },
  kasir: { username: 'kasir1', password: 'kasir123' },
};

const DEFAULT_WAIT_MS = 5000;
const POLL_INTERVAL_MS = 100;

// Sub-tab settings yang punya container `#subtab-<nama>` sendiri.
const SETTINGS_SUBTABS = new Set([
  'general',
  'payment',
  'kiosk',
  'local_backup',
  'cloud_backup',
  'whitelist_ip',
  'db_cleanup',
  'scheduler',
  'cloudflare_tunnel',
  'migration',
]);

let uniqueCounter = 0;

/** Peta id tab yang dipakai suite ke nama sub-tab settings, atau null. */
function settingsSubOf(id) {
  if (id === 'whitelist_ip') return 'whitelist_ip';
  if (String(id).startsWith('settings_')) return String(id).slice('settings_'.length);
  return null;
}

/**
 * Login bersih sebagai `admin` (default) atau `kasir`.
 * Cookie lama dibuang lebih dulu supaya role tidak tercampur antar suite.
 */
async function login(page, role = 'admin') {
  const creds = CREDENTIALS[role];
  if (!creds) throw new Error(`role tidak dikenal: ${role} (pakai 'admin' atau 'kasir')`);

  await page.context().clearCookies();
  await page.goto(`${BASE_URL}/kasir/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#username', creds.username);
  await page.fill('#password', creds.password);
  await page.click('#btn-login');
  await page.waitForURL(/\/kasir\/?$/, { timeout: DEFAULT_WAIT_MS });
  await page.waitForSelector('#tab-dash', { state: 'visible', timeout: DEFAULT_WAIT_MS });
  return page;
}

/** Akhiri sesi: buang cookie lalu mendarat di halaman login. */
async function logout(page) {
  await page.context().clearCookies();
  await page.goto(`${BASE_URL}/kasir/login`, { waitUntil: 'domcontentloaded' });
}

/**
 * Pindah tab utama dashboard lewat `App.switchTab` (sama seperti klik sidebar).
 * Id `settings_*` / `whitelist_ip` otomatis menunggu sub-tab yang sesuai.
 */
async function tab(page, id) {
  await page.evaluate((target) => App.switchTab(target), id);
  const sub = settingsSubOf(id);
  if (sub) {
    await page.waitForSelector('#tab-settings:not(.hidden)', { timeout: DEFAULT_WAIT_MS });
    if (SETTINGS_SUBTABS.has(sub)) {
      await page.waitForSelector(`#subtab-${sub}:not(.hidden)`, { timeout: DEFAULT_WAIT_MS });
    }
    return;
  }
  await page.waitForSelector(`#tab-${id}:not(.hidden)`, { timeout: DEFAULT_WAIT_MS });
}

/** Buka satu sub-tab halaman settings (mis. 'payment', 'migration'). */
async function settingsTab(page, sub) {
  await tab(page, `settings_${sub}`);
}

/**
 * Jalankan ekspresi async di dalam halaman dan kembalikan hasilnya.
 * Contoh: `api(page, 'API.pc.list()')`.
 */
async function api(page, code) {
  return page.evaluate((expression) => new Function(`return (${expression})`)(), code);
}

/**
 * Panggil endpoint polling client persis seperti PC klien (POST + X-Client-Key).
 * `http_status` disertakan agar suite bisa menguji penolakan API key.
 */
async function clientPoll(page, { ip, mac, role = 'guest', key = CLIENT_API_KEY } = {}) {
  const res = await page.request.post(`${BASE_URL}/api/v1/public/client/status`, {
    headers: { 'X-Client-Key': key },
    data: { ip_address: ip, mac_address: mac, role },
  });
  const body = await res.json().catch(() => ({}));
  return { ...body, http_status: res.status() };
}

/**
 * Kirim metrik hardware seperti agent monitor. Server mencocokkan PC dari
 * `ip_address`/`mac_address` di payload (bukan remote_addr), jadi proxy apa pun aman.
 */
async function hardwarePost(page, { ip, mac, data = {} } = {}) {
  const res = await page.request.post(`${BASE_URL}/api/v1/public/monitor/`, {
    headers: { 'X-Client-Key': CLIENT_API_KEY, 'X-Forwarded-For': ip || '' },
    data: { ...data, ip_address: ip, mac_address: mac },
  });
  const body = await res.json().catch(() => ({}));
  return { ...body, http_status: res.status() };
}

/**
 * Tunggu sampai `fn` (dijalankan di halaman) mengembalikan nilai truthy.
 * Batas atas 5 detik dan tanpa `page.waitForTimeout` sesuai kontrak E2E.
 */
async function waitFor(page, fn, { timeout = DEFAULT_WAIT_MS, label } = {}) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try {
      const value = await page.evaluate(fn);
      if (value) return value;
      last = value;
    } catch (err) {
      last = err && err.message ? `error: ${err.message}` : String(err);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`${label || 'kondisi'} tidak terpenuhi dalam ${timeout} ms (nilai terakhir: ${JSON.stringify(last)})`);
}

/** Nama unik per run untuk data uji yang dibuat suite. */
function unique(prefix) {
  uniqueCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${uniqueCounter}`;
}

/** Bungkus satu check: lemparan di dalam `fn` dicatat sebagai FAIL, bukan crash suite. */
async function check(report, name, fn) {
  try {
    await fn();
    record(report, name, true);
    return true;
  } catch (err) {
    record(report, name, false, err && err.message ? err.message : String(err));
    return false;
  }
}

module.exports = {
  BASE_URL,
  CLIENT_API_KEY,
  login,
  logout,
  tab,
  settingsTab,
  api,
  clientPoll,
  hardwarePost,
  waitFor,
  unique,
  check,
};
