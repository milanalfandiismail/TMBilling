from sqlalchemy import inspect, text

from app import create_app, db
from app.models import Member, PC, Sesi, Transaksi


def _app(tmp_path):
    return create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///' + (tmp_path / 'drift.db').as_posix(),
        'INSTANCE_PATH': str(tmp_path),
    })


def test_skema_setelah_migrasi_sama_dengan_model(tmp_path):
    # Rantai migrasi tidak membangun DB kosong (tabel dibuat create_all),
    # jadi yang diuji jalur nyata: run_migration pada DB hasil create_all.
    from install_scripts.run_migration import run as run_migration

    app = _app(tmp_path)

    with app.app_context():
        assert run_migration(app) is True
        inspector = inspect(db.engine)
        for model in (Transaksi, Sesi, Member, PC):
            kolom_db = {c['name'] for c in inspector.get_columns(model.__tablename__)}
            kolom_model = {c.name for c in model.__table__.columns}
            selisih = kolom_db.symmetric_difference(kolom_model)
            assert not selisih, model.__tablename__ + ': ' + str(selisih)

        with db.engine.connect() as conn:
            versi = conn.execute(text('SELECT version_num FROM alembic_version')).scalar()

        assert versi, 'alembic_version kosong setelah run_migration'
