//! Tiket perawatan + laporan.

use serde_json::{json, Value};

use crate::repositories::maintenance as repo;
use crate::state::AppState;
use crate::utils::{time, validators};

pub type Hasil<T> = Result<T, (u16, String)>;

fn salah(pesan: impl Into<String>) -> (u16, String) {
    (400, pesan.into())
}

fn galat(e: sqlx::Error) -> (u16, String) {
    (500, e.to_string())
}

fn pilihan(nilai: &str, opsi: &[&str], field: &str) -> Hasil<String> {
    let atas = nilai.to_uppercase();
    if opsi.contains(&atas.as_str()) {
        Ok(atas)
    } else {
        Err(salah(format!(
            "{field} tidak valid. Pilihan yang tersedia: {}",
            opsi.join(", ")
        )))
    }
}

pub async fn create(st: &AppState, data: &Value, reporter: &str) -> Hasil<Value> {
    let pc_id = data
        .get("pc_id")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| salah("PC tidak ditemukan"))?;
    let kategori = data.get("kategori").and_then(|v| v.as_str()).unwrap_or("");
    let prioritas = data.get("prioritas").and_then(|v| v.as_str()).unwrap_or("");
    let judul = data.get("judul").and_then(|v| v.as_str()).unwrap_or("");
    let deskripsi = data.get("deskripsi").and_then(|v| v.as_str());

    let _ = crate::repositories::pc::get_by_id(&st.pool, pc_id)
        .await
        .map_err(|e| (500, e.to_string()))?
        .ok_or_else(|| salah(format!("PC dengan ID {pc_id} tidak ditemukan.")))?;

    let kategori = pilihan(
        kategori,
        &["HARDWARE", "SOFTWARE", "JARINGAN", "LAINNYA"],
        "Kategori Tiket",
    )?;
    let prioritas = pilihan(
        prioritas,
        &["RENDAH", "SEDANG", "TINGGI", "KRITIS"],
        "Prioritas Tiket",
    )?;
    let judul = validators::text_opt(
        Some(&Value::String(judul.to_string())),
        3,
        150,
        "Judul Tiket",
        true,
    )
    .map_err(salah)?;
    let deskripsi = match deskripsi {
        Some(v) if !v.is_empty() => Some(
            validators::text_opt(
                Some(&Value::String(v.to_string())),
                0,
                1000,
                "Deskripsi Tiket",
                false,
            )
            .map_err(salah)?,
        ),
        _ => None,
    };

    let now = time::db_str(time::now_db());
    let id = {
        let _guard = st.write().await;
        let id = repo::insert(
            &st.pool,
            pc_id,
            reporter,
            &kategori,
            &prioritas,
            &judul,
            deskripsi.as_deref(),
            &now,
        )
        .await
        .map_err(galat)?;
        if prioritas == "KRITIS" {
            repo::set_pc_aktif(&st.pool, pc_id, false)
                .await
                .map_err(galat)?;
        }
        id
    };

    let tiket = repo::get(&st.pool, id)
        .await
        .map_err(galat)?
        .ok_or_else(|| salah("Tiket tidak ditemukan"))?;
    crate::utils::logger::audit_json(
        reporter,
        "BUAT_TIKET",
        &format!(
            "Tiket {kategori} PC {} dibuat (Prioritas {prioritas})",
            tiket.pc_kode.clone().unwrap_or_default()
        ),
        None,
        "",
        "",
        json!({"pc_kode": tiket.pc_kode, "reporter": reporter, "kategori": kategori,
               "prioritas": prioritas, "judul": judul}),
    );
    // Respons route memakai `ticket.to_dict()`.
    Ok(tiket.to_json(&st.cfg.timezone))
}

pub async fn list(st: &AppState, q: &Value) -> Hasil<Value> {
    let status = q
        .get("status")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty());
    let pc_id = q.get("pc_id").and_then(|v| v.as_i64());
    let grup = q
        .get("grup")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty());
    let limit = match q.get("limit") {
        Some(v) => validators::int_opt(Some(v), 1, 500, "Limit tiket").map_err(salah)?,
        None => 50,
    };
    let tiket = repo::list(&st.pool, status, pc_id, grup, limit)
        .await
        .map_err(galat)?;
    Ok(json!({ "tickets": tiket.iter().map(|t| t.to_json(&st.cfg.timezone)).collect::<Vec<_>>() }))
}

pub async fn update_status(st: &AppState, id: i64, data: &Value, operator: &str) -> Hasil<Value> {
    let status_mentah = data.get("status").and_then(|v| v.as_str()).unwrap_or("");
    if status_mentah.is_empty() {
        return Err(salah("Status harus diisi"));
    }
    let status = pilihan(
        status_mentah,
        &["BARU", "DIPROSES", "SELESAI", "DITOLAK"],
        "Status Tiket",
    )?;
    let biaya = match data.get("biaya") {
        Some(v) if !v.is_null() => {
            validators::int_opt(Some(v), 0, 100_000_000, "Biaya Perbaikan").map_err(salah)?
        }
        _ => 0,
    };
    let resolusi = data
        .get("resolusi")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| {
            validators::text_opt(
                Some(&Value::String(s.to_string())),
                0,
                1000,
                "Resolusi Tiket",
                false,
            )
        })
        .transpose()
        .map_err(salah)?;

    let now = time::db_str(time::now_db());
    let tiket = {
        let _guard = st.write().await;
        let tiket = repo::get(&st.pool, id)
            .await
            .map_err(galat)?
            .ok_or_else(|| salah(format!("Tiket dengan ID {id} tidak ditemukan.")))?;
        let resolved_at = if status == "SELESAI" {
            Some(now.as_str())
        } else {
            None
        };
        let resolved_by = if status == "SELESAI" {
            Some(operator)
        } else {
            None
        };
        repo::set_status(
            &st.pool,
            id,
            &status,
            resolusi.as_deref(),
            biaya,
            resolved_by,
            resolved_at,
            &now,
        )
        .await
        .map_err(galat)?;
        if status == "SELESAI" {
            if let Some(pc_id) = tiket.pc_id {
                if !repo::ada_kritis_terbuka(&st.pool, pc_id, id)
                    .await
                    .map_err(galat)?
                {
                    repo::set_pc_aktif(&st.pool, pc_id, true)
                        .await
                        .map_err(galat)?;
                }
            }
        }
        repo::get(&st.pool, id).await.map_err(galat)?
    };
    let tiket = tiket.ok_or_else(|| salah("Tiket tidak ditemukan"))?;

    crate::utils::logger::audit_json(
        operator,
        "UPDATE_TIKET",
        &format!(
            "Tiket PC {} diupdate ke {status}",
            tiket.pc_kode.clone().unwrap_or_default()
        ),
        None,
        "",
        "",
        json!({"pc_kode": tiket.pc_kode, "status": status, "resolved_by": operator, "biaya": biaya}),
    );
    Ok(tiket.to_json(&st.cfg.timezone))
}

pub async fn report(st: &AppState, q: &Value) -> Hasil<Value> {
    let tanggal = |kunci: &str| -> Hasil<Option<String>> {
        match q
            .get(kunci)
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
        {
            None => Ok(None),
            Some(v) => {
                let d = chrono::NaiveDate::parse_from_str(v, "%Y-%m-%d")
                    .map_err(|_| salah("Format tanggal salah. Gunakan YYYY-MM-DD"))?;
                let (mulai, _) = time::day_range_utc(d, &st.cfg.timezone);
                let (_, akhir) = time::day_range_utc(d, &st.cfg.timezone);
                Ok(if kunci == "start_date" {
                    Some(mulai)
                } else {
                    Some(akhir)
                })
            }
        }
    };
    let start = tanggal("start_date")?;
    let end = tanggal("end_date")?;
    let pc_id = q.get("pc_id").and_then(|v| v.as_i64());
    let grup = q
        .get("grup")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty());
    let kategori = q
        .get("kategori")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty());
    let page = q.get("page").and_then(|v| v.as_i64()).unwrap_or(1).max(1);
    let per_page = q
        .get("per_page")
        .and_then(|v| v.as_i64())
        .unwrap_or(5)
        .clamp(1, 100);

    let (total, biaya, per_kategori, baris) = repo::report(
        &st.pool,
        start.as_deref(),
        end.as_deref(),
        pc_id,
        grup,
        kategori,
    )
    .await
    .map_err(galat)?;

    let pages = ((total + per_page - 1) / per_page).max(1);
    let mulai = ((page - 1) * per_page) as usize;
    let halaman: Vec<Value> = baris
        .iter()
        .skip(mulai)
        .take(per_page as usize)
        .map(|t| t.to_json(&st.cfg.timezone))
        .collect();

    let mut breakdown = serde_json::Map::new();
    for nama in ["HARDWARE", "SOFTWARE", "JARINGAN", "LAINNYA"] {
        breakdown.insert(nama.to_string(), json!(0));
    }
    for (nama, jumlah) in per_kategori {
        breakdown.insert(nama, json!(jumlah));
    }
    let breakdown = Value::Object(breakdown);
    let mut per_pc: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    for t in &baris {
        *per_pc
            .entry(t.pc_kode.clone().unwrap_or_else(|| "N/A".into()))
            .or_insert(0) += 1;
    }
    let mut teratas: Vec<(String, i64)> = per_pc.into_iter().collect();
    teratas.sort_by(|a, b| b.1.cmp(&a.1));
    teratas.truncate(5);

    Ok(json!({
        "list_tiket": halaman,
        "total_biaya": biaya,
        "total_kasus": total,
        "rata_rata_biaya": if total > 0 { biaya / total } else { 0 },
        "breakdown_kategori": breakdown,
        "pc_paling_sering_rusak": teratas.iter().map(|(k, v)| json!({"pc_kode": k, "jumlah": v})).collect::<Vec<_>>(),
        "pagination": {"page": page, "per_page": per_page, "total": total, "pages": pages},
    }))
}

pub async fn delete(st: &AppState, id: i64, operator: &str) -> Hasil<String> {
    let _guard = st.write().await;
    let tiket = repo::get(&st.pool, id)
        .await
        .map_err(galat)?
        .ok_or_else(|| salah(format!("Tiket dengan ID {id} tidak ditemukan.")))?;
    let kritis_terbuka = tiket.prioritas == "KRITIS"
        && matches!(tiket.status.as_deref(), Some("BARU") | Some("DIPROSES"));
    repo::delete(&st.pool, id).await.map_err(galat)?;
    if kritis_terbuka {
        if let Some(pc_id) = tiket.pc_id {
            if !repo::ada_kritis_terbuka(&st.pool, pc_id, -1)
                .await
                .map_err(galat)?
            {
                repo::set_pc_aktif(&st.pool, pc_id, true)
                    .await
                    .map_err(galat)?;
            }
        }
    }
    crate::utils::logger::audit_json(
        operator,
        "HAPUS_TIKET",
        "Tiket dihapus",
        None,
        "",
        "",
        json!({"ticket_id": id}),
    );
    Ok(format!("Tiket #{id} berhasil dihapus."))
}
