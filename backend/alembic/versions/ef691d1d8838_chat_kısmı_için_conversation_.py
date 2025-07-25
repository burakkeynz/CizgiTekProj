"""chat kısmı için conversation modellerini ekliyorum

Revision ID: ef691d1d8838
Revises: 89e8f2a97d8a
Create Date: 2025-07-25 08:52:29.402593

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ef691d1d8838'
down_revision: Union[str, Sequence[str], None] = '89e8f2a97d8a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
