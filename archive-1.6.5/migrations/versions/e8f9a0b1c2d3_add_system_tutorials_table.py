"""add_system_tutorials_table

Revision ID: e8f9a0b1c2d3
Revises: 326a351f8a88
Create Date: 2026-08-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e8f9a0b1c2d3'
down_revision = '326a351f8a88'
branch_labels = None
depends_on = None


def upgrade():
    # Only create if it does not exist (robust/safe)
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'system_tutorials' not in inspector.get_table_names():
        op.create_table('system_tutorials',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('title', sa.String(length=255), nullable=False),
            sa.Column('icon', sa.String(length=50), nullable=True),
            sa.Column('category', sa.String(length=100), nullable=True),
            sa.Column('content', sa.Text(), nullable=False),
            sa.Column('urutan', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )


def downgrade():
    op.drop_table('system_tutorials')
