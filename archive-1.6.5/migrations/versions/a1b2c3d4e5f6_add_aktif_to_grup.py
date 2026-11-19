"""add_aktif_to_grup

Revision ID: a1b2c3d4e5f6
Revises: e5f6a7b8c9d0
Create Date: 2026-11-13 14:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade():
    # Guard: database hasil create_all sudah membawa kolom ini.
    cols = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("grup")}
    if "aktif" not in cols:
        with op.batch_alter_table('grup', schema=None) as batch_op:
            batch_op.add_column(sa.Column('aktif', sa.Boolean(), nullable=False, server_default=sa.text('1')))


def downgrade():
    cols = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("grup")}
    if "aktif" in cols:
        with op.batch_alter_table('grup', schema=None) as batch_op:
            batch_op.drop_column('aktif')
