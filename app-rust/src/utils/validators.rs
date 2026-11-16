//! Validasi masukan user, setara `app/utils/validators.py` (pesan identik).

fn fmt_id(n: i64) -> String {
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

pub fn username(raw: &str, min_len: usize, max_len: usize) -> Result<String, String> {
    let cleaned = raw.trim();
    if cleaned.is_empty() {
        return Err("Username tidak boleh kosong".into());
    }
    if cleaned.chars().count() < min_len {
        return Err(format!("Username minimal {min_len} karakter"));
    }
    if cleaned.chars().count() > max_len {
        return Err(format!("Username maksimal {max_len} karakter"));
    }
    Ok(cleaned.to_string())
}

pub fn password(raw: &str, min_len: usize, max_len: usize) -> Result<String, String> {
    if raw.is_empty() {
        return Err("Password tidak boleh kosong".into());
    }
    if raw.trim().is_empty() {
        return Err("Password tidak boleh hanya berisi spasi".into());
    }
    let len = raw.chars().count();
    if len < min_len {
        return Err(format!("Password minimal {min_len} karakter"));
    }
    if len > max_len {
        return Err(format!("Password maksimal {max_len} karakter"));
    }
    Ok(raw.to_string())
}

pub fn text(
    raw: &str,
    min_len: usize,
    max_len: usize,
    field: &str,
    required: bool,
) -> Result<String, String> {
    let cleaned = raw.trim();
    if required && cleaned.is_empty() {
        return Err(format!("{field} tidak boleh kosong"));
    }
    if !cleaned.is_empty() {
        let len = cleaned.chars().count();
        if len < min_len {
            return Err(format!("{field} minimal {min_len} karakter"));
        }
        if len > max_len {
            return Err(format!("{field} maksimal {max_len} karakter"));
        }
    }
    Ok(cleaned.to_string())
}

pub fn int_range(
    val: &serde_json::Value,
    min_val: i64,
    max_val: i64,
    field: &str,
) -> Result<i64, String> {
    let num = match val {
        serde_json::Value::Number(n) => n.as_i64(),
        serde_json::Value::String(s) => s.trim().parse::<i64>().ok(),
        serde_json::Value::Bool(_) => None,
        _ => None,
    };
    let num = num.ok_or_else(|| format!("{field} harus berupa angka bulat"))?;
    if num < min_val || num > max_val {
        return Err(format!(
            "{field} harus antara {} sampai {}",
            fmt_id(min_val),
            fmt_id(max_val)
        ));
    }
    Ok(num)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pesan_rentang_memakai_titik_seperti_python() {
        let err = int_range(
            &serde_json::json!(999999),
            0,
            720 * 60,
            "Kuota main bulanan (menit)",
        )
        .unwrap_err();
        assert_eq!(
            err,
            "Kuota main bulanan (menit) harus antara 0 sampai 43.200"
        );
    }

    #[test]
    fn string_dari_form_diterima() {
        assert_eq!(
            int_range(&serde_json::json!("90"), 0, 100, "x").unwrap(),
            90
        );
        assert!(int_range(&serde_json::json!("abc"), 0, 100, "x").is_err());
    }
}

/// IPv4 opsional: kosong → Ok(None), format salah → pesan Python.
pub fn ip_address(raw: &str) -> Result<Option<String>, String> {
    let cleaned = raw.trim();
    if cleaned.is_empty() {
        return Ok(None);
    }
    match cleaned.parse::<std::net::Ipv4Addr>() {
        Ok(ip) => Ok(Some(ip.to_string())),
        Err(_) => Err("Format alamat IP tidak valid (contoh: 192.168.1.100)".into()),
    }
}

/// MAC opsional, dinormalkan ke `AA:BB:CC:DD:EE:FF`.
pub fn mac_address(raw: &str) -> Result<Option<String>, String> {
    let cleaned: String = raw
        .trim()
        .chars()
        .filter(|c| !matches!(c, ':' | '-' | '.'))
        .collect::<String>()
        .to_uppercase();
    if cleaned.is_empty() {
        return Ok(None);
    }
    if cleaned.len() != 12 || !cleaned.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("Format alamat MAC address tidak valid (contoh: AA:BB:CC:DD:EE:FF)".into());
    }
    let pasangan: Vec<String> = (0..6)
        .map(|i| cleaned[i * 2..i * 2 + 2].to_string())
        .collect();
    Ok(Some(pasangan.join(":")))
}

/// Username member: lowercase, pola `^[a-z0-9_.-]+$` (pesan identik Python).
pub fn username_lower(raw: &str) -> Result<String, String> {
    let cleaned = username(raw, 3, 30)?.to_lowercase();
    let valid = cleaned
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || matches!(c, '_' | '.' | '-'));
    if !valid {
        return Err(
            "Username hanya boleh berisi huruf kecil, angka, garis bawah (_), titik (.), atau minus (-)"
                .into(),
        );
    }
    Ok(cleaned)
}

/// Nomor HP opsional: 8-16 digit (boleh +, -, spasi).
pub fn phone(raw: &str) -> Result<Option<String>, String> {
    let cleaned = raw.trim();
    if cleaned.is_empty() {
        return Ok(None);
    }
    let digits = cleaned.chars().filter(|c| c.is_ascii_digit()).count();
    let bentuk_ok = cleaned
        .chars()
        .all(|c| c.is_ascii_digit() || matches!(c, '+' | '-' | ' '));
    if !bentuk_ok || !(8..=16).contains(&digits) {
        return Err(
            "Nomor HP harus berupa 8-16 digit angka (boleh menyertakan tanda +, -, atau spasi)"
                .into(),
        );
    }
    Ok(Some(cleaned.to_string()))
}

/// Email opsional maks 120 karakter.
pub fn email(raw: &str) -> Result<Option<String>, String> {
    let cleaned = raw.trim();
    if cleaned.is_empty() {
        return Ok(None);
    }
    let pola_ok = {
        let parts: Vec<&str> = cleaned.split('@').collect();
        parts.len() == 2
            && !parts[0].is_empty()
            && parts[0]
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '%' | '+' | '-'))
            && {
                let host = parts[1];
                let segmen: Vec<&str> = host.split('.').collect();
                segmen.len() >= 2
                    && segmen.iter().all(|s| {
                        !s.is_empty() && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
                    })
                    && segmen
                        .last()
                        .map(|tld| tld.len() >= 2 && tld.chars().all(|c| c.is_ascii_alphabetic()))
                        == Some(true)
            }
    };
    if !pola_ok || cleaned.chars().count() > 120 {
        return Err("Format alamat email tidak valid".into());
    }
    Ok(Some(cleaned.to_string()))
}

/// Varian yang menerima field JSON opsional.
pub fn text_opt(
    val: Option<&serde_json::Value>,
    min_len: usize,
    max_len: usize,
    field: &str,
    required: bool,
) -> Result<String, String> {
    text(
        val.and_then(|v| v.as_str()).unwrap_or(""),
        min_len,
        max_len,
        field,
        required,
    )
}

pub fn int_opt(
    val: Option<&serde_json::Value>,
    min_val: i64,
    max_val: i64,
    field: &str,
) -> Result<i64, String> {
    int_range(
        val.unwrap_or(&serde_json::Value::Null),
        min_val,
        max_val,
        field,
    )
}
