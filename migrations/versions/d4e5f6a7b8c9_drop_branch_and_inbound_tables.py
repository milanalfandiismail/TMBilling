"""v1.6.5-rc2: Drop tabel cabang dan cabang_inbound (deprecate multi-branch subsystem)

Revision ID: d4e5f6a7b8c9
Revises: b9c2d3e4f5a6
Create Date: 2026-11-03 15:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd4e5f6a7b8c9'
down_revision = 'b9c2d3e4f5a6'
branch_labels = None
depends_on = None


def upgrade():
    # v1.6.5-rc2: Hapus tabel cabang_inbound terlebih dahulu lalu cabang
    op.execute("DROP TABLE IF EXISTS cabang_inbound")
    op.execute("DROP TABLE IF EXISTS cabang")


def downgrade():
    # v1.6.5-rc2: Skema downgrade untuk memulihkan tabel cabang jika dibutuhkan
    op.create_table(
        'cabang',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('nama', sa.String(length=100), nullable=False),
        sa.Column('url', sa.String(length=255), nullable=False),
        sa.Column('api_key', sa.String(length=255), nullable=False),
        sa.Column('aktif', sa.Boolean(), server_default='1', nullable=True),
        sa.Column('dibuat_pada', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table(
        'cabang_inbound',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('nama', sa.String(length=100), nullable=False),
        sa.Column('mac_address', sa.String(length=50), nullable=True),
        sa.Column('ip_address', sa.String(length=50), nullable=True),
        sa.Column('terakhir_akses', sa.DateTime(), nullable=True),
        sa.Column('is_blocked', sa.Boolean(), server_default='0', nullable=True),
        sa.Column('dibuat_pada', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
