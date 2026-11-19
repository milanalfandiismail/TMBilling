"""add uptime and stock log indexes

Revision ID: a2b3c4d5e6f7
Revises: a1b2c3d4e5f6
"""

from alembic import op

revision = "a2b3c4d5e6f7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE INDEX IF NOT EXISTS ix_pc_uptime_log_tanggal ON pc_uptime_log (tanggal)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_menu_stock_log_created_at ON menu_stock_log (created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_menu_stock_log_menu_id ON menu_stock_log (menu_id)")


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_menu_stock_log_menu_id")
    op.execute("DROP INDEX IF EXISTS ix_menu_stock_log_created_at")
    op.execute("DROP INDEX IF EXISTS ix_pc_uptime_log_tanggal")
