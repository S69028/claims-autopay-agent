#!/usr/bin/env python3
"""Send the generated monthly auto-insurance report by email.

The script uses a send-only SMTP account and a private recipient CSV seed.
It is intentionally small so the 9th stage can be verified end-to-end without
introducing a heavier mailer dependency.
"""

from __future__ import annotations

import argparse
import hashlib
import csv
import mimetypes
import os
import re
import smtplib
import sys
import json
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PRIVATE_DIR = ROOT / "data" / "private"
ARCHIVE_TABLE_PATH = PRIVATE_DIR / "report_archive_fact.csv"
REPORT_FILE_INDEX_PATH = PRIVATE_DIR / "report_file_index.json"
DELIVERY_LOG_PATH = PRIVATE_DIR / "report_delivery_log.jsonl"
REPORT_FILE_RE = re.compile(r"^monthly_auto_payment_report_(\d{4}-\d{2})(?:_.*)?\.docx$")


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def load_dotenv_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue
        if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
            value = value[1:-1]
        os.environ.setdefault(key, value)


def env_bool(name: str, default: str = "false") -> bool:
    return env(name, default).lower() in {"1", "true", "yes", "y", "on"}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(8192), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_recipients(csv_path: Path) -> list[dict[str, str]]:
    with csv_path.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    return [row for row in rows if str(row.get("active_flag", "")).upper() == "Y"]


def read_csv_table(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh))


def write_csv_table(path: Path, rows: list[dict[str, object]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in fieldnames})


def append_jsonl(path: Path, row: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")


def build_report_file_index() -> dict[str, object]:
    reports_dir = ROOT / "reports"
    rows: list[dict[str, object]] = []
    if reports_dir.exists():
        for path in reports_dir.iterdir():
            if not path.is_file():
                continue
            match = REPORT_FILE_RE.match(path.name)
            if not match:
                continue
            stat = path.stat()
            rows.append(
                {
                    "snapshot_month": match.group(1),
                    "file_name": path.name,
                    "file_path": str(path.resolve()),
                    "updated_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat().replace("+00:00", "Z"),
                    "size_bytes": stat.st_size,
                }
            )

    rows.sort(
        key=lambda item: (
            str(item.get("snapshot_month", "")),
            str(item.get("updated_at", "")),
            str(item.get("file_name", "")),
        ),
        reverse=True,
    )
    return {"generated_at": now_iso(), "reports": rows}


def write_report_file_index() -> None:
    REPORT_FILE_INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_FILE_INDEX_PATH.write_text(
        json.dumps(build_report_file_index(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def upsert_archive_row(row: dict[str, object]) -> dict[str, object]:
    fieldnames = [
        "report_archive_id",
        "snapshot_month",
        "comparison_month",
        "report_title",
        "file_name",
        "file_path",
        "checksum",
        "generated_at",
        "sent_at",
        "generated_flag",
        "sent_flag",
        "recipient_count",
        "report_status",
        "notes",
        "created_at",
        "updated_at",
    ]
    rows = read_csv_table(ARCHIVE_TABLE_PATH)
    snapshot_month = str(row["snapshot_month"])
    match = next((item for item in rows if str(item.get("snapshot_month", "")) == snapshot_month), None)
    if match is None:
        next_id = max([int(str(item.get("report_archive_id", "0")) or 0) for item in rows] or [0]) + 1
        row = {**row, "report_archive_id": next_id, "created_at": row["generated_at"], "updated_at": row["generated_at"]}
        rows.append(row)
    else:
        row = {**match, **row, "updated_at": row["generated_at"]}
        rows = [row if str(item.get("snapshot_month", "")) == snapshot_month else item for item in rows]
    rows.sort(key=lambda item: str(item.get("snapshot_month", "")))
    write_csv_table(ARCHIVE_TABLE_PATH, rows, fieldnames)
    return row


def record_delivery_log(
    *,
    report_archive_id: int,
    recipients: list[str],
    sent_at: str,
    success: bool,
    error_message: str | None = None,
) -> None:
    status = "발송됨" if success else "실패"
    existing = 0
    if DELIVERY_LOG_PATH.exists():
        existing = sum(1 for line in DELIVERY_LOG_PATH.read_text(encoding="utf-8").splitlines() if line.strip())
    for offset, recipient in enumerate(recipients, start=1):
        append_jsonl(
            DELIVERY_LOG_PATH,
            {
                "delivery_id": existing + offset,
                "report_archive_id": report_archive_id,
                "recipient_email": recipient,
                "delivery_status": status,
                "sent_at": sent_at if success else None,
                "error_message": error_message,
                "created_at": sent_at,
            },
        )


def build_archive_state(
    *,
    report_month: str,
    report_path: Path,
    recipient_count: int,
    sent_at: str | None,
    success: bool,
    notes: str | None,
) -> dict[str, object]:
    generated_at = now_iso()
    comparison_month = f"{int(report_month[:4]) - 1}-12" if report_month.endswith("-01") else f"{report_month[:4]}-{int(report_month[5:7]) - 1:02d}"
    return {
        "snapshot_month": report_month,
        "comparison_month": comparison_month,
        "report_title": f"월간 자동심사 현황 리포트 {report_month}",
        "file_name": report_path.name,
        "file_path": str(report_path),
        "checksum": sha256_file(report_path),
        "generated_at": generated_at,
        "sent_at": sent_at,
        "generated_flag": "Y",
        "sent_flag": "Y" if success else "N",
        "recipient_count": recipient_count,
        "report_status": "발송됨" if success else "미발송",
        "notes": notes,
    }


def resolve_report_path(report_path: str | None, report_month: str) -> Path:
    if report_path:
        return Path(report_path).expanduser().resolve()
    return ROOT / "reports" / f"monthly_auto_payment_report_{report_month}.docx"


def build_message(
    sender: str,
    display_name: str,
    subject_prefix: str,
    report_month: str,
    report_path: Path,
    recipients: list[str],
) -> EmailMessage:
    message = EmailMessage()
    from_header = f"{display_name} <{sender}>" if display_name else sender
    message["From"] = from_header
    message["To"] = ", ".join(recipients)
    message["Subject"] = f"{subject_prefix} {report_month} 월간 리포트"
    message.set_content(
        f"""안녕하세요.

{report_month} 기준 자동심사 현황 월간 리포트를 전달드립니다.

첨부 파일을 확인해 주세요.
"""
    )

    content_type, _ = mimetypes.guess_type(report_path.name)
    maintype, subtype = (content_type or "application/octet-stream").split("/", 1)
    message.add_attachment(
        report_path.read_bytes(),
        maintype=maintype,
        subtype=subtype,
        filename=report_path.name,
    )
    return message


def send_message(
    host: str,
    port: int,
    use_ssl: bool,
    username: str,
    password: str,
    message: EmailMessage,
) -> None:
    if use_ssl:
        with smtplib.SMTP_SSL(host, port, timeout=30) as client:
            if username:
                client.login(username, password)
            client.send_message(message)
        return

    with smtplib.SMTP(host, port, timeout=30) as client:
        client.ehlo()
        if env_bool("REPORT_SMTP_USE_STARTTLS", "true"):
            client.starttls()
            client.ehlo()
        if username:
            client.login(username, password)
        client.send_message(message)


def check_connection(host: str, port: int, use_ssl: bool, username: str, password: str) -> None:
    if use_ssl:
        with smtplib.SMTP_SSL(host, port, timeout=30) as client:
            client.ehlo()
            if username:
                client.login(username, password)
        return

    with smtplib.SMTP(host, port, timeout=30) as client:
        client.ehlo()
        if env_bool("REPORT_SMTP_USE_STARTTLS", "true"):
            client.starttls()
            client.ehlo()
        if username:
            client.login(username, password)


def main() -> int:
    load_dotenv_file(ROOT / ".env")

    parser = argparse.ArgumentParser(description="Send the monthly auto-payment report.")
    parser.add_argument("--report-month", default=os.environ.get("REPORT_MONTH", "2025-12"))
    parser.add_argument("--report-path")
    parser.add_argument("--check-connection", action="store_true")
    parser.add_argument(
        "--recipients-csv",
        default=env("REPORT_RECIPIENTS_CSV", "data/private/report_subscription_accounts.csv"),
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    report_path = resolve_report_path(args.report_path, args.report_month)
    if not report_path.exists():
        raise FileNotFoundError(f"report file not found: {report_path}")

    recipients = load_recipients(Path(args.recipients_csv))
    recipient_emails = [row["recipient_email"] for row in recipients if row.get("recipient_email")]
    if not recipient_emails:
        raise RuntimeError("no active recipients found")

    sender = env("REPORT_SMTP_FROM") or env("REPORT_SMTP_USERNAME") or "<pending>"
    if sender == "<pending>" and not args.dry_run:
        raise RuntimeError("REPORT_SMTP_FROM or REPORT_SMTP_USERNAME is required")

    subject_prefix = env("REPORT_DEFAULT_SUBJECT_PREFIX", "[자동심사 현황분석]")
    display_name = env("REPORT_SMTP_DISPLAY_NAME", "자동심사 현황분석 Agent")
    message = build_message(
        sender=sender,
        display_name=display_name,
        subject_prefix=subject_prefix,
        report_month=args.report_month,
        report_path=report_path,
        recipients=recipient_emails,
    )

    summary = {
        "provider": env("REPORT_SMTP_PROVIDER", "gmail"),
        "host": env("REPORT_SMTP_HOST", "smtp.gmail.com"),
        "port": int(env("REPORT_SMTP_PORT", "465")),
        "use_ssl": env_bool("REPORT_SMTP_USE_SSL", "true"),
        "sender": sender,
        "recipient_count": len(recipient_emails),
        "report_path": str(report_path),
        "report_month": args.report_month,
        "dry_run": args.dry_run,
    }

    if args.check_connection:
        check_connection(
            host=summary["host"],
            port=summary["port"],
            use_ssl=summary["use_ssl"],
            username=env("REPORT_SMTP_USERNAME"),
            password=env("REPORT_SMTP_PASSWORD"),
        )
        print(json.dumps({**summary, "connection_ok": True}, ensure_ascii=False, indent=2))
        return 0

    if args.dry_run:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 0

    sent_at = now_iso()
    try:
        write_report_file_index()
        send_message(
            host=summary["host"],
            port=summary["port"],
            use_ssl=summary["use_ssl"],
            username=env("REPORT_SMTP_USERNAME"),
            password=env("REPORT_SMTP_PASSWORD"),
            message=message,
        )
        archive_row = upsert_archive_row(
            build_archive_state(
                report_month=args.report_month,
                report_path=report_path,
                recipient_count=len(recipient_emails),
                sent_at=sent_at,
                success=True,
                notes=f"sent via {summary['provider']} smtp",
            )
        )
        record_delivery_log(
            report_archive_id=int(archive_row["report_archive_id"]),
            recipients=recipient_emails,
            sent_at=sent_at,
            success=True,
        )
        summary["report_archive_id"] = archive_row["report_archive_id"]
        summary["archive_log"] = str(ARCHIVE_TABLE_PATH)
        summary["delivery_log"] = str(DELIVERY_LOG_PATH)
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 0
    except Exception as exc:
        write_report_file_index()
        archive_row = upsert_archive_row(
            build_archive_state(
                report_month=args.report_month,
                report_path=report_path,
                recipient_count=len(recipient_emails),
                sent_at=sent_at,
                success=False,
                notes=f"send failed: {exc}",
            )
        )
        record_delivery_log(
            report_archive_id=int(archive_row["report_archive_id"]),
            recipients=recipient_emails,
            sent_at=sent_at,
            success=False,
            error_message=str(exc),
        )
        raise


if __name__ == "__main__":
    raise SystemExit(main())
