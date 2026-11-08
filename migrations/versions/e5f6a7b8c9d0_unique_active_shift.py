"""unique active shift

Revision ID: e5f6a7b8c9d0
Revises: d3e4f5a6b7c8
"""

from alembic import op

revision = "e5f6a7b8c9d0"
down_revision = "d3e4f5a6b7c8"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_aktif_shift "
        "ON shift_record (status) WHERE status = 'AKTIF'"
    )


def downgrade():
    op.execute("DROP INDEX IF EXISTS uq_aktif_shift")
