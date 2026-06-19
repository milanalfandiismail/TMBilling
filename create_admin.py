"""Script untuk membuat akun admin default.

Script ini dijalankan satu kali saat setup awal untuk memastikan
terdapat akun admin di database. Jika admin sudah ada maka tidak
akan membuat duplikat.

Usage:
    python create_admin.py

Default Credentials:
    Username : admin
    Password : admin123
"""

from app import create_app, db
from app.models import User

app = create_app()
with app.app_context():
    db.create_all()
    
    # Cek apakah admin sudah ada
    admin = User.query.filter_by(username="admin").first()
    if not admin:
        admin = User(
            username="admin",
            nama_lengkap="Administrator",
            role="admin",
            aktif=True
        )
        admin.set_password("admin123")
        db.session.add(admin)
        db.session.commit()
        print("✅ Admin created: username=admin, password=admin123")
    else:
        print("⚠️ Admin already exists")
    
    # Lihat semua user
    users = User.query.all()
    print("\n📋 Existing users:")
    for u in users:
        print(f"   - {u.username} ({u.role})")