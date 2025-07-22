"""initial migration with user status

Revision ID: 89e8f2a97d8a
Revises: 
Create Date: 2025-07-22 14:18:27.744021

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = '89e8f2a97d8a'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('status', sa.String(length=20), server_default='offline'))



def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'status')

