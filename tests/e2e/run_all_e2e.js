/**
 * Master E2E Test Suite Runner for Playwright
 * 
 * Sequentially executes all 8 domain-specific E2E test suites:
 * 1. Auth, Shift (Blind Cash), Sticky Notes, and Shift History Audit
 * 2. PC Management, Floor Plan MapView, Billing Lifecycle (Prepaid, Tambah, Pindah, Tutup), Blackout
 * 3. Member Registration, Top-Up Saldo, Member PC Session, Paket Billing CRUD, Grup PC CRUD
 * 4. F&B POS Kantin, Cart Checkout, Restock Mutation, Stock Log Audit, Menu Reports, Receipt Struk
 * 5. Hardware Baseline Monitoring, Uptime Tracker, Screenshot, Maintenance Tickets, Remote Tools
 * 6. Esports Tournament Bracket Engine, Match Scoring, and Game Catalog CRUD
 * 7. 11 Settings Subtabs, RBAC Enforcement, Staff Management, Audit Log, Analytics, MikroTik, Plugins
 * 8. Public Portals (8 Routes) and Interactive CMS Documentation
 */

const { runAuthShiftNotesE2ETest } = require('./test_e2e_auth_shift_notes.js');
const { runPCBillingLifecycleE2ETest } = require('./test_e2e_pc_billing_lifecycle.js');
const { runMemberPaketE2ETest } = require('./test_e2e_member_paket.js');
const { runFnBPosStrukE2ETest } = require('./test_e2e_fnb_pos_struk.js');
const { runHardwareMaintenanceRemoteE2ETest } = require('./test_e2e_hardware_maintenance_remote.js');
const { runTournamentGameE2ETest } = require('./test_e2e_tournament_game.js');
const { runSettingsAdminLogsE2ETest } = require('./test_e2e_settings_admin_logs.js');
const { runPublicPortalsCMSE2ETest } = require('./test_e2e_public_portals_cms.js');
const { runResponsiveBreakpointsTest } = require('../playwright_responsive_breakpoints.js');

async function runAllE2ESuites(page) {
    const summary = {
        startTime: new Date().toISOString(),
        totalSuites: 8,
        passedSuites: 0,
        failedSuites: 0,
        totalTests: 0,
        passed: 0,
        failed: 0,
        suiteResults: []
    };

    const suites = [
        { name: 'Suite 1: Auth, Shift, Notes & Shift History', runner: runAuthShiftNotesE2ETest },
        { name: 'Suite 2: PC Meja, MapView, Billing Lifecycle & Blackout', runner: runPCBillingLifecycleE2ETest },
        { name: 'Suite 3: Member, Paket Billing & Grup PC', runner: runMemberPaketE2ETest },
        { name: 'Suite 4: Kantin F&B POS, Stok, Struk & Laporan Menu', runner: runFnBPosStrukE2ETest },
        { name: 'Suite 5: Hardware Checker, Uptime, Maintenance & Remote Tools', runner: runHardwareMaintenanceRemoteE2ETest },
        { name: 'Suite 6: Esports Tournament Bracket & Game Catalog', runner: runTournamentGameE2ETest },
        { name: 'Suite 7: 11 Settings Subtabs, RBAC, User Management & Audit Logs', runner: runSettingsAdminLogsE2ETest },
        { name: 'Suite 8: Public Portals & CMS Documentation', runner: runPublicPortalsCMSE2ETest }
    ];

    console.log(`=======================================================`);
    console.log(`🚀 STARTING COMPREHENSIVE E2E TEST SUITE (8 SUITES)`);
    console.log(`=======================================================`);

    for (const suite of suites) {
        const tStart = Date.now();
        console.log(`\n▶ Running ${suite.name}...`);
        try {
            const res = await suite.runner(page);
            const durationMs = Date.now() - tStart;
            const isSuitePassed = res.failed === 0;

            if (isSuitePassed) {
                summary.passedSuites++;
            } else {
                summary.failedSuites++;
            }

            summary.totalTests += res.total;
            summary.passed += res.passed;
            summary.failed += res.failed;

            summary.suiteResults.push({
                suite: suite.name,
                passed: isSuitePassed,
                total: res.total,
                passedCount: res.passed,
                failedCount: res.failed,
                durationMs,
                results: res.results
            });

            console.log(`✔ Finished ${suite.name} in ${(durationMs / 1000).toFixed(2)}s: ${res.passed}/${res.total} tests passed.`);
        } catch (err) {
            const durationMs = Date.now() - tStart;
            summary.failedSuites++;
            summary.suiteResults.push({
                suite: suite.name,
                passed: false,
                total: 1,
                passedCount: 0,
                failedCount: 1,
                durationMs,
                error: err.message
            });
            console.error(`✖ Exception in ${suite.name}:`, err);
        }
    }

    console.log(`\n=======================================================`);
    console.log(`▶ Stage 2: Responsive Multi-Breakpoint Audit (40 Views × 6 Breakpoints)...`);
    console.log(`=======================================================`);
    try {
        const bpRes = await runResponsiveBreakpointsTest(page);
        summary.totalTests += bpRes.totalChecks;
        summary.passed += bpRes.passed;
        summary.failed += bpRes.failed;
        if (bpRes.failed === 0) {
            summary.passedSuites++;
        } else {
            summary.failedSuites++;
        }
        summary.totalSuites++;
        console.log(`✔ Finished Stage 2 Responsive Breakpoint Audit: ${bpRes.passed}/${bpRes.totalChecks} checks passed!`);
        if (bpRes.failed > 0) {
            console.error(`✖ Horizontal Overflow detected:`, bpRes.failures);
        }
    } catch(err) {
        console.error(`✖ Exception in Stage 2 Responsive Breakpoint Audit:`, err);
    }

    summary.endTime = new Date().toISOString();
    console.log(`\n=======================================================`);
    console.log(`🏁 COMPREHENSIVE E2E TEST RUN COMPLETE`);
    console.log(`Total Suites: ${summary.totalSuites} (${summary.passedSuites} Passed, ${summary.failedSuites} Failed)`);
    console.log(`Total Checks: ${summary.totalTests} (${summary.passed} Passed, ${summary.failed} Failed)`);
    console.log(`=======================================================`);

    return summary;
}

if (typeof module !== 'undefined') {
    module.exports = { runAllE2ESuites };
}
