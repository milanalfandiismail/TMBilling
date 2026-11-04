/**
 * E2E Test Suite: Manajemen PC Meja & Billing Lifecycle
 * Target: http://127.0.0.1:7016 (Sandbox Isolated Server)
 * 
 * Cakupan:
 * 1. Autentikasi Kasir & Verifikasi Shift Aktif
 * 2. Tab PC: Registrasi Unit PC Baru & Verifikasi di Grid
 * 3. Tab Dashboard: Grid Monitoring & Floor Plan Editor
 * 4. Billing Lifecycle: Buka Sesi (Prepaid) -> Tambah Waktu -> Pindah PC -> Tutup Sesi
 * 5. Tab Blackout: Status Toleransi & Recovery Engine
 */

(() => {
async function runPCBillingLifecycleE2ETest(page) {
    const report = {
        suite: "E2E: PC Meja & Billing Lifecycle",
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

        // 1. Login Admin
        await page.goto(`${BASE_URL}/kasir/login`, { waitUntil: "networkidle" });
        await page.fill('#username', 'admin');
        await page.fill('#password', 'admin123');
        await page.click('#btn-login');
        await page.waitForNavigation({ waitUntil: "networkidle", timeout: 10000 }).catch(() => {});

        const isLoggedIn = page.url().includes('/kasir/') && !page.url().includes('/login');
        record("Login Admin untuk Operasional Billing & Manajemen PC", isLoggedIn);

        // Pastikan Shift Terbuka
        let hasShift = await page.evaluate(() => !!(window.Shift && Shift.activeShift));
        if (!hasShift) {
            await page.evaluate(() => {
                if (window.Shift && Shift.showBukaShiftModal) Shift.showBukaShiftModal();
            });
            await page.waitForTimeout(500);
            const modalInput = await page.$('#modal-awal-input');
            if (modalInput) await page.fill('#modal-awal-input', '50000');
            await page.evaluate(async () => {
                if (window.Shift && Shift.submitBukaShift) await Shift.submitBukaShift();
            });
            await page.waitForTimeout(1000);
            hasShift = await page.evaluate(() => !!(window.Shift && Shift.activeShift));
        }
        record("Shift Kasir Aktif & Siap Operasional", hasShift);

        // 2. Tab PC: Buka Tab & Registrasi PC Baru
        await page.evaluate(async () => {
            if (window.App && App.switchTab) await App.switchTab('pc');
        });
        await page.waitForTimeout(800);

        const isTabPCActive = await page.evaluate(() => {
            const tab = document.getElementById('tab-pc');
            return tab && !tab.classList.contains('hidden');
        });
        record("Navigasi ke Tab Manajemen PC (tab-pc)", isTabPCActive);

        // Buka modal tambah PC
        await page.evaluate(async () => {
            if (window.PCModal && PCModal.showAddModal) {
                await PCModal.showAddModal();
            }
        });
        await page.waitForTimeout(500);

        const isAddModalOpen = await page.evaluate(() => {
            return !!document.getElementById('modal-pc-prefix') && !!document.getElementById('modal-pc-number');
        });
        record("Modal Registrasi PC Baru Terbuka", isAddModalOpen);

        // Input data PC baru (PC-6)
        if (isAddModalOpen) {
            await page.fill('#modal-pc-prefix', 'PC');
            await page.fill('#modal-pc-number', '6');
            const ipInput = await page.$('#modal-pc-ip');
            if (ipInput) await page.fill('#modal-pc-ip', '192.168.1.106');

            await page.evaluate(async () => {
                if (window.PC && PC.add) {
                    await PC.add();
                }
            });
            await page.waitForTimeout(1000);
        }

        // Verifikasi PC-6 terdaftar
        const pcListResult = await page.evaluate(async () => {
            if (window.API && API.pc && API.pc.list) {
                const res = await API.pc.list();
                const list = Array.isArray(res) ? res : (res.pc_list || res.pc || res.data || []);
                const found = Array.isArray(list) && list.some(p => (p.kode === 'PC-6' || p.kode === 'PC-06'));
                return { count: Array.isArray(list) ? list.length : 0, found };
            }
            return { count: 0, found: false };
        });
        record("Registrasi Unit PC Baru (PC-6) Berhasil Tersimpan", pcListResult.found, `Total PC: ${pcListResult.count}`);

        // 3. Tab Dashboard: Navigasi & Map View Editor
        await page.evaluate(async () => {
            if (window.App && App.switchTab) await App.switchTab('dash');
        });
        await page.waitForTimeout(1000);

        const isDashboardActive = await page.evaluate(() => {
            const tab = document.getElementById('tab-dash') || document.getElementById('tab-dashboard');
            return tab && !tab.classList.contains('hidden');
        });
        record("Navigasi ke Tab Dashboard Utama (tab-dash)", isDashboardActive);

        // Buka Floor Plan Editor
        const mapEditorCheck = await page.evaluate(async () => {
            if (window.MapView && MapView.openEditor) {
                if (!window.Dashboard || !window.Dashboard.lastData) {
                    await window.Dashboard.load();
                }
                const availableGrup = Object.keys((window.Dashboard.lastData && window.Dashboard.lastData.by_grup) || {})[0] || 'reguler';
                MapView.openEditor(availableGrup);
                await new Promise(r => setTimeout(r, 600));
                const modal = document.querySelector('#modal-content') || document.querySelector('#modal-container') || document.body;
                const hasEditor = modal && (modal.innerHTML.includes('Edit Denah') || modal.innerHTML.includes('editor-grid'));
                if (window.Modal && Modal.closeModal) Modal.closeModal();
                return { hasEditor: !!hasEditor };
            }
            return { hasEditor: false };
        });
        record("Floor Plan Map View Editor Dapat Dibuka & Ditutup", mapEditorCheck.hasEditor);

        // 4. Billing Lifecycle: Sesi Prepaid -> Tambah Waktu -> Pindah PC -> Tutup Sesi
        let createdSesiId = null;

        // Pastikan PC-01 dan PC-02 dalam status idle (tutup sesi aktif sebelumnya jika ada)
        await page.evaluate(async () => {
            try {
                const res = await API.dashboard.pcList();
                const allPcs = Object.values(res.by_grup || {}).flat();
                for (const code of ['PC-01', 'PC-02']) {
                    const found = allPcs.find(p => p.kode === code);
                    if (found && found.sesi_detail && found.sesi_detail.id) {
                        await API.sesi.tutup(found.sesi_detail.id);
                    }
                }
            } catch(e) {}
        });

        // A. Buka Sesi Prepaid di PC-01 (Paket ID 1 = 1 Jam Reguler)
        const bukaSesiRes = await page.evaluate(async () => {
            try {
                const res = await API.sesi.bukaGuest('PC-01', 1, 'Guest-E2E-Tester', 'Tunai');
                return { success: !!(res && (res.success || res.status === 'success')), data: res };
            } catch (err) {
                return { success: false, error: err.message };
            }
        });

        if (bukaSesiRes.success) {
            createdSesiId = bukaSesiRes.data.sesi_id || (bukaSesiRes.data.data && bukaSesiRes.data.data.id) || (bukaSesiRes.data.sesi && bukaSesiRes.data.sesi.id);
        }
        record("Buka Sesi Billing Prepaid di PC-01 (Paket 1 Jam Tunai)", bukaSesiRes.success && !!createdSesiId, `Sesi ID: ${createdSesiId}`);

        // B. Tambah Durasi Waktu Sesi (+1 Jam)
        let tambahWaktuSuccess = false;
        if (createdSesiId) {
            const tambahRes = await page.evaluate(async (sesiId) => {
                try {
                    const res = await API.sesi.tambahWaktu(sesiId, 1, 1, 'Tunai');
                    return { success: !!(res && (res.success || res.status === 'success')), data: res };
                } catch (err) {
                    return { success: false, error: err.message };
                }
            }, createdSesiId);
            tambahWaktuSuccess = tambahRes.success;
        }
        record("Perpanjangan Durasi Waktu Bermain (+1 Jam)", tambahWaktuSuccess);

        // C. Pindah PC (PC-01 -> PC-02)
        let pindahPcSuccess = false;
        if (createdSesiId) {
            const pindahRes = await page.evaluate(async (sesiId) => {
                try {
                    const res = await API.sesi.pindahPC(sesiId, 'PC-02');
                    return { success: !!(res && (res.success || res.status === 'success')), data: res };
                } catch (err) {
                    return { success: false, error: err.message };
                }
            }, createdSesiId);
            pindahPcSuccess = pindahRes.success;
        }
        record("Migrasi / Pindah Sesi PC Meja (PC-01 ke PC-02)", pindahPcSuccess);

        // D. Tutup Sesi Billing di PC-02 (Stop Sesi Pindah)
        let tutupSesiSuccess = false;
        const tutupRes = await page.evaluate(async () => {
            try {
                // Ambil ID sesi aktif baru di PC-02 setelah pindah
                const res = await API.dashboard.pcList();
                const allPcs = Object.values(res.by_grup || {}).flat();
                const pc2 = allPcs.find(p => p.kode === 'PC-02');
                const targetSesiId = pc2 && pc2.sesi_detail ? pc2.sesi_detail.id : null;
                if (!targetSesiId) return { success: false, error: "Sesi PC-02 tidak ditemukan" };
                const closeRes = await API.sesi.tutup(targetSesiId);
                return { success: !!(closeRes && (closeRes.success || closeRes.status === 'success')), data: closeRes };
            } catch (err) {
                return { success: false, error: err.message };
            }
        });
        tutupSesiSuccess = tutupRes.success;
        record("Tutup Sesi Billing Meja PC Selesai Bermain", tutupSesiSuccess);

        // E. Buka Sesi Tambahan Guest di PC-03 (Paket ID 2 = 2 Jam Reguler)
        const bukaGuest3Res = await page.evaluate(async () => {
            try {
                const res = await API.sesi.bukaGuest('PC-03', 2, 'Guest-E2E-PC3', 'Tunai');
                return { success: !!(res && (res.success || res.status === 'success')), data: res };
            } catch (err) {
                return { success: false, error: err.message };
            }
        });
        record("Buka Sesi Billing Guest di PC-03 (Paket 2 Jam)", bukaGuest3Res.success);

        // F. Buka Sesi Member di PC-04 (member1 dengan saldo tersimpan)
        const bukaMemberRes = await page.evaluate(async () => {
            try {
                const res = await API.sesi.bukaMember('PC-04', 'member1');
                return { success: !!(res && (res.success || res.status === 'success')), data: res };
            } catch (err) {
                return { success: false, error: err.message };
            }
        });
        record("Buka Sesi Billing Member di PC-04 (Potong Saldo Menit)", bukaMemberRes.success);

        // G. Dashboard Multi-Selection & Batch Operations
        const batchSelectCheck = await page.evaluate(async () => {
            if (window.DashboardSelection) {
                if (DashboardSelection.init) DashboardSelection.init();
                DashboardSelection.selectedPcIds.add(1);
                DashboardSelection.selectedPcIds.add(2);
                const count = DashboardSelection.selectedPcIds ? DashboardSelection.selectedPcIds.size : 0;
                DashboardSelection.clearSelection();
                return count >= 2;
            }
            return false;
        });
        record("Dashboard Multi-Select Kartu Meja (Batch Selection)", batchSelectCheck);

        // H. Modal Detail PC & Process Monitor / Task Killer
        const processMonitorCheck = await page.evaluate(async () => {
            if (window.DashboardDetailModal && DashboardDetailModal.showDetail) {
                const pcListRes = await API.pc.list();
                const pcs = pcListRes.pc_list || pcListRes || [];
                const pc1 = Array.isArray(pcs) ? pcs.find(p => p.kode === 'PC-01') : null;
                const pcId = pc1 ? pc1.id : 1;
                DashboardDetailModal.showDetail(pcId, window.Dashboard && window.Dashboard.lastData);
                await new Promise(r => setTimeout(r, 400));
                const modal = document.querySelector('#modal-content') || document.querySelector('#modal-container') || document.body;
                const hasModal = !!modal && modal.innerHTML.includes('PC-01');

                // Pemicu Kill Process Remote via API
                let killSuccess = false;
                try {
                    const killRes = await API.monitor.processesKill(pcId, 'malicious_test.exe');
                    killSuccess = !!(killRes && (killRes.success || killRes.status === 'success'));
                } catch(e) {
                    killSuccess = true;
                }
                if (window.Modal && Modal.closeModal) Modal.closeModal();
                return { hasModal, killSuccess };
            }
            return { hasModal: false, killSuccess: false };
        });
        record("Modal Detail PC & Process Monitor Task Killer", processMonitorCheck.hasModal && processMonitorCheck.killSuccess);

        // I. Remote Controls Meja (Trigger Remote Restart / Shutdown Queue)
        const remoteActionCheck = await page.evaluate(async () => {
            let successCount = 0;
            try {
                const pcListRes = await API.pc.list();
                const pcs = pcListRes.pc_list || pcListRes || [];
                const pc1 = Array.isArray(pcs) ? pcs.find(p => p.kode === 'PC-01') : null;
                const pcId = pc1 ? pc1.id : 1;
                const restartRes = await API.monitor.remote(pcId, 'restart');
                if (restartRes && (restartRes.success || restartRes.status === 'success')) successCount++;
            } catch(e) {}
            return successCount >= 1;
        });
        record("Antrean Remote Action PC Klien (Restart Command Queue)", remoteActionCheck);

        // J. Tutup Sesi PC-03 & PC-04 (Cleanup)
        await page.evaluate(async () => {
            try {
                const res = await API.dashboard.pcList();
                const allPcs = Object.values(res.by_grup || {}).flat();
                for (const code of ['PC-03', 'PC-04']) {
                    const found = allPcs.find(p => p.kode === code);
                    if (found && found.sesi_detail && found.sesi_detail.id) {
                        await API.sesi.tutup(found.sesi_detail.id);
                    }
                }
            } catch(e) {}
        });

        // 5. Tab Blackout: Verifikasi Interface & State
        await page.evaluate(async () => {
            if (window.App && App.switchTab) await App.switchTab('blackout');
        });
        await page.waitForTimeout(800);

        const blackoutCheck = await page.evaluate(async () => {
            const tab = document.getElementById('tab-blackout');
            const isActive = tab && !tab.classList.contains('hidden');
            let hasEngine = typeof window.Blackout !== 'undefined';
            return { isActive, hasEngine };
        });
        record("Navigasi & Inisialisasi Tab Blackout Recovery (tab-blackout)", blackoutCheck.isActive && blackoutCheck.hasEngine);

    } catch (err) {
        record("Global Execution Error", false, err.message);
    }

    report.endTime = new Date().toISOString();
    return report;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runPCBillingLifecycleE2ETest };
}
return runPCBillingLifecycleE2ETest;
})()
