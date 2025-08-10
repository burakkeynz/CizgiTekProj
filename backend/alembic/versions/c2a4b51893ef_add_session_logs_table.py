"""add session_logs table

Revision ID: c2a4b51893ef
Revises: 9666587c4e4e
Create Date: 2025-08-09
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c2a4b51893ef'
down_revision: Union[str, Sequence[str], None] = '9666587c4e4e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'session_logs',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('user1_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('user2_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('session_time_stamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('transcript', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        mysql_engine='InnoDB',
        mysql_charset='utf8mb4'
    )

    # Tekil indexler
    op.create_index('ix_session_logs_user1_id', 'session_logs', ['user1_id'])
    op.create_index('ix_session_logs_user2_id', 'session_logs', ['user2_id'])
    op.create_index('ix_session_logs_time', 'session_logs', ['session_time_stamp'])

    # Composite index: (user1_id, user2_id, session_time_stamp)
    op.create_index(
        'ix_session_logs_user_pair_time',
        'session_logs',
        ['user1_id', 'user2_id', 'session_time_stamp']
    )


def downgrade() -> None:
    op.drop_index('ix_session_logs_user_pair_time', table_name='session_logs')
    op.drop_index('ix_session_logs_time', table_name='session_logs')
    op.drop_index('ix_session_logs_user2_id', table_name='session_logs')
    op.drop_index('ix_session_logs_user1_id', table_name='session_logs')
    op.drop_table('session_logs')
