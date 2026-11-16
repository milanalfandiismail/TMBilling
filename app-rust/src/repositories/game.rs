//! Query tabel `game` dan `game_kategori`.

use crate::models::game::{Game, GameKategori};
use sqlx::SqlitePool;

const KOLOM: &str = "SELECT id, nama, tipe, kategori, exe_path, argumen, icon, aktif, \\
    created_at, updated_at, operator_id FROM game";

pub async fn get_all(
    pool: &SqlitePool,
    aktif_only: bool,
    kategori: Option<&str>,
    tipe: Option<&str>,
    search: Option<&str>,
    limit: Option<i64>,
    offset: i64,
) -> anyhow::Result<Vec<Game>> {
    let mut sql = KOLOM.to_string();
    let mut w: Vec<String> = Vec::new();
    if aktif_only {
        w.push("aktif = 1".into());
    }
    if tipe.filter(|t| !t.eq_ignore_ascii_case("all")).is_some() {
        w.push("LOWER(tipe) = LOWER(?)".into());
    }
    if kategori
        .filter(|c| !c.eq_ignore_ascii_case("all"))
        .is_some()
    {
        w.push("kategori LIKE ?".into());
    }
    if search.is_some() {
        w.push("(nama LIKE ? OR kategori LIKE ?)".into());
    }
    if !w.is_empty() {
        sql.push_str(&format!(" WHERE {}", w.join(" AND ")));
    }
    sql.push_str(" ORDER BY nama");
    if limit.is_some() {
        sql.push_str(" LIMIT ?");
    }
    if offset > 0 {
        sql.push_str(" OFFSET ?");
    }
    let mut q = sqlx::query_as::<_, Game>(&sql);
    if let Some(t) = tipe.filter(|t| !t.eq_ignore_ascii_case("all")) {
        q = q.bind(t.to_lowercase());
    }
    if let Some(c) = kategori.filter(|c| !c.eq_ignore_ascii_case("all")) {
        q = q.bind(format!("%{c}%"));
    }
    if let Some(s) = search {
        let like = format!("%{s}%");
        q = q.bind(like.clone()).bind(like);
    }
    if let Some(l) = limit.filter(|l| *l > 0) {
        q = q.bind(l);
    }
    if offset > 0 {
        q = q.bind(offset);
    }
    Ok(q.fetch_all(pool).await?)
}

pub async fn get_by_id(pool: &SqlitePool, id: i64) -> anyhow::Result<Option<Game>> {
    let sql = format!("{KOLOM} WHERE id = ?");
    Ok(sqlx::query_as::<_, Game>(&sql)
        .bind(id)
        .fetch_optional(pool)
        .await?)
}

pub async fn insert(pool: &SqlitePool, g: &Game) -> anyhow::Result<i64> {
    let res = sqlx::query(
        "INSERT INTO game (nama, tipe, kategori, exe_path, argumen, icon, aktif, created_at, updated_at, operator_id) \\
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&g.nama)
    .bind(&g.tipe)
    .bind(&g.kategori)
    .bind(&g.exe_path)
    .bind(&g.argumen)
    .bind(&g.icon)
    .bind(g.active())
    .bind(&g.created_at)
    .bind(&g.updated_at)
    .bind(&g.operator_id)
    .execute(pool)
    .await?;
    Ok(res.last_insert_rowid())
}

pub async fn update(pool: &SqlitePool, g: &Game) -> anyhow::Result<()> {
    sqlx::query(
        "UPDATE game SET nama = ?, tipe = ?, kategori = ?, exe_path = ?, argumen = ?, icon = ?, aktif = ?, updated_at = ?, operator_id = ? WHERE id = ?",
    )
    .bind(&g.nama)
    .bind(&g.tipe)
    .bind(&g.kategori)
    .bind(&g.exe_path)
    .bind(&g.argumen)
    .bind(&g.icon)
    .bind(g.active())
    .bind(&g.updated_at)
    .bind(&g.operator_id)
    .bind(g.id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete(pool: &SqlitePool, id: i64) -> anyhow::Result<()> {
    sqlx::query("DELETE FROM game WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn kategori_all(pool: &SqlitePool) -> anyhow::Result<Vec<GameKategori>> {
    Ok(
        sqlx::query_as::<_, GameKategori>("SELECT id, nama FROM game_kategori ORDER BY nama")
            .fetch_all(pool)
            .await?,
    )
}

pub async fn kategori_by_nama(
    pool: &SqlitePool,
    nama: &str,
) -> anyhow::Result<Option<GameKategori>> {
    Ok(sqlx::query_as::<_, GameKategori>(
        "SELECT id, nama FROM game_kategori WHERE LOWER(nama) = LOWER(?)",
    )
    .bind(nama)
    .fetch_optional(pool)
    .await?)
}

pub async fn kategori_get(pool: &SqlitePool, id: i64) -> anyhow::Result<Option<GameKategori>> {
    Ok(
        sqlx::query_as::<_, GameKategori>("SELECT id, nama FROM game_kategori WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?,
    )
}

pub async fn kategori_insert(pool: &SqlitePool, nama: &str) -> anyhow::Result<i64> {
    let res = sqlx::query("INSERT INTO game_kategori (nama) VALUES (?)")
        .bind(nama)
        .execute(pool)
        .await?;
    Ok(res.last_insert_rowid())
}

pub async fn kategori_delete(pool: &SqlitePool, id: i64) -> anyhow::Result<()> {
    sqlx::query("DELETE FROM game_kategori WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
