//! Admin awal pada database baru, setara bagian admin `bootstrap_app_data`.

use crate::models::user::hash_password;
use crate::repositories::user as user_repo;
use crate::state::AppState;
use anyhow::Result;
use rand::distr::Alphanumeric;
use rand::Rng;

pub async fn ensure_initial_admin(state: &AppState) -> Result<()> {
    if user_repo::count_all(&state.pool).await? > 0 {
        return Ok(());
    }
    let password: String = rand::rng()
        .sample_iter(&Alphanumeric)
        .take(12)
        .map(char::from)
        .collect();
    sqlx::query(
        "INSERT INTO user (username, password_hash, nama_lengkap, role, aktif, dibuat_pada) \
         VALUES ('admin', ?, 'Administrator', 'admin', 1, datetime('now'))",
    )
    .bind(hash_password(&password))
    .execute(&state.pool)
    .await?;

    let info = state.cfg.root.join("initial_admin.txt");
    let body = format!(
        "=== TMBILLING INITIAL SUPERADMIN CREDENTIALS ===\nUsername: admin\nPassword: {password}\n\
         CATATAN: Harap segera login dan ubah password ini di Dashboard Kasir.\n\
         Berkas ini dapat Anda hapus setelah berhasil login.\n"
    );
    std::fs::write(&info, body)?;
    tracing::warn!(path = %info.display(), "admin awal dibuat; kredensial sementara tersimpan");
    Ok(())
}
