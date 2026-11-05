"""Store original CV files in the database (cv_files)

Revision ID: 0004_cv_files
Revises: 0003_account_audit_actions
Create Date: 2026-11-05
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_cv_files"
down_revision: Union[str, None] = "0003_account_audit_actions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cv_files",
        sa.Column("cv_id", sa.Integer(), sa.ForeignKey("cvs.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.Column("content_type", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("cv_files")
