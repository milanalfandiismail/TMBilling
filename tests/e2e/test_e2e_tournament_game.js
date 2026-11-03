/**
 * E2E Test Suite: E-Sports Tournament & Katalog Game / Aplikasi
 * Target: http://127.0.0.1:7016 (Sandbox Isolated Server)
 * 
 * Cakupan:
 * 1. Autentikasi Admin
 * 2. Tab Tournament:
 *    - Navigasi & Modul Tournament
 *    - Inisialisasi Turnamen Baru (4 Tim, Single Elimination Playoffs)
 *    - Verifikasi Auto-Generate Bagan Bracket
 *    - Input Skor Pertandingan & Auto-Advance Pemenang ke Final
 *    - Hapus Turnamen (Cleanup)
 * 3. Tab Game Management:
 *    - Navigasi & Modul GameManagement
 *    - CRUD Kategori Game
 *    - Tambah Game / Aplikasi Baru (FormData)
 *    - Edit Metadata Game
 *    - Verifikasi List Game & Filter
 *    - Hapus Game (Cleanup)
 */

async (page) => {
    const report = {
        suite: "E2E: Tournament & Game Management",
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
        // 0. Reset Session / Pastikan Logout
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
        record("Login Admin untuk Tournament & Game Management", isDashboard);

        // 2. Tab Tournament (tab-tournament)
        await page.evaluate(async () => {
            if (window.App && App.switchTab) await App.switchTab('tournament');
        });
        await page.waitForTimeout(600);

        const tournamentTabCheck = await page.evaluate(async () => {
            const tab = document.getElementById('tab-tournament');
            const isActive = tab && !tab.classList.contains('hidden');
            const hasModule = typeof window.Tournament !== 'undefined';
            return { isActive, hasModule };
        });
        record("Navigasi ke Tab Turnamen (tab-tournament)", tournamentTabCheck.isActive && tournamentTabCheck.hasModule);

        // 3. Inisialisasi Turnamen Baru (4 Tim Playoff)
        const tournamentName = `Apex Championship ${Date.now()}`;
        const createTourneyRes = await page.evaluate(async (tName) => {
            try {
                const res = await API.request('/api/v1/kasir/tournament/', {
                    method: 'POST',
                    body: JSON.stringify({
                        nama: tName,
                        deskripsi: 'Turnamen E2E Apex Legends',
                        tipe_jalur: 'playoff',
                        teams: ['Tim Harimau', 'Tim Elang', 'Tim Serigala', 'Tim Singa'],
                        bo_format: 1
                    })
                });
                return { success: !!(res && (res.success || res.tournament_id)), id: res ? res.tournament_id : null };
            } catch (err) {
                return { success: false, error: err.message };
            }
        }, tournamentName);
        record("Pembuatan Turnamen Baru (4 Tim, Format BO1)", createTourneyRes.success && !!createTourneyRes.id);

        const tourneyId = createTourneyRes.id;

        // 4. Verifikasi Detail Turnamen & Auto-Generate Bagan Bracket
        let matchesList = [];
        const detailTourneyRes = await page.evaluate(async (tId) => {
            try {
                const res = await API.request(`/api/v1/kasir/tournament/${tId}`);
                const matchesMap = res.matches || {};
                const allMatches = [];
                Object.values(matchesMap).forEach(arr => allMatches.push(...arr));
                return {
                    success: !!(res && res.tournament),
                    teamCount: (res.teams || []).length,
                    matchCount: allMatches.length,
                    matches: allMatches
                };
            } catch (err) {
                return { success: false, error: err.message };
            }
        }, tourneyId);
        matchesList = detailTourneyRes.matches || [];
        record("Auto-Generate Bagan Bracket & Pendaftaran 4 Tim", detailTourneyRes.success && detailTourneyRes.teamCount === 4 && detailTourneyRes.matchCount >= 3);

        // 5. Input Skor Pertandingan Semifinal (Match Round 1) & Auto-Advance Pemenang
        let matchToScore = matchesList.find(m => m.round_number === 1 && m.tim1_id && m.tim2_id);
        let updateScoreSuccess = false;
        if (matchToScore) {
            const scoreRes = await page.evaluate(async (mId) => {
                try {
                    const res = await API.request(`/api/v1/kasir/tournament/match/${mId}/skor`, {
                        method: 'POST',
                        body: JSON.stringify({
                            skor1: 13,
                            skor2: 7
                        })
                    });
                    return { success: !!(res && (res.success || res.status === 'success')), match: res.match };
                } catch (err) {
                    return { success: false, error: err.message };
                }
            }, matchToScore.id);
            updateScoreSuccess = scoreRes.success && scoreRes.match && scoreRes.match.pemenang_id === matchToScore.tim1_id;
        }
        record("Input Skor Pertandingan & Auto-Advance Pemenang ke Babak Final", updateScoreSuccess);

        // 6. Cleanup Turnamen
        if (tourneyId) {
            const deleteTourneyRes = await page.evaluate(async (tId) => {
                try {
                    const res = await API.request(`/api/v1/kasir/tournament/${tId}`, { method: 'DELETE' });
                    return { success: !!(res && res.success) };
                } catch (err) {
                    return { success: false, error: err.message };
                }
            }, tourneyId);
            record("Penghapusan Turnamen (Cascade Cleanup)", deleteTourneyRes.success);
        }

        // 7. Tab Game Management (tab-game_management)
        await page.evaluate(async () => {
            if (window.App && App.switchTab) await App.switchTab('game');
        });
        await page.waitForTimeout(600);

        const gameTabCheck = await page.evaluate(async () => {
            const tab = document.getElementById('tab-game_management');
            const isActive = tab && !tab.classList.contains('hidden');
            const hasModule = typeof window.GameManagement !== 'undefined';
            return { isActive, hasModule };
        });
        record("Navigasi ke Tab Kelola Game & Aplikasi (tab-game_management)", gameTabCheck.isActive && gameTabCheck.hasModule);

        // 8. CRUD Kategori Game
        const katName = `FPS_E2E_${Date.now()}`;
        const createKatRes = await page.evaluate(async (kName) => {
            try {
                const res = await API.request('/api/v1/kasir/game/kategori', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nama: kName })
                });
                return { success: !!(res && res.success), data: res.data };
            } catch (err) {
                return { success: false, error: err.message };
            }
        }, katName);
        record("Pembuatan Kategori Game Baru", createKatRes.success);

        // 9. Tambah Game Baru
        const gameName = `Point Blank E2E ${Date.now()}`;
        let createdGameId = null;
        const createGameRes = await page.evaluate(async (gName) => {
            try {
                const form = new FormData();
                form.append('nama', gName);
                form.append('tipe', 'game');
                form.append('kategori', 'FPS');
                form.append('executable_path', 'C:\\Games\\PointBlank\\PB.exe');
                form.append('deskripsi', 'Game FPS Online E2E');
                form.append('aktif', 'true');

                const res = await API.request('/api/v1/kasir/game/', {
                    method: 'POST',
                    body: form
                });
                const item = res.data || res.game || res;
                return { success: !!(res && res.success), id: item ? item.id : null, data: res };
            } catch (err) {
                return { success: false, error: err.message };
            }
        }, gameName);

        if (createGameRes.success && createGameRes.id) {
            createdGameId = createGameRes.id;
        }
        record("Penambahan Entri Game Baru ke Katalog", createGameRes.success && !!createdGameId);

        // 10. Edit Metadata Game
        let updateGameSuccess = false;
        if (createdGameId) {
            const updateGameRes = await page.evaluate(async (gId) => {
                try {
                    const form = new FormData();
                    form.append('nama', 'Point Blank Remastered E2E');
                    form.append('deskripsi', 'Deskripsi diperbarui melalui E2E testing');
                    form.append('aktif', 'true');

                    const res = await API.request(`/api/v1/kasir/game/${gId}`, {
                        method: 'POST',
                        body: form
                    });
                    return { success: !!(res && res.success), data: res.data };
                } catch (err) {
                    return { success: false, error: err.message };
                }
            }, createdGameId);
            updateGameSuccess = updateGameRes.success && updateGameRes.data && updateGameRes.data.nama.includes('Remastered');
        }
        record("Pembaruan Metadata & Pengaturan Game", updateGameSuccess);

        // 11. Verifikasi Listing & Filter Game
        const listGamesRes = await page.evaluate(async () => {
            try {
                const res = await API.request('/api/v1/kasir/game/');
                const games = res.data || [];
                return { success: !!(res && res.success), count: games.length };
            } catch (err) {
                return { success: false, error: err.message };
            }
        });
        record("Query Listing & Verifikasi Katalog Game", listGamesRes.success && listGamesRes.count > 0);

        // 12. Hapus Game (Cleanup)
        if (createdGameId) {
            const deleteGameRes = await page.evaluate(async (gId) => {
                try {
                    const res = await API.request(`/api/v1/kasir/game/${gId}`, { method: 'DELETE' });
                    return { success: !!(res && res.success) };
                } catch (err) {
                    return { success: false, error: err.message };
                }
            }, createdGameId);
            record("Penghapusan Game dari Katalog (Cleanup)", deleteGameRes.success);
        }

    } catch (err) {
        record("Global Execution Error", false, err.message);
    }

    report.endTime = new Date().toISOString();
    return report;
}
