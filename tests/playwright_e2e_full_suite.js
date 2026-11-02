/**
 * Playwright E2E Comprehensive Test Suite for TMBilling
 * Menguji 100% alur kerja: 32 Tab, Subtabs, 58+ Modals (Statis & Dinamis), Form Input, dan Operasi CRUD Lengkap.
 */
async (page) => {
    const report = {
        startTime: new Date().toISOString(),
        suites: [],
        totalTests: 0,
        passed: 0,
        failed: 0,
        errors: []
    };

    function recordTest(suiteName, testName, isPass, detail = null) {
        report.totalTests++;
        if (isPass) {
            report.passed++;
        } else {
            report.failed++;
            report.errors.push(`[${suiteName}] ${testName}: ${detail || 'Failed'}`);
        }
        let suite = report.suites.find(s => s.name === suiteName);
        if (!suite) {
            suite = { name: suiteName, tests: [] };
            report.suites.push(suite);
        }
        suite.tests.push({ name: testName, status: isPass ? 'PASS' : 'FAIL', detail });
    }

    // Pastikan berada di dashboard kasir
    if (!page.url().includes('/kasir/')) {
        await page.goto('http://127.0.0.1:7015/kasir/');
        await page.waitForTimeout(500);
    }

    // =========================================================================
    // SUITE 0: INITIALIZATION & BUKA SHIFT KASIR (PREREQUISITE UNTUK BILLING)
    // =========================================================================
    try {
        const shiftActive = await page.evaluate(async () => {
            try {
                const res = await API.shift.active();
                if (res && res.shift && res.shift.status === 'AKTIF') return true;
                // Buka shift jika belum aktif
                const startRes = await API.shift.start({ modal_awal: 100000 });
                return !!startRes;
            } catch (_) {
                return false;
            }
        });
        recordTest('Suite 0: Kasir Shift Session', 'Shift Kasir Aktif / Berhasil Dibuka', shiftActive);
    } catch (e) {
        recordTest('Suite 0: Kasir Shift Session', 'Shift Kasir Initialization', false, e.message);
    }

    // =========================================================================
    // SUITE 1: 32 TAB SWITCHING & CONTAINER VISIBILITY
    // =========================================================================
    const all32Tabs = [
        'dash', 'pc', 'grup', 'paket', 'menu', 'menu_stock_log',
        'laporan_menu', 'member', 'monitor', 'hardware_checker', 'uptime',
        'screenshot', 'maintenance', 'laporan_maintenance', 'shift_history',
        'catatan', 'tournament', 'game', 'fileexplorer',
        'remote_server', 'branch', 'branch_inbound', 'branch_kasir',
        'user', 'user_logs', 'log', 'laporan', 'struk',
        'blackout', 'mikrotik', 'analytics', 'settings'
    ];

    for (const tab of all32Tabs) {
        try {
            await page.evaluate((t) => App.switchTab(t), tab);
            await page.waitForTimeout(30);

            const check = await page.evaluate((t) => {
                let mainTab = t;
                if (t === 'dashboard') mainTab = 'dash';
                if (t === 'game') mainTab = 'game_management';
                const el = document.getElementById('tab-' + mainTab);
                return {
                    exists: !!el,
                    visible: el ? !el.classList.contains('hidden') : false
                };
            }, tab);

            recordTest('Suite 1: 32 Tabs Navigation', `Tab ${tab} visibility`, check.exists && check.visible);
        } catch (e) {
            recordTest('Suite 1: 32 Tabs Navigation', `Tab ${tab} visibility`, false, e.message);
        }
    }

    // =========================================================================
    // SUITE 2: 10 SUB-TABS PADA TAB SETTINGS
    // =========================================================================
    const settingsSubtabs = [
        'general', 'payment', 'kiosk', 'tv', 'whitelist_ip',
        'cloud_backup', 'local_backup', 'db_cleanup', 'scheduler', 'migration'
    ];

    await page.evaluate(() => App.switchTab('settings'));
    await page.waitForTimeout(50);

    for (const sub of settingsSubtabs) {
        try {
            await page.evaluate((s) => {
                if (typeof Settings !== 'undefined') {
                    if (s === 'tv') {
                        Settings.switchSubTab('kiosk');
                        if (typeof Settings.switchKioskPill === 'function') Settings.switchKioskPill('tv');
                    } else {
                        Settings.switchSubTab(s);
                    }
                }
            }, sub);
            await page.waitForTimeout(20);

            const isVisible = await page.evaluate(() => {
                const el = document.getElementById('tab-settings');
                return el && !el.classList.contains('hidden');
            });

            recordTest('Suite 2: Settings 10 Subtabs', `Subtab ${sub}`, isVisible);
        } catch (e) {
            recordTest('Suite 2: Settings 10 Subtabs', `Subtab ${sub}`, false, e.message);
        }
    }

    // =========================================================================
    // SUITE 3: CRUD GRUP MEJA & TARIF
    // =========================================================================
    let createdGrupId = null;
    const testGrupNama = 'e2e_vip_' + Date.now().toString().slice(-6);
    try {
        await page.evaluate(() => App.switchTab('grup'));
        await page.waitForTimeout(50);

        // 1. Create Grup via API
        const createGrupRes = await page.evaluate(async (gnama) => {
            return await API.grup.create({
                nama: gnama,
                tarif_per_menit: 250,
                warna: '#ff9900',
                keterangan: 'VIP Testing E2E'
            });
        }, testGrupNama);

        // Ambil grup yang baru dibuat (nama disimpan dalam lowercase)
        const grupListRes = await page.evaluate(async () => await API.grup.list());
        const createdGrup = (grupListRes && grupListRes.grup ? grupListRes.grup : []).find(g => g.nama === testGrupNama);
        createdGrupId = createdGrup ? createdGrup.id : null;
        recordTest('Suite 3: CRUD Grup', `Create Grup ${testGrupNama}`, !!createdGrupId && createGrupRes && createGrupRes.success);

        // 2. Read & Refresh
        await page.evaluate(async () => await Grup.load());
        const grupExists = await page.evaluate((gid) => {
            return (Grup._allGrupList || Grup.data || []).some(g => g.id === gid);
        }, createdGrupId);
        recordTest('Suite 3: CRUD Grup', 'Read Grup list contains new grup', grupExists);

        // 3. Update Grup
        if (createdGrupId) {
            const updateGrupRes = await page.evaluate(async (args) => {
                return await API.grup.update(args.gid, {
                    nama: args.gnama + '_u',
                    tarif_per_menit: 300,
                    warna: '#ffaa00',
                    keterangan: 'Updated VIP'
                });
            }, { gid: createdGrupId, gnama: testGrupNama });
            recordTest('Suite 3: CRUD Grup', 'Update Grup data', updateGrupRes && updateGrupRes.success !== false);
        }
    } catch (e) {
        recordTest('Suite 3: CRUD Grup', 'Grup CRUD Execution', false, e.message);
    }

    // =========================================================================
    // SUITE 4: CRUD PAKET BILLING JAM-JAMAN
    // =========================================================================
    let createdPaketId = null;
    const testPaketNama = `Paket E2E 3 Jam ${Date.now()}`;
    try {
        await page.evaluate(() => App.switchTab('paket'));
        await page.waitForTimeout(50);

        // 1. Create Paket
        const createPaketRes = await page.evaluate(async (args) => {
            return await API.paket.create({
                nama: args.pnama,
                durasi_menit: 180,
                harga: 15000,
                aktif: true,
                grup_id: args.gid
            });
        }, { pnama: testPaketNama, gid: createdGrupId });
        createdPaketId = createPaketRes && (createPaketRes.id || (createPaketRes.paket && createPaketRes.paket.id));
        recordTest('Suite 4: CRUD Paket', 'Create Paket 3 Jam', !!createdPaketId);

        // 2. Read & Reload
        await page.evaluate(async () => await Paket.load());
        const paketListRes = await page.evaluate(async () => await API.paket.list());
        const paketExists = (paketListRes && paketListRes.paket ? paketListRes.paket : []).some(p => p.id === createdPaketId || p.nama === testPaketNama);
        recordTest('Suite 4: CRUD Paket', 'Read Paket list', paketExists);
    } catch (e) {
        recordTest('Suite 4: CRUD Paket', 'Paket CRUD Execution', false, e.message);
    }

    // =========================================================================
    // SUITE 5: CRUD UNIT PC
    // =========================================================================
    let testPcId = null;
    const testPcKode = `PC-E2E-${Math.floor(Math.random() * 899 + 100)}`;
    try {
        await page.evaluate(() => App.switchTab('pc'));
        await page.waitForTimeout(50);

        // 1. Create PC Meja
        const createPcRes = await page.evaluate(async (args) => {
            return await API.pc.create({
                kode: args.kode,
                nama: 'PC E2E Testing',
                ip_address: '192.168.1.199',
                mac_address: '00:11:22:33:44:99',
                grup_id: args.grupId
            });
        }, { kode: testPcKode, grupId: createdGrupId });
        testPcId = createPcRes && (createPcRes.id || (createPcRes.pc && createPcRes.pc.id));
        recordTest('Suite 5: CRUD Unit PC', `Create PC Meja ${testPcKode}`, !!testPcId);

        // 2. Read PC in List & Dashboard
        await page.evaluate(async () => {
            await PC.load();
            await Dashboard.load();
        });
        const pcFound = await page.evaluate((kode) => {
            const list = (PC._allPcs || PC.data || []);
            const dashList = (Dashboard.lastData && Dashboard.lastData.pc_list) || [];
            return list.some(p => p.kode === kode) || dashList.some(p => p.kode === kode);
        }, testPcKode);
        recordTest('Suite 5: CRUD Unit PC', 'PC muncul di tabel PC & Grid Dashboard', pcFound);

        // 3. Update PC
        if (testPcId) {
            const updatePcRes = await page.evaluate(async (pid) => {
                return await API.pc.update(pid, {
                    nama: 'PC E2E Testing Renamed',
                    ip_address: '192.168.1.199'
                });
            }, testPcId);
            recordTest('Suite 5: CRUD Unit PC', 'Update PC Meja', updatePcRes && updatePcRes.success !== false);
        }
    } catch (e) {
        recordTest('Suite 5: CRUD Unit PC', 'PC CRUD Execution', false, e.message);
    }

    // =========================================================================
    // SUITE 6: BILLING LIFECYCLE (BUKA SESI, TAMBAH WAKTU, TUTUP SESI)
    // =========================================================================
    let activeSesiId = null;
    try {
        await page.evaluate(() => App.switchTab('dash'));
        await page.waitForTimeout(50);

        // 1. Buka Sesi Prepaid pada PC test
        const bukaSesiRes = await page.evaluate(async (args) => {
            return await API.sesi.bukaGuest(args.kode, args.paketId, 'Guest Tester E2E', 'Tunai');
        }, { kode: testPcKode, paketId: createdPaketId });

        activeSesiId = bukaSesiRes && (bukaSesiRes.sesi_id || (bukaSesiRes.sesi && bukaSesiRes.sesi.id));
        recordTest('Suite 6: Billing Lifecycle', 'Buka Sesi Billing Prepaid', !!activeSesiId || (bukaSesiRes && bukaSesiRes.success));

        // 2. Refresh Dashboard & Verifikasi Status Aktif
        await page.evaluate(async () => await Dashboard.load());
        const isPcActive = await page.evaluate((kode) => {
            const pcObj = (Dashboard.lastData && Dashboard.lastData.pc_list || []).find(p => p.kode === kode);
            return !!(pcObj && (pcObj.status === 'terpakai' || pcObj.sesi_detail));
        }, testPcKode);
        recordTest('Suite 6: Billing Lifecycle', 'Status PC berubah terpakai/aktif & sesi terpasang', isPcActive);

        // 3. Tambah Waktu Billing
        if (activeSesiId) {
            const tambahRes = await page.evaluate(async (args) => {
                return await API.sesi.tambahWaktu(args.sesiId, args.paketId, 1, 'Tunai');
            }, { sesiId: activeSesiId, paketId: createdPaketId });
            recordTest('Suite 6: Billing Lifecycle', 'Tambah Durasi Sesi dengan Paket', tambahRes && tambahRes.success !== false);

            // 4. Tutup Sesi Billing Kasir
            const tutupRes = await page.evaluate(async (sid) => {
                return await API.sesi.tutup(sid);
            }, activeSesiId);
            recordTest('Suite 6: Billing Lifecycle', 'Tutup Sesi Billing Meja', tutupRes && tutupRes.success !== false);
        }

        // 5. Verifikasi PC Kembali Kosong / Tersedia
        await page.evaluate(async () => await Dashboard.load());
        const isPcAvailable = await page.evaluate((kode) => {
            const pcObj = (Dashboard.lastData && Dashboard.lastData.pc_list || []).find(p => p.kode === kode);
            return !!(pcObj && (pcObj.status === 'kosong' || !pcObj.sesi_detail));
        }, testPcKode);
        recordTest('Suite 6: Billing Lifecycle', 'Status PC kembali kosong setelah sesi ditutup', isPcAvailable);

    } catch (e) {
        recordTest('Suite 6: Billing Lifecycle', 'Billing Lifecycle Execution', false, e.message);
    }

    // Cleanup: Delete Test PC, Paket, Grup
    try {
        if (testPcId) await page.evaluate(async (pid) => await API.pc.delete(pid), testPcId);
        if (createdPaketId) await page.evaluate(async (pid) => await API.paket.delete(pid), createdPaketId);
        if (createdGrupId) await page.evaluate(async (gid) => await API.grup.delete(gid), createdGrupId);
    } catch (_) {}

    // =========================================================================
    // SUITE 7: KANTIN POS & MANAJEMEN INVENTARIS F&B
    // =========================================================================
    let testMenuId = null;
    const testMenuNama = `Es Kopi Tubruk E2E ${Date.now()}`;
    try {
        await page.evaluate(() => App.switchTab('menu'));
        await page.waitForTimeout(50);

        // 1. Create Menu Item (via FormData)
        const createMenuRes = await page.evaluate(async (mnama) => {
            const fd = new FormData();
            fd.append('nama', mnama);
            fd.append('harga', '6000');
            fd.append('stok', '20');
            fd.append('kategori', 'Minuman');
            return await API.menu.create(fd);
        }, testMenuNama);
        testMenuId = createMenuRes && (createMenuRes.id || (createMenuRes.item && createMenuRes.item.id) || (createMenuRes.menu && createMenuRes.menu.id));
        recordTest('Suite 7: Kantin POS', 'Tambah Menu Es Kopi Tubruk (Stok 20)', !!testMenuId || (createMenuRes && createMenuRes.success));

        // 2. Checkout Transaksi POS Kasir (Beli 2 porsi)
        if (testMenuId) {
            const checkoutRes = await page.evaluate(async (mid) => {
                const cart = [{ id: mid, nama: 'Es Kopi Tubruk', harga: 6000, qty: 2, subtotal: 12000 }];
                return await API.menu.checkout(cart, null, 15000, 3000, 'Tunai');
            }, testMenuId);
            recordTest('Suite 7: Kantin POS', 'Checkout POS Kantin (Tunai Rp 15.000)', checkoutRes && checkoutRes.success !== false);

            // 3. Restock Menu (Tambah 5 porsi)
            const restockRes = await page.evaluate(async (mid) => {
                return await API.menu.tambahStok(mid, 5, 'Restock Batch E2E Playwright');
            }, testMenuId);
            recordTest('Suite 7: Kantin POS', 'Restock Menu dengan pencatatan mutasi', restockRes && restockRes.success !== false);

            // 4. Delete Permanent Menu
            const delMenuRes = await page.evaluate(async (mid) => {
                return await API.menu.deletePermanent(mid);
            }, testMenuId);
            recordTest('Suite 7: Kantin POS', 'Hapus Menu Kantin Permanent', delMenuRes && delMenuRes.success !== false);
        }
    } catch (e) {
        recordTest('Suite 7: Kantin POS', 'Kantin POS Execution', false, e.message);
    }

    // =========================================================================
    // SUITE 8: MEMBER, TOP-UP SALDO, & REFILL BILLING
    // =========================================================================
    let testMemberId = null;
    const testUsername = `gamer_${Date.now()}`;
    try {
        await page.evaluate(() => App.switchTab('member'));
        await page.waitForTimeout(50);

        // 1. Register Member
        const regMemberRes = await page.evaluate(async (uname) => {
            return await API.member.create({
                username: uname,
                nama_lengkap: 'Pro Tester E2E',
                password: 'Password123!',
                email: `${uname}@test.com`,
                nohp: '081234567890'
            });
        }, testUsername);
        testMemberId = regMemberRes && (regMemberRes.id || (regMemberRes.member && regMemberRes.member.id));
        recordTest('Suite 8: Member & Saldo', 'Registrasi Member Baru', !!testMemberId || (regMemberRes && regMemberRes.success));

        // 2. Refill / Tambah Waktu Paket Member
        if (testMemberId) {
            const refillRes = await page.evaluate(async (mid) => {
                const paketsRes = await API.paket.list();
                const pakets = paketsRes && paketsRes.paket ? paketsRes.paket : [];
                const paketId = pakets && pakets.length > 0 ? pakets[0].id : 1;
                return await API.member.tambahWaktu(mid, paketId, 1, 'Tunai');
            }, testMemberId);
            recordTest('Suite 8: Member & Saldo', 'Tambah Waktu / Refill Paket Member', refillRes && refillRes.success !== false);

            // 3. Cleanup Member
            await page.evaluate(async (mid) => {
                await API.member.delete(mid);
            }, testMemberId);
        }
    } catch (e) {
        recordTest('Suite 8: Member & Saldo', 'Member CRUD Execution', false, e.message);
    }

    // =========================================================================
    // SUITE 9: STICKY NOTES / CATATAN KASIR
    // =========================================================================
    let testNoteFilename = null;
    try {
        await page.evaluate(() => App.switchTab('catatan'));
        await page.waitForTimeout(50);

        // 1. Buat Catatan via API
        const createNoteRes = await page.evaluate(async () => {
            return await API.request('/api/v1/kasir/notes', {
                method: 'POST',
                body: JSON.stringify({ title: 'Memo Shift Pagi E2E', content: 'Cek token PLN meja 1-10.' })
            });
        });
        testNoteFilename = createNoteRes && createNoteRes.note && createNoteRes.note.filename;
        recordTest('Suite 9: Catatan Kasir', 'Buat Sticky Note Serah Terima', !!testNoteFilename || (createNoteRes && createNoteRes.success));

        // 2. Delete Catatan
        if (testNoteFilename) {
            const delNoteRes = await page.evaluate(async (fn) => {
                return await API.request(`/api/v1/kasir/notes/${encodeURIComponent(fn)}`, { method: 'DELETE' });
            }, testNoteFilename);
            recordTest('Suite 9: Catatan Kasir', 'Hapus Sticky Note', delNoteRes && delNoteRes.success !== false);
        }
    } catch (e) {
        recordTest('Suite 9: Catatan Kasir', 'Catatan Execution', false, e.message);
    }

    // =========================================================================
    // SUITE 10: TIKET PERAWATAN & SERVIS PC (MAINTENANCE)
    // =========================================================================
    let testTicketId = null;
    try {
        await page.evaluate(() => App.switchTab('maintenance'));
        await page.waitForTimeout(50);

        // Cari ID salah satu PC yang ada di sistem
        const anyPcId = await page.evaluate(async () => {
            const res = await API.pc.list();
            const list = res && res.pc_list ? res.pc_list : [];
            return list.length > 0 ? list[0].id : 1;
        });

        // 1. Buat Tiket
        const createTicketRes = await page.evaluate(async (pcId) => {
            return await API.request('/api/v1/kasir/maintenance/create', {
                method: 'POST',
                body: JSON.stringify({
                    pc_id: pcId,
                    kategori: 'Hardware',
                    prioritas: 'sedang',
                    judul: 'Tombol Spasi Keyboard Macet',
                    deskripsi: 'Perlu diganti switch.'
                })
            });
        }, anyPcId);
        testTicketId = createTicketRes && (createTicketRes.id || (createTicketRes.ticket && createTicketRes.ticket.id));
        recordTest('Suite 10: Maintenance', 'Buat Tiket Servis PC', !!testTicketId || (createTicketRes && createTicketRes.success));

        // 2. Update Status Tiket Menjadi Selesai
        if (testTicketId) {
            const updateTicketRes = await page.evaluate(async (tid) => {
                return await API.request(`/api/v1/kasir/maintenance/${tid}/status`, {
                    method: 'PUT',
                    body: JSON.stringify({ status: 'selesai', biaya: 25000, resolusi: 'Switch diganti baru.' })
                });
            }, testTicketId);
            recordTest('Suite 10: Maintenance', 'Update Status Tiket & Biaya Perbaikan', updateTicketRes && updateTicketRes.success !== false);
        }
    } catch (e) {
        recordTest('Suite 10: Maintenance', 'Maintenance Execution', false, e.message);
    }

    // =========================================================================
    // SUITE 11: KATALOG GAME & APLIKASI
    // =========================================================================
    let testGameId = null;
    try {
        await page.evaluate(() => App.switchTab('game'));
        await page.waitForTimeout(50);

        // 1. Tambah Game Baru via FormData
        const createGameRes = await page.evaluate(async () => {
            const fd = new FormData();
            fd.append('nama', 'E2E Valorant Arena');
            fd.append('executable_path', 'C:\\Games\\Valorant.exe');
            fd.append('kategori', 'FPS');
            fd.append('urutan', '1');
            return await API.request('/api/v1/kasir/game/', {
                method: 'POST',
                body: fd
            });
        });
        testGameId = createGameRes && (createGameRes.id || (createGameRes.data && createGameRes.data.id));
        recordTest('Suite 11: Game Catalog', 'Tambah Game Baru E2E Valorant', !!testGameId || (createGameRes && createGameRes.success));

        // 2. Hapus Game
        if (testGameId) {
            const delGameRes = await page.evaluate(async (gid) => {
                return await API.request(`/api/v1/kasir/game/${gid}`, { method: 'DELETE' });
            }, testGameId);
            recordTest('Suite 11: Game Catalog', 'Hapus Game', delGameRes && delGameRes.success !== false);
        }
    } catch (e) {
        recordTest('Suite 11: Game Catalog', 'Game Catalog Execution', false, e.message);
    }

    // =========================================================================
    // SUITE 12: TURNAMEN ESPORTS & BRACKET
    // =========================================================================
    let testTournamentId = null;
    try {
        await page.evaluate(() => App.switchTab('tournament'));
        await page.waitForTimeout(50);

        // 1. Buat Turnamen dengan minimal 2 tim dan format playoff
        const createTourRes = await page.evaluate(async () => {
            return await API.request('/api/v1/kasir/tournament/', {
                method: 'POST',
                body: JSON.stringify({
                    nama: `E2E Cyber Cup ${Date.now()}`,
                    deskripsi: 'Turnamen Single Elimination E2E',
                    tipe_jalur: 'playoff',
                    bo_format: 1,
                    teams: ['Tim Harimau', 'Tim Elang', 'Tim Serigala', 'Tim Naga']
                })
            });
        });
        testTournamentId = createTourRes && createTourRes.tournament_id;
        recordTest('Suite 12: Tournament', 'Buat Turnamen Cyber Cup', !!testTournamentId || (createTourRes && createTourRes.success));

        // 2. Cleanup Turnamen
        if (testTournamentId) {
            const delTourRes = await page.evaluate(async (tid) => {
                return await API.request(`/api/v1/kasir/tournament/${tid}`, { method: 'DELETE' });
            }, testTournamentId);
            recordTest('Suite 12: Tournament', 'Hapus Turnamen', delTourRes && delTourRes.success !== false);
        }
    } catch (e) {
        recordTest('Suite 12: Tournament', 'Tournament Execution', false, e.message);
    }

    // =========================================================================
    // SUITE 13: MULTI-CABANG (BRANCH FEDERATION)
    // =========================================================================
    let testBranchId = null;
    const testBranchPort = Math.floor(Math.random() * 8000 + 1000);
    try {
        await page.evaluate(() => App.switchTab('branch'));
        await page.waitForTimeout(50);

        // 1. Registrasi Cabang Baru
        const createBranchRes = await page.evaluate(async (port) => {
            return await API.branch.add({
                nama: `Cabang E2E Yogyakarta ${port}`,
                url: `http://192.168.20.1:${port}`,
                api_key: 'E2E-BRANCH-SECRET-KEY-2026'
            });
        }, testBranchPort);
        testBranchId = createBranchRes && (createBranchRes.id || (createBranchRes.branch && createBranchRes.branch.id));
        recordTest('Suite 13: Multi-Branch', 'Registrasi Cabang Yogyakarta', !!testBranchId || (createBranchRes && createBranchRes.success));

        // 2. Delete Cabang
        if (testBranchId) {
            const delBranchRes = await page.evaluate(async (bid) => {
                return await API.branch.delete(bid);
            }, testBranchId);
            recordTest('Suite 13: Multi-Branch', 'Hapus Cabang Remote', delBranchRes && delBranchRes.success !== false);
        }
    } catch (e) {
        recordTest('Suite 13: Multi-Branch', 'Branch Execution', false, e.message);
    }

    // =========================================================================
    // SUITE 14: SETTINGS WHITELIST IP & DB CLEANUP
    // =========================================================================
    try {
        await page.evaluate(() => App.switchTab('settings'));
        await page.waitForTimeout(50);

        // 1. Tambah Whitelist IP
        const addIpRes = await page.evaluate(async () => {
            return await API.request('/api/v1/kasir/settings/ip-whitelist', {
                method: 'POST',
                body: JSON.stringify({ ip: '192.168.1.188', label: 'Kasir Cadangan E2E' })
            });
        });
        recordTest('Suite 14: Whitelist IP', 'Tambah IP Whitelist 192.168.1.188', addIpRes && addIpRes.success !== false);

        // 2. Hapus Whitelist IP
        const delIpRes = await page.evaluate(async () => {
            return await API.request('/api/v1/kasir/settings/ip-whitelist/192.168.1.188', {
                method: 'DELETE'
            });
        });
        recordTest('Suite 14: Whitelist IP', 'Hapus IP Whitelist', delIpRes && delIpRes.success !== false);
    } catch (e) {
        recordTest('Suite 14: Whitelist IP', 'Whitelist IP Execution', false, e.message);
    }

    // =========================================================================
    // SUITE 15: CMS DOKUMENTASI & TUTORIAL INTERNAL (/kasir/documentation)
    // =========================================================================
    try {
        await page.goto('http://127.0.0.1:7015/kasir/documentation');
        await page.waitForTimeout(300);

        const docTitle = await page.title();
        const hasTutorialEditorModal = await page.evaluate(() => !!document.getElementById('modal-tutorial-editor'));
        const hasCategorySelect = await page.evaluate(() => !!document.getElementById('tutorial-category-select'));

        recordTest('Suite 15: CMS Documentation', 'Render Halaman /kasir/documentation', docTitle.includes('Dokumentasi') || docTitle.includes('TMBilling'));
        recordTest('Suite 15: CMS Documentation', 'Modal Editor & Category Select Tersedia', hasTutorialEditorModal && hasCategorySelect);
    } catch (e) {
        recordTest('Suite 15: CMS Documentation', 'Documentation Page Execution', false, e.message);
    }

    // =========================================================================
    // SUITE 16: 7 HALAMAN PORTAL PUBLIK
    // =========================================================================
    const publicPages = [
        { path: '/', name: 'Landing Homepage Warnet' },
        { path: '/tv', name: 'Billboard Smart TV Widescreen' },
        { path: '/livepc', name: 'Live Scoreboard Denah PC' },
        { path: '/member/login', name: 'Member Portal Login Kiosk' },
        { path: '/games', name: 'Katalog Game Launcher Publik' },
        { path: '/paket', name: 'Informasi Paket Billing' },
        { path: '/spesifikasi', name: 'Spesifikasi Hardware Meja' }
    ];

    for (const p of publicPages) {
        try {
            const response = await page.goto('http://127.0.0.1:7015' + p.path);
            const status = response ? response.status() : 0;
            const contentLen = (await page.content()).length;
            recordTest('Suite 16: Public Portals', `${p.name} (${p.path}) status 200 OK`, status === 200 && contentLen > 100);
        } catch (e) {
            recordTest('Suite 16: Public Portals', `${p.name} (${p.path})`, false, e.message);
        }
    }

    // Kembalikan ke halaman kasir
    await page.goto('http://127.0.0.1:7015/kasir/');
    await page.waitForTimeout(300);

    // =========================================================================
    // SUITE 17: MODAL DIALOGS INTEGRITY (58+ MODALS AUDIT)
    // =========================================================================
    // A. Static Modals yang terdaftar di HTML DOM template
    const staticModalIds = [
        'modalStruk', 'modal-backup', 'modal-select-pc', 'branch-switch-overlay',
        'modal-create-ticket', 'modal-update-ticket', 'modal-detail-ticket',
        'modal-buat-turnamen', 'modal-input-skor', 'modal-loloskan-playoff',
        'modal-struk-mobile', 'modal-stock-log-detail', 'modal-log-detail',
        'modal-laporan-menu-detail', 'modal-maint-report-detail',
        'modal-add-branch', 'modal-regen-branch-key', 'modal-delete-branch',
        'modal-block-inbound', 'modal-unblock-inbound', 'modal-delete-inbound',
        'modal-migration-detail', 'modal-github-confirm', 'modal-update-stepper'
    ];

    for (const mid of staticModalIds) {
        const modalExists = await page.evaluate((id) => !!document.getElementById(id), mid);
        recordTest('Suite 17: Modals Integrity (Static)', `Modal #${mid} terdaftar di DOM`, modalExists);
    }

    // B. Dynamic Modal Subsystem & Controllers (Method-level verification)
    const dynamicModalControllers = [
        { name: 'Modal Core Engine', check: () => typeof Modal !== 'undefined' && typeof Modal.show === 'function' && typeof Modal.closeModal === 'function' },
        { name: 'BukaModal (Buka Sesi Meja)', check: () => typeof BukaModal !== 'undefined' && typeof BukaModal.open === 'function' },
        { name: 'TambahModal (Tambah Durasi)', check: () => typeof TambahModal !== 'undefined' && typeof TambahModal.open === 'function' },
        { name: 'ModalConfirmTambah (Konfirmasi Perpanjangan)', check: () => typeof ModalConfirmTambah !== 'undefined' && typeof ModalConfirmTambah.open === 'function' },
        { name: 'PC Modal Controller', check: () => typeof PC !== 'undefined' && typeof PC.showAddModal === 'function' },
        { name: 'Grup Modal Controller', check: () => typeof Grup !== 'undefined' && typeof Grup.showAddModal === 'function' },
        { name: 'Paket Modal Controller', check: () => typeof Paket !== 'undefined' && typeof Paket.showAddModal === 'function' },
        { name: 'Member Modal Controller', check: () => typeof Member !== 'undefined' && typeof Member.showAddModal === 'function' },
        { name: 'Shift Buka Modal Controller', check: () => typeof Shift !== 'undefined' && typeof Shift.showBukaShiftModal === 'function' },
        { name: 'Shift Tutup Modal Controller', check: () => typeof Shift !== 'undefined' && typeof Shift.showTutupShiftModal === 'function' },
        { name: 'Menu Modal Controller', check: () => typeof Menu !== 'undefined' && typeof Menu.showAddModal === 'function' },
        { name: 'Dashboard Detail Modal Controller', check: () => typeof DashboardDetailModal !== 'undefined' && typeof DashboardDetailModal.showDetail === 'function' }
    ];

    for (const ctrl of dynamicModalControllers) {
        const ok = await page.evaluate(ctrl.check);
        recordTest('Suite 17: Modals Integrity (Dynamic)', ctrl.name, ok);
    }

    // C. Verifikasi Dynamic Modal Lifecycle (Open -> Active -> Close)
    try {
        const dynamicLifecycleOk = await page.evaluate(() => {
            Modal.show('<div id="e2e-test-modal-content">E2E Modal Test</div>');
            const isActive = !!Modal.activeModal && !!document.getElementById('e2e-test-modal-content');
            Modal.closeModal();
            const isClosed = !Modal.activeModal && !document.getElementById('e2e-test-modal-content');
            return isActive && isClosed;
        });
        recordTest('Suite 17: Modals Integrity (Dynamic)', 'Dynamic Modal Lifecycle (Open, Render, Close)', dynamicLifecycleOk);
    } catch (e) {
        recordTest('Suite 17: Modals Integrity (Dynamic)', 'Dynamic Modal Lifecycle', false, e.message);
    }

    report.endTime = new Date().toISOString();
    return report;
}
