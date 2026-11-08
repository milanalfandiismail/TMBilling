'use strict';

/**
 * Task 10 — Turnamen, katalog game, catatan, dan CMS dokumentasi.
 *
 * Kontrak tiap check (spec §6): transisi DOM setelah aksi user, baris DB yang
 * dibaca ulang lewat dbQuery, isi berkas nyata di disk sandbox, aritmatika
 * eksak, atau kontrak error. Keberadaan modul/tombol saja bukan check.
 *
 * Kontrak produk yang ditemukan saat menulis suite ini:
 * - Tidak ada endpoint regenerasi bagan. Penolakan yang nyata adalah nama
 *   turnamen duplikat (400) dan `swiss/next` pada turnamen playoff (400);
 *   keduanya diuji sekaligus dengan bukti baris match tidak berubah.
 * - Bagan playoff T=4: ronde 1 berisi 2 match (tim input ke-0 vs ke-1, ke-2
 *   vs ke-3), final 1 match. Pemenang match bernomor ganjil mengisi `tim1_id`
 *   final, genap mengisi `tim2_id`.
 * - Reader dokumentasi menyuntikkan `tutorial.content` sebagai HTML mentah
 *   (tidak ada markdown renderer), jadi marker diuji sebagai elemen HTML.
 * - Sandbox mengisolasi catatan ke direktori yang diberikan TM_NOTES_DIR dan
 *   mengosongkannya tiap run; suite hanya menghapus berkas yang ia buat.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { BASE_URL, login, tab, waitFor, unique, check } = require('./lib/harness');
const { dbQuery, PROJECT_ROOT } = require('./lib/db');
const { createReport, finish } = require('./lib/report');

const NOTES_DIR = path.resolve(
    process.env.TM_NOTES_DIR || path.join(PROJECT_ROOT, 'instance', 'e2e', 'notes')
);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function dbWait(sql, params, predicate, label, timeout = 5000) {
    const deadline = Date.now() + timeout;
    let rows = [];
    while (Date.now() < deadline) {
        rows = await dbQuery(sql, params);
        if (predicate(rows)) return rows;
        await sleep(100);
    }
    throw new Error(`${label} tidak terpenuhi dalam ${timeout}ms; baris terakhir: ${JSON.stringify(rows)}`);
}

async function dbOne(sql, params) {
    const rows = await dbQuery(sql, params);
    return rows[0] || null;
}

/** Seperti `waitFor`, tetapi fn menerima satu argumen dari Node. */
async function waitForArg(page, fn, arg, { timeout = 5000, label } = {}) {
    const deadline = Date.now() + timeout;
    let last;
    while (Date.now() < deadline) {
        last = await page.evaluate(fn, arg);
        if (last) return last;
        await sleep(100);
    }
    throw new Error(`${label || 'kondisi'} tidak terpenuhi dalam ${timeout} ms (nilai terakhir: ${JSON.stringify(last)})`);
}

/** Tunggu sampai dua evaluasi berturut-turut memberi nilai sama (bukan loading). */
async function waitStable(page, fn, { label, timeout = 5000 } = {}) {
    const deadline = Date.now() + timeout;
    let prev = null;
    while (Date.now() < deadline) {
        let cur = null;
        try {
            cur = await page.evaluate(fn);
        } catch (err) {
            cur = null;
        }
        if (cur && JSON.stringify(cur) === JSON.stringify(prev)) return cur;
        prev = cur;
        await sleep(100);
    }
    throw new Error(`${label || 'kondisi'} tidak stabil dalam ${timeout} ms`);
}

async function fsWait(predicate, label, timeout = 5000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        if (predicate()) return;
        await sleep(100);
    }
    throw new Error(`${label} tidak terpenuhi dalam ${timeout} ms`);
}

/** Python menulis berkas catatan dalam mode teks, jadi newline menjadi CRLF di Windows. */
function readNote(filePath) {
    return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

/** POST JSON dengan CSRF dari meta halaman (untuk menguji status HTTP asli). */
async function postJson(page, pathname, payload) {
    const token = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') : '';
    });
    const res = await page.request.post(`${BASE_URL}${pathname}`, {
        headers: { 'X-CSRFToken': token, 'Content-Type': 'application/json' },
        data: payload,
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status(), body };
}

async function publicGames(page, query) {
    const res = await page.request.get(`${BASE_URL}/api/v1/public/game/all?q=${encodeURIComponent(query)}`);
    return res.json();
}

/** Buka modal skor untuk kartu match yang memuat semua nama tim, lalu isi skor. */
async function scoreMatch(page, names, skor1, skor2) {
    let card = page.locator('#stage-view-content div[onclick^="Tournament.openSkorModal"]');
    for (const name of names) card = card.filter({ hasText: name });
    await card.first().click();
    await page.waitForSelector('#modal-input-skor:not(.hidden)', { timeout: 5000 });
    await page.fill('#skor-team1-val', String(skor1));
    await page.fill('#skor-team2-val', String(skor2));
    await page.click('#form-input-skor button[type="submit"]');
    await page.waitForSelector('#modal-input-skor.hidden', { state: 'hidden', timeout: 5000 });
}

/** Tunggu CKEditor (bila vendor termuat) lalu ganti isi editor panduan. */
async function setTutorialContent(page, html) {
    const hasClassicEditor = await page.evaluate(() => typeof ClassicEditor !== 'undefined');
    if (hasClassicEditor) {
        await waitFor(page, () => !!(window.Tutorials && Tutorials.ckeditorInstance), {
            label: 'CKEditor siap',
        });
        await page.evaluate((value) => Tutorials.ckeditorInstance.setData(value), html);
    } else {
        await page.evaluate((value) => {
            document.getElementById('tutorial-content-editor').value = value;
        }, html);
    }
    await page.evaluate(() => {
        if (window.Tutorials && Tutorials.ckeditorInstance) {
            // Pastikan data sudah masuk sebelum tombol simpan ditekan.
            return Tutorials.ckeditorInstance.getData();
        }
        return document.getElementById('tutorial-content-editor').value;
    });
}

async function runTournamentGameE2ETest(page) {
    const report = createReport('E2E: Turnamen, Katalog Game, Catatan & CMS');
    const state = {
        tournamentId: null,
        teams: [],
        matches: [],
        gameId: null,
        gameName: null,
        gameNameEdited: null,
        noteTitle: null,
        noteFilename: null,
        tutorialId: null,
        tutorialTitle: null,
        tutorialTitleEdited: null,
    };

    await login(page, 'admin');

    // =====================================================================
    // 1. Turnamen: buat lewat UI, bagan dibangkitkan, skor meloloskan juara.
    // =====================================================================
    await tab(page, 'tournament');

    const tournamentName = unique('Turnamen E2E');
    const teamNames = ['Alpha', 'Bravo', 'Charlie', 'Delta'].map((suffix) => `${tournamentName} ${suffix}`);
    const [teamA, teamB, teamC, teamD] = teamNames;

    await check(report, 'turnamen: buat 4 tim lewat UI menghasilkan bagan playoff 2+1 match sesuai aturan pairing', async () => {
        await page.click('#tab-tournament button[onclick="Tournament.openCreateModal()"]');
        await page.waitForSelector('#modal-buat-turnamen:not(.hidden)', { timeout: 5000 });
        await page.fill('#create-t-name', tournamentName);
        await page.fill('#create-t-desc', 'Suite E2E Task 10');
        await page.selectOption('#create-t-format', 'playoff');
        await page.selectOption('#create-t-bo', '1');
        await page.fill('#create-t-teams', teamNames.join('\n'));
        await page.click('#form-buat-turnamen button[type="submit"]');

        const rows = await dbWait(
            'SELECT id, nama, status FROM turnamen WHERE nama = ?',
            [tournamentName],
            (r) => r.length === 1 && Number(r[0].id) > 0,
            'turnamen tersimpan di DB'
        );
        state.tournamentId = Number(rows[0].id);
        assert.strictEqual(rows[0].status, 'aktif');

        const teams = await dbQuery(
            'SELECT id, nama_tim FROM turnamen_tim WHERE turnamen_id = ? ORDER BY id',
            [state.tournamentId]
        );
        assert.deepStrictEqual(teams.map((t) => t.nama_tim), teamNames, 'urutan tim harus sama dengan input');
        state.teams = teams;

        const stages = await dbQuery(
            'SELECT id, nama, tipe_format, urutan, status FROM turnamen_tahap WHERE turnamen_id = ?',
            [state.tournamentId]
        );
        assert.strictEqual(stages.length, 1);
        assert.strictEqual(stages[0].tipe_format, 'single_elimination');
        assert.strictEqual(stages[0].status, 'aktif');

        const matches = await dbQuery(
            `SELECT id, round_number, match_number, tim1_id, tim2_id, next_match_id
             FROM turnamen_match WHERE turnamen_id = ? ORDER BY round_number, match_number`,
            [state.tournamentId]
        );
        state.matches = matches;
        assert.strictEqual(matches.length, 3, 'T=4 harus menghasilkan 3 match (2 semifinal + 1 final)');

        const round1 = matches.filter((m) => Number(m.round_number) === 1);
        const round2 = matches.filter((m) => Number(m.round_number) === 2);
        assert.strictEqual(round1.length, 2, 'ronde 1 harus 2 match');
        assert.strictEqual(round2.length, 1, 'ronde 2 harus 1 final');

        // Aturan pairing dibaca dari generate_playoff_bracket: teams[2i] vs teams[2i+1].
        assert.strictEqual(Number(round1[0].tim1_id), Number(teams[0].id));
        assert.strictEqual(Number(round1[0].tim2_id), Number(teams[1].id));
        assert.strictEqual(Number(round1[1].tim1_id), Number(teams[2].id));
        assert.strictEqual(Number(round1[1].tim2_id), Number(teams[3].id));

        // next_match_id kedua semifinal harus menunjuk final yang sama.
        assert.strictEqual(Number(round1[0].next_match_id), Number(round2[0].id));
        assert.strictEqual(Number(round1[1].next_match_id), Number(round2[0].id));
        assert.strictEqual(round2[0].next_match_id, null);

        await waitForArg(page, (nama) => {
            const view = document.getElementById('tournament-detail-view');
            const title = document.getElementById('detail-tournament-name');
            const status = document.getElementById('detail-tournament-status');
            const cards = document.querySelectorAll('#stage-view-content div[onclick^="Tournament.openSkorModal"]');
            if (!view || view.classList.contains('hidden') || !title || !status) return false;
            // textContent, bukan innerText: kedua elemen memakai CSS uppercase.
            return title.textContent.trim() === nama &&
                status.textContent.trim() === 'aktif' &&
                cards.length === 3;
        }, tournamentName, { label: 'detail turnamen tampil dengan 3 kartu bagan' });

        const content = await page.evaluate(() => document.getElementById('stage-view-content').textContent);
        assert.ok(content.includes('Semifinal'), 'kolom Semifinal harus tampil');
        assert.ok(content.includes('Final'), 'kolom Final harus tampil');
    });

    await check(report, 'turnamen: skor semifinal 1 meloloskan pemenang ke tim1 final', async () => {
        const semi1 = state.matches.find((m) => Number(m.round_number) === 1 && Number(m.match_number) === 1);
        assert.ok(semi1, 'semifinal 1 harus ada');

        await scoreMatch(page, [teamA, teamB], 2, 1);

        const saved = await dbWait(
            'SELECT skor1, skor2, pemenang_id FROM turnamen_match WHERE id = ?',
            [semi1.id],
            (r) => r.length === 1 && r[0].pemenang_id !== null,
            'skor semifinal 1 tersimpan'
        );
        assert.strictEqual(Number(saved[0].skor1), 2);
        assert.strictEqual(Number(saved[0].skor2), 1);
        assert.strictEqual(Number(saved[0].pemenang_id), Number(state.teams[0].id));

        const final = await dbWait(
            'SELECT tim1_id, tim2_id FROM turnamen_match WHERE id = ?',
            [semi1.next_match_id],
            (r) => r.length === 1 && r[0].tim1_id !== null,
            'pemenang semifinal 1 masuk final'
        );
        assert.strictEqual(Number(final[0].tim1_id), Number(state.teams[0].id), 'match ganjil mengisi tim1 final');
        assert.strictEqual(final[0].tim2_id, null, 'slot tim2 final belum terisi');

        await waitFor(page, () => {
            const text = document.getElementById('stage-view-content').innerText;
            return text.includes('2') && text.includes('1');
        }, { label: 'skor semifinal tampil di bagan' });
    });

    await check(report, 'turnamen: skor semifinal 2 mengisi tim2 final dengan pemenangnya', async () => {
        const semi2 = state.matches.find((m) => Number(m.round_number) === 1 && Number(m.match_number) === 2);
        assert.ok(semi2, 'semifinal 2 harus ada');

        await scoreMatch(page, [teamC, teamD], 1, 3);

        const saved = await dbWait(
            'SELECT skor1, skor2, pemenang_id FROM turnamen_match WHERE id = ?',
            [semi2.id],
            (r) => r.length === 1 && r[0].pemenang_id !== null,
            'skor semifinal 2 tersimpan'
        );
        assert.strictEqual(Number(saved[0].skor1), 1);
        assert.strictEqual(Number(saved[0].skor2), 3);
        assert.strictEqual(Number(saved[0].pemenang_id), Number(state.teams[3].id));

        const final = await dbWait(
            'SELECT tim1_id, tim2_id FROM turnamen_match WHERE id = ?',
            [semi2.next_match_id],
            (r) => r.length === 1 && r[0].tim1_id !== null && r[0].tim2_id !== null,
            'kedua finalis terisi'
        );
        assert.strictEqual(Number(final[0].tim1_id), Number(state.teams[0].id));
        assert.strictEqual(Number(final[0].tim2_id), Number(state.teams[3].id), 'match genap mengisi tim2 final');

        await waitForArg(page, (names) => {
            const text = document.getElementById('stage-view-content').innerText;
            return text.includes(names[0]) && text.includes(names[1]);
        }, [teamA, teamD], { label: 'nama kedua finalis tampil di kartu final' });
    });

    await check(report, 'turnamen: skor final menyelesaikan turnamen dan juara tercatat', async () => {
        const finalRow = await dbOne(
            'SELECT id FROM turnamen_match WHERE turnamen_id = ? AND round_number = 2',
            [state.tournamentId]
        );
        assert.ok(finalRow, 'match final harus ada');

        await scoreMatch(page, [teamA, teamD], 3, 2);

        const done = await dbWait(
            `SELECT m.skor1, m.skor2, m.pemenang_id, t.status AS status_turnamen, s.status AS status_tahap
             FROM turnamen_match m
             JOIN turnamen t ON t.id = m.turnamen_id
             JOIN turnamen_tahap s ON s.id = m.tahap_id
             WHERE m.id = ?`,
            [finalRow.id],
            (r) => r.length === 1 && r[0].status_turnamen === 'selesai',
            'turnamen selesai setelah final'
        );
        assert.strictEqual(Number(done[0].skor1), 3);
        assert.strictEqual(Number(done[0].skor2), 2);
        assert.strictEqual(Number(done[0].pemenang_id), Number(state.teams[0].id), 'juara harus tim A');
        assert.strictEqual(done[0].status_tahap, 'selesai');

        await waitForArg(page, () => {
            const status = document.getElementById('detail-tournament-status');
            return status && status.innerText.trim().toLowerCase().includes('selesai');
        }, null, { label: 'status turnamen di DOM menjadi selesai' });
    });

    await check(report, 'turnamen: nama duplikat & swiss/next pada playoff ditolak tanpa merusak bagan', async () => {
        const before = await dbQuery(
            `SELECT id, skor1, skor2, pemenang_id, tim1_id, tim2_id
             FROM turnamen_match WHERE turnamen_id = ? ORDER BY id`,
            [state.tournamentId]
        );

        const duplicates = await postJson(page, '/api/v1/kasir/tournament/', {
            nama: tournamentName,
            deskripsi: 'Duplikat',
            tipe_jalur: 'playoff',
            teams: [teamA, teamB],
            bo_format: 1,
        });
        assert.strictEqual(duplicates.status, 400, JSON.stringify(duplicates.body));
        assert.strictEqual(duplicates.body.error, `Turnamen dengan nama '${tournamentName}' sudah ada`);

        const swissNext = await postJson(page, `/api/v1/kasir/tournament/${state.tournamentId}/swiss/next`, {});
        assert.strictEqual(swissNext.status, 400, JSON.stringify(swissNext.body));
        assert.strictEqual(swissNext.body.error, 'Tidak ada Swiss Stage yang sedang aktif pada turnamen ini');

        const countTurnamen = await dbOne('SELECT COUNT(*) AS c FROM turnamen WHERE nama = ?', [tournamentName]);
        assert.strictEqual(Number(countTurnamen.c), 1, 'tidak boleh ada turnamen duplikat');

        const after = await dbQuery(
            `SELECT id, skor1, skor2, pemenang_id, tim1_id, tim2_id
             FROM turnamen_match WHERE turnamen_id = ? ORDER BY id`,
            [state.tournamentId]
        );
        assert.deepStrictEqual(after, before, 'baris match tidak boleh berubah setelah penolakan');
    });

    // =====================================================================
    // 2. Katalog game: CRUD lewat UI + DB + katalog publik.
    // =====================================================================
    await tab(page, 'game_management');

    state.gameName = unique('Game E2E');
    state.gameNameEdited = `${state.gameName} Revisi`;

    await check(report, 'game: tambah lewat UI tersimpan di DB dan muncul di daftar admin', async () => {
        await page.click('#tab-game_management button[onclick="GameManagement.openAddModal()"]');
        await page.waitForSelector('#game-modal:not(.hidden)', { timeout: 5000 });
        assert.strictEqual(await page.isChecked('#form-game-aktif'), true, 'aktif default tercentang');

        await page.fill('#form-game-nama', state.gameName);
        await page.selectOption('#form-game-tipe', 'game');
        await page.fill('#form-game-path', 'C:\\E2E\\game.exe');
        await page.fill('#form-game-argumen', '-e2e');
        await page.fill('#custom-tag-input', 'E2E Kategori');
        await page.press('#custom-tag-input', 'Enter');
        await waitFor(page, () => document.getElementById('selected-category-tags').innerText.includes('E2E Kategori'), {
            label: 'tag kategori terpilih',
        });
        await page.click('#btn-save-game');

        const rows = await dbWait(
            'SELECT id, nama, tipe, kategori, exe_path, argumen, aktif FROM game WHERE nama = ?',
            [state.gameName],
            (r) => r.length === 1,
            'game tersimpan di DB'
        );
        state.gameId = Number(rows[0].id);
        assert.strictEqual(rows[0].tipe, 'game');
        assert.strictEqual(rows[0].exe_path, 'C:\\E2E\\game.exe');
        assert.strictEqual(rows[0].argumen, '-e2e');
        assert.strictEqual(Number(rows[0].aktif), 1);
        assert.ok(String(rows[0].kategori).includes('E2E Kategori'), `kategori: ${rows[0].kategori}`);

        await waitForArg(page, (id) => {
            return window.GameManagement &&
                Array.isArray(GameManagement.games) &&
                GameManagement.games.some((g) => Number(g.id) === Number(id));
        }, state.gameId, { label: 'game masuk daftar admin di memori' });

        const total = await dbOne('SELECT COUNT(*) AS c FROM game');
        const listed = await page.evaluate(() => GameManagement.games.length);
        assert.strictEqual(listed, Number(total.c), 'daftar admin harus memuat seluruh baris game');

        await page.fill('#game-search', state.gameName);
        await waitForArg(page, (nama) => {
            const body = document.getElementById('game-table-body');
            return body && body.innerText.includes(nama);
        }, state.gameName, { label: 'baris game tampil di tabel' });
    });

    await check(report, 'game: edit lewat UI mengubah DB, tabel admin, dan katalog publik', async () => {
        await page.click('#game-table-body button[title="Edit"]');
        await page.waitForSelector('#game-modal:not(.hidden)', { timeout: 5000 });
        assert.strictEqual(await page.inputValue('#form-game-nama'), state.gameName);

        await page.fill('#form-game-nama', state.gameNameEdited);
        await page.fill('#form-game-path', 'C:\\E2E\\game-revisi.exe');
        await page.click('#btn-save-game');

        await dbWait(
            'SELECT nama, exe_path FROM game WHERE id = ?',
            [state.gameId],
            (r) => r.length === 1 && r[0].nama === state.gameNameEdited && r[0].exe_path === 'C:\\E2E\\game-revisi.exe',
            'perubahan game tersimpan di DB'
        );

        await page.fill('#game-search', '');
        await waitForArg(page, (nama) => {
            const body = document.getElementById('game-table-body');
            return body && body.innerText.includes(nama);
        }, state.gameNameEdited, { label: 'nama baru tampil di tabel admin' });

        const total = await dbOne('SELECT COUNT(*) AS c FROM game');
        const listed = await page.evaluate(() => GameManagement.games.length);
        assert.strictEqual(listed, Number(total.c), 'jumlah daftar admin tetap sama dengan DB');

        const catalog = await publicGames(page, state.gameNameEdited);
        assert.strictEqual(catalog.success, true);
        const found = catalog.data.find((g) => Number(g.id) === state.gameId);
        assert.ok(found, 'game hasil edit harus ada di katalog publik');
        assert.strictEqual(found.nama, state.gameNameEdited);
        assert.strictEqual(found.exe_path, 'C:\\E2E\\game-revisi.exe');

        const oldCatalog = await publicGames(page, state.gameName);
        assert.ok(!oldCatalog.data.some((g) => g.nama === state.gameName),
            'tidak boleh ada game dengan nama lama di katalog');
    });

    await check(report, 'game: hapus lewat UI menghapus DB, tabel admin, dan entri katalog publik', async () => {
        await page.fill('#game-search', state.gameNameEdited);
        await waitForArg(page, (nama) => {
            const body = document.getElementById('game-table-body');
            return body && body.innerText.includes(nama);
        }, state.gameNameEdited, { label: 'baris hasil edit tampil sebelum dihapus' });

        page.once('dialog', (dialog) => dialog.accept());
        await page.click('#game-table-body button[title="Hapus"]');

        await dbWait(
            'SELECT id FROM game WHERE id = ?',
            [state.gameId],
            (r) => r.length === 0,
            'game terhapus dari DB'
        );

        const catalog = await publicGames(page, state.gameNameEdited);
        assert.strictEqual(catalog.success, true);
        assert.ok(!catalog.data.some((g) => Number(g.id) === state.gameId), 'katalog publik tidak boleh memuat game terhapus');

        await waitForArg(page, (nama) => {
            const body = document.getElementById('game-table-body');
            return body && !body.innerText.includes(nama);
        }, state.gameNameEdited, { label: 'baris game hilang dari tabel admin' });
    });

    // =====================================================================
    // 3. Catatan: buat lewat UI, berkas nyata, tahan reload, edit, hapus.
    // =====================================================================
    await tab(page, 'catatan');

    state.noteTitle = unique('Catatan E2E');
    const noteContent = `Isi catatan E2E ${state.noteTitle}\nBaris kedua untuk uji persistensi.`;
    const noteContentEdited = `${noteContent}\nBaris tambahan setelah edit.`;

    /** Tunggu editor catatan selesai memuat berkas aktif (bukan 'Memuat...'). */
    const noteReady = () => waitStable(page, () => {
        const titleInput = document.getElementById('note-title-input');
        const status = document.getElementById('note-save-status');
        if (!window.Catatan || !Catatan.activeFilename || !titleInput || !titleInput.value) return null;
        if (status && status.innerText.includes('Memuat')) return null;
        return { filename: Catatan.activeFilename, title: titleInput.value };
    }, { label: 'editor catatan siap' });

    async function openNote(title) {
        const active = await page.evaluate(() => (window.Catatan ? Catatan.activeFilename : null));
        if (active !== `${title}.txt`) {
            const item = page.locator('#notes-list-container div[onclick^="Catatan.selectNote"]', { hasText: title }).first();
            await item.click();
        }
        await waitForArg(page, (expected) => {
            const titleInput = document.getElementById('note-title-input');
            return window.Catatan &&
                Catatan.activeFilename === expected &&
                titleInput && titleInput.value === expected.replace(/\.txt$/i, '');
        }, `${title}.txt`, { label: `catatan "${title}" terbuka` });
    }

    await check(report, 'catatan: buat lewat UI menulis berkas nyata di direktori sandbox dan terbaca setelah reload', async () => {
        assert.ok(fs.existsSync(NOTES_DIR), `direktori catatan sandbox harus ada: ${NOTES_DIR}`);

        await page.click('#tab-catatan button[onclick="Catatan.createNewNote()"]');
        await noteReady();

        await page.fill('#note-title-input', state.noteTitle);
        await page.fill('#note-content-editor', noteContent);
        await page.click('#note-save-status');

        state.noteFilename = `${state.noteTitle}.txt`;
        const notePath = path.join(NOTES_DIR, state.noteFilename);
        await fsWait(() => fs.existsSync(notePath) && readNote(notePath) === noteContent,
            'berkas catatan tersimpan di disk sandbox');
        assert.ok(!fs.existsSync(path.join(PROJECT_ROOT, 'instance', 'notes', state.noteFilename)),
            'berkas tidak boleh ditulis ke instance/notes produksi');

        await waitFor(page, () => {
            const status = document.getElementById('note-save-status');
            return status && status.innerText.includes('Tersimpan');
        }, { label: 'status simpan catatan menjadi Tersimpan' });
        assert.strictEqual(
            await page.evaluate(() => Catatan.activeFilename),
            state.noteFilename,
            'activeFilename harus mengikuti hasil rename server'
        );

        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#tab-dash', { state: 'visible', timeout: 5000 });
        await tab(page, 'catatan');
        await noteReady();
        await openNote(state.noteTitle);

        assert.strictEqual(await page.inputValue('#note-title-input'), state.noteTitle);
        assert.strictEqual(await page.inputValue('#note-content-editor'), noteContent);
        assert.ok(readNote(notePath) === noteContent, 'isi berkas tetap sama setelah reload');
    });

    await check(report, 'catatan: edit isi lewat UI memperbarui berkas yang sama di disk', async () => {
        await openNote(state.noteTitle);
        await page.fill('#note-content-editor', noteContentEdited);
        await page.click('#note-save-status');

        const notePath = path.join(NOTES_DIR, `${state.noteTitle}.txt`);
        await fsWait(() => fs.existsSync(notePath) && readNote(notePath) === noteContentEdited,
            'isi berkas catatan terbarui');
        assert.strictEqual(await page.evaluate(() => Catatan.activeFilename), `${state.noteTitle}.txt`);
    });

    await check(report, 'catatan: hapus lewat UI menghapus berkas dan entri daftar', async () => {
        await openNote(state.noteTitle);
        await page.click('#btn-delete-note');
        await page.waitForSelector('#notes-delete-modal:not(.hidden)', { timeout: 5000 });
        await page.click('#notes-delete-modal button[onclick="Catatan.confirmDeleteNote()"]');

        const notePath = path.join(NOTES_DIR, `${state.noteTitle}.txt`);
        await fsWait(() => !fs.existsSync(notePath), 'berkas catatan terhapus dari disk');
        await waitForArg(page, (title) => {
            const list = document.getElementById('notes-list-container');
            return window.Catatan &&
                !Catatan.activeFilename &&
                list && !list.innerText.includes(title);
        }, state.noteTitle, { label: 'catatan hilang dari daftar dan editor' });
    });

    // =====================================================================
    // 4. CMS dokumentasi: buat, edit, dan hapus panduan lewat halaman wiki.
    // =====================================================================
    await page.goto(`${BASE_URL}/kasir/documentation`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#wiki-sidebar', { state: 'visible', timeout: 5000 });

    state.tutorialTitle = unique('Panduan E2E');
    state.tutorialTitleEdited = `${state.tutorialTitle} Revisi`;
    const markerCreate = `MARKER-CREATE-${Date.now()}`;
    const markerEdit = `MARKER-EDIT-${Date.now()}`;
    const contentCreate = `<h3>Langkah Pertama</h3><p><strong>${markerCreate}</strong> isi panduan awal.</p>`;
    const contentEdit = `<h3>Langkah Revisi</h3><p><strong>${markerEdit}</strong> isi panduan setelah edit.</p>`;

    async function selectTutorialByTitle(title) {
        await page.click(`#wiki-sidebar button:has-text("${title}")`);
        await waitForArg(page, (expected) => {
            const heading = document.querySelector('#wiki-reader-area h2');
            return heading && heading.innerText.trim() === expected;
        }, title, { label: `reader menampilkan "${title}"` });
    }

    await check(report, 'CMS: buat panduan lewat UI tersimpan di DB dan tampil di reader dokumentasi', async () => {
        await page.click('button[onclick="Tutorials.openTutorialModal()"]');
        await page.waitForSelector('#modal-tutorial-editor:not(.hidden)', { timeout: 5000 });

        await page.fill('#tutorial-title-input', state.tutorialTitle);
        await page.fill('#tutorial-urutan-input', '1');
        await setTutorialContent(page, contentCreate);
        await page.click('button[onclick="Tutorials.saveTutorial()"]');

        const rows = await dbWait(
            'SELECT id, title, category, content FROM system_tutorials WHERE title = ?',
            [state.tutorialTitle],
            (r) => r.length === 1,
            'panduan tersimpan di DB'
        );
        state.tutorialId = Number(rows[0].id);
        assert.strictEqual(rows[0].category, 'Umum');
        assert.ok(rows[0].content.includes(markerCreate), `konten DB: ${rows[0].content}`);

        await selectTutorialByTitle(state.tutorialTitle);
        await waitForArg(page, (marker) => {
            const strong = document.querySelector('#wiki-reader-area strong');
            return strong && strong.innerText.includes(marker);
        }, markerCreate, { label: 'marker panduan tampil sebagai elemen HTML di reader' });
        assert.ok((await page.evaluate(() => document.querySelector('#wiki-reader-area h3').innerText)).includes('Langkah Pertama'));
    });

    await check(report, 'CMS: edit panduan bertahan setelah reload dan reader menampilkan judul/isi baru', async () => {
        await selectTutorialByTitle(state.tutorialTitle);
        await page.click('#wiki-reader-area button:has-text("Edit")');
        await page.waitForSelector('#modal-tutorial-editor:not(.hidden)', { timeout: 5000 });
        await setTutorialContent(page, contentEdit);
        await page.fill('#tutorial-title-input', state.tutorialTitleEdited);
        await page.click('button[onclick="Tutorials.saveTutorial()"]');

        await dbWait(
            'SELECT title, content FROM system_tutorials WHERE id = ?',
            [state.tutorialId],
            (r) => r.length === 1 && r[0].title === state.tutorialTitleEdited && r[0].content.includes(markerEdit),
            'perubahan panduan tersimpan di DB'
        );

        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#wiki-sidebar', { state: 'visible', timeout: 5000 });
        await selectTutorialByTitle(state.tutorialTitleEdited);
        await page.waitForSelector('#wiki-reader-area strong', { timeout: 5000 });

        const strong = await page.evaluate(() => document.querySelector('#wiki-reader-area strong').innerText);
        assert.ok(strong.includes(markerEdit), `marker edit harus tampil, dapat: ${strong}`);
        const readerText = await page.evaluate(() => document.getElementById('wiki-reader-area').innerText);
        assert.ok(!readerText.includes(markerCreate), 'marker lama harus hilang dari reader');
    });

    await check(report, 'CMS: hapus panduan lewat UI menghapus DB dan entri sidebar', async () => {
        await selectTutorialByTitle(state.tutorialTitleEdited);

        page.once('dialog', (dialog) => dialog.accept());
        await page.click('#wiki-reader-area button:has-text("Hapus")');

        await dbWait(
            'SELECT id FROM system_tutorials WHERE id = ?',
            [state.tutorialId],
            (r) => r.length === 0,
            'panduan terhapus dari DB'
        );
        await waitForArg(page, (title) => {
            const sidebar = document.getElementById('wiki-sidebar');
            return sidebar && !sidebar.innerText.includes(title);
        }, state.tutorialTitleEdited, { label: 'judul panduan hilang dari sidebar' });
    });

    return finish(report);
}

module.exports = { runTournamentGameE2ETest };
