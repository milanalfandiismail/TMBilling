"""add unique active member session index

Revision ID: b9c2d3e4f5a6
Revises: a8f1b2c3d4e5
Create Date: 2026-11-01 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = 'b9c2d3e4f5a6'
down_revision = 'a8f1b2c3d4e5'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == 'sqlite':
        op.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_aktif_sesi_member "
            "ON sesi (member_id) WHERE status = 'aktif' AND member_id IS NOT NULL"
        )
    else:
        op.create_index(
            'uq_aktif_sesi_member',
            'sesi',
            ['member_id'],
            unique=True,
            postgresql_where=sa.text("status = 'aktif' AND member_id IS NOT NULL")
        )


def downgrade():
    op.execute("DROP INDEX IF EXISTS uq_aktif_sesi_member")
