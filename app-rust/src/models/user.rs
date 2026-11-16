//! Model User (staff kasir/admin) + verifikasi password Werkzeug.

use rand::Rng;
use serde::Serialize;

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub password_hash: String,
    pub nama_lengkap: Option<String>,
    pub role: Option<String>,
    pub aktif: Option<bool>,
    pub dibuat_pada: Option<String>,
    pub kuota_main_bulanan: Option<i64>,
    pub sisa_kuota_menit: Option<i64>,
    pub terakhir_reset_kuota: Option<String>,
}

impl User {
    pub fn role(&self) -> &str {
        self.role.as_deref().unwrap_or("kasir")
    }

    pub fn active(&self) -> bool {
        self.aktif.unwrap_or(false)
    }

    pub fn nama(&self) -> &str {
        match self.nama_lengkap.as_deref() {
            Some(n) if !n.is_empty() => n,
            _ => &self.username,
        }
    }

    pub fn to_json(&self) -> serde_json::Value {
        serde_json::json!({
            "id": self.id,
            "username": self.username,
            "nama_lengkap": self.nama_lengkap,
            "role": self.role(),
            "aktif": self.active(),
            "kuota_main_bulanan": self.kuota_main_bulanan.unwrap_or(0),
            "sisa_kuota_menit": self.sisa_kuota_menit.unwrap_or(0),
            "terakhir_reset_kuota": self.terakhir_reset_kuota,
        })
    }

    pub async fn check_password(&self, password: &str) -> bool {
        verify_password(&self.password_hash, password)
    }
}

const SALT_CHARS: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

fn ct_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

/// Hash gaya Werkzeug 3.x: `scrypt:32768:8:1$salt$hex`.
pub fn hash_password(password: &str) -> String {
    let salt: String = {
        let mut rng = rand::rng();
        (0..16).map(|_| SALT_CHARS[rng.random_range(0..SALT_CHARS.len())] as char).collect()
    };
    let mut out = [0u8; 64];
    let params = scrypt::Params::new(15, 8, 1, 64).expect("parameter scrypt tetap");
    scrypt::scrypt(password.as_bytes(), salt.as_bytes(), &params, &mut out).expect("scrypt");
    format!("scrypt:32768:8:1${salt}${}", hex::encode(out))
}

/// Menerima hash scrypt Werkzeug maupun pbkdf2 lama agar DB 1.4/1.5 tetap bisa login.
pub fn verify_password(stored: &str, password: &str) -> bool {
    let mut parts = stored.splitn(3, '$');
    let (Some(method), Some(salt), Some(hex_hash)) = (parts.next(), parts.next(), parts.next()) else {
        return false;
    };
    let expected = match hex::decode(hex_hash.trim()) {
        Ok(v) => v,
        Err(_) => return false,
    };
    let method_parts: Vec<&str> = method.split(':').collect();
    let computed = match method_parts.first().copied() {
        Some("scrypt") if method_parts.len() == 4 => {
            let n: u32 = method_parts[1].parse().ok().unwrap_or(0);
            let r: u32 = method_parts[2].parse().ok().unwrap_or(0);
            let p: u32 = method_parts[3].parse().ok().unwrap_or(0);
            if n < 2 || !n.is_power_of_two() {
                return false;
            }
            let mut out = vec![0u8; expected.len()];
            let params = match scrypt::Params::new(n.trailing_zeros() as u8, r, p, expected.len()) {
                Ok(v) => v,
                Err(_) => return false,
            };
            if scrypt::scrypt(password.as_bytes(), salt.as_bytes(), &params, &mut out).is_err() {
                return false;
            }
            out
        }
        Some("pbkdf2") if method_parts.len() == 3 && method_parts[1] == "sha256" => {
            let iterations: u32 = method_parts[2].parse().ok().unwrap_or(0);
            if iterations == 0 {
                return false;
            }
            let mut out = vec![0u8; expected.len()];
            pbkdf2::pbkdf2_hmac::<sha2::Sha256>(password.as_bytes(), salt.as_bytes(), iterations, &mut out);
            out
        }
        _ => return false,
    };
    ct_eq(&computed, &expected)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_buatan_sendiri_bisa_diverifikasi() {
        let h = hash_password("rahasia123");
        assert!(h.starts_with("scrypt:32768:8:1$"));
        assert!(verify_password(&h, "rahasia123"));
        assert!(!verify_password(&h, "salah"));
    }

    #[test]
    fn hash_werkzeug_asli_diterima() {
        let stored = "scrypt:32768:8:1$Ze814liFRSF0hUdX$9ecb675ff9d0f6a83c0f320cd4b7d4bcde498a8167d0565d63304029ac8e7efa5b59f4de76491035d81d06525a46b43b165796a218a6f64dab238ff054487410";
        assert!(verify_password(stored, "rahasia123"));
        assert!(!verify_password(stored, "rahasia124"));
    }

    #[test]
    fn hash_rusak_tidak_panik() {
        assert!(!verify_password("", "x"));
        assert!(!verify_password("scrypt:32768:8:1$abc$zz", "x"));
    }
}
