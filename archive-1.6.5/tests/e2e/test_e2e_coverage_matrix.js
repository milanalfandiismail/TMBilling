/**
 * E2E Test Suite: Matriks Cakupan Tab, Sub-tab Settings, dan Portal Publik
 *
 * Suite ini tidak menguji fitur, melainkan MENJAGA CAKUPAN:
 * 1. Setiap container `.tab-content[id^="tab-"]` di DOM punya entri di manifest.
 * 2. Setiap entri manifest punya container di DOM (manifest != khayalan).
 * 3. Setiap entri manifest punya suite pemilik; `null` -> gagal `tab <id> belum punya suite E2E`.
 * 4. Setiap tab bisa dibuka bersih: `App.switchTab`, container tampil sendirian,
 *    `#tab-dash` tersembunyi, dan tidak ada pageerror.
 * 5. Setiap 10 sub-tab settings menampilkan `#subtab-<nama>`-nya.
 * 6. Setiap nilai `data-tab` di sidebar menuju container yang benar-benar ada.
 * 7. Setiap portal publik merender root-nya (HTTP 200).
 *
 * Sumber nilai: `tests/e2e/lib/coverage_manifest.js` (turunan template) dan DOM live.
 */

const { BASE_URL, login, tab, check } = require('./lib/harness');
const { createReport, finish, record } = require('./lib/report');

/** Container utama yang seharusnya tampil untuk sebuah id tab. */
function mainTabOf(id) {
  return id === 'whitelist_ip' || id.startsWith('settings_') ? 'settings' : id;
}

/** Id tab settings untuk sebuah sub-tab (`whitelist_ip` bukan `settings_whitelist_ip`). */
function settingsIdOf(sub) {
  return sub === 'whitelist_ip' ? 'whitelist_ip' : `settings_${sub}`;
}

async function visibleTabContent(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('.tab-content'))
      .filter((el) => !el.classList.contains('hidden'))
      .map((el) => el.id)
  );
}

async function runCoverageMatrixE2ETest(page) {
  const report = createReport('coverage');

  // require lazy: registry `run_all_e2e.js` me-require suite ini saat startup,
  // jadi manifest yang belum ada harus jadi FAIL tercatat, bukan crash CLI.
  let manifest;
  try {
    manifest = require('./lib/coverage_manifest');
  } catch (err) {
    record(report, 'manifest cakupan tersedia', false, `lib/coverage_manifest.js gagal dimuat: ${err.message}`);
    return finish(report);
  }

  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await login(page);
  record(report, 'admin bisa login ke dashboard', true);

  const domTabs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.tab-content[id^="tab-"]')).map((el) => el.id.replace(/^tab-/, ''))
  );
  const manifestIds = Object.keys(manifest.tabs);

  await check(report, 'semua container tab di DOM terdaftar di manifest', () => {
    const unknown = domTabs.filter((id) => !(id in manifest.tabs));
    if (unknown.length) throw new Error(`tidak ada di manifest: ${unknown.join(', ')}`);
  });

  // --- Tab: kepemilikan, keberadaan di DOM, dan perpindahan bersih ---------
  for (const id of manifestIds) {
    await check(report, `tab ${id} punya suite E2E`, () => {
      const owner = manifest.tabs[id];
      if (!owner) throw new Error(`tab ${id} belum punya suite E2E`);
    });

    await check(report, `tab ${id} ada di DOM`, () => {
      if (!domTabs.includes(id)) throw new Error(`#tab-${id} tidak ditemukan di DOM`);
    });

    await check(report, `tab ${id} bisa dibuka bersih`, async () => {
      const before = pageErrors.length;
      await tab(page, id);
      const expected = `tab-${mainTabOf(id)}`;
      const visible = await visibleTabContent(page);
      if (visible.length !== 1 || visible[0] !== expected) {
        throw new Error(`container terlihat [${visible.join(', ')}], seharusnya hanya ${expected}`);
      }
      if (mainTabOf(id) !== 'dash' && visible.includes('tab-dash')) {
        throw new Error('#tab-dash masih terlihat setelah pindah tab');
      }
      const current = await page.evaluate(() => window.App.currentTab);
      if (current !== id) throw new Error(`App.currentTab = ${current}, seharusnya ${id}`);
      const errs = pageErrors.slice(before);
      if (errs.length) throw new Error(`pageerror: ${errs.join(' | ')}`);
    });
  }

  // --- Semua tab non-dashboard terpusat -----------------------------------
  await check(report, 'tab non-dashboard terpusat di semua breakpoint desktop', async () => {
    const failures = [];
    try {
      for (const width of [1024, 1280, 1536, 1920]) {
        await page.setViewportSize({ width, height: 1080 });
        for (const id of manifestIds) {
          await tab(page, id);
          const containerId = mainTabOf(id);
          const box = await page.evaluate((tabId) => {
            const el = document.getElementById(`tab-${tabId}`);
            const main = document.getElementById('main-scroll');
            const cs = getComputedStyle(main);
            const mainRect = main.getBoundingClientRect();
            const rect = el.getBoundingClientRect();
            const padL = parseFloat(cs.paddingLeft) || 0;
            const padR = parseFloat(cs.paddingRight) || 0;
            return {
              left: rect.left,
              width: rect.width,
              innerLeft: mainRect.left + main.clientLeft + padL,
              innerWidth: main.clientWidth - padL - padR,
            };
          }, containerId);
          if (containerId === 'dash') {
            if (Math.abs(box.width - box.innerWidth) > 2) {
              failures.push(`dash@${width}: ${box.width}px != ${box.innerWidth}px`);
            }
            continue;
          }
          if (box.width > 1281) failures.push(`${id}@${width}: lebar ${box.width}px`);
          const expected = box.innerLeft + (box.innerWidth - box.width) / 2;
          if (Math.abs(box.left - expected) > 2) {
            failures.push(`${id}@${width}: left ${box.left}px != ${expected}px`);
          }
        }
      }
    } finally {
      await page.setViewportSize({ width: 1280, height: 720 });
    }
    if (failures.length) throw new Error(failures.slice(0, 6).join(' | '));
  });

  // --- 10 sub-tab settings --------------------------------------------------
  const domSubtabs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[id^="subtab-"]')).map((el) => el.id.replace(/^subtab-/, ''))
  );
  await check(report, 'daftar sub-tab manifest sama dengan DOM', () => {
    const missingInDom = manifest.settingsSubtabs.filter((sub) => !domSubtabs.includes(sub));
    const missingInManifest = domSubtabs.filter((sub) => !manifest.settingsSubtabs.includes(sub));
    if (missingInDom.length) throw new Error(`tidak ada di DOM: ${missingInDom.join(', ')}`);
    if (missingInManifest.length) throw new Error(`tidak ada di manifest: ${missingInManifest.join(', ')}`);
  });

  for (const sub of manifest.settingsSubtabs) {
    await check(report, `subtab ${sub} bisa dibuka bersih`, async () => {
      const before = pageErrors.length;
      await tab(page, settingsIdOf(sub));
      const visible = await visibleTabContent(page);
      if (visible.length !== 1 || visible[0] !== 'tab-settings') {
        throw new Error(`container terlihat [${visible.join(', ')}], seharusnya hanya tab-settings`);
      }
      const shown = await page.evaluate(
        (name) => !!document.querySelector(`#subtab-${name}`) && !document.getElementById(`subtab-${name}`).classList.contains('hidden'),
        sub
      );
      if (!shown) throw new Error(`#subtab-${sub} tidak tampil`);
      const errs = pageErrors.slice(before);
      if (errs.length) throw new Error(`pageerror: ${errs.join(' | ')}`);
    });
  }

  // --- Navigasi sidebar: setiap data-tab menuju container nyata -------------
  const navValues = await page.evaluate(() =>
    Array.from(new Set(Array.from(document.querySelectorAll('[data-tab]')).map((el) => el.dataset.tab)))
  );
  for (const value of navValues) {
    await check(report, `nav ${value} menuju container nyata`, async () => {
      const main = mainTabOf(value);
      const sub = main === 'settings' ? value.replace(/^settings_/, '') : null;
      const found = await page.evaluate(
        ({ mainId, subId }) => {
          if (!document.getElementById(`tab-${mainId}`)) return `#tab-${mainId} tidak ada`;
          if (subId && !document.getElementById(`subtab-${subId}`)) return `#subtab-${subId} tidak ada`;
          return null;
        },
        { mainId: main, subId: sub }
      );
      if (found) throw new Error(found);
    });
  }

  // --- Portal publik --------------------------------------------------------
  for (const portal of manifest.portals) {
    await check(report, `portal ${portal.path} merender ${portal.root}`, async () => {
      const res = await page.goto(`${BASE_URL}${portal.path}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      if (!res) throw new Error('tidak ada respons');
      if (res.status() !== 200) throw new Error(`HTTP ${res.status()}`);
      await page.waitForSelector(portal.root, { state: 'attached', timeout: 5000 });
    });
  }

  await check(report, 'tidak ada pageerror selama matriks', () => {
    if (pageErrors.length) throw new Error(`${pageErrors.length} pageerror: ${pageErrors.slice(0, 3).join(' | ')}`);
  });

  return finish(report);
}

module.exports = { runCoverageMatrixE2ETest };
