"""unique active session per pc

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-11-07

Mencegah dua sesi aktif pada PC yang sama (race antar kasir / request paralel).
"""

from alembic import op

revision = "c2d3e4f5a6b7"
down_revision = "b1c2d3e4f5a6"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_aktif_sesi_pc "
        "ON sesi (pc_id) WHERE status = 'aktif' AND pc_id IS NOT NULL"
    )


def downgrade():
    op.execute("DROP INDEX IF EXISTS uq_aktif_sesi_pc")
