/**
 * Suite internal `_harness`: membuktikan harness bersama (browser + DB + API) bekerja.
 *
 * Require harness dilakukan malas di dalam runner supaya registry CLI tetap bisa
 * dimuat ketika berkas harness belum ada — kegagalannya tercatat sebagai check
 * biasa, bukan crash di luar laporan.
 */
const { createReport, finish } = require('./report');

async function runHarnessE2ETest(page) {
  const { login, clientPoll, api, check } = require('./harness');
  const { dbQuery } = require('./db');
  const report = createReport('_harness');

  await check(report, 'login admin mencapai dashboard', async () => {
    await login(page, 'admin');
    if (!/\/kasir\/?$/.test(new URL(page.url()).pathname)) {
      throw new Error(`URL setelah login: ${page.url()}`);
    }
  });

  await check(report, 'dbQuery menghitung 5 PC seed', async () => {
    const rows = await dbQuery('SELECT COUNT(*) AS n FROM pc');
    if (!rows.length || Number(rows[0].n) !== 5) {
      throw new Error(`harapan 5 baris, dapat ${JSON.stringify(rows)}`);
    }
  });

  await check(report, 'clientPoll mendeteksi PC-01 dari IP 192.168.1.11', async () => {
    const body = await clientPoll(page, { ip: '192.168.1.11', mac: '00:11:22:33:44:01' });
    if (body.pc_kode !== 'PC-01') {
      throw new Error(`respons: ${JSON.stringify(body).slice(0, 300)}`);
    }
  });

  await check(report, 'api("API.pc.list()") mengembalikan >= 5 PC', async () => {
    const res = await api(page, 'API.pc.list()');
    const list = res && Array.isArray(res.pc_list) ? res.pc_list : [];
    if (list.length < 5) throw new Error(`pc_list berisi ${list.length} entri`);
  });

  return finish(report);
}

module.exports = { runHarnessE2ETest };
