# Database Maintenance & Data Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an Admin-only manual Database Maintenance feature in Settings to backup DB to `backups/archive/`, purge operational history older than a configurable retention period (1, 3, 6, 12 months), and perform physical SQLite `VACUUM` storage optimization without affecting any member balance or master operational data.

**Architecture:** A new Flask backend service `DBMaintenanceService` handles snapshot archiving, cutoff calculations, targeted SQL deletions (`transaksi`, `sesi`, `pc_process`, `pc_uptime_log`, `maintenance_ticket`, `shift_record`), and raw SQL `VACUUM`/`PRAGMA optimize;` execution. Exposed via a `@admin_required` endpoint and rendered in Settings UI with retention duration selector and execution results modal.

**Tech Stack:** Python 3.11+, Flask, SQLAlchemy, SQLite 3, Vanilla JavaScript (ES6), Tailwind CSS.

## Global Constraints

- Must enforce `@admin_required` on the endpoint.
- Must NEVER delete or modify rows in `member`, `pc`, `grup`, `paket`, `menu_item`, `game`, `user`, or active `sesi` (`status == 'aktif'`).
- Must save snapshot backups in `backups/archive/` before any deletion query.
- Must execute `VACUUM;` and `PRAGMA optimize;` after deletion.

---

### Task 1: Backend DB Maintenance Service (`DBMaintenanceService`)

**Files:**
- Create: `app/services/settings/db_maintenance_service.py`
- Modify: `app/services/backup/backup_service.py`

**Interfaces:**
- Consumes: `BackupService.create_backup()`, SQLAlchemy `db`, `now_local()`
- Produces: `DBMaintenanceService.purge_and_vacuum(retention_months: int) -> dict`

- [ ] **Step 1: Write DBMaintenanceService with snapshot archive & purge logic**

```python
# app/services/settings/db_maintenance_service.py

import os
from datetime import timedelta
from sqlalchemy import text
from app.models import db, now_local
from app.services.backup.backup_service import BackupService

class DBMaintenanceService:
    @staticmethod
    def purge_and_vacuum(retention_months: int) -> dict:
        if retention_months not in (1, 3, 6, 12):
            raise ValueError("Masa retensi harus 1, 3, 6, atau 12 bulan.")

        archive_dir = os.path.join(os.getcwd(), "backups", "archive")
        os.makedirs(archive_dir, exist_ok=True)
        
        # 1. Take snapshot backup before purge
        timestamp = now_local().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"warnet_pre_purge_{timestamp}.db"
        backup_path = os.path.join(archive_dir, backup_filename)
        
        db_path = db.engine.url.database
        if not os.path.exists(db_path):
            raise FileNotFoundError("File warnet.db tidak ditemukan.")
            
        initial_size = os.path.getsize(db_path)
        
        # Copy database file to archive
        import shutil
        shutil.copy2(db_path, backup_path)
        
        # 2. Calculate cutoff date
        cutoff_date = now_local() - timedelta(days=retention_months * 30)
        
        deleted_summary = {}
        
        # 3. Purge historical records older than cutoff date
        # pc_process
        r = db.session.execute(text("DELETE FROM pc_process WHERE last_update < :cutoff"), {"cutoff": cutoff_date})
        deleted_summary["pc_process"] = r.rowcount
        
        # pc_uptime_log
        r = db.session.execute(text("DELETE FROM pc_uptime_log WHERE date < :cutoff"), {"cutoff": cutoff_date})
        deleted_summary["pc_uptime_log"] = r.rowcount
        
        # maintenance_ticket
        r = db.session.execute(text("DELETE FROM maintenance_ticket WHERE status IN ('selesai', 'dibatalkan') AND dibuat_pada < :cutoff"), {"cutoff": cutoff_date})
        deleted_summary["maintenance_ticket"] = r.rowcount
        
        # transaksi_menu
        r = db.session.execute(text("DELETE FROM transaksi_menu WHERE transaksi_id IN (SELECT id FROM transaksi WHERE dibuat_pada < :cutoff)"), {"cutoff": cutoff_date})
        deleted_summary["transaksi_menu"] = r.rowcount
        
        # transaksi
        r = db.session.execute(text("DELETE FROM transaksi WHERE dibuat_pada < :cutoff"), {"cutoff": cutoff_date})
        deleted_summary["transaksi"] = r.rowcount
        
        # sesi (closed only)
        r = db.session.execute(text("DELETE FROM sesi WHERE status = 'selesai' AND waktu_selesai < :cutoff"), {"cutoff": cutoff_date})
        deleted_summary["sesi"] = r.rowcount
        
        # shift_record (closed only)
        r = db.session.execute(text("DELETE FROM shift_record WHERE status = 'selesai' AND waktu_mulai < :cutoff"), {"cutoff": cutoff_date})
        deleted_summary["shift_record"] = r.rowcount
        
        db.session.commit()
        
        # 4. Perform SQLite physical VACUUM & PRAGMA optimize
        db.session.execute(text("VACUUM;"))
        db.session.execute(text("PRAGMA optimize;"))
        
        final_size = os.path.getsize(db_path) if os.path.exists(db_path) else initial_size
        
        def format_size(bytes_val):
            for unit in ['B', 'KB', 'MB', 'GB']:
                if bytes_val < 1024.0:
                    return f"{bytes_val:.2f} {unit}"
                bytes_val /= 1024.0
            return f"{bytes_val:.2f} TB"

        return {
            "success": True,
            "message": "Pembersihan database dan optimasi VACUUM berhasil.",
            "backup_file": backup_filename,
            "retention_months": retention_months,
            "cutoff_date": cutoff_date.strftime("%Y-%m-%d %H:%M:%S"),
            "deleted_summary": deleted_summary,
            "storage_stats": {
                "initial_size_bytes": initial_size,
                "final_size_bytes": final_size,
                "initial_size_human": format_size(initial_size),
                "final_size_human": format_size(final_size),
                "saved_space_human": format_size(max(0, initial_size - final_size))
            }
        }
```

- [ ] **Step 2: Test service implementation**

Test creating archive and purging using python test script.

- [ ] **Step 3: Commit**

```bash
git add app/services/settings/db_maintenance_service.py
git commit -m "feat: add DBMaintenanceService for data retention purge and SQLite VACUUM"
```

---

### Task 2: Flask API Route for DB Purge & Vacuum (`@admin_required`)

**Files:**
- Modify: `app/routes/settings/settings_routes.py`

**Interfaces:**
- Consumes: `DBMaintenanceService.purge_and_vacuum()`
- Produces: `POST /api/v1/kasir/settings/database/purge-and-vacuum`

- [ ] **Step 1: Add API endpoint in `settings_routes.py`**

```python
# In app/routes/settings/settings_routes.py

from app.services.settings.db_maintenance_service import DBMaintenanceService

@settings_bp.route("/database/purge-and-vacuum", methods=["POST"])
@login_required
@admin_required
def purge_and_vacuum_database():
    """Endpoint untuk pembersihan histori database tua dan optimasi VACUUM (Admin only)."""
    data = request.get_json() or {}
    retention_months = data.get("retention_months", 6)
    
    try:
        retention_months = int(retention_months)
    except (ValueError, TypeError):
        return jsonify({"success": False, "error": "Batas bulan retensi tidak valid."}), 400
        
    try:
        result = DBMaintenanceService.purge_and_vacuum(retention_months)
        write_log("DB_MAINTENANCE", f"Admin membersihkan data > {retention_months} bulan & VACUUM DB. Space terhemat: {result['storage_stats']['saved_space_human']}")
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
```

- [ ] **Step 2: Commit**

```bash
git add app/routes/settings/settings_routes.py
git commit -m "feat: add POST /api/v1/kasir/settings/database/purge-and-vacuum API route"
```

---

### Task 3: Frontend Settings UI & Execution Modal

**Files:**
- Modify: `app/templates/kasir/settings/index.html`
- Modify: `app/static/js/kasir/modules/settings/index.js`

**Interfaces:**
- Consumes: `POST /api/v1/kasir/settings/database/purge-and-vacuum` API
- Produces: Admin DB Maintenance card in Settings and execution result modal.

- [ ] **Step 1: Add HTML component card in `app/templates/kasir/settings/index.html`**

Add card for Database Maintenance with retention select box (`1 Bulan`, `3 Bulan`, `6 Bulan`, `1 Tahun`) and trigger button `[ 🧹 Backup & Bersihkan Database ]` (guarded for Admin role).

- [ ] **Step 2: Add event listener and modal renderer in `modules/settings/index.js`**

Add click handler calling API `POST /api/v1/kasir/settings/database/purge-and-vacuum`, showing loading spinner, and opening result modal showing storage space saved and row counts deleted.

- [ ] **Step 3: Commit**

```bash
git add app/templates/kasir/settings/index.html app/static/js/kasir/modules/settings/index.js
git commit -m "feat: add Database Maintenance UI card and result modal in Settings"
```
