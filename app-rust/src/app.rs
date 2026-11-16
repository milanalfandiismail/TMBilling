//! Router aplikasi: aset embed, health publik, dan guard whitelist.

use crate::assets::StaticAssets;
use crate::middleware::{csrf, whitelist};
use crate::routes::auth::auth_kasir;
use crate::routes::blackout::blackout_routes;
use crate::routes::client::client_routes;
use crate::routes::game::{game_public_routes, game_routes};
use crate::routes::grup::grup_routes;
use crate::routes::member::member_routes;
use crate::routes::menu::menu_routes;
use crate::routes::notes::note_routes;
use crate::routes::paket::paket_routes;
use crate::routes::pc::pc_routes;
use crate::routes::public::health;
use crate::routes::sesi::sesi_routes;
use crate::routes::settings::settings_routes;
use crate::routes::shift::shift_routes;
use crate::routes::user::user_routes;
use crate::state::AppState;
use axum::body::Body;
use axum::extract::Path;
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

    let guarded = Router::new()
        .route("/kasir/", get(shell_placeholder))
        .route("/kasir/login", get(auth_kasir::login_page))
        .merge(kasir_api)
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            csrf::guard,
        ))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            whitelist::guard,
        ));

    let client_api = Router::new()
        .route(
            "/api/v1/public/client/identify",
            post(client_routes::identify),
        )
        .route("/api/v1/public/client/status", post(client_routes::status))
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
        .merge(guarded)
        .route("/static/{*path}", get(static_file))
        .with_state(state)
}

/// Placeholder sampai template dashboard diport.
async fn shell_placeholder() -> &'static str {
    "TMBilling"
}

async fn static_file(Path(path): Path<String>) -> Response {
    match StaticAssets::get(&path) {
        Some(file) => {
            let mime = crate::assets::content_type(&path);
            let body: Body = Body::from(file.data.into_owned());
            let mut res = (StatusCode::OK, body).into_response();
            res.headers_mut()
                .insert(header::CONTENT_TYPE, HeaderValue::from_static(mime));
            res.headers_mut()
                .insert(header::CACHE_CONTROL, HeaderValue::from_static(IMMUTABLE));
            res
        }
        None => StatusCode::NOT_FOUND.into_response(),
    }
}
