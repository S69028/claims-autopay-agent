# PoC DDL

This folder stores the SQL DDL for the PoC database.

## Structure

- `01_auto_payment_type_definition.sql`
- `02_auto_payment_exclusion_type_definition.sql`
- `03_claim_payment_fact.sql`
- `04_monthly_auto_payment_snapshot_fact.sql`
- `05_report_subscription_account.sql` (private source + public masked table)
- `06_report_archive_fact.sql`
- `07_report_delivery_log.sql`

## Notes

- PostgreSQL / Supabase compatible.
- Keep table definitions separate from seed data.
- Use this folder as the source of truth for schema changes in the PoC.
- `report_subscription_accounts.csv` is the private source-of-truth seed file for monthly report recipients.
- `public.report_subscription_account_public` is the masked read-only table used by the dashboard.
- `private.report_delivery_log` stores raw delivery history and should not be exposed through the browser.
