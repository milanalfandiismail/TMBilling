# app/utils/validators.py
"""Modul utilitas validasi terpusat untuk TMBilling.

Menyediakan fungsi validasi dan sanitasi input pengguna untuk
seluruh modul sistem (User, Member, PC, Grup, Paket, Menu, Sesi, Branch).
"""

import re
import ipaddress


def validate_username(username: str, min_len: int = 3, max_len: int = 30, lowercase_only: bool = False) -> str:
    """Memvalidasi dan membersihkan username.
    
    Args:
        username: String input username.
        min_len: Panjang minimal karakter (default: 3).
        max_len: Panjang maksimal karakter (default: 30).
        lowercase_only: Apakah username harus di-lowercase secara ketat (misal untuk member).
        
    Returns:
        str: Username yang sudah dibersihkan (trimmed).
        
    Raises:
        ValueError: Jika format atau panjang username tidak valid.
    """
    if not username or not isinstance(username, str):
        raise ValueError("Username tidak boleh kosong")

    cleaned = username.strip()
    if lowercase_only:
        cleaned = cleaned.lower()

    if len(cleaned) < min_len:
        raise ValueError(f"Username minimal {min_len} karakter")
    if len(cleaned) > max_len:
        raise ValueError(f"Username maksimal {max_len} karakter")

    pattern = r'^[a-z0-9_.-]+$' if lowercase_only else r'^[a-zA-Z0-9_.-]+$'
    if not re.match(pattern, cleaned):
        char_desc = "huruf kecil, angka, garis bawah (_), titik (.), atau minus (-)" if lowercase_only else "huruf, angka, garis bawah (_), titik (.), atau minus (-)"
        raise ValueError(f"Username hanya boleh berisi {char_desc}")

    return cleaned


def validate_password(password: str, min_len: int = 4, max_len: int = 32) -> str:
    """Memvalidasi panjang dan format password.
    
    Args:
        password: String password plaintext.
        min_len: Panjang minimal karakter.
        max_len: Panjang maksimal karakter.
        
    Returns:
        str: Password plaintext.
        
    Raises:
        ValueError: Jika password kosong, hanya spasi, atau panjang tidak sesuai.
    """
    if not password or not isinstance(password, str):
        raise ValueError("Password tidak boleh kosong")

    if not password.strip():
        raise ValueError("Password tidak boleh hanya berisi spasi")

    if len(password) < min_len:
        raise ValueError(f"Password minimal {min_len} karakter")
    if len(password) > max_len:
        raise ValueError(f"Password maksimal {max_len} karakter")

    return password


def validate_integer_range(val, min_val: int, max_val: int, field_name: str = "Nilai") -> int:
    """Memvalidasi nilai integer agar berada dalam rentang tertentu.
    
    Args:
        val: Input nilai (int atau string angka).
        min_val: Nilai minimal inklusif.
        max_val: Nilai maksimal inklusif.
        field_name: Nama field untuk pesan error.
        
    Returns:
        int: Nilai integer tervalidasi.
        
    Raises:
        ValueError: Jika bukan angka atau di luar rentang.
    """
    try:
        val_int = int(val)
    except (ValueError, TypeError):
        raise ValueError(f"{field_name} harus berupa angka bulat")

    if val_int < min_val or val_int > max_val:
        raise ValueError(f"{field_name} harus antara {min_val:,} sampai {max_val:,}".replace(",", "."))

    return val_int


def validate_hex_color(color: str, default: str = "#888888") -> str:
    """Memvalidasi format warna hexadecimal (contoh: #FF0000 atau #F00).
    
    Args:
        color: String input warna hex.
        default: Fallback jika input kosong.
        
    Returns:
        str: Warna hex tervalidasi.
        
    Raises:
        ValueError: Jika format warna hex tidak valid.
    """
    if not color:
        return default

    cleaned = str(color).strip()
    if not re.match(r'^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$', cleaned):
        raise ValueError("Format warna hex tidak valid (contoh: #FF5733 atau #FFF)")

    return cleaned


def validate_phone_number(phone: str) -> str | None:
    """Memvalidasi format nomor telepon / HP.
    
    Args:
        phone: String input nomor telepon.
        
    Returns:
        str | None: Nomor telepon tervalidasi atau None jika kosong.
        
    Raises:
        ValueError: Jika nomor HP tidak valid.
    """
    if not phone or not str(phone).strip():
        return None

    cleaned = str(phone).strip()
    digits_only = re.sub(r'\D', '', cleaned)
    if len(digits_only) < 8 or len(digits_only) > 16 or len(cleaned) > 20 or not re.match(r'^[0-9+\- ]+$', cleaned):
        raise ValueError("Nomor HP harus berupa 8-16 digit angka (boleh menyertakan tanda +, -, atau spasi)")

    return cleaned


def validate_email_format(email: str) -> str | None:
    """Memvalidasi format alamat email standar RFC.
    
    Args:
        email: String input email.
        
    Returns:
        str | None: Email tervalidasi atau None jika kosong.
        
    Raises:
        ValueError: Jika format email tidak valid.
    """
    if not email or not str(email).strip():
        return None

    cleaned = str(email).strip()
    if len(cleaned) > 120 or not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', cleaned):
        raise ValueError("Format alamat email tidak valid")

    return cleaned


def validate_string_length(text: str, min_len: int = 1, max_len: int = 100, field_name: str = "Teks", required: bool = True) -> str:
    """Memvalidasi panjang teks dan membersihkan whitespace.
    
    Args:
        text: String input teks.
        min_len: Panjang minimal karakter.
        max_len: Panjang maksimal karakter.
        field_name: Nama field untuk pesan error.
        required: Apakah field wajib diisi.
        
    Returns:
        str: Teks yang sudah di-strip.
        
    Raises:
        ValueError: Jika teks kosong saat required atau panjang di luar batas.
    """
    cleaned = (text or "").strip() if isinstance(text, str) else ""

    if required and not cleaned:
        raise ValueError(f"{field_name} tidak boleh kosong")

    if cleaned:
        if len(cleaned) < min_len:
            raise ValueError(f"{field_name} minimal {min_len} karakter")
        if len(cleaned) > max_len:
            raise ValueError(f"{field_name} maksimal {max_len} karakter")

    return cleaned


def validate_ip_address(ip: str, allow_empty: bool = False, version: int = 4) -> str | None:
    """Memvalidasi format alamat IP (IPv4 atau IPv6).
    
    Args:
        ip: String alamat IP.
        allow_empty: Apakah string kosong diperbolehkan (mengembalikan None).
        version: Versi IP yang diharapkan (4 atau 6).
        
    Returns:
        str | None: Alamat IP tervalidasi atau None jika allow_empty dan kosong.
        
    Raises:
        ValueError: Jika IP kosong (saat not allow_empty) atau format tidak valid.
    """
    if ip is None or not str(ip).strip():
        if allow_empty:
            return None
        raise ValueError("Alamat IP tidak boleh kosong")

    cleaned = str(ip).strip()
    try:
        parsed = ipaddress.ip_address(cleaned)
        if version == 4 and parsed.version != 4:
            raise ValueError("Format alamat IP harus berupa IPv4 yang valid")
        elif version == 6 and parsed.version != 6:
            raise ValueError("Format alamat IP harus berupa IPv6 yang valid")
        return str(parsed)
    except ValueError:
        raise ValueError("Format alamat IP tidak valid (contoh: 192.168.1.100)")


def validate_mac_address(mac: str, allow_empty: bool = True) -> str | None:
    """Memvalidasi dan menstandarkan format MAC Address (menjadi format AA:BB:CC:DD:EE:FF).
    
    Args:
        mac: String input MAC address.
        allow_empty: Apakah string kosong diperbolehkan (mengembalikan None).
        
    Returns:
        str | None: MAC address uppercase terstandarisasi atau None jika kosong.
        
    Raises:
        ValueError: Jika MAC kosong (saat not allow_empty) atau format tidak valid.
    """
    if mac is None or not str(mac).strip():
        if allow_empty:
            return None
        raise ValueError("Alamat MAC tidak boleh kosong")

    cleaned = str(mac).strip().replace(":", "").replace("-", "").replace(".", "").upper()
    if len(cleaned) != 12 or not re.match(r'^[0-9A-F]{12}$', cleaned):
        raise ValueError("Format alamat MAC address tidak valid (contoh: AA:BB:CC:DD:EE:FF)")

    return ":".join(cleaned[i:i+2] for i in range(0, 12, 2))


def validate_choice(val, choices, field_name: str = "Pilihan", case_sensitive: bool = False):
    """Memvalidasi bahwa nilai input berada dalam daftar pilihan (whitelist/enum).
    
    Args:
        val: Nilai input yang akan divalidasi.
        choices: Iterable pilihan yang sah.
        field_name: Nama field untuk pesan error.
        case_sensitive: Apakah pencocokan string bersifat case-sensitive.
        
    Returns:
        Nilai yang cocok dari choices.
        
    Raises:
        ValueError: Jika nilai tidak terdapat dalam choices.
    """
    if val is None:
        raise ValueError(f"{field_name} tidak boleh kosong")

    choices_list = list(choices)
    if not case_sensitive and isinstance(val, str):
        val_str = val.strip().lower()
        for c in choices_list:
            if isinstance(c, str) and c.lower() == val_str:
                return c
            elif str(c).lower() == val_str:
                return c
        raise ValueError(f"{field_name} tidak valid. Pilihan yang tersedia: {', '.join(str(c) for c in choices_list)}")
    else:
        if val in choices_list:
            return val
        raise ValueError(f"{field_name} tidak valid. Pilihan yang tersedia: {', '.join(str(c) for c in choices_list)}")


def validate_filename(filename: str, allowed_extensions: set | None = None, field_name: str = "Berkas") -> str:
    """Memvalidasi dan mengamankan nama berkas dari directory traversal dan ekstensi berbahaya.
    
    Args:
        filename: String nama berkas.
        allowed_extensions: Set ekstensi yang diizinkan (contoh: {'zip', 'png'}).
        field_name: Nama field untuk pesan error.
        
    Returns:
        str: Nama berkas yang aman.
        
    Raises:
        ValueError: Jika berkas kosong, mengandung traversal, atau ekstensi tidak diizinkan.
    """
    if not filename or not str(filename).strip():
        raise ValueError(f"Nama {field_name} tidak boleh kosong")

    cleaned = str(filename).strip()

    # Cek percobaan directory traversal
    if ".." in cleaned or "/" in cleaned or "\\" in cleaned:
        raise ValueError(f"Akses tidak sah: Nama {field_name.lower()} mengandung karakter ilegal atau path traversal")

    if allowed_extensions:
        allowed_exts_clean = {ext.lower().lstrip(".") for ext in allowed_extensions}
        if "." not in cleaned:
            raise ValueError(f"Ekstensi {field_name.lower()} tidak valid. Pilihan: {', '.join(allowed_exts_clean)}")
        ext = cleaned.rsplit(".", 1)[1].lower()
        if ext not in allowed_exts_clean:
            raise ValueError(f"Ekstensi berkas tidak diizinkan ({ext}). Hanya mendukung: {', '.join(allowed_exts_clean)}")

    return cleaned

