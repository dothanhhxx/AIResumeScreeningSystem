"""
Admin user management: list, edit, change role, lock/unlock, delete.

Safety rules, enforced here rather than only in the UI:
- An admin cannot demote, lock or delete their own account.
- The workspace always keeps at least one active admin.
- Accounts with hiring activity (JDs, CVs, decisions) cannot be deleted, because
  that history must stay attributable. Lock them instead.
"""

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, ConflictError, DuplicateError, NotFoundError
from app.core.security import hash_password
from app.models.audit_log import AuditAction, AuditLog
from app.models.cv import CV
from app.models.decision import Decision
from app.models.job import Job
from app.models.user import User, UserRole
from app.schemas.user import ManagedUser, UserUpdate


def _count_by(column, owner_column):
    return (
        select(owner_column.label("user_id"), func.count(column).label("n"))
        .group_by(owner_column)
        .subquery()
    )


async def list_users(
    db: AsyncSession,
    *,
    search: str | None = None,
    role: UserRole | None = None,
    active: bool | None = None,
    user_id: int | None = None,
) -> list[ManagedUser]:
    jobs = _count_by(Job.id, Job.created_by)
    cvs = _count_by(CV.id, CV.uploaded_by)
    decisions = _count_by(Decision.id, Decision.decided_by)
    logins = (
        select(AuditLog.user_id.label("user_id"), func.max(AuditLog.created_at).label("last"))
        .where(AuditLog.action == AuditAction.LOGIN)
        .group_by(AuditLog.user_id)
        .subquery()
    )

    statement = (
        select(
            User,
            func.coalesce(jobs.c.n, 0),
            func.coalesce(cvs.c.n, 0),
            func.coalesce(decisions.c.n, 0),
            logins.c.last,
        )
        .outerjoin(jobs, jobs.c.user_id == User.id)
        .outerjoin(cvs, cvs.c.user_id == User.id)
        .outerjoin(decisions, decisions.c.user_id == User.id)
        .outerjoin(logins, logins.c.user_id == User.id)
        .order_by(User.is_active.desc(), User.created_at.asc(), User.id.asc())
    )
    if user_id is not None:
        statement = statement.where(User.id == user_id)
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        statement = statement.where(or_(User.full_name.ilike(pattern), User.email.ilike(pattern)))
    if role is not None:
        statement = statement.where(User.role == role)
    if active is not None:
        statement = statement.where(User.is_active == active)

    rows = (await db.execute(statement)).all()
    return [
        ManagedUser(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at,
            last_login_at=last_login,
            jobs_created=n_jobs,
            cvs_uploaded=n_cvs,
            decisions_made=n_decisions,
        )
        for user, n_jobs, n_cvs, n_decisions, last_login in rows
    ]


async def get_managed_user(db: AsyncSession, user_id: int) -> ManagedUser:
    users = await list_users(db, user_id=user_id)
    if not users:
        raise NotFoundError("User", user_id)
    return users[0]


async def _active_admins(db: AsyncSession) -> int:
    return (
        await db.scalar(
            select(func.count(User.id)).where(User.role == UserRole.ADMIN, User.is_active.is_(True))
        )
        or 0
    )


async def update_user(
    db: AsyncSession, actor: User, user_id: int, payload: UserUpdate
) -> tuple[User, list[str]]:
    """Apply the sent fields. Returns the user and the names of the fields that changed."""
    user = await db.get(User, user_id)
    if user is None:
        raise NotFoundError("User", user_id)

    changes = payload.model_dump(exclude_unset=True)
    loses_admin = (
        user.role == UserRole.ADMIN
        and user.is_active
        and (
            ("role" in changes and changes["role"] not in (None, UserRole.ADMIN))
            or changes.get("is_active") is False
        )
    )
    if loses_admin and user.id == actor.id:
        raise BadRequestError("You cannot remove your own administrator access.")
    if loses_admin and await _active_admins(db) <= 1:
        raise BadRequestError("The workspace needs at least one active administrator.")

    new_email = changes.get("email")
    if new_email and new_email != user.email:
        taken = await db.scalar(select(User.id).where(User.email == new_email, User.id != user.id))
        if taken is not None:
            raise DuplicateError("email", new_email)

    changed: list[str] = []
    for field in ("full_name", "email", "role", "is_active"):
        value = changes.get(field)
        if value is not None and getattr(user, field) != value:
            setattr(user, field, value)
            changed.append(field)
    if changes.get("password"):
        user.hashed_password = hash_password(changes["password"])
        changed.append("password")

    await db.commit()
    await db.refresh(user)
    return user, changed


async def delete_user(db: AsyncSession, actor: User, user_id: int) -> tuple[str, str, str]:
    """Permanently remove an account with no hiring activity. Returns (email, name, role) for the audit entry."""
    user = await db.get(User, user_id)
    if user is None:
        raise NotFoundError("User", user_id)
    if user.id == actor.id:
        raise BadRequestError("You cannot delete your own account.")
    if user.role == UserRole.ADMIN and user.is_active and await _active_admins(db) <= 1:
        raise BadRequestError("The workspace needs at least one active administrator.")

    managed = await get_managed_user(db, user_id)
    if managed.has_activity:
        raise ConflictError(
            "This account has hiring activity (job descriptions, CVs or decisions). Lock it instead of deleting."
        )

    snapshot = (user.email, user.full_name, user.role.value)
    # Its sign-in records stay in the audit log without a user link; the deletion entry keeps the email.
    for log in (await db.scalars(select(AuditLog).where(AuditLog.user_id == user.id))).all():
        log.user_id = None
    await db.delete(user)
    await db.commit()
    return snapshot
