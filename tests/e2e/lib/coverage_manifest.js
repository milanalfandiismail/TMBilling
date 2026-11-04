/**
 * Manifest cakupan E2E TMBilling.
 *
 * Manifest ini adalah KLAIM; DOM live adalah kebenarannya. `test_e2e_coverage_matrix.js`
 * mencocokkan keduanya dua arah, jadi menambah container tab tanpa memperbarui
 * berkas ini akan menggagalkan suite `coverage`.
 *
 * Sumber id (dienumerasi dari template nyata, bukan tebakan):
 *   - `app/templates/kasir/tabs/*.html`                        -> 29 container tab
 *   - `app/templates/kasir/server_monitor/server_statistic.html` -> tab-server_statistic
 *   - `app/templates/kasir/settings/plugins.html`               -> tab-plugins
 *   - `app/templates/kasir/index.html`                          -> tab-plugin-spa
 *   - `app/templates/kasir/tabs/settings.html` + `settings/migration.html` -> 10 `#subtab-*`
 *   - `app/templates/kasir/components/sidebar*.html`            -> 41 nilai `data-tab`
 */

/**
 * Pemilik tiap container `#tab-<id>`.
 * `null` berarti belum ada suite yang menguji tab tersebut; suite `coverage`
 * akan gagal dengan pesan `tab <id> belum punya suite E2E`.
 *
 * Catatan: `plugin-spa` tidak tercantum di peta suite spec §7. Tab ini dibuka
 * dari tombol plugin di sidebar (`App.openPluginSPA`) sehingga dibina oleh
 * `settings_admin_logs`, yang juga memverifikasi container + iframe-nya.
 */
const tabs = {
  dash: 'pc_billing',
  pc: 'pc_billing',
  blackout: 'pc_billing',

  member: 'member_paket',
  paket: 'member_paket',
  grup: 'member_paket',

  menu: 'fnb_pos',
  menu_stock_log: 'fnb_pos',
  laporan_menu: 'fnb_pos',
  struk: 'fnb_pos',

  monitor: 'hardware_maintenance_remote',
  hardware_checker: 'hardware_maintenance_remote',
  uptime: 'hardware_maintenance_remote',
  screenshot: 'hardware_maintenance_remote',
  maintenance: 'hardware_maintenance_remote',
  laporan_maintenance: 'hardware_maintenance_remote',
  remote_server: 'hardware_maintenance_remote',

  tournament: 'tournament_game',
  game_management: 'tournament_game',

  settings: 'settings_admin_logs',
  user: 'settings_admin_logs',
  user_logs: 'settings_admin_logs',
  log: 'settings_admin_logs',
  laporan: 'settings_admin_logs',
  analytics: 'settings_admin_logs',
  mikrotik: 'settings_admin_logs',
  plugins: 'settings_admin_logs',
  server_statistic: 'settings_admin_logs',
  fileexplorer: 'settings_admin_logs',
  'plugin-spa': 'settings_admin_logs',

  catatan: 'auth_shift_notes',
  shift_history: 'auth_shift_notes',
};

/** Sub-tab settings yang punya container `#subtab-<nama>`. */
const settingsSubtabs = [
  'general',
  'payment',
  'kiosk',
  'whitelist_ip',
  'cloudflare_tunnel',
  'scheduler',
  'cloud_backup',
  'local_backup',
  'db_cleanup',
  'migration',
];

/**
 * Portal publik: `path` + selector root yang wajib ada setelah render.
 * Dua portal tanpa id stabil memakai `main > section` (tanpa menambah markup).
 */
const portals = [
  { path: '/', root: 'main > section' },
  { path: '/tv', root: '#pc-groups-row' },
  { path: '/tv/static', root: '#pc-groups-row' },
  { path: '/livepc', root: '#pc-container' },
  { path: '/member/login', root: '#btn-login' },
  { path: '/games', root: '#game-grid' },
  { path: '/paket', root: 'main > section' },
  { path: '/spesifikasi', root: '#specs-toolbar' },
];

module.exports = { tabs, settingsSubtabs, portals };
