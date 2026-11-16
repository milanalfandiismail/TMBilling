//! Logika bracket Playoffs (single elimination) dan Swiss matchmaking.

use std::collections::{HashMap, HashSet};

use serde_json::{json, Value};
use sqlx::SqlitePool;

use crate::models::tournament::Match;
use crate::repositories::tournament as repo;
use crate::state::AppState;
use crate::utils::time;

pub type Hasil<T> = Result<T, (u16, String)>;

fn salah(pesan: impl Into<String>) -> (u16, String) {
    (400, pesan.into())
}

fn now_db() -> String {
    time::db_str(time::now_db())
}

/// Pemenang maju ke slot `match_number % 2` pada `next_match_id`.
async fn advance(pool: &SqlitePool, m: &Match, winner: i64) -> sqlx::Result<()> {
    if let Some(next) = m.next_match_id {
        repo::set_slot(pool, next, m.match_number, winner).await?;
    }
    Ok(())
}

/// Bracket playoff digenerate dari babak final mundur ke babak awal.
async fn generate_bracket(
    pool: &SqlitePool,
    turnamen_id: i64,
    tahap_id: i64,
    teams: &[i64],
    bo: i64,
) -> sqlx::Result<()> {
    let t = teams.len();
    if t < 2 {
        return Ok(());
    }
    let mut n = 2usize;
    while n < t {
        n *= 2;
    }
    let rounds = (n as f64).log2() as i64;
    let now = now_db();
    let mut next_round: Vec<i64> = Vec::new();

    for r in (1..=rounds).rev() {
        let jumlah = 2usize.pow((rounds - r) as u32);
        let mut current: Vec<i64> = Vec::new();
        for i in 0..jumlah {
            let next_id = if r < rounds {
                next_round.get(i / 2).copied()
            } else {
                None
            };
            let m = Match {
                id: 0,
                turnamen_id,
                tahap_id,
                round_number: r,
                match_number: (i + 1) as i64,
                tim1_id: None,
                tim2_id: None,
                skor1: Some(0),
                skor2: Some(0),
                pemenang_id: None,
                bo_format: Some(bo),
                next_match_id: next_id,
            };
            current.push(repo::insert_match(pool, &m, &now).await?);
        }
        next_round = current;
    }

    for (i, &match_id) in next_round.iter().enumerate() {
        let tim1 = teams.get(2 * i).copied();
        let tim2 = teams.get(2 * i + 1).copied();
        if let Some(t1) = tim1 {
            sqlx::query("UPDATE turnamen_match SET tim1_id = ? WHERE id = ?")
                .bind(t1)
                .bind(match_id)
                .execute(pool)
                .await?;
        }
        if let Some(t2) = tim2 {
            sqlx::query("UPDATE turnamen_match SET tim2_id = ? WHERE id = ?")
                .bind(t2)
                .bind(match_id)
                .execute(pool)
                .await?;
        }
        // Bye: tim tunggal langsung menang dan maju.
        if let (Some(t1), None) = (tim1, tim2) {
            sqlx::query(
                "UPDATE turnamen_match SET skor1 = 1, skor2 = 0, pemenang_id = ? WHERE id = ?",
            )
            .bind(t1)
            .bind(match_id)
            .execute(pool)
            .await?;
            if let Some(m) = repo::get_match(pool, match_id).await? {
                advance(pool, &m, t1).await?;
            }
        }
    }
    Ok(())
}

/// Klasemen Swiss: menang/kalah/bye dan lawan yang sudah dihadapi.
pub async fn standings(pool: &SqlitePool, tahap_id: i64) -> sqlx::Result<Vec<Value>> {
    let stage = match repo::get_stage(pool, tahap_id).await? {
        Some(s) => s,
        None => return Ok(Vec::new()),
    };
    let teams = repo::teams(pool, stage.turnamen_id).await?;
    let mut peta: HashMap<i64, (String, i64, i64, i64, HashSet<i64>)> = teams
        .into_iter()
        .map(|t| (t.id, (t.nama_tim, 0, 0, 0, HashSet::new())))
        .collect();

    for m in repo::matches_of_stage(pool, tahap_id).await? {
        let Some(pemenang) = m.pemenang_id else {
            continue;
        };
        match (m.tim1_id, m.tim2_id) {
            (Some(t1), Some(t2)) => {
                if let Some(e) = peta.get_mut(&t1) {
                    e.4.insert(t2);
                    if pemenang == t1 {
                        e.1 += 1;
                    } else {
                        e.2 += 1;
                    }
                }
                if let Some(e) = peta.get_mut(&t2) {
                    e.4.insert(t1);
                    if pemenang == t2 {
                        e.1 += 1;
                    } else {
                        e.2 += 1;
                    }
                }
            }
            (Some(t1), None) => {
                if let Some(e) = peta.get_mut(&t1) {
                    e.1 += 1;
                    e.3 += 1;
                }
            }
            _ => {}
        }
    }

    let mut daftar: Vec<Value> = peta
        .into_iter()
        .map(|(id, (nama, wins, losses, byes, lawan))| {
            json!({
                "id": id,
                "nama_tim": nama,
                "wins": wins,
                "losses": losses,
                "byes": byes,
                "played_against": lawan.into_iter().collect::<Vec<_>>(),
            })
        })
        .collect();
    daftar.sort_by(|a, b| {
        let wa = a["wins"].as_i64().unwrap_or(0);
        let wb = b["wins"].as_i64().unwrap_or(0);
        let la = a["losses"].as_i64().unwrap_or(0);
        let lb = b["losses"].as_i64().unwrap_or(0);
        wb.cmp(&wa).then(la.cmp(&lb))
    });
    Ok(daftar)
}

fn acak(mut urutan: Vec<i64>) -> Vec<i64> {
    // Fisher-Yates dengan entropy dari waktu; cukup untuk undian tim.
    let mut seed = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(1);
    for i in (1..urutan.len()).rev() {
        seed = seed
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        let j = (seed >> 33) as usize % (i + 1);
        urutan.swap(i, j);
    }
    urutan
}

/// Ronde Swiss berikutnya: tim dengan rekor mirip dipasangkan, hindari ulangan.
async fn pair_swiss(pool: &SqlitePool, tahap_id: i64, round: i64, bo: i64) -> sqlx::Result<()> {
    let stage = repo::get_stage(pool, tahap_id).await?.expect("stage");
    let mut daftar = standings(pool, tahap_id).await?;

    let mut bye: Option<i64> = None;
    if daftar.len() % 2 != 0 {
        let calon = daftar
            .iter()
            .rev()
            .find(|v| v["byes"].as_i64().unwrap_or(0) == 0);
        if let Some(v) = calon {
            bye = v["id"].as_i64();
            let id = bye;
            daftar.retain(|x| x["id"].as_i64() != id);
        } else if let Some(last) = daftar.pop() {
            bye = last["id"].as_i64();
        }
    }

    let mut pasangan: Vec<(i64, i64)> = Vec::new();
    let mut terpakai: HashSet<i64> = HashSet::new();
    let ids: Vec<i64> = daftar.iter().filter_map(|v| v["id"].as_i64()).collect();
    let lawan: HashMap<i64, HashSet<i64>> = daftar
        .iter()
        .filter_map(|v| {
            let id = v["id"].as_i64()?;
            let himpunan = v["played_against"]
                .as_array()
                .map(|a| a.iter().filter_map(|x| x.as_i64()).collect())
                .unwrap_or_default();
            Some((id, himpunan))
        })
        .collect();

    for (i, &t1) in ids.iter().enumerate() {
        if terpakai.contains(&t1) {
            continue;
        }
        let mut lawan_terpilih = ids
            .iter()
            .skip(i + 1)
            .find(|t2| !terpakai.contains(t2) && !lawan.get(&t1).is_some_and(|l| l.contains(t2)))
            .copied();
        if lawan_terpilih.is_none() {
            lawan_terpilih = ids
                .iter()
                .skip(i + 1)
                .find(|t2| !terpakai.contains(t2))
                .copied();
        }
        match lawan_terpilih {
            Some(t2) => {
                terpakai.insert(t1);
                terpakai.insert(t2);
                pasangan.push((t1, t2));
            }
            None => {
                // Sisa ganjil di dalam daftar: cari lawan pertama yang belum terpakai.
                if let Some(t2) = ids.iter().find(|t2| !terpakai.contains(*t2) && **t2 != t1) {
                    terpakai.insert(t1);
                    terpakai.insert(*t2);
                    pasangan.push((t1, *t2));
                }
            }
        }
    }

    let now = now_db();
    let mut nomor = 1i64;
    if let Some(bye_id) = bye {
        let m = Match {
            id: 0,
            turnamen_id: stage.turnamen_id,
            tahap_id,
            round_number: round,
            match_number: nomor,
            tim1_id: Some(bye_id),
            tim2_id: None,
            skor1: Some(1),
            skor2: Some(0),
            pemenang_id: Some(bye_id),
            bo_format: Some(bo),
            next_match_id: None,
        };
        repo::insert_match(pool, &m, &now).await?;
        nomor += 1;
    }
    for (t1, t2) in pasangan {
        let m = Match {
            id: 0,
            turnamen_id: stage.turnamen_id,
            tahap_id,
            round_number: round,
            match_number: nomor,
            tim1_id: Some(t1),
            tim2_id: Some(t2),
            skor1: Some(0),
            skor2: Some(0),
            pemenang_id: None,
            bo_format: Some(bo),
            next_match_id: None,
        };
        repo::insert_match(pool, &m, &now).await?;
        nomor += 1;
    }
    Ok(())
}

pub async fn list(st: &AppState) -> Hasil<Value> {
    let tz = &st.cfg.timezone;
    let mut hasil = Vec::new();
    for t in repo::get_all(&st.pool).await.map_err(galat)? {
        let stages = repo::stages(&st.pool, t.id).await.map_err(galat)?;
        let tim = repo::teams(&st.pool, t.id).await.map_err(galat)?;
        let mut nilai = t.to_json(stages.clone(), tim.len(), tz);
        if let Some(obj) = nilai.as_object_mut() {
            obj.insert(
                "stages".into(),
                Value::Array(stages.iter().map(|s| s.to_json(tz)).collect()),
            );
        }
        hasil.push(nilai);
    }
    Ok(json!({ "tournaments": hasil }))
}

fn galat(e: sqlx::Error) -> (u16, String) {
    (500, e.to_string())
}

pub async fn detail(st: &AppState, id: i64) -> Hasil<Value> {
    let tz = &st.cfg.timezone;
    let t = repo::get_by_id(&st.pool, id)
        .await
        .map_err(galat)?
        .ok_or_else(|| (404, "Turnamen tidak ditemukan".to_string()))?;
    let stages = repo::stages(&st.pool, t.id).await.map_err(galat)?;
    let tim = repo::teams(&st.pool, t.id).await.map_err(galat)?;
    let nama = repo::nama_tim(&st.pool, t.id).await.map_err(galat)?;

    let mut matches = serde_json::Map::new();
    let mut klasemen = serde_json::Map::new();
    for s in &stages {
        let daftar = repo::matches_of_stage(&st.pool, s.id)
            .await
            .map_err(galat)?;
        matches.insert(
            s.id.to_string(),
            Value::Array(daftar.iter().map(|m| m.to_json(&nama)).collect()),
        );
        if s.tipe_format == "swiss" {
            klasemen.insert(
                s.id.to_string(),
                Value::Array(standings(&st.pool, s.id).await.map_err(galat)?),
            );
        }
    }

    Ok(json!({
        "tournament": t.to_json(stages.clone(), tim.len(), tz),
        "stages": stages.iter().map(|s| s.to_json(tz)).collect::<Vec<_>>(),
        "teams": tim.iter().map(|x| x.to_json()).collect::<Vec<_>>(),
        "matches": matches,
        "standings": klasemen,
    }))
}

pub async fn create(st: &AppState, data: &Value, operator: &str) -> Hasil<Value> {
    let nama = crate::utils::validators::text_opt(data.get("nama"), 2, 100, "Nama Turnamen", true)
        .map_err(salah)?;
    let deskripsi = crate::utils::validators::text_opt(
        data.get("deskripsi"),
        0,
        500,
        "Deskripsi Turnamen",
        false,
    )
    .map_err(salah)?;
    let jalur = data
        .get("tipe_jalur")
        .and_then(|v| v.as_str())
        .unwrap_or("playoff")
        .to_lowercase();
    if !["playoff", "swiss", "multi"].contains(&jalur.as_str()) {
        return Err(salah(format!(
            "Tipe Format Turnamen tidak valid. Pilihan yang tersedia: playoff, swiss, multi"
        )));
    }
    let bo = crate::utils::validators::int_opt(data.get("bo_format"), 1, 9, "Format BO")
        .map_err(salah)?;

    let mut tim: Vec<String> = Vec::new();
    if let Some(arr) = data.get("teams").and_then(|v| v.as_array()) {
        for v in arr {
            let mentah = match v {
                Value::String(s) => s.clone(),
                other => other.to_string(),
            };
            let nama_tim = crate::utils::validators::text_opt(
                Some(&Value::String(mentah)),
                1,
                50,
                "Nama Tim",
                false,
            )
            .map_err(salah)?;
            if !nama_tim.is_empty() {
                tim.push(nama_tim);
            }
        }
    }
    if tim.len() < 2 {
        return Err(salah("Minimal harus mendaftarkan 2 tim"));
    }
    if repo::get_by_nama(&st.pool, &nama)
        .await
        .map_err(galat)?
        .is_some()
    {
        return Err(salah(format!("Turnamen dengan nama '{nama}' sudah ada")));
    }

    let now = now_db();
    let t_id: i64 = sqlx::query_scalar(
        "INSERT INTO turnamen (nama, deskripsi, status, dibuat_pada) VALUES (?, ?, 'aktif', ?) RETURNING id",
    )
    .bind(&nama)
    .bind(&deskripsi)
    .bind(&now)
    .fetch_one(&st.pool)
    .await
    .map_err(galat)?;

    let mut ids = Vec::new();
    for nama_tim in &tim {
        ids.push(
            repo::insert_team(&st.pool, t_id, nama_tim, &now)
                .await
                .map_err(galat)?,
        );
    }

    match jalur.as_str() {
        "playoff" => {
            let stage = repo::insert_stage(
                &st.pool,
                t_id,
                "Playoffs",
                "single_elimination",
                1,
                "aktif",
                &now,
            )
            .await
            .map_err(galat)?;
            generate_bracket(&st.pool, t_id, stage, &ids, bo)
                .await
                .map_err(galat)?;
        }
        "swiss" | "multi" => {
            if jalur == "multi" {
                let _ = repo::insert_stage(
                    &st.pool,
                    t_id,
                    "Group Stage (Swiss)",
                    "swiss",
                    1,
                    "aktif",
                    &now,
                )
                .await
                .map_err(galat)?;
                repo::insert_stage(
                    &st.pool,
                    t_id,
                    "Playoffs",
                    "single_elimination",
                    2,
                    "draft",
                    &now,
                )
                .await
                .map_err(galat)?;
            } else {
                repo::insert_stage(&st.pool, t_id, "Swiss Stage", "swiss", 1, "aktif", &now)
                    .await
                    .map_err(galat)?;
            }
            let acak_ids = acak(ids.clone());
            // Ronde 1: undian acak; bye diberikan bila jumlah tim ganjil.
            let mut nomor = 1i64;
            let mut sisa = acak_ids;
            let stage_id: i64 = sqlx::query_scalar(
                "SELECT id FROM turnamen_tahap WHERE turnamen_id = ? AND urutan = 1",
            )
            .bind(t_id)
            .fetch_one(&st.pool)
            .await
            .map_err(galat)?;
            if sisa.len() % 2 != 0 {
                let bye = sisa.pop().unwrap();
                let m = Match {
                    id: 0,
                    turnamen_id: t_id,
                    tahap_id: stage_id,
                    round_number: 1,
                    match_number: nomor,
                    tim1_id: Some(bye),
                    tim2_id: None,
                    skor1: Some(1),
                    skor2: Some(0),
                    pemenang_id: Some(bye),
                    bo_format: Some(bo),
                    next_match_id: None,
                };
                repo::insert_match(&st.pool, &m, &now)
                    .await
                    .map_err(galat)?;
                nomor += 1;
            }
            let mut i = 0;
            while i + 1 < sisa.len() {
                let m = Match {
                    id: 0,
                    turnamen_id: t_id,
                    tahap_id: stage_id,
                    round_number: 1,
                    match_number: nomor,
                    tim1_id: Some(sisa[i]),
                    tim2_id: Some(sisa[i + 1]),
                    skor1: Some(0),
                    skor2: Some(0),
                    pemenang_id: None,
                    bo_format: Some(bo),
                    next_match_id: None,
                };
                repo::insert_match(&st.pool, &m, &now)
                    .await
                    .map_err(galat)?;
                nomor += 1;
                i += 2;
            }
        }
        _ => {}
    }

    crate::utils::logger::audit_json(
        operator,
        "TOURNAMENT_CREATE",
        &format!("Turnamen '{nama}' berhasil dibuat"),
        None,
        "",
        "",
        json!({"nama": nama, "format": jalur, "total_tim": tim.len()}),
    );
    Ok(json!({ "tournament_id": t_id, "nama": nama }))
}

pub async fn update_skor(
    st: &AppState,
    match_id: i64,
    data: &Value,
    operator: &str,
) -> Hasil<Value> {
    let mut m = repo::get_match(&st.pool, match_id)
        .await
        .map_err(galat)?
        .ok_or_else(|| salah("Match tidak ditemukan"))?;
    if m.pemenang_id.is_some() {
        return Err(salah("Match sudah selesai"));
    }
    let (Some(tim1), Some(tim2)) = (m.tim1_id, m.tim2_id) else {
        return Err(salah("Match belum memiliki kedua tim"));
    };
    let skor1 = crate::utils::validators::int_opt(data.get("skor1"), 0, 999, "Skor tim 1")
        .map_err(salah)?;
    let skor2 = crate::utils::validators::int_opt(data.get("skor2"), 0, 999, "Skor tim 2")
        .map_err(salah)?;
    let pemenang = match data.get("pemenang_id").and_then(|v| v.as_i64()) {
        Some(p) => p,
        None => {
            if skor1 > skor2 {
                tim1
            } else if skor2 > skor1 {
                tim2
            } else {
                return Err(salah(
                    "Skor seri. Silakan tentukan tim pemenang secara manual.",
                ));
            }
        }
    };
    if pemenang != tim1 && pemenang != tim2 {
        return Err(salah("Pemenang harus salah satu tim di match ini"));
    }

    repo::update_skor(&st.pool, match_id, skor1, skor2, pemenang)
        .await
        .map_err(galat)?;

    let stage = repo::get_stage(&st.pool, m.tahap_id)
        .await
        .map_err(galat)?
        .ok_or_else(|| salah("Tahap tidak ditemukan"))?;
    m.pemenang_id = Some(pemenang);
    if stage.tipe_format == "single_elimination" {
        advance(&st.pool, &m, pemenang).await.map_err(galat)?;
    }

    let stages = repo::stages(&st.pool, m.turnamen_id).await.map_err(galat)?;
    if let Some(terakhir) = stages.iter().max_by_key(|s| s.urutan) {
        if terakhir.id == m.tahap_id {
            let semua = repo::matches_of_stage(&st.pool, terakhir.id)
                .await
                .map_err(galat)?;
            if semua.iter().all(|x| x.pemenang_id.is_some()) {
                repo::set_stage_status(&st.pool, terakhir.id, "selesai")
                    .await
                    .map_err(galat)?;
                repo::set_status(&st.pool, m.turnamen_id, "selesai")
                    .await
                    .map_err(galat)?;
            }
        }
    }

    let nama = repo::nama_tim(&st.pool, m.turnamen_id)
        .await
        .map_err(galat)?;
    let label = |id: Option<i64>| {
        id.and_then(|v| nama.get(&v).cloned())
            .unwrap_or_else(|| "Bye".into())
    };
    crate::utils::logger::audit_json(
        operator,
        "TOURNAMENT_SCORE_UPDATE",
        &format!(
            "Skor pertandingan match_{match_id} diperbarui: {} ({skor1}) vs {} ({skor2})",
            label(Some(tim1)),
            label(Some(tim2))
        ),
        None,
        "",
        "",
        json!({"match_id": match_id, "tim1": label(Some(tim1)), "tim2": label(Some(tim2)),
               "skor1": skor1, "skor2": skor2, "pemenang": label(Some(pemenang))}),
    );
    Ok(m.to_json(&nama))
}

pub async fn next_swiss(st: &AppState, t_id: i64, operator: &str) -> Hasil<i64> {
    let t = repo::get_by_id(&st.pool, t_id)
        .await
        .map_err(galat)?
        .ok_or_else(|| salah("Turnamen tidak ditemukan"))?;
    let stages = repo::stages(&st.pool, t.id).await.map_err(galat)?;
    let stage = stages
        .iter()
        .find(|s| s.tipe_format == "swiss" && s.status.as_deref() == Some("aktif"))
        .ok_or_else(|| salah("Tidak ada Swiss Stage yang sedang aktif pada turnamen ini"))?;
    let matches = repo::matches_of_stage(&st.pool, stage.id)
        .await
        .map_err(galat)?;
    if matches.is_empty() {
        return Err(salah("Tidak ada pertandingan terdaftar di stage ini"));
    }
    let ronde = matches.iter().map(|m| m.round_number).max().unwrap_or(1);
    if matches
        .iter()
        .any(|m| m.round_number == ronde && m.pemenang_id.is_none())
    {
        return Err(salah(format!(
            "Ronde {ronde} belum selesai. Mohon lengkapi seluruh skor terlebih dahulu."
        )));
    }
    let bo = matches[0].bo_format.unwrap_or(1);
    pair_swiss(&st.pool, stage.id, ronde + 1, bo)
        .await
        .map_err(galat)?;
    crate::utils::logger::audit_json(
        operator,
        "TOURNAMENT_STAGE_UPDATE",
        &format!("Swiss Stage ronde {} dimulai", ronde + 1),
        None,
        "",
        "",
        json!({"stage": stage.nama, "status": stage.status, "round": ronde + 1}),
    );
    Ok(ronde + 1)
}

pub async fn finish_stage(
    st: &AppState,
    stage_id: i64,
    tim_ids: &[i64],
    operator: &str,
) -> Hasil<String> {
    let stage = repo::get_stage(&st.pool, stage_id)
        .await
        .map_err(galat)?
        .ok_or_else(|| salah("Tahap tidak ditemukan"))?;
    if stage.status.as_deref() == Some("selesai") {
        return Err(salah("Tahap sudah selesai"));
    }
    if tim_ids.is_empty() {
        return Err(salah(
            "Harap pilih tim yang akan diloloskan ke babak berikutnya",
        ));
    }
    let unik: Vec<i64> = {
        let set: HashSet<i64> = tim_ids.iter().copied().collect();
        set.into_iter().collect()
    };
    let qualified = repo::teams_by_ids(&st.pool, &unik, stage.turnamen_id)
        .await
        .map_err(galat)?;
    if qualified.len() != unik.len() {
        return Err(salah("Tim tidak valid untuk turnamen ini"));
    }

    let stages = repo::stages(&st.pool, stage.turnamen_id)
        .await
        .map_err(galat)?;
    let next = stages
        .iter()
        .find(|s| s.urutan == stage.urutan + 1)
        .cloned();
    if let Some(n) = &next {
        if !repo::matches_of_stage(&st.pool, n.id)
            .await
            .map_err(galat)?
            .is_empty()
        {
            return Err(salah("Bracket babak berikutnya sudah dibuat"));
        }
    }

    repo::set_stage_status(&st.pool, stage.id, "selesai")
        .await
        .map_err(galat)?;
    let pesan = match next {
        Some(n) => {
            repo::set_stage_status(&st.pool, n.id, "aktif")
                .await
                .map_err(galat)?;
            let bo = repo::matches_of_stage(&st.pool, stage_id)
                .await
                .map_err(galat)?
                .first()
                .and_then(|m| m.bo_format)
                .unwrap_or(1);
            let ids: Vec<i64> = qualified.iter().map(|t| t.id).collect();
            generate_bracket(&st.pool, stage.turnamen_id, n.id, &ids, bo)
                .await
                .map_err(galat)?;
            format!(
                "Tahap {} diselesaikan. {} tim diloloskan ke {}.",
                stage.nama,
                qualified.len(),
                n.nama
            )
        }
        None => {
            repo::set_status(&st.pool, stage.turnamen_id, "selesai")
                .await
                .map_err(galat)?;
            let t = repo::get_by_id(&st.pool, stage.turnamen_id)
                .await
                .map_err(galat)?;
            format!(
                "Turnamen {} telah selesai.",
                t.map(|x| x.nama).unwrap_or_default()
            )
        }
    };

    crate::utils::logger::audit_json(
        operator,
        "TOURNAMENT_STAGE_UPDATE",
        &format!("Stage '{}' selesai. Msg: {pesan}", stage.nama),
        None,
        "",
        "",
        json!({"stage": stage.nama, "status": "selesai", "message": pesan}),
    );
    Ok(pesan)
}

pub async fn delete(st: &AppState, t_id: i64, operator: &str) -> Hasil<String> {
    let t = repo::get_by_id(&st.pool, t_id)
        .await
        .map_err(galat)?
        .ok_or_else(|| (404, "Turnamen tidak ditemukan".to_string()))?;
    repo::delete(&st.pool, t_id).await.map_err(galat)?;
    crate::utils::logger::audit_json(
        operator,
        "TOURNAMENT_DELETE",
        &format!("Turnamen '{}' berhasil dihapus", t.nama),
        None,
        "",
        "",
        json!({"nama_turnamen": t.nama}),
    );
    Ok(t.nama)
}
