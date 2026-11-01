"""Shared column helpers for the ORM models."""

import enum


def enum_values(enum_cls: type[enum.Enum]) -> list[str]:
    """Persist enum *values* ("uploaded") instead of names ("UPLOADED").

    Migration 0001 created the Postgres enum types with the lowercase values,
    so every `Enum(...)` column must pass `values_callable=enum_values`.
    """
    return [member.value for member in enum_cls]
