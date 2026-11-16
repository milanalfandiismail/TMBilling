//! Query member untuk sesi bermain (CRUD penuh menyusul Task 8).

use sqlx::SqlitePool;

use crate::models::member::Member;

const KOLOM: &str = "SELECT id, username, password_hash, nama_lengkap, email, no_hp, grup_id, \
    COALESCE(aktif, 1) AS aktif, dibuat_pada, COALESCE(waktu_tersimpan, 0) AS waktu_tersimpan, \
    kadaluarsa_pada FROM member";

pub async fn get_by_username(pool: &SqlitePool, username: &str) -> sqlx::Result<Option<Member>> {
    sqlx::query_as::<_, Member>(&format!("{KOLOM} WHERE username = ?"))
        .bind(username)
        .fetch_optional(pool)
        .await
}

pub async fn get_by_id(pool: &SqlitePool, id: i64) -> sqlx::Result<Option<Member>> {
    sqlx::query_as::<_, Member>(&format!("{KOLOM} WHERE id = ?"))
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn set_waktu_tersimpan(pool: &SqlitePool, id: i64, menit: i64) -> sqlx::Result<()> {
    sqlx::query("UPDATE member SET waktu_tersimpan = ? WHERE id = ?")
        .bind(menit)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn find_by_username(pool: &SqlitePool, username: &str) -> sqlx::Result<Option<Member>> {
    sqlx::query_as::<_, Member>(&format!("{KOLOM} WHERE username = ?"))
        .bind(username)
        .fetch_optional(pool)
        .await
}

pub async fn insert(
    pool: &SqlitePool,
    username: &str,
    hash: &str,
    nama: &str,
    email: Option<&str>,
    no_hp: Option<&str>,
    grup_id: i64,
    dibuat_pada: &str,
) -> sqlx::Result<i64> {
    sqlx::query(
        "INSERT INTO member (username, password_hash, nama_lengkap, email, no_hp, grup_id, aktif, \
         dibuat_pada, waktu_tersimpan) VALUES (?, ?, ?, ?, ?, ?, 1, ?, 0)",
    )
    .bind(username)
    .bind(hash)
    .bind(nama)
    .bind(email)
    .bind(no_hp)
    .bind(grup_id)
    .bind(dibuat_pada)
    .execute(pool)
    .await
    .map(|r| r.last_insert_rowid())
}

pub async fn update_profile(
    pool: &SqlitePool,
    id: i64,
    nama: &str,
    email: Option<&str>,
    no_hp: Option<&str>,
    grup_id: i64,
    hash: Option<&str>,
) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE member SET nama_lengkap = ?, email = ?, no_hp = ?, grup_id = ?, \
         password_hash = COALESCE(?, password_hash) WHERE id = ?",
    )
    .bind(nama)
    .bind(email)
    .bind(no_hp)
    .bind(grup_id)
    .bind(hash)
    .bind(id)
    .execute(pool)
    .await
    .map(|_| ())
}

pub async fn set_aktif(pool: &SqlitePool, id: i64, aktif: bool) -> sqlx::Result<()> {
    sqlx::query("UPDATE member SET aktif = ? WHERE id = ?")
        .bind(aktif)
        .bind(id)
        .execute(pool)
        .await
        .map(|_| ())
}

pub async fn set_saldo(
    pool: &SqlitePool,
    id: i64,
    menit: i64,
    kadaluarsa: Option<&str>,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE member SET waktu_tersimpan = ?, kadaluarsa_pada = ? WHERE id = ?")
        .bind(menit)
        .bind(kadaluarsa)
        .bind(id)
        .execute(pool)
        .await
        .map(|_| ())
}

pub async fn delete(pool: &SqlitePool, id: i64) -> sqlx::Result<()> {
    sqlx::query("DELETE FROM member WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map(|_| ())
}

/// Filter daftar member; `grup_id` sudah di-resolve service (nama → id).
pub struct Filter<'a> {
    pub q: Option<&'a str>,
    pub grup_id: Option<i64>,
    pub aktif_only: bool,
}

fn where_member(qb: &mut sqlx::QueryBuilder<'_, sqlx::Sqlite>, f: &Filter<'_>) {
    qb.push(" WHERE 1=1");
    if f.aktif_only {
        qb.push(" AND COALESCE(aktif, 1) = 1");
    }
    if let Some(g) = f.grup_id {
        qb.push(" AND grup_id = ").push_bind(g);
    }
    if let Some(q) = f.q {
        let like = format!("%{q}%");
        qb.push(" AND (username LIKE ").push_bind(like.clone());
        qb.push(" OR nama_lengkap LIKE ").push_bind(like.clone());
        qb.push(" OR email LIKE ").push_bind(like.clone());
        qb.push(" OR no_hp LIKE ").push_bind(like);
        qb.push(")");
    }
}

pub async fn get_paginated(
    pool: &SqlitePool,
    f: Filter<'_>,
    sort_by: &str,
    order: &str,
    limit: i64,
    offset: i64,
) -> sqlx::Result<(Vec<Member>, i64)> {
    let arah = if order.eq_ignore_ascii_case("desc") {
        "DESC"
    } else {
        "ASC"
    };
    let natural =
        "CASE WHEN username GLOB '[0-9]*' THEN 0 ELSE 1 END, CAST(username AS INTEGER), username";
    let urut = match sort_by {
        "username" => format!("{natural} {arah}"),
        "sisa_waktu" => format!("COALESCE(waktu_tersimpan, 0) {arah}, {natural}"),
        "status" => format!("COALESCE(aktif, 1) {arah}, {natural}"),
        "id" => format!("id {arah}"),
        _ => format!("grup_id {arah}, {natural}"),
    };

    let mut qb = sqlx::QueryBuilder::new(KOLOM);
    where_member(&mut qb, &f);
    qb.push(format!(" ORDER BY {urut} LIMIT ")).push_bind(limit);
    qb.push(" OFFSET ").push_bind(offset);
    let rows = qb.build_query_as::<Member>().fetch_all(pool).await?;

    let mut cb = sqlx::QueryBuilder::new("SELECT COUNT(*) FROM member");
    where_member(&mut cb, &f);
    let total: i64 = cb.build_query_scalar().fetch_one(pool).await?;
    Ok((rows, total))
}

pub async fn counts_by_grup(
    pool: &SqlitePool,
    f: Filter<'_>,
) -> sqlx::Result<Vec<(Option<i64>, i64)>> {
    let mut qb = sqlx::QueryBuilder::new("SELECT grup_id, COUNT(*) FROM member");
    where_member(&mut qb, &f);
    qb.push(" GROUP BY grup_id");
    qb.build_query_as::<(Option<i64>, i64)>()
        .fetch_all(pool)
        .await
}
