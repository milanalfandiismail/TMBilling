/**
 * Playwright Multi-Breakpoint Verification Test for TMBilling
 * Memverifikasi ketiadaan horizontal overflow (scrollWidth <= innerWidth)
 * di seluruh 32 Tab Kasir pada 6 breakpoint standar Tailwind CSS.
 */
module.exports = async (page) => {
    const breakpoints = [
        { name: 'Mobile', width: 390, height: 844 },
        { name: 'sm', width: 640, height: 800 },
        { name: 'md', width: 768, height: 1024 },
        { name: 'lg', width: 1024, height: 768 },
        { name: 'xl', width: 1280, height: 800 },
        { name: '2xl', width: 1536, height: 900 }
    ];

    const all29Tabs = [
        'dash', 'blackout', 'pc', 'paket', 'member', 'grup',
        'laporan', 'laporan_menu', 'struk', 'menu', 'menu_stock_log',
        'tournament', 'laporan_maintenance', 'shift_history', 'catatan',
        'analytics', 'uptime', 'monitor', 'hardware_checker', 'screenshot',
        'fileexplorer', 'game_management', 'remote_server', 'maintenance',
        'user', 'user_logs',
        'log', 'mikrotik', 'settings'
    ];

    const results = {
        totalTabs: all29Tabs.length,
        totalBreakpoints: breakpoints.length,
        totalChecks: all29Tabs.length * breakpoints.length,
        passed: 0,
        failed: 0,
        failures: []
    };

    if (!page.url().includes('/kasir/')) {
        await page.goto('http://127.0.0.1:7015/kasir/');
        await page.waitForTimeout(500);
    }

    for (const tab of all29Tabs) {
        // Switch tab
        await page.evaluate((t) => {
            if (typeof App !== 'undefined' && App.switchTab) {
                App.switchTab(t);
            }
        }, tab);
        await page.waitForTimeout(100);

        for (const bp of breakpoints) {
            await page.setViewportSize({ width: bp.width, height: bp.height });
            await page.waitForTimeout(50);

            const check = await page.evaluate(() => {
                return {
                    scrollWidth: document.documentElement.scrollWidth,
                    innerWidth: window.innerWidth,
                    bodyScrollWidth: document.body.scrollWidth,
                    hasOverflow: document.documentElement.scrollWidth > window.innerWidth
                };
            });

            if (!check.hasOverflow) {
                results.passed++;
            } else {
                results.failed++;
                results.failures.push({
                    tab,
                    breakpoint: bp.name,
                    width: bp.width,
                    scrollWidth: check.scrollWidth,
                    diff: check.scrollWidth - bp.width
                });
            }
        }
    }

    return results;
};

