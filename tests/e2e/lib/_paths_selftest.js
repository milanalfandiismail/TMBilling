const assert = require('assert');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const mode = process.argv[2];

async function main() {
  if (mode === 'prod') {
    process.env.E2E_SANDBOX_DB = path.join(PROJECT_ROOT, 'instance', 'warnet.db');
    const db = require('./db');
    await assert.rejects(() => db.dbQuery('SELECT 1'), /produksi/);
    console.log('paths selftest prod: ok');
    return;
  }

  const sandbox = path.join(PROJECT_ROOT, 'instance', 'e2e', '_paths_selftest', 'warnet.db');
  process.env.E2E_SANDBOX_DB = sandbox;
  const db = require('./db');
  assert.strictEqual(db.SANDBOX_DB_PATH, path.resolve(sandbox));
  console.log('paths selftest sandbox: ok');
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
