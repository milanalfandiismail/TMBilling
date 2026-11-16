//! Business logic katalog game/aplikasi + kategori.

use crate::models::game::Game;
use crate::repositories::game as game_repo;
use crate::state::AppState;
use crate::utils::{http::Upload, logger, validators};
use serde_json::{json, Value};

const EXT_ICON: [&str; 5] = ["png", "jpg", "jpeg", "webp", "ico"];

fn nama_berkas_aman(raw: &str) -> String {
    let base = raw.replace('\\', "/");
    let base = base.rsplit('/').next().unwrap_or("");
    base.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_') {
                c
            } else {
                '_'
            }
        })
        .collect()
}

fn simpan_icon(st: &AppState, upload: &Upload) -> Result<String, String> {
    let nama = nama_berkas_aman(&upload.filename);
    let ext = nama.rsplit('.').next().unwrap_or("").to_lowercase();
    if !nama.contains('.') || !EXT_ICON.contains(&ext.as_str()) {
        return Err(format!(
            "Format berkas '{}' tidak diizinkan. Gunakan: png, jpg, jpeg, webp, ico",
            upload.filename
        ));
    }
    let folder = st.cfg.root.join("app/static/uploads/games");
    std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    let unik = format!("{}_{}", chrono::Utc::now().timestamp(), nama);
    std::fs::write(folder.join(&unik), &upload.bytes).map_err(|e| e.to_string())?;
    Ok(unik)
}

fn hapus_icon(st: &AppState, nama: &str) {
    let base = nama_berkas_aman(nama);
    let _ = std::fs::remove_file(st.cfg.root.join("app/static/uploads/games").join(base));
}

fn normalize_kategori(raw: Option<&Value>) -> Result<Option<String>, String> {
    let Some(v) = raw else { return Ok(None) };
    let items: Vec<String> = match v {
        Value::Array(a) => a
            .iter()
            .map(|x| x.as_str().unwrap_or("").trim().to_string())
            .filter(|s| !s.is_empty())
            .collect(),
        Value::String(s) => s
            .split(',')
            .map(|x| x.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect(),
        other => return Ok(Some(other.to_string())),
    };
    if items.is_empty() {
        return Ok(None);
    }
    let mut bersih = Vec::new();
    for item in items {
        bersih.push(validators::text(&item, 1, 50, "Kategori Game", false)?);
    }
    Ok(Some(bersih.join(", ")))
}

fn tipe_valid(raw: Option<&str>) -> Result<String, String> {
    let tipe = raw.unwrap_or("game").trim().to_lowercase();
    if matches!(tipe.as_str(), "game" | "aplikasi") {
        Ok(tipe)
    } else {
        Err("Tipe Game harus salah satu dari: game, aplikasi".into())
    }
}

fn sekarang() -> String {
    chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

pub async fn get_all(
    st: &AppState,
    aktif_only: bool,
    kategori: Option<&str>,
    tipe: Option<&str>,
    search: Option<&str>,
    limit: Option<i64>,
    offset: i64,
) -> Result<Vec<Game>, String> {
    game_repo::get_all(&st.pool, aktif_only, kategori, tipe, search, limit, offset)
        .await
        .map_err(|e| e.to_string())
}

pub async fn create(
    st: &AppState,
    data: &Value,
    upload: Option<&Upload>,
    operator: &str,
) -> Result<Game, String> {
    let nama = validators::text(
        data.get("nama").and_then(Value::as_str).unwrap_or(""),
        2,
        100,
        "Nama Game/Aplikasi",
        true,
    )?;
    let icon = match upload {
        Some(u) => Some(simpan_icon(st, u)?),
        None => None,
    };
    let kategori = normalize_kategori(data.get("kategori"))?;
    let tipe = tipe_valid(data.get("tipe").and_then(Value::as_str))?;
    let exe_path = teks_opsional(data, "exe_path", "Executable Path")?;
    let argumen = teks_opsional(data, "argumen", "Argumen Eksekusi")?;
    let aktif = nilai_bool(data.get("aktif")).unwrap_or(true);

    let game = Game {
        id: 0,
        nama,
        tipe: Some(tipe.clone()),
        kategori,
        exe_path,
        argumen,
        icon,
        aktif: Some(aktif),
        created_at: Some(sekarang()),
        updated_at: Some(sekarang()),
        operator_id: Some(operator.to_string()),
    };
    let _guard = st.write().await;
    let id = game_repo::insert(&st.pool, &game)
        .await
        .map_err(|e| e.to_string())?;
    logger::audit_json(
        operator,
        "GAME_CREATE",
        &format!(
            "Item '{}' ({tipe}) berhasil ditambahkan ke katalog",
            game.nama
        ),
        None,
        "",
        "",
        json!({"nama": game.nama, "tipe": game.tipe, "kategori": game.kategori, "exe_path": game.exe_path, "argumen": game.argumen}),
    );
    game_repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Data game/aplikasi tidak ditemukan".into())
}

fn teks_opsional(data: &Value, key: &str, field: &str) -> Result<Option<String>, String> {
    let raw = data
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string();
    if raw.is_empty() {
        return Ok(None);
    }
    Ok(Some(validators::text(&raw, 1, 255, field, false)?))
}

fn nilai_bool(v: Option<&Value>) -> Option<bool> {
    let v = v?;
    match v {
        Value::Bool(b) => Some(*b),
        Value::String(s) => Some(matches!(
            s.trim().to_lowercase().as_str(),
            "true" | "1" | "yes"
        )),
        Value::Number(n) => Some(n.as_i64().unwrap_or(0) != 0),
        _ => None,
    }
}

pub async fn update(
    st: &AppState,
    game_id: i64,
    data: &Value,
    upload: Option<&Upload>,
    operator: &str,
) -> Result<Game, String> {
    let mut game = game_repo::get_by_id(&st.pool, game_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Data game/aplikasi tidak ditemukan")?;
    let nama_sebelum = game.nama.clone();
    let tipe_sebelum = game.tipe();
    let kategori_sebelum = game.kategori.clone();

    if let Some(raw) = data.get("nama").and_then(Value::as_str) {
        game.nama = validators::text(raw, 2, 100, "Nama Game/Aplikasi", true)?;
    }
    if let Some(raw) = data.get("tipe").and_then(Value::as_str) {
        game.tipe = Some(tipe_valid(Some(raw))?);
    }
    if data.get("kategori").is_some() {
        game.kategori = normalize_kategori(data.get("kategori"))?;
    }
    if data.get("exe_path").is_some() {
        game.exe_path = teks_opsional(data, "exe_path", "Executable Path")?;
    }
    if data.get("argumen").is_some() {
        game.argumen = teks_opsional(data, "argumen", "Argumen Eksekusi")?;
    }
    if data.get("aktif").is_some() {
        game.aktif = Some(nilai_bool(data.get("aktif")).unwrap_or(true));
    }

    let hapus = data
        .get("hapus_icon")
        .map(|v| match v {
            Value::Bool(b) => *b,
            Value::String(s) => s.trim().eq_ignore_ascii_case("true"),
            _ => false,
        })
        .unwrap_or(false);
    if hapus {
        if let Some(old) = game.icon.clone() {
            hapus_icon(st, &old);
            game.icon = None;
        }
    } else if let Some(u) = upload {
        if let Some(old) = game.icon.clone() {
            hapus_icon(st, &old);
        }
        game.icon = Some(simpan_icon(st, u)?);
    }

    game.updated_at = Some(sekarang());
    game.operator_id = Some(operator.to_string());
    let _guard = st.write().await;
    game_repo::update(&st.pool, &game)
        .await
        .map_err(|e| e.to_string())?;
    logger::audit_json(
        operator,
        "GAME_UPDATE",
        &format!("Item '{nama_sebelum}' berhasil diperbarui"),
        None,
        "",
        "",
        json!({
            "nama_sebelum": nama_sebelum,
            "nama_baru": game.nama,
            "tipe_sebelum": tipe_sebelum,
            "tipe_baru": game.tipe(),
            "kategori_sebelum": kategori_sebelum,
            "kategori_baru": game.kategori,
            "exe_path": game.exe_path,
        }),
    );
    Ok(game)
}

pub async fn archive(st: &AppState, game_id: i64, operator: &str) -> Result<String, String> {
    let game = game_repo::get_by_id(&st.pool, game_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Game tidak ditemukan")?;
    if !game.active() {
        return Ok(format!("Game '{}' sudah diarsipkan", game.nama));
    }
    let _guard = st.write().await;
    sqlx::query("UPDATE game SET aktif = 0, updated_at = ? WHERE id = ?")
        .bind(sekarang())
        .bind(game_id)
        .execute(&st.pool)
        .await
        .map_err(|e| e.to_string())?;
    logger::audit_json(
        operator,
        "GAME_ARCHIVE",
        &format!("Game '{}' diarsipkan", game.nama),
        None,
        "",
        "",
        json!({"nama": game.nama, "kategori": game.kategori}),
    );
    Ok(format!("Game '{}' berhasil diarsipkan", game.nama))
}

pub async fn restore(st: &AppState, game_id: i64, operator: &str) -> Result<String, String> {
    let game = game_repo::get_by_id(&st.pool, game_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Game tidak ditemukan")?;
    if game.active() {
        return Err("Game tidak dalam arsip".into());
    }
    let _guard = st.write().await;
    sqlx::query("UPDATE game SET aktif = 1, updated_at = ? WHERE id = ?")
        .bind(sekarang())
        .bind(game_id)
        .execute(&st.pool)
        .await
        .map_err(|e| e.to_string())?;
    logger::audit_json(
        operator,
        "RESTORE_GAME",
        &format!("Game '{}' dipulihkan dari arsip", game.nama),
        None,
        "",
        "",
        json!({"nama": game.nama}),
    );
    Ok(format!("Game '{}' berhasil dipulihkan", game.nama))
}

pub async fn delete(st: &AppState, game_id: i64, operator: &str) -> Result<String, String> {
    let game = game_repo::get_by_id(&st.pool, game_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Game tidak ditemukan")?;
    if let Some(icon) = game.icon.clone() {
        hapus_icon(st, &icon);
    }
    let _guard = st.write().await;
    game_repo::delete(&st.pool, game_id)
        .await
        .map_err(|e| e.to_string())?;
    logger::audit_json(
        operator,
        "GAME_DELETE",
        &format!("Game '{}' berhasil dihapus dari katalog", game.nama),
        None,
        "",
        "",
        json!({"nama": game.nama, "kategori": game.kategori}),
    );
    Ok(format!("Game '{}' berhasil dihapus", game.nama))
}

pub async fn kategori_all(st: &AppState) -> Result<Vec<crate::models::game::GameKategori>, String> {
    game_repo::kategori_all(&st.pool)
        .await
        .map_err(|e| e.to_string())
}

pub async fn kategori_create(
    st: &AppState,
    data: &Value,
) -> Result<crate::models::game::GameKategori, String> {
    let nama = validators::text(
        data.get("nama").and_then(Value::as_str).unwrap_or(""),
        2,
        50,
        "Nama Kategori Game",
        true,
    )?;
    if game_repo::kategori_by_nama(&st.pool, &nama)
        .await
        .map_err(|e| e.to_string())?
        .is_some()
    {
        return Err(format!("Kategori '{nama}' sudah ada"));
    }
    let _guard = st.write().await;
    let id = game_repo::kategori_insert(&st.pool, &nama)
        .await
        .map_err(|e| e.to_string())?;
    game_repo::kategori_get(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Kategori tidak ditemukan".into())
}

pub async fn kategori_delete(st: &AppState, id: i64) -> Result<(), String> {
    game_repo::kategori_get(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Kategori tidak ditemukan")?;
    let _guard = st.write().await;
    game_repo::kategori_delete(&st.pool, id)
        .await
        .map_err(|e| e.to_string())
}
