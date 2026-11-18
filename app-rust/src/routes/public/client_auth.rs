//! Login klien PC (kiosk): member memakai billing, kasir/admin membuka mode admin.
//! Dipakai WarnetAgent lewat POST /api/v1/public/auth/login.

use std::sync::Arc;

use axum::body::Bytes;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::Response;
use serde_json::json;

use crate::models::user::verify_password;
use crate::repositories::{member as member_repo, pc as pc_repo, user as user_repo};
use crate::services::auth::login_throttle;
use crate::services::client::client_service;
use crate::services::sesi::sesi_service;
use crate::state::AppState;
use crate::utils::{http, time};

pub async fn login(
    State(st): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let data = http::parse_json(&body);
    let ip = data
        .get("ip_address")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let mac = data
        .get("mac_address")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_uppercase();
    let username = data
        .get("username")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_lowercase();
    let password = data.get("password").and_then(|v| v.as_str()).unwrap_or("");

    let pc = match pc_repo::find_aktif_by_ip(&st.pool, &ip).await {
        Ok(Some(p)) => Some(p),
        _ => match pc_repo::find_by_mac(&st.pool, &mac).await {
            Ok(Some(p)) if p.aktif.unwrap_or(false) => Some(p),
            _ => None,
        },
    };
    let pc = match pc {
        Some(p) => p,
        None => return http::err(404, "PC tidak dikenal server"),
    };

    crate::utils::logger::rec(
        "client",
        "CLIENT_LOGIN_PC",
        &format!("ip={ip} mac={mac} user={username} pc={}", pc.kode),
    );

    if login_throttle::check(&ip, &username) {
        return http::err(
            429,
            "Terlalu banyak percobaan login. Coba lagi dalam 5 menit.",
        );
    }

    if let Ok(Some(member)) = member_repo::find_by_username(&st.pool, &username).await {
        if !member.aktif {
            return http::err(403, "Akun member Anda dinonaktifkan oleh kasir");
        }
        if !verify_password(&member.password_hash, password) {
            login_throttle::fail(&ip, &username);
            return http::err(401, "Username atau password salah");
        }
        if let Some(batas) = member
            .kadaluarsa_pada
            .as_deref()
            .and_then(time::parse_dt)
        {
            if time::now_db() > batas {
                return http::err(403, "Masa aktif member sudah kadaluarsa");
            }
        }
        login_throttle::ok(&ip, &username);
        let grup = pc.grup_nama.clone().unwrap_or_else(|| "reguler".into());
        let _ = crate::utils::logger::rec("client", "CLIENT_LOGIN_MEMBER", &format!("user={username} pc={}", pc.kode));
        return match sesi_service::buka_member(&st, Some(&pc.kode), Some(&member.username), "client")
            .await
        {
            Ok(_) => http::json(
                200,
                json!({
                    "success": true,
                    "is_member": true,
                    "tipe": "member",
                    "nama": member.nama_lengkap.clone().unwrap_or_else(|| member.username.clone()),
                    "grup": grup,
                    "pc_kode": pc.kode,
                    "waktu_tersimpan": member.waktu_tersimpan,
                }),
            ),
            Err(e) => http::err(400, e),
        };
    }

    let user = match user_repo::find_by_username(&st.pool, &username).await {
        Ok(Some(u)) if u.active() => u,
        _ => {
            login_throttle::fail(&ip, &username);
            return http::err(401, "Username atau password salah");
        }
    };
    if !verify_password(&user.password_hash, password) {
        login_throttle::fail(&ip, &username);
        return http::err(401, "Username atau password salah");
    }
    login_throttle::ok(&ip, &username);
    let agent = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    match client_service::admin_login(&st, &ip, &mac, &username, password, &ip, agent).await {
        Ok(_) => http::json(
            200,
            json!({
                "success": true,
                "is_member": false,
                "tipe": user.role(),
                "nama": user.nama().to_string(),
                "grup": pc.grup_nama.clone().unwrap_or_else(|| "reguler".into()),
                "pc_kode": pc.kode,
            }),
        ),
        Err(e) => http::err(400, e),
    }
}
