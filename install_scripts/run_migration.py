# install_scripts/run_migration.py
"""Skrip CLI mandiri migrasi database Alembic & safety-net sync (one-shot)."""
import os
import sys

root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from app import create_app, db

def run() -> bool:
    print("[MIGRATION] Menjalankan migrasi skema database...")
    app = create_app()
    with app.app_context():
        migrations_dir = os.path.join(root_dir, "migrations")
        if not os.path.exists(migrations_dir):
            print("[MIGRATION] Folder migrations tidak ditemukan.")
            return False

        ok = True
        try:
            from flask_migrate import upgrade, stamp
            from sqlalchemy import inspect, text

            inspector = inspect(db.engine)
            current_rev = None
            if inspector.has_table("alembic_version"):
                with db.engine.connect() as conn:
                    current_rev = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()

            if current_rev is None and inspector.has_table("transaksi"):
                try:
                    stamp(directory=migrations_dir, revision="e8f9a0b1c2d3")
                except Exception as stamp_err:
                    print(f"[MIGRATION WARNING] Auto-stamp: {stamp_err}")

            upgrade(directory=migrations_dir)
            print("[MIGRATION] Alembic upgrade berhasil.")
        except (Exception, SystemExit) as e:
            print(f"[MIGRATION ERROR] Alembic upgrade gagal: {e}")
            ok = False

        # Safety Net: sinkronisasi tabel & kolom baru
        try:
            from sqlalchemy import inspect, text
            inspector = inspect(db.engine)
            db.create_all()

            if inspector.has_table("transaksi"):
                cols = [c["name"] for c in inspector.get_columns("transaksi")]
                if "operator" not in cols:
                    with db.engine.connect() as conn:
                        conn.execute(text("ALTER TABLE transaksi ADD COLUMN operator VARCHAR(100)"))
                        conn.commit()

            if inspector.has_table("transaksi_menu"):
                cols = [c["name"] for c in inspector.get_columns("transaksi_menu")]
                if "operator" not in cols:
                    with db.engine.connect() as conn:
                        conn.execute(text("ALTER TABLE transaksi_menu ADD COLUMN operator VARCHAR(100)"))
                        conn.commit()

            # Auto-migration v1.6.5-rc2: Subsystem multi-branch dihapus (tabel cabang & cabang_inbound di-drop via migration)

            if inspector.has_table("game"):
                cols = [c["name"] for c in inspector.get_columns("game")]
                if "tipe" not in cols:
                    with db.engine.connect() as conn:
                        conn.execute(text("ALTER TABLE game ADD COLUMN tipe VARCHAR(50) DEFAULT 'game'"))
                        conn.commit()
            else:
                from app.models.game.game import Game
                Game.__table__.create(db.engine)

            if not inspector.has_table("game_kategori"):
                from app.models.game.game_kategori import GameKategori
                GameKategori.__table__.create(db.engine)

            if inspector.has_table("user"):
                user_cols = [c["name"] for c in inspector.get_columns("user")]
                with db.engine.connect() as conn:
                    if "kuota_main_bulanan" not in user_cols:
                        conn.execute(text("ALTER TABLE user ADD COLUMN kuota_main_bulanan INTEGER DEFAULT 0"))
                    if "sisa_kuota_menit" not in user_cols:
                        conn.execute(text("ALTER TABLE user ADD COLUMN sisa_kuota_menit INTEGER DEFAULT 0"))
                    if "terakhir_reset_kuota" not in user_cols:
                        conn.execute(text("ALTER TABLE user ADD COLUMN terakhir_reset_kuota VARCHAR(7)"))
                    conn.commit()

            if inspector.has_table("sesi"):
                sesi_cols = [c["name"] for c in inspector.get_columns("sesi")]
                with db.engine.connect() as conn:
                    if "user_id" not in sesi_cols:
                        conn.execute(text("ALTER TABLE sesi ADD COLUMN user_id INTEGER REFERENCES user(id)"))
                    if "is_afk" not in sesi_cols:
                        conn.execute(text("ALTER TABLE sesi ADD COLUMN is_afk BOOLEAN DEFAULT 0"))
                    if "afk_pin" not in sesi_cols:
                        conn.execute(text("ALTER TABLE sesi ADD COLUMN afk_pin VARCHAR(100)"))
                    if "afk_sejak" not in sesi_cols:
                        conn.execute(text("ALTER TABLE sesi ADD COLUMN afk_sejak DATETIME"))
                    if "sesi_asal_id" not in sesi_cols:
                        conn.execute(text("ALTER TABLE sesi ADD COLUMN sesi_asal_id INTEGER REFERENCES sesi(id)"))
                    conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_aktif_sesi_member ON sesi (member_id) WHERE status = 'aktif' AND member_id IS NOT NULL"))
                    conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_aktif_sesi_pc ON sesi (pc_id) WHERE status = 'aktif' AND pc_id IS NOT NULL"))
                    conn.commit()

            if inspector.has_table("shift_record"):
                shift_cols = [c["name"] for c in inspector.get_columns("shift_record")]
                with db.engine.connect() as conn:
                    if "catatan" not in shift_cols:
                        conn.execute(text("ALTER TABLE shift_record ADD COLUMN catatan VARCHAR(255)"))
                    if "total_qris" not in shift_cols:
                        conn.execute(text("ALTER TABLE shift_record ADD COLUMN total_qris INTEGER DEFAULT 0"))
                    if "total_refund" not in shift_cols:
                        conn.execute(text("ALTER TABLE shift_record ADD COLUMN total_refund INTEGER DEFAULT 0"))
                    if "detail_metode_json" not in shift_cols:
                        conn.execute(text("ALTER TABLE shift_record ADD COLUMN detail_metode_json TEXT"))
                    conn.commit()

            if not inspector.has_table("menu_stock_log"):
                from app.models.menu.menu import MenuStockLog
                MenuStockLog.__table__.create(db.engine)

            from flask_migrate import stamp
            stamp(directory=migrations_dir, revision="head")
            print("[MIGRATION] Safety sync skema berhasil.")
        except (Exception, SystemExit) as sync_err:
            print(f"[MIGRATION WARNING] Safety sync skema: {sync_err}")
            ok = False

        return ok

if __name__ == "__main__":
    sys.exit(0 if run() else 1)
