"""app/__init__.py — automatically include local .venv site-packages if invoked from system Python."""

import site
import sys
from pathlib import Path

_backend_dir = Path(__file__).resolve().parent.parent
for _candidate in (
    _backend_dir / ".venv" / "Lib" / "site-packages",
    *_backend_dir.glob(".venv/lib/python*/site-packages"),
):
    if _candidate.is_dir() and str(_candidate) not in sys.path:
        site.addsitedir(str(_candidate))


