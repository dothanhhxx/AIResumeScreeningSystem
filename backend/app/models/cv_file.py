"""
CVFile model — the original uploaded CV bytes, kept in the database.

Container disks on the deploy host are wiped on every redeploy/restart, so the
database (Supabase Postgres) is the durable copy of each original file. Object
storage (MinIO / local disk) is only a secondary copy.

Kept in its own table, with no relationship on CV, so listing CVs never loads
the file blobs.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, LargeBinary, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CVFile(Base):
    __tablename__ = "cv_files"

    cv_id: Mapped[int] = mapped_column(ForeignKey("cvs.id", ondelete="CASCADE"), primary_key=True)
    content: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    content_type: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self) -> str:
        return f"<CVFile cv_id={self.cv_id} bytes={len(self.content or b'')}>"
