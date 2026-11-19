"""add index transaksi_menu.tanggal

Revision ID: b1c2d3e4f5a6
Revises: d4e5f6a7b8c9
"""

from alembic import op

revision = "b1c2d3e4f5a6"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index("ix_transaksi_menu_tanggal", "transaksi_menu", ["tanggal"], unique=False)


def downgrade():
    op.drop_index("ix_transaksi_menu_tanggal", table_name="transaksi_menu")
