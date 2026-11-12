"""add tipe and multigenre to game

Revision ID: 8f7e6d5c4b3a
Revises: f3a1b2c4d5e6
Create Date: 2026-09-20 13:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8f7e6d5c4b3a'
down_revision = 'f3a1b2c4d5e6'
branch_labels = None
depends_on = None


def _columns(table):
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(table):
        return set()
    return {c["name"] for c in inspector.get_columns(table)}


def upgrade():
    # SQLite tidak menegakkan panjang VARCHAR, jadi pelebaran kategori tidak perlu
    # recreate tabel (batch_alter_table memicu circular dependency pada skema create_all).
    if "tipe" not in _columns("game"):
        op.add_column('game', sa.Column('tipe', sa.String(length=50), nullable=True, server_default='game'))


def downgrade():
    if "tipe" in _columns("game"):
        op.drop_column('game', 'tipe')
