import os
import pytest
from app.config import Config, get_or_create_secret_key

def test_secret_key_never_uses_insecure_default():
    """Memastikan SECRET_KEY tidak pernah memakai string default publik 'tm-billing-secret-key-default-2026'."""
    key = get_or_create_secret_key(env_path=None)
    assert key != "tm-billing-secret-key-default-2026"
    assert len(key) >= 32

def test_secret_key_persists_to_file(tmp_path):
    """Memastikan secret key acak yang dibuat disimpan ke file .env sementara."""
    test_env = tmp_path / ".env"
    key1 = get_or_create_secret_key(env_path=str(test_env))
    assert test_env.exists()
    assert key1 in test_env.read_text(encoding="utf-8")

    # Pembacaan kedua harus mengembalikan key yang sama dari file
    key2 = get_or_create_secret_key(env_path=str(test_env))
    assert key2 == key1
