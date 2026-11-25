//! Router aplikasi: aset embed, health publik, dan guard whitelist.

use crate::assets::StaticAssets;
use crate::middleware::{csrf, whitelist};
use crate::routes::arsip::arsip_routes;
use crate::routes::auth::auth_kasir;
use crate::routes::backup::backup_routes;
use crate::routes::blackout::blackout_routes;
use crate::routes::client::client_routes;
use crate::routes::dashboard::dashboard_routes;
use crate::routes::game::{game_public_routes, game_routes};
use crate::routes::grup::grup_routes;
use crate::routes::hardware::uptime_routes;
use crate::routes::maintenance::maintenance_routes;
use crate::routes::member::member_routes;
use crate::routes::menu::menu_routes;
use crate::routes::mikrotik::mikrotik_routes;
use crate::routes::monitor::monitor_routes;
use crate::routes::notes::note_routes;
use crate::routes::pages;
use crate::routes::paket::paket_routes;
use crate::routes::pc::pc_routes;
use crate::routes::public::health;
use crate::routes::public::member_portal;
use crate::routes::public::tv_public_routes;
use crate::routes::report::report_routes;
use crate::routes::server_monitor::server_monitor_routes;
use crate::routes::sesi::sesi_routes;
use crate::routes::settings::client_update_routes;
use crate::routes::settings::database_routes;
use crate::routes::settings::migration_routes;
use crate::routes::settings::network_routes;
use crate::routes::settings::settings_routes;
use crate::routes::shift::shift_routes;
use crate::routes::tournament::tournament_routes;
use crate::routes::tutorial::tutorial_routes;
use crate::routes::user::user_routes;
use crate::routes::vnc::vnc_routes;
use crate::state::AppState;
use axum::body::Body;
use axum::extract::{DefaultBodyLimit, Path};
use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post, put};
use axum::Router;
use std::sync::Arc;

const IMMUTABLE: &str = "public, max-age=31536000, immutable";

pub fn router(state: Arc<AppState>) -> Router {
    let kasir_api = Router::new()
        .route("/api/v1/kasir/auth/login", post(auth_kasir::login))
        .route("/api/v1/kasir/auth/logout", post(auth_kasir::logout))
        .route("/api/v1/kasir/auth/check", get(auth_kasir::check))
        .route(
            "/api/v1/kasir/auth/admin-check",
            post(auth_kasir::admin_check),
        )
        .route(
            "/api/v1/kasir/user",
            get(user_routes::list).post(user_routes::create),
        )
        .route(
            "/api/v1/kasir/user/",
            get(user_routes::list).post(user_routes::create),
        )
        .route(
            "/api/v1/kasir/user/{id}",
            get(user_routes::get_one)
                .put(user_routes::update)
                .delete(user_routes::delete),
        )
        .route(
            "/api/v1/kasir/user/{id}/archive",
            post(user_routes::archive),
        )
        .route(
            "/api/v1/kasir/user/{id}/restore",
            post(user_routes::restore),
        )
        .route(
            "/api/v1/kasir/user/{id}/reset-kuota",
            post(user_routes::reset_kuota),
        )
        .route("/api/v1/kasir/settings", get(settings_routes::get_all))
        .route("/api/v1/kasir/settings/", get(settings_routes::get_all))
        .route(
            "/api/v1/kasir/settings/auto-shutdown",
            put(settings_routes::auto_shutdown),
        )
        .route(
            "/api/v1/kasir/settings/client-polling-interval",
            put(settings_routes::client_polling_interval),
        )
        .route(
            "/api/v1/kasir/settings/apikey",
            put(settings_routes::apikey),
        )
        .route(
            "/api/v1/kasir/settings/timezone",
            put(settings_routes::timezone),
        )
        .route(
            "/api/v1/kasir/settings/ip-whitelist/regenerate-token",
            post(settings_routes::regenerate_token),
        )
        .route(
            "/api/v1/kasir/settings/{key}",
            get(settings_routes::get_one).put(settings_routes::put_one),
        )
        .route(
            "/api/v1/kasir/settings/client-update",
            get(client_update_routes::get_info).delete(client_update_routes::delete_package),
        )
        .route(
            "/api/v1/kasir/settings/client-update/upload",
            post(client_update_routes::upload_package)
                .layer(DefaultBodyLimit::max(256 * 1024 * 1024)),
        )
        .route(
            "/api/v1/kasir/settings/client-update/broadcast",
            post(client_update_routes::broadcast_update),
        )
        .route(
            "/api/v1/kasir/grup",
            get(grup_routes::list).post(grup_routes::create),
        )
        .route(
            "/api/v1/kasir/grup/",
            get(grup_routes::list).post(grup_routes::create),
        )
        .route(
            "/api/v1/kasir/grup/{id}",
            put(grup_routes::update).delete(grup_routes::hapus),
        )
        .route(
            "/api/v1/kasir/grup/{id}/archive",
            post(grup_routes::archive),
        )
        .route(
            "/api/v1/kasir/grup/{id}/restore",
            post(grup_routes::restore),
        )
        .route(
            "/api/v1/kasir/paket",
            get(paket_routes::list).post(paket_routes::create),
        )
        .route(
            "/api/v1/kasir/paket/",
            get(paket_routes::list).post(paket_routes::create),
        )
        .route(
            "/api/v1/kasir/paket/{id}",
            put(paket_routes::update).delete(paket_routes::hapus),
        )
        .route(
            "/api/v1/kasir/paket/{id}/archive",
            post(paket_routes::archive),
        )
        .route(
            "/api/v1/kasir/paket/{id}/restore",
            post(paket_routes::restore),
        )
        .route(
            "/api/v1/kasir/pc",
            get(pc_routes::list).post(pc_routes::create),
        )
        .route(
            "/api/v1/kasir/pc/",
            get(pc_routes::list).post(pc_routes::create),
        )
        .route("/api/v1/kasir/pc/batch", post(pc_routes::batch))
        .route("/api/v1/kasir/pc/wol", post(pc_routes::wol))
        .route(
            "/api/v1/kasir/pc/{id}",
            get(pc_routes::get_one)
                .put(pc_routes::update)
                .delete(pc_routes::hapus),
        )
        .route("/api/v1/kasir/pc/{id}/archive", post(pc_routes::archive))
        .route("/api/v1/kasir/pc/{id}/restore", post(pc_routes::restore))
        .route("/api/v1/kasir/pc/{id}/position", put(pc_routes::position))
        .route(
            "/api/v1/kasir/pc/reset-admin/{id}",
            post(pc_routes::reset_admin),
        )
        .route(
            "/api/v1/kasir/game",
            get(game_routes::list).post(game_routes::create),
        )
        .route(
            "/api/v1/kasir/game/",
            get(game_routes::list).post(game_routes::create),
        )
        .route(
            "/api/v1/kasir/game/kategori",
            get(game_routes::kategori_list).post(game_routes::kategori_create),
        )
        .route(
            "/api/v1/kasir/game/kategori/{id}",
            axum::routing::delete(game_routes::kategori_hapus),
        )
        .route(
            "/api/v1/kasir/game/{id}",
            post(game_routes::update)
                .put(game_routes::update)
                .delete(game_routes::hapus),
        )
        .route(
            "/api/v1/kasir/game/{id}/archive",
            post(game_routes::archive),
        )
        .route(
            "/api/v1/kasir/game/{id}/restore",
            post(game_routes::restore),
        )
        .route(
            "/api/v1/kasir/menu",
            get(menu_routes::list).post(menu_routes::create),
        )
        .route(
            "/api/v1/kasir/menu/",
            get(menu_routes::list).post(menu_routes::create),
        )
        .route("/api/v1/kasir/menu/archived", get(menu_routes::archived))
        .route("/api/v1/kasir/menu/checkout", post(menu_routes::checkout))
        .route(
            "/api/v1/kasir/menu/stock-logs",
            get(menu_routes::stock_logs),
        )
        .route(
            "/api/v1/kasir/menu/stock-logs/dates",
            get(menu_routes::stock_log_dates),
        )
        .route(
            "/api/v1/kasir/menu/{id}",
            put(menu_routes::update).delete(menu_routes::hapus),
        )
        .route(
            "/api/v1/kasir/menu/{id}/tambah-stok",
            post(menu_routes::tambah_stok),
        )
        .route(
            "/api/v1/kasir/menu/{id}/restore",
            post(menu_routes::restore),
        )
        .route(
            "/api/v1/kasir/menu/{id}/permanent",
            axum::routing::delete(menu_routes::permanent),
        )
        .route("/api/v1/public/game", get(game_public_routes::list))
        .route("/api/v1/public/game/all", get(game_public_routes::list))
        .route(
            "/api/v1/public/game/kategori",
            get(game_public_routes::kategori_list),
        )
        .route(
            "/api/v1/kasir/sesi/buka-guest",
            post(sesi_routes::buka_guest),
        )
        .route(
            "/api/v1/kasir/sesi/buka-member",
            post(sesi_routes::buka_member),
        )
        .route(
            "/api/v1/kasir/sesi/buka-guest-batch",
            post(sesi_routes::buka_guest_batch),
        )
        .route(
            "/api/v1/kasir/sesi/tambah-waktu-batch",
            post(sesi_routes::tambah_waktu_batch),
        )
        .route(
            "/api/v1/kasir/sesi/tambah-waktu-sesi/{id}",
            post(sesi_routes::tambah_waktu_sesi),
        )
        .route(
            "/api/v1/kasir/sesi/pindah-pc/{id}",
            post(sesi_routes::pindah_pc),
        )
        .route("/api/v1/kasir/sesi/tutup/{id}", post(sesi_routes::tutup))
        .route(
            "/api/v1/kasir/sesi/tutup-batch",
            post(sesi_routes::tutup_batch),
        )
        .route(
            "/api/v1/kasir/sesi/refund-paket",
            post(sesi_routes::refund_paket),
        )
        .route("/api/v1/kasir/sesi/{id}", get(sesi_routes::detail))
        .route(
            "/api/v1/kasir/sesi/{id}/riwayat-paket",
            get(sesi_routes::riwayat_paket),
        )
        .route(
            "/api/v1/kasir/blackout/deteksi",
            post(blackout_routes::deteksi),
        )
        .route("/api/v1/kasir/blackout/list", get(blackout_routes::list))
        .route("/api/v1/kasir/blackout/dates", get(blackout_routes::dates))
        .route(
            "/api/v1/kasir/blackout/resolve/member/{id}",
            post(blackout_routes::resolve_member),
        )
        .route(
            "/api/v1/kasir/blackout/resolve/guest/sama/{id}",
            post(blackout_routes::resolve_guest_sama),
        )
        .route(
            "/api/v1/kasir/blackout/resolve/guest/lanjut/{id}",
            post(blackout_routes::resolve_guest_lanjut),
        )
        .route(
            "/api/v1/kasir/blackout/resolve/guest/tutup/{id}",
            post(blackout_routes::resolve_tutup),
        )
        .route(
            "/api/v1/kasir/blackout/force-all-and-detect",
            post(blackout_routes::force_all),
        )
        .route("/api/v1/kasir/blackout/clear", post(blackout_routes::clear))
        .route(
            "/api/v1/kasir/member",
            get(member_routes::list).post(member_routes::create),
        )
        .route(
            "/api/v1/kasir/member/",
            get(member_routes::list).post(member_routes::create),
        )
        .route(
            "/api/v1/kasir/member/tambah-waktu",
            post(member_routes::tambah_waktu),
        )
        .route(
            "/api/v1/kasir/member/refund-paket",
            post(member_routes::refund),
        )
        .route(
            "/api/v1/kasir/member/{id}",
            get(member_routes::detail)
                .put(member_routes::update)
                .delete(member_routes::hapus),
        )
        .route(
            "/api/v1/kasir/member/{id}/archive",
            post(member_routes::archive),
        )
        .route(
            "/api/v1/kasir/member/{id}/restore",
            post(member_routes::restore),
        )
        .route(
            "/api/v1/kasir/member/{id}/paket",
            get(member_routes::riwayat),
        )
        .route("/api/v1/kasir/shift/start", post(shift_routes::start))
        .route("/api/v1/kasir/shift/active", get(shift_routes::active))
        .route(
            "/api/v1/kasir/shift/summary",
            get(shift_routes::summary_aktif),
        )
        .route("/api/v1/kasir/shift/end", post(shift_routes::end))
        .route(
            "/api/v1/kasir/shift/force-close",
            post(shift_routes::force_close),
        )
        .route("/api/v1/kasir/shift/history", get(shift_routes::history))
        .route(
            "/api/v1/kasir/shift/kasir-list",
            get(shift_routes::kasir_list),
        )
        .route(
            "/api/v1/kasir/shift/receipt/{id}",
            get(shift_routes::receipt),
        )
        .route(
            "/api/v1/kasir/shift/{id}/summary",
            get(shift_routes::summary),
        )
        .route(
            "/api/v1/kasir/notes",
            get(note_routes::list).post(note_routes::create),
        )
        .route(
            "/api/v1/kasir/notes/",
            get(note_routes::list).post(note_routes::create),
        )
        .route(
            "/api/v1/kasir/notes/{filename}",
            get(note_routes::get)
                .put(note_routes::save)
                .delete(note_routes::hapus),
        )
        .route(
            "/api/v1/kasir/notes/{filename}/download",
            get(note_routes::download),
        )
        .route("/api/v1/kasir/notes/{filename}/pin", post(note_routes::pin))
        .route(
            "/api/v1/kasir/notes/{filename}/duplicate",
            post(note_routes::duplicate),
        );

    // Laporan, struk, audit log (18 handler).
    let report_api = Router::new()
        .route(
            "/api/v1/kasir/report/laporan/billing",
            get(report_routes::laporan),
        )
        .route(
            "/api/v1/kasir/report/laporan/kantin",
            get(report_routes::laporan_kantin),
        )
        .route(
            "/api/v1/kasir/report/laporan-harian",
            get(report_routes::laporan_harian),
        )
        .route(
            "/api/v1/kasir/report/tanggal",
            get(report_routes::tanggal_list),
        )
        .route(
            "/api/v1/kasir/report/kasir-list",
            get(report_routes::kasir_list),
        )
        .route(
            "/api/v1/kasir/report/struk/menu/{id}",
            get(report_routes::struk_menu),
        )
        .route(
            "/api/v1/kasir/report/struk/{identifier}",
            get(report_routes::struk),
        )
        .route("/api/v1/kasir/report/log", get(report_routes::get_logs))
        .route(
            "/api/v1/kasir/report/log/clear",
            post(report_routes::clear_logs),
        )
        .route(
            "/api/v1/kasir/report/log/export",
            get(report_routes::export_logs),
        )
        .route(
            "/api/v1/kasir/report/blackout-log",
            get(report_routes::blackout_log),
        )
        .route(
            "/api/v1/kasir/report/transaksi/clear",
            post(report_routes::clear_transactions),
        )
        .route(
            "/api/v1/kasir/report/transaksi/by-date/{tanggal}",
            axum::routing::delete(report_routes::clear_date_transactions),
        )
        .route(
            "/api/v1/kasir/report/transaksi/{id}",
            axum::routing::delete(report_routes::delete_transaction),
        )
        .route(
            "/api/v1/kasir/report/export/billing",
            get(report_routes::export_billing),
        )
        .route(
            "/api/v1/kasir/report/export/kantin",
            get(report_routes::export_kantin),
        )
        .route(
            "/api/v1/kasir/report/export/pnl",
            get(report_routes::export_pnl),
        )
        .route(
            "/api/v1/kasir/report/export/audit-pdf",
            get(report_routes::export_audit_pdf),
        );

    let konten_api = Router::new()
        .route("/api/v1/kasir/dashboard/pc", get(dashboard_routes::pc_list))
        .route(
            "/api/v1/kasir/dashboard/server-metrics",
            get(dashboard_routes::server_metrics),
        )
        .route(
            "/api/v1/kasir/dashboard/analytics",
            get(dashboard_routes::analytics),
        )
        .route("/api/v1/kasir/arsip", get(arsip_routes::index))
        .route("/api/v1/kasir/arsip/", get(arsip_routes::index))
        .route(
            "/api/v1/kasir/tournament",
            get(tournament_routes::list).post(tournament_routes::create),
        )
        .route(
            "/api/v1/kasir/tournament/",
            get(tournament_routes::list).post(tournament_routes::create),
        )
        .route(
            "/api/v1/kasir/tournament/{id}",
            get(tournament_routes::detail).delete(tournament_routes::delete),
        )
        .route(
            "/api/v1/kasir/tournament/match/{id}/skor",
            post(tournament_routes::update_skor),
        )
        .route(
            "/api/v1/kasir/tournament/{id}/swiss/next",
            post(tournament_routes::next_swiss),
        )
        .route(
            "/api/v1/kasir/tournament/stage/{id}/finish",
            post(tournament_routes::finish_stage),
        )
        .route(
            "/api/v1/kasir/maintenance/create",
            post(maintenance_routes::create),
        )
        .route(
            "/api/v1/kasir/maintenance/list",
            get(maintenance_routes::list),
        )
        .route(
            "/api/v1/kasir/maintenance/{id}/status",
            put(maintenance_routes::update_status),
        )
        .route(
            "/api/v1/kasir/maintenance/report",
            get(maintenance_routes::report),
        )
        .route(
            "/api/v1/kasir/maintenance/export",
            get(maintenance_routes::export),
        )
        .route(
            "/api/v1/kasir/maintenance/{id}",
            axum::routing::delete(maintenance_routes::hapus),
        )
        .route(
            "/api/v1/kasir/tutorials",
            get(tutorial_routes::list).post(tutorial_routes::create),
        )
        .route(
            "/api/v1/kasir/tutorials/",
            get(tutorial_routes::list).post(tutorial_routes::create),
        )
        .route(
            "/api/v1/kasir/tutorials/{id}",
            get(tutorial_routes::detail)
                .put(tutorial_routes::update)
                .delete(tutorial_routes::hapus),
        )
        .route(
            "/api/v1/kasir/tutorials/categories",
            get(tutorial_routes::categories),
        )
        .route(
            "/api/v1/kasir/tutorials/categories/{nama}",
            axum::routing::delete(tutorial_routes::delete_category),
        )
        .route(
            "/api/v1/kasir/tutorials/upload-image",
            post(tutorial_routes::upload_image),
        )
        .route(
            "/api/v1/kasir/tutorials/cleanup-temp",
            post(tutorial_routes::cleanup_temp),
        )
        .route(
            "/api/v1/kasir/tutorials/export-json",
            post(tutorial_routes::export_json),
        );

    let ops_api = Router::new()
        .route("/api/v1/kasir/backup/trigger", post(backup_routes::trigger))
        .route(
            "/api/v1/kasir/backup/manual/status",
            get(backup_routes::status),
        )
        .route(
            "/api/v1/kasir/backup/test-connection",
            post(backup_routes::test_connection),
        )
        .route("/api/v1/kasir/backup/list", get(backup_routes::list))
        .route(
            "/api/v1/kasir/backup/download/{filename}",
            get(backup_routes::download),
        )
        .route(
            "/api/v1/kasir/backup/restore/{filename}",
            post(backup_routes::restore),
        )
        .route(
            "/api/v1/kasir/backup/delete/{filename}",
            axum::routing::delete(backup_routes::hapus),
        )
        .route(
            "/api/v1/kasir/settings/backup/manual",
            post(database_routes::manual_backup),
        )
        .route(
            "/api/v1/kasir/settings/backup/download",
            get(database_routes::download_db),
        )
        .route(
            "/api/v1/kasir/settings/qris",
            post(database_routes::upload_qris),
        )
        .route(
            "/api/v1/kasir/settings/uninstall-token/client",
            get(database_routes::uninstall_token_client),
        )
        .route(
            "/api/v1/kasir/settings/database/stats",
            get(database_routes::database_stats),
        )
        .route(
            "/api/v1/kasir/settings/database/purge-and-vacuum",
            post(database_routes::purge_and_vacuum),
        )
        .route(
            "/api/v1/kasir/settings/database/import/preview",
            post(database_routes::import_preview),
        )
        .route(
            "/api/v1/kasir/settings/database/import/apply",
            post(database_routes::import_apply),
        )
        .route(
            "/api/v1/kasir/settings/migration/status",
            get(migration_routes::status),
        )
        .route(
            "/api/v1/kasir/settings/migration/check_github",
            get(migration_routes::check_github),
        )
        .route(
            "/api/v1/kasir/settings/migration/update_github",
            post(migration_routes::update_github),
        )
        .route(
            "/api/v1/kasir/settings/migration/upload",
            post(migration_routes::upload),
        )
        .route(
            "/api/v1/kasir/settings/ip-whitelist",
            get(network_routes::list_whitelist).post(network_routes::add_whitelist),
        )
        .route(
            "/api/v1/kasir/settings/ip-whitelist/{ip}",
            axum::routing::delete(network_routes::remove_whitelist),
        )
        .route(
            "/api/v1/kasir/settings/ip-whitelist/toggle",
            post(network_routes::toggle_whitelist),
        )
        .route(
            "/api/v1/kasir/settings/ip-whitelist/status",
            get(network_routes::whitelist_status),
        )
        .route(
            "/api/v1/kasir/settings/app-public-url",
            post(network_routes::set_app_public_url),
        )
        .route(
            "/api/v1/kasir/settings/cloudflare-tunnel/status",
            get(network_routes::tunnel_status),
        )
        .route(
            "/api/v1/kasir/settings/cloudflare-tunnel/save-token",
            post(network_routes::save_tunnel_token),
        )
        .route(
            "/api/v1/kasir/settings/cloudflare-tunnel/toggle",
            post(network_routes::toggle_tunnel),
        )
        .route(
            "/api/v1/kasir/settings/scheduler",
            put(database_routes::scheduler_update),
        )
        .route(
            "/api/v1/kasir/settings/scheduler/status",
            get(database_routes::scheduler_status),
        )
        .route(
            "/api/v1/kasir/settings/scheduler/restart",
            post(database_routes::scheduler_restart),
        )
        .route(
            "/api/v1/kasir/settings/uptime/flush",
            post(database_routes::uptime_flush),
        );

    let guarded = Router::new()
        .route("/kasir/", get(pages::kasir_index))
        .route("/kasir", get(pages::kasir_index))
        .route("/kasir/documentation", get(pages::documentation))
        .route("/kasir/login", get(auth_kasir::login_page))
        .merge(kasir_api)
        .merge(report_api)
        .merge(konten_api)
        .merge(ops_api)
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            csrf::guard,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            whitelist::guard,
        ));

    let publik = Router::new()
        .route("/", get(pages::landing))
        .route("/livepc", get(pages::livepc))
        .route("/paket", get(pages::paket))
        .route("/spesifikasi", get(pages::specs))
        .route("/games", get(pages::games))
        .route("/tv", get(pages::tv))
        .route("/tv/static", get(pages::tv_static))
        .route("/tv-static", get(pages::tv_static))
        .route("/tv/dynamic", get(pages::tv))
        .route("/member", get(pages::member_login))
        .route("/member/login", get(pages::member_login))
        .route("/member/dashboard", get(pages::member_dashboard))
        .route("/pc-status", get(pages::pc_status))
        .route("/member/login", post(member_portal::login))
        .route("/member/logout", post(member_portal::logout))
        .route(
            "/member/profile/update",
            post(member_portal::profile_update),
        )
        .route("/api/v1/public/auth/login", post(crate::routes::public::client_auth::login))
        .route("/api/v1/public/auth/logout", post(member_portal::logout))
        .route("/api/v1/public/auth/status", post(member_portal::status))
        .route("/api/v1/public/member/history", get(member_portal::history));

    let kasir_monitor = Router::new()
        .route("/api/v1/kasir/monitor/all", get(monitor_routes::all))
        .route(
            "/api/v1/kasir/monitor/hardware/{pc_id}",
            get(monitor_routes::one),
        )
        .route(
            "/api/v1/kasir/monitor/{hardware_id}",
            axum::routing::delete(monitor_routes::hapus),
        )
        .route(
            "/api/v1/kasir/monitor/processes/{pc_id}",
            get(monitor_routes::proses),
        )
        .route(
            "/api/v1/kasir/monitor/processes/{pc_id}/trigger",
            post(monitor_routes::trigger_proses),
        )
        .route(
            "/api/v1/kasir/monitor/processes/{pc_id}/kill",
            post(monitor_routes::kill_proses),
        )
        .route(
            "/api/v1/kasir/monitor/register/{pc_id}",
            post(monitor_routes::baseline),
        )
        .route(
            "/api/v1/kasir/monitor/screenshot/trigger/{pc_id}",
            post(monitor_routes::screenshot_trigger),
        )
        .route(
            "/api/v1/kasir/monitor/screenshot/status/{pc_id}",
            get(monitor_routes::screenshot_status),
        )
        .route(
            "/api/v1/kasir/monitor/screenshot/image/{pc_id}",
            get(monitor_routes::screenshot_image),
        )
        .route(
            "/api/v1/kasir/monitor/screenshot/all",
            get(monitor_routes::screenshot_all),
        )
        .route(
            "/api/v1/kasir/monitor/remote/{pc_id}/afk-lock",
            post(monitor_routes::remote_afk_lock),
        )
        .route(
            "/api/v1/kasir/monitor/remote/{pc_id}/afk-unlock",
            post(monitor_routes::remote_afk_unlock),
        )
        .route(
            "/api/v1/kasir/monitor/remote/batch",
            post(monitor_routes::remote_batch),
        )
        .route(
            "/api/v1/kasir/monitor/remote/{pc_id}/{action}",
            post(monitor_routes::remote_action),
        )
        .route("/api/v1/kasir/vnc/status", get(vnc_routes::status))
        .route("/api/v1/kasir/vnc/start", post(vnc_routes::start))
        .route(
            "/api/v1/kasir/vnc/client/{pc_id}/start",
            post(vnc_routes::client_start),
        )
        .route(
            "/api/v1/kasir/vnc/client/{pc_id}/stop",
            post(vnc_routes::client_stop),
        )
        .route(
            "/api/v1/kasir/vnc/client/{pc_id}/status",
            get(vnc_routes::client_status),
        )
        .route(
            "/api/v1/kasir/monitor/vnc_client/{pc_id}/start",
            post(vnc_routes::client_start),
        )
        .route(
            "/api/v1/kasir/monitor/vnc_client/{pc_id}/stop",
            post(vnc_routes::client_stop),
        )
        .route(
            "/api/v1/kasir/monitor/vnc_client/{pc_id}/status",
            get(vnc_routes::client_status),
        )
        .route(
            "/api/v1/kasir/mikrotik/config",
            get(mikrotik_routes::get_config).post(mikrotik_routes::save_config),
        )
        .route("/api/v1/kasir/mikrotik/test", post(mikrotik_routes::test))
        .route(
            "/api/v1/kasir/mikrotik/sync_all",
            post(mikrotik_routes::sync_all),
        )
        .route(
            "/api/v1/kasir/server-monitor",
            get(server_monitor_routes::metrics),
        )
        .route(
            "/api/v1/kasir/server-monitor/lhm/start",
            post(server_monitor_routes::lhm_start),
        )
        .route(
            "/api/v1/kasir/server-monitor/lhm/stop",
            post(server_monitor_routes::lhm_stop),
        )
        .route(
            "/api/v1/kasir/server-monitor/lhm/status",
            get(server_monitor_routes::lhm_status),
        )
        .route("/api/v1/kasir/uptime/daily", get(uptime_routes::daily))
        .route("/api/v1/kasir/uptime/range", get(uptime_routes::range));

    let client_api = Router::new()
        .route("/api/v1/public/tv/data", get(tv_public_routes::data))
        .route("/api/v1/public/monitor/", post(monitor_routes::receive))
        .route("/api/v1/public/monitor", post(monitor_routes::receive))
        .route(
            "/api/v1/public/monitor/screenshot/upload",
            post(monitor_routes::screenshot_upload),
        )
        .route(
            "/api/v1/public/client/screenshot/upload",
            post(monitor_routes::screenshot_upload),
        )
        .route(
            "/api/v1/public/client/identify",
            post(client_routes::identify),
        )
        .route("/api/v1/public/client/status", post(client_routes::status))
        .route(
            "/api/v1/public/client/update.exe",
            get(client_routes::update_exe),
        )
        .route(
            "/api/v1/public/client/selesai",
            post(client_routes::selesai),
        )
        .route(
            "/api/v1/public/client/admin-login",
            post(client_routes::admin_login),
        )
        .route(
            "/api/v1/public/client/emergency-login",
            post(client_routes::emergency_login),
        )
        .route(
            "/api/v1/public/client/afk-lock",
            post(client_routes::afk_lock),
        )
        .route(
            "/api/v1/public/client/afk-unlock",
            post(client_routes::afk_unlock),
        )
        .route("/api/v1/public/client/warnet", get(client_routes::warnet))
        .route(
            "/api/v1/public/client/vnc_ready",
            post(client_routes::vnc_ready),
        )
        .route(
            "/api/v1/public/client/vnc_stopped",
            post(client_routes::vnc_stopped),
        )
        .route(
            "/api/v1/public/client/fast_poll",
            post(client_routes::fast_poll),
        )
        .route(
            "/api/v1/public/client/vnc_poll",
            post(client_routes::fast_poll),
        );

    Router::new()
        .route("/api/health", get(health::health))
        .merge(client_api)
        .merge(publik)
        .merge(
            kasir_monitor
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    csrf::guard,
                ))
                .layer(axum::middleware::from_fn_with_state(
                    state.clone(),
                    whitelist::guard,
                )),
        )
        .merge(guarded)
        .route("/favicon.ico", get(|| static_file(Path("favicon.ico".to_string()))))
        .route("/static/{*path}", get(static_file))
        .with_state(state)
}

async fn static_file(Path(path): Path<String>) -> Response {
    if path.contains("..") || path.contains('\\') || path.starts_with('/') {
        return StatusCode::FORBIDDEN.into_response();
    }
    if let Some(file) = StaticAssets::get(&path) {
        let mime = crate::assets::content_type(&path);
        let body: Body = Body::from(file.data.into_owned());
        let mut res = (StatusCode::OK, body).into_response();
        res.headers_mut()
            .insert(header::CONTENT_TYPE, HeaderValue::from_static(mime));
        res.headers_mut()
            .insert(header::CACHE_CONTROL, HeaderValue::from_static(IMMUTABLE));
        return res;
    }

    // Fallback: baca dari filesystem disk hanya di dalam root app/static
    let base = match tokio::fs::canonicalize("app/static").await {
        Ok(b) => b,
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };
    let candidate = base.join(&path);
    let Ok(resolved) = tokio::fs::canonicalize(&candidate).await else {
        return StatusCode::NOT_FOUND.into_response();
    };
    if !resolved.starts_with(&base) {
        return StatusCode::FORBIDDEN.into_response();
    }
    if let Ok(bytes) = tokio::fs::read(&resolved).await {
        let mime = crate::assets::content_type(&path);
        let body: Body = Body::from(bytes);
        let mut res = (StatusCode::OK, body).into_response();
        res.headers_mut()
            .insert(header::CONTENT_TYPE, HeaderValue::from_static(mime));
        return res;
    }

    StatusCode::NOT_FOUND.into_response()
}
