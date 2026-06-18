#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.monthly_snapshot_metrics import classifySnapshotStatus


def read_rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_rows(path: Path, rows: list[dict[str, str]], fieldnames: list[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def recalc_rows(rows: list[dict[str, str]], start_month: str, end_month: str) -> list[dict[str, str]]:
    ordered = sorted(rows, key=lambda row: row["snapshot_month"])
    month_to_index = {row["snapshot_month"]: index for index, row in enumerate(ordered)}

    for month, index in month_to_index.items():
        if month < start_month or month > end_month:
            continue
        history = [ordered[i].get("auto_payment_rate_change", "") for i in range(max(0, index - 6), index)]
        stable_flag, status_label, _threshold = classifySnapshotStatus(ordered[index], history, has_previous=index > 0)
        ordered[index]["stable_flag"] = stable_flag
        ordered[index]["status_label"] = status_label

    return ordered


def main() -> int:
    parser = argparse.ArgumentParser(description="Recalculate monthly auto-payment snapshot statuses.")
    parser.add_argument("csv_path", type=Path)
    parser.add_argument("--start-month", default="2025-01")
    parser.add_argument("--end-month", default="2026-05")
    parser.add_argument("--in-place", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    rows = read_rows(args.csv_path)
    updated = recalc_rows(rows, args.start_month, args.end_month)

    output_path = args.output if args.output else args.csv_path
    if not args.in_place and args.output is None:
        raise SystemExit("use --in-place or --output")

    write_rows(output_path, updated, list(updated[0].keys()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
