/**
 * Shared State Manager
 * Central state management untuk Kiosk dan Overlay mode
 */

export const AppState = {
    // Mode state
    isOverlayActive: false,
    currentStatus: null, // 'kosong' | 'aktif' | 'admin' | 'error'

    // Session data
    sessionData: {
        memberName: null,
        group: null,
        remainingSeconds: 0,
        pcKode: null
    },

    // Network info
    networkInfo: {
        ip: null,
        mac: null
    },

    // Warnet config
    warnetConfig: {
        title: 'TMBilling',
        qrisUrl: null,
        announcement: null,
        packages: []
    },

    // Timer state
    hasPlayed5MinAlert: false,
    shutdownInterval: null,
    shutdownRemaining: 0,

    // UI state
    wasOverlay: false,

    // Rules & Packages pagination
    allRules: [],
    currentRulesPage: 1,
    totalRulesPages: 1,

    allPackages: [],
    currentPackagePage: 1,
    totalPackagePages: 1,
    selectedGroup: 'Reguler',

    // Methods
    setSessionData(data) {
        this.sessionData = { ...this.sessionData, ...data };
    },

    setNetworkInfo(ip, mac) {
        this.networkInfo = { ip, mac };
    },

    setWarnetConfig(config) {
        this.warnetConfig = { ...this.warnetConfig, ...config };
    },

    resetSession() {
        this.isOverlayActive = false;
        this.currentStatus = null;
        this.hasPlayed5MinAlert = false;
        this.sessionData = {
            memberName: null,
            group: null,
            remainingSeconds: 0,
            pcKode: null
        };
    },

    resetShutdownTimer() {
        if (this.shutdownInterval) {
            clearInterval(this.shutdownInterval);
            this.shutdownInterval = null;
        }
        this.shutdownRemaining = 0;
    }
};
