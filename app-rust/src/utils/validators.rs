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
