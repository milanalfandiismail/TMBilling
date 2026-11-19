"""remove peripherals from hardware monitor

Revision ID: e7a1b2c3d4f5
Revises: c9d8e7f6a5b4
Create Date: 2026-09-30 11:20:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = 'e7a1b2c3d4f5'
down_revision = 'c9d8e7f6a5b4'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)

    if inspector.has_table('hardware_monitor'):
        hw_cols = [c['name'] for c in inspector.get_columns('hardware_monitor')]
        cols_to_drop = [
            'peripherals_disconnect_tracker',
            'peripherals_mismatch_time',
            'peripherals_mismatch_desc',
            'peripherals_mismatch',
            'peripherals_current',
            'peripherals_baseline'
        ]
        active_cols_to_drop = [col for col in cols_to_drop if col in hw_cols]

        if active_cols_to_drop:
            with op.batch_alter_table('hardware_monitor', schema=None) as batch_op:
                for col_name in active_cols_to_drop:
                    batch_op.drop_column(col_name)


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)

    if inspector.has_table('hardware_monitor'):
        hw_cols = [c['name'] for c in inspector.get_columns('hardware_monitor')]
        with op.batch_alter_table('hardware_monitor', schema=None) as batch_op:
            if 'peripherals_baseline' not in hw_cols:
                batch_op.add_column(sa.Column('peripherals_baseline', sa.Text(), nullable=True))
            if 'peripherals_current' not in hw_cols:
                batch_op.add_column(sa.Column('peripherals_current', sa.Text(), nullable=True))
            if 'peripherals_mismatch' not in hw_cols:
                batch_op.add_column(sa.Column('peripherals_mismatch', sa.Boolean(), nullable=True))
            if 'peripherals_mismatch_desc' not in hw_cols:
                batch_op.add_column(sa.Column('peripherals_mismatch_desc', sa.Text(), nullable=True))
            if 'peripherals_mismatch_time' not in hw_cols:
                batch_op.add_column(sa.Column('peripherals_mismatch_time', sa.DateTime(), nullable=True))
            if 'peripherals_disconnect_tracker' not in hw_cols:
                batch_op.add_column(sa.Column('peripherals_disconnect_tracker', sa.Text(), nullable=True))
