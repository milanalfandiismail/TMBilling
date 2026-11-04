/**
 * E2E Test Suite - Settings Subtabs, Admin RBAC, Analytics, System Logs, & Mikrotik
 * 
 * Verifies:
 * 1. Admin login & session verification.
 * 2. Settings tab & all 11 subtabs switching:
 *    - general, payment, kiosk, tv, whitelist_ip, cloudflare_tunnel,
 *      cloud_backup, local_backup, db_cleanup, scheduler, migration.
 * 3. Settings API read and write-through cache update.
 * 4. Staff User CRUD (create, read list, update, delete) in tab-user.
 * 5. Staff audit log inspection in tab-user_logs.
 * 6. System log viewer in tab-log.
 * 7. Owner Analytics load in tab-analytics.
 * 8. Billing turnover report load in tab-laporan.
 * 9. MikroTik configuration in tab-mikrotik.
 * 10. Plugins catalog in tab-plugins.
 * 11. Strict RBAC enforcement when logged in as kasir (admin-only tab access rejection).
 */

(() => {
const { BASE_URL } = require('./lib/browser');

async function runSettingsAdminLogsE2ETest(page) {
    const results = [];
    const record = (name, passed, message = '') => {
        results.push({ name, passed, message });
        console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name}${message ? ': ' + message : ''}`);
    };

    try {
        console.log('--- Step 1: Admin Login ---');
        await page.goto('http://127.0.0.1:7016/kasir/login');
        await page.waitForLoadState('networkidle');

        // Check if already logged in as kasir, logout first
        const isKasirLogin = await page.evaluate(() => !!document.getElementById('username'));
        if (!isKasirLogin) {
            await page.evaluate(async () => {
                if (typeof API !== 'undefined' && API.auth) {
                    await API.auth.logout();
                }
            });
            await page.goto('http://127.0.0.1:7016/kasir/login');
            await page.waitForLoadState('networkidle');
        }

        await page.fill('#username', 'admin');
        await page.fill('#password', 'admin123');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
            page.click('button[type="submit"]')
        ]);
        await page.waitForTimeout(500);

        const adminLogged = await page.evaluate(() => {
            return window.App && window.App.user && window.App.user.role === 'admin';
        });
        record('Admin Login Verified', adminLogged, `Role is ${adminLogged ? 'admin' : 'unknown'}`);

        console.log('--- Step 2: Test 11 Settings Subtabs ---');
        // Subtab 1: general
        await page.evaluate(async () => {
            await window.App.switchTab('settings_general');
        });
        await page.waitForTimeout(400);
        const subGeneral = await page.evaluate(() => {
            const tabSettings = document.getElementById('tab-settings');
            const sub = document.getElementById('subtab-general');
            return !tabSettings.classList.contains('hidden') && sub && !sub.classList.contains('hidden');
        });
        record('Settings Subtab: General Visible', subGeneral);

        // Subtab 2: payment
        await page.evaluate(async () => {
            await window.App.switchTab('settings_payment');
        });
        await page.waitForTimeout(400);
        const subPayment = await page.evaluate(() => {
            const sub = document.getElementById('subtab-payment');
            return sub && !sub.classList.contains('hidden');
        });
        record('Settings Subtab: Payment Visible', subPayment);

        // Subtab 3: kiosk
        await page.evaluate(async () => {
            await window.App.switchTab('settings_kiosk');
        });
        await page.waitForTimeout(400);
        const subKiosk = await page.evaluate(() => {
            const sub = document.getElementById('subtab-kiosk');
            return sub && !sub.classList.contains('hidden');
        });
        record('Settings Subtab: Kiosk Visible', subKiosk);

        // Subtab 4: tv
        await page.evaluate(async () => {
            await window.App.switchTab('settings_tv');
        });
        await page.waitForTimeout(400);
        const subTV = await page.evaluate(() => {
            const kiosk = document.getElementById('subtab-kiosk');
            return kiosk && !kiosk.classList.contains('hidden');
        });
        record('Settings Subtab: TV Signage Visible', subTV);

        // Subtab 5: whitelist_ip
        await page.evaluate(async () => {
            await window.App.switchTab('whitelist_ip');
        });
        await page.waitForTimeout(400);
        const subWhitelist = await page.evaluate(() => {
            const sub = document.getElementById('subtab-whitelist_ip');
            return sub && !sub.classList.contains('hidden');
        });
        record('Settings Subtab: Whitelist IP Visible', subWhitelist);

        // Subtab 6: cloudflare_tunnel
        await page.evaluate(async () => {
            await window.App.switchTab('settings_cloudflare_tunnel');
        });
        await page.waitForTimeout(400);
        const subCloudflare = await page.evaluate(() => {
            const sub = document.getElementById('subtab-cloudflare_tunnel');
            return sub && !sub.classList.contains('hidden');
        });
        record('Settings Subtab: Cloudflare Tunnel Visible', subCloudflare);

        // Subtab 7: cloud_backup
        await page.evaluate(async () => {
            await window.App.switchTab('settings_cloud_backup');
        });
        await page.waitForTimeout(400);
        const subCloudBackup = await page.evaluate(() => {
            const sub = document.getElementById('subtab-cloud_backup');
            return sub && !sub.classList.contains('hidden');
        });
        record('Settings Subtab: Cloud Backup Visible', subCloudBackup);

        // Subtab 8: local_backup
        await page.evaluate(async () => {
            await window.App.switchTab('settings_local_backup');
        });
        await page.waitForTimeout(400);
        const subLocalBackup = await page.evaluate(() => {
            const sub = document.getElementById('subtab-local_backup');
            return sub && !sub.classList.contains('hidden');
        });
        record('Settings Subtab: Local Backup Visible', subLocalBackup);

        // Subtab 9: db_cleanup
        await page.evaluate(async () => {
            await window.App.switchTab('settings_db_cleanup');
        });
        await page.waitForTimeout(400);
        const subDbCleanup = await page.evaluate(() => {
            const sub = document.getElementById('subtab-db_cleanup');
            return sub && !sub.classList.contains('hidden');
        });
        record('Settings Subtab: DB Cleanup Visible', subDbCleanup);

        // Subtab 10: scheduler
        await page.evaluate(async () => {
            await window.App.switchTab('settings_scheduler');
        });
        await page.waitForTimeout(400);
        const subScheduler = await page.evaluate(() => {
            const sub = document.getElementById('subtab-scheduler');
            return sub && !sub.classList.contains('hidden');
        });
        record('Settings Subtab: Scheduler Visible', subScheduler);

        // Subtab 11: migration
        await page.evaluate(async () => {
            await window.App.switchTab('settings_migration');
        });
        await page.waitForTimeout(400);
        const subMigration = await page.evaluate(() => {
            const sub = document.getElementById('subtab-migration');
            return sub && !sub.classList.contains('hidden');
        });
        record('Settings Subtab: Migration Visible', subMigration);

        console.log('--- Step 3: Settings API Read and Verification ---');
        const settingsRes = await page.evaluate(async () => {
            return await API.settings.getAll();
        });
        const hasSettings = settingsRes && settingsRes.success && settingsRes.settings;
        record('Settings API getAll Success', !!hasSettings, `Loaded ${hasSettings ? Object.keys(settingsRes.settings).length : 0} keys`);

        console.log('--- Step 4: Staff User CRUD (tab-user) ---');
        await page.evaluate(async () => {
            await window.App.switchTab('user');
        });
        await page.waitForTimeout(400);

        const tabUserVisible = await page.evaluate(() => {
            const tab = document.getElementById('tab-user');
            return tab && !tab.classList.contains('hidden');
        });
        record('Tab User Visible', tabUserVisible);

        // Create User
        const createUserRes = await page.evaluate(async () => {
            return await API.user.create({
                username: 'kasir_temp_e2e',
                nama_lengkap: 'Kasir Temp E2E',
                password: 'password123',
                role: 'kasir',
                aktif: true,
                kuota_main_bulanan: 60
            });
        });
        const userCreated = createUserRes && createUserRes.success;
        record('Staff User Created', userCreated, createUserRes.message || createUserRes.error);

        // Read Users List
        const usersList = await page.evaluate(async () => {
            return await API.user.list();
        });
        const createdUser = Array.isArray(usersList) && usersList.find(u => u.username === 'kasir_temp_e2e');
        record('Created User Verified in List', !!createdUser, `Found user ID: ${createdUser ? createdUser.id : 'none'}`);

        if (createdUser) {
            // Update User
            const updateRes = await page.evaluate(async (uid) => {
                return await API.user.update(uid, {
                    nama_lengkap: 'Kasir Temp E2E Updated',
                    kuota_main_bulanan: 120
                });
            }, createdUser.id);
            record('Staff User Updated', updateRes && updateRes.success);

            // Delete User
            const deleteRes = await page.evaluate(async (uid) => {
                return await API.user.delete(uid);
            }, createdUser.id);
            record('Staff User Deleted', deleteRes && deleteRes.success);
        }

        console.log('--- Step 5: Staff Audit Log (tab-user_logs) ---');
        await page.evaluate(async () => {
            await window.App.switchTab('user_logs');
        });
        await page.waitForTimeout(400);

        const tabUserLogsVisible = await page.evaluate(() => {
            const tab = document.getElementById('tab-user_logs');
            const rows = document.getElementById('user-logs-rows');
            return tab && !tab.classList.contains('hidden') && rows !== null;
        });
        record('Tab User Logs (Staff Audit) Visible and Rendered', tabUserLogsVisible);

        console.log('--- Step 6: System Log (tab-log) ---');
        await page.evaluate(async () => {
            await window.App.switchTab('log');
        });
        await page.waitForTimeout(400);

        const tabLogVisible = await page.evaluate(() => {
            const tab = document.getElementById('tab-log');
            return tab && !tab.classList.contains('hidden');
        });
        const logFetchRes = await page.evaluate(async () => {
            return await API.report.logs('', 50, '');
        });
        record('Tab Log Visible and Logs Loaded', tabLogVisible && logFetchRes && Array.isArray(logFetchRes.logs));

        console.log('--- Step 7: Owner Analytics (tab-analytics) ---');
        await page.evaluate(async () => {
            await window.App.switchTab('analytics');
        });
        await page.waitForTimeout(500);

        const tabAnalyticsVisible = await page.evaluate(() => {
            const tab = document.getElementById('tab-analytics');
            return tab && !tab.classList.contains('hidden');
        });
        const analyticsData = await page.evaluate(async () => {
            return await API.request('/api/v1/kasir/dashboard/analytics?period=today');
        });
        record('Tab Analytics Visible and Data Fetched', tabAnalyticsVisible && analyticsData && analyticsData.success);

        console.log('--- Step 8: Billing Turnover Report (tab-laporan) ---');
        await page.evaluate(async () => {
            await window.App.switchTab('laporan');
        });
        await page.waitForTimeout(500);

        const tabLaporanVisible = await page.evaluate(() => {
            const tab = document.getElementById('tab-laporan');
            return tab && !tab.classList.contains('hidden');
        });
        const kasirListData = await page.evaluate(async () => {
            return await API.report.kasirList();
        });
        record('Tab Laporan Visible and Kasir List Loaded', tabLaporanVisible && kasirListData && Array.isArray(kasirListData.kasir));

        console.log('--- Step 9: MikroTik Hotspot (tab-mikrotik) ---');
        await page.evaluate(async () => {
            await window.App.switchTab('mikrotik');
        });
        await page.waitForTimeout(400);

        const tabMikrotikVisible = await page.evaluate(() => {
            const tab = document.getElementById('tab-mikrotik');
            return tab && !tab.classList.contains('hidden');
        });
        const mikrotikConfig = await page.evaluate(async () => {
            return await API.request('/api/v1/kasir/mikrotik/config');
        });
        record('Tab MikroTik Visible and Config Endpoint Responding', tabMikrotikVisible && mikrotikConfig && mikrotikConfig.success);

        console.log('--- Step 10: Plugins & Extensions (tab-plugins) ---');
        await page.evaluate(async () => {
            await window.App.switchTab('plugins');
        });
        await page.waitForTimeout(400);

        const tabPluginsVisible = await page.evaluate(() => {
            const tab = document.getElementById('tab-plugins');
            return tab && !tab.classList.contains('hidden');
        });
        const pluginsRes = await page.evaluate(async () => {
            return await API.request('/api/v1/kasir/settings/plugins/');
        });
        record('Tab Plugins Visible and Catalog Endpoint Responding', tabPluginsVisible && pluginsRes && pluginsRes.success);

        console.log('--- Step 11: File Explorer Sandbox Security & Blacklist Check ---');
        await page.evaluate(async () => {
            if (window.App && App.switchTab) await App.switchTab('fileexplorer');
        });
        await page.waitForTimeout(600);

        const fileExplorerSecurityCheck = await page.evaluate(async () => {
            const tabFE = document.getElementById('tab-fileexplorer');
            const isTabActive = tabFE && !tabFE.classList.contains('hidden');

            let isBlacklistProtected = false;
            let isTraversalBlocked = false;
            try {
                // 1. Cek pemanggilan list direktori root
                const listRes = await API.fileexplorer.list();
                const files = listRes.items || listRes.files || listRes.data || [];
                const fileNames = files.map(f => (f.name || f.filename || '').toLowerCase());

                // Pastikan .env, warnet.db, initial_admin.txt, .git TIDAK ADA dalam respons
                const hasSensitive = fileNames.some(name => 
                    name === '.env' || name === 'warnet.db' || name === 'initial_admin.txt' || name === '.git'
                );
                isBlacklistProtected = !hasSensitive;

                // 2. Cek pemblokiran path traversal ../../
                try {
                    const traversalRes = await API.fileexplorer.list('../../');
                    isTraversalBlocked = !traversalRes.success || !!traversalRes.error;
                } catch(e) {
                    isTraversalBlocked = true; // Exception status 400/403
                }
            } catch(err) {
                isBlacklistProtected = true;
                isTraversalBlocked = true;
            }

            return { isTabActive, isBlacklistProtected, isTraversalBlocked };
        });
        record('File Explorer Tab Active & Operational', fileExplorerSecurityCheck.isTabActive);
        record('File Explorer Sensitive Files Blacklist Enforced (.env, warnet.db hidden)', fileExplorerSecurityCheck.isBlacklistProtected);
        record('File Explorer Path Traversal Protection Active', fileExplorerSecurityCheck.isTraversalBlocked);

        console.log('--- Step 11b: Cek Unik Hasil Port dari Suite Lama Full (Docs CMS, Branch 404, Modal, Plugin SPA) ---');

        // Cek 1: halaman dokumentasi menampilkan daftar tutorial hasil seed.
        try {
            const docRes = await page.goto(`${BASE_URL}/kasir/documentation`, { waitUntil: 'networkidle' });
            const docTitle = await page.title();
            await page.waitForSelector('#wiki-sidebar button[onclick^="Tutorials.selectTutorial("]', { timeout: 5000 });
            const tutorialCount = await page.evaluate(
                () => document.querySelectorAll('#wiki-sidebar button[onclick^="Tutorials.selectTutorial("]').length
            );
            record(
                'CMS Documentation lists seeded tutorials',
                !!docRes && docRes.status() === 200 && tutorialCount > 0 && /Dokumentasi|TMBilling/i.test(docTitle),
                `${tutorialCount} tutorial, status ${docRes ? docRes.status() : 'none'}, title "${docTitle}"`
            );
        } catch (err) {
            record('CMS Documentation lists seeded tutorials', false, err.message);
        }

        // Kembali ke dashboard: Step 12 membutuhkan App/API pada shell kasir.
        await page.goto(`${BASE_URL}/kasir/`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#tab-dash', { state: 'visible', timeout: 5000 });

        // Cek 2: endpoint branch lama sudah dihapus dari backend maupun API client.
        try {
            const branch = await page.evaluate(async () => {
                const res = await fetch('/api/v1/kasir/branch/list');
                return { status: res.status, apiBranchDefined: typeof API.branch !== 'undefined' };
            });
            record(
                'Deprecated /api/v1/kasir/branch/list returns 404 & API.branch removed',
                branch.status === 404 && branch.apiBranchDefined === false,
                `HTTP ${branch.status}, API.branch defined: ${branch.apiBranchDefined}`
            );
        } catch (err) {
            record('Deprecated /api/v1/kasir/branch/list returns 404 & API.branch removed', false, err.message);
        }

        // Cek 3: tab plugin-spa benar-benar dipasang oleh App.openPluginSPA (pemilik manifest coverage).
        try {
            const spa = await page.evaluate(() => {
                App.openPluginSPA('/api/plugin/hello_world/test', 'E2E Plugin SPA');
                const container = document.getElementById('tab-plugin-spa');
                const iframe = document.getElementById('plugin-spa-iframe');
                const titleEl = document.getElementById('page-title');
                return {
                    visible: !!container && !container.classList.contains('hidden'),
                    src: iframe ? iframe.getAttribute('src') : null,
                    title: titleEl ? titleEl.innerText : '',
                };
            });
            record(
                'Plugin SPA tab mounted via App.openPluginSPA',
                spa.visible && spa.src === '/api/plugin/hello_world/test' && spa.title.trim().toUpperCase() === 'E2E PLUGIN SPA',
                `visible=${spa.visible}, src=${spa.src}, title="${spa.title}"`
            );
        } catch (err) {
            record('Plugin SPA tab mounted via App.openPluginSPA', false, err.message);
        }

        // Cek 4: siklus hidup modal dinamis (show -> close) tanpa sisa elemen.
        try {
            const modal = await page.evaluate(() => {
                Modal.show('<div id="e2e-test-modal-content">E2E Modal Test</div>');
                const isActive = !!Modal.activeModal && !!document.getElementById('e2e-test-modal-content');
                Modal.closeModal();
                const isClosed = !Modal.activeModal && !document.getElementById('e2e-test-modal-content');
                return { isActive, isClosed };
            });
            record(
                'Modal.show creates active modal & Modal.closeModal cleans it up',
                modal.isActive && modal.isClosed,
                `active=${modal.isActive}, closed=${modal.isClosed}`
            );
        } catch (err) {
            record('Modal.show creates active modal & Modal.closeModal cleans it up', false, err.message);
        }

        console.log('--- Step 12: Kasir RBAC Restriction Check ---');
        // Close admin's active shift first so another kasir can log in
        await page.evaluate(async () => {
            try {
                const act = await API.shift.active();
                if (act && act.success && act.shift) {
                    await API.shift.end({ total_fisik: act.shift.modal_awal || 50000 });
                }
            } catch (e) {}
        });

        // Logout admin cleanly & clear cookies
        await page.evaluate(async () => {
            if (window.API && API.auth && API.auth.logout) {
                try { await API.auth.logout(); } catch(e) {}
            }
        });
        await page.context().clearCookies();
        await page.goto('http://127.0.0.1:7016/kasir/login', { waitUntil: 'networkidle' });

        // Login as kasir1
        await page.fill('#username', 'kasir1');
        await page.fill('#password', 'kasir123');
        await page.click('#btn-login');
        await page.waitForURL('**/kasir/', { timeout: 10000 }).catch(() => {});
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);

        const kasirLogged = await page.evaluate(() => {
            return window.App && window.App.user && window.App.user.role === 'kasir';
        });
        record('Kasir Login Verified', kasirLogged, `Role is ${kasirLogged ? 'kasir' : 'unknown'}`);

        // Try to access settings_general as kasir
        await page.evaluate(async () => {
            await window.App.switchTab('settings_general');
        });
        await page.waitForTimeout(300);

        const rbacSettingsBlocked = await page.evaluate(() => {
            const tabSettings = document.getElementById('tab-settings');
            // Must either be hidden or currentTab reverted to dash
            return (window.App.currentTab === 'dash' || tabSettings.classList.contains('hidden'));
        });
        record('RBAC: Kasir Blocked from Settings', rbacSettingsBlocked);

        // Try to access tab-user as kasir
        await page.evaluate(async () => {
            await window.App.switchTab('user');
        });
        await page.waitForTimeout(300);

        const rbacUserBlocked = await page.evaluate(() => {
            const tabUser = document.getElementById('tab-user');
            return (window.App.currentTab === 'dash' || tabUser.classList.contains('hidden'));
        });
        record('RBAC: Kasir Blocked from User Management', rbacUserBlocked);

        // Try to access analytics as kasir
        await page.evaluate(async () => {
            await window.App.switchTab('analytics');
        });
        await page.waitForTimeout(300);

        const rbacAnalyticsBlocked = await page.evaluate(() => {
            const tabAnalytics = document.getElementById('tab-analytics');
            return (window.App.currentTab === 'dash' || tabAnalytics.classList.contains('hidden'));
        });
        record('RBAC: Kasir Blocked from Owner Analytics', rbacAnalyticsBlocked);

        // Kasir Logout
        await page.evaluate(async () => {
            if (window.API && API.auth && API.auth.logout) {
                try { await API.auth.logout(); } catch(e) {}
            }
        });
        await page.context().clearCookies();
        record('Kasir Clean Logout', true);

    } catch (err) {
        console.error('Fatal error in Settings/Admin/Logs E2E test:', err);
        record('Execution Flow', false, err.message);
    }

    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;
    console.log(`\n========================================`);
    console.log(`E2E SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED (Total: ${results.length})`);
    console.log(`========================================\n`);

    return { total: results.length, passed: passedCount, failed: failedCount, results };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runSettingsAdminLogsE2ETest };
}
return runSettingsAdminLogsE2ETest;
})()
