//! Artikel panduan sistem (CMS internal).

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Tutorial {
    pub id: i64,
    pub title: String,
    pub icon: Option<String>,
    pub category: Option<String>,
    pub content: String,
    pub urutan: Option<i64>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

impl Tutorial {
    pub fn to_json(&self) -> serde_json::Value {
        serde_json::json!({
            "id": self.id,
            "title": self.title,
            "icon": self.icon.clone().unwrap_or_else(|| "🌐".into()),
            "category": self.category.clone().unwrap_or_else(|| "Umum".into()),
            "content": self.content,
            "urutan": self.urutan.unwrap_or(0),
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        })
    }
}
