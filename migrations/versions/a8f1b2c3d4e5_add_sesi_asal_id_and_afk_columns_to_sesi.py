"""add sesi_asal_id and afk columns to sesi

Revision ID: a8f1b2c3d4e5
Revises: e7a1b2c3d4f5
Create Date: 2026-10-01 17:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = 'a8f1b2c3d4e5'
down_revision = 'e7a1b2c3d4f5'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)

    if inspector.has_table('sesi'):
        sesi_cols = [c['name'] for c in inspector.get_columns('sesi')]
        with op.batch_alter_table('sesi', schema=None) as batch_op:
            if 'sesi_asal_id' not in sesi_cols:
                batch_op.add_column(sa.Column('sesi_asal_id', sa.Integer(), nullable=True))
            if 'is_afk' not in sesi_cols:
                batch_op.add_column(sa.Column('is_afk', sa.Boolean(), server_default='0', nullable=False))
            if 'afk_pin' not in sesi_cols:
                batch_op.add_column(sa.Column('afk_pin', sa.String(length=100), nullable=True))
            if 'afk_sejak' not in sesi_cols:
                batch_op.add_column(sa.Column('afk_sejak', sa.DateTime(), nullable=True))


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)

    if inspector.has_table('sesi'):
        sesi_cols = [c['name'] for c in inspector.get_columns('sesi')]
        with op.batch_alter_table('sesi', schema=None) as batch_op:
            if 'afk_sejak' in sesi_cols:
                batch_op.drop_column('afk_sejak')
            if 'afk_pin' in sesi_cols:
                batch_op.drop_column('afk_pin')
            if 'is_afk' in sesi_cols:
                batch_op.drop_column('is_afk')
            if 'sesi_asal_id' in sesi_cols:
                batch_op.drop_column('sesi_asal_id')
