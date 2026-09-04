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


def upgrade():
    with op.batch_alter_table('transaksi', schema=None) as batch_op:
        batch_op.add_column(sa.Column('operator', sa.String(length=100), nullable=True))

    with op.batch_alter_table('transaksi_menu', schema=None) as batch_op:
        batch_op.add_column(sa.Column('operator', sa.String(length=100), nullable=True))


def downgrade():
    with op.batch_alter_table('transaksi_menu', schema=None) as batch_op:
        batch_op.drop_column('operator')

    with op.batch_alter_table('transaksi', schema=None) as batch_op:
        batch_op.drop_column('operator')
