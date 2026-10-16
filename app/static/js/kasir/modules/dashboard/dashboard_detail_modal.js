/**
 * Modul Modal Detail PC pada Dashboard Kasir (Unified Facade).
 * Menggabungkan Core Modal, Power Actions, Remote Control (VNC), dan Hardware Specs Audit.
 * Menjamin kompatibilitas penuh 100% pada seluruh pemanggilan onclick/API eksternal.
 */

const DashboardDetailModal = {
    currentPcId: null,
    lastScreenshotTime: null,
    lastScreenshotUrl: null,
    vncSession: null,

    // Core Modal Lifecycle & Actions
    ...(window.DashboardModalCore || {}),

    // Power, WOL & AFK Controls
    ...(window.DashboardModalPower || {}),

    // Remote Control & VNC Viewer
    ...(window.DashboardModalRemote || {}),

    // Hardware Specs & Diagnostics
    ...(window.DashboardModalHardware || {})
};

window.DashboardDetailModal = DashboardDetailModal;
