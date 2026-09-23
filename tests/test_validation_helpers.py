# tests/test_validation_helpers.py
import pytest
from app.utils.validators import (
    validate_username,
    validate_password,
    validate_integer_range,
    validate_hex_color,
    validate_phone_number,
    validate_email_format,
    validate_string_length
)


def test_validate_username():
    # Valid usernames
    assert validate_username("admin_123") == "admin_123"
    assert validate_username("  Kasir.01  ") == "Kasir.01"
    assert validate_username("user-test", lowercase_only=True) == "user-test"
    assert validate_username("User_Test", lowercase_only=True) == "user_test"

    # Too short / too long
    with pytest.raises(ValueError, match="minimal 3 karakter"):
        validate_username("ab")
    with pytest.raises(ValueError, match="maksimal 30 karakter"):
        validate_username("a" * 31)

    # Invalid characters
    with pytest.raises(ValueError, match="hanya boleh berisi"):
        validate_username("user@name")
    with pytest.raises(ValueError, match="hanya boleh berisi"):
        validate_username("user space")


def test_validate_password():
    # Valid passwords
    assert validate_password("secret123", min_len=6, max_len=32) == "secret123"
    assert validate_password("1234", min_len=4, max_len=16) == "1234"

    # Too short / too long
    with pytest.raises(ValueError, match="minimal 6 karakter"):
        validate_password("12345", min_len=6, max_len=32)
    with pytest.raises(ValueError, match="maksimal 16 karakter"):
        validate_password("12345678901234567", min_len=4, max_len=16)

    # Blank / only whitespace
    with pytest.raises(ValueError, match="tidak boleh kosong"):
        validate_password("")
    with pytest.raises(ValueError, match="tidak boleh hanya berisi spasi"):
        validate_password("      ", min_len=4, max_len=16)


def test_validate_integer_range():
    assert validate_integer_range(10, 1, 100, "Kuantitas") == 10
    assert validate_integer_range("25", 1, 100, "Kuantitas") == 25

    with pytest.raises(ValueError, match="Kuantitas harus berupa angka"):
        validate_integer_range("invalid", 1, 100, "Kuantitas")
    with pytest.raises(ValueError, match="Kuantitas harus antara 1 sampai 100"):
        validate_integer_range(0, 1, 100, "Kuantitas")
    with pytest.raises(ValueError, match="Kuantitas harus antara 1 sampai 100"):
        validate_integer_range(101, 1, 100, "Kuantitas")


def test_validate_hex_color():
    assert validate_hex_color("#FF5733") == "#FF5733"
    assert validate_hex_color("#fff") == "#fff"
    assert validate_hex_color("", default="#888888") == "#888888"
    assert validate_hex_color(None, default="#888888") == "#888888"

    with pytest.raises(ValueError, match="Format warna hex tidak valid"):
        validate_hex_color("red")
    with pytest.raises(ValueError, match="Format warna hex tidak valid"):
        validate_hex_color("#12345")


def test_validate_phone_number():
    assert validate_phone_number("081234567890") == "081234567890"
    assert validate_phone_number("+62 812-3456-7890") == "+62 812-3456-7890"
    assert validate_phone_number("") is None
    assert validate_phone_number(None) is None

    with pytest.raises(ValueError, match="Nomor HP harus"):
        validate_phone_number("123")  # too short
    with pytest.raises(ValueError, match="Nomor HP harus"):
        validate_phone_number("0812abc3456")  # invalid chars


def test_validate_email_format():
    assert validate_email_format("user@example.com") == "user@example.com"
    assert validate_email_format("test.member+warnet@gmail.co.id") == "test.member+warnet@gmail.co.id"
    assert validate_email_format("") is None
    assert validate_email_format(None) is None

    with pytest.raises(ValueError, match="Format alamat email tidak valid"):
        validate_email_format("invalid-email")
    with pytest.raises(ValueError, match="Format alamat email tidak valid"):
        validate_email_format("user@domain")


def test_validate_string_length():
    assert validate_string_length("Paket Hemat", 2, 50, "Nama Paket") == "Paket Hemat"
    assert validate_string_length("   Spasi   ", 2, 50, "Nama") == "Spasi"

    with pytest.raises(ValueError, match="Nama Paket tidak boleh kosong"):
        validate_string_length("", 2, 50, "Nama Paket", required=True)
    with pytest.raises(ValueError, match="Nama minimal 3 karakter"):
        validate_string_length("ab", 3, 50, "Nama")
    with pytest.raises(ValueError, match="Nama maksimal 10 karakter"):
        validate_string_length("12345678901", 1, 10, "Nama")


def test_validate_ip_address():
    from app.utils.validators import validate_ip_address
    # Valid IPv4
    assert validate_ip_address("192.168.1.10") == "192.168.1.10"
    assert validate_ip_address("  10.0.0.1  ") == "10.0.0.1"
    assert validate_ip_address("", allow_empty=True) is None
    assert validate_ip_address(None, allow_empty=True) is None

    # Invalid IPv4
    with pytest.raises(ValueError, match="Alamat IP tidak boleh kosong"):
        validate_ip_address("", allow_empty=False)
    with pytest.raises(ValueError, match="Format alamat IP tidak valid"):
        validate_ip_address("999.999.999.999")
    with pytest.raises(ValueError, match="Format alamat IP tidak valid"):
        validate_ip_address("192.168.1.abc")


def test_validate_mac_address():
    from app.utils.validators import validate_mac_address
    # Valid MAC
    assert validate_mac_address("AA:BB:CC:DD:EE:FF") == "AA:BB:CC:DD:EE:FF"
    assert validate_mac_address("aa-bb-cc-dd-ee-ff") == "AA:BB:CC:DD:EE:FF"
    assert validate_mac_address("aabb.ccdd.eeff") == "AA:BB:CC:DD:EE:FF"
    assert validate_mac_address("aabbccddeeff") == "AA:BB:CC:DD:EE:FF"
    assert validate_mac_address("", allow_empty=True) is None
    assert validate_mac_address(None, allow_empty=True) is None

    # Invalid MAC
    with pytest.raises(ValueError, match="Alamat MAC tidak boleh kosong"):
        validate_mac_address("", allow_empty=False)
    with pytest.raises(ValueError, match="Format alamat MAC address tidak valid"):
        validate_mac_address("AA:BB:CC:DD:EE:GG")
    with pytest.raises(ValueError, match="Format alamat MAC address tidak valid"):
        validate_mac_address("12345")


def test_validate_choice():
    from app.utils.validators import validate_choice
    choices = ["admin", "kasir", "teknisi"]
    assert validate_choice("admin", choices, "Role") == "admin"
    assert validate_choice("KASIR", choices, "Role", case_sensitive=False) == "kasir"

    with pytest.raises(ValueError, match="Role tidak valid"):
        validate_choice("superadmin", choices, "Role")


def test_validate_filename():
    from app.utils.validators import validate_filename
    # Valid filenames
    assert validate_filename("catatan.txt", allowed_extensions={"txt"}) == "catatan.txt"
    assert validate_filename("backup_2026_09_23.zip", allowed_extensions={"zip"}) == "backup_2026_09_23.zip"
    assert validate_filename("foto_profile.png", allowed_extensions={"png", "jpg"}) == "foto_profile.png"

    # Directory traversal attempts
    with pytest.raises(ValueError, match="Akses tidak sah"):
        validate_filename("../../../etc/passwd")
    with pytest.raises(ValueError, match="Akses tidak sah"):
        validate_filename("folder/subfolder/file.txt")

    # Invalid extensions
    with pytest.raises(ValueError, match="Ekstensi berkas tidak diizinkan"):
        validate_filename("malicious.exe", allowed_extensions={"txt", "zip"})
    with pytest.raises(ValueError, match="Nama Berkas tidak boleh kosong"):
        validate_filename("")

