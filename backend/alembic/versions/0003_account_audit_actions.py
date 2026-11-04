"""Audit actions for account management (password change, user update, user delete)

Revision ID: 0003_account_audit_actions
Revises: 0002_scoring_pipeline
Create Date: 2026-11-04
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0003_account_audit_actions"
down_revision: Union[str, None] = "0002_scoring_pipeline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_ACTIONS = ("password_change", "user_update", "user_delete")


def upgrade() -> None:
    # PostgreSQL stores AuditAction as a native enum; SQLite stores plain strings.
    if op.get_bind().dialect.name == "postgresql":
        with op.get_context().autocommit_block():
            for action in NEW_ACTIONS:
                op.execute(f"ALTER TYPE auditaction ADD VALUE IF NOT EXISTS '{action}'")


def downgrade() -> None:
    # PostgreSQL cannot drop a single enum value; leaving them in place is harmless.
    pass
