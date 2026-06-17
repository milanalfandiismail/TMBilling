"""add_is_active_to_menu_item

Revision ID: 378524089e68
Revises: 434a73db84b5
Create Date: 2026-06-16 17:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '378524089e68'
down_revision = '434a73db84b5'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('menu_item', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')))


def downgrade():
    with op.batch_alter_table('menu_item', schema=None) as batch_op:
        batch_op.drop_column('is_active')
