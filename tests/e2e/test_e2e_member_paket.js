/**
 * E2E Test Suite: Member, Saldo Waktu, Paket Billing, dan Grup PC
 * Target: http://127.0.0.1:7016 (Sandbox Isolated Server)
 * 
 * Cakupan:
 * 1. Autentikasi Admin & Verifikasi Shift Aktif
 * 2. Tab Member: Navigasi, Modal Form, Registrasi Akun Member Baru
 * 3. Saldo Waktu: Top-up Paket Waktu Member & Verifikasi Akumulasi Saldo
 * 4. Sesi Bermain Member: Buka Sesi Login Member di PC-03 & Tutup Sesi
 * 5. Tab Paket: Navigasi, Modal Form, CRUD Paket Billing
 * 6. Tab Grup: Navigasi, Modal Form, CRUD Grup PC / Zona
 */

async function runMemberPaketE2ETest(page) {
    const report = {
        suite: "E2E: Member, Saldo, Paket & Grup PC",
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
        record("Login Admin untuk Operasional Member & Paket", isDashboard);

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

        // 2. Tab Member: Navigasi & UI Modal
        await page.evaluate(async () => {
            if (window.App && App.switchTab) await App.switchTab('member');
        });
        await page.waitForTimeout(600);

        const memberTabCheck = await page.evaluate(async () => {
            const tab = document.getElementById('tab-member');
            const isActive = tab && !tab.classList.contains('hidden');
            const hasModule = typeof window.Member !== 'undefined';
            return { isActive, hasModule };
        });
        record("Navigasi ke Tab Manajemen Member (tab-member)", memberTabCheck.isActive && memberTabCheck.hasModule);

        // Modal Tambah Member
        const modalMemberCheck = await page.evaluate(async () => {
            if (window.Member && Member.showAddModal) {
                Member.showAddModal();
                await new Promise(r => setTimeout(r, 400));
                const modal = document.querySelector('#modal-content') || document.querySelector('#modal-container') || document.body;
                const hasModal = modal && (modal.innerHTML.includes('Tambah Member') || modal.innerHTML.includes('username'));
                if (window.Modal && Modal.closeModal) Modal.closeModal();
                return { hasModal: !!hasModal };
            }
            return { hasModal: false };
        });
        record("Modal Tambah Member Baru Terbuka & Ditutup", modalMemberCheck.hasModal);

        // Buat Member Baru (e2e_player)
        const testMemberUsername = `e2e_gamer_${Date.now().toString().slice(-4)}`;
        let createdMemberId = null;

        const createMemberRes = await page.evaluate(async (uname) => {
            try {
                const res = await API.member.create({
                    username: uname,
                    password: 'password123',
                    nama_lengkap: 'E2E Testing Gamer',
                    no_hp: '081234567890',
                    email: `${uname}@test.com`,
                    grup: 'reguler'
                });
                return { success: !!(res && (res.success || res.status === 'success')), data: res };
            } catch (err) {
                return { success: false, error: err.message };
            }
        }, testMemberUsername);
        record("Registrasi Akun Member Baru Berhasil", createMemberRes.success);

        // Verifikasi Akun Member di List
        const memberListRes = await page.evaluate(async (uname) => {
            try {
                const res = await API.member.list({ q: uname });
                const members = res.members || (res.data && res.data.members) || res.data || [];
                const found = Array.isArray(members) ? members.find(m => m.username === uname) : null;
                return { found: !!found, member: found };
            } catch (err) {
                return { found: false, error: err.message };
            }
        }, testMemberUsername);

        if (memberListRes.found && memberListRes.member) {
            createdMemberId = memberListRes.member.id;
        }
        record("Verifikasi Data Member di Database & List Grid", memberListRes.found && !!createdMemberId);

        // 3. Top-Up Saldo Waktu Member
        let topupSuccess = false;
        if (createdMemberId) {
            const topupRes = await page.evaluate(async (memId) => {
                try {
                    // Beli Paket ID 1 (1 Jam Reguler = 3600s)
                    const res = await API.member.tambahWaktu(memId, 1, 1, 'Tunai');
                    return { success: !!(res && (res.success || res.status === 'success')), data: res };
                } catch (err) {
                    return { success: false, error: err.message };
                }
            }, createdMemberId);
            topupSuccess = topupRes.success;
        }
        record("Top-Up Pembelian Paket Saldo Waktu Member (Tunai)", topupSuccess);

        // Verifikasi Sisa Waktu Member Bertambah
        let sisaWaktuValid = false;
        if (createdMemberId) {
            const memberDetailRes = await page.evaluate(async (memId) => {
                try {
                    const res = await API.member.get(memId);
                    const mem = res.member || res.data || res;
                    const sisa = mem.waktu_tersimpan || mem.sisa_waktu || mem.total_waktu || 0;
                    return { sisa, valid: sisa >= 60 };
                } catch (err) {
                    return { sisa: 0, valid: false };
                }
            }, createdMemberId);
            sisaWaktuValid = memberDetailRes.valid;
        }
        record("Verifikasi Akumulasi Saldo Waktu Member (>= 60 menit)", sisaWaktuValid);

        // 4. Sesi Bermain Member di Meja PC-03
        // Bersihkan sesi aktif sebelumnya di PC-03 jika ada
        await page.evaluate(async () => {
            try {
                const res = await API.dashboard.pcList();
                const allPcs = Object.values(res.by_grup || {}).flat();
                const pc3 = allPcs.find(p => p.kode === 'PC-03');
                if (pc3 && pc3.sesi_detail && pc3.sesi_detail.id) {
                    await API.sesi.tutup(pc3.sesi_detail.id);
                }
            } catch(e) {}
        });

        // Buka Sesi Member di PC-03
        let memberSesiId = null;
        const bukaMemberRes = await page.evaluate(async (uname) => {
            try {
                const res = await API.sesi.bukaMember('PC-03', uname);
                return { success: !!(res && (res.success || res.status === 'success')), data: res };
            } catch (err) {
                return { success: false, error: err.message };
            }
        }, testMemberUsername);

        if (bukaMemberRes.success) {
            memberSesiId = bukaMemberRes.data.sesi_id || (bukaMemberRes.data.data && bukaMemberRes.data.data.id) || (bukaMemberRes.data.sesi && bukaMemberRes.data.sesi.id);
        }
        record("Buka Sesi Billing Member di Meja PC-03", bukaMemberRes.success && !!memberSesiId);

        // Tutup Sesi Member di PC-03
        let tutupMemberSesi = false;
        if (memberSesiId) {
            const tutupRes = await page.evaluate(async (sId) => {
                try {
                    const res = await API.sesi.tutup(sId);
                    return { success: !!(res && (res.success || res.status === 'success')) };
                } catch (err) {
                    return { success: false };
                }
            }, memberSesiId);
            tutupMemberSesi = tutupRes.success;
        }
        record("Tutup Sesi Billing Member di Meja PC-03", tutupMemberSesi);

        // 5. Tab Paket: Navigasi, Modal & CRUD Paket
        await page.evaluate(async () => {
            if (window.App && App.switchTab) await App.switchTab('paket');
        });
        await page.waitForTimeout(600);

        const paketTabCheck = await page.evaluate(async () => {
            const tab = document.getElementById('tab-paket');
            const isActive = tab && !tab.classList.contains('hidden');
            const hasModule = typeof window.Paket !== 'undefined';
            return { isActive, hasModule };
        });
        record("Navigasi ke Tab Manajemen Paket (tab-paket)", paketTabCheck.isActive && paketTabCheck.hasModule);

        // Modal Tambah Paket
        const modalPaketCheck = await page.evaluate(async () => {
            if (window.Paket && Paket.showAddModal) {
                Paket.showAddModal();
                await new Promise(r => setTimeout(r, 400));
                const modal = document.querySelector('#modal-content') || document.querySelector('#modal-container') || document.body;
                const hasModal = modal && (modal.innerHTML.includes('Tambah Paket') || modal.innerHTML.includes('nama'));
                if (window.Modal && Modal.closeModal) Modal.closeModal();
                return { hasModal: !!hasModal };
            }
            return { hasModal: false };
        });
        record("Modal Tambah Paket Billing Terbuka & Ditutup", modalPaketCheck.hasModal);

        // Buat Paket Baru
        const testPaketNama = `Paket E2E ${Date.now().toString().slice(-4)}`;
        let createdPaketId = null;

        const createPaketRes = await page.evaluate(async (pNama) => {
            try {
                const res = await API.paket.create({
                    nama: pNama,
                    durasi_menit: 240,
                    harga: 15000,
                    kadaluarsa_hari: 30,
                    grup: 'reguler'
                });
                return { success: !!(res && (res.success || res.status === 'success')), id: res.id || (res.paket && res.paket.id), data: res };
            } catch (err) {
                return { success: false, error: err.message };
            }
        }, testPaketNama);

        if (createPaketRes.success) {
            createdPaketId = createPaketRes.id;
        }
        record("Buat Paket Billing Baru (Paket E2E 4 Jam)", createPaketRes.success && !!createdPaketId);

        // Update Paket (Edit Harga)
        let updatePaketSuccess = false;
        if (createdPaketId) {
            const updateRes = await page.evaluate(async (args) => {
                try {
                    const res = await API.paket.update(args.pId, {
                        nama: `${args.pNama} Updated`,
                        durasi_menit: 240,
                        harga: 18000,
                        kadaluarsa_hari: 30,
                        grup: 'reguler'
                    });
                    return { success: !!(res && (res.success || res.status === 'success')), data: res };
                } catch (err) {
                    return { success: false, error: err.message };
                }
            }, { pId: createdPaketId, pNama: testPaketNama });
            updatePaketSuccess = updateRes.success;
        }
        record("Update / Edit Data Paket Billing (Harga Rp18.000)", updatePaketSuccess);

        // 6. Tab Grup: Navigasi, Modal & CRUD Grup
        await page.evaluate(async () => {
            if (window.App && App.switchTab) await App.switchTab('grup');
        });
        await page.waitForTimeout(600);

        const grupTabCheck = await page.evaluate(async () => {
            const tab = document.getElementById('tab-grup');
            const isActive = tab && !tab.classList.contains('hidden');
            const hasModule = typeof window.Grup !== 'undefined';
            return { isActive, hasModule };
        });
        record("Navigasi ke Tab Grup PC / Zona (tab-grup)", grupTabCheck.isActive && grupTabCheck.hasModule);

        // Modal Tambah Grup
        const modalGrupCheck = await page.evaluate(async () => {
            if (window.Grup && Grup.showAddModal) {
                Grup.showAddModal();
                await new Promise(r => setTimeout(r, 400));
                const modal = document.querySelector('#modal-content') || document.querySelector('#modal-container') || document.body;
                const hasModal = modal && (modal.innerHTML.includes('Tambah Grup') || modal.innerHTML.includes('nama'));
                if (window.Modal && Modal.closeModal) Modal.closeModal();
                return { hasModal: !!hasModal };
            }
            return { hasModal: false };
        });
        record("Modal Tambah Grup PC Terbuka & Ditutup", modalGrupCheck.hasModal);

        // Buat Grup Baru
        const testGrupNama = `e2e_zone_${Date.now().toString().slice(-4)}`;
        let createdGrupId = null;

        const createGrupRes = await page.evaluate(async (gNama) => {
            try {
                const res = await API.grup.create({
                    nama: gNama,
                    warna: '#10b981',
                    keterangan: 'Zona E2E Studio Room'
                });
                return { success: !!(res && (res.success || res.status === 'success')), data: res };
            } catch (err) {
                return { success: false, error: err.message };
            }
        }, testGrupNama);
        record("Buat Grup PC Baru (e2e_zone)", createGrupRes.success);

        // Verifikasi Grup & Ambil ID
        const grupListRes = await page.evaluate(async (gNama) => {
            try {
                const res = await API.grup.list();
                const grups = res.grup || res.grups || (res.data && res.data.grup) || res.data || [];
                const found = Array.isArray(grups) ? grups.find(g => g.nama === gNama) : null;
                return { found: !!found, grup: found };
            } catch (err) {
                return { found: false, error: err.message };
            }
        }, testGrupNama);

        if (grupListRes.found && grupListRes.grup) {
            createdGrupId = grupListRes.grup.id;
        }
        record("Verifikasi Data Grup Terdaftar di Sistem", grupListRes.found && !!createdGrupId);

        // Hapus Grup Baru
        let deleteGrupSuccess = false;
        if (createdGrupId) {
            const delRes = await page.evaluate(async (gId) => {
                try {
                    const res = await API.grup.delete(gId);
                    return { success: !!(res && (res.success || res.status === 'success')) };
                } catch (err) {
                    return { success: false, error: err.message };
                }
            }, createdGrupId);
            deleteGrupSuccess = delRes.success;
        }
        record("Hapus Grup PC yang Dibuat untuk Uji Coba", deleteGrupSuccess);

    } catch (err) {
        record("Global Execution Error", false, err.message);
    }

    report.endTime = new Date().toISOString();
    return report;
}

if (typeof module !== 'undefined') {
    module.exports = { runMemberPaketE2ETest };
}
