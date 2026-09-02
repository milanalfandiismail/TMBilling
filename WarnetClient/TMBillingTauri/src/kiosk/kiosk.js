/**
 * Kiosk Module
 * Handles kiosk mode logic: login, rules, packages display
 */

import { AppState } from '../shared/state.js';
import { Api } from '../shared/api.js';
import { UI } from '../shared/ui.js';
import { formatRupiah, formatDuration } from '../shared/utils.js';
import { ITEMS_PER_PAGE, ITEMS_PER_RULES_PAGE } from '../shared/constants.js';

export const Kiosk = {
    /**
     * Initialize kiosk mode
     */
    async init() {
        this.bindEvents();
        await this.loadWarnetConfig();
    },

    /**
     * Bind kiosk-specific events
     */
    bindEvents() {
        // Login button
        document.getElementById('login-btn').addEventListener('click', () => this.handleLogin());
        document.getElementById('username').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
        document.getElementById('password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });

        // Info tabs
        document.getElementById('tab-rules-btn').addEventListener('click', () => this.switchInfoTab('rules'));
        document.getElementById('tab-packages-btn').addEventListener('click', () => this.switchInfoTab('packages'));
    },

    /**
     * Handle login attempt
     */
    async handleLogin() {
        const user = document.getElementById('username').value.trim();
        const pass = document.getElementById('password').value.trim();

        UI.setLoginLoading(true);

        try {
            const res = await Api.login(user, pass, false);

            if (res.status === "success") {
                AppState.isOverlayActive = true;
                AppState.setSessionData({
                    memberName: res.member_name,
                    group: res.group,
                    remainingSeconds: res.remaining_seconds
                });

                UI.setOverlayData(res);
                UI.showScreen('billing-overlay');
                await Api.switchToOverlay();
            }
        } catch (err) {
            UI.showToast(err);
            UI.shakeLogin();
        } finally {
            UI.setLoginLoading(false);
        }
    },

    /**
     * Switch between Rules and Packages tabs
     */
    switchInfoTab(tab) {
        const rulesPanel = document.getElementById('panel-rules');
        const packagesPanel = document.getElementById('panel-packages');
        const rulesBtn = document.getElementById('tab-rules-btn');
        const packagesBtn = document.getElementById('tab-packages-btn');

        if (!rulesPanel || !packagesPanel) return;

        if (tab === 'rules') {
            rulesPanel.classList.remove('hidden');
            packagesPanel.classList.add('hidden');
            rulesBtn.className = 'flex-1 px-4 py-2 bg-white/10 border border-white/10 text-xs lg:text-sm font-bold rounded-xl text-white transition-all shadow-sm';
            packagesBtn.className = 'flex-1 px-4 py-2 bg-white/5 border border-white/5 text-xs lg:text-sm font-bold rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-all';
        } else {
            rulesPanel.classList.add('hidden');
            packagesPanel.classList.remove('hidden');
            rulesBtn.className = 'flex-1 px-4 py-2 bg-white/5 border border-white/5 text-xs lg:text-sm font-bold rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-all';
            packagesBtn.className = 'flex-1 px-4 py-2 bg-white/10 border border-white/10 text-xs lg:text-sm font-bold rounded-xl text-white transition-all shadow-sm';
        }
    },

    /**
     * Load warnet configuration from backend
     */
    async loadWarnetConfig() {
        try {
            const config = await Api.getWarnetConfig();
            console.log("Warnet config loaded:", config);

            AppState.setWarnetConfig(config);

            // 1. Render Title
            if (config.title) {
                const titleEl = document.getElementById('kiosk-title');
                if (titleEl) titleEl.innerText = config.title;
            }

            // 2. Render QRIS
            const qrisImg = document.getElementById('kiosk-qris-img');
            if (qrisImg) {
                if (config.qris_url) {
                    qrisImg.src = config.qris_url;
                } else {
                    qrisImg.style.display = 'none';
                    const wrapper = qrisImg.parentElement;
                    if (wrapper) {
                        wrapper.innerHTML = `<div class="text-4xl font-black text-neutral-500 font-mono">?</div><div class="text-[9px] text-neutral-500 uppercase tracking-widest mt-2 font-bold">Offline</div>`;
                    }
                }
            }

            // 3. Render Announcement (Rules - CKEditor HTML)
            AppState.announcementHtml = (config.announcement || '').trim();
            this.initRulesUI();

            // 4. Render Packages
            AppState.allPackages = config.paket || [];
            this.initPackagesUI();

        } catch (err) {
            console.error("Gagal memuat konfigurasi warnet (Offline state):", err);
            this.renderOfflineState();
        }
    },

    /**
     * Render offline state when config fails to load
     */
    renderOfflineState() {
        const titleEl = document.getElementById('kiosk-title');
        if (titleEl) titleEl.innerText = "TMBilling";

        const qrisImg = document.getElementById('kiosk-qris-img');
        if (qrisImg) {
            qrisImg.style.display = 'none';
            const qrisCard = qrisImg.closest('.premium-cyber-card');
            if (qrisCard) {
                qrisCard.innerHTML = `<div class="text-center py-4"><div class="text-4xl font-black text-neutral-500 font-mono">?</div><div class="text-[9px] text-neutral-500 uppercase tracking-widest mt-2 font-bold">Offline</div></div>`;
            }
        }

        const rulesContainer = document.getElementById('rules-container');
        if (rulesContainer) {
            rulesContainer.innerHTML = `<p class="text-neutral-500 italic">aturan tidak dapat dimuat</p>`;
        }

        const pagination = document.getElementById('rules-pagination');
        if (pagination) pagination.classList.add('hidden');

        const paketContainer = document.getElementById('paket-list-container');
        if (paketContainer) {
            paketContainer.innerHTML = `<p class="text-neutral-500 italic">tarif tidak dapat dimuat</p>`;
        }
    },

    /**
     * Initialize Rules UI (Direct CKEditor HTML Render)
     */
    initRulesUI() {
        const rulesContainer = document.getElementById('rules-container');
        const pagination = document.getElementById('rules-pagination');
        if (!rulesContainer) return;

        const html = AppState.announcementHtml;
        if (!html) {
            rulesContainer.innerHTML = `<p class="text-neutral-500 text-xs italic">Tidak ada aturan aktif</p>`;
            if (pagination) pagination.classList.add('hidden');
            return;
        }

        // Render pure HTML from CKEditor directly
        rulesContainer.innerHTML = html;
        if (pagination) {
            // Sembunyikan pagination karena rules kini scrollable full content
            pagination.classList.add('hidden');
        }
    },

    /**
     * Initialize Packages UI with group tabs and pagination
     */
    initPackagesUI() {
        if (!AppState.allPackages || AppState.allPackages.length === 0) {
            const paketContainer = document.getElementById('paket-list-container');
            if (paketContainer) paketContainer.innerHTML = `<p class="text-neutral-500 text-xs">Tidak ada paket aktif</p>`;
            return;
        }

        // Extract distinct groups
        const groups = [...new Set(AppState.allPackages.map(p => p.grup || 'Reguler'))];

        // Render tabs
        const tabsContainer = document.getElementById('paket-tabs');
        if (tabsContainer) {
            tabsContainer.innerHTML = groups.map((g, idx) => `
                <button class="paket-tab-btn px-3.5 py-1.5 bg-white/5 border border-white/10 text-xs lg:text-sm font-bold rounded-xl hover:bg-white/10 hover:border-white/20 transition-all text-neutral-400 hover:text-white whitespace-nowrap uppercase" data-group="${g}">
                    ${g.toUpperCase()}
                </button>
            `).join('');

            // Add click listeners
            const tabBtns = tabsContainer.querySelectorAll('.paket-tab-btn');
            tabBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    tabBtns.forEach(b => {
                        b.classList.remove('bg-white/15', 'text-white', 'border-accent', 'shadow-sm');
                        b.classList.add('bg-white/5', 'border-white/10', 'text-neutral-400');
                    });
                    btn.classList.add('bg-white/15', 'text-white', 'border-accent', 'shadow-sm');
                    btn.classList.remove('bg-white/5', 'border-white/10', 'text-neutral-400');
                    AppState.selectedGroup = btn.getAttribute('data-group');
                    AppState.currentPackagePage = 1;
                    this.renderPackages();
                });
            });

            // Select first group by default
            if (tabBtns.length > 0) {
                tabBtns[0].click();
            }
        }

        // Setup pagination button listeners
        const prevBtn = document.getElementById('paket-prev-btn');
        const nextBtn = document.getElementById('paket-next-btn');

        if (prevBtn && !prevBtn.hasListener) {
            prevBtn.addEventListener('click', () => {
                if (AppState.currentPackagePage > 1) {
                    AppState.currentPackagePage--;
                    this.renderPackages();
                }
            });
            prevBtn.hasListener = true;
        }
        if (nextBtn && !nextBtn.hasListener) {
            nextBtn.addEventListener('click', () => {
                if (AppState.currentPackagePage < AppState.totalPackagePages) {
                    AppState.currentPackagePage++;
                    this.renderPackages();
                }
            });
            nextBtn.hasListener = true;
        }
    },

    /**
     * Render packages for current page and selected group
     */
    renderPackages() {
        const filtered = AppState.allPackages.filter(p => (p.grup || 'Reguler') === AppState.selectedGroup);
        const itemsPerPage = ITEMS_PER_PAGE;
        AppState.totalPackagePages = Math.ceil(filtered.length / itemsPerPage) || 1;

        const startIdx = (AppState.currentPackagePage - 1) * itemsPerPage;
        const endIdx = startIdx + itemsPerPage;
        const pageItems = filtered.slice(startIdx, endIdx);

        const container = document.getElementById('paket-list-container');
        if (container) {
            if (pageItems.length === 0) {
                container.innerHTML = `<p class="text-neutral-500 text-xs lg:text-sm">Tidak ada paket</p>`;
            } else {
                container.innerHTML = pageItems.map(p => {
                    const hours = formatDuration(p.durasi_menit);
                    return `
                        <div class="flex items-center justify-between px-3 py-2 bg-white/5 border border-white/5 hover:border-white/10 rounded-xl transition-all">
                            <div class="text-left min-w-0">
                                <p class="text-xs lg:text-sm font-bold text-neutral-200 truncate">${p.nama}</p>
                                <p class="text-[11px] lg:text-xs text-neutral-400 mt-0.5">${hours}</p>
                            </div>
                            <span class="text-xs lg:text-sm font-bold text-accent font-mono shrink-0 ml-2">${formatRupiah(p.harga)}</span>
                        </div>
                    `;
                }).join('');
            }
        }

        // Update pagination UI
        const prevBtn = document.getElementById('paket-prev-btn');
        const nextBtn = document.getElementById('paket-next-btn');
        const pageIndicator = document.getElementById('paket-page-indicator');

        if (pageIndicator) {
            pageIndicator.innerText = `${AppState.currentPackagePage} / ${AppState.totalPackagePages}`;
        }
        if (prevBtn) {
            prevBtn.disabled = AppState.currentPackagePage <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = AppState.currentPackagePage >= AppState.totalPackagePages;
        }
    }
};
