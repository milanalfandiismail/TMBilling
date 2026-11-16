//! Panduan sistem: CRUD, kategori, unggah gambar, ekspor JSON.

use std::path::PathBuf;

use serde_json::{json, Value};

use crate::repositories::tutorial as repo;
use crate::state::AppState;
use crate::utils::{time, validators};

pub type Hasil<T> = Result<T, (u16, String)>;

fn salah(pesan: impl Into<String>) -> (u16, String) {
    (400, pesan.into())
}

fn galat(e: sqlx::Error) -> (u16, String) {
    (500, e.to_string())
}

/// Pindahkan gambar draf dari `temp/` ke folder permanen dan tulis ulang URL-nya.
pub fn move_temp_images(st: &AppState, content: &str) -> String {
    let dasar = st.cfg.root.join("app/static/assets/tutorials");
    let temp = dasar.join("temp");
    let mut hasil = content.to_string();
    // Pola nama berkas draf: hex + ekstensi gambar.
    let mut sisa = content;
    while let Some(awal) = sisa.find("/static/assets/tutorials/temp/") {
        let sesudah = &sisa[awal + "/static/assets/tutorials/temp/".len()..];
        let akhir = sesudah
            .find(|c: char| !(c.is_ascii_alphanumeric() || c == '.'))
            .unwrap_or(sesudah.len());
        let nama = &sesudah[..akhir];
        if nama.contains('.') && nama.chars().all(|c| c.is_ascii_alphanumeric() || c == '.') {
            let asal = temp.join(nama);
            let tujuan = dasar.join(nama);
            if asal.exists() {
                let _ = std::fs::create_dir_all(&dasar);
                let _ = std::fs::rename(&asal, &tujuan);
            }
        }
        sisa = &sesudah[akhir..];
    }
    hasil = hasil.replace(
        "/static/assets/tutorials/temp/",
        "/static/assets/tutorials/",
    );
    hasil
}

pub async fn list(st: &AppState) -> Hasil<Value> {
    let data = repo::get_all(&st.pool).await.map_err(galat)?;
    Ok(json!({ "tutorials": data.iter().map(|t| t.to_json()).collect::<Vec<_>>() }))
}

pub async fn detail(st: &AppState, id: i64) -> Hasil<Value> {
    let t = repo::get_by_id(&st.pool, id)
        .await
        .map_err(galat)?
        .ok_or_else(|| (404, "Panduan tidak ditemukan".to_string()))?;
    Ok(json!({ "tutorial": t.to_json() }))
}

pub async fn create(st: &AppState, data: &Value) -> Hasil<Value> {
    let title =
        validators::text_opt(data.get("title"), 3, 150, "Judul Panduan", true).map_err(salah)?;
    let category = match data
        .get("category")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
    {
        Some(v) => validators::text_opt(
            Some(&Value::String(v.to_string())),
            2,
            50,
            "Kategori Panduan",
            false,
        )
        .map_err(salah)?,
        None => "Umum".to_string(),
    };
    let content = validators::text_opt(data.get("content"), 5, 100_000, "Isi Panduan", true)
        .map_err(salah)?;
    let urutan = match data.get("urutan") {
        Some(v) if !v.is_null() => {
            validators::int_opt(Some(v), 0, 10_000, "Urutan Panduan").map_err(salah)?
        }
        _ => 0,
    };
    let icon = data
        .get("icon")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let content = crate::utils::helpers::sanitize_html(&move_temp_images(st, &content));
    let now = time::db_str(time::now_db());
    let id = repo::insert(
        &st.pool,
        &title,
        icon.as_deref(),
        &category,
        &content,
        urutan,
        &now,
    )
    .await
    .map_err(galat)?;
    let t = repo::get_by_id(&st.pool, id).await.map_err(galat)?.unwrap();
    Ok(
        json!({ "success": true, "message": "Panduan berhasil ditambahkan", "tutorial": t.to_json() }),
    )
}

pub async fn update(st: &AppState, id: i64, data: &Value) -> Hasil<Value> {
    let title = match data.get("title").and_then(|v| v.as_str()) {
        Some(v) if !v.is_empty() => Some(
            validators::text_opt(
                Some(&Value::String(v.to_string())),
                3,
                150,
                "Judul Panduan",
                true,
            )
            .map_err(salah)?,
        ),
        _ => None,
    };
    let category = match data.get("category").and_then(|v| v.as_str()) {
        Some(v) if !v.is_empty() => Some(
            validators::text_opt(
                Some(&Value::String(v.to_string())),
                2,
                50,
                "Kategori Panduan",
                false,
            )
            .map_err(salah)?,
        ),
        Some(_) => Some("Umum".to_string()),
        None => None,
    };
    let content = match data.get("content").and_then(|v| v.as_str()) {
        Some(v) if !v.is_empty() => Some(crate::utils::helpers::sanitize_html(&move_temp_images(
            st,
            &validators::text_opt(
                Some(&Value::String(v.to_string())),
                5,
                100_000,
                "Isi Panduan",
                true,
            )
            .map_err(salah)?,
        ))),
        _ => None,
    };
    let urutan = match data.get("urutan") {
        Some(v) if !v.is_null() => {
            Some(validators::int_opt(Some(v), 0, 10_000, "Urutan Panduan").map_err(salah)?)
        }
        _ => None,
    };
    let icon = data.get("icon").and_then(|v| v.as_str());

    let now = time::db_str(time::now_db());
    repo::update(
        &st.pool,
        id,
        title.as_deref(),
        icon,
        category.as_deref(),
        content.as_deref(),
        urutan,
        &now,
    )
    .await
    .map_err(galat)?;
    let t = repo::get_by_id(&st.pool, id)
        .await
        .map_err(galat)?
        .ok_or_else(|| (404, "Panduan tidak ditemukan".to_string()))?;
    Ok(
        json!({ "success": true, "message": "Panduan berhasil diperbarui", "tutorial": t.to_json() }),
    )
}

pub async fn delete(st: &AppState, id: i64) -> Hasil<Value> {
    repo::get_by_id(&st.pool, id)
        .await
        .map_err(galat)?
        .ok_or_else(|| (404, "Panduan tidak ditemukan".to_string()))?;
    repo::delete(&st.pool, id).await.map_err(galat)?;
    Ok(json!({ "success": true, "message": "Panduan berhasil dihapus" }))
}

pub async fn categories(st: &AppState) -> Hasil<Value> {
    let rows = repo::categories(&st.pool).await.map_err(galat)?;
    Ok(json!({
        "categories": rows.iter().map(|(nama, jumlah)| json!({"name": nama, "count": jumlah})).collect::<Vec<_>>()
    }))
}

pub async fn delete_category(st: &AppState, nama: &str) -> Hasil<Value> {
    let jumlah = repo::delete_category(&st.pool, nama).await.map_err(galat)?;
    Ok(json!({
        "success": true,
        "message": format!("Kategori '{nama}' berhasil dihapus. {jumlah} panduan dipindahkan ke kategori Kosong.")
    }))
}

/// Simpan gambar editor ke `assets/tutorials/temp`, kembalikan URL publiknya.
pub async fn upload_image(st: &AppState, berkas: &crate::utils::http::Upload) -> Hasil<Value> {
    let ext = PathBuf::from(&berkas.filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    if !["png", "jpg", "jpeg", "webp", "gif"].contains(&ext.as_str()) {
        return Err(salah(
            "Format file tidak didukung (.png, .jpg, .jpeg, .webp, .gif)",
        ));
    }
    if image::load_from_memory(&berkas.bytes).is_err() {
        return Err(salah("File gambar tidak valid"));
    }
    let folder = st.cfg.root.join("app/static/assets/tutorials/temp");
    std::fs::create_dir_all(&folder).map_err(|e| (500, e.to_string()))?;
    let nama = format!(
        "{}.{ext}",
        crate::services::vnc::vnc_service::token_baru().replace(['-', '_'], "")
    );
    std::fs::write(folder.join(&nama), &berkas.bytes).map_err(|e| (500, e.to_string()))?;
    Ok(json!({ "url": format!("/static/assets/tutorials/temp/{nama}"), "uploaded": true }))
}

/// Hapus berkas draf yang tidak lagi dirujuk payload editor.
pub fn cleanup_temp(st: &AppState, konten: &str) -> usize {
    let folder = st.cfg.root.join("app/static/assets/tutorials/temp");
    let Ok(daftar) = std::fs::read_dir(&folder) else {
        return 0;
    };
    let mut dihapus = 0;
    for entri in daftar.flatten() {
        let nama = entri.file_name().to_string_lossy().to_string();
        if !konten.contains(&nama) {
            if std::fs::remove_file(entri.path()).is_ok() {
                dihapus += 1;
            }
        }
    }
    dihapus
}

pub async fn export_json(st: &AppState) -> Hasil<Value> {
    let data = repo::get_all(&st.pool).await.map_err(galat)?;
    let isi: Vec<Value> = data
        .iter()
        .map(|t| {
            json!({
                "title": t.title,
                "icon": t.icon.clone().unwrap_or_else(|| "🌐".into()),
                "category": t.category.clone().unwrap_or_else(|| "Umum".into()),
                "urutan": t.urutan.unwrap_or(0),
                "content": t.content,
            })
        })
        .collect();
    let folder = st.cfg.root.join("app/data");
    std::fs::create_dir_all(&folder).map_err(|e| (500, e.to_string()))?;
    let berkas = folder.join("seed_tutorials.json");
    let teks = serde_json::to_string_pretty(&isi).map_err(|e| (500, e.to_string()))?;
    std::fs::write(&berkas, teks).map_err(|e| (500, e.to_string()))?;
    Ok(json!({
        "success": true,
        "message": format!("Berhasil mengekspor {} tutorial ke JSON", isi.len()),
        "count": isi.len(),
    }))
}

/// Isi tabel panduan dari `app/data/seed_tutorials.json` saat masih kosong.
pub async fn seed(st: &AppState) -> sqlx::Result<usize> {
    if repo::count(&st.pool).await? > 0 {
        return Ok(0);
    }
    let berkas = st.cfg.root.join("app/data/seed_tutorials.json");
    let Ok(teks) = std::fs::read_to_string(berkas) else {
        return Ok(0);
    };
    let Ok(daftar) = serde_json::from_str::<Vec<Value>>(&teks) else {
        return Ok(0);
    };
    let now = time::db_str(time::now_db());
    let mut jumlah = 0;
    for (i, item) in daftar.iter().enumerate() {
        let title = item
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Panduan");
        let content = item.get("content").and_then(|v| v.as_str()).unwrap_or("");
        if content.is_empty() {
            continue;
        }
        repo::insert(
            &st.pool,
            title,
            item.get("icon").and_then(|v| v.as_str()),
            item.get("category")
                .and_then(|v| v.as_str())
                .unwrap_or("Umum"),
            content,
            item.get("urutan")
                .and_then(|v| v.as_i64())
                .unwrap_or(i as i64),
            &now,
        )
        .await?;
        jumlah += 1;
    }
    Ok(jumlah)
}
