# Backend Guide — TMBilling

## Struktur Proyek Backend

```
app/
├── __init__.py          # Factory, blueprint registration, CSRF
├── config.py            # Env vars: DB, SECRET_KEY, CLIENT_API_KEY
├── models/              # SQLAlchemy models (Rich Domain Model)
│   ├── base.py          # db instance, now_local()
│   ├── pc.py            # PC.to_dict(), sesi_aktif property
│   ├── sesi.py          # sisa_menit(), hitung_sisa_pada()
│   ├── transaksi.py     # no_nota, is_refunded
│   ├── member.py        # tambah_waktu(), cek_kadaluarsa()
│   ├── paket.py         # durasi_menit, harga, grup
│   ├── grup.py          # nama, warna
│   ├── user.py          # set_password(), check_password()
│   ├── hardware.py      # CPU/GPU temp, processes
│   └── settings.py      # Key-value store
├── repositories/        # Data Access Layer (DILARANG commit)
│   ├── pc_repository.py
│   ├── sesi_repository.py
│   ├── member_repository.py
│   ├── paket_repository.py
│   ├── grup_repository.py
│   ├── transaksi_repository.py
│   ├── user_repository.py
│   ├── settings_repository.py
│   ├── hardware_repository.py
│   └── process_repository.py
├── services/            # Business Logic (SATU-SATUNYA commit)
│   ├── pc_service.py
│   ├── sesi_service.py
│   ├── member_service.py
│   ├── paket_service.py
│   ├── grup_service.py
│   ├── report_service.py
│   ├── transaksi_service.py
│   ├── dashboard_service.py
│   ├── auth_service.py
│   ├── auth_kasir_service.py
│   ├── client_service.py
│   ├── blackout_service.py
│   ├── hardware_service.py
│   ├── backup_service.py
│   ├── settings_service.py
│   └── user_service.py
├── routes/              # Endpoints (hanya validasi + delegasi)
│   ├── dashboard_routes.py
│   ├── sesi_routes.py
│   ├── member_routes.py
│   ├── paket_routes.py
│   ├── pc_routes.py
│   ├── grup_routes.py
│   ├── report_routes.py
│   ├── client_routes.py
│   ├── auth_routes.py
│   ├── auth_kasir_routes.py
│   ├── blackout_routes.py
│   ├── monitor_routes.py
│   ├── settings_routes.py
│   └── user_routes.py
├── templates/kasir/     # Jinja2 templates
├── static/              # JS, CSS
└── utils/               # Logger, helpers
```

## 3-Layer Architecture Rules

### Layer 1: Routes (`app/routes/`)

**Tugas**: Validasi request, delegasi ke service, return JSON.

```python
# ✅ BENAR
@pc_bp.route("/", methods=["POST"])
@login_required
def tambah_pc():
    try:
        data = request.get_json() or {}
        pc = PCService.create(data)
        return jsonify({"success": True, "pc": pc.to_dict()}), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

# ❌ SALAH — query langsung di route
@pc_bp.route("/")
def list_pc():
    pcs = PC.query.all()  # HARAM! Harus lewat service + repo
    return jsonify([p.to_dict() for p in pcs])
```

### Layer 2: Services (`app/services/`)

**Tugas**: Business logic. Hanya di sini `commit()` dan `rollback()`.

```python
# ✅ BENAR
@staticmethod
def create(data, operator="system"):
    pc = PC(kode=data["kode"], grup_id=grup.id)
    db.session.add(pc)
    db.session.commit()       # ✅ Commit di sini
    write_log("TAMBAH_PC", f"PC {pc.kode} dibuat", user=operator)
    return pc

# ❌ SALAH — commit di repository
class PCRepository:
    def save(pc):
        db.session.add(pc)
        db.session.commit()   # ❌ HARAM! Repository dilarang commit
```

### Layer 3: Repositories (`app/repositories/`)

**Tugas**: Query database, `add()`, `delete()`. **DILARANG commit**.

```python
# ✅ BENAR
class PCRepository:
    @staticmethod
    def get_by_kode(kode):
        return PC.query.filter_by(kode=kode, aktif=True).first()

    @staticmethod
    def save(pc):
        db.session.add(pc)    # ✅ Hanya add, no commit
```

## Rich Domain Model

Logic yang melekat pada identitas data ditaruh di **Model**, bukan Service.

```python
# ✅ Domain logic di Model
class Sesi(db.Model):
    def sisa_menit(self):
        """Menghitung sisa menit secara real-time."""
        pause = self.menit_pause_total or 0
        if self.tipe == "guest":
            return max(0, self.durasi_beli_menit - self.menit_terpakai())
        else:
            delta = now_local() - self.waktu_mulai_sesi
            menit_terpakai = max(0, int(delta.total_seconds() / 60) - pause)
            return max(0, self.waktu_tersimpan_awal - menit_terpakai)

class Member(db.Model):
    def tambah_waktu(self, menit, kadaluarsa_hari):
        self.waktu_tersimpan += menit
        if self.waktu_tersimpan - menit == 0:
            self.kadaluarsa_pada = now_local() + timedelta(days=kadaluarsa_hari)
```

## Menambah Fitur Baru

### Workflow: Module Cafe/Kantin

```
1. MODEL    → app/models/kantin.py          → definisi tabel
2. REPO     → app/repositories/kantin_repo.py → query CRUD
3. SERVICE  → app/services/kantin_service.py  → business logic
4. ROUTES   → app/routes/kantin_routes.py     → endpoint API
5. BLUEPRINT→ app/__init__.py                 → register blueprint
6. FRONTEND → app/static/js/kasir/modules/    → module JS
```

### Contoh Model

```python
# app/models/kantin.py
from app.models.base import db, now_local

class KantinItem(db.Model):
    __tablename__ = "kantin_item"
    id = db.Column(db.Integer, primary_key=True)
    nama = db.Column(db.String(100), nullable=False)
    harga = db.Column(db.Integer, nullable=False, default=0)
    aktif = db.Column(db.Boolean, default=True)
```

### Contoh Repository

```python
# app/repositories/kantin_repository.py
from app.models.kantin import KantinItem

class KantinRepository:
    @staticmethod
    def get_all():
        return KantinItem.query.filter_by(aktif=True).all()

    @staticmethod
    def save(item):
        db.session.add(item)
```

### Contoh Service

```python
# app/services/kantin_service.py
from app.models.base import db
from app.repositories.kantin_repository import KantinRepository

class KantinService:
    @staticmethod
    def create(data):
        item = KantinItem(nama=data["nama"], harga=data["harga"])
        KantinRepository.save(item)
        db.session.commit()
        return item
```

### Contoh Routes

```python
# app/routes/kantin_routes.py
from flask import Blueprint, request, jsonify
from app.services.kantin_service import KantinService

kantin_bp = Blueprint("kantin", __name__)

@kantin_bp.route("/menu", methods=["GET"])
def list_menu():
    items = KantinService.get_all()
    return jsonify({"menu": [i.to_dict() for i in items]})
```

### Register Blueprint

```python
# app/__init__.py
from app.routes.kantin_routes import kantin_bp
app.register_blueprint(kantin_bp, url_prefix="/api/kantin")
```

## Error Handling

### Pattern Wajib

```python
# Service — try + commit/rollback
def proses():
    try:
        # operasi database via repositories
        db.session.commit()
        return result
    except Exception as e:
        db.session.rollback()
        raise e  # lempar ke route

# Route — try + return JSON
@route.endpoint
def api():
    try:
        result = Service.proses()
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500
```

### HTTP Status Codes

| Kode | Kapan |
|------|-------|
| 200 | Sukses |
| 201 | Created (tambah data) |
| 400 | Bad request (ValueError) |
| 401 | Not logged in |
| 403 | Forbidden (not admin) |
| 404 | Not found |
| 500 | Internal error |

## Transaksi & Atomisitas

Setiap operasi yang mengubah banyak tabel WAJIB dibungkus satu transaksi:

```python
@staticmethod
def buka_guest(pc_kode, paket_id, nama_guest="Guest", operator="system"):
    # Validasi
    pc = PCRepository.get_by_kode(pc_kode)
    paket = PaketRepository.get_by_id(paket_id)

    # 1. Buat sesi
    sesi = Sesi(tipe="guest", ...)
    db.session.add(sesi)
    db.session.flush()  # ambil ID sesi

    # 2. Buat transaksi
    transaksi = Transaksi(sesi_id=sesi.id, ...)
    db.session.add(transaksi)

    # 3. Commit sekali
    db.session.commit()
```

## Scheduler (Background Tasks)

Di `run.py` menggunakan APScheduler:

| Task | Interval | Fungsi |
|------|----------|--------|
| Cleanup expired | 1 menit | Tutup sesi yang waktu habis |
| Database backup | 60 menit | Backup otomatis ke `backups/` |

```python
scheduler = BackgroundScheduler()
scheduler.add_job(func=run_cleanup_expired, args=[app],
                  trigger="interval", minutes=1, id="cleanup_expired")
scheduler.add_job(func=run_database_backup, args=[app],
                  trigger="interval", minutes=60, id="database_backup")
```

## Database Migrations

Menggunakan Flask-Migrate (Alembic):

```bash
flask db migrate -m "tambah tabel kantin"
flask db upgrade
flask db downgrade  # rollback
```

Atau untuk development, cukup matikan migration dan biarkan `db.create_all()`:

```python
# app/__init__.py
with app.app_context():
    db.create_all()  # otomatis bikin tabel baru
```

## Environment Config

File: `.env` (root project — auto-generated oleh `install.bat`)

```ini
SECRET_KEY=...            # Auto-generated acak saat install.bat dijalankan
DATABASE_URL=sqlite:///warnet.db
CLIENT_API_KEY=...        # Dapat dirotasi dari dashboard Settings (langsung update .env)
DEBUG_MODE=False
WAITRESS_THREADS=8
BLACKOUT_THRESHOLD_MINUTES=60   # Menit PC tidak polling sebelum dianggap mati lampu
```

> **Catatan**:
> - `AUTO_SHUTDOWN_MINUTES` dihapus — dikelola di database via `SettingsService` (default 180 detik, ubah dari tab Settings dashboard).
> - `POLLING_INTERVAL` dihapus — interval polling diatur di sisi client (Tauri), bukan server.
> - `CLIENT_API_KEY` di `.env` ditulis ulang otomatis setiap kali dirotasi dari dashboard.

### Switching Database (PostgreSQL)

```ini
DATABASE_URL=postgresql://user:pass@localhost:5432/tmbilling
```

## Seeding Data

```bash
python seed.py
```

Script `seed.py` mengisi:
- **3 Grup**: `tm`, `vip`, `vvip`
- **3 PC**: PC-01, PC-02 (reguler), VIP-01 (vip)
- **3 Paket**: 1 Jam, 3 Jam, Begadang VIP
- **1 User**: admin / admin

## Autentikasi & Otorisasi

### Decorators

```python
from app.routes.auth_kasir_routes import login_required, admin_required

@route.endpoint
@login_required          # session wajib ada
@admin_required          # role wajib admin (opsional)
def api():
    pass
```

### Client Tauri API Key

```python
# Decorator di client_routes.py
def api_key_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        api_key = request.headers.get("X-Client-Key")
        expected_key = current_app.config.get("CLIENT_API_KEY")
        if not api_key or api_key != expected_key:
            return jsonify({"error": "Invalid API Key"}), 401
        return f(*args, **kwargs)
    return decorated
```

## Logging

Semua aktivitas dicatat via `app/utils/logger.py`:

```python
write_log("KATEGORI", "Deskripsi kejadian", user="admin")
```

Output tersimpan di `logs/warnet.log` dengan format:
```
[2026-05-15 08:30:00] KATEGORI | admin | Deskripsi kejadian
```

## CSRF Protection

Flask-WTF aktif global. Endpoint POST/PUT/DELETE wajib kirim header:

```
X-CSRFToken: <token>
```

Token diambil dari `<meta name="csrf-token">` di HTML.
Client Tauri dikecualikan: `csrf.exempt(client_bp)`.

## Key Terminology

| Istilah | Definisi |
|---------|----------|
| **Grup** | Zona/zona PC (reguler, vip, vvip) |
| **Sesi** | Periode penggunaan PC oleh guest/member/admin |
| **Blackout** | Kejadian mati lampu yang memutus sesi |
| **Suspect** | Sesi yang dicurigai terdampak blackout |
| **Resolve** | Proses pemulihan sesi blackout |
| **Nota** | Nomor transaksi format `TM-YYYYMMDD-NNN` |
| **Heartbeat** | Polling Tauri client tiap 5 detik |
| **Shutdown Timer** | Hitungan mundur sebelum PC shutdown otomatis |

---
*TMBilling v1.0 — Backend Guide*
