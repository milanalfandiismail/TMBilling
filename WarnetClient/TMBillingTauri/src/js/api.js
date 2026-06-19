const { invoke } = window.__TAURI__.tauri;
const { listen } = window.__TAURI__.event;

/**
 * Jembatan Komunikasi ke Backend Rust
 */
export const Api = {
    // Ambil Info Network (IP/MAC)
    async getNetworkInfo() {
        return await invoke('get_network_info');
    },

    // Proses Login ke Server
    async login(username, password, isAdmin = false) {
        return await invoke('login_process', { username, password, isAdmin: isAdmin });
    },

    // Logout ke Server
    async logout() {
        return await invoke('logout_process');
    },

    // Window Management
    async switchToOverlay() {
        return await invoke('switch_to_overlay');
    },

    async switchToKiosk() {
        return await invoke('switch_to_kiosk');
    },

    async minimize() {
        return await invoke('minimize_window');
    },

    async setWindowFullscreen(fullscreen) {
        return await invoke('set_window_fullscreen', { fullscreen });
    },

    async forceShutdown() {
        return await invoke('force_shutdown');
    },

    async getExternalBg() {
        return await invoke('get_external_bg');
    },

    async getWarnetConfig() {
        return await invoke('get_client_warnet');
    },

    // Listener Event dari Rust
    async onEvent(name, callback) {
        return await listen(name, (event) => callback(event.payload));
    }
};
