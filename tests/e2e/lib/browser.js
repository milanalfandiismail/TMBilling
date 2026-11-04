/**
 * Driver Chromium untuk suite E2E.
 *
 * Prasyarat sekali jalan:
 *   npm install
 *   npx playwright install chromium
 *
 * Mode headed di Windows: `set E2E_HEADED=1` lalu jalankan `npm run test:e2e`.
 * Tidak ada skrip npm terpisah karena `cross-env` bukan dependency repo ini.
 */
const fs = require('fs');

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:7016';
const MISSING_BROWSER_MESSAGE = 'Playwright Chromium belum terpasang. Jalankan: npx playwright install chromium';

class BrowserUnavailableError extends Error {
  constructor(detail = null) {
    super(MISSING_BROWSER_MESSAGE);
    this.name = 'BrowserUnavailableError';
    this.code = 'BROWSER_NOT_AVAILABLE';
    this.detail = detail;
  }
}

function loadChromium() {
  try {
    return require('playwright').chromium;
  } catch (err) {
    throw new BrowserUnavailableError(err.message);
  }
}

async function launchBrowser({ headless } = {}) {
  const chromium = loadChromium();

  // executablePath() tetap mengembalikan path walau binernya belum diunduh.
  const executable = chromium.executablePath();
  if (!fs.existsSync(executable)) {
    throw new BrowserUnavailableError(`Biner Chromium tidak ada di ${executable}`);
  }

  let browser;
  try {
    browser = await chromium.launch({
      headless: headless === undefined ? !process.env.E2E_HEADED : headless,
    });
  } catch (err) {
    if (/Executable doesn't exist|browserType\.launch/i.test(err.message)) {
      throw new BrowserUnavailableError(err.message);
    }
    throw err;
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleMessages = [];
  page.on('pageerror', (err) => pageErrors.push(err.message || String(err)));
  page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));

  return {
    browser,
    context,
    page,
    pageErrors,
    consoleMessages,
    baseUrl: BASE_URL,
    async close() {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    },
  };
}

module.exports = { BASE_URL, MISSING_BROWSER_MESSAGE, BrowserUnavailableError, launchBrowser };
