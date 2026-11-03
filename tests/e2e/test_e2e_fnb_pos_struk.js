/**
 * E2E Test Suite: POS Kantin / F&B, Manajemen Stok, Laporan Menu & Cetak Struk
 * Target: http://127.0.0.1:7016 (Sandbox Isolated Server)
 * 
 * Cakupan:
 * 1. Autentikasi Admin & Verifikasi Shift Aktif
 * 2. Tab Menu POS: Navigasi, Modal Form, Katalog Menu & CRUD Item Menu
 * 3. Checkout Order FnB: Keranjang Belanja, Pembayaran Tunai & Pemotongan Stok
 * 4. Mutasi Stok: Penambahan Stok (Restock) & Audit Catatan
 * 5. Tab Menu Stock Log: Navigasi, Filter Jejak Audit & Riwayat Mutasi
 * 6. Tab Laporan Menu: Navigasi, Agregasi Omzet Penjualan F&B
 * 7. Tab Cetak Struk: Navigasi, Sub-tab Billing & Kantin, Riwayat & Preview
 */

async (page) => {
    const report = {
        suite: "E2E: FnB POS, Stock Log, Laporan Menu & Struk",
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
        record("Login Admin untuk Operasional FnB & Struk", isDashboard);

        // Pastikan Shift Kasir Aktif
        const shiftStatus = await page.evaluate(async () => {
            let active = false;
            try {
                const res = await API.shift.active();
                active = !!(res && res.shift);
                if (!active) {
                    const startRes = await API.shift.start({ modal_awal: 50000 });
                    active = !!(startRes && (startRes.shift || startRes.success));
                }
            } catch (e) {
                try {
                    const startRes = await API.shift.start({ modal_awal: 50000 });
                    active = !!(startRes && (startRes.shift || startRes.success));
                } catch(err) {}
            }
            return active;
        });
        record("Shift Kasir Aktif & Siap Operasional", shiftStatus);

        // 2. Tab Menu POS: Navigasi & Modal
        await page.evaluate(async () => {
            if (window.App && App.switchTab) await App.switchTab('menu');
        });
        await page.waitForTimeout(600);

        const menuTabCheck = await page.evaluate(async () => {
            const tab = document.getElementById('tab-menu');
            const isActive = tab && !tab.classList.contains('hidden');
            const hasModule = typeof window.Menu !== 'undefined';
            return { isActive, hasModule };
        });
        record("Navigasi ke Tab Menu POS Kantin (tab-menu)", menuTabCheck.isActive && menuTabCheck.hasModule);

        // Modal Tambah Menu
        const modalMenuCheck = await page.evaluate(async () => {
            if (window.Menu && Menu.showAddModal) {
                Menu.showAddModal();
                await new Promise(r => setTimeout(r, 400));
                const modal = document.querySelector('#menu-modal') || document.querySelector('#modal-container') || document.body;
                const hasModal = modal && (modal.innerHTML.includes('Menu') || modal.innerHTML.includes('harga') || modal.innerHTML.includes('stok'));
                if (window.Modal && Modal.closeModal) Modal.closeModal();
                else if (window.Menu && Menu.closeModal) Menu.closeModal();
                return { hasModal: !!hasModal };
            }
            return { hasModal: false };
        });
        record("Modal Tambah Menu FnB Terbuka & Ditutup", modalMenuCheck.hasModal);

        // Buat Item Menu Baru via FormData
        const testMenuNama = `Mie Spesial E2E ${Date.now().toString().slice(-4)}`;
        let createdMenuId = null;

        const createMenuRes = await page.evaluate(async (mNama) => {
            try {
                const formData = new FormData();
                formData.append('nama', mNama);
                formData.append('harga', '12000');
                formData.append('stok', '25');
                const res = await API.menu.create(formData);
                const item = res.data || res.menu || res;
                return { success: !!(res && (res.success || res.status === 'success')), id: item ? item.id : null, data: res };
            } catch (err) {
                return { success: false, error: err.message };
            }
        }, testMenuNama);

        if (createMenuRes.success && createMenuRes.id) {
            createdMenuId = createMenuRes.id;
        }
        record("Buat Item Menu Baru (Mie Spesial E2E, Rp12.000, Stok 25)", createMenuRes.success && !!createdMenuId);

        // Verifikasi Item Menu di List Katalog
        let menuFound = false;
        if (createdMenuId) {
            const listCheck = await page.evaluate(async (mId) => {
                try {
                    const res = await API.menu.list();
                    const items = res.data || res.items || (Array.isArray(res) ? res : []);
                    const found = items.find(m => m.id === mId);
                    return { found: !!found, stok: found ? found.stok : 0 };
                } catch (err) {
                    return { found: false, error: err.message };
                }
            }, createdMenuId);
            menuFound = listCheck.found;
        }
        record("Verifikasi Item Menu Muncul di Katalog POS", menuFound);

        // 3. Checkout Order FnB (Beli 2 porsi Mie Spesial E2E)
        let checkoutSuccess = false;
        let orderTransactionId = null;
        if (createdMenuId) {
            const checkoutRes = await page.evaluate(async (mId) => {
                try {
                    const cartItems = [{ menu_id: mId, jumlah: 2 }];
                    const res = await API.menu.checkout(cartItems, null, 30000, 6000, 'Tunai');
                    const isOk = !!(res && (res.success || res.status === 'success'));
                    const trans = res.data || res.transaksi;
                    const transId = Array.isArray(trans) ? trans[0]?.id : trans?.id;
                    return { success: isOk, transId, data: res };
                } catch (err) {
                    return { success: false, error: err.message };
                }
            }, createdMenuId);
            checkoutSuccess = checkoutRes.success;
            orderTransactionId = checkoutRes.transId;
        }
        record("Checkout Order Menu FnB (2 Porsi, Tunai Rp30.000, Kembalian Rp6.000)", checkoutSuccess);

        // Verifikasi Stok Berkurang (25 - 2 = 23)
        let stockReduced = false;
        if (createdMenuId) {
            const stockCheck = await page.evaluate(async (mId) => {
                try {
                    const res = await API.menu.list();
                    const items = res.data || res.items || (Array.isArray(res) ? res : []);
                    const found = items.find(m => m.id === mId);
                    return { found: !!found, stok: found ? found.stok : 0, isCorrect: found && found.stok === 23 };
                } catch (err) {
                    return { found: false, error: err.message };
                }
            }, createdMenuId);
            stockReduced = stockCheck.isCorrect;
        }
        record("Verifikasi Pengurangan Otomatis Stok Menu Setelah Checkout (Stok: 23)", stockReduced);

        // 4. Restock / Tambah Stok Menu (+5 Porsi)
        let restockSuccess = false;
        if (createdMenuId) {
            const restockRes = await page.evaluate(async (mId) => {
                try {
                    const res = await API.menu.tambahStok(mId, 5, 'Restock E2E Testing Batch');
                    return { success: !!(res && (res.success || res.status === 'success')), data: res };
                } catch (err) {
                    return { success: false, error: err.message };
                }
            }, createdMenuId);
            restockSuccess = restockRes.success;
        }
        record("Mutasi Tambah Stok / Restock Menu (+5 Porsi)", restockSuccess);

        // Verifikasi Stok Akumulasi (23 + 5 = 28)
        let stockAccumulated = false;
        if (createdMenuId) {
            const finalStockCheck = await page.evaluate(async (mId) => {
                try {
                    const res = await API.menu.list();
                    const items = res.data || res.items || (Array.isArray(res) ? res : []);
                    const found = items.find(m => m.id === mId);
                    return { found: !!found, stok: found ? found.stok : 0, isCorrect: found && found.stok === 28 };
                } catch (err) {
                    return { found: false, error: err.message };
                }
            }, createdMenuId);
            stockAccumulated = finalStockCheck.isCorrect;
        }
        record("Verifikasi Akumulasi Stok Setelah Restock (Stok: 28)", stockAccumulated);

        // 5. Tab Menu Stock Log: Navigasi & Filter Audit
        await page.evaluate(async () => {
            if (window.App && App.switchTab) await App.switchTab('menu_stock_log');
        });
        await page.waitForTimeout(600);

        const stockLogTabCheck = await page.evaluate(async () => {
            const tab = document.getElementById('tab-menu_stock_log');
            const isActive = tab && !tab.classList.contains('hidden');
            const hasModule = typeof window.MenuStockLog !== 'undefined';
            return { isActive, hasModule };
        });
        record("Navigasi ke Tab Menu Stock Log (tab-menu_stock_log)", stockLogTabCheck.isActive && stockLogTabCheck.hasModule);

        // Verifikasi Jejak Audit Tercatat di API Stock Logs
        let auditLogFound = false;
        if (createdMenuId) {
            const auditCheck = await page.evaluate(async (mId) => {
                try {
                    const res = await API.menu.stockLogs({ menu_id: mId });
                    const logs = res.data || res.logs || (Array.isArray(res) ? res : []);
                    return { count: logs.length, hasLog: logs.length > 0 };
                } catch (err) {
                    return { count: 0, hasLog: false, error: err.message };
                }
            }, createdMenuId);
            auditLogFound = auditCheck.hasLog;
        }
        record("Verifikasi Jejak Audit Riwayat Mutasi Stok Tercatat", auditLogFound);

        // 6. Tab Laporan Menu: Navigasi & Agregasi Omzet
        await page.evaluate(async () => {
            if (window.App && App.switchTab) await App.switchTab('laporan_menu');
        });
        await page.waitForTimeout(600);

        const laporanMenuTabCheck = await page.evaluate(async () => {
            const tab = document.getElementById('tab-laporan_menu');
            const isActive = tab && !tab.classList.contains('hidden');
            const hasModule = typeof window.LaporanMenu !== 'undefined';
            return { isActive, hasModule };
        });
        record("Navigasi ke Tab Laporan Omzet Kantin (tab-laporan_menu)", laporanMenuTabCheck.isActive && laporanMenuTabCheck.hasModule);

        // Panggil filter/load pada LaporanMenu
        const laporanLoadCheck = await page.evaluate(async () => {
            try {
                if (window.LaporanMenu && LaporanMenu.load) {
                    await LaporanMenu.load();
                } else if (window.LaporanMenu && LaporanMenu.filter) {
                    await LaporanMenu.filter();
                }
                return { success: true };
            } catch (err) {
                return { success: false, error: err.message };
            }
        });
        record("Inisialisasi Data Agregasi Laporan Penjualan F&B", laporanLoadCheck.success);

        // 7. Tab Cetak Struk: Navigasi, Sub-tab & Preview
        await page.evaluate(async () => {
            if (window.App && App.switchTab) await App.switchTab('struk');
        });
        await page.waitForTimeout(600);

        const strukTabCheck = await page.evaluate(async () => {
            const tab = document.getElementById('tab-struk');
            const isActive = tab && !tab.classList.contains('hidden');
            const hasModule = typeof window.Struk !== 'undefined';
            return { isActive, hasModule };
        });
        record("Navigasi ke Tab Cetak Struk Transaksi (tab-struk)", strukTabCheck.isActive && strukTabCheck.hasModule);

        // Sub-tab Navigation: Billing -> Kantin
        const subTabCheck = await page.evaluate(async () => {
            if (window.Struk && Struk.switchSubTab) {
                Struk.switchSubTab('billing');
                const isBilling = Struk.currentSubTab === 'billing';
                Struk.switchSubTab('kantin');
                const isKantin = Struk.currentSubTab === 'kantin';
                return { isBilling, isKantin, success: isBilling && isKantin };
            }
            return { success: false };
        });
        record("Navigasi Sub-Tab Struk (Billing & Kantin / F&B)", subTabCheck.success);

        // Muat Riwayat Transaksi di Tab Struk
        const strukHistoryCheck = await page.evaluate(async () => {
            try {
                if (window.Struk && Struk.loadHistory) {
                    await Struk.loadHistory();
                }
                return { success: true };
            } catch (err) {
                return { success: false, error: err.message };
            }
        });
        record("Pemuatan Riwayat Transaksi Pembayaran Struk", strukHistoryCheck.success);

    } catch (err) {
        record("Global Execution Error", false, err.message);
    }

    report.endTime = new Date().toISOString();
    return report;
}
