"""add read_receipt_enabled to Users

Revision ID: 9666587c4e4e
Revises: 300cc6b59874
Create Date: 2025-08-07 10:59:16.817891

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '9666587c4e4e'
down_revision = '300cc6b59874'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('users', sa.Column('read_receipt_enabled', sa.Boolean(), nullable=True))
    op.execute("UPDATE users SET read_receipt_enabled = 1")  
    op.alter_column(
        'users', 
        'read_receipt_enabled',
        existing_type=sa.Boolean(),
        nullable=False
    )

def downgrade():
    op.drop_column('users', 'read_receipt_enabled')
