CREATE TABLE IF NOT EXISTS report_delivery_log (
  delivery_id BIGSERIAL PRIMARY KEY,
  report_archive_id BIGINT NOT NULL REFERENCES report_archive_fact (report_archive_id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  delivery_status VARCHAR(20) NOT NULL,
  sent_at TIMESTAMP NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_report_delivery_status
    CHECK (delivery_status IN ('발송됨', '실패', '대기'))
);

CREATE INDEX IF NOT EXISTS idx_report_delivery_log_archive_id
  ON report_delivery_log (report_archive_id);

CREATE INDEX IF NOT EXISTS idx_report_delivery_log_recipient_email
  ON report_delivery_log (recipient_email);

ALTER TABLE report_delivery_log ENABLE ROW LEVEL SECURITY;
