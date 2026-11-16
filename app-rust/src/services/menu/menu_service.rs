//! Business logic katalog F&B: CRUD menu, restock, arsip, checkout, log stok.

use crate::models::menu::MenuItem;
use crate::models::user::User;
use crate::repositories::menu as repo;
use crate::repositories::user as user_repo;
use crate::services::settings::settings_service;
use crate::state::AppState;
use crate::utils::{http::Upload, idempotency, logger, time, validators};
use chrono::NaiveDate;
use serde_json::{json, Value};

const GAMBAR_PREFIX: &str = "/static/uploads/menu/";
const EXT_GAMBAR: [&str; 5] = ["png", "jpg", "jpeg", "gif", "webp"];
const MAX_PIKSEL: u64 = 40_000_000;
const METODE_DEFAULT: [&str; 5] = ["Tunai", "QRIS", "Transfer", "Transfer Bank", "Deposit"];

pub async fn tz_name(st: &AppState) -> String {
    settings_service::get_or(st, "timezone", time::DEFAULT_TZ).await
}

fn kosong_ke_none(raw: Option<&Value>) -> Option<String> {
    match raw {
        Some(Value::String(s)) => {
            let s = s.trim().to_string();
            if s.is_empty() {
                None
            } else {
                Some(s)
            }
        }
        Some(Value::Null) | None => None,
        Some(other) => Some(other.to_string()),
    }
}

fn validasi_gambar_path(raw: Option<&Value>) -> Result<Option<String>, String> {
    let Some(nilai) = kosong_ke_none(raw) else {
        return Ok(None);
    };
    if !nilai.starts_with(GAMBAR_PREFIX) {
        return Err("Path gambar menu tidak valid".into());
    }
    Ok(Some(nilai))
}

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

/// Validasi isi gambar (pengganti `PIL.Image.verify`) lalu simpan ke `static/uploads/menu`.
fn simpan_gambar(st: &AppState, upload: &Upload) -> Result<String, String> {
    let nama = nama_berkas_aman(&upload.filename);
    let ext = nama.rsplit('.').next().unwrap_or("").to_lowercase();
    if !nama.contains('.') || !EXT_GAMBAR.contains(&ext.as_str()) {
        return Err(format!(
            "Format berkas '{}' tidak diizinkan. Gunakan: png, jpg, jpeg, gif, webp",
            upload.filename
        ));
    }
    // shortcut: dekode penuh sekali (Pillow hanya verify); cukup untuk berkas menu.
    let gambar = image::load_from_memory(&upload.bytes).map_err(|_| "File gambar tidak valid")?;
    if u64::from(gambar.width()) * u64::from(gambar.height()) > MAX_PIKSEL {
        return Err("Gambar terlalu besar (maksimum 40 megapiksel)".into());
    }
    let folder = st.cfg.root.join("app/static/uploads/menu");
    std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    let unik = format!(
        "{}_{:08x}.{}",
        nama.rsplit_once('.').map(|(b, _)| b).unwrap_or(&nama),
        rand::random::<u32>(),
        ext
    );
    std::fs::write(folder.join(&unik), &upload.bytes).map_err(|e| e.to_string())?;
    Ok(format!("{GAMBAR_PREFIX}{unik}"))
}

fn hapus_gambar(st: &AppState, path: &str) {
    let nama = nama_berkas_aman(path);
    let _ = std::fs::remove_file(st.cfg.root.join("app/static/uploads/menu").join(nama));
}

async fn menu_aktif(st: &AppState, id: i64) -> Result<MenuItem, String> {
    repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Menu tidak ditemukan".to_string())
}

pub async fn get_all(st: &AppState) -> Result<Vec<MenuItem>, String> {
    repo::get_all(&st.pool).await.map_err(|e| e.to_string())
}

pub async fn get_archived(st: &AppState) -> Result<Vec<Value>, String> {
    let rows = repo::get_archived(&st.pool)
        .await
        .map_err(|e| e.to_string())?;
    let counts = repo::count_transaksi_grouped(&st.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|m| {
            let mut v = m.to_json();
            v["transaksi_count"] = json!(counts.get(&m.id).copied().unwrap_or(0));
            v
        })
        .collect())
}

pub async fn create(
    st: &AppState,
    data: &Value,
    upload: Option<&Upload>,
    operator: &str,
) -> Result<MenuItem, String> {
    let gambar_path = match upload {
        Some(u) => Some(simpan_gambar(st, u)?),
        None => validasi_gambar_path(data.get("gambar_path"))?,
    };
    let nama = validators::text(
        data.get("nama").and_then(Value::as_str).unwrap_or(""),
        2,
        100,
        "Nama menu",
        true,
    )?;
    let harga = validators::int_range(
        data.get("harga").unwrap_or(&Value::Number(0.into())),
        0,
        1_000_000_000,
        "Harga menu",
    )?;
    let stok = validators::int_range(
        data.get("stok").unwrap_or(&Value::Number(0.into())),
        -1,
        1_000_000,
        "Stok menu",
    )?;

    if repo::find_by_nama(&st.pool, &nama)
        .await
        .map_err(|e| e.to_string())?
        .is_some()
    {
        return Err(format!("Menu dengan nama '{nama}' sudah terdaftar"));
    }

    let _guard = st.write().await;
    let arsip = repo::find_by_nama_any(&st.pool, &nama)
        .await
        .map_err(|e| e.to_string())?;
    if let Some(menu) = arsip.filter(|m| !m.is_active) {
        let path = gambar_path.or(menu.gambar_path.clone());
        repo::update(&st.pool, menu.id, &nama, harga, stok, path.as_deref(), true)
            .await
            .map_err(|e| e.to_string())?;
        logger::audit_json(
            operator,
            "RESTORE_MENU",
            &format!("Menu '{nama}' direstore dari arsip dengan data baru"),
            None,
            "",
            "",
            json!({"nama": nama, "harga": harga, "stok": stok}),
        );
        return menu_aktif(st, menu.id).await;
    }

    let id = repo::insert(&st.pool, &nama, harga, stok, gambar_path.as_deref())
        .await
        .map_err(|e| e.to_string())?;
    logger::audit_json(
        operator,
        "TAMBAH_MENU",
        &format!("Menu '{nama}' berhasil ditambahkan ke katalog"),
        None,
        "",
        "",
        json!({"nama": nama, "harga": harga, "stok": stok}),
    );
    menu_aktif(st, id).await
}

pub async fn update(
    st: &AppState,
    id: i64,
    data: &Value,
    upload: Option<&Upload>,
    operator: &str,
) -> Result<MenuItem, String> {
    let menu = menu_aktif(st, id).await?;
    let mut nama = menu.nama.clone();
    if let Some(raw) = data.get("nama").and_then(Value::as_str) {
        let cleaned = raw.trim();
        if !cleaned.is_empty() && cleaned != menu.nama {
            let baru = validators::text(cleaned, 2, 100, "Nama menu", true)?;
            if repo::find_by_nama(&st.pool, &baru)
                .await
                .map_err(|e| e.to_string())?
                .is_some()
            {
                return Err(format!("Menu dengan nama '{baru}' sudah terdaftar"));
            }
            if let Some(bentrok) = repo::find_by_nama_any(&st.pool, &baru)
                .await
                .map_err(|e| e.to_string())?
            {
                if bentrok.id != menu.id {
                    return Err(format!(
                        "Menu dengan nama '{baru}' sudah terdaftar (di arsip)"
                    ));
                }
            }
            nama = baru;
        }
    }

    let harga = match data.get("harga") {
        Some(v) => validators::int_range(v, 0, 1_000_000_000, "Harga menu")?,
        None => menu.harga,
    };
    let stok = match data.get("stok") {
        Some(v) => validators::int_range(v, -1, 1_000_000, "Stok menu")?,
        None => menu.stok,
    };

    let hapus = data
        .get("hapus_gambar")
        .map(|v| v.as_bool().unwrap_or_else(|| v.as_str() == Some("true")))
        .unwrap_or(false);

    let mut gambar_path = menu.gambar_path.clone();
    if let Some(u) = upload {
        let baru = simpan_gambar(st, u)?;
        if let Some(lama) = gambar_path.as_deref() {
            hapus_gambar(st, lama);
        }
        gambar_path = Some(baru);
    } else if hapus {
        if let Some(lama) = gambar_path.as_deref() {
            hapus_gambar(st, lama);
        }
        gambar_path = None;
    } else if data.get("gambar_path").is_some() {
        let baru = validasi_gambar_path(data.get("gambar_path"))?;
        if gambar_path != baru {
            if let Some(lama) = gambar_path.as_deref() {
                hapus_gambar(st, lama);
            }
        }
        gambar_path = baru;
    }

    let _guard = st.write().await;
    repo::update(
        &st.pool,
        menu.id,
        &nama,
        harga,
        stok,
        gambar_path.as_deref(),
        true,
    )
    .await
    .map_err(|e| e.to_string())?;
    logger::audit_json(
        operator,
        "EDIT_MENU",
        &format!("Menu '{nama}' berhasil diupdate"),
        None,
        "",
        "",
        json!({"nama": nama, "harga": harga, "stok": stok}),
    );
    menu_aktif(st, id).await
}

pub async fn tambah_stok(
    st: &AppState,
    id: i64,
    jumlah_raw: Option<&Value>,
    catatan: Option<&str>,
    operator: &str,
) -> Result<MenuItem, String> {
    let menu = repo::get_by_id(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Menu tidak ditemukan atau tidak aktif".to_string())?;
    let jumlah = match jumlah_raw.filter(|v| !v.is_null()) {
        Some(v) => validators::int_range(v, 1, 1_000_000, "Jumlah penambahan stok")?,
        None => return Err("Jumlah penambahan stok harus diisi".into()),
    };
    if menu.stok < 0 {
        return Err(format!(
            "Menu '{}' berstatus stok Unlimited (tidak terbatas)",
            menu.nama
        ));
    }
    let stok_baru = menu.stok + jumlah;
    if stok_baru > 1_000_000 {
        return Err("Akumulasi total stok tidak boleh melebihi 1.000.000 unit".into());
    }
    let catatan_clean = catatan
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);

    let _guard = st.write().await;
    repo::set_stok(&st.pool, menu.id, stok_baru)
        .await
        .map_err(|e| e.to_string())?;
    let tz = tz_name(st).await;
    repo::insert_stock_log(
        &st.pool,
        &repo::StockLogBaru {
            menu_id: menu.id,
            menu_nama: &menu.nama,
            jumlah_masuk: jumlah,
            stok_sebelum: menu.stok,
            stok_sesudah: stok_baru,
            operator,
            catatan: catatan_clean.as_deref(),
            created_at: &time::format_local_now(&tz),
        },
    )
    .await
    .map_err(|e| e.to_string())?;

    let mut pesan = format!(
        "Penambahan stok '{}' sebanyak +{jumlah} unit (Stok: {} -> {stok_baru})",
        menu.nama, menu.stok
    );
    if let Some(c) = catatan_clean.as_deref() {
        pesan.push_str(&format!(" | Catatan: {c}"));
    }
    logger::audit_json(
        operator,
        "RESTOCK_MENU",
        &pesan,
        None,
        "",
        "",
        json!({
            "menu_id": menu.id,
            "nama": menu.nama,
            "jumlah_tambah": jumlah,
            "stok_lama": menu.stok,
            "stok_baru": stok_baru,
            "catatan": catatan_clean.clone().unwrap_or_else(|| "-".into()),
        }),
    );
    menu_aktif(st, id).await
}

pub async fn archive(st: &AppState, id: i64, operator: &str) -> Result<String, String> {
    let menu = repo::get_by_id_any(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Menu tidak ditemukan".to_string())?;
    if !menu.is_active {
        return Err("Menu sudah diarsipkan sebelumnya".into());
    }
    let transaksi_count = repo::count_transaksi(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?;
    let _guard = st.write().await;
    repo::set_active(&st.pool, id, false)
        .await
        .map_err(|e| e.to_string())?;
    logger::audit_json(
        operator,
        "ARSIP_MENU",
        &format!("Menu '{}' diarsipkan ke daftar arsip menu", menu.nama),
        None,
        "",
        "",
        json!({"nama": menu.nama, "transaksi_historis": transaksi_count}),
    );
    Ok(menu.nama)
}

pub async fn restore(st: &AppState, id: i64, operator: &str) -> Result<MenuItem, String> {
    let menu = repo::get_by_id_any(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Menu tidak ditemukan".to_string())?;
    if menu.is_active {
        return Ok(menu);
    }
    if let Some(dup) = repo::find_by_nama(&st.pool, &menu.nama)
        .await
        .map_err(|e| e.to_string())?
    {
        if dup.id != menu.id {
            return Err(format!(
                "Menu aktif dengan nama '{}' sudah ada di katalog",
                menu.nama
            ));
        }
    }
    let _guard = st.write().await;
    repo::set_active(&st.pool, id, true)
        .await
        .map_err(|e| e.to_string())?;
    logger::audit_json(
        operator,
        "RESTORE_MENU",
        &format!(
            "Menu '{}' berhasil dipulihkan dari arsip ke katalog aktif",
            menu.nama
        ),
        None,
        "",
        "",
        json!({"nama": menu.nama, "harga": menu.harga, "stok": menu.stok}),
    );
    menu_aktif(st, id).await
}

/// Hapus permanen menu **beserta** seluruh transaksi F&B terkait.
pub async fn hard_delete(st: &AppState, id: i64, operator: &str) -> Result<(String, i64), String> {
    let menu = repo::get_by_id_any(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Menu tidak ditemukan".to_string())?;
    let transaksi_count = repo::count_transaksi(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?;
    let _guard = st.write().await;
    repo::delete_transaksi_by_menu(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?;
    repo::delete(&st.pool, id)
        .await
        .map_err(|e| e.to_string())?;
    if let Some(path) = menu.gambar_path.as_deref() {
        hapus_gambar(st, path);
    }
    logger::audit_json(
        operator,
        "HAPUS_MENU_PERMANEN",
        &format!(
            "Menu '{}' beserta {transaksi_count} transaksi terkait dihapus permanen",
            menu.nama
        ),
        None,
        "",
        "",
        json!({"nama": menu.nama, "transaksi_dihapus": transaksi_count}),
    );
    Ok((menu.nama, transaksi_count))
}

/// Metode pembayaran sah = default sistem + konfigurasi `payment_methods`.
async fn metode_pembayaran(st: &AppState, raw: Option<&str>) -> Result<String, String> {
    let raw = raw
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("Tunai");
    let mut pilihan: Vec<String> = METODE_DEFAULT.iter().map(|s| s.to_string()).collect();
    if let Some(conf) = settings_service::get(st, "payment_methods").await {
        for item in conf.split(',').map(str::trim).filter(|s| !s.is_empty()) {
            if !pilihan
                .iter()
                .any(|p| p.to_lowercase() == item.to_lowercase())
            {
                pilihan.push(item.to_string());
            }
        }
    }
    pilihan
        .iter()
        .find(|p| p.to_lowercase() == raw.to_lowercase())
        .cloned()
        .ok_or_else(|| {
            format!(
                "Metode pembayaran tidak valid. Pilihan yang tersedia: {}",
                pilihan.join(", ")
            )
        })
}

fn rupiah(n: i64) -> String {
    let s = n.abs().to_string();
    let mut out = String::new();
    for (i, ch) in s.chars().enumerate() {
        if i > 0 && (s.len() - i) % 3 == 0 {
            out.push('.');
        }
        out.push(ch);
    }
    if n < 0 {
        format!("-{out}")
    } else {
        out
    }
}

pub async fn generate_nota_menu(st: &AppState) -> Result<String, String> {
    let tz = tz_name(st).await;
    let date_str = time::today_local(&tz).format("%Y%m%d").to_string();
    let seq = repo::max_nota_seq(&st.pool, &date_str)
        .await
        .map_err(|e| e.to_string())?
        + 1;
    Ok(format!(
        "TMM-{date_str}-{:03}-{:06x}",
        seq,
        rand::random::<u32>() & 0xFF_FFFF
    ))
}

pub async fn checkout(st: &AppState, data: &Value, kasir: &User) -> Result<Vec<Value>, String> {
    let items = data
        .get("cart_items")
        .and_then(Value::as_array)
        .cloned()
        .filter(|v| !v.is_empty())
        .ok_or_else(|| "Daftar belanjaan kosong atau tidak valid".to_string())?;

    let base_username = kasir
        .username
        .split(" (")
        .next()
        .unwrap_or("")
        .trim()
        .to_string();
    let kasir_row = user_repo::get_by_username(&st.pool, &base_username)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Kasir tidak valid".to_string())?;

    let no_nota = generate_nota_menu(st).await?;
    let tz = tz_name(st).await;
    let tanggal = time::format_local_now(&tz);

    struct Baris {
        menu: MenuItem,
        jumlah: i64,
        subtotal: i64,
    }
    let mut baris: Vec<Baris> = Vec::new();
    let mut total_tagihan: i64 = 0;
    for item in &items {
        let menu_id = item.get("menu_id").and_then(Value::as_i64).unwrap_or(0);
        let jumlah = validators::int_range(
            item.get("jumlah").unwrap_or(&Value::Number(0.into())),
            1,
            1000,
            "Kuantitas pesanan",
        )?;
        let menu = repo::get_by_id(&st.pool, menu_id)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Menu dengan ID {menu_id} tidak ditemukan"))?;
        if menu.stok >= 0 && menu.stok < jumlah {
            return Err(format!(
                "Stok '{}' tidak mencukupi (Tersedia: {}, Diminta: {jumlah})",
                menu.nama, menu.stok
            ));
        }
        let subtotal = menu.harga * jumlah;
        total_tagihan += subtotal;
        baris.push(Baris {
            menu,
            jumlah,
            subtotal,
        });
    }

    let metode =
        metode_pembayaran(st, data.get("metode_pembayaran").and_then(Value::as_str)).await?;
    let tunai = validators::int_range(
        data.get("tunai").unwrap_or(&Value::Number(0.into())),
        0,
        1_000_000_000,
        "Uang tunai",
    )?;
    let mut kembalian = 0i64;
    if metode == "Tunai" {
        if tunai < total_tagihan {
            return Err(format!(
                "Uang tunai (Rp {}) kurang dari total tagihan (Rp {})",
                rupiah(tunai),
                rupiah(total_tagihan)
            ));
        }
        kembalian = tunai - total_tagihan;
    }

    // Klaim idempotensi setelah validasi: request yang ditolak tidak membakar kunci retry.
    let kunci = data.get("client_request_id").and_then(Value::as_str);
    if !idempotency::claim(kunci.unwrap_or("")) {
        return Err("Permintaan ini sudah diproses".into());
    }

    let pc_kode = data
        .get("pc_kode")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty());

    let _guard = st.write().await;
    let mut hasil = Vec::new();
    for b in &baris {
        if b.menu.stok >= 0
            && !repo::decrement_stok_if_available(&st.pool, b.menu.id, b.jumlah)
                .await
                .map_err(|e| e.to_string())?
        {
            return Err(format!("Stok '{}' tidak mencukupi", b.menu.nama));
        }
        let trx = repo::insert_transaksi(
            &st.pool,
            &repo::TransaksiBaru {
                no_nota: &no_nota,
                menu_id: b.menu.id,
                jumlah: b.jumlah,
                total_harga: b.subtotal,
                pc_kode,
                kasir_id: kasir_row.id,
                tunai: if tunai > 0 { Some(tunai) } else { None },
                kembalian: if tunai > 0 { Some(kembalian) } else { None },
                metode_pembayaran: &metode,
                operator: &kasir.username,
                tanggal: &tanggal,
            },
        )
        .await
        .map_err(|e| e.to_string())?;
        logger::audit_json(
            &kasir.username,
            "TRANSAKSI_MENU",
            &format!(
                "Penjualan {} x{} (Total: Rp{}) sukses via {no_nota}",
                b.menu.nama,
                b.jumlah,
                rupiah(b.subtotal)
            ),
            None,
            "",
            "",
            json!({
                "no_nota": no_nota,
                "nama_menu": b.menu.nama,
                "jumlah_qty": b.jumlah,
                "total_harga": b.subtotal,
                "pc_kode": pc_kode,
                "metode_pembayaran": metode,
                "tunai": if tunai > 0 { Some(tunai) } else { None },
                "kembalian": if tunai > 0 { Some(kembalian) } else { None },
            }),
        );
        hasil.push(trx.to_json(&tz));
    }
    Ok(hasil)
}

pub struct HasilLog {
    pub items: Vec<Value>,
    pub total: i64,
    pub page: i64,
    pub pages: i64,
    pub has_prev: bool,
    pub has_next: bool,
    pub operators: Vec<String>,
    pub dates: Vec<String>,
}

fn bukan_filter(v: Option<&str>) -> Option<String> {
    v.map(str::trim)
        .filter(|s| !s.is_empty())
        .filter(|s| !matches!(s.to_lowercase().as_str(), "all" | "semua" | "none"))
        .map(str::to_string)
}

fn angka_atau(v: Option<&str>, bawaan: i64) -> Value {
    v.and_then(|s| s.trim().parse::<i64>().ok())
        .map(Value::from)
        .unwrap_or(Value::from(bawaan))
}

pub async fn stock_logs(
    st: &AppState,
    tanggal: Option<&str>,
    menu_id: Option<&str>,
    operator: Option<&str>,
    search: Option<&str>,
    page: Option<&str>,
    per_page: Option<&str>,
) -> Result<HasilLog, String> {
    let tz = tz_name(st).await;
    let page = validators::int_range(&angka_atau(page, 1), 1, 100_000, "Halaman")?;
    let per_page = validators::int_range(&angka_atau(per_page, 15), 1, 100, "Jumlah per halaman")?;

    let rentang = match bukan_filter(tanggal) {
        Some(t) => {
            let d = NaiveDate::parse_from_str(&t, "%Y-%m-%d")
                .map_err(|_| "Tanggal tidak valid".to_string())?;
            Some(time::day_range_utc(d, &tz))
        }
        None => None,
    };
    let menu_filter = bukan_filter(menu_id)
        .and_then(|v| v.parse::<i64>().ok())
        .filter(|v| *v > 0);
    let operator_filter = bukan_filter(operator);
    let search_filter = bukan_filter(search);

    let filter = repo::FilterLog {
        start: rentang.as_ref().map(|r| r.0.as_str()),
        end: rentang.as_ref().map(|r| r.1.as_str()),
        menu_id: menu_filter,
        operator: operator_filter.as_deref(),
        search: search_filter.as_deref(),
    };
    let (rows, total) = repo::stock_logs_page(&st.pool, &filter, page, per_page)
        .await
        .map_err(|e| e.to_string())?;

    let mut operators = repo::distinct_operators(&st.pool)
        .await
        .map_err(|e| e.to_string())?;
    operators.sort();

    let mentah = repo::distinct_dates(&st.pool)
        .await
        .map_err(|e| e.to_string())?;
    let mut dates: Vec<String> = mentah
        .iter()
        .filter_map(|raw| chrono::NaiveDateTime::parse_from_str(raw, "%Y-%m-%d %H:%M:%S%.f").ok())
        .map(|utc| {
            chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(utc, chrono::Utc)
                .with_timezone(&time::tz(&tz))
                .date_naive()
                .format("%Y-%m-%d")
                .to_string()
        })
        .collect();
    dates.sort();
    dates.dedup();
    dates.reverse();

    let pages = if total == 0 {
        0
    } else {
        (total + per_page - 1) / per_page
    };
    Ok(HasilLog {
        items: rows.iter().map(|r| r.to_json(&tz)).collect(),
        total,
        page,
        pages,
        has_prev: page > 1,
        has_next: page < pages,
        operators,
        dates,
    })
}

pub async fn log_dates(st: &AppState) -> Result<Vec<String>, String> {
    Ok(stock_logs(st, None, None, None, None, Some("1"), Some("1"))
        .await?
        .dates)
}
