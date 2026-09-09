/**
 * Overlay Module
 * Handles overlay mode logic: timer display, logout, minimize
 */

import { AppState } from '../shared/state.js';
import { Api } from '../shared/api.js';
import { UI } from '../shared/ui.js';
import { formatTime } from '../shared/utils.js';
import { AUDIO_WARNING_PATH, AUDIO_WARNING_VOLUME, TIME_THRESHOLD_5MIN, TIME_THRESHOLD_5MAX, STATUS } from '../shared/constants.js';

export const Overlay = {
    /**
     * Initialize overlay mode
     */
    init() {
        this.bindEvents();
        this.renderQris();
    },

    /**
     * Bind overlay-specific events
     */
    bindEvents() {
        // Logout button
        document.getElementById('logout-btn')?.addEventListener('click', () => this.handleLogout());

        // Minimize button
        document.getElementById('minimize-btn')?.addEventListener('click', () => Api.minimize());

        // Logout confirmation modal
        document.getElementById('logout-cancel-btn')?.addEventListener('click', () => UI.toggleLogoutModal(false));
        document.getElementById('logout-confirm-btn')?.addEventListener('click', () => this.confirmLogout());

        // Control Panel Properties toolbar buttons
        document.getElementById('btn-prop-mouse')?.addEventListener('click', () => Api.openControlPanel('mouse'));
        document.getElementById('btn-prop-sound')?.addEventListener('click', () => Api.openControlPanel('sound'));
        document.getElementById('btn-prop-volume')?.addEventListener('click', () => Api.openControlPanel('volume'));
        document.getElementById('btn-prop-display')?.addEventListener('click', () => Api.openControlPanel('display'));
    },

    /**
     * Render QRIS image from configuration
     */
    async renderQris() {
        const qrisImg = document.getElementById('overlay-qris-img');
        const fallbackEl = document.getElementById('overlay-qris-fallback');
        if (!qrisImg) return;

        let qrisUrl = AppState.warnetConfig?.qris_url || AppState.warnetConfig?.qrisUrl;

        // If not yet available in AppState, fetch from API
        if (!qrisUrl) {
            try {
                const config = await Api.getWarnetConfig();
                if (config) {
                    AppState.setWarnetConfig(config);
                    qrisUrl = config.qris_url;
                }
            } catch (err) {
                console.warn("Gagal memuat konfigurasi QRIS overlay:", err);
            }
        }

        if (qrisUrl) {
            qrisImg.src = qrisUrl;
            qrisImg.classList.remove('hidden');
            if (fallbackEl) fallbackEl.classList.add('hidden');
        } else {
            qrisImg.classList.add('hidden');
            if (fallbackEl) fallbackEl.classList.remove('hidden');
        }
    },

    /**
     * Handle logout button click
     */
    async handleLogout(isForced = false) {
        if (isForced) {
            await this.confirmLogout();
        } else {
            UI.toggleLogoutModal(true);
        }
    },

    /**
     * Confirm and execute logout
     */
    async confirmLogout() {
        UI.toggleLogoutModal(false);

        try {
            await Api.logout();
            this.resetState();
            UI.showScreen('login-screen');

            // Reset inputs
            document.getElementById('username').value = "";
            document.getElementById('password').value = "";

            // Switch to kiosk mode
            await Api.switchToKiosk();
        } catch (err) {
            console.error("Gagal Logout:", err);
            this.resetState();
            UI.showScreen('login-screen');
            await Api.switchToKiosk();
        }
    },

    /**
     * Reset overlay state
     */
    resetState() {
        AppState.resetSession();
        AppState.resetShutdownTimer();
    },

    /**
     * Update timer display
     */
    updateTime(seconds) {
        UI.updateTime(seconds);

        // Trigger 5 minute warning audio
        if (AppState.isOverlayActive &&
            seconds <= TIME_THRESHOLD_5MIN &&
            seconds > TIME_THRESHOLD_5MAX &&
            !AppState.hasPlayed5MinAlert &&
            AppState.currentStatus !== STATUS.ADMIN) {

            AppState.hasPlayed5MinAlert = true;
            this.playWarningAudio();
        }

        // Auto-lock when time runs out (except admin)
        if (AppState.isOverlayActive && seconds <= 0 && AppState.currentStatus !== STATUS.ADMIN) {
            console.log("Waktu habis! Mengunci PC...");
            this.handleLogout(true);
        }
    },

    /**
     * Play warning audio
     */
    playWarningAudio() {
        const alertAudio = new Audio(AUDIO_WARNING_PATH);
        alertAudio.volume = AUDIO_WARNING_VOLUME;
        alertAudio.play().catch(err => {
            console.warn("Berkas audio warning_5min.mp3 belum tersedia atau gagal diputar:", err);
        });
    },

    /**
     * Start shutdown timer
     */
    startShutdownTimer(seconds) {
        if (AppState.shutdownInterval) return;

        AppState.shutdownRemaining = seconds;
        UI.updateShutdownTimer(AppState.shutdownRemaining);

        AppState.shutdownInterval = setInterval(async () => {
            AppState.shutdownRemaining--;
            UI.updateShutdownTimer(AppState.shutdownRemaining);

            if (AppState.shutdownRemaining <= 0) {
                clearInterval(AppState.shutdownInterval);
                AppState.shutdownInterval = null;
                console.log("BOOM! PC SHUTTING DOWN...");
                await Api.forceShutdown();
            }
        }, 1000);
    },

    /**
     * Stop shutdown timer
     */
    stopShutdownTimer() {
        AppState.resetShutdownTimer();
        UI.updateShutdownTimer(0);
    }
};
