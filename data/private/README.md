# Private report delivery source

This folder stores private-only source-of-truth data for report delivery.

- `report_subscription_accounts.csv` contains raw recipient emails.
- Do not expose this folder through the browser or public Data API.
- The dashboard should use `public.report_subscription_account_public` only.
- Raw emails are for private DB / seed sync only and must not appear in browser-rendered HTML.
- `report_archive_fact.csv` stores the latest local archive state for monthly report runs.
- `report_delivery_log.jsonl` stores append-only delivery history for send tests and audit.
