"""Add scoring_weights JSON column to jobs

Revision ID: 0005_job_scoring_weights
Revises: 0004_cv_files
Create Date: 2026-11-08
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0005_job_scoring_weights"
down_revision: Union[str, None] = "0004_cv_files"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("scoring_weights", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("jobs", "scoring_weights")
