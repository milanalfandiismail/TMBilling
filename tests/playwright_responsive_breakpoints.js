/**
 * Playwright Multi-Breakpoint Verification Test for TMBilling
 * Memverifikasi ketiadaan horizontal overflow (scrollWidth <= innerWidth)
 * di seluruh 32 Tab Kasir + 8 Portal Publik pada 6 breakpoint resmi Tailwind CSS.
 * Total: 40 Tampilan × 6 Breakpoint = 240 Checks.
 *
 * Dipakai dua cara:
 *   1. Suite E2E: `require('../playwright_responsive_breakpoints.js')` lalu
 *      `runResponsiveBreakpointsTest(page)`.
 *   2. MCP Playwright: `browser_run_code_unsafe` mengeksekusi berkas ini apa adanya.
 * Karena itu `require` manifest bersifat opsional (ada daftar cadangan) dan
 * `baseUrl` bisa dioper lewat opsi.
 *
 * Catatan kontrak E2E: tidak memakai `page.waitForTimeout`, semua tunggu <= 5 s,
 * dan cookie dibersihkan di antara portal publik supaya sesi satu portal tidak
 * bocor ke portal berikutnya.
 */

(() => {
    let manifest = null;
    try {
        manifest = require('./e2e/lib/coverage_manifest');
    } catch (err) {
        manifest = null;
    }

    // Cadangan bila manifest tidak bisa dimuat (mis. dijalankan dari MCP Playwright).
    const FALLBACK_TABS = [
        'dash', 'pc', 'blackout', 'member', 'paket', 'grup',
        'menu', 'menu_stock_log', 'laporan_menu', 'struk',
        'monitor', 'hardware_checker', 'uptime', 'screenshot', 'maintenance',
        'laporan_maintenance', 'remote_server',
        'tournament', 'game_management',
        'settings', 'user', 'user_logs', 'log', 'laporan', 'analytics',
        'mikrotik', 'plugins', 'server_statistic', 'fileexplorer', 'plugin-spa',
        'catatan', 'shift_history'
    ];
    const FALLBACK_PORTALS = ['/', '/tv', '/tv/static', '/livepc', '/member/login', '/games', '/paket', '/spesifikasi'];

    const BREAKPOINTS = [
        { name: 'Mobile', width: 390, height: 844 },
        { name: 'sm', width: 640, height: 800 },
        { name: 'md', width: 768, height: 1024 },
        { name: 'lg', width: 1024, height: 768 },
        { name: 'xl', width: 1280, height: 800 },
        { name: '2xl', width: 1536, height: 900 }
    ];

    const DEFAULT_BASE_URL = 'http://127.0.0.1:7016';
    const LOGIN_TIMEOUT_MS = 5000;

    /** Tunggu dua frame: cukup untuk media query + reflow sebelum diukur. */
    async function settle(page) {
        await page.evaluate(() => new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)));
        }));
    }

    /**
     * Ukur overflow dokumen. `offenders` hanya diisi saat overflow terdeteksi,
     * berisi elemen yang tepinya melewati lebar viewport (untuk laporan kegagalan).
     */
    async function measure(page) {
        return page.evaluate(() => {
            const limit = window.innerWidth;
            const scrollWidth = document.documentElement.scrollWidth;
            const offenders = [];
            if (scrollWidth > limit) {
                const all = document.documentElement.querySelectorAll('*');
                for (const el of all) {
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 && rect.height === 0) continue;
                    if (rect.right > limit + 1) {
                        offenders.push({
                            tag: el.tagName.toLowerCase(),
                            id: el.id || null,
                            cls: typeof el.className === 'string' ? el.className.slice(0, 100) : null,
                            left: Math.round(rect.left),
                            right: Math.round(rect.right),
                            width: Math.round(rect.width)
                        });
                        if (offenders.length >= 5) break;
                    }
                }
            }
            return { scrollWidth, innerWidth: limit, hasOverflow: scrollWidth > limit, offenders };
        });
    }

    /** Pastikan sesi kasir aktif tanpa memaksa login ulang bila sudah di dashboard. */
    async function ensureKasir(page, baseUrl) {
        if (page.url().includes('/kasir')) {
            const ready = await page.evaluate(() => !!document.getElementById('tab-dash'));
            if (ready) return;
        }
        await page.context().clearCookies();
        await page.goto(`${baseUrl}/kasir/login`, { waitUntil: 'domcontentloaded' });
        await page.fill('#username', 'admin');
        await page.fill('#password', 'admin123');
        await page.click('#btn-login');
        await page.waitForURL(/\/kasir\/?$/, { timeout: LOGIN_TIMEOUT_MS });
        await page.waitForSelector('#tab-dash', { state: 'visible', timeout: LOGIN_TIMEOUT_MS });
    }

    async function runResponsiveBreakpointsTest(page, options = {}) {
        const baseUrl = options.baseUrl || DEFAULT_BASE_URL;
        const startedAt = Date.now();

        const kasirTabs = manifest ? Object.keys(manifest.tabs) : FALLBACK_TABS;
        const publicPortals = manifest
            ? manifest.portals.map((portal) => portal.path)
            : FALLBACK_PORTALS;
        const portalRoots = manifest
            ? manifest.portals.reduce((acc, portal) => { acc[portal.path] = portal.root; return acc; }, {})
            : {};

        const results = {
            totalViews: kasirTabs.length + publicPortals.length,
            totalBreakpoints: BREAKPOINTS.length,
            totalChecks: (kasirTabs.length + publicPortals.length) * BREAKPOINTS.length,
            passed: 0,
            failed: 0,
            failures: [],
            durationMs: 0
        };

        const tally = async (target) => {
            for (const bp of BREAKPOINTS) {
                await page.setViewportSize({ width: bp.width, height: bp.height });
                await settle(page);
                const check = await measure(page);
                if (!check.hasOverflow) {
                    results.passed++;
                } else {
                    results.failed++;
                    results.failures.push({
                        target,
                        breakpoint: bp.name,
                        width: bp.width,
                        scrollWidth: check.scrollWidth,
                        diff: check.scrollWidth - bp.width,
                        offenders: check.offenders
                    });
                }
            }
        };

        // 1. Audit 32 tampilan kasir
        await ensureKasir(page, baseUrl);
        for (const id of kasirTabs) {
            await page.evaluate((target) => App.switchTab(target), id);
            await page.waitForSelector(
                id === 'plugin-spa' ? '#tab-plugin-spa:not(.hidden)' : `#tab-${id}:not(.hidden)`,
                { timeout: 5000 }
            );
            await settle(page);
            await tally(`Tab: ${id}`);
        }

        // 2. Audit 8 portal publik (state direset per portal)
        for (const path of publicPortals) {
            await page.context().clearCookies();
            await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
            const root = portalRoots[path];
            if (root) await page.waitForSelector(root, { state: 'attached', timeout: 5000 });
            await settle(page);
            await tally(`Public: ${path}`);
        }

        await page.setViewportSize({ width: 1440, height: 900 });
        results.durationMs = Date.now() - startedAt;
        return results;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { runResponsiveBreakpointsTest };
    }
    return runResponsiveBreakpointsTest;
})();
