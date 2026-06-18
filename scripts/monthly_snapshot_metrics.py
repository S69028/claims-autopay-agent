from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from math import sqrt
from typing import Any


def _as_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    return float(value)


def _as_int(value: Any) -> int:
    if value in (None, ""):
        return 0
    return int(float(value))


def _sample_stdev(values: Sequence[float]) -> float | None:
    if len(values) < 2:
        return None
    mean = sum(values) / len(values)
    variance = sum((value - mean) ** 2 for value in values) / (len(values) - 1)
    return sqrt(variance)


def calcAutoPaymentRate(snapshot: Mapping[str, Any]) -> float | None:
    total_claim_count = _as_int(snapshot.get("total_claim_count"))
    if total_claim_count == 0:
        return None
    auto_payment_count = _as_int(snapshot.get("auto_payment_count"))
    return round((auto_payment_count / total_claim_count) * 100, 2)


def calcProcessingEfficiency(snapshot: Mapping[str, Any]) -> float | None:
    total_claim_count = _as_int(snapshot.get("total_claim_count"))
    if total_claim_count == 0:
        return None
    auto_payment_count = _as_int(snapshot.get("auto_payment_count"))
    exclusion_count = _as_int(snapshot.get("exclusion_count"))
    return round(((auto_payment_count + exclusion_count) / total_claim_count) * 100, 2)


def calcChangeThreshold(
    history6m: Sequence[Any],
    k: float = 2.0,
    floor: float = 1.0,
    fallback: float = 3.0,
) -> float:
    changes = [_as_float(value) for value in history6m]
    numeric_changes = [value for value in changes if value is not None]
    if len(numeric_changes) < 3:
        return fallback
    window = numeric_changes[-6:]
    stdev = _sample_stdev(window)
    if stdev is None:
        return fallback
    return max(k * stdev, floor)


def classifySnapshotStatus(
    snapshot: Mapping[str, Any],
    history6m: Sequence[Any],
    has_previous: bool = True,
) -> tuple[str, str, float | None]:
    if not has_previous:
        return "N", "미확정", None

    if str(snapshot.get("data_frozen_flag", "")).upper() != "Y":
        return "N", "미확정", None

    rate_change = _as_float(snapshot.get("auto_payment_rate_change"))
    if rate_change is None:
        return "N", "미확정", None

    threshold = calcChangeThreshold(history6m)
    if abs(rate_change) <= threshold:
        return "Y", "안정", threshold
    return "N", "변화", threshold
