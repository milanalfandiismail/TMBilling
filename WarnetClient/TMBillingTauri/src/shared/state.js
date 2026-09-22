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
    hasPlayed15MinAlert: false,
    hasPlayed5MinAlert: false,
    hasPlayed1MinAlert: false,
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
    allMenus: [],

    // Methods
    setSessionData(data) {
        this.sessionData = { ...this.sessionData, ...data };
        if (data.remainingSeconds !== undefined && data.remainingSeconds !== null) {
            const secs = Number(data.remainingSeconds);
            if (secs > 0 && secs <= 900) {
                this.hasPlayed15MinAlert = true;
            }
            if (secs > 0 && secs <= 300) {
                this.hasPlayed5MinAlert = true;
            }
            if (secs > 0 && secs <= 60) {
                this.hasPlayed1MinAlert = true;
            }
        }
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
        this.hasPlayed15MinAlert = false;
        this.hasPlayed5MinAlert = false;
        this.hasPlayed1MinAlert = false;
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
