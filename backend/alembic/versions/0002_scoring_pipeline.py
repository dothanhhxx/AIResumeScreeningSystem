"""Scoring pipeline columns — embeddings, sub-scores, evidence details, score override

Revision ID: 0002_scoring_pipeline
Revises: 0001_initial
Create Date: 2026-11-01
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_scoring_pipeline"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("cvs", sa.Column("embedding", sa.Text(), nullable=True))
    op.add_column("cvs", sa.Column("error_message", sa.Text(), nullable=True))
    op.add_column("jobs", sa.Column("embedding", sa.Text(), nullable=True))

    op.add_column("match_results", sa.Column("rule_score", sa.Float(), nullable=True))
    op.add_column("match_results", sa.Column("semantic_score", sa.Float(), nullable=True))
    op.add_column("match_results", sa.Column("llm_score", sa.Float(), nullable=True))
    op.add_column("match_results", sa.Column("details", sa.Text(), nullable=True))
    op.add_column(
        "match_results",
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint("uq_match_results_cv_job", "match_results", ["cv_id", "job_id"])

    op.add_column("decisions", sa.Column("score_override", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("decisions", "score_override")
    op.drop_constraint("uq_match_results_cv_job", "match_results", type_="unique")
    for column in ("updated_at", "details", "llm_score", "semantic_score", "rule_score"):
        op.drop_column("match_results", column)
    op.drop_column("jobs", "embedding")
    op.drop_column("cvs", "error_message")
    op.drop_column("cvs", "embedding")
