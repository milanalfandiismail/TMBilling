/**
 * E2E Test Suite - Public Portals & CMS Documentation
 * 
 * Verifies:
 * 1. CMS Interactive Documentation (/kasir/documentation).
 * 2. Public Landing Page (/ or /info).
 * 3. TV Signage Billboard (/tv).
 * 4. TV Static Signage Fallback (/tv/static).
 * 5. Public Live PC Availability & Scoreboard (/livepc).
 * 6. Public Member Kiosk Login (/member/login).
 * 7. Public Games Showcase (/games).
 * 8. Public Billing Packages Pricing (/paket).
 * 9. Public PC Specs Showcase (/spesifikasi).
 */

async function runPublicPortalsCMSE2ETest(page) {
    const results = [];
    const record = (name, passed, message = '') => {
        results.push({ name, passed, message });
        console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name}${message ? ': ' + message : ''}`);
    };

    const BASE_URL = 'http://127.0.0.1:7016';

    try {
        console.log('--- Step 1: CMS Documentation (/kasir/documentation) ---');
        const docRes = await page.goto(`${BASE_URL}/kasir/documentation`, { waitUntil: 'networkidle' });
        const docOk = docRes && docRes.status() === 200;
        const hasDocContent = await page.evaluate(() => {
            return document.body.innerText.length > 50;
        });
        record('CMS Documentation Page Load (HTTP 200)', docOk && hasDocContent, `Status: ${docRes ? docRes.status() : 'none'}`);

        console.log('--- Step 2: Public Landing Page (/) ---');
        const landingRes = await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
        const landingOk = landingRes && landingRes.status() === 200;
        const hasLandingContent = await page.evaluate(() => {
            return document.body.innerText.length > 50;
        });
        record('Public Landing Page Load (HTTP 200)', landingOk && hasLandingContent, `Status: ${landingRes ? landingRes.status() : 'none'}`);

        console.log('--- Step 3: TV Signage Billboard (/tv) ---');
        const tvRes = await page.goto(`${BASE_URL}/tv`, { waitUntil: 'networkidle' });
        const tvOk = tvRes && tvRes.status() === 200;
        const hasTvContainer = await page.evaluate(() => {
            return !!document.getElementById('tv-container') || !!document.querySelector('.tv-container') || document.body.innerText.length > 20;
        });
        record('TV Signage Billboard Page Load (HTTP 200)', tvOk && hasTvContainer);

        console.log('--- Step 4: TV Static Signage Fallback (/tv/static) ---');
        const tvStaticRes = await page.goto(`${BASE_URL}/tv/static`, { waitUntil: 'networkidle' });
        const tvStaticOk = tvStaticRes && tvStaticRes.status() === 200;
        record('TV Static Fallback Load (HTTP 200)', tvStaticOk);

        console.log('--- Step 5: Live PC Availability & Scoreboard (/livepc) ---');
        const livepcRes = await page.goto(`${BASE_URL}/livepc`, { waitUntil: 'networkidle' });
        const livepcOk = livepcRes && livepcRes.status() === 200;
        const hasLivepcGrid = await page.evaluate(() => {
            return document.body.innerText.length > 20;
        });
        record('Live PC Scoreboard Page Load (HTTP 200)', livepcOk && hasLivepcGrid);

        console.log('--- Step 6: Public Member Kiosk Login (/member/login) ---');
        const memberLoginRes = await page.goto(`${BASE_URL}/member/login`, { waitUntil: 'networkidle' });
        const memberLoginOk = memberLoginRes && memberLoginRes.status() === 200;
        const hasMemberForm = await page.evaluate(() => {
            const inputs = document.querySelectorAll('input');
            return inputs.length >= 1;
        });
        record('Member Kiosk Login Page Load (HTTP 200)', memberLoginOk && hasMemberForm);

        console.log('--- Step 7: Public Games Showcase (/games) ---');
        const gamesRes = await page.goto(`${BASE_URL}/games`, { waitUntil: 'networkidle' });
        const gamesOk = gamesRes && gamesRes.status() === 200;
        const hasGamesList = await page.evaluate(() => {
            return document.body.innerText.length > 20;
        });
        record('Public Games Showcase Load (HTTP 200)', gamesOk && hasGamesList);

        console.log('--- Step 8: Public Billing Packages Pricing (/paket) ---');
        const paketRes = await page.goto(`${BASE_URL}/paket`, { waitUntil: 'networkidle' });
        const paketOk = paketRes && paketRes.status() === 200;
        const hasPaketCards = await page.evaluate(() => {
            return document.body.innerText.length > 20;
        });
        record('Public Billing Packages Load (HTTP 200)', paketOk && hasPaketCards);

        console.log('--- Step 9: Public PC Specs Showcase (/spesifikasi) ---');
        const specsRes = await page.goto(`${BASE_URL}/spesifikasi`, { waitUntil: 'networkidle' });
        const specsOk = specsRes && specsRes.status() === 200;
        const hasSpecsContent = await page.evaluate(() => {
            return document.body.innerText.length > 20;
        });
        record('Public PC Specs Showcase Load (HTTP 200)', specsOk && hasSpecsContent);

        const cardsCount = await page.evaluate(() => {
            return document.querySelectorAll('.pc-spec-card').length;
        });
        record('PC Spec Cards Rendered', cardsCount > 0, `Count: ${cardsCount}`);

        if (cardsCount > 0) {
            // Click first card to open modal
            await page.click('.pc-spec-card');
            await page.waitForTimeout(100);

            const modalState = await page.evaluate(() => {
                const modal = document.getElementById('spec-modal');
                const isVisible = modal && !modal.classList.contains('hidden');
                const kode = document.getElementById('modal-pc-kode') ? document.getElementById('modal-pc-kode').textContent : '';
                const cpu = document.getElementById('modal-cpu-name') ? document.getElementById('modal-cpu-name').textContent : '';
                return { isVisible, kode, cpu };
            });
            record('PC Spec Modal Opens on Card Click', modalState.isVisible && modalState.kode.length > 0, `PC: ${modalState.kode}`);

            // Close via close button
            await page.click('#spec-modal-close');
            await page.waitForTimeout(100);
            const isClosed = await page.evaluate(() => {
                const modal = document.getElementById('spec-modal');
                return modal && modal.classList.contains('hidden');
            });
            record('PC Spec Modal Closes on Close Button', isClosed);

            // Open again and close via Escape
            await page.click('.pc-spec-card');
            await page.waitForTimeout(100);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(100);
            const isClosedEsc = await page.evaluate(() => {
                const modal = document.getElementById('spec-modal');
                return modal && modal.classList.contains('hidden');
            });
            record('PC Spec Modal Closes on Escape Key', isClosedEsc);

            // Test Debounced Search & Filtering
            await page.fill('#specs-search-input', '01');
            await page.waitForTimeout(350); // wait for 250ms debounce

            const searchFilterState = await page.evaluate(() => {
                const visibleCards = Array.from(document.querySelectorAll('.pc-spec-card:not(.hidden)'));
                const hiddenCards = Array.from(document.querySelectorAll('.pc-spec-card.hidden'));
                const clearBtn = document.getElementById('specs-search-clear');
                const clearVisible = clearBtn && !clearBtn.classList.contains('hidden');
                return {
                    visibleCount: visibleCards.length,
                    hiddenCount: hiddenCards.length,
                    clearVisible,
                    allVisibleCodesMatch: visibleCards.every(c => (c.getAttribute('data-pc-kode') || '').includes('01') || (c.getAttribute('data-pc-kode') || '').includes('1'))
                };
            });
            record('PC Specs Debounced Search Filters Cards', searchFilterState.clearVisible && searchFilterState.visibleCount > 0 && searchFilterState.allVisibleCodesMatch, `Visible: ${searchFilterState.visibleCount}`);

            // Clear via clear button
            await page.click('#specs-search-clear');
            await page.waitForTimeout(100);
            const clearState = await page.evaluate(() => {
                const inputVal = document.getElementById('specs-search-input').value;
                const visibleCards = Array.from(document.querySelectorAll('.pc-spec-card:not(.hidden)'));
                return { inputVal, visibleCount: visibleCards.length };
            });
            record('PC Specs Clear Button Restores All Cards', clearState.inputVal === '' && clearState.visibleCount > searchFilterState.visibleCount);

            // Test Non-existent search shows Empty State
            await page.fill('#specs-search-input', 'XYZ999');
            await page.waitForTimeout(350);
            const emptyState = await page.evaluate(() => {
                const emptyEl = document.getElementById('specs-empty-search');
                const isVisible = emptyEl && !emptyEl.classList.contains('hidden');
                const visibleCards = document.querySelectorAll('.pc-spec-card:not(.hidden)');
                return { isVisible, visibleCardsCount: visibleCards.length };
            });
            record('PC Specs Empty State Shown on No Match', emptyState.isVisible && emptyState.visibleCardsCount === 0);

            // Reset via Empty State reset button
            await page.click('#specs-empty-search button');
            await page.waitForTimeout(100);
            const resetState = await page.evaluate(() => {
                const emptyEl = document.getElementById('specs-empty-search');
                const isHidden = emptyEl && emptyEl.classList.contains('hidden');
                const inputVal = document.getElementById('specs-search-input').value;
                const visibleCards = document.querySelectorAll('.pc-spec-card:not(.hidden)');
                return { isHidden, inputVal, count: visibleCards.length };
            });
            record('PC Specs Empty State Reset Button Restores Cards', resetState.isHidden && resetState.inputVal === '' && resetState.count > 0);
        }

    } catch (err) {
        console.error('Fatal error in Public Portals & CMS E2E test:', err);
        record('Execution Flow', false, err.message);
    }

    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;

    return { total: results.length, passed: passedCount, failed: failedCount, results };
}

if (typeof module !== 'undefined') {
    module.exports = { runPublicPortalsCMSE2ETest };
}
