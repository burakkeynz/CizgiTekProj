"""user profile_url feature added

Revision ID: d92df504aea4
Revises: ef691d1d8838
Create Date: 2025-07-25 11:20:34.173809

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd92df504aea4'
down_revision: Union[str, Sequence[str], None] = 'ef691d1d8838'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('profile_picture_url', sa.String(length=500), nullable=True))

def downgrade() -> None:
    op.drop_column('users', 'profile_picture_url')
