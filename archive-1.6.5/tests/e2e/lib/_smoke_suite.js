const { createReport, record, finish } = require('./report');
const { BASE_URL } = require('./browser');

/**
 * Bukti bahwa yang menjalankan suite adalah Chromium sungguhan, bukan jsdom:
 * `navigator.webdriver` hanya bernilai true pada browser yang dikemudikan
 * WebDriver/CDP.
 */
module.exports.runSmokeE2ETest = async (page) => {
  const r = createReport('_smoke');

  await page.goto(`${BASE_URL}/kasir/login`, { waitUntil: 'domcontentloaded' });

  record(
    r,
    'chromium benar-benar mengemudikan browser',
    (await page.evaluate(() => navigator.webdriver)) === true,
    'navigator.webdriver harus true'
  );

  record(
    r,
    'form login tampil',
    (await page.isVisible('#username')) &&
      (await page.isVisible('#password')) &&
      (await page.isVisible('#btn-login'))
  );

  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('#btn-login');
  await page.waitForURL(/\/kasir\/?$/, { timeout: 5000 });

  const dashboardVisible = await page
    .waitForSelector('#tab-dash', { state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  record(r, 'login admin masuk dashboard', dashboardVisible);

  return finish(r);
};
