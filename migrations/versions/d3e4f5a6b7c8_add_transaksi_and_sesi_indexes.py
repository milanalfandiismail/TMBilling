"""add transaksi and sesi indexes

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
"""

from alembic import op

revision = "d3e4f5a6b7c8"
down_revision = "c2d3e4f5a6b7"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE INDEX IF NOT EXISTS ix_transaksi_member_id ON transaksi (member_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_transaksi_user_id ON transaksi (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sesi_mulai_pada ON sesi (mulai_pada)")


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_sesi_mulai_pada")
    op.execute("DROP INDEX IF EXISTS ix_transaksi_user_id")
    op.execute("DROP INDEX IF EXISTS ix_transaksi_member_id")
