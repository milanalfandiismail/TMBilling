/**
 * Admin Module
 * Handles admin login modal and admin-specific logic
 */

import { AppState } from '../shared/state.js';
import { Api } from '../shared/api.js';
import { UI } from '../shared/ui.js';

export const Admin = {
    /**
     * Initialize admin module
     */
    init() {
        this.bindEvents();
    },

    /**
     * Bind admin-specific events
     */
    bindEvents() {
        // Admin modal buttons
        document.getElementById('admin-close-btn').addEventListener('click', () => this.handleCancel());
        document.getElementById('admin-login-confirm-btn').addEventListener('click', () => this.handleLogin());

        // Enter key on admin inputs
        document.getElementById('admin-user').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
        document.getElementById('admin-pass').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });
    },

    /**
     * Handle admin login
     */
    async handleLogin() {
        const user = document.getElementById('admin-user').value.trim();
        const pass = document.getElementById('admin-pass').value.trim();

        try {
            const res = await Api.login(user, pass, true);

            if (res.status === "success") {
                // Stop any shutdown timer
                AppState.resetShutdownTimer();

                AppState.isOverlayActive = true;
                AppState.currentStatus = 'admin';

                UI.toggleAdminModal(false);
                UI.setOverlayData(res);
                UI.showScreen('billing-overlay');
                await Api.switchToOverlay();
            }
        } catch (err) {
            UI.showAdminError(err);
        }
    },

    /**
     * Handle admin modal cancel
     */
    async handleCancel() {
        UI.toggleAdminModal(false);

        // Restore previous window mode if was overlay
        if (AppState.wasOverlay) {
            await Api.switchToOverlay();
        }
    },

    /**
     * Show admin modal (called from Rust hotkey)
     */
    show() {
        // Remember current state
        AppState.wasOverlay = !document.getElementById('billing-overlay').classList.contains('hidden');
        UI.toggleAdminModal(true);
    }
};
