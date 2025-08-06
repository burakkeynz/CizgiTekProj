"""add user message reads table

Revision ID: 300cc6b59874
Revises: d92df504aea4
Create Date: 2025-08-06 13:39:54.298922

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '300cc6b59874'
down_revision: Union[str, Sequence[str], None] = 'd92df504aea4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade():
    op.create_table(
        'user_message_reads',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('message_id', sa.Integer(), sa.ForeignKey('user_chat_messages.id'), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('user_id', 'message_id', name='unique_user_message_read')
    )

def downgrade():
    op.drop_table('user_message_reads')
