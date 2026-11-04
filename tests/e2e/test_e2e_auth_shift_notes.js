/**
 * E2E Test Suite: Autentikasi, Shift Kasir, & Sticky Notes
 * Target: http://127.0.0.1:7016 (Sandbox Isolated Server)
 */
(() => {
async function runAuthShiftNotesE2ETest(page) {
    const report = {
        suite: "E2E: Autentikasi, Shift Kasir, & Sticky Notes",
        startTime: new Date().toISOString(),
        totalTests: 0,
        passed: 0,
        failed: 0,
        errors: []
    };

    function record(name, isPass, detail = null) {
        report.totalTests++;
        if (isPass) {
            report.passed++;
            console.log(`[PASS] ${name}`);
        } else {
            report.failed++;
            report.errors.push(`${name}: ${detail || 'Failed'}`);
            console.error(`[FAIL] ${name}: ${detail}`);
        }
    }

    const BASE_URL = "http://127.0.0.1:7016";

    try {
        // 0. Reset Session / Pastikan Logout Terlebih Dahulu
        await page.goto(`${BASE_URL}/kasir/`, { waitUntil: "networkidle" });
        await page.evaluate(async () => {
            if (window.API && API.auth && API.auth.logout) {
                try { await API.auth.logout(); } catch(e) {}
            }
        });
        const context = page.context();
        await context.clearCookies();

        // 1. Login Page & Form
        await page.goto(`${BASE_URL}/kasir/login`, { waitUntil: "networkidle" });
        const hasLoginForm = await page.evaluate(() => {
            return !!document.getElementById('username') && !!document.getElementById('password') && !!document.getElementById('btn-login');
        });
        record("Tampilan Form Login Kasir", hasLoginForm);

        // 2. Do Login Kasir
        await page.fill('#username', 'kasir1');
        await page.fill('#password', 'kasir123');
        await page.click('#btn-login');
        await page.waitForNavigation({ waitUntil: "networkidle", timeout: 10000 }).catch(() => {});
        
        const currentUrl = page.url();
        const isLoggedIn = currentUrl.includes('/kasir/') && !currentUrl.includes('/login');
        record("Login Kasir 'kasir1' Berhasil", isLoggedIn, `URL: ${currentUrl}`);

        await page.waitForTimeout(1000);

        // 3. Buka Shift Kasir
        let hasActiveShift = await page.evaluate(() => !!(window.Shift && Shift.activeShift));
        if (!hasActiveShift) {
            await page.evaluate(() => {
                if (window.Shift && Shift.showBukaShiftModal) {
                    Shift.showBukaShiftModal();
                }
            });
            await page.waitForTimeout(500);

            const modalInput = await page.$('#modal-awal-input');
            if (modalInput) {
                await page.fill('#modal-awal-input', '50000');
            }
            await page.evaluate(async () => {
                if (window.Shift && Shift.submitBukaShift) {
                    await Shift.submitBukaShift();
                }
            });
            await page.waitForTimeout(1000);
            hasActiveShift = await page.evaluate(() => !!(window.Shift && Shift.activeShift));
        }
        record("Buka Shift Kasir dengan Modal Rp50.000", hasActiveShift);

        // 4. Navigasi Tab Catatan
        await page.evaluate(() => {
            if (window.App && App.switchTab) App.switchTab('catatan');
        });
        await page.waitForTimeout(600);
        const isTabCatatanActive = await page.evaluate(() => {
            const tab = document.getElementById('tab-catatan');
            return tab && !tab.classList.contains('hidden');
        });
        record("Navigasi ke Tab Catatan", isTabCatatanActive);

        // 5. Buat & Simpan Catatan Baru
        await page.evaluate(async () => {
            if (window.Catatan && Catatan.createNewNote) {
                await Catatan.createNewNote();
            }
        });
        await page.waitForTimeout(800);

        const noteTitleInput = await page.$('#note-title-input');
        if (noteTitleInput) {
            await page.fill('#note-title-input', 'Catatan Handover E2E');
        }
        const noteContentEditor = await page.$('#note-content-editor');
        if (noteContentEditor) {
            await page.fill('#note-content-editor', 'Shift pagi berjalan lancar tanpa kendala operasional.');
        }

        await page.evaluate(async () => {
            if (window.Catatan && Catatan.saveCurrentNote) {
                await Catatan.saveCurrentNote(true);
            }
        });
        await page.waitForTimeout(1000);

        const notesCount = await page.evaluate(() => {
            return (window.Catatan && Catatan.notes && Catatan.notes.length) || 0;
        });
        record("Buat & Simpan Sticky Notes Serah Terima", notesCount > 0, `Total Catatan: ${notesCount}`);

        // 6. Tutup Shift Kasir (Blind Cash Reconciliation)
        await page.evaluate(() => {
            if (window.Shift && Shift.showTutupShiftModal) {
                Shift.showTutupShiftModal();
            }
        });
        await page.waitForTimeout(600);

        const uangFisikInput = await page.$('#uang-fisik-input');
        if (uangFisikInput) {
            await page.fill('#uang-fisik-input', '50000');
        }
        const catatanShiftInput = await page.$('#catatan-shift-input');
        if (catatanShiftInput) {
            await page.fill('#catatan-shift-input', 'Tutup shift pagi normal selesai E2E test');
        }

        await page.evaluate(async () => {
            if (window.Shift && Shift.submitTutupShift) {
                await Shift.submitTutupShift();
            }
        });
        await page.waitForTimeout(1000);
        await page.evaluate(() => {
            if (window.Modal && Modal.closeModal) Modal.closeModal();
        });

        const isShiftClosed = await page.evaluate(() => !(window.Shift && Shift.activeShift));
        record("Tutup Shift Kasir (Blind Reconciliation Rp50.000)", isShiftClosed);

        // 7. Logout Kasir
        await page.evaluate(async () => {
            if (window.API && API.auth && API.auth.logout) {
                await API.auth.logout();
            }
        });
        await page.goto(`${BASE_URL}/kasir/login`, { waitUntil: "networkidle" });
        const isBackToLogin = page.url().includes('/kasir/login');
        record("Logout Kasir & Redirect ke Login Page", isBackToLogin);

        // 8. Login Admin & Verifikasi Riwayat Shift (RBAC Check)
        await page.fill('#username', 'admin');
        await page.fill('#password', 'admin123');
        await page.click('#btn-login');
        await page.waitForNavigation({ waitUntil: "networkidle", timeout: 10000 }).catch(() => {});

        await page.evaluate(async () => {
            if (window.App && App.switchTab) await App.switchTab('shift_history');
        });
        await page.waitForTimeout(1000);

        const historyDetail = await page.evaluate(async () => {
            if (window.Shift && Shift.loadHistory) {
                await Shift.loadHistory();
            }
            const rows = document.getElementById('shift-history-rows');
            return {
                exists: !!rows,
                count: rows ? rows.children.length : 0,
                html: rows ? rows.innerHTML : ''
            };
        });
        record("Admin Memverifikasi Riwayat Shift Kasir di Tab shift_history", historyDetail.exists && historyDetail.count > 0, `Rows: ${historyDetail.count}`);

    } catch (err) {
        record("Global Execution Error", false, err.message);
    }

    report.endTime = new Date().toISOString();
    return report;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runAuthShiftNotesE2ETest };
}
return runAuthShiftNotesE2ETest;
})()
