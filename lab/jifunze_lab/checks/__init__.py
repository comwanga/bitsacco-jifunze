"""Checks for lab exercises: CHECKS maps an exercise id to fn(lab, runs) -> list of results."""
from __future__ import annotations

CHECKS: dict = {}


class Lab:
    """Handle passed to every check (node clients are imported lazily by the checks)."""
