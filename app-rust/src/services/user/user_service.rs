//! CRUD staff kasir/admin dengan guard admin-terakhir dan riwayat shift.

use crate::models::user::{hash_password, User};
use crate::repositories::user as user_repo;
use crate::state::AppState;
use crate::utils::logger::audit;
use crate::utils::time;
use crate::utils::validators;
use anyhow::Result;
use serde_json::Value;

fn str_field<'a>(data: &'a Value, key: &str) -> &'a str {
    data.get(key).and_then(|v| v.as_str()).unwrap_or("")
}

fn bool_field(data: &Value, key: &str, default: bool) -> bool {
    match data.get(key) {
        Some(Value::Bool(b)) => *b,
        Some(Value::String(s)) => s.to_lowercase() == "true",
        Some(Value::Null) | None => default,
        Some(other) => other.to_string().to_lowercase() == "true",
    }
}

fn month_now(tz: &str) -> String {
    time::now_local(tz).format("%Y-%m").to_string()
}

pub async fn list(state: &AppState, aktif_only: bool) -> Result<Vec<Value>> {
    Ok(user_repo::get_all(&state.pool, aktif_only)
        .await?
        .iter()
        .map(User::to_json)
        .collect())
}

pub async fn get(state: &AppState, id: i64) -> Result<Value, String> {
    match user_repo::get_by_id(&state.pool, id).await.ok().flatten() {
        Some(u) => Ok(u.to_json()),
        None => Err("User tidak ditemukan".into()),
    }
}

pub async fn create(state: &AppState, data: &Value, operator: &str) -> Result<Value, String> {
    let username = validators::username(str_field(data, "username"), 3, 30)?;
    let password = validators::password(str_field(data, "password"), 6, 32)?;
    let nama = validators::text(
        str_field(data, "nama_lengkap"),
        0,
        100,
        "Nama lengkap",
        false,
    )?;
    let role = str_field(data, "role").trim().to_lowercase();
    let role = if role.is_empty() {
        "kasir".to_string()
    } else {
        role
    };
    if role != "admin" && role != "kasir" {
        return Err("Role harus 'admin' atau 'kasir'".into());
    }
    let aktif = bool_field(data, "aktif", true);

    if user_repo::find_by_username(&state.pool, &username)
        .await
        .ok()
        .flatten()
        .is_some()
    {
        return Err("Username sudah terdaftar".into());
    }

    let (kuota, sisa, reset) = if role == "kasir" {
        let kuota = validators::int_range(
            data.get("kuota_main_bulanan").unwrap_or(&Value::from(0)),
            0,
            720 * 60,
            "Kuota main bulanan (menit)",
        )?;
        (kuota, kuota, Some(month_now(&state.cfg.timezone)))
    } else {
        (0, 0, None)
    };

    let _guard = state.write().await;
    let result = sqlx::query(
        "INSERT INTO user (username, password_hash, nama_lengkap, role, aktif, dibuat_pada, \
         kuota_main_bulanan, sisa_kuota_menit, terakhir_reset_kuota) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&username)
    .bind(hash_password(&password))
    .bind(&nama)
    .bind(&role)
    .bind(aktif as i64)
    .bind(time::db_str(time::now_db()))
    .bind(kuota)
    .bind(sisa)
    .bind(&reset)
    .execute(&state.pool)
    .await;
    if let Err(e) = result {
        return Err(if e.to_string().contains("UNIQUE") {
            "Username sudah terdaftar".into()
        } else {
            e.to_string()
        });
    }

    let created = user_repo::find_by_username(&state.pool, &username)
        .await
        .ok()
        .flatten();
    let Some(user) = created else {
        return Err("User tidak ditemukan".into());
    };
    audit(
        operator,
        "TAMBAH_USER",
        &format!("Role:{role} | User:{username}"),
        None,
        "",
        "",
    );
    Ok(user.to_json())
}

pub async fn update(
    state: &AppState,
    id: i64,
    data: &Value,
    operator: &str,
) -> Result<Value, String> {
    let _guard = state.write().await;
    let Some(user) = user_repo::get_by_id(&state.pool, id).await.ok().flatten() else {
        return Err("User tidak ditemukan".into());
    };

    let new_role = if !str_field(data, "role").trim().is_empty() {
        str_field(data, "role").trim().to_lowercase()
    } else {
        user.role().to_string()
    };
    let new_aktif = if data.get("aktif").is_some() {
        bool_field(data, "aktif", user.active())
    } else {
        user.active()
    };
    if user.role() == "admin" && user.active() && (new_role != "admin" || !new_aktif) {
        if user_repo::count_active_admins(&state.pool)
            .await
            .unwrap_or(0)
            <= 1
        {
            return Err("Tidak dapat menonaktifkan satu-satunya Admin tersisa!".into());
        }
    }

    let mut username = user.username.clone();
    if !str_field(data, "username").is_empty() {
        let candidate = validators::username(str_field(data, "username"), 3, 30)?;
        if candidate != user.username {
            if user_repo::find_by_username(&state.pool, &candidate)
                .await
                .ok()
                .flatten()
                .is_some()
            {
                return Err("Username sudah dipakai oleh orang lain".into());
            }
            username = candidate;
        }
    }

    let nama = if data.get("nama_lengkap").is_some() {
        validators::text(
            str_field(data, "nama_lengkap"),
            0,
            100,
            "Nama lengkap",
            false,
        )?
    } else {
        user.nama_lengkap.clone().unwrap_or_default()
    };

    let mut role = user.role().to_string();
    let mut kuota = user.kuota_main_bulanan.unwrap_or(0);
    let mut sisa = user.sisa_kuota_menit.unwrap_or(0);
    let mut reset = user.terakhir_reset_kuota.clone();
    if !str_field(data, "role").trim().is_empty() {
        if new_role != "admin" && new_role != "kasir" {
            return Err("Role harus 'admin' atau 'kasir'".into());
        }
        role = new_role;
        if role == "admin" {
            kuota = 0;
            sisa = 0;
        }
    }
    if role == "kasir" && data.get("kuota_main_bulanan").is_some() {
        let baru = validators::int_range(
            data.get("kuota_main_bulanan").unwrap_or(&Value::from(0)),
            0,
            720 * 60,
            "Kuota main bulanan (menit)",
        )?;
        let selisih = baru - kuota;
        kuota = baru;
        sisa = if sisa == 0 {
            baru
        } else {
            (sisa + selisih).clamp(0, baru)
        };
        if reset.is_none() {
            reset = Some(month_now(&state.cfg.timezone));
        }
    }

    let aktif = if data.get("aktif").is_some() {
        new_aktif
    } else {
        user.active()
    };
    let password_hash = if !str_field(data, "password").is_empty() {
        Some(hash_password(&validators::password(
            str_field(data, "password"),
            6,
            32,
        )?))
    } else {
        None
    };

    sqlx::query(
        "UPDATE user SET username = ?, nama_lengkap = ?, role = ?, aktif = ?, \
         kuota_main_bulanan = ?, sisa_kuota_menit = ?, terakhir_reset_kuota = ?, \
         password_hash = COALESCE(?, password_hash) WHERE id = ?",
    )
    .bind(&username)
    .bind(&nama)
    .bind(&role)
    .bind(aktif as i64)
    .bind(kuota)
    .bind(sisa)
    .bind(&reset)
    .bind(password_hash)
    .bind(id)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    audit(
        operator,
        "UPDATE_USER",
        &format!("ID:{id} | User:{username}"),
        None,
        "",
        "",
    );
    get(state, id).await
}

pub async fn archive(state: &AppState, id: i64, operator: &str) -> Result<(u16, Value), String> {
    let _guard = state.write().await;
    let Some(user) = user_repo::get_by_id(&state.pool, id).await.ok().flatten() else {
        return Err("User tidak ditemukan".into());
    };
    if user.role() == "admin"
        && user.active()
        && user_repo::count_active_admins(&state.pool)
            .await
            .unwrap_or(0)
            <= 1
    {
        return Err("Tidak dapat menonaktifkan satu-satunya Admin tersisa!".into());
    }
    if !user.active() {
        return Ok((
            200,
            serde_json::json!({"success": true, "message": "User sudah nonaktif"}),
        ));
    }
    sqlx::query("UPDATE user SET aktif = 0 WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    audit(
        operator,
        "ARSIP_USER",
        &format!("User:{} dinonaktifkan", user.username),
        None,
        "",
        "",
    );
    Ok((
        200,
        serde_json::json!({"success": true, "message": "User berhasil diarsipkan"}),
    ))
}

pub async fn restore(state: &AppState, id: i64, operator: &str) -> Result<(u16, Value), String> {
    let _guard = state.write().await;
    let Some(user) = user_repo::get_by_id(&state.pool, id).await.ok().flatten() else {
        return Err("User tidak ditemukan".into());
    };
    if user.active() {
        return Err("User tidak dalam arsip".into());
    }
    sqlx::query("UPDATE user SET aktif = 1 WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    audit(
        operator,
        "RESTORE_USER",
        &format!("User:{} dipulihkan dari arsip", user.username),
        None,
        "",
        "",
    );
    Ok((
        200,
        serde_json::json!({"success": true, "message": "User berhasil dipulihkan"}),
    ))
}

pub async fn delete(state: &AppState, id: i64, operator: &str) -> Result<Value, String> {
    let _guard = state.write().await;
    let Some(user) = user_repo::get_by_id(&state.pool, id).await.ok().flatten() else {
        return Err("User tidak ditemukan".into());
    };
    if user.role() == "admin"
        && user.active()
        && user_repo::count_active_admins(&state.pool)
            .await
            .unwrap_or(0)
            <= 1
    {
        return Err("Tidak dapat menghapus satu-satunya Admin tersisa!".into());
    }
    let (shift_count,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM shift_record WHERE kasir_id = ?")
            .bind(id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| e.to_string())?;
    if shift_count > 0 {
        return Err("User punya riwayat shift. Nonaktifkan saja.".into());
    }

    let mut tx = state.pool.begin().await.map_err(|e| e.to_string())?;
    sqlx::query("UPDATE transaksi SET user_id = NULL WHERE user_id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query("UPDATE sesi SET user_id = NULL WHERE user_id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM user WHERE id = ?")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())?;

    audit(
        operator,
        "HAPUS_USER",
        &format!("User:{} dihapus secara permanen", user.username),
        None,
        "",
        "",
    );
    Ok(serde_json::json!({"success": true, "message": "User berhasil dihapus"}))
}

pub async fn reset_kuota(state: &AppState, id: i64, operator: &str) -> Result<Value, String> {
    let _guard = state.write().await;
    let Some(user) = user_repo::get_by_id(&state.pool, id).await.ok().flatten() else {
        return Err("User tidak ditemukan".into());
    };
    if user.role() != "kasir" {
        return Err("Hanya akun kasir yang memiliki benefit kuota bermain".into());
    }
    let kuota = user.kuota_main_bulanan.unwrap_or(0);
    sqlx::query("UPDATE user SET sisa_kuota_menit = ?, terakhir_reset_kuota = ? WHERE id = ?")
        .bind(kuota)
        .bind(month_now(&state.cfg.timezone))
        .bind(id)
        .execute(&state.pool)
        .await
        .map_err(|e| e.to_string())?;
    audit(
        operator,
        "RESET_KUOTA_KASIR",
        &format!("Kuota bermain kasir {} direset ke {kuota}m", user.username),
        None,
        "",
        "",
    );
    get(state, id).await
}
