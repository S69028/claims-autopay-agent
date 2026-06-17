CREATE TABLE IF NOT EXISTS report_archive_fact (
  report_archive_id BIGSERIAL PRIMARY KEY,
  snapshot_month CHAR(7) NOT NULL UNIQUE,
  comparison_month CHAR(7) NOT NULL,
  report_title VARCHAR(200) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  checksum TEXT NULL,
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMP NULL,
  generated_flag CHAR(1) NOT NULL DEFAULT 'Y',
  sent_flag CHAR(1) NOT NULL DEFAULT 'N',
  recipient_count INT NOT NULL DEFAULT 0,
  report_status VARCHAR(20) NOT NULL DEFAULT '생성됨',
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_report_archive_generated_flag
    CHECK (generated_flag IN ('Y', 'N')),
  CONSTRAINT chk_report_archive_sent_flag
    CHECK (sent_flag IN ('Y', 'N')),
  CONSTRAINT chk_report_archive_status
    CHECK (report_status IN ('생성됨', '발송됨', '미발송', '재생성 필요'))
);

CREATE INDEX IF NOT EXISTS idx_report_archive_fact_report_status
  ON report_archive_fact (report_status);

ALTER TABLE report_archive_fact ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS report_archive_fact_read ON report_archive_fact;
CREATE POLICY report_archive_fact_read
ON report_archive_fact
FOR SELECT
TO anon, authenticated
USING (true);
