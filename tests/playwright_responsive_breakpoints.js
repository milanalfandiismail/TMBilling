/**
 * Playwright Multi-Breakpoint Verification Test for TMBilling
 * Memverifikasi ketiadaan horizontal overflow (scrollWidth <= innerWidth)
 * di seluruh 31 Tab Kasir + 1 Iframe SPA + 8 Portal Publik pada 6 breakpoint resmi Tailwind CSS.
 * Total: 40 Tampilan × 6 Breakpoint = 240 Checks.
 */

(() => {
async function runResponsiveBreakpointsTest(page) {
    const breakpoints = [
        { name: 'Mobile', width: 390, height: 844 },
        { name: 'sm', width: 640, height: 800 },
        { name: 'md', width: 768, height: 1024 },
        { name: 'lg', width: 1024, height: 768 },
        { name: 'xl', width: 1280, height: 800 },
        { name: '2xl', width: 1536, height: 900 }
    ];

    const kasirTabs = [
        'dash', 'blackout', 'pc', 'paket', 'member', 'grup',
        'laporan', 'laporan_menu', 'struk', 'menu', 'menu_stock_log',
        'tournament', 'laporan_maintenance', 'shift_history', 'catatan',
        'analytics', 'uptime', 'monitor', 'hardware_checker', 'screenshot',
        'fileexplorer', 'game', 'remote_server', 'maintenance',
        'user', 'user_logs', 'log', 'mikrotik', 'settings',
        'server_statistic', 'plugins', 'plugin-spa'
    ];

    const publicPortals = [
        '/', '/tv', '/tv/static', '/livepc',
        '/member/login', '/games', '/paket', '/spesifikasi'
    ];

    const results = {
        totalViews: kasirTabs.length + publicPortals.length,
        totalBreakpoints: breakpoints.length,
        totalChecks: (kasirTabs.length + publicPortals.length) * breakpoints.length,
        passed: 0,
        failed: 0,
        failures: []
    };

    const BASE_URL = 'http://127.0.0.1:7016';

    // 1. Audit 32 Tampilan Kasir
    if (!page.url().includes('/kasir/')) {
        await page.goto(`${BASE_URL}/kasir/login`, { waitUntil: 'networkidle' });
        await page.fill('#username', 'admin');
        await page.fill('#password', 'admin123');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
            page.click('button[type="submit"]')
        ]);
        await page.waitForTimeout(500);
    }

    console.log(`Auditing ${kasirTabs.length} Kasir Tabs across ${breakpoints.length} Breakpoints...`);
    for (const tab of kasirTabs) {
        await page.evaluate((t) => {
            if (typeof App !== 'undefined' && App.switchTab) {
                App.switchTab(t);
            }
        }, tab);
        await page.waitForTimeout(50);

        for (const bp of breakpoints) {
            await page.setViewportSize({ width: bp.width, height: bp.height });
            await page.waitForTimeout(30);

            const check = await page.evaluate(() => {
                return {
                    scrollWidth: document.documentElement.scrollWidth,
                    innerWidth: window.innerWidth,
                    hasOverflow: document.documentElement.scrollWidth > window.innerWidth
                };
            });

            if (!check.hasOverflow) {
                results.passed++;
            } else {
                results.failed++;
                results.failures.push({
                    target: `Tab: ${tab}`,
                    breakpoint: bp.name,
                    width: bp.width,
                    scrollWidth: check.scrollWidth,
                    diff: check.scrollWidth - bp.width
                });
            }
        }
    }

    // 2. Audit 8 Portal Publik
    console.log(`Auditing ${publicPortals.length} Public Portals across ${breakpoints.length} Breakpoints...`);
    for (const route of publicPortals) {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
        for (const bp of breakpoints) {
            await page.setViewportSize({ width: bp.width, height: bp.height });
            await page.waitForTimeout(30);

            const check = await page.evaluate(() => {
                return {
                    scrollWidth: document.documentElement.scrollWidth,
                    innerWidth: window.innerWidth,
                    hasOverflow: document.documentElement.scrollWidth > window.innerWidth
                };
            });

            if (!check.hasOverflow) {
                results.passed++;
            } else {
                results.failed++;
                results.failures.push({
                    target: `Public: ${route}`,
                    breakpoint: bp.name,
                    width: bp.width,
                    scrollWidth: check.scrollWidth,
                    diff: check.scrollWidth - bp.width
                });
            }
        }
    }

    console.log(`Responsive Audit Complete: ${results.passed}/${results.totalChecks} PASSED, ${results.failed} FAILED`);
    return results;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runResponsiveBreakpointsTest };
}
return runResponsiveBreakpointsTest;
})()
