"""adding call_id to sessionlogs

Revision ID: 2eb805ef47d3
Revises: 3df9b2874a76
Create Date: 2025-08-11 13:27:01.703242
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "2eb805ef47d3"
down_revision: Union[str, Sequence[str], None] = "3df9b2874a76"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "session_logs",
        sa.Column("call_id", sa.String(length=128), nullable=True),
    )

    op.create_index(
        "uq_session_logs_call_id",
        "session_logs",
        ["call_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_session_logs_call_id", table_name="session_logs")
    op.drop_column("session_logs", "call_id")
