"""add summary to session_logs

Revision ID: 3df9b2874a76
Revises: c2a4b51893ef
Create Date: 2025-08-11 09:45:50.667945
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql  # (İstersen MEDIUMTEXT kullanmak için aç)

# revision identifiers, used by Alembic.
revision: str = "3df9b2874a76"
down_revision: Union[str, Sequence[str], None] = "c2a4b51893ef"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Sadece summary kolonu ekle
    # Eğer çok uzun özetler tutacaksan ve MySQL kullanıyorsan:
    op.add_column("session_logs", sa.Column("summary", mysql.MEDIUMTEXT(), nullable=True))
    # op.add_column("session_logs", sa.Column("summary", sa.Text(), nullable=True))


def downgrade() -> None:
    # Sadece summary kolonunu geri al
    op.drop_column("session_logs", "summary")
