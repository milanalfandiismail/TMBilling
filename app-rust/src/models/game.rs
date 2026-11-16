//! Model Game/GameKategori katalog klien.

use serde::Serialize;
use serde_json::{json, Value};

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Game {
    pub id: i64,
    pub nama: String,
    pub tipe: Option<String>,
    pub kategori: Option<String>,
    pub exe_path: Option<String>,
    pub argumen: Option<String>,
    pub icon: Option<String>,
    pub aktif: Option<bool>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub operator_id: Option<String>,
}

impl Game {
    pub fn active(&self) -> bool {
        self.aktif.unwrap_or(true)
    }

    pub fn tipe(&self) -> String {
        self.tipe.clone().unwrap_or_else(|| "game".into())
    }

    pub fn to_json(&self) -> Value {
        let kategori = self.kategori.clone().unwrap_or_default();
        let list: Vec<&str> = kategori
            .split(',')
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .collect();
        json!({
            "id": self.id,
            "nama": self.nama,
            "tipe": self.tipe(),
            "kategori": self.kategori,
            "kategori_list": list,
            "exe_path": self.exe_path,
            "argumen": self.argumen,
            "icon": self.icon,
            "icon_url": self.icon.as_ref().map(|i| format!("/static/uploads/games/{i}")),
            "aktif": self.active(),
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "operator_id": self.operator_id,
        })
    }
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct GameKategori {
    pub id: i64,
    pub nama: String,
}

impl GameKategori {
    pub fn to_json(&self) -> Value {
        json!({"id": self.id, "nama": self.nama})
    }
}
