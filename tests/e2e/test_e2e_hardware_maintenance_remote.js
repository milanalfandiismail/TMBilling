'use strict';

/**
 * Task 9 — Ops: telemetri hardware, anti-maling, process list, remote action,
 * screenshot, uptime, maintenance, VNC, dan statistik server.
 *
 * Kontrak tiap check (spec §6): bukti harus berupa transisi DOM setelah aksi
 * user, baris DB yang dibaca ulang lewat dbQuery, aritmatika eksak, atau
 * kontrak error. Keberadaan tombol/modul saja bukan check.
 *
 * Kontrak produk yang ditemukan saat menulis suite ini:
 * - `refresh_processes` dan `kill:<nama>` masuk antrean CEPAT, jadi hanya
 *   keluar di `POST /api/v1/public/client/fast_poll`, BUKAN di `/status`.
 *   `shutdown`/`restart`/`screenshot` memakai antrean reguler `/status`.
 * - Panel proses tidak ada di tab monitor; UI-nya adalah
 *   `DashboardProcessMonitor.showProcesses()` (view di modal detail dashboard).
 * - Baseline hasil seed PC-01 hanya berisi nama komponen (tanpa GpuPnpId),
 *   sehingga penukaran GPU dibuktikan pada PC-02 yang baseline-nya dibentuk
 *   otomatis dari post telemetri pertama (berisi PnpId).
 * - Uptime hanya di-flush ke `pc_uptime_log` oleh scheduler 60 detik yang
 *   tidak hidup di sandbox; check menulis baris sandbox sendiri lalu menuntut
 *   API + DOM menghitung angka yang sama, dan heartbeat tidak menambah baris.
 * - Audit trail remote action ada di file `logs/warnet.log` (bukan tabel DB),
 *   jadi buktinya lewat tab log.
 */

const assert = require('assert');
const { BASE_URL, CLIENT_API_KEY, login, tab, api, clientPoll, hardwarePost, waitFor, unique, check } = require('./lib/harness');
const { dbQuery, dbExec } = require('./lib/db');
const { createReport, finish } = require('./lib/report');

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

/** Panggil `/public/client/fast_poll` seperti agent monitor (antrean cepat). */
async function fastPoll(page, { ip, mac }) {
    const res = await page.request.post(`${BASE_URL}/api/v1/public/client/fast_poll`, {
        headers: { 'X-Client-Key': CLIENT_API_KEY },
        data: { ip_address: ip, mac_address: mac },
    });
    const body = await res.json().catch(() => ({}));
    return { ...body, http_status: res.status() };
}

const HARDWARE_PC1 = {
    cpu_name: 'Intel Core i5-12400F',
    gpu_name: 'NVIDIA GeForce RTX 3060',
    total_ram: 17179869184,
    motherboard: 'ASUS TUF GAMING B660M-PLUS',
    cpu_usage: 12.5,
    cpu_temp: 45,
    gpu_temp: 50,
    nic_speed: 1000,
    active_window: 'Desktop',
};

const HARDWARE_PC2 = {
    cpu_name: 'AMD Ryzen 5 5600',
    gpu_name: 'NVIDIA GeForce RTX 3060',
    total_ram: 17179869184,
    motherboard: 'MSI B550M PRO',
    cpu_usage: 7.5,
    cpu_temp: 40,
    gpu_temp: 44,
    nic_speed: 1000,
    active_window: 'Desktop',
};

const SERIALS_PC2 = {
    CpuId: 'BFEBFBFF000A20F10',
    MotherboardSerial: 'MB-E2E-02',
    GpuPnpId: 'PCI\\VEN_10DE&DEV_2504',
    GpuName: 'NVIDIA GeForce RTX 3060',
    RamSerials: ['RAM-E2E-A1', 'RAM-E2E-A2'],
    DiskSerials: ['DISK-E2E-01'],
};

async function runHardwareMaintenanceRemoteE2ETest(page) {
    const report = createReport('hardware_maintenance_remote');
    const judulTiket = unique('E2E-GPU-SWAP');

    await login(page, 'admin');

    const pcs = await dbQuery('SELECT id, kode FROM pc ORDER BY id');
    const pc1 = pcs.find((p) => p.kode === 'PC-01');
    const pc2 = pcs.find((p) => p.kode === 'PC-02');
    assert.ok(pc1 && pc2, `PC-01/PC-02 harus ada di seed; dapat: ${JSON.stringify(pcs)}`);
    const ip1 = '192.168.1.11';
    const mac1 = '00:11:22:33:44:01';
    const ip2 = '192.168.1.12';
    const mac2 = '00:11:22:33:44:02';

    await check(report, 'telemetri PC-01 cocok baseline: tanpa alert di API & tab hardware_checker', async () => {
        const post = await hardwarePost(page, { ip: ip1, mac: mac1, data: HARDWARE_PC1 });
        assert.strictEqual(post.http_status, 200, `post telemetri gagal: ${JSON.stringify(post)}`);

        const list = await api(page, 'API.monitor.all()');
        const row = (list.data || []).find((r) => r.pc_id === pc1.id);
        assert.ok(row, 'PC-01 harus muncul di /monitor/all');
        assert.strictEqual(row.pc_kode, 'PC-01');
        assert.strictEqual(Number(row.cpu_usage), 12.5, 'metrik CPU harus dari telemetri RAM');
        assert.strictEqual(row.cpu_name, HARDWARE_PC1.cpu_name);
        assert.ok(!row.hardware_mismatch, `PC-01 tidak boleh mismatch: ${row.hardware_mismatch_desc || ''}`);

        await tab(page, 'hardware_checker');
        await waitFor(page, () => {
            const el = document.getElementById('hardware-checker-container');
            return el && el.innerText.includes('PC-01') ? el.innerText : null;
        }, { label: 'kartu PC-01 di tab hardware_checker' });

        const text = await page.evaluate(() => document.getElementById('hardware-checker-container').innerText);
        assert.ok(!/Ditukar/i.test(text), 'tab hardware_checker tidak boleh menandai PC-01 ditukar');
    });

    await check(report, 'hardware_checker: tabel fit tanpa scroll horizontal di lg, xl, 2xl', async () => {
        await tab(page, 'hardware_checker');
        await waitFor(page, () => {
            const el = document.getElementById('hardware-checker-container');
            return el && !el.querySelector('.hw-skeleton-row') && el.innerText.includes('PC-01') ? el.innerText : null;
        }, { label: 'tabel hardware checker selesai dimuat' });

        const original = page.viewportSize();
        const failures = [];
        try {
            for (const width of [1024, 1280, 1536, 1920]) {
                await page.setViewportSize({ width, height: 1080 });
                const size = await page.evaluate(() => {
                    const wrap = document.querySelector('#hardware-checker-container .hardware-checker-table');
                    if (!wrap) return null;
                    const table = wrap.querySelector('table');
                    const headerOverflow = Array.from(table.querySelectorAll('thead th'))
                        .filter((th) => getComputedStyle(th).display !== 'none')
                        .filter((th) => th.scrollWidth > th.clientWidth + 1)
                        .map((th) => `${th.innerText.trim()}: ${th.scrollWidth} > ${th.clientWidth}`);
                    return { client: wrap.clientWidth, scroll: wrap.scrollWidth, headerOverflow };
                });
                assert.ok(size, `viewport ${width}: tabel hardware checker tidak ditemukan`);
                if (size.scroll > size.client + 1) {
                    failures.push(`${width}px: ${size.scroll} > ${size.client}`);
                }
                if (size.headerOverflow.length) {
                    failures.push(`${width}px header: ${size.headerOverflow.join('; ')}`);
                }
            }
        } finally {
            if (original) await page.setViewportSize(original);
        }

        assert.deepStrictEqual(failures, [], `tabel masih discroll horizontal: ${failures.join(' | ')}`);
    });

    await check(report, 'anti-maling: PNP GPU ditukar pada PC-02 tercatat di DB dan badge Ditukar', async () => {
        const first = await hardwarePost(page, {
            ip: ip2, mac: mac2, data: { ...HARDWARE_PC2, HardwareSerials: SERIALS_PC2 },
        });
        assert.strictEqual(first.http_status, 200, `post baseline PC-02 gagal: ${JSON.stringify(first)}`);

        const baselineRows = await dbQuery('SELECT hardware_baseline FROM hardware_monitor WHERE pc_id = ?', [pc2.id]);
        assert.strictEqual(baselineRows.length, 1, 'PC-02 harus punya baris hardware baru');
        const baseline = JSON.parse(baselineRows[0].hardware_baseline || '{}');
        assert.strictEqual(baseline.GpuPnpId, SERIALS_PC2.GpuPnpId, 'baseline otomatis harus menyimpan GpuPnpId');

        const swapped = await hardwarePost(page, {
            ip: ip2,
            mac: mac2,
            data: { ...HARDWARE_PC2, HardwareSerials: { ...SERIALS_PC2, GpuPnpId: 'PCI\\VEN_10DE&DEV_2684' } },
        });
        assert.strictEqual(swapped.http_status, 200, `post tukar GPU gagal: ${JSON.stringify(swapped)}`);

        const rows = await dbWait(
            'SELECT hardware_mismatch, hardware_mismatch_desc FROM hardware_monitor WHERE pc_id = ?',
            [pc2.id],
            (r) => r.length === 1 && Number(r[0].hardware_mismatch) === 1,
            'flag mismatch PC-02 di DB'
        );
        assert.ok(/ditukar/i.test(rows[0].hardware_mismatch_desc || ''), `deskripsi mismatch: ${rows[0].hardware_mismatch_desc}`);

        await tab(page, 'hardware_checker');
        await waitFor(page, () => {
            const el = document.getElementById('hardware-checker-container');
            return el && el.innerText.includes('PC-02') && /Ditukar/i.test(el.innerText) ? el.innerText : null;
        }, { label: 'badge Ditukar untuk PC-02' });
    });

    await check(report, 'process list: trigger & kill sampai ke fast_poll, panel dashboard menampilkan proses', async () => {
        const post = await hardwarePost(page, {
            ip: ip1,
            mac: mac1,
            data: {
                ...HARDWARE_PC1,
                ProcessList: [
                    { name: 'chrome.exe', title: 'Mem: 512 MB' },
                    { name: 'notepad.exe', title: 'Mem: 24 MB' },
                ],
            },
        });
        assert.strictEqual(post.http_status, 200, `post process list gagal: ${JSON.stringify(post)}`);

        const procs = await api(page, `API.request('/api/v1/kasir/monitor/processes/${pc1.id}')`);
        const names = (procs.data || []).map((p) => p.name);
        assert.ok(names.includes('chrome.exe') && names.includes('notepad.exe'), `daftar proses: ${JSON.stringify(names)}`);

        const trig = await api(page, `API.monitor.processesTrigger(${pc1.id})`);
        assert.strictEqual(trig.success, true);
        const pollRefresh = await fastPoll(page, { ip: ip1, mac: mac1 });
        assert.strictEqual(pollRefresh.command, 'refresh_processes', `fast_poll refresh: ${JSON.stringify(pollRefresh)}`);

        const kill = await api(page, `API.monitor.processesKill(${pc1.id}, 'chrome.exe')`);
        assert.strictEqual(kill.success, true);
        const pollKill = await fastPoll(page, { ip: ip1, mac: mac1 });
        assert.strictEqual(pollKill.command, 'kill:chrome.exe', `fast_poll kill: ${JSON.stringify(pollKill)}`);

        await page.evaluate(async (id) => {
            const data = await API.dashboard.pcList();
            DashboardDetailModal.showDetail(id, data);
            DashboardProcessMonitor.showProcesses(id);
        }, pc1.id);
        const panel = await waitFor(page, () => {
            const view = document.getElementById('view-process-list');
            const list = document.getElementById('modal-process-list');
            if (!view || view.classList.contains('hidden') || !list) return null;
            return list.innerText.includes('chrome.exe') ? list.innerText : null;
        }, { label: 'panel proses dashboard menampilkan chrome.exe' });
        assert.ok(panel.includes('notepad.exe'));
        const count = await page.evaluate(() => document.getElementById('modal-pc-count').innerText.trim());
        assert.strictEqual(count, '2 PROSES');
    });

    await check(report, 'remote shutdown: command masuk clientPoll dan tercatat REMOTE_ACTION di tab log', async () => {
        const res = await api(page, `API.monitor.remote(${pc1.id}, 'shutdown')`);
        assert.strictEqual(res.success, true, JSON.stringify(res));

        const poll = await clientPoll(page, { ip: ip1, mac: mac1 });
        assert.strictEqual(poll.command, 'shutdown', `command clientPoll: ${JSON.stringify(poll)}`);

        const emptyPoll = await clientPoll(page, { ip: ip1, mac: mac1 });
        assert.ok(!emptyPoll.command, 'antrean perintah harus habis setelah satu polling');

        await tab(page, 'log');
        const logText = await waitFor(page, () => {
            const el = document.getElementById('log-rows');
            return el && /REMOTE_ACTION/.test(el.innerText) ? el.innerText : null;
        }, { label: 'baris REMOTE_ACTION di tab log' });
        assert.ok(/shutdown/i.test(logText) || /PC-01/.test(logText), 'detail log harus menyebut PC-01/shutdown');
    });

    await check(report, 'screenshot: trigger mengirim command dan kartu PC-01 tampil tanpa gambar', async () => {
        const res = await api(page, `API.request('/api/v1/kasir/monitor/screenshot/trigger/${pc1.id}', { method: 'POST' })`);
        assert.strictEqual(res.success, true, JSON.stringify(res));

        const poll = await clientPoll(page, { ip: ip1, mac: mac1 });
        assert.strictEqual(poll.command, 'screenshot', `command clientPoll: ${JSON.stringify(poll)}`);

        const status = await api(page, `API.request('/api/v1/kasir/monitor/screenshot/status/${pc1.id}')`);
        assert.strictEqual(status.success, true);
        assert.strictEqual(Number(status.mtime), 0, 'belum ada file screenshot');
        assert.ok(!status.screenshot_url, 'URL screenshot harus kosong tanpa upload');

        await tab(page, 'screenshot');
        const cardText = await waitForArg(page, (id) => {
            const card = document.querySelector(`.screenshot-card[data-pcid="${id}"]`);
            return card && card.innerText.includes('PC-01') ? card.innerText : null;
        }, pc1.id, { label: 'kartu screenshot PC-01' });
        assert.ok(/Belum ada screenshot/i.test(cardText), `teks kartu: ${cardText}`);
    });

    await check(report, 'uptime: laporan harian = jumlah baris DB, KPI DOM eksak, heartbeat tidak menambah baris', async () => {
        const [{ d: tanggal }] = await dbQuery("SELECT date('now','localtime') AS d");
        await dbExec('DELETE FROM pc_uptime_log WHERE tanggal = ? AND pc_id IN (?, ?)', [tanggal, pc1.id, pc2.id]);
        await dbExec('INSERT INTO pc_uptime_log (pc_id, tanggal, total_online_seconds, total_billing_seconds) VALUES (?, ?, ?, ?)', [pc1.id, tanggal, 1800, 900]);
        await dbExec('INSERT INTO pc_uptime_log (pc_id, tanggal, total_online_seconds, total_billing_seconds) VALUES (?, ?, ?, ?)', [pc2.id, tanggal, 600, 0]);

        const db = await dbQuery(
            'SELECT COUNT(*) AS n, SUM(total_online_seconds) AS online, SUM(total_billing_seconds) AS billing FROM pc_uptime_log WHERE tanggal = ?',
            [tanggal]
        );
        assert.strictEqual(db[0].n, 2);
        assert.strictEqual(db[0].online, 2400);
        assert.strictEqual(db[0].billing, 900);

        const apiReport = await api(page, `API.uptime.daily('${tanggal}')`);
        assert.strictEqual(apiReport.date, tanggal);
        const sum = (key) => (apiReport.report || []).reduce((acc, r) => acc + Number(r[key]), 0);
        assert.strictEqual(sum('total_online_seconds'), db[0].online);
        assert.strictEqual(sum('total_billing_seconds'), db[0].billing);

        await tab(page, 'uptime');
        const kpi = await waitFor(page, () => {
            const online = document.getElementById('uptime-kpi-total-online');
            const billing = document.getElementById('uptime-kpi-total-billing');
            const body = document.getElementById('uptime-table-body');
            if (!online || !billing || !body) return null;
            return body.innerText.includes('PC-01') ? { online: online.innerText.trim(), billing: billing.innerText.trim() } : null;
        }, { label: 'KPI uptime terisi' });
        assert.strictEqual(kpi.online, '0.7 Jam');
        assert.strictEqual(kpi.billing, '0.3 Jam');

        await hardwarePost(page, { ip: ip1, mac: mac1, data: HARDWARE_PC1 });
        await sleep(300);
        const after = await dbQuery(
            'SELECT COUNT(*) AS n, SUM(total_online_seconds) AS online FROM pc_uptime_log WHERE tanggal = ?',
            [tanggal]
        );
        assert.strictEqual(after[0].n, 2, 'heartbeat tidak boleh menambah baris uptime');
        assert.strictEqual(after[0].online, 2400, 'heartbeat tidak boleh mengubah akumulasi DB');

        await dbExec('DELETE FROM pc_uptime_log WHERE tanggal = ? AND pc_id IN (?, ?)', [tanggal, pc1.id, pc2.id]);
    });

    let tiketId = null;
    await check(report, 'maintenance: tiket BARU -> DIPROSES -> SELESAI tersimpan di DB dan muncul di laporan', async () => {
        await tab(page, 'maintenance');
        await page.evaluate(() => Maintenance.openCreateModal());
        await page.waitForSelector('#modal-create-ticket:not(.hidden)', { timeout: 5000 });
        await page.evaluate((id) => {
            document.getElementById('maint-input-pc-val').value = String(id);
        }, pc2.id);
        await page.selectOption('#maint-input-kategori', 'HARDWARE');
        await page.selectOption('#maint-input-prioritas', 'TINGGI');
        await page.fill('#maint-input-judul', judulTiket);
        await page.fill('#maint-input-deskripsi', 'Pengujian E2E alur perbaikan.');
        await page.evaluate(() => document.getElementById('form-create-ticket').requestSubmit());

        const created = await dbWait(
            'SELECT id, status, biaya FROM maintenance_ticket WHERE judul = ?',
            [judulTiket],
            (r) => r.length === 1 && r[0].status === 'BARU',
            'tiket baru di DB'
        );
        tiketId = created[0].id;
        assert.strictEqual(Number(created[0].biaya), 0);

        await waitForArg(page, (judul) => {
            const tbody = document.getElementById('maintenance-tickets-tbody');
            return tbody && tbody.innerText.includes(judul) ? true : null;
        }, judulTiket, { label: 'baris tiket di tabel maintenance' });

        await page.evaluate((id) => Maintenance.openUpdateModal(id, 'BARU'), tiketId);
        await waitForArg(page, (id) => {
            const el = document.getElementById('maint-update-id');
            return el && el.value === String(id) ? true : null;
        }, tiketId, { label: 'modal update terisi' });
        await page.selectOption('#maint-update-status', 'DIPROSES');
        await page.evaluate(() => document.getElementById('form-update-ticket').requestSubmit());
        await dbWait('SELECT status FROM maintenance_ticket WHERE id = ?', [tiketId], (r) => r.length === 1 && r[0].status === 'DIPROSES', 'status DIPROSES');

        await page.evaluate((id) => Maintenance.openUpdateModal(id, 'DIPROSES'), tiketId);
        await waitFor(page, () => {
            const sel = document.getElementById('maint-update-status');
            return sel && Array.from(sel.options).some((o) => o.value === 'SELESAI') ? true : null;
        }, { label: 'opsi SELESAI tersedia' });
        await page.selectOption('#maint-update-status', 'SELESAI');
        await page.fill('#maint-update-resolusi', 'Thermal paste diganti, suhu normal.');
        await page.fill('#maint-update-biaya', '50000');
        await page.evaluate(() => document.getElementById('form-update-ticket').requestSubmit());

        const done = await dbWait(
            'SELECT status, biaya, resolved_at, resolusi FROM maintenance_ticket WHERE id = ?',
            [tiketId],
            (r) => r.length === 1 && r[0].status === 'SELESAI',
            'status SELESAI'
        );
        assert.strictEqual(Number(done[0].biaya), 50000);
        assert.ok(done[0].resolved_at, 'resolved_at harus terisi');
        assert.ok(/thermal paste/i.test(done[0].resolusi || ''));

        await tab(page, 'laporan_maintenance');
        const finalReport = await waitForArg(page, (judul) => {
            const tbody = document.getElementById('report-maint-tbody');
            return tbody && tbody.innerText.includes(judul) ? tbody.innerText : null;
        }, judulTiket, { label: 'tiket SELESAI di laporan' });
        assert.ok(finalReport.includes(judulTiket), 'tiket selesai harus tampil di laporan perawatan');

        const totals = await api(page, 'API.request("/api/v1/kasir/maintenance/report")');
        const dbSum = await dbQuery("SELECT COALESCE(SUM(biaya), 0) AS total FROM maintenance_ticket WHERE status = 'SELESAI'");
        assert.strictEqual(Number(totals.report.total_biaya), Number(dbSum[0].total), 'total biaya laporan harus sama dengan DB');
        const biayaText = await page.evaluate(() => document.getElementById('report-maint-biaya').innerText);
        assert.ok(biayaText.includes('50.000'), `KPI biaya: ${biayaText}`);
    });

    await check(report, 'remote_server: password VNC dari settings tampil dan proxy PC-01 belum aktif', async () => {
        const [setting] = await dbQuery("SELECT value FROM settings WHERE key = 'vnc_password'");
        assert.ok(setting && setting.value, 'setting vnc_password harus ada');

        await tab(page, 'remote_server');
        const pwd = await waitFor(page, () => {
            const el = document.getElementById('vnc-password-input');
            return el && el.value ? el.value : null;
        }, { label: 'password VNC terisi dari settings' });
        assert.strictEqual(pwd, setting.value);

        const status = await api(page, `API.request('/api/v1/kasir/vnc/client/${pc1.id}/status')`);
        assert.strictEqual(status.success, true);
        assert.strictEqual(status.active, false, 'proxy VNC tidak boleh aktif tanpa start');
    });

    await check(report, 'server_statistic: persen CPU/RAM di DOM sama dengan API server-monitor', async () => {
        const res = await api(page, "API.request('/api/v1/kasir/server-monitor')");
        assert.strictEqual(res.success, true, JSON.stringify(res));
        const data = res.data || {};
        assert.ok(data.cpu && typeof data.cpu.percent === 'number');
        assert.ok(data.ram && typeof data.ram.percent === 'number');

        await tab(page, 'server_statistic');
        const dom = await waitFor(page, () => {
            const cpu = document.getElementById('sm-cpu-val');
            const ram = document.getElementById('sm-ram-val');
            if (!cpu || !ram) return null;
            return /^\d+\.\d%$/.test(cpu.innerText.trim()) && /^\d+\.\d%$/.test(ram.innerText.trim())
                ? { cpu: cpu.innerText.trim(), ram: ram.innerText.trim(), name: document.getElementById('sm-cpu-name').innerText }
                : null;
        }, { label: 'metrik server tampil numerik' });
        assert.strictEqual(dom.cpu, `${data.cpu.percent.toFixed(1)}%`);
        assert.strictEqual(dom.ram, `${data.ram.percent.toFixed(1)}%`);
        assert.strictEqual(dom.name, data.cpu.name);
    });

    return finish(report);
}

module.exports = { runHardwareMaintenanceRemoteE2ETest };
