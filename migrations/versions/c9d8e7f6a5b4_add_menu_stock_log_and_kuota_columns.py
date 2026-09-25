"""add menu stock log table and user kuota columns

Revision ID: c9d8e7f6a5b4
Revises: b7e2c91a4f01
Create Date: 2026-09-25 22:35:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = 'c9d8e7f6a5b4'
down_revision = 'b7e2c91a4f01'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)

    # 1. Buat tabel menu_stock_log jika belum ada
    if not inspector.has_table('menu_stock_log'):
        op.create_table(
            'menu_stock_log',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('menu_id', sa.Integer(), nullable=True),
            sa.Column('menu_nama', sa.String(length=100), nullable=False),
            sa.Column('tipe', sa.String(length=20), server_default='RESTOCK', nullable=False),
            sa.Column('jumlah_masuk', sa.Integer(), server_default='0', nullable=False),
            sa.Column('stok_sebelum', sa.Integer(), server_default='0', nullable=False),
            sa.Column('stok_sesudah', sa.Integer(), server_default='0', nullable=False),
            sa.Column('operator', sa.String(length=100), nullable=False),
            sa.Column('catatan', sa.String(length=255), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['menu_id'], ['menu_item.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id')
        )

    # 2. Kolom kuota pada tabel user
    if inspector.has_table('user'):
        user_cols = [c['name'] for c in inspector.get_columns('user')]
        with op.batch_alter_table('user', schema=None) as batch_op:
            if 'kuota_main_bulanan' not in user_cols:
                batch_op.add_column(sa.Column('kuota_main_bulanan', sa.Integer(), server_default='0', nullable=True))
            if 'sisa_kuota_menit' not in user_cols:
                batch_op.add_column(sa.Column('sisa_kuota_menit', sa.Integer(), server_default='0', nullable=True))
            if 'terakhir_reset_kuota' not in user_cols:
                batch_op.add_column(sa.Column('terakhir_reset_kuota', sa.String(length=7), nullable=True))

    # 3. Kolom user_id pada tabel sesi
    if inspector.has_table('sesi'):
        sesi_cols = [c['name'] for c in inspector.get_columns('sesi')]
        if 'user_id' not in sesi_cols:
            with op.batch_alter_table('sesi', schema=None) as batch_op:
                batch_op.add_column(sa.Column('user_id', sa.Integer(), nullable=True))

    # 4. Kolom catatan, qris, refund pada shift_record
    if inspector.has_table('shift_record'):
        shift_cols = [c['name'] for c in inspector.get_columns('shift_record')]
        with op.batch_alter_table('shift_record', schema=None) as batch_op:
            if 'catatan' not in shift_cols:
                batch_op.add_column(sa.Column('catatan', sa.String(length=255), nullable=True))
            if 'total_qris' not in shift_cols:
                batch_op.add_column(sa.Column('total_qris', sa.Integer(), server_default='0', nullable=True))
            if 'total_refund' not in shift_cols:
                batch_op.add_column(sa.Column('total_refund', sa.Integer(), server_default='0', nullable=True))
            if 'detail_metode_json' not in shift_cols:
                batch_op.add_column(sa.Column('detail_metode_json', sa.Text(), nullable=True))


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)

    # 1. Rollback shift_record columns
    if inspector.has_table('shift_record'):
        shift_cols = [c['name'] for c in inspector.get_columns('shift_record')]
        with op.batch_alter_table('shift_record', schema=None) as batch_op:
            if 'detail_metode_json' in shift_cols:
                batch_op.drop_column('detail_metode_json')
            if 'total_refund' in shift_cols:
                batch_op.drop_column('total_refund')
            if 'total_qris' in shift_cols:
                batch_op.drop_column('total_qris')
            if 'catatan' in shift_cols:
                batch_op.drop_column('catatan')

    # 2. Rollback sesi column
    if inspector.has_table('sesi'):
        sesi_cols = [c['name'] for c in inspector.get_columns('sesi')]
        if 'user_id' in sesi_cols:
            with op.batch_alter_table('sesi', schema=None) as batch_op:
                batch_op.drop_column('user_id')

    # 3. Rollback user columns
    if inspector.has_table('user'):
        user_cols = [c['name'] for c in inspector.get_columns('user')]
        with op.batch_alter_table('user', schema=None) as batch_op:
            if 'terakhir_reset_kuota' in user_cols:
                batch_op.drop_column('terakhir_reset_kuota')
            if 'sisa_kuota_menit' in user_cols:
                batch_op.drop_column('sisa_kuota_menit')
            if 'kuota_main_bulanan' in user_cols:
                batch_op.drop_column('kuota_main_bulanan')

    # 4. Drop table menu_stock_log
    if inspector.has_table('menu_stock_log'):
        op.drop_table('menu_stock_log')
