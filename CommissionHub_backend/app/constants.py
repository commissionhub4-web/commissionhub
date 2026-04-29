from __future__ import annotations

from datetime import date


COMMISSION_DEPARTMENTS: tuple[str, ...] = (
    "Communication",
    "Project Lead",
    "Development",
    "Development Support",
    "Night Shift",
    "Night Shift Support",
    "Sales",
    "Sales Support",
    "Upsell",
)

COMMISSION_DEPARTMENT_SET = set(COMMISSION_DEPARTMENTS)


def month_floor(value: date) -> date:
    return value.replace(day=1)
