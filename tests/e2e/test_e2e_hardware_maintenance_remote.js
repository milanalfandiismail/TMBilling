/**
 * E2E Test Suite: Hardware Anti-Maling, Maintenance, Uptime, Screenshot & Remote Tools
 * Target: http://127.0.0.1:7016 (Sandbox Isolated Server)
 * 
 * Cakupan:
 * 1. Autentikasi Admin
 * 2. Tab Monitor: Telemetri PC, Sensor & Action Queue
 * 3. Tab Hardware Checker: Baseline Hardware Anti-Maling & Audit Komponen
 * 4. Tab Uptime Tracker: Pelacakan Detik Online & Billing Meja PC
 * 5. Tab Screenshot: Galeri Tangkapan Layar & Trigger Snapshot
 * 6. Tab Maintenance: CRUD Tiket Servis, Prioritas Kerusakan & Status Lifecycle
 * 7. Tab Laporan Maintenance: Agregasi Riwayat Pemeliharaan Hardware
 * 8. Tab File Explorer: Remote Web Disk Explorer & Root Whitelist
 * 9. Tab Server Statistic: Telemetri Performa Host Server (CPU, RAM, Disk)
 * 10. Tab Remote Server: Interface TightVNC RFB Remote Control
 */

async function runHardwareMaintenanceRemoteE2ETest(page) {
    const report = {
        suite: "E2E: Hardware, Maintenance & Remote Tools",
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
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: "networkidle" });

        const isDashboard = page.url().includes('/kasir/');
        record("Login Admin untuk Monitoring & Hardware", isDashboard);

        // Pastikan shift aktif tersedia (agar @shift_required terpenuhi)
        await page.evaluate(async () => {
            try {
                const s = await API.shift.active();
                if (!s || !s.active) {
                    await API.shift.start({ modal_awal: 50000 });
                }
            } catch(e) {}
        });

        // 2. Tab Monitor PC (tab-monitor)
        await page.evaluate(async () => {
            if (window.App && App.switchTab) await App.switchTab('monitor');
        });
        await page.waitForTimeout(600);

        const monitorTabCheck = await page.evaluate(async () => {
            const tab = document.getElementById('tab-monitor');
            const isActive = tab && !tab.classList.contains('hidden');
            const hasModule = typeof window.Monitor !== 'undefined';
            return { isActive, hasModule };
        });
        record("Navigasi ke Tab Monitor PC (tab-monitor)", monitorTabCheck.isActive && monitorTabCheck.hasModule);

        // Verifikasi Query Sensor Telemetri Monitor
        const monitorDataCheck = await page.evaluate(async () => {
            try {
                const res = await API.monitor.all();
                return { success: !!(res && (res.success || res.status === 'success')), hasData: Array.isArray(res.data) };
            } catch (err) {
                return { success: false, error: err.message };
            }
        });
        record("Telemetri Sensor PC Meja (CPU, GPU, RAM, Suhu)", monitorDataCheck.success);

        // 3. Tab Hardware Checker (tab-hardware_checker)
        await page.evaluate(async () => {
            if (window.App && App.switchTab) await App.switchTab('hardware_checker');
        });
        await page.waitForTimeout(600);

        const hwCheckerTabCheck = await page.evaluate(async () => {
            const tab = document.getElementById('tab-hardware_checker');
            const isActive = tab && !tab.classList.contains('hidden');
            const hasModule = typeof window.HardwareChecker !== 'undefined';
            return { isActive, hasModule };
        });
        record("Navigasi ke Tab Hardware Checker (tab-hardware_checker)", hwCheckerTabCheck.isActive && hwCheckerTabCheck.hasModule);

        // Registrasi / Update Baseline Hardware Anti-Maling PC-01
        const baselineCheck = await page.evaluate(async () => {
            try {
                const res = await API.request('/api/v1/kasir/monitor/register/1', { method: 'POST' });
                return { success: !!(res && (res.success || res.status === 'success')) };
            } catch (err) {
                return { success: false, error: err.message };
            }
        });
        record("Pembaruan Baseline Komponen Anti-Maling PC-01", baselineCheck.success);

        // 4. Tab Uptime Tracker (tab-uptime)
        await page.evaluate(async () => {
            if (window.App && App.switchTab) await App.switchTab('uptime');
        });
        await page.waitForTimeout(600);

        const uptimeTabCheck = await page.evaluate(async () => {
            const tab = document.getElementById('tab-uptime');
            const isActive = tab && !tab.classList.contains('hidden');
            const hasModule = typeof window.UptimeTracker !== 'undefined';
            return { isActive, hasModule };
        });
        record("Navigasi ke Tab Uptime Tracker (tab-uptime)", uptimeTabCheck.isActive && uptimeTabCheck.hasModule);

        // Verifikasi Query Log Akumulasi Uptime
        const uptimeDataCheck = await page.evaluate(async () => {
            try {
                const res = await API.uptime.daily();
                return { success: !!(res && (res.success || res.status === 'success')) };
            } catch (err) {
                return { success: false, error: err.message };
            }
        });
        record("Query Log Akumulasi Detik Online & Billing Uptime", uptimeDataCheck.success);

        // 5. Tab Screenshot Monitor (tab-screenshot)
        await page.evaluate(async () => {
            if (window.App && App.switchTab) await App.switchTab('screenshot');
        });
        await page.waitForTimeout(600);

        const screenshotTabCheck = await page.evaluate(async () => {
            const tab = document.getElementById('tab-screenshot');
            const isActive = tab && !tab.classList.contains('hidden');
            const hasModule = typeof window.Screenshot !== 'undefined';
            return { isActive, hasModule };
        });
        record("Navigasi ke Tab Screenshot Monitor (tab-screenshot)", screenshotTabCheck.isActive && screenshotTabCheck.hasModule);

        // Verifikasi Query Data Screenshot Gallery
        const screenshotDataCheck = await page.evaluate(async () => {
            try {
                const res = await API.request('/api/v1/kasir/monitor/screenshot/all');
                return { success: !!(res && (res.success || res.status === 'success')), isArray: Array.isArray(res.data) };
            } catch (err) {
                return { success: false, error: err.message };
            }
        });
        record("Query Galeri Screenshot Real-time PC Klien", screenshotDataCheck.success);

        // 6. Tab Tiket Maintenance (tab-maintenance)
        await page.evaluate(async () => {
            if (window.App && App.switchTab) await App.switchTab('maintenance');
        });
        await page.waitForTimeout(600);

        const maintenanceTabCheck = await page.evaluate(async () => {
            const tab = document.getElementById('tab-maintenance');
            const isActive = tab && !tab.classList.contains('hidden');
            const hasModule = typeof window.Maintenance !== 'undefined';
            return { isActive, hasModule };
        });
        record("Navigasi ke Tab Tiket Servis Maintenance (tab-maintenance)", maintenanceTabCheck.isActive && maintenanceTabCheck.hasModule);

        // Buat Tiket Servis Baru (Kategori HARDWARE, Prioritas SEDANG)
        let createdTicketId = null;
        const createTicketRes = await page.evaluate(async () => {
            try {
                const res = await API.request('/api/v1/kasir/maintenance/create', {
                    method: 'POST',
                    body: JSON.stringify({
                        pc_id: 1,
                        kategori: 'HARDWARE',
                        prioritas: 'SEDANG',
                        judul: 'Keyboard Tombol W Macet',
                        deskripsi: 'Switch mechanical keyboard perlu dibersihkan atau diganti'
                    })
                });
                const item = res.data || res.ticket || res;
                return { success: !!(res && (res.success || res.status === 'success')), id: item ? item.id : null, data: res };
            } catch (err) {
                return { success: false, error: err.message };
            }
        });

        if (createTicketRes.success && createTicketRes.id) {
            createdTicketId = createTicketRes.id;
        }
        record("Pembuatan Tiket Servis Kerusakan Hardware (PC-01)", createTicketRes.success && !!createdTicketId);

        // Update Status Tiket Servis (DIPROSES)
        let updateTicketSuccess = false;
        if (createdTicketId) {
            const updateStatusRes = await page.evaluate(async (tId) => {
                try {
                    const res = await API.request(`/api/v1/kasir/maintenance/${tId}/status`, {
                        method: 'PUT',
                        body: JSON.stringify({
                            status: 'DIPROSES',
                            resolusi: 'Sedang diperiksa oleh teknisi'
                        })
                    });
                    return { success: !!(res && (res.success || res.status === 'success')) };
                } catch (err) {
                    return { success: false, error: err.message };
                }
            }, createdTicketId);
            updateTicketSuccess = updateStatusRes.success;
        }
        record("Pembaruan Status Siklus Tiket Maintenance (In Progress)", updateTicketSuccess);

        // 7. Tab Laporan Maintenance (tab-laporan_maintenance)
        await page.evaluate(async () => {
            if (window.App && App.switchTab) await App.switchTab('laporan_maintenance');
        });
        await page.waitForTimeout(600);

        const laporanMaintTabCheck = await page.evaluate(async () => {
            const tab = document.getElementById('tab-laporan_maintenance');
            const isActive = tab && !tab.classList.contains('hidden');
            const hasModule = typeof window.LaporanMaintenance !== 'undefined';
            return { isActive, hasModule };
        });
        record("Navigasi ke Tab Laporan Riwayat Maintenance (tab-laporan_maintenance)", laporanMaintTabCheck.isActive && laporanMaintTabCheck.hasModule);

        // Query Daftar Riwayat Tiket Maintenance
        const listTicketsCheck = await page.evaluate(async () => {
            try {
                const res = await API.request('/api/v1/kasir/maintenance/list');
                const tickets = res.tickets || res.data || [];
                return { success: !!(res && (res.success || res.status === 'success')), hasTickets: tickets.length > 0 };
            } catch (err) {
                return { success: false, error: err.message };
            }
        });
        record("Agregasi Log Riwayat Tiket Pemeliharaan Hardware", listTicketsCheck.success && listTicketsCheck.hasTickets);

        // 8. Tab File Explorer Web Disk (tab-fileexplorer)
        await page.evaluate(async () => {
            if (window.App && App.switchTab) await App.switchTab('fileexplorer');
        });
        await page.waitForTimeout(600);

        const fileExplorerTabCheck = await page.evaluate(async () => {
            const tab = document.getElementById('tab-fileexplorer');
            const isActive = tab && !tab.classList.contains('hidden');
            const hasModule = typeof window.FileExplorer !== 'undefined';
            return { isActive, hasModule };
        });
        record("Navigasi ke Tab File Explorer Web Disk (tab-fileexplorer)", fileExplorerTabCheck.isActive && fileExplorerTabCheck.hasModule);

        // Verifikasi Query Roots Direktori Terdaftar
        const fileRootsCheck = await page.evaluate(async () => {
            try {
                const res = await API.fileexplorer.getRoots();
                return { success: !!(res && (res.success || res.roots !== undefined)) };
            } catch (err) {
                return { success: false, error: err.message };
            }
        });
        record("Validasi Keamanan Path & Query Roots Remote File Explorer", fileRootsCheck.success);

        // 9. Tab Server Statistic (tab-server_statistic)
        await page.evaluate(async () => {
            if (window.App && App.switchTab) await App.switchTab('server_statistic');
        });
        await page.waitForTimeout(600);

        const serverStatTabCheck = await page.evaluate(async () => {
            const tab = document.getElementById('tab-server_statistic');
            const isActive = tab && !tab.classList.contains('hidden');
            const hasModule = typeof window.ServerMonitor !== 'undefined';
            return { isActive, hasModule };
        });
        record("Navigasi ke Tab Server Statistic (tab-server_statistic)", serverStatTabCheck.isActive && serverStatTabCheck.hasModule);

        // Query Telemetri Server Host
        const serverDataCheck = await page.evaluate(async () => {
            try {
                const res = await API.request('/api/v1/kasir/server-monitor');
                return { success: !!(res && (res.data || res.success)) };
            } catch (err) {
                return { success: false, error: err.message };
            }
        });
        record("Telemetri Metrik Host Server (CPU, RAM, Disk)", serverDataCheck.success);

        // 10. Tab Remote Server TightVNC (tab-remote_server)
        await page.evaluate(async () => {
            if (window.App && App.switchTab) await App.switchTab('remote_server');
        });
        await page.waitForTimeout(600);

        const remoteServerTabCheck = await page.evaluate(async () => {
            const tab = document.getElementById('tab-remote_server');
            const isActive = tab && !tab.classList.contains('hidden');
            const hasVncBtn = !!document.getElementById('vnc-connect-btn');
            return { isActive, hasVncBtn };
        });
        record("Navigasi ke Tab Remote Server TightVNC RFB (tab-remote_server)", remoteServerTabCheck.isActive && remoteServerTabCheck.hasVncBtn);

    } catch (err) {
        record("Global Execution Error", false, err.message);
    }

    report.endTime = new Date().toISOString();
    return report;
}

if (typeof module !== 'undefined') {
    module.exports = { runHardwareMaintenanceRemoteE2ETest };
}
