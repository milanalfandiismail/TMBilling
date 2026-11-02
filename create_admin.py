"""Script CLI interaktif untuk membuat atau mereset akun superadmin.

Usage:
    python create_admin.py
"""
import secrets
import string
from app import create_app, db
from app.models import User

app = create_app()
with app.app_context():
    db.create_all()
    
    admin = User.query.filter_by(username="admin").first()
    if not admin:
        print("=== PEMBUATAN AKUN SUPERADMIN ===")
        pwd = input("Masukkan password untuk akun 'admin' (kosongkan untuk generate acak): ").strip()
        if not pwd:
            chars = string.ascii_letters + string.digits
            pwd = "".join(secrets.choice(chars) for _ in range(12))
            print(f"Password acak digenerate: {pwd}")
        
        admin = User(
            username="admin",
            nama_lengkap="Administrator",
            role="admin",
            aktif=True
        )
        admin.set_password(pwd)
        db.session.add(admin)
        db.session.commit()
        print("[OK] Akun superadmin 'admin' berhasil dibuat.")
    else:
        print("[INFO] Akun admin sudah ada di database.")
        try:
            reset = input("Apakah Anda ingin mereset password akun 'admin'? (y/N): ").strip().lower()
            if reset == "y":
                pwd = input("Masukkan password baru (kosongkan untuk generate acak): ").strip()
                if not pwd:
                    chars = string.ascii_letters + string.digits
                    pwd = "".join(secrets.choice(chars) for _ in range(12))
                    print(f"Password acak baru digenerate: {pwd}")
                admin.set_password(pwd)
                db.session.commit()
                print("[OK] Password akun 'admin' berhasil direset.")
        except (EOFError, KeyboardInterrupt):
            pass
    
    users = User.query.all()
    print("\n[DAFTAR] Pengguna terdaftar saat ini:")
    for u in users:
        print(f"   - {u.username} ({u.role})")