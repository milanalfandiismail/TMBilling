/**
 * E2E Suite: Invariant Performa & Reflow Responsif
 *
 * Menjaga aturan normatif "Arsitektur & Standar Performa Frontend Kasir
 * (Zero CPU Thrashing)" di AGENTS.md §5 dan §6:
 *
 *   A. Pindai statis sumber kasir: tidak ada kelas animasi/blur terlarang
 *      (`animate-pulse`, `animate-ping`, `animate-bounce`, `animate-in`,
 *      `pulse-*`, `fade-in`, `zoom-in`, `backdrop-blur-*`, `hover:brightness-*`).
 *   B. CSS hasil build tidak memuat keyframes/utility animasi terlarang.
 *   C. Tiap satu dari 32 container tab: nol animasi `iterations: Infinity`
 *      dan nol elemen ber-`backdrop-filter` aktif.
 *   D. Dirty-checking nyata: kartu dashboard tidak dibangun ulang saat data
 *      tidak berubah (identitas node bertahan, nol mutasi childList 3 detik).
 *   E. Polling berhenti/tertahan saat tab browser tersembunyi lalu pulih.
 *   F. Guard `Dashboard._loading` mencegah request tumpang tindih, dan
 *      perpindahan tab cepat tidak memicu badai request.
 *   G. Matriks reflow 40 tampilan × 6 breakpoint (240 checks).
 *
 * Semua kelas terlarang di bawah ini WAJIB nol di `app/static/js/kasir` dan
 * `app/templates/kasir`. Portal publik (`app/templates/public/**`) sengaja
 * memakai `animate-pulse` untuk titik status live dan `backdrop-blur` untuk
 * glassmorphism; aturan AGENTS.md §5 berlaku untuk dashboard kasir, sehingga
 * pemakaian di portal publik dicatat sebagai pengecualian yang diterima dan
 * TIDAK ikut dipindai.
 */

const fs = require('fs');
const path = require('path');

const { BASE_URL, login, tab, check, waitFor } = require('./lib/harness');
const { createReport, finish, record } = require('./lib/report');
const { runResponsiveBreakpointsTest } = require('../playwright_responsive_breakpoints.js');

const ROOT = path.resolve(__dirname, '..', '..');

/** Token kelas yang dilarang pada sumber frontend kasir (AGENTS.md §5). */
const FORBIDDEN_TOKENS = [
  'animate-pulse',
  'animate-ping',
  'animate-bounce',
  'animate-in',
  'animate-modal-in',
  'backdrop-blur',
  'hover:brightness',
  'pulse-',
  'fade-in',
  'zoom-in',
];

/**
 * Utility animasi yang dilarang MUNCUL di CSS build sama sekali — tidak ada
 * pemakaian sah di seluruh aplikasi (kasir maupun portal publik).
 *
 * Pengecualian yang diterima dan sengaja TIDAK dipolisikan di sini:
 *   - `.animate-pulse`  -> titik status "live" di portal publik (tv, landing, game, livepc, paket, spesifikasi)
 *   - `.animate-marquee-slow` -> running text billboard TV (`public/tv/index.html`, 35s linear)
 * Keduanya hanya dipakai portal publik, bukan dashboard kasir; scan sumber kasir
 * (check A/B) membuktikannya, dan check runtime per tab membuktikan dashboard
 * bebas animasi `iterations: Infinity`.
 */
const BANNED_CSS_ANIMATIONS = new Set(['ping', 'bounce', 'in', 'modal-in']);

function walk(dir, ext) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, ext));
    else if (entry.name.endsWith(ext)) out.push(full);
  }
  return out;
}

/** Kembalikan daftar `file:line -> token` untuk setiap pelanggaran. */
function scanFiles(files, tokens) {
  const hits = [];
  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, idx) => {
      const found = tokens.filter((token) => line.includes(token));
      if (found.length) hits.push(`${rel}:${idx + 1} -> ${found.join(', ')}`);
    });
  }
  return hits;
}

/** Tunggu dua frame sebelum mengukur layout. */
async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)));
  }));
}

async function runPerfInvariantsE2ETest(page) {
  const report = createReport('perf_invariants');
  const manifest = require('./lib/coverage_manifest');
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  // ---------------------------------------------------------------- A. statis
  const kasirTemplates = walk(path.join(ROOT, 'app', 'templates', 'kasir'), '.html');
  const kasirScripts = walk(path.join(ROOT, 'app', 'static', 'js', 'kasir'), '.js');

  await check(report, 'template kasir bebas kelas animasi/blur terlarang', () => {
    const hits = scanFiles(kasirTemplates, FORBIDDEN_TOKENS);
    if (hits.length) throw new Error(`kelas terlarang: ${hits.join(' | ')}`);
  });

  await check(report, 'javascript kasir bebas kelas animasi/blur terlarang', () => {
    const hits = scanFiles(kasirScripts, FORBIDDEN_TOKENS);
    if (hits.length) throw new Error(`kelas terlarang: ${hits.join(' | ')}`);
  });

  await check(report, 'skeleton.js statis tanpa kelas animate-*', () => {
    const file = path.join(ROOT, 'app', 'static', 'js', 'kasir', 'core', 'skeleton.js');
    const hits = scanFiles([file], ['animate-']);
    if (hits.length) throw new Error(`skeleton beranimasi: ${hits.join(' | ')}`);
  });

  // --------------------------------------------------------------- B. CSS build
  await check(report, 'CSS build tanpa keyframes animasi terlarang', () => {
    const file = path.join(ROOT, 'app', 'static', 'css', 'tailwind.css');
    const css = fs.readFileSync(file, 'utf8');
    const keyframes = Array.from(css.matchAll(/@keyframes\s+([\w-]+)/g)).map((m) => m[1]);
    const banned = keyframes.filter(
      (name) => name.startsWith('pulse-') || ['modal-in', 'fade-in', 'zoom-in', 'animate-in'].includes(name)
    );
    if (banned.length) throw new Error(`@keyframes terlarang: ${banned.join(', ')} (app/static/css/tailwind.css)`);
  });

  await check(report, 'CSS build tanpa utility .animate-* terlarang', () => {
    const file = path.join(ROOT, 'app', 'static', 'css', 'tailwind.css');
    const css = fs.readFileSync(file, 'utf8');
    const banned = Array.from(css.matchAll(/\.animate-([a-z-]+)\s*\{/g))
      .map((m) => m[1])
      .filter((name) => BANNED_CSS_ANIMATIONS.has(name));
    if (banned.length) {
      throw new Error(`utility .animate-* terlarang di CSS: ${banned.join(', ')} (app/static/css/tailwind.css)`);
    }
    const brightness = Array.from(css.matchAll(/\.hover\\:brightness-[\w-]+/g)).map((m) => m[0]);
    if (brightness.length) throw new Error(`utility brightness pada hover: ${brightness.join(', ')}`);
  });

  await check(report, 'tailwind.config.js tidak mendefinisikan keyframes/animation kustom', () => {
    const file = path.join(ROOT, 'tailwind.config.js');
    const source = fs.readFileSync(file, 'utf8');
    const emptyKeyframes = /keyframes:\s*\{\s*\}/.test(source);
    const emptyAnimation = /animation:\s*\{\s*\}/.test(source);
    if (!emptyKeyframes || !emptyAnimation) {
      throw new Error('keyframes/animation kustom harus kosong agar tidak ada animasi loop tak berujung');
    }
  });

  // ------------------------------------------------------------------- runtime
  await login(page);
  record(report, 'admin bisa login untuk audit performa', true);

  const tabIds = Object.keys(manifest.tabs);
  for (const id of tabIds) {
    await check(report, `tab ${id} tanpa animasi infinite & backdrop-filter`, async () => {
      await tab(page, id);
      await settle(page);
      const found = await page.evaluate(() => {
        const container = document.querySelector('.tab-content:not(.hidden)');
        if (!container) return { error: 'tidak ada container tab yang tampil' };

        const infinite = [];
        for (const anim of container.getAnimations({ subtree: true })) {
          const timing = anim.effect && anim.effect.getTiming ? anim.effect.getTiming() : null;
          if (timing && timing.iterations === Infinity) {
            infinite.push(`${anim.animationName || anim.id || 'animation'}`);
          }
        }

        const blurred = [];
        for (const el of [container, ...container.querySelectorAll('*')]) {
          const style = getComputedStyle(el);
          const value = style.backdropFilter || style.webkitBackdropFilter;
          if (value && value !== 'none') {
            const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : '';
            blurred.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls : ''}=${value}`);
          }
        }
        return { infinite, blurred };
      });
      if (found.error) throw new Error(found.error);
      if (found.infinite.length) throw new Error(`animasi iterations:Infinity -> ${found.infinite.join(', ')}`);
      if (found.blurred.length) throw new Error(`backdrop-filter aktif -> ${found.blurred.slice(0, 3).join(', ')}`);
    });
  }

  // ------------------------------------------------- D. dirty-checking nyata
  await check(report, 'dashboard tidak membangun ulang kartu saat data tidak berubah (3 detik)', async () => {
    await tab(page, 'dash');
    await waitFor(page, () => document.querySelectorAll('.pc-card-item').length > 0, {
      label: 'kartu PC dashboard',
    });
    const result = await page.evaluate(() => new Promise((resolve) => {
      const area = document.getElementById('pc-area');
      const cards = Array.from(document.querySelectorAll('.pc-card-item'));
      cards.forEach((card) => { card.__e2eMark = 'sentinel'; });
      let removed = 0;
      let added = 0;
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          removed += mutation.removedNodes.length;
          added += mutation.addedNodes.length;
        }
      });
      observer.observe(area, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        const after = Array.from(document.querySelectorAll('.pc-card-item'));
        const intact = cards.every((card, idx) => after[idx] === card && card.isConnected && card.__e2eMark === 'sentinel');
        resolve({ removed, added, intact, before: cards.length, after: after.length });
      }, 3000);
    }));
    if (!result.intact || result.before !== result.after) {
      throw new Error(`kartu PC dibangun ulang (${result.before} -> ${result.after}, identitas bertahan: ${result.intact})`);
    }
    if (result.removed || result.added) {
      throw new Error(`ADA ${result.removed} node dihapus dan ${result.added} node ditambah padahal data tidak berubah`);
    }
  });

  await check(report, 'tabel monitor tidak dirender ulang saat fingerprint data sama (3 detik)', async () => {
    await tab(page, 'monitor');
    await waitFor(page, () => {
      const el = document.getElementById('monitor-table');
      return !!el && el.innerHTML.trim().length > 0;
    }, { label: 'tabel monitor terisi' });
    const result = await page.evaluate(() => new Promise((resolve) => {
      const el = document.getElementById('monitor-table');
      const before = el.innerHTML;
      let removed = 0;
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) removed += mutation.removedNodes.length;
      });
      observer.observe(el, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve({ same: el.innerHTML === before, removed });
      }, 3000);
    }));
    if (!result.same || result.removed) {
      throw new Error(`tabel monitor dirender ulang tanpa perubahan data (identik: ${result.same}, node dihapus: ${result.removed})`);
    }
  });

  // ------------------------------------- E. polling saat tab tersembunyi
  await check(report, 'polling dashboard tertahan saat tab tersembunyi lalu pulih', async () => {
    await tab(page, 'dash');
    await page.evaluate(() => {
      if (window.__e2eFetchLog) return;
      const log = [];
      const state = { active: 0, max: 0 };
      window.__e2eFetchLog = log;
      window.__e2eFetchState = state;
      const original = window.fetch;
      window.fetch = function (input, init) {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        const entry = { url, t: Date.now(), done: false };
        log.push(entry);
        state.active += 1;
        if (state.active > state.max) state.max = state.active;
        const promise = original.apply(this, arguments);
        const finishEntry = () => { entry.done = true; state.active -= 1; };
        if (promise && typeof promise.then === 'function') promise.then(finishEntry, finishEntry);
        return promise;
      };
    });

    const countDashboard = (ms) => page.evaluate((windowMs) => new Promise((resolve) => {
      const start = window.__e2eFetchLog.length;
      setTimeout(() => {
        const entries = window.__e2eFetchLog.slice(start);
        resolve(entries.filter((entry) => entry.url.includes('/api/v1/kasir/dashboard/pc')).length);
      }, windowMs);
    }), ms);

    const visibleCount = await countDashboard(2000);

    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const hiddenCount = await countDashboard(2000);

    await page.evaluate(() => {
      delete document.hidden;
      delete document.visibilityState;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const resumedCount = await countDashboard(2500);

    if (visibleCount < 1) throw new Error(`tidak ada polling saat tab terlihat (${visibleCount} request/2 detik)`);
    if (hiddenCount !== 0) throw new Error(`${hiddenCount} request tetap dikirim dalam 2 detik pertama saat tab tersembunyi`);
    if (resumedCount < 1) throw new Error('polling tidak pulih setelah tab kembali terlihat');
  });

  // -------------------------------------------- F. guard overlap & badai tab
  await check(report, 'Dashboard._loading mencegah dua request dashboard tumpang tindih', async () => {
    await tab(page, 'dash');
    await page.evaluate(() => App.startDashboardPolling(60000)); // jauhkan timer dari pengukuran
    try {
      // Tunggu sampai tidak ada load yang masih berjalan: kalau `_loading` masih
      // true, kedua panggilan di bawah akan sama-sama short-circuit dan check
      // gagal karena alasan yang salah (flaky).
      await waitFor(page, () => typeof Dashboard !== 'undefined' && Dashboard._loading === false, {
        label: 'Dashboard selesai memuat',
      });
      const result = await page.evaluate(async () => {
        window.__e2eFetchState.max = window.__e2eFetchState.active;
        const start = window.__e2eFetchLog.length;
        const first = Dashboard.load(true);
        const second = Dashboard.load(true);
        await Promise.all([first, second]);
        await new Promise((resolve) => setTimeout(resolve, 250));
        const requests = window.__e2eFetchLog
          .slice(start)
          .filter((entry) => entry.url.includes('/api/v1/kasir/dashboard/pc')).length;
        return { requests, maxConcurrent: window.__e2eFetchState.max };
      });
      if (result.requests !== 1) {
        throw new Error(`dua pemanggilan Dashboard.load menghasilkan ${result.requests} request (harus 1)`);
      }
      if (result.maxConcurrent > 1) {
        throw new Error(`${result.maxConcurrent} request dashboard berjalan bersamaan`);
      }
    } finally {
      await page.evaluate(() => App.startDashboardPolling());
    }
  });

  await check(report, 'perpindahan tab cepat tidak memicu badai request dashboard', async () => {
    await page.evaluate(() => App.startDashboardPolling(60000));
    try {
      const result = await page.evaluate(async () => {
        const start = window.__e2eFetchLog.length;
        for (let i = 0; i < 10; i++) {
          App.switchTab('pc');
          App.switchTab('dash');
          await new Promise((resolve) => setTimeout(resolve, 60));
        }
        await new Promise((resolve) => setTimeout(resolve, 400));
        const requests = window.__e2eFetchLog
          .slice(start)
          .filter((entry) => entry.url.includes('/api/v1/kasir/dashboard/pc')).length;
        return { requests };
      });
      if (result.requests > 20) {
        throw new Error(`${result.requests} request dashboard untuk 10 perpindahan (batas 2 per perpindahan)`);
      }
      if (result.requests < 1) throw new Error('tidak ada request dashboard sama sekali saat tab kembali dibuka');
    } finally {
      await page.evaluate(() => App.startDashboardPolling());
    }
  });

  await check(report, 'tidak ada pageerror selama audit performa kasir', () => {
    if (pageErrors.length) throw new Error(`${pageErrors.length} pageerror: ${pageErrors.slice(0, 3).join(' | ')}`);
  });

  // ------------------------------------------------ G. matriks reflow responsif
  const responsive = await runResponsiveBreakpointsTest(page, { baseUrl: BASE_URL });
  await check(report, `reflow responsif bersih di ${responsive.totalChecks} sel (40 tampilan × 6 breakpoint)`, () => {
    if (responsive.totalChecks !== 240) {
      throw new Error(`matriks hanya ${responsive.totalChecks} sel, seharusnya 240`);
    }
    if (responsive.failed) {
      const detail = responsive.failures.slice(0, 3).map((failure) => {
        const offenders = (failure.offenders || []).map((item) => `${item.tag}${item.id ? '#' + item.id : ''}@${item.right}px`).join(' ');
        return `${failure.target} @${failure.breakpoint} (scrollWidth ${failure.scrollWidth} > ${failure.breakpoint ? failure.width : '?'}${offenders ? '; ' + offenders : ''})`;
      });
      throw new Error(`${responsive.failed} sel overflow: ${detail.join(' | ')}`);
    }
  });

  return finish(report);
}

module.exports = { runPerfInvariantsE2ETest };
