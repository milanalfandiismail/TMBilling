"""add operator to transaksi and transaksi_menu

Revision ID: f3a1b2c4d5e6
Revises: e8f9a0b1c2d3
Create Date: 2026-09-04 17:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f3a1b2c4d5e6'
down_revision = 'e8f9a0b1c2d3'
branch_labels = None
depends_on = None


def _columns(table):
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(table):
        return None
    return {c["name"] for c in inspector.get_columns(table)}


def upgrade():
    # DB hasil db.create_all() sudah punya kolom operator, jadi add_column harus dijaga.
    for table in ("transaksi", "transaksi_menu"):
        cols = _columns(table)
        if cols is None or "operator" in cols:
            continue
        with op.batch_alter_table(table, schema=None) as batch_op:
            batch_op.add_column(sa.Column('operator', sa.String(length=100), nullable=True))


def downgrade():
    for table in ("transaksi_menu", "transaksi"):
        cols = _columns(table)
        if cols is None or "operator" not in cols:
            continue
        with op.batch_alter_table(table, schema=None) as batch_op:
            batch_op.drop_column('operator')
