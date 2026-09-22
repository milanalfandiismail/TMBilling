"""add peripherals and cctv to hardware

Revision ID: b7e2c91a4f01
Revises: f3a1b2c4d5e6
Create Date: 2026-09-23 00:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b7e2c91a4f01'
down_revision = '8f7e6d5c4b3a'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('hardware_monitor', schema=None) as batch_op:
        batch_op.add_column(sa.Column('hardware_cctv_window', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('peripherals_baseline', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('peripherals_current', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('peripherals_mismatch', sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column('peripherals_mismatch_desc', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('peripherals_mismatch_time', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('peripherals_disconnect_tracker', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('hardware_monitor', schema=None) as batch_op:
        batch_op.drop_column('peripherals_disconnect_tracker')
        batch_op.drop_column('peripherals_mismatch_time')
        batch_op.drop_column('peripherals_mismatch_desc')
        batch_op.drop_column('peripherals_mismatch')
        batch_op.drop_column('peripherals_current')
        batch_op.drop_column('peripherals_baseline')
        batch_op.drop_column('hardware_cctv_window')
