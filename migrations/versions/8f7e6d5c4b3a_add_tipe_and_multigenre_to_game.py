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


def upgrade():
    with op.batch_alter_table('game', schema=None) as batch_op:
        batch_op.add_column(sa.Column('tipe', sa.String(length=50), nullable=True, server_default='game'))
        batch_op.alter_column('kategori',
               existing_type=sa.VARCHAR(length=100),
               type_=sa.String(length=500),
               existing_nullable=True)


def downgrade():
    with op.batch_alter_table('game', schema=None) as batch_op:
        batch_op.alter_column('kategori',
               existing_type=sa.String(length=500),
               type_=sa.VARCHAR(length=100),
               existing_nullable=True)
        batch_op.drop_column('tipe')
